
const express = require('express');
const unprotectedRouter = express.Router();
const { pool } = require('../services/database');
const { getFullPlanById } = require('../services/jobService'); // Importiert für den öffentlichen Endpunkt
const { APP_PASSWORD } = process.env;

// Middleware zur Überprüfung der Authentifizierung
const requireAuth = (req, res, next) => {
  if (req.signedCookies.isAuthenticated === 'true') {
    return next();
  }
  res.status(401).json({ error: 'Nicht authentifiziert.' });
};

// --- Ungeschützte Routen ---

// Login-Endpunkt
unprotectedRouter.post('/login', (req, res) => {
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

// Logout-Endpunkt
unprotectedRouter.post('/logout', (req, res) => {
    res.clearCookie('isAuthenticated');
    res.status(200).json({ message: 'Abmeldung erfolgreich.' });
});

// Auth-Check-Endpunkt (wird von der App beim Start aufgerufen)
unprotectedRouter.get('/api/check-auth', (req, res) => {
    if (req.signedCookies.isAuthenticated === 'true') {
        res.status(200).json({ isAuthenticated: true });
    } else {
        res.status(401).json({ isAuthenticated: false });
    }
});

// Neuer öffentlicher Endpunkt zum Abrufen von Plandaten über die Share-ID
unprotectedRouter.get('/api/public/plan/:shareId', async (req, res) => {
    const { shareId } = req.params;
    try {
        const [[planMeta]] = await pool.query('SELECT id FROM plans WHERE shareId = ?', [shareId]);
        if (!planMeta) {
            return res.status(404).json({ error: 'Plan nicht gefunden.' });
        }
        
        const fullPlan = await getFullPlanById(planMeta.id);
        if (!fullPlan) {
             return res.status(404).json({ error: 'Plandaten konnten nicht geladen werden.' });
        }
        
        res.json(fullPlan);

    } catch (error) {
        console.error(`Fehler beim Abrufen des geteilten Plans ${shareId}:`, error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});


module.exports = {
    unprotected: unprotectedRouter,
    requireAuth
};
