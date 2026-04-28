-- Rollback for: ai_budgets_and_state
-- Pairs with: 20260428220303_ai_budgets_and_state.sql
-- Phase: Access Model v2 Phase 0.7b

DROP TABLE IF EXISTS ai_budget_state CASCADE;
DROP TABLE IF EXISTS ai_budgets CASCADE;
