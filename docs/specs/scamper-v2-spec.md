# SCAMPER v2 — "Make the Thinking Visible"

*Spec for upgrading the reference toolkit tool from "textarea with AI" to "visual thinking partner"*

---

## The Problem

SCAMPER works pedagogically — effort-gating, Socratic nudges, phase-aware feedback are all solid. But the student experience is: type in a box → see a toast → type in a box → repeat ×7. The AI is sophisticated; the UI is a form.

Three things are missing:

1. **Visual thinking** — ideas are text in a list, not objects you can see taking shape
2. **Interaction variety** — every step is the same textarea; nothing changes across S-C-A-M-P-E-R
3. **Richer AI presence** — the nudge appears and vanishes; there's no sense of a thinking partner accumulating understanding

---

## Design Principles

- **Don't break what works.** The 3-screen flow (intro → working → summary) stays. The 5 education AI patterns stay. Effort-gating stays. Prompts-hidden-until-first-idea stays.
- **Make the invisible visible.** The AI already assesses effort, tracks depth, and adapts tone. Show that to the student through visual encoding, not text.
- **Each SCAMPER step should feel slightly different.** Not a totally new UI — but the scaffolding, prompt style, and visual emphasis should shift per step.
- **The summary should be a reflection tool, not a data dump.** Students should see *patterns* in their thinking, not just a list of everything they typed.

---

## Upgrade 1: Idea Cards with Visual Encoding

### Current
Plain text blocks. No visual distinction between a lazy 4-word idea and a thoughtful paragraph.

### v2: Effort-Encoded Cards
Every idea card gets **visual signals** based on what the AI already knows:

```
┌──────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← effort bar (green/amber/red) │
│                                                    │
│  Use recycled ocean plastic for the outer shell,   │
│  because it's lighter than traditional ABS and     │
│  tells a sustainability story that resonates with  │
│  young buyers who care about ocean health.         │
│                                                    │
│  ✦ Deep thinking     ⌚ 45 words    🔗 reasoning  │
└──────────────────────────────────────────────────┘
```

**Visual encoding (all from existing client-side `assessEffort()`):**

| Signal | Low effort | Medium effort | High effort |
|--------|-----------|---------------|-------------|
| Left border | 2px amber | 3px blue | 4px purple glow |
| Background | `#1a1d2a` (default) | `#1a1d2e` (slightly lighter) | `${step.color}08` (tinted) |
| Effort tag | "Keep going" (amber) | "Good start" (blue) | "Deep thinking" (purple) |
| Detail icons | — | 🔍 specifics | 🔗 reasoning + 🔍 specifics |

**Why this works:** Students see at a glance which ideas are strong and which need more work. The visual hierarchy creates natural motivation to "level up" weaker ideas without the AI having to nag.

**Implementation:** ~30 lines change in the idea card render block. Zero new API calls — all data already exists in `ideaEfforts` state.

---

## Upgrade 2: Live Progress Dashboard (Sidebar Strip)

### Current
Step nav pills at the top. No sense of overall progress or investment distribution.

### v2: Vertical Progress Strip
A narrow sidebar (or top strip on mobile) showing all 7 steps with live stats:

```
┌──────────────────────────────────────────────────────────┐
│  S ██████ 4 ideas  ●●●○   ← 3 high, 1 medium           │
│  C ███    2 ideas  ●○     ← 1 high, 1 low               │
│  A ░░░░   0 ideas  —      ← hasn't started               │
│  M ░░░░   0 ideas  —                                      │
│  P ░░░░   0 ideas  —       ← current step highlighted    │
│  E ░░░░   0 ideas  —                                      │
│  R ░░░░   0 ideas  —                                      │
│                                                            │
│  Total: 6 ideas  │  Avg depth: ●●○  │  Coverage: 2/7     │
└──────────────────────────────────────────────────────────┘
```

**What each row shows:**
- Step letter + color
- Mini bar (width = idea count, max ~8)
- Idea count
- Depth dots: filled circles for high effort, half for medium, empty for low

**Bottom summary strip:**
- Total ideas across all steps
- Average depth (computed from `ideaEfforts`)
- Coverage: how many steps have at least 1 idea

