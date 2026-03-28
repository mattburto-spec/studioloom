/**
 * Framework-Aware Vocabulary (Layer 1 Enhancement)
 *
 * Maps curriculum frameworks to their specific terminology so the AI
 * uses the right language for each teacher's context.
 *
 * Without this, a GCSE teacher gets MYP-flavoured output ("criteria A-D",
 * "statement of inquiry") which feels foreign and reduces trust.
 */

export interface FrameworkVocabulary {
  /** Display name of the framework */
  name: string;
  /** What they call assessment criteria/objectives */
  criteriaTermPlural: string;
  criteriaTermSingular: string;
  /** How criteria are labeled (e.g., "A", "B", "C", "D" or "AO1", "AO2") */
  criteriaLabels: string[];
  /** Names for each criterion/objective */
  criteriaNames: Record<string, string>;
  /** What they call the design cycle/process */
  designCycleName: string;
  /** Phases of their design cycle */
  designCyclePhases: string[];
  /** Assessment language */
  assessmentScale: string;
  /** Command terms/action verbs they prefer */
  preferredVerbs: string[];
  /** Any additional terminology notes */
  notes?: string;
}

const FRAMEWORK_VOCABULARY: Record<string, FrameworkVocabulary> = {
  IB_MYP: {
    name: "IB MYP Design",
    criteriaTermPlural: "criteria",
    criteriaTermSingular: "criterion",
    criteriaLabels: ["A", "B", "C", "D"],
    criteriaNames: {
      A: "Inquiring and Analysing",
      B: "Developing Ideas",
      C: "Creating the Solution",
      D: "Evaluating",
    },
    designCycleName: "MYP Design Cycle",
    designCyclePhases: ["Inquiring and Analysing", "Developing Ideas", "Creating the Solution", "Evaluating"],
    assessmentScale: "Achievement levels 1-8 against criterion-specific strand descriptors",
    preferredVerbs: ["explain", "describe", "evaluate", "justify", "analyse", "create", "design", "develop"],
    notes: "Uses Statement of Inquiry, Key Concepts, Related Concepts, Global Contexts, ATL Skills. Criteria strands (i, ii, iii, iv) within each criterion.",
  },

  GCSE_DT: {
    name: "AQA/OCR GCSE Design & Technology",
    criteriaTermPlural: "assessment objectives",
    criteriaTermSingular: "assessment objective",
    criteriaLabels: ["AO1", "AO2", "AO3", "AO4"],
    criteriaNames: {
      AO1: "Identify, investigate and outline design possibilities (10%, NEA only)",
      AO2: "Design and make prototypes that are fit for purpose (30%, NEA only)",
      AO3: "Analyse and evaluate design decisions and outcomes (20%, split exam/NEA)",
      AO4: "Demonstrate and apply knowledge and understanding of technical principles (40%, exam only)",
    },
    designCycleName: "Iterative Design Process",
    designCyclePhases: ["Investigate", "Design", "Make", "Evaluate"],
    assessmentScale: "Marks/percentages (NEA 50%, Exam 50%)",
    preferredVerbs: ["investigate", "analyse", "evaluate", "design", "make", "test", "refine", "justify"],
    notes: "Non-Examined Assessment (NEA) is the coursework portfolio. Core technical principles tested in written exam. Focus on new and emerging technologies, sustainability, materials properties.",
  },

  ACARA_DT: {
    name: "Australian Curriculum: Design & Technologies",
    criteriaTermPlural: "strands",
    criteriaTermSingular: "strand",
    criteriaLabels: ["KU", "PPS"],
    criteriaNames: {
      KU: "Knowledge and Understanding (technologies and society, materials, systems)",
      PPS: "Processes and Production Skills (investigating, generating, producing, evaluating)",
    },
    designCycleName: "Design Process",
    designCyclePhases: ["Investigating", "Generating", "Producing", "Evaluating"],
    assessmentScale: "A-E grade bands with achievement standards",
    preferredVerbs: ["investigate", "generate", "produce", "evaluate", "collaborate", "manage"],
    notes: "NSW syllabi use year-specific outcomes. Victorian curriculum uses content descriptions and achievement standards. Band levels correspond to year groups.",
  },

  PLTW: {
    name: "Project Lead The Way (US)",
    criteriaTermPlural: "rubric dimensions",
    criteriaTermSingular: "rubric dimension",
    criteriaLabels: ["Design", "Build", "Test", "Present"],
    criteriaNames: {
      Design: "Design Process (defining problems, generating concepts, developing solutions)",
      Build: "Build & Prototype (constructing, fabricating, and iterating physical solutions)",
      Test: "Test & Evaluate (testing against requirements, analysing results, iterating)",
      Present: "Present & Defend (engineering notebook documentation, oral defence, communication)",
    },
    designCycleName: "Design and Modeling Process",
    designCyclePhases: ["Define the Problem", "Generate Concepts", "Develop a Solution", "Construct and Test", "Evaluate and Present"],
    assessmentScale: "Rubric-based with proficiency levels (Below Basic, Basic, Proficient, Advanced)",
    preferredVerbs: ["define", "brainstorm", "model", "prototype", "test", "iterate", "present", "document"],
    notes: "Strong emphasis on engineering notebooks, 3D modeling (Autodesk Inventor), and STEM integration. Uses Activity-Project-Problem (APP) pedagogy.",
  },

  A_LEVEL_DT: {
    name: "A-Level Design & Technology",
    criteriaTermPlural: "components",
    criteriaTermSingular: "component",
    criteriaLabels: ["C1", "C2", "C3"],
    criteriaNames: {
      C1: "Technical Principles (written exam)",
      C2: "Designing and Making Principles (written exam)",
      C3: "Design and Make Task (NEA coursework)",
    },
    designCycleName: "Design, Make, Evaluate",
    designCyclePhases: ["Identify and Investigate", "Design Development", "Design Communication", "Make", "Testing and Evaluation"],
    assessmentScale: "UMS marks / raw marks converted to A*-E grades",
    preferredVerbs: ["investigate", "analyse", "design", "develop", "communicate", "manufacture", "test", "evaluate"],
    notes: "Iterative design process documented in design folder/portfolio. Focus on user-centred design, mathematical modelling, materials testing.",
  },

  NESA_DT: {
    name: "NSW Design & Technology (NESA)",
    criteriaTermPlural: "outcomes",
    criteriaTermSingular: "outcome",
    criteriaLabels: ["DP", "Pr", "Ev"],
    criteriaNames: {
      DP: "Design Process (investigating, generating, communicating design ideas)",
      Pr: "Producing (selecting tools/materials, managing production, technical skills)",
      Ev: "Evaluating (testing, analysing, reflecting on design solutions)",
    },
    designCycleName: "Design Process",
    designCyclePhases: ["Investigating", "Designing", "Producing", "Evaluating"],
    assessmentScale: "A-E grade bands based on outcome achievement",
    preferredVerbs: ["investigate", "generate", "communicate", "produce", "evaluate", "manage", "justify", "analyse"],
    notes: "NSW NESA syllabus (2019, current until 2028). Outcome-based assessment. Practical experiences must occupy majority of course time. New Design Innovation Technology syllabus (2025) replaces this from 2028.",
  },

  VIC_DT: {
    name: "Victorian Curriculum: Design & Technologies",
    criteriaTermPlural: "strands",
    criteriaTermSingular: "strand",
    criteriaLabels: ["TS", "TC", "CDS"],
    criteriaNames: {
      TS: "Technologies & Society (how people use and develop technologies, impacts and ethics)",
      TC: "Technological Contexts (characteristics and properties of technologies, materials, systems)",
      CDS: "Creating Design Solutions (investigating, generating, producing, evaluating designed solutions)",
    },
    designCycleName: "Design Process",
    designCyclePhases: ["Investigating", "Generating", "Producing", "Evaluating", "Collaborating and Managing"],
    assessmentScale: "A-E achievement levels against content descriptions",
    preferredVerbs: ["investigate", "generate", "produce", "evaluate", "collaborate", "manage", "critique"],
    notes: "Victorian Curriculum F-10. Content descriptions mapped to band levels (7-8, 9-10). Strong emphasis on sustainability and ethical considerations in design.",
  },

  IGCSE_DT: {
    name: "Cambridge IGCSE Design & Technology",
    criteriaTermPlural: "assessment objectives",
    criteriaTermSingular: "assessment objective",
    criteriaLabels: ["AO1", "AO2", "AO3"],
    criteriaNames: {
      AO1: "Recall and understanding",
      AO2: "Handling information and problem solving",
      AO3: "Design and making skills",
    },
    designCycleName: "Design Process",
    designCyclePhases: ["Analyse", "Research", "Develop", "Plan", "Make", "Test and Evaluate"],
    assessmentScale: "Grades A*-G (9-1 in new spec), component marks",
    preferredVerbs: ["analyse", "research", "develop", "plan", "make", "test", "evaluate", "describe"],
    notes: "Design coursework portfolio weighted heavily. Strong emphasis on material properties, manufacturing processes, and technical drawing.",
  },
};

/**
 * Get the vocabulary mapping for a given curriculum framework.
 * Returns IB_MYP as default if framework is unknown.
 */
export function getFrameworkVocabulary(framework?: string): FrameworkVocabulary {
  if (!framework) return FRAMEWORK_VOCABULARY.IB_MYP;
  return FRAMEWORK_VOCABULARY[framework] || FRAMEWORK_VOCABULARY.IB_MYP;
}

/**
 * Build a prompt block that teaches the AI the correct terminology
 * for the teacher's curriculum framework.
 *
 * Injected into generation prompts before the main content.
 */
export function buildFrameworkPromptBlock(framework?: string): string {
  if (!framework || framework === "IB_MYP") {
    // MYP is the default — system prompts already use MYP terminology
    return "";
  }

  const vocab = getFrameworkVocabulary(framework);
  if (!vocab) return "";

  const criteriaMapping = Object.entries(vocab.criteriaNames)
    .map(([key, name]) => `  - ${key}: ${name}`)
    .join("\n");

  return `
## Curriculum Framework: ${vocab.name}
IMPORTANT: This teacher uses ${vocab.name}, NOT IB MYP. Adjust all terminology:
- Use "${vocab.criteriaTermPlural}" instead of "criteria" (e.g., "${vocab.criteriaLabels[0]}" not "A")
- Call the design process the "${vocab.designCycleName}", with phases: ${vocab.designCyclePhases.join(" → ")}
- Assessment uses: ${vocab.assessmentScale}
- Preferred action verbs: ${vocab.preferredVerbs.join(", ")}

### ${vocab.criteriaTermPlural.charAt(0).toUpperCase() + vocab.criteriaTermPlural.slice(1)}
${criteriaMapping}

${vocab.notes ? `### Notes\n${vocab.notes}` : ""}

Do NOT use MYP-specific terms like "Statement of Inquiry", "Global Context", "ATL Skills", "criterion A-D", or "achievement levels 1-8" unless this IS an MYP unit.
`;
}

/**
 * Get all supported framework keys.
 */
export function getSupportedFrameworks(): string[] {
  return Object.keys(FRAMEWORK_VOCABULARY);
}
