-- Migration 032: Fix competency_assessments.page_id type
-- Page IDs in StudioLoom are nanoid(8) strings stored in JSONB, not UUIDs.
-- Change page_id from UUID to TEXT to match the actual page ID format.

ALTER TABLE competency_assessments ALTER COLUMN page_id TYPE TEXT USING page_id::TEXT;
