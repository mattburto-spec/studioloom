# Safety & Skill Badges — Feature Spec

*21 March 2026 — StudioLoom*

## The Problem

Every D&T teacher on earth runs some version of the same ritual: hand out a photocopied safety test, students circle answers, teacher signs it, paper goes in a folder. The existing resources (FreeWorkshopSafetyTests.com.au, ITEEA safety tests, "Heads Up for Safety" BC manual) are:

- **Old** — clipart and Minecraft images, Word docs, paper-based
- **Static** — same questions every time, easy to copy off a friend
- **Not tracked** — teacher has a folder of signed papers, no digital record of who passed what
- **Not portable** — student moves class or school, starts from zero
- **Not engaging** — true/false questions on a PDF is the opposite of what MYP students respond to

Matt's own safety docs folder has 30+ files covering: General Woodwork, Hand Tools, Band Saw, Bench Grinder, Circular Saw, Disc Sander, Electric Welding, Leatherwork, Metal Lathe, Metal Workshop, Milling Machine, Oxy Acetylene, Pedestal Drill, Plastics, Portable Power Tools, Portable Sanders, Router, Shaping Machine, Wood Lathe, Wood Workshop, LP Gas. Plus a TAS Workshop Safety Contract and building bulletins.

## The Opportunity

Build the **definitive digital safety badge system** for Design & Technology education. Two badge types:

### 1. Safety Certifications (this spec)
Pass an interactive test → earn a badge → badge appears on student dashboard + portfolio. Teacher controls which badges are required before a student can use specific equipment. Student can't start a unit activity that requires the band saw unless they hold the Band Saw Safety badge.

### 2. Skill Certifications (future spec)
Teacher-granted after hands-on demonstration. "I watched you set up the laser cutter safely and produce a clean cut." These are inherently in-person — the digital system records the grant, not the assessment. Software-specific badges (Fusion 360, Cura, LightBurn) are a later layer.

---

## Safety Badge Categories

Based on Matt's docs + ITEEA + Heads Up for Safety + universal D&T workshop practice:

### Tier 1 — Foundation (required for ALL workshop access)
| Badge | Questions | Topics |
|-------|-----------|--------|
| **General Workshop Safety** | 15-20 | Safety signs (prohibition/mandatory/warning/info), PPE requirements, reporting injuries, eye/ear protection, housekeeping, WHS responsibilities, emergency procedures, dust/fume hazards, floor safety |
| **Hand Tool Safety** | 10-12 | Tool selection (fit to person + task), carrying sharp tools, clamping work, reporting damaged tools, never force a cut, no tools in pockets, passing tools safely |

### Tier 2 — Area-Specific (required before entering that zone)
| Badge | Questions | Topics |
|-------|-----------|--------|
| **Wood Workshop** | 10-12 | Dust extraction, timber hazards (splinters, dust inhalation), specific PPE, cleanup procedures, material storage |
| **Metal Workshop** | 10-12 | Hot metal handling, swarf hazards, cutting fluid safety, deburring, metal dust, grinding sparks |
| **Plastics & Composites** | 8-10 | Fume extraction, heat hazards, chemical safety (resins, solvents), ventilation requirements |
| **Electronics & Soldering** | 8-10 | Electrical safety, soldering iron handling, flux fumes, lead-free solder, ESD precautions, battery safety |
| **Digital Fabrication** | 8-10 | Laser cutter ventilation, 3D printer hot-end safety, CNC emergency stops, material restrictions, never leave running machines unattended |

### Tier 3 — Machine-Specific (required before using that machine)
| Badge | Questions | Topics |
|-------|-----------|--------|
| **Band Saw** | 8-10 | Guard adjustment, blade tension check, feed rate, curved vs straight cuts, clearing jams, emergency stop |
| **Pedestal Drill** | 8-10 | Chuck key removal, clamping work, speed selection, drill bit selection, swarf clearing, long hair/loose clothing |
| **Wood Lathe** | 8-10 | Face shield requirement, tool rest gap, speed for diameter, never leave running, faceplate vs between-centres |
| **Disc/Belt Sander** | 6-8 | Direction of rotation, gap to table, dust extraction, overheating, end-grain caution |
| **Bench Grinder** | 6-8 | Eye shield use, tool rest gap (max 3mm), wheel inspection (ring test), dressing the wheel, no side grinding |
| **Scroll Saw** | 6-8 | Blade tension, hold-down, thin material support, speed control |
| **Router** | 6-8 | Climb vs conventional cut, clamping, bit changes with power off, dust extraction, hearing protection |
| **Metal Lathe** | 8-10 | Chuck wrench removal, no gloves on rotating work, tailstock support, emergency stop, swarf hooks |
| **Milling Machine** | 8-10 | Work clamping, cutter selection, climb milling dangers, coolant, chip clearing |
| **Portable Power Tools** | 8-10 | Cord inspection, RCD/GFCI, trigger lock, blade guards, two-hand operation where required |

