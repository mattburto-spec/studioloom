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

export type FrameworkId = "general" | "IB_MYP" | "GCSE_DT" | "ACARA_DT";

export const FRAMEWORKS: { id: FrameworkId; label: string }[] = [
  { id: "general", label: "General Design & Technology" },
  { id: "IB_MYP", label: "IB MYP Design" },
  { id: "GCSE_DT", label: "GCSE Design & Technology" },
  { id: "ACARA_DT", label: "Australian D&T" },
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
    "Processes & Production": [
      "Investigating & defining",
      "Designing solutions",
      "Producing & implementing",
      "Evaluating",
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
