# Admin AI Controls Redesign
**Date:** 18 March 2026 | **Status:** Design spec
**Problem:** The current admin panel has 50+ individual sliders across 7 categories. It's engineer-facing, not teacher-facing. Most teachers would never touch 90% of these. The timing profiles still have hardcoded max values per year.

---

## Design Principle

**Macro controls for teaching philosophy. Micro sliders for fine-tuning. Presets for quick setup.**

Think of it like a camera: Auto mode (presets), Priority modes (macro controls), Manual mode (micro sliders).

---

## Proposed Architecture

### Level 1: Presets (one click)

Presets are named teaching philosophies that set ALL macro and micro values at once. Teachers pick one and go. They can customise from there.

| Preset | Description | Key Characteristics |
|--------|-------------|-------------------|
| **Workshop Heavy** | Making-focused, minimal theory | 75% practical, short demos (8-10 min), long making blocks, safety-prominent, critique mid-lesson |
| **Theory Balanced** | Equal theory and practical | 50/50 split, structured scaffolding, guided practice before independent, regular check-ins |
| **Student-Led Discovery** | High autonomy, teacher as facilitator | Minimal direct instruction, inquiry-driven, lots of critique and reflection, student choice |
| **Exam Prep** | Assessment-focused, criterion-aligned | Structured around criteria, exemplar-heavy, practice responses, self-assessment prominent |
| **First Unit of Year** | Maximum scaffolding for new students | Heavy scaffolding, short activities, lots of warm-ups, explicit routines, safety intro |
| **Advanced Independent** | For experienced Year 4-5 students | Minimal scaffolding, long independent blocks, deep critique, portfolio-focused |
| **Custom** | Teacher's saved settings | Whatever they've tuned + saved |

### Level 2: Macro Controls (5-6 big dials)

These are the controls teachers actually think about. Each one maps to multiple micro sliders underneath.

| Macro Control | Type | Range | What It Controls |
|---------------|------|-------|-----------------|
| **Teaching Style** | Spectrum slider | Teacher-Led ←→ Student-Led | Direct instruction weighting, scaffolding level, teacher notes emphasis, student autonomy |
| **Theory:Practical Balance** | Spectrum slider | All Theory ←→ All Practical | Timing allocations, activity type distribution, workshop safety emphasis, digital vs physical |
| **Scaffolding Level** | Spectrum slider | Maximum Support ←→ Minimal Support | ELL scaffolding, sentence starters, worked examples, scaffolding fade rate, productive failure |
| **Assessment Focus** | Multi-select | Which criteria to emphasise | Criterion weighting, assessment frequency, portfolio capture, self-assessment |
| **Lesson Pace** | Spectrum slider | Deep Dive (fewer activities) ←→ Fast Pace (many activities) | Activity count, activity duration, transition frequency, cognitive load management |
| **Critique Intensity** | Spectrum slider | Light Feedback ←→ Heavy Critique Culture | Critique frequency, peer review, gallery walks, revision cycles, Ron Berger protocols |

### Level 3: Micro Sliders (existing 50+ controls)

These are the current admin panel sliders — accessible via an "Advanced" toggle but hidden by default. Power users only. The macro controls set these automatically; micro sliders let you override individual values.

---

## Mapping: Macro → Micro

### Teaching Style (Teacher-Led ←→ Student-Led)
When slider moves toward Student-Led:
- `generationEmphasis.scaffoldingFade` ↑
- `generationEmphasis.selfAssessment` ↑
- `generationEmphasis.critiqueCulture` ↑
- `generationEmphasis.productiveFailure` ↑
- `generationEmphasis.teacherNotes` ↓
- `relativeEmphasis.teacherInput` ↓
- `relativeEmphasis.pedagogicalIntelligence` ↑
- Timing: longer independent work, shorter direct instruction

### Theory:Practical Balance
When slider moves toward Practical:
- `generationEmphasis.digitalPhysicalBalance` shifts toward physical
- `generationEmphasis.safetyCulture` ↑
- Timing: `maxHandsOnMinutes` ↑, `maxHighCognitiveMinutes` ↓
- Structural: more portfolio captures, more making time

### Scaffolding Level
When slider moves toward Maximum Support:
- `generationEmphasis.ellScaffolding` ↑
- `generationEmphasis.scaffoldingFade` ↓ (scaffolding stays longer)
- `structuralThresholds.ellCoveragePercent` ↑
- `generationEmphasis.compareContrast` ↓ (simpler cognitive tasks)
- More sentence starters, more worked examples, more checklists

