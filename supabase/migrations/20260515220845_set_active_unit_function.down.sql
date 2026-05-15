-- Rollback for: set_active_unit_function
-- Pairs with: 20260515220845_set_active_unit_function.sql

DROP FUNCTION IF EXISTS public.set_active_unit(uuid, uuid);
