# Dimensions3 Phase 3 — Gap Audit (12 Apr 2026)

## Execution Order

### Group A: Foundation Fixes (before Checkpoint 3.1)

1. **CASCADE DELETE migration** — New migration (070), add ON DELETE CASCADE to `feedback_proposals.block_id` and `feedback_audit_log.block_id`. Verify with real DELETE.
   - File: `supabase/migrations/070_feedback_cascade_delete.sql`
   - Spec ref: §5.1

2. **Remove auto-approve code path** — Spec says "No auto-accept anywhere." The POST handler in `/api/admin/feedback/route.ts` lines 121-163 has auto-approve logic. `DEFAULT_GUARDRAIL_CONFIG.autoApproveEnabled` is false so it's dormant, but the code path exists and violates the spec. Delete the auto-approve branch entirely.
   - File: `src/app/api/admin/feedback/route.ts`
   - Spec ref: §5.4 behaviour rules + §5.7 acceptance checklist

3. **Add `reasoning` JSONB to proposals** — Store the 6 formula input values (keptRate, completionRate, timeAccuracy, deletionRate, paceScore, editRate) in each proposal row so the UI can explain why. Currently `signal_breakdown` has 4 counts but not the 6 rate values.
   - Files: `src/lib/feedback/efficacy.ts` (efficacyToProposals), migration 064 already has JSONB columns
   - Spec ref: §5.2 required behaviour #3

4. **7-day rejection suppression** — When generating new proposals, skip blocks that have a rejected proposal within the last 7 days. Currently only checks for existing pending proposals.
   - File: `src/app/api/admin/feedback/route.ts` POST handler
   - Spec ref: §5.4 behaviour rules

5. **`scripts/run-efficacy-update.mjs`** — Standalone CLI script that calls the efficacy batch + writes proposals. Matt runs it manually until Phase 4 wires the scheduler.
   - File: `scripts/run-efficacy-update.mjs`
   - Spec ref: §5.2 trigger

### Group B: UI Enrichment (before Checkpoint 3.2)

6. **`<ProposalReasoning>`** — Render the 6 signal values from the `reasoning` JSONB as a human-readable explanation ("Kept in 6/8 units, 85% student completion, time accuracy 72%").
   - File: `src/components/admin/feedback/ProposalReasoning.tsx`
   - Spec ref: §5.4

7. **`<FeedbackDiff>`** — Before/after block JSON side-by-side with changed fields highlighted.
   - File: `src/components/admin/feedback/FeedbackDiff.tsx`
   - Spec ref: §5.4

8. **`<GuardrailWarning>`** — Red banner for `requires_manual_approval`, amber for tier boundary crossing (30 or 70).
   - File: `src/components/admin/feedback/GuardrailWarning.tsx`
   - Spec ref: §5.4

9. **`<BatchActions>`** — Multi-select proposals, batch accept/reject. Batch reject requires a reason.
   - File: `src/components/admin/feedback/BatchActions.tsx` + wire into ApprovalQueue
   - Spec ref: §5.4

10. **`<AuditLogTab>`** — Read and render `feedback_audit_log` with who/when/why.
    - File: `src/components/admin/feedback/AuditLogTab.tsx`
    - Spec ref: §5.4

### Group C: Verification

11. **Grep check** — No direct `activity_blocks.efficacy_score` writes outside the PATCH accept handler.
12. **Edit tracker wiring audit** — Verify drag/drop reorders go through the same content save API that calls `trackEdits()`.
13. **Test suite** — tsc clean on touched files, existing feedback tests still pass, new tests for reasoning JSONB.

## What's Already Built (no work needed)

- Migration 064: `generation_feedback`, `feedback_proposals`, `feedback_audit_log` tables + RLS ✅
- `src/lib/feedback/efficacy.ts`: formula, batch, proposal conversion (171 lines) ✅
- `src/lib/feedback/signals.ts`: signal aggregation queries (201 lines) ✅
- `src/lib/feedback/guardrails.ts`: clamp, ±15pt flag, tier warnings (167 lines) ✅
- `src/lib/feedback/edit-tracker.ts`: diff detection, edit classification (281 lines) ✅
- `src/lib/feedback/self-healing.ts`: metadata correction proposals (261 lines) ✅
- `src/lib/feedback/__tests__/feedback.test.ts`: 523 lines of tests ✅
- `src/components/admin/feedback/ApprovalQueue.tsx`: working approval queue UI (216 lines) ✅
- `src/components/admin/feedback/AdjustmentCard.tsx`: individual card with approve/reject (156 lines) ✅
- `src/app/api/admin/feedback/route.ts`: GET/POST/PATCH handlers (282 lines) ✅
- Edit tracker wired to content save API (`class-units/content/route.ts` line 195) ✅

## Lessons to apply

- **#38** — Verify = expected values. Efficacy formula tests must capture truth from real signal set.
- **#42** — Dual-shape fields. `reasoning` vs `signal_breakdown` must be aligned before Checkpoint 3.1.
- **#43** — Think before coding. Clarify auto-approve deletion vs gating before touching it.
- **#44** — Simplicity first. UI sub-components should be minimal for verification, not polished.
- **#45** — Surgical changes. Edit tracker is already wired to one save path — don't rewire what works.
