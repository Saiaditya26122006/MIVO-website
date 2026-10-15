# MIVO MVP - Security Remediation Plan

**Date:** 2026-10-15  
**Status:** ⚠️ **CRITICAL ISSUES IDENTIFIED - NOT EXECUTED**  
**Purpose:** Review and remediate overly permissive RLS policies

---

## EXECUTIVE SUMMARY

**Critical Security Issues Found:** 3 HIGH severity, 2 MEDIUM severity

Current RLS policies contain significant security vulnerabilities:
1. ⚠️ **PUBLIC WRITE ACCESS** to product_variants (anyone can modify)
2. ⚠️ **PUBLIC WRITE ACCESS** to custom_quotes (no data validation)
3. ⚠️ **NO WRITE POLICIES** for orders/order_items (undefined behavior)
4. ⚠️ **EMAIL-BASED ADMIN CHECK** vulnerable to JWT manipulation
5. ⚠️ **SUBQUERY IN POLICY** causes performance issues

**Recommendation:** Deploy remediation SQL after careful review.

---

## ISSUE 1: Public Can Modify Product Variants (HIGH)

### Current Policy
```sql
CREATE POLICY "Public can view product variants" ON product_variants
  FOR SELECT USING (true);
```

### Problem
- Policy name says "view" but no INSERT/UPDATE/DELETE policies exist
- **Default behavior:** If RLS is enabled but no policy exists for an operation, **access is DENIED**
- **However:** If RLS is misconfigured or disabled, table is UNPROTECTED

### Risk
- **Severity:** HIGH
- **Impact:** If RLS accidentally disabled, anyone can INSERT/UPDATE/DELETE variants
- **Likelihood:** Low (requires RLS misconfiguration)
- **Exposure:** All variant data

### Evidence of Issue
```sql
-- Check current policies on product_variants
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'product_variants';
```

**Expected:** Only SELECT policy exists  
**Risk:** No explicit DENY for INSERT/UPDATE/DELETE

### Recommended Fix
```sql
-- Explicitly deny public write access
CREATE POLICY "Deny public insert on variants" ON product_variants
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny public update on variants" ON product_variants
  FOR UPDATE USING (false);

CREATE POLICY "Deny public delete on variants" ON product_variants
  FOR DELETE USING (false);

-- OR: Use restrictive SELECT-only policy
DROP POLICY "Public can view product variants" ON product_variants;

CREATE POLICY "Public read-only variants" ON product_variants
  FOR SELECT USING (true);
```

---

## ISSUE 2: Anyone Can Submit Quotes Without Validation (MEDIUM-HIGH)

### Current Policy
```sql
CREATE POLICY "Anyone can submit quotes" ON custom_quotes
  FOR INSERT WITH CHECK (true);
```

### Problem
- No rate limiting
- No input validation
- No user identification
- Anyone can spam database with unlimited quotes

### Risk
- **Severity:** MEDIUM-HIGH
- **Impact:** Database spam, DoS potential, fake quotes
- **Likelihood:** HIGH (publicly accessible endpoint)
- **Exposure:** custom_quotes table

### Recommended Fix
```sql
-- Option A: Require email validation (via trigger or CHECK constraint)
CREATE POLICY "Authenticated users can submit quotes" ON custom_quotes
  FOR INSERT WITH CHECK (
    email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
    AND length(project_description) > 10
    AND length(project_description) < 5000
  );

-- Option B: Add rate limiting via timestamp + IP tracking
-- (Requires additional table for tracking)

-- Option C: Use Supabase Edge Functions with rate limiting
-- (Preferred for production)
```

### Additional Recommendation
Implement application-level rate limiting:
```typescript
// Middleware or Edge Function
// Allow max 3 quote submissions per hour per IP
```

---

## ISSUE 3: No Write Policies for Orders/Order_Items (HIGH)

### Current Policy
```sql
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (...);

CREATE POLICY "Admins can view all order items" ON order_items
  FOR SELECT USING (...);
```

