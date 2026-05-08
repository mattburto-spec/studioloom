# StudioLoom Security Plan — Path to World-Class

> **Companion to:** [`security-overview.md`](security-overview.md) — this doc is forward-looking; that doc is the current-state audit.
>
> **Goal:** What schools and parents will recognise as a serious posture. Not "compliance theatre" — the actual controls that prevent the realistic threats: student PII leaking to AI providers, account compromise via XSS or stuffed credentials, mass data extraction via privilege escalation, observability tooling spilling PII to third parties.
>
> **Last updated:** 2026-05-09
> **Owner:** Matt
> **Review cadence:** monthly until shipped, then quarterly

---

## Threat model (one paragraph)

The realistic adversaries StudioLoom faces are not state-sponsored APTs. They are: (1) curious students attempting to read other students' work, escalate to teacher views, or evade the per-student budget; (2) malicious or careless teachers with legitimate access to one school but trying to read another; (3) a misconfigured vendor (Sentry, Anthropic, Voyage) accidentally retaining PII it should not; (4) a compromised teacher email account used for credential stuffing; (5) drive-by web exploitation (XSS, CSRF, clickjacking) of the React app surface; (6) a future regression where someone re-introduces a student name into an LLM prompt without going through `restoreStudentName`. Every plan item below maps to one of these.

---

## P0 — Block before pilot expansion (target: ≤14 days)

### P-1 · API-route role guards

**Status (2026-05-09):** PARTIAL — substantial progress shipped; long-tail follow-up filed as `FU-SEC-ROLE-GUARD-SWEEP`.

**Shipped:**
1. New helpers [`src/lib/auth/require-teacher.ts`](../../src/lib/auth/require-teacher.ts) + [`src/lib/auth/require-student.ts`](../../src/lib/auth/require-student.ts) — both check `app_metadata.user_type` and return 403 on wrong-role.
2. **Single-edit hardening of [`src/lib/auth/verify-teacher-unit.ts`](../../src/lib/auth/verify-teacher-unit.ts) `requireTeacherAuth()`** — added the `user_type === 'teacher'` check, which closes the gap for **59 routes** that already use this helper.
3. Direct migration of **13 highest-risk routes** onto `requireTeacher` (ai-settings, generate-unit, wizard-suggest/-autoconfig, lesson-editor/{suggest,ai-field}, knowledge/quick-modify, convert-lesson, timetable/parse-upload, labs, assessments, generate-timeline, regenerate-page).
4. **CI scanner** [`scripts/registry/scan-role-guards.py`](../../scripts/registry/scan-role-guards.py) emits [`docs/scanner-reports/role-guard-coverage.json`](../scanner-reports/role-guard-coverage.json). Current snapshot: 206 routes / 119 covered / 80 missing / 7 allowlisted with justification. Run with `--fail-on-missing` for CI mode.
5. Test mocks updated for the new role check (labs, me/scope, schools-api). Full test suite: 4931 passed / 11 skipped / 0 failed.

**Remaining (filed as `FU-SEC-ROLE-GUARD-SWEEP`, P1):** 80 routes still on bare `auth.getUser()` — mostly low-risk teacher-resource read routes (badges, schedule, tasks, activity-blocks, integrations, library, etc). Mechanical sweep: each takes ~2 min. Plan: do the next 20 highest-traffic ones in a follow-up session, then the rest.

---

**Original problem (preserved for archive).** [`middleware.ts`](../../middleware.ts) (Phase 6.3b, 4 May 2026) protects page routes (`/teacher/*`, `/dashboard`, `/unit`, `/open-studio`, `/discovery`) but its matcher does NOT cover `/api/*`. Of 336 API route files, 106 call `auth.getUser()` directly with only `if (!user) 401` — no `user_type === 'teacher'` check, no `can()` invocation, no `verifyTeacher*` helper. Sampled high-value routes that fail this:

