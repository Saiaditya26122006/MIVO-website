/**
 * Client-side multipart uploader for R2
 * Uploads large files in chunks without loading entire file into memory
 */

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  uploadedParts: number;
  totalParts: number;
}

export interface UploadResult {
  key: string;
  uploadId: string;
  fileSize: number;
}

export interface MultipartUploaderOptions {
  file: File;
  partSize?: number; // Default: 10MB
  maxRetries?: number; // Default: 3
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
}

interface UploadMetadata {
  uploadId: string;
  key: string;
  fileName: string;
  fileSize: number;
}

interface PresignedUrl {
  partNumber: number;
  url: string;
}

interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

export class MultipartUploader {
  private file: File;
  private partSize: number;
  private maxRetries: number;
  private onProgress?: (progress: UploadProgress) => void;
  private onError?: (error: Error) => void;

  private metadata: UploadMetadata | null = null;
  private aborted = false;
  private uploadedParts: CompletedPart[] = [];

  constructor(options: MultipartUploaderOptions) {
    this.file = options.file;
    this.partSize = options.partSize || 10 * 1024 * 1024; // 10MB default
    this.maxRetries = options.maxRetries || 3;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /**
   * Start the upload process
   */
  async start(): Promise<UploadResult> {
    try {
      this.aborted = false;
      this.uploadedParts = [];

      // Step 1: Initiate multipart upload
      this.metadata = await this.initiateUpload();

      // Step 2: Calculate total parts
      const totalParts = Math.ceil(this.file.size / this.partSize);

      // Step 3: Get presigned URLs for all parts
      const presignedUrls = await this.getPresignedUrls(totalParts);

      // Step 4: Upload all parts
      await this.uploadParts(presignedUrls);

      // Check if aborted before completing
      if (this.aborted) {
        throw new Error('Upload aborted by user');
      }

      // Step 5: Complete multipart upload
      await this.completeUpload();

      return {
        key: this.metadata.key,
        uploadId: this.metadata.uploadId,
        fileSize: this.file.size,
      };
    } catch (error: any) {
      // Cleanup: abort the upload on error
      if (this.metadata && !this.aborted) {
        await this.abortUpload().catch(console.error);
      }
      throw error;
    }
  }

  /**
   * Abort the upload
   */
  async abort(): Promise<void> {
    this.aborted = true;

    if (this.metadata) {
      await this.abortUpload();
    }
  }

  /**
   * Step 1: Initiate multipart upload
   */
  private async initiateUpload(): Promise<UploadMetadata> {
    const response = await fetch('/api/r2/upload/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: this.file.name,
        fileSize: this.file.size,
        contentType: this.file.type || 'application/octet-stream',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to initiate upload: ${error.error}`);
    }

    return await response.json();
  }

  /**
   * Step 2: Get presigned URLs for all parts
   */
  private async getPresignedUrls(totalParts: number): Promise<PresignedUrl[]> {
    if (!this.metadata) throw new Error('Upload not initiated');

    const response = await fetch('/api/r2/upload/part-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: this.metadata.key,
        uploadId: this.metadata.uploadId,
        totalParts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to get presigned URLs: ${error.error}`);
    }

    const data = await response.json();
    return data.urls;
  }

  /**
   * Step 3: Upload all parts
   */
  private async uploadParts(presignedUrls: PresignedUrl[]): Promise<void> {
    const totalParts = presignedUrls.length;
    let uploadedBytes = 0;

    // Upload parts sequentially to avoid memory issues
    // For better performance, could upload in parallel with concurrency limit
    for (const { partNumber, url } of presignedUrls) {
      if (this.aborted) {
        throw new Error('Upload aborted');
      }

      const start = (partNumber - 1) * this.partSize;
      const end = Math.min(start + this.partSize, this.file.size);
      const chunk = this.file.slice(start, end);

      const etag = await this.uploadPartWithRetry(url, chunk, partNumber);

      this.uploadedParts.push({
        PartNumber: partNumber,
        ETag: etag,
      });

      uploadedBytes += chunk.size;

      // Report progress
      if (this.onProgress) {
        this.onProgress({
          uploadedBytes,
          totalBytes: this.file.size,
          percentage: Math.round((uploadedBytes / this.file.size) * 100),
          uploadedParts: partNumber,
          totalParts,
        });
      }
    }
  }

  /**
   * Upload a single part with retry logic
   */
  private async uploadPartWithRetry(
    url: string,
    chunk: Blob,
    partNumber: number
  ): Promise<string> {
    let lastError: Error | null = null;
    let lastStatus: number | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });

        lastStatus = response.status;

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const etag = response.headers.get('ETag');
        if (!etag) {
          throw new Error('No ETag returned from upload');
        }

        return etag;
      } catch (error: any) {
        lastError = error;

        // Log detailed error info
        const errorDetails: any = {
          partNumber,
          attempt,
          message: error.message,
          status: lastStatus,
          errorType: error.name,
        };

        // Check if it's a network/CORS error
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          errorDetails.likelyCause = 'CORS or network error - check R2 bucket CORS configuration';
        }

        console.error(`[R2] Part ${partNumber} upload failed:`, errorDetails);

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Build detailed error message
    const statusInfo = lastStatus ? ` (HTTP ${lastStatus})` : '';
    const errorMsg = lastError?.message || 'Unknown error';

    throw new Error(
      `Failed to upload part ${partNumber} after ${this.maxRetries} attempts${statusInfo}: ${errorMsg}`
    );
  }

  /**
   * Step 4: Complete multipart upload
   */
  private async completeUpload(): Promise<void> {
    if (!this.metadata) throw new Error('Upload not initiated');

    const response = await fetch('/api/r2/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: this.metadata.key,
        uploadId: this.metadata.uploadId,
        parts: this.uploadedParts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to complete upload: ${error.error}`);
    }
  }

  /**
   * Abort multipart upload (cleanup)
   */
  private async abortUpload(): Promise<void> {
    if (!this.metadata) return;

    try {
      const response = await fetch('/api/r2/upload/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.metadata.key,
          uploadId: this.metadata.uploadId,
        }),
      });

      if (!response.ok) {
        console.warn('[R2] Failed to abort upload:', await response.text());
      }
    } catch (error) {
      console.warn('[R2] Error aborting upload:', error);
    }
  }
}
