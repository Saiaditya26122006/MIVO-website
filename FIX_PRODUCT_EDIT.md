# Fix Product Edit Issues - Complete Guide

## Problem
Product edit page shows 404 or updates fail to save to database.

## Root Causes
1. **Missing edit page route** (FIXED ✓)
2. **Row Level Security (RLS) policies blocking updates** (NEEDS FIX)
3. **Missing database columns** (MAY NEED FIX)

## Solution Steps

### Step 1: Diagnose Database State

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- File: diagnose-database.sql
```

Copy the entire contents of `diagnose-database.sql` and run it.

**Check the output:**
- ✓ All pricing columns should exist (pricing_method, pricing_config, etc.)
- ✓ RLS should be enabled on products table
- ✓ You should see your email in auth.users list

### Step 2: Run Database Migration (If Columns Missing)

If Step 1 shows missing pricing columns, run this migration:

**File:** `supabase-pricing-migration.sql`

```sql
-- Copy entire contents of supabase-pricing-migration.sql
-- Run in Supabase SQL Editor
```

This adds:
- `pricing_method` (text)
- `pricing_config` (jsonb)
- `production_time_days` (integer)
- `min_quantity` (integer)
- `max_quantity` (integer)

### Step 3: Fix RLS Permissions (CRITICAL)

**File:** `fix-update-permissions.sql`

This script:
1. Drops all conflicting RLS policies
2. Creates new policies allowing authenticated users FULL access
3. Allows public to view published products only

```sql
-- Copy entire contents of fix-update-permissions.sql
-- Run in Supabase SQL Editor
```

**After running, you should see:**
```
✓ RLS policies updated successfully! Authenticated users now have full access.
```

### Step 4: Test Product Edit

1. **Log in to admin:** http://localhost:3000/admin/login
2. **Go to products:** http://localhost:3000/admin/products
3. **Click "Edit" on any product**
4. **Make a change** (e.g., update description)
5. **Click "Update & Publish"**

**Check browser console (F12):**
- Should see: `✓ Product updated successfully: [product-id]`
- Should show: Alert "Product updated successfully!"
- Should redirect to products list

**If you see errors:**
- `❌ Database error: new row violates row-level security policy`
  → Go back to Step 3, RLS policies not applied correctly
  
- `❌ Database error: column "pricing_method" does not exist`
  → Go back to Step 2, migration not run
  
- `❌ No active session - please log out and log back in`
  → Log out and log back in at /admin/login

## Files Created/Modified

### New Files (Run in Supabase)
1. ✓ `diagnose-database.sql` - Database diagnostic queries
2. ✓ `fix-update-permissions.sql` - RLS policy fixes
3. ✓ `supabase-pricing-migration.sql` - Pricing columns migration (already exists)

### Modified Files (Already Pushed to GitHub)
1. ✓ `app/admin/products/[id]/edit/page.tsx` - Product edit page
   - Loads existing product data
   - Supports all pricing methods
   - Better error logging
   - Image management

2. ✓ `app/explore/page.tsx` - Fixed filter dependency array

## Verification Checklist

After running all fixes, verify:

- [ ] Can access `/admin/products/[id]/edit` without 404
- [ ] Edit page loads existing product data
- [ ] Can change product name and save
- [ ] Can change pricing method and save
- [ ] Can add/remove images and save
- [ ] Can toggle published/featured and save
- [ ] See success alert after saving
- [ ] Redirects to products list after save
- [ ] Changes appear in products list
- [ ] Changes appear on product detail page `/product/[id]`
- [ ] Changes appear on explore page `/explore`

## Quick Test

```sql
-- Run this in Supabase SQL Editor to verify you have update permissions
UPDATE products
SET description = 'Test update at ' || NOW()
WHERE id = (SELECT id FROM products LIMIT 1)
RETURNING id, name, description;
```

If this succeeds, your permissions are correct!

## Still Having Issues?

1. **Clear browser cache and reload**
2. **Log out and log back in** to refresh session
3. **Check Supabase logs** in Dashboard → Logs → Database
4. **Check browser console (F12)** for JavaScript errors
5. **Verify environment variables** in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   ```

## Security Note

The `fix-update-permissions.sql` script gives ALL authenticated users full access to products. This is fine for a single-admin setup. If you need to restrict to specific users later, you can add email-based policies:

```sql
-- Example: Restrict to specific admin email
CREATE POLICY "specific_admin_full_access" ON products
  FOR ALL
  TO authenticated
  USING (auth.email() = 'your-admin@email.com')
  WITH CHECK (auth.email() = 'your-admin@email.com');
```

## Summary

1. ✅ Edit page route created
2. ⏳ Run `diagnose-database.sql` to check state
3. ⏳ Run `supabase-pricing-migration.sql` if needed
4. ⏳ Run `fix-update-permissions.sql` to fix RLS
5. ✅ Test editing products
6. ✅ Push changes to GitHub/Vercel (already done)

The code is ready - you just need to run the SQL scripts in Supabase!
