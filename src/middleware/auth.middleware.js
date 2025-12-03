import  User  from "../models/user.model.js";
import Jwt  from "jsonwebtoken";


const veriftyJWT = async (req, res, next) => {
  // console.log("Auth middleware called")
    try {
        const token = req.cookies?.accessToken
        // console.log("token form auth middleware", token)
        if (!token) {
            return res.status(401).json({ message: "Unauthorized access" })
        }
    
        const decodedToken = await Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            //NEXT TODO
            return res.status(401).json({ message: "Invalid Access Token" })
        }
    
        req.user = user;
        req.userId = user._id;
        // req.role = user.role
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid access token" })
    }
}

const isAdmin = async (req, res, next) => {
  const token = req.cookies?.accessToken || req.header("Authorization").replace("Bearer ", "")
  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" })
  }
  const decodedToken = await Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
  const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
  if (!user) {
    return res.status(401).json({ message: "Invalid Access Token" })
  }
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" })
  }
  req.user = user;
  req.userId = user._id;
  req.role = user.role;
  next();
}

export {
  isAdmin,
  veriftyJWT
}