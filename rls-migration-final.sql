-- ============================================================================
-- MIVO RLS Security Remediation - FINAL SECURE VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Status: AWAITING APPROVAL - DO NOT EXECUTE WITHOUT VERIFICATION
--
-- Security: Non-recursive admin check, column-level restrictions, comprehensive
-- validation, proper function security, full idempotency
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (MANDATORY - Run this section first, separately)
-- ============================================================================
-- DO NOT SKIP: Run ALL queries below BEFORE executing the main migration
-- Copy and paste this entire section into Supabase SQL Editor

-- Preflight 1: List ALL existing auth users (identify actual admin email)
SELECT
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users
ORDER BY created_at;

-- ⚠️ CRITICAL: Identify which email should be admin
-- Update the email in Step 5 of main migration to match your actual admin account

-- Preflight 2: List ALL existing RLS policies (complete inventory)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual::text as using_clause,
  with_check::text as check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: See authenticated_full_access_* policies and public policies
-- Document all policy names for verification after migration

-- Preflight 3: Check for existing admin_users table or is_admin function
SELECT
  'admin_users_table' as object_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) as exists
UNION ALL
SELECT
  'is_admin_function' as object_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) as exists;

-- Expected: Both false (clean slate)
-- If true: Migration was partially run - see recovery section

-- Preflight 4: Verify custom_quotes schema (confirm column-level restrictions needed)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_quotes'
ORDER BY ordinal_position;

-- Document all columns - identify customer-editable vs. admin-only fields

-- Preflight 5: Verify product_variants schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'product_variants'
ORDER BY ordinal_position;

-- Verify no sensitive columns exist (all columns currently safe for public read)

-- Preflight 6: Check table grants (baseline for comparison)
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY table_name, grantee, privilege_type;

-- Document existing grants - migration should NOT change these

-- Preflight 7: Count records in each table
SELECT
  'products' as table_name,
  COUNT(*) as record_count
FROM products
UNION ALL
SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- Document counts for post-migration verification

-- Preflight 8: Test if auth.uid() and auth.jwt() work
SELECT
  auth.uid() as current_user_id,
  auth.jwt() ->> 'email' as current_user_email,
  auth.jwt() ->> 'role' as current_role;

-- Expected: NULL if not signed in, or your UUID/email if signed in
-- Verify these functions are available

