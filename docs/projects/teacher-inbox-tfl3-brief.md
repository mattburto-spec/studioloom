# TFL.3 — Teacher Marking Inbox

**Status:** Brief drafted (12 May 2026)
**Builds on:** TFL.2 Pass B (multi-turn threads + replies + composer flip)
**Owner:** Matt
**Methodology:** [`build-methodology.md`](../build-methodology.md)

## Goal

Cut the per-tile click cost of marking from ~8 clicks (navigate → pick tile → expand row → read response → judge → write/edit comment → send → collapse) down to **1 click** (approve) or 2 clicks (one tweak then approve). Without this, the dialogic loop Pass B shipped is technically functional but workflow-broken — a teacher with 24 students × 6 lessons × 5 tiles is looking at ~700 row-expansions per term and won't use it at scale.

The MVP is a single triage surface at `/teacher/inbox` that:

- Lists every (student × tile × lesson) item needing teacher action across the teacher's classes.
- Each card surfaces the student's response (collapsed → expandable) + the AI-drafted comment OR reply-follow-up.
- One **big green approve button** sends the draft as the teacher's turn (creates or follows-up an existing `tile_feedback_turns` row via the existing trigger).
- Four pre-set tweak buttons regenerate the draft with a directive (Shorter / Warmer / Sharper / Ask for an example).
- "Skip" defers an item without erasing the draft.
- Empty state shows "0 to review — nice work" + a link back to `/teacher/marking` for deep-dive editing.

## Why now (over Lever 0, the prod migration audit, etc.)

Pass B closed the dialogic loop technically. But every conversation I had with Matt during the smoke kept hitting the same wall — "this only works if a teacher will actually use it 30 times in a sitting". The current `/teacher/marking` page is a calibrate-and-author tool: deep, dense, page-anchored to one class+unit. It's the right surface for "I want to think hard about how the cohort did on this tile". It's the wrong surface for "I have 15 minutes between classes and need to clear my queue".

The inbox is the daily-driver surface. The marking page stays as the deep-dive admin view (and continues to write through the same plumbing).

## What Pass B locked (do not touch)

- **`tile_feedback_turns` schema** + RLS + the INSERT-on-student-latest sync trigger from `20260511094231`. The inbox writes through the same `student_facing_comment` save path; the trigger handles the turn-creation logic.
- **`<TeacherFeedback />` component** + the speech bubble outline. The student-side render stays as Pass B shipped it.
- **TFL.1 read receipts** — the inbox's "approve" path triggers the same `student_facing_comment` write that bumps `updated_at`, which the existing receipt mechanism already handles.

## Sub-phases (5)

| Phase | Days | Output |
|---|---|---|
| **C.1** | 1.0 | Inbox query helper + `/teacher/inbox` page shell + auto-draft trigger (warm pending drafts when teacher opens the page) |
| **C.2** | 1.5 | Item card UI + one-click approve flow (writes through existing `saveTileGrade`) + skip/defer affordance |
| **C.3** | 1.5 | Reply-draft AI: 3 sub-prompts (`got_it` / `not_sure` / `pushback`) + new endpoint + AI call site registry entry |
| **C.4** | 1.0 | 4 pre-set tweak buttons (Shorter / Warmer / Sharper / Ask for an example) — regenerate path, updates draft in-place |
| **C.5** | 1.0 | Dashboard chip with pending count + polish + smoke ladder |

**Total: ~6 days.** Each sub-phase is shippable on its own. Order is fixed C.1 → C.5 to avoid broken intermediate states.

## C.1 — Inbox query + page shell + auto-draft

### Locked decisions

| Decision | Choice |
|---|---|
| What counts as "needs action"? | Three categories, in priority order: (a) student-replied threads where latest turn is student (highest — student is waiting), (b) drafted-not-approved (AI draft exists, teacher hasn't sent), (c) no-draft-yet (student submitted, AI hasn't drafted) |
| Auto-draft timing | LAZY — when teacher opens the inbox, fire the existing `runAiPrescoreBatch` for items in category (c). 1-2 sec wait, drafts populate, render. Don't try to be eager via a background job until v1 proves the workflow |
| Approve = score + comment combined? | YES — approve = `student_facing_comment = ai_comment_draft` + `score = ai_pre_score` + `confirmed = true`. Override score requires expanding the card (small "edit score" link) |
| Daily inbox cap | 50 items by default; "Show all" expands. Below 50 is the realistic teacher session ceiling |
| Skip behavior | "Skip" hides the item from THIS session only; refresh = visible again. Doesn't write anything to DB |
| Inbox ordering | Reply-waiting first (sorted by reply age DESC), then drafts (oldest submission first), then no-draft (oldest submission first) |
| Group / filter | Filter chips for class + lesson. No mandatory grouping in v1 — flat ordered list is faster to triage |
| `got_it` rollups | Rolled-up at the lesson level: "5 students said Got it on Lesson 2 — no action needed". Single chip, dismissible |

### Schema impact

**No new tables. No new columns.** The inbox is a pure read-derived view over:

- `student_tile_grades` (existing) — score, comment cache, `ai_comment_draft`, `ai_pre_score`, `ai_quote`, `ai_reasoning`, `ai_confidence`, `confirmed`
- `tile_feedback_turns` (B.1) — turn timeline per grade
- `student_progress` (existing) — student response text
- `classes` + `class_students` (existing) — class membership for the teacher's queue scope

### API

**`GET /api/teacher/inbox/items`** — returns inbox items for `auth.uid()`'s classes.

```ts
type InboxItem = {
  // Identity
  itemKey: string;            // `${grade_id}::${tile_id}` — stable
  gradeId: string;            // routes the approve/follow-up POST
  studentId: string;
  studentName: string;        // first name only — display-only, not in any LLM prompt
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  pageId: string;
  pageTitle: string;
  tileId: string;
  tilePrompt: string;
  criterionLabel: string;

  // State
  state: "no_draft" | "drafted" | "reply_waiting";
  studentResponse: string | null;
  aiScore: number | null;
  aiCommentDraft: string | null;
  aiReasoning: string | null;
  aiQuote: string | null;
  // For state === "reply_waiting":
  latestStudentReply: {
    sentiment: "got_it" | "not_sure" | "pushback";
    text: string;
    sentAt: string;
  } | null;
  latestTeacherTurnBody: string | null;  // for context on reply-waiting items

  // Sorting
  submittedAt: string | null;
  lastActivityAt: string;
};
```

### Auto-draft trigger

On inbox load: server-side helper batches `no_draft` items by `(class, unit, page, tile)` cohort and fires the existing `ai-prescore` route's batch logic per group. Drafts persist to `ai_comment_draft`. Inbox refetches; cards now show "drafted" state. Total wait: ~1-2 sec per cohort group. For a teacher with 15 no-draft items across 3 tiles, that's ~3 round-trips total.

If the teacher closes the inbox before drafts complete, the drafts STILL land (the route writes through), so next open is instant.

### Matt Checkpoint C.1

After this PR's CI green:

1. Open `/teacher/inbox`. See items grouped into the three categories with counts in the header.
2. Auto-drafts populate within ~3 seconds for `no_draft` items.
3. `got_it` rollup chip appears for lessons with all-resolved threads.
4. Filter chips (class + lesson) narrow the view. Counts update.
5. No approve flow yet — that's C.2.

## C.2 — Item card + one-click approve

### Card visual

```
┌─────────────────────────────────────────────────────────────┐
│  Scott · CO2 Dragsters #2 · Lesson 2 · "What does agency..." │  ← class · unit · lesson · tile prompt
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │  ← student response (collapsed if > 3 lines, "expand")
│  │ "Agency means doing what you choose. It's about        │  │
│  │  being independent and making your own decisions..."   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ AI draft ──────────────────────────────────────────  ┐  │
│  │ Scott, I can't see a definition in your own words yet  │  │  ← editable inline (but rarely needed)
│  │ — your draft restates the prompt. Try the shape:       │  │
│  │ "Agency is when I... instead of...". Aim for one       │  │
│  │ sentence using something specific from this lesson.    │  │
│  └─────────────────────────────────────────────────────  ┘  │
│  Score: 4/8 · AI confidence 0.81 · [edit score]              │
│                                                              │
│  [✓ Approve & send]    [Shorter] [Warmer] [Sharper] [+ Ask]  │
│                              [Skip] [Open in marking page →] │
└─────────────────────────────────────────────────────────────┘
```

### Approve flow

Click "✓ Approve & send" → POST `/api/teacher/grading/tile-grades` (existing route) with:

