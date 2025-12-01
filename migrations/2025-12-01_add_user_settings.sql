-- Migration: Add user_settings table
-- Date: 2025-12-01
-- Description: Create table to store user settings and preferences

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Insert default settings for existing users
INSERT INTO user_settings (user_id, settings_data)
SELECT id, '{
  "businessName": "",
  "address": "",
  "phone": "",
  "email": "",
  "currency": "LKR",
  "themeColor": "#3b82f6",
  "showBankDetails": false,
  "bankName": "",
  "bankBranch": "",
  "bankAccount": "",
  "logo": ""
}'::jsonb
FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings);
