  import mongoose, {Schema} from "mongoose";

  export const PaymentMethod = {
    CARD: 'CARD',
    UPI: 'UPI',
    NETBANKING: 'NETBANKING',
    WALLET: 'WALLET'
  };

  const TransactionSchema = new Schema({
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['WITHDRAWAL', 'DEPOSIT'],
      required: true
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    //------------not aplicable for now
    // razorpayPaymentId: {
    //   type: String,
    //   unique: true,
    //   sparse: true,
    //   trim: true
    // },
    // razorpaySignature: {
    //   type: String,
    //   trim: true
    // },
    status: {
      type: String,
      enum: [
        'PENDING',
        'COMPLETED',
        'FAILED',
        'REFUNDED',
        'CANCELLED'
      ],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true
    },
    description: {
      type: String,
      trim: true
    },

    //TODO: WHAT IS THIS? now i know
    metadata: {
      type: Map,
      of: Schema.Types.Mixed
    },
    failureReason: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod)
    },
    verified: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: 'updatedAt'
    }
  });


  const Transaction = mongoose.model('Transaction', TransactionSchema);
  export default Transaction;