const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');

// GET all archived plans in the format the frontend expects
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query('SELECT * FROM plans ORDER BY createdAt DESC');
        
        const archiveEntries = [];
        for (const plan of plans) {
            // Reconstruct each plan into an ArchiveEntry object
            const entry = {
                id: plan.id,
                name: plan.name,
                createdAt: new Date(plan.createdAt).toLocaleString('de-DE'),
                settings: JSON.parse(plan.settings || '{}'),
                shoppingList: JSON.parse(plan.shoppingList || '[]'),
                shareId: plan.shareId,
                weeklyPlan: [],
                recipes: [],
            };

            const [recipeLinks] = await pool.query(
                `SELECT pr.day_of_week, pr.meal_type, r.* FROM plan_recipes pr
                 JOIN recipes r ON pr.recipe_id = r.id
                 WHERE pr.plan_id = ?`,
                [plan.id]
            );
            
            entry.recipes = recipeLinks.map(r => ({
                ...r,
                ingredients: JSON.parse(r.ingredients || '[]'),
                instructions: JSON.parse(r.instructions || '[]')
            }));

            const weeklyPlanMap = new Map();
            recipeLinks.forEach(link => {
                const day = link.day_of_week;
                if (!weeklyPlanMap.has(day)) {
                    weeklyPlanMap.set(day, { day, meals: [], totalCalories: 0 });
                }
                const dayPlan = weeklyPlanMap.get(day);
                const recipe = entry.recipes.find(r => r.id === link.id);
                if(recipe){
                    dayPlan.meals.push({ mealType: link.meal_type, recipe });
                    // Sum up calories for the day
                    dayPlan.totalCalories += recipe.totalCalories || 0;
                }
            });

            entry.weeklyPlan = Array.from(weeklyPlanMap.values());
            archiveEntries.push(entry);
        }
        
        res.json(archiveEntries);

    } catch (error) {
        console.error('Failed to fetch archive:', error);
        res.status(500).json({ error: 'Could not fetch the plan archive.' });
    }
});

// Save a custom plan from the planner
router.post('/plan', async (req, res) => {
    const { name, persons, mealsByDay } = req.body;
    if (!name || !persons || !mealsByDay) {
        return res.status(400).json({ error: 'Missing required fields: name, persons, mealsByDay.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const settings = { persons }; // Simplified settings for now
        
        // A real implementation would generate a shopping list here.
        // For now, we'll save an empty one.
        const shoppingList = [];

        const [planResult] = await connection.query(
            'INSERT INTO plans (name, settings, shoppingList) VALUES (?, ?, ?)',
            [name, JSON.stringify(settings), JSON.stringify(shoppingList)]
        );
        const newPlanId = planResult.insertId;

        for (const day in mealsByDay) {
            for (const slot of mealsByDay[day]) {
                if (slot.recipe && slot.recipe.id) {
                     await connection.query(
                        'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                        [newPlanId, slot.recipe.id, day, slot.mealType]
                    );
                }
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Plan saved successfully.', planId: newPlanId });

    } catch (error) {
        await connection.rollback();
        console.error('Failed to save custom plan:', error);
        res.status(500).json({ error: 'Could not save the custom plan.' });
    } finally {
        connection.release();
    }
});


module.exports = router;
