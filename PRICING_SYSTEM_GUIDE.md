# MIVO Configurable Pricing System — Implementation Guide

## Overview

MIVO now supports three pricing methods for products:

1. **Fixed Price** — One price for all customers (e.g., ₹199)
2. **Configurable Price** — Price varies by size, material, color selections
3. **Quote-based** — Requires custom quote, no automatic pricing

---

## Database Migration

### Step 1: Run the SQL Migration

Execute `supabase-pricing-migration.sql` in your Supabase SQL Editor:

```bash
# File location: supabase-pricing-migration.sql
```

This migration adds:
- `pricing_method` column (TEXT, values: 'fixed', 'configurable', 'quote')
- `pricing_config` column (JSONB, stores pricing rules)
- `production_time_days` column (INTEGER, estimated production time)
- `min_quantity` and `max_quantity` columns (INTEGER, order limits)

### Step 2: Verify Migration

Check that existing products were migrated to 'fixed' pricing:

```sql
SELECT id, name, pricing_method, pricing_config
FROM products
LIMIT 5;
```

All existing products should have:
- `pricing_method` = 'fixed'
- `pricing_config` = `{"basePrice": <original price>}`

---

## Pricing Configuration Examples

### Fixed Price Product

```json
{
  "pricing_method": "fixed",
  "pricing_config": {
    "basePrice": 199
  },
  "min_quantity": 1,
  "max_quantity": 100
}
```

**Customer sees**: "₹199"

---

### Configurable Price Product

```json
{
  "pricing_method": "configurable",
  "pricing_config": {
    "basePrice": 199,
    "sizes": [
      {
        "name": "Small",
        "dimensions": "5x5x5cm",
        "price": 199
      },
      {
        "name": "Medium",
        "dimensions": "10x10x10cm",
        "price": 299
      },
      {
        "name": "Large",
        "dimensions": "15x15x15cm",
        "price": 399
      }
    ],
    "materials": [
      {
        "name": "PLA",
        "priceAdjustment": 0
      },
      {
        "name": "PETG",
        "priceAdjustment": 50
      },
      {
        "name": "TPU",
        "priceAdjustment": 100
      }
    ],
    "colors": [
      {
        "name": "Black",
        "additionalCharge": 0
      },
      {
        "name": "White",
        "additionalCharge": 0
      },
      {
        "name": "Custom Color",
        "additionalCharge": 30
      }
    ]
  },
  "min_quantity": 1,
  "max_quantity": 50,
  "production_time_days": 5
}
```

**Customer sees**: "Starting from ₹199"

**Price calculation**:
- Customer selects: Medium size (₹299) + PETG material (+₹50) + Custom color (+₹30) × 2 units
- Unit price: ₹299 + ₹50 + ₹30 = ₹379
- Total: ₹379 × 2 = ₹758

---

### Quote-based Product

```json
{
  "pricing_method": "quote",
  "pricing_config": {
    "requiredInfo": ["dimensions", "quantity", "material", "reference photos"],
    "referencePhotosRequired": true
  }
}
```

**Customer sees**: "Request a Quote"

---

## Price Calculation Rules

### Server-Side Validation

**All prices are recalculated on the server** before orders are processed.

The pricing library (`lib/pricing.ts`) implements these rules:

1. **Fixed products**: Use `basePrice` from config (or fallback to legacy `price` column)

2. **Configurable products**:
   - Start with selected size price (or base price if no sizes)
   - Add material price adjustment (if any)
   - Add color additional charge (if any)
   - Multiply by quantity
   - Result must be ≥ 0

3. **Quote products**: No automatic calculation, always return `null`

### Client-Side Preview

The product detail page shows a live price estimate as customers select options.

**Important**: The client-side calculation uses the same logic as the server, but the **server always validates before checkout**.

---

## Admin Dashboard

### Creating a Fixed Price Product

1. Go to `/admin/products/new`
2. Select **Pricing Method**: "Fixed Price"
3. Enter base price (e.g., ₹199)
4. Fill in product details, upload images
5. Publish

### Creating a Configurable Product

1. Select **Pricing Method**: "Configurable Price"
2. Enter base price (used as fallback or starting point)
3. **Configure Size Options**:
   - Click "+ Add Size"
   - Enter name (e.g., "Small"), dimensions (e.g., "5x5x5cm"), price (₹199)
   - Add multiple sizes, reorder with ↑↓ buttons
