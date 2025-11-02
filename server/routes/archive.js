
const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');

// Holt das gesamte Plan-Archiv
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.createdAt, 
                p.settings, 
                p.shareId
            FROM plans p
            ORDER BY p.createdAt DESC
        `);

        const archiveEntries = [];

        for (const plan of plans) {
            // Hole alle Rezepte, die zu diesem Plan gehören
            const [recipes] = await pool.query(`
                SELECT 
                    r.id, r.title, r.ingredients, r.instructions, r.totalCalories, r.protein, r.carbs, r.fat, r.category,
                    r.dietaryPreference, r.dietType, r.dishComplexity, r.isGlutenFree, r.isLactoseFree,
                    ri.image_url
                FROM plan_recipes pr
                JOIN recipes r ON pr.recipe_id = r.id
                LEFT JOIN recipe_images ri ON r.recipe_image_id = ri.id
                WHERE pr.plan_id = ?
            `, [plan.id]);
            
            // Hole die Tageszuordnung für diesen Plan
            const [planDays] = await pool.query(
                'SELECT recipe_id, day_of_week, meal_type FROM plan_recipes WHERE plan_id = ?', 
                [plan.id]
            );

            const weeklyPlan = [];
            const shoppingList = []; // Die Generierung der Einkaufsliste erfolgt serverseitig beim Erstellen, hier wird sie nur aus dem JSON gelesen, falls vorhanden
            
            // Die JSON-basierten `weeklyPlan` und `shoppingList` sind nicht mehr direkt in der DB,
            // daher muss die Struktur für das Frontend hier rekonstruiert werden.
            
            const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
            const recipeMap = new Map(recipes.map(r => [r.id, r]));

            for (const day of daysOfWeek) {
                const mealsForDay = planDays
                    .filter(pd => pd.day_of_week === day)
                    .map(pd => ({
                        mealType: pd.meal_type,
                        recipe: recipeMap.get(pd.recipe_id)
                    }))
                    .filter(meal => meal.recipe); // Nur Mahlzeiten mit gültigem Rezept

                if (mealsForDay.length > 0) {
                     weeklyPlan.push({
                        day,
                        meals: mealsForDay,
                        totalCalories: mealsForDay.reduce((sum, meal) => sum + (meal.recipe.totalCalories || 0), 0)
                    });
                }
            }
            
            // parse ingredients and instructions
            const parsedRecipes = recipes.map(r => ({
                ...r,
                ingredients: JSON.parse(r.ingredients || '[]'),
                instructions: JSON.parse(r.instructions || '[]')
            }));

            archiveEntries.push({
                id: plan.id,
                name: plan.name,
                createdAt: new Date(plan.createdAt).toLocaleString('de-DE'),
                settings: JSON.parse(plan.settings || '{}'),
                shareId: plan.shareId,
                weeklyPlan,
                recipes: parsedRecipes,
                shoppingList: JSON.parse(plan.shoppingList || '[]') // shoppingList ist noch Teil von `plans`
            });
        }
        
        res.json(archiveEntries);
    } catch (error) {
        console.error('Fehler beim Laden des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

module.exports = router;
