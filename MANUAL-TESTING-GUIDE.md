# Manual Visual Testing Guide - Product Mosaic

**Dev Server:** http://localhost:3001  
**Status:** ✅ Running on port 3001

---

## ⚠️ IMPORTANT: I Cannot Perform Visual Testing

I (Claude Code) do not have the ability to:
- Open a web browser
- Observe rendered pages
- Watch animations in real-time
- Interact with UI elements
- Take screenshots
- Measure visual properties

**You must perform these tests manually.**

---

## Pre-Testing Checklist

Before you start, ensure:
- [ ] Dev server is running (http://localhost:3001)
- [ ] Chrome DevTools is available (or Firefox/Safari dev tools)
- [ ] You have a 1920×1080 desktop display available
- [ ] You can simulate mobile view (375×667) via DevTools
- [ ] Network tab is open to monitor requests
- [ ] Console tab is open to catch errors

---

## Test 1: Desktop Visual Balance (1920×1080)

### Setup
1. Open Chrome and navigate to: **http://localhost:3001**
2. Press F12 to open DevTools
3. Set responsive mode: 1920×1080 (or full screen on desktop)

### Visual Inspection Checklist

#### Left Side (Stationary Content)
- [ ] Hero headline "Your ideas. Designed. Made real." is visible
- [ ] Yellow marker highlight appears on "Designed"
- [ ] Description text is readable
- [ ] Two CTA buttons are visible and aligned
- [ ] Handwritten annotation (IDEAS/SKETCHES/PROJECTS/PROBLEMS) with arrow
- [ ] All text remains stationary (does not move)

#### Right Side (Product Mosaic)
- [ ] **3 vertical columns are visible**
- [ ] Columns have different heights of tiles
- [ ] Tiles have rounded corners (rounded-2xl)
- [ ] Tiles have white backgrounds with subtle borders
- [ ] Product images are visible inside tiles
- [ ] Some tiles may be solid lime or yellow (accent tiles)
- [ ] Gradient fade at top edge (cream → transparent)
- [ ] Gradient fade at bottom edge (cream → transparent)

#### Proportions
- [ ] Left and right sides are roughly equal width (50/50 split)
- [ ] Mosaic does not overwhelm the headline
- [ ] Visual hierarchy: headline > mosaic (headline draws eye first)

**Screenshot Location:** Save as `desktop-initial-state.png`

---

## Test 2: Animation Observation (60-90 seconds)

### Instructions
Keep the page open and observe the mosaic for **at least 2 full animation cycles** (80-90 seconds).

### Animation Quality Checklist

#### Column 1 (Left column - should scroll DOWN)
- [ ] **Direction verified:** Tiles move downward ⬇️
- [ ] **Speed:** Slow and steady (40s per full cycle)
- [ ] **Seamless loop:** No visible jump when animation resets
- [ ] **No blank gaps:** Content flows continuously
- [ ] **No abrupt stops:** Animation is smooth throughout

#### Column 2 (Middle column - should scroll UP)
- [ ] **Direction verified:** Tiles move upward ⬆️ (opposite of column 1)
- [ ] **Speed:** Medium pace (35s per full cycle)
- [ ] **Seamless loop:** No visible jump when animation resets
- [ ] **No blank gaps:** Content flows continuously
- [ ] **No abrupt stops:** Animation is smooth throughout

#### Column 3 (Right column - should scroll DOWN)
- [ ] **Direction verified:** Tiles move downward ⬇️
- [ ] **Speed:** Faster than column 1 (30s per full cycle)
- [ ] **Seamless loop:** No visible jump when animation resets
- [ ] **No blank gaps:** Content flows continuously
- [ ] **No abrupt stops:** Animation is smooth throughout

#### Visual Issues to Watch For
- [ ] **No visible reset:** When animation loops, it should be seamless
- [ ] **No white gaps:** If you see blank white spaces between duplicated content, note it
- [ ] **No stuttering:** Animation should be 60fps smooth (check DevTools Performance)
- [ ] **No excessive repetition:** You should see varied product tiles, not the same 2-3 tiles repeating

#### Distraction Test
- [ ] Read the headline while mosaic is animating - is it distracting?
- [ ] Try to focus on CTA buttons - does motion pull your eye away?
- [ ] Overall feeling: Premium and subtle, or chaotic and overwhelming?

**Notes Section:** Write down any visual issues observed:
```
[Your observations here]
```

---

## Test 3: Layout Stability (No Layout Shifts)

### Instructions
1. Refresh the page (Ctrl+R)
2. Watch the hero section as it loads
3. Open DevTools Console and run:
   ```javascript
   new PerformanceObserver((list) => {
     for (const entry of list.getEntries()) {
       console.log('Layout shift:', entry.value);
     }
   }).observe({type: 'layout-shift', buffered: true});
   ```

### Checklist
- [ ] Hero text appears immediately (no flash of unstyled content)
- [ ] Mosaic appears smoothly (no sudden pop-in)
- [ ] Page does not jump or reflow as images load
- [ ] Console shows: **Layout shift values < 0.1** (acceptable)
- [ ] If shifts > 0.1, note which elements cause them

**Console Output:** Paste layout shift measurements:
```
[Console output here]
```

---

## Test 4: Supabase Product Images

### Instructions
1. Open DevTools → Network tab
2. Filter by "Img"
3. Refresh the page

### Image Loading Checklist
- [ ] **Supabase URLs visible:** Should see requests to `fuqjvxcyonuztfsepecb.supabase.co`
- [ ] **HTTP Status:** All image requests return 200 OK (green)
- [ ] **No 404s:** No broken image links
- [ ] **Fallback images visible:** If Supabase has no products, see `/services/` images

### Missing Image Handling
If you see broken images (🖼️ broken icon):
- [ ] Note which URLs failed
- [ ] Check if fallback to `/services/custom-parts.webp` occurs
- [ ] Verify tiles don't show ugly broken image icons

**Network Tab Screenshot:** Save failed requests if any: `network-errors.png`

---

## Test 5: Browser Console Errors

### Instructions
1. Open DevTools → Console tab
2. Clear console (trash icon)
3. Refresh the page
4. Let it run for 30 seconds

### Console Checklist
- [ ] **No red errors** (critical issues)
- [ ] **No yellow warnings** about missing images
- [ ] **No React hydration errors**
- [ ] **No "Failed to fetch" errors**
- [ ] If any errors appear, copy full error messages

**Error Log:** Paste any console errors:
```
[Console errors here - if none, write "NONE"]
```

---

## Test 6: Horizontal Overflow Check

### Instructions
1. On the homepage (desktop view)
2. Look for horizontal scrollbar at bottom of browser
3. Try scrolling horizontally with mouse/trackpad

### Checklist
- [ ] **No horizontal scrollbar** visible at bottom
- [ ] **No sideways scrolling** when using trackpad/mouse wheel
- [ ] Mosaic tiles do not extend beyond viewport width
- [ ] Page width = viewport width (no overflow)

**If overflow detected:**
- [ ] Measure how many pixels overflow (inspect element width)
- [ ] Note which column causes it

---

## Test 7: Mobile View (375×667)

### Setup
1. In Chrome DevTools, click "Toggle device toolbar" (Ctrl+Shift+M)
2. Select "iPhone SE" or set custom size: 375×667
3. Refresh the page

### Mobile Layout Checklist

#### Text Content
- [ ] Headline "Your ideas. Designed. Made real." is readable
- [ ] Text is not cut off or overlapping
- [ ] CTA buttons are visible and stack vertically
- [ ] All text appears ABOVE the mosaic

#### Mosaic
- [ ] **2 columns visible** (not 3)
- [ ] Mosaic appears **below** the text content
- [ ] Mosaic height is ~300px (not 600px)
- [ ] Columns still animate (one down, one up)
- [ ] No horizontal overflow

#### Scrolling
- [ ] **Critical:** Page scrolls vertically (normal page scroll works)
- [ ] You can scroll past the hero section to see rest of homepage
- [ ] Mosaic does not prevent scrolling
- [ ] No "trapped" scroll (where page won't scroll)

**Mobile Screenshot:** Save as `mobile-layout.png`

---

## Test 8: Reduced Motion Support

### Instructions
1. On desktop view
2. Open DevTools → Console
3. Run this command to simulate reduced motion preference:
   ```javascript
   // This won't work directly - use browser settings or extension
   ```
   
**Alternative (Recommended):**
- **Windows:** Settings → Accessibility → Visual effects → Animation effects: OFF
- **Mac:** System Preferences → Accessibility → Display → Reduce motion: ON
- **Chrome Extension:** Search "reduce motion" in Chrome Web Store

After enabling reduced motion:
1. Refresh the page
2. Observe the mosaic

### Reduced Motion Checklist
- [ ] **Mosaic animations STOP** (tiles should be stationary)
- [ ] Tiles remain visible (don't disappear)
- [ ] Page is still usable without animation
- [ ] No console errors about animation

**Screenshot:** Save as `reduced-motion.png`

---

## Test 9: Image Alt Text (Accessibility)

### Instructions
1. Right-click on any product tile in the mosaic
2. Select "Inspect" or "Inspect Element"
3. Look at the `<img>` tag in DevTools Elements panel

### Alt Text Checklist
- [ ] Every `<img>` has an `alt` attribute
- [ ] Alt text is descriptive (e.g., "MIVO Product" or product name)
- [ ] No empty alt text (`alt=""`) on product images
- [ ] Alt text is meaningful (not just "image" or "photo")

**Example HTML:** Paste one image tag here:
```html
[Image element HTML here]
```

---

## Test 10: Performance (Frame Rate)

### Instructions
1. Open DevTools → Performance tab
2. Click "Record" (circle icon)
3. Let page run for 10 seconds with animation
4. Click "Stop" recording
5. Look at "Main" section for red/yellow bars

### Performance Checklist
- [ ] **FPS stays at 60fps** (or close to it)
- [ ] No long tasks (red bars > 50ms)
- [ ] No janky scrolling (yellow bars)
- [ ] CPU usage is reasonable (< 50% in Performance monitor)

**Performance Screenshot:** Save flamegraph as `performance-trace.png`

---

## Test 11: Hover Effects

### Instructions
On desktop view, hover your mouse over individual product tiles

### Hover Checklist
- [ ] Tile border changes to **lime green** (#B7FF2A)
- [ ] Subtle lime overlay appears (5% opacity)
- [ ] Transition is smooth (not instant)
- [ ] Hover effect doesn't break animation
- [ ] Cursor changes to pointer (if tile is clickable)

---

## Test 12: Content Quality

### Visual Quality Checklist
- [ ] Product images are sharp (not blurry or pixelated)
- [ ] Tile sizes create visual interest (varied: small, medium, large)
- [ ] Color palette feels cohesive (cream, ink, lime, yellow)
- [ ] Mosaic feels "premium" (not busy or cheap-looking)
- [ ] Accent tiles (solid lime/yellow) don't overpower product photos

### Composition Balance
- [ ] Approximately 80% product tiles, 20% accent tiles (rough ratio)
- [ ] No large blank areas in columns
- [ ] Visual rhythm: varied tile heights create interesting pattern

---

## Critical Issues (Must Fix)

If you observe ANY of these, report immediately:

### 🔴 **Animation Issues**
- [ ] Visible jump/reset when loop completes
- [ ] Blank white gaps > 100px between content
- [ ] Animation stops or freezes
- [ ] All columns move same direction

### 🔴 **Layout Issues**
- [ ] Horizontal scrollbar on desktop
- [ ] Mosaic overlaps headline text
- [ ] Mobile page doesn't scroll
- [ ] Content shifts as page loads (CLS > 0.25)

### 🔴 **Image Issues**
- [ ] All images show broken icon
- [ ] Images fail to load (network errors)
- [ ] Missing images cause layout collapse

### 🔴 **Console Errors**
- [ ] React hydration errors
- [ ] Failed to fetch errors
- [ ] Uncaught TypeError/ReferenceError

---

## Test Results Template

Copy this template and fill it out:

```
# Product Mosaic Visual Test Results

**Tester:** [Your Name]
**Date:** [Date]
**Browser:** [Chrome/Firefox/Safari] [Version]
**OS:** [Windows/Mac/Linux]

## Desktop (1920×1080)
- Visual Balance: [PASS/FAIL]
- Animation Smoothness: [PASS/FAIL]
- Layout Stability: [PASS/FAIL]
- Console Errors: [PASS/FAIL]
- Horizontal Overflow: [PASS/FAIL]

## Mobile (375×667)
- Layout: [PASS/FAIL]
- Scrolling: [PASS/FAIL]
- 2 Columns Visible: [PASS/FAIL]

## Accessibility
- Reduced Motion: [PASS/FAIL]
- Alt Text: [PASS/FAIL]

## Critical Issues Found:
[List any critical issues, or write "NONE"]

## Minor Issues Found:
[List any minor issues, or write "NONE"]

## Overall Assessment:
[READY FOR PRODUCTION / NEEDS FIXES]

## Screenshots Attached:
- [ ] desktop-initial-state.png
- [ ] mobile-layout.png
- [ ] reduced-motion.png
- [ ] network-errors.png (if applicable)
- [ ] performance-trace.png (if applicable)
```

---

## What Happens After Testing

### If All Tests Pass
The mosaic is production-ready. No changes needed.

### If Issues Found
1. Document each issue with:
   - Description of what's wrong
   - Steps to reproduce
   - Screenshot if visual issue
   - Console errors if technical issue
2. Prioritize: Critical (blocks release) vs. Minor (nice to fix)
3. Report findings and I'll create targeted fixes

---

**Dev Server Status:** Running at http://localhost:3001  
**Ready to Test:** Yes - open browser and follow checklist above

**Note:** I cannot see your screen or observe the mosaic. You must perform these tests manually and report your findings.
