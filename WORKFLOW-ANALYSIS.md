# MIVO Product Ordering & Manufacturing Workflow Analysis

**Analysis Date:** 2026-10-15  
**Scope:** Existing implementation vs. required business rules for Bambu Lab A1

---

## EXECUTIVE SUMMARY

### Current State
The MIVO website has a **partially implemented** product configuration and pricing system that supports:
- ✅ Three pricing methods (fixed, configurable, quote)
- ✅ Basic size/material/color options
- ✅ Client and server-side price calculation
- ⚠️ WhatsApp-based ordering (no cart, no stored orders)
- ⚠️ Basic custom quote requests

### Business Rules Compliance

| Requirement | Current Status | Gap |
|-------------|---------------|-----|
| 1. PRESET SIZES | 🟡 Partial | No material/color per-size validation |
| 2. CUSTOM DIMENSIONS | ❌ Missing | No custom dimension input |
| 3. A1 FEASIBILITY | ❌ Missing | No build volume validation |
| 4. ORDERING MODES | 🟡 Partial | Quote flow exists, but lacks feasibility checks |
| 5. COSTING | ❌ Incomplete | Only manual pricing, no cost calculator |

---

## DETAILED FINDINGS

## 1. EXISTING PRODUCT CATALOGUE SYSTEM

### Database Schema (Supabase)

**products table:**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  price DECIMAL(10, 2) NOT NULL,  -- Legacy field
  category TEXT NOT NULL,
  images TEXT[],
  in_stock BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  specifications JSONB,
  tags TEXT[],
  
  -- Pricing fields
  pricing_method TEXT NOT NULL,           -- 'fixed' | 'configurable' | 'quote'
  pricing_config JSONB,                   -- Stores size/material/color options
  production_time_days INTEGER,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Observations:**
- ✅ Flexible JSONB pricing_config allows storing size/material/color options
- ✅ Three pricing methods already supported
- ❌ No fields for: build volume constraints, split-printing feasibility, model geometry data
- ❌ No cost breakdown fields (material cost, labor, overhead, etc.)
- ❌ specifications is free-form JSONB (no structured dimensions)

---

## 2. EXISTING PRICING SYSTEM

### TypeScript Types (`types/pricing.ts`)

**Current Size Option:**
```typescript
interface SizeOption {
  name: string;
  dimensions: string;      // Free-text (e.g., "10×5×3 cm")
  price: number;           // Final price for this size
}
```

**Gaps:**
- ❌ No structured dimensions (height, width, depth in mm)
- ❌ No per-size material restrictions
- ❌ No per-size color restrictions
- ❌ No feasibility flags (fits_a1_envelope, requires_split, etc.)

**Current Material/Color Options:**
```typescript
interface MaterialOption {
  name: string;
  priceAdjustment: number;  // Added to base/size price
}

interface ColorOption {
  name: string;
  additionalCharge: number;  // Added to final price
}
```

**Gaps:**
- ❌ Materials/colors are global (not per-size)
- ❌ No material properties (type: PLA/PETG/TPU, color availability)
- ❌ No cost data (per-gram price, waste factor)

**Product Configuration:**
```typescript
interface ProductConfiguration {
  sizeIndex?: number;
  materialIndex?: number;
  colorIndex?: number;
  quantity: number;
}
```

**Gaps:**
- ❌ No custom dimensions (customHeight, customWidth, customDepth)
- ❌ No feasibility acknowledgment flag
- ❌ No split-printing preference

---

### Pricing Logic (`lib/pricing.ts`)

**calculatePrice() function:**
- ✅ Calculates: base price + size + material + color
- ✅ Returns breakdown with unit price and total
- ✅ Works on both client and server (shared logic)

**Gaps:**
- ❌ No custom dimension pricing
- ❌ No volume-based calculation
- ❌ No cost breakdown (just final price)
- ❌ No A1 feasibility validation
- ❌ No split-printing cost adjustment

**validateConfiguration() function:**
- ✅ Validates quantity range
- ✅ Validates size/material/color selections (if required)

