-- Backfill and normalize user settings (PostgreSQL)
-- Use in Neon SQL Editor or psql.

-- 1) Insert a default settings row for any user missing one
--    (run as-is to cover ALL users without settings).
WITH defaults AS (
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
  }'::jsonb AS d
)
INSERT INTO user_settings (user_id, settings_data)
SELECT u.id, d
FROM users u
CROSS JOIN defaults
LEFT JOIN user_settings s ON s.user_id = u.id
WHERE s.user_id IS NULL;

-- Optional: restrict to specific user ids (example: 2 and 3)
-- Replace the INSERT above with:
-- INSERT INTO user_settings (user_id, settings_data)
-- SELECT u.id, d
-- FROM users u
-- CROSS JOIN defaults
-- LEFT JOIN user_settings s ON s.user_id = u.id
-- WHERE s.user_id IS NULL AND u.id IN (2,3);


-- 2) Ensure all existing rows contain every expected key without
--    overwriting any existing non-null values.
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
SET settings_data = settings_data || (
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

-- 3) Quick check: list users and settings presence
SELECT u.id, u.username, u.email,
       CASE WHEN s.user_id IS NULL THEN 'NO SETTINGS'
            ELSE 'HAS SETTINGS: ' || s.settings_data::text END AS settings_status
FROM users u
LEFT JOIN user_settings s ON s.user_id = u.id
ORDER BY u.id;