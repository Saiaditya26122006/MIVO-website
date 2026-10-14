import { NextRequest } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse, errorResponse } from '@/lib/auth/admin';
import { generatePresignedPartUrls } from '@/lib/r2/client';

export const runtime = 'nodejs';

/**
 * POST /api/r2/upload/part-urls
 * Generate presigned URLs for uploading parts
 *
 * Body: { key: string, uploadId: string, totalParts: number }
 * Returns: { urls: Array<{ partNumber: number, url: string }> }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const user = await verifyAdminAuth();
    if (!user) {
      return unauthorizedResponse('Admin authentication required');
    }

    // Parse request body
    const body = await request.json();
    const { key, uploadId, totalParts } = body;

    // Validate inputs
    if (!key || typeof key !== 'string') {
      return errorResponse('Invalid or missing key', 400);
    }

    if (!uploadId || typeof uploadId !== 'string') {
      return errorResponse('Invalid or missing uploadId', 400);
    }

    if (!totalParts || typeof totalParts !== 'number' || totalParts <= 0) {
      return errorResponse('Invalid or missing totalParts', 400);
    }

    // Limit maximum parts to prevent abuse
    if (totalParts > 10000) {
      return errorResponse('totalParts exceeds maximum allowed (10000)', 400);
    }

    // Generate presigned URLs (10 minute expiry)
    const urls = await generatePresignedPartUrls(key, uploadId, totalParts, 600);

    console.log(`[R2] Generated ${urls.length} presigned URLs for upload ${uploadId}`);

    // Log first URL structure for debugging (without full signature)
    if (urls.length > 0) {
      const firstUrl = new URL(urls[0].url);
      console.log(`[R2] Presigned URL structure:`, {
        host: firstUrl.hostname,
        bucket: process.env.R2_BUCKET_NAME,
        key: key.substring(0, 50) + (key.length > 50 ? '...' : ''),
        hasUploadId: firstUrl.searchParams.has('uploadId'),
        hasPartNumber: firstUrl.searchParams.has('partNumber'),
        expiresIn: '600 seconds'
      });
    }

    return Response.json({ urls });
  } catch (error: any) {
    console.error('[R2] Failed to generate part URLs:', error);
    return errorResponse(
      error.message || 'Failed to generate presigned URLs',
      500
    );
  }
}
