import Transaction from '../models/transaction.model.js';
import OrderHistory from '../models/orderhistory.model.js';

// Get dashboard data for the logged-in user
export const getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;

    // Total Deposit
    const totalDeposit = await Transaction.aggregate([
      { $match: { userId, type: 'DEPOSIT', status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const deposit = totalDeposit[0]?.total || 0;

    // Total Withdrawals
    const totalWithdrawals = await Transaction.aggregate([
      { $match: { userId, type: 'WITHDRAWAL', status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const withdrawals = totalWithdrawals[0]?.total || 0;

    // Base Account Balance (Deposits - Withdrawals)
    const baseBalance = deposit - withdrawals;

    /**
     * Trading-style metrics for user dashboard
     *
     * - orderInvestment: sum of tradeAmount for all OPEN trades
     *   (capital currently locked in active positions)
     * - profitLoss: sum of profitLoss for all CLOSED trades
     *   (realized P&L only)
     * - accountBalance (available funds):
     *     baseBalance - orderInvestment + profitLoss
     *
     *   Example:
     *     deposit = 1000, withdrawals = 0, open tradeAmount = 500, profitLoss = 0
     *     => baseBalance = 1000
     *     => accountBalance = 1000 - 500 + 0 = 500
     *
     *     After closing trade with +300 profit:
     *     open tradeAmount = 0, profitLoss = 300
     *     => accountBalance = 1000 - 0 + 300 = 1300
     */

    // Order Investment - only OPEN trades
    const orderInvestmentAgg = await OrderHistory.aggregate([
      { $match: { userId, status: 'OPEN' } },
      { $group: { _id: null, total: { $sum: '$tradeAmount' } } }
    ]);
    const orderInvestment = orderInvestmentAgg[0]?.total || 0;

    // Realized Profit/Loss - only CLOSED trades
    const profitLossAgg = await OrderHistory.aggregate([
      { $match: { userId, status: 'CLOSED' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$profitLoss', 0] } } } }
    ]);
    const profitLoss = profitLossAgg[0]?.total || 0;

    // Final available account balance considering open trades and realized P&L
    const accountBalance = baseBalance - orderInvestment + profitLoss;

    // TODO: Calculate percentage changes vs last month if needed

    res.json({
      accountBalance,
      totalDeposit: deposit,
      totalWithdrawals: withdrawals,
      profitLoss,
      orderInvestment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
};


export const getalltransationhistory = async (req,res)=>{
  
}