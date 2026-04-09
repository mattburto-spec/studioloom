# FormatProfile Definitions

**Status:** Spec — pre-Dimensions3 dependency
**Created:** 7 April 2026
**Depends on:** `docs/specs/neutral-criterion-taxonomy.md`, `src/lib/ai/unit-types.ts`, `src/lib/frameworks/index.ts`
**Consumed by:** All 6 Dimensions3 pipeline stages, admin sandbox, student UI

---

## 1. Purpose

Dimensions3 §14.9 defines the `FormatProfile` interface — the injection mechanism that makes the 6-stage generation pipeline format-aware without forking code paths. This spec provides the **concrete profile objects** for all 4 built-in unit types: Design, Service, Personal Project, and Inquiry.

Each profile is written to be copy-pastable into TypeScript. The existing `UnitTypeDefinition` in `unit-types.ts` covers ~60% of FormatProfile already (phases, aiPersona, teachingPrinciples, typicalActivities, timingNotes, detectionKeywords, extensionCategories). This spec adds the remaining ~40%: blockRelevance, sequenceHints, gapGenerationRules.forbiddenPatterns, connectiveTissue, timingModifiers, pulseWeights, criterionMapping, and studentExperience.

**Implementation path:** Extend `UnitTypeDefinition` into `FormatProfile` by adding these fields. Additive change — all existing code continues to work.

---

## 2. Summary Table

| Aspect | Design | Service | Personal Project | Inquiry |
|--------|--------|---------|-----------------|---------|
| Cycle | 4-phase (I→D→C→E) | 5-phase (IPARD) | 5-phase (D→P→A→R→R) | 4-phase (W→E→C→S) |
| Reflection style | end-only | continuous | milestone | end-only |
| Block boost | ideation, making, critique | research, collaboration, reflection, planning | reflection, planning, documentation, presentation | research, analysis, collaboration |
| Block suppress | — | making, skill-building | making, skill-building | making |
| Default sequence | Workshop Classic | Investigation First | Skill Build | Investigation First |
| Pulse CR/SA/TC | 40/30/30 | 25/40/35 | 30/45/25 | 35/35/30 |
| Work time floor | 45% | 30% | 60% | 40% |
| Setup buffer | 8 min | 5 min | 3 min | 3 min |
| Reflection min | 5 min | 10 min | 15 min | 5 min |
| Mentor style | Workshop buddy | Community guide | Project supervisor | Inquiry facilitator |
| Discovery mode | 1 (post-lessons) | 2 (unit start) | 2 (unit start) | 2 (unit start) |
| Progress viz | linear-phases | cyclical | milestone-timeline | linear-phases |
| Portfolio | project-pages | evidence-collection | process-journal | evidence-collection |

---

## 3. Design FormatProfile

