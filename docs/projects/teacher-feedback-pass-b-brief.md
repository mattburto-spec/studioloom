# TFL.2 Pass B — Schema + wiring brief

**Status:** B.1 in flight (10 May 2026)
**Builds on:** [TFL.1 Read Receipts](feedback-loop-closure-phase-1-brief.md), TFL.2 Pass A (PRs #158, #160, #161)
**Owner:** Matt
**Methodology:** [build-methodology.md](../build-methodology.md)

## Goal

Make `<TeacherFeedback />` (Pass A) read live thread data and accept student replies. End state: when a teacher sends a comment via `/teacher/marking`, the student sees it in the speech bubble on `/lesson/...`. When the student picks `Got it` / `Not sure` / `I disagree` (with optional reply text), the teacher sees the sentiment chip + reply in their override panel and can write a follow-up turn.

## Why now

Pass A shipped the visual but it's running on fixtures in `/admin/teacher-feedback-sandbox`. The dialogic-feedback architecture only earns its keep when the loop actually closes: teacher → student → teacher → … with persisted history. Pass B is the structural move.

## What Pass A locked (do not touch)

- **`<TeacherFeedback />` API** at [`src/components/lesson/TeacherFeedback/types.ts`](../../src/components/lesson/TeacherFeedback/types.ts). The `Turn` discriminated union + `Sentiment` enum + props are the contract Pass B's loaders must produce.
- **Visual + a11y** — the BubbleFrame, QuickReplies, ReplyBox, Thread, ResolvedSummary components stay as-is. If a state needs a visual change, that's Pass C, not Pass B.
- **TFL.1 read-receipt mechanism** — `student_seen_comment_at` column + `bump_student_seen_comment_at` RPC + the chip dot ladder. Pass B reuses these unchanged. Per-turn read receipts are explicitly OUT of scope for v1.

## Sub-phases (5)

| Phase | Days | Output |
|---|---|---|
| **B.1** | 1 | Schema migration: `tile_feedback_turns` table + backfill + RLS + sync trigger |
| **B.2** | 1 | `GET /api/student/tile-feedback?unitId=X&pageId=Y` returns `Record<tileId, Turn[]>`. Wire `<TeacherFeedback />` into the student lesson page (replies disabled) |
| **B.3** | 1 | `POST /api/student/tile-feedback/[gradeId]/reply` + `onReply` wiring + audit log entries |
| **B.4** | 1.5 | Marking-page composer refactor: replace single textarea with "follow-up turn" composer; teacher writes a new turn rather than overwriting the column |
| **B.5** | 0.5 | Bell notification adjusts to fire on new teacher turns. Sandbox cleanup decision (keep for visual iteration vs. delete now). |

Each sub-phase ships independently. Order is fixed (B.1 → B.5) to avoid broken intermediate states — student-side reads need the schema (B.1), reply writes need the read endpoint (B.2), the marking refactor needs the reply pipeline live (B.3) so teacher can verify their follow-up landed.

## B.1 — Schema (this PR)

### Locked decisions

| Decision | Choice |
|---|---|
| Storage shape | One row per turn in a new `tile_feedback_turns` table |
| Edit history | Just bump `edited_at` on the original turn (no separate edit-history table) |
| Per-turn read receipts | Latest seen only — keep `student_seen_comment_at` unchanged |
| `student_facing_comment` column | KEEP as denormalized cache of the latest teacher turn body. 6 readers depend on it (route handlers + chip + bell + comment-status helper). Sync trigger keeps it consistent |
| Audit log | Teacher turns: yes, existing `student_tile_grade_events` pattern. Student replies: yes, new event types `student_reply_got_it` / `_not_sure` / `_pushback`. One audit surface, not two |

### Schema

```sql
CREATE TABLE tile_feedback_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES student_tile_grades(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),

  -- Teacher-only fields
  author_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body_html TEXT NULL,         -- sanitized HTML (allow strong, em, p, ul, ol, li, blockquote)
  edited_at TIMESTAMPTZ NULL,

  -- Student-only fields
  sentiment TEXT NULL CHECK (sentiment IN ('got_it', 'not_sure', 'pushback')),
  reply_text TEXT NULL,        -- plain text only; min 10 chars enforced by route on insert (Lesson #38: also enforce in DB? deferred — route is the gate)

  -- Both
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Discriminator integrity: a teacher row has author_id + body_html
  -- and no student fields; a student row has sentiment and no teacher
  -- fields. Catches schema drift if a future writer mixes them.
  CONSTRAINT teacher_or_student CHECK (
    (role = 'teacher'
       AND author_id IS NOT NULL
       AND body_html IS NOT NULL
       AND sentiment IS NULL
       AND reply_text IS NULL)
    OR
    (role = 'student'
       AND sentiment IS NOT NULL
       AND author_id IS NULL
       AND body_html IS NULL
       AND edited_at IS NULL)
  )
);

CREATE INDEX idx_tile_feedback_turns_grade_sent
  ON tile_feedback_turns(grade_id, sent_at);
```

### RLS

- **Service-role**: full access (route layer uses admin client)
- **Teachers**: SELECT where `grade_id → student_tile_grades → class_id → classes.teacher_id = auth.uid()`. No INSERT/UPDATE/DELETE — those go through service-role at the route boundary
- **Students**: no policy needed. Student auth uses custom session tokens (not Supabase Auth), so they always come through the service-role admin client. RLS doesn't apply.
- **Anon/authenticated**: nothing

### Backfill

```sql
-- One teacher turn per existing student_tile_grades row that has a
-- non-null + non-empty student_facing_comment. The turn's body is the
-- comment text wrapped in a single <p> (the existing column is plain
-- text per the marking page composer). sent_at = updated_at (the
-- latest write, which TFL.1's read-receipt mechanism treats as the
-- comment's "sent at" time).
INSERT INTO tile_feedback_turns (grade_id, role, author_id, body_html, sent_at)
SELECT
  id AS grade_id,
  'teacher' AS role,
  graded_by AS author_id,
  '<p>' || student_facing_comment || '</p>' AS body_html,  -- plain → minimal HTML
  COALESCE(updated_at, created_at) AS sent_at
FROM student_tile_grades
WHERE student_facing_comment IS NOT NULL
  AND student_facing_comment <> '';
```

### Sync trigger

When `student_tile_grades.student_facing_comment` changes via the existing marking-page write path:

| Transition | Trigger action |
|---|---|
| INSERT (new row) | If `student_facing_comment` is non-null + non-empty → INSERT a teacher turn |
| UPDATE: null → non-null | INSERT a new teacher turn |
| UPDATE: non-null → different non-null | UPDATE the LATEST teacher turn for this grade_id: bump `body_html` + `edited_at = now()` |
| UPDATE: non-null → null | No-op on the turns table (history preserved) |
| UPDATE: same → same | No-op |

In v1 the teacher composer only ever produces ONE teacher turn per grade row (the existing single-textarea pattern). When B.4 ships the multi-turn composer, that endpoint writes directly to `tile_feedback_turns` AND updates `student_facing_comment` to the latest turn's body — both stay in sync.

### Why keep `student_facing_comment` as a cache

6 readers in production depend on the column being a quick read off the grade row:
- `GET /api/student/tile-comments` — student page comment list
- `GET /api/student/recent-feedback` — student dashboard bell
- `/teacher/marking/page.tsx` — chip status + counter
- `TeacherFeedbackPanel.tsx` — student-facing comment surface
- `comment-status.ts` — read-state classifier
- `save-tile-grade.ts` — write path

Migrating all 6 to the new table in one PR is bigger than B.1's scope. Keeping the cache means B.1 is risk-free (no reader breaks), and we migrate them gradually in B.2–B.4.

## Stop triggers (B.1)

Pause + report immediately if:

1. The backfill produces a row count that doesn't match the source row count (off-by-one, duplicates, etc.)
2. The CHECK constraint rejects any backfilled row (means the existing data has a shape we didn't expect)
3. The trigger fires during the migration's own backfill (chicken-egg loop)
4. Migration collision check fails before merge
5. RLS coverage scanner flags the new table after apply

## Don't stop for (B.1)

- Cosmetic edits to the migration's SQL comments
- Test naming nits
- Deciding what to do with the bell notification — that's B.5
- Migrating any of the 6 readers off `student_facing_comment` — that's B.2–B.4

## Registry cross-check (Step 5c)

Before drafting the SQL body, verify against the 6 registries per build-methodology.

| Registry | Action |
|---|---|
| `schema-registry.yaml` | Add `tile_feedback_turns` entry on apply (post-migration). No edits needed pre-merge — sync runs on saveme |
| `WIRING.yaml` `teacher-grading` system | Add `tile_feedback_turns` to `data_fields` after apply. The `affects` chain (lesson-view, student-data) stays |
| `api-registry.yaml` | No new routes in B.1 — empty diff |
| `ai-call-sites.yaml` | No new AI calls — empty diff |
| `feature-flags.yaml` | No new flags — empty diff |
| `vendors.yaml` | No new vendors — empty diff |
| `data-classification-taxonomy.md` | `body_html` may contain student names by reference (teacher writes "Scott, your draft..."). Inherits the existing classification on `student_tile_grades.student_facing_comment` (Personal/Pedagogical, retained 7y). `reply_text` same |
| `scanner-reports/rls-coverage.json` | Re-run `scan-rls-coverage.py` post-apply to confirm the new table is covered |

## Matt Checkpoint B.1

When this PR's CI lands green and migration applied to prod:

1. Apply the migration via Supabase SQL editor.
2. Run the verification query (provided in this brief, see below).
3. Sign off on B.1 → I open a PR for B.2 immediately.

```sql
-- Verification: row counts should match
SELECT
  (SELECT COUNT(*) FROM student_tile_grades WHERE student_facing_comment IS NOT NULL AND student_facing_comment <> '') AS source_rows,
  (SELECT COUNT(*) FROM tile_feedback_turns WHERE role = 'teacher') AS backfilled_turns;

-- Should return identical numbers in both columns.
```

## Resolved-issues archive

This brief is the canonical Pass B reference until B.5 ships. Each sub-phase's PR description includes a "Closes B.x of Pass B brief" line for traceability. Once B.5 lands the brief moves to `docs/archive/` with a "shipped" header.
