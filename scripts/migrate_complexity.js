
const path = require('path');
const dotenv = require('dotenv');

// Lade Umgebungsvariablen aus der .env-Datei
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Importiert dynamisch die mysql2-Bibliothek, um die Kompatibilität sicherzustellen
async function getDbConnection() {
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Eine oder mehrere Datenbank-Umgebungsvariablen fehlen!');
        process.exit(1);
    }

    return mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });
}

async function migrateComplexity() {
    console.log('--- Starte Migration für das Koch-Niveau (dishComplexity) ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Erfolgreich mit der Datenbank verbunden.');

        // 1. Lade alle Pläne, die gültige Einstellungs-Daten haben
        const [plans] = await pool.query("SELECT id, settings FROM archived_plans WHERE settings IS NOT NULL AND JSON_VALID(settings)");
        
        if (plans.length === 0) {
            console.log('Keine Pläne zur Migration gefunden. Beende Skript.');
            await pool.end();
            return;
        }

        console.log(`${plans.length} Pläne werden auf fehlendes Koch-Niveau geprüft.`);
        let totalPlansUpdated = 0;

        // 2. Gehe jeden Plan durch und prüfe, ob ein Update nötig ist
        for (const plan of plans) {
            let settings;
            try {
                settings = JSON.parse(plan.settings);
            } catch (e) {
                console.error(`Konnte die Einstellungen für Plan-ID ${plan.id} nicht verarbeiten. Überspringe.`);
                continue;
            }

            // 3. Prüfe, ob 'dishComplexity' bereits existiert.
            if (!settings.hasOwnProperty('dishComplexity')) {
                // 4. Wenn es fehlt, füge es mit dem Standardwert 'simple' hinzu
                settings.dishComplexity = 'simple';
                const updatedSettings = JSON.stringify(settings);
                
                // 5. Speichere die aktualisierten Einstellungen in der Datenbank
                await pool.query('UPDATE archived_plans SET settings = ? WHERE id = ?', [updatedSettings, plan.id]);
                console.log(`  -> Plan-ID ${plan.id} aktualisiert: dishComplexity auf 'simple' gesetzt.`);
                totalPlansUpdated++;
            }
        }

        console.log(`\n--- Migration abgeschlossen ---`);
        console.log(`Insgesamt aktualisierte Pläne: ${totalPlansUpdated}`);

    } catch (error) {
        console.error('\n--- EIN KRITISCHER FEHLER IST AUFGETRETEN ---');
        console.error(error.message);
        console.error('Migration fehlgeschlagen. Bitte prüfen Sie die Datenbank-Zugangsdaten in der .env-Datei und stellen Sie sicher, dass die Datenbank läuft.');
    } finally {
        if (pool) {
            await pool.end();
            console.log('Datenbankverbindung geschlossen.');
        }
    }
}

// Führe die Migrationsfunktion aus
migrateComplexity();
