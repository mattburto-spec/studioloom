# StudioLoom Security Overview

> **Audience:** Anyone (Claude, Matt, future engineers, school IT, prospective customers) who needs to know what security posture StudioLoom has *today*.
>
> **Companion doc:** [`security-plan.md`](security-plan.md) — gap closure plan to reach world-class.
>
> **Last audited:** 2026-05-09 (post Access Model v2 PILOT-READY + first round of P0/P1 fixes shipped)
> **Audit scope:** PII flow to LLMs · RLS · auth/authz · storage · secrets · encryption · DSR · observability
> **Scanner status:** `rls-coverage` clean · `audit-coverage` clean · `ai-budget-coverage` clean · `role-guard-coverage` 119/206 covered / 80 drift / 7 allowlisted

---

## TL;DR

The architecture is sound. Access Model v2 (Phases 0–6, shipped 4 May 2026) gave StudioLoom a real foundation: RLS on 100% of tables, single AI egress chokepoint, immutable audit log, school-scoped tenancy, DSR endpoints, encrypted BYOK columns. The Phase 6.5 RLS deny-all audit + the Phase 5/6 audit-coverage CI gate killed two whole classes of drift.

**What is genuinely good:**
- Single AI chokepoint ([`src/lib/ai/call.ts`](../../src/lib/ai/call.ts) → `callAnthropicMessages`) — every Anthropic call goes through one file
- 100% RLS coverage on 123 tables ([`scanner-reports/rls-coverage.json`](../scanner-reports/rls-coverage.json))
- Audit-coverage CI gate enforces `logAuditEvent()` on every mutation route (0 missing)
- `student_sessions` table dropped — students lazy-provision via Supabase Auth (no more dual-auth bridge)
- Service-role keys never imported into client components (verified by grep)
- No hardcoded secrets in source
- Toolkit (28 tools) verified CLEAN — no student PII in prompts

**Shipped 2026-05-09 (first fix round):**
- ✅ **Sentry in-code PII filter** — [`src/lib/security/sentry-pii-filter.ts`](../../src/lib/security/sentry-pii-filter.ts) wired into both server + client init. 13 unit tests. (P-2 closed)
- ✅ **API role guards: 72 routes covered / 80 long-tail follow-up** — new helpers [`require-teacher.ts`](../../src/lib/auth/require-teacher.ts) + [`require-student.ts`](../../src/lib/auth/require-student.ts), single-edit hardening of existing `requireTeacherAuth` (closes 59 callsites at once), 13 highest-risk routes migrated directly. [`scan-role-guards.py`](../../scripts/registry/scan-role-guards.py) is the new CI scanner. (P-1 partial)
- ✅ **`vendors.yaml` Anthropic categories** — added `students.learning_profile`, quest discovery profile, Open Studio discovery profile, discovery station outputs, student moderation images, teacher document imagery (incl. timetables). (P-5 closed)
- ✅ **Dead PII surface in `ai-prescore`** — removed `studentDisplayName` arg + the `studentNames` Supabase query that fed it. New CI grep test [`no-pii-in-ai-prompts.test.ts`](../../src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts) scans every AI callsite for forbidden PII identifiers. (P-6 closed)
- ✅ **Quest API-DOCS.md doc drift** — refreshed for Phase 6.1 lazy-provision Supabase Auth flow. (P-10 closed)

**Still needs attention before pilot scaling:**
- **Three legacy storage buckets are public** (`responses`, `unit-images`, `knowledge-media`) — student photos in `responses` are URL-guessable. (P-3, deferred to dedicated session because of bucket migration + visual smoke risk)
- **`FU-SEC-ROLE-GUARD-SWEEP`** — 80 long-tail teacher routes still on bare auth pattern. Each one a mechanical 2-min edit. Risk-ranked low (mostly resource-read routes, not BYOK / AI-burning surfaces) but should drive coverage to 100%.
- **CSP + HSTS** missing (P-7), **distributed rate limit** (P-8), **timetable PII OCR pre-pass** (P-4).

Full gap list with severities: [`security-plan.md`](security-plan.md) §"Top 10 gaps".

---

## §1 — How student data reaches the LLM

The single concern most schools will ask about: *"do you send student names to AI?"* Answer in one sentence: **No — student names are placeholder-swapped before any Anthropic call, and no other student PII identifier (email, full name, DOB) is in any prompt.** Self-disclosed UDL/learning-style descriptors and student-authored text *do* go to Anthropic under COPPA art. 6 and parental consent.

### §1.1 — The chokepoint

[`src/lib/ai/call.ts:141`](../../src/lib/ai/call.ts) defines `callAnthropicMessages()`. Every AI call in production passes through it (Phase A complete, 8 May 2026 — 30+ call sites migrated). Forbidden in new code: `import Anthropic from "@anthropic-ai/sdk"; new Anthropic(...)`. The chokepoint:

- Centralises stop-reason handling (Lesson #39: max_tokens → `truncated`)
- Logs every call to `ai_usage_log` (per-student / per-teacher attribution)
- Wraps student calls in `withAIBudget()` for per-student token caps
- Resolves credentials in priority order: explicit `apiKey` → teacher BYOK → env var

This is the **single point** where any future redaction layer would mount — see [`security-plan.md`](security-plan.md) item P-2.

### §1.2 — Call site inventory (43 endpoints, all classified)

Every Anthropic-calling endpoint has been classified by what's in the prompt body:

| Class | What it sends | Endpoints | PII risk |
|---|---|---|---|
| **CLEAN** | Topic / framework / system metadata only | `teacher/wizard-suggest`, `teacher/wizard-autoconfig`, `teacher/lesson-editor/*`, `teacher/knowledge/quick-modify`, `student/word-lookup`, `lib/skills/ai-helpers/*`, `lib/pipeline/stages/*`, `lib/ai/quality-evaluator` | None |
| **REDACTED** | Student name → `"Student"` placeholder, restored client-side via `restoreStudentName()` | `tools/report-writer`, `tools/report-writer/bulk` | None — name never reaches Anthropic |
| **TEACHER-CONTENT** | Teacher-uploaded documents (PDF/DOCX/PPTX text + images) | `teacher/convert-lesson`, `lib/knowledge/{analyse, vision/pdf, vision/image}`, `lib/converter/extract-lesson-structure*`, `lib/ingestion/{pass-a, pass-b, moderate}` | None — teacher's own content |
| **STUDENT-TEXT** | Student-authored writing/voice (no name) | `design-assistant` (Socratic mentor), `student/quest/mentor`, `student/open-studio/{check-in, discovery}`, `tools/marking-comments`, `discovery/reflect`, `lib/grading/ai-prescore`, `lib/content-safety/server-moderation`, all 28 toolkit tools | Acceptable under COPPA art. 6 + parental consent. Listed in privacy disclosures. |
| **POTENTIAL LEAK** | Whole timetable PDF/image to Sonnet | `teacher/timetable/parse-upload` | School timetables can contain student names — see plan item P-4 |

Verified by code-level audit 9 May 2026. Full per-endpoint table in [`security-plan.md`](security-plan.md) Appendix A.

### §1.3 — What the redaction pattern looks like

Reference implementation: [`src/lib/tools/report-writer-prompt.ts`](../../src/lib/tools/report-writer-prompt.ts).

```ts
// 1. Caller substitutes name BEFORE building messages:
const STUDENT_NAME_PLACEHOLDER = "Student";
const promptInput = userInput.replace(realName, STUDENT_NAME_PLACEHOLDER);

// 2. callAnthropicMessages sends "Student" to Anthropic — name never leaves.

// 3. Response comes back with "Student"; restoreStudentName() restores
//    the real name client-side for display only:
export function restoreStudentName(text: string, realName: string): string {
  return text.replace(/\bStudent\b/g, realName);
}
```

Any future feature that wants to reason about a named student in prompts MUST follow this pattern. The architecture rule: the real name lives in the database and renders in the UI; it never appears in `messages[].content` sent to Anthropic.

### §1.4 — What students self-disclose that does flow

Not a leak, but worth being honest about for COPPA / DPA disclosures. The following student-authored fields reach Anthropic under explicit consent:

- `students.learning_profile` JSONB — UDL accommodations, languages_at_home, countries_lived_in, design_confidence, working_style, learning_differences (anxiety/autism/ADHD/dyslexia self-reports), accommodations, communication_preferences. Embedded in design-assistant + Open Studio prompts.
- `quest_journeys.discovery_profile` + `contract` — strengths, interests, project idea, who-it's-for.
- Open Studio discovery conversation turns.
- Discovery Engine station outputs (irritation free-text, archetype, fear cards, resources, self-efficacy, past project outcomes).
- All toolkit tool inputs (student ideation text — affinity diagrams, brainstorms, SCAMPER, etc.).
- Moderation pipeline: text + images uploaded by students go to Anthropic specifically *to be moderated*.

These categories are **not yet listed in [`vendors.yaml`](../vendors.yaml) Anthropic entry** — see plan item P-3.

### §1.5 — Voyage AI (embeddings)

Audited 9 May 2026. **No student-authored content is embedded.** Voyage `voyage-3.5` receives only:
- Teacher-uploaded knowledge content (titles, descriptions, chunks)
- Activity-block content (system-generated from generation pipeline)
- Activity-card metadata (teacher-curated)
- Query strings for retrieval

No student names. No student work. Listed correctly in `vendors.yaml`.

---

## §2 — Authentication

### §2.1 — Three auth domains, one canonical

Pre-Access-v2: students used custom token sessions (`student_sessions` table, validated via `validateStudentToken` middleware). Teachers used Supabase Auth. Fabricators used Argon2id session tokens.

Post-Phase-6.1 (May 2026): **students lazy-provision via Supabase Auth on first classcode-login**. `student_sessions` table DROPPED in prod (mig `20260503203440`). Every authenticated user — student, teacher, platform-admin — is now a Supabase Auth principal with `auth.uid()` working uniformly. Fabricators retain their separate Argon2id sessions (different threat model: shared lab workstations, no per-fab email).

### §2.2 — Wrong-role guard (Phase 6.3b)

[`middleware.ts`](../../middleware.ts) blocks page-route role mismatches:
- Student session → `/teacher/*` redirects to student dashboard
- Teacher session → `/dashboard` (student dashboard) redirects to `/teacher`

**Known gap:** matcher does NOT cover `/api/*` — see [`security-plan.md`](security-plan.md) item P-1.

### §2.3 — MFA

Documented in [`mfa-procedure.md`](mfa-procedure.md). Enforcement is currently **Supabase-dashboard-side only**:
- Platform admins, teachers: required (set in dashboard)
- Students: not required (classcode flow)
- Fabricators: not required (shared workstation Argon2id)

No in-app `aal2` checks on sensitive routes (impersonation, BYOK rotation, encryption-key surfaces). Gap tracked in plan.

### §2.4 — Encrypted column-level secrets

[`src/lib/encryption.ts`](../../src/lib/encryption.ts) — AES-256-GCM via `ENCRYPTION_KEY` env (32-byte hex). Format: `iv:cipher:tag` base64. Encrypted columns:
- `teachers.encrypted_api_key` (BYOK Anthropic keys)
- `teacher_integrations.encrypted_api_token`
- `teacher_integrations.lti_consumer_secret`
- View-as impersonation tokens ([`src/lib/auth/impersonation.ts`](../../src/lib/auth/impersonation.ts))

Rotation procedure in [`encryption-key-rotation.md`](encryption-key-rotation.md). Gap: no key-version tag in ciphertexts → rotation requires dual-decrypt-during-cutover.

---

## §3 — Authorization (the `can()` permission helper)

[`src/lib/access-v2/can.ts`](../../src/lib/access-v2/can.ts) — central permission helper. 3-way scope lookup:
- `has_class_role(class_id, role?)` — class-level via `class_members` table
- `has_student_mentorship(student_id, programme?)` — per-student mentor relationships
- `has_school_responsibility(school_id, type?)` — school-level coordinator roles

Class-level roles in `class_members.role` enum: `lead_teacher | co_teacher | dept_head | mentor | lab_tech | observer`.

School-level membership is **flat** — every teacher with `school_id = X` is a full member of school X. Two-tier governance for high-stakes changes (low-stakes instant + 7-day revert; high-stakes 48h two-teacher confirm). No designated school-admin role.

Platform admin (Matt) is separate: `is_platform_admin` flag on `auth.users` gates the super-admin view at `/admin/school/[id]`.

**Coverage gap (P0):** `can()` exists but `/api/teacher/*` routes mostly do not use it — see plan item P-1.

---

## §4 — Database security (RLS)

### §4.1 — Coverage

[`scanner-reports/rls-coverage.json`](../scanner-reports/rls-coverage.json) (last scan 2026-05-08):
- `total_tables: 123`
- `rls_enabled: 123` (100%)
- `with_policies: 118`
- `intentional_deny_all: 5` (documented in [`rls-deny-all.md`](rls-deny-all.md))
- `no_rls_count: 0`
- `rls_no_policy_count: 0` (drift)
- `status: clean`

Scanner runs in CI; any drift fails the build.

### §4.2 — The 5 deny-all-by-design tables

`admin_audit_log`, `ai_model_config`, `ai_model_config_history`, `fabricator_sessions`, `teacher_access_requests`. Service-role-only access. Full rationale + writer/reader paths in [`rls-deny-all.md`](rls-deny-all.md).

### §4.3 — The school-scoped pattern

`current_teacher_school_id()` SECURITY DEFINER helper (Phase 8, 28 Apr 2026) is the canonical school-scoping primitive used in RLS policies. Validated in prod across 3 NIS Matt personas. Pattern:

```sql
CREATE POLICY "teacher reads same-school" ON some_table
  FOR SELECT TO authenticated
  USING (school_id = current_teacher_school_id());
```

Every school-scoped table (`teachers`, `classes`, `students`, `units`, `machine_profiles`, `fabricators`, `fabrication_labs`) has `school_id NOT NULL` post-Access-v2 Phase 0 backfill.

---

## §5 — Storage buckets

| Bucket | Privacy | Writers | Readers | URL strategy | Notes |
|---|---|---|---|---|---|
| `fabrication-uploads` | private | service-role | service-role | signed PUT/GET (TTL) | Preflight student uploads |
| `fabrication-thumbnails` | private | service-role | service-role | signed GET (`THUMBNAIL_URL_TTL_SECONDS`) | Preflight thumbnails |
| `fabrication-pickup` | private | service-role | service-role | signed GET | Preflight pickup files |
| `bug-report-screenshots` | private | service-role | service-role | signed GET | Bug reports |
| `responses` | **PUBLIC** | service-role | anyone with URL | **public URL** | Student photos / avatars — **gap, see plan P-5** |
| `unit-images` | **PUBLIC** | service-role | anyone with URL | public URL | Unit thumbnails |
| `knowledge-media` | **PUBLIC** | service-role | anyone with URL | public URL | Teacher knowledge media |

Preflight buckets follow the right pattern. The three legacy public buckets are a **P0 gap** — student photos in `responses` are URL-guessable (`{studentId}/{unitId}/{pageId}/{timestamp}.{ext}`).

---

## §6 — Audit log

ADR-012 — `audit_events` table (immutable, append-only, RLS per actor). `logAuditEvent()` wrapper called from every `/api/teacher/*`, `/api/admin/*`, and state-mutating `/api/student/*` route.

CI gate: `scripts/registry/scan-api-routes.py --check-audit-coverage --fail-on-missing` — every POST/PATCH/DELETE/PUT route must call `logAuditEvent()` or carry an explicit `audit-skip:` annotation. Current state ([`scanner-reports/audit-coverage.json`](../scanner-reports/audit-coverage.json)): `missing: 0`, `covered: 7`, `skipped: 231` (each annotated). Skipped routes are dominated by routine teacher pedagogy ops, learner activity, and public anonymous free-tool calls — deliberate posture.

Admin audit-log read surface: `/api/admin/audit-log` (platform-admin only).

Read this code before changing audit semantics:
- ADR-012 in `docs/adr/`
- Audit wrapper: `src/lib/audit/log-event.ts`
- Coverage scanner: `scripts/registry/scan-api-routes.py`

---

## §7 — Per-student AI budget

[`src/lib/access-v2/ai-budget/middleware.ts`](../../src/lib/access-v2/ai-budget/middleware.ts) — `withAIBudget()` enforces per-student token caps. Cascade resolution order (topmost wins):
1. Subscription tier default (`schools.subscription_tier`: `pilot | free | starter | pro | school` → `50k | 50k | 75k | 100k | 200k`)
2. School override
3. Class override
4. Student override

CI gate via `scan-api-routes.py --check-budget-coverage --fail-on-missing` — every student-attributed AI route must be wrapped. Current state: 3 routes (`student/design-assistant`, `student/quest/mentor`, `student/word-lookup`), all covered.

When budget exceeded, `callAnthropicMessages` returns `{ ok: false, reason: "over_cap", cap, used, resetAt }` → routes return HTTP 429 with reset hint.

---

## §8 — Data subject rights (DSR)

Per Access Model v2 Phase 5/6:
- **`GET /api/v1/student/[id]/export`** — FERPA / GDPR / PIPL data export. Auth: `isPlatformAdmin OR verifyTeacherCanManageStudent`. Emits `student.data_export.requested` audit event.
- **`DELETE /api/v1/student/[id]`** — soft-delete via `softDeleteStudent` lib helper. Audit row emitted inside helper.
- **Admin deletion surface:** `/admin/deletions` (platform-admin only).
- **Scheduled deletions:** `scheduled_deletions` table + retention cron (per `docs/security/student-data-export-runbook.md`).

Consent withdrawal currently bundled into soft-delete flow (per Access v2 §5). Discrete endpoint deferred — see plan.

---

## §9 — Vendor / sub-processor data flows

[`vendors.yaml`](../vendors.yaml) — 9 declared vendors. Highlights:

| Vendor | Role | Region | DPA | Student data | Cert |
|---|---|---|---|---|---|
| **Anthropic** | LLM (Claude) | US | **pending** (ZDR addendum offered) | yes | SOC2 Type II |
| Supabase | DB + Auth + Storage | US | signed | yes | SOC2 Type II |
| Voyage AI | Embeddings | US | TBD | no (no student content embedded) | — |
| Resend | Transactional email | US | TBD | yes (parent comms) | — |
| Vercel | Hosting | global edge | signed | yes (request logs) | SOC2 Type II |
| Cloudflare Turnstile | Bot challenge | global | signed | no (IP only) | — |
| Sentry | Error monitoring | US | signed | **see §10 — PII risk** | SOC2 Type II |

**Drift discovered 9 May 2026:** Anthropic entry undersells what's flowing. New categories to add (see plan P-3): `students.learning_profile`, quest discovery profile, Open Studio discovery profile, discovery station outputs, student-uploaded images for moderation.

Quarterly review cadence — next: 2026-07-14.

---

## §10 — Observability & error monitoring

### §10.1 — Sentry

Init files: [`src/instrumentation.ts`](../../src/instrumentation.ts) (server) + [`src/instrumentation-client.ts`](../../src/instrumentation-client.ts).

**P-2 closed 2026-05-09.** Both init files now wire [`src/lib/security/sentry-pii-filter.ts`](../../src/lib/security/sentry-pii-filter.ts) as `beforeSend` + `beforeBreadcrumb`. The filter:

- Redacts known-sensitive keys (`email`, `password`, `classcode`, `apiKey`, `displayName`, `firstName`, `lastName`, `studentName`, `phone`, `ssn`, `dob`, `cookie`, `token`, `session`, etc.) from `event.contexts`, `event.extra`, `event.tags`, `event.request.data`.
- Strips `event.user` to `id` only (never sends `email` / `username`).
- Wipes `event.request.cookies` entirely.
- Redacts query strings on URLs (both `event.request.query_string` and breadcrumb fetch URLs).
- Drops fetch/xhr request body sizes from breadcrumbs.

13 unit tests at [`__tests__/sentry-pii-filter.test.ts`](../../src/lib/security/__tests__/sentry-pii-filter.test.ts) cover: redaction across naming conventions, nested objects, arrays, circular references, primitives, request scrubbing, breadcrumb scrubbing.

Defence-in-depth: dashboard-side scrubbing per [`sentry-pii-scrub-procedure.md`](sentry-pii-scrub-procedure.md) is still recommended as belt-and-braces.

### §10.2 — Usage logging (`ai_usage_log`)

Every Anthropic call writes a row: `endpoint`, `model`, `inputTokens`, `outputTokens`, `userId | studentId`, `metadata`. Drives `/admin/ai-budget` breakdown and the (forthcoming) `/admin/cost-usage` view.

**Minor finding:** some toolkit metadata writes include teacher email or `firstName` from bulk operations. Doesn't reach Anthropic, but widens internal PII surface. Plan item P-6.

---

## §11 — Network / transport

| Layer | Status |
|---|---|
| TLS 1.3 (Vercel + Supabase) | ✅ enforced |
| `Cache-Control: private, no-cache, no-store, must-revalidate` on auth/student/admin/fab routes | ✅ ([`next.config.ts`](../../next.config.ts)) |
| `X-Frame-Options: DENY` | ✅ |
| `X-Content-Type-Options: nosniff` | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | ✅ |
| **Content-Security-Policy** | ❌ MISSING |
| **Strict-Transport-Security (HSTS)** | ❌ MISSING |

CSP + HSTS = plan item P-7.

---

## §12 — Rate limiting

[`src/lib/rate-limit.ts`](../../src/lib/rate-limit.ts) — in-memory `Map` (per Vercel instance). 26 routes wrapped including all `/api/student/*`, all `/api/fab/*` auth, free-tool routes, classcode login.

**Gaps:**
- `accept-school-invitation` and `lti/launch` are unrate-limited (token brute-force surface)
- In-memory only → cold-start resets, doesn't cluster across instances

Plan items P-8 + P-9.

---

## §13 — Compliance posture

| Regime | Status | Notes |
|---|---|---|
| **COPPA** (US) | working | `coppa_art_6` legal basis declared per category; parental consent is the control point. Pre-pilot. |
| **GDPR** (EU) | working | DSR endpoints live; vendor DPAs partly signed; lawyer review pending ([`access-model-v2-followups.md FU-LEGAL-LAWYER-REVIEW`](../projects/access-model-v2-followups.md)) |
| **Privacy Act 1988** (AU) | working | Governing law set NSW; Privacy Officer = Matt; lawyer review pending |
| **PIPL** (China) | working | Data lives in US Supabase / US Anthropic — no PIPL-resident processing. NIS pilot is acceptable; expansion into mainland-resident data needs review. |
| **FERPA** (US) | working | Export endpoint exists; school-as-data-controller posture documented |
| **SOC 2 Type II** | not pursued | Sub-processors are SOC2 (Anthropic, Supabase, Vercel, Sentry); StudioLoom itself is single-developer pre-revenue |
| **ISO 27001** | not pursued | Same as SOC 2 |

Pre-customer state. Lawyer-vetted privacy + terms is the next gate ([`access-model-v2-followups.md FU-LEGAL-LAWYER-REVIEW`](../projects/access-model-v2-followups.md), P2).

---

## §14 — Operational runbooks

Living documents in this directory:

| Doc | Purpose |
|---|---|
| [`rls-deny-all.md`](rls-deny-all.md) | The 5 service-role-only tables — quarterly review checklist |
| [`mfa-procedure.md`](mfa-procedure.md) | MFA enrolment + recovery procedure |
| [`encryption-key-rotation.md`](encryption-key-rotation.md) | `ENCRYPTION_KEY` rotation procedure (BYOK + impersonation) |
| [`sentry-pii-scrub-procedure.md`](sentry-pii-scrub-procedure.md) | Manual Sentry-dashboard PII scrub config (until P-2 lands) |
| [`student-data-export-runbook.md`](student-data-export-runbook.md) | DSR export procedure |
| [`student-auth-cookie-grace-period.md`](student-auth-cookie-grace-period.md) | Phase 6.1 cutover compatibility |
| [`cost-alert-fire-drill.md`](cost-alert-fire-drill.md) | Cost-alert response runbook |
| [`multi-matt-audit-query.md`](multi-matt-audit-query.md) | Multi-Matt-row prod investigation |

---

## §15 — Security feature checklist (for sales / school IT)

Use this when a school CIO asks "what security do you have?".

### Identity & access
- ✅ Supabase Auth (SOC2 Type II) for all user roles
- ✅ Microsoft 365 + Google OAuth (school-tenant)
- ✅ MFA enforced for teachers + platform admins (dashboard-side)
- ✅ Wrong-role middleware guard on page routes
- ✅ Class-level RBAC (`class_members.role`: lead_teacher / co_teacher / dept_head / mentor / lab_tech / observer)
- ✅ School-scoped tenancy (every row has `school_id NOT NULL`)
- ✅ Per-student AI budget caps with subscription-tier cascade
- ✅ API-route role guards on 72 high-risk routes via `requireTeacher` / hardened `requireTeacherAuth` (incl. all BYOK + AI-budget-burning surfaces); CI scanner at `scripts/registry/scan-role-guards.py`
- ⚠️ 80 long-tail API routes still on bare-auth pattern — `FU-SEC-ROLE-GUARD-SWEEP`

### Data protection
- ✅ TLS 1.3 in transit (Vercel + Supabase enforced)
- ✅ AES-256-GCM at-rest for BYOK API keys + impersonation tokens
- ✅ Supabase Postgres at-rest encryption (AWS KMS)
- ✅ 100% RLS coverage (123/123 tables) with CI drift gate
- ✅ Service-role keys never imported into client components
- ✅ Audit-coverage CI gate (every mutation route logs to `audit_events`)
- ⚠️ Three legacy storage buckets are public (P0 — see plan)
- ⚠️ No CSP / HSTS headers (P1)

### AI privacy
- ✅ Single AI egress chokepoint ([`src/lib/ai/call.ts`](../../src/lib/ai/call.ts))
- ✅ Student names placeholder-swapped before LLM send (`restoreStudentName` pattern)
- ✅ No student PII identifiers (email, full name, DOB) in any LLM prompt
- ✅ No student content sent to Voyage AI embeddings
- ✅ Per-student token budgets prevent runaway cost / abuse
- ✅ CI grep test enforces no PII identifiers in AI callsite files ([`no-pii-in-ai-prompts.test.ts`](../../src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts))
- ✅ `vendors.yaml` Anthropic entry declares all 8 data categories with file:line proof

### Compliance
- ✅ DSR export + soft-delete endpoints (FERPA / GDPR / PIPL)
- ✅ Vendor / sub-processor registry with quarterly review
- ✅ Data classification taxonomy applied to all 72 tables
- ✅ Immutable audit log (ADR-012, append-only `audit_events`)
- ⚠️ DPAs partly signed (Anthropic ZDR pending — P2)
- ⚠️ Privacy + Terms lawyer review pending (P2)

### Observability
- ✅ Per-call `ai_usage_log` attribution
- ✅ Sentry error monitoring
- ✅ Sentry in-code `beforeSend` PII redactor + `beforeBreadcrumb` filter (defense-in-depth alongside dashboard config)

---

## §16 — When to update this doc

- Quarterly minimum (next: 2026-08-09)
- After any new vendor integration → §9 + `vendors.yaml`
- After any RLS scanner drift → §4
- After any new AI call site → §1.2 (re-run the audit)
- After any auth or middleware change → §2
- When closing a plan item → mark ✅ in §15 + cross-link
- When a new sub-processor receives student data → cross-check `vendors.yaml`

---

## See also

- [`security-plan.md`](security-plan.md) — gap closure plan to world-class
- [`vendors.yaml`](../vendors.yaml) — sub-processor registry
- [`feature-flags.yaml`](../feature-flags.yaml) — secrets registry
- [`schema-registry.yaml`](../schema-registry.yaml) — table classifications
- [`projects/access-model-v2.md`](../projects/access-model-v2.md) — architectural foundation
- [`projects/access-model-v2-phase-6-checkpoint-a7.md`](../projects/access-model-v2-phase-6-checkpoint-a7.md) — A7 PILOT-READY checkpoint
- [`scanner-reports/`](../scanner-reports/) — live drift reports
