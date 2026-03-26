-- Migration 049: Class Gallery & Peer Review
-- Three tables for the gallery round → submission → review workflow.
-- Supports effort-gated feedback (students must review min_reviews before seeing own feedback).

-- ═══════════════════════════════════════════════════════════════════════
-- gallery_rounds — teacher-created critique sessions
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gallery_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  page_ids TEXT[] NOT NULL DEFAULT '{}',
  review_format TEXT NOT NULL DEFAULT 'comment',  -- 'comment', 'pmi', 'two-stars-wish', or a tool_id
  min_reviews INTEGER NOT NULL DEFAULT 3,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_rounds_class ON gallery_rounds(class_id, status);
CREATE INDEX IF NOT EXISTS idx_gallery_rounds_unit ON gallery_rounds(unit_id);
CREATE INDEX IF NOT EXISTS idx_gallery_rounds_teacher ON gallery_rounds(teacher_id);

-- RLS
ALTER TABLE gallery_rounds ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own rounds
CREATE POLICY "Teachers manage own gallery rounds"
  ON gallery_rounds FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Students can read open rounds for their class (enforced at API level via class_students junction)
CREATE POLICY "Students read open gallery rounds"
  ON gallery_rounds FOR SELECT
  USING (status = 'open');

-- ═══════════════════════════════════════════════════════════════════════
-- gallery_submissions — student work snapshots shared to a round
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gallery_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES gallery_rounds(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  context_note TEXT DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_submissions_round ON gallery_submissions(round_id);
CREATE INDEX IF NOT EXISTS idx_gallery_submissions_student ON gallery_submissions(student_id);

-- RLS
ALTER TABLE gallery_submissions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own submissions
CREATE POLICY "Students insert own submissions"
  ON gallery_submissions FOR INSERT
  WITH CHECK (student_id = student_id);  -- enforced at API level

-- Students can read submissions in rounds they have access to
CREATE POLICY "Students read gallery submissions"
  ON gallery_submissions FOR SELECT
  USING (true);  -- filtered at API level via class membership

-- Teachers can read all submissions
CREATE POLICY "Teachers read all submissions"
  ON gallery_submissions FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- gallery_reviews — peer feedback on submissions
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gallery_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES gallery_submissions(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES gallery_rounds(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  review_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate reviews (one review per reviewer per submission)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_reviews_unique
  ON gallery_reviews(submission_id, reviewer_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_reviews_submission ON gallery_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_gallery_reviews_reviewer ON gallery_reviews(reviewer_id, round_id);
CREATE INDEX IF NOT EXISTS idx_gallery_reviews_round ON gallery_reviews(round_id);

-- RLS
ALTER TABLE gallery_reviews ENABLE ROW LEVEL SECURITY;

-- Students can insert reviews
CREATE POLICY "Students insert reviews"
  ON gallery_reviews FOR INSERT
  WITH CHECK (true);  -- enforced at API level

-- Students can read reviews (effort-gated at API level — only see own submission's reviews after min_reviews)
CREATE POLICY "Students read reviews"
  ON gallery_reviews FOR SELECT
  USING (true);

-- Teachers can read all reviews
CREATE POLICY "Teachers read all reviews"
  ON gallery_reviews FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- Triggers
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE TRIGGER set_gallery_rounds_updated_at
  BEFORE UPDATE ON gallery_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
