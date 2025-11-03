
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

const OLD_CONSTRAINT_NAME = 'app_jobs_ibfk_1';
const NEW_CONSTRAINT_NAME = 'fk_jobs_plan_id';
const TABLE_NAME = 'app_jobs';
const REFERENCED_TABLE = 'plans';
const LEGACY_REFERENCED_TABLE = 'legacy_archived_plans';

async function fixJobForeignKey() {
    console.log('--- Starting Foreign Key Correction Script for `app_jobs` (v2) ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // --- NEW STEP: Clean up orphaned jobs ---
        console.log('\nStep 1: Searching for orphaned jobs...');
        const [orphanedJobs] = await pool.query(
            `SELECT id, jobId, relatedPlanId FROM ${TABLE_NAME}
             WHERE relatedPlanId IS NOT NULL 
             AND relatedPlanId NOT IN (SELECT id FROM ${REFERENCED_TABLE})`
        );

        if (orphanedJobs.length > 0) {
            console.log(`Found ${orphanedJobs.length} orphaned job(s) pointing to non-existent plans.`);
            orphanedJobs.forEach(job => {
                console.log(`  - Job ID ${job.jobId} (DB ID ${job.id}) points to non-existent plan ID ${job.relatedPlanId}.`);
            });

            console.log('Deleting orphaned jobs...');
            const [deleteResult] = await pool.query(
                `DELETE FROM ${TABLE_NAME}
                 WHERE relatedPlanId IS NOT NULL 
                 AND relatedPlanId NOT IN (SELECT id FROM ${REFERENCED_TABLE})`
            );
            console.log(`Successfully deleted ${deleteResult.affectedRows} orphaned job(s).`);
        } else {
            console.log('No orphaned jobs found. Data is consistent.');
        }

        // --- Step 2: Check and fix constraints ---
        console.log('\nStep 2: Checking and correcting foreign key constraints...');
        
        const [createTableResult] = await pool.query(`SHOW CREATE TABLE ${TABLE_NAME}`);
        const createStatement = createTableResult[0]['Create Table'];
        
        const oldConstraintRegex = new RegExp(`CONSTRAINT \`${OLD_CONSTRAINT_NAME}\` FOREIGN KEY .* REFERENCES \`${LEGACY_REFERENCED_TABLE}\``);

        // Check if the old, incorrect constraint exists and drop it
        if (oldConstraintRegex.test(createStatement)) {
            console.log(`Found incorrect foreign key '${OLD_CONSTRAINT_NAME}'.`);
            console.log(` -> Dropping constraint '${OLD_CONSTRAINT_NAME}'...`);
            await pool.query(`ALTER TABLE ${TABLE_NAME} DROP FOREIGN KEY ${OLD_CONSTRAINT_NAME}`);
            console.log(' -> Constraint dropped successfully.');
        } else {
            console.log(`Old constraint '${OLD_CONSTRAINT_NAME}' not found. No need to drop.`);
        }

        // Re-fetch the create statement in case we just dropped a constraint
        const [updatedCreateTableResult] = await pool.query(`SHOW CREATE TABLE ${TABLE_NAME}`);
        const updatedCreateStatement = updatedCreateTableResult[0]['Create Table'];
        
        const newConstraintRegex = new RegExp(`CONSTRAINT \`${NEW_CONSTRAINT_NAME}\` FOREIGN KEY .* REFERENCES \`${REFERENCED_TABLE}\``);

        // Check if the new, correct constraint exists. If not, add it.
        if (newConstraintRegex.test(updatedCreateStatement)) {
            console.log(`Correct constraint '${NEW_CONSTRAINT_NAME}' already exists. No action needed.`);
        } else {
            console.log(`Correct constraint '${NEW_CONSTRAINT_NAME}' not found. Adding it now...`);
            await pool.query(
                `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${NEW_CONSTRAINT_NAME}
                 FOREIGN KEY (relatedPlanId) REFERENCES ${REFERENCED_TABLE}(id)
                 ON DELETE CASCADE`
            );
            console.log(' -> New constraint added successfully.');
        }

        console.log('\n--- Foreign Key Correction Complete ---');

    } catch (error) {
        console.error('\n--- A CRITICAL SCRIPT ERROR OCCURRED ---');
        console.error(error.message);
    } finally {
        if (pool) {
            await pool.end();
            console.log('Database connection closed.');
        }
    }
}

fixJobForeignKey();
