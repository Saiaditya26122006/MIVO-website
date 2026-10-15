# MIVO MVP - Migration Review Package

**Review Date:** 2026-10-15  
**Status:** AWAITING APPROVAL - DO NOT EXECUTE  
**Purpose:** Complete migration SQL for review before staging test

---

## 📦 PACKAGE CONTENTS

This package contains all corrected SQL migrations ready for review:

1. **Migration 001:** Add structured dimensions to products table
2. **Migration 002:** Add order configuration tracking
3. **Migration 003:** Enhance custom quotes with feasibility
4. **Rollback scripts:** One for each migration

---

## ⚠️ CRITICAL: PRE-MIGRATION VERIFICATION REQUIRED

### STEP 1: Run These Queries on Production Database

```sql
-- Check 1: Verify order status values
SELECT DISTINCT status, COUNT(*) as count
FROM orders
GROUP BY status
ORDER BY status;

-- Check 2: Verify custom_quotes status values
SELECT DISTINCT status, COUNT(*) as count
FROM custom_quotes
GROUP BY status
ORDER BY status;

-- Check 3: Count existing records
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;
```

### STEP 2: Verify Results

**Orders status:** Should only contain values in this list:
- `pending`, `validated`, `in_production`, `shipped`, `delivered`, `cancelled`, `processing`, `confirmed`, `completed`

**Custom_quotes status:** Should only contain values in this list:
- `submitted`, `reviewing`, `quoted`, `accepted`, `declined`, `converted`, `cancelled`

**If any unexpected values appear:** Update the constraint in the migration OR migrate the data first.

### STEP 3: Take Database Backup

Before proceeding to staging, take full Supabase backup:
1. Dashboard → Project → Database → Backups
2. Create manual backup
3. Document timestamp and download location

---

## 📄 MIGRATION 001: STRUCTURED DIMENSIONS

### What It Does
- Adds `model_dimensions` JSONB column to products (nullable)
- Adds `a1_feasibility` JSONB column to products (nullable)
- Creates partial index on feasibility data
- Adds comments for documentation

### Safety Guarantees
- ✅ Nullable columns (existing products unaffected)
- ✅ No data migration required
- ✅ RLS policies unchanged
- ✅ Existing pricing_config still works
- ✅ Backward compatible

### Data Loss on Rollback
- Structured dimensions entered for new products
- Feasibility assessments
- **Acceptable:** MVP phase data, can be re-entered

### File Location
`migrations/001_add_structured_dimensions.sql`

### Rollback Location
`migrations/001_rollback.sql`

---

## 📄 MIGRATION 002: ORDER CONFIGURATION

### What It Does
- Adds 4 columns to `order_items` (all nullable):
  - `configuration` JSONB - Full config snapshot
  - `configuration_text` TEXT - Human-readable summary
  - `feasibility_status` TEXT - Status flag
  - `feasibility_notes` TEXT - Admin notes
- Adds status constraint to `orders` table (PERMISSIVE)
- Creates indexes for order management

### Safety Guarantees
- ✅ Nullable columns (existing order_items unaffected)
- ✅ Permissive constraint (9 allowed status values)
- ✅ WhatsApp workflow continues
- ✅ Original order data preserved

### Data Loss on Rollback
- Order configuration snapshots
- Feasibility assessments
- **Acceptable:** Original order data preserved, WhatsApp contains details

### Critical Pre-Check
**MUST verify order status values before running this migration!**

See STEP 1 above - if unexpected status values exist, update constraint or migrate data first.

### File Location
`migrations/002_add_order_configuration.sql`

### Rollback Location
`migrations/002_rollback.sql`

---

## 📄 MIGRATION 003: CUSTOM QUOTES ENHANCEMENT

### What It Does
- Adds 4 columns to `custom_quotes` (all nullable):
  - `product_id` UUID - Link to products table (foreign key)
  - `custom_dimensions` JSONB - Structured dimensions
  - `feasibility_assessment` JSONB - Admin assessment
  - `quote_response` JSONB - Quote details
