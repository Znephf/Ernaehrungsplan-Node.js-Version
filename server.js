const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const { GoogleGenAI, Modality, Type } = require('@google/genai');

// Lade Umgebungsvariablen aus der .env-Datei, ABER nur wenn wir NICHT in Produktion sind.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// --- Starup-Diagnose ---
console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
const requiredVars = ['COOKIE_SECRET', 'APP_PASSWORD', 'API_KEY', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
requiredVars.forEach(v => {
    console.log(`Wert für ${v}:`, process.env[v] ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
});
console.log(`Wert für DB_PORT:`, process.env.DB_PORT ? process.env.DB_PORT : 'Nicht gesetzt, Standard: 3306');
console.log('--- Diagnose Ende ---');

// --- Überprüfung der Umgebungsvariablen ---
const { APP_PASSWORD, COOKIE_SECRET, API_KEY, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Die Umgebungsvariable(n) ${missingVars.join(', ')} sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.`);
    process.exit(1);
}

// Erstelle Verzeichnisse für öffentliche Freigaben
const publicSharesDir = path.join(__dirname, 'public', 'shares');
if (!fs.existsSync(publicSharesDir)) {
    fs.mkdirSync(publicSharesDir, { recursive: true });
    console.log(`Verzeichnis für geteilte Pläne erstellt unter: ${publicSharesDir}`);
}

// --- Datenbank-Setup ---
const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('Erfolgreich mit der MariaDB-Datenbank verbunden.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS archived_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                name VARCHAR(255) NOT NULL,
                settings JSON NOT NULL,
                planData JSON NOT NULL
            );
        `);
        console.log('Tabelle "archived_plans" ist bereit.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS generation_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                jobId VARCHAR(36) NOT NULL UNIQUE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                payload JSON,
                planId INT NULL,
                errorMessage TEXT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (planId) REFERENCES archived_plans(id) ON DELETE SET NULL
            );
        `);
        console.log('Tabelle "generation_jobs" ist bereit.');

        connection.release();
    } catch (error) {
        console.error('FATAL ERROR: Konnte die Datenbankverbindung nicht herstellen oder Tabelle nicht erstellen.', error);
        process.exit(1);
    }
}


// --- App-Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));

// --- Konstanten für KI-Modelle ---
const TEXT_MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

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
// --- ASYNCHRONER GENERIERUNGS-WORKER ---
// ======================================================

async function processGenerationJob(jobId) {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    let connection;
    try {
        connection = await pool.getConnection();
        const [jobs] = await connection.query('SELECT payload FROM generation_jobs WHERE jobId = ?', [jobId]);
        if (jobs.length === 0) {
            throw new Error(`Job ${jobId} nicht in der Datenbank gefunden.`);
        }
        
        const rawPayload = jobs[0].payload;
        const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        const { settings, previousPlanRecipes } = payload;
        
        if (!settings) {
            throw new Error('Die Job-Daten sind unvollständig und enthalten keine Einstellungen (settings).');
        }

        const { persons, kcal, dietaryPreference, dietType, excludedIngredients, desiredIngredients, breakfastOption, customBreakfast, isGlutenFree, isLactoseFree } = settings;

        let planType = "Ernährungsplan";
        if (dietaryPreference === 'vegetarian') planType = "vegetarischen Ernährungsplan";
        else if (dietaryPreference === 'vegan') planType = "veganen Ernährungsplan";

        const exclusionText = excludedIngredients.trim() ? `Folgende Zutaten oder Zutaten-Gruppen sollen explizit vermieden werden: ${excludedIngredients}.` : '';
        const desiredIngredientsText = desiredIngredients.trim() ? `Folgende Zutaten sollen bevorzugt werden und in mindestens einem Abendessen-Rezept vorkommen, aber nicht zwangsläufig in allen: ${desiredIngredients}.` : '';
        
        let specialDietInstructions = '';
        if (isGlutenFree && isLactoseFree) {
            specialDietInstructions = 'Alle Gerichte und Zutaten müssen strikt glutenfrei UND laktosefrei sein.';
        } else if (isGlutenFree) {
            specialDietInstructions = 'Alle Gerichte und Zutaten müssen strikt glutenfrei sein.';
        } else if (isLactoseFree) {
            specialDietInstructions = 'Alle Gerichte und Zutaten müssen strikt laktosefrei sein.';
        }


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
        ${specialDietInstructions}
        ${desiredIngredientsText}
        ${exclusionText}
        Der Plan soll einfach und schnell umsetzbar sein.${varietyInstruction}
        ${breakfastInstruction}
        Das Abendessen soll jeden Tag ein anderes warmes Gericht sein.
        Erstelle detaillierte Rezepte für jedes Abendessen.
        WICHTIG: Alle Nährwertangaben (Kalorien, Makros) müssen IMMER PRO PERSON berechnet werden. Die Zutatenlisten in den Rezepten sind für ${persons} Personen. Die Angabe von 'breakfastCalories' und 'dinnerCalories' als Zahlen ist für jeden Tag zwingend erforderlich.
        `;

        const planSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Ein kurzer, kreativer und einprägsmamer Name für diesen Ernährungsplan auf Deutsch, basierend auf den generierten Gerichten. Antworte NUR mit dem Namen, ohne Anführungszeichen oder zusätzliche Erklärungen." },
                weeklyPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, breakfast: { type: Type.STRING }, breakfastCalories: { type: Type.NUMBER }, dinner: { type: Type.STRING }, dinnerCalories: { type: Type.NUMBER } } } },
                recipes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, title: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }, instructions: { type: Type.ARRAY, items: { type: Type.STRING } }, totalCalories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } } } }
            },
            required: ["name", "weeklyPlan", "recipes"]
        };
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_plan' WHERE jobId = ?", [jobId]);

        const temperature = parseFloat((Math.random() * (1.0 - 0.7) + 0.7).toFixed(2));

        const planResponse = await generateWithRetry(ai, {
            model: TEXT_MODEL_NAME,
            contents: [{ parts: [{ text: planPrompt }] }],
            config: { 
                responseMimeType: 'application/json', 
                responseSchema: planSchema,
                temperature: temperature
            }
        });
        
        const planData = JSON.parse(planResponse.text);

        // --- START VALIDATION ---
        const validatePlanData = (data) => {
            if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
                throw new Error("Validierung fehlgeschlagen: Der Planname (name) fehlt oder ist leer.");
            }
            if (!Array.isArray(data.weeklyPlan) || data.weeklyPlan.length === 0) {
                 throw new Error(`Validierung fehlgeschlagen: Der Wochenplan ist leer oder kein Array.`);
            }
            for (const dayPlan of data.weeklyPlan) {
                if (
                    typeof dayPlan.day !== 'string' ||
                    typeof dayPlan.breakfast !== 'string' ||
                    typeof dayPlan.breakfastCalories !== 'number' ||
                    typeof dayPlan.dinner !== 'string' ||
                    typeof dayPlan.dinnerCalories !== 'number'
                ) {
                    console.error("Fehlerhaftes Tagesplan-Objekt von der KI erhalten:", dayPlan);
                    throw new Error(`Validierung fehlgeschlagen: Ein Tagesplan-Objekt ist unvollständig. Es fehlen Felder oder die Typen sind falsch (z.B. Kalorien müssen Zahlen sein).`);
                }
            }
            if (!Array.isArray(data.recipes) || data.recipes.length === 0) {
                throw new Error("Validierung fehlgeschlagen: Rezepte sind leer oder kein Array.");
            }
            for (const recipe of data.recipes) {
                if (
                    typeof recipe.day !== 'string' ||
                    typeof recipe.title !== 'string' ||
                    !Array.isArray(recipe.ingredients) ||
                    !Array.isArray(recipe.instructions) ||
                    typeof recipe.totalCalories !== 'number'
                ) {
                    console.error("Fehlerhaftes Rezept-Objekt von der KI erhalten:", recipe);
                    throw new Error(`Validierung fehlgeschlagen: Ein Rezept-Objekt ist unvollständig. Es fehlen Felder oder die Typen sind falsch.`);
                }
            }
        };

        try {
            validatePlanData(planData);
        } catch (validationError) {
            console.error("Die von der KI generierten Plandaten sind fehlerhaft und entsprechen nicht dem Schema.", validationError);
            throw validationError;
        }
        // --- END VALIDATION ---
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_shopping_list' WHERE jobId = ?", [jobId]);

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
            model: TEXT_MODEL_NAME,
            contents: [{ parts: [{ text: shoppingListPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: shoppingListSchema }
        });

        const shoppingListData = JSON.parse(shoppingListResponse.text);
        
        const finalPlan = {
            ...planData,
            shoppingList: shoppingListData.shoppingList,
            imageUrls: {} // Initialize with empty images object
        };
        
        const [result] = await connection.query(
            'INSERT INTO archived_plans (name, settings, planData) VALUES (?, ?, ?)',
            [finalPlan.name, JSON.stringify(settings), JSON.stringify(finalPlan)]
        );
        const newPlanId = result.insertId;

        await connection.query("UPDATE generation_jobs SET status = 'complete', planId = ? WHERE jobId = ?", [newPlanId, jobId]);
        console.log(`Job ${jobId} erfolgreich abgeschlossen. Plan-ID: ${newPlanId}`);

    } catch (error) {
        console.error(`[Job ${jobId}] Fehler bei der Verarbeitung:`, error);
        if (connection) {
            await connection.query("UPDATE generation_jobs SET status = 'error', errorMessage = ? WHERE jobId = ?", [error.message, jobId]);
        }
    } finally {
        if (connection) connection.release();
    }
}


