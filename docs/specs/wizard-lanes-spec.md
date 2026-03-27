# Wizard Lanes Spec — "Choose Your Level of Control"
## Unit Generation Project

**Date:** 27 March 2026
**Status:** Approved design — not yet built
**Related:** `docs/specs/unit-type-framework-architecture.md` (master architecture)

---

## The Core Insight: Three Lanes, One Wizard

Instead of one flow with progressive disclosure toggles, give teachers three lanes they can switch between at any time:

| Lane | Who it's for | Experience |
|------|-------------|------------|
| **Express** | "Just build me something good" | 3 clicks to generation. AI makes all decisions. Teacher reviews output. |
| **Guided** | "Walk me through it" | Conversational flow (current wizard). AI asks questions one at a time, suggests answers, teacher confirms or adjusts. |
| **Architect** | "I know exactly what I want" | Full control panel. Every field visible. Drag-and-drop everything. Power users and curriculum coordinators. |

The lane selector is a single UI element at the top of the wizard — three cards or a segmented control. The teacher can switch lanes mid-flow (their answers carry over). This solves the "too many options vs too few options" tension because the teacher self-selects their comfort level.

---

## The Universal Question Sequence

Regardless of lane, the wizard needs answers to these questions (in this order). The lane determines **how** they're asked:

### Step 1: What are you teaching? (Always first — identical across all unit types)

- Free-text goal/topic input (existing GoalInput with keyword suggestions)
- This is the hook — teacher types "sustainable packaging" or "community garden project" or "personal project on photography"
- AI immediately starts inferring unit type, framework, and grade level from the text

### Step 2: What kind of unit is this? (Critical fork point)

| Lane | How this is asked |
|------|-------------------|
| Express | AI auto-detects from Step 1 text. Shows a chip: "Looks like a Design unit" with a tap-to-change option. If ambiguous, shows 2-3 cards. |
| Guided | "What kind of learning experience is this?" — 4 visual cards (Design Project / Service Learning / Personal Project / Inquiry Unit) with one-line descriptions. AI pre-selects based on Step 1. |
| Architect | Dropdown with all options + a "Custom" option for edge cases. |

This is the moment the wizard branches. Once unit type is known, subsequent questions adapt.

### Step 3: Which programme/framework? (Adapts based on Step 2)