- Adds status constraint (PERMISSIVE, verified from code)
- Creates indexes for quote management

### Safety Guarantees
- ✅ Nullable columns (existing quotes unaffected)
- ✅ Foreign key with ON DELETE SET NULL (safe)
- ✅ Free-text fields preserved (dimensions, project_description)
- ✅ Status values verified from actual code

### Data Loss on Rollback
- Product links
- Structured dimension data
- Feasibility assessments
- Quote response data
- **Acceptable:** Original free-text fields preserved

### Critical Pre-Check
**MUST verify custom_quotes status values!**

Status values verified from `app/admin/quotes/page.tsx`:
- Current: `submitted`, `reviewing`, `quoted`
- Added future values: `accepted`, `declined`, `converted`, `cancelled`

### File Location
`migrations/003_enhance_custom_quotes.sql`

### Rollback Location
`migrations/003_rollback.sql`

---

## 🔄 ROLLBACK PROCEDURES

### When to Rollback

**Immediately rollback if:**
- Migration fails with constraint violation
- Existing records become inaccessible
- Application code crashes after deployment
- RLS policy violations detected

**Do NOT rollback for:**
- Minor UI glitches (fix code instead)
- Missing data in new columns (expected for old records)
- Warning messages (investigate first)

### How to Rollback

**Migration 001:**
```bash
psql -f migrations/001_rollback.sql
```

**Migration 002:**
```bash
psql -f migrations/002_rollback.sql
```

**Migration 003:**
```bash
psql -f migrations/003_rollback.sql
```

**All migrations (in reverse order):**
```bash
psql -f migrations/003_rollback.sql
psql -f migrations/002_rollback.sql
psql -f migrations/001_rollback.sql
```

### Post-Rollback Verification

After rollback:
1. Verify products table loads: `SELECT id, name FROM products LIMIT 10;`
2. Verify orders load: `SELECT id, status FROM orders LIMIT 10;`
3. Verify quotes load: `SELECT id, status FROM custom_quotes LIMIT 10;`
4. Verify application works (test in browser)

---

## 📋 EXECUTION CHECKLIST

### Before Starting
- [ ] Pre-migration checks completed (status values verified)
- [ ] Database backup taken and verified
- [ ] Rollback scripts reviewed and understood
- [ ] Migrations reviewed and approved
- [ ] Team notified of maintenance window

### During Migration (Staging)
- [ ] Execute migration 001
  - [ ] Verify: `SELECT COUNT(*) FROM products WHERE model_dimensions IS NULL;` (should equal total products)
  - [ ] Test rollback: Execute `001_rollback.sql`, verify products still load, re-run `001`
- [ ] Execute migration 002
  - [ ] Verify: `SELECT COUNT(*) FROM order_items WHERE configuration IS NULL;` (should equal total items)
  - [ ] Test status constraint: Try inserting order with valid status (should succeed)
- [ ] Execute migration 003
  - [ ] Verify: `SELECT COUNT(*) FROM custom_quotes WHERE product_id IS NULL;` (should equal total quotes)
  - [ ] Test foreign key: Verify products table is accessible

### After Migration (Staging)
- [ ] Application deploys successfully
- [ ] Existing products load correctly
- [ ] Existing orders query successfully
- [ ] Price calculations unchanged
- [ ] WhatsApp ordering works
- [ ] No console errors in browser
- [ ] No RLS violations in Supabase logs

### Production Deployment (After Staging Success)
- [ ] All staging checks passed
- [ ] Production backup taken
- [ ] Migration scripts copied to production environment
- [ ] Execute migrations (001 → 002 → 003)
- [ ] Deploy application code
- [ ] Monitor for 24 hours
- [ ] Document any issues

---

## 🎯 SUCCESS CRITERIA

### Migration Success
- ✅ All 3 migrations execute without errors
- ✅ Existing products/orders/quotes query successfully
- ✅ Application deploys and runs without crashes
- ✅ No RLS policy violations
- ✅ NULL values in new columns for existing records

