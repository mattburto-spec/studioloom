# Governance Systems Build Plan

**Status:** Proposed (14 Apr 2026)
**Purpose:** Build the management/governance infrastructure that best-in-class LMSs have but StudioLoom currently lacks. Gate: multi-school deployment.
**Owner:** Matt (solo dev)
**Related:** `dimensions3-completion-spec.md` (runs in parallel), `dimensions3-followups.md` (FU-N..Y)

---

## Why this doc exists

StudioLoom has a strong operational spine (WIRING, schema-registry, api-registry, ai-call-sites, doc-manifest, decisions-log, lessons-learned). But it is missing the **governance layer** — the systems schools, districts, and DPOs expect before they sign a purchase order:

- No PII / data-classification map → DPOs block procurement
- No data-subject-request (DSR) runbook → GDPR/COPPA/FERPA non-compliant
- No audit log → no forensics, no "who edited this student's grade"
- No feature-flag registry → staged rollouts are ad-hoc
- No impersonation / support-view → can't triage teacher bug reports
- No vendor/DPA registry → procurement can't verify sub-processors
- No incident response playbook → first outage is chaos

These gaps block scale beyond Matt's own classroom. They don't block another six months of prototype iteration — but they do block paying school #1.

This doc plans the full set in **five phases**, grouped by when they become load-bearing. Phase GOV-1 is 1–2 days and I recommend slotting it alongside Dimensions3 Phase 7. The rest can wait until Dimensions3 closes.

---

## Inventory: what we already have

Solid:

- **WIRING.yaml** — 82 systems with deps, affects, change_impacts
- **schema-registry.yaml** — 69 tables with columns, RLS, writers, readers, spec_drift
- **api-registry.yaml** — 266 routes with auth, tables, AI call sites
- **ai-call-sites.yaml** — 47 LLM calls with model, max_tokens, stop_reason, fallbacks
- **doc-manifest.yaml** — 217 docs with freshness dates
- **changelog.md** — session-level change log
- **decisions-log.md** — 182 decisions since Mar 2026
- **lessons-learned.md** — 31 hard-won lessons
- **ALL-PROJECTS.md** — canonical project tracker
- **system-architecture-map.html** — per-system v1–v5 maturity
- **ADRs 001–010** — cross-product architecture decisions (`../Loominary/docs/adr/`)
- **test-coverage-map.md** — partial

Partial / adjacent:

- **Teaching Moves Library** — curated patterns (~65)
- **AI Brain docs** — 17 docs defining how AI thinks
- **FrameworkAdapter** — partial standards coverage matrix
- **Integrity monitoring** — partial academic integrity log
- **admin_settings** (migration 077) — seed of a feature-flag system

---

## Gap summary

| # | System | Current state | Priority | Phase |
|---|---|---|---|---|
| 1 | Data-classification registry | None | P1 | GOV-1 |
| 2 | Feature-flag registry | Seed (admin_settings) | P1 | GOV-1 |
| 3 | Vendor / DPA registry | None | P1 | GOV-1 |
| 4 | Audit log | None (FU-W filed) | P0 | GOV-2 |
| 5 | Access Model v2 | None (FU-O/P/R filed) | P0 | GOV-2 |
| 6 | Impersonation / support-view | None | P1 | GOV-2 |
| 7 | DSR runbook (export + delete) | None | P1 | GOV-2 |
| 8 | Error tracking (Sentry) | Vercel logs only | P1 | GOV-3 |
| 9 | Incident response playbook | None | P1 | GOV-3 |
| 10 | Migration rollback procedure | Ad-hoc | P2 | GOV-3 |
| 11 | Backup / restore runbook (tested) | Supabase PITR, untested | P2 | GOV-3 |
| 12 | Release / deployment log | Vercel only | P2 | GOV-3 |
| 13 | Accessibility conformance log | None | P2 | GOV-4 |
| 14 | User-research registry | None | P2 | GOV-4 |
| 15 | A/B test / experiment registry | None | P2 | GOV-4 |
| 16 | SLA definitions | None | P3 | GOV-5 |
| 17 | Parent communication log | None | P3 | GOV-5 |
| 18 | Standards coverage matrix | Partial (FrameworkAdapter) | P3 | GOV-5 |

---

## Phase GOV-1 — Pre-deployment foundation (1–2 days)

**Trigger:** Ship before or during Phase 7B. All three are cheap, all three unblock downstream work.

### 1. Data-classification registry

**Purpose:** For every column in every table, classify its sensitivity. Answers "is this PII? student voice? safety-sensitive? exportable to Anthropic? what's the retention period?"

**Shape:** Extend `schema-registry.yaml` with a `classification` block per column:

```yaml
- name: student_responses
  columns:
    - name: student_id
      type: uuid
      classification:
        pii: true
        student_voice: false
        safety_sensitive: false
        ai_exportable: hash_only     # none | hash_only | full
        retention_days: 2555          # 7 years
        basis: coppa_art_6
    - name: response_text
      type: text
      classification:
        pii: false
        student_voice: true
        safety_sensitive: true
        ai_exportable: full
        retention_days: 2555
        basis: legitimate_interest
```

**Values:**
- `pii`: bool — identifies an individual (name, email, photo, voice clip)
- `student_voice`: bool — authored by a minor (triggers COPPA/GDPR-K extra protection)
- `safety_sensitive`: bool — self-disclosure, safeguarding relevance
- `ai_exportable`: `none | hash_only | full` — can this column be sent to Anthropic/Voyage in prompts?
- `retention_days`: int | `indefinite` — max retention period
- `basis`: one of `consent | contract | legitimate_interest | legal_obligation | coppa_art_6 | ferpa_directory | ferpa_educational`

**Integration:**
- Extends existing schema-registry.yaml (additive, no new file)
- Saveme step 11(a) already covers it — bump the manual update prompt to include classification review
- New CI check (later): any migration that adds a column without classification → fail
- Feeds DSR runbook (GOV-2) — export/delete queries read this

**Effort:** 4–6 hours. Walk all 69 tables, classify ~500 columns. Most columns are `none/none/none/full/indefinite` (non-PII metadata). The 10-ish PII tables (users, teacher_profiles, students, student_responses, conversations, portfolios, moderation_reports) need real thought.

**Why now:** Once we hit 100+ tables this is a week of work. 69 tables is half a day.

---

### 2. Feature-flag registry

**Purpose:** Central registry of every operational flag, its default, who can toggle, and its blast radius. Admin Controls tab (7I) becomes a renderer over this.

**Shape:** New file `docs/feature-flags.yaml`:

```yaml
- key: pipeline.stage_enabled
  type: object          # object | bool | number | string | json
  default: {pass_0: true, pass_a: true, pass_b: true}
  description: Per-stage enable switch for Dimensions3 ingestion pipeline
  toggler: admin        # admin | service_role | env
  blast_radius: global  # global | per_teacher | per_class | per_user
  source: admin_settings
  shipped: 2026-04-14
  migration: 077
  owner: matt

- key: cost_ceiling_per_run_usd
  type: number
  default: 5.00
  description: Hard cap per generation run — reject beyond this
  toggler: admin
  blast_radius: global
  source: admin_settings
  shipped: 2026-04-14
  migration: 077
  owner: matt

- key: bug_reporting_enabled
  type: bool
  default: false
  description: Per-class toggle; teachers opt students in
  toggler: teacher
  blast_radius: per_class
  source: classes.bug_reporting_enabled
  shipped: 2026-04-14
  migration: 076
  owner: matt
```

**Integration:**
- Saveme step: new sub-step in 11(d) — when adding a flag, append to feature-flags.yaml
- Admin Controls tab (Phase 7I) reads this YAML at build time to render the UI
- Future: runtime bridge so admin toggles in `admin_settings` emit audit entries

**Effort:** 2 hours. Seed with the 5 rows from migration 077 + `bug_reporting_enabled` + the handful of NEXT_PUBLIC_* env flags.

**Why now:** Before 7I's Admin Controls tab gets built. Saves scope there.

---

### 3. Vendor / DPA registry

**Purpose:** Every third-party sub-processor that touches user data, what data, under what contract. School procurement asks for this by name.

