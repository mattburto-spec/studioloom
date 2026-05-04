# Project: IT Audit Remediation Plan — NIS Pilot Pre-Flight

**Created:** 28 April 2026
**Status:** DRAFT — **ON HOLD until Access Model v2 ships.** Matt decided 28 April PM that v2 will run first, then everything will be re-audited and this plan re-bucketed before sign-off. **Ownership conflict resolved 28 April PM (Option A):** v2 owns F6 (MFA), F9 (ENCRYPTION_KEY rotation), F10 (unknown-auth triage), F12 (RLS-no-policy docs — all 7 tables not just admin_audit_log), F14 (live RLS test harness), F19 (retention enforcement cron), F24 (cost-alert fire drill), F25 (Sentry PII verify), F32 (manual SQL export runbook stopgap). The §3 Finding-to-Action Map still shows these as THIS PLAN — they will be re-bucketed to ACCESS-V2 in the post-v2 re-audit pass. **Do not pick up this plan as a build spec until Matt has re-audited and re-signed it.** Awaiting Matt sign-off before any sub-phase begins.
**Source audit:** [`studioloom-it-audit-2026-04-28.docx`](../../studioloom-it-audit-2026-04-28.docx) (40 findings, 8 BLOCKER, 13 HIGH, 13 MEDIUM, 1 LOW, 5 STRONG)
**Pilot target:** Nanjing International School — 1 school, ≤ 3 classes, ≤ 60 students, week-of 27 Apr 2026 PYP coordinator meeting; first student login no earlier than the 12 pre-pilot conditions in audit §5 are satisfied
**Worktree (when work begins):** new worktree `/Users/matt/CWORK/questerra-audit-remediation` on branch `audit-remediation`. Phase G (out-of-codebase) does not need a worktree; Phases A–F do.
**Estimated engineering effort:** ~10–14 working days across 6 phases, plus the parallel out-of-codebase track (Phase G) which Matt drives day-by-day.

**Bucket count up-front (40 findings):**
- **22 in this plan** (engineering subset, Phases A–F)
- **6 absorbed by access-model-v2** (already signed off, not duplicated here — see §2)
- **9 out-of-codebase** (DPAs, legal copy, China network test, pentest commission, parental consent — Phase G track)
- **6 STRONG / already-closed** (no action; cited as evidence in the brief, audit summary, or both)

A meaningful fraction of this audit is **not engineering work**. Reading the brief, do not assume the engineering phases close the audit on their own — they don't. The legal and operational track has to ship in parallel or the platform stays blocked even after the code work lands.

---

## 1. Why Now

The audit's own framing is the right framing: there are still no real students using StudioLoom. This is the cheapest possible window. Every BLOCKER finding becomes orders-of-magnitude more expensive the moment the first parent emails to ask "where is my child's design conversation actually going?" and we don't have a one-page answer.

Three concrete pressures stack:

1. **NIS pilot timing.** PYP coordinator conversation is the week of 27 Apr 2026. Three classes, ~60 students, paper consent, no grade-of-record use. The audit's §5 lists 12 conditions that must be true before the first classcode is distributed. Most of them are days, not weeks — but only if we start now.
2. **Solo-dev advantage compounds in this window only.** Matt can fix things in-session today (the 28 Apr Preflight audit closed 12 of 12 findings in a single day) that, post-pilot, become "schedule a maintenance window with the school." Every remediation done before the first student logs in is one done without coordination cost.
3. **The audit anticipated access-model-v2.** Six audit findings collapse cleanly into the already-signed-off Access Model v2 project (auth unification, school entity, audit log, soft-delete, DSR endpoints, per-student AI budget). Doing this remediation plan first does not waste work — it builds the institutional plumbing (DPAs, MFA, RLS test harness, incident runbook, manual DSR procedure) that Access v2 will plug into rather than reinvent.

The audit's conditional-approval verdict is what we are working toward: pilot greenlit, but only on the 12 pre-pilot conditions, with the 11 ongoing conditions governing continued use beyond pilot. This plan is the engineering half of getting to that greenlight.

---

## 2. Scope

### Explicitly **in** scope (this plan)

The 22 findings in the "this plan" bucket of §3, organised into 6 engineering phases (A–F) plus the out-of-codebase tracking shell (Phase G).

The 12 audit pre-pilot conditions from §5 of the audit, owned end-to-end:

1. Sign DPAs with Anthropic + ZDR + Supabase + Voyage (F1, F3) — Phase G
2. Publish privacy / ToS / data-processing notice (F31) — Phase G + small Phase F wiring
3. China-network test from NIS WiFi (F27) — Phase G
4. MFA enforced on every teacher account (F6) — Phase B
5. Incident response runbook (F23) — Phase F
6. Cost-alert email pipeline live test (F24) — Phase A
7. Sentry PII scrubbing confirmed (F25) — Phase A
8. ENCRYPTION_KEY rotation script + fire drill (F9) — Phase B
9. Live RLS test harness or written authorization audit (F14, F21) — Phase C
10. Manual data-export + data-deletion runbook (F32) — Phase F
11. Two-engineer break-glass plan documented (F26) — Phase G
12. Parental consent forms collected (F33) — Phase G

### Explicitly **out** of scope (deferred or owned elsewhere)

**Already in [access-model-v2.md](access-model-v2.md) — do not duplicate:**

- **F5** SSO with school IdP — `access-model-v2` §3 item 2 (Google + Microsoft OAuth). Pilot mitigation here (MFA + manual account turnover) is in Phase B.
- **F7** Three parallel auth systems → unified helper — `access-model-v2` §2 Decision 1 + §3 items 14–16 (`getStudentSession()` / `getActorSession()`).
- **F19** Retention enforcement job — partially absorbed by `access-model-v2` §3 item 11 (soft-delete + 30-day hard-delete cron). The per-column 7-year retention horizon for student work is left for a follow-up cron because it cannot fire for years anyway. Phase E builds the scaffold + monthly run; the actual deletion logic for FERPA-retained columns lands with access-v2.
- **F22** Audit log of who did what to whom — `access-model-v2` §2 Decision 3 (`audit_events` table + `logAuditEvent()` wrapper). Pilot mitigation (manual logging discipline + admin/service-role action changelog) is in Phase F.
- **F32** Data export + erasure endpoints — `access-model-v2` §3 items 10–11. Pilot mitigation (manual SQL runbook) is in Phase F.
- **F12 (partial)** `admin_audit_log` table — its policy is supplied by access-v2 once the wrapper exists. The other 6 tables are addressed in Phase C of this plan.

**Out-of-codebase** (Phase G of this plan, but not engineering work):

- **F1** Sign 9 vendor DPAs — legal/procurement
- **F2** Data-flow diagram and sub-processor map for the school — content authoring (driven from `vendors.yaml` + `data-classification-taxonomy.md`)
- **F3** Anthropic ZDR addendum — procurement
- **F4** Sub-processors-of-sub-processors + region jurisdictional review (PIPL standard contract draft) — legal/procurement
- **F16** External pentest commission — vendor selection + scope + budget ($3–7K)
- **F26** Bus-factor mitigation — operational (status page configuration, break-glass credential vault, school-facing pilot agreement language)
- **F27** China network test — operational (school IT coordination + 24h measurement window)
- **F31** Privacy policy + ToS + parent-facing notice — legal copy (sourced from `vendors.yaml` + taxonomy, but reviewed by counsel before publish)
- **F33** Parental consent forms — paper, school workflow, school timeline