-- ============================================================================
-- MAIN MIGRATION (Run only after ALL preflight checks pass)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Create admin_users table (server-controlled allowlist)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  -- Enforce foreign key to auth.users
  CONSTRAINT admin_users_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,
  CONSTRAINT admin_users_granted_by_fkey
    FOREIGN KEY (granted_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

COMMENT ON TABLE admin_users IS
  'Admin designation allowlist. Only service_role can INSERT/UPDATE/DELETE. Users cannot add themselves.';

COMMENT ON COLUMN admin_users.user_id IS
  'References auth.users(id). Admin user UUID.';

COMMENT ON COLUMN admin_users.granted_by IS
  'References auth.users(id). Who granted this admin access (for audit trail).';

-- Enable RLS on admin_users (protection layer)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner (prevents accidental bypass)
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

-- No policies on admin_users yet - will add after function creation

-- ----------------------------------------------------------------------------
-- Step 2: Create SECURITY DEFINER function for admin check (non-recursive)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with creator's privileges (bypasses RLS)
STABLE            -- Result cacheable within transaction
SET search_path = public, pg_temp  -- Locked search path (prevents hijacking)
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
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true if current user is admin. SECURITY DEFINER bypasses RLS on admin_users. Search path locked to prevent hijacking.';

-- ----------------------------------------------------------------------------
-- Step 3: Add RLS policy to admin_users using the secure function
-- ----------------------------------------------------------------------------
-- This is NOT recursive because is_admin() bypasses RLS via SECURITY DEFINER

DROP POLICY IF EXISTS "admin_users_read" ON admin_users;
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies = only service_role can modify

-- ----------------------------------------------------------------------------
-- Step 4: Verify function and table security before proceeding
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  func_exists BOOLEAN;
  func_is_security_definer BOOLEAN;
  table_has_rls BOOLEAN;
  table_force_rls BOOLEAN;
BEGIN
  -- Verify function exists and is SECURITY DEFINER
  SELECT
    COUNT(*) > 0,
    BOOL_OR(prosecdef)
  INTO func_exists, func_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_admin';

  IF NOT func_exists THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() function was not created';
  END IF;

  IF NOT func_is_security_definer THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() function is not SECURITY DEFINER';
  END IF;

  -- Verify admin_users has RLS enabled
  SELECT
    relrowsecurity,
    relforcerowsecurity
  INTO table_has_rls, table_force_rls
  FROM pg_class
  WHERE relname = 'admin_users' AND relnamespace = 'public'::regnamespace;

  IF NOT table_has_rls THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: admin_users RLS not enabled';
  END IF;

  RAISE NOTICE '✅ Security infrastructure verified';
  RAISE NOTICE '   - is_admin() function: SECURITY DEFINER = %', func_is_security_definer;
  RAISE NOTICE '   - admin_users RLS enabled: %', table_has_rls;
  RAISE NOTICE '   - admin_users FORCE RLS: %', table_force_rls;
END $$;

-- ----------------------------------------------------------------------------
-- Step 5: Insert initial admin user (BEFORE dropping permissive policies)
-- ----------------------------------------------------------------------------
-- ⚠️ CRITICAL: Replace 'PLACEHOLDER_EMAIL' with actual admin email from Preflight 1
-- Migration will ABORT if this email doesn't exist or if no admin inserted

INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  id,
  id,  -- Self-granted during migration
  'Initial admin - migrated 2026-10-15 via RLS remediation'
FROM auth.users
WHERE email = 'PLACEHOLDER_EMAIL'  -- ← ⚠️ REPLACE THIS WITH ACTUAL ADMIN EMAIL
ON CONFLICT (user_id) DO NOTHING;

-- Verify admin was inserted (abort if not found)
DO $$
DECLARE
  admin_count INTEGER;
  inserted_email TEXT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM admin_users;

  IF admin_count = 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: No admin user inserted. Check email in Step 5 matches an existing auth.users record from Preflight 1.';
  END IF;

  -- Get the email for logging
  SELECT u.email INTO inserted_email
  FROM admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LIMIT 1;

  RAISE NOTICE '✅ Admin user(s) inserted: % (email: %)', admin_count, inserted_email;
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: Drop ALL unsafe and conflicting policies
-- ----------------------------------------------------------------------------

-- Drop the five unsafe authenticated_full_access_* policies
DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;
DROP POLICY IF EXISTS "authenticated_full_access_variants" ON product_variants;
DROP POLICY IF EXISTS "authenticated_full_access_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_full_access_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_full_access_quotes" ON custom_quotes;

-- Drop legacy email-based admin policies (from original schema)
DROP POLICY IF EXISTS "Admins have full access to products" ON products;
DROP POLICY IF EXISTS "Admins have full access to variants" ON product_variants;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all quotes" ON custom_quotes;

-- Drop potential duplicate public policies
DROP POLICY IF EXISTS "Anyone can submit quotes" ON custom_quotes;

-- Drop ALL existing policies to ensure clean slate (will recreate needed ones)
DROP POLICY IF EXISTS "Public can view published products" ON products;
DROP POLICY IF EXISTS "Public can view product variants" ON product_variants;
DROP POLICY IF EXISTS "public_select_published_products" ON products;
DROP POLICY IF EXISTS "public_select_variants" ON product_variants;
DROP POLICY IF EXISTS "public_insert_quotes" ON custom_quotes;

-- ----------------------------------------------------------------------------
-- Step 7: Create restrictive policies for PRODUCTS
-- ----------------------------------------------------------------------------

-- PUBLIC: Read published products only
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- ADMIN: Full access to all products
CREATE POLICY "admin_select_products" ON products
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_products" ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_products" ON products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_products" ON products
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 8: Create restrictive policies for PRODUCT_VARIANTS
-- ----------------------------------------------------------------------------
-- Note: Current schema has no sensitive columns - all safe for public read
-- Columns: id, product_id, name, price, attributes, sku, in_stock, created_at

-- PUBLIC: Read all variants (required for product detail pages)
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ADMIN: Mutations only
CREATE POLICY "admin_insert_variants" ON product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_variants" ON product_variants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_variants" ON product_variants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 9: Create restrictive policies for ORDERS
-- ----------------------------------------------------------------------------
-- Note: Orders currently go through WhatsApp only (not persisted to database)
-- Schema: id, customer_name, email, phone, shipping_address, subtotal, total, status, created_at, updated_at

-- ADMIN: Full access only
CREATE POLICY "admin_select_orders" ON orders
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_orders" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_orders" ON orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 10: Create restrictive policies for ORDER_ITEMS
-- ----------------------------------------------------------------------------
-- Schema: id, order_id, product_id, variant_id, quantity, price, created_at

-- ADMIN: Full access only
CREATE POLICY "admin_select_order_items" ON order_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_order_items" ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_order_items" ON order_items
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_order_items" ON order_items
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 11: Create restrictive policies for CUSTOM_QUOTES (column-level)
-- ----------------------------------------------------------------------------
-- Schema (from base + migration 003):
-- Customer-editable: customer_name, email, phone, project_description, application,
--                    quantity, dimensions, material, deadline, attachments
-- Admin-only: product_id, custom_dimensions, feasibility_assessment, quote_response,
--             status, id, created_at, updated_at

-- PUBLIC: Insert quotes with column-level restrictions
-- Users can only set customer-editable fields, NOT admin fields
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Require customer name (non-empty)
    customer_name IS NOT NULL
    AND LENGTH(TRIM(customer_name)) > 0
    AND LENGTH(customer_name) <= 200

    -- Require at least one contact method (email or phone)
    AND (
      (email IS NOT NULL AND LENGTH(TRIM(email)) > 0 AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      OR (phone IS NOT NULL AND LENGTH(TRIM(phone)) > 0)
    )

    -- Require project description
    AND project_description IS NOT NULL
    AND LENGTH(TRIM(project_description)) > 0
    AND LENGTH(project_description) <= 5000

    -- Prevent setting admin-only fields during INSERT
    AND product_id IS NULL
    AND custom_dimensions IS NULL
    AND feasibility_assessment IS NULL
    AND quote_response IS NULL

    -- Force status to 'submitted' (or allow NULL which becomes 'submitted' via default)
    AND (status IS NULL OR status = 'submitted')
  );

COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public users can insert quotes but only set customer-editable fields. Admin fields (product_id, custom_dimensions, feasibility_assessment, quote_response, status) are restricted.';

-- ADMIN: Read all quotes
CREATE POLICY "admin_select_quotes" ON custom_quotes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ADMIN: Update quotes (can set any field)
CREATE POLICY "admin_update_quotes" ON custom_quotes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ADMIN: Delete quotes
CREATE POLICY "admin_delete_quotes" ON custom_quotes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 12: Comprehensive security verification before COMMIT
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  policy_count INTEGER;
  admin_count INTEGER;
  unsafe_policy_count INTEGER;
  permissive_auth_true_count INTEGER;
  public_policy_count INTEGER;
  admin_policy_count INTEGER;
BEGIN
  -- Verify admin_users is populated
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No admin users in admin_users table';
  END IF;

  -- Verify total policy count
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  IF policy_count < 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected at least 22 policies, found %', policy_count;
  END IF;

  -- Verify no unsafe policies remain (by name)
  SELECT COUNT(*) INTO unsafe_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      policyname LIKE '%authenticated_full_access%'
      OR policyname = 'Admins have full access to products'
      OR policyname = 'Admins have full access to variants'
      OR policyname = 'Admins can view all orders'
      OR policyname = 'Admins can view all order items'
      OR policyname = 'Admins can view all quotes'
      OR policyname = 'Anyone can submit quotes'
    );

  IF unsafe_policy_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % unsafe policies still present', unsafe_policy_count;
  END IF;

  -- Verify no permissive USING (true) policies for authenticated (except SELECT/INSERT public policies)
  SELECT COUNT(*) INTO permissive_auth_true_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
    AND 'authenticated' = ANY(roles)
    AND qual = 'true'::text
    AND cmd NOT IN ('SELECT', 'INSERT')  -- Exclude legitimate public read/insert
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes');

  IF permissive_auth_true_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % permissive USING(true) policies for authenticated on UPDATE/DELETE', permissive_auth_true_count;
  END IF;

  -- Verify public policies exist
  SELECT COUNT(*) INTO public_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'public_%';

  IF public_policy_count < 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected at least 3 public policies (products SELECT, variants SELECT, quotes INSERT), found %', public_policy_count;
  END IF;

  -- Verify admin policies use is_admin() function
  SELECT COUNT(*) INTO admin_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'admin_%'
    AND (
      qual::text LIKE '%is_admin()%'
      OR with_check::text LIKE '%is_admin()%'
    );

  IF admin_policy_count < 19 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected at least 19 admin policies using is_admin(), found %', admin_policy_count;
  END IF;

  RAISE NOTICE '✅ Migration verification passed';
  RAISE NOTICE '   Admin users: %', admin_count;
  RAISE NOTICE '   Total policies: %', policy_count;
  RAISE NOTICE '   Public policies: %', public_policy_count;
  RAISE NOTICE '   Admin policies: %', admin_policy_count;
  RAISE NOTICE '   Unsafe policies removed: verified';
  RAISE NOTICE '   No permissive USING(true) for authenticated UPDATE/DELETE: verified';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (MANDATORY - Run immediately after migration)
-- ============================================================================

-- Postflight 1: Verify admin_users table and function
SELECT
  'admin_users_table' as object,
  COUNT(*) as count
FROM admin_users
UNION ALL
SELECT
  'is_admin_function' as object,
  COUNT(*)::integer as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- Expected: admin_users_table = 1+, is_admin_function = 1

-- Postflight 2: Verify is_admin() function security
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility,
  prosrc as source_contains_admin_users
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- Expected: is_security_definer = true, volatility = 's' (stable)

-- Postflight 3: Verify function permissions
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin'
ORDER BY grantee;

-- Expected: Only 'authenticated' has EXECUTE (anon should NOT have EXECUTE)

-- Postflight 4: List admin users
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;

-- Verify correct admin email is present

-- Postflight 5: Test is_admin() function (if signed in as admin)
SELECT public.is_admin() as am_i_admin;

-- Expected: true if signed in as admin, false otherwise
-- NOTE: This test from SQL Editor may return false even if correct (uses SQL Editor session, not browser session)

-- Postflight 6: Verify ALL unsafe policies are GONE
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%authenticated_full_access%'
    OR policyname LIKE '%Admins have full access%'
    OR policyname = 'Anyone can submit quotes'
  );

-- Expected: 0 rows

-- Postflight 7: Verify admin policies use is_admin()
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%' THEN 'Uses is_admin()'
    ELSE 'WARNING: Does not use is_admin()'
  END as security_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'admin_%'
