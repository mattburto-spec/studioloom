# Project: QualityCode — Codebase Health Cleanup

> **Created:** 29 Mar 2026
> **Status:** Planned
> **Goal:** Bring StudioLoom from prototype quality (7/10) to production-ready (9/10)
> **Estimated effort:** ~12-16 hours across 2-3 sessions

---

## Audit Summary (29 Mar 2026)

333 commits, 681 source files, ~204K lines of TypeScript/React across 13 coding days (~185 hours).

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Component size | 2 god components (2,316 + 1,959 LOC) | No component >600 LOC | P0 |
| Type safety | 123 `any` instances | <30 (boundary-only) | P1 |
| Test coverage | 14 test files (2%) | 40+ files (core routes + critical components) | P1 |
| Console logging | 40 instances (should be Sentry) | 0 console.log in production code | P2 |
| Dead code | Old Own Time components on disk | Deleted | P2 |
| Build strictness | TypeScript + ESLint ignored in builds | Enforced (fix errors, not suppress) | P1 |
| Sentry coverage | Partial (AI routes yes, toolkit/free tools no) | All API routes | P2 |

---

## Phase 1: Split God Components (P0, ~3-4 hours)

The two largest files mix too many concerns. Split them into focused sub-components.

### 1a. Teacher Settings Page (2,316 LOC → ~7 files of ~300 LOC each)

**File:** `src/app/teacher/settings/page.tsx`

**Current state:** Single component with 7 tabs (General, School, Timetable, Workshop, Personalisation, LMS, AI), 50+ useState variables, mounting SchoolCalendarSetup, TimetableGrid, and other complex sub-components inline.

**Plan:**
- Create `src/components/teacher/settings/` directory
- Extract each tab into its own component:
  - `GeneralTab.tsx` — teacher name, email, school name
  - `SchoolTab.tsx` — calendar setup, terms
  - `TimetableTab.tsx` — cycle config, TimetableGrid, iCal import, excluded dates
  - `WorkshopTab.tsx` — spaces, tools & machines, software
  - `PersonalisationTab.tsx` — teaching style, preferences
  - `LMSTab.tsx` — LTI config, Canvas/Blackboard/GC
  - `AITab.tsx` — model config, emphasis dials
- Parent page becomes thin orchestrator: tab state + renders active tab component
- Each tab component gets its own state + save handler
- Shared: teacher profile data passed as props or via context

**Testing:** After split, each tab should render independently. Manual smoke test all 7 tabs.

### 1b. Class Hub Page (1,959 LOC → ~6 files of ~300 LOC each)

**File:** `src/app/teacher/units/[unitId]/class/[classId]/page.tsx`

**Current state:** Single component with 7+ tabs (Overview, Progress, Grade, Badges, New Metrics, Students, Open Studio), complex data loading.

**Plan:**
- Create `src/components/teacher/class-hub/` directory
- Extract each tab:
  - `OverviewTab.tsx` — term picker, schedule, quick actions
  - `ProgressTab.tsx` — progress view link + ClassProfileOverview
  - `GradeTab.tsx` — grading link or inline grading
  - `BadgesTab.tsx` — already extracted (✓ exists as `BadgesTab` component)
  - `MetricsTab.tsx` — NMConfigPanel + NMResultsPanel
  - `StudentsTab.tsx` — student CRUD
  - `OpenStudioTab.tsx` — OpenStudioClassView
- Parent page: data loading + tab routing + renders active tab
- Shared data: unitId, classId, unit content, class metadata passed as props

### 1c. Class Detail Page (1,913 LOC)

**File:** `src/app/teacher/classes/[classId]/page.tsx`

Same pattern as 1b — audit what tabs/sections exist and extract.

**Deliverable:** No component file >600 LOC. Parent pages are thin orchestrators.

---

## Phase 2: TypeScript Strictness (P1, ~2-3 hours)

### 2a. Enable stricter TypeScript

- Set `noImplicitAny: true` in `tsconfig.json`
- Remove `ignoreDuringBuilds: true` for TypeScript in `next.config.ts`
- Fix resulting errors (estimated: 50-80 based on 123 `any` instances)

**Strategy for `any` instances:**

| Pattern | Count (est.) | Fix |
|---------|-------------|-----|
| Supabase query results | ~40 | Create typed interfaces for each query shape (e.g., `DashboardUnit`, `ClassStudent`) |
| JSON.parse boundaries | ~15 | Add runtime validation with type guards |
| Sentry/error context | ~20 | Leave as `unknown`, cast where needed |
| Gallery/Discovery dynamic data | ~35 | Create proper interfaces for review_data, submission content, discovery profile |
| Misc | ~13 | Case-by-case |

### 2b. Enable ESLint in builds

- Remove `ignoreDuringBuilds: true` for ESLint in `next.config.ts`
- Fix lint errors
- Add `eslint-disable` comments only where genuinely justified (with explanation)

**Deliverable:** `npm run build` passes with strict TypeScript and ESLint. Zero `any` outside of explicitly marked boundary files.

---

## Phase 3: Test Coverage (P1, ~4-5 hours)

### 3a. API Route Tests (~2-3 hours)

**Priority routes to test (by traffic and risk):**

