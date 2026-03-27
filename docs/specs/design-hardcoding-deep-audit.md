# Design-Specific Hardcoding — Deep Audit Report
## Every Line That Must Change Before Multi-Unit Support

**Date:** 27 March 2026
**Method:** 7 parallel agents scanning the full codebase
**Companion doc:** `docs/specs/unit-type-framework-architecture.md` (the architecture spec)

---

## Executive Summary

**Total findings: ~90 hardcoded instances across ~35 files**

| Category | BREAKING | COSMETIC | UNIVERSAL | Files |
|----------|----------|----------|-----------|-------|
| AI Generation (prompts, schemas) | 22 | 9 | 4 | 5 |
| Wizard & Unit Creation | 21 | 7 | 0 | 9 |
| Lesson Editor | 11 | 2 | 6 | 11 |
| Assessment & Grading | 6 | 2 | 0 | 3 |
| Knowledge Base & Converter | 7 | 2 | 0 | 5 |
| Framework System & Navigation | 3 | 5 | 8 | 8 |
| Discovery Engine | 6 | 8 | 0 | 6+ |
| **TOTAL** | **~76** | **~35** | **~18** | **~35** |

**The system currently does NOT error when non-Design options are selected.** It silently generates MYP Design content regardless of framework. This is the worst failure mode — teachers think they're getting GCSE content but receive MYP.

---

## SYSTEM 1: AI Generation Pipeline

### `src/lib/ai/prompts.ts` — 16 findings (14 BREAKING)

This is the most impacted file. Nearly every function assumes MYP Design.

| Lines | Code | Severity | What it does |
|-------|------|----------|-------------|
| ~1 | `type DesignLessonType = "research" \| "ideation" \| "skills-demo" \| "making" \| "testing" \| "critique"` | BREAKING | Lesson types are Design-only. Service has: investigation, planning, community-action, reflection, demonstration |
| ~117-137 | `buildDesignTeachingContext()` | BREAKING | Injects 12 Design pedagogy principles (studio culture, critique protocols, iteration, prototyping) into ALL generation. Service Learning needs completely different pedagogy (reciprocity, community partnership, sustained engagement) |
| ~240-271 | `buildTimingBlock()` → `WORK_TIME_FLOOR = 0.45` | BREAKING | 45% minimum work time assumes making. Service planning/reflection can be 60%+ of lesson time. PP self-directed work is 50%+. |
| ~280-356 | `UNIT_SYSTEM_PROMPT` = "You are an expert MYP Design teacher" | BREAKING | Every generated unit uses MYP Design pedagogy regardless of framework setting |
| ~364-459 | `OUTLINE_SYSTEM_PROMPT` = "MYP Design curriculum designer" | BREAKING | Unit skeleton assumes A/B/C/D criteria, Design Cycle phases |
| ~426-443 | Criteria pages hardcoded: "Criterion A: Inquiring & Analysing" etc. | BREAKING | Only 4 criteria (A/B/C/D). GCSE has AO1-AO5, ACARA has Knowledge/Processes/Production, Service has IPARD |
| ~521-605 | `LESSON_SYSTEM_PROMPT` references Design phases | BREAKING | Lesson generation locked to Design pedagogy |
| ~607-626 | Extension generation references "design phase" | BREAKING | Extensions indexed to investigation/ideation/prototyping/evaluation only |
| ~687-740 | `SUGGESTION_PROMPT` | COSMETIC | Suggests Design-specific improvements |
| ~753-867 | `JOURNEY_SYSTEM_PROMPT` = "expert Design teacher" with A/B/C/D references | BREAKING | Journey generation locked to Design Cycle |
| ~1120-1282 | `buildSingleLessonPrompt()` | BREAKING | Hardcodes Design lesson structure |
| ~1302-1498 | Regeneration prompt | BREAKING | Hardcodes Design context |
| ~1520-1645 | `maxInstructionMinutes()` with `1 + age` formula | UNIVERSAL | This is actually fine for all types |
| ~1770-2135 | All JOURNEY variant prompts | BREAKING | MYP-specific pacing notes, "MYP Year" references |
| ~1956 | `MYP Year` references in timing | COSMETIC | Should be generic grade level |