**Gaps:**
- ❌ No dimension validation (positive values, reasonable limits)
- ❌ No A1 build volume check
- ❌ No split-printing feasibility check

---

## 3. PRODUCT CONFIGURATION UI

### Customer Product Page (`app/product/[id]/page.tsx`)

**Current Features:**
- ✅ Size selection dropdown (if configurable)
- ✅ Material selection buttons
- ✅ Color selection buttons
- ✅ Quantity selector
- ✅ Real-time price calculation
- ✅ Dynamic price display (unit + total)

**Ordering Flow:**
1. Customer selects size/material/color/quantity
2. Client validates configuration
3. Client calls `/api/calculate-price` for server-side validation
4. Builds WhatsApp message with configuration + price
5. Opens WhatsApp with pre-filled message
6. **No order is stored in database**

**Gaps:**
- ❌ No "Custom Size" option
- ❌ No dimension input fields (height/width/depth)
- ❌ No A1 feasibility warning
- ❌ No "This may require split printing" notification
- ❌ No "Request Quote" flow for custom dimensions
- ❌ No order persistence (everything via WhatsApp)

---

### Admin Product Editor (`app/admin/products/new/page.tsx`)

**Current Features:**
- ✅ Create products with three pricing methods
- ✅ Add multiple size options (name, dimensions text, price)
- ✅ Add multiple material options (name, price adjustment)
- ✅ Add multiple color options (name, additional charge)
- ✅ Set min/max quantity
- ✅ Set production time

**Gaps:**
- ❌ No structured dimension input (numeric height/width/depth)
- ❌ No A1 feasibility flag per size
- ❌ No per-size material/color restrictions
- ❌ No cost calculator (just manual pricing)
- ❌ No model geometry data upload (STL analysis)
- ❌ No split-printing feasibility toggle

---

## 4. ORDER FLOW

### Current Order Tables

