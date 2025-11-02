
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getDbConnection() {
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Missing database environment variables!');
        process.exit(1);
    }

    return mysql.createPool({
        host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, port: DB_PORT || 3306,
        waitForConnections: true, connectionLimit: 10, queueLimit: 0
    });
}

async function migrateImagesToForeignKey() {
    console.log('--- Starting Image URL to Foreign Key Migration ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');
        const connection = await pool.getConnection();

        // 1. Check if the old image_url column exists. If not, migration is likely done.
        const [recipeColumns] = await connection.query("SHOW COLUMNS FROM `recipes` LIKE 'image_url'");
        if (recipeColumns.length === 0) {
            console.log('Column `image_url` not found in `recipes` table. Migration seems to be complete. Exiting.');
            connection.release();
            await pool.end();
            return;
        }
        
        console.log('Found `image_url` column. Proceeding with migration...');
        
        // 2. Get all recipes that have an image URL
        const [recipesToMigrate] = await connection.query(
            "SELECT id, image_url FROM recipes WHERE image_url IS NOT NULL AND image_url != ''"
        );

        if (recipesToMigrate.length === 0) {
            console.log('No recipes with image URLs found to migrate.');
        } else {
            console.log(`Found ${recipesToMigrate.length} recipes with images to migrate.`);
            let migratedCount = 0;

            for (const recipe of recipesToMigrate) {
                try {
                    // 3. Insert the image URL into the new table. If it exists, get its ID.
                    const [insertResult] = await connection.query(
                        'INSERT INTO recipe_images (image_url) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
                        [recipe.image_url]
                    );
                    
                    let imageId = insertResult.insertId;
                    if (imageId === 0) {
                        // The row already existed, so we need to fetch its ID
                        const [[existingImage]] = await connection.query('SELECT id FROM recipe_images WHERE image_url = ?', [recipe.image_url]);
                        imageId = existingImage.id;
                    }


                    // 4. Update the recipe with the foreign key
                    await connection.query(
                        'UPDATE recipes SET recipe_image_id = ? WHERE id = ?',
                        [imageId, recipe.id]
                    );
                    
                    console.log(`  -> Migrated image for recipe ID ${recipe.id} to image ID ${imageId}.`);
                    migratedCount++;
                } catch (error) {
                    console.error(`  - FAILED to migrate image for recipe ID ${recipe.id}. Error: ${error.message}`);
                }
            }
             console.log(`Successfully migrated ${migratedCount} image links.`);
        }
        
        // 5. After successful migration, drop the old column
        console.log('Dropping the old `image_url` column from `recipes` table...');
        await connection.query("ALTER TABLE recipes DROP COLUMN image_url");
        console.log('`image_url` column dropped successfully.');
        
        connection.release();
        console.log('\n--- Migration Complete ---');

    } catch (error) {
        console.error('\n--- A CRITICAL ERROR OCCURRED ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

migrateImagesToForeignKey();
