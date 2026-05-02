# Handoff — main

**Last session ended:** 2026-05-02T15:30Z (Phase 4 part 2 PLAN UPDATE — 4.8b freemium seams + 4.7b tier-aware membership + Decision 8 amendment + 2 new FUs filed; no code touched, plan-only saveme)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** post-saveme commit on `main` after FF-merge (this session shipped plan updates only — `cae235b` was previous saveme).
**Branch:** `access-model-v2-phase-4-part-2` — fully synced with origin/main.
**Pending push:** 0.

## What just happened (this session — plan-only, post-A5a)

Plan-update session. Two audits ran, two new sub-phases planned (no code touched).

- **Phase 4.8b freemium-build seam bake-in approved + planned** — 9-seam audit (post-A5a). 5 seams already in (`schools.subscription_tier` 5-tier enum, `audit_events.action TEXT` open string, `ai_budgets`/`ai_budget_state` cascade, `can(actor, action, resource, { requiresTier })`, `/api/public/*` boundary). 1 deferred to Phase 5 (`withAIBudget()`). Remaining 6 seams folded into new sub-phase **4.8b (~0.75 day)** between 4.8 and 4.9: `teachers.subscription_tier` enum, `stripe_customer_id` × 2 nullable cols, `actor.plan` on ActorSession, `plan-gates.ts` pass-through helpers wired into 3 chokepoints, `requires_plan` field on feature-flags.yaml, public-route boundary doc.
- **Phase 4.7b tier-aware membership amendment approved + planned** (after Gemini + CWORK 2nd-pass review). Closes the verification gap on free tier: random teacher signs up with school-domain email → auto-joins → reads 6 RLS leak surfaces (settings governance / audit log / library / teacher directory / `student_mentors_school_teacher_read` / `school_resources_school_read`+`guardians_school_read`). **Decision 8 amended** to tier-aware: free/pro = personal school siloed, school-tier = invite-only with `school_admin` role (a value in `school_responsibilities.responsibility_type` — no new table). New sub-phase **4.7b (~3.75 days)** with 4 sub-sub-phases + Matt-checkpoint: 4.7b-0 NIS tier flip ops / 4.7b-1 enum + INSERT-policy hardening + `is_school_admin()` helper + role matrices / 4.7b-2 NEW `school_invitations` table + invite flow + auto-join dismantle + upgrade-path / Matt-checkpoint smoke / 4.7b-3 tier-gate 6 leak surfaces.
- **Execution-order reorder (Option A)** — 4.6 ships AFTER 4.7b. Library opens with tier gate built-in; otherwise free-tier teachers see other teachers' unit titles + content (bigger leak than the 6 existing surfaces).
- **2 new FUs filed**: `FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP` P2 (school-tier lapse split → free), `FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD` P2 (student `@school-domain` emails can teacher-signup; needs role gate).
- **Phase 4 estimate**: ~12.25 → ~17 days. Close shifts ~13–14 May → ~17–18 May 2026.
- **5 plan docs updated**: brief (§3.8 item 13 + §4.7b spec + §4.8b spec + §9 Estimate + §11 sign-off addendum), master spec (Decision 8 line 336), decisions-log (2 new entries), followups (2 new FUs), handoff (this file).
- **Saveme run** — registry scanners no-op (no new code/migrations/routes); JSON report timestamps refreshed; ~520 lines added to plan docs.

## State of working tree

- `git status --short`: clean (post-saveme FF-merge).
- Tests: **3189 passed | 11 skipped** (no test changes this session — plan-only).
- Typecheck: 0 errors (no code touched).
- Vercel: prod main deployed green at `studioloom.org` (no deploys this session — plan-only saveme).
- Branches preserved on origin: `access-model-v2-phase-4` (predecessor), `access-model-v2-phase-4-hotfix-a5a` (== main), `access-model-v2-phase-4-hotfix-topnav` (== main), `access-model-v2-phase-4-part-2` (next-session work surface, == main post-saveme).
- Active session row stays on `access-model-v2-phase-4-part-2` for next session.
- 7 prod migrations applied through 2 May AM saveme; no new prod migrations this session (4.7b + 4.8b are plan-only — implementation session writes the migrations).

