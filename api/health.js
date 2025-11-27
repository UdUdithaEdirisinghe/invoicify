import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    const hasJwt = !!process.env.JWT_SECRET;
    const hasPg = !!process.env.POSTGRES_URL;

    // Basic DB connectivity check
    let dbOk = false;
    try {
      await sql`SELECT 1 as ok`;
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }

    return res.status(200).json({
      status: 'ok',
      env: { JWT_SECRET: hasJwt, POSTGRES_URL: hasPg },
      db: dbOk
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
