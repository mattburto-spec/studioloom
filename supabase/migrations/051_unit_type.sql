-- Migration 051: Add unit_type and curriculum_context to units table
-- unit_type: design, service, personal_project, inquiry
-- curriculum_context: free-text curriculum description for AI generation (Phase 0 of 4-dimension model)
-- Default: 'design' (all existing units are Design)

ALTER TABLE units
ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'design';

-- Validate unit_type values
ALTER TABLE units
ADD CONSTRAINT units_unit_type_check
CHECK (unit_type IN ('design', 'service', 'personal_project', 'inquiry'));

-- Free-text curriculum context — immediate AI improvement without requiring structured framework selection
-- Examples: "IB MYP Design Year 4", "GCSE D&T AQA", "Australian D&T Year 9", "PYP Exhibition Grade 5"
-- The AI uses this to adapt vocabulary, assessment language, and expectations.
ALTER TABLE units
ADD COLUMN IF NOT EXISTS curriculum_context TEXT;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_units_unit_type ON units(unit_type);

COMMENT ON COLUMN units.unit_type IS 'Unit pedagogical type: design (Design Cycle), service (IPARD), personal_project (PP Process), inquiry (Inquiry Cycle)';
COMMENT ON COLUMN units.curriculum_context IS 'Free-text curriculum description for AI generation context (e.g. "IB MYP Design Year 4", "GCSE D&T AQA")';
