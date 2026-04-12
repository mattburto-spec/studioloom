# Phase 3R — Seed Test Signal SQL

Run these in Supabase SQL Editor AFTER R1+R2 are done, BEFORE Checkpoints 3.1 and 3.2.

## Step 1: Pick 3 blocks to seed signal on

```sql
-- Find 3 blocks with source_unit_id (so student_progress join works)
SELECT id, title, source_unit_id, source_page_id, efficacy_score, times_used
FROM activity_blocks
WHERE source_unit_id IS NOT NULL
LIMIT 3;
```

Copy the 3 block IDs. Replace `<BLOCK_1>`, `<BLOCK_2>`, `<BLOCK_3>` below.

## Step 2: Bump times_used so blocks are eligible for efficacy computation

```sql
UPDATE activity_blocks
SET times_used = 5
WHERE id IN ('<BLOCK_1>', '<BLOCK_2>', '<BLOCK_3>');
```

## Step 3: Seed generation_feedback rows (teacher edit signal)

This simulates: Block 1 was kept 4/5 times, Block 2 was deleted 3/5 times, Block 3 was rewritten 4/5 times.

```sql
-- Block 1: mostly kept (high efficacy expected)
INSERT INTO generation_feedback (generation_run_id, unit_id, activity_id, source_block_id, edit_type, diff_percentage)
VALUES
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_1>'), 'seed_a1', '<BLOCK_1>', 'kept', 0),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_1>'), 'seed_a2', '<BLOCK_1>', 'kept', 0),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_1>'), 'seed_a3', '<BLOCK_1>', 'kept', 2),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_1>'), 'seed_a4', '<BLOCK_1>', 'kept', 1),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_1>'), 'seed_a5', '<BLOCK_1>', 'rewritten', 45);

-- Block 2: mostly deleted (low efficacy expected)
INSERT INTO generation_feedback (generation_run_id, unit_id, activity_id, source_block_id, edit_type, diff_percentage)
VALUES
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_2>'), 'seed_b1', '<BLOCK_2>', 'deleted', 100),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_2>'), 'seed_b2', '<BLOCK_2>', 'deleted', 100),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_2>'), 'seed_b3', '<BLOCK_2>', 'deleted', 100),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_2>'), 'seed_b4', '<BLOCK_2>', 'kept', 0),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_2>'), 'seed_b5', '<BLOCK_2>', 'kept', 3);

-- Block 3: mostly rewritten (medium-low efficacy expected)
INSERT INTO generation_feedback (generation_run_id, unit_id, activity_id, source_block_id, edit_type, diff_percentage)
VALUES
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_3>'), 'seed_c1', '<BLOCK_3>', 'rewritten', 65),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_3>'), 'seed_c2', '<BLOCK_3>', 'rewritten', 50),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_3>'), 'seed_c3', '<BLOCK_3>', 'rewritten', 72),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_3>'), 'seed_c4', '<BLOCK_3>', 'rewritten', 40),
  (gen_random_uuid(), (SELECT source_unit_id FROM activity_blocks WHERE id = '<BLOCK_3>'), 'seed_c5', '<BLOCK_3>', 'kept', 5);
```

## Step 4: Verify seed

```sql
SELECT source_block_id, edit_type, count(*)
FROM generation_feedback
GROUP BY source_block_id, edit_type
ORDER BY source_block_id, edit_type;
```

Expected: Block 1 has 4 kept + 1 rewritten. Block 2 has 3 deleted + 2 kept. Block 3 has 4 rewritten + 1 kept.

## Step 5: Verify efficacy expectations

After running the efficacy script, the proposals should show:

| Block | Expected direction | Why |
|---|---|---|
| Block 1 (mostly kept) | Score ≈ 60-70 (up from 50) | 80% kept rate, low edit/deletion |
| Block 2 (mostly deleted) | Score ≈ 25-35 (down from 50) | 60% deletion rate tanks the score |
| Block 3 (mostly rewritten) | Score ≈ 35-45 (down from 50) | 80% edit rate + low kept rate |

If the proposals don't match these directions, something is wrong with the signal aggregation.

## R5: Cascade delete verification

After seeding, verify cascade works:

```sql
-- Create a throwaway block
INSERT INTO activity_blocks (id, teacher_id, title, prompt, source_type)
VALUES ('00000000-0000-0000-0000-000000000099', (SELECT id FROM auth.users LIMIT 1), 'CASCADE TEST', 'test', 'seed');

-- Create a proposal referencing it
INSERT INTO feedback_proposals (block_id, proposal_type, field, current_value, proposed_value, evidence_count, status)
VALUES ('00000000-0000-0000-0000-000000000099', 'efficacy_adjustment', 'efficacy_score', 50, 60, 5, 'pending');

-- Create an audit log referencing it
INSERT INTO feedback_audit_log (proposal_id, block_id, action, field, evidence_count)
VALUES ((SELECT id FROM feedback_proposals WHERE block_id = '00000000-0000-0000-0000-000000000099'), '00000000-0000-0000-0000-000000000099', 'approved', 'efficacy_score', 5);

-- Now delete the block
DELETE FROM activity_blocks WHERE id = '00000000-0000-0000-0000-000000000099';

-- Verify cascade — both should return 0 rows
SELECT count(*) AS orphaned_proposals FROM feedback_proposals WHERE block_id = '00000000-0000-0000-0000-000000000099';
SELECT count(*) AS orphaned_audit FROM feedback_audit_log WHERE block_id = '00000000-0000-0000-0000-000000000099';
```

Both should return 0. If they return 1, the cascade didn't work and migration 070 needs investigation.