- `POST /api/teacher/generate-unit` — expensive AI run, would charge wrong actor's tier
- `POST /api/teacher/wizard-suggest`
- `GET/POST /api/teacher/ai-settings` — returns + sets BYOK key
- `POST /api/teacher/labs`
- `POST /api/teacher/lesson-editor/{suggest,ai-field}`
- `POST /api/teacher/generate-timeline*`
- `POST /api/teacher/convert-lesson`
- `GET /api/teacher/library/*`
- `POST /api/teacher/safety/alerts/*`
- `POST /api/teacher/welcome/*`

A logged-in *student* JWT (acquired via classcode-login) can call any of these and the request will succeed. Real exploitation: a curious student exfiltrating their teacher's BYOK API key from `/api/teacher/ai-settings`.

**Fix.**
1. Build `requireTeacher(req)` analogous to existing `requireAdmin(req)` — checks `user.app_metadata.user_type === 'teacher'`, returns 403 otherwise.
2. Build `requireStudent(req)` for the same on student routes.
3. Replace bare `auth.getUser()` patterns across all flagged routes — sweep by directory: `/api/teacher/*`, `/api/admin/*` first; then `/api/student/*` mutation routes; then `/api/v1/*` mirrors.
4. Add a positive-deny CI scanner: any route file under `/api/teacher/*` that does not import from `@/lib/auth/require` fails the build.
5. Extend `middleware.ts` matcher to `/api/(teacher|admin|fab)/.*` with role-prefix enforcement as belt-and-braces.

**Effort.** 1–2 days. Single-developer task; no architectural change. The `can()` helper exists already; this is plumbing.

**Done when.** New CI gate `scan-api-routes.py --check-role-guards --fail-on-missing` returns 0 missing across the four prefix-namespaces. Manual smoke: student JWT → 403 on `/api/teacher/ai-settings`.

---

### P-2 · Sentry `beforeSend` PII filter (in code, not dashboard)

**Problem.** [`src/instrumentation.ts`](../../src/instrumentation.ts) and [`src/instrumentation-client.ts`](../../src/instrumentation-client.ts) only set `dsn / enabled / tracesSampleRate / replays*`. No `beforeSend`, no `beforeBreadcrumb`, no `denyUrls`, no `ignoreErrors`. PII scrubbing is documented as a manual Sentry-dashboard checklist ([`sentry-pii-scrub-procedure.md`](sentry-pii-scrub-procedure.md)) — single misconfigured toggle leaks every error report. ≥8 `Sentry.captureException` callsites mean every uncaught exception with a student object in scope can carry their data into Sentry.

**Fix.** Add a `beforeSend` redactor to both init files:

```ts
beforeSend(event, hint) {
  // Drop known PII keys from contexts + extra
  const sensitive = ['email', 'password', 'classcode', 'apiKey', 'sessionToken',
                     'displayName', 'firstName', 'lastName', 'fullName',
                     'authorization', 'cookie'];
  const scrub = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (sensitive.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        scrub(obj[key]);
      }
    }
    return obj;
  };
  event.contexts = scrub(event.contexts);
  event.extra = scrub(event.extra);
  event.user = event.user ? { id: event.user.id } : undefined;
  return event;
}
```

Plus `beforeBreadcrumb` to drop request body breadcrumbs. Smoke-test by triggering a known error path with a payload containing `{ email: 'test@x.com' }` and confirming the Sentry event has `[REDACTED]`.

**Effort.** 1–2 hours.

**Done when.** Both init files have `beforeSend`; smoke test with synthetic PII passes (event lands but every PII key is `[REDACTED]`); [`sentry-pii-scrub-procedure.md`](sentry-pii-scrub-procedure.md) updated to reflect "code is the primary defense; dashboard config is belt-and-braces".

---

### P-3 · Privatise the three legacy public buckets

