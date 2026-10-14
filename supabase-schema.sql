-- MIVO Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  model_file TEXT, -- STL file path in storage
  preview_image TEXT, -- Generated preview thumbnail
  in_stock BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  specifications JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2),
  attributes JSONB NOT NULL,
  sku TEXT,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  shipping_address JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom quote requests table
CREATE TABLE IF NOT EXISTS custom_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_description TEXT NOT NULL,
  application TEXT,
  quantity INTEGER,
  dimensions TEXT,
  material TEXT,
  deadline TEXT,
  attachments TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories view (materialized from products)
CREATE OR REPLACE VIEW categories AS
SELECT
  category as id,
  category as name,
  LOWER(REPLACE(category, ' ', '-')) as slug,
  COUNT(*)::INTEGER as product_count
FROM products
WHERE published = true
GROUP BY category;

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_quotes ENABLE ROW LEVEL SECURITY;

-- Public read access for published products
CREATE POLICY "Public can view published products" ON products
  FOR SELECT USING (published = true);

CREATE POLICY "Public can view product variants" ON product_variants
  FOR SELECT USING (true);

-- Admin full access (requires auth.uid() to be set)
CREATE POLICY "Admins have full access to products" ON products
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

CREATE POLICY "Admins have full access to variants" ON product_variants
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

CREATE POLICY "Admins can view all order items" ON order_items
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

CREATE POLICY "Admins can view all quotes" ON custom_quotes
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

CREATE POLICY "Anyone can submit quotes" ON custom_quotes
  FOR INSERT WITH CHECK (true);

-- Storage buckets (create these in Supabase Dashboard > Storage)
-- Bucket: 'product-images' (public)
-- Bucket: 'product-models' (private, requires auth)
-- Bucket: 'product-stl-files' (private, requires auth for original manufacturing files)

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_published ON products(published);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_custom_quotes_status ON custom_quotes(status);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_quotes_updated_at BEFORE UPDATE ON custom_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
