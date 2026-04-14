# Vendor / DPA Registry Taxonomy

## Purpose

`docs/vendors.yaml` is the canonical list of every third-party service that StudioLoom sends data to. It answers the questions school procurement teams ask: "Who are your sub-processors? What data do they see? Do you have DPAs in place?"

The registry feeds three downstream systems:
1. **DSR runbook (GOV-2)** — must notify sub-processors on data deletion requests.
2. **Privacy policy** — vendor list and data categories are referenced directly.
3. **AI-prompt guardrail (GOV-3)** — cross-references `data_sent` categories with column-level `ai_exportable` from `schema-registry.yaml`.

## Entry fields

### Top-level metadata

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | Person responsible for quarterly review (solo-dev era: always matt) |
| `last_reviewed` | date | Date of last full vendor audit |
| `next_review` | date | Next quarterly review date |

### Per-vendor fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable vendor name |
| `role` | string | One-line purpose in StudioLoom's architecture |
| `status` | `integrated` \| `not_integrated` | Whether production code actively calls this vendor |
| `region` | `us` \| `eu-central-1` \| `multi` | Primary data processing region |
| `data_sent` | list | Categories of data sent to this vendor (see canonical categories below) |
| `data_sent[].category` | string | One of 11 canonical categories |
| `data_sent[].fields` | string[] | Column or field paths that map to this category |
| `data_sent[].basis` | string | Legal basis for processing (one of 8 canonical values) |
| `dpa_signed` | date \| `null` | Date DPA was signed, or null if pending |
| `subprocessors` | string[] | Known downstream infrastructure providers (aws, gcp, cloudflare, etc.) |
| `student_data_eligible` | bool | Whether this vendor receives data authored by or identifying students |
| `certifications` | string[] | Security certifications (soc2_type2, iso27001, coppa_safe_harbor, etc.) |
| `contract_type` | `enterprise` \| `standard` \| `free_tier` \| `oss` | Current contract tier |
| `notes` | string | One line — FU references, outstanding DPA work, caveats |

## Canonical `data_sent.category` values

Use exactly these 11 values. Do not invent new categories.

| Category | Description |
|----------|-------------|
| `pii_identifiers` | Names, emails, UUIDs that identify a natural person |
| `student_voice_text` | Free-text authored by a minor (responses, conversation turns) |
| `student_voice_images` | Images created or submitted by students (portfolio, gallery) |
| `student_voice_audio` | Audio recordings by students |
| `teacher_content` | Teacher-authored units, lessons, knowledge base uploads |
| `safety_sensitive_text` | Content with safeguarding relevance (moderation flags, disclosures) |
| `system_metadata` | Opaque IDs, timestamps, request metadata, deployment info |
| `cost_telemetry` | AI usage costs, token counts, billing data |
| `error_reports` | Stack traces, error messages, performance traces |
| `auth_sessions` | Session tokens, refresh tokens, login events |
| `email_content` | Transactional email subjects and bodies |

## Canonical `basis` values

These 8 values match `docs/data-classification-taxonomy.md` exactly. Do not add values here without updating the taxonomy doc.

| Basis | When to use |
|-------|-------------|
| `consent` | Explicit user opt-in |
| `contract` | Data collected as part of school's contractual relationship |
| `legitimate_interest` | Operational data supporting platform core function |
| `legal_obligation` | Audit trails and compliance records |
| `coppa_art_6` | Any student PII or student-generated content (minors) |
| `ferpa_directory` | Student directory information |
| `ferpa_educational` | Student educational records |
| `pseudonymous` | Opaque system identifiers and metadata |

## Update convention

1. Any new vendor added to the codebase **MUST** get an entry in `vendors.yaml` before the integration code is marked production-ready.
2. DPA status is verified quarterly — `next_review` rolls forward on every audit.
3. When a vendor's `status` changes from `not_integrated` to `integrated`, populate `data_sent` with actual categories and update `student_data_eligible`.
4. When signing a DPA, update `dpa_signed` with the signature date and remove "DPA pending" from notes.

## Worked example

```yaml
anthropic:
  name: Anthropic
  role: LLM provider — Claude Sonnet 4 (generation), Haiku 4.5 (mentoring, moderation)
  status: integrated
  region: us
  data_sent:
    - category: teacher_content
      fields: [units.content_data, lessons.content, knowledge_uploads.content]
      basis: legitimate_interest
    - category: student_voice_text
      fields: [design_conversation_turns.content, student_responses.response_text]
      basis: coppa_art_6
    - category: safety_sensitive_text
      fields: [moderation_reports.content, design_conversation_turns.content]
      basis: coppa_art_6
    - category: system_metadata
      fields: [unit_type, framework, class_id]
      basis: pseudonymous
  dpa_signed: null
  subprocessors: [aws]
  student_data_eligible: true
  certifications: [soc2_type2]
  contract_type: standard
  notes: "DPA pending — Anthropic offers Zero Data Retention addendum; needs signing"
```
