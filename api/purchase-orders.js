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
                    `SELECT po.*, s.name as supplier_name,
                     json_agg(json_build_object('product_id', pol.product_id, 'quantity', pol.quantity, 'unit_price', pol.unit_price)) as line_items
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON po.supplier_id = s.id
                     LEFT JOIN purchase_order_line_items pol ON po.id = pol.purchase_order_id
                     WHERE po.id = $1 AND po.user_id = $2
                     GROUP BY po.id, s.name`,
                    [id, userId]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Purchase order not found' });
                }
                return res.status(200).json(result.rows[0]);
            } else {
                const { search, status, supplierId, offset = 0, limit = 50 } = req.query;
                let query = `SELECT po.*, s.name as supplier_name 
                             FROM purchase_orders po 
                             LEFT JOIN suppliers s ON po.supplier_id = s.id 
                             WHERE po.user_id = $1`;
                const params = [userId];
                let paramCount = 1;

                if (search) {
                    paramCount++;
                    query += ` AND po.po_number ILIKE $${paramCount}`;
                    params.push(`%${search}%`);
                }
                if (status) {
                    paramCount++;
                    query += ` AND po.status = $${paramCount}`;
                    params.push(status);
                }
                if (supplierId) {
                    paramCount++;
                    query += ` AND po.supplier_id = $${paramCount}`;
                    params.push(supplierId);
                }

                const countResult = await pool.query(
                    query.replace('SELECT po.*, s.name as supplier_name', 'SELECT COUNT(*)'),
                    params
                );

                query += ` ORDER BY po.order_date DESC, po.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
                params.push(parseInt(limit), parseInt(offset));

                const result = await pool.query(query, params);
                return res.status(200).json({
                    data: result.rows,
                    total: parseInt(countResult.rows[0].count)
                });
            }
        } else if (req.method === 'POST') {
            const { supplierId, orderDate, expectedDeliveryDate, totalAmount, status, notes, lineItems } = req.body;

            if (!supplierId || !orderDate || !lineItems || lineItems.length === 0) {
                return res.status(400).json({ error: 'Supplier, order date, and line items are required' });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const poResult = await client.query(
                    `INSERT INTO purchase_orders (user_id, supplier_id, order_date, expected_delivery_date, total_amount, status, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [userId, supplierId, orderDate, expectedDeliveryDate, totalAmount, status || 'draft', notes]
                );

                const poId = poResult.rows[0].id;

                for (const item of lineItems) {
                    await client.query(
                        `INSERT INTO purchase_order_line_items (purchase_order_id, product_id, quantity, unit_price)
                         VALUES ($1, $2, $3, $4)`,
                        [poId, item.productId, item.quantity, item.unitPrice]
                    );
                }

                await client.query('COMMIT');
                return res.status(201).json(poResult.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Purchase order ID is required' });
            }

            const { supplierId, orderDate, expectedDeliveryDate, receivedDate, totalAmount, status, notes, lineItems } = req.body;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const result = await client.query(
                    `UPDATE purchase_orders SET supplier_id = $1, order_date = $2, expected_delivery_date = $3, 
                     received_date = $4, total_amount = $5, status = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $8 AND user_id = $9 RETURNING *`,
                    [supplierId, orderDate, expectedDeliveryDate, receivedDate, totalAmount, status, notes, id, userId]
                );

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Purchase order not found' });
                }

                if (lineItems && lineItems.length > 0) {
                    await client.query('DELETE FROM purchase_order_line_items WHERE purchase_order_id = $1', [id]);
                    for (const item of lineItems) {
                        await client.query(
                            `INSERT INTO purchase_order_line_items (purchase_order_id, product_id, quantity, unit_price)
                             VALUES ($1, $2, $3, $4)`,
                            [id, item.productId, item.quantity, item.unitPrice]
                        );
                    }
                }

                await client.query('COMMIT');
                return res.status(200).json(result.rows[0]);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Purchase order ID is required' });
            }

            const result = await pool.query(
                'DELETE FROM purchase_orders WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Purchase order not found' });
            }

            return res.status(200).json({ message: 'Purchase order deleted successfully' });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Purchase order API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
