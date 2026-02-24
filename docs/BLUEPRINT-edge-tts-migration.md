# Blueprint: Edge TTS Migration & Provider Abstraction Layer

> **Status:** Pending Review
> **Created:** 2026-02-24
> **Scope:** Replace Google Cloud TTS + ElevenLabs with Edge TTS (free, no account) and build a provider-swappable architecture

---

## Why This Change

| Current State | Target State |
|---------------|--------------|
| Google Cloud TTS requires GCP service account + credentials JSON | Edge TTS requires nothing — zero accounts, zero keys |
| ElevenLabs installed but only used in a test file | Clean dependency — remove unused packages |
| Single hardcoded voice (en-US-Wavenet-F) | Multi-voice support for podcast conversations |
| Provider tightly coupled in controller | Provider abstraction — swap via env var |
| Audio streams to client, never saved | (Future: Task #8) Persist to storage |
| `googleCloudTTS` hardcoded in request body field name | Generic `text` field |

---

## How Edge TTS Works (No Account Needed)

1. Your server opens a **WebSocket** to `speech.platform.bing.com`
2. It sends your text wrapped in SSML (Speech Synthesis Markup Language)
3. Microsoft's neural TTS models process it on their servers
4. Audio streams back as binary chunks over the WebSocket
5. Authentication is handled by a hardcoded token built into the library — same one Edge browser uses

**No Microsoft account. No API key. No Azure subscription. Just `npm install`.**

**Legal note:** This is an unofficial API (same endpoint Edge browser's "Read Aloud" uses). Microsoft has stated commercial use should go through Azure. No enforcement has occurred, but for production at scale, the abstraction layer we build lets you swap to a paid provider with a single env var change.

---

## Package Choice: `msedge-tts`

- npm: `msedge-tts` (v2.0.4, actively maintained as of Feb 2026)
- Promise-based API with `.toStream()` and `.toRawResponse()` methods
- 400+ neural voices across 100+ languages
- Supports 36+ audio formats including MP3, WAV, OGG
- Zero dependencies on Python, GPU, or system binaries

---

## Step-by-Step Blueprint

### Step 1: Create TTS Provider Abstraction Layer

**New file:** `services/ttsProvider.js`

**Purpose:** A strategy pattern that decouples the controller from any specific TTS provider. The controller calls `ttsProvider.synthesize(text, voiceId)` and gets back an audio buffer — it never knows or cares which provider generated it. This is what makes future provider swaps trivial.

```javascript
// services/ttsProvider.js

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// ============================================
// Voice Configuration
// ============================================
const VOICES = {
    host: 'en-US-GuyNeural',       // Male host voice
    cohost: 'en-US-JennyNeural',   // Female co-host voice
    narrator: 'en-GB-RyanNeural',  // British narrator (community favorite)
};

// ============================================
// Edge TTS Provider
// ============================================
async function synthesizeWithEdgeTTS(text, voiceId) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
        voiceId,
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const readable = tts.toStream(text);

    // Collect the stream into a buffer
    const chunks = [];
    for await (const chunk of readable) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
        }
    }
    return Buffer.concat(chunks);
}

// ============================================
// Public API — Provider Router
// ============================================
async function synthesize(text, voice = 'host') {
    const voiceId = VOICES[voice] || VOICES.host;

    const provider = process.env.TTS_PROVIDER || 'edge';

    switch (provider) {
        case 'edge':
            return synthesizeWithEdgeTTS(text, voiceId);

        // Future providers go here:
        // case 'openai':
        //     return synthesizeWithOpenAI(text, voiceId);
        // case 'google':
        //     return synthesizeWithGoogleCloud(text, voiceId);
        // case 'elevenlabs':
        //     return synthesizeWithElevenLabs(text, voiceId);

        default:
            return synthesizeWithEdgeTTS(text, voiceId);
    }
}

function getAvailableVoices() {
    return { ...VOICES };
}

module.exports = { synthesize, getAvailableVoices, VOICES };
```

**How it connects forward:** Every subsequent step depends on this file. The controller (Step 4) calls `synthesize()`. The multi-voice endpoint (Step 5) calls it in a loop with different voice keys. Future provider additions (Step 7) add a new case to the switch.

---

### Step 2: Install Edge TTS, Remove Old TTS Dependencies

**File modified:** `package.json`

**What changes:**
```
REMOVE:  "@google-cloud/text-to-speech": "^6.0.1"
REMOVE:  "elevenlabs": "^1.50.4"
ADD:     "msedge-tts": "^2.0.4"
```

**Commands:**
```bash
npm uninstall @google-cloud/text-to-speech elevenlabs
npm install msedge-tts
```

**Why:** Google Cloud TTS required a service account JSON file + `GOOGLE_APPLICATION_CREDENTIALS` env var. ElevenLabs was never used in production (only `test_elevenlabs.js`). Removing both eliminates credential management overhead. `msedge-tts` replaces both with zero configuration.

**How it connects forward:** Step 3 and Step 4 import from `msedge-tts` via the abstraction layer created in Step 1.

---

### Step 3: Add Environment Variable for Provider Selection

**File modified:** `.env` (and document in `.env.example`)

**Add:**
```bash
# TTS Provider: 'edge' (free, default) | 'openai' | 'google' | 'elevenlabs'
TTS_PROVIDER=edge
```

**Remove (no longer needed):**
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Purpose:** The `TTS_PROVIDER` env var controls which provider the abstraction layer (Step 1) routes to. Changing this single variable swaps the entire TTS engine without touching any code. Default is `edge` so it works out of the box with zero config.

**How it connects forward:** The `synthesize()` function in Step 1 reads `process.env.TTS_PROVIDER` to decide which provider function to call.

---

### Step 4: Update the `/audio` Endpoint in podcastEntryController.js

**File modified:** `controller/podcastEntryController.js`

**What changes and why:**

| Line(s) | Current Code | New Code | Reason |
|---------|-------------|----------|--------|
| 21-22 | `require('@google-cloud/text-to-speech')` + `new TextToSpeechClient()` | `require('../services/ttsProvider')` | Swap to abstraction layer |
| 131 | `const { googleCloudTTS } = req.body` | `const { text, googleCloudTTS } = req.body` | Support new field name + backwards compat with frontend |
| 134 | `console.log("BE-Line 131 TTS prompt: ", googleCloudTTS)` | Remove | Leaks user content to logs |
| 137 | `if (!googleCloudTTS \|\| ...)` | `if (!ttsInput \|\| ...)` | Use unified variable |
| 141-151 | Google-specific request object (languageCode, ssmlGender, etc.) | Removed entirely | Provider abstraction handles all config |
| 153 | `const [response, metadata] = await ttsClient.synthesizeSpeech(request)` | `const audioBuffer = await synthesize(ttsInput, voice)` | Single clean call to abstraction |
| 155-158 | Multiple debug console.logs | Remove | Sensitive data + noise |
| 163 | `res.status(200).send(response.audioContent)` | `res.status(200).send(audioBuffer)` | Buffer comes directly from provider |
| 166 | `console.log("GOOGLE_APPLICATION_CREDENTIALS:", ...)` | Remove | Security vulnerability |

**The new `/audio` endpoint will look like:**

```javascript
podcastEntryController.post('/audio', AuthenticateToken, async (req, res) => {
    // Support both old and new field names for frontend compatibility
    const { text, googleCloudTTS, voice } = req.body;
    const ttsInput = text || googleCloudTTS;

    if (!ttsInput || typeof ttsInput !== 'string') {
        return res.status(400).json({ error: "Missing or invalid text input." });
    }

    try {
        const audioBuffer = await synthesize(ttsInput, voice || 'host');

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'inline; filename="output.mp3"',
        });
        res.status(200).send(audioBuffer);
    } catch (error) {
        console.error("TTS synthesis error:", error.message);
        res.status(500).json({ error: "Failed to generate audio." });
    }
});
```

**Key improvements over current code:**
- `AuthenticateToken` added (was missing — fixes Task #2)
- No provider-specific code in the controller
- No sensitive data logged
- Frontend can send `voice: "host"` or `voice: "cohost"` to pick voices
- Backwards compatible — still accepts `googleCloudTTS` field name

**How it connects forward:** This endpoint now uses the abstraction layer from Step 1. When you later build multi-voice in Step 5, the same `synthesize()` function handles it. When you later add audio persistence (Task #8), you'd save `audioBuffer` to storage before sending.

---

### Step 5: Add Multi-Voice Endpoint for Podcast Conversations

**New route added to:** `controller/podcastEntryController.js`

**Purpose:** Generate a full podcast episode with multiple speakers. Each speaker turn gets synthesized with a different voice, then all segments are concatenated into a single MP3.

**New endpoint:** `POST /users/:user_id/podcastentries/audio/conversation`

```javascript
podcastEntryController.post('/audio/conversation', AuthenticateToken, async (req, res) => {
    const { turns } = req.body;
    // turns = [
    //   { speaker: "host", text: "Welcome to the show!" },
    //   { speaker: "cohost", text: "Thanks for having me." },
    //   { speaker: "host", text: "Let's dive into today's topic..." }
    // ]

    if (!Array.isArray(turns) || turns.length === 0) {
        return res.status(400).json({ error: "Missing or invalid conversation turns." });
    }

    try {
        const audioSegments = [];
        for (const turn of turns) {
            // Small delay between requests to avoid throttling
            if (audioSegments.length > 0) {
                await new Promise(r => setTimeout(r, 200));
            }
            const buffer = await synthesize(turn.text, turn.speaker || 'host');
            audioSegments.push(buffer);
        }

        // Concatenate all MP3 segments
        const fullAudio = Buffer.concat(audioSegments);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'inline; filename="podcast-episode.mp3"',
        });
        res.status(200).send(fullAudio);
    } catch (error) {
        console.error("Conversation synthesis error:", error.message);
        res.status(500).json({ error: "Failed to generate conversation audio." });
    }
});
```

**Why the 200ms delay:** Edge TTS opens a new WebSocket per synthesis request. Rapid-fire requests can trigger Microsoft's throttling. A 200ms gap between turns prevents this while keeping total generation time fast (a 20-turn conversation adds ~4 seconds of delay total).

**How it connects to Step 4:** Uses the exact same `synthesize()` function but calls it in a loop with different voice keys per speaker turn.

**How it connects to the Gemini script generation (existing `/script` endpoint):** The frontend workflow becomes:
1. User enters topic + mood → `POST /script` → Gemini generates structured content
2. Frontend formats the script into speaker turns
3. Frontend sends turns → `POST /audio/conversation` → gets back full podcast MP3

**Future enhancement:** Modify the Gemini prompt (line 92-104) to output speaker turns directly as JSON array, eliminating the frontend formatting step.

---

### Step 6: Clean Up Removed Provider Files

**Files to delete or archive:**
- `test_elevenlabs.js` — No longer needed (ElevenLabs removed). Archive to `docs/archive/` if you want to keep as reference
- `GoogleCloudTTS/` directory — Contains `google-cloud-sdk/` directory that's no longer needed. The SDK was used for Google Cloud TTS credentials

**Files to update:**
- `controller/podcastEntryController.js` — Remove lines 21-22 (Google TTS import/client)
- `.gitignore` — Remove any Google credential file patterns if present

**Purpose:** Clean up dead code and unused dependencies so the project only contains what's actually in use.

**How it connects back:** After Steps 1-5 are complete, these files have zero references anywhere in the codebase. Removing them reduces confusion for anyone reading the project.

---

### Step 7: Future Provider Integration (Reference)

When you're ready to add a paid provider for production, add a new function to `services/ttsProvider.js`:

**Example — Adding OpenAI TTS ($0.23/episode):**

```javascript
const OpenAI = require('openai');

const OPENAI_VOICES = {
    host: 'onyx',       // Deep, authoritative
    cohost: 'nova',     // Warm, conversational
    narrator: 'fable',  // Expressive, storytelling
};

async function synthesizeWithOpenAI(text, voiceKey) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const voice = OPENAI_VOICES[voiceKey] || OPENAI_VOICES.host;

    const response = await client.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
        response_format: 'mp3',
    });

    return Buffer.from(await response.arrayBuffer());
}
```

Then add `case 'openai': return synthesizeWithOpenAI(text, voice);` to the switch in `synthesize()`. Set `TTS_PROVIDER=openai` in `.env`. Done — zero controller changes needed.

---

## Files Changed Summary

| File | Action | What Changes |
|------|--------|--------------|
| `services/ttsProvider.js` | **CREATE** | New provider abstraction layer |
| `controller/podcastEntryController.js` | **MODIFY** | Remove Google TTS import, rewrite `/audio`, add `/audio/conversation` |
| `package.json` | **MODIFY** | Remove 2 deps, add 1 dep |
| `.env` | **MODIFY** | Add `TTS_PROVIDER=edge`, remove `GOOGLE_APPLICATION_CREDENTIALS` |
| `test_elevenlabs.js` | **DELETE** | No longer needed |
| `GoogleCloudTTS/` | **DELETE** | No longer needed |

## Request/Response Shapes (for Frontend)

### Single Voice (backwards compatible)
```
POST /users/:user_id/podcastentries/audio
Headers: { Authorization: "Bearer <token>" }
Body:    { "text": "Hello world", "voice": "host" }
         // OR legacy: { "googleCloudTTS": "Hello world" }
Response: Binary MP3 audio (Content-Type: audio/mpeg)
```

### Multi-Voice Conversation (new)
```
POST /users/:user_id/podcastentries/audio/conversation
Headers: { Authorization: "Bearer <token>" }
Body: {
    "turns": [
        { "speaker": "host", "text": "Welcome to Chit Chat Podcast!" },
        { "speaker": "cohost", "text": "Great to be here. Today we're talking about..." },
        { "speaker": "host", "text": "Let's dive right in." }
    ]
}
Response: Binary MP3 audio (Content-Type: audio/mpeg)
```

### Available Voices
```
Default voices (configurable in services/ttsProvider.js):
  "host"     → en-US-GuyNeural    (Male, engaging American)
  "cohost"   → en-US-JennyNeural  (Female, warm American)
  "narrator" → en-GB-RyanNeural   (Male, natural British — community favorite)
```

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| TTS cost per episode | $0.24 (Google WaveNet) | $0.00 (Edge TTS) |
| Account/credentials needed | GCP service account + JSON file | None |
| Voices available | 1 (hardcoded female) | 400+ (3 preconfigured) |
| Multi-speaker support | No | Yes |
| Provider swap effort | Rewrite controller | Change 1 env var |
| npm dependencies (TTS) | 2 packages | 1 package |
