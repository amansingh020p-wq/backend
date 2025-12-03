import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Check if Cloudinary is properly configured
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

let storage;
let upload;

try {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary environment variables are not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file.');
  }

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'user_documents',
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    }
  });

  upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  });
} catch (error) {
  console.error('❌ Error initializing Cloudinary storage:', error.message);
  // Create a fallback storage that will return an error
  storage = null;
  upload = null;
}

// Create a middleware that checks if upload is configured
const uploadFields = (req, res, next) => {
  if (!upload) {
    return res.status(500).json({
      status: 'error',
      message: 'File upload service is not configured. Please configure Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) in your .env file.',
      error: 'Cloudinary configuration missing'
    });
  }
  
  const multerMiddleware = upload.fields([
    { name: 'aadharPhoto', maxCount: 1 },
    { name: 'panPhoto', maxCount: 1 },
    { name: 'userPhoto', maxCount: 1 },
    { name: 'passbookPhoto', maxCount: 1 }
  ]);
  
  // Wrap multer middleware with error handling
  multerMiddleware(req, res, (err) => {
    if (err) {
      console.error('Multer/Upload Error:', err);
      
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'File size too large. Maximum file size is 5MB.',
            error: err.message
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            status: 'error',
            message: 'Too many files uploaded.',
            error: err.message
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            status: 'error',
            message: 'Unexpected file field.',
            error: err.message
          });
        }
        return res.status(400).json({
          status: 'error',
          message: 'File upload error: ' + err.message,
          error: err.code
        });
      }
      
      // Handle Cloudinary errors
      if (err.message && err.message.includes('api_key')) {
        return res.status(500).json({
          status: 'error',
          message: 'Cloudinary API key error. Please check your CLOUDINARY_API_KEY in .env file.',
          error: 'Cloudinary configuration error'
        });
      }
      
      // Handle other errors
      return res.status(500).json({
        status: 'error',
        message: 'File upload failed: ' + err.message,
        error: err.message
      });
    }
    
    // No error, continue to next middleware
    next();
  });
};

export { uploadFields };
export default upload; 