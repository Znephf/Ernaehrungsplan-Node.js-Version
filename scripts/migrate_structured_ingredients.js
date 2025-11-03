// Fix: Refactored the script to use batch processing for ingredient conversion, significantly reducing API calls and costs.
const path = require('path');
const dotenv = require('dotenv');
const { convertMultipleIngredientsToStructuredFormat } = require('../server/services/geminiService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 15; // Process 15 recipes per API call to save costs

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
    console.log('--- Starting Ingredient Structure Migration Script (Batch Mode) ---');
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

        console.log(`Found ${recipesToFix.length} recipes to migrate. Processing in batches of ${BATCH_SIZE}.`);
        
        // Pre-process all recipes to find their original context (persons count)
        const recipesWithContext = [];
        for (const recipe of recipesToFix) {
            const ingredientStrings = JSON.parse(recipe.ingredients);
            if (!Array.isArray(ingredientStrings) || ingredientStrings.length === 0) {
                console.warn(`  - Recipe ID ${recipe.id} has no ingredients to process. Skipping.`);
                continue;
            }

            const [[originalPlan]] = await pool.query(
                `SELECT p.settings FROM plans p 
                 JOIN plan_recipes pr ON p.id = pr.plan_id 
                 WHERE pr.recipe_id = ? 
                 ORDER BY p.createdAt ASC 
                 LIMIT 1`,
                [recipe.id]
            );
            
            let originalPersons = 2; // Default for old plans
            if (originalPlan && originalPlan.settings) {
                const settings = JSON.parse(originalPlan.settings);
                if (settings.persons && settings.persons > 0) {
                    originalPersons = settings.persons;
                }
            }
            recipesWithContext.push({ ...recipe, originalPersons, ingredientStrings });
        }

        for (let i = 0; i < recipesWithContext.length; i += BATCH_SIZE) {
            const batch = recipesWithContext.slice(i, i + BATCH_SIZE);
            console.log(`\n--- Processing Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipesWithContext.length / BATCH_SIZE)} ---`);

            try {
                const apiPayload = batch.map(r => ({
                    recipeId: r.id,
                    originalPersons: r.originalPersons,
                    ingredients: r.ingredientStrings
                }));

                console.log(`  - Asking AI to convert and scale ${batch.length} recipes...`);
                const convertedBatch = await convertMultipleIngredientsToStructuredFormat(apiPayload);

                if (!convertedBatch || !Array.isArray(convertedBatch) || convertedBatch.length === 0) {
                    throw new Error("AI did not return a valid structured ingredient array for the batch.");
                }

                // Update the database for each recipe in the successfully converted batch
                for (const convertedRecipe of convertedBatch) {
                    const { recipeId, structuredIngredients } = convertedRecipe;
                    const [updateResult] = await pool.query(
                        'UPDATE recipes SET ingredients = ?, base_persons = ? WHERE id = ?',
                        [JSON.stringify(structuredIngredients), 1, recipeId]
                    );

                    if (updateResult.affectedRows > 0) {
                        console.log(`  - SUCCESS: Recipe ID ${recipeId} updated.`);
                    } else {
                        console.error(`  - FAILED: Could not update Recipe ID ${recipeId} in the database.`);
                    }
                }
                
                // Add a delay to avoid hitting API rate limits between batches
                if (i + BATCH_SIZE < recipesWithContext.length) {
                    console.log('  - Waiting 2 seconds before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (err) {
                console.error(`  - ERROR processing batch starting with Recipe ID ${batch[0].id}:`, err.message);
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