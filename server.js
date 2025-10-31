const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { GoogleGenAI, Modality, Type } = require('@google/genai');

// Lade Umgebungsvariablen aus der .env-Datei, ABER nur wenn wir NICHT in Produktion sind.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// --- Starup-Diagnose ---
console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
console.log('Wert für COOKIE_SECRET:', process.env.COOKIE_SECRET ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('Wert für APP_PASSWORD:', process.env.APP_PASSWORD ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('Wert für API_KEY:', process.env.API_KEY ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('--- Diagnose Ende ---');

// --- Überprüfung der Umgebungsvariablen ---
const APP_PASSWORD = process.env.APP_PASSWORD;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const API_KEY = process.env.API_KEY;

if (!COOKIE_SECRET || !APP_PASSWORD || !API_KEY) {
    const missing = [];
    if (!COOKIE_SECRET) missing.push('COOKIE_SECRET');
    if (!APP_PASSWORD) missing.push('APP_PASSWORD');
    if (!API_KEY) missing.push('API_KEY');
    console.error(`FATAL ERROR: Die Umgebungsvariable(n) ${missing.join(', ')} sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.`);
    process.exit(1);
}

// --- App-Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));

// --- Hilfsfunktionen für die KI-Anfragen ---
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
                    console.log(`[API Retry] Versuch ${attempt + 1}/${MAX_RETRIES} fehlgeschlagen: KI-Modell ist überlastet. Nächster Versuch in ${Math.round(backoffTime / 1000)}s...`);
                    await delay(backoffTime);
                }
            } else {
                console.error('[API Error] Nicht behebbarer Fehler:', error.message);
                throw error;
            }
        }
    }
    console.error(`[API Error] Alle ${MAX_RETRIES} Versuche, die KI zu erreichen, sind fehlgeschlagen.`);
    throw new Error(`Das KI-Modell ist derzeit überlastet. Bitte versuchen Sie es in ein paar Minuten erneut.`);
}

// ======================================================
// --- ÖFFENTLICHE ROUTEN (Keine Authentifizierung nötig) ---
// ======================================================

// Stellt statische Dateien aus dem 'public'-Ordner bereit (enthält login.html).
app.use(express.static(path.join(__dirname, 'public')));

// Login-Endpunkt.
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        res.cookie('isAuthenticated', 'true', {
            signed: true,
            httpOnly: true,
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Tage
        });
        res.redirect('/');
    } else {
        res.redirect('/login.html?error=1');
    }
});

// Logout-Endpunkt.
app.post('/logout', (req, res) => {
    res.clearCookie('isAuthenticated');
    res.status(200).json({ message: 'Abmeldung erfolgreich.' });
});

// ======================================================
// --- GESCHÜTZTER BEREICH (Authentifizierung nötig) ---
// ======================================================

const protectedRouter = express.Router();

// 1. Authentifizierungs-Middleware (Die "Firewall")
// Dies ist die erste Funktion, die für jede Anfrage an den protectedRouter ausgeführt wird.
protectedRouter.use((req, res, next) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        return next(); // Benutzer ist authentifiziert, fahre mit der nächsten Funktion fort.
    }
    
    // Benutzer ist NICHT authentifiziert.
    // Wenn es ein API-Aufruf ist, sende einen 401-Fehler (Nicht autorisiert).
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Nicht authentifiziert. Bitte melden Sie sich an.' });
    }
    
    // Für jede andere Anfrage (z.B. Seitenaufruf), leite zur Login-Seite um.
    res.redirect('/login.html');
});

// 2. Statische Dateien der React-App bereitstellen
// Dies wird nur ausgeführt, wenn die Authentifizierungs-Middleware 'next()' aufruft.
protectedRouter.use(express.static(path.join(__dirname, 'dist')));


