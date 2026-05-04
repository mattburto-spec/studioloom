-- Rollback for: phase_4_2_school_domains
-- Pairs with: 20260502031121_phase_4_2_school_domains.sql
--
-- Order: drop functions first (they reference the table indirectly via
-- their bodies; Postgres allows dropping a function whose body
-- references a missing table, but cleanup is tidier this way), then
-- drop the table (CASCADE not needed — RLS policies + indexes drop
-- with the table).
--
-- school_domains rows are lost on rollback. No dependent data.

DROP FUNCTION IF EXISTS public.lookup_school_by_domain(TEXT);
DROP FUNCTION IF EXISTS public.is_free_email_domain(TEXT);
DROP TABLE IF EXISTS school_domains;
