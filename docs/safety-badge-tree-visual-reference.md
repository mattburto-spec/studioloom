# Badge Tree Visual Reference

## Complete Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKSHOP SAFETY BADGES                       │
│                    23 Badges • 4 Tiers                          │
└─────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════╗
║  TIER 1: FOUNDATION (No Prerequisites)                          ║
╚═════════════════════════════════════════════════════════════════╝

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   ⚠️ General     │  │   🔥 Fire Safety │  │   🥽 PPE         │
│  Workshop Safety │  │   & Emergency    │  │  Fundamentals    │
│                  │  │                  │  │                  │
│  #FF6B6B         │  │  #FF8C00         │  │  #FFB74D         │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐
│   🔨 Hand Tool   │
│     Safety       │
│                  │
│  #FFC857         │
└──────────────────┘

        ↓  ↓  ↓  ↓
        └──┴──┴──┘ (All Tier 2 badges require General Workshop Safety)


╔═════════════════════════════════════════════════════════════════╗
║  TIER 2: WORKSHOP SPECIALTIES                                   ║
║  All Require: General Workshop Safety (Tier 1)                  ║
╚═════════════════════════════════════════════════════════════════╝

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   🪵 Wood        │  │   ⚙️ Metal       │  │   🧩 Plastics &  │
│   Workshop       │  │   Workshop       │  │   Composites     │
│   #A8E6CF        │  │   #95B8D1        │  │   #FFD3B6        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   🔌 Electronics │  │   💻 Digital     │  │   🧵 Textiles   │
│   & Soldering    │  │   Fabrication    │  │   #D62828        │
│   #F4A261        │  │   #E76F51        │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

        ↓              ↓                ↓
        └──────────────┴────────────────┘


╔═════════════════════════════════════════════════════════════════╗
║  TIER 3: MACHINE MASTERY                                        ║
║  Each requires its parent Tier 2 specialty                      ║
╚═════════════════════════════════════════════════════════════════╝

From Wood Workshop:        From Metal Workshop:    From Electronics:
┌──────────────┐          ┌──────────────┐        (Skip - no Tier 3)
│ 🔪 Band Saw  │          │  ⬇️ Pedestal │
│ #06A77D      │          │  Drill       │
└──────────────┘          │ #3DADC6      │
        │                 └──────────────┘
┌──────────────┐                  │
│ 📐 Scroll Saw│
│ #119B9B      │
└──────────────┘

┌──────────────┐
│ ⭕ Disc      │
│ Sander       │
│ #1D82B7      │
└──────────────┘

┌──────────────┐
│ 🔄 Wood      │
│ Lathe        │
│ #0066CC      │
└──────────────┘


From Digital Fabrication:    From Textiles:
┌──────────────┐            ┌──────────────┐
│ ✂️ Laser    │            │ 🪡 Sewing    │
│ Cutter       │            │ Machine      │
│ #8B39FF      │            │ #E63C7A      │
└──────────────┘            └──────────────┘
        │                           │
┌──────────────┐
│ 🖨️ 3D       │
│ Printer      │
│ #B53DA8      │
└──────────────┘


╔═════════════════════════════════════════════════════════════════╗
║  TIER 4: MASTER CRAFTSPERSON                                    ║
║  Each requires its parent Tier 2 specialty                      ║
╚═════════════════════════════════════════════════════════════════╝

From Plastics & Composites:    From Textiles:
┌──────────────┐               ┌──────────────┐
│ 🧴 Resin     │               │ 🖼️ Screen    │
│ Casting      │               │ Printing     │
│ #D4A574      │               │ #9A8C98      │
└──────────────┘               └──────────────┘
        │
