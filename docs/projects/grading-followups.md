# Grading — Follow-up Tickets

> Items surfaced during G1.x sub-phase work that are NOT blockers for the
> phase they were found in, but should be resolved before G1 is declared
> complete (or, where noted, deferred to a later phase). Each entry: short
> title, when surfaced, symptom, suspected cause, suggested investigation,
> target phase.

---

## GRADING-FU-RPC-ATOMICITY — Migrate save-tile-grade to Supabase RPC
**Surfaced:** G1.1.2 service authoring (28 Apr 2026)
**Priority:** P3
**Target phase:** Before G4 (consistency checker) ships

**Symptom:** `saveTileGrade()` in [src/lib/grading/save-tile-grade.ts](../../src/lib/grading/save-tile-grade.ts) writes the grade row + the audit event row sequentially. A connection drop between the two leaves a grade row with no audit trail.

**What we know:** Postgres rarely fails an INSERT after a successful UPSERT in the same connection. For the pre-customer state (no real students yet, audit table has no consumers), the gap is theoretical. The brief approved RPC at Q1.1.D but I chose sequential to avoid a second migration cycle during G1.1.

**Investigation steps:**
1. Author `save_tile_grade()` PL/pgSQL function via a new migration. Inputs match `SaveTileGradeInput`. Returns `{ grade, event }` JSON.
2. Update the service to call `client.rpc("save_tile_grade", input)` and unwrap the return.
3. Tests: replace the mocked-Supabase scaffolding with a single mocked `rpc()` call.
4. Apply migration to prod. Smoke: confirm a save still writes both rows.

**Why deferred:** The audit table has no read consumers yet. First consumer is G4 consistency checker. Migrate to RPC during G4 setup.

---

## GRADING-FU-DEVSERVER-NEWROUTE — Next.js dev mode 404s on new top-level routes
**Surfaced:** G1.1.3 visual smoke attempt (28 Apr 2026)
**Priority:** P2 (blocks visual smoke; does not block code review or tests)
**Target phase:** Resolve before Checkpoint G1.1 sign-off

**Symptom:** Next.js 15.3.9 dev server in the `questerra-grading` worktree consistently returns 404 for any *new* top-level route created after the server starts — even after a full restart with `.next` cache cleared. Existing routes (`/teacher/dashboard`, `/teacher/classes`) compile + serve fine.

**Reproduced with:**
- `/teacher/marking/page.tsx` (the actual G1.1.3 page, ~580 lines)
- `/teacher/zzztest/page.tsx` (minimal `"use client"; export default () => <div/>`)
- Both 404 in 17–100 ms — too fast to involve compilation, suggesting Next has cached "no route" decisions

**What we tried:**
- Multiple full server stop/start cycles (fresh `serverId` each time)
- `rm -rf .next` between restarts
- `touch tsconfig.json` to trigger route rescan
- Recreated the directory with different attribute states
- Verified file is readable, not gitignored, owns correct permissions
- Verified `tsconfig.json` `include` covers the path
- Verified no rewrite/redirect blocks the route in `next.config.ts`
- Verified middleware doesn't 404 it (would redirect to login if blocking)

**Suspected cause:** `fsevents` file-watcher quirk specific to this worktree's state. The dev server scans routes at startup and apparently doesn't re-scan when new directories appear. Possible interaction with macOS extended attributes (the `marking/` dir initially lacked the `@` extended-attribute marker that other dirs have).

**Investigation steps:**
1. Run `npx next build && npx next start` in this worktree — production mode bypasses the watcher; if the route compiles + serves, the issue is dev-mode-only and the code is fine.
2. Run `npm run dev` on Matt's primary machine (different `fsevents` state may behave correctly).
3. Last-resort: `rm -rf node_modules && npm install` to reset watcher state.
4. If still broken: `git clean -fdx` + fresh worktree clone.

**Why P2:** Code is verified by TypeScript + 46 unit tests. The runtime issue is environmental. Visual smoke is the only blocker on Checkpoint G1.1 sign-off, but the visual layer can also be smoked once route registration works (no code rewrite needed).

---

## Resolved

