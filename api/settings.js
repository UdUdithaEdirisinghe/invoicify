import { sql } from '@vercel/postgres';
import { verifyToken } from '../lib/auth.js';

const DEFAULT_SETTINGS = {
  logo: '',
  email: '',
  phone: '',
  address: '',
  bankName: '',
  currency: 'LKR',
  bankBranch: '',
  themeColor: '#3b82f6',
  bankAccount: '',
  businessName: '',
  showBankDetails: false
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth
  const auth = verifyToken(req);
  if (!auth.success) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = auth.userId;

  try {
    if (req.method === 'GET') {
      // Fetch settings
      const result = await sql`
        SELECT settings_data
        FROM user_settings
        WHERE user_id = ${userId}
      `;

      if (result.rows.length === 0) {
        // Lazy-init with defaults
        await sql`
          INSERT INTO user_settings (user_id, settings_data)
          VALUES (${userId}, ${sql.json(DEFAULT_SETTINGS)})
          ON CONFLICT (user_id) DO NOTHING
        `;
        return res.status(200).json(DEFAULT_SETTINGS);
      }

      const dbSettings = result.rows[0].settings_data || {};
      const normalized = { ...DEFAULT_SETTINGS, ...dbSettings };

      // Persist normalization if keys were missing
      if (JSON.stringify(normalized) !== JSON.stringify(dbSettings)) {
        await sql`
          UPDATE user_settings
          SET settings_data = ${sql.json(normalized)}, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      }

      return res.status(200).json(normalized);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Whitelist and normalize incoming settings
      const body = req.body || {};
      const allowed = Object.keys(DEFAULT_SETTINGS).reduce((acc, k) => {
        if (Object.prototype.hasOwnProperty.call(body, k)) acc[k] = body[k];
        return acc;
      }, {});
      const settings = { ...DEFAULT_SETTINGS, ...allowed };

      await sql`
        INSERT INTO user_settings (user_id, settings_data, updated_at)
        VALUES (${userId}, ${sql.json(settings)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET settings_data = ${sql.json(settings)}, updated_at = NOW()
      `;

      return res.status(200).json({ success: true, message: 'Settings saved successfully', settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Settings API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
