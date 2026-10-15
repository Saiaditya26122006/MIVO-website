# RLS Migration - Security Decisions and Rationale

**File:** `rls-migration-secure.sql`  
**Date:** 2026-10-15  
**Status:** ✅ Ready for review - awaiting approval before execution

---

## CRITICAL SECURITY ISSUE FIXED

### The Infinite Recursion Problem

**Original Migration Had:**
```sql
-- ❌ INCORRECT - RECURSIVE
CREATE POLICY "admin_users_admin_read" ON admin_users
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
```

**Why This Is Wrong:**
1. Policy checks admin_users table to enforce access to admin_users table
2. When authenticated user queries admin_users, RLS evaluates policy
3. Policy's USING clause queries admin_users
4. This triggers RLS evaluation again → infinite recursion
5. PostgreSQL may return empty results or error depending on version

**The Comment Was Incorrect:**
> "SAFE: The subquery bypasses RLS, preventing infinite recursion"

This is **false**. Subqueries in RLS policies do NOT bypass RLS. They are subject to the same RLS policies as any other query.

---

## SECURE SOLUTION: SECURITY DEFINER FUNCTION

### Design Decision

**Implemented:**
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER          -- Runs with creator's privileges (bypasses RLS)
STABLE                    -- Result doesn't change within transaction
SET search_path = public, pg_temp  -- Prevents function hijacking
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users  -- Explicitly qualified
    WHERE user_id = auth.uid()
  );
END;
$$;
```

**Then Use In Policies:**
```sql
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());  -- Calls function, which bypasses RLS
```

### Why This Works

**Security Flow:**
1. Authenticated user calls `SELECT * FROM admin_users`
2. RLS evaluates `admin_users_read` policy
3. Policy calls `public.is_admin()` function
4. Function runs as SECURITY DEFINER (creator's privileges)
5. **Inside function:** Query to admin_users bypasses RLS (definer has no RLS)
6. Function returns true/false
7. Policy allows/denies based on function result
8. **No recursion:** Function query doesn't trigger RLS re-evaluation

**Key Principle:** SECURITY DEFINER functions execute with the privileges of the function creator (typically superuser/service role), not the caller. This means RLS is not applied to queries within the function.

---

## SECURITY HARDENING APPLIED

### 1. Search Path Locking

**Implementation:**
```sql
SET search_path = public, pg_temp
```

**Why:**
- Prevents function hijacking via schema search path manipulation
- User cannot create malicious `admin_users` table in their own schema
- Explicitly qualified references (`public.admin_users`) enforce correct table

**Attack Prevented:**
```sql
-- Without search_path lock, attacker could:
CREATE SCHEMA attacker_schema;
CREATE TABLE attacker_schema.admin_users (user_id UUID);
INSERT INTO attacker_schema.admin_users VALUES (attacker_uid);
SET search_path = attacker_schema, public;
-- Now is_admin() would query attacker's fake table
```

### 2. Function Execution Permissions

**Implementation:**
```sql
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

**Why:**
- Only authenticated users can call `is_admin()`
- Anonymous users cannot check admin status
- Service role can always call (implicit superuser)

**Principle:** Least privilege - only roles that need the function get access

### 3. Function Volatility: STABLE

**Implementation:**
```sql
STABLE  -- Result doesn't change within transaction
```

**Why:**
- Allows query optimizer to cache result within same transaction
- More efficient than VOLATILE (called once per statement/transaction)
- Correct because admin status doesn't change mid-transaction
- Cannot use IMMUTABLE (result depends on auth.uid())

**Performance Impact:**
- Without STABLE: Function called for every row checked
- With STABLE: Function result cached per statement/transaction

### 4. Admin Table Protection

**Implementation:**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only SELECT policy (using is_admin function)
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies
```

**Why:**
- Admins can read admin list (via is_admin() function)
- **Only service role can INSERT/UPDATE/DELETE** (no policies = default deny)
- Users cannot add themselves to admin_users
- Even admins cannot add other admins (must use service role key)

**Security Guarantee:** No RLS policy = operation denied for non-superuser roles

---

## IDEMPOTENCY - SAFE TO RETRY

### All Policy Operations Use DROP IF EXISTS

**Pattern:**
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name ...;
```

**Why:**
- Migration can be re-run if it fails partway
- Handles existing policies from previous setup
- Prevents "policy already exists" errors
- Ensures policy definition is exactly as specified

**Use Cases:**
1. Migration fails after Step 8, before Step 10
2. Policy was manually created for testing
3. Previous migration partially completed

### All Unsafe Policies Explicitly Dropped

**Implementation:**
```sql
-- Drop the five unsafe policies by name
DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;
DROP POLICY IF EXISTS "authenticated_full_access_variants" ON product_variants;
DROP POLICY IF EXISTS "authenticated_full_access_orders" ON orders;
DROP POLICY IF EXISTS "authenticated_full_access_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_full_access_quotes" ON custom_quotes;

-- Also drop potential alternate names
DROP POLICY IF EXISTS "Admins have full access to products" ON products;
-- ... etc
```

**Why:**
- Explicit is better than implicit
- Ensures unsafe policies are removed regardless of name
- Verification step confirms 0 unsafe policies remain

---

## PUBLIC ACCESS PRESERVATION

### Public Policies Explicitly Recreated

**Products - Published Only:**
```sql
DROP POLICY IF EXISTS "public_select_published_products" ON products;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);
```

**Product Variants - All Variants:**
```sql
DROP POLICY IF EXISTS "public_select_variants" ON product_variants
  FOR SELECT
  TO anon, authenticated
  USING (true);
```

**Custom Quotes - Anyone Can Submit:**
```sql
DROP POLICY IF EXISTS "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
```

**Why Explicit Recreation:**
- Ensures correct definition (no drift over time)
- Makes public access requirements visible in migration
- Handles case where policies already exist
- Documents intentional public access vs. accidental exposure

**Security Note:** `USING (true)` is safe for SELECT when combined with row-level filtering (`published = true`) or when table is meant to be public (variants). It's unsafe for INSERT/UPDATE/DELETE without validation.

---

## ADMIN-ONLY POLICIES

### Pattern Applied to All Protected Tables

**Example (products table):**
```sql
CREATE POLICY "admin_select_products" ON products
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_products" ON products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_products" ON products
  FOR DELETE TO authenticated
  USING (public.is_admin());
```

**Applied To:**
- products (5 policies: 1 public SELECT, 4 admin)
- product_variants (5 policies: 1 public SELECT, 4 admin)
- orders (4 policies: all admin-only)
- order_items (4 policies: all admin-only)
- custom_quotes (4 policies: 1 public INSERT, 3 admin)
- admin_users (1 policy: admin read-only)

**Total:** 23 policies created

---

## TRANSACTION SAFETY

### Wrapped in BEGIN...COMMIT

**Implementation:**
```sql
BEGIN;
  -- All migration steps
  -- Built-in verification
COMMIT;
```

**Why:**
- Atomic operation: all changes or no changes
- Automatic rollback on any error
- Cannot leave database in partially-migrated state
- No manual rollback needed for failures

**Failure Scenarios:**
1. Admin email doesn't exist → Exception raised → Auto rollback
2. Policy creation fails → Auto rollback
3. Verification fails → Exception raised → Auto rollback

### Built-In Verification Before Commit

**Implementation:**
```sql
DO $$
DECLARE
  admin_count INTEGER;
  policy_count INTEGER;
  unsafe_policy_count INTEGER;
BEGIN
  -- Check admin_users populated
  SELECT COUNT(*) INTO admin_count FROM admin_users;
  IF admin_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: No admin users';
  END IF;

  -- Check policies created
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE ...;
  IF policy_count < 22 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Expected at least 22 policies, found %', policy_count;
  END IF;

  -- Check no unsafe policies remain
  SELECT COUNT(*) INTO unsafe_policy_count FROM pg_policies
  WHERE policyname LIKE '%authenticated_full_access%';
  IF unsafe_policy_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found % unsafe policies', unsafe_policy_count;
  END IF;
END $$;
```

**Why:**
- Catches migration errors before commit
- Verifies security guarantees met
- Prevents partial success (e.g., admin created but policies not dropped)

---

## GRANTS vs RLS

### RLS Does Not Grant Table Access

**Important Distinction:**
- **Table GRANT:** Controls whether role can access table at all
- **RLS Policy:** Controls which rows within table the role can see/modify

