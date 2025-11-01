
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamically import mysql2/promise
async function getDbConnection() {
    const mysql = await import('mysql2/promise');
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error('DATABASE_ERROR: Missing one or more database environment variables.');
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

const imagesDir = path.join(__dirname, '..', 'public', 'images', 'recipes');

async function migrateImages() {
    console.log('--- Starting Image Migration ---');

    // 1. Ensure directory exists
    if (!fs.existsSync(imagesDir)) {
        console.log(`Creating image directory at: ${imagesDir}`);
        fs.mkdirSync(imagesDir, { recursive: true });
    } else {
        console.log(`Image directory already exists: ${imagesDir}`);
    }

    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // 2. Fetch all plans
        const [plans] = await pool.query("SELECT id, planData FROM archived_plans WHERE planData IS NOT NULL AND JSON_VALID(planData) AND planData LIKE '%data:image/%'");
        
        if (plans.length === 0) {
            console.log('No plans with base64 images found to migrate. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${plans.length} plans with potential base64 images to process.`);
        let totalImagesConverted = 0;

        // 3. Iterate and process each plan
        for (const plan of plans) {
            let planData;
            try {
                planData = JSON.parse(plan.planData);
            } catch (e) {
                console.error(`Could not parse planData for plan ID ${plan.id}. Skipping.`);
                continue;
            }

            if (!planData.imageUrls || typeof planData.imageUrls !== 'object') {
                continue; // Skip if no imageUrls object
            }

            let needsUpdate = false;
            const newImageUrls = { ...planData.imageUrls };

            for (const day in newImageUrls) {
                const url = newImageUrls[day];
                if (typeof url === 'string' && url.startsWith('data:image/')) {
                    try {
                        const base64Data = url.split(';base64,').pop();
                        const imageBuffer = Buffer.from(base64Data, 'base64');
                        
                        const fileExtension = url.substring("data:image/".length, url.indexOf(";base64")) === 'jpeg' ? 'jpg' : 'png';
                        // We'll save as jpg for consistency and smaller size
                        const fileName = `${crypto.randomUUID()}.jpg`;
                        const filePath = path.join(imagesDir, fileName);
                        const fileUrl = `/images/recipes/${fileName}`;
                        
                        // For simplicity, we assume we can write it directly. 
                        // For a robust solution, one would use a library like sharp to convert png to jpg.
                        // For this use case, writing the buffer directly is acceptable.
                        fs.writeFileSync(filePath, imageBuffer);

                        newImageUrls[day] = fileUrl;
                        needsUpdate = true;
                        totalImagesConverted++;
                        console.log(`  - Plan ${plan.id}, Day ${day}: Converted base64 to ${fileUrl}`);

                    } catch (err) {
                        console.error(`  - Failed to process image for Plan ${plan.id}, Day ${day}:`, err.message);
                    }
                }
            }

            // 4. Update the database if changes were made
            if (needsUpdate) {
                planData.imageUrls = newImageUrls;
                const updatedPlanData = JSON.stringify(planData);
                await pool.query('UPDATE archived_plans SET planData = ? WHERE id = ?', [updatedPlanData, plan.id]);
                console.log(` -> Plan ${plan.id} successfully updated in the database.`);
            }
        }

        console.log(`\n--- Migration Complete ---`);
        console.log(`Total images converted and saved: ${totalImagesConverted}`);

    } catch (error) {
        console.error('\n--- A CRITICAL ERROR OCCURRED ---');
        console.error(error.message);
        console.error('Migration failed. Please check your database credentials in the .env file and ensure the database is running.');
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

migrateImages();
