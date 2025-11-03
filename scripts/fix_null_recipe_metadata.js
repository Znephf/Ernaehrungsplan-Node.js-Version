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

async function fixNullRecipeMetadata() {
    console.log('--- Starting Script to Fix NULL Metadata in Recipes ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        console.log("1. Updating recipes where 'dietType' is NULL to 'low-carb'...");
        const [dietTypeResult] = await pool.query(
            "UPDATE recipes SET dietType = 'low-carb' WHERE dietType IS NULL"
        );
        console.log(`   -> ${dietTypeResult.affectedRows} recipes updated.`);

        console.log("\n2. Updating recipes where 'dishComplexity' is NULL to 'simple'...");
        const [complexityResult] = await pool.query(
            "UPDATE recipes SET dishComplexity = 'simple' WHERE dishComplexity IS NULL"
        );
        console.log(`   -> ${complexityResult.affectedRows} recipes updated.`);

        console.log("\n3. Updating recipes where 'isGlutenFree' is NULL to 0 (false)...");
        const [glutenResult] = await pool.query(
            "UPDATE recipes SET isGlutenFree = 0 WHERE isGlutenFree IS NULL"
        );
        console.log(`   -> ${glutenResult.affectedRows} recipes updated.`);

        console.log("\n4. Updating recipes where 'isLactoseFree' is NULL to 0 (false)...");
        const [lactoseResult] = await pool.query(
            "UPDATE recipes SET isLactoseFree = 0 WHERE isLactoseFree IS NULL"
        );
        console.log(`   -> ${lactoseResult.affectedRows} recipes updated.`);

        const totalAffected = dietTypeResult.affectedRows + complexityResult.affectedRows + glutenResult.affectedRows + lactoseResult.affectedRows;

        if (totalAffected > 0) {
            console.log('\nSUCCESS: Recipe metadata has been updated.');
        } else {
            console.log('\nNo recipes with NULL metadata fields found. No changes were made.');
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

fixNullRecipeMetadata();