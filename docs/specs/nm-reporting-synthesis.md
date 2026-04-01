# New Metrics Reporting — Full Synthesis & Build Plan

> Research complete 28 Mar 2026. Based on web research + all 7 competency kit PDFs. All competencies fully extracted.

---

## 1. What Ruby Actually Does

Ruby is the University of Melbourne's proprietary assessment platform. It uses **behavioural micro-judgements** — scenario-based MCQs where each answer option maps to a progression level without revealing which level it represents. This reduces teacher bias (they're choosing what they observe, not what level they think the student is at).

### Ruby's 3 Report Types

**Rocket Report** (single competency deep-dive)
- Vertical stacked bar chart showing the assessed level as a highlighted band
- "Pathways" arrows pointing left/right of the assessed level showing adjacent levels
- Shows which elements contributed to the assessment
- Used for ongoing teacher planning (formative)

**Fan Profile** (multi-competency overview)
- Polar/radar chart showing assessed levels across multiple competencies
- Requires minimum 2 competencies × 2 assessments each to generate
- Shows relative strengths and areas for development at a glance
- Used for school reporting (summative)

**Learner Competency Credential** (formal certificate)
- PDF certificate generated at transition points (primary→secondary, entry into senior secondary, end of senior secondary)
- Shows attained levels with progression level names
- Intended as a formal record of competency development
- Used for credentialing purposes

### Ruby's 3 Assessment Purposes
- **Planning**: ~10 questions per competency, quick formative check
- **School Reporting**: Same question set, summative timing
- **Credentialing**: ~22 questions per competency, higher stakes, at key transitions

### Ruby's Pain Points (Why StudioLoom Can Do Better)

1. **Teacher workload**: 10-22 MCQs per student per competency per assessment. For a class of 25 doing 3 competencies = 750-1,650 questions per round. Ruby recommends 1-2 times per year, but even that is significant.

2. **Separate platform**: Teachers leave their daily teaching tools, log into Ruby, complete assessments in isolation from the work that generated the evidence. No connection between what students actually did and what teachers observe.

3. **Static PDF reports**: Reports are generated once, downloaded as PDFs. No interactivity, no drill-down, no "show me what evidence led to this level."

4. **No embedded evidence collection**: Ruby doesn't capture student work artifacts. The micro-judgements are teacher recall, not linked to specific moments or products.

5. **Batch assessment model**: Ruby assumes you sit down and assess all students at once. Real observation happens throughout a unit, not in one sitting.

6. **No curriculum integration**: Ruby exists entirely separately from lesson planning, unit design, and day-to-day teaching. Teachers must mentally bridge between "what I taught" and "what I'm assessing."

7. **No mobile/classroom flow**: No quick observation tool during a lesson. You can't tap a student's name during workshop time and record a competency observation in 5 seconds.

---

## 2. StudioLoom's Structural Advantages

StudioLoom already captures competency evidence through existing features — it just needs to surface and report on it. This is the fundamental advantage over Ruby.

### Passive Evidence Sources (Already Built)

| Feature | Competency Signals | How |
|---------|-------------------|-----|
| **Design Assistant conversations** | Agency (dialogue, feedback loops, reflection), Quality Thinking (reasoning, persistence), Collaboration (when peer work discussed) | AI can detect competency indicators in conversation patterns |
| **Toolkit sessions** | Quality Thinking (SCAMPER depth, Five Whys chain quality), Agency (persistence, drive), Collaboration (Stakeholder Map empathy) | Effort-gating scores + depth dots already measure quality |
| **Open Studio sessions** | Agency (autonomy, drive, managing ambiguity), Quality Thinking (openness to new), Personal Dev (responsibility) | Drift detection + productivity scoring + check-in responses |
| **MonitoredTextarea integrity** | Agency (autonomy — high integrity = independent work), Personal Dev (ethical integrity) | Human Confidence Score directly maps to integrity elements |
| **Peer Gallery reviews** | Collaboration (respectful, responsible, dialogue), Active Citizenship (taking responsibility for others), Ethics (empathetic feedback) | Review quality + structured feedback format scores |
| **Discovery Engine profile** | Agency (all elements — self-knowledge), Personal Dev (values, identity), Active Citizenship (community connection) | Archetype scoring + station responses |
| **Pace feedback** | Agency (self-regulation — knowing own pace) | Pattern over time shows self-awareness growth |
| **Reflection quality** | Agency (reflective), Quality Thinking (using reason), Personal Dev (ethical integrity — honest self-assessment) | Meaningful word count + effort tags |

