
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

async function addBackLinksToShares() {
    console.log('--- Starting Retrofit: Adding "Back to Planner" links to shared plans ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // Get all plans that have been shared
        const [plansToUpdate] = await pool.query(
            "SELECT id, name, shareId FROM plans WHERE shareId IS NOT NULL AND shareId != ''"
        );

        if (plansToUpdate.length === 0) {
            console.log('No shared plans found to update.');
            await pool.end();
            return;
        }

        console.log(`Found ${plansToUpdate.length} plans to update.`);
        let updatedCount = 0;
        
        const appRoot = path.resolve(__dirname, '..');
        const publicSharesDir = path.join(appRoot, 'public', 'shares');
        const distSharesDir = path.join(appRoot, 'dist', 'shares');

        try {
            await fs.mkdir(publicSharesDir, { recursive: true });
            // Optional: ensure dist exists if used
            const distExists = await fs.stat(path.join(appRoot, 'dist')).then(() => true).catch(() => false);
            if (distExists) await fs.mkdir(distSharesDir, { recursive: true });
        } catch (e) { /* ignore */ }

        for (const plan of plansToUpdate) {
            try {
                // We reuse the generator which now includes the back link in the template
                const htmlContent = await generateShareableHtml({
                    ...plan,
                    name: plan.name || 'Ernährungsplan'
                });
                
                const fileName = `${plan.shareId}.html`;
                const publicFilePath = path.join(publicSharesDir, fileName);

                await fs.writeFile(publicFilePath, htmlContent);
                await fs.chmod(publicFilePath, 0o644);
                
                // Update dist if it exists
                const distExists = await fs.stat(path.join(appRoot, 'dist')).then(() => true).catch(() => false);
                if (distExists) {
                    const distFilePath = path.join(distSharesDir, fileName);
                    await fs.writeFile(distFilePath, htmlContent);
                    await fs.chmod(distFilePath, 0o644);
                }
                
                updatedCount++;
                // Log progress every 10 items
                if (updatedCount % 10 === 0) process.stdout.write('.');

            } catch (err) {
                console.error(`\nFailed to update Plan ID ${plan.id}: ${err.message}`);
            }
        }

        console.log(`\n\n--- Retrofit Complete ---`);
        console.log(`Successfully updated ${updatedCount} plans with the new header.`);

    } catch (error) {
        console.error('\n--- CRITICAL ERROR ---');
        console.error(error.message);
    } finally {
        if (pool) await pool.end();
    }
}

addBackLinksToShares();
