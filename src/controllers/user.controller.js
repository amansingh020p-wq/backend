import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Transaction from "../models/transaction.model.js";
import OrderHistory from "../models/orderhistory.model.js";

// Note: dotenv should be loaded in index.js before this module is imported
// This is just a safety fallback

// Email transporter configuration for GoDaddy Titan Mail
// Uses SMTP configuration optimized for GoDaddy's email servers
const createTransporter = () => {
  // Use EMAIL_USER for auth (fallback to EMAIL_FROM if EMAIL_USER not set)
  let emailUser = process.env.EMAIL_USER || process.env.EMAIL_FROM;
  let emailPass = process.env.EMAIL_PASS;

  // Remove quotes if present (dotenv sometimes includes them)
  if (emailUser) {
    emailUser = emailUser.trim().replace(/^["']|["']$/g, "");
  }
  if (emailPass) {
    emailPass = emailPass.trim().replace(/^["']|["']$/g, "");
  }

  // Debug logging - show raw values
  console.log("GoDaddy Titan Mail configuration check (raw):", {
    EMAIL_USER: process.env.EMAIL_USER
      ? `"${process.env.EMAIL_USER}"`
      : "✗ Missing",
    EMAIL_FROM: process.env.EMAIL_FROM
      ? `"${process.env.EMAIL_FROM}"`
      : "✗ Missing",
    EMAIL_PASS: process.env.EMAIL_PASS ? "✓ Set (hidden)" : "✗ Missing",
    EMAIL_HOST: process.env.EMAIL_HOST || "smtpout.secureserver.net (default)",
    EMAIL_PORT: process.env.EMAIL_PORT || "587 (default)",
  });

  console.log("GoDaddy Titan Mail configuration check (processed):", {
    emailUser: emailUser || "✗ Missing",
    emailPass: emailPass ? "✓ Set (hidden)" : "✗ Missing",
    emailHost: process.env.EMAIL_HOST || "smtpout.secureserver.net (default)",
    emailPort: process.env.EMAIL_PORT || "587 (default)",
  });

  // Important note for GoDaddy Titan Mail
  if (emailUser && !emailUser.includes('@')) {
    console.warn("⚠️  WARNING: EMAIL_USER should be your full email address (e.g., user@domain.com) for GoDaddy Titan Mail");
  }

  // Check if email credentials are configured
  if (!emailUser || !emailPass) {
    console.warn(
      "Email credentials not configured. Email sending will be disabled."
    );
    console.warn("Required: EMAIL_USER (or EMAIL_FROM) and EMAIL_PASS");
    return null;
  }

  try {
    // GoDaddy Titan Mail SMTP configuration
    // Try multiple ports and hosts for better compatibility with Render free tier
    const emailPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
    // GoDaddy SMTP servers (try these in order if one fails)
    const emailHost = process.env.EMAIL_HOST || "smtpout.secureserver.net";
    const isSecure = emailPort === 465;

    console.log(`📧 Configuring GoDaddy Titan Mail SMTP (${emailHost}:${emailPort})...`);

    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: isSecure, // true for 465, false for other ports
      requireTLS: !isSecure && emailPort === 587, // require TLS for port 587
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        // GoDaddy sometimes uses self-signed certificates
        rejectUnauthorized: false
      },
      // Timeout configurations - increased for GoDaddy
      connectionTimeout: 90000, // 90 seconds - GoDaddy can be slow
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 90000, // 90 seconds
      // Retry configuration
      pool: false, // Disable pooling for GoDaddy (can cause issues)
      maxConnections: 1,
      maxMessages: 1, // One message per connection for GoDaddy
      rateDelta: 2000, // 2 second window
      rateLimit: 3, // 3 messages per window
      // GoDaddy-specific options
      ignoreTLS: false,
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });

    // Verify connection on creation (but don't block - make it async)
    transporter.verify((error, success) => {
      if (error) {
        console.error("GoDaddy Titan Mail verification failed:", error.message);
        console.error("Full error details:", error);
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
          console.error("\n⚠️  GoDaddy Titan Mail connection issues:");
          console.error("   This is common on Render free tier due to firewall restrictions.");
          console.error("   Try these GoDaddy SMTP alternatives:");
          console.error("   1. smtpout.secureserver.net:587 (current)");
          console.error("   2. smtp.titan.email:587");
          console.error("   3. smtpout.secureserver.net:80");
          console.error("   4. smtpout.secureserver.net:3535");
          console.error("\n   Update environment variables:");
          console.error("   EMAIL_HOST=smtp.titan.email (or other server)");
          console.error("   EMAIL_PORT=587 (or 80, 3535, 465)");
        } else if (error.code === 'EAUTH') {
          console.error("\n⚠️  GoDaddy authentication failed:");
          console.error("   - Verify EMAIL_USER is your full email (user@domain.com)");
          console.error("   - Check EMAIL_PASS is correct");
          console.error("   - Ensure email account is active in GoDaddy");
        }
      } else {
        console.log("✓ GoDaddy Titan Mail transporter is ready to send messages");
      }
    });

    return transporter;
  } catch (error) {
    console.error("Failed to create email transporter:", error.message);
    console.error("Full error:", error);
    return null;
  }
};

// Create transporter lazily - only when needed, so env vars are fully loaded
let transporterInstance = null;
const getTransporter = () => {
  if (!transporterInstance) {
    console.log("📧 Creating email transporter (lazy initialization)...");
    transporterInstance = createTransporter();
    if (transporterInstance) {
      console.log("✓ Email transporter created successfully");
    } else {
      console.warn(
        "✗ Email transporter creation failed - email sending disabled"
      );
    }
  }
  return transporterInstance;
};

let resendClientInstance = null;
let resendInitAttempted = false;

const getResendClient = () => {
  if (resendInitAttempted) {
    return resendClientInstance;
  }

  resendInitAttempted = true;
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY not configured. Resend email service will be skipped."
    );
    return null;
  }

  try {
    resendClientInstance = new Resend(apiKey);
    console.log("✓ Resend email client initialized");
  } catch (error) {
    resendClientInstance = null;
    console.error("Failed to initialize Resend client:", error.message);
  }

  return resendClientInstance;
};

