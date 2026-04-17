# Project: Gallery v2 — Public Miro-Style Board + Curation Handoff

**Created:** 18 April 2026
**Status:** SPEC — approved scope, not yet built
**Depends on:** Gallery v1 (shipped, migration 049), Dimensions3 content moderation (`moderateAndLog`), existing student-session + teacher-auth primitives
**Supersedes:** the `v2 = public gallery access + curated exhibitions` bullet in [`WIRING.yaml`](WIRING.yaml) — absorbed into this full spec
**Sibling project:** [`3delements.md`](3delements.md) — downstream consumer that will render curated submissions into 3D exhibition rooms
**Companion:** [`../specs/class-gallery-peer-review.md`](../specs/class-gallery-peer-review.md) (v1 spec), [`../specs/student-gallery-api.md`](../specs/student-gallery-api.md) (v1 API surface)

---

## 1. What This Is

Gallery v1 is a class-scoped digital pin-up — students submit, peers review with effort-gated feedback. It works, but the work stays inside the classroom. Parents never see it. Other classes never see it. A student who wants their work in front of a wider audience has nowhere to go.

Gallery v2 adds two things:

1. **A spatial Miro-style canvas** alongside the existing grid view. Teachers drag submissions into a curated layout. Visitors pan/zoom across the canvas.
2. **Per-viewer access codes** that let a teacher invite specific people — parents, other teachers, a visiting class — to see the round, react to work, and leave moderated sticky-note comments.

Gallery v2 is also the **foundation for the 3D exhibition rooms** planned in [`3delements.md`](3delements.md). A submission that gets featured on the Miro board can later be promoted into a 3D exhibition space by the student. The Miro board is where most of the social feedback happens; the 3D gallery is the showcase layer built on top of it.

---

## 2. Why This Is a Separate Project

Gallery v1 provides: rounds, submissions, reviews, effort-gating, teacher monitoring, 3 review formats.

Gallery v2 adds:

1. **Spatial layout primitives** — submissions get x/y coordinates, display mode toggles between grid and canvas, saved arrangement per round
2. **Visitor identity without Supabase Auth** — a whole new auth surface. Visitors aren't teachers and aren't students; they're teacher-invited guests with per-person codes
3. **Public read-only route** — no session cookie from Supabase, just a viewer cookie tied to a teacher-issued code. Separate RLS pattern from everything else in the codebase
4. **Visitor-authored content** — sticky-note comments from non-authenticated users. Every comment goes through a moderation queue before it appears publicly
5. **Curation handoff contract** — a `featured_for_exhibition` flag on submissions that the future 3D system reads. Needs to be stable before 3D work starts, otherwise 3D blocks on a contract renegotiation

These aren't additive features to v1 flows — they introduce three new systems (spatial canvas, viewer-code auth, visitor moderation) that each need their own data model, RLS, and UI. One project doc keeps the handoff points between them explicit.

---

## 3. Architectural Decisions

### 3.1 Two display modes, not two galleries
The v1 grid stays. The Miro canvas is a second rendering of the same `gallery_submissions` rows. `gallery_rounds.display_mode` toggles between `grid` and `canvas`. No data duplication, no parallel feature sets — switching modes on an existing round just re-renders.

### 3.2 Teacher-issued viewer codes (not name-only comments)
Visitors can't self-register. The teacher explicitly invites each viewer by creating a `gallery_viewers` row with a label (`"Sarah's mum"`, `"Year 8 DT dept"`) and a generated access code. Each code maps to one identity and one round. Teachers can revoke codes. Comments and reactions are attributed to the teacher-supplied label.

**Why:** student work = high sensitivity audience (parents, potentially public). Anonymous-with-moderation is feasible but creates a long moderation queue. Pre-authorised viewers put the access control at code-generation time, not at every-comment time. Teacher still moderates comments but the identity is already known and revocable.

### 3.3 Single magic-link URL per viewer
URL pattern: `/gallery/v/[viewerCode]`. One URL proves both the round and the identity. Teacher generates a viewer → system emits a URL → teacher shares the URL (email, print, QR) → visitor opens it → session cookie is set for that viewer. No separate "round code + personal code" flow.

### 3.4 Visitor session = cookie only, no Supabase Auth
A visitor who opens their magic link gets a signed cookie containing `viewer_id` + `round_id`. Expires with the round's `expires_at` or after 7 days idle, whichever is sooner. All visitor API calls validate the cookie; no RLS on public-view tables against `auth.uid()`.

