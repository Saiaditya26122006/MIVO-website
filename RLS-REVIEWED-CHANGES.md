# RLS Migration - Code-Reviewed Version Changes

**File:** `rls-migration-final-reviewed.sql`  
**Date:** 2026-10-15  
**Status:** ⚠️ NOT APPROVED - Code reviewed, requires preflight verification and approval

---

## CHANGE LOG: All 10 Mandatory Fixes

### Fix 1: Corrected is_admin() Policy Count ✅

**Issue:** Previous version claimed 18 policies use `is_admin()`, actual count is 19.

**Breakdown:**
- Products: 4 admin policies (SELECT, INSERT, UPDATE, DELETE)
- Product Variants: 3 admin policies (INSERT, UPDATE, DELETE)
- Orders: 4 admin policies (all operations)
- Order Items: 4 admin policies (all operations)
- Custom Quotes: 3 admin policies (SELECT, UPDATE, DELETE)
- **Admin Users: 1 admin policy (SELECT)** ← Was missed in previous count

**Total:** 19 policies using `is_admin()` (not 18)

**SQL Location:** Line 700
```sql
-- Count policies using is_admin() (19 policies: all admin policies including admin_users_read)
SELECT COUNT(*) INTO policies_using_is_admin
...
IF policies_using_is_admin != 19 THEN
  RAISE EXCEPTION 'Expected 19 policies using is_admin(), found %';
END IF;
```

**Documentation Updated:**
- Line 25: Security model states "19 policies"
- Line 690: Comment corrected "22 policies (19 admin + 3 public)"
- Line 700: Verification checks for 19

---

### Fix 2: Corrected Policy Name Verification ✅

**Issue:** Previous version compared unsorted arrays, causing false mismatches.

**Previous (BROKEN):**
```sql
expected_policies TEXT[] := ARRAY['products.admin_select', ...];  -- Unsorted
actual_policies TEXT[];  -- Could be in any order

IF actual_policies != expected_policies THEN  -- ❌ False positives
```

**New (CORRECT):**
```sql
-- Expected policy definitions (sorted alphabetically)
expected_policies TEXT[] := ARRAY[
  'admin_users.admin_users_read',
  'custom_quotes.admin_delete_quotes',
  'custom_quotes.admin_select_quotes',
  ...  -- All 22 policies in alphabetical order
];

-- Get actual policies (sorted)
SELECT ARRAY_AGG(tablename || '.' || policyname ORDER BY tablename || '.' || policyname)
INTO actual_policies
FROM pg_policies ...;

-- Find missing policies (in expected but not actual)
SELECT ARRAY_AGG(policy ORDER BY policy)
INTO missing_policies
FROM unnest(expected_policies) policy
WHERE policy != ALL(actual_policies);

IF missing_policies IS NOT NULL THEN
  RAISE EXCEPTION 'Missing policies: %', missing_policies;
END IF;

-- Find unexpected policies (in actual but not expected)
SELECT ARRAY_AGG(policy ORDER BY policy)
INTO unexpected_policies
FROM unnest(actual_policies) policy
WHERE policy != ALL(expected_policies);

IF unexpected_policies IS NOT NULL THEN
  RAISE EXCEPTION 'Unexpected policies found: %', unexpected_policies;
END IF;
```

**SQL Location:** Lines 648-688
**Benefits:**
- ✅ Detects missing policies
- ✅ Detects unexpected policies
- ✅ Order-independent comparison
- ✅ Clear error messages

---

### Fix 3: Complete Policy Cleanup Including admin_users ✅

**Issue:** Previous version only dropped policies from 5 tables, not admin_users.

**Previous (INCOMPLETE):**
```sql
target_tables TEXT[] := ARRAY['products', 'product_variants', 'orders', 'order_items', 'custom_quotes'];
-- ❌ Missing 'admin_users'
```

**New (COMPLETE):**
```sql
target_tables TEXT[] := ARRAY[
  'products', 
  'product_variants', 
  'orders', 
  'order_items', 
  'custom_quotes', 
  'admin_users'  -- ✅ Added
];
```

**SQL Location:** Line 400
**Ensures:** All existing policies on admin_users are removed before creating new policy.

---

### Fix 4: Verified Function Owner RLS-Bypass Capability ✅

**Issue:** Previous version assumed `service_role` name = RLS bypass. Not always true.

**Previous (WEAK):**
```sql
IF NOT func_is_superuser AND func_owner != 'service_role' THEN
  RAISE EXCEPTION '...';  -- ❌ Name check insufficient
END IF;
```

