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
        // BEHOBEN: Die Abfrage zielt nun auf die korrekte 'plans'-Tabelle, nicht mehr auf die veraltete 'archived_plans'.
        const [planRows] = await pool.query('SELECT id FROM plans WHERE id = ?', [planId]);
        if (planRows.length === 0) {
            return res.status(404).json({ error: 'Der angegebene Plan wurde nicht gefunden.' });
        }

        await pool.query(
            'INSERT INTO app_jobs (jobId, jobType, relatedPlanId) VALUES (?, ?, ?)',
            [jobId, 'share_preparation', planId]
        );
        
        processShareJob(jobId); // Startet die Verarbeitung im Hintergrund

        res.status(202).json({ jobId });
    } catch (error) {
        console.error('Fehler beim Erstellen des Share-Jobs:', error);
        res.status(500).json({ error: 'Job konnte nicht erstellt werden!' });
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
        
        // `resultJson` wird als Objekt oder null zurückgegeben, nicht als String
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