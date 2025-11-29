import pool from './db.js';
import { verifyToken } from './auth/middleware.js';

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
                    'SELECT * FROM expense_categories WHERE user_id = $1 ORDER BY name',
                    [userId]
                );
                return res.status(200).json({ data: result.rows });
            } else if (req.method === 'POST') {
                const { name, description } = req.body;
                if (!name) {
                    return res.status(400).json({ error: 'Name is required' });
                }
                const result = await pool.query(
                    'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
                    [userId, name, description]
                );
                return res.status(201).json(result.rows[0]);
            } else if (req.method === 'DELETE') {
                if (!id) {
                    return res.status(400).json({ error: 'Category ID is required' });
                }
                const checkResult = await pool.query(
                    'SELECT COUNT(*) FROM expenses WHERE expense_category_id = $1 AND user_id = $2',
                    [id, userId]
                );
                if (parseInt(checkResult.rows[0].count) > 0) {
                    return res.status(400).json({ error: 'Cannot delete category that is in use' });
                }
                await pool.query(
                    'DELETE FROM expense_categories WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                return res.status(200).json({ message: 'Category deleted successfully' });
            }
        }

        // Handle expenses endpoints
        if (req.method === 'GET') {
            if (id) {
                const result = await pool.query(
                    `SELECT e.*, ec.name as category_name 
                     FROM expenses e 
                     LEFT JOIN expense_categories ec ON e.expense_category_id = ec.id 
                     WHERE e.id = $1 AND e.user_id = $2`,
                    [id, userId]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Expense not found' });
                }
                return res.status(200).json(result.rows[0]);
            } else {
                const { startDate, endDate, categoryId, status, offset = 0, limit = 50 } = req.query;
                let query = `SELECT e.*, ec.name as category_name 
                             FROM expenses e 
                             LEFT JOIN expense_categories ec ON e.expense_category_id = ec.id 
                             WHERE e.user_id = $1`;
                const params = [userId];
                let paramCount = 1;

                if (startDate) {
                    paramCount++;
                    query += ` AND e.expense_date >= $${paramCount}`;
                    params.push(startDate);
                }
                if (endDate) {
                    paramCount++;
                    query += ` AND e.expense_date <= $${paramCount}`;
                    params.push(endDate);
                }
                if (categoryId) {
                    paramCount++;
                    query += ` AND e.expense_category_id = $${paramCount}`;
                    params.push(categoryId);
                }
                if (status) {
                    paramCount++;
                    query += ` AND e.status = $${paramCount}`;
                    params.push(status);
                }

                const countResult = await pool.query(
                    query.replace('SELECT e.*, ec.name as category_name', 'SELECT COUNT(*)'),
                    params
                );

                query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
                params.push(parseInt(limit), parseInt(offset));

                const result = await pool.query(query, params);
                return res.status(200).json({
                    data: result.rows,
                    total: parseInt(countResult.rows[0].count)
                });
            }
        } else if (req.method === 'POST') {
            const { title, amount, categoryId, expenseDate, paymentMethod, status, description, notes } = req.body;

            if (!title || !amount || !categoryId || !expenseDate) {
                return res.status(400).json({ error: 'Title, amount, category, and date are required' });
            }

            const result = await pool.query(
                `INSERT INTO expenses (user_id, expense_category_id, title, amount, expense_date, payment_method, status, description, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [userId, categoryId, title, amount, expenseDate, paymentMethod, status || 'pending', description, notes]
            );

            return res.status(201).json(result.rows[0]);
        } else if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Expense ID is required' });
            }

            const { title, amount, categoryId, expenseDate, paymentMethod, status, description, notes } = req.body;

            const result = await pool.query(
                `UPDATE expenses SET title = $1, amount = $2, expense_category_id = $3, expense_date = $4, 
                 payment_method = $5, status = $6, description = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9 AND user_id = $10 RETURNING *`,
                [title, amount, categoryId, expenseDate, paymentMethod, status, description, notes, id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            return res.status(200).json(result.rows[0]);
        } else if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Expense ID is required' });
            }

            const result = await pool.query(
                'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            return res.status(200).json({ message: 'Expense deleted successfully' });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Expense API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
