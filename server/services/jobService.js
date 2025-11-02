const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./database');
const { generatePlanAndShoppingList } = require('./geminiService');
const { generateShareableHtml } = require('./htmlGenerator');

const updateJobStatus = async (jobId, status, progressText = '', errorMessage = null, resultJson = null) => {
    try {
        await pool.query(
            'UPDATE app_jobs SET status = ?, progressText = ?, errorMessage = ?, resultJson = ? WHERE jobId = ?',
            [status, progressText, errorMessage, resultJson ? JSON.stringify(resultJson) : null, jobId]
        );
    } catch (error) {
        console.error(`[Job ${jobId}] Failed to update status to ${status}:`, error);
    }
};

const processPlanGenerationJob = async (jobId) => {
    console.log(`[Job ${jobId}] Starting plan generation process.`);
    let planData;

    try {
        await updateJobStatus(jobId, 'in_progress', 'Schritt 1/2: Wochenplan & Rezepte werden erstellt...');
        const [jobRows] = await pool.query('SELECT settings, previousPlanRecipes FROM app_jobs WHERE jobId = ?', [jobId]);
        if (jobRows.length === 0) throw new Error("Job not found in database.");

        const settings = JSON.parse(jobRows[0].settings);
        const previousPlanRecipes = JSON.parse(jobRows[0].previousPlanRecipes || '[]');
        
        planData = await generatePlanAndShoppingList(settings, previousPlanRecipes);
        if (!planData || !planData.recipes || !planData.weeklyPlan) {
            throw new Error("Invalid data structure received from AI model.");
        }
        
        await updateJobStatus(jobId, 'in_progress', 'Schritt 2/2: Plan wird in der Datenbank gespeichert...');
        const newPlan = await savePlanToDatabase(planData, settings);

        await updateJobStatus(jobId, 'complete', 'Plan erfolgreich erstellt!', null, { newPlanId: newPlan.id });
        console.log(`[Job ${jobId}] Plan generation complete. New plan ID: ${newPlan.id}`);

    } catch (error) {
        console.error(`[Job ${jobId}] CRITICAL ERROR during plan generation:`, error);
        await updateJobStatus(jobId, 'error', 'Fehler', error.message || 'An unknown error occurred.');
    }
};

async function savePlanToDatabase(planData, settings) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [planResult] = await connection.query(
            `INSERT INTO plans (name, settings, shoppingList) VALUES (?, ?, ?)`,
            [planData.name, JSON.stringify(settings), JSON.stringify(planData.shoppingList || [])]
        );
        const newPlanId = planResult.insertId;

        const recipeIdMap = new Map();
        for (const recipe of planData.recipes) {
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), ingredients=VALUES(ingredients), instructions=VALUES(instructions)`,
                [
                    recipe.title, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions),
                    recipe.totalCalories, recipe.protein, recipe.carbs, recipe.fat, recipe.category
                ]
            );
            
            const [[{ recipe_id }]] = await connection.query('SELECT LAST_INSERT_ID() as recipe_id');
            const finalRecipeId = recipeResult.insertId > 0 ? recipeResult.insertId : recipe_id;
            
            recipeIdMap.set(recipe.id, finalRecipeId);
        }

        for (const day of planData.weeklyPlan) {
            for (const meal of day.meals) {
                const dbRecipeId = recipeIdMap.get(meal.recipeId);
                if (!dbRecipeId) {
                    throw new Error(`Recipe with temp ID ${meal.recipeId} was not found in the recipe map.`);
                }
                await connection.query(
                    `INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)`,
                    [newPlanId, dbRecipeId, day.day, meal.mealType]
                );
            }
        }
        
        await connection.commit();
        
        return { id: newPlanId, name: planData.name };

    } catch (error) {
        await connection.rollback();
        console.error("Database transaction failed for saving plan:", error);
        throw error;
    } finally {
        connection.release();
    }
}


const processShareJob = async (jobId) => {
    console.log(`[Job ${jobId}] Starting share process.`);
    try {
        await updateJobStatus(jobId, 'in_progress', 'Lade Plandaten...');
        const [jobRows] = await pool.query('SELECT relatedPlanId FROM app_jobs WHERE jobId = ?', [jobId]);
        if (!jobRows.length) throw new Error("Job not found.");
        
        const planId = jobRows[0].relatedPlanId;
        const plan = await getFullPlanById(planId);
        if (!plan) throw new Error(`Plan with ID ${planId} not found.`);

        await updateJobStatus(jobId, 'in_progress', 'Generiere HTML-Datei...');
        const htmlContent = await generateShareableHtml(plan);
        
        const shareId = crypto.randomBytes(8).toString('hex');
        const fileName = `${shareId}.html`;
        const filePath = path.join(__dirname, '..', '..', 'public', 'shares', fileName);

        await fs.writeFile(filePath, htmlContent);
        
        await updateJobStatus(jobId, 'in_progress', 'Speichere Link...');
        await pool.query('UPDATE plans SET shareId = ? WHERE id = ?', [shareId, planId]);

        await updateJobStatus(jobId, 'complete', 'Fertig!', null, { shareUrl: `/shares/${fileName}` });
        console.log(`[Job ${jobId}] Share process complete. URL: /shares/${fileName}`);

    } catch (error) {
        console.error(`[Job ${jobId}] CRITICAL ERROR during share process:`, error);
        await updateJobStatus(jobId, 'error', 'Fehler', error.message || 'An unknown error occurred.');
    }
};

async function getFullPlanById(planId) {
    const [planRows] = await pool.query('SELECT * FROM plans WHERE id = ?', [planId]);
    if (planRows.length === 0) return null;

    const plan = planRows[0];
    plan.settings = JSON.parse(plan.settings || '{}');
    plan.shoppingList = JSON.parse(plan.shoppingList || '[]');

    const [recipeLinks] = await pool.query(
        `SELECT pr.day_of_week, pr.meal_type, r.* FROM plan_recipes pr
         JOIN recipes r ON pr.recipe_id = r.id
         WHERE pr.plan_id = ?`,
        [planId]
    );
    
    plan.recipes = recipeLinks.map(r => ({
        ...r,
        ingredients: JSON.parse(r.ingredients || '[]'),
        instructions: JSON.parse(r.instructions || '[]')
    }));

    const weeklyPlanMap = new Map();
    recipeLinks.forEach(link => {
        if (!weeklyPlanMap.has(link.day_of_week)) {
            weeklyPlanMap.set(link.day_of_week, { day: link.day_of_week, meals: [], totalCalories: 0 });
        }
        const dayPlan = weeklyPlanMap.get(link.day_of_week);
        const recipe = plan.recipes.find(r => r.id === link.id);
        if(recipe){
          dayPlan.meals.push({ mealType: link.meal_type, recipe });
          dayPlan.totalCalories += recipe.totalCalories || 0;
        }
    });

    plan.weeklyPlan = Array.from(weeklyPlanMap.values());
    
    return plan;
}

module.exports = { 
    processPlanGenerationJob,
    processShareJob,
    getFullPlanById
};
