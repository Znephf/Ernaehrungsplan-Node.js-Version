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
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });
}

async function migrateFromLegacy() {
    console.log('--- Starting Data Migration from `legacy_archived_plans` ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // Check if legacy table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'legacy_archived_plans'");
        if (tables.length === 0) {
            console.log('`legacy_archived_plans` table not found. No migration needed. Exiting.');
            await pool.end();
            return;
        }

        // 1. Fetch all data from the legacy table
        const [legacyPlans] = await pool.query("SELECT * FROM legacy_archived_plans");

        if (legacyPlans.length === 0) {
            console.log('No plans found in `legacy_archived_plans` to migrate. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${legacyPlans.length} legacy plans to process.`);
        let totalPlansMigrated = 0;
        let totalPlanEntriesMigrated = 0;

        for (const legacyPlan of legacyPlans) {
            const connection = await pool.getConnection();
            try {
                // 2. Check if this plan was already migrated
                const [existing] = await connection.query('SELECT id FROM plans WHERE legacy_id = ?', [legacyPlan.id]);
                if (existing.length > 0) {
                    console.log(`  - Skipping legacy plan ID ${legacyPlan.id}, already migrated to new plan ID ${existing[0].id}.`);
                    continue;
                }

                await connection.beginTransaction();

                const planData = JSON.parse(legacyPlan.planData);
                const settings = JSON.parse(legacyPlan.settings);

                if (!planData || !planData.weeklyPlan || !Array.isArray(planData.weeklyPlan)) {
                    console.warn(`Skipping plan ID ${legacyPlan.id} due to invalid or missing weeklyPlan data.`);
                    await connection.rollback();
                    continue;
                }

                // 3. Insert the plan into the new `plans` table
                const [planResult] = await connection.query(
                    `INSERT INTO plans (name, createdAt, settings, shareId, legacy_id) VALUES (?, ?, ?, ?, ?)`,
                    [legacyPlan.name, legacyPlan.createdAt, JSON.stringify(settings), legacyPlan.shareId, legacyPlan.id]
                );
                const newPlanId = planResult.insertId;
                
                // 4. Process each day and meal from the weeklyPlan
                for (const dayPlan of planData.weeklyPlan) {
                    if (!dayPlan.meals || !Array.isArray(dayPlan.meals)) continue;

                    for (const meal of dayPlan.meals) {
                        const { recipe, mealType } = meal;
                        if (!recipe || !recipe.title || !mealType) continue;

                        // Determine image URL (only dinners had images in the old structure)
                        const imageUrl = (mealType === 'dinner' && planData.imageUrls) ? planData.imageUrls[dayPlan.day] : null;

                        // 5. Insert or update the recipe in the new `recipes` table
                        await connection.query(
                            `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category, image_url) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE 
                                image_url=COALESCE(image_url, VALUES(image_url))`, // Only update image if it's null
                            [
                                recipe.title, JSON.stringify(recipe.ingredients || []), JSON.stringify(recipe.instructions || []),
                                recipe.totalCalories || 0, recipe.protein || null, recipe.carbs || null, recipe.fat || null,
                                recipe.category || mealType, imageUrl
                            ]
                        );

                        // 6. Get the ID of the recipe
                        const [[{ id: newRecipeId }]] = await connection.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]);

                        // 7. Create the link in the junction table
                        await connection.query(
                            'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                            [newPlanId, newRecipeId, dayPlan.day, mealType]
                        );
                        totalPlanEntriesMigrated++;
                    }
                }

                await connection.commit();
                totalPlansMigrated++;
                console.log(`  -> Successfully migrated legacy plan ID ${legacyPlan.id} to new plan ID ${newPlanId}.`);

            } catch (err) {
                await connection.rollback();
                console.error(`  - FAILED to migrate legacy plan ID ${legacyPlan.id}:`, err.message);
                console.error(err.stack);
            } finally {
                connection.release();
            }
        }
        
        console.log(`\n--- Migration Complete ---`);
        console.log(`Total new plans created: ${totalPlansMigrated}`);
        console.log(`Total meal entries created: ${totalPlanEntriesMigrated}`);

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

migrateFromLegacy();