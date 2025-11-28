
// Fix: Refactored the Gemini service to support batch processing of ingredients, reducing API calls.
const { GoogleGenAI } = require('@google/genai');
const { pool } = require('./database');
const { API_KEY, API_KEY_FALLBACK } = process.env;

/**
 * Führt eine API-Anfrage an Gemini aus. Versucht es bis zu 5 Mal mit dem primären API-Schlüssel.
 * Wenn alle Versuche fehlschlagen, wird ein einmaliger Versuch mit dem Fallback-API-Schlüssel unternommen.
 * Loggt detaillierte Informationen über Versuche und verwendete Schlüssel in der Konsole.
 * @param {object} requestPayload - Das Objekt, das an `ai.models.generateContent` übergeben wird.
 * @returns {Promise<{response: any, keyUsed: 'primary' | 'fallback'}>} Die erfolgreiche Antwort von der API und der verwendete Schlüssel.
 * @throws {Error} Wirft einen Fehler, wenn alle Versuche mit allen verfügbaren Schlüsseln fehlschlagen.
 */
async function generateWithFallback(requestPayload) {
    let lastError = null;
    const MAX_VERSUCHE = 5;

    // 1. Sicherstellen, dass mindestens ein Schlüssel verfügbar ist.
    if (!API_KEY && !API_KEY_FALLBACK) {
        throw new Error('FATAL: Es wurden keine API_KEY oder API_KEY_FALLBACK in den Umgebungsvariablen gefunden.');
    }

    // 2. Versuche den API-Aufruf mit dem primären API_KEY bis zu 5 Mal.
    if (API_KEY) {
        for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
            try {
                console.log(`[API-Info] Versuch ${versuch}/${MAX_VERSUCHE} mit primärem API_KEY.`);
                const ai = new GoogleGenAI({ apiKey: API_KEY });
                const response = await ai.models.generateContent(requestPayload);
                console.log(`[API-Info] Erfolg bei Versuch ${versuch} mit primärem API_KEY.`);
                return { response, keyUsed: 'primary' }; // Erfolg, Funktion beenden
            } catch (error) {
                console.warn(`[API-Warnung] Versuch ${versuch}/${MAX_VERSUCHE} mit primärem API_KEY fehlgeschlagen: ${error.message}`);
                lastError = error; // Letzten Fehler speichern
                if (versuch < MAX_VERSUCHE) {
                    // Optionale Verzögerung vor dem nächsten Versuch
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 Sekunde Verzögerung
                }
            }
        }
        console.error(`[API-Fehler] Alle ${MAX_VERSUCHE} Versuche mit dem primären API_KEY sind fehlgeschlagen. Wechsle zum Fallback.`);
    } else {
        console.log('[API-Info] Primärer API_KEY nicht gesetzt. Wechsle direkt zum Fallback.');
    }

    // 3. Wenn der primäre Schlüssel fehlgeschlagen ist oder nicht vorhanden war, versuche es mit dem Fallback-Schlüssel.
    if (API_KEY_FALLBACK) {
        try {
            console.log('[API-Info] Versuche API-Aufruf mit API_KEY_FALLBACK...');
            const ai = new GoogleGenAI({ apiKey: API_KEY_FALLBACK });
            const response = await ai.models.generateContent(requestPayload);
            console.log('[API-Info] Erfolg mit Fallback-Schlüssel API_KEY_FALLBACK.');
            return { response, keyUsed: 'fallback' };
        } catch (error) {
            console.error(`[API-Fehler] Fallback-Schlüssel API_KEY_FALLBACK ebenfalls fehlgeschlagen: ${error.message}`);
            lastError = error; // Fehler mit dem neuesten Fehlschlag aktualisieren.
        }
    } else {
        console.log('[API-Info] Fallback-Schlüssel API_KEY_FALLBACK nicht gesetzt.');
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
        mainMealFocus, useSameBreakfast, customBreakfastText, useSameSnack, customSnackText,
        useSameCoffee, customCoffeeText,
        creativeInspiration,
        selectedBreakfastRecipeId, selectedSnackRecipeId, selectedCoffeeRecipeId,
    } = settings;

    // --- Step 1: Handle Pre-selected Recipes ---
    const dbRecipes = {};
    if (selectedBreakfastRecipeId) {
        const [[recipe]] = await pool.query('SELECT * FROM recipes WHERE id = ?', [selectedBreakfastRecipeId]);
        if (recipe) dbRecipes.breakfast = { ...recipe, ingredients: JSON.parse(recipe.ingredients || '[]'), instructions: JSON.parse(recipe.instructions || '[]') };
    }
    if (selectedSnackRecipeId) {
        const [[recipe]] = await pool.query('SELECT * FROM recipes WHERE id = ?', [selectedSnackRecipeId]);
        if (recipe) dbRecipes.snack = { ...recipe, ingredients: JSON.parse(recipe.ingredients || '[]'), instructions: JSON.parse(recipe.instructions || '[]') };
    }
    if (selectedCoffeeRecipeId) {
        const [[recipe]] = await pool.query('SELECT * FROM recipes WHERE id = ?', [selectedCoffeeRecipeId]);
        if (recipe) dbRecipes.coffee = { ...recipe, ingredients: JSON.parse(recipe.ingredients || '[]'), instructions: JSON.parse(recipe.instructions || '[]') };
    }

    const mealsToGenerate = new Set(includedMeals || []);
    let preselectedCalories = 0;
    const preselectedMealsInfo = [];

    Object.entries(dbRecipes).forEach(([mealType, recipe]) => {
        if (recipe) {
            mealsToGenerate.delete(mealType);
            preselectedCalories += recipe.totalCalories;
            preselectedMealsInfo.push(`a pre-selected ${mealType} named "${recipe.title}" with ${recipe.totalCalories} calories`);
        }
    });

    const remainingCalorieTarget = Math.max(500, kcal - preselectedCalories);

    // If all meals are pre-selected, no need to call AI for plan generation.
    if (mealsToGenerate.size === 0) {
        console.log("[API-Info] All meals provided by user. Skipping AI plan generation.");
        const planName = creativeInspiration || `${dietaryPreference} Plan`;
        const daysOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
        const weeklyPlan = daysOrder.map(day => {
            const meals = [];
            let totalCalories = 0;
            Object.entries(dbRecipes).forEach(([mealType, recipe]) => {
                if (includedMeals.includes(mealType)) {
                    meals.push({ mealType, recipeId: recipe.id });
                    totalCalories += recipe.totalCalories;
                }
            });
            return { day, meals, totalCalories };
        });
        
        return { planData: { name: planName, weeklyPlan, recipes: Object.values(dbRecipes) }, keyUsed: null };
    }

    // --- Step 2: Build AI Prompt ---
    const includedMealsText = `The user wants these meals generated by you: ${[...mealsToGenerate].join(', ')}.`;

    let preselectedInfoText = '';
    if (preselectedMealsInfo.length > 0) {
        preselectedInfoText = `IMPORTANT CONTEXT: The user is already consuming ${preselectedMealsInfo.join(' and ')} every day. You MUST account for these calories. The remaining calorie target for the meals YOU generate should be around ${remainingCalorieTarget} kcal per person per day.`;
    }

    const dietPreferenceText = {
        omnivore: 'omnivore (includes meat and fish)',
        vegetarian: 'vegetarian (no meat or fish)',
        vegan: 'vegan (no animal products at all, including dairy, eggs, and honey)'
    }[dietaryPreference];
    
    const previousRecipesText = previousPlanRecipes.length > 0
        ? `To ensure variety, please AVOID generating recipes with these titles from the user's last plan: ${previousPlanRecipes.map(r => `"${r.title}"`).join(', ')}.`
        : '';

    const mainMealFocusText = (mainMealFocus && mainMealFocus !== 'none' && mealsToGenerate.has('lunch') && mealsToGenerate.has('dinner'))
        ? `The user has specified a focus on '${mainMealFocus}' as the main meal. Please make sure the recipes for this meal are more substantial, while the other meal (lunch or dinner) can be lighter.`
        : '';
        
    const breakfastInstruction = (useSameBreakfast && customBreakfastText && !selectedBreakfastRecipeId)
        ? `IMPORTANT FOR BREAKFAST: The user wants the exact same breakfast every single day: "${customBreakfastText}". You MUST generate only ONE recipe object for this and use its recipeId for breakfast on all seven days.`
        : '';
    const snackInstruction = (useSameSnack && customSnackText && !selectedSnackRecipeId)
        ? `IMPORTANT FOR SNACKS: The user wants the exact same snack every single day: "${customSnackText}". You MUST generate only ONE recipe object for this and use its recipeId for snacks on all seven days.`
        : '';
    const coffeeInstruction = (useSameCoffee && customCoffeeText && !selectedCoffeeRecipeId)
        ? `IMPORTANT FOR COFFEE & CAKE: The user wants the exact same coffee/cake meal every single day: "${customCoffeeText}". You MUST generate only ONE recipe object for this and use its recipeId for the coffee meal on all seven days.`
        : '';
        
    const creativeInspirationText = creativeInspiration
        ? `The user has provided a specific creative theme/inspiration: "${creativeInspiration}". Please base the plan's style and recipes on this theme.`
        : '';

    const systemInstruction = `You are an expert nutritionist and chef specializing in creating balanced, delicious, and practical weekly meal plans. Your responses must be in valid JSON format. Do not include any text outside the JSON structure.
The JSON must strictly follow this schema:
{
  "name": "string (A creative and appealing name for the meal plan, in German)",
  "weeklyPlan": [ { "day": "string (e.g., 'Montag')", "meals": [ { "mealType": "string (Enum: ${[...mealsToGenerate].join(', ')})", "recipeId": "number (A unique integer ID for the recipe, starting from 1)" } ], "totalCalories": "number" } ],
  "recipes": [ { "id": "number (Must match a recipeId from weeklyPlan, starting from 1)", "title": "string (German)", "ingredients": [ { "ingredient": "string (German)", "quantity": "number", "unit": "string" } ], "instructions": ["string (German, step-by-step)"], "totalCalories": "number (for ONE PERSON)", "protein": "number (grams, for ONE PERSON)", "carbs": "number (grams, for ONE PERSON)", "fat": "number (grams, for ONE PERSON)", "category": "string (Enum: ${[...mealsToGenerate].join(', ')})" } ]
}
CRITICAL RULES:
1. ALL RECIPES and their nutritional values MUST be for a SINGLE serving (ONE PERSON).
2. The 'ingredients' array MUST be in the structured format: { "ingredient", "quantity", "unit" }.
3. The "totalCalories" in each day's "weeklyPlan" is the sum of calories for ONLY THE MEALS YOU GENERATE for one person, and it should be close to the remaining calorie target.
4. Generate recipes ONLY for these meal types: ${[...mealsToGenerate].join(', ')}.
- All text must be in German.
`;

    const userPrompt = `
Create a new weekly meal plan based on these settings:
- Total target calories per person per day: ${kcal}
- ${preselectedInfoText}
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
${creativeInspirationText}
${breakfastInstruction}
${snackInstruction}
${coffeeInstruction}
Please generate the full plan for the specified meals in the required JSON format.
`;

    const randomTemperature = Math.random() * 0.5 + 0.5;
    console.log(`Generating plan with Gemini for meals: ${[...mealsToGenerate].join(', ')} (temperature: ${randomTemperature.toFixed(2)})`);
    
    const { response, keyUsed } = await generateWithFallback({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: { systemInstruction, responseMimeType: 'application/json', temperature: randomTemperature }
    });

    try {
        const aiPlan = JSON.parse(response.text.trim());
        
        // --- Step 3: Merge AI plan with pre-selected recipes ---
        const finalPlan = { name: aiPlan.name, weeklyPlan: [], recipes: [] };
        
        const [[{ maxId }]] = await pool.query('SELECT MAX(id) as maxId FROM recipes');
        let nextId = (maxId || 0) + 1;

        finalPlan.recipes.push(...Object.values(dbRecipes));

        const aiIdMap = new Map();
        aiPlan.recipes.forEach(aiRecipe => {
            const originalId = aiRecipe.id;
            const newId = nextId++;
            aiIdMap.set(originalId, newId);
            aiRecipe.id = newId;
            finalPlan.recipes.push(aiRecipe);
        });

        const daysOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
        finalPlan.weeklyPlan = daysOrder.map(dayName => {
            const aiDay = aiPlan.weeklyPlan.find(d => d.day === dayName);
            const newDay = { day: dayName, meals: [] };

            Object.entries(dbRecipes).forEach(([mealType, recipe]) => {
                if (recipe && includedMeals.includes(mealType)) {
                    newDay.meals.push({ mealType, recipeId: recipe.id });
                }
            });

            if (aiDay) {
                aiDay.meals.forEach(aiMeal => {
                    newDay.meals.push({ mealType: aiMeal.mealType, recipeId: aiIdMap.get(aiMeal.recipeId) });
                });
            }
            
            newDay.totalCalories = newDay.meals.reduce((sum, meal) => {
                const recipe = finalPlan.recipes.find(r => r.id === meal.recipeId);
                return sum + (recipe ? recipe.totalCalories : 0);
            }, 0);

            return newDay;
        });

        return { planData: finalPlan, keyUsed };

    } catch (e) {
        console.error("Failed to parse or merge Gemini response.", e);
        console.error("Raw response text:", response.text);
        throw new Error("The AI response was not in the expected format. Please try again.");
    }
};

