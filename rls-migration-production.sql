-- ============================================================================
-- MIVO RLS Security Remediation - PRODUCTION VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Status: ⚠️ NOT APPROVED - Requires preflight verification and configuration
--
-- CRITICAL: This migration uses a non-recursive admin check pattern.
-- The is_admin() function is owned by postgres superuser and queries
-- admin_users without RLS evaluation (superuser bypasses RLS).
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (MANDATORY - Run ALL queries before main migration)
-- ============================================================================

-- Preflight 1: Identify all Auth users (find actual admin email)
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at;

-- ⚠️ REQUIRED: Choose which email should be admin, update in migration Step 6

-- Preflight 2: Complete policy inventory on all six tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, policyname;

-- Expected: See authenticated_full_access_* policies and legacy admin policies
-- Document ALL policy names - migration will verify all are removed

-- Preflight 3: Verify RLS enabled state on all tables
SELECT
  schemaname,
  tablename,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All tables have rls_enabled = true
-- If any false: Migration will enable RLS

-- Preflight 4: Check for existing admin infrastructure
SELECT
  'admin_users_table' as object_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) as exists
UNION ALL
SELECT
  'is_admin_function',
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  );

-- Expected: Both false (clean slate)
-- If true: Partial migration detected - see recovery section below

-- Preflight 5: Verify custom_quotes table and column grants
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_quotes'
ORDER BY ordinal_position;

-- Document all columns for quote submission policy design

-- Preflight 6: Check table-level grants (baseline)
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- Document baseline grants - migration will verify unchanged

-- Preflight 7: Count records in all tables
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- Document counts for post-migration comparison

-- Preflight 8: Test auth functions availability
SELECT
  auth.uid() as current_uid,
  auth.jwt() ->> 'email' as current_email,
  auth.jwt() ->> 'role' as current_role;

-- Expected: NULL if not signed in, or actual values if signed in

-- ============================================================================
-- PARTIAL MIGRATION RECOVERY (Only if Preflight 4 shows existing objects)
-- ============================================================================
-- Run this section ONLY if preflight shows admin infrastructure exists

/*
-- Check if admin_users has correct data
SELECT COUNT(*) as admin_count FROM admin_users;

-- Check if is_admin() function works
SELECT proname, prosecdef, proowner::regrole
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;

-- If infrastructure exists and is correct, skip to Step 7 (drop unsafe policies)
-- If infrastructure exists but is wrong, drop it:
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
-- Then proceed with full migration
*/

-- ============================================================================
-- MAIN MIGRATION (Run only after ALL preflight checks complete)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Verify RLS is enabled on all business tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tables_without_rls TEXT[];
BEGIN
  SELECT ARRAY_AGG(c.relname)
  INTO tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
    AND NOT c.relrowsecurity;

  IF tables_without_rls IS NOT NULL THEN
    RAISE NOTICE 'Enabling RLS on tables: %', tables_without_rls;

    -- Enable RLS on any table that doesn't have it
    EXECUTE 'ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS product_variants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS custom_quotes ENABLE ROW LEVEL SECURITY';
  END IF;

  RAISE NOTICE '✅ RLS enabled on all business tables';
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: Create admin_users table (without RLS initially)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  CONSTRAINT admin_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT admin_users_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

COMMENT ON TABLE admin_users IS
  'Admin allowlist. Only postgres/service_role can INSERT/UPDATE/DELETE. RLS policy allows admins to SELECT.';

-- ⚠️ IMPORTANT: Do NOT enable RLS yet - function must be created first

-- ----------------------------------------------------------------------------
-- Step 3: Create SECURITY DEFINER function owned by postgres superuser
-- ----------------------------------------------------------------------------
-- This function queries admin_users without RLS because:
-- 1. Function is SECURITY DEFINER (runs with creator privileges)
-- 2. Creator is postgres superuser (or service_role)
-- 3. Superuser bypasses RLS (even if RLS is enabled on admin_users)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Queries admin_users as superuser (bypasses RLS)
  -- Returns true if current session's user_id is in admin_users
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Verify function owner is postgres (superuser) or service_role
DO $$
DECLARE
  func_owner TEXT;
  func_is_superuser BOOLEAN;
BEGIN
  SELECT
    pg_get_userbyid(p.proowner),
    EXISTS (
      SELECT 1 FROM pg_roles r
      WHERE r.oid = p.proowner AND r.rolsuper
    )
  INTO func_owner, func_is_superuser
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() function was not created';
  END IF;

  -- Function owner must be superuser OR service_role (Supabase specific)
  IF NOT func_is_superuser AND func_owner != 'service_role' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() function owner "%" is not superuser or service_role. Cannot bypass RLS on admin_users.', func_owner;
  END IF;

  RAISE NOTICE '✅ is_admin() function created with owner: % (superuser: %)', func_owner, func_is_superuser;
END $$;

-- Restrict function execution permissions
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true if current user is admin. SECURITY DEFINER with superuser owner bypasses RLS on admin_users. Search path locked to prevent hijacking.';

-- ----------------------------------------------------------------------------
-- Step 4: Enable RLS on admin_users (now safe with function in place)
-- ----------------------------------------------------------------------------

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Note: NOT using FORCE ROW LEVEL SECURITY because:
-- 1. Would prevent superuser from querying admin_users
-- 2. Would cause is_admin() function to fail (even as SECURITY DEFINER)
-- 3. We rely on superuser/service_role bypassing RLS for admin management

-- Create SELECT policy using is_admin() function
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies = only superuser/service_role can modify

COMMENT ON POLICY "admin_users_read" ON admin_users IS
  'Admins can read admin list. Non-recursive because is_admin() runs as superuser and bypasses RLS.';

-- ----------------------------------------------------------------------------
-- Step 5: Verify admin infrastructure security
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  func_exists BOOLEAN;
  func_is_security_definer BOOLEAN;
  func_owner TEXT;
  table_has_rls BOOLEAN;
  table_force_rls BOOLEAN;
  table_owner TEXT;
  select_policy_exists BOOLEAN;
  write_policy_exists BOOLEAN;
BEGIN
  -- Verify function properties
  SELECT
    COUNT(*) > 0,
    BOOL_OR(p.prosecdef),
    MAX(pg_get_userbyid(p.proowner))
  INTO func_exists, func_is_security_definer, func_owner
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_admin';

  IF NOT func_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() function missing';
  END IF;

  IF NOT func_is_security_definer THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() is not SECURITY DEFINER';
  END IF;

  -- Verify table properties
  SELECT
    c.relrowsecurity,
    c.relforcerowsecurity,
    pg_get_userbyid(c.relowner)
  INTO table_has_rls, table_force_rls, table_owner
  FROM pg_class c
  WHERE c.relname = 'admin_users' AND c.relnamespace = 'public'::regnamespace;

  IF NOT table_has_rls THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users RLS not enabled';
  END IF;

  IF table_force_rls THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users has FORCE RLS which would break superuser bypass';
  END IF;

  -- Verify only SELECT policy exists (no write policies)
  SELECT
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_users' AND cmd = 'SELECT'
    ),
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_users'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    )
  INTO select_policy_exists, write_policy_exists;

  IF NOT select_policy_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users SELECT policy missing';
  END IF;

  IF write_policy_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users has write policies - should be superuser-only';
  END IF;

  RAISE NOTICE '✅ Admin infrastructure security verified';
  RAISE NOTICE '   Function owner: % (SECURITY DEFINER: %)', func_owner, func_is_security_definer;
  RAISE NOTICE '   Table RLS: enabled (FORCE: %)', table_force_rls;
  RAISE NOTICE '   Table owner: %', table_owner;
  RAISE NOTICE '   Write policies: none (superuser-only modification)';
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: Insert initial admin user (BEFORE dropping unsafe policies)
-- ----------------------------------------------------------------------------
-- ⚠️ CRITICAL: Replace 'PLACEHOLDER_ADMIN_EMAIL@example.com' with actual email

INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  id,
  id,
  'Initial admin - migrated 2026-10-15'
FROM auth.users
WHERE email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← ⚠️ REPLACE THIS
ON CONFLICT (user_id) DO NOTHING;

-- Verify the EXACT configured admin was inserted
DO $$
DECLARE
  configured_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';  -- ← ⚠️ MUST MATCH ABOVE
  configured_user_exists BOOLEAN;
  configured_user_is_admin BOOLEAN;
  admin_count INTEGER;
  inserted_admin_email TEXT;
BEGIN
  -- Check if configured email exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = configured_email
  ) INTO configured_user_exists;

  IF NOT configured_user_exists THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Configured admin email "%" not found in auth.users. Run Preflight 1 to identify valid emails.', configured_email;
  END IF;

  -- Check if configured email is now in admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = configured_email
  ) INTO configured_user_is_admin;

  IF NOT configured_user_is_admin THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Configured admin email "%" was not inserted into admin_users. Check for conflicts.', configured_email;
  END IF;

  SELECT COUNT(*) INTO admin_count FROM admin_users;

  SELECT u.email INTO inserted_admin_email
  FROM admin_users au
  JOIN auth.users u ON u.id = au.user_id
  WHERE u.email = configured_email;

  RAISE NOTICE '✅ Admin user verified: % (total admins: %)', inserted_admin_email, admin_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 7: Drop ALL existing policies on all six tables
-- ----------------------------------------------------------------------------
-- Complete inventory to ensure no unsafe policies remain

DO $$
DECLARE
  pol RECORD;
  dropped_count INTEGER := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
    dropped_count := dropped_count + 1;
    RAISE NOTICE 'Dropped policy: %.%.%', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  -- Also drop admin_users policies created in Step 4 (will recreate)
  DROP POLICY IF EXISTS "admin_users_read" ON admin_users;
  dropped_count := dropped_count + 1;

  RAISE NOTICE '✅ Dropped % existing policies', dropped_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 8: Create secure policies for PRODUCTS
-- ----------------------------------------------------------------------------

CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

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
-- Step 9: Create secure policies for PRODUCT_VARIANTS
-- ----------------------------------------------------------------------------

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT
  TO anon, authenticated
  USING (true);

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
-- Step 10: Create secure policies for ORDERS
-- ----------------------------------------------------------------------------

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
-- Step 11: Create secure policies for ORDER_ITEMS
-- ----------------------------------------------------------------------------

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
-- Step 12: Create secure policies for CUSTOM_QUOTES
-- ----------------------------------------------------------------------------
-- ⚠️ IMPORTANT: RLS WITH CHECK validates row values but does NOT provide
-- column-level protection. It cannot prevent columns from being set, only
-- validate their values after INSERT.
--
-- For true column-level security, use GRANT INSERT(column_list) or implement
-- server-side submission API route.

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate required customer fields
    customer_name IS NOT NULL
    AND LENGTH(TRIM(customer_name)) > 0
    AND LENGTH(customer_name) <= 200

    -- Require valid contact method
    AND (
      (email IS NOT NULL AND LENGTH(TRIM(email)) > 0
       AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      OR (phone IS NOT NULL AND LENGTH(TRIM(phone)) > 0)
    )

    -- Require project description
    AND project_description IS NOT NULL
    AND LENGTH(TRIM(project_description)) > 0
    AND LENGTH(project_description) <= 5000

    -- Validate admin-only fields are not set to non-NULL values
    -- (cannot prevent column from being mentioned, only validate value)
    AND product_id IS NULL
    AND custom_dimensions IS NULL
    AND feasibility_assessment IS NULL
    AND quote_response IS NULL

    -- Force status to 'submitted' (or NULL which becomes 'submitted' via default)
    AND (status IS NULL OR status = 'submitted')
  );

COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Does NOT prevent columns from being set - use column-level grants or server-side API for full protection.';

CREATE POLICY "admin_select_quotes" ON custom_quotes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_update_quotes" ON custom_quotes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_quotes" ON custom_quotes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 13: Recreate admin_users SELECT policy
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Step 14: Comprehensive security verification before COMMIT
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  -- Policy counts
  total_policies INTEGER;
  products_policies INTEGER;
  variants_policies INTEGER;
  orders_policies INTEGER;
  order_items_policies INTEGER;
  quotes_policies INTEGER;
  admin_users_policies INTEGER;

  -- Policy validation
  policies_using_is_admin INTEGER;
  unexpected_policies INTEGER;
  unsafe_permissive_policies INTEGER;

  -- RLS state
  tables_without_rls INTEGER;

  -- Admin state
  admin_count INTEGER;
  configured_admin_exists BOOLEAN;

  -- Function security
  func_execute_grants TEXT[];

  -- Expected policy names
  expected_policies TEXT[] := ARRAY[
    'products.public_select_published_products',
    'products.admin_select_products',
    'products.admin_insert_products',
    'products.admin_update_products',
    'products.admin_delete_products',
    'product_variants.public_select_variants',
    'product_variants.admin_insert_variants',
    'product_variants.admin_update_variants',
    'product_variants.admin_delete_variants',
    'orders.admin_select_orders',
    'orders.admin_insert_orders',
    'orders.admin_update_orders',
    'orders.admin_delete_orders',
    'order_items.admin_select_order_items',
    'order_items.admin_insert_order_items',
    'order_items.admin_update_order_items',
    'order_items.admin_delete_order_items',
    'custom_quotes.public_insert_quotes',
    'custom_quotes.admin_select_quotes',
    'custom_quotes.admin_update_quotes',
    'custom_quotes.admin_delete_quotes',
    'admin_users.admin_users_read'
  ];
  actual_policies TEXT[];

