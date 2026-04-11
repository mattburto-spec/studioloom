# Quarantine Register

**Date:** 3 April 2026 (original) · **Updated:** 11 April 2026 (Phase 1.6 disconnect)
**Status:** QUARANTINED — all entry points sealed

---

## Phase 1.6 update — 11 April 2026

Phase 1.6 of the Dimensions3 Completion Project completed the old knowledge UI
disconnect that was claimed (incorrectly) on 3 April. Three things to know:

1. **The 3 April entry was wrong about the nav link.** The 3 Apr quarantine
   register said the "Knowledge" nav link in `src/app/teacher/layout.tsx:43`
   was commented out. It wasn't — the entry was either never applied or was
   re-added. The nav link was *actually* disconnected on **11 Apr 2026** as
   part of Phase 1.6, by replacing the entry with a "Library" link pointing
   at `/teacher/library`.

2. **Old `/teacher/knowledge/*` directory is DELETED, not quarantined.** The
   directory `src/app/teacher/knowledge/` (containing the old dashboard
   `page.tsx`, plus the new Dimensions3 `review/` and `import/` pages that
   had been added under the old URL prefix) has been removed entirely. The
   two new pages were relocated:
   - `src/app/teacher/knowledge/review/page.tsx` → `src/app/teacher/library/review/page.tsx`
   - `src/app/teacher/knowledge/import/page.tsx`  → `src/app/teacher/library/import/page.tsx`
   - new landing page at `src/app/teacher/library/page.tsx`

3. **`/api/teacher/knowledge/ingest` was relocated, `/api/teacher/knowledge/import` was deleted.**
   - `src/app/api/teacher/knowledge/ingest/route.ts` (a real Dimensions3 route,
     never a 410 tombstone) was moved to `src/app/api/teacher/library/ingest/route.ts`.
     The new `library/review` page calls the new path.
   - `src/app/api/teacher/knowledge/import/route.ts` was a 501 placeholder stub
     and has been deleted entirely. **No real reconstruction endpoint exists**
     yet — the moved `library/import/page.tsx` calls
     `/api/teacher/library/import` which currently 404s. This is a known
     blocker for the import flow, awaiting product decision (see
     Phase 1.6 checkpoint report).

The 15 API routes in the table below that return 410 Gone are unchanged —
they remain as harmless tombstones. Deleting them risks breaking any cached
client that still hits them in dev.

---
**Reason:** Both the knowledge pipeline and unit generation pipeline are being rebuilt from scratch per Dimensions2 spec (`docs/projects/dimensions2.md`). The existing ingestion pipeline (upload → 3-pass analysis → chunking → embedding) will be replaced by the Activity Block Library (Pillar 1). The existing generation pipeline (wizard → AI generation → structured output) will be replaced by Block-Aware Generation (Pillar 2). Keeping the old pipelines active during the rebuild risks contaminating the new architecture.

---

## Part 1: Knowledge Pipeline

The entire Knowledge Base feature: upload UI, ingestion pipeline, analysis pipeline, feedback loop, and all associated API routes. The **retrieval layer** (Layer 3) is NOT quarantined — it returns empty arrays gracefully when no content exists.

## Entry points sealed

### Layer 1: Upload UI

| # | File | What was disabled | How |
|---|------|-------------------|-----|
| 1 | `src/app/teacher/layout.tsx` line 43 | "Knowledge" nav link | **3 Apr entry was incorrect — link was not actually removed then.** Replaced with "Library" link → `/teacher/library` on **11 Apr 2026** (Phase 1.6). |
| 2 | `src/app/teacher/knowledge/page.tsx` | Entire knowledge library page | **DELETED 11 Apr 2026** — whole `src/app/teacher/knowledge/` directory removed (Phase 1.6). |

### Layer 2: Ingestion Pipeline

| # | File | What was disabled | How |
|---|------|-------------------|-----|
| 3 | `src/app/teacher/units/create/page.tsx` ~line 945 | Auto-ingest on unit creation (`/api/teacher/knowledge/ingest`) | Commented out |
| 4 | `src/app/teacher/units/create/page.tsx` ~line 955 | RAG chunk usage recording (`/api/teacher/knowledge/record-usage`) | Commented out |
| 5 | `src/app/teacher/units/[unitId]/edit/page.tsx` ~line 152 | Auto-ingest on unit save (`/api/teacher/knowledge/ingest`) | Commented out |
| 6 | `src/app/api/teacher/units/route.ts` ~line 212 | `ingestUnit()` call on fork + `recordFork()` | Commented out; imports also commented |
| 7 | `src/app/teacher/units/[unitId]/page.tsx` line 6 | `TeacherFeedbackForm` import + render | Commented out; feedback button + expandable form removed |

