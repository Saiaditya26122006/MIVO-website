# RLS Migration Execution Checklist

**Date:** 2026-10-15  
**Purpose:** Fix critical RLS vulnerability - replace permissive policies with proper admin-only access

---

## ⚠️ PRE-FLIGHT CHECKS

- [ ] **Backup**: Take Supabase project backup (Settings > Database > Backups)
- [ ] **Access**: Confirm you have Supabase SQL Editor access
- [ ] **Timing**: Choose low-traffic time (migration takes ~30 seconds)
- [ ] **Browser**: Open Supabase dashboard in one tab, /admin in another

---

## 📋 STEP 1: IDENTIFY ADMIN USER (5 minutes)

Open Supabase SQL Editor and run:

```sql
-- Find your admin user ID
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```

**Write down your admin user UUID and email here:**
```
Admin User ID: _________________________________
Admin Email: ___________________________________
```

**⚠️ CRITICAL:** You MUST edit `rls-migration.sql` and replace the email in Step 2:
1. Open `rls-migration.sql` in a text editor
2. Find line that says: `WHERE email = 'admin@mivo.in'`
3. Replace `'admin@mivo.in'` with your actual admin email (in quotes)
4. Save the file

---

## 📋 STEP 2: RUN MIGRATION (2 minutes)

**⚠️ BEFORE RUNNING:** Verify you edited the admin email in Step 1!

1. Open file: `rls-migration.sql` (in this directory)
2. **VERIFY** that line with `WHERE email = '...'` has YOUR admin email
3. Copy entire contents
4. Paste into Supabase SQL Editor
5. Click **RUN**
6. Wait for success message

**Expected output:**
```
NOTICE: Admin user(s) inserted: 1
NOTICE: ✅ Migration verification passed
NOTICE:    Admin users: 1
NOTICE:    Policies created: 25
Success. No rows returned
```

If you see `MIGRATION ABORTED: No admin user found`, the email is wrong. Fix it and try again.

If you see other errors, **STOP** and note the error message.

---

## 📋 STEP 3: VERIFY ADMIN USER (1 minute)

**This step is now automatic!** The corrected migration inserts the admin user inside the transaction.

Verify it worked:

```sql
-- Check admin user was inserted
SELECT
  u.email,
  a.granted_at,
  a.notes
FROM admin_users a
JOIN auth.users u ON u.id = a.user_id;
```

**Expected output:** Should show your admin email with a timestamp

If this returns no rows, the migration failed to insert the admin user (wrong email in migration file).

---

## 📋 STEP 4: VERIFY POLICIES (2 minutes)

```sql
-- Check that permissive policies are GONE
SELECT policyname, tablename
FROM pg_policies
WHERE policyname LIKE 'authenticated_full_access%';
```

