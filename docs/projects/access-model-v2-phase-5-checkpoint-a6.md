# Checkpoint A6 — Phase 5 (Privacy & Compliance) Close

**Status:** READY FOR MATT — code-side deliverables shipped; awaiting manual smoke + 1 prod migration apply + 2 manual verification fire drills.
**Phase:** Access Model v2 Phase 5 (sub-phases 5.0 → 5.8)
**Predecessor:** Checkpoint A5b (PASS — Phase 4 part 2 close, 3 May 2026 AM)
**Successor:** Phase 6 (Cutover & Cleanup) → Checkpoint A7 PILOT-READY
**Branch:** `access-model-v2-phase-5` (10 commits ahead of `main` at `v0.4-phase-4-closed`)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Drafted:** 4 May 2026

---

## 1. Sub-phases shipped

| Sub-phase | Status | Migration | Apply | Smoke | Commit |
|---|---|---|---|---|---|
| 5.0 Pre-flight + scaffolds + runbook skeleton | ✅ | 0 | n/a | n/a | `aec4477` |
| 5.1 logAuditEvent wrapper (3-mode) + 12 retrofits | ✅ | 0 | n/a | unit | `a5ac059` |
| 5.1d audit-coverage CI gate (visibility-only) | ✅ | 0 | n/a | unit | `31d2617` |
| 5.2 AI budget cascade + atomic SQL helper | ✅ | 1 | **applied** | unit | `23a200a` |
| 5.3 withAIBudget middleware + 3 student routes wired | ✅ | 0 | n/a | unit | `4f69120` |
| 5.3d budget-coverage CI gate (gating from day one) | ✅ | 0 | n/a | unit | `a59aa06` |
| 5.4 export + delete endpoints + scheduled_deletions table | ✅ | 1 | **PENDING** | unit | `3bcd1bc` |
| 5.5 retention cron + scheduled-hard-delete cron | ✅ | 0 | n/a | unit | `775fce8` |
| 5.6 GET teacher audit-log view | ✅ | 0 | n/a | unit | `4997d20` |
| 5.7 cost-alert + Sentry PII scrub runbooks | ✅ | 0 | n/a | n/a (Matt) | `3ffdbac` |
| 5.8 registry sync + close-out (this commit) | ✅ | 0 | n/a | n/a | TBD |

**Total: 11 commits + 2 migrations (1 applied, 1 pending) + 4 FUs filed.**

---

## 2. Code-level criteria

### NEW tables
- [x] `scheduled_deletions` — Phase 5.4 (8 cols + 3 indexes + 2 SELECT RLS policies)