**Problem.** `responses`, `unit-images`, `knowledge-media` use `getPublicUrl` and are public. Student photos in `responses` are URL-guessable — pattern is `{studentId}/{unitId}/{pageId}/{timestamp}.{ext}`. Anyone who knows or guesses a student UUID can iterate file names. This is a PII gap.

**Fix.**
1. Migrate buckets to private (Supabase Storage dashboard).
2. Add service-role RLS policies analogous to Preflight's pattern (mig 102).
3. Replace every `getPublicUrl` call with `createSignedUrl({ expiresIn: 3600 })` or shorter — render server-side in the page component, pass the signed URL to the client.
4. Wire URL signing into the existing thumbnail-cache layer where applicable.
5. For knowledge-media: signed URLs are fine for in-app rendering; if any external embed surface exists (e.g. teacher-shared library snippets), document the threat model and choose explicit-public or signed.

**Read sites to migrate** (from grep):
- [`src/app/api/student/upload/*`](../../src/app/api/student/upload/) (responses bucket)
- [`src/app/api/student/avatar/*`](../../src/app/api/student/avatar/)
- [`src/app/api/teacher/upload-unit-image/*`](../../src/app/api/teacher/upload-unit-image/)
- [`src/app/api/teacher/knowledge/media/*`](../../src/app/api/teacher/knowledge/media/)
- Any portfolio / gallery render path that embeds image URLs

**Effort.** 2–3 days (migration + ~10 read-site updates + visual smoke).

**Done when.** All three buckets show `public: false` in Supabase dashboard. `grep -r "getPublicUrl" src/` returns 0 results outside test fixtures. Existing student work renders correctly via signed URLs.

---

## P1 — Block before paying customers (target: ≤45 days)

### P-4 · Timetable upload PII scrub

**Problem.** [`teacher/timetable/parse-upload`](../../src/app/api/teacher/timetable/parse-upload/route.ts:77) sends entire teacher-uploaded timetable PDFs/images to Sonnet. School timetables routinely contain teacher names, room numbers, sometimes student names per class. The route blindly base64s the file. Not declared in [`vendors.yaml`](../vendors.yaml).

**Fix.** Two layers:
1. **Server-side OCR pre-pass** with name redaction before the Sonnet call. Use Tesseract or Claude Vision in a "extract structure only, mask names" first pass, then send the redacted output to the parser.
2. **UI warning at upload time:** "Timetable images are sent to our AI provider. If your timetable shows individual student names, redact or crop them before uploading."
3. Add `timetable_uploads` category to `vendors.yaml` Anthropic entry until pre-pass ships.

**Effort.** 0.5 day for warning + vendors.yaml; 1 day for OCR pre-pass.

**Done when.** Pre-pass smoke: upload a timetable with a real student name → verify the prompt sent to Anthropic has `[NAME]` in place of the name (log inspection on a dev key).

---

### P-5 · `vendors.yaml` Anthropic category drift

**Problem.** Audit found these student-data categories flow to Anthropic but are not declared in `vendors.yaml`:
- `students.learning_profile` (UDL accommodations, languages_at_home, learning_differences self-disclosures incl. anxiety/autism/ADHD/dyslexia)
- `quest_journeys.discovery_profile` + `contract` (strengths, interests, project narrative)
- Open Studio `discovery_conversation` turns
- Discovery Engine station outputs (irritation, archetype, fear cards, resources, self-efficacy)
- Student-uploaded images for moderation
- Whole timetable PDFs (until P-4 lands)

**Fix.** Update [`vendors.yaml`](../vendors.yaml) Anthropic entry. For each new category: `fields:` (specific column path), `basis:` (`coppa_art_6` or `legitimate_interest`), file:line proof in commit. Include the existing `restoreStudentName` redaction posture in `notes:` for the redacted paths.

**Effort.** 1 hour.

**Done when.** Every category an audit-agent lookup finds in `callAnthropicMessages` callsites is declared in `vendors.yaml`. Add a CI scanner that diffs declared vs grep'd categories; fail build on drift.

