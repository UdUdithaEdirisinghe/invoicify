-- Fix missing columns in invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_data JSONB DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;
