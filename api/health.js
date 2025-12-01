import pool from '../lib/db.js';

export default async function handler(req, res) {
  try {
    const env = {
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      nodeEnv: process.env.NODE_ENV || 'development'
    };
    const db = await pool.query('SELECT 1 as ok');
    return res.status(200).json({ status: 'ok', env, db: db.rows[0] });
  } catch (err) {
    console.error('Health check failed:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
