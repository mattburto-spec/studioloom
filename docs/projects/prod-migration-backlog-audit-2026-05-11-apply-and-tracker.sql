-- ═══════════════════════════════════════════════════════════════════════════
-- Prod Migration Backlog Audit — Phase D (Apply) + Phase E (Tracker)
-- ═══════════════════════════════════════════════════════════════════════════
-- Date:    11 May 2026
-- Brief:   docs/projects/prod-migration-backlog-audit-brief.md
-- Truth:   docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → studioloom → SQL Editor → New query.
--   2. Paste this ENTIRE file. Click Run.
--   3. Result panel will show the verification SELECT at the bottom.
--   4. Confirm:
--      - `phase_d_check`: 1 row in admin_settings for school.governance_engine_rollout
--      - `phase_e_check`: 81 rows in applied_migrations
--      - `phase_e_source_breakdown`: 79 'backfill' + 1 'hand-patch' + 1 'manual'
--   5. Paste the verification output back to Claude.
--
-- TRANSACTION: Supabase SQL Editor runs multi-statement queries in a single
-- transaction by default. If anything fails, everything rolls back. Safe.
--
-- IDEMPOTENT: Phase D uses ON CONFLICT DO NOTHING. Phase E.1 uses CREATE
-- TABLE IF NOT EXISTS. Phase E.2 uses ON CONFLICT (name) DO NOTHING.
-- Re-running this file is safe.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE D — APPLY (1 INSERT)
-- ───────────────────────────────────────────────────────────────────────────
-- The only genuine drift in the audit: admin_settings row missing.

INSERT INTO admin_settings (key, value)
VALUES ('school.governance_engine_rollout', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE E.1 — CREATE TRACKER TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.applied_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by  TEXT,
  source      TEXT CHECK (source IN ('manual', 'cli', 'backfill', 'hand-patch')),
  notes       TEXT
);

ALTER TABLE public.applied_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applied_migrations_platform_admin_only ON public.applied_migrations;
CREATE POLICY applied_migrations_platform_admin_only ON public.applied_migrations
  FOR ALL
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