// ======================================================
// --- AUTHENTICATION & ROUTING ---
// ======================================================

const requireAuth = (req, res, next) => {
  if (req.signedCookies.isAuthenticated === 'true') {
    return next();
  }
  res.status(401).json({ error: 'Nicht authentifiziert.' });
};

// Handle login via API request from the React component
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        res.cookie('isAuthenticated', 'true', {
            signed: true,
            httpOnly: true,
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Tage
            secure: process.env.NODE_ENV === 'production',
        });
        res.status(200).json({ message: 'Anmeldung erfolgreich.' });
    } else {
        res.status(401).json({ error: 'Falsches Passwort.' });
    }
});

// Handle logout via API request
app.post('/logout', (req, res) => {
    res.clearCookie('isAuthenticated');
    res.status(200).json({ message: 'Abmeldung erfolgreich.' });
});

// Endpoint for the client to check if it's already authenticated
app.get('/api/check-auth', (req, res) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        res.status(200).json({ isAuthenticated: true });
    } else {
        res.status(401).json({ isAuthenticated: false });
    }
});

// Protect all subsequent API routes
app.use('/api', requireAuth);


// ======================================================
// --- GESCHÜTZTE API-ROUTEN ---
// ======================================================

// --- Archiv-Routen ---
app.get('/api/archive', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM archived_plans ORDER BY createdAt DESC');
        
        const archive = rows.map(row => {
            try {
                const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
                const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;
                
                // --- Datenintegritätsprüfung ---
                // Ein gültiger Plan MUSS ein planData-Objekt mit name, weeklyPlan, recipes und shoppingList haben.
                if (
                    !planData || typeof planData !== 'object' ||
                    !planData.name ||
                    !Array.isArray(planData.weeklyPlan) || planData.weeklyPlan.length === 0 ||
                    !Array.isArray(planData.recipes) || planData.recipes.length === 0 ||
                    !Array.isArray(planData.shoppingList)
                ) {
                    console.warn(`[Archiv] Plan mit ID ${row.id} wird übersprungen, da die Plandaten unvollständig oder korrupt sind.`);
                    return null; // Dieser Eintrag wird später herausgefiltert.
                }

                return {
                    id: row.id.toString(),
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    name: planData.name, // Wir haben bereits validiert, dass der Name existiert.
                    ...settings,
                    ...planData
                };
            } catch(e) {
                console.error(`[Archiv] Fehler beim Verarbeiten von Plan mit ID ${row.id}:`, e);
                return null; // Überspringe diesen Eintrag bei einem JSON-Parse-Fehler oder einem anderen unerwarteten Fehler.
            }
        }).filter(entry => entry !== null);
        
        res.json(archive);
    } catch (error) {
        console.error('Fehler beim Abrufen des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

app.delete('/api/archive/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM archived_plans WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Eintrag erfolgreich gelöscht.' });
        } else {
            res.status(404).json({ error: 'Eintrag nicht gefunden.' });
        }
    } catch (error) {
        console.error(`Fehler beim Löschen von Eintrag ${id}:`, error);
        res.status(500).json({ error: 'Eintrag konnte nicht gelöscht werden.' });
    }
});

