const { db } = require('../db/dbConfig');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const getAdminByUsername = async (username) => {
    try {
        const admin = await db.oneOrNone("SELECT * FROM admins WHERE username = $1", [username]);
        return admin;
    } catch (error) {
        throw new Error(`Error fetching admin: ${error.message}`);
    }
};

const getAdminByEmail = async (email) => {
    try {
        const admin = await db.oneOrNone("SELECT * FROM admins WHERE email = $1", [email]);
        return admin;
    } catch (error) {
        throw new Error(`Error fetching admin: ${error.message}`);
    }
};

const createAdmin = async (adminData, createdById) => {
    if (!adminData.username || !adminData.password || !adminData.email) {
        throw new Error("Missing required fields: username, password, email");
    }

    try {
        const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

        const newAdmin = await db.one(
            `INSERT INTO admins (username, password, email, created_by)
             VALUES ($1, $2, $3, $4) RETURNING id, username, email, created_at, created_by`,
            [adminData.username, hashedPassword, adminData.email, createdById || null]
        );
        return newAdmin;
    } catch (error) {
        if (error.code === '23505') {
            if (error.constraint === 'admins_username_key') {
                throw new Error('Admin username already exists');
            } else if (error.constraint === 'admins_email_key') {
                throw new Error('Admin email already exists');
            }
        }
        throw error;
    }
};

module.exports = { getAdminByUsername, getAdminByEmail, createAdmin };
