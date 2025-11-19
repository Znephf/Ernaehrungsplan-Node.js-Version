
const path = require('path');
const fs = require('fs/promises');
const dotenv = require('dotenv');
const { generateShareableHtml } = require('../server/services/htmlGenerator');

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

async function regenerateAllShareableHtmls() {
    console.log('--- Starting Regeneration of All Shareable HTML Files ---');
    console.log('This will update all existing shared plans to include the new Cooking Mode feature.');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        const [plansToUpdate] = await pool.query(
            "SELECT id, name, shareId FROM plans WHERE shareId IS NOT NULL AND shareId != ''"
        );

        if (plansToUpdate.length === 0) {
            console.log('No plans with existing share IDs found. Nothing to regenerate. Exiting.');
            await pool.end();
            return;
        }

        console.log(`Found ${plansToUpdate.length} shared plans to regenerate.`);
        let regeneratedCount = 0;
        let errorCount = 0;
        
        // Define output paths
        const appRoot = path.resolve(__dirname, '..');
        const publicSharesDir = path.join(appRoot, 'public', 'shares');
        const distSharesDir = path.join(appRoot, 'dist', 'shares');
        const pathsToWrite = [publicSharesDir, distSharesDir];

        for (const plan of plansToUpdate) {
            try {
                console.log(`  -> Regenerating for Plan ID: ${plan.id} (Share ID: ${plan.shareId})`);
                
                const htmlContent = await generateShareableHtml(plan);
                const fileName = `${plan.shareId}.html`;

                await Promise.all(pathsToWrite.map(async (dir) => {
                    try {
                        await fs.mkdir(dir, { recursive: true });
                        const filePath = path.join(dir, fileName);
                        await fs.writeFile(filePath, htmlContent);
                    } catch (e) {
                        // Ignore individual write errors (e.g. if dist doesn't exist in dev environment)
                    }
                }));
                
                console.log(`     ... Success: ${fileName} has been regenerated.`);
                regeneratedCount++;

            } catch (err) {
                console.error(`     ... FAILED to regenerate share file for Plan ID ${plan.id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n--- Regeneration Complete ---');
        console.log(`Successfully regenerated: ${regeneratedCount} files.`);
        console.log(`Failed to regenerate: ${errorCount} files.`);

    } catch (error) {
        console.error('\n--- A CRITICAL SCRIPT ERROR OCCURRED! ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed!');
        }
    }
}

regenerateAllShareableHtmls();