### 3.5 Moderation reuses the Dimensions3 pipeline
Every visitor comment runs through the existing `moderateAndLog` module from Dimensions3 Phase 5. The queue surfaces in the teacher's round-monitoring view. Auto-blocks on high-confidence safety violations, queues for manual review on borderline cases. No new moderation infrastructure.

### 3.6 Curation handoff is a flag, not an event
`gallery_submissions.featured_for_exhibition BOOLEAN`. When a teacher (or student with teacher approval) flips it to true, the submission joins the pool the 3D layer reads from. No queue, no event bus, no service call. The 3D system polls or queries that flag directly.

---

## 4. The Miro Board Experience

### 4.1 Teacher flow

1. Teacher creates a Gallery Round (v1 flow) → toggles **Display mode: Canvas**
2. Round opens in canvas view. Submissions arrive as cards with default grid positions (auto-laid-out)
3. Teacher drags cards around the canvas — clusters by theme, arranges by quality, groups by criterion. Layout autosaves per round.
4. Teacher toggles **"Make this round public"** — sets expiry date, adds viewers to the invite list (each viewer gets a generated code + magic-link URL)
5. Teacher distributes URLs (email, QR code in a parent newsletter, printed on a handout)
6. Teacher sees a live monitoring panel: viewers who've joined, reactions per submission, pending comments in the moderation queue
7. Teacher approves/rejects comments one-tap from the queue
8. Teacher flags submissions `featured_for_exhibition` — these are the ones that will eventually promote to the 3D gallery

### 4.2 Student flow (unchanged from v1, plus one addition)

Existing: submit work to round, review peers, get effort-gated feedback.

New: students can see their submission on the public canvas (separate view), see visitor reactions + moderated comments, and request that their work be featured for exhibition. Teacher approves the feature request.

### 4.3 Visitor flow

1. Visitor receives magic-link URL from teacher (email, QR, etc.)
2. Click link → lands on `/gallery/v/[code]` → round loads with welcome message using their teacher-assigned label ("Welcome, Sarah's mum")
3. Canvas renders with pan/zoom. Grid view is also available as a toggle.
4. Visitor clicks a submission card → expanded view with full student work
5. Visitor drops an emoji reaction (❤️ 💡 👀 🎨 — small curated set). Reactions show counts to everyone.
6. Visitor leaves a sticky-note comment anchored to a submission. Types content → submits → sees **"Sent to teacher for approval"** state. Comment is invisible to everyone else until approved.
7. Teacher approves → comment appears on the canvas, anchored to the submission, attributed to the visitor's label
8. Visitor can revisit the link any time until the round expires or their code is revoked

---

## 5. Data Model

### 5.1 Alterations to existing v1 tables

**`gallery_rounds`** — add columns:
| Column | Type | Description |
|--------|------|-------------|
| display_mode | text | `'grid'` or `'canvas'` (default `'grid'`) |
| is_public | boolean | Whether public access is enabled (default false) |
| public_access_code | text | Optional round-level code for broad distribution (nullable) |
| expires_at | timestamptz | When public access auto-closes (nullable) |
| featured_submission_count | int | Cached count of submissions flagged for exhibition |

**`gallery_submissions`** — add columns:
| Column | Type | Description |
|--------|------|-------------|
| canvas_x | numeric | X position on canvas (nullable until first arranged) |
| canvas_y | numeric | Y position on canvas (nullable) |
| featured_for_exhibition | boolean | Curation handoff flag (default false) |
| featured_at | timestamptz | When the flag was set (nullable) |
| featured_by | uuid | Teacher who featured it (nullable) |

### 5.2 New tables

**`gallery_viewers`** — teacher-issued invitations
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| round_id | uuid | FK to gallery_rounds |
| teacher_id | uuid | Creator, for audit |
| label | text | Teacher-assigned name (e.g., "Sarah's mum") |
| access_code | text UNIQUE | Generated 10-char alphanumeric magic-link code |
| revoked_at | timestamptz | Null = active |
| last_seen_at | timestamptz | Updated on each session load |
| first_seen_at | timestamptz | First visit |
| visit_count | int | Default 0 |
| created_at | timestamptz | |

