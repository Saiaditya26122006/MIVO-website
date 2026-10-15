# RLS Migration Production Version - Critical Security Fixes

**File:** `rls-migration-production.sql`  
**Date:** 2026-10-15  
**Status:** ⚠️ NOT APPROVED - Requires configuration and approval

---

## CRITICAL FIXES FROM PREVIOUS VERSIONS

### Fix 1: Corrected Admin Policy Count (18, not 19)

**Issue:** Previous version claimed 19 policies use `is_admin()`, actual count is 18.

**Breakdown:**
- **Products:** 4 admin policies (SELECT, INSERT, UPDATE, DELETE) + 1 public policy = 5 total
- **Product Variants:** 3 admin policies (INSERT, UPDATE, DELETE) + 1 public policy = 4 total
- **Orders:** 4 admin policies (all operations admin-only) = 4 total
- **Order Items:** 4 admin policies (all operations admin-only) = 4 total
- **Custom Quotes:** 3 admin policies (SELECT, UPDATE, DELETE) + 1 public INSERT = 4 total
- **Admin Users:** 1 admin policy (SELECT only) = 1 total

**Total:** 22 policies (18 use `is_admin()`, 4 are public policies)

**Previous Verification:**
```sql
IF admin_policy_count < 19 THEN  -- ❌ WRONG
```

**New Verification:**
```sql
IF policies_using_is_admin != 18 THEN
  RAISE EXCEPTION 'Expected 18 policies using is_admin(), found %';
END IF;
```

**Enhanced:** Now verifies exact policy names match expected list, not just count.

---

### Fix 2: Resolved admin_users RLS Recursion

**Issue:** `FORCE ROW LEVEL SECURITY` would break the non-recursive pattern.

**Why FORCE RLS Causes Problems:**
```
Normal RLS:
- Superuser bypasses RLS → can query admin_users directly
- is_admin() function owner is superuser → queries admin_users without RLS
- Admin policy calls is_admin() → non-recursive ✓

With FORCE RLS:
- Superuser CANNOT bypass RLS → must use RLS policies
- is_admin() function queries admin_users → triggers RLS evaluation
- RLS policy calls is_admin() → infinite recursion ❌
```

**Previous (BROKEN):**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;  -- ❌ Breaks non-recursive pattern
```

**New (CORRECT):**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- Do NOT use FORCE RLS - superuser must bypass for non-recursive check
```

**Verification Added:**
```sql
IF table_force_rls THEN
  RAISE EXCEPTION 'admin_users has FORCE RLS which would break superuser bypass';
END IF;
```

**Security Model:**
- **Superuser/service_role:** Bypass RLS, can modify admin_users directly
- **Admins:** Can SELECT via policy (calls is_admin())
- **Non-admins:** Cannot SELECT (policy denies)
- **All users:** Cannot INSERT/UPDATE/DELETE (no policies = denied)

**Documentation Added:**
```sql
COMMENT ON TABLE admin_users IS
  'Admin allowlist. Only postgres/service_role can INSERT/UPDATE/DELETE. RLS policy allows admins to SELECT.';
```

---

### Fix 3: Complete Policy Inventory with Dynamic Cleanup

**Issue:** Previous versions assumed specific policy names, missed unexpected policies.

**Previous (INCOMPLETE):**
```sql
DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;
DROP POLICY IF EXISTS "Admins have full access to products" ON products;
-- ... listed ~10 known policy names
```

**Problems:**
- Misses policies with unexpected names
- Doesn't handle typos or variants
- Manual list could be incomplete

**New (COMPLETE):**
```sql
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
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
    dropped_count := dropped_count + 1;
    RAISE NOTICE 'Dropped policy: %.%.%', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
  
  RAISE NOTICE 'Dropped % existing policies', dropped_count;
END $$;
```

**Benefits:**
- ✅ Drops ALL existing policies on business tables
- ✅ Logs each dropped policy for audit trail
- ✅ Handles any policy name (not just known list)
- ✅ Ensures clean slate before creating new policies

**Verification Added:**
```sql
-- Verify no unexpected policies exist
SELECT COUNT(*) INTO unexpected_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (...)
  AND NOT (tablename || '.' || policyname = ANY(expected_policies));

IF unexpected_policies > 0 THEN
  RAISE EXCEPTION 'Found % unexpected policies not in expected list';
END IF;
```

---

### Fix 4: Explicit RLS State Verification and Remediation

**Issue:** Previous version assumed RLS was already enabled, didn't verify or fix.

