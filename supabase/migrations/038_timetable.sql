-- Migration 038: Timetable & Scheduling System
--
-- Adds rotating cycle timetable support for international schools.
-- Two tables: school_timetable (cycle config per teacher) and
-- class_meetings (which cycle days each class meets).
--
-- PIPL-safe: stores only schedule data (cycle days, periods, rooms).
-- Never imports or stores student identity data.
--
-- Depends on: migration 037 (school_calendar_terms for term dates)

-- ═══════════════════════════════════════════════════════════════
-- 1. SCHOOL_TIMETABLE — per-teacher cycle configuration
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS school_timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Cycle configuration
  cycle_length INT NOT NULL DEFAULT 5 CHECK (cycle_length BETWEEN 2 AND 20),
  cycle_type TEXT NOT NULL DEFAULT 'weekday' CHECK (cycle_type IN ('weekday', 'calendar')),
  anchor_date DATE NOT NULL DEFAULT CURRENT_DATE,
  anchor_cycle_day INT NOT NULL DEFAULT 1,

  -- Whether cycle resets at each term start (Day 1) or continues across terms
  reset_each_term BOOLEAN NOT NULL DEFAULT false,

  -- Period definitions (optional — for display purposes)
  -- Format: [{ "number": 1, "label": "Period 1", "start": "08:30", "end": "09:30" }, ...]
  periods JSONB DEFAULT '[]'::jsonb,

  -- Non-school days (holidays, PD days, etc.)
  -- Format: ["2026-04-05", "2026-04-06", ...]
  excluded_dates JSONB DEFAULT '[]'::jsonb,

  -- iCal import metadata (for Tier 1 upgrade)
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ical')),
  ical_url TEXT,
  last_synced_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One timetable per teacher
  UNIQUE(teacher_id),

  -- anchor_cycle_day must be within cycle range
  CHECK (anchor_cycle_day >= 1 AND anchor_cycle_day <= cycle_length)
);

-- ═══════════════════════════════════════════════════════════════
-- 2. CLASS_MEETINGS — when each class meets in the cycle
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS class_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID REFERENCES school_timetable(id) ON DELETE CASCADE NOT NULL,
  class_id TEXT NOT NULL,                       -- references classes table (TEXT, not UUID)
  cycle_day INT NOT NULL CHECK (cycle_day >= 1),
  period_number INT,                            -- which period (optional)
  room TEXT,                                    -- room name/number (optional)

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Each class meets at most once per cycle day per period
  UNIQUE(timetable_id, class_id, cycle_day, period_number)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE school_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_meetings ENABLE ROW LEVEL SECURITY;

-- school_timetable: teachers see only their own
CREATE POLICY "Teachers read own timetable" ON school_timetable
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers create own timetable" ON school_timetable
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers update own timetable" ON school_timetable
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers delete own timetable" ON school_timetable
  FOR DELETE USING (teacher_id = auth.uid());

CREATE POLICY "Service role full access timetable" ON school_timetable
  FOR ALL USING (auth.role() = 'service_role');

-- class_meetings: access via timetable ownership
CREATE POLICY "Teachers read own class meetings" ON class_meetings
  FOR SELECT USING (
    timetable_id IN (SELECT id FROM school_timetable WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers create own class meetings" ON class_meetings
  FOR INSERT WITH CHECK (
    timetable_id IN (SELECT id FROM school_timetable WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers update own class meetings" ON class_meetings
  FOR UPDATE USING (
    timetable_id IN (SELECT id FROM school_timetable WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Teachers delete own class meetings" ON class_meetings
  FOR DELETE USING (
    timetable_id IN (SELECT id FROM school_timetable WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Service role full access class meetings" ON class_meetings
  FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- 4. INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_school_timetable_teacher ON school_timetable(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_meetings_timetable ON class_meetings(timetable_id);
CREATE INDEX IF NOT EXISTS idx_class_meetings_class ON class_meetings(timetable_id, class_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. AUTO-UPDATE TRIGGER
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_school_timetable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_school_timetable_updated_at ON school_timetable;
CREATE TRIGGER trigger_school_timetable_updated_at
  BEFORE UPDATE ON school_timetable
  FOR EACH ROW
  EXECUTE FUNCTION update_school_timetable_updated_at();