**Already-shipped or no-action (cited as evidence, not work):**

- F11 (RLS on 96/96 tables — STRONG)
- F13 (cross-school leak instance closed in this morning's Preflight audit; the pattern is mitigated by access-v2's `school_id` primitive — already on the critical path)
- F30 (six-axis data classification taxonomy — STRONG)
- F36 (moderation pipeline integrated across 15 endpoints — STRONG; one caveat in F28 about behaviour during LLM outage handled by Phase D)
- F38 (six living governance registries + saveme ritual — STRONG)
- F40 (build methodology — STRONG; the audit's own conditional-approval rests on this discipline being applied to the remediation work itself)

### Explicitly **deferred** beyond pilot

The 11 ongoing conditions from audit §6 govern post-pilot continuation. Most are absorbed by named projects already in the queue (access-model-v2, governance phases GOV-2..5). Two new items not currently tracked:

- **Quarterly published sub-processor list to the school** (F2-followup) — operational cadence after Phase G ships the first version.
- **Per-term DR exercise** (F34-followup) — operational cadence after Phase E ships the first drill.

Both filed as new follow-ups in [`dimensions3-followups.md`](dimensions3-followups.md) at the saveme step that follows Matt's sign-off on this plan.

---

## 3. Finding-to-Action Map

40 findings. Bucket column drives ownership: `THIS PLAN` (Phases A–F), `ACCESS-V2` (already signed-off project), `OUT-OF-CODE` (Phase G shell — Matt drives), `SHIPPED` (no action, cited as evidence).

| F# | Sev | Audit summary (one line) | Existing FU-* | Existing project | Bucket | Phase |
|----|-----|--------------------------|---------------|------------------|--------|-------|
| F1 | BLOCKER | No DPA with any of 9 vendors processing student data | — | — | OUT-OF-CODE | G |
| F2 | BLOCKER | No data-flow diagram / sub-processor map for the school | — | — | OUT-OF-CODE | G |
| F3 | HIGH | Anthropic ZDR addendum not signed | — | — | OUT-OF-CODE | G |
| F4 | MED | Sub-processors of sub-processors not surfaced; no jurisdictional review | — | — | OUT-OF-CODE | G |
| F5 | BLOCKER (prod) / HIGH (pilot) | No SSO with school IdP | — | access-model-v2 §3.2 | ACCESS-V2 (pilot mitigation here) | B |
| F6 | BLOCKER | No MFA on teacher accounts | — | — | THIS PLAN | B |
| F7 | HIGH | Three parallel auth systems, no unified session helper | — | access-model-v2 Decision 1 | ACCESS-V2 | — |
| F8 | MED | Service-role key in 25 surfaces, no rotation runbook | — | — | THIS PLAN | B |
| F9 | HIGH | ENCRYPTION_KEY cannot be rotated | — | — | THIS PLAN | B |
| F10 | MED | 8 routes classified `auth: unknown` | — | — | THIS PLAN | B |
| F11 | STRONG | RLS enabled on 96/96 tables | — | — | SHIPPED | — |
| F12 | HIGH | 7 tables RLS-enabled, no policies | FU-FF | partial: `admin_audit_log` via access-v2 | THIS PLAN | C |
| F13 | HIGH (pattern) | Cross-school data leak (instance closed today) | — | access-model-v2 (school primitive) | SHIPPED + ACCESS-V2 | — |
| F14 | HIGH | No live Supabase RLS test harness | FU-HH | — | THIS PLAN | C |
| F15 | HIGH | No SAST / DAST / dependency scanning in CI | — | — | THIS PLAN | D |
| F16 | HIGH | No external pentest on record | — | — | OUT-OF-CODE | G |
| F17 | HIGH | No API rate limiting | — | — | THIS PLAN | D |
| F18 | MED | Client-side NSFW filter is bypassable | — | — | THIS PLAN | D |
| F19 | MED | No data-retention enforcement job | — | partial: access-v2 §3.11 | THIS PLAN (cron scaffold) | E |
| F20 | LOW | Dead code marked safe-to-delete still in tree | — | — | THIS PLAN | D |
| F21 | MED | Test coverage gaps (RLS, API, integration) | — | — | THIS PLAN | C |
| F22 | BLOCKER | No audit log of who did what to whom | FU-W | access-model-v2 Decision 3 | ACCESS-V2 (manual mitigation here) | F |
| F23 | BLOCKER | No incident-response runbook | — | — | THIS PLAN (markdown) | F |
| F24 | HIGH | Cost-alert pipeline never tested live | FU-M | — | THIS PLAN | A |
| F25 | MED | Sentry PII scrubbing unverified | — | — | THIS PLAN | A |
| F26 | HIGH | Bus factor of one — solo developer | — | — | OUT-OF-CODE | G |
| F27 | BLOCKER | China connectivity to LLM + infra unverified | — | — | OUT-OF-CODE | G |
| F28 | HIGH | No fallback LLM provider — Groq + Gemini never shipped | FU-Y | — | THIS PLAN | D |
| F29 | MED | No staging environment | — | — | THIS PLAN | E |
| F30 | STRONG | Six-axis data classification taxonomy | — | — | SHIPPED | — |
| F31 | BLOCKER | No published privacy policy or ToS | — | — | OUT-OF-CODE (small wiring in F) | G + F |
| F32 | BLOCKER | No data export / erasure endpoints | — | access-model-v2 §3.10–11 | ACCESS-V2 (manual runbook here) | F |
| F33 | MED | Anthropic transfer needs DPA + privacy policy + consent | — | gated by F1 + F31 | OUT-OF-CODE | G |
| F34 | MED | Backup / PITR posture not documented; no DR drill | — | — | THIS PLAN | E |
| F35 | MED | Storage bucket backup and lifecycle not documented | — | — | THIS PLAN | E |
| F36 | STRONG | Moderation pipeline across 15 endpoints | — | — | SHIPPED (caveat in F28 → Phase D) | — |
| F37 | MED | AI jailbreak resistance not formally tested | — | — | THIS PLAN | A |
| F38 | STRONG | Six living governance registries + saveme | — | — | SHIPPED | — |
| F39 | MED | Active high-velocity dev during pilot window | — | — | THIS PLAN (policy doc) | F |
| F40 | STRONG | Build methodology — phased with checkpoints | — | — | SHIPPED | — |

**Bucket totals (audit confirms reading of §5 + §6):**

- THIS PLAN: 22 — F6, F8, F9, F10, F12, F14, F15, F17, F18, F19, F20, F21, F23, F24, F25, F28, F29, F32 (manual), F34, F35, F37, F39
- ACCESS-V2: 6 — F5, F7, F12 (admin_audit_log only), F19 (cron logic), F22, F32 (proper endpoints)
- OUT-OF-CODE: 9 — F1, F2, F3, F4, F16, F26, F27, F31, F33
- SHIPPED / STRONG: 6 — F11, F13, F30, F36, F38, F40

---

## 4. Phase Decomposition (Engineering Subset)

Six phases, each ending in a named Matt Checkpoint. No phase begins until the previous one is signed off in chat. Phase G runs in parallel with all of them — its items are not dependencies for the engineering work, but they ARE dependencies for the pilot starting.

The sequencing is deliberate: A first (cheap, builds telemetry confidence), B next (security hardening of identity surfaces — gates everything user-facing), then C (RLS / authorization assurance — gates everything data-facing), then D (broad app-security hardening — can run partially in parallel with C if Matt has bandwidth), then E (reliability / DR — does not block pilot launch but blocks confident continuation), then F (operational policy — runbooks + manual mitigations for the access-v2 BLOCKERs that won't ship in time).

Each phase brief below states: goal, sub-tasks, files touched, pre-flight checks, stop triggers, named Matt Checkpoint with PASS criteria. Sub-task counts are rough; the real brief for each phase will be drafted via the `build-phase-prep` skill once Matt signs off this plan.

---

### Phase A — Observability & Telemetry Foundations (~1.5 days)

**Goal:** prove the alarm bells already wired into the platform actually ring. Three small, independent fire-drills in one phase. Builds confidence and clears 3 audit findings before touching anything that could regress.

**Sub-tasks:**

1. **A.1 Cost-alert email fire-drill (F24, FU-M).** Set `COST_ALERT_DAILY_USD = 0.01` in a controlled window. Trigger one Sonnet generation that exceeds it. Verify Resend delivers email to `COST_ALERT_EMAIL` within 5 minutes. Re-trigger immediately and verify debounce suppresses the second send (existing `system_alerts` 6-hour debounce). Restore prod threshold. Capture screenshot + log lines into `docs/security/cost-alert-fire-drill.md`.
2. **A.2 Sentry PII scrubbing verification (F25).** Open Sentry dashboard, confirm PII scrubbing enabled (specifically: scrub default PII, IP, request body). Screenshot the setting into `docs/security/sentry-pii-scrub.png`. Add quarterly verification entry to `docs/doc-manifest.yaml` under a new `security_verifications` section so saveme surfaces it next quarter.
3. **A.3 AI jailbreak red-team (F37).** Curate 30 known jailbreak prompts from public lists (DAN, role-play exits, prompt-injection via student input, system-prompt leaks, content-policy bypass attempts). Run each through the Design Assistant (`/api/student/design-assistant/turn`) and Open Studio mentor. Log behaviour into `docs/security/jailbreak-redteam-2026-04.md` — one row per prompt: input, response excerpt, classification (held / partial / broken), follow-up needed. Patch the 3–5 most obvious holes (likely: tighten system prompt against role-play exits and tool-use claims).

**Files touched (estimate):**
- `docs/security/` — 3 new files (incident-response goes here in Phase F too)
- `src/lib/ai/design-assistant-prompt.ts`, `src/lib/ai/open-studio-prompt.ts` — small prompt hardening if A.3 surfaces obvious holes
- `docs/doc-manifest.yaml` — add quarterly verification cadence

**Pre-flight checks:**
- `git status` clean on `audit-remediation`
- `npm test` baseline captured (currently 1854 from Preflight Phase 6)
- Read Lessons #43–46 (Karpathy discipline, capture-truth-from-real-run)
- Confirm Resend account + sending domain are set up (if not, A.1 blocks on FU-M's "create Resend account" step — defer A.1 only if so)
- Confirm Sentry dashboard access — Matt's account, not a deputy

**Stop triggers:**
- A.1 cost-alert email does NOT arrive within 5 minutes after threshold breach → stop, do not ship A.1, escalate to inspect Resend deliverability + DNS + debounce logic before retry
- A.3 reveals a jailbreak that exfiltrates teacher data or another student's content (not just "model says something off-topic") → stop and report; this is a Phase B / Phase C escalation, not a Phase A fix
- Sentry PII scrubbing is found to be OFF → fix in-session, do not just document

**Don't stop for:** Sonnet response variance on jailbreak prompts, email arrival in 6 minutes vs 5 (note but proceed), Sentry showing minor extra fields scrubbed beyond expectation

**Matt Checkpoint A1 — PASS criteria:**
- Cost-alert email received in test window, debounce verified, screenshot or log committed
- Sentry PII scrub setting screenshot committed with date
- Jailbreak red-team report committed with all 30 rows + classification + any prompt-hardening commits separated
- npm test count not regressed

---

### Phase B — Identity Hardening & Key Rotation (~2 days)

**Goal:** harden every surface that sits in front of a credential or session token. MFA on, rotation runbooks written + once-tested, the 8 unknown-auth routes either fixed or documented.

**Sub-tasks:**

1. **B.1 MFA enforcement on teacher accounts (F6).** Enable Supabase project-level MFA. Add middleware check at `/teacher/*` route entry: if the JWT's AAL is `aal1` for a teacher principal, redirect to `/auth/mfa-enroll` (new page) before any handler runs. New page: TOTP enrollment via Supabase MFA API, show recovery codes once, force download/copy. On success, AAL upgrades to `aal2` and the original route resumes. For existing teacher accounts: enroll Matt's `mattburton@nanjing-school.com` and any pilot teacher accounts before Checkpoint B1. Document the MFA reset procedure (currently undefined — landing in `docs/security/mfa-reset-runbook.md`).
2. **B.2 Service-role key rotation runbook (F8).** Single-page runbook at `docs/security/service-role-rotation.md`. Lists the 25 consumer surfaces (17 ops scripts + 8 admin routes) with copy-paste rotation commands. Optionally migrate ops scripts to GitHub Actions secrets (drop the key from local `.env.local`). Identify which admin routes truly need service-role and flag candidates for `SECURITY DEFINER` migration in a follow-up. Set quarterly rotation cadence as a `docs/doc-manifest.yaml` security_verification entry.
3. **B.3 ENCRYPTION_KEY rotation script + fire drill (F9).** New script at `scripts/security/rotate-encryption-key.ts`. Loads all rows with encrypted teacher BYOK credentials, decrypts with `OLD_KEY` (env), re-encrypts with `NEW_KEY` (env), writes back atomically (single transaction per row, dry-run flag, row-count assertions). Test in staging once Phase E lands — but for B.3, we accept testing against a forked Supabase project or a one-off scratch project, since staging itself is a Phase E deliverable. Once tested, rotate once during pilot setup as the documented fire drill. Runbook at `docs/security/encryption-key-rotation.md`.
4. **B.4 Classify the 8 `auth: unknown` routes (F10).** Identify them: `grep -E "auth: unknown" docs/api-registry.yaml`. Read each route handler. Classify into the api-registry taxonomy. For any that ARE genuinely public (health-check, OG image, etc.) leave them with explicit `auth: public` annotation + a comment in the route file. For any that ARE auth'd but the scanner missed: either fix the scanner heuristic in `scripts/registry/scan-api-routes.py` or annotate manually. Net result: zero `auth: unknown` rows in api-registry.yaml after this sub-task.

**Files touched (estimate):**
- `src/middleware.ts` — MFA gate
- `src/app/auth/mfa-enroll/page.tsx`, `src/app/auth/mfa-enroll/route.ts` (or similar) — new enrollment UI
- `docs/security/mfa-reset-runbook.md`, `docs/security/service-role-rotation.md`, `docs/security/encryption-key-rotation.md` — new runbooks
- `scripts/security/rotate-encryption-key.ts` — new script
- 8 route files identified by B.4 + `scripts/registry/scan-api-routes.py` if heuristic fix needed
- `docs/api-registry.yaml` — regenerated via scanner; zero auth:unknown after
- `docs/doc-manifest.yaml` — add quarterly rotation verification

**Pre-flight checks:**
- Phase A signed off
- `git status` clean
- Read access-model-v2.md §2 Decision 1 + §10 helpers (`verify-teacher-unit.ts`, `resolve-class-id.ts`) — MFA gate must integrate cleanly with the unified session helper that Access v2 will land later
- Read Lesson #4 + #9 (auth-flow drift between teacher and student paths)
- Confirm Supabase project tier supports MFA (it does — all paid tiers; document the tier in vendors.yaml drift entry as a side-finding if not already noted)

**Stop triggers:**
- MFA gate breaks any existing teacher route (auth flash regression — Lesson #49 area) → stop, fix before proceeding to B.2
- B.4 reveals one of the 8 unknown-auth routes is actually public-facing AND writes to a sensitive table → escalate; this is a Phase C finding not a B finding
- ENCRYPTION_KEY rotation script fails on a real row in dry-run → stop, this is a data integrity risk; do not proceed to live rotation
- Discovery that any teacher BYOK credential in prod is unencrypted (rotation script finds rows missing the `iv` or `tag` field) → stop and report

**Don't stop for:** MFA enrollment UX polish (it's an internal-only screen for ≤5 teachers in pilot), bikeshedding the recovery-codes display, rotation runbook formatting

**Matt Checkpoint B1 — PASS criteria:**
- Matt's prod admin account has MFA enrolled and verified working (TOTP code from authenticator)
- Every pilot-target teacher account has MFA enrolled (or there's a documented enrollment task per teacher with a date)
- Service-role rotation runbook reviewed by Matt; quarterly verification entry exists in doc-manifest
- ENCRYPTION_KEY rotation script run successfully against a non-prod target (or a deliberately-rolled prod target if Matt agrees); runbook committed
- `docs/api-registry.yaml` shows zero rows with `auth: unknown`
- npm test count not regressed; any new MFA tests added

---

### Phase C — RLS & Authorization Assurance (~2 days)

**Goal:** prove the row-level security claims the platform is making are actually true at runtime, not just in migration SQL. Closes the structural gap that produced this morning's HIGH-1 cross-school leak.

**Sub-tasks:**

1. **C.1 Document or policy-fy the 7 RLS-enabled-no-policy tables (F12, FU-FF).** Tables: `admin_audit_log`, `ai_model_config`, `ai_model_config_history`, `fabrication_scan_jobs`, `fabricator_sessions`, `student_sessions`, `teacher_access_requests`. For each: decide explicitly whether it's `service-role-only` (in which case write a deny-all policy: `CREATE POLICY "deny_all_anon" ON x AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false)`) OR document the intent in `docs/security/rls-deny-all.md` and update `scripts/registry/scan-rls-coverage.py` to recognise the documented exceptions. Net result: the rls-coverage drift report shows zero `rls_enabled_no_policy` rows after this sub-task. NB: `admin_audit_log`'s policy actually belongs to access-v2 — for this phase we either deny-all-by-default or document the gap explicitly so it doesn't sit invisible.
2. **C.2 Build the live RLS test harness (F14, FU-HH).** New test file `tests/rls/cross-tenant.test.ts` (or Python under `fab-scanner/tests/` if we go that route — TBD in pre-flight). Spins up a temporary Supabase test project (or uses a tagged schema in the existing project — design decision in pre-flight). Creates two students in two classes belonging to two different teachers. Mints sessions for each. Asserts that student-A's session reading from every student-touched table returns zero rows belonging to student-B. Specifically covers: `submissions`, `student_progress`, `fabrication_jobs`, `gallery_posts`, `nm_observations`, `student_sessions`, `student_content_moderation_log`. This is the harness that would have caught HIGH-1 from this morning. Wire into CI as a separate job (it's slower than unit tests; runs on PR and on every merge to main).
3. **C.3 Per-route positive + negative tests (F21).** For every `/api/student/*` route in api-registry.yaml: one positive test (student A authenticated → can read their own thing) + one negative test (student A authenticated → cannot read student B's thing → either 404 or empty array, never the wrong row). Use the C.2 harness. Don't aim for full coverage — aim for one P+N pair per route. Flag any route where the negative test surfaces a real leak as a HOTFIX (do not just file a follow-up; fix in-phase per Lesson #60).

**Files touched (estimate):**
- `supabase/migrations/<timestamp>_rls_deny_all_seven_tables.sql` (if going the policy route)
- `docs/security/rls-deny-all.md` (if going the document route)
- `scripts/registry/scan-rls-coverage.py` — exception recognition
- `tests/rls/` — new test directory + harness setup
- Per-route test files under `src/app/api/student/**/route.test.ts` (or whatever convention the project uses for route tests today — confirm in pre-flight)
- `docs/api-registry.yaml` — auto-regenerates with test-coverage hints if scanner supports it

**Pre-flight checks:**
- Phase B signed off
- `git status` clean
- Re-read Lessons #29 (UNION pattern), #54 (PostgREST FK ambiguity), #60 (side-findings in same commit)
- Read FU-N resolution (migration 078 — UNION pattern) end-to-end; the C.2 harness should specifically include a UNION-pattern positive case
- Run baseline `python3 scripts/registry/scan-rls-coverage.py` and capture the current `rls_enabled_no_policy` count (should be 7)

**Stop triggers:**
- C.2 harness setup balloons past 1 day — re-evaluate scope; the audit's mitigation #9 explicitly says "OR document why every existing /api/student/* route's authorization is correct" as the pilot-acceptable alternative
- C.3 reveals a real cross-tenant leak in a route NOT covered by this morning's Preflight audit → fix immediately + file a Round-2 audit follow-up
- Test harness flake rate > 1% in CI — investigate before signing off; flaky security tests train people to ignore them

**Don't stop for:** Test harness ergonomics polish, scanner script style nits, individual route test names

**Matt Checkpoint C1 — PASS criteria:**
- `rls_enabled_no_policy` drift count = 0 in the rls-coverage scan
- C.2 harness passes locally and in CI
- Every `/api/student/*` route has at least one P+N test pair; api-registry.yaml shows the coverage
- Any leaks discovered in C.3 are FIXED, not just filed
- npm test count delta is significant and positive (probably +30 to +60); document the new baseline

---

### Phase D — Application Security Hardening (~2.5 days)

**Goal:** close the broad app-security gaps a school IT director will tick off mechanically: dependency hygiene, rate limiting, server-side moderation, dead code, fallback chain.

**Sub-tasks:**

1. **D.1 Dependabot + npm audit CI gate (F15).** Enable GitHub Dependabot at weekly cadence. Add a CI job that runs `npm audit --audit-level=high` and fails on HIGH or CRITICAL. Subscribe to GitHub Security Advisories for `next`, `@supabase/supabase-js`, `@anthropic-ai/sdk`. Add a Semgrep or CodeQL workflow that runs on PR to main (free tier — SARIF uploaded to GitHub code-scanning). Document the cadence in `docs/security/supply-chain.md`.
2. **D.2 Rate limiting middleware (F17).** Vercel KV + Upstash-backed limiter (or whichever the project's existing infra prefers — confirm in pre-flight). Tier the limits per route class:
   - Student login (`/api/auth/student-session`) — 5/min per IP
   - Teacher login (`/api/auth/teacher-*`) — 5/min per IP (Supabase has its own throttle, this is belt-and-braces)
   - AI-call endpoints (`/api/student/design-assistant/turn`, `/api/student/open-studio/turn`, all toolkit AI calls) — 10/min per teacher account (since these are authenticated)
   - Global default — 100/min per IP
   Wire as Next.js middleware. Failures return 429 with `Retry-After`. Log to `system_events`. Test with a small load script (`k6` or hand-rolled curl loop).
3. **D.3 Server-side NSFW moderation (F18).** Today the NSFW threshold (`NEXT_PUBLIC_NSFW_BLOCK_THRESHOLD = 0.6`) ships to the client. Add a server-side scan on every uploaded image to `/api/student/upload/*` and `/api/student/fabrication/upload/*` (and any other upload route — full audit in pre-flight). Use the same `nsfw.js` model server-side (or AWS Rekognition if Matt prefers a managed alternative; trade-off: added vendor in vendors.yaml). Block above 0.6 server-side regardless of what the client sent. Log every blocked upload to `student_content_moderation_log` with the score. Keep the client-side filter as fast UX feedback, document in code comment that it's not load-bearing.
4. **D.4 Dead code deletion (F20).** Delete in a single PR before pilot: Own Time components, old approve route, old CertManager. Replace the hardcoded `claude-sonnet-4-20250514` in the admin sandbox endpoint with the `ai_model_config` lookup that the rest of the platform uses. Per audit and CLAUDE.md "Known issues" — these are already flagged safe-to-delete.
5. **D.5 Fallback LLM provider chain (F28, FU-Y).** The doc-vs-reality drift is real per FU-Y. Either ship the fallback chain (the credential-resolution code already exists per FU-Y notes; the missing piece is the actual provider switch in `src/lib/ai/anthropic-client.ts` or wherever the chain lives) OR explicitly label AI features as best-effort with a teacher-facing kill switch. Recommendation: ship Groq fallback only (simplest) for pilot; defer Gemini until needed. Update `vendors.yaml` from `not_integrated` to `integrated` and `feature-flags.yaml` `GROQ_API_KEY.required` to `true` once shipped. Critical: the moderation pipeline (F36 caveat) MUST fail-closed during outage, not fail-open. Verify in code review.

**Files touched (estimate):**
- `.github/workflows/dependabot.yml`, `.github/workflows/security-scan.yml` (new)
- `src/middleware.ts` — rate limit gate (composes with B.1 MFA gate)
- `src/lib/rate-limit/` — new directory
- `src/lib/content-safety/server-image-filter.ts` — new (mirrors existing client-image-filter.ts)
- Upload routes — call server-side filter
- Files for dead-code deletion (per CLAUDE.md known-issues + grep for "Own Time", "CertManager", old approve route)
- `src/app/api/admin/sandbox/route.ts` (or similar) — model lookup
- `src/lib/ai/` — fallback chain wiring
- `docs/vendors.yaml`, `docs/feature-flags.yaml`, `docs/security/supply-chain.md`

**Pre-flight checks:**
- Phase C signed off
- `git status` clean
- `npm audit --audit-level=high` baseline run — capture current findings; fix any HIGH/CRITICAL before adding the CI gate (otherwise the gate fails on first run)
- Confirm Vercel KV is provisioned for the project; if not, this becomes a small sub-step of D.2
- Re-read Lesson #44 (silent max_tokens truncation — relevant to D.5 because fallback provider may have different token limits)
- Audit upload routes — list them all before D.3 starts; pre-flight surface area, not in-flight

**Stop triggers:**
- `npm audit` baseline reveals a CRITICAL with no fix available → stop, file a security incident note in `docs/security/`, decide whether to delay phase or accept-and-document
- D.2 rate limit triggers in normal test usage at the configured thresholds → tune before shipping; default-deny in production with no measurement is a self-DoS
- D.3 server-side scan fails on > 5% of test images (false positive rate) → tune threshold OR keep client-side gate active but log only on server, do not block
- D.5 reveals the moderation pipeline currently fails-OPEN (F36 caveat) — escalate to BLOCKER, this is a Phase C-level finding

**Don't stop for:** dependency CVE severity LOW or MED (file as follow-up, do not gate phase), rate limit fine-tuning beyond the four tiers above, dead code that turns out to have one obscure caller (handle inline)

**Matt Checkpoint D1 — PASS criteria:**
- Dependabot enabled, weekly cadence visible in repo settings
- `npm audit --audit-level=high` clean; CI gate enforces it
- Rate limiting deployed; load test shows 429s at the configured thresholds; legitimate traffic unaffected
- Every upload route exercises the server-side NSFW filter; one blocked-upload row appears in `student_content_moderation_log` from a deliberate test
- Dead code deleted; admin sandbox uses model lookup
- Fallback LLM provider chain shipped (Groq minimum) OR best-effort flag + kill switch shipped; vendors.yaml + feature-flags.yaml updated; moderation pipeline confirmed fail-closed
- npm test count delta documented (likely +20 to +40)

---

### Phase E — Reliability & Disaster Posture (~1.5 days)

**Goal:** stand up the staging environment that should have existed before Phase D shipped (we shipped without it because pilot timing pressure; this phase backfills) and document/exercise the DR posture.

**Sub-tasks:**

1. **E.1 Staging Supabase project (F29).** New Supabase project, Pro Small tier (~$25/month — Matt already on Pro Small for prod). Same migrations applied. Same buckets. Service-role key + anon key as separate secrets in Vercel preview environment. New `.env.staging` template. Document in `docs/deployment/staging.md`. From this point forward, any non-trivial migration applies to staging first, passes one Preflight smoke, then promotes to prod.
2. **E.2 Backup / PITR posture documentation + DR drill (F34).** Document the actual Supabase tier (Pro Small per CLAUDE.md context) and confirm PITR is enabled (Pro Small includes daily backups + 7-day PITR). Run one tabletop DR exercise: deliberately drop a non-critical staging table at a known time, time the restore, document the data-loss window. Commit to RPO ≤ 24 hours and RTO ≤ 4 hours in the school agreement once verified. File at `docs/security/dr-drill-2026-04.md`. Set per-term DR cadence as a follow-up filed in dimensions3-followups.md.
3. **E.3 Storage bucket lifecycle + backup (F35).** Three private buckets (Preflight Phase 1B-2): `fabrication-uploads`, `fabrication-thumbnails`, plus the third (confirm in pre-flight — `student-uploads`?). Document each bucket's: replication setting, RLS confirmation (service-role-only per Phase 1B-2), backup mechanism (Supabase Pro includes daily snapshots), lifecycle policy. Add lifecycle rules to delete originals at the FERPA 7-year horizon (this rule fires zero times in pilot but the rule has to exist). Pairs with E.4.
4. **E.4 Retention enforcement cron scaffold (F19).** New cron at `scripts/ops/retention-enforcement.ts`. Reads `data-classification-taxonomy.md` retention values per column. Runs monthly. For pilot, no rows will qualify (project too young) — but the cron fires, logs "0 rows qualified" to `system_events`, and proves the enforcement loop exists. The actual deletion logic for FERPA columns is folded into the access-v2 30-day soft-delete cron later. This sub-task ships the loop, not the per-column delete logic.

**Files touched (estimate):**
- `docs/deployment/staging.md`, `docs/security/dr-drill-2026-04.md`, `docs/security/storage-lifecycle.md` (new)
- `.env.staging.example` (new)
- Vercel preview config — env var setup (operational, not in-repo)
- `scripts/ops/retention-enforcement.ts` (new)
- `docs/feature-flags.yaml` — staging-specific keys if any
- `docs/vendors.yaml` — Supabase entry: confirm tier, region (resolves part of F4)

**Pre-flight checks:**
- Phase D signed off
- Confirm Matt is willing to spend the ~$25/month on staging (audit recommends; Matt may have other preference — "or just push to prod and pray" is also an option but it's the wrong one)
- Read CLAUDE.md "Migration discipline (v2)" — staging changes the migration discipline (now apply to staging first); update CLAUDE.md to reflect

**Stop triggers:**
- Supabase staging project provisioning fails (region availability, billing) → stop and report
- DR drill restore takes > 4 hours OR data loss window > 24 hours → escalate; the school agreement RPO/RTO commitments cannot be made
- Retention cron's first dry-run identifies any row that should already have been deleted → escalate, this is a pre-existing data-handling violation we missed

**Don't stop for:** staging UI parity differences (it's staging — env-specific differences are expected), bucket lifecycle exact wording

**Matt Checkpoint E1 — PASS criteria:**
- Staging Supabase project exists, schema matches prod, smoke test passes
- DR drill report committed; RPO/RTO numbers verified and committed to in `docs/security/dr-drill-2026-04.md`
- Storage lifecycle documented; bucket replication + RLS confirmed
- Retention cron exists, schedules monthly, dry-runs cleanly with "0 rows qualified" in pilot
- Migration discipline doc (CLAUDE.md) updated to reflect staging-first cadence

---

### Phase F — Operational Policy & Runbooks (~1 day)

**Goal:** close the four BLOCKER findings that don't have a code fix in scope before pilot — they need an explicit operational policy or manual procedure documented and signed off.

**Sub-tasks:**

1. **F.1 Incident response runbook (F23).** Single page at `docs/security/incident-response.md`. Sections: incident categories (key leak / RLS bypass found / vendor breach notified upstream / abuse incident from a student / cost runaway / China-network disruption), school notification timeline (GDPR 72h from awareness; PIPL immediate), escalation path (Matt → school IT director → school principal; named contacts), platform offline procedure (Vercel rollback to last green tag, Supabase read-only mode, status page update), how rotation is performed (links to B.2 + B.3 runbooks), post-incident communication template. Aim for 1 page printed.
2. **F.2 Manual data-export + erasure runbook (F32, mitigation).** Until access-v2 ships the proper endpoints, document the SQL queries to: produce a JSON export of every row keyed on a given `student_id`, in cascade order, including soft-delete cascade order for the future. Test the export procedure once against a real (test) student record. Commit `docs/security/dsr-manual-runbook.md`. Log every parental request received against this procedure in `docs/security/dsr-log.md`.
3. **F.3 Pilot freeze policy (F39).** Document at `docs/security/pilot-freeze-policy.md`. During pilot class hours (Nanjing time school day), no deploys to production except security hotfixes. Batch changes to evenings. Tag the pilot version (`v0.x-pilot1`) so rollback is one git tag away. Specify what counts as "security hotfix" (named categories: RLS leak, key leak, abuse vector). All other changes wait. Ship the tag at the same time as the policy so it's real, not just stated.
4. **F.4 Manual audit-trail discipline (F22, mitigation).** Until access-v2's `audit_events` table + `logAuditEvent()` wrapper ship, every administrative action by Matt (any service-role script run, any prod migration applied, any direct DB edit) must be logged in `docs/security/admin-action-log.md` with timestamp + actor + action + reason + affected table/student. Pre-pilot scope is 60 students — manual logging is tractable. Post-pilot, this BLOCKER moves to the access-v2 critical path immediately.
5. **F.5 Privacy policy / ToS / data notice page wiring (F31, partial).** The legal copy itself is Phase G (out-of-codebase). The wiring lives here: new routes `studioloom.org/privacy`, `studioloom.org/terms`, `studioloom.org/data` (parent-facing data-processing notice). Each renders a markdown file from `docs/legal/`. Markdown sources land via Phase G; this sub-task ships the routes + a placeholder so the URLs are linkable from the moment the copy is approved.

**Files touched (estimate):**
- `docs/security/incident-response.md`, `dsr-manual-runbook.md`, `dsr-log.md`, `pilot-freeze-policy.md`, `admin-action-log.md` (new)
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/data/page.tsx` (new — placeholder pages)
- `docs/legal/` (new directory — Phase G fills it)
- `docs/api-registry.yaml` — new public routes
- `src/components/layout/Footer.tsx` (or similar) — link the three new pages

**Pre-flight checks:**
- Phase E signed off
- Read access-model-v2 §3 items 8, 10, 11 — F.2 and F.4 mitigations must be a clean superset of what access-v2 will replace, not a different shape
- Confirm `studioloom.org` DNS + Vercel routing supports the new public paths

**Stop triggers:**
- F.5 placeholder pages cannot be deployed without the legal copy (because some compliance check requires non-empty) — escalate; either ship with a "policy under review, contact privacy@studioloom.org" interim or wait for Phase G copy
- F.4 manual log discipline turns out to be already needed RIGHT NOW for some action (e.g. Matt is mid-rotation when this phase starts) — backfill the log entries from this session before signing off

**Don't stop for:** Page styling (placeholders are placeholders), runbook word count, minor wording in policies

**Matt Checkpoint F1 — PASS criteria:**
- Incident response runbook committed and reviewed
- Manual DSR runbook committed; one test export performed; log file exists
- Pilot freeze policy committed; `v0.x-pilot1` tag exists and points to a clean prod state
- Admin action log file exists with at least one backfilled entry from the rotation drills in Phases A–E
- Privacy / ToS / data notice routes deployed and linkable; markdown sources present (even if placeholder content)

---

### Phase G — Out-of-Codebase Track (parallel, owner = Matt + legal + school)

**Goal:** track the 9 audit findings that do not close by writing code. This phase has no Matt Checkpoint in the engineering sense — it has 9 named items, each with an owner, a due date, and an artifact location. This is a tracking shell so the engineering side doesn't lose visibility on the items that gate pilot launch independently.

**Items (each becomes a row in a tracking table at `docs/security/out-of-codebase-tracker.md` after Matt signs off this plan):**

1. **G.1 Sign vendor DPAs (F1).** Anthropic, Supabase, Voyage AI, Vercel, Sentry, Resend, ElevenLabs, Groq (once integrated in D.5), Gemini (if shipped). All publicly available standard DPAs. Store PDFs in `docs/legal/dpa/`. Update `docs/vendors.yaml` `dpa_signed` field with the date as part of saveme. Estimated 2–5 business days of email and signing.
2. **G.2 Anthropic ZDR addendum (F3).** Request specifically alongside G.1. Verify in writing that the API tier supports it (Tier 4+ historically). Same artifact location.
3. **G.3 Sub-processor jurisdictional review + PIPL standard contract (F4).** Determine and document the actual AWS region hosting the Supabase project. Add `region:` to each vendor entry. Begin the PIPL Article 38 cross-border transfer assessment for the China pilot (standard contract for cross-border transfer + parental consent mentioning the US transfer specifically — the consent piece overlaps with G.8). Artifact: `docs/legal/pipl-assessment.md`.
4. **G.4 Privacy policy + ToS + parent-facing notice (F31).** Legal copy. Source content from `vendors.yaml` + `data-classification-taxonomy.md` so it stays in sync. 8th-grade reading level. Counsel review before publish. Markdown lands in `docs/legal/`; Phase F.5 wires the routes.
5. **G.5 Data-flow diagram + sub-processor map for the school (F2).** One-page diagram, printable PDF for the school file. Generated from `vendors.yaml`. Artifact: `docs/legal/data-flow-diagram.pdf` + the source SVG/draw.io.
6. **G.6 Pentest commission (F16).** Boutique pentest, $3–7K, scoped to running staging environment (which Phase E creates). Trigger: post-pilot, before second school onboards. Artifact: pentest report + remediation log.
7. **G.7 Bus-factor mitigation (F26).** (a) Document the constraint in the pilot agreement: "StudioLoom is operated by a solo developer; expected response within X business hours, not 24/7." (b) Configure Vercel status page so the school can see when platform is up. (c) Store break-glass credentials in a school-accessible vault (1Password Family share with a school admin) so platform recovery is not blocked on Matt being awake. (d) Plan to add a second on-call engineer before any second-school deployment. Artifact: `docs/security/break-glass-plan.md`.
8. **G.8 China network test from NIS WiFi (F27).** From a student-issued device on the actual school WiFi, reach `studioloom.org`, complete one full Design Assistant turn, measure latency + error rate over a 24-hour period. Document the school's outbound network arrangement in writing (which proxy / VPN, who manages it, which domains are allowlisted). Artifact: `docs/security/china-network-test-2026.md`.
9. **G.9 Parental consent forms (F33).** Paper, school workflow, school timeline. Forms must include explicit disclosure that conversations are processed by Anthropic in the US. Collect, file, confirm before classcodes are distributed. School workflow not StudioLoom workflow — Matt coordinates with NIS PYP coordinator.

**This phase has no engineering checkpoint.** It has the tracker file, and each item has its own due date driven by the pilot start date. The tracker is reviewed at the start of every engineering phase signature so a missed item can't sneak through to "pilot ready" without Matt seeing it.

---

## 5. Cross-Cutting Concerns

**Migration discipline.** Phases C and E add migrations (RLS deny-all policies if we go that route in C.1; possibly a `system_events` schema tweak in E.4). Both follow the v2 timestamp-prefix discipline (`bash scripts/migrations/new-migration.sh <descriptor>`), claim immediately on the feature branch, and run `verify-no-collision.sh` before any merge. Pre-merge gate is part of the Matt Checkpoint for those phases.

**Push discipline.** Same as build-methodology.md — no push to `origin/main` until Matt Checkpoint signed off, migrations applied to prod, smoke run locally, collision-check clean. WIP backups via `git push origin audit-remediation:audit-remediation-wip` between phases.

**Parallelism with other active worktrees.** Per `.active-sessions.txt` discipline, this work happens in `/Users/matt/CWORK/questerra-audit-remediation` on `audit-remediation` branch. Existing worktrees (`questerra-preflight` on `preflight-active`, `questerra-dashboard` on `dashboard-v2-build`) are not touched. Conflict surface: middleware, security registries, vendors.yaml. Pre-flight ritual for each phase reads `.active-sessions.txt` first.

**Registry sync.** Phase B.4 regenerates api-registry. Phases C–E touch schema-registry (RLS policies + retention cron + bucket lifecycle). Phase D updates vendors.yaml + feature-flags.yaml. Phase G updates vendors.yaml as DPAs land. All sync via the `saveme` ritual at the end of each Matt Checkpoint that touches them.

**No new ADRs in scope here.** The architectural decisions are already in access-v2 (ADR-011, ADR-012). This plan implements operational discipline + closes execution gaps; it does not introduce new architectural patterns.

**Lessons-Learned candidates.** Watch for: (a) MFA gate interaction with student/teacher session shape (likely Lesson #61 if the gate misclassifies a session AAL during transition), (b) RLS test harness flake patterns (likely Lesson #62 if test isolation between students is harder than expected), (c) rate-limit false positives in production-like traffic. Each gets a Lesson entry if it bites.

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Phase G items (DPAs, China network, parental consent) take longer than the engineering phases and become the actual blocker | High | Start G in parallel with Phase A on day 1. Tracker file in `docs/security/out-of-codebase-tracker.md` reviewed at every engineering checkpoint. Don't pretend pilot is ready when only the engineering side has shipped. |
| Phase B MFA gate breaks existing teacher routes (auth flash, redirect loop — Lesson #49 area) | Medium | Pre-flight reads access-v2 helper integration (`verify-teacher-unit.ts`); MFA enrollment route covered by integration tests before rollout to other teacher accounts. |
| Phase C live RLS harness reveals additional cross-tenant leaks beyond this morning's HIGH-1..4 | Medium | Stop-trigger fires; treat as in-phase work per Lesson #60, not as follow-ups. Budget additional 0.5–1 day if multiple sites surface. |
| Phase D npm audit baseline reveals CRITICAL with no fix available | Low | Document, get Matt's accept-and-document call, file follow-up; do NOT just turn off the gate. |
| Phase D rate limiter triggers in normal pilot use (60 students × 30 min lesson × multiple AI calls) | Medium | Tier limits per route and per principal type; capture baseline traffic from one shadow lesson before locking thresholds; teacher account limit set generously (10/min ÷ 60 students still leaves plenty per student). |
| Phase D server-side NSFW filter is slow enough to add user-visible latency on uploads | Medium | Run the scan async if needed; show "checking image…" interstitial; block download/share until scan completes; never block upload itself longer than 5 sec. |
| Phase E DR drill restore takes > 4 hours | Low (Pro Small includes 7-day PITR) | If restore window exceeds RTO commitment, escalate to Supabase support before committing the RTO number to the school. Don't promise what we can't keep. |
| Phase F manual audit-trail discipline fails (Matt forgets to log) | Medium | Make the log a step in saveme — the registry sync already runs unconditionally; add admin-action-log review to step 11. Discipline catches drift, not memory. |
| Pilot starts before all 12 audit §5 conditions are signed off | Medium-High | Each Matt Checkpoint includes "review §5 condition status" as a sign-off gate. Pilot start gated on the tracker showing 12/12 closed, not on the engineering phases shipping. |
| Access-model-v2 starts before this plan is fully signed off, leading to merge pain on middleware + registries | Medium | Per access-v2 §7 decision 7, that project is gated on Preflight Phase 8 + dashboard-v2 polish quiescing. This remediation plan slots ahead of access-v2's Phase 0. Coordinate via `.active-sessions.txt`. |
| The "two-Matts conversation" — audit recommends pre-pilot pentest (G.6) but timing puts it post-pilot | Low | Audit explicitly defers pentest to "before the second school onboards" not pre-pilot. Confirm with Matt that this is correct reading; if the pilot scope expands beyond NIS, pentest moves earlier. |

---

## 7. Open Questions for Matt

1. **Audit log mitigation acceptable?** The audit calls F22 a BLOCKER and offers manual logging as the documented mitigation for a 60-student pilot. Phase F.4 ships the manual log. Is this acceptable to you for pilot, or do you want to bring access-v2 Decision 3 (`audit_events` table + wrapper) forward into this plan as Phase H?
2. **Rate limiter infrastructure choice (D.2).** Vercel KV vs Upstash vs Cloudflare Workers KV. Vercel KV is simplest but Vercel-locked. Pre-flight will surface the cost difference; preference?
3. **NSFW filter — same model server-side or AWS Rekognition (D.3).** `nsfw.js` on the server is free + same model as client; AWS Rekognition is managed but adds a vendor entry. Preference?
4. **Pentest commission timing (G.6).** Audit says "before second school onboards." Is NIS pilot's expansion to a 4th class trigger? Or is the trigger "any second school"? Sets the budget-allocation timeline.
5. **Staging cost (E.1).** ~$25/month for a Pro Small staging project. Confirm budget — if not, alternative is using Supabase Branching (free during preview) but that's a different shape.
6. **F.5 placeholder content.** OK to ship `studioloom.org/privacy` with "policy under review, contact privacy@studioloom.org" while G.4 legal copy is in flight, OR wait for Phase G copy before deploying the routes?
7. **MFA reset procedure (B.1).** Currently undefined per audit. For pilot, is the reset procedure "Matt resets via Supabase admin" (acceptable for ≤5 teachers) or do we want a self-serve recovery-code flow shipped now?
8. **`auth-remediation` worktree placement.** Confirm `/Users/matt/CWORK/questerra-audit-remediation` on branch `audit-remediation` is the right location; alternative is to stay on `main` since these are mostly small isolated changes. Worktree gives parallelism with Preflight and dashboard-v2; main avoids merge surface.

---

## 8. Pre-Build Checklist (before Phase A brief)

1. Matt signed off on this plan + open questions in §7 resolved
2. Confirm trigger conditions: Preflight Phase 8 shipped + merged + migrations applied to prod (current state per `questerra/CLAUDE.md` Current focus); dashboard-v2 polish quiescent
3. Confirm Phase G owner sequencing (Matt himself? Some items school-side?) and start date for the parallel out-of-codebase track
4. Read `docs/build-methodology.md` end-to-end (already read for this plan; re-read at Phase A pre-flight)
5. Read access-model-v2.md §2 (Decisions) + §3 (Scope) — confirm no scope drift since plan was signed off 25 Apr; confirm the 6 ACCESS-V2 bucket items haven't moved
6. Read all 5 STRONG findings (F11, F30, F36, F38, F40) once more — these are the things we explicitly preserve through every phase; they appear in the audit summary as evidence of why conditional approval is possible at all
7. Run baseline: `npm test` (currently 1854 from Preflight Phase 6); `python3 scripts/registry/scan-rls-coverage.py`; `python3 scripts/registry/scan-api-routes.py`. Capture counts for delta tracking.
8. Create new worktree `/Users/matt/CWORK/questerra-audit-remediation` on branch `audit-remediation` (if §7 question 8 resolves to "use a worktree")
9. Append row to `.active-sessions.txt` for the new worktree
10. File the 5 audit-derived follow-ups in `dimensions3-followups.md` that this plan references but doesn't ship: per-term DR cadence (F34-followup), quarterly sub-processor-list publication (F2-followup), `auth: unknown` scanner heuristic improvement if B.4 doesn't land it (FU-DD-related), F22-pilot-mitigation-burndown (when access-v2 Decision 3 lands, retire the manual log), F32-pilot-mitigation-burndown (same shape).
11. Use `build-phase-prep` skill to write the Phase A brief

---

## 9. References

- **Source audit:** [`studioloom-it-audit-2026-04-28.docx`](../../studioloom-it-audit-2026-04-28.docx) (40 findings, §5 = 12 pre-pilot conditions, §6 = 11 ongoing conditions)
- **Build discipline:** [`docs/build-methodology.md`](../build-methodology.md)
- **Already-signed-off project absorbing 6 audit findings:** [`docs/projects/access-model-v2.md`](access-model-v2.md)
- **Existing follow-ups this plan references / closes:** [`docs/projects/dimensions3-followups.md`](dimensions3-followups.md) FU-M (F24), FU-HH (F14), FU-FF (F12), FU-Y (F28), FU-W (F22 — closed by access-v2)
- **Earlier same-day audit (closed in-session 28 Apr):** [`docs/projects/preflight-audit-28-apr.md`](preflight-audit-28-apr.md) — proves the audit-then-fix discipline works at this rhythm; used as evidence in audit §5 closing recommendation
- **Project tracker (do NOT add this plan yet):** [`docs/projects/ALL-PROJECTS.md`](ALL-PROJECTS.md) — Matt adds the entry as part of the saveme that follows sign-off, not now
- **Six living governance registries:** WIRING.yaml, schema-registry.yaml, api-registry.yaml, ai-call-sites.yaml, feature-flags.yaml, vendors.yaml — all touched across phases B–E; sync ritual per CLAUDE.md saveme step 11
- **Data classification taxonomy:** [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md) — drives F19 retention cron logic + F31 privacy notice copy
- **Lessons relevant per phase:** Phase A — #43–46. Phase B — #4, #9, #49. Phase C — #29, #54, #60. Phase D — #44. Phase E — none yet. Phase F — none yet.

---

## 10. Definition of Done (this plan as a whole)

- All 6 engineering Matt Checkpoints (A1, B1, C1, D1, E1, F1) signed off
- Phase G tracker (`docs/security/out-of-codebase-tracker.md`) shows 9/9 items closed OR explicitly accepted-with-mitigation (e.g. pentest deferred to second-school trigger per §6 of audit)
- Audit §5 (12 pre-pilot conditions) shows 12/12 met, with artifact link per condition
- This plan added to `docs/projects/ALL-PROJECTS.md` "Active Projects" → moved to "Complete" once 12/12 + 9/9 land
- Re-audit at end of pilot window per audit §8 final recommendation — that is a separate brief, not this one
