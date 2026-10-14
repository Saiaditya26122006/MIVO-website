# MIVO Admin - Quick Start Guide

Get your admin dashboard running in 7 minutes.

## Prerequisites
- Node.js 18+ installed
- A [Supabase](https://supabase.com) account (free)

## Step 1: Create Supabase Project (2 min)

1. Go to https://app.supabase.com
2. Click "New Project"
3. Name: **MIVO Store**
4. Generate a strong database password (save it!)
5. Choose your region
6. Click "Create new project"
7. Wait ~2 minutes for provisioning

## Step 2: Setup Database (1 min)

1. In Supabase dashboard → **SQL Editor**
2. Click "New query"
3. Copy entire contents of `supabase-schema.sql`
4. Paste and click "Run"
5. Verify: "Success. No rows returned"

## Step 3: Create Storage Buckets (2 min)

### Bucket 1: product-images
1. Go to **Storage** → "Create bucket"
2. Name: `product-images`
3. Public: ✅ **Yes**
4. Create

### Bucket 2: product-stl-files
1. "Create bucket" again
2. Name: `product-stl-files`
3. Public: ❌ **No**
4. Create
5. Go to **Policies** tab
6. Add policy:
   - Target: INSERT
   - Policy: `(auth.role() = 'authenticated')`
7. Save

## Step 4: Create Admin User (1 min)

1. **Authentication** → **Users** → "Add user"
2. Email: `admin@mivo.in`
3. Password: (create strong password)
4. Auto Confirm: ✅ **Yes**
5. Create

## Step 5: Configure Environment (1 min)

1. In Supabase → **Settings** → **API**
2. Copy:
   - Project URL
   - anon public key
   - service_role key (⚠️ keep secret!)

3. Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-key

ADMIN_EMAIL=admin@mivo.in
ADMIN_PASSWORD=your_password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 6: Start! (30 sec)

```bash
npm install  # if not done yet
npm run dev
```

## Step 7: Login

1. Go to http://localhost:3000/admin
2. Login with `admin@mivo.in` and your password
3. You're in! 🎉

## Test the Full Workflow

1. Click "Add New Product"
2. Upload an STL file (any `.stl` file)
3. Watch it render in 3D
4. Fill in:
   - Name: "Test Product"
   - Description: "Testing the system"
   - Price: 100
   - Category: Robotics
5. Click "Publish Product"
6. Go to http://localhost:3000/explore
7. Your product should appear!

---

## Troubleshooting

**"Failed to fetch" on login**
- Check your `.env.local` has correct URL and keys
- Verify Supabase project is not paused

**Build fails**
- Ensure `.env.local` is created with valid credentials
- Run `rm -rf .next && npm run build`

**STL viewer is blank**
- Try different preview colors (white model on white background)
- Check browser console for errors
- Verify STL file is valid

---

## What's Next?

- See `ADMIN_SETUP.md` for detailed configuration
- See `ADMIN_IMPLEMENTATION_STATUS.md` for technical details
- Build more products!
- Customize categories and materials
- Share your store at http://localhost:3000

## Support

Need help? Check these:
- `ADMIN_SETUP.md` - Full setup guide
- `ADMIN_IMPLEMENTATION_STATUS.md` - Technical reference
- Supabase Docs: https://supabase.com/docs
- Three.js Docs: https://threejs.org/docs

---

**You're ready to manage your MIVO store!** 🚀
