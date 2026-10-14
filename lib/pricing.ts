// MIVO Pricing Calculation Library

import type {
  PricingMethod,
  ConfigurablePricingConfig,
  ProductConfiguration,
  PriceBreakdown,
  Product,
} from '@/types/pricing';

/**
 * Calculate the final price for a product configuration
 * This function is used on both client and server to ensure consistency
 */
export function calculatePrice(
  product: Product,
  config: ProductConfiguration
): PriceBreakdown | null {
  if (product.pricing_method === 'fixed') {
    const pricing = product.pricing_config as { basePrice: number };
    const unitPrice = pricing.basePrice || product.price;

    return {
      basePrice: unitPrice,
      quantity: config.quantity,
      unitPrice,
      total: unitPrice * config.quantity,
      details: {},
    };
  }

  if (product.pricing_method === 'configurable') {
    const pricing = product.pricing_config as ConfigurablePricingConfig;

    // Start with base price
    let unitPrice = pricing.basePrice || product.price;
    const details: { size?: string; material?: string; color?: string } = {};
    let materialAdjustment = 0;
    let colorCharge = 0;
    let sizePrice: number | undefined;

    // Apply size pricing if available
    if (
      pricing.sizes &&
      pricing.sizes.length > 0 &&
      config.sizeIndex !== undefined &&
      pricing.sizes[config.sizeIndex]
    ) {
      const selectedSize = pricing.sizes[config.sizeIndex];
      sizePrice = selectedSize.price;
      unitPrice = selectedSize.price; // Size replaces base price
      details.size = `${selectedSize.name} (${selectedSize.dimensions})`;
    }

    // Apply material adjustment
    if (
      pricing.materials &&
      pricing.materials.length > 0 &&
      config.materialIndex !== undefined &&
      pricing.materials[config.materialIndex]
    ) {
      const selectedMaterial = pricing.materials[config.materialIndex];
      materialAdjustment = selectedMaterial.priceAdjustment;
      unitPrice += materialAdjustment;
      details.material = selectedMaterial.name;
    }

    // Apply color charge
    if (
      pricing.colors &&
      pricing.colors.length > 0 &&
      config.colorIndex !== undefined &&
      pricing.colors[config.colorIndex]
    ) {
      const selectedColor = pricing.colors[config.colorIndex];
      colorCharge = selectedColor.additionalCharge;
      unitPrice += colorCharge;
      details.color = selectedColor.name;
    }

    // Ensure price is not negative
    unitPrice = Math.max(0, unitPrice);

    return {
      basePrice: pricing.basePrice || product.price,
      sizePrice,
      materialAdjustment,
      colorCharge,
      quantity: config.quantity,
      unitPrice,
      total: unitPrice * config.quantity,
      details,
    };
  }

  // Quote-based products don't have calculable prices
  if (product.pricing_method === 'quote') {
    return null;
  }

  return null;
}

/**
 * Validate a product configuration
 */
export function validateConfiguration(
  product: Product,
  config: ProductConfiguration
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate quantity
  if (config.quantity < product.min_quantity) {
    errors.push(`Minimum quantity is ${product.min_quantity}`);
  }

  if (config.quantity > product.max_quantity) {
    errors.push(`Maximum quantity is ${product.max_quantity}`);
  }

  if (config.quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (product.pricing_method === 'configurable') {
    const pricing = product.pricing_config as ConfigurablePricingConfig;

    // Validate size selection
    if (pricing.sizes && pricing.sizes.length > 0) {
      if (config.sizeIndex === undefined) {
        errors.push('Please select a size');
      } else if (
        config.sizeIndex < 0 ||
        config.sizeIndex >= pricing.sizes.length
      ) {
        errors.push('Invalid size selection');
      }
    }

    // Validate material selection
    if (pricing.materials && pricing.materials.length > 0) {
      if (config.materialIndex === undefined) {
        errors.push('Please select a material');
      } else if (
        config.materialIndex < 0 ||
        config.materialIndex >= pricing.materials.length
      ) {
        errors.push('Invalid material selection');
      }
    }

    // Validate color selection
    if (pricing.colors && pricing.colors.length > 0) {
      if (config.colorIndex === undefined) {
        errors.push('Please select a color');
      } else if (
        config.colorIndex < 0 ||
        config.colorIndex >= pricing.colors.length
      ) {
        errors.push('Invalid color selection');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the display price label for a product (for catalog view)
 */
export function getPriceLabel(product: Product): string {
  if (product.pricing_method === 'fixed') {
    const pricing = product.pricing_config as { basePrice: number };
    const price = pricing.basePrice || product.price;
    return `₹${price.toFixed(0)}`;
  }

  if (product.pricing_method === 'configurable') {
    const pricing = product.pricing_config as ConfigurablePricingConfig;
    const basePrice = pricing.basePrice || product.price;
    return `Starting from ₹${basePrice.toFixed(0)}`;
  }

  if (product.pricing_method === 'quote') {
    return 'Request a Quote';
  }

  return `₹${product.price.toFixed(0)}`;
}

/**
 * Get the minimum configurable price for a product
 */
export function getMinimumPrice(product: Product): number {
  if (product.pricing_method === 'fixed') {
    const pricing = product.pricing_config as { basePrice: number };
    return pricing.basePrice || product.price;
  }

  if (product.pricing_method === 'configurable') {
    const pricing = product.pricing_config as ConfigurablePricingConfig;
    let minPrice = pricing.basePrice || product.price;

    // If sizes are configured, use the minimum size price
    if (pricing.sizes && pricing.sizes.length > 0) {
      const sizePrices = pricing.sizes.map((s) => s.price);
      minPrice = Math.min(...sizePrices);
    }

    // Materials and colors only add to the price, so we don't consider them for minimum

    return minPrice;
  }

  return product.price;
}

/**
 * Format a price breakdown for display
 */
export function formatPriceBreakdown(breakdown: PriceBreakdown): string {
  const lines: string[] = [];

  if (breakdown.details.size) {
    lines.push(`Size: ${breakdown.details.size} - ₹${breakdown.sizePrice || breakdown.basePrice}`);
  } else {
    lines.push(`Base price: ₹${breakdown.basePrice}`);
  }

  if (breakdown.materialAdjustment && breakdown.materialAdjustment !== 0) {
    lines.push(`Material (${breakdown.details.material}): +₹${breakdown.materialAdjustment}`);
  } else if (breakdown.details.material) {
    lines.push(`Material: ${breakdown.details.material}`);
  }

  if (breakdown.colorCharge && breakdown.colorCharge !== 0) {
    lines.push(`Color (${breakdown.details.color}): +₹${breakdown.colorCharge}`);
  } else if (breakdown.details.color) {
    lines.push(`Color: ${breakdown.details.color}`);
  }

  lines.push(`Quantity: ${breakdown.quantity}`);
  lines.push(`Unit price: ₹${breakdown.unitPrice.toFixed(2)}`);
  lines.push(`Total: ₹${breakdown.total.toFixed(2)}`);

  return lines.join('\n');
}