const generateSingleRecipe = async ({ 
    prompt, 
    includedIngredients, 
    excludedIngredients,
    mealCategory = 'dinner',
    dietaryPreference = 'omnivore',
    dietType = 'balanced',
    dishComplexity = 'simple',
    isGlutenFree = false,
    isLactoseFree = false
}) => {
    const systemInstruction = `You are an expert chef. Create a SINGLE recipe based on the user's request and strict constraints.
    Your response must be in valid JSON format ONLY.
    Schema:
    {
      "title": "string (German)",
      "ingredients": [ { "ingredient": "string (German)", "quantity": "number", "unit": "string" } ],
      "instructions": ["string (German, step-by-step)"],
      "totalCalories": "number (for ONE PERSON)",
      "protein": "number (grams, for ONE PERSON)",
      "carbs": "number (grams, for ONE PERSON)",
      "fat": "number (grams, for ONE PERSON)",
      "category": "string (Enum: breakfast, lunch, dinner, snack, coffee)",
      "dietaryPreference": "string (Enum: omnivore, vegetarian, vegan)",
      "dietType": "string (Enum: balanced, low-carb, keto, high-protein, mediterranean)",
      "dishComplexity": "string (Enum: simple, advanced, fancy)",
      "isGlutenFree": "boolean",
      "isLactoseFree": "boolean"
    }
    
    CRITICAL INSTRUCTIONS: 
    1. Quantities must be for 1 PERSON.
    2. STRICTLY ADHERE to the user's constraints (Diet, Category, Allergies).
    3. Use 'Stück' if no unit applies.
    `;

    const userPrompt = `
    Create a recipe for: "${prompt}"
    
    CONSTRAINTS:
    - Meal Category: ${mealCategory}
    - Dietary Preference: ${dietaryPreference}
    - Diet Type: ${dietType}
    - Complexity: ${dishComplexity}
    - Gluten-Free: ${isGlutenFree ? 'YES' : 'No'}
    - Lactose-Free: ${isLactoseFree ? 'YES' : 'No'}
    ${includedIngredients ? `- Must include: ${includedIngredients}` : ''}
    ${excludedIngredients ? `- Must NOT include: ${excludedIngredients}` : ''}
    
    Please ensure the recipe strictly follows these rules.
    `;

    console.log(`Generating single recipe for prompt: "${prompt}" with category: ${mealCategory}`);

    const { response, keyUsed } = await generateWithFallback({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: { systemInstruction, responseMimeType: 'application/json' }
    });

    try {
        const recipeData = JSON.parse(response.text.trim());
        // Force the category to match what was requested, just in case AI drifts
        recipeData.category = mealCategory;
        return { recipe: recipeData, keyUsed };
    } catch (e) {
        console.error("Failed to parse Gemini response for single recipe.", e);
        throw new Error("Invalid AI response.");
    }
};