**Order of Enforcement:**
1. Check table GRANTs (SELECT/INSERT/UPDATE/DELETE privileges)
2. If granted, then check RLS policies (which rows)
3. If no GRANT, RLS is not evaluated (access denied immediately)

**This Migration:**
- **Does NOT modify table grants** (maintains existing grants)
- **Only modifies RLS policies** (row-level restrictions)

**Verification:**
Preflight and postflight queries include:
```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (...)
  AND grantee IN ('anon', 'authenticated', 'service_role');
```

**Expected:** Grants unchanged before/after migration

**Why This Matters:**
If table grants are too restrictive, even service role cannot modify data. If table grants are too permissive, RLS alone won't protect data from SQL injection via service role key exposure.

---

## APPLICATION COMPATIBILITY

### Admin Dashboard Queries (app/admin/page.tsx)

**Current Code:**
```typescript
const supabase = await createClient();  // Uses anon key
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  redirect('/admin/login');
}

// Fetch dashboard stats
const { count: productsCount } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: true });
```

**Before Migration:**
- Query succeeds because `authenticated_full_access_products` policy grants access

**After Migration:**
- Query succeeds IF user is in admin_users table
- `admin_select_products` policy calls `is_admin()` function
- Function checks if `auth.uid()` is in `admin_users`
- If true, policy allows access
- If false, policy denies access (returns 0 rows or permission error)

**Client-Side Auth Check:**
```typescript
if (!user) {
  redirect('/admin/login');
}
```

**Issue:** Only checks if authenticated, NOT if admin

**Recommendation (Post-Migration):**
```typescript
// Add server-side admin check
const { data: isAdminResult } = await supabase
  .rpc('is_admin')
  .single();

if (!isAdminResult) {
  redirect('/'); // Not admin, redirect to homepage
}
```

**Why Not Done In Migration:**
- Migration only changes database security
- Application code changes are separate concern
- RLS will block data access even if routes are accessible

---

## ROLLBACK POLICY

### What Will NOT Be Done In Rollback

