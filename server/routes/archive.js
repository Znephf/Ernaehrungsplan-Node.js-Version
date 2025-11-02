const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../services/database');
const { generateShoppingListForRecipes } = require('../services/geminiService');

const publicImagesDir = path.join(__dirname, '..', '..', 'public', 'images', 'recipes');

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// Alle Pläne aus dem Archiv abrufen
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query(`
            SELECT 
                p.id, p.name, p.createdAt, p.settings, p.shareId,
                pr.day_of_week, pr.meal_type,
                r.id as recipe_id, r.title, r.ingredients, r.instructions, r.totalCalories, r.protein, r.carbs, r.fat, r.category, r.image_url
            FROM plans p
            JOIN plan_recipes pr ON p.id = pr.plan_id
            JOIN recipes r ON pr.recipe_id = r.id
            ORDER BY p.createdAt DESC, FIELD(pr.day_of_week, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag');
        `);
        
        if (plans.length === 0) {
            return res.json([]);
        }

        // Manuelles Gruppieren der Ergebnisse in JavaScript
        const groupedPlans = plans.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = {
                    id: row.id,
                    name: row.name,
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
                    shareId: row.shareId,
                    weeklyPlan: [], // Wird unten befüllt
                    recipes: [], // Wird unten befüllt
                    shoppingList: [] // Wird später generiert oder müsste separat geladen werden
                };
            }
            
            const recipe = {
                id: row.recipe_id,
                title: row.title,
                ingredients: typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : row.ingredients,
                instructions: typeof row.instructions === 'string' ? JSON.parse(row.instructions) : row.instructions,
                totalCalories: row.totalCalories,
                protein: row.protein,
                carbs: row.carbs,
                fat: row.fat,
                category: row.category,
                image_url: row.image_url
            };

            // Doppeltes Hinzufügen von Rezepten vermeiden
            if (!acc[row.id].recipes.some(r => r.id === recipe.id)) {
                 acc[row.id].recipes.push(recipe);
            }
           
            let dayPlan = acc[row.id].weeklyPlan.find(dp => dp.day === row.day_of_week);
            if (!dayPlan) {
                dayPlan = { day: row.day_of_week, meals: [], totalCalories: 0 };
                acc[row.id].weeklyPlan.push(dayPlan);
            }
            
            dayPlan.meals.push({ mealType: row.meal_type, recipe });
            dayPlan.totalCalories += recipe.totalCalories;

            return acc;
        }, {});

        // Wochenpläne sortieren und Einkaufslisten generieren
        const finalArchive = await Promise.all(Object.values(groupedPlans).map(async (plan) => {
            plan.weeklyPlan.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day));
            // Generiere die Einkaufsliste on-the-fly für die Anzeige im Archiv
            plan.shoppingList = await generateShoppingListForRecipes(plan.recipes, plan.settings.persons);
            return plan;
        }));

        res.json(finalArchive);
    } catch (error) {
        console.error('Fehler beim Abrufen des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});


// Bild-URL für ein Rezept zentral speichern
router.post('/recipe-image', async (req, res) => {
    const { recipeId, base64Data } = req.body;
    if (!recipeId || !base64Data) {
        return res.status(400).json({ error: 'Fehlende Daten zum Speichern des Bildes.' });
    }

    try {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
        const filePath = path.join(publicImagesDir, fileName);
        const fileUrl = `/images/recipes/${fileName}`;
        
        fs.writeFileSync(filePath, imageBuffer);

        await pool.query(
            'UPDATE recipes SET image_url = ? WHERE id = ?',
            [fileUrl, recipeId]
        );

        res.status(200).json({ message: 'Bild erfolgreich gespeichert.', imageUrl: fileUrl });
    } catch (error) {
        console.error(`Fehler beim Speichern des Bildes für Rezept-ID "${recipeId}":`, error);
        res.status(500).json({ error: 'Bild konnte nicht verarbeitet oder in der DB gespeichert werden.' });
    }
});


// Neuen individuellen Plan speichern
router.post('/archive/custom-plan', async (req, res) => {
    const { name, persons, mealsByDay } = req.body;
    if (!name || !persons || typeof mealsByDay !== 'object') {
        return res.status(400).json({ error: 'Unvollständige Plandaten erhalten.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Settings-Objekt für den neuen Plan erstellen
        const settings = {
            persons: parseInt(persons, 10),
            kcal: 0, // Wird später berechnet
            dietaryPreference: 'omnivore',
            dietType: 'balanced',
            dishComplexity: 'simple',
            isGlutenFree: false,
            isLactoseFree: false,
            includedMeals: Object.values(mealsByDay).flatMap(dayMeals => dayMeals.map(m => m.mealType)),
        };

        // 2. Plan in `plans` Tabelle einfügen
        const [planResult] = await connection.query(
            'INSERT INTO plans (name, settings) VALUES (?, ?)',
            [name, JSON.stringify(settings)]
        );
        const newPlanId = planResult.insertId;

        // 3. Alle Rezepte sammeln und in `plan_recipes` eintragen
        const allRecipesInPlan = [];
        for (const day in mealsByDay) {
            const dayMeals = mealsByDay[day];
            for (const meal of dayMeals) {
                 allRecipesInPlan.push(meal.recipe);
                 await connection.query(
                    'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                    [newPlanId, meal.recipe.id, day, meal.mealType]
                );
            }
        }
        
        // 4. Gesamt-Kalorien berechnen und Plan aktualisieren
        const totalCalories = allRecipesInPlan.reduce((sum, recipe) => sum + recipe.totalCalories, 0);
        const avgCalories = totalCalories / 7;
        settings.kcal = Math.round(avgCalories);
        await connection.query('UPDATE plans SET settings = ? WHERE id = ?', [JSON.stringify(settings), newPlanId]);

        await connection.commit();
        
        res.status(201).json({ message: "Plan erfolgreich erstellt", planId: newPlanId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Fehler beim Speichern des individuellen Plans:', error);
        res.status(500).json({ error: 'Der individuelle Plan konnte nicht gespeichert werden.' });
    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;
