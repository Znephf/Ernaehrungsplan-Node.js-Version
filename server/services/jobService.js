const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./database');
const { generateImageForRecipe, generateShoppingListForRecipes } = require('./geminiService');
const { generateShareableHtml } = require('./htmlGenerator');

const publicSharesDir = path.join(__dirname, '..', '..', 'public', 'shares');
const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');
const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/**
 * Speichert ein Base64-codiertes Bild als Datei und aktualisiert den `image_url` des Rezepts in der Datenbank.
 * @param {string | number} recipeId - Die ID des Rezepts.
 * @param {string} base64Data - Die Base64-codierten Bilddaten (ohne Data-URI-Präfix).
 * @returns {Promise<string>} Die öffentliche URL der gespeicherten Bilddatei.
 */
async function saveImageForRecipe(recipeId, base64Data) {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
    const filePath = path.join(publicImagesDir, fileName);
    const fileUrl = `/images/recipes/${fileName}`;
    
    fs.writeFileSync(filePath, imageBuffer);

    await pool.query(
        'UPDATE recipes SET image_url = ? WHERE id = ?',
        [fileUrl, recipeId]
    );
    return fileUrl;
}


/**
 * Erstellt eine teilbare HTML-Datei für einen Plan und speichert den Link in der Datenbank.
 * @param {object} plan - Das vollständige, rekonstruierte Plan-Objekt.
 * @returns {Promise<string>} Die URL der teilbaren Datei.
 */
async function createShareLink(plan) {
    const shareId = plan.shareId || crypto.randomBytes(12).toString('hex');
    const htmlContent = await generateShareableHtml(plan);
    const fileName = `${shareId}.html`;
    const filePath = path.join(publicSharesDir, fileName);

    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    if (!plan.shareId) {
        await pool.query('UPDATE plans SET shareId = ? WHERE id = ?', [shareId, plan.id]);
    }
    
    return `/shares/${fileName}`;
}


/**
 * Verarbeitet einen Job zur Vorbereitung des Teilens eines Plans asynchron.
 * @param {string} jobId - Die ID des Jobs.
 */
async function processShareJob(jobId) {
    let plan;
    try {
        const [jobRows] = await pool.query('SELECT relatedPlanId FROM app_jobs WHERE jobId = ?', [jobId]);
        if (jobRows.length === 0) throw new Error(`Job ${jobId} nicht gefunden.`);
        
        const planId = jobRows[0].relatedPlanId;
        
        // BEHOBEN: Lade Plandaten aus den neuen, normalisierten Tabellen
        const [planRows] = await pool.query(`
            SELECT 
                p.id, p.name, p.createdAt, p.settings, p.shareId,
                pr.day_of_week, pr.meal_type,
                r.id as recipe_id, r.title, r.ingredients, r.instructions, r.totalCalories, r.protein, r.carbs, r.fat, r.category, r.image_url
            FROM plans p
            LEFT JOIN plan_recipes pr ON p.id = pr.plan_id
            LEFT JOIN recipes r ON pr.recipe_id = r.id
            WHERE p.id = ?
            ORDER BY FIELD(pr.day_of_week, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag');
        `, [planId]);

        if (planRows.length === 0) throw new Error(`Zugehöriger Plan ${planId} für Job ${jobId} nicht gefunden.`);

        // Rekonstruiere das Plan-Objekt
        plan = {
            id: planRows[0].id,
            name: planRows[0].name,
            settings: typeof planRows[0].settings === 'string' ? JSON.parse(planRows[0].settings) : planRows[0].settings,
            shareId: planRows[0].shareId,
            weeklyPlan: [],
            recipes: [],
            shoppingList: []
        };
        const recipeMap = new Map();
        planRows.forEach(row => {
            if (row.recipe_id && !recipeMap.has(row.recipe_id)) {
                const recipe = {
                    id: row.recipe_id, title: row.title,
                    ingredients: typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : row.ingredients,
                    instructions: typeof row.instructions === 'string' ? JSON.parse(row.instructions) : row.instructions,
                    totalCalories: row.totalCalories, protein: row.protein, carbs: row.carbs, fat: row.fat,
                    category: row.category, image_url: row.image_url
                };
                recipeMap.set(recipe.id, recipe);
                plan.recipes.push(recipe);
            }
            let dayPlan = plan.weeklyPlan.find(dp => dp.day === row.day_of_week);
            if (!dayPlan) {
                dayPlan = { day: row.day_of_week, meals: [], totalCalories: 0 };
                plan.weeklyPlan.push(dayPlan);
            }
            if (row.recipe_id) {
                dayPlan.meals.push({ mealType: row.meal_type, recipe: recipeMap.get(row.recipe_id) });
                dayPlan.totalCalories += (row.totalCalories || 0);
            }
        });
        plan.weeklyPlan.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day));
        plan.shoppingList = await generateShoppingListForRecipes(plan.recipes, plan.settings.persons);


        if (plan.shareId) {
            const existingFile = path.join(publicSharesDir, `${plan.shareId}.html`);
            if (fs.existsSync(existingFile)) {
                const shareUrl = `/shares/${plan.shareId}.html`;
                await pool.query('UPDATE app_jobs SET status = "complete", resultJson = ? WHERE jobId = ?', [JSON.stringify({ shareUrl }), jobId]);
                return;
            }
        }

        const recipesToGenerate = plan.recipes.filter(r => !r.image_url);
        if (recipesToGenerate.length > 0) {
            for (let i = 0; i < recipesToGenerate.length; i++) {
                const recipe = recipesToGenerate[i];
                const progressText = `Generiere Bild ${i + 1}/${recipesToGenerate.length}: ${recipe.title}`;
                await pool.query('UPDATE app_jobs SET status = "processing", progressText = ? WHERE jobId = ?', [progressText, jobId]);

                const imageResult = await generateImageForRecipe(recipe, 1);
                const response = imageResult.apiResponse;

                if (response.promptFeedback?.blockReason) { continue; }
                const candidate = response?.candidates?.[0];
                if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) { continue; }
                
                const imagePart = candidate.content?.parts?.find(p => p.inlineData);
                
                if (imagePart?.inlineData?.data) {
                    // BEHOBEN: Rufe die korrigierte Funktion mit recipe.id auf
                    const fileUrl = await saveImageForRecipe(recipe.id, imagePart.inlineData.data);
                    recipe.image_url = fileUrl; // Aktualisiere das In-Memory-Objekt für die HTML-Generierung
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        await pool.query('UPDATE app_jobs SET status = "processing", progressText = "Link wird erstellt..." WHERE jobId = ?', [jobId]);
        const finalShareUrl = await createShareLink(plan);
        
        await pool.query('UPDATE app_jobs SET status = "complete", resultJson = ? WHERE jobId = ?', [JSON.stringify({ shareUrl: finalShareUrl }), jobId]);
        console.log(`[Job ${jobId}] Share-Job erfolgreich abgeschlossen.`);

    } catch (error) {
        console.error(`[Job ${jobId}] Kritischer Fehler bei der Job-Verarbeitung:`, error);
        await pool.query('UPDATE app_jobs SET status = "error", errorMessage = ? WHERE jobId = ?', [error.message, jobId]);
    }
}

module.exports = {
    processShareJob,
    saveImageForRecipe
};