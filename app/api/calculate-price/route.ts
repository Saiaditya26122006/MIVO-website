// API Route: Calculate and validate product price
// POST /api/calculate-price

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculatePrice, validateConfiguration } from '@/lib/pricing';
import type { Product, ProductConfiguration } from '@/types/pricing';

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

    // Validate configuration
    const validation = validateConfiguration(typedProduct, configuration);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          validationErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Calculate price
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
