// API Route: Calculate and validate product price
// POST /api/calculate-price
// IMPORTANT: Server-side validation - never trust client calculations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculatePrice } from '@/lib/pricing';
import {
  validateConfiguration,
  validateDimensions,
  checkA1Feasibility,
} from '@/lib/validation';
import type {
  Product,
  ProductConfiguration,
  ConfigurablePricingConfig,
} from '@/types/pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, configuration } = body as {
      productId: string;
      configuration: ProductConfiguration;
    };

    if (!productId || !configuration) {
      return NextResponse.json(
        { error: 'Missing productId or configuration' },
        { status: 400 }
      );
    }

    // Fetch product from database
    const supabase = await createClient();
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('published', true)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const typedProduct = product as unknown as Product;

    // Server-side validation (NEVER trust client-side calculations)
    if (typedProduct.pricing_method === 'configurable') {
      const pricingConfig = typedProduct.pricing_config as ConfigurablePricingConfig;

      // Validate configuration with enhanced validation (dimensions, restrictions, feasibility)
      const validation = validateConfiguration(configuration, pricingConfig);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid configuration',
            validationErrors: validation.errors,
          },
          { status: 400 }
        );
      }

      // Additional validation for custom dimensions
      if (configuration.customSize) {
        // Check if custom dimensions are allowed
        if (!pricingConfig.allowCustomDimensions) {
          return NextResponse.json(
            {
              error: 'Custom dimensions not allowed',
              validationErrors: ['This product does not support custom dimensions'],
            },
            { status: 400 }
          );
        }

        // Validate dimension values (NaN, Infinity, negative, zero, excessively large)
        const dimensionValidation = validateDimensions(configuration.customSize);
        if (!dimensionValidation.valid) {
          return NextResponse.json(
            {
              error: 'Invalid dimensions',
              validationErrors: dimensionValidation.errors,
            },
            { status: 400 }
          );
        }

        // Check A1 feasibility (preliminary bounding-box check only)
        // IMPORTANT: This does NOT guarantee printability
        const feasibility = checkA1Feasibility(configuration.customSize);

        if (!feasibility.fits_envelope) {
          if (feasibility.can_split) {
            // Requires manual review and quote
            return NextResponse.json(
              {
                error: 'Dimensions require manual review',
                message: feasibility.message,
                requiresQuote: true,
                feasibility: {
                  fits_envelope: false,
                  can_split: true,
                  split_notes: feasibility.split_notes,
                },
              },
              { status: 400 }
            );
          } else {
            // Not feasible on A1
            return NextResponse.json(
              {
                error: 'Dimensions exceed A1 capabilities',
                message: feasibility.message,
                requiresQuote: false,
                feasibility: {
                  fits_envelope: false,
                  can_split: false,
                },
              },
              { status: 400 }
            );
          }
        }

        // If fits envelope, include feasibility info in response
        // (but do NOT claim this guarantees printability)
      }
    } else if (typedProduct.pricing_method === 'fixed') {
      // Validate quantity for fixed pricing
      if (!configuration.quantity || configuration.quantity < 1) {
        return NextResponse.json(
          {
            error: 'Invalid quantity',
            validationErrors: ['Quantity must be at least 1'],
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(configuration.quantity) || !Number.isInteger(configuration.quantity)) {
        return NextResponse.json(
          {
            error: 'Invalid quantity',
            validationErrors: ['Quantity must be a valid whole number'],
          },
          { status: 400 }
        );
      }

      if (configuration.quantity < typedProduct.min_quantity) {
        return NextResponse.json(
          {
            error: 'Quantity below minimum',
            validationErrors: [`Minimum quantity is ${typedProduct.min_quantity}`],
          },
          { status: 400 }
        );
      }

      if (configuration.quantity > typedProduct.max_quantity) {
        return NextResponse.json(
          {
            error: 'Quantity exceeds maximum',
            validationErrors: [`Maximum quantity is ${typedProduct.max_quantity}`],
          },
          { status: 400 }
        );
      }
    }

    // Calculate price (server-side calculation is authoritative)
    const priceBreakdown = calculatePrice(typedProduct, configuration);

    if (!priceBreakdown) {
      return NextResponse.json(
        { error: 'Unable to calculate price for this product' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      priceBreakdown,
      product: {
        id: typedProduct.id,
        name: typedProduct.name,
        pricing_method: typedProduct.pricing_method,
      },
    });
  } catch (error: any) {
    console.error('Price calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
