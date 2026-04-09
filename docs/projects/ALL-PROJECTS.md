# StudioLoom — Master Project Index

> **Single source of truth for all projects, features, and ideas.**
> Visual dashboard: [projects/dashboard.html](dashboard.html)
> Last updated: 9 April 2026 (Phase D complete)

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 **ACTIVE** | Currently in development |
| 🟢 **READY** | Spec complete, ready to build |
| 🔵 **PLANNED** | Designed, committed timeline |
| 💡 **IDEA** | Vision captured, not yet specced |
| ✅ **COMPLETE** | Built, tested, deployed |
| ⚫ **SUPERSEDED** | Replaced by newer approach |
| 🔬 **RESEARCH** | Vision doc complete, open questions |

---

## 🚧 Current Focus — April 2026

**QUARANTINE ACTIVE (3 Apr 2026):** Both knowledge pipeline and generation pipeline quarantined — all routes return 410 Gone. 42 entry points sealed. Full register: `docs/quarantine.md`. Reason: rebuilding from scratch per Dimensions3 spec.

**Still working:** Manual unit creation, lesson editor, Teaching Mode, Design Assistant, Open Studio, toolkit, student experience, safety badges, gallery, pace feedback, Smart Insights.

**Current build:** Dimensions3 — **Phase A COMPLETE**, **Phase B COMPLETE**, **Phase C COMPLETE**, **Phase D COMPLETE** (9 Apr 2026). Phase E (Admin Dashboard + Polish) next. Then: verify MonitoredTextarea with fresh student data, NM Rocket Report.

---

## 🔴 Active Projects

### Dimensions3 — Generation Pipeline Rebuild
- **Priority:** TIER 0 P0 | **Est:** 17 days | **Doc:** [dimensions3.md](dimensions3.md)
- 6-stage compartmentalized pipeline, Activity Block Library (first-class SQL), 2-pass ingestion, sandbox debugger, feedback loop with approval queue. No hardcoded sequences — system learns from usage. All 9 open questions RESOLVED. Testing plan ready ([dimensions3-testing-plan.md](dimensions3-testing-plan.md)). **Phase A COMPLETE:** migrations, types, pipeline simulator, backend infra (92 tests). **Phase B COMPLETE:** ingestion pipeline, pass registry, block extraction, PII scan, review queue UI (34 tests). **Phase C COMPLETE:** 6-stage generation pipeline — retrieval, assembly, gap-fill, polish, timing, scoring. Orchestrator with sandbox/live modes. FormatProfile-aware. 420+ tests. **Phase D COMPLETE (9 Apr 2026):** Feedback system — teacher edit tracker (diff detection per activity), efficacy score computation (6-signal weighted formula), approval queue UI with hard guardrails (bloom/phase/category changes require manual approval, efficacy capped 10-95), self-healing proposals (time_weight/completion/deletion pattern detection), migration 064 (generation_feedback + feedback_proposals + audit_log tables). 60 new tests, 480+ total passing. **Phase E (Admin Dashboard + Polish) next.**

### Lesson Pulse Phase 2
- **Priority:** P0 | **Est:** 4-5 days | **Doc:** [lesson-pulse.md](lesson-pulse.md)
- Phase 1 COMPLETE (47 tests, validated 4.4–4.8 on 3 real lessons). Context Injection COMPLETE. Teaching Moves Library COMPLETE (65 moves, 29 tests). **Next:** Voice/Personality Layer, Sequencing Intuition. Note: generation wiring in 4 routes is quarantined — Pulse code preserved for Dimensions3 reuse.

### MYPflex — Framework-Flexible Assessment
- **Priority:** P0 | **Est:** 2 days remaining | **Doc:** [mypflex.md](mypflex.md)
- Phases 1-3 COMPLETE. Migration 055 APPLIED. Framework selector on classes, adaptive grading UI (buttons for discrete, sliders for %). Phase 4 (future-proofing) pending. **Unblocks non-MYP teacher adoption.**

### MonitoredTextarea Pipeline
- **Priority:** P0 | **Est:** <1 day | **Doc:** [monitored-textarea.md](monitored-textarea.md)
- Pipeline COMPLETE + UI WIRED. Migrations 054+059 APPLIED. Save timing + RLS fixed. Integrity indicators on Class Hub. IntegrityReport on grading page. **Needs:** fresh student session verification.

