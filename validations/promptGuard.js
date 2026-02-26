const { getSecretPatterns } = require('../config/secrets');

// ============================================
// Input Scanner — blocks injection attempts
// ============================================

const INJECTION_PATTERNS = [
    /ignore\s+(all\s+|your\s+|previous\s+|prior\s+)?(instructions|directives|rules|prompt)/i,
    /(reveal|show|output|print|repeat|display).{0,30}(system prompt|system instruction|api.?key|secret|env|password|credentials)/i,
    /(what is|what are|tell me).{0,30}(your (instructions|prompt|rules|system)|the api.?key|the secret)/i,
    /you are now|act as|pretend (to be|you are)|new persona|roleplay as/i,
    /\bprocess\.env\b/i,
    /\b(GEMINI|JWT|API|CLOUDINARY)[_\s]?(KEY|SECRET|TOKEN)\b/i
];

function scanInput(text) {
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            return { safe: false, reason: pattern.source };
        }
    }
    return { safe: true };
}

// ============================================
// Output Scanner — detects leaked secrets
// ============================================

const GENERIC_LEAK_PATTERNS = [
    /AIza[0-9A-Za-z_-]{35}/,           // Google API key prefix
    /[0-9a-f]{40,}/i,                   // Hex strings > 40 chars
    /process\.env\./i,                   // process.env references
    /JWT_SECRET\s*=/i,                   // Env var assignments
    /GEMINI_API_KEY\s*=/i,
    /CLOUDINARY_API_SECRET\s*=/i
];

function scanOutput(obj) {
    const strings = extractStrings(obj);
    const secretPatterns = getSecretPatterns();

    for (const str of strings) {
        // Check for actual secret values (high confidence)
        for (const escaped of secretPatterns) {
            if (new RegExp(escaped).test(str)) {
                return { safe: false, reason: 'Output contained a known secret value' };
            }
        }

        // Check for generic leak patterns
        for (const pattern of GENERIC_LEAK_PATTERNS) {
            if (pattern.test(str)) {
                return { safe: false, reason: 'Output contained suspicious content' };
            }
        }
    }

    return { safe: true };
}

function extractStrings(obj) {
    const results = [];
    if (typeof obj === 'string') {
        results.push(obj);
    } else if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj)) {
            results.push(...extractStrings(val));
        }
    }
    return results;
}

// ============================================
// Shape Validator — ensures expected JSON keys
// ============================================

const EXPECTED_KEYS = ['title', 'description', 'introduction', 'mainContent', 'conclusion'];

function validateShape(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const keys = Object.keys(obj);
    if (keys.length !== EXPECTED_KEYS.length) return false;
    return EXPECTED_KEYS.every(k => k in obj && typeof obj[k] === 'string');
}

// ============================================
// Fallback Prompt — safe, no user input
// ============================================

function buildFallbackPrompt(mood) {
    return `
        Create a short, interesting podcast script about a fascinating science fact.
        The mood of the podcast is "${mood}".
        Format the output as a JSON object with the following structure:
        {
            "title": "Podcast Title",
            "description": "Brief description of what the topic will be about",
            "introduction": "Brief introduction to the topic",
            "mainContent": "Detailed content of the podcast",
            "conclusion": "Summary and closing remarks"
        }
        Return only the JSON object without any additional text or markdown formatting.
    `;
}

module.exports = { scanInput, scanOutput, validateShape, buildFallbackPrompt };
