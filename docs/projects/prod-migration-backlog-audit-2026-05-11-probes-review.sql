-- ───────────────────────────────────────────────────────────────────────────
-- Phase B re-probe — REVIEW cases that returned unexpected results
-- ───────────────────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor after the main probe query. Paste the
-- result back to Claude.
--
-- These 4 rows had false-negatives in the first run; the re-probes use the
-- actual values from the migration bodies (vs my best guesses).
--
-- ───────────────────────────────────────────────────────────────────────────

WITH reprobes AS (
  -- #5 — fabrication_labs backfill. Original probe checked WHERE name='Default lab'
  --      (which IS the literal in the migration). False result means: either
  --      backfill never ran, OR labs were renamed/deleted after running.
  --      Triangulate: (a) are there ANY labs? (b) do ANY teachers have a
  --      non-null default_lab_id (Pass 3 effect)?
  SELECT 5 AS row, '#5 — fabrication_labs has any row' AS check_name,
    (SELECT COUNT(*) FROM fabrication_labs) AS value, NULL::text AS note
  UNION ALL SELECT 5, '#5 — fabrication_labs with name=''Default lab''',
    (SELECT COUNT(*) FROM fabrication_labs WHERE name='Default lab'), NULL
  UNION ALL SELECT 5, '#5 — teachers.default_lab_id non-null count',
    (SELECT COUNT(*) FROM teachers WHERE default_lab_id IS NOT NULL), 'Pass 3 effect'
  UNION ALL SELECT 5, '#5 — machine_profiles.lab_id non-null count',
    (SELECT COUNT(*) FROM machine_profiles WHERE lab_id IS NOT NULL), 'Pass 2 effect'
  UNION ALL SELECT 5, '#5 — classes.default_lab_id non-null count',
    (SELECT COUNT(*) FROM classes WHERE default_lab_id IS NOT NULL), 'Pass 4 effect'

  -- #33 — student_sessions_deny_all policy. False is CORRECT given #66 (drop
  --       student_sessions) returned true. Confirm: table really gone?
  UNION ALL SELECT 33, '#33 — student_sessions table exists (should be NULL)',
    CASE WHEN to_regclass('public.student_sessions') IS NULL THEN 0 ELSE 1 END,
    'to_regclass NULL confirms drop'

  -- #44 — admin_settings key. Probe used 'permission_helper_rollout' but the
  --       migration body uses 'auth.permission_helper_rollout'.
  UNION ALL SELECT 44, '#44 — admin_settings WHERE key=''auth.permission_helper_rollout''',
    (SELECT COUNT(*) FROM admin_settings WHERE key='auth.permission_helper_rollout'),
    'corrected key with auth. prefix'

  -- #49 — admin_settings key. Probe used 'governance_engine_rollout' but the
  --       migration body uses 'school.governance_engine_rollout'.
  UNION ALL SELECT 49, '#49 — admin_settings WHERE key=''school.governance_engine_rollout''',
    (SELECT COUNT(*) FROM admin_settings WHERE key='school.governance_engine_rollout'),
    'corrected key with school. prefix'
)
SELECT row, check_name, value, note FROM reprobes ORDER BY row, check_name;