**Why this works:** Students see imbalance instantly. "I have 6 ideas in Substitute but 0 in Reverse — maybe I should explore that." The coverage metric gently nudges toward completing all 7 steps without forcing it.

**Implementation:** New `ProgressStrip` component (~80 lines). Renders from existing `ideas` and `ideaEfforts` state. On desktop: fixed left sidebar (180px). On mobile: horizontal strip below step nav.

---

## Upgrade 3: Persistent AI Coach Panel

### Current
- AI nudge appears after each idea submission, then can be overwritten by the next one
- Micro-feedback toast appears bottom-right for 3 seconds, then vanishes
- No history of coaching received

### v2: Coaching Track
A collapsible panel (right side on desktop, bottom sheet on mobile) that accumulates:

```
┌─────────────── AI Coach ──────────────────┐
│                                             │
│  ▸ Substitute (3 nudges)                   │
│    "Love the recycled plastic angle —      │
│     what if the cap doubled as a cup?"     │
│                                             │
│    "You're on a sustainability streak.     │
│     What's the OPPOSITE approach?"         │
│                                             │
│  ▸ Combine (1 nudge)                       │
│    "Interesting merge — who would this     │
│     NOT work for?"                          │
│                                             │
│  ─────────────────────────────────         │
│  Effort Arc:  ↗ trending up                │
│  You started with short ideas and          │
│  you're getting more specific.             │
│                                             │
│  💡 Try: Push into Reverse — you haven't  │
│  explored opposites yet.                   │
│                                             │
└─────────────────────────────────────────────┘
```

**What it shows:**
1. **Nudge history** — grouped by step, collapsed by default, expandable. Every nudge you received is saved and reviewable.
2. **Effort arc** — a one-line trend. Computed client-side from the order of `ideaEfforts` entries. Trending up / flat / trending down.
3. **Step suggestion** — based on coverage gaps. "You haven't explored Reverse yet." Only appears when 3+ steps are complete.

**Key constraint:** The panel does NOT generate new AI content. It just accumulates and displays what was already generated (nudges) + client-side computed stats (effort arc, coverage). Zero additional API calls.

**Collapsible:** Starts collapsed with a small "AI Coach" tab showing a number badge (total nudges received). Click to expand. This respects the "input-first hierarchy" — the textarea remains primary.

**Implementation:** New `CoachPanel` component (~120 lines). Stores nudge history in state (append-only array of `{ step, nudge, timestamp }`). Effort arc is a simple computation over `ideaEfforts` chronological order.

---

## Upgrade 4: Step-Specific Interaction Tweaks

### Current
Every step has the same layout: header → textarea → add button → prompts → ideas.

### v2: Subtle Per-Step Variation
The core layout stays the same, but each step gets one small unique element that matches its thinking mode:

| Step | Unique element | Why |
|------|---------------|-----|
| **Substitute** | "Swap cards" — two side-by-side fields: "Replace ___" → "With ___" | Substitution is inherently a swap |
| **Combine** | "Merge zone" — two input chips that visually connect with a + | Combining is two things becoming one |
| **Adapt** | "Inspiration source" — small text field: "Borrowed from: ___" above the main idea textarea | Adaptation has a source |
| **Modify** | Magnitude slider: "How extreme?" (subtle → radical) next to the idea | Modification has degree |
| **Put to other use** | "New context" tag: dropdown or chip for who/where (different age, different culture, different industry) | Reuse is about new contexts |
| **Eliminate** | "What I'm removing" — strike-through toggle on a list of features (from previous ideas) | Elimination is about subtraction |
| **Reverse** | "Flip it" prompt — shows one of your earlier ideas and asks "What's the opposite?" | Reversal builds on existing ideas |

**Critical:** These are OPTIONAL micro-interactions. The plain textarea always works. The extra element is scaffolding, not a gate. Students who want to just type can ignore the extra field.

**Implementation:** Each step variation is ~20-30 lines of additional JSX inside the working screen's step render. The extra fields are stored in a new `stepMeta` state object (e.g., `{ substituteFrom, substituteTo, modifyMagnitude, ... }`). This metadata enriches the idea when submitted but doesn't block the basic flow.

---

## Upgrade 5: Visual Summary Dashboard

### Current
Summary screen: "Pick your best 3" → list of all ideas by step → total count → AI insights text block.

### v2: Reflection Dashboard

