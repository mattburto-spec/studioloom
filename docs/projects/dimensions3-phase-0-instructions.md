# Dimensions3 Phase 0 — Cleanup & Disconnection (Instructions for Code)

**Repo location:** `~/cwork/questerra` — this is the StudioLoom repo root. **First command of this session must be `cd ~/cwork/questerra`.** Every path below is written relative to this root (e.g., `src/lib/ingestion/pass-a.ts` means `~/cwork/questerra/src/lib/ingestion/pass-a.ts`). Do NOT create files outside this directory. Do NOT work in a worktree — stay on `main` in the main working tree.

**Spec source:** `docs/projects/dimensions3-completion-spec.md` §2 (Phase 0).
**Estimated effort:** 0.5 day.
**Branch rule:** Work on `main`. Do NOT use worktrees. `git branch --show-current` must return `main` before you start. Commit and push to `main` as each sub-task is verified.

Before starting, re-read these sections of the master spec `docs/projects/dimensions3.md`:
- §6.5 Library seeding
- §19 OS migration seams

And `CLAUDE.md` → "Known issues" section.

**Sanity check before any edits:**
```bash
cd ~/cwork/questerra
pwd                          # must print .../cwork/questerra
git branch --show-current    # must print: main
git status                   # note any in-flight changes before you begin
```

---

## Sub-task 2.1 — Delete duplicate ingestion files

**Context:** `src/lib/ingestion/passes/pass-a-classify.ts` and `pass-b-enrich.ts` are byte-identical duplicates of `src/lib/ingestion/pass-a.ts` and `pass-b.ts`. Nothing imports from `passes/`.

**Pre-verification:**
```bash
cd ~/cwork/questerra
rg -l "ingestion/passes" src/
```
Expected: empty output.

**Action:**
```bash
rm -rf ~/cwork/questerra/src/lib/ingestion/passes/
```

**Post-verification:**
```bash
cd ~/cwork/questerra
rg -l "ingestion/passes" src/    # must be zero
npx tsc --noEmit                    # must pass
```

**Commit:** `chore(dimensions3): delete duplicate ingestion/passes directory (Phase 0.1)`

---

## Sub-task 2.2 — Quarantine old knowledge upload route

**Context:** `src/app/api/teacher/knowledge/upload/route.ts` was un-quarantined 9 Apr prematurely. It still calls `analyse.ts` (old 3-pass) and writes to `knowledge_chunks` + `lesson_profiles`. Re-quarantine it. The new ingestion lives at `/api/teacher/knowledge/ingest`.

**First — find the existing quarantine pattern (do NOT invent a new constant):**
```bash
cd ~/cwork/questerra
rg "QUARANTINE_RESPONSE|quarantine" src/lib/ -l
rg "QUARANTINE_RESPONSE" src/ --type ts
```
Use whatever constant and import path you find. If there's no existing helper, grep for how other quarantined routes return 410 and copy that exact pattern.

**Action — edit `~/cwork/questerra/src/app/api/teacher/knowledge/upload/route.ts`:**
1. Replace the route body (GET/POST/etc. handlers) with the quarantine 410 response.
2. Add this header comment at the top of the file, directly after any existing imports:
```ts
// Quarantined 10 Apr 2026. Old knowledge pipeline.
// Use /api/teacher/knowledge/ingest (Dimensions3).
// Delete this file after 14 days (24 Apr 2026) if no incidents.
```
3. Do NOT delete `src/lib/knowledge/analyse.ts` — flagged for Phase 7 cleanup.

**Post-verification:**
```bash
cd ~/cwork/questerra
npm run dev &                                                               # start dev server
sleep 8
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/teacher/knowledge/upload
# Expected: 410
```

**Frontend audit:** Grep for any UI that hits this route:
```bash
cd ~/cwork/questerra
rg "teacher/knowledge/upload" src/ --type ts --type tsx
```
For each caller found, either hide the button OR replace with a "Migrated to new ingestion — use /teacher/knowledge/review" banner. Report each site changed in the commit message.

**Commit:** `feat(dimensions3): re-quarantine legacy knowledge/upload route (Phase 0.2)`

---

## Sub-task 2.3 — Rename `/admin/sandbox` → `/admin/simulator`

**Context:** The current `/admin/sandbox` page is the §7.6 Pipeline Simulator (offline, fixture-based). Calling it "sandbox" is confusing because the real §7.2 Generation Sandbox and §7.3 Ingestion Sandbox don't exist yet — they'll be built in Phase 7. Rename to free up the "sandbox" name.

**Actions:**

1. **Rename directory:**
   ```bash
   cd ~/cwork/questerra
   git mv src/app/admin/sandbox src/app/admin/simulator
   ```

2. **Edit `~/cwork/questerra/src/app/admin/simulator/page.tsx`:**
   - Change page heading: `"Pipeline Sandbox"` → `"Pipeline Simulator (offline)"`.
   - Update/add subtitle: `"Offline fixture-based simulator. Validates pipeline wiring. Zero AI calls. For live generation debugging, use Generation Sandbox (built in Phase 7)."`
   - Add a yellow banner at the top of the page content:
     ```tsx
     <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
       <p className="text-sm text-yellow-800">
         This simulator uses hardcoded fixture data. It does not generate real units.
       </p>
     </div>
     ```
     (Match existing Tailwind conventions in the file — if the file uses a different banner component, use that instead.)

