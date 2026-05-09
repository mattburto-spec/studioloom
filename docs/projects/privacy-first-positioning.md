# Project: Privacy-First Positioning

**Status:** PLANNING — drafted 2026-05-09
**Owner:** Matt
**Related:** [`docs/security/security-overview.md`](../security/security-overview.md), [`docs/vendors.yaml`](../vendors.yaml), [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md)

## Thesis

StudioLoom is the design learning platform with the data footprint of an exercise book. Inquiry-based design pedagogy and minimum-data architecture are *both halves* of the product story, equal weight in every external conversation. This is a brand pillar, not a feature — the discipline it requires shapes which features StudioLoom builds and which it deliberately refuses.

## Why this positioning works for the GTM

The go-to-market sequence is **IB schools → Australian schools → rest-of-world** (mostly schools running design or inquiry-based learning curricula). All three audiences are unusually receptive to the minimum-data story right now:

**IB schools.** The IB Learner Profile explicitly names "Principled" and "Caring" as outcomes, and IB has been increasingly explicit that the digital tools schools choose should *model* the values their curriculum teaches. A platform that demonstrably doesn't surveil students is internally pitchable to IB coordinators as alignment with stated curriculum values — that's a procurement argument, a faculty-meeting argument, and a parent-newsletter argument from a single feature decision. PYPX, MYP Personal Project, and DP Extended Essay are exactly the long, identity-touching, sometimes-sensitive student inquiry projects where minimum-data matters most in practice.

**Australian schools.** The PowerSchool breach in early 2026, layered onto the still-recent Optus and Medibank incidents from 2023, has made AU school IT departments materially more cautious. Vic DET, NSW DET, QCAA, and the independent school networks have tightened vendor procurement processes in the last 18 months. The "we collect only what's needed" message lands differently in AU in 2026 than it would have in 2021.

**Rest of world (design + IBL).** UK GDPR, NZ Privacy Act 2020, Singapore PDPA, and EU GDPR all push schools toward data minimization by default. A vendor that's already there ahead of the school's legal team's questions is a much smoother sale.

## The brand pillar framing

Every external surface — marketing site, sales decks, school IT one-pagers, partner conversations — leads with two things, not one:

1. **What StudioLoom does:** inquiry-based, AI-mentored design learning for secondary students.
2. **How StudioLoom is built:** minimum student data by design — no DOB, no contact details, no real name required for full functionality. Anonymous Mode available. AI mentor sees handles, never real names.

Both halves carry equal weight. The current marketing emphasis is mostly on (1); the strategic shift is to give (2) the same surface area in every external conversation.

## Strategic principles (the discipline this requires)

There is a real tension between "rich AI mentoring" and "minimum data." Rich personalisation works better with more student context. Future feature requests will routinely propose collecting more — IEP uploads to inform the AI mentor, fine-grained engagement tracking for early intervention, sentiment analysis on student writing, etc. Each request will be individually reasonable. Each will erode the brand pillar.

The product discipline this positioning requires:

- Before adding any feature that requires more student data, ask: does this break the brand pillar? If yes, find a way to deliver the value without it. (Often the answer is teacher-side configuration instead of student-side data collection.)
- Treat student-data minimisation as a **design constraint**, not a checkbox. The constraint forces better solutions — the no-chatbot principle, the `STUDENT_NAME_PLACEHOLDER` AI redaction primitive, the OS-seam discipline against premature generalisation are all examples already in the codebase.
- The marketing claim only stays true if engineering keeps saying no to a specific category of "obvious next feature." This is a product call as much as a marketing one.

## Workstreams

In priority order:

### 1. Privacy posture page + data dictionary  *(SPEC drafted — see [`privacy-posture-page-spec.md`](privacy-posture-page-spec.md))*
Public marketing-site page documenting exactly what StudioLoom collects, what it doesn't, what reaches AI providers, and how Anonymous Mode reduces the footprint further. Includes a published data dictionary — every field stored about a student, classified. Foundation for every other workstream. **~2-3 days writing + audit.**

### 2. Anonymous Mode (localStorage v1)
The proof point that the brand pillar is real. Teacher-side `localStorage` stores the name↔handle mapping; server stores only handles. Encrypted file export/import for cross-device. Without this, "minimum data" is marketing copy; with this, it's demonstrable side-by-side. Per-class toggle, set at class creation. **~1 week.** (Layer 2 with server-side encrypted blob deferred until pull from real customers exists.)

### 3. Vendor Approval Kit
A bundled folder schools can request during procurement: DPA template, sub-processor list (already exists as [`vendors.yaml`](../vendors.yaml)), data flow diagram, incident response page, region-specific one-pagers (UK GDPR / AU Privacy Act / IB safeguarding / FERPA when US arrives). Half of school onboarding delays are document chasing — pre-empting the request shaves 3-6 weeks per sale. **~1 week of writing.**

### 4. In-product trust signals
Every UI surface where a teacher could enter PII (parent emails, student real names, etc.) gets a small "(optional — see why)" link. Click → one sentence explaining what it's used for. Trains teachers, makes the principle visible, turns every form field into a small reaffirmation of the brand. **~3-5 days incremental once the data dictionary exists.**

### 5. Case studies / testimonials
In the first 3-5 IB pilot schools, identify the one or two whose leadership most explicitly values the minimum-data posture. Capture quotes early — easier to land than expected because IT directors are happy to be publicly credited for smart procurement. **Ongoing during pilot rollout.**

### 6. SOC2 Type 1
Box-tick that silently unlocks a lot of doors. ~$15-25k, ~3 months elapsed. Should be in flight within 6-9 months if IB / AU pilots progress. ISO 27001 deferred until a customer explicitly demands it. **External audit work, separate budget.**

## Companion: pre-filled login URL phase

Already in pre-flight: `/login/[classcode]` route + "Copy class login link" teacher button (spec earlier in this conversation). Not strictly part of this project but reinforces the same posture — credentials become *findable* (saved bookmark, WeChat favourite) rather than *memorable*, with no auth-model change. Mention the URL approach in the privacy posture page §6 as evidence that minimum-friction *and* minimum-data can coexist.

## Risks / non-goals

- **Not a PIPL pitch.** This positioning targets IB / AU / ROW design schools, not mainland Chinese schools. PIPL compliance is a separate (much heavier) lift not in scope here. Anonymous Mode helps the PIPL story but doesn't close it — pursue only if a Chinese-market opportunity becomes concrete.
- **Not a security claim.** Minimum-data is about *what is collected*, not *how well what's collected is protected*. The security posture is documented in [`docs/security/security-overview.md`](../security/security-overview.md) and is a separate (also strong) story.
- **Not absolute anonymity.** Even in Anonymous Mode, IP addresses, behavioural data, and student writing reach the server and (for AI calls) reach Anthropic. The pitch is "minimum PI by design," not "zero data."

## Open questions (resolve before each workstream lands)

- Where does the marketing site live in the codebase? (Pre-flight for workstream 1.)
- What student fields are *currently* stored that we'd need to mark as required vs optional? (Pre-flight for workstream 1 — this is the data audit.)
- Is Anonymous Mode set per-class, per-school, or per-class-with-defaults inherited from school? (Resolve before workstream 2.)
- Who's the first IB school to pilot? Are they on board with being the first case-study quote? (Resolve during pilot scoping.)
- Is there an existing `/privacy-policy` page, and does it complement or conflict with this work? (Pre-flight for workstream 1.)

## Status & next steps

- **2026-05-09:** Project drafted. Spec for workstream 1 (privacy posture page) drafted alongside.
- **Next:** Sign off on positioning thesis + workstream priority. Begin pre-flight audit for workstream 1 (data dictionary).

## Follow-ups tracker

When this project moves from PLANNING to active build, create [`docs/projects/privacy-first-followups.md`](privacy-first-followups.md) per the per-project follow-up convention in CLAUDE.md.
