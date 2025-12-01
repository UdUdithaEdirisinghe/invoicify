import { sql } from '@vercel/postgres';
import pg from 'pg';

// Optional native pg fallback for non-Vercel/local environments
const { Pool } = pg;
let pgPool = null;
try {
  if (process.env.POSTGRES_URL) {
    pgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
} catch (e) {
  // If pg isn't available or initialization fails, continue with @vercel/postgres
}

// Unified query interface so existing code using pool.query works everywhere
const pool = {
  async query(text, params) {
    try {
      if (pgPool) {
        const res = await pgPool.query(text, params);
        // Normalize shape to be compatible with @vercel/postgres result
        return { rows: res.rows, rowCount: res.rowCount };
      }
      const result = await sql.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};

export async function initializeTables() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Verified core tables');
    return { success: true };
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
}

export default pool;