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

async function migrateRecipeImages() {
    console.log('--- Starte Migration für zentralisierte Rezept-Bilder ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Erfolgreich mit der Datenbank verbunden.');

        // 1. Lade alle Pläne, die Bild-Daten im alten Format enthalten könnten
        const [plans] = await pool.query("SELECT id, planData FROM archived_plans WHERE planData IS NOT NULL AND JSON_VALID(planData) AND JSON_UNQUOTE(JSON_EXTRACT(planData, '$.imageUrls')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(planData, '$.imageUrls')) != '{}'");
        
        if (plans.length === 0) {
            console.log('Keine Pläne mit Bild-URLs im alten Format gefunden. Beende Skript.');
            await pool.end();
            return;
        }

        console.log(`${plans.length} Pläne mit potenziellen Bildern zur Migration gefunden.`);
        let totalImagesMigrated = 0;

        // 2. Gehe jeden Plan durch
        for (const plan of plans) {
            let planData;
            try {
                planData = JSON.parse(plan.planData);
            } catch (e) {
                console.error(`Konnte die planData für Plan-ID ${plan.id} nicht verarbeiten. Überspringe.`);
                continue;
            }

            if (!planData.imageUrls || typeof planData.imageUrls !== 'object' || !Array.isArray(planData.recipes)) {
                continue;
            }

            // 3. Verarbeite jedes Bild im Plan
            for (const day in planData.imageUrls) {
                const imageUrl = planData.imageUrls[day];
                const recipeForDay = planData.recipes.find(r => r.day === day);

                if (recipeForDay && recipeForDay.title && typeof imageUrl === 'string' && imageUrl.startsWith('/')) {
                    try {
                        // 4. Füge den Eintrag in die neue Tabelle ein. Bei Duplikaten wird der Eintrag ignoriert.
                        const [result] = await pool.query(
                            'INSERT INTO recipe_images (recipe_title, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)',
                            [recipeForDay.title, imageUrl]
                        );

                        if (result.affectedRows > 0) {
                             console.log(`  -> Bild für "${recipeForDay.title}" migriert. URL: ${imageUrl}`);
                             totalImagesMigrated++;
                        }
                       
                    } catch (err) {
                        console.error(`  - Fehler beim Migrieren des Bildes für "${recipeForDay.title}":`, err.message);
                    }
                }
            }
        }

        console.log(`\n--- Migration abgeschlossen ---`);
        console.log(`Insgesamt migrierte Bilder: ${totalImagesMigrated}`);

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
migrateRecipeImages();
