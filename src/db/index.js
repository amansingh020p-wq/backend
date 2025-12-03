import mongoose from "mongoose";
  

const connectDB = async ()=>{
    console.log(`Mongodb Uri${process.env.MONGODB_URI}`)
    try {
        const connectionInst = await mongoose.connect(`${process.env.MONGODB_URI}`, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`Mongo Connected !!!!`);
    } catch (error) {
        console.log("Mongo not connect !!",error);
        console.log("Server will continue without database connection");
    }
    
}


export default connectDB;