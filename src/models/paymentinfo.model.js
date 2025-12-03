import mongoose, {Schema} from "mongoose";

const PaymentInfoSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'OTHER'],
    default: 'UPI',
    trim: true
  },
  upiId: {
    type: String,
    required: true,
    trim: true
  },
  merchantName: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
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

const PaymentInfo = mongoose.model('PaymentInfo', PaymentInfoSchema);
export default PaymentInfo;