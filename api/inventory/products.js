import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

function verifyToken(authHeader) {
  if (!authHeader) throw new Error('Missing Authorization header');
  const token = authHeader.replace('Bearer ', '');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload; // { userId, username }
}

export default async function handler(req, res) {
  try {
    const { userId } = verifyToken(req.headers.authorization);
    const method = req.method;

    if (method === 'GET') {
      const { rows } = await sql`
        SELECT id, name, sku, description, unit_price, quantity, low_stock_threshold, created_at, updated_at
        FROM products WHERE user_id = ${userId}
        ORDER BY name ASC`;
      return res.status(200).json({ products: rows });
    }

    if (method === 'POST') {
      const { name, sku, description, unitPrice, quantity, lowStockThreshold } = await req.json?.() || req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { rows } = await sql`
        INSERT INTO products (user_id, name, sku, description, unit_price, quantity, low_stock_threshold)
        VALUES (${userId}, ${name}, ${sku || null}, ${description || null}, ${unitPrice || 0}, ${quantity || 0}, ${lowStockThreshold || 0})
        RETURNING id`;
      return res.status(201).json({ id: rows[0].id });
    }

    if (method === 'PUT') {
      const { id, name, sku, description, unitPrice, quantity, lowStockThreshold } = await req.json?.() || req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await sql`
        UPDATE products SET
          name = COALESCE(${name}, name),
          sku = COALESCE(${sku}, sku),
          description = COALESCE(${description}, description),
          unit_price = COALESCE(${unitPrice}, unit_price),
          quantity = COALESCE(${quantity}, quantity),
          low_stock_threshold = COALESCE(${lowStockThreshold}, low_stock_threshold)
        WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    if (method === 'DELETE') {
      const { id } = await req.json?.() || req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await sql`DELETE FROM products WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Inventory products error:', err);
    const msg = err.message || 'Unexpected error';
    return res.status(401).json({ error: msg });
  }
}
