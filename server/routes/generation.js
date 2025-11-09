// Fix: Refactored the Gemini service to support batch processing of ingredients, reducing API calls.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { pool } = require('../services/database');
const { generatePlan, generateShoppingListOnly, generateImageForRecipe } = require('../services/geminiService');
const { savePlanToDatabase } = require('../services/jobService');

const jobs = {}; // In-memory Job-Speicher

// Startet einen Job zur Plangenerierung
router.post('/generate-plan-job', async (req, res) => {
    const { settings, previousPlanRecipes } = req.body;
    const jobId = crypto.randomBytes(16).toString('hex');
    
    jobs[jobId] = { status: 'pending', plan: null, error: null, keyUsed: null };
    
    res.status(202).json({ jobId });

    // Asynchrone Verarbeitung
    (async () => {
        try {
            // --- SCHRITT 1: Plan und Rezepte generieren ---
            jobs[jobId].status = 'generating_plan';
            const { planData: generatedPlan, keyUsed: planKeyUsed } = await generatePlan(settings, previousPlanRecipes);
            jobs[jobId].keyUsed = planKeyUsed; // Store which key was used
            
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

            // Rufen Sie die KI mit der vollständigen, skalierten Zutatenliste auf, damit sie eine intelligente Konsolidierung durchführen kann.
            const { shoppingList } = await generateShoppingListOnly(scaledIngredients);
            
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
        const { apiResponse, debug, keyUsed } = await generateImageForRecipe(recipe, attempt);
        res.json({ apiResponse, debug: { ...debug, keyUsed } });
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

        const imageBuffer = Buffer.from(base64Data, 'base64');
        const randomName = crypto.randomBytes(16).toString('hex');
        const imagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');

        // Dateipfade und URLs für Vollbild und Thumbnail
        const fullImagePath = path.join(imagesDir, `${randomName}.webp`);
        const thumbImagePath = path.join(imagesDir, `${randomName}-thumb.webp`);
        const fullImageUrl = `/images/recipes/${randomName}.webp`;
        const thumbImageUrl = `/images/recipes/${randomName}-thumb.webp`;

        // 2. Bilder mit Sharp verarbeiten und speichern
        // Vollbild (max 1024px breit, WebP-Format)
        await sharp(imageBuffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(fullImagePath);
            
        // Thumbnail (max 400px breit, WebP-Format)
        await sharp(imageBuffer)
            .resize({ width: 400, withoutEnlargement: true })
            .webp({ quality: 75 })
            .toFile(thumbImagePath);

        // 3. Füge beide Bild-URLs in die `recipe_images`-Tabelle ein oder aktualisiere sie.
        await pool.query(
            'INSERT INTO recipe_images (recipe_title, image_url, thumbnail_url) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), thumbnail_url = VALUES(thumbnail_url)',
            [recipeTitle, fullImageUrl, thumbImageUrl]
        );

        res.json({ imageUrl: fullImageUrl, thumbnailUrl: thumbImageUrl });

    } catch (error) {
        console.error('Fehler beim Speichern des Bildes:', error);
        res.status(500).json({ error: 'Bild konnte nicht gespeichert werden.' });
    }
});


module.exports = router;