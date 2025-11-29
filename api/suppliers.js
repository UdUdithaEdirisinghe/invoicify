import pool from '../lib/db.js';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const authResult = verifyToken(req);
    if (!authResult.success) {
        return res.status(401).json({ error: authResult.error });
    }

    const userId = authResult.userId;
    const { id } = req.query;

    try {
        if (req.method === 'GET') {
            if (id) {
                const result = await pool.query(
                    'SELECT * FROM suppliers WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Supplier not found' });
                }
                return res.status(200).json(result.rows[0]);
            } else {
                const { search, status, offset = 0, limit = 50 } = req.query;
                let query = 'SELECT * FROM suppliers WHERE user_id = $1';
                const params = [userId];
                let paramCount = 1;

                if (search) {
                    paramCount++;
                    query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
                    params.push(`%${search}%`);
                }

                if (status) {
                    paramCount++;
                    query += ` AND status = $${paramCount}`;
                    params.push(status);
                }

                const countResult = await pool.query(
                    query.replace('SELECT *', 'SELECT COUNT(*)'),
                    params
                );

                query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
                params.push(parseInt(limit), parseInt(offset));

                const result = await pool.query(query, params);
                return res.status(200).json({
                    data: result.rows,
                    total: parseInt(countResult.rows[0].count),
                    offset: parseInt(offset),
                    limit: parseInt(limit)
                });
            }
        } else if (req.method === 'POST') {
            const { name, email, phone, taxId, address, city, state, country, postalCode, paymentTerms, status, notes } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const result = await pool.query(
                `INSERT INTO suppliers (user_id, name, email, phone, tax_id, address, city, state, country, postal_code, payment_terms, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                [userId, name, email, phone, taxId, address, city, state, country, postalCode, paymentTerms, status || 'active', notes]
            );

            return res.status(201).json(result.rows[0]);
        } else if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Supplier ID is required' });
            }

            const { name, email, phone, taxId, address, city, state, country, postalCode, paymentTerms, outstandingBalance, status, notes } = req.body;

            const result = await pool.query(
                `UPDATE suppliers SET name = $1, email = $2, phone = $3, tax_id = $4, address = $5, city = $6, 
                 state = $7, country = $8, postal_code = $9, payment_terms = $10, outstanding_balance = $11, 
                 status = $12, notes = $13, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $14 AND user_id = $15 RETURNING *`,
                [name, email, phone, taxId, address, city, state, country, postalCode, paymentTerms, outstandingBalance, status, notes, id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Supplier not found' });
            }

            return res.status(200).json(result.rows[0]);
        } else if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Supplier ID is required' });
            }

            const result = await pool.query(
                'DELETE FROM suppliers WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Supplier not found' });
            }

            return res.status(200).json({ message: 'Supplier deleted successfully' });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Supplier API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
