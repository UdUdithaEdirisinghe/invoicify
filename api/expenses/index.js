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

    // GET all expenses or search/filter
    if (req.method === 'GET') {
      const { search, status, categoryId, startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      let query = `
        SELECT e.*, c.name as category_name, s.name as supplier_name
        FROM expenses e
        LEFT JOIN expense_categories c ON e.category_id = c.id
        LEFT JOIN suppliers s ON e.supplier_id = s.id
        WHERE e.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (e.title ILIKE $${paramCount} OR e.expense_number ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Add status filter
      if (status) {
        paramCount++;
        query += ` AND e.status = $${paramCount}`;
        params.push(status);
      }

      // Add category filter
      if (categoryId) {
        paramCount++;
        query += ` AND e.category_id = $${paramCount}`;
        params.push(categoryId);
      }

      // Add date range filter
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

      query += ` ORDER BY e.expense_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await sql.query(query, params);
      
      // Get total count and sum
      let countQuery = `
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
        FROM expenses e WHERE user_id = $1
      `;
      const countParams = [userId];
      let countParamNum = 1;
      
      if (search) {
        countParamNum++;
        countQuery += ` AND (title ILIKE $${countParamNum} OR expense_number ILIKE $${countParamNum})`;
        countParams.push(`%${search}%`);
      }
      if (status) {
        countParamNum++;
        countQuery += ` AND status = $${countParamNum}`;
        countParams.push(status);
      }
      if (categoryId) {
        countParamNum++;
        countQuery += ` AND category_id = $${countParamNum}`;
        countParams.push(categoryId);
      }
      if (startDate) {
        countParamNum++;
        countQuery += ` AND expense_date >= $${countParamNum}`;
        countParams.push(startDate);
      }
      if (endDate) {
        countParamNum++;
        countQuery += ` AND expense_date <= $${countParamNum}`;
        countParams.push(endDate);
      }
      
      const countResult = await sql.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);
      const totalAmount = parseFloat(countResult.rows[0].total_amount);

      return res.status(200).json({
        expenses: result.rows,
        pagination: {
          total,
          totalAmount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      });
    }

    // POST - Create new expense
    if (req.method === 'POST') {
      const {
        categoryId, supplierId, title, description, amount, expenseDate,
        paymentMethod, receiptUrl, notes, status = 'pending'
      } = req.body;

      if (!title || !amount || !expenseDate) {
        return res.status(400).json({ error: 'Title, amount, and date are required' });
      }

      // Generate expense number
      const codeResult = await sql.query(
        'SELECT expense_number FROM expenses WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      
      let expenseNumber;
      if (codeResult.rows.length > 0 && codeResult.rows[0].expense_number) {
        const lastCode = codeResult.rows[0].expense_number;
        const lastNum = parseInt(lastCode.replace(/\D/g, '')) || 0;
        expenseNumber = `EXP${String(lastNum + 1).padStart(5, '0')}`;
      } else {
        expenseNumber = 'EXP00001';
      }

      const result = await sql.query(
        `INSERT INTO expenses 
         (user_id, category_id, supplier_id, expense_number, title, description, 
          amount, expense_date, payment_method, receipt_url, notes, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING *`,
        [userId, categoryId, supplierId, expenseNumber, title, description, 
         amount, expenseDate, paymentMethod, receiptUrl, notes, status]
      );

      return res.status(201).json({ expense: result.rows[0] });
    }

    // PUT - Update expense
    if (req.method === 'PUT') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Expense ID is required' });
      }

      const {
        categoryId, supplierId, title, description, amount, expenseDate,
        paymentMethod, receiptUrl, notes, status
      } = req.body;

      if (!title || !amount || !expenseDate) {
        return res.status(400).json({ error: 'Title, amount, and date are required' });
      }

      const result = await sql.query(
        `UPDATE expenses 
         SET category_id = $1, supplier_id = $2, title = $3, description = $4, 
             amount = $5, expense_date = $6, payment_method = $7, receipt_url = $8, 
             notes = $9, status = $10
         WHERE id = $11 AND user_id = $12
         RETURNING *`,
        [categoryId, supplierId, title, description, amount, expenseDate, 
         paymentMethod, receiptUrl, notes, status, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      return res.status(200).json({ expense: result.rows[0] });
    }

    // DELETE - Delete expense
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Expense ID is required' });
      }

      const result = await sql.query(
        'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      return res.status(200).json({ message: 'Expense deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Expenses API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
