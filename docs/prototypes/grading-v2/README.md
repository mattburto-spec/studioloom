# Grading v2 — Design Prototype

> **Source:** Claude Design (claude.ai/design) handoff bundle, fetched 27 April 2026.
> **Original prompt:** the prompt drafted in CWORK conversation 27 Apr (vertical vs horizontal vs hybrid + AI assist + 24 students × 8 tiles).
> **Status:** **CANONICAL design for the Grading System v1 (G1) build.** Brief: [`../../projects/grading-phase-g1-brief.md`](../../projects/grading-phase-g1-brief.md).

## How to view

Open `Grading v2.html` directly in a browser. The page is a Babel-compiled React + Framer Motion prototype on a DesignCanvas (zoom, pan, multiple artboards). Three artboards render top-to-bottom:

1. **Design rationale** — the thinking, recommendation, hardest UI problem, unconventional move.
2. **A · Calibrate** — horizontal, per-question-across-class. The default workspace.
3. **B · Synthesize** — vertical, per-student. Auto-assembled rubric, past-feedback memory.
4. **C · Studio Floor** — clustered. Power-user mode. Bulk-score by similarity.

The HTML/JSX is pinned to React 18.3.1 + Framer Motion 11.0.5 from CDN. Tailwind via CDN. No build step.

## The locked-in decisions

These came out of the design conversation and are the answers to the open questions in the original UX prompt:

### 1. Mode model — horizontal-first → vertical synthesis
- **Days 1–2 of marking is calibration.** AI pre-scores every tile. Teacher confirms-or-overrides per question across the whole class. 192 micro-judgements (24 students × 8 tiles) become 192 nods or 192 corrections — never blind reads.
- **Day 3 is synthesis.** Per-student vertical view, all rubric scores already in, evidence quotes pinned. Teacher writes one comment per criterion + overall. AI drafts assembled from the very evidence used to score.
- **Studio Floor is the third tab for power users — explicitly NOT the default.** "Teachers who pattern-match UX will bounce off a zoomable canvas. They won't bounce off a list."

### 2. The pivotal design decision — tight evidence quotes
The hardest UI problem: **"showing enough to trust the AI, not so much that horizontal becomes vertical."** If the row collapses to "Sarah ▓▓▓▓ AI:6" the teacher confirms blindly and the rubric is meaningless. If the row expands to show the full empathy map, you've lost the speed of horizontal.

The answer: **rows show a tight 8–15-word evidence quote pulled directly from the student's response** — the bit the AI used to justify its score. Transparent reasoning, not hidden authority. *That single design decision is what makes horizontal viable.*

### 3. The unconventional move — past-feedback memory
On the Synthesize view, an amber callout shows the teacher's own previous feedback to that student: *"You said 3 weeks ago: 'Your sketches are strong but lack annotation — try labeling material, dimensions, and reasoning.' Reference this in your feedback?"*

Most marking software treats every assessment as standalone. Real teachers carry context across weeks. The system should remember on their behalf.

## Implementation notes for the production build

The README in the bundle says: *"Recreate them pixel-perfectly in whatever technology makes sense for the target codebase. Match the visual output; don't copy the prototype's internal structure unless it happens to fit."*

Concrete guidance for the StudioLoom build:

- **Visual language is StudioLoom-native.** Cream/parchment background `#F5F1EA`, paper `#FBF8F2`, Manrope + Instrument Serif (italic) + JetBrains Mono numbers, extrabold (800) display, 0.14em-tracked caps, dashed borders for unconfirmed AI scores. Already used in Lesson Bold / Teacher Editorial / Student Bold designs in the same bundle.
- **Three views = three tabs at the top right.** Calibrate is the default landing for a fresh marking session. Synthesize unlocks once N tiles are calibrated (configurable; the prototype shows it freely available).
- **No page refreshes.** Every transition is `layout` + `AnimatePresence` (Framer Motion). Already standard for StudioLoom.
- **`ScorePill` component** — the dashed-border-when-unconfirmed, solid-when-confirmed pill is reusable across Calibrate, Synthesize, and Studio Floor. Extract first.
- **`TilePreview`** — the per-type mini-renderer (text quote / toolkit grid / monitored integrity ring / sketch / annotation) is used in two views. Extract second.
- **Data shape implied by the design:**
  ```
  per (student_id, page_id, tile_id):
    aiScore          // 1–8
    aiQuality        // 0..3 (Em/Dev/Ach/Mast — derived from score)
    aiQuote          // 8–15 words from the student's response
    aiConfidence     // "high" | "med" | "low"
    integrity        // 0–100 for monitored textareas only
    teacherScore     // null until confirmed
    teacherOverride  // optional private note
  ```
  Per-criterion rollup happens at synthesis time — NOT stored, computed.
- **Past-feedback callout** reads from `student_grades.feedback_text` history, oldest within the last ~6 weeks. Keep this loose at v1 — feature-flag for Matt's classes only.
- **Studio Floor clustering** uses `aiQuality` (0..3) as the cluster key for v1. Later: real similarity via embedding.

## What the prototype is NOT

- Not production code — Babel-in-browser, CDN deps, no error handling, no server, no auth, no real data.
- Not pixel-perfect to the eventual implementation — the implementation should match the *visual output*, not the prototype's React structure (per the bundle README).
- Not a final answer on data model — the per-tile-per-criterion shape is the design's working assumption, but the production migration must be confirmed against the actual `class_units.content_data` tile structure during the G1.0 audit. See Q1 in the brief.

## Files in this folder

| File | Purpose |
|---|---|
| `Grading v2.html` | Entry — loads React/Framer-Motion/Babel from CDN, mounts `App` from `grading-v2.jsx` wrapped in `DesignCanvas`. |
| `grading-v2.jsx` | All three views: `CalibrateView`, `SynthesizeView`, `StudioFloorView`, plus tile previews, score pills, fixture data. |
| `design-canvas.jsx` | Generic Figma-ish wrapper — sections, artboards, pan/zoom, fullscreen mode. Not StudioLoom-specific. |
