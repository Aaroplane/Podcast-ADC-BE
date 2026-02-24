const express = require('express');
const userController = express.Router();
const cors = require('cors');
const {
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require('../queries/usersQueries');
const { AuthenticateToken } = require('../validations/UserTokenAuth');
const jwt = require('jsonwebtoken');

userController.use(express.json());
userController.use(cors());

userController.get('/:id', AuthenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.id !== id) {
            return res.status(403).json({ error: "Unauthorized User" });
        }
        const userById = await getUserById(id);

        if (!userById || userById.length === 0) {
            return res.status(404).json({ error: `No user found with ID: ${id}.` });
        }

        return res.status(200).json(userById);
    } catch (error) {
        console.error("Error retrieving user:", error.message);
        res.status(500).json({ error: "Error retrieving user by ID" });
    }
});

userController.post('/', async (req, res) => {
    try {
        const addingUser = await createUser(req.body);

        const token = jwt.sign(
            { id: addingUser.id, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: "30m" }
        );

        return res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: addingUser.id,
                username: addingUser.username,
                firstName: addingUser.first_name,
                lastName: addingUser.last_name
            }
        });
    } catch (error) {
        if (error.message && error.message.includes('Missing required fields') ||
            error.message && error.message.includes('User data is required')) {
            return res.status(400).json({ error: error.message });
        }

        if (error.message && error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        return res.status(500).json({ error: "Unable to process information!" });
    }
});

userController.put('/:id', AuthenticateToken, async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: "Missing user ID in request!" });
    }
    if (req.user.id !== id) {
        return res.status(403).json({ error: "Unauthorized User" });
    }

    try {
        const updatedUser = await updateUser(id, req.body);
        return res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Update error:", error.message);
        return res.status(500).json({ error: `Error updating user: ${error.message}` });
    }
});

userController.delete('/:id', AuthenticateToken, async (req, res) => {
    const { id } = req.params;

    if (req.user.id !== id) {
        return res.status(403).json({ error: "Unauthorized User" });
    }

    try {
        const removingUser = await deleteUser(id);
        return res.status(200).json(removingUser);
    } catch (error) {
        res.status(500).json({ error: "Error deleting user" });
    }
});

module.exports = userController;