**Section 1: Coverage Heatmap**
```
SCAMPER Coverage
─────────────────────────────
S  ████████████  6 ideas  ◉◉◉◉◎◎
C  ████          2 ideas  ◉◎
A  ██████████    5 ideas  ◉◉◉◎◎
M  ██            1 idea   ◎
P  ████          2 ideas  ◉◎
E  ██████        3 ideas  ◉◉◎
R  ████████      4 ideas  ◉◉◉◎

◉ = high effort   ◎ = medium/low
```

Students see where they invested and where they skimmed. The AI insight at the bottom can reference this: "You went deep on Substitute and Adapt but only had 1 Modify idea — what would happen if you pushed that further?"

**Section 2: Effort Arc Chart**
A simple line/area chart showing effort level over time (submission order). X-axis = idea number (1-23), Y-axis = effort level (low/medium/high as 1/2/3). Shows whether the student warmed up over time or fatigued.

Built with a lightweight inline SVG — no chart library needed. ~40 lines.

**Section 3: Best Ideas Selection (improved)**
Same star-selection mechanic, but now with effort badges visible on each card. Students naturally gravitate toward starring their highest-effort ideas, reinforcing the quality signal.

**Section 4: AI Synthesis (existing, improved presentation)**
The AI insights text block stays, but now gets a styled card with a header like "What a design coach would notice" and is presented as 2-3 bullet observations rather than a paragraph.

---

## What This Does NOT Include

- **No new API endpoints.** All visual upgrades use existing data (ideas, ideaEfforts, nudges, insights).
- **No drag-and-drop.** Cards stay in submission order. Spatial rearrangement is a Canvas-shape feature (Empathy Map, Affinity Diagram), not Step Sequence.
- **No real-time AI analysis.** The coaching panel accumulates existing nudges — it doesn't generate new meta-analysis during the working phase. AI synthesis only happens once on summary.
- **No changes to the API route.** `src/app/api/tools/scamper/route.ts` stays exactly as-is.

---

## Implementation Plan

| # | What | Effort | Files |
|---|------|--------|-------|
| 1 | Effort-encoded idea cards | ~30 min | ScamperTool.tsx (idea card render block) |
| 2 | Progress strip component | ~1 hour | New: `ProgressStrip.tsx` (~80 lines) + mount in ScamperTool working screen |
| 3 | Coach panel component | ~1.5 hours | New: `CoachPanel.tsx` (~120 lines) + state changes in ScamperTool for nudge history |
| 4 | Step-specific tweaks | ~2 hours | ScamperTool.tsx (per-step JSX variations + stepMeta state) |
| 5 | Visual summary dashboard | ~1.5 hours | ScamperTool.tsx (summary screen rewrite with heatmap + effort arc SVG) |
| **Total** | | **~6 hours** | 3 files (1 modified, 2 new) |

**Build order:** 1 → 2 → 5 → 3 → 4 (visual encoding first because it's highest impact for lowest effort; step tweaks last because they're the most experimental)

---

## How This Rolls Out to Other Tools

Once SCAMPER v2 is proven:

- **ProgressStrip** → reusable for all Step Sequence tools (Six Hats, Five Whys, Lotus, etc.) — just change the steps config
- **CoachPanel** → reusable for ALL tools (every tool generates nudges)
- **Effort-encoded cards** → reusable for ALL tools (every tool uses `assessEffort()`)
- **Visual summary heatmap** → reusable for all multi-step tools
- **Step-specific tweaks** → these are SCAMPER-unique, but the PATTERN (one small unique element per step) applies everywhere: Six Hats gets hat-coloured thinking cards, Five Whys gets causal chain arrows, Empathy Map gets quadrant highlighting

---

## Success Criteria

A student using SCAMPER v2 should be able to:
1. **See at a glance** which ideas are strong and which need work (effort encoding)
2. **See their coverage** across all 7 steps without clicking through each one (progress strip)
3. **Review all AI coaching** they received in one place (coach panel)
4. **Feel each step is slightly different** in how it asks them to think (step tweaks)
5. **Reflect on patterns** in their thinking on the summary screen (heatmap + effort arc)

And crucially: a teacher watching over a student's shoulder should be able to see the quality of thinking at a glance, not just the quantity of text.
