# Teaching Mode — "Check on these students" row · Phase 1 brief

**Date drafted:** 2026-05-12
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/dreamy-booth-73b3cc`
**Branch:** `claude/dreamy-booth-73b3cc` (1 commit behind `origin/main`, fast-forward)
**Estimated effort:** ~1 day (no migration, no new tables)
**Methodology:** [`docs/build-methodology.md`](../build-methodology.md)

---

## 1. Goal

During a live lesson, surface up to 3 students above the timer in Teaching Mode that the teacher should check in with. Replace the current single-signal "Needs Help" banner (which only flags stuck students) with a multi-signal, snoozable row.

**Audience:** Matt teaching G8 design class (27 students). Current pain: existing orange "in progress" status doesn't update fast enough or distinguish "stuck" from "behind" from "absent."

**Success criteria:**
- One glance at Teaching Mode reveals which students need attention (max 3 names)
- Each chip says *why* in one line (e.g. *"EJ — 3 responses, class is at 6"*)
- Snooze persists for the rest of the lesson (component state, resets on lesson change)
- No false positives for slow-but-thoughtful students that would erode teacher trust within a week

---

## 2. What this is NOT (Phase 2 deferred)

- **No per-activity timing** ("on inspiration-board for 18 min"). Requires new `activity_events` table.
- **No AI-suggested check-in questions.** Deterministic ranking only — Lesson #44 (simplicity first).
- **No response quality / length tie-breaker.** Pace_z uses raw response count.
- **No "logged in today" signal.** Post Access Model v2, `student_sessions` is dropped; we can only infer from autosave activity within last 5 min.
- **No new migration, no schema changes.** Everything derives from existing `student_progress` data.

---

## 3. Signals

Three deterministic signals, computed in the live-status route per 30s poll:

| Signal | Trigger | Computed in |
|---|---|---|
| **Stuck** | `isOnline && status === "in_progress" && timeSinceUpdate > 180s` | Already in `route.ts:147` as `needsHelp`. Reuse — no change. |
| **Falling behind** | `status === "in_progress" && paceZ < -1.0` | New — `computePaceSignals()` in `src/lib/teaching-mode/pace.ts`. |
| **Absent-ish** | `status === "not_started" && !isOnline` (during a lesson with ≥1 online student) | New flag derivable in route or component. |

**Priority if >3 students match:** Stuck > Falling behind > Absent-ish.

**Cohort-size guard:** If <5 students have `responseCount` data, `paceZ` is `null` (skip pace signal entirely). Protects small classes from spurious z-scores.

---

## 4. Implementation map (sub-phases)

### 4.1 — `src/lib/teaching-mode/pace.ts` (new module, pure logic)

Exports:
```ts
export interface PaceInput {
  studentId: string;
  responseCount: number;
}

export interface PaceResult {
  studentId: string;
  paceZ: number | null;  // null if cohort too small (n<5)
}

export interface CohortStats {
  n: number;
  median: number;
  mean: number;
  stddev: number;
}

export function computePaceSignals(
  inputs: PaceInput[],
  minCohortSize: number = 5,
): { results: PaceResult[]; stats: CohortStats };
```

**Pure function.** No I/O, no Supabase, no React. Lesson #71 — pure logic must live in `.ts`, not `.tsx`, to be testable in this repo's vitest config.

**Math:**
- `mean = sum / n`
- `stddev = sqrt(sum((x - mean)^2) / n)` (population stddev, not sample — we have the whole class)
- `paceZ = stddev === 0 ? 0 : (responseCount - mean) / stddev`
- If `n < minCohortSize`, return all `paceZ: null`.
- Median = sorted middle (for display in chip copy).

### 4.2 — Extend `src/app/api/teacher/teach/live-status/route.ts`

After the `studentStatuses` array is built (line ~195), add a single pass that:
1. Builds `PaceInput[]` for students with `status === "in_progress"` only.
2. Calls `computePaceSignals(inputs)`.
3. Decorates each `studentStatus` with `paceZ: number | null`.
4. Returns `cohortStats` in the summary (median + mean + stddev + n).

**No new DB queries.** Reuses `responseCount` already computed at line 143 (page mode) / 167 (unit mode). Page mode is what Teaching Mode polls; unit-mode path can also get the stats but it's lower priority — same code path either way.

**Response shape additions:**
```ts
type StudentStatus = {
  // ... existing fields ...
  paceZ: number | null;        // NEW — null if cohort too small or not in_progress
};

