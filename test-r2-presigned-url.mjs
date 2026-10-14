/**
 * Test R2 presigned URL generation
 * Run with: node test-r2-presigned-url.mjs
 *
 * This verifies that presigned URLs are correctly formatted
 * and helps diagnose CORS issues.
 */

import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID || '922c7d5676102f7db5db130c3f046acd';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '1f8b2ad187692213f1da4d4c8a487c4a';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '91a1fe5b2bbf915e675ac20c8466bc00a20990f74a929d5c6f670ca1f56c4772';
const bucketName = process.env.R2_BUCKET_NAME || 'mivo-stl-originals';

console.log('🧪 Testing R2 Presigned URL Generation\n');

// Create R2 client
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

console.log('📦 R2 Configuration:');
console.log(`  Account ID: ${accountId}`);
console.log(`  Bucket: ${bucketName}`);
console.log(`  Endpoint: https://${accountId}.r2.cloudflarestorage.com`);
console.log();

// Generate a test presigned URL
const testKey = 'stl-files/test-upload.stl';
const testUploadId = 'TEST_UPLOAD_ID_12345';
const partNumber = 1;

console.log('🔐 Generating presigned URL:');
console.log(`  Key: ${testKey}`);
console.log(`  Upload ID: ${testUploadId}`);
console.log(`  Part Number: ${partNumber}`);
console.log();

try {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: testKey,
    PartNumber: partNumber,
    UploadId: testUploadId,
  });

  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 600 });

  console.log('✅ Presigned URL generated successfully\n');

  // Parse the URL
  const url = new URL(presignedUrl);

  console.log('📊 URL Structure:');
  console.log(`  Hostname: ${url.hostname}`);
  console.log(`  Path: ${url.pathname}`);
  console.log(`  Protocol: ${url.protocol}`);
  console.log();

  console.log('🔍 Query Parameters:');
  const params = Array.from(url.searchParams.entries());
  params.forEach(([key, value]) => {
    // Don't log full signature values
    if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('credential')) {
      console.log(`  ${key}: ${value.substring(0, 20)}... (truncated)`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });
  console.log();

  console.log('✅ URL Validation:');
  console.log(`  Has uploadId param: ${url.searchParams.has('uploadId') ? '✅' : '❌'}`);
  console.log(`  Has partNumber param: ${url.searchParams.has('partNumber') ? '✅' : '❌'}`);
  console.log(`  Has X-Amz-Signature: ${url.searchParams.has('X-Amz-Signature') ? '✅' : '❌'}`);
  console.log(`  Has X-Amz-Credential: ${url.searchParams.has('X-Amz-Credential') ? '✅' : '❌'}`);
  console.log(`  Has X-Amz-Algorithm: ${url.searchParams.has('X-Amz-Algorithm') ? '✅' : '❌'}`);
  console.log(`  Has X-Amz-Date: ${url.searchParams.has('X-Amz-Date') ? '✅' : '❌'}`);
  console.log(`  Has X-Amz-Expires: ${url.searchParams.has('X-Amz-Expires') ? '✅' : '❌'}`);
  console.log();

  console.log('🌐 CORS Test:');
  console.log('  To test CORS configuration, run this curl command:\n');
  console.log(`  curl -X OPTIONS \\`);
  console.log(`    -H "Origin: http://localhost:3001" \\`);
  console.log(`    -H "Access-Control-Request-Method: PUT" \\`);
  console.log(`    -H "Access-Control-Request-Headers: content-type" \\`);
  console.log(`    -v \\`);
  console.log(`    "${url.origin}${url.pathname}"`);
  console.log();
  console.log('  Expected response:');
  console.log('    HTTP/2 200');
  console.log('    access-control-allow-origin: http://localhost:3001');
  console.log('    access-control-allow-methods: GET, PUT, POST, DELETE, HEAD');
  console.log();

  console.log('📋 Next Steps:');
  console.log('  1. If CORS test fails, configure R2 bucket CORS policy');
  console.log('  2. See R2_CORS_CONFIGURATION.md for exact configuration');
  console.log('  3. Add your localhost port(s) to AllowedOrigins');
  console.log('  4. Ensure PUT method is in AllowedMethods');
  console.log('  5. Ensure ETag is in ExposeHeaders (required for multipart)');
  console.log();

  console.log('✅ Test completed successfully!');
  console.log();
  console.log('If uploads still fail with "Failed to fetch", the issue is likely CORS.');

} catch (error) {
  console.error('❌ Failed to generate presigned URL:', error.message);
  console.error();
  console.error('Error details:', error);
  process.exit(1);
}