### Active Evidence Sources (Already Built)

| Feature | What It Captures |
|---------|-----------------|
| **CompetencyPulse** (student 3-point self-assessment) | Student's perception of their competency at checkpoints |
| **ObservationSnap** (teacher 4-point observation) | Teacher's in-context observation during Teaching Mode |

### What Ruby Has That StudioLoom Needs to Build

1. **Rocket Report** — visual progression report per competency per student
2. **Fan Profile** — multi-competency radar overview per student
3. **Learner Competency Credential** — formal PDF certificate
4. **Progression level derivation** — algorithm to map element ratings → overall competency level
5. **Full competency data model** — all 7 competencies with elements and progressions in constants.ts
6. **Broad Development descriptions** — the 4-column progression text per element (used in reports)

---

## 3. Complete Data Model (All 7 Competencies)

Extracted from all 6 available competency kit PDFs. Communication is estimated based on the framework pattern.

### Shared Elements Pattern

**Critical architectural insight**: Elements are shared across competencies. A single observation of "Being Reflective" can count toward Agency, Quality Thinking, and Ethics simultaneously. The element is the atomic unit; competencies are composites.

**Complete Element Pool (24 unique elements):**

| Element | Competencies It Appears In |
|---------|---------------------------|
| Acting with Autonomy | Agency, Ethics |
| Acting with Courage | Agency, Personal Dev |
| Acting with Ethical or Moral Integrity | Ethics, Personal Dev |
| Acting with Judgement | Ethics, Quality Thinking |
| Acting Creatively | Quality Thinking |
| Being Empathetic | Ethics, Citizenship, Personal Dev, Collaboration, Communication |
| Being Open to the New | Agency, Quality Thinking |
| Being Persistent | Quality Thinking |
| Being Reflective | Agency, Ethics, Quality Thinking |
| Being Respectful | Collaboration, Citizenship, Personal Dev, Communication |
| Being Responsible | Ethics, Citizenship, Personal Dev, Collaboration |
| Being Systematic | Quality Thinking |
| Belonging to Community and Culture | Citizenship, Personal Dev |
| Building Social Alliances | Agency, Collaboration, Citizenship |
| Conducting Personal Relationships | Collaboration, Citizenship, Personal Dev, Communication |
| Demonstrating Drive | Agency, Collaboration, Citizenship, Communication |
| Developing Skill or Craft | Agency, Quality Thinking |
| Engaging in Dialogue | Agency, Collaboration, Ethics, Citizenship, Quality Thinking, Personal Dev, Communication |
| Generating Feedback Loops | Agency, Communication |
| Managing Ambiguity or Uncertainty | Agency, Ethics, Quality Thinking |
| Navigating Diverse Interests | Collaboration, Ethics, Citizenship, Personal Dev, Communication |
| Striving for Mastery | Agency, Quality Thinking |
| Taking Responsibility for Others | Collaboration, Citizenship, Personal Dev |
| Using Reason | Agency, Ethics, Quality Thinking |
| Comprehending Meaning | Communication |
| Conveying Meaning | Communication |
| Using Tools | Communication |

**Total: 27 unique elements.** "Engaging in Dialogue" appears in 7 of 7 competencies — it's the single most cross-cutting element. "Being Empathetic" and "Navigating Diverse Interests" each appear in 5.

### Per-Competency Data

#### 1. Agency in Learning (✅ Already in constants.ts)
- **Color**: Blue/teal
- **12 elements**: Acting with Autonomy, Acting with Courage, Being Open to the New, Being Reflective, Building Social Alliances, Demonstrating Drive, Developing Skill or Craft, Engaging in Dialogue, Generating Feedback Loops, Managing Ambiguity or Uncertainty, Striving for Mastery, Using Reason
- **Levels**: Directed Learner → Diligent Learner → Self-Regulated Learner → Extended Learner → Unbound Learner

