const app = require('./app');
const { db } = require('./db/dbConfig');
const bcrypt = require('bcrypt');

require('dotenv').config();

const PORT = process.env.PORT || 4040;

async function initDatabase() {
    try {
        await db.tx(async t => {
            await t.none(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    phone_number VARCHAR(15) DEFAULT NULL,
                    sex_at_birth VARCHAR(50) DEFAULT NULL,
                    gender_identity VARCHAR(100) DEFAULT NULL,
                    date_of_birth DATE DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await t.none(`
                CREATE TABLE IF NOT EXISTS admins (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by UUID DEFAULT NULL,
                    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
                )
            `);
            await t.none(`
                CREATE TABLE IF NOT EXISTS podcast_entries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    audio_url VARCHAR(255) NOT NULL,
                    script_content JSONB DEFAULT NULL,
                    user_id UUID NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            await t.none(`
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    role VARCHAR(10) NOT NULL DEFAULT 'user',
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await t.none(`CREATE INDEX IF NOT EXISTS idx_podcast_entries_user_id ON podcast_entries(user_id)`);
            await t.none(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`);
            await t.none(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
        });
        console.log('Database tables initialized');

        // Seed admin if ADMIN_* env vars are set and no admin exists yet
        const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
        if (ADMIN_USERNAME && ADMIN_PASSWORD && ADMIN_EMAIL) {
            const existingAdmin = await db.oneOrNone('SELECT id FROM admins LIMIT 1');
            if (!existingAdmin) {
                const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                await db.one(
                    `INSERT INTO admins (username, password, email) VALUES ($1, $2, $3) RETURNING id, username`,
                    [ADMIN_USERNAME, hashedPassword, ADMIN_EMAIL]
                );
                console.log('Admin account created');
            }
        }
    } catch (error) {
        console.error('Database initialization error:', error.message || error);
        if (error.detail) console.error('Detail:', error.detail);
        if (error.code) console.error('Code:', error.code);
    }
}

initDatabase().then(() => {
    app.listen(PORT, (err) => {
        if (err) {
            console.error(`Failed to start the server: ${err.message}`);
            process.exit(1);
        }
        console.log(`Server is running on port ${PORT}`);
    });
});
