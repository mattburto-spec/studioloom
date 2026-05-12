# World-Class Procurement Readiness

> **Brief type:** Phased build plan with named Matt Checkpoints, per
> [`docs/build-methodology.md`](../build-methodology.md). Doc-and-ops only —
> no code changes, no migrations, no test counts.
>
> **Source:** Procurement audit conducted 10 May 2026 against
> [`docs/security/security-overview.md`](../security/security-overview.md) +
> [`docs/security/security-plan.md`](../security/security-plan.md) +
> [`docs/projects/security-closure-2026-05-09-brief.md`](security-closure-2026-05-09-brief.md).
> Audit found the technical foundation is world-class but the governance
> + operational scaffolding is the gap blocking paid contracts.
>
> **Working assumption:** Matt picks this up the week of 11 May 2026.
> All work commits to `main`. No worktrees, no feature branches.
>
> **Goal:** close the 8 procurement deal-breakers a school IT head needs
> resolved before signing a 3-year contract. Three are external clocks
> (start now, finish in weeks); five are half-day docs Matt writes himself.
>
> **Revised 10 May 2026 (post Gemini cross-audit):** added Phase B5 (VDP +
> security.txt — zero-cost gap both audits surfaced), sharpened Phase B2
> (verifiable-parental-consent CAPTURE distinct from withdrawal — the COPPA
> Art. 6 *citation vs operationalisation* gap Gemini spotted), reframed
> Phase B4 as full DR plan with RPO/RTO commitments (not just a restore
> drill), added engineering-history extraction sub-task to Track C.

---

## Why this project

Audit verdict on the 11-line procurement checklist:
- **pass:** separation of duties + audit trail (1 of 11)
- **partial:** COPPA/FERPA/GDPR-K, sub-processor DPAs, parent DSR flow, MFA enforcement (4 of 11)
- **fail:** ICO Age Code, SOC 2, EU/UK data residency, IR runbook, vendor offboarding, pentest, backup/restore drill (7 of 11)

The "fail" rows are the deal-breakers. Six of the seven are doable in ≤1
day each by Matt; the seventh (data residency) is a multi-month roadmap
question this brief defers.

---

## Phase plan

Three phases run in parallel from day 1:
- **Track A (long external clocks):** start the multi-week vendor / lawyer / pentester clocks immediately.
- **Track B (write-your-own docs):** ship five governance docs Matt can write in half a day to one day each.
- **Track C (verify + close out):** smoke each delivery against a procurement-officer reading; mark plan items DONE; fix doc-drift; extract historical engineering content out of the procurement-facing security overview.

---

### Phase A1 — Anthropic ZDR addendum email
**Closes:** P-14 (`security-plan.md:295-303`). Removes "student prompts retained 30 days at Anthropic" as a procurement objection.

#### Pre-flight
1. Re-read [`vendors.yaml`](../vendors.yaml) Anthropic entry (lines 13-93). Confirm `dpa_signed: null`.
2. Re-read existing Anthropic relationship (BYOK + workspace key).
3. Locate Anthropic legal contact: `legal@anthropic.com` or commercial CSM if one is assigned.

