-- Consolidated schema sync for Invoicify ERP (idempotent)
-- Apply in Neon/PostgreSQL to align live DB with API expectations

BEGIN;

-- ===== EXPENSES =====
-- 1) Rename category_id -> expense_category_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='expense_category_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.expenses RENAME COLUMN category_id TO expense_category_id';
  END IF;
END $$;

-- 2) Ensure expense_category_id column exists
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category_id INTEGER;

-- 3) Ensure supplier_id present
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER;

-- 4) payment_type -> payment_method (preserve values)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='payment_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='payment_method'
  ) THEN
    EXECUTE 'ALTER TABLE public.expenses RENAME COLUMN payment_type TO payment_method';
  END IF;
END $$;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- 5) Ensure other expected columns exist (nullable for safety)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expense_date DATE,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 6) Basic helpful indexes (no-ops if already exist)
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON public.expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- ===== PRODUCTS =====
-- category_id -> product_category_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='product_category_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.products RENAME COLUMN category_id TO product_category_id';
  END IF;
END $$;

-- quantity -> current_quantity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='quantity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='current_quantity'
  ) THEN
    EXECUTE 'ALTER TABLE public.products RENAME COLUMN quantity TO current_quantity';
  END IF;
END $$;

-- low_stock_threshold -> stock_threshold
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='low_stock_threshold'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='stock_threshold'
  ) THEN
    EXECUTE 'ALTER TABLE public.products RENAME COLUMN low_stock_threshold TO stock_threshold';
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_category_id INTEGER,
  ADD COLUMN IF NOT EXISTS current_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_threshold INTEGER DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(product_category_id);

-- ===== CUSTOMERS / SUPPLIERS / PURCHASE_ORDERS =====
-- Ensure notes columns exist (some early DBs may miss these)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;