app.put('/api/archive/image', async (req, res) => {
    const { planId, day, imageUrl } = req.body;
    if (!planId || !day || !imageUrl) {
        return res.status(400).json({ error: 'Fehlende Daten zum Speichern des Bildes.' });
    }

    try {
        const [rows] = await pool.query('SELECT planData FROM archived_plans WHERE id = ?', [planId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Plan nicht gefunden.' });
        }

        const planData = typeof rows[0].planData === 'string' ? JSON.parse(rows[0].planData) : rows[0].planData;

        if (!planData.imageUrls) {
            planData.imageUrls = {};
        }
        planData.imageUrls[day] = imageUrl;

        await pool.query('UPDATE archived_plans SET planData = ? WHERE id = ?', [JSON.stringify(planData), planId]);

        res.status(200).json({ message: 'Bild erfolgreich gespeichert.' });
    } catch (error) {
        console.error(`Fehler beim Speichern des Bildes für Plan ${planId}:`, error);
        res.status(500).json({ error: 'Bild konnte nicht in der Datenbank gespeichert werden.' });
    }
});


app.post('/api/generate-plan-job', async (req, res) => {
    const payload = req.body;
     if (!payload.settings) {
        return res.status(400).json({ error: 'Einstellungen fehlen in der Anfrage.' });
    }
    const jobId = crypto.randomUUID();
    try {
        await pool.query('INSERT INTO generation_jobs (jobId, payload) VALUES (?, ?)', [jobId, JSON.stringify(payload)]);
        
        processGenerationJob(jobId);

        res.status(202).json({ jobId });
    } catch (error) {
        console.error('Fehler beim Erstellen des Generierungs-Jobs:', error);
        res.status(500).json({ error: 'Job konnte nicht erstellt werden.' });
    }
});

app.get('/api/job-status/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
        const [jobRows] = await pool.query('SELECT status, planId, errorMessage FROM generation_jobs WHERE jobId = ?', [jobId]);
        if (jobRows.length === 0) {
            return res.status(404).json({ error: 'Job nicht gefunden.' });
        }
        const { status, planId, errorMessage } = jobRows[0];

        if (status === 'complete' && planId) {
            const [planRows] = await pool.query('SELECT * FROM archived_plans WHERE id = ?', [planId]);
            if (planRows.length > 0) {
                const row = planRows[0];
                const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
                const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;

                const newPlanEntry = {
                    id: row.id.toString(),
                    createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    name: planData.name || 'Unbenannter Plan',
                    ...settings,
                    ...planData
                };

                return res.json({ status, plan: newPlanEntry, error: errorMessage });
            }
        }
        
        // For other statuses or if plan not found (edge case), return original response
        res.json({ status, planId: planId?.toString(), error: errorMessage });

    } catch (error) {
        console.error(`Fehler beim Abrufen des Status für Job ${jobId}:`, error);
        res.status(500).json({ error: 'Job-Status konnte nicht abgerufen werden.' });
    }
});


