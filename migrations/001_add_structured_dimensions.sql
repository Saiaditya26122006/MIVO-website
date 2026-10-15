-- ============================================================================
-- Migration 001: Add Structured Dimensions & Feasibility
-- Purpose: Add new fields for MVP without breaking existing products
-- Status: NOT EXECUTED - AWAITING REVIEW AND STAGING TEST
-- Rollback: migrations/001_rollback.sql
-- ============================================================================

-- PRE-MIGRATION CHECK (run this first to verify safety):
-- SELECT COUNT(*) as existing_products FROM products;
-- Expected: Should see current product count, all will get NULL for new columns

BEGIN;

-- Step 1: Add new optional fields to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS model_dimensions JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS a1_feasibility JSONB DEFAULT NULL;

-- Step 2: Add helpful comments
COMMENT ON COLUMN products.model_dimensions IS
  'Structured dimensions in mm: { height: number, width: number, depth: number, unit: "mm" }.
   NULL for legacy products without structured dimensions.';

COMMENT ON COLUMN products.a1_feasibility IS
  'A1 feasibility data: {
     fits_envelope: boolean,
     requires_rotation: boolean,
     can_split: boolean,
     split_notes: string | null,
     validated_at: timestamp | null
   }. NULL for legacy products or products not yet validated.';

-- Step 3: Create indexes for performance
-- Partial index only on products with feasibility data
CREATE INDEX IF NOT EXISTS idx_products_a1_fits
  ON products ((a1_feasibility->>'fits_envelope'))
  WHERE a1_feasibility IS NOT NULL;

-- Step 4: Verify migration
DO $$
DECLARE
  dimensions_exists BOOLEAN;
  feasibility_exists BOOLEAN;
  existing_count INTEGER;
  null_count INTEGER;
BEGIN
  -- Check columns were created
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'model_dimensions'
  ) INTO dimensions_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'a1_feasibility'
  ) INTO feasibility_exists;

  IF NOT dimensions_exists OR NOT feasibility_exists THEN
    RAISE EXCEPTION 'Migration verification failed: columns not created';
  END IF;

  -- Verify existing products have NULL (backward compatibility check)
  SELECT COUNT(*) INTO existing_count FROM products;
  SELECT COUNT(*) INTO null_count FROM products
    WHERE model_dimensions IS NULL AND a1_feasibility IS NULL;

  IF existing_count != null_count THEN
    RAISE WARNING 'Unexpected: Some products have non-NULL values immediately after migration';
  END IF;

  RAISE NOTICE '✅ Migration 001 complete: Added model_dimensions and a1_feasibility';
  RAISE NOTICE '   - Total products: %', existing_count;
  RAISE NOTICE '   - Products with NULL dimensions: % (expected: all)', null_count;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (run after migration to confirm safety)
-- ============================================================================
/*
-- Verify all existing products have NULL for new columns
SELECT
  id,
  name,
  model_dimensions,
  a1_feasibility
FROM products
LIMIT 10;

-- Expected: All rows show NULL for model_dimensions and a1_feasibility

-- Verify existing pricing_config still works
SELECT
  id,
  name,
  pricing_method,
  pricing_config->>'basePrice' as base_price
FROM products
WHERE pricing_method = 'configurable'
LIMIT 5;

-- Expected: Should see pricing data unchanged
*/
