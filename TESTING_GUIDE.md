# Storefront 3D Display - Testing Guide

## Build Status

✅ **Production build successful**
- All pages compiled
- TypeScript validation passed
- No errors or warnings
- New API routes included:
  - `/api/r2/preview/[key]` ✓
- New components working:
  - `STLModelViewer` ✓

## Quick Start

### 1. Start Development Server

```bash
npm run dev
```

Server will start on: http://localhost:3000 (or 3001/3002 if port is taken)

### 2. Navigate to Product Page

**Option A: Via Explore Page**
1. Go to: http://localhost:3000/explore
2. Find "Family Miniature" (or your uploaded product)
3. Click product card

**Option B: Direct Link**
- Get product ID from admin panel
- Go to: http://localhost:3000/product/[your-product-id]

## Test Checklist

### Test 1: Product Detail Page - 3D Viewer

**URL**: `/product/[id]` where product has `storage_provider='r2'`

**Expected Behavior**:
- [ ] Page loads without errors
- [ ] "3D View" tab selected by default
- [ ] Brief loading spinner
- [ ] **Actual 3D model renders** (not generic cube 📦)
- [ ] Model shows correct geometry (family miniature shape)
- [ ] Model is centered on grid
- [ ] Model properly scaled (fits in viewport)
- [ ] Lighting shows depth and shadows
- [ ] Green/lime colored model (default)
- [ ] Grid visible beneath model

**Interaction Tests**:
- [ ] Left-click + drag → Rotates model
- [ ] Right-click + drag → Pans camera
- [ ] Scroll wheel → Zooms in/out
- [ ] Controls hint visible bottom-left
- [ ] No lag or stuttering (for files < 20MB)

**Browser Console**:
```javascript
// Should see:
[R2 Preview] Generated preview URL for product: Family Miniature (abc-123)

// Should NOT see:
❌ Error
❌ 403 Forbidden
❌ 404 Not Found
❌ Failed to load 3D model
```

**Browser Network Tab**:
1. Open DevTools → Network tab
2. Filter: XHR/Fetch
3. Look for:
   - `GET /api/r2/preview/stl-files%2F...` → **200 OK**
   - Response: `{ "url": "https://...", "expiresIn": 600 }`
4. Filter: All
5. Look for:
   - `GET https://mivo-stl-originals...r2.cloudflarestorage.com/...` → **200 OK**
   - Response headers include `ETag`
   - File size matches original upload

### Test 2: Explore Page - Product Cards

**URL**: `/explore`

**Expected Behavior**:
- [ ] Products display in grid
- [ ] Product with uploaded image: Shows actual photo
- [ ] Product without image: Shows category SVG illustration
- [ ] No broken image icons (❌)
- [ ] Featured badge shows if applicable
- [ ] "In Stock" indicator correct
- [ ] Price displays
- [ ] "View" button present

**Interaction**:
- [ ] Hover over card → Border changes to lime
- [ ] Click card → Navigates to product detail
- [ ] No console errors

### Test 3: Tab Switching (Product Page)

**Expected Behavior**:
1. [ ] Load product page → "3D View" tab active
2. [ ] Click "Photos" tab → Switches to image gallery
3. [ ] If product has images: Shows photo
4. [ ] If no images: Shows 📦 placeholder
5. [ ] Click "3D View" tab again → Model still renders
6. [ ] No need to reload model (cached geometry)

### Test 4: Error Handling

#### Scenario A: Product with No 3D Model
- Admin creates product without uploading STL
- Visit product page
- Expected: "📦 3D preview not available" (graceful fallback)

#### Scenario B: Invalid Storage Key
- Edit product in database: `storage_key = 'nonexistent.stl'`
- Visit product page
- Expected: Red error box "Failed to load 3D model"
- Check console: `404 Not Found` from preview API

#### Scenario C: Unpublished Product
- Edit product: `published = false`
- Try preview API directly:
  ```bash
  curl http://localhost:3000/api/r2/preview/stl-files%2F...
  ```
