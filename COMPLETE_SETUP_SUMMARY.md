# COMPLETE SETUP SUMMARY

## ✅ What I Fixed

### Backend Changes
1. **api/settings.js**
   - Added lazy initialization (creates default settings on first GET)
   - Added key normalization (ensures all fields exist)
   - Fixed malformed handler (removed duplicate catch blocks)
   - Uses JSONB `settings_data` column consistently

2. **api/auth.js**
   - Registration now writes JSONB settings instead of individual columns
   - Matches the database schema structure

3. **api/health.js** (NEW)
   - Health check endpoint at `/api/health`
   - Verifies database connection
   - Shows environment status

4. **lib/auth.js**
   - Consistent JWT verification across all APIs

### Database Changes
1. **repair_auth_schema.sql** (NEW)
   - Migrates `password_hash` → `password` column
   - Creates/repairs `user_settings` with JSONB `settings_data`
   - Backfills defaults from legacy columns if they exist
   - Normalizes missing keys
   - Adds triggers for `updated_at`
   - **SAFE TO RUN MULTIPLE TIMES**

2. **backfill_user_settings.sql**
   - Optional one-time backfill for existing users
   - Not needed if using lazy-init in API

### Helper Scripts
1. **start.ps1** - Interactive setup wizard
2. **setup-wizard.ps1** - Full automated setup with tests
3. **SETUP_INSTRUCTIONS.txt** - Step-by-step text guide

---

## 📋 COMPLETE SETUP CHECKLIST

### [ ] Step 1: Database
- [ ] Go to https://console.neon.tech
- [ ] Create project or select existing
- [ ] Open SQL Editor
- [ ] Copy **ALL** of `db/sql/repair_auth_schema.sql`
- [ ] Paste and Run (Ctrl+Enter)
- [ ] See "COMMIT" success
- [ ] Copy connection string from Dashboard

### [ ] Step 2: Environment
- [ ] Open `.env.local`
- [ ] Paste your Neon connection string
- [ ] Update JWT_SECRET (or generate new one)
- [ ] Save file

### [ ] Step 3: Start Server
Option A (Easy):
```powershell
.\start.ps1
```

Option B (Manual):
```powershell
$env:POSTGRES_URL = (Get-Content .env.local | Select-String -Pattern '^POSTGRES_URL' | ForEach-Object { ($_ -split '=',2)[1].Trim('"') })
$env:JWT_SECRET = (Get-Content .env.local | Select-String -Pattern '^JWT_SECRET' | ForEach-Object { ($_ -split '=',2)[1].Trim('"') })
npm run dev
```

### [ ] Step 4: Test
- [ ] http://localhost:3000/api/health → `{"status":"ok"}`
- [ ] http://localhost:3000/register.html → Create user
- [ ] Should redirect to dashboard
- [ ] Settings page loads
- [ ] Can create invoice

---

## 🎯 Ready Commands (Copy-Paste)

### Generate JWT Secret
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Quick Health Check
```powershell
curl http://localhost:3000/api/health
```

### Test Registration (PowerShell)
```powershell
$body = @{
    username = "testuser"
    email = "test@example.com"
    password = "test123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=register" -Method Post -ContentType "application/json" -Body $body
```

### Test Login (PowerShell)
```powershell
$body = @{
    email = "test@example.com"
    password = "test123"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:3000/api/auth?action=login" -Method Post -ContentType "application/json" -Body $body
$token = $result.token
Write-Host "Token: $token"
```

### Test Settings with Token
```powershell
# Use token from login above
Invoke-RestMethod -Uri "http://localhost:3000/api/settings" -Method Get -Headers @{ Authorization = "Bearer $token" }
```

---

## 🔍 Verification Queries (Run in Neon SQL Editor)

### Check users table structure
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Expected: id, username, email, **password**, created_at, updated_at