### Layer 2: API Routes (15 route files, all returning 410 Gone)

Every exported handler in every file under `src/app/api/teacher/knowledge/` now returns:
```json
{ "error": "Knowledge pipeline quarantined — pending architecture rebuild. See docs/quarantine.md" }
```
with HTTP status 410 Gone.

| # | Route file | Handlers blocked |
|---|-----------|-----------------|
| 8 | `upload/route.ts` | POST, GET, DELETE |
| 9 | ~~`ingest/route.ts`~~ | **MOVED 11 Apr 2026** to `src/app/api/teacher/library/ingest/route.ts` — never was a 410 tombstone, this row was always wrong. |
| 10 | `reanalyse/route.ts` | POST |
| 11 | `items/route.ts` | GET, POST |
| 12 | `items/[id]/route.ts` | GET, PUT, DELETE |
| 13 | `items/[id]/link/route.ts` | POST, DELETE |
| 14 | `items/[id]/curricula/route.ts` | PUT |
| 15 | `feedback/route.ts` | POST, GET |
| 16 | `feedback/aggregate/route.ts` | GET |
| 17 | `record-usage/route.ts` | POST |
| 18 | `media/route.ts` | POST |
| 19 | `tags/route.ts` | GET |
| 20 | `quick-modify/route.ts` | POST |
| 21 | `lesson-profiles/[id]/route.ts` | GET, PATCH |
| 22 | `lesson-profiles/[id]/reanalyse/route.ts` | POST |

### What is NOT quarantined (and why)

| File | Reason it stays |
|------|----------------|
| `src/lib/knowledge/retrieve.ts` | Returns empty arrays when knowledge base has no content. Generation routes call this — removing it would break unit generation. |
| `src/lib/knowledge/retrieve-lesson-profiles.ts` | Same — returns empty gracefully. |
| `src/lib/ai/prompts.ts` (`buildRAG*` functions) | These call retrieve.ts. When retrieval returns empty, the prompt simply has no RAG examples — generation works fine. |
| All 8 generation routes | They import from retrieve.ts but work without RAG content. |
| `StudentFeedbackPulse` component | Despite living in `src/components/teacher/knowledge/`, it posts to `/api/student/pace-feedback` (timing model), NOT to any knowledge endpoint. It's the pace feedback system, not part of the knowledge pipeline. |

## Library files (not deleted, just unreachable)

These files still exist on disk. No code calls them anymore because all entry points above are sealed:

- `src/lib/knowledge/analyse.ts` (838 lines) — 3-pass analysis orchestrator
- `src/lib/knowledge/analysis-prompts.ts` (895 lines) — analysis system prompts
- `src/lib/knowledge/chunk.ts` (675 lines) — structure-aware chunking
- `src/lib/knowledge/extract.ts` (227 lines) — PDF/DOCX/PPTX text extraction
- `src/lib/knowledge/vision.ts` (462 lines) — Claude Vision for diagrams
- `src/lib/knowledge/ingest-unit.ts` (121 lines) — auto-ingest created units
- `src/lib/knowledge/feedback.ts` (339 lines) — RAG quality feedback loop
- `src/components/teacher/knowledge/KnowledgeItemCard.tsx` (418 lines)
- `src/components/teacher/knowledge/KnowledgeItemForm.tsx` (690 lines)
- `src/components/teacher/knowledge/LessonProfileReview.tsx` (1,026 lines)
- `src/components/teacher/knowledge/AnalysisDetailPanel.tsx` (738 lines)
- `src/components/teacher/knowledge/TeacherFeedbackForm.tsx` (489 lines)
- `src/components/teacher/knowledge/CurriculumMapper.tsx` (169 lines)
- `src/components/teacher/knowledge/TagAutocomplete.tsx` (137 lines)
- `src/components/teacher/knowledge/MediaUploader.tsx` (153 lines)
- `src/components/teacher/BatchUpload.tsx` (572 lines)

## How to verify quarantine is working

