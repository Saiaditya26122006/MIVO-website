# MIVO Admin Dashboard Setup Guide

This guide walks you through setting up the complete MIVO admin dashboard with product management, STL upload, and 3D preview capabilities.

## Overview

The admin system includes:
- ✅ Secure authentication with Supabase Auth
- ✅ Protected admin routes with middleware
- ✅ Product creation with STL file upload
- ✅ Interactive 3D STL preview with Three.js
- ✅ Product image upload
- ✅ Draft and publish workflow
- ✅ Product management dashboard
- ✅ Order and quote management foundations
- ✅ Persistent database storage with Supabase

## Prerequisites

- Node.js 18+ installed
- A [Supabase](https://supabase.com) account (free tier works)
- Git (optional)

## Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: MIVO Store
   - **Database Password**: (generate a strong password - save it!)
   - **Region**: Choose closest to your location
4. Click "Create new project" and wait ~2 minutes for setup

## Step 2: Run Database Schema

1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it into the SQL editor
5. Click "Run" (or press Ctrl+Enter)
6. Verify: You should see "Success. No rows returned"

This creates all necessary tables, indexes, and security policies.

## Step 3: Create Storage Buckets

### Product Images Bucket (Public)
1. Go to **Storage** in Supabase dashboard
2. Click "Create a new bucket"
3. Name: `product-images`
4. Public bucket: ✅ **Enable**
5. Click "Create bucket"

### Product STL Files Bucket (Private)
1. Click "Create a new bucket" again
2. Name: `product-stl-files`
3. Public bucket: ❌ **Disable** (keep private)
4. Click "Create bucket"
5. Go to **Policies** tab
6. Add policy:
   - Name: "Authenticated users can upload"
   - Target: INSERT
   - Policy definition:
     ```sql
     (auth.role() = 'authenticated')
     ```

### Product Models Bucket (Public Read, Admin Write)
1. Click "Create a new bucket"
2. Name: `product-models`
3. Public bucket: ✅ **Enable**
4. This stores web-optimized 3D previews

## Step 4: Get Supabase Credentials

1. In Supabase dashboard, go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
   - **service_role** key (another long string, keep this SECRET!)

## Step 5: Configure Environment Variables

1. In your project root, create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   # Your admin credentials
   ADMIN_EMAIL=admin@mivo.in
   ADMIN_PASSWORD=your_secure_password
   
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **IMPORTANT**: Never commit `.env.local` to Git!

## Step 6: Create Admin User

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Fill in:
   - **Email**: `admin@mivo.in` (or your preferred admin email)
   - **Password**: (create a strong password - you'll use this to login)
   - **Auto Confirm User**: ✅ **Enable**
4. Click "Create user"

## Step 7: Install Dependencies

```bash
npm install
```

This installs:
- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Server-side auth
- `three` - 3D rendering
- `@react-three/fiber` - React Three.js wrapper
- `@react-three/drei` - Three.js helpers

## Step 8: Start Development Server

```bash
npm run dev
```

The app should start at http://localhost:3000

## Step 9: Test Admin Access

1. Navigate to http://localhost:3000/admin
2. You should be redirected to `/admin/login`
3. Enter your admin credentials:
   - Email: `admin@mivo.in`
   - Password: (the password you set in Supabase)
4. Click "Sign In"
5. You should see the admin dashboard!

## Step 10: Create Your First Product

1. Click "Add New Product" or go to `/admin/products/new`
2. Upload an STL file:
   - Click "Click to upload STL file"
   - Select any `.stl` file (max 50MB)
   - The 3D preview should load automatically
3. Fill in product details:
   - **Name**: e.g., "L298N Motor Driver Mount"
   - **Short Description**: Brief summary
   - **Price**: e.g., 150
   - **Category**: Select from dropdown
   - **Material**: Select material type
   - Check "In Stock"
4. Click "Publish Product"
5. If successful, you'll be redirected to `/admin/products`

## Step 11: Verify Public Product Display

1. Go to http://localhost:3000/explore
2. Your published product should appear in the catalogue
3. Click on the product to view its detail page
4. The 3D model should be visible (work in progress - requires viewer on detail page)

## Architecture

### Authentication Flow
```
User visits /admin → Middleware checks auth
  ↓ Not authenticated → Redirect to /admin/login
  ↓ Authenticated → Allow access
Admin pages use createClient() from lib/supabase/server
Client components use createClient() from lib/supabase/client
```

### File Upload Flow
```
1. User selects STL file
2. STLViewer component loads and displays 3D preview
3. On publish:
   a. Upload STL to supabase.storage (product-stl-files bucket)
   b. Upload product image to supabase.storage (product-images bucket)
   c. Create product record in database with file paths
   d. Set published=true for live visibility
```

### Database Structure
```
products (main product data)
├── id (UUID, primary key)
├── name, description, long_description
├── price, category, tags[]
├── images[] (array of storage paths)
├── model_file (STL storage path)
├── in_stock, featured, published (boolean flags)
└── specifications (JSON for material, dimensions, etc.)

product_variants (optional product variations)
orders (customer orders)
order_items (order line items)
custom_quotes (custom quote requests)
```

### Security

✅ **Authentication**: Supabase Auth with email/password
✅ **Authorization**: Row Level Security (RLS) policies
✅ **Protected Routes**: Middleware checks on all `/admin/*` routes
✅ **Private Files**: Original STL files in private bucket
✅ **Public Products**: Only `published=true` products visible on storefront

### STL Viewer Details

The 3D viewer uses:
- **Three.js**: WebGL 3D rendering
- **React Three Fiber**: React bindings for Three.js
- **@react-three/drei**: Helper components (OrbitControls, Center)
- **STLLoader**: Parses binary and ASCII STL files

Features:
- ✅ Rotate: Left-click + drag
- ✅ Pan: Right-click + drag
- ✅ Zoom: Mouse wheel
- ✅ Auto-center and fit model to viewport
- ✅ Configurable preview color
- ✅ Loading states and error handling
- ✅ Works with files up to 50MB

## Troubleshooting

### "Failed to fetch" on login
- Check `.env.local` has correct NEXT_PUBLIC_SUPABASE_URL
- Verify Supabase project is running (not paused)
- Check browser console for CORS errors

### STL viewer shows white/blank
- Ensure STL file is valid (try opening in other 3D software)
- Check browser console for WebGL errors
- Try different preview colors (white model on white background)

### Products not appearing in /explore
- Verify product has `published=true` in database
- Check Supabase dashboard → Table Editor → products
- Refresh the page (data may be cached)

### Storage upload fails
- Verify storage buckets exist with correct names
- Check storage policies allow authenticated uploads
- Ensure file size is under limits (50MB for STL, 5MB for images)

### Build errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

### TypeScript errors
```bash
# Regenerate types from Supabase
npx supabase gen types typescript --project-id your-project-id > lib/supabase/database.types.ts
```

## Production Deployment

### Environment Variables
Set these in your hosting platform (Vercel, etc.):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your production domain)

### Storage CORS
1. In Supabase dashboard → Storage → Configuration
2. Add your production domain to allowed origins

### Database Backups
- Supabase free tier: Daily backups (7 days retention)
- Pro tier: Point-in-time recovery

## Next Steps

### Immediate Enhancements
1. **Product Edit Page**: Create `/admin/products/[id]/edit` to modify existing products
2. **Unpublish Products**: Add toggle to set `published=false`
3. **Bulk Actions**: Select multiple products to publish/unpublish/delete
4. **Image Gallery**: Support multiple product images
5. **Thumbnail Generation**: Auto-capture 3D preview as thumbnail

### Advanced Features
1. **Order Management**: Build complete order workflow
2. **Quote Response**: Email integration for quote replies
3. **Analytics**: Product views, conversion rates
4. **Inventory Tracking**: Stock levels, low stock alerts
5. **Product Variants**: Colors, sizes, material options
6. **Pricing Rules**: Discounts, bulk pricing

### Public Store Integration
1. **Product Detail 3D Viewer**: Show interactive STL on product pages
2. **Download STL**: Allow customers to download models (if selling files)
3. **Customization Tool**: Let customers modify parameters before ordering
4. **AR Preview**: View products in augmented reality

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Three.js Docs**: https://threejs.org/docs
- **Next.js Docs**: https://nextjs.org/docs

## Security Checklist

Before going live:
- [ ] Change default admin password
- [ ] Review all RLS policies
- [ ] Set up storage access logs
- [ ] Enable Supabase email rate limiting
- [ ] Add CAPTCHA to public forms
- [ ] Review middleware authentication logic
- [ ] Audit file upload size limits
- [ ] Test with malicious file uploads
- [ ] Enable Supabase database backups
- [ ] Document admin procedures

---

**You now have a fully functional admin dashboard for MIVO!**

Upload STL files, preview them in 3D, publish products, and manage your entire catalogue without touching any code.
