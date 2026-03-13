-- ============================================================
-- Migration 022: Student Design Assistant
-- Conversation storage for the Socratic design mentor (Layer 3)
-- ============================================================

-- Conversation sessions — one per student per page visit
CREATE TABLE IF NOT EXISTS design_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id TEXT,                           -- which page they're on
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  turn_count INT NOT NULL DEFAULT 0,
  bloom_level SMALLINT NOT NULL DEFAULT 1,  -- 1-6, adapts per conversation
  effort_score SMALLINT NOT NULL DEFAULT 5, -- tracks student effort (3-strike system)
  summary TEXT,                             -- AI-generated conversation summary
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual conversation turns
CREATE TABLE IF NOT EXISTS design_conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES design_conversations(id) ON DELETE CASCADE,
  turn_number INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'assistant')),
  content TEXT NOT NULL,
  question_type TEXT,                     -- Richard Paul's 6 question types
  bloom_level SMALLINT,                   -- cognitive level of this turn
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_design_conversations_student
  ON design_conversations(student_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_design_conversations_page
  ON design_conversations(unit_id, page_id);

CREATE INDEX IF NOT EXISTS idx_design_conversation_turns_conversation
  ON design_conversation_turns(conversation_id, turn_number);

-- RLS policies
ALTER TABLE design_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_conversation_turns ENABLE ROW LEVEL SECURITY;

-- Students can read/write their own conversations
CREATE POLICY "Students can manage own conversations"
  ON design_conversations
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Students can read/write turns in their own conversations
CREATE POLICY "Students can manage own conversation turns"
  ON design_conversation_turns
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM design_conversations WHERE student_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM design_conversations WHERE student_id = auth.uid()
    )
  );

-- Teachers can read conversations for students in their classes
CREATE POLICY "Teachers can read student conversations"
  ON design_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.teacher_id = auth.uid()
      AND c.id IN (
        SELECT class_id FROM students s WHERE s.id = design_conversations.student_id
      )
    )
  );

CREATE POLICY "Teachers can read conversation turns"
  ON design_conversation_turns
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT dc.id FROM design_conversations dc
      JOIN students s ON s.id = dc.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );
