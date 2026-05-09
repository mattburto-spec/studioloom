# Spec: Vendor Approval Kit

**Status:** SPEC — drafted 2026-05-10
**Project:** [Privacy-First Positioning](privacy-first-positioning.md)
**Workstream:** 5 of 9 *(promoted by post-pushback synthesis to highest-leverage near-term move — paired with WS1 it's the minimum credible cold-outreach artefact)*
**Owner:** Matt
**Estimated effort:** ~1 week of writing (no engineering). Scope it tight; ship what's needed for the IB / AU procurement conversations and let real buyer feedback drive the long-tail additions.

## Goal

A bundled set of procurement-ready documents that a school IT director, data protection officer, or compliance lead can download in one go and use to make a *yes / no / yes-with-caveats* decision on StudioLoom without having to email back six follow-up questions over three weeks.

Half of school-onboarding delays in ed-tech are document-chasing. A vendor that hands over the kit before being asked is a vendor whose procurement conversation completes in days rather than months. The kit is also the single most useful artefact for cold outreach: "here's the privacy posture page, here's the procurement kit, would your IT director have follow-up questions?" is a conversation that converts.

The kit is also a forcing function for honesty. Writing a real DPA, a real sub-processor list, and a real data flow diagram surfaces every claim that's been hand-waved internally. Anything that can't be written precisely in this kit is a thing the platform can't yet honestly claim.

## Audience

**Primary:** school IT directors, data protection officers, compliance officers — the *Blockers* in the Champion/Blocker frame. They evaluate against a checklist; they don't read marketing copy.
**Secondary:** heads of school signing the contract — they receive a forwarded copy with annotations from their IT lead.
**Tertiary:** IB coordinators (the *Champions*) — they download the kit to forward to their IT department before the cold-outreach conversation gets to "send me your privacy docs."

Reading level: senior-technical-and-legal. Precise, evidence-backed, no marketing voice. Same posture as the privacy posture page; different register — formal where the page has room to be irreverent.

## Where it lives

URL: `/vendor-kit` or `/procurement` on the marketing site (final path TBD in pre-flight). **Public download, no email gate.** A vendor who hides their procurement docs behind a form has something to hide; a vendor who publishes them up front has its house in order. The discoverability win compounds: every IB coordinator who forwards the URL becomes a low-friction internal champion.

Discoverable from:
- Privacy posture page footer ("Need this for your IT department? Download the procurement kit.")
- Marketing site homepage footer
- The URL is mentioned by name in cold-outreach messages — direct link, no form, no friction

Format: downloadable as a single ZIP (one click from the kit page) AND browseable as a directory of individually-linked docs. Some IT directors want the bundle; some want to read one doc inline. Both paths supported.

## What's in the kit (v1)

Nine documents. Each has its own one-screen reading time so a busy IT director can speed-read the whole kit in 20 minutes.

1. **Cover letter / readme** — one page. What's in the kit, who to contact for follow-ups, what the kit covers and explicitly doesn't cover, link to the privacy posture page for the broader posture story. Date-stamped.

2. **Data Processing Agreement (DPA) template** — the heaviest item. GDPR Article 28-compliant; AU Privacy Act + APPs compatible. Pre-filled with StudioLoom as processor + the school as controller. Standard contractual clauses for international transfers. Cross-references the sub-processor list. Schools can countersign as-is or redline. Both PDF and DOCX (so legal teams can mark up).

3. **Sub-processor list** — current vendors that handle student data, derived from [`docs/vendors.yaml`](../vendors.yaml). Each row: vendor name, role, what data they see, where data is stored geographically, legal basis for transfer, DPA status with that vendor. Live HTML page on the site (always current); PDF snapshot in the kit (date-stamped). v1 covers all 9 vendors already in the registry (Anthropic, Supabase, Vercel, Voyage AI, Sentry, Resend, Fly.io, Cloudflare, plus the 9th).

4. **Data flow diagram** — single-page visual. Student input → server (Vercel + Supabase) → AI provider (Anthropic) → response → server → student. Annotates exactly what reaches each hop and what doesn't (PII redaction at the AI boundary, etc.). Companion to §2 of the privacy posture page; the kit version is the printable / shareable artefact.

5. **Privacy posture page (PDF export)** — for IT directors who print docs and read them offline. Clean PDF render of the full WS1 page, date-stamped to the export. Auto-regenerated on the live page changing.

6. **Region-specific compliance one-pagers (3 in v1)**:
   - **UK GDPR** — relevant for international IB schools that reference UK / EU GDPR by default.
   - **Australian Privacy Act + Australian Privacy Principles** — for the AU push.
   - **IB safeguarding guidance alignment** — for the IB schools specifically; maps the platform's posture to the IB's published expectations for digital tools.
   - *Deferred:* FERPA (US — only when first US conversation), Singapore PDPA (when first SG school), NZ Privacy Act 2020 (when first NZ school), PIPL (out of scope per project doc — Chinese-market PIPL is a heavier separate lift).

7. **Incident response & breach notification policy** — what happens when something goes wrong. Procedure, severity definitions, notification timelines (72-hour GDPR / per-jurisdiction), who notifies whom. Companion to [`docs/runbooks/incidents.md`](../runbooks/incidents.md) (the internal runbook); this is the external-facing version. Names the incident-response contact email.

8. **Security feature checklist** — the "what your IT department actually needs to verify" list, pulled from [`docs/security/security-overview.md`](../security/security-overview.md). RLS coverage, encryption at rest, encryption in transit, MFA on admin accounts, audit log scope, retention defaults, deletion procedure, signed-URL expiry, rate limiting. Each row: claim + status (yes / partial / planned). The "partial" rows are the ones honest disclosure requires — better to publish partial-status than overclaim.

9. **Standard FAQ** — anticipated questions, derived from a survey of what real ed-tech IT directors ask:
   - Do you train AI on student data? *No. See sub-processor row for Anthropic + DPA addendum.*
   - Where is data stored? *Supabase region X, Vercel region Y, Anthropic regional routing.*
   - Can you export everything for a single student? *Yes. DSR runbook covers the procedure.*
   - Can you delete everything for a single student? *Yes. Same runbook.*
   - What happens when a student leaves the school? *Their data follows the retention policy you set per-class; default is X.*
   - What happens when the school stops using StudioLoom? *Data export available for 90 days post-termination, then bulk-deleted per the DPA.*
   - Who has access to student data? *Per the access-control matrix on the security feature checklist.*
   - What about AI hallucinations / inappropriate content? *Content moderation pipeline; cross-link to the safeguarding posture.*
   - 5-7 more, derived from the pre-flight survey.

## Format and voice

- DPA template: PDF + DOCX. Versioned (v1.0 first, increments on legal changes).
- Everything else: PDF (clean, branded, single-purpose, designed for print).
- Sub-processor list: live HTML page **and** PDF snapshot.
- Cover letter: PDF + Markdown source (so it's diff-able in git).
- Voice: professional throughout. Same posture as the privacy posture page; the irreverent register lives only on the homepage hero (per the dual-track voice decision in the project doc). The kit is Blocker-facing — formal register, no cheek.
- Branding: minimal. Studio Loom logo, document title, date, version. The point is to be readable, not designed.

## Update cadence

- Sub-processor list (live HTML): updated whenever `vendors.yaml` changes. v1 manual; **`FU-VAK-SUBPROCESSOR-CI-DRIFT`** files a CI hook later.
- DPA template: versioned, refreshed annually or on legal-significant changes. Old versions stay accessible at `/vendor-kit/dpa/v1.0.pdf` etc.
- Region one-pagers: review every 6 months or on a relevant regulator update.
- Data flow diagram: updated when architecture meaningfully changes (new sub-processor, AI redaction model change, etc.).
- Privacy posture PDF export: auto-regenerated on the live page changing.
- Security feature checklist + FAQ: reviewed quarterly during a `saveme` pass.
- Incident response policy: reviewed annually; updated immediately if a real incident reveals a gap.

Each doc carries a "Last reviewed" date in the footer. The kit page lists the dates so a buyer can see at a glance what's recent.

## Pre-flight (before writing any kit content)

1. **Survey what IT directors actually ask.** Lightweight: 30-min calls with 3-4 IB / AU school IT directors *or* a desk-research scan of public school procurement checklists. Goal: derive the FAQ list from real questions, not guesses. **This is also the cold-outreach pretext** — "I'm putting together a procurement kit for IB schools; would your IT director spend 20 min telling me what they typically ask?" doubles as discovery + relationship-opener.
2. **Reconcile [`docs/vendors.yaml`](../vendors.yaml).** Confirm all 9 sub-processors are current; flag any with missing DPA status, missing region, missing legal basis. Fix gaps before exporting.
3. **Reconcile [`docs/security/security-overview.md`](../security/security-overview.md).** The security feature checklist is derived from §1-§14; honest "partial" status rows surface from this audit.
4. **Find a DPA template starting point.** Don't write from scratch. The IB / AISI / common-vendor-DPA frameworks give a starting frame; redline to StudioLoom specifics. Get a lawyer review before publishing v1.0 (deferred per project doc — but the *template* should still be lawyer-reviewed even if SOC2 isn't).
5. **Confirm the marketing site location.** Is the kit a route on the existing studioloom.org Next.js app, or a separate static site? Affects the implementation path.
6. **Decide the data-flow-diagram source.** Hand-illustrated (pretty, slow to update) vs auto-generated from `WIRING.yaml` (ugly, always current). Lean: hand-illustrated for v1, with a note that the live `WIRING.yaml` is the source of truth.
7. **Identify a friendly first-reader.** Ideally an IB IT director who'd skim the kit pre-publish and flag anything that wouldn't pass their procurement review. Same audience as cold outreach — kills two birds.

## Open questions

- **Q1.** Public download or email-gated? Lean: public. Discoverability + posture signal both favour open. Email gating is the kind of friction this kit explicitly exists to remove.
- **Q2.** Who countersigns DPAs on StudioLoom's behalf? Likely Matt as sole director until incorporation grows. Document this in the cover letter so schools know who to expect on the paperwork.
- **Q3.** DPA: jurisdiction for governing law? Australian / English / Singaporean? Material to international schools. Lawyer-review territory.
- **Q4.** Is the existing `/privacy-policy` page (if any) consistent with what the kit will say? Pre-flight surfaces this; reconcile or supersede.
- **Q5.** Lawyer review budget for the v1 DPA template — how much, when, who? This is the one item in the kit that genuinely needs legal eyes.
- **Q6.** Branding consistency — does the kit live under the StudioLoom brand or the Loominary umbrella? Lean: StudioLoom for v1 (matches the marketing site); revisit when product #2 ships.

## Risks / non-goals

- **Not legal advice.** The DPA template is a *starting point* that the school's legal team reviews and amends. The kit's cover letter says this explicitly to head off a compliance officer reading the DPA as if StudioLoom is providing them legal counsel.
- **Not security certification.** SOC2, ISO 27001, HIPAA all out of scope. Triggered by specific deals, not pre-emptive (per WS9 / project doc).
- **Not a replacement for actual conversations.** It's a starting point that compresses the conversation, not a substitute. Schools that want a call still get one.
- **Not perfect on first ship.** Region-specific one-pagers will be refined as real procurement conversations surface gaps. Ship something, get feedback, iterate. Don't sit on v1 chasing perfection.
- **Not pretty.** The kit is functional, not decorative. A buyer who judges StudioLoom by the visual polish of its DPA is not the buyer this is for.
- **Not a moat.** Competitors can write the same kit. The moat is the underlying *posture* that the kit documents — which they can't copy without rebuilding their architecture.

## Done = success criteria

- The kit is downloadable as a single ZIP at `/vendor-kit` (or equivalent). All 9 documents present.
- A school IT director with no prior knowledge of StudioLoom can read the kit in <30 min and form a procurement decision (yes / no / yes-with-conditions).
- Matt can attach the kit URL to a cold-outreach email and the recipient knows what to do with it without further explanation.
- At least one IB school IT director has reviewed the v1 kit pre-publish and confirmed it passes their procurement bar (the friendly first-reader from pre-flight item 7).
- The DPA template has been lawyer-reviewed before public release.
- The "Last reviewed" date is visible on every document and the kit page lists them.
- Update cadence is documented and the next review date is on Matt's calendar.

## Out-of-scope / follow-ups

- **`FU-VAK-SUBPROCESSOR-CI-DRIFT`** (P2) — CI check that fails when `vendors.yaml` changes without the kit's sub-processor list page also changing.
- **`FU-VAK-LOCALISATION`** (P3) — translate kit to Mandarin (China-market — separate PIPL effort), Spanish, French, Japanese as international markets open.
- **`FU-VAK-INTERACTIVE-FAQ`** (P3) — searchable / filterable FAQ on the page.
- **`FU-VAK-DPA-VERSIONING-PUBLIC`** (P3) — old DPA versions kept publicly accessible at versioned URLs.
- **`FU-VAK-FERPA-ONEPAGER`** (P2) — triggered when first US-school conversation surfaces.
- **`FU-VAK-SINGAPORE-PDPA-ONEPAGER`** (P3) — triggered when first SG-school conversation surfaces.
- **`FU-VAK-NZ-PRIVACY-ACT-ONEPAGER`** (P3) — triggered when first NZ-school conversation surfaces.
- **`FU-VAK-LIVE-DATA-FLOW-DIAGRAM`** (P2) — auto-generate from `WIRING.yaml` instead of hand-illustrating. Cheaper to maintain over time once the architecture stabilises.
- **`FU-VAK-SOC2-PACKAGING`** (P3) — when SOC2 ships, package the audit report as the 10th doc.
- **`FU-VAK-IT-DIRECTOR-INTERVIEW-LOG`** (P2) — track which IT directors have reviewed the kit and what they flagged. Becomes the case-study source for WS8.

## Effort breakdown

| Doc | Effort |
|---|---|
| Cover letter / readme | ½ day |
| DPA template (writing + lawyer-review window) | 1.5-2 days writing + 1 day for lawyer review (parallel) |
| Sub-processor list (live page + PDF) | ½ day |
| Data flow diagram | 1 day |
| Privacy posture PDF export pipeline | ½ day (one-off setup) |
| Region one-pagers ×3 (UK / AU / IB) | 1.5 days |
| Incident response policy | ½ day |
| Security feature checklist | ½ day |
| Standard FAQ | ½ day (after pre-flight survey) |
| Packaging (ZIP, kit page UI, cross-links) | ½ day |
| **Total** | **~6 days writing + 1 day lawyer-review window (in parallel)** |

That's tight but realistic given the inputs already exist (vendors.yaml, security-overview.md, runbooks). The DPA template is the single risky item — pad it if needed.

## Pairing with WS1

WS5 doesn't ship in isolation. Cold-outreach emails attach BOTH the privacy posture page link (WS1) AND the vendor approval kit link (WS5). One is the Champion-facing read; the other is the Blocker-facing read. Matt's first cold-outreach session should not happen until both are live.

If forced to ship one before the other, ship WS1 first (Champion-readable, public-marketing-readable, broader audience). WS5 is more impactful but WS1 is the prerequisite — the kit cross-references the posture page.

## Registry sync (per CLAUDE.md build methodology)

- **`vendors.yaml`** — pre-flight reconciliation; the kit's sub-processor list is derived from this. Any drift surfaced becomes a fix.
- **`security-overview.md`** — pre-flight reconciliation; the security feature checklist is derived from this.
- **`doc-manifest.yaml`** — entries for each kit document at completion.
- **`WIRING.yaml`** — new system entry `vendor-approval-kit` when shipped (Marketing & Public category, sibling to `landing-page` and `public-toolkit`).
- **`changelog.md`** — entry per kit version.

This workstream touches docs + one new marketing-site route. No migrations, no new API routes, no new vendors, no new AI call sites, no new flags.
