-- Migration 074: Document 'moderation_hold' as valid processing_status
-- Phase 6C: Ingestion pipeline upload-level safety scan
--
-- content_items.processing_status is TEXT with no CHECK constraint
-- (migration 063). Valid values: pending, processing, completed, failed,
-- and now 'moderation_hold' (set when upload-level safety scan flags content).
--
-- This migration adds a partial index for efficient lookup of held items,
-- matching the pattern used for other processing_status values in 063.

CREATE INDEX IF NOT EXISTS idx_content_items_moderation_hold
  ON content_items(created_at DESC)
  WHERE processing_status = 'moderation_hold';
