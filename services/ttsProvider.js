const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// Preconfigured voice map — maps friendly names to Edge TTS voice IDs
const VOICES = {
    host: 'en-US-GuyNeural',
    cohost: 'en-US-JennyNeural',
    narrator: 'en-GB-RyanNeural'
};

const DEFAULT_VOICE = 'host';

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
    const voiceId = VOICES[voice] || VOICES[DEFAULT_VOICE];

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
 * Get available preconfigured voices.
 * @returns {Object} Map of voice keys to voice IDs
 */
function getAvailableVoices() {
    return { ...VOICES };
}

module.exports = {
    synthesize,
    getAvailableVoices,
    VOICES,
    DEFAULT_VOICE
};
