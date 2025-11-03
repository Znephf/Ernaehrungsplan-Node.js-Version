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
                ri.image_url
            FROM recipes r
            LEFT JOIN recipe_images ri ON r.title = ri.recipe_title
            ORDER BY r.title ASC
        `);
        
        const defaultPersons = 2; // Default scaling for the recipe archive view

        const parsedRecipes = recipes.map(recipe => {
            const ingredients = JSON.parse(recipe.ingredients || '[]');
            const basePersons = recipe.base_persons || 1;
            
            // Scale ingredients for display and convert back to simple strings
            const scaledIngredients = ingredients.map(ing => {
                if (typeof ing === 'object' && ing.quantity !== undefined) {
                    const scaledQuantity = (ing.quantity / basePersons) * defaultPersons;
                     // Simple formatting, can be improved
                    if (ing.unit.toLowerCase() === 'stück' && scaledQuantity === 1) {
                         return `${ing.ingredient}`;
                    }
                    return `${scaledQuantity}${ing.unit || ''} ${ing.ingredient}`;
                }
                return ing; // Fallback for old string format
            });

            return {
                ...recipe,
                ingredients: scaledIngredients,
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