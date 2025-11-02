const mysql = require('mysql2/promise');
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('Erfolgreich mit der MariaDB-Datenbank verbunden.');

        // Tabelle für Pläne (Metadaten)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                settings JSON NOT NULL,
                shareId VARCHAR(255) NULL UNIQUE,
                legacy_id INT NULL
            );
        `);
        console.log('Tabelle "plans" ist bereit.');

        // Tabelle für Rezepte (einzigartig)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL UNIQUE,
                ingredients JSON NOT NULL,
                instructions JSON NOT NULL,
                totalCalories INT NOT NULL DEFAULT 0,
                protein FLOAT NULL,
                carbs FLOAT NULL,
                fat FLOAT NULL,
                category ENUM('breakfast', 'lunch', 'coffee', 'dinner', 'snack') NOT NULL,
                image_url VARCHAR(1024) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabelle "recipes" ist bereit.');

        // Verknüpfungstabelle (Junction Table)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS plan_recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plan_id INT NOT NULL,
                recipe_id INT NOT NULL,
                day_of_week VARCHAR(20) NOT NULL,
                meal_type ENUM('breakfast', 'lunch', 'coffee', 'dinner', 'snack') NOT NULL,
                FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            );
        `);
        console.log('Tabelle "plan_recipes" ist bereit.');


        await connection.query(`
            CREATE TABLE IF NOT EXISTS generation_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                jobId VARCHAR(36) NOT NULL UNIQUE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                payload JSON,
                planId INT NULL,
                errorMessage TEXT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE SET NULL
            );
        `);
        console.log('Tabelle "generation_jobs" ist bereit.');
        
        // Alte `recipe_images` Tabelle wird nicht mehr erstellt/benötigt.

        connection.release();
    } catch (error) {
        console.error('FATAL ERROR: Konnte die Datenbankverbindung nicht herstellen oder Tabellen nicht erstellen/aktualisieren.', error);
        process.exit(1);
    }
}

module.exports = { pool, initializeDatabase };
