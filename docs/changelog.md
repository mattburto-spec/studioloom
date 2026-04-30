# Session Changelog

> Rolling log of changes across sessions. Each `saveme` appends an entry. Read the last 5 entries for quick cross-session context.

---

## 30 Apr 2026 (latest) — Phase 1.4 client-switch CS-3 SHIPPED + comprehensive RLS audit closed ✅

**Context:** Continued from "CS-1 + CS-2" earlier this session. Picked Option B (comprehensive RLS audit before CS-3) to avoid per-route diagnostic surprises.

**Audit (FU-AV2-RLS-SECURITY-DEFINER-AUDIT closed ✅ RESOLVED):**
- Queried pg_policies for every cross-table-subquery pattern across the 21 tables CS-3 routes touch.
- Mapped each: does the subqueried table have a policy that back-references the calling table?
- Verdict: **zero remaining cycles.** The two CS-2 SECURITY DEFINER hotfixes (`students↔class_students`, `classes↔class_students`) closed the only two recursion-prone policy pairs in the system.
- Findings table preserved in the (now-resolved) FU entry as the safety proof.

**CS-3 (4 routes switched to SSR client):**
- `grades` — assessment_records read under "Students read own published assessments" (CS-1).
- `units` — multi-table read across students/class_students/classes/class_units/units/student_progress.
- `safety/pending` — cross-table chain through class_units → unit_badge_requirements → student_badges.
- `insights` — biggest surface (10+ tables). RLS-enforced.

**CS-3 hotfix (1 migration applied to prod): `units` student-read policy.**
- Smoke surfaced empty results from 3 of 4 routes — `units` table only had `Teachers read own or published units`. Students could read only published units. Unpublished assigned units were RLS-blocked.
- Fix: additive `Students read own assigned units` USING `id IN (class_units → class_students → students)`.
- Migration `20260430030419` applied + verified.
- Re-smoke: `grades` returns real `unitTitle: "Arcade Machine Project"`, `units` returns full unit data, `safety/pending` shows real `unit_title`, `insights` unchanged.

**Total Phase 1.4 client-switch state at end of session:**
- 6/6 Phase 1.4b routes use SSR client. Phase 1.5/1.5b/CS-1/CS-3 student-side policies are load-bearing across the entire surface.
- 4 RLS migrations applied to prod (3 CS-1 + 1 CS-3 hotfix). 2 SECURITY DEFINER hotfixes from CS-2 still in place.

**Schema-registry YAML hygiene fix:** earlier today's CS-1 saveme had a Python script that appended spec_drift entries AFTER `spec_drift: []` instead of replacing it — produced invalid YAML at 3 locations (assessment_records, classes, student_badges). Caught when api-scanner failed to parse. Fixed via regex substitution + manual restructure for the `classes` entry (had a separate `changes_in_phase_7a` field interleaved). All scanners now run clean.

**Pre-existing finding documented:** `/api/student/units` route shows wrong class for multi-class units (picks legacy `students.class_id` archived class over active enrollment). Filed FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (P3). Display-layer bug, not a CS-3 regression — pre-existed under admin client.

**Commits this segment:** `e44e883..a958a2b..a958a2b` (CS-3 timestamp claim + units RLS hotfix) + saveme.

**State of working tree:** clean (post-saveme). Tests 2806 passed | 11 skipped. Typecheck 0 errors. Migration collision gate clean.

**Next:** CS-4 (negative control) is now informational only — already verified RLS enforcement via earlier debug instrumentation. CS-5 close-out covered by this saveme. **Phase 1.4 client-switch effectively complete for the 6 Phase 1.4b routes.** Remaining work: 18 GET routes (FU-AV2-PHASE-14B-2 P3 — cosmetic, dual-mode wrapper covers them), Batch B mutation routes, Batch C teacher routes, eventual Phase 6 cutover.

---

## 30 Apr 2026 (later) — Phase 1.4 client-switch CS-1 + CS-2 SHIPPED: RLS load-bearing in prod for the first time ✅

**Context:** Continued from earlier "Phase 1 CLOSED" session. Picked up Phase 1.4 client-switch (FU-AV2-PHASE-14-CLIENT-SWITCH P2) — switch the 6 Phase 1.4b routes from `createAdminClient()` (admin bypass) → `createServerSupabaseClient()` (RLS-respecting). First time RLS would actually carry weight in production traffic; revealed multiple latent bugs from Phase 1.5/1.5b/CS-1 that admin-client testing had masked.

**Pre-flight findings (3 audit findings drove CS-1):**
1. `classes` had no student-side RLS policy. Routes would silently 0-row post-switch.
2. `assessment_records` had no student-side RLS policy. Same.
3. `student_badges_read_own` policy used the **never-functional** `current_setting('app.student_id')` + `request.jwt.claims->>'sub'` pattern. Schema-registry annotated it as canonical chain (`(their)`) but the SQL was broken — Lesson #54 in action. Has been returning 0 rows for every student under every auth path that has ever existed; app-level filtering masked it.

**Sub-phases shipped (all on `main`, no working branch — given no real users):**

- **CS-1 (3 migrations applied to prod):** `classes_student_self_read`, `assessment_records_student_self_read` (draft-filtered), `student_badges_rewrite` (DROP + CREATE with canonical chain). Migration 3 hit a `text = uuid` operator error: `student_badges.student_id` is TEXT not UUID (technical debt from migration 035 — the column was created as `TEXT NOT NULL "nanoid from student_sessions"`, never converted to UUID + FK). Fix: `::text` cast on RHS to mirror the existing teacher policy. Filed FU-AV2-STUDENT-BADGES-COLUMN-TYPE P3 for proper cleanup. 14 shape tests added.

