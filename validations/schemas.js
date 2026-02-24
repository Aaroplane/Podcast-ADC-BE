const { z } = require('zod');

// Reusable field validators
const passwordField = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/\d/, "Password must contain at least one number");

const emailField = z.string()
    .email("Invalid email format")
    .max(100, "Email must be under 100 characters");

const usernameField = z.string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be under 50 characters");

// ============================================
// Auth Schemas
// ============================================

const loginSchema = z.object({
    username: z.string().min(1, "Username or email is required"),
    password: z.string().min(1, "Password is required")
});

// ============================================
// User Schemas
// ============================================

const createUserSchema = z.object({
    first_name: z.string().min(1, "First name is required").max(100),
    last_name: z.string().min(1, "Last name is required").max(100),
    username: usernameField,
    password: passwordField,
    email: emailField,
    phone_number: z.string().regex(
        /^(\(\d{3}\)\s?|\d{3}[-\s]?)\d{3}[-\s]?\d{4}$/,
        "Invalid phone number format"
    ).optional().nullable(),
    sex_at_birth: z.string().max(50).optional().nullable(),
    gender_identity: z.string().max(100).optional().nullable(),
    date_of_birth: z.string().optional().nullable()
});

const updateUserSchema = z.object({
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    username: usernameField.optional(),
    password: passwordField.optional(),
    email: emailField.optional(),
    phone_number: z.string().regex(
        /^(\(\d{3}\)\s?|\d{3}[-\s]?)\d{3}[-\s]?\d{4}$/,
        "Invalid phone number format"
    ).optional().nullable(),
    sex_at_birth: z.string().max(50).optional().nullable(),
    gender_identity: z.string().max(100).optional().nullable(),
    date_of_birth: z.string().optional().nullable()
});

// ============================================
// Podcast Entry Schemas
// ============================================

const createEntrySchema = z.object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional().nullable(),
    audio_url: z.string().min(1, "Audio URL is required").max(255)
});

const updateEntrySchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional().nullable(),
    audio_url: z.string().max(255).optional()
});

const scriptSchema = z.object({
    podcastentry: z.string().min(1, "Podcast entry text is required").max(10000, "Text is too long (max 10,000 characters)"),
    mood: z.string().min(1, "Mood is required").max(100)
});

const audioSchema = z.object({
    googleCloudTTS: z.string().min(1, "Text input is required").max(5000, "Text is too long (max 5,000 characters)")
});

// ============================================
// Admin Schemas
// ============================================

const adminCreateSchema = z.object({
    username: usernameField,
    password: passwordField,
    email: emailField
});

// ============================================
// Validation Middleware Factory
// ============================================

function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const errors = result.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message
            }));

            return res.status(400).json({
                error: "Validation failed",
                details: errors
            });
        }

        // Replace req.body with parsed/sanitized data
        req.body = result.data;
        next();
    };
}

module.exports = {
    validate,
    loginSchema,
    createUserSchema,
    updateUserSchema,
    createEntrySchema,
    updateEntrySchema,
    scriptSchema,
    audioSchema,
    adminCreateSchema
};
