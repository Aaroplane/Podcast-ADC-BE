const cloudinary = require('cloudinary').v2;
const { getCloudinaryCloudName, getCloudinaryApiKey, getCloudinaryApiSecret } = require('../config/secrets');

cloudinary.config({
    cloud_name: getCloudinaryCloudName(),
    api_key: getCloudinaryApiKey(),
    api_secret: getCloudinaryApiSecret()
});

async function uploadAudio(audioBuffer, options = {}) {
    const { folder = 'chitchat-podcasts', publicId } = options;

    return new Promise((resolve, reject) => {
        const uploadOptions = {
            resource_type: 'video', // Cloudinary uses 'video' for audio files
            folder,
            format: 'mp3'
        };

        if (publicId) {
            uploadOptions.public_id = publicId;
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                }
                resolve({
                    secure_url: result.secure_url,
                    public_id: result.public_id
                });
            }
        );

        uploadStream.end(audioBuffer);
    });
}

async function deleteAudio(publicId) {
    try {
        return await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    } catch (error) {
        throw new Error(`Cloudinary delete failed: ${error.message}`);
    }
}

function isConfigured() {
    return !!(
        getCloudinaryCloudName() &&
        getCloudinaryApiKey() &&
        getCloudinaryApiSecret()
    );
}

module.exports = {
    uploadAudio,
    deleteAudio,
    isConfigured
};
