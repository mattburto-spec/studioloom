-- Migration 094: Seed 12 system-template machine profiles
--
-- Preflight Phase 1A-2. Inserts the 12 common school machines from the
-- machine-profile-defaults-v0 draft as system templates (teacher_id IS NULL,
-- is_system_template = true). Teachers clone these on first visit to the
-- machine profile settings page.
--
-- Idempotent via the partial unique index
--   uq_machine_profiles_system_template_name ON (name) WHERE is_system_template
-- defined in migration 093. Re-running is safe; subsequent runs are no-ops.
--
-- Refs:
--   - Defaults:     docs/projects/fabrication/machine-profile-defaults-v0.md
--   - Decisions:    docs/projects/fabrication/phase-0-decisions.md (D-10)
--   - Spec:         docs/projects/fabrication-pipeline.md §7
--   - Brief:        docs/projects/preflight-phase-1a-brief.md (1A-2)
--   - Lessons:      #36 (deterministic data), #38 (assert expected values)
--
-- VERIFY status: Many fields carry `# VERIFY` markers in the v0 doc — Matt
-- has not yet walked manufacturer sheets row-by-row (Phase 0 sub-task 0.3
-- compressed to "looks ok"). Any corrections land as a subsequent UPDATE-
-- only migration (e.g. 094a), never as an in-place edit to 094.

INSERT INTO machine_profiles (
  teacher_id, school_id, is_system_template, name, machine_category, machine_model,
  bed_size_x_mm, bed_size_y_mm, bed_size_z_mm,
  nozzle_diameter_mm, supported_materials, max_print_time_min, supports_auto_supports,
  kerf_mm, operation_color_map, min_feature_mm,
  notes
) VALUES

  -- ============================================================
  -- 3D Printers (6)
  -- ============================================================

  ( NULL, NULL, true, 'Bambu Lab X1 Carbon', '3d_printer', 'X1 Carbon',
    256, 256, 256,
    0.4, '["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC"]'::jsonb, 1440, true,
    NULL, NULL, NULL,
    'Default Bambu school choice post-2024. Chamber + hardened nozzle unlocks broader materials than Prusa.'
  ),

  ( NULL, NULL, true, 'Bambu Lab P1S', '3d_printer', 'P1S',
    256, 256, 256,
    0.4, '["PLA", "PETG", "ABS", "ASA", "TPU"]'::jsonb, 1440, true,
    NULL, NULL, NULL,
    'Budget Bambu — similar volume to X1C, no built-in AI camera. Very common in UK/AU schools.'
  ),

  ( NULL, NULL, true, 'Prusa MK4S', '3d_printer', 'MK4S',
    250, 210, 220,
    0.4, '["PLA", "PETG", "ASA", "PC", "PA"]'::jsonb, 1440, true,
    NULL, NULL, NULL,
    'Prusa MK3S+ still widespread in older school labs — same bed footprint; add as separate profile if needed.'
  ),

  ( NULL, NULL, true, 'Creality Ender 3 V2', '3d_printer', 'Ender 3 V2',
    220, 220, 250,
    0.4, '["PLA", "PETG", "TPU"]'::jsonb, 720, false,
    NULL, NULL, NULL,
    'Budget classroom workhorse. Variants S1/S1 Pro share this bed footprint.'
  ),

  ( NULL, NULL, true, 'Ultimaker S3', '3d_printer', 'S3',
    230, 190, 200,
    0.4, '["PLA", "PETG", "ABS", "CPE", "TPU", "PC", "Nylon"]'::jsonb, 1440, true,
    NULL, NULL, NULL,
    'Ultimaker S5 bed is larger (330x240x300) — add separately if pilot school has one.'
  ),

  ( NULL, NULL, true, 'Makerbot Replicator+', '3d_printer', 'Replicator+',
    295, 195, 165,
    0.4, '["PLA"]'::jsonb, 720, true,
    NULL, NULL, NULL,
    'Older/legacy in many US schools. Consider dropping from v1 seed if no pilot school uses it.'
  ),

  -- ============================================================
  -- Laser Cutters (6)
  -- Operation colour map encodes the most common DT-teacher convention;
  -- teachers can override per-profile via rule_overrides or by duplicating
  -- the profile and editing the map.
  -- ============================================================

  ( NULL, NULL, true, 'Glowforge Pro', 'laser_cutter', 'Pro',
    495, 279, NULL,
    NULL, NULL, NULL, NULL,
    0.2, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.3,
    'Glowforge app differentiates by layer; these stroke-colour defaults mirror the convention most DT labs teach.'
  ),

  ( NULL, NULL, true, 'Glowforge Plus', 'laser_cutter', 'Plus',
    495, 279, NULL,
    NULL, NULL, NULL, NULL,
    0.2, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.3,
    'No pass-through slot (vs Pro) — bed-size limit is hard. Scanning behaviour otherwise identical.'
  ),

  ( NULL, NULL, true, 'xTool M1', 'laser_cutter', 'M1',
    385, 300, NULL,
    NULL, NULL, NULL, NULL,
    0.15, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.2,
    '10W diode — tighter kerf than CO2 on thin materials. Hybrid blade operations out of scope for v1.'
  ),

  ( NULL, NULL, true, 'xTool P2', 'laser_cutter', 'P2',
    600, 308, NULL,
    NULL, NULL, NULL, NULL,
    0.2, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.3,
    '55W CO2 — larger bed than Glowforge, cleaner cuts on acrylic. Rising popularity in DT labs 2025+.'
  ),

  ( NULL, NULL, true, 'xTool S1', 'laser_cutter', 'S1',
    498, 319, NULL,
    NULL, NULL, NULL, NULL,
    0.15, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.2,
    'Enclosed diode — safer for classrooms than open-frame. 40W variant handles thicker materials.'
  ),

  ( NULL, NULL, true, 'Gweike Cloud Pro', 'laser_cutter', 'Cloud Pro',
    500, 300, NULL,
    NULL, NULL, NULL, NULL,
    0.2, '{"#FF0000": "cut", "#0000FF": "score", "#000000": "engrave"}'::jsonb, 0.3,
    '50W CO2 — budget alternative to Glowforge/xTool P2. Popular in UK/EU school budgets.'
  )

ON CONFLICT (name) WHERE is_system_template = true DO NOTHING;

-- ============================================================
-- Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- Skipping the DO $$ verify block that migration 093 had — Supabase dashboard
-- parser issue (see migration 093 fix commit). Run these instead:
--
--   SELECT COUNT(*) FROM machine_profiles WHERE is_system_template = true;
--   -- Expect: 12
--
--   SELECT machine_category, COUNT(*) FROM machine_profiles
--   WHERE is_system_template = true GROUP BY machine_category ORDER BY machine_category;
--   -- Expect: 3d_printer | 6, laser_cutter | 6
--
--   SELECT name, machine_category, bed_size_x_mm, bed_size_y_mm, nozzle_diameter_mm, kerf_mm
--   FROM machine_profiles WHERE is_system_template = true ORDER BY machine_category, name;
--   -- Expect: 12 rows with sensible values — 3D printers have nozzle set + kerf null,
--   -- lasers have kerf set + nozzle null.
