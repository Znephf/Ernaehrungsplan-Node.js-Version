const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../services/database');
const { processGenerationJob, generateImageForRecipe, generateShoppingListForRecipes } = require('../services/geminiService');

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// Startet einen neuen asynchronen Job zur Erstellung eines Ernährungsplans
router.post('/generate-plan-job', async (req, res) => {
    const payload = req.body;
     if (!payload.settings) {
        return res.status(400).json({ error: 'Einstellungen fehlen in der Anfrage.' });
    }
    const jobId = crypto.randomBytes(16).toString('hex');
    try {
        await pool.query('INSERT INTO generation_jobs (jobId, payload) VALUES (?, ?)', [jobId, JSON.stringify(payload)]);
        
        // Startet die Verarbeitung im Hintergrund, ohne auf das Ergebnis zu warten
        processGenerationJob(jobId);

        res.status(202).json({ jobId });
    } catch (error) {
        console.error('Fehler beim Erstellen des Generierungs-Jobs:', error);
        res.status(500).json({ error: 'Job konnte nicht erstellt werden.' });
    }
});

// Ruft den Status eines laufenden Generierungs-Jobs ab
router.get('/job-status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const [jobRows] = await pool.query('SELECT status, planId, errorMessage FROM generation_jobs WHERE jobId = ?', [jobId]);
        if (jobRows.length === 0) {
            return res.status(404).json({ error: 'Job nicht gefunden.' });
        }
        const { status, planId, errorMessage } = jobRows[0];

        if (status === 'complete' && planId) {
            // BEHOBEN: Die Abfrage wurde an die neue, normalisierte Datenbankstruktur angepasst.
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

            if (planRows.length === 0) {
                console.error(`[Job-Status] Inkonsistenz: Job ${jobId} ist 'complete' mit planId ${planId}, aber der Plan wurde in der DB nicht gefunden.`);
                return res.json({ status: 'error', error: 'Der generierte Plan konnte nicht in der Datenbank gefunden werden. Er wurde möglicherweise gelöscht.' });
            }

            // Rekonstruiert das Plan-Objekt, das vom Frontend erwartet wird.
            const reconstructedPlan = {
                id: planRows[0].id,
                name: planRows[0].name,
                createdAt: new Date(planRows[0].createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                settings: typeof planRows[0].settings === 'string' ? JSON.parse(planRows[0].settings) : planRows[0].settings,
                shareId: planRows[0].shareId,
                weeklyPlan: [],
                recipes: [],
                shoppingList: [] // Wird unten generiert
            };

            const recipeMap = new Map();
            planRows.forEach(row => {
                if (!row.recipe_id) return; // Überspringen, falls keine Rezeptdaten vorhanden sind

                // Fügt einzigartige Rezepte zur flachen Liste hinzu
                if (!recipeMap.has(row.recipe_id)) {
                    const recipe = {
                        id: row.recipe_id,
                        title: row.title,
                        ingredients: typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : row.ingredients,
                        instructions: typeof row.instructions === 'string' ? JSON.parse(row.instructions) : row.instructions,
                        totalCalories: row.totalCalories,
                        protein: row.protein,
                        carbs: row.carbs,
                        fat: row.fat,
                        category: row.category,
                        image_url: row.image_url
                    };
                    recipeMap.set(recipe.id, recipe);
                    reconstructedPlan.recipes.push(recipe);
                }

                // Baut den Wochenplan auf
                let dayPlan = reconstructedPlan.weeklyPlan.find(dp => dp.day === row.day_of_week);
                if (!dayPlan) {
                    dayPlan = { day: row.day_of_week, meals: [], totalCalories: 0 };
                    reconstructedPlan.weeklyPlan.push(dayPlan);
                }
                
                dayPlan.meals.push({ mealType: row.meal_type, recipe: recipeMap.get(row.recipe_id) });
                dayPlan.totalCalories += row.totalCalories || 0;
            });
            
            reconstructedPlan.weeklyPlan.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day));
            
            // Generiert die Einkaufsliste on-the-fly
            reconstructedPlan.shoppingList = await generateShoppingListForRecipes(reconstructedPlan.recipes, reconstructedPlan.settings.persons);
            
            return res.json({ status: 'complete', plan: reconstructedPlan, error: errorMessage });
        }
        
        res.json({ status, planId, error: errorMessage });

    } catch (error) {
        console.error(`Fehler beim Abrufen des Status für Job ${jobId}:`, error);
        res.status(500).json({ error: 'Job-Status konnte nicht abgerufen werden.' });
    }
});

// Generiert ein Bild für ein bestimmtes Rezept
router.post('/generate-image', async (req, res) => {
    const { recipe, attempt } = req.body;
    if (!recipe) {
        return res.status(400).json({ error: 'Rezept fehlt in der Anfrage.' });
    }
    
    try {
        const result = await generateImageForRecipe(recipe, attempt);
        res.json(result);
    } catch (error) {
        console.error('[API Error] Kritischer Fehler bei der Bild-Generierung:', error);
        const errorMessage = String(error.message || '');
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
            return res.status(429).json({ error: 'API-Nutzungslimit (Quota) überschritten. Bitte Tarif & Abrechnung in der Google Cloud Console prüfen.' });
        }
        res.status(503).json({ error: `Fehler bei der Bildgenerierung: ${errorMessage}` });
    }
});


module.exports = router;