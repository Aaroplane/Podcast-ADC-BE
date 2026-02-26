const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createRefreshToken, deleteExpiredTokens } = require('../queries/refreshTokenQueries');
const { getJwtSecret } = require('../config/secrets');

function generateAccessToken({ id, role }) {
    return jwt.sign(
        { id, role },
        getJwtSecret(),
        { expiresIn: '30m' }
    );
}

async function generateRefreshToken(userId, role) {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await createRefreshToken(userId, role, token, expiresAt);

    // Opportunistic cleanup of expired tokens
    deleteExpiredTokens().catch(() => {});

    return token;
}

module.exports = {
    generateAccessToken,
    generateRefreshToken
};
