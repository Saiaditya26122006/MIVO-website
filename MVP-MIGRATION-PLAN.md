# MIVO MVP Migration & Implementation Plan

**Date:** 2026-10-15  
**Phase:** Foundation + Custom Size MVP  
**Status:** ⏳ AWAITING APPROVAL - DO NOT EXECUTE

---

## OVERVIEW

This plan implements:
1. **Structured dimensions** (mm) with backward compatibility
2. **Per-size material/color restrictions**
3. **Custom dimension inputs**
4. **A1 feasibility checks** (256×256×256 mm)
5. **Order persistence** with configuration snapshots
6. **Three-outcome system:** fits, requires-review, not-feasible

**Duration:** 4 weeks (MVP)  
**Approach:** Incremental, backward-compatible, fully tested

---

## GUIDING PRINCIPLES

### ✅ DO
- Preserve existing products and pricing
- Maintain backward compatibility
- Add new features alongside old
- Provide migration helpers for admin
- Test thoroughly before deployment
- Document rollback procedures

### ❌ DO NOT
- Replace the current pricing system
- Break existing product configurations
- Execute SQL against live database without approval
- Deploy payment processing
- Claim printability from height/bounding-box alone
- Remove WhatsApp workflow

---

## PHASE 1: DATABASE SCHEMA CHANGES

### 1.1 New Product Fields (Backward Compatible)

**Migration:** `migrations/001_add_structured_dimensions.sql`

```sql
-- ============================================================================
-- Migration 001: Add Structured Dimensions & Feasibility
-- Purpose: Add new fields for MVP without breaking existing products
-- Rollback: Simple column drops (data loss acceptable if rolled back)
-- ============================================================================

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
CREATE INDEX IF NOT EXISTS idx_products_a1_fits 
  ON products ((a1_feasibility->>'fits_envelope')) 
  WHERE a1_feasibility IS NOT NULL;

-- Step 4: Verify migration
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
  
  IF NOT dimensions_exists OR NOT feasibility_exists THEN
    RAISE EXCEPTION 'Migration verification failed: columns not created';
  END IF;
  
  RAISE NOTICE '✅ Migration 001 complete: Added model_dimensions and a1_feasibility';
END $$;

COMMIT;

-- ============================================================================
-- Rollback Script (for reference - DO NOT RUN unless reverting)
-- ============================================================================
/*
BEGIN;
ALTER TABLE products DROP COLUMN IF EXISTS model_dimensions;
ALTER TABLE products DROP COLUMN IF EXISTS a1_feasibility;
DROP INDEX IF EXISTS idx_products_a1_fits;
COMMIT;
*/
```

**Backward Compatibility Strategy:**
- ✅ New columns are nullable (NULL = legacy product)
- ✅ Existing products continue working unchanged
- ✅ Old pricing_config structure still valid
- ✅ Admin can gradually migrate products

---

### 1.2 Enhanced Order Tracking

**Migration:** `migrations/002_add_order_configuration.sql`

```sql
-- ============================================================================
-- Migration 002: Add Order Configuration Snapshots
-- Purpose: Store full configuration and feasibility with each order
-- Rollback: Column drops (data loss acceptable if rolled back)
-- ============================================================================

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

-- Step 3: Add order status constraints
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'validated', 'in_production', 'shipped', 'delivered', 'cancelled'));

-- Step 4: Create index for order management
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_feasibility 
  ON order_items (feasibility_status) 
  WHERE feasibility_status IS NOT NULL;

-- Step 5: Verify migration
DO $$
DECLARE
  config_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'configuration'
  ) INTO config_exists;
  
  IF NOT config_exists THEN
    RAISE EXCEPTION 'Migration verification failed: configuration column not created';
  END IF;
  
  RAISE NOTICE '✅ Migration 002 complete: Added order configuration tracking';
END $$;

COMMIT;

-- ============================================================================
-- Rollback Script
-- ============================================================================
/*
BEGIN;
ALTER TABLE order_items 
  DROP COLUMN IF EXISTS configuration,
  DROP COLUMN IF EXISTS configuration_text,
  DROP COLUMN IF EXISTS feasibility_status,
  DROP COLUMN IF EXISTS feasibility_notes;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

DROP INDEX IF EXISTS idx_orders_status_created;
DROP INDEX IF EXISTS idx_order_items_feasibility;
COMMIT;
*/
```

