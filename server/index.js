
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initializeDatabase } = require('./services/database');

// Lade Umgebungsvariablen IMMER aus der .env-Datei im Projekt-Stammverzeichnis.
// Dies stellt das alte Verhalten wieder her und gewährleistet die Funktion auf dem Plesk-Server.
dotenv.config({ path: path.resolve(__dirname, '../.env') });


// --- Starup-Diagnose ---
console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
// API_KEY ist nun optional und wird separat geprüft.
const requiredVars = ['COOKIE_SECRET', 'APP_PASSWORD', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
requiredVars.forEach(v => {
    console.log(`Wert für ${v}:`, process.env[v] ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
});
console.log(`Wert für API_KEY:`, process.env.API_KEY ? '*** (gesetzt)' : 'Nicht gesetzt');
console.log(`Wert für API_KEY_FALLBACK:`, process.env.API_KEY_FALLBACK ? '*** (gesetzt, Fallback-Schlüssel aktiv)' : 'Nicht gesetzt');
console.log(`Wert für DB_PORT:`, process.env.DB_PORT ? process.env.DB_PORT : 'Nicht gesetzt, Standard: 3306');
console.log('--- Diagnose Ende ---');

// --- Überprüfung der Umgebungsvariablen ---
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Die Umgebungsvariable(n) ${missingVars.join(', ')} sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.`);
    process.exit(1);
}

// Spezifische Prüfung, ob mindestens ein API-Schlüssel vorhanden ist.
if (!process.env.API_KEY && !process.env.API_KEY_FALLBACK) {
    console.error(`FATAL ERROR: Es muss mindestens eine API-Schlüssel-Umgebungsvariable (API_KEY oder API_KEY_FALLBACK) gesetzt sein. Die Anwendung wird beendet.`);
    process.exit(1);
}


// Erstelle notwendige öffentliche Verzeichnisse (sowohl Source als auch Build/Dist, falls vorhanden)
// Wir nutzen hier path.resolve, um sicherzustellen, dass wir vom Root ausgehen.
const appRoot = path.resolve(__dirname, '..');
const publicSharesDir = path.join(appRoot, 'public', 'shares');
const publicImagesDir = path.join(appRoot, 'public', 'images', 'recipes');

[publicSharesDir, publicImagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Verzeichnis erstellt unter: ${dir}`);
        } catch (e) {
            console.warn(`Konnte Verzeichnis ${dir} nicht erstellen:`, e.message);
        }
    }
});


// --- App-Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// --- Routen-Setup ---
const authRoutes = require('./routes/auth');
const archiveRoutes = require('./routes/archive');
const generationRoutes = require('./routes/generation');
const jobRoutes = require('./routes/jobs');
const recipeRoutes = require('./routes/recipes'); // Import recipe routes
const { requireAuth } = require('./routes/auth'); // Import middleware

app.use('/', authRoutes.unprotected);
app.use('/api', requireAuth, archiveRoutes);
app.use('/api', requireAuth, generationRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);
app.use('/api/recipes', requireAuth, recipeRoutes); // Use recipe routes


// ======================================================
// --- BEREITSTELLUNG STATISCHER DATEIEN ---
// ======================================================

// MANUELLE ROUTE FÜR /shares/
// Wir nutzen eine explizite Route anstelle von express.static, um sicherzustellen,
// dass neu erstellte Dateien sofort gefunden werden und um Debugging-Logs zu erhalten.
app.get('/shares/:filename', (req, res, next) => {
    const filename = req.params.filename;
    
    // Sicherheitscheck: Keine Pfad-Manipulation zulassen
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.html')) {
        return res.status(400).send('Ungültiger Dateiname.');
    }

    const sharesPath = path.join(__dirname, '../public/shares');
    const filePath = path.join(sharesPath, filename);

    console.log(`[Shares Debug] Anfrage für: ${filename}`);
    console.log(`[Shares Debug] Suche in: ${filePath}`);

    if (fs.existsSync(filePath)) {
        console.log(`[Shares Debug] Datei gefunden. Sende...`);
        // Verhindere Caching, damit Änderungen sofort sichtbar sind
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.sendFile(filePath);
    } else {
        console.log(`[Shares Debug] Datei NICHT gefunden.`);
        // Weiter zum nächsten Handler (React Catch-all oder 404)
        next();
    }
});


// 2. Bilder bereitstellen
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// 3. Allgemeine statische Dateien (für Production Build)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../dist')));

// Alle übrigen Anfragen an die React-App weiterleiten (SPA Catch-all)
app.get('*', (req, res) => {
    // Versuche zuerst index.html aus dist, dann fallback
    const distIndex = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndex)) {
        res.sendFile(distIndex);
    } else {
        res.status(404).send('React App noch nicht gebaut (dist/index.html fehlt). Bitte npm run build ausführen.');
    }
});

// --- Server starten ---
async function startServer() {
    await initializeDatabase();
    const server = app.listen(port, () => {
        console.log(`Server läuft auf Port ${port}`);
    });
    // Erhöhtes Timeout für langlaufende Anfragen (z.B. Plan-Generierung)
    server.setTimeout(600000); 
}

startServer();
