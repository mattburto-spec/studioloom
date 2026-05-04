-- Rollback for: school_collections_and_guardians
-- Pairs with: 20260428214009_school_collections_and_guardians.sql
-- Phase: Access Model v2 Phase 0.6a
--
-- Drop in dependency-reverse order. Indexes + policies + RLS state
-- drop with CASCADE on the table.

DROP TABLE IF EXISTS student_guardians CASCADE;
DROP TABLE IF EXISTS school_resource_relations CASCADE;
DROP TABLE IF EXISTS guardians CASCADE;
DROP TABLE IF EXISTS school_resources CASCADE;
