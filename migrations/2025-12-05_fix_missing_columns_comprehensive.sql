-- Comprehensive fix for missing columns in invoices table
-- This ensures all required columns for the sales module exist

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_data JSONB DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Update invoice_date for existing records if null
UPDATE invoices SET invoice_date = created_at::DATE WHERE invoice_date IS NULL;
