const { GoogleGenAI, Modality, Type } = require('@google/genai');
const { pool } = require('./database');
const { API_KEY, API_KEY_FALLBACK } = process.env;

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

/**
 * Attempts to generate content using a primary API key, with a fallback key if the primary fails.
 * Includes retry logic with exponential backoff for retriable errors (e.g., rate limits, server overload).
 * @param {object} generationParams - The parameters for the generateContent call.
 * @returns {Promise<object>} The result from the Gemini API.
 */
async function generateWithFallbackAndRetry(generationParams) {
    let lastError = null;
    if (apiKeys.length === 0) {
        throw new Error("Kein Google Gemini API-Schlüssel konfiguriert.");
    }

    for (const keyInfo of apiKeys) {
        const ai = new GoogleGenAI({ apiKey: keyInfo.value });
        console.log(`[API] Führe Anfrage mit Schlüssel '${keyInfo.name}' aus (endet auf ...${keyInfo.value.slice(-4)}).`);
        
        for (let attempt = 0; attempt < MAX_RETRIES_PER_KEY; attempt++) {
            try {
                const result = await ai.models.generateContent(generationParams);
                console.log(`[API] Anfrage mit Schlüssel '${keyInfo.name}' war erfolgreich.`);
                return result; // Success, return immediately.
            } catch (error) {
                lastError = error;
                const errorMessage = (error.message || '').toLowerCase();
                const isRetriableError = errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded') || errorMessage.includes('rate limit') || errorMessage.includes('429');
                
                if (isRetriableError) {
                    if (attempt < MAX_RETRIES_PER_KEY - 1) {
                        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
                        console.warn(`[API Retry] Versuch ${attempt + 1}/${MAX_RETRIES_PER_KEY} mit '${keyInfo.name}' fehlgeschlagen (Server überlastet). Nächster Versuch in ${Math.round(backoffTime / 1000)}s...`);
                        await delay(backoffTime);
                    }
                } else {
                    console.error(`[API] Kritischer Fehler mit Schlüssel '${keyInfo.name}': ${errorMessage}. Wechsle zum nächsten Schlüssel, falls vorhanden.`);
                    break; // Break from the inner retry loop to try the next key.
                }
            }
        }
        
        if (apiKeys.length > 1 && keyInfo.name !== apiKeys[apiKeys.length - 1].name) {
             console.warn(`[API Fallback] Alle Versuche für Schlüssel '${keyInfo.name}' sind fehlgeschlagen. Wechsle zum Fallback-Schlüssel.`);
        }
    }

    console.error(`[API FATAL] Alle konfigurierten API-Schlüssel (${apiKeys.map(k => k.name).join(', ')}) sind fehlgeschlagen.`);
    // Re-throw the last captured error to be handled by the caller.
    throw lastError || new Error("Alle API-Schlüssel sind fehlgeschlagen. Das KI-Modell ist derzeit nicht erreichbar.");
}

const validatePlanData = (data) => {
    if (!data || typeof data !== 'object') throw new Error("Validierung fehlgeschlagen: Plandaten sind kein Objekt.");
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') throw new Error("Validierung fehlgeschlagen: Planname fehlt.");
    if (!Array.isArray(data.weeklyPlan) || data.weeklyPlan.length === 0) throw new Error(`Validierung fehlgeschlagen: Wochenplan ist leer.`);
    for (const dayPlan of data.weeklyPlan) {
        if (typeof dayPlan.day !== 'string' || typeof dayPlan.breakfast !== 'string' || typeof dayPlan.breakfastCalories !== 'number' || typeof dayPlan.dinner !== 'string' || typeof dayPlan.dinnerCalories !== 'number') {
            throw new Error(`Validierung fehlgeschlagen: Ein Tagesplan-Objekt ist unvollständig!`);
        }
    }
    if (!Array.isArray(data.recipes) || data.recipes.length === 0) throw new Error("Validierung fehlgeschlagen: Rezepte sind leer.");
    for (const recipe of data.recipes) {
        if (typeof recipe.day !== 'string' || typeof recipe.title !== 'string' || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.instructions) || typeof recipe.totalCalories !== 'number') {
            throw new Error(`Validierung fehlgeschlagen: Ein Rezept-Objekt ist unvollständig.`);
        }
    }
};

