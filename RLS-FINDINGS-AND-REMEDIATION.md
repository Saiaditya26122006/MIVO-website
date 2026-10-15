# MIVO RLS Security - Findings and Remediation Plan

**Date:** 2026-10-15  
**Status:** ⚠️ **CRITICAL - READY FOR REVIEW**  
**Reviewed Against:** Live Supabase database policies

---

## EXECUTIVE SUMMARY

**Current Risk Level:** 🔴 **CRITICAL**

**Finding:** All five tables have overly permissive policies that grant ANY authenticated user FULL access (SELECT, INSERT, UPDATE, DELETE) to ALL data.

**Impact:**
- Any authenticated user can create/modify/delete ALL products
- Any authenticated user can read/modify/delete ALL orders
- Any authenticated user can read/modify/delete ALL customer quotes
- No administrator distinction exists in RLS policies
- Current system relies on client-side authentication checks only

**Root Cause:** Policies use `authenticated` role with `USING (true)` which means "allow if JWT exists, regardless of content"

---

## FINDINGS FROM CODE INSPECTION

### 1. Supabase Client Configuration ✅ SECURE

**Files Reviewed:**
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

**Finding:**
```typescript
// Browser client
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server client  
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```

✅ **CORRECT:** Both use anon/publishable key (not service role)  
✅ **NO SERVICE ROLE EXPOSURE** to browser clients

---

### 2. Admin Authentication Flow ⚠️ NO ADMIN VERIFICATION

**File:** `app/admin/login/page.tsx`

**Current Implementation:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (data.user) {
  window.location.href = '/admin';
}
```

**Finding:** 
- ❌ No admin role verification
- ❌ No distinction between regular users and administrators
- ❌ ANY authenticated user can access `/admin` routes
- ❌ Client-side redirect can be bypassed

**Admin Page Check:**
```typescript
// app/admin/page.tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  redirect('/admin/login');
}
```

**Finding:**
- ❌ Only checks if user is authenticated
- ❌ Does NOT check if user is administrator
- ❌ Any signed-in user can access admin dashboard

---

### 3. Product Management ⚠️ RELIES ON RLS ONLY

**File:** `app/admin/products/new/page.tsx`

**Product Creation:**
```typescript
const { data: product, error } = await supabase
  .from('products')
  .insert({ name, description, ... })
  .select()
  .single();
```

**Finding:**
- Uses client Supabase instance (anon key)
- Relies entirely on RLS to restrict access
- With current RLS policy `authenticated_full_access_products`:
  - ✅ Authenticated users can insert (intended for admins)
  - ❌ **ANY** authenticated user can insert (not intended)
  - ❌ No server-side admin verification

**Product Updates:** Same pattern (relies on RLS)

**Product Deletion:** Same pattern (relies on RLS)

---

### 4. Order Flow ✅ WHATSAPP ONLY (No Database)

**File:** `app/product/[id]/page.tsx`

**Finding:**
```typescript
// Build WhatsApp message
window.open(`https://wa.me/YOUR_PHONE?text=${encodeURIComponent(message)}`);
```

✅ **Orders DO NOT persist to database**  
✅ Orders go through WhatsApp only  
✅ No RLS exposure for order creation

**Impact on RLS:**
- `orders` and `order_items` tables appear unused by current application
- Policies are overly permissive but not currently exploitable
- Future order persistence (from MVP plan) will need proper policies

---

### 5. Quote Submission ⚠️ NOT IMPLEMENTED

**File:** `app/custom/page.tsx`

**Finding:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // TODO: Implement actual form submission to Supabase
  await new Promise((resolve) => setTimeout(resolve, 1500));
  alert('Quote request submitted!');
};
```

❌ **Quote submission is NOT IMPLEMENTED**  
❌ Public policy `public_insert_quotes` exists but is unused  
✅ No current RLS exposure (feature not built)

---

### 6. Current Live Policies (Verified)

**Confirmed policies from your inspection:**

```sql
-- OVERLY PERMISSIVE POLICIES (Current State)

-- Products
CREATE POLICY "authenticated_full_access_products" ON products
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "public_select_published_products" ON products
  FOR SELECT TO public
  USING (published = true);

-- Product Variants
CREATE POLICY "authenticated_full_access_variants" ON product_variants
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "public_select_variants" ON product_variants
  FOR SELECT TO public
  USING (true);

-- Orders
CREATE POLICY "authenticated_full_access_orders" ON orders
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Order Items
CREATE POLICY "authenticated_full_access_order_items" ON order_items
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Custom Quotes
CREATE POLICY "authenticated_full_access_quotes" ON custom_quotes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT TO public
  WITH CHECK (true);
```