**Backward Compatibility:**
- ✅ New columns are nullable (existing orders unaffected)
- ✅ WhatsApp flow continues working
- ✅ Old orders show NULL configuration (acceptable)

---

### 1.3 Enhanced Custom Quotes

**Migration:** `migrations/003_enhance_custom_quotes.sql`

```sql
-- ============================================================================
-- Migration 003: Enhance Custom Quotes with Feasibility
-- Purpose: Add structured dimensions and feasibility assessment to quotes
-- Rollback: Column drops (data loss acceptable if rolled back)
-- ============================================================================

BEGIN;

-- Step 1: Add new fields for structured quotes
ALTER TABLE custom_quotes
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_dimensions JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feasibility_assessment JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quote_response JSONB DEFAULT NULL;

-- Step 2: Add comments
COMMENT ON COLUMN custom_quotes.product_id IS 
  'Link to product if customer is requesting custom size of existing product. NULL for completely custom requests.';

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
ALTER TABLE custom_quotes
  DROP CONSTRAINT IF EXISTS custom_quotes_status_check;

ALTER TABLE custom_quotes
  ADD CONSTRAINT custom_quotes_status_check 
  CHECK (status IN ('submitted', 'reviewing', 'quoted', 'accepted', 'declined', 'converted'));

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_quotes_product 
  ON custom_quotes (product_id) 
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_quotes_status 
  ON custom_quotes (status, created_at DESC);

-- Step 5: Verify migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_quotes' AND column_name = 'feasibility_assessment'
  ) THEN
    RAISE EXCEPTION 'Migration verification failed';
  END IF;
  
  RAISE NOTICE '✅ Migration 003 complete: Enhanced custom quotes';
END $$;

COMMIT;

-- ============================================================================
-- Rollback Script
-- ============================================================================
/*
BEGIN;
ALTER TABLE custom_quotes 
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS custom_dimensions,
  DROP COLUMN IF EXISTS feasibility_assessment,
  DROP COLUMN IF EXISTS quote_response;

ALTER TABLE custom_quotes DROP CONSTRAINT IF EXISTS custom_quotes_status_check;

DROP INDEX IF EXISTS idx_custom_quotes_product;
DROP INDEX IF EXISTS idx_custom_quotes_status;
COMMIT;
*/
```

---

## PHASE 2: TYPESCRIPT TYPE UPDATES

### 2.1 Enhanced Pricing Types (Backward Compatible)

**File:** `types/pricing.ts`

**Strategy:** Extend existing types, don't replace