**Shape:** New file `docs/vendors.yaml`:

```yaml
- name: Anthropic
  role: LLM provider
  data_sent:
    - category: student_voice
      fields: [conversations.messages, student_responses.response_text]
      basis: legitimate_interest
    - category: teacher_content
      fields: [units.*, lessons.*, knowledge_uploads.*]
      basis: contract
  retention: 30_days_per_anthropic_policy
  dpa_url: https://www.anthropic.com/legal/dpa
  dpa_signed: null                # TODO — need to sign enterprise DPA
  region: us
  subprocessors: [aws]
  notes: Covered by Zero Data Retention addendum once signed

- name: Supabase
  role: Database + auth + storage
  data_sent: all_tables
  retention: indefinite_user_controlled
  dpa_url: https://supabase.com/legal/dpa
  dpa_signed: 2026-04-14
  region: eu-central-1
  subprocessors: [aws, cloudflare, stripe]

- name: Voyage AI
  role: Embeddings
  data_sent:
    - category: teacher_content
      fields: [knowledge_uploads.content, activity_blocks.text]
  retention: 0_days
  dpa_url: TODO
  dpa_signed: null
  region: us

- name: Vercel
  role: Hosting + edge compute + logs
  data_sent: all_request_bodies_transiently
  retention: 30_days_logs
  dpa_url: https://vercel.com/legal/dpa
  dpa_signed: 2026-03-01
  region: multi
```

**Integration:**
- New entry in doc-manifest.yaml
- Referenced from privacy policy (once written)
- Referenced from DSR runbook (GOV-2) — must notify sub-processors on delete

**Effort:** 2 hours. 9 vendors today (2026-04-14 audit): anthropic, supabase, voyage, vercel, groq, gemini, resend, sentry, elevenlabs.

**Why now:** Zero code change. Unblocks conversations with any interested school.

---

### 4. Admin read-only panel + scanner infrastructure (GOV-1.4)

**Purpose:** Close the governance loop with live drift detection. Schools can't audit what they can't see — this phase adds the tooling that keeps the registries honest over time.

**Scope (9 files):**
- 2 new scanners (`scan-feature-flags.py`, `scan-vendors.py`) — read-only JSON drift reports
- `change-triggers.yaml` — codifies which registries must update when code changes
- `doc-manifest.yaml` schema bump — `max_age_days` + `last_scanned` per entry
- `version: 1` field on all 5 registry YAMLs
- CLAUDE.md registries block expansion (4→6 registries + taxonomies, saveme step 11 d/e/f)
- WIRING system entry: `governance-registries`
- Admin registries page (`/admin/controls/registries`) — staleness chips, scanner drift summaries
- Quarterly scheduled task — self-silencing staleness check

**Shape:**
- Scanner JSON: `{ registry, timestamp, version, drift: { orphaned, missing }, status }`
- Change triggers: 6 entries mapping code patterns to required registry updates
- Admin page: 9 cards with GREEN/AMBER/RED chips based on `(now - last_verified) / max_age_days`

**Integration:**
- saveme step 11 expanded from (a/b/c) to (a/b/c/d/e/f)
- CLAUDE.md registries block references all 6 registries + 3 taxonomies + change-triggers
- Quarterly cron notifies Matt only when staleness or drift is found

**Effort:** ~6 hours.

**Why now:** Registries without drift detection decay silently. This closes the feedback loop while GOV-1 knowledge is fresh.

---

