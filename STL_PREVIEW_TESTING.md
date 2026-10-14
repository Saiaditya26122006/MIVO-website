# STL Preview - Manual Testing Guide

## Critical Fix Applied

**Previous Issue**: Used `STLLoader.load()` with blob URLs, which caused timing issues.

**Current Fix**: Use `STLLoader.parse()` with `File.arrayBuffer()` for local files.

## Changes Made

### File: `components/admin/STLViewer.tsx`

**Key Change**:
```typescript
// BEFORE (BROKEN):
loaderRef.current.load(blobUrl, callbacks...);

// AFTER (WORKING):
const arrayBuffer = await file.arrayBuffer();
const geometry = loaderRef.current.parse(arrayBuffer);
```

## Manual Testing Steps

### 1. Start Development Server

```bash
npm run dev
```

Wait for:
```
✓ Ready in X.Xs
○ Local:   http://localhost:3000
```

### 2. Navigate to Product Creation Page

Open browser:
```
http://localhost:3000/admin/login
```

**Login with**:
- Email: `saiadityatalluri@gmail.com` (from .env.local ADMIN_EMAIL)
- Password: `Saiaditya@2006` (from .env.local ADMIN_PASSWORD)

Then navigate to:
```
http://localhost:3000/admin/products/new
```

### 3. Open Browser DevTools

**Chrome/Edge**: Press `F12` or `Ctrl+Shift+I`

**Important**: Keep the Console tab open during testing

### 4. Test with STL File

#### Test Case 1: Valid Small STL File (<10MB)

1. Click "Click to upload STL file"
2. Select a valid STL file
3. **Watch the Console**

**Expected Console Output (Success)**:
```
📦 Parsing local STL file: filename.stl (X.XX MB)
✓ File read as ArrayBuffer: XXXXX bytes
✓ STL parsed successfully
✓ Geometry validated: XXXXX vertices
✓ Model loaded and centered: {
  originalSize: "XX.XX",
  autoScale: "X.XXX",
  userScale: "1.00",
  finalScale: "X.XXX",
  vertices: XXXXX
}
```

**Expected Visual Result**:
- Loading spinner appears briefly
- 3D model appears centered on grid
- Model is properly lit and visible
- Grid is visible beneath model
- Controls respond to mouse input

#### Test Case 2: Valid Large STL File (>50MB)

Same steps as Test Case 1.

**Expected**: Longer loading time, but same success output.

#### Test Case 3: Invalid File (Non-STL)

1. Select a non-STL file (e.g., .jpg, .txt)

**Expected Console Output**:
```
❌ STL parsing error: Error: Invalid file type. Please upload an STL file.
```

**Expected Visual Result**:
- Red error box appears
- Message: "Invalid file type. Please upload an STL file."

#### Test Case 4: Corrupted STL File

If you have a corrupted STL:

**Expected Console Output**:
```
❌ STL parsing error: [parsing error details]
Error stack: [stack trace]
```

**Expected Visual Result**:
- Red error box appears
- Message: "Failed to parse STL file. The file may be corrupted or in an unsupported format."

### 5. Test Interaction Controls

After successfully loading an STL:

**Test Rotation**:
- Adjust "Rotate X" slider
- Adjust "Rotate Y" slider
- Adjust "Rotate Z" slider
- **Expected**: Model rotates accordingly

**Test Position**:
- Adjust "Position X" slider
- Adjust "Position Y (Height)" slider
- Adjust "Position Z" slider
- **Expected**: Model moves accordingly

**Test Scale**:
- Adjust "Scale" slider
- **Expected**: Model size changes

**Test Color**:
- Click different color buttons
- **Expected**: Model color changes

**Test OrbitControls**:
- Left-click and drag: Rotate camera
- Right-click and drag: Pan camera
- Scroll wheel: Zoom in/out
- **Expected**: All controls work smoothly

### 6. Test File Switching

1. Load STL file A
2. Immediately load STL file B

**Expected Console Output**:
```
📦 Parsing local STL file: fileA.stl (X.XX MB)
✓ File read as ArrayBuffer: XXXXX bytes
✓ STL parsed successfully
✓ Geometry validated: XXXXX vertices
📦 Parsing local STL file: fileB.stl (Y.YY MB)
✓ File read as ArrayBuffer: YYYYY bytes
✓ STL parsed successfully
✓ Geometry validated: YYYYY vertices
```

**Expected Visual Result**:
- File A appears
- File B replaces File A cleanly
- No ghost geometry
- No errors

### 7. Test Upload to R2

After successful preview:

1. Fill in product details:
   - Product Name
   - Description
   - Price
   - Category
2. Click "Publish Product"

**Expected Console Output**:
```
📦 Uploading STL file to R2: filename.stl
📦 File size: X.XX MB
📊 Upload progress: 10% (1/5 parts)
📊 Upload progress: 20% (2/5 parts)
...
📊 Upload progress: 100% (5/5 parts)
✓ STL uploaded to R2: stl-files/TIMESTAMP-filename.stl
🖼️ Uploading product image: [if provided]
✓ Image uploaded: [path]
💾 Creating product record...
🔐 Current session: Active
🔐 User ID: [uuid]
🔐 User email: saiadityatalluri@gmail.com
✓ Product created: [uuid]
🎉 Product published successfully!
```

