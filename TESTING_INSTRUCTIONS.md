# MIVO Configurable Pricing — Testing Instructions

## Pre-Testing Setup

### 1. Database Migration

**IMPORTANT**: Run this first before testing anything!

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `supabase-pricing-migration.sql`
5. Click "Run" or press Cmd/Ctrl+Enter
6. Verify success message appears
7. Check that migration completed:

```sql
-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('pricing_method', 'pricing_config', 'production_time_days', 'min_quantity', 'max_quantity');
```

You should see all 5 new columns.

### 2. Start Development Server

```bash
npm run dev
```

Wait for "✓ Ready" message.

### 3. Login to Admin

Navigate to: `http://localhost:3000/admin/login`

Use your admin credentials (email from Supabase Auth).

---

## Test Scenario 1: Fixed Price Product

**Goal**: Create a simple product with one price.

### Steps

1. Navigate to `/admin/products/new`
2. Fill in basic information:
   - **Name**: "Cable Organizer - Small"
   - **Description**: "Compact cable organizer for desks"
   - **Long Description**: "Perfect for managing USB cables and charging cords on your desk or workstation."
   - **Category**: "organization"

3. **Upload Images**:
   - Click "Click to upload images"
   - Select 2-3 product photos
   - Verify thumbnails appear
   - Verify first image shows "Main Image" label

4. **Pricing Configuration**:
   - **Pricing Method**: Select "Fixed Price"
   - **Base Price**: Enter "199"
   - **Production Time**: "3" days
   - **Min Quantity**: "1"
   - **Max Quantity**: "50"

5. **Specifications**:
   - **Material**: "PLA"
   - **Dimensions**: "8x5x2cm"
   - **Weight**: "15g"
   - **Color**: "Black"

6. **Publishing**:
   - Check "In Stock"
   - Check "Featured" (optional)
   - Add tags: "organizer, cables, desk" (comma-separated)

7. Click **"Publish Product"**

### Expected Results

- ✅ Redirect to `/admin/products`
- ✅ Product appears in products list
- ✅ No errors in browser console

### Verification

1. Navigate to `/explore`
2. Find your product
3. **Verify pricing label shows**: "₹199" (exact price, no "Starting from")
4. Click product card
5. **On product detail page**:
   - ✅ Price shows "₹199"
   - ✅ No configuration widget visible
   - ✅ Quantity selector works (1-50)
   - ✅ "Order Now via WhatsApp" button enabled

6. Click "Order Now"
7. **WhatsApp message should contain**:
   - Product name
   - Quantity: 1
   - Price: ₹199
   - Product URL

---

## Test Scenario 2: Configurable Product (All Options)

**Goal**: Create a product with sizes, materials, and colors.

### Steps

1. Navigate to `/admin/products/new`
2. Fill in basic information:
   - **Name**: "Custom Phone Stand"
   - **Description**: "Adjustable phone stand for desk use"
   - **Category**: "prototyping"

3. Upload images (2-3 photos)

4. **Pricing Configuration**:
   - **Pricing Method**: Select "Configurable Price"
   - **Base Price**: "199" (used as fallback)
   - **Production Time**: "5" days
   - **Min Quantity**: "1"
   - **Max Quantity**: "10"

5. **Configure Sizes**:
   - Click "+ Add Size"
   - **Size 1**:
     - Name: "Small"
     - Dimensions: "8x6x10cm"
     - Price: "199"
   - Click "+ Add Size"
   - **Size 2**:
     - Name: "Medium"
     - Dimensions: "10x8x12cm"
     - Price: "299"
   - Click "+ Add Size"
   - **Size 3**:
     - Name: "Large"
     - Dimensions: "12x10x15cm"
     - Price: "399"

