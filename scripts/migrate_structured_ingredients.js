const path = require('path');
const dotenv = require('dotenv');
const { convertIngredientsToStructuredFormat } = require('../server/services/geminiService');

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

async function migrateStructuredIngredients() {
    console.log('--- Starting Ingredient Structure Migration Script ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // Find recipes where ingredients are stored as an array of strings
        const [recipesToFix] = await pool.query(
            "SELECT * FROM recipes WHERE JSON_TYPE(JSON_EXTRACT(ingredients, '$[0]')) = 'STRING'"
        );

        if (recipesToFix.length === 0) {
            console.log('No recipes with old ingredient format found. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${recipesToFix.length} recipes to migrate to the new structured ingredient format.`);

        for (const recipe of recipesToFix) {
            console.log(`\nProcessing Recipe ID: ${recipe.id} ("${recipe.title}")...`);
            try {
                const ingredientStrings = JSON.parse(recipe.ingredients);
                if (!Array.isArray(ingredientStrings) || ingredientStrings.length === 0) {
                    console.warn(`  - Recipe has no ingredients to process. Skipping.`);
                    continue;
                }

                // Find the original plan to determine the 'persons' count
                const [[originalPlan]] = await pool.query(
                    `SELECT p.settings FROM plans p 
                     JOIN plan_recipes pr ON p.id = pr.plan_id 
                     WHERE pr.recipe_id = ? 
                     ORDER BY p.createdAt ASC 
                     LIMIT 1`,
                    [recipe.id]
                );
                
                let originalPersons = 2; // Default to 2, as was common in old plans
                if (originalPlan && originalPlan.settings) {
                    const settings = JSON.parse(originalPlan.settings);
                    if (settings.persons && settings.persons > 0) {
                        originalPersons = settings.persons;
                    }
                }
                console.log(`  - Original ingredient quantities were for ${originalPersons} person(s).`);
                
                // Use Gemini to convert the ingredients
                console.log(`  - Asking AI to convert and scale ingredients...`);
                const structuredIngredients = await convertIngredientsToStructuredFormat(ingredientStrings, originalPersons);
                
                if (!structuredIngredients || !Array.isArray(structuredIngredients) || structuredIngredients.length === 0) {
                    throw new Error("AI did not return a valid structured ingredient array.");
                }

                // Update the recipe in the database with the new format and base_persons = 1
                const [updateResult] = await pool.query(
                    'UPDATE recipes SET ingredients = ?, base_persons = ? WHERE id = ?',
                    [JSON.stringify(structuredIngredients), 1, recipe.id]
                );

                if (updateResult.affectedRows > 0) {
                    console.log(`  - SUCCESS: Recipe ID ${recipe.id} updated to structured format with base_persons = 1.`);
                } else {
                     console.error(`  - FAILED: Could not update Recipe ID ${recipe.id} in the database.`);
                }
                
                // Add a delay to avoid hitting API rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (err) {
                console.error(`  - ERROR processing Recipe ID ${recipe.id}:`, err.message);
            }
        }

        console.log('\n--- Script finished ---');

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

migrateStructuredIngredients();