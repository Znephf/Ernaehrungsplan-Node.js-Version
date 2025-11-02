const { GoogleGenAI, Modality, Type } = require('@google/genai');
const { pool } = require('./database');
const { API_KEY, API_KEY_FALLBACK } = process.env;
const { MealCategoryLabels } = require('../../types');


const TEXT_MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

const MAX_RETRIES_PER_KEY = 3; // Max retries for a single API key
const INITIAL_BACKOFF_MS = 1000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const apiKeys = [
    { name: 'API_KEY', value: API_KEY },
    { name: 'API_KEY_FALLBACK', value: API_KEY_FALLBACK }
].filter(k => k.value);

if (apiKeys.length === 0) {
    console.error('[API Error] Critical: No API_KEY or API_KEY_FALLBACK environment variables are set.');
}

async function generateWithFallbackAndRetry(generationParams) {
    let lastError = null;
    if (apiKeys.length === 0) throw new Error("Kein Google Gemini API-Schlüssel konfiguriert.");

    for (const keyInfo of apiKeys) {
        const ai = new GoogleGenAI({ apiKey: keyInfo.value });
        for (let attempt = 0; attempt < MAX_RETRIES_PER_KEY; attempt++) {
            try {
                const result = await ai.models.generateContent(generationParams);
                return result;
            } catch (error) {
                lastError = error;
                const isRetriable = (error.message || '').toLowerCase().includes('503');
                if (isRetriable && attempt < MAX_RETRIES_PER_KEY - 1) {
                    const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                    await delay(backoff);
                } else {
                    break;
                }
            }
        }
    }
    throw lastError || new Error("Alle API-Schlüssel sind fehlgeschlagen.");
}

const validatePlanData = (data) => {
    if (!data || typeof data !== 'object') throw new Error("Validation failed: Plan data is not an object.");
    if (!data.name || typeof data.name !== 'string') throw new Error("Validation failed: Plan name is missing.");
    if (!Array.isArray(data.recipes) || data.recipes.length === 0) throw new Error("Validation failed: Recipes are empty.");
    for (const recipe of data.recipes) {
        if (!recipe.title || !recipe.category || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.instructions) || typeof recipe.totalCalories !== 'number') {
            throw new Error(`Validation failed: A recipe object is incomplete. Missing title or category.`);
        }
    }
};

