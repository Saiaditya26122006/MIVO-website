import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/auth/admin';
import { generateDownloadUrl } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/r2/preview/[key]
 * Generate a presigned URL for previewing a published product's STL file
 *
 * This endpoint is PUBLIC but only works for published products.
 * It does NOT require authentication, allowing storefront customers to view 3D models.
 *
 * Security:
 * - Only generates URLs for published products
 * - URL expires after 10 minutes
 * - R2 bucket remains private (presigned URLs provide temporary access)
 *
 * Returns: { url: string, expiresIn: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Get key from params
    const { key } = await params;

    if (!key || typeof key !== 'string') {
      return errorResponse('Invalid or missing key', 400);
    }

    // Decode the key (URL-encoded)
    const decodedKey = decodeURIComponent(key);

    // Verify the key belongs to a published product
    const supabase = await createClient();
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, published, storage_provider, storage_key')
      .eq('storage_key', decodedKey)
      .eq('storage_provider', 'r2')
      .single();

    if (productError || !product) {
      console.warn(`[R2 Preview] Key not found in published products: ${decodedKey}`);
      return errorResponse('File not found or not published', 404);
    }

    if (!product.published) {
      console.warn(`[R2 Preview] Attempted access to unpublished product: ${product.id}`);
      return errorResponse('File not available for preview', 403);
    }

    // Generate presigned download URL (10 minute expiry for 3D preview)
    const expiresIn = 600;
    const url = await generateDownloadUrl(decodedKey, expiresIn);

    console.log(`[R2 Preview] Generated preview URL for product: ${product.name} (${product.id})`);

    return Response.json({
      url,
      expiresIn,
    });
  } catch (error: any) {
    console.error('[R2 Preview] Failed to generate preview URL:', error);
    return errorResponse(
      error.message || 'Failed to generate preview URL',
      500
    );
  }
}
