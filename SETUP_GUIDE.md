# Complete Setup Guide for Invoicify

This guide will walk you through setting up authentication and database for your Invoicify app.

## Prerequisites

- GitHub account
- Vercel account (can sign up with GitHub)
- Neon account (can sign up with GitHub)

---

## Step 1: Set Up Neon Database

### 1.1 Create Neon Account & Project

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Sign up with GitHub (it's free)
3. Click "Create a project"
4. Name it: `invoicify-db`
5. Select region closest to you
6. Click "Create project"

### 1.2 Get Connection String

1. In your Neon dashboard, click on your project
2. Go to "Dashboard" tab
3. Under "Connection Details", you'll see:
   - Host
   - Database name
   - User
   - Password
4. **Copy the connection string** - it looks like:
   ```
   postgres://username:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
5. **Save this somewhere safe** - you'll need it later

### 1.3 Create Database Tables

1. In Neon dashboard, click "SQL Editor" in the left menu
2. Open the file `schema.sql` from your project
3. Copy ALL the SQL code
4. Paste it into the Neon SQL Editor
5. Click "Run" or press Ctrl+Enter
6. You should see "Success" messages

**Verify tables were created:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```
You should see `users` and `invoices` tables.

---

## Step 2: Configure Local Environment

### 2.1 Install Dependencies

Open PowerShell in your project folder:

```powershell
cd "c:\Users\udith\Desktop\invoice-app"
npm install
```

### 2.2 Set Environment Variables

1. Open `.env.local` file
2. Replace the placeholder values:

```env
POSTGRES_URL="postgres://your_actual_connection_string_from_neon"
JWT_SECRET="paste_a_random_secret_here"
```

**Generate a secure JWT secret:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste as your `JWT_SECRET`.

### 2.3 Test Locally

```powershell
npm run dev
```

Open browser to `http://localhost:3000/`

**Test the flow:**
1. Go to `/register.html`
2. Create a test account (username: `test`, password: `test123`)
3. You should be redirected to `/dashboard.html`
4. Try creating a new invoice

---

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub

```powershell
cd "c:\Users\udith\Desktop\invoice-app"

git add .
git commit -m "Add authentication and database integration"
git push origin main
```

### 3.2 Configure Vercel Environment Variables

**Option A: Vercel Dashboard (Recommended)**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your `invoicify` project
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

| Name | Value | Environments |
|------|-------|--------------|
| `POSTGRES_URL` | Your Neon connection string | Production, Preview, Development |
| `JWT_SECRET` | Your generated secret | Production, Preview, Development |

5. Click "Save"

**Option B: Vercel CLI**

```powershell
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Add environment variables
vercel env add POSTGRES_URL production
# Paste your Neon connection string when prompted

vercel env add JWT_SECRET production
# Paste your JWT secret when prompted
```

### 3.3 Deploy

**Automatic (if you already connected GitHub):**
- Push to GitHub triggers auto-deploy
- Wait 1-2 minutes
- Check deployment status in Vercel dashboard

**Manual:**
```powershell
vercel --prod
```

### 3.4 Test Live Deployment

1. Go to your Vercel URL (e.g., `invoicify.vercel.app`)
2. Visit `/register.html`
3. Create an account
4. Test creating invoices
5. Logout and login again to verify persistence

---

## Step 4: Verify Everything Works

### Checklist

- [ ] Can register a new user
- [ ] Can login with created user
- [ ] Dashboard shows "Logged in as: username"
- [ ] Can create a new invoice
- [ ] Invoice appears in dashboard list
- [ ] Can view invoice details
- [ ] Can delete an invoice
- [ ] Logout works and redirects to login
- [ ] Cannot access dashboard without login
- [ ] Data persists after logout/login

---

## Troubleshooting

### "Database connection failed"
- Verify `POSTGRES_URL` is correct in Vercel environment variables
- Make sure connection string includes `?sslmode=require`
- Check Neon dashboard - is database active?

### "No token provided" or "Unauthorized"
- Clear browser localStorage: Open DevTools → Application → Local Storage → Clear
- Check `JWT_SECRET` is set in Vercel
- Try logging out and back in

### "Table does not exist"
- Re-run `schema.sql` in Neon SQL Editor
- Verify tables exist:
  ```sql
  SELECT * FROM users LIMIT 1;
  SELECT * FROM invoices LIMIT 1;
  ```

### "Username already exists"
- Either the username is taken, or database has duplicate
- Try a different username
- Or clear test data:
  ```sql
  DELETE FROM users WHERE username = 'test';
  ```

### Vercel deployment fails
- Check build logs in Vercel dashboard
- Verify `package.json` has correct dependencies
- Make sure `node_modules` is in `.gitignore`

---

## Next Steps

### Optional Enhancements

1. **Email verification** - Add email field and verification flow
2. **Password reset** - Implement forgot password feature
3. **User profiles** - Add company details to user account
4. **Invoice templates** - Multiple PDF designs
5. **Search & filters** - Search invoices by customer/date
6. **Analytics** - Charts and revenue tracking
7. **Export to CSV** - Bulk export functionality
8. **Team accounts** - Multiple users per company

### Security Improvements (Production)

1. **Rate limiting** - Prevent brute force attacks
2. **HTTPS only** - Enforce secure connections (Vercel does this automatically)
3. **Input validation** - Server-side validation for all inputs
4. **CSRF protection** - Add CSRF tokens for forms
5. **Session management** - Implement refresh tokens
6. **Audit logs** - Track all invoice changes

---

## Support

If you encounter issues:

1. Check browser console for errors (F12 → Console)
2. Check Vercel function logs (Dashboard → Functions → Logs)
3. Check Neon database logs (Dashboard → Operations)
4. Review this guide step-by-step

---

## Summary

You now have:
- ✅ User authentication system
- ✅ Cloud database (Neon Postgres)
- ✅ Secure password hashing
- ✅ JWT token authentication
- ✅ Protected invoice storage
- ✅ Multi-user support
- ✅ Deployed on Vercel

Your app is production-ready! 🎉
