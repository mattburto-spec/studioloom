# Project: Pilot-Readiness Track — NIS Pre-Pilot Compliance & Hardening

**Created:** 28 April 2026
**Status:** DESIGN PHASE — derived from `studioloom-it-audit-2026-04-28.docx`. Complements (does NOT overlap) [`access-model-v2.md`](access-model-v2.md). Awaiting Matt sign-off before any workstream starts.
**Priority:** P0 — blocks NIS pilot start (paired with v2 Checkpoint A7)
**Estimated effort:** ~10–14 working days of Matt's time, but **calendar elapsed is dominated by external waits** (DPA signatures, parental consent collection, NIS network arrangement, optional counsel review). Realistic calendar: ~3–4 weeks if the parallel waits are kicked off early; longer if signatures or school-workflow waits stack.
**Worktree:** none. Most workstream A items are not engineering — they are docs, signatures, paperwork, network coordination. Workstream B items that are engineering land in small worktrees per item (`/Users/matt/CWORK/questerra-hardening` recommended) but can also land directly on `main` if Matt prefers, since they are tightly scoped and unlikely to collide with the v2 worktree.
**Dependencies:**
- **Complements [`access-model-v2.md`](access-model-v2.md) Path B.** v2 ships every audit finding it absorbs (F6, F7, F9, F10, F12, F13, F14, F19, F22, F24, F25, F32, partial F33, F39); this track ships everything else.
- **Pilot-GO is the AND of:** v2 Checkpoint A7 + every workstream-A item in this doc closed.
- **Several items real-world wait on third parties** (vendor legal teams, NIS IT, possibly external counsel). These are kicked off as early as Phase 0 of v2 to overlap the calendar.

---

## 1. Why This Exists

The 28 April 2026 IT audit (`studioloom-it-audit-2026-04-28.docx`) identified 28 numbered findings across 10 domains, 8 of them pilot-blockers, plus 12 pre-pilot conditions in §5 and 11 ongoing conditions in §6. After Matt signed off Path B for [`access-model-v2.md`](access-model-v2.md) on 28 April PM, **roughly half of the audit is now absorbed inside v2's Phases 0–6** — every code-shaped item that touches auth, RLS, audit logging, retention, MFA, AI budgets, or DSR endpoints lives there.

What's left is everything the audit identified that **does not close by writing application code on the v2 critical path**:

- **Legal and procurement work** — DPAs, ZDR addendums, privacy policy, ToS, parent-facing data notice
- **Operational artefacts** — incident-response runbook, break-glass plan, status page, parental consent forms
- **Real-world dependencies** — China network arrangement test, PIPL Article 38 assessment
- **Ongoing security hardening that is not on the pilot critical path** — pentest, dependency CI gates, rate limiting, server-side NSFW, fallback LLM, staging environment, DR drill, jailbreak red-team

This document is the named tracker for that work. It exists separately from v2 so that:

1. v2's worktree stays focused on architectural code; this track has a different cadence (signatures arriving by email, not commits)
2. Pilot-readiness is reviewed holistically at the v2 Checkpoint A7 sign-off — but a missed item here can't sneak through inside v2's checklist
3. The genuinely-ongoing post-pilot work is parked in one place rather than scattered across follow-ups

The audit's own framing is correct: **a meaningful fraction of pilot-readiness is not engineering work**. Treating it that way changes the schedule shape — most of the items are short Matt-tasks that have to be triggered early because the response time is outside Matt's control.

---

## 2. Scope

### In scope (this plan owns these)

**Workstream A — Pilot blockers (must close before first NIS student logs in):**

- F1 + F3: 9 vendor DPAs incl. Anthropic ZDR addendum
- F2: Data-flow diagram + sub-processor map for the school
- F23: Incident response runbook
- F27: China connectivity / network test + PIPL Article 38 assessment
- F31: Privacy policy + Terms of Service + parent-facing data processing notice
- F33: Parental consent forms (gated on F1 + F31)
- F26 (break-glass portion): Two-engineer break-glass plan + status page

**Workstream B — Ongoing hardening (close during pilot or before second-school onboarding):**

- F4: Sub-processor jurisdictional review (PIPL-aligned)
- F5: SSO with school IdP for production rollout (pilot mitigation = v2 OAuth providers)
- F8: Service-role key rotation runbook
- F15: SAST / DAST / dependency scanning in CI (Dependabot + `npm audit` gate + Semgrep)
- F16: External penetration test
- F17: API rate limiting middleware
- F18: Server-side NSFW image moderation
- F20: Delete dead code marked safe-to-delete
- F21: API route + integration test coverage gaps
- F26 (full version): Second engineer / on-call documentation
- F28: Fallback LLM provider chain (Groq + Gemini, FU-Y)
- F29: Staging Supabase project
- F34: Backup / PITR posture documentation + first DR drill
- F35: Storage bucket lifecycle policy
- F37: AI jailbreak red-team test

### Explicitly out of scope (covered by access-model-v2 — do NOT replicate)

