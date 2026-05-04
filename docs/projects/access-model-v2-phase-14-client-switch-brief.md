# Phase 1.4 Client-Switch — Build Brief

**Phase:** Access Model v2 Phase 1 follow-up (FU-AV2-PHASE-14-CLIENT-SWITCH)
**Master spec:** [`docs/projects/access-model-v2.md`](access-model-v2.md)
**Parent brief:** [`docs/projects/access-model-v2-phase-1-brief.md`](access-model-v2-phase-1-brief.md) §7 (Option A scope adjustment)
**Estimate:** 2-3 days
**Branch:** `access-model-v2-phase-14-client-switch` (TBD when work starts)

---

## 1. Goal

Activate the 14 student-side RLS policies shipped in Phase 1.5 + 1.5b by switching the 6 Phase 1.4b routes from `createAdminClient()` to the RLS-respecting SSR client `createServerSupabaseClient()`. After this phase, RLS — not app-level filtering — becomes the primary enforcement mechanism for student data isolation on those 6 routes.

**This is the deliverable that makes Phase 1's design intent real.** Phase 1 closed under Option A with policies pre-positioned but not load-bearing. App-level filtering (`studentId IN (...)`, `student_id = $1` in route code) carries the security weight today. After this phase, RLS carries it for the 6 routes; app-level filtering becomes defense-in-depth (still in code, no longer the only line).

**Out of scope:**
- The other 57 student routes that still use `requireStudentAuth` + admin client. They keep working via the dual-mode wrapper. Migrating them is a future phase (likely Phase 1.4-CS6 or absorbed into Phase 6 cutover).
- Mutation routes — this brief is reads-only on the 6 GET routes.
- `gallery_*` policy tightening (current `USING (true)` policies are permissive but functional under app-level filtering).
- Phase 6 cutover (deleting dual-mode fallback) — that depends on full-route migration.

---

## 2. Pre-flight ritual (DONE 30 Apr 2026)

- [x] Git status clean, on `access-model-v2-phase-1` (just merged to main, 0 ahead).
- [x] Baseline `npm test` — 2792 passed | 11 skipped.
- [x] Typecheck — 0 errors.
- [x] Re-read Lessons #38 (verify=expected), #39 (fix-similar-sites), #54 (registry drift), #62 (pg_catalog FK verify), #63 (Vercel branch alias).
- [x] Audit-before-touch (§3 below).
- [x] Registry cross-check (§3.5).

---

## 3. Audit — supporting-table coverage

The 6 Phase 1.4b routes read 13 distinct tables collectively. Audited each table's RLS state:

### 3.1 Coverage map

| Table | Student-side policy today | Status | Action required |
|---|---|---|---|
| `students` | `students_self_read` USING `user_id = auth.uid()` (Phase 1.5) | ✅ load-bearing | None |
| `class_students` | `class_students_self_read_authuid` USING canonical chain (Phase 1.5b) | ✅ load-bearing | None |
| `student_progress` | `student_progress_self_read` USING canonical chain (Phase 1.5b) | ✅ load-bearing | None |
| `competency_assessments` | Rewritten to canonical chain (Phase 1.5) | ✅ load-bearing | None |
| `class_units` | `Read class units` USING `(true)` | ✅ public-read works | None |
| `units` | `Anyone can read units` | ✅ public-read works | None |
| `unit_badge_requirements` | `unit_badge_reqs_read` USING `(true)` | ✅ public-read works | None |
| `gallery_submissions` | `Students read gallery submissions` USING `(true)` | 🟡 permissive but works | Tighten in future; not blocking |
| `gallery_reviews` | `Students read reviews` USING `(true)` | 🟡 permissive but works | Tighten in future; not blocking |
| `gallery_rounds` | `Students read open gallery rounds` USING `status='open'` | 🟡 permissive but works | Tighten in future; not blocking |
| **`student_badges`** | `student_badges_read_own` USING old custom-token sentinel (`current_setting('app.student_id')` OR `request.jwt.claims->>sub`) | ❌ **BROKEN** — never matched real Supabase Auth | **REWRITE** (Phase 1.4-CS1) |
| **`classes`** | None (only `Teachers manage own classes`) | ❌ **NO STUDENT POLICY** | **AUTHOR** (Phase 1.4-CS1) |
| **`assessment_records`** | None (only teacher policies) | ❌ **NO STUDENT POLICY** | **AUTHOR** (Phase 1.4-CS1) |

