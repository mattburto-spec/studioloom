# Project: MYPflex — Framework-Flexible Assessment & Grading

**Created:** 28 March 2026
**Status:** Phases 1-3 COMPLETE (28 Mar 2026). Phase 4 (future-proofing) added 29 Mar — open.
**Priority:** P0 — blocks non-MYP teacher adoption
**Estimated effort:** 8-12 days across 3 phases (Phase 1 done in ~1 day)

---

## Problem

StudioLoom's codebase has two dimensions of flexibility:

1. **Unit Type** (design / service / personal_project / inquiry) — ✅ DONE via Unit Generation Project Phases 0-3 (27 Mar 2026). `unitType` threaded through wizard, generation pipeline, criteria definitions.

2. **Framework / Programme** (IB MYP / GCSE D&T / A-Level D&T / IGCSE / ACARA / PLTW) — ❌ NOT DONE. The `CURRICULUM_FRAMEWORKS` registry exists in constants.ts with criteria + labels for 3 frameworks, `GRADING_SCALES` has 3 scales, and `FRAMEWORK_VOCABULARY` maps 6 frameworks to terminology. But **none of this is wired through the actual application**. Everything defaults to MYP.

A GCSE teacher using StudioLoom today would see:
- MYP 1-8 grading scale (should be 0-100%)
- Criteria A/B/C/D (should be AO1-AO5)
- "Inquiring & Analysing" labels (should be "Identify, investigate and outline")
- AI prompts referencing "MYP Design Cycle" (should reference GCSE D&T specification)
- MYP Global Contexts, Key Concepts, ATL Skills in the wizard (irrelevant to GCSE)

The platform silently generates MYP content regardless of framework. This is the worst failure mode — teachers think they're getting GCSE content but receive MYP.

---

## Architecture Decision: Where Does Framework Live?

**Decision: Framework lives on the CLASS, not the unit.**

Rationale (from unit-type-framework-architecture.md):
- Unit Type is inherent to the content ("Design a Chair" is always a design unit)
- Framework is inherent to the assessment context (same unit taught as MYP in one class, GCSE in another)
- A teacher transferring between schools might teach the same unit under different frameworks
- This matches the unit-as-template architecture: units are content, classes are configuration

**Implementation:**
- Add `framework TEXT DEFAULT 'IB_MYP'` column to `classes` table (migration)
- Framework selector on class creation page (already has a placeholder framework selector!)
- All downstream code reads `framework` from the class context, not the unit
- Resolution chain: `class.framework` → teacher default → `'IB_MYP'` fallback

**Alternative considered:** Framework on `class_units` junction. Rejected — you don't change framework per unit within a class. All units in "10 GCSE Design" use GCSE.

---

## Audit Findings

### Sources
1. **MYPflex scan (28 Mar 2026)** — 14 finding categories, focused on framework dimension
2. **Design Hardcoding Deep Audit (27 Mar 2026)** — 90 findings across 35 files, focused on unit type dimension (most fixed in Phases 0-2)
3. **Manual inspection of grading page, Class Hub, and constants.ts**