```ts
{
  grade_id: item.gradeId,
  student_facing_comment: item.aiCommentDraft,  // or the edited inline version
  score: item.aiScore,
  confirmed: true,
  // ... other existing fields preserved
}
```

The existing trigger handles whether to create a NEW teacher turn (if latest was student / no prior teacher turn) or UPDATE the latest (rarely used here — inbox primarily creates fresh turns).

UI: card flies up + out with a 200ms confirmation flash. Counter in header decrements. Next item scrolls into focus.

### Skip behavior

Skip removes the item from the current session's render. Server state unchanged. Refresh = visible again. Implementation: client-side `Set<itemKey>` filter on the inbox query result.

### Override paths

- **Edit the AI draft text inline** — the comment textarea is right there; teacher types over it. Approve sends the edited version.
- **"edit score" link** — opens a small inline score picker (re-uses the existing `<ScoreSelector />` component). No navigation.
- **"Open in marking page →"** — for the rare case the teacher wants to see the heatmap / criterion context / cohort comparison. Opens the existing `/teacher/marking` page deep-linked to this tile.

### Matt Checkpoint C.2

1. Approve on a fresh draft. Card animates out. DB confirms the row has `student_facing_comment` written + `confirmed=true` + `tile_feedback_turns` has a teacher turn.
2. Approve on a reply-waiting item: same path; a new teacher turn lands in the thread (trigger handles the INSERT-on-student-latest case).
3. Edit the AI draft inline + approve. Edited text persists.
4. "edit score" → change score → approve. Score writes through.
5. Skip → next item appears. Refresh → skipped item visible again.

## C.3 — Reply-draft AI (3 sub-prompts)

### Why three prompts, not one

Each sentiment is a different pedagogical move:

- **`got_it`**: thread resolves; teacher response is often empty or 1-line warm acknowledgement
- **`not_sure`**: clarifying — RE-FRAME the original point with different scaffolding
- **`pushback`**: engage with the disagreement; acknowledge / hold / Socratic question

Stuffing all three into one prompt produces generic "I understand your feedback" mush. Three separate prompts allow each to be tested + iterated independently.

### Prompt design (draft, ~80 words each)

**`got_it` reply prompt:**
> The student acknowledged your feedback with "Got it". Many of these resolve without a follow-up — the thread is done. If a brief acknowledgement feels natural (e.g. they expressed engagement, asked a clarifying side-question), draft a SINGLE warm sentence (max 25 words) acknowledging their landing. Otherwise return the literal string `"(no follow-up needed)"`. Anchor any reply you write to something specific from their response.

**`not_sure` reply prompt:**
> The student replied "Not sure" with this question: `{reply_text}`. Your original feedback was: `{original_teacher_body}`. The student is stuck on something specific. Identify what they're stuck on from their question, then re-frame your original point using DIFFERENT scaffolding — a concrete example, simpler language, or a question that helps them locate the part they DO understand. Don't repeat the original wording. 40–80 words. Address `{STUDENT_NAME_PLACEHOLDER}` by their placeholder once.

**`pushback` reply prompt:**
> The student disagreed with your feedback. Their counter: `{reply_text}`. Your original: `{original_teacher_body}`. This is the most important pedagogical moment in the thread — the student is doing the very work the platform is for. Respond with ONE of three moves: (a) acknowledge where they're right and revise your position, (b) hold your line with stronger reasoning grounded in something specific from their response, (c) ask a Socratic question that helps them see the weakness in their position. Do NOT double-down with the same wording. 40–80 words. Address `{STUDENT_NAME_PLACEHOLDER}` by their placeholder once.

### API surface

**`POST /api/teacher/grading/draft-followup`**

```ts
{
  grade_id: string;
  // The route loads everything else (turns, original response, criterion)
  // from the DB scoped by teacher ownership.
}

→

{
  draftBody: string;  // ready to drop into ai_comment_draft
  promptVariant: "got_it" | "not_sure" | "pushback";
  modelVersion: string;
  promptVersion: string;
}
```

The route resolves the student's name AFTER the Haiku response via `restoreStudentName()` (PII flow per security-overview.md §1.3 — same pattern G3.1 uses).

### PII contract (critical — security-overview.md §1.3)