## Next steps — pick up here

- [ ] **Phase 4 part 2 on `access-model-v2-phase-4-part-2`** — sub-phases **4.5 → 4.7 → 4.7b → 4.6 → 4.8 → 4.8b → 4.9** (note execution-order reorder under Option A: 4.6 ships AFTER 4.7b so library opens with tier gate built-in) → Checkpoint A5b → final Phase 4 close. **Phase 4 total: ~17 days. Expected close: ~17–18 May 2026.**
  - **4.5 — `school_merge_requests` table + 90-day redirect cascade + per-table audit** (~0.75 day). Spec: brief §4.5. Schema migration adds `school_merge_requests` + `schools.merged_into_id` column; helper at `src/lib/access-v2/governance/school-merge.ts` does the cascade (12+ tables touched per merge); per-table audit_events row per cascade table (§3.9 item 15). Routes: POST `/api/school/[id]/merge-requests` (same-school propose), GET `/api/admin/school/[id]/merge-requests` (super-admin list), POST `/api/admin/school/[id]/merge-requests/[mergeId]/approve` (Matt approves cascade).
  - **4.6 — School Library browse + Request-to-Use flow** (~2 days, the curriculum-library moat). Spec: brief §4.6. Schema migration adds `unit_use_requests` table + `units.forked_from_unit_id` + `units.forked_from_author_id` columns. Routes: GET `/api/school/[id]/library` (browse same-school units), POST `/api/school/[id]/library/[unitId]/request-use`, GET `/api/teacher/me/unit-use-requests/inbox`, POST `/api/teacher/me/unit-use-requests/[requestId]/approve` (forks via existing unit-forking system + sets attribution), POST `.../deny`, POST `.../withdraw`. Page: `/school/[id]/library/page.tsx` + author inbox at `/teacher/notifications/use-requests` + requester sent list. **Khan/MagicSchool sidestep this via one-author model; making it work for multi-author schools is StudioLoom's differentiator.**
  - **4.7 — Platform super-admin `/admin/school/[id]` + view-as URL** (~0.75 day). Spec: brief §4.7. NEW `requirePlatformAdmin` helper at `src/lib/auth/require-platform-admin.ts`. Replace paper-only `/api/admin/schools` + `/admin/schools` page with real implementation (current "No schools entity exists yet (FU-P)" stub). New page `/admin/school/[id]` showing teachers + fabricators + settings snapshot + 30-day change history + audit feed + merge controls + view-as button. View-as = `?as_teacher_id=...` query param (read-only, audit-logged) — NEVER session-spoof.
  - **4.7b — Tier-aware membership + `school_admin` role** (~3.75 days, 4 sub-sub-phases + Matt-checkpoint). Spec: brief §4.7b (added 2 May 2026 PM after Gemini + CWORK 2nd-pass review). Closes the verification gap on free tier (random teacher signs up with school-domain email → auto-joins → reads 6 RLS leak surfaces). Decision 8 amended to tier-aware: free/pro = personal school siloed; school-tier = invite-only flat membership. **Sub-sub-phases**: (4.7b-0) **OPS PREREQUISITE — flip NIS `subscription_tier` `'pilot'` → `'school'` BEFORE any 4.7b code. Without this, students at `@nis.org.cn` can still teacher-signup**; (4.7b-1) `'school_admin'` enum value in `school_responsibilities.responsibility_type` + `SCHOOL_ADMIN_ACTIONS` matrix + `is_school_admin()` SECURITY DEFINER helper + INSERT-policy hardening (prevent self-promotion; allow during bootstrap-grace OR existing admin OR platform admin) + `can.ts` threading + frontend tier exclusion comment; (4.7b-2) NEW `school_invitations` table (mig 089 `teacher_access_requests` is INSUFFICIENT — waitlist with TEXT `school` field, no `school_id` FK / token / `invited_by`) + domain-match banner rewrite (target school-tier → "ask IT to invite you" + request-access POST, never auto-join) + auto-join code-path actively dismantled (not just behavior change — burn down all `auto_join` references) + invite-acceptance endpoint + upgrade-path flow reusing `schools.merged_into_id` from §4.5; (Matt-checkpoint) smoke invite-flow end-to-end before sweeping policies; (4.7b-3) tier-gate **6** RLS leak surfaces — settings governance / audit log / library / teacher directory / `student_mentors_school_teacher_read` (mig `20260428214735` student-ID enumeration) / `school_resources_school_read` + `guardians_school_read` (mig `20260428214009` parent PII when populated). Decision 8 amendment language: "flat governance with 2-teacher confirm applies WITHIN school-tier schools that have ≥2 verified school_admin members; single-school_admin schools follow bootstrap rules indefinitely." Initial school_admin grant: Stripe webhook auto-grants on upgrade (or ops script for NIS pre-Stripe); within bootstrap-grace, that admin can add 2nd admin without 2-confirm.
  - **4.8 — Settings bubble-up columns** (~0.5 day). Spec: brief §4.8. Single migration adds 8 JSONB + scalar columns to `schools` (academic_calendar_jsonb, timetable_skeleton_jsonb, frameworks_in_use_jsonb, default_grading_scale, notification_branding_jsonb, safeguarding_contacts_jsonb, content_sharing_default, default_student_ai_budget). Backfill from `school_calendar_terms` (most-recently-edited per school) + `teachers.school_profile`. Read-precedence helper at `src/lib/access-v2/school/calendar.ts`. Settings page Identity section already pre-wired to handle these via the change_type → applier registry mapping (Phase 4.4b shipped the wire). When 4.8 lands, additional editable Section components on the settings page.
  - **4.8b — Freemium seams bake-in** (~0.75 day). Spec: brief §4.8b (added 2 May 2026 PM after audit). Folds 6 freemium-build foundations into the same 4.8 migration / TS PR: (1) `teachers.subscription_tier` CHECK enum mirroring `schools.subscription_tier`, (2) nullable `stripe_customer_id` columns on schools + teachers (unique-when-set indexes), (3) `actor.plan` resolved on ActorSession (teacher tier → school tier → free fallback), (4) `src/lib/access-v2/plan-gates.ts` pass-through helpers (`enforceClassCreateLimit` + `enforceEnrollmentLimit`) wired into 3 chokepoints (welcome/create-class, welcome/setup-from-timetable, teacher/students enrollment), (5) `requires_plan` field on `feature-flags.yaml` (schema-only; all 15 flags default `free`), (6) public-route boundary doc `docs/projects/access-v2-public-route-boundary.md`. Out of scope: Stripe SDK/webhook/UI, plan-limit count queries, tier-feature matrix decisions (product call), trial / grace-period state machine — all defer to post-access-v2 freemium build (~6.75 eng days because foundations are baked here). Hard rule: no Stripe checkout in freemium build until tier-feature matrix is signed.
  - **4.9 — Department + dept_head auto-tag triggers** (~0.75 day). Spec: brief §4.9. Migration adds `classes.department TEXT NULL` + `school_responsibilities.department TEXT NULL` + 4 trigger functions: auto-tag dept_head into all classes when responsibility added; remove on revoke (only auto-tagged rows; manual rows preserved); resync on classes.department change; auto-tag on class INSERT. Backfill `classes.department` from `classes.subject` keyword match. UI: settings Section J + RoleChip variant for dept_head. Closes FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL.
  - **Pre-flight ritual before 4.5**: working tree clean, baseline `npm test` passing (3189), re-read Lesson #54 (registries can lie — schema-registry has 4 Phase 0 entries marked dropped that are live in prod) + Lesson #59 (estimates lie when audit hasn't happened) + Lesson #64 (RLS recursion via SECURITY DEFINER) + Lesson #66 (search_path lockdown). Full 6-registry cross-check (Step 5c).
  - **Pre-flight reminder for 4.5 specifically**: schema-registry has 4 Phase 0 spec_drift entries (FU-DD scanner misparse class on compound CREATE TABLE migrations) — `class_members`, `audit_events`, `school_responsibilities`, `student_mentors` all marked `status: dropped` despite being live. Won't block 4.5 work but should be reconciled in the registry hygiene close-out (Phase 4 part 2 §X.X).