**orders table:**
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  shipping_address JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**order_items table:**
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),  -- Note: variants not used yet
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ
);
```

**Key Observations:**
- ✅ Tables exist but **are not used** (orders page shows "coming soon")
- ❌ No configuration snapshot (size/material/color selections not stored)
- ❌ No custom dimensions storage
- ❌ No feasibility status
- ❌ No cost breakdown stored
- ❌ No split-printing notes

**Current Flow:**
1. Customer configures product → WhatsApp message
2. Admin sees message → Manually processes
3. **No database record of order**

**Required Flow:**
1. Customer configures product → Validate → Price/Quote
2. Order stored with full configuration snapshot
3. Admin reviews → Checks feasibility → Confirms/Revises
4. Order status updates: pending → validated → in_production → shipped

---

## 5. CUSTOM QUOTE SYSTEM

### custom_quotes table:
```sql
CREATE TABLE custom_quotes (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_description TEXT NOT NULL,
  application TEXT,
  quantity INTEGER,
  dimensions TEXT,              -- Free-text
  material TEXT,                -- Free-text
  deadline TEXT,                -- Free-text
  attachments TEXT[],
  status TEXT DEFAULT 'submitted',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Current Features:**
- ✅ Public can submit quote requests
- ✅ Admin can view all quotes
- ✅ Tracks status: submitted, reviewing, quoted

**Gaps:**
- ❌ dimensions/material/deadline are free-text (no validation)
- ❌ No structured dimension fields
- ❌ No link to product (if quoting an existing product with custom size)
- ❌ No feasibility assessment status
- ❌ No quote response stored (price, notes, revisions)
- ❌ No conversion to order

---

## 6. TESTS

**Finding:** No automated tests found.

**Missing:**
- ❌ Pricing calculation tests
- ❌ Configuration validation tests
- ❌ A1 feasibility validation tests
- ❌ Order flow tests
- ❌ Custom dimension parsing tests

---

## CONFLICTS WITH CURRENT IMPLEMENTATION

### 1. ⚠️ Global Materials/Colors vs. Per-Size Materials/Colors

**Current:** Materials and colors are global options (apply to all sizes)

**Required:** Materials and colors must be validated per-size
- Example: Small size might support PLA/PETG, Large size might only support PLA
- Example: Red color might be unavailable for Large sizes

**Conflict:** Requires schema change to `pricing_config` structure

---

### 2. ⚠️ Free-Text Dimensions vs. Structured Dimensions

**Current:** `SizeOption.dimensions` is a string (e.g., "10×5×3 cm")

**Required:** Numeric dimensions in mm (height, width, depth) for validation

**Conflict:** Breaking change to size option structure

---

### 3. ⚠️ Manual Pricing vs. Cost-Based Pricing

**Current:** Admin manually enters final price for each size

**Required:** Price calculated from costs (material, time, labor, overhead, margin)

**Conflict:** Need cost calculator + cost data fields

---

### 4. ⚠️ WhatsApp-Only Orders vs. Database-Stored Orders

**Current:** Orders go through WhatsApp, no database record

**Required:** Orders stored with configuration snapshot for tracking/costing

**Conflict:** Need to implement full order creation flow

---

### 5. ⚠️ No Feasibility Validation

**Current:** Website allows ordering any configuration (assumes feasibility)

**Required:** Must validate A1 build volume (256×256×256 mm) before pricing

**Conflict:** Need geometry validation logic + UI warnings

---

## REQUIRED DATABASE CHANGES

### 1. Add Structured Dimensions to Products

**New fields needed:**
```sql
ALTER TABLE products ADD COLUMN model_dimensions JSONB;
-- Structure: { height: number, width: number, depth: number, unit: 'mm' }

ALTER TABLE products ADD COLUMN a1_feasibility JSONB;
-- Structure: {
--   fits_envelope: boolean,
--   requires_rotation: boolean,
--   can_split: boolean,
--   split_count: number | null,
--   notes: string
-- }
```

---

### 2. Update SizeOption Structure

**New pricing_config structure:**
```typescript
interface SizeOption {
  name: string;
  dimensions: {
    height: number;  // in mm
    width: number;   // in mm
    depth: number;   // in mm
  };
  price: number;
  
  // NEW: Per-size restrictions
  supported_materials?: string[];  // Material names allowed for this size
  supported_colors?: string[];     // Color names allowed for this size
  
  // NEW: Feasibility
  a1_feasibility: {
    fits_envelope: boolean;
    requires_rotation: boolean;
    can_split: boolean;
    split_notes?: string;
  };
}
```

---

### 3. Add Custom Dimension Support

**New ProductConfiguration fields:**
```typescript
interface ProductConfiguration {
  // Existing
  sizeIndex?: number;
  materialIndex?: number;
  colorIndex?: number;
  quantity: number;
  
  // NEW: Custom dimensions
  customSize?: {
    height: number;  // in mm
    width: number;   // in mm
    depth: number;   // in mm
  };
  
  // NEW: Feasibility acknowledgment
  acknowledges_split_printing?: boolean;
}
```

---

### 4. Add Order Configuration Snapshot

**New order_items fields:**
```sql
ALTER TABLE order_items ADD COLUMN configuration JSONB;
-- Stores full ProductConfiguration at order time

ALTER TABLE order_items ADD COLUMN configuration_text TEXT;
-- Human-readable summary: "Medium (50×30×20mm), PLA, Red"

ALTER TABLE order_items ADD COLUMN feasibility_status TEXT;
-- 'validated' | 'needs_review' | 'requires_quote'

ALTER TABLE order_items ADD COLUMN feasibility_notes TEXT;
-- "Requires split printing into 2 parts"
```

---

### 5. Add Cost Breakdown Fields

**New products cost fields:**
```sql
ALTER TABLE products ADD COLUMN cost_config JSONB;
-- Structure: {
--   material_cost_per_gram: number,
--   estimated_weight_grams: number,
--   waste_factor: number,          -- 1.1 = 10% waste
--   print_time_hours: number,
--   machine_cost_per_hour: number,
--   labor_hours: number,
--   labor_cost_per_hour: number,
--   overhead_percentage: number,   -- 0.2 = 20%
--   margin_percentage: number       -- 0.3 = 30%
-- }
```

---

### 6. Expand Custom Quotes Schema

**New custom_quotes fields:**
```sql
ALTER TABLE custom_quotes ADD COLUMN product_id UUID REFERENCES products(id);
-- Link to product if quoting custom size of existing product

ALTER TABLE custom_quotes ADD COLUMN custom_dimensions JSONB;
-- { height: number, width: number, depth: number, unit: 'mm' }

ALTER TABLE custom_quotes ADD COLUMN feasibility_assessment JSONB;
-- {
--   can_print: boolean,
--   fits_a1: boolean,
--   requires_split: boolean,
--   split_count: number | null,
--   estimated_cost: number | null,
--   notes: string
-- }

ALTER TABLE custom_quotes ADD COLUMN quote_response JSONB;
-- {
--   quoted_price: number,
--   production_time_days: number,
--   valid_until: date,
--   notes: string,
--   admin_user_id: uuid
-- }
```

---

## REQUIRED API CHANGES

### 1. New: Feasibility Check API

**Endpoint:** `POST /api/check-feasibility`

**Input:**
```json
{
  "productId": "uuid",
  "configuration": {
    "customSize": { "height": 280, "width": 50, "depth": 50 }
  }
}
```

**Output:**
```json
{
  "feasible": false,
  "fits_a1_envelope": false,
  "exceeds_dimension": "height",
  "max_allowed": 256,
  "requested": 280,
  "can_split": true,
  "split_recommendation": "Split vertically into 2 parts",
  "requires_quote": true
}
```

---

### 2. Update: Calculate Price API

**Current:** Only handles preset sizes

**Required:** Handle custom dimensions + feasibility

**New Logic:**
```
IF preset size selected:
  - Validate against supported materials/colors
  - Return instant price
ELSE IF custom size entered:
  - Check A1 feasibility
  - IF fits envelope:
      - Calculate volume-based price (if rule exists)
      - Return instant price
  - ELSE IF can split:
      - Flag "requires quote"
      - Return estimated range
  - ELSE:
      - Return "not feasible"
```

---

### 3. New: Create Order API

**Endpoint:** `POST /api/orders/create`

**Input:**
```json
{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+91...",
    "shipping_address": {...}
  },
  "items": [
    {
      "product_id": "uuid",
      "configuration": {
        "sizeIndex": 1,
        "materialIndex": 0,
        "colorIndex": 2,
        "quantity": 5
      },
      "price_snapshot": {
        "unit_price": 150,
        "total": 750,
        "breakdown": {...}
      }
    }
  ]
}
```

**Output:**
```json
{
  "order_id": "uuid",
  "status": "pending",
  "requires_admin_review": false,
  "whatsapp_message": "Order #ABC123 created..."
}
```

---

## REQUIRED UI CHANGES

### 1. Product Page: Add Custom Size Option

**New UI Components:**
```
[Size Selection]
  (•) Small (50×30×20 mm) - ₹100
  ( ) Medium (100×60×40 mm) - ₹250
  ( ) Large (150×90×60 mm) - ₹450
  ( ) Custom Size - [Request Quote]
  
[IF Custom Size Selected]
  ┌─────────────────────────┐
  │ Height (mm): [___]      │
  │ Width (mm):  [___]      │
  │ Depth (mm):  [___]      │
  └─────────────────────────┘
  
  [Check Feasibility] button
  
  ⚠️ Custom sizes require feasibility review.
     Instant pricing available only for validated sizes.
```

---

### 2. Product Page: Feasibility Warnings

**New Alert Components:**

**✅ Fits A1 Envelope:**
```
✓ This configuration fits the Bambu Lab A1 (256×256×256 mm)
  Estimated production: 3-5 days
  [Add to Order] button enabled
```

**⚠️ Requires Split Printing:**
```
⚠️ This size exceeds A1 build volume
   Recommended: Split into 2 parts for assembly
   Additional cost: ₹200 (assembly + finishing)
   [Request Quote] button
```

**❌ Not Feasible:**
```
✗ This configuration cannot be printed on the Bambu Lab A1
  Maximum dimensions: 256×256×256 mm
  Your request: 300×100×50 mm
  
  Suggestions:
  - Reduce height to 256 mm or less
  - Consider redesigning the model
  [Contact Us] for alternatives
```

---

### 3. Admin Product Editor: Enhanced Size Options

**New UI:**
```
[Add Size Option]
┌────────────────────────────────────────┐
│ Name: [Small]                          │
│                                        │
│ Dimensions (mm):                       │
│   Height: [50]  Width: [30]  Depth: [20] │
│                                        │
│ Fits A1: [✓] Yes  [ ] Requires rotation │
│                                        │
│ Supported Materials:                   │
│   [✓] PLA  [✓] PETG  [ ] TPU         │
│                                        │
│ Supported Colors:                      │
│   [✓] Red  [✓] Blue  [✓] Black       │
│                                        │
│ Price: ₹[100]                         │
│                                        │
│ [Calculate from Costs] button         │
└────────────────────────────────────────┘
```

---

### 4. Admin: Cost Calculator

**New Page:** `/admin/products/calculate-costs`

**UI:**
```
┌─────────────────────────────────────────┐
│ MIVO Cost Calculator                    │
├─────────────────────────────────────────┤
│ Material:        [PLA ▼]                │
│ Weight (grams):  [50]                   │
│ Cost per gram:   ₹[2.50] (auto-filled) │
│ Waste factor:    [1.1] (10%)            │
│                                         │
│ Print time (hrs): [3.5]                 │
│ Machine ₹/hr:     [25]                  │
│                                         │
│ Labor (hrs):      [0.5]                 │
│ Labor ₹/hr:       [150]                 │
│                                         │
│ Overhead:         [20]%                 │
│ Margin:           [30]%                 │
├─────────────────────────────────────────┤
│ COST BREAKDOWN:                         │
│   Material:  ₹137.50 (50g × ₹2.5 × 1.1)│
│   Machine:   ₹87.50  (3.5h × ₹25)      │
│   Labor:     ₹75.00  (0.5h × ₹150)     │
│   Subtotal:  ₹300.00                   │
│   Overhead:  ₹60.00  (20%)             │
│   Cost:      ₹360.00                   │
│   Margin:    ₹108.00 (30%)             │
│ ────────────────────                   │
│ SELLING PRICE: ₹468.00                 │
│                                         │
│ [Use This Price] [Save as Template]    │
└─────────────────────────────────────────┘
```

---

## MISSING FEATURES SUMMARY

### Critical (Must Have)
1. ❌ Custom dimension input fields (height/width/depth in mm)
2. ❌ A1 feasibility validation (256×256×256 mm check)
3. ❌ Feasibility warnings ("exceeds build volume", "requires split")
4. ❌ Per-size material/color restrictions
5. ❌ Order database persistence (currently WhatsApp-only)
6. ❌ Configuration snapshot storage with orders
7. ❌ Cost calculator for admin

### Important (Should Have)
8. ❌ Split-printing cost adjustments
9. ❌ Quote-to-order conversion flow
10. ❌ Feasibility assessment workflow for quotes
11. ❌ Automated tests for pricing/validation
12. ❌ STL file upload + geometry analysis
13. ❌ Material cost database (PLA/PETG/TPU per-gram prices)

### Nice to Have
14. ❌ 3D model preview with build volume overlay
15. ❌ Estimated print time calculator
16. ❌ Material usage estimator
17. ❌ Batch pricing for quantity discounts
18. ❌ Customer order history portal

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2)