### Tier 4 — Specialist (school-specific, teacher-created)
Teachers can create custom badges for equipment unique to their workshop (CNC plasma, vacuum forming, kiln, screen printing, etc.) using a badge builder.

---

## Question Types (Modern & Interactive)

Moving beyond the old true/false + multiple choice:

| Type | Description | Example |
|------|-------------|---------|
| **Multiple Choice** | Classic, but with AI-generated scenario images | Photo of a workshop scene: "What is WRONG in this image?" |
| **True/False** | Quick knowledge checks | "It is safe to use a bench grinder while wearing gloves." |
| **Spot the Hazard** | AI-generated workshop image with clickable hotspots | "Tap all the hazards in this image" (missing guard, loose hair, no goggles, cluttered floor) |
| **Drag to Match** | Connect situations to correct actions | "The hand tool is too big" → "Select a tool that fits your hand" |
| **Word Bank** | Fill blanks from a word pool | "Never ___ a tool if you have not had specific ___ in its use." |
| **Sequence** | Put steps in the correct order | "Arrange the band saw setup steps in the correct order" |
| **Scenario** | Short story + question | "Alex is using the pedestal drill. The chuck key is still in the chuck. They reach for the start button. What should they do?" |

### AI-Generated Images (Key Differentiator)

The old tests use clipart and Minecraft screenshots. We generate purpose-built images using AI (ChatGPT gpt-image-1 or similar):

- **Isometric workshop scenes** — clean, modern, consistent style across all badges
- **Spot-the-hazard panels** — deliberately include 3-5 safety violations for students to find
- **PPE identification** — "Which items should this person be wearing?"
- **Before/After** — "Which setup is correct?"
- **Equipment close-ups** — guard positions, blade angles, clamping methods

Style: clean vector/illustration look (not photorealistic), consistent colour palette matching StudioLoom brand, age-appropriate for 11-18 year olds. Think Duolingo meets workplace safety poster.

---

## Student Experience

### Taking a Safety Test

