# Sub-Phase A.2 Brief — Migrate SDK direct-callers to callAnthropicMessages

**Filed:** 2026-05-08
**Branch:** `ai-provider-phase-a` (continues from A.1)
**Worktree:** `/Users/matt/CWORK/questerra-ai-abstraction`
**Predecessor:** [A.1 brief](ai-provider-abstraction-phase-a-brief.md) — helper landed at [`src/lib/ai/call.ts`](../src/lib/ai/call.ts) on commit `6636a7a`.

## Goal

Route every production `@anthropic-ai/sdk` direct-caller through `callAnthropicMessages` / `streamAnthropicMessages`. After A.2: no production code outside the helper imports the SDK directly. This makes provider routing (Phase B) a one-config-line change.

## Scope (18 files, ~22 SDK call sites)

**Routes (8) — UI-observable, need browser smoke:**

| # | File | Auth | Today | Notes |
|---|---|---|---|---|
| 1 | [`src/app/api/student/word-lookup/route.ts`](../../src/app/api/student/word-lookup/route.ts) | student | already wraps in `withAIBudget` + Lesson #39 guard | gold-standard pattern; migration is a clean swap |
| 2 | [`src/app/api/student/quest/mentor/route.ts`](../../src/app/api/student/quest/mentor/route.ts) | student | uses `withAIBudget` | quest mentor chat |
| 3 | [`src/app/api/teacher/lesson-editor/ai-field/route.ts`](../../src/app/api/teacher/lesson-editor/ai-field/route.ts) | teacher | direct SDK | small Haiku call (max_tokens 500) |
| 4 | [`src/app/api/teacher/lesson-editor/suggest/route.ts`](../../src/app/api/teacher/lesson-editor/suggest/route.ts) | teacher | direct SDK | suggestions (max_tokens 800) |
| 5 | [`src/app/api/teacher/wizard-autoconfig/route.ts`](../../src/app/api/teacher/wizard-autoconfig/route.ts) | teacher | uses `resolveCredentials` (BYOK) | preserve teacherId param |
| 6 | [`src/app/api/teacher/wizard-suggest/route.ts`](../../src/app/api/teacher/wizard-suggest/route.ts) | teacher | uses `resolveCredentials`; max_tokens:1 probes | preserve BYOK + probe pattern |
| 7 | [`src/app/api/admin/ai-model/test/route.ts`](../../src/app/api/admin/ai-model/test/route.ts) | admin | direct SDK | sandbox tester |
| 8 | [`src/app/api/admin/ai-model/test-lesson/route.ts`](../../src/app/api/admin/ai-model/test-lesson/route.ts) | admin | direct SDK | sandbox tester |

**Lib services (7) — covered by unit tests:**

| # | File | Notes |
|---|---|---|
| 9 | [`src/lib/ai/quality-evaluator.ts`](../../src/lib/ai/quality-evaluator.ts) | called from `/api/teacher/generate-timeline` |
| 10 | [`src/lib/content-safety/server-moderation.ts`](../../src/lib/content-safety/server-moderation.ts) | tool_use moderation; has fixture-based tests |
| 11 | [`src/lib/grading/ai-prescore.ts`](../../src/lib/grading/ai-prescore.ts) | grading helper |
| 12 | [`src/lib/ingestion/moderate.ts`](../../src/lib/ingestion/moderate.ts) | ingestion topic moderation |
| 13 | [`src/lib/skills/ai-helpers.ts`](../../src/lib/skills/ai-helpers.ts) | 4 SDK calls (Distractors / disposition / join / of) — single largest fan-out file |

**Pipeline (3) — covered by unit tests + Lesson #39 fix sites:**

| # | File | Notes |
|---|---|---|
| 14 | [`src/lib/ingestion/pass-a.ts`](../../src/lib/ingestion/pass-a.ts) | Lesson #39 origin site; defensive destructure already present |
| 15 | [`src/lib/ingestion/pass-b.ts`](../../src/lib/ingestion/pass-b.ts) | Lesson #39 origin site (same pattern) |
| 16 | [`src/lib/pipeline/stages/stage2-assembly.ts`](../../src/lib/pipeline/stages/stage2-assembly.ts) | generation pipeline |
| 17 | [`src/lib/pipeline/stages/stage3-generation.ts`](../../src/lib/pipeline/stages/stage3-generation.ts) | generation pipeline |
| 18 | [`src/lib/pipeline/stages/stage4-polish.ts`](../../src/lib/pipeline/stages/stage4-polish.ts) | generation pipeline; includes streaming |