1. **Nav link gone:** Log in as teacher → sidebar should NOT show "Knowledge" link
2. **Direct URL blocked:** Navigate to `/teacher/knowledge` → page loads but all data fetches return 410 (page will show errors or empty state)
3. **Unit creation clean:** Create a new unit → no network request to `/api/teacher/knowledge/ingest` or `/api/teacher/knowledge/record-usage`
4. **Unit editing clean:** Edit an existing unit → no network request to `/api/teacher/knowledge/ingest`
5. **Unit forking clean:** Fork a unit → no `ingestUnit()` or `recordFork()` calls
6. **Unit detail page:** No "Give Feedback" button on unit detail page
7. **Generation still works:** Create a unit via Express/Guided/Architect lane → generation completes (without RAG enrichment, but still produces valid content)
8. **Student pace feedback still works:** Students can still submit pace feedback (🐢👌🏃) — this is NOT part of the quarantine

## How to lift quarantine

When the Dimensions2 rebuild is ready:

1. Delete all `QUARANTINE_RESPONSE` constants and `return QUARANTINE_RESPONSE;` lines from the 15 route files
2. Uncomment the nav link in `teacher/layout.tsx`
3. Uncomment auto-ingest calls in `units/create/page.tsx`, `units/[unitId]/edit/page.tsx`
4. Uncomment `ingestUnit` + `recordFork` imports and call in `api/teacher/units/route.ts`
5. Uncomment `TeacherFeedbackForm` import/state/render in `units/[unitId]/page.tsx`
6. Grep for "QUARANTINED (3 Apr 2026)" to find all markers

Or more likely: replace the entire pipeline with the new Activity Block Library architecture, at which point most of these files get rewritten or deleted.

---

## Part 2: Unit Generation Pipeline

The entire AI-powered unit generation system: wizard create page, all generation API routes, outline generation, timeline generation, skeleton generation, page regeneration, lesson conversion/import, wizard suggestions, and admin test sandbox.

### UI Entry Points Sealed

| # | File | What was disabled | How |
|---|------|-------------------|-----|
| 23 | `src/app/teacher/units/create/page.tsx` | Wizard create page | Early return renders "Unit Builder is Being Rebuilt" message with back button |
| 24 | `src/app/teacher/units/page.tsx` ~line 531 | "Build with AI" button (main) | Changed from `<Link>` to disabled `<span>` with "(Coming Soon)" |
| 25 | `src/app/teacher/units/page.tsx` ~line 694 | "Build with AI" button (empty state) | Same — disabled span |
| 26 | `src/app/teacher/units/page.tsx` ~line 517 | "Import" button (main) | Changed from `<Link>` to disabled `<span>` with "(Coming Soon)" |
| 27 | `src/app/teacher/units/page.tsx` ~line 702 | "Import Plan" button (empty state) | Same — disabled span |
| 28 | `src/components/teacher/TeacherAIFAB.tsx` ~line 46 | "Build Unit" FAB action | `window.location.href` commented out, now no-ops silently |

### Generation API Routes (14 route files, all returning 410 Gone)

Every exported handler now returns:
```json
{ "error": "Generation pipeline quarantined — pending architecture rebuild. See docs/quarantine.md" }
```
with HTTP status 410 Gone.

| # | Route file | Handlers blocked |
|---|-----------|-----------------|
| 29 | `api/teacher/generate-unit/route.ts` | POST |
| 30 | `api/teacher/generate-outlines/route.ts` | POST |
| 31 | `api/teacher/generate-journey/route.ts` | POST |
| 32 | `api/teacher/generate-journey-outlines/route.ts` | POST |
| 33 | `api/teacher/generate-timeline/route.ts` | POST |
| 34 | `api/teacher/generate-timeline-outlines/route.ts` | POST |
| 35 | `api/teacher/generate-timeline-outline-single/route.ts` | POST |
| 36 | `api/teacher/generate-timeline-skeleton/route.ts` | POST |
| 37 | `api/teacher/regenerate-page/route.ts` | POST |
| 38 | `api/teacher/activity-cards/generate-modifiers/route.ts` | POST |
| 39 | `api/teacher/convert-lesson/route.ts` | POST |
| 40 | `api/teacher/wizard-suggest/route.ts` | POST |
| 41 | `api/admin/ai-model/test-lesson/route.ts` | POST |
| 42 | `api/admin/ai-model/test/route.ts` | POST |

### What is NOT quarantined (and why)

