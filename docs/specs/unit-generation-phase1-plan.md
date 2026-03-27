# Unit Generation Project — Phase 1 Build Plan
## Gateway: Conditional Wizard + Generation Wiring

**Date:** 27 March 2026
**Status:** PLAN — awaiting Matt's review before build
**Depends on:** Phase 0 (COMPLETE)
**Estimated effort:** 3-4 days
**References:**
- `docs/specs/unit-type-framework-architecture.md` — master architecture (Parts 1-13)
- `docs/specs/wizard-lanes-spec.md` — 3-lane wizard UX (Phase 3, not this phase)
- `docs/specs/design-hardcoding-deep-audit.md` — 90 hardcoded instances

---

## What Phase 1 Achieves

After Phase 1, a teacher can:
1. Select any of the 4 unit types in the wizard (Design / Service / Personal Project / Inquiry)
2. See type-appropriate fields (not MYP Design fields for a Service unit)
3. Optionally enter a curriculum context free-text field (already wired in Phase 0)
4. Generate a unit that uses the correct system prompt, phase labels, criteria, and timing for that type
5. Get meaningful AI-generated content for Service, PP, and Inquiry units (not just Design vocabulary pasted onto a different structure)

After Phase 1, a teacher **cannot** yet:
- Use Express or Architect wizard lanes (Phase 3)
- Have the AI auto-detect unit type from topic text (Phase 3 — Express lane feature)
- See type-specific blocks in the lesson editor (Phase 3 — Editor)
- Get standards-tagged activities (Phase 4+)
- Use a structured framework selector with visual cards (Phase 3)

**In short: Phase 1 makes the Guided wizard lane work correctly for all 4 unit types.**

---

## Task Breakdown

### Task 1: Conditional Wizard Fields (~1 day)

**Problem:** The wizard always shows MYP Design fields: Global Context, Key Concept, Related Concepts, Specific Skills (CAD, 3D Printing, etc.). These are meaningless for a Service or PP unit.

**What changes:**

The `GuidedConversation.tsx` conversation turns need to be conditional on `unitType`. Currently there are 5 turns hardcoded:

```
1. globalContext → "What global context?"
2. keyConcept → "What key concept?"
3. relatedConcepts → "Related concepts?"
4. specificSkills → "What specific skills?"
5. atlSkills → "What ATL skills?"
```

After Phase 1, the turns are built dynamically based on `unitType`:

| Turn | Design | Service | Personal Project | Inquiry |
|------|--------|---------|-----------------|---------|
| 1 | Global Context | Community Context | Personal Interest Area | Central Idea |
| 2 | Key Concept | SDG Connection (optional) | Goal Type (product/skill/event) | Transdisciplinary Theme |
| 3 | Related Concepts | Service Outcomes | ATL Skills Focus | Lines of Inquiry |
| 4 | Specific Skills (CAD, etc.) | Partner Type (community org/individual/government) | Presentation Format | — |
| 5 | ATL Skills | ATL Skills | — | — |

**Implementation approach:**

- Add a `buildConversationTurns(unitType: UnitType)` function in `GuidedConversation.tsx`
- Each turn has: `id`, `question`, `field` (maps to UnitWizardInput key), `type` (single/multi), `options`
- The existing MYP constants (`MYP_GLOBAL_CONTEXTS`, `MYP_KEY_CONCEPTS`, `MYP_RELATED_CONCEPTS_DESIGN`, `DESIGN_SKILLS`) become the options for `unitType === "design"`
- New option sets for Service, PP, Inquiry defined in `src/lib/constants.ts`:
  - `SERVICE_COMMUNITY_CONTEXTS` — "Environmental sustainability", "Health & wellbeing", "Education access", "Cultural preservation", "Food security", "Animal welfare", "Homelessness & housing", "Technology access"
  - `SERVICE_SDG_OPTIONS` — UN SDG 1-17 (short labels)
  - `SERVICE_OUTCOMES` — "Awareness raising", "Direct service", "Advocacy", "Resource creation", "Policy change", "Community building"
  - `SERVICE_PARTNER_TYPES` — "Community organisation", "Government agency", "Individual/family", "School community", "Online community", "No partner (student-led)"
  - `PP_GOAL_TYPES` — "Create a product", "Develop a skill", "Organise an event", "Conduct research", "Build something", "Write/create art"
  - `PP_PRESENTATION_FORMATS` — "Exhibition display", "Live demonstration", "Digital portfolio", "Written report", "Video documentary", "Oral presentation"
  - `INQUIRY_THEMES` — "Who We Are", "Where We Are in Place and Time", "How We Express Ourselves", "How the World Works", "How We Organize Ourselves", "Sharing the Planet" (PYP transdisciplinary themes)

