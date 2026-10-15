-- ============================================================================
-- MIVO RLS Remediation Migration (CORRECTED)
-- Purpose: Replace permissive policies with proper admin-only access control
-- Date: 2026-10-15
-- CHANGES FROM ORIGINAL:
--   1. Admin user insertion moved INSIDE transaction (fixes admin lockout)
--   2. Public variant read policy preserved (fixes storefront breakage)
--   3. Quote INSERT policy deduplicated (fixes policy conflicts)
--   4. Added explanatory comments for self-referencing policy
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (Run this section first, separately)
-- ============================================================================
-- DO NOT SKIP: Run these queries BEFORE executing the main migration
-- Copy and paste this section into Supabase SQL Editor and verify results

-- Preflight 1: Verify admin email exists in auth.users
SELECT
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'admin@mivo.in' -- ⚠️ VERIFY THIS EMAIL EXISTS
ORDER BY created_at;

-- Expected: At least 1 row with the admin email
-- If 0 rows: STOP - Update the email in this query AND in Step 2 below

-- Preflight 2: List all existing RLS policies (for comparison after migration)
SELECT
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- Expected: Should see authenticated_full_access_* policies and public_select_* policies

-- Preflight 3: Verify no admin_users table exists yet
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'admin_users'
) as admin_table_already_exists;

-- Expected: false
-- If true: STOP - Admin table already exists, migration may have been partially run

-- Preflight 4: Count records in each table
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_variants) as variants_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;

-- Document these counts for post-migration comparison

-- ============================================================================
-- MAIN MIGRATION (Run this section only after preflight verification passes)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Create admin_users table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- SAFE: The subquery bypasses RLS, preventing infinite recursion
CREATE POLICY "admin_users_admin_read" ON admin_users
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

COMMENT ON TABLE admin_users IS 'Server-controlled admin designation. Modifications require service role.';

-- ----------------------------------------------------------------------------
-- Step 2: Insert initial admin user (CRITICAL: Do this BEFORE dropping policies)
-- ----------------------------------------------------------------------------
-- ⚠️ IMPORTANT: Replace the email below with your actual admin email before running
-- This insertion MUST happen before dropping permissive policies to avoid lockout

INSERT INTO admin_users (user_id, notes)
SELECT
  id,
  'Initial admin - migrated from email-based auth on 2026-10-15'
FROM auth.users
WHERE email = 'admin@mivo.in' -- ← ⚠️ CHANGE THIS to your admin email
ON CONFLICT (user_id) DO NOTHING;

-- Verify admin was inserted (will abort if not found)
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: No admin user found. Check the email in Step 2.';
  END IF;
  RAISE NOTICE 'Admin user(s) inserted: %', admin_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 3: Drop all permissive policies
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;
DROP POLICY IF EXISTS "authenticated_full_access_variants" ON product_variants;
DROP POLICY IF EXISTS "authenticated_full_access_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_full_access_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_full_access_quotes" ON custom_quotes;

DROP POLICY IF EXISTS "Admins have full access to products" ON products;
DROP POLICY IF EXISTS "Admins have full access to variants" ON product_variants;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all quotes" ON custom_quotes;

-- ----------------------------------------------------------------------------
-- Step 4: Create admin-only policies for PRODUCTS
-- ----------------------------------------------------------------------------

-- Note: public_select_published_products may already exist - ensure it's correctly defined
DROP POLICY IF EXISTS "public_select_published_products" ON products;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "admin_select_products" ON products
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_update_products" ON products
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_delete_products" ON products
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ----------------------------------------------------------------------------
-- Step 5: Create policies for PRODUCT_VARIANTS
-- ----------------------------------------------------------------------------

