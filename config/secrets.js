require('dotenv').config();

// Loads sensitive values once at startup, freezes them.
// Accessor functions prevent accidental serialization (JSON.stringify, console.log).
// getSecretPatterns() provides regex-escaped values for output scanning.

const secrets = Object.freeze({
    jwtSecret: process.env.JWT_SECRET,
    geminiApiKey: process.env.GEMINI_API_KEY,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    pgPassword: process.env.PG_PASSWORD,
    adminPassword: process.env.ADMIN_PASSWORD
});

module.exports.getJwtSecret = () => secrets.jwtSecret;
module.exports.getGeminiApiKey = () => secrets.geminiApiKey;
module.exports.getCloudinaryCloudName = () => secrets.cloudinaryCloudName;
module.exports.getCloudinaryApiKey = () => secrets.cloudinaryApiKey;
module.exports.getCloudinaryApiSecret = () => secrets.cloudinaryApiSecret;
module.exports.getPgPassword = () => secrets.pgPassword;
module.exports.getAdminPassword = () => secrets.adminPassword;

// Returns regex-escaped patterns for all loaded secret values.
// Used by the output scanner to detect if the LLM echoed a real secret.
module.exports.getSecretPatterns = () => {
    return Object.values(secrets)
        .filter(v => v && v.length >= 6)
        .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
};
