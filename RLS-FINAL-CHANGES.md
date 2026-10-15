

# RLS Migration Final Version - Complete Changes

**File:** `rls-migration-final.sql`  
**Date:** 2026-10-15  
**Status:** ⚠️ NOT APPROVED FOR EXECUTION - Awaiting review

---

## CHANGES FROM PREVIOUS VERSION (rls-migration-secure.sql)

### 1. Column-Level Restrictions for Quote Submissions

**Previous (UNSAFE):**
```sql
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);  -- ❌ Allows setting ANY column
```

**New (SECURE):**
```sql
CREATE POLICY "public_insert_quotes" ON custom_quotes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Require customer name
    customer_name IS NOT NULL
    AND LENGTH(TRIM(customer_name)) > 0
    AND LENGTH(customer_name) <= 200

    -- Require contact method with email validation
    AND (
      (email IS NOT NULL AND LENGTH(TRIM(email)) > 0 
       AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      OR (phone IS NOT NULL AND LENGTH(TRIM(phone)) > 0)
    )

    -- Require project description
    AND project_description IS NOT NULL
    AND LENGTH(TRIM(project_description)) > 0
    AND LENGTH(project_description) <= 5000

    -- ✅ PREVENT setting admin-only fields
    AND product_id IS NULL
    AND custom_dimensions IS NULL
    AND feasibility_assessment IS NULL
    AND quote_response IS NULL

    -- ✅ FORCE status to 'submitted'
    AND (status IS NULL OR status = 'submitted')
  );
```

**Why:** Prevents users from:
- Setting status to 'quoted' (admin privilege)
- Setting feasibility_assessment (admin analysis)
- Setting quote_response (admin pricing)
- Setting product_id (admin linkage)
- Submitting invalid/malicious data

**Admin-Only Fields (from migration 003):**
- `product_id` - Links quote to product
- `custom_dimensions` - Structured dimensions JSONB
- `feasibility_assessment` - Admin feasibility analysis
- `quote_response` - Admin quote pricing/response
- `status` - Workflow status (only admin can advance from 'submitted')

**Customer-Editable Fields:**
- `customer_name`, `email`, `phone` (contact info)
- `project_description`, `application` (project details)
- `quantity`, `dimensions`, `material`, `deadline` (requirements)
- `attachments` (file uploads)

---

### 2. Added FORCE ROW LEVEL SECURITY on admin_users

**Previous:**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
```

**New:**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;  -- ✅ Added
```

**Why:** 
- `ENABLE ROW LEVEL SECURITY` applies RLS to non-owner roles
- Table owner (postgres/service_role in Supabase) bypasses RLS by default
- `FORCE ROW LEVEL SECURITY` applies RLS even to table owner
- Prevents accidental admin_users query without explicit service_role context

**Security Impact:** Even table owner must explicitly use service_role privileges to modify admin_users

---

### 3. Explicit REVOKE from anon Role

**Previous:**
```sql
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

**New:**
```sql
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;  -- ✅ Explicit
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

**Why:**
- `PUBLIC` in PostgreSQL may not include `anon` in Supabase's role hierarchy
- Explicit `REVOKE` from `anon` ensures anonymous users cannot call function
- Defense in depth - prevents any edge cases

---

### 4. Enhanced Preflight Verification (8 Queries)

**Added Queries:**

**Preflight 1 - List ALL auth users:**
- Shows all accounts with metadata
- Used to identify actual admin email
- Prevents guessing admin email

**Preflight 4 - Verify custom_quotes schema:**
- Lists all columns and types
- Documents customer-editable vs admin-only fields
- Ensures column-level policy matches actual schema

**Preflight 5 - Verify product_variants schema:**
- Confirms no sensitive columns exist
- Validates public read policy is safe

**Preflight 8 - Test auth.uid() and auth.jwt():**
- Verifies Supabase auth functions are available
- Tests current session context

**Why:** Previous version assumed schema structure. New version verifies actual schema to prevent mismatched policies.

---

### 5. Comprehensive Security Verification Before COMMIT

**Added Checks:**

```sql
-- Verify no permissive USING(true) for authenticated UPDATE/DELETE
SELECT COUNT(*) INTO permissive_auth_true_count
FROM pg_policies
WHERE permissive = 'PERMISSIVE'
  AND 'authenticated' = ANY(roles)
  AND qual = 'true'::text
  AND cmd NOT IN ('SELECT', 'INSERT');  -- ✅ Exclude public read/insert

IF permissive_auth_true_count > 0 THEN
  RAISE EXCEPTION 'VERIFICATION FAILED: Found % permissive USING(true) policies for authenticated on UPDATE/DELETE';
END IF;
```

