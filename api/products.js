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
    const { id, categories } = req.query;

    try {
        // Handle categories endpoint
        if (categories === 'true') {
            if (req.method === 'GET') {
                const result = await pool.query(
                    'SELECT * FROM product_categories WHERE user_id = $1 ORDER BY name',
                    [userId]
                );
                return res.status(200).json({ data: result.rows });
            } else if (req.method === 'POST') {
                const { name, description } = req.body;
                if (!name) {
                    return res.status(400).json({ error: 'Name is required' });
                }
                const result = await pool.query(
                    'INSERT INTO product_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
                    [userId, name, description]
                );
                return res.status(201).json(result.rows[0]);
            } else if (req.method === 'DELETE') {
                if (!id) {
                    return res.status(400).json({ error: 'Category ID is required' });
                }
                await pool.query(
                    'DELETE FROM product_categories WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                return res.status(200).json({ message: 'Category deleted successfully' });
            }
        }

        // Handle products endpoints
        if (req.method === 'GET') {
            if (id) {
                const result = await pool.query(
                    `SELECT p.*, pc.name as category_name 
                     FROM products p 
                     LEFT JOIN product_categories pc ON p.product_category_id = pc.id 
                     WHERE p.id = $1 AND p.user_id = $2`,
                    [id, userId]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                return res.status(200).json(result.rows[0]);
            } else {
                const { search, categoryId, offset = 0, limit = 50 } = req.query;
                let query = `SELECT p.*, pc.name as category_name 
                             FROM products p 
                             LEFT JOIN product_categories pc ON p.product_category_id = pc.id 
                             WHERE p.user_id = $1`;
                const params = [userId];
                let paramCount = 1;

                if (search) {
                    paramCount++;
                    query += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                    params.push(`%${search}%`);
                }
                if (categoryId) {
                    paramCount++;
                    query += ` AND p.product_category_id = $${paramCount}`;
                    params.push(categoryId);
                }

                const countResult = await pool.query(
                    query.replace('SELECT p.*, pc.name as category_name', 'SELECT COUNT(*)'),
                    params
                );

                query += ` ORDER BY p.name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
                params.push(parseInt(limit), parseInt(offset));

                const result = await pool.query(query, params);
                return res.status(200).json({
                    data: result.rows,
                    total: parseInt(countResult.rows[0].count)
                });
            }
        } else if (req.method === 'POST') {
            const { name, sku, description, categoryId, unitPrice, costPrice, currentQuantity, stockThreshold } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const result = await pool.query(
                `INSERT INTO products (user_id, product_category_id, name, sku, description, unit_price, cost_price, current_quantity, stock_threshold)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [userId, categoryId, name, sku, description, unitPrice || 0, costPrice || 0, currentQuantity || 0, stockThreshold || 10]
            );

            return res.status(201).json(result.rows[0]);
        } else if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required' });
            }

            const { name, sku, description, categoryId, unitPrice, costPrice, currentQuantity, stockThreshold } = req.body;

            const result = await pool.query(
                `UPDATE products SET name = $1, sku = $2, description = $3, product_category_id = $4, 
                 unit_price = $5, cost_price = $6, current_quantity = $7, stock_threshold = $8, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9 AND user_id = $10 RETURNING *`,
                [name, sku, description, categoryId, unitPrice, costPrice, currentQuantity, stockThreshold, id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            return res.status(200).json(result.rows[0]);
        } else if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required' });
            }

            const result = await pool.query(
                'DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            return res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Product API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
