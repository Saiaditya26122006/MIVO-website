-- Fix RLS Policy to Allow Your Admin Email
-- Run this in Supabase SQL Editor

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Admins have full access to products" ON products;
DROP POLICY IF EXISTS "Admins have full access to variants" ON product_variants;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all quotes" ON custom_quotes;

-- Create new policies that work with ANY authenticated user
-- (You can restrict this later to specific emails if needed)

-- Products: Allow all authenticated users full access
CREATE POLICY "Authenticated users have full access to products" ON products
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Product Variants: Allow all authenticated users
CREATE POLICY "Authenticated users have full access to variants" ON product_variants
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Orders: Allow all authenticated users to view
CREATE POLICY "Authenticated users can view orders" ON orders
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create orders" ON orders
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Order Items: Allow all authenticated users
CREATE POLICY "Authenticated users can manage order items" ON order_items
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Custom Quotes: Already has public insert, add admin view
CREATE POLICY "Authenticated users can view quotes" ON custom_quotes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update quotes" ON custom_quotes
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verify policies are active
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;
