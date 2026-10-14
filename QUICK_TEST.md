# Quick Testing Guide - MIVO Photo-Based Products

## Start Testing Immediately

```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## Test 1: Admin - Create Product with Photos (5 minutes)

### URL
http://localhost:3000/admin/products/new

### Steps
1. **Login** (if not already)
   - Email: `saiadityatalluri@gmail.com`
   - Password: Your admin password

2. **Upload Images**
   - Click "Click to upload images"
   - Select 2-3 product photos
   - ✅ Verify thumbnails appear
   - ✅ Try reordering with ↑↓ buttons
   - ✅ Try removing one image with ✕

3. **Fill Product Details**
   - Name: "Test Product"
   - Description: "A test product with multiple photos"
   - Long Description: "This is a detailed description..."
   - Price: 199
   - Material: PLA
   - Dimensions: "10cm x 5cm"
   - Weight: "50g"
   - Color: "Black"
   - Check "In Stock"

4. **Publish**
   - Click "Publish Product"
   - ✅ Should redirect to products list
   - ✅ Verify product appears

### What to Check
- ❌ No STL upload field (removed)
- ✅ Multiple images work
- ✅ Reordering works
- ✅ Product saves successfully

---

## Test 2: Public Product Page (2 minutes)

### URL
http://localhost:3000/explore → Click product

### Steps
1. Navigate to explore page
2. Click any product with images
3. Check product detail page

### What to Check
- ❌ No 3D View / Photos tabs (removed)
- ✅ Main product image displays
- ✅ Thumbnails below (if multiple images)
- ✅ Clicking thumbnail changes main image
- ✅ Product name, price, description visible
- ✅ "Order Now via WhatsApp" button present
- ✅ Quantity selector works

---

## Test 3: WhatsApp Integration (1 minute)

### Steps
1. On product page
2. Adjust quantity to 2
3. Click "Order Now via WhatsApp"

### What to Check
- ✅ WhatsApp opens (new tab/window)
- ✅ Message includes:
  - Product name
  - Quantity
  - Price
  - Request text

**Note**: Phone number needs updating - see PHOTO_BASED_MIGRATION.md

---

## Test 4: Explore Cards (1 minute)

### URL
http://localhost:3000/explore

### What to Check
- ✅ Products with images show photos
- ✅ Products without images show category SVG (fallback)
- ❌ No broken image icons
- ✅ All cards clickable

---

## Common Issues & Fixes

### Issue: Images Not Showing
**Check**: Browser console for 404 errors  
**Fix**: Verify Supabase `product-images` bucket is public

### Issue: Order Button Shows "YOUR_PHONE"
**Location**: `app/product/[id]/page.tsx` line 79  
**Fix**: Replace with actual WhatsApp number (format: 919876543210)

### Issue: Old Products Show Placeholder
**Expected**: Products without `images` array show placeholder  
**Not a bug**: This is correct behavior

---

## Success Criteria

### Admin
- ✅ Can create products with multiple photos
- ✅ No STL upload required
- ✅ Image reordering works
- ✅ Products save successfully

### Public
- ✅ Photo galleries display correctly
- ✅ Thumbnails navigation works
- ✅ Order button functional
- ✅ No 3D viewer remnants
- ✅ Mobile responsive

---

## Files Changed

**Modified** (3 files):
- `app/product/[id]/page.tsx` - Photo gallery + Order button
- `app/admin/products/new/page.tsx` - Multiple image upload
- `app/custom/page.tsx` - Updated file upload text

**Build Status**: ✅ Success

---

## Next Steps

1. ✅ Test admin product creation
2. ✅ Test public product viewing  
3. ⏳ Update WhatsApp phone number
4. ⏳ Deploy when satisfied

---

**Full Documentation**: See `PHOTO_BASED_MIGRATION.md`