### 3.2 Key finding: `student_badges` policy is silently broken

Policy text from `035_safety_badges.sql`:

```sql
CREATE POLICY student_badges_read_own ON student_badges
  FOR SELECT USING (
    student_id::text = COALESCE(current_setting('app.student_id', true), '')
    OR student_id::text = COALESCE((current_setting('request.jwt.claims', true)::json->>'sub'), '')
  );
```

`current_setting('app.student_id')` was the old custom-token sentinel — never set under Supabase Auth. `request.jwt.claims->>'sub'` returns `auth.users.id`, not `students.id`. So under any auth path that has ever existed, this policy returns 0 rows for students. App-level filtering has been masking this since the table was created. **Lesson #54 in action** — registry claimed coverage that didn't exist.

This puts `student_badges` in the same Phase 1.5 broken-policy class. Migration rewrites to canonical chain.

### 3.3 What client-switch will surface (predicted vs unknown)

**Predicted:**
- The 3 ❌ policies above will silently return zero rows under SSR client. Routes hit `safety/pending`, `insights`, `grades` would show students empty data. Migration in Phase 1.4-CS1 closes the gap before any route is switched.

**Unknown — surfaces during smoke testing:**
- Joins or relations not visible in this audit (e.g. PostgREST embeds that pull related rows).
- Helper code paths (`resolveStudentClassId`, `resolveStudentSettings`) — both were verified to read tables already covered, but their internal queries may use admin-only access patterns.
- `admin.ts` is imported by routes for things other than data reads (e.g. minting signed URLs); those keep using admin client.

### 3.5 Registry cross-check (Step 5c per build methodology)

| Registry | State | Drift caught |
|---|---|---|
| `WIRING.yaml` `auth-system` | Synced to v2 in Phase 1.7 | None |
| `schema-registry.yaml` | spec_drift entries on 12 tables for Phase 1.5 + 1.5b | `student_badges` not flagged — its broken policy was silently registered as `student_badges_read_own (their)` |
| `api-registry.yaml` | The 6 routes register `auth: student`; `tables_read` confirms the 13-table audit | Aligns with code |
| `rls-coverage.json` | 5 `rls_enabled_no_policy` (admin_audit_log, ai_model_config*, fabricator_sessions, teacher_access_requests) — none of these are read by the 6 routes | None affecting this work |
| `feature-flags.yaml` | No flag for staged rollout exists yet | If we want a kill-switch (e.g. `auth.client_switch_enabled`), would need adding |
| `data-classification-taxonomy.md` | No drift | None |

**One drift surfaced:** `student_badges` policy registry annotation says `(their)` (i.e. canonical chain) but the actual SQL is custom-token sentinel. Schema-registry scanner doesn't introspect policy SQL — it reads the migration filename + a per-table comment. This is FU-DD-class drift; fix as part of CS-1's migration documentation.

---

## 4. Sub-phases

### Phase 1.4-CS1 — Author 3 missing/broken policies (~2 hours + prod apply)

**Migrations:**
1. `<timestamp>_phase_1_4_cs1_classes_student_self_read.sql` — student can read their own class via `class_students` membership
2. `<timestamp>_phase_1_4_cs1_assessment_records_student_self_read.sql` — student reads own assessment_records via canonical chain
3. `<timestamp>_phase_1_4_cs1_student_badges_rewrite.sql` — drop broken `student_badges_read_own`, recreate with canonical chain