**Why:** 
- Catches any remaining overly-permissive policies
- Previous version only checked policy names
- New version checks actual policy semantics
- Accounts for permissive vs restrictive policy behavior

---

### 6. Enhanced Postflight Verification (12 Queries)

**Previous:** 8 postflight queries  
**New:** 12 postflight queries

**Added:**

**Postflight 3 - Verify function permissions:**
- Confirms only `authenticated` role has EXECUTE
- Verifies `anon` does NOT have EXECUTE

**Postflight 9 - Verify no permissive USING(true):**
- Lists all permissive policies with USING(true)
- Confirms only public SELECT/INSERT policies use it
- Detects dangerous UPDATE/DELETE policies

**Postflight 11 - Verify table grants unchanged:**
- Compares grants before/after migration
- Ensures migration didn't accidentally alter grants

**Why:** Previous version relied on policy names. New version verifies actual policy behavior and function permissions.

---

### 7. PLACEHOLDER_EMAIL Enforcement

**Previous:**
```sql
WHERE email = 'admin@mivo.in' -- ← ⚠️ CHANGE THIS
```

**New:**
```sql
WHERE email = 'PLACEHOLDER_EMAIL'  -- ← ⚠️ REPLACE WITH ACTUAL EMAIL
```

**Why:**
- Previous email (`admin@mivo.in`) might accidentally match a real account
- `PLACEHOLDER_EMAIL` is clearly invalid - forces conscious replacement
- Prevents accidental execution without proper configuration
- Migration will always fail if not updated (no silent wrong admin)

---

### 8. Unverifiable Facts Section

**Added comprehensive documentation of facts that cannot be verified from code:**

1. Actual admin email address - must come from Preflight 1
2. Supabase default table grants - documented via Preflight 6
3. Quote submission implementation status - feature has TODO in code
4. Product variants usage - schema exists but no app queries found
5. Service role key accessibility - client code inspected, appears safe

**Why:** Distinguishes between verified facts and assumptions requiring external validation

---

### 9. Manual Testing Plan

**Added structured test plan for three user types:**

**Test 1 - Anonymous User:**
- Browse explore page
- View product details
- Try admin access (should fail)
- Submit quote

**Test 2 - Non-Admin Authenticated:**
- Sign in with non-admin account
- Browse products (should work)
- Try admin operations (should fail with RLS error)

**Test 3 - Admin User:**
- Sign in with admin account
- Access admin dashboard
- Create/edit products
- View quotes

**Test 4 - Column Restriction Test:**
- Attempt to submit quote with admin-only fields
- Verify fields are rejected or ignored

**Why:** Previous version had informal testing guidance. New version provides step-by-step test protocol.

---

### 10. Improved Comments and Documentation

**Added:**
- Policy-level comments explaining column restrictions
- Step-by-step inline documentation
- Expected results for every verification query
- Detailed rollback procedures with code examples

---

## SCHEMA INSPECTION FINDINGS

### custom_quotes Table Schema (Verified)

**Base Schema (supabase-schema.sql):**
```sql
id UUID PRIMARY KEY
customer_name TEXT NOT NULL
email TEXT NOT NULL
phone TEXT
project_description TEXT NOT NULL
application TEXT
quantity INTEGER
dimensions TEXT
material TEXT
deadline TEXT
attachments TEXT[]
status TEXT NOT NULL DEFAULT 'submitted'
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**Additional Columns (migration 003):**
```sql
product_id UUID REFERENCES products(id) ON DELETE SET NULL
custom_dimensions JSONB
feasibility_assessment JSONB
quote_response JSONB
```

**Status Constraint (migration 003):**
```sql
CHECK (status IN ('submitted', 'reviewing', 'quoted', 'accepted', 'declined', 'converted', 'cancelled'))
```

**Column Classification:**
- **Customer-Editable:** All base schema fields except `status`, `id`, `created_at`, `updated_at`
- **Admin-Only:** `product_id`, `custom_dimensions`, `feasibility_assessment`, `quote_response`, status transitions

---

### product_variants Table Schema (Verified)

```sql
id UUID PRIMARY KEY
product_id UUID REFERENCES products(id) ON DELETE CASCADE
name TEXT NOT NULL
price DECIMAL(10, 2)
attributes JSONB NOT NULL
sku TEXT
in_stock BOOLEAN DEFAULT true
created_at TIMESTAMPTZ
```

**Assessment:** No sensitive columns - all fields safe for public read

**Current Usage:** No queries found in application code, but schema exists and original schema has public read policy

**Decision:** Preserve public read access (`USING (true)`) - variants are product metadata

---

### Application Code Findings

**Quote Submission (app/custom/page.tsx):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // TODO: Implement actual form submission to Supabase
  await new Promise((resolve) => setTimeout(resolve, 1500));
  alert('Quote request submitted!');
};
```
**Status:** Not implemented - TODO placeholder