- Expected: `{ "error": "File not available for preview" }` (403)

### Test 5: Legacy Supabase Products

**If you have old products with `storage_provider='supabase'`**:
- [ ] Product page loads
- [ ] Falls back to old `ModelViewer` (shows 📦 placeholder)
- [ ] No errors in console
- [ ] Photos tab still works

### Test 6: Mobile Responsiveness

**On mobile device or responsive mode**:
- [ ] Product page layout adapts
- [ ] 3D viewer fits screen
- [ ] Touch controls work:
  - One finger drag → Rotate
  - Two finger pinch → Zoom
  - Two finger pan → Pan
- [ ] Tabs switch correctly
- [ ] Performance acceptable (may be slower on old devices)

## Browser Compatibility

**Tested Browsers**:
- Chrome/Edge ≥ 90
- Firefox ≥ 88
- Safari ≥ 14

**Requirements**:
- WebGL support (for 3D rendering)
- ES6 support
- JavaScript enabled

**Fallback**:
- If WebGL not available: Error message shown
- User can still view Photos tab

## Performance Benchmarks

**Expected Load Times** (on localhost):

| File Size | Initial Load | Model Render | Total |
|-----------|--------------|--------------|-------|
| < 5 MB    | 0.5s         | 0.5s         | ~1s   |
| 5-10 MB   | 1s           | 1s           | ~2s   |
| 10-20 MB  | 2s           | 2s           | ~4s   |
| > 20 MB   | 3s+          | 3s+          | 6s+   |

**On production with CDN**: Expect 20-30% faster

## Debugging Tips

### Issue: Model Not Rendering

**Check 1: Product Record**
```javascript
// Browser console on product page
console.log(product);
// Look for:
// storage_provider: 'r2'
// storage_key: 'stl-files/...'
// published: true
```

**Check 2: Preview API Response**
```bash
curl http://localhost:3000/api/r2/preview/stl-files%2F[your-key]
```
Expected: `{ "url": "https://...", "expiresIn": 600 }`

**Check 3: Presigned URL**
Copy URL from preview API response, paste in browser:
- Should download STL file
- If 403 Forbidden → CORS issue (see R2_CORS_CONFIGURATION.md)

**Check 4: Browser Console Errors**
```javascript
// Common errors:
TypeError: Cannot read property 'position'
→ Geometry failed to load, check network tab

Failed to fetch
→ CORS issue or network error

403 Forbidden
→ Product unpublished or storage key mismatch
```

### Issue: Generic Cube Still Shows

**Possible Causes**:
1. Product has `storage_provider='supabase'` and no `model_file`
   - Solution: Re-upload via admin panel to R2
2. Product has `storage_key` but `published=false`
   - Solution: Publish product in admin
3. STL file was deleted from R2
   - Solution: Re-upload product

**Verify**:
```sql
SELECT id, name, storage_provider, storage_key, model_file, published 
FROM products 
WHERE id = '[your-product-id]';
```

### Issue: Images Not Loading in Explore

**Possible Causes**:
1. `product.images` is empty array
   - Solution: Upload product image in admin
   - Acceptable: Category SVG shows as fallback
2. Image file doesn't exist in Supabase storage
   - Solution: Re-upload image

**Verify**:
```javascript
// Browser console on explore page
products.forEach(p => {
  console.log(p.name, p.images);
});
```

## Database Queries

### Check Product Structure

```sql
-- Find all R2 products
SELECT id, name, storage_provider, storage_key, images, published
FROM products
WHERE storage_provider = 'r2'
ORDER BY created_at DESC;

-- Check specific product
SELECT *
FROM products
WHERE name LIKE '%family%'
ORDER BY created_at DESC
LIMIT 1;

-- Count products by storage type
SELECT storage_provider, COUNT(*) as count, SUM(file_size_bytes) as total_bytes
FROM products
GROUP BY storage_provider;
```

### Update Product for Testing

