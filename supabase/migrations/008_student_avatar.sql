-- Migration 008: Student Avatar
-- Adds avatar_url column to students table for profile pictures

ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