### `src/lib/ai/schemas.ts` — 5 findings (2 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~25, 415 | `"substantive design work"` in portfolioCapture description | COSMETIC |
| ~164 | `"indexed to the current design phase"` | BREAKING |
| ~172-174 | `designPhase: { enum: ["investigation", "ideation", "prototyping", "evaluation"] }` | BREAKING |
| ~196 | `"MYP Design unit pages for Criterion ${criterion}"` | BREAKING |

### `src/lib/ai/timing-validation.ts` — 4 findings (1 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~35 | `designPhase?: "investigation" \| "ideation" \| "prototyping" \| "evaluation"` in LessonExtension type | BREAKING |
| ~236, 243 | `profile.mypYear` references | COSMETIC |
| ~369-370 | Active verbs list (create, design, build, prototype, etc.) | UNIVERSAL |

### `src/lib/ai/design-assistant-prompt.ts` — 4 findings (2 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~96-124 | `BLOOM_LEVELS` with Design examples ("materials", "prototype", "design brief") | COSMETIC |
| ~128-139 | `CRITERION_TO_PHASE = { 'Criterion A': 'discover', 'Criterion B': 'ideate', 'Criterion C': 'prototype', 'Criterion D': 'test' }` | BREAKING |
| ~176 | `TOOLKIT_TOOLS_BY_PHASE` maps Design phases to tools | BREAKING |
| ~318 | "MYP Personal Project" reference | COSMETIC |

### `src/lib/ai/open-studio-prompt.ts` — 4 findings (1 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~82 | "design project" in check-in prompt | COSMETIC |
| ~84-88 | Design-specific check-in language ("prototyping", "testing") | COSMETIC |
| ~107 | Generic enough | UNIVERSAL |
| ~333-344 | MYP alignment check hardcodes criterion A/B/C/D mapping | BREAKING |

---

## SYSTEM 2: Wizard & Unit Creation

### `src/types/index.ts` — 2 findings (2 BREAKING)

| Element | Code | Severity |
|---------|------|----------|
| `CriterionKey` type | `"A" \| "B" \| "C" \| "D"` — TypeScript prevents any other criteria | BREAKING |
| `UnitWizardInput` | Fields: `globalContext`, `keyConcept`, `relatedConcepts`, `selectedCriteria` (A/B/C/D), `specificSkills` — 100% MYP Design | BREAKING |

### `src/lib/constants.ts` — 6 findings (4 BREAKING)

| Element | Code | Severity |
|---------|------|----------|
| `CRITERIA` | `{ A: "Inquiring & Analysing", B: "Developing Ideas", C: "Creating the Solution", D: "Evaluating" }` | BREAKING |
| `DEFAULT_MYP_PAGES` | 16 pages structured as A1-A4, B1-B4, C1-C4, D1-D4 | BREAKING |
| `buildPageDefinitions()` | Assumes single-letter criteria keys | BREAKING |
| `MYP_GRADE_LEVELS` | MYP Year 1-5 only | BREAKING |
| `MYP_GLOBAL_CONTEXTS`, `MYP_KEY_CONCEPTS`, `MYP_RELATED_CONCEPTS_DESIGN` | All MYP-specific | COSMETIC (only used in wizard) |
| `DESIGN_SKILLS` | CAD, 3D Printing, Textiles, etc. | COSMETIC (only used in wizard) |

### `src/hooks/useWizardState.ts` — 3 findings

| Element | Code | Severity |
|---------|------|----------|
| Default grade | `"Year 3 (Grade 8)"` | COSMETIC |
| Default criteria | `["A", "B", "C", "D"]` | BREAKING |
| `criteriaEmphasis` | Mapped to A/B/C/D only | BREAKING |

### `src/app/api/teacher/generate-unit/route.ts` — 2 findings (2 BREAKING)

