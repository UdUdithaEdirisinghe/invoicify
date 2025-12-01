-- Repair/Align Auth + Settings Schema (safe/idempotent)
-- Goal: match backend code expectations
-- - users.password (hashed)
-- - user_settings.settings_data JSONB with defaults
--
-- Run this in Neon SQL editor. Safe to run multiple times.

BEGIN;

-- 1) Ensure users table exists
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1a) If legacy column name 'password_hash' exists but 'password' doesn't, migrate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    ALTER TABLE users ADD COLUMN password VARCHAR(255);
    UPDATE users SET password = password_hash WHERE password IS NULL;
  END IF;
END $$;

-- 1b) Ensure NOT NULL and uniqueness (tolerant if already set)
ALTER TABLE users ALTER COLUMN password SET NOT NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Recreate unique indexes if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='users' AND indexname='users_username_key'
  ) THEN
    BEGIN
      ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='users' AND indexname='users_email_key'
  ) THEN
    BEGIN
      ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END $$;

-- 2) Ensure user_settings table with JSONB exists
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2a) If table existed with columnar fields, backfill JSONB from them
DO $$
DECLARE
  has_settings_data BOOLEAN;
  has_business_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='user_settings' AND column_name='settings_data'
  ) INTO has_settings_data;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='user_settings' AND column_name='business_name'
  ) INTO has_business_name;

  IF has_business_name AND has_settings_data THEN
    UPDATE user_settings SET settings_data = jsonb_strip_nulls(jsonb_build_object(
      'logo', COALESCE(logo_url, ''),
      'email', COALESCE(email, ''),
      'phone', COALESCE(phone, ''),
      'address', COALESCE(address, ''),
      'bankName', COALESCE(bank_name, ''),
      'currency', COALESCE(currency, 'LKR'),
      'bankBranch', COALESCE(bank_branch, ''),
      'themeColor', COALESCE(theme_color, '#3b82f6'),
      'bankAccount', COALESCE(bank_account_no, ''),
      'businessName', COALESCE(business_name, ''),
      'showBankDetails', COALESCE(show_bank_details, false)
    ))
    WHERE (settings_data IS NULL OR settings_data = '{}'::jsonb);
  END IF;
END $$;

-- 2b) Ensure defaults for any missing keys
WITH default_obj AS (
  SELECT '{
    "logo": "",
    "email": "",
    "phone": "",
    "address": "",
    "bankName": "",
    "currency": "LKR",
    "bankBranch": "",
    "themeColor": "#3b82f6",
    "bankAccount": "",
    "businessName": "",
    "showBankDetails": false
  }'::jsonb AS obj
)
UPDATE user_settings s
SET settings_data = s.settings_data || (
  SELECT jsonb_object_agg(k, v)
  FROM default_obj d,
       LATERAL jsonb_each(d.obj) AS e(k, v)
  WHERE NOT (s.settings_data ? k)
)
WHERE EXISTS (
  SELECT 1
  FROM default_obj d,
       LATERAL jsonb_each(d.obj) AS e(k, v)
  WHERE NOT (s.settings_data ? k)
);

-- 3) Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification
-- SELECT id, username, email FROM users LIMIT 5;
-- SELECT user_id, settings_data FROM user_settings LIMIT 5;