#### Action (≤1 hour)
Email Anthropic legal requesting the Zero Data Retention addendum. Cite:
- Volume context (pre-pilot, NIS school, ~50 students Q3 2026, expansion path).
- Use case (children's education platform — COPPA/GDPR-K context).
- Workspace key + future BYOK paths.

#### Don't stop for
- Anthropic taking 1-2 weeks to respond. Track in calendar; don't block other phases on this.

#### Stop triggers
- Anthropic refuses ZDR for our tier (would surface a paid-tier dependency Matt should know about before billing).

#### Verify
1. Email sent (paste a redacted copy into `docs/legal/anthropic-zdr-request-2026-05-XX.md`).
2. On counter-signed return: PDF stored in `docs/legal/` (gitignored or encrypted), `vendors.yaml` updated `dpa_signed: 2026-XX-XX`.

#### **Matt Checkpoint A1.1**
Email sent + tracked. Reply landed: counter-signed PDF stored, vendors.yaml updated.

---

### Phase A2 — Privacy + Terms lawyer engagement
**Closes:** P-13 (`security-plan.md:277-291`). Procurement legal blocks without lawyer-vetted children's-data clauses.

#### Pre-flight
1. Re-read [`/privacy`](../../src/app/privacy/page.tsx) + [`/terms`](../../src/app/terms/page.tsx) — Claude-drafted starter content.
2. Decide jurisdiction priority: NSW governing law today; first paying school may force AU privacy lawyer (most flexible) or jurisdiction-specific firm (UK if first paid is UK).

#### Action (≤1 hour Matt time, 2-3 weeks calendar, $2-5K AUD)
Engage an Australian-qualified privacy lawyer. Suggested shortlist (Matt to vet): Bird & Bird AU, Maddocks (EdTech practice), Hall & Wilcox. Brief them with:
- COPPA + GDPR-K + Privacy Act 1988 alignment scope
- Children's data section (Discovery Engine + learning_profile profiling — file:line refs from audit)
- Sub-processor disclosure cadence (vendors.yaml as input)
- AI features section (Anthropic flow, BYOK model)
- Indemnity + limitation of liability

#### Don't stop for
- Lawyer turnaround beyond 3 weeks — track but don't block other phases.

#### Stop triggers
- Quote >$10K (out of scope for pilot budget; revisit firm choice).

#### Verify
1. Engagement letter signed.
2. Returned redlines applied to `/privacy` + `/terms` page components.
3. Lawyer name + review date in a comment block at top of each page.

#### **Matt Checkpoint A2.1**
Engagement letter signed. Then (calendar separate): redlines applied + comment block stamped.

---

### Phase A3 — Penetration test booking
**Closes:** P-15 (`security-plan.md:307-320`). No board-level procurement closes without a recent 3rd-party report.

#### Pre-flight
1. Re-read closure brief Phases S1-S7 — these are the surfaces a pentester will probe first; they should be clean.
2. Decide scope: 3-5 day focused engagement on auth flow (OAuth + classcode + Fabricator), authorization (role guard hold-up), API surface (spider + fuzz), LLM-prompt-injection paths, storage bucket access.

#### Action (≤2 hours Matt time, 1 week engagement + 1 week report, $5-10K AUD)
Get quotes from 3 AU/NZ shops: CyberCX, Pure Hacking, AsTech. Pick on price + EdTech experience + report turnaround.

#### Don't stop for
- Pentester proposed scope being slightly different — accept their judgment on what to probe.

#### Stop triggers
- All three quote >$15K (revisit firm shortlist or scope-down).

#### Verify
1. SOW signed.
2. Engagement scheduled.
3. On report receipt: P0/P1 findings filed as new items in `security-plan.md` tracking table; P0 closed before contract signature.

#### **Matt Checkpoint A3.1**
SOW signed. Then (calendar separate): report received + triage doc filed at `docs/security/pentest-2026-XX-report.md`.

---

### Phase B1 — Incident Response runbook
**Closes:** P-16 (`security-plan.md:324-339`). Every school procurement template requires this.

#### Pre-flight
1. Re-read [`docs/security/cost-alert-fire-drill.md`](../security/cost-alert-fire-drill.md) — copy its runbook format.
2. Re-read [`docs/security/multi-matt-audit-query.md`](../security/multi-matt-audit-query.md) for forensic-query patterns.
3. Skim the 8 operational runbooks already in `docs/security/` for tone + structure.

#### Action (½ day)
Write `docs/security/incident-response.md` with:
- **Detection:** Sentry alert thresholds, Supabase audit log queries, `audit_events` queries to spot lateral movement.
- **Containment:** revoke service-role keys command, force-logout-all-sessions SQL, freeze-writes RLS toggle.
- **Notification timelines:** COPPA (no fixed SLA but reasonable), GDPR (72h to authority + "without undue delay" to data subjects), Privacy Act 1988 (NDB 30 days), school IT contact list template.
- **Forensics:** audit log preservation, Supabase point-in-time recovery procedure, Sentry event export.
- **Communication:** parent-comms template per regime, school-admin notification template.
- **Post-mortem template.**

#### Don't stop for
- Specific Sentry alert thresholds being TBD — write "TODO: tune after first month of pilot data" inline.

#### Verify (tabletop)
Walk through the "Anthropic API key in Sentry public log" scenario. Time to first containment action <15 min reading off the runbook. Capture friction in a "v1 lessons" section at the bottom; iterate.

#### **Matt Checkpoint B1.1**
Doc exists + tabletop completed + first-iteration improvements applied.

---

### Phase B2 — DPIA for Discovery Engine + learning_profile + verifiable-parental-consent capture audit
**Closes:** ICO Age Appropriate Design Code Standard 2 (audit deal-breaker #1) + the COPPA Art. 6 *citation vs operationalisation* gap (surfaced by Gemini cross-audit). Not on `security-plan.md` today.

#### Pre-flight
1. Re-read [`docs/specs/discovery-engine-build-plan.md`](../specs/discovery-engine-build-plan.md) for the 8 stations + data captured.
2. Re-read `students.learning_profile` columns in [`docs/schema-registry.yaml`](../schema-registry.yaml).
3. Read ICO DPIA template at https://ico.org.uk/media/for-organisations/documents/2553993/dpia-template.docx (or skim the children's-data overlay).
4. Audit current consent-capture state: `grep -rn "consent" src/app/api/student/ src/app/welcome/` and `grep -rn "parental" src/`. Confirm there is NO verifiable-parental-consent capture flow today (vendors.yaml cites COPPA Art. 6 as the basis but the platform doesn't bind a parent identity to the consent record).

#### Action (1 day)
Write `docs/security/dpia-discovery-engine.md` with:
- **Description:** what the Discovery Engine + learning_profile collect, why, who reads it. Combined scope per Q4 — also covers Open Studio mentor + design-assistant student-text flows.
- **Necessity:** why each field is collected (no fishing).
- **Risks:** profiling of children, sensitive self-disclosure (anxiety, ADHD, dyslexia), inferring ability/wellbeing, AI mentor adapting based on profile.
- **Safeguards:** placeholder pattern (`restoreStudentName()`), 100% RLS, immutable audit log, per-student AI budget cap, no third-party tracking, no advertising.
- **Residual risk:** child self-discloses serious mental-health detail in free-text → Anthropic sees it under coppa_art_6. Mitigation: P-22 prompt-injection hardening + safeguarding procedure (B3 below).
- **Verifiable parental consent — current state vs target:** document the gap. Today: COPPA Art. 6 cited in `vendors.yaml`, no consent UI, no audit row. Target: parent-identity-bound consent record per student, captured at school onboarding (school as data controller forwards), with a `parental_consent_records` audit trail. File `FU-PROCUREMENT-PARENTAL-CONSENT-CAPTURE` (P0, gates first paid school) for the build work — out of scope for B2 itself, which only documents the gap.
- **Sign-off:** Matt as Privacy Officer.

#### Don't stop for
- ICO template feeling overengineered — it is, but the format is what schools' DPOs expect to see.
- The consent-capture *build* being out of scope — B2 documents the gap + files the FU; the build is a separate project Matt scopes when first paid school is in pipeline.

#### Verify
1. Doc covers all 24 factors from `docs/research/student-influence-factors.md` that flow into Discovery profile.
2. Every field cited has a `data-classification-taxonomy.md` row.
3. Each safeguard has a file:line ref.
4. Verifiable-parental-consent gap section names a target schema (table name, columns, audit linkage) the future build will implement, not just "we should do this".
5. `FU-PROCUREMENT-PARENTAL-CONSENT-CAPTURE` filed in `security-plan.md` tracking table at P0.

#### **Matt Checkpoint B2.1**
Doc exists + cross-references resolve + parental-consent FU filed.

---

### Phase B3 — Safeguarding response procedure
**Closes:** audit deal-breaker #7. Not on `security-plan.md` today.

#### Pre-flight
1. Re-read `src/lib/content-safety/server-moderation.ts` — what already triggers on distress disclosure?
2. Re-read teacher safety alert feed at `/teacher/safety/alerts` (Phase 6A from Dimensions3 Phase 6).
3. Re-read Discovery Engine fear-cards station + Open Studio mentor reflection station for the realistic surfaces where serious disclosure could land.

#### Action (½ day)
Write `docs/security/safeguarding-procedure.md` with:
- **What counts as serious disclosure:** explicit self-harm intent, abuse disclosure, suicidal ideation.
- **Detection:** existing moderation pipeline triggers (bullying/distress/violence flags) + the gap (free-text Discovery fear cards may not trigger).
- **Escalation ladder:** moderation flag → teacher safety alert → school safeguarding lead notification (24h SLA) → external authorities (per UK/AU/HK statutory obligation).
- **Communication:** parent comms template (when + when-not-to involve parents), DSL handover template.
- **Audit:** every safeguarding event logged to `audit_events` with `severity: critical` for FOI-style retrieval.
- **Follow-ups (not blocking v1):** detection gap on fear-cards + Open Studio reflections (`FU-SAFEGUARDING-FREETEXT-COVERAGE` P1).

#### Don't stop for
- Per-jurisdiction statutory obligation differences — write the AU baseline + flag UK/HK as "consult DSL".

#### Verify
- Tabletop with the scenario: "student types 'I want to hurt myself' into Discovery fear-card free-text." Walk through detection → alert → DSL handover. Time to teacher visibility <2 hours; time to DSL notification <24 hours.

#### **Matt Checkpoint B3.1**
Doc exists + tabletop completed.

---

### Phase B4 — Disaster Recovery plan + first drill
**Closes:** audit deal-breaker #6. Not on `security-plan.md` today. Reframed (10 May 2026) from "backup/restore drill" to full DR plan after Gemini cross-audit observed procurement asks for a *plan with committed numbers*, not just evidence of a single drill.

#### Pre-flight
1. Read Supabase PITR docs for project tier — confirm what RPO is achievable today.
2. Read Supabase docs for cross-region read-replica + failover options on current tier.
3. Pick a known canary row (e.g. a specific test student record from a sandbox class).

#### Action (½ day for plan, ½ day for drill = 1 day total)
Write `docs/security/disaster-recovery-plan.md` with:
- **Scope:** what counts as a disaster (region outage, accidental DELETE, ransomware, Supabase tier downgrade) + what does NOT (single Vercel function timeout — that's the IR runbook's surface).
- **Commitments (procurement-facing SLAs):**
  - **RPO target:** ≤15 min (or whatever PITR tier allows) — captured from the drill below, not aspirational.
  - **RTO target:** ≤4 hours for full prod restore to a clean environment + DNS cutover.
  - **Cross-region failover stance:** today single-region (US-east). Multi-region deferred to `FU-PROCUREMENT-DATA-RESIDENCY` (P0, addressed when first non-US paid school is in pipeline). Be honest in the doc — schools accept "single region today, roadmap to multi" if it's named.
- **Procedure (commands + UI steps):** standing up a clean Supabase project, PITR restore, canary verification, DNS cutover (Vercel), Supabase service-role key rotation post-restore.
- **Drill log table:** date, drill type (full restore / partial / tabletop), RPO observed, RTO observed, issues, fixes. Append-only.
- **Cadence:** quarterly drill, first within month-1 of brief sign-off, calendar reminders set.

Then run the first drill: stand up clean target, restore from PITR snapshot, query canary row, capture RPO/RTO, log in the drill table, tear down.

#### Don't stop for
- RPO being slightly worse than ideal (15 min vs 1 min) — capture truth, plan for tier upgrade if needed.
- Cross-region multi-tenancy being out of scope — name the FU and move on; the plan documenting "we are single-region with a roadmap" is itself the procurement deliverable.

#### Verify
- Procurement officer reading the doc can answer three questions: "what's the RPO/RTO?" (named numbers from the drill); "show me the last restore test" (drill-log table row); "what about EU data residency?" (FU named + roadmap stance).

#### **Matt Checkpoint B4.1**
Plan exists + first drill completed + drill table has one row + Q3 2026 calendar reminder set for next drill.

---

### Phase B5 — Vulnerability Disclosure Program (VDP) + security.txt + security@ inbox
**Closes:** audit deal-breaker (added 10 May 2026 post Gemini cross-audit). Zero-cost gap that procurement officers genuinely look for. Not on `security-plan.md` today.

#### Pre-flight
1. Read RFC 9116 (`security.txt` spec) — 5 min.
2. Confirm `security@studioloom.org` can be set up via the existing email provider (Resend, or whatever forwarding service Matt uses for `mattburto@gmail.com` aliasing).
3. Confirm where Next.js serves `/.well-known/*` from (`public/.well-known/security.txt` works in Next 15 — it ships static files from `public/`).

#### Action (½ hour)
1. Create `public/.well-known/security.txt` with the RFC 9116 fields:
   - `Contact: mailto:security@studioloom.org`
   - `Expires: 2027-05-10T00:00:00.000Z` (12 months out, calendar reminder set)
   - `Preferred-Languages: en`
   - `Canonical: https://studioloom.org/.well-known/security.txt`
   - `Policy: https://studioloom.org/security` (link to the public-facing policy page — see step 3)
2. Set up `security@studioloom.org` → forwards to `mattburto@gmail.com` (or Slack channel, or both).
3. Write `src/app/security/page.tsx` (public page, no auth) with:
   - Stated acknowledgment SLA (e.g. 72 hours).
   - Stated triage SLA (e.g. 7 days for severity assessment).
   - Scope (what's in / out — exclude DoS, social engineering, physical).
   - Safe-harbour clause for good-faith researchers.
   - Hall-of-fame stub (named acknowledgements once reports start landing).
4. Add a new entry to the calendar: 12 months out, refresh `security.txt` Expires + rotate if needed.

#### Don't stop for
- The `/security` page being design-rough — content matters more than visual polish for v1.

#### Verify
1. `curl https://studioloom.org/.well-known/security.txt` returns the expected content with `Content-Type: text/plain`.
2. `https://studioloom.org/security` renders the policy page.
3. Send a test email to `security@studioloom.org` — confirm forwarding works, capture the round-trip.
4. Pre-empts the procurement question "where do I report a vulnerability" — a fully-cited answer.

#### **Matt Checkpoint B5.1**
`security.txt` deployed + `/security` page deployed + inbox forwarding verified + 12-month calendar reminder set.

---

## Open questions (decide before starting)

### Q1 — Lawyer choice (Phase A2)
Australian privacy lawyer (most flexible across future schools) vs. jurisdiction-specific (UK if first paying school is UK). Matt's pick: ___

### Q2 — Pentester scope (Phase A3)
Black-box vs. white-box (give pentester repo + creds). Black-box is more realistic; white-box is faster + finds more. Matt's pick: ___

### Q3 — Data residency roadmap
Audit flagged "no EU/UK residency = killed first GDPR-strict UK school". Out of scope for this brief (multi-month engineering project — Supabase has EU regions but cutover is non-trivial). Decision: track as `FU-PROCUREMENT-DATA-RESIDENCY` (P0) and address separately when first UK school is in pipeline.

### Q4 — DPIA scope (Phase B2)
Discovery Engine + learning_profile is the obvious surface; should it also cover Open Studio mentor + design-assistant? My pick: yes, as a single combined "high-risk children's processing" DPIA. Saves writing three.

### Q5 — Safeguarding jurisdiction (Phase B3)
AU baseline + UK/HK as "consult DSL", or full per-jurisdiction breakout? My pick: AU baseline. Faster to ship; per-jurisdiction breakout when the school-region is known.

### Q6 — Verifiable parental consent capture (Phase B2 → follow-up)
COPPA Art. 6 cited in `vendors.yaml` is *legal basis*, not *operational mechanism*. Two options for the future build (out of scope for B2, captured by `FU-PROCUREMENT-PARENTAL-CONSENT-CAPTURE`):
- **A:** school-as-data-controller forwards consent (school's own consent form is the artefact; StudioLoom records "school X provided written attestation of parental consent for cohort Y on date Z" + retains the artefact reference). Lower lift, matches FERPA "school official" doctrine.
- **B:** in-platform parent-identity-bound consent flow (parent receives email with magic-link verification, signs consent record, audit row binds parent identity to student record). Higher lift, stronger evidence.

My pick (for the FU spec, not B2 itself): A as v1, B as v2 once a school requires direct parent involvement. School-controller doctrine is the lower-friction starting point and most international schools already capture parental consent via existing onboarding paperwork.

### Q7 — `security@` inbox routing (Phase B5)
Forward to `mattburto@gmail.com` (simple, immediate) or set up a shared inbox (separation of duties)? My pick: forward for v1; revisit when there's a second person to share the queue with.

---

## Done when

- A1: Anthropic ZDR counter-signed PDF in `docs/legal/`, `vendors.yaml dpa_signed:` populated.
- A2: Lawyer redlines applied to `/privacy` + `/terms`, comment block stamped.
- A3: Pentest report in `docs/security/`, P0 findings closed, P1+ on tracking table.
- B1: `incident-response.md` exists + tabletop run.
- B2: `dpia-discovery-engine.md` exists + cross-refs resolve + `FU-PROCUREMENT-PARENTAL-CONSENT-CAPTURE` filed in `security-plan.md` at P0.
- B3: `safeguarding-procedure.md` exists + tabletop run.
- B4: `disaster-recovery-plan.md` exists + first drill row in drill-log table + Q3 cadence reminder set.
- B5: `public/.well-known/security.txt` deployed + `/security` page deployed + `security@studioloom.org` forwarding verified + 12-month refresh reminder set.
- Track C: `security-plan.md` tracking table: P-13, P-14, P-15, P-16 marked DONE with date. `security-overview.md` §15 checklist updated. Doc-drift on Argon2id at `security-overview.md:136-138` (and in `access-model-v2.md:31,592` + `preflight-phase-7-brief.md:15`) fixed. CI grep guard at `fab/login/__tests__/route.test.ts:269-279` widened to scan all docs, not just CLAUDE.md. Historical engineering content (Phase numbers, ADR refs, migration timestamps) extracted from `security-overview.md` §2.1/§4.3/§6 to a new `docs/security/security-overview-engineering-history.md`, leaving the procurement-facing overview lean. P-11 (MFA route-level enforcement) annotated with the session-cookie-theft framing in its `security-plan.md` row, since dashboard-side MFA does not protect against stolen cookies — frame for the next time P-11 picks up.

---

## What this brief does NOT do

- No source code touched.
- No new migrations.
- No test counts to maintain.
- No registry updates beyond `vendors.yaml` (A1) + `security-plan.md` (closure).
- No worktrees — direct commits to `main`.
- No code-review skill needed — these are governance docs, not code.

---

## See also

- [`docs/security/security-overview.md`](../security/security-overview.md) — current state
- [`docs/security/security-plan.md`](../security/security-plan.md) — tracking table (where DONE marks land)
- [`docs/projects/security-closure-2026-05-09-brief.md`](security-closure-2026-05-09-brief.md) — sibling, code-level closure of the 9 May external review
- [`docs/build-methodology.md`](../build-methodology.md) — checkpoint discipline
- ICO Age Appropriate Design Code: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/
- ICO DPIA template: https://ico.org.uk/media/for-organisations/documents/2553993/dpia-template.docx