### Student Work Pipeline
- **Priority:** P1 | **Est:** 19 days | **Doc:** [studentwork.md](studentwork.md)
- OS Pipeline 2: 5-stage pipeline (intake → processing → enrichment → versioning → routing) for student photo/video/audio/sketch. Sharp + Claude Vision hybrid. AI enrichment compares against teacher expectations. OS-aligned schema. Depends on Dimensions3. 4 build phases.

### Work Capture Pipeline — AI Mentor Feedback on Student Work
- **Priority:** P1 | **Est:** TBD | **Doc:** [studioloom-work-capture-spec.md](studioloom-work-capture-spec.md)
- Composable `<WorkCapture />` component that embeds throughout StudioLoom. Students photograph/upload drawings, sketches, and physical prototypes; AI provides context-aware formative feedback using "What I notice / What I wonder" language. Framework-agnostic prompt templates. Image Readability Score (IRS) gates feedback depth. Dual-lens assessment (concept vs presentation scored separately). Annotation reading + mismatch detection. Multi-image support (2-4 per upload). 6 embedding points (design cycle, SCAMPER, portfolio, Open Studio, peer feedback, quick ping). No direct competitor exists. Spec v1.5 Final (6 Apr 2026).

### Designer Mentor System — Personalised AI Mentoring via Real Designers
- **Priority:** P1 | **Est:** TBD | **Doc:** [studioloom-designer-mentor-spec.md](studioloom-designer-mentor-spec.md) (full spec), [studioloom-mentor-model-prompts.md](studioloom-mentor-model-prompts.md) (3D model prompts)
- Complete personalised mentoring system: 20 real-world designers as AI mentors (I.M. Pei, Zaha Hadid, Tadao Ando, Kéré, Barragán, Dieter Rams, Charlotte Perriand, Hella Jongerius, Jony Ive, Yinka Ilori, Yamamoto, Iris van Herpen, Paula Scher, Kenya Hara, David Carson, Charles & Ray Eames, Eileen Gray, Neri Oxman, Virgil Abloh, Nendo). 16 sections: 5-dimension trait taxonomy (aesthetic/philosophy/material/process/cultural), "Discover Your Design DNA" visual onboarding (4-5 rounds), weighted cosine similarity matching algorithm, AI persona system with per-mentor voice/vocabulary/beliefs/blind spots, 20 full persona YAML profiles, DB schema (4 tables), IP/legal framing, admin analytics/tuning, 11 platform applications (Critique Table, Speed Crit, Peer Review Through Mentor Eyes, "What Would ___ Do?", Design Debate, mentor-narrated portfolios, provocations, Stuck Button, annotations, Lineage Map), content safety (6 risk categories), 20 dashboard themes (CSS custom properties per mentor), 3D character pipeline (*Another World* flat-shaded style, 80-300 polygons, silhouette identity), full model prompts for all 20 characters. Spec v1.0 (Apr 2026). Ties into Work Capture Pipeline, 3D Elements/Designville, Discovery Engine, Open Studio.

### Journey Engine — Modular Interactive Experiences
- **Priority:** P1 | **Est:** 17-22 days | **Doc:** [journey-engine-spec.md](../specs/journey-engine-spec.md)
- Extracts Discovery Engine's proven interaction grammar into a reusable system. Journey Blocks (atomic interaction primitives: binary choice, card sort, sliders, scene explore, text prompt, etc.) composed into named Journeys of any length (2 min check-in to 60 min profiling). Character-neutral and scene-neutral — presentation (character, R3F scene, voice) applied at journey level, infinitely swappable. Conditional branching with path validation. Student profile (`learning_profile` JSONB) as central data hub — every journey writes, every AI system reads. 4 rendering modes: fullscreen, embedded in lessons, floating window, modal overlay. R3F animated scenes (Blender → .glb pipeline, Another World art style). Lesson editor shows saved journeys (not individual blocks) as a second category alongside Activity Blocks. Admin node-graph editor for journey composition; teacher authoring later. Discovery Engine becomes the reference journey ("Student Discovery"). 5 build phases (A-E). Depends on Dimensions3 (Activity Block schema), 3D Elements (R3F renderer).

