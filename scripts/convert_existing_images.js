const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const dotenv = require('dotenv');
const sharp = require('sharp');

// Lade Umgebungsvariablen aus der .env-Datei im Projekt-Stammverzeichnis
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

const publicDir = path.join(__dirname, '..', 'public');

async function convertExistingImages() {
    console.log('--- Starte Skript zur Konvertierung existierender Bilder zu WebP ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Erfolgreich mit der Datenbank verbunden.');

        // 1. Finde alle Bilder, die noch keine Thumbnails haben (ein Indikator, dass sie nicht verarbeitet wurden)
        //    und noch im alten .jpg/.png Format sind.
        const [imagesToProcess] = await pool.query(`
            SELECT id, recipe_title, image_url 
            FROM recipe_images 
            WHERE (thumbnail_url IS NULL OR thumbnail_url = '') 
            AND (image_url LIKE '%.jpg' OR image_url LIKE '%.png')
        `);

        if (imagesToProcess.length === 0) {
            console.log('Keine Bilder im alten Format gefunden, die konvertiert werden müssen. Alles auf dem neuesten Stand!');
            await pool.end();
            return;
        }

        console.log(`Gefunden: ${imagesToProcess.length} Bilder zur Konvertierung.`);
        let totalConverted = 0;
        let totalErrors = 0;

        // 2. Gehe jedes Bild durch
        for (const imageRecord of imagesToProcess) {
            const originalUrl = imageRecord.image_url;
            const originalPath = path.join(publicDir, originalUrl);

            try {
                // Prüfe, ob die Originaldatei existiert
                await fs.access(originalPath);

                const imageBuffer = await fs.readFile(originalPath);
                const newBaseName = crypto.randomBytes(16).toString('hex');

                const fullImagePath = path.join(publicDir, 'images', 'recipes', `${newBaseName}.webp`);
                const thumbImagePath = path.join(publicDir, 'images', 'recipes', `${newBaseName}-thumb.webp`);
                
                const fullImageUrl = `/images/recipes/${newBaseName}.webp`;
                const thumbImageUrl = `/images/recipes/${newBaseName}-thumb.webp`;

                // 3. Erstelle optimiertes Hauptbild und Thumbnail mit Sharp
                await sharp(imageBuffer)
                    .resize({ width: 1024, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(fullImagePath);
                    
                await sharp(imageBuffer)
                    .resize({ width: 400, withoutEnlargement: true })
                    .webp({ quality: 75 })
                    .toFile(thumbImagePath);

                // 4. Aktualisiere den Datenbankeintrag
                await pool.query(
                    'UPDATE recipe_images SET image_url = ?, thumbnail_url = ? WHERE id = ?',
                    [fullImageUrl, thumbImageUrl, imageRecord.id]
                );
                
                // 5. Lösche die alte Bilddatei
                await fs.unlink(originalPath);
                
                console.log(`  -> Erfolgreich: "${imageRecord.recipe_title}" konvertiert. Altes Bild gelöscht.`);
                totalConverted++;

            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.warn(`  - WARNUNG: Bilddatei für "${imageRecord.recipe_title}" unter ${originalPath} nicht gefunden. Überspringe.`);
                } else {
                    console.error(`  - FEHLER bei der Verarbeitung von "${imageRecord.recipe_title}":`, error.message);
                }
                totalErrors++;
            }
        }

        console.log('\n--- Skript abgeschlossen ---');
        console.log(`Erfolgreich konvertiert: ${totalConverted}`);
        console.log(`Fehler aufgetreten: ${totalErrors}`);

    } catch (error) {
        console.error('\n--- EIN KRITISCHER FEHLER IST AUFGETRETEN ---');
        console.error(error.message);
        console.error('Migration fehlgeschlagen. Bitte prüfen Sie die Datenbank-Zugangsdaten in der .env-Datei.');
    } finally {
        if (pool) {
            await pool.end();
            console.log('Datenbankverbindung geschlossen.');
        }
    }
}

convertExistingImages();