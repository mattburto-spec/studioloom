# Project: Questerra (StudioLoom)

## Instructions for Claude

### Project tracking — SINGLE SOURCE OF TRUTH
- **[`docs/projects/ALL-PROJECTS.md`](docs/projects/ALL-PROJECTS.md)** is the canonical project tracker. ALL project status changes, new projects, new ideas, and completion updates go here — nowhere else.
- **DO NOT** add project status, roadmap items, or feature lists to CLAUDE.md, `docs/roadmap.md`, or `docs/idea-tracker.md`. Those files point to ALL-PROJECTS.md. CLAUDE.md's "What's done" and "What's next" sections are short summaries — update them only when the summary text itself is stale (e.g., feature count changes significantly), not on every session.
- `docs/roadmap.md` contains strategic design content (UX philosophy, phase specs, feature details). Update it when phase specs change or new phases are added — but project STATUS lives in ALL-PROJECTS.md.
- The interactive dashboard at [`docs/projects/dashboard.html`](docs/projects/dashboard.html) has a `PROJECTS` array that must stay in sync with ALL-PROJECTS.md.

### How we build — PHASED WITH CHECKPOINTS
- **[`docs/build-methodology.md`](docs/build-methodology.md)** is the canonical build discipline for any non-trivial work. **Read it before starting any build phase.** Core principle: scaffolding (sandbox, simulator, dryRun, cost tracking, debug surfaces) is baked into the spec as first-class components, not bolted on later. Every phase is gated by a named Matt Checkpoint — pause, report in full, wait for explicit sign-off before proceeding.
- **Default to the discipline even when Matt doesn't explicitly ask.** The methodology exists because the Dimensions3 build proved that rushing spec → code creates silent bugs (Migration 067 grandfather, Pass A/B silent max_tokens truncation) that surface later at much higher cost. Matt is explicitly happy to be methodical. Speed comes from not rediscovering these principles after they bite.
- **Non-negotiables per phase:** (1) Write a phase brief with pre-flight steps, stop triggers, and a "don't stop for" list. (2) Pre-flight ritual before touching code — git status clean, baseline `npm test` passing, re-read relevant Lessons, audit-before-touch, STOP and report findings. (3) Verify = assert expected values, not just non-null (Lesson #38). (4) Don't paper over surprises — report and wait. (5) For pattern bugs, audit all similar sites and fix in the same phase (Lesson #39 — Pass A and Pass B had identical truncation bugs; fixing one revealed the other). (6) Capture truth from one real run before locking test values. (7) Separate commits, no squashing. (8) Don't push to origin/main until checkpoint signed off AND migrations applied to prod; use `phase-X-wip` backup branches in the meantime.
- **Call Matt out when appropriate.** If a request skips the discipline — e.g. "just rush this in", "skip the tests", "we can verify later" — push back and remind him of the methodology. A self-gated checkpoint is cheaper than a bug in prod. Methodical over fast.

### Impact analysis — WIRING DIAGRAM
- **[`docs/projects/WIRING.yaml`](docs/projects/WIRING.yaml)** is the machine-readable system registry (82+ systems). **Before making changes to any system**, check its `affects` list in WIRING.yaml to see what downstream systems need updating. When adding or changing a system, update its entry (deps, affects, data_fields, docs, change_impacts).
- **[`docs/projects/wiring-dashboard.html`](docs/projects/wiring-dashboard.html)** is the interactive visual view — click any system to see upstream/downstream dependencies, docs, data fields, and impact notes.
- **[`docs/projects/system-architecture-map.html`](docs/projects/system-architecture-map.html)** tracks v1-v5 maturity evolution per system. Update `currentVersion` and `status` when systems level up.
- **Impact analysis workflow:** When changing system X → (1) find X in WIRING.yaml → (2) read its `affects` list → (3) check each affected system's `change_impacts` field → (4) update affected docs/code as needed → (5) tell the user what you checked.

### `saveme` command
- Whenever the user types `saveme` on a line by itself: (1) Update `docs/projects/ALL-PROJECTS.md` with any project status changes, new projects, or completions from this session. (2) Sync the `PROJECTS` array in `docs/projects/dashboard.html`. (3) Update CLAUDE.md only if key decisions, lessons learned, known issues, or AI Brain references changed — NOT for routine project status. For new decisions, append to `docs/decisions-log.md`. For new lessons learned, append to `docs/lessons-learned.md`. (4) Update `docs/roadmap.md` only if phase specs or strategic content changed. (5) Trigger the `refresh-project-dashboard` scheduled task to update the master index. (6) Sync `docs/projects/WIRING.yaml` — update any systems that changed status, gained/lost dependencies, or need updated impact notes. Also sync the `SYSTEMS` array in `docs/projects/wiring-dashboard.html` to match. (7) Update `docs/projects/system-architecture-map.html` if any system leveled up (currentVersion/status change). (8) Update `docs/doc-manifest.yaml` — set `last_verified` date on any docs that were read or modified during this session; add entries for any new docs created. (9) Append a session entry to `docs/changelog.md` with date, what changed, systems affected, and session context. (10) If significant changes were made during the session without a `saveme`, remind the user before they leave.
- **`saveme` reminder (MANDATORY):** Before ending ANY session where files were created, architectural decisions were made, or 3+ files were modified, Claude MUST run `bash scripts/check-session-changes.sh` and if it reports "SAVEME RECOMMENDED", remind the user: "Hey — we made significant changes this session. Want to run `saveme` to sync everything?" Do NOT skip this — unsaved sessions cause cross-session drift.
- **When building any interactive toolkit tool or student-facing AI interaction**, read `docs/education-ai-patterns.md` first. It contains the 5 core patterns (effort-gating, Socratic feedback, staged cognitive load, micro-feedback loops, soft gating) that ALL interactive tools must follow. SCAMPER is the reference implementation.
- **When making any design decision or establishing a new pattern**, add it to `docs/design-guidelines.md`. This file feeds the dashboard Guidelines tab and is the canonical reference for all project principles. Format: `### ID. Title` followed by description, source, and status (Documented/In code/Gap).
- **Before starting any non-trivial build phase**, read `docs/build-methodology.md` and write a phase brief that includes pre-flight steps, stop triggers, a "don't stop for" list, and named checkpoints. Treat sandbox/simulator/dryRun as first-class spec components, not optional scaffolding.
- **When making decisions about student profiling, measurement, cultural adaptation, language scaffolding, peer grouping, or any feature that touches student identity/wellbeing**, read `docs/research/student-influence-factors.md` first. It contains Hattie-style effect sizes for 24 factors (cultural, linguistic, psychological, environmental) with measurability ratings and interaction effects. This is the research foundation for the Student Learning Profile and Discovery Engine profiling.

## Loominary Context
StudioLoom is the first product in the **Loominary** product family (10 education apps sharing reusable code libraries). Each product is its own independently deployed app with its own database — "Loominary OS" is a shared package layer, not a runtime platform. Full Loominary docs live ONE LEVEL UP at `../Loominary/docs/`. **Important: always mount the parent folder (not just questerra/) so these `../Loominary/` paths resolve.** Key points for StudioLoom sessions:

- **Golden rule:** Build for StudioLoom with OS seams. Extract shared services only when product #2 (Makloom) forces it. Do NOT build abstract platform services. (ADR-001: `../Loominary/docs/adr/001-os-extraction-strategy.md`)
- **OS-seam principles to follow when coding:** (1) Keep domain-specific vocabulary configurable, not hardcoded. (2) Use `ServiceContext`-style patterns — tenant-aware, product-aware. (3) When building new services (auth, AI context, content delivery), keep interfaces clean enough that a second consumer could plug in without a rewrite. (4) Activity Blocks, FrameworkAdapter, and the content model are already good OS seams — maintain that pattern.
- **What NOT to do:** Don't refactor working code to be "more generic" unless a second product actually needs it. Don't import from `../Loominary/shared/` (it doesn't exist yet). Don't add Loominary-level config or abstractions.
- **Reference:** `../Loominary/docs/os/master-architecture.md` (25 services, 6 layers — north star, not a to-do list), `../Loominary/docs/os/service-mapping.md` (maps OS services to existing StudioLoom code)
- **Architecture Decision Records (ADRs 001-010):** `../Loominary/docs/adr/` — 10 accepted ADRs documenting cross-product decisions baked into StudioLoom's code. **Check before changing:** auth model (003), Activity Blocks (004), pedagogical sequences (005), Workshop Model (006), integrity monitoring (007), effort-gating (008), per-step AI rules (009), content forking (010). These are the "why" behind the patterns — if you're about to change one of these systems, read the relevant ADR first.

## What this is
A gamified AI-powered learning platform for secondary design & technology students to work through the design cycle with structured scaffolding, Socratic mentoring, and teacher-managed knowledge bases. **Framework-agnostic** — supports IB MYP, GCSE DT, A-Level DT, IGCSE DT, ACARA, PLTW, and custom frameworks. Also supports non-design unit types (Service, Personal Project, Inquiry).

## Stack
- Framework: Next.js 15.3.3 (App Router), React 19, TypeScript 5.8
- Styling: Tailwind CSS 4.1
- Backend/DB: Supabase (PostgreSQL 15+ with pgvector), Supabase Auth + custom student token sessions
- AI: Anthropic Claude (Sonnet 4 for generation, Haiku 4.5 for mentoring), Groq + Gemini fallbacks
- Embeddings: Voyage AI voyage-3.5 (1024-dim)
- Hosting/Deploy: Vercel

## Current status
Advanced prototype — ~290+ source files, ~72,000+ lines of code, 40 completed features. Core platform functional: unit builder, knowledge base, student experience, design assistant, grading, 27 interactive toolkit tools, Teaching Mode, Open Studio, Discovery Engine, Safety Badges, Class Gallery, Student Onboarding, Lesson Editor (Phase 0.5), Melbourne Metrics, unit forking, multi-class enrollment, timetabling, and more. Deployed on Vercel. **Dimensions3 Phase 4 COMPLETE (12 Apr 2026)** — Library Health & Operational Automation: 7 ops jobs, 2 hygiene jobs, 2 dashboards, cost alert delivery, migration 072. 948 tests.

## What's done
**40 completed features.** For the full list with details, see [`docs/projects/ALL-PROJECTS.md`](docs/projects/ALL-PROJECTS.md) → Complete section. Key highlights: AI Unit Builder Wizard (3-lane: Express/Guided/Architect, 4 unit types), Design Thinking Toolkit (27 interactive + 21 catalog = 48 tools), Teaching Mode (live cockpit + projector), Open Studio (self-directed mode with drift detection), Discovery Engine (8-station interactive journey, ~9,500 lines), Safety Badge System, Class Gallery & Peer Review, Phase 0.5 Lesson Editor (drag-and-drop, 12 components), Melbourne Metrics (pop art competency assessment), Unit Forking (copy-on-write per-class editing), Lesson Timing Engine (Workshop Model), Academic Integrity Monitoring, Student Onboarding ("Studio Setup"), Timetable & Scheduling, Landing Page, Lesson Pulse algorithm, Teaching Moves Library (~65 curated patterns), Performance Optimizations, and Competitive Analysis.

## What's next
**The canonical project tracker is [`docs/projects/ALL-PROJECTS.md`](docs/projects/ALL-PROJECTS.md).** It contains all active projects, planned work, ideas backlog, and completed features in one place. The interactive dashboard is at [`docs/projects/dashboard.html`](docs/projects/dashboard.html).

**Current focus (April 2026):** Dimensions3 v2 Completion Build. **Phase 4 COMPLETE (12 Apr 2026).** Library Health & Operational Automation — migration 072 (system_alerts, library_health_flags, usage_rollups), 8 health queries, 7 ops jobs + 2 hygiene jobs (all writing to system_alerts), Library Health dashboard (8 widgets), Pipeline Health dashboard (KPI + heatmap + alerts), cost alert email delivery (Resend API + 6h debounce), ops runbook. Checkpoints 4.1 passed. 905→948 tests (+43). Phases 0–4 all complete, Checkpoints 1.2/2.1/2.2/3.1/3.2/4.1 all passed. **Next:** Phase 5 (Content Safety & Moderation) or Phase 6 (Integrity & Versioning) per [`docs/projects/dimensions3-completion-spec.md`](docs/projects/dimensions3-completion-spec.md).

**Known follow-ups (tracked in [`docs/projects/dimensions3-followups.md`](docs/projects/dimensions3-followups.md) + ALL-PROJECTS.md):** (1) FU-1 /teacher/units initial render delay (P1), (2) FU-2 "Unknown" strand/level chips on pre-1.5 units (P2), (3) ✅ Migration 067 grandfather backfill bug FIXED in repo + prod, (4) Delete junk test units (P2 — now unblocked post-Checkpoint 1.2), (5) FU-5 `max_tokens` audit: 9 sites remaining (P2), (6) FU-M live cost alert email test — Resend setup deferred (P2).
## Known issues / blockers
**Resolved issues archive: [`docs/resolved-issues-archive.md`](docs/resolved-issues-archive.md)** — includes migration status log and all fixed bugs.

**Active issues:**
- **student_progress table lacks class_id field (ARCHITECTURE GAP)** — multi-class enrollment ambiguity. Design decision needed.
- ~~**13+ commits pending push**~~ — RESOLVED 7 Apr 2026.
- Set `subject` field on classes in Supabase for best card label results (currently relies on name-based detection).
- NM ObservationSnap `classes` query — may need `teacher_id` instead of `author_teacher_id`. Needs verification.
- **Archive UI not built** — `is_archived` column exists but no archive/unarchive button. Low priority.
- Old unused code safe to delete: Own Time components, old approve route, old CertManager.
- Admin sandbox endpoint still uses hardcoded model `claude-sonnet-4-20250514`.
- Test coverage gaps — ~480+ tests (Dimensions3 Phases A-D: 92+34+25+60 new tests). Still need: API route tests, integration tests, PhaseTimelineBar drag/lock, RLS policy tests. See `docs/testing/test-coverage-map.md`.
- Timing validation NOT wired into generate-timeline (different data shape).
- PhaseTimelineBar NOT in TimelineLessonCard or TimelineBuilder.
- TimingFeedbackPrompt not mounted (needs trigger mechanism).
- Post-lesson feedback → teacher profile learning pipeline not built.
- ~~**Migration 028 (student tool sessions) — status unknown.**~~ — VERIFIED 7 Apr 2026.

## Key decisions made
**Full log: [`docs/decisions-log.md`](docs/decisions-log.md)** — 182 decisions from 17 Mar – 6 Apr 2026, covering AI architecture, toolkit design, student experience, generation pipeline, Journey Engine, and more.

## Lessons Learned (CRITICAL — read before batch operations)
**Full log: [`docs/lessons-learned.md`](docs/lessons-learned.md)** — 31 hard-won lessons from production bugs, build disasters, and Supabase/Vercel gotchas. Read before batch operations, migration work, or any code touching auth, content resolution, or RLS policies.

---

## AI Brain — READ THESE BEFORE ANY AI WORK

**This is the intelligence system that makes StudioLoom more than a template generator.** These documents define how the AI thinks about design teaching. Read the relevant ones before touching any AI-related code.

| Document | Purpose | When to read |
|----------|---------|-------------|
| **`docs/brain/ai-intelligence-architecture.md`** | Master architecture: source-aware ingestion (Pass 0), timing model, 4-layer knowledge system, per-teacher style learning, presentation style, unified intelligence pool | Before ANY AI system changes |
| **`docs/design-teaching-corpus.md`** | Layer 1: What great design teaching looks like — 10 sections covering non-linear design cycle, lesson phases, gradual release, workshop management, Perkins' whole game, assessment, studio culture, critique protocols (Ron Berger), differentiation, technology integration | Before changing AI prompts, lesson generation, student mentoring, or educational content |
| **`docs/timing-reference.md`** | Learning-based timing model — cold-start defaults that get replaced by real data from teacher uploads, edits, and feedback. Usable time formula. Activity duration ranges. Cognitive load curves. | Before touching timing logic or generation prompts |
| **`docs/education-ai-patterns.md`** | 5 core patterns for student-facing AI: effort-gating, Socratic feedback, staged cognitive load, micro-feedback loops, soft gating. SCAMPER is the reference implementation. | Before building any interactive toolkit tool or student AI interaction |
| **`docs/lesson-timing-research-report.md`** | Lesson timing research & architecture: Workshop Model (4-phase), 1+age rule, period templates, cognitive load boundaries, extension generation, teacher modification UI design, gap analysis, implementation plan | Before changing lesson timing, generation prompts, or building lesson-related UI |
| **`docs/brain/student-learning-intelligence.md`** | Student learning profile architecture — how AI builds per-student understanding over time from conversations, assessments, tool work, and portfolio. 4-phase roadmap. | Before building student profiling, assessment features, or adaptive AI |
| **`docs/design-guidelines.md`** | 36 design principles across 5 categories. Feeds the dashboard Guidelines tab. | Before establishing new UI patterns or making design decisions |
| **`docs/open studio/open-studio-spec.md`** | Open Studio feature spec: unlock criteria, AI mentor behaviour (guided vs studio critic), drift detection, teacher dashboard, implementation notes | Before modifying Open Studio features or AI mode switching |
| **`docs/open studio/open-studio-experience-design.md`** | Open Studio experience journey: 4-phase arc (Discovery → Planning → Working → Sharing), AI-guided discovery conversation, backward planning from end date, multi-channel evidence collection, health score model, community resource library, project archetypes, visual quest journey UX. The CANONICAL guideline for how Open Studio should feel. | Before building any Open Studio UI, AI prompts, or student-facing features |
| **`docs/specs/discovery-engine-build-plan.md`** | **THE master build plan (2,441 lines).** 12 parts: build order, content bible (all content pools), image strategy, state machine, route architecture, gap fills (scoring normalization, Mode 2 redirect, tool dedup, Kit story), group work future spec, dead-end audit (19 response specs), Mode 1 vs Mode 2 template doors (36 total), people icon split scoring, teacher content control panel, revised station weights. Contains ALL Kit dialogue, ALL interaction content, ALL scoring algorithms. | **Before building ANY Discovery Engine component.** This is the single source of truth. |
| **`docs/specs/discovery-engine-spec.md`** | Data model: DiscoveryProfile interface, 6 knowledge domains, station data types, database schema | Before building Discovery data layer or state management |
| **`docs/specs/discovery-engine-ai-integration.md`** | AI touchpoint map: which stations call which models, prompt templates, fallback chains, async pre-generation strategy, cost budget | Before building Discovery AI endpoints |
| **`docs/specs/discovery-engine-ux-design.md`** | Visual design: backgrounds, Kit expressions/animations, station transitions, color palettes, interaction patterns, responsive considerations | Before building Discovery UI components |
| **`docs/research/student-influence-factors.md`** | Hattie-style effect size synthesis: 24 cultural, linguistic, psychological, and environmental factors influencing learning. Top 10 measurable factors, interaction effects, measurement blueprint, implementation roadmap. Research foundation for Student Learning Profile. | Before building student profiling, Discovery Engine scoring, peer grouping, language scaffolding, cultural adaptation, or any feature touching student identity/wellbeing |
| **`docs/specs/lesson-layer-architecture.md`** | Lesson Layer Architecture: layer registry, Lesson Pulse algorithm (§13), 3-dimension scoring (CR/SA/TC), surgical repair, cross-lesson balancing, display plan, generation co-pilot integration | Before building Pulse scoring, layer fields, generation quality features, or lesson analysis |
| **`docs/projects/dimensions3.md`** | Dimensions3: Generation Pipeline Rebuild — 6-stage compartmentalized generation pipeline with typed contracts, 2-pass v1 ingestion with expandable pass registry, Activity Block Library (first-class SQL entities), sandbox step-through debugger, feedback loop with approval queue + guardrails, block interaction model (prerequisites/familiarity/cross-block state), data integrity + PII scanning + copyright flagging, library health maintenance, Pre-Build Checklist (5 actions before coding). No hardcoded sequences — system learns from usage. 43 decisions logged. | **Before ANY generation pipeline rebuild, Activity Block work, ingestion pipeline work, or sandbox development.** This is the master plan — supersedes Dimensions2. |
| **`docs/specs/neutral-criterion-taxonomy.md`** | Neutral Criterion Taxonomy: 8 universal assessment categories (researching, analysing, designing, creating, evaluating, reflecting, communicating, planning) with bidirectional mapping tables for all 8 frameworks (MYP, GCSE, A-Level, IGCSE, ACARA, PLTW, NESA, Victorian) + 4 non-design unit types. FrameworkAdapter API contract. Ambiguity rules. Migration path for existing criterionTags. | Before building FrameworkAdapter, touching criterion_tags on activity_blocks, or implementing any framework-specific display logic |
| **`docs/specs/format-profile-definitions.md`** | FormatProfile Definitions: Concrete objects for Design, Service, PP, and Inquiry with all pipeline extension points (blockRelevance, sequenceHints, gapGenerationRules, connectiveTissue, timingModifiers, pulseWeights, criterionMapping, studentExperience). Migration path from UnitTypeDefinition → FormatProfile. Validation rules. | Before implementing FormatProfile in code, building any Dimensions3 pipeline stage, or adding a new unit format |
| **`docs/specs/block-library-bootstrap-strategy.md`** | Block Library Bootstrap: Selective backfill (~200-400 blocks from used units), Teaching Moves → seed blocks (52 at efficacy 65), initial efficacy scoring tiers, soft dedup via 0.92 cosine, knowledge_uploads → content_items migration, implementation order, success criteria | Before starting Dimensions3 Phase A Block Library build, running any backfill scripts, or designing efficacy scoring |
| **`docs/projects/dimensions2.md`** | **(SUPERSEDED by Dimensions3)** Dimensions2: Platform Architecture Reset — gap analysis, 5-pillar build plan. Kept for historical reference. | Only if you need historical context on the intermediate design step. |
| **`docs/projects/Studioloom Platform Architecture.docx`** | Matt's 4-Pillar master blueprint — System 1 Library/Ingestion, System 2 Engine/Generation, System 3 Classroom/Delivery, System 4 Loop/Telemetry. Enterprise-scale vision that Dimensions3 adapts to reality. | Before making architectural decisions about the generation pipeline or data model |
| **`docs/projects/lesson-pulse.md`** | Lesson Pulse project doc: algorithm summary, test run results, generation quality gap analysis, 5 quality-gap features (Teaching Moves Library, Context Injection, Voice/Personality, Exemplar Contrast, Sequencing Intuition), build estimate, next steps | Before building Pulse or generation quality improvements |
| **`docs/specs/journey-engine-spec.md`** | Journey Engine: modular interactive experiences — Journey Blocks (14 interaction types), composed Journeys with conditional branching, character/scene neutrality, student profile as central data hub (`learning_profile` JSONB), 4 rendering modes (fullscreen/embedded/window/modal), R3F animated scenes, admin node-graph editor, lesson editor integration (saved journeys not blocks), Discovery Engine migration plan, 5 build phases (~17-22 days) | Before building any Journey Engine component, journey block type, journey composition tool, or modifying Discovery Engine architecture |
| **`docs/projects/openstudio-v2.md`** | Open Studio v2: Mentor-Guided Project Planning — 7-station Planning Journey (Sonnet reasoning), teacher parameter system (capability tiers, min check-ins, semester constraints), teacher approval workflow (4 actions), plan health score, milestone-aware check-in journeys (window mode), greyscale unit card + colourful Studio card UI, `open_studio_plans` table schema, 3 example scenarios, 5 build phases (~15-17 days). First complex Journey Engine consumer. | Before building Open Studio v2, student project planning, teacher plan approval, or modifying student dashboard Open Studio UI |
| **`docs/projects/3delements.md`** | 3D Elements: Visual & Gamification Layer — 7 capability layers (R3F scenes, asset library, tutorial engine, narrative/quests, gallery/multiplayer, gamification, sound), Dimensions3 integration (r3f_instruction + sound_instruction JSONB on activity_blocks), 5 rendering modes, asset library SQL schema, build phases, blue-sky features, content authoring pipeline, 10 open questions | Before building any 3D visual layer, R3F scenes, asset library, tutorial engine, NPC system, multiplayer gallery, or gamification features |
| **`docs/projects/studentwork.md`** | Student Work Pipeline (OS Pipeline 2): 5-stage pipeline (intake → processing → enrichment → versioning → routing) for student photo/video/audio/sketch submissions. Sharp + Claude Vision hybrid for image processing. AI enrichment compares against Pipeline 1 teacher expectations. OS-aligned schema (`work_items`/`work_versions`/`work_assets`). Companion systems (storage, job queue, feedback engine, moderation). ~19 days, depends on Dimensions3. | Before building student work submission handling, image processing, visual AI feedback, portfolio visuals, or version history features |
| **`systems/Ingestion/`** | Loominary OS ingestion architecture: dual-pipeline design (Pipeline 1 teacher content, Pipeline 2 student work), 7 companion systems (storage, job queue, knowledge layer, feedback engine, moderation, notifications, portfolio), dependency map, OS-level schemas | Before making architectural decisions about ingestion, storage, or cross-app data sharing |

**Code that implements the brain:**
- `src/lib/ai/prompts.ts` → `buildDesignTeachingContext()` injects corpus + teacher style + Workshop Model into all generation prompts; `buildTimingBlock()` enforces usable time + 1+age rule + extensions; `maxInstructionMinutes()` computes 1+age cap; grade profiles include `avgStudentAge`
- `src/lib/ai/timing-validation.ts` → `validateLessonTiming()` checks 8 Workshop Model rules with auto-repair; `validateUnitTiming()` for unit-wide checks; `TIMING_PRESETS` with 4 presets; `applyTimingPreset()` for one-click application
- `src/components/lesson-timing/PhaseTimelineBar.tsx` → Drag-to-resize teacher modification UI; `buildDefaultPhases()` factory
- `src/components/lesson-timing/TimingFeedbackPrompt.tsx` → Post-lesson timing feedback collection
- `src/lib/ai/design-assistant-prompt.ts` → Student mentor system prompt with Design Teaching Intelligence (guided mode)
- `src/lib/ai/open-studio-prompt.ts` → Studio critic system prompt with 5 interaction modes (Open Studio mode)
- `src/lib/knowledge/analyse.ts` → Pass 0 classification + 5 type-specific analysis pipelines
- `src/lib/knowledge/analysis-prompts.ts` → All analysis prompts (v2.0.0) with rubric/safety/exemplar/content pipelines
- `src/lib/teacher-style/profile-service.ts` → Teacher style profile CRUD + passive signal collection
- `src/types/teacher-style.ts` → TeacherStyleProfile type + confidence computation
- `supabase/migrations/027_teacher_style_profile.sql` → Database column for style profiles (APPLIED 18 Mar 2026)

## Documentation Index
- **All docs index:** [`docs/doc-manifest.yaml`](docs/doc-manifest.yaml) (~217 files with title, purpose, freshness dates)
- **Session changelog:** [`docs/changelog.md`](docs/changelog.md) — read last 5 entries for cross-session context
- **Database schemas:** Indexed in [`docs/projects/WIRING.yaml`](docs/projects/WIRING.yaml) `data_fields` per system
- **Applied migrations:** `supabase/migrations/` + status log in [`docs/resolved-issues-archive.md`](docs/resolved-issues-archive.md)
- **Prototypes/mockups:** `docs/prototypes/` (toolkit redesigns, NM results, Open Studio)
- **Archived/superseded:** `docs/archive/` (session reports, old specs) + superseded labels in project docs
- **Tests:** `docs/testing/` (checklists per feature) + Dimensions3 testing plan at `docs/projects/dimensions3-testing-plan.md`

## Notes
- Target users: Secondary design & technology teachers and students (ages 11-18) across all frameworks (IB MYP, GCSE, A-Level, IGCSE, ACARA, PLTW, and custom). Platform is framework-agnostic — framework-specific vocabulary applied at render time via FrameworkAdapter, never baked into content.
- Pedagogical foundation: Hattie's High-Impact Teaching Strategies (HITS), Richard Paul's 6 question types, Bloom's taxonomy
- Sister project: Makloom (makloom.com) — consumer/individual version for anyone learning DT skills, ~60-70% code reusable
- The audit report at `docs/brain/ai-systems-audit-2026-03.md` has detailed file-by-file findings
- The roadmap at `docs/roadmap.md` (~950 lines) is the comprehensive feature plan
- **Codebase scale (as of March 2026):** ~245 source files, ~62,000 lines of code
- **Haiku model ID:** correct is `claude-haiku-4-5-20251001` — the old ID `claude-haiku-4-5-20250315` returns 404. Was fixed across conversation.ts, usage-tracking.ts, and free tools routes in the original build session.
- **API constraint:** `thinking` + `tool_choice` cannot be used together in the Anthropic API — endpoints using `tool_choice` for structured output must NOT include `thinking` config
- **Shared DNA across Matt's projects:** All of Matt's projects (StudioLoom, Seedlings, CALLED, Makloom) follow the same core pattern: a guided learning/growth experience where a mentor creates structured content and a participant engages with it + AI support. StudioLoom is the most complete template to clone from. Reusable: auth, class management, RAG pipeline, AI integration, gamification, portfolio. Unique per project: domain content, rubrics, role names, visual identity.
