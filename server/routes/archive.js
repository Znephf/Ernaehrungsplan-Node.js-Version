const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../services/database');
const { generateShoppingListForRecipes } = require('../services/geminiService');

const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');


// Alle Pläne aus dem Archiv abrufen
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query('SELECT * FROM archived_plans ORDER BY createdAt DESC');
        const [imageRows] = await pool.query('SELECT recipe_title, image_url FROM recipe_images');
        
        const imageMap = new Map(imageRows.map(row => [row.recipe_title, row.image_url]));
        
        const archive = plans.map(row => {
            try {
                const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
                const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;
                
                if (!planData || typeof planData !== 'object' || !Array.isArray(planData.weeklyPlan) || !Array.isArray(planData.recipes) || !Array.isArray(planData.shoppingList)) {
                    console.warn(`[Archiv] Plan mit ID ${row.id} wird übersprungen, da Plandaten korrupt sind.`);
                    return null;
                }
                
                // Dynamisch Bild-URLs aus der zentralen Tabelle zuweisen
                const newImageUrls = {};
                for (const recipe of planData.recipes) {
                    if (imageMap.has(recipe.title)) {
                        newImageUrls[recipe.day] = imageMap.get(recipe.title);
                    }
                }
                planData.imageUrls = newImageUrls;


                return {
                    id: row.id,
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    shareId: row.shareId || null,
                    name: row.name, // Wichtig: Name aus der dedizierten Spalte verwenden
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

// Bild-URL für ein Rezept zentral speichern
router.post('/recipe-image', async (req, res) => {
    const { recipeTitle, base64Data } = req.body;
    if (!recipeTitle || !base64Data) {
        return res.status(400).json({ error: 'Fehlende Daten zum Speichern des Bildes.' });
    }

    try {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
        const filePath = path.join(publicImagesDir, fileName);
        const fileUrl = `/images/recipes/${fileName}`;
        
        fs.writeFileSync(filePath, imageBuffer);

        await pool.query(
            'INSERT INTO recipe_images (recipe_title, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)',
            [recipeTitle, fileUrl]
        );

        res.status(200).json({ message: 'Bild erfolgreich gespeichert.', imageUrl: fileUrl });
    } catch (error) {
        console.error(`Fehler beim Speichern des Bildes für Rezept "${recipeTitle}":`, error);
        res.status(500).json({ error: 'Bild konnte nicht verarbeitet oder in der DB gespeichert werden.' });
    }
});


// Neuen individuellen Plan speichern
router.post('/archive/custom-plan', async (req, res) => {
    const { name, persons, dinners } = req.body;
    if (!name || !persons || !Array.isArray(dinners) || dinners.length === 0) {
        return res.status(400).json({ error: 'Unvollständige Plandaten erhalten.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

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

        // 2. Rezeptliste erstellen (nur die tatsächlich verwendeten)
        const usedRecipes = dinners.map(d => ({ ...d.recipe, day: d.day }));
        
        // 3. Einkaufsliste generieren
        const shoppingList = await generateShoppingListForRecipes(usedRecipes, persons);

        // 4. Plan-Daten (ohne redundanten Namen) und Einstellungen zusammenstellen
        const planData = {
            weeklyPlan,
            recipes: usedRecipes,
            shoppingList,
        };

        const settings = {
            persons: parseInt(persons, 10),
            kcal: Math.round(weeklyPlan.reduce((sum, day) => sum + day.dinnerCalories, 0) / 7) || 0,
            dietaryPreference: 'omnivore',
            dietType: 'balanced',
            dishComplexity: 'simple',
            isGlutenFree: false,
            isLactoseFree: false,
            excludedIngredients: 'Individuell',
            desiredIngredients: 'Individuell',
            breakfastOption: 'custom',
            customBreakfast: 'Individuell',
        };

        // 5. In Datenbank speichern
        const [result] = await connection.query(
            'INSERT INTO archived_plans (name, settings, planData) VALUES (?, ?, ?)',
            [name, JSON.stringify(settings), JSON.stringify(planData)]
        );
        const newPlanId = result.insertId;

        await connection.commit();
        
        // 6. Neuen Plan abrufen und zurückgeben, um die UI zu aktualisieren
        const [rows] = await connection.query('SELECT * FROM archived_plans WHERE id = ?', [newPlanId]);
        
        if (rows.length === 0) {
            throw new Error('Der neu erstellte Plan konnte nicht sofort wiedergefunden werden.');
        }

        const newPlanRow = rows[0];
        const newPlan = {
            id: newPlanRow.id,
            createdAt: new Date(newPlanRow.createdAt).toLocaleString('de-DE'),
            shareId: newPlanRow.shareId,
            name: newPlanRow.name, // Explizit den Namen aus der DB-Spalte verwenden
            ...JSON.parse(newPlanRow.settings),
            ...JSON.parse(newPlanRow.planData)
        };
        
        res.status(201).json(newPlan);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Fehler beim Speichern des individuellen Plans:', error);
        res.status(500).json({ error: 'Der individuelle Plan konnte nicht gespeichert werden.' });
    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;