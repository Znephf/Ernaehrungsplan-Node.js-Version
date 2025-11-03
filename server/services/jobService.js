

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./database');
const { generateShareableHtml } = require('./htmlGenerator');
const { generateShoppingListOnly } = require('./geminiService');

async function getFullPlanById(planId) {
    const [planRows] = await pool.query('SELECT * FROM plans WHERE id = ?', [planId]);
    if (planRows.length === 0) return null;

    const plan = planRows[0];

    const [recipeLinks] = await pool.query(
        `SELECT pr.day_of_week, pr.meal_type, r.*, ri.image_url
         FROM plan_recipes pr
         JOIN recipes r ON pr.recipe_id = r.id
         LEFT JOIN recipe_images ri ON r.title = ri.recipe_title
         WHERE pr.plan_id = ?`,
        [planId]
    );

    const weeklyPlan = [];
    const recipes = [];
    const recipeMap = new Map();
    const planSettings = JSON.parse(plan.settings || '{}');
    const persons = planSettings.persons || 1;


    const daysOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

    for (const link of recipeLinks) {
        let recipe = recipeMap.get(link.id);
        if (!recipe) {
            recipe = {
                id: link.id,
                title: link.title,
                ingredients: JSON.parse(link.ingredients || '[]'),
                instructions: JSON.parse(link.instructions || '[]'),
                totalCalories: link.totalCalories,
                protein: link.protein,
                carbs: link.carbs,
                fat: link.fat,
                category: link.category,
                dietaryPreference: link.dietaryPreference,
                dietType: link.dietType,
                dishComplexity: link.dishComplexity,
                isGlutenFree: link.isGlutenFree,
                isLactoseFree: link.isLactoseFree,
                image_url: link.image_url,
            };
            recipeMap.set(link.id, recipe);
            recipes.push(recipe);
        }

        let dayPlan = weeklyPlan.find(dp => dp.day === link.day_of_week);
        if (!dayPlan) {
            dayPlan = { day: link.day_of_week, meals: [], totalCalories: 0 };
            weeklyPlan.push(dayPlan);
        }
        
        dayPlan.meals.push({ mealType: link.meal_type, recipe: recipe });
    }
    
    // Final calculation of daily total calories per person.
    weeklyPlan.forEach(dayPlan => {
        dayPlan.totalCalories = dayPlan.meals.reduce((sum, meal) => sum + (meal.recipe.totalCalories || 0), 0);
    });
    
    weeklyPlan.sort((a, b) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day));


    return {
        id: plan.id,
        name: plan.name,
        settings: planSettings,
        shoppingList: JSON.parse(plan.shoppingList || '[]'),
        weeklyPlan,
        recipes,
    };
}