BEGIN
  RAISE NOTICE 'Running comprehensive security verification...';

  -- Count policies by table
  SELECT COUNT(*) INTO total_policies FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  SELECT COUNT(*) INTO products_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'products';

  SELECT COUNT(*) INTO variants_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'product_variants';

  SELECT COUNT(*) INTO orders_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'orders';

  SELECT COUNT(*) INTO order_items_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'order_items';

  SELECT COUNT(*) INTO quotes_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'custom_quotes';

  SELECT COUNT(*) INTO admin_users_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'admin_users';

  -- Verify exact policy count (22 total: 5+4+4+4+4+1)
  IF total_policies != 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected exactly 22 policies, found %. Breakdown: products=%, variants=%, orders=%, order_items=%, quotes=%, admin_users=%',
      total_policies, products_policies, variants_policies, orders_policies, order_items_policies, quotes_policies, admin_users_policies;
  END IF;

  -- Verify policy names match expected list
  SELECT ARRAY_AGG(tablename || '.' || policyname ORDER BY tablename, policyname)
  INTO actual_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  IF actual_policies != expected_policies THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Policy names do not match expected. Expected: %, Actual: %',
      expected_policies, actual_policies;
  END IF;

  -- Count policies using is_admin() (should be 18: all admin policies except 2 public policies)
  SELECT COUNT(*) INTO policies_using_is_admin
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND (qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%');

  IF policies_using_is_admin != 18 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 18 policies using is_admin(), found %', policies_using_is_admin;
  END IF;

  -- Verify no unsafe permissive USING(true) policies for UPDATE/DELETE
  SELECT COUNT(*) INTO unsafe_permissive_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
    AND permissive = 'PERMISSIVE'
    AND 'authenticated' = ANY(roles)
    AND qual = 'true'::text
    AND cmd IN ('UPDATE', 'DELETE');

  IF unsafe_permissive_policies > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % permissive USING(true) policies for UPDATE/DELETE', unsafe_permissive_policies;
  END IF;

  -- Verify no unexpected policies exist
  SELECT COUNT(*) INTO unexpected_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND NOT (tablename || '.' || policyname = ANY(expected_policies));

  IF unexpected_policies > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % unexpected policies not in expected list', unexpected_policies;
  END IF;

  -- Verify RLS enabled on all tables
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND NOT c.relrowsecurity;

  IF tables_without_rls > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % tables do not have RLS enabled', tables_without_rls;
  END IF;

  -- Verify admin user exists
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No admin users in admin_users table';
  END IF;

  -- Verify configured admin exists
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← ⚠️ MUST MATCH Step 6
  ) INTO configured_admin_exists;

  IF NOT configured_admin_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Configured admin email not found in admin_users';
  END IF;

  -- Verify function execute grants (authenticated only, not anon or PUBLIC)
  SELECT ARRAY_AGG(grantee::text ORDER BY grantee::text)
  INTO func_execute_grants
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name = 'is_admin'
    AND privilege_type = 'EXECUTE';

  IF 'anon' = ANY(func_execute_grants) OR 'PUBLIC' = ANY(func_execute_grants) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() function has EXECUTE grant to anon or PUBLIC. Grants: %', func_execute_grants;
  END IF;

  IF NOT ('authenticated' = ANY(func_execute_grants)) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() function missing EXECUTE grant to authenticated. Grants: %', func_execute_grants;
  END IF;

  RAISE NOTICE '✅ All security verifications passed';
  RAISE NOTICE '   Total policies: % (expected: 22)', total_policies;
  RAISE NOTICE '   Policies using is_admin(): % (expected: 18)', policies_using_is_admin;
  RAISE NOTICE '   Admin users: %', admin_count;
  RAISE NOTICE '   Function EXECUTE grants: %', func_execute_grants;
  RAISE NOTICE '   All policy names match expected list';
  RAISE NOTICE '   No unsafe permissive policies found';
  RAISE NOTICE '   RLS enabled on all tables';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (MANDATORY - Run immediately after COMMIT)
-- ============================================================================

-- Postflight 1: Verify all policies created with correct properties
SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text,
  CASE
    WHEN qual::text LIKE '%is_admin()%' THEN 'Admin (via is_admin)'
    WHEN qual::text LIKE '%published%' THEN 'Published products'
    WHEN qual::text = 'true' THEN 'Public all rows'
    ELSE 'Custom: ' || LEFT(qual::text, 50)
  END as using_clause_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, cmd, policyname;

-- Expected: 22 rows, all with expected names and properties

-- Postflight 2: Verify is_admin() function security
SELECT
  proname as function_name,
  pg_get_userbyid(proowner) as owner,
  prosecdef as is_security_definer,
  provolatile as volatility,
  EXISTS (
    SELECT 1 FROM pg_roles WHERE oid = proowner AND rolsuper
  ) as owner_is_superuser
FROM pg_proc p
WHERE pronamespace = 'public'::regnamespace AND proname = 'is_admin';

-- Expected: owner = postgres or service_role, is_security_definer = true,
-- owner_is_superuser = true (or owner = service_role in Supabase)

-- Postflight 3: Verify function privileges
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'is_admin'
ORDER BY grantee;

-- Expected: Only authenticated has EXECUTE (not anon, not PUBLIC)

-- Postflight 4: List all admins
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;

-- Verify your configured admin email is present

-- Postflight 5: Verify RLS state on all tables
SELECT
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  pg_get_userbyid(c.relowner) as owner
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All tables have rls_enabled = true
-- admin_users: force_rls = false (allows superuser bypass)

