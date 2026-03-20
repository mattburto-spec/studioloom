# Fan Menu Design Brief — QuickToolFAB
**Date:** 19 March 2026 | **Status:** Needs design + build

## What exists now
A QuickToolFAB component at `src/components/toolkit/QuickToolFAB.tsx` with a radial arc menu. Current implementation uses positioned `<button>` elements which look like basic circles overlapping other UI. Not world-class.

## What Matt wants
A fan-out menu that feels custom, animated, and premium — not just circles popping up. Think: the kind of interaction you'd see in a polished iOS app or a design tool like Figma/Framer.

## Interaction flow
1. Click the # button → categories animate out (5 design phases)
2. Click a category → tools for that phase appear
3. Click a tool → opens ToolModal
4. Click backdrop / Escape → everything collapses back

## Design direction to explore
- **Custom SVG shapes** rather than plain circles — maybe rounded pill shapes, or petal-like forms that bloom outward
- **Spring physics** or eased cubic-bezier animations — not linear, not just CSS transitions
- **Staggered reveals** with personality — each item slightly delayed, with overshoot/bounce
- **Connected visual** — lines or arcs connecting the # button to phases, phases to tools
- **Glassmorphism** or frosted glass on the backdrop/menu items
- **The # icon should transform** — rotate into an X, or morph into something
- **Phase colours** should glow/pulse subtly when hovered
- **Tool items** should show more than a dot — maybe a mini preview or icon

## Research references to look at
- Pinterest radial share menu
- iOS AssistiveTouch expanded menu
- Framer Motion radial menu examples
- Path app's iconic fan menu (the original)
- Figma's quick actions radial
- Apple Watch app grid
- Material Design's Speed Dial FAB pattern

## Technical options
1. **Framer Motion** — already common in React, great spring physics, layout animations
2. **React Spring** — alternative physics-based animation
3. **Pure CSS with cubic-bezier** — no deps, but limited
4. **Canvas/WebGL** — overkill for this, but could look incredible
5. **SVG path animations** — mid-ground, good for custom shapes + paths

## Constraints
- Must not overlap Portfolio/Plan/Schedule buttons on unit pages (those are at right-4, bottom: 5.5rem in a flex-col-reverse stack)
- On unit pages, the # button is IN the stack; on dashboard it's standalone
- Must work on mobile (touch targets ≥44px)
- Must be accessible (Escape to close, focus management)
- The # grid icon is the StudioLoom brand mark — use it consistently
- Keep the event-based open (`questerra:open-tools`) for unit page stack integration

## Current file
`/sessions/trusting-epic-bell/mnt/questerra/src/components/toolkit/QuickToolFAB.tsx`

## Phase data
```
Discover (#6366f1), Define (#ec4899), Ideate (#a855f7), Prototype (#f59e0b), Test (#10b981)
```

Tools per phase are pulled from `tools-data.ts` — filter for tools with slugs.