const getDefaultFromAddress = () => {
  const fromEnv = process.env.EMAIL_FROM?.trim();
  if (fromEnv) return fromEnv;
  const userEnv = process.env.EMAIL_USER?.trim();
  if (userEnv) return userEnv;
  return "Forex Flow <no-reply@forexflowtrade.com>";
};

const normalizeRecipients = (recipients) => {
  if (!recipients) return [];
  if (Array.isArray(recipients)) {
    return recipients.filter(Boolean);
  }
  return [recipients].filter(Boolean);
};

const sendEmail = async (mailOptions) => {
  const recipients = normalizeRecipients(mailOptions.to);

  if (!recipients.length) {
    throw new Error("Email recipient is required");
  }

  const senderAddress = mailOptions.from?.trim() || getDefaultFromAddress();
  if (!senderAddress) {
    throw new Error(
      "Email sender address is not configured. Set EMAIL_FROM or EMAIL_USER."
    );
  }

  const resendClient = getResendClient();

  if (resendClient) {
    try {
      const resendPayload = {
        from: senderAddress,
        to: recipients,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      };

      if (process.env.EMAIL_REPLY_TO) {
        resendPayload.reply_to = process.env.EMAIL_REPLY_TO;
      }

      const resendResponse = await resendClient.emails.send(resendPayload);
      console.log(
        `📨 Email sent via Resend (id: ${resendResponse.id || "n/a"})`
      );
      return { provider: "resend", id: resendResponse.id };
    } catch (error) {
      console.error("Resend email sending failed:", error?.message || error);
      if (error?.response?.error) {
        console.error("Resend API error details:", error.response.error);
      }
      console.warn("Falling back to GoDaddy SMTP transporter...");
    }
  } else {
    console.warn("Resend not configured. Using GoDaddy SMTP transporter...");
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      "Email service not configured. Set RESEND_API_KEY or GoDaddy SMTP credentials."
    );
  }

  const info = await transporter.sendMail({
    ...mailOptions,
    from: senderAddress,
    to: recipients.join(", "),
  });
  console.log(`📨 Email sent via SMTP (id: ${info.messageId})`);
  return { provider: "smtp", id: info.messageId };
};

const isConnectionError = (error) => {
  if (!error || !error.code) return false;
  return ["ETIMEDOUT", "ECONNRESET", "ESOCKET", "ECONNREFUSED"].includes(
    error.code
  );
};

// import jwt from "jsonwebtoken"
const test = (req, res) => {
  res.status(200).json({
    status: "success",
    message: "test success",
  });
};

const generateAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();

    await user.save({ validateBeforeSave: false });

    return { accessToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating the JWT tokens"
    );
  }
};

