import  User  from "../models/user.model.js";
import Jwt  from "jsonwebtoken";


const veriftyJWT = async (req, res, next) => {
  try {
    // Extract token from cookies or Authorization header
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "");
      }
    }

    if (!token) {
      return res.status(401).json({ 
        status: "error",
        message: "Unauthorized access. Authentication token required." 
      });
    }

    // Verify and decode token
    let decodedToken;
    try {
      decodedToken = await Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          status: "error",
          message: "Token has expired. Please login again." 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          status: "error",
          message: "Invalid token." 
        });
      }
      return res.status(401).json({ 
        status: "error",
        message: "Token verification failed." 
      });
    }

    // Fetch user from database
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    if (!user) {
      return res.status(401).json({ 
        status: "error",
        message: "Invalid Access Token. User not found." 
      });
    }

    // Attach user info to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error("[AUTH] JWT verification error:", error);
    return res.status(500).json({ 
      status: "error",
      message: "Internal server error during authentication" 
    });
  }
}

const isAdmin = async (req, res, next) => {
  try {
    // Extract token from cookies or Authorization header
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "");
      }
    }
    
    if (!token) {
      return res.status(401).json({ 
        status: "error",
        message: "Unauthorized access. Authentication token required." 
      });
    }

    // Verify and decode token
    let decodedToken;
    try {
      decodedToken = await Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        status: "error",
        message: "Invalid or expired token" 
      });
    }

    // Fetch user from database
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    if (!user) {
      return res.status(401).json({ 
        status: "error",
        message: "Invalid Access Token. User not found." 
      });
    }

    // Check if user account is active
    if (user.isVerified === false) {
      return res.status(403).json({ 
        status: "error",
        message: "Account not verified. Access denied." 
      });
    }

    // Verify admin role
    if (user.role !== "admin") {
      // Log unauthorized access attempt
      console.warn(`[SECURITY] Unauthorized admin access attempt by user: ${user.email} (Role: ${user.role}) from IP: ${req.ip}`);
      return res.status(403).json({ 
        status: "error",
        message: "Forbidden. Admin access required." 
      });
    }

    // Attach user info to request object
    req.user = user;
    req.userId = user._id;
    req.role = user.role;
    
    next();
  } catch (error) {
    console.error("[SECURITY] Admin middleware error:", error);
    return res.status(500).json({ 
      status: "error",
      message: "Internal server error during authentication" 
    });
  }
}

export {
  isAdmin,
  veriftyJWT
}