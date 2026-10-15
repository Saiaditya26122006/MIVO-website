// ============================================================================
// MIVO - Dimension Validation & A1 Feasibility Checks
// ============================================================================
// Purpose: Validate customer inputs and check Bambu Lab A1 feasibility
// IMPORTANT: Feasibility checks are preliminary bounding-box analysis only
// Does NOT guarantee printability (no geometry/overhang/support analysis)
// ============================================================================

import type {
  StructuredDimensions,
  A1Feasibility,
  SizeOption,
  ProductConfiguration,
  ConfigurablePricingConfig,
} from '@/types/pricing';

// ============================================================================
// Bambu Lab A1 Specifications
// ============================================================================

/**
 * Bambu Lab A1 3D Printer Specifications
 * Source: Official Bambu Lab documentation
 */
export const A1_SPECS = {
  /**
   * Maximum build volume (advertised specs)
   * Height × Width × Depth in millimeters
   */
  BUILD_VOLUME: {
    height: 256,  // mm (Z-axis)
    width: 256,   // mm (X-axis)
    depth: 256,   // mm (Y-axis)
  },

  /**
   * Conservative usable volume (practical limits)
   * Accounts for:
   * - Build plate clips (reduce Z by ~6mm)
   * - Purge tower space for multi-color (reduce X/Y by ~6mm)
   * - Safety margins
   */
  USABLE_VOLUME: {
    height: 250,  // mm
    width: 250,   // mm
    depth: 250,   // mm
  },

  /**
   * Layer height limits
   */
  MAX_LAYER_HEIGHT: 0.28,  // mm
  MIN_LAYER_HEIGHT: 0.08,  // mm

  /**
   * Split-printing heuristic threshold
   * If dimension exceeds envelope by less than this, consider splitting
   */
  SPLIT_THRESHOLD_MM: 100,
} as const;

// ============================================================================
// Dimension Validation
// ============================================================================

/**
 * Validation result for dimensions
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate dimension values
 * Checks: positive values, reasonable limits, minimum sizes
 *
 * @param dimensions - Partial or complete dimensions to validate
 * @returns Validation result with errors if any
 */