**New Behavior:**
```sql
DO $$
DECLARE
  tables_without_rls TEXT[];
BEGIN
  SELECT ARRAY_AGG(c.relname)
  INTO tables_without_rls
  FROM pg_class c
  WHERE c.relname IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
    AND NOT c.relrowsecurity;

  IF tables_without_rls IS NOT NULL THEN
    RAISE NOTICE 'Enabling RLS on tables: %', tables_without_rls;
    
    EXECUTE 'ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE IF EXISTS product_variants ENABLE ROW LEVEL SECURITY';
    -- ... etc
  END IF;
END $$;
```

**Pre-Commit Verification:**
```sql
SELECT COUNT(*) INTO tables_without_rls
FROM pg_class c
WHERE c.relname IN (...)
  AND NOT c.relrowsecurity;

IF tables_without_rls > 0 THEN
  RAISE EXCEPTION 'VERIFICATION FAILED: % tables do not have RLS enabled';
END IF;
```

**Benefits:**
- ✅ Detects tables with RLS disabled
- ✅ Enables RLS within transaction
- ✅ Verifies final state before commit
- ✅ Prevents policies from being ineffective

---

### Fix 5: Exact Admin Verification (Not Just "Any Admin")

**Issue:** Previous version passed if ANY admin existed, not the CONFIGURED admin.

**Previous (WEAK):**
```sql
IF admin_count = 0 THEN
  RAISE EXCEPTION 'No admin users';
END IF;
-- ❌ Passes if wrong admin exists
```

**New (STRICT):**
```sql
DECLARE
  configured_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';
  configured_user_exists BOOLEAN;
  configured_user_is_admin BOOLEAN;
BEGIN
  -- Check email exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = configured_email
  ) INTO configured_user_exists;

  IF NOT configured_user_exists THEN
    RAISE EXCEPTION 'Configured admin email "%" not found in auth.users';
  END IF;

  -- Check configured email is now in admin_users
  SELECT EXISTS (
    SELECT 1 FROM admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = configured_email
  ) INTO configured_user_is_admin;

  IF NOT configured_user_is_admin THEN
    RAISE EXCEPTION 'Configured admin email "%" was not inserted into admin_users';
  END IF;
END $$;
```

**Also in Final Verification:**
```sql
SELECT EXISTS (
  SELECT 1 FROM admin_users au
  JOIN auth.users u ON u.id = au.user_id
  WHERE u.email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'
) INTO configured_admin_exists;

IF NOT configured_admin_exists THEN
  RAISE EXCEPTION 'VERIFICATION FAILED: Configured admin email not found in admin_users';
END IF;
```

**Benefits:**
- ✅ Verifies EXACT configured email
- ✅ Fails if email doesn't exist in auth.users
- ✅ Fails if INSERT didn't work (conflict or other issue)
- ✅ Prevents accidental approval with wrong admin

---

### Fix 6: Corrected Quote Security Documentation

**Issue:** Previous version claimed `WITH CHECK` provides column-level protection. It doesn't.

**What WITH CHECK Actually Does:**
```sql
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    product_id IS NULL  -- ✓ Validates value
    AND status = 'submitted'  -- ✓ Validates value
  );
```

**Reality:**
- ✅ User can INSERT with `product_id = NULL` (passes check)
- ❌ User can INSERT with `product_id = some_uuid` (fails check)
- ❌ But user CAN mention the column in INSERT statement
- ❌ RLS doesn't provide column-level access control

**True Column-Level Security Requires:**
```sql
-- Option A: Column-level grant
GRANT INSERT (customer_name, email, project_description) ON custom_quotes TO anon;
REVOKE INSERT ON custom_quotes FROM anon;  -- Remove full table INSERT

-- Option B: Server-side API route
-- Application validates columns, inserts via service_role key
```

**Updated Documentation:**
```sql
COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Does NOT prevent columns from being set - 
   use column-level grants or server-side API for full protection.';
```

**New Section in Comments:**
```sql
-- ⚠️ IMPORTANT: RLS WITH CHECK validates row values but does NOT provide
-- column-level protection. It cannot prevent columns from being set, only
-- validate their values after INSERT.
--
-- For true column-level security, use GRANT INSERT(column_list) or implement
-- server-side submission API route.
```

**Recommendation:**
- Current policy: Validates admin fields are NULL (defense in depth)
- Full protection: Implement server-side quote submission API
- API validates fields, uses service_role to INSERT with only allowed columns

---

### Fix 7: Comprehensive Grant and Privilege Verification