- [ ] **3 polish FUs from 4.4d** can be addressed in parallel with part 2 if convenient:
  - `FU-AV2-PHASE-4-3WAY-LIVE-DIFF` P3 — full 3-way diff modal (proposed-before → CURRENT-NOW → after with stale warning). Today ships 2-way preview.
  - `FU-AV2-PHASE-4-PER-FIELD-INHERITANCE-BADGES` P3 — plug into 4.8 columns when they ship.
  - `FU-AV2-PHASE-4-4D-NEXT-INTL` P3 — when 2nd-locale demand arrives.

- [ ] **3 FUs from hotfix smoke** can be addressed pre-pilot but aren't blocking:
  - `FU-AV2-PHASE-4-DOMAIN-UI` P3 — in-page domain management UI on settings page (API works today via curl).
  - `FU-AV2-WELCOME-CALENDAR-PREVIEW` P3 — show imported holidays for verification.
  - `FU-AV2-WELCOME-STEP5-CTAS` P2 — needs product call. Matt is moving away from AI-generated units; the "Create a unit with AI" CTA is wrong direction. Decision required on the new unit-creation strategy before code change.

- [ ] **Registry hygiene FUs from this saveme**:
  - `FU-AV2-API-REGISTRY-DYNAMIC-ROUTES` P3 — scanner missed Phase 4 dynamic [id] routes.
  - `FU-AV2-SCHEMA-REGISTRY-PHASE-4-TABLES` P3 — manual entries for school_domains / school_setting_changes / school_setting_changes_rate_state + new schools columns.
  - `FU-AV2-WIRING-PHASE-4-SYSTEMS` P3 — `school-governance` + `school-library` system entries; updates to auth-system + permission-helper + class-management impact lists.
  - `FU-AV2-LAYOUT-DEDUP` P3 — `/school/layout.tsx` and `/teacher/layout.tsx` share ~80% logic.

