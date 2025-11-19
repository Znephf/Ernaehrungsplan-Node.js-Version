
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

const appRoot = path.resolve(__dirname, '..');
const publicSharesDir = path.resolve(appRoot, 'public', 'shares');
const distSharesDir = path.resolve(appRoot, 'dist', 'shares');
const publicImagesDir = path.resolve(appRoot, 'public', 'images', 'recipes');

// Erstelle Verzeichnisse
[publicSharesDir, distSharesDir, publicImagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error(`Fehler beim Erstellen von ${dir}:`, e.message); }
    }
});

// --- SYNC FUNKTION: Public -> Dist ---
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

const app = express();
const port = process.env.PORT || 3001;

// ======================================================
// --- PRIORITY MIDDLEWARE: SHARES (STRICT ROUTING) ---
// ======================================================
// Wir nutzen app.use('/shares') anstelle von app.get, um sicherzustellen,
// dass ALLES was mit /shares beginnt, hier abgehandelt wird.
// Wenn die Datei nicht existiert, senden wir hier einen 404 und lassen die Anfrage
// NIEMALS durchrutschen (kein next()), damit nicht versehentlich die React-App geladen wird.
app.use('/shares', (req, res) => {
    // req.path ist hier relativ zu /shares. Z.B. bei Anfrage "/shares/abc.html" ist req.path "/abc.html"
    const rawFilename = req.path.startsWith('/') ? req.path.slice(1) : req.path;
    const filename = decodeURIComponent(rawFilename); // Sicherheit gegen URL-Encoding Probleme

    console.log(`[Shares Router] Zugriff auf: ${filename}`);

    // 1. Sicherheits-Checks
    if (!filename || filename === '' || filename === '/') {
        return res.status(404).send('Directory listing forbidden.');
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        console.warn(`[Shares Router] Illegal path traversal attempt: ${filename}`);
        return res.status(400).send('Invalid filename.');
    }
    
    // 2. Typ-Validierung (Nur HTML erlaubt)
    if (!filename.endsWith('.html')) {
        console.warn(`[Shares Router] Blocked non-html access: ${filename}`);
        return res.status(404).send('Only .html files are supported in this directory.');
    }

    // 3. Pfade prüfen
    const publicPath = path.join(publicSharesDir, filename);
    const distPath = path.join(distSharesDir, filename);

    const serveFile = (filePath) => {
        // Aggressive No-Cache Header, damit Updates sofort sichtbar sind
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[Shares Router] Send error for ${filePath}:`, err);
                if (!res.headersSent) res.status(500).send('Server Error during file delivery.');
            }
        });
    };

    if (fs.existsSync(publicPath)) {
        return serveFile(publicPath);
    }

    if (fs.existsSync(distPath)) {
        return serveFile(distPath);
    }

    // 4. Datei nicht gefunden -> Explizite 404 HTML Seite senden.
    // WICHTIG: Wir rufen NICHT next() auf, damit Express nicht versucht, andere Routen zu matchen.
    console.error(`[Shares Router] 404 Not Found: ${filename}`);
    return res.status(404).send(`
        <html>
        <head>
            <title>Plan nicht gefunden</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center; color: #334155; background-color: #f1f5f9;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <h1 style="color: #dc2626; margin-bottom: 1rem;">404 - Plan nicht gefunden</h1>
                <p style="margin-bottom: 1.5rem;">Die angeforderte Datei <strong>${filename}</strong> existiert nicht auf diesem Server.</p>
                <p style="font-size: 0.875rem; color: #64748b;">Möglicherweise ist der Link veraltet oder wurde falsch kopiert.</p>
                <a href="/" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #059669; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: bold;">Zur Startseite</a>
            </div>
        </body>
        </html>
    `);
});

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// --- API Routen ---
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


// --- Statische Dateien ---
app.use('/images', express.static(path.resolve(__dirname, '../public/images')));
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.resolve(__dirname, '../dist')));

// --- Catch-All für React App ---
app.get('*', (req, res) => {
    const distIndex = path.resolve(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndex)) {
        // Verhindert Caching der Hauptdatei, damit Updates (wie Service Worker Entfernung) sofort greifen
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(distIndex);
    } else {
        res.status(404).send('React App Index nicht gefunden. Bitte npm run build ausführen.');
    }
});

async function startServer() {
    syncSharesToDist();
    await initializeDatabase();
    app.listen(port, () => {
        console.error(`Server läuft auf Port ${port}`);
    });
}

startServer();