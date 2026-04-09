# StudioLoom Design Guidelines
*Auto-maintained reference. Updated on every `saveme`. Source of truth for the dashboard Guidelines tab.*

## AI & Pedagogy

### A1. Student Does the Thinking, AI Is the Coach
Never let AI give answers or generate ideas. AI asks guiding questions and redirects to concrete actions. The student's cognitive effort is the entire point.
**Source:** education-ai-patterns.md | **Status:** Documented

### A2. Phase-Aware Feedback
Match AI tone to the design thinking phase. Ideation = divergent encouragement ("more ideas, wilder, building momentum"). Evaluation = convergent analysis ("trade-offs, who does this fail for?"). Critical questions during ideation kill creative flow — this was a live bug in SCAMPER's first iteration.
**Source:** education-ai-patterns.md | **Status:** Documented

### A3. Effort-Gating Before Feedback
Assess student response quality client-side BEFORE choosing feedback strategy. Low effort gets pushed for specifics (no praise). High effort gets celebrated and challenged deeper. Uses word count + linguistic markers (reasoning words, specificity markers). Instant, deterministic, no API latency.
**Source:** education-ai-patterns.md | **Status:** Documented

### A4. Socratic Feedback: Acknowledge then Question
Every AI nudge follows [acknowledgment] then [one Socratic question], max 25 words. Reference student's SPECIFIC idea, never generic. Vary question types: "what if", "what else", "how about", "imagine if".
**Source:** education-ai-patterns.md | **Status:** Documented

### A5. Staged Cognitive Load
Prompts adapt difficulty based on idea count: 0 ideas = introductory, 1-2 = building, 3+ = advanced (challenge assumptions, trade-offs). Prevents cognitive overload.
**Source:** education-ai-patterns.md | **Status:** Documented

### A6. Per-Step AI Rules
Each tool has step/quadrant/column-specific AI rules injected into system prompts. Six Hats has hatRules+hatTone per hat, PMI has colRules+colTone per column, Five Whys has depth-detection, Empathy Map has quadRules+quadTone. AI adapts its entire personality per step. No other edtech does this.
**Source:** CLAUDE.md | **Status:** Documented

### A7. Haiku for Students, Sonnet for Generation
Haiku 4.5 for all student-facing AI (fast, cheap, 300-token cap forces Socratic brevity). Sonnet 4 for unit generation (quality). Model configurable via admin panel.
**Source:** CLAUDE.md | **Status:** Documented

### A8. 3-Pass Document Analysis
Teacher uploads: Pass 1 (Haiku) extracts structure, Pass 2 (Sonnet) analyses pedagogical moves, Pass 3 (Sonnet) extracts design teaching intelligence. Results merge into LessonProfile.
**Source:** roadmap.md | **Status:** Documented

### A9. Hybrid Search (70/20/10)
70% vector (Voyage AI) + 20% BM25 + 10% quality score. Chunks accumulate quality signals (times_retrieved, times_used, fork_count, teacher_rating). Self-improving knowledge base.
**Source:** CLAUDE.md | **Status:** Documented

### A10. Self-Healing Validation
Invalid AI output defaults gracefully rather than hard-failing. Bad responseType defaults to text. Missing durations default to 10 minutes.
**Source:** CLAUDE.md | **Status:** Documented

## Student Experience

### B1. Activity-First, Not Instructions-First
Every page leads with the prompt/activity. Scaffolding available on-demand via expandable sections, not blocking the workspace. Based on Brilliant/Codecademy patterns.
**Source:** roadmap.md | **Status:** Documented

### B2. Input-First Hierarchy
Textarea positioned immediately after step header. Prompts/scaffolding sit below as secondary support. Example is collapsible. Primary action (writing) always above the fold.
**Source:** CLAUDE.md | **Status:** Documented

### B3. Soft Gating Over Hard Blocking
Don't prevent skipping, but nudge toward better behaviour. Amber messages remind of expectations. Students CAN skip but are reminded. Respects student agency.
**Source:** education-ai-patterns.md | **Status:** Documented

