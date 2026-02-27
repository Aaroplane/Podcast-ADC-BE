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

    // Multi-speaker format: { title, description, turns: [{ speaker, text }] }
    if (obj.turns) {
        return typeof obj.title === 'string'
            && typeof obj.description === 'string'
            && Array.isArray(obj.turns)
            && obj.turns.length > 0
            && obj.turns.every(t => typeof t.speaker === 'string' && typeof t.text === 'string');
    }

    // Single-speaker format: { title, description, introduction, mainContent, conclusion }
    const keys = Object.keys(obj);
    if (keys.length !== EXPECTED_KEYS.length) return false;
    return EXPECTED_KEYS.every(k => k in obj && typeof obj[k] === 'string');
}

// ============================================
// Topic Relevance Scanner — blocks off-topic dangerous content in multi-speaker turns
// ============================================

const OFF_TOPIC_PATTERNS = [
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.{0,40}\b(FROM|INTO|TABLE)\b/i,   // SQL
    /\b(process\.env|require\(|module\.exports)/i,                       // Node internals
    /\b(admin\s*(panel|dashboard|login|account|password))/i,             // Admin references
    /\b(database|postgresql|pg_|schema|migration|seed)\b/i,             // DB architecture
    /\b(jwt|bearer\s+token|refresh.?token|api.?key|secret.?key)\b/i,   // Auth/secrets
    /\b(cloudinary|render\.com|heroku|aws|server\s+config)/i,           // Infrastructure
    /\b(user_?id|user\.id|req\.user|req\.params)/i,                     // Code internals
];

function scanTopicRelevance(obj) {
    if (!obj || !Array.isArray(obj.turns)) return { safe: true };

    for (const turn of obj.turns) {
        if (typeof turn.text !== 'string') continue;
        for (const pattern of OFF_TOPIC_PATTERNS) {
            if (pattern.test(turn.text)) {
                return { safe: false, reason: `Off-topic content detected: ${pattern.source}` };
            }
        }
    }
    return { safe: true };
}

// ============================================
// Fallback Prompt — safe, no user input
// ============================================

function buildFallbackPrompt(mood, speakers = 1) {
    if (speakers > 1) {
        const speakerList = speakers === 2
            ? 'Host (engaging lead) and Cohost (supportive counterpoint)'
            : 'Host (engaging lead), Cohost (supportive counterpoint), and Narrator (scene-setting, transitions)';
        return `
            Create a short, interesting podcast conversation between ${speakers} speakers about a fascinating science fact.
            Speakers: ${speakerList}.
            The mood of the podcast is "${mood}".
            Format the output as a JSON object with the following structure:
            {
                "title": "Podcast Title",
                "description": "Brief description of what the topic will be about",
                "turns": [
                    { "speaker": "host", "text": "..." },
                    { "speaker": "cohost", "text": "..." }
                ]
            }
            Return only the JSON object without any additional text or markdown formatting.
        `;
    }
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

module.exports = { scanInput, scanOutput, validateShape, scanTopicRelevance, buildFallbackPrompt };