```typescript
// ============================================================================
// ENHANCED PRICING TYPES - MVP
// Extends existing types with backward compatibility
// ============================================================================

// EXISTING TYPE (unchanged)
export type PricingMethod = 'fixed' | 'configurable' | 'quote';

// NEW: Structured dimensions
export interface StructuredDimensions {
  height: number;  // in mm
  width: number;   // in mm
  depth: number;   // in mm
  unit: 'mm';      // fixed unit for consistency
}

// NEW: A1 Feasibility
export interface A1Feasibility {
  fits_envelope: boolean;
  requires_rotation: boolean;
  can_split: boolean;
  split_notes?: string;
  validated_at?: string;  // ISO timestamp
}

// ENHANCED: SizeOption (backward compatible)
export interface SizeOption {
  name: string;
  
  // DEPRECATED: Free-text dimensions (for backward compatibility)
  dimensions?: string;  // e.g., "50×30×20 mm" - still supported
  
  // NEW: Structured dimensions (preferred)
  structuredDimensions?: StructuredDimensions;
  
  price: number;
  
  // NEW: Per-size restrictions (optional)
  supportedMaterials?: string[];  // Material names, empty = all supported
  supportedColors?: string[];     // Color names, empty = all supported
  
  // NEW: Feasibility (optional)
  a1Feasibility?: A1Feasibility;
}

// EXISTING TYPES (unchanged)
export interface MaterialOption {
  name: string;
  priceAdjustment: number;
}

export interface ColorOption {
  name: string;
  additionalCharge: number;
}

export interface FixedPricingConfig {
  basePrice: number;
}

export interface ConfigurablePricingConfig {
  basePrice: number;
  sizes?: SizeOption[];
  materials?: MaterialOption[];
  colors?: ColorOption[];
  
  // NEW: Allow custom dimensions? (default: false)
  allowCustomDimensions?: boolean;
  
  // NEW: Custom dimension limits (if allowed)
  customDimensionLimits?: {
    maxHeight: number;  // in mm
    maxWidth: number;   // in mm
    maxDepth: number;   // in mm
  };
}

export interface QuotePricingConfig {
  requiredInfo?: string[];
  referencePhotosRequired?: boolean;
}

export type PricingConfig =
  | FixedPricingConfig
  | ConfigurablePricingConfig
  | QuotePricingConfig;

// ENHANCED: ProductConfiguration (backward compatible)
export interface ProductConfiguration {
  // EXISTING FIELDS (unchanged)
  sizeIndex?: number;
  materialIndex?: number;
  colorIndex?: number;
  quantity: number;
  
  // NEW: Custom dimensions (optional)
  customSize?: StructuredDimensions;
  
  // NEW: Feasibility acknowledgment (optional)
  acknowledgesSplitPrinting?: boolean;
}

// EXISTING TYPE (unchanged)
export interface PriceBreakdown {
  basePrice: number;
  sizePrice?: number;
  materialAdjustment?: number;
  colorCharge?: number;
  quantity: number;
  unitPrice: number;
  total: number;
  details: {
    size?: string;
    material?: string;
    color?: string;
  };
  
  // NEW: Feasibility info (optional)
  feasibility?: {
    status: 'fits' | 'requires_review' | 'not_feasible';
    message?: string;
  };
}

// ENHANCED: Product type (backward compatible)
export interface Product {
  id: string;
  name: string;
  description: string;
  long_description?: string;
  price: number;
  category: string;
  images: string[];
  in_stock: boolean;
  featured: boolean;
  published: boolean;
  specifications: Record<string, any>;
  tags?: string[];

  pricing_method: PricingMethod;
  pricing_config: PricingConfig;
  production_time_days?: number;
  min_quantity: number;
  max_quantity: number;

  // NEW: Structured dimensions (optional, NULL for legacy products)
  model_dimensions?: StructuredDimensions | null;
  
  // NEW: A1 feasibility (optional, NULL for legacy products)
  a1_feasibility?: A1Feasibility | null;

  created_at: string;
  updated_at: string;
}

// NEW: Feasibility check types
export interface FeasibilityCheckRequest {
  productId: string;
  configuration: ProductConfiguration;
}

export interface FeasibilityCheckResult {
  feasible: boolean;
  fits_a1_envelope: boolean;
  exceeds_dimension?: 'height' | 'width' | 'depth';
  max_allowed?: number;
  requested?: number;
  can_split?: boolean;
  split_recommendation?: string;
  requires_quote: boolean;
  message: string;
}

// NEW: Order snapshot types
export interface OrderConfigurationSnapshot {
  product_id: string;
  product_name: string;
  configuration: ProductConfiguration;
  price_breakdown: PriceBreakdown;
  feasibility_status: 'validated' | 'needs_review' | 'requires_quote';
  feasibility_notes?: string;
  ordered_at: string;
}
```

**Backward Compatibility Validation:**
- ✅ All existing types remain unchanged
- ✅ New fields are optional
- ✅ Old SizeOption with `dimensions` string still works
- ✅ New code checks for `structuredDimensions` first, falls back to `dimensions`

---

## PHASE 3: VALIDATION & FEASIBILITY LOGIC

### 3.1 Dimension Validation

**File:** `lib/validation.ts` (NEW)

