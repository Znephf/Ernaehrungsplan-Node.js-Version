// Fix: Refactored the Gemini service to support batch processing of ingredients, reducing API calls.
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

const generatePlan = async (settings, previousPlanRecipes = []) => {
    const {
        persons, kcal, dietaryPreference, dietType, dishComplexity,
        excludedIngredients, desiredIngredients, isGlutenFree, isLactoseFree, includedMeals,
        mainMealFocus, useSameBreakfast, customBreakfastText, useSameSnack, customSnackText
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
        
    const breakfastInstruction = (useSameBreakfast && customBreakfastText)
        ? `IMPORTANT FOR BREAKFAST: The user wants the exact same breakfast every single day of the week. This meal is: "${customBreakfastText}". You MUST generate only ONE recipe object for this breakfast and use its recipeId for the breakfast meal on all seven days in the weeklyPlan.`
        : '';
        
    const snackInstruction = (useSameSnack && customSnackText)
        ? `IMPORTANT FOR SNACKS: The user wants the exact same snack every single day of the week. This meal is: "${customSnackText}". If snacks are included in the plan, you MUST generate only ONE recipe object for this snack and use its recipeId for the snack meal on all seven days in the weeklyPlan.`
        : '';
        
    const systemInstruction = `You are an expert nutritionist and chef specializing in creating balanced, delicious, and practical weekly meal plans. Your responses must be in valid JSON format. Do not include any text outside the JSON structure.
The JSON must strictly follow this schema:
{
  "name": "string (A creative and appealing name for the meal plan, in German)",
  "weeklyPlan": [ { "day": "string (e.g., 'Montag')", "meals": [ { "mealType": "string (Enum: ${MEAL_CATEGORIES.join(', ')})", "recipeId": "number (A unique integer ID for the recipe, starting from 1)" } ], "totalCalories": "number" } ],
  "recipes": [ { 
    "id": "number (Must match a recipeId from weeklyPlan)", 
    "title": "string (German)", 
    "ingredients": [ { "ingredient": "string (German)", "quantity": "number (e.g., 200)", "unit": "string (e.g., 'g', 'ml', 'Stück')" } ], 
    "instructions": ["string (German, step-by-step)"], 
    "totalCalories": "number (for ONE PERSON)", "protein": "number (in grams, for ONE PERSON)", "carbs": "number (in grams, for ONE PERSON)", "fat": "number (in grams, for ONE PERSON)", 
    "category": "string (Enum: ${MEAL_CATEGORIES.join(', ')})" } ]
}

CRITICAL RULES FOR RECIPES AND CALORIES:
1. ALL RECIPES and their nutritional values (calories, protein, carbs, fat) MUST be calculated for a single serving (for ONE PERSON). This is the most important rule.
2. The 'ingredients' array MUST be in the structured format: { "ingredient", "quantity", "unit" }.
3. The "totalCalories" in each day's "weeklyPlan" is the sum of calories for all meals for ONE PERSON and must be very close (+/- 50 kcal) to the user's target.

RULES FOR MEALS:
1. Strictly adhere to the user's list of 'includedMeals'. Generate recipes ONLY for these meal types.
2. For each day, each 'mealType' must appear AT MOST ONCE.

- Ensure all recipeIds in weeklyPlan correspond to a recipe in the recipes array.
- All text must be in German.
- Do not use markdown or comments in the JSON.
`;

    const userPrompt = `
Create a new weekly meal plan based on these settings:
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

${breakfastInstruction}
${snackInstruction}

Reminder: All recipes and their nutritional info must be for ONE person. The user has specified the plan should be for ${persons} people, but your output recipe data must be for ONE.
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
        
        // Return data as is, AI provides per-person values now.
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

const generateShoppingListOnly = async (scaledIngredients) => {
    const systemInstruction = `You are an expert shopping list generator. Your task is to create a complete, categorized shopping list from a pre-calculated list of ingredients. Your response must be in valid JSON format.
The JSON must strictly follow this schema:
{
  "shoppingList": [ { "category": "string (e.g., 'Obst & Gemüse')", "items": ["string (German, with quantities)"] } ]
}
- Consolidate similar items (e.g., "200g Zwiebeln" and "150g Zwiebeln" becomes "350g Zwiebeln").
- Format the output items nicely (e.g., "Mehl: 500g").
- All text must be in German.
- Do not use markdown or add any comments in the JSON.
`;

    const userPrompt = `
Generate a categorized shopping list from these ingredients. The quantities are already correctly calculated. You just need to consolidate and categorize them.
Ingredients: ${JSON.stringify(scaledIngredients)}

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

const convertMultipleIngredientsToStructuredFormat = async (recipeBatch) => {
    const systemInstruction = `You are a precise data conversion tool. Your only task is to convert an array of recipe objects, each with an array of ingredient strings, into a structured JSON array.
The output MUST be a valid JSON array of objects, where each object has the "recipeId" from the input and a new "structuredIngredients" array.
For each recipe in the input array, you must perform the following actions on its 'ingredients' array:
- Convert each string into a structured object: { "ingredient": "string", "quantity": "number", "unit": "string" }.
- For items without a clear unit (e.g., "1 Zwiebel"), use "Stück" as the unit.
- If quantity is not specified, assume 1. For units like "Prise" or "Bund", quantity should be 1.
- CRITICAL: The provided ingredient quantities are for a specific number of people ('originalPersons'). You MUST calculate the equivalent quantities for a SINGLE person (a base of 1). Divide the original quantity by the provided 'originalPersons' value. Round to a reasonable number of decimals if necessary.
- Do not output anything other than the final JSON array. No explanations, no markdown.

INPUT SCHEMA: [{ "recipeId": number, "originalPersons": number, "ingredients": ["string"] }]
OUTPUT SCHEMA: [{ "recipeId": number, "structuredIngredients": [{ "ingredient": "string", "quantity": number, "unit": "string" }] }]
`;

    const userPrompt = `
    Convert the following batch of recipes. For each, use 'originalPersons' to calculate the quantities for 1 person.

    Recipe Batch:
    ${JSON.stringify(recipeBatch)}

    Return ONLY the JSON array matching the specified output schema.
    `;
    
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
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.every(item => item.hasOwnProperty('recipeId') && item.hasOwnProperty('structuredIngredients'))) {
            return data;
        }
        throw new Error("Parsed JSON does not match the required output schema.");
    } catch (e) {
        console.error("Failed to parse Gemini response for batch ingredient conversion as JSON.", e);
        console.error("Raw response text:", response.text);
        throw new Error("The AI response for batch ingredient conversion was not in the expected format.");
    }
};


module.exports = {
    generatePlan,
    generateImageForRecipe,
    generateShoppingListOnly,
    convertMultipleIngredientsToStructuredFormat,
};