ORDER BY tablename, cmd, policyname;

-- Expected: All rows show "Uses is_admin()"

-- Postflight 8: Verify public policies preserved
SELECT
  tablename,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'public_%'
ORDER BY tablename, policyname;

-- Expected: 3 policies
--   products: public_select_published_products (SELECT, {anon,authenticated})
--   product_variants: public_select_variants (SELECT, {anon,authenticated})
--   custom_quotes: public_insert_quotes (INSERT, {anon,authenticated})

-- Postflight 9: Verify no permissive USING(true) for authenticated (except public SELECT/INSERT)
SELECT
  tablename,
  policyname,
  cmd,
  roles::text,
  qual::text as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text
ORDER BY tablename, cmd, policyname;

-- Expected: Only public SELECT (variants) and public INSERT (quotes) policies
-- Should NOT see any UPDATE or DELETE policies with USING(true)

-- Postflight 10: Verify record counts unchanged
SELECT
  'products' as table_name,
  COUNT(*) as record_count
FROM products
UNION ALL
SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- Expected: Same counts as Preflight 7

-- Postflight 11: Verify table grants unchanged
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY table_name, grantee, privilege_type;

-- Expected: Same grants as Preflight 6 (plus admin_users table)

-- Postflight 12: Full policy inventory (compare with Preflight 2)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, policyname;

-- Compare with Preflight 2 - verify all unsafe policies removed and new secure policies created

-- ============================================================================
-- MANUAL TESTING PLAN (Required after migration)
-- ============================================================================

-- Test 1: Anonymous User (Incognito Browser)
-- 1. Browse /explore page - should see published products
-- 2. View product detail page - should see product details
-- 3. Try to access /admin - should redirect to /admin/login
-- 4. Submit custom quote - should work
-- Expected: Public read access works, admin access blocked

