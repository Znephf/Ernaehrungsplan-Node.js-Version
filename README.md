# KI Ernährungsplaner

Dies ist eine Webanwendung zur Erstellung, Verwaltung und zum Teilen von wöchentlichen Ernährungsplänen mithilfe von KI.

## Features

- **Individuelle Plangenerierung:** Erstellen Sie Pläne basierend auf Kalorien, Ernährungsweise, Diät-Typ und mehr.
- **Wochenplaner:** Stellen Sie per Drag-and-Drop oder Klick Ihre eigene Woche aus bestehenden Rezepten zusammen.
- **Archiv:** Speichern und verwalten Sie alle Ihre generierten und erstellten Pläne.
- **Rezept-Bibliothek:** Durchsuchen Sie alle Rezepte, die jemals in Ihren Plänen generiert wurden.
- **KI-Bildgenerierung:** Erstellen Sie ansprechende Bilder für Ihre Rezepte.
- **Teilen:** Teilen Sie Ihre Pläne als eigenständige, interaktive HTML-Datei mit anderen.
- **Einkaufsliste:** Automatisch generierte und kategorisierte Einkaufsliste für Ihren Wochenplan.

## Setup

### 1. Voraussetzungen

- Node.js (v18 oder neuer empfohlen)
- Eine MySQL-kompatible Datenbank

### 2. Installation

1.  Klonen Sie das Repository:
    ```bash
    git clone <repository-url>
    cd ki-ernaehrungsplaner
    ```

2.  Installieren Sie die Abhängigkeiten:
    ```bash
    npm install
    ```

### 3. Konfiguration

1.  Erstellen Sie eine `.env`-Datei im Stammverzeichnis des Projekts, indem Sie die `.env.example`-Datei (falls vorhanden) kopieren.

2.  Füllen Sie die `.env`-Datei mit den erforderlichen Werten:
    ```
    # Server & Auth
    PORT=3001
    APP_PASSWORD=IhrGeheimesPasswort
    COOKIE_SECRET=EinSehrLangerGeheimerStringFürCookies

    # Google Gemini API Key
    # Sie können entweder API_KEY oder API_KEY_FALLBACK verwenden
    API_KEY=IhrGoogleApiKey

    # Datenbankverbindung
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=IhrDbBenutzer
    DB_PASSWORD=IhrDbPasswort
    DB_NAME=IhreDb
    ```

## Verwendung

### Entwicklung

Um den Frontend-Vite-Server und den Backend-Node.js-Server gleichzeitig zu starten:

1.  Starten Sie den Backend-Server in einem Terminal:
    ```bash
    npm start
    ```
    Der Server läuft auf `http://localhost:3001`.

2.  Starten Sie den Frontend-Entwicklungsserver in einem anderen Terminal:
    ```bash
    npm run dev
    ```
    Die Anwendung ist unter `http://localhost:5173` (oder einem anderen von Vite zugewiesenen Port) verfügbar. Der Vite-Server leitet API-Anfragen an das Backend weiter.

### Produktion

1.  Bauen Sie die React-Anwendung:
    ```bash
    npm run build
    ```

2.  Starten Sie den Node.js-Server, der die gebauten statischen Dateien bereitstellt:
    ```bash
    npm start
    ```

## Datenbank-Migrationen

Die Anwendung enthält Skripte zur Migration von Daten aus älteren Versionen. Diese befinden sich im `scripts/`-Verzeichnis.

**Wichtig:** Führen Sie diese Skripte nur aus, wenn Sie von einer älteren Version der App aktualisieren. Erstellen Sie vorher immer ein Backup Ihrer Datenbank.

-   `npm run migrate:fix-legacy`: Sucht in alten, archivierten Plänen nach Rezepten, die möglicherweise bei früheren Migrationen übersehen wurden, und fügt sie zur neuen Rezept-Datenbank hinzu. **Dieses Skript sollte nach Updates erneut ausgeführt werden**, um sicherzustellen, dass alle Daten (z.B. die Ernährungsweise) für bestehende Rezepte korrekt nachgetragen werden. Es kann sicher mehrfach ausgeführt werden.