```typescript
const DESIGN_PROFILE: FormatProfile = {
  id: "design",
  label: "Design Project",
  cycleName: "Design Cycle",
  phases: [
    { id: "investigate", label: "Inquiring & Analysing", description: "Research the problem, analyse existing solutions, define the brief", color: "#6366F1" },
    { id: "develop", label: "Developing Ideas", description: "Generate ideas, create specifications, select and justify a design", color: "#10B981" },
    { id: "create", label: "Creating the Solution", description: "Plan resources, build the prototype, document modifications", color: "#F59E0B" },
    { id: "evaluate", label: "Evaluating", description: "Test the solution, evaluate against specifications, reflect on impact", color: "#8B5CF6" },
  ],

  // --- Pipeline Extension Points ---

  blockRelevance: {
    boost: ["ideation", "making", "critique"],
    suppress: [],
    phaseIds: ["investigate", "develop", "create", "evaluate"],
  },

  sequenceHints: {
    defaultPattern: "workshop-classic",
    phaseWeights: {
      investigate: 0.20,
      develop: 0.25,
      create: 0.35,
      evaluate: 0.20,
    },
    requiredPhases: ["investigate", "evaluate"],
    repeatablePhases: ["develop", "create"],
    // Design is inherently non-linear — students iterate between
    // develop and create multiple times. investigate is required
    // at the start, evaluate at the end, but the middle is fluid.
  },

  gapGenerationRules: {
    aiPersona: "You are an expert Design & Technology teacher and curriculum designer. You create engaging, differentiated unit content that follows the Design Cycle.",
    teachingPrinciples: `Workshop Model is mandatory. Every lesson: Opening (5-10 min) → Mini-Lesson (max 1+age min) → Work Time (≥45% of period) → Debrief (5-10 min). Non-linear design cycle — plan for iteration. Gradual release (I do → We do → You do). Critique protocols are essential (Warm/Cool, I Like/I Wish/What If). Workshop awareness — account for setup, cleanup, material distribution, safety. Process over product. Safety culture for any lesson with tools/materials.`,
    typicalActivities: [
      "User research & interviews", "Product analysis", "Design brief writing",
      "Sketching & ideation", "CAD modelling", "Prototyping", "Material testing",
      "User testing", "Peer critique", "Portfolio documentation", "Design specification",
      "Manufacturing planning", "Workshop skills demo", "Gallery walk",
    ],
    forbiddenPatterns: [
      "All-lecture lessons with no making/doing",
      "Skipping safety briefing in workshop lessons",
      "Evaluation only at the very end (should iterate)",
      "Product-only assessment (process documentation is essential)",
    ],
  },

  connectiveTissue: {
    transitionVocabulary: [
      "Now that you've investigated the problem, let's start generating ideas...",
      "With your research complete, it's time to develop your design concepts...",
      "Your design is ready — let's bring it to life...",
      "You've built your solution — now let's see how well it works...",
      "Looking back at your specifications, how does your final product measure up?",
    ],
    reflectionStyle: "end-only",
    audienceLanguage: "your client/target audience",
  },

  timingModifiers: {
    defaultWorkTimeFloor: 0.45,
    setupBuffer: 8,       // Workshop setup/cleanup: material distribution, safety brief, cleanup
    reflectionMinimum: 5,  // Quick debrief at end of lesson
  },

  pulseWeights: {
    cognitiveRigour: 0.40,  // Design demands rigorous problem-solving
    studentAgency: 0.30,    // Moderate — scaffolded but with choice
    teacherCraft: 0.30,     // Teacher skill in managing workshop matters
  },

  criterionMapping: {
    primaryKeys: ["researching", "analysing", "designing", "creating", "evaluating", "reflecting"],
    groupings: {
      investigate: ["researching", "analysing"],
      develop: ["designing", "planning"],
      create: ["creating", "planning"],
      evaluate: ["evaluating", "reflecting"],
    },
  },

  studentExperience: {
    mentorPersonality: "workshop buddy",
    // Warm, direct, encouraging colleague. Challenges like a professional
    // peer. Asks harder questions than a tutor would. Uses design vocabulary
    // naturally. References the student's project specifically.
    progressVisualization: "linear-phases",
    portfolioStructure: "project-pages",
    discoveryMode: 1,  // Post-lessons (students have context from guided lessons first)
  },

  detectionKeywords: [
    "design", "prototype", "build", "make", "create", "workshop", "CAD",
    "materials", "product", "manufacture", "sketch", "model", "fabricate",
    "laser cut", "3D print", "sew", "construct", "assemble", "iterate",
  ],
  timingNotes: "Workshop/practical lessons need setup (5-8 min) and cleanup (5-8 min) deducted from usable time. Safety briefs add 3-5 min to opening. Skills demos may extend mini-lesson to max instruction cap.",
};
```

---

## 4. Service Learning FormatProfile