Per [`access-model-v2.md`](access-model-v2.md) §1.5 (Path B chosen 28 Apr 2026 PM), every code-shaped audit finding ships inside v2 before any NIS student logs in. This track does NOT plan, schedule, or duplicate:

- **F6** MFA enforcement → v2 Phase 0
- **F7** Three parallel auth systems → unified helper → v2 Phase 1
- **F9** ENCRYPTION_KEY rotation script + fire drill → v2 Phase 0
- **F10** 8 unknown-auth route triage → v2 Phase 0
- **F12** 7 RLS-enabled-no-policy tables documented → v2 Phase 6
- **F13** Cross-school data leak pattern → v2 Phase 1 + 3 (school-id primitive + can() helper close the pattern)
- **F14** Live RLS test harness → v2 Phase 0
- **F19** Retention enforcement cron → v2 Phase 5
- **F22** Audit log infrastructure → v2 Phase 5
- **F24** Cost-alert pipeline live test → v2 Phase 5
- **F25** Sentry PII scrubbing verification → v2 Phase 5
- **F32** Data export + erasure endpoints → v2 Phase 5
- **F33** Anthropic transfer basis (technical part) → v2 Phase 5; the parental-consent-form portion is in this track because it's a paper / school workflow
- **F39** Pilot freeze policy → v2 §5 (activates post-A7)

If any of these turn out to need additional scaffolding outside v2's worktree, that scaffolding is filed against v2, not added here.

### Already shipped / no action

F11 (96/96 RLS — STRONG), F30 (six-axis taxonomy — STRONG), F36 (moderation across 15 endpoints — STRONG), F38 (six living registries + saveme — STRONG), F40 (build methodology — STRONG). The audit cites these as evidence that conditional approval is even possible. No work; cited as context.

---

## 3. Workstream A — Pilot Blockers

Each item has an owner, an artifact location, an effort estimate (Matt-time), and an external-wait estimate (calendar). The Matt-time + external-wait distinction matters: Matt-time of 0.5 day with an external-wait of 2 weeks means kick off NOW, not next week.

Sequence: items 1–4 launch on day 1 to overlap with v2 Phase 0. Items 5–7 follow the v2 Phase 5 (audit log + retention cron) signoff because legal copy is much easier to write once the technical posture they describe is real. Items 8–9 are short and can land any time in the v2 window.

### A.1 — Vendor DPAs + Anthropic ZDR addendum (F1, F3)

**Goal:** every vendor processing student data has a signed DPA on file. Anthropic specifically has the ZDR addendum signed alongside (drops prompt/response retention from 30 days to abuse-review only).

**Sub-tasks:**

1. Pull the standard DPA from each of the 9 vendors in [`docs/vendors.yaml`](../vendors.yaml): Anthropic (incl. ZDR addendum F3), Supabase, Voyage AI, Vercel, Sentry, Resend, ElevenLabs, plus Groq + Gemini if/when shipped via F28.
2. Send/sign each. Most are public click-through DPAs; Anthropic ZDR may require Tier-4+ confirmation in writing.
3. File the signed PDFs in `docs/legal/dpa/` (one PDF per vendor, named `<vendor>-dpa-<YYYY-MM-DD>.pdf`).
4. Update [`docs/vendors.yaml`](../vendors.yaml) `dpa_signed:` field with the date for each vendor as part of the next saveme.
5. For Anthropic specifically, also confirm in writing that the API tier supports ZDR before relying on it in marketing copy.

**Owner:** Matt
**Matt-time:** ~0.5 day (sending requests + filing)
**External-wait:** 2–5 business days per vendor; can run in parallel; total elapsed ~1–2 weeks if vendors are responsive, longer for smaller vendors (Resend, ElevenLabs in particular). Anthropic + Supabase historically faster.
**Artifact:** `docs/legal/dpa/*.pdf` + updated `docs/vendors.yaml`
**Dependencies:** none — kick off DAY 1 of v2 Phase 0
**Closes:** F1, F3

