const sql = require('../db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authentication check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  
  try {
    // Simple token validation - in production, use proper JWT validation
    if (!token) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = 1; // In production, extract from JWT token

    if (req.method === 'GET') {
      // Get user settings
      const result = await sql`
        SELECT settings_data
        FROM user_settings
        WHERE user_id = ${userId}
      `;

      if (result.length === 0) {
        // Return default settings
        return res.status(200).json({
          businessName: '',
          address: '',
          phone: '',
          email: '',
          currency: 'LKR',
          themeColor: '#3b82f6',
          showBankDetails: false,
          bankName: '',
          bankBranch: '',
          bankAccount: '',
          logo: ''
        });
      }

      return res.status(200).json(result[0].settings_data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Save user settings
      const settings = req.body;

      // Upsert settings
      await sql`
        INSERT INTO user_settings (user_id, settings_data, updated_at)
        VALUES (${userId}, ${sql.json(settings)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          settings_data = ${sql.json(settings)},
          updated_at = NOW()
      `;

      return res.status(200).json({ 
        success: true, 
        message: 'Settings saved successfully',
        settings
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Settings API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
