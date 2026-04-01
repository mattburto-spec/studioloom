# Project: New Metrics (Melbourne Metrics)

> **Created:** 29 Mar 2026
> **Status:** Research & design phase
> **Goal:** Make Melbourne Metrics feel like a natural part of teaching and learning, not extra work

---

## 1. What We've Already Built

### Components (4 total, ~1,600 lines, all working)

| Component | Lines | What It Does | Where It Lives |
|-----------|-------|-------------|----------------|
| CompetencyPulse | 277 | Student 3-point self-assessment card at lesson checkpoints | Student lesson page, above "Complete & Continue" |
| NMConfigPanel | 456 | Teacher 3-step wizard: pick competency → pick elements → assign to checkpoints | Class Hub → New Metrics tab |
| ObservationSnap | 278 | Teacher 4-point observation modal per student | Teaching Mode → student cards |
| NMResultsPanel | 587 | Results dashboard with Checkpoints + By Element views | Class Hub → New Metrics tab |

### API Routes (5 total, all working)

- `POST /api/teacher/nm-config` — Save NM config per class-unit
- `POST /api/teacher/nm-observation` — Submit teacher observation
- `GET /api/teacher/nm-results` — Fetch all assessments for unit+class
- `POST /api/student/nm-assessment` — Student self-assessment submission
- `GET /api/student/nm-checkpoint/[pageId]` — Get checkpoint config for a page

### Database (3 migrations, all applied)

- Migration 030: `competency_assessments` table + `nm_config` on units
- Migration 032: Fix page_id type (UUID → TEXT)
- Migration 056: RLS policies updated for class_students junction

### Data Model

- Only **Agency in Learning** has full element data (12 elements, 2 year-band progressions)
- Other 6 competencies defined in constants but return empty element arrays
- All 7 competency kit PDFs now available in `docs/Newmetrics/`
- Complete data extraction in `docs/specs/nm-reporting-synthesis.md` (27 unique elements mapped)

### Integration Points

- Student lesson pages: CompetencyPulse appears at configured checkpoints
- Teaching Mode: ObservationSnap button per student (hot pink NM badge)
- Class Hub: Full NM tab with config wizard + results panel
- Teacher dashboard: NM badge on unit rows when enabled
- Pop art visual identity consistent across all components

### What's NOT Built Yet

- Reports (Rocket Report, Fan Profile, Credential)
- Constants expansion (6 competencies still stubbed)
- Multi-competency per unit support
- Broad Development descriptions (the 4-column progression text per element)
- AI evidence harvesting from existing platform signals
- Export/print functionality

---

## 2. The Point of New Metrics — What Melbourne Actually Wants

This is worth understanding deeply because it shapes everything we build.

### The Old Grammar vs New Grammar

The kits all frame the same fundamental shift. The "old grammar of schooling" measures learning through standardised tests, content recall, and grade-point averages. It tells you whether a student can solve a quadratic equation but not whether they can navigate ambiguity, collaborate under pressure, or reflect meaningfully on their own learning.

Melbourne's "new grammar" says: **the complex competencies that matter most for thriving in life — agency, ethical reasoning, citizenship, communication, collaboration, quality thinking, personal development — are teachable, observable, and assessable.** But they require fundamentally different assessment approaches than a history exam.

### Why Ruby Exists (And Why It's Clunky)

Ruby solves a specific problem: **how do you reliably place a learner on a 5-level progression scale for a complex competency?**