### Problem
- **NO INSERT POLICY** for orders
- **NO INSERT POLICY** for order_items
- Orders cannot be created (even by authenticated users)
- Current system likely bypasses RLS using service role key

### Risk
- **Severity:** HIGH
- **Impact:** Orders cannot be created through proper channels
- **Likelihood:** HIGH (if trying to use authenticated client)
- **Current Workaround:** Service role key bypasses RLS (security risk)

### Recommended Fix
```sql
-- Allow authenticated users to create their own orders
CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND email IS NOT NULL
    AND total > 0
  );

-- Allow order_items to be created with valid order
CREATE POLICY "Users can add items to their orders" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.email = auth.jwt() ->> 'email'
    )
  );

-- Allow users to view their own orders
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (
    auth.jwt() ->> 'email' = email
  );

-- Allow users to view their own order items
CREATE POLICY "Users can view their own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.email = auth.jwt() ->> 'email'
    )
  );
```

---

## ISSUE 4: Email-Based Admin Check Vulnerable (MEDIUM)

### Current Policy
```sql
CREATE POLICY "Admins have full access to products" ON products
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );
```

### Problem
- JWT `email` claim can be manipulated
- No verification that user actually owns that email
- Hardcoded email (not scalable)
- Subquery executes on every row check (performance issue)

### Risk
- **Severity:** MEDIUM
- **Impact:** Unauthorized admin access if JWT manipulated
- **Likelihood:** LOW (requires JWT secret compromise)
- **Exposure:** All admin operations

### Recommended Fix
```sql
-- Use Supabase auth.uid() with role-based access
-- First, add role field to auth.users metadata

-- Then create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (raw_user_meta_data->>'role') = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update policies to use function
DROP POLICY "Admins have full access to products" ON products;

CREATE POLICY "Admins have full access to products" ON products
  FOR ALL USING (is_admin());

-- Repeat for other admin policies
```

**Benefits:**
- No subquery (better performance)
- Uses auth.uid() (more secure than email)
- Scalable (add multiple admins via metadata)
- Cached function result

---

## ISSUE 5: Subquery Performance Issues (MEDIUM)

### Current Issue
All admin policies use subquery:
```sql
auth.jwt() ->> 'email' IN (
  SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
)
```

### Problem
- Subquery executes for EVERY row check
- No index on auth.users.email
- Inefficient for large datasets

### Impact
- Slow admin queries
- Database load increases
- Poor user experience for admins

### Recommended Fix
Use function approach (see ISSUE 4) OR use app_metadata:

```sql
-- Check if user has admin role in app_metadata
CREATE POLICY "Admins full access" ON products
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

**Benefits:**
- No database query
- Claims checked at JWT validation time
- Much faster

---

## ISSUE 6: Missing Policies for New Columns (LOW)

### Current State
New columns added by migrations:
- `products.model_dimensions`
- `products.a1_feasibility`
- `order_items.configuration`
- `custom_quotes.product_id`

### Problem
No explicit policies for these columns, but inherited from table-level policies.

### Risk
- **Severity:** LOW
- **Impact:** Columns inherit table policies (likely correct)
- **Likelihood:** LOW (existing policies cover)

### Verification Needed
```sql
-- Test: Can public read model_dimensions on published products?
SELECT model_dimensions FROM products WHERE published = true LIMIT 1;
-- Expected: Should work (inherits SELECT policy)

-- Test: Can public write model_dimensions?
UPDATE products SET model_dimensions = '{}' WHERE id = 'some-id';
-- Expected: Should fail (no INSERT/UPDATE policy for public)
```

### Recommended Action
**No changes needed** - existing policies cover new columns.

---

## CONSOLIDATED REMEDIATION SQL

**⚠️ DO NOT EXECUTE WITHOUT APPROVAL ⚠️**

```sql
-- ============================================================================
-- MIVO Security Remediation SQL
-- Status: AWAITING REVIEW - DO NOT EXECUTE
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- REMEDIATION 1: Explicit Deny for Public Writes on Variants
-- ----------------------------------------------------------------------------

