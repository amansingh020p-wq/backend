import rateLimit from "express-rate-limit";

// Brute force protection for login endpoints
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 login attempts per IP per 15 mins
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
        console.warn(`[SECURITY] Too many login attempts from IP: ${req.ip} at ${new Date().toISOString()}`);
        res.status(429).json({
            status: "error",
            message: "Too many login attempts. Please try again after 15 minutes.",
        });
    },
});

// Admin-specific rate limiter (stricter limits for security)
export const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Max 50 requests per IP per 15 mins for admin routes
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many admin requests. Please try again later.",
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        console.warn(`[SECURITY] Admin rate limit exceeded for IP: ${req.ip} at ${new Date().toISOString()}`);
        res.status(429).json({
            status: "error",
            message: "Too many admin requests. Please try again later.",
        });
    },
});
