const express = require('express');
const loginController = express.Router();
require('dotenv').config();

const bcrypt = require('bcrypt');
const { getUserByUsername, getUserByEmail } = require('../queries/loginQueries');
const { validate, loginSchema } = require('../validations/schemas');
const { loginLimiter } = require('../validations/rateLimiter');
const { generateAccessToken, generateRefreshToken } = require('../validations/tokenUtils');

loginController.use(express.json());

loginController.post('/', loginLimiter, validate(loginSchema), async (req, res) => {
    const { username, password } = req.body;
    const isEmail = username.includes('@');

    try {
        const getUser = await (isEmail ? getUserByEmail(username) : getUserByUsername(username));

        if (!getUser) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordPass = await bcrypt.compare(password, getUser.password);

        if (!passwordPass) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = generateAccessToken({ id: getUser.id, role: 'user' });
        const refreshToken = await generateRefreshToken(getUser.id, 'user');

        res.status(200).json({
            message: "Login successful",
            token,
            refreshToken,
            user: {
                id: getUser.id,
                firstName: getUser.first_name,
                lastName: getUser.last_name
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
})

 module.exports = loginController;