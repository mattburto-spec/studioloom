# Handoff — saveme-2026-05-09-security-round

**Last session ended:** 2026-05-09T07:35Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `f9db923` "security(P-3): privatise legacy storage buckets via /api/storage proxy (#142)" (origin/main; saveme branch is one commit on top)

## What just happened

Single long session, 9 May 2026. Started as a security audit, ended with all 3 P0 items closed across 2 merged PRs.

- **Audit (commit `c73483a` first round):** read every Anthropic call site, every RLS policy, every API route auth pattern, every storage bucket. Wrote `docs/security/security-overview.md` (16 sections, current-state) + `docs/security/security-plan.md` (24-item P0–P3 plan with tracking table). Closed FU-O/P/R in `dimensions3-followups.md` (cowork was reading stale text post Access v2 A7 PILOT-READY).
- **PR #140 (security-fixes-may-9):** Sentry `beforeSend` PII redactor (P-2 ✅) + `vendors.yaml` Anthropic categories (P-5 ✅) + dead `studentDisplayName` removed from `ai-prescore` + CI grep test (P-6 ✅) + quest API-DOCS doc drift (P-10 ✅) + `requireTeacher`/`requireStudent` helpers + hardened `requireTeacherAuth` (closes 59 callsites at once) + 13 highest-risk teacher routes migrated + `scan-role-guards.py` CI scanner (P-1 partial). Mid-merge G3 conflict resolved by promoting `STUDENT_NAME_PLACEHOLDER` + `restoreStudentName` to a shared security primitive at `src/lib/security/student-name-placeholder.ts` and refactoring G3's ai-prescore feedback path onto it (helper never sees the real name; route restores after).
- **PR #142 (p3-privatise-buckets):** new `/api/storage/[bucket]/[...path]` proxy that auth-gates + 302s to a 5-min signed URL. 4 writers updated to `buildStorageProxyUrl()`. Migration `20260508232012_privatise_legacy_buckets.sql` flips the 3 buckets private + drops public-read RLS + rewrites stored URLs in-place via regex. **Migration is NOT yet applied to prod** — that's the cutover step.
- **Saveme (this branch):** registry scanners run, WIRING.yaml updated (auth-system + new storage-proxy entry), changelog entry, doc-manifest entries for the 2 new security docs, master CLAUDE.md + open-followups-index.md updated.

Tests: 5006 passed / 11 skipped / 0 failed. tsc clean. role-guard scanner reports 119/206 covered / 80 missing / 7 allowlisted.

## State of working tree

- **Clean on origin/main** (`f9db923`).
- **Saveme branch (`saveme-2026-05-09-security-round`):** 8 files staged via the saveme agent + 2 master-level edits (master CLAUDE.md, open-followups-index.md outside this repo). Commit not yet made — next step.
- **Pending push count:** 0 (everything merged).
- **Local-only branches:** `security-fixes-may-9` (merged via squash, safe to delete), `p3-privatise-buckets` (merged via squash, safe to delete), `saveme-2026-05-09-security-round` (current).

## Next steps

- [ ] **Apply migration `20260508232012_privatise_legacy_buckets.sql` to prod Supabase.** This is the P-3 cutover. Order: (a) merge this saveme commit first so the docs reflect reality; (b) apply migration via Supabase migrations dashboard or `supabase migration up`; (c) run the post-migration smoke list from PR #142's body.
- [ ] **Sweep the 80 long-tail teacher routes** (`FU-SEC-ROLE-GUARD-SWEEP`). Mechanical: each is a `requireTeacher`/`requireTeacherAuth` substitution. Could be done in 1 dedicated session or chipped at over time. The CI scanner at `scripts/registry/scan-role-guards.py` will report coverage as you go.
- [ ] **Pre-customer items from `security-plan.md`:** P-4 timetable PII OCR (1d), P-7 CSP+HSTS (2d split), P-8 distributed rate-limit (1–2d), P-9 unprotected auth surfaces (0.5d).
- [ ] **`FU-SEC-RESPONSES-PATH-MIGRATION`:** URLs embedded inside `student_progress.responses` JSONB content. Pre-cutover inline images render 404 after the bucket flip; needs a dedicated migration that walks JSONB columns and rewrites URL strings safely. Build only when first-pilot students complain or you spot it in smoke.

## Open questions / blockers

_None._ Both PRs landed clean. The security plan tracking table at the bottom of [`docs/security/security-plan.md`](docs/security/security-plan.md) has the full picture for what's next; pick from P-4 onwards or chip at the role-guard sweep.