### B4. Prompts Are Always Read-Only
Students cannot click prompts to auto-fill responses. They must type their own ideas. Every keystroke represents a thought.
**Source:** CLAUDE.md | **Status:** Documented

### B5. Consistent 3-Screen Architecture
All interactive tools: intro (challenge input + how-it-works) → working (step nav + input + prompts + nudge + ideas) → summary (all steps + AI synthesis + copy). Learn once, use anywhere.
**Source:** CLAUDE.md | **Status:** Documented

### B6. Micro-Feedback Loops
Instant client-side feedback on idea submission: purple glow (high effort), blue bounce (medium), amber (low). Auto-dismisses after 3 seconds. No API latency.
**Source:** education-ai-patterns.md | **Status:** Documented

### B7. Depth Dots and Thinking Meter
1-3 dots per idea card showing quality. Progress bar shows average quality per step, changes colour amber → blue → purple. Visual quality without judgmental language.
**Source:** education-ai-patterns.md | **Status:** Documented

### B8. Portfolio Builds Itself
Responses auto-flow into portfolio timeline as submitted. No separate add-to-portfolio action. Each entry carries context: page title, criterion, prompt, timestamp. Behance-style export.
**Source:** roadmap.md | **Status:** Documented

### B9. Progressive Disclosure
Show current page + next step, not full 16-page wall. Hide future phases for new students. Inspired by Duolingo (one screen = one action).
**Source:** roadmap.md | **Status:** Documented

### B10. Mobile-Native Is Non-Negotiable
Ages 11-16 use phones/tablets. Student experience must work at 375px. Quick Capture = phone camera → portfolio. Touch-optimised input.
**Source:** roadmap.md | **Status:** Documented

### B11. Phase Pills Over Collections for Filtering
Toolkit browsing uses design process phases (Discover/Define/Ideate/Prototype/Test) as the primary filter — not curated collections. Phases are universal, immediately understood by any design teacher, and map to every curriculum framework. Toggle behaviour (click to filter, click again to clear). Auto-scroll to grid on filter change.
**Source:** CLAUDE.md | **Status:** In prototype

### B12. Structural SVG Thumbnails Show Output Shape
Tool cards display inline SVG diagrams of the tool's actual output structure (mind map = radial nodes, SWOT = 4 quadrants, fishbone = spine + bones). Phase-colored. Communicates what the tool produces at a glance — better than emoji (generic), photos (don't show structure), or illustrations (expensive).
**Source:** CLAUDE.md | **Status:** In prototype

### B13. INTERACTIVE Badge for Built Tools
Tools with dedicated interactive pages get a visible "INTERACTIVE" badge. Distinguishes the 27 fully-built AI-powered tools from catalog-only entries. Sets clear user expectation before clicking.
**Source:** CLAUDE.md | **Status:** In prototype

## Teacher Experience

### C1. Flexible Page Architecture
Units store content in JSONB. Teachers choose which criteria to include. Emphasis levels: light (2 pages), standard (3), emphasis (4). Pages reorderable.
**Source:** CLAUDE.md | **Status:** Documented

### C2. Framework-Agnostic Toolkit
48 tools (27 interactive + 21 catalog) with universal phases (Discover/Define/Ideate/Prototype/Test) mapping to 8+ curricula. Any design teacher worldwide can use it. Primary free traffic engine.
**Source:** CLAUDE.md | **Status:** In code

### C3. Neutral Criterion Taxonomy (8 Universal Categories)
8 framework-agnostic assessment categories (researching, analysing, designing, creating, evaluating, reflecting, communicating, planning) map bidirectionally to all 8 supported frameworks (MYP, GCSE, A-Level, IGCSE, ACARA, PLTW, NESA, Victorian) + 4 non-design unit types. FrameworkAdapter maps neutral keys → framework-specific display labels at render time. Content is NEVER stored with framework vocabulary — framework is applied at render time only. Labels only in v1 (not tone/phrasing).
**Source:** docs/specs/neutral-criterion-taxonomy.md | **Status:** Spec complete, code pending

