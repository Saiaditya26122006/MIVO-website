import { NextRequest } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse, errorResponse } from '@/lib/auth/admin';
import { generateDownloadUrl } from '@/lib/r2/client';

export const runtime = 'nodejs';

/**
 * GET /api/r2/download/[key]
 * Generate a presigned URL for downloading a file from R2
 *
 * Returns: { url: string, expiresIn: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth();
    if (!user) {
      return unauthorizedResponse('Admin authentication required');
    }

    // Get key from params
    const { key } = await params;

    if (!key || typeof key !== 'string') {
      return errorResponse('Invalid or missing key', 400);
    }

    // Decode the key (URL-encoded)
    const decodedKey = decodeURIComponent(key);

    // Generate presigned download URL (5 minute expiry)
    const expiresIn = 300;
    const url = await generateDownloadUrl(decodedKey, expiresIn);

    console.log(`[R2] Generated download URL for ${decodedKey}`);

    return Response.json({
      url,
      expiresIn,
    });
  } catch (error: any) {
    console.error('[R2] Failed to generate download URL:', error);
    return errorResponse(
      error.message || 'Failed to generate download URL',
      500
    );
  }
}
