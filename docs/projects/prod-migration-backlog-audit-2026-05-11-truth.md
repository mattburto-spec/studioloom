# Prod Migration Backlog Audit — Truth Document

**Date:** 11 May 2026
**Owner:** Matt
**Phase:** A (Enumerate) → COMPLETE + signed off (Checkpoint A.1 PASSED, 11 May 2026)
**Phase:** B (Probe) → COMPLETE (Checkpoint B.1 PASSED pending combined sign-off)
**Phase:** C (Categorise) → COMPLETE (Checkpoint C.1 PASSED pending combined sign-off)
**Phase:** D (Apply) → READY — 1 single INSERT for #49 (see [`prod-migration-backlog-audit-2026-05-11-apply-and-tracker.sql`](prod-migration-backlog-audit-2026-05-11-apply-and-tracker.sql))
**Phase:** E (Tracker) → READY — bundled in same SQL file as Phase D for a single paste-and-go
**Companion brief:** [prod-migration-backlog-audit-brief.md](prod-migration-backlog-audit-brief.md)

## Scope

All migrations in `supabase/migrations/*.sql` with timestamp prefix >= 20260401 (1 April 2026 onwards). Excludes paired `.down.sql` rollback files.

**Count:** 83 migrations.

## How to read this doc

Each row = one repo migration. The probe SQL determines whether the migration's effect is present in prod. Run each probe in Supabase SQL Editor in **Phase B** and fill in the "Applied?" + "Notes" columns. **Phase C** then categorises each row as APPLY / SKIP-EQUIVALENT / REWORK / RETIRE.

Probes are READ-ONLY by contract. If any probe modifies state, that's a bug — flag it.

## Migrations table