### C4. 20 Configurable Emphasis Dials
1-10 sliders for scaffoldingFade, critiqueCulture, safetyCulture, differentiation, etc. Admin-configurable with history. Teachers tune AI without changing code.
**Source:** ai-model-config.ts | **Status:** In code only

### C5. 3-Tier ELL Scaffolding
Sentence starters (Tier 1), guided prompts (Tier 2), extension challenges (Tier 3). Target: 50% of activities have all three tiers.
**Source:** CLAUDE.md | **Status:** Documented

### C6. Grade-Level Timing Profiles (Learned Defaults, Not Hardcoded)
Cold-start default: max direct instruction = 1 + avg student age. Year 1 (age 11) = 12 min, Year 5 (age 16) = 17 min. Dimensions3 makes this a learned default — the system observes what teachers actually do and gradually replaces the formula with real data. Any teacher can override any timing rule; overrides are learning signal.
**Source:** timing-validation.ts, docs/projects/dimensions3.md | **Status:** In code (cold-start), learning system pending

### C7. Workshop Model (4-Phase Lesson Structure)
Every AI-generated lesson MUST follow: Opening (5-10 min) → Mini-Lesson (max 1+age min) → Work Time (≥45%, ideally 60%+ of usable time) → Debrief (5-10 min, structured protocol). Work Time is ONE sustained block — never fragment into small activities. Enforced in `buildDesignTeachingContext()` and validated by `timing-validation.ts`. Research: universal across d.school, PBLWorks, ASCD, Cult of Pedagogy, Project Zero, GCSE, MYP.
**Source:** lesson-timing-research-report.md, prompts.ts | **Status:** In code

### C8. Always Use Usable Time (Never Raw Period)
The AI must never generate content for the full period length. A 60-min workshop lesson has only 41 usable minutes (after 3 min transition, 8 min setup, 8 min cleanup). `buildTimingBlock()` always constructs a `TimingContext` and deducts overhead before telling the AI how many minutes to generate.
**Source:** prompts.ts | **Status:** In code

### C9. Extensions for Early Finishers (Mandatory)
Every generated lesson includes 2-3 extension activities indexed to the current design phase: Investigation → deeper research, Ideation → creative variation (SCAMPER, constraints), Prototyping → alternative materials/scale, Evaluation → edge-case rigor. Extensions are productive deepening, not busywork.
**Source:** lesson-timing-research-report.md, prompts.ts | **Status:** In code

### C10. Structured Debrief Protocols (Non-Negotiable)
Every lesson ends with a 5-10 min structured debrief using a protocol: Quick Share (2-3 students share, teacher synthesises), I Like/I Wish/I Wonder (pair feedback), Exit Ticket (1 thing learned + 1 question), Two Stars & a Wish, Gallery Walk. Generic "reflect on what you learned" is not acceptable.
**Source:** timing-validation.ts | **Status:** In code

### C11. Server-Side Timing Validation with Auto-Repair
Don't just prompt the AI — validate the output afterward. 8 rules checked: workshop conformance, instruction cap, work time floor, debrief presence, total time match, cognitive load, extensions, checkpoints. Auto-repairs: missing phases inferred, over-cap instruction clamped, missing debrief appended with protocol, missing checkpoints added at midpoint.
**Source:** timing-validation.ts | **Status:** In code

### C12. Teacher Timing Modification (Phase Timeline Bar)
Teachers know their class better than the AI. Provide a horizontal drag-to-resize timeline bar with colored phase blocks. Lock/unlock individual phases. One-click presets: Balanced, Hands-On Heavy, Instruction Heavy, Critique Session. Post-lesson feedback (per-phase Too Short/About Right/Too Long) feeds the learned timing profile.
**Source:** PhaseTimelineBar.tsx, TimingFeedbackPrompt.tsx | **Status:** In code