// 3. Geschützte API-Endpunkte
// Diese werden nur ausgeführt, wenn die Authentifizierung erfolgreich war.
protectedRouter.post('/api/generate-plan', async (req, res) => {
    const { settings, previousPlanRecipes } = req.body;
    
    if (!settings) {
        return res.status(400).json({ error: 'Einstellungen fehlen in der Anfrage.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        
        const { persons, kcal, dietaryPreference, dietType, excludedIngredients, desiredIngredients, breakfastOption, customBreakfast } = settings;

        let planType = "Ernährungsplan";
        if (dietaryPreference === 'vegetarian') planType = "vegetarischen Ernährungsplan";
        else if (dietaryPreference === 'vegan') planType = "veganen Ernährungsplan";

        const exclusionText = excludedIngredients.trim() ? `Folgende Zutaten oder Zutaten-Gruppen sollen explizit vermieden werden: ${excludedIngredients}.` : '';
        const desiredIngredientsText = desiredIngredients.trim() ? `Folgende Zutaten sollen bevorzugt werden und in mindestens einem Abendessen-Rezept vorkommen, aber nicht zwangsläufig in allen: ${desiredIngredients}.` : '';

        let breakfastInstruction = '';
        switch (breakfastOption) {
            case 'quark':
                breakfastInstruction = dietaryPreference === 'vegan' ? "Das Frühstück soll jeden Tag nur aus einer veganen Quark-Alternative bestehen. Füge absolut keine weiteren Zutaten wie Toppings, Früchte oder Nüsse hinzu. Gib die Kalorien für die vegane Quark-Alternative entsprechend an." : "Das Frühstück soll jeden Tag nur aus 'CremeQuark von Edeka' bestehen. Füge absolut keine weiteren Zutaten wie Toppings, Früchte oder Nüsse hinzu. Gib die Kalorien für dieses spezifische Produkt entsprechend an.";
                break;
            case 'muesli':
                breakfastInstruction = dietaryPreference === 'vegan' ? 'Das Frühstück soll jeden Tag gleich sein und auf einem veganen Müsli (z.B. mit Hafermilch und Früchten) basieren, variiere aber die Toppings.' : 'Das Frühstück soll jeden Tag gleich sein und auf Müsli basieren, variiere aber die Toppings.';
                break;
            case 'custom':
                breakfastInstruction = customBreakfast.trim() ? `Das Frühstück soll jeden Tag gleich sein und dieser Beschreibung folgen: "${customBreakfast}". Falls es sinnvoll ist, variiere die Toppings oder kleine Beilagen.` : 'Das Frühstück kann eine beliebige, einfache Mahlezeit sein und soll jeden Tag gleich sein.';
                break;
        }
        
        const dietTypePrompts = {
            balanced: 'Der Plan soll eine ausgewogene Mischung aus Makronährstoffen (Kohlenhydrate, Proteine, Fette) enthalten.',
            'low-carb': 'Der Plan soll streng Low-Carb sein. Vermeide kohlenhydratreiche Lebensmittel wie Brot, Nudeln, Reis, Kartoffeln und Zucker. Konzentriere dich auf Gemüse, gesunde Fette und Proteine.',
            keto: 'Der Plan soll streng ketogen sein, also sehr kohlenhydratarm (unter 30g pro Tag), moderat im Protein und sehr fettreich.',
            'high-protein': 'Der Plan soll besonders proteinreich sein. Jede Mahlzeit, insbesondere das Abendessen, sollte eine signifikante Proteinquelle enthalten.',
            mediterranean: 'Der Plan soll der mediterranen Küche folgen. Viel frisches Gemüse, Hülsenfrüchte, Olivenöl, Nüsse, Samen.'
        };
        const dietTypeInstruction = dietTypePrompts[dietType] || dietTypePrompts.balanced;

        let varietyInstruction = '';
        if (previousPlanRecipes && previousPlanRecipes.length > 0) {
            const previousRecipeTitles = previousPlanRecipes.map(r => r.title).join(', ');
            varietyInstruction = `\nWICHTIG: Um für Abwechslung zu sorgen, erstelle bitte völlig andere Gerichte als im vorherigen Plan. Vermeide insbesondere Gerichte, die diesen ähneln: ${previousRecipeTitles}.`;
        }
        
        // --- PROMPT 1: Plan & Rezepte generieren ---
        const planPrompt = `Erstelle einen ${planType} für eine ganze Woche (Montag bis Sonntag) für ${persons} Personen.
        Das tägliche Kalorienziel pro Person ist ${kcal} kcal. Halte dich streng an dieses Ziel. Die Summe der Kalorien von Frühstück und Abendessen pro Tag muss sehr nah an diesem Wert liegen (Abweichung max. 100 kcal).
        ${dietTypeInstruction}
        ${desiredIngredientsText}
        ${exclusionText}
        Der Plan soll einfach und schnell umsetzbar sein.${varietyInstruction}
        ${breakfastInstruction}
        Das Abendessen soll jeden Tag ein anderes warmes Gericht sein.
        Erstelle detaillierte Rezepte für jedes Abendessen.
        WICHTIG: Alle Nährwertangaben müssen IMMER PRO PERSON berechnet werden. Die Zutatenlisten sind für ${persons} Personen. Die Angabe von Kalorien ist zwingend erforderlich. Die Angabe von Protein, Kohlenhydraten und Fett für die Rezepte ist optional, aber sehr erwünscht.
        `;

        const planSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Ein kurzer, kreativer und einprägsamer Name für diesen Ernährungsplan auf Deutsch, basierend auf den generierten Gerichten. Antworte NUR mit dem Namen, ohne Anführungszeichen oder zusätzliche Erklärungen." },
                weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, breakfast: { type: Type.STRING }, breakfastCalories: { type: Type.NUMBER }, dinner: { type: Type.STRING }, dinnerCalories: { type: Type.NUMBER } } } },
                recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, title: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, totalCalories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } } } }
            },
            required: ["name", "weeklyPlan", "recipes"]
        };

        const planResponse = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: planPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: planSchema }
        });
        
        const planData = JSON.parse(planResponse.text);

        // --- PROMPT 2: Einkaufsliste aus Rezepten generieren ---
        const shoppingListPrompt = `Basierend auf dem folgenden JSON-Objekt mit Rezepten für einen wöchentlichen Ernährungsplan für ${persons} Personen, erstelle eine detaillierte und vollständige Einkaufsliste. Alle Zutaten aus allen Rezepten und dem Frühstück müssen enthalten sein. Fasse die Artikel zusammen, wo es sinnvoll ist (z.B. wenn ein Rezept 1 Zwiebel und ein anderes 2 benötigt, sollte die Liste 3 Zwiebeln enthalten). Gruppiere die Einkaufsliste nach sinnvollen Supermarkt-Kategorien (z.B. "Obst & Gemüse", "Molkereiprodukte & Eier", "Trockensortiment & Konserven"). Hier sind die Daten: ${JSON.stringify({ weeklyPlan: planData.weeklyPlan, recipes: planData.recipes })}`;
        
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

        const shoppingListResponse = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: shoppingListPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: shoppingListSchema }
        });

        const shoppingListData = JSON.parse(shoppingListResponse.text);

        // --- Kombinieren und senden ---
        const finalPlan = {
            ...planData,
            shoppingList: shoppingListData.shoppingList
        };

        res.json({ 
            data: finalPlan,
            debug: { planPrompt, shoppingListPrompt }
        });

    } catch (error) {
        console.error('[API Error] Kritischer Fehler bei der Plan-Generierung:', error);
        res.status(503).json({ error: `Fehler bei der Kommunikation mit der KI: ${error.message}` });
    }
});