3. **Update every nav link:**
   ```bash
   cd ~/cwork/questerra
   rg -l "/admin/sandbox" src/
   ```
   Edit each result to point at `/admin/simulator`. Also check `src/config/`, layouts, and nav arrays.

4. **Add a 301 redirect** in `~/cwork/questerra/next.config.js` (or `next.config.ts` — check which exists):
   ```js
   async redirects() {
     return [
       {
         source: '/admin/sandbox',
         destination: '/admin/simulator',
         permanent: true,
       },
     ];
   }
   ```
   If a `redirects()` function already exists, append this entry to its returned array.

**Post-verification:**
```bash
cd ~/cwork/questerra
npm run dev &
sleep 8
curl -s -I http://localhost:3000/admin/sandbox | head -1    # Expected: 308 or 301
curl -s http://localhost:3000/admin/simulator | grep -i "Pipeline Simulator (offline)"   # Expected: match
rg "/admin/sandbox" src/   # Expected: zero (the redirect lives in next.config, not src/)
```

**Commit:** `refactor(dimensions3): rename /admin/sandbox → /admin/simulator with redirect (Phase 0.3)`

---

## Sub-task 2.4 — Disconnect legacy schema writes from live routes

**Context:** Audit confirmed only `knowledge/upload` (now quarantined) writes to `knowledge_chunks` / `lesson_profiles`. Do a belt-and-braces sweep to confirm no other live route writes to these tables.

**Action:**
```bash
cd ~/cwork/questerra
rg 'from\("knowledge_chunks"\)|from\("lesson_profiles"\)|from\(.knowledge_chunks.\)|from\(.lesson_profiles.\)' src/
```

For each caller:
- If it's a **write** (insert/update/upsert/delete): quarantine the route (same 410 pattern as 2.2) or delete the code path. Report it in the commit message.
- If it's a **read-only** historical query: keep it and add this comment directly above the query:
  ```ts
  // Historical read — legacy pipeline, do not reintroduce writes.
  ```

**Do NOT drop the tables** — historical data still has value.

**Commit:** `chore(dimensions3): flag legacy knowledge_chunks/lesson_profiles reads, quarantine any remaining writes (Phase 0.4)`

---

## Sub-task 2.5 — Verify OS migration seams (§19)

Spec §19 requires 4 OS seams. Verify each.

### Seam 1 — Stateless pass functions

Open `~/cwork/questerra/src/lib/ingestion/pass-a.ts` and `~/cwork/questerra/src/lib/ingestion/pass-b.ts`. Confirm:
- Function signature is `(input, config) => Promise<output>` with `config` carrying `supabaseClient`.
- No `createClient()` calls inside the function body.
- No `req` / `NextRequest` parameter.

If any violation, refactor until the function is pure. This is a hard requirement.

### Seam 2 — `module` column on `activity_blocks`

Check if it exists:
```bash
cd ~/cwork/questerra
rg "ADD COLUMN.*module" supabase/migrations/
```

If missing, create `~/cwork/questerra/supabase/migrations/065_os_seams_and_class_id.sql` (combined with 2.9 below) containing:
```sql
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'studioloom';
CREATE INDEX IF NOT EXISTS idx_blocks_module ON activity_blocks(module);
```

### Seam 3 — `content_items` table

Already exists per migration 063. Verify schema has: `module`, `pass_results`, `file_hash`, `processing_status`. If any are missing, add to 065 as `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS ...`.

### Seam 4 — `activity_blocks.media_asset_ids`

Check if it exists:
```bash
cd ~/cwork/questerra
rg "media_asset_ids" supabase/migrations/
```

If missing, add to 065:
```sql
ALTER TABLE activity_blocks ADD COLUMN IF NOT EXISTS media_asset_ids UUID[] DEFAULT '{}';
```

---

## Sub-task 2.9 — `student_progress.class_id` migration

**Context:** Master spec audit flagged `student_progress` missing `class_id` as a multi-class enrollment architecture gap. Matt decided 2026-04-10 to fix in Phase 0 before anything downstream assumes the old schema.

**Migration file:** combine with 2.5 above in `~/cwork/questerra/supabase/migrations/065_os_seams_and_class_id.sql`.

**Append to that migration:**
```sql
-- Add class_id to student_progress
ALTER TABLE student_progress
  ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX idx_student_progress_class ON student_progress(class_id, student_id);

-- Backfill: single-class students get auto-linked. Multi-class students stay NULL for manual resolution.
UPDATE student_progress sp
SET class_id = cs.class_id
FROM class_students cs
WHERE sp.student_id = cs.student_id
  AND (
    SELECT COUNT(*) FROM class_students cs2
    WHERE cs2.student_id = sp.student_id
  ) = 1;
```

