import  OrderHistory  from "../models/orderhistory.model.js";
import  User  from "../models/user.model.js";

//----------------------- new controllers -----------------------------------------------
const getUserTradeHistory = async (req, res) => {
    const { userId } = req.params;

    try {
        // Validate userId
        if (!userId) {
            return res.status(400).json({
                status: "error",
                message: "User ID is required"
            });
        }

        const tradeHistory = await OrderHistory.find({ userId })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        // Format data to match frontend expectations
        // Note: All monetary values (buyPrice, sellPrice, profitLoss, tradeAmount) are stored in INR
        // Frontend will convert to USD for display
        const formattedData = tradeHistory.map(trade => ({
            id: trade._id,
            date: trade.tradeDate.toISOString().split('T')[0],
            symbol: trade.symbol,
            quantity: trade.quantity,
            buyPrice: trade.buyPrice,
            sellPrice: trade.sellPrice,
            type: trade.type,
            profitLoss: trade.profitLoss || 0, // Return raw value in INR, frontend will convert to USD
            status: trade.status.toLowerCase(),
            tradeAmount: trade.tradeAmount,
            priceRange: trade.priceRange || null,
            currentPrice: trade.currentPrice || null,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt
        }));

        res.status(200).json({
            status: "success",
            data: formattedData
        });
    } catch (error) {
        console.error('Error fetching trade history:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

const createTrade = async (req, res) => {
    try {
        const { userId, symbol, tradeType, quantity, buyPrice, priceRangeLow, priceRangeHigh } = req.body;

        // Validate required fields
        if (!userId || !symbol || !tradeType || !quantity || !buyPrice) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required"
            });
        }

        // Parse quantity and buyPrice before calculating tradeAmount
        const quantityNum = parseFloat(quantity);
        const buyPriceNum = parseFloat(buyPrice);
        const tradeAmount = quantityNum * buyPriceNum;
        
        // Set mid to buyPrice, and handle range
        const priceRange = {
            low: priceRangeLow ? parseFloat(priceRangeLow) : null,
            high: priceRangeHigh ? parseFloat(priceRangeHigh) : null,
            mid: buyPriceNum // Mid is always the buy price
        };

        // Initialize currentPrice to mid (buyPrice) if range is provided
        let currentPrice = null;
        if (priceRange.low !== null && priceRange.high !== null) {
            currentPrice = buyPriceNum;
        }

        const newTrade = new OrderHistory({
            userId,
            symbol,
            type: tradeType.toUpperCase(),
            quantity: quantityNum,
            buyPrice: buyPriceNum,
            tradeAmount,
            priceRange,
            currentPrice,
            tradeDate: new Date(),
            status: 'OPEN'
        });

        await newTrade.save();

        res.status(201).json({
            status: "success",
            message: "Trade created successfully",
            data: newTrade
        });
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

const updateTrade = async (req, res) => {
    try {
        const { tradeId } = req.params;
        const updateData = req.body;

        // Handle price range updates
        if (updateData.priceRangeLow !== undefined || updateData.priceRangeHigh !== undefined) {
            const existingTrade = await OrderHistory.findById(tradeId);
            if (!existingTrade) {
                return res.status(404).json({
                    status: "error",
                    message: "Trade not found"
                });
            }

            const buyPrice = updateData.buyPrice ? parseFloat(updateData.buyPrice) : existingTrade.buyPrice;
            updateData.priceRange = {
                low: updateData.priceRangeLow !== undefined ? parseFloat(updateData.priceRangeLow) : (existingTrade.priceRange?.low || null),
                high: updateData.priceRangeHigh !== undefined ? parseFloat(updateData.priceRangeHigh) : (existingTrade.priceRange?.high || null),
                mid: buyPrice // Mid is always the buy price
            };

            // Initialize currentPrice if range is provided and trade is open
            if (updateData.priceRange.low !== null && updateData.priceRange.high !== null && 
                (updateData.status === 'OPEN' || existingTrade.status === 'OPEN')) {
                updateData.currentPrice = buyPrice;
            }

            // Remove the individual fields from updateData
            delete updateData.priceRangeLow;
            delete updateData.priceRangeHigh;
        }

        // Calculate profit/loss if sellPrice is provided
        if (updateData.sellPrice) {
            // Get existing trade if we need buyPrice or quantity
            let existingTrade = null;
            if (!updateData.buyPrice || !updateData.quantity) {
                existingTrade = await OrderHistory.findById(tradeId);
                if (!existingTrade) {
                    return res.status(404).json({
                        status: "error",
                        message: "Trade not found"
                    });
                }
            }
            
            const buyPrice = updateData.buyPrice ? parseFloat(updateData.buyPrice) : existingTrade.buyPrice;
            const quantity = updateData.quantity ? parseFloat(updateData.quantity) : existingTrade.quantity;
            const sellPrice = parseFloat(updateData.sellPrice);
            
            const buyTotal = buyPrice * quantity;
            const sellTotal = sellPrice * quantity;
            // For LONG: profit when sellPrice > buyPrice (sellTotal - buyTotal)
            // For SHORT: profit when sellPrice > buyPrice (sellTotal - buyTotal)
            // Both use the same formula: sellTotal - buyTotal
            let profitLoss = sellTotal - buyTotal;
            
            // Apply automatic brokerage deduction of $1 USD when trade exits with profit
            // $1 USD = 90 INR (based on conversion rate)
            // If profit is $5 USD (450 INR), it becomes $4 USD (360 INR) after brokerage deduction
            const BROKERAGE_FEE_INR = 90; // $1 USD = 90 INR
            if (profitLoss > 0) {
                profitLoss = profitLoss - BROKERAGE_FEE_INR; // Deduct $1 USD (90 INR) brokerage fee
            }
            
            updateData.profitLoss = profitLoss;
        }

        // Update tradeAmount if quantity or buyPrice changed
        if (updateData.quantity && updateData.buyPrice) {
            updateData.tradeAmount = updateData.quantity * updateData.buyPrice;
        }

        const updatedTrade = await OrderHistory.findByIdAndUpdate(
            tradeId,
            { ...updateData, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!updatedTrade) {
            return res.status(404).json({
                status: "error",
                message: "Trade not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Trade updated successfully",
            data: updatedTrade
        });
    } catch (error) {
        console.error('Error updating trade:', error);
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};

export { 
    getUserTradeHistory, 
    createTrade, 
    updateTrade, 
};
