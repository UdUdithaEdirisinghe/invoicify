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

    // GET all suppliers or search/filter
    if (req.method === 'GET') {
      const { search, status, limit = 100, offset = 0 } = req.query;
      
      let query = `
        SELECT id, supplier_code, name, email, phone, address, city, state, 
               country, postal_code, tax_id, payment_terms, outstanding_balance, 
               notes, status, created_at, updated_at
        FROM suppliers 
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR supplier_code ILIKE $${paramCount})`;
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
      let countQuery = 'SELECT COUNT(*) FROM suppliers WHERE user_id = $1';
      const countParams = [userId];
      let countParamNum = 1;
      
      if (search) {
        countParamNum++;
        countQuery += ` AND (name ILIKE $${countParamNum} OR email ILIKE $${countParamNum} OR phone ILIKE $${countParamNum} OR supplier_code ILIKE $${countParamNum})`;
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
        suppliers: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < total
        }
      });
    }

    // POST - Create new supplier
    if (req.method === 'POST') {
      const {
        name, email, phone, address, city, state, country, postalCode,
        taxId, paymentTerms, notes, status = 'active'
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Supplier name is required' });
      }

      // Generate supplier code
      const codeResult = await sql.query(
        'SELECT supplier_code FROM suppliers WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [userId]
      );
      
      let supplierCode;
      if (codeResult.rows.length > 0) {
        const lastCode = codeResult.rows[0].supplier_code;
        const lastNum = parseInt(lastCode.replace(/\D/g, '')) || 0;
        supplierCode = `SUPP${String(lastNum + 1).padStart(5, '0')}`;
      } else {
        supplierCode = 'SUPP00001';
      }

      const result = await sql.query(
        `INSERT INTO suppliers 
         (user_id, supplier_code, name, email, phone, address, city, state, 
          country, postal_code, tax_id, payment_terms, notes, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
         RETURNING *`,
        [userId, supplierCode, name, email, phone, address, city, state, 
         country, postalCode, taxId, paymentTerms || 'Net 30', notes, status]
      );

      return res.status(201).json({ supplier: result.rows[0] });
    }

    // PUT - Update supplier
    if (req.method === 'PUT') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Supplier ID is required' });
      }

      const {
        name, email, phone, address, city, state, country, postalCode,
        taxId, paymentTerms, outstandingBalance, notes, status
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Supplier name is required' });
      }

      const result = await sql.query(
        `UPDATE suppliers 
         SET name = $1, email = $2, phone = $3, address = $4, city = $5, 
             state = $6, country = $7, postal_code = $8, tax_id = $9, 
             payment_terms = $10, outstanding_balance = $11, notes = $12, status = $13
         WHERE id = $14 AND user_id = $15
         RETURNING *`,
        [name, email, phone, address, city, state, country, postalCode, taxId, 
         paymentTerms, outstandingBalance || 0, notes, status, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      return res.status(200).json({ supplier: result.rows[0] });
    }

    // DELETE - Soft delete or hard delete
    if (req.method === 'DELETE') {
      const { id, hard } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Supplier ID is required' });
      }

      if (hard === 'true') {
        // Hard delete
        const result = await sql.query(
          'DELETE FROM suppliers WHERE id = $1 AND user_id = $2 RETURNING id',
          [id, userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Supplier not found' });
        }
        
        return res.status(200).json({ message: 'Supplier deleted permanently' });
      } else {
        // Soft delete
        const result = await sql.query(
          `UPDATE suppliers SET status = 'inactive' 
           WHERE id = $1 AND user_id = $2 RETURNING *`,
          [id, userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Supplier not found' });
        }
        
        return res.status(200).json({ supplier: result.rows[0] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Suppliers API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
