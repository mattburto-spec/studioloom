-- ───────────────────────────────────────────────────────────────────────────
-- Prod Migration Backlog Audit — Phase B Probe Query
-- ───────────────────────────────────────────────────────────────────────────
-- Date: 11 May 2026
-- Companion: docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → studioloom project → SQL Editor.
--   2. Paste this ENTIRE file into a new query.
--   3. Click Run. ~83 rows return in one result table.
--   4. Read the `applied` column (true/false) for each row.
--   5. Fill in the truth doc's "Applied?" column (YES/NO/PARTIAL) for each
--      migration, copying notes from the `notes` column where useful.
--   6. STOP at Checkpoint B.1 — paste the result table back to Claude.
--
-- READ-ONLY BY CONTRACT — every probe is `SELECT` from `pg_catalog`,
-- `information_schema`, `pg_policies`, or `storage.buckets`. No DDL,
-- no DML. Safe to run in prod.
--
-- Result shape:
--   row | name (migration filename)     | applied (bool) | notes
--
-- NOTE on the handle_new_teacher chain (#43/#53/#54/#83):
--   - #83 is the live prod state (handpatch) — its 4-property probe is
--     authoritative.
--   - #43/#53/#54 probes still return informative results (does the
--     function body have THIS migration's distinctive marker?), but per
--     Checkpoint A.1 sign-off, #43/#53/#54 will classify as
--     SKIP-EQUIVALENT in Phase C regardless of result.
--
-- NOTE on #48 (empty stub):
--   No probe is meaningful — the migration file has no SQL body. Returns
--   `applied = NULL` to flag for RETIRE classification in Phase C.
--
-- ───────────────────────────────────────────────────────────────────────────

WITH probes AS (
  -- ─── 1-10: New tables / columns / FKs (early Phase 1) ─────────────────────
  SELECT 1 AS row, '20260426140609_word_definitions_cache' AS name,
    (to_regclass('public.word_definitions') IS NOT NULL) AS applied,
    NULL::text AS notes
  UNION ALL SELECT 2, '20260427115409_student_support_settings',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='support_settings'),
    NULL
  UNION ALL SELECT 3, '20260427133507_grading_v1_student_tile_grades',
    (to_regclass('public.student_tile_grades') IS NOT NULL),
    NULL
  UNION ALL SELECT 4, '20260427134953_fabrication_labs',
    (to_regclass('public.fabrication_labs') IS NOT NULL),
    NULL
  UNION ALL SELECT 5, '20260427135108_backfill_fabrication_labs',
    (SELECT COUNT(*) FROM public.fabrication_labs WHERE name='Default lab') >= 1,
    'REVIEW: backfill count depends on prod school count at apply time'
  UNION ALL SELECT 6, '20260428024002_fix_grading_v1_page_id_type',
    (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='student_tile_grades' AND column_name='page_id') = 'text',
    'true=text (applied), false=uuid (pre-fix)'
  UNION ALL SELECT 7, '20260428041707_restore_fabrication_jobs_lab_fk',
    EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fabrication_jobs_lab_id_fkey'),
    NULL
  UNION ALL SELECT 8, '20260428065351_add_student_facing_comment',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_tile_grades' AND column_name='student_facing_comment'),
    NULL
  UNION ALL SELECT 9, '20260428074205_machine_profiles_school_scoped',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='machine_profiles' AND column_name='school_id'),
    NULL
  UNION ALL SELECT 10, '20260428081225_archive_class_auto_unenroll',
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trigger_class_archive_unenroll_students' AND NOT tgisinternal),
    NULL

  -- ─── 11-20: Schools v2 + user_profiles + access-v2 entities ──────────────
  UNION ALL SELECT 11, '20260428125547_schools_v2_columns',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='bootstrap_expires_at'),
    NULL
  UNION ALL SELECT 12, '20260428132944_user_locale_columns',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='locale'),
    NULL
  UNION ALL SELECT 13, '20260428134250_student_unit_school_id',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='school_id'),
    NULL
  UNION ALL SELECT 14, '20260428135317_soft_delete_and_unit_version_refs',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='deleted_at'),
    NULL
  UNION ALL SELECT 15, '20260428142618_user_profiles',
    (to_regclass('public.user_profiles') IS NOT NULL),
    NULL
  UNION ALL SELECT 16, '20260428214009_school_collections_and_guardians',
    (to_regclass('public.school_resources') IS NOT NULL),
    NULL
  UNION ALL SELECT 17, '20260428214403_consents',
    (to_regclass('public.consents') IS NOT NULL),
    NULL
  UNION ALL SELECT 18, '20260428214735_school_responsibilities_and_student_mentors',
    (to_regclass('public.school_responsibilities') IS NOT NULL),
    NULL
  UNION ALL SELECT 19, '20260428215923_class_members_and_audit_events',
    (to_regclass('public.class_members') IS NOT NULL),
    NULL
  UNION ALL SELECT 20, '20260428220303_ai_budgets_and_state',
    (to_regclass('public.ai_budgets') IS NOT NULL),
    NULL

  -- ─── 21-30: Backfills + bug reports + Phase 1 RLS rewrites ───────────────
  UNION ALL SELECT 21, '20260428221516_phase_0_8a_backfill',
    (SELECT COUNT(*) FROM public.class_members WHERE role='lead_teacher') >= 1,
    'REVIEW: false negative if class_members (#19) is missing — check #19 first'
  UNION ALL SELECT 22, '20260428222049_phase_0_8b_tighten_not_null',
    (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='school_id') = 'NO',
    'true when school_id is NOT NULL on students'
  UNION ALL SELECT 23, '20260428230559_add_bug_report_client_context',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bug_reports' AND column_name='client_context'),
    NULL
  UNION ALL SELECT 24, '20260429010718_add_bug_report_sentry_and_screenshots',
    EXISTS(SELECT 1 FROM storage.buckets WHERE id='bug-report-screenshots'),
    NULL
  UNION ALL SELECT 25, '20260429073552_phase_1_1a_student_user_id_column',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='user_id'),
    NULL
  UNION ALL SELECT 26, '20260429130730_phase_1_5_students_self_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='students' AND policyname='Students read own row'),
    NULL
  UNION ALL SELECT 27, '20260429130731_phase_1_5_competency_assessments_student_rewrite',
    COALESCE((SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='students_read_own' AND polrelid='public.competency_assessments'::regclass) LIKE '%user_id%', false),
    'true=new chain via auth.uid→user_id; false=legacy jwt.claims form'
  UNION ALL SELECT 28, '20260429130732_phase_1_5_quest_journeys_student_rewrite',
    COALESCE((SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='quest_journeys_student_select' AND polrelid='public.quest_journeys'::regclass) LIKE '%user_id%', false),
    'true=new chain; false=legacy'
  UNION ALL SELECT 29, '20260429130733_phase_1_5_design_conversations_student_rewrite',
    COALESCE((SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='Students can manage own conversations' AND polrelid='public.design_conversations'::regclass) LIKE '%user_id%', false),
    'true=new chain; false=legacy'
  UNION ALL SELECT 30, '20260429133359_phase_1_5b_class_students_self_read_authuid',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='class_students' AND policyname='Students read own enrollments via auth.uid'),
    NULL

  -- ─── 31-40: More Phase 1 RLS + auth-mode tightening ──────────────────────
  UNION ALL SELECT 31, '20260429133400_phase_1_5b_student_progress_self_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='student_progress' AND policyname='Students read own progress'),
    NULL
  UNION ALL SELECT 32, '20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='fabrication_jobs' AND policyname='fabrication_jobs_select_student'),
    NULL
  UNION ALL SELECT 33, '20260429133402_phase_1_5b_student_sessions_deny_all',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='student_sessions' AND policyname='student_sessions_deny_all'),
    'REVIEW: returns false if student_sessions table dropped by #66 — RETIRE in C if 66 applied'
  UNION ALL SELECT 34, '20260429231118_phase_1_4_cs1_classes_student_self_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='classes' AND policyname='Students read own enrolled classes'),
    NULL
  UNION ALL SELECT 35, '20260429231124_phase_1_4_cs1_assessment_records_student_self_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='assessment_records' AND policyname='Students read own published assessments'),
    NULL
  UNION ALL SELECT 36, '20260429231130_phase_1_4_cs1_student_badges_rewrite',
    COALESCE((SELECT pg_get_expr(qual, polrelid) FROM pg_policy WHERE polname='student_badges_read_own' AND polrelid='public.student_badges'::regclass) LIKE '%user_id%', false),
    'true=new chain; false=legacy app.student_id'
  UNION ALL SELECT 37, '20260430010922_phase_1_4_cs2_fix_students_rls_recursion',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='is_teacher_of_student' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 38, '20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='is_teacher_of_class' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 39, '20260430030419_phase_1_4_cs3_units_student_self_read',
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename='units' AND policyname='Students read own assigned units'),
    NULL
  UNION ALL SELECT 40, '20260430042051_student_badges_column_type_uuid_with_fk',
    (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='student_badges' AND column_name='student_id') = 'uuid',
    'true=uuid (applied); false=text (pre-conversion)'

  -- ─── 41-50: Auth modes + handle_new_teacher rewrites + permission helpers
  UNION ALL SELECT 41, '20260430053105_fix_students_teachers_with_check',
    (SELECT COUNT(*) FROM pg_policies WHERE tablename='students' AND policyname LIKE 'Teachers % students') >= 3,
    'REVIEW: fuzzy LIKE on policy names — tighten if needed'
  UNION ALL SELECT 42, '20260501045136_allowed_auth_modes',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='allowed_auth_modes'),
    NULL
  UNION ALL SELECT 43, '20260501103415_fix_handle_new_teacher_skip_students',
    COALESCE((SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%user_type%', false),
    'SKIP-EQUIVALENT via #83 handpatch; informational only'
  UNION ALL SELECT 44, '20260501123351_phase_3_0_permission_helper_rollout_flag',
    EXISTS(SELECT 1 FROM admin_settings WHERE key='permission_helper_rollout'),
    'REVIEW: actual key name may differ from descriptor'
  UNION ALL SELECT 45, '20260501123401_phase_3_1_permission_helpers',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_class_role' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 46, '20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger',
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='seed_lead_teacher_on_class_insert' AND NOT tgisinternal),
    NULL
  UNION ALL SELECT 47, '20260501141142_phase_3_4e_classes_class_members_read_policy',
    (SELECT COUNT(*) FROM pg_policies WHERE tablename='classes' AND qual LIKE '%has_class_role%') >= 1,
    'REVIEW: fuzzy qual LIKE — tighten if needed'
  UNION ALL SELECT 48, '20260501142442_phase_3_4f_is_teacher_of_student_includes_class_members_and_mentors',
    NULL,
    'EMPTY STUB — no SQL body, RETIRE in Phase C'
  UNION ALL SELECT 49, '20260502024657_phase_4_0_governance_engine_rollout_flag',
    EXISTS(SELECT 1 FROM admin_settings WHERE key='governance_engine_rollout'),
    'REVIEW: actual key name may differ'
  UNION ALL SELECT 50, '20260502025737_phase_4_1_seed_schools_extension',
    (SELECT COUNT(*) FROM schools WHERE source='imported') >= 50,
    'REVIEW: threshold is a guess'

  -- ─── 51-60: Phase 4 schools governance / handle_new_teacher chain ─────────
  UNION ALL SELECT 51, '20260502031121_phase_4_2_school_domains',
    (to_regclass('public.school_domains') IS NOT NULL),
    NULL
  UNION ALL SELECT 52, '20260502034114_phase_4_3_school_setting_changes',
    (to_regclass('public.school_setting_changes') IS NOT NULL),
    NULL
  UNION ALL SELECT 53, '20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path',
    COALESCE(
      (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%SET search_path%'
      AND (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%public.teachers%',
      false
    ),
    'SKIP-EQUIVALENT via #83 handpatch (which has both properties); informational only'
  UNION ALL SELECT 54, '20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school',
    COALESCE((SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%INSERT INTO public.schools%', false),
    'EXPECTED FALSE — #83 handpatch stripped the auto-personal-school INSERT. Classify SKIP-EQUIVALENT.'
  UNION ALL SELECT 55, '20260502122024_phase_4_4a_bootstrap_auto_close_trigger',
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tg_teachers_close_bootstrap_on_insert' AND NOT tgisinternal),
    NULL
  UNION ALL SELECT 56, '20260502210353_phase_4_5_school_merge_requests',
    (to_regclass('public.school_merge_requests') IS NOT NULL),
    NULL
  UNION ALL SELECT 57, '20260502215604_phase_4_7b_1_school_admin_role',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='is_school_admin' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 58, '20260502221646_phase_4_7b_2_school_invitations',
    (to_regclass('public.school_invitations') IS NOT NULL),
    NULL
  UNION ALL SELECT 59, '20260502223059_phase_4_7b_3_tier_gate_leak_surfaces',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='current_teacher_school_tier_school_id' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 60, '20260502224119_phase_4_6_unit_use_requests',
    (to_regclass('public.unit_use_requests') IS NOT NULL),
    NULL

  -- ─── 61-70: Phase 4 schools settings + Phase 5/6 student-session-drop ────
  UNION ALL SELECT 61, '20260502230242_phase_4_8_schools_settings_columns',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schools' AND column_name='academic_calendar_jsonb'),
    NULL
  UNION ALL SELECT 62, '20260502231455_phase_4_8b_freemium_seams',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teachers' AND column_name='subscription_tier'),
    NULL
  UNION ALL SELECT 63, '20260502233618_phase_4_9_dept_head_triggers',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='class_members' AND column_name='source'),
    'depends on #19 class_members; cross-check'
  UNION ALL SELECT 64, '20260503012514_phase_5_2_atomic_ai_budget_increment',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='atomic_increment_ai_budget' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 65, '20260503143034_phase_5_4_scheduled_deletions',
    (to_regclass('public.scheduled_deletions') IS NOT NULL),
    NULL
  UNION ALL SELECT 66, '20260503203440_phase_6_1_drop_student_sessions',
    (to_regclass('public.student_sessions') IS NULL),
    'INVERSE check: true when student_sessions is DROPPED'
  UNION ALL SELECT 67, '20260504020826_activity_three_field_prompt',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='activity_blocks' AND column_name='framing'),
    NULL
  UNION ALL SELECT 68, '20260504115948_notifications_table',
    (to_regclass('public.notifications') IS NOT NULL),
    NULL
  UNION ALL SELECT 69, '20260504225635_student_onboarding_picks',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='onboarding_picks'),
    NULL
  UNION ALL SELECT 70, '20260505010732_fabrication_jobs_preferred_color',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fabrication_jobs' AND column_name='preferred_color'),
    NULL

  -- ─── 71-83: Task system / Kanban / Timeline / Preflight pilot / TFL / handpatch
  UNION ALL SELECT 71, '20260505032750_task_system_v1_schema',
    (to_regclass('public.assessment_tasks') IS NOT NULL),
    NULL
  UNION ALL SELECT 72, '20260506000324_student_unit_kanban_v1',
    (to_regclass('public.student_unit_kanban') IS NOT NULL),
    NULL
  UNION ALL SELECT 73, '20260506010518_student_unit_timeline_v1',
    (to_regclass('public.student_unit_timeline') IS NOT NULL),
    NULL
  UNION ALL SELECT 74, '20260508021922_fabrication_jobs_pilot_override',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fabrication_jobs' AND column_name='pilot_override_at'),
    NULL
  UNION ALL SELECT 75, '20260508124359_add_ai_comment_draft',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_tile_grades' AND column_name='ai_comment_draft'),
    NULL
  UNION ALL SELECT 76, '20260508214312_add_score_na',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_tile_grades' AND column_name='score_na'),
    NULL
  UNION ALL SELECT 77, '20260508224402_add_student_seen_comment_at',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_tile_grades' AND column_name='student_seen_comment_at'),
    NULL
  UNION ALL SELECT 78, '20260508232012_privatise_legacy_buckets',
    COALESCE((SELECT bool_and(NOT public) FROM storage.buckets WHERE id IN ('responses','unit-images','knowledge-media')), false),
    'true when all 3 buckets private; false if any still public'
  UNION ALL SELECT 79, '20260509034943_rls_hardening_external_review',
    NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='gallery_submissions' AND policyname='Students read gallery submissions'),
    'INVERSE check: true when the wide-open SELECT policy is GONE'
  UNION ALL SELECT 80, '20260509222601_add_bump_student_seen_comment_at_rpc',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='bump_student_seen_comment_at' AND pronamespace='public'::regnamespace),
    NULL
  UNION ALL SELECT 81, '20260510090841_fabricators_failed_login_lockout',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fabricators' AND column_name='failed_login_count'),
    NULL
  UNION ALL SELECT 82, '20260510101533_tfl2_b1_tile_feedback_turns',
    (to_regclass('public.tile_feedback_turns') IS NOT NULL),
    NULL
  UNION ALL SELECT 83, '20260511085324_handpatch_handle_new_teacher_skip_students_search_path',
    COALESCE(
      (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%user_type%'
      AND (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%public.teachers%'
      AND (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%SET search_path%'
      AND (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_teacher' AND pronamespace='public'::regnamespace) LIKE '%EXCEPTION%',
      false
    ),
    'EXPECTED TRUE — verified live earlier today. AUTHORITATIVE for #43/#53/#54/#83 chain.'
)
SELECT row, name, applied, notes FROM probes ORDER BY row;
