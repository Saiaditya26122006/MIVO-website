-- ============================================================================
-- MIVO RLS Security Remediation - FINAL VERIFIED VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Status: ⚠️ NOT APPROVED - Awaiting preflight verification and approval
--
-- CRITICAL REQUIREMENTS BEFORE EXECUTION:
-- 1. All 9 preflight queries must be run and results documented
-- 2. Admin email configured in SINGLE location (admin_email variable)
-- 3. Database backup created and verified
-- 4. Manual review of this SQL and documentation
-- 5. Explicit written approval
-- ============================================================================

-- ============================================================================
-- ADMINISTRATOR EMAIL CONFIGURATION
-- ============================================================================
-- ⚠️ CRITICAL: Configure admin email ONCE here
-- This value is used throughout the migration for all admin checks
-- Update this line with the actual admin email from Preflight 1:

\set admin_email 'PLACEHOLDER_ADMIN_EMAIL@example.com'

-- Verification: Email will be validated in Step 7 before any changes committed
-- Migration will ABORT if email not found in auth.users
-- ============================================================================

-- ============================================================================
-- SECURITY MODEL SUMMARY
-- ============================================================================
-- DATABASE AUTHORIZATION (This Migration):
--   - admin_users table: Allowlist controlled by roles with rolbypassrls
--   - is_admin() function: SECURITY DEFINER, owner has rolbypassrls
--   - Function bypasses RLS when querying admin_users (non-recursive)
--   - 19 admin policies: Use is_admin() for authorization
--   - 3 public policies: Limited read access, NO anonymous write to quotes
--
-- APPLICATION AUTHORIZATION (NOT in This Migration):
--   - Admin routes (/admin/*): Currently only check if authenticated
--   - REQUIRED POST-MIGRATION: Add server-side is_admin() check
--   - Example: const {data} = await supabase.rpc('is_admin'); if (!data) redirect('/');
--
-- QUOTE SUBMISSION SECURITY (This Migration):
--   - Anonymous INSERT to custom_quotes: REVOKED (no table-level INSERT privilege)
--   - Column-level INSERT: GRANTED to anon for customer-editable fields only
--   - Protected columns: Cannot be set by anonymous users (enforced by grants)
--   - Admin-only operations: Managed via RLS policies requiring is_admin()
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (MANDATORY - Run ALL 9 queries)
-- ============================================================================

-- Preflight 1: Identify all Auth users and select admin email
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_user_meta_data ->> 'name' as name
FROM auth.users
ORDER BY created_at;

-- ⚠️ ACTION: Choose admin email, update \set admin_email at top of file

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

-- Document all existing policies for audit trail

-- Preflight 3: Verify all six tables exist and check for admin_users
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY table_name;

-- Expected: 5 tables (admin_users may not exist yet)

-- Preflight 4: If admin_users exists, validate complete structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Expected if exists: user_id (uuid, not null), granted_by (uuid, null ok),
--                    granted_at (timestamptz, has default), notes (text, null ok)

-- Preflight 5: Verify RLS state on existing tables
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

-- Document RLS state and ownership for all tables

-- Preflight 6: Document current table-level grants (will be preserved)
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Document baseline - table grants will be preserved by migration

-- Preflight 7: Document custom_quotes schema for column-grant design
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_quotes'
ORDER BY ordinal_position;

-- Identify customer-editable vs admin-only columns
-- Customer-editable: customer_name, email, phone, project_description,
--                    application, quantity, dimensions, material, deadline
-- Admin-only: id, product_id, custom_dimensions, feasibility_assessment,
--             quote_response, status, created_at, updated_at, attachments

-- Preflight 8: Check for existing is_admin function
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

-- If exists: Will validate security attributes before replacing

-- Preflight 9: Record counts (baseline for comparison)
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes;

-- ============================================================================
-- MAIN MIGRATION (Execute only after ALL preflight checks complete)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Verify all expected tables exist
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(expected_table ORDER BY expected_table)
  INTO missing_tables
  FROM (
    SELECT unnest(ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes']) as expected_table
  ) e
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = e.expected_table
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Missing required tables: %. Initialize schema before running this migration.', missing_tables;
  END IF;

  RAISE NOTICE '✅ All five business tables exist';
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: Enable RLS on all existing tables
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
    EXECUTE 'ALTER TABLE products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE order_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE custom_quotes ENABLE ROW LEVEL SECURITY';
  END IF;

  RAISE NOTICE '✅ RLS enabled on all business tables';
END $$;

-- ----------------------------------------------------------------------------
-- Step 3: Validate or create admin_users table with exact schema
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  table_exists BOOLEAN;
  expected_columns TEXT[] := ARRAY['user_id', 'granted_by', 'granted_at', 'notes'];
  actual_columns TEXT[];
  unexpected_columns TEXT[];
  column_check RECORD;
  fk_check RECORD;
  pk_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE 'Validating existing admin_users table...';

    -- Get actual columns
    SELECT ARRAY_AGG(column_name ORDER BY column_name)
    INTO actual_columns
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users';

    -- Check for unexpected columns
    SELECT ARRAY_AGG(col ORDER BY col)
    INTO unexpected_columns
    FROM unnest(actual_columns) col
    WHERE col != ALL(expected_columns);

    IF unexpected_columns IS NOT NULL THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users has unexpected columns: %. Expected only: %. Drop table manually and re-run.',
        unexpected_columns, expected_columns;
    END IF;

    -- Check each expected column has correct type
    FOR column_check IN
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
    LOOP
      CASE column_check.column_name
        WHEN 'user_id' THEN
          IF column_check.data_type != 'uuid' OR column_check.is_nullable != 'NO' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.user_id has wrong type/nullable (expected: uuid NOT NULL, got: % %)',
              column_check.data_type, column_check.is_nullable;
          END IF;
        WHEN 'granted_by' THEN
          IF column_check.data_type != 'uuid' OR column_check.is_nullable != 'YES' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_by has wrong type/nullable (expected: uuid NULL, got: % %)',
              column_check.data_type, column_check.is_nullable;
          END IF;
        WHEN 'granted_at' THEN
          IF column_check.data_type != 'timestamp with time zone' OR column_check.is_nullable != 'YES' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_at has wrong type/nullable (expected: timestamptz NULL with default, got: % %)',
              column_check.data_type, column_check.is_nullable;
          END IF;
          IF column_check.column_default IS NULL THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_at missing default (expected: DEFAULT NOW())';
          END IF;
        WHEN 'notes' THEN
          IF column_check.data_type != 'text' OR column_check.is_nullable != 'YES' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.notes has wrong type/nullable (expected: text NULL, got: % %)',
              column_check.data_type, column_check.is_nullable;
          END IF;
      END CASE;
    END LOOP;

    -- Verify PRIMARY KEY on user_id
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'admin_users'
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name IN (
          SELECT constraint_name FROM information_schema.key_column_usage
          WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'user_id'
        )
    ) INTO pk_exists;

    IF NOT pk_exists THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.user_id is not PRIMARY KEY';
    END IF;

    -- Verify FOREIGN KEY from user_id to auth.users(id) with ON DELETE CASCADE
    SELECT constraint_name, delete_rule
    INTO fk_check
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND rc.constraint_schema = kcu.constraint_schema
    WHERE rc.constraint_schema = 'public'
      AND kcu.table_name = 'admin_users'
      AND kcu.column_name = 'user_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.user_id missing FOREIGN KEY to auth.users(id)';
    END IF;

    IF fk_check.delete_rule != 'CASCADE' THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.user_id FK has wrong delete rule (expected: CASCADE, got: %)',
        fk_check.delete_rule;
    END IF;

    -- Verify FOREIGN KEY from granted_by to auth.users(id) with ON DELETE SET NULL
    SELECT constraint_name, delete_rule
    INTO fk_check
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND rc.constraint_schema = kcu.constraint_schema
    WHERE rc.constraint_schema = 'public'
      AND kcu.table_name = 'admin_users'
      AND kcu.column_name = 'granted_by';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_by missing FOREIGN KEY to auth.users(id)';
    END IF;

    IF fk_check.delete_rule != 'SET NULL' THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_by FK has wrong delete rule (expected: SET NULL, got: %)',
        fk_check.delete_rule;
    END IF;

    RAISE NOTICE '✅ Existing admin_users table validated (exact schema match)';
  ELSE
    -- Create new table with exact schema
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
      'Admin allowlist. Only roles with rolbypassrls can INSERT/UPDATE/DELETE.';

    RAISE NOTICE '✅ Created admin_users table with exact schema';
  END IF;
END $$;

-- Enable RLS on admin_users (required for non-recursive pattern)
-- NOTE: NOT using FORCE ROW LEVEL SECURITY
-- Reason: Function owner needs to bypass RLS to avoid infinite recursion
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Step 4: Create or replace is_admin() function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Queries admin_users table as function owner
  -- Owner must have rolbypassrls = true to avoid infinite recursion
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

  IF NOT (func_owner_rolbypassrls OR func_owner_rolsuper) THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: is_admin() owner "%" does not have rolbypassrls or rolsuper. This would cause infinite recursion when querying admin_users.', func_owner;
  END IF;

  RAISE NOTICE '✅ is_admin() verified: owner=%, rolbypassrls=%, rolsuper=%',
    func_owner, func_owner_rolbypassrls, func_owner_rolsuper;
END $$;

-- Set function execution privileges
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Non-recursive admin check. Owner has rolbypassrls, bypasses RLS when querying admin_users.';

-- ----------------------------------------------------------------------------
-- Step 5: Drop ALL existing policies on six target tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
  dropped_count INTEGER := 0;
  target_tables TEXT[] := ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users'];
BEGIN
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
    RAISE NOTICE 'Dropped: %.%.%', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  RAISE NOTICE '✅ Dropped % policies from target tables', dropped_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: Revoke anonymous INSERT on custom_quotes (prepare for column grants)
-- ----------------------------------------------------------------------------

-- Remove table-level INSERT privilege from anon
-- Will replace with column-level grants for customer-editable fields only
REVOKE INSERT ON custom_quotes FROM anon;

-- Grant column-level INSERT for customer-editable fields only
GRANT INSERT (
  customer_name,
  email,
  phone,
  project_description,
  application,
  quantity,
  dimensions,
  material,
  deadline
) ON custom_quotes TO anon;

-- Verify column-level grants were applied
DO $$
DECLARE
  table_level_insert BOOLEAN;
  column_grants TEXT[];
BEGIN
  -- Check for table-level INSERT (should NOT exist for anon)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'custom_quotes'
      AND grantee = 'anon'
      AND privilege_type = 'INSERT'
  ) INTO table_level_insert;

  IF table_level_insert THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: anon still has table-level INSERT on custom_quotes (should be column-level only)';
  END IF;

  -- Get column-level grants
  SELECT ARRAY_AGG(column_name ORDER BY column_name)
  INTO column_grants
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'custom_quotes'
    AND grantee = 'anon'
    AND privilege_type = 'INSERT';

  RAISE NOTICE '✅ Column-level INSERT grants for anon on custom_quotes: %', column_grants;

  -- Verify protected columns NOT in grants
  IF 'id' = ANY(column_grants)
    OR 'product_id' = ANY(column_grants)
    OR 'custom_dimensions' = ANY(column_grants)
    OR 'feasibility_assessment' = ANY(column_grants)
    OR 'quote_response' = ANY(column_grants)
    OR 'status' = ANY(column_grants)
    OR 'created_at' = ANY(column_grants)
    OR 'updated_at' = ANY(column_grants)
    OR 'attachments' = ANY(column_grants)
  THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: anon has INSERT grant on protected columns';
  END IF;

  RAISE NOTICE '✅ Protected columns verified: NOT in anon INSERT grants';
END $$;

-- ----------------------------------------------------------------------------
-- Step 7: Validate and insert admin user (using configured email)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  admin_email TEXT := :'admin_email';  -- Get from \set variable
  admin_user_id UUID;
  admin_exists_in_auth BOOLEAN;
  admin_exists_in_admin_users BOOLEAN;
  existing_admin_count INTEGER;
BEGIN
  -- Verify email is not placeholder
  IF admin_email = 'PLACEHOLDER_ADMIN_EMAIL@example.com' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email not configured. Update \set admin_email at top of file with actual email from Preflight 1.';
  END IF;

  -- Verify email exists in auth.users and get user_id
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email "%" not found in auth.users. Run Preflight 1 to identify valid emails.', admin_email;
  END IF;

  -- Insert admin (if not already present)
  INSERT INTO admin_users (user_id, granted_by, notes)
  VALUES (
    admin_user_id,
    admin_user_id,
    'Initial admin - RLS migration ' || CURRENT_DATE
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Verify configured admin is now in admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = admin_user_id
  ) INTO admin_exists_in_admin_users;

  IF NOT admin_exists_in_admin_users THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email "%" was not inserted into admin_users (check for conflicts or data issues).', admin_email;
  END IF;

  -- Count total admins
  SELECT COUNT(*) INTO existing_admin_count FROM admin_users;

  -- Critical: Verify ONLY configured admin exists (or pre-existing admins are documented)
  IF existing_admin_count > 1 THEN
    RAISE NOTICE 'WARNING: % admins exist in admin_users. Verify all are intended.', existing_admin_count;
  END IF;

  RAISE NOTICE '✅ Admin user verified: % (user_id: %, total admins: %)',
    admin_email, admin_user_id, existing_admin_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 8: Create secure policies for PRODUCTS (5 policies)
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
-- Step 9: Create secure policies for PRODUCT_VARIANTS (4 policies)
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
-- Step 10: Create secure policies for ORDERS (4 policies)
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
-- Step 11: Create secure policies for ORDER_ITEMS (4 policies)
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
-- Step 12: Create secure policies for CUSTOM_QUOTES (4 policies)
-- ----------------------------------------------------------------------------
-- Note: Anonymous INSERT now protected by column-level grants (Step 6)
-- Policy validates row-level constraints, grants enforce column-level access

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
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
  );

COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Column-level access controlled by GRANT (Step 6).';

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
-- Step 13: Create policy for ADMIN_USERS (1 policy)
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY "admin_users_read" ON admin_users IS
  'Admins can read admin list. Non-recursive: owner has rolbypassrls.';

-- ----------------------------------------------------------------------------
-- Step 14: Comprehensive fail-closed verification
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  -- Admin email configuration
  admin_email TEXT := :'admin_email';
  admin_in_admin_users BOOLEAN;

  -- Expected policies (sorted)
  expected_policies TEXT[] := ARRAY[
    'admin_users.admin_users_read.SELECT.PERMISSIVE.{authenticated}',
    'custom_quotes.admin_delete_quotes.DELETE.PERMISSIVE.{authenticated}',
    'custom_quotes.admin_select_quotes.SELECT.PERMISSIVE.{authenticated}',
    'custom_quotes.admin_update_quotes.UPDATE.PERMISSIVE.{authenticated}',
    'custom_quotes.public_insert_quotes.INSERT.PERMISSIVE.{anon,authenticated}',
    'order_items.admin_delete_order_items.DELETE.PERMISSIVE.{authenticated}',
    'order_items.admin_insert_order_items.INSERT.PERMISSIVE.{authenticated}',
    'order_items.admin_select_order_items.SELECT.PERMISSIVE.{authenticated}',
    'order_items.admin_update_order_items.UPDATE.PERMISSIVE.{authenticated}',
    'orders.admin_delete_orders.DELETE.PERMISSIVE.{authenticated}',
    'orders.admin_insert_orders.INSERT.PERMISSIVE.{authenticated}',
    'orders.admin_select_orders.SELECT.PERMISSIVE.{authenticated}',
    'orders.admin_update_orders.UPDATE.PERMISSIVE.{authenticated}',
    'product_variants.admin_delete_variants.DELETE.PERMISSIVE.{authenticated}',
    'product_variants.admin_insert_variants.INSERT.PERMISSIVE.{authenticated}',
    'product_variants.admin_update_variants.UPDATE.PERMISSIVE.{authenticated}',
    'product_variants.public_select_variants.SELECT.PERMISSIVE.{anon,authenticated}',
    'products.admin_delete_products.DELETE.PERMISSIVE.{authenticated}',
    'products.admin_insert_products.INSERT.PERMISSIVE.{authenticated}',
    'products.admin_select_products.SELECT.PERMISSIVE.{authenticated}',
    'products.admin_update_products.UPDATE.PERMISSIVE.{authenticated}',
    'products.public_select_published_products.SELECT.PERMISSIVE.{anon,authenticated}'
  ];
  actual_policies TEXT[];
  missing_policies TEXT[];
  unexpected_policies TEXT[];

  -- Policy counts
  total_policies INTEGER;
  policies_using_is_admin INTEGER;
  public_policies INTEGER;

  -- RLS state
  tables_without_rls INTEGER;

  -- Function privileges
  func_execute_grantees TEXT[];

  -- Column grants
  quote_column_grants TEXT[];

BEGIN
  RAISE NOTICE 'Running comprehensive fail-closed verification...';

  -- 1. Verify configured admin exists
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = admin_email
  ) INTO admin_in_admin_users;

  IF NOT admin_in_admin_users THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Configured admin "%" not in admin_users', admin_email;
  END IF;

  -- 2. Verify exact policy definitions
  SELECT ARRAY_AGG(
    tablename || '.' || policyname || '.' || cmd || '.' || permissive || '.' || roles::text
    ORDER BY tablename || '.' || policyname
  )
  INTO actual_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  -- Find missing
  SELECT ARRAY_AGG(policy ORDER BY policy)
  INTO missing_policies
  FROM unnest(expected_policies) policy
  WHERE policy != ALL(actual_policies);

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Missing policies: %', missing_policies;
  END IF;

  -- Find unexpected
  SELECT ARRAY_AGG(policy ORDER BY policy)
  INTO unexpected_policies
  FROM unnest(actual_policies) policy
  WHERE policy != ALL(expected_policies);

  IF unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected policies: %', unexpected_policies;
  END IF;

  -- 3. Verify policy counts
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  IF total_policies != 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 22 policies, found %', total_policies;
  END IF;

  SELECT COUNT(*) INTO policies_using_is_admin
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND (qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%');

  IF policies_using_is_admin != 19 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 19 policies using is_admin(), found %', policies_using_is_admin;
  END IF;

  SELECT COUNT(*) INTO public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'public_%';

  IF public_policies != 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 3 public policies, found %', public_policies;
  END IF;

  -- 4. Verify no unsafe permissive policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
      AND permissive = 'PERMISSIVE'
      AND 'authenticated' = ANY(roles)
      AND qual = 'true'::text
      AND cmd IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found unsafe permissive USING(true) for UPDATE/DELETE';
  END IF;

  -- 5. Verify RLS enabled
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND NOT c.relrowsecurity;

  IF tables_without_rls > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % tables missing RLS', tables_without_rls;
  END IF;

  -- 6. Verify function privileges
  SELECT ARRAY_AGG(grantee::text ORDER BY grantee)
  INTO func_execute_grantees
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name = 'is_admin'
    AND privilege_type = 'EXECUTE';

  IF 'anon' = ANY(func_execute_grantees) OR 'PUBLIC' = ANY(func_execute_grantees) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() grants EXECUTE to anon/PUBLIC';
  END IF;

  IF NOT ('authenticated' = ANY(func_execute_grantees)) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() missing EXECUTE for authenticated';
  END IF;

  -- 7. Verify admin_users write protection
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users has write policies';
  END IF;

  -- 8. Verify column-level grants for quotes
  SELECT ARRAY_AGG(column_name ORDER BY column_name)
  INTO quote_column_grants
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'custom_quotes'
    AND grantee = 'anon'
    AND privilege_type = 'INSERT';

  IF quote_column_grants IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No column-level INSERT grants for anon on custom_quotes';
  END IF;

  IF 'id' = ANY(quote_column_grants)
    OR 'status' = ANY(quote_column_grants)
    OR 'product_id' = ANY(quote_column_grants)
  THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: anon has INSERT on protected quote columns';
  END IF;

  RAISE NOTICE '✅ All verifications passed';
  RAISE NOTICE '   Policies: 22 (19 admin + 3 public)';
  RAISE NOTICE '   Policy definitions: exact match';
  RAISE NOTICE '   Function grants: %', func_execute_grantees;
  RAISE NOTICE '   Quote column grants: %', quote_column_grants;
  RAISE NOTICE '   Configured admin: %', admin_email;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run immediately after COMMIT)
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

-- Expected: 22 rows matching migration definitions

-- Postflight 2: Verify is_admin() function security
SELECT
  p.proname,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  r.rolsuper,
  r.rolbypassrls
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'is_admin';

-- Expected: security_definer=true, (rolbypassrls=true OR rolsuper=true)

-- Postflight 3: Verify column-level grants on custom_quotes
SELECT
  grantee,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'custom_quotes'
  AND grantee = 'anon'
ORDER BY column_name;

-- Expected: INSERT grants on customer-editable columns only

-- Postflight 4: List all admin users
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;

-- Verify configured admin email present

-- Postflight 5: Verify RLS state
SELECT
  c.relname,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All rls_enabled=true, admin_users force_rls=false

-- Postflight 6: Verify record counts
SELECT
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes
UNION ALL SELECT 'admin_users', COUNT(*) FROM admin_users;

-- Compare with Preflight 9

-- ============================================================================
-- MANUAL SECURITY TESTING (Execute in specified contexts)
-- ============================================================================

/*
CONTEXT TYPES:
A. Browser/API (anonymous): Incognito browser, not signed in
B. Browser/API (non-admin auth): Signed in with non-admin email
C. Browser/API (admin): Signed in with configured admin email
D. SQL Editor (privileged): Supabase Dashboard SQL Editor (uses service_role context)

TEST 1: Anonymous User - Browser/API Context (Incognito)
---------------------------------------------------------
1. Navigate to /explore in browser
   Expected: Published products visible

2. Via browser DevTools console:
   await supabase.from('products').select('*').eq('published', false)
   Expected: Empty result (unpublished filtered by RLS)

3. Attempt to insert quote with protected columns:
   await supabase.from('custom_quotes').insert({
     customer_name: 'Test',
     email: 'test@test.com',
     project_description: 'Test',
     status: 'quoted',  // Protected column
     product_id: '00000000-0000-0000-0000-000000000000'  // Protected column
   })
   Expected: Error (column-level grant violation OR columns silently ignored)

4. Valid quote insert:
   await supabase.from('custom_quotes').insert({
     customer_name: 'Valid',
     email: 'valid@test.com',
     project_description: 'Valid test'
   })
   Expected: Success

TEST 2: Non-Admin Authenticated - Browser/API Context
------------------------------------------------------
1. Create account with email != configured admin, sign in

2. Via browser DevTools:
   await supabase.from('products').select('*')
   Expected: Only published products (admin policy blocks unpublished)

3. Attempt product insert:
   await supabase.from('products').insert({name: 'Test', ...})
   Expected: Error (RLS policy violation)

4. Attempt admin_users query:
   await supabase.from('admin_users').select('*')
   Expected: Error (RLS policy violation)

5. Call is_admin():
   await supabase.rpc('is_admin')
   Expected: false

TEST 3: Admin User - Browser/API Context
-----------------------------------------
1. Sign in with configured admin email

2. Via browser DevTools:
   await supabase.from('products').select('*')
   Expected: All products (published and unpublished)

3. Create product:
   await supabase.from('products').insert({...})
   Expected: Success

4. Query admin_users:
   await supabase.from('admin_users').select('*')
   Expected: Success, admin list visible

5. Call is_admin():
   await supabase.rpc('is_admin')
   Expected: true

TEST 4: Privileged Operations - SQL Editor Context
---------------------------------------------------
Note: SQL Editor uses service_role context (bypasses RLS)

1. Query admin_users:
   SELECT * FROM admin_users;
   Expected: Success (service_role bypasses RLS)

2. Add new admin:
   INSERT INTO admin_users (user_id, granted_by, notes)
   SELECT id, (SELECT id FROM auth.users WHERE email = :'admin_email'), 'Test admin'
   FROM auth.users WHERE email = 'newadmin@example.com';
   Expected: Success

3. Verify RLS would block non-admin:
   SET ROLE authenticated;
   SET LOCAL session.user_id = '<non-admin-user-id>';
   SELECT * FROM admin_users;
   RESET ROLE;
   Expected: Error or empty (RLS blocks)
*/

-- ============================================================================
-- EMERGENCY PROCEDURES
-- ============================================================================

/*
ROLLBACK IMPLICATIONS:
Removing all policies from target tables means:
- Only service_role can access those tables (superuser bypass)
- All application queries (using anon/authenticated keys) will fail
- Public storefront will break (no product access)
- Admin dashboard will break (no data access)
- Manual data management via SQL Editor (service_role) required until fixed

OPTION 1: Fix Forward (Preferred)
----------------------------------
Scenario: Admin access broken

-- Via SQL Editor (service_role context):
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT id, id, 'Emergency restoration'
FROM auth.users
WHERE email = 'correct-admin@example.com'
ON CONFLICT (user_id) DO NOTHING;

Scenario: Public access broken

-- Restore public policies only:
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated USING (true);

OPTION 2: Remove All Policies (Emergency Service-Role-Only Access)
-------------------------------------------------------------------
-- Via SQL Editor:
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Result: Application will be non-functional until policies restored

OPTION 3: Database Restore (Last Resort)
-----------------------------------------
1. Restore from preflight backup
2. Fix migration issues
3. Re-test
4. Re-run

DO NOT:
❌ Restore authenticated_full_access_* policies
❌ Restore WITH CHECK (true) for quotes
❌ Disable RLS
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