6. **Configure Materials**:
   - Click "+ Add Material"
   - **Material 1**:
     - Name: "PLA"
     - Price Adjustment: "0"
   - Click "+ Add Material"
   - **Material 2**:
     - Name: "PETG"
     - Price Adjustment: "50"
   - Click "+ Add Material"
   - **Material 3**:
     - Name: "TPU"
     - Price Adjustment: "100"

7. **Configure Colors**:
   - Click "+ Add Color"
   - **Color 1**:
     - Name: "Black"
     - Additional Charge: "0"
   - Click "+ Add Color"
   - **Color 2**:
     - Name: "White"
     - Additional Charge: "0"
   - Click "+ Add Color"
   - **Color 3**:
     - Name: "Custom Color"
     - Additional Charge: "30"

8. **Test Reordering** (optional):
   - Use ↑↓ arrows to change size order
   - Verify sizes reorder correctly

9. Check "In Stock" and "Featured"

10. Click **"Publish Product"**

### Expected Results

- ✅ Redirect to products list
- ✅ Product saved successfully
- ✅ All configurations preserved

### Verification

1. Navigate to `/explore`
2. Find "Custom Phone Stand"
3. **Verify pricing label**: "Starting from ₹199"
4. Click product

5. **On product detail page**:
   - ✅ Shows "Estimated Price" card
   - ✅ Price shows "Configure options to see price" initially
   - ✅ Configuration widget visible with:
     - Size selector (3 options)
     - Material selector (3 options)
     - Color selector (3 options)

6. **Test configuration**:
   - Select **Small** size → Price updates to ₹199
   - Select **PLA** material → Price stays ₹199 (no adjustment)
   - Select **Black** color → Price stays ₹199 (no charge)
   - **Verify displayed**: "₹199.00 / unit" and "Total: ₹199.00"

7. **Change to more expensive configuration**:
   - Select **Large** size → Price updates to ₹399
   - Select **TPU** material → Price updates to ₹499 (399 + 100)
   - Select **Custom Color** → Price updates to ₹529 (399 + 100 + 30)
   - Set quantity to **2** → Total updates to ₹1,058

8. Click "Order Now via WhatsApp"

9. **Verify WhatsApp message contains**:
   - Product name: "Custom Phone Stand"
   - Size: Large (12x10x15cm)
   - Material: TPU
   - Color: Custom Color
   - Quantity: 2
   - Unit Price: ₹529.00
   - Total: ₹1058.00
   - Product URL

### Manual Price Calculation Check

Verify calculations are correct:

| Configuration | Size | Material | Color | Quantity | Unit Price | Total |
|--------------|------|----------|-------|----------|------------|-------|
| Config 1 | Small (₹199) | PLA (+₹0) | Black (+₹0) | 1 | ₹199 | ₹199 |
| Config 2 | Medium (₹299) | PETG (+₹50) | White (+₹0) | 1 | ₹349 | ₹349 |
| Config 3 | Large (₹399) | TPU (+₹100) | Custom (+₹30) | 2 | ₹529 | ₹1,058 |

---

## Test Scenario 3: Configurable Product (Sizes Only)

**Goal**: Create product with only size options (no materials/colors).

### Steps

1. Create new product: "Desk Bracket"
2. Select **Pricing Method**: "Configurable Price"
3. **Add 2 sizes**:
   - Small: 5x5x5cm, ₹99
   - Large: 10x10x10cm, ₹149
4. **Do NOT add materials or colors** — leave those sections empty
5. Publish

### Verification

1. View product on detail page
2. **Verify**:
   - ✅ Only size selector visible
   - ✅ Material section hidden
   - ✅ Color section hidden
   - ✅ Price updates correctly when changing size
   - ✅ Order button works

---

## Test Scenario 4: Quote-based Product

**Goal**: Create a product that requires custom quoting.

### Steps

1. Navigate to `/admin/products/new`
2. Basic info:
   - **Name**: "Large Custom Prototype"
   - **Description**: "Complex custom parts requiring individual quote"
   - **Category**: "prototyping"

