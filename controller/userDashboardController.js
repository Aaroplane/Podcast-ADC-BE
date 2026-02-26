const express = require('express');
const userDashboard = express.Router({ mergeParams: true });
const {
    getUserProfile,
    getDashboardStats,
    getRecentEntries,
    getEntriesByMonth,
    getTotalScriptWordCount,
    getPaginatedEntries
} = require('../queries/dashboardQueries');
const { validateQuery, dashboardPaginationSchema } = require('../validations/schemas');

userDashboard.get('/', validateQuery(dashboardPaginationSchema), async (req, res) => {
    const { id } = req.params;

    // Ownership check — users can only view their own dashboard
    if (req.user.id !== id) {
        return res.status(403).json({ error: "Unauthorized: You can only view your own dashboard" });
    }

    const { page, limit } = req.query;

    try {
        const [profile, stats, recentEntries, entriesByMonth, totalScriptWordCount, paginatedEntries] = await Promise.all([
            getUserProfile(id),
            getDashboardStats(id),
            getRecentEntries(id),
            getEntriesByMonth(id),
            getTotalScriptWordCount(id),
            getPaginatedEntries(id, page, limit)
        ]);

        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({
            profile: {
                name: `${profile.first_name} ${profile.last_name}`,
                username: profile.username,
                email: profile.email,
                memberSince: profile.created_at,
                accountAgeDays: profile.account_age_days
            },
            stats: {
                totalEntries: stats.total_entries,
                entriesWithScripts: stats.entries_with_scripts,
                entriesWithAudio: stats.entries_with_audio,
                totalScriptWordCount
            },
            recentEntries,
            entriesByMonth,
            entries: paginatedEntries
        });
    } catch (error) {
        console.error("Dashboard error:", error.message);
        res.status(500).json({ error: "Failed to load dashboard" });
    }
});

module.exports = userDashboard;
