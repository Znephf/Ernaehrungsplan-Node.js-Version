
# KI Ernährungsplaner - Deployment auf Plesk VPS

Diese Anleitung beschreibt, wie Sie die KI-Ernährungsplaner-Anwendung auf einem Virtual Private Server (VPS) mit Plesk als Verwaltungsoberfläche bereitstellen.

## Architektur-Übersicht

Die Anwendung besteht aus zwei Hauptteilen:

1.  **Frontend:** Eine in React und TypeScript geschriebene Single-Page-Application (SPA), die mit Vite gebaut wird.
2.  **Backend:** Ein modularisierter Node.js-Server mit Express, der als sicherer Proxy für die Google Gemini API dient und die Archiv-Daten in einer MariaDB-Datenbank verwaltet. Das Backend ist in Routen und Services aufgeteilt, um die Wartbarkeit zu verbessern.

Dieses Setup stellt sicher, dass Ihr API-Schlüssel niemals im Browser offengelegt wird. Ein serverseitiger Passwortschutz sichert die gesamte Anwendung ab.

### Verwendete KI-Modelle

-   **Textgenerierung (Pläne, Rezepte, Einkaufslisten):** `gemini-2.5-flash`
-   **Bildgenerierung (Rezeptbilder):** `gemini-2.5-flash-image`

Die Anwendung verwendet die aktuell empfohlenen Modelle, um eine langfristige Kompatibilität zu gewährleisten.

## Voraussetzungen

Stellen Sie sicher, dass auf Ihrem Server die folgenden Komponenten installiert sind:

-   **MariaDB oder MySQL-Server**
-   **Node.js:** Version 18.x oder höher.
-   **NPM (Node Package Manager):** Wird normalerweise mit Node.js installiert.
-   **Git:** Zum Klonen des Quellcodes.
-   Ein in Plesk eingerichteter Domain- oder Subdomain-Name.
-   Ein gültiger **Google Gemini API Key**.

## Schritt 1: Datenbank einrichten

1.  Loggen Sie sich in Ihre Datenbankverwaltung ein (z.B. phpMyAdmin in Plesk oder über die Kommandozeile).
2.  Erstellen Sie eine neue Datenbank. Es wird empfohlen, den Namen `ernaehrungsplan` zu verwenden, da dieser in den Umgebungsvariablen standardmäßig vorgeschlagen wird.
3.  Erstellen Sie einen neuen Datenbankbenutzer.
4.  Geben Sie diesem Benutzer alle Berechtigungen (`ALL PRIVILEGES`) für die neu erstellte Datenbank.
5.  Notieren Sie sich den Datenbanknamen, den Benutzernamen und das Passwort.

Der Node.js-Server wird die benötigten Tabellen (`archived_plans`, `generation_jobs`) beim ersten Start automatisch erstellen.

## Schritt 2: Code auf den Server laden

1.  Verbinden Sie sich per SSH mit Ihrem Server.
2.  Navigieren Sie zum Hauptverzeichnis für Ihre Web-Anwendungen, üblicherweise `/var/www/vhosts/ihredomain.de/`.
3.  Erstellen Sie ein Verzeichnis für die App und klonen Sie den Code hinein:
    ```bash
    mkdir ernaehrungsplaner
    cd ernaehrungsplaner
    git clone [URL_IHRES_GIT_REPOSITORIES] . 
    # Wenn Sie den Code manuell hochladen, entpacken Sie ihn in diesem Verzeichnis.
    ```

## Schritt 3: Abhängigkeiten installieren und die App bauen

1.  Installieren Sie alle notwendigen Node.js-Pakete für das Backend und Frontend:
    ```bash
    npm install
    ```
2.  Erstellen Sie die optimierte Frontend-Version. Dieser Befehl kompiliert den React-Code und legt die statischen Dateien im `dist`-Verzeichnis ab.
    ```bash
    npm run build
    ```

## Schritt 4: Plesk für die Node.js-Anwendung konfigurieren

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
    -   **Anwendungsstartdatei:** `server/index.js` (WICHTIG: Der Pfad hat sich geändert!)

6.  Klicken Sie auf **OK** oder **Speichern**. 

## Schritt 5: Umgebungsvariablen in Plesk konfigurieren (WICHTIG)

Ihre geheimen Schlüssel und Datenbank-Zugangsdaten müssen sicher als Umgebungsvariablen gespeichert werden.