async function processGenerationJob(jobId) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [jobs] = await connection.query('SELECT payload FROM generation_jobs WHERE jobId = ?', [jobId]);
        if (jobs.length === 0) throw new Error(`Job ${jobId} nicht gefunden.`);
        
        const { settings, previousPlanRecipes } = JSON.parse(jobs[0].payload);
        if (!settings) throw new Error('Job-Daten sind unvollständig.');

        const { persons, kcal, dietaryPreference, dietType, excludedIngredients, desiredIngredients, breakfastOption, customBreakfast, isGlutenFree, isLactoseFree, dishComplexity } = settings;

        let planType = dietaryPreference === 'vegetarian' ? "vegetarischen Ernährungsplan" : dietaryPreference === 'vegan' ? "veganen Ernährungsplan" : "Ernährungsplan";
        const exclusionText = excludedIngredients.trim() ? `Folgende Zutaten explizit vermeiden: ${excludedIngredients}.` : '';
        const desiredIngredientsText = desiredIngredients.trim() ? `Folgende Zutaten bevorzugen: ${desiredIngredients}.` : '';
        let specialDietInstructions = isGlutenFree && isLactoseFree ? 'Alle Gerichte müssen strikt glutenfrei UND laktosefrei sein.' : isGlutenFree ? 'Alle Gerichte müssen strikt glutenfrei sein.' : isLactoseFree ? 'Alle Gerichte müssen strikt laktosefrei sein.' : '';
        
        const complexityPrompts = {
            simple: 'Fokus auf einfache Alltagsgerichte. Die Zubereitung muss schnell (maximal 30 Minuten) und mit wenigen, gängigen Zutaten möglich sein. Ideal für Kochanfänger und die schnelle Feierabendküche.',
            advanced: 'Fokus auf interessante und abwechslungsreiche Rezepte für Hobbyköche. Die Zubereitung darf mehrere Schritte umfassen und bis zu 60 Minuten dauern. Die Gerichte können auch weniger alltägliche Zutaten enthalten, die aber gut erhältlich sind.',
            fancy: 'Absoluter Fokus auf Kreativität und das Besondere. Erstelle anspruchsvolle Gerichte auf Restaurant-Niveau. Der Zeitaufwand und die Komplexität spielen keine Rolle. Nutze ungewöhnliche Zutatenkombinationen, fortgeschrittene Kochtechniken (z.B. Schäume, Reduktionen, Saucen ansetzen) und beschreibe eine elegante Anrichtung. Diese Gerichte sind für besondere Anlässe gedacht und erfordern Kocherfahrung.',
        };
        const complexityInstruction = complexityPrompts[dishComplexity] || complexityPrompts.simple;

        let breakfastInstruction = '';
        switch (breakfastOption) {
            case 'quark': breakfastInstruction = dietaryPreference === 'vegan' ? "Frühstück ist jeden Tag nur vegane Quark-Alternative. Keine weiteren Zutaten." : "Frühstück ist jeden Tag nur 'CremeQuark von Edeka'. Keine weiteren Zutaten."; break;
            case 'muesli': breakfastInstruction = dietaryPreference === 'vegan' ? "Frühstück basiert täglich auf veganem Müsli (z.B. mit Pflanzenmilch/Sojajoghurt, Früchten, Nüssen). Es darf kein Honig enthalten sein." : "Frühstück basiert täglich auf Müsli, variiere die Toppings."; break;
            case 'custom': breakfastInstruction = customBreakfast.trim() ? `Frühstück ist täglich: "${customBreakfast}".` : 'Das Frühstück ist jeden Tag gleich und einfach.'; break;
        }
        
        const dietTypePrompts = {
            balanced: 'Ausgewogene Makronährstoffe.', 'low-carb': 'Streng Low-Carb. Kein Brot, Nudeln, Reis, Kartoffeln, Zucker.', keto: 'Streng ketogen (unter 30g Kohlenhydrate/Tag), fettreich.', 'high-protein': 'Besonders proteinreich.', mediterranean: 'Mediterrane Küche mit viel Gemüse, Hülsenfrüchten, Olivenöl.'
        };
        const varietyInstruction = (previousPlanRecipes && previousPlanRecipes.length > 0) ? ` WICHTIG: Erstelle völlig andere Gerichte als diese: ${previousPlanRecipes.map(r => r.title).join(', ')}.` : '';

        const planPrompt = `Erstelle einen ${planType} für eine Woche (Mo-So) für ${persons} Personen. Tägliches Kalorienziel pro Person: ${kcal} kcal (max. 100 kcal Abweichung). ${dietTypePrompts[dietType]} ${specialDietInstructions} ${desiredIngredientsText} ${exclusionText} ${complexityInstruction} ${varietyInstruction} ${breakfastInstruction} Abendessen ist jeden Tag ein anderes warmes Gericht. Erstelle detaillierte Rezepte. Gib dem Plan einen kreativen Namen, der die Gerichte der Woche widerspiegelt (z.B. "Mediterrane Genusswoche mit Halloumi & Shakshuka"). Vermeide generische Titel wie "Wochenplan". WICHTIG: Alle Nährwertangaben (Kalorien, Makros) sind PRO PERSON. Zutatenlisten in Rezepten sind für ${persons} Personen. 'breakfastCalories' und 'dinnerCalories' als Zahlen sind zwingend.`;
        
        const planSchema = { 
            type: Type.OBJECT, 
            properties: { 
                name: { 
                    type: Type.STRING,
                    description: "Ein kreativer, ansprechender Name für den Ernährungsplan, der sich auf die Gerichte der Woche bezieht, z.B. 'Mediterrane Genusswoche mit Halloumi & Shakshuka' oder 'Asiatische Tofu-Reise'. Vermeide unbedingt generische Titel wie 'Wochenplan für 2 Personen'."
                }, 
                weeklyPlan: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { 
                            day: { type: Type.STRING }, 
                            breakfast: { type: Type.STRING }, 
                            breakfastCalories: { type: Type.NUMBER }, 
                            dinner: { type: Type.STRING }, 
                            dinnerCalories: { type: Type.NUMBER } 
                        } 
                    } 
                }, 
                recipes: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { 
                            day: { type: Type.STRING }, 
                            title: { type: Type.STRING }, 
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
            required: ["name", "weeklyPlan", "recipes"] 
        };
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_plan' WHERE jobId = ?", [jobId]);
        
        const planResponse = await generateWithFallbackAndRetry({ model: TEXT_MODEL_NAME, contents: [{ parts: [{ text: planPrompt }] }], config: { responseMimeType: 'application/json', responseSchema: planSchema, temperature: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)) } });
        
        let planData;
        try {
            if (!planResponse.text || planResponse.text.trim() === '') {
                throw new Error("Leere Antwort vom Planungs-Modell erhalten.");
            }
            planData = JSON.parse(planResponse.text);
        } catch (e) {
            console.error("Fehler beim Parsen der Plan-Antwort:", e);
            console.error("Roh-Antwort vom Modell:", planResponse.text);
            throw new Error(`Das KI-Modell hat eine ungültige Antwort gesendet. (${e.message})`);
        }
        validatePlanData(planData);
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_shopping_list' WHERE jobId = ?", [jobId]);

        const shoppingList = await generateShoppingListForRecipes(planData.recipes, persons);

        const finalPlan = { ...planData, shoppingList, imageUrls: {} };
        
        const [result] = await connection.query('INSERT INTO archived_plans (name, settings, planData) VALUES (?, ?, ?)', [finalPlan.name, JSON.stringify(settings), JSON.stringify(finalPlan)]);
        
        await connection.query("UPDATE generation_jobs SET status = 'complete', planId = ? WHERE jobId = ?", [result.insertId, jobId]);
        console.log(`Job ${jobId} erfolgreich abgeschlossen. Plan-ID: ${result.insertId}`);

    } catch (error) {
        console.error(`[Job ${jobId}] Fehler bei der Verarbeitung:`, error);
        if (connection) {
            await connection.query("UPDATE generation_jobs SET status = 'error', errorMessage = ? WHERE jobId = ?", [error.message, jobId]);
        }
    } finally {
        if (connection) connection.release();
    }
}

