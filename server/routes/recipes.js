
const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const { generateSingleRecipe } = require('../services/geminiService');

// Holt alle Rezepte aus der Datenbank
router.get('/', async (req, res) => {
    try {
        const [recipes] = await pool.query(`
            SELECT 
                r.id, r.title, r.ingredients, r.instructions, r.totalCalories, 
                r.protein, r.carbs, r.fat, r.category,
                r.dietaryPreference, r.dietType, r.dishComplexity, r.isGlutenFree, r.isLactoseFree,
                r.base_persons,
                ri.image_url,
                ri.thumbnail_url
            FROM recipes r
            LEFT JOIN recipe_images ri ON r.title = ri.recipe_title
            ORDER BY r.title ASC
        `);
        
        const parsedRecipes = recipes.map(recipe => {
            const ingredients = JSON.parse(recipe.ingredients || '[]');
            
            return {
                ...recipe,
                ingredients: ingredients,
                instructions: JSON.parse(recipe.instructions || '[]')
            };
        });

        res.json(parsedRecipes);
    } catch (error) {
        console.error('Fehler beim Laden der Rezepte:', error);
        res.status(500).json({ error: 'Rezepte konnten nicht geladen werden.' });
    }
});

// Neues Rezept generieren
router.post('/generate', async (req, res) => {
    const { 
        prompt, 
        includedIngredients, 
        excludedIngredients,
        mealCategory,
        dietaryPreference,
        dietType,
        dishComplexity,
        isGlutenFree,
        isLactoseFree
    } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt ist erforderlich.' });
    }

    try {
        const { recipe, keyUsed } = await generateSingleRecipe({ 
            prompt, 
            includedIngredients, 
            excludedIngredients,
            mealCategory,
            dietaryPreference,
            dietType,
            dishComplexity,
            isGlutenFree,
            isLactoseFree
        });
        
        // Rezept in die Datenbank speichern
        const [result] = await pool.query(
            `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category, dietaryPreference, dietType, dishComplexity, isGlutenFree, isLactoseFree, base_persons) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title=VALUES(title)`,
            [
                recipe.title,
                JSON.stringify(recipe.ingredients),
                JSON.stringify(recipe.instructions),
                recipe.totalCalories,
                recipe.protein, recipe.carbs, recipe.fat,
                recipe.category || mealCategory || 'dinner',
                recipe.dietaryPreference || dietaryPreference,
                recipe.dietType || dietType,
                recipe.dishComplexity || dishComplexity,
                recipe.isGlutenFree !== undefined ? recipe.isGlutenFree : isGlutenFree,
                recipe.isLactoseFree !== undefined ? recipe.isLactoseFree : isLactoseFree,
                1 // Base persons is always 1 for new generations
            ]
        );

        const newId = result.insertId > 0 ? result.insertId : (await pool.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]))[0][0].id;
        const savedRecipe = { ...recipe, id: newId, base_persons: 1 };

        res.json(savedRecipe);

    } catch (error) {
        console.error('Fehler bei der Rezept-Generierung:', error);
        res.status(500).json({ error: 'Rezept konnte nicht erstellt werden: ' + error.message });
    }
});

module.exports = router;
