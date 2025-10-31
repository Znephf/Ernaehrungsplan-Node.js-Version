import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Modality, Type } from '@google/genai';

// Umgebungsvariablen laden (für lokale Entwicklung)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Plesk stellt den Port über eine Umgebungsvariable bereit
const port = process.env.PORT || 3001;

// --- Security Configuration ---
const APP_PASSWORD = process.env.APP_PASSWORD;
const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET || !APP_PASSWORD) {
    console.error('FATAL ERROR: COOKIE_SECRET oder APP_PASSWORD ist nicht in den Umgebungsvariablen gesetzt. Die Anwendung kann nicht sicher gestartet werden.');
    process.exit(1);
}

// --- Middlewares ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));


// --- Public Routes ---
// Endpunkt, der die Passwort-Anmeldung verarbeitet
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        // Bei Erfolg wird ein sicheres, signiertes Cookie für 30 Tage gesetzt
        res.cookie('isAuthenticated', 'true', {
            signed: true,
            httpOnly: true,
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 Tage
        });
        res.redirect('/');
    } else {
        // Bei Misserfolg wird der Benutzer mit einer Fehlermeldung zurück zur Login-Seite geleitet
        res.redirect('/?error=1');
    }
});


// --- Authentication Wall Middleware ---
// Diese Middleware schützt alle nachfolgenden Routen.
app.use((req, res, next) => {
    // Wenn das Cookie gültig ist, hat der Benutzer Zugriff.
    if (req.signedCookies.isAuthenticated === 'true') {
        return next();
    }

    // Wenn der Benutzer nicht authentifiziert ist...
    // ...und versucht, auf eine API zuzugreifen, wird die Anfrage mit einem Fehler abgelehnt.
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Nicht authentifiziert. Bitte melden Sie sich an.' });
    }

    // ...für alle anderen Anfragen wird die Login-Seite angezeigt.
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// --- Protected Routes ---
// Nur authentifizierte Anfragen erreichen diesen Teil der Anwendung.

// API-Proxy-Endpunkt für die Plan-Generierung
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

        const exclusionText = excludedIngredients.trim()
            ? `Folgende Zutaten oder Zutaten-Gruppen sollen explizit vermieden werden: ${excludedIngredients}.`
            : '';
        
        const desiredIngredientsText = desiredIngredients.trim()
            ? `Folgende Zutaten sollen bevorzugt werden und in mindestens einem Abendessen-Rezept vorkommen, aber nicht zwangsläufig in allen: ${desiredIngredients}.`
            : '';

        let breakfastInstruction = '';
        switch (breakfastOption) {
            case 'quark':
                breakfastInstruction = dietaryPreference === 'vegan'
                    ? "Das Frühstück soll jeden Tag nur aus einer veganen Quark-Alternative bestehen. Füge absolut keine weiteren Zutaten wie Toppings, Früchte oder Nüsse hinzu. Gib die Kalorien für die vegane Quark-Alternative entsprechend an."
                    : "Das Frühstück soll jeden Tag nur aus 'CremeQuark von Edeka' bestehen. Füge absolut keine weiteren Zutaten wie Toppings, Früchte oder Nüsse hinzu. Gib die Kalorien für dieses spezifische Produkt entsprechend an.";
                break;
            case 'muesli':
                breakfastInstruction = dietaryPreference === 'vegan'
                    ? 'Das Frühstück soll jeden Tag gleich sein und auf einem veganen Müsli (z.B. mit Hafermilch und Früchten) basieren, variiere aber die Toppings.'
                    : 'Das Frühstück soll jeden Tag gleich sein und auf Müsli basieren, variiere aber die Toppings.';
                break;
            case 'custom':
                breakfastInstruction = customBreakfast.trim()
                    ? `Das Frühstück soll jeden Tag gleich sein und dieser Beschreibung folgen: "${customBreakfast}". Falls es sinnvoll ist, variiere die Toppings oder kleine Beilagen.`
                    : 'Das Frühstück kann eine beliebige, einfache Mahlzeit sein und soll jeden Tag gleich sein.';
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
        WICHTIG: Alle Nährwertangaben (Kalorien, Protein, etc.) müssen IMMER PRO PERSON berechnet werden. Die Zutatenlisten sind für ${persons} Personen.
        `;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                shoppingList: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
                weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, breakfast: { type: Type.STRING }, breakfastCalories: { type: Type.NUMBER }, dinner: { type: Type.STRING }, dinnerCalories: { type: Type.NUMBER } } } },
                recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, title: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, totalCalories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } } } }
            },
            required: ["shoppingList", "weeklyPlan", "recipes"]
        };

        const planResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: planPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: responseSchema }
        });
        
        const parsedData = JSON.parse(planResponse.text);

        const recipeTitles = parsedData.recipes.map((r) => r.title).join(', ');
        const namePrompt = `Basierend auf diesen Abendessen-Rezepten für eine Woche: ${recipeTitles}. Erstelle einen kurzen, kreativen und einprägsamen Namen für diesen Ernährungsplan auf Deutsch.`;

        const nameResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: namePrompt }] }],
            config: { systemInstruction: "Antworte NUR mit dem Namen. Keine Erklärungen, keine Anführungszeichen." }
        });

        const newName = nameResponse.text.trim().replace(/"/g, '');

        res.json({ name: newName, ...parsedData });

    } catch (error) {
        console.error('Fehler bei der API-Anfrage:', error);
        res.status(500).json({ error: `Fehler bei der Kommunikation mit der KI: ${error.message}` });
    }
});

// API-Proxy-Endpunkt für die Bild-Generierung
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

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        res.json(response);

    } catch (error) {
        console.error('Fehler bei der Bildgenerierung:', error);
        res.status(500).json({ error: `Fehler bei der Bildgenerierung: ${error.message}` });
    }
});


// Statische Dateien aus dem 'dist'-Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'dist')));

// Alle anderen Anfragen an die index.html weiterleiten (für Client-Side-Routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
});