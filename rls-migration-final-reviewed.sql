-- ============================================================================
-- MIVO RLS Security Remediation - CODE-REVIEWED VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Status: ⚠️ NOT APPROVED - Code reviewed, requires preflight and approval
--
-- SECURITY MODEL:
-- - admin_users table: Allowlist controlled by superuser/service_role only
-- - is_admin() function: SECURITY DEFINER owned by role with rolbypassrls=true
-- - Function bypasses RLS when querying admin_users (non-recursive)
-- - Admin policies: Reference is_admin() for authorization (19 policies)
-- - Public policies: Limited read/insert access (3 policies)
-- ============================================================================

-- ============================================================================
-- IMPORTANT: DATABASE vs APPLICATION AUTHORIZATION
-- ============================================================================
-- This migration secures DATABASE-LEVEL access via RLS policies.
-- APPLICATION-LEVEL route authorization is separate and NOT handled here.
--
-- After this migration:
-- ✅ Database: Only admins can query/modify admin tables (enforced by RLS)
-- ❌ Application: Admin routes (/admin/*) still accessible to any authenticated user
--
-- REQUIRED POST-MIGRATION: Add server-side admin check to application routes
-- Example (Next.js middleware or layout):
--   const { data: isAdmin } = await supabase.rpc('is_admin').single();
--   if (!isAdmin) redirect('/');
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (MANDATORY - Run ALL queries before main migration)
-- ============================================================================

-- Preflight 1: Identify all Auth users to select admin email
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_user_meta_data ->> 'name' as name
FROM auth.users
ORDER BY created_at;

-- ⚠️ ACTION: Choose admin email, update in migration lines 425, 433, 739

-- Preflight 2: Complete policy inventory on ALL six tables
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

-- Expected: See unsafe policies like authenticated_full_access_*
-- Will verify ALL policies are removed during migration

-- Preflight 3: Verify all six tables exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY table_name;

-- Expected: 5 tables (admin_users will be created)
-- If admin_users exists: See pre-existing validation section

-- Preflight 4: Verify RLS state on existing tables
SELECT
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  pg_get_userbyid(c.relowner) as owner
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All existing tables have rls_enabled = true
-- If any false: Migration will enable RLS

-- Preflight 5: Verify table grants (baseline for comparison)
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Document baseline grants - will verify unchanged after migration

-- Preflight 6: Check for existing is_admin function
SELECT
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as is_security_definer,
  r.rolsuper,
  r.rolbypassrls
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- Expected: Not found (clean slate) OR existing function with correct security
-- If found: Will validate and potentially replace

-- Preflight 7: Check custom_quotes schema for column-level grant planning
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_quotes'
ORDER BY ordinal_position;

-- Document columns for server-side submission endpoint design

-- Preflight 8: Record counts (baseline for post-migration comparison)
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- ============================================================================
-- PRE-EXISTING OBJECT VALIDATION
-- ============================================================================
-- Run this section if Preflight 3 shows admin_users table already exists
-- OR if Preflight 6 shows is_admin() function already exists

/*
-- Validate existing admin_users table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Expected columns: user_id (UUID, PK), granted_by (UUID), granted_at (TIMESTAMPTZ), notes (TEXT)

-- Validate existing admin_users constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.admin_users'::regclass
ORDER BY contype, conname;

-- Expected: PRIMARY KEY, FOREIGN KEY to auth.users

-- Validate existing admin_users ownership and RLS
SELECT
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
FROM pg_class c
WHERE c.relname = 'admin_users' AND c.relnamespace = 'public'::regnamespace;

-- Expected: owner = postgres/service_role, rls_enabled = true, force_rls = false

-- List existing admin_users data
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;

-- Document existing admins - will be preserved if structure correct

-- Decision: If table structure matches expectations, proceed with migration
-- If structure is wrong, migration will fail with error
*/

-- ============================================================================
-- MAIN MIGRATION (Run only after ALL preflight checks complete and reviewed)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Verify all six expected tables exist
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  missing_tables TEXT[];
  existing_tables TEXT[];
BEGIN
  SELECT
    ARRAY_AGG(expected_table ORDER BY expected_table),
    ARRAY_AGG(t.table_name ORDER BY t.table_name)
  INTO missing_tables, existing_tables
  FROM (
    SELECT unnest(ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes']) as expected_table
  ) expected
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = expected_table;

  -- Check if any expected tables are missing (admin_users will be created)
  SELECT ARRAY_AGG(expected_table)
  INTO missing_tables
  FROM (
    SELECT unnest(ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes']) as expected_table
  ) e
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = e.expected_table
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Missing required tables: %. Ensure schema is initialized.', missing_tables;
  END IF;

  RAISE NOTICE '✅ All five business tables exist (admin_users will be created)';
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: Verify and enable RLS on all existing tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tables_without_rls TEXT[];
BEGIN
  SELECT ARRAY_AGG(c.relname ORDER BY c.relname)
  INTO tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
    AND NOT c.relrowsecurity;

  IF tables_without_rls IS NOT NULL THEN
    RAISE NOTICE 'Enabling RLS on tables: %', tables_without_rls;

    -- Enable RLS on each table individually
    EXECUTE 'ALTER TABLE products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE order_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE custom_quotes ENABLE ROW LEVEL SECURITY';
  END IF;

  RAISE NOTICE '✅ RLS verified/enabled on all business tables';
END $$;

-- ----------------------------------------------------------------------------
-- Step 3: Validate or create admin_users table
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  table_exists BOOLEAN;
  column_count INTEGER;
  fk_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) INTO table_exists;

  IF table_exists THEN
    -- Validate existing table structure
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users'
      AND column_name IN ('user_id', 'granted_by', 'granted_at', 'notes');

    IF column_count != 4 THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: Existing admin_users table has wrong structure (expected 4 columns: user_id, granted_by, granted_at, notes, found %). Drop table manually and re-run.', column_count;
    END IF;

    -- Validate foreign keys exist
    SELECT COUNT(*) INTO fk_count
    FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass
      AND contype = 'f';  -- foreign key

    IF fk_count != 2 THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: Existing admin_users table missing foreign keys (expected 2, found %). Drop table manually and re-run.', fk_count;
    END IF;

    RAISE NOTICE '✅ Existing admin_users table validated (correct structure)';
  ELSE
    -- Create new table
    CREATE TABLE admin_users (
      user_id UUID PRIMARY KEY,
      granted_by UUID,
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      CONSTRAINT admin_users_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      CONSTRAINT admin_users_granted_by_fkey
        FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);

    COMMENT ON TABLE admin_users IS
      'Admin allowlist. Only roles with rolbypassrls can INSERT/UPDATE/DELETE. RLS policy allows admins to SELECT.';

    RAISE NOTICE '✅ Created admin_users table with correct structure';
  END IF;
END $$;

-- Enable RLS on admin_users (required for non-recursive pattern)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Do NOT use FORCE ROW LEVEL SECURITY (would break superuser bypass)

-- ----------------------------------------------------------------------------
-- Step 4: Create or replace is_admin() function with verified security
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Queries admin_users table
  -- Function owner must have rolbypassrls = true
  -- Owner bypasses RLS when executing this function
  -- Returns true if current session user_id exists in admin_users
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Verify function owner has RLS bypass capability
DO $$
DECLARE
  func_owner TEXT;
  func_owner_rolbypassrls BOOLEAN;
  func_owner_rolsuper BOOLEAN;
  func_is_security_definer BOOLEAN;
BEGIN
  SELECT
    pg_get_userbyid(p.proowner),
    r.rolbypassrls,
    r.rolsuper,
    p.prosecdef
  INTO func_owner, func_owner_rolbypassrls, func_owner_rolsuper, func_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  JOIN pg_roles r ON p.proowner = r.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() function not created';
  END IF;

  IF NOT func_is_security_definer THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() is not SECURITY DEFINER';
  END IF;

  -- Function owner must have rolbypassrls OR rolsuper
  IF NOT (func_owner_rolbypassrls OR func_owner_rolsuper) THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() owner "%" does not have rolbypassrls or rolsuper. Cannot bypass RLS on admin_users. This would cause infinite recursion.', func_owner;
  END IF;

  RAISE NOTICE '✅ is_admin() function verified: owner=%, rolbypassrls=%, rolsuper=%, SECURITY DEFINER=%',
    func_owner, func_owner_rolbypassrls, func_owner_rolsuper, func_is_security_definer;
END $$;

-- Set function execution privileges (authenticated only)
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true if current user is admin. SECURITY DEFINER with owner having rolbypassrls bypasses RLS on admin_users (non-recursive). Search path locked to prevent hijacking.';

-- ----------------------------------------------------------------------------
-- Step 5: Drop ALL existing policies on all six tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
  dropped_count INTEGER := 0;
  target_tables TEXT[] := ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users'];
BEGIN
  -- Drop ALL policies on the six target tables only
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(target_tables)
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
    dropped_count := dropped_count + 1;
    RAISE NOTICE 'Dropped policy: %.%.%', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  RAISE NOTICE '✅ Dropped % existing policies from target tables', dropped_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: Insert initial admin user (before creating policies)
-- ----------------------------------------------------------------------------
-- ⚠️ CRITICAL: Replace 'PLACEHOLDER_ADMIN_EMAIL@example.com' in THREE locations:
--   1. Line 425 (below)
--   2. Line 433 (verification)
--   3. Line 739 (final verification)

INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  id,
  id,
  'Initial admin - RLS migration 2026-10-15'
FROM auth.users
WHERE email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← LOCATION 1: REPLACE THIS
ON CONFLICT (user_id) DO NOTHING;

-- Verify configured admin was inserted
DO $$
DECLARE
  configured_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';  -- ← LOCATION 2: MUST MATCH ABOVE
  email_in_auth_users BOOLEAN;
  email_in_admin_users BOOLEAN;
  admin_count INTEGER;
BEGIN
  -- Verify email exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = configured_email
  ) INTO email_in_auth_users;

  IF NOT email_in_auth_users THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Configured admin email "%" not found in auth.users. Run Preflight 1 to identify valid emails.', configured_email;
  END IF;

  -- Verify email was inserted into admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = configured_email
  ) INTO email_in_admin_users;

  IF NOT email_in_admin_users THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Configured admin email "%" was not inserted into admin_users. Check for conflicts or data issues.', configured_email;
  END IF;

  SELECT COUNT(*) INTO admin_count FROM admin_users;

  RAISE NOTICE '✅ Admin user verified: % (total admins: %)', configured_email, admin_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 7: Create secure policies for PRODUCTS (5 policies)
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
-- Step 8: Create secure policies for PRODUCT_VARIANTS (4 policies)
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
-- Step 9: Create secure policies for ORDERS (4 policies)
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
-- Step 10: Create secure policies for ORDER_ITEMS (4 policies)
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
-- Step 11: Create secure policies for CUSTOM_QUOTES (4 policies)
-- ----------------------------------------------------------------------------
-- ⚠️ CRITICAL: RLS WITH CHECK validates row values but does NOT provide
-- column-level protection. Anonymous users with INSERT table privilege can
-- mention any column in their INSERT statement.
--
-- RECOMMENDED: Implement server-side quote submission API that:
-- 1. Accepts only allowed customer fields from request
-- 2. Validates and sanitizes input
-- 3. Uses service_role key to INSERT with explicit column list
-- 4. Never exposes admin-only columns to client
--
-- ALTERNATIVE: Revoke INSERT privilege from anon, grant column-level INSERT:
--   REVOKE INSERT ON custom_quotes FROM anon;
--   GRANT INSERT (customer_name, email, phone, project_description,
--                 application, quantity, dimensions, material, deadline)
--   ON custom_quotes TO anon;
--
-- Current policy provides VALUE validation only (defense in depth)

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate customer-editable fields
    customer_name IS NOT NULL
    AND LENGTH(TRIM(customer_name)) > 0
    AND LENGTH(customer_name) <= 200

    AND (
      (email IS NOT NULL AND LENGTH(TRIM(email)) > 0
       AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      OR (phone IS NOT NULL AND LENGTH(TRIM(phone)) > 0)
    )

    AND project_description IS NOT NULL
    AND LENGTH(TRIM(project_description)) > 0
    AND LENGTH(project_description) <= 5000

    -- Validate admin-only fields are NOT set to non-NULL
    -- (Cannot prevent column from being mentioned, only validate value)
    AND product_id IS NULL
    AND custom_dimensions IS NULL
    AND feasibility_assessment IS NULL
    AND quote_response IS NULL

    -- Force status to 'submitted' or NULL (default will apply)
    AND (status IS NULL OR status = 'submitted')
  );

COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Does NOT prevent columns from being mentioned. For true column-level security, use column-level grants or server-side API.';

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
-- Step 12: Create policy for ADMIN_USERS (1 policy)
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies = only roles with rolbypassrls can modify

COMMENT ON POLICY "admin_users_read" ON admin_users IS
  'Admins can read admin list. Non-recursive: is_admin() owner has rolbypassrls, bypasses RLS when querying admin_users.';

-- ----------------------------------------------------------------------------
-- Step 13: Verify exact policy definitions (fail-closed)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  -- Expected policy definitions (sorted)
  expected_policies TEXT[] := ARRAY[
    'admin_users.admin_users_read',
    'custom_quotes.admin_delete_quotes',
    'custom_quotes.admin_select_quotes',
    'custom_quotes.admin_update_quotes',
    'custom_quotes.public_insert_quotes',
    'order_items.admin_delete_order_items',
    'order_items.admin_insert_order_items',
    'order_items.admin_select_order_items',
    'order_items.admin_update_order_items',
    'orders.admin_delete_orders',
    'orders.admin_insert_orders',
    'orders.admin_select_orders',
    'orders.admin_update_orders',
    'product_variants.admin_delete_variants',
    'product_variants.admin_insert_variants',
    'product_variants.admin_update_variants',
    'product_variants.public_select_variants',
    'products.admin_delete_products',
    'products.admin_insert_products',
    'products.admin_select_products',
    'products.admin_update_products',
    'products.public_select_published_products'
  ];

  -- Actual policies (sorted)
  actual_policies TEXT[];

  -- Policy counts
  total_policies INTEGER;
  policies_using_is_admin INTEGER;
  public_policies INTEGER;

  -- Missing/unexpected
  missing_policies TEXT[];
  unexpected_policies TEXT[];

  -- RLS state
  tables_without_rls INTEGER;

  -- Admin verification
  configured_admin_exists BOOLEAN;

  -- Function privileges
  func_execute_grantees TEXT[];