**1.1 Database Schema Updates**
- [ ] Add `model_dimensions` JSONB to products
- [ ] Add `a1_feasibility` JSONB to products
- [ ] Update SizeOption structure in pricing_config
- [ ] Add `configuration` JSONB to order_items
- [ ] Add `cost_config` JSONB to products
- [ ] Update custom_quotes with feasibility fields
- [ ] Create migration script

**1.2 TypeScript Type Updates**
- [ ] Update SizeOption interface (structured dimensions)
- [ ] Add per-size material/color restrictions
- [ ] Update ProductConfiguration (add customSize)
- [ ] Create A1FeasibilityCheck type
- [ ] Create CostBreakdown type

**1.3 Validation Logic**
- [ ] Create `validateDimensions()` function
- [ ] Create `checkA1Feasibility()` function
- [ ] Create `checkSplitPrintingFeasibility()` function
- [ ] Update `validateConfiguration()` for custom sizes
- [ ] Add dimension validation limits

**Deliverables:**
- Migration SQL file
- Updated TypeScript types
- Validation functions with unit tests

---

### Phase 2: Custom Dimensions (Week 3-4)

**2.1 Product Configuration UI**
- [ ] Add "Custom Size" radio option
- [ ] Add dimension input fields (height/width/depth)
- [ ] Add input validation (positive numbers, max limits)
- [ ] Add "Check Feasibility" button
- [ ] Add feasibility result display

