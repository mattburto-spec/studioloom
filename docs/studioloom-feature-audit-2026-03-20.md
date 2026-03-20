# StudioLoom Feature Audit — 20 March 2026

**Scope:** Every feature, a testable acceptance criterion for each, and a wiring efficiency review.
**Codebase:** ~245 source files, ~62,000 LOC, 88 API routes, 51 page routes.

---

## PART 1: COMPLETE FEATURE INVENTORY + TEST CRITERIA

### A. Authentication & Session Management

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| A1 | **Student login** (class code + username → token session) | `api/auth/student-login`, middleware | Enter a valid class code + username → receive HttpOnly cookie, redirected to `/dashboard`. Enter invalid code → error message, no cookie set. |
| A2 | **Student session validation** | `api/auth/student-session` | Hit GET with valid cookie → returns student + class data. Hit with expired token (>7 days) → 401. Hit with no cookie → 401. |
| A3 | **Student logout** | `api/auth/student-session` DELETE | Call DELETE → cookie cleared, `student_sessions` row deleted, redirect to `/login`. |
| A4 | **Teacher login** (Supabase Auth) | `/teacher/login`, Supabase Auth | Email/password login → Supabase session, redirected to `/teacher/dashboard`. Wrong password → error. |
| A5 | **Admin access** (email whitelist) | middleware, admin routes | Login as `mattburto@gmail.com` → access `/admin/*`. Login as other email → 403 redirect. |
| A6 | **LTI 1.0a launch** (Canvas/Blackboard SSO) | `api/auth/lti/launch` | POST with valid LTI params + OAuth signature → auto-create/match student, set session, redirect to unit. Invalid signature → 401. |
| A7 | **Middleware route protection** | `middleware.ts` | Unauthenticated visit to `/dashboard` → redirect to `/login`. Visit to `/teacher/dashboard` without Supabase session → redirect to `/teacher/login`. Visit to `/toolkit` → no redirect (public). |

### B. Student Experience

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| B1 | **Student dashboard** | `(student)/dashboard/page.tsx` | After login, shows assigned units with progress bars, recent portfolio entries, "My Tools" section. Empty state renders correctly for new student. |
| B2 | **Unit listing with progress** | `api/student/units` | GET returns array of assigned units with `progress` percentage and `locked_page_ids`. Matches actual completion state. |
| B3 | **Unit page rendering** (activity-first, 5 page types) | `(student)/unit/[unitId]/[pageId]` | Navigate to a strand page → shows activity content. Navigate to reflection page → shows reflection prompts. Context, skill, custom pages all render correctly. |
| B4 | **10+ response types** (text, upload, voice, canvas, Decision Matrix, PMI, Pairwise, Trade-off Sliders, etc.) | `ResponseInput.tsx` | Create a page with each response type. Student sees correct input widget. Submit response → stored in DB. Re-open page → previous response loaded. |
| B5 | **Page completion tracking** | `api/student/progress` | Complete a page → GET shows page as complete. Unit progress % updates. Locked pages remain inaccessible until prerequisites complete. |
| B6 | **Portfolio auto-pipeline** | `api/student/portfolio` | Submit a response → automatically appears in portfolio timeline. Add photo/link via Quick Capture → appears in portfolio. |
| B7 | **Quick Capture Bar** (notes, photos, links) | Portfolio API + UI component | Click Quick Capture → modal for note/photo/link. Submit → stored as portfolio entry with timestamp. |
| B8 | **Planning/Gantt view** (student task tracker) | `api/student/planning` | Open planning view → see tasks in kanban columns. Add task → appears. Log time → time recorded. |
| B9 | **Own-Time self-directed learning** | `api/student/own-time/status`, `api/teacher/own-time/approve` | Student requests own-time → status = pending. Teacher approves → student sees own-time card on dashboard. |
| B10 | **Student avatar** | `api/student/avatar` | Upload avatar → GET returns URL. Avatar displays on dashboard + comments. |
| B11 | **File upload** | `api/student/upload` | Upload image → returns URL. File accessible. Size limit enforced. |
| B12 | **Narrative/portfolio view** | `(student)/unit/[unitId]/narrative` | Navigate to narrative → see timeline of responses + reflections in Behance-style layout. |
| B13 | **Dark-to-colour lesson hero gradients** | Unit page header | Open a lesson page → hero section uses dark-to-criterion-colour gradient (A=indigo, B=emerald, C=amber, D=violet). |

