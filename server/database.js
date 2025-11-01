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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS archived_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                name VARCHAR(255) NOT NULL,
                settings JSON NOT NULL,
                planData JSON NOT NULL,
                shareId VARCHAR(255) NULL UNIQUE
            );
        `);
        console.log('Tabelle "archived_plans" ist bereit.');

        try {
            await connection.query('SELECT shareId FROM archived_plans LIMIT 1');
        } catch (error) {
            if (error.code === 'ER_BAD_FIELD_ERROR') {
                console.log('Spalte "shareId" nicht gefunden, füge sie hinzu...');
                await connection.query('ALTER TABLE archived_plans ADD COLUMN shareId VARCHAR(255) NULL UNIQUE AFTER planData');
                console.log('Spalte "shareId" erfolgreich zu "archived_plans" hinzugefügt.');
            } else {
                throw error;
            }
        }

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
                FOREIGN KEY (planId) REFERENCES archived_plans(id) ON DELETE SET NULL
            );
        `);
        console.log('Tabelle "generation_jobs" ist bereit.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                jobId VARCHAR(36) NOT NULL UNIQUE,
                jobType VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progressText VARCHAR(255) NULL,
                relatedPlanId INT NOT NULL,
                resultJson JSON NULL,
                errorMessage TEXT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (relatedPlanId) REFERENCES archived_plans(id) ON DELETE CASCADE
            );
        `);
        console.log('Tabelle "app_jobs" ist bereit.');

        connection.release();
    } catch (error) {
        console.error('FATAL ERROR: Konnte die Datenbankverbindung nicht herstellen oder Tabelle nicht erstellen/aktualisieren!', error);
        process.exit(1);
    }
}

module.exports = { pool, initializeDatabase };