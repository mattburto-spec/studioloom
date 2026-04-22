# Preflight Phase 5 — Soft-Gate Results UI

**Status:** READY — all 7 open questions resolved 22 Apr 2026 PM (§10). First sub-phase (5-1) can open whenever Matt kicks it off.
**Date drafted:** 22 April 2026 PM
**Spec source:** `docs/projects/fabrication-pipeline.md` §8 (Soft-Gate UX), §13 Phase 5
**Predecessor:** Phase 4 complete + Checkpoint 4.1 PASSED (`b22601e` on preflight-active), tests 1545 passing.
**Blocks:** Phase 6 (teacher approval queue — consumes `fabrication_jobs.status='pending_approval'` rows this phase produces), full pilot.
**Estimated duration:** ~2–3 days (6 sub-phases, each gated, separate commits).
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## 1. What this phase ships

The pedagogical heart of Preflight. Phases 2–4 built the scan pipeline + upload UX. Phase 5 is the moment where the scan becomes a teaching moment instead of a pass/fail gate. Students see their results bucketed into must-fix / should-fix / FYI, acknowledge each warning individually (soft gating), and either re-upload a fixed version or submit for teacher approval.

This phase replaces the Phase 4-5 "Scan complete" stub card with a proper three-bucket evidence viewer, wires the re-upload endpoint that was deferred from Phase 4 (PH4-FU-REVISION-ENDPOINT P1), and lands the submission transition that drives `fabrication_jobs.status` from `uploaded/scanning` to `pending_approval` or `approved` depending on machine profile config.

**Ships:**

1. **Re-upload endpoint** — `POST /api/student/fabrication/jobs/[jobId]/revisions`. Creates `revision_number = max+1` on an existing job, mints a new signed upload URL at `fabrication/{teacher}/{student}/{jobId}/v{N+1}.{ext}`, returns same shape as Phase 4-1 `/upload` response. Idempotent by design (via the existing `uq_fabrication_scan_jobs_active_per_revision` unique index on scan_jobs).
2. **Warning acknowledgement endpoint** — `POST /api/student/fabrication/jobs/[jobId]/acknowledge-warning`. Body: `{ revisionNumber, ruleId, choice }` where choice is a free-text "this is intentional" / "I'll handle it in slicer" / (default) ack. Persists to `fabrication_jobs.acknowledged_warnings` JSONB keyed by `{revision_N: {rule_id: { choice, timestamp }}}`. Column already exists (migration 095:82) — no migration needed.
3. **Submit endpoint** — `POST /api/student/fabrication/jobs/[jobId]/submit`. Validates (a) the latest revision's scan_status is `done`, (b) zero BLOCK-severity rules fired, (c) every WARN-severity rule has an ack on this revision. Transitions `fabrication_jobs.status` to `pending_approval` if `machine_profiles.requires_teacher_approval = true`, else `approved`.
4. **Rule-bucket classifier** — pure helper in `src/lib/fabrication/rule-buckets.ts`. Maps a scan_results rule list to `{ mustFix: Rule[], shouldFix: Rule[], fyi: Rule[] }`. Also the submit-gate predicate: `canSubmit(results, acks, revisionNumber) → { ok: boolean; reason?: string }`.
5. **Results viewer component** — `src/components/fabrication/ScanResultsViewer.tsx`. Renders the three-bucket layout from spec §8. Per-rule card: severity badge, title, explanation, fix_hint, evidence text (coordinate snippets if rule.evidence is populated), Skills Library deep-link stub. Must-fix cards are static (no interaction). Should-fix cards have a 3-option radio + persisted ack state. Submit button disabled until canSubmit returns ok.
6. **Re-upload flow** — `ReuploadButton` component: on click, opens a modal file picker locked to the original job's class/machine (no re-selection), validates + hits the new `/revisions` endpoint + navigates to `/fabrication/jobs/[jobId]` which re-polls for the new revision's scan.
7. **Revision history panel** — inline section on the status page showing prior revisions with mini thumbnails + rule-count summaries. Collapsed by default when current revision is still in progress.
8. **Status page rewrite** — `/fabrication/jobs/[jobId]/page.tsx` now orchestrates: polling (existing Phase 4-5 hook) + results viewer (new) + re-upload affordance + revision history + submit flow. The Phase 4-5 `ScanProgressCard` becomes the `in-progress` state only; terminal states delegate to `ScanResultsViewer`.
9. **pytest / npm test coverage** — rule-bucket classifier (pure fn tests), submit-gate predicate, 3 endpoint route tests, status page integration-style tests where feasible.
10. **WIRING.yaml + dashboard + ALL-PROJECTS.md** — saveme sync at Checkpoint 5.1.

**Does NOT ship in Phase 5:**

- Teacher approval queue (`/teacher/fabrication`) — Phase 6.
- Per-rule evidence thumbnail callouts with coordinate overlays — text evidence only for v1; visual overlay is a Phase 9 polish item if scan_results.evidence actually populates coordinates.
- Skills Library content for fabrication topics — deep-link stubs only. Clicking goes to `/skills/[slug]` which may 404 until Skills Library catalogues fabrication rules (out of scope).
- Celebration / gamification on pass — spec §8 is explicit: "No celebration overkill — it's a normal step."
- Pass-state nav to the teacher queue — Phase 6 wires the teacher side.
- Safety alerts (weapon-shaped STL → moderation feed) — Phase 6 integrates with the existing safety alert system.

---

## 2. Infrastructure

**No new infra. No migration.**

- `fabrication_jobs.acknowledged_warnings JSONB` already exists (migration 095:82). Phase 5 writes to it.
- `machine_profiles.requires_teacher_approval BOOLEAN NOT NULL DEFAULT false` already exists (migration 093). Phase 5 reads it.
- Signed upload URL minting reuses the Phase 4-1 orchestration lib (`createUploadJob` refactored or wrapped for the revisions case).
- No new buckets, no new RLS, no new vendor integrations.

**Auth:** student cookie-token sessions (`requireStudentAuth`). All 3 new API routes live under `/api/student/*`. No teacher-facing routes in Phase 5 — Phase 6 owns those.

**Cache hygiene:** Lesson #11 — every new route sets `Cache-Control: private, no-cache, no-store, must-revalidate`. The submit endpoint is especially exposed — it mutates state based on client-claimed ack state, so we can't have a CDN edge serving a stale success response.

**File size cap:** Re-uploads use the same 50 MB ceiling as Phase 4-1 (Supabase Free Plan per-object limit, tracked as FU-FAB-UPLOAD-200MB).

---

## 3. Sub-phase split (6 instruction blocks)

Each sub-phase: pre-flight → assumptions block → audit → write → test → NC → commit → report cycle. Separate commits. Per build methodology + Phase 2–4 pattern.

### 5-1 — Revision + submit + ack endpoints

**Goal:** Ship the three new API routes + the orchestration helpers they share.

**Files touched:**
- `src/app/api/student/fabrication/jobs/[jobId]/revisions/route.ts` (NEW)
- `src/app/api/student/fabrication/jobs/[jobId]/submit/route.ts` (NEW)
- `src/app/api/student/fabrication/jobs/[jobId]/acknowledge-warning/route.ts` (NEW)
- `src/lib/fabrication/orchestration.ts` (extend — `createRevision`, `acknowledgeWarning`, `submitJob`)
- `src/lib/fabrication/__tests__/orchestration.test.ts` (extend)
- Route test files under each route's `__tests__/` (note: `[jobId]` tests mock the orchestration surface directly — `vi.importActual` breaks with bracket paths per the Phase 4-2 finding).

**Audit first:** existing Phase 4-1 `createUploadJob` code so `createRevision` can share the signed-URL-minter + path-builder; schema-registry entry for `fabrication_jobs.acknowledged_warnings` to confirm the JSONB shape convention.

**Commit:** `feat(preflight): Phase 5-1 revision + submit + ack endpoints`

**Est:** ~0.5 day

---

### 5-2 — Rule bucket classifier + submit-gate predicate

**Goal:** Pure helpers in `src/lib/fabrication/rule-buckets.ts` that the results viewer + submit endpoint share. No React, no fetch, fully unit-testable.

**Files touched:**
- `src/lib/fabrication/rule-buckets.ts` (NEW)
- `src/lib/fabrication/__tests__/rule-buckets.test.ts` (NEW)

**Shape:**

