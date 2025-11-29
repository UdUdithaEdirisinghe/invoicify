# Sales Management Enhancement

## Overview
The new Sales Management module provides a comprehensive dashboard for tracking revenue, managing invoices, analyzing payment trends, and understanding customer behavior - all while preserving existing invoice generation and inventory features.

## What's New

### 1. **Sales Dashboard** (`/sales.html`)
A unified sales command center with:

#### Key Metrics
- **Total Revenue (This Month)** - Sum of all invoice amounts for the current month
- **Pending Invoices** - Count and total value of unpaid/overdue invoices
- **Paid This Month** - Payments received in current month with invoice count
- **Average Invoice Value** - Mean invoice amount for the period

#### Visual Analytics
- **Revenue Trend Chart** - 6-month line chart showing sales progression
- **Payment Status Pie Chart** - Distribution of invoices by status (Paid/Sent/Overdue/Draft)

#### Organized Tabs
1. **Invoices Tab**
   - Full list of all invoices with search and status filtering
   - Shows invoice number, customer, dates, amounts, payment status
   - Quick actions: View, Edit each invoice

2. **Quotations Tab**
   - Reserved for quotation management (future enhancement)
   - Same UI pattern as invoices

3. **Payments Tab**
   - Payment history with date range filtering
   - Shows transaction details: date, invoice, customer, method, amount, reference

4. **Top Customers Tab**
   - Ranked list of customers by total revenue
   - Displays: Invoice count, total revenue, average invoice, outstanding balance
   - Helps identify VIP customers and payment trends

### 2. **Invoices API** (`/api/invoices.js`)
New unified endpoint replacing old scattered invoice functions:

#### Endpoints
```
GET    /api/invoices              # List all with filters
GET    /api/invoices?id=123       # Get single invoice
POST   /api/invoices              # Create new invoice
PUT    /api/invoices?id=123       # Update invoice (partial updates supported)
DELETE /api/invoices?id=123       # Delete invoice
```

#### Query Parameters (GET list)
- `search` - Filter by invoice number or customer name
- `status` - Filter by status (draft/sent/paid/overdue/cancelled)
- `customerId` - Filter by specific customer
- `startDate` / `endDate` - Date range filtering
- `offset` / `limit` - Pagination support

#### Features
- Auto-generates invoice numbers (INV-00001, INV-00002, etc.)
- Links invoices to customers for relationship tracking
- Joins customer data (name, email) in responses
- Dynamic partial updates (only update fields you provide)
- Supports all invoice states and payment tracking

### 3. **Navigation Integration**
- Added **Sales Management** link to sidebar under Sales section
- Available across all pages via shared layout
- Preserves existing **Invoices** link for document creation

### 4. **Database Enhancements**

#### New Columns (via migrations)
```sql
invoices.invoice_date  # Explicit date field for accurate reporting
```

#### New Indexes
```sql
idx_invoices_date      # Speeds up date-range queries for analytics
```

Migration file: `migrations/2025-11-30_sales_enhancements.sql`

## How It Connects to Existing Features

### Invoice Generation (index.html)
- **No Changes Required** - Your existing invoice editor works exactly the same
- Sales dashboard reads from the same `invoices` table
- PDF generation and inventory deduction remain unchanged
- Customer autocomplete integrates seamlessly

### Inventory Management
- Invoice line items continue to deduct from `products.current_quantity`
- Stock status badges (OK/Low/Out) still appear during invoice creation
- Sales dashboard revenue calculations include all invoiced products

### Customer Management
- Top Customers tab pulls data from existing `customers` table
- Customer balances (`outstanding_balance`, `credit_limit`) displayed
- Clicking customer names can navigate to customer details page

### Expenses & Dashboard
- Main dashboard continues showing high-level sales metrics
- Sales Management provides drill-down detail and filtering
- Expenses tracking remains separate under Accounting section

## Migration Steps

### 1. Run Database Migration
```sql
-- In your Neon console, run:
-- File: migrations/2025-11-30_sales_enhancements.sql

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

UPDATE public.invoices
SET invoice_date = created_at::DATE
WHERE invoice_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date DESC);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;

COMMIT;
```

### 2. Deploy to Vercel
The new `api/invoices.js` function is already configured in `vercel.json`:
```bash
git push orgin main
# Vercel auto-deploys
```

### 3. Test
1. Navigate to `/sales.html`
2. Verify metrics load correctly
3. Check charts render (requires existing invoice data)
4. Test invoice filters and search
5. Confirm customer rankings display

## Usage Examples

