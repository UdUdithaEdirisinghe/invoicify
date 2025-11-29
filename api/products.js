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
            const { name, sku, description, product_category_id, unit_price, cost_price, current_quantity, stock_threshold } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const result = await pool.query(
                `INSERT INTO products (user_id, product_category_id, name, sku, description, unit_price, cost_price, current_quantity, stock_threshold)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [userId, product_category_id, name, sku, description, unit_price || 0, cost_price || 0, current_quantity || 0, stock_threshold || 10]
            );

            return res.status(201).json(result.rows[0]);
        } else if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required' });
            }

            const { name, sku, description, product_category_id, unit_price, cost_price, current_quantity, stock_threshold } = req.body;

            // Build dynamic UPDATE query to only set provided fields
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(name);
            }
            if (sku !== undefined) {
                updates.push(`sku = $${paramCount++}`);
                values.push(sku);
            }
            if (description !== undefined) {
                updates.push(`description = $${paramCount++}`);
                values.push(description);
            }
            if (product_category_id !== undefined) {
                updates.push(`product_category_id = $${paramCount++}`);
                values.push(product_category_id);
            }
            if (unit_price !== undefined) {
                updates.push(`unit_price = $${paramCount++}`);
                values.push(unit_price);
            }
            if (cost_price !== undefined) {
                updates.push(`cost_price = $${paramCount++}`);
                values.push(cost_price);
            }
            if (current_quantity !== undefined) {
                updates.push(`current_quantity = $${paramCount++}`);
                values.push(parseInt(current_quantity, 10));
            }
            if (stock_threshold !== undefined) {
                updates.push(`stock_threshold = $${paramCount++}`);
                values.push(stock_threshold);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id, userId);

            const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;

            const result = await pool.query(query, values);

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
