# R2 Upload Failure Investigation & Fix

## Problem Statement

STL file upload to Cloudflare R2 fails with:
```
Failed to upload part 1 after 3 attempts: Failed to fetch
```

The 3D preview works correctly, but the multipart upload to R2 storage fails.

## Investigation Results

### 1. Determine Where Failure Occurs

**Finding**: The failure occurs when uploading the part **directly to R2**, not when requesting presigned URLs from the Next.js API.

**Evidence**:
- The error happens in `uploadPartWithRetry()` when calling `fetch(url, { method: 'PUT', body: chunk })`
- This is a direct browser → R2 request, not browser → Next.js API
- "Failed to fetch" is a generic browser error for network/CORS issues

**Code Location**: `lib/r2/multipart-uploader.ts:216-219`
```typescript
const response = await fetch(url, {
  method: 'PUT',
  body: chunk,
});
```

### 2. Verify Presigned URL Configuration

**Finding**: Presigned URL generation is correctly configured.

**Verified**:
- ✅ Account ID: `922c7d5676102f7db5db130c3f046acd`
- ✅ Bucket: `mivo-stl-originals`
- ✅ Endpoint: `https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com`
- ✅ Using AWS SDK v3 `@aws-sdk/client-s3`
- ✅ Using `UploadPartCommand` with correct parameters:
  - Bucket ✓
  - Key ✓
  - PartNumber ✓
  - UploadId ✓
- ✅ Signing with `getSignedUrl(client, command, { expiresIn: 600 })`
- ✅ 10-minute expiry (600 seconds)

**Code Location**: `lib/r2/client.ts:97-121`

**Test Command**:
```bash
node test-r2-presigned-url.mjs
```

This will output the presigned URL structure and validation.

### 3. CORS Preflight Analysis

**Finding**: This is a **CORS (Cross-Origin Resource Sharing) issue**.

**Root Cause**:

When the browser makes a PUT request from `http://localhost:3001` to `https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com`, the browser:

1. Sends an OPTIONS preflight request (CORS check)
2. R2 responds based on its CORS configuration
3. **If R2 bucket has no CORS rules, the preflight fails**
4. Browser blocks the actual PUT request
5. JavaScript sees generic "Failed to fetch" error

**Why CORS is Required**:

- Browser origin: `http://localhost:3001`
- R2 endpoint: `https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com`
- Different origins → CORS preflight required for PUT requests
- Presigned URLs do NOT bypass CORS - the bucket itself must allow the origin

**Verification**:

Check browser Network tab:
- Look for OPTIONS request to R2 before PUT request
- If OPTIONS returns 403 or is missing CORS headers → CORS issue

### 4. Required R2 Bucket CORS Configuration

**Action Required**: Configure CORS policy on R2 bucket `mivo-stl-originals`.

**Configuration** (see `R2_CORS_CONFIGURATION.md` for detailed steps):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Critical Fields**:
- `AllowedOrigins`: Must include exact origin (protocol + domain + port)
- `AllowedMethods`: Must include `PUT` (for multipart upload)
- `ExposeHeaders`: Must include `ETag` (required to complete multipart upload)

**Where to Configure**:
1. Go to: https://dash.cloudflare.com/
2. Navigate to: R2 → mivo-stl-originals
3. Click: Settings tab
4. Scroll to: CORS Policy section
5. Click: Add CORS policy
6. Paste configuration above
7. Save

### 5. Error Handling Improvements

**Changes Made**:

#### A. Enhanced Error Logging (`lib/r2/multipart-uploader.ts`)

Added detailed error diagnostics:
```typescript
const errorDetails: any = {
  partNumber,
  attempt,
  message: error.message,
  status: lastStatus,
  errorType: error.name,
};

// Detect CORS errors
if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
  errorDetails.likelyCause = 'CORS or network error - check R2 bucket CORS configuration';
}
```

This logs:
- HTTP status code (if available)
- Error type (TypeError = CORS/network)
- Likely cause hint
- Part number and attempt