3. Upload 1-2 reference images

4. **Pricing Configuration**:
   - **Pricing Method**: Select "Request Quote"
   - No price fields will be shown (this is correct)

5. Check "In Stock"
6. Publish

### Verification

1. Navigate to `/explore`
2. Find "Large Custom Prototype"
3. **Verify pricing label**: "Request a Quote"
4. **Verify button text**: "Get Quote" (not "View")
5. Click product

6. **On product detail page**:
   - ✅ No price displayed
   - ✅ Shows yellow "💬 Custom Quote Required" box
   - ✅ No configuration widget
   - ✅ No quantity selector
   - ✅ Button says "Request a Quote via WhatsApp"

7. Click quote button
8. **WhatsApp opens with**:
   - "I'd like a quote for:"
   - Product name
   - Product URL

---

## Test Scenario 5: Edit Existing Product

**Goal**: Change pricing method on existing product.

### Steps

1. Navigate to `/admin/products`
2. Find a product you created earlier (e.g., "Cable Organizer - Small")
3. Click "Edit" (if edit functionality exists)
4. **Change pricing method** from "Fixed" to "Configurable"
5. Add at least one size option
6. Save

### Verification

1. View product on catalog page
2. **Verify**: Label changed from "₹199" to "Starting from ₹[price]"
3. View product detail page
4. **Verify**: Configuration widget now appears

---

## Edge Case Testing

### Test 6: Validation — Configurable with No Options

**Goal**: Verify you can't publish broken configurable products.

1. Create new product
2. Select "Configurable Price"
3. Enter base price "199"
4. **Do NOT add any sizes, materials, or colors**
5. Try to publish

**Expected**: Form validation error: "Configurable products must have at least one size, material, or color option"

---

### Test 7: Quantity Boundaries

**Goal**: Test min/max quantity enforcement.

1. Open any product with min=1, max=10
2. Try to decrease quantity below 1
   - **Expected**: Button disabled at quantity 1
3. Try to increase quantity above 10
   - **Expected**: Button disabled at quantity 10

---

### Test 8: Price Calculation API

**Goal**: Verify server-side calculation matches client.

1. Open any configurable product
2. Configure options and note the displayed price
3. Open browser **DevTools** → **Network** tab
4. Filter by "calculate-price"
5. Click "Order Now"
6. **Verify**:
   - POST request to `/api/calculate-price` appears
   - Response status: 200
   - Response JSON contains `priceBreakdown` matching displayed price
   - WhatsApp opens immediately after successful response

---

### Test 9: Mobile Responsiveness

**Goal**: Ensure UI works on mobile screens.

1. Open DevTools → Toggle device toolbar (mobile view)
2. Select iPhone or Android device
3. Test:
   - Configuration widget buttons are tappable
   - Size cards display correctly
   - Quantity controls are accessible
   - Price breakdown is readable
   - Order button is visible and clickable

---

### Test 10: Existing Products (Backward Compatibility)

**Goal**: Verify old products still work after migration.

**If you had products before migration**:

1. Navigate to `/explore`
2. Find an old product (created before pricing system)
3. **Verify**:
   - Product displays with price "₹[original price]"
   - Product detail page works
   - Order button functions
   - No errors in console

**Expected behavior**: Old products automatically use "fixed" pricing method.

---

## Performance Testing

### Test 11: Large Product Catalog

1. Create 10+ products with different pricing methods
2. Navigate to `/explore`
3. **Verify**:
   - Page loads quickly (< 2 seconds)
   - All products show correct pricing labels
   - Filtering and sorting work
   - No console errors

---

### Test 12: Complex Configuration

1. Create a product with:
   - 10 size options
   - 5 material options
   - 8 color options
2. View product page
3. **Verify**:
   - All options display
   - Selecting options is responsive
   - Price calculation is instant
   - UI doesn't lag

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