- [ ] **Freemium-build hygiene FUs (from 4.8b audit)** — run only AFTER 4.8b lands, BEFORE freemium build kicks off:
  - `FU-FREEMIUM-CAN-PATTERN-ADR` P3 — write ADR-014 (single rule: all plan-aware gating goes through `can(...)` with `requiresTier:`).
  - `FU-FREEMIUM-CALLSITE-PLAN-AUDIT` P3 — grep `subscription_tier` outside canonical readers; refactor or exempt each hit.

- [ ] **Tier-aware membership FUs (from 4.7b audit)** — track but don't block 4.7b:
  - `FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP` P2 — design school-tier-lapse flow (who owns shared students/classes/library when school downgrades free). Defer until a real downgrade case arrives.
  - `FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD` P2 — student `@school-domain` emails can teacher-signup at flagged schools. Land alongside or shortly after 4.7b; before 2nd-school onboarding.

## Open questions / blockers

- _None blocking._
- Phase 4.5 brief is the natural starting point for next session — ~1-2h to draft end-to-end with full 6-registry cross-check (per build-methodology rule 9, post-Phase-1 Lesson #54 lessons).
- Wednesday — students arrive at NIS. Phase 4 part 2 work is admin-side (super-admin view, school library, dept_head triggers, merge requests) — none affects student-facing teaching directly. Safe to continue working through Wednesday's transition.

## Key references

- Phase 4 brief: `docs/projects/access-model-v2-phase-4-brief.md` — has full §3.8 (12 resolved decisions) + §3.9 (6 future-proofing additions) + per-sub-phase completion notes through 4.4d + Checkpoint A5a sub-criteria
- Master spec: `docs/projects/access-model-v2.md` — Phase 4.5 §4 line 253 onward, §8.1-§8.6 governance details
- Lessons: #54, #59, #64, #65, **#66 (this session)** — re-read pre-flight before 4.5
- Followups: `docs/projects/access-model-v2-followups.md` — 6 new FUs filed this session (3 from 4.4d polish + 3 from hotfix smoke)
- Decisions: `docs/decisions-log.md` — 12 new entries from this session
- Changelog: `docs/changelog.md` — 1 massive session entry capturing the full Phase 4 part 1 ship + hotfix passes
- WIRING.yaml: `auth-system` v2 + `permission-helper` v1 + `class-management` v2 already in place from Phase 3; `school-governance` + `school-library` systems still need WIRING entries (deferred via FU-AV2-WIRING-PHASE-4-SYSTEMS)
- Schema-registry.yaml: 4 Phase 0 entries still drift `status: dropped` (FU-DD scanner-misparse); 3 new Phase 4 tables not yet entered (FU-AV2-SCHEMA-REGISTRY-PHASE-4-TABLES)
- Active sessions: `/Users/matt/CWORK/.active-sessions.txt` — `access-model-v2-phase-4-part-2` claimed for next session

## Don't forget

- **Phase 4 part 1 fully closed + merged + smoke-verified on prod main.** All 7 migrations applied. Don't re-run.
- **Execution order under Option A (this session's sign-off):** 4.5 → 4.7 → **4.7b** → 4.6 → 4.8 → 4.8b → 4.9. NOT the brief's section-numbering order. Library (4.6) MUST ship after 4.7b, otherwise free-tier teachers see other teachers' unit titles + content as a bigger leak than the existing 6 surfaces.
- **4.7b-0 ops prerequisite is FIRST**: flip NIS `subscription_tier` `'pilot'` → `'school'` BEFORE any 4.7b code. Without this, students at `@nis.org.cn` can still teacher-signup. Audit existing teachers on NIS first; document in changelog. Then proceed to 4.7b-1 code.
- **Don't push to main during Phase 4 part 2 sub-phase work.** Methodology rule 8 — feature branch holds until Checkpoint A5b sign-off + migrations applied to prod. Use throwaway worktree for the merge per Phase 3 / Phase 4 part 1 patterns.
- **Pre-flight ritual is non-negotiable** before any Phase 4 part 2 sub-phase brief: clean tree, baseline `npm test`, re-read Lessons #54/#59/#64/#65/#66, full 6-registry cross-check (Step 5c).
- **`is_platform_admin=true` is on `mattburto@gmail.com`, NOT `mattburton@nanjing-school.com`** — swapped during Phase 4.3.z three-Matts consolidation. Phase 4.7 super-admin view + 4.7b initial school_admin grant logic both gate via `requirePlatformAdmin` against this.
- **Admin = Gmail-Matt; Teacher = NIS-Matt.** Pure separation. Don't muddy by editing Loominary-Matt (soft-deleted + auth banned).
- **Wednesday students arrive.** Phase 4 part 2 work is admin-side; doesn't affect student-facing teaching. Safe to continue. **However** — once 4.7b-0 ops flip happens, NIS is `'school'` tier and any new teacher signup needs an invite. Plan the flip for a window when no other staff are signing up.
- **Loominary is the umbrella, StudioLoom is the product.** `hello@loominary.org` (deactivated in DB but still the canonical contact email per legal pages); `studioloom.org` is the user-facing URL.
- **Hard rule for freemium build (post-access-v2)**: do NOT ship Stripe checkout until tier-feature matrix is signed by Matt. A subscription that doesn't unlock anything is the worst freemium failure mode.
