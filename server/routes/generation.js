

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../services/database');
const { generatePlan, generateShoppingListOnly, generateImageForRecipe } = require('../services/geminiService');
const { savePlanToDatabase } = require('../services/jobService');

const jobs = {}; // In-memory Job-Speicher

// Startet einen Job zur Plangenerierung
router.post('/generate-plan-job', async (req, res) => {
    const { settings, previousPlanRecipes } = req.body;
    const jobId = crypto.randomBytes(16).toString('hex');
    
    jobs[jobId] = { status: 'pending', plan: null, error: null };
    
    res.status(202).json({ jobId });

    // Asynchrone Verarbeitung
    (async () => {
        try {
            // --- SCHRITT 1: Plan und Rezepte generieren ---
            jobs[jobId].status = 'generating_plan';
            const generatedPlan = await generatePlan(settings, previousPlanRecipes);
            
            // Plan mit leerer Einkaufsliste speichern, um IDs zu erhalten
            const savedPlanWithRecipes = await savePlanToDatabase(generatedPlan, settings);
            
            // --- SCHRITT 2: Einkaufsliste generieren ---
            jobs[jobId].status = 'generating_shopping_list';
            
            // BEHOBEN: Zutaten für die Einkaufsliste manuell skalieren, basierend auf den Planeinstellungen.
            // Die KI generiert Rezepte für 1 Person, aber die Einkaufsliste muss für die in den Einstellungen angegebene Personenzahl sein.
            const scaledIngredients = [];
            const persons = settings.persons || 1; // Personenanzahl aus den Einstellungen holen.

            // Alle Mahlzeiten der Woche durchgehen, um alle Zutaten zu sammeln.
            savedPlanWithRecipes.weeklyPlan.forEach(dayPlan => {
                dayPlan.meals.forEach(meal => {
                    const recipe = meal.recipe;
                    if (recipe && Array.isArray(recipe.ingredients)) {
                        const basePersons = recipe.base_persons || 1; // Sollte für neue Rezepte immer 1 sein.
                        recipe.ingredients.forEach(ing => {
                            const quantity = typeof ing.quantity === 'number' ? ing.quantity : 0;
                            const scaledQuantity = (quantity / basePersons) * persons;
                            scaledIngredients.push({
                                ingredient: ing.ingredient,
                                quantity: scaledQuantity,
                                unit: ing.unit
                            });
                        });
                    }
                });
            });

            // Die KI mit der korrekt skalierten Zutatenliste aufrufen.
            const shoppingList = await generateShoppingListOnly(scaledIngredients);
            
            // Plan in der DB mit der neuen Einkaufsliste aktualisieren
            await pool.query(
                'UPDATE plans SET shoppingList = ? WHERE id = ?',
                [JSON.stringify(shoppingList), savedPlanWithRecipes.id]
            );

            // Einkaufsliste zum Plan-Objekt für die Rückgabe hinzufügen
            savedPlanWithRecipes.shoppingList = shoppingList;
            
            jobs[jobId].plan = savedPlanWithRecipes;
            jobs[jobId].status = 'complete';

        } catch (error) {
            console.error(`Fehler bei Job ${jobId}:`, error);
            jobs[jobId].status = 'error';
            jobs[jobId].error = error.message || 'Ein unbekannter Fehler ist aufgetreten.';
        }
    })();
});

// Ruft den Status eines Plangenerierungsjobs ab
router.get('/generate-plan-job/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobs[jobId];

    if (!job) {
        return res.status(404).json({ error: 'Job nicht gefunden.' });
    }

    res.json(job);

    // Wenn der Job abgeschlossen ist, wird er nach dem Abrufen gelöscht
    if (job.status === 'complete' || job.status === 'error') {
        delete jobs[jobId];
    }
});

// Generiert ein Bild für ein Rezept
router.post('/generate-image', async (req, res) => {
    const { recipe, attempt } = req.body;
    try {
        const result = await generateImageForRecipe(recipe, attempt);
        res.json(result);
    } catch (error) {
        console.error('Fehler bei der Bildgenerierung:', error);
        res.status(500).json({ error: error.message });
    }
});

// Speichert ein generiertes Bild
router.post('/save-image', async (req, res) => {
    const { recipeId, base64Data } = req.body;
    
    try {
        // 1. Finde den Titel des Rezepts
        const [[recipe]] = await pool.query('SELECT title FROM recipes WHERE id = ?', [recipeId]);
        if (!recipe) {
            return res.status(404).json({ error: 'Rezept nicht gefunden.' });
        }
        const recipeTitle = recipe.title;

        // 2. Speichere die Bilddatei
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
        const imagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');
        const filePath = path.join(imagesDir, fileName);
        const fileUrl = `/images/recipes/${fileName}`;
        await fs.writeFile(filePath, imageBuffer);

        // 3. Füge das Bild in die `recipe_images`-Tabelle ein oder aktualisiere es.
        // Die Verknüpfung erfolgt über den Titel.
        await pool.query(
            'INSERT INTO recipe_images (recipe_title, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)',
            [recipeTitle, fileUrl]
        );

        res.json({ imageUrl: fileUrl });

    } catch (error) {
        console.error('Fehler beim Speichern des Bildes:', error);
        res.status(500).json({ error: 'Bild konnte nicht gespeichert werden.' });
    }
});


module.exports = router;