| Element | Code | Severity |
|---------|------|----------|
| `VALID_CRITERIA` | `["A", "B", "C", "D"]` — rejects "AO1" as invalid | BREAKING |
| System prompt selection | Uses `UNIT_SYSTEM_PROMPT` (hardcoded MYP) | BREAKING |

### Other generation routes — 6 findings (all BREAKING)

All 4 generation routes (`generate-journey`, `regenerate-page`, admin test routes) use the hardcoded system prompts.

---

## SYSTEM 3: Lesson Editor

### `src/components/teacher/lesson-editor/ExtensionBlock.tsx` — 3 findings (2 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~15-20 | `DESIGN_PHASES = ["investigation", "ideation", "prototyping", "evaluation"]` | BREAKING |
| ~22-27 | `DESIGN_PHASE_LABELS` record | BREAKING |
| ~145 | Label: `"Design Phase"` | COSMETIC |

### `src/components/teacher/lesson-editor/ActivityBlock.tsx` — 1 finding

| Lines | Code | Severity |
|-------|------|----------|
| ~44-49 | `DESIGN_PHASES` array (duplicate of ExtensionBlock, appears to be dead code) | COSMETIC |

### `src/components/teacher/lesson-editor/LessonSidebar.tsx` — 2 findings (2 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~46-54 | `PHASE_COLORS` record with investigation/creation/evaluation/research/ideation/prototyping/testing | BREAKING |
| ~211 | `page.phaseLabel` assumed to match PHASE_COLORS keys | BREAKING |

### `src/components/teacher/lesson-editor/useLessonEditor.ts` — 1 finding (BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~271-276 | `addPage()` creates hardcoded 4-phase Workshop Model structure | BREAKING |

### `src/components/lesson-timing/PhaseTimelineBar.tsx` — 4 findings (4 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~52-57 | `PHASE_DEFAULTS` with Opening/Mini-Lesson/Work Time/Debrief | BREAKING |
| ~63-78 | `buildDefaultPhases()` returns 4 hardcoded phases | BREAKING |
| ~104 | Assumes "miniLesson" phase exists | BREAKING |
| ~108 | Instruction cap check references "Mini-Lesson" | BREAKING |

### `src/components/lesson-timing/TimingFeedbackPrompt.tsx` — 1 finding (BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~10 | Phase IDs hardcoded: `"opening" \| "miniLesson" \| "workTime" \| "debrief"` | BREAKING |

### `src/app/api/teacher/lesson-editor/ai-field/route.ts` — 1 finding (COSMETIC)

| Lines | Code | Severity |
|-------|------|----------|
| ~47 | System prompt: `"design & technology teachers"` | COSMETIC |

### Safe files (UNIVERSAL — no changes needed)

- `PhaseSection.tsx` — descriptions are generic enough
- `BlockPalette.tsx` — all 25 blocks are framework-agnostic, has `customBlocks` extensibility
- `LessonHeader.tsx` — page type labels are generic

---

## SYSTEM 4: Assessment & Grading

### Grading page — 3 findings (3 BREAKING)

| Element | Code | Severity |
|---------|------|----------|
| Default grading scale | `GRADING_SCALES.IB_MYP` (1-8) hardcoded | BREAKING |
| Assessment tags | Only MYP criteria (A/B/C/D) | BREAKING |
| Score input | Assumes 1-8 range | BREAKING |

### `src/lib/constants.ts` `CRITERIA` — already counted above

### Student lesson pages — criteria display uses `CRITERIA` constant — already counted above

---

## SYSTEM 5: Knowledge Base & Converter

### `src/lib/converter/build-skeleton.ts` — 2 findings (2 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~41-49 | `typeToPhase` maps to "Investigation", "Development", "Creation", "Evaluation" | BREAKING |
| ~18-35 | `inferLessonType()` returns `DesignLessonType` for ALL frameworks, "practical" → "making" | BREAKING |

