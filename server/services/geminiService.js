

const { GoogleGenAI } = require('@google/genai');
const { pool } = require('./database');
const { API_KEY, API_KEY_FALLBACK } = process.env;

/**
 * Führt eine API-Anfrage an Gemini aus und verwendet bei einem Fehler automatisch einen Fallback-API-Schlüssel.
 * @param {object} requestPayload - Das Objekt, das an `ai.models.generateContent` übergeben wird.
 * @returns {Promise<any>} Die erfolgreiche Antwort von der API.
 * @throws {Error} Wirft einen Fehler, wenn beide API-Schlüssel fehlschlagen oder keiner verfügbar ist.
 */
async function generateWithFallback(requestPayload) {
    let lastError = null;

    // 1. Sicherstellen, dass mindestens ein Schlüssel verfügbar ist.
    if (!API_KEY && !API_KEY_FALLBACK) {
        throw new Error('FATAL: Es wurden keine API_KEY oder API_KEY_FALLBACK in den Umgebungsvariablen gefunden.');
    }

    // 2. Versuche den API-Aufruf mit dem primären API_KEY.
    if (API_KEY) {
        try {
            console.log('Versuche API-Aufruf mit primärem API_KEY...');
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent(requestPayload);
            console.log('API-Aufruf mit primärem Schlüssel erfolgreich.');
            return response;
        } catch (error) {
            console.warn(`API-Aufruf mit primärem API_KEY fehlgeschlagen: ${error.message}`);
            lastError = error; // Speichere den Fehler und fahre mit dem Fallback fort.
        }
    } else {
        console.log('Primärer API_KEY nicht gesetzt, gehe direkt zum Fallback-Schlüssel.');
    }

    // 3. Wenn der primäre Schlüssel fehlgeschlagen ist oder nicht vorhanden war, versuche es mit dem Fallback-Schlüssel.
    if (API_KEY_FALLBACK) {
        try {
            console.log('Versuche API-Aufruf mit API_KEY_FALLBACK...');
            const ai = new GoogleGenAI({ apiKey: API_KEY_FALLBACK });
            const response = await ai.models.generateContent(requestPayload);
            console.log('API-Aufruf mit Fallback-Schlüssel erfolgreich.');
            return response;
        } catch (error) {
            console.error(`API-Aufruf mit Fallback-Schlüssel API_KEY_FALLBACK ebenfalls fehlgeschlagen: ${error.message}`);
            lastError = error; // Aktualisiere den Fehler mit dem neuesten Fehlschlag.
        }
    } else {
        console.log('Fallback-Schlüssel API_KEY_FALLBACK nicht gesetzt.');
    }

    // 4. Wenn alle Versuche fehlgeschlagen sind, werfe den zuletzt aufgezeichneten Fehler.
    if (lastError) {
        throw lastError;
    }
    
    // Dieser Fall sollte durch die anfängliche Prüfung abgedeckt sein, dient aber als Absicherung.
    throw new Error('Keine API-Schlüssel verfügbar, um die Anfrage zu versuchen.');
}


const MEAL_CATEGORIES = ['breakfast', 'lunch', 'coffee', 'dinner', 'snack'];

