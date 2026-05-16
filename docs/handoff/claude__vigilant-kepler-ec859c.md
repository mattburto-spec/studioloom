# Handoff — claude/vigilant-kepler-ec859c

**Last session ended:** 2026-05-16T05:32:09Z
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/vigilant-kepler-ec859c`
**HEAD:** `34382954` "test+docs(handle_new_teacher): migration shape test + Lesson #92 + Lesson #65 amendment + FU filing"

## What just happened

- Closed Lesson #92 (raw_app_meta_data late-binding) and Lesson #65 redux in 5 commits on this branch. Two migrations + 22 tests + 2 doc updates + changelog entry.
- Trigger fix migration `20260516044909_fix_handle_new_teacher_check_user_metadata_bucket` applied to prod; smoke verified (provisioned test999, phantom_count stayed at 53). Tracker logged.
- Cleanup migration `20260516050159_cleanup_phantom_student_teacher_rows` applied to prod; 53 phantoms deleted; `/admin/teachers` now shows 3 real teachers. Tracker logged.
- Lesson #92 banked, Lesson #65 amended with audit-checklist step 4 ("verify the bucket you're reading IS populated at trigger time"), `FU-AUTH-TRIGGER-AUDIT-METADATA-BUCKETS` (P2) filed in security-plan tracking table.
- Branch was opened to start `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN` (filed in the morning saveme); audit complete but no code touched. The phantom-row issue pre-empted that work.

## State of working tree

- `git status`: clean except for 3 scanner-report timestamp refreshes (modified, not staged):
  - `docs/scanner-reports/feature-flags.json`
  - `docs/scanner-reports/rls-coverage.json`
  - `docs/scanner-reports/vendors.json`
- `git rev-list --count @{u}..HEAD` = 0 — everything pushed to `origin/claude/vigilant-kepler-ec859c`.
- Tests: **6464 passed / 11 skipped** (baseline was 6442 / 11 — exactly +22 from the new migration shape test, no regressions).
- Migration drift check: clean (`applied_migrations` has rows for both 16 May migrations; Matt verified the drift query returned 0 rows).

## Next steps

- [ ] **Open the PR** — title `fix(handle_new_teacher): close late-binding bucket bug + cleanup 53 phantom rows (Lesson #92)`. Body includes diagnosis Q1–Q5, fix shape, prod evidence, lesson references, FU filed. Squash-merge to main.
- [ ] **Stage the 3 scanner-report timestamp diffs** into a final saveme commit OR include them in the PR's last commit OR let them ride in the next saveme — Matt's call. Currently uncommitted to keep the PR diff focused.
- [ ] **Pick up `FU-SEC-TEACHER-LAYOUT-FAIL-OPEN`** in a fresh worktree (cleaner separation from this PR). The morning audit work is preserved in chat history; rerun the audit phase or jump straight to implementation since the layout census was already complete:
  - TeacherLayout fail-open: `src/app/teacher/layout.tsx:86-96` logs PGRST116 then renders teacher chrome with `teacher: null`.
  - SchoolLayout has the identical bug: `src/app/school/layout.tsx:58-71`.
  - AdminLayout is the gold-standard fail-closed reference: state machine `checking | admin | redirecting` at `src/app/admin/layout.tsx:97-119,146-161`.
  - Proposed fix: mirror AdminLayout's state-machine pattern in both Teacher and School layouts. Redirect missing-teacher-row to `/dashboard?wrong_role=1` (matches middleware Phase 6.3b convention).
- [ ] **Pick up `FU-AUTH-TRIGGER-AUDIT-METADATA-BUCKETS`** (P2) when slot opens — sweep every other AFTER INSERT trigger on `auth.users` via `SELECT * FROM information_schema.triggers WHERE event_object_table = 'users'`. Read each function body; flag any guard reading `raw_app_meta_data->>` for caller-supplied claims. Known good: `handle_new_user_profile` reads `raw_user_meta_data` (verified).

## Open questions / blockers

_None._ The PR is ready to open the moment Matt signs off on the changelog + scanner-report bundling decision.