### Assessment Focus
Multi-select of criteria (A, B, C, D):
- `generationEmphasis.assessmentCriteria` ↑ for selected criteria
- More assessment activities targeting those criteria
- Portfolio captures aligned to selected criteria

### Lesson Pace
When slider moves toward Fast Pace:
- More activities per lesson, shorter each
- Activity switch interval ↓
- More transitions, more variety
- Warm-up and reflection stay fixed

### Critique Intensity
When slider moves toward Heavy:
- `generationEmphasis.critiqueCulture` ↑
- `qualityWeights.critique_culture` ↑
- More gallery walks, peer review, revision cycles
- Explicit critique protocols included in lessons

---

## Timing: Remove Hardcoded Limits

The current timing panel has hardcoded max minutes per activity type per year. Replace with:

1. **School Profile** (facts, not preferences):
   - Period length (40/50/60/80/90/100 min)
   - Double periods available? (yes/no)
   - Workshop access? (yes/no)

2. **The timing model is learned** (from docs/timing-reference.md):
   - Cold start: use defaults from timing reference doc
   - After uploads: learn from teacher's actual lesson timing
   - After edits: learn from teacher's timing adjustments
   - The admin panel should NOT have per-year max-minute sliders
   - Instead, show the LEARNED timing data: "Based on your 12 uploads, your average demo is 11 min"

3. **Override only when needed:**
   - Teacher can set "never generate demos longer than X minutes" as a hard cap
   - But this should be the exception, not the default UI

---

## UI Layout

```
┌──────────────────────────────────────────────┐
│  AI Configuration                            │
│                                              │
│  ┌─ Preset Bar ──────────────────────────┐   │
│  │ [Workshop Heavy] [Theory Balanced]     │   │
│  │ [Student-Led] [Exam Prep] [Custom ✓]  │   │
│  └────────────────────────────────────────┘   │
│                                              │
│  ── Macro Controls ──────────────────────    │
│                                              │
│  Teaching Style                              │
│  Teacher-Led ●━━━━━━━━━━━━━━○ Student-Led   │
│                                              │
│  Theory:Practical                            │
│  All Theory ○━━━━━━━━━●━━━━━○ All Practical  │
│                                              │
│  Scaffolding                                 │
│  Max Support ○━━━━━━━●━━━━━━○ Minimal        │
│                                              │
│  Lesson Pace                                 │
│  Deep Dive ○━━━━━━━━━━●━━━━━○ Fast Pace     │
│                                              │
│  Critique                                    │
│  Light ○━━━━━━━━━━━━━━━●━━━━○ Heavy         │
│                                              │
│  Assessment Focus: [A ✓] [B ✓] [C] [D ✓]   │
│                                              │
│  ── School Profile ──────────────────────    │
│  Period: [50 min ▾]  Doubles: [Yes ▾]       │
│  Workshop: [Yes ▾]                           │
│                                              │
│  ▸ Advanced (50 micro sliders)               │
│                                              │
│  [Save as Custom Preset]  [Reset to Default] │
└──────────────────────────────────────────────┘
```

---

## Preset Storage

Presets stored as JSONB in a new `ai_presets` table:
```typescript
interface AIPreset {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;     // system presets vs user-created
  createdBy?: string;     // teacher ID for custom presets
  macroValues: {
    teachingStyle: number;        // 0-100 (teacher-led to student-led)
    theoryPracticalBalance: number; // 0-100 (theory to practical)
    scaffoldingLevel: number;      // 0-100 (max support to minimal)
    lessonPace: number;            // 0-100 (deep dive to fast)
    critiqueIntensity: number;     // 0-100 (light to heavy)
    assessmentFocus: string[];     // ["A", "B", "D"]
  };
  microOverrides?: Partial<AIModelConfig>;  // only non-default micro values
}
```

---

## Implementation Plan

1. **Define built-in presets** as const data (6 presets with macro values + computed micro values)
2. **Add macro → micro mapping functions** that translate 5 spectrum values into the 50+ micro sliders
3. **Redesign admin page UI** with preset bar, macro sliders, and collapsible advanced section
4. **Add school profile section** (period length, doubles, workshop) — facts not preferences
5. **Remove timing profiles panel** — replace with learned timing display ("Your average demo: 11 min")
6. **Add preset save/load** — custom presets stored per teacher

---

## What This Means for the AI

The AI doesn't need to change. It still receives the same micro-level values in its prompts. The macro controls are a **UI abstraction** — they compute micro values and pass them through the existing pipeline. The only new thing the AI sees is the school profile (period length, workshop access) which feeds into TimingContext.
