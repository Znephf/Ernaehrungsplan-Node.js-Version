const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamically import mysql2/promise
async function getDbConnection() {
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Missing one or more database environment variables.');
        process.exit(1);
    }

    return mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });
}

async function migrateImageData() {
    console.log('--- Starting migration from planData.imageUrls to recipe_images table ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // 1. Fetch all plans with imageUrls
        const [plans] = await pool.query("SELECT id, planData FROM archived_plans WHERE planData IS NOT NULL AND JSON_VALID(planData) AND JSON_UNQUOTE(JSON_EXTRACT(planData, '$.imageUrls')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(planData, '$.imageUrls')) != '{}'");
        
        if (plans.length === 0) {
            console.log('No plans with image URLs found to migrate. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${plans.length} plans with image data to process.`);
        let totalImagesMigrated = 0;
        const seenRecipeTitles = new Set();

        for (const plan of plans) {
            let planData;
            try {
                planData = JSON.parse(plan.planData);
            } catch (e) {
                console.error(`Could not parse planData for plan ID ${plan.id}. Skipping.`);
                continue;
            }

            const { imageUrls, recipes } = planData;
            if (!imageUrls || typeof imageUrls !== 'object' || !Array.isArray(recipes)) {
                continue;
            }

            const recipesByDay = recipes.reduce((acc, recipe) => {
                acc[recipe.day] = recipe;
                return acc;
            }, {});

            for (const day in imageUrls) {
                const imageUrl = imageUrls[day];
                const recipe = recipesByDay[day];

                if (recipe && recipe.title && imageUrl) {
                    const recipeTitle = recipe.title.trim();
                    if (seenRecipeTitles.has(recipeTitle)) {
                        // Avoid inserting duplicates from different plans for the same recipe
                        continue;
                    }
                    try {
                        // Use INSERT IGNORE to avoid errors on duplicate recipe titles
                        const [result] = await pool.query(
                            'INSERT IGNORE INTO recipe_images (recipeTitle, imageUrl) VALUES (?, ?)',
                            [recipeTitle, imageUrl]
                        );
                        if (result.affectedRows > 0) {
                            console.log(`  - Migrated image for recipe: "${recipeTitle}"`);
                            totalImagesMigrated++;
                            seenRecipeTitles.add(recipeTitle);
                        }
                    } catch (dbError) {
                        console.error(`  - FAILED to migrate image for "${recipeTitle}":`, dbError.message);
                    }
                }
            }
        }

        console.log(`\n--- Migration Complete ---`);
        console.log(`Total new images migrated to recipe_images table: ${totalImagesMigrated}`);

    } catch (error) {
        console.error('\n--- A CRITICAL ERROR OCCURRED DURING MIGRATION ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

migrateImageData();
