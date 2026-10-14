import { NextRequest } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse, errorResponse } from '@/lib/auth/admin';
import { abortMultipartUpload } from '@/lib/r2/client';

export const runtime = 'nodejs';

/**
 * POST /api/r2/upload/abort
 * Abort a multipart upload (cleanup)
 *
 * Body: { key: string, uploadId: string }
 * Returns: { success: true }
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
    const { key, uploadId } = body;

    // Validate inputs
    if (!key || typeof key !== 'string') {
      return errorResponse('Invalid or missing key', 400);
    }

    if (!uploadId || typeof uploadId !== 'string') {
      return errorResponse('Invalid or missing uploadId', 400);
    }

    // Abort multipart upload
    await abortMultipartUpload(key, uploadId);

    console.log(`[R2] Aborted upload for ${key}`);
    console.log(`[R2] Upload ID: ${uploadId}`);

    return Response.json({
      success: true,
    });
  } catch (error: any) {
    console.error('[R2] Failed to abort upload:', error);
    return errorResponse(
      error.message || 'Failed to abort upload',
      500
    );
  }
}
