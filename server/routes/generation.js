
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../services/database');
const { generatePlanAndShoppingList, generateImageForRecipe } = require('../services/geminiService');
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
            jobs[jobId].status = 'generating_plan';
            const generatedPlan = await generatePlanAndShoppingList(settings, previousPlanRecipes);
            
            jobs[jobId].status = 'generating_shopping_list'; // Status-Update
            
            // Speichere den Plan in der Datenbank. Diese Funktion gibt den vollständigen, gespeicherten Plan zurück.
            const savedPlan = await savePlanToDatabase(generatedPlan, settings);
            
            jobs[jobId].plan = savedPlan;
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
        const imagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');
        const filePath = path.join(imagesDir, fileName);
        const fileUrl = `/images/recipes/${fileName}`;

        await fs.writeFile(filePath, imageBuffer);

        // Füge das Bild in die `recipe_images` Tabelle ein oder hole die ID, falls es bereits existiert.
        const [insertResult] = await connection.query(
            'INSERT INTO recipe_images (image_url) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
            [fileUrl]
        );
        const imageId = insertResult.insertId;

        if (!imageId) {
            const [[{ id }]] = await connection.query('SELECT id FROM recipe_images WHERE image_url = ?', [fileUrl]);
            if (!id) throw new Error('Konnte die Bild-ID nicht ermitteln.');
            
            await connection.query('UPDATE recipes SET recipe_image_id = ? WHERE id = ?', [id, recipeId]);

        } else {
            // Verknüpfe das Bild mit dem Rezept
            await connection.query(
                'UPDATE recipes SET recipe_image_id = ? WHERE id = ?',
                [imageId, recipeId]
            );
        }

        await connection.commit();
        res.json({ imageUrl: fileUrl });

    } catch (error) {
        await connection.rollback();
        console.error('Fehler beim Speichern des Bildes:', error);
        res.status(500).json({ error: 'Bild konnte nicht gespeichert werden.' });
    } finally {
        connection.release();
    }
});


module.exports = router;
