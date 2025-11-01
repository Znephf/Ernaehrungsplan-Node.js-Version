
const express = require('express');
const unprotectedRouter = express.Router();
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


module.exports = {
    unprotected: unprotectedRouter,
    requireAuth
};
