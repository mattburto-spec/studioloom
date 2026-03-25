-- Migration 045: Add framework column to classes
-- Supports: myp_design (default), service_learning, pyp_exhibition, personal_project, custom
ALTER TABLE classes ADD COLUMN IF NOT EXISTS framework TEXT NOT NULL DEFAULT 'myp_design';