BEGIN
  RAISE NOTICE 'Running comprehensive fail-closed verification...';

  -- Get actual policy names (sorted)
  SELECT ARRAY_AGG(tablename || '.' || policyname ORDER BY tablename || '.' || policyname)
  INTO actual_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  -- Find missing policies (in expected but not in actual)
  SELECT ARRAY_AGG(policy ORDER BY policy)
  INTO missing_policies
  FROM unnest(expected_policies) policy
  WHERE policy != ALL(actual_policies);

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Missing policies: %', missing_policies;
  END IF;

  -- Find unexpected policies (in actual but not in expected)
  SELECT ARRAY_AGG(policy ORDER BY policy)
  INTO unexpected_policies
  FROM unnest(actual_policies) policy
  WHERE policy != ALL(expected_policies);

  IF unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected policies found: %', unexpected_policies;
  END IF;

  -- Verify total policy count (22 = 19 admin + 3 public)
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  IF total_policies != 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 22 policies, found %', total_policies;
  END IF;

  -- Count policies using is_admin() (19 policies: all admin policies including admin_users_read)
  SELECT COUNT(*) INTO policies_using_is_admin
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND (qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%');

  IF policies_using_is_admin != 19 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 19 policies using is_admin(), found %', policies_using_is_admin;
  END IF;

  -- Count public policies (3: products SELECT, variants SELECT, quotes INSERT)
  SELECT COUNT(*) INTO public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'public_%';

  IF public_policies != 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 3 public policies, found %', public_policies;
  END IF;

  -- Verify no unsafe permissive USING(true) for UPDATE/DELETE
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
      AND permissive = 'PERMISSIVE'
      AND 'authenticated' = ANY(roles)
      AND qual = 'true'::text
      AND cmd IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found unsafe permissive USING(true) policies for UPDATE/DELETE';
  END IF;

  -- Verify RLS enabled on all six tables
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND NOT c.relrowsecurity;

  IF tables_without_rls > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % tables do not have RLS enabled', tables_without_rls;
  END IF;

  -- Verify configured admin exists in admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← LOCATION 3: MUST MATCH STEP 6
  ) INTO configured_admin_exists;

  IF NOT configured_admin_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Configured admin email not in admin_users table';
  END IF;

  -- Verify is_admin() function privileges
  SELECT ARRAY_AGG(grantee::text ORDER BY grantee::text)
  INTO func_execute_grantees
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name = 'is_admin'
    AND privilege_type = 'EXECUTE';

  IF 'anon' = ANY(func_execute_grantees) OR 'PUBLIC' = ANY(func_execute_grantees) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() grants EXECUTE to anon or PUBLIC. Grantees: %', func_execute_grantees;
  END IF;

  IF NOT ('authenticated' = ANY(func_execute_grantees)) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() missing EXECUTE grant to authenticated. Grantees: %', func_execute_grantees;
  END IF;

  -- Verify admin_users has no write policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users has write policies (should be rolbypassrls-only)';
  END IF;

  RAISE NOTICE '✅ All verifications passed';
  RAISE NOTICE '   Total policies: 22 (19 admin + 3 public)';
  RAISE NOTICE '   All policy names match expected list (sorted comparison)';
  RAISE NOTICE '   No missing or unexpected policies';
  RAISE NOTICE '   RLS enabled on all six tables';
  RAISE NOTICE '   Configured admin exists in admin_users';
  RAISE NOTICE '   Function EXECUTE grants correct: %', func_execute_grantees;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (MANDATORY - Run immediately after COMMIT)
