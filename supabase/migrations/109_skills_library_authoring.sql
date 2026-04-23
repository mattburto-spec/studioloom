-- =====================================================================
-- 109_skills_library_authoring.sql
-- Skills Library Phase S2A — teacher authoring
--
-- Adds the authoring surface to skill_cards:
--   - forked_from column: provenance for teacher-forked copies (from a
--     built-in or another teacher's card). S2A writes this as NULL on
--     new cards; S2B introduces the Fork action that sets it.
--   - Teacher-write RLS: INSERT/UPDATE/DELETE scoped to the card's
--     `created_by_teacher_id = auth.uid()`. Built-in cards
--     (is_built_in = true) remain locked — only service role can edit.
--
-- Mirrors the INSERT/UPDATE/DELETE policy shape already in use on
-- `badges` and `activity_blocks`. S1 left authenticated reads open on
-- published rows + own drafts (see 105); this migration only adds
-- write-side policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. forked_from column
-- ---------------------------------------------------------------------
ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS forked_from uuid
  REFERENCES skill_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS skill_cards_forked_from_idx
  ON skill_cards(forked_from) WHERE forked_from IS NOT NULL;

COMMENT ON COLUMN skill_cards.forked_from IS
  'S2B: if this card was forked from a built-in or another teacher''s card, the source id. NULL for originals.';

-- ---------------------------------------------------------------------
-- 2. Teacher-write RLS on skill_cards
-- ---------------------------------------------------------------------
-- Teachers can INSERT cards they own (created_by_teacher_id = auth.uid()).
-- Built-in cards cannot be inserted through this policy — is_built_in must
-- be false on insert via RLS check. Service role bypasses RLS for seeding.
DROP POLICY IF EXISTS skill_cards_teacher_insert ON skill_cards;
CREATE POLICY skill_cards_teacher_insert ON skill_cards
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_teacher_id = auth.uid()
    AND is_built_in = false
  );

-- Teachers can UPDATE their own non-built-in cards.
DROP POLICY IF EXISTS skill_cards_teacher_update ON skill_cards;
CREATE POLICY skill_cards_teacher_update ON skill_cards
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND created_by_teacher_id = auth.uid()
    AND is_built_in = false
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_teacher_id = auth.uid()
    AND is_built_in = false
  );

-- Teachers can DELETE their own non-built-in cards.
DROP POLICY IF EXISTS skill_cards_teacher_delete ON skill_cards;
CREATE POLICY skill_cards_teacher_delete ON skill_cards
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND created_by_teacher_id = auth.uid()
    AND is_built_in = false
  );

-- ---------------------------------------------------------------------
-- 3. Teacher-write RLS on skill_card_tags
-- ---------------------------------------------------------------------
-- Teachers can manage tags on their own cards (any INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS skill_card_tags_teacher_write ON skill_card_tags;
CREATE POLICY skill_card_tags_teacher_write ON skill_card_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_card_tags.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_card_tags.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  );

-- ---------------------------------------------------------------------
-- 4. Teacher-write RLS on skill_prerequisites
-- ---------------------------------------------------------------------
-- Teachers can manage prereqs on their own cards. The prerequisite target
-- can be any readable card (built-in or own) — that's validated at app
-- layer via readable skill_cards_read_published policy.
DROP POLICY IF EXISTS skill_prerequisites_teacher_write ON skill_prerequisites;
CREATE POLICY skill_prerequisites_teacher_write ON skill_prerequisites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_prerequisites.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_prerequisites.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  );

-- ---------------------------------------------------------------------
-- 5. Teacher-write RLS on skill_external_links
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS skill_external_links_teacher_write ON skill_external_links;
CREATE POLICY skill_external_links_teacher_write ON skill_external_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_external_links.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_cards c
      WHERE c.id = skill_external_links.skill_id
        AND c.created_by_teacher_id = auth.uid()
        AND c.is_built_in = false
    )
  );

COMMENT ON POLICY skill_cards_teacher_insert   ON skill_cards
  IS 'S2A: teachers insert their own non-built-in cards. Service role bypasses.';
COMMENT ON POLICY skill_cards_teacher_update   ON skill_cards
  IS 'S2A: teachers edit their own non-built-in cards.';
COMMENT ON POLICY skill_cards_teacher_delete   ON skill_cards
  IS 'S2A: teachers delete their own non-built-in cards.';