**Verify for each browser**:
- Admin form works
- Product configuration widget works
- Images display correctly
- WhatsApp integration opens correctly

---

## Error Scenarios

### Test 13: Network Error

1. Open any configurable product
2. Open DevTools → **Network** tab → **Throttle** to "Offline"
3. Configure product
4. Click "Order Now"
5. **Expected**: Error message appears (not a crash)

### Test 14: Invalid Product ID

1. Navigate to: `http://localhost:3000/product/invalid-uuid`
2. **Expected**: 404 page with "Product not found"
3. "Back to Explore" button works

### Test 15: Missing Images

1. Create a product without uploading any images
2. Publish
3. View on catalog and detail pages
4. **Expected**: Placeholder icon/text shown (not broken image icon)

---

## Database Verification

### Test 16: Check Saved Data

After creating products, verify database structure:

```sql
-- Check a fixed-price product
SELECT id, name, pricing_method, pricing_config, min_quantity, max_quantity
FROM products
WHERE name = 'Cable Organizer - Small';
```

**Expected**:
```json
{
  "pricing_method": "fixed",
  "pricing_config": {"basePrice": 199},
  "min_quantity": 1,
  "max_quantity": 50
}
```

```sql
-- Check a configurable product
SELECT id, name, pricing_method, pricing_config
FROM products
WHERE name = 'Custom Phone Stand';
```

**Expected**: JSON with `basePrice`, `sizes` array, `materials` array, `colors` array.

---

## Completion Checklist

Mark each completed:

### Admin Dashboard
- [ ] Create fixed-price product
- [ ] Create configurable product (all options)
- [ ] Create configurable product (sizes only)
- [ ] Create quote-based product
- [ ] Edit product and change pricing method
- [ ] Reorder size options
- [ ] Remove size/material/color options
- [ ] Image upload works
- [ ] Form validation prevents invalid products

### Public Catalog
- [ ] Fixed products show exact price
- [ ] Configurable products show "Starting from"
- [ ] Quote products show "Request a Quote"
- [ ] Search works
- [ ] Category filtering works
- [ ] Sorting by price works (uses minimum price for configurable)

### Product Detail Pages
- [ ] Fixed product displays correctly
- [ ] Configurable product shows configuration widget
- [ ] Price updates live when selecting options
- [ ] Quantity controls work
- [ ] Min/max quantity enforced
- [ ] Quote product shows quote button
- [ ] WhatsApp messages include correct details
- [ ] Server-side price validation works

### Edge Cases & Errors
- [ ] Validation prevents broken configurable products
- [ ] Quantity boundaries enforced
- [ ] Missing images show placeholder
- [ ] Invalid product IDs show 404
- [ ] Network errors handled gracefully
- [ ] Old products still work (backward compatibility)

### Mobile & Browsers
- [ ] Mobile responsive on iOS
- [ ] Mobile responsive on Android
- [ ] Works on Chrome, Firefox, Safari, Edge

### Performance
- [ ] Large catalog loads quickly
- [ ] Complex configurations don't lag
- [ ] Price calculation is instant

---

## Known Issues / Limitations

*Document any issues found during testing here:*

- None yet

---

## Post-Testing

### If All Tests Pass

1. Run production build:
   ```bash
   npm run build
   ```
2. Verify build succeeds with no errors
3. Ready for deployment

### If Tests Fail

1. Document the failure scenario
2. Check browser console for errors
3. Check server logs for API errors
4. Verify database migration ran successfully
5. Report issues to development team

---

## Support

If you encounter issues during testing:

1. Check `PRICING_SYSTEM_GUIDE.md` for troubleshooting
2. Verify database migration completed
3. Check browser console for JavaScript errors
4. Check server terminal for API errors
5. Verify all pricing configuration fields are filled correctly

---

**Testing completed by**: _________________

**Date**: _________________

**All tests passed**: ☐ Yes ☐ No

**Notes**:
