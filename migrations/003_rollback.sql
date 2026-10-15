-- ============================================================================
-- Rollback for Migration 003: Remove Custom Quote Enhancements
-- WARNING: This will delete product links, structured dimensions, and assessments
-- Status: REFERENCE ONLY - Do not execute without explicit approval
-- ============================================================================

-- PRE-ROLLBACK CHECK:
/*
SELECT COUNT(*) as quotes_with_enhancements
FROM custom_quotes
WHERE product_id IS NOT NULL
   OR custom_dimensions IS NOT NULL
   OR feasibility_assessment IS NOT NULL
   OR quote_response IS NOT NULL;
-- Shows how many quotes will lose enhancement data
*/

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_custom_quotes_product;
DROP INDEX IF EXISTS idx_custom_quotes_status;

-- Remove columns (data loss: product links, structured data, assessments)
ALTER TABLE custom_quotes
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS custom_dimensions,
  DROP COLUMN IF EXISTS feasibility_assessment,
  DROP COLUMN IF EXISTS quote_response;

-- Remove status constraint
ALTER TABLE custom_quotes DROP CONSTRAINT IF EXISTS custom_quotes_status_check;

-- Verify rollback
DO $$
DECLARE
  product_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_quotes' AND column_name = 'product_id'
  ) INTO product_id_exists;

  IF product_id_exists THEN
    RAISE EXCEPTION 'Rollback verification failed: product_id column still exists';
  END IF;

  RAISE NOTICE '✅ Rollback 003 complete: Removed custom quote enhancements';
  RAISE NOTICE '   - WARNING: Product links and feasibility assessments deleted';
  RAISE NOTICE '   - Original free-text fields preserved (dimensions, project_description)';
  RAISE NOTICE '   - Status constraint removed (less validation)';
END $$;

COMMIT;

-- POST-ROLLBACK VERIFICATION
-- Verify quotes still work with original fields
-- SELECT id, customer_name, dimensions, material, status FROM custom_quotes LIMIT 5;