**Issue:** Previous version only printed grants, didn't verify against requirements.

**New Verification - Function Privileges:**
```sql
SELECT ARRAY_AGG(grantee::text)
INTO func_execute_grants
FROM information_schema.routine_privileges
WHERE routine_name = 'is_admin'
  AND privilege_type = 'EXECUTE';

IF 'anon' = ANY(func_execute_grants) OR 'PUBLIC' = ANY(func_execute_grants) THEN
  RAISE EXCEPTION 'is_admin() has EXECUTE grant to anon or PUBLIC';
END IF;

IF NOT ('authenticated' = ANY(func_execute_grants)) THEN
  RAISE EXCEPTION 'is_admin() missing EXECUTE grant to authenticated';
END IF;
```

**New Verification - admin_users Write Protection:**
```sql
SELECT
  EXISTS (... WHERE cmd = 'SELECT'),
  EXISTS (... WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE'))
INTO select_policy_exists, write_policy_exists;

IF NOT select_policy_exists THEN
  RAISE EXCEPTION 'admin_users SELECT policy missing';
END IF;

IF write_policy_exists THEN
  RAISE EXCEPTION 'admin_users has write policies - should be superuser-only';
END IF;
```

**Benefits:**
- ✅ Verifies only authenticated can call is_admin()
- ✅ Verifies anon and PUBLIC cannot call is_admin()
- ✅ Verifies admin_users has no write policies
- ✅ Fails migration if security requirements not met

---

### Fix 8: Fail-Closed Verification (Every Check is Fatal)

**Issue:** Previous version had warnings, not exceptions.

**Previous (PERMISSIVE):**
```sql
IF policy_count < 22 THEN
  RAISE WARNING 'Expected ~25 policies, found %';  -- ⚠️ WARNING only
END IF;
```

**New (FAIL-CLOSED):**
```sql
IF total_policies != 22 THEN
  RAISE EXCEPTION 'Expected exactly 22 policies, found %';  -- ❌ EXCEPTION
END IF;
```

**All Verifications Now Fail-Closed:**
1. ✅ Exact policy count (22) - exception if wrong
2. ✅ Exact policy names - exception if mismatch
3. ✅ Policies using is_admin() (18) - exception if wrong
4. ✅ No unsafe permissive policies - exception if found
5. ✅ No unexpected policies - exception if found
6. ✅ RLS enabled on all tables - exception if any disabled
7. ✅ Admin count > 0 - exception if empty
8. ✅ Configured admin exists - exception if missing
9. ✅ Function privileges correct - exception if wrong
10. ✅ No write policies on admin_users - exception if found

**Result:** Migration rolls back automatically if ANY check fails.

---

### Fix 9: Corrected Rollback Examples

**Issue:** Previous version suggested restoring `WITH CHECK (true)` as "safe recovery."

**Previous (UNSAFE):**
```sql
-- ❌ WRONG: Suggests restoring unsafe policy
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);  -- ❌ Allows setting any column to any value
```

**New (SAFE):**
```sql
/*
⚠️ CRITICAL: Do NOT restore unsafe authenticated_full_access_* policies
⚠️ Do NOT restore WITH CHECK (true) for quote submission

OPTION 1: Fix Forward (Preferred)
----------------------------------
If admin access broken:
  INSERT INTO admin_users ... (add correct admin)

If public access broken:
  CREATE POLICY ... FOR SELECT ... (read-only)

OPTION 2: Remove All Policies (Emergency)
------------------------------------------
Drop all policies, use service_role key to manage data until fixed

OPTION 3: Database Restore (Last resort)
-----------------------------------------
Restore from backup, fix migration, re-test

DO NOT:
❌ Restore authenticated_full_access_* policies
❌ Create permissive USING(true) policies for UPDATE/DELETE
❌ Use WITH CHECK (true) for quote submission
❌ Disable RLS on tables
*/
```

**Benefits:**
- ✅ Clear guidance on what NOT to do
- ✅ Safe alternatives provided
- ✅ Emphasizes security over convenience

---

## NEW FEATURES IN PRODUCTION VERSION

### Feature 1: Preflight Query Results Documentation

**Added structured documentation for each preflight query:**

```sql
-- Preflight 1: Identify all Auth users
-- ⚠️ REQUIRED: Choose admin email, update in Step 6

-- Preflight 2: Complete policy inventory
-- Expected: See authenticated_full_access_* policies
-- Document ALL policy names

-- Preflight 3: Verify RLS enabled state
-- Expected: All tables have rls_enabled = true
-- If any false: Migration will enable RLS
```