**GOV-1 Total:** ~14–16 hours = 2 days.
**Recommended insertion:** Between Phase 7A and 7B, OR parallel to 7B (Claude-Code-friendly since they're all YAML).

---

## Phase GOV-2 — Multi-school enablement (5–7 days)

**Trigger:** Before onboarding school #1 (beyond Matt's classroom).

### 4. Audit log (FU-W)

**Purpose:** Who did what when. Non-negotiable for school/district procurement.

**Shape:** New table `audit_log`:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,                    -- user, teacher, or service
  actor_role TEXT NOT NULL,         -- teacher | student | admin | service_role | anonymous
  impersonated_by UUID,             -- if support/admin acting as actor_id
  action TEXT NOT NULL,             -- create | update | delete | read_sensitive | login | export | moderate
  target_table TEXT,
  target_id UUID,
  class_id UUID,                    -- for scoping / RLS
  meta JSONB,                       -- diff, reason, ip hash, etc.
  severity TEXT NOT NULL DEFAULT 'info'  -- info | warn | critical
);
CREATE INDEX ON audit_log (created_at DESC);
CREATE INDEX ON audit_log (actor_id, created_at DESC);
CREATE INDEX ON audit_log (target_table, target_id);
CREATE INDEX ON audit_log (class_id, created_at DESC);
```

**Wiring:**
- New `logAudit()` helper in `src/lib/audit/log.ts`
- Instrument: every `update` / `delete` in API routes touching PII, grades, safety reports, moderation actions
- Do NOT instrument: read traffic (too noisy) — except `read_sensitive` for rubrics/moderation
- RLS: actor can read own rows; admins read all

**Admin view:** Phase 7I gets a new "Audit Log" sub-tab with filters (actor, action, date, class).

**Effort:** ~2 days. Migration (1h), helper (1h), instrumentation of ~20 critical sites (4h), admin UI (6h), tests (4h).

---

### 5. Access Model v2 (FU-O/P/R)

**Purpose:** Co-teacher, department head, school admin, and school/org entity. Currently every teacher is a solo owner.

**Shape:** (full spec lives in a separate doc, sketch here)

New tables:
- `schools(id, name, region, settings_jsonb)`
- `school_memberships(user_id, school_id, role, created_at)` — roles: owner, admin, dept_head, teacher, observer
- `class_memberships(user_id, class_id, role)` — roles: owner, co_teacher, ta, observer

RLS changes across ~30 tables to use membership joins instead of direct `teacher_id` checks.

**Effort:** ~3 days. This is a real project. Separate spec needed before build.

**Why in GOV-2:** Audit log + impersonation + DSR all assume a resolvable role model. Building them against the v1 solo model = throwaway work.

---

### 6. Impersonation / support-view

**Purpose:** Admin can "view as teacher X" to triage their bug reports. Every impersonation session logs start + end + every action.

**Shape:**
- New session cookie `impersonate_as=<uuid>` scoped to admin role
- Middleware wraps the auth context with `acting_as: uuid; actor: uuid`
- Every write during impersonation writes `actor_id=acting_as; impersonated_by=actor` in audit_log
- UI: red banner "You are viewing as <teacher_name> — End session"
- Hard timeout: 60 min

**Effort:** ~1 day. Middleware (3h), cookie + UI banner (2h), audit integration (1h), tests (2h).

**Dependency:** Audit log (#4) must exist first.

---

### 7. DSR runbook (data-subject request)

**Purpose:** "Give me everything you have on student X" / "delete student X." Schools have 30-day legal deadlines.

**Shape:** Two scripts + a markdown runbook:

- `scripts/dsr/export.ts` — takes a `user_id` or `student_token`, reads data-classification registry, walks every table with PII, produces a zip: `student_<id>_<date>.zip` containing JSON per table + asset files
- `scripts/dsr/delete.ts` — same input, produces a pre-flight plan (what will be deleted, what will be anonymized, what is legally retained), requires admin confirmation, then executes + logs
- `docs/runbooks/dsr.md` — the procedure. Who authorizes. How to notify sub-processors (Anthropic, Voyage — though Voyage retention=0 so no action). How to document completion. SLA: 30 days.

**Effort:** ~1.5 days. Scripts (6h), runbook (2h), tests on seed data (4h).

**Dependency:** Data-classification registry (#1) must be complete — scripts read it to know what to touch.

---

**GOV-2 Total:** ~7–8 days.
**Recommended insertion:** Dedicated phase after Dimensions3 closes, before any outbound school conversation.

---

## Phase GOV-3 — Production hardening (3–4 days)

**Trigger:** First school actively using the platform, or pre-launch if you want to be cautious.

### 8. Error tracking (Sentry)

**Purpose:** Structured error capture with user/class context, beyond Vercel's log firehose.

**Shape:**
- `@sentry/nextjs` integration
- Tag every error with `teacher_id | student_id | class_id | route | ai_call_site | cost_category`
- Sentry-side: alert rules for new issue types, error rate spikes
- Tie to audit log: `severity=critical` audit entries also fire Sentry events

**Effort:** ~4 hours. Install, config, test rollout, alert rules.

---

### 9. Incident response playbook

**Purpose:** When moderation false-positives a student mid-exam, when the pipeline stalls, when Anthropic rate-limits — what happens.

**Shape:** `docs/runbooks/incidents.md` with sections:
- Severity definitions (SEV1 outage, SEV2 degraded, SEV3 bug)
- Who is on call (Matt for now — explicit)
- Comms template (teacher email, class banner)
- Rollback checklist per system (pipeline, moderation, auth)
- Post-incident review template

**Effort:** ~3 hours. Writing, no code.

---

### 10. Migration rollback procedure

**Purpose:** Today migrations are one-way. Add a down path for every future migration.

**Shape:**
- New convention: every `NNN_name.sql` gets a paired `NNN_name.down.sql`
- Add to pre-flight audit ritual: "does the new migration have a reversible down path?"
- Retroactive: write down migrations for last 10 migrations (075–077 especially)

**Effort:** ~4 hours. 10 down migrations + convention doc.

---

### 11. Backup / restore runbook (tested)

**Purpose:** Supabase has PITR, but have we ever actually restored? No.

**Shape:**
- `docs/runbooks/backup-restore.md`
- Quarterly drill: restore a Supabase project snapshot into a staging project, verify a known row, tear down, log results
- First drill: within the month

**Effort:** ~3 hours including first drill.

---

### 12. Release / deployment log

**Purpose:** Consolidate "what shipped on what day" across code, migrations, config flags.

**Shape:** `docs/releases.md` — append-only log. One entry per deploy:

```markdown
## 2026-04-14 — Phase 7A
- Commits: abc123..def456
- Migrations: 075, 076, 077
- Flags: pipeline.stage_enabled (new default), cost_ceiling_per_run_usd=5.00
- Schema: +cost_rollups, +bug_reports, +admin_settings; RLS on usage_rollups/system_alerts/library_health_flags
- Notes: Closes FU-X
```

**Integration:** Add saveme step 12 — append a release entry if any migration shipped this session.

**Effort:** ~2 hours. Format + seed with last 10 shipped changes.

---

**GOV-3 Total:** ~3–4 days.

---

## Phase GOV-4 — Quality instrumentation (3 days)

**Trigger:** Ready to treat this as a real product, not a prototype.

### 13. Accessibility conformance log

**Purpose:** Per-route WCAG 2.1 AA status. Schools will eventually ask for a VPAT.

**Shape:** `docs/accessibility.yaml`:

```yaml
- route: /student/tool/scamper
  status: audited    # audited | partial | gap | n/a
  wcag_level: AA
  audited_date: 2026-04-20
  auditor: design:accessibility-review skill
  known_issues:
    - issue: Keyboard focus order on step 3 skips the example panel
      severity: 2.4.3
      status: open
      owner: matt
