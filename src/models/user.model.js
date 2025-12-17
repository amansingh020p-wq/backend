import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import Jwt from "jsonwebtoken";
import Transaction from "./transaction.model.js";
import OrderHistory from "./orderhistory.model.js";

const TransactionType = {
  WITHDRAW: 'WITHDRAW',
  DEPOSIT: 'DEPOSIT'
};

const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED'
};

const PaymentMethod = {
  CARD: 'CARD',
  UPI: 'UPI',
  NETBANKING: 'NETBANKING',
  WALLET: 'WALLET'
};

const TradeType = {
  LONG: 'LONG',
  SHORT: 'SHORT'
};

const TradeStatus = {
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  PENDING_SELL: 'PENDING_SELL'
};

const LoanStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};


const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  generatedPassword: {
    type: String,
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  aadharNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pan: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  gender: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  nomineeName: {
    type: String,
    required: true,
    trim: true
  },
  nomineeRelation: {
    type: String,
    required: true,
    trim: true
  },
  nomineeDob: {
    type: Date,
    required: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  accountHolder: {
    type: String,
    required: true,
    trim: true
  },
  ifscCode: {
    type: String,
    required: true,
    trim: true
  },
  aadharPhoto: {
    type: String,
    required: true
  },
  panPhoto: {
    type: String,
    required: true
  },
  userPhoto: {
    type: String,
    required: true
  },
  passbookPhoto: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['admin', 'user' ],
    default: 'user',
    trim: true
  },
  status: {
    type: String,
    default: 'active',
    trim: true
  },
  transactions:
    [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction'
      },
    ],

  loanRequest: [{
    type: Schema.Types.ObjectId,
    ref: 'LoanRequest'
  }],
  paymentInfo: [{
    type: Schema.Types.ObjectId,
    ref: 'PaymentInfo'
  }],
  //order is trade
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'OrderHistory'
  }],
  lastLogin: {
  type: Date,
  default: null
  },
}, {
  timestamps: true
});


UserSchema.methods.generateAccessToken = function(){
  return Jwt.sign({
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
      role: this.role
  },
  process.env.ACCESS_TOKEN_SECRET,
  {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
  }
  )
}

UserSchema.pre('save',async function (next){
  if(!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password,10);
  next();
})


UserSchema.statics.getUserBalances = async function (userId) {
  // Normalise userId to ObjectId
  const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? userId instanceof mongoose.Types.ObjectId
      ? userId
      : new mongoose.Types.ObjectId(userId)
    : userId;

  // 1) Deposit / withdrawal aggregates
  const balanceDataArr = await Transaction.aggregate([
    { $match: { userId: userIdObjectId } },
    {
      $group: {
        _id: null,
        totalDeposits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEPOSIT"] },
                  { $eq: ["$status", "COMPLETED"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        totalWithdrawals: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "WITHDRAWAL"] },
                  { $eq: ["$status", "COMPLETED"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        pendingDeposits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "DEPOSIT"] },
                  { $eq: ["$status", "PENDING"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        pendingWithdrawals: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$type", "WITHDRAWAL"] },
                  { $eq: ["$status", "PENDING"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const tx = balanceDataArr[0] || {
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  };

  // 2) Trading aggregates (open investment + realised P&L)
  const tradeAggArr = await OrderHistory.aggregate([
    { $match: { userId: userIdObjectId } },
    {
      $group: {
        _id: null,
        openInvestment: {
          $sum: {
            $cond: [
              { $eq: ["$status", "OPEN"] },
              { $ifNull: ["$tradeAmount", 0] },
              0,
            ],
          },
        },
        realisedProfitLoss: {
          $sum: {
            $cond: [
              { $eq: ["$status", "CLOSED"] },
              { $ifNull: ["$profitLoss", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const trade = tradeAggArr[0] || {
    openInvestment: 0,
    realisedProfitLoss: 0,
  };

  // 3) Combine into trading-style balance
  const baseBalance = tx.totalDeposits - tx.totalWithdrawals;
  const accountBalance = baseBalance - trade.openInvestment + trade.realisedProfitLoss;

  const totalBalance = baseBalance;
  const availableBalance = accountBalance - tx.pendingWithdrawals;
  const pendingAmount = tx.pendingDeposits + tx.pendingWithdrawals;

  return {
    // Existing fields (backwards compatible)
    totalBalance,
    availableBalance,
    pendingAmount,
    totalWithdrawn: tx.totalWithdrawals,
    totalDeposited: tx.totalDeposits,
    pendingDeposits: tx.pendingDeposits,
    pendingWithdrawals: tx.pendingWithdrawals,

    // New trading-aware wallet fields
    accountBalance,
    totalDeposit: tx.totalDeposits,
    totalWithdrawals: tx.totalWithdrawals,
    orderInvestment: trade.openInvestment,
    profitLoss: trade.realisedProfitLoss,
  };
};

const User = mongoose.model('User', UserSchema);
export default User;