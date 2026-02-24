const express = require('express');
const adminController = express.Router();
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getAdminByUsername, getAdminByEmail, createAdmin } = require('../queries/adminQueries');
const { AuthenticateToken, AuthenticateAdmin } = require('../validations/UserTokenAuth');
const { getAllUsers } = require('../queries/usersQueries');
const { validate, loginSchema, adminCreateSchema } = require('../validations/schemas');
const { loginLimiter } = require('../validations/rateLimiter');

adminController.use(express.json());

// Admin login — separate from user login
adminController.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    const { username, password } = req.body;
    const isEmail = username.includes('@');

    try {
        const admin = await (isEmail ? getAdminByEmail(username) : getAdminByUsername(username));

        if (!admin) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: admin.id, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );

        res.status(200).json({
            message: "Admin login successful",
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });
    } catch (error) {
        console.error("Admin login error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Create new admin — requires existing admin token
adminController.post('/create', AuthenticateToken, AuthenticateAdmin, validate(adminCreateSchema), async (req, res) => {
    const { username, password, email } = req.body;

    try {
        const newAdmin = await createAdmin(
            { username, password, email },
            req.user.id
        );

        res.status(201).json({
            message: "Admin created successfully",
            admin: newAdmin
        });
    } catch (error) {
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        console.error("Admin creation error:", error.message);
        res.status(500).json({ error: "Failed to create admin" });
    }
});

// Get all users — admin only
adminController.get('/users', AuthenticateToken, AuthenticateAdmin, async (req, res) => {
    try {
        const allUsers = await getAllUsers();
        if (allUsers.length === 0) {
            return res.status(404).json({ message: "No users found." });
        }
        res.status(200).json(allUsers);
    } catch (error) {
        console.error("Error fetching users:", error.message);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

module.exports = adminController;