**`gallery_reactions`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| submission_id | uuid | FK to gallery_submissions |
| viewer_id | uuid | FK to gallery_viewers |
| emoji | text | Constrained set: `'heart'`, `'idea'`, `'eyes'`, `'art'`, `'fire'` |
| created_at | timestamptz | |

UNIQUE constraint on `(submission_id, viewer_id, emoji)` — one of each emoji per viewer per submission. Viewer can toggle off by deleting.

**`gallery_annotations`** — visitor sticky-note comments
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| round_id | uuid | FK to gallery_rounds |
| submission_id | uuid | FK to gallery_submissions (nullable — round-level annotations allowed) |
| viewer_id | uuid | FK to gallery_viewers |
| content | text | The comment text |
| canvas_x | numeric | Position relative to submission (nullable for round-level) |
| canvas_y | numeric | Position (nullable) |
| moderation_status | text | `'pending'` / `'approved'` / `'rejected'` (default `'pending'`) |
| moderation_result | jsonb | Output of `moderateAndLog` (category flags, confidence) |
| moderated_by | uuid | Teacher UUID (nullable) |
| moderated_at | timestamptz | Nullable |
| created_at | timestamptz | |

### 5.3 RLS posture

- **`gallery_viewers`** — teacher can read/write/revoke their own rows; visitors never read this table directly (the viewer session resolves the row server-side)
- **`gallery_reactions`** — public read when round.is_public AND NOT round.expires_at < now(); insert requires valid visitor session cookie (server-side validation, not RLS)
- **`gallery_annotations`** — public read of `moderation_status = 'approved'` rows when round is public; insert via visitor session cookie; update/delete teacher-only
- **`gallery_submissions.featured_for_exhibition`** — readable by anyone who can already read the submission; writable by the unit's teacher

---

## 6. Visitor Access Model

### 6.1 Code generation

Teacher creates a viewer → server generates a 10-character alphanumeric code (32⁵ entropy ~= 1 in 1 billion, ample for a round-scoped identifier). URL format: `/gallery/v/[code]`. Code is embedded in the URL, never displayed or typed.

### 6.2 Session cookie

On magic-link open, server validates the code against `gallery_viewers`, checks `revoked_at IS NULL` and round not expired, sets a signed HTTP-only cookie with `{ viewer_id, round_id, exp }`. Cookie expires at the earlier of: 7 days, round.expires_at, or code revocation.

### 6.3 No Supabase Auth interaction

The visitor session is entirely independent of Supabase Auth. Server routes check the cookie signature, resolve the viewer_id, validate the round is still public and the code is still active, and authorize the request. This follows the same pattern as student sessions (existing `student_sessions` table + token cookie) but points at a different table.

### 6.4 Revocation

Teacher revokes a code → `UPDATE gallery_viewers SET revoked_at = now()`. Next request that presents the cookie fails server-side validation → session cleared, redirected to a "This invitation has been revoked" page.

### 6.5 Rate limits (per viewer)

- **Reactions:** 30 per hour
- **Comments:** 5 per hour, 20 per round total
- **Visit rate:** no limit (visitors can refresh freely)

Implemented via a new `gallery_visitor_rate_limits` tracking table, incremented on each write, cleared by a daily job. Keep it simple — no Redis, just Postgres.

---

## 7. Moderation Pipeline

Every `gallery_annotations` insert runs through `moderateAndLog` (Dimensions3 Phase 5 module):

1. **Auto-block** on high-confidence safety violations (explicit content, PII, threats) — annotation saved with `moderation_status = 'rejected'` and never surfaces. Teacher sees it in a separate "Blocked" tab for awareness but can't un-block.
2. **Auto-approve** low-risk, confident clean content — `moderation_status = 'approved'` immediately visible on canvas. Default-off for v2; teacher must opt in per round. Starts with all-manual approval.
3. **Queue** everything else as `'pending'`. Teacher sees a badge on the round's moderation tab, approves/rejects with one click.

**Teacher moderation UI** (`/teacher/gallery/[roundId]/moderation`):
- Tabs: Pending (default) / Approved / Rejected / Blocked
- Each row: viewer label, comment text, submission thumbnail, timestamp, moderation_result flags
- Actions: Approve (one-click) / Reject with optional reason / Revoke this viewer's code (for persistent offenders)

**Audit logging:** every moderation action writes to `student_content_moderation_log` (existing table) with the action, teacher, timestamp, and outcome. Matches the audit pattern from Phase 5.

---

## 8. Curation Handoff to 3D Elements