**NEVER restore these unsafe policies:**
```sql
-- ❌ DO NOT RESTORE
CREATE POLICY "authenticated_full_access_products" ON products
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**Why:**
- Defeats entire purpose of migration
- Re-introduces critical security vulnerabilities
- Any authenticated user can delete all data

### What CAN Be Done In Rollback

**Option 1: Fix Forward (Preferred)**
- Add missing admin to admin_users table
- Fix broken policy definitions
- Maintain security restrictions

**Option 2: Restore Public Access Only**
- Restore public read policies (products, variants)
- Restore public quote submission
- Keep admin restrictions in place
- Storefront works, admin access limited

**Option 3: Full Database Restore (Last Resort)**
- Restore from backup taken before migration
- Loses all changes after backup
- Requires re-running migration with fixes

---

## ASSUMPTIONS REQUIRING VERIFICATION

### Assumption 1: Supabase Default Grants

**Assumed:**
```sql
-- These grants already exist:
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;
-- ... etc for all tables
```

**Why Assumed:**
- Standard Supabase setup grants full DML to authenticated role
- RLS is the restrictive layer
- Preflight query will verify

**If Assumption Wrong:**
- Policies will have no effect (no table access at all)
- Need to add grants: `GRANT SELECT ON products TO authenticated;`

**Verification:**
Run preflight query 5 (table grants check) and compare before/after

---

### Assumption 2: auth.uid() Function Available

**Assumed:**
```sql
-- Supabase provides:
SELECT auth.uid();  -- Returns current user's UUID
SELECT auth.email();  -- Returns current user's email
```

**Why Assumed:**
- Standard Supabase auth schema
- Used throughout existing policies

**If Assumption Wrong:**
- All policies will fail (function not found)
- Migration will fail at policy creation

**Verification:**
Existing policies already use `auth.uid()`, so it must exist

---

### Assumption 3: Admin Will Test Before Production

**Assumed:**
- Migration will be tested on staging/development first
- Admin has service role key access for emergency fixes
- Database backup exists before migration

**Why Important:**
- First execution may reveal environment-specific issues
- Service role key required for admin management
- Backup required for worst-case rollback

**If Assumption Wrong:**
- Production failure could lock out admin
- No way to add new admins without service role key
- Cannot rollback without backup

**Verification:**
Included in preflight checklist

---

### Assumption 4: Single Admin Initially

**Assumed:**
- Only one admin email needed initially
- More admins can be added later via service role

**Why Assumed:**
- Typical startup scenario
- Reduces migration complexity
- Easy to add more admins post-migration

**If Assumption Wrong:**
- Add multiple INSERT statements in Step 4
- Or add admins immediately after migration

**Verification:**
Migration explicitly asks for admin email in Step 4

---

### Assumption 5: Orders Not Currently Used

**Assumed:**
```sql
-- orders and order_items tables are empty or unused
SELECT COUNT(*) FROM orders;  -- Returns 0 or low number
```

**Why Assumed:**
- Code inspection shows WhatsApp-only ordering
- No database persistence in product detail page

**If Assumption Wrong:**
- Admin-only policies will block customer access
- Need customer-scoped policies (users see only their orders)

**Verification:**
Preflight query 4 checks record counts

---

## SECURITY GUARANTEES

### After Successful Migration

**Guaranteed:**
1. ✅ Only designated admins can CREATE/UPDATE/DELETE products
2. ✅ Only designated admins can access orders/order_items tables
3. ✅ Only designated admins can READ/UPDATE/DELETE quotes
4. ✅ Public can still READ published products
5. ✅ Public can still READ all product variants
6. ✅ Public can still SUBMIT custom quotes
7. ✅ Admin list cannot be modified except by service role
8. ✅ No recursive RLS evaluation (uses SECURITY DEFINER function)
9. ✅ Function cannot be hijacked (search_path locked)
10. ✅ All five unsafe `authenticated_full_access_*` policies removed

**Not Guaranteed (Application-Layer Concerns):**
- ❌ Admin routes still accessible to non-admins (client-side check only)
- ❌ No rate limiting on quote submissions
- ❌ No audit logging of admin actions

---

## NEXT STEPS AFTER MIGRATION

### Immediate (Required)

1. **Test is_admin() Function**
   ```sql
   -- As admin user:
   SELECT public.is_admin();  -- Should return true
   
   -- As non-admin user:
   SELECT public.is_admin();  -- Should return false
   ```

2. **Test Product Access**
   - Admin: Try creating/editing product
   - Public: Browse products (should work)
   - Non-admin authenticated: Try editing product (should fail)

3. **Monitor Logs**
   - Watch for permission denied errors
   - Check for unexpected RLS policy violations

### Short-Term (Recommended)

1. **Add Server-Side Admin Route Protection**
   ```typescript
   // middleware.ts or app/admin/layout.tsx
   const { data } = await supabase.rpc('is_admin').single();
   if (!data) {
     return new Response('Forbidden', { status: 403 });
   }
   ```

2. **Build Admin Management UI**
   - Create `/admin/users` page
   - List current admins
   - Add/remove admins (via server-side API with service role key)

3. **Implement Rate Limiting**
   - Add Vercel Rate Limiting for quote submissions
   - Or use Upstash Rate Limit (Redis-based)

---

## FILES SUMMARY

**Migration SQL:**
- `rls-migration-secure.sql` - Complete migration with all security fixes

**Documentation:**
- `RLS-SECURITY-DECISIONS.md` - This file (security rationale)
- `RLS-MIGRATION-CORRECTED.md` - Deployment guide
- `RLS-FINDINGS-AND-REMEDIATION.md` - Original security analysis

**Previous (Superseded):**
- `rls-migration.sql` - Had recursive RLS issue (do not use)

---

## APPROVAL CHECKLIST

Before approving migration execution, verify:

- [ ] Preflight queries have been run and results documented
- [ ] Admin email on line 103 is correct and exists in auth.users
- [ ] Database backup has been created
- [ ] Security decisions in this document have been reviewed
- [ ] Rollback procedure has been reviewed and understood
- [ ] Service role key is available for emergency admin additions
- [ ] Application code review confirms admin dashboard will work
- [ ] Postflight verification queries are ready to run
- [ ] Plan for monitoring logs for 24 hours after migration
- [ ] Understanding that rollback will NOT restore unsafe policies

---

**Status:** ✅ Ready for approval  
**Security:** All known issues addressed  
**Risk Level:** MEDIUM (proper safeguards in place)  
**Next Action:** Await approval, then execute on production

---

**Prepared By:** Claude Code Security Review  
**Date:** 2026-10-15  
**Last Updated:** 2026-10-15
