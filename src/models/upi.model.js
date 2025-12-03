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
    }
}, {
    timestamps: true
});


const Upi = mongoose.model("Upi", UpiSchema);
export default Upi;