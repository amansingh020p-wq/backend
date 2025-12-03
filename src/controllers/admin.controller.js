  // import LoanRequest from "../models/loanrequest.model.js";
  // import OrderHistory from "../models/orderhistory.model.js";
  // import Transitions from "../models/transitions.model.js";
  import { ObjectId } from "mongoose";

  /*
  Need to fuigure out total route..
  */


  const userapprove = async (req, res) => {
    const { id } = req.body;
    // const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    // if (!userID) {
    //   return res.status(400).json({ status: "fail", message: "Admin User ID is required" });
    // }
    if (!ObjectId.isValid(id) ) {
      return res.status(400).json({ status: "fail", message: "Invalid User ID " });
    }

    try {
      const user = await User.findOneAndUpdate(
        { _id: id, isVerified: false },
        { isVerified: true },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ status: "fail", message: "User not found" });
      }
      //return user detail without passsword for safety
      return res.status(200).json({ status: "success", message: "User approved", user: user.select({ password: 0, isVerified: 0 }) });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  const approveWithdrawal = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Withdrawal ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Withdrawal ID or User ID" });
    }

    try {
      const Withdrawal = await Transitions.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "COMPLETED" },
        { new: true }
      );

      if (!Withdrawal) {
        return res.status(404).json({ status: "fail", message: "Withdrawal not found" });
      }

      return res.status(200).json({ status: "success", message: "Withdrawal approved", Withdrawal });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  };

  const rejectWithdrawal = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Withdrawal ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Withdrawal ID or User ID" });
    }

    try {
      const Withdrawal = await Transitions.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "CANCELLED" },
        { new: true }
      );

      if (!Withdrawal) {
        return res.status(404).json({ status: "fail", message: "Withdrawal not found" });
      }

      return res.status(200).json({ status: "success", message: "Withdrawal cancelled", Withdrawal });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  //Withdrawal Requests
  const getAllWithdrawals = async (req, res) => {
    try {
      const withdrawals = await Transitions.find({ type: "WITHDRAWAL" }).populate("userID", "name","email", );
      return res.status(200).json({ status: "success", data: withdrawals });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  const getAllDeposits = async (req, res) => {
    try {
      const deposits = await Transitions.find({ type: "DEPOSIT" }).populate("userID", "name","email", );
      return res.status(200).json({ status: "success", data: deposits });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  const approveddeposit = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Deposit ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Deposit ID or User ID" });
    }

    try {
      const deposit = await Transitions.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "COMPLETED" },
        { new: true }
      );

      if (!deposit) {
        return res.status(404).json({ status: "fail", message: "Deposit not found" });
      }

      return res.status(200).json({ status: "success", message: "Deposit approved", deposit });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  };


  const rejectDeposit = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Deposit ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Deposit ID or User ID" });
    }

    try {
      const deposit = await Transitions.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "CANCELLED" },
        { new: true }
      );

      if (!deposit) {
        return res.status(404).json({ status: "fail", message: "Deposit not found" });
      }

      return res.status(200).json({ status: "success", message: "Deposit cancelled", deposit });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }




  const approveBuy = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Buy ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Buy ID or User ID" });
    }

    try {
      const buy = await OrderHistory.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "COMPLETED" },
        { new: true }
      );

      if (!buy) {
        return res.status(404).json({ status: "fail", message: "Buy not found" });
      }

      return res.status(200).json({ status: "success", message: "Buy approved", buy });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  const approveSell = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Sell ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Sell ID or User ID" });
    }

    try {
      const sell = await OrderHistory.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "COMPLETED" },
        { new: true }
      );

      if (!sell) {
        return res.status(404).json({ status: "fail", message: "Sell not found" });
      }

      return res.status(200).json({ status: "success", message: "Sell approved", sell });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  } 



  const rejectBuy = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Buy ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Buy ID or User ID" });
    }

    try {
      const buy = await OrderHistory.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "CANCELLED" },
        { new: true }
      );

      if (!buy) {
        return res.status(404).json({ status: "fail", message: "Buy not found" });
      }

      return res.status(200).json({ status: "success", message: "Buy cancelled", buy });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  //History_orders
  const rejectSell = async (req, res) => {
    const { id } = req.body;
    const { userID } = req.userID;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Sell ID is required" });
    }
    if (!userID) {
      return res.status(400).json({ status: "fail", message: "User ID is required" });
    }
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userID)) {
      return res.status(400).json({ status: "fail", message: "Invalid Sell ID or User ID" });
    }

    try {
      const sell = await OrderHistory.findOneAndUpdate(
        { _id: id, userID: userID , status: "PENDING" },
        { status: "CANCELLED" },
        { new: true }
      );

      if (!sell) {
        return res.status(404).json({ status: "fail", message: "Sell not found" });
      }

      return res.status(200).json({ status: "success", message: "Sell cancelled", sell });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: "Server error", error });
    }
  }

  const getAllBuyOrders = async (req, res) => {
    res.status(501).json({ status: "fail", message: "Not implemented yet ::: getAllBuyOrders" });
  }

  const getAllSellOrders = async (req, res) => {
    res.status(501).json({ status: "fail", message: "Not implemented yet ::: getAllSellOrders" });
  }


  const getAllUsers = async (req, res) => {
    res.status(501).json({ status: "fail", message: "Not implemented yet ::: getAllUsers" });
  }

  export {
      approveWithdrawal,
      rejectWithdrawal,
      approveddeposit,
      rejectDeposit,
      approveBuy,
      rejectBuy,
      approveSell,
      rejectSell,
      getAllUsers,
      getAllDeposits,
      getAllWithdrawals,
      getAllBuyOrders,
      getAllSellOrders,
      userapprove,
  }