#### B. User-Friendly Error Messages (`app/admin/products/new/page.tsx`)

Added CORS error detection:
```typescript
if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
  errorMessage = 'Upload blocked by CORS policy. Configure R2 bucket CORS settings to allow requests from this origin. See R2_CORS_CONFIGURATION.md for instructions.';
}
```

Now users see actionable guidance instead of cryptic "Failed to fetch".

#### C. Presigned URL Structure Logging (`app/api/r2/upload/part-urls/route.ts`)

Added diagnostic logging (without exposing sensitive signature):
```typescript
console.log(`[R2] Presigned URL structure:`, {
  host: firstUrl.hostname,
  bucket: process.env.R2_BUCKET_NAME,
  key: key.substring(0, 50) + '...',
  hasUploadId: firstUrl.searchParams.has('uploadId'),
  hasPartNumber: firstUrl.searchParams.has('partNumber'),
  expiresIn: '600 seconds'
});
```

This confirms presigned URLs are correctly formatted.

### 6. Security Verification

**Question**: Does CORS configuration make the bucket public?

**Answer**: ❌ **NO**

CORS configuration:
- ✅ Only affects which web origins can make browser requests
- ✅ Does NOT affect authentication or authorization
- ✅ Presigned URLs still required (time-limited, signed with secret key)
- ✅ Only authenticated admins can generate presigned URLs via `/api/r2/upload/*`
- ✅ Files remain private
- ✅ CORS only allows your specific web app origins

**What NOT to Do**:
```json
{
  "AllowedOrigins": ["*"]  // ❌ Allows ANY website
}
```

Always specify exact origins like `http://localhost:3001`.

### 7. End-to-End Upload Workflow Verification

**Current Flow**:

1. ✅ Admin logs in → authentication verified
2. ✅ Admin selects STL file → preview renders correctly
3. ✅ Admin clicks "Publish"
4. ✅ Next.js API `/api/r2/upload/initiate` → creates multipart upload
5. ✅ Next.js API `/api/r2/upload/part-urls` → generates presigned URLs
6. ❌ Browser PUT to R2 → **FAILS due to missing CORS**
7. ⏸️ Upload aborted, product not saved

**After CORS Configuration**:

1. ✅ Admin logs in
2. ✅ Admin selects STL file
3. ✅ Admin clicks "Publish"
4. ✅ Initiate upload
5. ✅ Generate presigned URLs
6. ✅ Browser PUT to R2 → **SUCCEEDS (CORS allows origin)**
7. ✅ Complete multipart upload
8. ✅ Save product to database
9. ✅ Redirect to products list

**Cleanup on Failure**:
- ✅ `MultipartUploader.abort()` is called
- ✅ Sends request to `/api/r2/upload/abort`
- ✅ Calls `AbortMultipartUploadCommand` on R2
- ✅ Cleans up incomplete multipart upload

### 8. Testing Plan

#### A. Test Presigned URL Generation

```bash
node test-r2-presigned-url.mjs
```

**Expected Output**:
```
✅ Presigned URL generated successfully
✅ URL Validation:
  Has uploadId param: ✅
  Has partNumber param: ✅
  Has X-Amz-Signature: ✅
```

#### B. Test CORS Configuration (After Setup)

**Method 1: Curl Test**
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" \
  -v \
  "https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com/mivo-stl-originals/"
