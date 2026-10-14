import { NextRequest } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse, errorResponse } from '@/lib/auth/admin';
import { completeMultipartUpload } from '@/lib/r2/client';

export const runtime = 'nodejs';

/**
 * POST /api/r2/upload/complete
 * Complete a multipart upload
 *
 * Body: { key: string, uploadId: string, parts: Array<{ PartNumber: number, ETag: string }> }
 * Returns: { success: true, key: string }
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
    const { key, uploadId, parts } = body;

    // Validate inputs
    if (!key || typeof key !== 'string') {
      return errorResponse('Invalid or missing key', 400);
    }

    if (!uploadId || typeof uploadId !== 'string') {
      return errorResponse('Invalid or missing uploadId', 400);
    }

    if (!Array.isArray(parts) || parts.length === 0) {
      return errorResponse('Invalid or missing parts array', 400);
    }

    // Validate parts structure
    for (const part of parts) {
      if (
        typeof part.PartNumber !== 'number' ||
        typeof part.ETag !== 'string' ||
        part.PartNumber <= 0
      ) {
        return errorResponse('Invalid part structure', 400);
      }
    }

    // Complete multipart upload
    await completeMultipartUpload(key, uploadId, parts);

    console.log(`[R2] Completed upload for ${key}`);
    console.log(`[R2] Total parts: ${parts.length}`);

    return Response.json({
      success: true,
      key,
    });
  } catch (error: any) {
    console.error('[R2] Failed to complete upload:', error);
    return errorResponse(
      error.message || 'Failed to complete upload',
      500
    );
  }
}
