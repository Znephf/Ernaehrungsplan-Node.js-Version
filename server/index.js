
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initializeDatabase } = require('./services/database');

// Lade Umgebungsvariablen IMMER aus der .env-Datei im Projekt-Stammverzeichnis.
dotenv.config({ path: path.resolve(__dirname, '../.env') });


// --- Starup-Diagnose ---
console.error('--- Starte Server und prüfe Umgebungsvariablen ---');
const requiredVars = ['COOKIE_SECRET', 'APP_PASSWORD', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
requiredVars.forEach(v => {
    console.error(`Wert für ${v}:`, process.env[v] ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
});
console.error(`Wert für API_KEY:`, process.env.API_KEY ? '*** (gesetzt)' : 'Nicht gesetzt');
console.error(`Wert für API_KEY_FALLBACK:`, process.env.API_KEY_FALLBACK ? '*** (gesetzt, Fallback-Schlüssel aktiv)' : 'Nicht gesetzt');
console.error(`Wert für DB_PORT:`, process.env.DB_PORT ? process.env.DB_PORT : 'Nicht gesetzt, Standard: 3306');
console.error('--- Diagnose Ende ---');

// --- Überprüfung der Umgebungsvariablen ---
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Die Umgebungsvariable(n) ${missingVars.join(', ')} sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.`);
    process.exit(1);
}

if (!process.env.API_KEY && !process.env.API_KEY_FALLBACK) {
    console.error(`FATAL ERROR: Es muss mindestens eine API-Schlüssel-Umgebungsvariable (API_KEY oder API_KEY_FALLBACK) gesetzt sein. Die Anwendung wird beendet.`);
    process.exit(1);
}


// Erstelle notwendige öffentliche Verzeichnisse
const appRoot = path.resolve(__dirname, '..');
const publicSharesDir = path.resolve(appRoot, 'public', 'shares');
const distSharesDir = path.resolve(appRoot, 'dist', 'shares'); // WICHTIG: Auch im dist-Ordner erstellen
const publicImagesDir = path.resolve(appRoot, 'public', 'images', 'recipes');

[publicSharesDir, distSharesDir, publicImagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.error(`Verzeichnis erstellt unter: ${dir}`);
        } catch (e) {
            console.error(`Konnte Verzeichnis ${dir} nicht erstellen:`, e.message);
        }
    }
});

// --- SYNC FUNKTION: Public -> Dist ---
// Dies behebt das Problem, dass Nginx statische Dateien aus 'dist' serviert und 404s auf die React-App umleitet,
// bevor Node.js die Chance hat, die Datei aus 'public' zu servieren.
function syncSharesToDist() {
    console.error('--- Starte Synchronisation von public/shares nach dist/shares ---');
    try {
        if (!fs.existsSync(publicSharesDir)) return;
        if (!fs.existsSync(distSharesDir)) fs.mkdirSync(distSharesDir, { recursive: true });

        const files = fs.readdirSync(publicSharesDir);
        let count = 0;
        files.forEach(file => {
            if (file.endsWith('.html')) {
                const src = path.join(publicSharesDir, file);
                const dest = path.join(distSharesDir, file);
                // Kopiere nur, wenn Ziel nicht existiert oder Quelle neuer ist
                if (!fs.existsSync(dest) || fs.statSync(src).mtime > fs.statSync(dest).mtime) {
                    fs.copyFileSync(src, dest);
                    count++;
                }
            }
        });
        console.error(`Synchronisation abgeschlossen: ${count} Dateien kopiert/aktualisiert.`);
    } catch (error) {
        console.error('Fehler bei der Share-Synchronisation:', error);
    }
}


// --- App-Setup ---
const app = express();
const port = process.env.PORT || 3001;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// --- Logging Middleware für Debugging ---
app.use((req, res, next) => {
    // Logge nur Requests, die Shares betreffen, um die Konsole nicht zu fluten
    if (req.url.startsWith('/shares/')) {
        console.error(`[REQUEST] ${req.method} ${req.url}`);
    }
    next();
});

// ======================================================
// --- PRIORITY ROUTE: SHARES ---
// ======================================================
// Dient als Fallback, falls die Datei nicht statisch von Nginx ausgeliefert wurde
app.get('/shares/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // 1. Validierung
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.html')) {
        console.error(`[Shares Blocked] Ungültiger Dateiname: ${filename}`);
        return res.status(400).send('Ungültiger Dateiname.');
    }

    // Wir prüfen primär public/shares als "Source of Truth"
    const filePath = path.join(publicSharesDir, filename);

    // 3. Existenz-Prüfung
    if (fs.existsSync(filePath)) {
        console.error(`[Shares Found via Node] Sende Datei: ${filePath}`);
        
        // Caching deaktivieren
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        return res.sendFile(filePath);
    } else {
        console.error(`[Shares Missing] Datei existiert physisch nicht in public/shares: ${filePath}`);
        
        // Debug-Informationen sammeln
        let folderContents = [];
        try {
            if (fs.existsSync(publicSharesDir)) {
                folderContents = fs.readdirSync(publicSharesDir);
            }
        } catch (e) { folderContents = [`Error reading dir: ${e.message}`]; }

        const debugInfo = {
            requested: filename,
            fullPath: filePath,
            dirExists: fs.existsSync(publicSharesDir),
            filesInDir: folderContents
        };

        return res.status(404).send(`
            <html><body style="font-family:monospace; padding:20px; color:#881337; background:#fff1f2;">
            <h1>404 - Plan nicht gefunden</h1>
            <p>Der Server konnte die Datei <strong>${filename}</strong> nicht finden.</p>
            <hr>
            <h3>Server Debug Info:</h3>
            <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
            </body></html>
        `);
    }
});

// --- Weitere API Routen ---
const authRoutes = require('./routes/auth');
const archiveRoutes = require('./routes/archive');
const generationRoutes = require('./routes/generation');
const jobRoutes = require('./routes/jobs');
const recipeRoutes = require('./routes/recipes'); 
const { requireAuth } = require('./routes/auth'); 

app.use('/', authRoutes.unprotected);
app.use('/api', requireAuth, archiveRoutes);
app.use('/api', requireAuth, generationRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);
app.use('/api/recipes', requireAuth, recipeRoutes); 


// 2. Bilder bereitstellen
app.use('/images', express.static(path.resolve(__dirname, '../public/images')));

// 3. Allgemeine statische Dateien (für CSS, JS, etc.)
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.resolve(__dirname, '../dist')));

// --- Debug Endpunkt für Datei-Listing ---
app.get('/api/debug-shares', requireAuth, (req, res) => {
    const sharesPath = publicSharesDir;
    const distPath = distSharesDir;
    try {
        const publicFiles = fs.existsSync(sharesPath) ? fs.readdirSync(sharesPath) : ['DIR MISSING'];
        const distFiles = fs.existsSync(distPath) ? fs.readdirSync(distPath) : ['DIR MISSING'];
        
        res.json({ 
            publicPath: sharesPath, 
            publicFiles,
            distPath: distPath,
            distFiles
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Alle übrigen Anfragen an die React-App weiterleiten (SPA Catch-all)
app.get('*', (req, res) => {
    const distIndex = path.resolve(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndex)) {
        res.sendFile(distIndex);
    } else {
        res.status(404).send('React App noch nicht gebaut (dist/index.html fehlt). Bitte npm run build ausführen.');
    }
});

// --- Server starten ---
async function startServer() {
    syncSharesToDist(); // Shares vor dem DB-Start synchronisieren
    await initializeDatabase();
    const server = app.listen(port, () => {
        console.error(`Server läuft auf Port ${port}`);
        console.error(`Shares Verzeichnis (Public): ${publicSharesDir}`);
        console.error(`Shares Verzeichnis (Dist): ${distSharesDir}`);
    });
    server.setTimeout(600000); 
}

startServer();