```typescript
const SERVICE_PROFILE: FormatProfile = {
  id: "service",
  label: "Service Learning",
  cycleName: "IPARD Cycle",
  phases: [
    { id: "investigate", label: "Investigate", description: "Research community needs, identify stakeholders, understand root causes", color: "#3B82F6" },
    { id: "plan", label: "Plan", description: "Set goals, develop action plan, identify resources and partners", color: "#8B5CF6" },
    { id: "act", label: "Act", description: "Implement the service action, collaborate with community partners", color: "#10B981" },
    { id: "reflect", label: "Reflect", description: "Reflect on learning, impact, and personal growth throughout", color: "#F59E0B" },
    { id: "demonstrate", label: "Demonstrate", description: "Share learning and impact with an audience", color: "#EF4444" },
  ],

  blockRelevance: {
    boost: ["research", "collaboration", "reflection", "planning"],
    suppress: ["making", "skill-building"],
    // Service is about community action, not physical fabrication.
    // "making" blocks (workshop-style activities) are irrelevant.
    // "skill-building" blocks (tool demos, technique practice) are
    // rarely appropriate — skills develop THROUGH the service.
    phaseIds: ["investigate", "plan", "act", "reflect", "demonstrate"],
  },

  sequenceHints: {
    defaultPattern: "investigation-first",
    phaseWeights: {
      investigate: 0.20,
      plan: 0.15,
      act: 0.35,
      reflect: 0.15,  // Appears in every lesson (continuous), but as a phase gets 0.15
      demonstrate: 0.15,
    },
    requiredPhases: ["investigate", "reflect", "demonstrate"],
    repeatablePhases: ["reflect", "act"],
    // Reflection is continuous — it appears explicitly in most lessons,
    // not just as a dedicated phase. Act can repeat as plans evolve.
  },

  gapGenerationRules: {
    aiPersona: "You are an expert Service Learning educator. You guide students through meaningful community engagement using the IPARD cycle. You understand that good service learning is WITH communities, not FOR them.",
    teachingPrinciples: `Reciprocity over charity — partnership with community, not one-way giving. IPARD cycle (Investigate → Plan → Act → Reflect → Demonstrate). Authentic community connection required. Reflection is continuous (every lesson, not just at end). Ethical engagement (who benefits? who might be harmed? sustainability?). Sustained engagement over weeks. ATL skills developed through service. Student voice and agency. Celebration of impact.`,
    typicalActivities: [
      "Community needs assessment", "Stakeholder interviews", "Root cause analysis",
      "Action planning", "Resource mapping", "Partnership development",
      "Direct service action", "Indirect service (fundraising, awareness)",
      "Advocacy & campaigning", "Reflective journaling", "Impact documentation",
      "Presentation to community", "Process portfolio", "Peer mentoring",
    ],
    forbiddenPatterns: [
      "Teacher-assigned service topic (student voice is essential)",
      "One-day volunteering presented as service learning",
      "Charity framing ('helping the less fortunate')",
      "Skipping community voice (students assuming they know the need)",
      "Assessment without reflection (product-only evaluation)",
      "Workshop/making activities unrelated to service action",
    ],
  },

  connectiveTissue: {
    transitionVocabulary: [
      "Now that you understand the community's needs, let's plan your response...",
      "Your plan is ready — it's time to take action...",
      "As you act, keep reflecting: what are you learning about yourself and the community?",
      "Having taken action, let's step back and reflect on what happened...",
      "It's time to share your impact — who needs to hear about what you've done?",
    ],
    reflectionStyle: "continuous",
    audienceLanguage: "your community partner(s)",
  },

  timingModifiers: {
    defaultWorkTimeFloor: 0.30,
    // Lower than design because service lessons often include
    // off-site/community interaction that eats into standard lesson time.
    // Transition to/from fieldwork, guest speaker Q&A, etc.
    setupBuffer: 5,        // Less physical setup than workshop, but may need travel/transition time
    reflectionMinimum: 10, // Service demands deeper, more personal reflection than design
  },

  pulseWeights: {
    cognitiveRigour: 0.25,  // Important but not the primary focus
    studentAgency: 0.40,    // Service is student-driven — initiative matters most
    teacherCraft: 0.35,     // Teacher skill in facilitating community connections is high
  },

  criterionMapping: {
    primaryKeys: ["researching", "analysing", "planning", "creating", "reflecting", "communicating"],
    groupings: {
      investigate: ["researching", "analysing"],
      plan: ["planning", "designing"],
      act: ["creating", "communicating"],
      reflect: ["reflecting", "evaluating"],
      demonstrate: ["communicating", "evaluating"],
    },
  },

  studentExperience: {
    mentorPersonality: "community guide",
    // Part accountability partner, part community coach. Pushes students
    // to think critically about needs (not just "helping"). Challenges
    // surface-level reflections. Holds them to their own goals.
    // Uses "impact" not "result", "community partner" not "client".
    progressVisualization: "cyclical",
    // IPARD is cyclical — reflect feeds back into investigate.
    // Visual shows the cycle with current position highlighted.
    portfolioStructure: "evidence-collection",
    // Service portfolios are evidence of impact: photos, partner
    // testimonials, data, reflections. Not structured project pages.
    discoveryMode: 2,  // Unit start — students need to find their issue first
  },

  detectionKeywords: [
    "service", "community", "volunteer", "help", "action", "impact",
    "charity", "need", "stakeholder", "campaign", "awareness", "fundraise",
    "community project", "social issue", "advocacy", "partnership",
    "MYP community project", "CAS", "service as action",
  ],
  timingNotes: "Service learning lessons often include offsite/community interaction. Plan for in-class preparation and debrief around community contact. Fieldwork lessons may have different timing structures. Reflection activities tend to be longer and more personal than in design units.",
};
```

---

## 5. Personal Project FormatProfile

```typescript
const PP_PROFILE: FormatProfile = {
  id: "personal_project",
  label: "Personal Project",
  cycleName: "PP Process",
  phases: [
    { id: "define", label: "Defining", description: "Define a clear goal, identify prior knowledge, establish success criteria", color: "#6366F1" },
    { id: "plan", label: "Planning", description: "Develop a detailed plan with timeline, resources, and process journal structure", color: "#3B82F6" },
    { id: "apply", label: "Applying Skills", description: "Take action on the project, apply ATL skills, document process", color: "#10B981" },
    { id: "reflect", label: "Reflecting", description: "Evaluate the product/outcome, reflect on learning and ATL development", color: "#F59E0B" },
    { id: "report", label: "Reporting", description: "Write the report, present the project, celebrate achievement", color: "#8B5CF6" },
  ],

  blockRelevance: {
    boost: ["reflection", "planning", "documentation", "presentation"],
    suppress: ["making", "skill-building"],
    // PP is about self-management and reflection, not technical skills.
    // "making" blocks are irrelevant (the product could be anything).
    // "skill-building" is too prescriptive — ATL skills develop through
    // the project, not through directed skill demos.
    phaseIds: ["define", "plan", "apply", "reflect", "report"],
  },

  sequenceHints: {
    defaultPattern: "skill-build",
    // "Skill Build" pattern fits PP: focused skill sessions (goal-setting,
    // time management, citation, reflection writing) interspersed with
    // independent work time. NOT a linear content delivery.
    phaseWeights: {
      define: 0.15,
      plan: 0.20,
      apply: 0.30,
      reflect: 0.20,  // Heavy — PP is assessed primarily on reflection quality
      report: 0.15,
    },
    requiredPhases: ["define", "reflect", "report"],
    repeatablePhases: ["apply", "reflect"],
    // Apply and reflect alternate throughout the project.
    // Students apply, then reflect on what they learned, then apply again.
  },

  gapGenerationRules: {
    aiPersona: "You are an expert Personal Project supervisor. You guide students through self-directed extended projects, helping them develop ATL skills while pursuing a topic they're passionate about. You balance student autonomy with structured guidance through the process journal.",
    teachingPrinciples: `Student-driven goals — topic and goal come from the student. Process journal is central (it IS the assessment, not a formality). ATL skills are the real learning (self-management, research, communication, thinking, social). Extended timeline (6-9 months). Supervisor as mentor, not content expert. Academic honesty is strictly enforced. Goal-criteria alignment from day one. Report structure scaffolded early.`,
    typicalActivities: [
      "Goal brainstorming & refinement", "SMART criteria writing", "Process journal setup",
      "Research planning", "ATL skills self-assessment", "Milestone check-ins",
      "Expert interviews or consultations", "Product development sessions",
      "Peer feedback rounds", "Progress presentations", "Report drafting workshops",
      "Citation & academic honesty lessons", "Final presentation preparation",
    ],
    forbiddenPatterns: [
      "Teacher-directed workshop demo (PP is student-directed)",
      "Content-heavy mini-lessons (teacher isn't the content expert)",
      "Group projects (PP is individual)",
      "Product-only assessment (process and reflection are primary)",
      "Rigid weekly schedule (PP students work at different paces)",
    ],
  },

  connectiveTissue: {
    transitionVocabulary: [
      "Now that you've defined your goal and criteria, let's create your plan...",
      "Your plan is in place — time to start working on your product...",
      "Let's pause and reflect: what ATL skills have you been using?",
      "Looking at your progress, how does your product align with your original goal?",
      "It's time to pull everything together for your report and presentation...",
    ],
    reflectionStyle: "milestone",
    // PP reflection happens at key checkpoints: after defining,
    // at plan completion, mid-apply, before reporting.
    // Not continuous (that's service) and not end-only (that's design).
    audienceLanguage: "your supervisor",
  },

  timingModifiers: {
    defaultWorkTimeFloor: 0.60,
    // PP lessons are predominantly student-directed work time.
    // Teacher's role is supervisor check-ins (short) + process skill
    // mini-lessons (short). Most of the period is independent work.
    setupBuffer: 3,         // Minimal physical setup — students bring their own materials/laptops
    reflectionMinimum: 15,  // PP demands the deepest reflection of any format
  },

  pulseWeights: {
    cognitiveRigour: 0.30,  // Important but secondary to self-direction
    studentAgency: 0.45,    // Highest of any format — PP is entirely student-driven
    teacherCraft: 0.25,     // Teacher is a facilitator, not a content deliverer
  },

  criterionMapping: {
    primaryKeys: ["researching", "planning", "creating", "reflecting", "communicating", "evaluating"],
    groupings: {
      // Phase-level groupings (which neutral keys each phase primarily develops)
      define: ["researching", "planning"],
      plan: ["planning", "designing"],
      apply: ["creating", "communicating", "analysing"],
      reflect: ["reflecting", "evaluating"],
      report: ["communicating", "reflecting"],
      // NOTE: PP has 3 MYP assessment criteria (A=Planning, B=Applying Skills,
      // C=Reflecting) that cross-cut these phases. The FrameworkAdapter handles
      // that mapping at render time using the neutral-criterion-taxonomy tables:
      //   PP Criterion A → researching + planning + designing
      //   PP Criterion B → creating + communicating + analysing
      //   PP Criterion C → reflecting + evaluating + communicating
    },
  },

  studentExperience: {
    mentorPersonality: "project supervisor",
    // Process mentor and writing coach. Helps stay on track.
    // Pushes on ATL skills. Challenges vague goals. Nudges
    // documentation. Uses "your process journal" frequently.
    progressVisualization: "milestone-timeline",
    // PP is a long journey — milestone markers (goal set, plan done,
    // product started, first draft, final presentation) shown as a
    // timeline with current position.
    portfolioStructure: "process-journal",
    // The process journal IS the portfolio. Chronological entries
    // with evidence, reflections, and development documentation.
    discoveryMode: 2,  // Unit start — student needs to find their passion first
  },

  detectionKeywords: [
    "personal project", "PP", "process journal", "self-directed",
    "extended project", "independent project", "passion project",
    "MYP personal project", "year 5 project", "capstone",
  ],
  timingNotes: "PP lessons are often supervisor check-ins (20-30 min) interspersed with independent work time. Workshop Model still applies but Work Time is student-directed. Mini-lessons focus on process skills (goal-setting, time management, citation) rather than content. Group lessons alternate with individual conferences.",
};
```

