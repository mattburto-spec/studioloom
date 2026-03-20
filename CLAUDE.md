# Project: Questerra (StudioLoom)

## Instructions for Claude
- Whenever the user types `saveme` on a line by itself, update this CLAUDE.md file AND any other relevant docs in the project (e.g., `docs/roadmap.md`, `docs/ai-systems-audit-2026-03.md`, `docs/architecture.md`, etc.) to reflect the current state of the project — what's done, what's next, any new decisions, architectural changes, or notes. Only update files that are actually affected by what was worked on in the current session. **After saving, also trigger the `refresh-project-dashboard` scheduled task** to update the project dashboard and master CWORK/CLAUDE.md index.
- **When building any interactive toolkit tool or student-facing AI interaction**, read `docs/education-ai-patterns.md` first. It contains the 5 core patterns (effort-gating, Socratic feedback, staged cognitive load, micro-feedback loops, soft gating) that ALL interactive tools must follow. SCAMPER is the reference implementation.
- **When making any design decision or establishing a new pattern**, add it to `docs/design-guidelines.md`. This file feeds the dashboard Guidelines tab and is the canonical reference for all project principles. Format: `### ID. Title` followed by description, source, and status (Documented/In code/Gap).

## What this is
A gamified AI-powered learning platform for MYP Design students to work through the design cycle with structured scaffolding, Socratic mentoring, and teacher-managed knowledge bases.

## Stack
- Framework: Next.js 15.3.3 (App Router), React 19, TypeScript 5.8
- Styling: Tailwind CSS 4.1
- Backend/DB: Supabase (PostgreSQL 15+ with pgvector), Supabase Auth + custom student token sessions
- AI: Anthropic Claude (Sonnet 4 for generation, Haiku 4.5 for mentoring), Groq + Gemini fallbacks
- Embeddings: Voyage AI voyage-3.5 (1024-dim)
- Hosting/Deploy: Vercel

## Current status
Advanced prototype — core platform functional (unit builder, knowledge base, student experience, design assistant, grading). Operational infrastructure now partially in place (rate limiting, usage tracking, Sentry, Vitest). Design Thinking Toolkit now live at `/toolkit` with 12 interactive AI-powered tools plus 42-tool browsing catalog. Student Toolkit Access spec written (embedded mode + standalone mode + AI suggestions). Planning Tools UX spec ready for build. **AI Intelligence System (18 Mar 2026):** Pass 0 source-aware classification + 5 type-specific analysis pipelines (v2.0.0), Design Teaching Corpus (Layer 1) wired into all generation prompts, learning-based timing model, teacher style profiles with passive signal collection, student Design Assistant upgraded with design teaching intelligence. **Lesson Timing Engine (19 Mar 2026):** Workshop Model enforced in all generation prompts (4-phase: Opening → Mini-Lesson → Work Time → Debrief), 1+age instruction cap rule, usable time always calculated (never raw period), server-side timing validation with auto-repair, Phase Timeline Bar component for teacher modification, timing presets (Balanced/Hands-On/Instruction/Critique), post-lesson timing feedback system, extension generation for early finishers. **Open Studio (20 Mar 2026):** Replaces old Own Time system. Teacher-unlocked self-directed working mode (per student per unit). AI mentor switches from Socratic tutor (guided) to studio critic (Open Studio). 5 interaction types with drift detection + 3-level escalation + auto-revocation. Configurable check-in intervals (5-30 min). Full session lifecycle with activity logging, reflection, and productivity scoring. Fan menu rebuilt with Framer Motion (M3 Expressive style). UI modernized (frosted glass headers, updated criterion colours, teacher/student/admin dashboards refreshed). Admin AI controls redesigned with macro dials (camera-style SVG) + presets + macro/micro toggle. Teacher toolkit page at `/teacher/toolkit`. DesignPlanBoard component built (MYP design cycle kanban). TeachingDNA profile visualization on teacher dashboard. Student Design Assistant auth fixed (was using Supabase Auth, now uses student token sessions). Student lesson hero blocks use dark-to-color gradients. 3-pass analysis viewer added to LessonProfileReview. Teaching DNA Profile feature added to roadmap (Phase 3). **Teaching Mode (20 Mar 2026):** Full teaching cockpit at `/teacher/teach/[unitId]` — 3-column layout (lesson navigator, phase timer + live student grid, notes + extensions). Live student status polling (8-sec interval) with "Needs Help" detection (3+ min inactive). Dark-themed projector view at `/teacher/teach/[unitId]/projector` with phase-aware content display + postMessage sync from dashboard. "Teach This" button on unit detail page. "Teach Now" quick-launch section on teacher dashboard with progress rings. Comprehensive feature audit completed (120 features, 17 categories, 11 wiring findings). Skeleton generation hardened (dynamic max_tokens scaling, detailed error logging for debugging empty AI responses).

