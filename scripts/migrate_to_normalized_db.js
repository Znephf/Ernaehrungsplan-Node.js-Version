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
        multipleStatements: true
    });
}

async function migrateToNormalizedDb() {
    console.log('--- Starting Database Normalization Migration ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // 1. Fetch all data from the old table
        const [oldPlans] = await pool.query("SELECT * FROM archived_plans");

        if (oldPlans.length === 0) {
            console.log('No plans found in `archived_plans` to migrate. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${oldPlans.length} plans to migrate.`);
        let totalRecipesMigrated = 0;
        let totalPlansMigrated = 0;
        let totalPlanEntriesMigrated = 0;

        for (const oldPlan of oldPlans) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const planData = JSON.parse(oldPlan.planData);
                const settings = JSON.parse(oldPlan.settings);

                if (!planData || !planData.recipes || !Array.isArray(planData.recipes)) {
                    console.warn(`Skipping plan ID ${oldPlan.id} due to invalid planData.`);
                    await connection.rollback();
                    continue;
                }

                // 2. Insert the plan into the new `plans` table
                const [planResult] = await connection.query(
                    `INSERT INTO plans (name, createdAt, settings, shareId, legacy_id) VALUES (?, ?, ?, ?, ?)`,
                    [oldPlan.name, oldPlan.createdAt, JSON.stringify(settings), oldPlan.shareId, oldPlan.id]
                );
                const newPlanId = planResult.insertId;
                totalPlansMigrated++;

                // 3. Process each recipe in the plan
                for (const recipe of planData.recipes) {
                    // All old recipes were dinners.
                    const recipeCategory = 'dinner';
                    
                    // 4. Insert or update the recipe in the new `recipes` table
                    // We use the title as a unique identifier to avoid duplicates.
                    await connection.query(
                        `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category, image_url) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            ingredients=VALUES(ingredients), instructions=VALUES(instructions), totalCalories=VALUES(totalCalories),
                            protein=VALUES(protein), carbs=VALUES(carbs), fat=VALUES(fat), category=VALUES(category), image_url=COALESCE(image_url, VALUES(image_url))`,
                        [
                            recipe.title,
                            JSON.stringify(recipe.ingredients || []),
                            JSON.stringify(recipe.instructions || []),
                            recipe.totalCalories || 0,
                            recipe.protein || 0,
                            recipe.carbs || 0,
                            recipe.fat || 0,
                            recipeCategory,
                            planData.imageUrls ? planData.imageUrls[recipe.day] : null
                        ]
                    );

                    // 5. Get the ID of the inserted/updated recipe
                    const [[{ id: newRecipeId }]] = await connection.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]);
                    if (newRecipeId) {
                         // 6. Create the link in the junction table
                        await connection.query(
                            'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                            [newPlanId, newRecipeId, recipe.day, recipeCategory]
                        );
                        totalPlanEntriesMigrated++;
                    } else {
                        throw new Error(`Could not find recipe ID for title: ${recipe.title}`);
                    }
                }

                await connection.commit();
                console.log(`  -> Successfully migrated legacy plan ID ${oldPlan.id} to new plan ID ${newPlanId}.`);

            } catch (err) {
                await connection.rollback();
                console.error(`  - FAILED to migrate legacy plan ID ${oldPlan.id}:`, err.message);
            } finally {
                connection.release();
            }
        }
        
        console.log(`\n--- Renaming old table ---`);
        console.log('Renaming `archived_plans` to `legacy_archived_plans` for backup purposes.');
        await pool.query('RENAME TABLE archived_plans TO legacy_archived_plans;');
        console.log('Table renamed successfully.');


        console.log(`\n--- Migration Complete ---`);
        console.log(`Total plans migrated: ${totalPlansMigrated}`);
        console.log(`Total plan-recipe entries created: ${totalPlanEntriesMigrated}`);

    } catch (error) {
        console.error('\n--- A CRITICAL ERROR OCCURRED ---');
        console.error(error.message);
        console.error('Migration failed. Please check your database credentials and ensure it is running.');
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

migrateToNormalizedDb();
