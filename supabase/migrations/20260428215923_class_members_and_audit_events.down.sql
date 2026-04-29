-- Rollback for: class_members_and_audit_events
-- Pairs with: 20260428215923_class_members_and_audit_events.sql
-- Phase: Access Model v2 Phase 0.7a

DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS class_members CASCADE;
