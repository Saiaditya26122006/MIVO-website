-- ============================================================================
-- MIVO MVP - Database Verification Queries
-- ============================================================================
-- Purpose: Verify migrations executed successfully and inspect current data
-- Status: READ-ONLY - Safe to run on production
-- Date: 2026-10-15
-- ============================================================================

-- ============================================================================
-- VERIFICATION 1: Check Migration Columns Exist
-- ============================================================================

-- Check products table has new columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('model_dimensions', 'a1_feasibility')
ORDER BY column_name;

-- Expected result:
-- model_dimensions    | jsonb | YES | NULL
-- a1_feasibility      | jsonb | YES | NULL

-- ============================================================================
-- VERIFICATION 2: Check Order Items Columns Exist
-- ============================================================================

-- Check order_items table has new columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'order_items'
  AND column_name IN ('configuration', 'configuration_text', 'feasibility_status', 'feasibility_notes')
ORDER BY column_name;

-- Expected result:
-- configuration        | jsonb | YES | NULL
-- configuration_text   | text  | YES | NULL
-- feasibility_notes    | text  | YES | NULL
-- feasibility_status   | text  | YES | NULL

-- ============================================================================
-- VERIFICATION 3: Check Custom Quotes Columns Exist
-- ============================================================================

-- Check custom_quotes table has new columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'custom_quotes'
  AND column_name IN ('product_id', 'custom_dimensions', 'feasibility_assessment', 'quote_response')
ORDER BY column_name;

-- Expected result:
-- custom_dimensions      | jsonb | YES | NULL
-- feasibility_assessment | jsonb | YES | NULL
-- product_id             | uuid  | YES | NULL
-- quote_response         | jsonb | YES | NULL

-- ============================================================================
-- VERIFICATION 4: Check Indexes Created
-- ============================================================================

-- Check products indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND indexname LIKE '%a1%';

-- Expected: idx_products_a1_fits

-- Check orders indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname LIKE '%status%';

-- Expected: idx_orders_status_created

-- Check order_items indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'order_items'
  AND indexname LIKE '%feasibility%';

-- Expected: idx_order_items_feasibility

-- Check custom_quotes indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'custom_quotes'
  AND (indexname LIKE '%product%' OR indexname LIKE '%status%');

-- Expected: idx_custom_quotes_product, idx_custom_quotes_status

-- ============================================================================
-- VERIFICATION 5: Check Constraints
-- ============================================================================

-- Check orders status constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
  AND conname = 'orders_status_check';

-- Expected: CHECK (status IN ('pending', 'validated', ...))

-- Check custom_quotes status constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'custom_quotes'::regclass
  AND conname = 'custom_quotes_status_check';

-- Expected: CHECK (status IN ('submitted', 'reviewing', ...))

-- ============================================================================
-- VERIFICATION 6: Inspect Current Order Status Values
-- ============================================================================

-- List all distinct order status values (CRITICAL for constraint verification)
SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM orders
GROUP BY status
ORDER BY count DESC;

-- VERIFY: All status values are in the allowed list:
-- ['pending', 'validated', 'in_production', 'shipped', 'delivered',
--  'cancelled', 'processing', 'confirmed', 'completed']
--
-- If any unexpected values appear, they will cause constraint violations

-- ============================================================================
-- VERIFICATION 7: Inspect Current Custom Quote Status Values
-- ============================================================================

-- List all distinct custom_quotes status values
SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM custom_quotes
GROUP BY status
ORDER BY count DESC;

-- VERIFY: All status values are in the allowed list:
-- ['submitted', 'reviewing', 'quoted', 'accepted', 'declined', 'converted', 'cancelled']
--
-- Verified from app/admin/quotes/page.tsx: 'submitted', 'reviewing', 'quoted'

-- ============================================================================
-- VERIFICATION 8: Check Backward Compatibility
-- ============================================================================

-- Verify existing products have NULL for new columns
SELECT
  COUNT(*) as total_products,
  COUNT(model_dimensions) as with_structured_dimensions,
  COUNT(a1_feasibility) as with_feasibility,
  COUNT(*) - COUNT(model_dimensions) as legacy_products
FROM products;

-- Expected:
-- - total_products: N (your product count)
-- - with_structured_dimensions: 0 (no products migrated yet)
-- - with_feasibility: 0 (no feasibility data yet)
-- - legacy_products: N (all products are legacy format)

-- Verify existing order_items have NULL for new columns
SELECT
  COUNT(*) as total_order_items,
  COUNT(configuration) as with_configuration,
  COUNT(feasibility_status) as with_feasibility,
  COUNT(*) - COUNT(configuration) as legacy_items
FROM order_items;

-- Expected:
-- - total_order_items: N
-- - with_configuration: 0 (no new orders yet)
-- - with_feasibility: 0
-- - legacy_items: N (all items are legacy format)

-- Verify existing quotes have NULL for new columns
SELECT
  COUNT(*) as total_quotes,
  COUNT(product_id) as with_product_link,
  COUNT(custom_dimensions) as with_structured_dims,
  COUNT(*) - COUNT(product_id) as legacy_quotes
FROM custom_quotes;

-- Expected:
-- - total_quotes: N
-- - with_product_link: 0 (no new quotes yet)
-- - with_structured_dims: 0
-- - legacy_quotes: N (all quotes are legacy format)

-- ============================================================================
-- VERIFICATION 9: Sample Data Inspection
-- ============================================================================

-- View sample products (check NULL values)
SELECT
  id,
  name,
  pricing_method,
  model_dimensions,
  a1_feasibility,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 5;

-- Expected: model_dimensions and a1_feasibility should be NULL for all

-- View sample orders (check NULL values)
SELECT
  o.id,
  o.status,
  o.total,
  oi.configuration,
  oi.feasibility_status
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 5;

-- Expected: configuration and feasibility_status should be NULL for all

-- View sample custom quotes (check NULL values)
SELECT
  id,
  customer_name,
  dimensions,          -- Old free-text field (preserved)
  product_id,          -- New field (should be NULL)
  custom_dimensions,   -- New field (should be NULL)
  status,
  created_at
FROM custom_quotes
ORDER BY created_at DESC
LIMIT 5;

-- Expected:
-- - dimensions: May have values (old free-text format)
-- - product_id: NULL
-- - custom_dimensions: NULL

-- ============================================================================
-- VERIFICATION 10: Foreign Key Validation
-- ============================================================================

-- Check foreign key from custom_quotes to products
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname LIKE '%product_id%'
  AND conrelid = 'custom_quotes'::regclass;

-- Expected: FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL

-- ============================================================================
-- VERIFICATION 11: Record Counts (Summary)
-- ============================================================================

-- Get counts of all relevant tables
SELECT
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM orders) as orders_count,
  (SELECT COUNT(*) FROM order_items) as order_items_count,
  (SELECT COUNT(*) FROM custom_quotes) as quotes_count;

-- Document these counts for future reference

-- ============================================================================
-- VERIFICATION 12: RLS Policies Check
-- ============================================================================

-- Check RLS is enabled on tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('products', 'orders', 'order_items', 'custom_quotes')
ORDER BY tablename;

-- Expected: All tables should have rls_enabled = true

-- List all policies on products table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- Verify existing policies still exist:
-- - "Public can view published products" (SELECT)
-- - "Admins have full access to products" (ALL)

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================
-- All queries above are READ-ONLY and safe to run on production
-- Expected results documented inline
-- ============================================================================
