-- ============================================================================
-- MIVO RLS Security Remediation - FINAL CORRECTED VERSION
-- ============================================================================
-- Purpose: Replace overly permissive RLS policies with least-privilege access
-- Date: 2026-10-15
-- Execution: Supabase SQL Editor (Dashboard > SQL Editor)
-- Status: ⚠️ NOT APPROVED - Requires preflight, backup, and approval
--
-- CRITICAL REQUIREMENTS BEFORE EXECUTION:
-- 1. Run ALL 9 preflight queries and document results
-- 2. Create and verify database backup
-- 3. Configure admin email (find PLACEHOLDER_ADMIN_EMAIL and replace)
-- 4. Verify custom_quotes schema matches expected state
-- 5. Manual review of complete SQL file
-- 6. Explicit written approval
-- ============================================================================

-- ============================================================================
-- ADMINISTRATOR EMAIL CONFIGURATION
-- ============================================================================
-- ⚠️ CRITICAL: Find and replace PLACEHOLDER_ADMIN_EMAIL@example.com
-- with actual admin email from Preflight Query 1
--
-- Search for: PLACEHOLDER_ADMIN_EMAIL@example.com
-- Replace with: actual-admin@yourdomain.com
-- Occurrences: 3 (lines marked with -- [ADMIN_EMAIL])
--
-- DO NOT execute until all placeholders replaced and verified
-- ============================================================================