```

**Integration:** Run `design:accessibility-review` skill once per route, log results.

**Effort:** ~1 day for top 20 routes. Defer long tail.

---

### 14. User-research registry

**Purpose:** Every interview, survey, usability test — logged in one place with findings.

**Shape:** `docs/research/log.yaml`:

```yaml
- id: R-2026-04-01-teacher-beta-3
  date: 2026-04-01
  method: interview            # interview | survey | usability_test | analytics | support_ticket
  n: 3
  segment: MYP Design teachers
  transcripts: docs/research/transcripts/2026-04-01-*.md
  findings:
    - Unit builder 3-lane is confusing — 2/3 picked Guided without knowing Express existed
    - Discovery Engine Kit voice is polarizing — 1/3 turned it off
  linked_decisions: [D-2026-04-03-default-lane]
  status: synthesized
```

**Integration:** Hooks into `design:research-synthesis` and `product-management:synthesize-research` skills.

**Effort:** ~4 hours. Template + seed with prior research.

---

### 15. A/B test / experiment registry

**Purpose:** Before running Pulse-lift experiments or Mode 1 vs 2 tests, have a place for hypothesis → metric → result.

**Shape:** `docs/experiments.yaml`:

```yaml
- id: E-001-default-lane
  hypothesis: Defaulting to Guided lane increases first-week unit creation vs current Express-default
  metric: units_created_per_teacher_week1
  segment: new_teachers
  variants: [express_default, guided_default]
  allocation: 50_50
  started: null
  ended: null
  result: null
  decision: null
