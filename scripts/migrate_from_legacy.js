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

const MealCategoryMap = {
    'Frühstück': 'breakfast',
    'Abendessen': 'dinner',
    'Mittagessen': 'lunch',
    'Snack': 'snack',
    'Kaffee & Kuchen': 'coffee',
};

async function migrateLegacyData() {
    console.log('--- Starting Legacy Data Fix & Migration Script ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        const [tables] = await pool.query("SHOW TABLES LIKE 'legacy_archived_plans'");
        if (tables.length === 0) {
            console.log('Table `legacy_archived_plans` not found. Assuming no legacy data to migrate. Exiting.');
            await pool.end();
            return;
        }

        const [legacyPlans] = await pool.query("SELECT id, planData FROM legacy_archived_plans");
        if (legacyPlans.length === 0) {
            console.log('No plans found in `legacy_archived_plans`. Exiting.');
            await pool.end();
            return;
        }
        
        console.log(`Found ${legacyPlans.length} legacy plans to check for missing recipes.`);
        let newRecipesAdded = 0;

        for (const plan of legacyPlans) {
            try {
                const planData = JSON.parse(plan.planData);
                
                let recipesToProcess = [];
                if (planData.recipes && Array.isArray(planData.recipes)) {
                    recipesToProcess.push(...planData.recipes);
                }
                if (planData.weeklyPlan && Array.isArray(planData.weeklyPlan)) {
                    planData.weeklyPlan.forEach(day => {
                        if(day.breakfast && day.breakfast.title) recipesToProcess.push(day.breakfast);
                        if(day.dinner && day.dinner.title) recipesToProcess.push(day.dinner);
                        if(day.meals && Array.isArray(day.meals)) {
                            day.meals.forEach(meal => {
                                if(meal.recipe && meal.recipe.title) recipesToProcess.push(meal.recipe);
                            });
                        }
                    });
                }
                
                const uniqueRecipes = Array.from(new Map(recipesToProcess.map(r => [r.title, r])).values());
                
                for (const recipe of uniqueRecipes) {
                    if (!recipe.title) continue;

                    let category = 'dinner';
                    if (recipe.category && MEAL_CATEGORIES.includes(recipe.category)) {
                        category = recipe.category;
                    } else if (recipe.title.toLowerCase().includes('quark')) {
                        category = 'breakfast';
                    } else if (MealCategoryMap[recipe.mealType]) {
                        category = MealCategoryMap[recipe.mealType];
                    }

                    const [result] = await pool.query(
                        `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE title=title`,
                        [
                            recipe.title,
                            JSON.stringify(recipe.ingredients || []),
                            JSON.stringify(recipe.instructions || []),
                            recipe.totalCalories || 0,
                            recipe.protein || null,
                            recipe.carbs || null,
                            recipe.fat || null,
                            category
                        ]
                    );

                    if (result.affectedRows > 0) {
                        newRecipesAdded++;
                        console.log(`  -> Added new recipe: "${recipe.title}"`);
                    }
                }

            } catch (e) {
                console.error(`Could not parse planData for legacy plan ID ${plan.id}. Skipping. Error: ${e.message}`);
            }
        }

        console.log(`\n--- Migration Complete ---`);
        console.log(`Total new recipes added to the database: ${newRecipesAdded}`);

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

migrateLegacyData();