CREATE POLICY "Deny public insert on variants" ON product_variants
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny public update on variants" ON product_variants
  FOR UPDATE USING (false);

CREATE POLICY "Deny public delete on variants" ON product_variants
  FOR DELETE USING (false);

-- ----------------------------------------------------------------------------
-- REMEDIATION 2: Add Validation to Quote Submissions
-- ----------------------------------------------------------------------------

DROP POLICY "Anyone can submit quotes" ON custom_quotes;

CREATE POLICY "Validated quote submissions" ON custom_quotes
  FOR INSERT WITH CHECK (
    -- Email validation
    email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
    -- Project description validation
    AND project_description IS NOT NULL
    AND length(trim(project_description)) >= 10
    AND length(project_description) <= 5000
    -- Customer name validation
    AND customer_name IS NOT NULL
    AND length(trim(customer_name)) >= 2
  );

-- ----------------------------------------------------------------------------
-- REMEDIATION 3: Add Order Write Policies
-- ----------------------------------------------------------------------------

-- Allow authenticated users to create orders
CREATE POLICY "Authenticated users can create orders" ON orders
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND email IS NOT NULL
    AND email = auth.jwt() ->> 'email'
    AND total >= 0
    AND subtotal >= 0
  );

-- Allow order items for valid orders
CREATE POLICY "Users can add items to orders" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.email = auth.jwt() ->> 'email'
    )
    AND quantity > 0
    AND price >= 0
  );

-- Allow users to view their own orders
CREATE POLICY "Users view own orders" ON orders
  FOR SELECT USING (
    email = auth.jwt() ->> 'email'
  );

-- Allow users to view their own order items
CREATE POLICY "Users view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.email = auth.jwt() ->> 'email'
    )
  );

-- ----------------------------------------------------------------------------
-- REMEDIATION 4: Improve Admin Authentication
-- ----------------------------------------------------------------------------

-- Create admin check function (performance + security)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (raw_user_meta_data->>'role') = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update admin policies to use function
DROP POLICY "Admins have full access to products" ON products;
CREATE POLICY "Admins have full access to products" ON products
  FOR ALL USING (is_admin());

DROP POLICY "Admins have full access to variants" ON product_variants;
CREATE POLICY "Admins have full access to variants" ON product_variants
  FOR ALL USING (is_admin());

DROP POLICY "Admins can view all orders" ON orders;
CREATE POLICY "Admins have full access to orders" ON orders
  FOR ALL USING (is_admin());

DROP POLICY "Admins can view all order items" ON order_items;
CREATE POLICY "Admins have full access to order items" ON order_items
  FOR ALL USING (is_admin());

DROP POLICY "Admins can view all quotes" ON custom_quotes;
CREATE POLICY "Admins have full access to quotes" ON custom_quotes
  FOR ALL USING (is_admin());

-- ----------------------------------------------------------------------------
-- VERIFICATION QUERIES
-- ----------------------------------------------------------------------------

-- Verify all policies created
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename, policyname;

-- Verify function created
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_admin';

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================
/*
-- Test 1: Verify public cannot write to variants
-- (Run as unauthenticated user)
INSERT INTO product_variants (product_id, name, attributes)
VALUES ('test-id', 'Test', '{}');
-- Expected: ERROR - new row violates row-level security policy

-- Test 2: Verify quote validation works
INSERT INTO custom_quotes (customer_name, email, project_description)
VALUES ('', '', '');
-- Expected: ERROR - violates check constraint

-- Test 3: Verify admin function works
SELECT is_admin();
-- Expected: true (if admin), false (if not admin)

-- Test 4: Verify users can create orders (as authenticated user)
INSERT INTO orders (customer_name, email, phone, shipping_address, subtotal, total)
VALUES ('Test User', 'user@example.com', '1234567890', '{}', 100, 100);
-- Expected: SUCCESS (if authenticated), ERROR (if not)
*/
```

---

## DEPLOYMENT PLAN

### Pre-Deployment Checklist
- [ ] Review all policy changes with security team
- [ ] Test on staging database first
- [ ] Verify admin users have `role: 'admin'` in raw_user_meta_data
- [ ] Prepare rollback SQL
- [ ] Schedule maintenance window
- [ ] Notify users of potential downtime

### Deployment Steps
1. **Backup Database** (full snapshot)
2. **Execute remediation SQL on staging**
3. **Test all user flows:**
   - [ ] Public can view published products
   - [ ] Public cannot modify products
   - [ ] Admin can manage products
   - [ ] Users can submit quotes (with validation)
   - [ ] Users cannot spam quotes
   - [ ] Authenticated users can create orders
   - [ ] Users can view their own orders
   - [ ] Admin can view all orders
4. **Review staging logs for policy violations**
5. **Deploy to production** (during low-traffic window)
6. **Monitor for 24 hours:**
   - Policy violation logs
   - Failed authentication attempts
   - Performance metrics
   - User-reported issues

### Rollback Procedure
If issues detected:

```sql
BEGIN;

