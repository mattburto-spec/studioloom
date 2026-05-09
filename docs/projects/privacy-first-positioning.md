# Project: Privacy-First Positioning

**Status:** PLANNING — drafted 2026-05-09, evolved 2026-05-09 (positioning sharpened, workstreams reorganised after pushback round)
**Owner:** Matt
**Related:** [`docs/security/security-overview.md`](../security/security-overview.md), [`docs/vendors.yaml`](../vendors.yaml), [`docs/data-classification-taxonomy.md`](../data-classification-taxonomy.md)

## Thesis

StudioLoom is the platform for self-directed, inquiry-driven student projects — built first for design and technology, now supporting the IB Continuum's signature capstones (PP, EE, PYPX, CAS) and similar inquiry frameworks elsewhere. Pedagogy is the headline; **minimum student data by design** is the strong second beat that closes the deal with the IT director and the privacy-conscious head of school.

The data discipline is not a feature behind a toggle. It's a brand pillar — a constraint that shapes which features StudioLoom builds, which it deliberately refuses, and how it talks about itself in every external surface. Schools and teachers control what student data the platform collects, through a single privacy control panel.

## Why this positioning works for the GTM

The go-to-market sequence is **IB schools → Australian schools → rest-of-world** (mostly schools running design, inquiry, or capstone-heavy curricula). All three audiences are unusually receptive to the minimum-data story right now.

**IB schools.** The IB Learner Profile explicitly names "Principled" and "Caring" as outcomes, and the IB has been increasingly explicit that the digital tools schools choose should *model* the values their curriculum teaches. PYPX, MYP Personal Project, DP Extended Essay, and CAS are exactly the long-form, identity-touching student inquiry projects where minimum-data matters most in practice — students explore family, identity, mental health, social issues, and bereavement in these. A platform that demonstrably doesn't surveil students is internally pitchable to IB coordinators as alignment with stated curriculum values: a procurement argument, a faculty-meeting argument, and a parent-newsletter argument from a single product decision.

**Australian schools.** The PowerSchool breach in early 2026, layered onto the still-recent Optus and Medibank incidents from 2023, has made AU school IT departments materially more cautious. Vic DET, NSW DET, QCAA, and the independent school networks have tightened vendor procurement processes in the last 18 months. The "we collect only what's needed" message lands differently in AU in 2026 than it would have in 2021.

**Rest of world (design + inquiry).** UK GDPR, NZ Privacy Act 2020, Singapore PDPA, and EU GDPR all push schools toward data minimization by default. A vendor that's already there ahead of the school's legal team's questions is a much smoother sale.

## The brand pillar framing

Every external surface — marketing site, sales decks, school IT one-pagers, partner conversations — leads with two things:

1. **What StudioLoom does:** the platform for self-directed inquiry and capstone projects. PP, EE, PYPX, CAS, design, and similar. Mode-aware UI adapts to the project type the teacher is running.
2. **How StudioLoom is built:** schools and teachers control what student data is collected. Defaults are minimum. AI mentor sees handles, never real names. Three privacy presets cover most schools; granular customisation available.

