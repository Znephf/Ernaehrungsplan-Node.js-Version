const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { saveImageAndUpdatePlan } = require('../services/jobService');
const { generateShoppingListForRecipes } = require('../services/geminiService');

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
                    id: row.id,
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

// Neuen individuellen Plan speichern
router.post('/archive/custom-plan', async (req, res) => {
    const { name, persons, dinners } = req.body;
    if (!name || !persons || !Array.isArray(dinners) || dinners.length === 0) {
        return res.status(400).json({ error: 'Unvollständige Plandaten erhalten.' });
    }

    try {
        // 1. Wochenplan erstellen
        const weeklyPlan = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map(day => {
            const dinnerEntry = dinners.find(d => d.day === day);
            return {
                day,
                breakfast: "Individuelles Frühstück",
                breakfastCalories: 0,
                dinner: dinnerEntry ? dinnerEntry.recipe.title : "Kein Abendessen geplant",
                dinnerCalories: dinnerEntry ? dinnerEntry.recipe.totalCalories : 0
            };
        });

        // 2. Rezeptliste erstellen
        const recipes = dinners.map(d => ({ ...d.recipe, day: d.day }));
        
        // 3. Einkaufsliste generieren
        const shoppingList = await generateShoppingListForRecipes(recipes, persons);

        // 4. Plan-Daten und Einstellungen zusammenstellen
        const planData = {
            name,
            weeklyPlan,
            recipes,
            shoppingList,
            imageUrls: {} // Beginnt ohne Bilder
        };

        const settings = {
            persons: parseInt(persons, 10),
            kcal: Math.round(weeklyPlan.reduce((sum, day) => sum + day.dinnerCalories, 0) / 7), // Durchschnittliche Kcal
            dietaryPreference: 'omnivore', // Standard, könnte man ableiten
            dietType: 'balanced',
            dishComplexity: 'simple',
            isGlutenFree: false, // Standard, könnte man ableiten
            isLactoseFree: false,
            excludedIngredients: '',
            desiredIngredients: '',
            breakfastOption: 'custom',
            customBreakfast: 'Individuell',
        };

        // 5. In Datenbank speichern
        const [result] = await pool.query(
            'INSERT INTO archived_plans (name, settings, planData) VALUES (?, ?, ?)',
            [name, JSON.stringify(settings), JSON.stringify(planData)]
        );
        const newPlanId = result.insertId;
        
        // 6. Neuen Plan abrufen und zurückgeben
        const [rows] = await pool.query('SELECT * FROM archived_plans WHERE id = ?', [newPlanId]);
        const newPlan = {
            id: rows[0].id,
            ...JSON.parse(rows[0].settings),
            ...JSON.parse(rows[0].planData)
        };
        
        res.status(201).json(newPlan);

    } catch (error) {
        console.error('Fehler beim Speichern des individuellen Plans:', error);
        res.status(500).json({ error: 'Der individuelle Plan konnte nicht gespeichert werden.' });
    }
});

module.exports = router;
