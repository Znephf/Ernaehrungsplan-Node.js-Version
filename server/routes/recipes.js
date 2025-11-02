const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');

// GET all unique recipes from the database
router.get('/', async (req, res) => {
    try {
        const [recipes] = await pool.query('SELECT * FROM recipes ORDER BY title ASC');
        
        // Parse JSON fields for the frontend
        const formattedRecipes = recipes.map(recipe => ({
            ...recipe,
            ingredients: JSON.parse(recipe.ingredients || '[]'),
            instructions: JSON.parse(recipe.instructions || '[]'),
        }));

        res.json(formattedRecipes);
    } catch (error) {
        console.error('Failed to fetch all recipes:', error);
        res.status(500).json({ error: 'Could not fetch the recipe library.' });
    }
});

module.exports = router;