**Benefits:**
- ✅ Clear expected results
- ✅ Action items if results unexpected
- ✅ Links to migration steps

---

### Feature 2: Partial Migration Recovery Section

**Added procedure for handling partially-run migrations:**

```sql
-- Preflight 4 shows admin_users exists?
-- Check if correct, then either:
-- A) Skip to Step 7 (if infrastructure correct)
-- B) Drop and recreate (if infrastructure wrong)
```

**Handles:**
- Migration failed partway through
- Manual testing created admin infrastructure
- Previous attempt with different admin email

---

### Feature 3: Dynamic RLS Enablement

**Migration now enables RLS on any table that doesn't have it:**

```sql
SELECT ARRAY_AGG(c.relname) INTO tables_without_rls
FROM pg_class c
WHERE c.relname IN (...) AND NOT c.relrowsecurity;

IF tables_without_rls IS NOT NULL THEN
  RAISE NOTICE 'Enabling RLS on tables: %', tables_without_rls;
  EXECUTE 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY';
END IF;
```

**Benefits:**
- ✅ Works even if RLS not enabled initially
- ✅ Idempotent (safe to run multiple times)
- ✅ Logs which tables were modified

---

### Feature 4: Enhanced Postflight Verification

**10 postflight queries with explicit expected results:**

1. All policies with properties
2. Function owner and security attributes
3. Function execute privileges
4. List of all admins
5. RLS state on all tables
6. Verify no legacy policies remain
7. Record counts (compare with preflight)
8. Table grants (compare with preflight)
9. Test is_admin() function
10. Verify admin_users write protection

**Each query has:**
- Clear purpose
- Expected result
- Comparison instructions

---

### Feature 5: Comprehensive Manual Testing Checklist

**Structured test plan for 4 scenarios:**

**Test 1 - Anonymous User (10 steps)**
- Browse products
- View product details
- Try admin access
- Submit quote with malicious fields

**Test 2 - Non-Admin Authenticated (7 steps)**
- Sign in
- Browse products
- Try admin operations
- Check console for RLS errors
- Verify is_admin() returns false

**Test 3 - Admin User (10 steps)**
- Sign in with configured admin
- Access dashboard
- Full CRUD operations
- Verify is_admin() returns true

**Test 4 - Quote Column Security (SQL tests)**
- Try INSERT with admin fields
- Verify rejection
- Try valid INSERT
- Verify success

---

### Feature 6: Verified vs Unverifiable Facts Section

**Clear distinction between:**

**✅ Verified from Code/Schema:**
- custom_quotes admin columns
- product_variants safe for public
- WhatsApp-only ordering
- Quote submission not implemented
- Client uses anon key

**⚠️ Requires Preflight Verification:**
- Actual admin email
- Table-level grants
- Existing policy inventory
- RLS enabled state
- Record counts

**⚠️ Assumptions (Reasonable but not verified):**
- Function owner will be superuser
- Default Supabase grants
- auth.uid() availability
- Service role key not exposed

---

## VERIFICATION IMPROVEMENTS

### Before Migration (Preflight)

**8 mandatory queries (up from 4):**
1. List all auth users (identify admin)
2. Complete policy inventory (all 6 tables)
3. Verify RLS enabled state
4. Check for existing admin infrastructure
5. Verify custom_quotes schema
6. Check table grants baseline
7. Count records in all tables
8. Test auth functions availability

**Each query has:**
- Purpose statement
- Expected result
- Action if unexpected

---

### During Migration (Built-In)

**5 verification checkpoints:**
1. After RLS enablement (verify all enabled)
2. After function creation (verify owner, security)
3. After admin insertion (verify configured email)
4. After policy creation (verify count, names, properties)
5. Before COMMIT (comprehensive 10-check verification)

**Fail-closed:** Any failure raises EXCEPTION and rolls back.

---

### After Migration (Postflight)

**10 verification queries (up from 8):**
1. All policies with properties
2. Function security attributes
3. Function privileges
4. Admin list
5. RLS state
6. No legacy policies
7. Record counts unchanged
8. Grants unchanged
9. Test is_admin() function
10. Admin_users write protection

**Plus 4-scenario manual testing plan.**

---

## SECURITY MODEL CLARIFICATION

### admin_users Table Protection

**Superuser/Service Role:**
- Bypass RLS (normal PostgreSQL behavior)
- Can INSERT/UPDATE/DELETE admin_users directly
- No policies needed

