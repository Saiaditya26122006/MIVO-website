-- Comprehensive Fix for Product Update Issues
-- Run this in Supabase SQL Editor to fix all permission problems

-- STEP 1: Drop all existing policies (clean slate)
DO $$
BEGIN
    -- Drop products policies
    DROP POLICY IF EXISTS "Public can view published products" ON products;
    DROP POLICY IF EXISTS "Admins have full access to products" ON products;
    DROP POLICY IF EXISTS "Authenticated users have full access to products" ON products;

    -- Drop product_variants policies
    DROP POLICY IF EXISTS "Public can view product variants" ON product_variants;
    DROP POLICY IF EXISTS "Admins have full access to variants" ON product_variants;
    DROP POLICY IF EXISTS "Authenticated users have full access to variants" ON product_variants;

    -- Drop orders policies
    DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
    DROP POLICY IF EXISTS "Authenticated users can view orders" ON orders;
    DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

    -- Drop order_items policies
    DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
    DROP POLICY IF EXISTS "Authenticated users can manage order items" ON order_items;

    -- Drop custom_quotes policies
    DROP POLICY IF EXISTS "Admins can view all quotes" ON custom_quotes;
    DROP POLICY IF EXISTS "Anyone can submit quotes" ON custom_quotes;
    DROP POLICY IF EXISTS "Authenticated users can view quotes" ON custom_quotes;
    DROP POLICY IF EXISTS "Authenticated users can update quotes" ON custom_quotes;
END $$;

-- STEP 2: Create comprehensive policies

-- PRODUCTS TABLE
-- Allow public to SELECT published products
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  USING (published = true);

-- Allow authenticated users FULL ACCESS (INSERT, SELECT, UPDATE, DELETE)
CREATE POLICY "authenticated_full_access_products" ON products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- PRODUCT_VARIANTS TABLE (if exists)
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT
  USING (true);

CREATE POLICY "authenticated_full_access_variants" ON product_variants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ORDERS TABLE
CREATE POLICY "authenticated_full_access_orders" ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ORDER_ITEMS TABLE
CREATE POLICY "authenticated_full_access_order_items" ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CUSTOM_QUOTES TABLE
-- Allow anyone to submit quotes (INSERT)
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to view and manage all quotes
CREATE POLICY "authenticated_full_access_quotes" ON custom_quotes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- STEP 3: Verify policies are in place
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- STEP 4: Test update capability (replace with your product ID)
-- Uncomment the line below and replace 'your-product-id-here' with an actual product ID to test
-- UPDATE products SET description = description WHERE id = 'your-product-id-here';

-- Success message
SELECT 'RLS policies updated successfully! Authenticated users now have full access.' as status;
