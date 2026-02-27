# CLAUDE.md — Project Context for Claude Code

## Project Overview
Node.js/Express backend for the ChitChat Podcast app. Generates AI podcast scripts via Gemini, synthesizes multi-voice audio via Edge TTS, and persists entries to PostgreSQL.

## Key Architecture

### Directory Structure
```
controller/           — Route handlers (podcastEntryController.js is the main one)
queries/              — PostgreSQL query functions (parameterized, pg-promise)
validations/          — Zod schemas (schemas.js), prompt guard (promptGuard.js), rate limiters, auth
services/             — TTS provider (Edge TTS), Cloudinary provider
config/               — Centralized secret access (secrets.js)
tests/                — E2E regression suite (regressionTest.js)
db/                   — Schema SQL + seed data
```

### Script Generation Flow
1. `POST /script` receives `{ podcastentry, mood, speakers?, tone? }`
2. `scanInput()` blocks injection attempts (returns 400)
3. Prompt branches: speakers=1 returns `{ title, description, introduction, mainContent, conclusion }`, speakers>1 returns `{ title, description, turns: [{ speaker, text }] }`
4. `validateShape()` checks output structure (supports both formats)
5. `scanOutput()` detects leaked secrets
6. `scanTopicRelevance()` blocks off-topic content in multi-speaker turns
7. Failed checks trigger `buildFallbackPrompt()` retry with no user input

### Audio Flow
- `POST /audio` — Single-voice TTS, returns MP3 buffer or Cloudinary URL
- `POST /audio/conversation` — Multi-voice TTS, concatenates per-turn audio
- Multi-speaker script `turns` array is directly compatible with conversation endpoint
- Edge TTS is free (no API key), uses WebSocket to Microsoft servers

### Auth
- JWT access tokens + refresh token rotation
- `AuthenticateToken` middleware on all protected routes
- Admin routes have separate auth check

### Rate Limiting
- `generationLimiter`: 20 req/15min per IP (200 in test mode)
- `apiLimiter`: 100 req/15min per IP (1000 in test mode)
- Test mode activated by `NODE_ENV=test`

## Testing
```bash
NODE_ENV=test node server.js &   # Start server with relaxed rate limits
NODE_ENV=test npm test           # Run 142 E2E tests
```
Tests require a running server + PostgreSQL database. Cloudinary tests skip if env vars not set (2 expected skips).

## Conventions
- Zod for all input validation (schemas.js)
- Parameterized queries only (no string interpolation in SQL)
- Secrets accessed via config/secrets.js getters (never process.env directly in controllers)
- Error responses: `{ error: "message" }` — never leak stack traces or internal details
- Console.warn for security events, console.error for crashes
- All generation endpoints: AuthenticateToken -> generationLimiter -> validate -> handler

## Important Files
| File | Purpose |
|---|---|
| `controller/podcastEntryController.js` | All podcast entry + script + audio routes |
| `validations/schemas.js` | Zod schemas for every endpoint |
| `validations/promptGuard.js` | Input/output scanning, shape validation, topic relevance |
| `validations/rateLimiter.js` | express-rate-limit configs (test-mode aware) |
| `services/ttsProvider.js` | Edge TTS synthesis, 28 voices, role aliases |
| `services/cloudinaryProvider.js` | Audio upload/delete to Cloudinary |
| `config/secrets.js` | Centralized env var access |
| `tests/regressionTest.js` | 142 E2E tests covering all endpoints |
