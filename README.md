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

## Schritt 4: Umgebungsvariablen in Plesk konfigurieren (WICHTIG)

Ihre geheimen Schlüssel müssen sicher als Umgebungsvariablen gespeichert werden. Dies ist der sicherste Weg, da sie nicht im Code gespeichert werden.

1.  Gehen Sie in Plesk zur **Node.js**-Verwaltungsseite Ihrer App.
2.  Klicken Sie auf **Umgebungsvariablen**.
3.  Fügen Sie die folgenden drei Variablen hinzu:
    -   `API_KEY` = `Ihr_Google_Gemini_API_Schlüssel`
    -   `COOKIE_SECRET` = `Eine_sehr_lange_und_komplexe_zufällige_Zeichenfolge`
    -   `APP_PASSWORD` = `Ein_sicheres_Passwort_für_den_Login`
4.  **WICHTIG:** Ersetzen Sie die Platzhalter durch Ihre echten, sicheren Werte. Der `COOKIE_SECRET` kann eine beliebige lange, zufällige Zeichenkette sein (z. B. von einem Passwort-Generator).
5.  Speichern Sie die Variablen.

**Hinweis: Wenn diese Variablen fehlen oder falsch sind, wird der Server absichtlich nicht starten! Dies ist die häufigste Ursache für Fehler nach dem Deployment.**

## Schritt 5: Anwendung starten

1.  Auf der Node.js-Verwaltungsseite in Plesk, klicken Sie auf **App neu starten**. Dies ist nach jeder Änderung der Umgebungsvariablen zwingend erforderlich.
2.  Besuchen Sie Ihre Domain. Sie sollten nun von der Login-Seite begrüßt werden.

## Lokale Entwicklung (Optional)

Um die Anwendung auf Ihrem lokalen Computer auszuführen (außerhalb von Plesk), erstellen Sie eine Datei namens `.env` im Hauptverzeichnis des Projekts. Fügen Sie Ihre Geheimnisse in diese Datei ein:
```
API_KEY=Ihr_lokaler_API_Schlüssel
COOKIE_SECRET=Ein_lokaler_zufälliger_String
APP_PASSWORD=Ein_lokales_Passwort
```
Die `server.js`-Datei ist so konfiguriert, dass sie diese Datei automatisch liest, wenn sie nicht im `production`-Modus läuft. Stellen Sie sicher, dass die `.env`-Datei in Ihrer `.gitignore`-Datei aufgeführt ist, um zu verhindern, dass sie in Ihr Repository hochgeladen wird.

## Fehlerbehebung

-   **502/503 Fehler oder keine Passwort-Abfrage:** Die Node.js-Anwendung konnte nicht starten oder stürzt ab.
    -   **Prüfen Sie als Erstes die Umgebungsvariablen im Plesk-Panel!** Sind alle drei (`API_KEY`, `COOKIE_SECRET`, `APP_PASSWORD`) vorhanden und korrekt geschrieben?
    -   **Haben Sie die App neu gestartet?** Klicken Sie nach jeder Änderung der Variablen im Plesk-Panel auf **"App neu starten"**.
    -   **Überprüfen Sie die Log-Dateien.** Sie finden den Link zu den Logs (`stderr`) direkt auf der Node.js-Verwaltungsseite in Plesk. Der Server gibt dort eine klare Fehlermeldung aus, wenn Variablen fehlen.
    -   Stellen Sie sicher, dass alle Abhängigkeiten mit `npm install` korrekt installiert wurden und der `npm run build` Befehl erfolgreich war.
    -   Prüfen Sie, ob die `Anwendungsstartdatei` auf `server.js` gesetzt ist.
-   **API-Fehler:** Wenn die App läuft, aber die Plangenerierung fehlschlägt, prüfen Sie:
    -   Ob die Variable `API_KEY` in Plesk korrekt ist.
    -   Ob Ihr API-Schlüssel gültig ist und die Gemini API aktiviert ist.
    -   Die Server-Log-Dateien auf spezifische Fehlermeldungen der `@google/genai`-Bibliothek.