app.post('/api/generate-image', async (req, res) => {
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
            model: IMAGE_MODEL_NAME,
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        res.json({
            apiResponse: response,
            debug: { imagePrompt: prompt }
        });

    } catch (error) {
        console.error('[API Error] Kritischer Fehler bei der Bild-Generierung:', error);
        const errorMessage = String(error.message || '');
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
            return res.status(429).json({ error: 'API-Nutzungslimit (Quota) überschritten. Bitte Tarif & Abrechnung in der Google Cloud Console prüfen.' });
        }
        res.status(503).json({ error: `Fehler bei der Bildgenerierung: ${errorMessage}` });
    }
});


// ======================================================
// --- HTML EXPORT FÜR "TEILEN"-FUNKTION ---
// ======================================================

const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const Icons = {
    fire: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14.5 5 16.5 8 16.5 10c0 1-1.5 3-1.5 3s.625 2.375 2.625 4.375c2 2 4.375 2.625 4.375 2.625s-2.5-1.5-3-1.5c-1 0-3 .5-5 2.986C9 19.5 7 17.5 7 15.5c0-1.5 3-1.5 3-1.5s-2.375.625-4.375 2.625c-2 2-2.625 4.375-2.625 4.375A8 8 0 0117.657 18.657z" /></svg>`,
    protein: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>`,
    carbs: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>`,
    fat: `<svg class="h-6 w-6 text-emerald-600" stroke-width="1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.002 9.002 0 008.485-6.132l-1.39-1.39a2.25 2.25 0 00-3.182 0l-1.09 1.09a2.25 2.25 0 01-3.182 0l-1.09-1.09a2.25 2.25 0 00-3.182 0L2.514 14.868A9.002 9.002 0 0012 21zM5.334 12.793a9.002 9.002 0 0113.332 0" /></svg>`,
};