The curation contract is a single boolean flag + three metadata columns on `gallery_submissions`:

```sql
featured_for_exhibition BOOLEAN DEFAULT false,
featured_at TIMESTAMPTZ,
featured_by UUID REFERENCES auth.users(id)
```

That's it. When 3D Elements work starts, it queries:

```sql
SELECT s.*, r.title AS round_title, r.class_id, st.display_name AS student_name
FROM gallery_submissions s
JOIN gallery_rounds r ON r.id = s.round_id
JOIN students st ON st.id = s.student_id
WHERE s.featured_for_exhibition = true
  AND s.featured_at > ...
ORDER BY s.featured_at DESC;
```

The 3D renderer decides how to present — walls, plinths, rooms — but Gallery v2 doesn't care about any of that. The flag is the contract; everything beyond it is the 3D project's concern.

**API stub** (`/api/exhibition/featured-submissions` returning the query above) ships in GV2-4 so the 3D project can develop against a real endpoint. Returns a shape that's forward-compatible: `{ submissions: Array<...>, cursor: ..., total: ... }`.

**Student-initiated featuring:** student can tap "Request to feature this for exhibition" on their submission → creates a pending feature request → teacher approves or declines in the round-monitoring view. This gives students agency in curation without bypassing teacher oversight.

---

## 9. Integration Points

- **Gallery v1 flows unchanged** — all existing routes, UI, and effort-gating keep working. v2 is additive.
- **Teacher dashboard** — gallery round cards grow a "Public" badge when `is_public = true` and a moderation-queue badge with pending comment count.
- **Teaching Mode** — round's canvas appears in the projector view if teacher wants to demo it live.
- **Parent View** (planned, idea-stage per WIRING) — uses the same viewer-code system. Parents of students in the class get a viewer code that spans all public rounds in the class, not just one.
- **Design Assistant** — AI can reference visitor reactions in student mentoring conversations ("Your classmates and visitors really responded to your colour choices — can you talk about why?"). Reactions feed into the student's existing `learning_profile`.
- **Student dashboard** — students see a "Public visitors" count and recent reactions on their own submissions (after effort-gating is met — same v1 rule).

---

## 10. Build Phases

### GV2-1: Spatial Canvas Foundation (~4-5 days)

**Migration 092** — `gallery_rounds.display_mode`, `gallery_submissions.canvas_x`, `canvas_y`.

**Code:**
- New `GalleryCanvasView.tsx` component — pan/zoom with a canvas library (react-zoom-pan-pinch is lightweight and permissive; confirmed dependency check)
- Teacher drag-to-position with layout autosave (debounced PATCH to `/api/teacher/gallery/round/[id]/layout`)
- Toggle between grid and canvas modes in round settings
- Default grid-auto-layout when canvas mode is enabled for the first time
- Class-scoped only — no public access yet

**Checkpoint:** Teacher creates a round in canvas mode → drags 6 submissions around → refreshes page → layout persists. No public access exists yet.

### GV2-2: Public Access + Reactions (~3 days)

**Migration 093** — `gallery_viewers`, `gallery_reactions`, `gallery_rounds.is_public`, `public_access_code`, `expires_at`.

**Code:**
- New route `/gallery/v/[code]` — public canvas view, no Supabase Auth
- Viewer session cookie + server-side session validation
- Teacher viewer-management UI on round monitoring page: add viewer by label, see codes, copy magic-link URLs, revoke
- Reactions UI on submission cards (emoji row, counts visible to all)
- Rate-limit table + enforcement middleware
- QR code generation for magic links (use `qrcode` package, already likely in deps — confirm)

**Checkpoint:** Teacher creates a viewer "test-parent" → copies URL → opens in incognito → sees canvas → reacts ❤️ → teacher sees reaction count update in monitoring view.

### GV2-3: Sticky Note Comments + Moderation (~3-4 days)

**Migration 094** — `gallery_annotations` table.

**Code:**
- Visitor annotation UI — click submission → comment form with 500-char limit → "Sent for approval" confirmation state
- Server-side `moderateAndLog` integration on insert — writes `moderation_result` JSONB + sets initial status
- Teacher moderation UI at `/teacher/gallery/[roundId]/moderation` — 4 tabs (Pending/Approved/Rejected/Blocked) with one-click approve/reject
- Approved annotations render on canvas anchored to their submission
- Audit log writes to existing `student_content_moderation_log`