type LiveSummary = {
  // ... existing fields ...
  cohortStats: {               // NEW
    inProgressCount: number;
    medianResponses: number;
    meanResponses: number;
    stddevResponses: number;
  } | null;                    // null if no in-progress students
};
```

### 4.3 — `src/components/teach/CheckInRow.tsx` (new component)

**Props:**
```ts
interface CheckInRowProps {
  students: StudentLiveStatus[];   // existing type from page.tsx, extended with paceZ
  cohortStats: LiveSummary["cohortStats"];
  onlineCount: number;             // for absent-ish gating
  snoozed: Set<string>;            // studentIds the teacher has snoozed
  onSnooze: (studentId: string) => void;
}
```

**Behaviour:**
- Filter to ≤3 students using the signal priority (Stuck > Behind > Absent).
- Hide row entirely (return `null`) if 0 students surface or `onlineCount === 0` (no live lesson in progress).
- Each chip: avatar circle, name, one-line reason, × snooze button.
- Chip copy by signal:
  - Stuck: *"EJ — no activity for {mm}m"* (use `timeSince(lastActive)`)
  - Falling behind: *"EJ — {responseCount} responses, class is at {median}"* (round median to int)
  - Absent-ish: *"EJ — hasn't started this lesson"*

**Styling:** match existing card patterns in page.tsx — amber-ish for attention but softer than the current banner (the banner felt like an alarm; this should feel like a nudge). Use `rgba(245, 158, 11, 0.06)` background, `#FDE68A` border, `#92400E` text. Same family as existing amber but less saturated.

**File location:** `src/components/teach/CheckInRow.tsx` alongside existing `PhaseTimer.tsx`, `TeachingToolbar.tsx`.

### 4.4 — Wire into `src/app/teacher/teach/[unitId]/page.tsx`

1. Extend `StudentLiveStatus` interface (line 24–36) with `paceZ: number | null`.
2. Extend `LiveSummary` interface (line 38–46) with `cohortStats` field.
3. Add `const [snoozed, setSnoozed] = useState<Set<string>>(new Set())` to component state.
4. Add `useEffect(() => setSnoozed(new Set()), [selectedPageId])` — clear snoozes on lesson change.
5. Insert `<CheckInRow ... />` immediately above the `PhaseTimer` block (currently at line 541) inside the center column.
6. **Remove** the existing "Needs Help Alert" block at lines 567-582. The new row subsumes it.

### 4.5 — Tests