-- Test 2: Non-Admin Authenticated User (Different Browser/Account)
-- 1. Create new account with different email (not admin email)
-- 2. Sign in
-- 3. Browse /explore - should see published products
-- 4. Try to access /admin/products - may load page but queries will fail
-- 5. Check browser console - should see RLS policy violation errors
-- 6. Try to create product via API - should fail with permission denied
-- Expected: Public access works, admin operations blocked by RLS

-- Test 3: Admin User (Your Admin Account)
-- 1. Sign in with admin email (from Step 5)
-- 2. Access /admin dashboard - should load with stats
-- 3. View /admin/products - should see all products
-- 4. Create new product - should work
-- 5. Edit existing product - should work
-- 6. View /admin/quotes - should see all quotes
-- Expected: Full admin access works

-- Test 4: Quote Submission Column Restrictions (via API)
-- Attempt to submit quote with admin-only fields set:
/*
POST /api/submit-quote (if implemented) or direct Supabase client:
{
  "customer_name": "Attacker",
  "email": "test@example.com",
  "project_description": "Test",
  "status": "quoted",  // Admin-only field
  "product_id": "some-uuid",  // Admin-only field
  "feasibility_assessment": {"can_print": true}  // Admin-only field
}
Expected: INSERT should fail or admin-only fields should be ignored
*/

-- ============================================================================
-- UNVERIFIABLE FACTS (Require External Verification)
-- ============================================================================

-- FACT 1: Actual admin email address
-- Cannot be determined from code. Must come from Preflight 1 query or environment config.
-- REQUIRED: Update 'PLACEHOLDER_EMAIL' in Step 5 before execution.

-- FACT 2: Supabase default table grants
-- Assumed: authenticated role has SELECT, INSERT, UPDATE, DELETE on all tables
-- Verification: Preflight 6 and Postflight 11 document actual grants
-- If grants are too restrictive: Policies won't help (no table access at all)
-- If grants are too permissive: RLS is the only protection layer

-- FACT 3: Quote submission implementation status
-- Code shows: Custom quote page has TODO for Supabase submission (app/custom/page.tsx)
-- Conclusion: Public INSERT policy prepared but feature not yet implemented
-- Impact: Policy is ready when feature is built

-- FACT 4: Product variants usage
-- No queries to product_variants found in app code
-- Original schema includes variants table with public read policy
-- Assumption: Variants may be used in future or in admin interface
-- Current policy: Keep public read access to variants (safe - no sensitive columns)

-- FACT 5: Service role key accessibility
-- Cannot verify if service role key is exposed to client code without env file inspection
-- Verification: Check .env files, Supabase client initialization
-- Current assessment: client.ts and server.ts use NEXT_PUBLIC_SUPABASE_ANON_KEY (safe)

-- ============================================================================
-- ROLLBACK PROCEDURE (If Migration Fails or Needs Reversal)
-- ============================================================================

-- ⚠️ WARNING: DO NOT restore unsafe authenticated_full_access_* policies
-- ⚠️ Rollback only restores public access, NOT broad authenticated access

-- Option 1: Fix Forward (Preferred - maintains security)
-- If admin access broken:
/*
BEGIN;
-- Use service role (via Supabase Dashboard SQL Editor)
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT id, id, 'Emergency admin restoration'
FROM auth.users
WHERE email = 'your-actual-admin-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
COMMIT;
*/

-- If public access broken:
/*
BEGIN;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);  -- Note: Less secure than column-restricted version
COMMIT;
*/

-- Option 2: Remove All Policies (Emergency - Admin Only Via Service Role)
/*
BEGIN;
DROP POLICY IF EXISTS "public_select_published_products" ON products;
DROP POLICY IF EXISTS "admin_select_products" ON products;
-- ... drop all policies
-- Result: Only service_role can access tables
-- Use service role to manually manage data until fixed
COMMIT;
*/

-- Option 3: Full Database Restore (Last Resort)
-- Restore from backup taken before migration
-- Loses all changes after backup time
-- DO NOT manually recreate unsafe policies

-- ============================================================================
-- ADMIN MANAGEMENT (After Successful Migration)
-- ============================================================================

-- Add new admin (requires service role key via Supabase Dashboard)
/*
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  (SELECT id FROM auth.users WHERE email = 'newadmin@example.com'),
  (SELECT id FROM auth.users WHERE email = 'current-admin@example.com'),
  'Added by current-admin on 2026-10-15'
ON CONFLICT (user_id) DO NOTHING;
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

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
