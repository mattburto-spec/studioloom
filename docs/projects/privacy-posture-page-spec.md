# Spec: Privacy Posture Page

**Status:** SPEC — drafted 2026-05-09, evolved 2026-05-09 (broader positioning + self-disclosed PII section + presets-first control panel framing)
**Project:** [Privacy-First Positioning](privacy-first-positioning.md)
**Workstream:** 1 of 9
**Owner:** Matt
**Estimated effort:** 2-3 days (pre-flight audit + writing + page build)

## Goal

A single, scannable, public marketing-site page that documents exactly what StudioLoom collects about students, what it doesn't, what reaches third parties (especially AI providers), what students themselves might disclose inside their work, and how the privacy control panel lets schools tune the posture. The page exists to:

1. Give school IT directors, heads of school, IB coordinators, and inquiry/PBL leads a single URL they can read in 5 minutes and forward to their compliance officer.
2. Serve as the linkable "see why" target for in-product trust signals (project workstream 7).
3. Be the foundation that the Vendor Approval Kit (workstream 5) and the data-flow diagram are derived from.
4. Force StudioLoom to actually inventory what it stores. The act of writing the page is half the value.

## Audience

**Primary:** school IT directors evaluating procurement, IB coordinators and inquiry/PBL leads presenting tools to faculty, school heads signing contracts.
**Secondary:** parents reading their school's tool list, journalists covering ed-tech privacy, privacy-conscious teachers self-evaluating.

Reading level: senior-non-technical. Clear enough that a head of school understands it on first read; precise enough that an IT director's compliance review doesn't catch hand-waving.

This is the **professional register** companion to the irreverent landing-page hero. Same posture, no cheek.

## Where it lives

URL: `/privacy-posture` on the StudioLoom marketing site (final path TBD in pre-flight — may end up as `/data` or `/student-data` depending on existing route conventions).
Linked prominently from the marketing footer ("How we handle student data") and from in-product trust signals (workstream 7).

## Page structure

Nine sections, top to bottom, scannable in five minutes:

### Section 1 — The principle (~80 words)
The one-paragraph version of the worldview. Approximate copy:

> StudioLoom is built so that schools can run a full design or inquiry curriculum — including signature IB capstones like PP, EE, PYPX, and CAS — without giving up student data they don't need to give up. Names, contact details, and dates of birth are optional. The platform works without them. AI mentors see handles, never real student names. Schools control what's collected through a single privacy control panel. This page documents exactly what we collect, what we don't, and where data goes.

### Section 2 — What we collect (and why) — *required* fields
A short, honest table:
- Field
- What it's used for
- Where it's stored
- Who can see it

Drafted from the actual schema after the pre-flight audit. Don't pad — every row is a real field. Each row is also a small commitment ("we will not collect more here without updating this page first").

### Section 3 — What we collect *only if you opt in*
Same table format, separate section. Likely candidates from the audit: student real name, parent email for fabrication notifications, student profile photo. Each row makes clear how to opt out and what changes if you do.

### Section 4 — What we *never* collect
Explicit list, e.g.: date of birth, home address, government ID, ethnicity, religion, family income, behavioural biometrics, cross-site tracking. The point of this list is to be pre-emptively *more* explicit than schools expect — sets the tone.

### Section 5 — What reaches our AI providers
The most important section for IT directors. Specifically:
- We use Anthropic Claude as the AI mentor.
- Student names are *replaced with a placeholder* before any prompt reaches Anthropic. Enforced in code via the `STUDENT_NAME_PLACEHOLDER` primitive and a CI test that fails the build if a new AI call site references PII tokens without explicit allowlist justification (see [`src/lib/security/student-name-placeholder.ts`](../../src/lib/security/student-name-placeholder.ts) and the no-PII-in-AI-prompts test).
- What *does* reach Anthropic: the content of student work submitted for AI feedback, anonymised conversation context, framework/level/language metadata.
- Anthropic's commercial-tier API does not train on customer data. Linked to their statement.
- Every Anthropic call routes through a single chokepoint (`src/lib/ai/call.ts`) — no rogue call sites possible.
- No other AI provider receives student data.

### Section 6 — What students might disclose in their work *(NEW — be honest about this)*
The integrity section. The minimum-data architecture controls *what StudioLoom collects in database fields*. It does not — and cannot — control what students themselves include *inside* the work they submit.

Specifically:
- A student writing an EE on grief may name family members.
- A PYPX poster may include photographs of the student or their environment.
- A PP reflection may name the family business or local context.
- A CAS journal may include identifying details about service partners or community members.
- AI mentor conversations may surface personal context the student volunteers.

How we handle this:
- Content moderation runs on student submissions; flagged content surfaces to the teacher, not auto-deleted.
- The `STUDENT_NAME_PLACEHOLDER` primitive substitutes student names in AI prompts even when the student types their own name in their work.
- We retain student-submitted work for the school's stated retention period (configurable; default TBD post-audit), then delete it.
- Schools running the Anonymous preset are encouraged in onboarding to brief students on what to include vs leave out of work submissions.

This section exists because pretending the minimum-data architecture covers self-disclosed PII would be the kind of overclaim that bites you six months later. Honesty is the only defensible position.

### Section 7 — Privacy controls (presets first, advanced second)
Explain the privacy control panel — the school-admin UI for tuning what StudioLoom collects.

**Presets (the primary surface):**
- **Open** — names, contact details, DOB optional but supported. For schools with full parental consent flows and full functionality needs.
- **Standard** — names yes, contact and DOB no. Sensible default for most schools.
- **Anonymous** — handles only, names live only in teacher's browser, optional encrypted file export. Default for sensitive units, identity-themed projects, and schools with strict data-minimisation policies.

**Granular customisation (Advanced tab):** schools that want field-by-field control can override any preset. Per-class overrides allowed; school-level defaults inherit down. Audit log of changes.

Side-by-side comparison: what's stored where, in each preset.

Mention the pre-filled login URL approach (`/login/[classcode]`) as a related minimum-friction primitive — credentials become *findable* (saved bookmark / WeChat favourite) rather than *memorable*, no auth-model change required.

### Section 8 — Sub-processors and data flow
Visual data-flow diagram + sub-processor list (Anthropic, Vercel, Supabase, Voyage AI, Resend, others from [`vendors.yaml`](../vendors.yaml)). Each entry: what they do, what data they see, where they're hosted, DPA status. Updated whenever `vendors.yaml` changes.

### Section 9 — Your rights and our processes
Brief plain-language version: how a school requests data export, how a student is removed, retention defaults, breach notification process, contact for compliance questions. Link to the full DPA in the Vendor Approval Kit (workstream 5) when it exists.

## Data dictionary requirements

The audit underlying sections 2-4 needs to produce a published-ready field-level inventory:

- Every column on every `students`-adjacent table (`students`, `student_sessions`, `student_content`, `student_responses`, etc. — full list confirmed during audit)
- For each column: classification (required / optional / removable), purpose, storage location, who has read access, retention period
- Cross-reference against [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md) and [`docs/schema-registry.yaml`](../schema-registry.yaml). The taxonomy already exists; this audit applies it field-by-field
- Output: a tidy markdown table that becomes both an internal source-of-truth doc AND the rendered table on sections 2-4 of the page

The data dictionary lives at `docs/student-data-dictionary.md` (new file) and is the canonical source. The marketing page renders from it; it isn't duplicated.

## Pre-flight (read-only — no code, no edits)

1. Locate the StudioLoom marketing site routes. Likely under `/questerra/src/app/(marketing)/...` or `/questerra/src/app/(public)/...`. Confirm the path convention and the layout component used.
2. Read [`docs/schema-registry.yaml`](../schema-registry.yaml) — list every table whose name matches `student*` or that has a `student_id` foreign key. Produce the candidate field inventory.
3. Read [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md) to confirm the classification vocabulary. Note any new categories the audit might need.
4. Read [`docs/vendors.yaml`](../vendors.yaml) — confirm the sub-processor list is current. Spot-check 1-2 entries against actual code (e.g. is Voyage AI still in use? Resend?).
5. Read [`docs/security/security-overview.md`](../security/security-overview.md) §1-3 — the canonical PII-flow doc. Reconcile any drift between the candidate page draft and that document.
6. Check whether a `/privacy-policy` or similar legal page already exists. The privacy posture page is *complementary*, not a replacement — they serve different audiences (legal vs IT/operational). Note any existing content the new page should link to or avoid duplicating.
7. Check `/questerra/src/lib/security/student-name-placeholder.ts` and the corresponding no-PII test exist as described in CLAUDE.md. (Section 5 of the page makes specific claims about these — they have to be true.)
8. Check the existing content moderation surface (likely in `/questerra/src/lib/moderation/...` or similar). Section 6 of the page makes claims about how flagged content is handled — confirm what's actually true today.
9. Check the existing data retention defaults (likely in admin settings or schema). Section 6 mentions "school's stated retention period" — confirm whether this is configurable today or a fixed default.

**STOP AND REPORT findings before drafting page content.**

## Build steps

