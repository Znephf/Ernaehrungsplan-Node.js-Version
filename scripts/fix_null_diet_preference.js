const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getDbConnection() {
    // Dynamically import to ensure it's available
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Missing database environment variables!');
        process.exit(1);
    }

    return mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

async function fixNullDietPreferences() {
    console.log('--- Starting Script to Fix NULL dietaryPreference in Recipes ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        console.log("Updating recipes where 'dietaryPreference' is NULL to 'vegetarian'...");

        const [result] = await pool.query(
            "UPDATE recipes SET dietaryPreference = 'vegetarian' WHERE dietaryPreference IS NULL"
        );

        if (result.affectedRows > 0) {
            console.log(`SUCCESS: ${result.affectedRows} recipes have been updated.`);
        } else {
            console.log('No recipes with NULL dietaryPreference found. No changes were made.');
        }

    } catch (error) {
        console.error('\n--- A CRITICAL SCRIPT ERROR OCCURRED ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

fixNullDietPreferences();