### C13. Unit-as-Template Architecture (Canvas Blueprint Pattern)
Units are content templates assignable to multiple classes. Per-class configuration lives in `class_units` junction table (NM config, future: timing overrides, Open Studio settings). Inheritance chain: `class_units.config` → `units.config` → system defaults. Inspired by Canvas LMS Blueprint Courses.
**Source:** Migration 033, CLAUDE.md | **Status:** In code

### C14. NM Config at Class Level, Not Unit Level
NM (Melbourne Metrics) is a per-class pedagogical decision, not a per-unit content decision. Unit page shows WHAT classes use it. Class-unit settings page controls HOW (NM on/off, element selection, checkpoint mapping). Teacher feedback drove this — "I don't want to control it at this high level."
**Source:** User feedback 20 Mar 2026 | **Status:** In code

### C15. Assigned Classes Visibility on Unit Detail
Unit detail page shows which classes are assigned with student count, class code, NM badge, and archived state. Each card links to per-class settings. Makes unit→class relationship visible and navigable. Previously only visible via dashboard.
**Source:** User feedback 20 Mar 2026 | **Status:** In code

## Technical Patterns

### D1. Tool Use for Structured Output
Force JSON schema via tool_choice, not free-text parsing. Guarantees schema compliance or hard fails (better than silent corruption).
**Source:** CLAUDE.md | **Status:** Documented

### D2. Provider Abstraction with Fallback
Anthropic first, Groq (Llama 3.3 70B) second, Gemini Flash third. Factory pattern abstracts switching. Cost optimisation and resilience.
**Source:** CLAUDE.md | **Status:** Documented

### D3. In-Memory Rate Limiting
Sliding window per user. Design Assistant: 30/min, 200/hr. Toolkit: 50/min, 500/hr. Resets on cold start but simplest approach.
**Source:** CLAUDE.md | **Status:** Documented

### D4. Fire-and-Forget Usage Tracking
Log to ai_usage_log table async. Model, tokens, cost estimate. Does not block responses.
**Source:** CLAUDE.md | **Status:** Documented

### D5. Student Auth via Tokens
nanoid(48) with 7-day TTL. No passwords for students. HttpOnly, Secure, SameSite cookies.
**Source:** CLAUDE.md | **Status:** Documented

### D6. AES-256-GCM for BYOK Keys
Teacher API keys encrypted at rest. Proper IV randomisation, authenticated encryption.
**Source:** CLAUDE.md | **Status:** Documented

### D7. Auth Helper Pattern for Teacher Routes
Centralise common auth checks in `src/lib/auth/verify-teacher-unit.ts`: teacher owns unit, teacher owns class, get config with fallback chain. Pattern: `createServerClient` for auth only, `createAdminClient` for DB operations (bypasses RLS). Prevents auth+query duplication across routes.
**Source:** verify-teacher-unit.ts | **Status:** In code

### D8. Additive-Only Migrations
Database migrations should only add columns/tables, never modify or drop existing ones. New columns default to NULL. This allows code to be reverted independently of the migration. Migration 033 follows this pattern.
**Source:** Migration 033 design | **Status:** Documented

### D9. Student Routes Need Explicit Sub-Paths
Student unit route has no index page at `/unit/[unitId]`. Only `/narrative` and `/[pageId]` sub-routes exist. Links must always include a sub-path. Bare `/unit/${id}` causes Next.js prefetch 404s.
**Source:** Open Studio 404 bug fix | **Status:** In code

## Security & Privacy

### F1. COPPA Compliance (Ages 11-16)
No behavioural tracking via GA4. Plausible or PostHog only. Minimal telemetry. Tracking minors is legally and ethically fraught.
**Source:** CLAUDE.md | **Status:** Documented

### F2. RLS Data Isolation
Supabase Row-Level Security: students read/write own data only. Enforced at database level, not application level. Defence in depth.
**Source:** CLAUDE.md | **Status:** Documented

