// ============================================================================
// Validation Tests - Dimension Validation & A1 Feasibility
// ============================================================================
// Test suite for lib/validation.ts
// Run with: npm test tests/validation.test.ts
// ============================================================================

import {
  validateDimensions,
  checkA1Feasibility,
  validateRestrictions,
  validateConfiguration,
  getDimensionsFromConfiguration,
  A1_SPECS,
} from '@/lib/validation';
import type {
  StructuredDimensions,
  SizeOption,
  ProductConfiguration,
  ConfigurablePricingConfig,
} from '@/types/pricing';

// ============================================================================
// Test Suite 1: Dimension Validation
// ============================================================================

describe('validateDimensions', () => {
  test('should accept valid dimensions', () => {
    const result = validateDimensions({
      height: 50,
      width: 30,
      depth: 20,
      unit: 'mm',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject negative dimensions', () => {
    const result = validateDimensions({
      height: -10,
      width: 50,
      depth: 30,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Height must be greater than 0mm');
  });

  test('should reject zero dimensions', () => {
    const result = validateDimensions({
      height: 50,
      width: 0,
      depth: 30,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Width must be greater than 0mm');
  });

  test('should reject dimensions below minimum printable size', () => {
    const result = validateDimensions({
      height: 0.05,  // Less than 0.1mm
      width: 50,
      depth: 30,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('at least 0.1mm');
  });

  test('should reject unreasonably large dimensions', () => {
    const result = validateDimensions({
      height: 600,  // Exceeds 500mm limit
      width: 50,
      depth: 30,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Height cannot exceed 500mm (far beyond A1 capabilities)');
  });

  test('should handle partial dimension validation', () => {
    const result = validateDimensions({
      height: 50,
      // width and depth omitted
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should collect multiple errors', () => {
    const result = validateDimensions({
      height: -10,
      width: 0,
      depth: 600,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Test Suite 2: A1 Feasibility Checks
// ============================================================================

describe('checkA1Feasibility', () => {
  test('should pass for dimensions within A1 envelope (conservative)', () => {
    const dimensions: StructuredDimensions = {
      height: 200,
      width: 200,
      depth: 200,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(false);
    expect(result.can_split).toBe(false);
    expect(result.message).toContain('Fits within A1');
  });

  test('should pass for dimensions at exact limits', () => {
    const dimensions: StructuredDimensions = {
      height: A1_SPECS.USABLE_VOLUME.height,
      width: A1_SPECS.USABLE_VOLUME.width,
      depth: A1_SPECS.USABLE_VOLUME.depth,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(false);
  });

  test('should fit without rotation for dimensions within envelope', () => {
    // 240×100×100 fits as-is (all < 250mm)
    const dimensions: StructuredDimensions = {
      height: 240,
      width: 100,
      depth: 100,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(false);
    expect(result.message).toContain('Fits within A1');
  });

  test('should fit as-is for dimensions within all axes', () => {
    // 240×150×100 all fit within 250mm envelope
    const dimensions: StructuredDimensions = {
      height: 100,
      width: 240,
      depth: 150,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(true);
    expect(result.requires_rotation).toBe(false);
  });

  test('should mark split-printing candidates (exceeds slightly)', () => {
    const dimensions: StructuredDimensions = {
      height: 300,  // Exceeds by 50mm
      width: 100,
      depth: 100,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(false);
    expect(result.can_split).toBe(true);
    expect(result.split_notes).toContain('Exceeds');
    expect(result.message).toContain('parts');
  });

  test('should reject dimensions far exceeding envelope', () => {
    const dimensions: StructuredDimensions = {
      height: 500,  // Far exceeds
      width: 200,
      depth: 200,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions, true);

    expect(result.fits_envelope).toBe(false);
    expect(result.can_split).toBe(false);
    expect(result.message).toContain('Cannot be printed');
  });

  test('should use BUILD_VOLUME when useConservativeVolume is false', () => {
    const dimensions: StructuredDimensions = {
      height: 255,  // Between USABLE (250) and BUILD (256)
      width: 200,
      depth: 200,
      unit: 'mm',
    };

    // Conservative: should fail
    const conservativeResult = checkA1Feasibility(dimensions, true);
    expect(conservativeResult.fits_envelope).toBe(false);

    // Non-conservative: should pass
    const nonConservativeResult = checkA1Feasibility(dimensions, false);
    expect(nonConservativeResult.fits_envelope).toBe(true);
  });

  test('should include validated_at timestamp', () => {
    const dimensions: StructuredDimensions = {
      height: 100,
      width: 100,
      depth: 100,
      unit: 'mm',
    };

    const result = checkA1Feasibility(dimensions);

    expect(result.validated_at).toBeDefined();
    expect(new Date(result.validated_at!).toString()).not.toBe('Invalid Date');
  });
});

// ============================================================================
// Test Suite 3: Per-Size Restriction Validation
// ============================================================================

describe('validateRestrictions', () => {
  test('should allow material if not restricted', () => {
    const sizeOption: SizeOption = {
      name: 'Small',
      price: 100,
      supportedMaterials: ['PLA', 'PETG', 'ABS'],
    };

    const result = validateRestrictions('PLA', undefined, sizeOption);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject unsupported material', () => {
    const sizeOption: SizeOption = {
      name: 'Small',
      price: 100,
      supportedMaterials: ['PLA', 'PETG'],
    };

    const result = validateRestrictions('TPU', undefined, sizeOption);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('TPU');
    expect(result.errors[0]).toContain('not available');
    expect(result.errors[0]).toContain('PLA, PETG');
  });

  test('should reject unsupported color', () => {
    const sizeOption: SizeOption = {
      name: 'Large',
      price: 200,
      supportedColors: ['Black', 'White'],
    };

    const result = validateRestrictions(undefined, 'Red', sizeOption);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Red');
    expect(result.errors[0]).toContain('Black, White');
  });

  test('should allow unrestricted sizes (no supportedMaterials/Colors)', () => {
    const sizeOption: SizeOption = {
      name: 'Medium',
      price: 150,
      // No restrictions
    };

    const result = validateRestrictions('TPU', 'Rainbow', sizeOption);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should allow if restrictions array is empty', () => {
    const sizeOption: SizeOption = {
      name: 'Small',
      price: 100,
      supportedMaterials: [],  // Empty = all allowed
    };

    const result = validateRestrictions('AnyMaterial', undefined, sizeOption);

    expect(result.valid).toBe(true);
  });

  test('should check both material and color restrictions', () => {
    const sizeOption: SizeOption = {
      name: 'XL',
      price: 300,
      supportedMaterials: ['PLA'],
      supportedColors: ['Black'],
    };

    const result = validateRestrictions('PETG', 'Red', sizeOption);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]).toContain('PETG');
    expect(result.errors[1]).toContain('Red');
  });
});

// ============================================================================
// Test Suite 4: Configuration Validation (Backward Compatibility)
// ============================================================================

describe('validateConfiguration - Backward Compatibility', () => {
  test('should validate legacy product with old SizeOption format', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      materialIndex: 0,
      colorIndex: 0,
      quantity: 5,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Small',
          dimensions: '50×30×20 mm',  // OLD FORMAT (string)
          price: 100,
        },
      ],
      materials: [{ name: 'PLA', priceAdjustment: 0 }],
      colors: [{ name: 'Red', additionalCharge: 0 }],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate new product with structuredDimensions', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Medium',
          structuredDimensions: {
            height: 100,
            width: 80,
            depth: 60,
            unit: 'mm',
          },
          price: 150,
        },
      ],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
  });

  test('should handle mixed old/new size formats', () => {
    const config: ProductConfiguration = {
      sizeIndex: 1,
      quantity: 2,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Small',
          dimensions: '30×20×10 mm',  // OLD
          price: 80,
        },
        {
          name: 'Large',
          structuredDimensions: {    // NEW
            height: 150,
            width: 100,
            depth: 80,
            unit: 'mm',
          },
          price: 200,
        },
      ],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Test Suite 5: Configuration Validation (Custom Dimensions)
// ============================================================================

describe('validateConfiguration - Custom Dimensions', () => {
  test('should accept valid custom dimensions', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 120,
        width: 80,
        depth: 50,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: true,
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
  });

  test('should reject custom dimensions if not allowed', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 120,
        width: 80,
        depth: 50,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: false,  // NOT ALLOWED
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not allowed');
  });

  test('should enforce custom dimension limits', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 300,  // Exceeds limit
        width: 80,
        depth: 50,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: true,
      customDimensionLimits: {
        maxHeight: 200,
        maxWidth: 200,
        maxDepth: 200,
      },
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('300mm');
    expect(result.errors[0]).toContain('maximum 200mm');
  });

  test('should check A1 feasibility for custom dimensions', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 500,  // Far exceeds A1
        width: 100,
        depth: 100,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: true,
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceed');
  });

  test('should allow custom dimensions within A1 envelope', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 200,
        width: 150,
        depth: 100,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: true,
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Test Suite 6: Configuration Validation (Restrictions)
// ============================================================================

describe('validateConfiguration - Restrictions', () => {
  test('should enforce per-size material restrictions', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      materialIndex: 1,  // Selecting PETG
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'XL',
          price: 300,
          supportedMaterials: ['PLA'],  // Only PLA allowed
        },
      ],
      materials: [
        { name: 'PLA', priceAdjustment: 0 },
        { name: 'PETG', priceAdjustment: 10 },
      ],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('PETG');
    expect(result.errors[0]).toContain('not available');
  });

  test('should allow material if within restrictions', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      materialIndex: 0,  // Selecting PLA
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Large',
          price: 200,
          supportedMaterials: ['PLA', 'ABS'],
        },
      ],
      materials: [
        { name: 'PLA', priceAdjustment: 0 },
      ],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Test Suite 7: Edge Cases & Invalid Inputs
// ============================================================================

describe('validateConfiguration - Edge Cases', () => {
  test('should reject invalid quantity (negative)', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      quantity: -1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [{ name: 'Small', price: 80 }],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('at least 1');
  });

  test('should reject invalid quantity (decimal)', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      quantity: 2.5,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [{ name: 'Medium', price: 100 }],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('whole number');
  });

  test('should reject out-of-bounds size index', () => {
    const config: ProductConfiguration = {
      sizeIndex: 5,  // Out of bounds
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        { name: 'Small', price: 80 },
        { name: 'Large', price: 120 },
      ],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid size');
  });

  test('should require size selection if sizes available', () => {
    const config: ProductConfiguration = {
      quantity: 1,
      // No sizeIndex or customSize
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [{ name: 'Standard', price: 100 }],
    };

    const result = validateConfiguration(config, pricingConfig);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('select a size');
  });
});

// ============================================================================
// Test Suite 8: Helper Functions
// ============================================================================

describe('getDimensionsFromConfiguration', () => {
  test('should return custom dimensions if provided', () => {
    const config: ProductConfiguration = {
      customSize: {
        height: 120,
        width: 80,
        depth: 50,
        unit: 'mm',
      },
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      allowCustomDimensions: true,
    };

    const dimensions = getDimensionsFromConfiguration(config, pricingConfig);

    expect(dimensions).toEqual(config.customSize);
  });

  test('should return structured dimensions from preset size', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      quantity: 1,
    };

    const expectedDimensions: StructuredDimensions = {
      height: 100,
      width: 80,
      depth: 60,
      unit: 'mm',
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Medium',
          structuredDimensions: expectedDimensions,
          price: 150,
        },
      ],
    };

    const dimensions = getDimensionsFromConfiguration(config, pricingConfig);

    expect(dimensions).toEqual(expectedDimensions);
  });

  test('should return null for old format dimensions string', () => {
    const config: ProductConfiguration = {
      sizeIndex: 0,
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
      sizes: [
        {
          name: 'Small',
          dimensions: '50×30×20 mm',  // OLD FORMAT
          price: 100,
        },
      ],
    };

    const dimensions = getDimensionsFromConfiguration(config, pricingConfig);

    expect(dimensions).toBeNull();
  });

  test('should return null if no dimensions available', () => {
    const config: ProductConfiguration = {
      quantity: 1,
    };

    const pricingConfig: ConfigurablePricingConfig = {
      basePrice: 100,
    };

    const dimensions = getDimensionsFromConfiguration(config, pricingConfig);

    expect(dimensions).toBeNull();
  });
});
