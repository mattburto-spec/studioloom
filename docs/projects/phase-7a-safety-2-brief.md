# Phase 7A-Safety-2 Brief — FU-N NULL class_id Dual-Visibility Fix

> **Goal:** Close the silent safety hole where moderation events logged with `class_id = NULL` are invisible to every teacher. Implement Option C (dual-visibility via student_id path) from the FU-N writeup — not Option A. Upstream NULL-class_id writers (Discovery Engine, Open Studio planning, library uploads, standalone tool sessions, Kit conversations) stay as-is; the RLS policy learns to route through student_id when class_id is NULL.
> **Context:** `student_content_moderation_log` (migration 073) has `class_id UUID REFERENCES classes(id)` (nullable) and a SELECT policy that uses `class_id IN (teacher's classes)` — NULL silently fails. Lesson #29 is the canonical precedent (migration 059 fixed the same class of bug on `student_progress` with a UNION policy).
> **Estimated effort:** 1–2 days
> **Checkpoint:** 7A-Safety-2 Checkpoint — dual-visibility policy applied, 5 real upstream contexts each produce a NULL-class_id row that the correct teacher sees, cross-teacher negative test denies access.

---

## Pre-flight checklist (Code: do these FIRST, report before writing ANY code)

1. `git status` — clean, on `main`, HEAD after Phase 7A-Safety-1's commits.
2. `npm test` — capture baseline from post-7A-Safety-1 state.
3. Read `supabase/migrations/073_content_safety.sql` lines 42–119 — confirm current policy shape.
4. Read `supabase/migrations/059_*.sql` (the RLS-UNION fix from Lesson #29) — copy its pattern exactly, don't invent a new shape.
5. Locate every writer to `student_content_moderation_log`:
   - Grep: `rg "student_content_moderation_log|moderate-and-log|moderateAndLog" src/`
   - Enumerate each writer and capture: does it always have `class_id`? Does it always have `student_id`? What table routes through `moderate-and-log.ts`?
6. Confirm `students` table schema — what does "student belongs to teacher" mean? Two paths exist per Lesson #29:
   - Legacy: `students.class_id → classes.teacher_id`
   - Junction: `class_students(student_id, class_id) → classes.teacher_id`
   - **Both paths must be in the policy** (Lesson #29 rule).
7. Check test fixture patterns — where do existing RLS policy tests live? (`src/**/*rls*.test.ts` or `supabase/tests/`). We'll be writing 6 tests: 5 upstream contexts × teacher sees + 1 cross-teacher negative.
8. Dry-run the new policy SQL locally against the test DB — syntax check before committing.
9. **STOP AND REPORT** all findings before writing any migration SQL.

---

## Lessons to re-read before coding

- **#29** — RLS-NULL silent filter pattern + UNION rewrite shape. **This is the pattern to clone.**
- **#38** — Verify = assert expected values. Our RLS tests must insert a specific row and assert the specific teacher sees it, not "some teacher sees something."
- **#39** — Pattern bugs: audit all similar sites. After fixing `student_content_moderation_log`, check if `content_moderation_log` (teacher-side, migration 067) has the same NULL-class_id gap. If yes, file a follow-up — don't fix it this phase (scope creep).
- **#43, #44, #45** — think, simplicity, surgical.

---

## Sub-tasks

### 7A-S2-1 — Migration 078: dual-visibility policy
- Create `supabase/migrations/078_moderation_log_dual_visibility.sql`.
- Drop existing `student_moderation_log_teacher_select` policy.
- Recreate it with UNION semantics (follow Lesson #29 pattern exactly):
  ```sql
  CREATE POLICY student_moderation_log_teacher_select
    ON student_content_moderation_log
    FOR SELECT
    USING (
      -- Path 1: class_id set, teacher owns the class
      class_id IN (
        SELECT id FROM classes WHERE teacher_id = auth.uid()
      )
      OR
      -- Path 2: class_id NULL, student belongs to one of teacher's classes
      (class_id IS NULL AND student_id IN (
        -- Junction path
        SELECT cs.student_id
        FROM class_students cs
        JOIN classes c ON cs.class_id = c.id
        WHERE c.teacher_id = auth.uid()
        UNION
        -- Legacy direct path
        SELECT s.id
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE c.teacher_id = auth.uid()
      ))
    );
  ```
- Mirror the same dual-visibility onto the UPDATE policy (teachers who can see a NULL-class row should be able to review it).
- Add a migration comment: "FU-N Option C — dual-visibility via student_id when class_id is NULL. Lesson #29 UNION pattern. FU-N-followup: replace with admin queue (Option B) when FU-O roles ship."

### 7A-S2-2 — RLS integration tests (6 tests)
- File: `src/lib/content-safety/__tests__/moderation-log-rls.test.ts` (or `supabase/tests/moderation-log-rls.test.ts`, whichever matches existing convention).
- Fixtures: 2 teachers (T1, T2), 1 student S1 enrolled in T1's class C1 (via `class_students` junction), 1 student S2 enrolled in T2's class C2 (via legacy `students.class_id`).
- Tests:
  1. **Discovery Engine context** — insert row `(class_id=NULL, student_id=S1, source='tool_session')`. Query as T1 → expect 1 row. Query as T2 → expect 0 rows.
  2. **Open Studio planning** — insert row `(class_id=NULL, student_id=S1, source='quest_evidence')`. T1 sees, T2 doesn't.
  3. **Library upload (pre-enrollment)** — insert row `(class_id=NULL, student_id=S2, source='upload_image')`. T2 sees (legacy path), T1 doesn't.
  4. **Standalone tool session** — insert row `(class_id=NULL, student_id=S1, source='tool_session')`. T1 sees.
  5. **Kit conversation** — insert row `(class_id=NULL, student_id=S1, source='portfolio')`. T1 sees.
  6. **Cross-teacher negative** — insert row `(class_id=NULL, student_id=S1, source='gallery_post')`. Assert T2 returns 0 rows. **Critical test** — proves the policy isn't over-permissive.
- Each test uses per-teacher tokens (not service-role) so RLS actually runs.

### 7A-S2-3 — Writer audit (don't change writers, just document)
- Grep for every `insertModerationLog` / `moderate-and-log` / direct `.from('student_content_moderation_log').insert(...)` call.
- For each call site, document in a comment OR in `docs/specs/moderation-log-writer-audit.md` whether class_id is set or intentionally NULL. Categories:
  - Always has class_id → unchanged by this phase.
  - Sometimes NULL by design (Discovery, Open Studio pre-enrollment, library upload) → OK, dual-visibility catches it.
  - Sometimes NULL by bug → file a follow-up.
- **Do not change any writer code this phase.** The whole point of Option C is we don't force writers to invent a class_id.

### 7A-S2-4 — Close FU-N + file FU-N-followup
- `docs/projects/dimensions3-followups.md`:
  - Mark FU-N as ✅ RESOLVED via Option C + migration 078.
  - Add FU-N-followup (P2): "Migrate moderation log visibility to Option B (admin queue) when FU-O roles system lands. Removes student_id cross-join from hot path; adds explicit safety_lead role for NULL-class events."
- `CLAUDE.md` — remove FU-N from "🚨 P1 — live safety hole" Known follow-ups. Add FU-N-followup with P2 priority.
- `docs/projects/ALL-PROJECTS.md` — update if FU-N appears as an active row.

### 7A-S2-5 — Audit peer table: `content_moderation_log` (migration 067)
- Check if `content_moderation_log` (teacher-side moderation, not student-side) has the same NULL-class_id silent-filter pattern.
- If yes: **do not fix this phase.** File as FU-N-peer (P1 if the table has real NULL rows in prod, P2 otherwise). Lesson #39 applies but we're deliberately scoping this phase tight.
- If no (e.g., class_id is NOT NULL on content_moderation_log): document the asymmetry in a comment on the migration.

### 7A-S2-6 — Schema-registry + WIRING update
- Update `docs/schema-registry.yaml` entry for `student_content_moderation_log`:
  - `rls.read`: update to reflect new dual-visibility policy.
  - Add `spec_drift` entry dated 2026-04-14 / 15: "FU-N Option C applied via migration 078 — Lesson #29 UNION pattern."
- Bump WIRING `content-safety` or equivalent system note.

---

## Success criteria (assert each, with exact values)

- [ ] Migration 078 applied locally and to prod. `\d student_content_moderation_log` shows updated policy.
- [ ] All 6 RLS tests pass. Test 6 (cross-teacher negative) returns exactly 0 rows.
- [ ] `npm test` at 1156+ (baseline + 6 new tests), no regressions.
- [ ] Manual smoke: insert a real NULL-class_id row via a Discovery Engine test flow, confirm it surfaces at `/teacher/safety/alerts` for the student's teacher.
- [ ] `CLAUDE.md` Known follow-ups no longer shows FU-N as P1.
- [ ] FU-N-followup filed with P2 priority and clear linkage to FU-O.
- [ ] Writer audit document exists OR writer comments annotated — team knows which writers intentionally NULL.

---

## Stop triggers (halt and report)

- Pre-flight finds a junction table shape we didn't expect (e.g., students→schools→classes) — the UNION clauses need to change, STOP.
- Lesson #29's migration 059 uses a different UNION shape than what's drafted here — adopt the existing shape, don't invent a new one.
- Cross-teacher negative test (Test 6) fails even once — we've built an over-permissive policy, halt and redesign.
- Any writer is found to be *always* NULL by bug (not design) — that's a separate bug, file + STOP.
- `content_moderation_log` (migration 067) turns out to have real NULL-class_id rows in prod — that's an active P1 leak we didn't scope; escalate to Matt.

## Don't stop for

- Writers you think could be refactored to always populate class_id — that's the whole point of Option C, we're not forcing it.
- FU-O roles system not existing — we're deliberately deferring the proper admin-queue fix.
- Cosmetic cleanup in surrounding migration files.

---

## Checkpoint 7A-Safety-2

After 7A-S2-1 through 7A-S2-6, STOP AND REPORT:
- Pre-flight findings (verbatim).
- Migration 078 SQL (inline).
- Test results (6 new tests, all pass, exact outputs).
- Writer audit output (list of call sites + category).
- Prod-apply status + post-apply verification.
- Peer-table audit result (FU-N-peer filed? not filed?).
- Files modified (git diff --stat).
- Commits (separate, min 4: migration+tests, writer audit, schema-registry+followups, WIRING+CLAUDE.md).
- Working tree clean.

Wait for explicit sign-off before closing Path B.