The student's real name MUST NOT reach Anthropic. The prompts use `{STUDENT_NAME_PLACEHOLDER}` ("Student"). The route restores the real name on the returned `draftBody`. Adds `/api/teacher/grading/draft-followup` to the REDACTION_ALLOWLIST in `src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts`.

### Matt Checkpoint C.3

1. Student replies `got_it` to a tile. Inbox shows the item in `reply_waiting` state with the AI's `got_it` follow-up (or "(no follow-up needed)" placeholder + skip-default).
2. Student replies `not_sure` + "Do you mean an example from the prototype or the brainstorm?". AI draft is a re-framed clarifier, not the original verbatim.
3. Student replies `pushback` + "I disagree because X". AI draft engages with X specifically.
4. All three drafts have the real student name post-restore. The CI PII grep test passes.

## C.4 — Pre-set tweak buttons

### The four buttons

Pinned to four — more options creates decision fatigue.

1. **Shorter** — regenerate at ~40 words (vs 80). Same content + tone, more compressed.
2. **Warmer** — less academic, more conversational. Adds 1 piece of student-specific affirmation.
3. **Sharper** — less hedging ("maybe try" → "try"), more direct. Same content + warmth, sharper edges.
4. **+ Ask** — append a closing sentence: a specific question about THEIR response that requires a follow-up reply. Useful for kicking a `got_it` student into a 2nd thinking pass.

### API

**`POST /api/teacher/grading/regenerate-draft`**

```ts
{
  grade_id: string;
  tweak: "shorter" | "warmer" | "sharper" | "ask";
  baseDraft: string;  // the current draft to tweak (not the original — re-tweaks compound)
}

→

{
  draftBody: string;
  promptVersion: string;
}
```

Each tweak prepends a directive to the existing G3.1 prompt:

- shorter → `Cut to ~40 words while preserving the specificity + the next step.`
- warmer → `Soften the tone: more conversational, add one student-specific affirmation. Keep the substance.`
- sharper → `Remove hedging language. State the next step directly. Same warmth, sharper edges.`
- ask → `Append a closing sentence that asks a specific question about THEIR response. The question should require a follow-up reply.`

### Matt Checkpoint C.4

1. Tap each tweak button. Draft regenerates in ~1 sec.
2. Tweaks compound: Warmer → Shorter produces a shorter warm version. Sharper → + Ask produces a direct version with a closing question.
3. Approve sends the latest tweaked version.
4. Each tweak click logs to `ai_usage_log` with the right endpoint string and the parent grade ID for cost attribution.

## C.5 — Dashboard chip + count + polish

### Dashboard chip