1. **Teacher assigns required badges** for a unit or workshop area
2. Student sees required badges on their dashboard (locked, with a shield icon)
3. Student taps a badge → sees a brief **Learn** section (key rules, illustrated dos/don'ts — NOT just text, visual cards with AI illustrations)
4. Student taps **Take Test** → interactive quiz begins
5. Questions are **randomised from a pool** (pool is 2-3× the test length, so retakes get different questions)
6. **Immediate feedback** per question — correct shows green tick + brief explanation, incorrect shows the correct answer + why
7. **Pass threshold: 80%** (configurable per badge by teacher)
8. Pass → badge awarded with timestamp, appears on dashboard + portfolio
9. Fail → must wait 10 minutes before retaking (prevents brute-force). Shows which topics to review.
10. Badge **expires after 12 months** (configurable) — students must recertify annually. This is standard practice and ensures knowledge is current.

### Badge Display

- **Student Dashboard:** "Workshop Skill Certs" strip already built (Phase 1-2 of student dashboard redesign). Safety badges slot in alongside skill badges. Only earned badges shown — no wall of greyed-out shame.
- **Portfolio:** Safety badges appear in a dedicated "Certifications" section. Printable/shareable.
- **Student Lesson Page:** If a lesson requires a badge the student doesn't have, show a soft gate: "This activity requires Band Saw Safety certification. [Take the test →]"

### Badge Visual Design

Each badge is a small illustrated icon in a consistent style:
- **Shield shape** (safety connotation)
- **Equipment silhouette** inside the shield (band saw blade, drill bit, safety goggles, etc.)
- **Colour coded by tier:** Tier 1 = green (foundation), Tier 2 = blue (area), Tier 3 = amber (machine), Tier 4 = purple (specialist)
- **Earned state:** full colour with subtle glow
- **Locked state:** greyed out with lock icon overlay
- **Expired state:** red border with "Renew" label

---

## Teacher Experience

### Managing Badges

1. **Badge Library** — browse all available safety badges (built-in + custom)
2. **Assign to Unit** — "This unit requires: General Workshop Safety + Band Saw + Wood Workshop"
3. **Assign to Class** — "All Year 8 classes need General Workshop Safety before their first practical"
4. **Custom Badge Builder** — create a new badge:
   - Name, description, tier, icon selection
   - Add questions (all types above)
   - Set pass threshold, expiry, retake cooldown
   - Preview as student
5. **Student Status View** — per-class grid showing which students hold which badges. Red/green at a glance. "3 students in 8B still need Band Saw Safety before Thursday's lesson."
6. **Bulk Remind** — one-click reminder to students missing required badges
7. **Override** — teacher can manually grant a badge (for students who passed a paper test, or transfer students with prior certification)

### Analytics

- Pass/fail rates per badge (identifies poorly-written questions)
- Average time to complete
- Most-failed questions (identifies knowledge gaps → teaching opportunity)
- Expiry warnings ("12 students' General Workshop Safety expires next month")

---

## Skill Badges (Phase 2 — Outline)

Unlike safety badges (digital test), skill badges are **teacher-observed and teacher-granted**. The student demonstrates competence in person; the teacher taps a button to certify.

### Example Skill Badges
| Category | Badges |
|----------|--------|
| **Hand Tools** | Measuring & Marking, Sawing (tenon saw, coping saw), Chiselling, Planing, Filing |
| **Machine Operation** | Band Saw Operation, Lathe Operation (wood), Lathe Operation (metal), Drill Press Operation, Belt/Disc Sander Operation |
| **Digital Fabrication** | 3D Printer Operation, Laser Cutter Operation, CNC Router Operation, Vinyl Cutter Operation |
| **Software** | Fusion 360 Basics, Cura/Slicer Setup, LightBurn/RDWorks, TinkerCAD |
| **Finishing** | Sanding & Surface Prep, Staining & Varnishing, Spray Painting, Metal Finishing |
| **Joining** | Wood Joints (butt, lap, mortise & tenon), Soldering, Brazing, Welding (if applicable) |

### Grant Flow
1. Student requests a skill check (or teacher initiates)
2. Teacher observes the student performing the task
3. Teacher opens the student's profile → taps "Grant Badge"
4. Optional: teacher adds a note ("Clean cuts, good technique, reminded about dust extraction")
5. Badge appears on student's dashboard with teacher name + date
6. Skill badges **don't expire** (but teacher can revoke if safety concern arises)

### Software Badges (Phase 3)
These are harder because they're version-specific (Fusion 360 v2.x vs v3.x, Cura 5.x). Two approaches:
- **Generic:** "CAD Modelling" badge granted by teacher after observing competence in whatever software the school uses
- **Specific:** Interactive tutorial/assessment for a particular tool (like the safety tests but for software workflows). Only worth building for the 3-4 most common tools in D&T.

---

## Data Model

```sql
-- Badge definitions (built-in + teacher-created)
CREATE TABLE badges (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'safety' | 'skill' | 'software'
  tier INTEGER NOT NULL DEFAULT 1, -- 1=foundation, 2=area, 3=machine, 4=specialist
  icon_url TEXT, -- AI-generated badge icon
  is_built_in BOOLEAN DEFAULT false,
  created_by_teacher_id UUID REFERENCES auth.users(id),
  pass_threshold INTEGER DEFAULT 80, -- percentage
  expiry_months INTEGER DEFAULT 12, -- null = never expires
  retake_cooldown_minutes INTEGER DEFAULT 10,
  question_pool JSONB, -- array of question objects
  learn_content JSONB, -- illustrated learn cards
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questions within a badge (for safety badges)
-- Stored in badge.question_pool JSONB as:
-- [{ id, type, prompt, image_url?, options?, correct_answer, explanation, topic_tag }]

-- Student badge awards
CREATE TABLE student_badges (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  student_id TEXT NOT NULL,
  badge_id TEXT REFERENCES badges(id),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- computed from badge.expiry_months
  score INTEGER, -- percentage scored on test (null for skill badges)
  attempt_number INTEGER DEFAULT 1,
  granted_by TEXT, -- 'test' | teacher_id (for skill badges / overrides)
  teacher_note TEXT, -- for skill badges
  status TEXT DEFAULT 'active', -- 'active' | 'expired' | 'revoked'
  metadata JSONB -- answers, time_taken, etc.
);

-- Badge requirements per unit
CREATE TABLE unit_badge_requirements (
  unit_id UUID REFERENCES units(id),
  badge_id TEXT REFERENCES badges(id),
  is_required BOOLEAN DEFAULT true, -- required vs recommended
  PRIMARY KEY (unit_id, badge_id)
);

-- Badge requirements per class (overrides unit-level)
CREATE TABLE class_badge_requirements (
  class_id TEXT NOT NULL,
  badge_id TEXT REFERENCES badges(id),
  is_required BOOLEAN DEFAULT true,
  PRIMARY KEY (class_id, badge_id)
);
```

---

## Implementation Phases

### Phase 1 — Foundation (~5-7 days)
- Database migration (badges, student_badges, unit_badge_requirements)
- Badge data model + API routes (CRUD for badges, award/revoke, check requirements)
- Built-in badge definitions for Tier 1 (General Workshop Safety, Hand Tool Safety) with question pools (20-25 questions each, drawn from Matt's existing docs but rewritten as original content)
- Student test-taking UI: learn screen → quiz → results → badge award
- Student dashboard integration (badges strip already built)
- Teacher badge management page (library, assign to unit)

### Phase 2 — Full Safety Suite (~5-7 days)
- Tier 2 badges (Wood, Metal, Plastics, Electronics, Digital Fab) with question pools
- Tier 3 machine-specific badges (Band Saw, Pedestal Drill, Wood Lathe, etc.)
- AI-generated images for all badges (spot-the-hazard, PPE identification, scenario illustrations)
- Advanced question types (spot-the-hazard with clickable hotspots, sequence ordering)
- Badge expiry + recertification flow
- Teacher analytics dashboard (pass rates, knowledge gaps)
- Soft-gating on student lesson pages ("requires Band Saw Safety")

### Phase 3 — Skill Badges (~3-4 days)
- Teacher grant flow (observe → grant → badge appears)
- Skill badge definitions (hand tools, machine operation, digital fab, finishing, joining)
- Per-student skill profile view for teachers
- Portfolio integration (certifications section)

### Phase 4 — Custom Badges + Polish (~3-4 days)
- Teacher custom badge builder (name, questions, threshold, icon)
- Badge sharing between teachers (school-level badge library)
- Printable badge cards (for display boards / student folders)
- Class-level badge requirements
- Bulk operations (remind, grant, revoke)

---

## What Makes This Different

1. **Interactive, not paper** — spot-the-hazard images, drag-to-match, scenario-based questions
2. **Randomised from pools** — can't copy your friend's answers
3. **AI-generated illustrations** — modern, consistent, purpose-built for each hazard
4. **Digitally tracked** — teacher sees red/green grid, no paper folder
5. **Gated access** — can't start the band saw activity without the badge (enforced in UI)
6. **Portable** — badges travel with the student between classes and (eventually) schools
7. **Expiring** — annual recertification keeps knowledge fresh (industry standard)
8. **Two-layer system** — safety (digital test) + skill (teacher-observed) captures both knowledge and competence
9. **Teacher-customisable** — every workshop is different; teachers add their own equipment

---

## Key Decision: Free Tool at `/tools/safety`

**DECIDED (21 Mar 2026): YES — safety badges are a free standalone tool.** Like the Design Thinking Toolkit at `/toolkit`, this lives at `/tools/safety` and works without a StudioLoom account. Teachers sign up with email to access. Students take tests via a class code (no account needed). This is the second major free tool for lead gen — every D&T teacher on earth needs digital safety tests and nobody's built a good one.

**Free tier:** All built-in Tier 1-3 badges, unlimited students, test results emailed to teacher, basic pass/fail tracking.
**Paid tier (StudioLoom subscribers):** Custom badge builder (Tier 4), gated access enforcement on units, portfolio integration, analytics dashboard, expiry/recertification management, skill badges (teacher-granted).

## Open Questions
- Badge **portability between schools** — is there a standard we should align with (Open Badges 3.0, Credly)?
- Should the **Learn** section be skippable for students who just want to test? Or mandatory first read?
- **Image generation budget** — how many AI-generated images do we need? Estimate: ~5 per badge × 15 badges = 75 images for Phase 1-2.
- **Accessibility** — spot-the-hazard requires vision. Need alternative question types for visually impaired students.