// Helper function to generate random alphanumeric password
const generateRandomPassword = (length = 12) => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Helper function to send email with retry logic (Resend first, SMTP fallback)
const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Attempting to send email (attempt ${attempt}/${maxRetries})...`
      );
      const info = await sendEmail(mailOptions);
      console.log(
        `Email sent successfully via ${info.provider} on attempt ${attempt}`
      );
      return info;
    } catch (error) {
      lastError = error;
      console.error(
        `Email send attempt ${attempt} failed:`,
        error?.message || error
      );
      const errorCode = error?.code || "N/A";
      console.error(`Error code: ${errorCode}`);

      if (attempt === maxRetries) {
        throw error;
      }

      const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      if (isConnectionError(error)) {
        console.log("SMTP connection issue detected, resetting transporter...");
        transporterInstance = null; // Force recreation on next attempt
      }
    }
  }

  throw lastError;
};

const register = async (req, res) => {
  console.log("Register controller called");
  console.log("Request body:", req.body);
  console.log("Request files:", req.files);

  try {
    // Password is no longer required - will be generated automatically
    const {
      email,
      firstName,
      lastName,
      phone,
      aadharNo,
      pan,
      gender,
      dob,
      nomineeName,
      nomineeRelation,
      nomineeDob,
      bankName,
      accountNumber,
      accountHolder,
      ifscCode,
      address,
    } = req.body;

    // Check if files are uploaded
    const files = req.files;
    console.log("Files received:", files);
    console.log("Files structure:", JSON.stringify(files, null, 2));

    // Validate files structure - files should be arrays with at least one element
    if (!files) {
      console.log("No files received in request");
      return res.status(400).json({
        status: "fail",
        message:
          "Please upload all required documents (Aadhar, PAN, and User photo)",
      });
    }

    const aadharPhoto = Array.isArray(files.aadharPhoto)
      ? files.aadharPhoto[0]
      : files.aadharPhoto;
    const panPhoto = Array.isArray(files.panPhoto)
      ? files.panPhoto[0]
      : files.panPhoto;
    const userPhoto = Array.isArray(files.userPhoto)
      ? files.userPhoto[0]
      : files.userPhoto;
    const passbookPhoto = Array.isArray(files.passbookPhoto)
      ? files.passbookPhoto[0]
      : files.passbookPhoto;

    if (!aadharPhoto || !panPhoto || !userPhoto || !passbookPhoto) {
      console.log("Missing files:", {
        hasFiles: !!files,
        hasAadhar: !!aadharPhoto,
        hasPan: !!panPhoto,
        hasUser: !!userPhoto,
        hasPassbook: !!passbookPhoto,
        fileKeys: files ? Object.keys(files) : [],
      });
      return res.status(400).json({
        status: "fail",
        message:
          "Please upload all required documents (Aadhar, PAN, User photo, and Passbook photo)",
      });
    }

    // Ensure files have path property (Cloudinary URL)
    if (
      !aadharPhoto.path ||
      !panPhoto.path ||
      !userPhoto.path ||
      !passbookPhoto.path
    ) {
      console.log("Files missing path property:", {
        aadharPath: !!aadharPhoto?.path,
        panPath: !!panPhoto?.path,
        userPath: !!userPhoto?.path,
        passbookPath: !!passbookPhoto?.path,
      });
      return res.status(400).json({
        status: "fail",
        message: "File upload failed. Please try again.",
      });
    }

    // Check if all required fields are present (password removed from required fields)
    if (
      !email ||
      !firstName ||
      !lastName ||
      !phone ||
      !aadharNo ||
      !pan ||
      !gender ||
      !dob ||
      !nomineeName ||
      !nomineeRelation ||
      !nomineeDob ||
      !bankName ||
      !accountNumber ||
      !accountHolder ||
      !ifscCode ||
      !address
    ) {
      console.log("Missing fields:", {
        email: !!email,
        firstName: !!firstName,
        lastName: !!lastName,
        phone: !!phone,
        aadharNo: !!aadharNo,
        pan: !!pan,
        gender: !!gender,
        dob: !!dob,
        nomineeName: !!nomineeName,
        nomineeRelation: !!nomineeRelation,
        nomineeDob: !!nomineeDob,
        bankName: !!bankName,
        accountNumber: !!accountNumber,
        accountHolder: !!accountHolder,
        ifscCode: !!ifscCode,
        address: !!address,
      });
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields",
      });
    }

    // Check if user already exists - optimized query with select only needed fields
    const userExists = await User.findOne({
      $or: [{ email }, { phone }, { pan }, { aadharNo }],
    })
      .select("_id")
      .lean(); // Use lean() for faster query and only select _id

    if (userExists) {
      return res.status(400).json({
        status: "fail",
        message:
          "User already exists with this email, phone, PAN, or Aadhar number",
      });
    }

    // Generate random alphanumeric password
    const generatedPassword = generateRandomPassword(12);

    // Use the normalized file references
    const aadharPhotoPath = aadharPhoto.path;
    const panPhotoPath = panPhoto.path;
    const userPhotoPath = userPhoto.path;
    const passbookPhotoPath = passbookPhoto.path;

    console.log("Creating new user with data:", {
      name: `${firstName} ${lastName}`,
      email,
      phone,
      aadharNo,
      pan,
      bankName,
      accountNumber,
      accountHolder,
      ifscCode,
      aadharPhoto: aadharPhotoPath,
      panPhoto: panPhotoPath,
      userPhoto: userPhotoPath,
      passbookPhoto: passbookPhotoPath,
    });

    // Create new user with generated password
    const newUser = new User({
      name: `${firstName} ${lastName}`,
      email,
      password: generatedPassword, // Auto-generated password
      generatedPassword,
      phone,
      aadharNo,
      pan,
      gender,
      dob,
      nomineeName,
      nomineeRelation,
      nomineeDob,
      bankName,
      accountNumber,
      accountHolder,
      ifscCode,
      address,
      // Add document URLs from Cloudinary
      aadharPhoto: aadharPhotoPath,
      panPhoto: panPhotoPath,
      userPhoto: userPhotoPath,
      passbookPhoto: passbookPhotoPath,
      isVerified: false, // User starts as unverified
    });

    // Save user first
    await newUser.save();
    console.log(
      "User saved successfully with generated password:",
      newUser._id
    );

    // Send email asynchronously (don't block registration if email fails)
    // Email 1: Sent when user registers - informs them they'll get password after verification
    // Note: This is completely non-blocking - response is sent immediately
    // Use setImmediate to ensure this runs after the response is sent
    setImmediate(async () => {
      try {
        await sendEmail({
          to: email,
          subject: "Profile Approval Request Submitted",
          text: `Dear ${firstName} ${lastName},\n\nYour profile approval request has been submitted successfully. Our admin team will review your profile and you will receive an email notification once your profile is approved or rejected.\n\nIMPORTANT: After verification, you will receive your login password via email to access and login to your account.\n\nThank you for registering with Forex Flow!`,
          html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #43B852;">Profile Approval Request Submitted</h2>
                        <p>Dear ${firstName} ${lastName},</p>
                        <p>Your profile approval request has been submitted successfully. Our admin team will review your profile and you will receive an email notification once your profile is approved or rejected.</p>
                        
                        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3;">
                            <h3 style="color: #0E1F1B; margin-top: 0;">📧 About Your Login Credentials</h3>
                            <p style="margin: 0;"><strong>After verification, you will receive your login password via email to access and login to your account.</strong></p>
                        </div>
                        
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="color: #0E1F1B; margin-top: 0;">What's Next?</h3>
                            <ul>
                                <li>Your profile is currently under review by our admin team</li>
                                <li>Once verified, you will receive an email with your login password</li>
                                <li>If your profile is rejected, you will receive a notification email with details</li>
                            </ul>
                        </div>
                        
                        <p><strong>Note:</strong> Please do not reply to this email. If you have any questions, please contact our support team.</p>
                        
                        <p>Thank you for registering with <strong>Forex Flow</strong>!</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                    `,
        });
        console.log("Approval request email sent successfully (async)");
      } catch (emailError) {
        console.error(
          "Email sending failed (but user was created):",
          emailError.message
        );
      }
    });

    // Return success immediately after user is saved (don't wait for email)
    console.log("Sending success response for user:", newUser._id);
    return res.status(201).json({
      status: "success",
      message:
        "Registration successful! Your profile approval request has been submitted. You will receive an email notification once your profile is reviewed by the admin.",
    });
  } catch (error) {
    console.error("Registration Error Details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: "fail",
        message: `A user with this ${field} already exists`,
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "fail",
        message: "Validation error",
        errors: messages,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Error in registration",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide email and password",
    });
  }
  try {
    const user = await User.findOne({ email });
    // console.log(`User from DB : ${req.userId}`)
    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid email",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password.trim(),
      user.password.trim()
    );
    console.log(
      `Old Password: ${user.password} New Password: ${password} Is Password Correct: ${isPasswordCorrect}`
    );
    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid password",
      });
    }

    const { accessToken } = await generateAccessToken(user._id);

    const isProd = process.env.NODE_ENV === "production";
    const options = {
      httpOnly: true,
      secure: isProd, // only secure in production (HTTPS)
      sameSite: isProd ? "none" : "lax",
    };

    if (user.isVerified === false) {
      return res.status(402).json({
        status: "fail",
        message: "Your are not Verified",
      });
    }

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .json({
        status: "success",
        message: "login success",
        data: {
          role: user.role,
          isVerified: user.isVerified,
          email: user.email,
        },
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: error.message,
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const isProd = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  };

  return res.status(200).clearCookie("accessToken", options).json({
    status: "success",
    message: "logout success",
  });
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide old password and new password",
    });
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({
      status: "fail",
      message: "Old password and new password cannot be same",
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "User not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid old password",
      });
    }

    //dont need to hash password again as it is already hashed in the model
    user.password = newPassword;
    await user.save();
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }

  res.status(200).json({
    status: "success",
    message: "change password success",
  });
};

