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
    timezone: '+00:00'
});

const initializeDatabase = async () => {
    console.log('Initializing database schema...');
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Recipes Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                ingredients JSON,
                instructions JSON,
                totalCalories INT,
                protein FLOAT,
                carbs FLOAT,
                fat FLOAT,
                category ENUM('breakfast', 'lunch', 'coffee', 'dinner', 'snack') NOT NULL,
                dietaryPreference ENUM('omnivore', 'vegetarian', 'vegan'),
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY (title)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table "recipes" is ready.');

        // Plans Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                settings JSON,
                shoppingList JSON,
                shareId VARCHAR(255) UNIQUE,
                legacy_id INT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table "plans" is ready.');

        // Plan_Recipes Junction Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS plan_recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plan_id INT NOT NULL,
                recipe_id INT NOT NULL,
                day_of_week VARCHAR(50) NOT NULL,
                meal_type ENUM('breakfast', 'lunch', 'coffee', 'dinner', 'snack') NOT NULL,
                FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table "plan_recipes" is ready.');
        
        // App_Jobs Table
        await connection.query(`
          CREATE TABLE IF NOT EXISTS app_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            jobId VARCHAR(255) NOT NULL UNIQUE,
            jobType VARCHAR(50) NOT NULL,
            relatedPlanId INT,
            settings JSON,
            previousPlanRecipes JSON,
            status VARCHAR(50) DEFAULT 'pending',
            progressText VARCHAR(255),
            resultJson JSON,
            errorMessage TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table "app_jobs" is ready.');

        const [rows] = await connection.query("SHOW TABLES LIKE 'legacy_archived_plans'");
        if (rows.length > 0) {
            console.log('Table "legacy_archived_plans" exists (backup from migration).');
        }

        console.log('Database schema initialization complete.');
    } catch (error) {
        console.error('DATABASE INITIALIZATION FAILED:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { pool, initializeDatabase };