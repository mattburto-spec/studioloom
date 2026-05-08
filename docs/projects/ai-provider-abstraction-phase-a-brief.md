# AI Provider Abstraction — Phase A Brief

**Filed:** 2026-05-08
**Goal:** Centralise the Anthropic SDK chokepoint so the admin panel can swap providers (DeepSeek / Qwen / Moonshot / Zhipu) per feature without touching 30 call sites.
**Out of scope (deferred to Phase B/C):** Actually swapping providers, prompt re-tuning, admin panel UI for selection.

---

## Why now

- 5 students + light admin AI use today. Token attribution is partial — only `word-lookup` runs through `withAIBudget` middleware. The other 16 SDK direct-callers + ~13 HTTP-based callers bill nothing.
- Provider switching today = touching 30 files. Every new feature added before Phase A makes the eventual switch more expensive.
- WIRING entry `ai-provider` is paper-only (Lesson #54): claims a fallback chain that doesn't exist, points at `key_files` that don't exist. Reconciling the entry is part of the work.

## Phase split

| Sub-phase | Scope | Tests delta | Sign-off gate |
|---|---|---|---|
| **A.1** | Build `src/lib/ai/call.ts` helper. Wraps Anthropic SDK, centralises Lesson #39 stop_reason guard + `logUsage` + `withAIBudget` passthrough. Both `messages.create` and `messages.stream`. Unit tests with mocked SDK. Fix WIRING `ai-provider` entry. | +20-30 | npm test green, tsc clean, no Vercel preview (no UI) |
| **A.2** | Migrate the 17 SDK direct-callers (8 routes + 8 lib services + 3 pipeline stages where appropriate; pipeline stages may stay on `AnthropicProvider`). Per-route smoke after each migration. | +10-20 | Vercel preview, Matt smoke 3-5 representative paths |
| **A.3** | Migrate the ~13 HTTP-based callers (raw fetch to `api.anthropic.com`) to use the SDK via `callAnthropicMessages`. Re-run `scan-ai-calls.py` — `stop_reason_handled` should flip to `true` everywhere. **Matt named Checkpoint A.1** here. | +5-10 | Matt smoke pass + sign-off |

A.1 is the only sub-phase covered by this brief. A.2 and A.3 each get their own brief drafted after the prior sub-phase ships.

## Architectural decision

**Helper, not interface.** The existing `AIProvider` interface (`src/lib/ai/types.ts`) is generation-specific (`generateCriterionPages`, `generateLessonPages`, etc.) and cannot cleanly absorb chat-style routes, vision, dynamic-schema tool use, or simple text generation. Forcing all 30 callers through `AIProvider` either bloats the interface beyond recognition (Lesson #44) or wraps every call in a thin shim that only ever calls `generateText()`.

Instead: build a thin `callAnthropicMessages()` helper at `src/lib/ai/call.ts`. Mirrors the SDK shape sites already use; centralises the cross-cutting concerns (stop_reason / logUsage / budget). Generation pipeline keeps `AIProvider` — it works, and Lesson #45 says don't refactor what isn't broken.

## Helper API (target shape)

```ts
// src/lib/ai/call.ts

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CallOptions {
  model: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  system?: string;
  temperature?: number;
  tools?: Anthropic.Tool[];
  toolChoice?: Anthropic.ToolChoiceTool | Anthropic.ToolChoiceAuto;

  // Instrumentation (required for visibility)
  endpoint: string;       // attribution for ai_usage_log.endpoint
  supabase: SupabaseClient;

  // Optional billing — when studentId is set, runs through withAIBudget
  studentId?: string;
  teacherId?: string;     // attributed in ai_usage_log when no studentId
}

export type CallResult =
  | { ok: true; response: Anthropic.Message; usage: { input_tokens: number; output_tokens: number; stop_reason: string } }
  | { ok: false; reason: "truncated"; cap?: number; used?: number; resetAt?: string }
  | { ok: false; reason: "over_cap"; cap: number; used: number; resetAt: string }
  | { ok: false; reason: "no_credentials" }
  | { ok: false; reason: "api_error"; error: unknown };

export async function callAnthropicMessages(opts: CallOptions): Promise<CallResult>;

// Streaming variant — async generator, same options shape minus toolChoice constraints
export async function* streamAnthropicMessages(opts: CallOptions): AsyncGenerator<
  | { type: "partial_json"; json: string }
  | { type: "complete"; response: Anthropic.Message; usage: ... }
  | { type: "error"; reason: "truncated" | "api_error"; error?: unknown }
>;
```

**Decisions baked in:**
- `endpoint` is required → forces every site to declare its attribution. Catches the current "stop_reason_handled: unknown" gap from `ai-call-sites.yaml`.
- `supabase` is required → no orphaned calls without `logUsage`. Phase A's deliverable is observability.
- `studentId` is optional → teacher-only routes don't go through `withAIBudget` (which is student-attributed only). They still get `logUsage`.
- Result type matches `withAIBudget`'s discriminated union → existing budget consumers can be migrated without changing call-site UX.
- `truncated` is a Result, not a throw → matches existing word-lookup pattern; lets each call site decide UX (502, retry, fallback).
- `api_error` returns `{ ok: false, reason: 'api_error', error }` → rethrowing is the call site's choice. Sandbox/test mocking simpler.

## Cross-cutting concerns the helper handles

1. **Stop_reason guard (Lesson #39).** After every `messages.create`, inspect `response.stop_reason`. If `"max_tokens"`, return `{ ok: false, reason: "truncated" }`. Don't bill (matches `withAIBudget` step 5).
2. **`logUsage` on success.** After a successful call (and after billing if applicable), call `logUsage` with `{ student_id, teacher_id, endpoint, model, input_tokens, output_tokens, estimated_cost_usd }`. Fire-and-forget — don't block the response.
3. **`withAIBudget` passthrough when `studentId` provided.** Wraps the SDK call in the existing middleware. The middleware already handles `over_cap` + truncation billing rules.
4. **Credential resolution.** First attempt: `resolveCredentials(supabase, teacherId)` for BYOK. Fallback: `process.env.ANTHROPIC_API_KEY`. Provider-routing config (Phase B) plugs in here.

## What the helper does NOT do (Lesson #44 — minimum surface)

- Doesn't wrap Voyage embeddings (separate `embeddings.ts` already does that).
- Doesn't add retries beyond what the SDK provides (`maxRetries: 2`).
- Doesn't cache responses (call sites have their own caches — `word_definitions`, etc.).
- Doesn't pretend to abstract over OpenAI-compatible providers. That's Phase B.
- Doesn't add a "feature → provider" routing config. That's Phase B.
- Doesn't refactor `withAIBudget`, `resolveCredentials`, or `AIProvider`. They work.

## Lessons re-read for this brief

- **#39** (lessons-learned.md:153) — silent `max_tokens` truncation in tool_use calls. The helper's *primary* job is to be the place this guard lives.
- **#43** (lessons-learned.md:241) — surface assumptions before coding. This brief IS the assumptions block.
- **#44** (lessons-learned.md:256) — minimum surface. Helper is intentionally thin; doesn't fake provider-swap support that Phase B will actually deliver.
- **#45** (lessons-learned.md:273) — surgical changes. A.1 builds the helper + fixes WIRING. Doesn't touch any of the 30 call sites — that's A.2/A.3.
- **#46** (lessons-learned.md:294) — verify with expected values. Tests assert specific stop_reason handling, specific logUsage shape, specific result discriminants — not just non-null.
- **#54** (lessons-learned.md:481) — WIRING drift. `ai-provider` entry is paper. A.1 fixes it.
- **#56** (lessons-learned.md:534) — sandbox / test gating. Helper must NOT silently route to a sandbox in dev. Either fail loudly when API key is missing, or let callers handle it via the `no_credentials` result.

## Registry cross-check findings

| Registry | Spot-check | Severity | Action in A.1 |
|---|---|---|---|
| `WIRING.yaml` `ai-provider` | `key_files` reference `providers.ts` + `provider-factory.ts` — neither exists | **HIGH** | Rewrite entry: correct `key_files`, downgrade `currentVersion: 1 → 0.5`, change status `complete → partial`, summary updated to reflect 1-of-30 coverage post-A.1 (will flip to `complete + 1` after A.3) |
| `ai-call-sites.yaml` | 49 of 54 sites flagged `stop_reason_handled: unknown` or `false` | Medium | Re-run scanner in A.3 after migration; A.1 doesn't change the data |
| `api-registry.yaml` | 8 routes will gain `tables_written: [ai_usage_log]` post-A.2 | Low | A.2 closes |
| `feature-flags.yaml` | No new flags for A.1. Phase B will add a `ai_provider_override` flag | n/a | Out of scope |
| `vendors.yaml` | Anthropic already listed. No DPA changes | n/a | No action |

A.1 deliverable: WIRING entry corrected. Other registries flow through A.2/A.3.

## Open follow-ups closed by this work

- **FU-Y** (Groq + Gemini fallbacks never shipped) — A.1 doesn't close it; A.1 makes the eventual close cheap. Phase B closes it for real.
- **FU-5** (`max_tokens` audit: 9 sites remaining) — A.2 closes. Once every site goes through the helper, every site has the guard.
- **WIRING ai-provider drift** — A.1 closes (registry-sync sub-phase).

## Phase A success criteria (cumulative across A.1 → A.3)

- [ ] Every `client.messages.create(...)` and `client.messages.stream(...)` in production code goes through `callAnthropicMessages` / `streamAnthropicMessages`.
- [ ] Every Anthropic call has `stop_reason` inspected centrally.
- [ ] Every Anthropic call writes to `ai_usage_log` with correct `endpoint` attribution.
- [ ] `ai-call-sites.yaml` shows `stop_reason_handled: true` for every Anthropic site.
- [ ] WIRING `ai-provider` entry matches reality.
- [ ] No regression in any AI feature (mentor, generation pipeline, grading, ingestion, wizard, lesson editor, word-lookup, vision).
- [ ] Phase B can swap a provider for any feature by changing one config value, not 30.

## Sub-Phase A.1 success criteria

- [ ] `src/lib/ai/call.ts` exists with `callAnthropicMessages` + `streamAnthropicMessages`.
- [ ] Helper unit tests exist at `src/lib/ai/__tests__/call.test.ts` with full coverage of the result discriminants (truncated / over_cap / no_credentials / api_error / ok).
- [ ] Streaming tests cover partial_json + complete + error events.
- [ ] WIRING `ai-provider` entry corrected.
- [ ] Test count: baseline 3735 → 3755+ (target +20-30 new tests).
- [ ] `npx tsc --noEmit` clean.
- [ ] No call sites migrated yet — A.1 is helper + tests + WIRING fix only.