/*
            totalDeposits,
            totalWithdrawals,
            recentTransactions,
            openPositions,
            closedPositions,
            approvedLoan,
            verifiedOrdersAmount
*/

const dashboard = async (req, res) => {
  const userId = req.user.id;
  // console.log(`User from DB : ${req.userId} User from JWT : ${userId}`)
  // if (!userId) {
  //     return res.status(400).json({
  //         status: "fail",
  //         message: "User not found"
  //     })
  // }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(400).json({
      status: "fail",
      message: "User not found",
    });
  }

  // console.log(`User from DB : ${user}`)

  res.status(200).json({
    status: "success",
    message: "dashboard success",
    user: user,
  });
};

//--------------settings---------------------------[Done]

// // this is for both profile and KYC Information
// const profile =  async (req, res) => {
//     const userId = req.user.id;

//     const user = await User.findById(userId).select('name email phone aadharNo pan');  //there is not username for this project

//     res.status(200).json({
//         status: "success",
//         message: "profile success",
//         user: user
//     })
// };

// const getBankDetails = async (req, res) => {
//     const userId = req.user.id;

//     const user = await User.findById(userId).select('bankName accountNumber accountHolder ifscCode');

//     if (!user) {
//         return res.status(404).json({
//             status: "fail",
//             message: "User not found"
//         });
//     }

//     res.status(200).json({
//         status: "success",
//         message: "Bank details retrieved successfully",
//         bankDetails: {
//             bankName: user.bankName,
//             accountNumber: user.accountNumber,
//             accountHolder: user.accountHolder,
//             ifscCode: user.ifscCode
//         }
//     });
// };

// GET /profile
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "name email phone aadharNo pan aadharPhoto panPhoto userPhoto passbookPhoto bankName accountNumber accountHolder ifscCode lastLogin role status"
    );

    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // Build response
    const response = {
      personal: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.email.split("@")[0] || "", // fallback
        role: user.role,
        status: user.status,
      },
      kyc: {
        aadharNumber: user.aadharNo,
        panNumber: user.pan,
        aadharPhoto: user.aadharPhoto,
        panPhoto: user.panPhoto,
        profilePhoto: user.userPhoto,
        passbookPhoto: user.passbookPhoto,
      },
      bank: {
        name: user.bankName,
        accountHolder: user.accountHolder,
        accountNumber: user.accountNumber,
        ifsc: user.ifscCode,
      },
      security: {
        lastLogin: user.lastLogin ? user.lastLogin.toLocaleString("en-IN") : "",
        // Add additional security fields as required
        twoFactorEnabled: !!user.twoFactorEnabled, // If you store this
        lastIp: req.ip || "", // Or use stored IP
      },
    };

    res
      .status(200)
      .json(new ApiResponse(200, response, "Profile retrieved successfully"));
  } catch (error) {
    next(
      new ApiError(
        500,
        "Internal server error while retrieving profile",
        error.message
      )
    );
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // const { userInfo } = req.body;
    // console.log("Update Profile Request Body:", req.body);
    const { personal, kyc, bank } = req.body;
    console.log("\n\n Personal Info:", personal);
    console.log("\n\n KYC Info:", kyc);
    console.log("\n\n Bank Info:", bank);
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json(new ApiResponse(404, null, "User not found"));

    // Update fields as needed (example)
    if (personal) {
      user.name = personal.name;
      user.email = personal.email;
      user.phone = personal.phone;
      user.username = personal.username || user.email.split("@")[0]; // Fallback to email prefix if username not provided
      // user.role = personal.role || user.role; // Allow role update if provided
      // user.status = personal.status || user.status; // Allow status update if provided
    }
    if (kyc) {
      user.aadharNo = kyc.aadharNumber;
      user.pan = kyc.panNumber;
      user.aadharPhoto = kyc.aadharPhoto;
      user.panPhoto = kyc.panPhoto;
      user.userPhoto = kyc.profilePhoto;
      if (kyc.passbookPhoto) user.passbookPhoto = kyc.passbookPhoto;
    }
    if (bank) {
      user.bankName = bank.name;
      user.accountHolder = bank.accountHolder;
      user.accountNumber = bank.accountNumber;
      user.ifscCode = bank.ifsc;
    }

    await user.save();
    res
      .status(200)
      .json(new ApiResponse(200, null, "Profile updated successfully"));
  } catch (error) {
    next(
      new ApiError(
        500,
        "Internal server error while updating profile",
        error.message
      )
    );
  }
};

const setting = async (req, res) => {
  res.status(200).json({
    status: "success",
    message: "settings success  need to ask what is this ",
  });
};

//TODO: Add forgot password and reset password functionality
//TODO: Add email verification functionality

//admin only--- below  one better-- commented out temporarily
// const getAllUsers = async (_req, res) => {
//     try {
//         const users = await User.find().select("name _id email ");

//         res.status(200).json({
//             status: "success",
//             message: "Users retrieved successfully",
//             data: users
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// };

// //admin only
// const deleteUserById = async (req, res) => {
//     const userId = req.params.id;
//     if(!userId) {
//         return res.status(400).json({
//             status: "fail",
//             message: "User ID is required"
//         });
//     }

//     try {

//         const user = await User.findByIdAndDelete(userId);
//         if (!user) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "User not found"
//             });
//         }
//         res.status(200).json({
//             status: "success",
//             message: "User deleted successfully"
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// };

