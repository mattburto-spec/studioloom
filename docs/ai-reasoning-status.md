# AI Reasoning Architecture — Implementation Status

Last updated: March 13, 2026

## Layer 1: Unit Generation — ✅ COMPLETE

### Framework-Aware Vocabulary
- **File**: `src/lib/ai/framework-vocabulary.ts`
- `buildFrameworkPromptBlock(framework)` → prompt text block with correct terminology
- Maps 6 curricula: IB MYP, GCSE DT, NSW, PLTW, A-Level, IGCSE
- Prevents MYP-centric language (e.g. "Criteria A-D") for non-IB teachers

### Teaching Context Injection
- **File**: `src/lib/ai/teacher-context.ts`
- `getTeachingContext(teacherId)` → `PartialTeachingContext | null`
- `getFrameworkFromContext(context)` → curriculum framework string
- Fetches teacher profile (school, country, curriculum, equipment, class size)
- Injected into ALL generation prompts (outlines, skeleton, timeline, journey)

### Routes Updated
All 6 generation API routes now inject framework vocab + teaching context:
- `generate-timeline-outlines/route.ts`
- `generate-timeline-outline-single/route.ts`
- `generate-journey-outlines/route.ts`
- `generate-timeline-skeleton/route.ts`
- `generate-timeline/route.ts`
- `generate-journey/route.ts`

### Prompt Defensive Coding Fix (March 13)
All prompt builders in `src/lib/ai/prompts.ts` now use optional chaining for arrays that may be undefined:
- `input.specificSkills?.length` (was crashing outlines endpoint)
- `input.resourceUrls?.length`
- `(input.relatedConcepts || []).join(", ")`
- `(input.atlSkills || []).join(", ")`
- `(input.assessmentCriteria || []).join(", ")`
- `(input.selectedCriteria || []).map(...)`

---

## Layer 2: Pedagogical Feedback Loop — ✅ COMPLETE

### Feedback Collection
- **API**: `POST /api/teacher/knowledge/feedback` — saves to `lesson_feedback` table ✅
- **API**: `GET /api/teacher/knowledge/feedback?lesson_profile_id={id}` — retrieves feedback ✅
- **Components**: `TeacherFeedbackForm` mounted on teacher unit detail page ✅ + `StudentFeedbackPulse` shown after page completion ✅

### Feedback Aggregation
- **API**: `GET /api/teacher/knowledge/feedback/aggregate?lesson_profile_id={id}`
- **Function**: `aggregateFeedback(profileId)` in `src/lib/knowledge/feedback.ts`
- Computes: avg ratings, common patterns, timing variance, engagement distribution, pace consensus

### Quality Re-Scoring
- **Function**: `updateQualityFromFeedback(unitId, feedbackType, feedbackData)` in `src/lib/knowledge/feedback.ts`
- Teacher rating 4-5 + would_use_again → boost chunks +0.1
- Teacher rating 1-2 → penalize chunks -0.1 (floor 0.1)
- Student avg understanding ≥4.0 + pace just_right → boost +0.05
- ✅ Called async (fire-and-forget) from feedback POST route (line 119)

### Generation Usage Recording
- **Function**: `recordGenerationUsage()` in `src/lib/knowledge/feedback.ts`
- **API**: `POST /api/teacher/knowledge/record-usage` — thin route calling `recordGenerationUsage()`
- ✅ Called fire-and-forget from `saveUnit()` in wizard create page
- ✅ `ragChunkIds` captured from all SSE `complete` events + non-streaming responses into `WizardState.ragChunkIds`

### Feedback → Prompt Injection (closes the loop)
- **Function**: `retrieveAggregatedFeedback(profileIds)` in `src/lib/knowledge/feedback.ts`
- **Function**: `formatFeedbackContext(aggregated)` in `src/lib/ai/prompts.ts`
- Injected into: `buildRAGTimelinePrompt`, `buildRAGPerLessonPrompt`, `buildRAGSkeletonPrompt`, `buildRAGJourneyPrompt`
- Teachers who taught similar lessons → their experience feeds back into generation

### All Layer 2 Gaps — ✅ RESOLVED (March 13)
1. ✅ `TeacherFeedbackForm` mounted on teacher unit detail page with "Give Feedback" toggle button
2. ✅ `StudentFeedbackPulse` shown as modal after "Complete & Continue" on student pages (with Skip option)
3. ✅ `recordGenerationUsage()` wired into unit save via `/api/teacher/knowledge/record-usage`

