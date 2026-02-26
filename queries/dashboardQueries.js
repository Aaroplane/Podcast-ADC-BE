const { db } = require('../db/dbConfig');

const getUserProfile = async (userId) => {
    try {
        return await db.oneOrNone(
            `SELECT
                first_name, last_name, username, email, created_at,
                EXTRACT(DAY FROM NOW() - created_at)::int AS account_age_days
             FROM users WHERE id = $1`,
            [userId]
        );
    } catch (error) {
        throw new Error(`Error fetching user profile: ${error.message}`);
    }
};

const getDashboardStats = async (userId) => {
    try {
        return await db.one(
            `SELECT
                COUNT(*)::int AS total_entries,
                COUNT(CASE WHEN script_content IS NOT NULL THEN 1 END)::int AS entries_with_scripts,
                COUNT(CASE WHEN audio_url IS NOT NULL
                    AND audio_url NOT LIKE 'https://example.com/%'
                    AND audio_url NOT LIKE 'http://example.com/%'
                    AND audio_url NOT LIKE 'placeholder%'
                    THEN 1 END)::int AS entries_with_audio
             FROM podcast_entries WHERE user_id = $1`,
            [userId]
        );
    } catch (error) {
        throw new Error(`Error fetching dashboard stats: ${error.message}`);
    }
};

const getRecentEntries = async (userId, limit = 5) => {
    try {
        return await db.any(
            `SELECT id, title, description, audio_url, script_content, created_at, updated_at
             FROM podcast_entries
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [userId, limit]
        );
    } catch (error) {
        throw new Error(`Error fetching recent entries: ${error.message}`);
    }
};

const getEntriesByMonth = async (userId) => {
    try {
        return await db.any(
            `SELECT
                to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                COUNT(*)::int AS count
             FROM podcast_entries
             WHERE user_id = $1
             GROUP BY date_trunc('month', created_at)
             ORDER BY date_trunc('month', created_at) DESC`,
            [userId]
        );
    } catch (error) {
        throw new Error(`Error fetching entries by month: ${error.message}`);
    }
};

const getTotalScriptWordCount = async (userId) => {
    try {
        const result = await db.oneOrNone(
            `SELECT COALESCE(SUM(
                array_length(
                    regexp_split_to_array(
                        CONCAT_WS(' ',
                            script_content->>'introduction',
                            script_content->>'mainContent',
                            script_content->>'conclusion'
                        ), '\\s+'
                    ), 1
                )
             ), 0)::int AS total_word_count
             FROM podcast_entries
             WHERE user_id = $1 AND script_content IS NOT NULL`,
            [userId]
        );
        return result ? result.total_word_count : 0;
    } catch (error) {
        throw new Error(`Error fetching word count: ${error.message}`);
    }
};

const getPaginatedEntries = async (userId, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    try {
        const [entries, countResult] = await Promise.all([
            db.any(
                `SELECT id, title, description, audio_url, script_content, created_at, updated_at
                 FROM podcast_entries
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            ),
            db.one(
                `SELECT COUNT(*)::int AS total FROM podcast_entries WHERE user_id = $1`,
                [userId]
            )
        ]);

        const total = countResult.total;
        return {
            entries,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        throw new Error(`Error fetching paginated entries: ${error.message}`);
    }
};

module.exports = {
    getUserProfile,
    getDashboardStats,
    getRecentEntries,
    getEntriesByMonth,
    getTotalScriptWordCount,
    getPaginatedEntries
};
