
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initializeDatabase } = require('./services/database');

// Lade Umgebungsvariablen aus der .env-Datei, ABER nur wenn wir NICHT in Produktion sind.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Die Umgebungsvariable(n) ${missingVars.join(', ')} sind nicht gesetzt. Bitte fügen Sie diese in der Plesk Node.js-Verwaltung hinzu. Die Anwendung wird beendet.`);
    process.exit(1);
}

// Erstelle notwendige öffentliche Verzeichnisse
const publicSharesDir = path.join(__dirname, '..', 'public', 'shares');
const publicImagesDir = path.join(__dirname, '..', 'public', 'images', 'recipes');
[publicSharesDir, publicImagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Verzeichnis erstellt unter: ${dir}`);
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
const shareRoutes = require('./routes/share');
const { requireAuth } = require('./routes/auth'); // Import middleware

app.use('/', authRoutes.unprotected);
app.use('/api', requireAuth, archiveRoutes);
app.use('/api', requireAuth, generationRoutes);
app.use('/api', requireAuth, shareRoutes);


// ======================================================
// --- BEREITSTELLUNG DER REACT-APP ---
// ======================================================
// Statische Dateien für die geteilten Pläne und Bilder bereitstellen
app.use(express.static(path.join(__dirname, '..', 'public')));
// Statische Dateien für die gebaute React-App bereitstellen
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Alle übrigen Anfragen an die React-App weiterleiten
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
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