### F3. Silent Academic Integrity Monitoring
MonitoredTextarea captures writing behaviour silently (paste events, keystroke patterns, focus time, text snapshots). 6-rule deterministic scoring engine produces Human Confidence Score (0-100). Teachers see IntegrityReport on grading view. Students see a normal textarea — no surveillance indicators. Built 19 Mar 2026.
**Source:** MonitoredTextarea, analyze-integrity.ts, IntegrityReport | **Status:** In code (needs wiring into submission flow)

### F4. Evidence-Based Pedagogy Only
Based on Hattie HITS, Richard Paul, Bloom's taxonomy. Not learning styles pseudoscience. System grounded in research, not fads.
**Source:** CLAUDE.md | **Status:** Documented

### F5. Service Role Bypass for RLS (Pre-Launch)
API routes authenticate students server-side (session cookie → student_id lookup), then query Supabase using the service role key which bypasses RLS. RLS policies exist as a safety net for direct DB access but are not the primary auth layer. When paying customers arrive and a security audit demands it, migrate to proper RLS with auth context (pass student_id as a Supabase session variable). Decision made 19 Mar 2026.
**Source:** Migration 026 discussion | **Status:** Documented

## Engineering Discipline (added 21 Mar 2026 — Engine Overhaul)

### G1. Extract Before You Multiply
If you're about to copy-paste a function into a second file, extract it into a shared module first. The toolkit had `callHaiku()` copied 17 times across 25 routes (~3,000 wasted lines) before the Phase 2 overhaul created `src/lib/toolkit/shared-api.ts`. Same with student auth — 17 routes each implementing the same session-cookie-to-student-id lookup. The cost of extraction is 30 minutes; the cost of deduplication later is a full day.
**Source:** Engine overhaul audit, 21 Mar 2026 | **Status:** In code

### G2. Shared Auth Helpers Are Mandatory for New Routes
Every new student route MUST use `requireStudentAuth()` from `src/lib/auth/student.ts`. Every new teacher route MUST use `requireTeacherAuth()` from `src/lib/auth/verify-teacher-unit.ts`. No inline `createServerClient` + `getUser()`. No file-local `getTeacherId()` helpers. One pattern, one place.
**Source:** Engine overhaul Phase 2 | **Status:** In code

### G3. Shared Toolkit Helpers Are Mandatory for New Tools
Every new toolkit API route MUST use `validateToolkitRequest()`, `callHaiku()`, `parseToolkitJSON()`, `logToolkitUsage()`, and `toolkitErrorResponse()` from `src/lib/toolkit/`. The only unique code per route should be the prompt builders and action-specific logic. Reference implementation: `src/app/api/tools/scamper/route.ts`.
**Source:** Engine overhaul Phase 2 | **Status:** In code

### G4. Index Signatures Make Everything `unknown`
When a TypeScript interface uses `[key: string]: unknown` (like `ToolkitRequestBody`), ALL properties — even explicitly typed ones — return `unknown` at access time. You must use `as` type casts: `body.context as string`, `body.allCauses as Record<string, string[]>`. This is a TypeScript design decision, not a bug. Plan for it when designing shared request types.
**Source:** 17 TS errors after Phase 2 route rewrites | **Status:** Documented

### G5. NEVER Batch-Modify JSX Structure with Regex
Regex/sed/perl cannot safely modify JSX tag nesting. Adding `<motion.div>` by replacing `<div>` in opening tags puts closing `</motion.div>` on inner divs instead of outermost containers. Attempting to fix with more regex deletes lines containing animation attributes. This cascades into orphaned tags across ALL files. The Framer Motion disaster (18-19 Mar 2026) destroyed 23 components. Use the Edit tool for surgical, verified changes — or rewrite the full component.
**Source:** CLAUDE.md Lessons Learned #1 | **Status:** Documented

