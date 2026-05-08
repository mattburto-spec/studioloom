# Handoff — saveme-2026-05-08-cost-and-pii

**Last session ended:** 2026-05-08T12:25Z
**Worktree:** /Users/matt/CWORK/questerra
**HEAD:** (saveme branch off main) — three PRs already merged this session: [#133](https://github.com/mattburto-spec/studioloom/pull/133) `b48fbfa`, [#134](https://github.com/mattburto-spec/studioloom/pull/134) `9259185`, [#136](https://github.com/mattburto-spec/studioloom/pull/136) `f45edf7`

## What just happened
- **PR #133** rebuilt the broken admin Cost & Usage page as a spend-by-endpoint view on `ai_usage_log` (was 500ing on the empty `cost_rollups`). Period selector adds **today** (Asia/Shanghai boundary). 4 KPI cards + 4-card attribution split + sortable endpoint table.
- **PR #134** anonymized teacher-provided student names in the Report Writer free tool — substitute `Student` placeholder before sending to Anthropic, restore on response. Audit confirmed only 2 of ~35 AI call sites needed the fix; everything else already sends no names.
- **PR #136** dropped `metadata.batchStudent` from bulk Report Writer's `ai_usage_log` row — companion to #134 for our own DB.
- Three follow-ups Matt flagged were investigated: only one (a) needed code (#136); the other two (lib=0% in cost-usage, wizard-suggest `/api/` prefix) are non-issues — see decisions log + changelog for details.
- Stale `task-system-architecture-oq-resolution` remote branch deleted; its only unique commit was already on main under a different SHA.

## State of working tree
- Saveme branch staged with: `docs/api-registry.yaml` (auto-synced cost-usage route reads), `docs/vendors.yaml` (Anthropic notes addendum from PR #134), `docs/changelog.md` (new entry), `docs/decisions-log.md` (3 new decisions), `docs/handoff/saveme-2026-05-08-cost-and-pii.md` (this file).
- Tests: no net change this session (route-level changes, no new test files).
- Pending pushes: 0 to origin/main; saveme branch will go up via PR.

## Next steps
- [ ] Open saveme PR, wait for CI green, squash-merge.
- [ ] No active build phase blocked. Matt's options for next session:
  - **Continue dashboard** (worktree `/Users/matt/CWORK/questerra-dashboard`, branch `dashboard-v2-build`) — Phase 9-16 polish work per `docs/projects/student-dashboard-v2.md`.
  - **Continue preflight** (worktree `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`) — Pilot Mode follow-ups per `docs/projects/preflight-followups.md` (3 new ones from this week: `FU-PILOT-FLAGGED-API-TEST`, `FU-PILOT-MODE-FLIP-CRITERIA`, `FU-PILOT-AUTO-ORIENT`).
  - **Lever 0** (manual unit builder rebuild) — Matt flagged as one of three top candidates after Lever 1 shipped. ~5–7 days, brief pending.
  - **AI Budget Phase B** (provider abstraction → second provider plumbed in) — natural follow-on to Phase A.3 just shipping. Brief lives in conversation history; would need writing up.

## Open questions / blockers
- **`feature-flags.yaml` drift** persists from prior sessions: `SENTRY_AUTH_TOKEN` orphan (FU-CC tracks it as build-time-only secret), `auth.permission_helper_rollout` orphan (likely defunct flag), `RUN_E2E` missing from registry (CI-only). None blocking. Fold into the next saveme that touches feature flags substantively.
- **Cost & Usage drill-down + avg-tokens-per-call column** — Matt declined the v1.1 enhancements I proposed; revisit if cost monitoring becomes a daily ritual.
