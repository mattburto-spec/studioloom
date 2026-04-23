# Skills Library — v1 Catalogue (60 skills)

**Created:** 23 April 2026
**Status:** DRAFT — seed catalogue for the Skills Library workshop
**Related:** [`skills-library.md`](skills-library.md), [`skills-library-research-brief.md`](skills-library-research-brief.md), [`skills-library-spec.md`](../specs/skills-library-spec.md)

---

## How to read this

Sixty skills across ten domains. Each domain carries **two Bronze, two Silver, two Gold** skills to build a real progression ladder. One skill is sized to fit one lesson (≈ 45 minutes of focused work) unless noted. The **demo of competency** is the single sentence that defines what "earned" means for that skill — if a student can't do the thing in that sentence, the badge isn't earned. The controlled verb glossary is at the bottom.

**Card ID convention.** `DOMAIN-TIER-NUMBER` — e.g. `DM-B1` is Design & Making, Bronze, first card.

**Tiers.**
- **Bronze** — introductory. Assumes no prior skill. Ages 11–13 typical.
- **Silver** — applied. Assumes Bronze in the same domain. Ages 13–15 typical.
- **Gold** — high-leverage / transferable / higher-order. Ages 15–18 typical. Younger students may attempt with teacher approval.

**Framework anchors** — every card is mapped to at least one external anchor (MYP ATL category, CASEL competency, WEF 2025 core skill, Studio Habits of Mind) so the library is defensible to parents, admin, and accreditation reviews.

---

## Domain 1 · Design & Making (DM)

The workshop and technical-craft spine. Students produce physical or digital artefacts and learn the conventions that make making communicable to others.

### DM-B1 · Workshop Safety Essentials
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 45 min · **Frameworks:** ATL Self-Management · WEF Technological Literacy

**In one line.** Recognise workshop hazards, choose the right PPE, and work safely around other people.

**Learning outcomes.** Student can…
- identify the four most common workshop hazards (cuts, burns, crush, airborne particles) and the PPE that controls each;
- show safe behaviour around moving tools (hands clear, long hair tied, no phone);
- explain what to do if someone else in the workshop is unsafe, without escalating the situation.

**Demo of competency.** Demonstrate a two-minute safety walkthrough of the workshop to a peer, correctly naming three hazards and the mitigations for each.

**Quiz prompt seeds.** PPE for dust vs. sparks · when to stop and fetch a teacher · which two items are never allowed in the workshop · safe distance from a moving machine.

**Prerequisites.** none.
**Applied in.** All Design units; bridges to the existing Safety Badges system (this is the *literacy* skill; the per-machine badges are the *licences*).

---

### DM-B2 · Orthographic Drawing Basics
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 60 min · **Frameworks:** ATL Communication · Studio Habits: Develop Craft

**In one line.** Draw a simple 3D object as three flat views (front, top, side) using a pencil and ruler.

**Learning outcomes.** Student can…
- identify which view is front, top, and side on a given orthographic drawing;
- produce a three-view drawing of a cube-based object with correct alignment;
- explain why orthographic views are used instead of a 3D pictorial.

**Demo of competency.** Sketch a three-view orthographic drawing of a given object (e.g. a stepped block) with views aligned and hidden lines dashed.

**Quiz prompt seeds.** what a hidden-detail dashed line means · which view goes above the front view · difference between orthographic and isometric · why engineers use orthographic over photographs.

**Prerequisites.** none.
**Applied in.** Product Design units, CAD preparation, fabrication briefs.

---

### DM-S1 · Hand Sketching for Ideation
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** Studio Habits: Envision, Express · ATL Thinking

**In one line.** Generate and communicate design ideas quickly with thumbnail sketches and brief annotations.

**Learning outcomes.** Student can…
- produce ten thumbnail sketches of variations on a single brief in twenty minutes;
- annotate a sketch with at least three labels (function, material, user action);
- identify which of their own sketches is strongest and justify the choice.

**Demo of competency.** Produce a single sheet of ten labelled thumbnail sketches for a supplied brief, then circle and justify one preferred direction.