---

## 6. Inquiry FormatProfile

```typescript
const INQUIRY_PROFILE: FormatProfile = {
  id: "inquiry",
  label: "Inquiry Unit",
  cycleName: "Inquiry Cycle",
  phases: [
    { id: "wonder", label: "Wondering", description: "Generate questions, activate prior knowledge, build curiosity", color: "#6366F1" },
    { id: "explore", label: "Exploring", description: "Research, investigate, gather evidence, conduct experiments", color: "#3B82F6" },
    { id: "create", label: "Creating", description: "Synthesise findings, create something to show understanding", color: "#10B981" },
    { id: "share", label: "Sharing", description: "Present learning, give/receive feedback, reflect on growth", color: "#F59E0B" },
  ],

  blockRelevance: {
    boost: ["research", "analysis", "collaboration"],
    suppress: ["making"],
    // Inquiry is about understanding, not fabrication.
    // "making" blocks (physical construction, workshop tasks)
    // are rarely appropriate. "creating" in inquiry context means
    // creating to DEMONSTRATE understanding, not physical products.
    phaseIds: ["wonder", "explore", "create", "share"],
  },

  sequenceHints: {
    defaultPattern: "investigation-first",
    phaseWeights: {
      wonder: 0.15,
      explore: 0.40,  // Exploration is the heart of inquiry
      create: 0.25,
      share: 0.20,
    },
    requiredPhases: ["wonder", "share"],
    repeatablePhases: ["explore", "create"],
    // Students may cycle between exploring and creating multiple
    // times as their understanding deepens. Wonder is the hook,
    // share is the culmination.
  },

  gapGenerationRules: {
    aiPersona: "You are an expert inquiry-based learning facilitator. You design provocative learning experiences that spark curiosity and guide students through structured inquiry. Great inquiry starts with genuine wonder and ends with students constructing their own understanding.",
    teachingPrinciples: `Provocation first — spark genuine curiosity (cognitive conflict, surprise). Student questions drive learning. Multiple perspectives (cultural, historical, scientific, ethical). Transdisciplinary connections. Evidence-based thinking (opinion vs observation vs evidence). Constructivist approach (discover, don't receive). Visible thinking routines (See-Think-Wonder, Claim-Support-Question, Compass Points). Exhibition/sharing gives purpose.`,
    typicalActivities: [
      "Provocations", "See-Think-Wonder routines", "Question generation",
      "Research & investigation", "Expert interviews", "Field trips/virtual visits",
      "Experiments & data collection", "Thinking routines", "Concept mapping",
      "Creative synthesis", "Exhibition preparation", "Peer teaching",
      "Gallery walk", "Reflection journals", "Circle of Viewpoints",
    ],
    forbiddenPatterns: [
      "Pre-determined answers (inquiry must be genuinely open)",
      "Teacher-driven question selection (students generate questions)",
      "Product-focused assessment (thinking is assessed, not artifacts)",
      "Single-perspective investigations (always seek multiple viewpoints)",
      "Heavy front-loaded content delivery (provoke, don't lecture)",
    ],
  },

  connectiveTissue: {
    transitionVocabulary: [
      "Your questions are shaping this journey — let's start exploring...",
      "What you've discovered raises new questions — let's dig deeper...",
      "You've gathered enough evidence — now let's make sense of it...",
      "It's time to share what you've learned — and hear what others discovered...",
      "Looking back at your original question, how has your thinking changed?",
    ],
    reflectionStyle: "end-only",
    // Inquiry reflection is primarily in the Sharing phase.
    // Thinking routines throughout the unit serve as lightweight
    // reflection, but formal reflection is at the end.
    audienceLanguage: "your learning community",
  },

  timingModifiers: {
    defaultWorkTimeFloor: 0.40,
    // More flexible than design. Inquiry includes more discussion
    // and collaborative activities within work time.
    setupBuffer: 3,         // Minimal physical setup unless experiments are involved
    reflectionMinimum: 5,   // Thinking routines replace formal reflection in most lessons
  },

  pulseWeights: {
    cognitiveRigour: 0.35,  // Evidence-based thinking demands rigour
    studentAgency: 0.35,    // Student questions drive the inquiry
    teacherCraft: 0.30,     // Facilitation skill in provocations and thinking routines matters
  },

  criterionMapping: {
    primaryKeys: ["researching", "analysing", "creating", "communicating", "evaluating", "reflecting"],
    groupings: {
      wonder: ["researching"],
      explore: ["researching", "analysing"],
      create: ["creating", "designing"],
      share: ["communicating", "evaluating", "reflecting"],
    },
  },

  studentExperience: {
    mentorPersonality: "inquiry facilitator",
    // Genuinely curious. Asks "I wonder..." questions. Makes
    // connections the student hasn't seen. Pushes for evidence
    // ("what makes you think that?"). Celebrates questions as
    // much as answers. Uses thinking routine language naturally.
    progressVisualization: "linear-phases",
    portfolioStructure: "evidence-collection",
    // Inquiry portfolios collect evidence of thinking: questions,
    // observations, data, reflections, synthesis artifacts.
    discoveryMode: 2,  // Unit start — students need to find their question first
  },

  detectionKeywords: [
    "inquiry", "investigation", "explore", "wonder", "question",
    "exhibition", "PYP", "transdisciplinary", "provocation",
    "guided inquiry", "structured inquiry", "open inquiry",
    "PYPx", "primary years", "exhibition",
  ],
  timingNotes: "Inquiry lessons tend to be more flexible than design. Workshop Model still applies but Work Time may include more collaborative and discussion-based activities. Mini-lessons often introduce thinking routines. Provocations may take up to 15 min.",
};
```

---

## 7. Implementation Notes

### 7.1 Extending UnitTypeDefinition

The migration path from `UnitTypeDefinition` → `FormatProfile`:

```typescript
// New type extends existing
interface FormatProfile extends UnitTypeDefinition {
  blockRelevance: { boost: string[]; suppress: string[]; phaseIds: string[] };
  sequenceHints: {
    defaultPattern: string;
    phaseWeights: Record<string, number>;
    requiredPhases: string[];
    repeatablePhases: string[];
  };
  // gapGenerationRules already ~80% covered by UnitTypeDefinition:
  //   aiPersona → gapGenerationRules.aiPersona
  //   teachingPrinciples → gapGenerationRules.teachingPrinciples
  //   typicalActivities → gapGenerationRules.typicalActivities
  //   NEW: forbiddenPatterns
  gapGenerationRules: {
    aiPersona: string;
    teachingPrinciples: string;
    typicalActivities: string[];
    forbiddenPatterns: string[];
  };
  connectiveTissue: {
    transitionVocabulary: string[];
    reflectionStyle: "end-only" | "continuous" | "milestone";
    audienceLanguage: string;
  };
  timingModifiers: {
    defaultWorkTimeFloor: number;
    setupBuffer: number;
    reflectionMinimum: number;
  };
  pulseWeights: {
    cognitiveRigour: number;
    studentAgency: number;
    teacherCraft: number;
  };
  criterionMapping: {
    primaryKeys: string[];
    groupings: Record<string, string[]>;
  };
  studentExperience: {
    mentorPersonality: string;
    progressVisualization: "linear-phases" | "cyclical" | "milestone-timeline";
    portfolioStructure: "project-pages" | "process-journal" | "evidence-collection";
    discoveryMode: 1 | 2;
  };
}
```

### 7.2 Fields Already in UnitTypeDefinition (no duplication needed)

These existing `UnitTypeDefinition` fields map directly to FormatProfile:

| UnitTypeDefinition field | FormatProfile location |
|-------------------------|----------------------|
| `type` | `id` |
| `label` | `label` |
| `cycleName` | `cycleName` |
| `phases` | `phases` (same shape, add `description`) |
| `extensionCategories` | Stays separate (used by `buildUnitTypeSystemPrompt`) |
| `aiPersona` | `gapGenerationRules.aiPersona` |
| `teachingPrinciples` | `gapGenerationRules.teachingPrinciples` |
| `typicalActivities` | `gapGenerationRules.typicalActivities` |
| `timingNotes` | `timingNotes` |
| `detectionKeywords` | `detectionKeywords` |

### 7.3 Registry Pattern

```typescript
// Extend existing UNIT_TYPES registry
export const FORMAT_PROFILES: Record<string, FormatProfile> = {
  design: DESIGN_PROFILE,
  service: SERVICE_PROFILE,
  personal_project: PP_PROFILE,
  inquiry: INQUIRY_PROFILE,
};

