// Custom error class with status codes
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

// Global error handler — catches anything that falls through controllers
const errorHandler = (err, req, res, next) => {
    // Already sent a response, delegate to Express default
    if (res.headersSent) {
        return next(err);
    }

    // Known application error
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    // Zod validation error (shouldn't reach here if middleware catches it, but safety net)
    if (err.name === 'ZodError') {
        const errors = err.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
        }));
        return res.status(400).json({ error: "Validation failed", details: errors });
    }

    // JSON parse error (malformed request body)
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: "Invalid JSON in request body" });
    }

    // Payload too large
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: "Request body too large" });
    }

    // Everything else — don't leak internal details
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
};

module.exports = { AppError, errorHandler };
