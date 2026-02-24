/**
 * Seeds the initial admin account from environment variables.
 *
 * Required .env variables:
 *   ADMIN_USERNAME=your_admin_username
 *   ADMIN_PASSWORD=your_secure_password
 *   ADMIN_EMAIL=your_admin_email
 *
 * Usage: node scripts/seedAdmin.js
 *
 * Safe to run multiple times — skips if an admin already exists.
 * Credentials come from .env (which is in .gitignore) so nothing is exposed in the repo.
 */

require('dotenv').config();
const { db } = require('../db/dbConfig');
const bcrypt = require('bcrypt');

const saltRounds = 10;

async function seedAdmin() {
    try {
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;
        const email = process.env.ADMIN_EMAIL;

        if (!username || !password || !email) {
            console.error('Missing required environment variables: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL');
            process.exit(1);
        }

        // Check if any admin already exists
        const existingAdmin = await db.oneOrNone('SELECT id FROM admins LIMIT 1');

        if (existingAdmin) {
            console.log('Admin account already exists. Skipping seed.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const admin = await db.one(
            `INSERT INTO admins (username, password, email, created_by)
             VALUES ($1, $2, $3, NULL) RETURNING id, username, email`,
            [username, hashedPassword, email]
        );

        console.log(`Admin account created: ${admin.username} (${admin.id})`);
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed admin:', error.message);
        process.exit(1);
    }
}

seedAdmin();
