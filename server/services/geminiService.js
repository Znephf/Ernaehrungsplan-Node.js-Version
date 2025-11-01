

const { GoogleGenAI, Modality, Type } = require('@google/genai');
const { pool } = require('./database');
const { API_KEY } = process.env;

const TEXT_MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 1000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(ai, generationParams) {
    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await ai.models.generateContent(generationParams);
            return result;
        } catch (error) {
            lastError = error;
            const errorMessage = (error.message || '').toLowerCase();
            if (errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded') || errorMessage.includes('rate limit')) {
                if (attempt < MAX_RETRIES - 1) {
                    const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
                    console.log(`[API Retry] Versuch ${attempt + 1}/${MAX_RETRIES} fehlgeschlagen. Nächster Versuch in ${Math.round(backoffTime / 1000)}s...`);
                    await delay(backoffTime);
                }
            } else {
                console.error('[API Error] Nicht behebbarer Fehler:', error.message);
                throw error;
            }
        }
    }
    console.error(`[API Error] Alle ${MAX_RETRIES} Versuche sind fehlgeschlagen.`);
    throw new Error(`Das KI-Modell ist derzeit überlastet. Bitte versuchen Sie es in ein paar Minuten erneut.`);
}

const validatePlanData = (data) => {
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
    const ai = new GoogleGenAI({ apiKey: API_KEY });
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

        const planPrompt = `Erstelle einen ${planType} für eine Woche (Mo-So) für ${persons} Personen. Tägliches Kalorienziel pro Person: ${kcal} kcal (max. 100 kcal Abweichung). ${dietTypePrompts[dietType]} ${specialDietInstructions} ${desiredIngredientsText} ${exclusionText} ${complexityInstruction}${varietyInstruction} ${breakfastInstruction} Abendessen ist jeden Tag ein anderes warmes Gericht. Erstelle detaillierte Rezepte. WICHTIG: Alle Nährwertangaben (Kalorien, Makros) sind PRO PERSON. Zutatenlisten in Rezepten sind für ${persons} Personen. 'breakfastCalories' und 'dinnerCalories' als Zahlen sind zwingend.`;
        
        const planSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, breakfast: { type: Type.STRING }, breakfastCalories: { type: Type.NUMBER }, dinner: { type: Type.STRING }, dinnerCalories: { type: Type.NUMBER } } } }, recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, title: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, totalCalories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } } } } }, required: ["name", "weeklyPlan", "recipes"] };
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_plan' WHERE jobId = ?", [jobId]);
        
        const planResponse = await generateWithRetry(ai, { model: TEXT_MODEL_NAME, contents: [{ parts: [{ text: planPrompt }] }], config: { responseMimeType: 'application/json', responseSchema: planSchema, temperature: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)) } });
        const planData = JSON.parse(planResponse.text);
        validatePlanData(planData);
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_shopping_list' WHERE jobId = ?", [jobId]);

        const shoppingListPrompt = `Basierend auf diesen Rezepten für ${persons} Personen, erstelle eine vollständige, zusammengefasste Einkaufsliste. Gruppiere nach Supermarkt-Kategorien: ${JSON.stringify({ weeklyPlan: planData.weeklyPlan, recipes: planData.recipes })}`;
        const shoppingListSchema = { type: Type.OBJECT, properties: { shoppingList: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["category", "items"] } } }, required: ["shoppingList"] };
        const shoppingListResponse = await generateWithRetry(ai, { model: TEXT_MODEL_NAME, contents: [{ parts: [{ text: shoppingListPrompt }] }], config: { responseMimeType: 'application/json', responseSchema: shoppingListSchema } });
        
        const finalPlan = { ...planData, shoppingList: JSON.parse(shoppingListResponse.text).shoppingList, imageUrls: {} };
        
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
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const prompt = attempt <= 2
        ? `Professionelle Food-Fotografie, ultra-realistisches Foto von: "${recipe.title}". Angerichtet auf Keramikteller, dramatisches Seitenlicht, Dampf, Bokeh-Hintergrund, appetitlich.`
        : `Andere Perspektive, Food-Fotografie, ultra-realistisches Foto von: "${recipe.title}". Angerichtet auf rustikalem Holztisch, natürliches Licht, kräftige Farben, köstlich.`;

    const response = await generateWithRetry(ai, {
        model: IMAGE_MODEL_NAME,
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    
    return {
        apiResponse: response,
        debug: { imagePrompt: prompt }
    };
}

module.exports = {
    processGenerationJob,
    generateImageForRecipe
};