async function processGenerationJob(jobId) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [jobs] = await connection.query('SELECT payload FROM generation_jobs WHERE jobId = ?', [jobId]);
        if (jobs.length === 0) throw new Error(`Job ${jobId} not found.`);
        
        const { settings } = JSON.parse(jobs[0].payload);
        const { persons, kcal, dietaryPreference, dietType, excludedIngredients, desiredIngredients, isGlutenFree, isLactoseFree, dishComplexity, includedMeals } = settings;

        const mealTypesText = includedMeals.map(type => MealCategoryLabels[type] || type).join(', ');
        const planType = dietaryPreference === 'vegetarian' ? "vegetarischen" : dietaryPreference === 'vegan' ? "veganen" : "";
        const exclusionText = excludedIngredients.trim() ? `Vermeide: ${excludedIngredients}.` : '';
        const desiredIngredientsText = desiredIngredients.trim() ? `Bevorzuge: ${desiredIngredients}.` : '';
        const specialDietInstructions = [isGlutenFree && 'strikt glutenfrei', isLactoseFree && 'strikt laktosefrei'].filter(Boolean).join(' UND ');
        const complexityPrompts = {
            simple: 'Einfache Alltagsgerichte (max. 30 Min).',
            advanced: 'Interessante Rezepte für Hobbyköche (bis 60 Min).',
            fancy: 'Kreative Gerichte auf Restaurant-Niveau.',
        };

        const planPrompt = `Erstelle einen ${planType} Ernährungsplan für eine Woche (Mo-So) für ${persons} Personen. Ziel: ${kcal} kcal/Person/Tag. Diät: ${dietType}. Koch-Niveau: ${complexityPrompts[dishComplexity]} Mahlzeiten: ${mealTypesText}. ${specialDietInstructions}. ${desiredIngredientsText} ${exclusionText} Jede Mahlzeit an jedem Tag MUSS ein einzigartiges Gericht sein. Gib dem Plan einen kreativen Namen. Alle Nährwerte pro Person. Rezept-Zutaten für ${persons} Personen. Die "category" für jedes Rezept muss exakt einer der folgenden sein: 'breakfast', 'lunch', 'coffee', 'dinner', 'snack'.`;

        const planSchema = { 
            type: Type.OBJECT, 
            properties: { 
                name: { type: Type.STRING, description: "Kreativer Name für den Plan." }, 
                recipes: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { 
                            day: { type: Type.STRING }, 
                            title: { type: Type.STRING }, 
                            category: { type: Type.STRING, enum: ['breakfast', 'lunch', 'coffee', 'dinner', 'snack'] },
                            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, 
                            instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, 
                            totalCalories: { type: Type.NUMBER }, 
                            protein: { type: Type.NUMBER }, 
                            carbs: { type: Type.NUMBER }, 
                            fat: { type: Type.NUMBER } 
                        } 
                    } 
                } 
            }, 
            required: ["name", "recipes"] 
        };
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_plan' WHERE jobId = ?", [jobId]);
        
        const planResponse = await generateWithFallbackAndRetry({ model: TEXT_MODEL_NAME, contents: [{ parts: [{ text: planPrompt }] }], config: { responseMimeType: 'application/json', responseSchema: planSchema, temperature: 0.8 } });
        
        let planData;
        try {
            planData = JSON.parse(planResponse.text);
        } catch (e) {
            console.error("Failed to parse plan response:", e, "Raw response:", planResponse.text);
            throw new Error(`Invalid JSON from AI model.`);
        }
        validatePlanData(planData);
        
        await connection.query("UPDATE generation_jobs SET status = 'saving_plan' WHERE jobId = ?", [jobId]);

        // --- Save to new normalized structure ---
        await connection.beginTransaction();

        // 1. Save plan metadata
        const [planResult] = await connection.query(
            'INSERT INTO plans (name, settings) VALUES (?, ?)',
            [planData.name, JSON.stringify(settings)]
        );
        const newPlanId = planResult.insertId;

        // 2. Save recipes and link them to the plan
        for (const recipe of planData.recipes) {
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, ingredients, instructions, totalCalories, protein, carbs, fat, category) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title=title`, // Do nothing if exists
                [recipe.title, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions), recipe.totalCalories, recipe.protein, recipe.carbs, recipe.fat, recipe.category]
            );
            
            let recipeId = recipeResult.insertId;
            if (recipeId === 0) { // Recipe already existed
                const [[{ id }]] = await connection.query('SELECT id FROM recipes WHERE title = ?', [recipe.title]);
                recipeId = id;
            }

            await connection.query(
                'INSERT INTO plan_recipes (plan_id, recipe_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)',
                [newPlanId, recipeId, recipe.day, recipe.category]
            );
        }

        await connection.commit();
        
        await connection.query("UPDATE generation_jobs SET status = 'complete', planId = ? WHERE jobId = ?", [newPlanId, jobId]);
        console.log(`Job ${jobId} completed. New Plan ID: ${newPlanId}`);

    } catch (error) {
        if (connection) {
            await connection.rollback();
            await connection.query("UPDATE generation_jobs SET status = 'error', errorMessage = ? WHERE jobId = ?", [error.message, jobId]);
        }
        console.error(`[Job ${jobId}] Processing error:`, error);
    } finally {
        if (connection) connection.release();
    }
}


async function generateImageForRecipe(recipe, attempt) {
    const prompt = `Professionelle Food-Fotografie, ultra-realistisches Foto von: "${recipe.title}". Angerichtet auf Keramikteller, dramatisches Seitenlicht, Dampf, Bokeh-Hintergrund, appetitlich.`;
    const response = await generateWithFallbackAndRetry({
        model: IMAGE_MODEL_NAME,
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    return { apiResponse: response, debug: { imagePrompt: prompt } };
}

async function generateShoppingListForRecipes(recipes, persons) {
    if (!recipes || recipes.length === 0) return [];
    
    const shoppingListPrompt = `Basierend auf diesen Rezepten für ${persons} Personen, erstelle eine vollständige, zusammengefasste Einkaufsliste. Gruppiere die Artikel nach gängigen Supermarkt-Kategorien (z.B. "Obst & Gemüse", "Molkereiprodukte & Eier", "Trockensortiment & Konserven"). Fasse identische Zutaten intelligent zusammen. Gib Mengenangaben an. Rezepte: ${JSON.stringify(recipes.map(r => ({ title: r.title, ingredients: r.ingredients })))}`;
    
    const shoppingListSchema = { 
        type: Type.OBJECT, 
        properties: { 
            shoppingList: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT, 
                    properties: { 
                        category: { type: Type.STRING }, 
                        items: { type: Type.ARRAY, items: { type: Type.STRING } } 
                    }, 
                    required: ["category", "items"] 
                } 
            } 
        }, 
        required: ["shoppingList"] 
    };

    const response = await generateWithFallbackAndRetry({ 
        model: TEXT_MODEL_NAME, 
        contents: [{ parts: [{ text: shoppingListPrompt }] }], 
        config: { responseMimeType: 'application/json', responseSchema: shoppingListSchema } 
    });
    
    let shoppingListData;
    try {
        shoppingListData = JSON.parse(response.text);
    } catch (e) {
        throw new Error(`Invalid shopping list JSON from AI model.`);
    }

    if (!shoppingListData || !Array.isArray(shoppingListData.shoppingList)) {
        throw new Error('Generated shopping list has an invalid format.');
    }

    return shoppingListData.shoppingList;
}

module.exports = {
    processGenerationJob,
    generateImageForRecipe,
    generateShoppingListForRecipes,
};
