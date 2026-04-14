# Data Classification Taxonomy

## Purpose

Every column in `docs/schema-registry.yaml` carries a `classification:` block that tags it along six axes. These tags power three downstream systems: (1) the DSR runbook (GOV-2) uses `pii` and `retention_days` to build export/delete queries; (2) the AI-prompt guardrail (GOV-3) reads `ai_exportable` before including any column value in a prompt; (3) RLS audit scripts cross-check `safety_sensitive` against actual policy grants. Classification is additive — it never changes the column's SQL definition, only documents how the data should be handled.

## The 6 classification fields

### `pii: bool`

Does this column, alone or joined with obvious sibling columns (e.g., `student_id` + `class_id`), identify a natural person?

**Decision rules:**
- `true` for names, emails, photos, voice clips, IP addresses, device fingerprints, and any UUID that directly references `auth.users` or `students` (since those tables map to real people).
- `true` for foreign keys to students/teachers when the surrounding row contains enough context to re-identify (e.g., `student_id` in a moderation log with timestamps).
- `false` for opaque system IDs (unit_id, block_id) that don't map to a person without a separate join.

### `student_voice: bool`

Was this column authored by a minor? Triggers COPPA / GDPR-K extra protections.

**Decision rules:**
- `true` for free-text fields that students wrote: responses, conversation messages (role='student'), gallery context notes, bug report descriptions from student reporters, discovery profile data.
- `false` for system-generated fields *about* students (scores, status flags, timestamps) — even if the data describes a student, the student didn't write it.
- `false` for teacher-authored content, even if it mentions students.

### `safety_sensitive: bool`

Could this column's contents reveal a student at risk — self-disclosure, safeguarding relevance, moderation-relevant content?

**Decision rules:**
- `true` for any free-text field a student writes (they might disclose anything).
- `true` for moderation flags, safety scan results, content that was flagged or rejected.
- `true` for conversation content (student or assistant turns — assistant may be responding to a disclosure).
- `false` for structural metadata (IDs, timestamps, status enums with no free text).

### `ai_exportable: none | hash_only | full`

Can this column's value be sent to third-party AI providers (Anthropic, Voyage) in prompts or embeddings?

**Decision rules:**
- `full` for non-PII metadata, system-generated content, timestamps, status enums, scores, and teacher-authored content that the teacher explicitly uploaded for AI processing.
- `hash_only` for PII identifiers used as join keys in embeddings or prompts — the raw UUID should never appear in a prompt, but a hash can be used for deduplication or tracking.
- `none` for free-form `safety_sensitive` content we never want sent unredacted: moderation flags, console errors, admin notes, safety scan results, screenshot URLs.

### `retention_days: int | 'indefinite'`

Maximum days after which we should delete or archive this data.

**Decision rules:**
- `indefinite` for technical metadata (IDs, created_at, updated_at, FKs to non-student records), teacher-authored content, and system configuration.
- `2555` (7 years) for student voice, student PII, and student-generated content — aligns with FERPA record retention and covers a student's full secondary schooling span.
- `365` for ephemeral operational data (console errors, screenshot URLs) that has no long-term value.
- Match Supabase Auth policy for teacher auth rows (indefinite unless account deleted).

### `basis: consent | contract | legitimate_interest | legal_obligation | coppa_art_6 | ferpa_directory | ferpa_educational | pseudonymous`

Legal basis for processing, GDPR-style.

**Decision rules:**
- `pseudonymous` for opaque system identifiers and metadata that don't identify anyone.
- `coppa_art_6` for any student PII or student-generated content (minors require parental consent under COPPA; Art 6 GDPR covers lawful processing bases).
- `legitimate_interest` for teacher-authored content and operational data that supports the platform's core function.
- `contract` for data collected as part of the school's contractual relationship (teacher profiles, class setup).
- `ferpa_educational` for student educational records (grades, progress, assessment data).
- `legal_obligation` for audit trails and compliance records that must be retained.

## Worked examples

### Example 1: PII identifier column — `class_students.student_id`

```yaml
student_id:
  pii: true           # directly references a student record → real person
  student_voice: false # system FK, not authored by the student
  safety_sensitive: false # a UUID has no safeguarding content
  ai_exportable: hash_only # never send raw student UUID to AI; hash for dedup OK
  retention_days: 2555     # 7 years — student enrollment record
  basis: coppa_art_6       # minor's data, requires parental consent basis
```

### Example 2: Student-voice free-text column — `design_conversation_turns.content`

```yaml
content:
  pii: false              # the text itself doesn't identify; student_id on the row does
  student_voice: true     # students author their conversation turns
  safety_sensitive: true  # free text → student might disclose anything
  ai_exportable: full     # this IS the content we send to the AI mentor (core feature)
  retention_days: 2555    # 7 years — student educational record
  basis: ferpa_educational # conversation is part of the learning record
```

### Example 3: Pure-metadata timestamp — `classes.created_at`

```yaml
created_at:
  pii: false             # a timestamp doesn't identify anyone
  student_voice: false   # system-generated
  safety_sensitive: false # no safeguarding relevance
  ai_exportable: full    # harmless metadata
  retention_days: indefinite # lives as long as the class exists
  basis: pseudonymous    # no personal data
```

## Derived rules

### Rule D1 — URL/path columns inherit the referenced asset's classification

Any column whose value is a pointer (URL, storage path, storage key, signed URL, CDN URL) to a separate asset **inherits the classification of the asset it references**, not the classification of "a short text string."

**Rationale:** A column like `bug_reports.screenshot_url` is a string, but the thing it points to is a screenshot that can contain faces, student work, other students in frame, or UI disclosing a student's name. Treating the URL as "just metadata" understates the risk. Classify the URL as if it were the asset.

**Decision shortcuts:**
- Screenshot URLs → `pii: true` (screenshots may capture identifiable people or content)
- Portfolio / gallery / work image URLs → inherit from portfolio entry (usually `pii: true, student_voice: true, safety_sensitive: true` because the image IS the student's work)
- Teacher-uploaded asset URLs (reference images, rubric PDFs) → `pii: false, student_voice: false` unless the file itself is known to contain student content
- Audio clip URLs → treat like screenshots when authored by or capturing students
- Signed/expiring URLs are still PII — the URL expiring doesn't change the classification of the thing it pointed to

**Applies during classification:** whenever you see a column name ending in `_url`, `_path`, `_key`, `_href`, or containing `screenshot`, `image`, `photo`, `audio`, `file`, `attachment`, ask "what does this point to?" and classify accordingly.

## Update convention

Any new column added by a migration **MUST** have a classification entry in `schema-registry.yaml` before the migration is marked `applied: true`. This is enforced by:

1. Manual review during `saveme` step 11(a) — the reviewer checks that every column in the new migration's table entry has a corresponding classification entry.
2. Future CI check (GOV-1 Phase 2) — any migration that adds a column without a classification entry fails the pipeline.

When classifying a new column, work through the 6 fields in order. If a value doesn't fit cleanly, add a YAML comment `# UNSURE: <reason>` and flag it in the session report for Matt's review.
