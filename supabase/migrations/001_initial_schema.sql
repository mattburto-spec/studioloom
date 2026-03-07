-- Questerra Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================================
-- TABLES
-- ============================================================

-- Teachers profile (extends Supabase auth.users)
CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Classes managed by teachers
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Students belong to a class (no auth.users entry — custom session)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  display_name TEXT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  ell_level INTEGER NOT NULL DEFAULT 3 CHECK (ell_level BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(username, class_id)
);

-- Custom session tokens for students (no-password auth)
CREATE TABLE student_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Units (design cycle content)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Which units are assigned to which classes
CREATE TABLE class_units (
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  locked_pages INTEGER[] DEFAULT '{}',
  PRIMARY KEY (class_id, unit_id)
);

-- Student progress per page per unit
CREATE TABLE student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 16),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  responses JSONB DEFAULT '{}',
  time_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, unit_id, page_number)
);

-- Planning tool tasks
CREATE TABLE planning_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  target_date DATE,
  actual_date DATE,
  time_logged INTEGER DEFAULT 0,
  page_number INTEGER CHECK (page_number BETWEEN 1 AND 16),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_classes_code ON classes(code);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_student_sessions_token ON student_sessions(token);
CREATE INDEX idx_student_sessions_expires ON student_sessions(expires_at);
CREATE INDEX idx_student_progress_student_unit ON student_progress(student_id, unit_id);
CREATE INDEX idx_planning_tasks_student_unit ON planning_tasks(student_id, unit_id);

-- ============================================================
-- AUTO-CREATE TEACHER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_teacher()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_teacher();

-- ============================================================
-- AUTO-UPDATE updated_at ON PROGRESS CHANGES
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_progress_updated_at
  BEFORE UPDATE ON student_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_tasks ENABLE ROW LEVEL SECURITY;

-- Teachers: can read/update own profile
CREATE POLICY "Teachers read own profile"
  ON teachers FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Teachers update own profile"
  ON teachers FOR UPDATE
  USING (auth.uid() = id);

-- Classes: teachers CRUD their own classes
CREATE POLICY "Teachers manage own classes"
  ON classes FOR ALL
  USING (auth.uid() = teacher_id);

-- Students: teachers manage students in their classes
CREATE POLICY "Teachers manage students in their classes"
  ON students FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

-- Student sessions: managed by service role only (no RLS policy needed for normal users)
-- The admin client bypasses RLS

-- Units: readable by all authenticated users, writable by teachers
CREATE POLICY "Anyone can read units"
  ON units FOR SELECT
  USING (true);

CREATE POLICY "Service role manages units"
  ON units FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Class units: teachers manage their class assignments
CREATE POLICY "Teachers manage class units"
  ON class_units FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Read class units"
  ON class_units FOR SELECT
  USING (true);

-- Student progress: managed via service role (students don't have auth.uid())
-- Teachers can read progress for their students
CREATE POLICY "Teachers read student progress"
  ON student_progress FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Planning tasks: same pattern as progress
CREATE POLICY "Teachers read planning tasks"
  ON planning_tasks FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );
