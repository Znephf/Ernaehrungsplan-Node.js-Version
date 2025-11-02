
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
    queueLimit: 0,
});

async function checkAndAlterTable(connection, tableName, columnName, alterStatement) {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (columns.length === 0) {
        console.log(`Füge Spalte '${columnName}' zu Tabelle '${tableName}' hinzu...`);
        await connection.query(alterStatement);
        console.log(`Spalte '${columnName}' erfolgreich hinzugefügt.`);
    }
}

async function initializeDatabase() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Erfolgreich mit der Datenbank verbunden.');

        // --- Migration zu normalisierter Struktur ---
        
        await connection.query(`
          CREATE TABLE IF NOT EXISTS plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            createdAt DATETIME NOT NULL,
            settings JSON,
            shoppingList JSON,
            shareId VARCHAR(255) UNIQUE,
            legacy_id INT
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS recipe_images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            image_url VARCHAR(512) NOT NULL UNIQUE
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS recipes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL UNIQUE,
            ingredients JSON,
            instructions JSON,
            totalCalories INT,
            protein FLOAT,
            carbs FLOAT,
            fat FLOAT,
            category VARCHAR(50),
            recipe_image_id INT,
            FOREIGN KEY (recipe_image_id) REFERENCES recipe_images(id) ON DELETE SET NULL
          );
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS plan_recipes (
            plan_id INT NOT NULL,
            recipe_id INT NOT NULL,
            day_of_week VARCHAR(50) NOT NULL,
            meal_type VARCHAR(50) NOT NULL,
            PRIMARY KEY (plan_id, recipe_id, day_of_week, meal_type),
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
          );
        `);
        
        await connection.query(`
          CREATE TABLE IF NOT EXISTS app_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            jobId VARCHAR(255) NOT NULL UNIQUE,
            jobType VARCHAR(100) NOT NULL,
            relatedPlanId INT,
            status VARCHAR(50) DEFAULT 'pending',
            progressText TEXT,
            resultJson JSON,
            errorMessage TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
        `);
        
        // --- Schema-Updates für bestehende Tabellen ---
        await checkAndAlterTable(connection, 'recipes', 'dietaryPreference', 'ALTER TABLE recipes ADD COLUMN dietaryPreference VARCHAR(50)');
        await checkAndAlterTable(connection, 'recipes', 'dietType', 'ALTER TABLE recipes ADD COLUMN dietType VARCHAR(50)');
        await checkAndAlterTable(connection, 'recipes', 'dishComplexity', 'ALTER TABLE recipes ADD COLUMN dishComplexity VARCHAR(50)');
        await checkAndAlterTable(connection, 'recipes', 'isGlutenFree', 'ALTER TABLE recipes ADD COLUMN isGlutenFree BOOLEAN');
        await checkAndAlterTable(connection, 'recipes', 'isLactoseFree', 'ALTER TABLE recipes ADD COLUMN isLactoseFree BOOLEAN');
        await checkAndAlterTable(connection, 'plans', 'shoppingList', 'ALTER TABLE plans ADD COLUMN shoppingList JSON');


    } catch (error) {
        console.error('Fehler bei der Initialisierung der Datenbank:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { pool, initializeDatabase };