async function generateImageForRecipe(recipe, attempt) {
    const prompt = attempt <= 2
        ? `Professionelle Food-Fotografie, ultra-realistisches Foto von: "${recipe.title}". Angerichtet auf Keramikteller, dramatisches Seitenlicht, Dampf, Bokeh-Hintergrund, appetitlich.`
        : `Andere Perspektive, Food-Fotografie, ultra-realistisches Foto von: "${recipe.title}". Angerichtet auf rustikalem Holztisch, natürliches Licht, kräftige Farben, köstlich.`;

    const response = await generateWithFallbackAndRetry({
        model: IMAGE_MODEL_NAME,
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    
    return {
        apiResponse: response,
        debug: { imagePrompt: prompt }
    };
}

async function generateShoppingListForRecipes(recipes, persons) {
    if (!recipes || recipes.length === 0) return [];
    
    const shoppingListPrompt = `Basierend auf diesen Rezepten für ${persons} Personen, erstelle eine vollständige, zusammengefasste Einkaufsliste. Gruppiere die Artikel nach gängigen Supermarkt-Kategorien (z.B. "Obst & Gemüse", "Molkereiprodukte & Eier", "Trockensortiment & Konserven", "Gewürze & Sonstiges"). Fasse identische Zutaten intelligent zusammen (z.B. aus "1 Zwiebel" und "2 Zwiebeln" wird "3 Zwiebeln"). Gib Mengenangaben an. Hier sind die Rezepte: ${JSON.stringify(recipes.map(r => ({ title: r.title, ingredients: r.ingredients })))}`;
    
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
        if (!response.text || response.text.trim() === '') {
            throw new Error("Leere Antwort vom Einkaufslisten-Modell erhalten.");
        }
        shoppingListData = JSON.parse(response.text);
    } catch (e) {
        console.error("Fehler beim Parsen der Einkaufslisten-Antwort:", e);
        console.error("Roh-Antwort vom Modell:", response.text);
        throw new Error(`Das KI-Modell hat eine ungültige Einkaufsliste gesendet. (${e.message})`);
    }

    if (!shoppingListData || !Array.isArray(shoppingListData.shoppingList)) {
        console.error("Ungültiges Format der Einkaufsliste:", shoppingListData);
        throw new Error('Die generierte Einkaufsliste hat ein ungültiges Format.');
    }

    return shoppingListData.shoppingList;
}


module.exports = {
    processGenerationJob,
    generateImageForRecipe,
    generateShoppingListForRecipes,
};