-- ============================================================================
-- Rollback for Migration 001: Remove Structured Dimensions
-- WARNING: This will delete all structured dimension and feasibility data
-- Status: REFERENCE ONLY - Do not execute without explicit approval
-- ============================================================================

-- PRE-ROLLBACK CHECK (run this first):
-- SELECT COUNT(*) as products_with_dimensions
-- FROM products
-- WHERE model_dimensions IS NOT NULL OR a1_feasibility IS NOT NULL;
-- Expected: Shows how many products will lose dimension data

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_products_a1_fits;

-- Remove columns (data loss: structured dimensions and feasibility assessments)
ALTER TABLE products DROP COLUMN IF EXISTS model_dimensions;
ALTER TABLE products DROP COLUMN IF EXISTS a1_feasibility;

-- Verify rollback
DO $$
DECLARE
  dimensions_exists BOOLEAN;
  feasibility_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'model_dimensions'
  ) INTO dimensions_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'a1_feasibility'
  ) INTO feasibility_exists;

  IF dimensions_exists OR feasibility_exists THEN
    RAISE EXCEPTION 'Rollback verification failed: columns still exist';
  END IF;

  RAISE NOTICE '✅ Rollback 001 complete: Removed model_dimensions and a1_feasibility';
  RAISE NOTICE '   - WARNING: Structured dimension data has been deleted';
  RAISE NOTICE '   - Products continue working with pricing_config (legacy)';
END $$;

COMMIT;

-- POST-ROLLBACK VERIFICATION
-- Verify products still load and price correctly
-- SELECT id, name, pricing_method, pricing_config FROM products LIMIT 5;