### C. Design Assistant (Socratic Mentor)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| C1 | **Conversation creation** | `api/student/design-assistant` POST | Send first message → new `conversationId` returned. Response uses Haiku 4.5. |
| C2 | **Socratic questioning** (Bloom's-adaptive, 6 question types) | design-assistant-prompt.ts | Ask "what should I make?" → assistant asks clarifying questions, doesn't give answers. Tracks Bloom's level. |
| C3 | **300-token response cap** | API route | No response exceeds 300 tokens. Oversize responses flagged in usage metadata. |
| C4 | **3-strike effort-gating** | Prompt logic | Give 3 low-effort responses → assistant pushes harder for specifics, doesn't just praise. |
| C5 | **Conversation history** | `api/student/design-assistant` GET | Load previous conversation → all messages present. Context-aware follow-ups work. |
| C6 | **Rate limiting** (30/min, 200/hr) | rate-limit.ts | Send 31 messages in 60s → 429 response on 31st. Wait 60s → allowed again. |
| C7 | **Design Teaching Intelligence in prompt** | design-assistant-prompt.ts | Check system prompt includes non-linear design cycle, iteration encouragement, critique protocols. |
| C8 | **Student token auth** (not Supabase Auth) | Route auth check | Confirm route reads `SESSION_COOKIE_NAME` cookie, NOT `supabase.auth.getUser()`. |
| C9 | **Usage tracking** | usage-tracking.ts | After conversation → `ai_usage_log` row with model, tokens, cost estimate, endpoint. |
| C10 | **Sentry error tracking** | Route error handler | Trigger an error → Sentry captures it with context. |

### D. AI Unit Builder Wizard (Teacher)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| D1 | **7-step conversational wizard** | `/teacher/units/[unitId]/build` | Walk through all 7 steps → each collects correct data. Back/forward navigation preserves state. |
| D2 | **AI auto-suggest wizard values** | `api/teacher/wizard-suggest` | Click auto-suggest → AI fills in reasonable defaults based on topic + grade. Uses Sonnet. |
| D3 | **AI auto-config from LMS** | `api/teacher/wizard-autoconfig` | With LMS connected → auto-fill from class data (student count, subject, etc.). |
| D4 | **Generate approach outlines** (3 options) | `api/teacher/generate-outlines` | Submit wizard data → receive 3 distinct approach outlines. Each has summary + page list. |
| D5 | **Generate pages for criterion** | `api/teacher/generate-unit` | Select an outline + criterion → receive full lesson pages with sections, scaffolding, response types, ELL tiers. |
| D6 | **Streaming generation** (SSE) | generate-unit with `stream=true` | Set `stream=true` → receive Server-Sent Events. Content appears progressively. |
| D7 | **20 configurable emphasis dials** | Wizard UI + prompts.ts | Change emphasis values → generated content reflects changes (e.g., high scaffolding = more guided prompts). |
| D8 | **Framework-aware vocabulary** (IB MYP, GCSE DT, ACARA, PLTW, A-Level, IGCSE) | prompts.ts | Select GCSE DT framework → generated content uses GCSE command verbs and assessment language, not MYP. |
| D9 | **Grade-level timing profiles** | prompts.ts, timing profiles | Year 7 vs Year 12 → different cognitive load caps, instruction time limits, activity durations. |
| D10 | **3-tier ELL scaffolding** | Generated content | Check generated pages include sentence starters (Tier 1), guided prompts (Tier 2), extension challenges (Tier 3). |
| D11 | **Regenerate single page** | `api/teacher/regenerate-page` | Click regenerate on one page → only that page regenerated, others preserved. Includes timing validation. |
| D12 | **Self-healing validation** | validation.ts | Feed malformed AI output → gracefully defaults missing fields instead of crashing. |

### E. Workshop Model & Lesson Timing Engine

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| E1 | **4-phase Workshop Model** (Opening → Mini-Lesson → Work Time → Debrief) | prompts.ts, timing-validation.ts | Every generated lesson has `workshopPhases` with all 4 phases. No phase is missing. |
| E2 | **1+age instruction cap** | `maxInstructionMinutes()` | Year 7 (age 12) → max 13 min instruction. Year 10 (age 15) → max 16 min. Validated server-side. |
| E3 | **Usable time calculation** (never raw period) | `buildTimingBlock()` | 60-min period → usable time = 60 - transitions - setup. AI generates for usable time, not 60. |
| E4 | **Work Time floor (≥45%)** | timing-validation.ts | If AI generates work time < 45% of usable → auto-repaired to meet floor. |
| E5 | **Extensions mandatory** (2-3 per lesson) | Schema + validation | Every generated lesson includes 2-3 extensions with title, description, duration, designPhase. |
| E6 | **Server-side auto-repair** (8 rules) | `validateLessonTiming()` | Feed a lesson with missing debrief → auto-repair adds debrief. Over-cap instruction → redistributed. |
| E7 | **4 timing presets** (Balanced, Hands-On, Instruction, Critique) | `applyTimingPreset()` | Apply "Hands-On Heavy" preset → work time increases, instruction decreases. Totals still match. |
| E8 | **PhaseTimelineBar** (drag-to-resize) | `PhaseTimelineBar.tsx` | Drag phase boundary → durations redistribute. Lock a phase → it doesn't move during resize. Presets apply. |
| E9 | **MiniPhaseBar** (read-only) | Unit detail page | View a unit page → see compact Workshop Model timing bar with coloured phases. |
| E10 | **TimingFeedbackPrompt** (post-lesson) | `TimingFeedbackPrompt.tsx` | After teaching → rate each phase (Too Short/About Right/Too Long), log actual duration. |
| E11 | **Timing validation wired to generation routes** | generate-unit, generate-journey, regenerate-page, test-lesson | Check each route returns `timingValidation` in response with issues/stats. |

### F. Knowledge Base & RAG Pipeline

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| F1 | **PDF/DOCX/PPTX upload** | `api/teacher/knowledge/upload` | Upload a PDF → returns chunk count + lesson profile count. File processed without error. |
| F2 | **3-pass AI analysis** (Structure → Pedagogy → Design Teaching) | `analyse.ts` | After upload → LessonProfile has structureAnalysis (Pass 1), pedagogyAnalysis (Pass 2), designTeachingAnalysis (Pass 3). |
| F3 | **Pass 0 source classification** | `analyse.ts` | Upload a rubric → classified as "rubric" type → routed to rubric-specific analysis pipeline. Upload a lesson plan → classified as "lesson_plan". |
| F4 | **5 type-specific analysis pipelines** | `analysis-prompts.ts` | Rubric upload → rubric pipeline extracts criteria + levels. Safety doc → safety pipeline. Exemplar → exemplar pipeline. Content → content pipeline. Lightweight → quick analysis. |
| F5 | **Hybrid search** (70% vector + 20% BM25 + 10% quality) | RAG retrieval functions | Search "sustainability project" → results ranked by hybrid score. Vector similarity + text match + quality weight. |
| F6 | **Voyage AI embeddings** (1024-dim) | Embedding generation | Upload content → embeddings generated via Voyage AI. Stored in pgvector column. |
| F7 | **Knowledge item CRUD** | `api/teacher/knowledge/items/*` | Create, read, update, delete knowledge items. Linked curricula persist. Tags work. |
| F8 | **LessonProfile viewer** | `api/teacher/knowledge/lesson-profiles/[id]` | View a LessonProfile → see all 3 passes of analysis. Re-analyse button triggers fresh analysis. |
| F9 | **RAG quality feedback** | `api/teacher/knowledge/feedback` | Rate a chunk as useful/not useful → feedback stored. Aggregate endpoint shows quality trends. |
| F10 | **Knowledge ingestion from units** | `api/teacher/knowledge/ingest` | Save a unit → call ingest → unit content added to knowledge base for future retrieval. |
| F11 | **3-pass analysis viewer** | `LessonProfileReview` component | Open a LessonProfile → expandable viewer shows all 3 analysis passes with formatted output. |

### G. Teacher Dashboard & Class Management

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| G1 | **Class overview** | `api/teacher/dashboard` | Dashboard shows class list, student count, active units. |
| G2 | **Progress tracking** | Dashboard + progress data | See per-student progress bars across units. Drill into individual student. |
| G3 | **Grading with rubric-based criterion scores** | `api/teacher/assessments`, `/teacher/grading` | Open grading view → see student submissions. Score by criterion (A-D). Scores persist. |
| G4 | **LMS integration** (Canvas, Blackboard, Google Classroom) | `api/teacher/integrations/*` | Connect Canvas → classes import. Sync students → student list matches LMS. |
| G5 | **Teacher profile & settings** | `api/teacher/profile` | Update name, school, preferences → persists. AI API key stored securely (AES-256-GCM). |
| G6 | **AI generation settings** | `api/teacher/ai-settings` | Change model selection, emphasis dials → next generation uses new settings. |
| G7 | **Unit publishing & browsing** | `api/teacher/units` | Publish a unit → appears in browse. Fork a unit → creates copy in your account. Search/filter works. |
| G8 | **Unit thumbnail upload** | `api/teacher/upload-unit-image` | Upload image → displays as unit card thumbnail. |
| G9 | **TeachingDNA visualization** | `TeachingDNA` component on dashboard | Dashboard shows radar chart with 6 archetypes, confidence meter. Updates as teacher creates content. |
| G10 | **Teacher toolkit page** | `/teacher/toolkit` | Navigate → see all 42 tools with deploy mode selector (Present/Print/Group/Solo). |

### H. Teacher Style Learning & AI Intelligence

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| H1 | **Teacher style profile** (passive signal collection) | `profile-service.ts`, migration 027 | Create a unit → profile signals updated (topics, scaffolding preferences, timing patterns). |
| H2 | **Style profile injected into generation** | `prompts.ts` | Teacher with high confidence profile → generation prompts include style preferences. Cold-start teacher → defaults only. |
| H3 | **Design Teaching Corpus** (Layer 1) | `buildDesignTeachingContext()` | Check all generation prompts include corpus context (non-linear design cycle, workshop management, etc.). |
| H4 | **4-layer knowledge system** | Architecture docs + prompts | Layer 1 (universal corpus) → Layer 2 (framework-specific vocab) → Layer 3 (school norms from uploads) → Layer 4 (teacher style). Each overrides when data exists. |

### I. Interactive Toolkit Tools (13 tools)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| I1 | **SCAMPER** (7-step ideation) | `/toolkit/scamper`, `api/tools/scamper` | Enter challenge → work through 7 SCAMPER steps → each step accepts ideas → AI provides effort-gated feedback → summary shows all ideas + AI insights. |
| I2 | **Six Thinking Hats** (6-hat analysis) | `/toolkit/six-thinking-hats`, `api/tools/six-hats` | Enter challenge → cycle through 6 hats → each hat has unique AI tone (White=facts, Red=emotions, Black=critique, Yellow=optimism, Green=creative, Blue=process) → summary shows cross-hat insights. |
| I3 | **PMI Chart** (Plus/Minus/Interesting) | `/toolkit/pmi-chart`, `api/tools/pmi` | Enter topic → add Plus/Minus/Interesting items → AI feedback per column → "Interesting" column pushes for genuinely ambiguous observations. |
| I4 | **Five Whys** (root cause) | `/toolkit/five-whys`, `api/tools/five-whys` | Enter problem → 5 levels of "Why?" → AI detects sideways vs deeper answers → summary shows causal chain + root cause. |
| I5 | **Empathy Map** (Says/Thinks/Does/Feels) | `/toolkit/empathy-map`, `api/tools/empathy-map` | Enter persona → fill 4 quadrants → Says pushes for exact quotes, Feels pushes for contradictory emotions → summary shows 2×2 grid. |
| I6 | **Decision Matrix** (criteria scoring) | `/toolkit/decision-matrix`, `api/tools/decision-matrix` | Define options + criteria → score each cell with reasoning → AI challenges reasoning quality → summary ranks options. |
| I7 | **How Might We** (problem reframing) | `/toolkit/how-might-we`, `api/tools/hmw` | Enter problem → structured reframing with AI coaching → generates HMW statements. |
| I8 | **Reverse Brainstorm** (bad ideas → solutions) | `/toolkit/reverse-brainstorm`, `api/tools/reverse-brainstorm` | Enter challenge → brainstorm bad ideas → flip each into a solution → AI helps with the flip. |
| I9 | **SWOT Analysis** (2×2 grid) | `/toolkit/swot-analysis`, `api/tools/swot` | Enter topic → fill S/W/O/T quadrants → per-quadrant AI rules → summary shows strategic insights. |
| I10 | **Stakeholder Map** (3-step discover) | `/toolkit/stakeholder-map`, `api/tools/stakeholder-map` | Enter project → list stakeholders → categorise → understand needs → AI guides prioritisation. |
| I11 | **Lotus Diagram** (ideation) | `/toolkit/lotus-diagram`, `api/tools/lotus-diagram` | Enter central theme → expand into 8 sub-themes → expand each → AI supports divergent thinking. |
| I12 | **Affinity Diagram** (analysis) | `/toolkit/affinity-diagram`, `api/tools/affinity-diagram` | Enter data/notes → group into themes → AI suggests groupings → summary shows themed clusters. |
| I13 | **Morphological Chart** (ideation) | `/toolkit/morphological-chart`, `api/tools/morphological-chart` | Define parameters → list options per parameter → AI helps combine → summary shows combinations. |

**Cross-cutting tests for ALL 13 tools:**

| Test | What to Check |
|------|---------------|
| **3-screen flow** | Every tool has intro → working → summary. No broken transitions. |
| **Effort-gating** | Low-effort response (1-2 words) → AI pushes for specifics. High-effort → AI celebrates + challenges deeper. |
| **Soft gating** | Prompts hidden until first idea written. Then slide in. |
| **Micro-feedback** | After submitting idea → instant toast (purple glow for high effort, blue for medium, amber for low). Auto-dismisses 3s. |
| **Prompts are read-only** | Student can never click a prompt to auto-fill. Must type own ideas. |
| **Phase-aware feedback** | Ideation tools → divergent encouragement. Evaluation tools → convergent analysis. |
| **Rate limiting** | 50 req/min, 500 req/hour per session. 51st request in 60s → 429. |
| **No auth required** | All `/toolkit/*` routes accessible without login. |

### J. Toolkit Catalog & Browser

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| J1 | **42-tool catalog** | `/toolkit/page.tsx`, `tools-data.ts` | Open `/toolkit` → 42 tool cards visible. All have name, description, phase, type, deploy mode, difficulty, time estimate. |
| J2 | **Multi-factor filtering** | Toolkit page | Filter by phase (Discover/Define/Ideate/Prototype/Test) → correct tools shown. Filter by type → correct. Combine filters → intersection works. |
| J3 | **Search with synonym matching** | Toolkit page | Search "brainstorm" → finds SCAMPER, Reverse Brainstorm, Brainstorm Web, etc. `/` keyboard shortcut focuses search. |
| J4 | **4 deploy modes** (Present/Print/Group/Solo) | Toolkit cards | Hover card → deploy overlay shows available modes. Each tool has at least 1 mode. |
| J5 | **3D perspective tilt on hover** | Toolkit cards | Hover a card → subtle 3D tilt effect. Deploy overlay slides up. |
| J6 | **Dark theme with aurora gradient** | `/toolkit/layout.tsx` | Toolkit pages use dark theme with aurora gradient hero. Doesn't leak into other routes. |
| J7 | **Custom SVG illustrations** | Toolkit cards | Each tool card has a unique SVG illustration. Not generic icons. |
| J8 | **Difficulty badges** | Toolkit cards | Cards show beginner/intermediate/advanced badges. |

### K. Free Tools (Public)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| K1 | **Report Writer** (bulk comment generator) | `/tools/report-writer`, `api/tools/report-writer` | Add students with ratings → generate → receive per-student report comments. Bulk (up to 10) works. |
| K2 | **Multi-framework support** (General D&T, IB MYP, GCSE DT, ACARA) | Report Writer | Select GCSE DT → rating categories change to GCSE-specific. Comments use correct terminology. |
| K3 | **Per-student skill ratings** (1-5 sliders) | Report Writer UI | Slide ratings → natural language conversion in generated comments. |
| K4 | **Multi-project input** (up to 4) | Report Writer UI | Add 3 projects → blue-tinted columns appear. Comments reference specific projects. |
| K5 | **Tone/length/pronoun controls** | Report Writer | Set formal + 150 words + they/them → comments match all 3 settings. |
| K6 | **Email-based rate limiting** (20/month) | Report Writer API | Use 20 times → 21st blocked with message. Different email → allowed. |
| K7 | **Excel/CSV upload for student data** | Report Writer | Upload Excel with student names + subjects → auto-populates form. |
| K8 | **Marking Comment Creator** | `/tools/marking-comment-creator` | Enter student work context → generates marking comments. |
| K9 | **Extract Rubric** | `api/tools/extract-rubric` | Upload rubric document → extracts criteria + levels as structured data. |

### L. Student Toolkit Access (Persistence Layer)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| L1 | **Lazy session creation** | `useToolSession.ts` | Open a tool → no DB write. Type first idea → session created (check DB). |
| L2 | **Debounced auto-save** (500ms) | `useToolSession.ts` | Type rapidly → only 1 save per 500ms window. State persists across page refresh. |
| L3 | **Session resumption** | Tool sessions API | Close browser → reopen tool → previous state loaded. Ideas, step, everything restored. |
| L4 | **Embedded mode** (teacher assigns on unit page) | Spec + components | Teacher assigns SCAMPER to a unit page → student sees it embedded. Completion saves as response. |
| L5 | **Standalone mode** (from floating launcher) | QuickToolFAB + ToolModal | Student opens launcher → selects tool → works in modal. Saves independently. |
| L6 | **Version history** (v1, v2, v3) | Tool sessions API PATCH | Complete a session → start fresh on same tool → creates v2. Both versions visible. |
| L7 | **Save status indicator** | `useToolSession.ts` | See "Saving..." → "Saved" → idle. Error state shows if save fails. |

### M. Academic Integrity System

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| M1 | **MonitoredTextarea** (silent tracking) | `MonitoredTextarea.tsx` | Replace a textarea → tracks paste events, keystrokes, deletion count, focus time, tab switches. ZERO visible indicators to student. |
| M2 | **Text snapshots** (30-second intervals) | MonitoredTextarea | Write for 2 minutes → check metadata has 4+ snapshots showing text evolution. |
| M3 | **Word count history** (10-second intervals) | MonitoredTextarea | Write for 1 minute → check metadata has 6+ word count data points. |
| M4 | **6-rule integrity scoring** | `analyze-integrity.ts` | Paste entire essay → Human Confidence Score drops low (<40). Type naturally → score high (>70). |
| M5 | **IntegrityReport viewer** (teacher-facing) | `IntegrityReport.tsx` | Open report → see score badge (green/amber/red), activity metrics, severity-flagged alerts, writing playback slider, paste log. |
| M6 | **Writing playback** (scrub through snapshots) | IntegrityReport | Drag slider → see text evolve over time. Shows exactly when big pastes happened. |

### N. Admin Panel

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| N1 | **AI model selection** | `api/admin/ai-model` | Change model → next generation uses new model. Config persists. |
| N2 | **50+ emphasis dials** | Admin AI model page | Adjust dials → config saved. Generation reflects changes. |
| N3 | **Macro dials** (5 camera-style SVG) | Admin controls page | 5 big dials: Teaching Style, Theory:Practical, Scaffolding, Lesson Pace, Critique. Map to micro sliders. |
| N4 | **Macro/micro toggle** | Admin controls | Toggle to micro → see all 50+ sliders. Toggle to macro → see 5 big dials. |
| N5 | **6 presets** | Admin controls | Click a preset → all dials jump to preset values. |
| N6 | **Test sandbox — skeleton** | `api/admin/ai-model/test` | Generate skeleton → see unit structure without full content. Quick validation of settings. |
| N7 | **Test sandbox — single lesson** | `api/admin/ai-model/test-lesson` | Generate one lesson → see full content with sections, scaffolding, response types, ELL tiers, workshopPhases, extensions, timing validation. |
| N8 | **Framework selector in sandbox** | Test sandbox UI | Select different framework → criteria toggles update. Generation uses correct vocabulary. |
| N9 | **Config history** | Admin AI model | View previous configurations. Rollback if needed. |

### O. Infrastructure & Cross-Cutting

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| O1 | **Rate limiting** (in-memory sliding window) | `rate-limit.ts` | Hit rate limit → 429 with `retryAfterMs`. Different endpoints have different limits. Resets on server restart. |
| O2 | **AI usage tracking** | `usage-tracking.ts`, migration 025 | After any AI call → check `ai_usage_log` has row with model, tokens, cost, endpoint. Fire-and-forget (doesn't block response). |
| O3 | **Sentry error tracking** | `sentry.*.config.ts`, instrumentation files | Trigger error → Sentry captures with stack trace + context. Global error boundary catches React errors. |
| O4 | **AES-256-GCM key encryption** (BYOK) | Security implementation | Store API key → encrypted at rest. Retrieve → decrypted correctly. Raw key never in logs. |
| O5 | **RLS policies** | Supabase migrations | Student can only see own data. Teacher can only see own class data. Cross-tenant access blocked. |
| O6 | **Response length heuristics** | Design assistant route | AI response > 1200 chars → flagged in usage metadata as oversized. |
| O7 | **Text-to-speech** | `api/tts` | POST with text → returns audio. Accessibility feature. |
| O8 | **Vitest test suite** | `__tests__/` directories | `npm run test` → 38+ tests pass (prompt snapshots, framework vocab, timing profiles, integrity analysis). |

### P. Landing Page & Navigation

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| P1 | **Landing page** | `/page.tsx` | Load `/` → see hero, features, toolkit showcase, CTAs. |
| P2 | **"Free Toolkit" nav link** | Landing page nav | Click "Free Toolkit" → navigates to `/toolkit`. |
| P3 | **Dark toolkit showcase section** | Landing page | See 6 preview SVG cards with dark theme. CTA button links to `/toolkit`. |
| P4 | **QuickToolFAB fan menu** | `QuickToolFAB.tsx` | Click FAB → 5 phase pills fan upward (spring animation). Click phase → tools slide out horizontally. Framer Motion animations smooth. |

### Q. Activity Cards (Lesson Building Blocks)

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| Q1 | **Browse activity card library** | `api/teacher/activity-cards` GET | Returns curated list of activity templates. |
| Q2 | **Create custom activity card** | `api/teacher/activity-cards` POST | Create card with title, description, type → persists. |
| Q3 | **AI activity recommendations** | `api/teacher/activity-cards/recommend` | Describe lesson context → AI suggests relevant activities. |
| Q4 | **Generate modifiers** | `api/teacher/activity-cards/generate-modifiers` | Select activity → AI generates adaptations for different contexts (ELL, advanced, etc.). |
| Q5 | **Apply card to lesson** | `api/teacher/activity-cards/apply` | Apply activity card to a lesson → card content integrated into lesson structure. |

### R. Journey & Timeline Generation

| # | Feature | Files | Test to Confirm It Works |
|---|---------|-------|--------------------------|
| R1 | **Multi-lesson journey generation** | `api/teacher/generate-journey` | Input topic + duration → receive multi-lesson plan with timing validation per lesson. |
| R2 | **Journey outline generation** | `api/teacher/generate-journey-outlines` | Get 3 approach outlines before committing to full generation. |
| R3 | **Timeline generation** (flat activities) | `api/teacher/generate-timeline` | Generate activity-level timeline → flat list of activities with durations. |
| R4 | **Timeline skeleton** | `api/teacher/generate-timeline-skeleton` | Generate structure-only skeleton for quick preview. |
| R5 | **Timeline view** | `/teacher/timeline/[unitId]` | See Gantt-style activity view with lesson distribution. |

---

## PART 2: WIRING EFFICIENCY AUDIT

### CRITICAL FINDING 1: Massive Route Boilerplate Duplication (~300-400 lines)

**Problem:** 10+ generation routes all duplicate the same auth + provider setup pattern:
```
createSupabaseServer() → auth.getUser() → resolveCredentials() → createAIProvider()
```

**Affected routes:** generate-unit, generate-journey, generate-timeline, generate-timeline-skeleton, generate-outlines, generate-journey-outlines, generate-timeline-outline-single, regenerate-page, test-lesson, test

**Fix:** Extract to `src/lib/ai/route-middleware.ts`:
```typescript
export async function withAuthAI(request, handler) {
  // Auth, credential resolution, provider creation — ONE place
}
```

**Impact:** Removes ~30 lines per route × 10 routes = ~300 lines. Every future route gets auth for free.

---

### CRITICAL FINDING 2: `getStudentId()` and `getTeacherId()` Duplicated in 27+ Routes

**Problem:** The student auth pattern (read cookie → query `student_sessions` → return `student_id`) is copy-pasted into 7+ student routes. The teacher auth pattern (`supabase.auth.getUser()`) is copy-pasted into 20+ teacher routes.

**Fix:** Extract to `src/lib/auth/student-auth.ts` and `src/lib/auth/teacher-auth.ts`.

**Impact:** Any auth logic change (e.g., session expiry rules) currently requires editing 27+ files.

---

### CRITICAL FINDING 3: Toolkit API Routes — 47% Code Duplication

**Problem:** 17 toolkit API routes (SCAMPER, Six Hats, PMI, etc.) all contain:
- Identical `callHaiku()` function (30 lines × 17 = 510 wasted lines)
- Identical rate limiting setup
- Identical JSON parsing with fallback
- Identical usage logging
- Identical error handling

**Current:** ~6,158 total lines across 17 route files, with ~2,890 lines of identical boilerplate.

**Fix:** Create `src/lib/tools/toolkit-ai.ts`:
```typescript
export function callHaiku(systemPrompt, userPrompt) { ... }
export function createToolkitRouteHandler(config) { ... }
```

**Impact:** Each route shrinks to ~100-150 lines of tool-specific logic only.

---

### CRITICAL FINDING 4: Toolkit Frontend Components — 23% Code Duplication

**Problem:** 28 toolkit component files duplicate:
- 3-screen state machine (intro → working → summary): 80 lines × 28
- Effort assessment logic: 10 lines × 28
- Micro-feedback toast: 40 lines × 28
- AI fetch wrapper: 50 lines × 28
- Auto-save logic: 8 lines × 28

**Current:** ~25,000 total lines, ~5,888 duplicated.

**Fix:** Extract hooks:
- `useToolStages()` — 3-screen state machine
- `useToolAI()` — AI fetch + loading/error
- `useMicroFeedback()` — toast with effort-based styling
- `useEffortAssessment()` — word count + linguistic markers

**Impact:** Each component shrinks to 200-400 lines of tool-specific logic.

---

### CRITICAL FINDING 5: 10+ System Prompts That Should Be 1 Factory

**Problem:** `prompts.ts` has 10+ near-identical system prompts (UNIT_SYSTEM_PROMPT, OUTLINE_SYSTEM_PROMPT, JOURNEY_SYSTEM_PROMPT, etc.) that share 80% of their content (Workshop Model, timing constraints, scaffold rules) but aren't composable.

**Fix:** Create `buildSystemPrompt(options)` factory:
```typescript
const prompt = buildSystemPrompt({
  role: "curriculum-designer",
  outputFormat: "full-pages",
  mode: "journey-based",
  includeTimingBlock: true,
  includeWorkshopModel: true,
});
```

**Impact:** Adding a new generation mode goes from "copy 200-line prompt and modify" to "call factory with different options."

---

### CRITICAL FINDING 6: RAG Retrieval Inconsistency

**Problem:** 5 different `buildRAG*()` functions exist (CriterionPrompt, JourneyPrompt, TimelinePrompt, PerLessonPrompt, SkeletonPrompt), plus `regenerate-page` does inline retrieval without using any of them. No unified pipeline.

**Fix:** Create unified RAG pipeline that all routes call, with mode-specific retrieval strategies.

---

### CRITICAL FINDING 7: Inconsistent Supabase Client Instantiation

**Problem:** Routes use 3 different patterns for creating Supabase clients:
1. Inline `createServerClient(...)` with manual cookie handling
2. Shared `createServerSupabaseClient()` helper
3. `createAdminClient()` for server-only operations

Some routes use pattern 1 when they should use pattern 2.

**Fix:** Standardise all routes to use the 3 factory functions in `src/lib/supabase/`.

---

### CRITICAL FINDING 8: `VALID_RESPONSE_TYPES` Defined in Two Places

**Problem:** Response type list exists in both `validation.ts` and `types/index.ts`. Adding a new response type requires updating both.

**Fix:** Single source of truth — define in `types/index.ts`, import in `validation.ts`.

---

### CRITICAL FINDING 9: Timeline Mode Is Architecturally Different But Not Isolated

**Problem:** Timeline generates flat activities (not workshop-phased lessons). It has its own validation (`validateTimelineActivities`), its own quality evaluator, and doesn't use timing blocks. But it shares the same route patterns as lesson generation, creating confusion.

**Fix:** Either formally separate Timeline as a different paradigm with its own utilities, or add timing validation for activities too.

---

### CRITICAL FINDING 10: Dead Wiring / Incomplete Features

| Item | Status | Issue |
|------|--------|-------|
| Admin controls save button | NOT WIRED | `// TODO: wire to API` in code |
| Own Time navigation | NOT WIRED | `// TODO: Navigate to Own Time workspace` |
| Admin test-lesson model | HARDCODED | Uses `claude-sonnet-4-20250514` instead of config |
| TimingFeedbackPrompt | BUILT, NOT MOUNTED | No trigger mechanism (needs "I taught this" button) |
| Post-lesson → teacher profile learning | NOT BUILT | Stores feedback but doesn't compute adjustment factors |
| useToolSession hook | BUILT, NOT WIRED | Not connected to any toolkit tool component yet |
| Migrations 025, 028 | NOT APPLIED | Usage tracking + student tool sessions tables don't exist in DB |
| MonitoredTextarea | BUILT, NOT WIRED | Not integrated into student submission flow |
| IntegrityReport | BUILT, NOT WIRED | Not mounted in teacher grading view |
| Streaming fallback | MISSING | If streaming requested but provider fails, no fallback to non-streaming |

---

### FINDING 11: Test Coverage — 2%

6 test files covering 38 tests across ~62,000 LOC. Critical gaps:
- Zero API route tests
- Zero end-to-end flow tests
- Zero auth flow tests
- Zero toolkit tool tests
- Only: prompt snapshots, framework vocabulary, timing profiles, integrity analysis

---

## PART 3: REFACTORING PRIORITY MATRIX

| Priority | What | Effort | Lines Saved | Risk |
|----------|------|--------|-------------|------|
| **P0** | Extract `getStudentId`/`getTeacherId` to shared auth utils | 2 hours | ~200 | Very low |
| **P0** | Extract `callHaiku()` + rate limiting to `toolkit-ai.ts` | 3 hours | ~2,890 | Very low |
| **P1** | Extract route middleware (`withAuthAI`) | 4 hours | ~300 | Low |
| **P1** | Extract toolkit frontend hooks (5-6 hooks) | 2-3 days | ~5,888 | Medium |
| **P1** | Fix admin test-lesson hardcoded model | 10 min | 0 | Very low |
| **P2** | System prompt factory | 2-3 days | ~500 | Medium |
| **P2** | Unified RAG pipeline | 2-3 days | ~200 | Medium |
| **P2** | Standardise Supabase client usage | 2 hours | ~100 | Low |
| **P3** | Wire dead features (MonitoredTextarea, IntegrityReport, TimingFeedback, useToolSession) | 3-5 days | N/A | Medium |
| **P3** | Apply pending migrations (025, 028) | 30 min | N/A | Low |
| **P3** | Add API route smoke tests | 3-5 days | N/A | Low |

**Total refactoring estimate:** ~2-3 weeks for P0+P1+P2
**Lines of code removable:** ~10,000 (16% of codebase)
**Future tool build time:** 2-3× faster after extraction

---

## PART 4: ARCHITECTURE DIAGRAM (Current Wiring)

```
STUDENT                          TEACHER                           ADMIN
  │                                │                                │
  ├─ Token Auth ──────┐            ├─ Supabase Auth ──────┐         ├─ Supabase Auth + Whitelist
  │                   │            │                      │         │
  ├─ Dashboard        │            ├─ Dashboard           │         ├─ AI Model Config
  ├─ Unit Pages       │            ├─ Unit Builder Wizard │         ├─ Test Sandbox
  ├─ Design Assistant─┼─► Haiku    ├─ Knowledge Base      │         └─ Controls (macro/micro)
  ├─ Toolkit Tools    │   4.5      ├─ Grading             │
  ├─ Portfolio        │            ├─ LMS Integration     │
  ├─ Planning View    │            ├─ Toolkit (teacher)   │
  └─ Tool Sessions ───┘            └─ Timeline View       │
                                                          │
                              ┌────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Generation Engine  │
                    │                    │
                    │  prompts.ts        │   ◄── 10+ system prompts (SHOULD BE 1 FACTORY)
                    │  anthropic.ts      │   ◄── AI provider abstraction
                    │  schemas.ts        │   ◄── Tool use schemas
                    │  validation.ts     │   ◄── Self-healing validation
                    │  timing-validation │   ◄── Workshop Model enforcement
                    └────────┬───────────┘
                             │
                    ┌────────▼───────────┐
                    │   Knowledge Base    │
                    │                    │
                    │  analyse.ts        │   ◄── 3-pass analysis (WELL-FACTORED)
                    │  analysis-prompts  │   ◄── Pass 0 classification + 5 pipelines
                    │  Voyage AI embed   │   ◄── 1024-dim vectors
                    │  Hybrid search     │   ◄── 70% vector + 20% BM25 + 10% quality
                    └────────────────────┘

                    ┌────────────────────┐
                    │  Toolkit Tools ×17 │   ◄── 47% DUPLICATED CODE
                    │                    │
                    │  callHaiku() ×17   │   ◄── EXTRACT TO SHARED
                    │  rate-limit ×17    │   ◄── EXTRACT TO SHARED
                    │  JSON parse ×17    │   ◄── EXTRACT TO SHARED
                    └────────────────────┘
```

---

*Generated 20 March 2026. Next step: prioritise which refactoring to tackle first.*