### TFL-FU-CLOCK-SKEW — JS-vs-DB clock skew on read-receipt bump (RESOLVED 10 May 2026)
**Surfaced:** TFL.1 Checkpoint 1.1 step 1 smoke (10 May 2026 — Matt saw GREEN dot in cold state, expected GREY)
**Resolved by:** PR #147 / commit `27c8670` / migration `20260509222601_add_bump_student_seen_comment_at_rpc.sql`

**What happened:** TFL.1.2's inline `.update({ student_seen_comment_at: new Date().toISOString() })` shipped a Node-stamped timestamp across the wire. The `student_tile_grades` BEFORE-UPDATE trigger then set `updated_at = now()` from Postgres time ~100–200ms LATER, so `student_seen_comment_at` landed BEFORE `updated_at` on the same UPDATE. The chip's `seen >= updated_at` rule returned false on a brand-new receipt and the tooltip read "Seen the older version" instead of "Seen the latest". Live Supabase row from the smoke: `seen = 05:31:14.302`, `updated_at = 05:31:14.455` — 153ms gap, all on the same connection.

**Fix:** New SECURITY DEFINER PL/pgSQL function `bump_student_seen_comment_at(p_student_id, p_unit_id, p_page_id)` that does `SET student_seen_comment_at = now()`. Both the SET clause and the trigger's `updated_at` derive from the same Postgres `now()` (transaction-start time, identical across both). Route now calls `.rpc("bump_student_seen_comment_at", {...})` instead of an inline UPDATE. Migration locks `search_path = pg_catalog, public` (Lesson #66) and revokes EXECUTE from PUBLIC/anon/authenticated, granting only to `service_role` (Lesson #52). Filters non-null + non-empty `student_facing_comment` so empty rows still can't get a false receipt.

**Regression guards:**
- `src/app/api/student/tile-comments/__tests__/route-seen-bump.test.ts` rewritten to assert the `.rpc()` call; explicit code-only assertions that `new Date().toISOString()` and inline `.update({ student_seen_comment_at:` never come back.
- `src/lib/grading/__tests__/migration-tfl1-rpc-shape.test.ts` NEW (8 assertions): function signature, SECURITY DEFINER, search_path lockdown, body uses `now()` + has no TIMESTAMP arg, non-null + non-empty filter, scope to student/unit/page, REVOKE+GRANT pattern, .down.sql drops with IF EXISTS.

**Lesson generalised:** Anywhere two DB-written timestamps must compare correctly on the same row, never let one of them be stamped on the client. Either both come from Postgres `now()` (preferred — transaction-start time guarantees identity) or both come from the same wall clock the comparison runs against. The trigger-vs-SET-clause pattern is especially seductive because it looks atomic; it isn't.

---

## Open

### TFL2-FU-AUDIT-LOG-STUDENT-REPLIES — Audit log for student feedback replies
**Surfaced:** TFL.2 Pass B sub-phase B.3 (10 May 2026 — deferred mid-build)
**Priority:** P3
**Target phase:** Post-Pass-B if compliance / dispute review requires it

**Symptom:** Student replies persist in `tile_feedback_turns` (the source of truth) but produce no row in any audit table. The existing `student_tile_grade_events` audit table requires a non-null `teacher_id` and has a fixed source enum (`ai_pre_score`/`teacher_confirm`/`teacher_override`/`teacher_revise`/`rollup_release`/`system_correction`) — student-initiated events don't fit.

**What we know:**
- Pass B brief (10 May 2026) called for new event types `student_reply_got_it` / `_not_sure` / `_pushback`.
- Schema modification is non-trivial: either (a) drop the NOT NULL on `teacher_id` + extend the source enum, or (b) create a parallel `student_tile_grade_student_events` table.
- (a) introduces a polymorphic-events smell; (b) creates two audit surfaces to keep in sync.
- For v1 pilot scope: the turn row itself is the audit record (immutable on this branch since `tile_feedback_turns` doesn't UPDATE student rows post-insert).

**Investigation steps:**
1. Decide between options (a) and (b) when a compliance / dispute use case actually demands it.
2. If (a): migration ALTER TABLE drop-NOT-NULL + extend CHECK enum. Backfill not needed.
3. If (b): new table + RLS + reader for /admin/audit surface.
4. Either way: surface a `parent_grade_id` + `student_id` so the audit row is traceable.

**Why deferred:** No compliance use case exercising it yet. The `tile_feedback_turns` row IS the audit record for v1. Bigger schema move than B.3 could absorb.

### TFL2-FU-PER-TURN-READ-RECEIPTS — Per-turn read-receipt tracking
**Surfaced:** TFL.2 Pass B planning (10 May 2026 — explicitly out of v1 scope)
**Priority:** P3
**Target phase:** Post-Pass-B if multi-turn read-state ambiguity becomes a real complaint

**Symptom:** TFL.1's `student_seen_comment_at` column tracks "latest time the student loaded a page with feedback turns on it" — single timestamp per grade row, not per turn. With multi-turn threads, a student could "see" turn 1 but not be aware of turn 3 (the teacher's follow-up) before the chip's read-state ladder considers them caught up. In practice this rarely matters because the student loads the page, sees the FULL thread, and the chip dot reflects "latest seen" — but if a teacher sends a follow-up while the student is offline, the next page load updates `student_seen_comment_at` even though the student may not have actually scrolled to / processed the new turn.