### P0 — Blocks Non-MYP Use Entirely

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` (Grade tab) | `const scale = GRADING_SCALES.IB_MYP` hardcoded | Read framework from class, use `GRADING_SCALES[framework]` |
| 2 | `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` | `const DEFAULT_SCALE = GRADING_SCALES.IB_MYP` | Same |
| 3 | `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` (Grade tab) | `CRITERIA[criterionKey]` without type/framework awareness | Use `getFrameworkCriterion(key, framework)` — new helper |
| 4 | `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` | `CRITERIA[page.criterion]` in multiple places | Same |
| 5 | `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` | `CRITERION_TAGS` hardcoded for MYP A/B/C/D | Build tags from framework criteria |
| 6 | No `framework` column on classes table | Cannot store or resolve framework per class | Migration: add `framework TEXT DEFAULT 'IB_MYP'` to `classes` |

### P1 — Degraded Experience for Non-MYP

| # | File | Issue | Fix |
|---|------|-------|-----|
| 7 | `src/lib/ai/prompts.ts` | `UNIT_SYSTEM_PROMPT` says "MYP Design teacher" | Template: `${frameworkName} ${unitTypeName} teacher` |
| 8 | `src/lib/ai/prompts.ts` | `buildTeachingContext()` hardcodes "MYP Design Cycle" in text blocks | Use `FRAMEWORK_VOCABULARY[framework].designCycle` |
| 9 | `src/lib/ai/prompts.ts` | `TIMING_PROFILES` indexed by "Year X" (MYP only) | Parse framework-agnostic grade strings; rename to `GRADE_PROFILES` |
| 10 | `src/lib/constants.ts` | `MYP_GLOBAL_CONTEXTS`, `MYP_KEY_CONCEPTS`, `MYP_RELATED_CONCEPTS_DESIGN`, `MYP_ATL_SKILL_CATEGORIES` wired into wizard UI without alternatives | Gate behind `framework === 'IB_MYP'` check; hide for GCSE/ACARA |
| 11 | `src/lib/constants.ts` | `DEFAULT_MYP_PAGES` used as only page template | Build per-framework default page structures |
| 12 | `src/components/teacher/wizard/ArchitectForm.tsx` | Unit type cards say "MYP Design Cycle" | Use framework name from context |
| 13 | `src/lib/ai/framework-vocabulary.ts` | `getFrameworkVocabulary()` has no mechanism to receive framework param through generation pipeline | Thread `framework` alongside `unitType` in all generation routes |
| 14 | `src/lib/ai/prompts.ts` | All system prompts reference MYP explicitly | Parameterize with framework vocabulary |

### P2 — Cosmetic / Labels

| # | File | Issue | Fix |
|---|------|-------|-----|
| 15 | `src/lib/constants.ts` | `MYP_GRADE_LEVELS` only has Year 1-5 | Add GCSE Grade levels, A-Level years, ACARA years |
| 16 | `src/lib/ai/prompts.ts` | Timing output says "MYP Year" | Template with framework name |
| 17 | `src/components/teacher/wizard/ArchitectForm.tsx` | Unit type descriptions reference MYP | Use generic "Design Cycle" or framework name |
| 18 | Report Writer + Marking Comments | Framework selector exists but may not affect all prompt paths | Verify and wire through |

---

## Implementation Plan

### Phase 1: Data Layer + Grading (P0) — ✅ COMPLETE (28 Mar 2026)

**Goal:** A GCSE teacher can grade students using the correct scale and criteria.

1. ✅ **Migration 055:** `framework TEXT DEFAULT 'IB_MYP'` on `classes` table + index. **APPLIED 28 Mar 2026.**
2. ✅ **Framework selector on class creation page** — rewired from old unit-type values (`myp_design`) to proper framework IDs (`IB_MYP`, `GCSE_DT`, `IGCSE_DT`, `A_LEVEL_DT`, `ACARA_DT`, `PLTW`). Badge display on class cards updated.
3. ✅ **5 new helpers in `constants.ts`:** `getFrameworkCriteria()`, `getGradingScale()`, `getFrameworkCriterion()`, `getFrameworkCriterionKeys()`. `GradingScale.type` extended with `"percentage"`.
4. ✅ **3 new grading scales:** A_LEVEL_DT (0-100%), IGCSE_DT (0-100%), PLTW (1-4). GCSE/A-Level/IGCSE now typed as `"percentage"` not `"numeric"`.
5. ✅ **Class Hub Grade tab fixed:**
   - Fetches `framework` from class query
   - 3-strategy criteria extraction (criterionTags → strand pages → any page) + framework fallback
   - Per-criterion picker: number input for percentage scales (0-100), buttons for discrete (1-8, 1-4)
   - Overall grade picker: same adaptive pattern
   - All lookups via `getFrameworkCriterion()` instead of `CRITERIA[key]`
6. ✅ **Full Grading page fixed:**
   - `CriterionSection` accepts `framework` prop
   - `getFrameworkTags(framework)` builds criterion-specific tags dynamically (MYP gets A/B/C/D tags, others get universal only)
   - `LevelPicker` already handled all scale types (numeric buttons ≤10, letter buttons, number input for large ranges)
7. ✅ **Dashboard API returns framework** per class. `DashboardClass` type updated.

**Test:** Create a GCSE class, assign a unit, open Grade tab → see 0-100% number input with AO1-AO5 criteria. MYP classes unchanged (1-8 buttons with A/B/C/D).

### Phase 2: Generation Pipeline (P1) — ✅ COMPLETE (28 Mar 2026)

**Goal:** AI-generated content uses the correct framework terminology and pedagogy.

1. ✅ **Thread `framework` through all generation routes** alongside `unitType`:
   - `generate-outlines/route.ts` — extracts framework from wizardInput, passes to `buildOutlinePrompt()`
   - `generate-unit/route.ts` — extracts framework, calls `buildUnitSystemPrompt(framework)`, passes to `buildRAGCriterionPrompt()`
   - `generate-journey/route.ts` — extracts from `journeyInput.curriculumFramework`, passes to `buildRAGJourneyPrompt()`
   - `regenerate-page/route.ts` — fetches framework from DB, injects `buildFrameworkPromptBlock()`
   - `wizard-suggest/route.ts` — extracts framework, calls `buildSuggestSystemPrompt(framework)`
   - `wizard-autoconfig/route.ts` — extracts framework, calls `buildAutoconfigSystemPrompt(framework)`
   - `test-lesson/route.ts` — extracts from `testInput.curriculumFramework`
2. ✅ **Parameterize system prompts:**
   - `UNIT_SYSTEM_PROMPT` → `buildUnitSystemPrompt(framework)` — injects framework name, criteria labels, design cycle name via `getFrameworkVocabulary()`
   - `SUGGEST_SYSTEM_PROMPT` → `buildSuggestSystemPrompt(framework)` — framework-agnostic advisor
   - `AUTOCONFIG_SYSTEM_PROMPT` → `buildAutoconfigSystemPrompt(framework)` — dynamic criteria keys
   - All prompt builders (`buildCriterionPrompt`, `buildOutlinePrompt`, `buildJourneyPrompt`, RAG variants) accept `framework` param and inject `buildFrameworkPromptBlock()`
3. ✅ **Wire `getFrameworkVocabulary(framework)` into prompts** — vocabulary (criteria terms, design cycle phases, assessment terminology) injected into all framework-aware prompts
4. ✅ **Gate MYP-specific wizard fields:**
   - `GuidedConversation.tsx` — MYP-only turns (globalContext, keyConcept, relatedConcepts) gated behind `framework === "IB_MYP"` check
   - `ArchitectForm.tsx` — entire "MYP Framework" section hidden for non-MYP frameworks
   - `ConversationWizard.tsx` — sends framework to autoconfig API
5. ✅ **Lesson editor framework-aware:**
   - `ExtensionBlock`, `ActivityBlock`, `LessonSidebar` use `getDesignProcessPhases(framework)` instead of hardcoded MYP phases
   - Content API returns class framework, `useLessonEditor` tracks it
   - 7 framework phase sets defined (IB_MYP, GCSE, IGCSE, A-Level, ACARA, PLTW, NESA, VIC)

**Test:** Generate a unit with framework=GCSE_DT → AI output references AO1-AO5, GCSE specification, no MYP terminology.

### Phase 3: Polish + Edge Cases (P2) — ✅ COMPLETE (28 Mar 2026)

1. ✅ **Timing profiles:** `TIMING_PROFILES` → `AGE_TIMING_PROFILES` indexed by student age (11-18). New `gradeStringToAge(gradeString, framework)` parses any grade format. `getGradeTimingProfile()` updated with optional `framework` param.
2. ✅ **Grade level constants:** `FRAMEWORK_GRADE_LEVELS` registry with 8 frameworks. `getFrameworkGradeLevels()` and `getDefaultGradeLevel()` helpers. CompactConfig wizard shows correct grade pills per framework.
3. ✅ **Report Writer:** `FrameworkId` expanded from 4 → 9 (added A_LEVEL_DT, IGCSE_DT, PLTW, NESA_DT, VIC_DT). Per-framework `RATING_CATEGORIES` with skill lists for all 9 frameworks. ACARA label fixed ("Processes & Production" → "Processes & Production Skills").
4. ✅ **TestSandbox:** Corrected criteria arrays (GCSE 5→4, ACARA P&P→PPS, PLTW course names→rubric dimensions). Added NESA_DT + VIC_DT. Unit type presets decoupled from framework (no longer forces IB_MYP).
5. ✅ **Free tools:** `/toolkit` and `/tools/safety` confirmed framework-agnostic.
6. ✅ **Discovery Engine:** Framework-agnostic by design (no curriculum-specific content).

### Framework Criteria Audit (28 Mar 2026) — ✅ COMPLETE

All 8 non-general framework criteria definitions audited against official syllabi and corrected:
- **GCSE_DT:** Removed non-existent AO5 (4 AOs, not 5)
- **IGCSE_DT:** Changed Paper1/Paper2/Coursework → AO1/AO2/AO3 per Cambridge syllabus 0445
- **NESA_DT:** Changed placeholder DM/DP/MP/ME → DP/Pr/Ev matching NSW outcome areas
- **VIC_DT:** Changed TK/DP/PP → TS/TC/CDS matching Victorian Curriculum strands
- **ACARA_DT:** Changed "P&P" → "PPS" for safe key usage
- **A_LEVEL_DT:** Minor label polish (confirmed C1/C2/C3 correct)
- **PLTW:** Confirmed Design/Build/Test/Present correct

Grade tab bug fixed: non-MYP frameworks now always use framework registry criteria, bypassing content extraction that was falling back to MYP definitions.

Added NESA_DT + VIC_DT vocabulary entries and design process phases to `framework-vocabulary.ts` and `constants.ts`.

**Test:** Full e2e for 3 frameworks (MYP, GCSE, ACARA): create class → create unit → generate → grade → verify terminology throughout.

---

## Files Inventory (will be modified)

### Phase 1 (Grading + Data)
- `supabase/migrations/055_class_framework.sql` — NEW
- `src/lib/constants.ts` — new helpers: `getFrameworkCriteria()`, `getGradingScale()`
- `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` — Grade tab scale + criteria fix
- `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` — Full grading page fix
- `src/app/teacher/classes/create/page.tsx` (or equivalent) — Wire framework selector
- `src/app/api/teacher/dashboard/route.ts` — Return class framework
- `src/app/api/teacher/class-units/route.ts` — Return class framework

### Phase 2 (Generation Pipeline)
- `src/lib/ai/prompts.ts` — Parameterize all system prompts with framework
- `src/lib/ai/framework-vocabulary.ts` — Add `framework` param to generation pipeline
- `src/app/api/teacher/generate-outlines/route.ts` — Accept + thread framework
- `src/app/api/teacher/generate-unit/route.ts` — Same
- `src/app/api/teacher/generate-journey/route.ts` — Same
- `src/app/api/teacher/regenerate-page/route.ts` — Same
- `src/app/api/teacher/wizard-suggest/route.ts` — Same
- `src/components/teacher/wizard/ArchitectForm.tsx` — Gate MYP fields, show GCSE/ACARA fields
- `src/components/teacher/wizard/GuidedConversation.tsx` — Framework-aware turns
- `src/components/teacher/wizard/GoalInput.tsx` — Framework context

### Phase 3 (Polish)
- `src/lib/ai/prompts.ts` — Timing profile rename
- `src/lib/constants.ts` — Grade level constants per framework
- Various UI components — Remove hardcoded "MYP" text

---

## Key Decisions

1. **Framework on `classes` table, not `units` or `class_units`** — A class IS a framework context. All units in "10 GCSE Design" are GCSE.
2. **Default to IB_MYP** — Existing data has no framework value; default preserves current behavior.
3. **Framework selector on class creation** — Set once, applies to all units in that class. Changeable in class settings.
4. **`CURRICULUM_FRAMEWORKS` registry is the single source of truth** — Criteria keys, labels, scale config all derived from this registry. Adding a new framework = add one entry here + optionally add framework-specific wizard fields.
5. **Don't touch unit_type architecture** — MYPflex is orthogonal to the Unit Type dimension. A GCSE Design unit and an MYP Design unit share the same `unitType: "design"` but different `framework: "GCSE_DT"` vs `"IB_MYP"`.

---

## Relationship to Existing Specs

- **`docs/specs/unit-type-framework-architecture.md`** (770 lines) — The master spec that defined the 4-dimension model. MYPflex implements Dimension 2 (Programme/Framework). Dimension 1 (Unit Type) is done. Dimensions 3-4 (Curriculum Standards) are future.
- **`docs/specs/design-hardcoding-deep-audit.md`** (90 findings) — Many were fixed in Unit Generation Phases 0-2. MYPflex addresses the remaining framework-specific subset.
- **`src/lib/ai/framework-vocabulary.ts`** — Already maps 6 frameworks to terminology. MYPflex wires this into the generation pipeline (currently unused).

---

## Success Criteria

- [x] A teacher can create a class with framework=GCSE_DT ✅ Phase 1
- [x] The Grade tab shows 0-100% scale with AO1-AO4 criteria ✅ Phase 1 (corrected from AO1-AO5 in audit)
- [x] The full grading page works with GCSE scoring ✅ Phase 1
- [x] AI-generated units reference GCSE specification, not MYP ✅ Phase 2
- [x] MYP-specific wizard fields (global contexts, key concepts, ATL) are hidden for GCSE ✅ Phase 2
- [x] Existing MYP users see zero changes (backward compatible) ✅ Phase 1
- [x] Framework is visible on class cards / dashboard for clarity ✅ Phase 1
- [x] All 8 framework criteria definitions match official syllabi ✅ Audit
- [x] Report Writer supports all 9 frameworks with per-framework categories ✅ Phase 3
- [x] TestSandbox criteria match corrected constants ✅ Phase 3
- [x] Non-MYP Grade tabs never fall back to MYP criteria ✅ Audit
- [ ] System handles criteria count changes gracefully (Phase 4)

---

## Phase 4: Future-Proofing for MYP Changes (OPEN)

> **Added:** 29 Mar 2026
> **Context:** The IB MYP is likely to change its criteria structure — e.g., MYP Design may move from 4 criteria (A/B/C/D) to 3. StudioLoom needs to handle this without breaking existing units or requiring a migration.

### The Problem

The current system has criteria hardcoded in several places:
- `getCriteriaForType()` returns fixed arrays per unit type (Design: A/B/C/D, Service: I/P/A/R/D, PP: A/B/C)
- `CriterionKey` is now `string` (good — not locked to 4 values), but many UI layouts assume 4 columns
- Grading page, dashboard cards, wizard summary rail, and AI prompts all reference criteria counts
- Existing units with 4-criterion content_data would need to coexist with new 3-criterion units

### What Needs to Happen

1. **Criteria definitions should be data, not code** — move from hardcoded `DESIGN_CRITERIA` arrays in constants.ts to a `framework_criteria` config that can be versioned. When MYP changes, add a new version without removing the old one.

2. **Units should store their criteria version** — `content_data` should record which criteria set it was generated with. A unit generated under "MYP Design 2025 (A/B/C/D)" continues to use that set even after the framework updates to 3 criteria. New units get the new set.

3. **Grading page must be criteria-count-agnostic** — currently renders columns per criterion. Should dynamically render N columns based on the unit's criteria, not a hardcoded set. This is partially done (uses `getFrameworkCriteria()`) but needs testing with non-4-criterion sets.

4. **AI generation prompts must reference the unit's criteria, not the framework default** — if a teacher generates a unit under old MYP (4 criteria) and later the framework updates to 3, regenerating a single lesson should still use the unit's 4-criterion context (from content_data), not the new framework default.

5. **Migration path for existing units** — when MYP changes, existing units are NOT auto-migrated. Teacher can optionally "upgrade" a unit to the new criteria structure (this would require re-mapping content and potentially re-grading).

### Estimated Effort

- Phase 4a: Criteria versioning architecture (~2-3 hours)
- Phase 4b: UI audit for criteria-count assumptions (~1-2 hours)
- Phase 4c: Migration path design (~1 hour)
- Total: ~4-6 hours, but NOT urgent until IB announces changes

### When to Build

Wait for official IB announcement about criteria changes. The architecture decisions above should be made now (this doc), but implementation can wait. The key insight is: **don't hardcode criteria counts anywhere new**. Every new feature should use `getCriteriaForType()` and iterate dynamically.
