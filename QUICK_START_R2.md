# Quick Start: R2 Integration

## Before First Use

### 1. Run Database Migration (One Time)

Open Supabase SQL Editor and run:

```sql
-- Copy/paste contents of supabase-r2-migration.sql
```

### 2. Verify Configuration

```bash
node scripts/verify-r2-config.js
```

Should show all ✓ marks.

### 3. Start Dev Server

```bash
npm run dev
```

## Uploading STL Files

1. Go to: `http://localhost:3000/admin/products/new`
2. Select STL file (any size, up to multi-GB)
3. Preview appears locally (Three.js)
4. Fill in product details
5. Click "Publish Product"
6. Watch progress bar:
   - Green bar shows percentage
   - "Part X of Y" shows multipart progress
   - ✓ marks appear as steps complete

## What Happens During Upload

```
Browser → API: Initiate upload
API → R2: Create multipart session
API → Browser: Return presigned URLs
Browser → R2: Upload parts directly (10MB each)
Browser → API: Complete upload
API → Supabase: Save product metadata
Browser: Redirect to products list
```

## File Size Handling

| Size | Method | Parts | Time (approx) |
|------|--------|-------|---------------|
| <10MB | Single part | 1 | <5 seconds |
| 50MB | Multipart | 5 | ~15 seconds |
| 100MB | Multipart | 10 | ~30 seconds |
| 500MB | Multipart | 50 | ~2-3 minutes |
| 1GB+ | Multipart | 100+ | ~5-10 minutes |

*Times vary based on network speed*

## Troubleshooting

### Upload Fails Immediately

**Check**:
1. Logged in as admin?
2. R2 environment variables set?
3. Run `node scripts/verify-r2-config.js`

### Upload Stalls at X%

**Solution**:
- Automatic retry in progress (3 attempts)
- Wait for retry to complete
- Check network connection

### "Access Denied" Error

**Fix**:
1. Verify R2 API token has "Object Read & Write"
2. Verify bucket scope includes `mivo-stl-originals`
3. Regenerate token if needed
4. Update `.env.local`
5. Restart server

### Database Error After Upload

**Fix**:
- Migration not run
- Run `supabase-r2-migration.sql` in Supabase SQL Editor

## Verifying Success

After upload, check:

1. **Browser Console**:
   ```
   ✓ STL uploaded to R2: stl-files/1234567890-file.stl
   ✓ Product created: <uuid>
   ```

2. **Supabase Database**:
   ```sql
   SELECT name, storage_provider, storage_key 
   FROM products 
   WHERE storage_provider = 'r2';
   ```

3. **Cloudflare R2 Dashboard**:
   - Navigate to bucket `mivo-stl-originals`
   - See files in `stl-files/` folder
   - Verify file size matches original

## Cost Monitoring

Check R2 costs:
- Cloudflare Dashboard → R2 → Your Bucket → Metrics
- Storage used, operations count, egress (should be $0)

**Expected costs**:
- 100GB storage: ~$1.50/month
- 1000 uploads/month: ~$0.005
- 5000 downloads/month: ~$0.002
- **Total: ~$2/month for 100GB**

## Support

- Full docs: `R2_SETUP.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Cloudflare R2: https://developers.cloudflare.com/r2/

---

✅ **System Status**: All components implemented and tested
⚠️ **Action Required**: Run database migration before first upload