**Pattern (use Phase 1.5 rewrite migrations as exemplar — they're the gold standard):**
```sql
-- classes: student can read class they're enrolled in
CREATE POLICY "classes_student_via_enrollment"
  ON classes FOR SELECT
  USING (
    id IN (
      SELECT cs.class_id FROM class_students cs
      JOIN students s ON s.id = cs.student_id
      WHERE s.user_id = auth.uid()
    )
  );
```

**Tests:** Migration shape tests (3 files) — verify policy USING clause uses canonical chain. Pattern: copy `migration-phase-1-5b-*.test.ts` as exemplar.

**Apply to prod:** Via Supabase SQL Editor in timestamp order. Verify each with `pg_policies` query before proceeding to next.

**Stop trigger:** If any verification query returns unexpected policy text, STOP and report.

### Phase 1.4-CS2 — Switch low-risk batch (2 routes) (~3 hours)

Routes (smallest direct surface; only `classes` table read directly + helpers):
- `me/support-settings`
- `me/unit-context`

**Code change pattern:**
```typescript
// BEFORE
import { createAdminClient } from "@/lib/supabase/admin";
const supabase = createAdminClient();

// AFTER
import { createServerSupabaseClient } from "@/lib/supabase/server";
const supabase = await createServerSupabaseClient();
```

**Tests:** Existing route tests should pass unchanged (they mock the client). Add 1 new test per route asserting an unauthorized request returns empty data (RLS enforcement).

**Smoke (prod-preview):** Log in as a real student, hit each route, assert response shape matches admin-client baseline. Use the Vercel branch-alias URL (Lesson #63).

**Stop trigger:** Any route returns empty/null data when logged-in student should see content. Indicates a missed supporting-table policy.

### Phase 1.4-CS3 — Switch reads-many-tables batch (4 routes) (~6 hours)

Routes:
- `grades` (3 tables)
- `units` (6 tables)
- `safety/pending` (5 tables)
- `insights` (10 tables — largest surface)

**Order:** `grades` first (smallest). Then `safety/pending`, `units`, `insights`. Smoke each individually.

**Tests:** Same pattern as CS-2.

**Smoke:** As CS-2.

**Stop trigger:** As CS-2. Plus: any unexpected join returns 0 rows in a way that wasn't surfaced by the audit.

### Phase 1.4-CS4 — Negative control test (~1 hour)

Manual smoke in prod-preview:

1. Create or pick 2 students at different schools (or different classes if same-school).
2. Log in as student A. Capture sb-* cookies.
3. Use student A's cookies to hit `/api/student/grades?unitId=<student-B's-unit>`.
4. **Expected:** Empty response (or 404). NOT student B's grades.
5. Repeat for `/api/student/units` and `/api/student/me/unit-context`.

If any cross-class read succeeds, RLS isn't enforcing — STOP and audit.

### Phase 1.4-CS5 — Registry hygiene + close-out (~1 hour)

- `WIRING.yaml` `auth-system`: bump from v2 → v2.5 (or note as "client-switch shipped for 6 routes" in summary). `change_impacts` updated to reflect that policies are now load-bearing on those 6 routes.
- `schema-registry.yaml`: spec_drift entries for 3 new policies + the rewrite. Fix the drift annotation on `student_badges`.
- `dimensions3-followups.md`: FU-AV2-PHASE-14-CLIENT-SWITCH update — close the "6 routes" portion, leave open for the 57-route follow-up. File new FU-AV2-PHASE-14-CLIENT-SWITCH-REMAINING for the remaining 57.
- Decisions log + changelog entries.
- Lesson candidate: `student_badges` broken-policy-since-creation discovery (similar shape to Phase 1.5 finding — Lesson on "registry annotations don't introspect policy SQL").

---

## 5. Don't-stop-for list

- Cosmetic test-mock updates (route tests need to mock `createServerSupabaseClient` instead of `createAdminClient` — purely mechanical).
- Helper file path imports.
- Adjacent route discovering it also needs migration (file as remaining-routes-FU; don't expand scope).
- Permissive `gallery_*` policies (left as-is per §1).

---

## 6. Stop triggers

- A migration's prod verification returns unexpected policy text → diagnose before proceeding.
- A switched route returns empty data for an authenticated student → audit supporting tables.
- Cross-class read succeeds in negative control (CS-4) → STOP, RLS not enforcing.
- Test count regresses below 2792 baseline without explanation.
- `npx tsc --noEmit --project tsconfig.check.json` fails.
- The `gallery_*` permissive policies turn out to NOT be permissive in some unexpected way (e.g. there's a covering DENY policy nearby).

---

## 7. Checkpoint A2-CS — gate criteria

Phase closes when ALL pass:

### Code
- [ ] All 6 Phase 1.4b routes use `createServerSupabaseClient()` for student-data reads.
- [ ] Mutations + signed-URL minting (where present) keep using `createAdminClient()` — that's expected for now.
- [ ] Tests updated (mocks point at SSR client) and 2792+ baseline still passes.
- [ ] Typecheck 0 errors.

### Migrations
- [ ] 3 new migrations applied to prod (CS-1).
- [ ] `pg_policies` verification per migration confirms canonical chain shape.

### Smoke (prod-preview, branch-alias URL)
- [ ] Each of the 6 routes returns correct data for a logged-in student.
- [ ] Negative control (CS-4) confirms cross-class reads return empty/404.
- [ ] Vercel logs: zero `Invalid session` or RLS-policy errors during smoke.

### Registries (CS-5)
- [ ] WIRING `auth-system` updated.
- [ ] schema-registry.yaml spec_drift entries added; `student_badges` annotation corrected.
- [ ] dimensions3-followups.md updates: this FU partial-resolved, new "remaining routes" FU filed.
- [ ] decisions-log + changelog entries written.

### Documentation
- [ ] This brief at HEAD with completion notes appended.
- [ ] Handoff doc written for next session.

---

## 8. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `gallery_*` permissive policies turn out to be load-bearing app-level isolation that breaks under client-switch | `insights` route returns gallery data student shouldn't see | Low | App-level filter is preserved in route code (it's defense-in-depth); RLS adds zero risk |
| Helper functions (`resolveStudentClassId`) call admin client internally for reasons beyond simple reads | Helper still works (admin client bypasses RLS) but defeats client-switch purpose | Medium | Audit helpers in CS-2; if found, refactor to accept SSR client param |
| PostgREST embed (`select("*, classes(...)"))` denied by RLS even when row IDs match | Joined data returns NULL or query errors | Medium | Smoke test catches it per route; supporting-table policies (`classes` student-read in CS-1) prevent it |
| `student_badges` rewrite has unexpected interaction with teacher-side policy | Teacher view of student badges breaks | Low | OR-semantics across same-cmd policies — teacher policy still fires; rewrite only adds correct student path |
| Negative control test fails (cross-class read succeeds) | Phase fails A2-CS gate, can't ship | Low | If it happens, audit supporting tables harder; possibly need extra DENY policies. Rare. |

---

## 9. Estimate

| Sub-phase | Estimate |
|---|---|
| CS-1: 3 migrations + tests + prod apply | 0.5 day |
| CS-2: 2 routes switched + smoke | 0.25 day |
| CS-3: 4 routes switched + smoke | 0.75 day |
| CS-4: Negative control | 0.25 day |
| CS-5: Registry hygiene + close-out | 0.25 day |
| Buffer (Lesson #59 — estimates lie) | 0.5 day |
| **Total** | **~2.5 days** |

---

## 10. References

- Parent brief: `docs/projects/access-model-v2-phase-1-brief.md`
- Master spec: `docs/projects/access-model-v2.md`
- Phase 1.5 + 1.5b migrations (canonical-chain pattern exemplar): `supabase/migrations/2026042913073*_phase_1_5_*.sql` + `2026042913340*_phase_1_5b_*.sql`
- Lessons: #38, #39, #54, #62, #63 (re-read pre-flight)
- Follow-up tracker entry: `docs/projects/dimensions3-followups.md` → FU-AV2-PHASE-14-CLIENT-SWITCH
- Grace-period doc: `docs/security/student-auth-cookie-grace-period.md`

---

## 11. Sign-off

**Pre-flight + audit complete (30 Apr 2026).** Brief drafted with 3 critical findings:

1. `classes` has no student-side policy.
2. `assessment_records` has no student-side policy.
3. `student_badges` has a silently broken policy (custom-token sentinel pattern).

All 3 close in CS-1 before any route switches. Phase scoped to the 6 Phase 1.4b routes; remaining 57 deferred.

**STOP — awaiting Matt's sign-off on:**
- Scope (6 routes only, not all 63) — confirmed reasonable?
- Sub-phase order (CS-1 migrations first, then route batches CS-2 + CS-3)?
- Any concerns about the 3 audit findings (especially `student_badges` discovery)?
