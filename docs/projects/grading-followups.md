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
