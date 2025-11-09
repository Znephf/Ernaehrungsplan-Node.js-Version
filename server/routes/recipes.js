const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');

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

module.exports = router;