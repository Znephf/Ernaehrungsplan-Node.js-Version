
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../services/database');

const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');

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
        // Base64-Daten in eine Datei umwandeln
        const base64Data = imageUrl.split(';base64,').pop();
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
        const filePath = path.join(publicImagesDir, fileName);
        
        fs.writeFileSync(filePath, imageBuffer);
        const fileUrl = `/images/recipes/${fileName}`;

        // Datenbankeintrag aktualisieren
        const [rows] = await pool.query('SELECT planData FROM archived_plans WHERE id = ?', [planId]);
        if (rows.length === 0) {
            // Wenn der Plan nicht gefunden wird, löschen wir das eben erstellte Bild wieder.
            fs.unlinkSync(filePath);
            return res.status(404).json({ error: 'Plan nicht gefunden.' });
        }

        const planData = typeof rows[0].planData === 'string' ? JSON.parse(rows[0].planData) : rows[0].planData;

        if (!planData.imageUrls) {
            planData.imageUrls = {};
        }
        planData.imageUrls[day] = fileUrl;

        await pool.query('UPDATE archived_plans SET planData = ? WHERE id = ?', [JSON.stringify(planData), planId]);

        res.status(200).json({ message: 'Bild erfolgreich gespeichert.', imageUrl: fileUrl });
    } catch (error) {
        console.error(`Fehler beim Speichern des Bildes für Plan ${planId}:`, error);
        res.status(500).json({ error: 'Bild konnte nicht verarbeitet oder in der DB gespeichert werden.' });
    }
});

module.exports = router;