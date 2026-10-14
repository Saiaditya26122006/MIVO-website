-- MIVO Configurable Pricing Migration
-- Run this in your Supabase SQL Editor AFTER the base schema

-- Add pricing configuration columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS pricing_method TEXT NOT NULL DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS production_time_days INTEGER,
ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 100;

-- Add check constraint for pricing_method
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_pricing_method_check;

ALTER TABLE products
ADD CONSTRAINT products_pricing_method_check
CHECK (pricing_method IN ('fixed', 'configurable', 'quote'));

-- Add comment for documentation
COMMENT ON COLUMN products.pricing_method IS 'Pricing method: fixed (one price), configurable (price varies by options), quote (custom quote required)';
COMMENT ON COLUMN products.pricing_config IS 'JSON configuration for pricing: { basePrice, sizes: [{name, dimensions, price}], materials: [{name, priceAdjustment}], colors: [{name, additionalCharge}] }';
COMMENT ON COLUMN products.production_time_days IS 'Estimated production time in days';
COMMENT ON COLUMN products.min_quantity IS 'Minimum order quantity';
COMMENT ON COLUMN products.max_quantity IS 'Maximum order quantity';

-- Update existing products to use 'fixed' pricing by default
-- This ensures backward compatibility
UPDATE products
SET pricing_method = 'fixed',
    pricing_config = jsonb_build_object(
        'basePrice', price
    )
WHERE pricing_method IS NULL OR pricing_method = '';

-- Create index for pricing method queries
CREATE INDEX IF NOT EXISTS idx_products_pricing_method ON products(pricing_method);

-- Example pricing_config structures for documentation:

-- Fixed Price:
-- {
--   "basePrice": 199
-- }

-- Configurable Price:
-- {
--   "basePrice": 199,
--   "sizes": [
--     {"name": "Small", "dimensions": "5x5x5cm", "price": 199},
--     {"name": "Medium", "dimensions": "10x10x10cm", "price": 299},
--     {"name": "Large", "dimensions": "15x15x15cm", "price": 399}
--   ],
--   "materials": [
--     {"name": "PLA", "priceAdjustment": 0},
--     {"name": "PETG", "priceAdjustment": 50},
--     {"name": "TPU", "priceAdjustment": 100}
--   ],
--   "colors": [
--     {"name": "Black", "additionalCharge": 0},
--     {"name": "White", "additionalCharge": 0},
--     {"name": "Custom Color", "additionalCharge": 30}
--   ]
-- }

-- Quote-based:
-- {
--   "requiredInfo": ["dimensions", "quantity", "material"],
--   "referencePhotosRequired": true
-- }