## Out of scope for A.2

- **`src/lib/ai/anthropic.ts`** — IS the `AnthropicProvider` (the AIProvider interface implementation for the unit-generation pipeline). Stays as-is. Phase B may route its internals through `callAnthropicMessages` later, but A.2 doesn't touch it.
- **`src/lib/ai/schemas.ts`** — type re-exports only (`Anthropic.Tool`, etc.). No SDK call. Type imports stay.
- **HTTP-based Anthropic callers** — ~13 sites that use raw `fetch()` to `api.anthropic.com` instead of the SDK. **A.3 brief** will migrate them.
- **Voyage embedding callers** — out of provider abstraction; have their own wrapper (`src/lib/ai/embeddings.ts`).

## Migration template (the standard shape)

Per file, the change is mechanical. Three flavours.

### Flavour 1 — Non-streaming, no studentId (teacher / admin / lib)

```ts
// BEFORE
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey, maxRetries: 2 });
const response = await client.messages.create({ model, max_tokens, ...params });
if (response.stop_reason === "max_tokens") { /* manual guard */ }
const block = response.content.find(b => b.type === "tool_use");
// ... handle response

// AFTER
import { callAnthropicMessages } from "@/lib/ai/call";
const result = await callAnthropicMessages({
  endpoint: "/api/route/path",
  supabase,           // service-role client
  teacherId,          // when applicable (BYOK + attribution)
  model,
  maxTokens: ...,
  messages: [...],
  system: ...,
  tools: [...],
  toolChoice: { type: "tool", name: ... },
});
if (!result.ok) {
  if (result.reason === "no_credentials") return 500-ish;
  if (result.reason === "truncated") return 502 with helpful message;
  if (result.reason === "api_error") throw or return 502;
  // over_cap is impossible without studentId
}
const response = result.response;
const block = response.content.find(b => b.type === "tool_use");
// ... handle response (same as before)
```

### Flavour 2 — Non-streaming, student (preserves withAIBudget)

```ts
// BEFORE — wraps client.messages.create in withAIBudget manually
const budgetResult = await withAIBudget(supabase, studentId, async () => {
  const response = await client.messages.create(...);
  return { result: response, usage: { ...response.usage, stop_reason: response.stop_reason } };
});

// AFTER — helper does the wrapping
const result = await callAnthropicMessages({
  endpoint: "/api/student/...",
  supabase,
  studentId,         // ← triggers withAIBudget passthrough
  model, maxTokens, messages, system, tools, toolChoice,
});
// result.reason can be "over_cap" (return 429) or "truncated" (return 502)
```

### Flavour 3 — Streaming (stage4-polish, possibly others)

```ts
import { streamAnthropicMessages } from "@/lib/ai/call";
for await (const event of streamAnthropicMessages({...})) {
  if (event.type === "partial_json") { /* yield to consumer */ }
  if (event.type === "complete") { /* final response */ }
  if (event.type === "error") {
    if (event.reason === "truncated") { /* surface */ }
    if (event.reason === "api_error") { throw event.error; }
  }
}
```

## Per-file rules