const generatePlanAndShoppingList = async (settings, previousPlanRecipes = []) => {
    const {
        persons, kcal, dietaryPreference, dietType, dishComplexity,
        excludedIngredients, desiredIngredients, isGlutenFree, isLactoseFree, includedMeals,
        mainMealFocus
    } = settings;

    const includedMealsText = includedMeals && includedMeals.length > 0
        ? `The user wants these meals: ${includedMeals.join(', ')}.`
        : 'The user wants breakfast and dinner.';

    const dietPreferenceText = {
        omnivore: 'omnivore (includes meat and fish)',
        vegetarian: 'vegetarian (no meat or fish)',
        vegan: 'vegan (no animal products at all, including dairy, eggs, and honey)'
    }[dietaryPreference];
    
    const previousRecipesText = previousPlanRecipes.length > 0
        ? `To ensure variety, please AVOID generating recipes with these titles from the user's last plan: ${previousPlanRecipes.map(r => `"${r.title}"`).join(', ')}.`
        : '';

    const mainMealFocusText = (mainMealFocus && mainMealFocus !== 'none' && includedMeals.includes('lunch') && includedMeals.includes('dinner'))
        ? `The user has specified a focus on '${mainMealFocus}' as the main meal. Please make sure the recipes for this meal are more substantial, while the other meal (lunch or dinner) can be lighter.`
        : '';
        
    const systemInstruction = `You are an expert nutritionist and chef specializing in creating balanced, delicious, and practical weekly meal plans. Your responses must be in valid JSON format. Do not include any text outside the JSON structure.
The JSON must strictly follow this schema:
{
  "name": "string (A creative and appealing name for the meal plan, in German)",
  "weeklyPlan": [ { "day": "string (e.g., 'Montag')", "meals": [ { "mealType": "string (Enum: ${MEAL_CATEGORIES.join(', ')})", "recipeId": "number (A unique integer ID for the recipe, starting from 1)" } ], "totalCalories": "number" } ],
  "recipes": [ { "id": "number (Must match a recipeId from weeklyPlan)", "title": "string (German)", "ingredients": ["string (German, with quantities for the specified number of persons)"], "instructions": ["string (German, step-by-step)"], "totalCalories": "number (For the entire dish for the specified number of persons)", "protein": "number (in grams)", "carbs": "number (in grams)", "fat": "number (in grams)", "category": "string (Enum: ${MEAL_CATEGORIES.join(', ')})" } ],
  "shoppingList": [ { "category": "string (e.g., 'Obst & Gemüse')", "items": ["string (German, with quantities)"] } ]
}
- Provide recipes only for the meal types specified by the user.
- Ensure all recipeIds in weeklyPlan correspond to a recipe in the recipes array.
- All calorie counts and nutritional values must be calculated for the specified number of people.
- The average daily calorie intake per person should be close to the user's target.
- The shopping list must be complete and categorized logically.
- All text must be in German.
- Do not use markdown in the JSON response.
- Do not include comments in the JSON.
`;

    const userPrompt = `
Create a new weekly meal plan based on these settings:
- Number of people: ${persons}
- Target calories per person per day: ${kcal}
- Dietary preference: ${dietPreferenceText}
- Diet type: ${dietType}
- Cooking complexity: ${dishComplexity}
- ${includedMealsText}
- Excluded ingredients: ${excludedIngredients || 'None'}
- Desired ingredients: ${desiredIngredients || 'None'}
- Gluten-free: ${isGlutenFree ? 'Yes' : 'No'}
- Lactose-free: ${isLactoseFree ? 'Yes' : 'No'}
${mainMealFocusText}
${previousRecipesText}

Please generate the full plan in the specified JSON format.
`;

    console.log('Generating plan with Gemini...');
    
    const response = await generateWithFallback({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
        }
    });

    try {
        const text = response.text.trim();
        const planData = JSON.parse(text);
        return planData;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON.", e);
        console.error("Raw response text:", response.text);
        throw new Error("The AI response was not in the expected format. Please try again.");
    }
};


const generateImageForRecipe = async (recipe, attempt) => {
    let detailLevel = "A bright, clean, professional food photograph of the finished dish.";
    if (attempt > 1) detailLevel = "A delicious looking, vibrant, professional food photograph of the dish, top-down view.";
    if (attempt > 3) detailLevel = "A hyper-realistic, appetizing food photograph of the dish, showing texture and detail, minimalist background.";

    const imagePrompt = `${detailLevel} The dish is called "${recipe.title}". It contains: ${recipe.ingredients.join(', ')}. Do not show any text or branding.`;

    const response = await generateWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: imagePrompt }] },
        config: {
            responseModalities: ['IMAGE'],
        }
    });

    return { apiResponse: response, debug: { imagePrompt } };
};

const generateShoppingListOnly = async (settings, recipes) => {
    const { persons } = settings;
    const recipeTitles = recipes.map(r => `"${r.title}"`).join(', ');

    const systemInstruction = `You are an expert shopping list generator. Your task is to create a complete, categorized shopping list based on a list of recipes and the number of people. Your response must be in valid JSON format, containing only the shopping list.
The JSON must strictly follow this schema:
{
  "shoppingList": [ { "category": "string (e.g., 'Obst & Gemüse')", "items": ["string (German, with quantities)"] } ]
}
- Consolidate ingredients from all recipes.
- Calculate the total required quantity of each item for the specified number of people for one week.
- All text must be in German.
- Do not use markdown or add any comments in the JSON.
`;

    const userPrompt = `
Generate a weekly shopping list for ${persons} people based on the following recipes: ${recipeTitles}.

Please provide only the "shoppingList" part of the response in the specified JSON format.
`;

    console.log('Generating shopping list with Gemini...');
    
    const response = await generateWithFallback({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
        }
    });

    try {
        const text = response.text.trim();
        const shoppingListData = JSON.parse(text);
        return shoppingListData.shoppingList;
    } catch (e) {
        console.error("Failed to parse Gemini response for shopping list as JSON.", e);
        console.error("Raw response text:", response.text);
        throw new Error("The AI response for the shopping list was not in the expected format.");
    }
};

module.exports = {
    generatePlanAndShoppingList,
    generateImageForRecipe,
    generateShoppingListOnly,
};
