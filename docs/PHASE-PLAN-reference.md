# Chit Chat Podcast Backend — Development Phase Plan

> **Status:** Phase 1 COMPLETED (2026-02-24) — Phase 2+ pending
> **Created:** 2026-02-24
> **Last Updated:** 2026-02-24
> **Purpose:** Complete roadmap for backend improvements, organized by priority phase

---

## Phase 1: Security Lockdown [COMPLETED]

> Specialists: `/specialist auth-specialist` + `/specialist code-reviewer`
> **Completed 2026-02-24**

### Task #1 — Fix Password Stored in Plaintext on User Update [DONE]
- **File:** `queries/usersQueries.js:71-73`
- **Fix applied:** Added `bcrypt.hash()` before UPDATE query when password is present

### Task #2 — Add AuthenticateToken to Unprotected Podcast Endpoints [DONE]
- **File:** `controller/podcastEntryController.js`
- **Problem:** POST (create), PUT (update), DELETE, and POST /audio all missing auth middleware
- **Fix:** Add `AuthenticateToken` middleware + `req.user.id` ownership validation
- **Endpoints affected:** Lines 51, 64, 75, 130

### Task #3 — Remove or Protect GET /users
- **File:** `controller/usersController.js:23-36`
- **Problem:** Returns all user data (emails, phone numbers, demographics) with zero authentication
- **Fix:** Either remove entirely or gate behind admin role check

### Task #4 — Remove Sensitive console.log Statements
- **Files:** `loginController.js:22,34`, `podcastEntryController.js:134,155-158,166`
- **Problem:** Logs password hashes, JWT tokens, GCP credential paths, full request bodies
- **Fix:** Remove all sensitive logging, implement structured logger (winston or pino)

### Task #5 — Add Ownership Check to DELETE /users/:id
- **File:** `controller/usersController.js:117-126`
- **Problem:** Any authenticated user can delete any other user's account
- **Fix:** Add `if (req.user.id !== id) return res.status(403)` guard (same as GET and PUT)

---

## Phase 2: Stability Foundation [HIGH]

> Specialists: `/specialist validation-specialist` + `/specialist backend-engineer`
> **Makes the codebase safe to build features on.**

### Task #6 — Add Input Validation Middleware Using Zod
- **Files:** New `validations/schemas/` directory, modify all controllers
- **Problem:** No endpoint validates request bodies. POST /login crashes on empty body
- **Fix:** Install zod, create schemas for all endpoints, wire as middleware
- **Note:** `validations/userValidation.js` exists with regex patterns but is never imported

### Task #7 — Add Rate Limiting to Auth Endpoints
- **Files:** `app.js`, new rate limit config
- **Problem:** Brute force attacks and signup spam completely unmitigated
- **Fix:** Install express-rate-limit, apply to /login (5/15min) and /users POST (3/hour)

### Task #10 — Add Centralized Error Handling Middleware
- **Files:** `app.js`, new `middleware/errorHandler.js`, refactor all query files
- **Problem:** Some queries return error strings, others throw. Error formats inconsistent
- **Fix:** Global Express error handler, custom AppError class, standardize all query functions

### Task #15 — Remove Duplicate PostgreSQL Driver
- **File:** `package.json`
- **Problem:** Both `pg-promise` and `postgres` installed. Only `pg-promise` is used
- **Fix:** `npm uninstall postgres`

---

## Phase 3: Core Product — TTS & Audio [HIGH]

> Specialists: `/specialist backend-engineer` + `/specialist database-specialist`
> **This is where the product becomes a real podcast platform.**

### Task #14 — Edge TTS Migration & Provider Abstraction
- **See:** `docs/BLUEPRINT-edge-tts-migration.md` for full step-by-step
- **Summary:**
  1. Create `services/ttsProvider.js` — provider abstraction layer
  2. Install `msedge-tts`, remove `@google-cloud/text-to-speech` and `elevenlabs`
  3. Add `TTS_PROVIDER=edge` env var
  4. Rewrite `/audio` endpoint to use abstraction layer
  5. Add `/audio/conversation` multi-voice endpoint
  6. Clean up removed provider files
- **Cost impact:** $0.24/episode → $0.00/episode
- **Voices:** 1 hardcoded → 400+ available (3 preconfigured)

### Task #8 — Implement Audio Persistence with Cloud Storage
- **Files:** New `services/storageProvider.js`, modify podcast controller + queries
- **Problem:** Audio only persists per session, lost after re-login (known issue)
- **Fix:**
  1. Integrate cloud storage (Google Cloud Storage since GCP is already in stack, or S3)
  2. After TTS generates audio buffer, upload to storage
  3. Save permanent URL to `podcast_entries.audio_url`
  4. Add retrieval endpoint or serve via storage URL
- **Depends on:** Task #14 (TTS migration) for clean audio buffer output

