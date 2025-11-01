const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../services/database');
const { processShareJob } = require('../services/jobService');

// Erstellt einen neuen Job zur Vorbereitung des Teilens eines Plans
router.post('/share', async (req, res) => {
    const { planId } = req.body;
    if (!planId) {
        return res.status(400).json({ error: 'planId wird für die Joberstellung benötigt.' });
    }
    const jobId = crypto.randomBytes(16).toString('hex');
    try {
        console.log(`[Share Job] Starte Joberstellung für planId: ${planId}`);
        // Prüfen, ob der Plan existiert
        const [planRows] = await pool.query('SELECT id FROM archived_plans WHERE id = ?', [planId]);
        if (planRows.length === 0) {
            console.error(`[Share Job] Plan mit ID ${planId} nicht gefunden.`);
            return res.status(404).json({ error: 'Der angegebene Plan wurde nicht gefunden.' });
        }

        console.log(`[Share Job] Plan ${planId} gefunden. Füge Job ${jobId} in app_jobs ein.`);
        await pool.query(
            'INSERT INTO app_jobs (jobId, jobType, relatedPlanId) VALUES (?, ?, ?)',
            [jobId, 'share_preparation', planId]
        );
        console.log(`[Share Job] Job ${jobId} erfolgreich eingefügt. Starte Hintergrundverarbeitung.`);
        
        processShareJob(jobId); // Startet die Verarbeitung im Hintergrund

        res.status(202).json({ jobId });
    } catch (error) {
        console.error(`[Share Job] KRITISCHER FEHLER beim Erstellen des Share-Jobs für planId ${planId}:`, error);
        res.status(500).json({ error: 'Job konnte nicht erstellt werden.' });
    }
});

// Ruft den Status eines beliebigen Jobs ab
router.get('/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT status, progressText, resultJson, errorMessage FROM app_jobs WHERE jobId = ?',
            [jobId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Job nicht gefunden.' });
        }
        
        const result = rows[0];
        if (result.resultJson && typeof result.resultJson === 'string') {
            result.resultJson = JSON.parse(result.resultJson);
        }

        res.json(result);
    } catch (error) {
        console.error(`Fehler beim Abrufen des Job-Status für ${jobId}:`, error);
        res.status(500).json({ error: 'Job-Status konnte nicht abgerufen werden.' });
    }
});

module.exports = router;