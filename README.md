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

6.  Klicken Sie auf **OK** oder **Speichern**. Plesk wird nun die `package.json` erkennen und vorschlagen, die Abhängigkeiten zu installieren. Da wir das schon manuell gemacht haben, können Sie diesen Schritt überspringen oder erneut ausführen lassen.

## Schritt 4: Umgebungsvariablen festlegen (Sicherheit)

Dies ist der wichtigste Schritt für die Sicherheit. Alle drei Variablen sind **zwingend erforderlich**.

1.  Gehen Sie zurück zur Node.js-Verwaltungsseite in Plesk.
2.  Scrollen Sie nach unten zum Abschnitt **Umgebungsvariablen**.
3.  **Variable 1: API-Schlüssel**
    -   **Name:** `API_KEY`
    -   **Wert:** Fügen Sie hier Ihren geheimen Google Gemini API-Schlüssel ein.
4.  **Variable 2: Cookie-Geheimnis**
    -   **Name:** `COOKIE_SECRET`
    -   **Wert:** Fügen Sie hier eine lange, zufällige Zeichenfolge ein (z.B. generiert mit einem Passwort-Manager). Dieses Geheimnis wird zur Verschlüsselung des Anmelde-Cookies verwendet.
5.  **Variable 3: Anwendungs-Passwort**
    -   **Name:** `APP_PASSWORD`
    -   **Wert:** Legen Sie hier das Passwort fest, das für den Login auf der Webseite verwendet werden soll.
6.  Klicken Sie auf **OK**, nachdem Sie alle drei Variablen hinzugefügt haben.

**Wichtig:** Verwenden Sie niemals eine `.env`-Datei in der Produktionsumgebung auf Plesk. Die Plesk-eigenen Umgebungsvariablen sind sicherer.

## Schritt 5: Anwendung starten

1.  Auf der Node.js-Verwaltungsseite in Plesk, klicken Sie auf **App neu starten**.
2.  Besuchen Sie Ihre Domain. Sie sollten nun von der Login-Seite begrüßt werden.

## Fehlerbehebung

-   **502/503 Fehler:** Die Node.js-Anwendung konnte nicht starten.
    -   Überprüfen Sie die Log-Dateien. Sie finden den Link zu den Logs (`stderr`) direkt auf der Node.js-Verwaltungsseite in Plesk.
    -   Ein häufiger Fehler ist eine fehlende `COOKIE_SECRET`- oder `APP_PASSWORD`-Umgebungsvariable.
    -   Stellen Sie sicher, dass alle Abhängigkeiten mit `npm install` korrekt installiert wurden.
    -   Prüfen Sie, ob die `Anwendungsstartdatei` auf `server.js` gesetzt ist.
-   **API-Fehler:** Wenn die App läuft, aber die Plangenerierung fehlschlägt, prüfen Sie:
    -   Ob die Umgebungsvariable `API_KEY` korrekt benannt und in Plesk gesetzt ist.
    -   Ob Ihr API-Schlüssel gültig ist und die Gemini API aktiviert ist.
    -   Die Server-Log-Dateien auf spezifische Fehlermeldungen der `@google/genai`-Bibliothek.