### NEW SECURITY DEFINER helpers
- [x] `atomic_increment_ai_budget(UUID, INTEGER)` — Phase 5.2 (locked search_path, REVOKE PUBLIC + GRANT service_role per Lessons #66 + #52, sanity DO-block at apply time per Lesson #38)

### NEW TS modules
- [x] `src/lib/access-v2/audit-log.ts` — wrapper (3-mode failure)
- [x] `src/lib/access-v2/ai-budget/tier-defaults.ts` — code constants + admin_settings runtime override
- [x] `src/lib/access-v2/ai-budget/cascade-resolver.ts` — 5-layer cascade
- [x] `src/lib/access-v2/ai-budget/middleware.ts` — withAIBudget wrapper
- [x] `src/lib/access-v2/data-subject/export-student.ts` — 12-section manifest + 10MB cap
- [x] `src/lib/access-v2/data-subject/delete-student.ts` — soft-delete + queue 30-day hard-delete
- [x] `src/lib/jobs/retention-enforcement.ts` — manifest-driven retention sweep (Q7 sanity)
- [x] `src/lib/jobs/scheduled-hard-delete-cron.ts` — Q5 queue processor

### NEW routes (3)
- [x] `GET /api/v1/student/[id]/export` — full JSON dump (5.4)
- [x] `DELETE /api/v1/student/[id]?confirm=true` — soft-delete + queue (5.4)
- [x] `GET /api/v1/teacher/students/[id]/audit-log` — paginated audit feed (5.6)

### Retrofitted callsites (12)
- [x] 5 × `school-merge.ts` cascade events (`'throw'`)
- [x] 1 × `student-classcode-login` (`'soft-warn'` — preserves auth flow)
- [x] 1 × `impersonate` (`'soft-sentry'`)
- [x] 1 × `invitations.ts acceptInvitation` (`'soft-sentry'`)
- [x] 1 × `invitations/revoke` (`'soft-sentry'`)
- [x] 1 × `request-school-access` (`'soft-sentry'`)
- [x] 2 × `unit-use-requests.ts` (`'soft-sentry'` — Lesson #60 catch)

### Extended scanner (`scan-api-routes.py`)
- [x] `--check-audit-coverage` mode + `audit-coverage.json` (visibility-only, 228 missing tracked)
- [x] `--check-budget-coverage` mode + `ai-budget-coverage.json` (gating from day one, 3/3 covered)
- [x] Both wired into `nightly.yml`

### Manual runbooks
- [x] `docs/security/cost-alert-fire-drill.md` (audit F24 — Matt's drill)
- [x] `docs/security/sentry-pii-scrub-procedure.md` (audit F25 — Matt's drill)
- [x] `docs/security/student-data-export-runbook.md` (audit F32 — manual SQL stopgap, fleshed out from §5.0 skeleton)

---

## 3. Test count

| Sub-phase | New tests | Cumulative |
|---|---|---|
| Baseline (start of Phase 5) | — | 3291 |
| 5.1 audit-log wrapper + retrofit catalog | +27 | 3318 |
| 5.1d audit-coverage scanner | +6 | 3324 |
| 5.2 atomic-increment migration + cascade + tier-defaults | +49 | 3373 |
| 5.3 withAIBudget middleware + retrofit catalog | +18 | 3391 |
| 5.3d budget-coverage scanner | +6 | 3397 |
| 5.4 scheduled_deletions migration + export + delete + routes | +58 | 3455 |
| 5.5 retention + scheduled-hard-delete crons | +22 | 3477 |
| 5.6 teacher audit-log route catalog | +9 | 3486 |
| 5.7 (no tests — manual runbooks) | +0 | 3486 |
| 5.8 (no tests — registry sync) | +0 | 3486 |
| **Total** | **+195** | **~3486** (3486 passing / 11 skipped) |

tsc strict: 0 errors throughout. No regressions.

---

## 4. Migrations applied to prod

| Timestamp | Description | Applied | Smoke |
|---|---|---|---|
| 20260503012514 | phase_5_2_atomic_ai_budget_increment | ✓ | unit-test only — needs live cron exercise post-merge |
| 20260503143034 | phase_5_4_scheduled_deletions | **PENDING** | needed before /api/v1/student/[id] DELETE goes live |

Pre-merge: `bash scripts/migrations/verify-no-collision.sh` runs clean.

---

## 5. Decisions made during Phase 5 execution

| Decision | Rationale |
|---|---|
| **Q3 + Q6 collapsed (no manual tool-sessions audit)** | The §5.3d budget-coverage scanner finds missing wraps automatically; no need for a manual enumeration sub-phase. Saved ~30 min. |
| **`scheduled_deletions` table (UPGRADED from query-based)** | Two consumers from day one (5.4 endpoint + 5.5 retention cron) + future legal-hold path makes the table justified now (10 lines of SQL). Pure-query approach would force a future migration when first GDPR/PIPL hold lands. |
| **3-mode audit failure semantics** | 'throw' (default) for mutations; 'soft-warn' for auth-flow only; **'soft-sentry' (NEW) for non-auth retrofits where action shouldn't break BUT silent gaps are unacceptable.** Filed Sentry exception so admins see the gap even when the action continues. |
| **`can.ts` TODO redesigned as no-emit** | Per-permission-check audit would explode the audit_events table. Audit emits at the MUTATION ROUTE (enforced by §5.1d gate), not at the permission-check layer. |
| **Brief drift caught + folded inline** | Brief named 9 retrofit sites for §5.1; grep found 12 (Phase 4.6's `unit-use-requests.ts` × 2). Per Lesson #60 + don't-stop-for, folded into same commit. |
| **`safety/check-requirements` dropped from §5.3** | Brief named it as wired target; reality is GET-only with no AI call. Catalog test asserts the absence (defensive). |
| **§5.8 registry hygiene scope** | Bumped api-registry gate threshold 400 → 600 (legitimate Phase 5 expansion). Skipped feature-flags.yaml updates for `ai.budget.tier_default.*` keys — those are admin_settings (DB-resident), not env vars. |

---

## 6. Open follow-ups (filed during Phase 5)

| FU | Priority | Description |
|---|---|---|
| FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP | P2 | 228 mutation routes inherited from Phase 4 still need audit triage. Phase 6 cutover natural seam (touches every route file for /api/v1/* rename). |
| FU-AV2-AI-BUDGET-EXHAUSTED-EMAIL | P3 | Real Resend email send on over_cap (currently audit_events row is the only surface). Build when pilot data shows it's needed. |
| FU-AV2-AI-BUDGET-WIRE-TOOL-SESSIONS-AND-OTHER-AI | P2 | Other student AI routes that may need wrapping (tool-sessions proxies, Open Studio mentor variants). Scanner-led completeness. |
| FU-AV2-CRON-SCHEDULER-WIRE | P2 | Schedule retention + scheduled-hard-delete + cost-alert crons via dedicated GH Actions workflow. **Pre-pilot blocker** because the first DSR delete via the §5.4 endpoint queues a row that needs the cron to actually delete. |
| FU-AV2-AUDIT-EVENT-GROUPING (Q4 deferral) | P2 | `audit_events.parent_event_id` column for cascade-event grouping. Add when 2nd multi-row pattern lands. |
| FU-AV2-RETENTION-ACTIVE-STUDENT (Q7 deferral) | P2 | Active-student exemption for short-retention columns. Revisit when first complaint or short-horizon column lands. |
| FU-AV2-EXPORT-COMPLETE-COVERAGE | P2 | Auto-derive export-student.ts manifest from data-classification-taxonomy.md + cover the 19 v1 deferral tables. |

**Total: 7 new FUs filed during Phase 5.** None are A6 blockers (all targeted at Phase 6 or pre-pilot parallel track).

---

## 7. Lessons applied + lessons surfaced

### Applied this phase
- **Lesson #38** (assert specific values, not non-null) — catalog tests grep specific action strings + failure modes; sanity DO-blocks assert column shape; NCs verified the assertions actually catch mutations.
- **Lesson #39** (silent max_tokens truncation drops required fields) — withAIBudget middleware DOES NOT bill on `stop_reason: 'max_tokens'`; tested explicitly.
- **Lesson #41** (NC reverts on uncommitted files use Edit, not git checkout) — applied 3 times across §5.1 / §5.2 / §5.4.
- **Lesson #43** (think before coding — surface assumptions) — Q1–Q7 resolved BEFORE any code; brief amended with 7 explicit decisions.
- **Lesson #44** (simplicity first — no speculative abstractions) — withAIBudget is a single function, not a class; no event-bus over audit-log; no abstraction over the SQL helper.
- **Lesson #45** (surgical changes — touch only what each sub-task names) — 5.1 retrofitted only the 12 sites; 5.3 wired only the 3 routes; per-route triage of 228 audit-missing routes deferred to Phase 6.
- **Lesson #54** (registries can lie — audit by grep) — caught design-assistant's helper-detection requirement in §5.3d (initial scan returned 2 covered; added AI_BEARING_HELPER_RE to capture proxy pattern → 3/3).
- **Lesson #59** (brief estimates lie when audit hasn't happened) — original 3-day estimate revised to 4–4.5d after Q-decisions; actual ~150 min of focused work.
- **Lesson #60** (side-findings belong in the same commit) — caught 2 missing unit-use-requests.ts retrofits during §5.1 grep; folded in.
- **Lesson #61** (no non-IMMUTABLE in index predicates) — scheduled_deletions partial indexes use `WHERE status='pending'` not `WHERE scheduled_for < now()`.
- **Lesson #64** (cross-table RLS subqueries silently recurse) — atomic_increment_ai_budget is SECURITY DEFINER; no inline RLS subquery.
- **Lesson #66** (SECURITY DEFINER + locked search_path) — atomic_increment_ai_budget has `SET search_path = public, pg_temp` AND sanity DO-block asserts proconfig contains the lockdown.

### NCs that improved tests
- **§5.2** — initial regex `/SET search_path = public, pg_temp/` matched a comment-line mention. NC mutation revealed it; strengthened to `/SECURITY DEFINER\s*\n\s*SET search_path = public, pg_temp/` requiring lockdown immediately after SECURITY DEFINER.
- **§5.4** — initial route catalog test referenced `logAuditEvent` in an audit-skip comment; scanner classified the file as covered instead of skipped. Rephrased the comment.

---

## 8. A6 sign-off criteria

Phase 5 closes when ALL pass:

### Code (✅ done)
- [x] All 11 commits shipped to feature branch
- [x] tsc strict 0 errors
- [x] 3486 tests passing, 11 skipped, 0 regressions
- [x] All NEW tables have RLS + policies (verified by `scan-rls-coverage.py` — drift count unchanged at 5 pre-existing FU-FF entries)
- [x] Both coverage scanners passing in nightly.yml (audit visibility-only; budget gating from day one)

### Migrations
- [x] `phase_5_2_atomic_ai_budget_increment` applied to prod (3 May)
- [ ] `phase_5_4_scheduled_deletions` applied to prod — **PENDING Matt**
- [x] `verify-no-collision.sh` clean against `origin/main`

### Documentation (✅ done)
- [x] This A6 doc finalised
- [x] `docs/changelog.md` session entry written
- [x] WIRING.yaml updated (3 new systems: audit-log, ai-budget, data-subject-rights)
- [x] schema-registry.yaml updated (scheduled_deletions entry)
- [x] `docs/projects/access-model-v2-followups.md` updated with 4 new FUs

### Manual smoke (PENDING Matt)
- [ ] `phase_5_4_scheduled_deletions` migration applied to prod
- [ ] `GET /api/v1/student/<test-student-id>/export` returns valid JSON with 12 sections
- [ ] `DELETE /api/v1/student/<test-student-id>?confirm=true` returns 200 + `students.deleted_at` set + `scheduled_deletions` row created with `status='pending'`
- [ ] `GET /api/v1/teacher/students/<test-student-id>/audit-log` returns the 2 events from previous steps
- [ ] AI budget cascade live: trigger word-lookup with `students.daily_token_cap_override = 1000` → confirm 429 returned with `{ error: 'budget_exceeded', cap: 1000, ... }`
- [ ] Cost-alert fire drill per `docs/security/cost-alert-fire-drill.md` (Resend delivers within 5 min)
- [ ] Sentry PII scrub verification per `docs/security/sentry-pii-scrub-procedure.md` (screenshot saved)

### Operational (after manual smoke passes)
- [ ] Active-sessions row updated for Phase 6
- [ ] Merge `access-model-v2-phase-5` → `main` via fast-forward in throwaway worktree
- [ ] Tag merge commit `v0.5-phase-5-closed`
- [ ] Vercel prod redeploys + smoke `/api/v1/student/<id>/export` against the deployed branch

---

## 9. Merge-to-main plan

When all "PENDING" items above resolve:

1. Final tsc + npm test + scanner pass.
2. `bash scripts/migrations/verify-no-collision.sh`.
3. Cut throwaway worktree at main, fast-forward merge `access-model-v2-phase-5`.
4. Push main.
5. Verify Vercel prod redeploys + smoke the 3 new endpoints.
6. Tag baseline `v0.5-phase-5-closed`.
7. Update `.active-sessions.txt`.
8. Cleanup: keep `access-model-v2-phase-5` branch as record; delete throwaway worktree.

---

## 10. What comes next

**Phase 6 — Cutover & Cleanup** (~2-3 days):
- Deprecate legacy student token system (delete dead code, not just `_unused` rename)
- Remove `author_teacher_id` direct-ownership reads (everything via `class_members`)
- `/api/v1/*` rename pass for 388 existing routes + 90-day legacy aliases
- ADRs: update 003, write 011 (school+governance), 012 (audit log), 013 (API versioning)
- RLS-no-policy documentation for the 5 FU-FF tables (audit F12)
- 3-Matts merge decision (Matt manual call)
- Address FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP (228 routes — bulk audit-skip + inline-wire by category)
- Tag pilot baseline `v0.x-pilot1`
- **Checkpoint A7 — PILOT-READY signoff**

**Pre-pilot parallel track** (per master-spec §12 — runs alongside Phase 6 OR after):
- DPA signatures (Anthropic ZDR, Supabase, Voyage, Vercel, Sentry, Resend, ElevenLabs)
- Privacy Notice + ToS + Privacy Policy at studioloom.org
- China network test from NIS WiFi
- Incident response runbook
- Parental consent forms
- Two-engineer break-glass plan documented
- FU-AV2-CRON-SCHEDULER-WIRE (P2) — schedule the crons before any DSR delete

**Estimate to PILOT-READY**: ~3 days (Phase 6 only; parallel-track items have their own owner).

---

**Awaiting:** Matt's smoke + 1 prod-migration apply + 2 manual fire drills → A6 sign-off → merge to main.
