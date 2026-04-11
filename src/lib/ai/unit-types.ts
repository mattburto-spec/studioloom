/**
 * Unit Type Definitions & Prompt Builders
 *
 * This is the core abstraction that makes StudioLoom work across
 * Design, Service Learning, Personal Project, and Inquiry units.
 *
 * Each unit type defines:
 * - Its pedagogical cycle (phases)
 * - How it maps to assessment criteria
 * - What the AI persona should be
 * - What kinds of activities/extensions are appropriate
 * - Timing adjustments
 *
 * Reference: docs/specs/unit-type-framework-architecture.md
 */

// =========================================================================
// Unit Type Definition
// =========================================================================

export type UnitType = "design" | "service" | "personal_project" | "inquiry";

export interface UnitTypePhase {
  id: string;
  label: string;
  /** Short description of what students do in this phase */
  description: string;
  /** Color for UI rendering */
  color: string;
}

export interface UnitTypeDefinition {
  type: UnitType;
  label: string;
  /** One-line description for UI */
  description: string;
  /** The pedagogical cycle name */
  cycleName: string;
  /** Ordered phases of the cycle */
  phases: UnitTypePhase[];
  /** Default extension categories (indexed to phases) */
  extensionCategories: Record<string, string[]>;
  /** AI persona description */
  aiPersona: string;
  /** Core teaching principles specific to this unit type */
  teachingPrinciples: string;
  /** What kinds of activities are typical */
  typicalActivities: string[];
  /** Timing adjustments (e.g., service units need more fieldwork time) */
  timingNotes: string;
  /** Keywords that signal this unit type in free-text input */
  detectionKeywords: string[];
}

// =========================================================================
// Unit Type Definitions
// =========================================================================

const DESIGN_TYPE: UnitTypeDefinition = {
  type: "design",
  label: "Design Project",
  description: "Students design and create a solution to a real problem",
  cycleName: "Design Cycle",
  phases: [
    { id: "investigate", label: "Inquiring & Analysing", description: "Research the problem, analyse existing solutions, define the brief", color: "#6366F1" },
    { id: "develop", label: "Developing Ideas", description: "Generate ideas, create specifications, select and justify a design", color: "#10B981" },
    { id: "create", label: "Creating the Solution", description: "Plan resources, build the prototype, document modifications", color: "#F59E0B" },
    { id: "evaluate", label: "Evaluating", description: "Test the solution, evaluate against specifications, reflect on impact", color: "#8B5CF6" },
  ],
  extensionCategories: {
    investigate: ["deeper research", "more interviews", "competitor analysis", "accessibility audit", "user empathy mapping"],
    develop: ["SCAMPER on top concept", "constraint variation", "rapid prototype 3 versions", "biomimicry exploration"],
    create: ["different materials", "scale variation", "user testing with different demographic", "sustainability improvements"],
    evaluate: ["edge-case testing", "cross-cohort comparison", "sustainability analysis", "lifecycle assessment"],
  },
  aiPersona: "You are an expert Design & Technology teacher and curriculum designer. You create engaging, differentiated unit content that follows the Design Cycle.",
  teachingPrinciples: `## Design Teaching Principles
1. WORKSHOP MODEL (HIGHEST PRIORITY): Every lesson follows 4 phases — Opening (5-10 min) → Mini-Lesson (max 1+age minutes) → Work Time (at least 45% of period, ideally 60%+) → Debrief (5-10 min). Work Time is THE MAIN EVENT.

2. NON-LINEAR DESIGN CYCLE: The design cycle is NOT a linear sequence. Students jump between phases (research → ideate → test → back to research). Plan for iteration and decision points.

3. GRADUAL RELEASE: Use "I do → We do → You do" scaffolding. Progressively remove scaffolding as students gain confidence.

4. WHOLE GAME: Every activity should connect to the broader design challenge. Students should always know WHY they're doing something.

5. CRITIQUE PROTOCOLS: Include structured critique (Warm/Cool feedback, I Like/I Wish/What If, TAG, silent gallery walk). "I like it" is not feedback. "I like how the handle curves to fit the palm" is feedback.

6. WORKSHOP AWARENESS: Design lessons have physical realities — setup time, cleanup time, material distribution, safety briefs. Account for these.

7. STUDIO CULTURE: Work is always visible, critique is normal, iteration is expected, the teacher is a design mentor (not a lecturer).

8. PROCESS OVER PRODUCT: A portfolio showing iterative improvement is more valuable than a perfect final product.

9. SAFETY CULTURE: For ANY lesson involving tools, materials, or equipment: include safety in the introduction or as a content section.`,
  typicalActivities: [
    "User research & interviews", "Product analysis", "Design brief writing",
    "Sketching & ideation", "CAD modelling", "Prototyping", "Material testing",
    "User testing", "Peer critique", "Portfolio documentation", "Design specification",
    "Manufacturing planning", "Workshop skills demo", "Gallery walk",
  ],
  timingNotes: "Workshop/practical lessons need setup (5-8 min) and cleanup (5-8 min) deducted from usable time. Safety briefs add 3-5 min to opening. Skills demos may extend mini-lesson to max instruction cap.",
  detectionKeywords: [
    "design", "prototype", "build", "make", "create", "workshop", "CAD",
    "materials", "product", "manufacture", "sketch", "model", "fabricate",
    "laser cut", "3D print", "sew", "construct", "assemble", "iterate",
  ],
};

