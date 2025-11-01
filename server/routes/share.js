
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../services/database');
const { generateShareableHtml } = require('../services/htmlGenerator');

const publicSharesDir = path.join(__dirname, '..', '..', 'public', 'shares');

// Neuer Endpunkt, um zu prüfen, ob bereits ein Link für einen Plan existiert
router.get('/share-plan/:planId', async (req, res) => {
    const { planId } = req.params;
    try {
        const [rows] = await pool.query('SELECT shareId FROM archived_plans WHERE id = ?', [planId]);
        
        if (rows.length > 0 && rows[0].shareId) {
            const shareUrl = `/shares/${rows[0].shareId}.html`;
            return res.json({ shareUrl });
        }
        
        res.status(404).json({ error: 'Kein geteilter Link für diesen Plan gefunden.' });

    } catch (error) {
        console.error(`Fehler beim Prüfen des Share-Links für Plan-ID ${planId}:`, error);
        res.status(500).json({ error: 'Serverfehler beim Prüfen des Links.' });
    }
});


// Erstellt einen neuen teilbaren Link (oder aktualisiert die Datei, falls sie fehlt)
router.post('/share-plan', async (req, res) => {
    const { plan, imageUrls } = req.body;
    if (!plan || !plan.id || !imageUrls || !plan.name || !plan.weeklyPlan || !plan.recipes || !plan.shoppingList) {
        return res.status(400).json({ error: 'Unvollständige Plandaten für die Freigabe erhalten.' });
    }

    try {
        const [rows] = await pool.query('SELECT shareId FROM archived_plans WHERE id = ?', [plan.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Der zu teilende Plan wurde im Archiv nicht gefunden.' });
        }

        let shareId = rows[0].shareId;
        
        if (!shareId) {
            // Fall 1: Es gibt noch keinen Link, also erstellen wir einen neuen.
            shareId = crypto.randomBytes(12).toString('hex');
            const htmlContent = generateShareableHtml(plan, imageUrls);
            const fileName = `${shareId}.html`;
            const filePath = path.join(publicSharesDir, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf-8');

            const [updateResult] = await pool.query(
                'UPDATE archived_plans SET shareId = ? WHERE id = ?',
                [shareId, plan.id]
            );

            if (updateResult.affectedRows === 0) {
                throw new Error(`Konnte den Plan mit ID ${plan.id} nicht in der Datenbank finden, um die Share-ID zu speichern.`);
            }
            console.log(`Neuer Share-Link für Plan ID ${plan.id} erstellt: ${shareId}`);
        } else {
            // Fall 2: Link existiert, aber wir stellen sicher, dass die HTML-Datei vorhanden ist.
             console.log(`Bestehender Share-Link für Plan ID ${plan.id} gefunden: ${shareId}`);
            const fileName = `${shareId}.html`;
            const filePath = path.join(publicSharesDir, fileName);
            if (!fs.existsSync(filePath)) {
                console.warn(`Share-Datei für ${shareId} nicht gefunden. Erstelle sie neu.`);
                const htmlContent = generateShareableHtml(plan, imageUrls);
                fs.writeFileSync(filePath, htmlContent, 'utf-8');
            }
        }
        
        const shareUrl = `/shares/${shareId}.html`;
        res.json({ shareUrl, shareId });

    } catch (error) {
        console.error('Fehler beim Erstellen des Links zum Teilen:', error);
        res.status(500).json({ error: 'Der Link zum Teilen konnte nicht erstellt werden.' });
    }
});

module.exports = router;
