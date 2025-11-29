import { sql } from '@vercel/postgres';
import { verifyToken } from '../auth/verify.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req.headers.authorization);
    const userId = decoded.userId;

    if (req.method === 'GET') {
      // Get user settings
      const result = await sql`
        SELECT 
          business_name, address, email, phone, currency, 
          theme_color, logo_url, bank_name, bank_branch, 
          bank_account_no, show_bank_details
        FROM user_settings
        WHERE user_id = ${userId}
      `;

      if (result.rows.length === 0) {
        // Return defaults if no settings exist
        return res.status(200).json({
          success: true,
          settings: {
            businessName: '',
            address: '',
            email: '',
            phone: '',
            currency: 'LKR',
            themeColor: '#2563eb',
            logoUrl: '',
            bankName: '',
            bankBranch: '',
            bankAccountNo: '',
            showBankDetails: true
          }
        });
      }

      const settings = result.rows[0];
      return res.status(200).json({
        success: true,
        settings: {
          businessName: settings.business_name,
          address: settings.address,
          email: settings.email,
          phone: settings.phone,
          currency: settings.currency,
          themeColor: settings.theme_color,
          logoUrl: settings.logo_url,
          bankName: settings.bank_name,
          bankBranch: settings.bank_branch,
          bankAccountNo: settings.bank_account_no,
          showBankDetails: settings.show_bank_details
        }
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Parse body
      let body;
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body;
      }

      const {
        businessName,
        address,
        email,
        phone,
        currency,
        themeColor,
        logoUrl,
        bankName,
        bankBranch,
        bankAccountNo,
        showBankDetails
      } = body;

      // Upsert settings
      await sql`
        INSERT INTO user_settings (
          user_id, business_name, address, email, phone, currency,
          theme_color, logo_url, bank_name, bank_branch, bank_account_no, show_bank_details
        ) VALUES (
          ${userId}, ${businessName || ''}, ${address || ''}, ${email || ''}, 
          ${phone || ''}, ${currency || 'LKR'}, ${themeColor || '#2563eb'}, 
          ${logoUrl || ''}, ${bankName || ''}, ${bankBranch || ''}, 
          ${bankAccountNo || ''}, ${showBankDetails !== false}
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
          business_name = EXCLUDED.business_name,
          address = EXCLUDED.address,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          currency = EXCLUDED.currency,
          theme_color = EXCLUDED.theme_color,
          logo_url = EXCLUDED.logo_url,
          bank_name = EXCLUDED.bank_name,
          bank_branch = EXCLUDED.bank_branch,
          bank_account_no = EXCLUDED.bank_account_no,
          show_bank_details = EXCLUDED.show_bank_details,
          updated_at = CURRENT_TIMESTAMP
      `;

      return res.status(200).json({
        success: true,
        message: 'Settings saved successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    if (error.message === 'No token provided' || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
