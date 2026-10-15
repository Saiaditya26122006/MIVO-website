# Visual Guide: Product Mosaic Animation

## Desktop Layout (lg: 1024px+)

```
╔════════════════════════════════════════════════════════════╗
║  MIVO HOMEPAGE HERO                                        ║
╠════════════════════════╦═══════════════════════════════════╣
║                        ║   ╔═══╗                          ║
║  IDEAS                 ║   ║ 🔧 ║  ← Column 1 (Slow ⬇️)   ║
║  SKETCHES   ───────┐   ║   ╚═══╝                          ║
║  PROJECTS           │   ║                                   ║
║  PROBLEMS           │   ║   ╔═════╗                        ║
║                     └──→║   ║  📐  ║  ← Column 2 (Med ⬆️)  ║
║                        ║   ╚═════╝                        ║
║  Your ideas.           ║                                   ║
║  ╔═════════╗           ║   ╔═══╗                          ║
║  ║Designed.║ ← Yellow  ║   ║ 🛠️ ║  ← Column 3 (Fast ⬇️)   ║
║  ╚═════════╝           ║   ╚═══╝                          ║
║  Made real.            ║                                   ║
║                        ║   [Lime]  ← Accent tile         ║
║  3D printing, CAD...   ║                                   ║
║  in Vijayawada.        ║   ╔═════╗                        ║
║                        ║   ║  ⚙️  ║                        ║
║  [Explore Models →]    ║   ╚═════╝                        ║
║  [Start Custom...]     ║                                   ║
║                        ║   ╔═══╗                          ║
║  (Stationary)          ║   ║ 🔩 ║  (Continuous scroll)    ║
║                        ║   ╚═══╝                          ║
╚════════════════════════╩═══════════════════════════════════╝
```

## Mobile Layout (< 1024px)

```
╔════════════════════════════════╗
║  IDEAS                         ║
║  SKETCHES   ───────┐           ║
║  PROJECTS           │           ║
║  PROBLEMS           │           ║
║                     └──→        ║
║                                ║
║  Your ideas.                   ║
║  ╔═════════╗                   ║
║  ║Designed.║ ← Yellow          ║
║  ╚═════════╝                   ║
║  Made real.                    ║
║                                ║
║  3D printing, CAD design...    ║
║                                ║
║  [Explore Models →]            ║
║  [Start Custom Project]        ║
║                                ║
║  (Stationary Text Above)       ║
╠════════════════════════════════╣
║   ╔═══╗      ╔═════╗          ║
║   ║ 🔧 ║      ║  📐  ║         ║
║   ╚═══╝      ╚═════╝          ║
║    ⬇️          ⬆️               ║
║   ╔═════╗    ╔═══╗            ║
║   ║  🛠️  ║    ║ ⚙️ ║           ║
║   ╚═════╝    ╚═══╝            ║
║                                ║
║  (2 Columns, 300px height)    ║
╚════════════════════════════════╝
```

## Tile Sizes

```
Small (h-32 / 128px)
╔═════╗
║  🔩  ║
╚═════╝

Medium (h-48 / 192px)
╔═══════╗
║       ║
║  📐   ║
║       ║
╚═══════╝

Large (h-64 / 256px)
╔═══════╗
║       ║
║       ║
║  🛠️   ║
║       ║
║       ║
╚═══════╝
```

## Animation Flow

### Column 1 (Down, Slow - 40s)
```
0s:  [Item 1] ──┐
     [Item 2]   │
     [Item 3]   │
     [Item 4]   │
     ─────────  │
     [Item 1]   │ ← Duplicated
     [Item 2]   │
     [Item 3]   │
     [Item 4] ──┘

20s: [Item 3]   ← Moved down
     [Item 4]
     ─────────
     [Item 1]   ← Seamless loop
     [Item 2]

40s: Back to start (seamless)
```

### Column 2 (Up, Medium - 35s)
```
0s:  [Item 1]   ← Duplicated
     [Item 2]
     [Item 3]
     [Item 4]
     ─────────
     [Item 1] ──┐
     [Item 2]   │
     [Item 3]   │
     [Item 4]   │

17.5s: [Item 2] ← Moved up
       [Item 3]
       [Item 4]
       ─────────
       [Item 1]

35s: Back to start (seamless)
```

## Color Palette

```
Cream Background:    #F5F3ED  ░░░░░░░
Ink Typography:      #101010  ██████
Lime Accent:         #B7FF2A  ▓▓▓▓▓▓
Yellow Highlight:    #FFD400  ▒▒▒▒▒▒
```

