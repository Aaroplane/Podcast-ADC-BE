/**
 * Comprehensive Regression + E2E Test Suite
 * Tests every endpoint, auth enforcement, validation, ownership checks, and full user flows.
 *
 * Usage: Start the server first, then run:
 *   node tests/regressionTest.js
 */

require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 4040;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];
const issues = [];

// ============================================
// HTTP Helper
// ============================================
function request(method, path, body = null, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch { parsed = data; }
                resolve({ status: res.statusCode, body: parsed, headers: res.headers });
            });
        });

        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve({ status: null, body: null, headers: {}, timedOut: true });
        });

        req.on('error', (err) => {
            if (err.code === 'ECONNRESET') {
                resolve({ status: null, body: null, headers: {}, timedOut: true });
            } else {
                reject(err);
            }
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function test(name, status, expected, actual, category) {
    if (status) {
        passed++;
        results.push({ name, status: 'PASS', category });
    } else {
        failed++;
        results.push({ name, status: 'FAIL', category, expected, actual });
    }
}

function skip(name, reason, category) {
    skipped++;
    results.push({ name, status: 'SKIP', category, reason });
}

function issue(severity, title, detail) {
    issues.push({ severity, title, detail });
}

// ============================================
// Test Data
// ============================================
const testUser = {
    first_name: 'Test',
    last_name: 'Runner',
    username: `testrunner_${Date.now()}`,
    password: 'TestPass123',
    email: `testrunner_${Date.now()}@test.com`
};

const testUser2 = {
    first_name: 'Other',
    last_name: 'User',
    username: `otheruser_${Date.now()}`,
    password: 'OtherPass456',
    email: `otheruser_${Date.now()}@test.com`
};

// ============================================
// Test Suite
// ============================================
async function runTests() {
    console.log('='.repeat(60));
    console.log('  CHIT CHAT PODCAST — REGRESSION + E2E TEST SUITE');
    console.log('='.repeat(60));
    console.log();

    // ------------------------------------------
    // 1. SERVER HEALTH
    // ------------------------------------------
    console.log('--- 1. SERVER HEALTH ---');

    try {
        const res = await request('GET', '/');
        test('GET / returns 200', res.status === 200, 200, res.status, 'Health');
    } catch (err) {
        console.error('SERVER NOT RUNNING. Start with: npm start');
        process.exit(1);
    }

    {
        const res = await request('GET', '/nonexistent-path');
        test('GET /unknown returns 404 JSON', res.status === 404 && res.body.error, '404 + JSON error', `${res.status}`, 'Health');
    }

    // ------------------------------------------
    // 2. USER SIGNUP (POST /users)
    // ------------------------------------------
    console.log('--- 2. USER SIGNUP ---');

    let userToken = null;
    let userId = null;
    let user2Token = null;
    let user2Id = null;

    // Valid signup
    {
        const res = await request('POST', '/users', testUser);
        test('POST /users — valid signup returns 201',
            res.status === 201 && res.body.token && res.body.user,
            '201 + token + user', `${res.status}`, 'Signup');

        if (res.status === 201) {
            userToken = res.body.token;
            userId = res.body.user.id;
            test('Signup response includes firstName/lastName',
                res.body.user.firstName && res.body.user.lastName,
                'firstName + lastName present', JSON.stringify(res.body.user), 'Signup');
            test('Signup response does NOT include password',
                !res.body.user.password,
                'no password field', JSON.stringify(Object.keys(res.body.user)), 'Signup');
        }
    }

    // Duplicate username
    {
        const res = await request('POST', '/users', testUser);
        test('POST /users — duplicate username returns 409',
            res.status === 409, 409, res.status, 'Signup');
    }

    // Missing fields
    {
        const res = await request('POST', '/users', { username: 'x' });
        test('POST /users — missing fields returns 400',
            res.status === 400 && res.body.error, '400 + validation error', `${res.status}`, 'Signup');
    }

    // Invalid email format
    {
        const res = await request('POST', '/users', {
            ...testUser, username: 'unique1_' + Date.now(), email: 'not-an-email'
        });
        test('POST /users — invalid email returns 400',
            res.status === 400, 400, res.status, 'Signup');
    }

    // Weak password
    {
        const res = await request('POST', '/users', {
            ...testUser, username: 'unique2_' + Date.now(), email: `unique2_${Date.now()}@test.com`, password: '123'
        });
        test('POST /users — weak password returns 400',
            res.status === 400, 400, res.status, 'Signup');
    }

    // Create second user for ownership tests
    {
        const res = await request('POST', '/users', testUser2);
        if (res.status === 201) {
            user2Token = res.body.token;
            user2Id = res.body.user.id;
        }
    }

    // ------------------------------------------
    // 3. USER LOGIN (POST /login)
    // ------------------------------------------
    console.log('--- 3. USER LOGIN ---');

    // Login with username
    {
        const res = await request('POST', '/login', { username: testUser.username, password: testUser.password });
        test('POST /login — valid username login returns 200',
            res.status === 200 && res.body.token, '200 + token', `${res.status}`, 'Login');

        if (res.status === 200) {
            userToken = res.body.token; // refresh token
            test('Login response includes user id + name',
                res.body.user && res.body.user.id && res.body.user.firstName,
                'user object present', JSON.stringify(res.body.user), 'Login');
            test('Login response does NOT include password',
                !res.body.user.password,
                'no password field', JSON.stringify(Object.keys(res.body.user || {})), 'Login');
        }
    }

    // Login with email
    {
        const res = await request('POST', '/login', { username: testUser.email, password: testUser.password });
        test('POST /login — valid email login returns 200',
            res.status === 200 && res.body.token, '200 + token', `${res.status}`, 'Login');
    }

    // Wrong password
    {
        const res = await request('POST', '/login', { username: testUser.username, password: 'WrongPass999' });
        test('POST /login — wrong password returns 401',
            res.status === 401, 401, res.status, 'Login');
        test('POST /login — wrong password gives generic error (no user enumeration)',
            res.body.error === 'Invalid credentials',
            'Invalid credentials', res.body.error, 'Login');
    }

    // Non-existent user
    {
        const res = await request('POST', '/login', { username: 'nobody_here_999', password: 'SomePass123' });
        test('POST /login — non-existent user returns 401 (not 500)',
            res.status === 401, 401, res.status, 'Login');
    }

    // Missing fields
    {
        const res = await request('POST', '/login', {});
        test('POST /login — empty body returns 400',
            res.status === 400, 400, res.status, 'Login');
    }

    // ------------------------------------------
    // 4. AUTH ENFORCEMENT
    // ------------------------------------------
    console.log('--- 4. AUTH ENFORCEMENT ---');

    // No token
    {
        const res = await request('GET', `/users/${userId}`);
        test('GET /users/:id — no token returns 401',
            res.status === 401, 401, res.status, 'Auth');
    }

    // Invalid token
    {
        const res = await request('GET', `/users/${userId}`, null, { Authorization: 'Bearer invalid.token.here' });
        test('GET /users/:id — invalid token returns 403',
            res.status === 403, 403, res.status, 'Auth');
    }

    // ------------------------------------------
    // 5. USER CRUD (GET/PUT/DELETE /users/:id)
    // ------------------------------------------
    console.log('--- 5. USER CRUD ---');

    const authHeader = { Authorization: `Bearer ${userToken}` };
    const auth2Header = { Authorization: `Bearer ${user2Token}` };

    // Get own user
    {
        const res = await request('GET', `/users/${userId}`, null, authHeader);
        test('GET /users/:id — own user returns 200',
            res.status === 200, 200, res.status, 'UserCRUD');

        if (res.status === 200) {
            test('GET /users/:id — returns user data with id',
                res.body.id === userId,
                userId, res.body.id, 'UserCRUD');
        }
    }

    // Get another user's data (should be forbidden)
    if (user2Id) {
        const res = await request('GET', `/users/${user2Id}`, null, authHeader);
        test('GET /users/:id — other user returns 403',
            res.status === 403, 403, res.status, 'UserCRUD');
    }

    // Update own user
    {
        const res = await request('PUT', `/users/${userId}`, {
            first_name: 'Updated',
            last_name: 'Runner',
            username: testUser.username,
            password: 'NewPass456',
            email: testUser.email
        }, authHeader);
        test('PUT /users/:id — update own user returns 200',
            res.status === 200, 200, res.status, 'UserCRUD');

        // Verify password was actually hashed (not stored plaintext)
        if (res.status === 200 && res.body.password) {
            test('PUT /users/:id — updated password is hashed (starts with $2b$)',
                res.body.password.startsWith('$2b$'),
                '$2b$ prefix', res.body.password.substring(0, 4), 'UserCRUD');
        }
    }

    // Login with new password to confirm update
    {
        const res = await request('POST', '/login', { username: testUser.username, password: 'NewPass456' });
        test('POST /login — login with updated password works',
            res.status === 200, 200, res.status, 'UserCRUD');
        if (res.status === 200) {
            userToken = res.body.token;
        }
    }

    // Update another user (should be forbidden)
    if (user2Id) {
        const res = await request('PUT', `/users/${user2Id}`, { first_name: 'Hacked' }, authHeader);
        test('PUT /users/:id — update other user returns 403',
            res.status === 403, 403, res.status, 'UserCRUD');
    }

    // ------------------------------------------
    // 6. PODCAST ENTRIES CRUD
    // ------------------------------------------
    console.log('--- 6. PODCAST ENTRIES ---');

    const refreshAuth = { Authorization: `Bearer ${userToken}` };
    let entryId = null;

    // Create entry
    {
        const res = await request('POST', `/users/${userId}/podcastentries`, {
            title: 'Test Podcast',
            description: 'A test entry',
            audio_url: 'https://example.com/test.mp3'
        }, refreshAuth);
        test('POST /entries — create entry returns 201',
            res.status === 201, 201, res.status, 'Entries');

        if (res.status === 201) {
            entryId = res.body.id;
            test('Created entry has correct title',
                res.body.title === 'Test Podcast',
                'Test Podcast', res.body.title, 'Entries');
            test('Created entry has user_id',
                res.body.user_id === userId,
                userId, res.body.user_id, 'Entries');
        }
    }

    // Create entry — missing title (validation)
    {
        const res = await request('POST', `/users/${userId}/podcastentries`, {
            description: 'No title'
        }, refreshAuth);
        test('POST /entries — missing required fields returns 400',
            res.status === 400, 400, res.status, 'Entries');
    }

    // Create entry — no auth
    {
        const res = await request('POST', `/users/${userId}/podcastentries`, {
            title: 'No Auth', description: 'x', audio_url: 'http://x.com/a.mp3'
        });
        test('POST /entries — no token returns 401',
            res.status === 401, 401, res.status, 'Entries');
    }

    // Get all entries
    {
        const res = await request('GET', `/users/${userId}/podcastentries`, null, refreshAuth);
        test('GET /entries — returns 200 with array',
            res.status === 200 && Array.isArray(res.body),
            '200 + array', `${res.status}`, 'Entries');

        if (res.status === 200 && Array.isArray(res.body)) {
            test('GET /entries — array contains our entry',
                res.body.some(e => e.id === entryId),
                'entry found', 'not found', 'Entries');
        }
    }

    // Get specific entry
    if (entryId) {
        const res = await request('GET', `/users/${userId}/podcastentries/${entryId}`, null, refreshAuth);
        test('GET /entries/:id — returns 200',
            res.status === 200 && res.body.id === entryId,
            200, res.status, 'Entries');
    }

    // Update entry
    if (entryId) {
        const res = await request('PUT', `/users/${userId}/podcastentries/${entryId}`, {
            title: 'Updated Podcast',
            description: 'Updated desc',
            audio_url: 'https://example.com/updated.mp3'
        }, refreshAuth);
        test('PUT /entries/:id — update entry returns 200',
            res.status === 200, 200, res.status, 'Entries');
        if (res.status === 200 && res.body.updated_at) {
            test('PUT /entries/:id — updated_at is set',
                res.body.updated_at !== null,
                'updated_at present', res.body.updated_at, 'Entries');
        }
    }

    // Delete entry
    if (entryId) {
        const res = await request('DELETE', `/users/${userId}/podcastentries/${entryId}`, null, refreshAuth);
        test('DELETE /entries/:id — delete entry returns 200',
            res.status === 200, 200, res.status, 'Entries');
    }

    // Verify deletion
    if (entryId) {
        const res = await request('GET', `/users/${userId}/podcastentries/${entryId}`, null, refreshAuth);
        test('GET /entries/:id — deleted entry returns 404',
            res.status === 404, 404, res.status, 'Entries');
    }

    // ------------------------------------------
    // 7. ADMIN AUTH
    // ------------------------------------------
    console.log('--- 7. ADMIN AUTH ---');

    let adminToken = null;
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
        skip('Admin login', 'ADMIN_USERNAME/PASSWORD not in .env', 'Admin');
    } else {
        // Admin login
        {
            const res = await request('POST', '/admin/login', { username: adminUser, password: adminPass });
            test('POST /admin/login — valid admin login returns 200',
                res.status === 200 && res.body.token, '200 + token', `${res.status}`, 'Admin');

            if (res.status === 200) {
                adminToken = res.body.token;
                test('Admin login response includes admin object',
                    res.body.admin && res.body.admin.id,
                    'admin object', JSON.stringify(res.body.admin), 'Admin');
                test('Admin login does NOT include password',
                    !res.body.admin.password,
                    'no password', JSON.stringify(Object.keys(res.body.admin || {})), 'Admin');
            }
        }

        // Admin login — wrong password
        {
            const res = await request('POST', '/admin/login', { username: adminUser, password: 'WrongAdmin999' });
            test('POST /admin/login — wrong password returns 401',
                res.status === 401, 401, res.status, 'Admin');
        }

        // Admin login — non-existent admin
        {
            const res = await request('POST', '/admin/login', { username: 'fakeadmin999', password: 'SomePass123' });
            test('POST /admin/login — non-existent admin returns 401',
                res.status === 401, 401, res.status, 'Admin');
        }

        // Regular user token cannot access admin routes
        {
            const res = await request('GET', '/admin/users', null, { Authorization: `Bearer ${userToken}` });
            test('GET /admin/users — regular user token returns 403',
                res.status === 403, 403, res.status, 'Admin');
        }

        // No token on admin route
        {
            const res = await request('GET', '/admin/users', null);
            test('GET /admin/users — no token returns 401',
                res.status === 401, 401, res.status, 'Admin');
        }

        if (adminToken) {
            const adminAuth = { Authorization: `Bearer ${adminToken}` };

            // Get all users
            {
                const res = await request('GET', '/admin/users', null, adminAuth);
                test('GET /admin/users — admin returns 200 with users',
                    res.status === 200 && Array.isArray(res.body),
                    '200 + array', `${res.status}`, 'Admin');

                if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
                    const firstUser = res.body[0];
                    test('GET /admin/users — user objects do NOT contain password',
                        !firstUser.password,
                        'no password field', JSON.stringify(Object.keys(firstUser)), 'Admin');
                }
            }

            // Create admin — validation
            {
                const res = await request('POST', '/admin/create', { username: 'x' }, adminAuth);
                test('POST /admin/create — invalid body returns 400',
                    res.status === 400, 400, res.status, 'Admin');
            }

            // Create admin — no auth
            {
                const res = await request('POST', '/admin/create', {
                    username: 'hacker', password: 'HackPass123', email: 'hack@evil.com'
                });
                test('POST /admin/create — no token returns 401',
                    res.status === 401, 401, res.status, 'Admin');
            }

            // Create admin — regular user token
            {
                const res = await request('POST', '/admin/create', {
                    username: 'hacker2', password: 'HackPass123', email: 'hack2@evil.com'
                }, { Authorization: `Bearer ${userToken}` });
                test('POST /admin/create — regular user token returns 403',
                    res.status === 403, 403, res.status, 'Admin');
            }
        }
    }

    // ------------------------------------------
    // 8. SCRIPT GENERATION (POST /script)
    // ------------------------------------------
    console.log('--- 8. SCRIPT GENERATION ---');

    // Validation only — don't hit Gemini API (costs money / may not have key)
    {
        const res = await request('POST', `/users/${userId}/podcastentries/script`, {}, refreshAuth);
        test('POST /script — empty body returns 400 validation error',
            res.status === 400, 400, res.status, 'Script');
    }

    {
        const res = await request('POST', `/users/${userId}/podcastentries/script`, {
            podcastentry: 'x'.repeat(10001),
            mood: 'happy'
        }, refreshAuth);
        test('POST /script — text over 10K chars returns 400',
            res.status === 400, 400, res.status, 'Script');
    }

    {
        const res = await request('POST', `/users/${userId}/podcastentries/script`, {}, /* no auth */);
        test('POST /script — no auth returns 401',
            res.status === 401, 401, res.status, 'Script');
    }

    // ------------------------------------------
    // 9. AUDIO GENERATION (POST /audio)
    // ------------------------------------------
    console.log('--- 9. AUDIO GENERATION ---');

    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio`, {}, refreshAuth);
        test('POST /audio — empty body returns 400',
            res.status === 400, 400, res.status, 'Audio');
    }

    // New text field (Edge TTS)
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio`, {
            text: 'x'.repeat(5001)
        }, refreshAuth);
        test('POST /audio — text over 5K chars returns 400',
            res.status === 400, 400, res.status, 'Audio');
    }

    // Legacy googleCloudTTS field (backwards compat)
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio`, {
            googleCloudTTS: 'x'.repeat(5001)
        }, refreshAuth);
        test('POST /audio — legacy googleCloudTTS over 5K chars returns 400',
            res.status === 400, 400, res.status, 'Audio');
    }

    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio`, {}, /* no auth */);
        test('POST /audio — no auth returns 401',
            res.status === 401, 401, res.status, 'Audio');
    }

    // Voice selection with valid text
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio`, {
            text: 'Hello, this is a test with voice selection.',
            voice: 'invalid_voice_that_is_way_too_long_' + 'x'.repeat(100)
        }, refreshAuth);
        test('POST /audio — voice over 100 chars returns 400',
            res.status === 400, 400, res.status, 'Audio');
    }

    // ------------------------------------------
    // 9.5. SCRIPT SAVE/RETRIEVE
    // ------------------------------------------
    console.log('--- 9.5. SCRIPT SAVE/RETRIEVE ---');

    // Create a new entry for script testing
    let scriptEntryId = null;
    {
        const res = await request('POST', `/users/${userId}/podcastentries`, {
            title: 'Script Test Entry',
            description: 'Entry for script save tests',
            audio_url: 'https://example.com/script-test.mp3'
        }, refreshAuth);
        if (res.status === 201) {
            scriptEntryId = res.body.id;
        }
    }

    if (scriptEntryId) {
        // Save script — valid
        {
            const res = await request('PUT', `/users/${userId}/podcastentries/${scriptEntryId}/script`, {
                title: 'Test Podcast Title',
                description: 'A description',
                introduction: 'Welcome to the show',
                mainContent: 'Here is the main content of the podcast.',
                conclusion: 'Thanks for listening!'
            }, refreshAuth);
            test('PUT /script — save script returns 200',
                res.status === 200, 200, res.status, 'ScriptSave');
            if (res.status === 200) {
                test('PUT /script — response includes script_content',
                    res.body.script_content !== null && res.body.script_content !== undefined,
                    'script_content present', JSON.stringify(Object.keys(res.body)), 'ScriptSave');
            }
        }

        // Retrieve script
        {
            const res = await request('GET', `/users/${userId}/podcastentries/${scriptEntryId}/script`, null, refreshAuth);
            test('GET /script — retrieve script returns 200',
                res.status === 200, 200, res.status, 'ScriptSave');
            if (res.status === 200) {
                test('GET /script — returned script has correct title',
                    res.body.title === 'Test Podcast Title',
                    'Test Podcast Title', res.body.title, 'ScriptSave');
            }
        }

        // Save script — missing required fields
        {
            const res = await request('PUT', `/users/${userId}/podcastentries/${scriptEntryId}/script`, {
                title: 'Only title'
            }, refreshAuth);
            test('PUT /script — missing fields returns 400',
                res.status === 400, 400, res.status, 'ScriptSave');
        }

        // Save script — no auth
        {
            const res = await request('PUT', `/users/${userId}/podcastentries/${scriptEntryId}/script`, {
                title: 'No Auth',
                introduction: 'x',
                mainContent: 'x',
                conclusion: 'x'
            });
            test('PUT /script — no auth returns 401',
                res.status === 401, 401, res.status, 'ScriptSave');
        }

        // Retrieve script — no auth
        {
            const res = await request('GET', `/users/${userId}/podcastentries/${scriptEntryId}/script`);
            test('GET /script — no auth returns 401',
                res.status === 401, 401, res.status, 'ScriptSave');
        }

        // Retrieve script — wrong user (use user2's token on user1's entry)
        if (user2Token) {
            const res = await request('GET', `/users/${user2Id}/podcastentries/${scriptEntryId}/script`, null, auth2Header);
            test('GET /script — wrong user returns 404 (ownership)',
                res.status === 404, 404, res.status, 'ScriptSave');
        }

        // Clean up script test entry
        await request('DELETE', `/users/${userId}/podcastentries/${scriptEntryId}`, null, refreshAuth);
    } else {
        skip('Script save/retrieve tests', 'Could not create test entry', 'ScriptSave');
    }

    // Get script from non-existent entry
    {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await request('GET', `/users/${userId}/podcastentries/${fakeId}/script`, null, refreshAuth);
        test('GET /script — non-existent entry returns 404',
            res.status === 404, 404, res.status, 'ScriptSave');
    }

    // ------------------------------------------
    // 9.6. MULTI-VOICE CONVERSATION
    // ------------------------------------------
    console.log('--- 9.6. MULTI-VOICE CONVERSATION ---');

    // Validation — empty body
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {}, refreshAuth);
        test('POST /audio/conversation — empty body returns 400',
            res.status === 400, 400, res.status, 'Conversation');
    }

    // Validation — empty turns array
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {
            turns: []
        }, refreshAuth);
        test('POST /audio/conversation — empty turns returns 400',
            res.status === 400, 400, res.status, 'Conversation');
    }

    // Validation — turn missing text
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {
            turns: [{ speaker: 'host' }]
        }, refreshAuth);
        test('POST /audio/conversation — turn missing text returns 400',
            res.status === 400, 400, res.status, 'Conversation');
    }

    // Validation — turn missing speaker
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {
            turns: [{ text: 'Hello' }]
        }, refreshAuth);
        test('POST /audio/conversation — turn missing speaker returns 400',
            res.status === 400, 400, res.status, 'Conversation');
    }

    // No auth
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {
            turns: [{ speaker: 'host', text: 'Hello' }]
        });
        test('POST /audio/conversation — no auth returns 401',
            res.status === 401, 401, res.status, 'Conversation');
    }

    // Text too long
    {
        const res = await request('POST', `/users/${userId}/podcastentries/audio/conversation`, {
            turns: [{ speaker: 'host', text: 'x'.repeat(5001) }]
        }, refreshAuth);
        test('POST /audio/conversation — text over 5K returns 400',
            res.status === 400, 400, res.status, 'Conversation');
    }

    // ------------------------------------------
    // 9.7. TTS VOICES
    // ------------------------------------------
    console.log('--- 9.7. TTS VOICES ---');

    {
        const res = await request('GET', `/users/${userId}/podcastentries/audio/voices`, null, refreshAuth);
        test('GET /audio/voices — returns 200 with voices',
            res.status === 200, 200, res.status, 'Voices');
        if (res.status === 200) {
            test('GET /audio/voices — includes host voice',
                res.body.host !== undefined,
                'host present', JSON.stringify(Object.keys(res.body)), 'Voices');
            test('GET /audio/voices — includes cohost voice',
                res.body.cohost !== undefined,
                'cohost present', JSON.stringify(Object.keys(res.body)), 'Voices');
            test('GET /audio/voices — includes narrator voice',
                res.body.narrator !== undefined,
                'narrator present', JSON.stringify(Object.keys(res.body)), 'Voices');
        }
    }

    {
        const res = await request('GET', `/users/${userId}/podcastentries/audio/voices`);
        test('GET /audio/voices — no auth returns 401',
            res.status === 401, 401, res.status, 'Voices');
    }

    // ------------------------------------------
    // 10. EDGE CASES + ERROR HANDLING
    // ------------------------------------------
    console.log('--- 10. EDGE CASES ---');

    // Malformed JSON (we need raw http for this)
    {
        const res = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: PORT,
                path: '/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed;
                    try { parsed = JSON.parse(data); } catch { parsed = data; }
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on('error', reject);
            req.write('{bad json!!!');
            req.end();
        });
        test('Malformed JSON returns 400',
            res.status === 400, 400, res.status, 'EdgeCase');
    }

    // UUID that doesn't exist
    {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await request('GET', `/users/${fakeId}`, null, refreshAuth);
        test('GET /users/:id — non-existent UUID returns 403 (ownership check)',
            res.status === 403, 403, res.status, 'EdgeCase');
    }

    // POST /save — removed stub route, should now return 404
    {
        const res = await request('POST', `/users/${userId}/podcastentries/save`, {}, refreshAuth, 5000);
        test('POST /save — removed stub returns 404 (not hang)',
            res.status === 404, 404, res.status, 'EdgeCase');
    }

    // ------------------------------------------
    // 11. CLEANUP — Delete test users
    // ------------------------------------------
    console.log('--- 11. CLEANUP ---');

    // Refresh token after password change
    {
        const loginRes = await request('POST', '/login', { username: testUser.username, password: 'NewPass456' });
        if (loginRes.status === 200) {
            userToken = loginRes.body.token;
        }
    }

    // Delete user 1
    {
        const res = await request('DELETE', `/users/${userId}`, null, { Authorization: `Bearer ${userToken}` });
        test('DELETE /users/:id — delete own user returns 200',
            res.status === 200, 200, res.status, 'Cleanup');
    }

    // Delete user 2
    if (user2Token && user2Id) {
        const res = await request('DELETE', `/users/${user2Id}`, null, { Authorization: `Bearer ${user2Token}` });
        test('DELETE /users/:id — delete second user returns 200',
            res.status === 200, 200, res.status, 'Cleanup');
    }

    // Verify deletion — token should no longer work to get user
    {
        const res = await request('GET', `/users/${userId}`, null, { Authorization: `Bearer ${userToken}` });
        test('GET /users/:id — deleted user returns 404',
            res.status === 404 || res.status === 403, '404 or 403', res.status, 'Cleanup');
    }

    // ------------------------------------------
    // RESULTS
    // ------------------------------------------
    console.log('\n' + '='.repeat(60));
    console.log('  RESULTS');
    console.log('='.repeat(60));

    const categories = {};
    for (const r of results) {
        if (!categories[r.category]) categories[r.category] = [];
        categories[r.category].push(r);
    }

    for (const [cat, tests] of Object.entries(categories)) {
        console.log(`\n  [${cat}]`);
        for (const t of tests) {
            const icon = t.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' :
                         t.status === 'FAIL' ? '\x1b[31mFAIL\x1b[0m' :
                         '\x1b[33mSKIP\x1b[0m';
            console.log(`    ${icon}  ${t.name}`);
            if (t.status === 'FAIL') {
                console.log(`          Expected: ${t.expected}`);
                console.log(`          Actual:   ${t.actual}`);
            }
            if (t.status === 'SKIP') {
                console.log(`          Reason: ${t.reason}`);
            }
        }
    }

    if (issues.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('  ISSUES DISCOVERED DURING TESTING');
        console.log('='.repeat(60));
        for (const i of issues) {
            const color = i.severity === 'HIGH' ? '\x1b[31m' :
                          i.severity === 'MEDIUM' ? '\x1b[33m' : '\x1b[36m';
            console.log(`\n  ${color}[${i.severity}]\x1b[0m ${i.title}`);
            console.log(`    ${i.detail}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  TOTAL: ${passed + failed + skipped} | PASSED: \x1b[32m${passed}\x1b[0m | FAILED: \x1b[31m${failed}\x1b[0m | SKIPPED: \x1b[33m${skipped}\x1b[0m`);
    console.log('='.repeat(60));

    // Return structured results for the report generator
    return { passed, failed, skipped, results, issues };
}

runTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Test suite crashed:', err.message);
    process.exit(1);
});
