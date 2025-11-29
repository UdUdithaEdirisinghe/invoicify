const { sql } = require('@vercel/postgres');
const { verifyToken } = require('../auth/verify');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req);
    const userId = decoded.userId;

    // GET all purchase orders or search/filter
    if (req.method === 'GET') {
      const { search, status, supplierId, limit = 100, offset = 0 } = req.query;
      
      let query = `
        SELECT po.*, s.name as supplier_name, s.email as supplier_email
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (po.po_number ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Add status filter
      if (status) {
        paramCount++;
        query += ` AND po.status = $${paramCount}`;
        params.push(status);
      }

      // Add supplier filter
      if (supplierId) {
        paramCount++;
        query += ` AND po.supplier_id = $${paramCount}`;
        params.push(supplierId);
      }

      query += ` ORDER BY po.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await sql.query(query, params);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.user_id = $1';
      const countParams = [userId];
      let countParamNum = 1;
      
      if (search) {
        countParamNum++;
        countQuery += ` AND (po.po_number ILIKE $${countParamNum} OR s.name ILIKE $${countParamNum})`;
        countParams.push(`%${search}%`);
      }
      if (status) {
        countParamNum++;
        countQuery += ` AND po.status = $${countParamNum}`;
        countParams.push(status);
      }
      if (supplierId) {
        countParamNum++;
        countQuery += ` AND po.supplier_id = $${countParamNum}`;
        countParams.push(supplierId);
      }
      
      const countResult = await sql.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        purchaseOrders: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      });
    }

    // POST - Create new purchase order
    if (req.method === 'POST') {
      const {
        supplierId, poData, subtotal, taxAmount, discountAmount, 
        totalAmount, expectedDate, notes, status = 'draft'
      } = req.body;

      if (!supplierId || !poData) {
        return res.status(400).json({ error: 'Supplier and PO data are required' });
      }

      // Generate PO number
      const codeResult = await sql.query(
        'SELECT po_number FROM purchase_orders WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      
      let poNumber;
      if (codeResult.rows.length > 0) {
        const lastCode = codeResult.rows[0].po_number;
        const lastNum = parseInt(lastCode.replace(/\D/g, '')) || 0;
        poNumber = `PO${String(lastNum + 1).padStart(5, '0')}`;
      } else {
        poNumber = 'PO00001';
      }

      const result = await sql.query(
        `INSERT INTO purchase_orders 
         (user_id, supplier_id, po_number, po_data, subtotal, tax_amount, 
          discount_amount, total_amount, expected_date, notes, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [userId, supplierId, poNumber, JSON.stringify(poData), subtotal || 0, 
         taxAmount || 0, discountAmount || 0, totalAmount || 0, expectedDate, notes, status]
      );

      return res.status(201).json({ purchaseOrder: result.rows[0] });
    }

    // PUT - Update purchase order
    if (req.method === 'PUT') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Purchase order ID is required' });
      }

      const {
        supplierId, poData, subtotal, taxAmount, discountAmount, 
        totalAmount, paidAmount, expectedDate, receivedDate, notes, status
      } = req.body;

      const result = await sql.query(
        `UPDATE purchase_orders 
         SET supplier_id = $1, po_data = $2, subtotal = $3, tax_amount = $4, 
             discount_amount = $5, total_amount = $6, paid_amount = $7, 
             expected_date = $8, received_date = $9, notes = $10, status = $11
         WHERE id = $12 AND user_id = $13
         RETURNING *`,
        [supplierId, JSON.stringify(poData), subtotal, taxAmount, discountAmount, 
         totalAmount, paidAmount || 0, expectedDate, receivedDate, notes, status, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      // Update supplier outstanding balance if status changed to received
      if (status === 'received' && paidAmount < totalAmount) {
        const balanceChange = totalAmount - (paidAmount || 0);
        await sql.query(
          'UPDATE suppliers SET outstanding_balance = outstanding_balance + $1 WHERE id = $2',
          [balanceChange, supplierId]
        );
      }

      return res.status(200).json({ purchaseOrder: result.rows[0] });
    }

    // DELETE - Delete purchase order
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Purchase order ID is required' });
      }

      // Check if PO can be deleted (only draft status)
      const checkResult = await sql.query(
        'SELECT status FROM purchase_orders WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      if (checkResult.rows[0].status !== 'draft') {
        return res.status(400).json({ error: 'Only draft purchase orders can be deleted' });
      }

      await sql.query(
        'DELETE FROM purchase_orders WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      return res.status(200).json({ message: 'Purchase order deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Purchase orders API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