### 3D Elements / Designville
- **Priority:** P2 (research) | **Est:** 32 days | **Doc:** [3delements.md](3delements.md)
- 7 capability layers (R3F scenes, asset library, tutorial engine, narrative/quests, multiplayer gallery, gamification, sound). Augmentation-first. Project doc complete (~840 lines). 10 open questions. Build starts after Dimensions3 core.
- **Render Modes Plan integrated (7 Apr 2026):** Rendering architecture now two orthogonal dimensions — 5 render presets (Showcase/Designville/Workshop/Tutorial/Print) × 5 UI container modes (Fullscreen/Embedded/Floating/Modal/PiP). All presets share one .glb asset pipeline. Render preset build order: Workshop → Designville → Tutorial → Showcase → Print. Source: `docs/StudioLoom-3D-Render-Modes-Plan.docx`.
- **Room design prototyped (7 Apr 2026):** 4 room templates (IndoorRoom, Clearing, Overlook, Passage) built with raw Three.js + Kenney GLB assets. Decision: grounded real locations, NOT floating platforms — each station should feel like a real place. Nav UI pattern validated (station pills top-right, progress dots bottom, prev/next arrows). Fire glow, fog tinting, emissive accents, ambient particles all validated. Prototypes: `3delements/discovery-rooms-prototype.html` (v1 — floating platforms, rejected), `3delements/discovery-rooms-v2.html` (v2 — grounded rooms, approved direction).

---

## 🟢 Ready to Build

### School Readiness — Enterprise Requirements
- **Phase:** Pre-Pilot to Pre-Scale | **Est:** 37-50 days | **Doc:** [school-readiness.md](school-readiness.md)
- 17 items across 3 tiers. Pre-Pilot (~12-17d): SSO, RBAC, Multi-Tenancy, Class polish, Teacher Dashboard. Pre-Launch (~15-21d): Analytics, Export, Privacy, Accessibility, Moderation, Notifications, Audit. Pre-Scale (~10-12d): Microsoft SSO, Google Classroom Sync, Admin Analytics, Offline, Backup.

### Toolkit Redesign v5
- **Phase:** Phase 6.5 | **Est:** 3-4 days | **Doc:** [toolkit.md](toolkit.md)
- Design APPROVED (prototype: `docs/prototypes/toolkit-redesign-v5.html`). Phase pills as sole filter, structural SVG thumbnails, AI search, neon tab line, INTERACTIVE badge. Replaces current `/toolkit` and `/teacher/toolkit`.

### How-To Video System
- **Phase:** Marketing | **Doc:** [howtovideos.md](howtovideos.md)
- Video tutorial system for teacher onboarding and feature walkthroughs.

---

## 🔵 Planned (spec exists, committed)

### Open Studio v2 — Mentor-Guided Project Planning
- **Priority:** P1 | **Est:** 15-17 days | **Doc:** [openstudio-v2.md](openstudio-v2.md)
- Journey Engine's first complex consumer. AI mentor negotiates a real project plan with each student: project, timeframe, deliverables, milestones, knowledge gaps (MiniSkill recommendations), resources. 7-station Planning Journey with Sonnet-level reasoning (pushback on unrealistic timelines, deliverables extraction, constraint synthesis). Teacher sets parameters at unlock (capability tier, min check-ins, custom constraints, semester end). Teacher approval workflow (approve / notes / return for revision). Plan becomes backbone of Working phase — milestone-aware check-ins, health score, adaptive frequency. Depends on Journey Engine (Phases A-B), Timetable & Scheduling. Supersedes `openstudio.md` idea doc.

### Year Planner & Curriculum Connection
- **Priority:** P1 | **Est:** 5-7 days | **Doc:** `docs/specs/year-planner-spec.md`
- Week-based grid (all classes × all units across academic year). Drag-to-move. Lesson count from cycle engine. Curriculum coverage overlay. Depends on timetable (COMPLETE).

### Planning Tools / Student PM
- **Phase:** 1 | **Est:** 5 days | **Doc:** `docs/specs/planning-tools-ux-spec.md`
- Student kanban with MYP Design Cycle phases. Keyboard-first, mobile-first. AI suggestions. Due dates tied to timetable.

### Gamification / Student Levels
- **Phase:** 1 | **Est:** 8-10 days
- Designer Level system (quality-weighted, not volume). Composite from criteria scores, toolkit depth, badges, reflections, Open Studio, NM, portfolio. No public leaderboard (ages 11-16). Depends on grading + all subsystems.

### Intelligence Profiles (Teacher & Student)
- **Phase:** 3.5 | **Est:** 8-10 days | **Doc:** `docs/student-learning-intelligence.md`
- Teacher profile: learns style from edits, feedback, pacing. Student profile: 4-phase build from Discovery + toolkit + pace + progress. Cached 200-300 token summary for AI. Identity-safe.

