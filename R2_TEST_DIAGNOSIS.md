# R2 Connection Test Diagnosis & Fix

## Issue Summary

**Original Problem**: `node scripts/test-r2-connection.js` failed with "Access Denied"

**Root Cause**: The test script was using `ListBucketsCommand`, which is an **account-level** S3 API operation that requires broader permissions than a bucket-scoped API token provides.

## Detailed Analysis

### Original Test Script (FAILED)
```javascript
// scripts/test-r2-connection.js (original)
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

// This operation requires account-level permissions
const command = new ListBucketsCommand({});
const response = await client.send(command);
```

**Permission Required**: Account-wide bucket listing  
**Token Has**: Bucket-scoped "Object Read & Write"  
**Result**: ✗ Access Denied (403)

### API Token Configuration

The R2 API token was correctly configured with:
- ✅ **Permission**: Object Read & Write
- ✅ **Scope**: Bucket `mivo-stl-originals`
- ✅ **Credentials**: Valid and not expired

### Why ListBuckets Failed

Cloudflare R2 (like AWS S3) has two permission levels:

1. **Account-level operations**:
   - `ListBuckets` - List all buckets in account
   - `CreateBucket` - Create new buckets
   - Requires: Admin or account-wide token

2. **Bucket-level operations**:
   - `PutObject`, `GetObject`, `DeleteObject`
   - `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`
   - Requires: Bucket-scoped "Object Read & Write"

**Conclusion**: The token has the **correct** permissions for production use. The test script was using the **wrong** operation.

## Solution

### Updated Test Script (PASSES)

```javascript
// scripts/test-r2-connection.js (updated)
const {
  S3Client,
  HeadBucketCommand,      // ✓ Bucket-scoped
  PutObjectCommand,        // ✓ Bucket-scoped
  GetObjectCommand,        // ✓ Bucket-scoped
  DeleteObjectCommand,     // ✓ Bucket-scoped
} = require('@aws-sdk/client-s3');
```

**New Test Flow**:
1. **HeadBucket**: Verify bucket exists and is accessible
2. **PutObject**: Upload a tiny test file (`.test-connection-[timestamp].txt`)
3. **GetObject**: Download and verify the test file
4. **DeleteObject**: Clean up the test file

**Result**: ✅ All tests pass

### Test Output

```
✅ All R2 tests passed!

Your R2 configuration is working correctly:
  ✓ Bucket: mivo-stl-originals
  ✓ Read permission: Working
  ✓ Write permission: Working
  ✓ Delete permission: Working

🚀 Ready to upload STL files!
```

## Production Code Verification

### lib/r2/client.ts Operations

The production upload implementation uses **only** bucket-scoped operations:

```typescript
// All of these work with bucket-scoped tokens
- CreateMultipartUploadCommand  ✓
- UploadPartCommand             ✓
- CompleteMultipartUploadCommand ✓
- AbortMultipartUploadCommand    ✓
- GetObjectCommand              ✓
```

**Conclusion**: The production code is **unaffected** by the test issue and will work correctly with the bucket-scoped API token.

## Permission Requirements

### What the Token DOES Need (Already Has)
- ✅ Object Read & Write on bucket `mivo-stl-originals`
- ✅ Support for multipart uploads
- ✅ Support for presigned URLs

### What the Token DOES NOT Need (Not Required)
- ✗ Account-level bucket listing
- ✗ Create/delete bucket permissions
- ✗ Admin access

## Security Implications

**No security weakening required**. The original token configuration is correct:
- ✅ Bucket-scoped (not account-wide)
- ✅ Object Read & Write only (not admin)
- ✅ Follows principle of least privilege

## Changes Made

### 1. Updated Test Script
**File**: `scripts/test-r2-connection.js`

**Changes**:
- Removed `ListBucketsCommand` (account-level)
- Added `HeadBucketCommand` (bucket-level)
- Added `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`
- Test now creates/verifies/deletes a temporary object
- Automatic cleanup on success or failure

**Behavior**:
- Tests actual upload/download capabilities
- Matches production operation permissions
- Provides detailed error messages based on failure type

### 2. No Changes to Production Code
**Files**: `lib/r2/client.ts`, API routes, uploader

**Status**: No changes needed - already using correct operations

## Testing Results

### Before Fix
```
❌ Failed to connect to R2:
Access Denied
```

### After Fix
```
✅ All R2 tests passed!
  ✓ Bucket: mivo-stl-originals
  ✓ Read permission: Working
  ✓ Write permission: Working
  ✓ Delete permission: Working
```

## Recommendations

### 1. Token Configuration (No Change Needed)
Current configuration is **optimal**:
- Bucket-scoped for security
- Object Read & Write for functionality
- Follows Cloudflare best practices

### 2. Testing Going Forward
Run updated test script to verify:
```bash
node scripts/test-r2-connection.js
```

Should see all 4 tests pass:
1. ✅ Bucket accessibility check
2. ✅ Object upload
3. ✅ Object download
4. ✅ Object deletion

### 3. Production Deployment
No changes needed. The multipart upload implementation already uses bucket-scoped operations that are fully supported by the current API token.

## Common Misconceptions

### ❌ "Access Denied means invalid credentials"
**Reality**: Credentials were valid. Operation required broader permissions than token scope.

### ❌ "Need admin token to test R2"
**Reality**: Bucket-scoped token is sufficient. Test just needs to use appropriate operations.

### ❌ "Production uploads will fail too"
**Reality**: Production code uses different (bucket-scoped) operations that work perfectly.

## Conclusion

**Issue**: Test script used wrong API operation  
**Fix**: Updated test to use bucket-scoped operations  
**Security**: No permission changes needed  
**Production**: Unaffected, ready to use  
**Status**: ✅ Resolved

The R2 integration is **production-ready** with correct security configuration.
