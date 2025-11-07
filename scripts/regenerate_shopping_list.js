

const path = require('path');
const dotenv = require('dotenv');
const { generateShoppingListOnly } = require('../server/services/geminiService');

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

async function regenerateShoppingLists() {
    console.log('--- Starting Shopping List Regeneration Script ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // Find plans where shoppingList is NULL or an empty JSON array '[]'
        const [plansToFix] = await pool.query(
            "SELECT id, settings, name FROM plans WHERE shoppingList IS NULL OR JSON_UNQUOTE(shoppingList) = '[]'"
        );

        if (plansToFix.length === 0) {
            console.log('No plans found with missing shopping lists. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${plansToFix.length} plan(s) to fix: ${plansToFix.map(p => `#${p.id} "${p.name}"`).join(', ')}`);

        for (const plan of plansToFix) {
            console.log(`\nProcessing Plan ID: ${plan.id} ("${plan.name}")...`);
            try {
                // 1. Get all recipes for this plan
                const [recipes] = await pool.query(
                    `SELECT r.ingredients, r.base_persons FROM recipes r JOIN plan_recipes pr ON r.id = pr.recipe_id WHERE pr.plan_id = ?`,
                    [plan.id]
                );

                if (recipes.length === 0) {
                    console.warn(`  - No recipes found for Plan ID ${plan.id}. Cannot generate shopping list. Skipping.`);
                    continue;
                }
                
                const settings = JSON.parse(plan.settings);
                const persons = settings.persons || 1;
                const scaledIngredients = [];

                recipes.forEach(recipe => {
                    const ingredients = JSON.parse(recipe.ingredients || '[]');
                    const basePersons = recipe.base_persons || 1;
                    ingredients.forEach(ing => {
                        const quantity = typeof ing.quantity === 'number' ? ing.quantity : 0;
                        const scaledQuantity = (quantity / basePersons) * persons;
                        scaledIngredients.push({
                            ingredient: ing.ingredient,
                            quantity: scaledQuantity,
                            unit: ing.unit
                        });
                    });
                });

                if (scaledIngredients.length === 0) {
                    console.warn(`  - No ingredients found for Plan ID ${plan.id}. Skipping.`);
                    continue;
                }
                
                console.log(`  - Found ${recipes.length} recipes with ingredients. Asking AI to generate a shopping list for ${persons} person(s).`);

                // 2. Generate the shopping list using the Gemini service
                const { shoppingList: newShoppingList } = await generateShoppingListOnly(scaledIngredients);
                
                if (!newShoppingList || newShoppingList.length === 0) {
                     throw new Error("AI returned an empty or invalid shopping list.");
                }

                // 3. Update the plan in the database
                const [updateResult] = await pool.query(
                    'UPDATE plans SET shoppingList = ? WHERE id = ?',
                    [JSON.stringify(newShoppingList), plan.id]
                );
                
                if (updateResult.affectedRows > 0) {
                    console.log(`  - SUCCESS: Plan ID ${plan.id} has been updated with a new shopping list.`);
                } else {
                    console.error(`  - FAILED: Could not update Plan ID ${plan.id} in the database.`);
                }

            } catch (err) {
                console.error(`  - ERROR processing Plan ID ${plan.id}:`, err.message);
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

regenerateShoppingLists();