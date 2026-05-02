# Handoff — main

**Last session ended:** 2026-05-02T22:25Z (Phase 4 part 1 SHIPPED + Checkpoint A5a + 2 hotfix passes + saveme)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `b2b9bed` "fix(access-v2): Phase 4.4 hotfix — /school/* layout with TopNav (no more stuck-page)"
**Branch:** `main` — fully synced with origin.
**Pending push:** 0.

## What just happened (this session)

Marathon session. Phase 4.0 → 4.4d shipped end-to-end + 2 hotfix passes from smoke + saveme.

- **Phase 4.0–4.4d shipped to main via Checkpoint A5a fast-forward merge** (47 commits, `b82f9f2..0bf1aeb`). 7 migrations applied to prod by Matt: governance flag (4.0) + 101-school seed (4.1) + school_domains + lookup helpers (4.2) + governance ledger + rate-state + tier resolvers (4.3) + handle_new_teacher search_path fix (4.3.x, Lesson #66) + handle_new_teacher auto-personal-school (4.3.y, Decision 2 implementation) + bootstrap auto-close trigger (4.4a). All idempotent + DO-block-asserted.
- **Three-Matts prod-data consolidation** pulled forward from Phase 6: Gmail-Matt → "Admin" (both admin tiers), NIS-Matt → "Matt Burton" pure teacher, Loominary-Matt → soft-deleted + auth banned. 26 classes / 11 units / 7 students wiped. **`is_platform_admin=true` swapped from NIS-Matt → Gmail-Matt** (master CLAUDE.md updated).
- **Hotfix 1 pass (5 commits, `0bf1aeb..9ced53e`)** — surfaced via Matt's smoke testing of Phase 4.4: dirty-check anchor (router.refresh) + server-side .trim() (NIS schools.city was "Nanjing " with trailing space — cleaned via SQL); `/school/me/settings` redirect + TopNav nav links (My Settings + School Settings); Country/Timezone/Locale dropdowns + Region hidden; stale "coming in 4.4b" copy replaced; 3 FUs filed.
- **Hotfix 2 pass (1 commit, `9ced53e..b2b9bed`)** — `/school/[id]/settings` rendered bare without TopNav (stuck-page UX). NEW `src/app/school/layout.tsx` mirrors `/teacher/layout.tsx`. FU-AV2-LAYOUT-DEDUP filed for refactor.
- **Saveme run** — changelog +1 massive session entry, decisions-log +12 entries, master CLAUDE.md status block refreshed, RLS coverage scanner shows 108→111 tables (all 3 new tables RLS+policies clean).

## State of working tree

- `git status --short`: clean.
- Tests: **3189 passed | 11 skipped** (was 2895 at Phase 4 start; +294 new tests this session).
- Typecheck: 0 errors (`tsconfig.check.json` strict).
- Vercel: prod main deployed green at `studioloom.org` with all of Phase 4.0-4.4d + hotfixes live. **Settings page works end-to-end** via `https://www.studioloom.org/school/636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1/settings`.
- Branches preserved on origin: `access-model-v2-phase-4` (predecessor), `access-model-v2-phase-4-hotfix-a5a` (== main), `access-model-v2-phase-4-hotfix-topnav` (== main), `access-model-v2-phase-4-part-2` (next-session work surface, currently == main).
- Active session row updated to `access-model-v2-phase-4-part-2` for next session.

## Next steps — pick up here

- [ ] **Phase 4 part 2 on `access-model-v2-phase-4-part-2`** — sub-phases 4.5 + 4.6 + 4.7 + 4.8 + 4.9 → Checkpoint A5b → final Phase 4 close.
  - **4.5 — `school_merge_requests` table + 90-day redirect cascade + per-table audit** (~0.75 day). Spec: brief §4.5. Schema migration adds `school_merge_requests` + `schools.merged_into_id` column; helper at `src/lib/access-v2/governance/school-merge.ts` does the cascade (12+ tables touched per merge); per-table audit_events row per cascade table (§3.9 item 15). Routes: POST `/api/school/[id]/merge-requests` (same-school propose), GET `/api/admin/school/[id]/merge-requests` (super-admin list), POST `/api/admin/school/[id]/merge-requests/[mergeId]/approve` (Matt approves cascade).
  - **4.6 — School Library browse + Request-to-Use flow** (~2 days, the curriculum-library moat). Spec: brief §4.6. Schema migration adds `unit_use_requests` table + `units.forked_from_unit_id` + `units.forked_from_author_id` columns. Routes: GET `/api/school/[id]/library` (browse same-school units), POST `/api/school/[id]/library/[unitId]/request-use`, GET `/api/teacher/me/unit-use-requests/inbox`, POST `/api/teacher/me/unit-use-requests/[requestId]/approve` (forks via existing unit-forking system + sets attribution), POST `.../deny`, POST `.../withdraw`. Page: `/school/[id]/library/page.tsx` + author inbox at `/teacher/notifications/use-requests` + requester sent list. **Khan/MagicSchool sidestep this via one-author model; making it work for multi-author schools is StudioLoom's differentiator.**
  - **4.7 — Platform super-admin `/admin/school/[id]` + view-as URL** (~0.75 day). Spec: brief §4.7. NEW `requirePlatformAdmin` helper at `src/lib/auth/require-platform-admin.ts`. Replace paper-only `/api/admin/schools` + `/admin/schools` page with real implementation (current "No schools entity exists yet (FU-P)" stub). New page `/admin/school/[id]` showing teachers + fabricators + settings snapshot + 30-day change history + audit feed + merge controls + view-as button. View-as = `?as_teacher_id=...` query param (read-only, audit-logged) — NEVER session-spoof.
  - **4.8 — Settings bubble-up columns** (~0.5 day). Spec: brief §4.8. Single migration adds 8 JSONB + scalar columns to `schools` (academic_calendar_jsonb, timetable_skeleton_jsonb, frameworks_in_use_jsonb, default_grading_scale, notification_branding_jsonb, safeguarding_contacts_jsonb, content_sharing_default, default_student_ai_budget). Backfill from `school_calendar_terms` (most-recently-edited per school) + `teachers.school_profile`. Read-precedence helper at `src/lib/access-v2/school/calendar.ts`. Settings page Identity section already pre-wired to handle these via the change_type → applier registry mapping (Phase 4.4b shipped the wire). When 4.8 lands, additional editable Section components on the settings page.
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
- **Don't push to main during Phase 4 part 2 sub-phase work.** Methodology rule 8 — feature branch holds until Checkpoint A5b sign-off + migrations applied to prod. Use throwaway worktree for the merge per Phase 3 / Phase 4 part 1 patterns.
- **Pre-flight ritual is non-negotiable** before any Phase 4 part 2 sub-phase brief: clean tree, baseline `npm test`, re-read Lessons #54/#59/#64/#65/#66, full 6-registry cross-check (Step 5c).
- **`is_platform_admin=true` is on `mattburto@gmail.com`, NOT `mattburton@nanjing-school.com`** — swapped during Phase 4.3.z three-Matts consolidation. Phase 4.7 super-admin view will gate via `requirePlatformAdmin` against this.
- **Admin = Gmail-Matt; Teacher = NIS-Matt.** Pure separation. Don't muddy by editing Loominary-Matt (soft-deleted + auth banned).
- **Wednesday students arrive.** Phase 4 part 2 work is admin-side; doesn't affect student-facing teaching. Safe to continue.
- **Loominary is the umbrella, StudioLoom is the product.** `hello@loominary.org` (deactivated in DB but still the canonical contact email per legal pages); `studioloom.org` is the user-facing URL.
