
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./database');
const { generateShareableHtml } = require('./htmlGenerator');

async function getFullPlanById(planId) {
    const [planRows] = await pool.query('SELECT * FROM plans WHERE id = ?', [planId]);
    if (planRows.length === 0) return null;

    const plan = planRows[0];

    const [recipeLinks] = await pool.query(
        `SELECT pr.day_of_week, pr.meal_type, r.*, ri.image_url
         FROM plan_recipes pr
         JOIN recipes r ON pr.recipe_id = r.id
         LEFT JOIN recipe_images ri ON r.recipe_image_id = ri.id
         WHERE pr.plan_id = ?`,
        [planId]
    );

    const weeklyPlan = [];
    const recipes = [];
    const recipeMap = new Map();

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
        
        dayPlan.meals.push({ mealType: link.meal_type, recipe });
        dayPlan.totalCalories += recipe.totalCalories || 0;
    }

    return {
        id: plan.id,
        name: plan.name,
        settings: JSON.parse(plan.settings || '{}'),
        shoppingList: JSON.parse(plan.shoppingList || '[]'),
        weeklyPlan,
        recipes,
    };
}

async function savePlanToDatabase(planData, settings) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

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
                    recipe.totalCalories, recipe.protein, recipe.carbs, recipe.fat, recipe.category,
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


async function processShareJob(jobId) {
    console.log(`[Share Job] Verarbeitung für Job ${jobId} gestartet.`);
    try {
        await pool.query('UPDATE app_jobs SET status = ?, progressText = ? WHERE jobId = ?', ['processing', 'Lade Plandaten...', jobId]);
        
        const [[job]] = await pool.query('SELECT relatedPlanId FROM app_jobs WHERE jobId = ?', [jobId]);
        if (!job) throw new Error("Job-Metadaten nicht gefunden.");
        
        const plan = await getFullPlanById(job.relatedPlanId);
        if (!plan) throw new Error(`Plan mit ID ${job.relatedPlanId} konnte nicht geladen werden.`);

        await pool.query('UPDATE app_jobs SET progressText = ? WHERE jobId = ?', ['Generiere HTML-Datei...', jobId]);
        const htmlContent = await generateShareableHtml(plan);
        
        const shareId = crypto.randomBytes(8).toString('hex');
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


module.exports = { savePlanToDatabase, getFullPlanById, processShareJob };
