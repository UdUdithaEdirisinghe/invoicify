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

    // GET all expense categories
    if (req.method === 'GET') {
      const result = await sql.query(
        'SELECT * FROM expense_categories WHERE user_id = $1 ORDER BY name ASC',
        [userId]
      );

      return res.status(200).json({ categories: result.rows });
    }

    // POST - Create new category
    if (req.method === 'POST') {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const result = await sql.query(
        'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, description]
      );

      return res.status(201).json({ category: result.rows[0] });
    }

    // PUT - Update category
    if (req.method === 'PUT') {
      const { id } = req.query;
      const { name, description } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Category ID is required' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const result = await sql.query(
        'UPDATE expense_categories SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, description, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      return res.status(200).json({ category: result.rows[0] });
    }

    // DELETE - Delete category
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Category ID is required' });
      }

      // Check if category is in use
      const checkResult = await sql.query(
        'SELECT COUNT(*) FROM expenses WHERE category_id = $1',
        [id]
      );

      if (parseInt(checkResult.rows[0].count) > 0) {
        return res.status(400).json({ error: 'Cannot delete category that is in use' });
      }

      const result = await sql.query(
        'DELETE FROM expense_categories WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      return res.status(200).json({ message: 'Category deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Expense categories API error:', error);
    
    if (error.message === 'Invalid or missing token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
};