Their answer is behavioural micro-judgements — scenario-based MCQs where each answer maps to a level without the teacher knowing which level. This reduces bias (teacher doesn't think "Jamie is a Level 3 student" and then select Level 3 answers — they choose the behaviour they actually observe, and the system maps it to a level).

It's psychometrically sound. It's also exhausting. 10-22 questions per student per competency, sitting in a separate platform, divorced from the classroom context where you actually observed those behaviours. The kits themselves say to only do it 1-2 times per year. That frequency limitation isn't a feature — it's an admission that the process is too heavy to do more often.

### What Melbourne Actually Cares About

Reading between the lines of all 7 kits, Melbourne's real goals are:

1. **Shift teacher attention** — from "did they learn the content" to "are they developing as learners, thinkers, citizens." The kits repeatedly emphasise that competency development happens *through* content learning, not instead of it. The goal is to change what teachers notice and value.

2. **Give students language for growth** — the progression levels (Directed Learner → Unbound Learner, Functional Communicator → Influential Communicator) give students a vocabulary for their own development that isn't tied to test scores. A student who knows they're an "Active Communicator" working toward "Attuned Communicator" has a qualitatively different self-understanding than one who knows they got a B in English.

3. **Make competencies visible and valued** — the reports, credentials, and fan profiles exist to give competency development the same institutional weight as academic grades. If competencies only live in teacher observations but never appear on reports, they're implicitly second-class.

4. **Build evidence over time** — a single assessment is a snapshot. The real value is the trajectory. A student who moves from Guided Collaborator to Responsible Collaborator over a year has demonstrated genuine growth that matters more than any single observation.

5. **Connect assessment to learning design** — the "Teaching for Competence" tables in the kits (page 12 of each) explicitly show that higher competency levels require specific teaching conditions: more openness of process, more student autonomy, more authentic contexts, longer timescales, broader connections. Assessment should inform how you teach, not just what you report.

### The Fundamental Tension

Melbourne wants rich, reliable competency data collected frequently enough to show growth trajectories. Ruby's approach (thorough but heavy) means you can only do it 1-2 times a year. That's not enough data points to show a trajectory — it's two snapshots. You need something that can be done continuously with near-zero overhead to actually fulfil the vision.

**This is the gap StudioLoom can fill.**

---

## 3. What StudioLoom Already Does That Generates Competency Evidence

This is the key insight: **StudioLoom is already a competency development platform. It just doesn't know it yet.**

### Evidence Flowing Through the Platform Right Now

| StudioLoom Feature | What's Happening | Competency Evidence Being Generated |
|---|---|---|
| **Design Assistant conversations** | Student asks for help, discusses ideas, responds to Socratic prompts | Engaging in Dialogue (all 7), Using Reason (3), Being Reflective (3), Generating Feedback Loops (2) |
| **Toolkit sessions — SCAMPER, Six Hats, etc.** | Student generates ideas, works through structured thinking tools | Acting Creatively (1), Being Open to the New (2), Being Systematic (1), Quality Thinking elements broadly |
| **Toolkit — Five Whys depth detection** | AI detects whether student goes deeper or sideways | Using Reason, Being Reflective, Being Persistent |
| **Toolkit — Empathy Map** | Student considers others' perspectives, identifies emotions | Being Empathetic (5 competencies!), Comprehending Meaning, Navigating Diverse Interests |
| **Toolkit — Stakeholder Map** | Student identifies and considers different people's needs | Being Empathetic, Navigating Diverse Interests, Taking Responsibility for Others |
| **Open Studio sessions** | Student works independently, manages their own time and direction | Acting with Autonomy, Demonstrating Drive, Managing Ambiguity or Uncertainty |
| **Open Studio drift detection** | Student stays focused (or doesn't) | Being Responsible, Demonstrating Drive, Striving for Mastery |
| **Open Studio check-ins** | Student responds to mentor prompts about progress | Being Reflective, Generating Feedback Loops, Engaging in Dialogue |
| **Peer Gallery reviews** | Student gives structured feedback on classmates' work | Being Respectful, Being Empathetic, Conducting Personal Relationships, Taking Responsibility for Others |
| **Gallery effort-gating** | Student must review others before seeing own feedback | Being Responsible, Being Respectful |
| **Reflections (effort-gated)** | Student writes meaningful reflections (12+ words, no filler) | Being Reflective (3 competencies), Using Reason |
| **MonitoredTextarea integrity** | Student writes independently vs paste-heavy | Acting with Autonomy, Acting with Ethical or Moral Integrity, Being Responsible |
| **Discovery Engine** | Student explores strengths, interests, fears, values | Agency broadly, Personal Development broadly, self-knowledge |
| **Pace feedback** | Student reports "too fast / just right / too slow" over time | Self-regulation (Agency), self-awareness (Personal Dev) |
| **Safety badge tests** | Student demonstrates workshop safety knowledge | Being Responsible, Using Tools (Communication) |

**That's evidence for 22 of 27 elements being generated passively right now.** The 5 missing are mostly about community connection (Belonging to Community and Culture, Building Social Alliances in the civic sense, Active Citizenship's community-level elements) — those require real-world interactions that a digital platform can't capture directly.

### The Problem

All of this evidence exists as raw platform data — effort scores, depth dots, word counts, drift flags, integrity scores, review quality. None of it is currently mapped to competency elements. It's like having a goldmine but no one's mining it.

---

## 4. How StudioLoom Makes NM Effortless

### The Core Principle

**Teachers shouldn't have to "do NM." NM should happen because they're teaching well on StudioLoom.**

If a teacher is running a unit through StudioLoom — using the toolkit, having students work through lessons, running Teaching Mode, using Open Studio — competency evidence is already flowing. The teacher's only job should be occasional confirmation: "Yes, I saw that too" or "Actually, I'd rate that higher."

### The Three Layers

**Layer 1: Automatic Evidence Collection (zero teacher effort)**

The AI watches what students do on the platform and maps behaviours to competency elements. This runs in the background, always on, requiring nothing from the teacher.

Examples of what the AI notices:
- Jamie used the Five Whys tool and went 4 levels deep (previous best was 2) → signal for Using Reason, Being Persistent, Being Reflective
- Sam's peer gallery review used specific feedback language and referenced design elements → signal for Being Respectful, Engaging in Dialogue, Conveying Meaning
- Alex stayed focused for 45 minutes in Open Studio with zero drift flags → signal for Acting with Autonomy, Demonstrating Drive
- Jordan's Design Assistant conversation included pushback on the AI's suggestion with reasoning → signal for Acting with Courage, Using Reason, Acting with Judgement

This layer produces **suggested evidence** — the AI's interpretation of what competency signals it detected. It's never the final word. It's a conversation starter.

**Layer 2: Teacher Micro-Observations (10 seconds each, during normal teaching)**

This is the existing ObservationSnap but redesigned to be faster and more contextual:

- During Teaching Mode, the teacher sees a subtle glow around a student's card when the AI has detected something interesting ("Jamie just showed strong autonomy — tap to confirm or adjust")
- One tap to confirm the AI's suggestion. Two taps to adjust the rating. That's it.
- The teacher can also initiate an observation unprompted (current flow) — they see something in the workshop and want to note it.
- Observations feel like "noting what you see" not "filling out a rubric."

**Layer 3: Student Self-Reflection (meaningful, not tick-box)**

The current CompetencyPulse is a 3-point rating scale. It works but it's a bit abstract — "This was hard for me / I'm getting there / I did this well" about an element like "Being Reflective."

Better approach: **contextual reflection prompts that surface competency awareness without feeling like assessment.**

Instead of "Rate yourself on Being Reflective":
> "You just finished your Five Whys analysis. Looking back, what made you dig deeper on step 3 instead of staying surface-level?"

The student's answer IS evidence of reflection — and the quality of the answer maps to a level:
- L1: "I don't know" or generic filler
- L2: "The question made me think about it more"
- L3: "I realised the first answer was a symptom, not the cause, so I pushed deeper"
- L4: "I used a technique from last week's lesson where we looked at root causes in the chair design project"

The student doesn't rate themselves on a scale. They respond to a real question about what they just did. The AI interprets the response and maps it to a level. The teacher sees the response AND the AI's interpretation and can adjust.

### What This Looks Like for a Teacher

**Monday morning, Period 2, Year 8 Design:**

1. Teacher opens Teaching Mode. Students are working on prototyping.
2. Teacher walks the room. Notices Sam helping a classmate with the laser cutter.
3. On the Teaching Mode dashboard, Sam's card has a subtle pulse — the AI noticed Sam just submitted a detailed peer gallery review. Teacher taps the card, sees: "Sam showed evidence of Taking Responsibility for Others (Collaboration) — detailed review of Alex's work with specific constructive suggestions. AI suggests: Applying (3/4)."
4. Teacher thinks: "Actually, I also just saw Sam helping at the laser cutter, that's even stronger." Taps to adjust to Extending (4/4). Adds a quick voice note: "Helped classmate with laser cutter setup unprompted."
5. Total time: 8 seconds. Evidence captured with full context.

**Meanwhile, on Sam's screen:**

6. Sam finishes their prototyping work and hits "Complete & Continue."
7. Instead of a rating scale, they see: "You spent 35 minutes on your prototype today and helped a classmate with the laser cutter. What's one thing you learned from making it real that you didn't expect from your sketches?"
8. Sam types: "The handle was way harder to hold than I thought from the drawing. I had to reshape it three times and the curves needed to be smoother for your thumb."
9. This response maps to: Being Reflective (connecting experience to learning), Developing Skill or Craft (iterating on physical form), Striving for Mastery (multiple attempts for quality).
10. Sam doesn't know any of this mapping happened. They just answered an interesting question.

**Friday afternoon, before the weekend:**

11. Teacher checks the Class Hub NM tab. Sees a summary: "This week: 47 evidence points collected across 24 students. 3 students showing strong growth in Acting with Autonomy. 2 students flagged for potential support in Engaging in Dialogue (low participation in peer review and AI conversations)."
12. Teacher didn't "do NM" this week. NM happened because they taught a normal unit on StudioLoom.

### What This Looks Like for a Student

**The student never sees the words "competency assessment."** They see:

- Interesting reflection questions after activities ("What surprised you about...?")
- A subtle growth profile that builds over time (more on this below)
- At report time, a visual "me as a learner" profile they actually recognise as accurate

**The Student Growth Profile — "My Learning DNA"**

Somewhere on the student dashboard (not intrusive, accessible when wanted), a visual representation of their competency development builds over time. Think of it as an evolving portrait, not a grade card.

Design options:
- A radar/spider chart that fills in over time (currently empty axes, gradually filling as evidence accumulates)
- A garden metaphor (seeds → sprouts → flowers for each competency area)
- A constellation map (stars connecting as competencies develop)
- Abstract colour composition that shifts and grows (each competency has a colour — their unique blend emerges)

The point: **students can see themselves growing in ways that grades don't capture.** A student who gets a C in Design but shows an upward trajectory from Guided Collaborator to Responsible Collaborator has a meaningful growth story that traditional grading misses entirely.

The profile is private to the student (and their teacher) by default. At report time, it becomes the basis for the formal reports (Rocket Report, Fan Profile, Credential).

---

## 5. Making It Enjoyable — The Design Principles

### For Teachers

1. **NM is on by default, not opt-in.** When a teacher creates a unit, the system suggests which competency elements are naturally aligned based on the activities. "This unit has peer critique, collaborative prototyping, and written reflections — it naturally develops Collaboration and Agency. We'll track those." Teacher can adjust but doesn't have to configure from scratch.

2. **Observations feel like noticing, not assessing.** The language throughout should be "I noticed..." not "I rate this student at Level 3." Teachers are naturally observant — the system should capture their existing observations, not create a new observation task.

3. **The AI does the paperwork.** Teachers confirm or nudge AI interpretations. They don't fill out rubrics. The AI drafts the growth narratives for reports. The teacher reviews and adjusts. Time from "I want to generate reports" to "reports ready to share" should be under 5 minutes for a whole class.

4. **Insights are actionable, not just descriptive.** "5 students are developing in Managing Ambiguity — consider adding more open-ended challenges in the next unit" is useful. "Average class level in Managing Ambiguity is 2.3" is not.

5. **It makes you a better teacher.** The competency data should reveal things the teacher didn't notice: "Students who use the Design Assistant for dialogue (not just answers) develop Engaging in Dialogue 40% faster. Sam hasn't used the DA in 2 weeks." Now the teacher has a reason to check in with Sam that isn't about grades.

### For Students

1. **It's about self-knowledge, not judgment.** The Discovery Engine already follows this principle — students discover their strengths and working style without feeling tested. NM reflection should feel the same: "Here's who you are as a learner" not "Here's your score."

2. **Reflection questions are interesting, not bureaucratic.** "What surprised you?" beats "Rate your collaboration from 1 to 3." Questions should feel like the kind of thing a thoughtful mentor would ask, not a form to fill out.

3. **Growth is visible and personal.** Students should be able to see their development over time in a way that feels personal and meaningful. Not a grade going from C to B, but a visual story of "I used to freeze when things were ambiguous, now I actually seek out open-ended problems."

4. **It connects to their real identity.** The mentor system (Kit/Sage/Spark) + visual themes already personalise the platform. NM should weave into this — the mentor references their growth naturally: "You know, three weeks ago you would have asked me for the answer. This time you figured it out yourself. That's real autonomy growth."

5. **It's never punitive.** Low competency ratings should never feel like failure. The framing is always developmental: "You're at the Directed Learner stage in Agency — that means you learn best with clear structure and guidance. As you grow, you'll start making more of your own learning decisions." Every level is described positively, not as a deficit.

---

## 6. Technical Architecture for the Vision

### Phase 1: Data Foundation (what we build now)

- Expand `constants.ts` with all 7 competencies (27 elements, all progressions, broad development descriptions)
- Build `CompetencySignalMapper` service — maps platform events to competency element evidence
- Create `evidence_signals` table for AI-detected competency signals (student_id, element_id, source_feature, signal_type, confidence, raw_data JSONB)
- Wire signal detection into existing features (toolkit completion, DA conversations, Open Studio, Gallery, reflections)

### Phase 2: Smart Observation Flow (teacher experience upgrade)

- Redesign ObservationSnap to show AI suggestions alongside teacher input
- Teaching Mode: subtle highlight on student cards when AI detects noteworthy behaviour
- One-tap confirm/adjust flow
- Voice note attachment for observations

### Phase 3: Contextual Student Reflections (student experience upgrade)

- Replace 3-point rating scale with contextual reflection prompts
- AI generates questions based on what the student just did
- Response quality auto-mapped to element levels (teacher can adjust)
- Student growth profile visual on dashboard

### Phase 4: Reporting Layer

- Rocket Report (single competency deep dive)
- Fan Profile (multi-competency radar)
- AI-generated growth narratives per student per competency
- Class-wide insights dashboard for teachers
- Export for school reporting (PDF)
- Learner Competency Credential (formal certificate)

### Phase 5: Intelligence Layer

- Cross-unit competency tracking (student's Agency grows across all their Design, Service, PP units)
- Predictive insights ("Students who develop strong Agency early tend to produce better PP outcomes — consider focusing on autonomy scaffolding")
- Teacher professional development suggestions ("Your students develop Collaboration well but Quality Thinking lags — here are strategies")

---

## 7. File Manifest

### Existing Files
| File | Status |
|------|--------|
| `src/components/nm/CompetencyPulse.tsx` | Working, Phase 3 redesign planned |
| `src/components/nm/NMConfigPanel.tsx` | Working, Phase 1 smart-suggest planned |
| `src/components/nm/ObservationSnap.tsx` | Working, Phase 2 redesign planned |
| `src/components/nm/NMResultsPanel.tsx` | Working, Phase 4 report links planned |
| `src/components/nm/index.ts` | Working |
| `src/lib/nm/constants.ts` | Working, Phase 1 expansion needed |
| `src/app/api/teacher/nm-config/route.ts` | Working |
| `src/app/api/teacher/nm-observation/route.ts` | Working |
| `src/app/api/teacher/nm-results/route.ts` | Working |
| `src/app/api/student/nm-assessment/route.ts` | Working |
| `src/app/api/student/nm-checkpoint/[pageId]/route.ts` | Working |
| `supabase/migrations/030_new_metrics.sql` | Applied |
| `supabase/migrations/032_fix_nm_page_id_type.sql` | Applied |
| `supabase/migrations/056_nm_rls_junction_fix.sql` | Applied |

### Reference Docs
| File | Purpose |
|------|---------|
| `docs/specs/nm-reporting-synthesis.md` | Full data extraction from all 7 kits + Ruby analysis + build plan |
| `docs/specs/new-metrics-integration.md` | Phase 1 build spec (299 lines, COMPLETE) |
| `docs/nm-test-checklist.md` | QA checklist for Phase 1 |
| `docs/Newmetrics/*.pdf` | All 7 competency kit PDFs |
| `docs/projects/new-metrics.md` | THIS FILE — project tracker |

### External Resources to Research
| Resource | Type | URL | Status |
|----------|------|-----|--------|
| NM Framework Overview (PDF) | Overview | `https://www.newmetricsinternational.com/_files/ugd/3a972d_521800668ca0450ba865b74e30fbda91.pdf` | Not yet reviewed |
| NM Implementation Guide (PDF) | Overview | `https://www.newmetricsinternational.com/_files/ugd/3a972d_48315140876c4c938011f41de85f4ffe.pdf` | Not yet reviewed |
| FutureLearn "Measuring What Matters" | Training course | `https://www.futurelearn.com/courses/measuring-what-matters` | Not yet reviewed |
| ARC Sample Report — Agency in Learning | Report example | `https://melbourne-assessment-sample.arcassess.education/account/register/agency-in-learning` | Not yet reviewed |

> **Note:** The ARC sample report is especially important — it shows Melbourne's actual report format (the Rocket Report equivalent). Understanding this output format should drive our Phase 4 report design. The FutureLearn course may contain pedagogical insights about how teachers are trained to use NM that could inform our UX.

### Files to Create
| File | Phase |
|------|-------|
| `src/lib/nm/competency-signal-mapper.ts` | Phase 1 |
| `src/lib/nm/all-competencies.ts` | Phase 1 |
| `src/lib/nm/broad-development.ts` | Phase 1 |
| `src/components/nm/RocketReport.tsx` | Phase 4 |
| `src/components/nm/FanProfile.tsx` | Phase 4 |
| `src/components/nm/GrowthNarrative.tsx` | Phase 4 |
| `src/components/nm/StudentGrowthProfile.tsx` | Phase 3 |
| `src/components/nm/ContextualReflection.tsx` | Phase 3 |
| `src/components/nm/SmartObservation.tsx` | Phase 2 |
| `supabase/migrations/0XX_evidence_signals.sql` | Phase 1 |

---

## 8. Key Decisions Made

1. **NM should feel invisible during teaching** — evidence collection happens passively through normal platform use. Teachers confirm, not create.

2. **Students never see "competency assessment" language** — they see reflection questions, growth profiles, and mentor acknowledgment. The mapping to Melbourne's framework is internal.

3. **AI suggests, teacher confirms** — the AI detects competency signals from platform data and presents them to the teacher for one-tap confirmation. This respects teacher professional judgment while eliminating the data-entry burden.

4. **Shared element pool architecture** — 27 unique elements, referenced by ID from each competency. One observation of "Being Empathetic" counts toward Ethics, Citizenship, Personal Dev, Collaboration, AND Communication simultaneously.

5. **Contextual reflections over rating scales** — students respond to interesting questions about what they just did, not abstract self-ratings on competency elements. Response quality maps to levels automatically.

6. **Growth narrative over data tables** — reports should tell a story ("Jamie has grown from...") not present a spreadsheet. AI generates the narrative, teacher reviews.

7. **NM on by default with smart suggestions** — system auto-detects which competencies align with unit activities and suggests configuration. Teacher adjusts if needed but doesn't start from scratch.

---

## 9. Open Questions

1. **How do we handle cross-class competency data?** A student's Agency development in Design class should be visible alongside their Agency in Service class. The `competency_assessments` table has `class_id` but reports need to aggregate across classes.

2. **What's the minimum viable evidence for a progression level?** Ruby uses 10-22 data points. Our continuous approach generates more but noisier signals. What confidence threshold triggers "ready to report"?

3. **How do we validate our AI signal mapping against Ruby's psychometric model?** Melbourne's framework has research-backed progression descriptions. Our AI-detected signals need to map cleanly to those levels. Can we run parallel assessments (Ruby + StudioLoom) to validate?

4. **Should students see their progression level, or just their growth trajectory?** Levels can feel reductive ("I'm only Level 2"). Growth trajectories feel empowering ("I've grown 40% in autonomy this term"). Maybe: show growth to students, show levels to teachers and reports.

5. **What does Melbourne need for formal credentialing?** The Learner Competency Credential requires University endorsement. Can StudioLoom's evidence model meet their moderation requirements, or does credentialing still need Ruby?

---

## 10. Feasibility Reality Check — Being Honest About What's Hard

The 3-layer vision in Section 4 sounds great as a pitch. Here's where it falls apart in practice and what we can actually ship.

### Layer 1 (Automatic Evidence Collection) — THE HARD PROBLEM

**What I proposed:** AI watches student activity and maps it to competency elements automatically.

**Why it's harder than it sounds:**

The mapping from "student did X on the platform" to "this is evidence of competency element Y at level Z" is not an engineering problem — it's a **research problem.**

Take the example: "Jamie went 4 levels deep in Five Whys → evidence of Using Reason." Sounds obvious. But:
- What if Jamie went deep because the prompts were leading? That's not independent reasoning.
- What if Jamie went 4 levels deep but every level was vague filler? Depth ≠ quality.
- What if another student went 2 levels deep but those 2 levels showed genuine causal insight? They might be demonstrating stronger reasoning than Jamie.

**The effort assessment system we already have (`effort-assessment.ts`) shows the right instinct and the right limitation.** It uses word count + reasoning markers + specificity markers to classify effort as low/medium/high. That's useful for nudging students in the moment. But it's a blunt instrument — it can't distinguish between a student who writes 15 words of genuine insight and one who writes 15 words of sophisticated-sounding filler.

**Scaling that to competency levels is a much bigger leap.** Melbourne's 5-point progression scale (Directed → Unbound Learner) represents qualitative leaps in sophistication that can't be reliably detected from word count patterns or even single AI interpretations.

**What's actually feasible:**
- **Binary signal detection**: "This student DID engage with this feature" (not "how well"). Participation signals, not quality signals. The system can say "Sam used the Empathy Map tool and completed all 4 quadrants" — that's factual. It shouldn't say "Sam demonstrated Level 3 Being Empathetic."
- **Frequency/pattern signals**: "This student seeks feedback without prompting" (counts of voluntary DA conversations, unsolicited peer reviews). Frequency patterns are more reliable than quality judgments.
- **Threshold alerts**: "This student hasn't engaged in any dialogue-type activities in 2 weeks" — absence of evidence is actually more reliably detectable than presence of quality.

**What's NOT feasible (yet):**
- Auto-detecting competency levels from student work
- AI reading a toolkit session and reliably saying "this is Level 3 Being Reflective"
- Replacing teacher judgment with algorithmic classification

### Layer 2 (Smart Observations) — FEASIBLE BUT NEEDS SIMPLIFYING

**What I proposed:** AI highlights student cards in Teaching Mode when it detects something noteworthy, teacher taps to confirm.

**The feasible version:**
- After a student completes certain activities (toolkit session, gallery review, lesson completion with reflection), the system generates a **pre-filled observation card** for the teacher.
- Not "AI detected Level 3 Being Reflective" — instead: "Sam just completed the Five Whys tool with high effort scores. Elements potentially demonstrated: Using Reason, Being Persistent, Being Reflective. Confirm?"
- The teacher adds their own rating. The system pre-selects the relevant elements. That's the time-saver: **element selection, not level judgment.**
- This works because element selection IS the bottleneck in the current ObservationSnap. The teacher has to think "which of these 12 elements did I just observe?" The system can narrow it to 2-3 relevant ones.

**What doesn't work:**
- Real-time AI analysis during Teaching Mode (too slow, too expensive, too many false positives)
- AI suggesting specific ratings (undermines teacher professional judgment, which is the whole point of Melbourne's framework)

### Layer 3 (Contextual Reflections) — MOSTLY FEASIBLE, ONE BIG CAVEAT

**What I proposed:** Replace 3-point rating with contextual questions, AI maps response quality to levels.

**The feasible version:**
- Contextual questions instead of abstract ratings — absolutely doable. We already have the infrastructure (checkpoint detection, per-page config). Changing the UI from rating pills to a text prompt is straightforward.
- Question generation based on what the student just did — feasible. The checkpoint knows which page/lesson, which activities were on it. A simple template system ("You just finished [activity]. What surprised you about [topic]?") works without AI.

**The big caveat:**
- "Response quality auto-mapped to competency levels" — this is the Layer 1 problem again. AI reading a student's free-text response and reliably mapping it to Level 1-5 on a competency element is **not something we can validate.** Melbourne spent years developing psychometrically validated assessment items (the Ruby MCQs). We can't replicate that with prompt engineering.

**What we should actually do:**
- Collect the student's response as **qualitative evidence** (stored as text, tagged to the element)
- Show the response to the teacher in the results panel alongside their own observation
- Let the teacher make the level judgment informed by both their own observation AND the student's self-reflection
- The student's response enriches the evidence base. It doesn't replace assessment.

### What's Actually Shippable (Revised Phases)

**Phase 1: Solid Foundation (1-2 days)**
- Expand constants.ts with all 7 competencies (27 elements, progressions, broad development)
- This is pure data entry from the PDFs. No ambiguity, fully testable.

**Phase 2: Better Observations (2-3 days)**
- Pre-filled observation cards: when a student completes a toolkit session/gallery review/reflection, auto-suggest which elements were potentially demonstrated
- Element suggestion based on simple activity→element mapping table (no AI needed)
- Teacher still rates. System just saves them the "which element?" step.

**Phase 3: Contextual Student Reflections (2-3 days)**
- Replace CompetencyPulse 3-point rating with contextual questions
- Template-based question generation (no AI needed for question selection)
- Student responses stored as evidence text alongside element tags
- Teacher sees responses in NMResultsPanel

**Phase 4: Reports (3-5 days)**
- Rocket Report component (SVG stacked bar + element breakdown + AI growth narrative)
- Fan Profile component (SVG radar chart)
- AI-generated growth narrative (Haiku reads all evidence for student+competency, drafts 2-3 sentences)
- Export to PDF for school reporting

**Phase 5 (Future): Intelligence Layer**
- This is where the automatic signal detection lives — AFTER we have enough manual teacher data to validate any automated mapping
- Needs: 50+ students with 100+ manual observations to train/validate against
- Can't build this until Phase 1-4 are in use and generating real data

---

## 11. How We Test If It Works

### The Core Question

NM isn't like a button that either works or crashes. The question is: **does StudioLoom's NM implementation produce competency assessments that are useful, accurate enough, and actually used by teachers?**

### Testing Strategy: 4 Levels

#### Level 1: Technical Testing (does the code work?)

Standard QA. Covered by `docs/nm-test-checklist.md`. Run through the checklist for:
- Config wizard saves/loads correctly per class
- Checkpoints appear on correct student pages
- Observations save with correct element/rating/class
- Results panel shows accurate aggregations
- All 7 competencies render correctly with their elements

**How:** Manual walkthrough, one teacher + 3 test students. 2-3 hours.

#### Level 2: Usability Testing (do teachers actually use it?)

This is about friction, not correctness. Questions:
- How long does it take a teacher to configure NM for a unit? (Target: under 2 minutes)
- How long does an observation take during Teaching Mode? (Target: under 10 seconds)
- Do teachers remember to observe? (Measure: observations per lesson)
- Do students engage with reflections or skip/filler them? (Measure: meaningful word count in responses)

**How:** Matt uses it with his actual classes for 2-3 weeks. Track:
- Config time (stopwatch the first setup)
- Observation count per lesson (compare to target of 3-5 per class per lesson)
- Student reflection quality (run `assessEffort()` on responses, look at distribution)
- Teacher subjective feedback ("Did this feel like extra work? Did you learn something about your students you didn't already know?")

**Success criteria:**
- Teacher makes 3+ observations per lesson without it feeling like a chore
- 70%+ of student reflections score "medium" or "high" effort
- Teacher says: "I noticed things I wouldn't have otherwise"

#### Level 3: Content Validity Testing (are we measuring the right things?)

This is the Melbourne alignment question. The competency kits define what each element looks like at each progression level. Our observations and reflections need to actually capture those behaviours.

**How:**
1. Take 5 students. Have Matt complete the full Ruby assessment for them (if available) OR have Matt manually place each student on the 5-level progression using the kit descriptions.
2. Independently, look at all the NM data StudioLoom collected for those same 5 students.
3. Do the StudioLoom-derived levels match Matt's expert judgment?

If they match: our evidence collection is capturing the right signals.
If they don't: we need to understand why. Is it the elements we're tracking? The activities we're observing? The interpretation?

**This test requires Phase 1-4 to be running with real students for at least one term.**

#### Level 4: Value Testing (does it change anything?)

The ultimate test: does NM data change how Matt teaches or how students develop?

**How:** After one term of NM:
- Did Matt modify any unit design based on NM insights? ("I noticed Collaboration was weak so I added more group activities")
- Did any student show measurable competency growth between observation periods?
- Did the reflection prompts surface insights Matt didn't get from regular grading?
- Would Matt recommend this to another teacher?

**This can only happen after a full term of real use.** There are no shortcuts.

### Minimum Viable Test Sequence

```
Week 1:    Ship Phase 1 (constants expansion)
Week 1-2:  Ship Phase 2 (better observations)
Week 2-3:  Ship Phase 3 (contextual reflections)
           → START Level 1 + 2 testing with Matt's classes
Week 4-6:  Ship Phase 4 (reports)
           → Continue Level 2 testing, begin Level 3
Week 7-10: Collect data, iterate on friction points
           → Level 3 validation (5-student comparison)
End of Term: Level 4 retrospective
```

### What "Failure" Looks Like (And What To Do)

| Failure Mode | Signal | Response |
|---|---|---|
| Teachers don't observe | <1 observation per lesson average | Reduce friction further. Maybe: popup after each lesson with "Did you notice anyone standing out?" instead of per-student modal |
| Student reflections are all filler | >50% score "low" effort | Questions are too abstract. Switch to even more specific prompts tied to the exact activity |
| Observations cluster on same elements | >80% observations on 2-3 elements | Element suggestions too narrow. Broaden the activity→element mapping |
| Teacher and student ratings don't correlate at all | Pearson r < 0.2 between student self and teacher obs | Students don't understand the elements. Add brief "what this means" tooltips or examples |
| StudioLoom levels don't match Ruby levels | >1 level difference for >50% of students | Our evidence collection is missing something. Deep dive into which elements diverge and why |
| Teachers say it's extra work | Subjective feedback | We failed at the core promise. Strip back to absolute minimum: just observations, no reflections, no reports. Rebuild from what actually works |

---

## 12. Agency in Learning — Existing Data Enhancement Map

> **Context:** Matt is starting with Agency in Learning only. This section maps each of the 12 Agency elements to data already being collected by existing StudioLoom features, and identifies practical enhancements that don't require new features — just smarter reading of existing data.

### The Pattern

StudioLoom has 9 active data streams: lesson responses, integrity monitoring, Open Studio sessions, toolkit sessions, pace feedback, gallery peer reviews, effort assessment, learning profile, and NM assessments. They're currently disconnected silos. The enhancement isn't about collecting MORE data — it's about making existing data visible as Agency evidence.

### Per-Element Analysis

#### 1. Acting with Autonomy
- **Already collecting:** Integrity monitoring (paste ratio, independent writing signals), Open Studio unlock/session data, toolkit session self-initiation
- **Enhancement:** The integrity `score` (0-100) is a direct proxy for autonomous work. Currently only shown to teachers on grading page. Surface a simplified "predominantly self-authored" flag in NM results. Open Studio sessions already track whether students set their own focus area vs needed prompting — that's autonomy data sitting in `open_studio_sessions.focus_area` (null = didn't set one, string = chose their own direction).
- **Data source:** `student_progress.integrity_metadata`, `open_studio_sessions.focus_area`
- **Query complexity:** Simple (existing columns, no joins)

#### 2. Acting with Courage
- **Already collecting:** Toolkit tool selection history, Open Studio check-in responses, Design Assistant conversations
- **Enhancement:** Track "first use" of each toolkit tool per student. A student who's tried 8 different tools shows more courage than one who's done SCAMPER 4 times. Derive from `student_tool_sessions` with a `SELECT DISTINCT tool_id` count. Also: when a student does a v2+ of a toolkit session (resets and tries fresh approach), that's courage to rethink.
- **Data source:** `student_tool_sessions.tool_id` (variety count), `student_tool_sessions.version` (restart count)
- **Query complexity:** Simple (COUNT DISTINCT, no new columns)

#### 3. Being Open to the New
- **Already collecting:** Toolkit tool variety, toolkit version count (fresh restarts), Design Assistant conversation patterns
- **Enhancement:** Similar to courage — tool variety is the signal. When a student resets a toolkit session (version 2+), they're open to rethinking. The `version` field already exists for session management. Also: students who try tools they weren't assigned (standalone mode vs embedded mode) show initiative.
- **Data source:** `student_tool_sessions.version`, `student_tool_sessions.mode` (standalone = self-initiated)
- **Query complexity:** Simple

#### 4. Being Reflective
- **Already collecting:** Effort-gated reflections (12+ meaningful words), Open Studio end-of-session reflections, toolkit summary screens, pace feedback
- **Enhancement:** Compute rolling average of reflection quality per student. `countMeaningfulWords()` already runs on reflections — aggregate it across all `student_progress.responses` for reflection-type activities. Open Studio `reflection` field at session end is gold — it's unprompted self-directed reflection. Students whose reflections consistently hit 20+ meaningful words with reasoning markers ("because", "I noticed that") are demonstrating higher-level reflection.
- **Data source:** `student_progress.responses` (reflection sections), `open_studio_sessions.reflection`
- **Query complexity:** Medium (needs to parse JSONB responses, run word count)

#### 5. Building Social Alliances
- **Already collecting:** Gallery peer reviews (who reviewed whom, completion rate), working style preference from learning profile
- **Enhancement:** Count reviews given vs minimum required. A student who reviews 5 peers when minimum is 3 is building social connections. Query: `COUNT(*) FROM gallery_reviews WHERE reviewer_id = X` per round, compared to `gallery_rounds.min_reviews`. This is the element that most needs real-world teacher observation — digital peer interaction is a thin proxy for actual social alliance building.
- **Data source:** `gallery_reviews` (count per round), `gallery_rounds.min_reviews`
- **Query complexity:** Simple (COUNT with GROUP BY)

#### 6. Demonstrating Drive
- **Already collecting:** Open Studio session duration + activity count + drift flags, toolkit session completion, response length/depth, integrity monitoring time active
- **Enhancement:** Aggregate duration data from three sources. Open Studio: `started_at` to `ended_at` with `activity_log.length`. Toolkit: `started_at` to `completed_at`. Integrity: `totalTimeActive`. A student with 45 focused minutes (zero drift flags) shows more drive than 15 minutes with 3 drift flags. The `productivity_score` field on Open Studio sessions ("low"/"medium"/"high") is literally a drive indicator currently only shown on teacher's Open Studio tab.
- **Data source:** `open_studio_sessions` (duration, activity_log, drift_flags, productivity_score), `student_tool_sessions` (completion rate), `student_progress.integrity_metadata` (totalTimeActive)
- **Query complexity:** Medium (cross-table aggregation)

#### 7. Developing Skill or Craft
- **Already collecting:** Effort assessment specificity markers, toolkit state depth (ideas per step, decision matrix completeness), integrity editing behaviour
- **Enhancement:** The effort assessment's specificity markers ("for example", "using", "made of", "compared to") are craft language. Currently a boolean check — could count frequency instead. Also: integrity monitoring's `deletionCount / keystrokeCount` is a revision ratio. High revision = crafting and refining. Low revision = first draft accepted. Both signals exist in current data.
- **Data source:** Effort markers (client-side, would need to persist count), `student_progress.integrity_metadata` (deletionCount, keystrokeCount)
- **Query complexity:** Medium (revision ratio is simple math on existing JSONB; persisting marker count needs a small code change)

#### 8. Engaging in Dialogue
- **Already collecting:** Design Assistant conversation count, Open Studio check-in responses, gallery peer review content quality, toolkit AI nudge interactions
- **Enhancement:** Open Studio already tracks `ai_interactions` count per session. But count ≠ quality. The check-in response text is in the activity_log. Run `assessEffort()` on check-in responses to get dialogue quality signal. Also: gallery review content length/quality using same effort assessment. Both use existing code with no new features — just apply effort assessment to data that's already stored.
- **Data source:** `open_studio_sessions.ai_interactions` + `activity_log` (check-in text), `gallery_reviews.review_data` (review text)
- **Query complexity:** Medium (parse JSONB, run effort assessment)

#### 9. Generating Feedback Loops
- **Already collecting:** Pace feedback submission, gallery reviews given + received, toolkit micro-feedback interactions, CompetencyPulse self-assessment
- **Enhancement:** Track whether a student submitted pace feedback at all (many skip it). Submission rate across lessons = feedback loop engagement. Simple query: `COUNT(*) FROM lesson_feedback WHERE student_id = X AND feedback_type = 'student'` divided by total lessons completed. Gallery effort-gating completion is another signal — students who complete minimum reviews to unlock feedback are closing the loop.
- **Data source:** `lesson_feedback` (submission count), `gallery_reviews` (completion vs minimum)
- **Query complexity:** Simple

#### 10. Managing Ambiguity or Uncertainty
- **Already collecting:** Open Studio drift flags (direct uncertainty signal), Design Assistant conversation patterns
- **Enhancement:** Drift detection IS an ambiguity management sensor. Zero drift flags across 3 sessions = managing uncertainty well. Escalating drift = struggling. The 3-level escalation data (gentle → direct → silent) is stored in `open_studio_sessions.drift_flags` JSONB. Currently only triggers auto-revocation. Could be the best passive Agency signal available — just aggregate what's already there.
- **Data source:** `open_studio_sessions.drift_flags` (count, severity levels, trend over sessions)
- **Query complexity:** Simple (count/aggregate on JSONB array)

#### 11. Striving for Mastery
- **Already collecting:** Toolkit version count (v1→v2→v3 = iterating), toolkit depth dots (1-3), Five Whys depth detection
- **Enhancement:** Five Whys is the strongest mastery signal — the AI already classifies "deeper" vs "sideways" per step. That classification is in the API response but NOT persisted. If `student_tool_sessions.state` for Five Whys included a `depthAchieved` field per step, you'd have a direct mastery progression signal. **Small code change needed:** save the depth classification in the tool session state alongside the student's answer.
- **Data source:** `student_tool_sessions.state` (after Five Whys enhancement), `student_tool_sessions.version` (iteration count)
- **Query complexity:** Simple (read JSONB), but needs one code change to Five Whys API

#### 12. Using Reason
- **Already collecting:** Effort assessment reasoning markers ("because", "since", "if...then", "therefore"), toolkit decision matrix reasoning fields, Design Assistant Socratic responses
- **Enhancement:** The reasoning marker detection in `assessEffort()` currently returns binary (has markers / doesn't). Count them instead. A student using 4 reasoning connectors per paragraph demonstrates stronger reasoning than 1. The function already finds the markers — it just doesn't expose the count. **One-line change:** return `reasoningMarkerCount` alongside the effort level.
- **Data source:** Effort assessment output (after count enhancement), `student_tool_sessions.state` (decision matrix reasoning fields)
- **Query complexity:** Simple, but needs one small code change to `assessEffort()`

### Summary: Enhancement Categories

**Category 1 — Simple queries on existing tables (zero code changes to collection):**
- Tool variety count (courage, openness) → `SELECT COUNT(DISTINCT tool_id)` from `student_tool_sessions`
- Review count vs minimum (social alliances, feedback loops) → `COUNT` on `gallery_reviews`
- Pace feedback submission rate (feedback loops) → `COUNT` on `lesson_feedback`
- Drift flag patterns (ambiguity) → aggregate `drift_flags` from `open_studio_sessions`
- Integrity score as autonomy proxy → read `student_progress.integrity_metadata`
- Open Studio focus area presence (autonomy) → check `open_studio_sessions.focus_area`
- Open Studio productivity score (drive) → already stored, just surface it
- Toolkit version/restart count (openness, mastery) → `version` field on `student_tool_sessions`

**Category 2 — Surface existing internal signals (minor code changes):**
- Effort assessment reasoning marker COUNT (not just boolean) → ~1 line in `assessEffort()` for Using Reason
- Integrity revision ratio (deletionCount/keystrokeCount) → simple math on existing JSONB for Developing Skill
- Reflection quality rolling average → run `countMeaningfulWords()` on stored responses for Being Reflective
- Check-in response quality → run `assessEffort()` on Open Studio activity_log text for Engaging in Dialogue

**Category 3 — One small storage addition:**
- Five Whys depth classification → save "deeper"/"sideways" in tool session state for Striving for Mastery (currently computed by AI but discarded)

### What This Means for the Build

None of this requires new features, new tables, or new UI components. It's an **evidence aggregation layer** that reads existing data and presents it alongside teacher observations in the NM results panel. The teacher still makes the level judgment — the system just shows them "here's what the platform saw this student doing" next to their own observation.

For Agency-only (Matt's current scope), this could manifest as a simple "Evidence Summary" card per student in the NM results, showing: tool variety (X tools tried), reflection quality (avg Y meaningful words), Open Studio focus (Z sessions with self-set focus), peer engagement (W reviews beyond minimum), and any drift/integrity flags worth noting.

---

*Last updated: 29 Mar 2026*