-- ============================================================================

-- Postflight 1: List all policies with exact definitions
SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, policyname;

-- Expected: 22 rows with exact names matching migration

-- Postflight 2: Verify is_admin() function security attributes
SELECT
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as is_security_definer,
  r.rolsuper,
  r.rolbypassrls,
  p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- Expected: SECURITY DEFINER = true, (rolbypassrls = true OR rolsuper = true)

-- Postflight 3: Verify function execute privileges
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin'
ORDER BY grantee;

-- Expected: Only authenticated (not anon, not PUBLIC)

-- Postflight 4: List all admin users
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.granted_by,
  granter.email as granted_by_email,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
LEFT JOIN auth.users granter ON granter.id = au.granted_by
ORDER BY au.granted_at;

-- Verify configured admin email is present

-- Postflight 5: Verify RLS state on all six tables
SELECT
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  pg_get_userbyid(c.relowner) as owner
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All have rls_enabled = true, admin_users has force_rls = false

-- Postflight 6: Verify no legacy unsafe policies remain
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%authenticated_full_access%'
    OR policyname LIKE '%Admins have full access%'
    OR policyname = 'Anyone can submit quotes'
  );

-- Expected: 0 rows

-- Postflight 7: Verify record counts unchanged
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes
UNION ALL SELECT 'admin_users', COUNT(*) FROM admin_users;