---

## Layer 3: Student Design Assistant — ✅ COMPLETE

### Data Model
- **Migration**: `022_design_assistant.sql` (APPLIED)
- Tables: `design_conversations`, `design_conversation_turns`
- Tracks: Bloom's level (1-6), effort score (0-10), turn count, summary

### Conversation Management
- **File**: `src/lib/design-assistant/conversation.ts`
- CRUD: `createConversation()`, `loadConversation()`, `appendTurn()`, `endConversation()`
- Adaptive: `updateEffortScore()`, `adaptBloomLevel()` (increases every 4 turns if effort ≥ 4)
- `generateResponse()` — full orchestration: assess effort → adapt Bloom's → build prompt → call AI → store turns
- Uses Claude Haiku (`claude-haiku-4-5-20250315`), max_tokens: 300

### System Prompt
- **File**: `src/lib/ai/design-assistant-prompt.ts`
- Richard Paul's 6 question types (clarification, assumption-probing, evidence, viewpoint, implication, meta)
- Bloom's-adaptive complexity
- 3-strike effort gating ("I can see you're stuck...")
- Framework-aware vocabulary (reuses `getFrameworkVocabulary()`)
- Activity-context-aware (knows what student is working on)
- NEVER gives answers, always asks questions

### API Route
- **File**: `src/app/api/student/design-assistant/route.ts`
- POST: send message → get Socratic response (with effort/Bloom's tracking)
- GET: retrieve conversation by ID or find active conversation by unit+page
- Uses server-side `ANTHROPIC_API_KEY`

### Chat Widget — ✅ COMPLETE (March 13)
- **File**: `src/components/student/DesignAssistantWidget.tsx`
- Self-contained floating chat widget: collapsed FAB (lightbulb icon, bottom-left) → expanded chat panel
- Mounted on student page (`src/app/(student)/unit/[unitId]/[pageId]/page.tsx`)
- Auto-loads existing conversation on open via `GET /api/student/design-assistant?unitId=&pageId=`
- Sends messages via `POST /api/student/design-assistant`
- Shows Bloom's level badge in header, typing indicator, Skip button
- 340px wide, max 500px tall, amber/orange gradient header

---

## Layer 4: Quality Evaluator — ✅ COMPLETE + E2E TESTED

### Core Evaluator
- **File**: `src/lib/ai/quality-evaluator.ts`
- `evaluateTimelineQuality(activities, context, apiKey)` → `QualityReport`
- Scores against 10 pedagogy principles from design-pedagogy.md
- Uses Claude Haiku (~2s, ~$0.001 per evaluation)
- Structural-only fallback when API unavailable

### 10 Principles Scored
1. iteration, 2. productive_failure, 3. diverge_converge, 4. scaffolding_fade,
5. process_assessment, 6. critique_culture, 7. digital_physical_balance,
8. differentiation, 9. metacognitive_framing, 10. safety_culture

### Integration Points
- **Timeline generation** (`generate-timeline/route.ts`): quality report in both streaming (SSE `quality_report` event) and non-streaming paths
- **Client extraction** (`src/app/teacher/units/create/page.tsx`): wizard state stores `qualityReport` + `qualityReportStatus`
- **UI panel** (`src/components/teacher/wizard/QualityReportPanel.tsx`): score badge (green/amber/red), expandable principle scores, warnings, critical issues
- **Timeline Builder** (`TimelineBuilder.tsx`): shows QualityReportPanel after End Goal card
- **DB persistence** (`023_quality_report.sql`): `quality_report` JSONB + `teacher_id` on units table
- **Unit save**: quality_report + teacher_id saved when unit is created

### Bugs Fixed (March 13 2026)
1. **JSON parser**: AI returned trailing text after JSON object → `SyntaxError`. Fixed with brace-matching extraction that finds outermost `{}` boundaries before parsing.
2. **Timing variance**: Per-lesson evaluation compared 1 lesson (50m) against total unit time (300m) → "-83% variance". Fixed by adding `lessonsInBatch` parameter. Streaming and non-streaming paths now pass `lessonsInBatch: 1` when `lessonSkeleton` is present.
3. **Prompt crashes**: `input.specificSkills.length` threw when `specificSkills` undefined. Fixed with optional chaining across all prompt builders.

### E2E Test Results (March 13)
- Outlines: 3 approaches generated in 43s ✅
- Skeleton: 6 lessons in 36s ✅
- Per-lesson activities: 6 activities for L01 in 84s ✅
- Quality report: AI-scored, 10/10 principles evaluated, overall score 31/100 ✅
- Timing: 50m actual vs 50m expected (0% variance) ✅

---

## Layer 5: Community Intelligence — ⏳ DEFERRED

### What's Needed (not built yet)
- `curriculum_framework` column on `knowledge_chunks` table
- Framework filtering in retrieval (IB teacher gets IB chunks by default)
- Community quality metrics and decay
- Opt-in/opt-out UI for teachers
- Shared pool vs personal context separation at retrieval time

### Why Deferred
Not needed before first test users. The per-teacher RAG pipeline works fine for initial usage. Community intelligence matters when there are multiple teachers contributing. Design is captured in roadmap.md → "Shared Knowledge Pool".

---

## Activity-Type-Aware Timing Intelligence — NEW (March 13 2026)

### Problem Solved
The AI was generating identical timing for all MYP grades (6-10, ages 11-16). A Grade 6 student can experiment with circuits for 40 min but struggles with 20 min of technical reading. Timing should vary by cognitive demand, not just by grade.

### Implementation
- **File**: `src/lib/ai/prompts.ts` — `GradeTimingProfile` type, `getGradeTimingProfile()`, `buildTimingBlock()`
- **File**: `src/lib/ai/quality-evaluator.ts` — structural check for over-long activities by type

### Timing Profiles (per MYP Year)

| MYP Year | Age | Reading/Analysis | Hands-On/Making | Collaborative | Digital/Research |
|----------|-----|-----------------|-----------------|---------------|-----------------|
| 1 | 11 | ≤12 min | ≤40 min | ≤15 min | ≤15 min |
| 2 | 12 | ≤15 min | ≤40 min | ≤15 min | ≤20 min |
| 3 | 13 | ≤20 min | ≤45 min | ≤20 min | ≤25 min |
| 4 | 15 | ≤25 min | ≤45 min | ≤25 min | ≤30 min |
| 5 | 16 | ≤30 min | ≤45 min | ≤25 min | ≤35 min |

### How It Works
1. **Prompt injection**: Grade-specific timing block injected into all generation prompts (journey, timeline, per-lesson)
2. **Quality evaluator**: Classifies activities by `responseType` (text=cognitive, upload=hands-on) and checks against per-type limits
3. **Learning from uploads**: Uploaded lesson plans already have timing extracted per phase (3-pass analysis) — flows into generation via RAG
4. **Feedback loop**: Teacher "too_long"/"too_short" feedback feeds back into future generation

### Three Layers of Timing Intelligence
1. **Base knowledge** — timing profiles baked into prompts (research-backed)
2. **Learned patterns** — from uploaded lesson plans via RAG retrieval
3. **Feedback refinement** — teacher feedback corrects and improves over time

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/ai/quality-evaluator.ts` | Layer 4: Post-generation quality scoring |
| `src/lib/ai/framework-vocabulary.ts` | Layer 1: Framework-specific terminology |
| `src/lib/ai/teacher-context.ts` | Layer 1: Fetch teaching context from profile |
| `src/lib/ai/design-assistant-prompt.ts` | Layer 3: Socratic mentor system prompt |
| `src/lib/design-assistant/conversation.ts` | Layer 3: Conversation CRUD + AI response generation |
| `src/lib/knowledge/feedback.ts` | Layer 2: Aggregation + quality re-scoring + retrieval |
| `src/lib/ai/prompts.ts` | All layers: RAG prompt builders with context injection |
| `src/components/teacher/wizard/QualityReportPanel.tsx` | Layer 4: Quality score UI |
| `src/hooks/useWizardState.ts` | Layer 4: Wizard state for quality report |
| `src/types/lesson-intelligence.ts` | Types: QualityReport, PrincipleScore, PedagogyPrinciple |

## Migrations

| Migration | Status | Purpose |
|-----------|--------|---------|
| `022_design_assistant.sql` | APPLIED | Layer 3: conversation tables |
| `023_quality_report.sql` | APPLIED | Layer 4: quality_report + teacher_id on units |