### Check user_settings structure
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;
```

Expected: user_id, **settings_data (jsonb)**, created_at, updated_at

### View all users
```sql
SELECT id, username, email, created_at FROM users ORDER BY id;
```

### View all settings
```sql
SELECT user_id, settings_data, created_at FROM user_settings ORDER BY user_id;
```

### Check for users without settings
```sql
SELECT u.id, u.username, u.email,
  CASE WHEN s.user_id IS NULL THEN 'NO SETTINGS' ELSE 'HAS SETTINGS' END as status
FROM users u
LEFT JOIN user_settings s ON s.user_id = u.id
ORDER BY u.id;
```

---

## 🚨 Common Issues & Fixes

### "Cannot load because running scripts is disabled"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### "Database connection failed"
1. Check POSTGRES_URL in .env.local
2. Verify includes `?sslmode=require`
3. Test: `curl http://localhost:3000/api/health`

### "Column password does not exist"
Run `db/sql/repair_auth_schema.sql` in Neon

### "Unauthorized" errors
1. Clear browser Local Storage (F12 → Application → Local Storage → Clear All)
2. Logout and login again

### Login doesn't redirect or loops
1. Check browser console for errors
2. Verify JWT_SECRET is set
3. Test health endpoint first

### Settings page blank or errors
1. Check if user_settings row exists (see verification queries above)
2. API will auto-create on first GET (lazy-init)

---

## 📊 Architecture Summary

```
┌─────────────────┐
│   Browser UI    │
│ (login/register │
│  /dashboard)    │
└────────┬────────┘
         │
         ↓ JWT Token
┌─────────────────┐
│   API Routes    │
│  - auth.js      │
│  - settings.js  │
│  - invoices.js  │
│  - health.js    │
└────────┬────────┘
         │
         ↓ SQL Queries
┌─────────────────┐
│  Neon Postgres  │
│  - users        │
│  - user_settings│
│    (JSONB)      │
└─────────────────┘
```

**Key Changes:**
- `users.password` (was `password_hash`)
- `user_settings.settings_data` JSONB (was individual columns)
- Lazy-init creates defaults automatically
- Normalization fills missing keys

---

## ✅ Success Indicators

You know it's working when:

1. ✅ Health endpoint returns `{"status":"ok"}`
2. ✅ Can register without errors
3. ✅ Redirects to dashboard after registration
4. ✅ Can logout and login again
5. ✅ Settings page loads with defaults
6. ✅ Can save settings changes
7. ✅ Can create and view invoices
8. ✅ PDF generation works

---

## 🎉 You're Done When

- [x] Database repair script executed
- [x] .env.local configured with real values
- [x] npm dependencies installed
- [x] Server starts without errors
- [x] Health check passes
- [x] Can register and login
- [x] Settings work
- [x] Invoices work

---

## 🚀 Deploy to Production

Once local testing passes:

1. **Push to GitHub**
   ```powershell
   git add .
   git commit -m "Fixed auth and settings - production ready"
   git push origin main
   ```

2. **Vercel Environment Variables**
   - Go to vercel.com/dashboard
   - Select project → Settings → Environment Variables
   - Add `POSTGRES_URL` and `JWT_SECRET`
   - Save

3. **Deploy**
   - Auto-deploys on push
   - Or: `vercel --prod`

4. **Verify Production**
   - Visit `https://your-app.vercel.app/api/health`
   - Should return `{"status":"ok"}`
   - Test registration and login

---

## 📞 Still Not Working?

If you've followed all steps and it still fails:

1. **Show me these outputs:**
   ```powershell
   # Health check
   curl http://localhost:3000/api/health
   
   # Environment check
   Get-Content .env.local
   
   # Table structure
   # (run in Neon SQL Editor)
   SELECT table_name FROM information_schema.tables WHERE table_schema='public';
   ```

2. **Check browser console**
   - Press F12
   - Go to Console tab
   - Try to register
   - Copy any red errors

3. **Check server logs**
   - Look at the terminal running `npm run dev`
   - Copy any error messages

---

Generated: December 1, 2025
Status: All critical fixes applied, scripts generated, ready for testing