#### 2. Acting Ethically
- **Color**: Green/teal (#2E7D32)
- **10 elements**: Acting with Autonomy, Acting with Courage, Acting with Ethical or Moral Integrity, Acting with Judgement, Being Empathetic, Being Reflective, Being Responsible, Managing Ambiguity or Uncertainty, Navigating Diverse Interests, Using Reason
- **Levels (Y5-8)**: Ethical Conformist → Ethical Explorer → Ethical Navigator → Empathetic Ethical Decision Maker → Ethical Activist
- **Levels (Y9-12)**: Same names, nuanced statements

#### 3. Active Citizenship
- **Color**: Blue (#1565C0)
- **10 elements**: Being Empathetic, Being Respectful, Being Responsible, Belonging to Community and Culture, Building Social Alliances, Conducting Personal Relationships, Demonstrating Drive, Engaging in Dialogue, Navigating Diverse Interests, Taking Responsibility for Others
- **Levels (Y5-8)**: Community Participant → Responsive Citizen → Active Citizen → Proactive Citizen → Community Builder
- **Levels (Y9-12)**: Same names, nuanced statements

#### 4. Collaboration
- **Color**: Pink/red (#C62828)
- **8 elements**: Being Respectful, Being Responsible, Building Social Alliances, Conducting Personal Relationships, Demonstrating Drive, Engaging in Dialogue, Navigating Diverse Interests, Taking Responsibility for Others
- **Levels (Y5-8)**: Guided Collaborator → Engaged Collaborator → Responsible Collaborator → Orchestrating Collaborator → Amplifying Collaborator
- **Levels (Y9-12)**: Same names, nuanced statements

#### 5. Quality Thinking
- **Color**: Orange/red (#E65100)
- **11 elements**: Acting Creatively, Acting with Judgement, Being Open to the New, Being Persistent, Being Reflective, Being Systematic, Developing Skill or Craft, Engaging in Dialogue, Managing Ambiguity or Uncertainty, Striving for Mastery, Using Reason
- **Levels (Y5-8)**: Structured Thinker → Inquisitive Thinker → Investigative Thinker → Analytical Thinker → Innovative Thinker
- **Levels (Y9-12)**: Same names, nuanced statements

#### 6. Personal Development
- **Color**: Yellow/gold (#F9A825)
- **10 elements**: Acting with Courage, Acting with Ethical or Moral Integrity, Being Empathetic, Being Respectful, Being Responsible, Belonging to Community and Culture, Conducting Personal Relationships, Engaging in Dialogue, Navigating Diverse Interests, Taking Responsibility for Others
- **Levels (Y5-8)**: Aware Learner → Rule-following Learner → Social Learner → Principled Learner → Values-driven Learner
- **Levels (Y9-12)**: Same names, nuanced statements

#### 7. Communication ✅
- **Color**: Purple/teal (#7B1FA2)
- **10 elements**: Being Empathetic, Being Respectful, Comprehending Meaning, Conducting Personal Relationships, Conveying Meaning, Demonstrating Drive, Engaging in Dialogue, Generating Feedback Loops, Navigating Diverse Interests, Using Tools
- **3 UNIQUE elements** (only appear in Communication): Comprehending Meaning, Conveying Meaning, Using Tools
- **Levels (Y5-8)**: Functional Communicator → Transactional Communicator → Active Communicator → Attuned Communicator → Influential Communicator
- **Levels (Y9-12)**: Same names, nuanced statements

---

## 4. Implementation Plan — Reporting Layer

### Phase 1: Data Model Expansion (1 day)

**Expand `src/lib/nm/constants.ts`** with all 7 competencies:

```typescript
// New structure: unified element pool + per-competency element lists
export const NM_ELEMENT_POOL: Record<string, NMElement> = {
  acting_with_autonomy: { id: "acting_with_autonomy", name: "Acting with Autonomy", ... },
  // ... all 24 unique elements
};

// Per-competency: just reference element IDs from the pool
export const COMPETENCY_ELEMENTS: Record<string, string[]> = {
  agency_in_learning: ["acting_with_autonomy", "acting_with_courage", ...],
  acting_ethically: ["acting_with_autonomy", "acting_with_courage", "acting_with_ethical_or_moral_integrity", ...],
  // ... all 7
};

// Per-competency progressions
export const COMPETENCY_PROGRESSIONS: Record<string, Record<"5-8" | "9-12", ProgressionLevel[]>> = {
  agency_in_learning: { "5-8": [...], "9-12": [...] },
  acting_ethically: { "5-8": [...], "9-12": [...] },
  // ... all 7 (Communication placeholder until PDF arrives)
};
```

**Key design choice**: Elements are a shared pool, not duplicated per competency. `getElementsForCompetency()` looks up element IDs from `COMPETENCY_ELEMENTS` and resolves from `NM_ELEMENT_POOL`. This means one observation of "Being Empathetic" automatically provides evidence for Ethics, Citizenship, Personal Dev, and Collaboration.

### Phase 2: Broad Development Descriptions (1 day)

Each element has a 4-column progression description that maps to the teacher's 4-point observation scale. These are needed for the Rocket Report narrative.

```typescript
export interface BroadDevelopment {
  elementId: string;
  /** 4 progression descriptions, index 0 = Emerging, index 3 = Extending */
  descriptions: [string, string, string, string];
}

// Example from Acting Ethically kit:
// "Being Responsible":
//   [0] "Recognises responsibilities"
//   [1] "Delivers with encouragement"
//   [2] "Delivers reliably"
//   [3] "Delivers reliably; is trusted to deliver"
```

These descriptions are extracted from the "Broad Development of Elements" tables in each kit PDF. They're per-element, NOT per-competency (same element has same broad development regardless of which competency it appears in).

### Phase 3: Rocket Report Component (2-3 days)

**What it shows**: Single competency deep-dive for one student.

**Visual design** (pop art style, matching existing NM identity):

```
┌─────────────────────────────────────────────────┐
│  🚀 ROCKET REPORT                               │
│  Agency in Learning — Jamie Chen                 │
│  Year 8 · Term 2 2026                           │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────┐           │
│  │  L5  Unbound Learner        ░░░ │           │
│  │  L4  Extended Learner       ██░ │  ← YOU    │
│  │  L3  Self-Regulated         ███ │  ARE HERE  │
│  │  L2  Diligent Learner       ░░░ │           │
│  │  L1  Directed Learner       ░░░ │           │
│  └──────────────────────────────────┘           │
│                                                  │
│  ELEMENT BREAKDOWN                               │
│  ┌────────────────────────────┐                 │
│  │ Acting with Autonomy    ●●●○ │  Applying    │
│  │ Being Reflective        ●●○○ │  Developing  │
│  │ Demonstrating Drive     ●●●● │  Extending   │
│  │ Engaging in Dialogue    ●●●○ │  Applying    │
│  │ ...                          │              │
│  └────────────────────────────┘                 │
│                                                  │
│  GROWTH STORY (AI-generated narrative)           │
│  "Jamie has shown strong growth in autonomy      │
│  this term, particularly in workshop sessions    │
│  where they consistently made independent        │
│  design decisions..."                            │
│                                                  │
│  NEXT STEPS                                      │
│  → Try seeking feedback from 2+ classmates       │
│  → Challenge yourself with unfamiliar materials  │
│  → Document your process without prompting       │
└─────────────────────────────────────────────────┘
```

**Implementation approach**:
- React component `RocketReport.tsx` in `src/components/nm/`
- Vertical stacked bar chart using inline SVG (no chart library needed — it's 5 horizontal bars)
- Element breakdown as horizontal dot-scale indicators
- AI-generated narrative via Haiku (reads all assessment data for that student+competency, produces 2-3 sentence growth story + 3 next steps)
- Pop art styling consistent with existing NM components
- API endpoint: `GET /api/teacher/nm-reports/rocket?studentId=X&competencyId=Y&classId=Z`

**Key improvement over Ruby**:
- Linked to actual student work (click an element → see the toolkit sessions, reflections, and AI conversations where that element was demonstrated)
- AI-generated growth narrative instead of static level description
- Teacher can annotate with their own observations inline

### Phase 4: Fan Profile Component (2 days)

**What it shows**: Multi-competency overview for one student.

**Visual design**:

```
┌─────────────────────────────────────────────────┐
│  ⭐ FAN PROFILE                                  │
│  Jamie Chen · Year 8 · Term 2 2026              │
├─────────────────────────────────────────────────┤
│                                                  │
│           Agency (L3.5)                          │
│              ╱    ╲                              │
│    Ethics   ╱      ╲   Quality                   │
│    (L3.0) ╱    ★    ╲  Thinking                  │
│           ╲          ╱  (L4.0)                   │
│    Personal╲        ╱ Collab                     │
│    Dev      ╲──────╱  (L3.5)                    │
│    (L2.5)      Citizenship                       │
│                (L3.0)                            │
│                                                  │
│  STRENGTHS: Quality Thinking, Collaboration      │
│  GROWTH AREAS: Personal Development              │
│                                                  │
│  COMPARED TO LAST ASSESSMENT                     │
│  ↑ Agency (+0.5)  ↑ Quality Thinking (+1.0)     │
│  → Ethics (same)  ↓ Personal Dev (-0.5)         │
└─────────────────────────────────────────────────┘
```

**Implementation approach**:
- React component `FanProfile.tsx` in `src/components/nm/`
- Polar/radar chart using SVG paths (lightweight, no D3 dependency)
- Animated transitions between assessment periods
- Overlay comparison (current vs previous assessment as dotted line)
- Requires min 2 competencies assessed to render
- Color-coded per competency (matching kit colors)

**Key improvement over Ruby**:
- Interactive — hover a competency spoke to see element breakdown
- Animated transitions show growth over time
- Side-by-side comparison mode (Term 1 vs Term 2)

### Phase 5: Learner Competency Credential (1-2 days)

**What it shows**: Formal PDF certificate at transition points.

**Implementation approach**:
- Use the existing PDF skill (`/sessions/nifty-great-keller/mnt/.claude/skills/pdf/SKILL.md`)
- Generate via server-side PDF creation (jsPDF or similar)
- University of Melbourne branding acknowledgment
- Student name, school, assessment date, assessed levels per competency
- Teacher signature line
- QR code linking to digital version

**Key improvement over Ruby**:
- Generated on-demand from live data (not a separate assessment event)
- Digital version is the interactive Fan Profile (QR links to it)
- Can include portfolio evidence links

### Phase 6: Progression Level Derivation Algorithm (1 day)

The existing `suggestProgressionLevel()` does a simple average. Ruby uses a more sophisticated approach based on element-level micro-judgements. StudioLoom should use a weighted approach:

```typescript
export function deriveProgressionLevel(
  assessments: CompetencyAssessment[],
  competencyId: string,
): { level: number; confidence: number; elementLevels: Record<string, number> } {

  // 1. Group by element
  const byElement = groupBy(assessments, 'element');

  // 2. For each element, compute weighted average (recent assessments weighted higher)
  const elementLevels: Record<string, number> = {};
  for (const [elementId, ratings] of Object.entries(byElement)) {
    // Exponential decay: most recent rating has highest weight
    const sorted = sortBy(ratings, 'created_at').reverse();
    let weightedSum = 0, weightSum = 0;
    sorted.forEach((r, i) => {
      const weight = Math.pow(0.7, i); // 70% decay per older assessment
      weightedSum += r.rating * weight;
      weightSum += weight;
    });
    elementLevels[elementId] = weightedSum / weightSum;
  }

  // 3. Map teacher 4-point scale to progression 5-point scale
  //    Emerging (1) → L1, Developing (2) → L2-3, Applying (3) → L3-4, Extending (4) → L4-5
  const mappedLevels = Object.values(elementLevels).map(avg => {
    if (avg <= 1.25) return 1;
    if (avg <= 1.75) return 2;
    if (avg <= 2.5) return 3;
    if (avg <= 3.25) return 4;
    return 5;
  });

  // 4. Overall level = rounded median of element levels (not mean — resistant to outliers)
  const sorted = mappedLevels.sort();
  const median = sorted[Math.floor(sorted.length / 2)];

  // 5. Confidence = based on coverage (% of elements assessed) and recency
  const totalElements = getElementsForCompetency(competencyId).length;
  const coverage = Object.keys(elementLevels).length / totalElements;
  const confidence = Math.min(coverage * 100, 100);

  return { level: median, confidence, elementLevels };
}
```

**Confidence indicator** is crucial — if a teacher has only observed 3 of 12 Agency elements, the derived level should show low confidence (25%). This prevents over-claiming from limited data. Ruby doesn't surface this — it just requires completing the full question set.

### Phase 7: AI Evidence Harvesting (Phase 2 — future)

This is the big differentiator. An AI pipeline that reads existing student data and maps it to competency evidence:

```
Student's toolkit sessions → AI reads effort scores, depth dots, idea quality
→ Maps to: Quality Thinking (creativity, persistence, reasoning)
           Agency (drive, openness to new, feedback loops)

Student's Open Studio check-ins → AI reads check-in responses, drift flags
→ Maps to: Agency (autonomy, managing ambiguity, self-regulation)
           Personal Dev (responsibility, courage)

Student's peer gallery reviews → AI reads review quality, format adherence
→ Maps to: Collaboration (respectful, responsible, dialogue)
           Ethics (empathetic, navigating diverse interests)
```

This doesn't replace teacher observation — it **supplements** it. Teachers still do ObservationSnap during class. But between observations, the system is quietly building an evidence base from what students are actually doing.

---

## 5. Recommended Build Order

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 1 | Expand constants.ts with all 7 competencies | 1 day | Communication PDF (can placeholder) |
| 2 | Add Broad Development descriptions | 0.5 day | Task 1 |
| 3 | Rocket Report component + API | 2-3 days | Task 1, 2 |
| 4 | Progression level derivation algorithm | 0.5 day | Task 1 |
| 5 | Fan Profile component | 2 days | Task 1, 4 |
| 6 | Credential PDF generation | 1-2 days | Task 4, PDF skill |
| 7 | NMResultsPanel upgrade (link to reports) | 0.5 day | Task 3, 5 |
| **Total** | | **~8 days** | |

**Phase 2 (future):**
| 8 | AI evidence harvesting pipeline | 3-5 days | Task 1 |
| 9 | Evidence linking (click element → see student work) | 2 days | Task 3, 8 |
| 10 | Teacher report generation (class-wide narrative) | 2 days | Task 3, 5 |

---

## 6. Key Design Decisions to Lock In

### 6.1 Shared Element Pool vs Duplicated Elements
**Recommendation: Shared pool.** One `NM_ELEMENT_POOL` with all 24 unique elements. Per-competency arrays just reference element IDs. This means:
- One teacher observation of "Being Empathetic" counts toward Ethics, Citizenship, Personal Dev, AND Collaboration
- The element's color and student description are consistent everywhere
- Adding Communication later just adds new element IDs to its array

### 6.2 Teacher 4-Point → Progression 5-Point Mapping
Ruby uses 22 MCQs to derive a 5-level placement. StudioLoom uses teacher observations on a 4-point scale. The mapping isn't 1:1. The algorithm above uses a median-of-mapped-elements approach. **Confidence score** is the key addition — low coverage = low confidence = "need more observations."

### 6.3 Student Self-Assessment Role
The existing CompetencyPulse (3-point student self-assessment) should NOT directly influence the progression level. It should appear alongside it as a "self-perception" comparison. Students tend to over- or under-rate themselves — the gap between self and teacher ratings is itself meaningful data. Ruby doesn't collect student self-assessment at all, so this is a StudioLoom addition.

### 6.4 Assessment Frequency
Ruby says 1-2 times per year maximum. StudioLoom's advantage is continuous micro-observations (ObservationSnap during Teaching Mode). The Rocket Report should aggregate ALL observations within a configurable time window (term/semester/year), not require a separate "assessment event."

### 6.5 Pop Art Visual Identity
All NM report components should use the existing pop art identity: hot pink (#FF2D78), electric yellow (#FFE135), cyan (#00D4FF), bold black borders, halftone patterns. The Rocket Report and Fan Profile should feel distinctly NM, not like generic charts.

### 6.6 Print/Export
Teachers will want to print reports for parent conferences and include in school reports. Every report component needs a "Print" button that renders a clean print-friendly version, plus "Export PDF" for formal records. The Credential is PDF-only by nature.

---

## 7. What This Looks Like for Teachers (UX Flow)

### Daily Flow (During Teaching)
1. Teaching Mode → see student cards → tap NM button on a student → ObservationSnap pops up
2. Rate 2-3 elements they just observed (10 seconds)
3. Move on. Data is captured.

### Weekly/Monthly Flow (Review)
1. Class Hub → NM tab → see Checkpoints view (existing NMResultsPanel)
2. Click a student name → Rocket Report opens for the configured competency
3. See progression level, element breakdown, AI growth narrative
4. Click "View Fan Profile" → multi-competency overview (if enough data)

### Term End Flow (Reporting)
1. Class Hub → NM tab → "Generate Reports" button
2. Choose: Rocket Reports (per competency) or Fan Profiles (overview) or both
3. Reports generated with AI narratives
4. "Export for School Reporting" → PDF batch with all students
5. Optional: Generate Credentials for transition-year students

### Parent Conference Flow
1. Open student's Fan Profile on tablet/laptop
2. Show radar chart — "Here's where Jamie is across competencies"
3. Tap a competency spoke → Rocket Report drills down
4. "Let me show you what Jamie actually did" → click element → portfolio evidence

---

## 8. Technical Notes

### Database Changes Needed
- **No new tables required** — existing `competency_assessments` table handles everything
- `constants.ts` expansion is code-only
- Reports are computed views, not stored

### API Endpoints Needed
```
GET /api/teacher/nm-reports/rocket?studentId=X&competencyId=Y&classId=Z&yearBand=5-8
GET /api/teacher/nm-reports/fan?studentId=X&classId=Z&yearBand=5-8
GET /api/teacher/nm-reports/credential?studentId=X&classId=Z
POST /api/teacher/nm-reports/batch?classId=Z&type=rocket|fan
```

### Component Architecture
```
src/components/nm/
├── NMConfigPanel.tsx          (existing)
├── CompetencyPulse.tsx        (existing)
├── ObservationSnap.tsx        (existing)
├── NMResultsPanel.tsx         (existing — needs upgrade to link to reports)
├── RocketReport.tsx           (NEW — single competency deep dive)
├── FanProfile.tsx             (NEW — multi-competency radar)
├── CredentialGenerator.tsx    (NEW — PDF certificate)
├── ElementBreakdown.tsx       (NEW — shared element rating display)
├── ProgressionBar.tsx         (NEW — vertical level indicator)
├── GrowthNarrative.tsx        (NEW — AI-generated text block)
└── index.ts                   (barrel exports)
```

---

## 9. Summary: StudioLoom vs Ruby

| Dimension | Ruby | StudioLoom (Planned) |
|-----------|------|---------------------|
| Evidence collection | 10-22 MCQs per assessment | Continuous micro-observations + passive signals |
| Assessment frequency | 1-2× per year | Ongoing (aggregated per reporting period) |
| Teacher time per assessment | 15-30 min per student | 10 seconds per observation (ObservationSnap) |
| Reports | Static PDF | Interactive components with drill-down |
| Evidence linking | None | Click element → see actual student work |
| Student voice | None | CompetencyPulse self-assessment alongside teacher rating |
| Curriculum integration | Separate platform | Embedded in lesson flow |
| Mobile/classroom use | Desktop only | Teaching Mode integration |
| AI support | None | Growth narratives + evidence harvesting |
| Growth tracking | Compare 2 static reports | Animated transitions between periods |

**Bottom line**: Ruby treats competency assessment as a separate event. StudioLoom treats it as a natural byproduct of teaching and learning. The reporting layer just surfaces what's already being captured.