## What's done
- AI Unit Builder Wizard — 7-step conversational flow generating flexible-page units with criterion mapping, scaffolding, and 20 configurable emphasis dials
- Knowledge Base — PDF/DOCX/PPTX upload → 3-pass AI analysis → chunking → Voyage AI embedding → hybrid search (70% vector + 20% BM25 + 10% quality)
- Dual RAG retrieval — text chunks + structured LessonProfiles with quality feedback loop
- Design Assistant — Socratic mentor (Haiku 4.5, 300-token cap, Bloom's-adaptive, 3-strike effort-gating)
- Student experience — activity-first pages, 10+ response types (text, upload, voice, canvas, Decision Matrix, PMI, Pairwise Comparison, Trade-off Sliders)
- Portfolio auto-pipeline — responses + reflections auto-flow into timeline view with Behance-style export
- Quick Capture Bar — notes, photos, links during units
- Planning/Gantt view — student task tracker with time logging
- Teacher dashboard — class overview, progress tracking, grading with rubric-based criterion scores
- LMS integration — LTI 1.0a SSO (Canvas, Blackboard, Google Classroom)
- Admin AI Model Config panel — test models, 20 emphasis dials per framework, config history, dual-mode test sandbox (unit skeleton + single lesson)
- Framework-aware vocabulary — IB MYP, GCSE DT, ACARA, PLTW, A-Level DT, IGCSE DT command verbs and assessment structures
- Test Sandbox improvements — framework selector with dynamic criteria toggles, single lesson generation with full content preview (sections, scaffolding, response types, ELL tiers), improved skeleton view with summary stats
- Grade-level timing profiles — cognitive load caps by MYP year
- 3-tier ELL scaffolding — sentence starters, guided prompts, extension challenges
- Security — AES-256-GCM for BYOK keys, RLS policies, HttpOnly/Secure/SameSite cookies, .env.local gitignored
- Rate limiting — in-memory sliding window on design assistant (30/min, 200/hour per user), generic `rateLimit()` utility
- AI usage tracking — `ai_usage_log` table (migration 025), fire-and-forget logging with cost estimates per model
- Sentry error tracking — `@sentry/nextjs` with instrumentation files, global error boundary, wired into design assistant
- Vitest test suite — 38 tests across 3 files: prompt snapshots, framework vocabulary, timing profiles. `npm run test`
- Response length heuristics — warns on oversized design assistant responses (>1200 chars), flags in usage metadata
- 25 database migrations covering auth, units, knowledge base, assessment, design assistant, AI config, usage tracking
- **Report Writer free tool (Phase 6.5)** — bulk report comment generator at `/tools/report-writer`:
  - Multi-framework support (General D&T, IB MYP, GCSE DT, ACARA) with per-framework rating categories
  - Per-student skill ratings (1-5 sliders) across framework categories, with natural-language conversion to strengths/growth areas
  - Per-project/unit performance ratings (1-5) — blue-tinted columns visually distinct from gray skill columns
  - Multi-project input (up to 4 projects/units) with tag/chip UI
  - Reporting period selector (Term 1-4, Semester 1-2, Full Year) with temporal phrasing woven into AI output
  - Custom category support — teachers can add their own rating categories beyond the framework defaults
  - Tone (formal/friendly), word count (50/100/150), pronouns (he/she/they) controls
  - Bulk generation: up to 10 students per request, sequential Haiku 4.5 calls with per-student rate limiting
  - Excel/CSV upload for student data with auto-detection of columns
  - Privacy notice and email-based rate limiting (20 free uses/month)
  - Copy-to-clipboard per report, regenerate individual reports
  - Sentry error tracking, usage logging with token counts
- **Design Thinking Toolkit (Phase 6.5 — PRIMARY free tool)** — production Next.js route at `/toolkit`:
  - 42 design thinking tools across 7 categories (Ideation 10, Analysis 6, Evaluation 7, Research 6, Planning 4, Communication 4, Reflection 5)
  - **Framework-agnostic** — universal design process phases (Discover, Define, Ideate, Prototype, Test) mapping to IB MYP, GCSE DT, A-Level, ACARA, PLTW, Stanford d.school, IDEO, Double Diamond
  - Dark theme with aurora gradient hero, glassmorphism sticky filter bar, custom SVG illustrations per tool
  - Multi-factor filtering: search (with `/` keyboard shortcut + synonym matching), phase pills (color-coded), type pills, deploy mode pills
  - 4 deploy modes per tool: Present (projector), Print (worksheet), Group (collaborative), Solo (individual)
  - Card hover: 3D perspective tilt + deploy overlay slide-up
  - Difficulty badges (beginner/intermediate/advanced), time estimates, group size metadata
  - Files: `src/app/toolkit/layout.tsx`, `src/app/toolkit/page.tsx`, `src/app/toolkit/tools-data.ts`
  - Landing page integration: "Free Toolkit" nav link, dark-themed showcase section with 6 preview SVG cards + CTA button, footer link
  - Standalone HTML prototype at `docs/ideas/toolkit-v2.html` (identical 42 tools, used for rapid iteration)
  - Design spec at `docs/ideas/toolkit-design-spec.md`
- **SCAMPER Interactive Tool** — first interactive toolkit tool at `/toolkit/scamper`:
  - 3-screen flow: intro (challenge input) → working (7 SCAMPER steps) → summary (all ideas + AI insights)
  - AI-powered contextual prompts via Haiku 4.5 with adaptive difficulty (introductory → building → advanced based on idea count)
  - "Deal Me a Card" progressive prompt reveal with 10-second thinking timer (SVG circular progress ring)
  - Effort-gated Socratic feedback: client-side effort assessment → API adapts tone (low: push for specifics, medium: acknowledge + build momentum, high: celebrate + push for creative leaps)
  - Phase-aware AI feedback: nudges encourage DIVERGENT thinking (more ideas, wilder ideas, building on momentum) — never critique/evaluate during ideation
  - Micro-feedback loops: instant client-side toast on idea submission (purple glow for high effort, blue bounce for medium, amber for low), auto-dismisses after 3 seconds
  - Depth dots (1-3) on every idea card showing quality level, thinking depth meter showing average quality per step
  - Soft gating: prompts hidden until first idea written, then unlocked with slide-in animation; prompts always read-only (students must type their own ideas)
  - Input-first hierarchy: step header → textarea (primary action) → prompts (scaffolding below). Example collapsible via "See an example" toggle.
  - AI nudge returns structured JSON: `{ acknowledgment, nudge, effortLevel }` with regex fallback for malformed responses
  - Files: `src/app/toolkit/scamper/page.tsx`, `src/app/api/tools/scamper/route.ts`
- **Six Thinking Hats Interactive Tool** — at `/toolkit/six-thinking-hats`:
  - 3-screen flow: intro → working (6 hats) → summary (cross-hat insights)
  - Most sophisticated AI prompt routing: each hat has unique `hatRules` and `hatTone` that inject into system prompts
  - White=facts only, Red=emotions OK, Black=critical analysis (ONLY hat with evaluation language), Yellow=optimistic, Green=creative/divergent, Blue=process/meta
  - Hat navigation rail with per-hat completion dots and depth indicators
  - All 5 education AI patterns + gradient title animation
  - Files: `src/app/toolkit/six-thinking-hats/page.tsx`, `src/app/api/tools/six-hats/route.ts`
- **PMI Chart Interactive Tool** — at `/toolkit/pmi-chart`:
  - 3-step evaluation tool: Plus (benefits), Minus (risks), Interesting (neither good nor bad)
  - First tool with EVALUATION-phase AI tone — convergent analysis is correct here
  - "Interesting" column has special AI rules pushing students to find observations that are genuinely hard to categorize
  - Column-specific colors (green/red/purple), column navigation rail
  - All 5 education AI patterns
  - Files: `src/app/toolkit/pmi-chart/page.tsx`, `src/app/api/tools/pmi/route.ts`
- **Five Whys Interactive Tool** — at `/toolkit/five-whys`:
  - 5-step root cause analysis with causal chain visualization
  - KEY AI DIFFERENTIATOR: detects whether student goes SIDEWAYS (restating same level) vs DEEPER (finding root cause)
  - Previous answer context shown at each step with "↓ Now ask: why?" prompt
  - Chain indicators on first answer per step (primary answer feeds into next Why)
  - Purple gradient color scheme deepening with each Why level
  - Summary shows full causal chain with connectors + AI root cause analysis
  - Files: `src/app/toolkit/five-whys/page.tsx`, `src/app/api/tools/five-whys/route.ts`
- **Empathy Map Interactive Tool** — at `/toolkit/empathy-map`:
  - 4-quadrant research tool: Says (direct quotes), Thinks (private thoughts), Does (observable actions), Feels (emotions)
  - Persona field in intro screen for contextual AI prompts
  - Quadrant-specific AI rules: Says pushes for exact quotes, Thinks for private thoughts vs public statements gap, Does for camera-ready observable behaviors, Feels for CONTRADICTORY emotions
  - 2×2 grid navigation on working screen, 2×2 summary layout
  - Effort assessment includes quote detection (`hasQuote`) for the Says quadrant
  - Files: `src/app/toolkit/empathy-map/page.tsx`, `src/app/api/tools/empathy-map/route.ts`
- **Decision Matrix Interactive Tool** — at `/toolkit/decision-matrix`: Comparison Engine shape (NEW interaction pattern). Students define options + criteria, score each cell with mandatory reasoning, AI challenges reasoning quality per-criterion. ~1,100 lines frontend + ~350 lines API.
- **How Might We Interactive Tool** — at `/toolkit/how-might-we`: Guided Composition shape (NEW interaction pattern). Structured problem reframing with AI coaching. ~1,019 lines frontend + ~402 lines API.
- **Reverse Brainstorm Interactive Tool** — at `/toolkit/reverse-brainstorm`: 2-step ideation (brainstorm bad ideas → flip into solutions). ~756 lines + ~393 lines.
- **SWOT Analysis Interactive Tool** — at `/toolkit/swot-analysis`: 2×2 grid with per-quadrant AI rules. ~804 lines + ~414 lines.
- **Stakeholder Map Interactive Tool** — at `/toolkit/stakeholder-map`: 3-step discover (list → categorise → understand needs). ~839 lines + ~416 lines.
- **Lotus Diagram Interactive Tool** — at `/toolkit/lotus-diagram`: Step Sequence ideation tool. ~900 lines + ~400 lines.
- **Affinity Diagram Interactive Tool** — at `/toolkit/affinity-diagram`: Step Sequence analysis tool. ~800 lines + ~350 lines.
- **Morphological Chart Interactive Tool** — at `/toolkit/morphological-chart`: Step Sequence ideation tool. ~900 lines + ~300 lines.
- **Education AI Patterns doc** — `docs/education-ai-patterns.md`: comprehensive reference for all 5 patterns (effort-gating, Socratic feedback, staged cognitive load, micro-feedback, soft gating) plus Phase-Aware Feedback rule (ideation vs evaluation), with implementation details, code snippets, and checklist for applying to new tools
- **Interactive Toolkit Master Plan** — `docs/ideas/toolkit-interactive-tools-plan.md`: comprehensive build plan for all 42 toolkit tools. Categorizes tools into 4 interaction shapes (Step Sequence, Canvas, Comparison Engine, Guided Composition), defines detailed UX patterns for each shape, shared component architecture, AI endpoint design, build priority tiers, and timeline estimates (~40-50 days total)
- **Design Guidelines doc** — `docs/design-guidelines.md`: 42 design principles across 5 categories (AI & Pedagogy, Student Experience, Teacher Experience, Technical Patterns, Security & Privacy). Feeds the dashboard Guidelines tab. Auto-maintained on `saveme`.
- **Lesson Timing Engine (19 Mar 2026)** — Research-backed timing system enforcing the Workshop Model across all AI-generated lessons:
  - `src/lib/ai/prompts.ts` — Workshop Model mandatory in all generation prompts: 4-phase structure (Opening → Mini-Lesson → Work Time → Debrief), 1+age instruction cap formula, usable time always calculated (never raw period), extensions required on every lesson
  - `src/lib/ai/timing-validation.ts` — Server-side validation with 8 rules + auto-repair: workshop conformance, instruction cap, work time floor (45%), debrief presence, total time match, cognitive load, extensions, checkpoints. 4 timing presets (Balanced, Hands-On Heavy, Instruction Heavy, Critique Session)
  - `src/components/lesson-timing/PhaseTimelineBar.tsx` — Teacher modification UI: drag-to-resize timeline bar with colored phase blocks, lock/unlock phases, one-click presets, live rule violation warnings
  - `src/components/lesson-timing/TimingFeedbackPrompt.tsx` — Post-lesson feedback: per-phase ratings (Too Short/About Right/Too Long), actual duration logging, extension completion tracking
  - JSON schema updated: lessons now include `workshopPhases` (opening/miniLesson/workTime/debrief with durations) and `extensions` (title, description, duration, designPhase)
  - Grade profiles updated with `avgStudentAge` field; `maxHighCognitiveMinutes` aligned to 1+age rule
  - Research: `docs/lesson-timing-research-report.md` (comprehensive analysis), `docs/research/` folder with raw synthesis, data tables, integration roadmap, quick-reference card. 25+ sources from d.school, IDEO, PBLWorks, Project Zero, ASCD, cognitive science
- **Planning Tools UX Spec** — `docs/planning-tools-ux-spec.md`: 1,372-line research doc. Recommends replacing generic kanban with MYP Design Cycle phases. Keyboard-first, mobile-first, AI suggestions. 4-phase implementation roadmap.
- **Student Toolkit Access Spec** — `docs/specs/student-toolkit-access.md`: Full PRD for embedded + standalone tool modes. Two modes, one component. Auto-save, portfolio auto-capture, version history, floating launcher, AI assistant suggestions. 4 implementation phases (~9-11 days).
- **Academic Integrity System (19 Mar 2026)** — MonitoredTextarea component, integrity analysis engine, teacher integrity report:
  - `src/components/student/MonitoredTextarea.tsx` — drop-in textarea replacement silently tracking paste events, keystrokes, deletion count, focus time, tab switches, 30-second text snapshots (for playback), 10-second word count history. Zero student-facing indicators.
  - `src/lib/integrity/analyze-integrity.ts` — 6-rule scoring engine producing Human Confidence Score (0-100): paste ratio, bulk entry detection, typing speed anomaly, low editing rate, focus loss patterns, minimal active time. Returns score, level (high/medium/low), flags with severity, and summary.
  - `src/components/teacher/IntegrityReport.tsx` — teacher-facing viewer with color-coded score badge, activity metrics row (time/keystrokes/pastes/focus losses/deletion rate), severity-flagged alerts, writing playback slider (scrub through snapshots to watch text evolve), collapsible paste log.
  - `src/components/student/ResponseInput.tsx` — new `enableIntegrityMonitoring` + `onIntegrityUpdate` props. When enabled, swaps plain textarea for MonitoredTextarea. Default behavior unchanged.
  - Tests: `src/lib/integrity/__tests__/analyze-integrity.test.ts` — 12 test cases covering all 6 rules, edge cases, score clamping, helpers
- **Timing Validation Pipeline Wiring (19 Mar 2026)** — Connected timing validation to ALL generation routes + mounted UI components:
  - `src/lib/ai/schemas.ts` — added `workshopPhases` (opening/miniLesson/workTime/debrief) and `extensions` (2-3 per lesson) to page/lesson generation tool schemas. Now AI outputs structured Workshop Model timing.
  - `src/types/index.ts` — added `WorkshopPhases` and `LessonExtension` interfaces to `PageContent` so timing data flows from API → validation → UI
  - `src/app/api/admin/ai-model/test-lesson/route.ts` — calls `validateLessonTiming()` on every generated lesson. Returns auto-repaired lesson + raw AI output + `timingValidation` with issues/stats.
  - `src/app/api/teacher/generate-journey/route.ts` — validates pages with workshopPhases after `validateGeneratedPages()`, auto-repairs, returns `timingValidation` per page.
  - `src/app/api/teacher/generate-unit/route.ts` — NOW WIRED: runs `validateLessonTiming()` on each generated page after structural validation. Auto-repairs workshopPhases/extensions. Returns `timingValidation` in response.
  - `src/app/api/teacher/regenerate-page/route.ts` — NOW WIRED: same pattern — validates, repairs, returns timing report.
  - `src/components/teacher/wizard/JourneyLessonCard.tsx` — NOW WIRED: mounts interactive PhaseTimelineBar when lesson has workshopPhases data. Teachers can drag-resize phases, lock phases. Shows extensions in collapsible section. Passes `periodMinutes` and `instructionCap` props.
  - `src/app/teacher/units/[unitId]/page.tsx` — NOW WIRED: MiniPhaseBar renders compact read-only Workshop Model timing on each lesson card. Shows extension count badge. Uses `WorkshopPhases` type from shared types.
  - Tests: `src/lib/ai/__tests__/timing-validation.test.ts` — tests for auto-repair of missing phases, over-cap instruction, missing debrief, missing extensions, work time floor, presets, applyTimingPreset. Fixed `TimingContext` type to match current shape.
- **Open Studio (20 Mar 2026)** — Self-directed working mode replacing old Own Time system:
  - `supabase/migrations/029_open_studio.sql` — Drops Own Time tables (own_time_approvals, own_time_projects, own_time_sessions), creates `open_studio_status` (per-student per-unit with status/unlock/revoke lifecycle, configurable check_in_interval_min 5-30, carry_forward boolean) and `open_studio_sessions` (per working session with activity_log JSONB, drift_flags JSONB, productivity_score, ai_summary, reflection). RLS policies, indexes, updated_at trigger.
  - `src/lib/ai/open-studio-prompt.ts` — Studio critic system prompt builder (~280 lines). `buildOpenStudioSystemPrompt()` with 5 interaction modes: student_message, check_in, drift_check, documentation_nudge, alignment_check. Each mode has its own instruction builder with distinct AI personality.
  - `src/types/index.ts` — Open Studio types: `OpenStudioStatusValue`, `OpenStudioUnlockedBy`, `OpenStudioRevokedReason`, `OpenStudioProductivityScore`, `OpenStudioDriftLevel`, `OpenStudioStatus`, `OpenStudioDriftFlag`, `OpenStudioActivityEntry`, `OpenStudioSession`
  - `src/app/api/teacher/open-studio/status/route.ts` — GET (list class status), POST (grant unlock), PATCH (revoke/update settings). Supabase Auth.
  - `src/app/api/student/open-studio/status/route.ts` — GET returns unlocked status + active session. Student token auth.
  - `src/app/api/student/open-studio/session/route.ts` — POST (start session, auto-ends previous), PATCH (update focus, append activity, set reflection, end session). Lazy creation with incrementing session_number.
  - `src/app/api/student/open-studio/check-in/route.ts` — POST handles all 5 interaction types. Rate limited (10/min, 60/hour). Drift escalation with auto-revocation after 2 consecutive sessions with silent flags.
  - `src/hooks/useOpenStudio.ts` — React hook (~250 lines). Status polling (30s), check-in timer (configurable), drift detection (10 min inactivity), activity logging, session lifecycle, check-in rotation (regular → documentation nudge every 3rd → alignment check every 5th).
  - `src/components/open-studio/OpenStudioBanner.tsx` — Student-facing banner (~200 lines). Three states: start session, active session, revoked. Purple theme.
  - `src/components/open-studio/OpenStudioClassView.tsx` — Teacher dashboard section (~250 lines). Summary cards, per-student controls, check-in interval config, grant/revoke.
  - `src/components/open-studio/ReadinessIndicator.tsx` — Simple status card (~90 lines). Shows lock/unlock state with one-line message. Criteria-based readiness tracking deferred to future version.
  - `src/components/open-studio/OpenStudioUnlock.tsx` — Teacher inline unlock for progress page (~190 lines). Replaces OwnTimeUnlock.
  - `src/components/open-studio/index.ts` — Barrel exports all 4 components.
  - `src/lib/design-assistant/conversation.ts` — Modified: checks `open_studio_status` table, switches between guided and Open Studio system prompts based on DB flag.
  - Student dashboard: `OwnTimeCard` replaced with `ReadinessIndicator`
  - Student unit page: `OpenStudioBanner` mounted between hero and content, wired to `useOpenStudio` hook
  - Teacher progress page: `OwnTimeUnlock` replaced with `OpenStudioUnlock`, `OpenStudioClassView` added at bottom, API calls updated to `/api/teacher/open-studio/status`
  - Old Own Time status route returns 410 Gone with redirect message
  - Teacher dashboard: `GET /api/teacher/dashboard` now queries `open_studio_status` and returns `openStudioCount` per unit. `UnitProgressRow` shows "Studio" pill on every unit row (gray when 0 unlocked, purple with count when students active). Links to progress page for management.
  - ClassCard header split: class name/icon is a `<Link>` to class detail page, chevron is separate expand/collapse button.
- **Student Toolkit Persistence Layer (19 Mar 2026)** — Data layer for auto-save and session resumption:
  - `supabase/migrations/028_student_tool_sessions.sql` — `student_tool_sessions` table with student_id, tool_id, challenge, mode (embedded/standalone), unit/page linkage, JSONB state, versioning, status, RLS policies, updated_at trigger
  - `src/hooks/useToolSession.ts` — React hook with lazy session creation, debounced auto-save (500ms), session resumption, optimistic UI, save status tracking (idle/saving/saved/error), completion, version reset
  - `src/app/api/student/tool-sessions/route.ts` — POST (create) + GET (find/list) with student token auth
  - `src/app/api/student/tool-sessions/[id]/route.ts` — GET (retrieve) + PATCH (update state/complete) with ownership verification
- **Teaching Mode (20 Mar 2026)** — Full teaching cockpit for live classroom use:
  - `src/app/teacher/teach/[unitId]/page.tsx` — Teaching Dashboard (~710 lines). 3-column layout: lesson navigator | phase timer + live student grid | notes + extensions. Polls `/api/teacher/teach/live-status` every 8 seconds. "Needs Help" detection for students inactive 3+ min. Accepts `classId` query param for pre-selection from dashboard.
  - `src/app/teacher/teach/[unitId]/projector/page.tsx` — Dark-themed projector view (~300 lines). Phase-aware content: Opening shows hook+vocab, Mini-Lesson shows focus, Work Time shows activities+checkpoints+extensions, Debrief shows protocol/prompt. Syncs with dashboard via `postMessage`.
  - `src/app/api/teacher/teach/live-status/route.ts` — Polling endpoint (~200 lines). Per-student: online/offline, status, timeSpent, responseCount, lastActive, needsHelp flag. Summary stats.
  - `src/components/teach/PhaseTimer.tsx` — Reusable countdown timer (~390 lines). Full + compact modes. Play/pause/reset/skip, progress bars, 60-second warning pulse, phase-specific hints.
  - `src/app/teacher/units/[unitId]/page.tsx` — Added "Teach This" button (purple gradient, play icon)
  - `src/app/teacher/dashboard/page.tsx` — Added "Teach Now" quick-launch section with per-unit progress rings
- **Feature Audit (20 Mar 2026)** — `docs/studioloom-feature-audit-2026-03-20.md`: 120 features across 17 categories with testable criteria. 11 wiring findings including 47% code duplication in toolkit API routes (~2,890 wasted lines), `callHaiku()` copied 17 times. Refactoring priority matrix (P0-P3).
- **Skeleton Generation Hardening (20 Mar 2026)** — Dynamic `max_tokens` scaling based on lesson count (was hardcoded 4096, now up to 8192). Detailed error logging: stop_reason, model, usage stats, raw response on failure.

## What's next
- **Deploy to Vercel** — connect domain, add ANTHROPIC_API_KEY + Supabase keys. Deployment prep done (.env.example created).
- **QuickToolFAB fan menu — REBUILT (18 Mar 2026)** — Rewritten with Framer Motion (spring physics, AnimatePresence exit animations). Vertical stack layout: 5 phase pills fan upward from FAB with staggered spring entrance, tool pills slide out horizontally left when phase selected. Replaced old radial arc + SVG connecting lines approach. Dependencies: `framer-motion` added to package.json. File: `src/components/toolkit/QuickToolFAB.tsx`.
- **Student Toolkit Access (Phase A)** — data layer BUILT (migration 028 + useToolSession hook + API routes). Next: wire useToolSession into existing toolkit tool components, test auto-save flow end-to-end, apply migration to database. See spec at `docs/specs/student-toolkit-access.md`.
- **Open Studio testing (20 Mar 2026)** — Migration 029 applied. All components integrated. UI simplified (ReadinessIndicator reduced to simple lock/unlock card, criteria deferred). Teacher dashboard has "Studio" pill on every unit row for discoverability. ClassCard header now navigable (click class name → class detail page). Need end-to-end testing: teacher unlock flow, student session lifecycle, check-in timer, drift detection, auto-revocation, AI mode switching in Design Assistant. Test that old units without Open Studio data render fine (backward compat). See test checklist at `docs/open-studio-test-checklist.md`.
- **Usage tracking activation** — run `supabase db push` to apply migrations 025 (usage tracking) + 028 (student tool sessions)
- **Shared component extraction — COMPLETE (19 Mar 2026)** — Extracted 6 interactive tools (Six Thinking Hats, PMI Chart, Five Whys, Empathy Map, Decision Matrix stub, How Might We stub) from standalone pages into shared reusable components. All now work in both public (unauthenticated) and embedded (authenticated + persistent) modes. Components integrated into ResponseInput via dynamic imports + Suspense. See completion docs at `docs/toolkit-extraction-completion.md` and testing guide at `docs/toolkit-testing-quick-start.md`.
- **Remaining toolkit tools** — ~5 more interactive tools (Brainstorm, Reverse Brainstorm, SWOT, Lotus Diagram, Affinity Diagram, Stakeholder Map, Morphological Chart) to extract using same shared component pattern. ~14 template-only tools (worksheets, no AI scaffolding).
- **Planning tools UX build** — implement the spec at `docs/planning-tools-ux-spec.md`
- **Cross-encoder re-ranking** for RAG (current SQL-only ranking will degrade past 1000 chunks)
- **Remaining toolkit tools** — ~2 more interactive tools to reach 14 target, plus ~14 template-only tools (worksheets, no AI scaffolding).
- **Student PM view UX overhaul (Phase 1)** — Design cycle phases as kanban columns (not generic to-do/doing/done). Study Linear (speed), Notion (multi-view), Monday (colour-coded progress), Height (AI suggestions). Strip enterprise complexity. See detailed notes in `docs/roadmap.md` Phase 1.
- **Exemplar-aware grading & moderation** — (A) Upload previous student work with achievement level metadata, AI retrieves during grading. Matt has student work to seed this. (B) AI learns from graded submissions over time, suggests scores. (C) Cross-teacher marking moderation — teachers score same sample independently, system highlights disagreements, calibration tool. IB MYP internal moderation is mandatory so this is a killer differentiator. See detailed notes in `docs/roadmap.md` Phase 4.
- **Current AI limitation (as of Mar 2026):** Design assistant has zero access to student submissions (past or present). Knowledge base has "Student Exemplar" upload category but no special handling (no achievement level tagging, no retrieval during grading). Grading is 100% manual. Student learning profiles exist in types but aren't wired to UI.
- **Agentic assessment workflow** — multi-step rubric analysis + feedback + exemplars (highest-value feature gap)
- **Shared Knowledge Pool** — community intelligence across teachers
- **Intelligent Resource Discovery** — Tavily + YouTube + Unsplash + Europeana APIs
- **Multi-modal student work analysis** — vision analysis of prototype photos/sketches
- **Vibe Unit Planning** — progressive, just-in-time curriculum design
- **Product analytics** — Plausible or PostHog (COPPA-compliant for ages 11-16)
- **Expand test coverage** — currently prompt snapshots only; need upload pipeline integration tests, API route tests
- ~~**Academic integrity** — plagiarism/AI-detection, MonitoredTextarea component~~ BUILT 19 Mar 2026 — MonitoredTextarea, analyzeIntegrity(), IntegrityReport viewer. Next: wire into student submission flow to store metadata alongside responses, add integrity column to teacher grading view.
- **Presentation-Ready Lesson Output** — extend `workshopPhases` schema so each phase carries displayable assets (hook, vocab, key concepts, checkpoint questions, discussion protocols) not just durations. Projector view then renders phase-appropriate content automatically. See `docs/roadmap.md` Phase 4.
- **Projector View Classroom Tools** — random student picker, ad-hoc countdown timer, group maker, noise meter. Built into projector view so teachers don't tab away. See `docs/roadmap.md` Phase 4.
- **Student auth for China (PIPL compliance)** — class code + student-chosen display name (no real names). No teacher-side mapping stored in platform. No DOB/location/device info. Keeps data anonymized to sidestep PIPL cross-border transfer rules. Real-name support requires China-hosted infrastructure later.
- **Skeleton generation debugging** — "AI response missing lessons array. Got keys: []" still occurring. max_tokens increased to dynamic scaling (up to 8192). Detailed logging added. Check server console for `[generateSkeleton]` stop_reason on next failure.

## Known issues / blockers
- Migrations 025 (usage tracking) and 028 (student tool sessions) not yet applied to database — run `supabase db push`. Migration 029 (Open Studio) APPLIED 20 Mar 2026.
- Old Own Time components (`src/components/own-time/`) still on disk but unused — safe to delete. Old teacher approve route (`src/app/api/teacher/own-time/approve/`) still on disk but unreferenced — safe to delete.
- ~~No academic integrity safeguards beyond portfolio process documentation~~ BUILT 19 Mar 2026 — MonitoredTextarea + analyzeIntegrity + IntegrityReport. Needs testing + wiring into submission flow.
- Admin test sandbox skeleton endpoint still uses hardcoded model `claude-sonnet-4-20250514` rather than using config's model selection
- ~~Skeleton generation "AI response missing lessons array" intermittent failure~~ HARDENED 19+20 Mar 2026 — `anthropic.ts` `generateSkeleton()` tries multiple nesting patterns and searches for any array containing lesson-like objects. **20 Mar:** dynamic max_tokens scaling (was hardcoded 4096, now up to 8192 based on lesson count — 15-lesson skeletons were likely truncating). Added stop_reason, model, usage stats logging. Error still occurred 20 Mar with "Got keys: []" (empty tool input) — check server logs for `[generateSkeleton]` on next occurrence.
- Test coverage expanding — integrity + timing validation tests added (19 Mar), but still need API route tests, integration tests. **Live browser testing done on timing engine (19 Mar):** admin sandbox generation PASS (workshopPhases, extensions, validation all working), backward compatibility PASS (old units render fine), zero console errors. Test checklist at `docs/timing-engine-test-checklist.md`. PhaseTimelineBar drag/lock/preset interaction not yet tested (needs full wizard flow to generate lesson with workshopPhases, then expand in JourneyLessonCard).
- useToolSession hook built but not yet wired into any toolkit tool component
- Timing validation wired into generate-journey, test-lesson, generate-unit, and regenerate-page. NOT generate-timeline (different data shape — flat activities, not lessons)
- PhaseTimelineBar mounted in JourneyLessonCard (interactive) and unit detail page (read-only MiniPhaseBar). NOT yet in TimelineLessonCard or TimelineBuilder.
- TimingFeedbackPrompt component built but not yet mounted in a post-lesson flow (needs trigger mechanism — after scheduled lesson date or manual "I taught this" button)
- Post-lesson feedback → teacher profile learning pipeline not yet built (stores feedback but doesn't compute adjustment factors for future generation)
- ~~`/toolkit` was missing from middleware public routes, causing auth redirects for unauthenticated visitors~~ FIXED 17 Mar 2026

## Key decisions made
- **AI provider abstraction with fallback chain** — Anthropic → Groq → Gemini, factory pattern
- **Tool use for structured output** — forces JSON schema compliance via tool_choice rather than parsing free text; note: thinking cannot be combined with tool_choice (Anthropic API limitation)
- **Flexible page architecture** — units store content in JSONB; page types: strand, context, skill, reflection, custom
- **Student auth via tokens not Supabase Auth** — nanoid(48) tokens with 7-day TTL for simpler student onboarding
- **Hybrid search over pure vector** — 70/20/10 weighting (vector/BM25/quality) outperforms vector-only
- **Haiku for student-facing, Sonnet for generation** — cost/speed tradeoff; 300-token cap on mentor prevents over-helping
- **Self-healing validation** — invalid AI output gracefully defaults rather than hard failing
- **3-pass analysis for knowledge ingestion** — Structure (Haiku) → Pedagogy (Sonnet) → Design Teaching (Sonnet)
- **Analytics: Plausible or PostHog over GA4** — COPPA/GDPR concerns with tracking minors (ages 11-16)
- **In-memory rate limiting over DB-backed** — resets on Vercel cold start but simplest approach; DB-backed can come later
- **Design Toolkit is framework-agnostic (17 Mar 2026)** — universal phases (Discover/Define/Ideate/Prototype/Test) not MYP-specific, so any design teacher worldwide can use it. Maps to 8+ curricula. This was a critical pivot from the original MYP-only approach.
- **Toolkit at top-level `/toolkit` not under `/tools/`** — gives it its own identity and dark-themed layout separate from the gray `/tools/` layout used by report writer and marking comments
- **Toolkit uses inline styles for dark theme** — the app's Tailwind theme is light; inline styles ensure the dark toolkit theme doesn't leak into other routes
- **Education AI patterns: effort-gate before feedback (17 Mar 2026)** — all interactive toolkit tools must assess student response quality client-side BEFORE choosing a feedback strategy. Low effort gets pushed for specifics (no praise), high effort gets acknowledged + challenged deeper. This is the core differentiator vs Khanmigo (which gives same feedback regardless of effort). Documented in `docs/education-ai-patterns.md`.
- **Prompts are always read-only (17 Mar 2026)** — students can never click a prompt to auto-fill their response. They must always type their own ideas. Matt's explicit decision — "the student should always be forced to enter their own ideas."
- **Client-side effort assessment over AI-based (17 Mar 2026)** — effort level is determined by word count + linguistic markers (reasoning words, specificity markers) on the client, not by the AI. This gives instant feedback (no API latency), is deterministic (no parsing failures), and the effort level is passed to the API so it can adapt its tone.
- **Phase-aware AI feedback (17 Mar 2026)** — AI nudge tone MUST match the design thinking phase. Ideation tools (SCAMPER, brainstorm, etc.) use divergent encouragement ("what else? push further! wilder!"). Evaluation tools (Decision Matrix, PMI, etc.) use convergent analysis ("what are the trade-offs? who does this fail for?"). Critical questions during ideation kill creative flow — this was a live bug in SCAMPER's first iteration.
- **No auto-deal of prompts (17 Mar 2026)** — prompts are hidden until the student writes their first idea. Student must think independently before scaffolding is offered. After first idea, prompt section slides in and student can choose to deal cards. This reinforces effort-first philosophy.
- **Input-first hierarchy (17 Mar 2026)** — on SCAMPER working screen, the textarea is positioned immediately after the step header. Prompts/scaffolding sit below as secondary support. Example is collapsible ("See an example" toggle) to reduce text clutter. The primary action (writing) should always be above the fold.
- **Four interaction shapes for toolkit tools (17 Mar 2026)** — not all 42 tools should be interactive the same way. Step Sequence (SCAMPER-like steps), Canvas (spatial/visual regions), Comparison Engine (criteria-based scoring with reasoning), Guided Composition (structured writing with coach). ~14 tools are better as templates. Shared components extracted from SCAMPER speed up all future builds. See `docs/ideas/toolkit-interactive-tools-plan.md`.
- **Per-step AI rules are the key differentiator (18 Mar 2026)** — each tool has step/quadrant/column-specific AI rules injected into the system prompt. Six Hats has `hatRules` + `hatTone` per hat; PMI has `colRules` + `colTone` per column; Five Whys has depth-detection logic; Empathy Map has `quadRules` + `quadTone` per quadrant. This means the AI adapts its entire personality per step, not just per tool. No other edtech product does this.
- **Depth detection for Five Whys (18 Mar 2026)** — the AI nudge system prompt includes the student's previous answers chain and explicitly checks if the new answer is "at the same level" (sideways) or "one layer deeper" (good root cause analysis). This is the most pedagogically sophisticated nudge in the toolkit.
- **Empathy Map Feels quadrant pushes contradictions (18 Mar 2026)** — the AI specifically asks students to identify CONTRADICTORY emotions ("excited AND anxious"), pushing past simple happy/sad to nuanced emotional states. This is based on empathy mapping best practice from IDEO and Stanford d.school.
- **Consistent 3-screen architecture (18 Mar 2026)** — all interactive tools use the same intro → working → summary flow. Intro: challenge input + how-it-works. Working: step nav + input-first + prompts + nudge + ideas list. Summary: all steps + AI synthesis + copy. This consistency means students learn the pattern once and can use any tool.
- **All 3 interaction shapes proven (19 Mar 2026)** — Step Sequence (10 tools), Comparison Engine (Decision Matrix), Guided Composition (How Might We). The architectural patterns are validated and can scale to remaining tools.
- **Student toolkit access: two modes, one component (19 Mar 2026)** — Embedded mode (teacher assigns tool on unit page, saves as response, flows to portfolio) and Standalone mode (student opens from floating launcher or nav, saves independently). Same React component, different persistence. Completed sessions are editable (reopen to add ideas) or versionable (start fresh as v2, v3...). Versions show iteration/growth in portfolio — exactly what MYP wants.
- **Public toolkit stays free/unauthenticated (19 Mar 2026)** — `/toolkit` routes remain the free lead-gen tool for teachers. Student versions require auth and persist data. Same components render in both modes.
- **Silent integrity monitoring, not visible to students (19 Mar 2026)** — MonitoredTextarea captures writing behavior with zero visible indicators. Students see a normal textarea. Metadata stored alongside responses in JSONB. Teachers see the IntegrityReport on the grading dashboard. This is a design decision: monitoring is for academic integrity evidence, not surveillance theatre.
- **6-rule integrity scoring over AI-based (19 Mar 2026)** — Human Confidence Score uses deterministic rules (paste ratio, bulk entry, typing speed, editing rate, focus loss, minimal time) not AI classification. Deterministic = explainable to parents/admin, no API cost, instant. Threshold: ≥70 = likely independent, 40-69 = review recommended, <40 = flagged.
- **Timing validation as post-generation guard, not prompt-only (19 Mar 2026)** — Don't just tell the AI to follow Workshop Model in the prompt; validate the output afterward and auto-repair. 8 rules checked, 6 auto-repaired. Separate from generation so prompt changes don't break validation. Schema now collects `workshopPhases` + `extensions` so the AI has the right output structure.
- **Lazy session creation for toolkit persistence (19 Mar 2026)** — useToolSession creates the session on first `updateState()` call, not on mount. Prevents empty session records when students browse without engaging. Debounced auto-save at 500ms coalesces writes.
- **Floating toolkit launcher on all student pages (19 Mar 2026)** — not just during units. Students sometimes need a tool quickly for something outside the current assignment.
- **Fan menu: vertical stack over radial arc (18 Mar 2026)** — radial arc with SVG connecting lines was ugly and clipped off-screen. Replaced with vertical pill stack (phases upward from FAB) + horizontal tool slide-out. Uses Framer Motion springs for entrances/exits. Simpler, more readable, no positioning bugs.
- **Design guidelines as canonical reference (19 Mar 2026)** — `docs/design-guidelines.md` captures 42 principles across 5 categories. Feeds the project dashboard. Will split into shared + project-specific layers when porting to Makloom.
- **Workshop Model is non-negotiable (19 Mar 2026)** — Every AI-generated lesson MUST follow the 4-phase Workshop Model: Opening (5-10 min) → Mini-Lesson (max 1+age min) → Work Time (≥45% of usable time) → Debrief (5-10 min, structured protocol). This is backed by research from d.school, PBLWorks, ASCD, Cult of Pedagogy, Project Zero. Work Time is one sustained block — never fragment it into small activities.
- **1+age rule for instruction cap (19 Mar 2026)** — Maximum direct instruction minutes = 1 + average student age. Year 7 (age 12) = 13 min. Year 10 (age 15) = 16 min. Simpler and more research-backed than the old `maxHighCognitiveMinutes` lookup table. Formula from PBLWorks and cognitive science research.
- **Always use usable time, never raw period (19 Mar 2026)** — The legacy path in `buildTimingBlock()` used to generate content for the full period length when no `TimingContext` was provided. Now it always constructs a default context (theory lesson, 3-min transition). A 60-min workshop lesson has only 41 usable minutes — the AI must generate for 41, not 60.
- **Extensions are mandatory on every lesson (19 Mar 2026)** — Every AI-generated lesson must include 2-3 extension activities for early finishers, indexed to the current design phase. Investigation → deeper research. Ideation → creative variation. Prototyping → alternative materials. Evaluation → edge-case rigor. Extensions are productive deepening, not busywork.
- **Server-side timing validation with auto-repair (19 Mar 2026)** — Don't just prompt the AI to follow rules; validate the output afterward and fix what it gets wrong. 8 rules checked, 6 auto-repaired (missing phases, over-cap instruction, under-floor work time, missing debrief, time mismatch, missing checkpoints). Separate from generation so prompt changes don't break validation.
- **Teacher timing modification via Phase Timeline Bar (19 Mar 2026)** — Teachers drag phase boundaries to redistribute time. Lock phases to prevent auto-resize. One-click presets for common patterns (Balanced, Hands-On Heavy, Instruction Heavy, Critique Session). Post-lesson feedback feeds the learned profile. Teachers know their class better than the AI does — give them the controls.
- **Open Studio replaces Own Time entirely (20 Mar 2026)** — not an extension or parallel system. Migration 029 drops the old tables. Per-unit scoping (not per-class like Own Time). Teacher-only unlock for MVP (auto-calculated criteria later). Configurable check-in interval (5-30 min). Per-unit reset with optional carry-forward.
- **AI mode switching via DB flag, not conversation analysis (20 Mar 2026)** — `open_studio_status.status === 'unlocked'` determines which system prompt is used. Clean, deterministic switch. The Design Assistant checks the DB at response generation time and picks guided or Open Studio prompt.
- **Drift detection with 3-level escalation (20 Mar 2026)** — gentle nudge → direct question → silent flag to teacher. Auto-revocation after 2 consecutive sessions with silent drift flags. Escalation resets per session. Teachers see drift flags in the session log.
- **5 interaction types for Open Studio AI (20 Mar 2026)** — student_message (studio critic tone), check_in (periodic wellness check), drift_check (escalating redirects), documentation_nudge (push to document process), alignment_check (MYP criterion alignment). Each has distinct system prompt instructions.
- **Check-in rotation pattern (20 Mar 2026)** — regular check-in → documentation nudge every 3rd → alignment check every 5th. Prevents monotony. All run on the configurable timer interval.
- **Teaching Mode: polling over Supabase Realtime (20 Mar 2026)** — 8-second polling to `/api/teacher/teach/live-status` for student progress. Simpler than Realtime subscriptions, good enough for classroom use (teacher sees updates within 8s). Can upgrade to Realtime later if needed.
- **Teach Now on main dashboard (20 Mar 2026)** — one-click teaching launch from the main teacher dashboard. Each active unit shows as a card with progress ring. Links to `/teacher/teach/[unitId]?classId=[classId]` so the right class is pre-selected. Reduces friction from 3 clicks to 1.
- **Projector view as separate window, not iframe (20 Mar 2026)** — teacher opens projector view in a new window/tab and drags to projector screen. Dashboard syncs via `postMessage`. Simpler than building a dual-panel layout. Teacher controls stay private on their laptop.
- **China student auth: anonymous by default (20 Mar 2026)** — class code + student-chosen display name, no real names stored in platform. Keeps data anonymized under PIPL. Teacher maintains any name mapping offline. Real-name support requires China-hosted infrastructure (Alibaba Cloud / Tencent Cloud) and standard contractual clauses — a "when you have revenue" problem.
- **Presentation-ready output is a generation problem, not UI (20 Mar 2026)** — the teaching cockpit can only display what the wizard generates. Extending `workshopPhases` schema so each phase carries displayable assets (hook, vocab, checkpoint questions, protocols) is the real fix. Parked on roadmap Phase 4.
- **Projector classroom tools: picker + timer + groups + noise (20 Mar 2026)** — these are the tools teachers tab away for every lesson. Building them into the projector view keeps teachers inside StudioLoom. Noise meter (mic-based volume indicator) is the "wow" feature. Skip: stopwatch, behaviour tracking (ClassDojo territory), seating chart.

## Lessons Learned (CRITICAL — read before batch operations)

### 1. NEVER batch-modify JSX structure with regex/sed/perl
The Framer Motion disaster (18-19 Mar 2026) destroyed 23 tool components. What happened:
- Batch agent added `<motion.div>` by replacing `<div>` in opening tags
- Closing `</motion.div>` was placed on INNER divs instead of outermost containers
- Attempting to fix with `sed`/`perl` regex deleted opening `<div>` lines that contained animation attributes
- This cascaded into orphaned `</div>` tags, breaking JSX nesting across ALL files
- TypeScript's basic parser (`createSourceFile`) said "OK" but Next.js SWC/Webpack caught real JSX errors
- **LESSON:** Never use regex to modify JSX tag structure. Either rewrite the full component or use the Edit tool for surgical, verified changes.

### 2. Always use `tsc --noEmit` not just `createSourceFile` for JSX validation
`ts.createSourceFile()` only checks syntax — it misses:
- Unclosed JSX elements
- Mismatched opening/closing tags
- Invalid attributes on HTML elements (e.g., `hover` in inline styles)
Run `npx tsc --noEmit --jsx react-jsx --skipLibCheck <file>` to catch real JSX errors.

### 3. Client components cannot import server-only modules
`createAdminClient()` (which reads `SUPABASE_SERVICE_ROLE_KEY`) must NEVER be imported in `"use client"` components. The `onUnitCreated` signal was originally imported in a client page — moved to server-side API route.

### 4. Student auth uses token sessions, not Supabase Auth
Students authenticate via `SESSION_COOKIE_NAME` cookie → `student_sessions` table → `student_id`. NOT via `supabase.auth.getUser()`. The Design Assistant route had this bug — was using teacher auth pattern for students.

### 5. Framer Motion must be installed in the project directory, not home
`npm install framer-motion` in `~` instead of `~/CWORK/questerra` created a conflicting `package-lock.json` that made Next.js infer the wrong workspace root.

### 6. Duplicate tool names in tools-data.ts cause React key warnings
When adding interactive versions of existing template tools, either remove the template entry or rename it with "(Template)" suffix. React keys must be unique.

### 7. School profile belongs in Teacher Settings, not AI controls
School facts (period length, workshop access, doubles) are set once and rarely change. They belong in the teacher settings page, not alongside the AI tuning dials. The AI reads them from the teacher profile at generation time.

### 8. Timing model must be a learning system, not fixed values
Hard-coded timing limits ("max 15 min for direct instruction") are the wrong approach. The system should learn from teacher uploads, edits, and feedback. Cold-start defaults exist only for day-one teachers with no data.

### 9. Admin AI controls need macro/micro hierarchy
50+ individual sliders are engineer-facing, not teacher-facing. Teachers think in terms of "more workshop, less theory" — not "set scaffoldingFade to 7." The macro dials (5 big concepts) → micro sliders (50+ detailed controls) hierarchy serves both audiences.

---

## AI Brain — READ THESE BEFORE ANY AI WORK

**This is the intelligence system that makes StudioLoom more than a template generator.** These documents define how the AI thinks about design teaching. Read the relevant ones before touching any AI-related code.

| Document | Purpose | When to read |
|----------|---------|-------------|
| **`docs/ai-intelligence-architecture.md`** | Master architecture: source-aware ingestion (Pass 0), timing model, 4-layer knowledge system, per-teacher style learning, presentation style, unified intelligence pool | Before ANY AI system changes |
| **`docs/design-teaching-corpus.md`** | Layer 1: What great design teaching looks like — 10 sections covering non-linear design cycle, lesson phases, gradual release, workshop management, Perkins' whole game, assessment, studio culture, critique protocols (Ron Berger), differentiation, technology integration | Before changing AI prompts, lesson generation, student mentoring, or educational content |
| **`docs/timing-reference.md`** | Learning-based timing model — cold-start defaults that get replaced by real data from teacher uploads, edits, and feedback. Usable time formula. Activity duration ranges. Cognitive load curves. | Before touching timing logic or generation prompts |
| **`docs/education-ai-patterns.md`** | 5 core patterns for student-facing AI: effort-gating, Socratic feedback, staged cognitive load, micro-feedback loops, soft gating. SCAMPER is the reference implementation. | Before building any interactive toolkit tool or student AI interaction |
| **`docs/lesson-timing-research-report.md`** | Lesson timing research & architecture: Workshop Model (4-phase), 1+age rule, period templates, cognitive load boundaries, extension generation, teacher modification UI design, gap analysis, implementation plan | Before changing lesson timing, generation prompts, or building lesson-related UI |
| **`docs/student-learning-intelligence.md`** | Student learning profile architecture — how AI builds per-student understanding over time from conversations, assessments, tool work, and portfolio. 4-phase roadmap. | Before building student profiling, assessment features, or adaptive AI |
| **`docs/design-guidelines.md`** | 36 design principles across 5 categories. Feeds the dashboard Guidelines tab. | Before establishing new UI patterns or making design decisions |
| **`docs/open studio/open-studio-spec.md`** | Open Studio feature spec: unlock criteria, AI mentor behaviour (guided vs studio critic), drift detection, teacher dashboard, implementation notes | Before modifying Open Studio features or AI mode switching |
| **`docs/open studio/open-studio-experience-design.md`** | Open Studio experience journey: 4-phase arc (Discovery → Planning → Working → Sharing), AI-guided discovery conversation, backward planning from end date, multi-channel evidence collection, health score model, community resource library, project archetypes, visual quest journey UX. The CANONICAL guideline for how Open Studio should feel. | Before building any Open Studio UI, AI prompts, or student-facing features |

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

## Notes
- Target users: MYP Design teachers and students (ages 11-18), secondary schools
- Pedagogical foundation: Hattie's High-Impact Teaching Strategies (HITS), Richard Paul's 6 question types, Bloom's taxonomy
- Sister project: Makloom (makloom.com) — consumer/individual version for anyone learning DT skills, ~60-70% code reusable
- The audit report at `docs/ai-systems-audit-2026-03.md` has detailed file-by-file findings
- The roadmap at `docs/roadmap.md` (~950 lines) is the comprehensive feature plan
- **Codebase scale (as of March 2026):** ~245 source files, ~62,000 lines of code
- **Haiku model ID:** correct is `claude-haiku-4-5-20251001` — the old ID `claude-haiku-4-5-20250315` returns 404. Was fixed across conversation.ts, usage-tracking.ts, and free tools routes in the original build session.
- **API constraint:** `thinking` + `tool_choice` cannot be used together in the Anthropic API — endpoints using `tool_choice` for structured output must NOT include `thinking` config
- **Shared DNA across Matt's projects:** All of Matt's projects (StudioLoom, Seedlings, CALLED, Makloom) follow the same core pattern: a guided learning/growth experience where a mentor creates structured content and a participant engages with it + AI support. StudioLoom is the most complete template to clone from. Reusable: auth, class management, RAG pipeline, AI integration, gamification, portfolio. Unique per project: domain content, rubrics, role names, visual identity.