Pedagogy is the headline (it's what teachers actually buy on). Privacy is the strong second beat (it's what closes the deal with the IT director, and it's the differentiator nobody else in ed-tech offers).

**Voice and register — dual track.**
- *Irreverent register* (homepage hero, social, first-impression): "We don't need your mum's phone number to be the best PBL platform." "EE. PP. PYPX. CAS. We support the work, not the surveillance." Confidence, breaks the polite-ed-tech mold, memorable.
- *Professional register* (privacy posture page, procurement decks, DPA): measured, precise, evidence-backed. Same posture, no cheek.

Both registers carry the same claim. The voice depends on who's reading.

## Strategic principles (the discipline this requires)

There is a real tension between "rich AI mentoring" and "minimum data." Future feature requests will routinely propose collecting more — IEP uploads to inform the AI mentor, fine-grained engagement tracking, sentiment analysis on student writing. Each will be individually reasonable. Each will erode the brand pillar.

The product discipline this positioning requires:

- Before adding any feature that requires more student data, ask: does this break the brand pillar? If yes, find a way to deliver the value without it. (Often the answer is teacher-side configuration instead of student-side data collection.)
- Treat student-data minimisation as a **design constraint**, not a checkbox. The constraint forces better solutions — the no-chatbot principle, the `STUDENT_NAME_PLACEHOLDER` AI redaction primitive, the OS-seam discipline against premature generalisation are all examples already in the codebase.
- The marketing claim only stays true if engineering keeps saying no to a specific category of "obvious next feature."

**Be honest about what the discipline does NOT cover.** Minimum-data architecture controls *what StudioLoom collects in database fields*. It does not — and cannot — prevent students from disclosing personal information *inside their work*. A student's EE on grief mentions their grandmother. A PYPX poster has the kid's actual makerspace. A PP reflection names the family business. Pretending otherwise is the kind of overclaim that bites you six months later when an IT director reads an AI conversation log and finds family names. The privacy posture page acknowledges this explicitly and documents how content (vs structured data) is handled.

## Workstreams

In execution order. The proof-point sequencing is deliberate — Anonymous Mode ships as a hidden flag first to give the marketing screenshot demo three weeks earlier than waiting for the full control panel.

### 1. Privacy posture page + data dictionary  *(SPEC drafted — see [`privacy-posture-page-spec.md`](privacy-posture-page-spec.md))*
Public marketing-site page documenting exactly what StudioLoom collects, what it doesn't, what reaches AI providers, what students might disclose inside their work, and how the privacy control panel works. Includes a published data dictionary — every field stored about a student, classified. Foundation for every other workstream — the audit underneath the page tells you what the control panel can toggle. **~2-3 days writing + audit.**

### 2. Anonymous Mode (hidden class-creation flag, v1)  *(SPEC drafted — see [`privacy-anonymous-mode-spec.md`](privacy-anonymous-mode-spec.md))*
The proof point that the brand pillar is real. Teacher-side `localStorage` stores the name↔handle mapping; server stores only handles. Encrypted file export/import for cross-device. Per-class flag, set at class creation. Ships *before* the full control panel — gives demo-able evidence to first IB pilot schools and screenshots for marketing. Will later be presented as the "Anonymous" preset within the control panel UI. **~1 week.**

### 3. Privacy Control Panel
School-admin UI for controlling what student data StudioLoom collects. **Presets are the primary surface** (Open / Standard / Anonymous), with field-by-field granular controls behind an "Advanced" tab. Per-class overrides allowed; school-level defaults inherit down. Audit log of changes. Absorbs Anonymous Mode as the "Anonymous" preset. **~3 weeks** after WS2.

Three presets, named:
- **Open** — names + contact details + DOB optional but supported. Default for schools that want full functionality and have parental consent flows.
- **Standard** — names yes, contact and DOB no. Default for most schools.
- **Anonymous** — handles only, names live only in teacher's browser. Default for sensitive units, identity-themed projects, and schools with strict data-minimisation policies.

90% of schools will pick a preset and never touch granular. Demo and procurement story: "pick your privacy posture in 10 seconds, change any time."

### 4. Landing page hero rework
Front-page hero gives equal real-estate to the pedagogy claim and the privacy claim. Irreverent register on the hero copy, professional companion on the inner pages. Demo loop shows the control panel + a side-by-side "Open vs Anonymous" class. Depends on WS2 (Anonymous Mode shipping) for the demo screenshots and on WS3 (control panel shipped) for the full demo loop. **~1 week of marketing copy + design work**, sequenced after WS3.

### 5. Vendor Approval Kit
A bundled folder schools can request during procurement: DPA template, sub-processor list (already exists as [`vendors.yaml`](../vendors.yaml)), data flow diagram, incident response page, region-specific one-pagers (UK GDPR / AU Privacy Act / IB safeguarding / FERPA when US arrives). Half of school onboarding delays are document-chasing — pre-empting the request shaves 3-6 weeks per sale. Can run in parallel with WS2-4. **~1 week of writing.**

### 6. Mode-aware privacy defaults
Connects the existing mode system (design / PYP / Service / etc., already shipped via the topnav pill) to the privacy presets. PYP defaults to Anonymous (youngest students, strictest defaults). Design defaults to Standard. Service/CAS may default to Open because reflection sometimes wants identifying context. Schools can override per-class. **~3-5 days** after WS3 ships.

### 7. In-product trust signals
Every UI surface where a teacher could enter PII (parent emails, student real names, etc.) gets a small "(optional — see why)" link. Click → one sentence explaining what it's used for + a link to the privacy posture page. Trains teachers, makes the principle visible, turns every form field into a small reaffirmation of the brand. **~3-5 days incremental** once WS1 (data dictionary) exists.

### 8. Case studies / testimonials
In the first 3-5 IB pilot schools, identify the one or two whose leadership most explicitly values the minimum-data posture. Capture quotes early — easier to land than expected because IT directors are happy to be publicly credited for smart procurement. **Ongoing during pilot rollout.**

### 9. SOC2 Type 1 *(deferred)*
Originally workstream 6, deferred. IB coordinators and AU schools generally don't ask for SOC2 — that's a US public-and-charter-school checkbox. UK GDPR + AU Privacy Act + a clean DPA cover the actual market need. SOC2 triggered when a US public-school deal explicitly demands it, not on a fixed timeline. ~$15-25k, ~3 months elapsed when triggered. ISO 27001 deferred until a customer explicitly demands it.

## Companion: pre-filled login URL phase

Already in pre-flight: `/login/[classcode]` route + "Copy class login link" teacher button (separate spec). Reinforces the same posture — credentials become *findable* (saved bookmark, WeChat favourite) rather than *memorable*, with no auth-model change. Mention in the privacy posture page §7 as evidence that minimum-friction *and* minimum-data can coexist.

## Risks / non-goals

- **Not a PIPL pitch.** This positioning targets IB / AU / ROW design-and-inquiry schools, not mainland Chinese schools. PIPL compliance is a separate (much heavier) lift not in scope here. Anonymous Mode helps the PIPL story but doesn't close it — pursue only if a Chinese-market opportunity becomes concrete.
- **Not a security claim.** Minimum-data is about *what is collected*, not *how well what's collected is protected*. The security posture is documented in [`docs/security/security-overview.md`](../security/security-overview.md) and is a separate (also strong) story.
- **Not absolute anonymity.** Even in Anonymous mode, IP addresses, behavioural data, and student writing reach the server and (for AI calls) reach Anthropic. The pitch is "minimum PI by design," not "zero data."
- **Not addressed by minimum-data: self-disclosed PII inside student work.** Students may include personal information in their EEs, reflections, posters, and conversations. The minimum-data architecture cannot prevent this. Handled separately via content moderation, the AI redaction primitive (`STUDENT_NAME_PLACEHOLDER`), and explicit acknowledgement on the privacy posture page. Don't conflate the two stories.
- **Not a pivot from design.** Design is StudioLoom's origin and remains a core mode within the broader inquiry positioning. The mode system (already shipped) lets each mode adapt the UI; design mode is one of several, not the whole product. PYP mode is being designed in collaboration with a PYP coordinator, addressing the credibility-gap risk between marketing claim and product surface.

## Open questions

- What student fields are *currently* stored that we'd need to mark as required vs optional? (Pre-flight for WS1 — this is the data audit.)
- Where does the marketing site live in the codebase? (Pre-flight for WS1 and WS4.)
- Is there an existing `/privacy-policy` page, and does it complement or conflict with this work? (Pre-flight for WS1.)
- Who is the first IB / AU pilot school willing to be a public case study? (Resolve during pilot scoping, WS8.)
- For mode-aware privacy defaults (WS6): does the existing mode system already have a hook for cascading per-mode defaults to other systems, or does that need to be built?

## Resolved decisions (this revision)

- *Self-disclosed PII inside student work* will be acknowledged explicitly on the privacy posture page rather than papered over. Honesty over overclaim.
- *Privacy control panel UX*: presets are the primary surface, granular toggles are an Advanced tab. Three presets: Open / Standard / Anonymous.
- *Sequencing*: Anonymous Mode ships as a hidden class-creation flag first (~1 week, gives the marketing screenshot 3 weeks earlier), then the control panel wraps around it (~3 weeks). Same end state, demonstrable proof much sooner.
- *SOC2 deprioritised* from workstream 6 to deferred-on-trigger. UK GDPR + AU Privacy Act + DPA cover the actual GTM need; SOC2 is a US-market trigger.
- *Mode system*: confirmed as the architectural seam for the broader positioning. PYP mode being designed with a PYP coordinator. Mode-aware privacy defaults added as workstream 6.

## Status & next steps

- **2026-05-09 AM:** Project drafted. Spec for WS1 drafted alongside.
- **2026-05-09 PM:** Pushback round resolved. Workstreams reorganised (6 → 9). Self-disclosed PII honesty principle added. Voice and register clarified. Mode system formalised as seam.
- **Next:** Sign off on revised positioning + workstream priority. Begin pre-flight audit for WS1 (data dictionary).

## Follow-ups tracker

When this project moves from PLANNING to active build, create [`docs/projects/privacy-first-followups.md`](privacy-first-followups.md) per the per-project follow-up convention in CLAUDE.md.
