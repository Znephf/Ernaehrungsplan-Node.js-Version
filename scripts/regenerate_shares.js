
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
    console.log('This update includes the fix for legacy ingredient strings.');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        const [plansToUpdate] = await pool.query(
            "SELECT id, name, shareId FROM plans WHERE shareId IS NOT NULL AND shareId != ''"
        );

        if (plansToUpdate.length === 0) {
            console.log('No plans with existing share IDs found. Nothing to regenerate.');
            await pool.end();
            return;
        }

        console.log(`Found ${plansToUpdate.length} shared plans to regenerate.`);
        let regeneratedCount = 0;
        let errorCount = 0;
        
        const appRoot = path.resolve(__dirname, '..');
        const publicSharesDir = path.join(appRoot, 'public', 'shares');
        const distSharesDir = path.join(appRoot, 'dist', 'shares');

        try {
            await fs.mkdir(publicSharesDir, { recursive: true });
            const distExists = await fs.stat(path.join(appRoot, 'dist')).then(() => true).catch(() => false);
            if (distExists) {
                 await fs.mkdir(distSharesDir, { recursive: true });
            }
        } catch (e) { console.warn("Directory creation warning:", e.message); }

        for (const plan of plansToUpdate) {
            try {
                console.log(`  -> Regenerating Plan ID: ${plan.id} (${plan.shareId})`);
                
                const htmlContent = await generateShareableHtml(plan);
                const fileName = `${plan.shareId}.html`;
                const publicFilePath = path.join(publicSharesDir, fileName);

                await fs.writeFile(publicFilePath, htmlContent);
                await fs.chmod(publicFilePath, 0o644);
                
                const distExists = await fs.stat(path.join(appRoot, 'dist')).then(() => true).catch(() => false);
                if (distExists) {
                    const distFilePath = path.join(distSharesDir, fileName);
                    await fs.writeFile(distFilePath, htmlContent);
                    await fs.chmod(distFilePath, 0o644);
                }
                
                regeneratedCount++;

            } catch (err) {
                console.error(`     ... FAILED Plan ID ${plan.id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n--- Regeneration Complete ---');
        console.log(`Success: ${regeneratedCount}, Errors: ${errorCount}`);

    } catch (error) {
        console.error('\n--- CRITICAL ERROR ---');
        console.error(error.message);
    } finally {
        if (pool) await pool.end();
    }
}

regenerateAllShareableHtmls();
