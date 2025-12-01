import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export default async function handler(req, res) {
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
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    if (req.method === 'GET') {
      // Get user settings
      const result = await sql`
        SELECT settings_data
        FROM user_settings
        WHERE user_id = ${userId}
      `;

      if (result.rows.length === 0) {
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

      return res.status(200).json(result.rows[0].settings_data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Save user settings
      const settings = req.body;

      // Upsert settings using JSONB
      await sql`
        INSERT INTO user_settings (user_id, settings_data, updated_at)
        VALUES (${userId}, ${JSON.stringify(settings)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          settings_data = ${JSON.stringify(settings)},
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
    console.error('Settings API error:', error);
    
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

  } catch (error) {
    console.error('Settings API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
