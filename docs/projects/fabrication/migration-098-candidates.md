# Migration 098 — Phase 1B schema candidates

> **Status:** DRAFT — awaiting Matt review + sign-off.
> **Target phase:** Phase 1B (storage buckets + Fabricator invite UI + notifications + AI enrichment plumbing).
> **Last updated:** 20 Apr 2026.
> **Context:** Every item here came out of UI mockup review and follow-up product discussion. Each is additive + safe (no backfill needed); the methodology favours splitting into multiple migrations with per-sub-task checkpoints. When this list is signed off, it gets sequenced into the Phase 1B brief as individual migrations 098–10X.

## Review protocol

For each item below, mark one of:

- ✅ **APPROVE** — include in Phase 1B, proceed with build
- 🔄 **REVISE** — change shape before approval (leave notes inline)
- ⏸️ **DEFER** — push to Phase 2+
- ❌ **REJECT** — not happening

Once all 8 items are marked, this doc becomes the spec source for the Phase 1B schema migrations.

---

## The 8 candidates

### 098a — `fabrication_jobs.student_intent JSONB`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabrication_jobs
  ADD COLUMN student_intent JSONB;
```

**Shape:**
```json
{
  "size_bucket": "hand" | "a4_or_smaller" | "bigger",
  "designed_units": "mm" | "cm" | "inch",
  "chosen_material": "PLA" | "PETG" | "ABS" | ...,
  "description": "phone stand for my Pixel 7"  // optional free text
}
```

**Why:** The 3 pre-check questions on the new-submission form + optional free-text description (per Q0 discussion). Drives scanner context, AI size-reasonableness check (R-AI-01), and teacher review display.

**Consumer touchpoints:**
- Written by: new-submission API route (Phase 1B)
- Read by: scanner worker (Phase 2) for context, AI enrichment (Phase 2) for R-AI-01/02/04, teacher review UI (Phase 1B)

**Risk:** None — nullable, no backfill.

---

### 098b — `fabricator_sessions.is_setup BOOLEAN NOT NULL DEFAULT false`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabricator_sessions
  ADD COLUMN is_setup BOOLEAN NOT NULL DEFAULT false;
```

**Why:** Fabricator invite/password-reset flow (§3.4 admin). `is_setup=true` means "this is a one-time invite or reset link, not a login session". Uses existing `expires_at` for TTL (24h default). Consumed by `/fab/set-password` which verifies, sets real password, deletes the setup row, creates a normal session.

**Consumer touchpoints:**
- Written by: `/api/teacher/fabricators/invite` route
- Read by: `/fab/set-password` page (Phase 1B)
- Deleted by: same page on successful password set

**Risk:** Defaults to false — existing sessions unaffected.

**Alternative considered:** dedicated `fabricator_invite_tokens` table. Rejected — one more table, same shape, no win.

---

### 098c — `fabrication_jobs.printing_started_at TIMESTAMPTZ`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabrication_jobs
  ADD COLUMN printing_started_at TIMESTAMPTZ;
```

**Why:** Distinguish "Fabricator downloaded the file" from "Fabricator pressed print on the machine" without adding a new `status` value. Derived states:

| `status` | `printing_started_at` | UI label |
|---|---|---|
| `picked_up` | `NULL` | "With Cynthia — downloaded, not started" |
| `picked_up` | timestamp | "🖨 Currently printing" |
| `completed` | timestamp | "Completed" |

**Fabricator UI:** the "Pick up" button on the queue becomes a 2-step flow OR we keep it 1-click. Recommendation: single button "Start printing" that both sets `status=picked_up` AND `printing_started_at = now()` in the common case where Fabricator downloads + starts immediately. Separate "Download only (not yet printing)" option behind a dropdown for the multi-pickup case.

**Risk:** None — nullable.

**Alternative considered:** adding a new `status` value `printing`. Rejected — more UI state transitions, more CHECK constraint churn, same end result.

---

### 098d — `fabrication_jobs.notifications_sent JSONB`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabrication_jobs
  ADD COLUMN notifications_sent JSONB;
```