const generateImageForRecipe = async (recipe, attempt) => {
    let detailLevel = "A bright, clean, professional food photograph of the finished dish.";
    if (attempt > 1) detailLevel = "A delicious looking, vibrant, professional food photograph of the dish, top-down view.";
    if (attempt > 3) detailLevel = "A hyper-realistic, appetizing food photograph of the dish, showing texture and detail, minimalist background.";

    const imagePrompt = `${detailLevel} The dish is called "${recipe.title}". It contains: ${recipe.ingredients.map(i => i.ingredient).join(', ')}. Do not show any text or branding.`;

    const { response, keyUsed } = await generateWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: imagePrompt }] },
        config: {
            responseModalities: ['IMAGE'],
        }
    });

    return { apiResponse: response, debug: { imagePrompt }, keyUsed };
};

const generateShoppingListOnly = async (ingredientsList) => {
    const systemInstruction = `You are an expert shopping list generator. Your task is to create a complete, categorized shopping list from a list of structured ingredient objects. Your response must be in valid JSON format.
The JSON must strictly follow this schema:
{
  "shoppingList": [ { "category": "string (e.g., 'Obst & Gemüse')", "items": ["string (German, with quantities)"] } ]
}

CRITICAL INSTRUCTIONS:
1.  **Consolidate All Ingredients**: The input list may contain duplicates or similar items. You MUST consolidate them.
    -   **Sum Quantities**: For identical ingredients and units (e.g., two entries for {"ingredient": "Mehl", "quantity": 500, "unit": "g"}), sum their quantities.
    -   **Intelligently Merge**: For similar ingredients (e.g., "rote Paprika" and "gelbe Paprika"), merge them into a single item (e.g., "Paprika (gemischt): 2 Stück"). If units differ (e.g., 'Stück' and 'g'), use your best judgment to create a practical shopping item.
2.  **Categorize**: Group the final, consolidated items into logical supermarket categories.
3.  **Format Items**: Format the output items nicely (e.g., "Mehl: 1000g" or "Paprika, gemischt: 3 Stück").
4.  **Language**: All text must be in German.
5.  **Format**: Do not use markdown or add any comments in the JSON.
`;

    const userPrompt = `
Generate a categorized shopping list from this complete list of ingredients for the week. Please consolidate them as instructed.
Ingredients List: ${JSON.stringify(ingredientsList)}

Please provide only the "shoppingList" part of the response in the specified JSON format.
`;

    console.log('Generating shopping list with Gemini...');
    
    const { response, keyUsed } = await generateWithFallback({
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
        return { shoppingList: shoppingListData.shoppingList, keyUsed };
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
    
    const { response } = await generateWithFallback({
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
        throw new Error("Parsed JSON does not match the required output schema..");
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
    generateSingleRecipe
};