**New (STRONG):**
```sql
SELECT
  pg_get_userbyid(p.proowner),
  r.rolbypassrls,  -- ✅ Check actual attribute
  r.rolsuper,      -- ✅ Check superuser attribute
  p.prosecdef
INTO func_owner, func_owner_rolbypassrls, func_owner_rolsuper, func_is_security_definer
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid  -- ✅ Join to pg_roles
...

-- Function owner must have rolbypassrls OR rolsuper
IF NOT (func_owner_rolbypassrls OR func_owner_rolsuper) THEN
  RAISE EXCEPTION 'is_admin() owner "%" does not have rolbypassrls or rolsuper. Cannot bypass RLS on admin_users. This would cause infinite recursion.', func_owner;
END IF;
```

**SQL Location:** Lines 358-388
**Verification:** Checks actual PostgreSQL role attributes, not just role name.

---

### Fix 5: Implemented Real Grant Verification ✅

**Issue:** Previous version only printed grants, didn't verify against security requirements.

**New Implementation - Function Privileges:**
```sql
-- Verify is_admin() function privileges
SELECT ARRAY_AGG(grantee::text ORDER BY grantee::text)
INTO func_execute_grantees
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin'
  AND privilege_type = 'EXECUTE';

IF 'anon' = ANY(func_execute_grantees) OR 'PUBLIC' = ANY(func_execute_grantees) THEN
  RAISE EXCEPTION 'is_admin() grants EXECUTE to anon or PUBLIC. Grantees: %';
END IF;

IF NOT ('authenticated' = ANY(func_execute_grantees)) THEN
  RAISE EXCEPTION 'is_admin() missing EXECUTE grant to authenticated. Grantees: %';
END IF;
```

**SQL Location:** Lines 757-769
**Verifies:**
- ✅ `authenticated` has EXECUTE
- ✅ `anon` does NOT have EXECUTE
- ✅ `PUBLIC` does NOT have EXECUTE

**New Implementation - admin_users Write Protection:**
```sql
IF EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'admin_users'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
) THEN
  RAISE EXCEPTION 'admin_users has write policies (should be rolbypassrls-only)';
END IF;
```

**SQL Location:** Lines 772-780
**Verifies:** No write policies = only roles with rolbypassrls can modify

**Table Grants Documentation:**
- Preflight 5: Documents baseline grants
- Postflight 8: Verifies grants unchanged
- Note: Migration does NOT modify grants, only RLS policies

---

### Fix 6: Revised Public Quote Insertion ✅

**Issue:** Previous version implied `WITH CHECK` provides column-level protection.

**New Documentation (Lines 567-582):**
```sql
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
```

**Policy Comment Updated (Line 609):**
```sql
COMMENT ON POLICY "public_insert_quotes" ON custom_quotes IS
  'Public INSERT with value validation. Does NOT prevent columns from being mentioned. For true column-level security, use column-level grants or server-side API.';
```

**Preflight 7 Added:**
- Documents custom_quotes schema
- Used for server-side API design

**Manual Test 4 Added:**
- Tests quote submission with admin fields
- Documents expected behavior

---

### Fix 7: Corrected Rollback Section ✅

**Issue:** Previous version suggested dropping policies from "all tables in public."

**Previous (DANGEROUS):**
```sql
-- Drop all policies from all tables in public schema  -- ❌ TOO BROAD
FOR pol IN SELECT * FROM pg_policies WHERE schemaname = 'public' LOOP
```

**New (SAFE):**
```sql
-- Drop all policies from the six target tables only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')  -- ✅ Explicit list
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;
```

**SQL Location:** Lines 997-1014
**Added Warnings (Lines 959-962):**
```sql
⚠️ Do NOT restore unsafe policies in rollback
⚠️ Do NOT drop policies from all tables in public schema
⚠️ Only modify the six target tables: products, product_variants, orders,
   order_items, custom_quotes, admin_users
```

---

### Fix 8: Pre-Existing admin_users Validation ✅

**Issue:** Previous version used `CREATE TABLE IF NOT EXISTS` without validating structure.

