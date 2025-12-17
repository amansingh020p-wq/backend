/**
 * Input validation and sanitization middleware
 * Protects against injection attacks and malformed input
 */

import mongoose from 'mongoose';

// Basic email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize string input to prevent XSS
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// Validate MongoDB ObjectId
export const validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Middleware to validate login input
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      message: "Email and password are required"
    });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid email format"
    });
  }

  // Check password length (minimum security requirement)
  if (password.length < 6) {
    return res.status(400).json({
      status: "error",
      message: "Password must be at least 6 characters long"
    });
  }

  // Sanitize email
  req.body.email = sanitizeString(email.toLowerCase());

  next();
};

// Middleware to validate admin ID parameter
export const validateAdminParams = (req, res, next) => {
  const { id, userId, tradeId, transactionId } = req.params || {};
  const idToValidate = id || userId || tradeId || transactionId;

  // Only validate if an ID is provided
  if (idToValidate && !validateObjectId(idToValidate)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid ID format"
    });
  }

  next();
};