function generateShareableHtml(plan, imageUrls) {
    const weeklyPlanHtml = `
    <div class="space-y-8">
        <h2 class="text-3xl font-bold text-center text-slate-700">${escapeHtml(plan.name)}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${plan.weeklyPlan.map(p => {
                const totalCalories = (p.breakfastCalories || 0) + (p.dinnerCalories || 0);
                return `
                    <div class="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
                        <div class="bg-emerald-600 text-white p-4 flex justify-between items-center">
                            <h3 class="text-xl font-bold">${escapeHtml(p.day)}</h3>
                            <div class="flex items-center gap-1 text-sm bg-emerald-700 px-2 py-1 rounded-full">${Icons.fire}<span>${totalCalories} kcal</span></div>
                        </div>
                        <div class="p-6 space-y-4 flex-grow">
                            <div>
                                <p class="font-semibold text-emerald-800 flex justify-between"><span>Frühstück:</span><span class="font-normal text-slate-500">${p.breakfastCalories} kcal</span></p>
                                <p class="text-slate-600">${escapeHtml(p.breakfast)}</p>
                            </div>
                            <div>
                                <p class="font-semibold text-emerald-800 flex justify-between"><span>Abendessen:</span><span class="font-normal text-slate-500">${p.dinnerCalories} kcal</span></p>
                                <a href="#recipe-${escapeHtml(p.day)}" class="recipe-link text-left text-slate-600 hover:text-emerald-600 font-semibold transition-colors w-full">${escapeHtml(p.dinner)}</a>
                            </div>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    </div>`;

    const shoppingListHtml = `
    <div class="space-y-8">
      <h2 class="text-3xl font-bold text-slate-700">Wöchentliche Einkaufsliste</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
        ${plan.shoppingList.map(({ category, items }) => `
          <div class="bg-white rounded-lg shadow-lg p-6 break-inside-avoid">
            <h3 class="text-xl font-semibold text-emerald-700 border-b-2 border-emerald-200 pb-2 mb-4">${escapeHtml(category)}</h3>
            <ul class="space-y-2">
              ${(items || []).map(item => `
                <li>
                  <label class="flex items-center cursor-pointer select-none">
                    <input type="checkbox" class="shopping-item-checkbox h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
                    <span class="ml-3 text-slate-600">${escapeHtml(item)}</span>
                  </label>
                </li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
    </div>`;

    const recipesHtml = `
    <div class="space-y-8">
      <div class="text-center sm:text-left">
          <h2 class="text-3xl font-bold text-slate-700">Kochanleitungen für das Abendessen</h2>
          <p class="text-slate-500">Alle Rezepte sind für ${plan.persons || 2} Personen ausgelegt.</p>
      </div>
      <div class="space-y-12">
        ${plan.recipes.map(recipe => `
          <div id="recipe-${escapeHtml(recipe.day)}" class="bg-white rounded-lg shadow-lg overflow-hidden">
            ${imageUrls[recipe.day] 
              ? `<div class="bg-slate-200"><img src="${imageUrls[recipe.day]}" alt="${escapeHtml(recipe.title)}" class="w-full h-auto object-cover aspect-video"/></div>` 
              : `<div class="aspect-video bg-slate-200 flex items-center justify-center"><p class="text-slate-500">Kein Bild generiert</p></div>`}
            <div class="p-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">${escapeHtml(recipe.day)}</span>
                <div class="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">${Icons.fire}<span>ca. ${recipe.totalCalories} kcal pro Portion</span></div>
              </div>
              <h3 class="text-2xl font-bold text-slate-800 mt-3">${escapeHtml(recipe.title)}</h3>
              ${recipe.protein !== undefined ? `
                <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600 p-3 bg-slate-50 rounded-lg">
                    <span class="flex items-center gap-1.5 text-sm">${Icons.protein}<div><span class="font-bold">${recipe.protein}g</span><span class="text-slate-500 text-xs block">Protein</span></div></span>
                    <span class="flex items-center gap-1.5 text-sm">${Icons.carbs}<div><span class="font-bold">${recipe.carbs}g</span><span class="text-slate-500 text-xs block">Kohlenh.</span></div></span>
                    <span class="flex items-center gap-1.5 text-sm">${Icons.fat}<div><span class="font-bold">${recipe.fat}g</span><span class="text-slate-500 text-xs block">Fett</span></div></span>
                </div>` : ''}
              <div class="mt-6 grid grid-cols-1 md:grid-cols-5 gap-x-8 gap-y-6">
                <div class="md:col-span-2">
                  <h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Zutaten:</h4>
                  <ul class="space-y-2 list-disc list-inside text-slate-600">${(recipe.ingredients || []).map(ing => `<li>${escapeHtml(ing)}</li>`).join('')}</ul>
                </div>
                <div class="md:col-span-3 md:border-l md:border-slate-200 md:pl-8">
                  <h4 class="text-lg font-semibold text-slate-700 border-b-2 border-slate-200 pb-2 mb-3">Anleitung:</h4>
                  <ol class="space-y-3 list-decimal list-inside text-slate-600">${(recipe.instructions || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                </div>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

    return `<!DOCTYPE html><html lang="de" style="scroll-behavior: smooth;"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(plan.name)}</title><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: sans-serif; background-color: #f1f5f9; } .view { display: none; } .view.active { display: block; } .nav-button.active { background-color: #047857; color: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }</style></head><body class="bg-slate-100"><header class="bg-white shadow-md sticky top-0 z-10"><div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4"><h1 class="text-2xl font-bold text-slate-800">KI Ernährungsplaner</h1><nav class="flex items-center justify-center gap-2 sm:gap-4 p-1 bg-slate-100 rounded-lg"><button data-view="plan" class="nav-button active px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Wochenplan</button><button data-view="shopping" class="nav-button px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Einkaufsliste</button><button data-view="recipes" class="nav-button px-4 py-2 text-sm sm:text-base font-medium rounded-md text-slate-600 hover:bg-slate-200">Rezepte</button></nav></div></header><main class="container mx-auto px-4 sm:px-6 lg:px-8 py-8"><div id="view-plan" class="view active">${weeklyPlanHtml}</div><div id="view-shopping" class="view">${shoppingListHtml}</div><div id="view-recipes" class="view">${recipesHtml}</div></main><script>document.addEventListener('DOMContentLoaded',()=>{const views={plan:document.getElementById('view-plan'),shopping:document.getElementById('view-shopping'),recipes:document.getElementById('view-recipes')};const buttons=document.querySelectorAll('.nav-button');buttons.forEach(button=>{button.addEventListener('click',()=>{const viewName=button.getAttribute('data-view');buttons.forEach(btn=>btn.classList.remove('active'));button.classList.add('active');Object.values(views).forEach(v=>v.classList.remove('active'));if(views[viewName]){views[viewName].classList.add('active');}});});document.querySelectorAll('.shopping-item-checkbox').forEach(checkbox=>{checkbox.addEventListener('change',e=>{const span=e.target.closest('label').querySelector('span');if(e.target.checked){span.style.textDecoration='line-through';span.style.color='#94a3b8';}else{span.style.textDecoration='none';span.style.color='#475569';}});});document.querySelectorAll('a.recipe-link').forEach(link=>{link.addEventListener('click',e=>{e.preventDefault();const recipeId=link.getAttribute('href');document.querySelector('.nav-button[data-view="recipes"]').click();setTimeout(()=>{const recipeElement=document.querySelector(recipeId);if(recipeElement){recipeElement.scrollIntoView({behavior:'smooth'});}},50);});});});</script></body></html>`;
}

app.post('/api/share-plan', async (req, res) => {
    const { plan, imageUrls } = req.body;
    if (!plan || !imageUrls || !plan.name || !plan.weeklyPlan || !plan.recipes || !plan.shoppingList) {
        return res.status(400).json({ error: 'Unvollständige Plandaten für die Freigabe erhalten.' });
    }
    try {
        const htmlContent = generateShareableHtml(plan, imageUrls);
        const fileName = `${crypto.randomBytes(12).toString('hex')}.html`;
        const filePath = path.join(publicSharesDir, fileName);

        fs.writeFileSync(filePath, htmlContent, 'utf-8');

        const shareUrl = `/shares/${fileName}`;
        res.json({ shareUrl });

    } catch (error) {
        console.error('Fehler beim Erstellen des Links zum Teilen:', error);
        res.status(500).json({ error: 'Der Link zum Teilen konnte nicht erstellt werden.' });
    }
});


// ======================================================
// --- BEREITSTELLUNG DER REACT-APP ---
// ======================================================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Server starten ---
async function startServer() {
    await initializeDatabase();
    const server = app.listen(port, () => {
        console.log(`Server läuft auf Port ${port}`);
    });
    server.setTimeout(600000);
}

startServer();