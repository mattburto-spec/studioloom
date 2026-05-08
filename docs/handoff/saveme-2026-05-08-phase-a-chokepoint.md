# Handoff — saveme-2026-05-08-phase-a-chokepoint

**Last session ended:** 2026-05-08 (evening UTC)
**Worktree:** `/Users/matt/CWORK/questerra-saveme`
**HEAD:** branched from `9eaff02` (post `saveme — kanban + dashboard + admin + analytics` merge)
**Session focus:** AI Provider Abstraction Phase A — chokepoint helper landed, all 30+ direct-callers migrated, WIRING flipped to `complete + 1`.

## What just happened (this saveme)

- **AI Provider Abstraction Phase A SHIPPED end-to-end** — A.1 helper + 12 unit tests in `src/lib/ai/call.ts`; A.2 18 SDK direct-callers migrated; A.3 13 HTTP-based fetch sites migrated (toolkit `shared-api` fan-out covers 25+ tool routes via one file change).
- **3 PRs merged today:** [#122](https://github.com/mattburto-spec/studioloom/pull/122) (A.1 + A.2 combined), [#129](https://github.com/mattburto-spec/studioloom/pull/129) (A.3 + Phase A close), [#132](https://github.com/mattburto-spec/studioloom/pull/132) (CLAUDE.md chokepoint discipline — was in-flight at saveme time, set to auto-merge).
- **Smoke validated in prod by Matt:** tap-a-word, wizard autoconfig, full unit generation, lesson-editor AI suggestions all working. AI Budget dashboard at 34,740 tokens across 5 NIS students with healthy attribution.
- **Saveme registry sync confirmed clean:** api-registry, ai-call-sites, feature-flags, vendors, RLS coverage all up-to-date (most already synced via the merged PRs).
- **3 new lessons banked** (#76, #77, #78) — TS narrowing on dead code; scanner threshold expiry; double-logging when migrating into a layer with its own attribution.
- **3 new briefs filed** at `docs/projects/ai-provider-abstraction-phase-a{,-a2,-a3}-brief.md`. Added to `doc-manifest.yaml` (281 → 284 docs).
- **Handoff:** Phase B (per-feature provider swap to DeepSeek/Qwen/etc.) is gated entirely on Matt's call. When he wants it, it's a one-config-line change inside `src/lib/ai/call.ts`. No code-side urgency.

## State of working tree

- **Branch:** `saveme-2026-05-08-phase-a-chokepoint` (tracks `origin/main`).
- **Status:** modified `docs/projects/ALL-PROJECTS.md`, `docs/decisions-log.md`, `docs/lessons-learned.md`, `docs/doc-manifest.yaml`, `docs/changelog.md`. Created this handoff file.
- **Test count:** 4887 passed / 11 skipped (verified post-merge of #129).
- **tsc baseline:** 265 pre-existing errors (all in unrelated test files; none introduced by Phase A).
- **Pending push:** all saveme commits about to land in a single `chore(saveme)` PR.
- **PR #132 (docs CLAUDE.md):** auto-merge armed; will land when Vercel finishes pending check.

## Next steps — ordered

- [ ] **Cost & Usage admin rebuild** (task spawned, on dashboard) — replaces the broken `/admin/cost-usage` (HTTP 500, reads from empty `cost_rollups` table). New view: unified spend-by-endpoint pulling from `ai_usage_log`, time-window selector (today/7d/30d), KPI cards, by-attribution breakdown (student/teacher/anonymous/lib). Best moment to start: when Matt wants to see teacher + tool spend in one place. The data is already flowing — just needs a UI.
- [ ] **Phase B — per-feature provider swap** when/if Matt decides costs warrant it. DeepSeek-V3 the obvious first target for high-volume cheap calls (word-lookup, autosuggest). One config inside `src/lib/ai/call.ts` + minimal smoke. Holds until Matt names the feature.
- [ ] **FU-AI-SCAN-CHOKEPOINT (P3)** — teach `scan-ai-calls.py` to recognise `callAnthropicMessages` as a single chokepoint, not N dynamic sites. Threshold bumped 30→60% as workaround. Real fix is ~30 min when someone next touches the scanner.
- [ ] **FU-CONVERT-LESSON-CACHE (P3)** — convert-lesson dropped its prompt-caching beta header during A.3 migration. Reinstate via the helper if/when convert-lesson is unquarantined and rebuilt.
- [ ] **WIRING.yaml line 1035 parse error (P3)** — pre-existing Lever 1 entry has a Lesson #33 unquoted-colons issue. Hasn't blocked anything yet but the saveme YAML scanner trips on it.
- [ ] **`quality-evaluator.ts` model-id fix (P3)** — hardcodes `"claude-haiku-4-5"` without the date suffix. Should be `MODELS.HAIKU`. Trivial fix.

## Open questions / blockers

_None._ Phase A is closed. Everything listed above is "nice-to-have when convenient" — nothing gates anything else.

## What future sessions touching AI code MUST know

The discipline now lives in `questerra/CLAUDE.md` → "AI calls — single chokepoint" section (added in PR #132). The headline:

> **Every Anthropic Messages API call in production routes through `src/lib/ai/call.ts` — `callAnthropicMessages()` and `streamAnthropicMessages()`.** Do not write `new Anthropic({...})` or raw `fetch("https://api.anthropic.com/...")` in new code. Only `src/lib/ai/call.ts` (helper) and `src/lib/ai/anthropic.ts` (AnthropicProvider for unit-generation pipeline) legitimately do either.

If you're adding a new AI feature, read the section. If you're migrating an existing call site that somehow snuck through, the migration template is in [phase-a2-brief.md](../projects/ai-provider-abstraction-phase-a2-brief.md) and [phase-a3-brief.md](../projects/ai-provider-abstraction-phase-a3-brief.md).
