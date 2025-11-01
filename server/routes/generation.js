
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../services/database');
const { processGenerationJob, generateImageForRecipe } = require('../services/geminiService');

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
            const [planRows] = await pool.query('SELECT * FROM archived_plans WHERE id = ?', [planId]);
            if (planRows.length > 0) {
                const row = planRows[0];
                const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
                const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;

                const newPlanEntry = {
                    id: row.id.toString(),
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    shareId: row.shareId || null,
                    name: planData.name || 'Unbenannter Plan',
                    ...settings,
                    ...planData
                };
                return res.json({ status, plan: newPlanEntry, error: errorMessage });
            }
        }
        
        res.json({ status, planId: planId?.toString(), error: errorMessage });

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