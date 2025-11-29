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
                // Get single invoice
                const result = await pool.query(
                    `SELECT i.*, c.name as customer_name, c.email as customer_email 
                     FROM invoices i 
                     LEFT JOIN customers c ON i.customer_id = c.id 
                     WHERE i.id = $1 AND i.user_id = $2`,
                    [id, userId]
                );
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }
                
                return res.status(200).json(result.rows[0]);
            } else {
                // List invoices with filters
                const { search, status, customerId, startDate, endDate, offset = 0, limit = 50 } = req.query;
                
                let query = `SELECT i.*, c.name as customer_name, c.email as customer_email 
                             FROM invoices i 
                             LEFT JOIN customers c ON i.customer_id = c.id 
                             WHERE i.user_id = $1`;
                const params = [userId];
                let paramCount = 1;

                if (search) {
                    paramCount++;
                    query += ` AND (i.invoice_number ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`;
                    params.push(`%${search}%`);
                }

                if (status) {
                    paramCount++;
                    query += ` AND i.status = $${paramCount}`;
                    params.push(status);
                }

                if (customerId) {
                    paramCount++;
                    query += ` AND i.customer_id = $${paramCount}`;
                    params.push(customerId);
                }

                if (startDate) {
                    paramCount++;
                    query += ` AND i.created_at >= $${paramCount}`;
                    params.push(startDate);
                }

                if (endDate) {
                    paramCount++;
                    query += ` AND i.created_at <= $${paramCount}`;
                    params.push(endDate);
                }

                const countResult = await pool.query(
                    query.replace('SELECT i.*, c.name as customer_name, c.email as customer_email', 'SELECT COUNT(*)'),
                    params
                );

                query += ` ORDER BY i.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
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
            // Create invoice
            const { 
                customerId, 
                invoiceNumber, 
                invoiceData, 
                subtotal, 
                taxAmount, 
                discountAmount, 
                shippingAmount, 
                totalAmount,
                dueDate,
                status,
                notes 
            } = req.body;

            if (!invoiceNumber) {
                // Auto-generate invoice number if not provided
                const lastInvoice = await pool.query(
                    'SELECT invoice_number FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [userId]
                );
                
                let nextNumber = 'INV-00001';
                if (lastInvoice.rows.length > 0) {
                    const lastNum = lastInvoice.rows[0].invoice_number.split('-')[1];
                    nextNumber = `INV-${String(parseInt(lastNum) + 1).padStart(5, '0')}`;
                }
                req.body.invoiceNumber = nextNumber;
            }

            const result = await pool.query(
                `INSERT INTO invoices (
                    user_id, customer_id, invoice_number, invoice_data, 
                    subtotal, tax_amount, discount_amount, shipping_amount, total_amount,
                    paid_amount, status, due_date, notes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                [
                    userId, 
                    customerId || null, 
                    req.body.invoiceNumber, 
                    JSON.stringify(invoiceData || {}), 
                    subtotal || 0, 
                    taxAmount || 0, 
                    discountAmount || 0, 
                    shippingAmount || 0, 
                    totalAmount || 0,
                    0, // paid_amount starts at 0
                    status || 'draft',
                    dueDate || null,
                    notes || null
                ]
            );

            return res.status(201).json(result.rows[0]);
        } else if (req.method === 'PUT') {
            // Update invoice
            if (!id) {
                return res.status(400).json({ error: 'Invoice ID is required' });
            }

            const { 
                customerId, 
                invoiceData, 
                subtotal, 
                taxAmount, 
                discountAmount, 
                shippingAmount, 
                totalAmount,
                paidAmount,
                status,
                dueDate,
                notes 
            } = req.body;

            // Build dynamic update query
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (customerId !== undefined) {
                updates.push(`customer_id = $${paramCount++}`);
                values.push(customerId);
            }
            if (invoiceData !== undefined) {
                updates.push(`invoice_data = $${paramCount++}`);
                values.push(JSON.stringify(invoiceData));
            }
            if (subtotal !== undefined) {
                updates.push(`subtotal = $${paramCount++}`);
                values.push(subtotal);
            }
            if (taxAmount !== undefined) {
                updates.push(`tax_amount = $${paramCount++}`);
                values.push(taxAmount);
            }
            if (discountAmount !== undefined) {
                updates.push(`discount_amount = $${paramCount++}`);
                values.push(discountAmount);
            }
            if (shippingAmount !== undefined) {
                updates.push(`shipping_amount = $${paramCount++}`);
                values.push(shippingAmount);
            }
            if (totalAmount !== undefined) {
                updates.push(`total_amount = $${paramCount++}`);
                values.push(totalAmount);
            }
            if (paidAmount !== undefined) {
                updates.push(`paid_amount = $${paramCount++}`);
                values.push(paidAmount);
            }
            if (status !== undefined) {
                updates.push(`status = $${paramCount++}`);
                values.push(status);
            }
            if (dueDate !== undefined) {
                updates.push(`due_date = $${paramCount++}`);
                values.push(dueDate);
            }
            if (notes !== undefined) {
                updates.push(`notes = $${paramCount++}`);
                values.push(notes);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id, userId);

            const query = `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            return res.status(200).json(result.rows[0]);
        } else if (req.method === 'DELETE') {
            // Delete invoice
            if (!id) {
                return res.status(400).json({ error: 'Invoice ID is required' });
            }

            const result = await pool.query(
                'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            return res.status(200).json({ message: 'Invoice deleted successfully' });
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Invoice API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