Unit tests for `src/lib/teaching-mode/pace.ts`:
- `__tests__/pace.test.ts` (alongside `pace.ts` per repo convention)
- Test cases (assert exact expected values per Lesson #38):
  - **Below cohort minimum (n=3):** all `paceZ` should be `null`, `stats.n === 3`.
  - **Five students with responseCounts `[1, 5, 5, 5, 9]`:** mean=5, stddev=2.53 (pop), z for `1` = -1.58, z for `9` = 1.58, z for `5` = 0. Assert each.
  - **All identical (stddev=0):** all `paceZ === 0` not `NaN`.
  - **Empty input:** `results: []`, `stats.n: 0, median: 0, mean: 0, stddev: 0`.
  - **Median odd vs even:** n=5 sorted `[1,2,3,4,5]` → median 3. n=4 sorted `[1,2,3,4]` → median 2.5.

Integration test for live-status route (extend existing if there is one, else create):
- Mock cohort of 6 students with varying response counts; assert response includes `paceZ` per student and `cohortStats` in summary.

**No CheckInRow render test** in Phase 1 — vitest config has no React plugin (Lesson #71). Visual smoke is Matt's Checkpoint 1B walkthrough.

### 4.6 — Registry hygiene (Step 5c — mandatory sub-phase)

1. **Add `teaching-mode` entry to `docs/projects/WIRING.yaml`** (closes Lesson #54 drift — currently referenced as a dep by another system but has no entry). Minimal entry:
   ```yaml
   - name: teaching-mode
     status: live
     version: v1
     description: Live cockpit for teachers running a class through a lesson — phase timer, student status grid, check-in row, projector mode.
     deps: [student-data, class-units, student-progress, unit-content-v4]
     affects: []  # read-only surface — observes student progress, doesn't write
     key_files:
       - src/app/teacher/teach/[unitId]/page.tsx
       - src/app/api/teacher/teach/live-status/route.ts
       - src/components/teach/PhaseTimer.tsx
       - src/components/teach/CheckInRow.tsx
       - src/lib/teaching-mode/pace.ts
     data_fields:
       reads: [student_progress.status, student_progress.responses, student_progress.time_spent, student_progress.updated_at, class_students.student_id, students.display_name]
       writes: []
   ```
2. **Rerun `python3 scripts/registry/scan-api-routes.py --apply`** — the live-status route's response shape changed but path/method haven't, so the api-registry entry should be no-op or tiny.
3. `npm run sync-wiring` if such a script exists for the dashboard companion (`wiring-dashboard.html`); otherwise hand-update the `SYSTEMS` array.

---

## 5. Registry cross-check findings (Step 5c)

| Registry | Path | Status | Action |
|---|---|---|---|
| `docs/projects/WIRING.yaml` | `teaching-mode` system entry | **MISSING** — referenced as dep on line 1185 but no entry exists. Lesson #54 drift. | **Closes in Phase 1** (sub-phase 4.6). |
| `docs/schema-registry.yaml` | `student_progress` at line 8980 | Exists. No schema change in Phase 1. | No-op. |
| `docs/api-registry.yaml` | `/api/teacher/teach/live-status` at line 4513 | Exists. Response shape changes (adds `paceZ`, `cohortStats`) but path/method unchanged. | Rerun scanner; commit any auto-diff. |
| `docs/ai-call-sites.yaml` | N/A | No AI call in Phase 1 — deterministic ranking. | No-op. |
| `docs/feature-flags.yaml` | N/A | No flag for Teaching Mode currently. Phase 1 doesn't add one (ships unconditionally, but rollback = revert PR). | No-op. |
| `docs/vendors.yaml` | N/A | No new vendor. | No-op. |
| `docs/data-classification-taxonomy.md` | N/A | `responseCount` and `paceZ` are derived metrics, not new PII. | No-op. |
| `docs/scanner-reports/rls-coverage.json` | `student_progress` RLS | Existing RLS unchanged. Phase 1 adds no new writers/readers from RLS-controlled paths. | No-op. |

**Spot-check (Step 5c instruction):**
- ✅ `src/app/api/teacher/teach/live-status/route.ts` exists and contains the logic the brief assumes (verified lines 136-194).
- ✅ `src/app/teacher/teach/[unitId]/page.tsx` has the `PhaseTimer` block at line 541 (verified).
- ⚠️ `src/lib/teaching-mode/` directory does not yet exist — Phase 1 creates it. Not drift; flagging so brief reader knows the new path.

---

## 6. Wiring map (Step 5b — choke points)

**Upstream (writers that feed the data Teaching Mode reads):**
- Student response autosave: `src/app/api/student/progress/route.ts` (POST) — every autosave updates `student_progress.responses` + `updated_at`. **Phase 1 does NOT modify this.** It's the existing data source.

**Downstream (consumers of live-status response):**
- ONLY `src/app/teacher/teach/[unitId]/page.tsx` (line 211 fetches `/api/teacher/teach/live-status`).
- No other consumer found via grep. Single choke point — clean wiring.

**Sibling endpoints that might need parallel updates:** none. The live-status route is the only teacher-facing realtime endpoint that returns per-student progress; nothing else needs the `paceZ` shape.

---

## 7. Scope boundary (Lesson #45 — surgical changes)

**In scope for Phase 1:**
- New file `src/lib/teaching-mode/pace.ts` + its `__tests__/pace.test.ts`
- New file `src/components/teach/CheckInRow.tsx`
- Modify `src/app/api/teacher/teach/live-status/route.ts` (add `paceZ`, `cohortStats` to response; no DB query changes)
- Modify `src/app/teacher/teach/[unitId]/page.tsx` (extend types, add state, insert component, **remove old needs-help banner**)
- Update `docs/projects/WIRING.yaml` (add teaching-mode entry)
- Rerun api-registry scanner

**Explicitly NOT touched:**
- `src/app/api/student/progress/route.ts` (writer)
- Any other API route
- Any migration
- `STATUS_CONFIG`, `PHASE_COLORS`, sort buttons, KPI tiles
- The Need-Help KPI tile (line 591 in page.tsx) — keeps showing a count
- Existing styling on the timer, header, sidebar, student grid
- Projector mode

**No speculative abstractions** (Lesson #44):
- Don't generalize `computePaceSignals` to take "any metric column" — it's response counts.
- Don't generalize CheckInRow to "any signal row" — it's the three signals we shipped.
- Don't add a feature flag — rollback = revert PR.

---

## 8. Matt Checkpoints

### Checkpoint 1A — after live-status extension (before any UI work)

**Gate:**
- `pace.ts` + unit tests committed
- Live-status route returns the new shape (verified by integration test)
- `npm test` shows baseline + new tests, all passing
- `tsc --noEmit` clean

**Report content:**
- Test count delta (expected +6 to +10 tests)
- A sample JSON response from the route (curl against local dev OR a unit-test snapshot of the route handler's return value)
- Confirmation that no DB queries were added

**Matt signs off → proceed to UI work.**

### Checkpoint 1B — full Phase 1 done (smoke gate)

**Gate:**
- CheckInRow component live above timer
- Old needs-help banner removed
- Snooze works (test by clicking ×, verifying chip disappears, polling for 30s, confirming it doesn't re-appear until lesson change)
- Empty state hides row entirely
- WIRING.yaml updated, scanners rerun
- `npm test`, `tsc --noEmit` clean

**Smoke:** Matt walks through Teaching Mode for his G8 class (27 students, currently 0% complete on Choice lesson). Expected behaviour:
- Most students show `in_progress` with 7-8 responses → row likely empty (cohort is tight, no clear outliers)
- If CC (7 responses while peers have 8) shows up as "falling behind" — false positive (1 response gap, paceZ probably ~-0.5, won't trigger -1.0 threshold). Should NOT appear. If it does, threshold is too sensitive.
- If EZ2 or HH (not_started) show up as "absent-ish" — correct, they're not online.
- Snooze a chip → verify it stays gone for the rest of the lesson.

**Lesson #70 — smoke against deployed UI:** push the feature branch to origin (NOT main) → Vercel preview builds → Matt smokes against the preview URL. If pass, merge to main.

**Matt signs off → Phase 1 complete.**

---

## 9. Stop triggers

Stop and report before continuing if any of these surface:

1. **Baseline test count differs from 5631** (worktree drift since this brief was drafted).
2. **Live-status route already has a `paceZ` field** (someone else built this in parallel).
3. **Existing test for live-status route exists** (audit said none — verify with `find . -name "live-status*test*"`). If yes, extend it rather than create new.
4. **`src/lib/teaching-mode/` already exists** with conflicting content.
5. **CheckInRow's chip filter logic gives >3 students** after applying priority + snooze — should be impossible by construction, but assert in render.
6. **paceZ math returns NaN** anywhere in tests (Lesson #38 — verify expected values, not "is a number").

## 10. Don't stop for

- Style nitpicks on the existing page.tsx — surgical changes only (Lesson #45).
- Refactoring page.tsx's 1045 lines — out of scope.
- Adding a feature flag — explicitly skipped per simplicity (Lesson #44).
- The follow-up tracker question — if Phase 2 happens, create `docs/projects/teaching-mode-followups.md` then.

---

## 11. Follow-ups identified (file at Checkpoint 1B if confirmed)

- **FU-TEACH-PACE-PER-ACTIVITY** (P2) — Phase 2: per-activity timing requires new `activity_events` table. Unlocks "EJ on inspiration-board for 18m" specificity.
- **FU-TEACH-CHECKIN-AI-COPY** (P3) — Phase 2: AI-generated check-in question per surfaced student (Haiku call, reads last 2-3 responses).
- **FU-TEACH-RESPONSE-QUALITY** (P3) — Phase 2: response length / on-topic-ness as tie-breaker for thoughtful-slow vs disengaged-slow.
- **FU-TEACH-SNOOZE-PERSIST** (P3) — if Matt finds himself re-snoozing the same students across lessons, persist snoozes to a `teacher_check_in_snoozes` table.

---

## 12. References

- Audit: this conversation, parent agent (12 May 2026)
- Lesson #38 — `docs/lessons-learned.md:?` — verify expected values, not just non-null
- Lesson #40 — `docs/lessons-learned.md:182` — pre-flight audits catch brief slips
- Lesson #41 — `docs/lessons-learned.md:205` — NC reverts on uncommitted files
- Lesson #43-46 — `docs/lessons-learned.md:236-313` — Karpathy discipline
- Lesson #54 — `docs/lessons-learned.md:481` — WIRING.yaml drift
- Lesson #70 — `docs/lessons-learned.md:953` — preview branch smoke for UI
- Lesson #71 — `docs/lessons-learned.md:967` — pure logic in .tsx isn't testable
- Build methodology — `docs/build-methodology.md`
- Existing live-status route — `src/app/api/teacher/teach/live-status/route.ts`
- Existing Teaching Mode page — `src/app/teacher/teach/[unitId]/page.tsx`
- Timeline model — `src/lib/timeline.ts`