-- Compare with Preflight 8 (admin_users will be new)

-- Postflight 8: Verify table grants unchanged for existing tables
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Compare with Preflight 5 - should be identical

-- Postflight 9: Test is_admin() function (context-dependent)
SELECT public.is_admin() as am_i_admin;

-- Expected: Depends on execution context
-- SQL Editor: May return false (uses SQL Editor session, not browser)
-- If signed in as configured admin in SQL Editor: should return true

-- Postflight 10: Verify admin_users write protection
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_users'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

-- Expected: 0 rows (no write policies)

-- ============================================================================
-- STATIC VERIFICATION QUERIES (Can run anytime to check state)
-- ============================================================================

-- Check 1: Policy count by table
SELECT
  tablename,
  COUNT(*) as policy_count,
  ARRAY_AGG(policyname ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
GROUP BY tablename
ORDER BY tablename;

-- Expected: products=5, product_variants=4, orders=4, order_items=4, custom_quotes=4, admin_users=1

-- Check 2: Verify no permissive policies with USING(true) for authenticated
SELECT
  tablename,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text
ORDER BY tablename, cmd;

-- Expected: Only public_select_variants (SELECT, {anon,authenticated})

-- Check 3: Verify all admin policies reference is_admin()
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%' THEN 'YES'
    ELSE 'NO - ERROR'
  END as uses_is_admin
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'admin_%'
ORDER BY tablename, policyname;

-- Expected: All show 'YES'

-- ============================================================================
-- MANUAL TESTING PROCEDURES
-- ============================================================================

/*
TEST 1: Anonymous User (Incognito Browser, Not Signed In)
----------------------------------------------------------
Steps:
1. Navigate to /explore
   Expected: Published products visible

2. Click product detail page
   Expected: Product loads with details

3. Navigate to /admin
   Expected: Redirected to /admin/login OR access denied

4. Via browser DevTools console, attempt Supabase query:
   supabase.from('products').select('*').eq('published', false)
   Expected: Empty result (unpublished products not visible)

5. Via browser DevTools, attempt quote submission with admin fields:
   supabase.from('custom_quotes').insert({
     customer_name: 'Test',
     email: 'test@example.com',
     project_description: 'Test',
     status: 'quoted',  // Admin field
     product_id: '00000000-0000-0000-0000-000000000000'  // Admin field
   })
   Expected: Error (WITH CHECK violation) OR success with admin fields NULL

6. Valid quote submission:
   supabase.from('custom_quotes').insert({
     customer_name: 'Test',
     email: 'test@example.com',
     project_description: 'Test description'
   })
   Expected: Success (if table INSERT granted to anon)

TEST 2: Non-Admin Authenticated User (Different Account)
---------------------------------------------------------
Steps:
1. Create new account: email different from configured admin
2. Sign in successfully
3. Navigate to /explore
   Expected: Published products visible

4. Navigate to /admin
   Expected: Page may load (client-side check only)
   Browser console shows RLS errors when queries run

5. Via browser DevTools, attempt to query products:
   supabase.from('products').select('*')
   Expected: Only published products visible (admin policy denies unpublished)

6. Attempt to create product:
   supabase.from('products').insert({name: 'Test', ...})
   Expected: Error (permission denied / RLS policy violation)

7. Attempt to query admin_users:
   supabase.from('admin_users').select('*')
   Expected: Error (permission denied / RLS policy violation)

8. Call is_admin() function:
   supabase.rpc('is_admin')
   Expected: Returns false

TEST 3: Admin User (Configured Admin Account)
----------------------------------------------
Steps:
1. Sign in with configured admin email
2. Navigate to /admin
   Expected: Dashboard loads with statistics

3. Navigate to /admin/products
   Expected: All products visible (published and unpublished)

4. Create new test product
   Expected: Success

5. Edit existing product
   Expected: Success

6. Delete test product
   Expected: Success

7. Navigate to /admin/quotes
   Expected: All quotes visible

8. Update quote status
   Expected: Success

9. Via browser DevTools, query admin_users:
   supabase.from('admin_users').select('*')
   Expected: Success, admin list visible

10. Call is_admin() function:
    supabase.rpc('is_admin')
    Expected: Returns true

TEST 4: Quote Column-Level Security (SQL or DevTools)
------------------------------------------------------
As authenticated non-admin user via SQL or DevTools:

Test A: Attempt INSERT with admin-only fields set to non-NULL
INSERT INTO custom_quotes (
  customer_name, email, project_description,
  status, product_id, feasibility_assessment
) VALUES (
  'Test', 'test@example.com', 'Test',
  'quoted', '00000000-0000-0000-0000-000000000000', '{"can_print": true}'::jsonb
);

Expected: Error (WITH CHECK constraint violation)

Test B: Valid INSERT without admin fields
INSERT INTO custom_quotes (
  customer_name, email, project_description
) VALUES (
  'Valid Test', 'valid@example.com', 'Valid description'
);

Expected: Success, status defaults to 'submitted', admin fields NULL

Test C: Verify admin fields are NULL
SELECT id, customer_name, status, product_id, feasibility_assessment
FROM custom_quotes
WHERE customer_name = 'Valid Test';

Expected: status = 'submitted', product_id = NULL, feasibility_assessment = NULL
*/

-- ============================================================================
-- EMERGENCY ROLLBACK PROCEDURES
-- ============================================================================

/*
⚠️ CRITICAL: Do NOT restore unsafe policies in rollback
⚠️ Do NOT drop policies from all tables in public schema
⚠️ Only modify the six target tables: products, product_variants, orders,
   order_items, custom_quotes, admin_users

OPTION 1: Fix Forward (Preferred - Maintains Security)
-------------------------------------------------------
Scenario A: Admin access broken

BEGIN;
-- Use service role (Supabase Dashboard SQL Editor)
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT id, id, 'Emergency admin restoration'
FROM auth.users
WHERE email = 'your-actual-admin-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
COMMIT;

Scenario B: Public access broken

BEGIN;
-- Restore ONLY public read policies
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (true);
COMMIT;

OPTION 2: Remove All Policies from Target Tables (Emergency Admin-Only Access)
-------------------------------------------------------------------------------
BEGIN;
-- Drop all policies from the six target tables only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;
COMMIT;

-- Result: Only service_role can access these tables
-- Use service role to manually manage data until policies fixed

OPTION 3: Full Database Restore (Last Resort)
----------------------------------------------
1. Restore from backup (Supabase Dashboard > Database > Backups)
2. Review migration failure in logs
3. Fix migration SQL
4. Re-test on non-production copy
5. Re-run on production

DO NOT:
❌ Restore authenticated_full_access_* policies
❌ Create permissive USING(true) for UPDATE/DELETE
❌ Drop policies from unrelated tables
❌ Disable RLS
*/

-- ============================================================================
-- ADMIN MANAGEMENT POST-MIGRATION
-- ============================================================================

/*
All admin management requires service_role key (Supabase Dashboard)

Add new admin:
--------------
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT
  (SELECT id FROM auth.users WHERE email = 'newadmin@example.com'),
  (SELECT id FROM auth.users WHERE email = 'current-admin@example.com'),
  'Added by current-admin on 2026-10-XX'
ON CONFLICT (user_id) DO NOTHING;

Remove admin:
-------------
DELETE FROM admin_users
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oldadmin@example.com');

List all admins:
----------------
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

Check specific user:
--------------------
SELECT EXISTS (
  SELECT 1 FROM admin_users
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com')
) as is_admin;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