```

**Expected Response**:
```
HTTP/2 200
access-control-allow-origin: http://localhost:3001
access-control-allow-methods: GET, PUT, POST, DELETE, HEAD
access-control-expose-headers: ETag, Content-Length, Content-Type
```

**Method 2: Browser Test**

1. Go to: http://localhost:3001/admin/products/new
2. Open DevTools → Network tab
3. Clear network log
4. Select and upload STL file
5. Click "Publish"
6. Watch for:
   - OPTIONS request to R2 → Status 200
   - PUT request to R2 → Status 200
   - Response header: `etag: "..."`

#### C. Full Upload Test

1. Start dev server: `npm run dev`
2. Go to: http://localhost:3001/admin/login
3. Login with: `saiadityatalluri@gmail.com` / `Saiaditya@2006`
4. Go to: http://localhost:3001/admin/products/new
5. Fill form:
   - Name: "Test Product"
   - Description: "Test description"
   - Price: "29.99"
   - Category: "robotics"
6. Upload test STL file (any valid STL)
7. Verify 3D preview appears
8. Click "Publish"
9. Watch upload progress
10. Verify success redirect to /admin/products

**Console Output (Success)**:
```
📤 Starting upload process...
📦 Uploading STL file to R2: test.stl
✓ Presigned URLs generated
📊 Upload progress: 100% (1/1 parts)
✓ STL uploaded to R2: stl-files/1234567890-test.stl
💾 Creating product record...
✓ Product created: abc-123
🎉 Product published successfully!
```

**Console Output (CORS Failure)**:
```
❌ Part 1 upload failed: {
  partNumber: 1,
  attempt: 1,
  message: "Failed to fetch",
  status: null,
  errorType: "TypeError",
  likelyCause: "CORS or network error - check R2 bucket CORS configuration"
}
```

### 9. Cloudflare Configuration Changes Required

**Immediate Action**:

Configure CORS on R2 bucket `mivo-stl-originals` as documented in `R2_CORS_CONFIGURATION.md`.

**No Other Changes Needed**:
- ✅ Bucket name: correct
- ✅ Access keys: configured
- ✅ Endpoint: correct
- ✅ Presigned URL generation: working
- ✅ API authentication: working
- ✅ Database schema: correct

**Only Missing**: CORS policy on the bucket itself.

## Summary

### Root Cause
R2 bucket `mivo-stl-originals` does not have CORS policy configured. Browser blocks PUT requests from `http://localhost:3001` to R2 endpoint due to missing CORS headers.

### Required Fix
Add CORS policy to R2 bucket (see `R2_CORS_CONFIGURATION.md`).

### Code Changes Made
1. Enhanced error logging in multipart uploader
2. Improved error messages in product form UI
3. Added presigned URL structure diagnostics
4. Created test script for presigned URL verification
5. Created comprehensive CORS documentation

### Files Modified
- ✅ `lib/r2/multipart-uploader.ts` - Enhanced error diagnostics
- ✅ `app/admin/products/new/page.tsx` - Better error messages
- ✅ `app/api/r2/upload/part-urls/route.ts` - Added URL structure logging

### Files Created
- ✅ `R2_CORS_CONFIGURATION.md` - Detailed CORS setup guide
- ✅ `R2_UPLOAD_INVESTIGATION.md` - This investigation report
- ✅ `test-r2-presigned-url.mjs` - Presigned URL verification script

### Testing Required
1. Configure CORS on R2 bucket
2. Wait 1-2 minutes for propagation
3. Test upload at http://localhost:3001/admin/products/new
4. Verify OPTIONS and PUT requests succeed in Network tab
5. Confirm product is created and STL is stored in R2

### Expected Outcome
After CORS configuration, multipart uploads to R2 will succeed and products with STL files will be saved correctly.

## Browser Test Checklist

After configuring CORS, verify:

- [ ] Dev server running on http://localhost:3001
- [ ] Admin logged in
- [ ] STL file selected
- [ ] 3D preview renders correctly
- [ ] Click "Publish"
- [ ] OPTIONS request to R2: 200 OK
- [ ] PUT request to R2: 200 OK
- [ ] ETag header present in response
- [ ] Upload progress shows 100%
- [ ] Product saved to database
- [ ] Redirected to /admin/products
- [ ] Product appears in list
- [ ] Console shows no errors

## Next Steps

1. **Configure CORS** (see R2_CORS_CONFIGURATION.md)
2. **Test presigned URL generation**: `node test-r2-presigned-url.mjs`
3. **Test CORS with curl** (see command in section 8B)
4. **Test full upload in browser** (see steps in section 8C)
5. **Report results** with console output and Network tab screenshots if still failing

---

**Do not declare success until browser test confirms successful upload with CORS configured.**
