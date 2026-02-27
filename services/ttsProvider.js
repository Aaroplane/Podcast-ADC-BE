const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// Preconfigured voice catalog — each entry has the Edge TTS voice ID plus metadata
// the frontend can use for rendering a voice picker (gender, accent, label)
const VOICES = {
    // US English
    guy:           { id: 'en-US-GuyNeural',           label: 'Guy',           gender: 'male',   accent: 'US' },
    jenny:         { id: 'en-US-JennyNeural',         label: 'Jenny',         gender: 'female', accent: 'US' },
    aria:          { id: 'en-US-AriaNeural',          label: 'Aria',          gender: 'female', accent: 'US' },
    christopher:   { id: 'en-US-ChristopherNeural',   label: 'Christopher',   gender: 'male',   accent: 'US' },
    eric:          { id: 'en-US-EricNeural',          label: 'Eric',          gender: 'male',   accent: 'US' },
    michelle:      { id: 'en-US-MichelleNeural',      label: 'Michelle',      gender: 'female', accent: 'US' },
    roger:         { id: 'en-US-RogerNeural',         label: 'Roger',         gender: 'male',   accent: 'US' },
    steffan:       { id: 'en-US-SteffanNeural',       label: 'Steffan',       gender: 'male',   accent: 'US' },
    ana:           { id: 'en-US-AnaNeural',           label: 'Ana',           gender: 'female', accent: 'US' },
    andrew:        { id: 'en-US-AndrewNeural',        label: 'Andrew',        gender: 'male',   accent: 'US' },
    ava:           { id: 'en-US-AvaNeural',           label: 'Ava',           gender: 'female', accent: 'US' },
    brian:         { id: 'en-US-BrianNeural',         label: 'Brian',         gender: 'male',   accent: 'US' },
    emma:          { id: 'en-US-EmmaNeural',          label: 'Emma',          gender: 'female', accent: 'US' },
    // British English
    ryan:          { id: 'en-GB-RyanNeural',          label: 'Ryan',          gender: 'male',   accent: 'UK' },
    sonia:         { id: 'en-GB-SoniaNeural',         label: 'Sonia',         gender: 'female', accent: 'UK' },
    thomas:        { id: 'en-GB-ThomasNeural',        label: 'Thomas',        gender: 'male',   accent: 'UK' },
    libby:         { id: 'en-GB-LibbyNeural',         label: 'Libby',         gender: 'female', accent: 'UK' },
    maisie:        { id: 'en-GB-MaisieNeural',        label: 'Maisie',        gender: 'female', accent: 'UK' },
    // Australian English
    natasha:       { id: 'en-AU-NatashaNeural',       label: 'Natasha',       gender: 'female', accent: 'AU' },
    william:       { id: 'en-AU-WilliamMultilingualNeural', label: 'William', gender: 'male',   accent: 'AU' },
    // Canadian English
    clara:         { id: 'en-CA-ClaraNeural',         label: 'Clara',         gender: 'female', accent: 'CA' },
    liam:          { id: 'en-CA-LiamNeural',          label: 'Liam',          gender: 'male',   accent: 'CA' },
    // Indian English
    neerja:        { id: 'en-IN-NeerjaExpressiveNeural', label: 'Neerja',     gender: 'female', accent: 'IN' },
    prabhat:       { id: 'en-IN-PrabhatNeural',       label: 'Prabhat',       gender: 'male',   accent: 'IN' },
    // Irish English
    connor:        { id: 'en-IE-ConnorNeural',        label: 'Connor',        gender: 'male',   accent: 'IE' },
    emily:         { id: 'en-IE-EmilyNeural',         label: 'Emily',         gender: 'female', accent: 'IE' },
};

// Backwards-compatible role aliases that map to specific voices
const ROLE_ALIASES = {
    host: 'guy',
    cohost: 'jenny',
    narrator: 'ryan'
};

const DEFAULT_VOICE = 'guy';

/**
 * Synthesize text to MP3 audio using the active TTS provider.
 * @param {string} text - The text to convert to speech
 * @param {string} [voice] - Voice key from VOICES map or a raw Edge TTS voice ID
 * @returns {Promise<Buffer>} MP3 audio buffer
 */
async function synthesize(text, voice) {
    const provider = process.env.TTS_PROVIDER || 'edge';

    switch (provider) {
        case 'edge':
            return synthesizeWithEdgeTTS(text, voice);
        default:
            throw new Error(`Unknown TTS provider: ${provider}`);
    }
}

/**
 * Synthesize text using Microsoft Edge TTS (free, no API key).
 * Connects via WebSocket to Microsoft's servers, returns MP3 audio chunks.
 */
async function synthesizeWithEdgeTTS(text, voice) {
    // Resolve voice key: check role aliases first, then direct voice keys
    const resolvedKey = ROLE_ALIASES[voice] || voice || DEFAULT_VOICE;
    const voiceEntry = VOICES[resolvedKey] || VOICES[DEFAULT_VOICE];
    const voiceId = voiceEntry.id;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text);

    const chunks = [];
    for await (const chunk of audioStream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/**
 * Get available preconfigured voices with metadata for frontend rendering.
 * @returns {Object} { voices: [...], roles: {...} }
 */
function getAvailableVoices() {
    const voices = Object.entries(VOICES).map(([key, v]) => ({
        key,
        id: v.id,
        label: v.label,
        gender: v.gender,
        accent: v.accent
    }));

    return {
        voices,
        roles: { ...ROLE_ALIASES },
        default: DEFAULT_VOICE
    };
}

module.exports = {
    synthesize,
    getAvailableVoices,
    VOICES,
    ROLE_ALIASES,
    DEFAULT_VOICE
};