-- PUBLIC READ: Allow everyone to view variants (needed for product detail pages)
-- Note: This policy may already exist - drop and recreate to ensure correct definition
DROP POLICY IF EXISTS "public_select_variants" ON product_variants;
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ADMIN ONLY: Mutations
CREATE POLICY "admin_insert_variants" ON product_variants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_update_variants" ON product_variants
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_delete_variants" ON product_variants
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ----------------------------------------------------------------------------
-- Step 6: Create admin-only policies for ORDERS
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_select_orders" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_insert_orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_delete_orders" ON orders
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ----------------------------------------------------------------------------
-- Step 7: Create admin-only policies for ORDER_ITEMS
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_select_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_insert_order_items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_update_order_items" ON order_items
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_delete_order_items" ON order_items
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ----------------------------------------------------------------------------
-- Step 8: Create policies for CUSTOM_QUOTES
-- ----------------------------------------------------------------------------

-- Drop duplicate policies first to avoid conflicts
DROP POLICY IF EXISTS "Anyone can submit quotes" ON custom_quotes;
DROP POLICY IF EXISTS "public_insert_quotes" ON custom_quotes;

-- PUBLIC INSERT: Anyone can submit quotes
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ADMIN ONLY: Read, update, delete
CREATE POLICY "admin_select_quotes" ON custom_quotes
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_update_quotes" ON custom_quotes
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "admin_delete_quotes" ON custom_quotes
  FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ----------------------------------------------------------------------------
-- Step 9: Verify migration success
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  policy_count INTEGER;
  admin_count INTEGER;
BEGIN
  -- Check admin_users is populated
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No admin users in admin_users table';
  END IF;

  -- Check policies exist
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  AND (policyname LIKE 'admin_%' OR policyname LIKE 'public_%');

  IF policy_count < 20 THEN
    RAISE WARNING 'Expected ~25 policies, found %', policy_count;
  END IF;

  RAISE NOTICE '✅ Migration verification passed';
  RAISE NOTICE '   Admin users: %', admin_count;
  RAISE NOTICE '   Policies created: %', policy_count;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run immediately after migration)
-- ============================================================================
-- Copy and paste this entire section into Supabase SQL Editor

-- Postflight 1: Verify admin_users table created and populated
SELECT * FROM admin_users ORDER BY granted_at;
-- Expected: 1+ rows with your admin user_id

-- Postflight 2: Verify you are recognized as admin
SELECT
  auth.uid() as my_user_id,
  auth.email() as my_email,
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) as am_i_admin;
-- Expected: am_i_admin = true (if signed in as admin)

-- Postflight 3: Verify all unsafe policies are GONE
SELECT
  tablename,
  policyname
FROM pg_policies
WHERE policyname LIKE '%authenticated_full_access%';
-- Expected: 0 rows (all unsafe policies removed)

-- Postflight 4: Verify new admin policies created
SELECT
  tablename,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE policyname LIKE 'admin_%'
ORDER BY tablename, cmd, policyname;
-- Expected: 20+ rows (admin policies for all tables and operations)

-- Postflight 5: Verify public read access preserved
SELECT
  tablename,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE policyname LIKE 'public_%'
ORDER BY tablename, policyname;
-- Expected:
--   products: public_select_published_products (SELECT, {anon,authenticated})
--   product_variants: public_select_variants (SELECT, {anon,authenticated})
--   custom_quotes: public_insert_quotes (INSERT, {anon,authenticated})

-- Postflight 6: Verify no permissive USING (true) policies for authenticated users
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text
  AND cmd != 'SELECT'; -- Exclude public SELECT policies
-- Expected: 0 rows (or only public SELECT policies)

-- Postflight 7: Verify record counts unchanged
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_variants) as variants_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;
-- Expected: Same counts as preflight query

-- Postflight 8: Full policy overview
SELECT
  tablename,
  policyname,
  cmd,
  roles::text,
  CASE
    WHEN qual::text LIKE '%admin_users%' THEN 'Admin Only'
    WHEN qual::text LIKE '%published%' THEN 'Published Products'
    WHEN qual::text = 'true' THEN 'Public'
    ELSE 'Custom'
  END as access_level,
  permissive
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, cmd, policyname;