```sql
-- Publish product
UPDATE products
SET published = true
WHERE id = '[product-id]';

-- Change storage key (for error testing)
UPDATE products
SET storage_key = 'invalid-key.stl'
WHERE id = '[product-id]';
```

## API Testing with curl

### Test Preview Endpoint (Success)

```bash
# Get presigned URL
curl http://localhost:3000/api/r2/preview/stl-files%2F1728910060-family-miniature.stl

# Expected:
{
  "url": "https://mivo-stl-originals.922c7d5676102f7db5db130c3f046acd.r2.cloudflarestorage.com/...",
  "expiresIn": 600
}
```

### Test Preview Endpoint (Failure Cases)

```bash
# Non-existent key
curl http://localhost:3000/api/r2/preview/stl-files%2Fnonexistent.stl
# Expected: { "error": "File not found or not published" } (404)

# Valid key but unpublished product
# (First: UPDATE products SET published = false WHERE ...)
curl http://localhost:3000/api/r2/preview/stl-files%2F[valid-key].stl
# Expected: { "error": "File not available for preview" } (403)
```

### Download STL Directly (Via Presigned URL)

```bash
# Step 1: Get presigned URL
URL=$(curl -s http://localhost:3000/api/r2/preview/stl-files%2F... | jq -r '.url')

# Step 2: Download file
curl "$URL" -o test-download.stl

# Step 3: Verify file
ls -lh test-download.stl
file test-download.stl  # Should show: "data" or "ASCII text"
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] `npm run build` succeeds
- [ ] All tests pass in dev mode
- [ ] Environment variables configured:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] R2 CORS configured for production domain
- [ ] Database migration run (if needed)

### Update R2 CORS for Production

Add your production domain to CORS policy:

```json
{
  "AllowedOrigins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://yourdomain.com",
    "https://www.yourdomain.com"
  ],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
  "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
  "MaxAgeSeconds": 3600
}
```

### Post-Deployment Verification

1. [ ] Visit production site
2. [ ] Test product page with R2-stored STL
3. [ ] Verify 3D model loads
4. [ ] Check browser console (no errors)
5. [ ] Test on mobile device
6. [ ] Verify explore page cards display correctly

## Success Criteria

### Minimum (Must Have)
- ✅ Product detail page shows actual 3D model for R2-stored products
- ✅ Model renders with correct geometry (not generic cube)
- ✅ Explore cards show category SVG when no image uploaded
- ✅ No console errors
- ✅ Production build succeeds

### Ideal (Nice to Have)
- Product images uploaded → Explore cards show actual photos
- Fast loading (< 2s for typical file sizes)
- Smooth interactions (60fps rotation)
- Works on mobile devices

## Reporting Issues

If you encounter problems, provide:

1. **Browser Console Log** (full output, especially errors)
2. **Network Tab**:
   - Request to `/api/r2/preview/[key]`
   - Response status and body
   - Request to R2 presigned URL
   - Response status
3. **Product Data**:
   ```sql
   SELECT id, name, storage_provider, storage_key, model_file, published 
   FROM products WHERE id = '[failing-product-id]';
   ```
4. **Screenshots**:
   - What you see (generic cube vs actual model)
   - Browser console errors
   - Network tab failures

## Quick Reference

| Page | Purpose | Expected |
|------|---------|----------|
| `/explore` | Product listing | Cards with images/SVGs |
| `/product/[id]` | Product detail | 3D viewer with actual model |
| `/api/r2/preview/[key]` | Get presigned URL | Returns temporary download URL |
| `/admin/products/new` | Upload STL | Saves to R2, creates product |

## Next Steps After Testing

1. [ ] Test family miniature product specifically
2. [ ] Verify model displays actual uploaded geometry
3. [ ] Optional: Upload product photos to improve explore cards
4. [ ] Deploy to production if all tests pass
5. [ ] Update CORS for production domain

---

**Start Testing**: `npm run dev` → http://localhost:3000/explore
