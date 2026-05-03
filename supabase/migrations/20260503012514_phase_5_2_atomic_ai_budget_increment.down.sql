-- Rollback for: phase_5_2_atomic_ai_budget_increment
-- Pairs with: 20260503012514_phase_5_2_atomic_ai_budget_increment.sql

DROP FUNCTION IF EXISTS atomic_increment_ai_budget(UUID, INTEGER);