---

## SECURITY VULNERABILITIES

### Vulnerability 1: Any Authenticated User Can Manage Products (CRITICAL)

**Policy:** `authenticated_full_access_products`

**Attack Scenario:**
1. Attacker creates account with any email
2. Attacker signs in (becomes `authenticated`)
3. Policy `USING (true)` grants full access
4. Attacker can:
   - Delete all products
   - Modify product prices to ₹0
   - Publish/unpublish products
   - Inject malicious content

**Current Mitigation:** NONE (relies on obscurity)

**Exploitability:** HIGH (anyone can create account)

---

### Vulnerability 2: Any Authenticated User Can Access All Orders (HIGH)

**Policy:** `authenticated_full_access_orders`

**Attack Scenario:**
1. Attacker creates account
2. Policy grants access to ALL orders
3. Attacker can:
   - Read all customer data (names, emails, phones, addresses)
   - Modify order amounts
   - Delete orders
   - View competitor purchasing patterns

**Current Mitigation:** Orders not used (WhatsApp flow)

**Future Risk:** HIGH (when order persistence added per MVP plan)

---

### Vulnerability 3: Any Authenticated User Can Access All Quotes (HIGH)

**Policy:** `authenticated_full_access_quotes`

**Attack Scenario:**
1. Attacker creates account
2. Reads all quote requests (customer contact info, project details)
3. Contacts customers directly (competitor poaching)
4. Deletes or modifies quotes

**Current Mitigation:** Quote feature not implemented

**Future Risk:** HIGH (when feature implemented)

---

### Vulnerability 4: Public Can Spam Quotes (MEDIUM)

**Policy:** `public_insert_quotes` with `WITH CHECK (true)`

**Attack Scenario:**
1. No authentication required
2. No rate limiting in RLS
3. Attacker submits unlimited quotes
4. Database spam, storage costs

**Current Mitigation:** Feature not implemented

**Future Risk:** MEDIUM (when feature implemented)

---

### Vulnerability 5: No Admin Verification (CRITICAL)

**Finding:** No distinction between regular users and administrators

**Impact:**
- Admin dashboard accessible to any authenticated user
- Product management accessible to any authenticated user
- Relies on RLS policies (which grant access to ALL authenticated)

**Current Mitigation:** Obscurity (admin routes not public knowledge)

---

## POSTGRESQL PERMISSIVE POLICY SEMANTICS

**Important:** PostgreSQL uses OR logic for PERMISSIVE policies.

**Current Situation:**
```sql
-- Policy 1 (PERMISSIVE)
CREATE POLICY "authenticated_full_access" ...
  FOR ALL TO authenticated USING (true);

-- If we add Policy 2 (PERMISSIVE)
CREATE POLICY "admins_only" ...
  FOR ALL TO authenticated USING (is_admin());
```

**Result:** Policies are combined with OR logic:
```
Access granted IF (true) OR (is_admin())
= Access granted IF true  -- First policy grants access to everyone!
```

**Solution:** Must DROP overly permissive policies, not just add restrictive ones.

---

## ADMIN AUTHORIZATION OPTIONS

### Option 1: Dedicated Admin Table (RECOMMENDED)

**Approach:** Create `admin_users` table with email allowlist

**Advantages:**
- ✅ Cannot be modified by users (protected by RLS)
- ✅ Easy to audit (database table)
- ✅ Can include role levels (super_admin, editor, viewer)
- ✅ No JWT manipulation risk

**Implementation:**
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protect admin table (only service role can modify)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin table read-only for authenticated" ON admin_users
  FOR SELECT TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies = only service role can modify

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

---

### Option 2: Supabase app_metadata (ALTERNATIVE)

**Approach:** Use Supabase auth metadata (not exposed to client)

**Advantages:**
- ✅ Built into Supabase
- ✅ Cannot be edited by users (requires admin API)
- ✅ Included in JWT automatically

**Disadvantages:**
- ⚠️ Requires Supabase admin API to set
- ⚠️ Less visible (no database table to audit)

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**To set app_metadata:** Use Supabase API or dashboard

---

### Option 3: raw_user_meta_data ❌ NOT RECOMMENDED

