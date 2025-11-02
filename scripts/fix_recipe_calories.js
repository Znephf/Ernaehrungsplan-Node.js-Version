
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

async function fixRecipeCalories() {
    console.log('--- Starting Recipe Calorie Correction Script ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        const [recipesToFix] = await pool.query(
            "SELECT id, title, totalCalories FROM recipes WHERE id >= 880"
        );

        if (recipesToFix.length === 0) {
            console.log('No recipes found with ID >= 880. Nothing to fix. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${recipesToFix.length} recipes to check and potentially correct.`);
        let correctedCount = 0;

        for (const recipe of recipesToFix) {
            // Find the earliest plan this recipe was associated with to get the original 'persons' setting.
            const [[originalPlan]] = await pool.query(
                `SELECT p.settings 
                 FROM plans p 
                 JOIN plan_recipes pr ON p.id = pr.plan_id 
                 WHERE pr.recipe_id = ? 
                 ORDER BY p.createdAt ASC 
                 LIMIT 1`,
                [recipe.id]
            );

            if (!originalPlan || !originalPlan.settings) {
                console.warn(`  - WARNING: Could not find an original plan for Recipe ID ${recipe.id} ("${recipe.title}"). Skipping.`);
                continue;
            }

            const settings = JSON.parse(originalPlan.settings);
            const persons = settings.persons;

            if (!persons || persons <= 1) {
                // If persons is 1, null, or undefined, the value is likely already correct or cannot be determined.
                console.log(`  - INFO: Skipping Recipe ID ${recipe.id} as person count is ${persons || 'unknown'}.`);
                continue;
            }
            
            // Assuming the current value is for ALL persons, calculate the per-person value.
            const perPersonCalories = Math.round(recipe.totalCalories / persons);
            
            if (perPersonCalories === recipe.totalCalories) {
                console.log(`  - INFO: Calories for Recipe ID ${recipe.id} seem to be correct already. Skipping.`);
                continue;
            }

            console.log(`  -> Correcting Recipe ID ${recipe.id} ("${recipe.title}"):`);
            console.log(`     Original totalCalories: ${recipe.totalCalories}, Persons: ${persons}`);
            console.log(`     New per-person totalCalories: ${perPersonCalories}`);

            // Update the recipe in the database
            await pool.query(
                'UPDATE recipes SET totalCalories = ? WHERE id = ?',
                [perPersonCalories, recipe.id]
            );
            correctedCount++;
        }

        console.log('\n--- Correction Complete ---');
        console.log(`Total recipes corrected: ${correctedCount} out of ${recipesToFix.length} checked.`);

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

fixRecipeCalories();
