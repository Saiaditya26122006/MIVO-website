# RLS Migration - Deployment Guide

**Status:** ✅ READY FOR DEPLOYMENT  
**Migration File:** `rls-migration.sql`  
**Risk Level:** 🔴 HIGH (Database security changes)  
**Date:** 2026-10-15

---

## EXECUTIVE SUMMARY

This migration fixes **5 critical security vulnerabilities** where any authenticated user could:
- Create/modify/delete ALL products
- Read/modify/delete ALL orders and customer data
- Read/modify/delete ALL customer quotes

**After migration:**
- Only designated admins can manage products, orders, and quotes
- Public users can view published products and submit quotes
- Orders/quotes remain protected until explicitly needed

---

## PRE-DEPLOYMENT CHECKLIST

### 1. Identify Admin User(s)

Run this query in Supabase SQL Editor to find your admin email:

```sql
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at
LIMIT 5;
```

**Action Required:**
1. Note the email address you use for admin access
2. Update line 47 in `rls-migration.sql`:
   ```sql
   WHERE email = 'admin@mivo.in' -- ← CHANGE THIS to your admin email
   ```

### 2. Run Preflight Queries

Copy and run these read-only queries to verify current state:

```sql
-- Query 1: Check if admin_users table already exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'admin_users'
) as admin_table_exists;

-- Query 2: List all current RLS policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- Query 3: Verify orders/quotes are empty (currently unused)
SELECT 
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;

-- Query 4: Confirm no existing admin-only policies
SELECT COUNT(*) as permissive_policy_count
FROM pg_policies
WHERE permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text;
-- Expected: Several rows (these will be dropped)
```

**Expected Results:**
- `admin_table_exists`: false
- Current policies: Should see `authenticated_full_access_*` policies
- Orders/quotes: Should be 0 or low counts
- Permissive policies: 5+ (will be removed)

### 3. Create Database Backup

**Via Supabase Dashboard:**
1. Go to Database → Backups
2. Click "Create backup"
3. Wait for confirmation

**Via CLI (if available):**
```bash
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" > backup-pre-rls-$(date +%Y%m%d).sql
```

### 4. Prepare Rollback Plan

If migration fails, you can restore public read access:

```sql
-- Emergency: Restore public product viewing only
BEGIN;
DROP POLICY IF EXISTS "public_select_published_products" ON products;
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO public
  USING (published = true);

DROP POLICY IF EXISTS "public_select_variants" ON product_variants;
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO public
  USING (true);
COMMIT;
```

⚠️ **DO NOT restore the insecure `authenticated_full_access_*` policies**

---

## DEPLOYMENT PROCEDURE

### Step 1: Review Migration File

Open `rls-migration.sql` and verify:
- [ ] Line 47: Admin email is correct
- [ ] Step 4-8: Policies match your requirements
- [ ] Public read access to products/variants is preserved

### Step 2: Execute Migration

**Via Supabase SQL Editor** (Recommended):
1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `rls-migration.sql`
4. Click "Run"
5. Wait for success confirmation

**Expected Output:**
```
NOTICE: Admin user(s) inserted: 1
NOTICE: ✅ Migration verification passed
NOTICE:    Admin users: 1
NOTICE:    Policies created: 25
```

**Via psql** (Alternative):
```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f rls-migration.sql
```

**Execution Time:** ~2-5 seconds  
**Downtime:** None (policies apply immediately)

### Step 3: Verify Migration Success

Run post-migration verification queries:

```sql
-- Verify 1: Admin table created and populated
SELECT * FROM admin_users ORDER BY granted_at;
-- Expected: 1 row with your admin user_id

-- Verify 2: Old permissive policies removed
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%authenticated_full_access%';
-- Expected: 0 rows

-- Verify 3: New admin policies created
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
GROUP BY tablename
ORDER BY tablename;
-- Expected:
--   admin_users: 1
--   custom_quotes: 4
--   order_items: 4
--   orders: 4
--   product_variants: 5
--   products: 5

-- Verify 4: Check you are recognized as admin
SELECT 
  auth.uid() as my_user_id,
  auth.email() as my_email,
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) as am_i_admin;
-- Expected: am_i_admin = true
```

### Step 4: Test Access Levels

**Test as Admin (Yourself):**
1. Ensure you're signed in with admin email
2. Go to `/admin` dashboard
3. Try creating a new product
4. Try editing an existing product
5. Verify no errors in browser console

**Test as Public User:**
1. Open site in incognito window (not signed in)
2. Browse products on homepage
3. View product detail pages
4. Verify products load correctly
5. Check browser console for RLS errors

**Test as Non-Admin Authenticated User:**
1. Create a test account with non-admin email
2. Sign in
3. Try accessing `/admin` routes
4. Should still be blocked by client-side check
5. API calls should fail with RLS policy violation if attempted

---

## POST-DEPLOYMENT VERIFICATION

### Immediate Checks (Within 5 minutes)

- [ ] Admin can access `/admin` dashboard
- [ ] Admin can create/edit products
- [ ] Public can view products
- [ ] No RLS policy errors in Supabase logs

### Monitor for 24 Hours

- [ ] Check Supabase logs for RLS policy violations
- [ ] Monitor customer reports of broken functionality
- [ ] Verify quote submissions work (when feature implemented)

### Verification Queries

```sql
-- Check Supabase logs for RLS errors
-- (Via Supabase Dashboard → Logs → Postgres Logs)
-- Look for: "permission denied" or "policy violation"

-- Count admin actions today
SELECT COUNT(*) 
FROM admin_users 
WHERE granted_at::date = CURRENT_DATE;

-- Verify no one modified products except admin
-- (After implementing audit log)
```

---

## TROUBLESHOOTING

### Issue 1: "MIGRATION ABORTED: No admin user found"

**Cause:** Email in Step 2 doesn't match any auth.users record

**Fix:**
1. Check your actual email:
   ```sql
   SELECT email FROM auth.users ORDER BY created_at;
   ```
2. Update line 47 in `rls-migration.sql` with correct email
3. Re-run migration

### Issue 2: Admin Locked Out After Migration

**Cause:** Admin user not inserted before policies dropped

**Fix (requires service role key):**
```sql
-- Connect with service role key, then:
INSERT INTO admin_users (user_id, notes)
SELECT id, 'Emergency admin restoration'
FROM auth.users
WHERE email = 'your-actual-email@example.com';
```

### Issue 3: Products Not Visible on Homepage

**Cause:** Public read policy missing or incorrect

**Fix:**
```sql
-- Verify policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'products' 
  AND policyname = 'public_select_published_products';

-- If missing, recreate:
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO public
  USING (published = true);
```

### Issue 4: Product Variants Not Loading

**Cause:** Public variant read policy missing

**Fix:**
```sql
-- Verify policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'product_variants' 
  AND policyname = 'public_select_variants';

-- If missing, recreate:
CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (true);
```

---

## ADDING/REMOVING ADMINS

### Add New Admin

**Option 1: Via SQL (requires service role key)**
```sql
INSERT INTO admin_users (user_id, notes)
SELECT id, 'Added by [your-name] on 2026-10-15'
FROM auth.users
WHERE email = 'newadmin@mivo.in';
```

**Option 2: Build Admin Management UI**
- Create `/admin/users` page
- Only super_admins can add/remove admins
- Use server-side API with service role key

### Remove Admin

```sql
DELETE FROM admin_users
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'oldadmin@mivo.in'
);
```

### List All Admins

```sql
SELECT 
  au.user_id,
  u.email,
  au.granted_at,
  au.notes
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.granted_at;
```

---

## MAINTENANCE

### Weekly

- [ ] Review admin_users table for unauthorized additions
- [ ] Check Supabase logs for RLS policy violations
- [ ] Verify no new permissive policies added accidentally

### Monthly

- [ ] Audit list of admin users
- [ ] Review and archive admin_audit_log (if implemented)
- [ ] Test non-admin user cannot access admin functions

### After Major Code Changes

- [ ] Re-run verification queries
- [ ] Test all three access levels (public, authenticated, admin)
- [ ] Check for new RLS policy violations in logs

---

## SECURITY NOTES

### What This Migration Fixes

✅ **Before:** Any authenticated user could delete all products  
✅ **After:** Only designated admins can manage products

✅ **Before:** Any authenticated user could read all customer orders  
✅ **After:** Orders only accessible to admins

✅ **Before:** Any authenticated user could read all customer quotes  
✅ **After:** Quotes only accessible to admins

### What Still Needs Attention

⚠️ **Client-Side Admin Route Protection**
- Currently `/admin` routes only check `if (!user)`
- Should add server-side admin verification
- **Fix:** Add middleware to check `is_admin()` on all `/admin` routes

⚠️ **Rate Limiting for Quote Submissions**
- RLS cannot enforce rate limits
- Public quote submission has no rate limiting
- **Fix:** Add application-level rate limiting (Vercel Rate Limiting, Upstash, etc.)

⚠️ **Admin Audit Logging**
- Currently no tracking of who changed what
- **Fix:** Implement admin_audit_log (commented out in migration)

---

## ROLLBACK PROCEDURE

### If Migration Completely Fails

```sql
BEGIN;

-- Drop new tables/functions
DROP TABLE IF EXISTS admin_users CASCADE;

-- Restore ONLY public read access (DO NOT restore permissive policies)
CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO public
  USING (published = true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO public
  USING (true);

COMMIT;
```

Then restore from database backup.

### If Partial Failure

Identify failed step and fix forward:
1. Check which policies were created: `SELECT * FROM pg_policies WHERE ...`
2. Drop conflicting policies: `DROP POLICY IF EXISTS ...`
3. Manually create missing policies from migration file
4. Re-run verification queries

---

## CONTACT & SUPPORT

**Migration Issues:**
- Check Supabase Dashboard → Logs → Postgres Logs
- Review `RLS-FINDINGS-AND-REMEDIATION.md` for background
- Search for error message in PostgreSQL documentation

**Emergency Admin Lockout:**
- Requires service role key (NEVER expose to client)
- Use Supabase Dashboard SQL Editor (uses service role automatically)
- Follow "Issue 2" in Troubleshooting section

---

## APPENDIX: Policy Reference

### Products Table Policies

| Policy Name | Roles | Command | Access Level |
|------------|-------|---------|--------------|
| `public_select_published_products` | public | SELECT | Published products only |
| `admin_select_products` | authenticated | SELECT | Admins only |
| `admin_insert_products` | authenticated | INSERT | Admins only |
| `admin_update_products` | authenticated | UPDATE | Admins only |
| `admin_delete_products` | authenticated | DELETE | Admins only |

### Product Variants Table Policies

| Policy Name | Roles | Command | Access Level |
|------------|-------|---------|--------------|
| `public_select_variants` | anon, authenticated | SELECT | All variants (public) |
| `admin_insert_variants` | authenticated | INSERT | Admins only |
| `admin_update_variants` | authenticated | UPDATE | Admins only |
| `admin_delete_variants` | authenticated | DELETE | Admins only |

### Orders Table Policies

| Policy Name | Roles | Command | Access Level |
|------------|-------|---------|--------------|
| `admin_select_orders` | authenticated | SELECT | Admins only |
| `admin_insert_orders` | authenticated | INSERT | Admins only |
| `admin_update_orders` | authenticated | UPDATE | Admins only |
| `admin_delete_orders` | authenticated | DELETE | Admins only |

*(Note: Customer-scoped policies not included yet - orders currently via WhatsApp only)*

### Custom Quotes Table Policies

| Policy Name | Roles | Command | Access Level |
|------------|-------|---------|--------------|
| `public_insert_quotes` | anon, authenticated | INSERT | Anyone can submit |
| `admin_select_quotes` | authenticated | SELECT | Admins only |
| `admin_update_quotes` | authenticated | UPDATE | Admins only |
| `admin_delete_quotes` | authenticated | DELETE | Admins only |

---

**Last Updated:** 2026-10-15  
**Migration File Version:** rls-migration.sql (corrected)  
**Next Review:** After deployment + 1 week