**New Validation (Lines 245-304):**
```sql
DO $$
DECLARE
  table_exists BOOLEAN;
  column_count INTEGER;
  fk_count INTEGER;
BEGIN
  SELECT EXISTS (...) INTO table_exists;

  IF table_exists THEN
    -- Validate existing table structure
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'admin_users'
      AND column_name IN ('user_id', 'granted_by', 'granted_at', 'notes');

    IF column_count != 4 THEN
      RAISE EXCEPTION 'Existing admin_users table has wrong structure (expected 4 columns, found %). Drop table manually and re-run.', column_count;
    END IF;

    -- Validate foreign keys exist
    SELECT COUNT(*) INTO fk_count
    FROM pg_constraint
    WHERE conrelid = 'public.admin_users'::regclass
      AND contype = 'f';

    IF fk_count != 2 THEN
      RAISE EXCEPTION 'Existing admin_users table missing foreign keys (expected 2, found %). Drop table manually and re-run.', fk_count;
    END IF;

    RAISE NOTICE 'Existing admin_users table validated (correct structure)';
  ELSE
    -- Create new table
    CREATE TABLE admin_users (...);
    ...
  END IF;
END $$;
```

**Preflight Validation Added (Lines 124-173):**
- Documents how to check existing admin_users structure
- Validates columns, constraints, ownership, RLS state
- Lists existing admin data

**Benefits:**
- ✅ Detects wrong table structure before modification
- ✅ Preserves existing admin data if structure correct
- ✅ Clear error if structure wrong (manual fix required)

---

### Fix 9: Comprehensive Exact-Definition Checks ✅

**New Verifications Added:**

**Table Existence (Lines 192-221):**
```sql
-- Verify all six expected tables exist
SELECT ARRAY_AGG(expected_table)
INTO missing_tables
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE ...);

IF missing_tables IS NOT NULL THEN
  RAISE EXCEPTION 'Missing required tables: %';
END IF;
```

**RLS Enabled State (Lines 223-243):**
```sql
-- Verify RLS enabled on all existing tables
IF tables_without_rls IS NOT NULL THEN
  -- Enable RLS on each table individually
  EXECUTE 'ALTER TABLE products ENABLE ROW LEVEL SECURITY';
  ...
END IF;
```

**Email Consistency Check (Lines 425, 433, 739):**
- Three locations where admin email must match
- Verification at each checkpoint
- Clear error if mismatch

**Policy Definition Verification (Lines 648-780):**
- Exact policy names (sorted comparison)
- Missing/unexpected policy detection
- Command types (SELECT, INSERT, UPDATE, DELETE)
- Role assignments
- USING/WITH CHECK expressions via is_admin() count
- No unsafe permissive policies

**Complete State Verification:**
- Total policy count: 22
- Policies using is_admin(): 19
- Public policies: 3
- RLS enabled: All 6 tables
- Function privileges: Exact grantees
- admin_users write protection: No write policies

---

### Fix 10: Database vs Application Authorization Distinction ✅

**New Documentation Section (Lines 11-29):**
```sql
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
```

**Clarifications Throughout:**
- RLS policies = database-level data access control
- Application routes = application-level UI access control
- Both layers required for complete security
- Migration handles database layer only

**Manual Testing Includes:**
- Test 2, Step 4: Documents that non-admin can access `/admin` routes
- Expected: Page loads but queries fail (RLS blocks data, not route)

---

## ADDITIONAL IMPROVEMENTS

### Preflight Queries Enhanced

**Added:**
- Preflight 3: Verify all six tables exist (not just 5)
- Preflight 6: Check existing is_admin function with role attributes
- Preflight 7: Document custom_quotes schema for API design

**Total:** 8 preflight queries (was 7)

### Postflight Verification Enhanced

**Added:**
- Postflight 2: Includes rolbypassrls and rolsuper checks
- Postflight 5: Includes force_rls check for admin_users
- Postflight 8: Explicitly compares grants with preflight baseline

**Total:** 10 postflight queries (unchanged, but enhanced content)

### Static Verification Queries Added

**New Section (Lines 896-953):**
- Check 1: Policy count by table with policy names
- Check 2: Verify no unsafe permissive policies
- Check 3: Verify all admin policies use is_admin()

**Purpose:** Can run anytime to verify security state without full migration context.

### Manual Testing Procedures Enhanced

**Expanded to 4 Tests:**
- Test 1: Anonymous user (6 steps)
- Test 2: Non-admin authenticated (8 steps)
- Test 3: Admin user (10 steps)
- Test 4: Quote column security (3 tests with SQL)

**Each test includes:**
- Exact steps to perform
- Expected results
- Browser DevTools commands for SQL-level testing

---

## UNVERIFIABLE WITHOUT LIVE PREFLIGHT

**Cannot be verified from code alone:**

1. **Actual admin email address**
   - Source: Preflight 1 query results
   - Must exist in auth.users table
   - Must be configured in 3 locations (lines 425, 433, 739)

2. **Function owner role attributes**
   - Source: Preflight 6 query results
   - Must verify rolbypassrls = true OR rolsuper = true
   - Role name alone (e.g., "service_role") is not sufficient

