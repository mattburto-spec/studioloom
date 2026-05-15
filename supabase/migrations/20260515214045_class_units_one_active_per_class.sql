-- Migration: class_units_one_active_per_class
-- Created: 20260515214045 UTC
--
-- WHY: Enforce at the DB level that a class can have at most one active unit
-- assigned at a time. Today the schema permits multiple class_units rows with
-- is_active = true per class, and most application code silently assumes one —
-- the load-bearing kind of ambiguity that breeds silent bugs (Lesson #39 /
-- FU-X family). With this constraint, /teacher/classes/[classId] can
-- deterministically pick the active unit, the cockpit "current unit" per
-- class is unambiguous, and student-side routing via Unit.unit_type becomes
-- well-defined. See docs/decisions-log.md "One active unit per class enforced
-- at DB level" (16 May 2026).
--
-- IMPACT: New partial unique index `class_units_one_active_per_class` on
-- class_units(class_id) WHERE is_active = true. No data change. Prod audit
-- on 16 May 2026 confirmed zero classes currently hold multiple is_active=true
-- rows, so this applies without reconciliation. After this constraint lands,
-- callers that blindly upsert is_active=true (toggleUnit, toggleClassAssignment)
-- will start hitting 23505 unique_violation when a different unit is already
-- active for the class — the atomic setActiveUnit helper that fixes those
-- callers ships in a separate phase.
--
-- ROLLBACK: paired .down.sql drops the index.

CREATE UNIQUE INDEX class_units_one_active_per_class
  ON class_units (class_id) WHERE is_active = true;
