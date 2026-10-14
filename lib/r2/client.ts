import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Validate required environment variables
const requiredEnvVars = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

function validateR2Config() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 environment variables: ${missing.join(', ')}`
    );
  }
}

// Create R2 client (S3-compatible)
export function createR2Client() {
  validateR2Config();

  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export interface InitiateMultipartUploadResult {
  uploadId: string;
  key: string;
}

export interface PresignedPartUrl {
  partNumber: number;
  url: string;
}

export interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

/**
 * Initiate a multipart upload to R2
 */
export async function initiateMultipartUpload(
  fileName: string,
  contentType: string = 'application/octet-stream'
): Promise<InitiateMultipartUploadResult> {
  const client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  // Generate unique key with timestamp
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `stl-files/${timestamp}-${sanitizedFileName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const response = await client.send(command);

  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload: No UploadId returned');
  }

  return {
    uploadId: response.UploadId,
    key,
  };
}

/**
 * Generate presigned URLs for uploading parts
 */
export async function generatePresignedPartUrls(
  key: string,
  uploadId: string,
  totalParts: number,
  expiresIn: number = 600 // 10 minutes
): Promise<PresignedPartUrl[]> {
  const client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const urls: PresignedPartUrl[] = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    urls.push({ partNumber, url });
  }

  return urls;
}

/**
 * Complete a multipart upload
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<void> {
  const client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  // Sort parts by part number (required by S3 API)
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  await client.send(command);
}

/**
 * Abort a multipart upload (cleanup)
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);
}

/**
 * Generate a presigned URL for downloading a file from R2
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 300 // 5 minutes
): Promise<string> {
  const client = createR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}