// Resolution: built-in first, then DB (custom formats)
export function getFormatProfile(formatId: string): FormatProfile {
  return FORMAT_PROFILES[formatId]
    ?? loadCustomFormatFromDB(formatId)  // Future: format_profiles table
    ?? FORMAT_PROFILES.design;           // Ultimate fallback
}
```

### 7.4 Sequence Pattern Registry

The 5 sequence patterns referenced by `sequenceHints.defaultPattern`:

| Pattern | Description | Use Case |
|---------|------------|----------|
| `workshop-classic` | Opening → Mini-lesson → Sustained work → Debrief | Design (standard workshop flow) |
| `investigation-first` | Heavy research/exploration front, lighter making back | Service, Inquiry |
| `iterative-sprint` | Short cycles of make → test → improve | Design (prototyping-heavy units) |
| `critique-and-refine` | Build → structured critique → revise | Design (evaluation-heavy units) |
| `skill-build` | Targeted skill sessions → independent application | PP (ATL skill focus) |

These are soft suggestions (day-1 defaults), not hardcoded templates. The system learns from teacher patterns and gradually replaces them. Teachers can create custom named patterns.

### 7.5 Validation Rules

When writing or extending FormatProfile objects:

1. `phaseWeights` values must sum to 1.0
2. `pulseWeights` values must sum to 1.0
3. `requiredPhases` must be a subset of `phases[].id`
4. `repeatablePhases` must be a subset of `phases[].id`
5. `requiredPhases` and `repeatablePhases` MAY overlap — a phase can be both required (must appear at least once) and repeatable (can appear multiple times). Example: Service and PP both require `reflect` and allow it to repeat.
6. `blockRelevance.boost` values must be from the 14 activity categories
7. `blockRelevance.suppress` values must be from the 14 activity categories
8. `blockRelevance.phaseIds` must match `phases[].id`
9. `criterionMapping.primaryKeys` must be from the 8 neutral criterion keys
10. `criterionMapping.groupings` keys must match `phases[].id` (phase-level groupings)
11. `criterionMapping.groupings` values must be arrays of neutral criterion keys
12. No overlap between `boost` and `suppress` arrays
