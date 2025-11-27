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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req.headers.authorization);
    const userId = decoded.userId;

    const { invoiceData } = req.body;

    if (!invoiceData) {
      return res.status(400).json({ error: 'Invoice data is required' });
    }

    // Insert invoice
    const result = await sql`
      INSERT INTO invoices (user_id, invoice_data)
      VALUES (${userId}, ${JSON.stringify(invoiceData)})
      RETURNING id, invoice_data, created_at, updated_at
    `;

    const invoice = result.rows[0];

    return res.status(201).json({
      success: true,
      invoice: {
        id: invoice.id,
        data: invoice.invoice_data,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      }
    });

  } catch (error) {
    if (error.message === 'No token provided' || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Create invoice error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