1. **Pre-flight audit** (per above). Output: candidate data dictionary (markdown table), confirmed marketing-site routes, sub-processor reconciliation, content-moderation reconciliation, retention-policy reconciliation, drift notes.
2. **Matt Checkpoint A — Audit findings.** Matt reviews the data dictionary and decides which fields are *actually* required vs which can become optional. This is the most important decision in the whole spec — it's not just documentation, it's a product call. Some fields currently stored as required may become opt-in.
3. **Draft page content** in markdown, sections 1-9. Submit to Matt for tone / accuracy review. Professional register throughout — no cheek (cheek lives on the landing page hero).
4. **Matt Checkpoint B — Content sign-off.**
5. **Build the page route** in the marketing site. Style to match existing marketing pages. Sections 2-4 render the data dictionary from the single source-of-truth file (so updates don't require touching the page route).
6. **Wire footer link** + add to marketing-site sitemap.
7. **Tests:** snapshot test for the page render, link-check for all internal/external links.
8. **Matt Checkpoint C — Live preview review.** Matt walks through it on staging as if he were a school IT director.
9. **Ship to prod.**
10. **Post-ship:** add the page to the marketing-site sitemap submitted to search engines; share with the first IB pilot school's IT contact for feedback.

## Don't stop for

- Bikeshedding the page URL (`/privacy-posture` vs `/data` vs `/student-data` — pick the obvious one in pre-flight)
- Layout pixel-perfection (this is a content page; legibility > beauty)
- Adding interactive elements (it's a document, not an app — workstream 1 ships it static; FU `INTERACTIVE-DICTIONARY` later if the page becomes high-traffic)

## Stop triggers

- Pre-flight audit reveals fields stored that *can't* be classified (legacy columns of unclear purpose). Flag, don't paper over.
- Pre-flight finds the marketing site is structured in a way that makes adding a new page unexpectedly large in scope (e.g. requires migrating to a new framework).
- Drafting reveals a sub-processor relationship not previously documented — e.g. an AI fallback provider that was never added to `vendors.yaml`. Stop and reconcile before publishing.
- The "what reaches AI providers" section (section 5) has any factual ambiguity. That section especially must be precise.
- Section 6 (self-disclosed PII) makes claims about content moderation or retention that don't match what the code actually does. Stop and reconcile — either fix the code, change the claim, or both.
- The audit reveals more PII is stored than the brand pillar implies. **This is a feature, not a bug** — the audit doing its job. Pause, surface to Matt, decide whether to (a) reclassify those fields as opt-in, (b) keep them required and adjust the page copy, or (c) remove them from the schema. The decision precedes the page draft.

## Success criteria

- An IB coordinator and an Australian head of school can each read the page in under 5 minutes and come away with a defensible mental model of what StudioLoom does and doesn't store.
- An IT director can forward the URL to their compliance officer and the compliance officer's response is "this is unusually clear" not "I have 12 follow-up questions."
- The data dictionary the page is built on becomes the canonical internal reference for every future "do we collect X?" question — single source of truth.
- The page becomes the most-linked-to URL in StudioLoom sales conversations within a quarter of shipping.
- A privacy-skeptical reader who reaches Section 6 (self-disclosed PII) thinks "they're being honest about the limits" rather than catching the page in an overclaim.

## Follow-ups out of scope here

- **`FU-PRIVACY-PAGE-LOCALISATION`** (P3) — translate to Mandarin, Japanese, Spanish, French as international markets open.
- **`FU-PRIVACY-PAGE-INTERACTIVE-DICTIONARY`** (P3) — make the data dictionary filterable/sortable on the page itself once content is stable.
- **`FU-PRIVACY-PAGE-AUDIT-LOG`** (P2) — render an audit-log changelog at the bottom showing when each field's classification changed. Useful as the project matures.
- **`FU-DATA-DICTIONARY-CI-DRIFT`** (P2) — add a CI check that fails if `schema-registry.yaml` adds a `students*` field that isn't classified in the data dictionary. Prevents drift between published claims and reality.
- **`FU-CONTENT-MODERATION-PII-DETECTION`** (P2) — extend content moderation to detect when student-submitted work contains PII patterns (emails, phone numbers, addresses) and prompt the student/teacher. Section 6 currently leans on retention + redaction; proactive detection would be stronger.

## Registry sync (per CLAUDE.md build methodology)

This workstream touches docs only; no migrations, no new API routes, no new vendors, no new AI call sites, no new flags. Registry sync at completion is light: update [`docs/doc-manifest.yaml`](../doc-manifest.yaml) with the new files (`student-data-dictionary.md`, the marketing-site page route), append a [`docs/changelog.md`](../changelog.md) entry, the project entry in [`docs/projects/ALL-PROJECTS.md`](ALL-PROJECTS.md) and dashboard `PROJECTS` array already exists from the project wiring commit.