┌──────────────┐
│ 💨 Vacuum    │
│ Forming      │
│ #C9ADA7      │
└──────────────┘
```

## Badge Status Indicators

### Status States
```
┌─────────────────────────────────────────────────────────────┐
│  EARNED                                                     │
├─────────────────────────────────────────────────────────────┤
│  Green border (#4ade80) + inset glow                        │
│  Green checkmark circle in top-right corner                 │
│  "✓ Earned" label in green                                  │
│  Icon fully opaque                                          │
│  Can be clicked if onBadgeClick provided                    │
│  Example: Completed safety test with passing score          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  AVAILABLE (Ready to Earn)                                  │
├─────────────────────────────────────────────────────────────┤
│  Color-coded border (badge's unique color)                  │
│  Soft colored glow (40% opacity)                            │
│  "● Ready" label in badge color                             │
│  Subtle pulse animation (2-second cycle)                    │
│  Icon fully opaque                                          │
│  Cursor changes to pointer                                  │
│  Example: All prerequisites met, ready to take test         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  LOCKED (Prerequisites Not Met)                             │
├─────────────────────────────────────────────────────────────┤
│  Gray border (#666 or #ddd depending on theme)              │
│  No glow, minimal shadow                                    │
│  "🔒 Locked" label in gray                                  │
│  Icon dimmed to 40% opacity                                 │
│  Not clickable                                              │
│  Cursor is default                                          │
│  Example: Wood Lathe locked until Wood Workshop earned      │
└─────────────────────────────────────────────────────────────┘
```

## Colors by Tier

### Tier 1: Warm/Red Tones
```
#FF6B6B  (General Workshop)
#FF8C00  (Fire Safety)
#FFB74D  (PPE)
#FFC857  (Hand Tools)
```

### Tier 2: Mixed/Growth Tones
```
Wood & Plastics (Greens/Warm):
#A8E6CF  (Wood)
#FFD3B6  (Plastics)

Metal & Electronics (Blues/Copper):
#95B8D1  (Metal)
#F4A261  (Electronics)

Digital & Textiles (Orange/Red):
#E76F51  (Digital)
#D62828  (Textiles)
```

### Tier 3: Cool/Blues
```
#06A77D  (Band Saw)
#119B9B  (Scroll Saw)
#3DADC6  (Pedestal Drill)
#1D82B7  (Disc Sander)
#0066CC  (Wood Lathe)
#8B39FF  (Laser Cutter - Purple)
#B53DA8  (3D Printer - Purple)
#E63C7A  (Sewing Machine - Pink)
```

### Tier 4: Earthy/Muted
```
#D4A574  (Resin)
#C9ADA7  (Vacuum Forming)
#9A8C98  (Screen Printing)
```

## Theme Rendering

### Dark Theme (Free Tools)
```
Background: #0a0a0f (near black)
Text: #e0e0e0 (light gray)
Accent: #64b5f6 → #81c784 (cyan → green gradient)
Progress bar: Gradient cyan-green
Locked: #1a1a2e bg, #333 border
Available: #1a2e3e bg, color-coded border
Earned: #1a3e1a bg, #4ade80 border & text
```

### Light Theme (Student/Teacher Pages)
```
Background: #fafafa (off-white)
Text: #333 (dark gray)
Accent: Lighter/muted colors
Progress bar: Gradient blue-green
Locked: #efefef bg, #ddd border
Available: #e8f4f8 bg, color-coded border
Earned: #e8f8e8 bg, #22c55e border & text
```

## Progression Examples

### Example 1: Complete Beginner
```
Earned: [None]
Available: All Tier 1 badges
Locked: All Tier 2, 3, 4 badges
```

### Example 2: Foundational Safety Complete
```
Earned: [general-workshop-safety, fire-safety-emergency, ppe-fundamentals, hand-tool-safety]
Available: All Tier 2 specialties
Locked: All Tier 3, 4 badges
```

### Example 3: Wood Workshop Specialist
```
Earned: [all Tier 1] + [wood-workshop] + [band-saw, scroll-saw, disc-sander, wood-lathe]
Available: Other Tier 2 specialties + Tier 3 machines from other specialties
Locked: Tier 4 (advanced processes)
```

### Example 4: Master Craftsperson (All)
```
Earned: All 23 badges
Available: None
Locked: None
```

## Progress Metrics

```
Tier Completion:
- Tier 1: 4/4 badges = Foundation complete
- Tier 2: 0/6 badges = No specialties yet
- Tier 3: 4/8 badges = Partial machine mastery
- Tier 4: 0/3 badges = No advanced processes

Overall: 8/23 (35% complete)

Progress Bar: ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
             (35% filled)
```

## Decision Tree: Which Badge Should I Take Next?

```
START: You've completed Tier 1 (all 4 badges)
  │
  ├─→ Do you want to work with wood?
  │    YES → Earn "Wood Workshop" (Tier 2)
  │         Then: Band Saw, Scroll Saw, Disc Sander, or Wood Lathe (Tier 3)
  │         Finally: (No Tier 4 required)
  │
  ├─→ Do you want to work with metal?
  │    YES → Earn "Metal Workshop" (Tier 2)
  │         Then: Pedestal Drill (Tier 3)
  │
  ├─→ Do you want to work with plastics?
  │    YES → Earn "Plastics & Composites" (Tier 2)
  │         Then: Resin Casting or Vacuum Forming (Tier 4)
  │
  ├─→ Do you want to work with electronics?
  │    YES → Earn "Electronics & Soldering" (Tier 2)
  │         Then: (No Tier 3 or 4 machines required)
  │
  ├─→ Do you want to use digital design tools?
  │    YES → Earn "Digital Fabrication" (Tier 2)
  │         Then: Laser Cutter or 3D Printer (Tier 3)
  │
  └─→ Do you want to work with textiles?
       YES → Earn "Textiles" (Tier 2)
             Then: Sewing Machine (Tier 3)
             Finally: Screen Printing (Tier 4)
```

## Badge Emoji Key

| Tier | Icon | Meaning |
|------|------|---------|
| 1 | ⚠️ | Warning/Safety Alert |
| 1 | 🔥 | Fire/Emergency |
| 1 | 🥽 | Eye Protection/PPE |
| 1 | 🔨 | Hand Tool/Manual Work |
| 2 | 🪵 | Wood/Natural Materials |
| 2 | ⚙️ | Metal/Mechanical |
| 2 | 🧩 | Plastic/Composite |
| 2 | 🔌 | Electricity/Electronics |
| 2 | 💻 | Computer/Digital |
| 2 | 🧵 | Thread/Textile |
| 3 | 🔪 | Cutting/Blade |
| 3 | 📐 | Precision/Angle |
| 3 | ⬇️ | Downward/Pressing |
| 3 | ⭕ | Circular/Rotating |
| 3 | 🔄 | Spinning/Lathe |
| 3 | ✂️ | Cutting/Light Beam |
| 3 | 🖨️ | 3D/Additive |
| 3 | 🪡 | Sewing/Needle |
| 4 | 🧴 | Container/Liquid |
| 4 | 💨 | Air/Pressure |
| 4 | 🖼️ | Frame/Screen |

---

**This visual reference helps teachers understand the complete badge ecosystem and guides students through the progression path.**