### Lesson Plan Converter
- **Phase:** 2 | **Est:** 5-7 days | **Doc:** `docs/specs/lesson-plan-converter.md`
- Dual output: editable unit + tagged activity blocks. Reuses stored text + Pass 0 result. "Convert to Unit" button on knowledge cards. Depends on Dimensions3 Phase 1+2.

### Unified Upload Architecture
- **Phase:** 2 | **Est:** 3.5 days | **Doc:** `docs/specs/unified-upload-architecture.md`
- Every upload → knowledge pipeline first. Convert-on-demand. Option 2 APPROVED. Build after Dimensions Phase 3-4.

### Student Choice Units
- **Phase:** 4+ | **Est:** 4-5 days | **Doc:** [studentchoice.md](studentchoice.md)
- Students pick from teacher-curated list. AI generates personalized unit. Learning profile influences scaffolding. Requires content library.

### NM Rocket Report
- **Phase:** 6.7 | **Est:** 2-3 days
- Awaiting Melbourne Metrics materials from Matt. Visual report format TBD.

### API Deduplication
- **Phase:** Tech Debt | **Est:** 2 days
- 17× copied `callHaiku()` = ~2,890 wasted lines. Consolidate into single AI service helper. Prerequisite for clean Dimensions3 pipeline. Source: OS service mapping #12 (Feedback Engine) + code audit.