3. **Table grants (baseline and comparison)**
   - Source: Preflight 5 and Postflight 8
   - Must document which roles have which privileges
   - Migration assumes standard Supabase grants but doesn't modify them

4. **Existing admin_users state**
   - Source: Pre-existing validation queries (lines 124-173)
   - If table exists: Must validate structure, constraints, data
   - If table doesn't exist: Migration creates it

5. **Pre-existing policies**
   - Source: Preflight 2 query results
   - Must document all current policies for audit trail
   - Migration drops all policies on target tables

6. **Record counts**
   - Source: Preflight 8 (before) and Postflight 7 (after)
   - Must match exactly (except admin_users will be new)
   - Detects data loss during migration

---

## VERIFICATION SUMMARY

### Before Migration
- [ ] 8 preflight queries run and documented
- [ ] Admin email identified from Preflight 1
- [ ] Email configured in 3 locations (all matching)
- [ ] Function owner verified to have rolbypassrls
- [ ] Existing policies documented
- [ ] Table grants documented
- [ ] Record counts documented
- [ ] Database backup created

### During Migration (Automated)
- ✅ 6 tables existence verified
- ✅ RLS enabled on all tables
- ✅ admin_users structure validated
- ✅ Function owner RLS bypass verified
- ✅ Admin email inserted and verified
- ✅ All existing policies dropped
- ✅ 22 new policies created
- ✅ Policy names match expected (sorted)
- ✅ 19 policies use is_admin()
- ✅ Function privileges verified
- ✅ admin_users write protection verified

### After Migration
- [ ] 10 postflight queries run
- [ ] All policy names verified
- [ ] Function security verified
- [ ] Admin list verified
- [ ] RLS state verified
- [ ] No legacy policies remain
- [ ] Record counts match
- [ ] Grants unchanged
- [ ] 4 manual tests completed

---

## SQL SECTION REFERENCE

| Section | Lines | Purpose |
|---------|-------|---------|
| Database vs App Auth | 11-29 | Clarifies migration scope |
| Preflight Queries | 38-154 | 8 mandatory verification queries |
| Pre-Existing Validation | 156-182 | Validate existing admin_users |
| Main Migration | 184-785 | Transaction with 13 steps |
| Step 1: Table existence | 192-221 | Verify 5 tables exist |
| Step 2: Enable RLS | 223-243 | Enable on all tables |
| Step 3: admin_users | 245-304 | Validate or create table |
| Step 4: is_admin() | 306-391 | Create function with verification |
| Step 5: Drop policies | 393-420 | Clean slate on 6 tables |
| Step 6: Insert admin | 422-475 | Insert and verify configured admin |
| Step 7: Products policies | 477-501 | 5 policies |
| Step 8: Variants policies | 503-523 | 4 policies |
| Step 9: Orders policies | 525-545 | 4 policies |
| Step 10: Order items policies | 547-567 | 4 policies |
| Step 11: Quotes policies | 569-626 | 4 policies with security notes |
| Step 12: admin_users policy | 628-644 | 1 policy |
| Step 13: Verification | 646-785 | 10 fail-closed checks |
| Postflight Queries | 792-894 | 10 verification queries |
| Static Verification | 896-953 | 3 anytime checks |
| Manual Testing | 955-1054 | 4 test procedures |
| Rollback | 1056-1038 | 3 recovery options |
| Admin Management | 1040-1082 | Post-migration procedures |

---

## APPROVAL STATUS

**This migration is NOT approved for execution.**

**Required for Approval:**
1. ✅ All 10 mandatory fixes implemented
2. ⏳ All 8 preflight queries run and results documented
3. ⏳ Admin email configured in 3 locations (verified matching)
4. ⏳ Function owner rolbypassrls verified from preflight
5. ⏳ Database backup created and verified
6. ⏳ Manual review of complete SQL file
7. ⏳ Manual review of this changes document
8. ⏳ Explicit written approval

**After Approval:**
1. Execute migration during low-traffic period
2. Run all 10 postflight queries immediately
3. Complete all 4 manual tests
4. Monitor for 24-48 hours
5. Document any issues

**Do not execute until:**
- All preflight queries completed
- Admin email configured
- Database backup confirmed
- Explicit approval given

---

**Document Version:** 3.0 (Code Reviewed)  
**Migration File:** rls-migration-final-reviewed.sql  
**Last Updated:** 2026-10-15  
**Status:** ⚠️ NOT APPROVED - Awaiting preflight verification and approval