| Lane | How this is asked |
|------|-------------------|
| Express | Auto-detected from teacher profile (if they've set a default) or from the school's registered framework. Only shown if ambiguous. |
| Guided | "Which curriculum framework are you working with?" — Cards showing the ones relevant to the selected unit type. E.g., selecting "Design" shows MYP/GCSE/ACARA/A-Level. Selecting "Service" shows MYP Community Project/IB CAS/Generic Service Learning. |
| Architect | Full dropdown of all frameworks + "Other/Custom" with free-text field. |

### Step 4: Grade level + Duration (Universal — existing UI works)

- Grade selector (already built)
- Duration in weeks (already built)
- Lessons per week + lesson length (from journey input)
- New: If timetable is configured, auto-populate from there

### Step 5: What matters most? (Emphasis step — adapts per unit type)

Replaces current criteria emphasis sliders. The question and options change based on unit type:

| Unit Type | What's shown |
|-----------|-------------|
| Design | Criteria A/B/C/D with emphasis sliders (existing UI). Maybe renamed to friendlier labels: "Research & Analysis", "Developing Ideas", "Creating", "Evaluating". |
| Service | IPARD phases with emphasis: "How much time on Investigation vs Action?" Plus a toggle for "Community partner involvement level" (light/integrated/co-designed). |
| Personal Project | Goal-setting depth, process journal emphasis, product vs process balance, presentation format preference. |
| Inquiry | Inquiry cycle emphasis (questioning/researching/synthesizing/presenting), depth vs breadth toggle. |

| Lane | How this is asked |
|------|-------------------|
| Express | AI picks a balanced default. Shows as a summary chip: "Balanced emphasis across all criteria." Tap to adjust. |
| Guided | "Where do you want students to spend the most time?" — Visual slider or card sort. One question at a time. |
| Architect | All emphasis controls visible simultaneously. Existing slider UI plus additional unit-type-specific fields. |

### Step 6: Topic-specific suggestions (Existing keyword bucket system — universal)

- Must Have / Nice to Have / Bank buckets
- Keywords adapt to unit type: Design units suggest tools/materials/techniques. Service units suggest community contexts, stakeholder types, ethical frameworks. PPs suggest research methods, presentation formats.
- Express auto-places keywords based on AI analysis.

### Step 7: Choose an approach (Existing ApproachPicker — universal)

- AI generates 3-5 outline options
- Each shows a phase breakdown, lesson count, and key activities
- The phase labels change per unit type (Design Cycle phases vs IPARD phases vs Inquiry phases)
- Express auto-picks the first option (teacher can review and swap)

### Step 8: Review & Generate

- Skeleton preview (for timeline mode) or direct generation
- "Build it for me" proceeds immediately
- "Guide me through it" shows the skeleton for teacher editing before generation

---

## How the Lanes Work in Practice

### Express (3 clicks)

1. Type topic → AI infers everything (unit type, framework, grade from profile, balanced emphasis)
2. See 3 approaches → pick one (or accept AI's pick)
3. Generate → Review

### Guided (5-7 steps)

1. Type topic
2. "What kind of unit?" → pick card
3. "Which framework?" → pick card
4. Grade + duration
5. "What matters most?" → adjust emphasis
6. Keywords (optional — can skip)
7. Pick approach → Generate

### Architect (all at once)

- Single scrollable form with all fields visible
- Sections: Unit Identity (type, framework, grade, duration), Learning Focus (criteria/phases with emphasis), Content (keywords, resources, requirements), Generation (approach selection, mode)
- Power users fill what they want, leave the rest as AI defaults

---

## Key UX Principles

1. **Answers carry forward.** If a teacher starts in Express, sees the auto-config, and wants to tweak one thing, they switch to Guided or Architect — all their existing answers are preserved. They adjust the one field and switch back or continue.

2. **AI defaults are always visible.** Even in Express mode, the teacher can see what the AI chose (as summary chips or a compact config panel). Nothing is hidden — just not asked about unless the teacher wants to engage.

3. **Unit type changes cascade.** If a teacher switches from Design to Service mid-wizard, the criteria section transforms (A/B/C/D → IPARD), keyword suggestions refresh, approach options regenerate. But the topic, grade, and duration stay. **Already implemented in useWizardState.ts** — the SET_INPUT handler for "unitType" resets selectedCriteria, criteriaFocus, criteriaEmphasis, and journeyInput.assessmentCriteria.

4. **Framework memory.** After the first unit, the wizard remembers the teacher's framework preference. Second time around, Step 3 is pre-filled and only shown as a confirmable chip.

5. **The approach step is the magic moment.** This is where the teacher sees what the AI understood — phase breakdowns, lesson count, activity types, assessment points. If this looks wrong, they go back. If it looks right, they commit. This step is the same quality bar regardless of lane.

---

## What Changes From Current Wizard

| Current | Proposed |
|---------|----------|
| No unit type selection | Step 2 adds unit type cards |
| Framework is a dropdown buried in config | Framework becomes Step 3 with visual cards |
| Criteria always A/B/C/D | Criteria/phases adapt per unit type **(Phase 0 DONE)** |
| Keywords always suggest design tools | Keywords adapt per unit type |
| Mode is binary (build-for-me / guide-me) | Mode is a 3-lane spectrum (Express / Guided / Architect) |
| No lane switching | Can switch lanes at any time, answers preserved |

## What Stays the Same

- GoalInput with keyword suggestions (Step 1)
- Drag-to-bucket keyword system (Step 6)
- ApproachPicker with 3-5 AI-generated outlines (Step 7)
- Generation progress UI
- Review carousel
- The entire generation backend (routes, prompts, validation) — just parameterized by unit type

---

## Build Sequence

This spec is built across multiple phases of the Unit Generation Project:

- **Phase 0 (DONE):** Schema + types foundation. `CriterionKey` → `string`, per-type criteria, `getCriteriaForType()`, `curriculum_context` field, unit type selector in wizard, cascading state resets.
- **Phase 1 (next):** Gateway — wizard conditional fields per type, curriculum context in generation, framework selector, auto-detection from topic text.
- **Phase 2:** AI Brain — per-type system prompts, teaching corpuses, timing parameterization.
- **Phase 3:** Express/Guided/Architect lane selector UI, lane switching, AI auto-config for Express mode, framework memory.

The lane selector UI (Phase 3) depends on the underlying data flowing correctly (Phases 0-2). Phases 0-2 make the Guided lane work for all unit types. Phase 3 adds Express and Architect as alternative entry points to the same data.

---

## The "World Class" Factor

A teacher who's never used the platform can type "sustainable packaging project for Year 9" and get a fully scaffolded MYP Design unit in 60 seconds (Express), while a curriculum coordinator can specify exact ACARA standards, custom phase distributions, and specific assessment rubrics in the same tool (Architect). Same wizard, same codebase, different depth. That's what Toddle and Atlas charge $15K/year for, and neither of them has AI generation.

---

*This document should be read alongside `docs/specs/unit-type-framework-architecture.md`. The architecture spec defines WHAT data flows through the system. This spec defines HOW teachers interact with that data.*
