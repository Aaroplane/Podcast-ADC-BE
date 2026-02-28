const { db } = require('../db/dbConfig');

const getAllEntries = async (user_id) => {
    try {
        return await db.any("SELECT * FROM podcast_entries WHERE user_id = $1", [user_id]);
    } catch (error) {
        throw new Error(`Error fetching entries: ${error.message}`);
    }
};

const getSpecificEntry = async (id, user_id) => {
    try {
        return await db.one("SELECT * FROM podcast_entries WHERE user_id = $1 AND id = $2", [user_id, id]);
    } catch (error) {
        throw new Error(`Error fetching entry: ${error.message}`);
    }
};

const createEntry = async (user_id, podcastData) => {
    try {
        return await db.one(
            `INSERT INTO podcast_entries (
                title, 
                description, 
                audio_url, 
                user_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [
                podcastData.title, 
                podcastData.description, 
                podcastData.audio_url, 
                user_id
            ]
        );
    } catch (error) {
        throw new Error(`Error creating entry: ${error.message}`);
    }
};

const updateEntry = async (id, user_id, podcastData) => {
    try {
        return await db.one(
            `UPDATE podcast_entries
             SET 
             title = $1, 
             description = $2, 
             audio_url = $3, 
             updated_at = NOW()
             WHERE id = $4 AND user_id = $5
             RETURNING *`,
            [
                podcastData.title, 
                podcastData.description, 
                podcastData.audio_url, 
                id, 
                user_id
            ]
        );
    } catch (error) {
        throw new Error(`Error updating entry: ${error.message}`);
    }
};

const deleteEntry = async (id, user_id) => {
    try {
        return await db.one("DELETE FROM podcast_entries WHERE id = $1 AND user_id = $2 RETURNING *", [id, user_id]);
    } catch (error) {
        throw new Error(`Error deleting entry: ${error.message}`);
    }
};

const saveScript = async (id, user_id, scriptContent) => {
    try {
        return await db.one(
            `UPDATE podcast_entries
             SET script_content = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [JSON.stringify(scriptContent), id, user_id]
        );
    } catch (error) {
        throw new Error(`Error saving script: ${error.message}`);
    }
};

const getScript = async (id, user_id) => {
    try {
        return await db.oneOrNone(
            "SELECT id, script_content FROM podcast_entries WHERE id = $1 AND user_id = $2",
            [id, user_id]
        );
    } catch (error) {
        throw new Error(`Error fetching script: ${error.message}`);
    }
};

const updateAudioUrl = async (id, user_id, audioUrl) => {
    try {
        return await db.one(
            `UPDATE podcast_entries
             SET audio_url = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [audioUrl, id, user_id]
        );
    } catch (error) {
        throw new Error(`Error updating audio URL: ${error.message}`);
    }
};

module.exports = {
    getAllEntries,
    getSpecificEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    saveScript,
    getScript,
    updateAudioUrl
};
