// * Setting Environment
const express = require('express');
const podcastEntryController = express.Router({mergeParams: true});
require('dotenv').config();
const API_KEY = process.env.GEMINI_API_KEY;

// * Queries and Token
const {
    getAllEntries,
    getSpecificEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    saveScript,
    getScript
} = require('../queries/podcastEntriesQueries');
const { AuthenticateToken } = require('../validations/UserTokenAuth');
const { validate, createEntrySchema, updateEntrySchema, scriptSchema, audioSchema, saveScriptSchema, conversationSchema } = require('../validations/schemas');
const { generationLimiter } = require('../validations/rateLimiter');

// * Gemini content Creation variables
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are the host of a podcast and create a formatted podcast speech with the information entered."
});

// * TTS Provider
const { synthesize, getAvailableVoices } = require('../services/ttsProvider');

podcastEntryController.get('/', AuthenticateToken, async (req, res) => {
    const { user_id } = req.params;
    try {
        const entries = await getAllEntries(user_id);
        res.status(200).json(entries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

podcastEntryController.get('/:id', AuthenticateToken, async (req, res) => {
    const { id, user_id } = req.params;
    try {
        const entry = await getSpecificEntry(id, user_id);
        res.status(200).json(entry);
    } catch (error) {
        res.status(404).json({ error: "Entry not found" });
    }
});

podcastEntryController.post('/', AuthenticateToken, validate(createEntrySchema), async (req, res) => {
    const { user_id } = req.params;
    const entryData = req.body;
    try {
        const newEntry = await createEntry(user_id, entryData);
        res.status(201).json(newEntry);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

podcastEntryController.put('/:id', AuthenticateToken, validate(updateEntrySchema), async (req, res) => {
    const { id, user_id } = req.params;
    const entryData = req.body;
    try {
        const updated = await updateEntry(id, user_id, entryData);
        res.status(200).json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

podcastEntryController.delete('/:id', AuthenticateToken, async (req, res) => {
    const { id, user_id } = req.params;
    try {
        const deleted = await deleteEntry(id, user_id);
        res.status(200).json({ message: "Successfully deleted Podcast!", deleted });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

podcastEntryController.post('/script', AuthenticateToken, generationLimiter, validate(scriptSchema), async (req, res) => {
    try {
        const { podcastentry, mood } = req.body;
        const structuredPrompt = `
            ${podcastentry}
            The mood of the podcast is "${mood}".
            Format the output as a JSON object with the following structure:
            {
                "title": "Podcast Title",
                "description": Brief description of what the topic will be about,
                "introduction": "Brief introduction to the topic",
                "mainContent": "Detailed content of the podcast",
                "conclusion": "Summary and closing remarks"
            }
            Return only the JSON object without any additional text or markdown formatting.
        `;
        const result = await model.generateContent(structuredPrompt);
        const textResponse = result.response.text();

        let jsonResponse = textResponse.trim();

        if (jsonResponse.startsWith('```json')) {
            jsonResponse = jsonResponse.slice(7);
        }
        if (jsonResponse.endsWith('```')) {
            jsonResponse = jsonResponse.slice(0, -3);
        }

        const structuredResponse = JSON.parse(jsonResponse);

        res.json(structuredResponse);
    } catch (error) {
        console.error("Error generating content:", error);
        res.status(500).json({ error: "Failed to generate content." });
    }
});

// Save script to an existing entry
podcastEntryController.put('/:id/script', AuthenticateToken, validate(saveScriptSchema), async (req, res) => {
    const { id, user_id } = req.params;
    try {
        const updated = await saveScript(id, user_id, req.body);
        res.status(200).json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Retrieve a saved script
podcastEntryController.get('/:id/script', AuthenticateToken, async (req, res) => {
    const { id, user_id } = req.params;
    try {
        const entry = await getScript(id, user_id);
        if (!entry || !entry.script_content) {
            return res.status(404).json({ error: "Script not found" });
        }
        res.status(200).json(entry.script_content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Single-voice TTS audio generation (backwards compatible)
podcastEntryController.post('/audio', AuthenticateToken, generationLimiter, validate(audioSchema), async (req, res) => {
    const { text, googleCloudTTS, voice } = req.body;
    const inputText = text || googleCloudTTS;

    try {
        const audioBuffer = await synthesize(inputText, voice);

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

// Multi-voice conversation endpoint
podcastEntryController.post('/audio/conversation', AuthenticateToken, generationLimiter, validate(conversationSchema), async (req, res) => {
    const { turns } = req.body;

    try {
        const audioBuffers = [];

        for (let i = 0; i < turns.length; i++) {
            const { speaker, text } = turns[i];
            const audioBuffer = await synthesize(text, speaker);
            audioBuffers.push(audioBuffer);

            // 200ms delay between turns to prevent Microsoft throttling
            if (i < turns.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        const combinedAudio = Buffer.concat(audioBuffers);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'inline; filename="conversation.mp3"',
        });
        res.status(200).send(combinedAudio);
    } catch (error) {
        console.error("Conversation TTS error:", error.message);
        res.status(500).json({ error: "Failed to generate conversation audio." });
    }
});

// Get available TTS voices
podcastEntryController.get('/audio/voices', AuthenticateToken, async (req, res) => {
    res.status(200).json(getAvailableVoices());
});

module.exports = podcastEntryController;