### G6. Use `tsc --noEmit` Not `createSourceFile` for Validation
`ts.createSourceFile()` only checks syntax. It misses unclosed JSX elements, mismatched opening/closing tags, and invalid attributes. Always run `npx tsc --noEmit --jsx react-jsx --skipLibCheck` for real validation. This catches what syntax-level parsing cannot.
**Source:** CLAUDE.md Lessons Learned #2 | **Status:** Documented

### G7. Client Components Cannot Import Server-Only Modules
`createAdminClient()` reads `SUPABASE_SERVICE_ROLE_KEY` — a server-only env var. Importing it in a `"use client"` component breaks the build. Keep all admin client usage in API routes and server components. This is a Next.js App Router fundamental.
**Source:** CLAUDE.md Lessons Learned #3 | **Status:** Documented

### G8. OWASP Security Headers on All Routes
`next.config.ts` must include: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (restrict camera, mic, geolocation). These are zero-cost hardening that prevent clickjacking, MIME sniffing, and unnecessary API exposure.
**Source:** Engine overhaul Phase 1 | **Status:** In code

### G9. Rate-Limit Auth Endpoints
Student login (`/api/auth/student-login`) must be rate-limited (10/min, 50/hour per IP). Auth endpoints are the #1 target for credential stuffing. This was missing until the Phase 1 overhaul.
**Source:** Engine overhaul Phase 1 | **Status:** In code

### G10. TypeScript Must Compile Clean Before Committing
Run `npx tsc --noEmit` before every commit. Zero tolerance for TS errors. The codebase had 50 errors accumulating silently before the Phase 1 overhaul — each one a potential runtime crash. CI should enforce this too.
**Source:** Engine overhaul Phase 1 (50 errors fixed) | **Status:** In code

## Generation Pipeline & Content Architecture (added 7 Apr 2026 — Dimensions3)

### H1. Framework-Neutral Units, Framework at Render Time
Both Activity Blocks AND generated units are framework-neutral. No MYP/GCSE/ACARA vocabulary stored in content_data. FrameworkAdapter maps neutral criterion keys to framework-specific display text at render time. Any teacher from any framework grabs any unit and it adapts automatically. No "conversion" step.
**Source:** docs/projects/dimensions3.md, docs/specs/neutral-criterion-taxonomy.md | **Status:** Spec complete

### H2. No Hardcoded Sequences — System Learns from Usage
ALL hardwired patterns (Workshop Model phases, skeleton templates, 1+age rule, 45% work time floor) ship as clearly-marked provisional defaults. System observes what teachers actually do (from uploads, edits, teaching patterns) and learned patterns gradually replace defaults. Any teacher can override any pattern — overrides are learning signal. Fundamental philosophical shift.
**Source:** docs/projects/dimensions3.md §4.1 | **Status:** Spec complete

### H3. Activity Blocks as First-Class Entities
Activities are independently addressable SQL entities with full Dimensions metadata (bloom_level, udl_checkpoints, grouping, time_weight, ai_rules, phase, 14 activity categories, efficacy score). NOT embedded JSONB. The generation pipeline retrieves and assembles proven blocks, only generating new activities for gaps. Efficacy scores start at 50 (neutral), move based on teacher edits (highest signal) + student completion + time accuracy.
**Source:** docs/projects/dimensions3.md §6, docs/specs/block-library-bootstrap-strategy.md | **Status:** Spec complete

### H4. FormatProfile as Pipeline Extensibility Mechanism
Format is a dimension, not a fork. Each unit type provides a FormatProfile that injects format-specific behaviour at each of the 6 pipeline stages: block relevance (boost/suppress categories), sequence hints, gap generation rules (persona, principles, forbidden patterns), connective tissue style, timing modifiers, Pulse scoring weights. Adding a new format = ~80 lines of FormatProfile + mapping tables. Zero pipeline code changes.
**Source:** docs/specs/format-profile-definitions.md | **Status:** Spec complete

