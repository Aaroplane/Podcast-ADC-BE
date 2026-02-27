const {db} = require('../db/dbConfig');
const bcrypt = require('bcrypt')
const saltRounds = 10

const getAllUsers = async () => {
    try {
        const allUsers = await db.any(
            "SELECT id, first_name, last_name, username, email, phone_number, created_at FROM users"
        );
        return allUsers;
    } catch (error) {
        throw new Error(`Error fetching all users: ${error.message}`);
    }
}
const getUserById = async (id) => {
    if (!id) {
        throw new Error("ID is required for user lookup.");
    }
    try {
        const userById = await db.oneOrNone("SELECT * FROM users WHERE id=$1", [id]);
        return userById;
    } catch (error) {
        throw new Error(`Error fetching user by ID ${id}: ${error.message}`);
    }
};

const createUser = async (userData) => {
    try {
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds)

        const newUser = await db.one(
            `INSERT INTO users (
            first_name, 
            last_name, 
            username, 
            password, 
            email
            ) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
               userData.first_name,
               userData.last_name,
               userData.username,
               hashedPassword,
               userData.email,
            ]
        );
        return newUser;

} catch (error) {
        console.error('Database error in createUser:', error);
        
        if (error.code === '23505') { 
            if (error.constraint === 'users_username_key') {
                throw new Error('Username already exists');
            } else if (error.constraint === 'users_email_key') {
                throw new Error('Email already exists');
            }
        }
            throw error;
    }
}

const updateUser = async (id, userData) => {
    try {
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, saltRounds);
        }

        const allowedFields = [
            'first_name', 'last_name', 'username', 'password', 'email',
            'phone_number', 'sex_at_birth', 'gender_identity', 'date_of_birth'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (userData[field] !== undefined) {
                setClauses.push(`${field}=$${paramIndex}`);
                values.push(userData[field]);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields provided for update');
        }

        values.push(id);
        const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id=$${paramIndex} RETURNING *`;
        const updatedUser = await db.one(query, values);
        return updatedUser;
    } catch (error) {
        throw new Error(`Error updating user with ID ${id}: ${error.message}`);
    }
}

const deleteUser = async (id) => {
    try {
        const deletedUser = await db.one(
            'DELETE FROM users WHERE id=$1 RETURNING *',
            [id]
        );
        return deletedUser;
    } catch (error) {
        throw new Error(`Error deleting user with ID ${id}: ${error.message}`);
    }
}





module.exports = {
    getAllUsers, 
    getUserById, 
    createUser , 
    updateUser, 
    deleteUser
};