1.  Gehen Sie in Plesk zur **Node.js**-Verwaltungsseite Ihrer App.
2.  Klicken Sie auf **Umgebungsvariablen**.
3.  Fügen Sie die folgenden Variablen hinzu:
    -   `API_KEY` = `Ihr_Google_Gemini_API_Schlüssel`
    -   `COOKIE_SECRET` = `Eine_sehr_lange_und_komplexe_zufällige_Zeichenfolge`
    -   `APP_PASSWORD` = `Ein_sicheres_Passwort_für_den_Login`
    -   `DB_HOST` = `localhost` (oder die IP Ihres DB-Servers)
    -   `DB_USER` = `Ihr_Datenbank_Benutzername`
    -   `DB_PASSWORD` = `Ihr_Datenbank_Passwort`
    -   `DB_NAME` = `Der_Name_Ihrer_Datenbank`
    -   `DB_PORT` = `3306` (Optional: Nur ändern, wenn Ihr DB-Server nicht den Standard-Port verwendet)
4.  **WICHTIG:** Ersetzen Sie die Platzhalter durch Ihre echten, sicheren Werte.
5.  Speichern Sie die Variablen.

**Hinweis: Wenn die erforderlichen Variablen fehlen oder falsch sind, wird der Server absichtlich nicht starten! Dies ist die häufigste Ursache für Fehler nach dem Deployment.**

## Schritt 6: Anwendung starten

1.  Auf der Node.js-Verwaltungsseite in Plesk, klicken Sie auf **App neu starten**. Dies ist nach jeder Änderung der Umgebungsvariablen zwingend erforderlich.
2.  Besuchen Sie Ihre Domain. Sie sollten nun von der Login-Seite begrüßt werden.

## Lokale Entwicklung (Optional)

Um die Anwendung lokal auszuführen, erstellen Sie eine Datei namens `.env` im Hauptverzeichnis. Fügen Sie Ihre Geheimnisse und lokalen DB-Infos in diese Datei ein:
```
API_KEY=Ihr_lokaler_API_Schlüssel
COOKIE_SECRET=Ein_lokaler_zufälliger_String
APP_PASSWORD=Ein_lokales_Passwort

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Ihr_lokales_DB_Passwort
DB_NAME=ernaehrungsplan
DB_PORT=3306
```
Die `server/index.js`-Datei ist so konfiguriert, dass sie diese Datei automatisch liest. Stellen Sie sicher, dass die `.env`-Datei in Ihrer `.gitignore`-Datei aufgeführt ist.

## Fehlerbehebung

-   **502/503 Fehler oder keine Passwort-Abfrage:** Die Node.js-Anwendung konnte nicht starten.
    -   **Prüfen Sie als Erstes die Umgebungsvariablen!** Sind alle sieben erforderlichen Variablen vorhanden und korrekt?
    -   **Überprüfen Sie die Log-Dateien (`stderr`)** auf der Node.js-Verwaltungsseite in Plesk. Der Server gibt dort klare Fehlermeldungen aus, wenn Variablen fehlen oder die Datenbankverbindung fehlschlägt.
    -   **Haben Sie die App nach Änderungen neu gestartet?**
    -   **Ist der Pfad zur Startdatei korrekt?** Er muss jetzt `server/index.js` lauten.

-   **Fehler "413 Content Too Large" beim Teilen:**
    -   **Problem:** Die generierten Bilder sind zu groß für die Standard-Upload-Limits des Webservers (Nginx/Apache), der vor der Node.js-Anwendung läuft.
    -   **Lösung:** Sie müssen das Limit in Plesk manuell erhöhen.
        1.  Gehen Sie in Plesk zu **Websites & Domains** > **Ihre Domain** > **Einstellungen für Apache & nginx**.
        2.  Scrollen Sie nach unten zum Feld **Zusätzliche nginx-Anweisungen**.
        3.  Fügen Sie die folgende Zeile hinzu, um das Limit auf 50 Megabyte zu erhöhen:
            ```nginx
            client_max_body_size 50m;
            ```
        4.  Klicken Sie auf **OK** oder **Anwenden**. Dies behebt das Problem in den meisten Fällen.

-   **API-Fehler bei Plangenerierung:**
    -   Ist der `API_KEY` korrekt?
    -   Ist die Gemini API für Ihren Schlüssel aktiviert?
-   **Fehler bei der Bildgenerierung (Quota Exceeded):**
    -   **Lösung:** Verknüpfen Sie Ihr Projekt mit einem Google Cloud-Projekt, für das die Abrechnung (Billing) aktiviert ist.