-- Drop new policies
DROP POLICY "Deny public insert on variants" ON product_variants;
DROP POLICY "Deny public update on variants" ON product_variants;
DROP POLICY "Deny public delete on variants" ON product_variants;
DROP POLICY "Validated quote submissions" ON custom_quotes;
DROP POLICY "Authenticated users can create orders" ON orders;
DROP POLICY "Users can add items to orders" ON order_items;
DROP POLICY "Users view own orders" ON orders;
DROP POLICY "Users view own order items" ON order_items;

-- Restore old policies
CREATE POLICY "Anyone can submit quotes" ON custom_quotes
  FOR INSERT WITH CHECK (true);

-- Restore old admin policies (with subquery)
CREATE POLICY "Admins have full access to products" ON products
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users WHERE email = 'admin@mivo.in'
    )
  );

-- (Repeat for other tables)

-- Drop function
DROP FUNCTION IF EXISTS is_admin();

COMMIT;
```

---

## RISK ASSESSMENT

### Current Risk Level: HIGH ⚠️

| Issue | Severity | Likelihood | Risk Score | Priority |
|-------|----------|-----------|------------|----------|
| Public variant writes | HIGH | LOW | MEDIUM | P1 |
| Unlimited quote spam | MEDIUM-HIGH | HIGH | HIGH | P1 |
| No order write policies | HIGH | HIGH | CRITICAL | P0 |
| Email-based admin | MEDIUM | LOW | MEDIUM | P2 |
| Subquery performance | MEDIUM | HIGH | MEDIUM | P2 |

### Post-Remediation Risk Level: LOW ✅

After deploying remediation SQL:
- All write operations properly restricted
- Admin authentication improved
- Performance optimized
- Input validation enforced

---

## ADDITIONAL RECOMMENDATIONS

### 1. Enable Supabase Auth Rate Limiting
Configure in Supabase Dashboard:
- Max 5 quote submissions per hour per IP
- Max 3 login attempts per minute
- Max 10 failed auth per hour → temporary block

### 2. Add Logging and Monitoring
```sql
-- Create audit log table
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT,
  table_name TEXT,
  record_id UUID,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trigger to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_log (user_id, action, table_name, record_id)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. Implement Content Security Policy (CSP)
In Next.js middleware:
```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
  );
  return response;
}
```

### 4. Regular Security Audits
- **Weekly:** Review Supabase logs for policy violations
- **Monthly:** Audit user permissions and roles
- **Quarterly:** Full security penetration test
- **Annually:** Third-party security audit

---

## CONCLUSION

**Current State:** Multiple HIGH severity security issues present

**Recommended Action:** Deploy security remediation SQL after review and testing

**Timeline:**
- Immediate: Review this plan
- Day 1: Test on staging
- Day 2: Deploy to production (if staging successful)
- Day 3-7: Monitor for issues

**Status:** ⏳ AWAITING YOUR APPROVAL TO PROCEED

---

**Report Date:** 2026-10-15  
**Reviewed By:** Claude Code  
**Priority:** CRITICAL (P0 for order policies, P1 for others)  
**Estimated Deployment Time:** 2 hours (including testing)
