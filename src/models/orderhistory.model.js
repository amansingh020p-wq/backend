import mongoose, {Schema} from "mongoose";

const OrderHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tradeDate: {
    type: Date,
    required: true
  },
  symbol: {
    type: String,
    default: 'UNKNOWN',
    trim: true
  },
  quantity: {
    type: Number,
    required: true
  },
  //need to  look into this
  buyPrice: {
    type: Number,
    // required: true        
  },
  sellPrice: {
    type: Number
  },
  type: {
    type: String,
    default: 'LONG',
    enum: [
      'LONG',
      'SHORT'
    ]
  },
  status: {
    type: String,
    default: 'OPEN',
    enum: [
      'PENDING',
      'OPEN',
      'CLOSED',
      'PENDING_SELL'
    ]
  },
  profitLoss: {
    type: Number
  },
  tradeAmount: {
    type: Number,
    required: true
  },
  // Range fields for live price simulation
  priceRange: {
    low: {
      type: Number,
      default: null
    },
    high: {
      type: Number,
      default: null
    },
    mid: {
      type: Number,
      default: null
    }
  },
  currentPrice: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const OrderHistory = mongoose.model('OrderHistory', OrderHistorySchema);
export default OrderHistory;