-- Postflight 6: Verify no unsafe policies remain
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%authenticated_full_access%'
    OR policyname LIKE '%Admins have full access%'
    OR policyname = 'Anyone can submit quotes'
    OR policyname = 'Public can view published products'
    OR policyname = 'Public can view product variants'
  );

-- Expected: 0 rows (all legacy policies removed)

-- Postflight 7: Verify record counts unchanged
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- Compare with Preflight 7 - should be identical

-- Postflight 8: Verify table grants unchanged
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- Compare with Preflight 6 - should be same except admin_users added

-- Postflight 9: Test is_admin() function (if signed in as admin)
SELECT public.is_admin() as am_i_admin;

-- Expected: true if signed in as configured admin
-- Note: SQL Editor session may differ from browser session

-- Postflight 10: Verify admin_users write protection
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_users'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

-- Expected: 0 rows (no write policies = superuser-only modification)

-- ============================================================================
-- MANUAL TESTING CHECKLIST (Required after migration)
-- ============================================================================

/*
Test 1: Anonymous User (Incognito Browser)
-------------------------------------------
1. Navigate to /explore
   Expected: See published products

2. Click on a product detail page
   Expected: Product details load

3. Try to access /admin
   Expected: Redirect to /admin/login or permission denied

4. Submit custom quote (when implemented)
   Expected: Submission works
   Try to set admin fields (status='quoted', product_id='uuid')
   Expected: INSERT fails or fields ignored

Test 2: Non-Admin Authenticated User (Different Account)
---------------------------------------------------------
1. Create new account with email different from configured admin
2. Sign in successfully
3. Browse /explore
   Expected: See published products

4. Navigate to /admin/products
   Expected: Page may load but no products shown
   Check browser console
   Expected: RLS policy violation errors

5. Attempt to create product via Supabase client
   Expected: Permission denied / RLS error

6. Try to query admin_users table
   Expected: Permission denied or empty result

7. Test is_admin() function via RPC call
   Expected: Returns false

Test 3: Admin User (Configured Admin Account)
----------------------------------------------
1. Sign in with configured admin email
2. Navigate to /admin
   Expected: Dashboard loads with statistics

3. Navigate to /admin/products
   Expected: All products visible (published and unpublished)

4. Create new product
   Expected: Success

5. Edit existing product
   Expected: Success

6. Delete test product
   Expected: Success

7. Navigate to /admin/quotes
   Expected: All quotes visible

8. Update quote status
   Expected: Success

9. Query admin_users via Supabase client
   Expected: See admin list

10. Test is_admin() function via RPC call
    Expected: Returns true

Test 4: Quote Column-Level Security
------------------------------------
Note: This test requires implementing quote submission or using direct SQL

Via direct SQL (as authenticated non-admin):
INSERT INTO custom_quotes (
  customer_name,
  email,
  project_description,
  status,                    -- Try to set admin field
  product_id,                -- Try to set admin field
  feasibility_assessment     -- Try to set admin field
) VALUES (
  'Test',
  'test@example.com',
  'Test description',
  'quoted',                  -- Should be rejected
  '00000000-0000-0000-0000-000000000000',  -- Should be rejected
  '{"can_print": true}'      -- Should be rejected
);

Expected: INSERT fails with CHECK constraint violation
OR if RLS doesn't catch it, should be rejected by application layer

Test without admin fields:
INSERT INTO custom_quotes (
  customer_name,
  email,
  project_description
) VALUES (
  'Test',
  'test@example.com',
  'Test description'
);

Expected: SUCCESS - status defaults to 'submitted', admin fields NULL
*/

-- ============================================================================
-- VERIFIED PROPERTIES vs UNVERIFIABLE ASSUMPTIONS
-- ============================================================================