### `src/lib/converter/extract-lesson-structure.ts` — 1 finding (BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~607 | Fallback subject: `"Design & Technology"` | BREAKING |

### `src/lib/knowledge/analysis-prompts.ts` — 4 findings (3 BREAKING)

| Lines | Code | Severity |
|-------|------|----------|
| ~153, 203-209 | PASS2 system prompt: "design and technology education", criterion A/B/C/D | BREAKING |
| ~168 | Subject areas: only "Product Design", "Digital Design", "Systems Design", etc. | BREAKING |
| ~317-334 | PASS3 system prompt: "Design & Technology department", laser cutters, 3D printers, hot glue guns, power tools | BREAKING |
| ~324, 355, 365, 414 | 10+ references to "making" activities, craft knives, cleanup time | COSMETIC (but generates hallucinated feedback for non-Design) |

---

## SYSTEM 6: Framework System & Navigation

### `src/lib/frameworks/index.ts` — PARTIALLY WIRED

The framework system defines 4 frameworks with phases, mentor prompts, vocabulary, and toolkit mappings. **Currently only wired to:**
- Open Studio AI personality
- Design Assistant vocabulary substitutions
- Student dashboard mode detection (Mode 1 vs Mode 2)

**NOT wired to:** Generation prompts, lesson editor, grading, converter, timing validation.

### `src/lib/ai/framework-vocabulary.ts` — EXISTS BUT UNUSED

Defines `IB_MYP`, `GCSE_DT`, `ACARA_DT` vocabulary with correct terminology. Has `buildFrameworkAdapter()` function. **Only wired into Design Assistant and Open Studio.** Not used in generation routes.

### Teacher dashboard & navigation — 5 COSMETIC findings

| File | Issue | Severity |
|------|-------|----------|
| `src/app/teacher/units/page.tsx` lines 99-135 | Category filters (Electronics, CAD, Woodwork, Textiles) | COSMETIC |
| `src/app/teacher/dashboard/page.tsx` | Unit cards don't show unit type | COSMETIC |
| Class creation page | Framework dropdown exists but selection has no downstream effect on generation | COSMETIC |
| Class-unit settings page | No unit-type-aware configuration | COSMETIC |
| Unit detail page | No unit type badge | COSMETIC |

---

## SYSTEM 7: Discovery Engine

### 6 BREAKING + 8 COSMETIC findings

| File | Issue | Severity |
|------|-------|----------|
| `types.ts` lines 14-24 | `DesignArchetype` type name (used in ~150 references) | BREAKING |
| `station-6-crossroads.ts` lines 49-376 | 36 template doors all frame design/making projects | BREAKING |
| `station-7-launchpad.ts` | Success criteria templates reference prototypes, testing, iteration | BREAKING |
| `station-2-workshop.ts` lines 22-111 | 6 scenarios all reference "design project," "workshop," building | BREAKING |
| `station-2-workshop.ts` lines 115+ | People icons focus on making/creating ("Fixing things," "Ideas") | BREAKING |
| `station-0-identity.ts` lines 65-100+ | Tools are design tools (hammer, paintbrush, gear) | BREAKING |
| `station-3-collection.ts` | Irritation categories reference "Design / Systems" | COSMETIC |
| `station-5-toolkit.ts` | Self-efficacy domains focus on design skills | COSMETIC |
| Various content files | Kit dialogue assumes physical making | COSMETIC |
| `scoring.ts` | Scoring weights favor "materials" and "making" signals | COSMETIC |

---

## WHAT'S GENUINELY UNIVERSAL (Don't Touch)

These systems passed the audit with zero Design-specific hardcoding:

