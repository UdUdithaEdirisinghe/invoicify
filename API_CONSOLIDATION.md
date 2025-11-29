# API Consolidation - Vercel Hobby Plan

## Problem
Vercel Hobby plan limits deployments to 12 serverless functions. The original structure had 18+ separate endpoint files.

## Solution
Consolidated related endpoints into resource-based serverless functions that handle multiple HTTP methods (GET, POST, PUT, DELETE).

## New API Structure (10 Functions Total)

### 1. `/api/auth.js`
- `POST /api/auth?action=register` - User registration
- `POST /api/auth?action=login` - User login  
- `POST /api/auth?action=me` - Get current user

### 2. `/api/customers.js`
- `GET /api/customers` - List all customers (with search, status filters)
- `GET /api/customers?id={id}` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers?id={id}` - Update customer
- `DELETE /api/customers?id={id}` - Delete customer

### 3. `/api/suppliers.js`
- `GET /api/suppliers` - List all suppliers (with search, status filters)
- `GET /api/suppliers?id={id}` - Get single supplier
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers?id={id}` - Update supplier
- `DELETE /api/suppliers?id={id}` - Delete supplier

### 4. `/api/expenses.js`
- `GET /api/expenses` - List expenses (with date range, category, status filters)
- `GET /api/expenses?id={id}` - Get single expense
- `POST /api/expenses` - Create expense
- `PUT /api/expenses?id={id}` - Update expense
- `DELETE /api/expenses?id={id}` - Delete expense
- `GET /api/expenses?categories=true` - List expense categories
- `POST /api/expenses?categories=true` - Create expense category
- `DELETE /api/expenses?categories=true&id={id}` - Delete expense category

### 5. `/api/products.js`
- `GET /api/products` - List products (with search, category filters)
- `GET /api/products?id={id}` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products?id={id}` - Update product
- `DELETE /api/products?id={id}` - Delete product
- `GET /api/products?categories=true` - List product categories
- `POST /api/products?categories=true` - Create product category
- `DELETE /api/products?categories=true&id={id}` - Delete product category

### 6. `/api/purchase-orders.js`
- `GET /api/purchase-orders` - List POs (with search, status, supplier filters)
- `GET /api/purchase-orders?id={id}` - Get single PO with line items
- `POST /api/purchase-orders` - Create PO with line items (transaction)
- `PUT /api/purchase-orders?id={id}` - Update PO and line items (transaction)
- `DELETE /api/purchase-orders?id={id}` - Delete PO (cascades to line items)

### 7. `/api/health.js` (existing)
- Health check endpoint

### 8. `/api/invoices.js` (existing)
- Invoice CRUD operations

### 9. `/api/settings.js` (existing)
- User settings management

### 10. `/api/payments.js` (existing)
- Payment tracking

## Benefits

✅ **Under Function Limit**: 10 functions vs 12 limit (2 functions to spare)
✅ **RESTful Design**: Standard HTTP methods per resource
✅ **Better Organization**: Related operations grouped together
✅ **Reduced Latency**: Fewer cold starts for related operations
✅ **Easier Maintenance**: Single file per resource type
✅ **Transaction Support**: Complex operations (PO with line items) in single function

## Frontend Updates

Updated `js/api-client.js` to use consolidated endpoints:
- Auth methods now use query parameters for actions
- Category endpoints use `?categories=true` parameter
- All CRUD methods use standard HTTP verbs
- Consistent error handling across all endpoints

## Database Transactions

Functions requiring transactions (like purchase orders with line items) use PostgreSQL client pooling with proper BEGIN/COMMIT/ROLLBACK handling.

## Deployment

Simply push to GitHub - Vercel will:
1. Detect the 10 serverless functions in `/api`
2. Build and deploy all functions
3. Apply CORS headers from `vercel.json`
4. Handle routing automatically

No additional configuration needed!