### Task #9 — Implement Multi-Voice TTS Architecture
- **Files:** `services/ttsProvider.js`, `controller/podcastEntryController.js`
- **Problem:** Single voice — not suitable for podcast conversations
- **Fix:** Covered in Task #14 blueprint (Step 5: `/audio/conversation` endpoint)
- **Depends on:** Task #14 (provider abstraction) + Task #8 (audio storage)
- **Future enhancement:** Modify Gemini prompt to output speaker turns directly

---

## Phase 4: Feature Completion [MEDIUM]

> Specialists: `/specialist database-specialist` + `/specialist auth-specialist`
> **Polish the existing feature set.**

### Task #11 — Add Database Indexes and Schema Migrations
- **File:** `db/schema.sql`, new migration files
- **Fix:**
  1. Add index on `podcast_entries(user_id)`
  2. Add `updated_at` column to both tables (queries already reference it)
  3. Consider `status` column on podcast_entries (draft/published/archived)
  4. Set up migration tool (node-pg-migrate)

### Task #12 — Complete Dashboard Controller and Route
- **Files:** `controller/userDashboardController.js`, `app.js`
- **Problem:** Empty GET handler, wrong imports, broken middleware, route commented out
- **Fix:** Implement dashboard returning user profile + podcast stats + recent activity
- **Depends on:** Task #10 (error handling layer)

### Task #13 — Implement Token Refresh Mechanism
- **Files:** New `controller/refreshController.js`, modify login flow
- **Problem:** 30-min JWT expiry with no refresh — forces re-login, loses work
- **Fix:** Issue refresh token on login, add POST /login/refresh endpoint, token rotation

---

## Phase 5: Quality & Scale [LOW]

> Specialists: `/specialist debugger-tester` + `/specialist code-reviewer`
> **Production hardening.**

### Task #16 — Add Comprehensive Test Suite
- **New files:** `tests/` directory restructure, jest.config.js
- **Fix:** Install Jest + supertest, unit tests for queries, integration tests for endpoints
- **Depends on:** Tasks #1, #2, #5, #6, #10 (security + validation + error handling)

### Task #17 — Add Pagination to List Endpoints
- **Files:** Query functions, controllers
- **Fix:** Add page/limit query params, default 20 items, return total count
- **Depends on:** Task #11 (indexes)

### Task #18 — Fix Miscellaneous Code Quality Issues
- **Fix list:**
  - Typo "Unauthorized Userrr" in `usersController.js:104`
  - Uncommitted whitespace change in `loginController.js`
  - Empty `/save` endpoint in `podcastEntryController.js`
  - Incomplete Render deployment scripts (missing db import)
  - `output.mp3` checked into repo root
  - `.gitignore` missing log files, IDE configs, build output patterns

---

## Task Dependency Graph

```
Phase 1 (Security):        #1  #2  #3  #4  #5    ← No dependencies, do first
                            │   │       │   │
Phase 2 (Stability):       #6  #7  #10 #15        ← Can start in parallel
                                │   │
Phase 3 (Core Product):    #14 ─┤   │
                            │   │   │
                           #8 ──┤   │
                            │   │   │
                           #9 ──┘   │
                                    │
Phase 4 (Features):        #11 #12──┘  #13
                            │
Phase 5 (Quality):         #16  #17  #18
```

---

## TTS Provider Comparison (for future reference)

### Free Options (No Account)
| Provider | Quality | Multi-Voice | Speed | Risk |
|----------|---------|-------------|-------|------|
| **Edge TTS** | Very Good | 400+ voices | Fast (cloud) | Unofficial API, could break |
| **Piper TTS** | Good | 100+ voices | Fast (local CPU) | Lower quality |
| **Kokoro TTS** | Very Good | Limited | Slow on CPU | Memory intensive |

### Paid Options (for production scaling)
| Provider | Cost/Episode | Quality | Best For |
|----------|-------------|---------|----------|
| **OpenAI TTS** | $0.23 | Very Good | Best value + steerability |
| **Inworld TTS** | $0.15 | Excellent (#1 ranked) | Best quality/price |
| **Google Chirp 3 HD** | $0.45 | Very Good | Already in GCP ecosystem |
| **ElevenLabs** | $2.70 + plan | Excellent | Premium voice cloning |

### Recommended Production Strategy
1. **Now:** Edge TTS (free, for development + MVP)
2. **Scale:** OpenAI TTS ($0.23/ep) or Inworld TTS ($0.15/ep) via the same abstraction layer
3. **Premium tier:** ElevenLabs for users who want voice cloning

The provider abstraction layer built in Task #14 makes switching = changing one env var.

---

## Environment Variables Reference

### Current (before changes)
```bash
PORT=4040
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
ELEVEN_API=your_elevenlabs_key
```

### After Phase 3
```bash
PORT=4040
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
TTS_PROVIDER=edge                    # 'edge' | 'openai' | 'elevenlabs'
# OPENAI_API_KEY=your_key            # Only if TTS_PROVIDER=openai
# ELEVEN_API=your_key                # Only if TTS_PROVIDER=elevenlabs
# STORAGE_BUCKET=your_bucket         # For audio persistence (Task #8)
```