- **`endpoint` attribution**: use the route path for routes (e.g. `"/api/student/word-lookup"`); for lib services, use the lib path or the route name that calls them (e.g. `"lib/ingestion/pass-a"` or `"/api/teacher/library/import"` if the call is route-attributable). Goal: `ai_usage_log.endpoint` is grep-able.
- **Drop manual `stop_reason === "max_tokens"` guards** after migration — the helper does it. Lesson #39 stays satisfied.
- **Drop manual `logUsage` calls** after migration — the helper does it. Avoids double-logging.
- **Preserve defensive destructure on `tool_use.input`** — Lesson #39 says fields can be missing even when schema-required. The helper handles stop_reason but doesn't touch the response shape.
- **Preserve cache lookups, sandbox bypasses, and BYOK chains** — the helper sits at the SDK call, NOT around the whole route.
- **Keep tool definitions inline** — the helper takes them as `tools` + `toolChoice` params.
- **DO NOT touch unrelated logic** in any file (Lesson #45). If a route has a bug or a stale comment, file it as FU, don't fix inline.

## Test impact (expected)

- Existing tests for these files mock `@anthropic-ai/sdk` directly. **They should keep passing without changes** — the helper's mock is set up the same way (class-based MockAnthropic). Sanity: each migrated file's tests pass on first run.
- Some tests assert on logUsage being called — those assertions still hold (helper calls logUsage with the same shape).
- Some tests assert on truncation behaviour — those still hold (helper returns same `truncated` shape from the route's perspective).
- **Expected new tests:** ~5-15 covering route-level integration of the helper (one per route flavour, NOT per route). A.2 does NOT need to write a test per file — A.1 already covered the helper.
- **Expected count delta:** baseline 4845 → 4855-4870 (small). If ANY file's existing tests break post-migration, STOP — that's a signal the migration changed observable behaviour, which it shouldn't.

## Smoke plan (after A.2 merges all 18 file migrations)

Matt smokes 5-6 representative routes on Vercel preview before A.2 closes. Not all 8 routes — diminishing returns, the migrations are isomorphic.

1. **Student tap-a-word** — type a word in a lesson activity, confirm definition + L1 translation render. Confirms word-lookup migration + budget integration intact.
2. **Quest mentor** — open a quest journey, send a message, confirm AI replies. Confirms student streaming/non-streaming migration.
3. **Lesson editor AI field** — generate an AI-suggestion for a field. Confirms teacher route migration.
4. **Wizard autoconfig** — start the unit wizard, confirm the autoconfig step suggests sensible values. Confirms BYOK chain still resolves.
5. **Generate a unit** — full unit generation through the wizard. Confirms quality-evaluator + pipeline stages still work end-to-end.
6. **Ingestion sandbox** — upload a sample DOCX, run pass A + pass B. Confirms ingestion pipeline migration. Done in admin sandbox UI, no real teacher impact.

## Commit plan

Single PR (matches Matt's "single bundled PR for refactor work" preference). 6-8 commits, no squashing:

1. `refactor(ingestion): route pass-a + pass-b through callAnthropicMessages` — Lesson #39 origin sites; small, low-risk because they have unit tests.
2. `refactor(pipeline): route stage2/3/4 through callAnthropicMessages + stream variant` — generation pipeline; covered by unit tests.
3. `refactor(lib): route quality-evaluator + ai-prescore + server-moderation + skills/ai-helpers` — 4 lib services in one commit, all the same shape.
4. `refactor(api): route admin/ai-model/test* + lesson-editor/* through helper` — 4 admin/teacher routes.
5. `refactor(api): route wizard-autoconfig + wizard-suggest through helper` — preserves BYOK via teacherId param.
6. `refactor(api): route student/word-lookup + quest/mentor through helper` — student routes; preserves withAIBudget via studentId param.
7. `chore(wiring): flip ai-provider entry to status:complete + currentVersion:1` — final WIRING update; A.2's deliverable.

(If a commit grows too big, split. Lesson #45 — surgical changes — applies per commit.)

## Lessons re-read for A.2

- **#39** (lessons-learned.md:153) — the migration's job is to make every site's stop_reason guard automatic. Drop the manual checks AFTER swapping in the helper, not before.
- **#42** (lessons-learned.md:220) — dual-shape persistence. The helper returns the same `Anthropic.Message` shape, but if any caller was reading `usage.input_tokens` from a custom shape (it shouldn't be), this surfaces it.
- **#43** (lessons-learned.md:241) — surface assumptions. Each file's pre-flight: dump the call site's exact shape (max_tokens, tools, system) into the brief before editing. Don't migrate from memory.
- **#44** (lessons-learned.md:256) — minimum surface. Don't add error-case sophistication that wasn't already there. If a route returned 500 on truncation before, return 500 now (or upgrade to 502 with a helpful message — call it out separately).
- **#45** (lessons-learned.md:273) — surgical changes. Per commit, only touch the SDK call. Don't refactor adjacent route logic, don't rename variables, don't tidy comments.
- **#56** (lessons-learned.md:534) — sandbox/test gating. Several routes have `NODE_ENV === "test" && RUN_E2E !== "1"` sandbox bypasses (word-lookup is the canonical example). The helper migration must be BELOW these gates — sandbox bypass stays in route code, not in the helper.

## Registry cross-check

| Registry | Action in A.2 |
|---|---|
| `WIRING.yaml` `ai-provider` | Flip status: partial → complete, currentVersion: 0.5 → 1 in the final commit (after all 18 migrations land). |
| `ai-call-sites.yaml` | Re-run `python3 scripts/registry/scan-ai-calls.py --apply` after migration. **Expected:** every Anthropic site flips to `stop_reason_handled: true` (because the helper handles it). 49+ sites unblock. |
| `api-registry.yaml` | Re-run `python3 scripts/registry/scan-api-routes.py --apply`. Expected: 8 routes gain `tables_written: [ai_usage_log]` (where missing). |
| `feature-flags.yaml` | No changes. |
| `vendors.yaml` | No changes. |

Run all 3 scanners in commit 7 (registry hygiene). Diff each yaml; if non-empty, commit.

## Open questions for sign-off

1. **Single PR vs sub-phase splits** — A.2 as 1 PR with 7 commits, or split into 3 PRs (lib/pipeline → routes-non-student → routes-student)? **Recommend single PR** per Matt's prior "bundled PR for refactor work" feedback. Easier to review as "did all 18 sites get the same treatment?"
2. **Behaviour-change risk: routes that currently bypass `logUsage`** — once migrated, they start writing to `ai_usage_log`. Token visibility goes up; any students who were "free" suddenly count against caps. Confirm this is desired (Matt's framing said yes, but flagging again because it's the most observable change).
3. **`stage4-polish.ts` streaming** — needs `streamAnthropicMessages`. Confirm scope. (Other stages may be non-streaming — pre-flight will confirm.)
4. **wizard-suggest's `max_tokens: 1` probes** — these look like feature-detection pings (do you have access to model X?). The helper handles them fine, but worth flagging in case the migration triggers any latent stop_reason oddity.
5. **A.3 timing** — defer or back-to-back? The 13 HTTP-based callers in A.3 are a separate problem (they use raw fetch, not the SDK). A.3 has its own brief. Recommend back-to-back (close out the chokepoint goal).

## A.2 success criteria

- [ ] All 18 files routed through the helper.
- [ ] Zero `import Anthropic from "@anthropic-ai/sdk"` in production code outside `src/lib/ai/call.ts` and `src/lib/ai/anthropic.ts` (verify via grep).
- [ ] No manual `stop_reason === "max_tokens"` checks remain in migrated files (verify via grep).
- [ ] No manual `logUsage` calls in migrated files where the helper now does it (verify via grep).
- [ ] Existing tests pass without modification (each file's `__tests__` directory).
- [ ] Test count: 4845 → ~4850-4870 (small delta — no per-site test rewrites).
- [ ] tsc: 0 new errors (264 pre-existing baseline unchanged).
- [ ] Smoke: 5-6 representative routes verified on Vercel preview by Matt.
- [ ] WIRING `ai-provider` flips to `status: complete + currentVersion: 1`.
- [ ] `ai-call-sites.yaml` regenerated; every Anthropic site shows `stop_reason_handled: true`.
- [ ] PR opened (only after all migrations land + smoke passes).

## What I will NOT do in A.2 (Lesson #45)

- Touch `src/lib/ai/anthropic.ts` (AnthropicProvider) — separate concern.
- Touch `src/lib/ai/schemas.ts` (type re-exports).
- Touch any HTTP-based Anthropic caller — that's A.3.
- Add new features to the helper. If a migration reveals a missing helper feature, STOP and amend `call.ts` in a separate commit.
- Refactor route logic outside the SDK call.
- Add cost tracking, rate limiting, or retry logic. The helper's surface is the helper's surface.
- Migrate Voyage embedding callers (different abstraction, not in A.2 scope).
