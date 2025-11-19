
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initializeDatabase } = require('./services/database');

// Lade Umgebungsvariablen IMMER aus der .env-Datei im Projekt-Stammverzeichnis.
dotenv.config({ path: path.resolve(__dirname, '../.env') });


// --- Starup-Diagnose ---
console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
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

if (!process.env.API_KEY && !process.env.API_KEY_FALLBACK) {
    console.error(`FATAL ERROR: Es muss mindestens eine API-Schlüssel-Umgebungsvariable (API_KEY oder API_KEY_FALLBACK) gesetzt sein. Die Anwendung wird beendet.`);
    process.exit(1);
}


// Erstelle notwendige öffentliche Verzeichnisse
const appRoot = path.resolve(__dirname, '..');
const publicSharesDir = path.resolve(appRoot, 'public', 'shares');
const publicImagesDir = path.resolve(appRoot, 'public', 'images', 'recipes');

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
const recipeRoutes = require('./routes/recipes'); 
const { requireAuth } = require('./routes/auth'); 

app.use('/', authRoutes.unprotected);
app.use('/api', requireAuth, archiveRoutes);
app.use('/api', requireAuth, generationRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);
app.use('/api/recipes', requireAuth, recipeRoutes); 


// ======================================================
// --- BEREITSTELLUNG STATISCHER DATEIEN ---
// ======================================================

// MANUELLE ROUTE FÜR /shares/ MIT DEBUGGING
app.get('/shares/:filename', (req, res, next) => {
    const filename = req.params.filename;
    
    // Sicherheitscheck
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.html')) {
        return res.status(400).send('Ungültiger Dateiname.');
    }

    // Pfade auflösen
    // __dirname ist normalerweise .../server/
    // Wir wollen .../public/shares/
    const sharesPath = path.resolve(__dirname, '../public/shares');
    const filePath = path.join(sharesPath, filename);

    console.log(`[Shares Request] ${filename}`);

    // Sammle Debug-Daten (wird im Fehlerfall ausgegeben)
    const debugInfo = {
        requestedFilename: filename,
        serverDirname: __dirname,
        resolvedSharesPath: sharesPath,
        resolvedFilePath: filePath,
        processCwd: process.cwd(),
        fileExists: false,
        folderContents: [],
        stat: null
    };

    // Prüfe Existenz
    if (fs.existsSync(filePath)) {
        debugInfo.fileExists = true;
        try {
            const stat = fs.statSync(filePath);
            debugInfo.stat = {
                size: stat.size,
                mode: stat.mode,
                isFile: stat.isFile(),
                uid: stat.uid,
                gid: stat.gid
            };

            console.log(`[Shares Success] Sende Datei: ${filePath}`);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // Explizit root setzen für absolute Pfade
            return res.sendFile(filePath, { root: '/' }); 
        } catch (err) {
             console.error(`[Shares Error] Zugriff verweigert oder Fehler beim Lesen:`, err);
             return res.status(500).send(`Serverfehler beim Zugriff auf Datei: ${err.message}`);
        }
    } else {
        // DATEI NICHT GEFUNDEN - DEBUG MODUS
        console.warn(`[Shares Missing] Datei nicht gefunden: ${filePath}`);
        
        try {
            if (fs.existsSync(sharesPath)) {
                debugInfo.folderContents = fs.readdirSync(sharesPath);
            } else {
                debugInfo.folderError = "Ordner 'public/shares' existiert an diesem Pfad nicht.";
            }
        } catch (e) {
            debugInfo.folderReadError = e.message;
        }

        // Wir senden KEIN next(), damit nicht die React-App geladen wird.
        // Stattdessen senden wir eine HTML-Seite mit den Debug-Infos für den Browser.
        const debugJson = JSON.stringify(debugInfo, null, 2);
        const htmlResponse = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug: Datei nicht gefunden</title>
    <style>
        body { font-family: monospace; background-color: #fff1f2; color: #881337; padding: 2rem; }
        h1 { color: #9f1239; }
        pre { background: white; padding: 1rem; border: 1px solid #fecdd3; border-radius: 0.5rem; overflow-x: auto; }
        .info { margin-bottom: 2rem; line-height: 1.5; }
    </style>
</head>
<body>
    <h1>404 - Datei nicht gefunden (Debug Modus)</h1>
    <div class="info">
        <p>Der Server konnte die angeforderte Share-Datei nicht finden.</p>
        <p>Bitte prüfen Sie die Konsole (F12), dort wurden die Debug-Informationen ebenfalls ausgegeben.</p>
    </div>
    <h2>Server Diagnose:</h2>
    <pre>${debugJson}</pre>
    <script>
        console.warn("SERVER DEBUG INFO:", ${debugJson});
        console.log("Ordner-Inhalt:", ${JSON.stringify(debugInfo.folderContents)});
    </script>
</body>
</html>
        `;
        
        return res.status(404).send(htmlResponse);
    }
});


// 2. Bilder bereitstellen
app.use('/images', express.static(path.resolve(__dirname, '../public/images')));

// 3. Allgemeine statische Dateien
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.resolve(__dirname, '../dist')));

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
    await initializeDatabase();
    const server = app.listen(port, () => {
        console.log(`Server läuft auf Port ${port}`);
    });
    server.setTimeout(600000); 
}

startServer();