-- ============================================================================
-- SECURITY MODEL SUMMARY
-- ============================================================================
-- DATABASE AUTHORIZATION (This Migration):
--   - admin_users table: Allowlist controlled by roles with rolbypassrls
--   - is_admin() function: SECURITY DEFINER, owner has rolbypassrls
--   - Function bypasses RLS when querying admin_users (non-recursive)
--   - 19 admin policies: Use is_admin() for authorization
--   - 3 public policies: Limited read access for published content
--   - Column grants: Anonymous INSERT restricted to customer fields only
--
-- APPLICATION AUTHORIZATION (BLOCKERS - NOT in This Migration):
--   - Admin routes (/admin/*): Currently only check authentication
--   - REQUIRED BEFORE DEPLOYMENT: Add server-side is_admin() checks
--   - Example middleware needed:
--     const {data: isAdmin} = await supabase.rpc('is_admin').single();
--     if (!isAdmin) redirect('/');
--
-- KNOWN APPLICATION BLOCKERS:
--   1. Quote submission NOT implemented (app/custom/page.tsx line 28: TODO)
--   2. No admin authorization guards (middleware only checks auth, not is_admin)
--   3. Migration introduces NEW admin pattern (breaks existing admin@mivo.in checks)
-- ============================================================================

-- ============================================================================
-- PREFLIGHT VERIFICATION (MANDATORY - Run ALL 9 queries)
-- ============================================================================

-- Preflight 1: Identify admin user from auth.users
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at;

-- ⚠️ ACTION REQUIRED:
-- 1. Find the administrator email (likely admin@mivo.in based on schema)
-- 2. Copy the exact email
-- 3. Find all occurrences of PLACEHOLDER_ADMIN_EMAIL@example.com in this file
-- 4. Replace with actual email (3 occurrences marked with -- [ADMIN_EMAIL])

-- Preflight 2: Document all existing policies on six tables
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

-- Expected: Current policies using auth.jwt()->>'email' pattern
-- These will be REPLACED by is_admin() policies

-- Preflight 3: Verify five business tables exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY table_name;

-- Expected: 5 rows (admin_users may not exist yet)

-- Preflight 4: Check if admin_users exists and its structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name = 'admin_users'
ORDER BY c.ordinal_position;

-- If exists: Must have user_id, granted_by, granted_at, notes
-- If empty result: Table will be created

-- Preflight 5: Document custom_quotes complete schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'custom_quotes'
ORDER BY ordinal_position;

-- ⚠️ VERIFY SCHEMA: Check if migration 003 was applied
-- Expected columns (original + migration 003):
-- - customer_name, email, phone, project_description (customer fields)
-- - application, quantity, dimensions, material, deadline (customer fields)
-- - product_id, custom_dimensions, feasibility_assessment, quote_response (admin/system)
-- - id, status, created_at, updated_at, attachments (system)

-- Preflight 6: Check table-level and column-level grants
SELECT
  grantee,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Document baseline - verify if anon has INSERT on custom_quotes

SELECT
  grantee,
  table_name,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'custom_quotes'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY grantee, column_name;

-- Document existing column grants (if any)

-- Preflight 7: Verify RLS state on existing tables
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

-- Preflight 8: Check for existing is_admin function
SELECT
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as is_security_definer,
  r.rolsuper,
  r.rolbypassrls
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_roles r ON p.proowner = r.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- If exists: Will be replaced. Verify owner has rolbypassrls.

-- Preflight 9: Record counts (baseline for post-migration comparison)
SELECT 'products' as table_name, COUNT(*) as count FROM products
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

  RAISE NOTICE '✅ Step 1: All five business tables exist';
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: Enable RLS on all existing business tables
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
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE custom_quotes ENABLE ROW LEVEL SECURITY;
  END IF;

  RAISE NOTICE '✅ Step 2: RLS enabled on all business tables';
END $$;

-- ----------------------------------------------------------------------------
-- Step 3: Validate or create admin_users table with exact schema
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  table_exists BOOLEAN;
  expected_columns TEXT[] := ARRAY['granted_at', 'granted_by', 'notes', 'user_id'];
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

    -- Get actual columns (sorted)
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
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users has unexpected columns: %. Expected only: %. Drop table manually if structure is wrong.',
        unexpected_columns, expected_columns;
    END IF;

    -- Validate each column type, nullability, default
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
          -- CORRECTED: granted_at should be NOT NULL with default
          IF column_check.data_type != 'timestamp with time zone' OR column_check.is_nullable != 'NO' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_at has wrong type/nullable (expected: timestamptz NOT NULL, got: % %)',
              column_check.data_type, column_check.is_nullable;
          END IF;
          IF column_check.column_default IS NULL OR column_check.column_default NOT LIKE '%now()%' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: admin_users.granted_at missing DEFAULT NOW()';
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
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'admin_users'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name = 'user_id'
    ) INTO pk_exists;

    IF NOT pk_exists THEN
      RAISE EXCEPTION 'MIGRATION ABORTED: admin_users missing PRIMARY KEY on user_id';
    END IF;

    -- Verify FOREIGN KEY: user_id -> auth.users(id) ON DELETE CASCADE
    SELECT delete_rule INTO fk_check
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

    -- Verify FOREIGN KEY: granted_by -> auth.users(id) ON DELETE SET NULL
    SELECT delete_rule INTO fk_check
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
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- CORRECTED: NOT NULL
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

  RAISE NOTICE '✅ Step 4: is_admin() verified: owner=%, rolbypassrls=%, rolsuper=%',
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

  RAISE NOTICE '✅ Step 5: Dropped % policies from target tables', dropped_count;
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: Configure column-level grants for anonymous quote submission
-- ----------------------------------------------------------------------------

-- Revoke table-level INSERT from anon (if exists)
REVOKE INSERT ON custom_quotes FROM anon;

-- Revoke from PUBLIC as well (to prevent inheritance)
REVOKE INSERT ON custom_quotes FROM PUBLIC;

-- Grant column-level INSERT for customer-editable fields only
-- IMPORTANT: Based on migrations/003 schema, excluding admin/system columns
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

-- Verify column-level grants
DO $$
DECLARE
  table_level_insert_anon BOOLEAN;
  table_level_insert_public BOOLEAN;
  column_grants TEXT[];
  protected_columns TEXT[] := ARRAY[
    'id', 'product_id', 'custom_dimensions', 'feasibility_assessment',
    'quote_response', 'status', 'created_at', 'updated_at', 'attachments'
  ];
  required_columns TEXT[] := ARRAY[
    'customer_name', 'email', 'phone', 'project_description',
    'application', 'quantity', 'dimensions', 'material', 'deadline'
  ];
  protected_col TEXT;
  required_col TEXT;
BEGIN
  -- Check for table-level INSERT on anon
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'custom_quotes'
      AND grantee = 'anon'
      AND privilege_type = 'INSERT'
  ) INTO table_level_insert_anon;

  IF table_level_insert_anon THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: anon still has table-level INSERT on custom_quotes';
  END IF;

  -- Check for table-level INSERT on PUBLIC
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'custom_quotes'
      AND grantee = 'PUBLIC'
      AND privilege_type = 'INSERT'
  ) INTO table_level_insert_public;

  IF table_level_insert_public THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: PUBLIC has table-level INSERT on custom_quotes (anon inherits from PUBLIC)';
  END IF;

  -- Get column-level grants for anon
  SELECT ARRAY_AGG(column_name ORDER BY column_name)
  INTO column_grants
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'custom_quotes'
    AND grantee = 'anon'
    AND privilege_type = 'INSERT';

  IF column_grants IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No column-level INSERT grants found for anon on custom_quotes';
  END IF;

  -- Verify protected columns NOT in grants
  FOREACH protected_col IN ARRAY protected_columns LOOP
    IF protected_col = ANY(column_grants) THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: anon has INSERT grant on protected column: %. Granted: %', protected_col, column_grants;
    END IF;
  END LOOP;

  -- Verify required columns ARE in grants
  FOREACH required_col IN ARRAY required_columns LOOP
    IF NOT (required_col = ANY(column_grants)) THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: anon missing INSERT grant on required column: %. Granted: %', required_col, column_grants;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Step 6: Column grants verified. Anon can INSERT: %', column_grants;
END $$;

-- ----------------------------------------------------------------------------
-- Step 7: Validate and insert admin user
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  admin_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';  -- [ADMIN_EMAIL] Replace this
  admin_user_id UUID;
  admin_exists_in_auth BOOLEAN;
  admin_exists_in_admin_users BOOLEAN;
  existing_admin_count INTEGER;
BEGIN
  -- Verify email is not placeholder
  IF admin_email = 'PLACEHOLDER_ADMIN_EMAIL@example.com' THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email not configured. Search for PLACEHOLDER_ADMIN_EMAIL@example.com and replace with actual email from Preflight Query 1.';
  END IF;

  -- Verify email exists in auth.users and get user_id
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email "%" not found in auth.users. Run Preflight Query 1 to identify valid emails.', admin_email;
  END IF;

  -- Insert admin (if not already present)
  INSERT INTO admin_users (user_id, granted_by, notes)
  VALUES (
    admin_user_id,
    admin_user_id,
    'Initial admin - RLS migration ' || CURRENT_DATE::TEXT
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Verify configured admin is now in admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = admin_user_id
  ) INTO admin_exists_in_admin_users;

  IF NOT admin_exists_in_admin_users THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Admin email "%" was not inserted into admin_users.', admin_email;
  END IF;

  -- Count total admins
  SELECT COUNT(*) INTO existing_admin_count FROM admin_users;

  IF existing_admin_count > 1 THEN
    RAISE NOTICE 'WARNING: % admins exist in admin_users. Verify all are intended.', existing_admin_count;
  END IF;

  RAISE NOTICE '✅ Step 7: Admin verified: % (user_id: %, total admins: %)',
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
-- Note: Anonymous INSERT protected by column-level grants (Step 6)
-- Policy validates row-level constraints, grants enforce column-level access

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    customer_name IS NOT NULL
    AND LENGTH(TRIM(customer_name)) > 0
    AND LENGTH(customer_name) <= 200

    AND email IS NOT NULL
    AND LENGTH(TRIM(email)) > 0
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'

    AND project_description IS NOT NULL
    AND LENGTH(TRIM(project_description)) > 0
    AND LENGTH(project_description) <= 5000
  );

COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Column-level access controlled by GRANT (Step 6). Protected columns cannot be set by anon due to missing column grants.';

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
  admin_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';  -- [ADMIN_EMAIL] Replace this
  admin_in_admin_users BOOLEAN;

  -- Policy verification
  total_policies INTEGER;
  policies_using_is_admin INTEGER;
  public_policies INTEGER;
  policy_check RECORD;
  policy_errors TEXT[] := ARRAY[]::TEXT[];

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

  -- 2. Verify exact policy count
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users');

  IF total_policies != 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 22 policies, found %', total_policies;
  END IF;

  -- 3. Verify policies using is_admin()
  SELECT COUNT(*) INTO policies_using_is_admin
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND (qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%');

  IF policies_using_is_admin != 19 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 19 policies using is_admin(), found %', policies_using_is_admin;
  END IF;

  -- 4. Verify public policies
  SELECT COUNT(*) INTO public_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND policyname LIKE 'public_%';

  IF public_policies != 3 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected 3 public policies, found %', public_policies;
  END IF;

  -- 5. Verify critical policies exist with correct attributes
  -- Products
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'public_select_published_products'
      AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
      AND 'anon' = ANY(roles) AND 'authenticated' = ANY(roles)
  ) THEN
    policy_errors := array_append(policy_errors, 'products.public_select_published_products missing or wrong');
  END IF;

  -- Product Variants
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_variants' AND policyname = 'public_select_variants'
      AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
  ) THEN
    policy_errors := array_append(policy_errors, 'product_variants.public_select_variants missing or wrong');
  END IF;

  -- Custom Quotes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_quotes' AND policyname = 'public_insert_quotes'
      AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'
  ) THEN
    policy_errors := array_append(policy_errors, 'custom_quotes.public_insert_quotes missing or wrong');
  END IF;

  IF array_length(policy_errors, 1) > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Policy errors: %', policy_errors;
  END IF;

  -- 6. Verify no unsafe permissive policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('orders', 'order_items', 'custom_quotes')
      AND permissive = 'PERMISSIVE'
      AND 'authenticated' = ANY(roles)
      AND (qual::text = 'true' OR with_check::text = 'true')
      AND cmd IN ('UPDATE', 'DELETE', 'SELECT')
      AND NOT (qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found unsafe permissive policy with USING(true) or WITH CHECK(true) without is_admin()';
  END IF;

  -- 7. Verify RLS enabled
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
    AND NOT c.relrowsecurity;

  IF tables_without_rls > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % tables missing RLS', tables_without_rls;
  END IF;

  -- 8. Verify function privileges
  SELECT ARRAY_AGG(grantee::text ORDER BY grantee)
  INTO func_execute_grantees
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name = 'is_admin'
    AND privilege_type = 'EXECUTE';

  IF 'anon' = ANY(func_execute_grantees) OR 'PUBLIC' = ANY(func_execute_grantees) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() grants EXECUTE to anon or PUBLIC. Grantees: %', func_execute_grantees;
  END IF;

  IF NOT ('authenticated' = ANY(func_execute_grantees)) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: is_admin() missing EXECUTE for authenticated. Grantees: %', func_execute_grantees;
  END IF;

  -- 9. Verify admin_users write protection (no write policies)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: admin_users has write policies (should only have SELECT)';
  END IF;

  -- 10. Verify column-level grants for quotes
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
    OR 'created_at' = ANY(quote_column_grants)
  THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: anon has INSERT on protected quote columns. Granted: %', quote_column_grants;
  END IF;

  RAISE NOTICE '✅ Step 14: All verifications passed';
  RAISE NOTICE '   Total policies: %', total_policies;
  RAISE NOTICE '   Policies using is_admin(): %', policies_using_is_admin;
  RAISE NOTICE '   Public policies: %', public_policies;
  RAISE NOTICE '   Function grantees: %', func_execute_grantees;
  RAISE NOTICE '   Quote column grants: %', quote_column_grants;
  RAISE NOTICE '   Configured admin: %', admin_email;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Run immediately after COMMIT)
-- ============================================================================

-- Postflight 1: List all policies with complete definitions
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

-- Expected: 22 policies

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

-- Postflight 3: Verify function execution grants
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin'
ORDER BY grantee;

-- Expected: authenticated has EXECUTE, anon does NOT

-- Postflight 4: Verify column-level grants on custom_quotes
SELECT
  grantee,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'custom_quotes'
  AND grantee = 'anon'
ORDER BY column_name;

-- Expected: INSERT grants on customer-editable columns only (9 columns)

-- Postflight 5: List all admin users
SELECT
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;

-- Verify configured admin email is present

-- Postflight 6: Verify RLS state on all tables
SELECT
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY c.relname;

-- Expected: All rls_enabled=true, admin_users force_rls=false

-- Postflight 7: Verify record counts match preflight
SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'custom_quotes', COUNT(*) FROM custom_quotes
UNION ALL SELECT 'admin_users', COUNT(*) FROM admin_users;

-- Compare with Preflight Query 9

-- ============================================================================
-- RELEASE BLOCKERS (MUST BE RESOLVED BEFORE PRODUCTION USE)
-- ============================================================================

/*
CRITICAL APPLICATION BLOCKERS - NOT RESOLVED IN THIS MIGRATION:

1. ❌ ADMIN ROUTE AUTHORIZATION MISSING
   Location: middleware.ts (lines 33-40), app/admin/layout.tsx (lines 11-17)
   Issue: Only checks authentication, NOT admin status
   Impact: Any authenticated user can access /admin routes and see UI
   Fix Required: Add is_admin() RPC call to middleware:

   const { data: isAdmin } = await supabase.rpc('is_admin').single();
   if (!isAdmin && request.nextUrl.pathname.startsWith('/admin')
       && request.nextUrl.pathname !== '/admin/login') {
     return NextResponse.redirect(new URL('/', request.url));
   }

2. ❌ QUOTE SUBMISSION NOT IMPLEMENTED
   Location: app/custom/page.tsx line 28
   Code: // TODO: Implement actual form submission to Supabase
   Impact: Column grants protect non-functional feature
   Fix Required: Implement Supabase insert in handleSubmit function:

   const { data, error } = await supabase.from('custom_quotes').insert({
     customer_name: formData.name,
     email: formData.email,
     phone: formData.phone,
     project_description: formData.description,
     application: formData.projectType,
     quantity: parseInt(formData.quantity),
     material: formData.material,
     // Note: deadline needs date conversion from formData.timeline
   });

3. ⚠️ BREAKING CHANGE: OLD ADMIN PATTERN INCOMPATIBLE
   Issue: Migration replaces auth.jwt()->>'email' pattern with is_admin()
   Impact: If admin@mivo.in is NOT added to admin_users, admin loses access
   Prevention: Preflight Query 1 MUST identify admin@mivo.in, configure in migration

4. ⚠️ SCHEMA STATE UNKNOWN: Migration 003 Status
   Issue: Migration assumes migration 003 was applied (product_id, custom_dimensions, etc.)
   Impact: If migration 003 NOT applied, column grants may reference non-existent columns
   Verification Required: Run Preflight Query 5, verify schema matches expected state

5. ⚠️ CANNOT TEST QUOTE SECURITY
   Issue: No quote form implementation means manual testing cannot verify column grants
   Workaround: Test via Supabase Dashboard using SQL INSERT with service_role, then
              test via PostgREST API directly with anon key

DO NOT DEPLOY TO PRODUCTION UNTIL:
- Admin middleware guards implemented
- Quote submission form functional
- Migration 003 status confirmed
- Admin email verified in admin_users
- Manual security testing completed
*/

-- ============================================================================
-- EMERGENCY RECOVERY PROCEDURES
-- ============================================================================

/*
ROLLBACK IMPLICATIONS:

Removing all policies from target tables means:
- Only service_role can access tables (service_role and roles with rolbypassrls bypass RLS)
- All application queries using anon or authenticated keys will fail
- Public storefront WILL BREAK (no product viewing)
- Admin dashboard WILL BREAK (no data access)
- Quote submission WILL BREAK (no INSERT access)

OPTION 1: Fix Forward (Strongly Recommended)
---------------------------------------------
For admin access broken:

-- Via SQL Editor (service_role context):
INSERT INTO admin_users (user_id, granted_by, notes)
SELECT id, id, 'Emergency restoration'
FROM auth.users
WHERE email = 'correct-admin@domain.com'
ON CONFLICT (user_id) DO NOTHING;

For public access broken:

-- Restore minimal public policies:
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO anon, authenticated USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated USING (true);

OPTION 2: Emergency Remove All Policies (Outage Mode)
------------------------------------------------------
-- Creates controlled outage until policies restored

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

-- Result: Application non-functional until new policies applied

OPTION 3: Database Restore (Last Resort)
-----------------------------------------
1. Restore from backup created before migration
2. Analyze migration failure
3. Fix issues
4. Re-test on staging
5. Re-run on production

NEVER:
❌ Restore unsafe policies with USING(true) or WITH CHECK(true)
❌ Disable RLS (ALTER TABLE ... DISABLE ROW LEVEL SECURITY)
❌ Grant table-level INSERT to anon on custom_quotes without column restrictions
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Post-execution checklist:
-- [ ] All preflight queries run and documented
-- [ ] Admin email configured (no PLACEHOLDER remaining)
-- [ ] Database backup created and verified
-- [ ] Migration executed without errors
-- [ ] All postflight queries run successfully
-- [ ] Record counts match preflight
-- [ ] Admin can log in and access /admin (after implementing middleware guard)
-- [ ] Public can view products
-- [ ] Application blockers documented and assigned
-- [ ] Monitoring enabled for 24-48 hours
