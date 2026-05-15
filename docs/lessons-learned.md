# Lessons Learned — CRITICAL

> Extracted from CLAUDE.md on 7 Apr 2026. Read before any batch operations or major code changes. CLAUDE.md now points here.

> **CRITICAL — read before batch operations**

### 1. NEVER batch-modify JSX structure with regex/sed/perl
The Framer Motion disaster (18-19 Mar 2026) destroyed 23 tool components. What happened:
- Batch agent added `<motion.div>` by replacing `<div>` in opening tags
- Closing `</motion.div>` was placed on INNER divs instead of outermost containers
- Attempting to fix with `sed`/`perl` regex deleted opening `<div>` lines that contained animation attributes
- This cascaded into orphaned `</div>` tags, breaking JSX nesting across ALL files
- TypeScript's basic parser (`createSourceFile`) said "OK" but Next.js SWC/Webpack caught real JSX errors
- **LESSON:** Never use regex to modify JSX tag structure. Either rewrite the full component or use the Edit tool for surgical, verified changes.

### 2. Always use `tsc --noEmit` not just `createSourceFile` for JSX validation
`ts.createSourceFile()` only checks syntax — it misses:
- Unclosed JSX elements
- Mismatched opening/closing tags
- Invalid attributes on HTML elements (e.g., `hover` in inline styles)
Run `npx tsc --noEmit --jsx react-jsx --skipLibCheck <file>` to catch real JSX errors.

### 3. Client components cannot import server-only modules
`createAdminClient()` (which reads `SUPABASE_SERVICE_ROLE_KEY`) must NEVER be imported in `"use client"` components. The `onUnitCreated` signal was originally imported in a client page — moved to server-side API route.

### 4. Student auth uses token sessions, not Supabase Auth
Students authenticate via `SESSION_COOKIE_NAME` cookie → `student_sessions` table → `student_id`. NOT via `supabase.auth.getUser()`. The Design Assistant route had this bug — was using teacher auth pattern for students.

### 5. Framer Motion must be installed in the project directory, not home
`npm install framer-motion` in `~` instead of `~/CWORK/questerra` created a conflicting `package-lock.json` that made Next.js infer the wrong workspace root.

### 6. Duplicate tool names in tools-data.ts cause React key warnings
When adding interactive versions of existing template tools, either remove the template entry or rename it with "(Template)" suffix. React keys must be unique.

### 7. School profile belongs in Teacher Settings, not AI controls
School facts (period length, workshop access, doubles) are set once and rarely change. They belong in the teacher settings page, not alongside the AI tuning dials. The AI reads them from the teacher profile at generation time.

### 8. Timing model must be a learning system, not fixed values
Hard-coded timing limits ("max 15 min for direct instruction") are the wrong approach. The system should learn from teacher uploads, edits, and feedback. Cold-start defaults exist only for day-one teachers with no data.

