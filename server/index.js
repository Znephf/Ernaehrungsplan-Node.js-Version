
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { initializeDatabase } = require('./services/database');

// Lade Umgebungsvariablen aus der .env-Datei.
// In der Produktion wird dies nur getan, wenn es explizit über eine Umgebungsvariable erzwungen wird.
// Dies ist eine Sicherheitsmaßnahme. Die bevorzugte Methode für die Produktion sind die Plesk-Umgebungsvariablen.
if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV_IN_PROD === 'true') {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env.NODE_ENV === 'production') {
      console.warn('\n!!! SICHERHEITSWARNUNG !!!');
      console.warn('Die .env-Datei wird in der Produktionsumgebung geladen, da FORCE_DOTENV_IN_PROD=true gesetzt ist.');
      console.warn('Dies wird nicht empfohlen. Bitte verwenden Sie stattdessen die Plesk-Umgebungsvariablen für maximale Sicherheit.\n');
    }
  }
}


// --- Starup-Diagnose ---
console.log('--- Starte Server und prüfe Umgebungsvariablen ---');
const requiredVars = ['COOKIE_SECRET', 'APP_PASSWORD', 'API_KEY', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
requiredVars.forEach(v => {
    // In der Diagnose wird der Wert nun explizit angezeigt, um Klarheit zu schaffen.
    console.log(`Wert für ${v}:`, process.env[v] ? '*** (gesetzt)' : 'NICHT GEFUNDEN');
});
console.log(`Wert für API_KEY_FALLBACK:`, process.env.API_KEY_FALLBACK ? '*** (gesetzt, Fallback-Schlüssel aktiv)' : 'Nicht gesetzt (optional)');
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
const jobRoutes = require('./routes/jobs');
const { requireAuth } = require('./routes/auth'); // Import middleware

app.use('/', authRoutes.unprotected);
app.use('/api', requireAuth, archiveRoutes);
app.use('/api', requireAuth, generationRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);


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