| System | Reason it stays |
|--------|----------------|
| **Manual unit creation** ("Manual" button on units page) | Creates a blank unit in DB — no AI, no generation. Teachers can still create units manually and build them in the lesson editor. |
| **Lesson editor** (Phase 0.5 at `/teacher/units/[unitId]/class/[classId]/edit`) | Editing existing content. Teachers must be able to modify their units. |
| **Lesson editor AI field assist** (`/api/teacher/lesson-editor/ai-field`) | Tiny Haiku calls for field-specific suggestions (hook ideas, debrief protocols). Helps with editing, not generation. |
| **Lesson editor suggest** (`/api/teacher/lesson-editor/suggest`) | Same — editing assistance. |
| **Design Assistant** (`/api/student/design-assistant/`) | Student-facing AI mentor. Independent of generation pipeline. |
| **Teaching Mode** | Live classroom teaching. No generation involved. |
| **Open Studio AI** | Student mentoring check-ins. Independent system. |
| **Toolkit tools** (27 interactive tools at `/toolkit/*`) | AI-powered student tools. Independent endpoints. |
| **Admin AI model config** (`/admin/ai-model`) | Settings page for generation dials. Harmless — it stores config but the generation routes that read config are blocked. Test sandbox buttons return 410. |
| **Lesson Pulse scoring** | Post-generation quality scoring. Won't fire since generation is blocked. Code is clean and will be reused. |
| **Teaching Moves Library** | `src/lib/ai/teaching-moves.ts` — curated activity patterns. Reusable content, referenced by generation but independent. |
| **RAG retrieval** (`retrieve.ts`, `retrieve-lesson-profiles.ts`) | Returns empty arrays gracefully. Used by generation routes (now blocked) and by `buildRAG*` prompt functions. No harm in leaving it. |
| **StudentFeedbackPulse** | Pace feedback (🐢👌🏃). Posts to `/api/student/pace-feedback`, not knowledge endpoints. |

### Library files (not deleted, just unreachable)

Generation pipeline library files still on disk:

- `src/lib/ai/prompts.ts` — All `buildRAG*` prompt builder functions (these would be rewritten in Dimensions2 Pillar 2)
- `src/lib/ai/schemas.ts` — Zod schemas for generation tool outputs
- `src/lib/ai/anthropic.ts` — AI provider with `generateSkeleton()`, `generateCriterionPages()`, etc.
- `src/lib/ai/timing-validation.ts` — Workshop Model validation (will be reused)
- `src/lib/converter/` — Lesson plan converter library
- `src/hooks/useWizardState.ts` — Wizard state machine (73 reducer actions)
- `src/hooks/useWizardSuggestions.ts` — Wizard AI suggestions hook
- `src/components/teacher/wizard/` — All wizard UI components (ConversationWizard, GuidedConversation, ArchitectForm, ModeSelector, GoalInput, etc.)

## How to verify quarantine is working

### Knowledge pipeline
1. **Nav link gone:** Log in as teacher → sidebar should NOT show "Knowledge" link
2. **Direct URL blocked:** Navigate to `/teacher/knowledge` → page loads but all data fetches return 410
3. **Unit creation clean:** Create a manual unit → no network request to `/api/teacher/knowledge/ingest`
4. **Unit editing clean:** Edit an existing unit → no network request to `/api/teacher/knowledge/ingest`
5. **Unit forking clean:** Fork a unit → no `ingestUnit()` or `recordFork()` calls
6. **Unit detail page:** No "Give Feedback" button

### Generation pipeline
7. **"Build with AI" disabled:** On units page → button is grayed out with "(Coming Soon)"
8. **"Import" disabled:** On units page → button is grayed out with "(Coming Soon)"
9. **Wizard page blocked:** Navigate directly to `/teacher/units/create` → shows "Unit Builder is Being Rebuilt" message
10. **Generation routes blocked:** POST to any `/api/teacher/generate-*` → 410 Gone
11. **Admin test sandbox blocked:** POST to `/api/admin/ai-model/test-*` → 410 Gone

### Still working
12. **Manual unit creation:** "Manual" button on units page → creates blank unit → opens in lesson editor
13. **Lesson editor:** Can edit existing units (all lesson editor features work)
14. **Teaching Mode:** Can teach existing units (phase timer, student grid, projector)
15. **Student experience:** Students can view lessons, submit responses, use toolkit tools, pace feedback
16. **Design Assistant:** Student AI mentor works normally

## How to lift quarantine

Grep for `QUARANTINED (3 Apr 2026)` to find ALL markers across the codebase.

Most likely these files will be rewritten or deleted as part of the Dimensions2 rebuild rather than simply un-quarantined.
