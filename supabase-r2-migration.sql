-- MIVO R2 Storage Migration
-- Add support for Cloudflare R2 storage alongside existing Supabase storage
-- Run this in your Supabase SQL Editor

-- Add new columns to products table for R2 storage support
-- These columns are nullable to maintain backward compatibility with existing records

ALTER TABLE products
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase',
ADD COLUMN IF NOT EXISTS storage_key TEXT,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS storage_metadata JSONB DEFAULT '{}';

-- Add helpful comments
COMMENT ON COLUMN products.storage_provider IS 'Storage location: "supabase" or "r2"';
COMMENT ON COLUMN products.storage_key IS 'R2 object key for files stored in Cloudflare R2';
COMMENT ON COLUMN products.file_size_bytes IS 'Original file size in bytes';
COMMENT ON COLUMN products.storage_metadata IS 'Additional storage metadata (upload timestamp, part count, etc.)';

-- Create index for querying by storage provider
CREATE INDEX IF NOT EXISTS idx_products_storage_provider ON products(storage_provider);

-- Note: model_file column remains for backward compatibility
-- - For Supabase-stored files: model_file contains the Supabase storage path
-- - For R2-stored files: storage_key contains the R2 object key, model_file may be null
