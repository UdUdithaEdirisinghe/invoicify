-- Invoicify Database Schema
-- Run this SQL in your Neon database console

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings table for cross-device sync
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  address TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'LKR',
  theme_color VARCHAR(7) DEFAULT '#2563eb',
  logo_url TEXT,
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_no VARCHAR(100),
  show_bank_details BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  invoice_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory management
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    description TEXT,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in','out','adjust')),
    quantity INT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_user ON inventory_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);

-- Auto-update updated_at on products
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Maintain product.quantity from movements
CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE products SET quantity = quantity + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE products SET quantity = quantity - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjust' THEN
    UPDATE products SET quantity = NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Optional: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE
    ON invoices FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
