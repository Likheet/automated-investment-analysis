// backend/db.js
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Log environment variables for debugging (REMOVE IN PRODUCTION)
console.log('Environment Variables Check:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

// Ensure password is explicitly a string
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD), // Force as string
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

console.log('DB Config (without password):', { 
    ...dbConfig, 
    password: '[REDACTED]' 
});

const pool = new Pool(dbConfig);

pool.connect()
    .then(client => { 
        console.log('DB Pool connected successfully.'); 
        client.release(); 
    })
    .catch(err => {
        console.error('CRITICAL: Failed to connect DB Pool:', err.message);
        console.error('Connection details issue - check your .env file values and database availability');
    });
   
const runSchemaUpdate = async () => {
    const schemaUpdateQuery = `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NULL,
        ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NULL;

        ALTER TABLE users
        ALTER COLUMN password_hash DROP NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
    `;

    try {
        const client = await pool.connect();
        await client.query(schemaUpdateQuery);
        console.log('Schema updated successfully.');
        client.release();
    } catch (err) {
        console.error('Error updating schema:', err);
    }
};

// Run the schema update when the file is executed directly
if (require.main === module) {
    runSchemaUpdate();
}

module.exports = pool;