**Checkpoint:** Visitor comments → appears in teacher's Pending tab → teacher approves → visitor (incognito) refreshes → comment visible on canvas.

### GV2-4: Curation Handoff Contract (~2 days)

**Migration 095** — `gallery_submissions.featured_for_exhibition`, `featured_at`, `featured_by`.

**Code:**
- Teacher "Feature for exhibition" toggle on each submission (canvas + grid views)
- Student "Request to feature" button on own submission → teacher sees pending requests in round monitoring
- Stub endpoint `/api/exhibition/featured-submissions` returning the query shape described in §8 — no UI consumer yet, but the contract is live and queryable
- WIRING.yaml entry for `exhibition-handoff` system with `affects: [3d-elements]`

**Checkpoint:** Teacher flags 3 submissions → stub endpoint returns exactly those 3 with round/student metadata.

**Total: ~12-14 days across 4 phases.**

---

## 11. Open Questions

1. **Canvas library choice.** `react-zoom-pan-pinch` vs `@dnd-kit` with a custom pan-zoom wrapper vs `tldraw` (rich but heavy). Decision gated on GV2-1 prototype — start with `react-zoom-pan-pinch` + simple drag, upgrade only if it hits limits.
2. **Auto-moderation opt-in or opt-out?** Spec says opt-in per round (all-manual by default). Safer but higher teacher load. Revisit after one real pilot.
3. **Viewer code rotation cadence.** Codes don't currently rotate. Should there be a "rotate all codes for this round" action? Low priority — teacher can just revoke + re-add if abuse happens.
4. **Emoji set.** 5 options proposed (`heart`, `idea`, `eyes`, `art`, `fire`). Adjustable without migration since it's a text column, but locking early makes UI simpler. Confirm with pilot teacher.
5. **Cross-class galleries in v2?** Spec stays class-scoped. A "year-level gallery" (all year 9 design classes) could be a v3, but risks scope creep. Flag as FU-GV-CROSSCLASS.
6. **Featured submission archival.** If a round closes, should its featured submissions stay featured forever? Proposed: yes, featured is a permanent flag on the submission. 3D layer decides how to age things.
7. **Visitor → viewer-name editing.** Can a visitor update their own label ("Actually it's Mum")? Proposed: no. Teacher controls labels at generation time. Keeps attribution trustworthy.

---

## 12. Non-Goals

- **Real-time multiplayer cursors, drag-to-share, live edits.** Tier 3 was considered and rejected — students work independently, don't need synchronous co-creation. ~3-4 week infra lift not justified.
- **Visitor-to-visitor communication.** Visitors can't see each other's comments until the teacher approves them, and they can't reply to each other. This is a feedback surface for students, not a forum.
- **Voting, ranking, or best-of contests.** Same rule as v1 — MYP is criterion-referenced. Visitor reactions are for warmth, not competition.
- **Public search / discovery.** Gallery v2 is link-access-only. No "browse all public galleries on StudioLoom" — that's a different product.
- **Custom emojis or reaction sets per round.** Locked set of 5. Easy to adjust later without migration; premature flexibility otherwise.
- **3D rendering.** That's the [`3delements.md`](3delements.md) project's scope. v2 produces the featured-submissions contract and stops.

---

## 13. Why This Matters

Gallery v1 gave students a closed-loop crit. Good pedagogy, but the work never left the classroom. Gallery v2 does three things v1 couldn't:

1. **Lets the wider school community see what students are making.** Parents, other teachers, visiting classes, school leadership. The work becomes visible without being indiscriminately public.
2. **Gives students a reason to care about quality beyond the grade.** "Visitors will see this" is a different motivator from "the teacher will see this." Real audience = real stakes.
3. **Creates the substrate for everything downstream.** 3D exhibition rooms, parent portfolios, public alumni showcases, even school-to-school curriculum sharing — all of it sits on the same viewer-code + curation-flag primitives introduced here.

The Miro board framing (canvas + reactions + moderated comments) is also the single lightest path to "looks like a real product other schools want." Teachers already know what Miro is. Parents already know what reactions are. Low-concept-friction, high-pedagogical-value.

And the 3D handoff is a pure contract: a flag and three metadata columns. Which means the 3D project can start whenever it's ready, without blocking or being blocked by Gallery v2's ship.

---

*Spec status: ready for first implementation phase. Start with GV2-1 (Spatial Canvas Foundation).*
