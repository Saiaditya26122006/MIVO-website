-- ============================================================================
-- Migration 002: Add Order Configuration Snapshots
-- Purpose: Store full configuration and feasibility with each order
-- Status: NOT EXECUTED - AWAITING REVIEW AND STAGING TEST
-- Rollback: migrations/002_rollback.sql
-- ============================================================================

-- PRE-MIGRATION CHECK (MANDATORY - run this first):
/*
-- Check existing order status values
SELECT DISTINCT status, COUNT(*) as count
FROM orders
GROUP BY status
ORDER BY status;

-- CRITICAL: Verify all status values are compatible
-- If any values outside ['pending'] appear, UPDATE CONSTRAINT OR MIGRATE DATA FIRST
-- Current schema only uses 'pending' as default, but check for manual updates

-- Check if orders table has any records
SELECT COUNT(*) as total_orders FROM orders;
*/

BEGIN;

-- Step 1: Add configuration snapshot to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS configuration_text TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feasibility_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feasibility_notes TEXT DEFAULT NULL;

-- Step 2: Add comments
COMMENT ON COLUMN order_items.configuration IS
  'Full ProductConfiguration snapshot at order time:
   { sizeIndex, materialIndex, colorIndex, quantity, customSize? }';

COMMENT ON COLUMN order_items.configuration_text IS
  'Human-readable configuration summary: "Medium (50×30×20mm), PLA, Red, Qty: 5"';

COMMENT ON COLUMN order_items.feasibility_status IS
  'Feasibility status: "validated" | "needs_review" | "requires_quote" | "not_feasible"';

COMMENT ON COLUMN order_items.feasibility_notes IS
  'Admin notes on feasibility: "Requires split into 2 parts" or "Fits A1 envelope"';

-- Step 3: Add order status constraint
-- CORRECTED: Only enforce constraints for values that currently exist
-- Default schema uses 'pending' only, so start conservative
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

-- NOTE: This constraint is PERMISSIVE to allow future status values
-- Tighten this constraint only after verifying all possible status values
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'validated',
    'in_production',
    'shipped',
    'delivered',
    'cancelled',
    'processing',      -- Common alternative to pending
    'confirmed',       -- Common alternative to validated
    'completed'        -- Common alternative to delivered
  ));

-- Step 4: Create indexes for order management
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_feasibility
  ON order_items (feasibility_status)
  WHERE feasibility_status IS NOT NULL;

-- Step 5: Verify migration
DO $$
DECLARE
  config_exists BOOLEAN;
  existing_orders INTEGER;
  null_config_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  -- Check columns were created
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'configuration'
  ) INTO config_exists;

  IF NOT config_exists THEN
    RAISE EXCEPTION 'Migration verification failed: configuration column not created';
  END IF;

  -- Verify existing order_items have NULL (backward compatibility)
  SELECT COUNT(*) INTO existing_orders FROM order_items;
  SELECT COUNT(*) INTO null_config_count FROM order_items
    WHERE configuration IS NULL;

  -- Check constraint was added
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_status_check' AND table_name = 'orders'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE WARNING 'Status constraint was not created - check for conflicts';
  END IF;

  RAISE NOTICE '✅ Migration 002 complete: Added order configuration tracking';
  RAISE NOTICE '   - Total order_items: %', existing_orders;
  RAISE NOTICE '   - Items with NULL configuration: % (expected: all)', null_config_count;
  RAISE NOTICE '   - Status constraint: %', CASE WHEN constraint_exists THEN 'ADDED' ELSE 'SKIPPED' END;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
/*
-- Verify existing order_items have NULL for new columns
SELECT
  id,
  product_id,
  quantity,
  price,
  configuration,
  feasibility_status
FROM order_items
LIMIT 10;

-- Expected: All rows show NULL for configuration and feasibility_status

-- Test constraint by attempting invalid status (should fail)
-- DO NOT RUN ON PRODUCTION - TEST ON STAGING ONLY:
-- UPDATE orders SET status = 'invalid_status' WHERE id = 'some-test-id';
-- Expected: ERROR - constraint violation

-- Verify old orders still query successfully
SELECT
  o.id,
  o.status,
  o.total,
  COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id
LIMIT 10;
*/
