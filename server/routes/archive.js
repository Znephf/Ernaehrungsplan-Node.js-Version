

const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { saveCustomPlanToDatabase } = require('../services/jobService');

// Holt das gesamte Plan-Archiv
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query(`
            SELECT 
                p.id, 
                p.name, 
                p.createdAt, 
                p.settings, 
                p.shareId,
                p.shoppingList
            FROM plans p
            ORDER BY p.createdAt DESC
        `);

        const archiveEntries = [];

        for (const plan of plans) {
            // Eine einzige Abfrage, um alle verknüpften Rezeptdaten zu erhalten
            const [recipeLinks] = await pool.query(`
                SELECT 
                    r.id, r.title, r.ingredients, r.instructions, r.totalCalories, r.protein, r.carbs, r.fat, r.category,
                    r.dietaryPreference, r.dietType, r.dishComplexity, r.isGlutenFree, r.isLactoseFree,
                    ri.image_url,
                    pr.day_of_week,
                    pr.meal_type
                FROM plan_recipes pr
                JOIN recipes r ON pr.recipe_id = r.id
                LEFT JOIN recipe_images ri ON r.title = ri.recipe_title
                WHERE pr.plan_id = ?
            `, [plan.id]);

            const weeklyPlan = [];
            const recipes = [];
            const recipeMap = new Map(); // Zum Deduplizieren von Rezepten

            for (const link of recipeLinks) {
                let recipe = recipeMap.get(link.id);
                if (!recipe) {
                    recipe = {
                        id: link.id,
                        title: link.title,
                        ingredients: JSON.parse(link.ingredients || '[]'),
                        instructions: JSON.parse(link.instructions || '[]'),
                        totalCalories: link.totalCalories,
                        protein: link.protein,
                        carbs: link.carbs,
                        fat: link.fat,
                        category: link.category,
                        dietaryPreference: link.dietaryPreference,
                        dietType: link.dietType,
                        dishComplexity: link.dishComplexity,
                        isGlutenFree: link.isGlutenFree,
                        isLactoseFree: link.isLactoseFree,
                        image_url: link.image_url,
                    };
                    recipeMap.set(link.id, recipe);
                    recipes.push(recipe);
                }

                let dayPlan = weeklyPlan.find(dp => dp.day === link.day_of_week);
                if (!dayPlan) {
                    dayPlan = { day: link.day_of_week, meals: [], totalCalories: 0 };
                    weeklyPlan.push(dayPlan);
                }
                
                dayPlan.meals.push({ mealType: link.meal_type, recipe: recipe });
                dayPlan.totalCalories += recipe.totalCalories || 0;
            }

            // Sortiere die Tage in der korrekten Reihenfolge
            const daysOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
            weeklyPlan.sort((a, b) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day));

            archiveEntries.push({
                id: plan.id,
                name: plan.name,
                createdAt: new Date(plan.createdAt).toLocaleString('de-DE'),
                settings: JSON.parse(plan.settings || '{}'),
                shareId: plan.shareId,
                weeklyPlan,
                recipes,
                shoppingList: JSON.parse(plan.shoppingList || '[]')
            });
        }
        
        res.json(archiveEntries);
    } catch (error) {
        console.error('Fehler beim Laden des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

// Speichert einen benutzerdefinierten Plan aus dem Planner
router.post('/plan', async (req, res) => {
    try {
        const { name, persons, mealsByDay } = req.body;
        if (!name || !persons || !mealsByDay) {
            return res.status(400).json({ error: 'Missing required fields: name, persons, mealsByDay.' });
        }
        
        const savedPlan = await saveCustomPlanToDatabase({ name, persons, mealsByDay });
        res.status(201).json(savedPlan);

    } catch (error) {
        console.error('Error saving custom plan:', error);
        res.status(500).json({ error: 'Failed to save custom plan.' });
    }
});

// Löscht einen Plan (aber nicht die zugehörigen Rezepte)
router.delete('/plan/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Plan ID is required.' });
    }

    try {
        // Dank "ON DELETE CASCADE" bei der `plan_id` in `plan_recipes`
        // werden die Verknüpfungen automatisch gelöscht, aber die Rezepte selbst bleiben erhalten.
        const [result] = await pool.query('DELETE FROM plans WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Plan not found.' });
        }
        
        res.status(200).json({ message: `Plan with ID ${id} successfully deleted.` });

    } catch (error) {
        console.error(`Error deleting plan with ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to delete plan.' });
    }
});

module.exports = router;