**After running the migration, run this ambiguity report:**
```sql
SELECT COUNT(*) AS ambiguous_rows
FROM student_progress
WHERE class_id IS NULL
  AND student_id IN (
    SELECT student_id FROM class_students
    GROUP BY student_id HAVING COUNT(*) > 1
  );
```

**If `ambiguous_rows > 0`, STOP and report the count to Matt before proceeding.** He resolves manually via SQL. Phase 0 does NOT complete until this is zero.

**Write-path code updates:**
```bash
cd ~/cwork/questerra
rg "INSERT INTO student_progress|from\('student_progress'\)\.insert|from\(.student_progress.\)\.upsert" src/
```

For every write site found, update the payload to include `class_id` derived from the current class context (usually available from the route's class session, student token, or request body). Endpoints known to write:
- `/api/student/progress/*`
- `/api/student/tool-session`
- Lesson save handlers
- Any server action that creates progress rows

Report every file modified in the commit message.

**Commit:** `feat(dimensions3): add student_progress.class_id + OS seams migration 065 (Phase 0.5+0.9)`

---

## Sub-task 2.10 — Verify `generation_runs.is_sandbox` flag

**Context:** Phase 7 §9.1 assumes this column exists so sandbox runs don't pollute live analytics. Check first.

**Check:**
```bash
cd ~/cwork/questerra
rg "is_sandbox" supabase/migrations/
```

If already present on `generation_runs`, skip. Otherwise, create `~/cwork/questerra/supabase/migrations/066_generation_runs_sandbox_flag.sql`:

```sql
ALTER TABLE generation_runs
  ADD COLUMN is_sandbox BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_generation_runs_sandbox ON generation_runs(is_sandbox, created_at DESC);
```

**Do not yet update dashboard queries** — that's a Phase 4 task. Just note in the commit message that Phase 4 dashboard queries will need `WHERE is_sandbox = false`.

**Commit:** `feat(dimensions3): add generation_runs.is_sandbox flag (migration 066, Phase 0.10)`

---

## Phase 0 Final Verification

Run every check in order. All must pass before declaring Checkpoint 0.1 ready.

```bash
cd ~/cwork/questerra

# File cleanup
rg "ingestion/passes" src/                          # Expected: zero
rg "/admin/sandbox" src/                             # Expected: zero (redirect lives in next.config)

# Route quarantine
npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/teacher/knowledge/upload   # Expected: 410

# Migration verification (run in Supabase SQL editor)
# SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_blocks' AND column_name IN ('module', 'media_asset_ids');   -- 2 rows
# SELECT column_name FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'class_id';                       -- 1 row
# SELECT column_name FROM information_schema.columns WHERE table_name = 'generation_runs' AND column_name = 'is_sandbox';                       -- 1 row
# SELECT COUNT(*) FROM student_progress WHERE class_id IS NULL AND student_id IN (SELECT student_id FROM class_students GROUP BY student_id HAVING COUNT(*) > 1);   -- 0

# Stateless pass check
# Manually open src/lib/ingestion/pass-a.ts and pass-b.ts — confirm no createClient() inside function bodies.

# Write-path audit
rg "student_progress.*insert|insert.*student_progress" src/ --type ts    # Every result must include class_id

# Build & tests
npm run lint
npx tsc --noEmit
npm test
```

All must pass.

---

## 🛑 Checkpoint 0.1 — Cleanup verified

Code pauses here and writes to Matt:

> 🛑 **Checkpoint 0.1 ready.** To verify:
>
> 1. Visit `/admin/simulator` in browser — confirm heading says "Pipeline Simulator (offline)" with yellow fixture-data banner.
> 2. Visit `/admin/sandbox` — confirm it redirects to `/admin/simulator`.
> 3. In Supabase SQL editor, run:
>    ```sql
>    SELECT column_name FROM information_schema.columns
>    WHERE table_name IN ('activity_blocks', 'student_progress', 'generation_runs')
>      AND column_name IN ('module', 'media_asset_ids', 'class_id', 'is_sandbox');
>    ```
>    Expect 4 rows returned.
> 4. Paste a screenshot of `/admin/simulator` into the Phase 0 evidence file at `~/cwork/questerra/docs/evidence/phase0-simulator.png`.
>
> Expected: all 4 pass. Reply `checkpoint pass` or `checkpoint fail: [reason]`.

**Do not proceed to Phase 1 until Matt replies `checkpoint pass`.**

---

## If Checkpoint 0.1 fails (rollback)

```bash
cd ~/cwork/questerra
git log --oneline main   # note the last pre-Phase-0 commit hash
git revert <phase-0-commit-hashes>   # revert in reverse order
git push origin main
```

Then re-attempt only the failing sub-task. Do NOT proceed to Phase 1 until Phase 0 is verifiably complete.

---

## Saveme update after Phase 0 passes

Once Matt says `checkpoint pass`, write a short note to Matt asking him to run `saveme` so the following get synced:
- `docs/projects/ALL-PROJECTS.md` — Dimensions3 progress (Phase 0 complete)
- `docs/projects/WIRING.yaml` — any schema changes
- `docs/changelog.md` — Phase 0 session entry
- `docs/resolved-issues-archive.md` — move "student_progress lacks class_id" from Active → Resolved
