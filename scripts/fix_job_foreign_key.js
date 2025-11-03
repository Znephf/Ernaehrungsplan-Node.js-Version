
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
    console.log('--- Starting Foreign Key Correction Script for `app_jobs` ---');
    let pool;
    try {
        pool = await getDbConnection();
        console.log('Successfully connected to the database.');

        // 1. Check the existing CREATE TABLE statement to find the constraint
        const [createTableResult] = await pool.query(`SHOW CREATE TABLE ${TABLE_NAME}`);
        const createStatement = createTableResult[0]['Create Table'];
        
        const oldConstraintRegex = new RegExp(`CONSTRAINT \`${OLD_CONSTRAINT_NAME}\` FOREIGN KEY .* REFERENCES \`${LEGACY_REFERENCED_TABLE}\``);
        const newConstraintRegex = new RegExp(`CONSTRAINT \`${NEW_CONSTRAINT_NAME}\` FOREIGN KEY .* REFERENCES \`${REFERENCED_TABLE}\``);

        if (newConstraintRegex.test(createStatement)) {
            console.log('SUCCESS: The correct foreign key constraint already exists. No action needed.');
            await pool.end();
            return;
        }

        if (oldConstraintRegex.test(createStatement)) {
            console.log(`Found incorrect foreign key '${OLD_CONSTRAINT_NAME}' referencing '${LEGACY_REFERENCED_TABLE}'.`);
            
            // 2. Drop the incorrect foreign key
            console.log(` -> Dropping constraint '${OLD_CONSTRAINT_NAME}'...`);
            await pool.query(`ALTER TABLE ${TABLE_NAME} DROP FOREIGN KEY ${OLD_CONSTRAINT_NAME}`);
            console.log(' -> Constraint dropped successfully.');
            
            // 3. Add the correct foreign key
            console.log(` -> Adding new constraint '${NEW_CONSTRAINT_NAME}' referencing '${REFERENCED_TABLE}'...`);
            await pool.query(
                `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${NEW_CONSTRAINT_NAME}
                 FOREIGN KEY (relatedPlanId) REFERENCES ${REFERENCED_TABLE}(id)
                 ON DELETE CASCADE`
            );
            console.log(' -> New constraint added successfully.');
            console.log('\n--- Foreign Key Correction Complete ---');
        } else {
            // It's possible there is no constraint at all, or it has a different name.
            // We'll assume if the old one isn't there, we are safe to add the new one.
            console.log(`No constraint named '${OLD_CONSTRAINT_NAME}' found referencing the legacy table. Attempting to add the correct constraint...`);
            try {
                await pool.query(
                    `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${NEW_CONSTRAINT_NAME}
                     FOREIGN KEY (relatedPlanId) REFERENCES ${REFERENCED_TABLE}(id)
                     ON DELETE CASCADE`
                );
                console.log(' -> New constraint added successfully.');
                console.log('\n--- Foreign Key Correction Complete ---');
            } catch (addError) {
                 if (addError.code === 'ER_FK_DUP_NAME' || addError.message.includes("Duplicate foreign key constraint name")) {
                    console.log(`A constraint named '${NEW_CONSTRAINT_NAME}' already exists. No action needed.`);
                 } else if (addError.code === 'ER_CANNOT_ADD_FOREIGN') {
                    console.error('\nERROR: Could not add the new foreign key. This might be because some `relatedPlanId` values in `app_jobs` do not exist in the `plans` table. Please clean up orphaned job entries and run the script again.');
                 } else {
                    console.warn(`Could not add the new foreign key. It might already exist with a different name. Please check your DB schema manually if sharing still fails. Error: ${addError.message}`);
                 }
            }
        }

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