### 9. Student-facing components must use student auth routes
The pace feedback pulse was mounted on a student page but called a teacher auth endpoint (`requireTeacherAuth`), causing 401s. Any API call from a student-rendered component MUST use `/api/student/*` routes with `requireStudentAuth`. Student auth = cookie token session (`SESSION_COOKIE_NAME`), NOT Supabase Auth. This is the same bug that hit the Design Assistant (Lesson Learned #4) — it keeps recurring because it's easy to copy teacher route patterns.

### 10. Admin AI controls need macro/micro hierarchy
50+ individual sliders are engineer-facing, not teacher-facing. Teachers think in terms of "more workshop, less theory" — not "set scaffoldingFade to 7." The macro dials (5 big concepts) → micro sliders (50+ detailed controls) hierarchy serves both audiences.

### 11. Vercel CDN strips Set-Cookie from Cache-Control: public responses
Next.js Route Handlers default to `Cache-Control: public, max-age=0, must-revalidate`. Vercel CDN sees "public" and strips the `Set-Cookie` header from the response — the cookie never reaches the browser. **Any route that sets cookies (login, session, auth) MUST explicitly set `Cache-Control: private, no-cache, no-store, must-revalidate`.** We also added a belt-and-suspenders rule in `next.config.ts` headers for `/api/auth/:path*`. This is Vercel-specific — doesn't happen in local dev, so you won't catch it until production.

### 13. Default vs named exports cause React #130 on Vercel
If a component uses `export default function Foo`, it MUST be imported as `import Foo from "./Foo"` (default import). Using `import { Foo } from "./Foo"` (named import) resolves to `undefined`, causing React error #130 ("Element type is invalid: expected a string or class/function but got undefined"). This works in dev sometimes due to HMR but fails on Vercel production builds. **Rule:** Always check whether a component uses `export default` or `export { Foo }` before writing the import. The barrel file (`index.ts`) re-exports tell you: `export { default as Foo } from "./Foo"` = default export, `export { Foo } from "./Foo"` = named export.

### 14. Always normalize content data before accessing .pages
StudioLoom has 4 content versions: v1 (Record<PageId, PageContent>), v2 (pages array), v3 (journey-based), v4 (timeline). Direct `.pages` access fails silently for v1 (object, not array) and v4 (uses `.timeline`). **Always call `normalizeContentData()` from `@/lib/unit-adapter` before extracting pages.** This converts all versions to a consistent v2-style format with a `.pages` array. The useLessonEditor hook was initially broken because it skipped normalization — content loaded fine but `pages` was undefined for non-v2 units.

### 15. npx tsx can't find project node_modules
`npx tsx scripts/foo.ts` creates an isolated execution environment that can't resolve packages from the project's `node_modules`. **Fix:** Use `./node_modules/.bin/tsx` (requires node_modules to exist) or rewrite as `.mjs` with manual env loading and native Node.js imports. The `.mjs` approach is more portable for scripts that need to run in different environments.

### 16. Project does NOT use lucide-react — all icons must be inline SVGs
lucide-react is not installed in the project. Importing from it causes Vercel build failures (`Module not found: Can't resolve 'lucide-react'`). **Fix:** Create inline SVG components at the top of each file: `const XIcon = ({ size = 24 }: { size?: number }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">...</svg>);`. This bit us when gallery components were built by agents that assumed lucide-react was available. Check package.json before importing icon libraries.

### 17. Retry insert without new columns for migration-gapped deployments
When adding a new column via migration (e.g., `unit_type` in migration 051) and immediately using it in an insert payload, the insert will 400 on production if the migration hasn't been applied yet. **Fix:** Wrap the insert in a retry that strips the new column(s) from the payload on failure: `if (error && (error.message.includes("unit_type") || error.code === "PGRST204")) { delete payload.unit_type; retry... }`. This gives graceful degradation during the gap between code deploy and migration apply. Applied in `create/page.tsx` `saveUnit()` for `unit_type`.

### 18. Always show save/generation errors to the user
The StickyBuildBar component originally had no error display during the review phase. When `saveUnit()` failed (400 from missing column), the error was dispatched via `SET_ERROR` to state but never rendered — the Save Unit button just did nothing. **Fix:** Pass `error={state.error}` to StickyBuildBar and render a red banner above the action buttons. General rule: any component with an action button must have a visible error state.

### 12. PostgREST PGRST201 ambiguous relationships after adding junction tables
When you add a junction table that creates a second FK path between two existing tables (e.g., `class_students` between `students` and `classes`, alongside the existing `students.class_id` FK), PostgREST can't auto-resolve nested selects like `.select("students(... classes(...))")`. It returns HTTP 300 with a PGRST201 error listing both relationship paths. **Fix options:** (a) use PostgREST `!fk_name` hint syntax to disambiguate (e.g., `.select("classes!class_students(id, name)")`), or (b) query tables separately with no nested joins (what we did — simpler, no Supabase SDK version dependency). This will happen every time a junction table duplicates an existing direct FK relationship. Plan for it when writing migration 041-style additive junction tables.

### 19. Never add new/optional columns to PostgREST nested selects
Adding a column like `unit_type` to `units!inner(id, title, content_data, nm_config, unit_type)` in a Supabase query can cause PostgREST to fail **silently** — the entire query returns empty data, not an error. This broke the teacher dashboard (showed "No units assigned" for all teachers). **Fix:** Fetch new/optional columns in a **separate query** wrapped in try/catch. Build a lookup map, then merge the data in the response loop. This is the same resilient pattern used for `unit_type` in the dashboard API: separate `supabase.from("units").select("id, unit_type").in("id", uniqueUnitIds)` with try/catch that silently ignores if the column doesn't exist.

### 21. useEffect infinite loops from loading state in dependency array
If a useEffect includes a loading state variable (e.g., `gradeLoading`) in BOTH its dependency array AND its guard condition, AND the effect calls a function that toggles that state, the effect will re-fire endlessly: effect runs → sets loading=true → loading=false on complete → effect re-fires. **Fix:** Use a `useRef` as a "loaded" guard instead of the loading state. Set the ref to `true` before calling the loader, reset to `false` when the tab/context changes. Remove the loading state and loader callback from the dependency array. Add `// eslint-disable-next-line react-hooks/exhaustive-deps` with explicit comment explaining why. This pattern hit the Class Hub Grade tab (28 Mar 2026) — content flashed white for a split second then disappeared back to grey because it was rendering during the brief `gradeLoading = false` window between infinite loop iterations.

### 20. Verify Supabase helper import names match exports
`@/lib/supabase/server.ts` exports `createServerSupabaseClient`, NOT `createServerClient`. The raw `createServerClient` from `@supabase/ssr` has a different function signature (no cookie handling). Importing the wrong one compiles fine but fails at runtime with auth errors. The class-profiles route had this bug — 500 error on every request. **Rule:** When importing from project Supabase wrappers, always check the exact export name.

### 22. Always use junction-first + legacy-fallback for student lookups in teacher APIs
After migration 041 added the `class_students` junction table, every teacher API route that lists students in a class must query `class_students` first, then fall back to `students.class_id` if the junction returns empty. Pattern: `try { junction query } catch {} → if empty, legacy fallback`. Routes that were fixed: teach/live-status, nm-observation, nm-results, badges/class-status, class-profiles, open-studio/status (GET+POST), badges/[id]/results. **Rule:** Any new teacher API route that lists "students in class X" must use this pattern. Grep for `.eq("class_id", classId)` on the `students` table to find violations.

### 23. Edit buttons must always route to Phase 0.5 editor, not old basic editor
The old edit page at `/teacher/units/[unitId]/edit` is the basic purple-squares editor. The Phase 0.5 editor at `/teacher/units/[unitId]/class/[classId]/edit` is the full drag-and-drop editor. Any "Edit" button should link to the Phase 0.5 editor when the unit has at least 1 assigned class (use the first class). The old edit page also auto-redirects to Phase 0.5 if any class is found. Only units with zero assigned classes see the old editor.

### 24. Never assume column names exist in production — use select("*") or independent try/catches
Replacing `select("*")` with explicit column lists (e.g., `select("id, title, description, topic, tags, ...")`) on the `units` table caused 400 errors because many columns (`description`, `topic`, `tags`, `grade_level`, `duration_weeks`, `author_name`, `school_name`, `fork_count`, `is_published`) don't actually exist in the production schema. PostgREST returns 400 (not empty data) for non-existent columns. **Rules:** (1) Use `select("*")` for client-side queries where you're OK fetching everything. (2) If you MUST use explicit columns, only list columns you've verified exist via migration history. (3) For optional columns (migration may/may not be applied), always use separate try/catch queries — never combine with required columns. (4) When merging two independent optional-column queries into one try/catch, if EITHER fails, BOTH results are lost. Always keep independent try/catches for independent data.

### 25. Orphaned class_meetings entries cause "Unknown" class in schedule
When a class is deleted, its entries in `class_meetings` remain (no cascade delete). The schedule API at `/api/teacher/schedule/today` tries to resolve class names via `classNameMap.get(m.class_id) || "Unknown"`. If the class_id points to a deleted class, it shows "Unknown" in the Coming Up section. **Fix:** Teachers must manually remove stale timetable entries after deleting a class, or we need a cascade delete / cleanup trigger on class deletion.

### 26. AI JSON schema field ordering matters — put required fields before verbose arrays
When an AI prompt returns a large JSON schema, the model generates fields in schema order. If `max_tokens` is reached, the auto-repair logic closes braces to produce valid JSON — silently dropping any fields not yet output. **Rule:** Put compact, high-value fields (enums, numbers, short objects) BEFORE verbose arrays (phase_analysis, criteria_analysis) in the schema. Also add explicit "REQUIRED" instructions for critical fields. This bit us with Dimensions v2 fields (udl_coverage, bloom_distribution, grouping_analysis) being dropped because they were at the bottom of Pass 2's schema after two large arrays. Fixed by reordering + bumping max_tokens.

### 27. Empty forks shadow master content — always check for actual pages, not just truthiness
`resolveClassUnitContent()` used `classUnitContent ?? masterContent` — the nullish coalescing only falls back on `null`/`undefined`. An empty object `{}` is truthy but has no pages. If a fork is accidentally created (e.g., auto-save triggers `ensureForked()` before content is loaded), `class_units.content_data` gets set to `{}` which shadows the master forever. **Fix:** Added `hasContent(data)` helper that checks all 4 content versions (v1 object pages, v2 pages array, v3 journey, v4 timeline) for actual content. Used in `resolveClassUnitContent()`, `getResolvedContent()`, `ensureForked()`, and the content API GET route. **Rule:** Never use truthiness (`!!data` or `data ??`) to check for valid content_data — always use `hasContent()`.

### 28. Per-keystroke tracking causes absurd metrics — always debounce response change handlers
`useActivityTracking.recordResponseChange()` was called on every keystroke via React's `onChange`. Each keystroke created a new string different from previous, so `attemptNumber` incremented to 121 for a single text field. **Fix:** 2-second debounce commit pattern. Keystrokes queue a `pendingValue`; only after 2s of inactivity does the value get "committed" and compared. First meaningful response = attempt 1, revision after pause = attempt 2. **Rule:** Any tracking hook that measures "attempts" or "revisions" must debounce input — React `onChange` fires on every keystroke, not on meaningful edits.

### 29. RLS policies must be updated when adding junction tables — they silently filter rows
After migration 041 added `class_students`, the `student_progress` RLS policy still only checked `students.class_id → classes`. Junction-enrolled students have `class_id = NULL`, so RLS silently returned 0 rows — no error, no warning, just empty data. The teacher progress grid showed all dashes despite data existing in Supabase. **Fix:** Migration 059 rewrites RLS with `UNION` of junction + legacy paths: `SELECT cs.student_id FROM class_students cs JOIN classes c ON cs.class_id = c.id WHERE c.teacher_id = auth.uid() UNION SELECT s.id FROM students s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = auth.uid()`. **Rule:** When adding a junction table that provides an alternative FK path, audit ALL RLS policies on related tables. RLS failures are silent — the query succeeds but returns 0 rows. This is different from Lesson Learned #22 (API routes using junction-first queries) — RLS operates at the database level, so even correct API code gets filtered if the policy is wrong.

### 30. Auto-save timing gaps require bridging with debounced notification
`usePageResponses` auto-saves 2s after a response change. If a monitoring callback (like MonitoredTextarea's `onIntegrityUpdate`) only fires on specific events (paste, blur, 30s tick), the ref may be null when auto-save runs mid-typing. **Fix:** Add a debounced notification in the input handler (1.5s after last keystroke) that calls the callback with current metrics. This ensures the parent ref is populated before the 2s auto-save fires. The 1.5s < 2s ordering is critical. **Rule:** When piggybacking metadata onto an existing auto-save mechanism, the metadata producer must fire BEFORE the auto-save consumer runs.

### 31. Filter _tracking_ and non-string keys before rendering student_progress.responses
`student_progress.responses` JSONB contains mixed value types: strings (student text answers), objects (`_tracking_*` from `useActivityTracking` — time_spent, attempt_number, effort_signals), and JSON (toolkit tool state). Rendering these directly in JSX crashes React with "Objects are not valid as a React child." **Rule:** Any component displaying `responses` entries must: (1) filter out `_tracking_` prefixed keys, (2) safely convert non-string values (`typeof value === "object" ? JSON.stringify(value).slice(0, 200) : String(value)`). This applies to evidence panels, detail modals, and any future response viewer. The grading page evidence panel had this crash (30 Mar 2026).

### 32. getTeachingMoves maxResults counts as a filter key — zero-score exclusion trap
`getTeachingMoves({ maxResults: 100 })` returns 0 results, not 100. The function checks `Object.values(filter).some(v => v !== undefined)` to determine if scoring criteria exist — `maxResults` is a defined key, so `hasFilters` is true, but no scoring criteria exist, so every move scores 0 and gets filtered out. **Fix:** Always provide at least one real scoring criterion (phase, category, boosts) alongside maxResults. Tests that need "all moves" should aggregate across categories rather than relying on a bare maxResults call.

### 33. WIRING.yaml values with colons must be quoted — silent YAML parse failures
YAML values containing unquoted colons (e.g., `summary: Kit/Sage/Spark: three AI characters`) cause parse failures. The Python yaml parser chokes silently on certain patterns. This affected 20 entries in WIRING.yaml. **Fix:** Auto-quote values on `summary:`, `change_impacts:`, and `future_needs:` lines. **Rule:** Any time you add a WIRING.yaml entry with descriptive text, wrap the value in double quotes.

### 34. Test assumptions drift silently — run tests before any refactor session
11 pre-existing test failures went unnoticed because tests weren't being run regularly. Failures included: assertion boundaries that no longer matched code behavior (debrief min 5→3), prompt format changes not reflected in tests (activity titles vs descriptions), snapshot staleness, and scoring logic misunderstandings. **Rule:** Run the full test suite at the START of any session that will touch code. Don't assume green from last time — code and tests can drift independently between sessions.

### 35. Health check scripts must be dependency-free for CI reliability
The initial WIRING health checker was written in TypeScript requiring `npm install yaml`. This adds a dependency that may not be installed in CI environments. Rewrote as Python using the built-in `yaml` package (available in all GitHub Actions runners). **Rule:** Automation scripts that run in CI should use only built-in language features or already-installed packages. If a TypeScript script needs a non-standard npm package, consider Python or bash instead.

### 36. Data-backfill migrations need edge-case SQL, not just a simple UPDATE
Migration 065 added `student_progress.class_id` with a backfill that assigned the single-class case only. 33 multi-class-enrolled rows were left NULL, silently blocking Checkpoint 0.1 for Dimensions3 Phase 0. The working resolution used unit→class intersection with an enrollment-recency tiebreaker:
```sql
WITH resolved AS (
  SELECT sp.id,
    (SELECT cs.class_id FROM class_students cs
      JOIN class_units cu ON cu.class_id = cs.class_id
      WHERE cs.student_id = sp.student_id AND cu.unit_id = sp.unit_id
      ORDER BY cs.created_at DESC LIMIT 1) AS new_class_id
  FROM student_progress sp WHERE sp.class_id IS NULL
)
UPDATE student_progress sp SET class_id = r.new_class_id
FROM resolved r WHERE sp.id = r.id AND r.new_class_id IS NOT NULL;
```
Then delete the remaining orphans (student with progress on a unit no class they're in has assigned). **Rule:** Any migration that backfills a non-null FK must (a) handle the multi-row / multi-parent case explicitly with a deterministic tiebreaker, (b) include a verify-count query in the post-apply checklist, (c) expect orphans and decide upfront whether to delete them or allow NULL. Don't trust `UPDATE ... WHERE COUNT = 1`-style backfills to cover real production data.

### 37. Verify data migrations with an ambiguity query before declaring done
Checkpoint 0.1 would have silently "passed" if we had only checked that the `class_id` column existed — the 33 NULL rows were invisible without a targeted query. **Rule:** Every data-migration checkpoint must include a verify SQL that looks for the specific edge case the migration is supposed to fix (e.g., "count rows where the new column is still NULL AND the source has multiple candidate parents"). The verify query is part of the migration's acceptance criteria, not an afterthought.

### 38. ADD COLUMN DEFAULT silently overrides subsequent conditional UPDATEs in the same migration
Migration 067 (Phase 1.5, content moderation) added `moderation_status` with `ADD COLUMN ... DEFAULT 'pending'`, then tried to conditionally promote the 55 seed rows with `UPDATE ... SET moderation_status = 'grandfathered' WHERE ... AND moderation_status IS NULL`. The grandfather UPDATE matched **zero rows** because `ADD COLUMN ... DEFAULT` backfilled EVERY existing row to 'pending' at ALTER time — nothing was NULL anymore. The verify query at the end of the migration passed (all rows were non-NULL), the migration completed "successfully", and prod silently landed with all 55 seed rows incorrectly marked 'pending' instead of 'grandfathered'. Matt had to run a corrective UPDATE by hand post-deploy.

**Why the verify didn't catch it:** the verify query only checked for NULLs, not for the EXPECTED VALUES. A migration that's supposed to produce a specific value distribution (e.g., "55 grandfathered + N pending") must verify against that distribution, not against "non-null count".

**Rules:**
- **If a column has conditional backfill logic, ADD it WITHOUT a DEFAULT.** Fill the rows explicitly in the correct order, then `ALTER COLUMN SET NOT NULL` afterward. DEFAULT is for forward-compatibility (new INSERTs), not for populating existing rows when the value depends on row state.
- **Verify queries must assert expected values, not just "not null".** For a backfill that produces a distribution of values, include a `SELECT column, count(*) FROM table GROUP BY 1` in the post-apply checklist, and write down the expected counts BEFORE running the migration.
- **If you must use DEFAULT for ergonomics, put the conditional UPDATE BEFORE the `ALTER TABLE ADD COLUMN` step** — which is impossible with ADD COLUMN DEFAULT, hence: don't use DEFAULT with conditional backfills.

This was repaired in prod via migration 069 (idempotent grandfather safety net, no `IS NULL` predicate, re-runnable). Migration 067 in the repo is also corrected so fresh-database applies produce the right state end-to-end.

### 39. Silent max_tokens truncation in Anthropic tool_use calls drops required fields without throwing
Phase 1.7 Checkpoint 1.2 first-ever live run of `runIngestionPipeline()` against a real teacher DOCX (`mburton packaging redesign unit.docx`, 50 sections, 23,823 chars) crashed at `pass-b.ts:102` with `TypeError: Cannot read properties of undefined (reading 'map')`. Root cause was upstream in `pass-a.ts`: the Pass A Anthropic call was configured with `max_tokens: 2000`, the model produced a tool_use response that hit the cap exactly (`output_tokens: 2000`, `stop_reason: "max_tokens"`), and the JSON serialization of the tool_use input was truncated mid-`sections`-array. The Anthropic SDK does NOT throw on `max_tokens` — it returns the partial tool_use block with `sections` simply absent. Pass A then destructured `result.sections` into the return value as `undefined`, which propagated through the typed pipeline (TS thinks it's `IngestionSection[]`, runtime says undefined) and exploded in Pass B's `.map()`.

**Why the bug was invisible:**
- TypeScript types lied — the destructure assigned `result.sections: IngestionSection[]` from `unknown`. The compiler had no way to know the field was missing.
- No defensive `?? []` fallback on a required field.
- The `stop_reason` field on the response was never inspected. `max_tokens` is not an error from the SDK's perspective; it's a normal completion reason.
- 613 unit tests passed because all unit tests use sandbox mode (deterministic in-memory simulation). The crash is only reachable via the live API path against documents large enough to exceed the cap.

**Rules:**
- **Every Anthropic tool_use call site must inspect `response.stop_reason` immediately after the await and throw a loud, site-specific error if it equals `"max_tokens"`.** The error message must name the file, the configured `max_tokens`, the actual `output_tokens`, and the tool name. Silent truncation is the failure mode; the throw is the only way to convert it into something a developer or test can see.
- **Defensive `?? []` (or `?? {}`) on every required field destructured from a tool_use input**, even when the tool schema marks the field as `required`. The schema is enforced by the model's training, not by the SDK; truncation can drop fields the schema marked required.
- **`max_tokens` budget must be sized against the worst-case schema × worst-case input, not the average case.** A per-section schema multiplied by 50 sections needs an order of magnitude more tokens than the same schema for 5 sections. Calculate the upper bound once at the call site, leave a comment with the math, and prefer over-allocation to truncation — unused tokens are free, truncated outputs are crashes.
- **Sandbox-only test suites do not exercise live API failure modes.** Any pipeline that has a sandbox bypass needs at least one gated live integration test (`RUN_E2E=1`) against a representative real document, or live failures will only surface in production.

The Phase 1.7 fix was three surgical changes to `src/lib/ingestion/pass-a.ts`: bumped `max_tokens` 2000 → 8000, added a `stop_reason === "max_tokens"` guard immediately after the create call, and added `result.sections ?? []` as a last-line fallback.

**The same bug bit twice in the same phase.** After fixing Pass A, the very next live run of the pipeline against the same packaging DOCX crashed at `extract.ts:84` — `analysis.enrichedSections is not iterable`. Root cause: `pass-b.ts:182` had the identical anti-pattern (max_tokens=4000, no stop_reason guard, no defensive `?? []`), and with 50 sections of per-section enrichment the tool_use response truncated the exact same way Pass A's had. The systemic audit filed moments earlier had already flagged `pass-b.ts:182` as the #1 HIGH-risk site. We predicted it, documented it, and still got bitten because we fixed one site and ran the capture before extending the fix.

**New rule from this double-hit:** **When you fix a stop_reason/defensive-destructure bug at one AI call site, audit and fix ALL sites with the same shape in the same phase, don't wait for the follow-up.** The audit is the diagnosis; leaving the audited sites unfixed while running the very scenario that tripped the bug is asking to get re-tripped. Follow-up tickets are for sites outside the immediate phase's critical path; sites on the phase's critical path get fixed in the same commit as the original.

Phase 1.7 ended up fixing both Pass A (`pass-a.ts`: 2000→8000, guard, `?? []`) and Pass B (`pass-b.ts`: 4000→16000, guard, `?? []`) in the same commit. FU-5 in `docs/projects/dimensions3-followups.md` retains the remaining 8 sites outside the ingestion pipeline critical path for follow-up.

---

*Last updated: 11 Apr 2026*

---

## Lesson #40 — Pre-flight audits catch brief transcription slips every time
**Date:** 12 Apr 2026
**Phase:** Dimensions3 v2 Phase 2, sub-tasks 5.5-5.9
**Trigger:** 5 brief transcription slips caught by Code's pre-flight audit in sub-task 5.9 alone

**What happened:** Sub-task 5.9 (FrameworkAdapter) ran the standard pre-flight → design → test → NC → commit cadence. Code's pre-flight audits before both the design phase and the test phase caught FIVE separate brief errors that would otherwise have caused first-run failures or silent-pass traps:
1. **tsc baseline drift** — brief said 105, actual was 80 (brief was stale from earlier checkpoint)
2. **vitest glob trap** — brief specified `tests/frameworks/adapter.test.ts` but `vitest.config.ts` include glob is `src/**/*.test.ts`. The file would have been silently ignored by the runner, test count would stay at 673, all gates would technically "pass" while actually skipping the entire test phase. Classic silent-pass shape (Lesson #38 family).
3. **Group 4 function name** — brief said `getNeutralLabel` but meant `fromLabel`. `getNeutralLabel` takes only `NeutralCriterionKey` (no framework param); `fromLabel` is the label→neutral-keys reverse lookup.
4. **Group 3 `length === 8`** — assumed 8 criteria per framework based on "8 neutral keys" conflation. Reality is 2-4 criteria per framework. Would have failed all 8 frameworks on first run.
5. **Group 3a MYP `short` transcription** — brief typed `full` values (`"Criterion A"`) where `short` values (`"A"`) were needed. Only MYP would have failed because it's the only framework where `short !== full`.

**Root cause:** I was writing briefs from memory + summarised context. Code was reading actual source. Every time those two diverged, Code caught it in pre-flight. The briefs "looked right" to me because I was pattern-matching against recent similar briefs, not re-grounding each value in source.

**Lesson:**
- **Never skip a pre-flight audit, even on briefs that "look simple".** The per-sub-task catch rate is ~1 slip minimum; 5.9 hit 5.
- **Pre-flight audits are cheap** (~1 turn) and first-run failures are expensive (2-3 turns + potential silent-pass blindness).
- **Accept Code's pushback on brief errors without re-arguing.** My first instinct when Code stops is often to rationalise the brief; stop and verify instead. In 5.9, I had to flip my own pushback on judgment call #6 (IGCSE × analysing) after Code correctly applied my own "exclusive-key wins" precedent.
- **Silent-pass traps are the scariest category** — a test file not being run by the glob is indistinguishable from a passing test file unless you check the actual test count delta. The vitest glob trap would have nuked the entire test phase without any red flags.
- **Always specify exact expected values in test briefs, transcribed from actual source, not from memory.** Lesson #38 applies to briefs as much as to tests — "assert expected values" means "values I actually verified against source", not "values that seem right".

---

## Lesson #41 — NC reverts on uncommitted files need the Edit tool, not git checkout
**Date:** 12 Apr 2026
**Phase:** Dimensions3 v2 Phase 2, sub-task 5.9 test phase
**Trigger:** NC-1 in 5.9 test phase on `myp.ts` (still untracked at NC run time)

**What happened:** Standard NC protocol for 5.9 was: (1) mutate one cell in `src/lib/frameworks/mappings/myp.ts`, (2) run tests, (3) verify expected failure, (4) `git checkout -- myp.ts`, (5) re-run tests, (6) verify green. But `myp.ts` was untracked (the whole design phase hadn't been committed yet — commit was gated on test phase completion). `git checkout --` is a no-op for untracked files. Code correctly switched to manual Edit-tool revert and documented the approach in the NC report.

**Lesson:**
- **`git checkout -- <file>` only works on files git has a baseline for** — tracked files with committed or staged state. Untracked files or files with only working-tree edits post-staging have no baseline to restore to.
- **For NC on files not yet committed this phase**, the correct revert path is manual Edit-tool revert (read current, overwrite with original). Or `git stash` + verify + `git stash pop` as a noisier alternative (can mis-stash unrelated files).
- **Test-phase briefs should specify the revert method explicitly** when the NC targets uncommitted files. Otherwise Code has to figure it out mid-NC and burn a turn.
- **This matters because NC is load-bearing.** If the revert mechanism silently fails, tests stay in their mutated state and "pass" on re-run gives a false green. The 5.9 NC had two directions (TS mutation + fixture mutation) and both needed manual revert — the fixture was also uncommitted.

---

## Lesson #42 — Dual-shape persistence fields silently break consumers when frontend types diverge from server writers
**Date:** 12 Apr 2026
**Phase:** Dimensions3 v2 Phase 2, sub-step 5.10.4 (grades page render-path wiring)

**What happened:** The student grades page typed `criterion_scores` as `Record<string, CriterionScore>` and read scores via `scores[key]` bracket access. The server write site in `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx:342` writes `Array.from(currentScores.values()).filter(...)` — a `CriterionScore[]`. TypeScript never flagged it because both sides used locally-defined `CriterionScore` interfaces rather than importing the canonical type from `@/types/assessment`. Runtime bracket access on an array returns `undefined` without throwing, so the grades page silently rendered "—" for every criterion on every real assessment. The bug had been latent across every teacher-published assessment.

**Lesson:**
- **Before touching any frontend type for a persistence field, grep the server write site and capture the exact shape in a test fixture.** A local interface is a claim about shape that is not enforced against the other end of the wire.
- **Prefer canonical imports from `@/types/assessment`** (and equivalents) for anything that round-trips through Supabase. Local interfaces for DB row shapes are a smell — they're the exact place where dual-shape bugs hide.
- **Runtime bracket access on mismatched shapes fails silently, not loudly.** `arr["AO1"]` is `undefined`, not an error. The absence of a crash is not evidence the code is working — you need to see the rendered value match the fixture.
- **When fixing a dual-shape bug, write a normalizer module (not inline coercion)** so future consumers on other shapes have a single adoption path. 5.10.4 built `src/lib/criterion-scores/normalize.ts` as a 4-shape absorber (null/array/Record<string,CriterionScore>/Record<string,number>) precisely because FU-K flagged another site (`api/teacher/student-snapshot/route.ts`) still reading as `Record<string, number>`.

**Corollary:** This is the same class of bug as Lesson #38 (verify = assert expected values, not just non-null). Both are about tests and types claiming "something is there" when the shape underneath is wrong.

---

## Lessons #43-46 — Karpathy's LLM Coding Discipline (adopted 12 Apr 2026)
**Source:** `karpathy/CLAUDE.md` — behavioral guidelines to reduce common LLM coding mistakes. These codify patterns we've already learned the hard way (Framer Motion disaster = violated #45, Migration 067 = violated #43, Pass A/B max_tokens = violated #44).

---

### Lesson #43 — Think before coding: surface assumptions, don't hide confusion
**Date:** 12 Apr 2026

Before implementing anything:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Why this matters for us:** The Migration 067 grandfather bug happened because an assumption about backfill scope was never surfaced. The Pass A/B `max_tokens` truncation happened because the AI silently picked a default instead of asking whether the parameter was intentional. Both would have been caught by a 30-second "here's what I'm assuming" pause.

**How to apply:** Before writing any code — especially in a new phase or unfamiliar system — write a 2-3 line assumptions block. If any assumption feels shaky, stop and ask Matt rather than guessing.

---

### Lesson #44 — Simplicity first: minimum code that solves the problem, nothing speculative
**Date:** 12 Apr 2026

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

**Litmus test:** "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Why this matters for us:** The Loominary OS ADR-001 says the same thing: "Build for StudioLoom with OS seams. Extract shared services only when product #2 forces it. Do NOT build abstract platform services." Speculative abstraction is the #1 source of wasted code in this project.

**How to apply:** After writing code, re-read it and ask whether every line traces to the request. If a function has one caller, it probably shouldn't be generic. If a config has one value, it should be a constant.

---

### Lesson #45 — Surgical changes: touch only what you must, clean up only your own mess
**Date:** 12 Apr 2026

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

**Why this matters for us:** The Framer Motion disaster (Lesson #1) was a batch "improvement" that touched 23 files unnecessarily. The build methodology's "audit-before-touch" principle exists for the same reason — understand the blast radius before changing anything.

**How to apply:** Before committing, review the diff. If any hunk doesn't trace to the task, revert it. File unrelated observations as FU items, don't fix them inline.

---

### Lesson #46 — Goal-driven execution: define success criteria, loop until verified
**Date:** 12 Apr 2026

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with verification at each step:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

**Why this matters for us:** This is exactly what the build methodology's checkpoint system does at the phase level. Lesson #38 ("verify = assert expected values, not just non-null") is the micro version. Strong success criteria let you loop independently; weak criteria ("make it work") require constant clarification.

**How to apply:** Every phase brief already has this via stop triggers and named checkpoints. Apply the same pattern at the sub-step level — before writing code, state what "done" looks like in terms of a test or assertion, not just "it compiles."

---

### Lesson #47 — Adding schema to an existing yaml = audit every writer first
**Date:** 14 Apr 2026

GOV-1.4 added `version: 1` as a new top-level field to all 5 registry yamls. Two pre-existing scanners (`scan-api-routes.py`, `scan-ai-calls.py`) load the yaml, mutate their own block (`routes`, `call_sites`), and rewrite the file — silently dropping the new `version` field because they only know about their own keys. Caught at the saveme `git diff` step; reverted with `git checkout`. Logged FU-DD.

**Why this matters for us:** Any shared schema bump has blast-radius = every writer. It's not enough to update the consumer (admin panel) and the spec — you have to audit everything that writes the file. YAML preservation across rewrites is fragile: the default load-mutate-dump cycle silently drops anything outside the mutated block.

**How to apply:** Before adding a new top-level field to a shared yaml, grep for every script that writes it (`git grep -l 'yaml.dump.*REGISTRY_NAME'` or equivalent). Either (a) update each writer to preserve top-level scalars in the same PR, or (b) file an FU and ban the consumer until all writers are fixed. The safer long-term fix is a `read_registry()` / `write_registry()` helper that captures + restores unknown top-level fields.

---

### Lesson #48 — Supabase Site URL fallback silently strips params except `code`
**Date:** 15 Apr 2026

When a Supabase auth email link's `redirectTo` URL is NOT in the project's Auth → URL Configuration → Redirect URLs allowlist, Supabase quietly falls back to the Site URL (e.g. `https://studioloom.org`) and strips ALL query params except `?code=<uuid>`. The `?next=/teacher/set-password` and `?type=recovery` hints you set in `resetPasswordForEmail(email, { redirectTo })` are gone. Your callback handler sees only the code, not the context.

**Why this matters for us:** Code that says "if type === 'recovery' route to set-password, else route to dashboard" silently routes fallback-mode users to the wrong page. The reset flow appears to "succeed" (user lands logged in on the dashboard) but skips the critical set-password step — they still have the old password, or whatever temp password Supabase generated.

**How to apply:**
1. Primary fix: add the exact `redirectTo` URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Wildcards like `https://studioloom.org/auth/**` work and cover future auth routes.
2. Defensive fix: in the callback handler, default your `safeNext` to the most conservative destination for that flow, not to the dashboard. For PKCE in StudioLoom (forgot-password only), the fallback is `/teacher/set-password` — a user who clicked a reset link ALWAYS needs to set a new password, regardless of whether Supabase preserved the type hint.
3. Belt-and-braces: land a catch-all component (we have `AuthHashForwarder`) on the bare landing route that detects `?code=<uuid>` + hash and forwards to the right handler. This catches future auth routes you haven't added to the allowlist yet.

Commits: `ce45e2f`, `680a4de`, `314d567`.

---

### Lesson #49 — Layout auth gates need a public paths allowlist
**Date:** 15 Apr 2026

`src/app/teacher/layout.tsx` originally redirected anyone without a Supabase session to `/teacher/login`. When we shipped `/teacher/forgot-password` and `/teacher/set-password` (Phase 1B auth), both flash-bounced to login: the layout fired its redirect before the form could render, then bounced BACK to the auth page after the redirect chain finished, creating an ugly flash. A logged-out user CAN'T complete forgot-password while logged out if the layout won't let them see the form.

**Why this matters for us:** Any new auth-adjacent page (forgot-password, set-password, welcome after invite, password-reset confirmation) needs to be in an explicit allowlist. The layout can't know "this path is public" from path structure alone — `/teacher/*` is otherwise 100% authenticated.

**How to apply:**
```ts
const PUBLIC_TEACHER_PATHS: readonly string[] = [
  "/teacher/login",
  "/teacher/welcome",
  "/teacher/forgot-password",
  "/teacher/set-password",
];
const isPublicTeacherPath = (p: string) =>
  PUBLIC_TEACHER_PATHS.some(x => p === x || p.startsWith(x + "?"));
```
Apply `isPublicTeacherPath()` to every redirect/render check in the layout, not just the first one. The admin layout should get the same allowlist pattern if we ever add admin-public pages.

Commit: `ead284b`.

---

### Lesson #50 — Route Handler (`route.ts`) and Page (`page.tsx`) can't coexist at the same path
**Date:** 15 Apr 2026

Next.js 15 App Router enforces mutual exclusion: if `src/app/auth/callback/page.tsx` exists, `src/app/auth/callback/route.ts` at the same path is a build error. We shipped a page first, then when we needed the server route for PKCE we had to DELETE the page before creating the route. Forgetting this step produces a confusing build error that doesn't obviously point to the conflict.

**Why this matters for us:** Auth flow rebuilds often need to promote a client page to a server route (or vice versa) when the architecture changes. The transition requires `git rm` of the old file, not just `git add` of the new one. Left-behind page files on failed deploys cause Vercel to return the page HTML instead of hitting the route handler.

**How to apply:** When switching a route from page to route-handler (or back), always grep for both files at the same path:
```bash
git ls-files "src/app/auth/callback/*"
```
If you see both `page.tsx` and `route.ts`, delete one. Include both in the same commit so rollback is atomic.

Commit: `680a4de` (deleted `page.tsx`, added `route.ts`).

---

### Lesson #51 — Supabase dashboard "Run and enable RLS" safety prompt mis-parses PL/pgSQL variable names as table identifiers
**Date:** 20 Apr 2026
**Phase:** Preflight Phase 1A-1 (migration 093 apply)
**Trigger:** Migration 093 (machine_profiles) failed to apply with `ERROR: 42P01: relation "rls_enabled" does not exist`. `rls_enabled` is a declared PL/pgSQL boolean variable inside a `DO $$ ... $$` verify block, never a table.

**What happened:** The migration ended with a DO block:

```sql
DO $$
DECLARE
  rls_enabled    boolean;
  policy_count   int;
  ...
BEGIN
  SELECT relrowsecurity INTO rls_enabled FROM pg_class WHERE relname = 'machine_profiles';
  IF NOT rls_enabled THEN RAISE EXCEPTION 'RLS not enabled'; END IF;
  ...
END $$;
```

The SQL is valid PL/pgSQL — migration 092 uses the identical pattern without issue. But the Supabase dashboard triggers a safety popup on any `CREATE TABLE` statement: *"New table will not have Row Level Security enabled"*, offering two buttons: **"Run without RLS"** and **"Run and enable RLS"**. Clicking "Run and enable RLS" silently appends an `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` statement to your SQL — but the dashboard extracts `<name>` via naive parsing that does NOT understand PL/pgSQL `DECLARE` blocks. It picked up `rls_enabled` (our boolean variable name) as if it were a new table identifier, then generated `ALTER TABLE rls_enabled ENABLE ROW LEVEL SECURITY`, which failed with 42P01 (undefined table).

**Evidence it was the dashboard, not our SQL:** The popup text itself read *"any client using your project's anon or authenticated keys can read and write to `rls_enabled`"* — the dashboard's own warning copy confirms it had substituted our variable name into the "table name" slot.

**Why the bug was invisible in review:**
- Migration 092 (`gallery_v2_spatial_canvas`) uses the exact same `DO $$ DECLARE ... BEGIN ... END $$` shape with variables named `wrong_mode_count` / `wrong_xy_count`. It applied without incident because those names don't coincide with RLS-related identifiers and the dashboard's heuristic didn't latch on.
- No local `supabase` CLI, no `psql` — the only way to apply was the dashboard, which added the errant `ALTER TABLE` at a layer we couldn't see until it crashed.
- Prior phases applied similar DO blocks successfully, so the pattern looked safe.

**Rules:**
- **For any migration that will be pasted into the Supabase dashboard, avoid variable names inside `DO $$ DECLARE` blocks that could collide with RLS-related identifiers.** Especially: `rls_enabled`, `rls_on`, anything starting with `rls_` or ending in `_rls`.
- **Prefer post-apply SELECT queries to DO-block `RAISE EXCEPTION` verification** when the migration runs through the dashboard. The verify runs separately, doesn't couple to the dashboard's parse heuristics, and produces readable query output rather than a stack trace.
- **If a DO verify block is genuinely needed** (multi-statement migration where a failure should roll back the transaction), prefix variables with `v_` (`v_rls_enabled`, `v_policy_count`) to break any collision with domain identifiers the dashboard's parser might latch on to.
- **When clicking "Run and enable RLS", check that the popup is citing the correct table name.** If it says something odd (a column, a variable, an index), cancel and investigate before running.

**The fix in 093:** Removed the DO block entirely (commit `1d68f29`). Verification now lives as three separate SELECT queries documented in the migration comments + run post-apply in the dashboard. Matt confirmed with `relrowsecurity=t`, 4 policies, and CHECK-constraint violation test — the same invariants the DO block would have asserted.

---

### Lesson #52 — `REVOKE EXECUTE FROM PUBLIC` does NOT revoke Supabase's auto-grants to `anon` + `authenticated`
**Date:** 21 Apr 2026
**Phase:** Preflight Phase 2A-6b (migration 104 apply — claim_next_scan_job RPC)
**Trigger:** Migration 104 used the textbook locked-down pattern:
```sql
REVOKE EXECUTE ON FUNCTION claim_next_scan_job(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_scan_job(TEXT) TO service_role;
```
Post-apply permission check showed EXECUTE granted to `postgres`, `anon`, `authenticated`, AND `service_role` — the two we explicitly did NOT want on a function that bypasses RLS (`SECURITY DEFINER`) to claim in-flight scan jobs from a queue.

**What happened:** Supabase configures default privileges on the `public` schema so that any function created there receives EXECUTE grants to `anon` + `authenticated` roles at `CREATE FUNCTION` time — independent of the PUBLIC role. `REVOKE FROM PUBLIC` removes the PUBLIC-role grant but leaves the direct `anon` / `authenticated` grants untouched. Net result: our "locked down to service_role" function was callable by any authenticated student.

**Security implication (prevented before harm):** An authenticated student calling `claim_next_scan_job('stolen-worker-id')` would have:
- Claimed a pending scan job meant for the worker, marking it `running` with their fake worker id
- Starved the real worker (that job would never be scanned)
- Received the file's storage path (enough to then call `createSignedUrl` on the uploads bucket and download it — if the student has read access to that bucket, which they do not, but the function shouldn't be telegraphing the path regardless)

**Fix:** Explicitly revoke from all three:
```sql
REVOKE EXECUTE ON FUNCTION claim_next_scan_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_next_scan_job(TEXT) TO service_role;
```
Post-fix verification shows only `postgres` + `service_role` with EXECUTE.

**Rules:**
- **Every `CREATE FUNCTION` in a Supabase `public` schema must include `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` — all three, together.** The two-role revoke alone is not enough; all three in one statement is the safe default.
- **Always run the `information_schema.routine_privileges` verify query** after a privileged-function migration. The template is in migration 104's comment block — copy it into every RPC migration going forward.
- **For SECURITY DEFINER functions especially**, the penalty for a mis-grant is an RLS bypass. Treat the grant check as part of the migration's acceptance criteria, not a follow-up nice-to-have.
- **Document in the migration file** that `REVOKE FROM PUBLIC` alone is insufficient — future migrations copying this pattern need to see the reason in the file, not just the working SQL.

**Why this was invisible in review:** The PUBLIC-only REVOKE is a textbook Postgres pattern that works on vanilla installations. Supabase's implicit grants are a vendor-specific behavior that doesn't announce itself in the migration DSL. Discovered via the explicit routine_privileges check; would have been missed on a "did it apply without error" happy-path review.

---

### Lesson #53 — Denormalised columns need explicit writes; stuffing the whole payload in JSONB doesn't fan them out

**Context (22 Apr 2026):** The Preflight scanner's `write_scan_results()` writes to three tables. For `fabrication_job_revisions` it updates `scan_results` (JSONB), `scan_status`, `scan_error`, `scan_completed_at`, and `scan_ruleset_version` — but **not** `thumbnail_path`, even though `thumbnail_path` is a direct column on the same row (migration 095:150). The Python worker's `ScanResults` Pydantic model carries a `thumbnail_path: str | None` field which lands inside the JSONB via `model_dump()`, and the code assumed that was enough.

It wasn't. The UI and admin queries read `r.thumbnail_path` (the column) — not `r.scan_results->>'thumbnail_path'`. Every STL scan in Phase 2A and every SVG scan in Phase 2B-6 rendered + uploaded a thumbnail successfully, then silently stranded the path inside JSONB with a NULL column. 11 prod revisions needed backfill.

**What this is really about:** When a worker returns a structured payload that Postgres stores as both JSONB *and* denormalised columns, every denormalised column needs an explicit assignment in the UPDATE statement. The JSONB-assignment doesn't fan out through any trigger, generated column, or magic. The drift between "Python thinks the field is set" and "SQL column is actually NULL" is invisible at the Python layer.

**Why it slipped past tests:** Every scan_runner test in `tests/` used `MockSupabase` (conftest.py), which records the `write_scan_results` call shape but never simulates the real PostgREST update. Assertions were at the JSONB level (`w["scan_results"]["thumbnail_path"] is not None`), never the column level. The real `SupabaseServiceClient.write_scan_results` in `supabase_real.py` had zero test coverage — so the missing column write was invisible to CI.

**Fix:**
1. **Code** — add `"thumbnail_path": scan_results.get("thumbnail_path")` to the revisions update dict in `supabase_real.py:write_scan_results()`.
2. **Test** — new `tests/test_supabase_real.py` exercises `SupabaseServiceClient.write_scan_results` with a mocked supabase-py client and asserts the literal column payload. Three cases: (a) thumbnail_path present in JSONB → column gets the value, (b) thumbnail_path absent → column is None (not KeyError), (c) all three tables get an update in order.
3. **Backfill** — `UPDATE fabrication_job_revisions SET thumbnail_path = scan_results->>'thumbnail_path' WHERE thumbnail_path IS NULL AND scan_results->>'thumbnail_path' IS NOT NULL;` — patches existing orphaned rows.

**Rules:**
- **When adding a new denormalised column alongside a JSONB payload, audit the writeback path in the same commit.** If the column is "the JSONB value hoisted out", the writeback must hoist it. Add a column→JSONB-key mapping comment above the UPDATE dict so future maintainers see the intent.
- **Cover the real DB adapter with its own unit test**, not just mock-based tests. Mock-based tests validate glue code shape but give zero coverage for "does the real implementation pass every required field to the DB". The symmetric mock (conftest's `MockSupabase`) was sufficient for rule-authoring tests but covered the wrong surface for writeback regression.
- **Verify at the column level in smoke tests.** When a scan completes successfully, SELECT `thumbnail_path` (the column), not just `status`. The Phase 2B-7 smoke query added `r.thumbnail_path` explicitly — that's how we caught this. Column-level asserts belong in any "scan completed" smoke test going forward.
- **Assume ORM-ish payloads don't fan out.** supabase-py's `.update({...})` is a straight INSERT/UPDATE on the dict keys given. There's no JSONB→columns back-reflection. Same trap will apply to any denormalised column added to fabrication_jobs, content_items, etc.

**Why this was invisible in review:** The existing JSONB assertion in tests reads as if it covers both paths (JSONB has the value → column will too). Python → Postgres has no such guarantee. The deploy succeeded, the scan status was `done`, the storage upload succeeded, the bucket had the files — every signal said "working" except the one column the UI actually reads.

---

### Lesson #54 — WIRING.yaml entries can claim "complete" features that don't exist; audit by grep before trusting any system summary

**Caught during the language-scaffolding-redesign audit (26 Apr 2026, on `lesson-bold-build`).** The WIRING entry for `student-learning-support` had:
```yaml
- id: student-learning-support
  status: complete
  currentVersion: 1
  summary: Tier 2/3 translation via Claude (ELL level configurable),
           UDL scaffolding (checkpoints 1-31), ADHD visual focus helpers,
           dyslexia-friendly fonts.
```

Grep across `src/` confirmed:
- 0 `dyslexic` / `OpenDyslexic` / `dyslexia.*font` references in any TSX/CSS.
- 0 `translateContent` / `tier2_translation` / `tier3_translation` references.
- `udl_checkpoints` exists only as a teacher-side authoring tag on `activity_blocks` (curriculum metadata), not a student-facing render-time accessibility feature.
- Teacher settings has an `enable_udl` toggle that affects lesson generation, not student render.

**The system was paper-only.** None of the four claimed features were implemented. Same drift family as `FU-Y` (Groq + Gemini fallbacks never shipped — `ai-call-sites.yaml` records say "has_fallback: false" for everything despite the WIRING entry claiming a fallback chain). The drift would have stayed invisible if I'd trusted the brief's premise that Studio Setup needed expanding to include translation / dyslexia / UDL toggles. Audit caught it before the redesign tried to "extend" features that didn't exist.

**Rules:**
- **Before treating any WIRING entry as ground truth, grep for at least 2 of its claimed features in `src/`.** If both grep zero, flag drift. Don't trust the summary text or `status: complete` field.
- **For accessibility / scaffolding / language features specifically, grep is mandatory** because these features tend to be paper-specified during product planning before code lands. The WIRING entry can be a year ahead of the code.
- **When you find drift, the cheapest fix is option (i):** flip the entry to `status: planned`, `currentVersion: 0`, rewrite summary to describe what the upcoming build delivers. File a follow-up (`FU-LS-DRIFT` shape). Cleaner than treating the redesign as a brand-new system + leaving the misleading entry intact.
- **Pattern signal for "look closer":** WIRING entries with summaries that read like a marketing description ("Tier 2/3 translation, UDL scaffolding (checkpoints 1-31)...") are higher-risk than entries with implementation-specific summaries ("React component at `<path>` that wraps text and tokenises words via..."). Marketing-shaped summaries should trigger a code grep.

**Why this matters for governance:** The drift-detection scanners (api-registry, ai-call-sites, schema-registry, feature-flags, vendors) catch drift in their respective domains by scanning code. WIRING.yaml has no scanner — it's manually maintained from system descriptions. So WIRING is the most likely registry to drift, and the only one where the audit-by-grep is the only check. Worth surfacing in saveme as a periodic spot-check.

---

### Lesson #55 — Configuration models lose to invocation models for student-facing scaffolding; pivot before shipping when research says so

**Sub-Phase 3 of Lesson Bold (24 Apr 2026)** shipped `AutonomyPicker` — a 3-up card picker (Scaffolded / Balanced / Independent) where students picked a "support level" up front, which then drove hint visibility + example expansion via 5 helper functions (`hintsAvailable`, `hintsOpenByDefault`, etc.). Migration 116 persisted the choice as `student_progress.autonomy_level`. Tests passed, NC fired correctly, code shipped.

**Two days later, mid-iteration on a related drawer mockup, Matt observed: students wouldn't get it.** "How do you want to work today?" is asking a 13-year-old to model their own learning style — that's a teacher's job, not a student's. The mockup designer was thinking pedagogical theory; we were building what should be built on Tuesday morning Period 3.

A Cowork research session against ~10 comparable platforms (Newsela, Duolingo, Microsoft Immersive Reader, Read&Write by TextHelp, Lexia Core5, Google Read Along, Khan Academy, Seesaw/Flip, CommonLit, Medley Learning) confirmed: **the platforms that work in this space bet on INVOCATION, not configuration.** Students don't reliably model their own learning style. They DO tap a word they don't know.

The closest reference platform — Medley Learning — uses a "Response Starters" panel that appears next to any text-answer field. Tap a small icon → side panel with a task-specific Word Bank (10 chips generated from the prompt + source text) and 2–3 Sentence Starters with multi-blank causal/evaluative/descriptive frames. **No toggle, no setup. Invocation only.**

The whole AutonomyPicker concept got pivoted. Migration 116 scheduled for rollback (migration 117 DROP COLUMN). Component deleted in upcoming Phase 0. Helpers deleted. ActivityCard hint/example gating reverts to ELL-only. Replaced by two inline affordances: Tap-a-word (input scaffold) and Response Starters (output scaffold).

**Rules:**
- **For student-facing scaffolding controls, default to invocation patterns over configuration patterns.** Don't ship a "support level" picker without first checking that ~3 reference platforms in the same problem space ship one. They typically don't.
- **Self-report (student picks support level) skews toward over-picking.** Research on this in `docs/research/student-influence-factors.md` + WIDA / multilingual-learner literature. Students systematically over-select scaffolding because the meta-cognitive choice is hard. Passive signal-driven scaffolding (e.g. fade tier from tap-translate frequency) avoids this trap.
- **Invocation = available always, never required.** Student summons help on the artefact in front of them. Configuration = student commits to a setting before they know what they need. The first respects autonomy; the second forces a wrong-time decision.
- **When a research session contradicts a freshly-shipped feature, the cost of pivoting is real but bounded.** Lesson Bold Sub-Phase 3 took half a day to ship + half a day to plan a clean rollback. The cost of leaving AutonomyPicker live as the wrong model would have been every student session it ran for, plus eventually a more painful re-shipped replacement when the gap got obvious.
- **5 mockup iterations is a signal, not a virtue.** The drawer concept went through v1–v5 before the configuration→invocation insight landed. Each version was internally consistent, none of them was right. **The signal: when the third iteration is still rearranging the same components, stop and check the model, not the layout.**

**Why this matters for build-methodology:** The `build-phase-prep` skill's pre-flight ritual catches BAD CODE. It doesn't catch BAD MODEL. For systems where research literature has a strong opinion (anything cognitive / pedagogical / accessibility), add a "competitive-pattern check" step to the brief — list 3-5 platforms that have solved a similar problem, document what they actually do, before locking the spec. This is a Karpathy #43 ("surface assumptions") at the model level, not just at the code level.

---

### Lesson #56 — Conflating "test mode" with "sandbox mode" produces broken dev UX
**Date:** 27 Apr 2026
**Phase:** Tap-a-word Phase 1B/1C (browser smoke surfaced the bug)
**Trigger:** Matt opened a real lesson and tapped "isolation"; popover showed `[sandbox] definition of "isolation"` instead of a real Anthropic definition.

**What happened:** Phase 1A shipped `/api/student/word-lookup` with `if (process.env.RUN_E2E !== "1") { sandbox path }` to keep `npm test` from burning the API key. The implicit assumption was "tests are the only context where we want sandbox". Reality: `npm run dev` ALSO has `RUN_E2E` unset by default → dev users hit the sandbox path → every uncached word returned the marker `[sandbox] definition of "X"`. Felt broken even though the route was returning 200 with valid JSON.

**Why this was invisible in code review:** The condition `process.env.RUN_E2E !== "1"` reads as "if this isn't the gated E2E case" — naturally maps to "default behaviour". The default behaviour SHOULD be live. The trap is using a single env var to express two orthogonal concerns: (1) "are we in a test runner right now?" and (2) "do we want to use the live API or the sandbox?".

**Rule:** Separate "test mode" detection from "behaviour mode" selection. Detect tests via `NODE_ENV === "test"` (vitest/jest set this automatically). Use an explicit override env var (e.g. `RUN_E2E=1`) only for the case where you want to escape the test-mode default. The default in dev/prod stays live. Concretely:

```ts
// Wrong — conflates test-mode with sandbox-mode
if (process.env.RUN_E2E !== "1") { sandbox path }

// Right — sandbox only when (in tests) AND (not explicitly overridden)
if (process.env.NODE_ENV === "test" && process.env.RUN_E2E !== "1") { sandbox path }
```

**Wider applicability:** Audit any future "dev-mode bypass" patterns the same way. If a switch silently disables real behaviour in dev, it WILL bite. Phase 5's `tests/e2e/response-starters-live.test.ts` will inherit the same gate shape — apply this rule to it on day 1, not as a follow-up fix.

---

### Lesson #57 — Sandbox writes that share a real cache table corrupt downstream cache hits
**Date:** 27 Apr 2026
**Phase:** Tap-a-word Phase 1B/1C
**Trigger:** After Lesson #56 fix landed, 5 specific words ("aerodynamic", "distribution", "success", "investigated", "isolation") still returned `[sandbox]` text. Cause: Matt had tapped them earlier under the broken gate; the sandbox path had upserted `[sandbox]` rows into `word_definitions`. After the gate fix, those rows became cache HITS — the new gate only protects the cache-MISS path.

**What happened:** The Phase 1A route did `await supabase.from("word_definitions").upsert(...)` in BOTH the sandbox and live branches. The sandbox upsert wrote sentinel rows to the shared cache. With the v1 gate broken, every dev tap polluted the cache. Even after the gate fix, the polluted rows persisted because the cache-hit path returns whatever is in the row, regardless of whether the gate would have routed differently on a miss.

**Rules:**
- **Sandbox results MUST NOT touch the real shared cache.** Either (a) skip the upsert entirely in the sandbox path (the route's own in-memory cache is enough for tests), or (b) stamp rows with a `source: 'sandbox' | 'live'` column + auto-purge sandbox rows on dev startup. Option (a) is simpler.
- **When fixing a gate that controls cache writes, audit + clean the rows the broken gate wrote.** A gate fix doesn't undo prior writes. Either delete the stale rows or invalidate them via versioning.
- **Distinguish "sandbox" (deterministic test fixture) from "stub" (placeholder for unimplemented logic).** Sandbox should be self-contained — no I/O outside the function call. Stub can write to dev DB. Don't accidentally make a sandbox into a stub by including a side-effect.

**Filed as `FU-TAP-SANDBOX-POLLUTION` P2.** Phase 2 fixes via option (a) — drop the upsert from the sandbox path.

---

### Lesson #58 — Empirical hit-rate measurement against real lessons reframes spec criteria
**Date:** 27 Apr 2026
**Phase:** Tap-a-word Phase 1C cold-cache analysis
**Trigger:** Phase 1C built `scripts/cold-cache-smoke.mjs` to measure cache coverage against real published units. Sampled 3 units → 4759 unique tappable words → only 533 cache hits with the 578-word design-vocab seed (11.2% hit rate). Spec criterion #5 said "<20 uncached words per first-time student per lesson" — at first read, FAILING. Re-reading the spec's §5.2 cost projection ("5 first-encounter words / lesson") clarified the criterion was always a BEHAVIOURAL one (uncached words a student TAPS), not an INVENTORY one (uncached words present on the page).

**What happened:** Without the empirical smoke, we would have either (a) shipped declaring the criterion met (wrong — based on projection), or (b) burned ~$0.50 expanding the seed to common-English coverage (wrong — students don't tap "the" or "what"). The smoke surfaced that the criterion needed reframing, not the seed needing expansion.

**Rules:**
- **For coverage / hit-rate / signal criteria, write a one-shot empirical smoke against real production data BEFORE accepting a pre-launch projection.** Projections sound reasonable until you see the real distribution.
- **When a spec criterion has two reasonable readings (inventory vs. behavioural), make the empirical smoke the tiebreaker.** Whichever reading the empirical data supports is the one the spec actually intended.
- **The empirical smoke script is itself a deliverable.** `cold-cache-smoke.mjs` stays in repo as a checkable baseline — Phase 4 signal data will validate the reframed criterion against real student tap behaviour.

**Wider applicability:** Any system with a hit-rate / signal-driven threshold (Lesson Pulse, recommendations, scaffold-fading, drift detection) should ship with an empirical smoke. The smoke is the spec's lie-detector.

### Lesson #59 — Brief estimates can lie when the audit hasn't happened yet
**Date:** 27 Apr 2026
**Phase:** Phase 2D toolkit-mount audit
**Trigger:** Brief estimated "~½–1 day for 28 toolkit tools" — reality showed only 3 of 27 had wrap-able JSX patterns; the other 24 had hardcoded literals requiring per-tool content-aware refactors.

**What happened:** The Phase 2 brief casually said "Phase 2D — toolkit prompt mounts (~½–1 day, ~28 toolkit tools, folded in from deferred 1B refinement)". Day-of, the audit revealed:
- 3 tools render prompts as JSX variables (`{prompt}`, `{stepInfo.prompt}`, `{roundInfo.prompt}`) — easy 1-line wraps
- 22 tools hardcode prompts as inline JSX literals (`<p>What are ALL the ideas...</p>`)
- Wrapping the 22 isn't a "wrap" — it's "extract literal to const, decide what's educational text vs UI chrome, wrap, verify visually" per tool. Each is ~5-15 min of focused content work.

**Why the estimate missed:** The 1B refinement note was written assuming the 28 tools followed the same pattern (or close enough). Nobody opened any of the 22 inline-literal tools to confirm. The pattern audit happened only when 2D actually started.

**Rules:**
- **For any "N similar items" estimate, audit a representative sample (say, ~3 randomly-picked items) BEFORE locking the time estimate.** A 30-second look at one item from each tool category would have surfaced the inline-literal pattern AND revealed that 22 of 27 needed real content work.
- **When the audit reveals scope is materially bigger than estimated, ship a minimum-viable canonical pattern + file a follow-up.** Don't power through 22 surgical edits without a strong reason. The 3-tool sample + `FU-TAP-TOOLKIT-FULL-COVERAGE` P3 is the right shape.
- **Phase 4 signal data is the better prioritisation signal than "do all 22 because the brief said so".** Wait for `taps_per_100_words` rolling avg to tell us which tools students actually use; THEN wrap those tools. Speculative breadth-first wrapping wastes effort.

**Wider applicability:** Any phase brief that says "wrap X across N components" or "audit Y across N files" should include a representative-sample audit step in pre-flight. The audit OUTPUT (which N items have which patterns) belongs in the brief BEFORE the implementation estimate is locked.

### Lesson #60 — Side-findings discovered inside the code you're already touching belong in the same commit, not "follow-up later"
**Date:** 28 Apr 2026
**Phase:** Multi-class context fix (Bugs 1, 1.5, 2, 3)
**Trigger:** During smoke-test prep for the four-bug push, I explicitly noted: *"`test` has 2 active enrollments in archived classes. Bug 1's `ORDER BY enrolled_at DESC` happens to skip them because 7 Design is more recent — but the underlying gap is real: archived classes still surface in session-default rotation because the query doesn't join `classes.is_archived`. Worth a 1-line follow-up later (filter `is_archived = false`), but not blocking the current smoke test."* I shipped without the fix. Within 30 minutes, Matt's first real smoke test hit it: clicking "Continue" on a 10 Design unit landed him in an archived 6 Design class because both classes shared the unit and the archived class had a 1-day-newer enrollment.

**What happened:** Bug 1 added `ORDER BY enrolled_at DESC` to the session-default class lookup but didn't filter `classes.is_archived`. Bug 2's new `resolveStudentClassId` helper inherited the same gap. The smoke-test prep audit produced this exact finding (literally noted "doesn't filter archived classes"), I judged it as "not blocking the current smoke test," and Matt then proceeded to do the smoke test where it immediately blocked him. Required a follow-up commit (`a1dc37e`) touching the same two files I'd just modified, with a corresponding test-source-static guard that also needed updating because I'd already changed its assertion shape in the previous commit.

**Why I deferred:** The audit happened just before push. The fix would have added ~30 minutes (helper function + tests + updating the source-static guard). I anchored on "ship the four-bug atomic commit" rather than "ship the four-bug commit + this one obviously-related fix." Classic sunk-cost trap — the four bugs were already verified, adding a fifth felt like scope creep when in fact it was inside the scope of "multi-class context fix."

**Rules:**
- **Audit findings inside the code you're already touching are NOT follow-ups — they're part of the current task.** Follow-ups are for findings outside the touched code. The line is "did my edit's diff just walk past this?" If yes, fix it now.
- **When pre-push audit surfaces a known-failure scenario in scope, fix it before push regardless of "blocking the current test plan or not."** The next person to run the smoke test will hit it (in this case, the same person, within minutes).
- **Tests that lock query-string shapes (source-static guards) compound the cost of deferred fixes.** Each new edit to the same query forces another test update — better to combine the edits.

**Wider applicability:** Pre-push audit / code-review checklists should explicitly ask "did the audit surface anything in the code I'm touching that I'm planning to defer? If yes, why not fix it now?" The default answer should be "fix now"; the burden is on "defer" to justify itself. Especially true for fixes that share a helper function or test fixture with the in-flight change.


### Lesson #61 — Index predicates can't contain non-IMMUTABLE functions; shape-asserting tests don't catch this
**Date:** 29 Apr 2026
**Phase:** Access Model v2 Phase 0.7b apply
**Trigger:** Tried to apply migration `20260428220303_ai_budgets_and_state.sql` to prod. Postgres rejected it with `42P17: functions in index predicate must be marked IMMUTABLE`. The offending DDL was:

```sql
CREATE INDEX IF NOT EXISTS idx_ai_budget_state_due_reset
  ON ai_budget_state(reset_at)
  WHERE reset_at < now();
```

**What happened:** `now()` is `STABLE`, not `IMMUTABLE`. Postgres won't let you build a partial index whose predicate value changes over time (otherwise the index would silently lose correctness as `now()` advances). The fix: drop the predicate, use a plain b-tree on `reset_at`. The cron's `WHERE reset_at < now()` filter happens at query time; the b-tree forward-scan from earliest is efficient enough.

The migration shape test asserted:
```ts
expect(sql).toMatch(/idx_ai_budget_state_due_reset[\s\S]+WHERE reset_at < now\(\)/);
```
which passed because the SQL TEXT contained that string. But the SQL TEXT being well-formed strings doesn't guarantee the SQL would actually compile against Postgres. **Shape-asserting tests assert presence of strings; they don't catch SQL semantic errors.**

**Why this is a Lesson #38 sibling:** Lesson #38 was about tests asserting non-null instead of expected values. Lesson #61 is about tests asserting string-presence-in-text instead of execution-success. Both are "the test passed but the underlying thing is wrong." The fix is the same shape — make the test verify the expected outcome, not just the surface representation.

**Rules:**
- **For any partial index, verify the predicate uses only `IMMUTABLE` functions.** `now()`, `current_timestamp`, `random()`, anything that depends on session state — all rejected. `lower()`, arithmetic, constant comparisons — fine.
- **Shape-asserting migration tests should be paired with at least one test that actually executes the migration against a real Postgres** (the live RLS test harness skeleton from Phase 0.9 is the right home for this — extend with a "this migration applies cleanly" check per migration).
- **When you add a partial index, ask: is the predicate a constant? If not, is the function IMMUTABLE?** If the answer is "no" or "I'm not sure", drop the partial. The plain b-tree is almost always fast enough.

**Wider applicability:** Anywhere a migration generates DDL that depends on database semantics (CHECK constraints with subqueries, CHECK constraints referencing other tables, partial indexes with mutable predicates, generated columns with non-immutable expressions, COMMENT escapes, etc.), the shape-asserting tests miss the failure mode. Pair with execution tests OR run the migration against a test database before declaring "Phase X DONE on branch."


---

### Lesson #62 — Use `pg_catalog.pg_constraint` for cross-schema FK verification, not `information_schema.constraint_column_usage`

**Date:** 29 April 2026
**Surfaced in:** Access Model v2 Phase 1.1a (`students.user_id` → `auth.users(id)` FK verification)

**The bug:** Phase 1.1a's prod apply ran `ALTER TABLE students ADD COLUMN user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL`. The column landed, the index landed, the comment landed. The FK check query I wrote used `information_schema.constraint_column_usage` to verify the FK shape — and it **returned zero rows**. False alarm: the FK actually existed (confirmed by a `pg_catalog.pg_constraint` query and by the "constraint already exists" error when I tried to re-add it).

**The cause:** `information_schema.constraint_column_usage` has documented quirks around cross-schema FK references. When the local table is in `public` and the foreign table is in `auth` (Supabase's auth schema), the JOIN to find the foreign-side schema/table can return zero rows even though the constraint exists. This is a Postgres standard-conformance issue; the view exists for SQL-standard portability but doesn't fully resolve cross-schema FKs.

**The fix:** Use `pg_catalog.pg_constraint` directly. It's the authoritative source — the planner and executor both use it. Pattern for FK verification:

```sql
SELECT
  c.conname AS constraint_name,
  c.conrelid::regclass AS local_table,
  a.attname AS local_column,
  c.confrelid::regclass AS foreign_table,
  af.attname AS foreign_column,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
WHERE c.contype = 'f'
  AND c.conrelid = '<schema>.<table>'::regclass
  AND a.attname = '<column>';
```

**Wider applicability:** Same pattern for any cross-schema PK/UNIQUE/EXCLUSION lookup. The `information_schema.*` views are good for portability and same-schema references, but **for any constraint check that crosses schemas (typically `public` ↔ `auth` in Supabase), reach for `pg_catalog` first.**

**Why this is a Lesson #54 sibling:** Lesson #54 was "WIRING.yaml entries can claim 'complete' features that don't exist; audit by grep before trusting any system summary." This is the inverse: **information_schema views can claim 'absent' features that DO exist** because of standard-view limitations on cross-schema references. The fix shape is the same — when the abstraction layer says something doesn't exist, verify against the authoritative source before acting.

**Rules:**
- For FK shape verification: use `pg_catalog.pg_constraint` joined with `pg_attribute`.
- For verifying that a constraint exists at all (without needing shape): the simplest, most reliable test is to attempt to CREATE it — Postgres returns a clear `already exists` error (SQLSTATE 42710) if it does.
- For RLS policy verification: use `pg_policies` (a thin wrapper over `pg_policy`).
- Treat `information_schema` as a portability layer for SQL standard tooling, not as authoritative for Postgres-specific features (cross-schema FKs, partial indexes, generated columns, RLS, etc.).

---

### Lesson #63 — Vercel preview URLs are deployment-specific; use the auto-aliased branch URL for "latest on branch" testing

**Date:** 29 April 2026 PM
**Surfaced in:** Access Model v2 Phase 1.4 prod-preview smoke testing

**The bug:** Phase 1.4a + 1.4b prod-preview smoke tests appeared to fail with HTTP 401. Spent ~30 min adding diagnostic logging, capturing log exports, debugging the SSR cookie adapter — looking for issues in code that wasn't actually being tested.

**The cause:** Vercel preview URLs are **deployment-specific**. Each `git push` creates a NEW deployment with a NEW URL hash:

```
push 1 → studioloom-aaa111-mattburto-specs-projects.vercel.app
push 2 → studioloom-bbb222-mattburto-specs-projects.vercel.app
push 3 → studioloom-ccc333-mattburto-specs-projects.vercel.app
```

We had captured the URL from push 1 (Phase 1.2 verification) and kept reusing it in curl commands for subsequent pushes. The URL pinned forever to commit-1's build, which lacked Phase 1.4a + 1.4b changes. Tests "failed" because we were testing the wrong code.

**The fix:** Use Vercel's **auto-aliased branch URL** pattern, which always resolves to the latest deploy of the branch:

```
studioloom-git-<branch-name>-<team>-projects.vercel.app
```

Example: `studioloom-git-access-model-v2-phase-1-mattburto-specs-projects.vercel.app` always points at the most recent commit on `access-model-v2-phase-1`. As soon as we used it, Tests 1/2/3 all returned 200 — the new auth path worked all along.

**Wider applicability:** Any Vercel-deployed app's preview testing. The deployment-hash URL is the right URL when you need to reference a specific build (e.g., "this exact bug is in deploy X"). The branch-alias URL is the right URL for "latest on this feature branch" smoke testing.

**Rules:**
- **Default to the branch-alias URL** for smoke testing during active development. Pattern: `<project>-git-<branch>-<team>.vercel.app`. The branch name has slashes converted to hyphens for URL safety.
- **Use the deployment-hash URL** ONLY when you need to reference a specific build (debugging post-merge regressions, comparing two deployments, etc.).
- **Confirm the deploy is "Ready"** in the Vercel dashboard before testing — the branch alias URL might point at a still-building deploy if you tested too soon after pushing.
- **Verify the URL hits the expected commit** by adding a temporary version marker (e.g., `console.log("v" + COMMIT_SHA)`) if you suspect URL drift. Or — cheapest — temporarily add a `_debug: { commit: ... }` field in a response body to confirm.

**Why this is a Lesson #38 sibling:** Lesson #38 was "verify expected values, not just non-null." This is "verify expected DEPLOYMENT, not just success-once." Both are about the gap between "the test didn't error" and "the test verified the thing you thought it did."

---

### Lesson #64 — Cross-table RLS subqueries silently recurse; use SECURITY DEFINER for any policy that joins through another RLS-protected table

**Date:** 30 April 2026
**Surfaced in:** Access Model v2 Phase 1.4 client-switch CS-2 — first time SSR client engaged Phase 1.5/1.5b/CS-1 student-side RLS policies in production. Hit two distinct recursion cycles in the same session.

**The bug shape:** A "canonical chain" RLS policy of the form:

```sql
USING (target_id IN (SELECT some_col FROM other_table WHERE other_filter))
```

is fine in isolation. But the moment `other_table` ALSO has an RLS policy that subqueries back through the original table (or any table in the chain), Postgres throws:

```
ERROR: 42P17: infinite recursion detected in policy for relation "<table>"
```

This **never surfaces under admin client** (`createAdminClient()` bypasses RLS). It only triggers when the SSR client reads any table whose policies form the cycle. Phase 1.5/1.5b/CS-1 wrote ~14 student-side policies using this canonical chain pattern; every one is a latent recursion candidate, depending on what other policies exist on the joined tables.

**Two cycles hit in one session, same pattern:**

1. **`students` ↔ `class_students`.** `Teachers manage students` (since Phase 0) had `id IN (SELECT cs.student_id FROM class_students cs ...)`. Phase 1.5b's `class_students_self_read_authuid` had `student_id IN (SELECT id FROM students WHERE user_id = auth.uid())`. The instant SSR client touched students, recursion fired.

2. **`classes` ↔ `class_students`.** `Teachers manage class_students` (since migration 041) had `class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())`. CS-1's `Students read own enrolled classes` had `id IN (SELECT cs.class_id FROM class_students cs ...)`. Same cycle shape, different tables.

**The fix:** SECURITY DEFINER helper function. Wrap the recursive subquery in a function that runs as the function's owner (typically `postgres`), bypassing RLS on tables it queries internally. The cycle breaks because the inner lookups don't re-enter RLS.

```sql
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(class_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes WHERE id = class_uuid AND teacher_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;

-- Then in the policy:
DROP POLICY "Teachers manage class_students" ON class_students;
CREATE POLICY "Teachers manage class_students"
  ON class_students FOR ALL
  USING (public.is_teacher_of_class(class_id))
  WITH CHECK (public.is_teacher_of_class(class_id));
```

The function is `STABLE` (deterministic for the same auth.uid() within a transaction), `SECURITY DEFINER` (runs as owner), `SET search_path` (locks the search path so the body can't be hijacked by a malicious user-set search_path).

**Wider applicability:** ANY policy where a subquery hits a different RLS-protected table. Several un-audited policies still pending (FU-AV2-RLS-SECURITY-DEFINER-AUDIT P2):
- `competency_assessments` student-read policy → `students` (potential cycle if competency_assessments has a teacher policy that reads students)
- `quest_journeys/_milestones/_evidence` student policies → `students`
- `student_progress` self-read → `students`
- `fabrication_jobs/_scan_jobs` self-read → `students`
- CS-1's `Students read own published assessments` on `assessment_records` → `students`
- CS-1's `student_badges_read_own` → `students`

Any of these will recurse the moment a route under SSR client reads them in a way that triggers the joined table's RLS.

**Rules:**
- **Default to SECURITY DEFINER for any policy that subqueries another table.** Direct column comparisons (`user_id = auth.uid()`) are fine. Cross-table subqueries are not — wrap them.
- **Lock the search_path** in every SECURITY DEFINER function: `SET search_path = public, pg_temp`. Without this, a caller can manipulate search_path to inject malicious objects (CVE-class issue in older Postgres).
- **REVOKE then GRANT to `authenticated` only.** PUBLIC has execute by default; explicit GRANT scope tightens the surface.
- **The `STABLE` volatility marker** is correct for these helpers (not `IMMUTABLE` — auth.uid() can change across transactions, but is constant within one). Lesson #61 sibling: volatility markers matter for both indexes and SECURITY DEFINER.
- **Add migration shape tests** that assert the policy USING clause references the function name, NOT an inlined subquery (Lesson #38). Catches regressions where someone re-inlines the recursive pattern.
- **Smoke under SSR client** before declaring an RLS policy "done." Admin-client tests prove nothing about RLS evaluation.

**Why this is a Lesson #38 + #54 sibling:** Lesson #38 — "verify expected values, not just non-null." Lesson #54 — "registries can claim 'complete' features that don't exist." This is the third in the family: **policies can claim correctness based on tests that never exercised them.** Schema-registry annotated `student_badges_read_own` as `(their)` (canonical chain) because the migration filename matched, but the actual SQL was broken (Phase 1.4 CS-1 finding). Phase 1.5/1.5b "completed" with shape tests that never ran under SSR client. CS-2 is the first time these policies actually evaluated, and they all needed work.

**Operational rule:** Any future Access-Model-v2 phase that ships RLS policies must include at least one route in the same phase that reads under SSR client and validates the policy fires correctly. Not as a follow-up — in the same phase, as a Checkpoint criterion. Otherwise we accumulate latent recursion bombs that fire one at a time in production.

---

### Lesson #65 — Old triggers don't know about new user types

**Surfaced:** 1 May 2026, Phase 2.5 Checkpoint A3 smoke (access-model-v2 Phase 2 close-out). Matt opened `/admin/teachers` and saw ~7 phantom rows with synthetic emails like `student-<uuid>@students.studioloom.local`.

**Root cause:** `001_initial_schema.sql` (the very first schema migration, ~18 months old) defined a trigger:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_teacher();
```
The function blindly inserted into `teachers` for every auth.users row, on the (then-true) assumption that every auth user was a teacher.

Phase 1.1d access-v2 (29 Apr 2026) introduced student auth.users rows via `provision-student-auth-user.ts` — synthetic-email pattern, `app_metadata.user_type='student'`, no teacher-side data. The 18-month-old trigger fired anyway, creating phantom teacher rows for every student.

**Why pre-flight didn't catch it:** Phase 1.1d's pre-flight audit looked at FK callers + downstream queries that consume `students.user_id`, but didn't audit auth.users-side triggers. There was no obvious reason to — the new code wrote auth.users via the admin API, and the admin API doesn't surface triggers in its return value.

**Fix:** migration `20260501103415_fix_handle_new_teacher_skip_students.sql`:
```sql
IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
  RETURN NEW;
END IF;
```
Plus a backfill DELETE with safety assertion (refuse to delete if any leaked row had FK references — none did).

**Operational rule:** When introducing a new user_type / role / actor class into auth.users, audit ALL triggers on `auth.users` AND on any side-table that gets auto-populated from auth.users (`teachers`, `user_profiles`, etc). The audit checklist:
1. `SELECT * FROM information_schema.triggers WHERE event_object_table = 'users'`
2. For each trigger function, read the SQL — does it assume a single user_type?
3. If yes — guard the function on user_type before the new role's first insert lands in prod.

**Lesson #54 sibling:** "Old code makes assumptions that aren't documented anywhere." The trigger had no comment explaining "this assumes every user is a teacher." Future-proofing tip: when writing assumption-baked schema, add a comment in SQL referencing the assumption AND a test that asserts the assumption still holds.

**Security audit:** clean. `buildTeacherSession` only routes when `user_type='teacher'` (set explicitly via app_metadata, not derived from teachers row existence); `requireAdmin` checks `is_admin=true` which is `false` on phantom rows. Leak was purely cosmetic in admin UI. **Document this in security audits as the exemplar of "wrong but not exploitable" — not every data integrity issue is a security issue, but every one of them needs a paper trail.**


---

### Lesson #66 — SECURITY DEFINER function rewrites must re-apply search_path lockdown

**Date:** 2 May 2026
**Surfaced in:** Phase 4.2 banner-test smoke. Matt tried to create a test teacher via the Supabase Auth dashboard; `Failed to create user: Database error creating new user`. Postgres logs surfaced `ERROR: relation "teachers" does not exist`.

**The bug:** the May-1 rewrite migration (`20260501103415_fix_handle_new_teacher_skip_students.sql`) — which legitimately added the `user_type='student'` guard to fix Lesson #65 — accidentally dropped two safety properties from the function definition:

1. `SET search_path = public, pg_temp`
2. Schema-qualified table reference (`public.teachers` → `teachers`)

Without (1), the SECURITY DEFINER function inherits the search_path of the calling session. Supabase Auth's INSERT context does NOT include `public` in the default search_path, so `INSERT INTO teachers (...)` failed for every email/password teacher signup since 1 May. Hadn't been caught because no new teachers had signed up via that path between 1 May and 2 May — only the existing accounts (mattburto@gmail.com, mattburton@nanjing-school.com from April) were logging in.

**The fix:** migration `20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path.sql` re-applies both properties:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp     -- restored
AS $function$
BEGIN
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.teachers (id, name, email)  -- schema-qualified
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$function$;
```

Plus a DO-block sanity check that `pg_get_functiondef(oid)` contains both `SET search_path = public, pg_temp` AND `public.teachers` — refuses to apply if either is missing.

**Rules:**

- **Whenever rewriting a SECURITY DEFINER function via CREATE OR REPLACE, audit the existing definition's safety properties before submitting the new body.** `SECURITY DEFINER`, `STABLE`/`IMMUTABLE` volatility markers, `SET search_path`, REVOKE/GRANT lines — all of these are easy to drop accidentally because PG syntax allows them in any order around the body.
- **Add a regression test** that asserts each safety property by name. The test in `migration-phase-4-3-x-fix-handle-new-teacher.test.ts` does exactly this — `expect(sql).toMatch(/SET search_path = public, pg_temp/)` etc. If a future rewrite drops a property, CI catches it before deploy.
- **Bake the safety properties into the migration's sanity DO-block.** A DO-block that runs `pg_get_functiondef(oid)` and `RAISE EXCEPTION` when a property is missing is far more durable than a comment saying "remember to set search_path". The migration refuses to apply if the function definition is wrong — the deploy fails loudly, not silently.
- **For ANY trigger on `auth.users` specifically,** treat search_path lockdown as MANDATORY. Auth schema's INSERT context has tighter default search_path than the public schema's, and the failure mode is "all signups break for X days until someone tries to sign up."

**Why this is a Lesson #64 sibling:** Lesson #64 said `SECURITY DEFINER` policies need search_path locked because the policies subquery into other tables. This is the same rule applied to TRIGGERS: `SECURITY DEFINER` triggers need search_path locked because they `INSERT INTO` other tables. Same family — same fix.

**Why pre-flight didn't catch it:** the May-1 migration shipped with a smoke test that created a row in `auth.users` via the trigger path AND verified the resulting `teachers` row had the `user_type='student'` skip working. But the smoke test ran in a Supabase SQL Editor session where `search_path` was already set to include `public` — same context as the test author. Production's auth-trigger context is different. **Auth-context smoke tests should run via the actual Supabase Auth admin API path (createUser), not via direct SQL Editor INSERT.**

**Operational rule for future migrations touching `handle_new_teacher` (or any auth.users trigger function):**
1. Read `pg_get_functiondef(oid)` of the existing definition before writing the rewrite
2. Diff your new body against the old to confirm no safety properties dropped
3. Migration's DO-block asserts every safety property survived
4. Smoke test by calling Supabase Auth admin API `createUser`, NOT by direct INSERT INTO auth.users in SQL Editor

### Lesson #67 — When a tool schema has the same property repeated across N call sites, the validators have it repeated too
**The bug:** Lever 1 sub-phase 1G updated three Anthropic `tool_use` schema sites (`buildPageGenerationTool`, `buildLessonGenerationTool`, `buildTimelineGenerationTool`) to make `framing`/`task`/`success_signal` required and removed `prompt` from each. Pattern-bug guard per Lesson #39: "if you're fixing the same pattern in 3 places, also fix the matching pattern in any sibling place." But two sibling places — `validateGeneratedPages` and `validateTimelineActivities` — were missed. They still required `prompt`. Result: every v2 generation after 1G shipped would have been rejected with "Missing 'prompt'." The bug landed in 1G and was caught in 1H by walking the audit list, not by any test.

**Why pre-1H tests didn't catch it:** the 1G schema tests asserted the TOOL schema's required array contained the slots and DIDN'T contain `prompt` (good). The validators have their own require-checks in code (NOT generated from the tool schema). No test bridged the two. The two systems looked at the same JSON shape from opposite directions but their idea of "required" never met.

**The general rule:** **Whenever you change a tool schema's required array, audit every server-side validator that reads the same payload.** They are NOT generated from each other. The tool schema is the input contract Anthropic enforces; the validator is the input contract YOUR code enforces. Updating one without the other = silent validation regression.

**Pattern-bug companion to Lesson #39 + #54:** Lesson #39 says "if pattern X breaks in N call sites, audit all N before fixing one." Lesson #54 says "registries can claim shapes that don't exist." This is a third in the family: **two layers (tool schema, runtime validator) can both claim to enforce a contract, and disagree silently.**

**Operational rule for tool-schema changes:**
1. Before changing a tool's `required` array, grep for any code that ALSO checks the same field as required (validators, type guards, runtime asserts).
2. Update both in the same commit, with shape tests asserting they agree.
3. If you can't update in one commit (different scope), file a follow-up immediately and don't ship the schema change alone.

### Lesson #68 — Repo migration files don't equal applied prod schema; verify before assuming columns exist
**The bug:** The Lever 1 smoke seed (`scripts/lever-1/seed-test-unit.sql`) was authored against the schema-registry.yaml's `units` table definition, which includes `unit_type TEXT NOT NULL DEFAULT 'design'` (added by migration 051). Running the seed on prod errored: `column "unit_type" of relation "units" does not exist`. Migration 051 was in the repo but never applied to this Supabase project. After `information_schema.columns` probe revealed actual prod shape, more drift surfaced: `school_id UUID NOT NULL` (added by Access Model v2) was a NEW required column the schema-registry hadn't picked up, AND `classes.code` had become NOT NULL with no default. The repo migrations and prod state had diverged silently — most likely because earlier sessions ran some migrations directly via Supabase dashboard without recording in a migration log, OR migrations from the repo never got applied in the first place.

**Why this happened:** there's no canonical "applied migrations" log on this database. We rely on filename-in-`supabase/migrations/` as a proxy for "applied," but proxy ≠ truth. FU-EE was already filed for this (P2 — "no canonical migration-applied log; probe-based pre-flight checks are fragile, need single source of truth"). This smoke surfaced the drift more sharply than any prior phase.

**The general rule:** **Before any seed script, raw INSERT, or any code path that names columns explicitly, run `SELECT column_name FROM information_schema.columns WHERE table_name = '...'` against the actual prod database.** Do not trust the schema-registry, do not trust the repo migrations, do not trust your memory. The probe is 5 seconds; the alternative is N rounds of error-and-trim.

**Pattern-bug companion to Lesson #54:** Lesson #54 — "WIRING.yaml claimed files that don't exist." Same root cause: registries describe intended state, prod reflects actual state, drift accumulates silently. **For schema specifically, prod is the source of truth, registries are descriptions.** Treat registries as a starting hypothesis, validate against prod every time.

**Operational rule:**
1. Any seed/INSERT script: probe `information_schema.columns` first, write the INSERT against the probe result.
2. Any phase that touches a table: include "verify columns match registry on prod" in the pre-flight checklist.
3. When `FU-EE` is closed (canonical applied-migrations log exists), this lesson's burden lightens; until then, probe before write.

### Lesson #69 — Triggers can hang seed scripts; bypass them with `session_replication_role = 'replica'` for fixtures
**The bug:** The first Lever 1 seed run took >60 seconds and timed out the Supabase SQL Editor. INSERT triggers on `classes` (`seed_lead_teacher_on_class_insert` + `tg_classes_auto_tag_dept_heads_on_insert` from Access Model v2) were running synchronously on every INSERT, doing membership/dept-head SELECT joins that are fine for one click in the UI but expensive for a seed script. The seed appeared frozen but had actually committed — leaving Matt with a duplicate row when he ran a second attempt.

**The fix:** wrap the seed in:
```sql
BEGIN;
SET LOCAL session_replication_role = 'replica';
-- ... seed work ...
COMMIT;
```
This skips USER triggers (the Postgres role flag for "I'm a replica, don't run triggers") while preserving foreign-key checks. Supabase SQL Editor runs as `postgres` which can do this. Made the seed run in <100ms.

**Why this matters for fixtures specifically:** seed scripts care about WRITING the right rows. The user triggers enforce business invariants (auto-tag membership, audit-log writes, search-index refresh) that are correct for production traffic but pure overhead — sometimes orders of magnitude — for a one-off fixture insert. Bypassing them keeps fixture authoring quick.

**The general rule:** **For one-off seed/test fixtures inserted via SQL Editor or admin scripts, default to `SET LOCAL session_replication_role = 'replica'` inside a transaction.** If a fixture's correctness genuinely depends on a trigger firing (rare for test data), document why and don't bypass.

**Operational rule:**
1. New seed scripts ALWAYS open with `BEGIN; SET LOCAL session_replication_role = 'replica';`.
2. New seed scripts ALWAYS guard against duplicate runs via `WHERE NOT EXISTS` or upsert pattern (Lever 1 seed missed this for the units table — caught after Matt got two rows).
3. Filed `FU-LEVER-1-SEED-IDEMPOTENT` (P3) to retrofit the upsert guard.

### Lesson #70 — When the smoke surface IS the deployed UI, push to a preview branch BEFORE merging to main
**The bug:** Lever 1 had a hard rule from CLAUDE.md: "never push to main until checkpoint signed off + migrations applied to prod." But the checkpoint smoke for Lever 1 was the three-box `SlotFieldEditor` rendering on the Phase 0.5 lesson editor — pure UI behaviour that can't be smoke-tested without a deployed build. So the rule said "smoke before push" and reality said "push before smoke." Catch-22.

**The fix:** push the feature branch (NOT main) to origin. Vercel auto-builds a preview deployment for any pushed branch. The preview deployment talks to the same Supabase project, so the seed data and migration are already in place. Smoke against the preview URL. If it passes, merge to main; if it fails, push fixes to the same feature branch and Vercel rebuilds.

**Why this isn't a discipline violation:** the discipline is "don't push BROKEN code to main." Pushing a feature branch to origin doesn't ship to users — Vercel previews are not the production URL. The push to main happens only after preview smoke passes, which IS what discipline wants. Per Matt's MEMORY rule: "push sub-phases through Vercel preview and continue; only pause for named Checkpoints, genuine architecture questions, or hard blocks."

**For Lever 1 specifically:** Matt called the merge to main directly because he wanted the smoke on the canonical URL (studioloom.org) rather than a preview host. That's a valid override — the migration was already on prod, tests passed, and the validator regression had already been caught by 1H. But the GENERAL rule for next time stays: feature branch → Vercel preview → smoke → main.

**Operational rule:**
1. If smoke gate = "user can see the new UI behaviour," default path is: feature branch push → Vercel preview → smoke → merge.
2. If smoke gate = "headless code path / API / migration shape," default path is: local tests → merge → smoke against deployed main.
3. Don't let the push-discipline rule starve a smoke that legitimately needs a deployed build. Pushing to a feature branch ≠ pushing to main.

### Lesson #71 — Pure logic in `.tsx` files isn't testable in this repo's vitest config; extract to `.ts` modules
**The bug:** Lever-MM sub-phase MM.0F tried to test `buildNmElementBlocks` (a pure factory that takes NM elements + returns BlockDefinitions). The function lived inside `BlockPalette.tsx` because it was tightly coupled to BlockDefinition + BlockCategory types. Test file was named `.test.ts`. Vitest threw at parse time:

  ```
  Failed to parse source for import analysis because the content contains
  invalid JS syntax. If you use tsconfig.json, make sure to not set jsx to preserve.
  Plugin: vite:import-analysis
  File: BlockPalette.tsx:709:67  →  <h3 className="le-cap...">Blocks</h3>
  ```

The repo's `vitest.config.ts` has no React/JSX plugin (no `@vitejs/plugin-react`, no `vitest.config.tsx`-with-jsx-pragma setup, no `esbuild.jsx` config). So when ANY test imports from a `.tsx` file, vite tries to transform the `.tsx` and trips on the first JSX expression. Renaming the test to `.test.tsx` did NOT help — the importer's JSX-awareness doesn't propagate to the importee.

**The fix:** extract pure logic out of `.tsx` into a sibling pure `.ts` module. Re-export from the `.tsx` so the public surface stays unchanged. Tests import the new pure `.ts` directly and never touch the `.tsx`.

**For Lever-MM specifically, this meant 3 small modules:**
- `BlockPalette.types.ts` — `BlockDefinition` + `BlockCategory` interfaces (pure types, no JSX)
- `nm-element-blocks.ts` — `buildNmElementBlocks` factory (pure logic)
- `BlockPalette.tsx` — the React component, now imports + re-exports the above

**Why this is a Lesson #38 sibling:** Lesson #38 said "verify expected values, not just non-null." This is "verify pure-logic boundaries, not just colocation." Both are about catching the gap between "this works because of coincidence" (test was happy because it didn't actually run) and "this works because the contract holds" (test exercised the actual function).

**The general rule:** **If pure logic lives inside a `.tsx` file, treat it as untestable in this repo's current config. Extract it to a sibling `.ts` module before writing the test.** The cost is one extra file; the benefit is testable logic + clearer JSX/non-JSX boundary in the codebase.

**When this comes up:** any time you find yourself wanting a `.test.ts` to import a helper function, factory, type, or pure transformer that currently sits inside a React component file. Especially common in:
- Block / palette / library factories that build BlockDefinitions
- Form-state reducers
- Validators that take props and return errors
- Conversion helpers (DB row → display shape)
- Any `useFoo()` hook's pure-helper extracts

**Operational rule:**
1. Before writing the test, scan the source file: does it have JSX? If yes, the imported functions need to live in a sibling `.ts`.
2. Cheap fix: create `<ComponentName>.<concept>.ts` (e.g. `BlockPalette.types.ts`), move the pure code, re-export from the `.tsx`.
3. Test imports from the new `.ts` directly, not the `.tsx`.
4. **Don't** add a `@vitejs/plugin-react` to vitest.config just to test one function — that affects every test in the suite (slower transforms, larger footprint, cascading config concerns). Extract the function instead.

**Long-term consideration:** if the codebase eventually wants component-level tests (mounting React, asserting rendered output), THAT's when `@vitejs/plugin-react` earns its place. Until then, pure-logic-in-`.ts` is the simpler boundary.

### Lesson #72 — Manually-maintained schema-registry causes prod-apply failures; live introspection is non-optional once a project has >50 tables
**The bug:** TG.0B's schema migration failed prod-apply twice in a row, both times because `docs/schema-registry.yaml` had drifted from prod reality:

1. **First failure:** `column 'task_id' does not exist`. The brief said "RE-MINT student_tile_grades with task_id NOT NULL" because the registry recorded `student_tile_grades` as `status: dropped, columns: {}`. Reality: the table had been live on prod since 27 Apr 2026 with 26 columns from 3 applied migrations. Fix: pivot to Path A (ALTER ADD task_id), but only after burning a full session re-authoring the migration + tests + down-migration + registry entries.

2. **Second failure (same migration, next attempt):** `column 'user_id' does not exist; HINT: Perhaps you meant assessment_tasks.unit_id`. Two RLS policies referenced `teachers.user_id` because I assumed the `teachers` table joined to `auth.users` via a `user_id` FK. Reality: `teachers.id` IS `auth.users.id` (1:1 relationship). The registry didn't capture the join column, so the assumption went unchecked.

Both failures had the same root cause: **the registry has no auto-sync mechanism**, while the api-registry (266 routes) and ai-call-sites (47 calls) DO have scanners (`scripts/registry/scan-api-routes.py`, `scripts/registry/scan-ai-calls.py`) that run on every saveme. Without that loop, manual edits drift. The registry then becomes a confidence trap — *visibly populated entries* feel authoritative, but they reflect intent at write-time, not current prod state.

Drift sources observed in this session alone:
- `student_tile_grades` recorded as dropped while it was live (zombie entry from a rolled-back-then-reapplied migration)
- `student_tile_grade_events` had the same staleness (sibling table from the same migration)
- `teachers` join column not captured anywhere — only discoverable by grepping other migrations
- Sister FU-PROD-MIGRATION-BACKLOG-AUDIT (P1) found prod is missing migration 051 + much of Access Model v2 schema, meaning the *repo migrations* aren't a trustworthy source of truth either — only live introspection is.

**The fix (filed as FU-SCHEMA-REGISTRY-AUTO-SYNC P1):** build `scripts/registry/scan-schema-registry.py`. Connect via `SUPABASE_SERVICE_ROLE_KEY`, query `information_schema.columns` + `pg_catalog.pg_policies`, diff against the yaml, write `docs/scanner-reports/schema-registry.json`. Wire into saveme step 11. One-shot resync PR brings the existing 110 entries up to date.

**The general rule (a sibling to Lesson #54 + #68):** **For any registry over ~50 entries, manual maintenance will go stale faster than humans notice. The minute a registry's cost-of-staleness includes "migration fails on prod-apply," it has earned a scanner.** Schema-registry is no different from api-registry; treating one as auto-synced and the other as manual was the original mistake.

**Operational guidance:**
1. **Don't trust registry entries that haven't been touched in 30+ days** — even ones that look complete. Probe `information_schema.columns` directly before designing any migration that ALTERs an existing table.
2. **When two registry entries disagree about the same fact** (status: dropped vs applied_via: [migration list], 0 columns vs nonzero applied_date) — that's drift, not a typo. Trust the one that matches prod, not the one that matches your current commit.
3. **The cost of a scanner is one afternoon. The cost of a failed prod-apply mid-session is one afternoon plus pivoting your migration plan plus re-running tests plus re-pasting the body to Matt twice.** Scanner ROI is positive on the first prevented failure.
4. **Live introspection beats migration-file parsing** because of FU-EE (no canonical applied-migrations log) + FU-PROD-MIGRATION-BACKLOG-AUDIT (repo migrations ≠ applied set). The yaml needs to mirror prod, not the repo.

**When this comes up:** any phase that ALTERs an existing table; any migration that asserts a foreign-key target column name; any `WHERE x = auth.uid()` site (the column name is *never* obvious — always grep prior migrations). For TG.0C onward, probe `information_schema.columns` via Supabase SQL editor before authoring SQL — same Lesson #68 pattern, applied earlier in the workflow.

### Lesson #73 — Cap counters and usage logs are independent pipelines; bills can rise without leaving an attribution trail
**The bug:** Built `/admin/ai-budget/[studentId]/breakdown` (PR #116) to show where each student's daily tokens went — grouped by endpoint × model. On first deploy, every active student's expanded row showed the same message: *"No `ai_usage_log` rows for this student today, but `ai_budget_state.tokens_used_today` = X. Reconciliation gap."* 100% gap on every row.

The investigation surfaced two distinct bugs in `logUsage` plumbing across student-facing AI routes:

1. **`word-lookup` and `quest/mentor` use `withAIBudget` for cap enforcement but never call `logUsage` at all.** The cap counter (`ai_budget_state.tokens_used_today`) ticked up on every call via the SQL function `atomic_increment_ai_budget()`, but no row was ever written to `ai_usage_log`. The student was being billed against the cap, but the diagnostic table didn't know.
2. **`design-assistant`, `open-studio/check-in`, `open-studio/discovery` call `logUsage` but don't pass `studentId`.** Rows landed in `ai_usage_log` with `student_id = NULL`, so any per-student query missed them. The diagnostic table knew, but couldn't attribute.

Both bugs were silently invisible until the breakdown view existed. Per-student daily totals (which only need `ai_budget_state`) had been correct the whole time. The drift was in the *attribution* layer.

**Why this is a Lesson #38 + #54 sibling:** Lesson #38 said "verify expected values, not just non-null." Lesson #54 said "registries drift when not auto-synced." This is the runtime version: **two write paths to two different tables, both of which need to receive the same event, and no compile-time or runtime invariant tying them together.** A route can call `withAIBudget(...)` without `logUsage(...)` and the program runs fine — the bug only shows up if anyone ever asks "where did the tokens go?"

**The fix that landed:** PR #119 (5 student-facing routes patched — 2 added new logUsage calls with studentId, 3 added studentId arg to existing calls). Phase A.2 (PR #122 by another session) then absorbed the inline `logUsage` + `withAIBudget` calls into a single `callAnthropicMessages()` helper at `src/lib/ai/call.ts`, structurally eliminating the class of bug — the helper writes to both tables in one place, so route authors can't forget one.

**The general rule:** **Whenever two tables track different aspects of the same event (counter vs log, queue vs ledger, denormalized cache vs source-of-truth row), one of two things must be true:**
- **Either** the writes happen through a shared chokepoint that updates both atomically (Phase A.2 outcome — preferred), **or**
- **A reconciliation gap detector visible on the same surface as the count** runs continuously, so drift is impossible to miss the first time someone looks (PR #116's amber callout — what surfaced this bug).

**Both patterns combined are best.** A chokepoint prevents new drift; a reconciliation detector catches drift from existing routes that haven't migrated yet. PR #116 → #119 → #122 was that exact sequence: build the diagnostic, find the gap, ship the bridge fix, then absorb the call sites into the chokepoint that prevents recurrence.

**Operational guidance:**
1. **When designing a new metrics/audit/log table fed by code (not a trigger),** always pair it with at least one invariant check that compares the log against an independent counter or aggregate. Put the check on the same admin surface as the count — not buried in a CI report. Ten lines of UI catches what zero lines never will.
2. **When a feature reads from two tables that should match,** explicitly compute and surface the gap. Don't show the two numbers separately and trust the reader to subtract.
3. **For new routes calling AI/expensive APIs,** prefer the centralised helper over inline calls (post-Phase A.2 this is `callAnthropicMessages()` in StudioLoom). The helper is the chokepoint that makes the two-write problem impossible.
4. **For "drift surfaced by a new view" bugs in general,** investigate which write path is missing or mis-attributed before patching the view. The view is doing its job by surfacing the gap; the underlying writes are what needs fixing.

**When this comes up:** any new admin diagnostic that aggregates over a usage/audit/log table; any feature that bills (cap counter) and logs (audit trail) in separate code paths; any reconciliation between a denormalized counter and a per-row source. The amber callout pattern (`Reconciliation gap: A is N tokens ahead of B. Some site bypasses logUsage()`) generalises — it's "an invariant the reader can act on" rather than "two numbers the reader has to compare."

---

### Lesson #74 — When fix attempts in the same layer keep failing, instrument before adding another layer

**The bug:** Kanban modal-on-drop. Six rounds of progressively-aggressive click-suppression (round 26 ref + 350ms gate; round 28 bumped to 1000ms + dragStart stamp; round 31 board-root onClickCapture; round 33 direct DOM `pointerEvents = "none"`; round 34 document-level click listener with capture; round 35 full revert of 31/33/34 because they broke drag entirely). After round 34 broke drag mid NIS Class 1, every subsequent attempt was rolling forward in the same layer — adding guards on top of guards. Modal still popped.

Round 36 stopped adding layers and added one `console.trace` call inside `setOpenCardId`. The trace ran live in DevTools during a drop and revealed: `dragEnd fired { offsetX: 363 }` → `setOpenCardId called` (the bug) → `dragEnd fired { offsetX: -282 }` (snap-back animation re-fires the event). Two `dragEnd`s per drag, with the click event squeezed between them. None of the timestamp gates could have caught it because they were measuring time-since-last-dragEnd, and "last" was an ambiguous concept when there are two.

Round 37 fix took 30 minutes to design once the trace was visible.

**The general rule:** **when the layer you're operating in keeps failing to fix a symptom, the diagnosis is wrong, not the implementation.** Adding a sixth click-suppression mechanism was always going to fail because the bug wasn't a click event leaking through — it was a misunderstanding of the gesture cycle. One `console.trace` would have surfaced the real shape in 5 minutes; instead 5 days of gates accumulated.

**Operational guidance:**
1. **Three failed rounds in the same layer = stop and instrument.** Don't ship a fourth gate or a fifth gate. Add visibility into what's actually happening at runtime.
2. **`console.trace` (with stack trace) > `console.log` (just value)** — the trace shows you the call path.
3. **`console.warn` is good enough** — you don't need a fancy debug surface or a sandbox simulator. Plain console + `git commit` + Vercel preview = full live reproduction in 90 seconds.
4. **Diagnostic commits ARE round-numbered work.** PR #95 was "round 36 — instrument setOpenCardId with console.trace" and was the most valuable commit of the entire 7-round saga.
5. **Strip diagnostics in a follow-up PR.** Don't leave them in prod. Round 42 cleanup was -188 lines.

**When this comes up:** event-ordering bugs, framework-quirk bugs (framer-motion, Next.js router, React render lifecycle), bugs that "should be fixed" by your last 3 attempts but aren't.

---

### Lesson #75 — When same-layer guards keep failing, the bug is probably in a different layer

**The bug:** Kanban "card flies back to original column after drop" persisted even after rounds 38, 39, 40 shipped. Each round added another guard at the gesture layer (round 38: viewport-coord conversion; round 39: `activeDragCardRef` per-card phantom-dragEnd guard; round 40: `lastDragEndAtRef` timestamp debounce per cardId). Round 40 also added a `dragStart fired` console.warn diagnostic that, in the next live test, **disproved my own hypothesis** — framer-motion fires exactly ONE `dragStart` and ONE `dragEnd` per gesture. There was no phantom event to guard against. Yet cards still flew back.

Round 41 traced the actual cause: not the gesture layer, the **persistence layer**. `useKanbanBoard.flushSave` was clobbering local state with the server's canonical `loadState` response, wiping any drag that landed during the save's network roundtrip (200-600ms). Fix was 5 lines: only apply server response if `stateRef.current === snapshot` (no change during save).

Three rounds of guards in the gesture layer; the bug was three function calls upstream in the persistence layer.

**The general rule:** **when guards in the same layer keep failing to fix a symptom, the bug is probably in an adjacent layer.** Adjacent = anything within ~5 stack frames of where you're guarding. Network handlers, reducers, parent components, side-effect hooks, server responses. The narrative "events leak through gate X, so I'll add gate Y closer to the surface" is seductive and usually wrong when it's the third gate.

**Operational guidance:**
1. **When you've shipped 3 guards in the same layer and the symptom persists, force yourself to look at: (a) where the symptom's data comes from, (b) where it gets written, (c) what runs between A and B.** That's the upstream/downstream sweep.
2. **Round-X diagnostics that DISPROVE your hypothesis are gold.** Don't bury them. The `[kanban] dragStart fired` warn proved no phantoms exist — that should have been the moment to look elsewhere, not the moment to add more guards.
3. **The root-cause layer is often the layer that handles "fresh data overwriting local state."** Save handlers, query refetches, server-pushed updates, optimistic-update reverts.

**When this comes up:** any "the fix keeps not fixing it" symptom; any bug with timing-dependent reproduction; any bug where the user reports "it works most of the time but sometimes…" (timing-related = save-race-suspect almost always).

### Lesson #76 — TypeScript discriminated-union narrowing breaks on dead code after early returns
**Date:** 8 May 2026
**Phase:** AI provider abstraction A.2

**What happened:** Migrating `admin/ai-model/test` and `test-lesson` routes — both quarantined with `return QUARANTINE_RESPONSE` early returns followed by ~150 lines of dead code. After swapping `client.messages.create` for `callAnthropicMessages`, the dead-code branch failed to type-check: TS reported `Property 'reason' does not exist on type 'CallResult'` inside an `if (!callResult.ok) {...}` block where narrowing should produce `CallFailure`. Same code in a probe file outside the route narrowed correctly. Conclusion: TS's control-flow analysis interacts oddly with code reachable only via an early-return-protected branch.

**Workaround:** type-cast `const cr = callResult as any` once and use `cr.reason` / `cr.error` / `cr.response` inside the dead-code branch. Real callers (lesson-editor, wizard, student routes) all narrowed correctly.

**Rules:**
- **Don't waste time fighting the type system on dead code.** Quarantined routes have one job — return their early-exit. The dead code beneath them is going to be deleted or rewritten when the quarantine lifts. Cast and move on.
- **Suspect TS narrowing fails when the file has an early-return at function start AND your migrated code is below that.** It's specifically dead-code narrowing that misbehaves; live paths are fine.
- **Probe in isolation before assuming your types are wrong.** A 10-line probe file in the same directory with the same imports proved the helper's discriminated union worked correctly — the issue was the surrounding file's structure, not the type definition.

### Lesson #77 — Scanner gate thresholds expire when chokepoints land; bump them with a follow-up to fix root cause
**Date:** 8 May 2026
**Phase:** AI provider abstraction A.3

**What happened:** `scripts/registry/scan-ai-calls.py` had a gate that failed if `dynamic` model count exceeded 30% of all sites. Designed when each call site hardcoded its model — high `dynamic` = drift. Post Phase A.3, the chokepoint helper passes model through as a parameter, so EVERY helper-internal call shows as `dynamic`. Gate failed at 8/22 = 36%. The signal flipped polarity: dynamic = chokepoint working.

**Fix applied:** Bumped threshold 30% → 60% to unblock the saveme. Filed `FU-AI-SCAN-CHOKEPOINT` (P3) to teach the scanner to recognise `callAnthropicMessages` as a single chokepoint, not N separate dynamic sites.

**Rules:**
- **When a chokepoint lands, the gates that protected the pre-chokepoint world expire.** They're not wrong — they were correctly catching drift in the old world. They need updating because the new world has a different distribution.
- **Adjust the threshold to unblock, file an FU to fix root cause.** Don't over-engineer the scanner during the migration that triggered the change. Threshold bump = 1 line; teaching the scanner about the helper = real refactor.
- **Scanner gates calibrated to a pre-state should be revisited at every architectural shift.** Same family as Lesson #34 (test assumptions drift silently): gate assumptions drift silently too.

### Lesson #78 — Helper migrations create per-call double-logging risk; use a `skip` option, not a partial migration
**Date:** 8 May 2026
**Phase:** AI provider abstraction A.3 (toolkit `shared-api`)

**What happened:** Migrating `src/lib/toolkit/shared-api.ts` (used by 25+ toolkit routes via `callHaiku`) through the helper meant the helper would `logUsage` with `endpoint: "lib/toolkit/shared-api"`. But each toolkit route ALSO calls `logToolkitUsage` with its own per-tool endpoint + tool/action metadata. Result: every toolkit call would write 2x to `ai_usage_log` — once with the generic shared-api endpoint, once with the per-tool endpoint. Token totals doubled in the breakdown view.

**Fix:** Added `skipLogUsage?: boolean` option to the helper's `CallOptions`. `shared-api.ts` sets it true; per-tool `logToolkitUsage` continues to handle attribution downstream.

**Rules:**
- **When a helper migration enters a layer that already has its own logging discipline, add a `skip` option, not a partial migration.** Partial = some sites log via helper, some via their own code, fragile mental model. `skipLogUsage` is honest: this site has its own attribution, helper steps back.
- **Run the breakdown view by hand against a few real calls before declaring a migration done.** Double-logging is invisible until you check. Single-record + verify-totals catches it in seconds; trusting the migration catches it weeks later when costs look strange.
- **Helper extensions justified by real call sites are fine; speculative options are not.** `skipLogUsage` exists because one real caller (toolkit) needed it. If a future caller needs another option (e.g. `customCostFormula`), add it then. Lesson #44 still applies — don't pre-fab options for hypothetical futures.

### Lesson #79 — Controlled-input text fields that parse on every keystroke clobber whitespace before the next character lands
**Date:** 10 May 2026
**Phase:** LIS.D — KeyCalloutEditor title textarea

**What happened:** The magazine-callout title field stored as `string | string[]` (single-line vs one-word-per-line array). The textarea ran `parseTitleInput(raw)` on every `onChange`, which did `.split("\n").map(s => s.trim()).filter(Boolean)`. Result: typing "Test Title" produced "TestTitle" — the trailing space was stripped on the keystroke when the space landed, then the textarea re-rendered with the trimmed value, so the user's next "T" came in as if "Test" was already there. Same root cause for Enter dying — empty trailing lines got `filter(Boolean)`-ed away before reaching `string[]` storage.

**The trap:** the parse function was correct in isolation (collapsing single-line → string and multi-line → array is the right storage shape). The bug was *when* it ran — on every keystroke. The render → parse → store → re-render cycle clobbered the in-progress edit.

**Fix:** local-draft pattern. `const [titleDraft, setTitleDraft] = useState(formatTitle(value))` owns the raw textarea content during editing. `onChange` only updates the draft. `onBlur` commits via `commitTitle(titleDraft)` (renamed from `parseTitleInput` to signal the boundary nature). `useEffect` syncs the draft from the prop on external changes.

**Rules:**
- **Controlled inputs whose storage shape differs from the raw textarea content need a local draft and a boundary commit.** Single-line `<input>`s usually parse fine on every keystroke because the storage IS the raw value. The moment your storage normalisation strips, trims, splits, or collapses, the textarea needs its own state during editing.
- **Don't put aggressive normalisation in the controlled-value reduce step.** If the textarea displays its own committed value via `formatX(stored)` AND the parse runs on every onChange, mid-edit content can never include states like "trailing space" or "empty trailing line" — they get normalised away before the user can complete the keystroke.
- **Rename to signal intent.** `parseTitleInput` sounded innocuous and was called everywhere. `commitTitle` makes it obvious this only runs at the boundary (blur, submit), so future readers don't reintroduce the per-keystroke call site.
- **Spot-check by typing two-word phrases.** Single-word inputs hide this bug — you only notice when you try "Test Title" or press Enter. Add at least one multi-word test fixture per text-editing surface.

### Lesson #80 — Tap-a-word doesn't get inherited; every new student-facing prose surface needs explicit wiring
**Date:** 10 May 2026
**Phase:** LIS.A through LIS.E ship sequence

**What happened:** The LIS series introduced three new student-facing surfaces (`KeyInformationCallout`, `RichTextResponse`, `MultiQuestionResponse`). Students could see the text but couldn't tap individual words for dictionary lookups — the feature was silently missing. The legacy info-block path got tap-a-word for free via `ActivityCard → ComposedPrompt → MarkdownPrompt(tappable={true})`. The new surfaces rendered plain `<p>` tags and `<div>` content, bypassing MarkdownPrompt entirely. Only surfaced when Matt smoke-tested the magazine callout in production.

**Why it slipped:** the components were spec'd as visual upgrades (chrome, layout, palette). Tap-a-word isn't visible in static design mocks — it's an interaction. The original spec didn't enumerate tap-a-word as a requirement, so the new components rendered text via the simplest path (`<p>{value}</p>`) which works visually but loses the wrap-each-word-in-`<TappableText>` behaviour MarkdownPrompt provides.

**Fix:** route every student-visible prose surface in lesson components through `<MarkdownPrompt text={...} tappable={tappable} />` (default `true`). Storybook fixtures opt out via `tappable={false}` to avoid needing the student-context provider.

**Rules:**
- **Tap-a-word is an opt-in render flag, not an inherited behaviour.** Every new surface that renders student-facing prose has to explicitly route through MarkdownPrompt (or call TappableText directly). Audit the leaves: anywhere a string ends up inside `<p>`, `<div>`, or any text node is a candidate.
- **When building new render surfaces parallel to existing ones, enumerate the cross-cutting features the existing surfaces give for free.** Tap-a-word, audio-button (TTS), copy-to-clipboard, integrity tracking, portfolio capture — none of these are visible in design mocks. Pulling them forward from the legacy path is part of the new-surface checklist.
- **The signal that this was missed:** the LIS dispatch tests asserted the *visual* render contract (KeyInformationCallout receives bullets, MultiQuestionResponse renders helper, etc.) but didn't assert *which renderer* the text passes through. Next time, add a wiring test like "bullet body routes through MarkdownPrompt" — that catches the regression without needing a real React mount.
- **Don't add a "tap-a-word-able" prop downstream that flips render behaviour.** Always opt in by default for production-mounted surfaces; let storybook opt out. The risk profile is asymmetric — students losing a feature is bad, storybook crashing is annoying but easy to detect.

### Lesson #81 — Narrative filter activation gate is per-section, not per-write; "sent to portfolio" needs cross-reference at read time
**Date:** 10 May 2026
**Phase:** LIS.E — FU-LIS-PORTFOLIO-NARRATIVE-DISPLAY

**What happened:** Students writing a regular text response and pressing the PortfolioCaptureAffordance "Send to Portfolio" button saw their entry appear in `/portfolio` but it was MISSING from `/narrative` — even though `student_progress.responses[responseKey]` held the data correctly. Root cause: `buildNarrativeSections` activated a portfolio-filter mode when ANY section in the unit had `portfolioCapture: true`, and in filter mode ONLY included sections where the section itself had `portfolioCapture: true`. Manual Portfolio captures of regular text responses (no `portfolioCapture` flag on the section, but a portfolio_entries row exists) fell into the gap — flag-on-section AND write-to-portfolio_entries were two independent paths that the read-side filter conflated.

**Why it persisted:** the filter logic looked correct in isolation. The portfolio_entries table was used elsewhere (NarrativeView's `manualPortfolioEntries` filter) but never cross-referenced INTO buildNarrativeSections. Each surface had its own filter for its own use case; the gap was at the integration.

**Fix:** `buildNarrativeSections` accepts a third arg `portfolioEntries: PortfolioEntry[]` (default `[]` for back-compat). Inclusion widens to: section shows in Narrative when EITHER `section.portfolioCapture === true` OR a `portfolio_entries` row exists for the section's `(page_id, section_index)`. Cross-reference at read time, not at write time — preserves the existing write contract.

**Rules:**
- **Read-side filters that activate on per-unit signals (like "any section in unit has flag X") must cross-reference EVERY mechanism that can satisfy the underlying intent.** Filter intent: "did the student want this response in their narrative?" Two mechanisms: (a) section has portfolioCapture flag (auto-capture path), (b) student pressed Portfolio affordance (manual path). Filter only checked (a). The integration was the bug.
- **Don't fix this at write time.** Tempting fix: change PortfolioCaptureAffordance to ALSO flip `section.portfolioCapture = true` on the section. That mutates authoring data based on student action — fragile, surprising side effects.
- **Cross-reference at read time, with a default-empty third arg for back-compat.** This let existing callers stay unbroken (they just don't get the inclusion widening) while new callers opt in by passing the data they already had.
- **The signal that this was missed:** the narrative tests asserted dual-key lookup (`activity_${id}` vs `section_${i}`) but didn't have any test that combined `portfolioCapture: false` + a portfolio_entry. The "filter gate" axis wasn't covered. Add filter-activation-state tests when filters depend on multi-table signals.

### Lesson #82 — Inline component-prop functions to react-markdown destroy the entire markdown subtree on every render
**Date:** 11 May 2026
**Phase:** Tap-a-word reliability — Path B root-cause fix
**Trigger:** Matt: "tap a word is still buggy. we need to get to the bottom of it. sometimes need to click 4 times with 4 different outcomes" (no popup / quick popup gone / loading then gone / works). Diagnostic logs showed every TappableText on the lesson page unmounting + remounting with new instance IDs on each tap. ~18 simultaneous unmount→mount cascades per click.

**What happened:** `MarkdownPrompt` rendered `<ReactMarkdown components={{ p, strong, em, li, a }}>` with the `components` object **declared inline** in the JSX. Every render created brand new function references for each entry. `react-markdown` uses these as React COMPONENT TYPES (`React.createElement(components[nodeName], props)`). When the function reference changes between renders, React's reconciler sees a new component type → unmounts the entire matching subtree → remounts fresh. All TappableText children (and their popovers) were destroyed on every render of MarkdownPrompt.

**Why this hid for a year:** the rendered HTML was identical between renders, so visually nothing looked wrong. The unmount cascade was invisible until we instrumented TappableText with mount/unmount lifecycle logs (round 25 diagnostic, commit `c9ce573`). The popover-disappearing UX was the symptom — the cause was 18 children dying on every parent tick.

**Fix:** hoisted all five overrides to module-scope component functions (`MarkdownAnchor`, `MarkdownP`, `MarkdownStrong`, `MarkdownEm`, `MarkdownLi`) and exported two stable `Components` constants (`PLAIN_COMPONENTS`, `TAPPABLE_COMPONENTS`). The component overrides close over no state — they're pure renderers — so module-scope is correct. If they ever need to close over state, useMemo with the right deps is the equivalent.

**Rules:**
- **NEVER pass an inline-declared `components` prop to react-markdown.** The reference must be stable (module-scope const, useMemo with stable deps, or hoisted shared constant). Same applies to any library that treats its prop value as a React component type — react-syntax-highlighter, MDXProvider, slate, prosemirror plugins.
- **Pure render-config props that close over no state belong at module scope, not in the component body.** Lifecycle: declared once when the module loads, never re-allocated. Zero overhead, immune to render churn.
- **When a child component is mysteriously unmounting + remounting with no obvious dismiss reason, instrument its lifecycle.** Mount/unmount `console.log` with a stable per-instance ID + a content preview is enough to spot remount cascades within minutes. Round 25 diagnostic patches (`16fac5a`, `c9ce573`, `3b26b22`) located the bug in ~3 commits and zero speculation. Diagnostic-instrumentation-first is a much shorter path than guess-and-fix.
- **Defensive architecture (Path A — lift state to a stable parent) and root-cause fix (Path B — fix the parent's render churn) are NOT mutually exclusive.** Ship both. Path A makes the bug fixable today; Path B prevents the next instance of the same anti-pattern from reproducing. Belt and braces is correct when the cost is one extra commit.

**Wider applicability:** any React app using a markdown / DSL / DOM-mapping library with a `components` / `renderers` / `mapping` prop. Audit those props NOW — if any are inline-declared, they're tearing down their subtrees on every render. Fix them BEFORE you instrument; the bug is structurally identical regardless of which library.

### Lesson #83 — Prod has NO application migration tracking table; assume nothing about applied state
**Date:** 11 May 2026
**Phase:** Student-creation incident close-out

**What happened:** Adding a student via `/teacher/classes/[classId]` returned 500. Root cause: the `handle_new_teacher` trigger in prod was migration-001's buggy version (unqualified `teachers`, no `search_path`, no `EXCEPTION`), even though three repo migrations had fixed it (`20260501103415` student guard, `20260502102745` search_path, `20260502105711` auto-personal-school). When I probed `supabase_migrations.schema_migrations` to find what was applied to prod, the table didn't exist. `information_schema.schemata` confirmed: the only migration-tracking tables in prod are Supabase's internal ones (`auth.schema_migrations`, `storage.migrations`, `realtime.schema_migrations`). NO application-level tracking exists. Migrations in `supabase/migrations/*.sql` have been applied by hand all along, with no record of what landed when.

**Why it bit on 11 May, not 29 April when the bug was deployed:** `provisionStudentAuthUser` went live on 29 April (Phase 1.1d). Every student creation through the UI since then should have failed — but Matt was the only active teacher and didn't add a fresh student through the broken paths for 12 days. When he did, the UI silently swallowed the 500 (sister anti-pattern, see [Lesson #67-style silent error swallow]) and looked like the click did nothing. Took a full DevTools-Network-Vercel-Supabase-logs trace to extract the underlying `relation "teachers" does not exist (SQLSTATE 42P01)`.

**Why this matters more than it sounds:** every future `CREATE OR REPLACE FUNCTION` / `ALTER TABLE` / `CREATE POLICY` in the repo's `supabase/migrations/` folder layers checks against assumed prior state. Without a tracking table that assumption is unverifiable — and as discovered here, sometimes false. The May-2 trigger (Phase 4.3.y) inserts into a `schools` table that may or may not be in prod; the May-9 RLS hardening assumes student-RLS chains that may or may not be in place. The repo has been steadily writing migrations against assumed prod state for ~6 months with no way to verify.

**Rules:**
- **Never assume a repo migration is applied to prod.** Before authoring a follow-on migration that depends on prior schema state, probe directly:
  ```sql
  SELECT to_regclass('public.expected_table');         -- table exists?
  SELECT column_name FROM information_schema.columns   -- column exists?
   WHERE table_name='x' AND column_name='y';
  SELECT proname FROM pg_proc                          -- function/trigger exists?
   WHERE proname='handle_new_teacher';
  SELECT pg_get_functiondef(oid) FROM pg_proc          -- function body matches?
   WHERE proname='handle_new_teacher';
  ```
  These are cheap (<100ms) and stop you from layering migrations on a phantom foundation. The Lesson #68 pre-flight discipline applies here too — capture truth from prod, not from the registry.
- **The `schema-registry.yaml` and `api-registry.yaml` are aspirational, not authoritative.** They reflect what the REPO believes; they cannot be trusted as a description of prod. The actual prod schema is the only source of truth — query it.
- **When a migration adds a `CREATE OR REPLACE FUNCTION` or `CREATE OR REPLACE TRIGGER`, codify the EXACT body including all safety properties** (`SET search_path`, `EXCEPTION WHEN others`, `public.` qualifier). One omission cascades through every later migration that touches the same function. Lesson #66 was the first manifestation; this Lesson #83 is the second.
- **Triggers on `auth.users` are the single highest-leverage drift surface** — failures there block every signup path simultaneously (teacher signup, student auth-provision, LTI launch, LMS sync, lazy classcode fallback). Audit `auth.users` triggers first whenever investigating prod drift.
- **The systemic fix is FU-PROD-MIGRATION-BACKLOG-AUDIT (P1)** — now upgraded in severity. Plan filed at `docs/projects/prod-migration-backlog-audit-brief.md`. End-state: create a `public.applied_migrations` tracking table, backfill it from a probe-driven audit, then wire `scripts/migrations/new-migration.sh` to require a tracker row before a migration is considered done. Saveme should diff `supabase/migrations/*.sql` against this table on every run.

**Sister lessons:** Lesson #65 (old triggers don't know about new user types) and Lesson #66 (re-apply search_path lockdown on every function rewrite) are both downstream of this one. Without a tracking log, the fixes from Lessons #65+#66 silently failed to land in prod, and the bug they were authored to prevent struck anyway 10 days later.

### Lesson #84 — Code-level sentinels still need a row in the foreign-key target table
**Date:** 12 May 2026
**Phase:** Choice Cards `_pitch-your-own` hot-fix (PR #217)

**What happened:** The Choice Cards picker had a special-cased sentinel ID `_pitch-your-own` — the front-end recognised it, rendered a "Pitch your own" entry point, and routed selection into the Product Brief Other archetype + pitch flow. TypeScript side: clean. UI side: clean. Prod side: when a student tapped it, the API returned a `foreign_key_violation` because `choice_card_selections.card_id` FKs to `choice_cards.id`, and no row with `id = '_pitch-your-own'` existed in `choice_cards`. The sentinel was a code-only concept; Postgres doesn't read your TypeScript.

**Fix:** Hot-fix migration `20260512053424_seed_pitch_your_own_choice_card.sql` INSERTs the placeholder row (with title "Pitch your own", a default illustration URL, and metadata flagging it as the sentinel). Rollback migration includes a safety guard that refuses to drop the row if any `choice_card_selections` reference it — would orphan student picks.

**Rule:** When you introduce a code-level sentinel ID (`_pitch-your-own`, `_anonymous`, `__system__`, etc.) that gets persisted into a FK column, ALWAYS author the seed migration in the same PR as the code change. The seed row is part of the contract — not a follow-up, not an "I'll backfill it later". Front-end special-casing without a backing row is a bug, not a clever shortcut.

**Sister anti-patterns:** Sentinel string in NOT NULL UUID columns (FU-GG / FU-KK pattern — `"system"` written into UUID FKs). Same family: code knows about a magic value; the database schema doesn't. The fix is always: either seed the row, or change the column type to allow the sentinel form, or split the writer into a different audit table.

### Lesson #85 — Don't run user-text moderation over system-generated content
**Date:** 12 May 2026
**Phase:** Image-upload PII fix (PR #211)

**What happened:** The Product Brief / User Profile / Success Criteria blocks bridge their state into `student_progress.responses` via `useSpecBridge`. The summary string built by `formatAnswer` for an image-kind slot was originally `[Photo] <storage-proxy-URL>`. The URL contained the unit_id UUID (e.g. `/api/storage/user-profile-photos/1ef3a733-...-784717788328/...`). The last UUID segment (`784717788328`) is 12 consecutive digits, which matched the CN-landline PII regex in the moderation pipeline. Result: students got "This content can't be submitted" when the marking page tried to render the user-profile completion summary. They couldn't progress past the block.

**Fix (PR #211):** Stripped the URL from the summary. `formatAnswer` now emits `[Photo: <caption>]` — caption is user-controlled, URL stays only in the dedicated typed-payload column, not in the text summary that goes through moderation.

**Rule:** Don't moderate system-generated content (URLs, UUIDs, IDs, timestamps, IPs, generated codes) as if it were user text. They look like PII to regex moderators because they contain digit/letter runs of the right length. Either (a) strip system-generated tokens from the moderation payload before scoring, or (b) moderate only the user-controlled portion. The PII regex is a tool for catching what users type, not what your own backend generates.

**Sister lesson:** This is the dual of Lesson #38 (verify = assert expected values, not just non-null) — there, false negatives slip through. Here, false positives block legitimate submissions. Both stem from the same root: assertions that don't know enough about what they're asserting against.

### Lesson #86 — Loose coupling is the feature; resist the cascade instinct
**Date:** 12 May 2026
**Phase:** Choice Cards "Change my mind" (PR #218) — architectural decision

**What happened:** Added a "← Change my mind" affordance to Choice Cards so students could revise their initial archetype pick. The obvious next question: should the pick re-flow downstream? If a student picks Toy, fills out Product Brief slots, then picks Building — should the Product Brief reset? Show a warning? Trigger a re-walk? Three plausible cases: (1) re-pick before any slot writes → no cost, (2) re-pick after slot writes but compatible archetype → no cost, (3) re-pick after slot writes into incompatible archetype → mismatch persists silently.

Matt's instinct: "I don't want to make things too dependent and start complicating the connections between things. If they change their mind how much does it really impact things downstream?" The right answer was: ship local state reset only. No cascade. No event web. No rollback flows. No test matrix explosion across the cross-product of (archetype A) × (archetype B) × (slot completion state).

**Decision:** Local-only state reset on re-pick. The three downstream blocks (Product Brief / User Profile / Success Criteria) stay loosely coupled to Choice Cards. Cost of mismatch: occasional stale slot answers that don't match the new archetype. Mitigation: filed `FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE` (P3) with explicit "DO NOT build the cascade; ship soft warning only if Case 3 bites in real classroom use". Wait for the bug to show up in a real lesson before paying the coupling tax.

**Rule:** When you add a UI affordance that COULD cascade through downstream systems, default to local-only state. Coupling is purchased; once paid, it's permanent. Two consumers can drift independently and the cost is "occasional UX mismatch". Two consumers wired together via event cascade cost: every test now lives in the product of N states across both, every refactor has to maintain the invariant, every new consumer has to learn the cascade rules. The cascade tax compounds; the mismatch tax is occasional and bounded. Wait for the second consumer to actually need synchronisation before building it.

**Sister principle:** This is the same energy as Lesson #34 (FK cascades are forever — design for soft references first, hard FKs only when proven necessary). The instinct to wire things up is strong; the instinct to leave them loosely coupled is the experienced one. Matt's call on Choice Cards is the canonical example of "the discipline of NOT building".

### Lesson #87 — Next.js sibling dynamic-route segments must share a slug name; mismatched siblings break ROUTING ALL ROUTES
**Date:** 13 May 2026
**Phase:** Prod regression after PR #221 + parallel first-move work — see PRs #222 (revert), #223 (hotfix)

**What happened:** Two routes shipped direct-to-main in a parallel session created siblings with different slug names:

```
src/app/api/student/first-move/[unitId]/route.ts          (GET, Phase 1)
src/app/api/student/first-move/[activityId]/commit/route.ts (POST, Phase 2)
```

Next.js does not allow two dynamic segments with different slug names at the same path slot — `[unitId]` next to `[activityId]` means the router can't decide which one matches `/api/student/first-move/abc123`. CI passed (TypeScript + tests don't catch this) and the deploy went out. In prod, the dynamic route table failed to rebuild consistently, dispatch got into a bad state, and **requests across the entire app started hanging for 900s (Vercel function limit)**. Symptom for the user: teacher app SSR-rendered the topnav but content below didn't hydrate and topnav buttons didn't navigate. The blast radius was global, not localised to first-move — `/api/student/open-studio/status` (frequently polled) was the canary that lit Vercel's anomaly detector first.

The dev-server logs were screaming the diagnosis the whole time:

```
⚠ Failed to reload dynamic routes: [Error: You cannot use different slug names
  for the same dynamic path ('activityId' !== 'unitId').]
⨯ unhandledRejection: ...
```

**Fix (PR #223):** Restructured the POST route to put the literal `commit` segment BEFORE the dynamic slug:

```
src/app/api/student/first-move/commit/[activityId]/route.ts
```

`commit/` is a literal path segment, so it doesn't conflict with the sibling `[unitId]` dynamic. Updated the one client call site in `FirstMoveBlock.tsx`.

**Why CI didn't catch it:**
- TypeScript: the route files compile fine individually
- Test suite: no test exercises the Next.js dynamic-route resolver at build/manifest-reload time
- Build: `next build` doesn't fail — the manifest only blows up on the FIRST request that triggers a dynamic-routes reload (dev) or on production request dispatch

**Rule:**
1. **When adding a new dynamic route handler, audit sibling dynamic segments at the same path slot.** Run `find src/app -type d -name '\[*\]'` or grep for sibling brackets. If sibling slug names disagree, restructure NOW.
2. **Reserve a literal segment for distinguishing actions on a dynamic resource.** `/api/student/first-move/[unitId]` (read) vs `/api/student/first-move/commit/[activityId]` (write) is the right shape. Putting the action segment first is canonical Next.js convention for a reason.
3. **Dev-server logs are gold in routing bugs.** The error fired on every page load locally — would have been a 30-second diagnosis if anyone had opened `npm run dev` before merging. Direct-to-main bypassed that gate.
4. **CI green ≠ deploy-safe for routing changes.** Type-check and unit tests can't see this class of bug. Either (a) add a CI step that runs `next build` followed by a startup smoke (boot the server, hit a route, fail if `slug names` appears in logs), or (b) require a Vercel preview-deploy smoke before merging routing changes.

**Sister lesson:** Lesson #70 (push UI smoke gates to feature branch → Vercel preview → smoke → merge). This is the API-routing equivalent: anything that changes the route manifest is a smoke-required change, not a CI-only change.

**Filed:** `FU-CI-NEXT-ROUTING-SMOKE` (P1) — add `next build` + log-scan to CI to catch this class of bug pre-merge.

### Lesson #88 — Revert-first when uncertain is correct even when wrong
**Date:** 13 May 2026
**Phase:** Same prod regression — PR #221 → PR #222 (revert) → PR #223 (real fix)

**What happened:** When Matt reported "nothing rendering below the topnav", I had just shipped PR #221 (CheckInRow Phase 1). The symptom appeared right after the deploy. Two competing hypotheses: (a) my PR caused it, (b) something else in the deploy window did. The deploy window included a parallel direct-to-main "first-move" session shipping Phases 1-8 in 13 minutes.

I had two options:
1. **Diagnose first, then act.** Look at the code, form a theory, test it.
2. **Revert first to clear my changes as a suspect, then diagnose.**

I picked (2). Cost: ~2 minutes to open a revert PR, ~2 minutes for it to land, ~1 minute for Vercel to redeploy. Matt confirmed shortly after that the issue PERSISTED through the revert — which meant my PR wasn't the cause and I could focus the rest of the diagnosis elsewhere. That single signal collapsed the hypothesis space in half.

Had I diagnosed first while the actual bug (slug conflict) was unrelated to my code, I'd have spent 10-15 minutes staring at my own diff hunting for ghosts. The revert turned that into a 5-minute round-trip and produced a clean disproof.

**Rule:** When a prod regression coincides with one of your recent deploys but the diagnosis isn't immediately obvious, **revert your change first as a debugging move, not as an admission**. The cost is low (a 5-minute round-trip), the signal is binary (issue persists / resolved = my code wasn't / was the cause), and the diagnostic value compounds — every subsequent investigation step is now on firmer ground.

**Carve-out:** Don't revert if the change is load-bearing AND irreversibly altered something downstream (e.g. a migration that's already been applied to prod and would require a rollback migration to undo). For pure code revisions like Phase 1 here (no migration, no user-data changes), the revert is essentially free.

**Counterpoint:** The methodology says "checkpoint your work, ship in small commits, stop and report on surprise". This is the field-emergency adaptation of that — when prod is on fire, the audit-before-touch rule inverts into revert-before-debug. The same instinct (don't keep changing things while uncertainty is high) drives both.

**Filed:** Nothing — this is procedural, not a code follow-up. Goes into the saveme/postmortem flow as the canonical example.

### Lesson #89 — `position: fixed` is trapped by any transformed/filtered ancestor; portal to document.body to escape
**Date:** 14 May 2026
**Phase:** Unit Briefs Foundation Phase C smoke

**What happened:** Phase C shipped a student-facing BriefDrawer that mounted inside BoldTopNav. The drawer used `fixed inset-0 z-50 flex justify-end` + a `max-w-[700px]` panel — the canonical Tailwind right-slide-in pattern. On Vercel it rendered as a full-width banner pinned to the top of the viewport, not a right-edge 700px slide-in. The X-close button and "Brief & Constraints" header appeared in the top ~64px of the page; the rest of the panel was visually missing.

Root cause: somewhere in BoldTopNav's ancestor chain (the `.sl-v2` wrapper, the `sticky top-0 z-30` header itself, or one of the framer-motion presence wrappers in the student layout), a CSS property creates a **containing block** for fixed-positioned descendants. The set of properties that does this: `transform` (including `transform-gpu`, `translate-*`, `scale-*`, `rotate-*`), `filter`, `backdrop-filter`, `will-change: transform`, `perspective`, `contain: layout | paint | strict`. Once any ancestor has one of these, `position: fixed` resolves coordinates relative to THAT ancestor's box, not the viewport. So `inset-0` becomes "inset within the sticky 64px header" instead of "inset within the full viewport".

This is a documented but easily-forgotten CSS spec behaviour. Tailwind's tendency to apply `transform` utilities widely (e.g. `transform translate-x-0` for animation primitives) makes it likely to bite. Sticky positioning + scoped style wrappers compound the surface area.

**Fix:** Render the drawer via `createPortal(<jsx>, document.body)`. That mounts the DOM at body level, outside any ancestor containing block. `position: fixed` then resolves to the viewport as expected. Bumped to `z-[100]` so it always wins against any z-30/z-50 chrome. Added an SSR-safety guard (`mounted` flag set in `useEffect`) so `document.body` is only referenced post-hydration.

The smoke fix also moved the chip out of BoldTopNav into LessonSidebar (the chip's correct visual home), which would have changed the ancestor chain anyway — but the portal fix is the durable lesson: anywhere a modal/drawer/popover lives, if it could ever be mounted inside a transformed/sticky/filtered subtree, **portal it.** Don't trust that `position: fixed` will see the viewport.

**Rule:** Modals, drawers, popovers, tooltips, and any other UI that relies on `position: fixed` to escape its DOM context MUST be rendered via `createPortal(..., document.body)`. Even if today's parent chain is clean, future refactors that add a single `transform` or `filter` utility upstream will silently regress the behaviour with no error — just a visually broken modal. The cost of the portal is negligible (one useState + one useEffect + one createPortal call); the cost of NOT portaling is "everything looks fine in dev, breaks in prod when the parent gets a transform".

**Pattern to copy** (BriefDrawer.tsx):
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
if (!open || !mounted) return null;
return createPortal(
  <div className="fixed inset-0 z-[100] ...">{/* ... */}</div>,
  document.body,
);
```

**Sister lessons:** Lesson #1 (don't batch-modify JSX with regex — Framer Motion disaster) and Lesson #45 (surgical changes) are about how unrelated changes can have a wider blast radius than expected. This is the CSS-spec version: an ancestor's `transform` is not visually local — it changes the coordinate system for every fixed descendant. Hard to predict without knowing the containing-block rule by heart.

### Lesson #90 — Auth fallbacks must verify membership in the SPECIFIC target, not shared ownership
**Date:** 15 May 2026
**Phase:** Auth security — student-classcode-login Level 3 removal ([studioloom#308](https://github.com/mattburto-spec/studioloom/pull/308))

**What happened:** Matt reported students could log into a class they weren't enrolled in by entering its classcode + their own initials. Reproduction: G8 student "ER" entered the G9 classcode `SW3NLD` and the login succeeded; the dashboard then derived their actual class from `class_students` and showed "G8 Design" — proving the session was internally inconsistent (auth said G9, junction said G8).

Root cause: the `/api/auth/student-classcode-login` route had a 3-level student lookup chain. Levels 1 + 2 correctly required enrollment in the target class (via `class_students` junction or legacy `students.class_id`). Level 3 was a fallback for "orphan students" (UI-created but never enrolled) that matched only on `(username, author_teacher_id)` — i.e. *"do I share a teacher with this class?"* — and on success **rewrote `students.class_id` to the spoofed class**, corrupting the legacy column for any of the ~50 downstream readers.

A code comment on Level 3 explicitly argued the filter was safe: *"this is a scope filter, not an actor permission gate."* The reasoning held only if a teacher had exactly one class. The moment a teacher has 2+ classes (the only interesting case), `author_teacher_id` is no longer scope — it's a wide-open door for cross-class movement within that teacher's tenant.

Audit on prod found 6 students with corrupted `students.class_id` from past Level 3 firings (one as recent as the day before Matt reported it). All required repair via a targeted UPDATE to re-sync the legacy column to the canonical `class_students` enrollment.

**Why the bug survived to prod:**
- The only existing 401 test for "student not in class" set `orphanStudent = null` — it tested the *absence* of any matching student, not the harder case of *an orphan that exists but isn't enrolled here*.
- The misleading comment ("scope filter, not actor permission") read as a thought-through justification, not a yellow flag.
- The relink at line 315-318 had the comment "Re-link for future logins (mirror legacy)" — phrased as a benign migration aid, not "we silently corrupt the canonical column on every Level 3 hit."

**Rules:**
- **Any auth fallback that scopes by "shared ownership" (same teacher / same school / same org) is a cross-tenant bypass within that tenant.** Tenants have internal boundaries (classes within a school, students within a teacher, projects within an org). An auth path that grants access based on the outer tenant alone collapses all internal boundaries. The verification must always be against the **specific target** the user is trying to access — `class_students` for class-level, `school_responsibilities` for school-level, etc.
- **"Lazy auto-link on first auth" is a security anti-pattern.** Pre-junction-table eras inherited this shape ("if we recognise the user, attach them to whatever target they showed up at"). Post-junction-table, the auto-link bypasses the only authoritative source of truth for membership. Either delete the fallback or require explicit invite tokens that prove pre-arranged membership.
- **Auth-route tests must exercise the harder negative case — "matching record exists, but not enrolled HERE" — not just "matching record absent."** The mock in this route returned the same data regardless of which `.eq()` chain was used, so the orphan-exists-but-shouldn't-match scenario was inexpressible. Fix: route mocks by the first `.eq()` column so each lookup shape gets its own test slot. Then add an explicit regression test that wires a match-shaped record and asserts it does NOT authenticate.
- **Comments arguing why a permissive predicate is safe should be a yellow flag during review, not a green light.** The Level 3 comment was thoughtful, well-written, and wrong. When a comment justifies bypassing an obvious check ("this isn't really a permission gate"), audit the assumption against multi-tenant edge cases (multi-class teacher, multi-teacher class, multi-school district).

**Operational corollary:** When fixing this class of bug, the code fix is necessary but not sufficient — past firings have already corrupted data. Always pair the code fix with (a) a SQL audit query to find existing victims, (b) a repair query to fix the corruption, (c) a verify query that returns 0 rows after repair. Otherwise the legacy-column readers continue serving wrong data even after the bypass is closed.

**Sister lessons:** Lesson #22 ("Always use junction-first + legacy-fallback for student lookups in teacher APIs") establishes the read pattern; this lesson establishes the write/auth pattern. Lesson #64 (SECURITY DEFINER for cross-table RLS chains) is the RLS-layer version of the same instinct: don't trust shape-correct queries to enforce permission boundaries; the boundary check must be at the specific target every time.

**Filed:** No code follow-up — bug closed, prod repaired, regression test in place. The 50+ remaining readers of `students.class_id` continue to work (they have `class_students` as primary), but the long-term hygiene step (deprecate `students.class_id` entirely once Access Model v2 cutover stabilises) is already tracked elsewhere.

**Filed:** Nothing — pattern is enshrined in BriefDrawer.tsx and the codifying assertion in `chip-drawer-structure.test.ts`. Reuse the pattern for any future drawer / modal / popover.