- The `UnitWizardInput` interface gets new optional fields:
  ```typescript
  // Service-specific
  communityContext?: string;
  sdgConnection?: string;
  serviceOutcomes?: string[];
  partnerType?: string;
  // PP-specific
  personalInterest?: string;
  goalType?: string;
  presentationFormat?: string;
  // Inquiry-specific
  centralIdea?: string;
  transdisciplinaryTheme?: string;
  linesOfInquiry?: string[];
  ```

- `SummaryRail.tsx` updated to show type-appropriate labels (currently shows "Global Context", "Key Concept" etc. — needs to show "Community Context", "SDG" for Service)

**Files changed:**
- `src/types/index.ts` — add new optional fields to `UnitWizardInput` and `LessonJourneyInput`
- `src/lib/constants.ts` — add Service/PP/Inquiry option sets
- `src/components/teacher/wizard/GuidedConversation.tsx` — `buildConversationTurns(unitType)`, conditional turn rendering
- `src/components/teacher/wizard/SummaryRail.tsx` — type-aware field labels
- `src/hooks/useWizardState.ts` — sync new fields to journeyInput, reset on type change

### Task 2: Wire Unit Type Into ALL Generation Routes (~0.5 day)

**Problem:** Phase 0 wired unit type into `generate-unit` and `generate-outlines`. But `generate-journey`, `regenerate-page`, and `lesson-editor/ai-field` still partially use hardcoded Design prompts.

**Current state per route:**

| Route | Unit type read? | System prompt parameterised? | Criteria dynamic? | Curriculum context used? |
|-------|----------------|-----------------------------|--------------------|------------------------|
| `generate-unit` | ✅ | ✅ via `buildUnitTypeSystemPrompt()` | ✅ via `getCriterionKeys()` | ✅ in `buildCriterionPrompt()` |
| `generate-outlines` | ✅ | Partial — `buildOutlinePrompt()` fixed | ✅ via `buildPageDefinitions()` | ❌ not in outline prompt |
| `generate-journey` | ✅ | ✅ via `buildUnitTypeSystemPrompt()` | Needs check | ✅ in `buildJourneyPrompt()` |
| `regenerate-page` | ✅ | ✅ via `buildUnitTypeSystemPrompt()` | Needs check | ❌ not passed |
| `test-lesson` (admin) | ✅ | ✅ | ✅ | ❌ |
| `test` (admin skeleton) | ❌ | ❌ hardcoded | ❌ | ❌ |
| `lesson-editor/ai-field` | ❌ | ❌ "design & technology teachers" | N/A | ❌ |

**What changes:**

1. `generate-outlines/route.ts` — add `curriculumContext` to the outline prompt
2. `regenerate-page/route.ts` — verify `curriculumContext` flows through; add if missing
3. `lesson-editor/ai-field/route.ts` — read `unitType` from request body, parameterise system prompt ("design & technology" → type-appropriate subject)
4. `test/route.ts` (admin skeleton) — read `unitType` from test input, use `buildUnitTypeSystemPrompt()` instead of hardcoded prompt (low priority — admin only)

**Files changed:**
- `src/app/api/teacher/generate-outlines/route.ts`
- `src/app/api/teacher/regenerate-page/route.ts`
- `src/app/api/teacher/lesson-editor/ai-field/route.ts`
- `src/app/api/admin/ai-model/test/route.ts` (optional)

### Task 3: Type-Aware Generation Prompts (~1 day)

**Problem:** Even when `buildUnitTypeSystemPrompt()` is called, the sub-prompts still inject Design-specific content:
- `buildDesignTeachingContext()` injects 12 Design pedagogy principles into ALL generation
- `buildTimingBlock()` hardcodes 45% work time floor
- `designPhase` enum in schemas only has `["investigation", "ideation", "prototyping", "evaluation"]`
- Extension generation references Design phases only
- Keyword suggestions are Design-tool-centric

**What changes:**

1. **`buildDesignTeachingContext()` → `buildTeachingContext(unitType)`** — For `design`, injects the existing Design Teaching Corpus. For `service`, injects a Service teaching context (drawn from architecture spec Part 3: IPARD cycle, reciprocity, community partnership, reflection as mechanism, etc.). For `pp` and `inquiry`, injects lighter-weight contexts from the stubs in the architecture spec (Appendix A). These are NOT full corpuses yet — just the 7-10 principles from the spec, formatted as prompt instructions. Full corpuses are Phase 2.

2. **`buildTimingBlock(unitType)`** — Parameterise the work time floor:
   - Design: 0.45 (45% — making is the learning)
   - Service: 0.30 (30% — planning and reflection take more time)
   - PP: 0.40 (40% — self-directed, mix of research + creation)
   - Inquiry: 0.35 (35% — more exploration and discussion)

