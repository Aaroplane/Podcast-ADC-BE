const rateLimit = require('express-rate-limit');

// Strict limit for login attempts — prevents brute force
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 attempts per window
    message: { error: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
});

// Moderate limit for account creation — prevents signup spam
const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,                    // 5 accounts per hour per IP
    message: { error: "Too many accounts created. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

// General API limiter — prevents abuse of authenticated endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'test' ? 1000 : 100, // 100 in prod, 1000 in test
    message: { error: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false
});

// Tight limit for AI generation endpoints — these cost money / resources
const generationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'test' ? 200 : 20, // 20 in prod, 200 in test
    message: { error: "Generation limit reached. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

// Moderate limit for token refresh — prevents abuse of rotation
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,                   // 30 refresh attempts per window
    message: { error: "Too many refresh attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    loginLimiter,
    signupLimiter,
    apiLimiter,
    generationLimiter,
    refreshLimiter
};
