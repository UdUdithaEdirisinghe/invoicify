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

    // GET all customers or search/filter
    if (req.method === 'GET') {
      const { search, status, limit = 100, offset = 0 } = req.query;
      
      let query = `
        SELECT id, customer_code, name, email, phone, address, city, state, 
               country, postal_code, tax_id, credit_limit, outstanding_balance, 
               notes, status, created_at, updated_at
        FROM customers 
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR customer_code ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Add status filter
      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await sql.query(query, params);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM customers WHERE user_id = $1';
      const countParams = [userId];
      let countParamNum = 1;
      
      if (search) {
        countParamNum++;
        countQuery += ` AND (name ILIKE $${countParamNum} OR email ILIKE $${countParamNum} OR phone ILIKE $${countParamNum} OR customer_code ILIKE $${countParamNum})`;
        countParams.push(`%${search}%`);
      }
      if (status) {
        countParamNum++;
        countQuery += ` AND status = $${countParamNum}`;
        countParams.push(status);
      }
      
      const countResult = await sql.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        customers: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      });
    }

    // POST - Create new customer
    if (req.method === 'POST') {
      const {
        name, email, phone, address, city, state, country, postalCode,
        taxId, creditLimit, notes, status = 'active'
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Customer name is required' });
      }

      // Generate customer code
      const codeResult = await sql.query(
        'SELECT customer_code FROM customers WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      
      let customerCode;
      if (codeResult.rows.length > 0) {
        const lastCode = codeResult.rows[0].customer_code;
        const lastNum = parseInt(lastCode.replace(/\D/g, '')) || 0;
        customerCode = `CUST${String(lastNum + 1).padStart(5, '0')}`;
      } else {
        customerCode = 'CUST00001';
      }

      const result = await sql.query(
        `INSERT INTO customers 
         (user_id, customer_code, name, email, phone, address, city, state, 
          country, postal_code, tax_id, credit_limit, notes, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
         RETURNING *`,
        [userId, customerCode, name, email, phone, address, city, state, 
         country, postalCode, taxId, creditLimit || 0, notes, status]
      );

      return res.status(201).json({ customer: result.rows[0] });
    }

    // PUT - Update customer
    if (req.method === 'PUT') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }

      const {
        name, email, phone, address, city, state, country, postalCode,
        taxId, creditLimit, outstandingBalance, notes, status
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Customer name is required' });
      }

      const result = await sql.query(
        `UPDATE customers 
         SET name = $1, email = $2, phone = $3, address = $4, city = $5, 
             state = $6, country = $7, postal_code = $8, tax_id = $9, 
             credit_limit = $10, outstanding_balance = $11, notes = $12, status = $13
         WHERE id = $14 AND user_id = $15
         RETURNING *`,
        [name, email, phone, address, city, state, country, postalCode, taxId, 
         creditLimit || 0, outstandingBalance || 0, notes, status, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      return res.status(200).json({ customer: result.rows[0] });
    }

    // DELETE - Soft delete (set status to inactive) or hard delete
    if (req.method === 'DELETE') {
      const { id, hard } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }

      if (hard === 'true') {
        // Hard delete
        const result = await sql.query(
          'DELETE FROM customers WHERE id = $1 AND user_id = $2 RETURNING id',
          [id, userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Customer not found' });
        }
        
        return res.status(200).json({ message: 'Customer deleted permanently' });
      } else {
        // Soft delete
        const result = await sql.query(
          `UPDATE customers SET status = 'inactive' 
           WHERE id = $1 AND user_id = $2 RETURNING *`,
          [id, userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Customer not found' });
        }
        
        return res.status(200).json({ customer: result.rows[0] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Customers API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