**Shape:**
```json
{
  "approved_at": "2026-04-20T10:30:00Z",
  "returned_at": null,
  "rejected_at": null,
  "picked_up_at": "2026-04-20T11:05:00Z",
  "printing_started_at": "2026-04-20T11:08:00Z",
  "completed_at": null
}
```

**Why:** Idempotency guard for status-transition email sends (Q5/Q6 notification plan). Route checks "is `approved_at` already set?" before dispatching email. Also an audit trail for "did the student actually get notified?" support questions.

**Consumer touchpoints:**
- Written by: each status-transition API route (approve/return/reject/pickup/print-started/complete)
- Read by: same routes, for idempotency check
- Exported via admin audit tools (reuses existing `admin_audit_log` patterns where relevant)

**Risk:** None — nullable.

**Alternative considered:** new `fabrication_notifications` table with per-event rows. Rejected for v1 — heavier schema + query surface for a feature that only needs "did we send X event for job Y?". Can migrate to a proper table post-pilot if we add rich delivery tracking (email opens, etc.).

---

### 098e — `students.fabrication_notify_email BOOLEAN NOT NULL DEFAULT true`

**Status:** ⏳ awaiting Matt review — possibly ❌ REJECT if StudioLoom already has a notification preferences pattern

**Column:**
```sql
ALTER TABLE students
  ADD COLUMN fabrication_notify_email BOOLEAN NOT NULL DEFAULT true;
```

**Why:** Student opt-out for Preflight notification emails. Defaults to true (opted in); surfaced in student settings as a toggle.

**⚠️ Check before approving:** does `students` already have a `notification_preferences JSONB` column or similar? If yes, ADD a key to the existing JSONB instead — don't sprawl boolean columns. If no, this column is the simplest path.

**Consumer touchpoints:**
- Written by: student settings page toggle (new or reuses existing pattern)
- Read by: notification dispatch code before sending Preflight emails

**Risk:** Minor — column touches a hot table (`students`). NOT NULL with default, no backfill, safe.

**Pre-work action:** audit students table schema before writing the migration. If `notification_preferences` JSONB exists, revise this item to `UPDATE ... SET notification_preferences = notification_preferences || '{"fabrication_email": true}'` pattern.

---

### 098f — `fabrication_job_revisions.ai_enrichment_cost_usd NUMERIC`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabrication_job_revisions
  ADD COLUMN ai_enrichment_cost_usd NUMERIC;
```

**Why:** Per-scan AI enrichment cost tracking for daily-cap enforcement + usage analytics. Worker writes the cost of the Haiku call (typical ~$0.0015) after each enrichment. SUM across today's rows = today's AI spend, compared to the admin `daily_cap_usd` setting.

**Consumer touchpoints:**
- Written by: scanner worker (Phase 2) after each AI enrichment call
- Read by: worker on next submission (daily-cap check), admin cost dashboard (Phase 2+)

**NULL semantics:**
- `NULL` = AI enrichment was disabled or skipped for this revision (kill switch, daily cap hit, deterministic-block short-circuit)
- `0` = AI ran but was fully cache-hit / free
- `> 0` = actual spend

**Risk:** None — nullable.

---

### 098g — `fabrication_job_revisions.thumbnail_views JSONB`

**Status:** ⏳ awaiting Matt review

**Column:**
```sql
ALTER TABLE fabrication_job_revisions
  ADD COLUMN thumbnail_views JSONB;