**Stop trigger:** any vendor refuses or quotes >$0 for the DPA — escalate to Matt, may force a vendor swap or scope reduction (e.g. drop ElevenLabs from pilot if it can't sign).

### A.2 — Data-flow diagram + sub-processor map (F2)

**Goal:** one-page diagram answering "where does my child's design conversation actually go?" — printable PDF for the school file, plus a parent-readable web version. Generated from `vendors.yaml` + `data-classification-taxonomy.md` so it stays in sync.

**Sub-tasks:**

1. Draw the diagram (draw.io / Excalidraw / hand-rendered): student input → Vercel edge → Next.js API → Supabase (PG/Auth/Storage) → Anthropic / Voyage / Resend / Sentry / ElevenLabs as side-effects. Annotate each arrow with data category from `data-classification-taxonomy.md` and retention horizon.
2. Source-content list: every sub-processor named, what categories of data go to each, retention per category, parental consent path, DSR mechanism, contact for complaints.
3. Export PDF. Store source SVG + PDF at `docs/legal/data-flow-diagram.{svg,pdf}`.
4. Web version lives at `studioloom.org/data` (route placeholder shipped in A.4 below).

**Owner:** Matt
**Matt-time:** ~1 day
**External-wait:** none, but quality benefits from waiting until v2 Phase 5 lands so retention cron + audit log are real, not promised
**Artifact:** `docs/legal/data-flow-diagram.{svg,pdf}` + content sourced into A.4 page
**Dependencies:** A.1 (sub-processor list must match what's actually signed)
**Closes:** F2

### A.3 — Incident response runbook (F23)

**Goal:** single-page runbook so the school IT director can be told in advance "we will hear from you within X hours, the on-call is Y, the escalation path is Z, the breach notification clock starts when."

**Sub-tasks:**

1. Write `docs/security/incident-response.md`. Sections:
   - Incident categories (key leak, RLS bypass found, vendor breach notified upstream, abuse incident from a student account, cost runaway, China-network disruption, AI jailbreak with safety implication)
   - Notification timeline: GDPR 72 hours from awareness, PIPL immediate, FERPA per district policy. Both apply because students are China-resident and platform serves international school
   - Escalation path: Matt → NIS IT director → NIS principal; named contacts + out-of-hours numbers
   - Take-platform-offline procedure: Vercel rollback to last green tag, Supabase project read-only mode, status page update text
   - How rotation is performed under incident: links to v2 Phase 0's rotation runbooks (ENCRYPTION_KEY) + a forward link to F8 service-role rotation runbook in workstream B
   - Post-incident communication template (draft email to parents, draft email to school)
2. Aim for one printed page when laid out; longer is fine for the digital version.

**Owner:** Matt
**Matt-time:** ~1 day
**External-wait:** none
**Artifact:** `docs/security/incident-response.md`
**Dependencies:** lighter if v2 Phase 0 ships first (so the rotation runbooks it links to exist), but content is independent — can draft any time
**Closes:** F23

### A.4 — Privacy policy + ToS + parent-facing data notice (F31)

**Goal:** three documents live at `studioloom.org/privacy`, `/terms`, `/data`, written at 8th-grade reading level, that name every sub-processor, every data category, every retention horizon, and the contact for data subject requests. Plus a printable PDF for the school file.

**Sub-tasks:**

1. Generate first draft from [`docs/vendors.yaml`](../vendors.yaml) + [`data-classification-taxonomy.md`](../data-classification-taxonomy.md). Drafting tooling: any LLM with the two registries as input is acceptable for the draft; Matt edits.
2. (Optional but recommended) Counsel review. Matt currently has no retained counsel; for the NIS pilot the school's parent-organization legal team may be willing to spot-check, or Matt can engage a hourly privacy lawyer for ~$500–1500. **Open question — see §6.**
3. Build three Next.js pages: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/data/page.tsx`. Each renders a markdown file from `docs/legal/`. Wire footer links from the marketing landing page.
4. Printable PDF version generated by browser print-to-PDF on each page; file at `docs/legal/<doc>-<date>.pdf`.

**Owner:** Matt (drafting + page wiring); optional counsel for review
**Matt-time:** ~2 days drafting + 0.5 day page wiring
**External-wait:** depends on counsel review path (0 days if self-only, 1–2 weeks if external counsel)
**Artifact:** `docs/legal/privacy.md`, `terms.md`, `data-notice.md` + three `src/app/*/page.tsx` routes
**Dependencies:** A.1 (DPAs reference the policy; policy references DPAs); ideally also after v2 Phase 5 signoff so retention/AI-budget claims match the shipped reality
**Closes:** F31; partially closes F33 (the legal disclosure portion)

### A.5 — China connectivity test + PIPL Article 38 assessment (F27)

**Goal:** prove that on day one of the pilot, NIS students sitting at school-network desks can reach `studioloom.org`, complete a Design Assistant turn, and receive a moderation response — at acceptable latency and error rate — over a 24-hour observation window. Plus document the cross-border-data-transfer path under PIPL Article 38.

**Sub-tasks:**

1. **Network test from NIS school WiFi:** schedule with NIS IT to use a student-issued device on the actual school WiFi during a representative period (lesson hours, not after-school). Measure: studioloom.org reachable (ping + first-byte), one full Design Assistant turn round-trip latency (target < 5 sec, hard ceiling 10 sec), error rate over 24 hours (target < 5%). Run a small script that logs to a CSV — Matt can write this in 30 minutes; the wait is the school scheduling, not the script.
2. **Document the school's outbound network arrangement:** which VPN / proxy / leased line is in use, who owns it, which domains are allowlisted. NIS IT writes this; Matt files it under `docs/security/china-network-arrangement.md`.
3. **PIPL Article 38 assessment:** for cross-border transfer of student data to US-hosted Anthropic + Supabase, complete one of the three legal paths — security assessment, standard contract, or certification. For pilot scale (60 students, instructional non-grade-of-record), the standard contract path is least-friction. Draft contract content lives at `docs/legal/pipl-standard-contract-{vendor}.md`. Parental consent (A.6 below) carries the user-facing disclosure.
4. **Fallback plan if network is intermittent:** F28 (workstream B) ships the Groq fallback chain. If the network test reveals Anthropic unreachable from NIS, F28 becomes a pilot blocker not just a workstream-B item — escalate.

**Owner:** Matt + NIS IT
**Matt-time:** 0.5 day testing + 1–2 days writing PIPL standard contract content
**External-wait:** NIS IT scheduling — 1–3 weeks elapsed depending on calendar; PIPL contract may need a Mandarin reviewer
**Artifact:** `docs/security/china-network-test-2026.md`, `docs/security/china-network-arrangement.md`, `docs/legal/pipl-standard-contract-{vendor}.md`
**Dependencies:** none for the test itself; PIPL contract benefits from A.1 DPAs being signed first so vendor-specific terms can be referenced
**Closes:** F27. Touches F4 (sub-processor jurisdictional review — A.5 surfaces the AWS region question that F4 also asks).

**Stop trigger:** if the 24-hour network test shows error rate > 20% or median latency > 8 sec, the pilot is not viable in the current network arrangement. Escalate immediately — either negotiate a different arrangement with NIS IT, or scope the pilot down to non-AI features only, or delay until network is fixed. **Do not paper over this.**

### A.6 — Parental consent forms (F33)

**Goal:** every pilot student has signed parental consent on file before their classcode is distributed. Form discloses Anthropic US transfer specifically, in language a parent can read.

**Sub-tasks:**

1. Draft consent form content. Sources: A.4 privacy policy summary + A.5 PIPL standard contract disclosure language. One page. English + Mandarin (bilingual, since NIS is in China).
2. NIS PYP coordinator distributes to families. Collection workflow is the school's, not StudioLoom's.
3. Filed with the school file. Matt receives a confirmation count (not the forms themselves — those stay with the school per FERPA/privacy hygiene).
4. Matt records the count + date per pilot class in `docs/security/parental-consent-log.md`. Classcodes are not distributed until each class shows 100% return.

**Owner:** Matt drafts; NIS PYP coordinator distributes + collects
**Matt-time:** 1 day drafting (incl. Mandarin translation review)
**External-wait:** NIS school workflow — typical international-school consent collection runs 2–4 weeks elapsed. Holiday windows extend this.
**Artifact:** `docs/legal/parental-consent-form-{en,zh}.{md,pdf}` + `docs/security/parental-consent-log.md`
**Dependencies:** A.1 (DPAs signed — form references vendor names), A.4 (privacy policy — form summarises it), A.5 (PIPL contract — form discloses cross-border transfer)
**Closes:** F33

**Critical scheduling note:** A.6 has the longest external-wait of the entire track. Matt should draft the form content as early as A.4 lands — even if A.4 is still in counsel review — to give NIS the maximum collection window. **Treat A.6's calendar as the binding constraint on pilot start date.**

### A.7 — Break-glass plan + status page (F26 partial)

**Goal:** even with a solo developer, the school can see uptime in real time and recover the platform if Matt is unreachable.

**Sub-tasks:**

1. **Break-glass credentials in a school-accessible vault:** 1Password Family share with one designated NIS admin. Contains: Vercel admin login (or a deputy account), Supabase project owner credentials, domain registrar access, Resend account, and the one-page "what to do if studioloom.org is down" runbook. Vault access is read-only-emergency — not day-to-day.
2. **Configure Vercel status page:** ships with Vercel; takes ~30 minutes to enable + customise. Public URL like `status.studioloom.org`. NIS sees uptime + incident history.
3. **Pilot agreement language:** one paragraph in the NIS pilot MoU acknowledging the solo-developer constraint and committing to "expected response within X business hours, not 24/7." X = 4 hours during NIS school day, 1 business day otherwise. Matt + NIS coordinator review.
4. File at `docs/security/break-glass-plan.md` with pointer to the vault (not the credentials themselves).

**Owner:** Matt
**Matt-time:** ~0.5 day
**External-wait:** vault setup needs the designated NIS admin to accept the share — 1 day usually
**Artifact:** `docs/security/break-glass-plan.md`, configured status page, signed MoU clause
**Dependencies:** none — can land any time during v2 development
**Closes:** F26 partial (the operational mitigation portion). Full F26 (second engineer hire) lives in workstream B.

---

## 4. Workstream B — Ongoing Hardening

Items that close during the pilot or before second-school onboarding, per audit §6. None gate pilot start. Most are 0.5–2 days of engineering each. Some have CI / infra dependencies; flagged inline.

Sequencing principle: ship low-risk, high-leverage items early in the pilot window (Dependabot, dead-code deletion, jailbreak red-team — all touch nothing that students see). Higher-risk items (rate limiting, fallback LLM provider, server-side NSFW) wait until after first pilot smoke confirms baseline behaviour. Pentest scope is set after staging environment lands.

### B.1 — Sub-processor jurisdictional review (F4)

Determine the actual AWS region hosting the Supabase project (probably us-east-1 for the prod project; verify). Add `region:` to each vendor entry in `vendors.yaml`. Fold any new findings into A.5's PIPL contract if jurisdictional drift surfaces.
**Owner:** Matt | **Effort:** 0.5 day | **Dependencies:** A.1 + A.5 | **Closes:** F4

### B.2 — SSO with school IdP for production (F5)

Production-blocker per the audit; pilot mitigation is v2's OAuth providers (Google + Microsoft). Real SSO with NIS's specific IdP is a separate piece of work post-pilot, scoped only when a school formally requests it. **Do not build speculatively.**
**Owner:** Matt | **Effort:** 2–3 days when triggered | **Dependencies:** v2 Phase 2 OAuth shipped | **Closes:** F5 (production)

### B.3 — Service-role key rotation runbook (F8)

Single-page runbook at `docs/security/service-role-rotation.md`. Lists the 25 consumer surfaces (17 ops scripts + 8 admin routes per audit) with copy-paste rotation commands. Optionally migrate ops scripts to GitHub Actions secrets so the key is not in any local `.env.local`. Set quarterly rotation cadence as a `docs/doc-manifest.yaml` security_verification entry. **Distinct from v2's ENCRYPTION_KEY rotation (Phase 0)** — that key encrypts BYOK creds; this key is the Supabase admin key.
**Owner:** Matt | **Effort:** 0.5 day | **Dependencies:** none | **Closes:** F8

### B.4 — SAST / DAST / dependency scanning in CI (F15)

Enable GitHub Dependabot at weekly cadence. Add a CI job that runs `npm audit --audit-level=high` and fails on HIGH or CRITICAL. Subscribe to GitHub Security Advisories for `next`, `@supabase/supabase-js`, `@anthropic-ai/sdk`. Add a Semgrep or CodeQL workflow that runs on PR to main (free tier — SARIF uploaded to GitHub code-scanning). Document in `docs/security/supply-chain.md`. **Pre-flight:** run `npm audit` baseline first; fix any HIGH/CRITICAL before adding the gate, otherwise the gate fails on first run.
**Owner:** Matt | **Effort:** 1 day (incl. baseline cleanup) | **Dependencies:** none | **Closes:** F15

### B.5 — External penetration test (F16)

Commission a focused pentest before second-school onboards. $3–7K, scoped to the running staging environment from a reputable boutique. Resolve findings before any expansion. **Pre-requisite:** B.10 staging environment must exist; pentesting prod with live student data is out of scope.
**Owner:** Matt | **Effort:** 1 day commissioning + ~2 weeks vendor delivery + remediation time | **Dependencies:** B.10 staging | **Closes:** F16

### B.6 — API rate limiting (F17)

Vercel KV-backed limiter as Next.js middleware. Tier per route class — 5/min/IP on student login, 5/min/IP on teacher login, 10/min per teacher account on AI endpoints, 100/min/IP global default. 429 with `Retry-After` on exceed; log to `system_events`. Test with a load script (`k6` or hand-rolled curl loop) before flipping the gate. **Composes with v2 Phase 0's MFA gate** in middleware ordering — pre-flight check the order.
**Owner:** Matt | **Effort:** 1 day | **Dependencies:** v2 Phase 0 (MFA middleware lands first) | **Closes:** F17

### B.7 — Server-side NSFW image moderation (F18)

The current `NEXT_PUBLIC_NSFW_BLOCK_THRESHOLD = 0.6` is client-side and bypassable. Add server-side scan on every uploaded image (`/api/student/upload/*`, `/api/student/fabrication/upload/*`, plus any others — full audit in pre-flight). Use the same `nsfw.js` model server-side. Block above 0.6 server-side regardless of what the client sent. Log every blocked upload to `student_content_moderation_log`. Keep the client-side filter as fast UX feedback; comment in code that it is not load-bearing.
**Owner:** Matt | **Effort:** 1 day | **Dependencies:** none (independent of v2) | **Closes:** F18

### B.8 — Delete dead code marked safe-to-delete (F20)

Per [`questerra/CLAUDE.md`](../../CLAUDE.md) "Known issues" + audit F20: delete Own Time components, old approve route, old CertManager. Replace the hardcoded `claude-sonnet-4-20250514` in admin sandbox with an `ai_model_config` lookup. Single PR. Land before pilot for hygiene.
**Owner:** Matt | **Effort:** 0.5 day | **Dependencies:** none | **Closes:** F20

### B.9 — Test coverage gaps for API routes + integration (F21)

Per audit + CLAUDE.md known-issues. **Pair with v2 Phase 0's RLS test harness:** for every `/api/student/*` route in api-registry.yaml, add one positive test (student A reads own thing) + one negative test (student A cannot read student B's thing). v2 Phase 0 ships the harness; this item ships the per-route coverage on top of it. Flag any route where the negative test surfaces a real leak as a HOTFIX — fix in-task per Lesson #60, do not file a follow-up.
**Owner:** Matt | **Effort:** 1.5 days | **Dependencies:** v2 Phase 0 harness | **Closes:** F21

### B.10 — Staging Supabase project (F29)

New Supabase project on Pro Small (~$25/month — Matt already on Pro Small for prod). Same migrations applied. Same buckets. Service-role key + anon key as separate secrets in Vercel preview environment. New `.env.staging` template. Document in `docs/deployment/staging.md`. From this point forward any non-trivial migration applies to staging first, passes one Preflight smoke, then promotes to prod. **Pre-requisite for B.5 pentest.**
**Owner:** Matt | **Effort:** 1 day | **Dependencies:** Matt confirms ~$25/month spend | **Closes:** F29

### B.11 — Backup / PITR posture documentation + first DR drill (F34)

Document the actual Supabase tier (Pro Small per CLAUDE.md context) and confirm PITR is enabled (Pro Small includes daily backups + 7-day PITR). Run one tabletop DR exercise: deliberately drop a non-critical staging table at a known time, time the restore, document the data-loss window. Commit RPO ≤ 24h, RTO ≤ 4h to the NIS pilot agreement once verified. File at `docs/security/dr-drill-2026-{date}.md`. Set per-term DR cadence as a follow-up filed in [`dimensions3-followups.md`](dimensions3-followups.md).
**Owner:** Matt | **Effort:** 1 day | **Dependencies:** B.10 staging exists | **Closes:** F34

### B.12 — Storage bucket lifecycle (F35)

Three private buckets (Preflight Phase 1B-2). Document each bucket's replication, RLS confirmation (service-role-only per Phase 1B-2), backup mechanism, lifecycle policy. Add lifecycle rules to delete originals at the FERPA 7-year horizon (rule fires zero times in pilot but the rule has to exist). Pairs with v2 Phase 5 retention cron — that cron is the row-level enforcement; this is the bucket-level enforcement. File at `docs/security/storage-lifecycle.md`.
**Owner:** Matt | **Effort:** 0.5 day | **Dependencies:** v2 Phase 5 retention cron exists (so the patterns match) | **Closes:** F35

### B.13 — AI jailbreak red-team test (F37)

Take 30 known jailbreak prompts from public lists (DAN, role-play exits, prompt-injection via student input, system-prompt leaks, content-policy bypass attempts). Run each through the Design Assistant (`/api/student/design-assistant/turn`) and the Open Studio mentor. Log behaviour into `docs/security/jailbreak-redteam-{date}.md` — one row per prompt: input, response excerpt, classification (held / partial / broken), follow-up. Patch the 3–5 most obvious holes (likely: tighten system prompt against role-play exits and tool-use claims). Half-day exercise per audit; round to 1 day with patching.
**Owner:** Matt | **Effort:** 1 day | **Dependencies:** none | **Closes:** F37

**Stop trigger:** any prompt exfiltrates teacher data or another student's content (not just "model says something off-topic") — this is a v2-level escalation, not a B.13 patch. Stop and escalate.

### B.14 — Fallback LLM provider chain (F28, FU-Y)

Doc-vs-reality drift per FU-Y. Either ship Groq fallback (simplest — credential-resolution code already exists per FU-Y notes; the missing piece is the provider switch in `src/lib/ai/anthropic-client.ts` or wherever the chain lives) OR explicitly label AI features as best-effort with a teacher-facing kill switch. **Recommendation:** ship Groq fallback only for pilot; defer Gemini until needed. Update `vendors.yaml` from `not_integrated` to `integrated` and `feature-flags.yaml` `GROQ_API_KEY.required` to `true`. **Critical:** the moderation pipeline (audit F36 caveat) MUST fail-closed during outage, not fail-open. Verify in code review.

**This item escalates to workstream A if A.5's China network test reveals Anthropic is unreachable from NIS.** In that scenario, the fallback chain becomes pilot-blocking, not ongoing. Match priority to actual network reality.
**Owner:** Matt | **Effort:** 1.5 days | **Dependencies:** none for shipping; A.5 may force priority | **Closes:** F28

### B.15 — Second engineer / on-call documentation (F26 full)

Plan to add a second on-call before any second-school deployment. Pre-pilot is acceptable to ship with bus factor of one **only because** A.7 break-glass plan + status page mitigate the worst case. Post-pilot, this becomes a hiring / partnership / contracting question — out of scope for this track to plan; tracked here so it doesn't disappear.
**Owner:** Matt | **Effort:** ongoing | **Dependencies:** business-side | **Closes:** F26 full

---

## 5. Calendar & Dependencies

### Critical path to pilot start

Workstream A is the gating shape. Sequencing:

```
Day 1 (v2 Phase 0 starts)     │ A.1 DPAs sent (in flight 1–2 wk)
                              │ A.3 Incident response runbook
                              │ A.7 Status page + break-glass plan
                              │ A.5 NIS network test scheduled with NIS IT
                              │
Day ~5–8                      │ A.1 DPAs returning; file PDFs as they arrive
                              │ A.5 Network test runs (depends on NIS calendar)
                              │
Day ~10–14 (v2 Phase 5 ships) │ A.2 Data-flow diagram drafted from realised state
                              │ A.4 Privacy / ToS / data notice drafted
                              │ A.6 Parental consent draft sent to NIS
                              │
Day ~15+                      │ A.6 NIS distributes consent (2–4 wk collection)
                              │ A.4 Counsel review IF chosen (1–2 wk)
                              │ A.5 PIPL contract signed
                              │
v2 Checkpoint A7 + A.6 100%   │ PILOT GO
```

### Real-world wait estimates (calendar elapsed, not Matt-time)

| Workstream A item | Matt-time | External-wait | Bottleneck |
|---|---|---|---|
| A.1 DPAs | 0.5 d | 1–2 weeks | vendor legal teams; Anthropic + Supabase typically faster, smaller vendors slower |
| A.2 Data-flow diagram | 1 d | 0 (but quality benefits from waiting on v2 Phase 5) | none |
| A.3 Incident response runbook | 1 d | 0 | none |
| A.4 Privacy / ToS / data notice | 2.5 d | 0–2 weeks | optional counsel review |
| A.5 China network test + PIPL | 1.5–2.5 d | 1–3 weeks | NIS IT scheduling + PIPL contract translation |
| A.6 Parental consent forms | 1 d | **2–4 weeks (binding constraint)** | NIS school workflow; holidays extend |
| A.7 Break-glass + status page | 0.5 d | 1 day (vault share acceptance) | none |

**Realistic earliest pilot-start date** (assuming v2 Path B Phase 6 lands in ~18–24 working days = ~4–5 calendar weeks, and workstream A items are kicked off on day 1):

- v2 calendar finish: ~end of week 5
- A.6 parental consent: starts ~week 3 when A.4 + A.5 land; collection closes ~week 5–7
- A.1 DPAs: in by ~week 2
- A.5 network test: in by ~week 3 (assuming NIS IT can schedule in week 1)

**→ Earliest realistic pilot-start: ~5–7 calendar weeks from kickoff** (i.e. early-to-mid June 2026 if kickoff is the week of 28 Apr / 4 May). Binding constraint is parental consent collection, not engineering.

**Worst-case calendar:** if A.5 network test surfaces problems requiring renegotiation of NIS network access, or DPAs stall on a slow vendor, or counsel review on A.4 takes 3 weeks — pilot slips by 2–4 additional weeks. Plan for July 2026 in the worst case; aim for early June.

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Workstream A bottleneck (DPAs, consent, network) is treated as "not engineering work" and slips uncoordinated, blocking pilot start | High | Weekly check on workstream-A status during v2 development. Each engineering checkpoint reviews workstream A status as a sign-off line item. Items with external waits (A.1, A.5, A.6) launch Day 1 of v2 Phase 0, not when v2 finishes. |
| A.5 China network test reveals Anthropic unreachable from NIS school WiFi | Medium | B.14 fallback LLM chain (Groq) becomes pilot-critical, escalated from workstream B to workstream A. Pre-flight shipping decision: ship Groq before A.5 lands so the test can be run with both providers. |
| A.4 privacy policy stalls on counsel review (Matt has no retained counsel) | Medium | Two-path mitigation: (a) self-only review for pilot, with explicit caveat that counsel review happens before second-school onboarding (audit §6 ongoing condition); (b) hourly engagement with a privacy lawyer for ~$500–1500 if the school's parent organization wants it. **Open question — see §7.** |
| A.6 parental consent collection takes longer than 4 weeks (holidays, parent travel, slow returns) | High | Draft consent form as early as A.4 lands — even before counsel review on A.4 — to maximise NIS collection window. Treat 100% return per pilot class as a hard gate; do not soft-start with partial consent. |
| A.7 break-glass vault never gets accepted by NIS admin (forgotten, miscommunication) | Low | Calendar reminder at 3 days post-share; escalate to NIS PYP coordinator if not accepted by 7 days. |
| Workstream B item is mistaken for pilot-blocking and creates schedule pressure | Low | Audit § distinction is in this doc; review at every engineering checkpoint. Only B.14 has a possible escalation path (China network) — all other workstream B items are post-pilot or during-pilot. |
| Pentest (B.5) commissioned before staging (B.10) exists, vendor scopes against prod with live students | Low (now) → Medium (post-pilot) | Sequencing constraint baked into B.5: dependencies row names B.10 as prerequisite. Document this in the vendor RFP. |
| Pilot freeze policy (v2 §5) is interpreted as covering this workstream | Low | This workstream's engineering items (B.4, B.6, B.7, B.13, B.14) deploy DURING pilot. Freeze applies to NIS school hours only. Coordinate windows with NIS calendar. Workstream A items are mostly non-code so freeze does not apply. |
| Audit scope creeps — additional findings surface during workstream execution | Medium | New findings file as new B.x items in this doc, not new workstreams. Don't reorganise once running. Re-audit at end of pilot per audit §8 final recommendation. |
| Matt builds compulsively in workstream B and starves workstream A | High (per pattern) | Workstream A status is a sign-off line item at every v2 engineering checkpoint. Direct push-back if Matt skips an A item to ship a B item. The pilot blocks on A, not B. |

---

## 7. Open Questions for Matt

1. **A.4 counsel review path.** Self-only is fastest and cheapest; hourly privacy counsel is ~$500–1500 and adds 1–2 weeks; school-organization counsel is free if NIS is willing. Preference?
2. **A.5 PIPL standard contract translation.** Mandarin-language final required, or English with a Mandarin executive summary acceptable? Drives whether translation is in scope.
3. **A.7 break-glass NIS admin.** Who specifically? PYP coordinator, IT director, principal? Driver matters for the share workflow.
4. **B.5 pentest budget.** $3–7K range — any ceiling? Affects vendor selection.
5. **B.10 staging cost.** ~$25/month confirmed acceptable, OR alternative is Supabase Branching (free during preview but different shape)?
6. **B.14 fallback LLM scope.** Ship Groq only for pilot, or Groq + Gemini both? Groq is simplest; Gemini broadens the safety margin but doubles the surface area.
7. **A.6 consent form bilingual scope.** English + Mandarin both required? Mandarin only? Drives translation lead time.
8. **Workstream B sequencing.** This doc's recommended order is risk-graded; does Matt want to ship in a different order (e.g. all the easy items first)?

---

## 8. Pilot-GO Criteria

**Pilot is GO if and only if all of the following are true:**

- [ ] [`access-model-v2.md`](access-model-v2.md) Checkpoint A7 signed off
- [ ] A.1: 9 vendor DPAs signed + Anthropic ZDR addendum in place; PDFs in `docs/legal/dpa/`; `vendors.yaml` updated
- [ ] A.2: Data-flow diagram + sub-processor map published at `studioloom.org/data` and as PDF in `docs/legal/`
- [ ] A.3: Incident response runbook committed at `docs/security/incident-response.md`
- [ ] A.4: Privacy policy + ToS + parent notice live at `studioloom.org/{privacy,terms,data}`
- [ ] A.5: China network test passed (latency < 5s, error rate < 5%); arrangement documented; PIPL standard contract signed
- [ ] A.6: 100% parental consent return per pilot class, logged in `docs/security/parental-consent-log.md`
- [ ] A.7: Break-glass vault shared with NIS admin; status page live; pilot MoU clause signed
- [ ] Pilot baseline tagged as `v0.x-pilot1` (per v2 §5)
- [ ] Pilot freeze policy active (per v2 §5)

**Pilot is NOT yet GO with workstream B items open** — those close during/after pilot per audit §6. But B.14 (fallback LLM) escalates to GO-blocking if A.5 reveals the network requires it.

**Re-audit at end of pilot per audit §8** is a separate brief, not this one.

---

## 9. References

- **Source audit:** [`studioloom-it-audit-2026-04-28.docx`](../../studioloom-it-audit-2026-04-28.docx)
- **Sister project (Path B, ships every code-shaped audit finding):** [`docs/projects/access-model-v2.md`](access-model-v2.md) — particularly §1.5 (Path B rationale), §4 Phase 0 + Phase 5 (audit findings absorbed), §12 (parallel pilot-readiness track — this doc is the expanded version of that section)
- **Build discipline:** [`docs/build-methodology.md`](../build-methodology.md)
- **Existing follow-ups this track references:** [`docs/projects/dimensions3-followups.md`](dimensions3-followups.md) — FU-Y (F28), FU-M (closed by v2 Phase 5)
- **Six living governance registries** (touched by workstream B — full sync via saveme): [`vendors.yaml`](../vendors.yaml), [`feature-flags.yaml`](../feature-flags.yaml), [`api-registry.yaml`](../api-registry.yaml), [`schema-registry.yaml`](../schema-registry.yaml), [`ai-call-sites.yaml`](../ai-call-sites.yaml), [`WIRING.yaml`](WIRING.yaml)
- **Data classification taxonomy:** [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md) — drives A.2 + A.4 content
- **Project tracker (do NOT add this plan yet):** [`docs/projects/ALL-PROJECTS.md`](ALL-PROJECTS.md) — Matt adds the entry as part of the saveme that follows sign-off

---

## 10. Definition of Done

- All 7 workstream-A items closed; pilot GO criteria all ticked
- All 15 workstream-B items either closed or explicitly accepted-with-mitigation (e.g. F26 second-engineer deferred to second-school trigger)
- Re-audit conducted at end of pilot window per audit §8 — that is a separate brief, not this one
- This plan moved from "Active Projects" to "Complete" in [`ALL-PROJECTS.md`](ALL-PROJECTS.md) once Workstream A is fully closed; workstream-B remainder filed as standing follow-ups in [`dimensions3-followups.md`](dimensions3-followups.md)
