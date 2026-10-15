-- ============================================================================
-- MIVO RLS Security Remediation - SECURE VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Security: Non-recursive admin check, proper function security, idempotent
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (Run this section first, separately)
-- ============================================================================
-- DO NOT SKIP: Run these queries BEFORE executing the main migration

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

-- Preflight 2: List all existing RLS policies
SELECT
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- Preflight 3: Verify no admin_users table exists yet
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'admin_users'
) as admin_table_already_exists;

-- Expected: false
-- If true: Check if migration was partially run (see recovery section)

-- Preflight 4: Count records in each table
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_variants) as variants_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;

-- Preflight 5: Check existing table grants
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- Document these grants - they should remain unchanged after migration

-- ============================================================================
-- MAIN MIGRATION (Run only after preflight verification passes)
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

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

COMMENT ON TABLE admin_users IS 'Admin designation allowlist. Only service role can INSERT/UPDATE/DELETE.';

-- Enable RLS on admin_users (protection layer)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- No policies on admin_users yet - will add after function creation

-- ----------------------------------------------------------------------------
-- Step 2: Create SECURITY DEFINER function for admin check
-- ----------------------------------------------------------------------------
-- This function is the ONLY way to check admin status
-- It uses SECURITY DEFINER to bypass RLS when querying admin_users
-- Search path locked to prevent function hijacking

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Direct query to admin_users, bypasses RLS via SECURITY DEFINER
  -- Returns true if current user's UID is in admin_users table
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Restrict function execution to authenticated users only
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user is admin. SECURITY DEFINER bypasses RLS on admin_users.';

-- ----------------------------------------------------------------------------
-- Step 3: Add RLS policy to admin_users using the secure function
-- ----------------------------------------------------------------------------
-- Now we can safely add policy using is_admin() function
-- This is NOT recursive because is_admin() bypasses RLS via SECURITY DEFINER

DROP POLICY IF EXISTS "admin_users_read" ON admin_users;
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies = only service_role can modify

-- ----------------------------------------------------------------------------
-- Step 4: Insert initial admin user (BEFORE dropping permissive policies)
-- ----------------------------------------------------------------------------
-- ⚠️ CRITICAL: Replace email with actual admin email before running

INSERT INTO admin_users (user_id, notes)
SELECT
  id,
  'Initial admin - migrated 2026-10-15'
FROM auth.users
WHERE email = 'admin@mivo.in' -- ← ⚠️ CHANGE THIS
ON CONFLICT (user_id) DO NOTHING;

-- Verify admin was inserted (abort if not found)
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: No admin user found. Check email in Step 4.';
  END IF;
  RAISE NOTICE 'Admin user(s) inserted: %', admin_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 5: Drop all unsafe permissive policies
-- ----------------------------------------------------------------------------

-- Drop the five unsafe authenticated_full_access_* policies
DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;
DROP POLICY IF EXISTS "authenticated_full_access_variants" ON product_variants;
DROP POLICY IF EXISTS "authenticated_full_access_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_full_access_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_full_access_quotes" ON custom_quotes;

-- Drop any other permissive admin policies that may exist
DROP POLICY IF EXISTS "Admins have full access to products" ON products;
DROP POLICY IF EXISTS "Admins have full access to variants" ON product_variants;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all quotes" ON custom_quotes;

-- Drop potential duplicate public policies to ensure clean slate
DROP POLICY IF EXISTS "Anyone can submit quotes" ON custom_quotes;

-- ----------------------------------------------------------------------------
-- Step 6: Create restrictive policies for PRODUCTS
-- ----------------------------------------------------------------------------

-- PUBLIC: Read published products only
DROP POLICY IF EXISTS "public_select_published_products" ON products;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- ADMIN: Full access to all products
DROP POLICY IF EXISTS "admin_select_products" ON products;
CREATE POLICY "admin_select_products" ON products
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_products" ON products;
CREATE POLICY "admin_insert_products" ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_products" ON products;
CREATE POLICY "admin_update_products" ON products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 7: Create restrictive policies for PRODUCT_VARIANTS
-- ----------------------------------------------------------------------------

-- PUBLIC: Read all variants (required for product detail pages)
DROP POLICY IF EXISTS "public_select_variants" ON product_variants;
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ADMIN: Mutations only
DROP POLICY IF EXISTS "admin_insert_variants" ON product_variants;
CREATE POLICY "admin_insert_variants" ON product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_variants" ON product_variants;
CREATE POLICY "admin_update_variants" ON product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_variants" ON product_variants;
CREATE POLICY "admin_delete_variants" ON product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 8: Create restrictive policies for ORDERS
-- ----------------------------------------------------------------------------
-- Note: Orders currently go through WhatsApp only (not persisted to database)

DROP POLICY IF EXISTS "admin_select_orders" ON orders;
CREATE POLICY "admin_select_orders" ON orders
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_orders" ON orders;
CREATE POLICY "admin_insert_orders" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_orders" ON orders;
CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_orders" ON orders;
CREATE POLICY "admin_delete_orders" ON orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 9: Create restrictive policies for ORDER_ITEMS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "admin_select_order_items" ON order_items;
CREATE POLICY "admin_select_order_items" ON order_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_order_items" ON order_items;
CREATE POLICY "admin_insert_order_items" ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_order_items" ON order_items;
CREATE POLICY "admin_update_order_items" ON order_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_order_items" ON order_items;
CREATE POLICY "admin_delete_order_items" ON order_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 10: Create restrictive policies for CUSTOM_QUOTES
-- ----------------------------------------------------------------------------

