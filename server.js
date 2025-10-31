const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { GoogleGenAI, Modality, Type } = require('@google/genai');

// Lade Umgebungsvariablen aus der .env-Datei, ABER nur wenn wir NICHT in Produktion sind.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
console.log('Wert für COOKIE_SECRET:', process.env.COOKIE_SECRET ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('Wert für APP_PASSWORD:', process.env.APP_PASSWORD ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('Wert für API_KEY:', process.env.API_KEY ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
console.log('--- Diagnose Ende ---');


const app = express();
const port = process.env.PORT || 3001;

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

const APP_PASSWORD = process.env.APP_PASSWORD;
const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET || !APP_PASSWORD) {
    console.error('FATAL ERROR: Die Umgebungsvariablen COOKIE_SECRET und/oder APP_PASSWORD sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.');
    process.exit(1);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));

// --- Public Routes (No Authentication Required) ---
// Serve static files from 'public' folder (contains login.html).
app.use(express.static(path.join(__dirname, 'public')));

// Login endpoint.
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        res.cookie('isAuthenticated', 'true', {
            signed: true,
            httpOnly: true,
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        res.redirect('/');
    } else {
        res.redirect('/login.html?error=1');
    }
});

// Logout endpoint.
app.post('/logout', (req, res) => {
    res.clearCookie('isAuthenticated');
    res.status(200).json({ message: 'Abmeldung erfolgreich.' });
});

// --- Authentication Wall Middleware ---
// All requests below this point require authentication.
app.use((req, res, next) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        return next(); // User is authenticated, proceed.
    }
    // If user is not authenticated:
    if (req.path.startsWith('/api/')) {
        // For API calls, send a 401 Unauthorized error.
        return res.status(401).json({ error: 'Nicht authentifiziert. Bitte melden Sie sich an.' });
    }
    // For any other page requests, redirect to the login page.
    res.redirect('/login.html');
});


// --- Protected Routes ---
// Only authenticated requests can reach this part of the application.

// Serve the static assets of the React app (JS, CSS, images).
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/generate-plan', async (req, res) => {
    const { settings, previousPlanRecipes } = req.body;
    
    if (!process.env.API_KEY) {
        return res.status(500).json({ error: 'API-Schlüssel ist auf dem Server nicht konfiguriert.' });
    }
    if (!settings) {
        return res.status(400).json({ error: 'Einstellungen fehlen in der Anfrage.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
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

        const planPrompt = `Erstelle einen ${planType} für eine ganze Woche (Montag bis Sonntag) für ${persons} Personen.
        Das tägliche Kalorienziel pro Person ist ${kcal} kcal. Halte dich streng an dieses Ziel. Die Summe der Kalorien von Frühstück und Abendessen pro Tag muss sehr nah an diesem Wert liegen (Abweichung max. 100 kcal).
        ${dietTypeInstruction}
        ${desiredIngredientsText}
        ${exclusionText}
        Der Plan soll einfach und schnell umsetzbar sein.${varietyInstruction}
        ${breakfastInstruction}
        Das Abendessen soll jeden Tag ein anderes warmes Gericht sein.
        Generiere eine detaillierte und vollständige Einkaufsliste für ALLE Zutaten der Woche für ${persons} Personen. Gruppiere die Einkaufsliste nach sinnvollen Kategorien.
        Erstelle detaillierte Rezepte für jedes Abendessen.
        WICHTIG: Alle Nährwertangaben müssen IMMER PRO PERSON berechnet werden. Die Zutatenlisten sind für ${persons} Personen. Die Angabe von Kalorien ist zwingend erforderlich. Die Angabe von Protein, Kohlenhydraten und Fett für die Rezepte ist optional, aber sehr erwünscht.
        `;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Ein kurzer, kreativer und einprägsamer Name für diesen Ernährungsplan auf Deutsch, basierend auf den generierten Gerichten. Antworte NUR mit dem Namen, ohne Anführungszeichen oder zusätzliche Erklärungen." },
                shoppingList: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
                weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, breakfast: { type: Type.STRING }, breakfastCalories: { type: Type.NUMBER }, dinner: { type: Type.STRING }, dinnerCalories: { type: Type.NUMBER } } } },
                recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, title: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, totalCalories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } } } }
            },
            required: ["name", "shoppingList", "weeklyPlan", "recipes"]
        };

        const planResponse = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: planPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: responseSchema }
        });
        
        const parsedData = JSON.parse(planResponse.text);

        res.json({ 
            data: parsedData,
            debug: { planPrompt }
        });

    } catch (error) {
        console.error('[API Error] Kritischer Fehler bei der Plan-Generierung:', error);
        res.status(503).json({ error: `Fehler bei der Kommunikation mit der KI: ${error.message}` });
    }
});

app.post('/api/generate-image', async (req, res) => {
    const { recipe, attempt } = req.body;

    if (!process.env.API_KEY) {
        return res.status(500).json({ error: 'API-Schlüssel ist auf dem Server nicht konfiguriert.' });
    }
    if (!recipe) {
        return res.status(400).json({ error: 'Rezept fehlt in der Anfrage.' });
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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


// For any other authenticated GET request, send the main index.html file.
// This handles the initial page load and allows for client-side routing if added later.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
});