At `/teacher/dashboard` (or wherever the teacher's primary landing is), surface:

```
┌──────────────────────────────────────────────────┐
│ Feedback inbox                                    │
│ 15 to review · 3 students waiting on you →        │
└──────────────────────────────────────────────────┘
```

Click → `/teacher/inbox`. The "3 students waiting on you" sub-line counts reply-waiting items specifically — surfacing the urgency.

Count query is cheap: same `/api/teacher/inbox/items` filtered to `state IN ('reply_waiting', 'drafted', 'no_draft')` + `COUNT()`.

### Polish + smoke

- Empty state: "0 to review — nice work." + link to `/teacher/marking` for deep-dive.
- Loading state: skeleton cards (3 placeholders).
- Error state: "Inbox couldn't load. [Retry]"
- Reduced motion: skip the card-fly-out animation; instant remove.
- Mobile / iPad: cards stack full-width. Tweak buttons wrap into a 2×2 grid.

### Matt Checkpoint C.5

Full smoke ladder:

1. Land on dashboard. See chip with accurate count.
2. Click → land on `/teacher/inbox`. 15 items render.
3. Approve 10 in a row. Counter decrements. Each approval lands in DB.
4. Open one reply-waiting item. The student's reply + AI follow-up draft are visible.
5. Tweak Warmer → Shorter. Approve. Thread now has 3 turns.
6. Skip 2 items. Refresh. Skipped items visible again.
7. Filter to one class. Counter updates.
8. Bell on student dashboard still fires correctly for the new teacher turns.
9. The chip dot ladder on `/teacher/marking` still works (TFL.1 receipts unaffected).

If 1–9 pass, **TFL.3 is signed off**.

## Stop triggers (any sub-phase)

Pause + report immediately if:

1. **AI draft quality regresses** — if the AI's existing G3.1 drafts have been tested at v2.1.0 and pass, but a reply-draft prompt produces obviously-bad output on smoke, surface the prompt for re-design rather than ship low-quality automation.
2. **Approve writes the wrong turn** — if the trigger somehow UPDATEs an old teacher turn instead of INSERTing a new one (e.g. trigger logic regressed in a parallel change), halt before any teacher uses the inbox.
3. **PII leak in any prompt** — the CI grep test must pass before any AI prompt ships. If the test fails, halt.
4. **Cost ceiling breach** — each tweak click is a Haiku call. If a typical session of 30 items × 1 tweak each = 30 calls × $0.0017 = $0.05 per session, fine. If we hit 5× that, flag in C.4.
5. **Approve latency > 500ms p95** — feels slow at scale. Profile + fix before adding more items.

## Don't stop for (any sub-phase)

- Cosmetic edits to AI prompt wording (will iterate)
- Adding more tweak buttons (4 is the locked count)
- "What if the teacher wants to write completely from scratch?" — they can, in `/teacher/marking`. The inbox is the approve-path
- Mobile-first redesign (responsive but desktop-priority for the MVP)
- Real-time updates / WebSockets (refresh-on-action is fine for v1)
- Reply-draft for tiles with NO prior teacher turn (out of scope — only fires when there's an existing thread)
- Audit log for tweak-click events (the saveTile audit already covers the approve)

## Registry cross-check (Step 5c)

Per `build-methodology.md` — consult registries before any code lands.

| Registry | Spot-check entry | Drift? | Action |
|---|---|---|---|
| `schema-registry.yaml` | `student_tile_grades` columns include `ai_comment_draft`, `ai_pre_score`, `ai_quote`, `ai_reasoning`, `ai_confidence` | NO — verified, all present | none |
| `api-registry.yaml` | New routes to add: `GET /api/teacher/inbox/items`, `POST /api/teacher/grading/draft-followup`, `POST /api/teacher/grading/regenerate-draft` | NEW | scan-api-routes.py picks these up on next saveme |
| `ai-call-sites.yaml` | New sites: `lib/grading/reply-draft` (3 variants by sentiment), `lib/grading/regenerate-draft` (4 variants by tweak) | NEW | scan-ai-calls.py picks up on saveme. Endpoint strings: `teacher/grading/draft-followup` and `teacher/grading/regenerate-draft` |
| `feature-flags.yaml` | No new flags | OK | none |
| `vendors.yaml` | Anthropic already registered; no new vendors | OK | none |
| `data-classification-taxonomy.md` | New AI prompts handle student names — must follow STUDENT_NAME_PLACEHOLDER pattern + add new endpoint to REDACTION_ALLOWLIST | NEW | add allowlist entry in `src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts` during C.3 |
| `WIRING.yaml` `teacher-grading` system | Add `teacher-inbox` to `affects` list once it lands | NEW | update during C.5 |

## Open questions (still need locking)

These were the 5 I flagged in the original conversation. My recommendations are baked into the "Locked decisions" tables above; flagging them here for explicit Matt sign-off:

1. ✅ **What counts as "needs action"?** — 3 categories: reply-waiting / drafted / no-draft. Locked.
2. ✅ **Approve = score + comment combined?** — YES. Locked. Edit score requires expanding the card.
3. ✅ **`got_it` rollups** — Lesson-level rollup chip. Single dismissible chip per lesson. Locked.
4. ✅ **Reply-draft timing** — LAZY (when teacher opens). Locked. Don't build async job queue for v1.
5. ✅ **Daily cap** — 50 by default, "Show all" expands. Locked.

If any of these need re-thinking, push back. Otherwise the brief is the locked spec.

## After TFL.3 — what's next

Looking forward (post-TFL.3 sign-off):

- **FU-PROD-MIGRATION-BACKLOG-AUDIT** (P1) — verify prod schema vs repo migrations; this was deferred during the TFL.1 + TFL.2 sprint. Worth tightening before piloting at scale.
- **Lever 0** — manual unit builder (CBCI + Structure-of-Process + Paul-Elder). ~5–7 days.
- **Levers 2–5** — generation quality features (lints, voice/personality, exemplar contrast, sequencing intuition).

Inbox MVP lands → pilot → real teacher feedback → iterate. The audit-log + per-turn-receipt follow-ups from TFL.2 stay parked unless pilot surfaces a real driver.
