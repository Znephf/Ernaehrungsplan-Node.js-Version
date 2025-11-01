
const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { saveImageAndUpdatePlan } = require('../services/jobService');

// Alle Pläne aus dem Archiv abrufen
router.get('/archive', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM archived_plans ORDER BY createdAt DESC');
        
        const archive = rows.map(row => {
            try {
                const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
                const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;
                
                if (!planData || typeof planData !== 'object' || !planData.name || !Array.isArray(planData.weeklyPlan) || !Array.isArray(planData.recipes) || !Array.isArray(planData.shoppingList)) {
                    console.warn(`[Archiv] Plan mit ID ${row.id} wird übersprungen, da Plandaten korrupt sind.`);
                    return null;
                }

                return {
                    id: row.id.toString(),
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    shareId: row.shareId || null,
                    name: planData.name,
                    ...settings,
                    ...planData
                };
            } catch(e) {
                console.error(`[Archiv] Fehler beim Verarbeiten von Plan mit ID ${row.id}:`, e);
                return null;
            }
        }).filter(entry => entry !== null);
        
        res.json(archive);
    } catch (error) {
        console.error('Fehler beim Abrufen des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

// Einen Plan aus dem Archiv löschen
router.delete('/archive/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM archived_plans WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Eintrag erfolgreich gelöscht.' });
        } else {
            res.status(404).json({ error: 'Eintrag nicht gefunden.' });
        }
    } catch (error) {
        console.error(`Fehler beim Löschen von Eintrag ${id}:`, error);
        res.status(500).json({ error: 'Eintrag konnte nicht gelöscht werden.' });
    }
});

// Bild-URL für ein Rezept in einem bestehenden Plan speichern/aktualisieren
router.put('/archive/image', async (req, res) => {
    const { planId, day, imageUrl } = req.body;
    if (!planId || !day || !imageUrl || !imageUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Fehlende oder ungültige Daten zum Speichern des Bildes.' });
    }

    try {
        const base64Data = imageUrl.split(';base64,').pop();
        const fileUrl = await saveImageAndUpdatePlan(planId, day, base64Data);
        res.status(200).json({ message: 'Bild erfolgreich gespeichert.', imageUrl: fileUrl });
    } catch (error) {
        console.error(`Fehler beim Speichern des Bildes für Plan ${planId}:`, error);
        if (error.message.includes('Plan nicht gefunden')) {
             return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Bild konnte nicht verarbeitet oder in der DB gespeichert werden.' });
    }
});

module.exports = router;