```typescript
// ============================================================================
// DIMENSION VALIDATION & FEASIBILITY CHECKS
// ============================================================================

import type { StructuredDimensions, A1Feasibility } from '@/types/pricing';

// Bambu Lab A1 specifications
export const A1_SPECS = {
  BUILD_VOLUME: {
    height: 256,  // mm
    width: 256,   // mm
    depth: 256,   // mm
  },
  // Conservative usable area (accounting for purge tower, clips, etc.)
  USABLE_VOLUME: {
    height: 250,  // mm (accounting for build plate clips)
    width: 250,   // mm (accounting for purge tower if multi-color)
    depth: 250,   // mm
  },
  MAX_LAYER_HEIGHT: 0.28,  // mm
  MIN_LAYER_HEIGHT: 0.08,  // mm
} as const;

/**
 * Validate dimension values (positive, reasonable limits)
 */
export function validateDimensions(
  dimensions: Partial<StructuredDimensions>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (dimensions.height !== undefined) {
    if (dimensions.height <= 0) {
      errors.push('Height must be greater than 0mm');
    }
    if (dimensions.height > 500) {
      errors.push('Height cannot exceed 500mm (far beyond A1 capabilities)');
    }
    if (dimensions.height < 0.1) {
      errors.push('Height must be at least 0.1mm');
    }
  }

  if (dimensions.width !== undefined) {
    if (dimensions.width <= 0) {
      errors.push('Width must be greater than 0mm');
    }
    if (dimensions.width > 500) {
      errors.push('Width cannot exceed 500mm');
    }
    if (dimensions.width < 0.1) {
      errors.push('Width must be at least 0.1mm');
    }
  }

  if (dimensions.depth !== undefined) {
    if (dimensions.depth <= 0) {
      errors.push('Depth must be greater than 0mm');
    }
    if (dimensions.depth > 500) {
      errors.push('Depth cannot exceed 500mm');
    }
    if (dimensions.depth < 0.1) {
      errors.push('Depth must be at least 0.1mm');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if dimensions fit within A1 build volume
 * 
 * IMPORTANT: This is a preliminary bounding-box check only.
 * It does NOT guarantee printability. Factors not checked:
 * - Model geometry (overhangs, bridges, supports)
 * - Orientation optimization
 * - Material requirements
 * - Multi-part assembly feasibility
 * 
 * Use this to categorize: fits, might-fit-with-rotation, exceeds-envelope
 */
export function checkA1Feasibility(
  dimensions: StructuredDimensions,
  useConservativeVolume = true
): A1Feasibility & { message: string } {
  const volume = useConservativeVolume 
    ? A1_SPECS.USABLE_VOLUME 
    : A1_SPECS.BUILD_VOLUME;

  const { height, width, depth } = dimensions;

  // Check if fits in current orientation
  const fitsAsIs = 
    height <= volume.height &&
    width <= volume.width &&
    depth <= volume.depth;

  if (fitsAsIs) {
    return {
      fits_envelope: true,
      requires_rotation: false,
      can_split: false,
      message: `Fits within A1 envelope (${volume.height}×${volume.width}×${volume.depth} mm)`,
    };
  }

  // Check all possible rotations (6 orientations)
  const allDimensions = [height, width, depth];
  allDimensions.sort((a, b) => a - b); // Sort ascending
  const [smallest, middle, largest] = allDimensions;

  const fitsWithRotation =
    smallest <= volume.depth &&
    middle <= volume.width &&
    largest <= volume.height;

  if (fitsWithRotation) {
    return {
      fits_envelope: true,
      requires_rotation: true,
      can_split: false,
      message: `Fits with rotation. Optimal orientation: ${largest}×${middle}×${smallest} mm`,
    };
  }

  // Exceeds envelope - check if split-printing might be possible
  const maxDimension = Math.max(height, width, depth);
  const exceedsByAmount = maxDimension - volume.height;

  // Heuristic: If exceeds by < 100mm and geometry *might* allow splitting
  // Mark as "can_split" but require admin review
  const mightSplit = exceedsByAmount < 100 && exceedsByAmount > 0;

  if (mightSplit) {
    return {
      fits_envelope: false,
      requires_rotation: false,
      can_split: true,
      split_notes: `Exceeds A1 envelope by ${exceedsByAmount.toFixed(0)}mm. May be splittable if geometry permits.`,
      message: `Exceeds A1 volume. Potential split-printing candidate (requires admin review).`,
    };
  }

  // Far exceeds envelope - not feasible
  return {
    fits_envelope: false,
    requires_rotation: false,
    can_split: false,
    split_notes: `Exceeds A1 envelope by ${exceedsByAmount.toFixed(0)}mm. Too large for split-printing.`,
    message: `Cannot be printed on A1. Maximum dimension: ${maxDimension.toFixed(0)}mm, A1 limit: ${volume.height}mm`,
  };
}

/**
 * Validate material/color restrictions for a given size
 */
export function validateRestrictions(
  selectedMaterial: string | undefined,
  selectedColor: string | undefined,
  sizeOption: { 
    supportedMaterials?: string[]; 
    supportedColors?: string[];
    name: string;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check material restriction
  if (
    sizeOption.supportedMaterials &&
    sizeOption.supportedMaterials.length > 0 &&
    selectedMaterial
  ) {
    if (!sizeOption.supportedMaterials.includes(selectedMaterial)) {
      errors.push(
        `Material "${selectedMaterial}" is not available for size "${sizeOption.name}". ` +
        `Supported: ${sizeOption.supportedMaterials.join(', ')}`
      );
    }
  }

  // Check color restriction
  if (
    sizeOption.supportedColors &&
    sizeOption.supportedColors.length > 0 &&
    selectedColor
  ) {
    if (!sizeOption.supportedColors.includes(selectedColor)) {
      errors.push(
        `Color "${selectedColor}" is not available for size "${sizeOption.name}". ` +
        `Supported: ${sizeOption.supportedColors.join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## PHASE 4: IMPLEMENTATION PLAN SUMMARY

### Week 1: Foundation
**Day 1-2:** Database migrations
- [ ] Review and approve migrations 001-003
- [ ] Execute migrations on staging database
- [ ] Verify existing products unchanged
- [ ] Test rollback procedures

**Day 3-4:** TypeScript types & validation
- [ ] Implement enhanced types in `types/pricing.ts`
- [ ] Implement validation in `lib/validation.ts`
- [ ] Write unit tests for validation logic
- [ ] Verify backward compatibility

**Day 5:** Integration
- [ ] Update `lib/pricing.ts` to use new types
- [ ] Ensure old products still calculate correctly
- [ ] Run existing product compatibility tests

---

### Week 2: Custom Dimensions UI
**Day 1-2:** Product page custom size input
- [ ] Add "Custom Size" radio option
- [ ] Add dimension input fields (H×W×D mm)
- [ ] Add real-time validation
- [ ] Add "Check Feasibility" button

**Day 3-4:** Feasibility API
- [ ] Create `/api/check-feasibility` endpoint
- [ ] Implement A1 volume checks
- [ ] Return three outcomes: fits, requires-review, not-feasible
- [ ] Add comprehensive error handling

**Day 5:** UI feedback
- [ ] Add feasibility result display
- [ ] Show appropriate CTAs (Order/Quote/Revise)
- [ ] Add warning messages
- [ ] Test user flows

---

### Week 3: Per-Size Restrictions
**Day 1-2:** Admin product editor
- [ ] Update size option form (structured dimensions)
- [ ] Add material/color restriction checkboxes
- [ ] Add A1 feasibility preview
- [ ] Add migration helper for old products

**Day 2-3:** Configuration validation
- [ ] Update `validateConfiguration()` for restrictions
- [ ] Disable unavailable options in UI
- [ ] Show restriction messages
- [ ] Test all validation paths

**Day 4-5:** Testing
- [ ] Test preset sizes with restrictions
- [ ] Test custom dimensions
- [ ] Test feasibility edge cases
- [ ] Fix bugs

---

### Week 4: Order Persistence
**Day 1-2:** Order creation API
- [ ] Create `/api/orders/create` endpoint
- [ ] Store configuration snapshot
- [ ] Store feasibility status
- [ ] Generate order number
- [ ] Keep WhatsApp notification

**Day 3-4:** Admin order management
- [ ] Build orders list page
- [ ] Show configuration details
- [ ] Add order status workflow
- [ ] Add feasibility review UI

**Day 5:** Final testing & documentation
- [ ] End-to-end order flow test
- [ ] Backward compatibility test
- [ ] Write admin guide
- [ ] Prepare deployment checklist

---

## TESTING STRATEGY

### Automated Tests (Required Before Deployment)

**Test Suite 1: Backward Compatibility**
```typescript
// tests/backward-compatibility.test.ts

describe('Backward Compatibility', () => {
  it('should handle legacy products with old SizeOption format', () => {
    const legacyProduct = {
      pricing_config: {
        sizes: [
          { name: 'Small', dimensions: '50×30×20 mm', price: 100 }
        ]
      }
    };
    // Should calculate price correctly
  });

  it('should calculate price for legacy product without model_dimensions', () => {
    // Product with NULL model_dimensions should work
  });

  it('should handle products with mixed old/new size formats', () => {
    // Some sizes with dimensions string, some with structuredDimensions
  });
});
```

**Test Suite 2: Dimension Validation**
```typescript
// tests/validation.test.ts

describe('Dimension Validation', () => {
  it('should reject negative dimensions', () => {
    const result = validateDimensions({ height: -10, width: 50, depth: 30 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Height must be greater than 0mm');
  });

  it('should reject unreasonably large dimensions', () => {
    const result = validateDimensions({ height: 600, width: 50, depth: 30 });
    expect(result.valid).toBe(false);
  });

  it('should accept valid dimensions', () => {
    const result = validateDimensions({ height: 50, width: 30, depth: 20 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

**Test Suite 3: A1 Feasibility**
```typescript
// tests/feasibility.test.ts

describe('A1 Feasibility Checks', () => {
  it('should pass for dimensions within A1 envelope', () => {
    const result = checkA1Feasibility({ height: 200, width: 200, depth: 200, unit: 'mm' });
    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(false);
  });

  it('should suggest rotation for tall-narrow models', () => {
    const result = checkA1Feasibility({ height: 260, width: 100, depth: 100, unit: 'mm' });
    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(true);
  });

  it('should mark split-printing candidates', () => {
    const result = checkA1Feasibility({ height: 300, width: 100, depth: 100, unit: 'mm' });
    expect(result.fits_envelope).toBe(false);
    expect(result.can_split).toBe(true);
  });

  it('should reject far-exceeding dimensions', () => {
    const result = checkA1Feasibility({ height: 500, width: 200, depth: 200, unit: 'mm' });
    expect(result.fits_envelope).toBe(false);
    expect(result.can_split).toBe(false);
  });
});
```

**Test Suite 4: Restriction Validation**
```typescript
// tests/restrictions.test.ts

describe('Per-Size Restrictions', () => {
  it('should allow material if not restricted', () => {
    const size = { name: 'Small', supportedMaterials: ['PLA', 'PETG'] };
    const result = validateRestrictions('PLA', undefined, size);
    expect(result.valid).toBe(true);
  });

  it('should reject material if restricted', () => {
    const size = { name: 'Small', supportedMaterials: ['PLA'] };
    const result = validateRestrictions('TPU', undefined, size);
    expect(result.valid).toBe(false);
  });

  it('should allow unrestricted sizes', () => {
    const size = { name: 'Small' }; // No restrictions
    const result = validateRestrictions('TPU', 'Red', size);
    expect(result.valid).toBe(true);
  });
});
```

**Test Suite 5: Order Snapshots**
```typescript
// tests/order-persistence.test.ts

describe('Order Configuration Snapshots', () => {
  it('should store full configuration with order', () => {
    // Create order with preset size
    // Verify configuration JSONB stored
  });

  it('should store custom dimensions with order', () => {
    // Create order with custom size
    // Verify customSize stored in configuration
  });

  it('should store feasibility status', () => {
    // Create order requiring review
    // Verify feasibility_status = 'needs_review'
  });

  it('should generate human-readable configuration text', () => {
    // Verify configuration_text like "Medium (50×30×20mm), PLA, Red, Qty: 5"
  });
});
```

---

## ROLLBACK PROCEDURES

### Scenario 1: Migration Issues
**If migrations fail or cause problems:**

```sql
-- Rollback all MVP migrations
BEGIN;
-- Migration 003 rollback
ALTER TABLE custom_quotes 
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS custom_dimensions,
  DROP COLUMN IF EXISTS feasibility_assessment,
  DROP COLUMN IF EXISTS quote_response;

-- Migration 002 rollback
ALTER TABLE order_items 
  DROP COLUMN IF EXISTS configuration,
  DROP COLUMN IF EXISTS configuration_text,
  DROP COLUMN IF EXISTS feasibility_status,
  DROP COLUMN IF EXISTS feasibility_notes;

-- Migration 001 rollback
ALTER TABLE products 
  DROP COLUMN IF EXISTS model_dimensions,
  DROP COLUMN IF EXISTS a1_feasibility;

COMMIT;
```

**Data Loss:** New product dimensions, order configurations, feasibility assessments  
**Acceptable:** Yes (MVP phase, no critical data)

---

### Scenario 2: Code Rollback
**If TypeScript changes break production:**

1. Revert Git commits:
   ```bash
   git revert <mvp-commit-range>
   ```

2. Old code continues working because:
   - New database columns are nullable
   - Backward compatibility maintained
   - Old pricing logic unchanged

**Data Preservation:** Database columns remain, old code ignores them

---

### Scenario 3: Partial Rollback
**If only one feature needs rollback:**

- Custom dimensions: Remove UI, keep database columns
- Order persistence: Revert to WhatsApp-only, keep order tables
- Restrictions: Remove validation, keep data structure

**Granular rollback possible due to modular design**

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All automated tests pass
- [ ] Backward compatibility tests pass
- [ ] Manual testing complete
- [ ] Migrations reviewed and approved
- [ ] Rollback procedures documented
- [ ] Database backup taken

### Deployment Steps
1. [ ] Take full database backup
2. [ ] Deploy migrations to staging
3. [ ] Run test suite on staging
4. [ ] Manual QA on staging
5. [ ] Deploy migrations to production
6. [ ] Deploy application code
7. [ ] Smoke test production
8. [ ] Monitor error logs (24 hours)

### Post-Deployment
- [ ] Verify existing products unchanged
- [ ] Test new custom dimension flow
- [ ] Test order creation
- [ ] Monitor Supabase logs
- [ ] Check for RLS policy violations
- [ ] Document any issues

---

## REMAINING BLOCKERS

### Before Starting Implementation
1. ⏳ **Approval required** for database migrations 001-003
2. ⏳ **Approval required** for TypeScript type changes
3. ⏳ **Approval required** for 4-week timeline

### Known Limitations (Documented, Not Blockers)
- Feasibility check is bounding-box only (no STL geometry analysis)
- Split-printing feasibility is heuristic (requires admin review)
- Cost calculator not included in MVP (manual pricing continues)
- Payment gateway not included (WhatsApp + manual payment continues)

### Future Enhancements (Post-MVP)
- STL file upload and geometry analysis
- Automated print time estimation
- Volume-based pricing rules
- Customer order status portal
- Automated quote responses

---

## FILES TO BE CHANGED

### Database Migrations (3 files, new)
1. `migrations/001_add_structured_dimensions.sql`
2. `migrations/002_add_order_configuration.sql`
3. `migrations/003_enhance_custom_quotes.sql`

### TypeScript Types (1 file, extend)
4. `types/pricing.ts` - Add new types, preserve old

### Validation Logic (1 file, new)
5. `lib/validation.ts` - New validation functions

### Pricing Logic (1 file, update)
6. `lib/pricing.ts` - Add support for custom dimensions

### API Routes (2 files, new)
7. `app/api/check-feasibility/route.ts` - New endpoint
8. `app/api/orders/create/route.ts` - New endpoint

### Customer UI (2 files, update)
9. `app/product/[id]/page.tsx` - Add custom size input
10. `app/explore/page.tsx` - Update price labels (if needed)

### Admin UI (3 files, update)
11. `app/admin/products/new/page.tsx` - Enhanced size options
12. `app/admin/products/[id]/edit/page.tsx` - Enhanced size options
13. `app/admin/orders/page.tsx` - Build order management

### Tests (5 files, new)
14. `tests/backward-compatibility.test.ts`
15. `tests/validation.test.ts`
16. `tests/feasibility.test.ts`
17. `tests/restrictions.test.ts`
18. `tests/order-persistence.test.ts`

**Total:** ~18 files (3 new migrations, 6 new files, 9 updates)

---

## APPROVAL REQUIRED

Before I proceed with implementation, please review and approve:

### ✅ Database Migrations
- [ ] Migration 001: Add model_dimensions and a1_feasibility
- [ ] Migration 002: Add order configuration tracking
- [ ] Migration 003: Enhance custom quotes
- [ ] Rollback procedures acceptable

### ✅ Type System Changes
- [ ] Enhanced types are backward compatible
- [ ] Old products will continue working
- [ ] New optional fields documented

### ✅ Implementation Approach
- [ ] 4-week MVP timeline acceptable
- [ ] Phased approach (Foundation → Custom Size → Restrictions → Orders)
- [ ] Testing strategy comprehensive

### ✅ Known Limitations
- [ ] Feasibility is bounding-box only (acceptable for MVP)
- [ ] Cost calculator deferred to post-MVP
- [ ] Payment gateway deferred to post-MVP

---

**Status:** ⏳ AWAITING YOUR APPROVAL TO PROCEED  
**Next Step:** Upon approval, begin Week 1 (Database migrations + TypeScript types)

**Note:** No code changes, database changes, or deployments have been made. This is a plan only.
