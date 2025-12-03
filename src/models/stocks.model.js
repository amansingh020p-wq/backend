import mongoose, {Schema} from "mongoose";

const stockSchema = new Schema({
  symbol: {
    type: String,
    required: true,
    trim: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
}, {
  timestamps: true
});

const Stock = mongoose.model("Stock", stockSchema);
export default Stock;