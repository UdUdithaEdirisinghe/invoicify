import { sql } from '@vercel/postgres';
import { verifyToken } from '../auth/verify.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req.headers.authorization);
    const userId = decoded.userId;

    // Fetch all invoices for this user
    const result = await sql`
      SELECT id, invoice_data, created_at, updated_at
      FROM invoices
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    const invoices = result.rows.map(row => ({
      id: row.id,
      data: row.invoice_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return res.status(200).json({
      success: true,
      invoices
    });

  } catch (error) {
    if (error.message === 'No token provided' || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('List invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