export function validateDimensions(
  dimensions: Partial<StructuredDimensions>
): ValidationResult {
  const errors: string[] = [];

  // Validate height
  if (dimensions.height !== undefined) {
    if (!Number.isFinite(dimensions.height)) {
      errors.push('Height must be a valid number');
    } else if (dimensions.height <= 0) {
      errors.push('Height must be greater than 0mm');
    } else if (dimensions.height < 0.1) {
      errors.push('Height must be at least 0.1mm (too thin to print reliably)');
    } else if (dimensions.height > 500) {
      errors.push('Height cannot exceed 500mm (far beyond A1 capabilities)');
    }
  }

  // Validate width
  if (dimensions.width !== undefined) {
    if (!Number.isFinite(dimensions.width)) {
      errors.push('Width must be a valid number');
    } else if (dimensions.width <= 0) {
      errors.push('Width must be greater than 0mm');
    } else if (dimensions.width < 0.1) {
      errors.push('Width must be at least 0.1mm');
    } else if (dimensions.width > 500) {
      errors.push('Width cannot exceed 500mm');
    }
  }

  // Validate depth
  if (dimensions.depth !== undefined) {
    if (!Number.isFinite(dimensions.depth)) {
      errors.push('Depth must be a valid number');
    } else if (dimensions.depth <= 0) {
      errors.push('Depth must be greater than 0mm');
    } else if (dimensions.depth < 0.1) {
      errors.push('Depth must be at least 0.1mm');
    } else if (dimensions.depth > 500) {
      errors.push('Depth cannot exceed 500mm');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// A1 Feasibility Checks
// ============================================================================

/**
 * Check if dimensions fit within Bambu Lab A1 build volume
 *
 * IMPORTANT: This is a preliminary bounding-box check only.
 * It does NOT guarantee printability. Factors not checked:
 * - Model geometry (overhangs, bridges, need for supports)
 * - Orientation optimization for strength/surface finish
 * - Material-specific requirements (flex materials need different approach)
 * - Multi-part assembly feasibility for split prints
 * - Actual STL geometry and internal structures
 *
 * This check categorizes requests into:
 * 1. Fits envelope → can proceed with instant pricing
 * 2. Might fit with rotation → can proceed with instant pricing
 * 3. Exceeds but splittable → requires manual review and quote
 * 4. Far exceeds → cannot offer
 *
 * @param dimensions - Dimensions to check
 * @param useConservativeVolume - Use USABLE_VOLUME (true) or BUILD_VOLUME (false)
 * @returns Feasibility result with recommendations
 */
export function checkA1Feasibility(
  dimensions: StructuredDimensions,
  useConservativeVolume = true
): A1Feasibility & { message: string } {
  const volume = useConservativeVolume
    ? A1_SPECS.USABLE_VOLUME
    : A1_SPECS.BUILD_VOLUME;

  const { height, width, depth } = dimensions;

  // ========================================================================
  // Check 1: Fits in current orientation (as-is)
  // ========================================================================

  const fitsAsIs =
    height <= volume.height &&
    width <= volume.width &&
    depth <= volume.depth;

  if (fitsAsIs) {
    return {
      fits_envelope: true,
      requires_rotation: false,
      can_split: false,
      validated_at: new Date().toISOString(),
      message: `Fits within A1 build volume (${volume.height}×${volume.width}×${volume.depth} mm). Ready to print.`,
    };
  }

  // ========================================================================
  // Check 2: Fits with rotation (try all 6 orientations)
  // ========================================================================

  // Sort dimensions to find optimal orientation
  const allDimensions = [height, width, depth];
  allDimensions.sort((a, b) => a - b); // Ascending order
  const [smallest, middle, largest] = allDimensions;

  // Try fitting: smallest in Z, middle in Y, largest in X
  // (Common orientation for tall objects)
  const fitsWithRotation =
    smallest <= volume.depth &&
    middle <= volume.width &&
    largest <= volume.height;

  if (fitsWithRotation) {
    return {
      fits_envelope: true,
      requires_rotation: true,
      can_split: false,
      validated_at: new Date().toISOString(),
      message: `Fits with rotation. Recommended orientation: ${largest}×${middle}×${smallest} mm (H×W×D). Ready to print.`,
    };
  }

  // ========================================================================
  // Check 3: Exceeds envelope - evaluate split-printing potential
  // ========================================================================

  const maxDimension = Math.max(height, width, depth);
  const exceedsByAmount = maxDimension - volume.height;

  // Heuristic: If exceeds by less than SPLIT_THRESHOLD_MM, might be splittable
  // Requires admin review to confirm geometry allows splitting
  const mightSplit =
    exceedsByAmount > 0 &&
    exceedsByAmount <= A1_SPECS.SPLIT_THRESHOLD_MM;

  if (mightSplit) {
    const estimatedParts = Math.ceil(maxDimension / volume.height);
    return {
      fits_envelope: false,
      requires_rotation: false,
      can_split: true,
      split_notes: `Exceeds A1 envelope by ${exceedsByAmount.toFixed(0)}mm. Estimated ${estimatedParts} parts if geometry permits splitting.`,
      validated_at: new Date().toISOString(),
      message: `Exceeds A1 build volume. May be printable in ${estimatedParts} parts (requires quote and feasibility review).`,
    };
  }

  // ========================================================================
  // Check 4: Far exceeds - not feasible
  // ========================================================================

  return {
    fits_envelope: false,
    requires_rotation: false,
    can_split: false,
    split_notes: `Exceeds A1 envelope by ${exceedsByAmount.toFixed(0)}mm. Too large for split-printing on A1.`,
    validated_at: new Date().toISOString(),
    message: `Cannot be printed on Bambu Lab A1. Maximum dimension: ${maxDimension.toFixed(0)}mm, A1 limit: ${volume.height}mm. Consider redesigning or requesting custom manufacturing quote.`,
  };
}

// ============================================================================
// Per-Size Restriction Validation
// ============================================================================

/**
 * Validate material and color selections against per-size restrictions
 *
 * @param selectedMaterial - Material name selected by customer
 * @param selectedColor - Color name selected by customer
 * @param sizeOption - Size option with potential restrictions
 * @returns Validation result with restriction errors if any
 */
export function validateRestrictions(
  selectedMaterial: string | undefined,
  selectedColor: string | undefined,
  sizeOption: SizeOption
): ValidationResult {
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
        `Available materials: ${sizeOption.supportedMaterials.join(', ')}`
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
        `Available colors: ${sizeOption.supportedColors.join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Configuration Validation (Enhanced)
// ============================================================================

/**
 * Validate complete product configuration
 * Includes: quantity, size selection, material/color restrictions, custom dimensions
 *
 * @param config - Customer's product configuration
 * @param pricingConfig - Product's pricing configuration
 * @returns Validation result with all errors
 */
export function validateConfiguration(
  config: ProductConfiguration,
  pricingConfig: ConfigurablePricingConfig
): ValidationResult {
  const errors: string[] = [];

  // Validate quantity
  if (config.quantity < 1) {
    errors.push('Quantity must be at least 1');
  }
  if (!Number.isInteger(config.quantity)) {
    errors.push('Quantity must be a whole number');
  }

  // Case 1: Preset size selected
  if (config.sizeIndex !== undefined) {
    const sizes = pricingConfig.sizes || [];

    if (config.sizeIndex < 0 || config.sizeIndex >= sizes.length) {
      errors.push(`Invalid size selection (index ${config.sizeIndex})`);
      return { valid: false, errors };
    }

    const selectedSize = sizes[config.sizeIndex];

    // Get selected material and color names
    const selectedMaterial = config.materialIndex !== undefined
      ? pricingConfig.materials?.[config.materialIndex]?.name
      : undefined;

    const selectedColor = config.colorIndex !== undefined
      ? pricingConfig.colors?.[config.colorIndex]?.name
      : undefined;

    // Validate restrictions
    const restrictionResult = validateRestrictions(
      selectedMaterial,
      selectedColor,
      selectedSize
    );

    if (!restrictionResult.valid) {
      errors.push(...restrictionResult.errors);
    }
  }

  // Case 2: Custom size provided
  if (config.customSize) {
    // Check if custom dimensions are allowed
    if (!pricingConfig.allowCustomDimensions) {
      errors.push('Custom dimensions are not allowed for this product');
      return { valid: false, errors };
    }

    // Validate dimension values
    const dimensionValidation = validateDimensions(config.customSize);
    if (!dimensionValidation.valid) {
      errors.push(...dimensionValidation.errors);
      return { valid: false, errors };
    }

    // Check against custom dimension limits (if specified)
    if (pricingConfig.customDimensionLimits) {
      const limits = pricingConfig.customDimensionLimits;

      if (config.customSize.height > limits.maxHeight) {
        errors.push(`Height ${config.customSize.height}mm exceeds maximum ${limits.maxHeight}mm`);
      }
      if (config.customSize.width > limits.maxWidth) {
        errors.push(`Width ${config.customSize.width}mm exceeds maximum ${limits.maxWidth}mm`);
      }
      if (config.customSize.depth > limits.maxDepth) {
        errors.push(`Depth ${config.customSize.depth}mm exceeds maximum ${limits.maxDepth}mm`);
      }
    }

    // Check A1 feasibility
    const feasibility = checkA1Feasibility(config.customSize);

    if (!feasibility.fits_envelope && !feasibility.can_split) {
      errors.push(`Dimensions exceed A1 capabilities: ${feasibility.message}`);
    }
  }

  // Case 3: Neither preset nor custom size
  if (config.sizeIndex === undefined && !config.customSize) {
    const hasSizes = pricingConfig.sizes && pricingConfig.sizes.length > 0;
    const allowsCustom = pricingConfig.allowCustomDimensions;

    if (hasSizes || allowsCustom) {
      errors.push('Please select a size or enter custom dimensions');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Helper: Get Dimensions from Configuration
// ============================================================================

/**
 * Extract dimensions from a product configuration
 * Handles both preset sizes and custom dimensions
 *
 * @param config - Product configuration
 * @param pricingConfig - Product pricing config (for preset sizes)
 * @returns Structured dimensions or null if not determinable
 */
export function getDimensionsFromConfiguration(
  config: ProductConfiguration,
  pricingConfig: ConfigurablePricingConfig
): StructuredDimensions | null {
  // Custom size provided
  if (config.customSize) {
    return config.customSize;
  }

  // Preset size selected
  if (config.sizeIndex !== undefined) {
    const sizes = pricingConfig.sizes || [];
    const selectedSize = sizes[config.sizeIndex];

    if (selectedSize?.structuredDimensions) {
      return selectedSize.structuredDimensions;
    }

    // Old format: try to parse dimensions string
    // Format: "50×30×20 mm" or "10×5×3 cm"
    if (selectedSize?.dimensions) {
      // Simple parsing (optional enhancement)
      // For MVP, return null and require manual feasibility check
      return null;
    }
  }

  return null;
}
