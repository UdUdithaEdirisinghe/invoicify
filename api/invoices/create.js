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

    // Consolidate duplicate items by productId
    const rawItems = invoiceData?.items || invoiceData?.lines || [];
    const consolidated = new Map();
    for (const item of rawItems) {
      const productId = item.productId || item.product_id;
      const qty = parseInt(item.quantity || item.qty || 0, 10);
      if (!productId || !qty || qty <= 0) continue;
      const prev = consolidated.get(productId) || 0;
      consolidated.set(productId, prev + qty);
    }

    // Validate stock availability before saving
    for (const [productId, totalQty] of consolidated.entries()) {
      const stockRes = await sql`SELECT quantity, name FROM products WHERE id = ${productId} AND user_id = ${userId}`;
      const prod = stockRes.rows[0];
      if (!prod) {
        return res.status(400).json({ error: `Product not found: ${productId}` });
      }
      if (prod.quantity < totalQty) {
        return res.status(400).json({ error: `Insufficient stock for ${prod.name}. Available: ${prod.quantity}, requested: ${totalQty}` });
      }
    }

    // Insert invoice
    const result = await sql`
      INSERT INTO invoices (user_id, invoice_data)
      VALUES (${userId}, ${JSON.stringify(invoiceData)})
      RETURNING id, invoice_data, created_at, updated_at
    `;

    const invoice = result.rows[0];

    // Deduct inventory using consolidated quantities
    for (const [productId, totalQty] of consolidated.entries()) {
      await sql`
        INSERT INTO inventory_movements (user_id, product_id, type, quantity, note)
        VALUES (${userId}, ${productId}, ${'out'}, ${totalQty}, ${'Invoice deduction'})`;
    }

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
