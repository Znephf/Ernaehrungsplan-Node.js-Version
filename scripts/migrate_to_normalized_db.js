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

async function migrateToNormalizedDb() {
    console.log('--- Starting Database Normalization Migration ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // Step 1: Determine which legacy table to use
        let legacyTableName = '';
        const [legacyTable] = await pool.query("SHOW TABLES LIKE 'legacy_archived_plans'");
        const [originalTable] = await pool.query("SHOW TABLES LIKE 'archived_plans'");

        if (legacyTable.length > 0) {
            legacyTableName = 'legacy_archived_plans';
            console.log('Found `legacy_archived_plans`. Migrating/checking from this table.');
        } else if (originalTable.length > 0) {
            legacyTableName = 'archived_plans';
            console.log('Found `archived_plans`. Migrating from this table.');
        } else {
            console.log('No legacy table (`archived_plans` or `legacy_archived_plans`) found. Exiting.');
            await pool.end();
            return;
        }

        const [oldPlans] = await pool.query(`SELECT * FROM ${legacyTableName}`);

        if (oldPlans.length === 0) {
            console.log(`No plans found in \`${legacyTableName}\` to migrate. Exiting.`);
            await pool.end();
            return;
        }

        console.log(`Found ${oldPlans.length} legacy plans to migrate/update.`);
        let totalPlansProcessed = 0;
        let totalRecipesProcessed = 0;
        let totalPlanEntriesProcessed = 0;

        for (const oldPlan of oldPlans) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const planData = JSON.parse(oldPlan.planData);
                const settings = JSON.parse(oldPlan.settings) || {};

                if (!planData) {
                    console.warn(`Skipping legacy plan ID ${oldPlan.id} due to invalid or missing planData.`);
                    await connection.rollback();
                    continue;
                }

                // Step 2: Upsert into `plans` table, now including shoppingList
                const [[existingPlan]] = await connection.query('SELECT id FROM plans WHERE legacy_id = ?', [oldPlan.id]);
                let newPlanId;

                if (existingPlan) {
                    newPlanId = existingPlan.id;
                    await connection.query(
                        'UPDATE plans SET name = ?, createdAt = ?, settings = ?, shareId = ?, shoppingList = ? WHERE id = ?',
                        [oldPlan.name, oldPlan.createdAt, JSON.stringify(settings), oldPlan.shareId, JSON.stringify(planData.shoppingList || []), newPlanId]
                    );
                } else {
                    const [planResult] = await connection.query(
                        `INSERT INTO plans (name, createdAt, settings, shareId, legacy_id, shoppingList) VALUES (?, ?, ?, ?, ?, ?)`,
                        [oldPlan.name, oldPlan.createdAt, JSON.stringify(settings), oldPlan.shareId, oldPlan.id, JSON.stringify(planData.shoppingList || [])]
                    );
                    newPlanId = planResult.insertId;
                }
                totalPlansProcessed++;

                // Step 3: Gather all unique recipes from the old structure (dinners AND breakfasts)
                const allRecipesInPlan = [];
                const recipeTitles = new Set();

                if (planData.recipes && Array.isArray(planData.recipes)) {
                    planData.recipes.forEach(recipe => {
                        if (recipe && recipe.title && !recipeTitles.has(recipe.title)) {
                            allRecipesInPlan.push({ recipe, day: recipe.day, meal_type: 'dinner' });
                            recipeTitles.add(recipe.title);
                        }
                    });
                }
                if (planData.weeklyPlan && Array.isArray(planData.weeklyPlan)) {
                    planData.weeklyPlan.forEach(dayPlan => {
                        if (dayPlan.breakfast && dayPlan.breakfast.title && !recipeTitles.has(dayPlan.breakfast.title)) {
                            allRecipesInPlan.push({ recipe: dayPlan.breakfast, day: dayPlan.day, meal_type: 'breakfast' });
                            recipeTitles.add(dayPlan.breakfast.title);
                        }
                        if (dayPlan.dinner && dayPlan.dinner.title && !recipeTitles.has(dayPlan.dinner.title)) {
                           allRecipesInPlan.push({ recipe: dayPlan.dinner, day: dayPlan.day, meal_type: 'dinner' });
                           recipeTitles.add(dayPlan.dinner.title);
                        }
                    });
                }
                
                // Step 4: Process the unified recipe list
                for (const { recipe, day, meal_type } of allRecipesInPlan) {
                    if (!recipe || !recipe.title || !day) continue;
                    totalRecipesProcessed++;
                    
                    const planSettings = {
                        dietaryPreference: settings.dietaryPreference || 'omnivore',
                        dietType: settings.dietType || 'balanced',
                        dishComplexity: settings.dishComplexity || 'simple',
                        isGlutenFree: !!settings.isGlutenFree,
                        isLactoseFree: !!settings.isLactoseFree
                    };
                    
                    // Upsert recipe with full metadata
                    await connection.query(
                        `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category, dietaryPreference, dietType, dishComplexity, isGlutenFree, isLactoseFree) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                            ingredients=VALUES(ingredients),
                            instructions=VALUES(instructions),
                            dietaryPreference = IF(dietaryPreference IS NULL, VALUES(dietaryPreference), dietaryPreference),
                            dietType = IF(dietType IS NULL, VALUES(dietType), dietType),
                            dishComplexity = IF(dishComplexity IS NULL, VALUES(dishComplexity), dishComplexity),
                            isGlutenFree = IF(isGlutenFree IS NULL, VALUES(isGlutenFree), isGlutenFree),
                            isLactoseFree = IF(isLactoseFree IS NULL, VALUES(isLactoseFree), isLactoseFree)`,
                        [
                            recipe.title, JSON.stringify(recipe.ingredients || []), JSON.stringify(recipe.instructions || []),
                            recipe.totalCalories || 0, recipe.protein || null, recipe.carbs || null, recipe.fat || null,
                            meal_type, planSettings.dietaryPreference, planSettings.dietType, planSettings.dishComplexity,
                            planSettings.isGlutenFree, planSettings.isLactoseFree,
                        ]
                    );

                    const [[{ id: newRecipeId }]] = await connection.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]);
                    
                    // Step 5: Upsert into junction table `plan_recipes`
                    if (newRecipeId) {
                        await connection.query(
                            'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id)',
                            [newPlanId, newRecipeId, day, meal_type]
                        );
                        totalPlanEntriesProcessed++;
                    } else {
                        throw new Error(`Could not find recipe ID for title: ${recipe.title}`);
                    }
                }

                await connection.commit();
                console.log(`  -> Successfully processed legacy plan ID ${oldPlan.id} into new plan ID ${newPlanId}.`);

            } catch (err) {
                await connection.rollback();
                console.error(`  - FAILED to process legacy plan ID ${oldPlan.id}:`, err.message);
            } finally {
                connection.release();
            }
        }
        
        if (legacyTableName === 'archived_plans') {
            console.log(`\n--- Renaming old table ---`);
            console.log('Renaming `archived_plans` to `legacy_archived_plans` for backup purposes.');
            await pool.query('RENAME TABLE archived_plans TO legacy_archived_plans;');
            console.log('Table renamed successfully.');
        }

        console.log(`\n--- Migration Complete ---`);
        console.log(`Total plans migrated/updated: ${totalPlansProcessed}`);
        console.log(`Total unique recipes processed: ${totalRecipesProcessed}`);
        console.log(`Total plan-recipe entries created/verified: ${totalPlanEntriesProcessed}`);

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

migrateToNormalizedDb();
