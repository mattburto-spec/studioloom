-- Migration: phase_5_2_atomic_ai_budget_increment
-- Created: 20260503012514 UTC
-- Phase: Access Model v2 Phase 5.2 (per-student AI budget — atomic counter)
--
-- WHY: Phase 5.3's withAIBudget() middleware needs an atomic
--   increment-or-reset operation against ai_budget_state. Naïve UPDATE
--   races between the read (tokens_used_today) and write (compare against
--   cap), so the same student under concurrent AI calls could blow past
--   the cap by N where N = concurrent call count. SECURITY DEFINER function
--   wraps the INSERT-on-conflict in a single statement; Postgres serialises
--   row-level upserts so the increment is atomic even under contention.
--
--   Reset semantics (per Decision 6 + §3 item 37): cap rolls over at
--   midnight in the school's IANA timezone (default 'Asia/Shanghai').
--   Computed via `((now() AT TIME ZONE tz)::date + 1) AT TIME ZONE tz` —
--   produces the UTC instant at which the school's local clock next reads
--   00:00. If the existing reset_at is already past, this call's tokens
--   become the new tokens_used_today (counter zeroed) and reset_at bumps.
--
-- IMPACT: 1 new function. No table changes.
--   - atomic_increment_ai_budget(student_id UUID, tokens INTEGER)
--     RETURNS (new_tokens_used_today INTEGER, next_reset_at TIMESTAMPTZ)
--   - SECURITY DEFINER + SET search_path = public, pg_temp (Lesson #66)
--   - REVOKE EXECUTE FROM PUBLIC; GRANT to service_role only (Lesson #52)
--   - Service-role middleware (withAIBudget in Phase 5.3) is the sole caller.
-- ROLLBACK: paired .down.sql DROPs the function.

-- ============================================================
-- 1. Function
-- ============================================================

CREATE OR REPLACE FUNCTION atomic_increment_ai_budget(
  p_student_id UUID,
  p_tokens INTEGER
)
RETURNS TABLE (
  new_tokens_used_today INTEGER,
  next_reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz TEXT;
  v_now TIMESTAMPTZ := now();
  v_next_midnight TIMESTAMPTZ;
  v_student_exists BOOLEAN;
BEGIN
  -- Reject negative increments — a positive request only.
  -- Zero is allowed (used to "touch" the row + check cap without consuming).
  IF p_tokens < 0 THEN
    RAISE EXCEPTION 'atomic_increment_ai_budget: p_tokens must be >= 0, got %', p_tokens;
  END IF;

  -- Resolve school timezone via students.school_id → schools.timezone.
  -- Coalesce to 'Asia/Shanghai' for orphan students or when school has no timezone set.
  -- The boolean v_student_exists distinguishes "student missing" (404) from
  -- "student exists but unattached" (defaults applied).
  SELECT
    COALESCE(s.timezone, 'Asia/Shanghai'),
    TRUE
  INTO v_tz, v_student_exists
  FROM students st
  LEFT JOIN schools s ON s.id = st.school_id
  WHERE st.id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'atomic_increment_ai_budget: student % not found', p_student_id;
  END IF;

  -- Compute next-midnight-in-school's-local-timezone, expressed in UTC.
  -- Three steps:
  --   1. (v_now AT TIME ZONE v_tz)::date  → today's date in school's local time
  --   2. + 1                              → tomorrow's date (school local)
  --   3. AT TIME ZONE v_tz                → UTC instant of midnight-tomorrow-in-school-local
  v_next_midnight := ((v_now AT TIME ZONE v_tz)::date + 1) AT TIME ZONE v_tz;

  -- Atomic UPSERT.
  -- If no row exists OR the existing reset_at is in the past:
  --   tokens_used_today = p_tokens (counter zeroed for new day)
  --   reset_at = next midnight
  -- Otherwise:
  --   tokens_used_today += p_tokens
  --   reset_at unchanged
  INSERT INTO ai_budget_state (student_id, tokens_used_today, reset_at, updated_at)
  VALUES (p_student_id, p_tokens, v_next_midnight, v_now)
  ON CONFLICT (student_id) DO UPDATE SET
    tokens_used_today = CASE
      WHEN ai_budget_state.reset_at <= v_now THEN EXCLUDED.tokens_used_today
      ELSE ai_budget_state.tokens_used_today + EXCLUDED.tokens_used_today
    END,
    reset_at = CASE
      WHEN ai_budget_state.reset_at <= v_now THEN EXCLUDED.reset_at
      ELSE ai_budget_state.reset_at
    END,
    updated_at = v_now
  RETURNING ai_budget_state.tokens_used_today, ai_budget_state.reset_at
  INTO new_tokens_used_today, next_reset_at;

  RETURN NEXT;
END;
$$;

-- ============================================================
-- 2. Permission lockdown (Lesson #52)
-- ============================================================
-- The function does NOT bypass RLS in any meaningful way (ai_budget_state
-- has deny-by-default INSERT/UPDATE; service role is the only writer).
-- But we still revoke+regrant explicitly to make intent legible to future
-- auditors and to defend against Supabase's auto-grant behaviour.

REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION atomic_increment_ai_budget(UUID, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION atomic_increment_ai_budget(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION atomic_increment_ai_budget(UUID, INTEGER) IS
  'Phase 5.2 — atomic increment of ai_budget_state.tokens_used_today for a '
  'student. Resets counter + bumps reset_at when past the previous '
  'midnight-in-school-timezone horizon. SECURITY DEFINER + service_role only. '
  'Caller (Phase 5.3 withAIBudget middleware) compares the returned counter '
  'against the cascade-resolved cap.';

-- ============================================================
-- 3. Sanity DO-block (Lesson #38: assert expected values)
-- ============================================================

DO $$
DECLARE
  v_proconfig TEXT[];
  v_security_definer BOOLEAN;
BEGIN
  -- Function exists with the expected signature
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'atomic_increment_ai_budget'
      AND p.pronargs = 2
  ) THEN
    RAISE EXCEPTION
      'Migration failed: atomic_increment_ai_budget(UUID, INTEGER) not created';
  END IF;

  -- search_path is locked (Lesson #66)
  SELECT p.proconfig, p.prosecdef
  INTO v_proconfig, v_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'atomic_increment_ai_budget';

  IF NOT v_security_definer THEN
    RAISE EXCEPTION
      'Migration failed: atomic_increment_ai_budget is not SECURITY DEFINER';
  END IF;

  IF v_proconfig IS NULL OR NOT (v_proconfig::TEXT LIKE '%search_path=public, pg_temp%') THEN
    RAISE EXCEPTION
      'Migration failed: atomic_increment_ai_budget missing locked search_path (Lesson #66). proconfig: %',
      v_proconfig;
  END IF;

  -- service_role has EXECUTE; PUBLIC/anon/authenticated do NOT
  IF NOT has_function_privilege(
    'service_role',
    'atomic_increment_ai_budget(UUID, INTEGER)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'Migration failed: service_role missing EXECUTE on atomic_increment_ai_budget';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'atomic_increment_ai_budget(UUID, INTEGER)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'Migration failed: authenticated has unexpected EXECUTE on atomic_increment_ai_budget (Lesson #52)';
  END IF;

  RAISE NOTICE
    'Migration phase_5_2_atomic_ai_budget_increment applied OK: 1 SECURITY DEFINER function with locked search_path + service_role-only EXECUTE';
END $$;