| Route | Why | Test Cases |
|-------|-----|-----------|
| `POST /api/student/nm-assessment` | NM core, data integrity | Valid submission, missing fields, rate limit, auth |
| `GET /api/teacher/dashboard` | Most-hit route, complex joins | Empty state, multi-class, archived classes, fork detection |
| `POST /api/student/pace-feedback` | Simple but critical path | Valid pace, missing fields, auth |
| `GET /api/student/units` | Multi-class enrollment | Junction table, legacy fallback, content resolution |
| `POST /api/teacher/nm-observation` | Teacher data entry | Valid observation, partial ratings, class scoping |
| `GET /api/teacher/nm-results` | Report data | Empty state, mixed sources, class filtering |
| `POST /api/student/gallery/review` | Peer interaction | Self-review prevention, duplicate prevention, rate limit |
| `PATCH /api/teacher/class-units/content` | Fork-on-write | First fork, subsequent edits, reset to master |

**Approach:** Use Vitest with mocked Supabase client. Test request validation, auth checks, response shapes, and error codes.

### 3b. Component Snapshot Tests (~1 hour)

**Priority components:**
- CompetencyPulse (student-facing, data entry)
- ObservationSnap (teacher-facing, modal)
- LessonEditor (complex state)
- PhaseTimelineBar (interactive, drag)

**Approach:** React Testing Library with render snapshots. Test: renders without crash, handles empty props, shows correct states.

### 3c. Integration Test Checklist (~1 hour)

Convert existing markdown test checklists into executable Playwright tests:
- Student login → dashboard → lesson → response → save flow
- Teacher login → dashboard → Teaching Mode → observation flow
- Content fork → edit → reset flow

**Deliverable:** `npm run test` covers core API routes + critical components. CI-ready.

---

## Phase 4: Observability & Cleanup (P2, ~2-3 hours)

### 4a. Console → Sentry Migration

**Find all:** `grep -r "console.log\|console.error\|console.warn" src/ --include="*.ts" --include="*.tsx"`

**Rules:**
- `console.error` in API routes → `Sentry.captureException(error, { extra: { context } })`
- `console.log` for debugging → delete or gate behind `process.env.NODE_ENV === 'development'`
- `console.warn` for deprecation → keep but add `// DEV-ONLY` comment

**Priority files:**
- `/api/tools/report-writer/bulk/route.ts` (5 console.error calls)
- `/api/tools/marking-comments/route.ts`
- `/admin/controls/page.tsx` (debug console.log)

### 4b. Dead Code Removal

Delete unused files:
- `src/components/own-time/OwnTimeCard.tsx`
- `src/components/own-time/OwnTimeUnlock.tsx`
- `src/components/own-time/` directory (if empty after above)
- `src/app/api/teacher/own-time/` directory (old approve route)
- `src/components/teacher/CertManager.tsx` (replaced by BadgesTab)

Verify with `grep -r "OwnTimeCard\|OwnTimeUnlock\|CertManager" src/` that nothing imports them.

### 4c. Sentry Coverage Expansion

Ensure every API route has Sentry context:
- Toolkit routes (`/api/tools/*`) — 36 routes
- Free tool routes (report-writer, marking-comments, safety)
- Gallery routes
- Discovery routes

**Deliverable:** Zero `console.log` in production code. Dead code removed. Sentry captures all API errors.

---

## Phase 5: Performance & Build (P2, ~1-2 hours)

### 5a. Code Splitting

- Dynamic import for Discovery Engine (`next/dynamic` with `ssr: false`)
- Dynamic import for LessonEditor (heavy, only used on edit pages)
- Dynamic import for NMResultsPanel (only used in Class Hub Metrics tab)

### 5b. Bundle Analysis

- Run `npx @next/bundle-analyzer` to identify largest chunks
- Verify tree-shaking is working for framer-motion, exceljs, docx, pptxgenjs, jspdf
- Check if any large dependency is being pulled into client bundles unnecessarily

**Deliverable:** Measurably smaller client bundles. Key pages load faster.

---

## Execution Order

| Day | Phase | Hours | What |
|-----|-------|-------|------|
| 1 (morning) | Phase 1a | 2h | Split settings page into 7 tab components |
| 1 (afternoon) | Phase 1b+1c | 2h | Split class hub + class detail pages |
| 1 (evening) | Phase 4b | 0.5h | Delete dead code (quick win) |
| 2 (morning) | Phase 2a | 2h | Enable strict TypeScript, fix errors |
| 2 (afternoon) | Phase 2b | 1h | Enable ESLint in builds, fix errors |
| 2 (afternoon) | Phase 3a | 2-3h | API route tests for 8 priority routes |
| 2 (evening) | Phase 4a | 1h | Console → Sentry migration |
| 3 (if needed) | Phase 3b+3c | 2h | Component snapshots + integration tests |
| 3 (if needed) | Phase 5 | 1-2h | Code splitting + bundle analysis |

**Total: ~12-16 hours**

---

## Success Criteria

After QualityCode is complete:
- [ ] No source file >600 LOC (currently 5 files exceed this)
- [ ] `npm run build` passes with strict TypeScript + ESLint (no `ignoreDuringBuilds`)
- [ ] <30 `any` instances (down from 123), all at documented boundaries
- [ ] 40+ test files covering core API routes + critical components
- [ ] Zero `console.log` in production code paths
- [ ] All dead code removed (Own Time, CertManager)
- [ ] Sentry captures errors from all API routes
- [ ] Discovery Engine + LessonEditor lazy-loaded

---

## Key Principles

1. **Don't rewrite, refactor.** Move code into sub-components, don't rebuild from scratch.
2. **Tests first for routes.** API routes are the highest-risk untested code.
3. **Fix the build, then enforce it.** Get to green, then turn on strict mode permanently.
4. **No new features during QualityCode.** Pure cleanup. Resist scope creep.

---

*Last updated: 29 Mar 2026*