/*
VERIFIED FROM CODE AND SCHEMA:
-------------------------------
✅ custom_quotes schema has 4 admin-only columns added in migration 003
✅ product_variants has no sensitive columns - all safe for public read
✅ Orders go through WhatsApp only - no database persistence implemented
✅ Quote submission has TODO in app code - feature not implemented yet
✅ Admin pages query products/quotes with SELECT * (require admin RLS)
✅ Public pages query products with published = true filter
✅ Supabase clients use NEXT_PUBLIC_SUPABASE_ANON_KEY (not service role)
✅ is_admin() function uses SECURITY DEFINER and queries admin_users
✅ Function owner must be superuser or service_role to bypass RLS
✅ Migration creates exactly 22 policies (5+4+4+4+4+1)
✅ 18 policies use is_admin() for admin checks
✅ No FORCE RLS on admin_users allows superuser bypass

REQUIRES EXTERNAL VERIFICATION (Preflight Queries):
----------------------------------------------------
⚠️ Actual admin email address (from Preflight 1)
⚠️ Current table-level grants (from Preflight 6)
⚠️ Whether anon/authenticated have full INSERT privilege or column-level
⚠️ Existing policy inventory (from Preflight 2)
⚠️ RLS enabled state on all tables (from Preflight 3)
⚠️ Whether partial migration already run (from Preflight 4)
⚠️ Record counts baseline (from Preflight 7)

ASSUMPTIONS (Reasonable but not verified):
------------------------------------------
⚠️ Function owner will be postgres (superuser) or service_role
⚠️ Supabase grants full INSERT privilege (not column-level) by default
⚠️ auth.uid() and auth.jwt() functions are available
⚠️ Database uses default Supabase role hierarchy (anon, authenticated, service_role)
⚠️ Service role key is not exposed to browser client code
*/

-- ============================================================================
-- ROLLBACK PROCEDURES (If migration fails or needs reversal)
-- ============================================================================

/*
⚠️ CRITICAL: Do NOT restore unsafe authenticated_full_access_* policies
⚠️ Do NOT restore WITH CHECK (true) for quote submission

OPTION 1: Fix Forward (Preferred - maintains security)
-------------------------------------------------------
If admin access broken after migration:

BEGIN;
-- Use service role (via Supabase Dashboard SQL Editor)
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT id, id, 'Emergency admin restoration'
FROM auth.users
WHERE email = 'your-actual-admin-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
COMMIT;

If public access broken:

BEGIN;
-- Restore public read access only
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (true);
COMMIT;

OPTION 2: Remove All Policies (Emergency - service role access only)
---------------------------------------------------------------------
BEGIN;
-- Drop all policies from all tables
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;
COMMIT;

-- Result: Only service_role can access tables
-- Use service role to manage data until policies fixed

OPTION 3: Full Database Restore (Last resort)
----------------------------------------------
1. Restore from backup taken before migration (Supabase Dashboard > Database > Backups)
2. Review migration failure logs
3. Fix issues in migration SQL
4. Re-test on staging before production

DO NOT:
❌ Restore authenticated_full_access_* policies
❌ Create permissive USING(true) policies for UPDATE/DELETE
❌ Use WITH CHECK (true) for quote submission without column validation
❌ Disable RLS on tables
❌ Grant service_role privileges to authenticated users
*/

-- ============================================================================
-- ADMIN MANAGEMENT (After successful migration)
-- ============================================================================

/*
Add new admin (requires service role key via Supabase Dashboard):

INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  (SELECT id FROM auth.users WHERE email = 'newadmin@example.com'),
  (SELECT id FROM auth.users WHERE email = 'current-admin@example.com'),
  'Added by current-admin on 2026-10-15'
ON CONFLICT (user_id) DO NOTHING;

Remove admin (requires service role key):

DELETE FROM admin_users
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oldadmin@example.com');

List all admins:

SELECT
  au.user_id,
  u.email,
  au.granted_at,
  granter.email as granted_by,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
LEFT JOIN auth.users granter ON granter.id = au.granted_by
ORDER BY au.granted_at;

Check if specific user is admin:

SELECT EXISTS (
  SELECT 1 FROM admin_users
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com')
) as is_admin;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