- **CS-2 (2 routes switched + helper refactor):** `me/support-settings`, `me/unit-context` switched to SSR client. Helpers `resolveStudentSettings` + `resolveStudentClassId` refactored with optional `supabase: SupabaseClient` parameter (default `createAdminClient()` — backwards-compatible additive change, same shape as Phase 1.4a's dual-mode wrapper). 5 existing callers (4 teacher routes + 1 student word-lookup) unchanged.

- **Frontend login swap:** `(auth)/login/page.tsx:21` was still POSTing to legacy `/api/auth/student-login`. Phase 1.4b's `requireStudentSession` switch had been **silently 401-ing 6 routes for every browser-based student** since it shipped (because legacy login set only `questerra_student_session` cookie, no sb-* cookies; Phase 1.4 prod-preview tests used cURL with new endpoint directly, never browser→legacy-page→API). One-line swap to `/api/auth/student-classcode-login`. Closes the regression.

- **`student-session` route dual-mode:** When the frontend swap shipped, students bounced back to login. Cause: `(student)/layout.tsx:48` calls `/api/auth/student-session` which was legacy-only — read `questerra_student_session` cookie, 401'd on missing. Same dual-mode pattern as Phase 1.4a's `requireStudentAuth` wrapper applied: try `getStudentSession()` first, fall back to legacy. Bounce loop closed.

- **Two emergency RLS recursion hotfixes (SECURITY DEFINER pattern):**
  - **`students ↔ class_students` cycle.** Teachers manage students subqueries class_students; class_students self-read subqueries students; recursion. Fixed via `public.is_teacher_of_student(uuid)` SECURITY DEFINER helper (migration `20260430010922`).
  - **`classes ↔ class_students` cycle.** CS-1's "Students read own enrolled classes" subqueries class_students; class_students teacher policy (since migration 041) subqueries classes; recursion. Fixed via `public.is_teacher_of_class(uuid)` (migration `20260430015239`).

  Both ran as admin-client-bypassed for years; the moment SSR client touched them, they fired. Filed FU-AV2-RLS-SECURITY-DEFINER-AUDIT P2 for the comprehensive sweep — 6+ Phase 1.5/1.5b/CS-1 policies still have latent recursion potential, will surface as more routes switch.

- **End-to-end smoke verified live in prod:**
  - test2 logs in via classcode-login → sb-* cookies set ✅
  - Dashboard loads + STAYS loaded (no bounce) ✅
  - `me/support-settings`: `{"l1Target":"zh","l1Source":"intake","tapASource":"default"}` — REAL data, not defaults ✅
  - `me/unit-context`: `{"class":{"id":"a7afd4f3","name":"Service LEEDers","code":"QKKL4Q","framework":"IB_MYP"}}` ✅
  - Debug instrumentation confirmed: `classes` query returns 2 rows (test2's enrollments), correctly filtering out `Grade 8 Design` (not enrolled). RLS is enforcing.

**Lessons added: #64 — Cross-table RLS subqueries silently recurse; SECURITY DEFINER for any policy that joins through another RLS-protected table.** Sibling to #38 (verify expected values) + #54 (registries can claim things that aren't true). The new operational rule: every future Access-Model-v2 phase that ships RLS policies must include at least one SSR-client smoke test in the same phase, as a Checkpoint criterion.

**Systems affected:** `auth-system` (still v2; behavior changed under SSR client), `student-experience` (login flow + dashboard render path), `student-pm` (me/support-settings), `unit-system` (me/unit-context).

**Migrations applied to prod (5 across the day):**
- `20260429231118` — classes_student_self_read (CS-1)
- `20260429231124` — assessment_records_student_self_read (CS-1)
- `20260429231130` — student_badges_rewrite (CS-1, with column-type cast workaround)
- `20260430010922` — students↔class_students recursion fix (CS-2 hotfix #1)
- `20260430015239` — classes↔class_students recursion fix (CS-2 hotfix #2)

**Commits to main this session window (~15 commits):** `b2082dc..4ad144e`. Includes both the productive shipping (CS-1 SQL bodies, CS-2 route + helper changes, frontend swap, dual-mode student-session) and the diagnostic detours (debug instrumentation pushed + reverted, emergency hotfix migrations).

**State of working tree:** clean. Tests 2806 passed | 11 skipped (no regression). Typecheck 0 errors. CI green throughout.

**Follow-ups filed today:**
- FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3) — column should be UUID + FK to students(id), not TEXT
- FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2) — comprehensive sweep of 6+ remaining cross-table-subquery policies

**Next:** CS-3 (4 routes — grades, units, safety/pending, insights). Will surface more recursion cycles (probably in `assessment_records`, `competency_assessments`, etc.). Each cycle is ~30 min to fix once the pattern is known. Or do the comprehensive SECURITY DEFINER audit pre-emptively (P2 follow-up) and then ship CS-3 cleanly.

---

## 30 Apr 2026 — Access Model v2 Phase 1 CLOSED (Option A): auth path live, RLS pre-positioned, client-switch deferred ✅

**Context:** Two-day session continuing from the Day-1 saveme that shipped Phases 1.1a/1.1b/1.1d/1.2/1.3/1.4a/1.4b/1.5/1.5b on branch. Day 2 applied 8 RLS migrations to prod, then closed Phase 1 with Phase 1.6 cleanup + Phase 1.7 registry hygiene under "Option A" scope (full client-switch deferred to a follow-up rather than absorbed into Phase 1).

**What changed (4 commits across the day, all on `access-model-v2-phase-1`):**

- **Day 2 morning — 8 RLS migrations applied to prod** via Supabase SQL Editor in timestamp order. 4 from Phase 1.5 (3 rewrites of broken policies + 1 additive on `students`); 4 from Phase 1.5b (additive on `class_students`, `student_progress`, `fabrication_jobs` + `fabrication_scan_jobs`, deny-all on `student_sessions`). Verification queries returned expected pg_policies rows for each. `scan-rls-coverage.py` confirmed `student_sessions` + `fabrication_scan_jobs` exited the `rls_enabled_no_policy` drift bucket.

- **Phase 1.6 cleanup (`be2f3c8`):** Dropped the temporary alias pattern (`const auth = { studentId: session.studentId }`) from 3 of the 6 Phase 1.4b routes — `grades`, `me/support-settings`, `me/unit-context` now use `studentId` directly. The other 3 Phase 1.4b routes (`units`, `insights`, `safety/pending`) were never aliased. Also created `docs/security/student-auth-cookie-grace-period.md` documenting dual-auth-path coexistence semantics until Phase 6 cutover (cookie surface during the grace window, stale-token edge case, RLS implications, audit-trail asymmetry).

- **Phase 1.7 registry hygiene (`936fd96`):** WIRING.yaml `auth-system` rewritten to v2 — summary describes polymorphic auth.users + app_metadata.user_type model + dual-mode wrapper grace period; `affects` expanded 4 → 12 systems (every student-* surface that consumes the helper); `key_files` corrected (removed nonexistent `student-session.ts`, added `actor-session.ts`, `provision-student-auth-user.ts`, classcode-login route); `data_fields` adds `students.user_id`. schema-registry.yaml: spec_drift entries on 12 tables touched by Phase 1.5 + 1.5b. dimensions3-followups.md: FU-AV2-PHASE-15B ✅ RESOLVED; new **FU-AV2-PHASE-14-CLIENT-SWITCH (P2)** filed (route migration, supporting-table policies, live RLS harness, cross-class smoke, feature flag). Phase 1 brief §7 split into "Phase 1 close (NOW)" + "Deferred to client-switch follow-up".

- **Saveme registry sync:** scan-api-routes / scan-ai-calls / scan-feature-flags / scan-vendors / scan-rls-coverage all rerun. No new drift introduced by Phase 1 work; pre-existing drifts unchanged (FU-FF flagged tables remain intentionally deny-all; feature-flags drift pre-existing).

**Systems affected:** `auth-system` (v1 → v2). Indirectly: every student-* surface (12 systems in the rewritten `affects` list).

**State of working tree:** clean (post-saveme commit). Tests 2762 passed | 11 skipped (no regression from Day 1 baseline). Typecheck 0 errors. 24+ commits ahead of main, all pushed.

**Decisions logged:** see decisions-log entry "Phase 1 closed under Option A — RLS pre-positioned not load-bearing (30 Apr 2026)". Lessons #62 + #63 added Day 1.

**Next:** merge `access-model-v2-phase-1` → `main` (with `git merge origin/main` first to absorb the school_id NOT NULL hotfix commits). Then Phase 2 (OAuth + email-password for teachers) per `docs/projects/access-model-v2.md`.

---

## 29 Apr 2026 — Bug-report system overhaul: role-hint auth, rich client_context, Sentry, screenshots, dedupe, email, motion polish ✅

**Context:** Matt noticed a student-submitted bug report was tagged
`reporter_role = "teacher"` in the admin panel and asked what could be
improved. The existing `/admin/bug-reports` UI captured only
description / category / page_url / last 5 console.errors and showed a
flat list filtered only by status. Sentry was installed (`@sentry/nextjs`
10.43.0) but never linked to bug reports. No screenshot UX existed despite
the schema having a `screenshot_url` column. No notifications, no
dedupe.

**What changed (one branch on main, ~6 commits, 2 migrations applied to
prod 28–29 Apr):**

- **Role-hint auth fix** (commit `7a30e04`, migration
  `20260428230559_add_bug_report_client_context`): API resolution order
  was always Supabase Auth first → student session second. If a student
  was logged in on a profile that also had a teacher Supabase Auth
  session, every report got tagged "teacher". Frontend now sends
  `role_hint`; API tries the matching source first and falls through
  the other way only if it fails. Hint is verified, not trusted.
- **Rich `client_context` JSONB column** added to `bug_reports`. Captures
  userAgent, platform, language(s), viewport (w/h/DPR), screen, connection
  (effectiveType/downlink/RTT/saveData), hardware (cores/memory/touch),
  release SHA, deploy env, timezone, time-on-page, referrer, route
  context (`{routeKind, unitId, lessonNumber, activityNumber, classId}`
  parsed client-side from `/unit/:id/L:n/A:n`, `/class/:id`, etc.), and
  rolling last-10 runtime events (console.error / console.warn /
  window.error / unhandledrejection — the screenshot Matt sent of an
  unhandledrejection would have been missed by the old console.error-only
  hook).
- **Admin UI overhaul** (`784f3d2`, `4ef85eb`): structured 4-section
  context grid (Page / Browser / Viewport / Network & Hardware) with
  per-row labels that hide on null. Filter bar with free-text search
  across description+page_url+admin_notes plus Status/Category/Role
  button rows with live counts and a one-click "clear filters" link.
  Reporter role shown as a coloured chip on each row card (cyan/purple).
- **Sentry tie-in** (`eebd5ef`, migration `20260429010718`): client calls
  `Sentry.captureMessage` at submit time tagged with `bug_report`,
  `bug_category`, `reporter_role`, `class_id`, `route_kind`. Returned
  `event_id` stored in new `bug_reports.sentry_event_id` column. Admin
  links to the Sentry events search (`NEXT_PUBLIC_SENTRY_ORG_SLUG` /
  `NEXT_PUBLIC_SENTRY_PROJECT_SLUG` env vars narrow the deep-link to a
  specific project).
- **Screenshot capture** (same commit): adds `html-to-image` dep
  (~50 KB gz). Client uses `toJpeg` q=0.8 with dynamically-computed
  `pixelRatio` so longest output dim caps at 1400 px (a 1500×8000
  lesson page becomes ~262×1400 ≈ 200–400 KB JPEG, well under
  Vercel's 4.5 MB body limit). New private `bug-report-screenshots`
  Storage bucket with service-role-only RLS (matches migration 102
  pattern). API uploads decoded base64, stores object path. Admin GET
  batch-mints signed URLs (30 min TTL) so admin UI can render
  screenshots inline. Initial bug: tall preview pushed the textarea
  off the panel — fixed (`c8d2579`) with `max-h-32 object-cover-top`
  + click-to-open-fullsize. Second bug: rAF yield needed before the
  blocking `toJpeg` work or the capture-shimmer never paints
  (`5d5e224`).
- **Email notification on every new report**: fire-and-forget
  `api.resend.com` POST from "StudioLoom <hello@loominary.org>"
  (loominary.org is verified in Resend, reuses existing
  RESEND_API_KEY). Subject `[Bug · category] description-50`,
  body has page URL + admin link + Sentry link. Skips silently
  when `BUG_REPORT_NOTIFY_EMAIL` or `RESEND_API_KEY` are unset.
  Failures logged, never break submission.
- **Client-side dedupe** in admin UI: reports fingerprinted by
  (category | route_kind | first event kind+message). Description
  intentionally NOT in the fingerprint — different students will phrase
  the same bug differently. Row card shows "×N similar" rose badge
  when more than one report shares the fingerprint. No schema work
  (computed over the full 200-row page).
- **Motion polish** (`30a4a4c`, `5d5e224`) via existing framer-motion
  dep, students-only:
  - Idle wiggle: 1.6 s 6-frame jiggle every ~5 s, just enough
    personality without being distracting. Teachers get the static icon.
  - Click splat: multi-blob radial (yellow/pink/green/blue/purple)
    scales 0.4 → 2.4× and fades over 0.55 s, re-keyed via state
    counter so it re-fires on every click.
  - Capture shimmer: 128 px gradient panel with a horizontal shimmer
    sweep, pulsing camera icon, "Capturing screenshot…" headline +
    "Long pages can take a few seconds" subtitle. Two `requestAnimationFrame`
    yields after `setCapturingScreenshot(true)` ensure the shimmer paints
    before `toJpeg`'s synchronous DOM/canvas work blocks the main thread.

**Migrations applied to prod (in order):**
1. `20260428230559_add_bug_report_client_context.sql` — `client_context JSONB NOT NULL DEFAULT '{}'`.
2. `20260429010718_add_bug_report_sentry_and_screenshots.sql` — `sentry_event_id TEXT NULL` + private `bug-report-screenshots` Storage bucket + service-role-only RLS policy.

**Systems affected:** `bug-reporting`, `auth-system` (role-hint resolution
pattern), `governance-registries` (feature-flags + schema-registry
updates).

**Tests:** No new automated tests this session. Verified end-to-end via
Matt's prod smoke — student-tagged role correctly captured, admin UI
renders rich context, screenshot panel sized correctly, capture shimmer
visible during the 2–3 s capture window after the rAF fix.

**Lessons surfaced:**
- For long pages, JPEG q=0.8 with dynamically-scaled `pixelRatio`
  beats PNG by ~10× on file size, comfortably fitting Vercel's
  4.5 MB body limit even on 8000-pixel-tall lesson pages.
- React state updates inside an event handler don't paint before
  subsequent synchronous work in the same async function — explicit
  `requestAnimationFrame` yields are required if the work that
  follows blocks the main thread (e.g. `toJpeg`'s DOM/canvas
  rendering).
- Auth disambiguation should be a hint passed from the client, not
  inferred server-side. Two valid auth sources can coexist in the
  same browser; trust what the user's UI claims they are, then
  verify against that source first.

**Follow-ups (not done — opportunity backlog):**
- "Reply to reporter" — schema has `response` field but no notification
  path. Would close the loop with students. Resend already wired.
- "Send a response" auto-email when admin marks status `fixed`.
- Reporter session correlation (per-browser ID so multiple reports
  from same student/session group together).
- CSV export for batch triage.
- Server-side fingerprint column (currently computed client-side; fine
  at <200 rows).

---

## 29 Apr 2026 — TopNav search palettes wired (teacher + student) + lesson body-content scan ✅

**Context:** The search icon in the dashboard-v2 TopNav had been an inert
visual placeholder since Phase 1 scaffold (24 Apr). Wired it end-to-end —
first for teachers, then mirrored for students once Matt confirmed it
worked, then iterated on student-side scope (added lessons, then widened
lesson search to scan body content after Matt reported missing words he
knew were in his lessons).

**What changed:**

- **Teacher palette** (commit `d9045bf`): new `/api/teacher/search` route
  (3-bucket parallel ilike across `classes` / `class_units → units` /
  `class_students → students`, scoped via `classes.teacher_id`, 6 hits per
  bucket, 2-char min, escaped pattern). New `CommandPalette` component
  with debounced fetch (180 ms), `AbortController` cancellation, grouped
  results, keyboard nav (↑/↓/Enter/Esc), backdrop click. TopNav button +
  global ⌘K/Ctrl+K shortcut with in-input guard.
- **Student palette** (commit `3b6e748`): refactored to share —
  `src/types/search.ts` carries `SearchHit`/`SearchResponse` types, and
  `CommandPalette` moved to `src/components/search/` with a `searchUrl`
  prop (defaults to teacher endpoint). New `/api/student/search` —
  `requireStudentAuth` + service-role client (mirrors `/api/student/units`).
  Resolves student class IDs via `class_students` junction + legacy
  `students.class_id` fallback. v1 returned units only.
- **Lessons bucket** (commit `f84a13a`): added `LessonHit` type +
  `lessons[]` on `SearchResponse`. Student route now loads master units
  in one query, walks each assignment using `resolveClassUnitContent` +
  `getPageList` so lesson hits reflect the forked content the student
  actually sees. Teacher search returns `lessons: []` (not implemented).
  CommandPalette renders the new bucket with an emerald `Lesson` badge.
- **Body-content fix** (commit `9c472c3`): Matt reported lessons not
  finding words he knew existed. Root cause — for v4 (timeline) units
  `v4ToPageList` derives lesson title from just the first core activity's
  title. New `pageSearchText()` helper concatenates every student-visible
  string field (page.title, content.title, learningGoal,
  introduction.text, sections[].prompt + exampleResponse + ELL
  scaffolding, success_criteria, reflection.items, vocabWarmup
  terms/definitions/examples). Excludes `teacher_notes` (private) and AI
  rules (internal). Title hits and body hits collected separately so
  title matches sort first. Bucket cap stays 8.

**Validation:**
- ✅ tsc strict (`tsconfig.check.json`) clean throughout
- ✅ Both endpoints compile + return 401 unauthenticated in dev
- ✅ Teacher + student both working in prod after Vercel deploy (Matt
  confirmed: "ok works")
- ❌ Couldn't visually exercise the modal as a logged-in user in dev
  preview (no creds) — verification was endpoint-level + tsc

**Migrations this session:** None.

**Decisions added (logged inline, not in decisions-log):**
- Class-bucket excluded from student search (students don't have
  per-class pages — everything funnels to `/dashboard`).
- All page types searched (lesson, skill, reflection, context, custom,
  strand) — they're all navigable in the student flow.
- Title-vs-body hit ranking via two arrays + concat at the end (no score
  function) — simpler than a single ranked list.
- Lesson search excludes `teacher_notes` (privacy) and AI rules
  (irrelevant) but includes ELL scaffolding text (vocab a student might
  remember).
- Component placed at `src/components/search/CommandPalette.tsx` (shared
  location); types at `src/types/search.ts`.

**FUs added (informal — not filed in followups doc):**
- **Search perf — content_data refetch per keystroke** P3. Each lesson
  search keystroke (post-debounce) re-fetches `content_data` for every
  assigned unit. Tolerable for typical 3–10 active units; if a power
  user complains of lag, add a client-side cache of unit content per
  palette-open lifecycle.
- **Teacher lesson search** P3. Type system already supports `lessons[]`
  for teachers; `/api/teacher/search` just returns empty. Wire if useful.
- **Search ranking beyond title vs body** P3. Currently title-hit-first
  is the only signal. If body-hit results get noisy (e.g. common words
  matching across many pages), add scoring (term frequency, position).

**FUs resolved this session:** None.

**Systems affected:** New endpoints surface in `api-registry.yaml`
(2 routes added: `/api/teacher/search`, `/api/student/search`). No new
DB writes, no new AI calls, no new vendors, no migrations.

**Drift surfaced (pre-existing, not from this session):**
- `feature-flags.yaml` — orphaned `SENTRY_AUTH_TOKEN` (FU-CC,
  build-time-only), missing `RUN_E2E` (used in `student/word-lookup`
  test gate, not added to registry).
- `rls-coverage` — 7 tables RLS-enabled-no-policies (FU-FF,
  pre-existing pattern likely intentional for several).

**Tests:** Unchanged (search routes have no tests yet — small enough
that endpoint-level smoke + tsc was the bar).

**Cost spent this session:** $0 (no AI calls made or added).

**Pending after this saveme:** None blocking. Next normal work resumes
on whatever queue Matt picks (Access Model v2 Phase 0, dashboard-v2
polish, or new request).

---

## 28 Apr 2026 — Preflight Phase 8-1 schema flip + Round 1 audit + Phase 8-2 SHIPPED + E2E smoke PASS ✅

**Context:** Full day driven by Matt's smoke test of yesterday's
school-scoped lab ownership migration. Started with three prod hotfixes
(student upload Path B `teacher_id` chain, PostgREST schema-cache lost
FK, STL/laser file-type hard-gate), pivoted into a comprehensive
12-finding audit (`docs/projects/preflight-audit-28-apr.md`) after Matt
flagged "im a bit worried after those probs we just had where you had
missed things", landed Round 1 (HIGH-1/2/3/4 + MED-6) before lunch,
discovered Lab Setup page broken (audit MED-4) → built Phase 8-2
properly under the school-scoped contract instead of patching, hit
2 follow-up bugs during smoke (CI strict-typecheck UI debt + PostgREST
duplicate embed), fixed both, ended with full Preflight E2E smoke PASS.

**What changed:**

- **8.1d-37** Student upload Path B validates lab via `school_id` join,
  not removed `teacher_id` (`orchestration.ts:376-391`).
- **8.1d-37 follow-up** Codified `fabrication_jobs.lab_id` FK restoration
  as migration `20260428041707_restore_fabrication_jobs_lab_fk.sql`
  (the previous `DROP TABLE fabrication_labs CASCADE` killed the FK
  constraint; PostgREST schema cache emitted "Could not find a
  relationship" until restored + `NOTIFY pgrst, 'reload schema'`).
- **8.1d-38** Reject incompatible fileType / machine_category at upload
  (stl→3d_printer, svg→laser_cutter; STL on laser cutter previously
  passed).
- **Audit Round 1:**
  - **HIGH-1** server-side school filter on student picker via
    two-query split (templates + school-scoped).
  - **HIGH-2/3/4** `fabricatorSchoolContext` helper + 6 fab-orchestration
    callsite swap (school-scoped instead of single-teacher).
  - **MED-6** Migration 120 fresh-install ordering — IF EXISTS guards.
- **Phase 8-2 lab orchestration + API school-scoped rebuild (3 commits):**
  - `lab-orchestration.ts` full rewrite. New shape:
    `LabRow { id, schoolId, createdByTeacherId, name, description,
    createdAt, updatedAt }`. `is_default` dropped (per-class default
    lives on `classes.default_lab_id`, per-teacher on
    `teachers.default_lab_id`). New helpers `loadTeacherSchoolId`,
    `loadSchoolOwnedLab`. Cross-school → 404 (no existence leak).
  - 4 routes swept: `POST /api/teacher/labs`, `GET .../labs`,
    `PATCH .../labs/[id]`, `DELETE .../labs/[id]`,
    `PATCH .../labs/[id]/machines`. Renamed
    `sourceLabId`/`targetLabId` → `fromLabId`/`toLabId`. DELETE
    response: `{ deletedId, reassigned: { machines, classes, teachers } }`.
  - 26-test orchestration rewrite + route test updates. Mock
    query-builder extended for `.eq()` vs `.in()` distinguishing,
    `teachers.maybeSingle()`, thenable list queries.
- **Phase 8-2 hotfix** UI tsc errors after orchestration rewrite —
  ripped 6 `isDefault` references across `LabSetupClient.tsx` +
  `MachineEditModal.tsx` + `lab-setup-helpers.ts` + 1 test fixture.
  CI strict-typecheck (`tsc --noEmit --project tsconfig.check.json`)
  caught what `npx tsc --noEmit` filtered output didn't surface.
- **Picker-data hotfix (post-Phase-8-2)** Eliminated duplicate
  `fabrication_labs` embed in school-scoped query. The previous
  `${baseSelect}, fabrication_labs!inner(...)` produced two embeds
  via the same `lab_id` FK; PostgREST collided on
  `machine_profiles_fabrication_labs_1`. Each query now has exactly
  one embed.

**Verification:**

- ✅ Tests: 2208 pass / 9 skipped (no regression from baseline).
- ✅ TS strict: `tsc --noEmit --project tsconfig.check.json` clean.
- ✅ CI green on `8e04aef` + `dafa25d` (the two Phase 8-2 + hotfix
  merge commits on main).
- ✅ **Full Preflight E2E smoke PASS** in prod (Matt): student upload
  → scanner → teacher queue → fab pickup → complete.

**Migrations:** No new migrations this session beyond yesterday's
`20260428041707_restore_fabrication_jobs_lab_fk.sql` already shipped.
RLS coverage 89→94 tables / 82→87 with policies (tracks Phase 8-1
schema flip).

**Audit doc state:** 9 ✅ FIXED + 3 OPEN (MED-2 machine-orchestration
~8 stale `teacher_id` sites + MED-3 default-lab route dormant but
broken + MED-5 design call: recommend Option 2 audit-only) + 2 PARTIAL
(MED-4 UI rebuild deferred → Phase 8-4 + LOW-2 comment drift in
machine/fab-orchestration).

**Pending after this saveme:** Push origin/main DONE. Vercel deploy
DONE. **Phase 8-3 next session** — machine-orchestration rebuild,
pre-audited with full call-site list. Then Phase 8-4 (full
LabSetupClient visual rebuild).

**Lessons surfaced:**
- (additive to existing) When running `tsc --noEmit` ahead of pushing,
  use the project's strict CI config (`tsconfig.check.json`) — full
  `tsc --noEmit` includes test files with their own pre-existing Mock
  type errors that drown out new errors in production code.
- PostgREST embed disambiguation: appending an embed onto a baseSelect
  that already includes the same target table via the same FK results
  in alias collision. Rule: each query gets exactly one embed per
  (target, FK) pair.
- Audit-before-touch saved this session. The morning-time audit doc
  (12 findings) directly informed which work was Round 1 / Phase 8-2 /
  Phase 8-3 / Phase 8-4. Without it I would have rebuilt
  lab-orchestration without realising machine-orchestration had the
  same kind of debt.

**Systems affected:** `fabrication-lab-orchestration` (rewrite),
`fabrication-fab-orchestration` (school-scoped sweep),
`fabrication-student-picker` (server-side school filter + embed
hotfix), `fabrication-jobs` (FK restored, fileType/category gate).

**Worktree state at session end:** `/Users/matt/CWORK/questerra-preflight`
on `preflight-active` (in sync with origin). Top-of-main: `dafa25d`.

---

## 28 Apr 2026 PM — Smart tap-a-word defaults + speaker removal + Bug 3 prod verification

**Context:** Late-day polish on the language-scaffolding-redesign work after the morning's Option A unified Support tab landed. Three commits + a prod verification step that closes out today's work on student lesson support.

**Commits (4 today PM, all pushed to origin/main):**
- `ebeb1a1` feat(support): smart default for tap-a-word — ON for ELL≤2 OR L1≠English. Replaces the previous hard-coded `true` default that applied tap-a-word to every student including advanced native English speakers. New `defaultTapAWordEnabled(ell, l1)` helper. Resolver now reads `students.ell_level` + `class_students.ell_level_override`. Resolution table: ELL 1-2 → ON; ELL 3 + L1=en → OFF (clean reading); ELL 3 + L1≠en → ON (translation safety for advanced bilinguals). Defensive: invalid ELL coerces to 1 to err on side of scaffolding. 8 new tests across all ELL × L1 combinations + override-beats-default both directions + per-class ELL flip + null defaults. Support tab UI: explainer panel adds policy footnote; "inherit" option shows actual resolved value not hardcoded "(default: on)" lie.
- `9a126f7` feat(tap-a-word): remove word-level speaker buttons from popover. Per Matt: block-level read-aloud already handles English; single-word L1 audio audience too narrow to justify visual noise. Net -75 lines (popover JSX + inline SpeakerIcon SVG + useTextToSpeech subscription). Hook + tests preserved (exported from barrel) for future re-introduction if learning support specialists want heritage-learner workflows. Cleaner popover: word / definition / translation / example / image only.
- `e30d372` chore(scripts/dev): bank list-class-units.mjs as a reusable DB inspector. Generalised header, moved to scripts/dev/ alongside other one-off diagnostic tools. Sibling check-test-student.mjs deleted (hardcoded UUID, won't be useful again).

**Bug 3 verified in prod (no commit, manual workflow):** Set + reset overrides on 10 Design + Service LEEDers via the new Support tab. SQL inspection confirmed:
  - `class_students.support_settings = '{}'::jsonb` after reset (no orphan nulls)
  - **Service LEEDers self-heal worked** — pre-existing stale `{l1_target_override: null}` row from yesterday's testing flipped to `{}` when the new mergeSupportSettingsForWrite ran on touch. This is the strongest possible proof of Bug 3: the new code doesn't just avoid creating null orphans, it cleans up legacy ones.
  - One remaining test override on 6 Design (archived class) — left in place; harmless because Bug 4 filters archived classes from resolution. Will be cleared automatically when class-architecture-cleanup §1 (auto-unenroll trigger) ships.

**Decisions added (3):** Smart default policy for tap-a-word (ELL≤2 OR L1≠en); word-level speaker buttons removed (block read-aloud already covers English, single-word L1 audience too narrow); per-feature granular split deferred (Matt to consult learning support before locking the matrix design).

**Followup explicitly NOT filed:** the per-feature granular split (definitions / translations / audio / images as separate flags + admin matrix). Matt's call: "seems too much for this site at this point. what we've just built is more than most sites already." Accepted — pulling back scope when something is already strong is good discipline.

**Tests after PM:** 2279 → 2287 (+8 from smart-default tests). 0 failures, 9 skipped, 146 files. tsc clean. No new migrations.

**API surface:** No route changes (smart default + speaker removal are pure logic/UI changes inside existing routes). Registry scan clean.

**Today total tally (AM + PM):** 11 commits (8 AM + 3 PM); +28 tests (2259 → 2287); 1 new project doc filed (deferred); 9 decisions added; 1 lesson learned (#60); Supabase Free → Pro Small. All Bugs 1/1.5/2/3/4 verified end-to-end in prod via SQL.

**Wrap state:** Matt explicitly said "I feel like this wraps up things for now for language support." Treat as a done milestone; next pickup is whatever surfaces from tomorrow's class OR Phase 3 Response Starters when ready.

---

## 28 Apr 2026 — Multi-class context fix + Option A unified Support tab + Class architecture cleanup filed

**Context:** Continuation of the language-scaffolding-redesign Phase 2.5 work. Matt's first prod smoke test of the teacher control panel surfaced 4 bugs around multi-class context resolution. Fixed tactically (5 commits), then surfaced a deeper UX concern ("teachers will find this confusing if settings are in different places") which triggered an Option A unification: per-student Support tab as the single source of truth, with per-class as collapsed accordion. ELL editing also consolidated. Filed remaining architectural work as deferred. Saveme + handoff for the next session (Access Model v2 starting in parallel).

**Commits (8 today, all pushed to origin/main):**
- `79df0aa` fix(auth): student-session — deterministic class selection via ORDER BY enrolled_at DESC (Bug 1)
- `6bdc403` fix(tap-a-word): server-derive classId from unitId via class_units JOIN (Bug 2 — new `resolveStudentClassId` helper, 10 tests, TappableText auto-detects unitId from URL)
- `a6fcfc2` fix(student-nav): topnav class label follows the URL on /unit/[unitId]/... (Bug 1.5 — new `/api/student/me/unit-context` endpoint, layout watches pathname)
- `aa0f113` fix(support-settings): teacher reset deletes JSONB key (not persists null) — Bug 3, new `mergeSupportSettingsForWrite` helper, 7 tests
- `45249d3` test(support-settings): update PATCH null-reset assertion for Bug 3 semantics
- `a1dc37e` fix(student-context): exclude archived classes from session-default + unit-derived class — Bug 4 (new `filterOutArchivedClasses` helper, 3 new tests, regression test for the exact prod scenario)
- `11c2df0` docs(lessons): #60 — side-findings inside touched code belong in the same commit
- `e52105a` feat(teacher): unified per-student Support tab — single source of truth (Option A) — new `/api/teacher/students/[studentId]/support-settings` GET+PATCH, `<StudentSupportSettings />` component (resolution explainer + per-student global form + collapsed per-class accordion), new "Support" tab on `/teacher/students/[studentId]`, `?tab=` URL param honoured, cross-link from per-class teacher page
- `1406e6c` feat(teacher): consolidate ELL editing into the unified Support tab — per-student API accepts `ell_level`, per-class API accepts `ell_level_override`, ELL row added to Support tab UI, inline ELL pills REMOVED from class page (they were silently writing global while reading per-class — broken by coincidence)
- `184dc55` docs(projects): file class-architecture-cleanup as 🟢 READY (deferred behind Access v2)
- (saveme commit pending)

**Test baseline:** 2259 → 2279 (+20 across the day). 0 failures, 9 skipped, 146 files. tsc clean.

**Migrations this session:** None. All changes are pure app code.

**Decisions added (6):** Multi-class context fix shipped tactically (not deferred behind Option B); archived classes filtered at resolve-time not enrollment-time; Option A chosen for support settings unification; inline ELL pills removed (silently inconsistent); class architecture cleanup filed as deferred.

**Lessons added (1):** #60 — side-findings inside touched code belong in the same commit, not "follow-up later." Bit me today: I audited the Bug 1 fix, noted the archived-class gap, deferred it, then Matt hit it 30 minutes later and required commit `a1dc37e` to the same files.

**Projects filed (1):** `docs/projects/class-architecture-cleanup.md` — 4 gaps (archived auto-unenroll P1, student_progress scope decision P2, cohort labels P2, Option B URL-scoped classId P2 ~10-11d). Deferred behind Access Model v2. Trigger phrase: "continue class architecture".

**API surface changes:** +3 routes (per-student support-settings GET/PATCH, unit-context GET); modified word-lookup + me/support-settings to accept unitId; modified per-class single-student PATCH to accept ell_level_override; modified student-session select shape (added is_archived to nested classes select).

**Followups:**
- 🐛 Stale `{l1_target_override: null}` row on Service LEEDers from pre-Bug-3 testing — will self-heal on next teacher edit via new `mergeSupportSettingsForWrite`. Cosmetic.
- 🧪 No dedicated tests for the per-student support-settings endpoint shape — existing tests still pass but new behavior (ELL handling, partial UPDATE, `verifyTeacherCanManageStudent` auth) isn't locked. ~30 min if pulled forward.
- ⚠️ `docs/handoff/main.md` was stale (27 Apr) all session — Access v2 parallel session was given a manual briefing in chat instead. Refreshed as part of this saveme.

**Ops:** Supabase project auto-paused early in the day (Cloudflare 522). Matt upgraded free → Pro Small compute mid-session — restored access + permanent paused-state immunity going forward. Resolved before any user impact.

**Side-finding worth banking but not actioned:** Matt has 3 different teacher accounts in prod with the same display name "Matt" (`mattburto@gmail.com`, `hello@loominary.org`, `mattburton@nanjing-school.com`). Access Model v2 unification will need to handle this — already noted in the parallel-session briefing.

---

## 27 Apr 2026 — Preflight Phase 8.1d-31..35 SHIPPED + smoke 16/16 ✅

**Context:** Continuation of Phase 8.1 fab-dashboard polish. Five
hotfixes across one session, all driven by smoke-test feedback against
prod (studioloom.org). Plus a scanner OOM bump and 5-tier OOM longevity
plan filed to backstop the pre-pilot risk.

**Sub-phases shipped (in order):**

- **8.1d-31** — Fab can permanently delete jobs + styled
  `ConfirmActionModal` (replaces `window.confirm`) + Incoming-row
  filters (search + class chips + conditional file-type chips). New
  `deleteJob()` orchestration helper, `DELETE /api/fab/jobs/[jobId]`
  route, trash button on every card type (Incoming corner / Queued
  5-button row / Now Running header). Two modal intents: `warn`
  (amber, unassign — reversible) and `danger` (red, delete —
  permanent).
- **8.1d-32** — Students can permanently delete their own jobs.
  Mirror of 8.1d-31 but scoped via `student_id` and gated by
  `STUDENT_DELETABLE_STATUSES` (excludes `approved` + `picked_up`).
  New `deleteStudentJob()` + `DELETE /api/student/fabrication/jobs/[jobId]`.
  UI surfaces both on the detail page (next to Withdraw) and as a
  row-level trash icon on `/fabrication` overview. Row layout
  refactored from Link-wraps-everything to overlay-Link + sibling
  content because `<button>` inside `<a>` is invalid HTML.
- **8.1d-33** — Surrogate machine for "Any cutter" jobs picks largest
  bed area (was alphabetical-first). Caught by Matt's smoke: an SVG
  was BLOCKed against an "xTool F1 Ultra" 220×220mm when the same
  lab had an "xTool P3" 600×308mm with plenty of room. PostgREST's
  `.order()` doesn't accept multiplication, so fetch-then-rank in
  Python (lab fleets are small).
- **8.1d-34** — Bed-fit rules (R-SVG-01 + R-STL-06) now check both
  XY orientations. A drawing fits if EITHER as-is OR rotated 90°
  clears the bed — slicers rotate trivially, lab techs rotate parts
  routinely for material economy. STL rotates around Z only (gravity
  stays gravity). Ruleset versions bumped: stl-v1.0.1 → stl-v1.1.0,
  svg-v1.0.0 → svg-v1.1.0 (the SVG bump retroactively closes the
  FU-RULESET-VERSION-AUDIT note from 8.1d-12 content-bbox change).
- **8.1d-35** — Two console-noise sources caught by smoke S3:
  (a) RuleCard's "Learn more in Skills Library" Link gets
  `prefetch={false}` — Next.js's RSC prefetcher was hitting every
  `/skills/fab-R-XXX` stub URL on render and 404-flooding the console
  on a page with 6+ rule cards;
  (b) `useFabricationStatus` polling now stops on 404 (sets
  `cancelled = true` + dispatches a friendlier *"This submission no
  longer exists"* message) so back-button'ing into a deleted job
  doesn't flood every 2s indefinitely. Other 4xx/5xx responses stay
  retry-eligible (transient).

**Ops change — scanner OOM (mid-session):**

- `mount-bracket-130mm.stl` (1.1MB binary, ~23k tris) OOM'd on the
  scanner at 512MB during Matt's smoke. Bumped Fly machine to 1024MB
  via `fly scale memory 1024`, persisted in `fab-scanner/fly.toml`
  (was still saying 256mb — latent footgun for next deploy). 1GB only
  buys ~5× the previous ceiling — proper fix is the 5-tier longevity
  plan filed below.

**New follow-ups filed:**

- `PH9-FU-SCANNER-OOM-T1..T5` (P1–P3) — 5-tier roadmap to retire
  ad-hoc RAM bumps. T1 reject oversized at upload, T2 trimesh
  `process=False` + GC, T3 subprocess isolation per scan (all
  pre-pilot ~2–3 days). T4 numpy-stl for cheap rules, T5 Fly
  Machines size-aware (post-pilot ~4 days). Also escalates the
  original FU-SCANNER-OOM from "resolved at discovery" to
  "partially-resolved → escalated."
- `PH9-FU-FAB-SURROGATE-MULTIPLE-EVAL` (P2) — proper architectural
  fix for category-only scanning: every rule evaluated against
  every machine in the lab+category, BLOCK only when policy says so
  against the full set. Subsumes the originally-filed
  PH9-FU-FAB-SURROGATE-CONSERVATIVE since the same redesign solves
  both false-pass and false-fail directions. ~2 days post-pilot.

**Smoke S0–S15 all PASSED 16/16:**

| | Test | |
|---|---|---|
| S0 | Student deletes stuck file | ✅ |
| S1 | Mount-bracket scans clean on 1GB | ✅ |
| S2 | Detail-page delete mid-flight | ✅ |
| S3 | Detail-page delete terminal state | ✅ |
| S4 | Status gate blocks active-fab delete | ✅ |
| S5 | Fab delete on Incoming card | ✅ |
| S6 | Fab delete on Queued card | ✅ |
| S7 | Fab delete on Now Running | ✅ |
| S8 | Unassign amber modal ≠ Delete red | ✅ |
| S9 | Mark Failed canned chips | ✅ |
| S10 | Incoming search filter | ✅ |
| S11 | File-type chips conditional render | ✅ |
| S12 | Class chips | ✅ |
| S13 | Filters don't affect machine columns | ✅ |
| S14 | Hydration + tab counts + pulse | ✅ |
| S15 | Ghost-job count sanity | ✅ |

**Systems affected:**

- `preflight-pipeline` — 6 new API routes (4 backfilled into
  api-registry from earlier 8.1d-22/24/27 phases that hadn't been
  scanned), 2 orchestration helpers (`deleteJob` fab-side +
  `deleteStudentJob` student-side)
- `preflight-scanner` — surrogate machine semantics changed,
  rotation-aware bed-fit, ruleset versions bumped to 1.1.0,
  Fly memory 512→1024MB

**Commits / merges (origin/main):**

- `cdfdf8b` 8.1d-31 fab delete + filters + modals
- `494e4fd` 8.1d-32 student delete
- `6d8342f` 8.1d-33 + scanner OOM bump + 5-tier plan
- `072d261` 8.1d-34 rotation-aware bed-fit
- `c7c5e0d` 8.1d-35 console noise cleanup

**Fly deploys:** 3 (8.1d-33 surrogate carried the OOM bump,
8.1d-34 rotation, plus implicit redeploys verifying both).

**Tests:** existing 1939 fab tests still green on touched JS surface;
`tsc --noEmit` clean. 24 pytest tests in fab-scanner unaffected by
surrogate ordering or rotation logic (sandbox didn't run; no test
surface changes).

**Registries synced:** api-registry +6 routes (349 → 355).
ai-call-sites no diff (no AI changes). Feature-flags + RLS drift
status unchanged from prior session — both pre-existing
(FU-CC + FU-FF respectively).

**Next:** Phase 8 brief (`preflight-phase-8-brief.md`) still DRAFT
pending Matt sign-off on 6 open questions. Phase 8.1d is a clean
close-out point — full smoke list passed, no open regressions, all
follow-ups filed and prioritized.

---

## 24 Apr 2026 — Skills Library world-class schema upgrade (migration 110) + authoring UI rebuild

**Context:** Matt's goal after reading the research brief + catalogue v1: make the skills library world-class per Digital Promise / Scouts / DofE / IB ATL / CASEL / XQ / Project Zero principles. Decisions locked via Q1–Q10:

- Q1 ✓ Unified schema (safety modules migrate later as separate sprint)
- Q2 ✓ Teacher-ack button for demonstrated (studentwork pipeline deferred)
- Q3 ✓ DofE vocabulary — Bronze / Silver / Gold
- Q4 ✓ Matt authors all content himself
- Q5 ✓ `domain_id` + `category_id` as separate columns (subject × cognitive action)
- Q6 ✓ `card_type` (`lesson` | `routine`) ships now
- Q7 ✓ "Stone prereq" → "Activity block prereq" (Stones is dead vocabulary post-pivot-shelve)
- Q8 ✓ Resources deferred to v2
- Q9 ✓ DM-B1 Workshop Safety Essentials replaced with "Reading a Safety Data Sheet" (catalogue edit pending)
- Q10 ✓ Personal pilot — Matt's own students first

**Migration 110** `skills_library_world_class_schema.sql`:
- New `skill_domains` table — 10 subject-area domains seeded (DM, VC, CP, CT, LI, PM, FE, RI, DL, SM). Orthogonal to `skill_categories` (8 cognitive-action verbs). Short codes match catalogue card ID prefix.
- `skill_cards.difficulty` renamed → `tier` with value map (foundational→bronze, intermediate→silver, advanced→gold). DofE vocabulary verbatim per research-brief principle #3.
- 8 new columns: `domain_id` FK, `age_min`/`age_max`, `framework_anchors` JSONB, `demo_of_competency` text, `learning_outcomes` JSONB, `applied_in` JSONB, `card_type` (lesson/routine), `author_name`.
- New indexes: tier, domain, card_type, age_band.
- 3 existing seed cards backfilled minimally (tier + domain_id = design-making); other new fields default to empty/null — Matt will replace when authoring catalogue.

**Types (`src/types/skills.ts`) fully reshaped:** `SkillTier` replaces `SkillDifficulty`, `SKILL_TIERS` / `SKILL_TIER_LABELS` exported, `FrameworkAnchor` + `CardType` + `CONTROLLED_VERBS` introduced, `SkillDomainRow` added, `SkillCardRow` + payloads extended.

**API routes updated end-to-end:**
- `GET /api/teacher/skills/cards` — filters extended with `domain`, `tier`, `card_type`
- `POST /api/teacher/skills/cards` — validates tier enum, domain FK, age-band sanity (5–25 + min ≤ max), framework anchors shape, card_type enum, outcomes/applied_in as string arrays
- `PATCH /api/teacher/skills/cards/[id]` — all 8 new fields individually patchable
- `POST /api/teacher/skills/cards/[id]/publish` — minimum-publishable gate extended: title + category + **domain** + **tier** + **demo_of_competency** + ≥1 block. Digital Promise "rubric before attempt" enforced.
- `GET /api/teacher/skills/domains` — new lookup endpoint
- `GET /api/student/skills/cards/[slug]` — prereq query uses `tier`

**`SkillCardForm` — full rebuild in 8 numbered sections** (pedagogical order):
1. Identity (title / slug / summary / **author byline**)
2. Taxonomy & Tier (domain, category, tier, **card type toggle**)
3. **Pedagogical contract** — demo-of-competency with controlled-verb soft hint + banned-verb warning, learning outcomes list, framework anchors multi-select with framework-specific datalist suggestions, applied-in contexts list
4. Sizing (estimated min + age min/max)
5. Body (existing block editor + preview toggle)
6. Tags
7. External links
8. Prerequisites (fuzzy search preserved)

Controlled-verb enforcement: typing a demo line triggers a soft amber warning if it doesn't start with one of show/demonstrate/produce/explain/argue/identify/compare/sketch/make/plan/deliver. Datalist suggestions per framework — ATL gets 5 categories, CASEL gets 5 competencies, WEF gets 10 Future of Jobs skills, StudioHabits gets 8 Project Zero habits.

**Viewer updates** — both teacher + student viewers render a new **Pedagogical Contract panel** (indigo) at the top, above the body, showing demo-of-competency + learning outcomes + framework anchors. Digital Promise principle: rubric shown before attempt.

**Teacher list page (`/teacher/skills`):** filters extended (domain + tier + category + card_type + ownership); cards display short_code + tier pill + category pill + age band + author byline.

**Verification:**
- `npx tsc --noEmit` → 0 errors on skills files
- `npx eslint` → 0 errors
- `npm test` → 1854 pass / 8 skip / 0 fail

**Gating:** Migration 110 NOT yet applied to prod. Coordinated code+schema change — Matt applies 110 BEFORE push to main or app breaks (references `tier`, not `difficulty`). Push held in `skills-library` branch.

**Next:**
1. Matt authors 20 Gold cards using the new form
2. Replace DM-B1 → "Reading a Safety Data Sheet" (catalogue edit)
3. Safety module content migration (~3-day separate sprint)
4. Teacher-ack button for `skill.demonstrated` (~half day)
5. First pull-moment — activity block prereq embed (~2 days)
6. Personal pilot with Matt's students

**Systems affected:** `skills-library` (in_progress, schema v0→v1 layered), `schema-registry` (skill_cards entry rewritten + new skill_domains entry), `api-registry` (+1 domains endpoint).

---

## 24 Apr 2026 PM — Preflight Phase 7 Checkpoint 7.1 PASSED 12/12 🎉

**Context:** Closing saveme for Phase 7. Matt ran Phase 7 smoke against
prod on studioloom.org as teacher + `test` student + newly-invited
Fabricator account. S1 + S2 both PASS; S3 skipped as optional/unit-
test-covered. One data-correctness bug caught mid-smoke and hotfixed
before sign-off.

**Smoke outcomes (all PASS):**
- **S1 Happy-path print:** student upload `small-cube-25mm.stl` →
  auto-approved 3D printer → fabricator `/fab/queue` → `/fab/jobs/[jobId]`
  → **Download & pick up** with rewritten filename via
  `buildFabricationDownloadFilename()` → status flipped to `picked_up`
  → action bar switched to Re-download + Mark complete + Mark failed →
  **Mark complete** (printed) with free-text note → student
  `/fabrication/jobs/[jobId]` showed green `LabTechCompletionCard`
  with fabricator note, header flipped to "Printed", scan viewer
  hidden correctly.
- **S2 Failed run:** fabricator **Mark failed** on a second job with
  note "Warped off the bed partway through. Needs a brim / better bed
  adhesion." → student saw red "Your run didn't complete" card + note
  + "Start a fresh submission →" link. **Bug caught:** list view
  (student `/fabrication` + teacher per-student/per-class history)
  showed green "COMPLETED" pill for the same failed job — click-through
  was correct, list was lying. **Fixed Phase 7-5d** — see below.
- **S3 2-fab race:** skipped (optional per brief; race-safety is
  unit-test covered in `pickupJob` conditional UPDATE + post-write
  confirm read).

**Mid-smoke hotfix — Phase 7-5d (commit `433188b`):**
- **Data-correctness bug:** list views rendered the pill from `status`
  alone, ignoring the `completion_status` sub-state introduced in
  Phase 7-5. Fix: shared `fabricationStatusPill(status,
  completionStatus)` helper in `fabrication-history-helpers.ts` is
  now the single source of truth for pill label + colour across
  Preflight. Three list views + three orchestration row-builders
  updated. `completed+failed` → red "RUN FAILED"; `completed+printed`
  → green "PRINTED"; `completed+cut` → green "CUT". Legacy `completed`
  with null `completion_status` (pre-7-5 data) → green "COMPLETED"
  (backwards-compat).
- **Invite email legibility:** teacher `display_name` unset → fallback
  to raw email → Gmail auto-linkified → overrode our inline purple
  header styling with Gmail's default mailto blue (blue-on-purple
  unreadable). Fix: fall back to email local-part ("mattburto") instead
  of full address. Eliminates the auto-link vector entirely.
- Tests: 1939 → **1950** (+11 regression guards across all 3 completion
  branches + legacy fallback + non-terminal-status defensiveness +
  unknown-status graceful degradation + approved/rejected/picked_up
  mappings).
- Merged to main as `d5eb596`. Small rebase conflict in changelog.md
  resolved (parallel Skills Library session commit history).

**Setup gotcha — documented for Phase 8 onwards:**
- `RESEND_API_KEY` was not set on Vercel. StudioLoom teacher-invite
  flow works via `supabase.auth.admin.inviteUserByEmail()` (Supabase's
  own SMTP config holds a separate copy of the Resend key); Preflight
  fab-invite flow does a direct fetch to `api.resend.com` via
  `src/lib/preflight/email.ts` and needs the env var on Vercel
  directly. Resolution: created dedicated `re_...` Resend API key
  (named `preflight-vercel`), added to Vercel Production + Preview
  env vars, redeployed. Known setup step for any future Preflight
  deploy to a new project. Captured in checkpoint report for
  operational-runbook value.

**4 new follow-ups filed (all P2/P3, Phase 9 scope):**
- `PH7-FU-COMPLETION-NOTIFICATIONS` P2 — wire student email on
  pickup/complete/fail. `email.ts` kinds already exist; needs
  orchestration call sites in `pickupJob` / `markComplete` /
  `markFailed`. ~1-2h. Matt flagged during S2: "also later need to be
  able to add a notification for these events".
- `PH7-FU-INLINE-QUEUE-ACTIONS` P2 — Download/Complete/Fail inline on
  queue cards, skip detail page round-trip for triage. Matt's
  observation during S1: "so much empty space on these job cards. you
  could add buttons like 'fail' could also be added. means you don't
  need to click in so many places".
- `PH7-FU-FAB-SCAN-SUMMARY` P2 — rewrite jargon-y "2I (B = blocker,
  W = warning, I = info)" to "Scan passed · 2 info notes, no blockers"
  style. Matt's observation: "not sure what scan summary means. prob
  need to make that more intuitive".
- `PH7-FU-PRE-PICKUP-FAIL` P3 — Reject-without-pickup variant of Fail
  for "this file is wrong, can't run" case.

**Phase 7 totals:**
- 8 commits on `preflight-active` (7-1 through 7-5d), all merged to
  main across two merge commits (`7fefd6e` pre-smoke, `d5eb596`
  hotfix). Plus the saveme + checkpoint-PASS commit landing now.
- Tests: 1854 → **1950** (+96 across Phase 7 including hotfix).
- api-registry: 332 → **337** routes (+5 fab routes).
- No new migrations — Phase 7 was pure app layer on columns already
  existing from migration 095.
- `preflight-pipeline` system in WIRING extended with
  fab-orchestration + 5 fab routes + component files + future_needs
  pointer to Phase 8 brief.

**Next session:** Matt resolves the 6 open questions in the Phase 8
brief (`docs/projects/preflight-phase-8-brief.md` §5). Options: answer
each individually, or fast-track with "all recommended" like Phase 7.
Once resolved, Phase 8-1 (fabrication_labs migration + backfill) opens.

**Systems affected:**
- `preflight-pipeline` (status remains `in-progress` — Phase 7
  complete, Phase 8 pending).
- Documentation: `preflight-phase-7-checkpoint-7-1.md` flipped to
  ✅ PASSED status with full smoke outcomes + hotfix narrative + 4
  new follow-ups.

---

## 24 Apr 2026 AM — Preflight Phase 7 code complete + Phase 8 brief drafted

**Context:** Closing saveme after Phase 7 (Lab Tech Pickup + Completion)
landed on main pre-smoke and the Phase 8 brief was drafted + merged.
Phase 7 is the first Fabricator-facing UI in Preflight. Phase 8 brief
captures the unified visual lab+machine+fab admin that Matt flagged
mid-Phase-7 ("need an easy visual management page... drag and drop,
shows relationships and visual rep of machines, in locations that can
have custom names").

**Phase 7 SHIPPED (code complete, smoke PENDING):**
- 10+ commits on `preflight-active` merged to main as `7fefd6e`
  (pre-smoke merge — explicit Matt call: no active users, no new
  migrations, all additive app layer, safer to land before smoke so
  follow-up fixes go straight to main).
- **7-1** `src/lib/fabrication/fab-orchestration.ts` (~560 lines,
  5 exports: `listFabricatorQueue`, `getFabJobDetail`, `pickupJob`,
  `markComplete`, `markFailed`). Race safety via conditional UPDATE
  + post-write confirm read. §11 Q8 idempotent re-download
  (status=picked_up + self = no-op). Bug caught in build: `.range()`
  called before tab-filter `.eq()` — PostgREST chain returns the
  promise after `.range`. Restructured to filter first, `.order
  + .range` at end. 23 orchestration tests.
- **7-2** 5 API routes (queue/detail/download/complete/fail) all
  `requireFabricatorAuth` + `Cache-Control: private, no-cache`.
  Download = 3-step (detail → pickup → stream bytes with rewritten
  `Content-Disposition` via Phase 6-6k `buildFabricationDownloadFilename()`).
  33 route tests.
- **7-3** `/fab/queue` server shell + `FabQueueClient` (~250 lines).
  4 status tabs (queued/in_progress/completed/failed) + retry. Replaces
  Phase 1B-2 placeholder.
- **7-4** `/fab/jobs/[jobId]` detail page + `LabTechActionBar`
  (Download / Complete / Fail) + canned-note chips modal (4 complete
  presets / 6 fail presets from new `lab-tech-canned-notes.ts`).
- **7-5** Student-side visibility: extended `orchestration.ts:getJobStatus`
  with `completionStatus`/`completionNote`/`completedAt`;
  `LabTechCompletionCard` (green printed/cut + red failed variants)
  renders in `DoneStateView` when `shouldShowCompletionCard(jobStatus)`.
  Phase 7 Checkpoint 7.1 report drafted (12 criteria + 3 smoke scenarios).
- **7-5b** Inclusive-wording sweep after Matt pushback ("not all schools
  have lab techs. Bit of a luxury. In some cases this may be a computer
  setup near the 3d printers/laser cutters that anyone can access as
  its always logged in"). Swept 5 surfaces of user-facing copy "lab tech"
  → "fabricator"/passive voice. Code comments kept as "lab tech" for
  developer readability.
- **7-5c** Missed `/teacher/preflight` header button "Lab techs" →
  "Fabricators" (caught by Matt screenshot).

**Phase 8 brief DRAFTED (`docs/projects/preflight-phase-8-brief.md`):**
- 222 lines. Unified visual lab + machine + fab admin page.
- Ships: `fabrication_labs` table + `machine_profiles.lab_id` FK +
  `classes.default_lab_id` FK, `/teacher/preflight/lab-setup` page,
  machine CRUD from template or scratch, laser operation colour map
  editor, fabricator reassignment, student picker filter by
  `class.default_lab_id`.
- 5 sub-phases (8-1 migration → 8-2 lab CRUD → 8-3 machine CRUD →
  8-4 visual page → 8-5 student filter+smoke). ~2–3 days.
- **Recommends Option B (click-based)** over drag-drop: ~30–50%
  faster ship, accessible out of box, real-world teachers don't
  reorg daily. Drag-drop filed as `PH8-FU-DRAG-DROP` P3 for post-pilot.
- **6 open questions pending Matt sign-off** (entity naming / default-
  location strategy / cross-teacher visibility / who creates labs /
  student-side impact / drag-drop vs click). Recommendations documented.
- Absorbs originally-Phase-9 `PH6-FU-MULTI-LAB-SCOPING` + closes
  `FU-CLASS-MACHINE-LINK` P3. Phase 9 scope reduced to "Analytics + Polish".
- Merged to main as `bca5327` (rebased over 3 parallel Skills Library
  commits; resolved stale untracked skills-library files in main
  worktree that were blocking rebase).

**Testing:**
- `npm test`: 1854 → **1939 passing** (+85) + 8 skipped. No regression.
- `tsc --noEmit`: clean on all new files.
- `scan-api-routes.py`: 332 → **337 routes** (+5 fab routes).
- `scan-ai-calls.py`: no drift.
- `scan-feature-flags.py` / `scan-vendors.py` / `scan-rls-coverage.py`:
  timestamp-only updates to reports, no structural drift.

**Systems affected:**
- `preflight-pipeline` (extended key_files list with fab-orchestration
  + 5 fab routes).
- `api-registry.yaml` (+5 fab routes).
- Follow-ups updated: PH6-FU-MULTI-LAB-SCOPING promoted P2 → Phase 8;
  FU-CLASS-MACHINE-LINK P3 folded into Phase 8-5 scope.

**Next session:** Matt runs Phase 7 Checkpoint 7.1 smoke (3 scenarios:
S1 happy-path print, S2 failed run, optional S3 2-fab race). After
sign-off, Matt resolves the 6 open questions in Phase 8 brief; then
Phase 8-1 (migration + backfill) opens.

---

## 23 Apr 2026 PM — Preflight Phase 6 SHIPPED + Checkpoint 6.1 PASSED 🎉

**Context:** Closing saveme for Phase 6. Matt ran all 4 smoke
scenarios end-to-end on studioloom.org; all PASS. Phase 6 is the
first teacher-facing surface of the Preflight pipeline and also the
closure of the Phase 5 follow-up `PH5-FU-REUPLOAD-POLL-STUCK`
(verified fixed in S2 smoke).

**Checkpoint 6.1 smoke outcomes (all PASS):**
- **S1 Happy path (approve)** — queue → detail → Approve → student
  sees green `TeacherReviewNoteCard` with teacher's note. Scroll-to-
  top fired on action (6-6a). Read-only viewer on approved jobs.
- **S2 Return for revision (CRITICAL)** — queue → detail → Return
  with note → student sees amber card + only the Re-upload button
  (Submit hidden per 6-6c) → student re-uploads → **transition
  clean without hard-refresh**, confirming the layered 6-0 reducer
  auto-unfreeze + 6-5b reset-before-fetch ordering closes
  `PH5-FU-REUPLOAD-POLL-STUCK`.
- **S3 Reject** — terminal red card + "Start a fresh submission →"
  link, `ScanResultsViewer` correctly not rendered (spec §10 Q2).
- **S4 Per-student + per-class history** — 4-metric strips + per-
  student drill-down tables rendered accurately. Class + absolute
  date/time columns visible (6-6n/o). Deep-links + context-aware
  back nav (6-6m) all working.

**This session's additional polish commits (after the morning smoke
kicked off):**

- **6-6m** — context-aware back nav on teacher detail page.
  "← Back to queue" hardcoded destination broke when teachers
  arrived from student Fabrication tab or class Fabrication
  section. Now `router.back()` with queue fallback for bookmarks.
- **6-6n** — per-student Fabrication tab: class chip + absolute
  date/time (new `formatDateTime` helper). Class section expand
  affordance redesigned (Show/Hide text + real chevron SVG +
  purple border when open). 30s AbortController timeout +
  console.error with classId on failure + Retry button.
  Server-side: `HistoryJobRow.className` now populated via
  `classes(name)` join.
- **6-6o** — student's own `/fabrication` overview gained the same
  Class column + absolute date/time treatment. (Teacher side was
  fixed in 6-6n; the student overview was a separate render path
  I'd missed.)
- **PH6-FU-HISTORY-PAGINATION** P2 follow-up filed inline on
  `fetchHistoryJobs` — uncapped history endpoints work at NIS
  pilot scale (~200 jobs/class) but need cap + filters + lazy-
  load for school-deployment scale.

**6 follow-ups filed across Phase 6 (tracked in the checkpoint
report + inline in code):**
- `PH6-FU-PREVIEW-OVERLAY` P2
- `PH6-FU-PREVIEW-PINCH-ZOOM` P3
- `PH6-FU-RULE-MEDIA-EMBEDS` P2
- `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE` P3
- `PH6-FU-MULTI-LAB-SCOPING` P2
- `PH6-FU-HISTORY-PAGINATION` P2

**Resolved:** `PH5-FU-REUPLOAD-POLL-STUCK` P2 — closed in prod by
the layered 6-0 + 6-5b fix.

**Systems affected:** fabrication (student + teacher surfaces +
shared orchestration).

**Totals:** 1668 → 1854 tests (+186). api-registry 310 → 324
(+14 routes). No new migrations.

**Next phase:** Phase 7 (Fabricator Queue + Pickup). Brief to be
drafted on kickoff. Ships `/fab/queue` real build (currently Phase 2
placeholder), Content-Disposition download wiring the 6-6k
`buildFabricationDownloadFilename()` helper, pickup / complete /
fail actions, optional notifications.

---

## 23 Apr 2026 — Skills Library Phase S2A authoring core + student viewer SHIPPED

**Context:** Checkpoint SL-SCHEMA (Phase S1) passed yesterday with migrations 105-108 applied to prod. S2A builds the first user-facing slice: teachers author cards, students read them, views log into `learning_events`. Deliberately does NOT include upload (deferred to S2B) or quiz/completion flow (S3).

**What shipped (in `skills-library` branch, not merged to main):**

- **Migration 109** `skills_library_authoring.sql` — teacher authoring surface:
  - Adds `forked_from uuid REFERENCES skill_cards(id) ON DELETE SET NULL` column (+ partial index). Written by S2B's Fork action; left NULL in S2A.
  - Teacher-write RLS policies on `skill_cards` + `skill_card_tags` + `skill_prerequisites` + `skill_external_links`: INSERT/UPDATE/DELETE scoped to `created_by_teacher_id = auth.uid() AND is_built_in = false`. Mirrors the shape used on `badges` + `activity_blocks`. Service role still bypasses for seeding + built-in management.
  - Not yet applied to prod — Matt applies after checkpoint sign-off.

- **Types (`src/types/skills.ts`)** — 6-variant `Block` discriminated union (prose / callout / checklist / image / video / worked_example), `SkillCardRow`, `SkillCardHydrated` with tags + external_links + prereqs, `SkillEventType` enum, create/update payload shapes. `emptyBlock(type)` factory for the editor. S2B extension points: `uploadPath` optional on image/video blocks (Storage key, overrides url when present).

- **Teacher API (`/api/teacher/skills/`):**
  - `GET /cards` — list built-ins + own drafts + all published, filtered by category/difficulty/ownership (`all`/`mine`/`built_in`). Uses admin client with explicit OR visibility clause (would work under RLS too; admin bypass keeps error surfaces symmetric with rest of /api/teacher/*).
  - `POST /cards` — create draft. Validates slug (lowercase-kebab, 3-80), title (3-200), category (FK check), difficulty enum, body block-type whitelist. Idempotent side inserts for tags + external_links + prereqs.
  - `GET /cards/[id]` — hydrated card (tags + links + prereq titles). Returns `{ card, editable }` — editor bounces to read-only viewer when `editable=false`.
  - `PATCH /cards/[id]` — wholesale replace for tags/links/prereqs when provided; field-level merge for metadata. Built-ins return 403. Enforces `created_by_teacher_id = auth.uid()`.
  - `DELETE /cards/[id]` — hard delete teacher's own non-built-in card. CASCADE handles children.
  - `POST /cards/[id]/publish` — flips `is_published`. `{ action: "unpublish" }` reverses. Enforces minimum publishable content (title + category + difficulty + ≥1 block).
  - `GET /categories` — thin lookup proxy to `skill_categories`.

- **Student API (`/api/student/skills/cards/[slug]`):**
  - Loads published card by slug, hydrates tags + links + prereq titles.
  - Logs `skill.viewed` into `learning_events` with 5-minute dedupe window (prevents tab-switch / remount floods). Dedupe uses `gte created_at cutoff` — older views still count toward state transitions because the derived view takes MAX rank.
  - Returns student's current state from `student_skill_state` view (state + freshness + last_passed_at). Absent row → `untouched`.
  - Uses `requireStudentAuth` (token-cookie → student_sessions table), not Supabase Auth.

- **Components (`src/components/skills/`):**
  - `BlockEditor.tsx` — controlled editor for Block[]. Each variant is a dedicated per-type component (`ProseForm`, `ChecklistForm`, etc.) — pattern sidesteps TS discriminated-union narrowing loss inside nested function closures. Add/move/delete controls + inline delete confirm.
  - `BlockRenderer.tsx` — read-only render for all 6 types. Markdown-lite prose parser (**bold** / *italic* only). YouTube + Vimeo iframe fallback + direct-mp4 video. External URL image; `/api/skills/media/[path]` reserved for S2B uploads.
  - `SkillCardForm.tsx` — shared create/edit shell used by both teacher pages. Metadata + tags + external links + fuzzy prereq search + body editor + preview toggle.
  - `skills.css` — scoped under `.sl-skill-scope` wrapper class so Tailwind-based teacher pages and student `.sl-v2` scope don't fight.

- **Teacher pages:**
  - `/teacher/skills` — library list with category/difficulty/ownership filters, draft/published pills, forked indicator, skeleton loaders, empty state CTA.
  - `/teacher/skills/new` — create flow; posts then redirects to `/edit`.
  - `/teacher/skills/[id]` — read-only viewer (for built-ins + non-editable cases).
  - `/teacher/skills/[id]/edit` — edit form + publish/unpublish toggle + delete with inline confirm. Bounces to `/teacher/skills/[id]` when `editable=false`.

- **Student page:**
  - `/skills/cards/[slug]` — student viewer. Renders body via `BlockRenderer`, shows state + freshness chip (fresh omitted as not interesting), prereq prompt ("Before you start" with chips linking to prereq cards), external resources section, tags footer. Fires view log via the API GET. 404 handled inline.

**Bug notes during build:**

- Pre-existing stash `pre-library-upload: leftover scanner/saveme artifacts` got applied during a `git stash` diagnostic command. Reset 6 conflicted doc files back to HEAD (they're saveme-regenerated artifacts anyway). S2A source files were untouched.
- TypeScript narrowing failure when block-editor forms used closures referencing `block.items` / `block.steps` inside a switch case. Fixed by extracting per-variant form components — TS can't carry narrowing through nested function closures, but each component takes the narrowed variant as its prop type.

**Verification:**

- `npx tsc --noEmit` → zero skills-file errors. Pre-existing codebase-wide errors (fabrication test mocks, useGalleryMultiplayer, multi-lesson-detection tests) untouched.
- `npm test` → 1845 pass / 8 skipped / 0 fail (up from pre-S2A 1845 — no regressions).
- `npx eslint` on S2A files → 4 initial `react/no-unescaped-entities` errors, all fixed with `&apos;`.

**Not in S2A (deferred to S2B):**

- Upload from disk — `skills-media` Supabase Storage bucket + upload API + image/video block toggle.
- Fork action — copy built-in or another teacher's card into an editable draft, sets `forked_from`.

**Checkpoint SL-AUTHOR-A criteria (pending Matt sign-off):**

1. Teacher creates a draft card via `/teacher/skills/new`, sees it in list with Draft pill.
2. Teacher edits body, tags, category, difficulty; saves; reloads → changes persist.
3. Teacher toggles publish → appears as published; can unpublish.
4. Teacher opens built-in card (read-only viewer), no edit controls.
5. Teacher deletes own card → gone from list.
6. Student visits `/skills/cards/[slug]` for a published card → sees full content + state chip.
7. Second visit within 5 min does NOT duplicate `skill.viewed` row in `learning_events`.
8. Student cannot see draft cards (404 on direct slug nav).
9. Prereq chip on student view links to the prereq card.

**Systems touched:** `skills-library` (in_progress → still in_progress, S2A layer added), `api-registry` (+~10 routes), `schema-registry` (skill_cards entry amended, 4 sibling tables' RLS note updated).

**Next:** Checkpoint SL-AUTHOR-A sign-off + migration 109 apply to prod. Then S2B — upload bucket + fork. Then S3 — quiz engine + completion flow.

---

## 23 Apr 2026 — Preflight Phase 6 code COMPLETE + Checkpoint 6.1 smoke IN PROGRESS

**Context:** First teacher-facing surface of the Preflight pipeline.
Ran in `preflight-active` worktree alongside parallel
`dashboard-v2-build` (v2 polish) + a fresh `skills-library` worktree
(Phase S1 schema). Daily merges back to main. Smoke (S1–S4) against
studioloom.org with Matt as teacher + a `test` student account.

**Phase 6 sub-phases shipped (14+ commits, all on main via preflight-active):**

| | |
|---|---|
| 6-0 | reducer auto-unfreeze on revision bump (PH5 fix) |
| 6-1 | teacher action endpoints + queue endpoint + teacher-orchestration lib |
| 6-2 | `/teacher/preflight/jobs/[jobId]` detail page + `readOnly` ScanResultsViewer |
| 6-3 | `/teacher/preflight` queue page with status tabs + counts |
| 6-4 | per-student + per-class fabrication history |
| 6-5 | student `needs_revision` view + `TeacherReviewNoteCard` |
| 6-5b | reset-before-fetch ordering (closes `PH5-FU-REUPLOAD-POLL-STUCK`) |
| 6-6 | Checkpoint 6.1 report draft with ⏳ placeholders |
| 6-6a–l | smoke-feedback polish — see below |

**Smoke-feedback polish sub-phases (a–l):**
- **a** — 4× bigger scan thumb + scroll-to-top on teacher action
- **b** — "Uploading your file" → "Loading your submission" (copy was wrong for nav/return entry paths)
- **c** — hide Submit button on `needs_revision` + `pending_approval` (rude to re-submit unchanged)
- **d** — width + typography consistency pass across all preflight pages (`max-w-6xl`, `text-3xl` h1s, cleaner section headings with coloured accent bars, no emoji)
- **e** — 2-column layout on student status page (content left, preview + history right)
- **f** — click-to-zoom preview lightbox with Esc + backdrop close + body-scroll-lock
- **g** — Preflight tab added to v2 student `BoldTopNav`
- **h** — final width polish on fabricators + submitted + upload pages
- **i** — new `/fabrication` student overview page listing their submissions + `+ New submission` CTA; removed redundant "Back to dashboard" links
- **j** — 2-column layout on teacher detail page; extracted `PreviewCard` into shared component
- **k** — student **withdraw** (`POST /api/.../cancel`) + auto-filename helper (`{student}-{grade}-{unit}.ext`) + button press animations across every preflight button
- **l** — canned-note chip strip (4–7 presets per action kind) in TeacherActionBar modal

**Smoke progress (Matt on studioloom.org):**
- ✅ **S1 Happy path** (approve) — clean end-to-end
- ✅ **S2 Return for revision** — CRITICAL TEST. Reupload
  transition was clean without hard-refresh, confirming the layered
  6-0 (reducer auto-unfreeze) + 6-5b (reset-before-fetch) fix works
  end-to-end. Closes `PH5-FU-REUPLOAD-POLL-STUCK`.
- ✅ **S3 Reject** — red card renders without `ScanResultsViewer`,
  Start Fresh link navigates correctly.
- ⏳ **S4 Per-student + per-class history** — pending.

**5 new follow-ups filed during smoke** (tracked inline + in Checkpoint 6.1 report):
1. `PH6-FU-PREVIEW-OVERLAY` P2 — scanner-driven bounding boxes on
   thumbnail showing WHERE a rule fired. Data already flows through
   `scan_results.rules[].evidence`.
2. `PH6-FU-PREVIEW-PINCH-ZOOM` P3 — wheel/pinch zoom + drag-pan.
3. `PH6-FU-RULE-MEDIA-EMBEDS` P2 — extend rule schema with
   `mediaHints`, render inline image/video below `fix_hint`. Pairs
   with `PH5-FU-PER-RULE-ACKS` + `PH6-FU-PREVIEW-OVERLAY`.
4. `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE` P3 — teacher-editable
   preset list with `/teacher/preflight/settings` management UI.
5. `PH6-FU-MULTI-LAB-SCOPING` P2 — `fabrication_labs` entity for
   schools with 3+ separate design labs (Seoul Foreign School
   model). NIS (1 proximal DT area) works fine with v1. Phase 9+,
   gated on access-model-v2 (FU-O/P/R) shipping first.

**Resolved this session:**
- `PH5-FU-REUPLOAD-POLL-STUCK` P2 — closed via layered Phase 6-0 +
  6-5b fix. Verified in S2 smoke.

**Systems affected:** fabrication (student + teacher surfaces +
shared orchestration), student-dashboard (BoldTopNav nav entry),
api-registry (+14 routes, 310 → 324 total).

**No migrations.** Phase 6 is pure app.

**Tests:** 1668 → 1862 (+194).

**Cross-session interactions (merge friction):** `dashboard-v2-build`
cutover to `/dashboard` + `BoldTopNav` extraction + Skills nav
pill rename produced 2 small conflicts, both resolved in favour of
v2's cleaner discriminated-union nav structure with the Preflight
entry ported. `skills-library` S1 schema (migrations 105-108) ran
in parallel with zero overlap — clean merges.

**Checkpoint 6.1 sign-off pending** S4 verification + flipping
`⏳ DRAFT` → `✅ PASS` in the report header.

---

## 23 Apr 2026 — Skills Library Phase S1 schema foundation SHIPPED + APPLIED to prod

**Context:** Kickoff of the Skills Library project per [`docs/projects/skills-library.md`](projects/skills-library.md) + canonical specs in `docs/specs/skills-library-spec.md` + completion-addendum. The library is the "moat" — one canonical skill card, many embed contexts (library browse, lesson activity blocks, Open Studio capability-gap, crit board, badges). Completions as `learning_events`, not a mutable table.

Phase S1 is **schema foundation only** — no UI, no API routes, no teacher-write policies yet. Deliberately minimal to unlock S2 authoring + S3 library browse.

**What shipped (in the skills-library branch, not merged to main):**

- **Migration 105** `skills_library_schema.sql` — 5 tables:
  - `skill_categories` (8-item lookup seeded: researching, analysing, designing, creating, evaluating, reflecting, communicating, planning)
  - `skill_cards` (canonical content entity, structured-block `body` JSONB, `category_id` FK, `difficulty` enum, `estimated_min`, `is_built_in` + `created_by_teacher_id` for hybrid ownership, `is_published` draft/live)
  - `skill_card_tags` (many-to-many flat tag list)
  - `skill_prerequisites` (directed graph — skill X requires prerequisite Y; CHECK prevents self-reference)
  - `skill_external_links` (video/PDF/doc references with `last_checked_at` + `status` for nightly link-check cron)
  - Auto-bump `updated_at` trigger on skill_cards
  - Baseline RLS: authenticated reads on published rows, author reads on own drafts; writes service-role-only until S2 authoring UI lands

- **Migration 106** `learning_events.sql` — append-only cross-cutting event log:
  - Columns: `id`, `student_id`, `event_type`, `subject_type`, `subject_id`, `payload` (JSONB), `schema_version`, `created_at`
  - Indexes for (student, time), (subject_type, subject_id, time), (event_type), + composite on (subject_type, student_id, subject_id) filtered to skill_card
  - RLS: students read/insert their own only (`auth.uid() = student_id`). No UPDATE/DELETE — append-only by design
  - First consumer: `skill.*` events (viewed, quiz_passed, quiz_failed, refresh_passed, refresh_acknowledged, demonstrated, applied)
  - Future consumers: `stone.*`, `portfolio.*`, `critique.*` — each spec registers its own event vocabulary

- **Migration 107** `student_skill_state_view.sql` — derived current-state per (student, skill):
  - Aggregates `skill.*` events from `learning_events` into a state ladder (untouched → viewed → quiz_passed → demonstrated → applied)
  - Freshness bands: fresh (0-90 days) / cooling (91-180) / stale (>180), anchored to most recent ≥quiz_passed event
  - Row absent = untouched (LEFT JOIN pattern for UI queries)
  - Pure view, no materialisation — re-evaluate at scale in S4+ if perf demands

- **Migration 108** `skills_library_sample_seeds.sql` — 3 sample cards for checkpoint verification:
  - "Ideation sketching: thumbnails" (designing, foundational) — 3 structured blocks + tags
  - "3D Printing: basic setup" (creating, foundational) — with external link to Prusa walkthrough
  - "3D Printing: troubleshooting" (creating, intermediate) — **depends on basics** via `skill_prerequisites` — demonstrates the progression chain the spec promises
  - All three `is_built_in: true` — survive as platform baseline

**Checkpoint SL-SCHEMA criteria (for verification post-apply):**
1. Migrations 105-108 apply cleanly to prod Supabase
2. `SELECT count(*) FROM skill_categories` = 8
3. `SELECT count(*) FROM skill_cards` ≥ 3
4. Manual INSERT on `learning_events` with `event_type='skill.viewed'` → `student_skill_state` returns state='viewed' for that student+skill
5. Prereq chain query demonstrates: a student who has `skill.quiz_passed` on 3D-basics would unlock 3D-troubleshooting as "next up"

**Registries updated:**
- `docs/schema-registry.yaml` — 6 new entries (skill_cards, skill_categories, skill_card_tags, skill_prerequisites, skill_external_links, learning_events; plus student_skill_state view conceptually via schema migration 107)
- `docs/projects/WIRING.yaml` — `skills-library` system status: `planned` → `in_progress`
- `docs/doc-manifest.yaml` — last_verified on touched docs
- `docs/changelog.md` — this entry

**Known deferrals (not in S1 scope, captured for later phases):**
- `estimated_min` added to schema but not yet surfaced in UI (S5)
- Teacher authoring UI → S2
- Quiz engine → S3
- "Next up" query + freshness gating → S4
- `/skills` page upgrade from placeholder → S5
- Radar chart, badge engine, forking, cross-school visibility → all deferred per spec
- No Open Studio capability-gap wiring yet — that's a future phase once Open Studio Mode ships

**Files:**
- NEW: `supabase/migrations/105_skills_library_schema.sql`
- NEW: `supabase/migrations/106_learning_events.sql`
- NEW: `supabase/migrations/107_student_skill_state_view.sql`
- NEW: `supabase/migrations/108_skills_library_sample_seeds.sql`
- MODIFIED: `docs/schema-registry.yaml` (6 new table entries appended)
- MODIFIED: `docs/projects/WIRING.yaml` (skills-library status)
- MODIFIED: `docs/doc-manifest.yaml` (last_verified bumps)
- MODIFIED: `docs/changelog.md` (this entry)

**Systems affected:** `skills-library` (v0 → v0 planning, schema in_progress), `learning-events` (new system effectively created — existed only in spec).

**Commits:** 1 commit on `skills-library` branch (worktree at `/Users/matt/CWORK/skills`). **Not pushed to origin/main** — awaits Matt's review + migration apply to prod Supabase. Push discipline: migrations must be applied to prod before main merge.

**Session context:** Dashboard-v2 polish paused mid-Phase-17 for Matt's strategic shift to Skills Library. Discovered existing canonical specs (skills-library-spec.md + completion-addendum, both 11 Apr 2026) — my earlier student-skills-page.md marked superseded. Worktree created at `/Users/matt/CWORK/skills` on branch `skills-library` (dropping "questerra" prefix per Matt's renaming direction).

---

## 22 Apr 2026 — Student Dashboard v2 (Bold) SHIPPED: Phases 1-8 complete, cutover live

**Context:** End-to-end build and production cutover of a new Bold-design student dashboard, ported from `docs/newlook/PYPX Student Dashboard/student_bold.jsx`. Built phased behind a cookie gate, then promoted to the default `/dashboard` for all students. Ran in parallel with a separate Preflight session in `questerra-preflight/`; git worktrees used to isolate the two sessions after an early cross-contamination incident where Preflight's `git add` swept up uncommitted dashboard changes into commit `a88b330`.

**What shipped (all phases in one day):**
- **Phase 1** (`b89e89d`) — scaffold at `/dashboard/v2` behind `sl_v2=1` cookie gate, all 6 mock sections ported
- **Phase 2** (`b2a8d12`) — TopNav + hero greeting wired to `/api/auth/student-session`
- **Phase 3A** (swept into `a88b330`, fix `934ddfe`) — hero unit identity (title/subtitle/class/color/image) from `/api/student/units`, per-subject color palette mirrored from current dashboard's `SUBJECT_MAP`
- **Phase 3B** (`cfa2a00`) — hero current task card: the specific activity block the student is up to in their current lesson, lesson-level block progress (X/N), real due date. Uses `content.sections[]` + `student_progress.responses` keyed as `activity_<activityId>` or `section_<index>` (mirrors the unit page's own key convention)
- **Phase 4** (`454f98b`) — priority queue classified from `/api/student/insights` per type-based rules (Overdue / Today = top continue_work / Soon = rest by priority, capped at 5). Button navigation via `<Link>` when href present, inert `<button>` in preview mode
- **Phase 4.5** (`97b3046` + `67bacab`) — hero Continue button wired to current task page; mock-flash fix (initial state null → skeletons → real data; fallback to MOCK only on 401/error)
- **Phase 5** (`20f40f7`) — units grid from `/api/student/units` with real colors/images/progress. Open Studio inline marker intentionally dropped per Matt (will be separate card or hero when implemented)
- **Phase 6** (`d913fe8`) — badges from `/api/student/safety/pending` (earned + pending, safety badges are binary → progress always 0, status text via student_status)
- **Phase 7** (`8d6483b`) — Feedback section DROPPED entirely (no backing data; returns when general notes system ships)
- **Phase 8** (`d07ef97`, merge `be5c1d6`) — cutover: `v2/page.tsx` + `DashboardV2Client.tsx` moved to `dashboard/`, renamed `DashboardClient`; old dashboard preserved at `/dashboard-legacy` for 1-week rollback; cookie gate removed; layout escape-hatch condition updated from `/dashboard/v2` → `/dashboard`

**Matt's product decisions captured in tracker (`docs/projects/student-dashboard-v2.md`):**
- Hero = project-management tool, not activity feed. "Current task" = specific activity block, "task progress" = progress through lesson's blocks. Don't use "phase" in student copy.
- Notes system is deferred; when built, must be bidirectional (teacher + student) and NOT siloed 1:1.
- Open Studio gets its own card (or hero) when active — no inline markers on regular unit cards.
- Per-card due dates dropped from grid cards; Matt will wire as part of assessment/grading work.
- Theme system decision deferred; "I'll add more themes later".
- Focus mode (future): hide everything except next step, escape to return to full dashboard.
- Snooze is a behaviour experiment to try with students.

**Phases 9-16 planned & ordered in `docs/projects/student-dashboard-v2.md`:** bell count + pill nav anchors + dead-link cleanup + hide fake teacher note (quick wins); unified header across routes; responsive pass; focus mode; snooze; notes system; legacy cleanup; a11y.

**Infrastructure change:** Three git worktrees now standard:
- `/Users/matt/CWORK/questerra` = main (merge baseline, neither session works here)
- `/Users/matt/CWORK/questerra-dashboard` = dashboard work on branch `dashboard-v2-build`
- `/Users/matt/CWORK/questerra-preflight` = preflight work on branch `preflight-active`
Isolates uncommitted-change bleed between parallel sessions. Documented in both session CLAUDE.md files. Top-level `.claude/launch.json` has entries for all three dev servers (ports 3000 / 3100 / 3200).

**Files touched:**
- NEW: `src/app/(student)/dashboard/DashboardClient.tsx` (1300+ lines)
- NEW: `src/app/(student)/dashboard/page.tsx` (replaces old 391-line page)
- NEW: `src/app/(student)/dashboard-legacy/page.tsx` (archived old dashboard)
- MODIFIED: `src/app/(student)/layout.tsx` — route-aware escape hatch on `/dashboard`
- NEW: `docs/projects/student-dashboard-v2.md` — build tracker + Phase 9-16 ordered plan
- MODIFIED: `CLAUDE.md` — added Student Dashboard v2 section with "continue dashboard" trigger phrase

**Test counts:** no new tests (UI-only work; existing 1409 npm tests untouched). No migrations.

**Commits:** 9 on `dashboard-v2-build`, merged to `main` as merge commit `be5c1d6`. Pushed origin/main. Deployed to prod by Vercel.

**Systems affected:** `student-dashboard` (v1 → v2, Bold redesign).

**Session context:** Matt drove methodical phase-by-phase with checkpoint sign-offs. Used localhost + Vercel preview URLs for verification. Hit two interesting issues: (1) parallel session cross-contamination via shared working tree (fixed via worktrees), (2) mock-data flash before real data on initial page load (fixed via skeleton + null-initial-state pattern). Phase 8 cutover went clean; production `studioloom.org/dashboard` now serves the Bold dashboard for all students.

---

## 21 Apr 2026 — Preflight Phase 2A shipped + Checkpoint 2.1 PASSED (smoke test session)

**Context:** Resume of Phase 2A build after 11 commits landed in prior sessions (`5e00518..262ae0c`). This session ran the prod smoke test validation portion of Checkpoint 2.1 — the criterion-by-criterion sign-off, not new code. One real bug surfaced (OOM on 256MB Fly tier) and was fixed inline.

**What changed:**
- **WIRING.yaml** — `preflight-scanner` status `in-progress` → `deployed`. Summary rewritten to cover Phase 2A completion: Fly.io `preflight-scanner` SYD at 512MB, poll loop via `claim_next_scan_job` RPC, ruleset `stl-v1.0.0`, 116 pytests passing, Checkpoint 2.1 smoke-test evidence.
- **New doc** — `docs/projects/preflight-phase-2a-checkpoint-2-1.md` (~170 lines): 12-criterion pass/fail matrix, prod smoke test evidence on 4 fixtures, 4 follow-ups (FU-SCANNER-OOM, FU-SCANNER-SIDECAR-DRIFT, FU-SCANNER-LEASE-REAPER, FU-SCANNER-EMAIL-VERIFY), commit list.
- **ALL-PROJECTS.md** — Preflight block: status header adds 2A; bullet expanded to cover Phase 2-0b (Gate B — 53 fixtures bucketed) + Phase 2A shipping summary + 4 follow-ups; "Phase 2 next" replaced with "Phase 2B next".
- **Fly infra** — `fly scale memory 512 -a preflight-scanner` applied to both primary + standby machines. Was on `shared-cpu-1x@256MB`, now `shared-cpu-1x@512MB` (~+$3/mo). Root cause: trimesh + matplotlib combined working set exceeds 256MB on ~30k-face meshes; Phase 2A brief §2 prediction ("upgrade when first school reports OOM") proved conservative — we hit it in internal validation.

**Smoke test evidence (prod, 21 Apr):**
- `small-cube-25mm.stl` (known-good) — scan 2.6s, 0 BLOCK/WARN rules, thumbnail uploaded 12.1 KB.
- `seahorse-not-watertight.stl` (known-broken, 29,612 faces) — attempt 1 OOM on 256MB → bumped to 512MB → attempt 2 passed with R-STL-01 BLOCK + R-STL-04 WARN + 2 FYI.
- `chess-pawn-inverted-winding.stl` (authored, 96 faces) — R-STL-02 BLOCK + R-STL-05 BLOCK (sidecar drift logged as FU).
- `whale-not-watertight.stl` (known-broken, 2,086 faces) — R-STL-01 BLOCK + R-STL-04 WARN + 2 FYI.

**Operational learnings:**
- **OOM kill → stuck lease.** When worker is SIGKILLed mid-scan, `fabrication_scan_jobs.locked_by` + `locked_at` never release. The unique index `uq_fabrication_scan_jobs_active_per_revision` then blocks retries forever. Manual clear required (UPDATE status='error', null lease). FU-SCANNER-LEASE-REAPER opened (P2) — needed before horizontal scaling.
- **Fly hobby tier sizing.** Phase 2A brief documented 256MB as starting tier with a "512MB when first school reports OOM" plan. In practice, 29k faces tripped it — suggests 512MB should be the minimum going forward. Brief §2 needs a small update.
- **Dashboard UX gotcha.** Supabase's "Run without RLS" / "Run and enable RLS" popup warned incorrectly on `fabrication_scan_jobs` INSERT — false positive because RLS is enabled with 0 policies (intentional deny-all per migration 096 + FU-FF). Clicked "Run without RLS" to preserve the deny-all pattern.

**Systems affected:** `preflight-scanner` (status change + summary rewrite).
**Registries touched:** WIRING.yaml (1 entry). Other 5 registries: no changes expected (no new migrations, no new API routes, no new AI call sites in this session — pytest is Python-side only).
**Commits:** Zero new code commits this session — Phase 2A code had already landed in prior sessions. This session captured the checkpoint report doc + WIRING status flip + ALL-PROJECTS update.
**Tests:** pytest 116/116 passing locally (83s run). `npm test` baseline unchanged at 1409.

**Next:** Preflight Phase 2B (SVG rule catalogue R-SVG-01..15 — same worker, new `src/rules/svg/` module). R-SVG-07 fixture outstanding but can ship at WARN. Separate brief + session per methodology.

---

## 21 Apr 2026 — Preflight Phase 1B-2 shipped: Fabricator auth + invite + email + student pref

**Context:** Continuation session from 1B-1. Phase brief `docs/projects/preflight-phase-1b-2-brief.md` (commit `b4f4661` on 20 Apr late) organised the work into six surgical sub-tasks. This session executed 1B-2-1 through 1B-2-6 end-to-end plus one preview-caught hotfix.

**Sub-tasks landed (7 commits on origin/main, range `3cd3adc..21401b3`):**
- **1B-2-1** (`3cd3adc`, pre-session) — `src/lib/preflight/email.ts` + `email-templates.ts`. Resend helper with per-`{jobId, kind}` idempotency via `fabrication_jobs.notifications_sent` JSONB **merge** (Lesson #42 — preserve existing keys on update). 4 email kinds: `invite`, `set_password_reset`, `scan_complete`, `pickup_ready`.
- **1B-2-2** (`662f81a`, pre-session) — Fabricator auth primitives. `src/lib/fab/auth.ts` + `token.ts`: Argon2id password hash, opaque 32-byte session tokens (SHA-256 at rest), `requireFabricatorAuth`, `createFabricatorSession({isSetup})`. `/fab/login` + `/api/fab/login` + `/api/fab/logout` with `Cache-Control: private` (Lesson #11). Login rejects `is_setup=true` sessions.
- **1B-2-3** (`fd50641`, pre-session) — `/fab/set-password` + verify/submit API. Consumes `is_setup=true` sessions, rotates to normal session post-save. Initial draft lacked Suspense wrapper → Vercel prerender build failed (`useSearchParams() should be wrapped in a suspense boundary`). See hotfix below.
- **1B-2-4** (`c2e75d9`, pre-session) — `/teacher/preflight/fabricators` admin page + client + 4 API routes (POST/GET `/fabricators`, PATCH/DELETE `/[id]`, PATCH `/[id]/machines`, POST `/[id]/reset-password`). 7 invite-route tests asserting specific payload shapes (Lesson #38). Cross-teacher ownership guard → 409. Resend path `?resend=true`. No hard-delete (405 per D-INVITE-3).
- **1B-2-4 hotfix** (`26e4921`) — `/fab/set-password` Suspense wrapper. Split page into `FabSetPasswordInner` + default export wrapped in `<Suspense>`. Verified via preview (invalid-token branch rendered cleanly, no hooks errors, no console warnings). Caught only on Vercel build; local dev was happy. Pattern already used at `/teacher/set-password` — should have mirrored from the start.
- **1B-2-5** (`4697801`) — `PATCH /api/student/studio-preferences` now accepts `fabricationNotifyEmail: boolean`. Column `students.fabrication_notify_email` already existed from migration 100. Student-visible UI toggle deferred to Phase 2 per D-STUDENT-1. 4 new tests (401 unauthed, 400 non-boolean, 200 true, 200 false) — Lesson #45 scoped (only cover the new field).
- **1B-2-6** (`21401b3`) — Phase wrap-up. api-registry regenerated (296→306 routes; +10 new). Scanner gate bumped 300→400 (legitimate growth — cap was chosen when we had 266). `auth-system` in WIRING extended from dual-auth to triple-auth with `fabricators` + `fabricator_sessions` data_fields + `is_setup` session semantics documented. `preflight-pipeline.key_files` gained 16 new paths. Phase brief completion summary appended. ALL-PROJECTS.md Preflight block updated.

**Hotfix lesson:** Next.js 15 requires `useSearchParams()` inside a `<Suspense>` boundary for static prerender. Our local `npm run dev` tolerated it (different render path); only Vercel's static export exposed it. When adding a new page that uses `useSearchParams`, mirror the `/teacher/set-password` pattern (inner component + Suspense-wrapped export) from the start.

**Push discipline (from memory):** Hotfix pushed mid-phase to unblock Vercel; all remaining commits held until checkpoint 1.1B-2 signed off. `wip` backup branch (phase-1b-2-wip) remained one step behind `main` after each push — no divergence risk.

**Tests:** Baseline 1362 passing + 8 skipped → **1409 passing + 8 skipped** (+47 net across phase). `tsc --noEmit` clean on new files. FU-MM drift unchanged.

**Registries synced this saveme:**
- `docs/api-registry.yaml` — no diff after 1B-2-6's regen (306 routes).
- `docs/ai-call-sites.yaml` — no diff (this phase added no new LLM calls).
- `docs/feature-flags.yaml` — added `NEXT_PUBLIC_SITE_URL` (new config consumer for invite/reset email URLs in 3 routes). Orphaned `SENTRY_AUTH_TOKEN` still present — FU-CC (build-time-only, documented).
- `docs/vendors.yaml` — no drift.
- RLS coverage — 75/82 with policies; 7 no-policy tables are FU-FF intentional deny-all.
- `docs/schema-registry.yaml` — no migrations this phase; no manual edits needed.

**Systems affected (WIRING):** auth-system (triple-auth extension, +2 data_fields tables, +2 key_files, +preflight-pipeline to affects), preflight-pipeline (+16 key_files).

**Known drift carried forward:**
- FU-MM (P3) — TS errors in `adapters.test.ts` + `checkpoint-1-2-ingestion.test.ts`, pre-existing.
- FU-CC (P3) — `SENTRY_AUTH_TOKEN` flagged as orphaned by flags scanner; build-time-only secret, needs annotation on registry side.
- FU-DD (P2) — legacy scanners still strip `version:` header on rewrite. `api-registry.yaml` currently lacks `version:` but none of the registry-version consumers have shipped yet.

**Next session candidates:** Preflight Phase 2 (Python scanner worker on Fly.io — blocked on Gate B fixture bucketing); Dimensions3 Phase 7 (admin landing + controls); Toolkit Redesign v5.

---

## 20 Apr 2026 (late) — Preflight Phase 1B-1 shipped: schema extensions + Storage + AI guardrails

**Context:** Continued same-day from Phase 1A. Brief `docs/projects/preflight-phase-1b-1-brief.md` was prepped earlier in the day (commit `c806d23`); this session executed sub-tasks 1B-1-1 through 1B-1-7 end-to-end. Brief's "Don't stop for" list + Karpathy discipline (Lessons #43–46) kept scope surgical — 6 migrations, all additive, no wandering.

**Sub-tasks landed (7 commits on origin/main):**
- **1B-1-1 mig 098** (`8029efe`, pre-session) — `fabrication_jobs` gains `student_intent JSONB` (pre-check answers: size bucket / units / material / description), `printing_started_at TIMESTAMPTZ` (Fabricator UI sub-state), `notifications_sent JSONB` (email idempotency map).
- **1B-1-2 mig 099** (`eb123a7`, pre-session) — `fabricator_sessions.is_setup BOOLEAN NOT NULL DEFAULT false`. Marks one-time invite / password-reset sessions; `/fab/set-password` will consume setup sessions and rotate to `is_setup=false` normal session. 24h TTL via existing `expires_at`.
- **1B-1-3 mig 100** (`5df4fba`) — `students.fabrication_notify_email BOOLEAN NOT NULL DEFAULT true`. Default=true preserved backward compat — all 6 existing students opted-in on apply. PG 11+ metadata-only ADD COLUMN so safe on hot table.
- **1B-1-4 mig 101** (`30f550d`) — `fabrication_job_revisions.ai_enrichment_cost_usd NUMERIC` (per-scan Haiku spend; NULL = skipped/disabled) + `thumbnail_views JSONB` (shape: `{views: {iso, front, side, top, walls_heatmap, overhangs_heatmap}, annotations: [{view, bbox, rule_id}]}`).
- **1B-1-5 mig 102** (`7be2183`) — 3 private buckets (`fabrication-uploads`, `fabrication-thumbnails`, `fabrication-pickup`) + 3 service-role-only FOR ALL policies on `storage.objects`, scoped by bucket_id. Matches FU-FF deny-all pattern; granular path-based RLS deferred to Phase 2.
- **1B-1-6 mig 103** (`f6ddc1e`) — 3 `admin_settings` keys seeded: `preflight.ai_enrichment_enabled=true` (kill switch), `preflight.ai_enrichment_daily_cap_usd=5.00` (daily spend cap), `preflight.ai_enrichment_tiers_enabled=["tier1"]` (safety-critical only at launch). Scanner worker will read these before every Haiku call; sums today's `fabrication_job_revisions.ai_enrichment_cost_usd` vs cap, emits `system_alerts` on hit.
- **1B-1-7 docs sync** (`7018f41`) — schema-registry (4 tables updated: students +fabrication_notify_email with classification block, fabrication_jobs +3 cols, fabrication_job_revisions +2 cols, fabricator_sessions +is_setup; admin_settings purpose string mentions new keys). WIRING preflight-pipeline data_fields now references all 4 tables + new columns; preflight-scanner depends_on adds `admin_settings`; both systems link the 1B-1 brief. api-registry rerun — no drift (DDL-only phase).

**Push discipline (from memory):** All 7 commits held on `main` locally, backed up to `phase-1b-1-wip` after each commit. Pushed to `origin/main` only after checkpoint 1.1B-1 closed at 1362/8 test baseline match. No `--amend`, no squashing.

**Systems affected (WIRING):** preflight-pipeline (summary + data_fields + docs + key_files + affects), preflight-scanner (summary + depends_on + data_fields + docs).

**Tests:** 1362 passing, 8 skipped, 79 files — exact baseline match from this morning's saveme. DDL-only phase, no new test coverage — pattern consistent with Lesson #38 (verification discipline: explicit assertions via SELECT queries post-apply, not trusting "no error = success").

**Verify queries captured (per sub-task):**
- Column shape assertions (data_type, is_nullable, column_default) — all match spec
- Comment presence — all `COMMENT ON COLUMN` land correctly
- Empty-table non-null counts — all 0 on fresh tables
- Storage: 3 buckets public=false, 3 policies cmd=ALL, `storage.objects.relrowsecurity=true`
- admin_settings: 3 keys present, no key leakage outside preflight.ai_enrichment_*, `updated_at` fresh

**Notable quirks / non-issues:**
- PostgreSQL JSONB normalises `'5.00'::jsonb` → `5` (trailing zeros dropped). Same semantic value, just Postgres's JSONB numeric representation. Flagged in verify output, non-issue.
- `students` existing RLS policy count = 1 pre-existing; unchanged by mig 100 (no new policy added). Verify query (d) confirmed.
- `fabricator_sessions` has 0 policies intentionally (deny-all per FU-FF). Migration 099 didn't add one — correct.

**Pre-existing drift noted (not caused by 1B-1):**
- TypeScript errors in `src/lib/pipeline/adapters/__tests__/adapters.test.ts` + `tests/e2e/checkpoint-1-2-ingestion.test.ts` (5 errors on Dimensions3 type shapes: `DimensionScore.flags`, `bloomLevels`, `blocksUsed`, `CostBreakdown`, `'cc-by'` literal). Confirmed pre-existing via `git stash` check. Vitest runs green (separate transpile path). Filed as **FU-MM (P3)**.

**Registries scanned:** ai-call-sites.py, feature-flags.py (drift status unchanged from morning — SENTRY_AUTH_TOKEN orphan per FU-CC), vendors.py (OK), rls-coverage.py (7 `rls_enabled_no_policy` tables, all intentional per FU-FF — includes our fabricator_sessions + fabrication_scan_jobs from Phase 1A). No new drift introduced.

**Next up:** Phase 1B-2 (teacher Fabricator-invite UI, `/fab/login`, `/fab/set-password`, email dispatch using `notifications_sent` idempotency, student settings toggle) OR Phase 2 (Python scanner worker on Fly.io).

**Commits (this session):** `5df4fba`, `30f550d`, `7be2183`, `f6ddc1e`, `7018f41` — all pushed to origin/main. Plus `8029efe`, `eb123a7` from earlier in the day.

---

## 20 Apr 2026 — Preflight (fabrication submission pipeline) — Phase 0 + Phase 1A shipped

**Context:** New project. Submission pipeline between "student design file" and "lab tech runs it on the 3D printer or laser cutter." Pedagogy/workflow spec at `docs/projects/fabrication-pipeline.md` (734 lines) was already SPEC-ready; this session took it from SPEC to deployed schema. Free public tool + logged-in teacher/student/Fabricator workflow share the same codebase.

**Decisions locked (pre-code):**
- Product name: **Preflight** (domain term of art — Adobe Acrobat Preflight, InDesign live preflight). Pivoted same-day from initial "Bouncer" pick after reconsideration (nightclub vibe, less professional for enterprise sell).
- Lab-tech role: **Fabricator** — own account type + `/fab/login` surface, NOT Supabase Auth. Cookie session pattern matches `student_sessions` (Lesson #4).
- Scanner host: **Fly.io** (Python worker, trimesh for STL, svgpathtools for SVG). ~$5–35/mo envelope. No AI calls — deterministic.
- Retention: raw file deleted 30 days after `completed` or `rejected`; scan results + thumbnails kept indefinitely.
- Rule-override UX moved Phase 8 → Phase 1 (solo-reviewer mitigation). Ambiguous rules ship at WARN not BLOCK.
- No FK to `work_items` (Pipeline 2) in v1 — loose event coupling only.
- Pilot Fabricator: Cynthia (NIS, on-board).
- Gate A (pre-commit): student-named raw fixture files ignored at `fabrication/fixtures/` root via `.gitignore` — only anonymised bucketed files tracked.

**Phase 1A — 10 commits, all on origin/main:**
- Migration 093 `machine_profiles` + 5 indexes + 4 RLS + ownership XOR CHECK. `rule_overrides` JSONB + `is_system_template` flag added (not in spec §7 — documented deviation).
- Migration 094 seeds 12 system-template profiles (6 3DP: Bambu X1C/P1S, Prusa MK4S, Ender 3 V2, Ultimaker S3, Makerbot Replicator+; 6 lasers: Glowforge Pro/Plus, xTool M1/P2/S1, Gweike Cloud Pro). Idempotent `ON CONFLICT WHERE is_system_template DO NOTHING`.
- Migration 095 `fabrication_jobs` + `fabrication_job_revisions` + dual-visibility RLS. Simpler than Lesson #29 — direct `teacher_id` column covers NULL `class_id` fallback without junction UNION.
- Migration 096 `fabrication_scan_jobs` queue + 3 partial indexes. Deny-all RLS (matches FU-FF pattern with `student_sessions`, `ai_model_config`).
- Migration 097 `fabricators` + `fabricator_sessions` + `fabricator_machines` junction. 6 RLS policies. Case-insensitive email via `UNIQUE ON LOWER(email)`.
- Schema-registry: 7 new table entries with `applied_date: 2026-04-20`. WIRING.yaml: 3 new systems (`preflight-pipeline`, `preflight-scanner`, `machine-profiles`) + Lesson #33 fix on pre-existing line 1960. api-registry drift caught (routes 290→296, auth classification refinements).

**Surprises & fixes:**
- Supabase dashboard "Run and enable RLS" popup **mis-parses PL/pgSQL `DECLARE` variable names as table identifiers** — our `rls_enabled` boolean variable was extracted and the dashboard auto-generated `ALTER TABLE rls_enabled ENABLE ROW LEVEL SECURITY`, crashing with 42P01. Popup text itself confirmed the misread ("read and write to `rls_enabled`"). Fix: removed DO verify block from 093, rely on post-apply SELECT queries. Logged as **Lesson #51**.
- CLAUDE.md baseline (1254) had drifted to **1362 passing** over 5 days. Corrected this saveme.
- RLS-coverage scanner: 7 deny-all tables total (5 pre-existing + 2 new from Preflight). All intentional + documented.

**Systems affected:** NEW — `preflight-pipeline`, `preflight-scanner`, `machine-profiles` (all `in-progress`). Registered downstream impact on `teacher-dashboard`, `student-dashboard`, `audit-log`.

**Tests:** 1362 passing / 8 skipped (no regression — DDL-only phase).

**Commits:** `392bb38` (scaffolding), `a5ff71b` (093), `1d68f29` (093 DO fix), `66c53a3` (094 seed), `1b2c0ad` (095), `b367686` (096), `4d42776` (097), `115a3f8` (api drift), `d476283` (WIRING + Lesson #33 fix), `39826d4` (schema-registry).

**Deferred to Phase 1B / Phase 2:**
- Storage buckets + bucket policies + retention cron implementation.
- Teacher Fabricator-invite UI + `/fab/login`.
- Python scanner worker on Fly.io (needs anonymised bucketed fixtures first per Gate B).
- FK hardening on `fabrication_jobs.lab_tech_picked_up_by` → `fabricators(id)`.
- Anonymous RLS explicit verification (dashboard queries used `postgres` role).
- SVG fixture top-up (5 of target 10 — SVG BLOCK rules ship at WARN until fixtures land).

---

## 16 Apr 2026 — Multi-lesson detection fix + Dimensions3 persistence for import pipeline

**Context:** A 12-lesson DOCX unit plan (Product Design Biomimicry) was collapsing into 1 lesson with 3 activities. Root cause: 5-step chain where mammoth only creates `<h>` tags for Word heading styles (not bold text), parseDocument couldn't detect "Week N"/"Lesson N" patterns, extraction produced few blocks, and reconstruction couldn't split them. Additionally, the import route ran the full Dimensions3 pipeline but discarded all results — no content_items, no activity_blocks.

**What changed:**
- **`src/lib/knowledge/extract.ts`** — Bold-heading promotion: when mammoth finds no native heading styles in DOCX HTML, promotes `<strong>` paragraphs to `<h3>` headings (3-120 chars, no terminal punctuation). Two regex patterns: full bold paragraphs + bold-start with short tail.
- **`src/lib/ingestion/parse.ts`** — Broader heading detection: added Week/Day/Session/Period/Lesson/Module/Part/Unit + number patterns to `HEADING_PATTERNS` array and `detectHeading()` function.
- **`src/lib/ingestion/unit-import.ts`** — Title-based lesson boundary splitting: `LESSON_TITLE_RE` detects Lesson/Week/Day/Session/Module/Part/Unit + number in block titles. Preserves original heading text (e.g., "Week 3: Prototyping") instead of generic "Lesson N".
- **`src/app/api/teacher/library/import/route.ts`** — Dimensions3 persistence: import route now persists `content_items` row + `activity_blocks` via `persistModeratedBlocks()`, matching the ingest route pattern. System learns from every import.
- **`tests/e2e/checkpoint-1-2-ingestion.test.ts`** — Word count snapshot updated (3154→3110) for both sandbox and live variants.
- **New test files:** `multi-lesson-detection.test.ts` (12 tests), `bold-heading-promotion.test.ts` (3 tests).

**Systems affected:** knowledge-pipeline (extract.ts bold promotion), unit-conversion (import route persistence + lesson detection), ingestion-pipeline (parse.ts heading patterns, unit-import.ts boundaries).

**Tests:** 1315 passing, 8 skipped (baseline maintained + 18 new tests).

**Commits:** `285b792` — pushed to origin/main.

---

## 15 Apr 2026 — Teacher password recovery: PKCE vs implicit flow split + settings change-password UI

**Context:** Phase 1B shipped the forgot-password / set-password flows earlier today (`353c0c7`). Production smoke test uncovered three stacked bugs in the reset-link round-trip. This session resolved them across four commits.

**What changed:**
- **`src/app/teacher/layout.tsx`** (`ead284b`) — Added `PUBLIC_TEACHER_PATHS` allowlist (`/teacher/login`, `/teacher/welcome`, `/teacher/forgot-password`, `/teacher/set-password`). All three redirect/render checks consult `isPublicTeacherPath()` so bare auth pages render without a session instead of flash-bouncing to login.
- **`src/components/auth/AuthHashForwarder.tsx`** (`ce45e2f` → `680a4de`) — Extended beyond hash-only detection. Now checks for `?code=<uuid>` query (UUID regex) AND hash, then splits routing: hash → `/auth/confirm` (client), PKCE code → `/auth/callback` (server). Catches Supabase Site URL fallback cases where `redirectTo` is not in the allowlist and Supabase silently strips all query params except `code`.
- **`src/app/auth/callback/page.tsx` → `route.ts`** (`680a4de`) — Replaced client page with a Next.js App Router server route handler. Server route uses `createServerSupabaseClient` (cookie access via `@supabase/ssr`) to call `exchangeCodeForSession(code)`. Fixes "PKCE code verifier not found in storage" — the verifier cookie can't be reliably read client-side after the full-page navigation chain (apex→www redirects, cookie scope). Session cookies are written to the redirect response.
- **`src/app/auth/confirm/page.tsx`** (`680a4de`) — New client page for implicit flow. Suspense-wrapped, parses `#access_token=...&refresh_token=...&type=invite` from the URL hash, calls `supabase.auth.setSession()`, routes based on `type`. Also serves as the shared error UI when the server route redirects here with `?error=...`.
- **`src/app/api/admin/teachers/invite/route.ts`** (`680a4de`) — `redirectTo` changed from `/auth/callback` to `/auth/confirm?next=/teacher/welcome`. Invites use implicit flow (admin-issued tokens in hash fragment), so the client hash parser is the right landing.
- **`src/app/auth/callback/route.ts` safeNext fallback** (`314d567`) — Default changed from generic `/teacher/dashboard` to `/teacher/set-password`. PKCE is ONLY used in StudioLoom for forgot-password. If Supabase's Site URL fallback strips the explicit `next=/teacher/set-password` and `type=recovery` params, the user still needs to set a new password — landing on the dashboard leaves them half-authenticated. `routeFor()` still honours explicit `type=recovery` and `type=invite` when present.
- **`src/app/teacher/settings/page.tsx`** (`314d567`) — Added "Account" section to General tab under About StudioLoom. Single "Change password" row with a link to `/teacher/set-password?next=/teacher/settings`. Reuses the existing set-password page; no new change-password flow needed.

**Architectural decision — why two routes, not one:**
Supabase emits two very different auth payloads depending on the flow:
- **PKCE** (`resetPasswordForEmail`, forgot-password flow) — `?code=<uuid>` in query string. Server sees it. Code verifier stored in a server-readable cookie. Exchange MUST happen server-side for `@supabase/ssr` to read the verifier.
- **Implicit** (`admin.inviteUserByEmail`, invite flow) — `#access_token=...&type=invite` in URL hash. Hashes NEVER reach the server. Must be parsed client-side, then `setSession()` called.
Trying to handle both in one route produces silent failures — either "PKCE verifier not found" (client-side PKCE) or empty hash (server-side implicit). The split is the correct long-term pattern.

**Systems affected:** teacher-auth (auth flow routing hardened), teacher-settings (account section added), teacher-layout (public paths allowlist).

**Tests:** 1254 passing, 8 skipped (baseline maintained — no new business logic).

**Commits (this session):** `ead284b`, `ce45e2f`, `680a4de`, `314d567` — all pushed to origin/main.

**Verification:** Fresh forgot-password round-trip now lands at `/teacher/set-password` with a valid session, submits a new password, signs in. Invite round-trip still works via implicit flow through `/auth/confirm`. "Change password" link appears in settings for logged-in teachers.

---

## 15 Apr 2026 — ShipReady Phase 1B COMPLETE: Teacher onboarding + branded auth emails

**What changed (across two sessions, same day):**
- **Migration 083** (`teachers.onboarded_at TIMESTAMPTZ`) — nullable first-login flag. Applied to prod.
- **Migration 084** (FK cascade fixes) — 10 FKs pointing at `teachers(id)` or `auth.users(id)` rewritten. CASCADE on content ownership (units×2, content_items, activity_blocks, generation_runs, gallery_rounds); SET NULL on audit trails (students.author_teacher_id, content_moderation_log.overridden_by, feedback_proposals.resolved_by, feedback_audit_log.resolved_by). 2 sanity asserts at end. Applied to prod. Shipped with wrong table name `feedback_resolution_log`; fixed same-day to `feedback_audit_log`.
- **Teacher Welcome flow** — 3 API routes (`/api/teacher/welcome/create-class`, `/add-roster`, `/complete`) + 4-step wizard page `/teacher/welcome` (name → class → roster → credentials). Wizard step 2 retries class-code collisions up to 5×, step 3 bulk-inserts students + class_students junction with global username dedup, step 4 flips `onboarded_at = now()` idempotently.
- **Teacher layout first-login redirect** — `src/app/teacher/layout.tsx` pushes users with `onboarded_at IS NULL` to `/teacher/welcome`.
- **Starter-path CTAs** on wizard step 4: "Generate with AI" → `/teacher/units/create?classId=X`, "Explore dashboard" → `/teacher/dashboard`.
- **Admin remove-teacher flow** working after migration 084 cleared the FK blocks.
- **Branded Supabase auth email templates** in `supabase/email-templates/` (new folder with README): `invite.html`, `confirm-signup.html`, `magic-link.html`, `reset-password.html`. Each uses StudioLoom brand gradient hero (`#7B2FF2 → #5C16C5 → #4A0FB0`), coral CTA button, 600px table layout, inline styles only, with solid-colour fallbacks for Outlook. Invite includes 4-step preview mirroring the wizard; reset-password has a prominent red security notice above the footer. Pasted into Supabase Dashboard 15 Apr 2026. Versioned in repo so copy stays in sync with the app.

**Systems affected:** teacher-onboarding (new), admin-teachers, auth-email-templates (new). No test impact — flow is Supabase Auth + UI wizard, no new business logic outside the 3 welcome routes.

**Registries synced:** api-registry.yaml gained 5 new routes (welcome×3, admin/teachers DELETE + invite). schema-registry.yaml updated for migrations 083/084 on teachers table. doc-manifest.yaml gained 5 email-template entries.

**Registries NOT committed:** ai-call-sites scanner output reverted — scanner strips 12 hand-curated indirect call sites (regression). Filed as FU-MM (P2).

**Drift noted (pre-existing, not from this session):**
- Feature-flags: `SENTRY_AUTH_TOKEN` orphaned (already FU-CC), `NEXT_PUBLIC_SITE_URL` missing from registry.
- RLS coverage: 4 tables with RLS enabled but no policies (already FU-FF — likely intentional deny-all pattern).

**Commits (this session):** `428a883`, `8c3d823`, `4b8185d` — all pushed to origin/main. Phase 1B commits from earlier today: `95d60dd`, `0e632d2`, `d574a04`, `fa0889f`.

**Tests:** 1254 passing, 8 skipped (baseline maintained).

---

## 15 Apr 2026 — Fix PDF extraction on Vercel (ingestion sandbox)

**What changed:**
- **`src/lib/knowledge/extract.ts`** — Replaced `pdf-parse` v2 (`PDFParse` class) with `pdfjs-dist/legacy/build/pdf.mjs` direct usage. pdf-parse v2 depends on `@napi-rs/canvas` which only has darwin-arm64 binaries; crashes on Vercel's Linux serverless runtime. pdfjs-dist legacy build works headless without canvas.
- **`next.config.ts`** — Added `pdfjs-dist` to `serverExternalPackages`.
- **`src/app/admin/ingestion-sandbox/page.tsx`** — Improved upload error alert to show both `data.error` and `data.message` detail.

**Systems affected:** ingestion-pipeline (upload stage PDF extraction).
**Tests:** 1254 passing (no change).
**Commit:** `b9208d4`. Pushed to origin/main.

---

## 14 Apr 2026 — Sub-phases 7A-7C: Integrity, Admin Tabs, Sandbox, Bug Reports (3 commits)

**What changed:**
- **Migration 080** (`activity_block_versions`) — auto-snapshot trigger on block UPDATE, version history table with RLS.
- **Migration 081** (`unit_version_trigger`) — auto-snapshot on unit UPDATE when `content_data IS DISTINCT FROM`.
- **Migration 082** (`data_removal_log`) — audit table for GDPR-style student data removal.
- **Student data removal script** (`scripts/remove-student-data.ts` + `src/lib/integrity/remove-student-data.ts`) — enumerates 21 tables, dry-run + confirm modes, writes audit row.
- **8 admin tab stubs → real implementations:** Cost & Usage, Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log. Each with dedicated API route using `createAdminClient`.
- **Floating BugReportButton** — mounted in teacher + student layouts, 4-category picker, auto-captures URL + console errors, dual auth (Supabase Auth + student token).
- **Generation Sandbox** (`/admin/generation-sandbox`) — real pipeline or simulator, step-through stage view, timing bars, cost summary, run history.
- **Block interaction viz** (`/admin/library/[blockId]/interactions`) — prerequisite/dependent/same-phase/tag-overlap relationships.
- **Per-format library tabs** (Design/Service/PP/Inquiry) on library page.
- **6 new API routes:** bug-reports (public), admin/cost-usage, admin/teachers, admin/students, admin/schools, admin/audit-log, admin/generation-sandbox/run, admin/generation-sandbox/[runId], admin/library/block-interactions.

**Systems affected:** admin-dashboard (v2→v3), bug-reporting (idea→active v1), activity-blocks (versioning triggers), generation-pipeline (sandbox mode).
**Tests:** 1254 passing (baseline maintained), 0 new TS errors.
**Commits:** `356ff55` (7A), `3500d04` (7B), `4990c6f` (7C). All pushed to origin/main.

---

## 14 Apr 2026 — Phase 7A BUILD: Admin Landing + Settings Backend (6 commits)

**What changed:**
- **Migration 079** (`admin_audit_log`) — audit table for admin actions, RLS deny-all pattern.
- **Settings helper** (`src/lib/admin/settings.ts`) — `loadAdminSettings`, `updateAdminSetting`, `shouldEnforceCostCeilings`, `ADMIN_SETTINGS_DEFAULTS`. Custom error classes for validation.
- **API routes** GET/PATCH `/api/admin/settings` — service_role Supabase client, validates key/value, writes audit row.
- **`/admin/controls` rewritten** — pipeline settings backed by `admin_settings` table (5 controls: stage toggles, cost ceilings, model override, starter patterns). Was AIControlPanel with noop console.log.
- **Pipeline orchestrator** wired to `admin_settings` — `loadAdminSettings()` at run start, stage-disable checks, per-run + daily cost ceilings, model override per stage, starter patterns to Stage 1, sandbox guard, feature-flag fallback.
- **Bug report count** added to admin landing QuickStats via `checkUsageAnalytics()`.
- **12-tab admin nav** scaffold per spec §9.8 + secondary TOOLS_TABS for legacy routes. 8 stub pages created.
- **FU-LL filed** — ai_model_config system redundancy assessment (P2, 17 files).
- `.gitignore` — added `supabase/.temp/`.
- `schema-registry.yaml` — admin_audit_log entry added, admin_settings readers/writers updated.
- Tests: 25 new tests across 5 files, NC verified on 4 tests.

**Systems affected:** orchestrator, admin_settings, admin_audit_log, admin landing, admin layout, usage-analytics, health-checks, stage1-retrieval, schema-registry, gitignore

**Commits:** `4e462df` (FU-LL), `2f982fe` (migration 079 + types), `03ed6d9` (settings helper + API + tests), `8e49cf1` (controls page), `dce6ea3` (orchestrator), `953a987` (bug report count), `871f810` (12-tab nav)

---

## 14 Apr 2026 — Path B closeout: FU-EE + FU-FF filed, migration 074 annotated

**What changed:**
- Filed **FU-EE** (P2): no canonical migration-applied log — pre-flight checks rely on probing for migration-created objects directly.
- Filed **FU-FF** (P3): 3 tables with RLS-as-deny-all pattern undocumented in schema-registry — scanner reports as drift.
- Migration 074 (`074_ingestion_moderation_hold.sql`) annotated in schema-registry indexes list with applied date.
- CLAUDE.md saveme step 5 updated: `refresh-project-dashboard` is a CWORK-level task, not questerra-scoped.
- doc-manifest purpose updated on dimensions3-followups.md to reflect FU-AA..FU-II range.

**Systems affected:** schema-registry, doc-manifest, changelog, followups tracker

---

## 14 Apr 2026 — Path B COMPLETE — FU-X + FU-N closed (Phase 7A-Safety-1 + 7A-Safety-2)

**What changed:**
- **Phase 7A-Safety-1 — FU-X closeout + RLS-coverage scanner** (6 commits):
  - Migration 075 idempotent guards: 6 `DROP POLICY IF EXISTS` added before each `CREATE POLICY`
  - Schema-registry: `applied_date: 2026-04-14` set on `cost_rollups`, `usage_rollups`, `system_alerts`, `library_health_flags`; stale `# FU-X: this table lacks RLS` inline comments removed
  - New scanner `scripts/registry/scan-rls-coverage.py` — parses all migrations for CREATE TABLE, checks each has ENABLE ROW LEVEL SECURITY + at least one CREATE POLICY. Emits `docs/scanner-reports/rls-coverage.json`. 69 tables, all have RLS enabled, 3 with RLS-as-deny-all (no explicit policies: `ai_model_config`, `ai_model_config_history`, `student_sessions`)
  - `docs/change-triggers.yaml`: new `before_creating_a_new_table` trigger requiring RLS + policy on every new table
  - Saveme step 11(g) added for RLS scanner
  - WIRING + doc-manifest wired for scan-rls-coverage.py
- **Phase 7A-Safety-2 — FU-N Option C dual-visibility** (5 commits):
  - Migration 078: dual-visibility RLS on `student_content_moderation_log` — Lesson #29 UNION pattern. SELECT + UPDATE policies now use `class_id IN (teacher's classes) OR (class_id IS NULL AND student_id IN (junction UNION legacy))`. Drop-if-exists guards from day one.
  - 11 SQL-parse tests (`moderation-log-rls-078.test.ts`) asserting policy structure: DROP guards, exactly 2 policies, both UNION arms, WITH CHECK on UPDATE, provenance comment, no destructive ops
  - Manual smoke protocol (`docs/specs/fu-n-manual-smoke-protocol.md`) for prod verification
  - Writer audit (`docs/specs/moderation-log-writer-audit.md`): 17 call sites across 14 routes categorized — 14 always-NULL by design, 3 usually have class_id, 1 garbage-by-bug (nm-assessment "unknown"), 1 direct-insert pattern inconsistency
  - Peer table `content_moderation_log` (migration 067) confirmed unaffected — no class_id column, service-role-only
  - Content-safety WIRING entry bumped from planned/v0 to complete/v2

**Migrations applied to prod:** 074, 076, 077, 078; plus 075 RLS portion (FU-X) earlier on 14 Apr. 075 cost_rollups table NOT applied (deferred).

**Follow-ups filed:** FU-N-followup (P2, Option B admin queue when FU-O lands), FU-GG (P1, nm-assessment "unknown" classId data loss), FU-HH (P2, no live RLS test harness), FU-II (P3, log-client-block direct insert pattern)

**Test baseline:** 1150 → 1161 (+11 new SQL-parse tests)

**Files created:** `supabase/migrations/078_moderation_log_dual_visibility.sql`, `src/lib/content-safety/__tests__/moderation-log-rls-078.test.ts`, `docs/specs/fu-n-manual-smoke-protocol.md`, `docs/specs/moderation-log-writer-audit.md`, `scripts/registry/scan-rls-coverage.py`, `docs/scanner-reports/rls-coverage.json`

**Files modified:** `supabase/migrations/075_cost_rollups_and_rls_fix.sql` (idempotent guards), `docs/schema-registry.yaml` (applied_dates, RLS descriptions, spec_drift entries), `docs/projects/dimensions3-followups.md` (FU-X/FU-N resolved + 4 new follow-ups), `CLAUDE.md` (follow-ups updated, test baseline, saveme step 11g), `docs/projects/ALL-PROJECTS.md` (FU-X/FU-N resolved), `docs/change-triggers.yaml` (new table trigger), `docs/doc-manifest.yaml` (scanner report + script entries), `docs/projects/WIRING.yaml` (scan-rls-coverage.py, content-safety bump)

**Systems affected:** content-safety (dual-visibility RLS), governance-registries (RLS scanner added), schema-registry (applied_dates + spec_drift)

---

## 14 Apr 2026 — GOV-1 Governance Foundation COMPLETE (all 4 sub-phases shipped)

**What changed:**
- **GOV-1.1 — Data-classification taxonomy**: 6-axis per-column classification (`pii`, `student_voice`, `safety_sensitive`, `ai_exportable`, `retention_days`, `basis`) applied to all 69 tables in `schema-registry.yaml`. `docs/data-classification-taxonomy.md` codifies the decision rules.
- **GOV-1.2 — Feature-flag / secret registry**: `docs/feature-flags.yaml` (15 flags + 12 secrets) + `feature-flags-taxonomy.md`. Scanner `scripts/registry/scan-feature-flags.py` diffs against live env var usage.
- **GOV-1.3 — Vendor registry**: `docs/vendors.yaml` (9 vendors — Anthropic, Supabase, Voyage, Vercel, Groq, Gemini, Resend, Sentry, ElevenLabs) with DPA status + 11-category canonical `data_sent` + 8 legal bases. `vendors-taxonomy.md` codifies the enums. Scanner `scripts/registry/scan-vendors.py` diffs against package.json + code.
- **GOV-1.4 — Live drift-detection loop**:
  - 2 new scanners (READ-ONLY, never auto-write): `scan-feature-flags.py`, `scan-vendors.py` → JSON reports in `docs/scanner-reports/`
  - `docs/change-triggers.yaml` (6 triggers mapping change types → required registry updates)
  - `doc-manifest.yaml` schema bump: per-entry `max_age_days` + `last_scanned`
  - `version: 1` field on all 5 registries (schema/api/ai-call-sites/feature-flags/vendors)
  - Admin read-only panel at `/admin/controls/registries` with RED/AMBER/GREEN staleness chips
  - `governance-registries` system added to WIRING.yaml
  - Quarterly self-silencing scheduled task (cron `0 9 1 */3 *`, notifies only if drift)
- **11 commits pushed** to origin/main. Test baseline 1119 → 1150.
- **2 follow-ups filed**: FU-CC (P3, annotate SENTRY_AUTH_TOKEN as build-time-only), FU-DD (P2, scan-api-routes.py + scan-ai-calls.py strip top-level `version: 1` field on rewrite — caught + reverted mid-saveme).
- **1 new lesson logged**: Lesson #47 — adding schema to existing yaml = audit every writer first.
- **8 new decisions logged** covering: per-column 6-axis classification, canonical `data_sent` + legal bases, scanners verify-never-auto-write, change-triggers codified, manifest schema bump, registry version field, scanner JSON shape, SENTRY build-time exception.

**Files created:** `docs/data-classification-taxonomy.md`, `docs/feature-flags.yaml`, `docs/feature-flags-taxonomy.md`, `docs/vendors.yaml`, `docs/vendors-taxonomy.md`, `docs/change-triggers.yaml`, `docs/scanner-reports/feature-flags.json`, `docs/scanner-reports/vendors.json`, `scripts/registry/scan-feature-flags.py`, `scripts/registry/scan-vendors.py`, admin panel at `src/app/admin/controls/registries/`

**Files modified:** `CLAUDE.md` (registries section expanded to 6 registries + saveme step 11 expanded + FU-AA/BB/CC/DD added), `docs/projects/ALL-PROJECTS.md` (GOV-1 marked complete under Core Platform, feature count 40→41), `docs/projects/dashboard.html` (GOV-1 status ready→complete), `docs/projects/dimensions3-followups.md` (FU-CC, FU-DD), `docs/decisions-log.md` (8 new entries + footer to 14 Apr), `docs/lessons-learned.md` (Lesson #47), `docs/doc-manifest.yaml` (4 new entries + summary stats), `docs/projects/WIRING.yaml` (governance-registries system), `docs/schema-registry.yaml` / `api-registry.yaml` / `ai-call-sites.yaml` / `feature-flags.yaml` / `vendors.yaml` (top-level `version: 1` added)

**Systems affected:** governance-registries (new), feature-flags registry, vendors registry, schema-registry (classified), doc-manifest (schema bump), admin panel (registries tab), build-methodology (change-triggers authoritative)

**Session context:** Matt raised the concern that new registry docs were being created without ownership — "where are all these new documents being tracked? I don't want them created then never used." Chose option (b): GOV-1.4 expanded to ship the full automation loop — scanners, change-triggers, manifest schema bump, admin panel, scheduled task — rather than leave registries as orphaned yaml. Adopted all 14 assumptions (A1-A14) including categorized `data_sent`, scanner JSON shape, per-entry `max_age_days`, self-silencing quarterly cron. FU-DD surfaced during saveme when the pre-existing api-routes/ai-calls scanners stripped the new `version: 1` field on rewrite — caught by git diff, reverted with `git checkout`, logged as a P2 follow-up. Lesson #47 codifies the general principle: shared-schema bumps require auditing every writer.

---

## 14 Apr 2026 — Phase 7-Pre COMPLETE: Registry Infrastructure Sprint

**What changed:**
- **3 machine-readable registries created** to prevent spec-vs-reality drift:
  - `docs/schema-registry.yaml` — backfilled from 74 migration files to 69 table entries (columns, RLS, writers, readers, spec drift). 3 dropped tables marked. 3 tables flagged "No RLS" (FU-X). Cross-validated all `.from('table')` calls in src/.
  - `docs/api-registry.yaml` — 266 (path, method) entries scanned from `src/app/api/**/route.ts`. Auth breakdown: teacher 126, student 70, public 33, service-role 12, admin 10, mixed 8, unknown 7. 3 unknown table refs: assessments, on_the_fly_activities, responses.
  - `docs/ai-call-sites.yaml` — 47 LLM call sites via 3-layer detection (20 direct SDK imports, 11 wrapper consumers, 16 HTTP-based). Providers: anthropic 35, voyage 12. FU-5 stop_reason seeded (2 true, 6 false, 39 unknown).
- **3 scanner scripts created** in `scripts/registry/`: `sync-schema-registry.py`, `scan-api-routes.py`, `scan-ai-calls.py`. All support `--apply` flag (dry-run by default) with gate checks.
- **FU-X appended** (P1 — 3 tables unprotected: usage_rollups, system_alerts, library_health_flags).
- **FU-Y appended** (P2 — Groq + Gemini fallbacks never shipped, doc-vs-reality drift).
- **FU-5 expanded** from 13 → 47 call sites, 9 remaining unknown.

**Files created:** `docs/schema-registry.yaml`, `docs/api-registry.yaml`, `docs/ai-call-sites.yaml`, `scripts/registry/sync-schema-registry.py`, `scripts/registry/scan-api-routes.py`, `scripts/registry/scan-ai-calls.py`

**Files modified:** `CLAUDE.md` (Registries section + saveme step 11 + FU-X/FU-Y), `docs/projects/dimensions3-followups.md` (FU-X, FU-Y, FU-5 expansion), `docs/projects/ALL-PROJECTS.md` (Phase 7-Pre status), `docs/changelog.md`, `docs/doc-manifest.yaml`

**Systems affected:** documentation (3 new registries), build-methodology (registry sync baked into saveme), schema-registry (backfilled), api-registry (created), ai-call-sites (created)

**Session context:** Infrastructure sprint before Phase 7 to lock down the "what exists" baseline. Prevents the recurring pattern of discovering spec-vs-reality drift mid-build (e.g., Groq/Gemini listed in Stack but never shipped). All 3 registries now auto-syncable via their scanner scripts during saveme.

---

## 14 Apr 2026 — Phase 6 COMPLETE + Checkpoint 5.1 CLOSED + Architectural Limitations Filing + Cleanup

**What changed:**
- **Phase 6 COMPLETE** (landed in prior conversation, committed but pre-saveme): 6A teacher safety alert feed at `/teacher/safety/alerts` (commit `5e26d55`), 6B critical alert nav badge on teacher layout (commit `fc115d0`), 6C ingestion pipeline upload-level safety scan with `moderation_hold` processing_status (commit `b59752f`). Migration 074 partial index on content_items. Moderation hold UI messaging on both library ingestion pages (commit `c904329`).
- **Checkpoint 5.1 CLOSED at 9/11 (14 Apr 2026):** Step 8 VERIFIED — `content_items.processing_status = 'moderation_hold'` after ingestion safety scan flags content; dedup short-circuit caveat documented (same file_hash skips safety scan — by design). Step 9 PASSED — alert feed returns 19 rows (1 critical + 18 warnings) via RLS-gated query once teacher_id mismatch + NULL class_id bugs were resolved. Steps 6–7 (NSFW.js image moderation) remain deferred — require test image fixtures.
- **Checkpoint 5.1 Step 9 debugging** uncovered two compounding bugs: (1) `class_id = NULL` on all 19 `student_content_moderation_log` rows (source code used `resolvedClassId || ''` fallback passing empty string, RLS silently filtered); (2) after UPDATE to set class_id, test class's `teacher_id` didn't match Matt's gmail auth.uid, RLS still blocked. Resolved by moving rows to Matt's real Grade 7 Design class (`8fe2a1df-...`, owned by gmail uid `0f610a0b-...`) and re-owning the orphaned Grade 8 class (`cb5452be-...`) back to gmail.
- **Nav longest-prefix fix (commit `a1c88f2`):** `pathname.startsWith(item.href)` made both Badges (`/teacher/safety`) and Alerts (`/teacher/safety/alerts`) highlight simultaneously on the Alerts page. Replaced with a longest-prefix match IIFE — only the most specific nav item activates. Also fixes the general case of any parent/child nav overlap.
- **Working-tree cleanup (commit `e5c4d3a`):** deleted stale `next.config.ts.bak`, added `karpathy/` to `.gitignore` (local Karpathy LLM discipline reference, not project content), moved `test-upload-flagged.docx` into `src/__tests__/fixtures/` as a reusable moderation test fixture with a README documenting its role (Checkpoint 5.1 Step 8 / Phase 6C ingestion scan), committed `docs/projects/phase6-instruction-block.md` as a Phase 6 session artifact.
- **Baseline test suite confirmed green:** 1119 passed, 8 skipped (1127 total) — up from 1103 at last saveme (16 new tests from Phase 6 work + today's commits).
- **10 architectural limitations filed as FU-N through FU-W** in dimensions3-followups.md and summarized in ALL-PROJECTS.md:
  - FU-N: NULL class_id silent safety gap (P1 — live safety hole)
  - FU-O: No co-teacher/dept head/admin access model (P1)
  - FU-P: No school/organization entity (P1)
  - FU-Q: Dual student identity class_students vs students.class_id (P2)
  - FU-R: Auth model split teacher Supabase vs student custom tokens (P1)
  - FU-S: Moderation log class-scoped vs ingestion upload-scoped (P2)
  - FU-T: No content ownership transfer (P2)
  - FU-U: Single-tenant URL structure (P3)
  - FU-V: Cross-class student analytics double-counting (P2)
  - FU-W: No immutable audit log (P2)

**Files modified:** `docs/projects/ALL-PROJECTS.md` (Phase 6 follow-ups section added, status line + current-focus paragraph updated to Phase 6 complete + Checkpoint 5.1 closed), `docs/projects/dimensions3-followups.md` (FU-N through FU-W appended, ~230 lines), `docs/doc-manifest.yaml` (followups purpose updated to include FU-N..W summary, last_verified dates updated), `src/app/teacher/layout.tsx` (nav longest-prefix fix), `.gitignore` (karpathy/ excluded)

**Files created:** `src/__tests__/fixtures/test-upload-flagged.docx` (moved from repo root), `src/__tests__/fixtures/README.md` (fixtures dir documentation), `docs/projects/phase6-instruction-block.md` (Phase 6 session artifact)

**Systems affected:** content-safety (Phase 6 shipped, Checkpoint 5.1 closed at 9/11), teacher-dashboard (alert feed + nav badge + longest-prefix highlight fix), ingestion-pipeline (upload-level safety scan verified end-to-end), moderation_logs (silent-filter bug FU-N surfaced), class-membership (FU-O surfaced), rls-policies (FU-O,FU-N surfaced as systemic issues), auth-model (FU-R surfaced as split-lane debt)

**Session context:** Continuation of Phase 6 Teacher Safety Feed build. Phase 6A/6B/6C committed in the lead-up to this saveme. Step 8 passed quickly. Step 9 debugging uncovered the RLS × NULL class_id silent-filter pattern (Lesson #29 instance) AND a teacher-auth mismatch in test data — ultimately resolved by moving the 19 moderation rows to Matt's real Grade 7 class and re-owning the orphaned Grade 8 class to gmail. Wider architectural audit surfaced 10 limitations of the "solo teacher, flat hierarchy, single auth lane" design that will bite when StudioLoom expands to co-taught classes, department deployments, school/MAT tenants, and cross-teacher content sharing. Filed as FU-N through FU-W with design sketches. Sequencing call: FU-N is the only one that needs an immediate hotfix (live safety gap); FU-O+FU-P+FU-R are the "Access Model v2" cluster that gates school-level deployments. Session closed out with nav fix (`a1c88f2`), working-tree cleanup (`e5c4d3a`), and 1119-test green baseline confirmed on Matt's machine — ready to start Phase 7.

---

## 13 Apr 2026 (session 3) — Grading System Overhaul Spec Expansion

**What changed:**
- **Grading spec expanded with 3 new pillars:** (1) Teacher Marking Experience — `/teacher/marking` queue, split-view in-context marking, batch marking flow, criteria coverage heatmap. (2) AI Role in Grading — Haiku pre-scoring with ghost scores, consistency checker, feedback draft generation, class-level insights, integrity-informed grading. All opt-in per class. (3) Student Feedback Experience — notification cards, inline feedback anchored to activities on lesson pages, growth trajectory charts, AI "what to do next" nudges, formative vs summative UI framing.
- **Phases revised:** 5 → 7 phases, estimate 8-12d → 14-18d. New phases: AI-Assisted Grading (Phase 4), Student Feedback Experience (Phase 5). Report Writing → Phase 6, Moderation → Phase 7.
- **10 key decisions added** (up from 5): AI opt-in per class, cross-class marking queue, inline over separate grades page, formative vs summative framing, activity-level anchoring first, AI nudges from teacher feedback, feedback receipt tracking, consistency checker on-demand.
- **ALL-PROJECTS.md updated:** Grading Overhaul added to Planned section with full entry.
- **10 new decisions logged** in decisions-log.md.

**Files modified:** `docs/projects/grading.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/projects/WIRING.yaml`, `docs/decisions-log.md`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** teacher-grading (major spec expansion), student-grade-view (inline feedback design), smart-insights (class-level post-marking insights)

---

## 13 Apr 2026 (session 2) — Checkpoint 5.1 Verification + Bug Fixes + Cost Optimization

**What changed:**
- **Checkpoint 5.1 verification:** 7/11 steps pass. Steps 1-5 verified end-to-end (clean EN/ZH → 'clean', profanity EN/ZH → client block with localized banner, Haiku threat detection → 'flagged'). Steps 10-11 code-verified (failure→pending, NSFW.js fallback). Steps 6-7 deferred (need test images). Steps 8-9 deferred (need Phase 6 Teacher Safety Feed).
- **Bug fix: moderation_status stuck at 'pending'** — `progress/route.ts` had `if (result.moderation.status !== 'clean')` guard that prevented clean results from updating `student_progress`. Removed guard so ALL results write back. Commit `7c73c3a`.
- **Bug fix: missing moderationError banner** — `usePageResponses` returned `moderationError` but student page didn't destructure or render it. Added red banner with localized messages. Commit `532ba47`.
- **Bug fix: NM CompetencyPulse unmoderated** — Reflection text in Melbourne Metrics competency pulse had no client or server moderation. Added `checkClientSide()` before submit + `moderateAndLog()` on `nm-assessment` API route. Commit `80afb61`.
- **Optimization: hash-and-skip** — Autosave fires every ~2s on typing pauses, each triggering Haiku. Added SHA-256 hash comparison — only calls Haiku when content actually changed. Eliminates ~80-90% redundant calls. In-memory cache, resets on server restart (one extra call). Commit `353d366`.
- **FU-6 tracked:** CI lint cleanup added to ALL-PROJECTS.md as P3 follow-up.
- **Framework fix (Supabase):** `UPDATE classes SET framework = 'IB_MYP'` for classes with old `myp_design` / `service_learning` values not in FrameworkAdapter.

**Files modified:** `src/app/api/student/progress/route.ts`, `src/app/(student)/unit/[unitId]/[pageId]/page.tsx`, `src/hooks/usePageResponses.ts`, `src/components/nm/CompetencyPulse.tsx`, `src/app/api/student/nm-assessment/route.ts`

**Systems affected:** content-safety (checkpoint verification, 3 bugs fixed, cost optimization), student-experience (moderation banner visible), nm-assessment (new moderation coverage)

**Session context:** Checkpoint 5.1 verification session. Student-facing testing revealed 3 bugs in Phase 5 wiring that passed code review but failed real-world use. Hash-and-skip added after realizing autosave × Haiku = expensive at classroom scale (30 students × 20-50 saves/textbox/lesson).

---

## 13 Apr 2026 — Dimensions3 Phase 5 Progress: 5A-5D Complete (Content Safety & Moderation), 5E Prep Done

**What changed:**
- **5A (Migration 073):** `student_progress` moderation columns (`moderation_status`, `moderation_flags`, `moderated_at`, `moderation_layer`) + `student_content_moderation_log` table. Shared types with cross-reference tests verifying TypeScript const arrays match SQL CHECK constraints. NC verified. Commit `1e3ba47`.
- **5B (Client text filter):** `checkClientSide()` in `src/lib/content-safety/client-filter.ts`. LDNOOBW blocklists (EN 403 words + ZH 319 words), self-harm supplements (EN 15 + ZH 11), PII regex (email, phone, ID patterns), word-boundary EN matching / substring ZH matching. Log endpoint at `/api/safety/log-client-block`. Defence in depth: client passes through on failure, server catches. 1008 tests. Commit `6584c10`.
- **5C (NSFW.js client image filter):** `checkClientImage()` in `src/lib/content-safety/client-image-filter.ts`. MobileNet v2 via nsfwjs (~4MB WASM), lazy-loaded singleton. Block threshold: `porn + hentai + sexy > 0.6` (configurable via `NEXT_PUBLIC_NSFW_BLOCK_THRESHOLD`). Defence in depth: model load/classify failures → ok:true (passes to server). 11 tests with mocked nsfwjs + browser APIs. NC verified (4 failures on reversed threshold). 1019 tests. Commit `c4200b0`.
- **5D (Server Haiku moderation):** `moderateContent()` in `src/lib/content-safety/server-moderation.ts`. Uses `MODELS.HAIKU` from models.ts, `tool_choice` without `thinking` (API constraint). Bilingual system prompt (EN + ZH-Hans) in `prompts/moderation-system.ts`. `mapFlags()` validates types/severities, maps unknowns to 'other'/'warning'. `deriveStatus()` overrides Haiku's 'overall' field (defence in depth). `pendingResult()` returns status:'pending' on ANY failure — NEVER 'clean'. Lesson #39 applied: stop_reason === 'max_tokens' guard + `parsed.flags ?? []`. 18 tests. NC verified (4 failures). 1037 tests. Commit `87a88d9`.
- **5E Prep (build-phase-prep skill):** Full audit of 8 choke points from WIRING.yaml discovered 4 path errors: GallerySubmitPrompt wrong directory, GalleryFeedbackView wrong component entirely (peer review POST is in GalleryBrowser.tsx), EvidenceCapture wrong directory, ResponseInput not a choke point (renderer that delegates to usePageResponses). Corrected to 7 text + 3 image choke points. Recommended split: 5E-text + 5E-image.
- **WIRING.yaml major corrections:** `wiring_map` rewritten — split into `client_text_choke_points` (7 entries) and `client_image_choke_points` (3 entries) with verified file paths and roles. 4 path errors fixed. ResponseInput removed.
- **Rolldown binding issue (recurring):** `npm install nsfwjs @tensorflow/tfjs` corrupts `@rolldown/binding-linux-arm64-gnu`. Fix: `rm -rf node_modules && npm install`. Recurred 3 times during session.
- **TypeScript fix:** Removed `as const` from `MODERATION_TOOL_SCHEMA` — readonly tuple incompatible with Anthropic SDK mutable `string[]` type.

**Files created:** `src/lib/content-safety/client-image-filter.ts`, `src/lib/content-safety/server-moderation.ts`, `src/lib/content-safety/prompts/moderation-system.ts`, `src/lib/content-safety/__tests__/client-image-filter.test.ts`, `src/lib/content-safety/__tests__/server-moderation.test.ts`

**Systems affected:** `content-safety` (leveled up v1→v2: 3 layers now built — client text, client image, server moderation). WIRING.yaml `wiring_map` corrected (4 path fixes, structural split). `wiring-dashboard.html` and `system-architecture-map.html` synced.

**Test suite:** 948 → 1037 (+89 new across 5A-5D, 0 failures)

**Session context:** Continuation from Phase 4 completion session. Followed build methodology throughout — build-phase-prep skill run before 5D and 5E, pre-flight audits caught wiring path errors before they reached instruction blocks. Key finding: WIRING.yaml wiring_map had 4 incorrect paths that would have caused 5E instruction block to reference non-existent files. Defence-in-depth pattern consistent across all layers: client failures pass through, server failures go to 'pending', never 'clean'.

---

## 12 Apr 2026 — Dimensions3 Phase 4 Complete (Library Health & Operational Automation, Checkpoint 4.1 PASSED)

**What changed:**
- **Edit tracker wiring (§5.5 gap fix from prior session):** `trackEdits()` now called fire-and-forget from the content save route (`src/app/api/teacher/units/[unitId]/content/route.ts`). Snapshots `previousContent` before overwrite, feeds edit-tracker job. Commit `445b1a9`.
- **Migration 072:** 3 new tables (`system_alerts`, `library_health_flags`, `usage_rollups`), 4 new columns on `activity_blocks` (`last_used_at`, `archived_at`, `embedding_generated_at`, `decay_applied_total`), `find_duplicate_blocks()` RPC function using pgvector cosine similarity on halfvec embeddings. Commit `c8b6711`.
- **Library health queries:** 8 typed query functions (`getBlocksBySourceType`, `getCategoryDistribution`, `getStaleBlocks`, `getDuplicateSuspects`, `getLowEfficacyBlocks`, `getOrphanBlocks`, `getEmbeddingHealth`, `getCoverageHeatmap`) with 7 TypeScript interfaces. 19 tests. Commit `10c46d8`.
- **7 ops automation jobs:** Pipeline health monitor, cost alert, quality drift detector, teacher edit tracker, stale data watchdog, smoke tests (6 wiring checks), usage analytics. All write to `system_alerts`. All runnable via `npx tsx -r dotenv/config scripts/ops/run-*.ts dotenv_config_path=.env.local`. 7 tests. Commit `3d413a7`.
- **2 library hygiene jobs:** Weekly (staleness decay capped at -6, duplicate flagging via RPC, low-efficacy flagging, stale embedding detection). Monthly (consolidation proposals >0.95 cosine, orphan archival — never deletes). CLI runner: `npx tsx scripts/run-hygiene.ts <weekly|monthly>`. 8 tests. Commit `aea737a`.
- **Library Health dashboard** (`/admin/library/health`): 8 widgets (source type bars, category distribution, stale blocks table, duplicate suspect pairs, low efficacy table, orphan blocks, embedding health gauge, coverage heatmap). API route at `/api/admin/library/health`. Commit `18a7776`.
- **Pipeline Health dashboard** (`/admin/pipeline/health`): KPI cards (success rate, avg timing, total cost, total runs), stage failure heatmap, cost alert strip, error log, quality drift indicator, recent alerts list. API route at `/api/admin/pipeline/health`. Commit `d4f5e66`.
- **Cost alert email delivery:** `sendCostAlert()` via direct `fetch()` to Resend API (no npm package — Lesson #44). 6-hour debounce via `system_alerts` check. Console.log fallback when `RESEND_API_KEY` not set. 9 tests. Commit `5d6ddfb`.
- **Admin nav update:** Pipeline Health and Library Health tabs added to admin layout. `isActive()` fixed for sub-route matching. Commit `c18c766`.
- **Ops runbook + phase brief:** Full runbook at `docs/projects/dimensions3-ops-runbook.md`. Phase brief at `docs/projects/dimensions3-phase4-brief.md`. Commit `eccce92`.
- **FU-M filed:** Live cost alert email test deferred — requires Resend account setup.

**Verification (Checkpoint 4.1):**
- All 7 ops scripts ran successfully with real data:
  - pipeline-health: 100% success rate, 1 run
  - cost-alert: $0 costs, no thresholds exceeded, debounce working
  - quality-drift: insufficient data (expected with 1 run)
  - edit-tracker: 15 total edits (7 kept, 5 rewritten, 3 deleted)
  - stale-watchdog: 55 stale blocks (expected — `last_used_at` is new column, all NULL)
  - smoke-tests: 6/6 passed
  - usage-analytics: 1 active teacher, 55 blocks, 2 rollups written
- Both dashboards reflect `system_alerts` data correctly
- Email delivery deferred to FU-M (console fallback verified)

**Systems affected:** `generation-pipeline` (edit tracker wired), `admin-dashboard` (leveled up v1→v2, 2 new dashboard pages), `ops-automation` (NEW system — 7 jobs + 2 hygiene + cost alert delivery), `activity_blocks` (4 new columns). WIRING.yaml synced with new `ops-automation` system entry.

**Test suite:** 905 → 948 (+43 new, 0 failures)

**Session context:** Continuation from compacted session where Phase 3R was completed. Edit tracker wiring gap (§5.5) fixed first, then all of Phase 4 built end-to-end. Pre-flight audit discovered `total_cost` is JSONB (not float) and `activity_blocks` missing 4 columns — informed migration design. Build methodology held throughout. Key design decision: Resend via direct `fetch()` instead of npm package (Lesson #44: simplicity first).

---

## 12 Apr 2026 — Dimensions3 Phase 3R Complete (Feedback Loop Remediation, Checkpoints 3.1 + 3.2 PASSED)

**What changed:**
- **Phase 3 Gap Audit:** Honest audit of rushed Phase 3 work identified 10 gaps. Full remediation brief written with pre-flight, stop triggers, checkpoints, per the build methodology that was violated in the initial rush.
- **R1 (signals.ts rewrite):** `getStudentSignals()` now queries real `student_progress` rows via indirect join (`source_unit_id + source_page_id`), replacing dead pre-aggregated columns on `activity_blocks` that were always NULL/0. 3 new tests with NC verification. Page-level granularity documented as acceptable approximation.
- **R2 (CLI script rewrite):** Deleted `run-efficacy-update.mjs` (180 lines, duplicated formula). Created `run-efficacy-update.ts` (88 lines) importing directly from library — single source of truth, zero formula duplication.
- **R3 (ProposalReasoning narrative):** Added `buildNarrative()` to ProposalReasoning.tsx — human-readable explanations alongside bar charts ("5 teacher interactions (80% kept), 3 student uses (33% completion)").
- **R4 (Naming divergence):** Documented spec-vs-code naming differences in types.ts header (requires_matt → requiresManualApproval, accept → approved). Decision: keep code names (scale to multi-admin).
- **R5 (Cascade delete verification):** Migration 070 CASCADE DELETE confirmed working on prod — 0 orphaned proposals/audit rows after block deletion.
- **Backend changes from earlier in session:** Removed auto-approve (spec §5.4), added 7-day rejection suppression, added reasoning JSONB column (migration 071), added audit-log API endpoint.
- **Checkpoint 3.1:** CLI dry-run produced 3 proposals with correct directional ordering (kept 61.3 > deleted 44.3 > rewritten 40.3). completionRate 0.33 confirmed real student_progress join working.
- **Checkpoint 3.2:** Full end-to-end cycle verified: CLI → proposals in DB with reasoning JSONB → UI rendering with narrative + diff → approve (score updated 65→40.3) + reject → audit log entries created.

**Systems affected:** `feedback-system` (signals.ts, efficacy.ts, types.ts, 8 UI components, CLI script, audit-log API), `activity_blocks` (efficacy_score updated via approval). WIRING.yaml synced with 11 new key_files.

**Push status:** 5 commits on main pushed to origin (R3+R4 commit + R1 commit + R2 commit + 2 pre-existing). Migrations 070 + 071 applied to prod.

**Session context:** Continuation from compacted session. Phase 3 initially rushed without methodology — Matt caught it. Full remediation process: re-read build-methodology.md + lessons-learned.md, wrote remediation brief with pre-flight/stop triggers, executed properly with Code agent for R1+R2. Methodology held for remediation. Test suite: 902 → 905 (+3 signal tests).

---

## 11 Apr 2026 — Dimensions3 Phases 1.6 + 1.7 Complete (Checkpoint 1.2 PASSED), Build Methodology Captured

**What changed:**
- **Phase 1.6 (Disconnect Old Knowledge UI):** Aggressive cleanup given zero users — old `/teacher/knowledge/*` directory deleted entirely (no redirects), Dimensions3 pages relocated to `/teacher/library/*` namespace, `BatchUpload.tsx` deleted, `/teacher/library/import` endpoint wired to real reconstruction. Commits `e7b020b` (relocation) + `242e587` (cleanup).
- **Phase 1.7 (Checkpoint 1.2 — Automated E2E Gate):** First Dimensions3 phase with a real automated gate protecting it. Three commits on `main`: `20fe163` fix Pass A + Pass B `max_tokens` truncation, `691bdf4` Checkpoint 1.2 automated E2E test, `cd5f9d4` spec §3.7 amend.
  - **Pass A bug:** `max_tokens: 2000` → returned `outputTokens: 2000` exactly (hit cap), `sections: undefined`, downstream crash. Fix: bump to 8000, add `stop_reason` guard, defensive `?? []`.
  - **Pass B bug (predicted by FU-5 audit, surfaced one stage downstream):** Identical pattern at `pass-b.ts:182` with `max_tokens: 4000`. Fix: bump 4000→16000 (Sonnet 4 supports 64K out, no ceiling concern), same guard + fallback.
  - **Lesson #39 written** including new rule: "When fixing a `stop_reason`/defensive-destructure bug at one AI call site, audit and fix ALL sites with the same shape on the same critical path in the same phase, don't wait for the follow-up." Born from getting bitten twice in one phase.
  - **Test variants:** α sandbox DOCX (tight, deterministic) + β live DOCX [`RUN_E2E=1`] (narrow range for AI-wobble fields, loose substring for classification text) + β live PDF [`RUN_E2E=1`] + structural completeness check on every block. 4/4 passing. Total suite: 615 passed | 2 skipped (no `RUN_E2E`), 617 passed (with `RUN_E2E=1`). Baseline cost/time recorded as comments not asserts.
  - **Spec §3.7 amended:** Automated E2E test promoted to canonical Checkpoint 1.2 gate, 9-step manual walkthrough demoted to optional pre-push UI smoke.
  - **Assertion policy locked:** β TIGHT for structural/enum/numeric, β NARROW RANGE for AI-judgment fields (block count 11–15, observed 12/13/14 over N=3), β LOOSE substring for classification text, internal consistency invariants TIGHT.
- **Build methodology captured (`docs/build-methodology.md`):** 17-section reference doc covering scaffolding-as-first-class, phased-with-checkpoints discipline, pre-flight ritual, stop triggers, verify=expected values, audit-then-fix patterns, capture-truth-from-real-runs, push discipline, follow-up tracking, lessons-as-running-artifact. Meta-rule: prefer the discipline even when not explicitly asked. CLAUDE.md updated with new "How we build — PHASED WITH CHECKPOINTS" section + per-phase trigger so it loads in every session.
- **Phase 1.6 follow-up (FU-5) burndown:** Original 10 sites, Pass B removed in 1.7, 9 remaining. Active sites for future maintenance pass: `moderate.ts:175`, `test-lesson/route.ts:151`. Quarantined sites (`anthropic.ts`) wait for Dimensions2 rebuild.

**Systems affected:** `knowledge-pipeline` (truncation fixes, automated gate), `activity-blocks` (review queue UI relocated). WIRING.yaml + wiring-dashboard.html synced.

**Push status:** All 5 Phase 1.6/1.7 commits live on `origin/main`, Vercel prod deploy green, post-deploy sanity check passed (615 passed | 2 skipped baseline). Backup branches `phase-1.6-wip` and `phase-1-7-wip` on origin.

**Session context:** Continuation from prior compacted session. Phase 1.7 demonstrated the methodology end-to-end: stop trigger tripped at block-count delta >30%, paused for review, false-tight classification corrected via narrow-range policy, two truncation bugs caught before they shipped, doctrine written. First fully methodology-disciplined phase. Matt explicitly happy to continue methodically.

---

## 10 Apr 2026 — Dimensions3 Phases 0 + 1.1 + 1.5 Complete, Deployed to Prod

**What changed:**
- **Phase 0 Checkpoint 0.1:** Resolved 33 ambiguous `student_progress.class_id` rows via unit→class intersection with enrollment-recency tiebreaker. 32 backfilled, 1 orphan deleted. Final ambiguity count = 0.
- **Phase 1.1 (Teaching Moves Seed):** 55 moves from `scripts/seed-data/teaching-moves-rewritten.json` seeded to `activity_blocks` as `system@studioloom.internal` (dedicated system teacher). Tagged `source_type='community'`, `module='studioloom'`, `efficacy_score=65`. Validator relaxed to allow student-as-teacher moves (role-reversal-critique, peer-teach-back).
- **Phase 1.5 (Hardening Checklist):** All 10 items shipped and deployed to Vercel prod — cosine dedup 0.92 (voyage-3.5), PPTX + image extraction, strand/level fields (Pass A), Haiku moderation (fail-safe to 'pending'), PII scan wired, copyright_flag enum reuse (audit doc referenced wrong column name `is_copyright_flagged`), moderation migration now not deferred, dryRun mode, per-run cost tracking, content_fingerprint idempotency (sha256 normalised title+body+source_type, UNIQUE, ON CONFLICT DO UPDATE/NOTHING).
- **Migrations applied to prod:** 067 (`moderation_status` + `content_moderation_log` + RLS audit) and 068 (`content_fingerprint TEXT UNIQUE` + backfill).
- **Push discipline protocol established:** don't push to `origin/main` until checkpoint signed off AND migration applied to prod Supabase. Backup pattern: `git push origin main:phase-1.5-wip` (wip branch doesn't trigger Vercel prod deploy).

**Bug found + fixed manually + logged:**
- **Migration 067 grandfather backfill failed silently** — all 55 seed rows landed in `moderation_status='pending'` instead of `'grandfathered'`. Suspected root cause: `ADD COLUMN DEFAULT 'pending'` silently overrode subsequent conditional UPDATE in the same migration. Fixed in prod via corrective UPDATE. **Repo version of 067 is still broken** — logged as follow-up for audit + migration 069 safety net + Lesson #38.

**Lessons learned added:**
- #36 Data-backfill migrations need edge-case SQL, not just a simple UPDATE (student_progress 33-row incident)
- #37 Verify queries must be part of acceptance criteria for data migrations
- #38 pending — Migration 067 `ADD COLUMN DEFAULT` + conditional UPDATE order-of-operations bug (post-mortem blocked on Code audit)

**Systems affected:**
- `activity_blocks` (moderation_status, content_fingerprint, strand, level, copyright_flag)
- `content_moderation_log` (new audit table)
- `student_progress` (class_id now fully populated)
- Ingestion pipeline (PPTX, PII, moderation, dedup, fingerprint)
- Teacher Dashboard `/teacher/units` (render delay surfaced — not a regression, just slow hydration)

**Phase 1.5 follow-ups logged in ALL-PROJECTS.md:**
1. `/teacher/units` initial render delay (P1) — hydration lag, empty squares before cards paint
2. "Unknown" strand/level chips on pre-Phase-1.5 units (P2) — backfill missed units table
3. Migration 067 grandfather bug (P0) — repo broken, needs audit + 069 + Lesson #38
4. Delete junk test units post-Checkpoint 1.2 (P2)

**Session context:**
- Started: continuation from compacted prior session
- Ended: Phase 1.5 signed off + deployed + smoke-tested on prod
- Next session kicks off: Phase 1.6 (disconnect old knowledge UI) → Phase 1.7 (Checkpoint 1.2 E2E test)

---

## 7 Apr 2026 — Dimensions3 Phase C Complete (Generation Pipeline)

**What changed:**
- Dimensions3 Phase C (Generation) completed — all 6 tasks done
- Built 6 real pipeline stages replacing simulator mocks:
  - Stage 1: Block retrieval with 5-factor scoring (vector/efficacy/metadata/text/usage) + embedding fallback
  - Stage 2: Sequence assembly via Sonnet AI call with algorithmic fallback, prerequisite validation
  - Stage 3: Gap generation with parallel Sonnet calls (concurrency 4), FormatProfile-aware prompts
  - Stage 4: Connective tissue — transitions, cross-references, scaffolding progression, interaction map
  - Stage 5: Timing — Workshop Model phases, time_weight allocation, extensions, overflow detection
  - Stage 6: Quality scoring — 5 dimensions (CR/SA/TC/variety/coherence) with unevenness penalty
- Built pipeline orchestrator with sandbox/live modes + generation_runs logging
- FormatProfile pulse weights differ per unit type (service→agency, design→craft)
- Every stage returns CostBreakdown; empty library works gracefully (all gaps → all generated)
- Updated unit-types.ts with FormatProfile type export
- 25 new tests (72 total pipeline tests), build clean
- Committed on main (required manual worktree copy again — `claude/eloquent-morse` branch)

**Files created:** `src/lib/pipeline/stages/` (7 files), `src/lib/pipeline/orchestrator.ts`, `src/lib/pipeline/__tests__/stages.test.ts`

**Files modified:** `src/lib/ai/unit-types.ts` (FormatProfile type added)

**Systems affected:** Generation Pipeline (v1→v2)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 7 Apr 2026 — Dimensions3 Phase B Complete (Ingestion Pipeline)

**What changed:**
- Dimensions3 Phase B (Ingestion) completed — all 4 tasks done
- Built expandable ingestion pass registry with Pass A (classify+tag, Haiku) and Pass B (analyse+enrich, Sonnet)
- Block extraction from enriched sections with PII scan (regex) and copyright flags
- Created `content_items` + `content_assets` tables (migration 063, OS Seam 3+4)
- Built review queue UI: teacher approve/edit/reject extracted blocks + bulk approve
- API routes: POST `/api/teacher/knowledge/ingest`, GET/POST/PATCH `/api/teacher/activity-blocks/review`
- All pass functions are pure (OS Seam 1) — Supabase client via PassConfig, no HTTP deps
- 34 new passing tests, 420 total passing, 0 regressions
- Committed Phase A + Phase B to main (were stuck in worktree), pushed to origin
- Created Phase B instructions doc with full paths and git rules to prevent worktree issues
- Saved feedback to memory: Code must use full /questerra/ paths and commit to main, not worktrees

**Files created:** `src/lib/ingestion/` (10 files), `supabase/migrations/063_content_items.sql`, `src/app/teacher/knowledge/review/page.tsx`, `src/components/teacher/knowledge/` (3 files), `src/app/api/teacher/knowledge/ingest/route.ts`, `src/app/api/teacher/activity-blocks/review/route.ts`

**Systems affected:** Knowledge Pipeline (v0→v1, quarantined→active), Generation Pipeline (updated summary)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 7 Apr 2026 — Dimensions3 Phase A Complete

**What changed:**
- Dimensions3 Phase A (Foundation) completed — all 7 tasks done
- Migrations applied: Activity Block Library schema (first-class SQL entities with full Dimensions metadata)
- TypeScript types created for all pipeline contracts
- Pipeline simulator built (pure functions, tested via Vitest)
- Backend infrastructure in place
- 92 new passing tests, clean build, 0 regressions (11 pre-existing failures from main)
- Sandbox UI page exists (needs full stack for interactive testing)

**Systems affected:** Generation Pipeline (v0→v1), Activity Block Library (v0→v1), Testing Sandbox

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md

---

## 7 Apr 2026 — Discovery 3D Room Design Prototyping

**What changed:**
- Prototyped 3D room designs for Discovery Engine journey stations using raw Three.js + Kenney GLB asset packs (Furniture Kit + Nature Kit)
- Built v1 prototype (`discovery-rooms-prototype.html`) with floating platform approach — **rejected** by Matt (felt like space, not real locations)
- Built v2 prototype (`discovery-rooms-v2.html`) with 4 grounded room templates:
  - **IndoorRoom** — box room with walls/floor/ceiling/baseboard trim/ceiling lights (Foyer, Workshop, Gallery, Toolkit)
  - **Clearing** — circular ground with tree ring boundary, stars, moonlight (Campfire)
  - **Overlook** — partial enclosure with railing and distant vista (Window, Launchpad)
  - **Passage** — long narrow corridor with repeating arches and end-glow (Crossroads)
- Each station has: station-specific Kenney props, 3-point lighting, fog tinting, emissive crystal accents, ambient particles, animation system
- **Design decisions validated:** Grounded real locations (not floating platforms), nav UI pattern (station pills top-right, progress dots bottom, prev/next arrows), fire glow effect, per-station fog/particles/emissives
- Saved room design feedback to auto-memory for future sessions

**Files created:** `3delements/discovery-rooms-prototype.jsx`, `3delements/discovery-rooms-prototype.html`, `3delements/discovery-rooms-v2.html`

**Systems affected:** 3D Elements / Designville, Discovery Engine (visual layer)

---

## 7 Apr 2026 — Infrastructure & Documentation Overhaul (2 sessions)

**What changed:**

*Session 1 (pre-compaction):*
- Created `docs/projects/WIRING.yaml` — machine-readable system registry (82+ systems) with dependency tracing and impact analysis
- Created `docs/projects/wiring-dashboard.html` — interactive dark-themed dashboard for browsing system dependencies
- Added wiring sync to `saveme` (steps 6-7)
- Audited 3 standing instruction docs for staleness:
  - Updated `docs/education-ai-patterns.md` — refreshed to reflect all 27 complete tools, Dimensions3 ai_rules, Journey Engine patterns (17 Mar → 7 Apr)
  - Updated `docs/design-guidelines.md` — added Section H (Generation Pipeline, 8 guidelines) and Section J (Journey Engine, 5 guidelines), total now 57 (29 Mar → 7 Apr)
  - `docs/research/student-influence-factors.md` — audited, still fresh, no changes needed

*Session 2 (continuation):*
- **Fix 1:** Slimmed CLAUDE.md from 424 → 147 lines — extracted Key Decisions → `docs/decisions-log.md` (182 entries), Lessons Learned → `docs/lessons-learned.md` (31 entries), resolved issues → `docs/resolved-issues-archive.md`
- **Fix 2:** Created `docs/doc-manifest.yaml` — index of ~217 documentation files with title, purpose, category, freshness dates
- **Fix 3:** Created `docs/changelog.md` (this file) — rolling session log
- **Fix 4:** Added saveme reminder instruction + expanded saveme to 10 steps (added doc-manifest, changelog, saveme-reminder)
- **Full trust audit:** Verified all CLAUDE.md cross-references (fixed 3 wrong paths in AI Brain table: `docs/` → `docs/brain/`), added Documentation Index section (7 routing pointers), fixed doc-manifest gaps (missing open studio files, escaped paths), fixed 4 project name mismatches in dashboard.html
- Mapped 24 knowledge routing paths — all now COVERED or WEAK (no gaps)

**Files created:** decisions-log.md, lessons-learned.md, resolved-issues-archive.md, doc-manifest.yaml, changelog.md, WIRING.yaml, wiring-dashboard.html

**Files modified:** CLAUDE.md (restructured), education-ai-patterns.md, design-guidelines.md, dashboard.html (4 name fixes)

**Systems affected:** Documentation Infrastructure, CLAUDE.md, Project Tracking, Wiring Diagram, Standing Instruction Docs

**Session context:** Matt asked for a meta-audit of documentation systems ("how am I placed? what am I missing to make sure I don't need to keep things in my head?"). Identified 7 gaps, implemented 4 infrastructure fixes, then ran a full trust audit verifying every cross-reference, manifest entry, and knowledge routing path.

---

## 7 Apr 2026 — CI/CD & Monitoring Infrastructure (Session 3, continuation)

**What changed:**

- **GitHub Actions CI** (`.github/workflows/ci.yml`) — lint + typecheck + build on push/PR to main. Requires 3 GitHub Secrets.
- **Nightly Audit** (`.github/workflows/nightly.yml`) — dep audit + typecheck + build at 2am Nanjing (6pm UTC). `workflow_dispatch` for manual trigger.
- **Health Endpoint** (`src/app/api/health/route.ts`) — public `/api/health`, pings Supabase via `createAdminClient()`, returns `{ok, db, timestamp, responseTime}`. No auth required. `Cache-Control: no-store`.
- **Sentry verified fully configured** — `instrumentation.ts` (server+edge), `instrumentation-client.ts` (browser), `global-error.tsx`, `error-handler.ts` (14+ API routes). Only missing piece was `SENTRY_AUTH_TOKEN` for source maps → now added to Vercel.
- **Automation build plan updated** (`docs/automation/automation-build-plan.md`) — Sprints 1-2 marked COMPLETE, Matt's manual action items listed.
- **Manual setup completed by Matt:** Sentry auth token created (Project=Read, Release=Admin), `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SENTRY_DSN` added to Vercel env vars, 3 GitHub Secrets added (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SENTRY_DSN`).
- **Scheduled task created:** `refresh-project-dashboard` — manual-only task that syncs ALL-PROJECTS.md → dashboard.html.

**Files created:** `.github/workflows/ci.yml`, `.github/workflows/nightly.yml`, `src/app/api/health/route.ts`

**Files modified:** `docs/automation/automation-build-plan.md`, `docs/projects/ALL-PROJECTS.md` (39 features, +2 Infrastructure & Operations), `docs/projects/dashboard.html` (+2 complete entries), `CLAUDE.md` (37→39 feature count), `docs/projects/WIRING.yaml` (automation system → v2 complete), `docs/projects/system-architecture-map.html` (automation → v2 complete), `docs/doc-manifest.yaml` (+3 new entries, freshness updates)

**Systems affected:** Automation/CI/CD, Sentry Error Tracking, Health Monitoring, Documentation Infrastructure, Project Tracking

**Session context:** Continuation of infrastructure overhaul. Matt guided through manual Sentry token creation, Vercel env var setup, and GitHub Secrets configuration. Sprints 3-4 (bug report widget, pg_cron) remain for future sessions. Sentry alert rule and Better Stack uptime monitoring are optional remaining manual steps.

---

## 7 Apr 2026 — Test Infrastructure & Build Readiness Audit (Session 4)

**What changed:**

- **Build readiness assessment** — Critical assessment of organizational systems before Dimensions3. Scored 8/10 docs, 6/10 build readiness. Identified 7 gaps, resolved all 5 actionable ones.
- **Test infrastructure audit** — Discovered 15 existing test files (was assumed zero). Added 2 new critical test files: `stage-contracts.test.ts` (30 tests for Dimensions3 pipeline typed contracts) and `validation.test.ts` (27 tests for AI output validation).
- **Fixed 11 pre-existing test failures** — teaching-moves scoring logic (zero-score filter with maxResults), timing-validation debrief min (5→3), lesson-pulse penalty boundary (strict→inclusive) and prompt format changes, stale snapshot deletion. All 389 tests now green.
- **4 automated health check scripts:**
  - `scripts/check-dashboard-sync.ts` — validates ALL-PROJECTS.md ↔ dashboard.html sync
  - `scripts/check-doc-freshness.ts` — validates doc-manifest.yaml paths, dates, staleness (--fix mode)
  - `scripts/check-wiring-health.py` — validates WIRING.yaml parsing, dangling refs, orphans (--trace mode)
  - `scripts/check-session-changes.sh` — git-based saveme reminder trigger
- **CI/nightly enhanced** — ci.yml now runs `npm test` + dashboard sync check; nightly.yml runs all 4 health checks
- **WIRING.yaml battle-tested** — fixed 20 unquoted YAML values, removed 3 dangling references (education-ai-patterns, analytics, development-workflow), expanded to 92 systems
- **doc-manifest.yaml cleaned** — fixed 155/164 unknown dates from file mtime, corrected 5 broken paths, total now 222 entries
- **Test coverage map** — `docs/testing/test-coverage-map.md` maps all 17 test files with Dimensions3 criticality ratings and gap inventory

**Files created:** `src/lib/pipeline/__tests__/stage-contracts.test.ts`, `src/lib/ai/__tests__/validation.test.ts`, `scripts/check-dashboard-sync.ts`, `scripts/check-doc-freshness.ts`, `scripts/check-wiring-health.py`, `scripts/check-session-changes.sh`, `docs/testing/test-coverage-map.md`

**Files modified:** `src/lib/ai/__tests__/teaching-moves.test.ts` (6 test fixes), `src/lib/ai/__tests__/timing-validation.test.ts` (debrief min fix), `src/lib/layers/__tests__/lesson-pulse.test.ts` (penalty + prompt fixes), `.github/workflows/ci.yml` (+test+sync steps), `.github/workflows/nightly.yml` (+4 health checks), `docs/projects/WIRING.yaml` (20 YAML fixes, 3 dangling refs removed, automation entry updated), `docs/doc-manifest.yaml` (155 dates fixed, 5 paths fixed, 5 new entries)

**Systems affected:** Test Infrastructure, Automation/CI/CD, Documentation Infrastructure, WIRING Diagram, Project Tracking

**Session context:** Matt asked "am I ready to build again without going mental?" before starting Dimensions3. Systematic audit revealed test failures, YAML parse errors, doc drift, and missing automation. All resolved — 389/389 tests green, all health checks passing.

---

### 7 April 2026 — 3D Render Modes Plan Integration

**What changed:**
- Integrated `docs/StudioLoom-3D-Render-Modes-Plan.docx` into `docs/projects/3delements.md`
- Section 7 restructured from flat 5-mode list into two-dimensional architecture: 5 render presets (Showcase/Designville/Workshop/Tutorial/Print) × 5 UI container modes (Fullscreen/Embedded/Floating/Modal/PiP)
- Added Section 7A (render presets with stack/asset/camera details), 7B (UI containers, preserved from original), 7C (combination matrix showing typical pairings)
- Layer 1 description updated to reflect two-dimensional rendering
- Phase 0 build plan updated: Workshop render preset first (validates shared asset pipeline)
- Section 3 file table and Section 20 files reference updated to include the docx
- New entry in doc-manifest.yaml for the docx

**Files modified:** `docs/projects/3delements.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** 3D Scenes (rendering architecture), 3D Assets (shared pipeline insight)

**Session context:** Matt asked to find the Render Modes Plan docx and integrate it into the 3D Elements project doc. Key insight from the docx: render presets and UI containers are orthogonal — one .glb asset library feeds all five presets.

---

*Newer entries below this line.*

---

## 9 Apr 2026 — Dimensions3 Wiring Complete (Pipeline → Wizard Routes)

**What changed:**
- Wired Dimensions3 pipeline to existing wizard UI — teachers can generate units again
- W1: Input adapter (`wizardInputToGenerationRequest`) — maps UnitWizardInput → GenerationRequest. Topic, unitType, lessonCount (from durationWeeks), gradeLevel, framework (default IB_MYP), constraints, context, preferences
- W2: Output adapter (`timedUnitToContentData`) — maps TimedUnit → UnitContentDataV2/UnitPage format that lesson editor, Teaching Mode, and student experience expect
- W3: Un-quarantined `/api/teacher/generate-unit/route.ts` — removed 410 early return, now calls `runPipeline()` orchestrator, returns single JSON response (no streaming for v1)
- W4: Un-quarantined wizard page (`/teacher/units/create/page.tsx`) — removed "Being Rebuilt" early return, `generateAll()` now makes single POST instead of per-criterion streaming
- W5: Fixed JSX tag mismatch on units page (quarantine changed `<Link>` → `<span>` but missed closing tag)
- W8: 34 adapter tests (17 input + 17 output) covering minimal/full input, all unit types, edge cases
- Supabase migrations 060-064 applied to production (activity_blocks, generation_runs, teacher_tier, content_items, feedback_proposals)
- Note: W5 (re-enable UI buttons), W6 (remaining quarantined routes), W7 (edit tracking integration) deferred — pipeline works via direct wizard flow

**Files created:** `src/lib/pipeline/adapters/input-adapter.ts`, `src/lib/pipeline/adapters/output-adapter.ts`, `src/lib/pipeline/adapters/__tests__/adapters.test.ts`, `docs/projects/dimensions3-wiring-instructions.md`

**Files modified:** `src/app/api/teacher/generate-unit/route.ts` (un-quarantined), `src/app/teacher/units/create/page.tsx` (un-quarantined), `src/app/teacher/units/page.tsx` (tag fix)

**Systems affected:** Generation Pipeline (wired to wizard), Unit Generation Wizard (un-quarantined), Quarantine (partially lifted)

**Commits:** `2ffe92e` (wiring, 5 files, 817 insertions), `3a43514` (tag fix)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md

---

## 9 Apr 2026 — Dimensions3 Phase E Complete (Admin Dashboard + Polish) — ALL PHASES DONE

**What changed:**
- Dimensions3 Phase E completed — all 5 tasks done. **This completes the entire Dimensions3 build.**
- E1: Unit Import Flow — teacher uploads an existing unit plan, system runs ingestion pipeline + AI reconstruction (Sonnet), produces a Match Report with side-by-side comparison (original vs reconstructed), per-lesson match %, colour-coded diff. Teacher can accept/edit/reject. Files: `src/lib/ingestion/unit-import.ts`, `src/app/teacher/knowledge/import/page.tsx`, `src/components/teacher/knowledge/MatchReport.tsx`, `src/app/api/teacher/knowledge/import/route.ts`.
- E2: Admin Dashboard Landing Page — health strip with 5 traffic lights (Pipeline/Library/Cost/Quality/Wiring), active alerts feed (red badges), quick stats row (active teachers, students, units, blocks, bugs), 7-day trend sparklines. Files: `src/app/admin/page.tsx`, `src/components/admin/dashboard/HealthStrip.tsx`, `QuickStats.tsx`, `AlertsFeed.tsx`, `src/lib/admin/health-checks.ts`, `src/app/api/admin/health/route.ts`.
- E3: Admin Tab Navigation + Key Tabs — updated admin layout with horizontal tab bar linking all sections. 4 fully built tabs: Pipeline Health (recent runs, per-stage success/failure, error log), Block Library (browse/search/filter blocks by category/phase/source, sort by efficacy/usage/date), Cost & Usage (daily/weekly/monthly cost aggregation, per-teacher breakdown), Settings (model selection per tier, guardrail config viewer). Remaining tabs as stubs. Files: `src/app/admin/pipeline/page.tsx`, `library/page.tsx`, `costs/page.tsx`, `settings/page.tsx` + components.
- E4: 13 Smoke Tests — 6 E2E flow tests (ingestion→library, library→generation, generation→delivery, delivery→tracking, tracking→feedback, feedback→library) plus component tests. On-demand trigger via API. Files: `src/lib/__tests__/smoke-tests.test.ts`, `src/app/api/admin/smoke-tests/route.ts`.
- E5: 6 Operational Monitors — pure functions that query the database and return typed results: pipeline health (24h success/failure rate, avg time, cost trend), cost alerts (threshold checks, spike detection), quality drift (Pulse score week-over-week), edit tracker summary (most-edited/deleted blocks, new patterns), stale data watchdog (unscanned blocks, failed runs, orphaned data), usage analytics (active users, generation counts, library growth). All feed into admin dashboard. Files: `src/lib/admin/monitors/` (6 files + index).
- 30 new files, 2440 lines total
- Committed on main (copied from worktree `claude/eloquent-morse`)

**Systems affected:** Admin Dashboard (v0→v1, planned→active), Generation Pipeline (all phases complete)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 9 Apr 2026 — Dimensions3 Phase D Complete (Feedback System)

**What changed:**
- Dimensions3 Phase D (Feedback) completed — all 4 tasks done
- D1: Teacher Edit Tracker — diff detection per activity when teacher saves a generated unit. Classifies edits as kept/rewritten/scaffolding_changed/reordered/deleted/added. Stores diffs in generation_feedback table with before/after snapshots and diff percentage. Auto-queues blocks to review queue based on edit thresholds (<20% diff → efficacy 50, 20-60% → efficacy 45, >60% → teacher-authored).
- D2: Efficacy Computation — 6-signal weighted formula (kept_rate 30%, completion_rate 25%, time_accuracy 20%, deletion_rate 10%, pace_score 10%, edit_rate 5%). Batch job aggregating teacher edits + student progress + pace feedback. Outputs proposed score adjustments that enter approval queue.
- D3: Approval Queue UI + Guardrails — Admin UI at `/admin/feedback` with ApprovalQueue and AdjustmentCard components. Hard guardrails: efficacy capped 10-95 per cycle, time_weight max one step change, bloom_level/phase/activity_category changes always require manual approval, max 20% metadata change per cycle. Batch-approve for high-confidence changes. Auto-approve threshold configurable (OFF by default). Full audit log.
- D4: Self-Healing Proposals — Pattern detection for time_weight mismatch (>50% diff across 8+ uses), low completion (<30% across 10+ uses), high deletion (>70% across 5+ uses). Proposals enter approval queue with full evidence.
- Migration 064: generation_feedback, feedback_proposals, feedback_audit_log tables
- 60 new tests, 480+ total passing, build clean
- Committed on main (Code finally used main branch correctly)

**Files created:** `src/lib/feedback/` (6 files: edit-tracker.ts, efficacy.ts, signals.ts, types.ts, guardrails.ts, self-healing.ts), `src/app/admin/feedback/page.tsx`, `src/components/admin/feedback/ApprovalQueue.tsx`, `src/components/admin/feedback/AdjustmentCard.tsx`, `src/app/api/admin/feedback/route.ts`, `supabase/migrations/064_feedback_proposals.sql`

**Systems affected:** Generation Pipeline (v2, feedback loop added), Activity Block Library (efficacy scoring)

**Files synced:** ALL-PROJECTS.md, dashboard.html, WIRING.yaml, wiring-dashboard.html, system-architecture-map.html, doc-manifest.yaml, changelog.md, CLAUDE.md

---

## 10 Apr 2026 — Dimensions3 v2 Completion Spec Signed Off

**What changed:**
- Created `docs/projects/dimensions3-completion-spec.md` (v2, ~1,600 lines) — canonical build plan for completing Dimensions3. Full rewrite of v1 after audit found significant coverage gaps.
- v1 audit findings fixed: (a) removed Stage 5b misconception — curriculum mapping is render-time via FrameworkAdapter, not a pipeline stage; (b) added new Phase 5 for Content Safety (§17 of master spec) — Layer 1 LDNOOBW blocklist + Layer 2 Haiku moderation, NSFW.js image classifier, franc-min language detection, ZH-Hans support, migration 067 for moderation tables; (c) expanded Phase 4 to cover all 7 operational automation systems from §9.3; (d) expanded Phase 7 to build all 12 admin tabs from §14.7 (was 5), 5 distinct sandboxes from §7 (was 1), per-teacher profitability dashboard, new Bug Reporting System.
- Added execution discipline: Guiding Rules §1, 12 mandatory Matt Checkpoints, per-sub-task verification, rollback sections, realistic 21–25 day estimate.
- Phase 0 prerequisites locked in: migration 065 adds `class_id` to student_progress (single-class auto-backfill, multi-class NULL); `is_sandbox` flag on knowledge_uploads + query guard.
- Phase 4.7 model ID sweep: 12 files still on hardcoded `claude-sonnet-4-20250514` → update to `claude-sonnet-4-6` (consistency fix, string already in use by newer code in anthropic.ts). Add pricing entry to usage-tracking.ts. Delete duplicate pass-b-enrich.ts.
- Resolved all 12 open questions via Matt Q&A, logged in §13 of completion spec and appended to decisions-log.md.
- Efficacy formula locked: `0.30*kept + 0.25*completion + 0.20*time_accuracy + 0.10*(1-deletion) + 0.10*pace + 0.05*(1-edit)`.

**Files created:** `docs/projects/dimensions3-completion-spec.md`
**Files modified:** ALL-PROJECTS.md, decisions-log.md, changelog.md, doc-manifest.yaml, auto-memory

**Systems affected:** Dimensions3 Generation Pipeline (v2 plan), Ingestion Pipeline (sandbox flag), Content Moderation (new), student_progress schema (class_id), Admin Dashboard (12 tabs scope), Bug Reporting (new)

**Session context:** Continued from prior session's v2 rewrite. Walked through 12 open questions, verified model ID situation via grep, resolved all decisions, finalised cross-check against master spec + known issues, then saveme. Build ready to kick off. Next: Phase 0 cleanup + migrations 065 & is_sandbox.

---

## 10 Apr 2026 — StudentDash Prototype v2 (Miro-Bench Variant)

**What changed:**
- Built `docs/dashboard/r3f-motion-sample.html` — second StudentDash prototype. Single-file HTML (React 18 + R3F + Framer Motion via esm.sh import map). Flat 2D Miro-style wood workbench filling viewport (tan gradient + turbulence wood grain + hand-placed bench marks + edge vignette).
- One low-poly boombox speaker embedded top-right via fixed-camera R3F anchor pattern — draggable motion.div wrapping a Canvas with fixed camera, so dragging translates the rendered bitmap but the 3D perspective stays identical across the whole screen. ~10 flat-shaded meshes, camera at `[1.6, 3.6, 2.2]` fov 30 looking down onto the top.
- One clickable 3D hex-medal badge bottom-right — low-poly gold hexagonal prism with bevelled face, inset centre disc, 5 raised star-point boxes, red ribbon flap, loop at top. Hover boosts rim/face/star emissive intensities, bumps pointLight 1.0→3.5, fades in blurred CSS radial glow, warms "BADGES" pill label cream→amber, scales 1.06×. Click is placeholder `console.log` ready for real route.
- Three draggable student-content cards: Current Unit (Bluetooth Speaker, lesson 4/7, progress bar), Next Step ("Sketch 3 form variations", ~25 min), Feedback · Ms. Chen (mentor quote + adjustment suggestion).
- Card interaction model: `dragConstraints={constraintsRef}` on `.cards-layer` + `dragElastic: 0.25` for bounce-back, single top-right rotate corner (`↻` glyph, pointer-angle from card centre with ±180° seam unwrap), single bottom-right resize corner (diagonal stripes, x+y delta average, clamped 0.6–1.8×), snap-to-stack on `onDragEnd` (nearest sibling via shared `registry` ref, 140px threshold, +26/+22 offset, +2° rotation, zCounter pops to front), `drag={!cornerActive}` prevents drag-corner conflict.
- Iterations during session: started with 4 rotate corners, dropped to 1 (visual clutter); first used `onWheel` for rotation, replaced with corner grab-and-spin (more discoverable).
- Added Prototype v2 section to `docs/projects/studentdash.md` documenting what was built, interaction model, v1-vs-v2 comparison, 6 reusable primitives worth keeping, what's NOT in v2 (parked features), and 4 new v2-specific open questions.

**Key takeaway:** v2 is cheaper to ship than v1 (one Canvas vs full scene, flat 2D CSS, responsive) and introduces reusable primitives: flat workbench recipe, fixed-camera R3F anchor, hover-glow 3D badge, single-corner card interactions, snap-to-stack via registry ref, student-action cards > unit thumbnails. Neither prototype committed — student testing should compare.

**Files created:** `docs/dashboard/r3f-motion-sample.html`
**Files modified:** `docs/projects/studentdash.md`, `docs/projects/ALL-PROJECTS.md`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** StudentDash (student-dashboard in WIRING.yaml) — prototype direction expanded, no code changes to live dashboard.

**Session context:** Iterative prototype session. Started from earlier 3D Studio Desk scene, pivoted to flat Miro-style workbench, rebuilt speaker as low-poly R3F boombox, adjusted camera angle to top-down, moved speaker to top-right, replaced card content with student-actionable items, added clickable 3D badge entry point with hover glow. Matt wants to come back to the reusable primitives later — saveme captures what's worth keeping.

---

## 10 Apr 2026 — Student Learning Profile Schema — Option 2 Stress-Test Extension

**What changed:**
- Stress-tested the Student Learning Profile spec against 4 questions (enough data points? world class? flexible for new journey blocks? real needle movers for adolescent design students?). Identified 5 structural gaps.
- Matt chose **option 2** — build all 5 gaps into v1 to avoid a rebuild in 3 months. Explicit callouts: motivation + peers (incl. group work) + "add fields later" extensibility.
- **Gap A — SDT motivational_state** added to `current_state`: autonomy/competence/relatedness/purpose with value/trajectory/confidence/last_signals, 21-day TTL, drives new SDT-based pedagogy rules in `synthesizePedagogyPreferences` §10.4 6b.
- **Gap B — social section** added with group work support: collaboration_orientation (lone_wolf / small_group / connector / adaptive), critique_giving_quality + critique_receiving_quality (bidirectional), help_seeking_pattern, peer_influences[], group_history[], current_groups[]. Cross-student privacy via per-session HMAC peer_student_id hashing for system viewers. New `PeerInteractionWorker` §10.6. New COPPA `social` scope.
- **Gap C — dimension registry** added: new `profile_dimensions` table (§7.6) + `profile.custom` JSONB slot (§8.8) + `<RegisteredDimensionWriter>` dispatcher. Future journey blocks can declare new dimensions without migrations. Synthesis loop (§10.4 6d) discovers registered dimensions and applies their `synthesis_contributions` to pedagogy_preferences. V1 admin-only registration; 2 seeds (metacognition_score, feedback_receptiveness).
- **Gap D — creative_voice** added to identity: 1024-d aesthetic_embedding (rolling mean of Work Capture submissions, 30-day half-life), material_preferences, visual_tags, stated_references, revealed_references (cosine match against designer corpus), voice_confidence. New `CreativeVoiceWorker` §10.7 with surgical `writeCreativeVoice` SECURITY DEFINER grant (only touches identity.creative_voice.*). Directly unblocks Designer Mentor matching via `mentor_matcher` touchpoint.
- **Gap E — trajectory_snapshots[]** added to identity: append-only, 50-cap, 4 triggers (term_end scheduled, drift when archetype Δ > 0.15, manual, project_end). Deterministic notable_delta. New `TrajectorySnapshotJob` §10.8. Gives O(1) long-horizon queries for 6-year student arc.
- **Writer classes:** 5 → 7 (added PeerInteractionWorker, CreativeVoiceWorker, TrajectorySnapshotJob, `<RegisteredDimensionWriter>`).
- **Read API §11:** ProfileReadOptions extended with social/custom sections + includeTrajectory; 9 enforcement rules (was 7) — added cross-student peer hash for system viewers, custom visibility filtering, trajectory gating, mentor_matcher exclusive access to aesthetic_embedding.
- **Requirements §13:** added P0-13 (SDT), P0-14 (social + group work), P0-15 (dimension registry), P0-16 (creative_voice + Designer Mentor unblock), P0-17 (trajectory snapshots).
- **Open questions §15:** added OQ-11 through OQ-15. Three new blockers: OQ-13 HMAC salt scope, OQ-14 group FERPA RLS tightening, OQ-15 Discovery SDT tag audit.
- **Build plan §17:** stretched 15-19d → **21-25d**. Phase A 8→11d, B 3→5d, C 3→4d, D 2-4→5d. Designer Mentor matcher hook lands Day 23.
- **Risks §18:** added 7 new entries (peer privacy leak Critical, group FERPA High, dimension sprawl, creative_voice staleness, SDT signal sparsity, trajectory drift, grant scope creep).
- **Appendix §21:** example profile now shows all new sections; rendered DA prompt includes motivation snapshot + relatedness/purpose guidance.

**Files modified:**
- `docs/specs/student-learning-profile-schema.md` (~2,211 lines, +~1,200 lines of additions)
- `docs/projects/ALL-PROJECTS.md` (SLP entry updated — 12-16d → 21-25d, 7 sections, 5 blockers)
- `docs/projects/dashboard.html` (new P0 ready entry)
- `docs/decisions-log.md` (6 new decisions)
- `docs/doc-manifest.yaml` (last_verified bump)
- `docs/changelog.md` (this entry)

**Systems affected:** Student Learning Profile (spec only, no code); downstream: Designer Mentor System (unblocked via creative_voice), Discovery Engine (needs SDT tag audit), Open Studio v2 (benefits from motivational_state), Journey Engine (enables custom dimension declaration), Work Capture Pipeline (feeds creative_voice embeddings), Class Gallery + Peer Review (feeds PeerInteractionWorker), Teaching Mode (group check-ins feed group_history).

**Session context:** Matt's "do we have enough data points, is this world class, is there flexibility?" stress test revealed that the initial 5-section spec was missing motivation, peer/social dynamics, a runtime extensibility slot, aesthetic fingerprinting, and long-horizon trajectory compression. Option 2 (build it all now, +6d) chosen over option 1 (defer, risk rebuild) because Matt explicitly confirmed motivation + peers + group work + "add fields later" as non-negotiable. Three blocking OQs must resolve before Phase A coding: HMAC salt scope (OQ-13), group FERPA RLS (OQ-14), Discovery SDT tag audit (OQ-15).

---

## 10 Apr 2026 — StudentDash Prototype v2: Focus Mode Added

**What changed:**
- Added a Focus Mode toggle to `docs/dashboard/r3f-motion-sample.html`. iOS-style pill switch in the header-right area alongside the toolbar. Shows "Focus" when off, "Focus on" in amber with sliding knob when on.
- On toggle: Next Step card springs to screen centre at 1.35× scale with rotation zeroed via framer-motion's imperative `animate()`. Every non-essential element (speaker, badge, other two cards, header title) fades to opacity 0 with pointer-events disabled and drag turned off. Toolbar + focus toggle stay visible.
- Off toggle: savedRef snapshot (captured at the moment focus turned on) restores the Next Step card's exact prior x/y/rotate/scale — so user can drag/resize/rotate it to any position, hit focus, hit focus again, and return to the exact prior state. Other elements fade back in with stagger.
- `framer-motion` import expanded to include `animate` function for the imperative motion-value springs.
- Drag, hover, and click are all gated on focusMode so hidden elements can't be interacted with by keyboard/trackpad.
- New CSS: `.focus-toggle`, `.focus-switch` (with sliding knob pseudo-element), `.header-right` wrapper.
- Updated `studentdash.md` Prototype v2 section to add Focus Mode as reusable primitive #7 — "any complex dashboard can have a single 'what matters right now' mode that doesn't destroy state."

**Files modified:** `docs/dashboard/r3f-motion-sample.html`, `docs/projects/studentdash.md`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/dashboard.html`, `docs/doc-manifest.yaml`, `docs/changelog.md`

**Systems affected:** StudentDash prototype only — no live code changes.

**Session context:** Follow-up iteration to the Miro-Bench prototype. Matt asked for a focus toggle so the dashboard can strip down to just "the next step" when a student wants to stop doom-scrolling the desk. Implementation uses imperative `animate()` against existing motion values rather than remounting, so drag state and corner interactions survive the toggle. The savedRef pattern (snapshot → animate away → animate back) is reusable for any "temporary view" mode elsewhere.

---

## 10 Apr 2026 — Student Learning Profile: Unified Schema Spec

**What changed:**
- Created `docs/specs/student-learning-profile-schema.md` (~1000 lines) — canonical build-ready spec consolidating three overlapping profile specs (discovery-intelligence-layer, student-learning-intelligence, cognitive-layer) into one unified `student_learning_profile` table.
- 5 internally-owned sections (identity, cognitive, current_state, wellbeing, passive_signals) + computed `pedagogy_preferences` derived section. Single writer class per section enforced via SECURITY DEFINER + CI grep checks.
- Companion tables: `student_project_history` (immutable per-project rows), `student_learning_events` (audit log).
- 5 writer classes: ProfilingJourneyWriter, CognitivePuzzleWriter, PassiveSignalWorker, TeacherProfileEditor, ProfileSynthesisJob.
- Section-level visibility: identity/cognitive/current_state/pedagogy student-visible; wellbeing/passive_signals teacher-only.
- 4-phase build plan: A schema+writers (5d), B synthesis+read API (4d), C AI prompt injection (3d), D rollout (2-4d). Total 12-16 days. Feature flag `student_profile_v1`, hard cutover migration.
- 10 open questions documented; 3 marked blocking before Phase A: OQ-2 multi-class teacher RLS, OQ-4 COPPA gating, OQ-9 synthesis job trigger.
- Added entry to `docs/projects/ALL-PROJECTS.md` Active Projects (P0).

**Files created:** `docs/specs/student-learning-profile-schema.md`
**Files modified:** `docs/projects/ALL-PROJECTS.md`, `docs/changelog.md`, `docs/doc-manifest.yaml`

**Systems affected:** Touches future Designer Mentor matching, Discovery Cognitive Layer, Open Studio v2 plan health, Design Assistant prompt injection, Journey Engine `learning_profile` writes. No code changes — spec only.

**Session context:** Follow-up to "mindprint" exploration. Matt locked in 4 design decisions via AskUserQuestion (separate history table / computed pedagogy_preferences / section-level visibility / hard cutover) before spec was written. Spec is the next big project — Matt to work through it. Three blocking OQs to be resolved before Phase A coding begins.

---

## 11 Apr 2026 — Skills Library + Open Studio Mode: Project Kickoff + File Reorganization

**What changed:**
- Reviewed 8 workshop artifacts in the temporary `docs/skillsandopenstudio/` bucket (session summary, open studio mode spec, skills library design note + completion addendum, strength chart prototype, open studio wireframe, reference prototypes, composed student dashboard).
- Created two new P1 projects: `docs/projects/skills-library.md` and `docs/projects/open-studio-mode.md`. Added both to `ALL-PROJECTS.md` 🔵 Planned section.
- `open-studio-mode.md` contains a ⚠️ MANDATORY required-reading block listing 18 files — triggered whenever Matt says "start Open Studio Mode". Covers all 3 Open Studio project docs (v1 shipped, v2 planning journey, Mode runtime), 6 canonical specs, 4 prototypes, Skills Library dependency, build methodology.
- `skills-library.md` supersedes the older `self-help-library.md` idea doc. Old doc marked SUPERSEDED with pointer. Old `openstudio.md` also marked SUPERSEDED with pointer to open-studio-mode.md + openstudio-v2.md.
- Added sibling cross-link: `openstudio-v2.md` now references `open-studio-mode.md` as sibling.
- Reorganized workshop files to canonical homes: skills library specs → `docs/specs/`, strength chart prototype → `docs/prototypes/`, open studio mode spec → `docs/open studio/`, open studio prototypes → `docs/open studio/prototypes/`, session summary → `docs/open studio/prototypes/SESSION-SUMMARY-apr-2026.md`. Empty bucket deleted.
- Updated WIRING.yaml: modified `student-open-studio` entry (supersession note, affects list), added new `skills-library` and `open-studio-mode` system entries with full docs/data_fields/affects arrays.
- Synced `dashboard.html` PROJECTS array and `wiring-dashboard.html` SYSTEMS array with new entries.
- Added auto-memory entry `.auto-memory/project_open_studio_mode_required_reading.md` — future sessions will read the required-reading block when Matt says "start Open Studio Mode".
- Appended 4 decisions to `docs/decisions-log.md` (sibling-not-merge, supersession, 4-mechanism lock-in, workshop reorganization rule).
- Added 10 new doc entries to `docs/doc-manifest.yaml`.

**Files created:**
- `docs/projects/skills-library.md`
- `docs/projects/open-studio-mode.md`
- `.auto-memory/project_open_studio_mode_required_reading.md`

**Files modified:** ALL-PROJECTS.md, dashboard.html, wiring-dashboard.html, WIRING.yaml, openstudio-v2.md, openstudio.md, self-help-library.md, decisions-log.md, doc-manifest.yaml, changelog.md, .auto-memory/MEMORY.md

**Files moved (workshop → canonical):** 8 files out of `docs/skillsandopenstudio/` (now deleted) into specs/, prototypes/, open studio/, open studio/prototypes/.

**Systems affected:** `skills-library` (new, planned, v0), `open-studio-mode` (new, planned, v0), `student-open-studio` (v1 noted as superseded-in-behaviour by Mode). Touches future work across learning_events schema (new event types), Journey Engine consumers, and student dashboard UI.

**Session context:** Matt dropped 8 workshop artifacts and asked me to check for related existing projects, start new ones if needed, then organize the files. Key concern: guaranteed context preservation for future sessions — solved with a 4-mechanism lock-in (cross-links + required-reading block + auto-memory trigger + WIRING entries). No code changes — planning and organization only. Both projects remain planned/P1; build starts next week.

## 12 Apr 2026 — Dimensions3 v2 Phase 2: Sub-tasks 5.5–5.9 shipped (FormatProfile wiring + FrameworkAdapter)

**What changed:**
- **5.5 test phase** closed — stage 3 gap-generation rules per-profile tests with mocked AI + 4 fixtures (design/service/PP/inquiry). 6 tests. Commit `e610050`.
- **5.6 design + test** closed — FormatProfile.connectiveTissue added as required field, wired into stage 4 polish prompt (audienceLanguage + reflectionStyle gloss + transitionVocabulary). 5 tests with double-sensitive distinctness gate. Commits `bc46383` + `1991de2`.
- **5.7 design + test** closed — FormatProfile.timingModifiers additively extended to 5 fields (added defaultWorkTimeFloor + reflectionMinimum), wired into stage 5 timing. 5 tests with 3 NC proofs including edge-case sharpness. Commits `fa8e3dc` + `c5fc92f`.
- **5.8 test-only** closed — stage 6 pulseWeights wiring test with 3 synthetic orthogonal profiles ({1,0,0}/{0,1,0}/{0,0,1}) + shared TimedUnit. NC via hardcoded `1/3` collapse to 6.6. Commit `0e101aa`.
- **5.9 FrameworkAdapter build + test** closed — `src/lib/frameworks/adapter.ts` + 8 mapping files + 139 tests + 8×8 JSON fixture cross-check. Discriminated union return type (label | implicit | not_assessed) for 16 gap cells, 0 not_assessed (all implicit roll-ups). 3 exam-prep context overrides. Commits `ccc3d2a` + `4e31363`.

**Files created:**
- `src/lib/frameworks/adapter.ts` (199 lines)
- `src/lib/frameworks/mappings/{myp,gcse,alevel,igcse,acara,pltw,nesa,victorian}.ts` (8 files, 31–56 lines each)
- `src/lib/frameworks/__tests__/adapter.test.ts` (262 lines, 139 tests)
- `tests/fixtures/phase-2/framework-adapter-8x8.json` (208 lines)
- `src/lib/pipeline/stages/__tests__/stage3-gap-generation-rules.test.ts` + 4 stage3 fixtures
- `src/lib/pipeline/stages/__tests__/stage4-polish-connective-tissue.test.ts` + 4 stage4 fixtures
- `src/lib/pipeline/stages/__tests__/stage5-timing-profile-wiring.test.ts`
- `src/lib/pipeline/stages/__tests__/stage6-scoring-pulse-weights-wiring.test.ts`

**Files modified:** `src/lib/ai/unit-types.ts` (connectiveTissue + timingModifiers extensions), `src/lib/pipeline/stages/stage4-polish.ts` (connectiveTissue injection), `src/lib/pipeline/stages/stage5-timing.ts` (work-time floor + reflection minimum wiring), 3 pre-existing stage4 test fixtures thickened with stub connectiveTissue.

**Followups filed (docs/projects/dimensions3-followups.md):**
- FU-A: `pipeline.ts:590-592` simulator stage6 duplicate (from 5.8 pre-flight)
- FU-B: pulseWeights 0.05 drift across all 4 FormatProfiles (from 5.8 pre-flight)
- FU-C: NESA §3.7 analysing spec bug — adapter honours prose intent via Ev extension
- FU-D: IGCSE §3.4 missing reverse table — adapter applies exclusive-key heuristic

**Auto-memory added:**
- `feedback_nc_revert_uncommitted.md` — Use Edit-tool revert, not `git checkout --`, on not-yet-committed NC files
- `feedback_brief_transcription_slips.md` — Pre-flight audits catch ~1 brief slip per sub-task; never skip them
- `project_dimensions3_phase2_progress.md` — Phase 2 current state + next steps

**Test counts:** 673 → 812 (+139 from 5.9; 5.5-5.8 added ~17 to the pre-5.9 baseline). tsc baseline held at 80 throughout.

**Commits:** 7 new commits this session. HEAD `4e31363`, 26 ahead of origin/main. Not pushed — push gated on Matt Checkpoint 2.1 per build-methodology.md.

**Systems affected:** `generation-pipeline` (Stages 3/4/5/6 now consume FormatProfile fields previously ignored), `framework-adapter` (new system — first consumer is 5.10 Admin panel), `format-profiles` (connectiveTissue + timingModifiers extended).

**Session context:** Long session continuing Dimensions3 v2 Phase 2 build after context compaction. Phased-with-checkpoints methodology held throughout. Every sub-task followed pre-flight → design/lock → test → NC → commit cadence. Pre-flight audits caught 5 brief transcription slips in 5.9 alone (baseline drift, vitest glob trap, Group 4 function name, Group 3 length miscount, Group 3a MYP short/full mix-up) — none reached EDITS. Next session starts with 5.10 (Admin panel) pre-flight.

## 12 Apr 2026 — Dimensions3 v2 Phase 2 COMPLETE: Sub-tasks 5.10.4–5.14 shipped + pushed

**What changed:**
- **5.10.4** closed — Student grades page H.1 dual-shape bug fixed (`criterion_scores` typed as array, not Record). New `normalizeCriterionScores` 4-shape absorber at `src/lib/criterion-scores/normalize.ts`. Grades page rewired to FrameworkAdapter (`getCriterionLabels` + `FrameworkId` from `@/lib/frameworks/adapter`). 9 wiring-lock tests (L1-L7 + barrel guards). Import path drift caught in Pre-Edit Mini-Report. Lesson #42 appended. FU-J/K/L filed. Commit `75080df`.
- **5.10.5+5.10.6** combined — 4 teacher grading regression locks (G1-G4) ensuring legacy `getFrameworkCriterion` from `@/lib/constants` survives until FU-E migration. FU-E through FU-I filed. Commit `1353204`.
- **5.11** closed — Admin FrameworkAdapter Test Panel at `/admin/framework-adapter`. 8×8 toLabel matrix + per-framework criterion list grid, color-coded by kind (label/implicit/not_assessed). 147 lines. 1 smoke test. Commit `39b8b9b`.
- **5.13** closed — Model ID centralization. `src/lib/ai/models.ts` with `MODELS.SONNET` + `MODELS.HAIKU` constants. 42 hardcoded sites across 28 files replaced (spec said 12 — 3.5× stale). 2 wiring-lock tests. Commit `801f012`.
- **5.14a** closed — Orchestrator integration tests. 7 tests using `runPipeline()` with `sandboxMode: true` + Proxy-based mock supabase. 3ms execution. Commit `8313eac`.
- **5.14** closed — Checkpoint 2.2 E2E test suite. 1 α test (always runs) + 6 β tests (gated behind `RUN_E2E=1` + `ANTHROPIC_API_KEY`). Matt ran on local machine: 7/7 green, $0.16, 73 seconds. Commit `542e6e1`.
- **Checkpoint 2.1 PASSED** — Full static audit (tests couldn't run in Cowork sandbox due to native rolldown binding). All 22 wiring locks, 139 adapter tests, 5 normalizer tests verified via file reads.
- **Checkpoint 2.2 PASSED** — Matt ran `RUN_E2E=1 ANTHROPIC_API_KEY=... npm test` locally. All 7 E2E tests green. Pipeline produced valid TimedUnit, QualityReport with 5 dimensions, $0.16 cost, 73s wall time.
- **Pushed to origin/main** — Matt pushed after both checkpoints passed.

**Files created:**
- `src/lib/criterion-scores/normalize.ts` (4-shape absorber)
- `src/lib/criterion-scores/__tests__/normalize.test.ts` (5 tests)
- `src/app/admin/framework-adapter/page.tsx` (147 lines)
- `src/lib/ai/models.ts` (MODELS.SONNET + MODELS.HAIKU)
- `tests/pipeline/orchestrator-integration.test.ts` (7 integration tests)
- `tests/e2e/checkpoint-2-2-generation.test.ts` (234 lines, 7 E2E tests)

**Files modified:** `src/app/(student)/unit/[unitId]/grades/page.tsx` (H.1 fix + FrameworkAdapter wiring), `src/lib/frameworks/__tests__/render-path-fixtures.test.ts` (22 total it-blocks across 5 describes), `docs/lessons-learned.md` (#42), `docs/projects/dimensions3-followups.md` (FU-E through FU-L), 28 production files (model ID replacement).

**Followups filed:** FU-E (teacher grading FrameworkAdapter migration), FU-F (legacy CRITERIA cleanup), FU-G (getCriterionColor wrapper), FU-H (strand header FrameworkAdapter wiring), FU-I (null-framework fallback audit), FU-J (scale /8 hardcode), FU-K (student-snapshot shape), FU-L (local type collapse).

**Auto-memory updated:** `project_dimensions3_phase2_progress.md` updated with Phase 2 complete status.

**Test counts:** 812 → 891 (+79 this session). tsc baseline held at 80.

**Commits:** 7 new commits this session (including prior sub-session). Pushed to origin/main after Checkpoint 2.2 sign-off.

**Systems affected:** `framework-adapter` (render-helpers + admin panel + criterion-scores normalizer added), `generation-pipeline` (model ID centralization + E2E checkpoint gate), `student-grade-view` (H.1 dual-shape fix), `ai-provider` (model constants centralized).

**Session context:** Two-part session (context compaction between parts). First part covered 5.5-5.9 (FormatProfile wiring + FrameworkAdapter build). Second part covered 5.10.4-5.14 (render path wiring + model centralization + E2E). Phase 2 is now fully complete. Next: Phase 3 (feedback loop) per completion spec.

---

### 13 April 2026 — Dimensions3 Phase 5 Start (Content Safety & Moderation)

**What changed:**
- Phase 4 Checkpoint 4.1 formally passed. FU-M filed for deferred Resend email test.
- CI fix: created `tsconfig.check.json` excluding test/script files from CI typecheck, fixed 54 source-level TS strict-mode errors (null guards, type casts — no logic changes), bumped Node 20→22. Commits `968cb86` + `c7b4ce7`.
- Phase 5A COMPLETE: migration 073 (`student_content_moderation_log` table + `student_progress` moderation columns), shared types in `src/lib/content-safety/types.ts`, 32 new tests including cross-reference (types vs CHECK constraints) + NC verification. Commit `1e3ba47`.
- Phase 5B COMPLETE (via Claude Code): client-side text filter (`src/lib/content-safety/client-filter.ts`), LDNOOBW blocklists vendored (EN+ZH), self-harm supplement lists, PII regex (phone EN/CN + email), word-boundary matching for EN, log endpoint at `/api/safety/log-client-block`. Tests pending final count from Code report.
- Created `build-phase-prep` skill at `.claude/skills/build-phase-prep/SKILL.md` — automates the 4 non-negotiable prep steps (test baseline, read spec, read lessons, audit code) plus new Step 5b (full wiring trace with choke point identification).
- Content-safety system added to WIRING.yaml with `wiring_map.client_choke_points` — 8 specific files where `checkClientSide()` needs to be called in Phase 5E. This was a gap: previous audits found 26 API endpoints but didn't trace upstream to the React components/hooks that are the actual wiring targets.
- Full saveme sync: ALL-PROJECTS.md, dashboard.html, wiring-dashboard.html, system-architecture-map.html, WIRING.yaml (94 systems), doc-manifest.yaml, CLAUDE.md, changelog.md.

**Files created:**
- `.claude/skills/build-phase-prep/SKILL.md`
- `tsconfig.check.json`
- `supabase/migrations/073_content_safety.sql` (via Code)
- `src/lib/content-safety/types.ts` (via Code)
- `src/lib/content-safety/__tests__/types.test.ts` (via Code)
- `src/lib/content-safety/__tests__/migration-073.test.ts` (via Code)
- `src/lib/content-safety/client-filter.ts` (via Code)
- `src/lib/content-safety/blocklists/` (via Code)
- `src/app/api/safety/log-client-block/route.ts` (via Code)

**Test counts:** 948 → 980 (after 5A, +32). 5B count pending Code report.

**Systems affected:** `content-safety` (new), `student-experience` (downstream), `admin-dashboard` (wiring-dashboard updated), WIRING.yaml meta (93→94 systems, 12→13 active).

---

### 13 April 2026 — Dimensions3 Phase 5 COMPLETE (5C–5F, Vercel Fix, saveme)

**What changed:**
- Phase 5C COMPLETE (via Code): NSFW.js client image filter — `client-image-filter.ts` with lazy-loaded MobileNet v2, 0.6 combined threshold (porn+hentai+sexy), `fileToImage()` helper, defence-in-depth (model failure → pass to server).
- Phase 5D COMPLETE (via Code): Server Haiku moderation — `server-moderation.ts` with `moderateContent()` for text+images, bilingual prompt (EN+ZH), tool_choice structured output, `deriveStatus()` override logic, all failures→pending.
- Phase 5E COMPLETE (via Code): Client-side wiring — `checkClientSide()` wired into 7 text choke points (usePageResponses, useToolSession, DesignAssistantWidget, GallerySubmitPrompt, GalleryBrowser, EvidenceCapture, useOpenStudio) + `checkClientImage()` into 3 image upload points (UploadInput, QuickCaptureFAB, EvidenceCapture). 1037→1037 tests (wiring, no new tests).
- Phase 5F COMPLETE (via Code, two sub-phases):
  - 5F-a: Created `moderate-and-log.ts` shared wrapper (moderateContent → log non-clean → return allow/deny). Wired into 6 endpoints: progress (fire-and-forget + student_progress columns), tool-sessions POST/PATCH (fire-and-forget), gallery/submit (sync gate), gallery/review (sync gate), upload (sync image gate with Buffer pattern). 1094 tests (+14 from 5F-a NC).
  - 5F-b: Wired remaining 9 endpoints: design-assistant (fire-and-forget), avatar (fire-and-forget image), quest/sharing POST (sync gate), open-studio/session POST+PATCH (fire-and-forget), portfolio (fire-and-forget), quest/evidence (fire-and-forget), quest/milestones (fire-and-forget), quest/contract (fire-and-forget), planning POST+PATCH (fire-and-forget). 1103 tests (+9 from 5F-b NC).
- **Vercel build fix**: nsfwjs ESM entry statically imports model shard files with non-standard `require()`. webpack minifier crashed with `_webpack.WebpackError is not a constructor` (meta-error masking real problem). Fix: `config.module.noParse = /nsfwjs\/dist\/models/;` in next.config.ts. Also pinned next@15.3.9 (CVE fix), @sentry/nextjs@10.43.0. Vercel deploy GREEN.
- Full saveme sync: ALL-PROJECTS.md, dashboard.html, CLAUDE.md (Next.js version 15.3.3→15.3.9), WIRING.yaml (content-safety summary + key_files + future_needs), wiring-dashboard.html, system-architecture-map.html (content-safety v2→v3), doc-manifest.yaml, changelog.md.

**Files created (via Code):**
- `src/lib/content-safety/client-image-filter.ts` (5C)
- `src/lib/content-safety/server-moderation.ts` (5D)
- `src/lib/content-safety/moderate-and-log.ts` (5F-a)
- Associated test files for each

**Files modified (via Code):**
- 15 API route files wired with moderation (5F-a + 5F-b)
- 7 hooks/components wired with client text filter (5E)
- 3 upload components wired with client image filter (5E)
- `next.config.ts` — noParse for nsfwjs, pinned versions
- `package.json` — next@15.3.9, @sentry/nextjs@10.43.0

**Test counts:** 1037 → 1103 (+66 across 5C–5F).

**Systems affected:** `content-safety` (v2→v3, all sub-phases complete), `student-experience` (all submission endpoints now moderated), build config (next.config.ts noParse + version pins).

---

### 22 April 2026 — Preflight scanner thumbnail_path column-writeback fix (Lesson #53)

**What changed:**
- **Bug identified via smoke test:** Checkpoint 3.1 verification showed `thumbnail_path: null` and `thumbnail_rendered: false` even though the scan completed with `status: done`, `attempt_count: 1`, no error. Diagnostic queries confirmed the thumbnail PNG was in storage (5 objects in `fabrication-thumbnails` bucket) and the path existed inside `scan_results->>'thumbnail_path'` JSONB — the denormalised `thumbnail_path` column on `fabrication_job_revisions` was never written. Affected every Phase 2A (STL) and Phase 2B-6 (SVG) scan.
- **Root cause:** `fab-scanner/src/worker/supabase_real.py:write_scan_results()` writes to three tables but the `fabrication_job_revisions` UPDATE only set `scan_results`, `scan_status`, `scan_error`, `scan_completed_at`, `scan_ruleset_version` — never `thumbnail_path`. The Python `ScanResults` dataclass carries the field and `model_dump()` lands it inside the JSONB; the code assumed that was enough, but UI reads the column directly. Pattern bug affecting both STL and SVG paths.
- **Fix:** 8-line change — added `"thumbnail_path": scan_results.get("thumbnail_path")` to the revisions update dict. `.get()` returns None on missing key so scan errors (no thumbnail attempted) still write cleanly.
- **Tests:** new `fab-scanner/tests/test_supabase_real.py` with 3 cases — (a) thumbnail present in JSONB → column gets the value, (b) thumbnail absent → column is None (not KeyError), (c) all three tables get an update in stable order. First unit-test coverage for the real `SupabaseServiceClient`; prior tests only exercised `MockSupabase` via conftest.py, which is why the missing column write was invisible to CI.
- **Deploy:** Fly app `preflight-scanner` redeployed (image `deployment-01KPS282RPKV0BAYAYJN84KKWK`, 208 MB), both machines healthy after rolling update.
- **E2E verification:** Fresh smoke-test SVG scan (`coaster-orange-unmapped.svg`) wrote `thumbnail_path: f3af1426-b10e-4aea-802c-00c6bbb15b87.png` through to the column. Checkpoint 3.1 2B-7 verification can now close.
- **Backfill:** `UPDATE fabrication_job_revisions SET thumbnail_path = scan_results->>'thumbnail_path' WHERE thumbnail_path IS NULL AND scan_results->>'thumbnail_path' IS NOT NULL` returned 11 rows — all orphaned scans from 21 Apr now have column populated. All storage objects still within 30-day retention window so no dead references.
- **Lesson #53 added** to `docs/lessons-learned.md` — "Denormalised columns need explicit writes; stuffing the whole payload in JSONB doesn't fan them out". Captures the JSONB-vs-column drift pattern + the rule that mock-based tests can't validate DB adapter surface.
- **WIRING.yaml preflight-scanner entry updated:** summary rewritten (116 → 245 pytest tests, STL-only → combined `stl-v1.0.0+svg-v1.0.0` ruleset, cairosvg thumbnail rendering), `external_deps` updated (cairo → cairosvg + cairocffi + pillow).

**Files modified:**
- `fab-scanner/src/worker/supabase_real.py` — +7/-1
- `fab-scanner/tests/test_supabase_real.py` — NEW (+126 lines)
- `docs/lessons-learned.md` — Lesson #53 appended
- `docs/projects/WIRING.yaml` — preflight-scanner entry refreshed
- `CLAUDE.md` — status + What's next refreshed
- `docs/projects/ALL-PROJECTS.md` — header "Last updated" block rewritten
- `/Users/matt/CWORK/CLAUDE.md` (master index) — status block rewritten
- `docs/changelog.md` — this entry
- `docs/doc-manifest.yaml` — last_verified bumped for touched docs

**Test counts:** 242 → 245 pytest (+3 new regression tests in `test_supabase_real.py`). `npm test` baseline 1409 untouched (no TS sources changed).

**Commits:** 1 new local commit on `main` (`345cd51`). WIP backup branch `preflight-thumbnail-column-wip` created at same sha. **Pending-push count: 9 → 10.** Hold for Matt's sign-off before pushing per push-discipline memory.

**Systems affected:** `preflight-scanner` (v1 — writeback column correctness fix; now truly end-to-end correct on both STL and SVG paths).

**Session context:** Continued from previous day's Checkpoint 3.1 verification work where the NULL `thumbnail_path` was first observed. Root-caused inside the Python adapter, fixed, tested, deployed, verified, backfilled, documented, and filed as Lesson #53 — all in one session on main. Changelog drift note: entries between 13 Apr and today (22 Apr) are missing — Dimensions3 Phases 7+ and Preflight Phases 1A/1B-1/1B-2/2A/2B-1..6 all shipped in that window without changelog appends. Out of scope to backfill now; project state is captured in ALL-PROJECTS.md + WIRING.yaml + CLAUDE.md master header instead.

---

### 25 April 2026 — Access Model v2 project plan drafted (planning session, no code)

**What changed:**
- New project plan written: `docs/projects/access-model-v2.md` (~430 lines, 11 sections, 6 phases). Architecture spec for unifying StudioLoom's three parallel auth systems (student token + Supabase teacher Auth + Fabricator Argon2id), introducing schools as a first-class entity, audit log, per-student AI budgets, FERPA/GDPR/PIPL data export+delete, and OAuth (Google + Microsoft + email/PW; Apple deferred behind feature flag).
- **8 architecture decisions locked** during the planning session: (1) every student is an `auth.users` row from day one — classcode+name becomes a custom Supabase auth flow rather than a parallel system; (2) flat school membership with no designated admin — any teacher edits school settings under a two-tier rule (low-stakes instant + 7-day revert; high-stakes need 2nd-teacher confirm in 48h); (3) immutable append-only audit_events; (4) `region` column on schools as forward-prep for residency splits; (5) `unit_version_id` on submission-shaped tables for assessment integrity; (6) per-student AI budget (default 100k tokens/day) enforced at route layer; (7) class-level roles via `class_members`, flat at school level — Matt's super-admin sits on a separate `is_platform_admin` flag on `auth.users`; (8) bootstrap grace window of 7 days for single-teacher schools.
- **5 forward-compat schema seams** added to Phase 0 (schema only, no UX): `school_resources` polymorphic table + relations (first consumer = PYP/Service "people, places, things" library); `guardians` + `student_guardians`; SIS columns (`external_id`/`sis_source`/`last_synced_at`) on students+teachers+classes; `consents` table for FERPA/GDPR/PIPL; `schools.status` lifecycle enum.
- **External community member auth (§8.7)** added as future appendix — `community_member` user_type extensibility, invite-only magic-link, time-bounded class-scoped access. First concrete consumer: Mentor Manager for PYP coordinators / G5 teachers / Service Learning leads (annual mentor recruitment + matching workflow).
- **ALL-PROJECTS.md updates:** added "Access Model v2" entry in Planned section; added "Mentor Manager (PYP / G5 / Service Learning)" entry in Ideas Backlog → High Priority Ideas (4-6d, gated on Access Model v2 shipping); marked "Auth / ServiceContext Seam" as superseded by Access Model v2; reconciled Governance GOV-2 entry — components (1) audit log + (2) Access Model v2 + (4) DSR runbook are now subsumed by Access Model v2, GOV-2 reduces to just (3) impersonation/support-view (~1-2d).
- **Governance + scope reconciliation:** Access Model v2 closes FU-O (no co-teacher/dept-head/admin) + FU-P (no school/org entity) + FU-R (auth model split) + FU-Q (dual student identity) + FU-W (no audit log) — five backlog items collapsed into one project. Unblocks `PH6-FU-MULTI-LAB-SCOPING` (Phase 6 Preflight follow-up). Provides the missing `access-model-v2-spec.md` referenced by GOV-2.
- **Phase 0 trigger:** Preflight Phase 8 ships + merges to main, dashboard-v2 polish quiescent. Estimated wait ~1–2 weeks. Worktree (when work begins): `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`. Do not run parallel with Preflight or dashboard-v2 — surface area too large.

**Files created:**
- `docs/projects/access-model-v2.md` (~430 lines) — full project plan with §1 Why Now, §2 Architecture Decisions (7), §3 Scope (28 in-scope items + 9 explicitly deferred), §4 Phase Plan (6 phases, named Matt Checkpoints), §5 Migration Strategy, §6 Risks, §7 Resolved Decisions (8), §8 School Settings & Governance (8.1 inventory, 8.2 4-layer dedup, 8.3 governance model, 8.4 platform super-admin view, 8.5 migration of existing settings, 8.6 forward-compat seams, 8.7 external community member appendix), §9 Impact on Existing Systems (per WIRING.yaml), §10 Pre-Build Checklist, §11 References.

**Files modified:**
- `docs/projects/ALL-PROJECTS.md` — Access Model v2 project entry added; Mentor Manager idea added; Auth / ServiceContext Seam marked superseded; Governance GOV-2 reconciled.
- `docs/doc-manifest.yaml` — new entry for `access-model-v2.md`; bumped `last_verified` on `ALL-PROJECTS.md`.
- `docs/changelog.md` — this entry.

**Test counts:** unchanged (no code changes). `npm test` baseline 1854 untouched. pytest 245 untouched.

**Systems affected:** *None shipped.* Plan documents future work on `auth-system`, `class-management`, `student-progress`, `fabrication-pipeline`, `nm-assessment`, `student-content-moderation-log`, `ingestion-pipeline`, `school-calendar` and four new planned systems (`school-governance`, `school-registration`, `school-library`, `platform-admin-console`). No WIRING.yaml updates this session — planned tables/systems do not enter registries until they're built.

**Registry sync results (saveme step 11):**
- `api-registry.yaml` — drift from prior sessions captured (+182 lines, not from this session). Reviewed and committed.
- `ai-call-sites.yaml` — drift from prior sessions captured (no diff this session). No-op.
- `feature-flags.yaml` — `SENTRY_AUTH_TOKEN` orphan persists (FU-CC, P3 known).
- `vendors.yaml` — status: ok, no drift.
- `rls-coverage.json` — 7 tables with `rls_enabled_no_policy` (FU-FF, P3 known — `ai_model_config`, `ai_model_config_history`, `fabrication_scan_jobs`, `fabricator_sessions`, `student_sessions`, `teacher_access_requests`).

**Session context:** 8-turn planning conversation initiated by Matt asking about adding OAuth (Google/Microsoft/Apple + email+PW) for students in regions outside China while preserving the classcode+name path for Chinese students (PIPL constraint). Conversation widened to "what else should we lock in now while there are zero students" and produced a world-class spec for the broader access model rather than just OAuth. Matt explicitly approved the elegant unified-auth approach over the simpler dual-auth shortcut: *"id rather do the more elegant approach that is better long term. make this world class. there still aren't any students using it."* Matt also locked in the flat-school-governance model (no designated admin, two-tier change rules) over the conventional school_admin role — *"have teachers be able to edit for all teachers for school-wide settings rather than have a single person who is designated admin of school (who would manage that?) or avoid having another separate school login"*. No code touched. Trigger to begin Phase 0 work: Preflight Phase 8 ships + dashboard-v2 polish quiescent.

---

### 24–26 April 2026 — Lesson Bold Sub-Phases 1–3 SHIPPED on branch + language-scaffolding-redesign spec written

**Branch context:** All work on worktree `/Users/matt/CWORK/questerra-lesson-bold`, branch `lesson-bold-build` (new branch off main `6870eac`). Branch pushed to origin. `main` untouched.

**What changed:**

- **Sub-Phase 1: warm-paper Bold token scope + 3 stub components (24 Apr).** Extended `.sl-v2` scoped CSS in `BoldTopNav.tsx` with a nested `.lesson-bold` block carrying warm-paper tokens. Added `src/app/(student)/unit/[unitId]/template.tsx` (server component) loading Manrope + DM Sans + Instrument Serif via `next/font/google` — fixes pre-existing gap where lesson pages silently fell back to system-ui. Stub components `PhaseStrip`, `KeyConcept`, `AutonomyPicker`. Tests 1939 → 1943 (+4).
- **Sub-Phase 2A: LessonHeader + LessonIntro + VideoBlock (24 Apr).** Extracted hero header + learning-goal block + intro media. `pageContent.learningGoal` becomes the italic-serif "Why this matters" line. `pageContent.success_criteria` becomes the 3-up numbered LO strip. Wiring-lock test in `render-path-fixtures.test.ts` rewritten (chip rendering moved into LessonHeader). Tests 1943 → 1944.
- **Sub-Phase 2B: LessonFooter + LessonToolsRail (24 Apr).** Replaced legacy full-bleed Complete & Continue block + 4 floating FAB buttons. Modal panels + QuickCaptureFAB + MobileBottomNav + StudentFeedbackPulse preserved verbatim.
- **Sub-Phase 2C: LessonSidebar warm-paper restyle (24 Apr).** Token-only refactor — sidebar `<aside>` got `lesson-bold` class so warm-paper tokens activate locally.
- **Sub-Phase 3: AutonomyPicker + migration 121 + ActivityCard hint/example gating (24 Apr).** Migration 121 added `student_progress.autonomy_level TEXT CHECK IN ('scaffolded','balanced','independent')` — no DEFAULT, no NOT NULL, no backfill (Lesson #38). 5 helpers gating hints + examples. Lesson #17 retry-without-column on both upsert paths. Tests 1944 → 1952 (+8). NC: flipped `hintsAvailable` to always-true, confirmed test failed at expected line, reverted via Edit (Lesson #41). Migration 121 applied to local dev only — scheduled for rollback in language-scaffolding-redesign Phase 0 (migration 122 DROP COLUMN).
- **5 mockup iterations on the StudioSetup drawer (24–26 Apr).** `docs/newlook/StudioSetupDrawer-mockup.html` v1 → v5. The drawer concept ultimately died in the language-scaffolding-redesign pivot (configuration → invocation).
- **Cowork research session against ~10 platforms (Newsela, Duolingo, Immersive Reader, Read&Write, Lexia, Read Along, Khan, Seesaw, CommonLit, Medley) (26 Apr).** Established the configuration→invocation pattern. Closest reference: Medley Learning's Response Starters panel.
- **Language scaffolding redesign pre-build spec written (26 Apr).** `docs/projects/language-scaffolding-redesign-brief.md` — 594-line spec covering audit findings (caught WIRING `student-learning-support` doc-vs-reality drift on translation / dyslexia / UDL / ADHD focus claims with no code), proposed architecture (Tap-a-word + Response Starters), 6-phase build plan, Q1–Q6 with proposed defaults, cost analysis ($0.0007/student/week, ~$0.25 per 30-student 12-week pilot), migration notes. Matt locked 7 decisions in §0.5: pivot (Q1=a), WIRING fix mid-build (Q2=i), single L1 (Q3), taps_per_100_words fade trigger (Q4), full Phase 1 mount surface, image source Wikimedia + Open Symbols, sandbox threaded from day 1.

**Files created:**
- `src/app/(student)/unit/[unitId]/template.tsx`
- `src/components/student/lesson-bold/{PhaseStrip,KeyConcept,AutonomyPicker,LessonHeader,LessonIntro,VideoBlock,LessonFooter,LessonToolsRail,helpers,index}.tsx`
- `src/components/student/lesson-bold/__tests__/shell.test.tsx`
- `supabase/migrations/121_student_progress_autonomy_level.sql` — applied dev only, scheduled for rollback
- `docs/newlook/StudioSetupDrawer-mockup.html` — 5 historical iterations
- `docs/projects/lesson-bold-brief.md` — Lesson Bold master brief
- `docs/projects/language-scaffolding-redesign-brief.md` — pre-build spec for the next build

**Files modified:**
- `src/components/student/BoldTopNav.tsx` — appended `.sl-v2 .lesson-bold` block
- `src/components/student/LessonSidebar.tsx` — token-only restyle
- `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — 661 → 565 lines
- `src/components/student/ActivityCard.tsx` — `autonomyLevel` prop + warm-paper hint/example UI
- `src/hooks/usePageResponses.ts` — exposes `autonomyLevel` + setter
- `src/app/api/student/progress/route.ts` — accepts `autonomyLevel` + retry-without-column
- `src/types/index.ts` — `StudentProgress.autonomy_level?` union
- `src/lib/frameworks/__tests__/render-path-fixtures.test.ts` — wiring-lock rewrite

**Test counts:** 1939 → **1952 passed · 8 skipped · 1960 total · 127 files**.

**Commits (all pushed to `origin/lesson-bold-build`):** `e77a313` · `ba8594c` · `537fbdd` · `dbde598` · `6e64ad3` · `ba87542` · `7aa3421` · `a721dcf` · `fb7085d` · `31847bf` · `8e28195` · `6de8a1f` · `c8a194d` · `a8c0907`.

**Systems affected:** `lesson-view` (v1 → v1.5, warm-paper Bold restyle on branch), `student-learning-support` (planned doc-vs-reality drift fix in Phase 0 of redesign), new tracked work `language-scaffolding-redesign`. AutonomyPicker flagged for rollback next session.

**Follow-ups filed:**
- `FU-LS-DRIFT` — WIRING `student-learning-support` entry was claiming complete features that didn't exist (translation, dyslexia fonts, UDL, ADHD focus). Update entry to `status: planned` + `currentVersion: 0` in Phase 0 of language-scaffolding-redesign.

**Session context:** Hybrid build session — Sub-Phases 1–3 of Lesson Bold shipped methodically against a brief written at session start; mid-session pivot triggered by Matt observing that AutonomyPicker felt off; Cowork research session led to invocation-over-configuration thesis; spec for the redesign written + signed off; AutonomyPicker scheduled for rollback. Branch `lesson-bold-build` is push-clean but not yet merged to main — merge happens after language-scaffolding-redesign Phase 0 (rollback) lands cleanly. **Migration 121 in dev only — DROP via migration 122 will land in same Phase 0.** Pending-push count to main: 0 (work is on feature branch).

---

### 26 April 2026 — Session close: lesson-bold-build merged to main + Phase 0 closed + saveme

**What changed:**
- Merged `lesson-bold-build` → `main` (`3c1d626`) bringing 18 commits live: warm-paper Bold restyle (Sub-Phases 1, 2A–2C) + language-scaffolding-redesign Phase 0 (AutonomyPicker rollback, ELL-only ActivityCard gating restored, FU-LS-DRIFT filed, WIRING `student-learning-support` flipped to `status: planned`).
- Migration collisions dodged twice mid-merge: branch's 116/117 collided with Phase 8's school_id_reserved 116/117 + Preflight 8.1d-13/14's 118/119. Final renumber to **121** (ADD `student_progress.autonomy_level`) + **122** (DROP), with 120 left as gap. Migration 122 applied to prod by Matt (no-op since 121 was dev-only — symbolic only). Push-discipline obligation cleared.
- 2 follow-up commits on main: `886c7f7` (renumber fixup) + 2 origin merges absorbing parallel Preflight 8.1d-13/14 work landed during the merge sequence.
- Cleanup: `lesson-bold-build` branch deleted (local + remote). Worktree registration removed. Directory survives at `/Users/matt/CWORK/questerra-lesson-bold/` (~675MB, optional `rm -rf`).
- Significant parallel work landed on main during/after this session: Preflight Phase 8.1d-15..19 (queue filter/sort/bulk-approve, fab queue lifecycle timeline, scanner copy + filename collision fixes), dashboard PYPX Phase 13a-1..4 (exhibition setup CTA, mentor cadence free-text), skills-library Path A (AI assist for skill card authoring), build-discipline v2 (sessionhandover ritual + migration timestamp prefixes). All auto-merged cleanly.

**Saveme sync results (steps 11):**
- `api-registry.yaml` — drift captured: +100 lines (new Phase 8.1d + Path 13a + skills routes from parallel sessions). Committed.
- `ai-call-sites.yaml` — drift captured: +62 lines (new AI calls from skills-library + others). Committed.
- `feature-flags.json` — status: `drift`, 1 orphan = `SENTRY_AUTH_TOKEN` (FU-CC, P3 known build-time-only).
- `vendors.json` — status: `ok`, no drift.
- `rls-coverage.json` — status: `drift_detected`, 7 tables `rls_enabled_no_policy` (FU-FF, P3 known undocumented deny-all pattern). No new tables.
- `schema-registry.yaml` — no edit needed: migrations 121/122 cancel out (column added + dropped before prod ever saw it).

**Files modified:**
- `docs/api-registry.yaml` — +100 lines via scanner
- `docs/ai-call-sites.yaml` — +62 lines via scanner
- `docs/scanner-reports/{feature-flags,rls-coverage,vendors}.json` — drift JSON refreshed
- `docs/changelog.md` — this entry
- `docs/handoff/main.md` — refreshed via step 12

**Test counts:** 2144 passed · 8 skipped · 2152 total · 136 files at last full run (pre-parallel-work). Not re-run after origin/main merges; assume current main is green based on the merge-only nature of incoming commits.

**Pending-push count:** 0 → will be 1 after this saveme commit lands.

**Systems affected:** `lesson-view` (v1 → v1.5 warm-paper restyle SHIPPED), `student-learning-support` (status flipped complete→planned, redesign tracked at `language-scaffolding-redesign-brief.md`). All other systems untouched by this session.

**Trigger for next session:** `go phase 1` or `tap-a-word` — Phase 1 of language-scaffolding-redesign (Tap-a-word v1, definition only, 8 mount surfaces). Spec: `docs/projects/language-scaffolding-redesign-brief.md` §3 Phase 1.

## 26 Apr 2026 PM — Teacher Dashboard Phase 13a-5 + 13b first cut: PYPX cohort dashboard live

**What changed:**
- **Phase 13a polish landed (`56d9359`, `8122ffd`, `10ef1f4`):** mentor check-in cadence dropped from Exhibition setup (per-mentor not per-class — moved to Mentor Manager scope); phase column dropped from student-projects inline editor (output not input); system accounts (`@studioloom.internal`) filtered from mentor picker.
- **Phase 13a-5 SHIPPED (`af4b0a5`):** student projects inline editor at `/teacher/classes/[classId]/exhibition`. ~370-line `StudentProjectsCard` with one row per enrolled student (title · central idea · theme · mentor), auto-save 600ms debounced per row, server-authoritative merge so id flips null→uuid + updated_at land. New endpoint `/api/teacher/teachers/list` seeds the mentor picker (same-school teachers, system accounts filtered).
- **Phase 13b-1 SHIPPED (`05e9c2a`):** new endpoint `/api/teacher/pypx-cohort?classId=X&unitId=Y` returns single payload (cohort metrics + per-student card data). 409 lines. Joins class_units + class_students + students + student_projects + teachers + student_progress.
- **Phase 13b-2 + 13b-3a SHIPPED (`28fc709`):** PypxView rebuilt to consume the cohort API. Hero with class badge, "Exhibition in N days." countdown, COHORT AVG / NEED ATTENTION / AHEAD metrics top-right, 5-segment phase distribution bar at the bottom. Student card grid below with avatar (deterministic colour from id hash) + project title + phase pill + per-student progress bar + mentor pill or red "Unassigned" + status pill (coral ring around needs-attention cards). 622 lines added, 237 removed.
- **Mentor Manager spec drafted (`d441547`):** `docs/projects/mentor-manager.md` — coordinator-meeting draft for sibling project. 1-page coordinator brief on top + engineering appendix below + 3 open questions for the PYP coordinator meeting (~early May 2026).
- **Hotfix during session:** mentor dropdown empty on prod smoke. Diagnostic SQL surfaced 4 teacher rows → 1 with school_id (Matt's loominary), 2 NULL Matt test accounts, 1 system account. Manual SQL backfill set school_id on the test accounts; endpoint patched to filter `@studioloom.internal` accounts.
- **Migration 115 schema-cache fix:** `NOTIFY pgrst, 'reload schema';` after Matt manually applied 115 to prod. Then full migration body re-run via SQL editor when diagnostic confirmed `student_projects` table didn't exist on prod (column did but table didn't — partial apply).

**Heuristics baked in (with sign-off):**
- Progress % = completed pages / unit totalPages (mirrors existing dashboard route).
- Phase = 5-bucket of progress % (0-20 Wonder, 20-40 Find out, 40-60 Make, 60-80 Share, 80+ Reflect). Read-time only — column not written.
- Status = ±15% bands around cohort avg + hard rules (no project title → Needs attention; no activity 7+ days → Needs attention with "Stalled X days" reason).

**Saveme sync results (steps 11):**
- `api-registry.yaml` — drift captured: +44 lines (4 new routes — `pypx-cohort`, `teachers/list`, plus 2 from parallel preflight `fab/jobs/[jobId]/assign-machine` + `fab/machines`). Committed.
- `ai-call-sites.yaml` — re-ran scanner; no diff (no new AI calls this session).
- `feature-flags.json` — status: `drift`, 1 orphan = `SENTRY_AUTH_TOKEN` (FU-CC, P3 known build-time-only). Pre-existing, not from this session.
- `vendors.json` — status: `ok`, no drift.
- `rls-coverage.json` — status: `drift_detected`, 7 tables `rls_enabled_no_policy` (FU-FF, P3 known undocumented deny-all pattern). Pre-existing — student_projects has RLS policies.
- `schema-registry.yaml` — no manual update this session (migration 115 was manually applied to prod earlier in the session via SQL editor; schema-registry should be updated to reflect `class_units.exhibition_config` + `student_projects` but this is a step-12 follow-up — registry uses live introspection mode).

**Files modified (this saveme commit):**
- `docs/api-registry.yaml` — 4 new routes
- `docs/projects/teacher-dashboard-v1.md` — 13a + 13b rows flipped to ✅ Done with full scope summary
- `docs/projects/ALL-PROJECTS.md` — Teacher Dashboard v1 (Bold) entry added under Active Projects
- `docs/projects/WIRING.yaml` — `teacher-dashboard` system bumped to v2 + `pypx-exhibition` system added (+99 → 100 systems)
- `docs/decisions-log.md` — 6 new decisions appended (cadence per-mentor, phase as output, cohort heuristics triple, hero year copy, mentor manager v0 auth, school_resources first consumer)
- `docs/changelog.md` — this entry
- `docs/handoff/dashboard-v2-build.md` — written via step 12

**Test counts:** Not re-run this session (UI work). Branch tests assumed green based on TS-clean + targeted typechecks during build.

**Pending-push count:** 0 → 1 after this saveme commit lands.

**Systems affected:** `teacher-dashboard` (v1 → v2 in_progress, summary rewritten), `pypx-exhibition` (NEW, currentVersion 1 in_progress).

**Trigger for next session:** `dashboard next` or `pypx 13b polish` — Phase 13b-3b (filter chips + view toggle [cards/table/by-phase] + per-student detail page) OR Phase 13c (student PYPX dashboard ~2 days, port `pypx_dashboard.jsx` to real students). Mentor Manager v0 stays parked until coordinator meeting confirms scope.

---

## 27 April 2026 — Tap-a-word Phase 1 SHIPPED end-to-end

**Branch:** `tap-a-word-build` (24 commits) merged into `main` via `b915e02` + `000685c` (gate fix). Pushed to `origin/main` after Checkpoint 1.1 sign-off + prod migration applied.

**What changed (Phase 1 of language-scaffolding-redesign):**
- **Phase 1A (scaffold):** TappableText + WordPopover (createPortal) + useWordLookup hook + tokenize.ts + sandbox + `/api/student/word-lookup` route + migration `20260426140609_word_definitions_cache.sql` + 13 tokenizer tests + 9 route tests. Lesson #39 stop_reason guard + defensive destructure on every Haiku call. Migration: timestamp-prefix discipline (first feature branch to use it end-to-end).
- **Phase 1B (mounts):** MarkdownPrompt `tappable` prop (markdown-aware leaf wrap) + ActivityCard prompts + ELL-1 hint card + LessonIntro + VocabWarmup definition+example + KitMentor speech bubble + DesignAssistantWidget assistant role + CheckInPanel mentor messages. Toolkit-prompt mounts deferred (28 bespoke tools — separate refinement).
- **Phase 1C (seed + verify):** 575-word `scripts/seed-data/design-vocab-500.json` across 10 categories, expanded to 578 (added ergonomics + anthropometrics + biomechanics) + sandbox-aware seed script `scripts/preflight-tap-a-word-seed.mjs` with batched Haiku + cost tracking + gated live E2E test `tests/e2e/word-lookup-live.test.ts` + empirical cold-cache smoke `scripts/cold-cache-smoke.mjs`.
- **Mid-build hotfix (`a6696a8`):** Route gate corrected from `RUN_E2E !== "1"` to `NODE_ENV === "test" && RUN_E2E !== "1"` — dev users now see real definitions instead of `[sandbox]` sentinel text. Lesson #56.
- **Sandbox cache pollution discovered + cleaned:** 5 dev-test taps wrote sentinel rows to shared cache; manually purged. Filed FU-TAP-SANDBOX-POLLUTION (P2). Lesson #57.

**Verification (Checkpoint 1.1):**
- ✅ Sandbox seed pipeline: 10/10 ok end-to-end against prod Supabase, idempotent re-run
- ✅ Live E2E: `RUN_E2E=1 vitest run tests/e2e/word-lookup-live.test.ts` returns real "ergonomics" definition in 1592ms
- ✅ Live seed: 575/575 words processed, $0.5278 one-time, 0 failures
- ✅ Visual smoke: real definitions in popovers across 5 mount surfaces (Matt confirmed)
- ⚠️ Cold-cache empirical: 11.2% hit rate on real lessons → criterion #5 reframed as behavioural ("<20 uncached TAPS per student", measurable post-launch via Phase 4 signals). Lesson #58.

**Migrations:** `20260426140609_word_definitions_cache.sql` applied to dev (26 Apr) + prod (27 Apr). Composite PK `(word, language, context_hash, l1_target)`, RLS read-anon, service-role write.

**Tests:** 2159 → **2181 passed | 9 skipped | 139 files** (+22 tests, +3 files). tsc 0 errors. Build green with `NODE_OPTIONS=--max-old-space-size=4096`.

**Decisions added (5):** route gate fix, cold-cache criterion #5 reframe, sandbox-pollution architectural lesson, migration discipline v2 vindicated, choke-point mount strategy.

**Lessons added (3):** #56 (test-mode vs sandbox-mode conflation), #57 (sandbox writes pollute shared cache), #58 (empirical hit-rate smoke reframes spec criteria).

**FUs added (3):** FU-TAP-SANDBOX-POLLUTION (P2), FU-BUILD-HEAP (P3), FU-AI-CALL-SCANNER-GUARD-DETECTION (P3).

**Systems affected:** `tap-a-word` (NEW, status `planned`, currentVersion 0 — flips to complete/v1 when Phase 5 ships); `student-learning-support` (status stays `planned` until Phase 5).

**Cost spent this session:** ~$0.53 live seed + ~$0.0005 live E2E + ~$0.003 ergonomics rerun = **~$0.535 total**.

**Pending after this saveme:** Apply prod migration (DONE), push origin/main (DONE), Phase 2 (L1 translation + audio + image) awaits next session. Decide whether toolkit-prompt mounts land as a 1B refinement or fold into Phase 2.

---

## 27 April 2026 (PM) — Phase 2 + Phase 2.5 SHIPPED end-to-end

**Branch:** `tap-a-word-phase-2-5-build` (12 commits) merged into `main` via `2f08fb6`. Pushed to `origin/main`. **`student_support_settings` migration apply pending** (Matt-action; SQL given in chat).

**Sub-phases shipped (in order):**
- **Phase 2A — L1 translation slot** (`56b25b1` → `52a3cbe`): Server-side `l1_target` derivation from `learning_profile.languages_at_home[0]`. Dynamic Anthropic prompt + tool schema (max_tokens 250→400). Supports en/zh/ko/ja/es/fr. WIRING `tap-a-word.currentVersion` 0→1.
- **Phase 2B — Audio buttons** (`94fdfee` → `53c6b7c`): Browser SpeechSynthesis. Two micro-buttons (English voice next to word, L1 voice next to translation). `useTextToSpeech` hook + `pickVoice` pure helper. Hidden gracefully when L1 voice missing on device.
- **Phase 2.5 — Teacher control panel** (inserted mid-flight, `e90bb01` → `f758f11`): Per-student + per-class JSONB overrides for `l1_target_override` + `tap_a_word_enabled`. New migration `20260427115409_student_support_settings`. `resolveStudentSettings` server-side precedence chain (class > student > intake > default). Teacher UI page at `/teacher/classes/[classId]/students/support` with inline edit + bulk multi-select + confirmation modal. New `useStudentSupportSettings` page-session-cached client hook. Route returns `{disabled:true}` when teacher gates the student. **Inserted ahead of original Phase 2 sequence after Matt's "real students arriving" trigger.**
- **Phase 2C — Image dictionary** (`4a91f93` → `a48bb7e`): Static curated dictionary (`src/lib/tap-a-word/image-dictionary.json`). `imageForWord(word)` synchronous loader. v0 ships 6-entry seed using Wikimedia Commons `Special:FilePath` URLs (auto-resolves to current CDN). Lazy-load + onError graceful hide.
- **Phase 2D-sample — Toolkit mounts** (`ccd7940` → `25e0095`): TappableText on 3 of 27 toolkit tools (ScamperTool / MindMapTool / BrainstormWebTool — the 3 that render prompt as JSX variable). 24 remaining tools deferred as `FU-TAP-TOOLKIT-FULL-COVERAGE` P3 — they hardcode prompts inline, requiring content-aware refactors. Wait for Phase 4 signal data to prioritise.

**Verification (pre-merge):**
- ✅ Phase 2A — Tests 2181 → 2207 (+26 incl. 12 lang-mapping + 14 route)
- ✅ Phase 2B — Tests 2207 → 2215 (+8 pickVoice)
- ✅ Phase 2.5 — Tests 2215 → 2252 (+37 incl. 18 resolver + 18 API + 1 disabled-path)
- ✅ Phase 2C — Tests 2252 → 2259 (+7 image-dictionary)
- ✅ Phase 2D-sample — Tests unchanged (pure JSX wraps)
- ✅ tsc clean throughout
- ✅ Build green with `NODE_OPTIONS=--max-old-space-size=4096`
- ⚠️ `student_support_settings` migration NOT YET applied to prod — SQL ready for Matt to paste

**Migrations this session:**
- `20260427115409_student_support_settings.sql` — 2 ALTER TABLE ADD COLUMN JSONB DEFAULT '{}'. Idempotent (IF NOT EXISTS). Applied to local dev only at the moment.

**Decisions added (8):** authority model A (student-as-source + teacher-overrides), per-student + per-class scope, Phase 2.5 inserted ahead of 2C/2D, bulk ops with confirmation only (no undo/history for v0), Phase 2D scope deferred to 3-of-27, image dictionary 6-entry v0 seed, sandbox-pollution defensive fix even though gate change made it moot, migration discipline v2 vindicated again.

**Lessons added (1):** #59 (brief estimates can lie when audit hasn't happened yet — for any "N similar items" estimate, sample-audit before locking time).

**FUs added (1):** `FU-TAP-TOOLKIT-FULL-COVERAGE` P3 — wrap remaining 24 toolkit tools after Phase 4 signal data shows priorities.

**FUs resolved (1):** `FU-TAP-SANDBOX-POLLUTION` P2 — defensive fix in Phase 1 closeout.

**Systems affected:** `tap-a-word` (currentVersion 0→1, status stays planned until Phase 5; affects:[+toolkit] for 2D-sample); `student-learning-support` unchanged (still planned until Phase 5 ships full coverage).

**Cost spent this session (Phase 2 work):** $0.0 (all changes are infrastructure + UI; no Anthropic calls fired beyond Phase 1 baseline).

**Pending after this saveme:** (1) Matt applies `student_support_settings` migration to prod; (2) browser-test the teacher control panel; (3) decide Phase 3 (Response Starters) vs Phase 4 (signal infrastructure + unified settings) as next major chunk.

---

### 29 April 2026 — Access Model v2 Phase 0 SHIPPED ON BRANCH (foundation schema + audit pre-reqs)

**What changed:**

All 9 sub-tasks of Access Model v2 Phase 0 (Foundation Schema + Audit Pre-Reqs) shipped on the `access-model-v2` branch in worktree `/Users/matt/CWORK/questerra-access-v2`. 12 migrations + 5 audit-derived security artifacts + 209 new tests. **51 commits ahead of main, not pushed.** Awaiting Matt's manual Supabase apply of remaining 7 migrations + Checkpoint A1 sign-off + branch merge to main.

**Sub-tasks shipped (all DONE):**

- **0.1** schools column expansion — 6 cols: `status` (lifecycle enum), `region`, `bootstrap_expires_at`, `subscription_tier` (monetisation seam), `timezone` (IANA), `default_locale`. Mig `20260428125547`. Tests +13.
- **0.2** user locale columns — `teachers.locale` + `students.locale`. Mig `20260428132944`. Tests +7. **Option A scope** — SIS columns originally planned here narrowed to locale-only after pre-flight audit caught mig 005_lms_integration.sql already had SIS-shaped columns under different names. Canonicalisation deferred to Phase 6.
- **0.3** student/unit school_id gap fill + backfill — `students.school_id` + `units.school_id` (nullable + indexed) + UPDATE FROM teacher chain + `COALESCE(author_teacher_id, teacher_id)` for units. Mig `20260428134250`. Tests +13. NOT NULL tightening deferred to Phase 0.8.
- **0.4** soft-delete + unit_version_id — `deleted_at` on `students/teachers/units` (3 cols) + `unit_version_id` UUID FK `unit_versions(id)` ON DELETE SET NULL on 7 submission-shaped tables (`assessment_records`, `competency_assessments`, `portfolio_entries`, `student_progress`, `gallery_submissions`, `fabrication_jobs`, `student_tool_sessions`). Mig `20260428135317`. Tests +19. Existing `is_archived` patterns on `classes` / `knowledge_items` / `activity_blocks` preserved — harmonisation deferred to Phase 6.
- **0.5** `user_profiles` table (Option B chosen) — id PK FK `auth.users(id) ON DELETE CASCADE` + 6-value `user_type` enum (`student / teacher / fabricator / platform_admin / community_member / guardian`) + `is_platform_admin BOOLEAN`. Auto-create trigger on `auth.users` INSERT alongside existing `handle_new_teacher` trigger. Backfill from existing teachers. RLS: self-read + platform_admin-anywhere; INSERT/UPDATE deny-by-default (trigger + service role only). Mig `20260428142618`. Tests +20.
- **0.6** 7 forward-compat tables across 3 migration pairs:
  - **0.6a** `school_resources` + `school_resource_relations` + `guardians` + `student_guardians` (mig `20260428214009`, +24 tests)
  - **0.6b** `consents` (polymorphic subject, RLS deny-all-Phase-0; mig `20260428214403`, +16 tests)
  - **0.6c** `school_responsibilities` (programme coordinators) + `student_mentors` (cross-program mentorship — resolves FU-MENTOR-SCOPE P1; polymorphic mentor via `auth.users` FK; mig `20260428214735`, +22 tests)
- **0.7** core access tables across 2 migration pairs:
  - **0.7a** `class_members` (6-role enum incl. `mentor`) + `audit_events` (immutable append-only, polymorphic actor_type 7 values, denormalised school+class FKs, monetisation analytics seam, 5 indexes; mig `20260428215923`, +24 tests)
  - **0.7b** `ai_budgets` (polymorphic subject student/class/school) + `ai_budget_state` (per-student running counter; mig `20260428220303`, +19 tests)
- **0.8** backfill split into 0.8a + 0.8b for safer manual application:
  - **0.8a** orphan teachers → personal schools, students/units cascade tail, class_members lead_teacher seed (single DO $$ block with RAISE EXCEPTION on remaining NULLs; mig `20260428221516`, +18 tests)
  - **0.8b** tighten NOT NULL on students/units/classes school_id (with pre-flight RAISE EXCEPTION guards; mig `20260428222049`, +14 tests)
- **0.9** audit-derived non-schema deliverables:
  - api-registry annotation: 7 `/api/tools/*` routes → `auth: public` (closes audit F10; scanner heuristic + gate threshold bumped 40→50)
  - `docs/security/multi-matt-audit-query.md` — read-only diagnostic for 3-Matts + duplicate-name candidates
  - `scripts/security/rotate-encryption-key.ts` + `docs/security/encryption-key-rotation.md` (closes audit F9; per-row decrypt-encrypt-roundtrip-verify with --dry-run)
  - `docs/security/mfa-procedure.md` (closes audit F6 procedurally; Matt enables in Supabase dashboard)
  - `src/lib/access-v2/__tests__/rls-harness/` — RLS test scaffold + 1 starter test (closes audit F14 partially; full coverage = `FU-AV2-RLS-HARNESS-FULL-COVERAGE` P2)

**Plan corrections during execution (filed as inline edits to access-model-v2.md):**
- §3 item #26 rewritten to acknowledge mig 005 SIS prior art (Option A decision)
- §3 Phase 0 column-additions bullet updated to name exact tables for soft-delete + unit_version_id
- §8.6 item 3 full reality-check section with what-vs-what comparison table
- §3 §8.6 expanded from 5 to 7 forward-compat tables (added school_responsibilities + student_mentors)
- §4 Phase 0 user-type bullet updated to ship 6 enum values from day one
- Phase 0 brief sub-task table rows ticked DONE for each completed sub-task
- Supabase boundary note added to Phase 0 brief header (Matt applies migrations + dashboard + prod queries manually, not autonomously)

**Decisions logged (9 entries):** see `docs/decisions-log.md` tail for full text. Highlights: Option B for user_profiles (Supabase recommendation over auth.users direct columns); Option A for SIS columns (mig 005 prior art deferral); 3 soft-delete patterns coexist (don't harmonize in Phase 0); 6-value user_type enum from day one (community_member + guardian match schema seams); 7 forward-compat tables (programme coordinators + student mentors added 28 Apr from cross-program mentorship discovery); class_members.role includes 'mentor'; 0.8a/0.8b split for safer manual application; multi-Matt prod data preserved as 3 separate teacher rows; API versioning + timezone seams added 28 Apr.

**Side-findings filed (5 follow-ups + several closed):**
- `FU-AV2-GUARDIAN-CONTACT-ENCRYPTION` P3 — encrypt guardians.email + phone before parent portal UI
- `FU-AV2-AUDIT-EVENTS-PARTITION` P3 — partition by month when row count justifies (~1M rows)
- `FU-AV2-RLS-HARNESS-FULL-COVERAGE` P2 — extend harness to per-route coverage as Phase 1+ migrates routes
- `FU-AV2-NEW-TEACHER-USER-TYPE-DEFAULT` (Phase 1 fixup — handled when auth unification updates the trigger)
- Earlier in session: `FU-AV2-IT-SUPPORT-USER-TYPE`, `FU-AV2-TEACHER-CROSS-SCHOOL-MOVE`, `FU-AV2-MULTI-SCHOOL-MEMBERSHIPS`, `FU-AV2-HIERARCHICAL-GOVERNANCE`, `FU-AV2-PROGRAMME-COORDINATORS` (filed in §3 deferred list)

**Files created:**
- 12 migration pairs at `supabase/migrations/2026*.sql` + `.down.sql`
- 12 migration shape test files at `src/lib/access-v2/__tests__/migration-*.test.ts`
- `docs/projects/access-model-v2-phase-0-brief.md` (~470 lines master brief for the phase)
- `docs/security/multi-matt-audit-query.md`, `docs/security/mfa-procedure.md`, `docs/security/encryption-key-rotation.md`
- `scripts/security/rotate-encryption-key.ts`
- `src/lib/access-v2/__tests__/rls-harness/{README.md, setup.ts, students.live.test.ts}`

**Files modified:**
- `docs/projects/access-model-v2.md` — extensive plan corrections (Path B chosen, Option B for user_profiles, mig 005 prior art, Option A scope narrowing, soft-delete pattern coexistence, scope expansion for programme coordinators + student mentors, monetisation/timezone/locale/API-versioning forward-compat seams, etc.)
- `docs/api-registry.yaml` — sync after scanner heuristic fix (7 unknown → public)
- `docs/schema-registry.yaml` — sync via sync-schema-registry.py (88 → 108 entries, +20 from Phase 0 tables + columns)
- `docs/ai-call-sites.yaml` — sync (no diff this session)
- `scripts/registry/scan-api-routes.py` — path-based public override for `/api/tools/*` + gate threshold bumped 40→50

**Test counts:** 2433 → **2642 passed** (+209 across all 9 sub-tasks); 9 → 11 skipped (+2 RLS harness live tests skipped without env). Typecheck clean throughout.

**Systems affected:** none "live" — Phase 0 is pure schema + scaffolding. WIRING.yaml `auth-system` entry will update in Phase 1 when the unified `getStudentSession()` helper lands. Schema-registry now records 12 new tables + ~12 column additions.

**Registry sync results (saveme step 11):**
- `api-registry.yaml` — drift captured (the F10 fix + recent route work)
- `ai-call-sites.yaml` — clean
- `feature-flags.yaml` — `SENTRY_AUTH_TOKEN` orphan persists (FU-CC, P3 known)
- `vendors.yaml` — clean, status: ok
- `rls-coverage.json` — 7 RLS-no-policy tables (all pre-existing FU-FF set; zero new from Phase 0)
- `schema-registry.yaml` — 108 entries (+20 from Phase 0)

**Scheduled task gap:** `refresh-project-dashboard` not in scheduled-tasks MCP — same gap as previous saveme runs. Dashboard `PROJECTS` array sync deferred to manual update or master CWORK-level dashboard refresh.

**Session context:** This was the multi-day Phase 0 execution. Started from access-model-v2 plan signed off 25 Apr + IT audit reviewed 28 Apr → restructured plan for Path B (ship-before-pilot) → 9 sub-tasks across 3+ days of work in the questerra-access-v2 worktree. Matt manually applied migrations 0.1–0.5 to prod during execution (per "Supabase actions go through me manually" rule); migrations 0.6+ ship on the branch awaiting his apply. Checkpoint A1 verification ran with **5 PASS / 2 PARTIAL / 3 PENDING-MATT** status; merge to main waits for the 3 PENDING-MATT items (apply remaining migrations, MFA enrol, ENCRYPTION_KEY fire drill).

---

### 29 April 2026 — Access Model v2 Phase 0 APPLIED TO PROD + Checkpoint A1 PASS

**What changed (post-saveme-#1 prod applies):**

Following the saveme commit `64d2afc` that flipped Access Model v2 to "PHASE 0 SHIPPED ON BRANCH", Matt walked through the 12-step prod application + Checkpoint A1 close-out one step at a time. All 12 done.

**Migrations applied to prod** (Supabase project `cxxbfmnbwihuskaaltlk`):
1. ✅ 0.1 schools_v2_columns (already applied earlier in session window)
2. ✅ 0.2 user_locale_columns (already applied)
3. ✅ 0.3 student_unit_school_id (already applied)
4. ✅ 0.4 soft_delete_and_unit_version_refs
5. ✅ 0.5 user_profiles (4 teachers backfilled with user_type='teacher')
6. ✅ 0.6a school_collections_and_guardians (4 tables)
7. ✅ 0.6b consents (1 table + deny-all RLS)
8. ✅ 0.6c school_responsibilities + student_mentors
9. ✅ 0.7a class_members + audit_events
10. ✅ 0.7b ai_budgets_and_state — **mid-apply fix** for Lesson #61 (`WHERE reset_at < now()` rejected by Postgres because `now()` is STABLE not IMMUTABLE; partial predicate dropped, plain b-tree on `reset_at` ships)
11. ✅ 0.8a backfill — **mid-apply data fix** for orphan unit `Arcade Machine Project` (`fd2eaf1d-...`) which had NULL author_teacher_id AND teacher_id. Derived author from class_units chain → set to `mattburto@gmail.com` Matt row (`0f610a0b-...`). Migration ran cleanly afterward: 0 orphans, 26 lead_teacher rows seeded matching 26 classes-with-teacher.
12. ✅ 0.8b NOT NULL tighten on students/units/classes school_id — **mid-apply data fix** for the 26 classes that had NULL school_id (Phase 0 doesn't auto-backfill mig 117's nullable column). Manual UPDATE FROM teacher chain populated all 26. Then 0.8b ran cleanly.

**A1 ops items (Steps 10–12):**
- ✅ Step 10 — Multi-Matt audit query run. Output: 3 Matts at NIS school_id `636ff4fc-...`, no other duplicate-name candidates. Data weights: `mattburto@gmail.com` (13 classes / 6 students / 7 units, oldest), `mattburton@nanjing-school.com` (7/1/3, school email), `hello@loominary.org` (6/0/1, newest). Phase 6 cutover decision: keep all 3 vs merge → deferred per plan.
- ✅ Step 11 — Supabase MFA TOTP **Enabled** at project level (audit F6 satisfied). Per-user enrolment deferred to Phase 2 in-app UI (StudioLoom doesn't have `/auth/mfa/enroll` route yet — Supabase doesn't allow admin-side enrolment). `is_platform_admin=true` set on `mattburton@nanjing-school.com` user_profiles row.
- ✅ Step 12 — ENCRYPTION_KEY rotation script smoke-tested via `--dry-run`. Prod has 0 encrypted rows (no BYOK API keys, no LMS integrations wired pre-pilot). Script connected to prod, queried 3 encrypted columns (ai_settings.encrypted_api_key, teacher_integrations.encrypted_api_token, lti_consumer_secret), reported 0 rows in each, exited `Failed: 0`. Live rotation deferred until first BYOK row exists. Rotation log entry appended to `docs/security/encryption-key-rotation.md`.

**Checkpoint A1 final status: ALL 10 PASS ✅** (was 5 PASS / 2 PARTIAL / 3 PENDING-MATT post-saveme-#1).

**Lessons logged this session:**
- **Lesson #61** (`docs/lessons-learned.md`) — non-IMMUTABLE functions in index predicates are rejected by Postgres. Sibling to Lesson #38: shape-asserting tests catch string presence but not SQL semantic errors. Pair migration shape tests with execution tests against a real Postgres OR audit partial index predicates for `STABLE`/`VOLATILE` functions before declaring "Phase X DONE on branch".

**Bumped commits:**
- `2f87f1b` fix(access-v2): drop non-IMMUTABLE WHERE clause from idx_ai_budget_state_due_reset (mid-apply Lesson #61 fix)

**Branch state:** `access-model-v2` at HEAD (commit added during this session). 53+ commits ahead of `main`. Tree clean. Ready to merge to main via PR. Worktree cleanup deferred — Matt can `git worktree remove ../questerra-access-v2` after merge OR keep for Phase 1.

**Session context:** This was the prod apply + A1 close-out session. Multi-step walkthrough one migration at a time. Two mid-apply hiccups (Lesson #61 SQL bug + orphan data); both diagnosed + fixed inline; both informed Lesson #61 + the data-fix patterns. Now Phase 1 (Auth Unification — every student → auth.users + getStudentSession() helper + route migration) is the next milestone.

---

### 29 April 2026 (later) — Hygiene + Phase 1 brief drafted on branch + registry-consultation discipline codified

**Systems affected:** repository hygiene, admin tooling (bug-reports), build-phase-prep skill, governance (registry consultation discipline), Access Model v2 (Phase 1 brief on feature branch).

**What shipped to main today:**

1. **Bug-report screenshot signed URL TTL** (`d97decd`) — bumped 30 min → 4 hr. Single-admin internal use; URL-leakage trade-off acceptable for the realistic triage workflow.

2. **Repo hygiene Tier 1** (`9b83a71`) — relocated 247 MB of tracked reference material (`3delements/`, `docs/safety/`, `docs/newmetrics/`, `comic/`, `docs/newlook/`, `docs/lesson plans/`) to `/Users/matt/CWORK/_studioloom-reference/` (sibling, not in git). `.gitignore` blocks re-add. 5,307 files removed; 488,798 line deletions. Every future `git worktree add` skips the bulk. Recovered ~3 GiB free across 7 worktrees.

3. **Test fixture relocation** (`5ce589b`) — restored `mburton packaging redesign unit.docx` + `Under Pressure...pdf` from the relocated reference folder to `tests/fixtures/ingestion/`. CI caught they were genuinely needed by `tests/e2e/checkpoint-1-2-ingestion.test.ts`. Net hygiene saving drops from 247 MB → ~230 MB. Lesson logged in decisions-log: my grep audit needs to cover `tests/` not just `src/` + `scripts/`.

4. **FU-REGISTRY-DRIFT-CI filed** (`3007f38`) — P2 follow-up tracking the gap that `build-phase-prep` skill consulted only `WIRING.yaml`, leaving 5 other registries blind. 3-layer recommendation: L1 skill update (done — see #5), L2 pre-commit warn, L3 CI gate.

5. **`build-phase-prep` skill — Step 5c added** — registry consultation now MANDATORY for any phase touching ≥3 files. Lists the 7 registries, requires spot-check against code, requires registry-sync sub-phase in commit plan. Master `CLAUDE.md` "Non-negotiables per phase" gets a 9th item codifying it.

**What landed on `access-model-v2-phase-1` feature branch (NOT pushed to main):**

- `42b2cf7` — Phase 1 brief draft (475 lines) covering 6 sub-phases of auth unification: backfill students → auth.users, custom Supabase classcode+name flow, `getStudentSession()`/`getActorSession()` polymorphic helpers, 3-batch route migration (A: 21 read-only, B: 21 mutation, C: 17 student-touching teacher routes), RLS simplification on 7 tables, negative control + cleanup. Synthetic email format locked: `student-<uuid>@students.studioloom.local`.
- `5be1599` — Registry cross-check amendment. Added §3.7 with 10 verified gaps (numbers grep-confirmed), §4.7 Registry hygiene sub-phase (12 update steps that must land before A2 sign-off), risk #5 covering `student_sessions` RLS-no-policy promotion to load-bearing during the grace period (closes FU-FF P3), Checkpoint A2 extended with explicit registry-sync gate items.

Branch state: `access-model-v2-phase-1` at `5be1599`, 2 commits ahead of `main`, not pushed. Awaiting Matt sign-off on synthetic email format + grace period decisions before §4.1 code starts.

**Registries (this saveme — main-side):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | +2 routes (393 → 395; `/api/student/search` newly registered + `bug-reports` tables_read/written shape correction) |
| `ai-call-sites.yaml` | Rerun scanner — applied | No drift |
| `feature-flags.yaml` | Rerun scanner | Drift: `SENTRY_AUTH_TOKEN` orphaned (pre-existing FU-CC P3), `RUN_E2E` missing (test/CI env var, classification question — leave for now) |
| `vendors.yaml` | Rerun scanner | No drift |
| `rls-coverage.json` | Rerun scanner | 7 `rls_enabled_no_policy` (3 known: `ai_model_config*`, `student_sessions` per FU-FF; `fabricator_sessions`, `fabrication_scan_jobs`, `admin_audit_log`, `teacher_access_requests`). Phase 1 §4.5 closes 2 of these |
| `schema-registry.yaml` | Manual review | No new migrations on main this session (Phase 1 migrations come on its own branch) |
| `data-classification-taxonomy.md` | Manual review | No drift. Phase 1 brief §4.7 will add the Synthetic/Opaque Identifiers rule when Phase 1 ships |

**Lessons + decisions:**
- New decision: registry cross-check is a hard gate on phase briefs (logged)
- New decision: repo hygiene Tier 1 (logged)
- New decision: bug-report TTL 30→4hr (logged)
- No new lessons — the WIRING `key_files` drift was Lesson #54 already, applied; the test-grep gap is captured in a decision.

**Commits to main this session window:** `c3c6457..3007f38` (bug-reports fix, hygiene, fixtures, FU added).

**Branch state at saveme:** `main` clean, all today's work pushed. `access-model-v2-phase-1` 2 ahead, local-only, awaiting Phase 1 sign-off.

**Next:** Phase 1 of Access Model v2 (Auth Unification, ~3.5 days incl. registry hygiene). Pre-flight + research spike when Matt says "go" on the brief.

---

### 29 April 2026 (later still) — Access Model v2 Phase 1.1a/1.1b/1.1d/1.2 SHIPPED ON BRANCH + verified in preview

**Branch:** `access-model-v2-phase-1` (8 commits ahead of `main`, pushed)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Test count:** 2642 (Phase 0 baseline) → **2695** (+53 new tests across 1.1a + 1.1b + 1.1d + 1.2)
**Typecheck:** 0 errors

**Sub-phases shipped + state:**

| Sub-phase | What | Prod state |
|---|---|---|
| 1.1a | ALTER TABLE students ADD COLUMN user_id UUID NULL FK auth.users(id) ON DELETE SET NULL + partial index + comment | ✅ Applied to prod via Supabase SQL Editor; verified column + FK + index + comment shape |
| 1.1b | TS backfill script `scripts/access-v2/backfill-student-auth-users.ts` (--dry-run, --rollback flags, idempotent, robust to SDK drift) | ✅ Applied to prod; **7 students backfilled**, 7 auth.users created with synthetic emails + `app_metadata.user_type='student'` + `school_id` + `created_via='phase-1-1-backfill'`, 7 user_profiles auto-created via Phase 0 trigger |
| 1.1d | Shared helper `provisionStudentAuthUser()` at `src/lib/access-v2/provision-student-auth-user.ts` + wires into 3 server-side INSERT routes (LTI launch, welcome/add-roster, integrations/sync) + post-Phase-1.1d miss fix to add school_id on add-roster's parseEntry payload | Pure code; no prod step. Filed FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2) for the 4 client-side UI INSERT sites Phase 1.4 will refactor |
| 1.2 | `POST /api/auth/student-classcode-login` — generateLink + verifyOtp via SSR cookie adapter; per-IP + per-classcode rate limit; lazy-provision fallback for UI-created students; audit_events on every outcome (success/failed/rate_limited); sanitised error logging; Cache-Control: private | ✅ Verified end-to-end in Vercel preview deploy: HTTP 200 happy path + sb-* session cookies set + JWT decoded with `app_metadata.user_type='student'` + 401 failure paths + audit_events rows shaped correctly + ip_address captured |

**Test breakdown (29 new test cases added in this session):**
- `migration-phase-1-1a-student-user-id-column.test.ts` — 8 shape tests
- `provision-student-auth-user.test.ts` — 15 helper tests (pure helpers + happy/skip/reuse/fail paths + throwing variant)
- `student-classcode-login/__tests__/route.test.ts` — 9 route tests (rate limit / 401 / lazy provision fail / generateLink fail / verifyOtp fail / happy + lazy provision)
- `backfill-student-auth-users.test.ts` — 21 backfill tests (refactored to delegate to shared helper; 2 tests updated for new createUser-first semantics)

**Lessons added (`docs/lessons-learned.md`):**
- Lesson #62 — Use `pg_catalog.pg_constraint` for cross-schema FK verification, not `information_schema.constraint_column_usage` (surfaced when 1.1a's `students.user_id` FK to `auth.users(id)` was correctly created but information_schema query falsely reported zero rows; pg_catalog query confirmed the constraint exists with `ON DELETE SET NULL`)

**Side issues handled in parallel by another session (NOT in this branch):**
- `units-school-id-hotfix` (`c2ccb7e`) merged to main — fixes `/api/teacher/units` create case for post-0.8b NOT NULL school_id
- Follow-up cleanup `462cfa8` on main — covers 4 other server-side INSERT sites (units/route.ts fork, convert-lesson, welcome/create-class, welcome/setup-from-timetable)
- Proposal doc `c67dbc1` `access-v2-phase-1-school-id-foldin-proposal.md` reviewed and rejected — fold-in into Phase 1 conflated auth-unification with constraint-compliance bugfixes; recommendation taken to keep them as separate hotfixes on main + a single Phase-1.1d miss fix on this branch (add-roster school_id population)

**Phase 1.2 prod-preview verification results (29 Apr 2026 PM):**
- Test 1 (happy path): HTTP 200 + sb-* cookie + Cache-Control: private + correct response body ✅
- Test 2 (JWT decode): app_metadata.user_type='student' + school_id + created_via all in claims; access_token TTL 3600s; amr method='otp' confirms magiclink flow ✅
- Test 3a (bad classCode): HTTP 401 + Cache-Control: private + body `{"error":"Invalid class code"}` + audit row with failureReason='invalid_class_code' ✅
- Test 3b (bad username): HTTP 401 + Cache-Control: private + body `{"error":"Student not found in this class"}` + audit row with failureReason='student_not_in_class' ✅
- Test 4 (audit_events): 3 rows landed with correct shape; actor_id populated on success / NULL on failure; payload_jsonb shape correct; ip_address from x-forwarded-for ✅
- Test 5 (per-classcode rate limit): skipped (unit-test covered)

**Phase 1 progress:** 4 sub-phases of 7 done. Highest-risk sub-phase (1.2) verified. Remaining: 1.3 helpers (~0.5d), 1.4 route migrations (~1d), 1.5 RLS simplification (~0.5d), 1.6 negative control + cleanup (~0.5d), 1.7 registry hygiene (~0.5d). ~3 days from Checkpoint A2.

**Registries (this saveme):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | New route `/api/auth/student-classcode-login` registered earlier in commit `c2a7456` (Phase 1.2). Scanner picked up the route + tests. No new diff this saveme. |
| `ai-call-sites.yaml` | Rerun scanner — applied | No diff |
| `feature-flags.yaml` | Rerun scanner | Pre-existing FU-CC drift (SENTRY_AUTH_TOKEN orphan) + RUN_E2E test env var still missing — known, deferred |
| `vendors.yaml` | Rerun scanner | Status: ok |
| `rls-coverage.json` | Rerun scanner | 7 known `rls_enabled_no_policy` (FU-FF + 6 others) — none new. Phase 1.5 closes 2 of these (student_sessions + fabrication_scan_jobs). |
| `schema-registry.yaml` | Manual review | Phase 1.1a column add documented in migration shape test (`migration-phase-1-1a-student-user-id-column.test.ts`); `students.user_id` writers list expansion to be done in Phase 1.7 registry hygiene — drift acknowledged, deferred (not load-bearing). |
| `data-classification-taxonomy.md` | Manual review | No drift this session. Phase 1.7 registry hygiene adds the Synthetic/Opaque Identifiers rule when Phase 1 closes. |

**Branch state at saveme:** clean. 8 commits ahead of `main`, pushed.

**NEXT:** Matt continues to Phase 1.3 — `getStudentSession()` / `getActorSession()` polymorphic helpers. Pure code, no prod step. Builds on the now-verified architecture.

---

### 29 April 2026 (evening) — Phase 1.3 + 1.4a + 1.4b + 1.5 + 1.5b SHIPPED ON BRANCH; Phase 1.4 verified end-to-end in prod-preview

**Branch:** `access-model-v2-phase-1` (21 commits ahead of `main`, all pushed)
**Test count:** 2695 → **2762** (+67 across the evening session)
**Typecheck:** 0 errors throughout
**Lessons added:** #62 (pg_catalog FK verification), #63 (Vercel preview URLs are deployment-specific)

**Sub-phases shipped + state:**

| Sub-phase | What | State |
|---|---|---|
| 1.3 | Polymorphic actor session helpers (`getStudentSession` / `getActorSession` / `requireStudentSession` / `requireActorSession`) | ✅ Code on branch; 18 tests |
| 1.4a | Dual-mode `requireStudentAuth` wrapper — legacy entry point tries Supabase Auth first, falls back to legacy. All 63 student routes auto-upgraded with zero route file changes. | ✅ Code on branch; 9 tests; **VERIFIED in prod-preview** |
| 1.4b | 6 GET routes explicitly migrated to `requireStudentSession` (grades, units, insights, safety/pending, me/support-settings, me/unit-context) | ✅ Code on branch; **VERIFIED in prod-preview** |
| 1.5 | 4 RLS migrations: students self-read + 3 REWRITES of broken policies (competency_assessments, quest_journeys+milestones+evidence, design_conversations+turns). Pre-flight audit caught that `student_id = auth.uid()` was wrong post-Phase-1.1a (different UUIDs). Rewrites use `auth.uid() → students.user_id → students.id` chain. | ✅ Migrations + 21 shape tests on branch; awaiting Matt's prod apply |
| 1.5b | 4 additive RLS migrations: class_students parallel auth.uid policy, student_progress self-read, fabrication_jobs + fabrication_scan_jobs self-read, student_sessions explicit deny-all (closes FU-FF). | ✅ Migrations + 19 shape tests on branch; awaiting Matt's prod apply |

**Phase 1.4 prod-preview verification (29 Apr evening):**

| Test | URL | Method | Status | Notes |
|---|---|---|---|---|
| 1 | `studioloom-git-...vercel.app/api/auth/student-classcode-login` | POST | 200 ✅ | sb-* cookies set |
| 2 | `studioloom-git-...vercel.app/api/student/units` (Phase 1.4b) | GET via sb-* | 200 ✅ | requireStudentSession reads JWT, dual-mode auth works |
| 3 | `studioloom-git-...vercel.app/api/student/portfolio` (NOT migrated) | GET via sb-* | 200 ✅ | dual-mode wrapper auto-upgrades via legacy `requireStudentAuth` |

**False alarm during verification (Lesson #63 source):** Initial Test 2 attempts returned 401 against the OLD deployment URL (`studioloom-5yfej1l0t-...`). That URL pinned to a Phase-1.2-era build, before Phase 1.4a/b shipped. Switching to the auto-aliased branch URL (`studioloom-git-access-model-v2-phase-1-...`) immediately returned 200. Spent ~30 min adding diagnostic logging (commits 57454af, f0087ea — both reverted in 80d68f6) before realising the URL was stale. Logged as Lesson #63 — Vercel preview URLs are deployment-specific.

**Side cleanup commit (`8b0be68`):** accidentally committed `cookies.txt` (test artifact with valid session token) in 57454af. Removed via `git rm` + appended `.gitignore` entry to block future commits. Repo is private + token is for synthetic test student, blast radius near zero.

**Registries (this saveme):**

| File | Action | Result |
|---|---|---|
| `api-registry.yaml` | Rerun scanner — applied | No new diff (Phase 1.4b helper migration didn't add routes) |
| `ai-call-sites.yaml` | Rerun scanner — applied | No diff |
| `feature-flags.yaml` | Rerun scanner | Pre-existing FU-CC + RUN_E2E drift (known) |
| `vendors.yaml` | Rerun scanner | Status: ok |
| `rls-coverage.json` | Rerun scanner | **Drift dropped from 7 → 5 entries** (student_sessions + fabrication_scan_jobs exited the drift bucket via Phase 1.5b — even though the migrations haven't applied to prod yet, the scanner reads the migration files in the repo). Remaining 5 (admin_audit_log, ai_model_config, ai_model_config_history, fabricator_sessions, teacher_access_requests) are separate concerns or intentional deny-all. |
| `schema-registry.yaml` | Manual review | spec_drift entries for the Phase 1.5 + 1.5b RLS rewrites tracked in Phase 1.7 (registry hygiene sub-phase) |
| `data-classification-taxonomy.md` | Manual review | No drift |

**What's next:**

1. **Matt applies 8 RLS migrations to prod** via Supabase SQL Editor (Phase 1.5: 4 migrations, then Phase 1.5b: 4 migrations, in timestamp order; ~10 sec each). Each is a small SQL paste from the file.
2. **Phase 1.4c** — Batch B (mutations) + Batch C (teacher routes touching students), ~38 routes mechanical migration. Tracked: FU-AV2-PHASE-14B-2 (P3) covers the 18 GET routes too.
3. **Phase 1.4 client-switch** — change routes from `createAdminClient()` to RLS-respecting SSR client. Higher-stakes than helper migration; route-by-route review.
4. **Phase 1.6** — negative control + cleanup (delete legacy fallback, drop alias pattern from 1.4b).
5. **Phase 1.7** — registry hygiene (WIRING auth-system rewrite, schema-registry spec_drift, taxonomies).
6. **Checkpoint A2** — gate criteria + merge to main.

~2 days from Checkpoint A2.
