import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function runMigration() {
    if (!process.env.POSTGRES_URL) {
        console.error('Error: POSTGRES_URL environment variable is not set.');
        console.error('Please ensure .env.local exists and contains the connection string.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Connected successfully.');

        const migrationFile = path.join(__dirname, '../migrations/2025-12-05_fix_invoice_columns.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('Running migration: 2025-12-05_fix_invoice_columns.sql');
        await client.query(sql);
        
        console.log('Migration completed successfully!');
        client.release();
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
