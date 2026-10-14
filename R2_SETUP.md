# Cloudflare R2 Setup Guide

This document explains how to configure Cloudflare R2 for storing large STL files in the MIVO platform.

## Why R2?

- **Cost-effective**: No egress fees, unlike S3
- **Unlimited file sizes**: Support for files over 1GB
- **S3-compatible**: Uses standard S3 API
- **Private storage**: Secure storage with presigned URL access

## Setup Steps

### 1. Create R2 Bucket

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name: `mivo-stl-originals` (or your preferred name)
5. Location: Choose closest to your users (or "Automatic")
6. Click **Create bucket**

⚠️ **Important**: Keep the bucket **private** (default). Do not enable public access.

### 2. Create API Token

1. In R2 section, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Settings:
   - **Token name**: `mivo-stl-upload`
   - **Permissions**: Object Read & Write
   - **TTL**: Never expire (or set custom expiry)
   - **Bucket scope**: Apply to specific bucket → `mivo-stl-originals`
4. Click **Create API Token**
5. **Copy and save** the following values (they won't be shown again):
   - Account ID
   - Access Key ID
   - Secret Access Key

### 3. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=mivo-stl-originals
```

⚠️ **Security**: Never commit `.env.local` to version control. It's already in `.gitignore`.

### 4. Run Database Migration

Run the SQL migration to add R2 support to the database:

1. Open [Supabase SQL Editor](https://app.supabase.com)
2. Copy the contents of `supabase-r2-migration.sql`
3. Paste into SQL Editor
4. Click **Run**

This adds the following columns to the `products` table:
- `storage_provider` - 'supabase' or 'r2'
- `storage_key` - R2 object key
- `file_size_bytes` - Original file size
- `storage_metadata` - Additional metadata (upload timestamps, etc.)

### 5. Test the Integration

1. Start the development server: `npm run dev`
2. Log into admin dashboard: `http://localhost:3000/admin`
3. Create a new product with an STL file
4. Monitor the console for upload progress
5. Verify the product is created successfully

## Architecture

### Upload Flow

```
Browser (Admin)
    ↓
    1. Initiate upload → POST /api/r2/upload/initiate
    ↓
    2. Get presigned URLs → POST /api/r2/upload/part-urls
    ↓
    3. Upload parts directly to R2 (multipart)
    ↓
    4. Complete upload → POST /api/r2/upload/complete
    ↓
    5. Save metadata to Supabase products table
```

### Storage Locations

- **Original STL files**: Cloudflare R2 (private)
- **Product images**: Supabase Storage (public)
- **Product metadata**: Supabase PostgreSQL
- **Authentication**: Supabase Auth

### Security

- ✅ All R2 operations require admin authentication
- ✅ Presigned URLs expire in 5-10 minutes
- ✅ R2 bucket is private (no public access)
- ✅ Credentials never exposed in client code
- ✅ Server-side validation on all API routes

## File Size Limits

- **Supabase Free plan**: 50MB per file (not used for STL files)
- **Cloudflare R2**: No practical limit (supports multi-GB files)
- **Multipart upload**: Files split into 10MB parts

## Cost Estimates

Cloudflare R2 pricing (as of 2024):

- **Storage**: $0.015 per GB/month
- **Class A operations** (writes): $4.50 per million
- **Class B operations** (reads): $0.36 per million
- **Egress**: Free (no bandwidth charges)

Example: 100GB storage + 1000 uploads/month + 5000 downloads/month ≈ $2/month

## Troubleshooting

### "Missing required R2 environment variables"

**Cause**: Environment variables not loaded

**Fix**:
1. Verify `.env.local` file exists in project root
2. Restart the development server
3. Check variable names match exactly

### "Failed to initiate upload: No UploadId returned"

**Cause**: Invalid R2 credentials or permissions

**Fix**:
1. Verify API token has "Object Read & Write" permissions
2. Verify bucket name matches token scope
3. Check Account ID is correct

### "Unauthorized" errors

**Cause**: Not logged in as admin

**Fix**:
1. Verify you're logged in at `/admin/login`
2. Check `ADMIN_EMAIL` in `.env.local` matches your login email
3. Clear browser cookies and re-login

### Upload fails for large files

**Cause**: Network timeout or interruption

**Fix**:
- Upload includes automatic retry logic (3 attempts per part)
- Check network connection is stable
- Try reducing `partSize` in `multipart-uploader.ts` (currently 10MB)

## Monitoring

Check R2 usage and costs:
1. Cloudflare Dashboard → R2
2. Select your bucket
3. View **Metrics** tab

## Backup Recommendations

- Enable **Object Lifecycle Rules** in R2 for automatic cleanup of old files
- Consider periodic backups of Supabase database (includes R2 keys)
- Keep R2 API tokens secure and rotate periodically

## Support

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [MIVO Issues](https://github.com/your-org/mivo/issues)
