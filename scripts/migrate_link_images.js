
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getDbConnection() {
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Missing database environment variables!');
        process.exit(1);
    }

    return mysql.createPool({
        host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, port: DB_PORT || 3306,
        waitForConnections: true, connectionLimit: 10, queueLimit: 0
    });
}

async function migrateLegacyImagesToNewTable() {
    console.log('--- Starting Migration: Link Legacy Images to New Table ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        const [tables] = await pool.query("SHOW TABLES LIKE 'legacy_archived_plans'");
        if (tables.length === 0) {
            console.log('Table `legacy_archived_plans` not found. No legacy images to migrate. Exiting.');
            await pool.end();
            return;
        }

        const [legacyPlans] = await pool.query("SELECT planData FROM legacy_archived_plans");
        if (legacyPlans.length === 0) {
            console.log('No plans found in `legacy_archived_plans` table. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${legacyPlans.length} legacy plans to scan for images.`);
        let totalImagesLinked = 0;

        for (const plan of legacyPlans) {
            try {
                const planData = JSON.parse(plan.planData);
                if (!planData.imageUrls || typeof planData.imageUrls !== 'object' || !planData.recipes || !Array.isArray(planData.recipes)) {
                    continue; // Skip if no images or recipes
                }

                for (const day in planData.imageUrls) {
                    const imageUrl = planData.imageUrls[day];
                    const recipeForDay = planData.recipes.find(r => r.day === day);

                    if (recipeForDay && recipeForDay.title && typeof imageUrl === 'string') {
                        // Insert or update the link in the new `recipe_images` table
                        const [result] = await pool.query(
                            'INSERT INTO recipe_images (recipe_title, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)',
                            [recipeForDay.title, imageUrl]
                        );

                        if (result.affectedRows > 0) {
                            console.log(`  -> Linked image for "${recipeForDay.title}"`);
                            totalImagesLinked++;
                        }
                    }
                }
            } catch (e) {
                console.warn(`Could not parse planData for a legacy plan. Skipping. Error: ${e.message}`);
            }
        }

        console.log(`\n--- Migration Complete ---`);
        console.log(`Total images linked or updated: ${totalImagesLinked}`);

    } catch (error) {
        console.error('\n--- A CRITICAL ERROR OCCURRED ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

migrateLegacyImagesToNewTable();
