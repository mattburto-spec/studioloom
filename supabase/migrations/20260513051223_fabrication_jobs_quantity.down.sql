-- Rollback for: fabrication_jobs_quantity
-- Pairs with: 20260513051223_fabrication_jobs_quantity.sql

-- Safety guard: refuse to drop if any row has quantity > 1
-- (real student submission would silently downgrade to 1 copy).
DO $$
DECLARE
  v_real_count INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fabrication_jobs'
      AND column_name = 'quantity'
  ) THEN
    SELECT COUNT(*) INTO v_real_count
    FROM fabrication_jobs
    WHERE quantity > 1;
    IF v_real_count > 0 THEN
      RAISE EXCEPTION 'Rollback refused: % fabrication_jobs rows have quantity > 1. '
                      'Reset to 1 first if intentional.', v_real_count;
    END IF;
  END IF;
END $$;

ALTER TABLE fabrication_jobs DROP COLUMN IF EXISTS quantity;