**Admin Users:**
- Subject to RLS
- Can SELECT via "admin_users_read" policy
- Policy calls is_admin() which runs as superuser
- Non-recursive (function bypasses RLS)
- Cannot INSERT/UPDATE/DELETE (no policies)

**Non-Admin Users:**
- Subject to RLS
- SELECT denied (policy returns false)
- Cannot INSERT/UPDATE/DELETE (no policies)

**Why No FORCE RLS:**
- Would apply RLS to superuser
- is_admin() function would be subject to RLS
- Would create recursion
- Would break admin management

---

### Quote Submission Security Layers

**Layer 1: Table Grants (Unverified)**
- Assumed: authenticated has full INSERT privilege
- Reality: May be column-level or full table
- Preflight 6 documents actual grants

**Layer 2: RLS WITH CHECK (Defense in Depth)**
- Validates row values after INSERT
- Checks admin fields are NULL
- Cannot prevent column from being mentioned
- Can only reject invalid values

**Layer 3: Application Validation (Recommended)**
- Server-side API route
- Validates only allowed fields present
- Uses service_role to INSERT
- True column-level protection

**Current State:**
- Layer 2 implemented (RLS)
- Layer 3 recommended (not yet implemented)
- Layer 1 unverified (needs preflight check)

---

## CONFIGURATION REQUIREMENTS

### Must Configure Before Execution

**Line 270-271 (Step 6):**
```sql
WHERE email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← REPLACE
```

**Line 277 (Verification):**
```sql
DECLARE
  configured_email TEXT := 'PLACEHOLDER_ADMIN_EMAIL@example.com';  -- ← MUST MATCH
```

**Line 543 (Final Verification):**
```sql
WHERE u.email = 'PLACEHOLDER_ADMIN_EMAIL@example.com'  -- ← MUST MATCH
```

**All three locations must have identical email.**

### Preflight Requirements

- [ ] Run all 8 preflight queries
- [ ] Document results
- [ ] Identify admin email from Preflight 1
- [ ] Verify email exists in auth.users
- [ ] Update all 3 email locations in migration
- [ ] Verify all emails match exactly

---

## APPROVAL CHECKLIST

Before approving for execution:

**Configuration:**
- [ ] Admin email identified from Preflight 1
- [ ] All 3 email locations updated
- [ ] All emails match exactly
- [ ] Email verified to exist in auth.users

**Preflight:**
- [ ] All 8 preflight queries run
- [ ] Results documented
- [ ] No unexpected policies found
- [ ] RLS state documented
- [ ] Grants documented
- [ ] Record counts documented

**Review:**
- [ ] Reviewed complete migration SQL
- [ ] Reviewed this changes document
- [ ] Understood RLS non-recursive pattern
- [ ] Verified no FORCE RLS on admin_users
- [ ] Understood quote WITH CHECK limitations
- [ ] Reviewed rollback procedures

**Preparation:**
- [ ] Database backup created
- [ ] Service role key available
- [ ] Monitoring plan prepared
- [ ] Manual testing plan reviewed
- [ ] Rollback procedure understood

**Understanding:**
- [ ] Verified vs unverifiable facts reviewed
- [ ] Assumptions documented
- [ ] Security model understood
- [ ] Admin management procedure reviewed

---

## POST-EXECUTION REQUIREMENTS

**Immediate (< 5 minutes):**
- [ ] Run all 10 postflight queries
- [ ] Verify all expected results
- [ ] Document any discrepancies

**Short-term (< 1 hour):**
- [ ] Complete Test 1 (anonymous user)
- [ ] Complete Test 2 (non-admin authenticated)
- [ ] Complete Test 3 (admin user)
- [ ] Complete Test 4 (quote column security)

**Monitoring (24-48 hours):**
- [ ] Watch Supabase logs for RLS violations
- [ ] Monitor application logs for permission errors
- [ ] Check for customer-reported issues
- [ ] Verify no unexpected behavior

---

## STATUS: NOT APPROVED

**This migration requires:**
1. Configuration (admin email)
2. Preflight verification (8 queries)
3. Review and approval
4. Manual testing post-execution

**Do not execute without:**
- ✅ All preflight queries run and documented
- ✅ Admin email configured in 3 locations
- ✅ Explicit approval after review
- ✅ Database backup
- ✅ Service role key access
- ✅ Manual testing plan ready

---

**Document Version:** 2.0 (Production)  
**Migration File:** rls-migration-production.sql  
**Last Updated:** 2026-10-15  
**Status:** ⚠️ AWAITING CONFIGURATION AND APPROVAL
