# StudioLoom Product Roadmap

## UX Philosophy (applies to everything we build)

These principles come from competitive analysis of 14 best-in-class education and design platforms (Brilliant, Duolingo, Khan Academy, Scratch, Codecademy, Behance, Domestika, Skillshare, Canva Design School, IxDF, Dribbble, Notion, Google CS First). They are non-negotiable design constraints.

### 1. Progressive Disclosure Over Information Dump
Show the current page + next step, not the full 16-page wall. Reveal structure as students progress. Hide future phases for new students; expand as they advance. Inspired by Duolingo (one screen = one action), Brilliant (simplest version first), Khan Academy 2026 ("what to do next" not full curriculum).

### 2. Activity-First, Not Instructions-First
Every page leads with the prompt/activity, not a wall of instructions. Scaffolding (sentence starters, vocab, hints) available on-demand, not blocking the workspace. "Try before you learn" — inspired by Brilliant (pretest before teaching), Codecademy (write-code-get-feedback), Scratch (creation-first).

### 3. The Portfolio Builds Itself
Student work auto-flows into their portfolio as they complete activities. No separate "add to portfolio" step for core design work. Responses, uploads, and reflections become portfolio entries automatically. Quick Capture supplements with informal process evidence (photos, notes, links). The completed unit IS the portfolio piece. Inspired by Behance (narrative case studies), Domestika (one course = one project), Skillshare (project upload = completion).

### 4. Restrained Gamification (2-3 mechanics, done well)
Don't pack in XP, leaderboards, badges, and achievements. Execute 2-3 loops exceptionally:
- **Design cycle progress path** — visual, spatial, shows where you are and what's next
- **Consistency streaks** — tied to meaningful work (not just logins)
- **Milestone celebrations** — when criteria/phases are completed
Inspired by Brilliant (explicitly avoids feature-packing, focuses on Streaks + Leagues only), Duolingo (7-day streak users are 3.6x more likely to stay engaged).

### 5. Mobile-Native Is Non-Negotiable
Ages 11-16 use phones and tablets primarily. Student experience must work beautifully at 375px. Quick Capture = phone camera → portfolio. Response areas need touch-optimized input. Inspired by Duolingo, Canva, Khan Academy (all treat mobile as primary).

### 6. AI as Design Mentor, Not Homework Machine
AI asks guiding questions ("What problem are you solving?", "What constraints do you have?"), doesn't generate design solutions. Nudge toward next step without revealing the answer. Feel like a design teacher sitting next to you. Inspired by Khan Academy's Khanmigo, Codecademy's AI hints, Brilliant's custom feedback per wrong answer.

### 7. Social Learning That Serves the Age Group
For 11-16 year olds: seeing peer work (inspiration), getting teacher/peer feedback (accountability), class-level milestone celebrations ("8 students finished Criterion A!"). Avoid public ranking/leaderboards for younger students. Inspired by Scratch (remix/fork as peer learning), Domestika (per-course community showcase).

---

## Phase 0: Flexible Unit Architecture ✅ COMPLETE

Rearchitected units from fixed 16-page structure to flexible, teacher-defined page lists.

### What was built:
- Teachers choose which criteria (A-D) to include per unit
- Emphasis levels: light (2 pages), standard (3), emphasis (4) per criterion
- `buildPageDefinitions()` in `src/lib/constants.ts` — central helper for dynamic page counts
- Edit page supports add/remove/reorder pages (up/down arrows)
- AI prompts, schemas, providers all accept dynamic `pageCount`
- No schema migration needed — v2 `content_data` already supports flexible page arrays
- Backward compatible: existing 16-page units still work via `normalizeContentData()`

---

## Phase 1: Sharpen the Student Experience
Transform the daily student interaction from structured unit pages to a living portfolio that builds itself.

### Activity-First Page Layout (UX Philosophy #2)
- Restructure unit pages: prompt/activity appears first, instructions and scaffolding collapse below or sit in an expandable drawer
- Students see "What do I need to do?" immediately, not "Here's everything you need to read first"
- Scaffolding (vocab, sentence starters, hints, ELL support) available on-demand via expandable sections
- Learning goal and criterion info accessible but not blocking the workspace
- This affects every unit template — must be right before scaling content

### Auto-Portfolio Pipeline (UX Philosophy #3)
- Student responses (text, uploads, reflections) auto-flow into the portfolio timeline as they're submitted
- No separate "add to portfolio" action needed for core design work
- Each portfolio entry carries context: page title, criterion, prompt, timestamp
- Teacher can pre-flag pages as "portfolio-worthy" in unit setup — those responses get highlighted in the portfolio
- Student can star/unstar entries to curate what appears in exports
- Quick Capture supplements with informal process evidence (workshop photos, sketches, inspiration links)
- The portfolio is never empty — it grows as the student works through the design cycle

### Portfolio Narrative Export (Behance-style)
- Full-unit export as a scrollable narrative: problem → process → solution → reflection
- Long-scroll format inspired by Behance case studies — not just a flat PDF of responses
- Includes: unit context, design brief, all portfolio entries in chronological order, reflections, final evaluation
- Export formats: PDF (print-ready), web link (shareable read-only page)
- Students can reorder/annotate entries before export to tell their design story
- This IS the portfolio piece — replaces the need for students to rebuild their process documentation externally

### Quick Capture Bar
- Persistent floating button on student dashboard/unit pages
- Tap to add: Photo (camera/upload), Link (external URL with auto-preview), Note/Reflection, Mistake/Learning moment (tagged differently)
- Fast, frictionless — designed for every-lesson use
- Mobile-optimized: phone camera → crop → caption → done in under 10 seconds

### Portfolio Timeline
- Chronological feed of auto-captured responses + Quick Capture entries, grouped by unit
- Shows photos, links, notes, mistakes, and submitted responses in a visual timeline
- Searchable, filterable by type, unit, and criterion
- Peer visibility option: teacher can enable class gallery mode where students see each other's portfolio entries (inspiration, not competition)

### Progressive Disclosure in Navigation (UX Philosophy #1)
- ChapterNav (built) already groups by criterion phase with collapsed/expanded pills
- Next: for new students, consider hiding future phases entirely — reveal them as previous phases are completed
- "What's next?" prominence: the CTA button and current dot should be the most visually dominant elements
- Subtle breadcrumb showing overall progress (e.g., "Phase 2 of 4") without overwhelming with detail

### Gamification: Progress Path + Streaks + Milestones (UX Philosophy #4)
- **Design cycle progress path**: Visual map showing the student's journey through phases — spatial, not just a progress bar. Current position clearly marked, completed phases feel "done" (filled, checked)
- **Consistency streaks**: Track consecutive days with meaningful design work submitted (not just logins). Show streak count on dashboard. Streak freeze available (1 per week). 7-day streak milestone celebration
- **Phase completion celebrations**: Animation/confetti when a criterion phase is completed. "You finished Inquiring & Analysing!" with summary of what they accomplished
- Keep it to these 3 mechanics — resist adding XP, leaderboards, or badges until Phase 3

### Remove/Deprecate Drawing Tool
- Students use Canva, Figma, TinkerCAD etc. for creation
- Replace sketch response type with "Add Link" to external work
- StudioLoom orchestrates learning, doesn't replace creation tools

### Student Project Management View (Gantt / Timeline / Board)
Visual progress tracker: where student is in design cycle vs. time remaining. Links to planning tasks already in the system.

**UX Research — PM Tools to Study (decided 17 March 2026):**
The goal is to replicate the best interaction patterns from web PM tools but strip out enterprise complexity that schools don't need. Study these tools and steal specific patterns:

- **Linear** — PRIMARY REFERENCE. Clean, fast, keyboard-driven, minimal chrome. Study: status transitions (backlog → in progress → done) via single click/drag, cycle/sprint view, the speed of interaction. Students should move a task from "researching" to "done" in one tap.
- **Notion** — Study: database-as-views pattern (same data shown as kanban board, timeline, calendar, or list). For Questerra, pre-configure views so students just use them rather than building their own. Notion already has school adoption so students may know it.
- **Height** — Study: AI-assisted task management (auto-categorisation, suggested next steps). Relevant because Questerra already has AI mentoring — the pattern of "AI suggests, human confirms" maps directly.
- **Monday.com** — Study: onboarding flow (best first-board walkthrough of any PM tool), colour-coded status columns for instant readability. Teachers glancing at a class dashboard should see red/amber/green instantly.

**What to steal:**
- Linear: speed, keyboard shortcuts, minimal chrome, effortless status transitions
- Notion: multiple views on same data (kanban for daily work, timeline for planning, checklist for teacher review)
- Monday: colour-coded visual progress — satisfying visual fill, not a percentage number
- Height: AI suggesting next steps based on where student is in design cycle

