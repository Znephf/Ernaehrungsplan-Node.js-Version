# KI Ernährungsplaner - Deployment auf Plesk VPS

Diese Anleitung beschreibt, wie Sie die KI-Ernährungsplaner-Anwendung auf einem Virtual Private Server (VPS) mit Plesk als Verwaltungsoberfläche bereitstellen.

## Architektur-Übersicht

Die Anwendung besteht aus zwei Hauptteilen:

1.  **Frontend:** Eine in React und TypeScript geschriebene Single-Page-Application (SPA), die mit Vite gebaut wird.
2.  **Backend:** Ein einfacher Node.js-Server mit Express, der als sicherer Proxy für die Google Gemini API dient. Er nimmt Anfragen vom Frontend entgegen, fügt den geheimen API-Schlüssel hinzu und leitet sie an die Google-API weiter.

Dieses Setup stellt sicher, dass Ihr API-Schlüssel niemals im Browser des Benutzers offengelegt wird. Ein serverseitiger Passwortschutz sichert die gesamte Anwendung ab.

## Voraussetzungen

Stellen Sie sicher, dass auf Ihrem Server die folgenden Komponenten installiert sind:

-   **Node.js:** Version 18.x oder höher.
-   **NPM (Node Package Manager):** Wird normalerweise mit Node.js installiert.
-   **Git:** Zum Klonen des Quellcodes.
-   Ein in Plesk eingerichteter Domain- oder Subdomain-Name.
-   Ein gültiger **Google Gemini API Key**.

## Schritt 1: Code auf den Server laden

1.  Verbinden Sie sich per SSH mit Ihrem Server.
2.  Navigieren Sie zum Hauptverzeichnis für Ihre Web-Anwendungen, üblicherweise `/var/www/vhosts/ihredomain.de/`.
3.  Erstellen Sie ein Verzeichnis für die App und klonen Sie den Code hinein:
    ```bash
    mkdir ernaehrungsplaner
    cd ernaehrungsplaner
    git clone [URL_IHRES_GIT_REPOSITORIES] . 
    # Wenn Sie den Code manuell hochladen, entpacken Sie ihn in diesem Verzeichnis.
    ```

## Schritt 2: Abhängigkeiten installieren und die App bauen

1.  Installieren Sie alle notwendigen Node.js-Pakete für das Backend und Frontend:
    ```bash
    npm install
    ```
2.  Erstellen Sie die optimierte Frontend-Version. Dieser Befehl kompiliert den React-Code und legt die statischen Dateien im `dist`-Verzeichnis ab.
    ```bash
    npm run build
    ```

## Schritt 3: Plesk für die Node.js-Anwendung konfigurieren

1.  Loggen Sie sich in Ihr Plesk-Panel ein.
2.  Gehen Sie zu **Websites & Domains** und wählen Sie die Domain aus, auf der die App laufen soll.
3.  Klicken Sie auf **Node.js**.
4.  Klicken Sie auf **Node.js aktivieren**.
5.  Konfigurieren Sie die Anwendung wie folgt:
    -   **Node.js Version:** Wählen Sie eine installierte Version (z.B. 18.x oder höher).
    -   **Paket-Manager:** `npm`
    -   **Dokumentenstamm:** `/httpdocs` (Plesk leitet Anfragen korrekt an den Node-Server weiter).
    -   **Anwendungsmodus:** `production`
    -   **Anwendungs-URL:** Wird automatisch angezeigt.
    -   **Anwendungsstamm:** `/var/www/vhosts/ihredomain.de/ernaehrungsplaner` (passen Sie den Pfad an).
    -   **Anwendungsstartdatei:** `server.js`

6.  Klicken Sie auf **OK** oder **Speichern**. 

## Schritt 4: Konfigurationsdatei `.env` erstellen (Sicherheit)

Da die Bereitstellung von Umgebungsvariablen über das Plesk-Panel unzuverlässig sein kann, verwenden wir eine `.env`-Datei direkt auf dem Server. Dies ist eine sichere und gängige Methode.

1.  **Erstellen Sie die Datei:** Verbinden Sie sich per SSH mit Ihrem Server, navigieren Sie in Ihr Anwendungsverzeichnis (`/var/www/vhosts/ihredomain.de/ernaehrungsplaner`) und erstellen Sie die Datei:
    ```bash
    touch .env
    ```
2.  **Fügen Sie Ihre Geheimnisse hinzu:** Öffnen Sie die Datei mit einem Editor (z.B. `nano .env`) und fügen Sie Ihre drei Geheimnisse in diesem Format ein:
    ```
    API_KEY=Ihr_Google_Gemini_API_Schlüssel
    COOKIE_SECRET=Eine_sehr_lange_und_komplexe_zufällige_Zeichenfolge
    APP_PASSWORD=Ein_sicheres_Passwort_für_den_Login
    ```
    Ersetzen Sie die Platzhalter durch Ihre echten Werte. Speichern und schließen Sie die Datei.

3.  **SICHERN SIE DIE DATEI (WICHTIGSTER SCHRITT):** Ändern Sie die Dateiberechtigungen, damit nur Ihr Benutzer die Datei lesen und schreiben kann. Dies verhindert, dass andere Benutzer auf dem Server Ihre Geheimnisse einsehen können.
    ```bash
    chmod 600 .env
    ```
4.  **Zu `.gitignore` hinzufügen:** Stellen Sie sicher, dass die Datei `.gitignore` in Ihrem Projekt eine Zeile mit `.env` enthält. Dadurch wird verhindert, dass Ihre Geheimnisse jemals versehentlich in Ihr Git-Repository hochgeladen werden.

**WICHTIG: Wenn die `.env`-Datei fehlt oder die Variablen darin falsch sind, wird der Server absichtlich nicht starten! Dies ist die häufigste Ursache für Fehler nach dem Deployment.**

## Schritt 5: Anwendung starten

1.  Auf der Node.js-Verwaltungsseite in Plesk, klicken Sie auf **App neu starten**.
2.  Besuchen Sie Ihre Domain. Sie sollten nun von der Login-Seite begrüßt werden.

## Fehlerbehebung

-   **502/503 Fehler oder keine Passwort-Abfrage:** Die Node.js-Anwendung konnte nicht starten oder stürzt ab.
    -   **Prüfen Sie als Erstes die `.env`-Datei!** Ist sie vorhanden, korrekt formatiert und sind alle drei Variablen gesetzt?
    -   Überprüfen Sie die Log-Dateien. Sie finden den Link zu den Logs (`stderr`) direkt auf der Node.js-Verwaltungsseite in Plesk. Der Server gibt dort eine klare Fehlermeldung aus, wenn Variablen fehlen.
    -   Stellen Sie sicher, dass alle Abhängigkeiten mit `npm install` korrekt installiert wurden.
    -   Prüfen Sie, ob die `Anwendungsstartdatei` auf `server.js` gesetzt ist.
-   **API-Fehler:** Wenn die App läuft, aber die Plangenerierung fehlschlägt, prüfen Sie:
    -   Ob die Variable `API_KEY` in Ihrer `.env`-Datei korrekt ist.
    -   Ob Ihr API-Schlüssel gültig ist und die Gemini API aktiviert ist.
    -   Die Server-Log-Dateien auf spezifische Fehlermeldungen der `@google/genai`-Bibliothek.