### Creating an Invoice (Existing Flow)
1. Go to Invoices page (`/index.html`)
2. Click "New" or navigate to editor
3. Fill customer, line items, totals
4. Click "Download PDF" → generates PDF + updates inventory
5. Invoice is automatically saved and appears in Sales dashboard

### Analyzing Revenue
1. Go to Sales Management (`/sales.html`)
2. View current month revenue in stat cards
3. Check 6-month trend chart for growth patterns
4. Filter invoices by status to see pending payments
5. Review Top Customers to prioritize follow-ups

### Tracking Payments
1. Navigate to Payments tab in Sales dashboard
2. Set date range filters (start/end dates)
3. Click "Filter" to see payments in that period
4. Review payment methods and transaction references
5. Cross-reference invoice numbers with main invoice list

## API Integration Examples

### Fetch Invoices with Filters
```javascript
// Get all paid invoices from this month
const invoices = await ApiClient.getInvoices({
  status: 'paid',
  startDate: '2025-11-01',
  endDate: '2025-11-30'
});

// Search invoices by customer name
const results = await ApiClient.getInvoices({
  search: 'TechCorp'
});

// Paginate results
const page2 = await ApiClient.getInvoices({
  offset: 50,
  limit: 50
});
```

### Create Invoice Programmatically
```javascript
const newInvoice = await ApiClient.createInvoice({
  customerId: 123,
  invoiceData: { /* PDF/display data */ },
  subtotal: 10000,
  taxAmount: 1500,
  discountAmount: 500,
  shippingAmount: 200,
  totalAmount: 11200,
  status: 'sent',
  dueDate: '2025-12-15',
  notes: 'Net 30 payment terms'
});
// Auto-assigns invoice number: INV-00042
```

### Update Invoice Status
```javascript
// Mark as paid
await ApiClient.updateInvoice(42, {
  status: 'paid',
  paidAmount: 11200
});

// Partial update (only status)
await ApiClient.updateInvoice(42, {
  status: 'overdue'
});
```

## Architecture Notes

### Preserved Features
✅ Invoice PDF generation (unchanged)  
✅ Inventory deduction on PDF creation (unchanged)  
✅ Customer autocomplete (unchanged)  
✅ Product search and stock badges (unchanged)  
✅ Dashboard overview metrics (unchanged)  
✅ Expenses tracking (unchanged)  
✅ Purchase orders (unchanged)  

### New Capabilities
➕ Unified invoices API with filtering  
➕ Revenue trend visualization  
➕ Payment status analytics  
➕ Customer ranking by revenue  
➕ Invoice search and status filtering  
➕ Date-based reporting  
➕ Payment history tracking  

### Future Enhancements (Ready for)
🔜 Quotation conversion to invoice  
🔜 Recurring invoice templates  
🔜 Payment gateway integration  
🔜 Email invoice delivery  
🔜 Custom invoice numbering schemes  
🔜 Multi-currency support  
🔜 Sales forecasting AI  

## Troubleshooting

### Charts Not Showing
- **Cause**: No invoice data in database yet
- **Fix**: Create a few test invoices via the editor
- **Note**: Charts require at least 1 invoice to render

### Revenue Stats Show Zero
- **Cause**: Invoice dates are in different months or missing `invoice_date`
- **Fix**: Run migration to populate `invoice_date` from `created_at`
- **Check**: Verify invoices have `invoice_date` set

### API 401 Errors
- **Cause**: Not authenticated or token expired
- **Fix**: Log out and log back in to refresh JWT
- **Note**: Tokens expire after 7 days

### Invoices Not Appearing
- **Cause**: Wrong user context or database migration not run
- **Fix**: Ensure logged-in user matches invoice `user_id`
- **Check**: Run `SELECT * FROM invoices WHERE user_id = 1` in Neon

## Performance Notes

- Indexes added for fast date-range queries
- Pagination defaults to 50 records per page
- Charts load in parallel with stats for speed
- Customer analytics pre-aggregates on frontend (no extra API calls)

## Security

- All endpoints require JWT authentication
- User isolation enforced (can only see own invoices)
- SQL injection prevention via parameterized queries
- CORS headers configured for cross-origin safety

---

## Summary

The Sales Management module provides professional-grade revenue tracking and customer analytics **without changing any existing workflows**. Your team can continue creating invoices, managing inventory, and tracking expenses exactly as before, while gaining powerful new insights into sales performance and customer behavior.

**Key Benefit**: Turn your invoice system into a complete sales intelligence platform with zero disruption to day-to-day operations.