3. **`designPhase` → `activityPhase`** in `schemas.ts` — Dynamic enum based on unit type:
   - Design: `["investigation", "ideation", "prototyping", "evaluation"]`
   - Service: `["investigation", "planning", "action", "reflection", "demonstration"]`
   - PP: `["defining", "planning", "creating", "reflecting", "reporting"]`
   - Inquiry: `["wondering", "exploring", "creating", "sharing"]`

4. **Extension generation** — `buildExtensionRulesForType(unitType)` already exists in `unit-types.ts`. Wire it into the generation prompt where extensions are described. Currently extensions say "indexed to the current design phase" — change to use `getPhaseLabels(unitType)`.

5. **Keyword suggestion context** — The `wizard-suggest/route.ts` system prompt currently asks for "design & technology" keywords. Parameterise: Service → community/stakeholder keywords, PP → research/presentation keywords, Inquiry → inquiry/exploration keywords.

**Files changed:**
- `src/lib/ai/prompts.ts` — `buildTeachingContext(unitType)`, `buildTimingBlock(unitType)`, extension rules
- `src/lib/ai/schemas.ts` — `designPhase` → `activityPhase` with dynamic enum
- `src/app/api/teacher/wizard-suggest/route.ts` — type-aware keyword suggestions

### Task 4: Type-Aware Keyword Suggestions (~0.5 day)

**Problem:** When the AI suggests keywords for the wizard's drag-to-bucket system, it always suggests Design tools and materials (CAD, laser cutter, acrylic, etc.). For a Service unit, it should suggest community contexts, stakeholder types, and ethical frameworks.

**What changes:**

The `wizard-autoconfig/route.ts` and `wizard-suggest/route.ts` both send a system prompt to the AI asking for keyword suggestions. These prompts need the unit type injected so the AI knows what domain to suggest from.

1. `wizard-suggest/route.ts` — Add `unitType` to the request body. Modify the system prompt:
   - Design: "Suggest design tools, materials, techniques, and processes relevant to this project"
   - Service: "Suggest community contexts, stakeholder types, ethical considerations, documentation methods, and reflection frameworks"
   - PP: "Suggest research methods, skill-building approaches, presentation formats, and ATL skill applications"
   - Inquiry: "Suggest inquiry questions, exploration methods, thinking routines, and sharing approaches"

2. `wizard-autoconfig/route.ts` — Same pattern. The auto-config already accepts any criteria keys (fixed in Phase 0). Now add unit type to the prompt context so the AI suggests appropriate emphasis.

**Files changed:**
- `src/app/api/teacher/wizard-suggest/route.ts`
- `src/app/api/teacher/wizard-autoconfig/route.ts`

### Task 5: Wire New Fields Into Generation Prompts (~0.5 day)

**Problem:** The new wizard fields (communityContext, sdgConnection, serviceOutcomes, etc.) need to flow into the AI generation prompts so the AI knows about them.

**What changes:**

1. `buildCriterionPrompt()` and `buildJourneyPrompt()` in `prompts.ts` — Add a "Unit-Specific Context" section that includes whichever type-specific fields are present:

```
## Unit-Specific Context
${input.communityContext ? `- Community Focus: ${input.communityContext}` : ""}
${input.sdgConnection ? `- SDG Connection: ${input.sdgConnection}` : ""}
${input.serviceOutcomes?.length ? `- Service Outcomes: ${input.serviceOutcomes.join(", ")}` : ""}
${input.partnerType ? `- Partner Type: ${input.partnerType}` : ""}
${input.personalInterest ? `- Personal Interest: ${input.personalInterest}` : ""}
${input.goalType ? `- Goal Type: ${input.goalType}` : ""}
${input.centralIdea ? `- Central Idea: ${input.centralIdea}` : ""}
${input.linesOfInquiry?.length ? `- Lines of Inquiry: ${input.linesOfInquiry.join(", ")}` : ""}
```

This is additive — empty fields produce no output. Design units with only `globalContext` and `keyConcept` generate the same prompt as before.

2. `buildOutlinePrompt()` — Same pattern for the outline generation.

**Files changed:**
- `src/lib/ai/prompts.ts` — add type-specific context block to 3 prompt builders

### Task 6: TypeScript Compilation + Manual Test (~0.5 day)

1. Run `npx tsc --noEmit --skipLibCheck` — verify 0 new errors in modified files
2. Run `npm run build` — verify Vercel-compatible build succeeds
3. Manual test matrix:

| Test | Steps | Expected |
|------|-------|----------|
| Design unit (regression) | Create wizard → select Design → complete flow → generate | Same output as before Phase 1. All Design fields present. |
| Service unit | Create wizard → select Service → see community/SDG/outcomes fields → generate | Service-appropriate lesson content. IPARD phases in output. No "design brief" or "prototype" language. |
| PP unit | Create wizard → select PP → see interest/goal/presentation fields → generate | Self-directed project content. Process journal emphasis. ATL skills references. |
| Inquiry unit | Create wizard → select Inquiry → see central idea/LOI/theme fields → generate | Inquiry-based content. Exploration activities. Transdisciplinary connections. |
| Type switch mid-wizard | Start as Design → switch to Service → verify criteria reset to IPARD, fields change | No stale Design fields. Community Context replaces Global Context. |
| Curriculum context | Any type → add curriculum context text → generate | AI references the curriculum in generated content. |

---

## What Phase 1 Does NOT Touch

These are explicitly deferred to later phases:

| Deferred | Phase | Why |
|----------|-------|-----|
| Express/Architect lanes | 3 | Need all data flowing correctly first (Guided lane) |
| AI auto-detection of unit type | 3 | Express lane feature — infer type from topic text |
| Framework selector UI (visual cards) | 3 | Currently just uses the class's framework; per-unit framework selection needs architecture thought |
| Lesson editor phase descriptions | 3 | Editor's PhaseSection needs `getPhaseConfig(unitType)` |
| Lesson editor block palette per type | 3 | Service blocks (community action, partner communication, etc.) from architecture spec Part 13 |
| Grading scale per programme | 3 | Currently 1-8 MYP only; GCSE 9-1, ACARA A-E need programme on class |
| Full teaching corpuses (Service/PP/Inquiry) | 2 | Phase 1 uses 7-10 principle stubs from architecture spec. Phase 2 expands to full corpus docs |
| Design Assistant unit-type awareness | 5 | `CRITERION_TO_PHASE`, `BLOOM_LEVELS`, `TOOLKIT_TOOLS_BY_PHASE` |
| Discovery Engine archetypes | 5 | Service-appropriate archetypes (Advocate, Organizer) |
| Knowledge base / converter | 4 | Service fingerprints, type-aware extraction |
| Standards database | 4+ | Structured curriculum standards |

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add 8 new optional fields to `UnitWizardInput` + `LessonJourneyInput` |
| `src/lib/constants.ts` | Add Service/PP/Inquiry option sets (community contexts, SDGs, outcomes, etc.) |
| `src/components/teacher/wizard/GuidedConversation.tsx` | `buildConversationTurns(unitType)`, conditional turn rendering |
| `src/components/teacher/wizard/SummaryRail.tsx` | Type-aware field labels |
| `src/hooks/useWizardState.ts` | Sync new fields, reset on type change |
| `src/lib/ai/prompts.ts` | `buildTeachingContext(unitType)`, `buildTimingBlock(unitType)`, type-specific context block |
| `src/lib/ai/schemas.ts` | `designPhase` → `activityPhase` with dynamic enum |
| `src/app/api/teacher/generate-outlines/route.ts` | Add curriculumContext to outline prompt |
| `src/app/api/teacher/regenerate-page/route.ts` | Verify curriculumContext flows through |
| `src/app/api/teacher/lesson-editor/ai-field/route.ts` | Read unitType, parameterise prompt |
| `src/app/api/teacher/wizard-suggest/route.ts` | Type-aware keyword suggestions |
| `src/app/api/teacher/wizard-autoconfig/route.ts` | Type-aware emphasis suggestions |

**Total: ~12 files, ~500-800 lines of changes (mostly additive — new option arrays and conditional prompt sections)**

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Design unit regression — existing units break | All changes are additive. `unitType || "design"` default everywhere. Test Design flow first. |
| Service prompt quality is poor without full corpus | Phase 1 uses 10 IPARD principles (from architecture spec Part 3). These are research-backed and specific enough for v1. Full corpus in Phase 2. |
| New wizard fields create a confusing UX | Fields are contextual — only shown for the relevant unit type. Fewer fields than Design for most types (Service has 4 turns, Inquiry has 3). |
| `designPhase` → `activityPhase` rename breaks existing data | The schema change only affects NEW generation. Existing units with `designPhase` in their content_data are read-only and unaffected. Add a `|| activity.designPhase` fallback when reading. |

---

## Success Criteria

Phase 1 is done when:
1. A teacher can generate a Service Learning unit with IPARD phases, community context, and no Design vocabulary
2. A teacher can generate a PP unit with self-directed structure, process journal emphasis
3. A teacher can generate an Inquiry unit with exploration activities, transdisciplinary connections
4. Existing Design units are completely unaffected (regression test passes)
5. TypeScript compiles clean, Next.js builds successfully
6. Migration 051 can be applied (unit_type + curriculum_context columns)

---

*Review this plan and confirm before build starts. Any questions, changes, or things I've missed?*
