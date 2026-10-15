// MIVO Pricing Types
// Enhanced for MVP: Structured dimensions, A1 feasibility, custom sizes
// Maintains full backward compatibility with existing products

export type PricingMethod = 'fixed' | 'configurable' | 'quote';

// ============================================================================
// NEW: Structured Dimensions (MVP)
// ============================================================================

/**
 * Structured dimensions in millimeters
 * Replaces free-text dimensions string with validated numeric format
 */
export interface StructuredDimensions {
  height: number;  // in mm
  width: number;   // in mm
  depth: number;   // in mm
  unit: 'mm';      // fixed unit for consistency
}

// ============================================================================
// NEW: A1 Feasibility Data (MVP)
// ============================================================================

/**
 * Bambu Lab A1 feasibility assessment
 * IMPORTANT: This is a preliminary bounding-box check only.
 * Does NOT guarantee printability (no geometry/overhang/support analysis)
 */
export interface A1Feasibility {
  fits_envelope: boolean;        // True if dimensions fit within A1 build volume
  requires_rotation: boolean;    // True if rotation needed to fit
  can_split: boolean;            // True if might be splittable (requires admin review)
  split_notes?: string;          // Details about potential splitting
  validated_at?: string;         // ISO timestamp of when feasibility was checked
}

// ============================================================================
// ENHANCED: Size Options (Backward Compatible)
// ============================================================================

/**
 * Size option for configurable products
 * BACKWARD COMPATIBLE: Supports both old (dimensions string) and new (structuredDimensions)
 */
export interface SizeOption {
  name: string;

  // DEPRECATED but still supported: Free-text dimensions
  // e.g., "50×30×20 mm" or "10×5×3 cm"
  // Kept for backward compatibility with existing products
  dimensions?: string;

  // NEW: Structured dimensions (preferred for new products)
  // Use this instead of dimensions string
  structuredDimensions?: StructuredDimensions;

  price: number; // Final price for this size

  // NEW: Per-size material restrictions
  // If specified, only these materials are available for this size
  // Empty array or undefined = all materials supported
  supportedMaterials?: string[];

  // NEW: Per-size color restrictions
  // If specified, only these colors are available for this size
  // Empty array or undefined = all colors supported
  supportedColors?: string[];

  // NEW: A1 feasibility for this size
  // Populated when admin validates size against A1 specs
  a1Feasibility?: A1Feasibility;
}

export interface MaterialOption {
  name: string;
  priceAdjustment: number; // Added to base/size price
}

export interface ColorOption {
  name: string;
  additionalCharge: number; // Added to final price
}

// ============================================================================
// Pricing Configurations
// ============================================================================

export interface FixedPricingConfig {
  basePrice: number;
}

export interface ConfigurablePricingConfig {
  basePrice: number;
  sizes?: SizeOption[];
  materials?: MaterialOption[];
  colors?: ColorOption[];

  // NEW: Allow custom dimensions?
  // If true, customer can enter custom dimensions instead of selecting preset size
  allowCustomDimensions?: boolean;

  // NEW: Custom dimension limits (if allowed)
  // Enforced before A1 feasibility check
  customDimensionLimits?: {
    maxHeight: number;  // in mm
    maxWidth: number;   // in mm
    maxDepth: number;   // in mm
  };
}

export interface QuotePricingConfig {
  requiredInfo?: string[]; // e.g., ['dimensions', 'quantity', 'material']
  referencePhotosRequired?: boolean;
}

export type PricingConfig =
  | FixedPricingConfig
  | ConfigurablePricingConfig
  | QuotePricingConfig;

// ============================================================================
// ENHANCED: Product Configuration (Backward Compatible)
// ============================================================================

/**
 * Customer's product configuration
 * BACKWARD COMPATIBLE: Existing fields unchanged, custom size added
 */
export interface ProductConfiguration {
  // EXISTING FIELDS (unchanged)
  sizeIndex?: number;      // Index into sizes array (for preset sizes)
  materialIndex?: number;  // Index into materials array
  colorIndex?: number;     // Index into colors array
  quantity: number;

  // NEW: Custom dimensions (optional)
  // Used when customer enters custom size instead of selecting preset
  customSize?: StructuredDimensions;

  // NEW: Customer acknowledgment for split-printing
  // Required if feasibility check indicates splitting may be needed
  acknowledgesSplitPrinting?: boolean;
}

// ============================================================================
// ENHANCED: Price Breakdown (Backward Compatible)
// ============================================================================

/**
 * Detailed price calculation breakdown
 * BACKWARD COMPATIBLE: Existing fields unchanged, feasibility info added
 */
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

  // NEW: Feasibility information (optional)
  // Populated after A1 feasibility check
  feasibility?: {
    status: 'fits' | 'requires_review' | 'not_feasible';
    message?: string;
  };
}

// ============================================================================
// ENHANCED: Product (Backward Compatible)
// ============================================================================

/**
 * Product model
 * BACKWARD COMPATIBLE: New fields are optional (NULL for legacy products)
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  long_description?: string;
  price: number; // Legacy field, kept for backward compatibility
  category: string;
  images: string[];
  in_stock: boolean;
  featured: boolean;
  published: boolean;
  specifications: Record<string, any>;
  tags?: string[];

  // Pricing fields
  pricing_method: PricingMethod;
  pricing_config: PricingConfig;
  production_time_days?: number;
  min_quantity: number;
  max_quantity: number;

  // NEW: Structured dimensions (optional, NULL for legacy products)
  // Represents the model's actual dimensions
  model_dimensions?: StructuredDimensions | null;

  // NEW: A1 feasibility (optional, NULL for legacy products)
  // Pre-computed feasibility for the base model
  a1_feasibility?: A1Feasibility | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// NEW: Feasibility Check Types (MVP)
// ============================================================================

/**
 * Request to check A1 feasibility for a configuration
 */
export interface FeasibilityCheckRequest {
  productId: string;
  configuration: ProductConfiguration;
}

/**
 * Result of A1 feasibility check
 * IMPORTANT: This is a bounding-box check only, not a printability guarantee
 */
export interface FeasibilityCheckResult {
  feasible: boolean;              // Overall: can we proceed?
  fits_a1_envelope: boolean;      // Does it fit in 256×256×256mm?
  exceeds_dimension?: 'height' | 'width' | 'depth';  // Which dimension is too large?
  max_allowed?: number;           // Maximum allowed value (in mm)
  requested?: number;             // Requested value (in mm)
  can_split?: boolean;            // Might be splittable? (requires admin review)
  split_recommendation?: string;  // How to split (if applicable)
  requires_quote: boolean;        // Should customer request quote instead?
  message: string;                // User-facing message
}

// ============================================================================
// NEW: Order Configuration Snapshot (MVP)
// ============================================================================

/**
 * Complete snapshot of order item configuration
 * Stored with order_items to preserve exact configuration at order time
 */
export interface OrderConfigurationSnapshot {
  product_id: string;
  product_name: string;
  configuration: ProductConfiguration;
  price_breakdown: PriceBreakdown;
  feasibility_status: 'validated' | 'needs_review' | 'requires_quote';
  feasibility_notes?: string;
  ordered_at: string;  // ISO timestamp
}