const getAlluserKpis = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get active traders (users with transactions or login in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeTraders = await User.countDocuments({
      $or: [
        { lastLogin: { $gte: thirtyDaysAgo } },
        {
          _id: {
            $in: await Transaction.distinct("userId", {
              timestamp: { $gte: thirtyDaysAgo },
            }),
          },
        },
      ],
    });

    console.log(
      "This is admin dashboard __________________------------------:::::::::"
    );
    // Get pending withdrawals

    // Use correct type values for withdrawals and deposits
    const pendingWithdrawals = await Transaction.aggregate([
      {
        $match: {
          type: "WITHDRAWAL",
          status: "PENDING",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const pendingWithdrawalData = pendingWithdrawals[0] || {
      totalAmount: 0,
      count: 0,
    };

    // Get pending deposits
    const pendingDeposits = await Transaction.aggregate([
      {
        $match: {
          type: "DEPOSIT",
          status: "PENDING",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const pendingDepositData = pendingDeposits[0] || {
      totalAmount: 0,
      count: 0,
    };

    // Get recent withdrawal requests (last 10) with null check
    const recentWithdrawals = await Transaction.find({
      type: "WITHDRAWAL",
      status: { $in: ["PENDING", "COMPLETED", "CANCELLED", "FAILED"] },
    })
      .populate("userId", "name email phone")
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Get recent deposit requests (last 10) with null check
    const recentDeposits = await Transaction.find({
      type: "DEPOSIT",
      status: { $in: ["PENDING", "COMPLETED", "CANCELLED", "FAILED"] },
    })
      .populate("userId", "name email phone")
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Calculate trends (compare with previous month)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Previous period users (30-60 days ago)
    const previousPeriodUsers = await User.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });

    // Previous period active traders
    const previousActiveTraders = await User.countDocuments({
      $or: [
        { lastLogin: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } },
        {
          _id: {
            $in: await Transaction.distinct("userId", {
              timestamp: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
            }),
          },
        },
      ],
    });

    // Previous period pending withdrawals
    const previousPendingWithdrawals = await Transaction.aggregate([
      {
        $match: {
          type: "WITHDRAWAL",
          status: "PENDING",
          timestamp: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const previousWithdrawalData = previousPendingWithdrawals[0] || {
      totalAmount: 0,
    };

    // Previous period pending deposits
    const previousPendingDeposits = await Transaction.aggregate([
      {
        $match: {
          type: "DEPOSIT",
          status: "PENDING",
          timestamp: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const previousDepositData = previousPendingDeposits[0] || {
      totalAmount: 0,
    };

    // Calculate trend percentages
    const usersTrend =
      previousPeriodUsers > 0
        ? (
            ((totalUsers - previousPeriodUsers) / previousPeriodUsers) *
            100
          ).toFixed(1)
        : totalUsers > 0
          ? 100
          : 0;

    const tradersTrend =
      previousActiveTraders > 0
        ? (
            ((activeTraders - previousActiveTraders) / previousActiveTraders) *
            100
          ).toFixed(1)
        : activeTraders > 0
          ? 100
          : 0;

    const withdrawalTrend =
      previousWithdrawalData.totalAmount > 0
        ? (
            ((pendingWithdrawalData.totalAmount -
              previousWithdrawalData.totalAmount) /
              previousWithdrawalData.totalAmount) *
            100
          ).toFixed(1)
        : pendingWithdrawalData.totalAmount > 0
          ? 100
          : 0;

    const depositTrend =
      previousDepositData.totalAmount > 0
        ? (
            ((pendingDepositData.totalAmount -
              previousDepositData.totalAmount) /
              previousDepositData.totalAmount) *
            100
          ).toFixed(1)
        : pendingDepositData.totalAmount > 0
          ? 100
          : 0;

    // Helper function to get payment method display name
    const getPaymentMethodDisplay = (method) => {
      const methodMap = {
        CARD: "Credit Card",
        UPI: "UPI",
        NETBANKING: "Bank Transfer",
        WALLET: "Wallet",
        BITCOIN: "Bitcoin",
        ETHEREUM: "Ethereum",
        CRYPTO: "Cryptocurrency",
      };
      return methodMap[method?.toUpperCase()] || method || "Bank Transfer";
    };

    // Helper function to safely format date
    const safeFormatDate = (date) => {
      if (!date) return new Date().toISOString().split("T")[0];
      try {
        // Handle both timestamp and createdAt fields
        const dateObj = date instanceof Date ? date : new Date(date);
        return dateObj.toISOString().split("T")[0];
      } catch (error) {
        return new Date().toISOString().split("T")[0];
      }
    };

    // Format response data with safe date handling
    const kpiData = {
      mainStats: [
        {
          title: "Total Users",
          value: totalUsers.toLocaleString(),
          trend: {
            value: `${Math.abs(usersTrend)}%`,
            isUp: usersTrend >= 0,
          },
        },
        {
          title: "Active Traders",
          value: activeTraders.toLocaleString(),
          trend: {
            value: `${Math.abs(tradersTrend)}%`,
            isUp: tradersTrend >= 0,
          },
        },
        {
          title: "Pending Withdrawals",
          value: `$${pendingWithdrawalData.totalAmount.toLocaleString()}`,
          trend: {
            value: `${pendingWithdrawalData.count} requests`,
            isUp: withdrawalTrend >= 0,
          },
        },
        {
          title: "Pending Deposits",
          value: `$${pendingDepositData.totalAmount.toLocaleString()}`,
          trend: {
            value: `${pendingDepositData.count} requests`,
            isUp: depositTrend >= 0,
          },
        },
      ],
      recentWithdrawals: recentWithdrawals.map((withdrawal) => {
        // Map status to frontend-compatible values
        let status = withdrawal.status
          ? withdrawal.status.toLowerCase()
          : "unknown";
        if (status === "cancelled") status = "rejected";
        if (status === "failed") status = "rejected";

        return {
          id: withdrawal._id,
          userId: withdrawal.userId?._id || withdrawal.userId, // Include userId for fetching details
          user: withdrawal.userId?.name || "Unknown User",
          userEmail: withdrawal.userId?.email,
          userPhone: withdrawal.userId?.phone,
          amount: `$${(withdrawal.amount || 0).toLocaleString()}`,
          date: safeFormatDate(withdrawal.timestamp || withdrawal.createdAt),
          status: status,
          rawAmount: withdrawal.amount || 0,
          rawDate: withdrawal.timestamp || withdrawal.createdAt || new Date(),
          paymentMethod: getPaymentMethodDisplay(withdrawal.paymentMethod),
          transactionId: withdrawal.transactionId || withdrawal._id,
        };
      }),
      recentDeposits: recentDeposits.map((deposit) => {
        // Map status to frontend-compatible values
        let status = deposit.status ? deposit.status.toLowerCase() : "unknown";
        if (status === "cancelled") status = "rejected";
        if (status === "failed") status = "rejected";

        return {
          id: deposit._id,
          userId: deposit.userId?._id || deposit.userId, // Include userId for fetching details
          user: deposit.userId?.name || "Unknown User",
          userEmail: deposit.userId?.email,
          userPhone: deposit.userId?.phone,
          amount: `$${(deposit.amount || 0).toLocaleString()}`,
          method: getPaymentMethodDisplay(deposit.paymentMethod),
          date: safeFormatDate(deposit.timestamp || deposit.createdAt),
          status: status,
          rawAmount: deposit.amount || 0,
          rawDate: deposit.timestamp || deposit.createdAt || new Date(),
          transactionId: deposit.transactionId || deposit._id,
        };
      }),
    };

    res.status(200).json({
      status: "success",
      message: "KPI data retrieved successfully",
      data: kpiData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching KPI data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve KPI data",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Additional controller functions for handling approve/reject actions
const approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({
        status: "error",
        message: "Withdrawal ID is required",
      });
    }

    const withdrawal = await Transaction.findByIdAndUpdate(
      withdrawalId,
      {
        status: "COMPLETED",
        approvedBy: req.user._id,
        approvedAt: new Date(),
      },
      { new: true }
    ).populate("userId", "name email");

    if (!withdrawal) {
      return res.status(404).json({
        status: "error",
        message: "Withdrawal request not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Withdrawal request approved successfully",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to approve withdrawal request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, reason } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({
        status: "error",
        message: "Withdrawal ID is required",
      });
    }

    const withdrawal = await Transaction.findByIdAndUpdate(
      withdrawalId,
      {
        status: "CANCELLED",
        rejectedBy: req.user._id,
        rejectedAt: new Date(),
        rejectionReason: reason || "Request rejected by admin",
      },
      { new: true }
    ).populate("userId", "name email");

    if (!withdrawal) {
      return res.status(404).json({
        status: "error",
        message: "Withdrawal request not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Withdrawal request rejected successfully",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to reject withdrawal request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, reason } = req.body;

    // Validate status
    const validStatuses = [
      "PENDING",
      "COMPLETED",
      "REJECTED",
      "FAILED",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status provided",
      });
    }

    // Find and update transaction
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        status,
        updatedAt: new Date(),
        ...(reason && { reason }),
      },
      { new: true }
    ).populate("userId", "name email phone");

    if (!transaction) {
      return res.status(404).json({
        status: "error",
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: `Transaction ${status.toLowerCase()} successfully`,
      data: transaction,
    });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update transaction status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const approveDeposit = async (req, res) => {
  try {
    const { depositId } = req.body;

    if (!depositId) {
      return res.status(400).json({
        status: "error",
        message: "Deposit ID is required",
      });
    }

    const deposit = await Transaction.findByIdAndUpdate(
      depositId,
      {
        status: "COMPLETED",
        approvedBy: req.user._id,
        approvedAt: new Date(),
      },
      { new: true }
    ).populate("userId", "name email");

    if (!deposit) {
      return res.status(404).json({
        status: "error",
        message: "Deposit request not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Deposit request approved successfully",
      data: deposit,
    });
  } catch (error) {
    console.error("Error approving deposit:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to approve deposit request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const rejectDeposit = async (req, res) => {
  try {
    const { depositId, reason } = req.body;

    if (!depositId) {
      return res.status(400).json({
        status: "error",
        message: "Deposit ID is required",
      });
    }

    const deposit = await Transaction.findByIdAndUpdate(
      depositId,
      {
        status: "FAILED",
        rejectedBy: req.user._id,
        rejectedAt: new Date(),
        rejectionReason: reason || "Request rejected by admin",
      },
      { new: true }
    ).populate("userId", "name email");

    if (!deposit) {
      return res.status(404).json({
        status: "error",
        message: "Deposit request not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Deposit request rejected successfully",
      data: deposit,
    });
  } catch (error) {
    console.error("Error rejecting deposit:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to reject deposit request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// const userapprove = async (req, res) => {
//     const userId  = req.params.id;
//     try {
//         const user = await User.findById(userId);
//         if(!user) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "User not found"
//             });
//         }
//         user.isVerified = true;
//         await user.save();

//         res.status(200).json({
//             status: "success",
//             message: "User approved successfully"
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// }

// const userreject = async (req, res) => {
//     const userId  = req.params.id;
//     try {
//         const user = await User.findById(userId);
//         if(!user) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "User not found"
//             });
//         }
//         user.isVerified = false;
//         await user.save();

//         res.status(200).json({
//             status: "success",
//             message: "User rejected successfully"
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// }

// const getUserbyId = async (req, res) => {
//     const userId  = req.params.id;
//     try {
//         const user = await User.findById(userId).select('name email phone aadharNo pan bankName accountNumber accountHolder ifscCode isVerified');
//         if(!user) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "User not found"
//             });
//         }

//         res.status(200).json({
//             status: "success",
//             message: "User retrieved successfully",
//             data: user
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// }

const userapprove = async (req, res) => {
  // Get userId from params, body, or query (flexible approach)
  const userId = req.params.id || req.body.userId || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      status: "fail",
      message: "User ID is required",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Generate a new password for the user when approved
    // This password will be sent to the user via email
    const newPassword = generateRandomPassword(12);

    // Try to send approval email first (blocking - must succeed before approving)
    // Uses retry logic for better reliability
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: user.email,
        subject: "Profile Approved - Your Login Credentials",
        text: `Dear ${user.name},\n\nCongratulations! Your profile has been approved by our admin team.\n\nYour login credentials are:\nEmail: ${user.email}\nPassword: ${newPassword}\n\nPlease keep your password safe and secure. You can now log in to your account.\n\nThank you for choosing Forex Flow!`,
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #43B852;">Profile Approved!</h2>
                        <p>Dear ${user.name},</p>
                        <p>Congratulations! Your profile has been approved by our admin team.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #43B852;">
                            <h3 style="color: #0E1F1B; margin-top: 0;">Your Login Credentials</h3>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Password:</strong> <code style="background-color: #fff; padding: 5px 10px; border-radius: 3px; font-size: 16px; letter-spacing: 2px;">${newPassword}</code></p>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <p style="margin: 0;"><strong>⚠️ Important:</strong> Please keep your password safe and secure. Do not share it with anyone.</p>
                        </div>
                        
                        <p>You can now log in to your account using the credentials above.</p>
                        
                        <p>Thank you for choosing <strong>Forex Flow</strong>!</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                    `,
      };
      
      const emailInfo = await sendEmailWithRetry(mailOptions, 3);

      console.log(
        "Approval email with credentials sent successfully:",
        emailInfo.id || "n/a"
      );

      // Only update user status if email was sent successfully
      user.password = newPassword;
      user.generatedPassword = newPassword;
      user.isVerified = true;
      await user.save();

      res.status(200).json({
        status: "success",
        message: "User approved successfully. Login credentials have been sent to the user's email.",
        data: {
          userId: user._id,
          isVerified: user.isVerified,
          emailSent: true,
        },
      });
    } catch (emailError) {
      console.error("Email sending failed. User approval cancelled:", emailError.message);
      console.error("Full email error:", emailError);
      
      // Don't update user status - keep them in pending
      return res.status(500).json({
        status: "error",
        message: "Failed to send approval email. User status remains pending. Please check email configuration and try again.",
        error: emailError.message,
        data: {
          userId: user._id,
          isVerified: user.isVerified, // Still false/pending
          emailSent: false,
        },
      });
    }
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const userreject = async (req, res) => {
  // Get userId from params, body, or query (flexible approach)
  const userId = req.params.id || req.body.userId || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      status: "fail",
      message: "User ID is required",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Try to send rejection email first (blocking - must succeed before rejecting)
    // Uses retry logic for better reliability
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: user.email,
        subject: "Profile Verification Rejected",
        text: `Dear ${user.name},\n\nWe regret to inform you that your profile verification request has been rejected by our admin team.\n\nIf you believe this is an error or would like to resubmit your profile, please contact our support team for assistance.\n\nThank you for your interest in Forex Flow.`,
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc3545;">Profile Verification Rejected</h2>
                        <p>Dear ${user.name},</p>
                        <p>We regret to inform you that your profile verification request has been rejected by our admin team.</p>
                        
                        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <p style="margin: 0; color: #721c24;"><strong>What does this mean?</strong></p>
                            <p style="margin: 10px 0 0 0; color: #721c24;">Your profile did not meet our verification requirements. This could be due to incomplete information, document issues, or other verification criteria.</p>
                        </div>
                        
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="color: #0E1F1B; margin-top: 0;">What can you do?</h3>
                            <ul>
                                <li>Review your submitted information and documents</li>
                                <li>Contact our support team if you believe this is an error</li>
                                <li>You may resubmit your profile after addressing any issues</li>
                            </ul>
                        </div>
                        
                        <p>If you have any questions or need assistance, please contact our support team.</p>
                        
                        <p>Thank you for your interest in <strong>Forex Flow</strong>.</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                    `,
      };
      
      const emailInfo = await sendEmailWithRetry(mailOptions, 3);

      console.log("Rejection email sent successfully via:", emailInfo.provider);

      // Only update user status if email was sent successfully
      user.isVerified = false;
      await user.save();

      res.status(200).json({
        status: "success",
        message: "User rejected successfully. Rejection notification has been sent to the user's email.",
        data: {
          userId: user._id,
          isVerified: user.isVerified,
          emailSent: true,
        },
      });
    } catch (emailError) {
      console.error("Email sending failed. User rejection cancelled:", emailError.message);
      console.error("Full email error:", emailError);
      
      // Don't update user status - keep them in pending
      return res.status(500).json({
        status: "error",
        message: "Failed to send rejection email. User status remains pending. Please check email configuration and try again.",
        error: emailError.message,
        data: {
          userId: user._id,
          isVerified: user.isVerified, // Still in pending state
          emailSent: false,
        },
      });
    }
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getUserbyId = async (req, res) => {
  try {
    // Get userId from params, body, or query (flexible approach)
    // Add defensive checks to prevent undefined errors
    const userId = req.params?.id || req.body?.userId || req.query?.userId;

    if (!userId) {
      return res.status(400).json({
        status: "fail",
        message: "User ID is required",
      });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(userId).select(
      "name email phone aadharNo pan bankName accountNumber accountHolder ifscCode isVerified createdAt updatedAt aadharPhoto panPhoto userPhoto passbookPhoto generatedPassword"
    );
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Get user balance information
    let balanceInfo = {
      accountBalance: 0,
      totalDeposit: 0,
      totalWithdrawals: 0,
      orderInvestment: 0,
      profitLoss: 0,
    };

    try {
      // Convert userId to ObjectId
      const userIdObjectId = new mongoose.Types.ObjectId(userId);

      // Calculate balance directly using Transaction model (more reliable than static method)
      const balanceData = await Transaction.aggregate([
        { $match: { userId: userIdObjectId } },
        {
          $group: {
            _id: null,
            totalDeposits: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "DEPOSIT"] },
                      { $eq: ["$status", "COMPLETED"] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "WITHDRAWAL"] },
                      { $eq: ["$status", "COMPLETED"] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]);

      if (balanceData && balanceData.length > 0) {
        const data = balanceData[0];
        balanceInfo.totalDeposit = data.totalDeposits || 0;
        balanceInfo.totalWithdrawals = data.totalWithdrawals || 0;
        balanceInfo.accountBalance =
          (data.totalDeposits || 0) - (data.totalWithdrawals || 0);
      }

      // Get order investment and profit/loss from OrderHistory
      const orderStats = await OrderHistory.aggregate([
        { $match: { userId: userIdObjectId } },
        {
          $group: {
            _id: null,
            totalInvestment: {
              $sum: {
                $ifNull: ["$tradeAmount", 0],
              },
            },
            totalProfitLoss: {
              $sum: {
                $ifNull: ["$profitLoss", 0],
              },
            },
          },
        },
      ]);

      if (orderStats && orderStats.length > 0) {
        balanceInfo.orderInvestment = orderStats[0].totalInvestment || 0;
        balanceInfo.profitLoss = orderStats[0].totalProfitLoss || 0;
      }
    } catch (balanceError) {
      console.error("Error fetching balance info:", balanceError);
      console.error("Balance error stack:", balanceError.stack);
      // Continue without balance info if it fails - return default values
    }

    res.status(200).json({
      status: "success",
      message: "User retrieved successfully",
      data: {
        ...user.toObject(),
        balanceInfo,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    // You can add pagination, filtering, and sorting here
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select(
        "name email phone aadharNo pan bankName accountNumber accountHolder ifscCode isVerified createdAt updatedAt generatedPassword"
      )
      .sort({ createdAt: -1 }) // Latest users first
      .skip(skip)
      .limit(limit);

    // Get last transaction for each user
    const userIds = users.map((user) => user._id);
    const lastTransactions = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: "$userId",
          lastTransaction: { $first: "$timestamp" },
        },
      },
    ]);

    // Create a map of userId to lastTransaction
    const lastTransactionMap = {};
    lastTransactions.forEach((item) => {
      lastTransactionMap[item._id.toString()] = item.lastTransaction;
    });

    // Add lastTransaction to each user
    const usersWithLastTransaction = users.map((user) => {
      const userObj = user.toObject();
      const lastTrans = lastTransactionMap[user._id.toString()];
      userObj.lastTransaction = lastTrans
        ? new Date(lastTrans).toLocaleDateString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : "N/A";
      return userObj;
    });

    const totalUsers = await User.countDocuments();

    res.status(200).json({
      status: "success",
      message: "Users retrieved successfully",
      data: usersWithLastTransaction,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteUserById = async (req, res) => {
  // Get userId from params, body, or query (flexible approach)
  const userId = req.params.id || req.body.userId || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      status: "fail",
      message: "User ID is required",
    });
  }

  try {
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid user ID format",
      });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

// // You'll also need to implement getAlluserKpis function
// const getAlluserKpis = async (req, res) => {
//     try {
//         const totalUsers = await User.countDocuments();
//         const verifiedUsers = await User.countDocuments({ isVerified: true });
//         const unverifiedUsers = await User.countDocuments({ isVerified: false });

//         // Calculate new users (last 30 days)
//         const thirtyDaysAgo = new Date();
//         thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
//         const newUsers = await User.countDocuments({
//             createdAt: { $gte: thirtyDaysAgo }
//         });

//         res.status(200).json({
//             status: "success",
//             data: {
//                 totalUsers,
//                 activeUsers: verifiedUsers,
//                 suspendedUsers: unverifiedUsers,
//                 newUsers
//             }
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: "error",
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// }

const getKYCInfo = async (req, res) => {
  res.status(200).json({
    status: "success",
    message: "KYC info is provided to you shortly.",
  });
};

const getLastLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("lastLogin");
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          200,
          user.lastLogin ? user.lastLogin.toISOString() : null,
          "Last login retrieved successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Internal server error while retrieving last login",
      error.message
    );
  }
};

const getOrderHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status } = req.query; // Add filter support

    // Build filter query
    let filterQuery = { userId };
    if (status && status !== "All") {
      filterQuery.status = status.toUpperCase();
    }

    // Fetch order history from OrderHistory collection
    const orderHistory = await OrderHistory.find(filterQuery).sort({
      tradeDate: -1,
    });

    // Calculate summary data
    const summaryData = await calculateSummaryData(userId);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          trades: orderHistory,
          summary: summaryData,
        },
        "Order history retrieved successfully"
      )
    );
  } catch (error) {
    throw new ApiError(
      500,
      "Internal server error while retrieving order history",
      error.message
    );
  }
};

// Helper function to calculate summary data
const calculateSummaryData = async (userId) => {
  const trades = await OrderHistory.find({ userId });

  const totalTrades = trades.length;
  const totalInvestment = trades.reduce(
    (sum, trade) => sum + trade.tradeAmount,
    0
  );
  const totalProfitLoss = trades.reduce(
    (sum, trade) => sum + (trade.profitLoss || 0),
    0
  );

  // You can add logic here to calculate changes from last week
  // For now, returning basic calculations

  return [
    {
      title: "Total Trades",
      value: totalTrades.toString(),
      change: "+5 from last week", // You can calculate this dynamically
    },
    {
      title: "Total Investment",
      value: `$${totalInvestment.toLocaleString()}`,
      change: "+$1,200 from last week", // You can calculate this dynamically
    },
    {
      title: "Net Profit/Loss",
      value:
        totalProfitLoss >= 0
          ? `+$${totalProfitLoss.toLocaleString()}`
          : `-$${Math.abs(totalProfitLoss).toLocaleString()}`,
      change: "+$320 from last week", // You can calculate this dynamically
    },
  ];
};

const getPersonalInfo = async (req, res) => {
  //need to fix this
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }
    const personalInfo = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      aadharNo: user.aadharNo,
      pan: user.pan,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          personalInfo,
          "Personal information retrieved successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Internal server error while retrieving personal information",
      error.message
    );
  }
};

const getTradeHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const transactions = await Transaction.find({ userId }).sort({
      timestamp: -1,
    }); // Most recent first

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          "Trade history retrieved successfully"
        )
      );
  } catch (error) {
    return next(
      new ApiError(
        500,
        "Internal server error while retrieving trade history",
        error.message
      )
    );
  }
};

export {
  test,
  register,
  logout,
  changePassword,
  dashboard,
  login,
  // getBankDetails,
  setting,
  // profile,
  //profile
  getProfile,
  updateProfile,
  getLastLogin,
  getKYCInfo,
  getOrderHistory,
  getPersonalInfo,
  // getProfile,
  getTradeHistory,

  //-----for admin only-------
  getAlluserKpis,
  updateTransactionStatus,
  getUserbyId,
  userapprove,
  userreject,
  approveWithdrawal,
  rejectWithdrawal,
  approveDeposit,
  rejectDeposit,
  getAllUsers,
  deleteUserById,
};