-- PUBLIC: Insert quotes only (anyone can submit)
DROP POLICY IF EXISTS "public_insert_quotes" ON custom_quotes;
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ADMIN: Read, update, delete only
DROP POLICY IF EXISTS "admin_select_quotes" ON custom_quotes;
CREATE POLICY "admin_select_quotes" ON custom_quotes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_quotes" ON custom_quotes;
CREATE POLICY "admin_update_quotes" ON custom_quotes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_quotes" ON custom_quotes;
CREATE POLICY "admin_delete_quotes" ON custom_quotes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 11: Final verification before commit
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  policy_count INTEGER;
  admin_count INTEGER;
  unsafe_policy_count INTEGER;
BEGIN
  -- Verify admin_users is populated
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No admin users in admin_users table';
  END IF;

  -- Verify policies created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND (policyname LIKE 'admin_%' OR policyname LIKE 'public_%');

  IF policy_count < 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected at least 22 policies, found %', policy_count;
  END IF;

  -- Verify no unsafe policies remain
  SELECT COUNT(*) INTO unsafe_policy_count
  FROM pg_policies
  WHERE policyname LIKE '%authenticated_full_access%';

  IF unsafe_policy_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % unsafe policies still present', unsafe_policy_count;
  END IF;

  RAISE NOTICE '✅ Migration verification passed';
  RAISE NOTICE '   Admin users: %', admin_count;
  RAISE NOTICE '   Policies created: %', policy_count;
  RAISE NOTICE '   Unsafe policies removed: verified';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run immediately after migration)
-- ============================================================================

-- Postflight 1: Verify admin_users table created and populated
SELECT * FROM admin_users ORDER BY granted_at;
-- Expected: 1+ rows with your admin user_id

-- Postflight 2: Verify is_admin() function exists and works
SELECT
  proname,
  prosecdef as is_security_definer,
  provolatile as volatility
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row, is_security_definer = true, volatility = 's' (stable)

-- Postflight 3: Verify function permissions
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'is_admin'
  AND routine_schema = 'public'
ORDER BY grantee;
-- Expected: Only 'authenticated' has EXECUTE privilege

-- Postflight 4: Test is_admin() function (as admin user)
SELECT public.is_admin() as am_i_admin;
-- Expected: true (if signed in as admin)
-- Expected: false (if not admin or not signed in)

-- Postflight 5: Verify all unsafe policies are GONE
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%authenticated_full_access%';
-- Expected: 0 rows

-- Postflight 6: Verify admin policies use is_admin() function
SELECT
  tablename,
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as check_clause
FROM pg_policies
WHERE policyname LIKE 'admin_%'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, cmd, policyname;
-- Expected: All USING and WITH CHECK clauses contain 'is_admin()'

-- Postflight 7: Verify public read access preserved
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE policyname LIKE 'public_%'
ORDER BY tablename, policyname;
-- Expected: 3 policies:
--   products: public_select_published_products (SELECT)
--   product_variants: public_select_variants (SELECT)
--   custom_quotes: public_insert_quotes (INSERT)

-- Postflight 8: Verify no permissive USING (true) for authenticated (except public SELECT)
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text
  AND cmd NOT IN ('SELECT', 'INSERT'); -- Exclude legitimate public policies
-- Expected: 0 rows

-- Postflight 9: Verify record counts unchanged
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_variants) as variants_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;
-- Expected: Same counts as preflight

-- Postflight 10: Verify table grants unchanged
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;
-- Expected: Same grants as preflight (RLS alone doesn't grant table access)

-- Postflight 11: Full policy overview
SELECT
  tablename,
  policyname,
  cmd,
  roles::text,
  CASE
    WHEN qual::text LIKE '%is_admin()%' THEN 'Admin Only (via function)'
    WHEN qual::text LIKE '%published%' THEN 'Published Products'
    WHEN qual::text = 'true' THEN 'Public'
    ELSE 'Custom'
  END as access_level,
  permissive
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- ROLLBACK PROCEDURE (If migration fails or needs reversal)
-- ============================================================================

-- ⚠️ WARNING: DO NOT restore unsafe authenticated_full_access_* policies
-- ⚠️ If rollback needed, restore ONLY public read access

-- Option 1: Fix forward (preferred)
-- If admin access broken:
/*
BEGIN;
-- Use service role (via Supabase Dashboard SQL Editor)
INSERT INTO admin_users (user_id, notes)
SELECT id, 'Emergency admin restoration'
FROM auth.users
WHERE email = 'your-actual-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
COMMIT;
*/

-- Option 2: Restore public access only (if storefront broken)
/*
BEGIN;
DROP POLICY IF EXISTS "public_select_published_products" ON products;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "public_select_variants" ON product_variants;
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_insert_quotes" ON custom_quotes;
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
COMMIT;
*/

-- Option 3: Full rollback (last resort - requires database restore)
-- Restore from backup taken before migration
-- DO NOT manually restore unsafe policies

-- ============================================================================
-- ADMIN MANAGEMENT (After successful migration)
-- ============================================================================

-- Add new admin (requires service role key)
/*
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  (SELECT id FROM auth.users WHERE email = 'newadmin@example.com'),
  (SELECT id FROM auth.users WHERE email = 'current-admin@example.com'),
  'Added by admin on 2026-10-15';
*/

-- Remove admin (requires service role key)
/*
DELETE FROM admin_users
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oldadmin@example.com');
*/

-- List all admins
/*
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  granter.email as granted_by_email,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
LEFT JOIN auth.users granter ON granter.id = au.granted_by
ORDER BY au.granted_at;
*/

-- Check if specific user is admin
/*
SELECT public.is_admin() as am_i_admin;
-- Or check specific user (as service role):
SELECT EXISTS (
  SELECT 1 FROM admin_users
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com')
) as is_admin;
*/
