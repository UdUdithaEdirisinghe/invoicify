# Invoicify - Invoice Management System

A full-stack invoice management app with user authentication and cloud database storage.

## Features

✅ User authentication (register/login)  
✅ Create and manage invoices  
✅ Cloud database storage (Neon Postgres)  
✅ PDF generation  
✅ Multi-user support  
✅ Deployed on Vercel

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Neon Postgres
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Vercel

## Setup Instructions

### 1. Install Dependencies

```powershell
cd "c:\Users\udith\Desktop\invoice-app"
npm install
```

### 2. Set Up Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project
3. Copy your connection string (looks like: `postgres://username:password@host/database`)
4. Open the SQL Editor in Neon dashboard
5. Copy and paste the contents of `schema.sql` and execute it

### 3. Configure Environment Variables

Copy `.env.local` and add your credentials:

```env
POSTGRES_URL="your_neon_connection_string_here"
JWT_SECRET="your-secret-key-here"
```

**Generate a secure JWT secret:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Locally

```powershell
npm run dev
```

Open `http://localhost:3000/`

### 5. Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables in Vercel:
   - `POSTGRES_URL` - Your Neon connection string
   - `JWT_SECRET` - Your secret key

```powershell
# Or use Vercel CLI
vercel env add POSTGRES_URL
vercel env add JWT_SECRET
vercel --prod
```

## Project Structure

```
├── api/                      # Serverless functions
│   ├── auth/
│   │   ├── login.js         # Login endpoint
│   │   ├── register.js      # Registration endpoint
│   │   └── verify.js        # Token verification
│   ├── invoices/
│   │   ├── create.js        # Create invoice
│   │   ├── list.js          # List user's invoices
│   │   ├── get.js           # Get single invoice
│   │   └── delete.js        # Delete invoice
│   └── db.js                # Database connection
├── js/
│   ├── api-client.js        # API wrapper with JWT
│   ├── auth.js              # Auth UI logic
│   ├── app.js               # Main app logic
│   ├── pdf-generator.js     # PDF generation
│   ├── router.js            # Client-side routing
│   └── store.js             # Local storage utils
├── css/
│   └── style.css            # Styles
├── index.html               # Main app (editor)
├── dashboard.html           # Invoice list
├── login.html               # Login page
├── register.html            # Registration page
├── schema.sql               # Database schema
├── package.json             # Dependencies
└── .env.local               # Environment variables (local)
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Invoices (Protected)
- `POST /api/invoices/create` - Create invoice
- `GET /api/invoices/list` - List user's invoices
- `GET /api/invoices/get?id=123` - Get single invoice
- `DELETE /api/invoices/delete?id=123` - Delete invoice

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- JWTs expire after 7 days
- All invoice endpoints require authentication
- Users can only access their own invoices
- CORS enabled for cross-origin requests

## License

Proprietary. Do not redistribute without permission.