COMMENT ON TABLE public.applied_migrations IS
  'Authoritative record of which supabase/migrations/*.sql files have been applied to prod. Created 11 May 2026 by prod-migration-backlog-audit. Every future migration MUST INSERT a row here within the same session as the apply. See docs/projects/prod-migration-backlog-audit-brief.md and CLAUDE.md Migration discipline section.';

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE E.2 — BULK INSERT 81 ROWS
-- ───────────────────────────────────────────────────────────────────────────
-- 75 'backfill' (APPLIED migrations confirmed by probe)
--  4 'backfill' (SKIP-EQUIVALENT — effect in prod via another path)
--  1 'hand-patch' (#83 — 11 May incident hand-applied)
--  1 'manual' (#49 — just applied above in Phase D)
-- RETIRE rows (#33, #48) intentionally NOT inserted.

INSERT INTO public.applied_migrations (name, applied_at, applied_by, source, notes) VALUES
-- ─── APPLIED 'backfill' rows (75) ────────────────────────────────────────
('20260426140609_word_definitions_cache',                            '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260427115409_student_support_settings',                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260427133507_grading_v1_student_tile_grades',                    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260427134953_fabrication_labs',                                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428024002_fix_grading_v1_page_id_type',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428041707_restore_fabrication_jobs_lab_fk',                   '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428065351_add_student_facing_comment',                        '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428074205_machine_profiles_school_scoped',                    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428081225_archive_class_auto_unenroll',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428125547_schools_v2_columns',                                '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428132944_user_locale_columns',                               '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428134250_student_unit_school_id',                            '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428135317_soft_delete_and_unit_version_refs',                 '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428142618_user_profiles',                                     '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428214009_school_collections_and_guardians',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428214403_consents',                                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428214735_school_responsibilities_and_student_mentors',       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428215923_class_members_and_audit_events',                    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428220303_ai_budgets_and_state',                              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428221516_phase_0_8a_backfill',                               '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428222049_phase_0_8b_tighten_not_null',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260428230559_add_bug_report_client_context',                     '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429010718_add_bug_report_sentry_and_screenshots',             '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429073552_phase_1_1a_student_user_id_column',                 '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429130730_phase_1_5_students_self_read',                      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429130731_phase_1_5_competency_assessments_student_rewrite',  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429130732_phase_1_5_quest_journeys_student_rewrite',          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429130733_phase_1_5_design_conversations_student_rewrite',    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429133359_phase_1_5b_class_students_self_read_authuid',       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429133400_phase_1_5b_student_progress_self_read',             '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read', '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429231118_phase_1_4_cs1_classes_student_self_read',           '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429231124_phase_1_4_cs1_assessment_records_student_self_read', '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260429231130_phase_1_4_cs1_student_badges_rewrite',              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260430010922_phase_1_4_cs2_fix_students_rls_recursion',          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion', '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260430030419_phase_1_4_cs3_units_student_self_read',             '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260430042051_student_badges_column_type_uuid_with_fk',           '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260430053105_fix_students_teachers_with_check',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260501045136_allowed_auth_modes',                                '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260501123351_phase_3_0_permission_helper_rollout_flag',          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe (corrected key auth.permission_helper_rollout)'),
('20260501123401_phase_3_1_permission_helpers',                      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger',      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260501141142_phase_3_4e_classes_class_members_read_policy',      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502025737_phase_4_1_seed_schools_extension',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502031121_phase_4_2_school_domains',                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502034114_phase_4_3_school_setting_changes',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502122024_phase_4_4a_bootstrap_auto_close_trigger',           '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502210353_phase_4_5_school_merge_requests',                   '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502215604_phase_4_7b_1_school_admin_role',                    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502221646_phase_4_7b_2_school_invitations',                   '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502223059_phase_4_7b_3_tier_gate_leak_surfaces',              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502224119_phase_4_6_unit_use_requests',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502230242_phase_4_8_schools_settings_columns',                '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502231455_phase_4_8b_freemium_seams',                         '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260502233618_phase_4_9_dept_head_triggers',                      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260503012514_phase_5_2_atomic_ai_budget_increment',              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260503143034_phase_5_4_scheduled_deletions',                     '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260503203440_phase_6_1_drop_student_sessions',                   '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe (DROP of student_sessions confirmed)'),
('20260504020826_activity_three_field_prompt',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260504115948_notifications_table',                               '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260504225635_student_onboarding_picks',                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260505010732_fabrication_jobs_preferred_color',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260505032750_task_system_v1_schema',                             '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260506000324_student_unit_kanban_v1',                            '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260506010518_student_unit_timeline_v1',                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260508021922_fabrication_jobs_pilot_override',                   '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260508124359_add_ai_comment_draft',                              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260508214312_add_score_na',                                      '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260508224402_add_student_seen_comment_at',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260508232012_privatise_legacy_buckets',                          '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe (all 3 buckets confirmed private)'),
('20260509034943_rls_hardening_external_review',                     '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe (F-1..F-21 wide-open policies confirmed dropped)'),
('20260509222601_add_bump_student_seen_comment_at_rpc',              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260510090841_fabricators_failed_login_lockout',                  '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
('20260510101533_tfl2_b1_tile_feedback_turns',                       '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'applied pre-tracker; verified via probe'),
-- ─── SKIP-EQUIVALENT 'backfill' rows (4) ─────────────────────────────────
('20260427135108_backfill_fabrication_labs',                         '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'SKIP-EQUIVALENT: backfill substantially ran (Passes 1-3 of 4; 2 labs, 18 machines, 2 teachers linked). Pass 4 (classes.default_lab_id) gap = 0 rows. Labs renamed manually post-Pass-1. FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB filed P3.'),
('20260501103415_fix_handle_new_teacher_skip_students',              '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'SKIP-EQUIVALENT: superseded by handpatch (20260511085324). Function body has user_type guard via handpatch.'),
('20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path',    '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'SKIP-EQUIVALENT: superseded by handpatch (20260511085324). Function body has SET search_path + public.teachers qualifier via handpatch.'),
('20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school', '2026-05-11T09:30:00Z'::timestamptz, 'audit-2026-05-11', 'backfill', 'SKIP-EQUIVALENT: superseded by handpatch (20260511085324). Auto-personal-school INSERT intentionally stripped from prod state — see incident doc.'),
-- ─── HAND-PATCH (1 — #83) ────────────────────────────────────────────────
('20260511085324_handpatch_handle_new_teacher_skip_students_search_path', '2026-05-11T08:30:00Z'::timestamptz, 'matt+claude', 'hand-patch', 'Applied via Supabase SQL Editor 11 May 2026 during student-creation incident. SQL identical to the codified repo migration file. Verified live via probe (function body contains all 4 safety properties: user_type guard, public.teachers, SET search_path, EXCEPTION WHEN others).'),
-- ─── MANUAL (1 — #49, just applied above) ────────────────────────────────
('20260502024657_phase_4_0_governance_engine_rollout_flag',          NOW(), 'matt+claude', 'manual', 'Applied via Supabase SQL Editor 11 May 2026 during audit Phase D. The only genuine drift found in the 83-migration audit — admin_settings row for school.governance_engine_rollout was missing.')

ON CONFLICT (name) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ───────────────────────────────────────────────────────────────────────────
-- Three sanity-check selects. Paste these results back to Claude.

-- Phase D check: admin_settings row exists
SELECT 'phase_d_check' AS step, key, value FROM admin_settings WHERE key='school.governance_engine_rollout';

-- Phase E check: tracker row count (expect 81)
SELECT 'phase_e_check' AS step, COUNT(*) AS tracker_row_count FROM public.applied_migrations;

-- Phase E source breakdown (expect 79 backfill, 1 hand-patch, 1 manual)
SELECT 'phase_e_source_breakdown' AS step, source, COUNT(*) AS count
FROM public.applied_migrations
GROUP BY source
ORDER BY source;
