-- Sales Management Enhancement Migration
-- Add invoice_date column and improve sales tracking

BEGIN;

-- Add invoice_date to invoices table if not exists
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- Set invoice_date from created_at for existing records
UPDATE public.invoices
SET invoice_date = created_at::DATE
WHERE invoice_date IS NULL;

-- Add index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date DESC);

-- Ensure all other necessary columns exist
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;

COMMIT;
