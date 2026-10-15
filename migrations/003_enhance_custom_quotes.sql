-- ============================================================================
-- Migration 003: Enhance Custom Quotes with Feasibility
-- Purpose: Add structured dimensions and feasibility assessment to quotes
-- Status: NOT EXECUTED - AWAITING REVIEW AND STAGING TEST
-- Rollback: migrations/003_rollback.sql
-- ============================================================================

-- PRE-MIGRATION CHECK (MANDATORY - run this first):
/*
-- Check existing quote status values
SELECT DISTINCT status, COUNT(*) as count
FROM custom_quotes
GROUP BY status
ORDER BY status;

-- VERIFIED from app/admin/quotes/page.tsx:
-- Current application uses: 'submitted', 'reviewing', 'quoted'
-- Constraint will allow these + future values

-- Check if custom_quotes table has any records
SELECT COUNT(*) as total_quotes FROM custom_quotes;
*/

BEGIN;

-- Step 1: Add new fields for structured quotes
ALTER TABLE custom_quotes
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_dimensions JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feasibility_assessment JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quote_response JSONB DEFAULT NULL;

-- Step 2: Add comments
COMMENT ON COLUMN custom_quotes.product_id IS
  'Link to product if customer is requesting custom size of existing product.
   NULL for completely custom requests.';

COMMENT ON COLUMN custom_quotes.custom_dimensions IS
  'Structured dimensions: { height: number, width: number, depth: number, unit: "mm" }';

COMMENT ON COLUMN custom_quotes.feasibility_assessment IS
  'Admin feasibility assessment: {
     can_print: boolean,
     fits_a1: boolean,
     requires_split: boolean,
     split_count: number | null,
     estimated_cost: number | null,
     notes: string,
     assessed_by: uuid,
     assessed_at: timestamp
   }';

COMMENT ON COLUMN custom_quotes.quote_response IS
  'Admin quote response: {
     quoted_price: number,
     production_time_days: number,
     valid_until: date,
     terms: string,
     notes: string,
     quoted_by: uuid,
     quoted_at: timestamp
   }';

-- Step 3: Update status constraint
-- CORRECTED: Permissive constraint based on observed usage
ALTER TABLE custom_quotes
  DROP CONSTRAINT IF EXISTS custom_quotes_status_check;

-- Observed from app/admin/quotes/page.tsx: 'submitted', 'reviewing', 'quoted'
-- Add additional likely values for complete workflow
ALTER TABLE custom_quotes
  ADD CONSTRAINT custom_quotes_status_check
  CHECK (status IN (
    'submitted',    -- Default, customer submitted
    'reviewing',    -- Admin is reviewing
    'quoted',       -- Admin sent quote
    'accepted',     -- Customer accepted quote
    'declined',     -- Customer or admin declined
    'converted',    -- Quote converted to order
    'cancelled'     -- Quote cancelled
  ));

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_quotes_product
  ON custom_quotes (product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_quotes_status
  ON custom_quotes (status, created_at DESC);

-- Step 5: Verify migration
DO $$
DECLARE
  feasibility_exists BOOLEAN;
  existing_quotes INTEGER;
  null_product_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  -- Check columns were created
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_quotes' AND column_name = 'feasibility_assessment'
  ) INTO feasibility_exists;

  IF NOT feasibility_exists THEN
    RAISE EXCEPTION 'Migration verification failed: feasibility_assessment column not created';
  END IF;

  -- Verify existing quotes have NULL for new columns
  SELECT COUNT(*) INTO existing_quotes FROM custom_quotes;
  SELECT COUNT(*) INTO null_product_count FROM custom_quotes
    WHERE product_id IS NULL;

  -- Check constraint
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'custom_quotes_status_check' AND table_name = 'custom_quotes'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE WARNING 'Status constraint was not created - check for conflicts';
  END IF;

  RAISE NOTICE '✅ Migration 003 complete: Enhanced custom quotes';
  RAISE NOTICE '   - Total quotes: %', existing_quotes;
  RAISE NOTICE '   - Quotes with NULL product_id: % (expected: all)', null_product_count;
  RAISE NOTICE '   - Status constraint: %', CASE WHEN constraint_exists THEN 'ADDED' ELSE 'SKIPPED' END;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
/*
-- Verify existing quotes have NULL for new columns
SELECT
  id,
  customer_name,
  dimensions,           -- Old free-text field (preserved)
  product_id,           -- New field (should be NULL)
  custom_dimensions,    -- New field (should be NULL)
  feasibility_assessment,
  status
FROM custom_quotes
LIMIT 10;

-- Expected: All rows show NULL for product_id, custom_dimensions, feasibility_assessment

-- Verify foreign key works (test on staging only)
-- INSERT INTO custom_quotes (customer_name, email, project_description, product_id)
-- VALUES ('Test', 'test@example.com', 'Test quote', 'valid-product-uuid');
-- Expected: Success if product exists, or NULL if product_id is NULL

-- Test ON DELETE SET NULL behavior (staging only)
-- Create test product, link quote, delete product, verify product_id becomes NULL
*/