**Quote Display (app/admin/quotes/page.tsx):**
```typescript
const { data: quotes } = await supabase
  .from('custom_quotes')
  .select('*')  // ✅ Admin queries all columns
  .order('created_at', { ascending: false })
```
**Status:** Admin queries SELECT all columns (requires admin RLS policy)

**Product Display (app/explore/page.tsx):**
```typescript
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('published', true)  // ✅ Public queries published only
```
**Status:** Confirms public read policy requirement (`published = true`)

**Product Detail (app/product/[id]/page.tsx):**
```typescript
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('id', id)
  .eq('published', true)  // ✅ Public queries published only
```
**Status:** Confirms public read policy requirement

---

## SECURITY DECISIONS EXPLAINED

### Decision 1: Column-Level INSERT Restrictions

**Problem:** `WITH CHECK (true)` allows users to set ANY column during INSERT

**Attack Scenario:**
```sql
-- Attacker submits quote via public form
INSERT INTO custom_quotes (
  customer_name,
  email,
  project_description,
  status,                    -- ❌ Set to 'quoted' (should be 'submitted')
  quote_response,            -- ❌ Set fake pricing
  feasibility_assessment     -- ❌ Set fake approval
) VALUES (
  'Attacker',
  'attacker@evil.com',
  'Malicious quote',
  'quoted',                  -- Bypass review workflow
  '{"quoted_price": 1}',     -- Claim ₹1 pricing
  '{"can_print": true}'      -- Fake feasibility
);
```

**Solution:** Policy explicitly validates each field and blocks admin-only columns

**Trade-off:** More complex policy, but necessary for security. Alternative would be application-layer validation only, but RLS provides defense-in-depth.

---

### Decision 2: FORCE ROW LEVEL SECURITY

**Problem:** Table owner (postgres/service_role) bypasses RLS by default

**Risk Scenario:**
- Developer writes admin query
- Forgets to use service_role context explicitly
- Query accidentally uses postgres role
- Bypasses RLS, returns all data

**Solution:** `FORCE ROW LEVEL SECURITY` applies RLS even to owner

**Trade-off:** Must explicitly use service_role context for legitimate admin additions. Benefit: Prevents accidental RLS bypass.

---

### Decision 3: Public Variants Read Access

**Alternative Considered:** Restrict variants to admins only

**Why NOT Chosen:**
- Schema has no sensitive columns
- Variants are product metadata (name, price, attributes)
- No customer PII, no business-sensitive data
- Application may use variants in future (prepared for expansion)

**Decision:** Keep `USING (true)` for public read

**If Variants HAD Sensitive Columns:**
Would create view with only public columns:
```sql
CREATE VIEW public_variants AS
SELECT id, product_id, name, price, attributes, in_stock
FROM product_variants;

-- Then grant access to view, not table
```

---

### Decision 4: Email Validation in RLS Policy

**Validation Added:**
```sql
email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
```

**Why in RLS Policy:**
- Defense-in-depth (application may have bug)
- Prevents database pollution with invalid emails
- Small performance cost, but quotes are low-volume

**Why NOT More Complex:**
- Basic validation only (RFC 5322 full compliance is too complex for RLS)
- Application layer should do thorough validation
- RLS is backup/enforcement layer

---

### Decision 5: Placeholder Email Enforcement

**Why NOT Use Actual Email:**
- Cannot determine actual admin email from code
- Varies by deployment (dev vs staging vs production)
- Forces conscious decision during deployment

**Why NOT Use NULL:**
- SQL query would fail (email = NULL is always false)
- Silent failure worse than explicit error

**Why NOT Use Empty String:**
- Might match accidentally if email validation is weak

**Best Practice:** Use obviously invalid string that forces replacement

---

## LIMITATIONS AND CAVEATS

### Limitation 1: RLS Cannot Enforce Rate Limiting

**Current Policy:**
```sql
CREATE POLICY "public_insert_quotes" ... WITH CHECK (...);
```

**What It CANNOT Do:**
- Prevent user from submitting 1000 quotes per second
- Block IP-based abuse
- Detect bot submissions

**Mitigation Required:**
- Application-level rate limiting (Vercel Rate Limiting, Upstash, etc.)
- CAPTCHA on quote form (Cloudflare Turnstile, reCAPTCHA)
- Supabase Edge Functions with rate limit middleware