### Auth / ServiceContext Seam
- **Phase:** OS Seam | **Est:** 1-2 days | **Source:** ADR-001, OS Service #3
- Add `requireAuth(role)` helper + tenant-aware `ServiceContext` pattern (product-aware, role-aware) without rebuilding auth. Lightweight architectural seam that makes Makloom extraction cleaner. Not SSO/RBAC (that's in School Readiness) — just clean interfaces over the current student-token + Supabase Auth dual system.

### AI Safety & Content Guardrails
- **Phase:** Pre-Pilot | **Priority:** P1 | **Est:** 10-14 days | **Doc:** [ai-safety.md](ai-safety.md)
- Comprehensive AI safety layer for all 5 student↔AI touchpoints (Design Assistant, toolkit nudges, Discovery Kit, Open Studio, Gallery). Content filter engine (800+ blocked words, l33tspeak/unicode evasion detection, school/class-configurable word lists). PII scanner (student name protection from class roster, email/phone/address detection). Topic guardrails (hardcoded safety floor + school-configurable restricted topics). Distress detection (keyword + behavioural signals from MonitoredTextarea, teacher alert protocol). AI conversation logger (full audit trail). AI output screening (content filter + PII + hallucination guard + tone check). Teacher Safety Dashboard (conversation viewer, flagged queue with severity sorting, policy configuration per class). PII pseudonymisation wrapper for all AI API calls. Competitive parity with Toddle (ISO 42001 features) plus StudioLoom advantages: per-step phase-aware safety, effort-gated AI access, integrity+safety unified signals. Extends existing MonitoredTextarea, integrity scoring, response flags, rate limiting. Required before any school pilot. Supersedes old "Content Safety & Moderation" entry.

---

## 💡 Ideas Backlog

### High Priority Ideas

| Idea | Category | Est. | Notes |
|------|----------|------|-------|
| ~~Open Studio v2 — Journey-Based~~ | ~~Student XP~~ | | **Superseded by Open Studio v2 project below** |
| **StudentDash — Student Dashboard Reimagination** | Student XP | TBD | Less busy, customisable student dashboard. 7 design directions (Studio Desk, Map/Trail, Portfolio-First, Focus/Zen, Mood-Responsive, Peer Glimpses, Messy Desk). Draggable/resizable widgets, 3 preset layouts, reflection + wayfinder + stones rethink. **Needs student testing.** Doc: [studentdash.md](studentdash.md) |
| **Real Client Journey** | Student XP | 5-7d | AI-simulated client meetings (4 per unit). Cross-meeting memory. Doc: [realclient.md](realclient.md) |
| **MiniSkills** | Student XP | 3-4d | Bite-sized 1-3 lesson micro-units. Badge on completion. Doc: [miniskills.md](miniskills.md) |
| **Monetisation & Tiers** | Business | 7-10d | Stripe, 4 tiers (Free/Starter/Pro/Enterprise). Doc: [monetisation.md](monetisation.md) |
| **Bug Report Button** | Platform | 3-4d | Floating button, per-class toggle, admin workflow. Doc: [bug-button.md](bug-button.md) |
| **Kahoot-Style Quizzes** | Student XP | 3-5d | Live quiz activity type. Start self-paced, add live mode later. |
| **Peer Feedback Stations** | Student XP | 3-4d | Device becomes feedback collection point (QR code). Great for design classrooms. |
| **Student Self-Help Library** | Student XP | 6-8d | Searchable micro-lessons (2-5 min). Doc: [self-help-library.md](self-help-library.md) |
| **Processing Queue / Async Jobs** | Infrastructure | 3-4d | Job queue for AI calls (generation blocks HTTP ~45s). Supabase-native or Bull/Redis. Priority levels, retry, status tracking. OS Service #8. |
| **Better Stack Uptime Monitoring** | Infrastructure | 10 min | Free tier. 2 monitors: site (HTTP 200) + `/api/health` (keyword `"ok":true`). 3-min interval. Push notifications via mobile app. Quiet hours 11pm-6am Nanjing. |

### Medium Priority Ideas

| Idea | Category | Notes |
|------|----------|-------|
| **Lesson Export (PPT/PDF/Worksheet)** | Teacher XP | Export pipeline from unit content. Design: what does a "worksheet" look like per page type? |
| **Teacher Projector/Present Mode** | Teacher XP | Clean high-contrast view for projection. Keyboard nav. Simpler than generating PPTs. |
| **Feature Flag System** | Platform | Simple `isEnabled(flag)` + DB table. Scope: global → class → user. Replaces hardcoded quarantine. PostHog also has flags. OS Service #3. ~1d. |
| **Event Bus (In-Process)** | Infrastructure | Typed publish/subscribe. Start with `events` table + polling. Smart Insights subscribes instead of re-querying. OS Service #9. ~2-3d. |
| **Unified Search** | Platform | Search across units, activities, student work — currently only knowledge chunks. Supabase FTS + pgvector. Permission-aware. OS Service #6. ~3-4d. |
| **AI Context Protocol** | AI/Architecture | Formalize prompt context envelope (user profile, activity, curriculum, constraints). Partially exists but scattered. Versioned prompt templates. OS Service #13. ~2d. |
| **Competitive Free Activities** | Marketing | Design challenges, timed sprints, design battles with peer voting. Ties into free tools funnel. |
| **Core Cards Spanning Multiple Lessons** | Architecture | Activities that span lessons (ongoing research, multi-session builds). `span` property. |
| **More Wizard Variation** | AI/Generation | 3 contextual regenerate buttons: "more hands-on" / "stronger scaffolding" / "real-world connections" |
| **Fun AI Thinking Messages** | UX Polish | Educational puns during generation ("Consulting with Bloom about taxonomy..."). Low effort, high charm. |
| **Textbook Source Flagging** | Knowledge | `source_restriction` field: unrestricted / reference_only / excluded. IP protection. |
| **AI-Generated Diagrams** | AI/Generation | Generate SVGs from concept descriptions. Pre-built templates more reliable than full AI generation. |

### Low Priority / Far Future

| Idea | Category | Notes |
|------|----------|-------|
| **Parent Weekly Updates** | Stakeholder | AI-generated summaries. Email delivery. Privacy controls. Phase 5.5+ | Doc: [parent-updates.md](parent-updates.md) |
| **Multi-Language / i18n** | Platform | Next.js i18n. Per-class language settings. 10-15 days. Post-revenue. Doc: [i18n.md](i18n.md) |
| **VEX Robotics / Engineering Layer** | Expansion | CurriculumProfile for engineering. Toggle on/off per class. |
| **Hardware Packs for Schools** | Business | Partner with suppliers, include materials lists in units. Revisit with traction. |
| **Makloom (Consumer Version)** | Expansion | Sister project. 60-70% code reusable. No teacher/class structure. Self-directed. |
| **Teacher↔Student Messaging** | Communication | 1:1 + class group messaging. Thread on work items. Moderation hooks (minors). OS Service #20. Post-pilot. |

### Parked / Not a Feature

| Item | Category | Notes |
|------|----------|-------|
| Scaffolding for different levels | Enhancement | Types built (ClassCohortContext, StudentLearningProfile), needs wiring + adaptive logic |
| Slow API calls | Performance | Audit slow endpoints. Streaming, caching, model selection, prompt length |
| Photo annotation in portfolio | Enhancement | Phase 3 annotation layer. Quick Capture already handles photo upload |
| Skeleton approach flickering | Bug | State management — keep skeletons visible until real data ready, then crossfade |
| Hesitant to bulk upload | Testing | Need confidence in pipeline consistency before bulk uploading valuable content |

---

## ✅ Complete (40 shipped features)

<details>
<summary><strong>Click to expand all completed projects</strong></summary>

### Core Platform
- **Unit Forking / Unit-as-Template Architecture** — Copy-on-write per-class content editing. Resolution chain. Version history. Migration 040.
- **Phase 0.5 Lesson Editor** — 12 components (~3,962 lines). Drag-to-reorder, split-pane, Undo/Redo, auto-save, Workshop Model phases. Doc: [uniteditor.md](uniteditor.md)
- **Unit Type Framework Architecture** — 4-dimension model (Type × Programme × Curriculum × Standards). DESIGN/SERVICE/PP/INQUIRY. Dynamic criteria. Migration 051.
- **Lesson Timing Engine** — Workshop Model enforcement. 4-phase structure. 1+age cap. PhaseTimelineBar. 8 validation rules + auto-repair. 4 presets.
- **Project Dimensions v2 (Data Architecture)** — Phases 0-4b COMPLETE. UDL 3×3 (31 checkpoints). timeWeight. bloom_level. ai_rules. Client-side activity tracking. Migrations 057/058.
- **Timetable & Scheduling System** — Rotating cycle engine (5-10 day). iCal import. LessonSchedule. TimetableGrid. Migration 038.
- **School Calendar / Term System** — Per-teacher calendar. 4 templates. Migration 037.
- **Performance Optimizations** — Parallelized generation (3 min → 45s). Tree-shaking. Code-splitting. Polling optimization. Image compression.
- **Student-Class Junction** — Multi-class enrollment. Migration 041. Junction-first + legacy-fallback pattern.

### AI & Generation
- **Admin AI Controls Redesign** — Macro dials + presets + macro/micro toggle. Config history.
- **Lesson Editor AI Assist (# Field)** — AITextField with purple # button. Context-aware suggestions.
- **Cross-Container Drag-and-Drop** — DndContext + DropZone + HTML5 DnD + Framer Motion Reorder.
- **Unit Generation Phases 0-3** — Multi-type wizard. 3-lane selector. Parallelized generation (~4x speedup).
- **Lesson Pulse Phase 1** — 3-dimension scoring (CR/SA/TC). 47 tests. Teaching Moves Library (65 moves). Context Injection.
- **Dimensions3 Spec Finalization** — v1.2. 25 issues fixed. All 9 open questions RESOLVED. Testing plan. Printable doc.

### Student Experience
- **Discovery Engine (8-Station Journey)** — ~9,500 lines. Kit mentor. Archetype scoring. Two modes. Migration 047.
- **Student Onboarding / Studio Setup** — 4-screen character creation. 3 mentors. 4 themes. Migration 050.
- **Student Dashboard Redesign** — Framework-colored cards. Smart subject detection. Multi-class support.
- **Open Studio v1** — Self-directed working. AI studio critic. 5 interaction types. 3-level drift escalation. Migration 029.
- **Student Learning Profile** — 7-system profiling. Wired into Open Studio AI. Glowing banner. Migration 048.
- **Safety Badges** — Workshop safety certification. 5 question types. Unit access gating. Migration 035.
- **Academic Integrity Monitoring** — MonitoredTextarea. 6-rule scoring. IntegrityReport with writing playback. Migrations 054/059.
- **Toolkit (27 Interactive Tools)** — SCAMPER, Six Hats, PMI, Decision Matrix, Five Whys, Empathy Map, + 21 more. All wired with useToolSession persistence. Doc: [toolkit.md](toolkit.md)
- **Toolkit Persistence** — useToolSession hook. Auto-save, session resume, state tracking.

### Teacher Experience
- **Teaching Mode (Live Cockpit)** — 3-column layout. Phase timer. Live student grid. Dark projector view. "Needs Help" detection.
- **Class Gallery & Peer Review** — Pin-up crit system. 3 review formats. Effort-gated feedback. Migration 049.
- **Smart Insights Panel** — Priority-sorted feed. 6 insight types. Server-side computation (no AI calls).
- **Unit Thumbnails (Teacher-Editable)** — Gallery picker (30 Unsplash photos) + upload. Migration 052.
- **Grading System** — Criterion scoring (MYP 1-8, GCSE 0-100%). Comments, tags, targets. IntegrityReport panel. Doc: [grading.md](grading.md)
- **NM / Melbourne Metrics Phase 1** — CompetencyPulse (student 3-point) + ObservationSnap (teacher 4-point). Pop art identity. Migrations 030/032/056. Doc: [new-metrics.md](new-metrics.md)

### Infrastructure & Operations
- **CI/CD & Monitoring (Sprints 1-2)** — GitHub Actions CI (lint + typecheck + build + tests + dashboard sync check on push/PR), nightly audit (2am Nanjing = 6pm UTC, + doc freshness + WIRING health), `/api/health` endpoint (Supabase ping, response time), Sentry fully configured (server + edge + browser + 14 API routes), Vercel env vars set, GitHub Secrets configured. Doc: [automation-build-plan.md](../automation/automation-build-plan.md)
- **Documentation Infrastructure** — CLAUDE.md slimmed (424→147 lines), decisions-log.md (182+ entries), lessons-learned.md (31+ entries), resolved-issues-archive.md, doc-manifest.yaml (~217 files, all verified), changelog.md, WIRING.yaml (92 systems, validated), wiring-dashboard.html, system-architecture-map.html, `saveme` 10-step command, `refresh-project-dashboard` scheduled task, session change detector.
- **Test Infrastructure** — Vitest 4, 17 test files, ~390 tests. Dimensions3 pipeline stage contract tests, AI output validation tests, Lesson Pulse (47 tests), Teaching Moves, timing validation, cycle engine, integrity scoring, framework vocabulary, design assistant, error handler, toolkit API. Test coverage map at `docs/testing/test-coverage-map.md`.

### Marketing & Tools
- **Landing Page** — Story-driven 5-phase journey. CSS mock visuals. Framework trust bar.
- **Design Thinking Toolkit (Public)** — 48 tools at `/toolkit`. Dark theme. Phase pills. SVG thumbnails. AI search.
- **Report Writer (Free Tool)** — Bulk report comments at `/tools/report-writer`. Multi-framework.
- **Competitive Analysis** — StudioLoom vs 5 competitors. 35 features. 3-sheet spreadsheet.
- **QA Testing Dashboard** — 65 test cases. Status buttons. localStorage persistence. JSON export/import.
- **Test Sandbox / Admin** — Framework selector. Single lesson generation. Dynamic max_tokens.

</details>

---

## ⚫ Superseded

- **Dimensions2** — Replaced by Dimensions3. Doc: [dimensions2.md](dimensions2.md) (kept for historical reference)
- **Old Own Time system** — Replaced by Open Studio v1 (Migration 029 drops old tables)
- **Comic Strip Discovery** — Replaced by 8-station Discovery Engine
- **5-mentor system** — Reduced to 3 mentors (Kit/Sage/Spark) for onboarding, Kit-only for Discovery

---

## 📚 Reference & Inspiration

These aren't features — they're design references noted during brainstorming:

- **MakeyMakey lesson flow** — UX inspiration for visually distinct steps, inline media, clear "do this next"
- **Google NotebookLM** — Study: source attribution, AI summaries, "chat with documents" UX
- **MakeMake interactive popups** — Clickable hotspots on images (relates to Phase 3 annotation layer)
- **KJS Publications Engineering Workbook** — Content structure for engineering documentation
- **Textbooks + AI relationship** — Both: textbooks as knowledge inputs, AI generates customized lessons

---

## File Map

| File | Purpose |
|------|---------|
| `docs/projects/ALL-PROJECTS.md` | **This file** — master index |
| `docs/projects/dashboard.html` | Interactive visual dashboard |
| `docs/roadmap.md` | UX philosophy, design principles, phase descriptions |
| `docs/quarantine.md` | Quarantine register (42 sealed entry points) |
| `docs/projects/*.md` | Individual project docs (deep specs) |
| `docs/specs/*.md` | Feature specifications |
| `docs/research/*.md` | Research synthesis docs |
| `docs/design-guidelines.md` | 42 design principles (feeds dashboard Guidelines tab) |
| `CLAUDE.md` | Session context (stack, architecture, decisions, lessons learned) |