**What we know:**
- v1 design choice: latest-seen-only is sufficient for the chip dot ladder (green / amber / grey).
- The `<TeacherFeedback />` component does already pulse the new teacher turn with a 1.4s glow ring on first paint, which is the visual cue students get.
- Per-turn tracking would require: new `tile_feedback_turn_seen` association table (turn_id, student_id, seen_at) + RPC bumps per turn rendered + chip logic to derive "any unseen turn exists in this thread?"

**Why deferred:** No use case yet. v1 latest-seen is good enough for the chip + bell. Track in case multi-turn ambiguity surfaces in real classroom use.

### TFL3-FU-INBOX-COHORT-COMPARISON — Cohort comparison view inside the inbox
**Surfaced:** TFL.3 Pass C close-out (12 May 2026 — explicitly out of C scope)
**Priority:** P3
**Target phase:** Post-pilot polish if teachers ask to spot class-level patterns

**Symptom:** The inbox lists items linearly (Scott, Scott, Scott, Maya, …). For a teacher with 100+ items across 5 classes the per-student firehose obscures patterns — e.g. "in 9 Design S2, half the class is confused about the same prompt" is something the cohort view at /teacher/marking surfaces but the inbox flatness doesn't.

**What we know:**
- Existing infra: `/teacher/marking` cohort heatmap already groups by class × tile. Inbox could co-locate a "by cohort" toggle that re-buckets the visible items.
- Grouping key would be `${classId}::${unitId}::${pageId}::${tileId}` (same key the auto-draft warm-up already uses).
- Probably an inline expander rather than a separate view — "▾ Show all 8 students with this tile in 9 Design S2" under a section header.

**Why deferred:** v1 of the inbox is the daily-driver "approve and go" surface. Cohort grouping is a power-user feature that needs real teacher feedback before designing. Pilot first, then re-evaluate.

### TFL3-FU-ASK-TEMPLATES — Pre-set ask templates for the + Ask tweak
**Surfaced:** TFL.3 C.4 close-out (12 May 2026)
**Priority:** P3
**Target phase:** Post-pilot polish when teacher usage tells us which directives recur

**Symptom:** The "+ Ask" tweak is free-form (teacher types any instruction). Likely the same 3-5 instructions get typed repeatedly across the cohort ("mention the design cycle", "reference the criterion descriptor", "ask for an example", "use simpler vocabulary"). Saving these as one-click templates would compress the workflow further.

**What we know:**
- Helper accepts arbitrary askText already (capped at 400 chars), so no helper change needed.
- UI lives in TweakRow → ask panel: add a row of preset chips above the input ("mention design cycle" · "ask for example" · "simpler language") that pre-fill the input on click; teacher hits Enter to fire.
- Persistence layer: per-teacher in localStorage for v1; promote to `teacher_preferences.ask_templates` JSONB if cross-device demand emerges (same trajectory as C.3.3 resolved_at).

**Why deferred:** Need ≥2 weeks of real usage data to know which templates teachers actually want. Hard-coding 3 generic ones now risks polluting the muscle memory before it forms. Add usage logging to /api/teacher/grading/regenerate-draft → metadata: { directive, askText } so we can mine for repeat patterns.