async function savePlanToDatabase(planData, settings) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // AI now returns recipe calories PER PERSON, and we store them as such.

        const now = new Date();
        const [planResult] = await connection.query(
            'INSERT INTO plans (name, createdAt, settings, shoppingList) VALUES (?, ?, ?, ?)',
            [planData.name, now, JSON.stringify(settings), JSON.stringify(planData.shoppingList)]
        );
        const newPlanId = planResult.insertId;

        for (const recipe of planData.recipes) {
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category, dietaryPreference, dietType, dishComplexity, isGlutenFree, isLactoseFree) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title=VALUES(title)`,
                [
                    recipe.title, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions),
                    recipe.totalCalories, // Saving the per-person value directly
                    recipe.protein, 
                    recipe.carbs, 
                    recipe.fat, 
                    recipe.category,
                    settings.dietaryPreference, settings.dietType, settings.dishComplexity, 
                    settings.isGlutenFree, settings.isLactoseFree
                ]
            );
            
            const recipeId = recipeResult.insertId > 0 ? recipeResult.insertId : (await connection.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]))[0][0].id;

            // Finde die richtige Tages- und Mahlzeitzuordnung
            for (const day of planData.weeklyPlan) {
                for (const meal of day.meals) {
                    if (meal.recipeId === recipe.id) {
                        await connection.query(
                            'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                            [newPlanId, recipeId, day.day, meal.mealType]
                        );
                    }
                }
            }
        }

        await connection.commit();
        
        // Lade den vollständigen Plan erneut, um sicherzustellen, dass alle Daten korrekt sind
        return getFullPlanById(newPlanId);

    } catch (error) {
        await connection.rollback();
        console.error('Fehler beim Speichern des Plans in der Datenbank:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function saveCustomPlanToDatabase({ name, persons, mealsByDay }) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const settings = { persons }; // Simplified settings for custom plan
        const now = new Date();

        // 1. Create plan entry
        const [planResult] = await connection.query(
            'INSERT INTO plans (name, createdAt, settings) VALUES (?, ?, ?)',
            [name, now, JSON.stringify(settings)]
        );
        const newPlanId = planResult.insertId;

        const allRecipesForPlan = [];

        // 2. Link recipes
        for (const day of Object.keys(mealsByDay)) {
            for (const meal of mealsByDay[day]) {
                if (meal.recipe && meal.recipe.id) {
                    await connection.query(
                        'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                        [newPlanId, meal.recipe.id, day, meal.mealType]
                    );
                    allRecipesForPlan.push(meal.recipe);
                }
            }
        }
        
        // 3. Generate shopping list
        if (allRecipesForPlan.length > 0) {
            console.log(`Generating shopping list for custom plan #${newPlanId}...`);
            const shoppingList = await generateShoppingListOnly(settings, allRecipesForPlan);
            
            // 4. Update plan with shopping list
            await connection.query(
                'UPDATE plans SET shoppingList = ? WHERE id = ?',
                [JSON.stringify(shoppingList), newPlanId]
            );
        }

        await connection.commit();
        
        // 5. Return full plan data
        return getFullPlanById(newPlanId);

    } catch (error) {
        await connection.rollback();
        console.error('Error in saveCustomPlanToDatabase:', error);
        throw error;
    } finally {
        connection.release();
    }
}


async function processShareJob(jobId) {
    console.log(`[Share Job] Verarbeitung für Job ${jobId} gestartet.`);
    try {
        await pool.query('UPDATE app_jobs SET status = ?, progressText = ? WHERE jobId = ?', ['processing', 'Lade Plandaten...', jobId]);
        
        const [[job]] = await pool.query('SELECT relatedPlanId FROM app_jobs WHERE jobId = ?', [jobId]);
        if (!job) throw new Error("Job-Metadaten nicht gefunden.");
        
        const [[plan]] = await pool.query('SELECT id, name FROM plans WHERE id = ?', [job.relatedPlanId]);
        if (!plan) throw new Error(`Plan mit ID ${job.relatedPlanId} konnte nicht geladen werden.`);

        await pool.query('UPDATE app_jobs SET progressText = ? WHERE jobId = ?', ['Generiere dynamische HTML-Datei...', jobId]);
        
        const shareId = crypto.randomBytes(8).toString('hex');
        // Übergebe den Namen für den <title>-Tag
        const htmlContent = await generateShareableHtml({ name: plan.name });
        
        const fileName = `${shareId}.html`;
        const filePath = path.join(__dirname, '..', '..', 'public', 'shares', fileName);
        
        await fs.writeFile(filePath, htmlContent);
        
        await pool.query('UPDATE plans SET shareId = ? WHERE id = ?', [shareId, plan.id]);
        
        const result = { shareUrl: `/shares/${fileName}` };
        await pool.query('UPDATE app_jobs SET status = ?, progressText = ?, resultJson = ? WHERE jobId = ?', ['complete', 'Fertig!', JSON.stringify(result), jobId]);
        console.log(`[Share Job] Job ${jobId} erfolgreich abgeschlossen. Link: ${result.shareUrl}`);

    } catch (error) {
        console.error(`[Share Job] FEHLER bei der Verarbeitung von Job ${jobId}:`, error);
        await pool.query('UPDATE app_jobs SET status = ?, errorMessage = ? WHERE jobId = ?', ['error', error.message, jobId]);
    }
}


module.exports = { savePlanToDatabase, getFullPlanById, processShareJob, saveCustomPlanToDatabase };