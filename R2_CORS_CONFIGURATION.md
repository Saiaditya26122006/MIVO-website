# R2 CORS Configuration Required

## Problem

The multipart upload to Cloudflare R2 fails with:
```
Failed to upload part 1 after 3 attempts: Failed to fetch
```

This is a **CORS (Cross-Origin Resource Sharing)** error. The browser blocks the PUT request to R2 because the R2 bucket doesn't allow requests from your web application's origin.

## Root Cause

When the browser tries to upload a file part directly to R2 using a presigned URL:

1. Browser sends OPTIONS preflight request to R2
2. R2 checks if the origin is allowed in CORS rules
3. **R2 rejects the request** because no CORS rules are configured
4. Browser blocks the actual PUT request
5. JavaScript sees generic "Failed to fetch" error

## Solution: Configure R2 Bucket CORS

You must add CORS rules to your R2 bucket `mivo-stl-originals`.

### Step 1: Access Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **R2** → **mivo-stl-originals**
3. Click: **Settings** tab
4. Scroll to: **CORS Policy** section

### Step 2: Add CORS Rules

Click **Add CORS policy** and configure:

#### For Local Development

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

#### For Production (Add Your Domain)

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://yourdomain.com",
      "https://www.yourdomain.com"
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

### Step 3: Verify Configuration

After saving the CORS policy:

1. Wait 1-2 minutes for changes to propagate
2. Open browser DevTools → Network tab
3. Try uploading an STL file again
4. Check the OPTIONS request to R2:
   - Should show `200 OK` status
   - Response headers should include `access-control-allow-origin`

## CORS Rules Explanation

| Field | Purpose |
|-------|---------|
| `AllowedOrigins` | Origins (domains) that can make requests. Must match your app URL exactly. |
| `AllowedMethods` | HTTP methods the browser can use. `PUT` is required for uploads. |
| `AllowedHeaders` | Request headers the browser can send. `*` allows all headers. |
| `ExposeHeaders` | Response headers the browser JavaScript can read. `ETag` is required for multipart uploads. |
| `MaxAgeSeconds` | How long the browser caches the CORS preflight response (1 hour). |

## Security Notes

### ✅ This Configuration is SAFE

- **CORS does NOT make your bucket public**
- Files are still private and require presigned URLs
- CORS only allows your web app to make requests
- Presigned URLs are time-limited (10 minutes) and signed with your secret key
- Only authenticated admins can generate presigned URLs via your API

### ❌ DO NOT Do This

```json
{
  "AllowedOrigins": ["*"]  // ❌ Allows any website to upload
}
```

Always specify exact origins.

## Testing After Configuration

### 1. Test in Browser Console

After configuring CORS, open http://localhost:3001/admin/products/new and:

```javascript
// Should see in console:
✓ Presigned URLs generated
✓ Uploading part 1/X
✓ Part 1 uploaded (ETag: "...")
✓ Upload complete
```

### 2. Check Network Tab

Look for:
- ✅ OPTIONS request to R2: `200 OK`
- ✅ PUT request to R2: `200 OK`
- ✅ Response header: `access-control-allow-origin: http://localhost:3001`
- ✅ Response header: `etag: "..."`

### 3. Expected Success Flow

```
1. Click "Upload STL"
2. File initiation → ✓
3. Generate presigned URLs → ✓
4. Upload part 1 → ✓ (was failing before)
5. Upload part 2-N → ✓
6. Complete upload → ✓
7. Save product → ✓
8. Redirect to product list → ✓
```

## If Still Failing After CORS Configuration

### Check 1: Origin Matches Exactly

Your `.env.local` has:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

But your dev server runs on `http://localhost:3001`.

Make sure CORS includes the **actual port you're using**.

### Check 2: Verify CORS Applied

Test with curl:
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" \
  -v \
  "https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com/mivo-stl-originals/test"
```

Should show:
```
< HTTP/2 200
< access-control-allow-origin: http://localhost:3001
< access-control-allow-methods: GET, PUT, POST, DELETE, HEAD
```

### Check 3: Bucket Name and Endpoint

Verify in `lib/r2/client.ts`:
- Account ID: `922c7d5676102f7db5db130c3f046acd`
- Bucket: `mivo-stl-originals`
- Endpoint: `https://922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com`

All look correct.

## Alternative: Custom Domain (Optional)

If you want to avoid CORS entirely, you can:

1. Connect a custom domain to R2 bucket
2. Configure Next.js to proxy uploads through your API
3. Upload to `/api/r2/proxy` instead of direct R2 URLs

This is more complex but eliminates CORS issues. Not recommended unless CORS configuration doesn't work.

## Summary

**Immediate Action Required**:

1. Go to Cloudflare Dashboard → R2 → mivo-stl-originals → Settings → CORS Policy
2. Add the CORS configuration shown above
3. Save and wait 1-2 minutes
4. Test upload again

**Expected Result**:

Upload should succeed with proper CORS configuration. The error "Failed to fetch" will be replaced with successful upload progress.
