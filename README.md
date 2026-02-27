# Podcast-ADC Backend

Welcome to the **Podcast-ADC Backend**! This repository contains the server-side logic for the Podcast-ADC project, built with **Node.js** and **Express**. It integrates with **Gemini** for AI-powered script generation and **Microsoft Edge TTS** for multi-voice text-to-speech capabilities.

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [API Integrations](#api-integrations)
- [Security](#security)
- [Testing](#testing)
- [License](#license)

## Project Overview

The Podcast-ADC Backend is the core server component that powers the Podcast-ADC project. It handles:

- AI-powered podcast script generation (single-speaker monologue or multi-speaker conversations)
- Multi-voice TTS audio synthesis with 28 preconfigured voices across 6 accents
- User authentication with JWT + refresh token rotation
- Podcast entry CRUD with script persistence (JSONB)
- Optional Cloudinary audio persistence
- Admin dashboard with usage analytics

## Features

- **Script Generation**: Gemini-powered script creation supporting 1-3 speakers with configurable mood and conversational tone
- **Multi-Voice TTS**: Edge TTS with host/cohost/narrator role aliases and 28 selectable voices
- **Audio Pipeline**: Multi-speaker `turns` output feeds directly into the conversation audio endpoint
- **Security Hardening**: Input injection scanning, output secret detection, topic relevance guards, and rate limiting
- **RESTful API**: Full CRUD for users, entries, scripts, and audio
- **Zod Validation**: Schema-based input validation with union types for polymorphic payloads
- **CORS Support**: Enabled for seamless frontend-backend communication

## Tech Stack

### Core Technologies
- **Node.js** — Server-side JavaScript runtime
- **Express** — Web framework with middleware pipeline
- **PostgreSQL** — Database with JSONB script storage
- **Zod** — Schema validation at API boundaries

### API Integrations
- **Gemini API** (google/generative-ai) — AI script generation
- **Microsoft Edge TTS** (msedge-tts) — Free multi-voice text-to-speech
- **Cloudinary** (optional) — Audio file persistence

### Security
- **bcrypt** — Password hashing
- **jsonwebtoken** — JWT access + refresh token rotation
- **express-rate-limit** — Per-IP rate limiting (login, signup, generation, API)
- **Prompt Guard** — Input injection scanning + output secret detection + topic relevance filtering

### Development Tools
- **dotenv** — Environment variable management
- **nodemon** — Development auto-restart
- **Custom E2E Test Suite** — 142 regression tests (run with `NODE_ENV=test npm test`)

## Security

The backend implements a multi-layer prompt security system:

1. **Input Guard** (`scanInput`) — Blocks prompt injection attempts (role hijack, secret extraction, env var references)
2. **Output Guard** (`scanOutput`) — Detects leaked secrets, API keys, and env var patterns in Gemini responses
3. **Shape Validator** (`validateShape`) — Ensures Gemini output matches expected JSON structure (solo or multi-speaker)
4. **Topic Relevance Guard** (`scanTopicRelevance`) — Scans multi-speaker dialogue for off-topic dangerous content (SQL, admin references, infrastructure details)
5. **Fallback Prompt** — If output fails any guard, retries with a safe prompt containing no user input

## Testing

```bash
# Start server in test mode (relaxed rate limits), then run tests
NODE_ENV=test npm start &
NODE_ENV=test npm test
```

The test suite covers: health checks, signup/login, auth enforcement, CRUD, admin, script generation, prompt injection guards, multi-speaker validation, audio generation, conversation endpoints, voice catalog, refresh tokens, dashboard, Cloudinary persistence, topic relevance guards, and edge cases.

## Installation

To set up the backend locally, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/AaronConstant/Podcast-ADC.git
   cd Podcast-ADC/backend