**What to throw away (enterprise features schools don't need):**
- Dependencies and critical path analysis
- Resource allocation and capacity planning
- Time estimation in hours
- Sprint velocity and burndown charts
- Integrations/webhooks/API access
- Role-based permissions beyond teacher/student
- Anything requiring configuration before it's useful

**The MYP-specific differentiation:**
Progress tied to design cycle phases (Inquiring, Developing, Creating, Evaluating) rather than generic "to do / doing / done." Kanban columns should BE the design cycle, not a generic workflow. No other PM tool does this — it's the core reason to build our own rather than embedding Notion.

**Implementation approach:**
- Kanban board as default view: columns = design cycle phases, cards = tasks/activities
- Timeline view as secondary: Gantt-style with phase blocks, deadline markers
- Checklist view for teacher: simple completion tracking per student per page
- All three views read from the same underlying task data
- Mobile-first: students will use this on phones/tablets in class

**PM Tools to Build (decided 17 March 2026):**
All tools below should match the Design Thinking Toolkit quality bar — world-class UX with beautiful, interactive interfaces that are a pleasure to use. Dark/light theme consistency, smooth animations, glassmorphism where appropriate, mobile-first.

1. **Design Phase Columns** — Replace generic to-do/doing/done kanban with columns mapped to the actual design cycle (Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating). Cards drag between phases. Each column has a phase-specific colour and icon. This is THE core differentiator — no other PM tool does this. Teachers see the class progressing through the design cycle at a glance, not through an abstract workflow.

2. **Interim Milestones / Checkpoints** — Teacher-defined checkpoint markers within each design phase (e.g., "Research notes complete", "3 initial concepts sketched", "Prototype v1 tested"). Students see upcoming milestones as a mini-roadmap. When a milestone is hit, a brief celebration animation fires. Teachers can set soft deadlines per milestone. This replaces the vague "you should be about here by now" with concrete, visible progress markers that students can self-check against.

3. **Structured Peer Feedback** — Built-in peer review rounds triggered by teachers at key moments (e.g., after ideation, after first prototype). Students are randomly or intentionally paired. Feedback uses guided prompts tied to the current design phase — not open-ended "what do you think?" but structured like "Identify one strength in their research method" or "Suggest one way to improve their prototype's usability." Responses are visible to the recipient and the teacher. This replaces the chaos of verbal peer feedback with documented, traceable, curriculum-aligned critique.

4. **Decision Log / Design Rationale** — A persistent sidebar or card stack where students record key decisions: "I chose material X because…", "I changed my target user from A to B because…". Each entry is timestamped and optionally linked to a design phase. Teachers can see the decision trail during grading. This is pure gold for MYP Criterion B (Developing Ideas) where students must justify choices. Currently this documentation is scattered across text responses — a dedicated log makes it visible and reviewable.

5. **Phase-Specific Reflection Prompts** — Auto-triggered reflection questions when a student moves between design phases. Not generic "how did it go?" but phase-aware: transitioning out of Research might ask "What was the most surprising thing you discovered about your users?"; leaving Prototyping might ask "What would you change if you had another week?". Responses feed directly into the portfolio timeline. Teachers can customise prompts per unit. This turns phase transitions from silent checkboxes into meaningful metacognitive moments.

6. **Multi-View Toggle** — Same underlying task/progress data rendered as four views: Kanban (default, design phase columns), Gantt/Timeline (horizontal bars showing time spent per phase vs. plan), Calendar (tasks mapped to dates, syncs with school calendar), and Gallery (visual grid of work-in-progress photos/uploads). One-click toggle between views. Teachers default to Checklist view (student × task completion matrix). Inspired by Notion's database-as-views pattern but pre-configured — students pick a view, not build one.

7. **Teacher Early Warning System** — Smarter traffic-light signals on the teacher dashboard. Goes beyond simple red/amber/green completion percentages. Factors in: days since last activity, current phase vs. expected phase (based on timeline), submission quality signals from AI (effort-gating scores), missed milestones. Surfaces a ranked list of "students who need attention" with specific reasons ("hasn't started Phase 3, 4 days behind schedule" or "submitting minimal-effort responses in Criterion B"). Replaces the teacher's gut feel with data-driven early intervention.

8. **Resource / Materials Tracker** — A checklist-style tool for tracking physical materials, tools, and resources needed for the Creating phase. Students list what they need, mark what they've sourced, flag what's missing. Teachers see a class-wide materials summary (e.g., "12 students need access to the laser cutter in Week 5"). Integrates with the planning view. This is unique to Design & Technology — no generic PM tool handles the physical-world logistics of a workshop classroom.

9. **Time-Boxing / Sprint Timer** — A visible countdown timer for focused work sessions during class. Teacher sets duration (e.g., "15 minutes: sketch 3 concepts"). Timer appears on all student screens. Optional: students log what they accomplished when the timer ends (micro-reflection). Inspired by pomodoro technique but adapted for classroom use. Helps teachers pace lessons and helps students develop time management skills. Timer history shows patterns ("this student consistently needs more time for research phases").

10. **QR Code Quick Capture** — Teacher generates a QR code for any unit/phase/activity. Students scan with their phone camera, and it opens a streamlined capture interface: snap a photo of their physical work (sketch, prototype, workshop setup), add a one-line caption, and it's instantly filed in the right place in their portfolio timeline. No login friction, no navigation — scan, snap, done. This is critical for Design & Technology where the most important evidence is physical work happening in the workshop, not text typed at a computer.

---

## Phase 2: AI-Powered Unit Builder (Partially Complete)
The teacher superpower — guided unit creation with AI.

### Guided Flow ✅
1. Teacher inputs: Subject area, grade level, duration (weeks), focus criteria (A/B/C/D emphasis), key concept, global context
2. AI generates: Unit structure with pages, activities, guiding questions, success criteria
3. Resource enrichment: AI suggests related videos, articles, exemplars (Perplexity-style)
4. Teacher reviews & tweaks before publishing
5. Generated units map directly to existing `units` + `unit_pages` schema
6. **Built**: 7-step wizard with conversational flow, multi-option outlines, flexible page generation

### RAG-Informed Generation (Knowledge Base → Lesson Quality) ✅ Partially
- **Built**: pgvector knowledge base, hybrid search (vector 70% + BM25 30%), document upload + extraction (PDF/DOCX/PPTX), structure-aware chunking, quality signals, auto-ingest on save/fork
- **Built**: Dual retrieval — text chunks via `retrieveContext()` + structured lesson profiles via `retrieveLessonProfiles()` — both injected into generation prompts with source attribution
- **Built**: Quality feedback loop — chunks accumulate `times_retrieved`, `times_used`, `fork_count`, `teacher_rating` signals that influence future retrieval ranking
- **Audit finding (2026-03)**: Retrieval ranking happens entirely in SQL RPC (`match_knowledge_chunks`). No application-level re-ranking (cross-encoder, MMR for diversity). Acceptable at current scale (5-8 chunks), but will degrade past ~1000 chunks.
- **Still needed**: Cross-encoder re-ranking stage (e.g., Cohere `rerank-v3.5` or Voyage AI reranker) — retrieve top 15-20, re-rank, return top 5. ~1 week effort, medium priority until KB grows.

### Lesson Timing Engine ✅ (19 Mar 2026)
Research-backed timing system enforcing the Workshop Model across all AI-generated lessons. Based on 25+ source research synthesis (d.school, IDEO, PBLWorks, Project Zero, ASCD, cognitive science).

**Built:**
- Workshop Model enforced in all generation prompts: 4-phase structure (Opening → Mini-Lesson → Work Time → Debrief), 1+age instruction cap formula, usable time always calculated (never raw period), extension generation required
- `src/lib/ai/prompts.ts` — `buildDesignTeachingContext()` with Workshop Model as principle #1, `buildTimingBlock()` always uses usable time, `maxInstructionMinutes()` 1+age formula, grade profiles with `avgStudentAge`
- `src/lib/ai/timing-validation.ts` — Server-side validation with 8 rules + auto-repair: workshop conformance, instruction cap, work time floor (45%), debrief presence, total time match, cognitive load, extensions, checkpoints. 4 timing presets (Balanced, Hands-On Heavy, Instruction Heavy, Critique Session)
- `src/components/lesson-timing/PhaseTimelineBar.tsx` — Teacher modification UI: drag-to-resize timeline bar with colored phase blocks, lock/unlock phases, one-click presets, live rule violation warnings
- `src/components/lesson-timing/TimingFeedbackPrompt.tsx` — Post-lesson feedback: per-phase ratings, actual duration logging, extension completion tracking
- JSON schema updated with `workshopPhases` and `extensions` fields
- Research docs: `docs/lesson-timing-research-report.md`, `docs/research/` folder with raw synthesis, data tables, integration roadmap, quick-reference card

**Wiring status (19 Mar 2026):**
- ✅ `validateLessonTiming()` wired into `generate-journey`, `admin/test-lesson`, `generate-unit`, `regenerate-page`
- ✅ `WorkshopPhases` + `LessonExtension` types added to `PageContent` in `src/types/index.ts`
- ✅ PhaseTimelineBar mounted in `JourneyLessonCard` (interactive drag-resize, lock, presets)
- ✅ MiniPhaseBar (read-only compact bar) + extension count badge on unit detail `LessonCard`
- ✅ `timing-validation.test.ts` fixed for current `TimingContext` shape
- ✅ **Live browser tested (19 Mar):** Admin sandbox generation produces correct workshopPhases (Opening 8m, Mini-Lesson 12m under 14m cap, Work Time 32m at 56%, Debrief 5m with protocol), 3 phase-indexed extensions, validation passes with 0 issues. Backward compatibility confirmed — old units render without errors. Zero console errors across all pages. Full test checklist: `docs/timing-engine-test-checklist.md`

**Still needed (priority order):**
1. **Wire timing validation into generate-timeline** — Timeline activities are flat (not lesson objects), need different approach: validate computed lessons after activity grouping.
2. **Mount PhaseTimelineBar in TimelineLessonCard / TimelineBuilder** — timeline mode lesson editing.
3. **Wire TimingFeedbackPrompt into post-lesson flow** — needs trigger (after lesson date or "I taught this" button), storage, and feedback → profile pipeline.
4. **Multi-lesson pacing intelligence** — Milestone markers, flex points, progress gates for multi-week units. Research done, not yet built.

### Lesson Intelligence System (NEW — In Progress)
Deep AI analysis of uploaded lesson plans to build structured pedagogical blueprints that inform future generation. This is the key unlock for lesson quality — the AI learns *how good teachers teach*, not just what they teach.

**Built:**
- Types: `src/types/lesson-intelligence.ts` — LessonProfile (deep model with lesson flow phases, criteria analysis, scaffolding strategy, cognitive load curve, workshop management), 3-pass analysis types, post-lesson feedback, quick-modify, unit narrative arc
- Prompts: `src/lib/knowledge/analysis-prompts.ts` — Pass 1 (structure/Haiku), Pass 2 (pedagogy/Sonnet), Pass 3 (design teaching/Sonnet), feedback aggregation, quick-modify
- Orchestrator: `src/lib/knowledge/analyse.ts` — `analyseDocument()` runs 3 passes, `mergeIntoProfile()` combines, `reanalyseDocument()` for re-running
- Migration 018: `lesson_profiles` + `lesson_feedback` tables, `match_lesson_profiles()` RPC with weighted scoring, HNSW vector index (APPLIED)
- Upload pipeline: `src/app/api/teacher/knowledge/upload/route.ts` runs extract → 3-pass analysis → store profile → chunk → embed. Returns profile for immediate review. Supports `skipAnalysis=true`.

**Still needed (priority order):**
1. **Teacher Review UI** — Rich analysis display after upload. Shows lesson flow table, criteria analysis, strengths/gaps, sequencing, star rating. Teacher can verify, correct, and rate. Design wireframe in `docs/design/ai-lesson-analysis.md`.
2. **Batch Upload UI** — Multi-file drag-and-drop with per-file progress (extracting → analysing → ready for review). Currently single-file only.
3. **Wizard RAG Enhancement** — The big payoff. Lesson-level retrieval via `match_lesson_profiles()` + pattern synthesis + unit narrative arc generation. Wizard generates units informed by structured pedagogical blueprints, not just text snippets.
4. ~~**Analysis-Informed Chunking**~~ ✅ Built — `chunkDocumentWithProfile()` aligns chunk boundaries to lesson phases from AI analysis, with rich pedagogical metadata per chunk (phase type, cognitive level, scaffolding strategies, materials, tools, safety). Confirmed in 2026-03 audit.
5. **Quick-Modify UI** — On-the-fly lesson adaptation ("it's Friday afternoon, students are tired, make it more hands-on"). Prompts + types already built.
6. **Feedback Capture UI + API** — Teacher 60-second post-lesson pulse + student 30-second pulse, stored in `lesson_feedback` table.
7. **Re-Analysis Tooling** — Button to re-run analysis on all uploads when prompts improve (raw text always preserved for this purpose).
8. **Semantic Chunking Upgrade** (from 2026-03 audit) — Use embedding model to detect topic boundaries, prepend each chunk with document-level context header (title + section path + surrounding chunk summaries). Anthropic's "contextual retrieval" pattern, typically improves retrieval 20-35%. ~1 week, medium priority.

### Activity Cards System ✅
- **Implemented**: Database-backed evolution of hardcoded activity templates (migration 015)
- 16 system cards seeded with rich metadata (criteria, phases, duration, group size, materials, tools, teacher notes)
- Each card has AI-generated, card-specific modifier axes (e.g., SCAMPER → "Working Medium" + "Collaboration Style")
- Hybrid search: pgvector embeddings (Voyage AI) + Postgres FTS + usage popularity weighting
- AI adaptation endpoint: card + modifier selections + custom prompt + unit context → adapted sections
- Usage tracking: every card insertion recorded for recommendation improvement
- ActivityBrowser and ActivitySidebar fetch from DB with graceful fallback to hardcoded library
- Teacher card management page at `/teacher/activity-cards` for creating/editing custom cards
- **Pending**: Add Voyage AI payment method to unlock higher rate limits (3 RPM free → 200M tokens with payment)
- **Pending**: Generate and import more activity card batches via Gemini prompt — target 50+ cards. Current: 21 cards (16 original + 5 Gemini batch 1).
- **Future**: Community card sharing, teacher-submitted cards for review, card forking/variants

### Knowledge Library ✅
- 3 tables: knowledge_items, knowledge_item_curricula, knowledge_item_links (migration 017, applied)
- Hybrid search RPC, full CRUD API, teacher management UI at `/teacher/knowledge`
- Components: KnowledgeItemCard, KnowledgeItemForm, CurriculumMapper, TagAutocomplete, MediaUploader

### Shared Knowledge Pool (Community Intelligence) — NEEDS DESIGN

**Core principle**: Every teacher gets the same quality AI, regardless of how much they've personally uploaded. The knowledge base should be a rising tide that lifts all boats.

**Current state**: Each teacher's uploads are fully isolated. RAG retrieval only queries their own `knowledge_chunks` and `lesson_profiles`. A teacher with 5 uploads gets thinner context than one with 500. This creates an unfair quality gap.

**Target state**: All teachers benefit from a shared pool of pedagogical intelligence. Uploads are shared by default (opt-out model). Quality is community-assessed. The AI wizard draws from the collective pool, personalised at generation time via teacher context (school, equipment, curriculum).

**Architecture — Two-Layer Model**:
1. **Shared knowledge pool** — community uploads, lesson profiles, chunks. Everyone reads from this. Quality-filtered.
2. **Personal teaching context** — applied at generation time (not storage time). School, equipment, curriculum, preferences. Already built via `PartialTeachingContext` + `buildTeachingContextBlock()`.

**Key design decisions needed**:

| Decision | Options | Notes |
|---|---|---|
| **Default sharing** | Opt-out (share by default) vs Opt-in | Opt-out builds pool faster. Must be VERY clear at upload time. GDPR/privacy implications for lesson content. |
| **What's shared** | Chunks + profiles (anonymised) vs full uploads vs just the AI-extracted intelligence | Sharing raw text risks IP concerns. Sharing just profiles + chunks (no original file) is safer — the intelligence without the source material. |
| **Quality gate** | Star rating + usage signals vs editorial review vs AI-assessed quality | Star rating from uploading teacher (self-assessed) + community rating (others rate after using in wizard) + AI quality score from Pass 2 analysis (complexity_level, strengths count, gaps count) |
| **Quality floor** | Minimum quality to enter shared pool | Maybe: must have completed 3-pass analysis + teacher rating ≥ 3 stars + no community flags |
| **Flagging/removal** | Community flags + auto-remove at threshold vs admin review queue | Community flags ("inaccurate", "low quality", "inappropriate") → auto-hide at 3 flags → admin review queue |
| **Attribution** | Anonymous vs credited | Could show "Based on patterns from 47 teacher uploads" without naming individuals. Or opt-in attribution ("Lesson pattern contributed by Matt, UAE") |
| **Copyright** | Teachers own their content vs platform license | Terms of service need: "By sharing, you grant StudioLoom a license to use extracted pedagogical patterns for AI training and retrieval. You retain ownership of original materials." Original files never shared — only extracted intelligence. |
| **Curriculum scoping** | Global pool vs per-curriculum pools | IB MYP teacher shouldn't get GCSE patterns by default. Filter by `curriculum_framework` at retrieval time. Cross-curriculum patterns still valuable for pedagogy. |

**Implementation sketch**:

```
knowledge_chunks:
  is_public BOOLEAN (already exists, currently always false)
  → flip to true when teacher opts to share
  → retrieval queries: WHERE teacher_id = $1 OR is_public = true

lesson_profiles:
  is_public BOOLEAN (add)
  quality_score FLOAT (computed: AI analysis quality + teacher rating + community rating)
  community_rating_avg FLOAT
  community_rating_count INTEGER
  flag_count INTEGER DEFAULT 0
  → shared pool only includes profiles where quality_score > threshold AND flag_count < 3

New table: knowledge_ratings
  id, profile_id, rated_by_teacher_id, rating (1-5), helpful BOOLEAN, flag_reason TEXT?, created_at
  → teachers rate profiles they encounter during wizard generation
  → "Was this lesson pattern helpful for your unit?" after generation
```

**Retrieval changes for wizard**:
```
-- Current: only my chunks
WHERE teacher_id = $myId

-- Future: my chunks + high-quality public chunks, curriculum-filtered
WHERE (teacher_id = $myId)
   OR (is_public = true AND quality_score > 0.6
       AND curriculum_framework IN ($myCurriculum, 'general'))
```

**Quality signal sources** (combined into `quality_score`):
1. **AI-assessed** (automatic): analysis complexity_level, number of strengths vs gaps, lesson_flow completeness, scaffolding detected
2. **Uploader self-rating** (at upload): "How effective is this lesson?" 1-5 stars
3. **Community rating** (after wizard use): "Did this pattern help your unit?" thumbs up/down + optional star rating
4. **Usage signals** (automatic): times_retrieved, times_linked to units, fork_count
5. **Decay** (automatic): older profiles with no recent usage gradually decrease in score

**Privacy & IP safeguards**:
- Original files NEVER shared (stored in teacher's private storage path)
- Raw extracted text NOT shared — only structured intelligence (profiles, chunks)
- Teacher can opt out entirely (personal flag) or opt out per-upload
- Teacher can withdraw sharing at any time (flips is_public back to false)
- Shared content is anonymised by default (no teacher name/school in shared data)
- Terms of service must explicitly cover this before launch

**What this does NOT require changing now**:
- Upload pipeline — already stores raw text separately from chunks/profiles
- Teacher context — already applied at generation time, not storage time
- Original file storage — already in private path per teacher
- Re-analysis — already supported, can re-run with new prompts on shared pool

**Priority**: HIGH — this is the core value proposition differentiator. Must be designed before opening to beta users. Doesn't block bulk upload (teacher's own uploads work fine), but blocks the "everyone gets equal quality" goal.

### Intelligent Resource Discovery (AI-Curated Resource Assembly)
Architecture: Claude orchestrates, specialized APIs discover. Not a search feature — a curation engine.

**Stack:**
- **Tavily** — web articles/resources (curated allowlist of ~50 design education domains, 150-domain filter)
- **YouTube Data API v3** — video tutorials (CC license + education category + safe search)
- **Unsplash** — classroom-safe high-quality images (free, 50 req/hr)
- **Europeana** — European cultural heritage / museum objects (free, CC0)
- **Smithsonian Open Access** — US design/art heritage, Cooper Hewitt collection (free, CC0)
- **Claude** — generates search queries from unit context, ranks results, writes rationale

**MVP (Phase 2A):**
- Tavily + YouTube integration in wizard review phase
- Resources appear as expandable cards on PageReviewCard: title, type, source, duration, rationale, link
- Teacher can dismiss or pin resources; pinned resources embed as links in unit pages
- Claude generates targeted search queries per page based on criterion, design cycle phase, topic, grade
- Curated domain allowlist (Core77, Dezeen, Instructables, PBS, Khan Academy, etc.)
- YouTube: CC-licensed, education category, safe search strict
- Resources fetched asynchronously after page generation (not blocking)
- Aggressive caching by hash(topic, grade, criterion, keywords) with 30-day TTL

**V2 (Phase 2B):**
- Unsplash, Europeana, Smithsonian integration
- Resources grouped by category: Context & History, Technique Demos, Tools & Platforms, Inspiration, Student Readings, Extension
- Resource preview in goal/configure phase (3-4 suggestions while typing)
- Manual search within wizard
- Teacher dismiss/keep signals feed back into ranking
- Per-resource metadata: title, type icon, source, duration/read time, license badge, rationale, thumbnail, grade suitability

**Longer term:**
- Community resource curation (teacher-submitted + rated)
- Broken link monitoring (monthly background job)
- Student engagement tracking (which resources get watched/read)
- Per-school resource libraries + domain allowlists
- Localized museum content by school region
- Auto-embed YouTube/images inline in unit pages
- Resource dependency chains (prerequisites)
- RAG integration: resources from existing high-quality units boost suggestions for similar new units

### Activity Sidebar on Unit Edit Page
- Port the floating activity sidebar (currently wizard-only) to the unit edit page (`/teacher/units/[unitId]/edit`)
- Same 4-category floating buttons, drag-and-drop into page sections
- Polish needed: better visual feedback, smoother animations, mobile/tablet support
- Consider: sidebar should also show recently used activities and teacher-favourited activities

### AI Decision Assistant (Student-Facing)
- Helps students make choices between materials, prototypes, ideation designs — without making the decision for them
- **Decision Matrix**: Student defines criteria, weights with sliders, scores options. AI suggests criteria they may have missed
- **Pairwise Comparison**: Forces binary trade-off thinking, two options at a time ("Stronger but heavier, or lighter but fragile?")
- **Trade-off Sliders**: Visual sliders (Cost ↔ Quality, Simple ↔ Complex). AI reflects what priorities mean for their options
- **"What If" Scenarios**: AI asks probing questions ("What if your user drops this?", "What if you only had half the time?")
- **PMI Quick-Fire**: Plus/Minus/Interesting per option with AI-prompted targeted questions
- **Devil's Advocate**: Student picks favourite, AI argues against it constructively to stress-test the decision
- Triggers on Criterion B pages (B2–B3: developing ideas) and C pages (C1–C2: choosing materials)
- Student can invoke anytime via button
- Output is always the student's decision with documented reasoning (great B criterion evidence)
- AI never says "pick X" — only "based on your priorities, here's what your scores suggest"
- Completed frameworks auto-save as responses; teacher sees the decision process

### Vibe Unit Planning (Experimental)
- "Know where you're going, not every step to get there" — progressive, just-in-time curriculum design
- Teacher inputs: end goal (final product/assessment), rough timeline (term/semester), subject area, grade level, key constraints
- AI generates: learning goals, a scope-and-sequence overview, and fully detailed content for the first 2-3 units
- Remaining units shown as rough outlines (learning goals, key activities, suggested resources) — not fully built yet
- As teacher approaches each upcoming unit (1-2 classes out), they get a "Build Next Unit" prompt:
  - AI asks targeted questions: "How did the last unit go?", "What skills are students struggling with?", "Any changes to timeline?"
  - Teacher provides quick context (free text, quick-select options, or skip)
  - AI builds the next unit in full detail, adapting based on what actually happened vs. what was planned
- Responsive to reality: if students need more time on prototyping, the AI reshuffles remaining units; if they're ahead, it adds depth
- Each "build" cycle takes ~2 minutes of teacher input for a fully scaffolded unit
- Maintains a living plan document that shows: completed units (locked), current unit (active), upcoming units (rough → detailed as they approach)
- Pairs with existing AI Unit Builder — Vibe Planning is the wrapper/orchestrator, individual units still use the same generation pipeline
- Teacher can always override: manually edit any unit, lock sections from AI modification, or switch to fully manual planning

### Dynamic Units
- Never the same generic experience twice
- AI shapes learning based on grade, skills, time, student needs
- Can emphasize specific design cycle phases (e.g., more making = more C criterion content)
- Introduces YouTube videos, guides, skill-building resources
- Lessons must scaffold properly: assume no prior knowledge, build up from intro → guided practice → independent task
- External tools (TinkerCAD, Canva, Figma, etc.) should be linked directly with login/tutorial steps, not just mentioned

### Student-Driven Unit Discovery (Guided Pathfinding)
- Students who don't have a prescribed unit can discover their own through a guided AI conversation
- **Problem-first flow**: AI walks the student through questions — "What problems have you noticed?", "What interests you?", "What skills do you want to develop?", "Who would benefit from a solution?"
- Surfaces student's context: interests, available tools/materials, time constraints, skill level
- **Three possible outcomes**:
  1. **Match to existing unit** — AI suggests a unit from the library that fits their interests/goals
  2. **Adapt an existing unit** — AI takes a library unit and tweaks the brief, context, or final product to match the student's direction
  3. **Generate from scratch** — AI creates a new unit tailored to the student's problem/interest (uses the same generation pipeline as the teacher AI Unit Builder)
- **Summative selection**: Student chooses their summative assessment format — e.g., physical prototype, digital product, presentation, service design, system design — and the unit adapts Criterion C/D pages accordingly
- Teacher approves/modifies the generated unit before it goes live (student proposes, teacher validates)
- Great for open-ended project terms, passion projects, or differentiated classrooms where students work on different briefs
- Could pair with Vibe Unit Planning — teacher sets the broad constraints, students fill in the specifics

### Teacher Resources (later layer)
- Generate PPTs from unit content
- Generate printable worksheets/handouts

---

## Phase 2.5: Data Foundations & Teaching Context (NEW)
Get the data model right first — AI quality can be improved later as long as the right data is being captured. These are the data containers that enable every AI feature to be contextually aware.

### Data Layer Types (Built — Types Only, No Migrations Yet)
Ten data layers that feed into AI generation, with three critical new type files:

**`src/types/curriculum.ts`** — What standards are we teaching against?
- `CurriculumFramework`: criterion definitions with year-group-specific strand objectives, achievement bands with level descriptors, command terms mapped to Bloom's taxonomy, assessment weighting
- `ScopeAndSequence`: year plan with `UnitPlacement` (position, criteria focus, skills introduced/practiced/assessed, tools, prerequisites, builds_on/feeds_into), `SkillProgression` tracking (introduced → practiced → consolidated → assessed)
- `AcademicCalendar`: terms, holidays (between/mid-term/public/teacher-only), school events (exam, exhibition, PD day, sports day), periods_lost tracking
- DB row types included for future migrations

**`src/types/assessment.ts`** — How are students performing?
- `AssessmentRecord`: per-student per-unit grades with `CriterionScore` (level, strand scores, evidence page IDs, tags), qualitative feedback, `AssessmentTarget` (actionable targets with status tracking), moderation support
- `AssessmentTag`: 12 common pattern tags for AI aggregation (strong_research, weak_justification, creative_ideas, limited_range, etc.)
- `ClassPerformanceSummary`: aggregate class performance (criterion averages, distributions, common strengths/gaps) — feeds directly into wizard for next unit
- `StudentLearningProfile`: SEN provisions, tool certifications (with expiry + quiz scores), software proficiency, criterion history with trend detection, cognitive profile (typical Bloom's level), pastoral/grouping/engagement notes, student interests
- `ToolCertification`: tool, certified_date, certified_by, level (supervised/independent/can_train_others), expires_at, quiz_score

**`src/types/lesson-intelligence.ts`** (TeachingContext section) — What's the teaching environment?
- `SchoolContext`: school type (co-ed/boys/girls), setting (urban/suburban/rural), country, timetable (period length, doubles, periods per week), facilities (workshop spaces, available tools, available software), culture (behavioural framework, cultural considerations, religious observances), safety requirements (mandatory PPE, tool age restrictions)
- `TeacherPreferences`: experience level, preferred pedagogy, classroom management style, favourite/avoided activities, instruction language level, assessment style
- `ClassCohortContext`: per-class demographics (ELL proportion + level, SEN count, ability range), energy profile, behaviour notes, grouping constraints, cultural notes, prior tools/software/skills used

### Teaching Context Onboarding (Build When Ready)
When a teacher first sets up their account, collect:
1. **School context** — country, school type, facilities, timetable structure, safety requirements
2. **Teacher preferences** — experience, pedagogical approach, favourite activities, assessment style
3. **Per-class cohort context** — demographics, ability range, prior skills, SEN notes

This feeds into every AI generation — a lesson for a boys' school in the UAE with 45-minute periods and no workshop will be fundamentally different from one for a co-ed school in London with double periods and full makerspace access.

**Implementation**: Progressive onboarding (don't demand everything upfront). Required on first use: country + school type + grade level. Optional: everything else, buildable over time. Stored as teacher/school settings JSONB, fed into AI prompts as context.

### Scope & Sequence Builder (Build When Ready)
Let teachers define their year plan:
- Which units, in what order, across which terms
- Skills introduced/practiced/assessed per unit
- Tool progression across the year
- AI uses this to avoid repeating contexts, build on prior skills, plan appropriate tool use
- Feeds into Vibe Unit Planning (Phase 2) — scope & sequence is the "north star" that vibe planning adapts

### Academic Calendar Setup (Build When Ready)
- Teacher enters term dates, holidays, school events
- AI uses this for realistic pacing — "don't schedule heavy making during exhibition week"
- Integrates with due date system

---

## Phase 3: Skills, Safety & Badges

### Skills & Resources Library
- Curated, searchable area of resources and videos for student upskilling
- Organized by skill/tool (e.g., "Laser Cutting", "Scratch Programming", "Soldering")
- Tagged by difficulty, criterion, tool type
- Teachers curate and add resources; students browse, watch, mark as completed
- Completion feeds into badge system

### Safety Certifications (USP — "Safety Certs That Follow the Student")
Safety certs are a headline feature, not just a checkbox. They solve a real operational and legal problem: proving a student was trained before using dangerous equipment.

**Core requirements:**
- Multiple-choice quiz per tool/technique (e.g., "Laser Cutter Safety", "Band Saw", "Soldering Iron")
- Teacher sets pass mark, number of attempts, and expiry period (e.g., annual re-certification)
- Can block page progress (gate C1-C4 creation pages) until safety test passed
- Connects to existing page-locking system

**Audit trail (must be robust enough for legal/insurance review):**
- Every certification records: student ID, full name, timestamp (ISO 8601), quiz score, specific questions + answers given, pass/fail, teacher who authored the test, teacher who verified (if manual sign-off required), school, device/IP metadata
- Immutable log — certs cannot be deleted or backdated, only revoked with reason
- Exportable per-student certification history (PDF report for school records)
- Per-machine certification report: "Which students are currently certified for the laser cutter?"
- Optional: teacher co-sign step — student passes quiz, then teacher physically verifies competence and signs off digitally (two-factor certification)

**Student experience:**
- Certifications displayed on student dashboard/portfolio as earned badges
- Students earn them once — the system enforces them across every unit, every year (until expiry)
- Clear visual when a page is gated: "Complete Laser Cutter Safety to unlock this page"
- Re-certification reminder when approaching expiry
- Certifications use the `ToolCertification` type from `assessment.ts` — level (supervised/independent/can_train_others), quiz scores, expiry tracking

### Skill Tracks & Badges
- Define tracks: "Laser Cutter Safety", "3D Printing Basics", "Soldering", "CAD Fundamentals", etc.
- Students complete skill modules (resources + safety test)
- Badges earned and displayed on portfolio/dashboard
- Teachers set skill prerequisites per unit (e.g., "must have Laser Safety badge")
- Badges carry across years — a Year 9 student certified on the laser cutter keeps that cert in Year 10

### Portfolio-Worthy Responses (Task → Portfolio Pipeline)
- Some task responses are natural portfolio evidence — shouldn't need to be recreated
- Examples: "Upload top/front/side photos of your cardboard prototype", annotated feedback on pros & grows, final design renders
- **Star / Pin to Portfolio**: Student (or teacher) marks a response as portfolio-worthy while completing it
- Pinned responses appear in the portfolio timeline alongside Quick Capture entries
- On export (PDF/PPT), pinned task responses are included with context: page title, criterion, prompt, and the student's response (images, text, annotations)
- **Annotation layer**: Students can annotate uploaded images (arrows, labels, highlight areas) — annotations carry through to portfolio
- Teacher can pre-flag certain pages as "portfolio-worthy" in unit setup — student sees a prompt to pin their response when submitting
- Keeps portfolio rich without extra work — the design process evidence is already being created in tasks

### Portfolio → PPT Export
- One-click export of portfolio entries as a PowerPoint presentation
- Title slide with student name + unit info
- One slide per entry: image + caption + date
- Includes pinned task responses with full context (criterion, page title, prompt)
- Accessible from portfolio panel via export button

---

## Phase 3.5: School Identity & Multi-tenancy (NEW)
Currently students belong to individual classes created by individual teachers. Two teachers at the same school can create duplicate records for the same student. This phase introduces the School as the identity anchor.

### School Entity
- School as the tenant anchor — students belong to school, not individual class
- `School` type in `src/types/school.ts`: name, country, timezone, curriculum_framework, student_id_scheme, enabled_auth_methods, SSO config, data_privacy settings
- Invite code for teacher onboarding — join a school rather than creating isolated classes
- School-level settings: facilities, timetable, safety requirements (links to `SchoolContext` from teaching context types)

### Student Registry & Deduplication
- `SchoolStudent`: school-level student record with `student_number` as primary dedup key
- Student identity tiers: student_number → external_id (LMS) → email → fuzzy name match
- `ClassEnrollment` as many-to-many join: students belong to school, get enrolled in multiple classes
- When a second teacher adds the same student, the system matches and links rather than duplicating
- `StudentMatchResult` type handles dedup: match method, confidence score, teacher confirmation prompt
- `ClassIntakeSummary`: auto-generated briefing for new teachers aggregating student histories across years (tool experience, prior criterion averages, common strengths/gaps, recommendations)

### Student Authentication
- **Tier 1 (Zero-friction)**: Class code entry — student types a code, picks their name from the list. No passwords.
- **Tier 2 (Lightweight)**: QR code login — teacher prints QR cards, students scan to log in from any device
- **Tier 3 (SSO)**: Google/Microsoft SSO — school already has accounts, students use them. One-tap login.
- **Tier 4 (LMS)**: LTI launch from ManageBac/Canvas/Schoology — student is already authenticated
- **Tier 5 (Full account)**: Email + password — for schools that want students to have persistent accounts
- School admin chooses which tiers are enabled. Auth method stored per student.
- Progressive upgrade path: start with class codes, migrate to SSO when school is ready

### Student Data Portability
- **Student portfolio is theirs** — always exportable (PDF, web link)
- **SEN/assessment data stays with school** — sensitive, teacher-maintained
- **Teacher's units travel with teacher** — units, lesson profiles, knowledge items portable between schools
- `StudentPortableRecord`: portfolio entries, certifications, assessment summary, skills/software proficiency
- `TeacherPortableData`: unit count, lesson profiles, knowledge items (exportable as JSON)

### Data Privacy & Compliance
- `DataPrivacySettings` per school: regime, retention period, data residency, AI processing consent
- Country-specific regimes: GDPR (EU), UK GDPR, FERPA+COPPA (US), PDPA (Singapore), PDP (UAE), Privacy Act (Australia), PIPEDA (Canada), POPIA (South Africa)
- `DataExportRequest`: audit trail with requester, scope, format, delivery, status
- Export scopes: portfolio, assessment_summary, assessment_full, tool_certifications, skills_summary, progress_data, responses, learning_profile
- Default to GDPR as baseline — most restrictive, so meeting it covers most cases
- AI processing consent tracked separately (some schools may want AI generation but not AI analysis of student work)
- All types built in `src/types/school.ts` — migrations needed when building UI

---

## Phase 4: Teacher Experience & Productivity

### Teacher Landing Page Overhaul
The current teacher landing page needs to prioritize the two things teachers most urgently need when they log in:
- **Quick class access**: Classes should be front-and-center — one tap to get into any active class. Consider a class grid/list as the primary dashboard element rather than buried in navigation.
- **Quick lesson generation ("Emergency mode")**: Teachers running late or calling in sick need to fire off a quick, tailored lesson to a colleague or substitute. Should support: pick a topic/subject, pick a grade level, generate a ready-to-go lesson in ~30 seconds. Doesn't need to be a full unit — just a structured single-lesson plan (warm-up, main activity, wrap-up) that's generic enough for a substitute but tailored to the right age and topic.
- **Menu item audit**: Review all teacher navigation items for intuitiveness and priority ordering.

### Teaching DNA Profile (Phase 3 — after enough data)
A "Spotify Wrapped for teaching style" feature. As teachers use StudioLoom (uploading lessons, editing AI output, grading, providing feedback), the system builds a visual profile of their teaching identity.

**What it would show:**
- **Radar/fingerprint chart** of their teaching dimensions (theory vs practical, scaffolding level, critique intensity, assessment focus, lesson pace, autonomy level) — derived from the 5 macro dials + learned data
- **Named archetype**: "Workshop Mentor", "Structured Guide", "Discovery Facilitator", "Assessment Architect" — computed from their data pattern
- **Stats with context**: "Your average demo is 11 min (most teachers: 15 min)", "You favour Criterion B activities 2:1 over A"
- **Confidence/familiarity meter**: Shows how well the AI knows them. "🟡 Learning — 8 uploads, 3 edits" → "🟢 Established — 23 uploads, 15 edits"
- **Evolution timeline**: "When you started, your lessons were 70% theory. Now they're 55:45 theory:practical"
- **Teaching insights**: "You rarely include gallery walks — consider adding critique moments mid-lesson"

**Depends on:**
- TeacherStyleProfile (BUILT — `src/lib/teacher-style/profile-service.ts`)
- Passive signal collection wired into upload + edit + grading routes (PARTIALLY WIRED)
- Minimum data threshold: 10+ uploaded lessons + 5+ AI-generated units edited before meaningful

**Build effort:** ~1 week (radar chart with Recharts/D3, archetype algorithm, confidence ring, evolution timeline)

**Why hold off:** Needs real data from real teachers to validate that the clusters/archetypes are meaningful. Building it now would show empty profiles for everyone. Wait until 10+ active teachers with 10+ uploads each.

### Presentation-Ready Lesson Output (NEW — 20 March 2026)
The Teaching Mode cockpit (built 20 Mar) provides the frame — timer, student tracking, projector view — but it can only display what the wizard generates. Currently, lesson content is flat JSONB (sections with text and response types). For the teaching dashboard and projector view to shine, the wizard needs to output **structured, phase-specific display content** that maps to the Workshop Model:

- **Opening phase**: Hook prompt (question, image, or provocation), key vocabulary list, success criteria for the lesson
- **Mini-Lesson phase**: Key concepts with visual aids, worked examples, demonstration steps, teacher talk points
- **Work Time phase**: Activity instructions with checkpoint questions, timer-friendly milestones, extension cards for early finishers (already in `extensions` schema — need richer content)
- **Debrief phase**: Discussion protocol (e.g., gallery walk, think-pair-share), reflection prompt, exit ticket question

**What changes:** Extend the `workshopPhases` schema so each phase carries its own displayable assets (not just a duration). The projector view then renders phase-appropriate content automatically as the teacher advances through the timer. Teachers see rich, projectable content without needing to prepare separate slides.

**Depends on:** Workshop Model timing engine (BUILT), Teaching Mode cockpit (BUILT), `workshopPhases` schema in `types/index.ts` (BUILT — needs extending).

**Build effort:** ~3-4 days (schema extension + prompt engineering + projector view rendering).

### Projector View Classroom Tools (NEW — 20 March 2026)
The projector view (`/teacher/teach/[unitId]/projector`) currently shows phase content, but teachers constantly tab away to separate apps for basic classroom tools. Building these into the projector view keeps teachers inside StudioLoom during the entire lesson.

**Build (high-value, teachers use these every lesson):**
- **Random student picker** — spinning wheel or card flip animation using the class roster. "No repeats until everyone's gone" mode so every student gets called. Optional weighting so quieter students surface more often.
- **Ad-hoc countdown timer** — separate from the phase timer. Big visible countdown for "you have 3 minutes" moments. Presets (1/2/3/5/10 min), optional alarm sound. Teachers need this dozens of times per lesson.
- **Group maker** — randomly sort class into groups of 2/3/4/5. Uses student list already loaded from live-status API. Teachers do this weekly.
- **Noise meter** — microphone-based volume indicator (green → amber → red). Students self-regulate when they can see it on screen. The "wow" feature that makes teachers show colleagues.

**Maybe (only if quick):**
- **Red pen / annotation overlay** — lightweight canvas overlay for marking up projected student work during critique. Draw, clear all. Skip if it takes more than a day.

**Skip:**
- Stopwatch (timer covers it), traffic light behaviour tracking (ClassDojo's territory), seating chart (complex, rarely needed mid-lesson)

**Depends on:** Teaching Mode projector view (BUILT), live-status API with student roster (BUILT).

**Build effort:** ~2-3 days for picker + timer + group maker + noise meter. Annotation overlay adds ~1 day.

### AI Insights Dashboard (from 2026-03 audit — High Priority)
The data model already captures the signals needed — this is primarily a UI build:
- Which knowledge base items are most/least retrieved (via `times_retrieved`, `times_used`)
- Common student misconceptions (aggregated from design assistant conversations stored in `design_conversations`)
- Quality score trends across chunks
- Cost per student per unit (requires `ai_usage_log` table — see Operational Infrastructure below)
- Bloom's level progression per student across conversations (already tracked per turn)
- Pairs naturally with the Real-time Teacher Dashboard below

### Real-time Teacher Dashboard (NEW — World-Class Gap)
The single most impactful teacher-facing feature missing. Teachers need to see at a glance:
- **Who's working, who's stuck, who's done** — live status per student per page
- **Response activity feed** — real-time stream of student submissions (like a notification centre)
- **Progress heatmap** — class grid showing completion by page, color-coded (not started / in progress / submitted / reviewed). Study Monday.com's colour-coded status columns for inspiration — instant readability at a glance.
- **At-risk alerts** — students who haven't submitted anything in X days, students stuck on same page for too long
- **Quick actions** — from the dashboard, jump directly to a student's work, send a nudge, or leave feedback
- Uses Supabase Realtime subscriptions for live updates
- Inspired by Google Classroom's stream + Clever's analytics dashboard

### Teacher Marking & Grading Assistance (World-Class Gap — No Way to Record Grades Currently)
**2026-03 audit note**: This is the highest-value feature gap. An agentic assessment workflow would transform the platform from content generation to formative assessment: retrieve rubric strand descriptors → analyse student submission against each strand → generate strand-level feedback with specific evidence → suggest targeted improvements with exemplar references → track feedback patterns across submissions. ~2-3 weeks effort, very high impact. Claude's vision capabilities could also analyse student prototype photos against design specifications (Criterion C evidence is almost always photographic).

World-leading approach to guiding teacher marking against criteria:
- **Marking criteria integration**: MYP criterion descriptors (from `CurriculumFramework` type) surfaced alongside student work during marking — not a separate lookup
- **AI-assisted criterion-level marking**: Teacher views student response alongside the relevant criterion descriptor band. AI suggests a level (1-8) with highlighted evidence from the student's work mapped to specific descriptor phrases
- **Calibration support**: Show exemplar responses at different achievement levels to help teachers calibrate. "This response is similar to a Level 5 because..."
- **Batch marking mode**: View all student responses for one page side-by-side, with AI pre-suggestions. Teacher confirms/adjusts each score rapidly
- **Feedback generation**: AI drafts criterion-specific feedback referencing what the student did well and what would move them to the next level — teacher edits before sending
- **Marking criteria as first-class data**: Criterion descriptors stored/accessible via `CriterionDefinition` type (already built in `curriculum.ts`). Enables: rubric display during marking, auto-mapping student work to descriptor phrases, export of marked work with criterion evidence
- Assessment records stored using `AssessmentRecord` type from `assessment.ts` — per-student per-unit, with criterion scores, qualitative feedback, targets
- `ClassPerformanceSummary` auto-generated after marking — feeds into next unit's AI generation

### Exemplar-Aware Grading & AI Learning from Student Work (NEW — 17 March 2026)
The knowledge base already supports "Student Exemplar" uploads (`student_exemplar` source category in the upload UI), but they're processed identically to lesson plans with no special handling. This section builds exemplars into a first-class assessment tool.

**Current state (as of March 2026):**
- UI has "Student Exemplars" upload category (star icon) — works but no special metadata
- Uploaded exemplars go through the standard 3-pass analysis and embedding pipeline
- No achievement level tagging on exemplars
- No exemplar retrieval during grading — grading is 100% manual
- Design assistant has zero access to student submissions (past or present)
- Student learning profiles exist in type system (`CriterionHistory`, `CriterionTrend`) but are not wired into any UI

**Phase A — Exemplar upload with achievement metadata (quick win):**
- When uploading to "Student Exemplars," prompt teacher for: criterion (A/B/C/D), achievement level (1-8), year/grade, brief annotation ("strong analysis but weak evaluation")
- Store metadata on knowledge chunks so retrieval can filter by criterion + level
- During grading, retrieve exemplars at adjacent levels: "Here's what a Level 5 looks like for Criterion B"
- Matt has previous student work he can upload to seed this immediately

**Phase B — AI learns from graded submissions over time:**
- As teachers grade student work through the platform, scored responses accumulate
- After sufficient data (~50+ graded responses per criterion per grade level), the AI can:
  - Suggest a score range with evidence mapped to descriptor phrases
  - Flag responses that look anomalous vs. the teacher's past grading pattern
  - Show "students who scored similarly" as comparison points
- This is the agentic assessment workflow — retrieves rubric descriptors → analyses submission → generates strand-level feedback with exemplar references
- **Privacy consideration:** student work used for AI calibration must be anonymised or opt-in

**Phase C — Cross-teacher marking moderation (longer term):**
- **Quick moderation mode:** Multiple teachers upload the same sample work, each scores independently. System highlights score disagreements and facilitates discussion. "Teacher A scored this Criterion B at 5, Teacher B scored at 7 — here's where they diverge."
- **Calibration workshops:** AI presents work samples at boundary levels (e.g., Level 4 vs Level 5 for Criterion A) and asks teachers to score. Tracks inter-rater reliability over time.
- **School-wide consistency:** Dashboard showing grade distribution by teacher per criterion — flags if one teacher consistently scores higher/lower than department average.
- **IB requirement:** MYP internal moderation and standardisation is a mandatory school process. This feature turns a tedious requirement into a genuine tool. Differentiates Questerra from every competitor.
- **Implementation note:** This requires the School Identity & Multi-tenancy work from Phase 3.5 (multiple teachers in one school seeing shared data).

### Report Generation (NEW — World-Class Gap)
End-of-term and end-of-year reports that write themselves:
- **Per-student report**: Criterion scores across units, strengths, areas for improvement, targets for next term
- **Per-class report**: Class performance summary, common patterns, recommended focus areas
- **AI-assisted narrative**: AI drafts report text from assessment data — teacher reviews and personalises
- **Export formats**: PDF (school template), CSV (for import into school reporting system), ManageBac grade push
- Uses `AssessmentRecord` + `ClassPerformanceSummary` + `CriterionHistory` types
- Report templates customisable per school (different schools have different report formats)

### Notification & Nudge System (World-Class Gap)
- **Teacher → Student**: "Remember to finish your research before Thursday" push notifications
- **System → Student**: Approaching due date reminders, streak reminders, new feedback alerts
- **System → Teacher**: Student completed summative page, student hasn't submitted in X days, assessment due
- Pink circle notification badge on floating action buttons
- Notification panel with read/unread state
- Delivery: in-app initially, email digest as upgrade
- Clear visual distinction: unread (pink dot) vs. read (no dot)

### Auto-Generated Visual Content
Automatically generate thumbnail images and visual assets based on content:
- **Unit thumbnails**: Generate a representative image for each unit based on title, topic, and subject area. Used on unit cards, student dashboard, teacher unit list.
- **Knowledge card thumbnails**: Auto-generate a visual for knowledge items that don't have a manually uploaded thumbnail.
- **Activity card visuals**: Generate illustrative images for activity templates.
- **In-lesson visuals**: Where appropriate, generate contextual images within lesson pages (e.g., a diagram of the design cycle, an illustration of a concept being taught).
- **Implementation**: Use an image generation API (DALL-E, Stable Diffusion, or similar). Generate on save/publish, store in Supabase storage. Allow teacher to regenerate or replace with manual upload.
- **Style consistency**: Establish a visual style guide for generated images (illustration style, color palette aligned with brand colors) so all auto-generated visuals feel cohesive.

### AI-Generated Instructional Videos (Longer Term)
- Generate short (~2-5 min) explainer videos to introduce concepts, demonstrate techniques, or walk through processes.
- Could use text-to-video AI (when quality is sufficient) or AI-narrated slide-based videos.
- Use cases: concept introductions at the start of a unit page, technique demonstrations for workshop skills, process walkthroughs for software tools.
- This is a longer-term aspiration — dependent on AI video quality reaching classroom-appropriate standards.
- Interim approach: AI-curated YouTube video suggestions (already planned in Phase 2 Resource Discovery).

---

## Phase 5: Social Learning & Peer Collaboration

### Peer Inspiration Gallery (UX Philosophy #7 — Social Learning)
- Class gallery where students see each other's work-in-progress — inspiration, not competition
- Teacher toggles gallery visibility per page or per unit (opt-in, not default)
- Students browse anonymously or with names (teacher choice)
- No ranking, no likes count — just a visual grid of peer work
- "Remix" option: student can reference a classmate's approach in their own response ("Inspired by...")
- Class-level milestone celebrations: "12 students finished Criterion A this week!" on dashboard
- Inspired by Scratch (remix/fork as peer learning), Domestika (per-course community showcase)

### Peer Feedback & Collaboration
- **Peer review cycles**: Teacher assigns pairs/groups, students give structured feedback using sentence stems and rubric-aligned prompts
- **Gallery walk mode**: Students browse classmates' work and leave sticky-note style comments (anonymous option available)
- **Teacher-prompted activities**: Teacher triggers class-wide feedback activities (e.g., "I like / I wish / What if" design critique, Two Stars & a Wish)
- **Feedback templates**: Pre-built sentence starters for peer feedback mapped to MYP criteria
- **Activity suggestions**: Teacher gets AI-suggested collaboration activities based on where students are in the design cycle (e.g., "Students are on B3 — suggest running a gallery walk of initial sketches")
- Links naturally to Activity Library (Phase 2) — peer feedback activities available as insertable templates

### Inline Feedback System
- Teachers can comment on individual student responses (per section, per page)
- Threaded comments: teacher writes, student can reply
- AI-assisted feedback: teacher can click "suggest feedback" to draft a comment based on rubric/criterion
- AI-assisted grading: suggest criterion level (1-8) with justification mapped to MYP descriptors
- Highlight specific text in student responses when giving feedback

---

## Phase 5.5: Parent Portal & Stakeholder Access (NEW)

### Parent Portal (Read-Only)
- Parents see their child's portfolio, progress, grades — read-only, no editing
- Invitation system: teacher/admin sends parent invite link per student
- What parents see: portfolio timeline, criterion scores, teacher comments, due dates, attendance at a glance
- What parents DON'T see: SEN provisions, pastoral notes, peer comparisons, raw integrity scores
- Privacy-first: parent access respects `DataPrivacySettings` — some regimes require explicit consent before granting parent access
- Notifications: optional email digest of weekly progress ("This week, [student] completed 3 pages and received feedback on their research")

### School Admin Dashboard
- For school administrators (head of department, principal)
- Overview: how many classes, teachers, students, units active
- Not for grading or feedback — just operational visibility
- Teacher onboarding management: invite teachers, assign roles, manage school settings
- Data export requests processed here
- Compliance dashboard: data retention status, consent records, export audit log

---

## Phase 6: Academic Integrity

**2026-03 audit note**: Current mitigations are Socratic-only mentor (won't give answers) + process documentation + portfolio capture. No plagiarism detection or AI-content detection integrated. Quick win: add a response length/complexity heuristic that flags suspiciously long or vocabulary-advanced responses for teacher review (~30 min effort). Longer term: Turnitin/Copyscape integration.

### MonitoredTextarea — Integrity-Aware Input ✅ BUILT (19 Mar 2026)
Silent writing behavior tracking component with analysis engine and teacher viewer.

**Built:**
- `src/components/student/MonitoredTextarea.tsx` — drop-in textarea replacement. Captures: paste events (content + length), keystroke count, deletion count, focus time, tab switches, 30-second text snapshots (for playback), 10-second word count history. Zero student-facing indicators.
- `src/lib/integrity/analyze-integrity.ts` — 6-rule scoring engine: paste ratio, bulk entry detection (from snapshots), typing speed anomaly (>150 WPM), low editing rate (<2%), focus loss (>10/20 events), minimal time with large content. Produces Human Confidence Score 0-100, level (high/medium/low), flags with severity, summary.
- `src/components/teacher/IntegrityReport.tsx` — teacher viewer with: circular score badge (color-coded green/amber/red), activity metrics row (time/keystrokes/pastes/focus losses/deletion rate), severity-flagged alert cards, writing playback slider (scrub through text snapshots), collapsible paste log.
- `src/components/student/ResponseInput.tsx` — `enableIntegrityMonitoring` + `onIntegrityUpdate` props wired in. When enabled, swaps textarea for MonitoredTextarea.
- `src/lib/integrity/__tests__/analyze-integrity.test.ts` — 12 test cases covering all rules + edge cases.

**Still needed:**
1. **Wire into student submission flow** — when student submits a response, store `integrityMetadata` in the `responses` JSONB field alongside the text.
2. **Integrity column on teacher grading view** — show score badge + "View report" link on each student response in the grading dashboard.
3. **Enable monitoring per-page** — teacher or admin toggle to enable integrity monitoring on specific pages (e.g., summative assessment pages).
4. **Response flagging heuristic** — flag suspiciously long/complex responses for teacher review (complements MonitoredTextarea but works on all responses, not just monitored ones).
5. **Turnitin/Copyscape integration** — longer term plagiarism detection for text responses.

---

## Phase 6.5: Free Tools for Lead Generation

### 🔥 PRIMARY: Design Thinking Toolkit Browser (NEW — 17 March 2026)

**The most beautiful collection of design thinking tools for teachers, deployable in one click.**

A visual catalogue of 36-50+ design/visual thinking tools (Mind Map, SCAMPER, Lotus Diagram, PMI, Decision Matrix, Empathy Map, Six Thinking Hats, Morphological Chart, Crazy 8s, etc.) that teachers can browse, filter, and deploy instantly in the format they need.

**Why this is the lead tool (not marking comments):** It's exciting, visual, shareable, and hits the "where has this been all my career?" reaction. Teachers share beautiful tool collections in Facebook groups and Twitter. Marking comments are useful but boring — this goes viral.

**Proof-of-concept v1:** `docs/ideas/design-toolkit-browser.html` (36 tools, MYP-specific, card-based)
**Production v2:** `docs/ideas/toolkit-v2.html` (36+ tools, framework-agnostic, dark theme, aurora gradients, glassmorphism, custom SVG illustrations, deploy overlays)
**Full design spec:** `docs/ideas/toolkit-design-spec.md`

#### Browse Experience
- Visual card grid with unique SVG illustration per tool (not generic icons — mini-infographics of the actual framework)
- **Framework-agnostic (critical decision 17 March 2026):** Uses universal design process phases (Discover, Define, Ideate, Prototype, Test) that map to IB MYP, GCSE DT, A-Level, ACARA, PLTW, Stanford d.school, IDEO, Double Diamond. NOT MYP-only — any design teacher worldwide can use it.
- Filter by: design process phase (Discover/Define/Ideate/Prototype/Test), tool type (Ideation/Analysis/Evaluation/Research/Planning/Communication/Reflection), deployment mode
- Instant search with fuzzy matching ("brainstorm" surfaces Mind Map, Crazy 8s, SCAMPER)
- Each card shows: SVG illustration (60%), tool name, one-line description, phase tags, difficulty, time estimate
- Hover reveals deploy options as overlay
- Keyboard shortcut: `/` to focus search

#### Deploy Modes (one-click, ready to use)
- **📺 Presentation** — Full-screen, projector-optimised, step-by-step walkthrough, built-in timer for timed activities (Crazy 8s), dark/light toggle, works offline
- **🖨️ Printable** — Clean A4/Letter PDF, student-facing layout with instructions + workspace + reflection prompt, differentiated versions (standard/ELL/extension), QR code back to digital version
- **👥 Group Activity** — Collaborative digital board, teacher controls (timer, reveal/hide, lock), auto-assigned roles (Six Thinking Hats), gallery walk view, export as PDF
- **⚡ Individual** — Stripped-down focused interface, timed mode with countdown, auto-save, submit to teacher, portfolio-ready output

#### Visual Direction
- Phase colours: Discover=indigo, Define=pink, Ideate=purple, Prototype=amber, Test=emerald
- Glassmorphism filter bar, aurora gradient background (subtle, atmospheric)
- Cards with perspective tilt on hover + soft shadow lift
- Fluid card shuffle animations on filter change
- Lightweight: Preact or Astro, SVG-based, works in low-bandwidth schools

#### Shareability (Viral Loop)
- Beautiful Open Graph cards when shared (the SVG illustration IS the share image)
- "Embed in Google Slides" link
- "Print as A3 classroom poster" for any tool
- Tool collections: "My top 10 for MYP Year 3" → shareable link
- Each tool has its own URL for SEO (/toolkit/empathy-map, /toolkit/decision-matrix)

#### Free vs Premium
- **Free:** Browse all tools, deploy in presentation + printable mode, share links
- **Premium (StudioLoom account):** Group activity mode, individual mode with auto-save, differentiated printables (ELL/extension), personal collections, classroom integration, analytics

#### Priority Actions
1. ~~Build proof-of-concept~~ ✅ Done
2. Commission/generate unique SVG illustrations for each tool (make-or-break visual element)
3. Build 3 fully-functional deploy modes for 5 tools as the "this is real" demo
4. Post to design teacher communities — IB Design Facebook, MYP Google Group, #MYPDesign Twitter, r/teaching
5. Track: which tools get most clicks, which deploy modes, where do teachers come from

#### Competitive Whitespace
No one does this. Canva is generic templates. TPT is ugly static PDFs. Miro/FigJam is enterprise complexity. Google Jamboard is dead. None of these are "the most beautiful collection of design thinking tools, deployable in one click, mapped to the MYP design cycle." That's the gap.

---

### SECONDARY: AI-Powered Teacher Tools

Still planned but secondary to the toolkit browser. These are useful but less exciting/shareable.

#### Marking Comment Creator
- Teacher uploads a rubric, criteria sheet, or assessment framework (PDF/DOCX/image)
- Pastes student work description or sample
- AI generates tailored feedback comments at different achievement levels (e.g., below/approaching/meeting/exceeding)
- Framework-aware: MYP, GCSE DT, ACARA, A-Level etc. (reuse existing vocabulary system)
- Output: copy-paste ready comments, optionally downloadable as a set
- Supports multiple criteria per generation (e.g., "generate Criterion A and C comments for this student")

#### Report Writer ✅ BUILT (March 2026)
Live at `/tools/report-writer`. Full bulk workflow:
- Multi-framework support: General D&T, IB MYP Design, GCSE DT, ACARA DT — each with tailored rating categories
- Per-student skill ratings (1-5 sliders) across framework categories, auto-converted to natural-language strengths/growth areas
- Per-project/unit performance ratings (1-5) — blue-tinted columns in student table, visually distinct from skill categories
- Multi-project input (up to 4) with tag/chip UI + Add button
- Reporting period selector (Term 1-4, Semester 1-2, Full Year) — temporal phrasing woven into AI output ("Throughout Term 1...", "This semester...")
- Custom categories — teachers can add their own beyond framework defaults
- Tone (formal/friendly), word count (50/100/150), pronouns (he/she/they)
- Bulk generation: up to 10 students per request, Haiku 4.5, per-student rate limiting
- Excel/CSV upload with auto-detection of columns (firstName, pronouns, notes)
- Privacy note, email-based rate limiting (20 free/month), copy-to-clipboard, regenerate individual reports
- Sentry error tracking, usage logging with token counts
- **Still to do:** School tone customisation (upload sample report to match school voice)

### Implementation Notes (applies to all free tools)
- All tools are standalone pages on the Questerra site (no login required for basic use)
- Rate limit: 20 free uses/month without signup, unlimited with free account (AI tools only — toolkit is unlimited)
- Model: Claude Haiku 4.5 for AI tools (cost: ~$0.25/million input tokens — negligible even at scale)
- Email capture: "Create a free account to save your toolkit collections and get unlimited AI uses"
- Data value: which tools teachers use most → informs unit builder defaults and activity suggestions
- Must feel genuinely useful standalone — NOT a bait-and-switch demo for the paid product

---

## Phase 7: Freemium & Monetisation

### Tiered Plans
| | **Free** | **Pro** (per teacher/mo) | **School** (annual) |
|---|---|---|---|
| Active units | 2 | Unlimited | Unlimited |
| Students | 30 | Unlimited | Unlimited |
| Design cycle (flexible pages) | ✅ | ✅ | ✅ |
| ELL scaffolding | ✅ | ✅ | ✅ |
| Portfolio + PDF export | ✅ | ✅ | ✅ |
| PPT export | ❌ | ✅ | ✅ |
| AI Unit Builder | ❌ | ✅ (monthly quota) | ✅ (higher quota) |
| AI Feedback suggestions | ❌ | ✅ | ✅ |
| Activity Library | 5 free activities | Full library | Full + custom |
| Safety Tests | 2 free tests | Unlimited | Unlimited |
| Academic Integrity | ❌ | ✅ | ✅ |
| LMS Integration (LTI SSO) | ❌ | ✅ | ✅ |
| Peer Feedback | Basic (pairs only) | Full (gallery walk, groups) | Full |
| Gantt scheduling | ✅ | ✅ | ✅ |
| School identity | ❌ | ❌ | ✅ |
| Parent portal | ❌ | ❌ | ✅ |
| Data compliance tools | ❌ | ❌ | ✅ |
| Priority support | ❌ | Email | Email + onboarding call |

### Pricing Logic
- Free tier is genuinely useful — full design cycle, ELL support, portfolio, basic planning
- Conversion trigger: teachers hit the 2-unit or 30-student cap and want more
- AI-heavy features (unit builder, feedback suggestions, integrity) are the premium differentiators
- School tier: volume discount, annual billing, admin dashboard, SSO/LMS included, school identity + parent portal
- Keep core student experience free — never degrade what students see

### Implementation
- Auth: add `plan` field to teacher/school profile (free | pro | school)
- Stripe integration: checkout, subscription management, webhooks
- Usage tracking: AI call counts, active units, student counts
- Feature gates: middleware/helper that checks plan before allowing access
- Upgrade prompts: gentle in-context nudges when hitting limits ("You've used 2 of 2 free units — upgrade to create more")
- Trial: 14-day Pro trial for new signups (no credit card required)

### Key Implementation Decisions (to resolve before building)
- **Clear feature boundary**: Every feature in the app needs a definitive free/paid classification. Use a single `FEATURE_GATES` config that maps feature keys to required plan levels — avoids scattered if-checks.
- **Payment integration**: Stripe is the standard choice. Needs: Checkout Sessions for initial signup, Customer Portal for self-service plan management (upgrade/downgrade/cancel), Webhooks for subscription lifecycle events (payment succeeded, failed, cancelled, upgraded).
- **User privilege enforcement**: Plan-based access must be enforced server-side (not just UI hiding). API routes check plan level before processing. Client-side gates are cosmetic only — for UX, not security.
- **Graceful degradation**: When a teacher downgrades, existing content should remain accessible (read-only) but creation of new content should be gated. Never delete or hide teacher's existing work.
- **School billing**: School plans need an admin who manages billing for multiple teachers. Consider: admin dashboard, teacher seat management, usage reporting per teacher.

---

## Phase 8: Workshop & Fabrication Management (Nice-to-Have)

### Fabrication Queue (Laser Cutting / 3D Printing Pipeline)
- Pain point: tracking which students have submitted files for laser cutting or 3D printing, whether a lab assistant has printed them, and where files are stored
- Students upload `.stl`/`.svg`/`.dxf` files via existing upload response type on Criterion C pages
- **Teacher/Lab view**: Fabrication Queue aggregates all uploads tagged as ready to fabricate
- Simple status pipeline: `Submitted → In Queue → Printing/Cutting → Done`
- Lab assistant gets a simplified view (or shared link) to update status without needing a full teacher account
- File storage: uploads go to a class-level fabrication folder, organized by student name
- Optional: estimated print time, machine assignment, batch grouping
- Integrates with existing upload infrastructure — no new student-facing complexity

### Inventory & Materials Management
- Teacher manages a shared inventory of equipment, tools, materials, and parts available in their workshop/makerspace
- **Teacher side**: Add items with name, quantity, photo, location (e.g., "Shelf B3"), category (electronics, wood, textiles, tools, etc.), and status (available, low stock, out of stock)
- **Quick stock updates**: Teacher can adjust quantities after each class (e.g., "10 Arduino Unos → 8 available")
- **Low-stock alerts**: Visual warnings when items drop below a teacher-defined threshold
- **Student-facing view**: Read-only browsable catalogue — students see what's available before planning their projects
- **Integration with planning**: On Criterion C pages (creating the solution), students can reference inventory items in their materials list — helps them plan realistically with what's actually available
- **Checkout / reservation** (later): Students request materials for their project, teacher approves — prevents 5 students all planning to use the one 3D printer
- **Per-unit materials list**: Teacher can pre-assign recommended materials to a unit, students see a suggested shopping list when they reach C1
- **Usage tracking over time**: Which materials get used most, which need restocking — useful for budget planning and ordering

---

## Cross-Cutting Concerns (address progressively across all phases)

### Third-Party Service Costs
- **Voyage AI** — embedding provider for knowledge base + activity cards. Free tier has 3 RPM rate limit without payment method. Add payment method to unlock 200M free tokens + higher rate limits. Currently 13/16 activity cards missing embeddings due to rate limiting.
  - Action: Add payment method at https://dash.voyageai.com → billing
  - Cost: Pay-as-you-go after 200M free tokens ($0.06/M tokens for voyage-3.5)
  - After adding payment: re-run seed to backfill embeddings for remaining cards

### Student Data Privacy & Compliance
Now comprehensive with `DataPrivacySettings` type (in `school.ts`):
- Country-specific regimes: GDPR (EU), UK GDPR, FERPA+COPPA (US), PDPA (Singapore), PDP (UAE), Privacy Act (Australia), PIPEDA (Canada), POPIA (South Africa)
- Data Processing Agreement template for schools
- Privacy policy and data retention policy
- Clear documentation of what data is collected and where it's stored
- Academic Integrity feature needs careful framing for parents/schools (silent monitoring disclosure)
- Cookie consent and data collection transparency
- AI processing consent tracked separately (some schools opt into generation but not student work analysis)
- Export audit trail with `DataExportRequest` type
- Default to GDPR as baseline — most restrictive, so meeting it covers most other regimes

### Image Compression & Storage Optimization
Currently using browser-image-compression. Further optimizations needed before scale:
- **Thumbnail generation**: Create a small ~300px thumbnail on upload for grid/list/portfolio views. Serve full size only on click-to-expand
- **Supabase image transforms**: Use built-in transform API (`?width=300&quality=75`) to resize on the fly without storing duplicates — good for avatars, unit thumbnails, progress grid previews
- **Lazy loading**: Images in portfolio timeline, progress grid, and carousel views should lazy-load (`loading="lazy"`) to avoid downloading offscreen images
- **File type validation**: Convert HEIC (iPhone) to JPEG on upload, strip EXIF metadata for privacy
- **Storage budget awareness**: Track per-school storage usage for freemium tier limits (e.g., Free = 1GB, Pro = 10GB, School = 50GB)

### Mobile & Tablet Experience (World-Class Gap)
- Students in makerspaces use iPads — Quick Capture and Portfolio must be rock-solid on mobile
- Responsive pass on all student-facing pages at tablet width (768px–1024px)
- Camera integration for Quick Capture on mobile browsers
- Touch-friendly interactions (swipe, tap targets, no hover-dependent UI)
- Mobile-first student experience at 375px — this is non-negotiable for the target age group

### Offline / Poor Connectivity (World-Class Gap)
Workshop environments frequently have poor WiFi. This is a differentiator for design/tech classrooms:
- Service worker cache for student pages (read-only offline access)
- Quick Capture queues photos/notes locally, syncs when connection returns
- Optimistic UI updates with retry logic for response submissions
- Visual indicator when offline ("Changes will sync when you're back online")
- Critical for workshops where students are away from desks near the router

### Operational Infrastructure (from 2026-03 audit — HIGH PRIORITY)
These are quick wins that should be addressed before scaling to more users:

1. **AI Usage Tracking Table** (~1h) — Add `ai_usage_log` table: `teacher_id`, `student_id`, `endpoint`, `model`, `input_tokens`, `output_tokens`, `cost_estimate`, `timestamp`. Log after each API call. Gives cost visibility and usage patterns. Essential before opening to beta.
2. **Rate Limiting on Student Endpoints** (~1-2h) — `/api/student/design-assistant` has no rate limiting. Add in-memory `Map<studentId, timestamp[]>`, 20 req/student/hour. Prevents credit exhaustion from students or bots.
3. **Sentry Integration** (~1h) — `@sentry/nextjs` wrapping API routes. Error tracking, performance monitoring, alerting. Currently all errors go to `console.error` — in production, failures are invisible.
4. **Prompt Snapshot Tests** (~2-3h) — `__tests__/prompts/` with snapshots for `buildDesignAssistantSystemPrompt()`, `UNIT_SYSTEM_PROMPT`, `buildRAGCriterionPrompt()`. When prompts change, the snapshot diff makes impact visible before deployment. Currently zero test files in the repo.

### Testing
- **2026-03 audit finding**: Zero test files in the repository. For a system generating educational content via AI, this is the highest-risk gap — prompt changes could silently degrade output quality.
- Integration tests on critical paths: student login → page load → response submit → portfolio capture
- API route tests for planning, progress, portfolio endpoints
- Component tests for complex interactive components (GanttPanel, PlanningPanel, ResponseInput)
- E2E tests for teacher flow: create class → import students → assign unit → view progress

### Product Analytics & User Behaviour Tracking
**Recommendation: Plausible or PostHog over Google Analytics 4.**

GA4 is problematic for this platform because students are aged 11–16. Under COPPA (US) and GDPR Article 8 (EU), tracking minors with cookies requires verifiable parental consent — GA4 sets cookies by default and feeds data into Google's advertising ecosystem, making compliance painful. Plausible and PostHog avoid this:

| Option | Cookies | COPPA/GDPR | Self-Host | Cost |
|--------|---------|------------|-----------|------|
| **Plausible** | None | Compliant by design | Yes | €9/mo cloud |
| **PostHog** | Optional | Compliant (cookieless mode) | Yes | Free tier generous |
| GA4 | Yes | Requires parental consent for <13 | No | Free |
| Matomo | Optional | Compliant (cookieless mode) | Yes | Free self-hosted |

**What to track:**
- **Teacher behaviour**: Unit creation flow completion, knowledge base uploads, progress grid usage, AI generation frequency, feature adoption (which tools get used vs ignored)
- **Student behaviour** (privacy-safe, no PII): Session duration, pages per session, design assistant conversation length, response submission rates, portfolio capture frequency — all aggregated, never individually identifiable
- **Conversion funnels** (Phase 7 freemium): Landing → signup → first unit created → first student added → upgrade trigger points
- **AI cost correlation**: Pair with `ai_usage_log` table (Operational Infrastructure) to correlate feature usage with API spend

**Implementation approach:**
- Plausible for page-level analytics (lightweight, no consent banner needed)
- PostHog for product analytics if deeper funnel/feature tracking is needed (feature flags, session replay on teacher-facing pages only — never on student pages)
- Never enable session replay or heatmaps on student-facing pages
- All student analytics must be aggregate-only with no individual identification

**Connects to:** Phase 7 (Freemium & Monetisation) for conversion tracking, AI Insights Dashboard (Phase 4) for usage patterns, Operational Infrastructure for cost monitoring.

### Demo / Sandbox Mode
- "Try StudioLoom" demo unit with fake student data — no signup required
- Teacher can click through full experience: student view, progress grid, grading
- Pairs with freemium — demo → free signup → upgrade
- Sharable demo link for sales conversations with schools

### Data Export & Portability
Now comprehensive with types in `school.ts`:
- Full data export: student responses, portfolio entries, grades as JSON/CSV
- Per-student export for parent requests or school transfers (`StudentPortableRecord`)
- Per-class export for end-of-year archiving
- Teacher data portability: units, lesson profiles, knowledge items (`TeacherPortableData`)
- Some schools require this contractually before adopting a platform
- Export request audit trail (`DataExportRequest`)

### Onboarding Flow (UX Philosophy #1 — Progressive Disclosure)
Inspired by Duolingo's onboarding (industry benchmark): show value before asking for anything, one screen = one action, delayed registration.

**Student first-login (Duolingo-inspired):**
- Personalization questions first: "What kind of design do you like?" (product / digital / fashion / architecture), "Have you done a design project before?" (never / once / lots)
- Immediate activity: drop student straight into their first page with a simple prompt — don't show the full unit structure yet
- Progressive reveal: bottom nav shows only current phase initially, reveals more as they progress
- Contextual tips appear once, at the moment they're relevant (not a full tour upfront)
- Goal: student submits their first response within 2 minutes of logging in

**Teacher first-login:**
- Setup wizard: school context (or join existing school) → create class → import students → assign first unit
- Progressive teaching context collection: country + school type required, everything else optional and buildable over time
- Contextual tooltips on first use of key features (progress grid, page toggles, due dates)
- "Getting Started" checklist on teacher dashboard until core setup is complete

---

## Market Expansion Considerations
- IB MYP: Primary market (ManageBac, Toddle)
- UK GCSE Design & Technology: SIMS integration
- US PLTW (Project Lead The Way): Canvas/Schoology
- Australia NSW / ACARA Design & Technologies: Google Classroom
- Architecture is provider-agnostic — adding new LMS = one new file implementing `LMSProvider` interface

### CurriculumProfile Architecture (Future — Build When Entering Second Market)
The goal: a teacher selects their curriculum framework in settings, and the entire app adapts — terminology, assessment structure, AI prompts, page types, grading scales. "Go build this for ACARA teachers" becomes: write one new profile JSON + tweak AI prompts, not a rewrite.

**The `CurriculumProfile` concept:**
A single JSON config per framework stored in `src/lib/curriculum-profiles/`. Teacher/school selects one in settings → it cascades through the entire app.

```
CurriculumProfile {
  id: "ib_myp" | "ib_dp" | "uk_gcse_dt" | "acara_dt" | "us_pltw" | ...
  name: "IB MYP Design"
  assessmentStructure: {
    criteria: [{ key, name, color, strands?, descriptors? }]
    gradingScale: { min, max, labels? }
  }
  terminology: {
    unitLabel: "Unit" | "Module" | "Project"
    criterionLabel: "Criterion" | "Assessment Objective" | "Standard"
    designCycleLabel: "Design Cycle" | "Design Process"
    inquiryLabel: "Statement of Inquiry" | "Essential Question" | "Driving Question"
    ...
  }
  defaultPhases: ["research", "ideation", "prototyping", ...]
  pageTypes: { ... }   // what page types are available
  promptOverrides: {}  // AI prompt terminology swaps
}
```

Note: The `CurriculumFramework` type in `src/types/curriculum.ts` is the detailed, data-rich version of this concept — full criterion definitions with strand objectives, achievement bands, and command terms. `CurriculumProfile` is the app-config layer; `CurriculumFramework` is the AI-context layer.

**What's already agnostic (good shape):**
- Activity cards — phases, thinking types, categories are universal. Criteria is an optional overlay.
- Flexible page model (Phase 0) — breaks fixed A1-D4 structure
- LMS integration — `LMSProvider` interface pattern
- Core student experience — portfolios, responses, uploads, quick capture
- ActivityBrowser — filters by design phase, not curriculum criteria

**What's currently IB-baked (needs CurriculumProfile abstraction later):**
- `CriterionKey` type hardcoded as `"A" | "B" | "C" | "D"` in `src/lib/constants.ts`
- `CRITERIA` object with IB-specific names/colors used in progress bars, grading, page headers
- Page type keys (`A1`, `B3`, etc.) in content data model and student progress
- AI prompts in `src/lib/ai/prompts.ts` reference "Criterion A: Inquiring & Analysing"
- Grading scales assume 1-8 per criterion
- Terminology throughout UI: "Statement of Inquiry", "ATL Skills", "Global Context"

**Migration path when ready:**
1. Create `src/lib/curriculum-profiles/ib-myp.ts` — extract all current hardcoded IB values into it
2. Replace direct `CRITERIA` / `CriterionKey` usage with `profile.assessmentStructure.criteria`
3. Replace hardcoded terminology strings with `profile.terminology.*`
4. Add curriculum selector to teacher settings (dropdown)
5. Store selected profile ID on teacher/school record
6. Create second profile (e.g., `acara-dt.ts`) and verify the whole app works with it
7. Activity cards: bulk-map existing cards to new framework's assessment tags

### China AI Provider Support
International schools in mainland China can't reach `api.anthropic.com` or `api.openai.com`. Teachers there need BYOK with local providers.

**Already working:**
- BYOK with any OpenAI-compatible API (DeepSeek, Qwen/Tongyi, Moonshot/Kimi, Zhipu/GLM, Baichuan)
- Non-streaming JSON generation path works for all OpenAI-compatible providers

**Needs work (Phase 2 enhancement):**
- Add streaming support to `OpenAICompatibleProvider` — DeepSeek and Qwen both support OpenAI-style SSE streaming
- Add function calling / tool use to `OpenAICompatibleProvider` — DeepSeek V3 and Qwen support OpenAI-style function calling for structured output
- Test & validate prompt quality with DeepSeek V3 and Qwen-Max (may need prompt tuning for non-Claude models)
- Add provider-specific model defaults in Settings UI (e.g., pre-fill `https://api.deepseek.com/v1` + `deepseek-chat` when teacher selects "DeepSeek")
- Consider adding a "Region" toggle in teacher AI settings that pre-configures a China-accessible provider
- Document recommended providers by region in onboarding flow

**Recommended China providers (ranked by generation quality):**
1. DeepSeek V3 — strongest reasoning, OpenAI-compatible, cheap ($0.27/M input), supports function calling + streaming
2. Qwen-Max (Alibaba) — good quality, OpenAI-compatible, widely available in China
3. Moonshot/Kimi — decent for Chinese + English bilingual tasks
4. Zhipu GLM-4 — solid alternative, OpenAI-compatible

---

## Priority Summary (What to Tackle)

### 0. Operational Quick Wins (from 2026-03 audit — Do First, ~5 hours total)
These are pre-scaling essentials. No architectural changes, just plugging gaps before more users arrive:

1. **AI Usage Tracking Table** (~1h) — `ai_usage_log` table logging every API call with tokens/cost. You need cost visibility before scaling.
2. **Rate Limiting on Student Endpoints** (~1-2h) — In-memory rate limiter on `/api/student/design-assistant`. Prevents credit exhaustion.
3. **Sentry Integration** (~1h) — `@sentry/nextjs`. Currently all errors go to `console.error` — in production, failures are invisible.
4. **Prompt Snapshot Tests** (~2-3h) — Zero test files in the repo. Start with snapshot tests for the 3 key prompt builders. Prevents silent regressions.
5. ~~**Response Flagging Heuristic** (~30m)~~ — Superseded by MonitoredTextarea + analyzeIntegrity() built 19 Mar 2026. Full integrity system with 6-rule scoring, playback, and teacher report.

### Immediate Impact (Build Next)
These deliver the most value for the least effort and fill the biggest gaps:

6. **Teacher Review UI** (Phase 2 — Lesson Intelligence) — upload pipeline is built but no way to see/verify the analysis. Quick win: rich display of LessonProfile after upload.
7. **Real-time Teacher Dashboard** (Phase 4) — the #1 daily-driver feature teachers don't have. "Who's stuck, who's done" at a glance.
8. **Grading/Marking UI + Agentic Assessment** (Phase 4) — no way to record grades currently. Assessment types are ready, need the UI. 2026-03 audit identified an agentic assessment workflow (retrieve rubric → evaluate → strand-level feedback → improvements) as the highest-value feature gap. Claude vision could also analyse student prototype photos against design specs.
9. **AI Insights Dashboard** (Phase 4) — data model already captures signals (retrieval counts, Bloom's progression, quality scores). Primarily a UI build. Pairs with real-time dashboard.
10. **Batch Upload UI** (Phase 2) — multi-file drag-and-drop for knowledge base. Currently single-file only. Component built 19 Mar 2026 (`src/components/teacher/BatchUpload.tsx`), needs integration into knowledge upload page.

### Foundation Work (Enables Everything Else)
11. **Teaching Context Onboarding** (Phase 2.5) — school context + teacher preferences feed into every AI generation
12. **School Entity + Student Registry** (Phase 3.5) — prerequisite for parent portal, data compliance, multi-teacher schools

### Differentiators (What Makes StudioLoom World-Class)
13. **Wizard RAG Enhancement** (Phase 2) — lesson-level retrieval makes AI generation dramatically better
14. **Cross-Encoder Re-Ranking** (Phase 2, from audit) — retrieve top 15-20, re-rank with Cohere/Voyage reranker, return top 5. ~1 week. Matters when KB exceeds ~1000 chunks.
15. **Safety Certification Tracking UI** (Phase 3) — elevated to USP, builds trust with schools and insurance
16. **Multi-Modal Student Work Analysis** (from audit) — Claude vision on student prototype photos/sketches against design specs. Natural extension of existing vision extraction pipeline. ~2 weeks.
17. **Offline/Service Worker** (Cross-cutting) — workshop WiFi is terrible, this is a differentiator
18. **Peer Inspiration Gallery** (Phase 5) — social learning for teens, lightweight but high-engagement

### Trust Builders (Required for School Sales)
19. **Data Privacy/Compliance UI** (Phase 3.5) — schools won't adopt without seeing compliance tools
20. **Report Generation** (Phase 4) — end-of-term reports are a basic expectation
21. **Parent Portal** (Phase 5.5) — read-only access for parents, required by many school policies
22. **Product Analytics** (Cross-cutting) — Plausible for page analytics (cookie-free, COPPA-safe), PostHog for product funnels if needed. Essential for Phase 7 freemium conversion tracking. Never track students individually.

---

*Last updated: 2026-03-19 (timing validation wired into pipeline, academic integrity system built, student toolkit persistence layer built — see CLAUDE.md for session details)*
