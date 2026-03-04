const pgp = require('pg-promise')()
require('dotenv').config()

const isRender = process.env.RENDER === 'true' || process.env.PG_HOST?.includes('render.com');

const cn = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    }
    : {
        host: process.env.PG_HOST,
        port: process.env.PG_PORT,
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        ssl: isRender ? { rejectUnauthorized: false } : false
    }

const db = pgp(cn)

module.exports = { db }