```

**Shape:**
```json
{
  "views": {
    "iso": "path/to/iso.png",
    "front": "path/to/front.png",
    "side": "path/to/side.png",
    "top": "path/to/top.png",
    "walls_heatmap": "path/to/walls.png",
    "overhangs_heatmap": "path/to/overhangs.png"
  },
  "annotations": [
    { "view": "iso", "bbox": [120, 80, 40, 30], "rule_id": "R-STL-09" },
    { "view": "front", "bbox": [95, 115, 35, 20], "rule_id": "R-STL-09" }
  ]
}
```

**Why:** Multi-angle annotated thumbnails for problem-location visualization (the "[ Show where ]" UX). 4 standard views + 2 heatmaps per STL scan. `thumbnail_path` stays as the primary iso view for backward-compat with current §1.1 list rendering; `thumbnail_views` adds the rest.

**Consumer touchpoints:**
- Written by: scanner worker (Phase 2) after rendering
- Read by: student results page (Phase 2 UI), teacher review page

**Applies only to:** STL files. SVG files get inline-rendered in the browser with overlay rects (no server-side multi-view needed).

**Risk:** None — nullable.

---

### 098h — `admin_settings` key/value pairs (NOT a column, existing table)

**Status:** ⏳ awaiting Matt review

**No migration needed** — uses the singleton key/value `admin_settings` table (migration 077, applied 14 Apr 2026).

**Add these 3 keys:**

| Key | Value shape | Default | Purpose |
|---|---|---|---|
| `preflight.ai_enrichment_enabled` | `{ "enabled": true }` boolean | `true` | Platform-wide AI kill switch. When false, worker skips all Haiku calls. |
| `preflight.ai_enrichment_daily_cap_usd` | `{ "cap": 5.00 }` numeric | `5.00` | Max AI spend per day platform-wide. Worker checks before each call; when over, skips + emits `system_alerts` row. |
| `preflight.ai_enrichment_tiers_enabled` | `["tier1"]` JSON array | `["tier1"]` | Which enrichment tiers run. Pilot starts tier 1 only; tier 2/3 enabled post-validation. |

**Consumer touchpoints:**
- Written by: admin settings UI (Phase 2+ — for now, inserted manually or via one-off admin script)
- Read by: scanner worker on every submission

**Risk:** None — adding rows, not schema.

---

## Sequencing + commit plan (assuming all 8 approved)

Follow the Phase 1A pattern — one migration per logical unit, separate commits, individual checkpoint per sub-task.

| Migration | Title | Rows |
|---|---|---|
| **098** | `fabrication_jobs.student_intent + printing_started_at + notifications_sent` | 3 new columns on one table |
| **099** | `fabricator_sessions.is_setup` | 1 new column |
| **100** | `students.fabrication_notify_email` (if not reusable) | 1 new column — OR skip if existing JSONB reused |
| **101** | `fabrication_job_revisions.ai_enrichment_cost_usd + thumbnail_views` | 2 new columns |
| **(no migration)** | Seed 3 `admin_settings` rows for AI guardrails | INSERT via Phase 1B first commit |

Total: 4 migrations + 1 admin_settings seed. Each lands separately with its own post-apply verify queries. Matches the Phase 1A discipline.

**Phase 1B brief will cover:**
1. These 4 migrations (with full DDL, RLS if needed, post-apply verification)
2. Supabase Storage bucket setup: `fabrication-uploads/`, `fabrication-thumbnails/`, `fabrication-pickup/` with policies
3. Teacher Fabricator-invite UI (§3.4) — highest-value surface to pilot with Cynthia
4. `/fab/login` + `/fab/set-password` pages
5. Email dispatch at status transitions (Resend, templates)
6. Retention cron stub (column + trigger; actual cron lands Phase 9)
7. AI enrichment scaffolding (cost tracking reads; real AI calls are Phase 2 with the scanner worker)

**NOT in Phase 1B scope (pushed to Phase 2+):**
- Python scanner worker itself (needs anonymised bucketed fixtures first — Gate B)
- Actual AI enrichment calls (depends on scanner worker running)
- Multi-angle thumbnail rendering (depends on scanner worker)
- Inline SVG overlay rendering (depends on scan_results.findings[].evidence shape)
- Daily Fabricator digest cron (depends on email dispatch working + having real data)

---

## Matt's review — mark each item

- [ ] 098a — `student_intent JSONB`: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098b — `is_setup` on sessions: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098c — `printing_started_at`: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098d — `notifications_sent JSONB`: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098e — `fabrication_notify_email` on students: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes (CHECK FOR EXISTING PATTERN FIRST):
- [ ] 098f — `ai_enrichment_cost_usd` on revisions: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098g — `thumbnail_views JSONB` on revisions: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:
- [ ] 098h — 3 admin_settings keys for AI guardrails: ⬜ approve ⬜ revise ⬜ defer ⬜ reject. Notes:

Once all 8 are marked, reply "candidates signed off" and I'll run `build-phase-prep` for Phase 1B with this as the schema source.
