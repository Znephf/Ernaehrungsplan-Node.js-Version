const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
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
        
        // FIX: The payload is stored as a JSON string and must be parsed before use.
        const payload = JSON.parse(jobs[0].payload);
        const { settings, previousPlanRecipes } = payload;
        
        if (!settings) {
            throw new Error('Die Job-Daten sind unvollständig und enthalten keine Einstellungen (settings).');
        }

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
        
        await connection.query("UPDATE generation_jobs SET status = 'generating_plan' WHERE jobId = ?", [jobId]);

        const planResponse = await generateWithRetry(ai, {
            model: TEXT_MODEL_NAME,
            contents: [{ parts: [{ text: planPrompt }] }],
            config: { responseMimeType: 'application/json', responseSchema: planSchema }
        });
        
        const planData = JSON.parse(planResponse.text);
        
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
// --- ÖFFENTLICHE API-ROUTEN ---
// ======================================================

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
        res.status(401).json({ error: 'Das eingegebene Passwort ist falsch.' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('isAuthenticated');
    res.status(200).json({ message: 'Abmeldung erfolgreich.' });
});

app.get('/api/check-auth', (req, res) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        res.json({ isAuthenticated: true });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// ======================================================
// --- GESCHÜTZTE API-ROUTEN ---
// ======================================================

const requireAuth = (req, res, next) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        return next();
    }
    res.status(401).json({ error: 'Nicht authentifiziert. Bitte melden Sie sich an.' });
};

// --- Archiv-Routen ---
app.get('/api/archive', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM archived_plans ORDER BY createdAt DESC');
        
        const archive = rows.map(row => {
            const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
            const planData = typeof row.planData === 'string' ? JSON.parse(row.planData) : row.planData;
            
            if (!planData || typeof planData !== 'object') {
                console.warn(`Ungültiger oder fehlender planData-Eintrag für Archiv-ID ${row.id} wird übersprungen.`);
                return null;
            }

            return {
                id: row.id.toString(),
                createdAt: new Date(row.createdAt).toLocaleString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                name: planData.name || 'Unbenannter Plan',
                ...settings,
                ...planData
            };
        }).filter(entry => entry !== null);
        
        res.json(archive);
    } catch (error) {
        console.error('Fehler beim Abrufen des Archivs:', error);
        res.status(500).json({ error: 'Archiv konnte nicht geladen werden.' });
    }
});

app.delete('/api/archive/:id', requireAuth, async (req, res) => {
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

app.put('/api/archive/image', requireAuth, async (req, res) => {
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


app.post('/api/generate-plan-job', requireAuth, async (req, res) => {
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

app.get('/api/job-status/:jobId', requireAuth, async (req, res) => {
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


app.post('/api/generate-image', requireAuth, async (req, res) => {
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
// --- BEREITSTELLUNG DER REACT-APP ---
// ======================================================
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