### H5. Composite Block Ranking (Not Simple Search)
Block Library search uses Google-style composite scoring: Relevance 30% (embedding similarity) + Efficacy 25% (proven performance) + Context match 20% (bloom, phase, grouping) + Teacher affinity 15% (used before) + Freshness 10%. Plus overuse penalty and staleness decay. Teachers don't want to learn new tools every class — familiar blocks ranked highest, fresh options as optional suggestions.
**Source:** docs/projects/dimensions3.md §8 | **Status:** Spec complete

### H6. timeWeight Over durationMinutes
Rigid `durationMinutes: 12` doesn't work (same activity = 8 min with Year 10, 20 min with Year 7). `timeWeight: 'quick' | 'moderate' | 'extended' | 'flexible'` is the primary signal. Activities share Workshop Model phase budget proportionally. `durationMinutes` kept as optional soft suggestion. Velocity learning loop: generate → measure actual time_spent → compute class velocity → feed back.
**Source:** docs/specs/data-architecture-v2.md | **Status:** Spec complete

### H7. ai_rules on Every Activity Block
`{ phase: "divergent"|"convergent"|"neutral", tone: string, rules: string[], forbidden_words?: string[] }` on every ActivitySection. Extends per-step AI rules from toolkit tools to ANY lesson activity. Teacher can configure custom AI behavior without code.
**Source:** docs/projects/dimensions3.md §6.3 | **Status:** Spec complete

### H8. UDL Over IEP for Inclusivity Model
CAST Universal Design for Learning (3 principles × 9 guidelines × 31 checkpoints) is proactive design, not reactive accommodation. Student has "barriers on Language & Symbols (2.1)" not "has dyslexia." Activities tagged with `udl_checkpoints: string[]`. Coverage computed client-side per page.
**Source:** docs/specs/data-architecture-v2.md | **Status:** In code

## Journey Engine & Interactive Experiences (added 7 Apr 2026)

### J1. Interaction Pattern × Content × Presentation Separation
Journey Blocks are atomic interaction primitives that are character-neutral and scene-neutral. Content (prompts, options, scoring weights) separated from presentation (character, R3F scene, voice, animations). Presentation applied at Journey level, infinitely swappable — same journey delivered by different characters without content changes.
**Source:** docs/specs/journey-engine-spec.md | **Status:** Spec complete

### J2. Student Profile as Central Data Hub
`learning_profile` JSONB on students table is the single data store for all journey-collected data. Every journey block writes to a namespaced path (e.g., `strengths.archetype`). Every AI system reads relevant slices via `buildProfileContext()`. Merge strategies: overwrite (scores), append (interests), merge (skill maps), max (confidence).
**Source:** docs/specs/journey-engine-spec.md §5 | **Status:** Spec complete

### J3. Conditional Branching with Mandatory Fallbacks
Journeys support conditional routing based on profile data, block responses, or session metadata. Constrained condition language (dropdown-authorable, no code). Every conditional route MUST have a fallback path. Admin editor validates: every path reaches terminal, no cycles, no unreachable nodes.
**Source:** docs/specs/journey-engine-spec.md §4 | **Status:** Spec complete

### J4. Mentor Negotiates, Not Just Collects (Open Studio v2)
The Planning Journey uses Sonnet-level reasoning to push back on unrealistic plans, extract concrete deliverables from vague visions, and synthesize external constraints. This is fundamentally different from Discovery (which collects profile data) — the mentor is a negotiation partner. Teacher approval workflow with 4 actions (approve / notes / return / schedule chat).
**Source:** docs/projects/openstudio-v2.md | **Status:** Spec complete

### J5. Greyscale Unit + Colourful Studio Card
When Open Studio is unlocked, the original unit card goes greyscale and a new vibrant Studio card appears using the student's theme accent colour. Studio card shows project title, next milestone, health indicator, session count, mentor avatar. Greyscale card still clickable but visually secondary. Studio cards render first in grid.
**Source:** docs/projects/openstudio-v2.md §11 | **Status:** Spec complete