**Why NOT recommended:**
- ❌ Can be set by users during signup
- ❌ Users can modify their own metadata
- ❌ Security risk (user-editable authorization)

---

## RECOMMENDED APPROACH

**Use Option 1: Dedicated Admin Table**

**Reasoning:**
1. Most secure (database-backed allowlist)
2. Easy to audit (SQL query shows all admins)
3. Can be version controlled (seed admin table in migrations)
4. No external API calls needed
5. Clear separation of concerns

---

## PROPOSED RLS REMEDIATION

### Phase 1: Create Admin Infrastructure

**1. Create admin_users table**
**2. Seed initial admin(s)**
**3. Create is_admin() function**
**4. Create is_owner() function (for customer data)**

### Phase 2: Replace Permissive Policies

**1. DROP all `authenticated_full_access_*` policies**
**2. CREATE restrictive policies with admin checks**
**3. CREATE customer-scoped policies (for future order persistence)**

### Phase 3: Verification

**1. Test public access (should see only published products)**
**2. Test non-admin authenticated (should NOT access admin functions)**
**3. Test admin access (should work normally)**
**4. Test quote submission validation (when implemented)**

---

## MISSING INFORMATION REQUIRING YOUR INPUT

### Question 1: Admin Email Addresses

**Required:** List of email addresses that should have admin access

**Example:**
- admin@mivo.in
- owner@mivo.in
- (any others?)

**Used For:** Seeding `admin_users` table

---

### Question 2: Future Order Persistence

**Question:** Will orders eventually persist to database?

**Current State:** WhatsApp only (no database)  
**MVP Plan:** Indicates future order persistence with configuration snapshots

**If YES:**
- Need customer-scoped policies (users see only their orders)
- Need admin override (admins see all orders)

**If NO:**
- Can remove order table policies entirely
- Keep tables for data warehouse/analytics only

---

### Question 3: Quote Submission Implementation

**Question:** Should quote submission work (currently TODO)?

**If YES:**
- Need public INSERT policy with validation
- Need server-side rate limiting (RLS alone cannot rate limit)
- Need email validation

**If NO:**
- Can remove public_insert_quotes policy
- Feature disabled until implementation ready

---

### Question 4: Current Admin User Emails

**Required:** SQL query to check existing users in auth.users

**Query Needed:**
```sql
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at;
```

**Purpose:** Identify which user(s) should be seeded as admin

---

## PREFLIGHT QUERIES (Read-Only)

Run these queries to gather required information:

```sql
-- Query 1: List all existing authenticated users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at;

-- Query 2: Check if admin_users table already exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'admin_users'
);

-- Query 3: Verify current policy names match documented
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- Query 4: Check for any existing functions named is_admin
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'is_admin';

-- Query 5: Confirm orders/order_items are empty (unused)
SELECT 
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;
```

---

## NEXT STEPS

**Before I can provide the final migration SQL, I need:**

1. ✅ List of admin email addresses (for seeding)
2. ✅ Results of preflight queries (to verify assumptions)
3. ✅ Decision: Should orders persist to database? (Yes/No)
4. ✅ Decision: Should quote submission work? (Yes/No)

**Once provided, I will deliver:**
- Complete migration SQL file
- Verification queries
- Rollback procedure
- Testing checklist

---

## ROLLBACK CONSIDERATIONS

**Important:** Rollback should NOT restore unsafe policies.

**Rollback Strategy:**
1. If migration fails → Fix forward (don't restore `USING (true)`)
2. If admin access broken → Add emergency admin via service role
3. If public access broken → Verify/fix public SELECT policies only

**Safe Rollback:** Restore public read access only, keep admin restrictions in place.

---

## CONCLUSION

**Current State:** CRITICAL security vulnerabilities

**Recommended Action:** Implement admin table + restrictive policies

**Timeline:**
- Gather information: 10 minutes
- Review/approve migration: 30 minutes
- Test on staging: 1 hour
- Deploy to production: 30 minutes
- Verify: 30 minutes

**Total:** ~3 hours for complete remediation

---

**Status:** ⏳ **AWAITING YOUR INPUT**

**Required:**
1. Admin email addresses
2. Preflight query results
3. Order persistence decision
4. Quote submission decision

Once provided, I will prepare the final migration SQL.

---

**Report Date:** 2026-10-15  
**Reviewed By:** Claude Code  
**Severity:** 🔴 CRITICAL  
**Priority:** P0 (Immediate)
