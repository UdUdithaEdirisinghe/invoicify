const { sql } = require('@vercel/postgres');
const { verifyToken } = require('../auth/verify');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req);
    const userId = decoded.userId;

    // GET all payments or filter by type/reference
    if (req.method === 'GET') {
      const { paymentType, referenceId, startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      let query = `
        SELECT p.*,
          CASE 
            WHEN p.payment_type = 'invoice' THEN i.invoice_number
            WHEN p.payment_type = 'purchase_order' THEN po.po_number
            WHEN p.payment_type = 'expense' THEN e.expense_number
          END as reference_number
        FROM payments p
        LEFT JOIN invoices i ON p.payment_type = 'invoice' AND p.reference_id = i.id
        LEFT JOIN purchase_orders po ON p.payment_type = 'purchase_order' AND p.reference_id = po.id
        LEFT JOIN expenses e ON p.payment_type = 'expense' AND p.reference_id = e.id
        WHERE p.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      // Add payment type filter
      if (paymentType) {
        paramCount++;
        query += ` AND p.payment_type = $${paramCount}`;
        params.push(paymentType);
      }

      // Add reference filter
      if (referenceId) {
        paramCount++;
        query += ` AND p.reference_id = $${paramCount}`;
        params.push(referenceId);
      }

      // Add date range filter
      if (startDate) {
        paramCount++;
        query += ` AND p.payment_date >= $${paramCount}`;
        params.push(startDate);
      }
      if (endDate) {
        paramCount++;
        query += ` AND p.payment_date <= $${paramCount}`;
        params.push(endDate);
      }

      query += ` ORDER BY p.payment_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await sql.query(query, params);
      
      // Get total count and sum
      let countQuery = `
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
        FROM payments WHERE user_id = $1
      `;
      const countParams = [userId];
      let countParamNum = 1;
      
      if (paymentType) {
        countParamNum++;
        countQuery += ` AND payment_type = $${countParamNum}`;
        countParams.push(paymentType);
      }
      if (referenceId) {
        countParamNum++;
        countQuery += ` AND reference_id = $${countParamNum}`;
        countParams.push(referenceId);
      }
      if (startDate) {
        countParamNum++;
        countQuery += ` AND payment_date >= $${countParamNum}`;
        countParams.push(startDate);
      }
      if (endDate) {
        countParamNum++;
        countQuery += ` AND payment_date <= $${countParamNum}`;
        countParams.push(endDate);
      }
      
      const countResult = await sql.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);
      const totalAmount = parseFloat(countResult.rows[0].total_amount);

      return res.status(200).json({
        payments: result.rows,
        pagination: {
          total,
          totalAmount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      });
    }

    // POST - Create new payment
    if (req.method === 'POST') {
      const {
        paymentType, referenceId, amount, paymentDate, paymentMethod,
        transactionReference, notes
      } = req.body;

      if (!paymentType || !referenceId || !amount || !paymentDate || !paymentMethod) {
        return res.status(400).json({ 
          error: 'Payment type, reference ID, amount, date, and method are required' 
        });
      }

      // Validate payment type
      if (!['invoice', 'purchase_order', 'expense'].includes(paymentType)) {
        return res.status(400).json({ error: 'Invalid payment type' });
      }

      // Generate payment number
      const codeResult = await sql.query(
        'SELECT payment_number FROM payments WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      
      let paymentNumber;
      if (codeResult.rows.length > 0 && codeResult.rows[0].payment_number) {
        const lastCode = codeResult.rows[0].payment_number;
        const lastNum = parseInt(lastCode.replace(/\D/g, '')) || 0;
        paymentNumber = `PAY${String(lastNum + 1).padStart(5, '0')}`;
      } else {
        paymentNumber = 'PAY00001';
      }

      const result = await sql.query(
        `INSERT INTO payments 
         (user_id, payment_type, reference_id, payment_number, amount, payment_date, 
          payment_method, transaction_reference, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [userId, paymentType, referenceId, paymentNumber, amount, paymentDate, 
         paymentMethod, transactionReference, notes]
      );

      // Update paid amount in related table
      if (paymentType === 'invoice') {
        await sql.query(
          'UPDATE invoices SET paid_amount = paid_amount + $1 WHERE id = $2 AND user_id = $3',
          [amount, referenceId, userId]
        );
      } else if (paymentType === 'purchase_order') {
        await sql.query(
          'UPDATE purchase_orders SET paid_amount = paid_amount + $1 WHERE id = $2 AND user_id = $3',
          [amount, referenceId, userId]
        );
      } else if (paymentType === 'expense') {
        await sql.query(
          'UPDATE expenses SET status = $1 WHERE id = $2 AND user_id = $3',
          ['paid', referenceId, userId]
        );
      }

      return res.status(201).json({ payment: result.rows[0] });
    }

    // DELETE - Delete payment
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Payment ID is required' });
      }

      // Get payment details before deletion
      const paymentResult = await sql.query(
        'SELECT payment_type, reference_id, amount FROM payments WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const { payment_type, reference_id, amount } = paymentResult.rows[0];

      // Delete payment
      await sql.query(
        'DELETE FROM payments WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      // Update paid amount in related table
      if (payment_type === 'invoice') {
        await sql.query(
          'UPDATE invoices SET paid_amount = paid_amount - $1 WHERE id = $2 AND user_id = $3',
          [amount, reference_id, userId]
        );
      } else if (payment_type === 'purchase_order') {
        await sql.query(
          'UPDATE purchase_orders SET paid_amount = paid_amount - $1 WHERE id = $2 AND user_id = $3',
          [amount, reference_id, userId]
        );
      } else if (payment_type === 'expense') {
        await sql.query(
          'UPDATE expenses SET status = $1 WHERE id = $2 AND user_id = $3',
          ['pending', reference_id, userId]
        );
      }
      
      return res.status(200).json({ message: 'Payment deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Payments API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