protectedRouter.post('/api/generate-image', async (req, res) => {
    const { recipe, attempt } = req.body;

    if (!recipe) {
        return res.status(400).json({ error: 'Rezept fehlt in der Anfrage.' });
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const prompt = attempt <= 2
          ? `Professionelle Food-Fotografie im Magazin-Stil, ultra-realistisches Foto von: "${recipe.title}". Das Gericht ist wunderschön auf einem Keramikteller angerichtet. Dramatisches, seitliches Studiolicht, das Dampf und Texturen betont. Bokeh-Hintergrund mit dezenten Küchenelementen. Kräftige Farben, extrem appetitlich.`
          : `Eine andere Perspektive, Food-Fotografie im Magazin-Stil, ultra-realistisches Foto von: "${recipe.title}". Schön angerichtet auf einem rustikalen Holztisch mit frischen Kräutern. Weiches, natürliches Licht. Kräftige, leuchtende Farben, extrem köstlich.`;

        const response = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        res.json({
            apiResponse: response,
            debug: { imagePrompt: prompt }
        });

    } catch (error) {
        console.error('[API Error] Kritischer Fehler bei der Bild-Generierung:', error);
        res.status(503).json({ error: `Fehler bei der Bildgenerierung: ${error.message}` });
    }
});


// 4. Fallback für die Haupt-App
// Jede andere GET-Anfrage, die keine statische Datei war, lädt die Haupt-index.html.
// Dies ist entscheidend für das Laden der App und für client-seitiges Routing.
// MUSS die letzte Route im geschützten Router sein.
protectedRouter.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Hänge den gesamten geschützten Router an die Haupt-App an.
// Jede Anfrage, die nicht von den öffentlichen Routen oben behandelt wurde, wird hierher geleitet.
app.use('/', protectedRouter);

// --- Server starten ---
app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
});