**2.2 Feasibility API**
- [ ] Create `/api/check-feasibility` endpoint
- [ ] Implement A1 build volume check (256³ mm)
- [ ] Implement rotation suggestions
- [ ] Implement split-printing recommendations
- [ ] Return feasibility status + warnings

**2.3 Dynamic Pricing**
- [ ] Update calculatePrice() for custom sizes
- [ ] Add volume-based pricing fallback
- [ ] Add "requires quote" flag when unfeasible
- [ ] Update UI to show "Request Quote" vs. "Add to Order"

**Deliverables:**
- Custom dimension input UI
- Feasibility check API
- Updated pricing logic
- Warning/error messages

---

### Phase 3: Per-Size Restrictions (Week 5)

**3.1 Admin Product Editor**
- [ ] Update size option form (structured dimensions)
- [ ] Add material checkboxes (per-size)
- [ ] Add color checkboxes (per-size)
- [ ] Add A1 feasibility toggle
- [ ] Add split-printing notes field

**3.2 Configuration Validation**
- [ ] Validate material selection against size restrictions
- [ ] Validate color selection against size restrictions
- [ ] Show "Not available for this size" errors
- [ ] Disable unavailable options in UI

**3.3 Customer UI**
- [ ] Gray out restricted materials/colors
- [ ] Show tooltip "Not available for Large size"
- [ ] Update available options when size changes