## Entrance Animation

```
Tile Entrance (fadeInScale - 0.8s)

0ms:        200ms:      400ms:      600ms:      800ms:
┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
│ ... │    │ ··· │    │ ... │    │  .  │    │     │
│ ... │    │ ·🔧· │    │ .🔧. │    │ 🔧  │    │ 🔧  │
│ ... │    │ ··· │    │ ... │    │  .  │    │     │
└─────┘    └─────┘    └─────┘    └─────┘    └─────┘
opacity:0  opacity:.3 opacity:.6 opacity:.9 opacity:1
scale:.95  scale:.96  scale:.97  scale:.99  scale:1
```

## Gradient Fade Effect

```
Top Fade (24px height):
████████████  ← Solid cream
▓▓▓▓▓▓▓▓▓▓▓▓  ← 80% opacity
▒▒▒▒▒▒▒▒▒▒▒▒  ← 50% opacity
░░░░░░░░░░░░  ← 20% opacity
            ← Transparent
[Mosaic tiles visible]


Bottom Fade (24px height):
[Mosaic tiles visible]
            ← Transparent
░░░░░░░░░░░░  ← 20% opacity
▒▒▒▒▒▒▒▒▒▒▒▒  ← 50% opacity
▓▓▓▓▓▓▓▓▓▓▓▓  ← 80% opacity
████████████  ← Solid cream
```

## Hover Effect

```
Normal State:
╔═══════════╗
║           ║
║    🔧     ║  border: 2px solid #10101020
║           ║  bg: white
╚═══════════╝

Hover State:
╔═══════════╗
║ ░░░░░░░░░ ║
║ ░░░🔧░░░░ ║  border: 2px solid #B7FF2A
║ ░░░░░░░░░ ║  bg-overlay: lime/5
╚═══════════╝
```

## Responsive Breakpoint

```
Mobile                Desktop
< 1024px             ≥ 1024px
────────────────────────────────
2 columns            3 columns
300px height         600px height
Below text           Right side
Gap: 8px (gap-2)     Gap: 12px (gap-3)
```

## Performance Indicators

```
CSS Transforms (GPU-Accelerated):
✅ transform: translateY()
✅ opacity
✅ scale

Avoided (CPU-Heavy):
❌ top/bottom/left/right
❌ width/height changes
❌ margin/padding animation
```

## prefers-reduced-motion

```
Normal User:
[Animated mosaic with scrolling tiles]
Column 1: ⬇️  Column 2: ⬆️  Column 3: ⬇️

Reduced Motion User:
[Static mosaic, no animation]
Column 1: ⬛  Column 2: ⬛  Column 3: ⬛
(Tiles remain visible but stationary)
```

## Image Loading Strategy

```
Priority Images (Above Fold):
┌──────────────────────────────┐
│  Hero text + CTA (Immediate) │
├──────────────────────────────┤
│  First 3 mosaic tiles        │
│  [Load immediately]          │
└──────────────────────────────┘

Lazy Images (Below Fold):
┌──────────────────────────────┐
│  Remaining mosaic tiles      │
│  [Load when scrolling near]  │
└──────────────────────────────┘
```

## File Structure

```
components/
  └── hero/
      └── ProductMosaic.tsx
          ├── ProductMosaic()          ← Desktop component
          ├── ProductMosaicMobile()    ← Mobile component
          ├── MosaicColumn()           ← Column with animation
          └── MosaicTile()             ← Individual tile

app/
  ├── page.tsx                         ← Integrated here
  └── globals.css                      ← fadeInScale animation
```

## Component Props Flow

```
ProductMosaic
  └── Fetches products from Supabase
      ├── column1Items (idx % 3 === 0)
      ├── column2Items (idx % 3 === 1)
      └── column3Items (idx % 3 === 2)
          └── MosaicColumn
              ├── items: MosaicItem[]
              ├── direction: 'up' | 'down'
              └── speed: 'slow' | 'medium' | 'fast'
                  └── Duplicates items for loop
                      └── MosaicTile
                          ├── type: 'product' | 'accent'
                          ├── imagePath: string
                          ├── size: 'small' | 'medium' | 'large'
                          └── Renders Image or colored div
```

---

**Visual Summary:**
- ✅ Three staggered vertical columns (desktop)
- ✅ Alternating scroll directions for dynamic rhythm
- ✅ Seamless infinite loops via content duplication
- ✅ Gradient fade at edges for premium polish
- ✅ Responsive 2-column mobile version
- ✅ Smooth entrance animations with staggered timing
- ✅ Respects motion preferences for accessibility
