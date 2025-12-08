import mongoose, { Schema } from "mongoose";

const UpiSchema = new Schema({
    upiId: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        required: true
    },
    bussinessname: {
        type: String,
        trim: true,
        required: true
    },
    // Bank details for bank transfer option
    bankName: {
        type: String,
        trim: true,
        default: ""
    },
    accountNumber: {
        type: String,
        trim: true,
        default: ""
    },
    ifscCode: {
        type: String,
        trim: true,
        default: ""
    },
    accountName: {
        type: String,
        trim: true,
        default: ""
    },
    // Admin can toggle which UPI should be surfaced to users
    isActive: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});


const Upi = mongoose.model("Upi", UpiSchema);
export default Upi;