**Deliverables:**
- Enhanced admin editor
- Per-size validation logic
- Restricted option UI

---

### Phase 4: Order Persistence (Week 6-7)

**4.1 Order Creation API**
- [ ] Create `/api/orders/create` endpoint
- [ ] Validate customer data
- [ ] Store configuration snapshot
- [ ] Store feasibility status
- [ ] Generate order number
- [ ] Send confirmation email

**4.2 Admin Order Management**
- [ ] Build orders list page (replace "coming soon")
- [ ] Show order details with configuration
- [ ] Add order status workflow (pending → validated → production → shipped)
- [ ] Add feasibility review for flagged orders
- [ ] Add order notes/comments

**4.3 Customer Order Flow**
- [ ] Replace WhatsApp-only flow
- [ ] Add "Place Order" button (creates DB record)
- [ ] Show order confirmation page
- [ ] Optional: Still send WhatsApp notification to admin

**Deliverables:**
- Order creation API
- Order management dashboard
- Order confirmation UI

---

### Phase 5: Cost Calculator (Week 8)

**5.1 Cost Data Management**
- [ ] Create material cost database (PLA/PETG/TPU per-gram)
- [ ] Add machine cost settings
- [ ] Add labor cost settings
- [ ] Add overhead/margin settings

**5.2 Admin Cost Calculator**
- [ ] Build cost calculator form
- [ ] Implement cost calculation logic
- [ ] Show itemized cost breakdown
- [ ] "Use This Price" button (auto-fill product price)

**5.3 Pricing Templates**
- [ ] Save cost configs as templates
- [ ] Apply template to multiple products
- [ ] Bulk price updates

**Deliverables:**
- Cost calculation engine
- Admin cost calculator UI
- Pricing templates

