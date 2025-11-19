
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
// --- PRIORITY ROUTE: SHARES (MUST BE FIRST) ---
// ======================================================
app.get('/shares/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // Validierung: Erlaubt nur normale Dateinamen mit .html Endung
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.html')) {
        console.warn(`[Shares] Ungültiger Zugriff versucht: ${filename}`);
        return res.status(400).send('Ungültiger Dateiname.');
    }

    // 1. Suche in public/shares (Primary)
    const publicPath = path.join(publicSharesDir, filename);
    
    // Check for file existence
    if (fs.existsSync(publicPath)) {
        // Aggressive no-cache headers for share files
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        return res.sendFile(publicPath, (err) => {
            if (err) {
                console.error(`[Shares] Error sending file ${publicPath}:`, err);
                if (!res.headersSent) {
                    res.status(500).send('Error serving share file.');
                }
            }
        });
    }

    // 2. Suche in dist/shares (Secondary/Fallback)
    const distPath = path.join(distSharesDir, filename);
    if (fs.existsSync(distPath)) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.sendFile(distPath, (err) => {
            if (err) {
                console.error(`[Shares] Error sending file ${distPath}:`, err);
                if (!res.headersSent) {
                    res.status(500).send('Error serving share file.');
                }
            }
        });
    }

    // 3. Nicht gefunden -> Detaillierte Fehlerseite (kein React-Fallback!)
    console.error(`[Shares] Datei NICHT gefunden: ${filename}`);
    
    let dirContentPublic = [];
    try { dirContentPublic = fs.readdirSync(publicSharesDir); } catch(e) { dirContentPublic = [`Error: ${e.message}`]; }
    
    const debugInfo = {
        requestedFile: filename,
        searchedPublic: publicPath,
        existsPublic: false,
        searchedDist: distPath,
        existsDist: false,
        filesInPublic: dirContentPublic
    };

    return res.status(404).send(`
        <html>
        <head><title>404 - Plan nicht gefunden</title></head>
        <body style="font-family:monospace; padding:20px; background:#fef2f2; color:#991b1b;">
            <h1>404 - Datei nicht gefunden</h1>
            <p>Der Server konnte die Datei <strong>${filename}</strong> nicht finden.</p>
            <div style="background:white; padding:15px; border:1px solid #fca5a5; border-radius:5px;">
                <h3>Server Debug Info:</h3>
                <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
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
// WICHTIG: Statische Dateien kommen NACH der expliziten /shares/ Route, 
// damit express.static nicht versehentlich eine falsche Datei ausliefert oder 404s verschluckt.
app.use('/images', express.static(path.resolve(__dirname, '../public/images')));
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.resolve(__dirname, '../dist')));

// --- Catch-All für React App ---
app.get('*', (req, res) => {
    const distIndex = path.resolve(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndex)) {
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