```ts
type Severity = "block" | "warn" | "fyi";
interface Rule { id: string; severity: Severity; title: string; explanation?: string; fix_hint?: string; evidence?: unknown; }

function classifyRules(scanResults: { rules: Rule[] }): {
  mustFix: Rule[];
  shouldFix: Rule[];
  fyi: Rule[];
};

function canSubmit(params: {
  results: { rules: Rule[] };
  acknowledgedWarnings: Record<string, { choice: string; timestamp: string }>;
  revisionNumber: number;
}): { ok: true } | { ok: false; reason: string; missingAcks?: string[] };
```

Test cases: every permutation of BLOCK/WARN/FYI rules, empty rules array, all-WARN with partial acks, all-WARN with full acks, mixed-state edge cases.

**Commit:** `feat(preflight): Phase 5-2 rule bucket classifier + submit gate`

**Est:** ~0.3 day

---

### 5-3 — ScanResultsViewer component + per-rule cards

**Goal:** The three-bucket UI from spec §8. Stateless controlled component — parent owns ack state + submit handler.

**Files touched:**
- `src/components/fabrication/ScanResultsViewer.tsx` (NEW — container)
- `src/components/fabrication/RuleCard.tsx` (NEW — single rule card with severity variants)
- `src/components/fabrication/rule-card-helpers.ts` (NEW — pure label/formatter helpers, extracted to a `.ts` sibling so tests don't import JSX — same pattern as picker-helpers.ts in Phase 4-3)
- `src/components/fabrication/__tests__/rule-card-helpers.test.ts` (NEW)

**Component API:**

```tsx
<ScanResultsViewer
  scanResults={...}
  acknowledgedWarnings={...}
  onAcknowledge={(ruleId, choice) => Promise<void>}
  onSubmit={() => Promise<void>}
  onReupload={() => void}
  canSubmitState={...}   // from canSubmit() in 5-2
  isSubmitting={boolean}
/>
```

Must-fix cards: red-tinted border, 🛑 badge, fix hint text, no interaction. Should-fix cards: amber border, ⚠️ badge, 3-option radio group (`{ intentional: "I've checked — this is intentional", will-fix-slicer: "I'll add supports in the slicer", acknowledged: "Understood" }`). FYI cards: grey-tinted, ℹ️ badge, read-only text.

**Commit:** `feat(preflight): Phase 5-3 ScanResultsViewer + per-rule cards`

**Est:** ~0.5 day

---

### 5-4 — Status page rewrite + ack wiring

**Goal:** Replace the Phase 4-5 "Scan complete" stub with the full results flow. Keep the Phase 4-5 `ScanProgressCard` for the in-progress states; delegate terminal states to `ScanResultsViewer`.

**Files touched:**
- `src/app/(student)/fabrication/jobs/[jobId]/page.tsx` (rewrite)
- `src/components/fabrication/ScanProgressCard.tsx` (narrow scope — remove the done-state branch since ScanResultsViewer handles it; keep idle/polling/error/timeout)

**Flow:**
1. Page mounts with `jobId` from URL.
2. `useFabricationStatus(jobId)` polls — renders `ScanProgressCard` until terminal.
3. On `state.kind === 'done'`:
   - Fetch `fabrication_jobs.acknowledged_warnings[revision_N]` via status endpoint (extend 4-2 status route to include this).
   - Render `ScanResultsViewer` with scan_results + acks.
   - Wire `onAcknowledge` → POST `/acknowledge-warning` + optimistic state update.
   - Wire `onSubmit` → POST `/submit` + redirect on success to (placeholder) `/fabrication/submitted/[jobId]`.
   - Wire `onReupload` → open file picker modal → POST `/revisions` → navigate with fresh revision number in URL hash.

**Note:** the Phase 4-2 status endpoint returns `revision.scanStatus` etc. but NOT the scan_results rules themselves (JSONB was kept off the thin status payload). For Phase 5-4 we need either:
- (a) Extend the status endpoint to include `scan_results` JSONB (simpler, one endpoint).
- (b) Add a new `GET /api/student/fabrication/jobs/[jobId]/results` endpoint (more endpoints, cleaner separation).

**Decision for v1:** extend the status endpoint with a `?include=results` query param. If absent, behave as today; if present, include `scan_results` + `acknowledged_warnings`. Avoids forcing every 2s poll to pull the full JSONB.

**Commit:** `feat(preflight): Phase 5-4 status page rewrite + ack wiring`

**Est:** ~0.4 day

---

### 5-5 — Revision history panel + re-upload modal

**Goal:** Students can see their previous attempts. Re-upload flow uses the same class/machine as the original job (no re-selection).

**Files touched:**
- `src/components/fabrication/RevisionHistoryPanel.tsx` (NEW — collapsible, shows prior revisions with mini thumbnails + rule-count summary)
- `src/components/fabrication/ReuploadModal.tsx` (NEW — file picker + progress reusing Phase 4-4 components)
- Status page wires both.

**Data:** new `GET /api/student/fabrication/jobs/[jobId]/revisions` returning array of `{ revisionNumber, scanStatus, thumbnailUrl, ruleCounts: { block, warn, fyi }, createdAt }` for the entire job. Or: extend `?include=results` on status endpoint to return `allRevisions` too. Pick the first for clarity.

**Commit:** `feat(preflight): Phase 5-5 revision history + re-upload modal`

**Est:** ~0.4 day

---

### 5-6 — Submitted state, Skills Library stubs, prod smoke + Checkpoint 5.1

**Goal:** Close out the phase with a minimal "Submitted — waiting for teacher approval" page, link stubs for Skills Library, and a real end-to-end smoke on prod.

**Files touched:**
- `src/app/(student)/fabrication/submitted/[jobId]/page.tsx` (NEW — simple confirmation page; Phase 6 will wire what happens next)
- `src/components/fabrication/RuleCard.tsx` (add Skills Library `<Link href="/skills/fab-{ruleId}">` stub — visually disabled if library catalogue not populated, per spec)
- `docs/projects/preflight-phase-5-checkpoint-5-1.md` (NEW — 15-ish criterion matrix report)

**Prod smoke scenarios (from Matt):**

1. **Happy path** — upload small-cube-25mm.stl (known-good), scan completes, only FYI rules, submit → lands on submitted page with `fabrication_jobs.status = 'pending_approval'` (or `approved` depending on the seeded machine profile's `requires_teacher_approval`).
2. **Soft-gate path** — upload a WARN-triggering fixture (e.g., a mesh that hits R-STL-04 floating islands), see the should-fix bucket, click an acknowledge option, Submit button enables, submit succeeds.
3. **Hard-gate path** — upload a BLOCK-triggering fixture (e.g., chess-pawn-inverted-winding.stl), see the must-fix bucket, Submit remains disabled, click "Re-upload a fixed version" → upload a known-good fixture → new revision scans, lands clean, submit.
4. **Multi-revision history** — after #3, the revision history panel shows both revisions (broken + fixed) with rule-count summaries.

**Commit:** `feat(preflight): Phase 5-6 submitted state + Skills Library stubs + Checkpoint 5.1`

**Est:** ~0.4 day

---

## 4. Success criteria (Checkpoint 5.1)

- [ ] `POST /api/student/fabrication/jobs/[jobId]/revisions` creates revision N+1 with fresh signed URL. Tested + prod smoke.
- [ ] `POST /api/student/fabrication/jobs/[jobId]/acknowledge-warning` persists to `acknowledged_warnings` JSONB keyed by `{revision_N: {rule_id: {choice, timestamp}}}`. Tested.
- [ ] `POST /api/student/fabrication/jobs/[jobId]/submit` validates (scan done + zero BLOCK + every WARN acked) and transitions job status. Tested with all validation failure modes + happy path.
- [ ] `classifyRules` + `canSubmit` pure helpers: ≥ 20 unit tests across severity permutations + ack permutations.
- [ ] `ScanResultsViewer` renders 3 buckets with correct severity badges, disabled Submit until canSubmit.
- [ ] Acknowledge click fires a single endpoint call, updates state optimistically, falls back on error.
- [ ] Status page delegates to `ScanProgressCard` for in-progress + `ScanResultsViewer` for terminal states without layout flicker.
- [ ] Re-upload flow: click → modal → file pick → upload → fresh scan → new revision visible in history panel.
- [ ] Revision history panel shows all prior revisions with mini thumbnails + rule counts.
- [ ] Submit success redirects to `/fabrication/submitted/[jobId]` with `fabrication_jobs.status` set correctly per `machine_profiles.requires_teacher_approval`.
- [ ] Prod smoke: all 4 scenarios (happy / soft-gate / hard-gate re-upload / multi-revision history) run through from Matt Burton student account.
- [ ] `npm test`: +N tests (target ~60–80 — rule-buckets, helpers, route tests).
- [ ] `docs/projects/WIRING.yaml` + dashboard + ALL-PROJECTS.md updated (saveme).
- [ ] Checkpoint 5.1 report doc filed.

---

## 5. Stop triggers (halt, report, wait for Matt)

1. **`fabrication_jobs.acknowledged_warnings` column not where the schema-registry says it is** — registry says column is on `fabrication_jobs` (migration 095:82). If the ALTER didn't actually land in prod, adding the submit/ack endpoints fails. Pre-flight audit for sub-phase 5-1 must verify with a prod SQL probe.
2. **`machine_profiles.requires_teacher_approval` defaults are all `false`** — if every seeded profile has it `false`, every submit goes straight to `approved` and skips the teacher queue. Fine for Phase 5 to still ship, but flag it: Phase 6 won't have anything to queue. Default should be `true` for laser cutters given the pyrolysis/fire risk — confirm or adjust seed.
3. **Scan results JSONB shape doesn't carry a `severity` field on each rule** — spec §5/§6 says it does, Phase 2A/2B implementations should match. If classify fails to find severity, buckets break. Verify by reading one real scan_results from prod (e.g. from the STL smoke scan).
4. **Re-upload race** — student hits "Re-upload" while the previous revision is still scanning. Two active revisions shouldn't both have pending scan_jobs via the unique-active-per-revision index, but the upload→enqueue sequence could beat it. Stop if the race manifests in tests.
5. **"Extend status endpoint with `?include=results`" feels gross** — if the endpoint bloats past ~100 lines or the query-string branching proliferates, fall back to a separate `/results` endpoint. Don't fight the design.
6. **Skills Library deep-links land on a real 404 in prod** — spec says "stub initially"; if clicking a link actually breaks (not even a placeholder page), stop and add a minimal placeholder. Don't ship dead links.

---

## 6. Don't stop for

- Pixel-perfect styling — ship Tailwind utility classes, iterate in Phase 9.
- Missing coordinate overlays on evidence text — text-only evidence is fine for v1.
- Loading spinner polish on the acknowledge click — optimistic updates are enough.
- Mobile layout on the results viewer — school Chromebooks are the target; mobile polish is Phase 9.
- The submit redirect UX — `/fabrication/submitted/[jobId]` can be 20 lines of JSX. Phase 6 decides what happens next.
- Accessibility audit of the radio groups — use semantic `<input type="radio">` with `<label>`, that's enough for Phase 5.
- Re-upload when the scanner takes a while — the existing polling hook handles mid-revision scan_status changes.

---

## 7. Out of scope (deferred)

| Item | Defer to |
|---|---|
| Teacher approval queue (`/teacher/fabrication`) | Phase 6 |
| Lab Tech / Fabricator pickup UI + token auth | Phase 7 |
| Machine profiles teacher-admin UI | Phase 8 |
| Analytics, failure heatmaps, rule-by-class rollups | Phase 9 |
| Evidence coordinate overlays (visual callouts on thumbnails) | Phase 9 (only if scan_results.evidence populates coords in practice) |
| Skills Library content population | Orthogonal workstream; Phase 5 stubs the links |
| Safety alert routing for weapon-shaped models | Phase 6 (wires to existing safety alert feed) |
| Celebration / gamification on pass | Explicit non-goal per spec §8 |
| Per-student rate-limit on re-uploads | `FU-SCANNER-RATE-LIMIT` P3 (Phase 4 deferral) |
| 200 MB upload cap | `FU-FAB-UPLOAD-200MB` P3 (Pro plan) |

---

## 8. Lessons to re-read (every sub-phase)

- **#3 Client components can't import server-only modules** — `createAdminClient` server-only. Results viewer is `"use client"` and must call API routes, not DB directly.
- **#4 Student auth uses token sessions, not Supabase Auth** — `/api/student/*` + `requireStudentAuth`.
- **#9 Student-facing components must use student auth routes** — already bit Phase 4; don't repeat.
- **#11 Vercel CDN strips Set-Cookie from Cache-Control:public** — every new route sets `private, no-cache, no-store, must-revalidate`. Submit endpoint especially.
- **#38 Verify = assert expected values, not just non-null** — canSubmit tests assert specific `ok/reason/missingAcks` shapes.
- **#39 For pattern bugs, audit all similar sites and fix in the same phase** — if acknowledge-warning persistence has a JSONB-column gotcha (cf. Lesson #53), fix every similar site.
- **#45 Surgical changes** — don't refactor Phase 4-2's status endpoint into something unrecognisable. Add `?include=results` as a clean additive option, don't restructure.
- **#52 REVOKE FROM PUBLIC, anon, authenticated** — Phase 5 doesn't add RPCs, but if one lands (e.g., for atomic submit transition), revoke all three.
- **#53 Denormalised columns need explicit writes; JSONB doesn't fan out** — the submit endpoint updates `fabrication_jobs.status` (a column) AND potentially related denormalised fields. Write explicitly.
- **Route group URL discipline** (PH4-FINDING-01) — `(student)` is a Next.js route group. New pages under it live at `/fabrication/...`, NOT `/student/fabrication/...`. Check every `router.push` and `Link href` before committing.
- **Test-file JSX import discipline** (Phase 4-3 finding) — no DOM-render test harness. Extract pure helpers to `.ts` siblings so tests don't import `.tsx` component files.
- **`vi.importActual` bracket-path trap** (Phase 4-2 finding) — tests under `[jobId]/` dirs can't use `vi.importActual`. Mock the full surface directly.

---

## 9. Execution note

- All commits on `preflight-active` branch in the `questerra-preflight` worktree. Push after each clean sub-phase.
- Main worktree (`questerra/`) is the merge baseline — don't touch from here.
- After 5-6 Checkpoint passes: saveme, update ALL-PROJECTS.md / CLAUDE.md / WIRING.yaml / dashboard.html, file the Checkpoint 5.1 report, then prompt Matt to merge preflight-active → main (or PR if he wants a review gate).
- Next phase on Matt's desk after 5.1 sign-off: **Phase 6 (Teacher Queue + Approval)**. Brief drafted on phase open.

---

## 10. Resolved decisions (22 Apr 2026 PM, pre-opening)

All 7 pre-build open questions answered before 5-1 opens. Defaults baked into the sub-phase files below.

1. **Status endpoint — `?include=results` query flag.** Extend the Phase 4-2 `GET /status` endpoint with an optional query parameter; when absent, behave as today (thin payload for 2 s polling); when present, include `scan_results` JSONB + `acknowledged_warnings`. One endpoint, additive, keeps the poll cadence cheap.
2. **Acknowledgement JSONB shape locked in:** `{ "revision_1": { "R-STL-03": { "choice": "intentional" | "will-fix-slicer" | "acknowledged", "timestamp": "2026-..." }, ... }, "revision_2": { ... } }`. Nested by revision-then-rule so teachers can audit per-revision choices without JSONB gymnastics. Revision key is `"revision_N"` (string with `revision_` prefix — easier to eyeball than bare integers).
3. **Should-fix radios: 3 options** — `intentional` ("I've checked — this is intentional"), `will-fix-slicer` ("I'll add supports in the slicer"), `acknowledged` ("Understood"). No free-text box in v1 — adds moderation surface area; revisit if pilot students ask.
4. **Submit redirect target: stub page `/fabrication/submitted/[jobId]`.** Cleaner state machine than overloading the results page with a post-submit banner mode. The submitted page is ~20 lines in v1 and becomes Phase 6's integration point (adds "waiting for [teacher name]" detail once the teacher queue exists).
5. **Re-upload UX: modal on the status page.** Faster for the student (no navigation), simpler for v1. A dedicated `/reupload` route can be added in Phase 6 if teacher dashboards need deep-link entry points.
6. **Machine-profile `requires_teacher_approval` seed flip:** laser cutters → `true`, 3D printers → `false`. Fits spec intent ("safety-sensitive tools require a human check"). **Not a Phase 5 code change — Phase 5 ships the endpoint that reads the column dynamically, so the code works regardless.** The seed update is a one-off SQL UPDATE in the Supabase dashboard before Matt's pilot, not a tracked migration (avoids migration creep mid-phase; can promote to migration 107 later if we want it in the audit trail). Query to run: `UPDATE machine_profiles SET requires_teacher_approval = true WHERE is_system_template = true AND machine_category = 'laser_cutter';`
7. **Skills Library URL shape: `/skills/fab-{ruleId}`** — e.g., `/skills/fab-R-STL-03`. Matches the existing `R-STL-NN` / `R-SVG-NN` namespace, collision-free, easy to map to a Skills Library slug column when the library populates.

No outstanding questions. 5-1 can open whenever.
