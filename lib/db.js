import { sql } from '@vercel/postgres';

// Acts like a pg Pool with a query method so existing code using pool.query works
const pool = {
  async query(text, params) {
    try {
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
    await sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

    console.log('Verified core tables');
    return { success: true };
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
}

export default pool;