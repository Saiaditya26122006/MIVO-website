/**
 * Test script to verify R2 configuration with bucket-scoped permissions
 * Run with: node scripts/test-r2-connection.js
 *
 * This test uses only bucket-scoped operations (Object Read & Write)
 * and does NOT require account-level permissions like ListBuckets.
 */

const {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function testR2Connection() {
  console.log('🔍 Testing R2 Bucket-Scoped Permissions...\n');

  // Check environment variables
  const requiredVars = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ];

  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('\nMake sure these are set in your .env.local file');
    process.exit(1);
  }

  console.log('✓ All environment variables found\n');

  const bucketName = process.env.R2_BUCKET_NAME;
  const testKey = `.test-connection-${Date.now()}.txt`;
  const testContent = 'R2 connection test';

  // Create R2 client
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  let testObjectCreated = false;

  try {
    // Test 1: Verify bucket exists (HeadBucket)
    console.log(`📡 Test 1/4: Checking bucket "${bucketName}"...`);
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log('✅ Bucket exists and is accessible\n');

    // Test 2: Upload a test object (PutObject)
    console.log(`📤 Test 2/4: Uploading test object...`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );
    testObjectCreated = true;
    console.log(`✅ Upload successful: ${testKey}\n`);

    // Test 3: Download the test object (GetObject)
    console.log(`📥 Test 3/4: Downloading test object...`);
    const getResponse = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );

    // Read the body stream
    const bodyContents = await streamToString(getResponse.Body);

    if (bodyContents === testContent) {
      console.log('✅ Download successful and content matches\n');
    } else {
      throw new Error('Downloaded content does not match uploaded content');
    }

    // Test 4: Delete the test object (DeleteObject)
    console.log(`🗑️  Test 4/4: Cleaning up test object...`);
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );
    testObjectCreated = false;
    console.log('✅ Cleanup successful\n');

    // All tests passed
    console.log('━'.repeat(50));
    console.log('✅ All R2 tests passed!');
    console.log('━'.repeat(50));
    console.log('\nYour R2 configuration is working correctly:');
    console.log(`  ✓ Bucket: ${bucketName}`);
    console.log('  ✓ Read permission: Working');
    console.log('  ✓ Write permission: Working');
    console.log('  ✓ Delete permission: Working');
    console.log('\n🚀 Ready to upload STL files!\n');
  } catch (error) {
    console.error('\n❌ R2 Test Failed:');
    console.error(`Error: ${error.message}\n`);

    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.error('Issue: Bucket does not exist');
      console.error(`\nPlease create the bucket "${bucketName}" in Cloudflare R2:`);
      console.error('1. Go to Cloudflare Dashboard → R2');
      console.error('2. Click "Create bucket"');
      console.error(`3. Name it: ${bucketName}`);
      console.error('4. Click "Create bucket"\n');
    } else if (
      error.name === 'AccessDenied' ||
      error.$metadata?.httpStatusCode === 403
    ) {
      console.error('Issue: Permission denied');
      console.error('\nYour API token needs the following permissions:');
      console.error('  ✓ Object Read & Write');
      console.error(`  ✓ Bucket scope: ${bucketName}`);
      console.error('\nTo fix:');
      console.error('1. Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens');
      console.error('2. Edit your token or create a new one');
      console.error('3. Ensure "Object Read & Write" is checked');
      console.error(`4. Ensure bucket scope includes "${bucketName}"`);
      console.error('5. Update .env.local with the new credentials');
      console.error('6. Restart the server and re-run this test\n');
    } else {
      console.error('Possible issues:');
      console.error('- Invalid credentials (check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY)');
      console.error('- Incorrect Account ID');
      console.error('- API token expired or revoked');
      console.error('- Network connectivity issues\n');
    }

    // Cleanup if test object was created
    if (testObjectCreated) {
      try {
        console.log('🧹 Attempting cleanup of test object...');
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: testKey,
          })
        );
        console.log('✓ Cleanup successful\n');
      } catch (cleanupError) {
        console.log(`⚠️  Could not clean up test object: ${testKey}`);
        console.log('   You may need to delete it manually\n');
      }
    }

    process.exit(1);
  }
}

// Helper function to convert stream to string
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

testR2Connection();
