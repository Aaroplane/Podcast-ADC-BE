const { db } = require("../db/dbConfig");

const getUserByUsername = async (username) => {
    try {
        const user = await db.oneOrNone("SELECT * FROM users WHERE username = $1", [username]);
        return user;
    } catch (error) {
        throw new Error(`Error fetching user by username: ${error.message}`);
    }
};

const getUserByEmail = async (email) => {
    try {
        const user = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [email]);
        return user;
    } catch (error) {
        throw new Error(`Error fetching user by email: ${error.message}`);
    }
};

module.exports = { getUserByUsername, getUserByEmail };