### TFL3-FU-INBOX-PUSH-ESCALATION — Notification escalation when reply_waiting crosses threshold
**Surfaced:** TFL.3 Pass C close-out (12 May 2026)
**Priority:** P3
**Target phase:** Post-pilot polish if backlog drift becomes a real problem

**Symptom:** A teacher who's away from school for a day comes back to 12 reply_waiting items + a few drafted that have aged 24h+. The TopNav badge surfaces the COUNT but doesn't escalate when the count crosses a threshold or when individual items age past N hours. The bell + email notification systems exist (TFL.1 + Phase 6 / Resend helper) but aren't wired to inbox state.

**What we know:**
- Existing infra: Resend email helper + `notifications_sent` idempotency table (from Preflight Phase 1B-2), bell endpoint at /api/teacher/notifications.
- Thresholds to consider: (a) reply_waiting > 5 — generate a daily digest email if not opened in 48h, (b) any single reply_waiting > 72h old — bell notification, (c) Friday afternoon "you have N waiting going into the weekend" nudge.
- Risk: notifying too aggressively trains teachers to dismiss them. v1 should be opt-in via teacher_preferences.inbox_digest_email_enabled.
- The count endpoint /api/teacher/inbox/count already returns the data; a daily cron + email template + opt-in toggle finishes it.

**Why deferred:** v1 of the inbox + Marking badge is enough surface area. Teachers need to internalize the daily-driver flow before adding escalation layers — otherwise it just becomes noise. Re-evaluate after 2 weeks of pilot use.

### TFL3-FU-STUDENT-IB-IMAGES-MISSING — Inspiration Board images not displaying in student lesson view
**Surfaced:** TFL.3 C.7.2 smoke (13 May 2026 — Matt's test student)
**Priority:** P1 — broken UX for students viewing their own work
**Target phase:** Next session, with DevTools data captured

**Symptom:** A student uploads images to an Inspiration Board block on a lesson page. Teacher sees them fine in `/teacher/marking` (focus panel + row expansion both render the thumbnails). The same student, viewing their own lesson page, does NOT see the thumbnails — they're either broken or absent.

**What we know:**
- Upload route (`/api/student/upload`) returns a relative proxy URL (`/api/storage/responses/{studentId}/{unitId}/{pageId}/{timestamp}.{ext}`) via `buildStorageProxyUrl()`.
- Student IB block (`src/components/student/inspiration-board/InspirationBoardBlock.tsx:543`) renders `<img src={item.url}>` directly — same shape as `InspirationBoardPreview.tsx` on the teacher side.
- Storage proxy (`/api/storage/[bucket]/[...path]/route.ts`) gates via `supabaseSsr.auth.getUser()`. Authorize logic in `authorize.ts` for `responses` bucket: student must have `students.user_id === auth.uid` AND `students.id === path[0]`.
- Teacher cookie auth works (we can see the thumbnails in marking). Student cookie auth fails (or 403s on authorize).

**Investigation steps (do NEXT session with Matt):**
1. Open student lesson view as the test student, with DevTools Network tab open.
2. Filter for `/api/storage/responses/...` requests.
3. Capture the status code (401? 403? 404? CORS?). Capture the response body.
4. If 401 → Supabase Auth cookie isn't being sent (or doesn't resolve). Check if the student is lazy-provisioned in `auth.users` (`SELECT user_id FROM students WHERE id = '...'`).
5. If 403 → cookie resolves but authorize.ts rejects. Likely paths:
   - `app_metadata.user_type !== "student"` on the test student
   - `students.user_id !== auth.uid` (lazy-provision row mismatch)
   - The path's first segment doesn't match the student's `students.id`
6. If the test student was created BEFORE the Access Model v2 lazy-provision migration (~9 May 2026), they may need a backfill row in `auth.users`. Check `scripts/access-v2/backfill-student-auth-users.ts`.

**Why this matters:** students need to see their own uploaded work or the lesson UX is broken from the moment they upload. Pilot-blocker if it affects all students. If it's just Matt's specific test account (pre-Access-v2), it's a one-off backfill, not a code fix.

**Likely fixes (pending diagnosis):**
- Backfill missing `auth.users` row for the test student.
- OR: fix authorize.ts if there's a real bug in the per-student path check.
- OR: if the student's cookie isn't being sent on the storage request, check sameSite/secure flags on the student session cookie.
