const { db } = require('../db/dbConfig');

const createRefreshToken = async (userId, role, token, expiresAt) => {
    try {
        return await db.one(
            `INSERT INTO refresh_tokens (user_id, role, token, expires_at)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, role, token, expiresAt]
        );
    } catch (error) {
        throw new Error(`Error creating refresh token: ${error.message}`);
    }
};

const getAndDeleteRefreshToken = async (token) => {
    try {
        return await db.oneOrNone(
            `DELETE FROM refresh_tokens WHERE token = $1 RETURNING *`,
            [token]
        );
    } catch (error) {
        throw new Error(`Error consuming refresh token: ${error.message}`);
    }
};

const deleteRefreshToken = async (token) => {
    try {
        return await db.result(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [token]
        );
    } catch (error) {
        throw new Error(`Error deleting refresh token: ${error.message}`);
    }
};

const deleteAllUserRefreshTokens = async (userId) => {
    try {
        return await db.result(
            `DELETE FROM refresh_tokens WHERE user_id = $1`,
            [userId]
        );
    } catch (error) {
        throw new Error(`Error deleting user refresh tokens: ${error.message}`);
    }
};

const deleteExpiredTokens = async () => {
    try {
        return await db.result(
            `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
        );
    } catch (error) {
        console.error('Error cleaning expired tokens:', error.message);
    }
};

module.exports = {
    createRefreshToken,
    getAndDeleteRefreshToken,
    deleteRefreshToken,
    deleteAllUserRefreshTokens,
    deleteExpiredTokens
};
