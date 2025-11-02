const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { generateShoppingListForRecipes } = require('../services/geminiService');

// GET all archived plans
router.get('/archive', async (req, res) => {
    try {
        const [plans] = await pool.query('SELECT * FROM archived_plans ORDER BY createdAt DESC');
        const [imageRows] = await pool.query('SELECT recipeTitle, imageUrl FROM recipe_images');
        
        const imageMap = new Map(imageRows.map(row => [row.recipeTitle, row.imageUrl]));

        const archive = plans.map(plan => {
            const settings = typeof plan.settings === 'string' ? JSON.parse(plan.settings) : (plan.settings || {});
            const planData = typeof plan.planData === 'string' ? JSON.parse(plan.planData) : (plan.planData || {});
            
            // Inject image URLs based on recipe titles
            const imageUrls = {};
            if (planData.recipes && Array.isArray(planData.recipes)) {
                planData.recipes.forEach(recipe => {
                    if (imageMap.has(recipe.title)) {
                        imageUrls[recipe.day] = imageMap.get(recipe.title);
                    }
                });
            }
            planData.imageUrls = imageUrls;

            return {
                id: plan.id,
                createdAt: new Date(plan.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                shareId: plan.shareId || null,
                name: planData.name || 'Unbenannter Plan',
                ...settings,
                ...planData
            };
        });
        res.json(archive);
    } catch (error) {
        console.error('Fehler beim Laden des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

// POST a new recipe image
router.post('/recipe-image', async (req, res) => {
    const { recipeTitle, imageUrl } = req.body;
    if (!recipeTitle || !imageUrl) {
        return res.status(400).json({ error: 'recipeTitle and imageUrl are required.' });
    }

    try {
        // Use ON DUPLICATE KEY UPDATE to handle existing recipes, updating the URL if a new one is generated.
        await pool.query(
            'INSERT INTO recipe_images (recipeTitle, imageUrl) VALUES (?, ?) ON DUPLICATE KEY UPDATE imageUrl = VALUES(imageUrl)',
            [recipeTitle, imageUrl]
        );
        res.status(201).json({ message: 'Image saved successfully.' });
    } catch (error) {
        console.error(`Error saving image for recipe "${recipeTitle}":`, error);
        res.status(500).json({ error: 'Could not save recipe image.' });
    }
});


// PUT (update) an existing plan
router.put('/archive/:id', async (req, res) => {
    const { id } = req.params;
    const plan = req.body;
    
    const settingsToSave = {
        persons: plan.persons,
        kcal: plan.kcal,
        dietaryPreference: plan.dietaryPreference,
        dietType: plan.dietType,
        dishComplexity: plan.dishComplexity,
        excludedIngredients: plan.excludedIngredients,
        desiredIngredients: plan.desiredIngredients,
        isGlutenFree: plan.isGlutenFree,
        isLactoseFree: plan.isLactoseFree,
        breakfastOption: plan.breakfastOption,
        customBreakfast: plan.customBreakfast,
    };
    
    const planDataToSave = {
        name: plan.name,
        shoppingList: plan.shoppingList,
        weeklyPlan: plan.weeklyPlan,
        recipes: plan.recipes,
        // Image URLs are no longer stored in the planData JSON blob
    };

    try {
        await pool.query(
            'UPDATE archived_plans SET name = ?, settings = ?, planData = ? WHERE id = ?',
            [plan.name, JSON.stringify(settingsToSave), JSON.stringify(planDataToSave), id]
        );
        res.json(plan); // Send back the full plan for optimistic UI updates
    } catch (error) {
        console.error(`Fehler beim Aktualisieren von Plan ${id}:`, error);
        res.status(500).json({ error: 'Plan konnte nicht aktualisiert werden.' });
    }
});

// POST a new custom plan
router.post('/archive/custom', async (req, res) => {
    const { name, recipes } = req.body;

    if (!name || !Array.isArray(recipes) || recipes.length === 0) {
        return res.status(400).json({ error: 'Planname und mindestens ein Rezept sind erforderlich.' });
    }

    try {
        const persons = 2; 
        const avgCalories = recipes.reduce((sum, r) => sum + r.totalCalories, 0) / recipes.length;
        const kcal = isNaN(avgCalories) ? 2000 : Math.round(avgCalories);

        const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
        
        const weeklyPlan = recipes.slice(0, 7).map((recipe, index) => {
            const day = daysOfWeek[index];
            recipe.day = day;
            return {
                day: day,
                breakfast: "Individuell",
                breakfastCalories: 0,
                dinner: recipe.title,
                dinnerCalories: recipe.totalCalories,
            };
        });

        const shoppingList = await generateShoppingListForRecipes(recipes, persons);

        const settings = {
            persons, kcal, dietaryPreference: 'vegetarian', dietType: 'balanced',
            dishComplexity: 'simple', excludedIngredients: '', desiredIngredients: '',
            isGlutenFree: false, isLactoseFree: false, breakfastOption: 'custom',
            customBreakfast: 'Individuell zusammengestellt'
        };

        const planData = { name, shoppingList, weeklyPlan, recipes };

        const [result] = await pool.query('INSERT INTO archived_plans (name, settings, planData) VALUES (?, ?, ?)', [name, JSON.stringify(settings), JSON.stringify(planData)]);
        const newPlanId = result.insertId;

        const newPlanEntry = {
            id: newPlanId,
            createdAt: new Date().toLocaleString('de-DE'),
            shareId: null,
            ...settings,
            ...planData,
        };
        
        res.status(201).json(newPlanEntry);
    } catch (error) {
        console.error('Fehler beim Speichern des individuellen Plans:', error);
        res.status(500).json({ error: 'Individueller Plan konnte nicht gespeichert werden.' });
    }
});

module.exports = router;
