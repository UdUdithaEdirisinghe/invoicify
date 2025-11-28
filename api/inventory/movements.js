import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

function verifyToken(authHeader) {
  if (!authHeader) throw new Error('No token provided');
  const token = authHeader.replace('Bearer ', '');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload; // { userId, username }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { userId } = verifyToken(req.headers.authorization);
    const method = req.method;

    if (method === 'GET') {
      const productId = req.query?.productId || req.url?.match(/productId=([^&]+)/)?.[1];
      const where = productId ? sql`AND product_id = ${productId}` : sql``;
      const { rows } = await sql`
        SELECT id, product_id, type, quantity, note, created_at
        FROM inventory_movements WHERE user_id = ${userId} ${where}
        ORDER BY created_at DESC`;
      return res.status(200).json({ movements: rows });
    }

    if (method === 'POST') {
      const { productId, type, quantity, note } = req.body || {};
      if (!productId || !type || quantity === undefined) {
        return res.status(400).json({ error: 'productId, type, quantity required' });
      }
      await sql`
        INSERT INTO inventory_movements (user_id, product_id, type, quantity, note)
        VALUES (${userId}, ${productId}, ${type}, ${quantity}, ${note || null})`;
      return res.status(201).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Inventory movements error:', err);
    const msg = err.message || 'Unexpected error';
    const status = msg === 'No token provided' ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}
