-- Database Diagnostic Script
-- Run this in Supabase SQL Editor to check database state

-- 1. Check if products table exists and see its columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 2. Check if pricing columns exist
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'pricing_method') THEN '✓ pricing_method exists'
    ELSE '✗ pricing_method MISSING'
  END as pricing_method_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'pricing_config') THEN '✓ pricing_config exists'
    ELSE '✗ pricing_config MISSING'
  END as pricing_config_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'production_time_days') THEN '✓ production_time_days exists'
    ELSE '✗ production_time_days MISSING'
  END as production_time_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'min_quantity') THEN '✓ min_quantity exists'
    ELSE '✗ min_quantity MISSING'
  END as min_quantity_status,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'max_quantity') THEN '✓ max_quantity exists'
    ELSE '✗ max_quantity MISSING'
  END as max_quantity_status;

-- 3. Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'products';

-- 4. List all policies on products table
SELECT
  policyname,
  permissive,
  roles::text,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies
WHERE tablename = 'products';

-- 5. Count products
SELECT
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE published = true) as published_products,
  COUNT(*) FILTER (WHERE pricing_method IS NOT NULL) as products_with_pricing_method
FROM products;

-- 6. Check auth users (to verify you can authenticate)
SELECT
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 7. Test if current user can update products (will show error if RLS blocks it)
-- This is a dry-run test - it won't actually change anything
DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Check if we can hypothetically update
  IF EXISTS (SELECT 1 FROM products LIMIT 1) THEN
    test_result := '✓ SELECT permission works';
  ELSE
    test_result := '✗ Cannot SELECT from products';
  END IF;
  RAISE NOTICE '%', test_result;
END $$;