---

### P-6 · Dead-arg removal in grading pipeline

**Problem.** [`src/lib/grading/ai-prescore.ts:37`](../../src/lib/grading/ai-prescore.ts) `AiPrescoreInput` has a `studentDisplayName` field. JSDoc reads "Display name used to ground reasoning ('Maya wrote...')". The field is **passed in** by [`src/app/api/teacher/grading/tile-grades/ai-prescore/route.ts:228`](../../src/app/api/teacher/grading/tile-grades/ai-prescore/route.ts) but **not used in the prompt today**. Future change to "ground reasoning" silently turns this into a leak. Also: [`tools/report-writer/bulk:182`](../../src/app/api/tools/report-writer/bulk/route.ts) writes `batchStudent: student.firstName` into `metadata` (lands in `ai_usage_log`, doesn't reach Anthropic, but widens internal PII radius).

**Fix.**
1. Delete `studentDisplayName` from `AiPrescoreInput` and the calling route.
2. Drop `batchStudent` from bulk metadata, OR replace with a hash if needed for debugging.
3. Add a unit test: `grep` every `callAnthropicMessages` callsite body for `display_name | first_name | last_name | \.email | \.full_name` references → fail if any new ones surface without going through `restoreStudentName`.

**Effort.** 0.5 day.

**Done when.** Test added + green; both fields removed.

---

### P-7 · CSP + HSTS headers

**Problem.** [`next.config.ts`](../../next.config.ts) sets X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy — but no Content-Security-Policy, no Strict-Transport-Security. CSP missing means any XSS in the 240+ page bundle becomes full account takeover. HSTS missing on `studioloom.org` (Vercel adds it for `*.vercel.app` only) means a downgrade-to-HTTP attack works on first load.

**Fix.**
1. Start with `Content-Security-Policy-Report-Only` for two weeks: enumerate violations from real traffic via Sentry.
2. Tighten to enforced CSP. Baseline: `default-src 'self'; script-src 'self' 'unsafe-inline' https://*.vercel.app; img-src 'self' data: https://*.supabase.co https://*.studioloom.org; connect-src 'self' https://api.anthropic.com https://*.supabase.co; frame-ancestors 'none'`.
3. Add HSTS: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (then submit to hstspreload.org once stable for ≥6 months).
4. Tighten `unsafe-inline` to nonces over time (Next.js 15 supports this via middleware).

**Effort.** 1 day for report-only baseline + HSTS; 2-week soak; 1 day to enforce + nonce migration.

**Done when.** securityheaders.com grade A or A+ on `studioloom.org`. Sentry CSP-violation rate near zero on prod.

---

### P-8 · Distributed rate limiting

**Problem.** [`src/lib/rate-limit.ts`](../../src/lib/rate-limit.ts) is an in-memory `Map`. Per Vercel instance. Cold-start resets the bucket. Fine for burst, fails for sustained credential-stuffing across Vercel's auto-scaled instances.

**Fix.** Back with Upstash Redis or a Supabase counter table.
- Upstash Redis: lower latency, costs ~$10/mo at this scale, drop-in replacement
- Supabase counter table: free, slightly higher latency, has the audit benefit of a queryable rate-limit history

**Effort.** 1–2 days. Choose one; implement; verify by k6 / artillery.

**Done when.** Synthetic credential-stuffing test (1000 requests across 3 simulated Vercel instances) hits the rate limit at the same threshold a single instance would.

---

### P-9 · Rate-limit the unprotected auth surfaces

**Problem.** `accept-school-invitation` (token redemption) and `lti/launch` (LTI 1.3) are not wrapped in `rateLimit()`. School-invitation tokens are brute-forceable; LTI launch payloads can be replayed.

**Fix.** Wrap both routes in `rateLimit(\`invite:${ip}\`, 10, 60)` and `rateLimit(\`lti:${ip}\`, 30, 60)`. Add nonce check on LTI launch (per LTI 1.3 spec).

**Effort.** 0.5 day.

**Done when.** Both routes return 429 on synthetic abuse.

---

### P-10 · Doc drift refresh

**Problem.** [`src/app/api/student/quest/API-DOCS.md:177,223`](../../src/app/api/student/quest/API-DOCS.md) still says "tokens stored in `student_sessions`". That table was dropped in Phase 6.1 (4 May 2026). Misleads the next session builder.

**Fix.** Refresh the doc to describe the lazy-provision Supabase Auth flow.

**Effort.** 5 min.

**Done when.** Doc accurate.

---

## P2 — Block before second-school rollout (target: ≤90 days)

### P-11 · MFA route-level enforcement

**Problem.** [`mfa-procedure.md`](mfa-procedure.md) describes Supabase-dashboard-side enforcement only. Grep for `aal2` in `src/` returns nothing. No route-level gate on sensitive operations: impersonation, BYOK rotation, encryption-key rotation surfaces, school-admin actions.

**Fix.**
1. Read `aal` from session token in a `requireMFA()` helper.
2. Wrap sensitive routes: `/api/admin/school/[id]/impersonate/*`, `/api/admin/teachers/invite`, encryption-key surfaces.
3. UX: when `aal !== 'aal2'`, redirect to MFA enrolment / step-up prompt.

**Effort.** 1 day.

**Done when.** Smoke test: teacher without MFA → 403 on impersonate route, redirected to enrolment.

---

### P-12 · Encryption ciphertext versioning

**Problem.** [`src/lib/encryption.ts`](../../src/lib/encryption.ts) format is `iv:cipher:tag` — no key-version byte. Rotation procedure ([`encryption-key-rotation.md`](encryption-key-rotation.md)) requires dual-decrypt-during-cutover; without versioning, a partially-rotated table is indistinguishable from a fully-rotated one.

**Fix.** Prepend a 1-byte version: `v1:iv:cipher:tag`. Future rotation switches to `v2:` and decryptor selects key by prefix. Migrate existing rows lazy (decrypt → re-encrypt-with-version) on next read.

**Effort.** 0.5 day + a migration to lazy-update rows.

**Done when.** Every new encrypted column write has `v1:` prefix. Rotation script (run on synthetic data) successfully dual-decrypts v1 with old key and re-encrypts as v2.

---

### P-13 · Lawyer review of Privacy + Terms

**Problem.** [`/privacy`](../../src/app/privacy/page.tsx) and [`/terms`](../../src/app/terms/page.tsx) were Claude-drafted starter content. Sufficient for OAuth consent screens; not sufficient for paid school deployments. Tracked as `FU-LEGAL-LAWYER-REVIEW` in [`access-model-v2-followups.md`](../projects/access-model-v2-followups.md).

**Fix.** Find an Australian-qualified privacy lawyer (or jurisdiction-specific to the first paying school's region). Review:
- Governing law (currently NSW)
- Limitation of liability (currently 12 months of fees)
- Children's data section (COPPA / GDPR / PIPL / Privacy Act 1988 alignment)
- Sub-processor disclosure cadence
- AI features section (alignment with Anthropic DPA + school policies)
- Indemnity clause

**Effort.** ~$2-5K AUD; 2–3 weeks calendar time.

**Done when.** Versioned in repo with lawyer's name + date in a comment block at top of each page.

---

### P-14 · Anthropic ZDR addendum signature

**Problem.** [`vendors.yaml`](../vendors.yaml) Anthropic entry: `dpa_signed: null`. Anthropic offers a Zero Data Retention addendum that prevents the prompt + response from being retained for any purpose. Without this, prompt content is theoretically subject to Anthropic's standard 30-day retention policy.

**Fix.** Email Anthropic legal, request ZDR addendum, sign + counter-sign. Update `vendors.yaml` `dpa_signed: 2026-XX-XX`.

**Effort.** 1–2 weeks calendar time.

**Done when.** PDF in `docs/legal/` (gitignored or encrypted) + `vendors.yaml` updated.

---

### P-15 · Penetration test (light)

**Problem.** No external security review has happened. Solo developer + Claude code review is not a substitute for an outside set of eyes.

**Fix.** Engage a freelance pentester or security-review firm for a focused 3–5 day engagement. Scope:
- Auth flow (OAuth, classcode, Fabricator)
- Authorization (does role guard hold up?)
- API surface (spider routes, fuzz)
- LLM-prompt injection paths (can a student craft a prompt that exfiltrates teacher data via the Socratic mentor?)
- Storage bucket access patterns

**Effort.** $5–10K AUD; 1 week calendar time.

**Done when.** Report received, P0 findings closed, P1+ tracked in this file.

---

### P-16 · Incident response runbook

**Problem.** No documented IR playbook. If a breach happens at 2am, what does Matt do?

**Fix.** Write [`incident-response.md`](incident-response.md) covering:
- Detection (Sentry alert thresholds, Supabase audit log queries)
- Containment (revoke service-role keys, force-logout all sessions, freeze writes)
- Notification (school IT contacts, COPPA / GDPR / Privacy Act notification timelines)
- Forensics (audit log preservation, Supabase point-in-time recovery)
- Communication (parent comms templates per regime)
- Post-mortem template

**Effort.** 0.5 day.

**Done when.** Doc exists. Tabletop exercise: walk Matt through "Anthropic API key in Sentry public log" scenario, time to first containment action < 15 min.

---

## P3 — World-class polish (target: ≤180 days)

### P-17 · Per-school CSP nonces

Tighten CSP from `'unsafe-inline'` to per-request nonces via Next.js middleware. Eliminates the residual XSS pivot surface CSP currently leaves open.

### P-18 · WAF in front of Vercel

Cloudflare WAF in front of Vercel for DDoS / OWASP rule enforcement. Currently relying on Vercel + Turnstile only.

### P-19 · Audit-log query UI for school admins

Per-school audit log viewer (filter by date range, actor, action). Currently only platform-admin can query. Schools will want this for their own GDPR / FERPA requests.

### P-20 · SOC 2 Type I → Type II

Once StudioLoom has 2+ paying schools, pursue SOC 2 Type I (point-in-time) then Type II (over a 6-month window). Drata or Vanta to manage. ~$30K + ongoing operational discipline.

### P-21 · Bug bounty program

Open a HackerOne or Bugcrowd program. Once auth + storage gaps closed and pentest is clean, this becomes the long-tail defense.

### P-22 · Continuous LLM-prompt-injection testing

Add a test suite that fires known prompt-injection patterns at every student-facing endpoint and verifies they don't leak teacher data, system prompt content, or escape the Socratic mentor's persona. Tools: rebuff, garak, custom payloads from prompt-injection literature. CI weekly cadence.

### P-23 · Per-tenant key (CMK)

For premium-tier schools, allow customer-managed keys for column-level encryption. Schools that demand this are usually bringing their own KMS (AWS KMS or Azure Key Vault). Reduces blast radius if `ENCRYPTION_KEY` env is compromised.

### P-24 · Independent code review of `src/lib/ai/call.ts`

Pay a security-focused dev to do a deep review of the AI chokepoint specifically. It's the single highest-leverage file in the codebase — every Anthropic call passes through it. Bugs here are bugs everywhere.

---

## What "world-class secure with student info" looks like (the bar)

A reasonable EdTech CIO at a $50K/year contract should be able to:
1. Read [`security-overview.md`](security-overview.md) §15 and tick off every box without follow-up questions.
2. Receive an annotated PDF of the security plan + scanner reports + lawyer-vetted privacy and conclude: "this is more rigorous than what I see from companies 10× our size."
3. Run their own penetration test and find no P0 / P1 issues.
4. Trace any single piece of student data, end-to-end, through one document — what reaches what vendor, under what legal basis, with what redaction, retained for how long.
5. Receive an incident notification within the legally-mandated window with full forensic detail attached.

The current state delivers (1) for the rls/audit/encryption/DSR/AI-chokepoint surfaces. The plan above closes (2)–(5).

---

## Tracking table (live status)

| ID | Title | Severity | Effort | Status | Owner | Target |
|---|---|---|---|---|---|---|
| P-1 | API-route role guards | P0 | 1–2d | **PARTIAL — 2026-05-09** (helpers + 12 routes + helper-hardening + scanner; 80 long-tail routes follow-up `FU-SEC-ROLE-GUARD-SWEEP`) | matt | pre-pilot-expand |
| P-2 | Sentry beforeSend filter | P0 | 1–2h | **DONE — 2026-05-09** (`src/lib/security/sentry-pii-filter.ts` + 13 tests) | matt | — |
| P-3 | Privatise legacy buckets | P0 | 2–3d | TODO | matt | pre-pilot-expand |
| P-4 | Timetable PII scrub | P1 | 1d | TODO | matt | pre-paid |
| P-5 | vendors.yaml Anthropic drift | P1 | 1h | **DONE — 2026-05-09** (5 new categories declared with file:line refs) | matt | — |
| P-6 | Dead-arg removal + grep test | P1 | 0.5d | **DONE — 2026-05-09** (ai-prescore field removed, CI grep test at `src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts`) | matt | — |
| P-7 | CSP + HSTS | P1 | 2d split | TODO | matt | pre-paid |
| P-8 | Distributed rate limit | P1 | 1–2d | TODO | matt | pre-paid |
| P-9 | Rate-limit unprotected auth | P1 | 0.5d | TODO | matt | pre-paid |
| P-10 | Doc drift refresh | P1 | 5min | **DONE — 2026-05-09** (quest API-DOCS.md updated for Phase 6.1 lazy-provision) | matt | — |
| P-11 | MFA route-level enforcement | P2 | 1d | TODO | matt | pre-second-school |
| P-12 | Encryption versioning | P2 | 0.5d | TODO | matt | pre-second-school |
| P-13 | Lawyer review | P2 | $2–5K, 2–3wk | TODO | matt | pre-second-school |
| P-14 | Anthropic ZDR | P2 | 1–2wk | TODO | matt | pre-second-school |
| P-15 | Penetration test | P2 | $5–10K, 1wk | TODO | matt | pre-second-school |
| P-16 | Incident response runbook | P2 | 0.5d | TODO | matt | pre-second-school |
| P-17 | CSP nonces | P3 | 2d | TODO | matt | post-2-schools |
| P-18 | Cloudflare WAF | P3 | 1d | TODO | matt | post-2-schools |
| P-19 | Per-school audit-log UI | P3 | 3d | TODO | matt | post-2-schools |
| P-20 | SOC 2 | P3 | $30K+, 6+mo | TODO | matt | post-2-schools |
| P-21 | Bug bounty | P3 | ongoing | TODO | matt | post-pentest-clean |
| P-22 | LLM injection CI | P3 | 2d | TODO | matt | post-2-schools |
| P-23 | Per-tenant CMK | P3 | 5d | TODO | matt | premium-tier-ask |
| P-24 | External AI-chokepoint review | P3 | $1–2K | TODO | matt | post-2-schools |

Update on every `saveme` that touches a security item. Mark `IN PROGRESS` / `DONE` with date and PR link.

---

## See also

- [`security-overview.md`](security-overview.md) — current state audit
- [`vendors.yaml`](../vendors.yaml) — sub-processor registry
- [`access-model-v2-followups.md`](../projects/access-model-v2-followups.md) — related Access v2 follow-ups
- [`scanner-reports/`](../scanner-reports/) — live drift reports
