# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1️⃣ Install Dependencies
```powershell
npm install
```

### 2️⃣ Set Up Neon Database

1. Go to [console.neon.tech](https://console.neon.tech) and sign up
2. Create a new project called `invoicify-db`
3. Copy your connection string (starts with `postgres://...`)
4. Open SQL Editor and run the SQL from `schema.sql`

### 3️⃣ Configure Environment

Edit `.env.local`:
```env
POSTGRES_URL="paste_your_neon_connection_string_here"
JWT_SECRET="generate_using_command_below"
```

Generate JWT secret:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4️⃣ Test Locally
```powershell
npm run dev
```
Visit `http://localhost:3000/register.html`

### 5️⃣ Deploy to Vercel

1. Push to GitHub:
   ```powershell
   git add .
   git commit -m "Add auth and database"
   git push
   ```

2. In Vercel Dashboard → Settings → Environment Variables:
   - Add `POSTGRES_URL` (your Neon connection string)
   - Add `JWT_SECRET` (your generated secret)

3. Redeploy automatically or manually

### ✅ Done!

Visit your Vercel URL → Register → Create invoices

---

## Troubleshooting

**Can't login?** Clear browser localStorage (F12 → Application → Local Storage → Clear)

**Database error?** Check `POSTGRES_URL` is correct in Vercel environment variables

**Need help?** See `SETUP_GUIDE.md` for detailed instructions

---

## File Structure

```
api/              → Backend serverless functions
  auth/           → Login, register, verify
  invoices/       → Create, list, get, delete
  db.js           → Database connection

js/
  api-client.js   → API wrapper with JWT
  auth.js         → Auth UI handlers
  app.js          → Main invoice app
  
login.html        → Login page
register.html     → Registration page  
dashboard.html    → Invoice list (protected)
index.html        → Invoice editor (protected)

schema.sql        → Database setup
.env.local        → Local environment variables
```

---

## What Was Built

✅ User registration & login  
✅ JWT authentication  
✅ Password hashing (bcrypt)  
✅ Protected API endpoints  
✅ Neon Postgres database  
✅ Invoice CRUD operations  
✅ Multi-user support  
✅ Vercel serverless deployment  

---

**Next:** Read `SETUP_GUIDE.md` for complete details and advanced features!
