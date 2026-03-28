/**
 * Shared types and category constants for the Report Writer bulk workflow.
 */

export const REPORTING_PERIODS = [
  "Term 1",
  "Term 2",
  "Term 3",
  "Term 4",
  "Semester 1",
  "Semester 2",
  "Full Year",
] as const;
export type ReportingPeriod = (typeof REPORTING_PERIODS)[number];

export type FrameworkId = "general" | "IB_MYP" | "GCSE_DT" | "ACARA_DT" | "A_LEVEL_DT" | "IGCSE_DT" | "PLTW" | "NESA_DT" | "VIC_DT";

export const FRAMEWORKS: { id: FrameworkId; label: string }[] = [
  { id: "general", label: "General Design & Technology" },
  { id: "IB_MYP", label: "IB MYP Design" },
  { id: "GCSE_DT", label: "GCSE Design & Technology" },
  { id: "A_LEVEL_DT", label: "A-Level Design & Technology" },
  { id: "IGCSE_DT", label: "Cambridge IGCSE D&T" },
  { id: "ACARA_DT", label: "Australian D&T (ACARA)" },
  { id: "NESA_DT", label: "NSW Design & Technology (NESA)" },
  { id: "VIC_DT", label: "Victorian Curriculum D&T" },
  { id: "PLTW", label: "Project Lead The Way (US)" },
];

export const RATING_CATEGORIES: Record<FrameworkId, Record<string, string[]>> = {
  general: {
    "Design Process": [
      "Research skills",
      "Ideation & brainstorming",
      "Prototyping",
      "Testing & iteration",
      "Evaluation & reflection",
    ],
    "Technical Skills": [
      "CAD / 3D modelling",
      "Hand sketching",
      "Technical drawing",
      "Material selection",
      "Manufacturing skills",
    ],
    Collaboration: [
      "Teamwork",
      "Presentation skills",
      "Written communication",
      "Peer feedback",
    ],
    Thinking: [
      "Creative thinking",
      "Problem solving",
      "Critical analysis",
      "Independent learning",
    ],
  },
  IB_MYP: {
    "A — Inquiring & Analysing": [
      "Research skills",
      "Problem identification",
      "Design brief development",
      "Source evaluation",
    ],
    "B — Developing Ideas": [
      "Ideation & brainstorming",
      "Design specifications",
      "Feasibility analysis",
      "Design development",
    ],
    "C — Creating the Solution": [
      "Technical skills",
      "Following the plan",
      "Quality of final product",
      "Justified changes",
    ],
    "D — Evaluating": [
      "Testing methods",
      "Evaluation against specifications",
      "Impact of solution",
      "Reflection & improvement",
    ],
  },
  GCSE_DT: {
    "Investigate & Analyse": [
      "Context research",
      "Client/user needs",
      "Product analysis",
      "Specification writing",
    ],
    "Design & Develop": [
      "Ideation range",
      "Development of ideas",
      "CAD / digital design",
      "Modelling & prototyping",
    ],
    "Make & Manufacture": [
      "Material selection",
      "Manufacturing accuracy",
      "Tool & equipment use",
      "Quality control",
    ],
    "Evaluate & Test": [
      "Testing against specification",
      "Evaluation depth",
      "Suggested improvements",
    ],
    "Technical Knowledge": [
      "Materials & components",
      "Manufacturing processes",
      "Systems & mechanisms",
    ],
  },
  ACARA_DT: {
    "Knowledge & Understanding": [
      "Materials & technologies",
      "Design principles",
      "Sustainability awareness",
      "Safety & management",
    ],
    "Processes & Production Skills": [
      "Investigating & defining",
      "Designing solutions",
      "Producing & implementing",
      "Evaluating",
      "Collaborating & managing",
    ],
  },
  A_LEVEL_DT: {
    "Technical Principles": [
      "Materials & their applications",
      "Performance characteristics",
      "Manufacturing processes & techniques",
      "Digital design & manufacture",
    ],
    "Designing & Making Principles": [
      "Design communication",
      "Design theory & practice",
      "Health & safety",
      "Responsible design",
    ],
    "Design & Make Project (NEA)": [
      "Identifying & investigating",
      "Designing & developing",
      "Making & manufacturing",
      "Testing & evaluating",
    ],
  },
  IGCSE_DT: {
    "Knowledge & Understanding": [
      "Materials & components",
      "Tools & equipment",
      "Manufacturing processes",
      "Health & safety",
    ],
    Application: [
      "Applying design skills",
      "Selecting materials & processes",
      "Using tools & equipment",
      "Problem solving",
    ],
    "Analysis & Evaluation": [
      "Product analysis",
      "Testing & evaluation",
      "Design improvement",
      "Specification reference",
    ],
  },
  PLTW: {
    "Design Process": [
      "Problem definition",
      "Concept generation",
      "Solution development",
      "Engineering notebook",
    ],
    "Build & Prototype": [
      "Construction skills",
      "Fabrication accuracy",
      "Iteration & refinement",
      "Materials & tools",
    ],
    "Test & Evaluate": [
      "Testing methods",
      "Data analysis",
      "Results interpretation",
      "Design iteration",
    ],
    "Present & Defend": [
      "Oral presentation",
      "Technical documentation",
      "Visual communication",
      "Defence of decisions",
    ],
  },
  NESA_DT: {
    "Design Process": [
      "Investigating needs & opportunities",
      "Generating & developing ideas",
      "Communicating design ideas",
      "Justifying design decisions",
    ],
    Producing: [
      "Selecting tools & materials",
      "Managing production",
      "Technical skills & accuracy",
      "Safety practices",
    ],
    Evaluating: [
      "Testing against criteria",
      "Analysing design solutions",
      "Reflecting on processes",
      "Suggesting improvements",
    ],
  },
  VIC_DT: {
    "Technologies & Society": [
      "Impacts of technology",
      "Ethical considerations",
      "Sustainability awareness",
      "Past & future technologies",
    ],
    "Technological Contexts": [
      "Materials & characteristics",
      "Systems thinking",
      "Food & fibre",
      "Engineering principles",
    ],
    "Creating Design Solutions": [
      "Investigating & generating",
      "Producing solutions",
      "Evaluating outcomes",
      "Collaborating & managing",
    ],
  },
};

export interface StudentRow {
  id: string;
  firstName: string;
  pronouns: "he" | "she" | "they";
  ratings: Record<string, number>; // category name → 1-5
  notes: string;
}

export interface BulkRequestBody {
  email: string;
  subject: string;
  gradeLevel: string;
  reportingPeriod?: ReportingPeriod;
  projects?: string[];
  tone: "formal" | "friendly";
  wordCount: 50 | 100 | 150;
  categories: string[]; // active category names
  students: {
    firstName: string;
    pronouns: "he" | "she" | "they";
    ratings: Record<string, number>;
    notes: string;
  }[];
}

export interface BulkReportResult {
  firstName: string;
  report?: string;
  error?: string;
}

export interface BulkResponse {
  reports: BulkReportResult[];
  remaining: number;
  generated: number;
  failed: number;
}