4. **Configure Material Options** (optional):
   - Click "+ Add Material"
   - Enter name (e.g., "PETG"), price adjustment (+₹50)
5. **Configure Color Options** (optional):
   - Click "+ Add Color"
   - Enter name (e.g., "Custom"), additional charge (+₹30)
6. Set min/max quantity and production time
7. Publish

**Validation**: You must add at least one size OR material OR color option for configurable products.

### Creating a Quote-based Product

1. Select **Pricing Method**: "Request Quote"
2. Product will show "Request a Quote" instead of a price
3. Customers will be directed to WhatsApp/custom quote form

---

## Customer Experience

### Product Catalog (`/explore`)

- **Fixed products**: Show "₹199"
- **Configurable products**: Show "Starting from ₹199"
- **Quote products**: Show "Request a Quote"

### Product Detail Page (`/product/[id]`)

#### Fixed Products
- Display single price
- Quantity selector
- "Order Now via WhatsApp" button

#### Configurable Products
- Display "Estimated Price" card with live calculation
- **Configuration Widget**:
  - Size selector (if configured)
  - Material selector (if configured)
  - Color selector (if configured)
- Quantity selector with min/max limits
- Total price updates automatically
- "Order Now via WhatsApp" button (disabled until valid configuration)

#### Quote Products
- No price displayed
- "Request a Quote via WhatsApp" button
- No configuration widget

### WhatsApp Integration

Order messages include:
- Product name
- Selected size (if applicable)
- Selected material (if applicable)
- Selected color (if applicable)
- Quantity
- Unit price
- Total estimated price
- Product URL for reference

---

## API Endpoints

### POST `/api/calculate-price`

Validates and calculates price server-side.

**Request**:
```json
{
  "productId": "uuid",
  "configuration": {
    "sizeIndex": 0,
    "materialIndex": 1,
    "colorIndex": 0,
    "quantity": 2
  }
}
```

**Response (success)**:
```json
{
  "success": true,
  "priceBreakdown": {
    "basePrice": 199,
    "sizePrice": 299,
    "materialAdjustment": 50,
    "colorCharge": 0,
    "quantity": 2,
    "unitPrice": 349,
    "total": 698,
    "details": {
      "size": "Medium (10x10x10cm)",
      "material": "PETG",
      "color": "Black"
    }
  }
}
```

**Response (error)**:
```json
{
  "error": "Invalid configuration",
  "validationErrors": ["Please select a size", "Quantity must be at least 1"]
}
```

---

## Security & Validation

### Client-Side
- Configuration widget validates selections in real-time
- Prevents invalid configurations from being submitted
- Quantity enforced between min and max

### Server-Side
- **Never trust client-submitted prices**
- API route `/api/calculate-price` recalculates from database
- Validates:
  - Product exists and is published
  - Configuration is valid (required options selected)
  - Quantity within limits
  - Option indices within bounds
- Returns validated price breakdown

### WhatsApp Order Flow
1. Customer configures product
2. Client validates configuration
3. Client calls `/api/calculate-price` to get server-validated price
4. WhatsApp message includes server-calculated price
5. Admin can verify price before confirming order

---

## Testing Checklist

### Admin Dashboard Tests

- [ ] Create fixed-price product
- [ ] Create configurable product with sizes only
- [ ] Create configurable product with sizes + materials + colors
- [ ] Create quote-based product
- [ ] Edit existing product, change pricing method
- [ ] Verify validation prevents publishing configurable product with no options
- [ ] Reorder size options using ↑↓ buttons
- [ ] Remove size/material/color options
- [ ] Test image upload still works

### Public Catalog Tests

- [ ] Verify fixed products show "₹199"
- [ ] Verify configurable products show "Starting from ₹199"
- [ ] Verify quote products show "Request a Quote"
- [ ] Verify "View" button changes to "Get Quote" for quote products
- [ ] Test search and filtering still work

### Product Detail Page Tests

- [ ] **Fixed product**:
  - [ ] Displays single price
  - [ ] Quantity selector works
  - [ ] Order button opens WhatsApp with correct message
  - [ ] Min/max quantity enforced

- [ ] **Configurable product with all options**:
  - [ ] Size selector displays all sizes
  - [ ] Material selector displays all materials
  - [ ] Color selector displays all colors
  - [ ] Price updates immediately when selection changes
  - [ ] Shows correct unit price and total
  - [ ] Min/max quantity enforced
  - [ ] Cannot order without selecting all required options
  - [ ] WhatsApp message includes all selected options and calculated price