**Expected output:** `No rows returned` (if you see rows, policies weren't dropped!)

```sql
-- Check that new admin policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes', 'admin_users')
ORDER BY tablename, cmd;
```

**Expected output:** Should see ~25 policies with names like:
- `admin_select_products`, `admin_insert_products`, etc.
- `public_select_variants` (important for public storefront)
- `public_insert_quotes` (important for quote submission)

---

## 📋 STEP 5: TEST ADMIN ACCESS (5 minutes)

### Test 5A: Admin Dashboard
- [ ] Navigate to `/admin`
- [ ] Should see dashboard (not redirected to login)
- [ ] No console errors

### Test 5B: Products List
- [ ] Navigate to `/admin/products`
- [ ] Should see products list
- [ ] Click "Add New Product" - form should load

### Test 5C: Create Product (end-to-end test)
- [ ] Fill in product form with test data:
  - Name: "RLS Test Product"
  - Description: "Testing RLS policies"
  - Price: 99.99
  - Category: "test"
  - Published: No
- [ ] Click "Create Product"
- [ ] Should see success message
- [ ] Product should appear in list

### Test 5D: Edit Product
- [ ] Click "Edit" on test product
- [ ] Change price to 149.99
- [ ] Click "Update Product"
- [ ] Should see success message

### Test 5E: Delete Product
- [ ] Click "Delete" on test product
- [ ] Confirm deletion (type DELETE)
- [ ] Product should be removed from list

**If any test fails, note which one and check browser console for errors**

---

## 📋 STEP 6: TEST PUBLIC ACCESS (3 minutes)

### Test 6A: Published Products (Incognito Browser)
- [ ] Open incognito/private browser window
- [ ] Navigate to `/explore`
- [ ] Should see published products
- [ ] Should NOT see unpublished products

### Test 6B: Admin Redirect (Incognito Browser)
- [ ] Try to access `/admin`
- [ ] Should redirect to `/admin/login`

### Test 6C: Custom Quote Submission (Incognito Browser)
- [ ] Navigate to quote submission page
- [ ] Fill in form with test data
- [ ] Should submit successfully
- [ ] Check `/admin` - quote should appear in admin panel

---

## 📋 STEP 7: VERIFY RLS ENFORCEMENT (2 minutes)

Run this test to ensure non-admins can't access protected data:

```sql
-- Simulate a non-admin user
SET LOCAL jwt.claims.sub = '00000000-0000-0000-0000-000000000000'; -- Fake user ID

-- These should all return empty or fail
SELECT COUNT(*) as should_be_zero FROM orders;
SELECT COUNT(*) as should_be_zero FROM custom_quotes;

-- This should only show published products
SELECT COUNT(*) as only_published FROM products;
SELECT COUNT(*) as should_have_some FROM products WHERE published = true;

-- Reset
RESET jwt.claims.sub;
```

**Expected output:**
- orders count: 0
- custom_quotes count: 0
- products count: only published ones

---

## ✅ SUCCESS CRITERIA

Migration is successful when ALL of the following are true:

- [x] No `authenticated_full_access_*` policies exist
- [x] Admin user is in `admin_users` table
- [x] Admin can log in to `/admin`
- [x] Admin can create/edit/delete products
- [x] Public can see published products
- [x] Public cannot access `/admin`
- [x] Public can submit custom quotes
- [x] Non-admin authenticated users cannot read orders/quotes

---

## 🚨 ROLLBACK (If Something Goes Wrong)

If admin access is broken, run this emergency rollback:

```sql
BEGIN;

-- Temporarily restore permissive policies for emergency access
CREATE POLICY "emergency_admin_access" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "emergency_admin_access" ON product_variants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "emergency_admin_access" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "emergency_admin_access" ON order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "emergency_admin_access" ON custom_quotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
```

**After rollback:**
1. Test that admin access is restored
2. Review what went wrong
3. Fix the issue
4. Re-run migration

---

## 📝 POST-MIGRATION NOTES

**Record completion:**
- Migration completed: _______________ (date/time)
- Admin user UUID: ___________________________________
- Tests passed: ☐ Yes  ☐ No (if no, describe issue)
- Issues encountered: _________________________________

**Next steps after successful migration:**
- [ ] Delete test products created during testing
- [ ] Monitor error logs for 24 hours
- [ ] Document any new admin users that need to be added
- [ ] Consider updating `lib/auth/admin.ts` to check `admin_users` table (optional enhancement)

---

## 🆘 TROUBLESHOOTING

### Issue: "Admin can't see products after migration"
**Cause:** Admin user not in admin_users table  
**Fix:** Run Step 3 again with correct user ID

### Issue: "Public can't see published products"
**Cause:** Public read policy missing  
**Fix:** Run `CREATE POLICY "Public can view published products" ON products FOR SELECT TO anon, authenticated USING (published = true);`

### Issue: "Error: infinite recursion detected"
**Cause:** Circular policy dependency  
**Fix:** This shouldn't happen with the provided migration. Contact support if it does.

### Issue: "Policies exist but access still too permissive"
**Cause:** Old permissive policies not dropped  
**Fix:** Manually drop with `DROP POLICY IF EXISTS "authenticated_full_access_products" ON products;` (repeat for all tables)

---

**Ready to proceed? Start with Step 1.**
