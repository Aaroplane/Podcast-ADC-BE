const express = require('express');
const authController = express.Router();
const { generateAccessToken, generateRefreshToken } = require('../validations/tokenUtils');
const { getAndDeleteRefreshToken, deleteRefreshToken } = require('../queries/refreshTokenQueries');
const { validate, refreshTokenSchema } = require('../validations/schemas');
const { refreshLimiter } = require('../validations/rateLimiter');

// POST /auth/refresh — rotate refresh token pair
authController.post('/refresh', refreshLimiter, validate(refreshTokenSchema), async (req, res) => {
    const { refreshToken } = req.body;

    try {
        // Atomic delete-and-return prevents race conditions
        const storedToken = await getAndDeleteRefreshToken(refreshToken);

        if (!storedToken) {
            return res.status(401).json({ error: "Invalid or expired refresh token" });
        }

        // Check expiration
        if (new Date(storedToken.expires_at) < new Date()) {
            return res.status(401).json({ error: "Refresh token has expired" });
        }

        // Issue new token pair
        const newAccessToken = generateAccessToken({ id: storedToken.user_id, role: storedToken.role });
        const newRefreshToken = await generateRefreshToken(storedToken.user_id, storedToken.role);

        res.status(200).json({
            message: "Token refreshed successfully",
            token: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error("Token refresh error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /auth/logout — invalidate refresh token
authController.post('/logout', validate(refreshTokenSchema), async (req, res) => {
    const { refreshToken } = req.body;

    try {
        await deleteRefreshToken(refreshToken);
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = authController;