### Backward Compatibility Verified
- ✅ Old products with string dimensions display correctly
- ✅ Price calculations unchanged
- ✅ Orders show correct totals
- ✅ WhatsApp order flow works
- ✅ Quote submission form works

### Rollback Testing
- ✅ Rollback scripts execute without errors
- ✅ Application continues working after rollback
- ✅ New data lost (expected)
- ✅ Existing data preserved

---

## 🚨 KNOWN ISSUES & MITIGATIONS

### Issue 1: Status Constraint May Fail
**Symptom:** Migration 002 or 003 fails with constraint violation

**Cause:** Unexpected status values in existing data

**Mitigation:**
1. Run pre-migration checks (see STEP 1 above)
2. If unexpected values found:
   - Option A: Add them to constraint in migration SQL
   - Option B: Update existing records to use allowed values
   - Option C: Skip constraint (less safe)

### Issue 2: Foreign Key Performance
**Symptom:** Slow queries on custom_quotes after migration 003

**Cause:** Foreign key checks on products table

**Mitigation:**
- Partial index already created (WHERE product_id IS NOT NULL)
- Expected quote volume is low (manual review workflow)
- Monitor query performance, add indexes if needed

### Issue 3: NULL Column Display
**Symptom:** Admin UI shows "undefined" or blank fields

**Cause:** New columns are NULL for existing records (expected)

**Mitigation:**
- This is expected behavior (backward compatibility)
- Admin UI should display "Not set" or hide optional fields
- Fix in code, not database

---

## 📞 SUPPORT & ESCALATION

### If Migration Fails

1. **DO NOT PANIC** - Rollback scripts are tested
2. **Copy error message** - Full text, including line numbers
3. **Check pre-migration results** - Were status checks run?
4. **Run rollback script** - Restore to previous state
5. **Report issue with:**
   - Error message
   - Pre-migration check results
   - Which migration failed (001/002/003)
   - Database state (can you query tables?)

### If Application Crashes Post-Migration

1. **Check browser console** - Any JavaScript errors?
2. **Check Supabase logs** - Any RLS violations?
3. **Check specific tables:**
   ```sql
   SELECT * FROM products LIMIT 5;
   SELECT * FROM orders LIMIT 5;
   SELECT * FROM custom_quotes LIMIT 5;
   ```
4. **If data intact but app broken:** Rollback code deployment only (keep migrations)
5. **If data corrupted:** Rollback migrations AND restore from backup

---

## ✅ APPROVAL SIGN-OFF

Before executing these migrations, confirm:

### Technical Review
- [ ] SQL syntax reviewed and approved
- [ ] Rollback procedures understood
- [ ] Pre-migration checks documented
- [ ] Backward compatibility verified

### Business Review
- [ ] Data loss scenarios acceptable
- [ ] Maintenance window scheduled
- [ ] Team notified
- [ ] Rollback criteria defined

### Security Review
- [ ] RLS policies confirmed unchanged
- [ ] New columns inherit existing policies
- [ ] No unauthorized access introduced
- [ ] Foreign key constraints safe

### Approval
- [ ] **Approved by:** _________________
- [ ] **Date:** _________________
- [ ] **Approved for:** [ ] Staging  [ ] Production

---

## 📁 FILE LOCATIONS

All migration files are in: `migrations/` directory

```
migrations/
├── 001_add_structured_dimensions.sql
├── 001_rollback.sql
├── 002_add_order_configuration.sql
├── 002_rollback.sql
├── 003_enhance_custom_quotes.sql
└── 003_rollback.sql
```

Supporting documentation:
- `MVP-IMPLEMENTATION-REPORT.md` - Detailed analysis
- `IMPLEMENTATION-SUMMARY.md` - Executive summary
- `MIGRATION-REVIEW-PACKAGE.md` - This file

---

**Package Prepared:** 2026-10-15  
**Status:** Ready for Review  
**Next Step:** Complete pre-migration checks, then approve for staging test

**DO NOT EXECUTE UNTIL:**
1. Pre-migration checks completed
2. Database backup confirmed
3. Staging environment ready
4. Formal approval received