**Why Not in RLS:** RLS policies are stateless (no request counting)

---

### Limitation 2: Client-Side Admin Route Protection

**Current Code (app/admin/page.tsx):**
```typescript
if (!user) {
  redirect('/admin/login');
}
// ❌ No check if user is admin
```

**What This Means:**
- Non-admin can access `/admin` routes
- RLS blocks data access (queries return empty/error)
- But route and UI load

**User Experience:**
- Non-admin sees empty dashboard
- Console shows RLS policy violation errors

**Recommended Fix:**
```typescript
const { data: isAdmin } = await supabase.rpc('is_admin').single();
if (!isAdmin) {
  redirect('/');
}
```

**Why Not in Migration:** Migration is database-layer only. Application changes are separate.

---

### Limitation 3: Quote Submission Not Implemented

**Current Status:** Feature has TODO in code

**Impact of Policy:**
- Policy is ready and secure
- No application code to test against
- Cannot verify column restrictions work in practice

**Recommendation:** When implementing quote submission:
1. Test with malicious payloads (try to set admin-only fields)
2. Verify policy rejects invalid data
3. Add application-layer validation as first line of defense

---

### Limitation 4: No Audit Logging

**Current State:** No tracking of admin actions

**Risk:**
- Cannot determine who modified products
- Cannot investigate unauthorized changes
- No compliance audit trail

**Recommended Addition:**
```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER audit_products_changes
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_admin_action();
```

**Why Not in Migration:** Additional feature, not security remediation. Can be added later.

---

## FACTS REQUIRING EXTERNAL VERIFICATION

### Cannot Be Verified From Code

1. **Actual admin email address**
   - Must be obtained from Preflight 1 query
   - Or from environment configuration
   - Or from user/customer communication

2. **Supabase default table grants**
   - Assumed: `authenticated` has SELECT, INSERT, UPDATE, DELETE
   - Verification: Preflight 6 documents actual grants
   - Impact: If grants missing, policies won't help

3. **Service role key exposure**
   - Inspected: client.ts and server.ts use anon key (safe)
   - Cannot verify: Environment files, deployment config
   - Verification: Check .env, Vercel environment variables

4. **Quote submission implementation timeline**
   - Code has TODO
   - Policy is ready
   - Cannot verify when feature will be built

5. **Product variants usage**
   - Schema exists
   - No application queries found
   - May be used in admin interface or future feature

---

## PRE-EXECUTION CHECKLIST

Before approving this migration for execution:

- [ ] **Run all 8 preflight queries** and document results
- [ ] **Identify actual admin email** from Preflight 1
- [ ] **Replace PLACEHOLDER_EMAIL** in Step 5 with actual admin email
- [ ] **Verify email matches** an existing auth.users record
- [ ] **Create database backup** via Supabase Dashboard
- [ ] **Review all policy definitions** for business requirements
- [ ] **Verify column classifications** match actual schema (Preflight 4-5)
- [ ] **Confirm quote submission fields** match application requirements
- [ ] **Review unverifiable facts** and document assumptions
- [ ] **Prepare rollback procedure** (do NOT restore unsafe policies)
- [ ] **Schedule monitoring** for 24-48 hours post-migration
- [ ] **Prepare manual test plan** for all three user types
- [ ] **Ensure service role key access** for emergency admin additions

---

## POST-EXECUTION REQUIREMENTS

After migration completes:

- [ ] **Run all 12 postflight queries** immediately
- [ ] **Verify all postflight checks pass** (no skipped verifications)
- [ ] **Test as anonymous user** (public access)
- [ ] **Test as non-admin authenticated** (RLS blocks admin operations)
- [ ] **Test as admin user** (full access)
- [ ] **Test quote submission** (when implemented) with malicious payloads
- [ ] **Monitor Supabase logs** for RLS policy violations
- [ ] **Monitor application logs** for permission errors
- [ ] **Document any unexpected behavior**
- [ ] **Update admin_users table** (add additional admins if needed)

---

## APPROVAL STATUS

**This migration is NOT approved for execution.**

**Reasons:**
1. Admin email must be identified and configured
2. Preflight queries must be run and results reviewed
3. Business requirements must be confirmed (quote fields, variant access)
4. Manual test plan must be executed post-migration
5. Monitoring plan must be in place

**To Approve:**
- Complete pre-execution checklist
- Review this document in full
- Verify all security decisions align with business requirements
- Confirm rollback procedure understood
- Explicitly approve execution in writing

**Do not execute until approved.**

---

**Document Version:** 1.0  
**Last Updated:** 2026-10-15  
**Migration File:** rls-migration-final.sql  
**Status:** ⚠️ Awaiting Approval
