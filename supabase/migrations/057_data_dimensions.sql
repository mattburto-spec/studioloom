-- Migration 057: Project Dimensions — Data Architecture v2
-- Adds multilingual, inclusivity, and materials fields to units + classes tables.
-- All TypeScript-level fields (bloom_level, ai_rules, timeWeight, udl_checkpoints, etc.)
-- live inside content_data JSONB and do NOT need migration — only interface updates.
-- This migration only adds columns that need to be queryable at the SQL level.

-- ============================================================
-- UNITS table — content language, inclusivity notes, materials
-- ============================================================

ALTER TABLE units ADD COLUMN IF NOT EXISTS content_language TEXT DEFAULT 'en';
ALTER TABLE units ADD COLUMN IF NOT EXISTS inclusivity_notes JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS materials_list JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS learning_outcomes JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sdg_tags TEXT[] DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cross_curricular_links TEXT[] DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS prerequisite_knowledge TEXT[] DEFAULT NULL;

COMMENT ON COLUMN units.content_language IS 'ISO 639-1 language code for unit content. Default en.';
COMMENT ON COLUMN units.inclusivity_notes IS 'Unit-level accessibility considerations: physical_requirements, sensory_notes, alternative_activities.';
COMMENT ON COLUMN units.materials_list IS 'Structured materials list: [{name, quantity_per_student, unit_cost, category, alternatives}].';
COMMENT ON COLUMN units.learning_outcomes IS 'Explicit learning outcomes: [{outcome, bloom_level, measurable}].';
COMMENT ON COLUMN units.sdg_tags IS 'UN Sustainable Development Goals (1-17). Especially for Service/PP types.';
COMMENT ON COLUMN units.cross_curricular_links IS 'Subject areas this unit connects to.';
COMMENT ON COLUMN units.prerequisite_knowledge IS 'What students should know before starting this unit.';

-- ============================================================
-- CLASSES table — instruction language, additional languages
-- ============================================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS instruction_language TEXT DEFAULT 'en';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS additional_languages TEXT[] DEFAULT NULL;

COMMENT ON COLUMN classes.instruction_language IS 'Primary language of instruction. ISO 639-1 code. Default en.';
COMMENT ON COLUMN classes.additional_languages IS 'Additional languages students may need support in. ISO 639-1 codes.';

-- ============================================================
-- Indexes for queryable fields
-- ============================================================

-- Content language index (for future "show all units in Mandarin" queries)
CREATE INDEX IF NOT EXISTS idx_units_content_language ON units(content_language);

-- SDG tags GIN index (for "find all units tagged SDG 13" queries)
CREATE INDEX IF NOT EXISTS idx_units_sdg_tags ON units USING GIN(sdg_tags);

-- Instruction language index
CREATE INDEX IF NOT EXISTS idx_classes_instruction_language ON classes(instruction_language);
