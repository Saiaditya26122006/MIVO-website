import { NextRequest } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse, errorResponse } from '@/lib/auth/admin';
import { initiateMultipartUpload } from '@/lib/r2/client';

export const runtime = 'nodejs';

/**
 * POST /api/r2/upload/initiate
 * Initiate a multipart upload to R2
 *
 * Body: { fileName: string, fileSize: number, contentType?: string }
 * Returns: { uploadId: string, key: string, fileName: string, fileSize: number }
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
    const { fileName, fileSize, contentType } = body;

    // Validate inputs
    if (!fileName || typeof fileName !== 'string') {
      return errorResponse('Invalid or missing fileName', 400);
    }

    if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
      return errorResponse('Invalid or missing fileSize', 400);
    }

    // Validate file extension (STL only)
    if (!fileName.toLowerCase().endsWith('.stl')) {
      return errorResponse('Only .stl files are allowed', 400);
    }

    // Initiate multipart upload
    const result = await initiateMultipartUpload(
      fileName,
      contentType || 'application/octet-stream'
    );

    console.log(`[R2] Initiated upload for ${fileName} (${fileSize} bytes)`);
    console.log(`[R2] Upload ID: ${result.uploadId}`);
    console.log(`[R2] Key: ${result.key}`);

    return Response.json({
      uploadId: result.uploadId,
      key: result.key,
      fileName,
      fileSize,
    });
  } catch (error: any) {
    console.error('[R2] Failed to initiate upload:', error);
    return errorResponse(
      error.message || 'Failed to initiate upload',
      500
    );
  }
}