- [ ] **Configurable product with sizes only**:
  - [ ] Only size selector shown
  - [ ] Material and color sections hidden
  - [ ] Price calculation works correctly

- [ ] **Quote product**:
  - [ ] No price shown
  - [ ] "Request a Quote" button displayed
  - [ ] No configuration widget shown
  - [ ] WhatsApp opens with quote request

### Price Calculation Tests

- [ ] **Manual calculation verification**:
  - [ ] Select Medium (₹299) + PETG (+₹50) + Black (₹0) × 2 = ₹698 ✓
  - [ ] Select Large (₹399) + TPU (+₹100) + Custom (+₹30) × 1 = ₹529 ✓
  - [ ] Change quantity, verify total updates correctly

- [ ] **Server validation**:
  - [ ] Use browser DevTools Network tab
  - [ ] Order a configured product
  - [ ] Verify `/api/calculate-price` is called before WhatsApp opens
  - [ ] Verify response matches displayed price

### Edge Cases

- [ ] Product with 1 size option (should still show selector)
- [ ] Product with 10+ options (scrolling works)
- [ ] Zero price adjustment materials
- [ ] Zero additional charge colors
- [ ] Negative price adjustment (should still work)
- [ ] Quantity at minimum boundary
- [ ] Quantity at maximum boundary
- [ ] Existing old products still display correctly (should show fixed price)

### Mobile Responsive

- [ ] Configuration widget usable on mobile
- [ ] Size/material/color buttons tap correctly
- [ ] Price breakdown readable
- [ ] Quantity controls accessible

---

## Backward Compatibility

### Existing Products

All existing products in the database are automatically migrated to **fixed pricing**:

- `pricing_method` = 'fixed'
- `pricing_config.basePrice` = original `price` value
- Original `price` column preserved

### Legacy Code

The `price` column is still populated and used as a fallback:

```typescript
const displayPrice = pricing_config.basePrice || product.price;
```

This ensures products continue working even if pricing data is incomplete.

---

## Troubleshooting

### "Complete Configuration" Button is Disabled

**Cause**: Not all required options are selected.

**Fix**: Check that customer has selected:
- Size (if product has size options)
- Material (if product has material options)
- Color (if product has color options)

### Price Shows "₹0" or "NaN"

**Cause**: Invalid pricing configuration in database.

**Fix**: Check product's `pricing_config` JSON:
```sql
SELECT id, name, pricing_config FROM products WHERE id = '<product-id>';
```

Ensure all price fields are valid numbers (not null, not strings).

### WhatsApp Message Missing Price

**Cause**: Server-side validation failed.

**Fix**:
1. Check browser console for API errors
2. Verify `/api/calculate-price` response
3. Ensure product configuration is valid

### Configurable Product Shows as Fixed

**Cause**: Product's `pricing_method` is 'fixed', not 'configurable'.

**Fix**: Edit product in admin, change pricing method, save.

---

## File Reference

### Core Files

- `types/pricing.ts` — TypeScript types
- `lib/pricing.ts` — Price calculation logic
- `app/api/calculate-price/route.ts` — Server-side validation API
- `app/product/[id]/page.tsx` — Product detail page with configuration widget
- `app/explore/page.tsx` — Product catalog
- `app/admin/products/new/page.tsx` — Admin product creation form
- `components/admin/PricingConfigEditor.tsx` — Size/material/color editor

### Database

- `supabase-pricing-migration.sql` — Migration to add pricing columns
- `supabase-schema.sql` — Base schema (existing)

---

## Next Steps After Implementation

1. **Run database migration** in Supabase SQL Editor
2. **Restart dev server** to pick up new types and routes
3. **Test admin product creation** with all three pricing methods
4. **Test public product pages** with configured products
5. **Verify WhatsApp integration** includes correct prices
6. **Run production build** to check for errors
7. **Deploy to staging** for full end-to-end testing
8. **Train team** on new admin pricing configuration UI

---

## Support

For questions about the pricing system implementation, refer to:
- This guide (`PRICING_SYSTEM_GUIDE.md`)
- Type definitions (`types/pricing.ts`)
- Pricing calculation logic (`lib/pricing.ts`)

For business logic questions (which products should use which pricing method), consult with MIVO business stakeholders.