const SERVICE_TYPE: UnitTypeDefinition = {
  type: "service",
  label: "Service Learning",
  description: "Students investigate a community need and take meaningful action",
  cycleName: "IPARD Cycle",
  phases: [
    { id: "investigate", label: "Investigate", description: "Research community needs, identify stakeholders, understand root causes", color: "#3B82F6" },
    { id: "plan", label: "Plan", description: "Set goals, develop action plan, identify resources and partners", color: "#8B5CF6" },
    { id: "act", label: "Act", description: "Implement the service action, collaborate with community partners", color: "#10B981" },
    { id: "reflect", label: "Reflect", description: "Reflect on learning, impact, and personal growth throughout", color: "#F59E0B" },
    { id: "demonstrate", label: "Demonstrate", description: "Share learning and impact with an audience", color: "#EF4444" },
  ],
  extensionCategories: {
    investigate: ["interview another stakeholder", "root cause analysis (5 Whys)", "systems mapping of the issue", "historical context research"],
    plan: ["risk assessment", "alternative approach planning", "budget and resource deep-dive", "partnership agreement drafting"],
    act: ["document process for others to replicate", "create instructional resource", "train peers to continue the work"],
    reflect: ["write a reflection blog post", "create a visual timeline of growth", "connect to global examples of similar action"],
    demonstrate: ["prepare presentation for school assembly", "create social media campaign", "write article for school newsletter"],
  },
  aiPersona: "You are an expert Service Learning educator. You guide students through meaningful community engagement using the IPARD cycle (Investigate, Plan, Act, Reflect, Demonstrate). You understand that good service learning is WITH communities, not FOR them.",
  teachingPrinciples: `## Service Learning Principles
1. RECIPROCITY OVER CHARITY: Service learning is a partnership with the community, not a one-way gift. Students must understand the community's perspective and needs as defined BY the community, not assumed by outsiders.

2. IPARD CYCLE: Every unit follows Investigate → Plan → Act → Reflect → Demonstrate. Reflection happens throughout (not just at the end). Each phase informs the next.

3. AUTHENTIC COMMUNITY CONNECTION: Students must engage with real community members, organisations, or issues. Simulated scenarios are acceptable for planning and preparation, but the action phase must involve genuine community interaction where possible.

4. REFLECTION IS CONTINUOUS: Unlike design where reflection is mainly at the end, service learning embeds reflection at every phase. "What did I learn about myself? About the community? About the issue?"

5. ETHICAL ENGAGEMENT: Students must consider: Who benefits? Who might be harmed? Are we reinforcing stereotypes? Is this sustainable? Do community partners have agency and voice?

6. SUSTAINED ENGAGEMENT: Service learning is not a one-day volunteering event. Plan for sustained involvement over weeks, with deepening understanding and increasing student agency.

7. SKILLS THROUGH SERVICE: ATL skills (communication, collaboration, self-management, research, thinking) are developed THROUGH the service, not taught separately. Make the skill development explicit.

8. STUDENT VOICE & AGENCY: Students should have genuine choice in what issue to address and how to act. Teacher guides the process, not the solution.

9. CELEBRATION OF IMPACT: The Demonstrate phase makes learning visible — to the community, to the school, to families. This is not just a presentation; it's evidence of meaningful action.`,
  typicalActivities: [
    "Community needs assessment", "Stakeholder interviews", "Root cause analysis",
    "Action planning", "Resource mapping", "Partnership development",
    "Direct service action", "Indirect service (fundraising, awareness)",
    "Advocacy & campaigning", "Reflective journaling", "Impact documentation",
    "Presentation to community", "Process portfolio", "Peer mentoring",
  ],
  timingNotes: "Service learning lessons often include offsite/community interaction time that exceeds normal lesson length. Plan for in-class preparation and debrief around community contact. Fieldwork lessons may have different timing structures (no workshop setup but may need travel/transition time). Reflection activities tend to be longer and more personal than in design units.",
  detectionKeywords: [
    "service", "community", "volunteer", "help", "action", "impact",
    "charity", "need", "stakeholder", "campaign", "awareness", "fundraise",
    "community project", "social issue", "advocacy", "partnership",
    "MYP community project", "CAS", "service as action",
  ],
};

const PERSONAL_PROJECT_TYPE: UnitTypeDefinition = {
  type: "personal_project",
  label: "Personal Project",
  description: "Students pursue a self-directed investigation or creation over an extended period",
  cycleName: "PP Process",
  phases: [
    { id: "define", label: "Defining", description: "Define a clear goal, identify prior knowledge, establish success criteria", color: "#6366F1" },
    { id: "plan", label: "Planning", description: "Develop a detailed plan with timeline, resources, and process journal structure", color: "#3B82F6" },
    { id: "apply", label: "Applying Skills", description: "Take action on the project, apply ATL skills, document process", color: "#10B981" },
    { id: "reflect", label: "Reflecting", description: "Evaluate the product/outcome, reflect on learning and ATL development", color: "#F59E0B" },
    { id: "report", label: "Reporting", description: "Write the report, present the project, celebrate achievement", color: "#8B5CF6" },
  ],
  extensionCategories: {
    define: ["explore alternative goals", "research expert perspectives", "interview someone in the field", "create a mood board or vision board"],
    plan: ["detailed risk assessment", "alternative timeline scenarios", "resource comparison research", "create GANTT chart"],
    apply: ["document a failed approach and what you learned", "seek expert feedback", "try an alternative method", "teach someone else what you've learned"],
    reflect: ["connect to global context implications", "write a reflection for a wider audience", "compare your growth to initial self-assessment"],
    report: ["create a visual presentation supplement", "prepare Q&A responses", "write a blog post version", "mentor next year's PP students"],
  },
  aiPersona: "You are an expert Personal Project supervisor. You guide students through self-directed extended projects, helping them develop ATL skills while pursuing a topic they're passionate about. You balance student autonomy with structured guidance through the process journal.",
  teachingPrinciples: `## Personal Project Principles
1. STUDENT-DRIVEN GOALS: The project topic and goal come from the student, not the teacher. Your role is to help them refine and focus, not to assign.

2. PROCESS JOURNAL IS CENTRAL: The process journal is the primary evidence of learning. It documents planning, development, reflection, and growth. Help students understand that the journal IS the assessment, not just a formality.

3. ATL SKILLS ARE THE REAL LEARNING: The product matters, but ATL skill development (self-management, research, communication, thinking, social) is what's being assessed. Every lesson should make ATL skill development explicit.

4. EXTENDED TIMELINE: Personal projects run 6-9 months. Lessons should support sustained engagement — check-ins, milestone reviews, pivot points, motivation strategies.

5. SUPERVISOR AS MENTOR: The teacher is a supervisor/mentor, not a content expert. You guide the process, help with goal-setting, review progress, and push for deeper reflection.

6. ACADEMIC HONESTY: PP has strict academic honesty requirements. Teach proper citation, distinguish student work from external input, and help students document all sources.

7. GOAL-CRITERIA ALIGNMENT: The student's goal, success criteria, and final reflection must align. Help students write measurable success criteria from the start.

8. REPORT STRUCTURE: The final report follows a specific structure (goal, global context, process, ATL skills, reflection). Scaffold this from early in the project, not just at the end.`,
  typicalActivities: [
    "Goal brainstorming & refinement", "SMART criteria writing", "Process journal setup",
    "Research planning", "ATL skills self-assessment", "Milestone check-ins",
    "Expert interviews or consultations", "Product development sessions",
    "Peer feedback rounds", "Progress presentations", "Report drafting workshops",
    "Citation & academic honesty lessons", "Final presentation preparation",
  ],
  timingNotes: "PP lessons are often supervisor check-ins (20-30 min) interspersed with independent work time. The Workshop Model still applies but Work Time is student-directed project work. Mini-lessons focus on process skills (goal-setting, time management, citation) rather than content knowledge. Group lessons alternate with individual conferences.",
  detectionKeywords: [
    "personal project", "PP", "process journal", "self-directed",
    "extended project", "independent project", "passion project",
    "MYP personal project", "year 5 project", "capstone",
  ],
};

const INQUIRY_TYPE: UnitTypeDefinition = {
  type: "inquiry",
  label: "Inquiry Unit",
  description: "Students explore questions through guided investigation and sharing",
  cycleName: "Inquiry Cycle",
  phases: [
    { id: "wonder", label: "Wondering", description: "Generate questions, activate prior knowledge, build curiosity", color: "#6366F1" },
    { id: "explore", label: "Exploring", description: "Research, investigate, gather evidence, conduct experiments", color: "#3B82F6" },
    { id: "create", label: "Creating", description: "Synthesise findings, create something to show understanding", color: "#10B981" },
    { id: "share", label: "Sharing", description: "Present learning, give/receive feedback, reflect on growth", color: "#F59E0B" },
  ],
  extensionCategories: {
    wonder: ["generate provocative questions", "connect to personal experience", "explore multiple perspectives on the topic"],
    explore: ["primary source research", "expert interview", "design an experiment", "cross-cultural comparison"],
    create: ["create in a different medium", "make for a different audience", "combine findings with a peer"],
    share: ["teach a younger student", "create a public resource", "present to an authentic audience"],
  },
  aiPersona: "You are an expert inquiry-based learning facilitator. You design provocative learning experiences that spark curiosity and guide students through structured inquiry. You understand that great inquiry starts with genuine wonder and ends with students constructing their own understanding.",
  teachingPrinciples: `## Inquiry Learning Principles
1. PROVOCATION FIRST: Every unit starts with a provocation — an image, question, object, story, or experience that sparks genuine curiosity. The provocation should create cognitive conflict or surprise.

2. STUDENT QUESTIONS DRIVE LEARNING: The inquiry cycle is driven by student-generated questions. Teacher curates and guides but doesn't predetermine the answers.

3. MULTIPLE PERSPECTIVES: Good inquiry examines topics from multiple angles — cultural, historical, scientific, ethical. Help students see beyond their initial assumptions.

4. TRANSDISCIPLINARY CONNECTIONS: Inquiry naturally crosses subject boundaries. Make connections explicit — how does this topic connect to science, ethics, history, art?

5. EVIDENCE-BASED THINKING: Students must support claims with evidence. Teach the difference between opinion, observation, and evidence-based conclusion.

6. CONSTRUCTIVIST APPROACH: Students construct understanding through experience, not through being told. Design activities where students discover rather than receive.

7. VISIBLE THINKING: Use thinking routines (See-Think-Wonder, Claim-Support-Question, Compass Points, Circle of Viewpoints) to make student thinking visible and assessable.

8. EXHIBITION/SHARING: Inquiry culminates in sharing with an authentic audience. This gives purpose to the investigation and motivates quality.`,
  typicalActivities: [
    "Provocations", "See-Think-Wonder routines", "Question generation",
    "Research & investigation", "Expert interviews", "Field trips/virtual visits",
    "Experiments & data collection", "Thinking routines", "Concept mapping",
    "Creative synthesis", "Exhibition preparation", "Peer teaching",
    "Gallery walk", "Reflection journals", "Circle of Viewpoints",
  ],
  timingNotes: "Inquiry lessons tend to be more flexible than design lessons. The Workshop Model still applies, but Work Time may include more collaborative and discussion-based activities. Mini-lessons often introduce thinking routines rather than content. Provocations may take longer than a typical opening (up to 15 min for powerful provocations).",
  detectionKeywords: [
    "inquiry", "investigation", "explore", "wonder", "question",
    "exhibition", "PYP", "transdisciplinary", "provocation",
    "guided inquiry", "structured inquiry", "open inquiry",
    "PYPx", "primary years", "exhibition",
  ],
};

// =========================================================================
// FormatProfile — Pipeline-facing unit type metadata
// =========================================================================

export interface FormatProfile {
  type: UnitType;
  cycleName: string;
  phases: UnitTypePhase[];
  /** How to score/filter activity blocks for this format */
  blockRelevance: {
    phaseIds: string[];
    boost: string[];
    suppress: string[];
  };
  /** How to arrange lessons across the unit */
  sequenceHints: {
    phaseWeights: Record<string, number>;
    openingPhase: string;
    closingPhase: string;
    /** 5.4 — High-level rhythm hint, e.g. "investigate-heavy front, build-heavy middle, reflect at end". Optional. */
    defaultPattern?: string;
    /** 5.4 — Phases that MUST each appear in at least one lesson. Presence-only, no positional constraint. Optional. */
    requiredPhases?: string[];
    /** 5.4 — Phases that may appear across multiple non-adjacent lessons. Informational hint to the assembler. Optional. */
    repeatablePhases?: string[];
  };
  /** Timing adjustments for this format */
  timingModifiers: {
    setupBuffer: number;
    cleanupBuffer: number;
    safetyBriefMinutes: number;
    defaultWorkTimeFloor: number;
    reflectionMinimum: number;
  };
  /** Weights for Pulse quality scoring */
  pulseWeights: {
    cognitiveRigour: number;
    studentAgency: number;
    teacherCraft: number;
  };
  /** Teaching principles for AI prompt injection */
  teachingPrinciples: string;
  aiPersona: string;
  typicalActivities: string[];
  /** 5.6 — Stage 4 Polish wiring. Per spec format-profile-definitions.md §connectiveTissue. */
  connectiveTissue: {
    transitionVocabulary: string[];
    reflectionStyle: "end-only" | "continuous" | "milestone";
    audienceLanguage: string;
  };
  /** 5.5 — Nested gap-generation rules per spec format-profile-definitions.md §gapGenerationRules. Optional: when present, Stage 3 reads prefer nested values over the flat duplicates above. Flat fields retained for back-compat — cleanup phase may consolidate later. */
  gapGenerationRules?: {
    aiPersona: string;
    teachingPrinciples: string;
    typicalActivities: string[];
    /** 5.5 NEW — banned natural-language phrases. If AI gap-fill output contains any pattern (case-insensitive substring, whole serialized response), the validator substitutes fallback content for that gap. */
    forbiddenPatterns: string[];
  };
}

const FORMAT_PROFILES: Record<UnitType, FormatProfile> = {
  design: {
    type: "design",
    cycleName: "Design Cycle",
    phases: DESIGN_TYPE.phases,
    blockRelevance: {
      phaseIds: ["investigate", "develop", "create", "evaluate"],
      boost: ["making", "ideation", "critique", "skill-building"],
      suppress: ["journey"],
    },
    sequenceHints: {
      phaseWeights: { investigate: 0.25, develop: 0.25, create: 0.30, evaluate: 0.20 },
      openingPhase: "investigate",
      closingPhase: "evaluate",
      defaultPattern: "investigate -> develop -> create -> evaluate, with making blocks concentrated mid-unit",
      requiredPhases: ["investigate", "create", "evaluate"],
      repeatablePhases: ["develop", "create"],
    },
    timingModifiers: { setupBuffer: 7, cleanupBuffer: 6, safetyBriefMinutes: 4, defaultWorkTimeFloor: 0.45, reflectionMinimum: 5 },
    pulseWeights: { cognitiveRigour: 0.35, studentAgency: 0.30, teacherCraft: 0.35 },
    teachingPrinciples: DESIGN_TYPE.teachingPrinciples,
    aiPersona: DESIGN_TYPE.aiPersona,
    typicalActivities: DESIGN_TYPE.typicalActivities,
    gapGenerationRules: {
      aiPersona: DESIGN_TYPE.aiPersona,
      teachingPrinciples: DESIGN_TYPE.teachingPrinciples,
      typicalActivities: DESIGN_TYPE.typicalActivities,
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
        "With your concept locked in, it's time to prototype...",
        "Testing revealed some issues — back to the drawing board to refine...",
        "Your solution is ready — let's evaluate how well it meets the brief...",
        "Now we share what you've made with your target audience...",
      ],
      reflectionStyle: "end-only",
      audienceLanguage: "your client/target audience",
    },
  },
  service: {
    type: "service",
    cycleName: "IPARD Cycle",
    phases: SERVICE_TYPE.phases,
    blockRelevance: {
      phaseIds: ["investigate", "plan", "act", "reflect", "demonstrate"],
      boost: ["research", "collaboration", "reflection", "presentation"],
      suppress: ["making", "skill-building"],
    },
    // Service and Inquiry share an inquiry-style rhythm but differ on requiredPhases coverage and
    // repeatable cadence — distinctness gate in 5.4 tests asserts this.
    sequenceHints: {
      phaseWeights: { investigate: 0.20, plan: 0.20, act: 0.25, reflect: 0.20, demonstrate: 0.15 },
      openingPhase: "investigate",
      closingPhase: "demonstrate",
      defaultPattern: "investigate -> plan -> act -> reflect -> demonstrate, with reflection interleaved through act",
      requiredPhases: ["investigate", "plan", "act", "reflect", "demonstrate"],
      repeatablePhases: ["act", "reflect"],
    },
    timingModifiers: { setupBuffer: 3, cleanupBuffer: 2, safetyBriefMinutes: 0, defaultWorkTimeFloor: 0.30, reflectionMinimum: 10 },
    pulseWeights: { cognitiveRigour: 0.25, studentAgency: 0.45, teacherCraft: 0.30 },
    teachingPrinciples: SERVICE_TYPE.teachingPrinciples,
    aiPersona: SERVICE_TYPE.aiPersona,
    typicalActivities: SERVICE_TYPE.typicalActivities,
    gapGenerationRules: {
      aiPersona: SERVICE_TYPE.aiPersona,
      teachingPrinciples: SERVICE_TYPE.teachingPrinciples,
      typicalActivities: SERVICE_TYPE.typicalActivities,
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
        "Now that you've listened to your community, let's investigate what you heard...",
        "With the needs clear, let's plan how to act — with them, not for them...",
        "Time to take action alongside your community partner...",
        "Now reflect: what changed? what did you learn? what's next?...",
        "Let's share your story — highlighting the community's voice, not just yours...",
      ],
      reflectionStyle: "continuous",
      audienceLanguage: "your community partner(s)",
    },
  },
  personal_project: {
    type: "personal_project",
    cycleName: "PP Process",
    phases: PERSONAL_PROJECT_TYPE.phases,
    blockRelevance: {
      phaseIds: ["define", "plan", "apply", "reflect", "report"],
      boost: ["planning", "reflection", "documentation", "research"],
      suppress: ["warmup"],
    },
    sequenceHints: {
      phaseWeights: { define: 0.15, plan: 0.20, apply: 0.30, reflect: 0.20, report: 0.15 },
      openingPhase: "define",
      closingPhase: "report",
      defaultPattern: "define -> plan -> apply (extended) -> reflect -> report, with reflect checkpoints between apply chunks",
      requiredPhases: ["define", "plan", "apply", "reflect", "report"],
      repeatablePhases: ["apply", "reflect"],
    },
    timingModifiers: { setupBuffer: 3, cleanupBuffer: 2, safetyBriefMinutes: 0, defaultWorkTimeFloor: 0.60, reflectionMinimum: 15 },
    pulseWeights: { cognitiveRigour: 0.30, studentAgency: 0.40, teacherCraft: 0.30 },
    teachingPrinciples: PERSONAL_PROJECT_TYPE.teachingPrinciples,
    aiPersona: PERSONAL_PROJECT_TYPE.aiPersona,
    typicalActivities: PERSONAL_PROJECT_TYPE.typicalActivities,
    gapGenerationRules: {
      aiPersona: PERSONAL_PROJECT_TYPE.aiPersona,
      teachingPrinciples: PERSONAL_PROJECT_TYPE.teachingPrinciples,
      typicalActivities: PERSONAL_PROJECT_TYPE.typicalActivities,
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
        "You've defined your goal — now build the knowledge you'll need...",
        "With your research grounded, it's time to plan your action...",
        "Time to create — document everything in your process journal...",
        "Step back and evaluate: did you meet your goal? what would you do differently?...",
        "Now write your report and present to...",
      ],
      reflectionStyle: "milestone",
      audienceLanguage: "your supervisor",
    },
  },
  inquiry: {
    type: "inquiry",
    cycleName: "Inquiry Cycle",
    phases: INQUIRY_TYPE.phases,
    blockRelevance: {
      phaseIds: ["wonder", "investigate", "synthesize", "act"],
      boost: ["research", "analysis", "collaboration", "presentation"],
      suppress: ["making", "skill-building"],
    },
    sequenceHints: {
      phaseWeights: { wonder: 0.20, investigate: 0.30, synthesize: 0.25, act: 0.25 },
      openingPhase: "wonder",
      closingPhase: "act",
      defaultPattern: "wonder -> investigate (extended) -> synthesize -> act, with wonder revisited as new questions emerge",
      requiredPhases: ["wonder", "investigate", "synthesize", "act"],
      repeatablePhases: ["investigate", "synthesize"],
    },
    timingModifiers: { setupBuffer: 3, cleanupBuffer: 2, safetyBriefMinutes: 0, defaultWorkTimeFloor: 0.40, reflectionMinimum: 5 },
    pulseWeights: { cognitiveRigour: 0.40, studentAgency: 0.35, teacherCraft: 0.25 },
    teachingPrinciples: INQUIRY_TYPE.teachingPrinciples,
    aiPersona: INQUIRY_TYPE.aiPersona,
    typicalActivities: INQUIRY_TYPE.typicalActivities,
    gapGenerationRules: {
      aiPersona: INQUIRY_TYPE.aiPersona,
      teachingPrinciples: INQUIRY_TYPE.teachingPrinciples,
      typicalActivities: INQUIRY_TYPE.typicalActivities,
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
        "The provocation sparked questions — now let's choose which to pursue...",
        "With your questions framed, let's dig into sources and evidence...",
        "Time to build understanding — what patterns are emerging?...",
        "Now synthesize: what do you know? what do you still wonder?...",
        "Share your learning with...",
      ],
      reflectionStyle: "end-only",
      audienceLanguage: "your learning community",
    },
  },
};

/**
 * Get the FormatProfile for a unit type.
 * Falls back to design for unknown types.
 */
export function getFormatProfile(unitType: string): FormatProfile {
  return FORMAT_PROFILES[unitType as UnitType] ?? FORMAT_PROFILES.design;
}

// =========================================================================
// Registry & Helpers
// =========================================================================

export const UNIT_TYPES: Record<UnitType, UnitTypeDefinition> = {
  design: DESIGN_TYPE,
  service: SERVICE_TYPE,
  personal_project: PERSONAL_PROJECT_TYPE,
  inquiry: INQUIRY_TYPE,
};

/**
 * Detect the most likely unit type from free-text input.
 * Returns the type and a confidence score (0-1).
 */
export function detectUnitType(text: string): { type: UnitType; confidence: number } {
  const lower = text.toLowerCase();
  const scores: Record<UnitType, number> = { design: 0, service: 0, personal_project: 0, inquiry: 0 };

  for (const [type, def] of Object.entries(UNIT_TYPES) as [UnitType, UnitTypeDefinition][]) {
    for (const keyword of def.detectionKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        // Longer keywords are more specific, weight them higher
        scores[type] += keyword.length > 10 ? 2 : 1;
      }
    }
  }

  // Find the highest scoring type
  let bestType: UnitType = "design"; // default fallback
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores) as [UnitType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Confidence: normalize against total possible matches
  const maxPossible = Math.max(1, ...Object.values(scores));
  const confidence = bestScore === 0 ? 0.3 : Math.min(1, bestScore / (maxPossible + 2));

  return { type: bestType, confidence };
}

/**
 * Build a unit-type-aware system prompt for lesson generation.
 * Replaces the hardcoded JOURNEY_SYSTEM_PROMPT for the test sandbox.
 *
 * This is the key function — it assembles the system prompt from:
 * 1. AI persona (varies by unit type)
 * 2. Teaching principles (varies by unit type)
 * 3. Lesson structure rules (universal Workshop Model)
 * 4. Phase-specific extension rules (varies by unit type)
 * 5. JSON schema (universal)
 * 6. Evidence-based strategies (universal)
 */
export function buildUnitTypeSystemPrompt(unitType: UnitType): string {
  const def = UNIT_TYPES[unitType];

  const phaseList = def.phases
    .map((p) => `- **${p.label}**: ${p.description}`)
    .join("\n");

  const extensionRules = Object.entries(def.extensionCategories)
    .map(([phase, examples]) => `- ${phase}: ${examples.join(", ")}`)
    .join("\n");

  return `${def.aiPersona} You create engaging, differentiated unit content structured as a continuous learning journey.

## ${def.cycleName} — Phases
${phaseList}

## Core Principle: Backward Design
You are given an END GOAL — the final product, outcome, or demonstration students must achieve. Your job is to work BACKWARDS from that goal to design a coherent sequence of lessons that gets students there. Every lesson exists because it contributes to reaching the end goal.

## Unit Structure
The unit is a sequence of LESSON BLOCKS. Each lesson is a fixed length (specified in the prompt). Lessons flow continuously — there are no structural breaks between "criteria" or "phases". Instead, each lesson naturally builds on the previous one, following the ${def.cycleName} arc.

## Assessment Criteria as Tags
The prompt specifies which assessment criteria exist. You MUST tag every activity section with the criteria it addresses using "criterionTags": ["A"] or ["B", "C"]. Criteria are metadata — they tell the teacher which assessment strand an activity contributes to. They do NOT control lesson structure.

A single lesson might touch multiple criteria. The ${def.cycleName} phases guide lesson flow, while criteria are tagged to individual activities within lessons.

${def.teachingPrinciples}

## Lesson Flow Grammar

### Bloom's Progression
Early lessons start at Remember/Understand (research, vocabulary, analysis).
Middle lessons progress to Apply/Analyse (planning, skill-building, action).
Later lessons reach Evaluate/Create (creating, testing, reflecting, demonstrating).

### Scaffolding Fade
Lesson 1-2: Heavy scaffolding (sentence starters, worked examples, structured templates).
Middle lessons: Moderate scaffolding (some sentence starters, reference to earlier work).
Final lessons: Minimal scaffolding (extension prompts only, students work independently).

### Energy & Pacing
Each lesson has an energy arc: calm focus (warm-up) → active engagement (core tasks) → reflection.
Across the unit: build from curious exploration → productive engagement → sustained action → celebratory completion.

### Continuity
Each lesson's introduction should reference what was achieved in the previous lesson.
Each lesson should end by previewing what comes next.
The final lesson should circle back to the original goal.

## Timing — Workshop Model (MANDATORY)
Each lesson follows the 4-Phase Workshop Model. The prompt below provides usable time and age-appropriate constraints — follow them precisely.

IMPORTANT: Include "durationMinutes" on EVERY section AND on each workshop phase. All section durations within a lesson should sum to the USABLE time (not the raw period length).

The lesson structure MUST be: Opening → Mini-Lesson → Work Time → Debrief.
Work Time is ONE sustained block (minimum 45% of usable time). Do NOT split it into small activities.

${def.timingNotes}

## Extensions (REQUIRED)
For EVERY lesson, generate 2-3 extension activities for students who finish early.
Extensions must match the current ${def.cycleName} phase:
${extensionRules}
Extensions are NOT extra work. They are productive deepening of the same challenge.
Format: Include an "extensions" array on each lesson with 2-3 items: { "title": "...", "description": "...", "durationMinutes": N, "phase": "<phase_id>" }

## JSON Schema (for each lesson page)
{
  "[LessonId]": {
    "title": "Short descriptive lesson title",
    "learningGoal": "Clear learning objective for this lesson",
    "workshopPhases": {
      "opening": { "durationMinutes": 5, "hook": "Brief description of the opening hook/question" },
      "miniLesson": { "durationMinutes": 12, "focus": "The ONE skill or concept being taught" },
      "workTime": { "durationMinutes": 38, "focus": "What students are doing during sustained work", "checkpoints": ["Check-in prompt at midpoint"] },
      "debrief": { "durationMinutes": 5, "protocol": "i-like-i-wish|two-stars-a-wish|exit-ticket|gallery-walk|quick-share", "prompt": "Structured debrief prompt" }
    },
    "vocabWarmup": {
      "terms": [
        { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
      ],
      "activity": {
        "type": "matching|fill-blank|drag-sort",
        "items": [{ "question": "Match prompt", "answer": "Correct answer" }]
      }
    },
    "introduction": {
      "text": "Introduction connecting to prior learning and previewing this lesson"
    },
    "sections": [
      {
        "prompt": "Clear, engaging task for the student",
        "criterionTags": ["A"],
        "durationMinutes": 15,
        "scaffolding": {
          "ell1": { "sentenceStarters": [...], "hints": [...] },
          "ell2": { "sentenceStarters": [...] },
          "ell3": { "extensionPrompts": [...] }
        },
        "responseType": "text|upload|voice|link|multi|decision-matrix|pmi|pairwise|trade-off-sliders",
        "exampleResponse": "Model response showing quality expectations",
        "portfolioCapture": true
      }
    ],
    "reflection": {
      "type": "confidence-slider|checklist|short-response",
      "items": ["I understand the task", "I can explain my reasoning"]
    },
    "extensions": [
      {
        "title": "Short descriptive title",
        "description": "What the student does and why it deepens their work",
        "durationMinutes": 20,
        "phase": "<phase_id>"
      }
    ]
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. ALWAYS include criterionTags on EVERY section — at least one criterion per section
3. ALWAYS include durationMinutes on EVERY section — realistic time estimate in minutes
4. ALWAYS include workshopPhases with realistic durations that match the timing constraints
5. ALWAYS include 2-3 extensions per lesson matching the current ${def.cycleName} phase
6. Include 3-5 vocab terms per lesson, relevant to the lesson's focus
7. Include 1-3 activity sections per lesson that fit within the Work Time phase (do not fragment into many small tasks)
8. Vary responseType across sections: "text", "upload", "link", "multi", and for decision tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
9. Make content age-appropriate for the specified grade level
10. Connect content to the specified global context and key concept
11. Include practical, hands-on activities where relevant
12. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
13. Reflection items MUST include at least one emotion-aware prompt (e.g., "How did this activity make you feel?"). Use growth-framing, NEVER ability-framing.
14. When appropriate, incorporate relevant frameworks and thinking routines — adapt them to the specific topic
15. Set "portfolioCapture": true on 1-2 sections per lesson that represent substantive work
16. Each lesson should be SELF-CONTAINED enough to work as a single class period, but CONNECTED enough that the unit tells a coherent story
17. The first lesson should hook students with the end goal and build excitement
18. The final lesson should include completion, presentation, or celebration

## Evidence-Based Teaching Strategies (MUST follow)
Based on Hattie's Visible Learning research:

### Productive Failure (d=0.82)
- Include at least one activity where students can safely fail and learn from it
- Follow failure with structured reflection: "What went wrong? What did you learn?"

### Critique Culture (d=0.73)
- Embed at least one peer feedback or self-assessment section per 3 lessons
- Use structured protocols: Two Stars & a Wish, Gallery Walk, TAG feedback

### Spaced Retrieval (d=0.71)
- Vocab warm-ups should spiral back to terms from EARLIER lessons
- Include retrieval starters: quick-sketch, term matching, "recall 3 things from Lesson 2"

### Self-Assessment Prediction (d=1.44)
- At phase boundaries, include self-prediction reflection
- The final lesson should include comprehensive self-assessment

### Compare/Contrast Frameworks (d=1.61)
- For research sections, use structured comparison templates
- Use responseType "decision-matrix" or "pmi" for comparison activities`;
}

/**
 * Build the timing block's extension section to match unit type phases.
 * This replaces the hardcoded "Investigation phase → Ideation phase → ..." in buildTimingBlock.
 */
export function buildExtensionRulesForType(unitType: UnitType): string {
  const def = UNIT_TYPES[unitType];
  return Object.entries(def.extensionCategories)
    .map(([phase, examples]) => `- ${def.phases.find(p => p.id === phase)?.label || phase} phase: ${examples.slice(0, 3).join(", ")}`)
    .join("\n");
}

/**
 * Get phase labels for a unit type (used in UI and prompt building).
 */
export function getPhaseLabels(unitType: UnitType): string[] {
  return UNIT_TYPES[unitType].phases.map(p => p.label);
}

/**
 * Get phase IDs for a unit type (used in extension matching).
 */
export function getPhaseIds(unitType: UnitType): string[] {
  return UNIT_TYPES[unitType].phases.map(p => p.id);
}
