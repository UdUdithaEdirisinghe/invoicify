import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// API routes - import and use all API handlers as route handlers
const apiFiles = [
  'auth',
  'customers',
  'suppliers',
  'expenses',
  'products',
  'purchase-orders',
  'invoices',
  'settings',
  'health',
  'upload'
];

// Load API handlers
for (const file of apiFiles) {
  try {
    const module = await import(`./api/${file}.js`);
    const handler = module.default || module;
    // Handle all HTTP methods and pass to the Vercel-style handler
    app.all(`/api/${file}`, (req, res) => handler(req, res));
  } catch (error) {
    console.error(`Failed to load API module: ${file}`, error.message);
  }
}

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'dashboard.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(join(__dirname, 'settings.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ Server running at http://localhost:${PORT}`);
  console.log(`✓ API endpoints available at http://localhost:${PORT}/api/*`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