**Quiz prompt seeds.** why volume matters in ideation · what a thumbnail is (and isn't) · the role of annotation · when to switch from sketch to CAD.

**Prerequisites.** DM-B2 helpful but not required.
**Applied in.** Product and Service design briefs; Stone "Ideation" prereq.

---

### DM-S2 · Cut, Score, and Machine Prep (Vinyl / Laser)
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Thinking · WEF Technological Literacy

**In one line.** Prepare a clean vector file that a vinyl cutter or laser cutter can process, with correct layers and colours.

**Learning outcomes.** Student can…
- identify the difference between a cut line, a score line, and a raster area in a vector file;
- produce a prep-ready SVG with layers named, strokes set correctly, and no stray geometry;
- explain why a file that looks fine on screen can still fail a preflight check.

**Demo of competency.** Produce a preflight-ready SVG of a provided design (a coaster with cut outline, score logo, and raster text) that passes a supplied checklist.

**Quiz prompt seeds.** the three strokes/colours for cut/score/raster · why overlapping lines cause trouble · what a kerf is · why text is outlined before export.

**Prerequisites.** DM-B2 (orthographic thinking); DL-B1 (file management).
**Applied in.** Fabrication Pipeline (Preflight); Product units; Stone "Prototype" prereq.

---

### DM-G1 · 3D Printing Workflow (CAD → Slice → Print)
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 90 min (double period) · **Frameworks:** ATL Thinking · Studio Habits: Develop Craft, Stretch & Explore

**In one line.** Take a design from CAD through slicing software to a successful print, making informed choices at each step.

**Learning outcomes.** Student can…
- identify which CAD features a slicer will struggle with (thin walls, overhangs, floating geometry);
- demonstrate a slicing decision (infill %, layer height, supports) and justify each against the use-case;
- explain the three most common print failures (first-layer adhesion, stringing, warping) and how to prevent them.

**Demo of competency.** Produce a printed artefact from a student's own CAD file, submitting the sliced G-code preview with three annotated decisions (why this orientation, why this infill, why these supports).

**Quiz prompt seeds.** infill percentage trade-offs · when to rotate vs. add supports · material-specific settings (PLA vs. PETG) · how layer height affects strength and print time.

**Prerequisites.** DM-S1, DM-S2, DM-B2.
**Applied in.** Fabrication Pipeline (Preflight); any unit where students print a prototype; Stone "Make" prereq.

---

### DM-G2 · Joinery and Material Choice
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** Studio Habits: Develop Craft · ATL Thinking

**In one line.** Choose a joining method and a material for a real-world design constraint, and argue the choice against an alternative.

**Learning outcomes.** Student can…
- compare three joining methods (glue, mechanical fastener, interference fit) across strength, reversibility, and tool cost;
- identify which joint is appropriate for a given product use-case (outdoor / load-bearing / disposable);
- argue for a specific material choice using at least two properties (e.g. tensile strength, cost per unit, workability).

**Demo of competency.** Produce a one-page "material & joinery decision brief" for a supplied product scenario, naming the joint, the material, and the runner-up for each with reasoning.

**Quiz prompt seeds.** when a screw beats glue · why end-grain glue joints fail · reading a material datasheet · cost vs. strength trade-off.

**Prerequisites.** DM-S1, DM-S2.
**Applied in.** Summative design projects; Stone "Evaluate" prereq; Open Studio capability-gap surfacing.

---

## Domain 2 · Visual Communication (VC)

How to make ideas visible. Covers diagramming, layout, and the technical drawing conventions that separate "doodle" from "document."

### VC-B1 · Mind Mapping and Spidergrams
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Thinking · Studio Habits: Envision

**In one line.** Map a topic visually so that relationships between ideas are clearer than in a list.

**Learning outcomes.** Student can…
- produce a mind map of a supplied topic with at least three levels of branching;
- identify which ideas on a peer's map are most connected and explain why;
- compare a list-form brainstorm with a mind-map version of the same content.

**Demo of competency.** Produce a hand-drawn or digital mind map of a given topic (e.g. "breakfast") with ≥ 3 branch levels and ≥ 12 nodes.

**Quiz prompt seeds.** what makes a map different from a list · why the central node matters · when to use branches vs. clusters · signs of an unhelpful mind map.

**Prerequisites.** none.
**Applied in.** Any unit's Discovery phase; early Stone "Research" prereqs.

---

### VC-B2 · Reading Simple Diagrams
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Communication · ATL Research

**In one line.** Extract information correctly from flowcharts, Venn diagrams, and bar charts.

**Learning outcomes.** Student can…
- identify what each shape means in a flowchart (decision, process, terminator);
- explain what a Venn diagram's intersection represents;
- compare two quantities accurately from a bar chart, including reading scale correctly.

**Demo of competency.** Produce correct answers on a supplied diagram-reading set (3 flowchart, 2 Venn, 3 bar chart) with ≥ 7/8 correct.

**Quiz prompt seeds.** what a diamond in a flowchart means · Venn intersection vs. union · what a misleading y-axis looks like · when a pie chart is the wrong choice.

**Prerequisites.** none.
**Applied in.** Research and Evaluation stages of any unit; Stone "Evaluate" prereq.

---

### VC-S1 · Poster Layout and Visual Hierarchy
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Communication · Studio Habits: Express

**In one line.** Design a poster where the reader's eye lands on the right thing first, second, third.

**Learning outcomes.** Student can…
- identify the three levels of visual hierarchy on a given poster (primary, secondary, supporting);
- demonstrate use of scale, weight, and colour to move the eye where it should go;
- compare two versions of the same poster and argue which has stronger hierarchy.

**Demo of competency.** Produce a single A3 poster for a given topic (e.g. a school event) with clear three-level hierarchy, then annotate it to explain each choice.

**Quiz prompt seeds.** what "the eye should land on X first" means · when bold helps vs. when it flattens · grid vs. freeform layout · why whitespace isn't wasted space.

**Prerequisites.** VC-B1 or VC-B2.
**Applied in.** Presentation of final projects; exhibition preparation; Class Gallery submissions.

---

### VC-S2 · Isometric and Exploded Views
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Communication · Studio Habits: Express

**In one line.** Communicate how something is assembled using isometric drawings and exploded diagrams.

**Learning outcomes.** Student can…
- identify the three isometric axes and their 30° / 30° / 90° convention;
- produce an isometric sketch of a cube-based object to scale;
- produce an exploded view showing assembly order of a simple multi-part object.

**Demo of competency.** Produce a two-drawing pair for a 3–5 part object: one isometric view of the assembled form, one exploded view showing assembly order with dashed guide lines.

**Quiz prompt seeds.** axis angles in isometric · when to explode vs. section · what dashed guide lines show · isometric vs. oblique.

**Prerequisites.** DM-B2 (orthographic).
**Applied in.** Technical portfolios; summative design documents; IKEA-style instructions challenges.

---

### VC-G1 · Infographic Design
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 90 min · **Frameworks:** ATL Communication · ATL Research · WEF Analytical Thinking

**In one line.** Turn a real dataset into a single-image explanation that is both accurate and persuasive.

**Learning outcomes.** Student can…
- identify whether a chart type matches the data's shape (comparison, distribution, proportion, change over time);
- produce an infographic that answers one clear question and supports it with ≥ 2 pieces of evidence;
- argue against a weak infographic by naming its specific failures (chart-junk, misleading axis, cherry-picked data).

**Demo of competency.** Produce a single infographic from supplied data that answers a posed question, with a written 150-word rationale defending the chart choices.

**Quiz prompt seeds.** when to use a bar vs. line vs. pie · what Tufte means by "data-ink ratio" · honest vs. deceptive axis choices · the role of annotation in a chart.

**Prerequisites.** VC-S1; RI-S1 helpful.
**Applied in.** Service units (needs-analysis presentation); Research units; PP reports.

---

### VC-G2 · Technical Drawing Conventions
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 90 min · **Frameworks:** ATL Communication · Studio Habits: Develop Craft

**In one line.** Produce a dimensioned technical drawing that a workshop or manufacturer could use to make the object.

**Learning outcomes.** Student can…
- identify the standard conventions (line weights, dimensioning, tolerances, title block);
- produce a first-angle or third-angle projection drawing that meets the convention;
- explain the difference between a tolerance and a nominal dimension and when each matters.

**Demo of competency.** Produce a full technical drawing (three views + isometric inset + title block + dimensions with at least two tolerances) of an object the student has designed.

**Quiz prompt seeds.** line weight hierarchy · first-angle vs. third-angle convention · what ± means on a dimension · why a title block exists.

**Prerequisites.** VC-S2, DM-B2.
**Applied in.** Summative MYP / GCSE / A-Level portfolios; fabrication-ready file submission.

---

## Domain 3 · Communication & Presenting (CP)

Speaking, listening, writing — the tools for making internal thinking reach other people.

### CP-B1 · Speaking Clearly and Making Eye Contact
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 45 min · **Frameworks:** ATL Communication · CASEL Relationship Skills

**In one line.** Speak to a small group at a pace they can follow, looking up from your notes, and projecting enough to be heard.

**Learning outcomes.** Student can…
- demonstrate a deliberate pace (≈ 130 words/minute) for 60 seconds;
- show appropriate eye contact (≥ 3 different audience members in a one-minute talk);
- identify two filler words they use and suggest a replacement behaviour (pause, breath).

**Demo of competency.** Deliver a 60-second spoken introduction on a familiar topic with ≥ 3 eye-contact transitions and ≤ 3 filler words.

**Quiz prompt seeds.** why pace matters more than volume · what "reading from the slide" signals · the 3-person eye-contact rule · what to do when you lose your place.

**Prerequisites.** none.
**Applied in.** Any unit's mid-project check-in; crit board presentations.

---

### CP-B2 · Active Listening
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Social Awareness · ATL Communication · WEF Empathy

**In one line.** Listen to someone else well enough that you could faithfully repeat back what they said and what they meant.

**Learning outcomes.** Student can…
- demonstrate three active-listening behaviours (open posture, minimal encouragers, paraphrasing);
- show they can paraphrase a peer's 60-second story with ≥ 80% fidelity;
- identify the difference between *waiting to talk* and *listening*.

**Demo of competency.** In a pair, listen to a peer's 60-second story, then paraphrase it back in ≤ 30 seconds; the peer confirms accuracy.

**Quiz prompt seeds.** what a minimal encourager is · open vs. closed body language · why silence is part of listening · signs that someone is just waiting to talk.

**Prerequisites.** none.
**Applied in.** Interview-based research; Service unit stakeholder conversations; group work.

---

### CP-S1 · Structuring a 3-Minute Pitch
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Communication · WEF Leadership and Social Influence

**In one line.** Open, build, and close a short pitch that moves an audience from "so what?" to "I'd back that."

**Learning outcomes.** Student can…
- identify the three parts of a classic pitch structure (problem → solution → ask);
- produce a three-minute pitch script that hits all three parts and includes one concrete example;
- demonstrate the pitch live, landing the ask within the time budget.

**Demo of competency.** Deliver a live 3-minute pitch (problem/solution/ask) on a student-chosen idea, with a peer-scored rubric showing ≥ 3/4 on each part.

**Quiz prompt seeds.** what makes the problem feel real · why the ask must be specific · handling the nervous opener · what to cut when you're over time.

**Prerequisites.** CP-B1.
**Applied in.** Summative presentations; Service-unit stakeholder updates; Open Studio check-ins.

---

### CP-S2 · Giving and Receiving Feedback (Kind / Specific / Helpful)
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** CASEL Relationship Skills · Studio Habits: Reflect · Ron Berger's protocol

**In one line.** Give a peer feedback that is kind, specific, and helpful — and take it on your own work without defending.

**Learning outcomes.** Student can…
- identify examples of feedback that are kind-but-vague, specific-but-harsh, and kind-specific-helpful;
- demonstrate giving K/S/H feedback on a peer's work in ≤ 90 seconds;
- show at least one behaviour of *receiving* feedback well (no-defence listening, one clarifying question, thank).

**Demo of competency.** In a pair, give two rounds of K/S/H feedback and receive two rounds in return; peer scores each round against the rubric.

**Quiz prompt seeds.** what "specific" means beyond "more words" · when *kind* tips into *vague* · what to do if you disagree with the feedback · the one-clarifying-question rule.

**Prerequisites.** CP-B1, CP-B2.
**Applied in.** Crit board; Stone reviews; all collaborative design work.

---

### CP-G1 · Storytelling for Impact
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 75 min · **Frameworks:** ATL Communication · WEF Creative Thinking · Studio Habits: Express

**In one line.** Use story structure (character, conflict, turn, resolution) to make an audience feel the weight of a design decision or a research finding.

**Learning outcomes.** Student can…
- identify the four beats of a minimal story (who, what they wanted, what got in the way, what changed);
- produce a 2-minute story version of a design problem that another student can retell;
- argue when a story is the right frame vs. when data alone is stronger.

**Demo of competency.** Produce and deliver a 2-minute spoken story that frames a real design problem, with the four-beat structure visible and a concrete emotional stake.

**Quiz prompt seeds.** why specificity beats generality in stories · the role of the turn · pitfalls of the fake-hero story · when story gets in the way of the point.

**Prerequisites.** CP-S1.
**Applied in.** Summative pitches; Service unit advocacy; exhibition opening talks.

---

### CP-G2 · Running a Meeting / Facilitating Discussion
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Leadership and Social Influence · CASEL Relationship Skills

**In one line.** Run a group discussion that reaches an outcome on time without steam-rolling quieter voices.

**Learning outcomes.** Student can…
- produce a meeting agenda with objectives, timings, and owners;
- demonstrate three facilitation moves (timeboxing, pull-in-the-quiet, summarise-and-move-on);
- explain what "a decision" looks like at the end of a meeting versus a drift-off.

**Demo of competency.** Run a live 15-minute group meeting on a student-chosen topic with an agenda, ending with a recorded decision and action owners. Observer checklist must score ≥ 7/10.

**Quiz prompt seeds.** agenda vs. notes · when to kill a tangent · the silent-dominator problem · how to close a meeting.

**Prerequisites.** CP-S1, CP-S2, CT-S1.
**Applied in.** Open Studio team meetings; PP committee work; school leadership roles.

---

## Domain 4 · Collaboration & Teamwork (CT)

Two or more people, one outcome. Covers pair work, team dynamics, and honest credit.

### CT-B1 · Working in a Pair
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Relationship Skills · ATL Social

**In one line.** Share a single task with one partner so that both of you contribute and both of you understand the final outcome.

**Learning outcomes.** Student can…
- demonstrate agreeing a division of labour in under 2 minutes before starting;
- show at least two check-ins during a 20-minute task;
- identify the sign that a pair has collapsed into "one person does it all."

**Demo of competency.** Complete a supplied pair task (e.g. co-draw an object) where both partners can explain any part of the outcome when picked at random.

**Quiz prompt seeds.** what "fair split" means on an unequal task · the free-rider pattern · the helicopter-parent pattern · what a check-in sounds like.

**Prerequisites.** none.
**Applied in.** Any paired activity; onboarding to group units.

---

### CT-B2 · Sharing Work and Credit Fairly
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Responsible Decision-Making · ATL Social

**In one line.** Describe who did what on a group project, honestly, without either over-claiming or hiding.

**Learning outcomes.** Student can…
- produce a one-paragraph credit statement for a group project that names each member and what they did;
- identify over-claiming and under-claiming language (the "we" that means "mostly me");
- explain why credit fairness matters for *future* group trust, not just this assignment.

**Demo of competency.** Produce a written credit statement for a completed group piece that all group members sign off as accurate.

**Quiz prompt seeds.** over-claim vs. under-claim · the "we" that hides a dominator · what to do when a group member did nothing · credit vs. blame.

**Prerequisites.** none.
**Applied in.** All group units; summative deliverables; PP reflections.

---

### CT-S1 · Roles in a Team
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** ATL Social · WEF Leadership and Social Influence

**In one line.** Recognise the roles a healthy team needs (coordinator, builder, checker, connector) and take the role the team is missing.

**Learning outcomes.** Student can…
- identify the four named roles on a provided team-case study;
- demonstrate taking a role they are *not* naturally drawn to for a 20-minute task;
- explain the sign that a team has two of the same role and no-one in another.

**Demo of competency.** Complete a 20-minute team task while visibly playing an assigned role, observed by a peer with a role-behaviour checklist (≥ 3/5 observations met).

**Quiz prompt seeds.** builder vs. coordinator · why every team needs a checker · the two-connectors / no-builder failure mode · taking a role you don't love.

**Prerequisites.** CT-B1.
**Applied in.** Group design projects; Service units; Open Studio teams.

---

### CT-S2 · Resolving a Disagreement
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** CASEL Relationship Skills · CASEL Social Awareness

**In one line.** Move a team from a stuck disagreement to a workable decision without anyone feeling steamrolled.

**Learning outcomes.** Student can…
- identify the three common conflict types (preference, data, values) and the right move for each;
- demonstrate a "steel-man" restatement of the opposing view;
- show proposing a third option that satisfies both parties enough to move on.

**Demo of competency.** In a simulated group disagreement, complete the steel-man → propose-a-third-option sequence; both peers confirm they felt heard.

**Quiz prompt seeds.** preference vs. data vs. values conflict · what a steel-man is · when to seek a third option vs. a vote · signs of a festering disagreement.

**Prerequisites.** CT-B1, CP-B2.
**Applied in.** Any group unit; PP mentoring; Open Studio teams.

---

### CT-G1 · Critique Protocols (Kind / Specific / Helpful at Scale)
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** Ron Berger's Ethic of Excellence · Studio Habits: Reflect, Engage & Persist

**In one line.** Run a structured group critique (gallery walk, fishbowl, warm/cool) that produces usable revisions without demoralising the maker.

**Learning outcomes.** Student can…
- identify three critique protocols and when each is appropriate (gallery walk for many / warm-cool for one-on-one / fishbowl for teaching);
- produce a crit protocol agenda for a supplied scenario (group size, artefact stage, time available);
- demonstrate leading a 20-minute crit using their chosen protocol.

**Demo of competency.** Lead a 20-minute group critique of a peer's work using a named protocol, with the maker reporting ≥ 1 actionable revision they now want to try.

**Quiz prompt seeds.** when the gallery walk fails · warm vs. cool feedback framing · the maker's role during crit · how to end a crit well.

**Prerequisites.** CP-S2.
**Applied in.** Crit board sessions; summative reviews; teacher-trained peer assessment.

---

### CT-G2 · Leading a Group Without Bossing
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Leadership · CASEL Self-Awareness · CASEL Relationship Skills

**In one line.** Take responsibility for a team outcome while keeping authorship distributed — lead without becoming the boss.

**Learning outcomes.** Student can…
- identify five leadership moves that are *not* bossing (unblocking, clarifying, advocating, celebrating, asking);
- demonstrate at least three of them in a timed group task;
- argue why a dominant leader is a team risk, not a team asset, past a certain project size.

**Demo of competency.** Observed 30-minute team session where the student holds the "lead" role; observer checklist marks ≥ 3 non-bossing leadership moves and ≤ 1 bossing move.

**Quiz prompt seeds.** unblocking vs. doing-it-yourself · clarifying the goal · the difference between accountability and control · handling a slow teammate.

**Prerequisites.** CT-S1, CT-S2.
**Applied in.** Open Studio team leads; PP extensions; senior-school class leadership.

---

## Domain 5 · Leadership & Influence (LI)

The moves a young person makes to guide a group or change someone's mind — ethically, without authority.

### LI-B1 · Making a Small Decision for a Group
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Responsible Decision-Making · ATL Social

**In one line.** When a group is stuck on a trivial choice, make the call fast and own it.

**Learning outcomes.** Student can…
- identify a "trivial decision" (one where any reasonable option works) versus a "real decision";
- demonstrate making a trivial decision within 15 seconds and announcing it clearly;
- explain why speed matters on trivial choices (time cost of debate > quality cost of the wrong option).

**Demo of competency.** In a timed group task, make three trivial decisions in under 15 seconds each; observer confirms the group moved forward immediately after each.

**Quiz prompt seeds.** trivial vs. real decisions · the "disagree and commit" move · what to say when you're wrong · decision fatigue in small groups.

**Prerequisites.** none.
**Applied in.** Any group activity; Open Studio daily stand-ups.

---

### LI-B2 · Helping Someone Who's Stuck
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Social Awareness · CASEL Relationship Skills

**In one line.** Spot a peer who is stuck and offer help in a way that doesn't feel like rescuing or patronising.

**Learning outcomes.** Student can…
- identify three signs of a stuck peer (stopped, repeated failure, verbal shut-down);
- demonstrate an "offer, don't impose" help opener ("Want a hand with that?");
- explain the difference between helping and taking over.

**Demo of competency.** In a staged scenario, approach a stuck peer, offer help with the right opener, and either help or step back based on the peer's response.

**Quiz prompt seeds.** signs of being stuck · offer vs. impose language · when to walk away · the damage of unsolicited help.

**Prerequisites.** CP-B2.
**Applied in.** Paired workshop time; Stone prereq sessions.

---

### LI-S1 · Running a Stand-Up or Check-In
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** WEF Leadership · ATL Self-Management

**In one line.** Run a 5-minute daily team check-in where everyone reports progress, blockers, and next action.

**Learning outcomes.** Student can…
- identify the three-question stand-up format (what I did / what I'll do / what's blocking me);
- demonstrate timeboxing each person to ≤ 90 seconds;
- produce a one-line blocker summary that the teacher could act on.

**Demo of competency.** Run a live 5-minute stand-up for a team of 3–5 peers, ending with a list of named blockers and owners.

**Quiz prompt seeds.** the three-question structure · why stand-ups are short and standing · what a blocker is (and isn't) · what to do when someone rambles.

**Prerequisites.** CP-B1, CT-B1.
**Applied in.** Open Studio teams; multi-day group projects; after-school clubs.

---

### LI-S2 · Giving Credit and Apologising Well
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 30 min · **Frameworks:** CASEL Self-Awareness · CASEL Responsible Decision-Making

**In one line.** Name specifically what a peer contributed, and when you've messed up, own it cleanly and without drama.

**Learning outcomes.** Student can…
- produce a specific credit statement ("X had the idea to flip the layout" vs. "X helped");
- demonstrate a four-part apology (what I did / why it mattered / no excuses / what I'll do differently);
- identify a fake apology ("sorry you feel that way") and re-write it cleanly.

**Demo of competency.** Produce, in writing or live, one specific credit statement AND one four-part apology for a real recent situation.

**Quiz prompt seeds.** specific vs. vague credit · the fake-apology markers · why "no excuses" is the hardest part · when apology is the wrong move.

**Prerequisites.** CT-B2.
**Applied in.** Group projects; post-crit debriefs; ongoing team culture.

---

### LI-G1 · Ethical Persuasion and Rhetoric
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 75 min · **Frameworks:** WEF Leadership and Social Influence · ATL Communication · CASEL Responsible Decision-Making

**In one line.** Build an argument that a reasonable person could accept, using evidence and ethos, without manipulation or misleading framing.

**Learning outcomes.** Student can…
- identify the three classical appeals (ethos, pathos, logos) and the manipulation version of each (authority-faking, fear-mongering, cherry-picking);
- produce a 300-word argument for a supplied position with all three appeals used honestly;
- argue why manipulation is a *strategic* loss even when it works in the moment (trust erosion).

**Demo of competency.** Produce a 300-word written argument that is reviewed by a peer against a rubric (evidence / structure / ethical use of appeals) with ≥ 3/4 on each.

**Quiz prompt seeds.** ethos vs. authority-faking · emotional appeal vs. fear-mongering · cherry-picking data · the reputation cost of manipulation.

**Prerequisites.** CP-S1, RI-S1.
**Applied in.** Service unit advocacy; summative arguments; debate contexts.

---

### LI-G2 · Leading a Project from Brief to Hand-Off
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 90 min · **Frameworks:** WEF Leadership · ATL Self-Management · PM adjacencies

**In one line.** Take a project from a vague brief to a clean hand-off, managing scope, people, and your own energy along the way.

**Learning outcomes.** Student can…
- produce a brief-to-hand-off project plan covering scope, people, milestones, risks, and close-out;
- demonstrate adjusting the plan mid-project in response to one real surprise (without losing the outcome);
- argue which part of the project most benefited from their leadership specifically.

**Demo of competency.** Complete a real (not simulated) 2–4 week student-led project using the plan, and produce a hand-off document the next person could continue from.

**Quiz prompt seeds.** what a clean hand-off looks like · when to descope vs. extend · the role of the risk register · managing your own energy as a leader.

**Prerequisites.** LI-S1, CT-G2, PM-S1.
**Applied in.** PP projects; Open Studio capstone work; student leadership roles.

---

## Domain 6 · Project Management (PM)

Breaking work down, planning time, and finishing. The invisible skill that separates a finished project from a forever-prototype.

### PM-B1 · Breaking a Task into Steps
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Self-Management · WEF Analytical Thinking

**In one line.** Turn a fuzzy task ("make a poster") into a concrete checklist a friend could follow without asking questions.

**Learning outcomes.** Student can…
- produce a 5–10 step list from a supplied fuzzy task;
- identify which steps depend on other steps;
- compare two breakdowns of the same task and argue which is usable.

**Demo of competency.** Produce a step-by-step breakdown of a supplied task (e.g. "plan and run a class bake sale") that another student can complete without asking clarifying questions.

**Quiz prompt seeds.** what "concrete" means in a step · dependent vs. parallel steps · the signs of a step that's secretly five steps · when to stop breaking down.

**Prerequisites.** none.
**Applied in.** Every unit; Stone "Plan" prereq.

---

### PM-B2 · Reading a Simple Timeline
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Self-Management · ATL Research

**In one line.** Read a deadline, milestone, and dependency off a timeline chart without getting confused.

**Learning outcomes.** Student can…
- identify a deadline vs. a milestone vs. a dependency on a supplied timeline;
- explain what happens to the end-date if one task slips;
- produce a corrected timeline when shown a mistake (e.g. a task scheduled before its dependency).

**Demo of competency.** Produce correct answers on a supplied timeline-reading exercise (4 deadline / 3 milestone / 3 dependency) with ≥ 8/10 correct.

**Quiz prompt seeds.** deadline vs. milestone · what a dependency arrow means · critical path · the "slip one, slip all" problem.

**Prerequisites.** none.
**Applied in.** Any unit with a delivery date; class planners; Open Studio plans.

---

### PM-S1 · Using a Gantt-Style Plan
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Self-Management · WEF Analytical Thinking

**In one line.** Build a Gantt-style plan for a multi-week project that shows what happens when, who's doing it, and where the risks are.

**Learning outcomes.** Student can…
- produce a Gantt chart for a 4–6 week supplied project with ≥ 6 tasks, owners, and at least one dependency;
- identify the critical path on a Gantt chart;
- demonstrate updating the plan mid-project when a task slips.

**Demo of competency.** Produce a Gantt chart for a real student project, then show the same chart updated one week later with actuals vs. plan.

**Quiz prompt seeds.** bars, milestones, and dependencies · why the critical path matters · slippage vs. buffer · when a Gantt is overkill.

**Prerequisites.** PM-B1, PM-B2.
**Applied in.** Summative projects; PP planning; Open Studio planning stations.

---

### PM-S2 · Estimating How Long Something Takes
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** ATL Self-Management · WEF Analytical Thinking

**In one line.** Make a time estimate that is useful to a team — not optimistic, not padded beyond reason — and track it against reality.

**Learning outcomes.** Student can…
- produce an estimate for a supplied task using the three-point method (best / likely / worst);
- identify two estimation biases they hold (optimism, last-time-it-took-one-hour);
- demonstrate tracking actual time against estimate and explaining the gap.

**Demo of competency.** Produce three-point estimates for the next five tasks of a real project, then record actuals a week later and explain the gap for each.

**Quiz prompt seeds.** best / likely / worst ranges · the planning fallacy · scope creep vs. underestimation · the "just 10 more minutes" trap.

**Prerequisites.** PM-B1.
**Applied in.** Stone work estimation; PP time planning; fabrication job time-blocks.

---

### PM-G1 · Managing Scope and Change
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Analytical Thinking · ATL Self-Management

**In one line.** Decide, during a project, what to cut, what to keep, and what to add when the world changes mid-build.

**Learning outcomes.** Student can…
- identify a change that warrants a scope conversation vs. a change small enough to absorb;
- produce a "change request" one-pager (what changed / why / options / recommendation);
- argue for a descope decision over an extension in a situation where both are technically possible.

**Demo of competency.** Produce a written scope-change decision on a real project with the options, recommendation, and who signs off.

**Quiz prompt seeds.** scope creep patterns · the cost-schedule-quality triangle · descope vs. extension trade-offs · who has authority to approve.

**Prerequisites.** PM-S1, PM-S2.
**Applied in.** PP projects; Open Studio capstone; multi-class collaborative briefs.

---

### PM-G2 · Running a Risk Register
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Analytical Thinking · ATL Self-Management

**In one line.** Surface the things that could go wrong before they do, pre-decide what you'd do, and review regularly.

**Learning outcomes.** Student can…
- produce a risk register with ≥ 5 risks, each with likelihood, impact, and a mitigation plan;
- identify the top two risks by likelihood × impact and argue their choice;
- demonstrate updating the register in response to a new risk appearing mid-project.

**Demo of competency.** Produce a live risk register for a real student project at kickoff, then present an updated version mid-project showing two changes and the reasoning.

**Quiz prompt seeds.** likelihood vs. impact scoring · accept / mitigate / transfer / avoid · the "unknown unknowns" gap · when the register becomes theatre.

**Prerequisites.** PM-S1.
**Applied in.** Fabrication jobs with real deadlines; PP projects; Service unit logistics.

---

## Domain 7 · Finance & Enterprise (FE)

Money-literacy for young makers — budgets, pricing, value. Keeps the focus on making-related money decisions, not general personal finance.

### FE-B1 · Budgeting for a School Project
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 45 min · **Frameworks:** ATL Self-Management · WEF Analytical Thinking

**In one line.** Work out what a project will cost before you start, and track what you actually spent.

**Learning outcomes.** Student can…
- produce an itemised budget for a supplied project (≥ 6 items with quantity, unit cost, total);
- identify at least one "hidden" cost the naive version missed (postage, wastage, consumables);
- demonstrate updating the budget with actuals at the project end.

**Demo of competency.** Produce a pre-project budget and a post-project actuals sheet for a real classroom project, explaining each line that came in different from plan.

**Quiz prompt seeds.** fixed vs. variable cost · the difference between quoted and delivered cost · what wastage is · how to spot a forgotten line item.

**Prerequisites.** none.
**Applied in.** Fabrication jobs; Service-unit events; PP logistics.

---

### FE-B2 · Needs vs. Wants (in Making)
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Thinking · CASEL Responsible Decision-Making

**In one line.** For a project, tell the difference between a material / feature the design *needs* and one the maker would just *like*.

**Learning outcomes.** Student can…
- identify needs vs. wants on a supplied project component list;
- produce a ranked list where every "want" has a justification against the budget;
- argue for cutting a want that's secretly undermining a need.

**Demo of competency.** Produce a needs/wants-labelled component list for a real design with a 50-word rationale for each want that survives.

**Quiz prompt seeds.** signs of a want dressed up as a need · the "just in case" spiral · value per dollar · when a want becomes critical.

**Prerequisites.** FE-B1.
**Applied in.** Any brief with a cost ceiling; fabrication material choice.

---

### FE-S1 · Pricing a Product (Cost, Margin, Value)
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** WEF Analytical Thinking · ATL Thinking

**In one line.** Set a price for something you've made that covers your costs, leaves a margin, and is defensible to the buyer.

**Learning outcomes.** Student can…
- produce a unit-cost calculation including materials, time, and overhead;
- identify the three pricing strategies (cost-plus / competitive / value-based) and when each fits;
- argue a price point against a peer's price point for the same product.

**Demo of competency.** Produce a one-page pricing rationale for a real or imagined product, with the unit cost, chosen margin, strategy used, and competitor check.

**Quiz prompt seeds.** cost-plus vs. value-based pricing · the role of perceived value · break-even units · how to raise a price without losing customers.

**Prerequisites.** FE-B1, FE-B2.
**Applied in.** School market events; enterprise projects; design briefs with pricing.

---

### FE-S2 · Reading a Simple Balance of Money
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** ATL Research · WEF Analytical Thinking

**In one line.** Read a simplified income-and-expenses sheet for a project or club and spot whether it's healthy or in trouble.

**Learning outcomes.** Student can…
- identify income, expense, and net result on a simplified sheet;
- explain the difference between a one-off loss and a recurring loss;
- produce a corrected sheet when shown a version with one error.

**Demo of competency.** Produce correct analysis on a supplied club-finances sheet (3–5 questions on income, expense, trend, health) with ≥ 4/5 correct.

**Quiz prompt seeds.** income vs. expense categorisation · the difference between cash and commitment · spotting a recurring trend · what "in the red" really means.

**Prerequisites.** FE-B1.
**Applied in.** Service unit finance; school club treasurer roles; PP-budget reflection.

---

### FE-G1 · Pitching for Funding
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 75 min · **Frameworks:** WEF Leadership · ATL Communication · FE progression

**In one line.** Ask someone for money (or materials, or time) for a project in a way that respects their constraints and gives them a clear decision to make.

**Learning outcomes.** Student can…
- produce a one-page funding ask covering what, why, how much, what they get back, and what happens if funded vs. not;
- identify a weak ask (vague amount, no ROI, no fallback);
- demonstrate delivering the ask live to a teacher or external assessor who scores it against a rubric.

**Demo of competency.** Deliver a live funding pitch (real or simulated external decision-maker) for a real student project; rubric-scored ≥ 3/4 on each of clarity, specificity, ROI, respect-for-funder.

**Quiz prompt seeds.** what a funder actually needs to know · the specificity-of-ask rule · ROI for non-commercial funders · handling a "no."

**Prerequisites.** FE-S1, CP-S1.
**Applied in.** PP projects; Service unit resource-raising; real grant applications.

---

### FE-G2 · Evaluating a Business Model Canvas
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 90 min · **Frameworks:** WEF Analytical Thinking · ATL Thinking

**In one line.** Take a product or service idea and pressure-test it across the nine boxes of the Business Model Canvas.

**Learning outcomes.** Student can…
- identify the nine boxes of the canvas and the function of each;
- produce a filled canvas for a supplied idea with at least one entry per box;
- argue which box is the weakest for that idea and what it would take to strengthen it.

**Demo of competency.** Produce a completed Business Model Canvas for a student idea plus a 150-word "weakest box" critique.

**Quiz prompt seeds.** customer segments vs. value proposition · the role of key partners · revenue streams vs. cost structure · what "channels" really means.

**Prerequisites.** FE-S1, FE-S2.
**Applied in.** Enterprise units; PP extensions; post-A-Level capstones.

---

## Domain 8 · Research & Inquiry (RI)

Asking questions, finding out, and not being fooled. The backbone of any Discovery or Service unit.

### RI-B1 · Asking Good Questions
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Research · Studio Habits: Observe, Envision · WEF Curiosity

**In one line.** Turn a vague wondering into questions sharp enough that an answer is possible.

**Learning outcomes.** Student can…
- identify open vs. closed questions and when each is useful;
- produce five open and five closed questions on a supplied topic;
- demonstrate *improving* a weak question (too broad, too leading) into a better one.

**Demo of competency.** Produce ten questions (five open, five closed) on a supplied topic that a peer rates as "I could answer that" or "that would teach me something."

**Quiz prompt seeds.** open vs. closed · leading questions · the "five whys" technique · when to ask vs. look up.

**Prerequisites.** none.
**Applied in.** Any Research stage; Service unit interviews; PP framing.

---

### RI-B2 · Taking Notes from One Source
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Research · ATL Communication

**In one line.** Read or watch one source and come away with notes that capture what it said, in your own words, with the reference.

**Learning outcomes.** Student can…
- produce a one-page notes summary of a supplied article or video in their own words;
- identify the reference information needed to re-find the source (title, author, URL, date);
- explain the difference between quoting, paraphrasing, and summarising.

**Demo of competency.** Produce a one-page notes summary of a supplied source that a peer can understand without reading the original, with full reference information.

**Quiz prompt seeds.** quote vs. paraphrase vs. summary · what a reference needs · the "in your own words" test · when copy-pasting becomes plagiarism.

**Prerequisites.** none.
**Applied in.** All research-based units; Stone "Research" prereq.

---

### RI-S1 · Evaluating Source Credibility (Lateral Reading)
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** ATL Research · WEF Analytical Thinking · DL adjacency

**In one line.** Check whether a source is trustworthy by leaving it and looking up the author and publisher — faster and better than reading the page itself.

**Learning outcomes.** Student can…
- demonstrate lateral reading on a supplied unknown source (checks author, publisher, date, cross-reference in < 3 minutes);
- identify three credibility red flags (anonymous author, no date, emotional language);
- compare the CRAAP method and lateral reading and argue when each fits.

**Demo of competency.** Produce a credibility judgement on a supplied unknown source with a ≤ 200-word rationale showing what they looked up and why.

**Quiz prompt seeds.** lateral reading vs. on-page evaluation · why Wikipedia is a starting point, not a source · what *.gov* / *.edu* really mean · signs of paid advocacy.

**Prerequisites.** RI-B2, DL-B2.
**Applied in.** Research units; Service unit stakeholder mapping; any unit citing sources.

---

### RI-S2 · Running a Short User Interview
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** ATL Research · CASEL Social Awareness · WEF Empathy

**In one line.** Sit with a user (peer, teacher, family member) and learn what they actually do, feel, and need without leading them to your answer.

**Learning outcomes.** Student can…
- produce an interview guide (5–7 open questions, ordered broad-to-specific);
- demonstrate active listening during a mock 5-minute interview;
- identify one leading question in their own guide and rewrite it.

**Demo of competency.** Conduct a live 10-minute interview with a real (not simulated) user; produce a transcript excerpt + three observed insights.

**Quiz prompt seeds.** leading vs. open questions · interview-er vs. interviewee airtime · what to do with silence · the "tell me about the last time..." move.

**Prerequisites.** RI-B1, CP-B2.
**Applied in.** Service units; Discovery research; PP stakeholder work.

---

### RI-G1 · Designing a Survey
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 75 min · **Frameworks:** ATL Research · WEF Analytical Thinking

**In one line.** Build a short survey that will actually give you information, not just confirmation of what you already believed.

**Learning outcomes.** Student can…
- identify the four common question types (Likert, multiple choice, open text, rank) and when each fits;
- produce a 6–10 question survey with a stated research question and no leading items;
- argue why their sample size is (or is not) adequate for the conclusion they want to draw.

**Demo of competency.** Produce a survey that a peer reviewer can't find a leading question in, plus a 150-word note on sample and what the data will and won't let them conclude.

**Quiz prompt seeds.** Likert scale pitfalls · leading-question patterns · sample size vs. confidence · the difference between "significant" and "meaningful."

**Prerequisites.** RI-B1, RI-S2.
**Applied in.** Research-heavy Service units; PP research; evaluation of final design.

---

### RI-G2 · Synthesising Findings into Themes
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 75 min · **Frameworks:** ATL Research · ATL Communication · WEF Analytical Thinking

**In one line.** Take 10+ notes / interview quotes / observations and turn them into 3–5 themes that actually change your design direction.

**Learning outcomes.** Student can…
- demonstrate an affinity mapping process (one note per sticky, group, name);
- produce 3–5 named themes that cover at least 70% of the input notes;
- argue which theme most warrants acting on and why.

**Demo of competency.** Produce a photographed affinity map + a written 200-word summary of the top theme and its design implication for a real project.

**Quiz prompt seeds.** what makes a theme vs. a category · the 70% coverage rule · themes vs. quotes · acting on a theme.

**Prerequisites.** RI-B2, RI-S2.
**Applied in.** Service unit synthesis; Discovery research summaries; PP findings.

---

## Domain 9 · Digital Literacy & Citizenship (DL)

Using digital tools well, safely, and ethically. Includes AI, privacy, sourcing, and online conduct.

### DL-B1 · File Management and Naming
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Self-Management · WEF Technological Literacy

**In one line.** Name and organise files so that you — and anyone you hand them to — can find the right one in under 10 seconds.

**Learning outcomes.** Student can…
- identify the three worst file-naming patterns (Untitled-3.pdf, Final-final.pdf, Document1.docx);
- produce a renamed set of files using a convention (project-version-date);
- demonstrate a folder structure (three levels deep max) for a supplied project.

**Demo of competency.** Produce a cleaned, renamed, organised version of a supplied "messy desktop" folder in under 20 minutes.

**Quiz prompt seeds.** why "Final-final" is a symptom · versioning vs. dating · when to flatten vs. nest folders · naming collisions.

**Prerequisites.** none.
**Applied in.** Every digital deliverable; fabrication file submission; portfolio hand-in.

---

### DL-B2 · Spotting Obvious Misinformation
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** ATL Research · CASEL Responsible Decision-Making

**In one line.** Notice the three most common signs of fake or misleading online content before sharing or acting on it.

**Learning outcomes.** Student can…
- identify three red flags (emotional hook headline, no author/date, no linked source);
- demonstrate the "pause before you share" move;
- explain why sharing a misleading post causes harm even if you meant well.

**Demo of competency.** Produce correct red-flag analysis on a supplied set of 5 social-media posts (at least 3 misleading, 2 real) with ≥ 4/5 correct.

**Quiz prompt seeds.** emotional-hook headlines · missing author / date · reverse-image-search tactic · the sharing-harm amplification effect.

**Prerequisites.** none.
**Applied in.** Research units; PP ethics; everyday life.

---

### DL-S1 · Citing Sources and Avoiding Plagiarism
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** ATL Research · CASEL Responsible Decision-Making

**In one line.** Credit others' work correctly so that your own credibility stays intact.

**Learning outcomes.** Student can…
- produce a correctly formatted citation in a named style (MLA / APA / Chicago — teacher chooses) for an article, book, and website;
- identify four levels of sourcing (quote / paraphrase / summary / idea-influence) and when each needs a citation;
- compare a flagged-as-plagiarism passage against a properly cited version and explain the difference.

**Demo of competency.** Produce a paragraph using 3 sources, correctly cited in-text and in a works-cited list, that passes a supplied rubric.

**Quiz prompt seeds.** when a paraphrase still needs a citation · common knowledge vs. cited facts · in-text vs. end-of-document citation · signs of accidental plagiarism.

**Prerequisites.** DL-B1, RI-B2.
**Applied in.** All research-based summatives; PP; exam coursework.

---

### DL-S2 · Using AI as a Thinking Tool (Not an Answer Machine)
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 60 min · **Frameworks:** WEF Technological Literacy · CASEL Responsible Decision-Making · ATL Thinking

**In one line.** Use an AI assistant to push your own thinking further, not to replace it — and recognise when you've crossed that line.

**Learning outcomes.** Student can…
- identify four productive uses of AI in learning (brainstorming, explaining, checking, summarising) and four unproductive uses (writing your essay, faking research, avoiding practice, cheating);
- demonstrate a prompt that asks AI to push back rather than comply ("argue against my idea", "what am I missing?");
- explain *why* offloading thinking is a loss — what skill you don't build if the AI does it for you.

**Demo of competency.** Produce a transcript of an AI interaction for a real school task, annotated with what the student did vs. what AI did, plus a 150-word reflection on "what thinking did I do?"

**Quiz prompt seeds.** brainstorm-with vs. write-for-me prompts · the over-reliance failure mode · when AI is confidently wrong · honesty about AI use in submissions.

**Prerequisites.** DL-B2.
**Applied in.** Every unit in 2026+; aligns with StudioLoom's "no chatbot for students" design philosophy by making AI literacy explicit.

---

### DL-G1 · Privacy, Consent, and Your Digital Footprint
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** CASEL Responsible Decision-Making · ATL Research

**In one line.** Understand what you're giving away online and make deliberate choices about it, for yourself and for other people whose data you touch.

**Learning outcomes.** Student can…
- identify three categories of personal data (identifier, behavioural, inferred) and examples of each;
- produce a "privacy audit" of one of their own accounts with at least three settings changed and explained;
- argue the ethics of posting a photo of another person without explicit consent.

**Demo of competency.** Produce a written privacy audit of one of their accounts (e.g. Instagram, WeChat, school email) with specific settings, rationale, and one "I won't post X without consent" rule they've adopted.

**Quiz prompt seeds.** identifier vs. behavioural data · inferred data (what a service knows that you didn't tell it) · consent that counts (affirmative, specific, ongoing) · GDPR / COPPA basics.

**Prerequisites.** DL-B2.
**Applied in.** PP ethics; Service unit data-handling; everyday life.

---

### DL-G2 · Cybersecurity Basics for Makers
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Networks and Cybersecurity · ATL Self-Management

**In one line.** Protect your accounts, devices, and your team's files against the realistic threats to a secondary student (phishing, password reuse, lost device).

**Learning outcomes.** Student can…
- identify a phishing email's three common tells (urgency, odd sender, mismatched link);
- demonstrate setting up 2FA and a password manager on a supplied account;
- argue why password reuse is the single highest-leverage behaviour to change.

**Demo of competency.** Produce a before/after of their own account security (screenshots or audit sheet) showing 2FA enabled, a unique password set, and a phishing email they correctly identified.

**Quiz prompt seeds.** phishing tells · why reused passwords are a cascade risk · 2FA vs. SMS-only · what to do when an account is compromised.

**Prerequisites.** DL-B1.
**Applied in.** Every school account; PP ethics sections; enterprise & service units handling real data.

---

## Domain 10 · Self-Management & Resilience (SM)

Managing yourself — time, focus, stress, growth — so that the rest of your work is possible. The highest-leverage domain for long-term outcomes.

### SM-B1 · Setting a SMART Goal for the Week
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Self-Management · ATL Self-Management

**In one line.** Set a goal for the week that is Specific, Measurable, Achievable, Relevant, and Time-bound — and judge honestly on Friday whether you hit it.

**Learning outcomes.** Student can…
- identify which of the five SMART criteria a weak goal is missing;
- produce a SMART goal for the coming week on a topic they choose;
- demonstrate a Friday self-review (hit / partial / missed, and one reason).

**Demo of competency.** Produce a Monday SMART goal + a Friday honest self-review for one real week, both reviewed by teacher or peer.

**Quiz prompt seeds.** the SMART acronym · vague vs. specific goals · the honesty trap in self-review · what to do with a missed goal.

**Prerequisites.** none.
**Applied in.** Open Studio weekly check-ins; every unit's phase planning.

---

### SM-B2 · Tidy Workspace, Tidy Mind
**Tier:** Bronze · **Age band:** 11–13 · **Est. time:** 30 min · **Frameworks:** CASEL Self-Management · ATL Self-Management · Studio Habits: Develop Craft

**In one line.** Set up and reset a physical and digital workspace so it helps rather than fights against your work.

**Learning outcomes.** Student can…
- identify three "friction" items on a messy workspace (things that slow them every session);
- demonstrate a 5-minute reset at the start and end of a work session;
- produce a "pack-down checklist" for their own workspace.

**Demo of competency.** Produce a before/after photo of their workspace + a written pack-down checklist they've used for a week.

**Quiz prompt seeds.** friction vs. mess · the 5-minute reset · digital workspace applies too (tabs, desktop) · what a pack-down list catches.

**Prerequisites.** DL-B1 (digital equivalent).
**Applied in.** Workshop time; Open Studio daily close; portfolio maintenance.

---

### SM-S1 · Managing Distractions and Deep Work
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 45 min · **Frameworks:** CASEL Self-Management · ATL Self-Management · WEF Curiosity & Lifelong Learning

**In one line.** Get a 25–45 minute block of focused work with phone/notifications off and produce more in that block than in an hour of split attention.

**Learning outcomes.** Student can…
- identify their top three distraction triggers honestly (not the socially acceptable answer);
- demonstrate a 25-minute phone-off work block with observable output;
- compare output from a deep-work block against output from a split-attention equivalent period.

**Demo of competency.** Produce two 25-minute work logs on the same task type — one with distraction controls, one without — and a written compare-and-reflect.

**Quiz prompt seeds.** attention residue · why "just checking" costs more than it looks · environment design vs. willpower · when deep work is the wrong mode.

**Prerequisites.** SM-B1.
**Applied in.** Any unit with independent work; Open Studio sessions; PP work time.

---

### SM-S2 · Asking for Help the Right Way
**Tier:** Silver · **Age band:** 13–15 · **Est. time:** 30 min · **Frameworks:** CASEL Relationship Skills · ATL Communication

**In one line.** Ask for help after you've done your first honest attempt — with enough context that the helper can help in 30 seconds.

**Learning outcomes.** Student can…
- identify the four elements of a good help request (what I'm trying to do / what I tried / what happened / what I think might be wrong);
- demonstrate turning a bad request ("it's not working") into a good one;
- argue when to ask vs. when to push further before asking.

**Demo of competency.** Produce a written or spoken help request on a real stuck-point that a peer rates ≥ 3/4 on all four elements.

**Quiz prompt seeds.** the four elements · the 20-minute stuck rule · when asking too early is a cost · when asking too late is worse.

**Prerequisites.** CP-B1, CT-B1.
**Applied in.** Every unit; Open Studio mentor interactions; teacher drop-in time.

---

### SM-G1 · Growth Mindset in Practice (Not Just Slogans)
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** CASEL Self-Awareness · Studio Habits: Engage & Persist, Stretch & Explore · WEF Resilience

**In one line.** Spot a fixed-mindset reaction in the moment and substitute a specific next action instead of a self-talk phrase.

**Learning outcomes.** Student can…
- identify three fixed-mindset tells in their own self-talk ("I'm just not a X person", "I'll never get this", "I tried once");
- demonstrate substituting a fixed-mindset statement with a specific next action ("I'll attempt one small version by Friday");
- argue against the "just think positive" version of growth mindset as insufficient.

**Demo of competency.** Produce a one-week log of three fixed-mindset moments and the substituted action for each, with a final reflection on which substitution actually helped.

**Quiz prompt seeds.** fixed vs. growth tells · why "try harder" is a weak substitute · specific next action vs. affirmation · when persistence becomes stubbornness.

**Prerequisites.** SM-B1, SM-S2.
**Applied in.** Open Studio long projects; PP struggle points; post-failed-prototype reflection.

---

### SM-G2 · Recovering from a Failed Prototype
**Tier:** Gold · **Age band:** 15–18 · **Est. time:** 60 min · **Frameworks:** WEF Resilience · Studio Habits: Engage & Persist, Reflect · CASEL Self-Management

**In one line.** When something you made doesn't work, separate the failure of the prototype from a failure of yourself, learn what the artefact taught you, and start the next iteration without drama.

**Learning outcomes.** Student can…
- produce a "what the prototype taught me" analysis distinguishing the design lesson from the emotional reaction;
- identify three useful moves (sit with it, talk to someone, sketch the next version) vs. three unhelpful moves (hide it, blame a tool, abandon);
- demonstrate starting the next iteration within one session of the failure.

**Demo of competency.** Produce a written reflection on a real failed prototype — what it taught me, what I felt, what I tried next, and a photo of the next iteration started within 24 hours.

**Quiz prompt seeds.** prototype failure vs. self failure · useful vs. performative reflection · the "start the next one today" rule · when to pause vs. push through.

**Prerequisites.** SM-B1, SM-S1, CP-S2.
**Applied in.** Any unit past the first prototype; PP capstones; Open Studio hard weeks.

---

## Controlled verb glossary

Every *demo of competency* uses one of these verbs, each with a fixed meaning.

| Verb | Meaning |
|---|---|
| **show** | Physically produce the thing in front of an assessor. |
| **demonstrate** | Perform the skill on a real task while observed. |
| **produce** | Submit an artefact (document, sketch, video, photo) that can be reviewed later. |
| **explain** | Articulate, in own words (written or spoken), that clearly transfers the idea to someone who didn't know it. |
| **argue** | Take a position and defend it with at least two pieces of evidence or reasoning. |
| **identify** | Correctly name or select from a given set. |
| **compare** | Lay out similarities and differences across two or more items with explicit criteria. |
| **sketch** | Produce a freehand visual that communicates the idea, not necessarily to scale. |
| **make** | Produce a finished physical or digital object that meets a supplied brief. |
| **plan** | Produce a dated, sequenced plan with owners and dependencies named. |
| **deliver** | Perform a spoken piece (pitch / story / meeting) within a time budget. |

Banned verbs on demo lines: *understand, know, be aware of, appreciate, familiarise with.* Unverifiable — and therefore not usable as a competency gate.

## Coverage check (against WEF Future of Jobs 2025 core skills)

| WEF core skill | Where it lives in this catalogue |
|---|---|
| Analytical thinking | PM-B1, PM-S1, PM-S2, PM-G1, FE-S1, FE-S2, FE-G2, RI-G1, RI-G2, VC-G1 |
| Creative thinking | DM-S1, VC-G1, CP-G1, Studio-habits-aligned throughout |
| Resilience, flexibility, agility | SM-G1, SM-G2, PM-G1, CT-S2 |
| Leadership and social influence | CP-G2, CT-G2, LI-S1, LI-G1, LI-G2, FE-G1 |
| Motivation and self-awareness | SM-B1, SM-G1, LI-S2 |
| Technological literacy | DM-S2, DM-G1, DL-B1, DL-S2, DL-G2 |
| Empathy and active listening | CP-B2, CT-S2, RI-S2 |
| Curiosity and lifelong learning | RI-B1, SM-S1, Studio Habits carriers throughout |
| Talent management | CT-S1, CT-G2, LI-S2, CP-G2 |
| Service orientation & customer service | RI-S2, FE-S1, CP-G1 |

No top-10 WEF gap. Missing by design: no operator-specific or software-specific skills (students pick those up in-unit); no subject-knowledge skills (those live in units, not in the skills library).

## Coverage check (against CASEL 5 and MYP ATL)

| Framework axis | Representative cards |
|---|---|
| CASEL Self-Awareness | SM-G1, LI-S2 |
| CASEL Self-Management | SM-B1, SM-B2, SM-S1, PM-B1, PM-S1, PM-S2 |
| CASEL Social Awareness | CP-B2, CT-S2, RI-S2, LI-B2 |
| CASEL Relationship Skills | CP-B1, CP-S2, CT-B1, CT-S2, LI-B2, SM-S2 |
| CASEL Responsible Decision-Making | CT-B2, LI-G1, DL-B2, DL-S1, DL-G1 |
| ATL Thinking | VC-B1, VC-G1, PM-G1, FE-B2, FE-G2 |
| ATL Research | RI-B1, RI-B2, RI-S1, RI-S2, RI-G1, RI-G2 |
| ATL Social | CT-B1, CT-B2, CT-S1, LI-S1 |
| ATL Communication | CP-B1–G2, VC-S1, VC-G2 |
| ATL Self-Management | SM-B1–G2, PM-B1–G2, DL-G2 |

All five CASEL competencies and all five ATL categories have ≥ 2 cards. No axis is empty.

---

## PYPx Pack — Primary companion catalogue (6 cards)

**Age band:** 10–11 (G5 / Y6). Distinct from the main 60-card catalogue, which is secondary (ages 11–18).

**Context.** The PYP Coordinator wants Project Management support for students doing the **Primary Years Programme Exhibition** (PYPx) — the G5 capstone. A 6–8-week self-directed inquiry in small groups, culminating in a public exhibition. The main catalogue's PM cards are scoped to ages 11–18 and their cognitive complexity doesn't fit a 10-year-old. This pack sits alongside them: Bronze / Silver / Gold as a mini-ladder scoped to PYPx specifically.

**Why this shape instead of stretching PM-B1 downward.** The PM Bronze cards in the main catalogue (`PM-B1 Breaking a Task into Steps`, `PM-B2 Reading a Simple Timeline`) assume an abstract planning mindset that Y7 students have but G5 students don't yet. G5 students need **concrete, project-embedded PM** — not "here's the concept of a timeline," but "here's your Monday–Friday for week 3 of your PYPx." This pack is written at that level.

**Display rule.** UI filters cards by the viewing student's age band. A G5 student sees this pack; a Y10 student never does. Teachers see both with an explicit Age Band filter.

**Naming convention.** Cards in this pack are prefixed `PYPX-` rather than `PM-` to keep them visually distinct in the teacher library. Tier codes follow the same Bronze / Silver / Gold pattern.

**Framework anchors.** All 6 cards map to PYP ATL categories (Self-Management, Social, Communication) — the same 5-category ATL framework as MYP, but primary labels match PYP's native "PYP ATL" language.

---

### PYPX-B1 · Starting your PYPx plan
**Tier:** Bronze · **Age band:** 10–11 · **Est. time:** 30 min · **Frameworks:** PYP ATL Self-Management · CASEL Self-Management

**In one line.** Take your PYPx topic and turn it into a plan for the next 6 weeks that you could show your teacher.

**Learning outcomes.** Student can…
- identify the main question they want to answer in their PYPx;
- produce a week-by-week plan for 6 weeks with at least one goal per week;
- explain why having a plan is different from just doing your project as you go.

**Demo of competency.** Produce a one-page plan on paper or a printed template, with a goal for each of the 6 weeks and the name of the group member who will lead each one.

**Quiz prompt seeds.** what a "goal" looks like (specific, finishable) · the difference between a plan and a to-do list · what happens when a week's goal is too big · who should own each week.

**Prerequisites.** none.
**Applied in.** PYPx; any extended project at primary.

---

### PYPX-B2 · Keeping a simple project diary
**Tier:** Bronze · **Age band:** 10–11 · **Est. time:** 30 min · **Frameworks:** PYP ATL Self-Management · Studio Habits: Reflect

**In one line.** Write down what you did on your PYPx each day so that on Friday you (and your teacher) can see how the week went.

**Learning outcomes.** Student can…
- demonstrate filling in a 3-sentence daily entry (what I did / what worked / what I need next);
- identify what to do with the diary when stuck;
- compare a full week of diary entries and say which day had the most progress.

**Demo of competency.** Produce a completed 5-day diary for one PYPx week, with each day's 3-sentence entry filled in at the time (not written retrospectively on Friday).

**Quiz prompt seeds.** what counts as "progress" on a research project · the reason for three short entries a day vs one long one on Friday · what a good "what I need next" line sounds like.

**Prerequisites.** PYPX-B1.
**Applied in.** PYPx daily routine; any primary project spanning more than a week.

---

### PYPX-S1 · Running a group check-in
**Tier:** Silver · **Age band:** 10–11 · **Est. time:** 45 min · **Frameworks:** PYP ATL Social · CASEL Relationship Skills

**In one line.** Run a 5-minute check-in with your PYPx group where each person says what they did, what's blocking them, and what they'll do next.

**Learning outcomes.** Student can…
- identify the three questions in a check-in (what I did / what's next / what's blocking me);
- demonstrate keeping the check-in to 5 minutes with a group of 3–4;
- show waiting until someone has finished before speaking.

**Demo of competency.** Run a 5-minute live group check-in with the student's actual PYPx group, observed by a teacher with a simple checklist (3 questions asked / 5-minute budget met / everyone spoke once).

**Quiz prompt seeds.** why short check-ins beat long meetings · what a "block" is (and isn't) · what to do when someone says "nothing" · handling the dominator.

**Prerequisites.** PYPX-B1.
**Applied in.** PYPx weekly routine; any group project at primary; school leadership roles.

---

### PYPX-S2 · Asking for help from your mentor
**Tier:** Silver · **Age band:** 10–11 · **Est. time:** 30 min · **Frameworks:** PYP ATL Social · CASEL Relationship Skills · CASEL Self-Management

**In one line.** When you see your PYPx mentor, come prepared so the 15 minutes with them moves your project forward.

**Learning outcomes.** Student can…
- produce a one-page "mentor sheet" before the meeting (what I'm working on / what I've tried / what I'm stuck on / specific questions);
- demonstrate leading the first 2 minutes of a mentor meeting (not being led);
- identify the difference between a vague question ("help!") and a specific one.

**Demo of competency.** Produce a filled-in mentor sheet before a real mentor meeting, and the mentor confirms afterwards that the student led the conversation.

**Quiz prompt seeds.** why arriving with notes matters · the specific-vs-vague question test · what to do if you forget your questions · the follow-up email move.

**Prerequisites.** PYPX-B2.
**Applied in.** PYPx mentor meetings; primary student-teacher conferences; interview practice.

---

### PYPX-G1 · When the plan doesn't work
**Tier:** Gold · **Age band:** 10–11 · **Est. time:** 45 min · **Frameworks:** PYP ATL Self-Management · WEF Resilience · Studio Habits: Engage & Persist

**In one line.** When your PYPx hits a wall (your experiment failed, your source was wrong, someone in your group got sick), notice it fast and change the plan without falling apart.

**Learning outcomes.** Student can…
- identify three signs that the PYPx plan isn't working (a week's goal slips twice, the question has changed, a key person is out);
- produce a revised one-week plan in response to a real disruption;
- argue that changing the plan is a strength, not a failure.

**Demo of competency.** Produce a before/after plan pair for one real disruption during the student's PYPx — the original weekly plan + the revised one + a 50-word reason for the change.

**Quiz prompt seeds.** the difference between "the plan changed" and "the plan failed" · who to tell when you change course · when to rescue vs restart · the "learning from the change" reflection.

**Prerequisites.** PYPX-B1, PYPX-B2, PYPX-S1.
**Applied in.** PYPx mid-project pivots; any extended project; life in general.

---

### PYPX-G2 · The exhibition hand-off
**Tier:** Gold · **Age band:** 10–11 · **Est. time:** 60 min · **Frameworks:** PYP ATL Communication · WEF Communication · Studio Habits: Express

**In one line.** Finish the PYPx strongly: present clearly, answer questions honestly, and leave your audience knowing what you found out.

**Learning outcomes.** Student can…
- produce a 3-minute exhibition pitch with a clear opening question, 2–3 findings, and a takeaway for the audience;
- demonstrate answering a question they don't know the answer to without panicking;
- identify what makes an exhibition booth welcoming vs forbidding (eye contact, open body, inviting question).

**Demo of competency.** Deliver the live exhibition pitch to ≥ 3 visitors during the PYPx exhibition, plus a one-page "what a visitor took away" reflection written afterward.

**Quiz prompt seeds.** the "I'm not sure but I'll find out" response · the worst way to open a pitch · why eye contact matters more than volume · reading your visitor's interest level.

**Prerequisites.** PYPX-S1, PYPX-S2.
**Applied in.** PYPx exhibition; any primary showcase; middle school pitch practice as a Bronze precursor to CP-S1.

---

### PYPx pack — design notes

- **Same tier vocabulary** (Bronze / Silver / Gold) as the secondary catalogue, deliberately. Parents + students recognise the ladder across both age bands. What Gold means in the PYPx pack is "top rung for G5 PYPx" — not "equivalent to Y12 Gold."
- **No cross-wiring to secondary prereqs.** A G5 student earning `PYPX-G2` does not unlock the secondary `CP-S1` automatically — they start secondary fresh when they're in the band. Earns remain as historical record, but the ladders are separate progression tracks.
- **Age band is a filter, not a hard lock.** A capable G4 sibling watching a G5 do PYPx can read the card. A G6 who repeated PYPx can revisit. UI filters default to in-band; teachers can show off-band content deliberately.
- **Framework anchors use PYP ATL wording.** Labels match the PYP teacher's vocabulary. Category semantic is the same 5-category ATL framework MYP uses; label wording is PYP-native.
- **Extension path.** If PYP Coordinator requests more after this pack lands (e.g. research or communication skills for PYPx), the same pattern repeats: primary-band cards in a named pack, tier ladder, PYP-ATL anchors. 6 cards per pack is the minimum viable ladder.

---

## Open authoring questions

1. **How many of these does Matt want to write personally vs. crowdsource?** Recommend: Matt writes Gold tier (20 cards) + a sample of Bronze/Silver to anchor voice; teachers and older students co-author the rest.
2. **Silver / Gold demos often require a real assessor moment.** Who signs off if the demo isn't inside a Stone? Candidate: a lightweight "teacher ack" path — teacher taps a single button from the class feed to log the `skill.demonstrated` event.
3. **Should the "routine" format** (Project Zero thinking routine style: a 3–6-step prompt the student runs on their own work) be its own card sub-type? Strong recommend yes — at least four of these Gold cards (RI-G2, SM-G1, SM-G2, CT-G1) would author better as routines than as lesson+quiz.
4. **Age-bands as soft, not hard.** The catalogue uses age bands as *typical*, not *enforced*. A Y9 student crushing their way through Gold should be celebrated, not gated. Confirm the UI treats bands as guidance.
5. **Overlap with Safety Badges.** DM-B1 deliberately sits *above* the per-machine Safety Badges — it is the general workshop literacy, not a replacement for the licence badges (laser, band saw, soldering). The Safety Badge system remains the authority for per-machine licensing.
6. **Overlap with Stones.** Several cards (PM-S1, RI-G2, DM-G1) map very closely to existing Stone phase outputs. Recommend: the card lives in the library as a *transferable* skill, with the Stone applying it in a specific context. A student who has done a Stone-equivalent can test-out via the demo without redoing the lesson.

## Next step after Matt's review

When signed off, this catalogue seeds the `skill_cards` table (one row per card above), with the following fields directly populated from this document: `title`, `domain`, `tier`, `age_band`, `est_minutes`, `description_one_line`, `learning_outcomes`, `demo_of_competency`, `quiz_seeds`, `prerequisites[]`, `framework_anchors[]`, `applied_in[]`. The teaching content (mini-lesson script, video links, worked examples, actual quiz with answer keys) is authored per-card in a second pass.