| System | Files | Why it's safe |
|--------|-------|---------------|
| **Toolkit tools** (42 tools) | `src/app/toolkit/**`, all tool components | Framework-agnostic by design (uses universal design thinking phases) |
| **Response types** | `src/components/student/ResponseInput.tsx` + 10+ types | Text, upload, voice, canvas, matrix — all universal |
| **useToolSession hook** | `src/hooks/useToolSession.ts` | Persistence is content-agnostic |
| **Content forking** | `src/lib/units/resolve-content.ts` | Copy-on-write is content-shape-agnostic |
| **Safety badges** | Full system (migrations, APIs, components) | Workshop safety applies to all types |
| **NM / Melbourne Metrics** | Full system | Competency assessment is orthogonal to unit type |
| **Timetable & scheduling** | `src/lib/scheduling/`, all schedule APIs | Time is time |
| **Student auth** | Token session system | No content dependency |
| **Gallery & peer review** | Full system (24 files) | Critique formats work for any content |
| **Auto-save, undo/redo** | `useAutoSave`, `UndoManager` | Infrastructure-level |
| **BlockPalette extensibility** | `customBlocks` prop, `mergeBlocks()` | Ready for unit-type-specific blocks |
| **LessonHeader** | Type labels are generic | Already universal |
| **PhaseSection descriptions** | "Hook & engage", "Student activities" | Generic enough |

---

## Priority Fix Sequence

### Wave 1: Type System Foundation (1-2 days)
1. Migration 051: `unit_type` on `units` table
2. `UnitType` union type
3. `UNIT_TYPE_CONFIG` constant with per-type phases, criteria, skills
4. Extend `CriterionKey` from `"A"|"B"|"C"|"D"` to `string`
5. `curriculum_context` TEXT field on `units` table

### Wave 2: Generation Prompts (3-4 days)
6. `buildUnitTypeSystemPrompt(unitType)` replacing `UNIT_SYSTEM_PROMPT`
7. `buildTeachingContext(unitType)` replacing `buildDesignTeachingContext()`
8. Parameterize `buildTimingBlock()` work time floor per type
9. Make `designPhase` → `activityPhase` with per-type enum
10. Wire unit type through all 4 generation routes

### Wave 3: Wizard & Editor (2-3 days)
11. Step 0 unit type selector in wizard
12. Conditional wizard fields per type
13. ExtensionBlock/ActivityBlock: `getPhases(unitType)` replacing hardcoded array
14. LessonSidebar: parameterized PHASE_COLORS
15. useLessonEditor: unit-type-aware `addPage()`

### Wave 4: Assessment (1-2 days)
16. `getCriteria(unitType, programme)` replacing hardcoded CRITERIA
17. Grading page reads unit_type + framework for scale
18. Student pages show correct criteria labels

### Wave 5: Converter & Knowledge Base (2-3 days)
19. Unit-type-aware `inferLessonType()` and `inferPhaseLabel()`
20. Framework-conditional PASS2/PASS3 analysis prompts
21. Expanded subject area enum
22. Service Learning fingerprints in framework detection

### Wave 6: Discovery Engine (2-3 days, can defer)
23. Rename `DesignArchetype` → `Archetype`
24. DB-backed content pools for template doors
25. Unit-type-specific scenarios, tools, criteria templates

**Total: ~12-18 days of focused work**

---

## Critical Warnings

1. **Silent failure is worse than errors.** Currently selecting GCSE produces MYP content with no error. Add validation: if `unit_type` doesn't match the generation prompt set, throw.

2. **The framework vocabulary system exists but is a red herring.** It swaps words but not pedagogy. Don't extend it — build the unit_type parameterization alongside it.

3. **Page IDs are a migration landmine.** Current pages are keyed as "A1", "A2", "B1" etc. — changing criteria means changing page ID conventions. Student progress records reference these IDs. Plan the migration carefully.

4. **Workshop Model phases ARE universal** — but their descriptions, timing percentages, and constraints are not. The 4-phase structure (Opening/Mini-Lesson/Work Time/Debrief) works for all types. Only the config around it changes.

5. **Discovery Engine is the lowest priority** but the most entangled (type name in ~150 references). Do the rename first, content pools second.

---

*This audit should be read alongside `docs/specs/unit-type-framework-architecture.md` which contains the target architecture, data model, UX vision, and build sequence.*