| # | Migration filename | Headline effect | Probe SQL | Probe-true expectation | Applied? | Notes |
|---|---|---|---|---|---|---|
| 1 | `20260426140609_word_definitions_cache` | New `word_definitions` table (class-shared Haiku word-lookup cache) | `SELECT to_regclass('public.word_definitions');` | non-null regclass | | |
| 2 | `20260427115409_student_support_settings` | Add `support_settings` JSONB to `students` + `class_students` | `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='support_settings';` | one row | | |
| 3 | `20260427133507_grading_v1_student_tile_grades` | New `student_tile_grades` + `student_tile_grade_events` tables | `SELECT to_regclass('public.student_tile_grades');` | non-null regclass | | |
| 4 | `20260427134953_fabrication_labs` | New `fabrication_labs` school-owned table | `SELECT to_regclass('public.fabrication_labs');` | non-null regclass | | |
| 5 | `20260427135108_backfill_fabrication_labs` | Backfill "Default lab" per school + cascade lab_id | `SELECT COUNT(*) FROM public.fabrication_labs WHERE name='Default lab';` | >= 1 — REVIEW | | |
| 6 | `20260428024002_fix_grading_v1_page_id_type` | `student_tile_grades.page_id` UUID → TEXT | `SELECT data_type FROM information_schema.columns WHERE table_name='student_tile_grades' AND column_name='page_id';` | `'text'` (else `'uuid'`) | | |
| 7 | `20260428041707_restore_fabrication_jobs_lab_fk` | Restore `fabrication_jobs_lab_id_fkey` FK | `SELECT conname FROM pg_constraint WHERE conname='fabrication_jobs_lab_id_fkey';` | one row | | |
| 8 | `20260428065351_add_student_facing_comment` | Add `student_facing_comment` to `student_tile_grades` | `SELECT column_name FROM information_schema.columns WHERE table_name='student_tile_grades' AND column_name='student_facing_comment';` | one row | | |
| 9 | `20260428074205_machine_profiles_school_scoped` | Add `school_id` + `created_by_teacher_id` to `machine_profiles` | `SELECT column_name FROM information_schema.columns WHERE table_name='machine_profiles' AND column_name='school_id';` | one row | | |
| 10 | `20260428081225_archive_class_auto_unenroll` | New trigger `trigger_class_archive_unenroll_students` on `classes` | `SELECT tgname FROM pg_trigger WHERE tgname='trigger_class_archive_unenroll_students' AND NOT tgisinternal;` | one row | | |
| 11 | `20260428125547_schools_v2_columns` | Add 6 lifecycle/region/governance columns to `schools` | `SELECT column_name FROM information_schema.columns WHERE table_name='schools' AND column_name='bootstrap_expires_at';` | one row | | |
| 12 | `20260428132944_user_locale_columns` | Add `locale` to `teachers` and `students` | `SELECT column_name FROM information_schema.columns WHERE table_name='teachers' AND column_name='locale';` | one row | | |
| 13 | `20260428134250_student_unit_school_id` | Add nullable `school_id` to `students` and `units` | `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='school_id';` | one row | | |
| 14 | `20260428135317_soft_delete_and_unit_version_refs` | Add `deleted_at` (3 tables) + `unit_version_id` (7 tables) | `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='deleted_at';` | one row | | |
| 15 | `20260428142618_user_profiles` | New `user_profiles` table + trigger on `auth.users` | `SELECT to_regclass('public.user_profiles');` | non-null regclass | | |
| 16 | `20260428214009_school_collections_and_guardians` | 4 new tables: `school_resources`, `school_resource_relations`, `guardians`, `student_guardians` | `SELECT to_regclass('public.school_resources');` | non-null regclass | | |
| 17 | `20260428214403_consents` | New `consents` table | `SELECT to_regclass('public.consents');` | non-null regclass | | |
| 18 | `20260428214735_school_responsibilities_and_student_mentors` | New `school_responsibilities` + `student_mentors` tables | `SELECT to_regclass('public.school_responsibilities');` | non-null regclass | | |
| 19 | `20260428215923_class_members_and_audit_events` | New `class_members` + `audit_events` tables | `SELECT to_regclass('public.class_members');` | non-null regclass | | |
| 20 | `20260428220303_ai_budgets_and_state` | New `ai_budgets` + `ai_budget_state` tables | `SELECT to_regclass('public.ai_budgets');` | non-null regclass | | |
| 21 | `20260428221516_phase_0_8a_backfill` | Personal-school backfill + seed `class_members.lead_teacher` | `SELECT COUNT(*) FROM public.class_members WHERE role='lead_teacher';` | >= 1 — REVIEW (false negative if `class_members` missing) | | |
| 22 | `20260428222049_phase_0_8b_tighten_not_null` | Tighten `school_id` NOT NULL on `students`/`units`/`classes` | `SELECT is_nullable FROM information_schema.columns WHERE table_name='students' AND column_name='school_id';` | `'NO'` | | |
| 23 | `20260428230559_add_bug_report_client_context` | Add `client_context` JSONB to `bug_reports` | `SELECT column_name FROM information_schema.columns WHERE table_name='bug_reports' AND column_name='client_context';` | one row | | |
| 24 | `20260429010718_add_bug_report_sentry_and_screenshots` | Add `sentry_event_id` column + `bug-report-screenshots` storage bucket | `SELECT id FROM storage.buckets WHERE id='bug-report-screenshots';` | one row | | |
| 25 | `20260429073552_phase_1_1a_student_user_id_column` | Add `user_id` FK to `students` (auth.users link) | `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='user_id';` | one row | | |
| 26 | `20260429130730_phase_1_5_students_self_read` | RLS policy `"Students read own row"` on `students` | `SELECT policyname FROM pg_policies WHERE tablename='students' AND policyname='Students read own row';` | one row | | |
| 27 | `20260429130731_phase_1_5_competency_assessments_student_rewrite` | Rewrite `students_read_own`/`students_create_self` policies on `competency_assessments` to use auth.uid()→students.user_id chain | `SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='students_read_own' AND polrelid='public.competency_assessments'::regclass;` | contains `'user_id'` (new chain) | | |
| 28 | `20260429130732_phase_1_5_quest_journeys_student_rewrite` | Rewrite 4 quest_* student policies via canonical chain | `SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='quest_journeys_student_select' AND polrelid='public.quest_journeys'::regclass;` | contains `'user_id'`, not `'jwt.claims'` | | |
| 29 | `20260429130733_phase_1_5_design_conversations_student_rewrite` | Rewrite 2 design_conversations* policies | `SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='Students can manage own conversations' AND polrelid='public.design_conversations'::regclass;` | contains `'user_id'` | | |
| 30 | `20260429133359_phase_1_5b_class_students_self_read_authuid` | New `"Students read own enrollments via auth.uid"` policy on `class_students` | `SELECT policyname FROM pg_policies WHERE tablename='class_students' AND policyname='Students read own enrollments via auth.uid';` | one row | | |
| 31 | `20260429133400_phase_1_5b_student_progress_self_read` | New `"Students read own progress"` policy on `student_progress` | `SELECT policyname FROM pg_policies WHERE tablename='student_progress' AND policyname='Students read own progress';` | one row | | |
| 32 | `20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read` | New `fabrication_jobs_select_student` + `fabrication_scan_jobs_select_student` policies | `SELECT policyname FROM pg_policies WHERE tablename='fabrication_jobs' AND policyname='fabrication_jobs_select_student';` | one row | | |
| 33 | `20260429133402_phase_1_5b_student_sessions_deny_all` | Explicit deny-all `student_sessions_deny_all` policy on `student_sessions` | `SELECT policyname FROM pg_policies WHERE tablename='student_sessions' AND policyname='student_sessions_deny_all';` | one row — REVIEW (moot if mig 66 dropped the table) | | |
| 34 | `20260429231118_phase_1_4_cs1_classes_student_self_read` | New `"Students read own enrolled classes"` policy on `classes` | `SELECT policyname FROM pg_policies WHERE tablename='classes' AND policyname='Students read own enrolled classes';` | one row | | |
| 35 | `20260429231124_phase_1_4_cs1_assessment_records_student_self_read` | New `"Students read own published assessments"` policy on `assessment_records` | `SELECT policyname FROM pg_policies WHERE tablename='assessment_records' AND policyname='Students read own published assessments';` | one row | | |
| 36 | `20260429231130_phase_1_4_cs1_student_badges_rewrite` | Rewrite `student_badges_read_own` to canonical chain | `SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='student_badges_read_own' AND polrelid='public.student_badges'::regclass;` | contains `'user_id'` (new), not `'app.student_id'` (legacy) | | |
| 37 | `20260430010922_phase_1_4_cs2_fix_students_rls_recursion` | New SECURITY DEFINER fn `is_teacher_of_student(uuid)`; rewrite "Teachers manage students" policy | `SELECT proname FROM pg_proc WHERE proname='is_teacher_of_student' AND pronamespace='public'::regnamespace;` | one row | | |
| 38 | `20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion` | New SECURITY DEFINER fn `is_teacher_of_class(uuid)` | `SELECT proname FROM pg_proc WHERE proname='is_teacher_of_class' AND pronamespace='public'::regnamespace;` | one row | | |
| 39 | `20260430030419_phase_1_4_cs3_units_student_self_read` | New `"Students read own assigned units"` policy on `units` | `SELECT policyname FROM pg_policies WHERE tablename='units' AND policyname='Students read own assigned units';` | one row | | |
| 40 | `20260430042051_student_badges_column_type_uuid_with_fk` | `student_badges.student_id` TEXT → UUID + FK to `students(id)` | `SELECT data_type FROM information_schema.columns WHERE table_name='student_badges' AND column_name='student_id';` | `'uuid'` (else `'text'`) | | |
| 41 | `20260430053105_fix_students_teachers_with_check` | Split "Teachers manage students" FOR ALL into 4 cmd policies | `SELECT COUNT(*) FROM pg_policies WHERE tablename='students' AND policyname LIKE 'Teachers % students';` | >= 3 — REVIEW exact names | | |
| 42 | `20260501045136_allowed_auth_modes` | Add `allowed_auth_modes` TEXT[] to `schools` and `classes` | `SELECT column_name FROM information_schema.columns WHERE table_name='schools' AND column_name='allowed_auth_modes';` | one row | | |
| 43 | `20260501103415_fix_handle_new_teacher_skip_students` | Rewrite `handle_new_teacher()` to skip `user_type='student'` rows | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace;` | contains `'user_type'` — see #83 chain note | | |
| 44 | `20260501123351_phase_3_0_permission_helper_rollout_flag` | Insert `permission_helper_rollout` in `admin_settings` | `SELECT key FROM admin_settings WHERE key='permission_helper_rollout';` | one row — REVIEW key name | | |
| 45 | `20260501123401_phase_3_1_permission_helpers` | 3 new SECURITY DEFINER fns: `has_class_role`, `has_school_responsibility`, `has_student_mentorship` | `SELECT proname FROM pg_proc WHERE proname='has_class_role' AND pronamespace='public'::regnamespace;` | one row | | |
| 46 | `20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger` | New trigger `seed_lead_teacher_on_class_insert` on `classes` | `SELECT tgname FROM pg_trigger WHERE tgname='seed_lead_teacher_on_class_insert' AND NOT tgisinternal;` | one row | | |
| 47 | `20260501141142_phase_3_4e_classes_class_members_read_policy` | New SELECT policy on `classes` for `class_members` | `SELECT COUNT(*) FROM pg_policies WHERE tablename='classes' AND qual LIKE '%has_class_role%';` | >= 1 — REVIEW fuzzy probe | | |
| 48 | `20260501142442_phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors` | **EMPTY STUB** — no SQL body | `SELECT 'stub'::text;` | always 'stub' — REVIEW: file is empty, treat as RETIRE in Phase C | | |
| 49 | `20260502024657_phase_4_0_governance_engine_rollout_flag` | Insert `governance_engine_rollout` in `admin_settings` | `SELECT key FROM admin_settings WHERE key='governance_engine_rollout';` | one row — REVIEW key name | | |
| 50 | `20260502025737_phase_4_1_seed_schools_extension` | INSERT ~100 schools, source='imported' | `SELECT COUNT(*) FROM schools WHERE source='imported';` | >= 50 — REVIEW threshold | | |
| 51 | `20260502031121_phase_4_2_school_domains` | New `school_domains` table + `lookup_school_by_domain(text)` fn | `SELECT to_regclass('public.school_domains');` | non-null regclass | | |
| 52 | `20260502034114_phase_4_3_school_setting_changes` | New `school_setting_changes` + `school_setting_changes_rate_state` tables | `SELECT to_regclass('public.school_setting_changes');` | non-null regclass | | |
| 53 | `20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path` | Re-add `SET search_path` + `public.teachers` qualifier to `handle_new_teacher()` | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace;` | contains `'SET search_path'` AND `'public.teachers'` — see #83 chain note | | |
| 54 | `20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school` | Extend `handle_new_teacher()` to auto-create personal school + extend `schools.source` enum | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace;` | function contains `'INSERT INTO public.schools'` — **but see #83 chain note: probably NOT applied (handpatch stripped this)** | | |
| 55 | `20260502122024_phase_4_4a_bootstrap_auto_close_trigger` | New trigger `tg_teachers_close_bootstrap_on_insert` on `teachers` | `SELECT tgname FROM pg_trigger WHERE tgname='tg_teachers_close_bootstrap_on_insert' AND NOT tgisinternal;` | one row | | |
| 56 | `20260502210353_phase_4_5_school_merge_requests` | New `school_merge_requests` table + `schools.merged_into_id` column | `SELECT to_regclass('public.school_merge_requests');` | non-null regclass | | |
| 57 | `20260502215604_phase_4_7b_1_school_admin_role` | New helpers `is_school_admin()` + `can_grant_school_admin()`; extend enum | `SELECT proname FROM pg_proc WHERE proname='is_school_admin' AND pronamespace='public'::regnamespace;` | one row | | |
| 58 | `20260502221646_phase_4_7b_2_school_invitations` | New `school_invitations` table | `SELECT to_regclass('public.school_invitations');` | non-null regclass | | |
| 59 | `20260502223059_phase_4_7b_3_tier_gate_leak_surfaces` | New helper `current_teacher_school_tier_school_id()` | `SELECT proname FROM pg_proc WHERE proname='current_teacher_school_tier_school_id' AND pronamespace='public'::regnamespace;` | one row | | |
| 60 | `20260502224119_phase_4_6_unit_use_requests` | New `unit_use_requests` table + `units.forked_from_author_id` column | `SELECT to_regclass('public.unit_use_requests');` | non-null regclass | | |
| 61 | `20260502230242_phase_4_8_schools_settings_columns` | Add 8 settings columns to `schools` | `SELECT column_name FROM information_schema.columns WHERE table_name='schools' AND column_name='academic_calendar_jsonb';` | one row | | |
| 62 | `20260502231455_phase_4_8b_freemium_seams` | Add `subscription_tier` + `stripe_customer_id` to `teachers` | `SELECT column_name FROM information_schema.columns WHERE table_name='teachers' AND column_name='subscription_tier';` | one row | | |
| 63 | `20260502233618_phase_4_9_dept_head_triggers` | Add `class_members.source`, `classes.department`, `school_responsibilities.department`; 4 trigger fns | `SELECT column_name FROM information_schema.columns WHERE table_name='class_members' AND column_name='source';` | one row | | |
| 64 | `20260503012514_phase_5_2_atomic_ai_budget_increment` | New fn `atomic_increment_ai_budget(uuid, integer)` | `SELECT proname FROM pg_proc WHERE proname='atomic_increment_ai_budget' AND pronamespace='public'::regnamespace;` | one row | | |
| 65 | `20260503143034_phase_5_4_scheduled_deletions` | New `scheduled_deletions` table | `SELECT to_regclass('public.scheduled_deletions');` | non-null regclass | | |
| 66 | `20260503203440_phase_6_1_drop_student_sessions` | DROP `student_sessions` table | `SELECT to_regclass('public.student_sessions');` | NULL when applied (else non-null) | | |
| 67 | `20260504020826_activity_three_field_prompt` | Add `framing`/`task`/`success_signal`/`backfill_needs_review` to `activity_blocks` | `SELECT column_name FROM information_schema.columns WHERE table_name='activity_blocks' AND column_name='framing';` | one row | | |
| 68 | `20260504115948_notifications_table` | New `notifications` table | `SELECT to_regclass('public.notifications');` | non-null regclass | | |
| 69 | `20260504225635_student_onboarding_picks` | Add `onboarding_picks` JSONB to `students` | `SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='onboarding_picks';` | one row | | |
| 70 | `20260505010732_fabrication_jobs_preferred_color` | Add `preferred_color` TEXT to `fabrication_jobs` | `SELECT column_name FROM information_schema.columns WHERE table_name='fabrication_jobs' AND column_name='preferred_color';` | one row | | |
| 71 | `20260505032750_task_system_v1_schema` | 5 new tables: `assessment_tasks`, `task_lesson_links`, `task_criterion_weights`, `submissions`, `grade_entries` | `SELECT to_regclass('public.assessment_tasks');` | non-null regclass | | |
| 72 | `20260506000324_student_unit_kanban_v1` | New `student_unit_kanban` table | `SELECT to_regclass('public.student_unit_kanban');` | non-null regclass | | |
| 73 | `20260506010518_student_unit_timeline_v1` | New `student_unit_timeline` table | `SELECT to_regclass('public.student_unit_timeline');` | non-null regclass | | |
| 74 | `20260508021922_fabrication_jobs_pilot_override` | Add `pilot_override_at` + `pilot_override_rule_ids` to `fabrication_jobs` | `SELECT column_name FROM information_schema.columns WHERE table_name='fabrication_jobs' AND column_name='pilot_override_at';` | one row | | |
| 75 | `20260508124359_add_ai_comment_draft` | Add `ai_comment_draft` to `student_tile_grades` | `SELECT column_name FROM information_schema.columns WHERE table_name='student_tile_grades' AND column_name='ai_comment_draft';` | one row | | |
| 76 | `20260508214312_add_score_na` | Add `score_na` BOOLEAN to `student_tile_grades` | `SELECT column_name FROM information_schema.columns WHERE table_name='student_tile_grades' AND column_name='score_na';` | one row | | |
| 77 | `20260508224402_add_student_seen_comment_at` | Add `student_seen_comment_at` to `student_tile_grades` | `SELECT column_name FROM information_schema.columns WHERE table_name='student_tile_grades' AND column_name='student_seen_comment_at';` | one row | | |
| 78 | `20260508232012_privatise_legacy_buckets` | Flip `responses`/`unit-images`/`knowledge-media` storage buckets to private | `SELECT bool_and(NOT public) FROM storage.buckets WHERE id IN ('responses','unit-images','knowledge-media');` | `true` when all 3 private | | |
| 79 | `20260509034943_rls_hardening_external_review` | Drop wide-open policies on ~11 tables (F-1..F-21) | `SELECT COUNT(*) FROM pg_policies WHERE tablename='gallery_submissions' AND policyname='Students read gallery submissions';` | 0 (policy dropped) | | |
| 80 | `20260509222601_add_bump_student_seen_comment_at_rpc` | New fn `bump_student_seen_comment_at(uuid, uuid, text)` | `SELECT proname FROM pg_proc WHERE proname='bump_student_seen_comment_at' AND pronamespace='public'::regnamespace;` | one row | | |
| 81 | `20260510090841_fabricators_failed_login_lockout` | Add `failed_login_count` + `failed_login_locked_until` to `fabricators` | `SELECT column_name FROM information_schema.columns WHERE table_name='fabricators' AND column_name='failed_login_count';` | one row | | |
| 82 | `20260510101533_tfl2_b1_tile_feedback_turns` | New `tile_feedback_turns` table + backfill | `SELECT to_regclass('public.tile_feedback_turns');` | non-null regclass | | |
| 83 | `20260511085324_handpatch_handle_new_teacher_skip_students_search_path` | Hand-patched `handle_new_teacher()` — guard + qualified + search_path + EXCEPTION | `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace;` | contains ALL of: `'user_type'`, `'public.teachers'`, `'SET search_path'`, `'EXCEPTION'` | YES | confirmed prod has all 4 properties via direct probe earlier today |

## Uncertain probes (need human review before Phase B)

The following rows are flagged REVIEW — sanity-check the probe before relying on it:

- **#5** — Backfill-only. "Default lab" count threshold depends on school count at apply time.
- **#21** — Backfill-only. Returns 0 if `class_members` table itself is missing (mig 19 not applied) — that would be a false negative. Run probe for mig 19 first.
- **#33** — Probe returns NULL/empty if `student_sessions` was already dropped by mig 66. Migration moot post-66; classify as RETIRE if 66 is applied.
- **#41** — Probe uses `LIKE 'Teachers % students'` as a heuristic for the 4 split policy names. Tighten if exact names diverge.
- **#44** & **#49** — Probe assumes admin_settings key matches descriptor (`permission_helper_rollout` / `governance_engine_rollout`). Verify by reading the INSERT body if probe returns 0 rows.
- **#47** — Probe uses `qual LIKE '%has_class_role%'` (fuzzy). Tighten by reading the policy name from the migration body.
- **#48** — File is an EMPTY STUB (no SQL). Classify as RETIRE in Phase C; no Phase B probe meaningful.
- **#50** — Data seed only. Threshold `>= 50` is a guess; partial application could leave fewer.

## handle_new_teacher trigger chain — special handling

Migrations #43, #53, #54, and #83 all rewrite the same function `handle_new_teacher()`. Each `CREATE OR REPLACE FUNCTION` fully replaces the body — there's only one version live at a time. The current prod state is what was applied LAST, which per today's incident close-out is the handpatch (#83) version.

**Implication for Phase B:**
- The handpatch probe (#83) is **authoritative** for the current function state.
- Probes for #43, #53, #54 against the function body are **semantically misleading**: they may probe true (if their distinctive substring happens to also be in the handpatch) without #43/#53/#54 having ever been formally applied as named migrations.
- Phase C should treat #43/#53/#54 as **SKIP-EQUIVALENT** — the function is in the correct end-state via the handpatch, so re-applying these would be redundant or actively harmful (#54's auto-personal-school INSERT was deliberately stripped from the handpatch).

## Coverage check

Total migrations enumerated: **83**.

`ls supabase/migrations/2026*.sql | grep -v down.sql | wc -l` returns 83 for files with timestamp prefix >= 20260401. All 83 are in the table above.

## Process notes

- Migration headers (first 30-60 lines of each `.sql` file) summarised the canonical effect for all but #48 (which is an unwritten stub).
- For multi-effect migrations, the probe targets the MOST DISTINCTIVE single effect — the one most likely to uniquely identify whether THIS migration landed.
- All probes are READ-ONLY (`pg_catalog`, `information_schema`, or SELECT). None modify state.
- Probes assume `public` schema unless noted.

---

## Checkpoint A.1 — PASSED 11 May 2026

Signed off by Matt ("go with your recommendations"). All five questions:
1. ✅ 8 REVIEW probes run as-is; refine in Phase B if surprises emerge.
2. ✅ handle_new_teacher chain (#43/#53/#54) → SKIP-EQUIVALENT in Phase C.
3. ✅ #48 empty stub → RETIRE in Phase C.
4. ✅ All probes read-only confirmed.
5. ✅ 83 matches expectation.

---

## Phase B — Probe (COMPLETE, 11 May 2026)

Both probe runs executed against prod via Supabase SQL Editor (no RLS / postgres role). Initial run: 77/83 returned `applied=true`. 4 false-negatives investigated via re-probe SQL ([`prod-migration-backlog-audit-2026-05-11-probes-review.sql`](prod-migration-backlog-audit-2026-05-11-probes-review.sql)) — 3 turned out to be probe-name bugs or stale-policy-on-dropped-table; only **1 genuine APPLY** remains.

### Final results per migration

| # | Migration | Probe result | Final state |
|---|---|---|---|
| 1-4, 6-32, 34-43, 45-47, 50-53, 55-83 (excl. 44/48/49/54) | All applied true on first run | **APPLIED** | 76 rows |
| 44 | First run false (probe missed `'auth.'` prefix); re-probe true | **APPLIED** | probe bug |
| 5 | Probe false (no 'Default lab' name); re-probe: 2 labs exist, 18 machines linked, 2 teachers linked, **0 classes linked (Pass 4 gap)** | **SKIP-EQUIVALENT** | + file FU for Pass 4 |
| 33 | Probe false; re-probe confirms `student_sessions` table dropped by #66 | **RETIRE** | policy on dead table |
| 43, 53 | Probe true | **SKIP-EQUIVALENT** | superseded by #83 handpatch per A.1 |
| 48 | Probe null | **RETIRE** | empty stub per A.1 |
| 49 | Probe false; re-probe confirms `'school.governance_engine_rollout'` key genuinely missing from `admin_settings` | **APPLY** | **the only genuine drift in the whole audit** |
| 54 | Probe false (expected — handpatch stripped auto-personal-school INSERT) | **SKIP-EQUIVALENT** | superseded by #83 handpatch per A.1 |

### Summary

| Category | Count |
|---|---|
| APPLIED | 77 |
| SKIP-EQUIVALENT | 4 (#5, #43, #53, #54) |
| RETIRE | 2 (#33, #48) |
| **APPLY** (must run in Phase D) | **1 (#49)** |
| **TOTAL** | **83** |

**Checkpoint B.1 — PASSED 11 May 2026**

---

## Phase C — Categorise (COMPLETE, 11 May 2026)

Mechanical given Phase B results + Checkpoint A.1 sign-off rules. No new investigation; categories above ARE the Phase C output.

### Tracker-table-bound rows (will INSERT into `public.applied_migrations` at Phase E)

- **77 APPLIED** rows: `source='backfill'`, `applied_by='audit-2026-05-11'`, `notes='applied pre-tracker; verified via probe'`
- **4 SKIP-EQUIVALENT** rows:
  - **#5**: `source='backfill'`, notes: `'backfill substantially ran (Passes 1-3 of 4); Pass 4 (classes.default_lab_id) gap exists; labs renamed manually post-Pass-1; FU filed for re-run if needed'`
  - **#43, #53**: `source='backfill'`, notes: `'superseded by handpatch #83 (11 May 2026); function body has all safety properties from this migration'`
  - **#54**: `source='backfill'`, notes: `'superseded by handpatch #83; auto-personal-school INSERT intentionally stripped from prod state — see incident doc'`

### NOT inserted into tracker

- **2 RETIRE** rows:
  - **#33** (`student_sessions_deny_all`): table dropped by #66; policy moot. Logged in truth doc only.
  - **#48** (empty stub): no SQL body. Logged in truth doc only.

### Phase D scope

**1 INSERT** to run in prod:

```sql
INSERT INTO admin_settings (key, value)
VALUES ('school.governance_engine_rollout', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

This is the entire Phase D. After applying, append row to [`applied-migrations-interim-log.md`](applied-migrations-interim-log.md), then move to Phase E (build tracker).

**Checkpoint C.1 — PASSED 11 May 2026** (mechanical; awaiting combined B.1+C.1 sign-off)

### Follow-up filed

- **FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB** (P3): Phase 8-1 backfill migration's Pass 4 (cascade `classes.default_lab_id` from owning teacher's default_lab_id) returned 0 rows updated in prod despite teachers + machines having lab links. Either no eligible classes at apply time OR Pass 4 was skipped. Low-priority — current platform behaviour is fine without it; re-run Pass 4 SQL if class-level default lab routing matters in the future.

---

## Combined Checkpoint B.1 + C.1 — sign-off needed

**Matt, before Phase D begins, please confirm:**

1. ✅ **77 APPLIED rows look right** (no surprise applies; matches your memory of what's been applied to prod).
2. ✅ **4 SKIP-EQUIVALENT rows are correctly categorised** — especially #5 (backfill substantially ran, labs renamed manually).
3. ✅ **#33 → RETIRE** (policy on dropped table — moot).
4. ✅ **#48 → RETIRE** (empty stub).
5. ✅ **#49 is the only APPLY** — single `INSERT INTO admin_settings` run against prod is the entire Phase D apply.
6. ✅ **FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB filed as P3** — acceptable to defer.

Phase D after sign-off: paste the one-line INSERT into Supabase SQL Editor, log it in the interim log, then move to Phase E (build tracker + bulk INSERT 81 rows).
