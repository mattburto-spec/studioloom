export const CRITERIA = {
  A: {
    key: "A",
    name: "Inquiring & Analysing",
    color: "#2E86AB",
    bgClass: "bg-accent-blue",
    textClass: "text-accent-blue",
  },
  B: {
    key: "B",
    name: "Developing Ideas",
    color: "#2DA05E",
    bgClass: "bg-accent-green",
    textClass: "text-accent-green",
  },
  C: {
    key: "C",
    name: "Creating the Solution",
    color: "#E86F2C",
    bgClass: "bg-accent-orange",
    textClass: "text-accent-orange",
  },
  D: {
    key: "D",
    name: "Evaluating",
    color: "#8B2FC9",
    bgClass: "bg-accent-purple",
    textClass: "text-accent-purple",
  },
} as const;

export type CriterionKey = keyof typeof CRITERIA;

export const PAGES = [
  { id: "A1", number: 1, criterion: "A" as CriterionKey, title: "Explain and justify the need for a solution" },
  { id: "A2", number: 2, criterion: "A" as CriterionKey, title: "Construct a detailed research plan" },
  { id: "A3", number: 3, criterion: "A" as CriterionKey, title: "Analyse existing products/solutions" },
  { id: "A4", number: 4, criterion: "A" as CriterionKey, title: "Develop a detailed design brief" },
  { id: "B1", number: 5, criterion: "B" as CriterionKey, title: "Develop a design specification" },
  { id: "B2", number: 6, criterion: "B" as CriterionKey, title: "Develop a range of feasible design ideas" },
  { id: "B3", number: 7, criterion: "B" as CriterionKey, title: "Present the chosen design with justification" },
  { id: "B4", number: 8, criterion: "B" as CriterionKey, title: "Develop accurate and detailed planning drawings/diagrams" },
  { id: "C1", number: 9, criterion: "C" as CriterionKey, title: "Construct a logical plan with resources and time" },
  { id: "C2", number: 10, criterion: "C" as CriterionKey, title: "Demonstrate excellent technical skills" },
  { id: "C3", number: 11, criterion: "C" as CriterionKey, title: "Follow the plan to create the solution" },
  { id: "C4", number: 12, criterion: "C" as CriterionKey, title: "Explain changes made to the chosen design and plan" },
  { id: "D1", number: 13, criterion: "D" as CriterionKey, title: "Design detailed and relevant testing methods" },
  { id: "D2", number: 14, criterion: "D" as CriterionKey, title: "Evaluate the success of the solution against the design specification" },
  { id: "D3", number: 15, criterion: "D" as CriterionKey, title: "Explain how the solution could be improved" },
  { id: "D4", number: 16, criterion: "D" as CriterionKey, title: "Explain the impact of the solution on the client/community" },
] as const;

export type PageId = (typeof PAGES)[number]["id"];

export const ELL_LEVELS = {
  1: { label: "Beginner ELL", description: "Full scaffolding, sentence starters, vocab warm-ups, read-aloud" },
  2: { label: "Intermediate ELL", description: "Some scaffolding, key vocab highlighted, shorter warm-ups" },
  3: { label: "Advanced / Native", description: "No scaffolding, extension prompts, higher expectations" },
} as const;

export type EllLevel = 1 | 2 | 3;

export const SESSION_COOKIE_NAME = "questerra_student_session";
export const SESSION_DURATION_DAYS = 7;