---

### Phase 6: Quote-to-Order Flow (Week 9)

**6.1 Enhanced Custom Quotes**
- [ ] Link quotes to products (if custom size of existing product)
- [ ] Store structured dimensions
- [ ] Admin feasibility assessment form
- [ ] Quote response form (price, timeline, notes)

**6.2 Quote Conversion**
- [ ] "Convert to Order" button in admin
- [ ] Pre-fill order with quote details
- [ ] Mark quote as "converted"
- [ ] Customer notification

**6.3 Quote Status Updates**
- [ ] Customer quote status page
- [ ] Email notifications on status changes

**Deliverables:**
- Enhanced quote management
- Quote-to-order conversion
- Status notifications

---

### Phase 7: Testing & Refinement (Week 10)

**7.1 Automated Tests**
- [ ] Pricing calculation tests
- [ ] Feasibility validation tests
- [ ] Configuration validation tests
- [ ] Order creation tests
- [ ] API integration tests

**7.2 Manual Testing**
- [ ] End-to-end order flow testing
- [ ] Custom dimension feasibility testing
- [ ] Per-size restriction testing
- [ ] Cost calculator accuracy testing

**7.3 Documentation**
- [ ] Admin user guide
- [ ] Customer ordering guide
- [ ] API documentation
- [ ] Cost calculation formulas

**Deliverables:**
- Test suite
- Testing report
- Documentation

---

## RISK ASSESSMENT

### High Risk
1. **Custom dimension feasibility** - Complex geometry analysis may require STL parsing
   - **Mitigation:** Start with simple bounding box check, add geometry analysis later
   
2. **Cost calculation accuracy** - Many factors affect actual costs
   - **Mitigation:** Start with manual pricing, add cost calculator as optional tool

3. **Order persistence breaking current flow** - Admin used to WhatsApp workflow
   - **Mitigation:** Keep WhatsApp notifications, add DB storage in parallel

### Medium Risk
4. **Migration of existing products** - Need to update all products to new schema
   - **Mitigation:** Provide backward compatibility, migration script

5. **Per-size restrictions complexity** - UI gets complex with many options
   - **Mitigation:** Progressive disclosure (show restrictions only when relevant)

### Low Risk
6. **Performance** - JSONB queries may slow down
   - **Mitigation:** Add database indexes, cache frequently accessed data

---

## RECOMMENDED APPROACH

### Option A: Incremental (Recommended)
- **Duration:** 10 weeks
- **Strategy:** Implement phases 1-7 sequentially
- **Pros:** Low risk, testable at each phase, can launch partial features
- **Cons:** Slower time to full functionality

### Option B: MVP First
- **Duration:** 4 weeks for MVP, 6 weeks for full
- **Strategy:** 
  - Week 1-4: Custom dimensions + feasibility + basic orders
  - Week 5-10: Cost calculator + per-size restrictions + quote flow
- **Pros:** Faster time to core functionality
- **Cons:** Less polished initially

### Option C: Quote-Only Mode
- **Duration:** 2 weeks
- **Strategy:** 
  - Disable instant pricing for all products
  - Force all orders through quote request flow
  - Manually assess feasibility and price each quote
- **Pros:** Fastest to implement, no risk of incorrect pricing
- **Cons:** Poor customer experience, high admin workload

**Recommendation:** **Option A (Incremental)** for production quality

**Recommendation for immediate action:** **Phase 1 (Foundation)** to unblock future work

---

## APPROVAL REQUIRED

Before proceeding, please confirm:

1. ✅ Approve database schema changes (backward-compatible migration)
2. ✅ Approve breaking change to SizeOption structure
3. ✅ Approve order persistence (move away from WhatsApp-only)
4. ✅ Approve phased approach (10 weeks)
5. ✅ Confirm cost calculator is optional tool (not required for launch)

**Next Step:** Await approval, then begin Phase 1 (Foundation) implementation.

---

**Analysis Complete**  
**Date:** 2026-10-15  
**Status:** Awaiting approval to proceed
