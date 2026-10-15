-- ============================================================================
-- Rollback for Migration 002: Remove Order Configuration
-- WARNING: This will delete all order configuration snapshots and feasibility data
-- Status: REFERENCE ONLY - Do not execute without explicit approval
-- ============================================================================

-- PRE-ROLLBACK CHECK:
/*
SELECT COUNT(*) as orders_with_config
FROM order_items
WHERE configuration IS NOT NULL OR feasibility_status IS NOT NULL;
-- Shows how many order items will lose configuration data
*/

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_orders_status_created;
DROP INDEX IF EXISTS idx_order_items_feasibility;

-- Remove order_items columns (data loss: configuration snapshots)
ALTER TABLE order_items
  DROP COLUMN IF EXISTS configuration,
  DROP COLUMN IF EXISTS configuration_text,
  DROP COLUMN IF EXISTS feasibility_status,
  DROP COLUMN IF EXISTS feasibility_notes;

-- Remove status constraint (makes orders table less strict)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Verify rollback
DO $$
DECLARE
  config_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'configuration'
  ) INTO config_exists;

  IF config_exists THEN
    RAISE EXCEPTION 'Rollback verification failed: configuration column still exists';
  END IF;

  RAISE NOTICE '✅ Rollback 002 complete: Removed order configuration tracking';
  RAISE NOTICE '   - WARNING: Order configuration snapshots have been deleted';
  RAISE NOTICE '   - Original order data (product_id, quantity, price) preserved';
  RAISE NOTICE '   - Status constraint removed (less validation)';
END $$;

COMMIT;

-- POST-ROLLBACK VERIFICATION
-- Verify orders and order_items still work
-- SELECT o.*, oi.* FROM orders o JOIN order_items oi ON oi.order_id = o.id LIMIT 5;