```

**Effort:** ~3 hours. Format + feature-flag integration (variants read from feature-flag registry).

---

**GOV-4 Total:** ~3 days.

---

## Phase GOV-5 — Mature SaaS hygiene (1–2 days)

Nice-to-have. Do when there's whitespace.

### 16. SLA definitions

`docs/sla.md`: uptime target (99.5% first year), response-time targets per endpoint class, maintenance window policy, incident communication SLA.

### 17. Parent communication log

Schema + UI for tracking parent emails, consent forms, data-request history per student. Gates the "parents can view their child's portfolio" feature.

### 18. Standards coverage matrix

Explicit YAML: for each of 8 frameworks × each criterion, do we have toolkit coverage? Teaching Moves coverage? Exemplar coverage? Reveals where content is thin. Extends FrameworkAdapter docs.

---

## Sequencing recommendation

| When | What | Days | Rationale |
|---|---|---|---|
| **Now (alongside 7B)** | GOV-1 (classification, flags, vendors) | 1–1.5 | Cheap. Unblocks 7I. Lowers friction in every subsequent phase. |
| **After Dimensions3 closes** | GOV-2 (audit, access, impersonation, DSR) | 7–8 | Multi-school gate. Must be done before outbound sales. |
| **Before first school live** | GOV-3 (error tracking, incidents, rollback, backup, releases) | 3–4 | Production hardening. Do once there's external user risk. |
| **First product push** | GOV-4 (a11y, research, experiments) | 3 | Turn prototype into real product. |
| **Whitespace** | GOV-5 (SLA, parents, standards coverage) | 1–2 | Nice-to-have. |

**Total:** ~15–20 days spread across 3–4 months, if interleaved with feature work.

---

## Integration with existing processes

- **CLAUDE.md:** Add a "Governance registries" section cross-referencing classification, flags, vendors, audit, releases. Add saveme steps to sync each.
- **Saveme step 11 extensions (unconditional):** (d) review feature-flag registry for any new flags; (e) append release entry if any migration shipped; (f) update classification for any new columns.
- **Pre-flight ritual:** Add to every build phase — "does this phase add PII columns without classification? does it add flags without registry? does it add API routes without audit instrumentation on sensitive actions?"
- **WIRING.yaml:** Add 6 new system entries (audit_log, access_model, impersonation, dsr, feature_flags, error_tracking) once built.
- **system-architecture-map.html:** New governance category, 18 entries, maturity levels updated as shipped.

---

## Open questions

1. **Scope of GOV-1 now vs. after 7B?** My recommendation: do all three GOV-1 items before 7B because (a) data-classification informs what's exposed in admin views, (b) feature-flag registry is the core of 7I. But we could argue for deferring classification if 7I's scope is pared back.

2. **Access Model v2 — separate spec first?** Yes. It's too big to fit in GOV-2 without its own spec. Suggest writing `access-model-v2-spec.md` as a pre-req. Adds ~1 day.

3. **Audit log retention?** Schools expect 7 years. That's a lot of rows. Partition by month, archive older than 1 year to cold storage. Decide in GOV-2 design.

4. **Sentry vs. alternative?** PostHog, LogRocket, Highlight all offer errors + session replay. Session replay is huge for teacher bug reports. Revisit in GOV-3.

5. **Impersonation scope:** Can admin impersonate students? My call: no. Teachers only. Students are minors, extra care.

---

## Decision needed

Sign off on Phase GOV-1 scope + insertion point (before 7B / parallel to 7B / after 7B), then either I write the assumptions block for GOV-1.1 (data-classification) or we proceed with 7B and come back. Your call.
