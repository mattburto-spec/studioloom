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