**Expected Visual Result**:
- Upload progress bar shows
- Percentage increases
- Part count updates
- Success redirect to /admin/products

## Troubleshooting

### Issue: "Failed to load 3D model" appears immediately

**Check**:
1. Open Console - look for error messages
2. Verify error stack trace
3. Common causes:
   - File is not actually an STL
   - File is corrupted
   - File is empty

**Debug**:
```javascript
// In console, check the file:
console.log('File type:', file?.type);
console.log('File size:', file?.size);
console.log('File name:', file?.name);
```

### Issue: Loading spinner never disappears

**Check**:
1. Console for errors
2. Network tab - is file being read?
3. Possible causes:
   - `arrayBuffer()` failed
   - Parser threw uncaught error

**Debug**: Add console logs in the catch block

### Issue: Model appears but is not visible

**Check**:
1. Console shows "✓ Geometry validated: X vertices"?
2. Possible causes:
   - Camera too far/close
   - Model too small/large
   - Lighting issue
   - Material issue

**Debug**:
```javascript
// In console after load:
console.log('Camera position:', scene.__r3f.camera.position);
console.log('Geometry bounds:', geometry.boundingBox);
```

### Issue: Upload to R2 fails

**Check**:
1. R2 credentials in .env.local
2. Run: `node scripts/verify-r2-config.js`
3. Run: `node scripts/test-r2-connection.js`

## Expected Console Output - Complete Flow

### Successful Preview + Upload:

```
[Preview Stage]
📦 Parsing local STL file: test-model.stl (15.50 MB)
✓ File read as ArrayBuffer: 16252800 bytes
✓ STL parsed successfully
✓ Geometry validated: 54176 vertices
✓ Model loaded and centered: {
  originalSize: "150.25",
  autoScale: "0.033",
  userScale: "1.00",
  finalScale: "0.033",
  vertices: 54176
}

[Upload Stage - after clicking Publish]
📤 Starting upload process...
📦 Uploading STL file to R2: test-model.stl
📦 File size: 15.50 MB
📊 Upload progress: 6% (1/16 parts)
📊 Upload progress: 12% (2/16 parts)
📊 Upload progress: 18% (3/16 parts)
...
📊 Upload progress: 100% (16/16 parts)
✓ STL uploaded to R2: stl-files/1791970200059-test-model.stl
💾 Creating product record...
🔐 Current session: Active
🔐 User ID: 12345678-1234-1234-1234-123456789abc
🔐 User email: saiadityatalluri@gmail.com
✓ Product created: 87654321-4321-4321-4321-cba987654321
🎉 Product published successfully!

[Redirect to /admin/products]
```

## Verification Checklist

After testing, verify:

- [ ] Small STL files (<10MB) preview correctly
- [ ] Large STL files (>50MB) preview correctly
- [ ] Binary STL files parse correctly
- [ ] ASCII STL files parse correctly (if available)
- [ ] Invalid files show clear error messages
- [ ] Model is centered on build plate
- [ ] Model is properly scaled to fit viewport
- [ ] Camera shows entire model on load
- [ ] Lighting makes model clearly visible
- [ ] All rotation controls work
- [ ] All position controls work
- [ ] Scale control works
- [ ] Color picker works
- [ ] OrbitControls work (rotate, pan, zoom)
- [ ] File switching works without errors
- [ ] No memory leaks (switch files 10+ times)
- [ ] Upload to R2 works after preview
- [ ] Product is saved to database
- [ ] No console errors during entire flow

## Common STL Test Files

If you need test files, you can:

1. **Download free STL files**:
   - Thingiverse: https://www.thingiverse.com/
   - MyMiniFactory: https://www.myminifactory.com/
   - Printables: https://www.printables.com/

2. **Create simple STL**:
   - Use Blender: Export cube as STL
   - Use Tinkercad: Export design as STL

3. **Test file sizes**:
   - Small: Simple shapes (~100KB - 5MB)
   - Medium: Detailed models (10-50MB)
   - Large: High-poly models (>100MB)

## Success Criteria

✅ **Preview is WORKING if**:
1. Console shows all "✓" messages
2. 3D model is visible on screen
3. Model has proper lighting and shading
4. Controls are responsive
5. No error messages

✅ **Upload is WORKING if**:
1. Progress bar appears and updates
2. Console shows upload completion
3. Product appears in /admin/products
4. Database has R2 metadata

❌ **Preview is FAILING if**:
1. Red error box appears
2. Console shows "❌" errors
3. Grid is visible but no model
4. Loading spinner never stops

## Next Steps After Successful Test

1. Test with your actual STL files
2. Test with both binary and ASCII STL files
3. Test with various file sizes
4. Verify upload to R2 works
5. Check Supabase database for correct metadata
6. Check Cloudflare R2 bucket for uploaded files

## Report Results

After testing, note:
- ✅ What works
- ❌ What doesn't work
- 📝 Console output for failures
- 🖼️ Screenshots of UI state
