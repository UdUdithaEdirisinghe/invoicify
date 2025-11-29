# Settings Sync Migration

## What to Run in Neon Database

Run this SQL in your Neon database console to add the user_settings table:

```sql
-- User settings table for cross-device sync
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  address TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'LKR',
  theme_color VARCHAR(7) DEFAULT '#2563eb',
  logo_url TEXT,
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_no VARCHAR(100),
  show_bank_details BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
```

## What This Does

- **Cross-device sync**: Settings now stored in database instead of just localStorage
- **Login from any device**: Business info, logo, theme, and bank details sync automatically
- **Backward compatible**: Still caches locally for performance
- **Registration flow**: Settings saved to cloud during signup

## How It Works

1. **On registration**: Settings saved to database immediately
2. **On login**: Settings loaded from database and cached locally
3. **On settings save**: Synced to both local storage and database
4. **Offline**: Falls back to local cache if database unavailable

## What Syncs

✅ Business name, address, email, phone
✅ Currency and theme color
✅ Logo (base64 encoded)
✅ Bank details
✅ Show bank details toggle

## Files Changed

- `schema.sql` - Added user_settings table
- `api/settings/index.js` - New API endpoint (GET/POST)
- `js/api-client.js` - Added getSettings/saveSettings methods
- `js/store.js` - Added getSettingsAsync/saveSettingsAsync
- `js/auth.js` - Save settings on registration
- `js/app.js` - Load settings on init, save async

## Testing

1. Run the SQL in Neon
2. Register a new account with business details
3. Log out and log in from another browser/device
4. Settings should appear automatically!
