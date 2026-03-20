/**
 * System prompt builder for the Report Writer free tool.
 *
 * Generates personalised end-of-semester report comments.
 */

interface ReportPromptInput {
  studentName: string;
  pronouns: "he" | "she" | "they";
  subject: string;
  gradeLevel: string;
  reportingPeriod?: string;
  projects?: string[];
  projectPerformance?: string;
  strengths: string;
  areasForGrowth: string;
  additionalNotes?: string;
  tone: "formal" | "friendly";
  wordCount: 50 | 100 | 150;
}

const PRONOUN_GUIDE: Record<string, string> = {
  he: "Use he/him/his pronouns when referring to the student.",
  she: "Use she/her/her pronouns when referring to the student.",
  they: "Use they/them/their pronouns (singular) when referring to the student.",
};

const PERIOD_PHRASING: Record<string, string> = {
  "Term 1": "Throughout Term 1",
  "Term 2": "Throughout Term 2",
  "Term 3": "Throughout Term 3",
  "Term 4": "Throughout Term 4",
  "Semester 1": "This semester",
  "Semester 2": "This semester",
  "Full Year": "Over the course of this year",
};

export function buildReportWriterPrompt(input: ReportPromptInput): string {
  const toneGuide =
    input.tone === "formal"
      ? "Use a professional, formal tone suitable for an official school report. Avoid contractions and colloquialisms."
      : "Use a warm, approachable tone that feels personal while remaining professional. Contractions are fine.";

  const notesClause = input.additionalNotes
    ? `\n## Additional Notes\n${input.additionalNotes}`
    : "";

  const periodRule = input.reportingPeriod
    ? `\n9. Use temporal framing: begin or weave in "${PERIOD_PHRASING[input.reportingPeriod] ?? input.reportingPeriod}" naturally.`
    : "";

  const projectRule =
    input.projects && input.projects.length > 0
      ? `\n${input.reportingPeriod ? "10" : "9"}. Weave project-specific performance into the narrative — mention specific project names where the student excelled or struggled.`
      : "";

  const projectsLine =
    input.projects && input.projects.length > 0
      ? `\n- **Projects/Units:** ${input.projects.join(", ")}`
      : "";

  const projectSection = input.projectPerformance
    ? `\n## Project Performance\n${input.projectPerformance}\n`
    : "";

  return `You are an experienced teacher writing a report comment for a student.

## Requirements
1. Write approximately ${input.wordCount} words (do not exceed ${input.wordCount + 20} words)
2. Write in third person about the student, addressed to parents/guardians (e.g., "${input.studentName} has demonstrated...")
3. ${PRONOUN_GUIDE[input.pronouns]}
4. ${toneGuide}
5. Reference SPECIFIC strengths and growth areas provided — do not be generic
6. End with a forward-looking statement about next steps or expectations
7. Do not use placeholder language like "[specific example]" — work only with what is provided
8. Do not fabricate achievements or details not mentioned in the input${periodRule}${projectRule}

## Student Details
- **Name:** ${input.studentName}
- **Subject:** ${input.subject}
- **Grade/Year Level:** ${input.gradeLevel}${projectsLine}
${projectSection}
## Key Strengths
${input.strengths}

## Areas for Growth
${input.areasForGrowth}
${notesClause}

Respond with ONLY a JSON object in this exact format:
{
  "report": "..."
}

Do not include any text outside the JSON object.`;
}

/**
 * Convert 1-5 project ratings into a natural-language summary
 * of per-project performance for the report prompt.
 */
export function projectRatingsToPerformance(
  ratings: Record<string, number>,
  projects: string[]
): string {
  if (projects.length === 0) return "";
  const lines: string[] = [];
  for (const proj of projects) {
    const r = ratings[proj];
    if (r == null) continue;
    if (r === 5) lines.push(`Performed excellently on "${proj}"`);
    else if (r === 4) lines.push(`Performed strongly on "${proj}"`);
    else if (r === 3) lines.push(`Showed steady progress on "${proj}"`);
    else if (r === 2) lines.push(`Needs improvement on "${proj}"`);
    else lines.push(`Struggled with "${proj}" and needs further support`);
  }
  return lines.join(". ") + (lines.length > 0 ? "." : "");
}

/**
 * Convert 1-5 ratings into natural-language strengths and growth areas
 * for feeding into the report prompt.
 *
 * Rating >= 4 → strength, <= 2 → growth area, 3 = developing (omitted
 * unless everything is 3, in which case we note "developing across areas").
 */
export function ratingsToStrengthsAndGrowth(
  ratings: Record<string, number>,
  activeCategories: string[]
): { strengths: string; areasForGrowth: string } {
  const strengths: string[] = [];
  const growth: string[] = [];

  for (const cat of activeCategories) {
    const rating = ratings[cat];
    if (rating == null) continue;
    if (rating >= 4) {
      strengths.push(rating === 5 ? `Excellent ${cat.toLowerCase()}` : `Strong ${cat.toLowerCase()}`);
    } else if (rating <= 2) {
      growth.push(rating === 1 ? `Significant improvement needed in ${cat.toLowerCase()}` : `Developing ${cat.toLowerCase()}`);
    }
  }

  // If everything is 3 (no strengths or growth), note it
  if (strengths.length === 0 && growth.length === 0) {
    return {
      strengths: "Developing steadily across all assessed areas",
      areasForGrowth: "Continue building consistency across all areas",
    };
  }

  return {
    strengths: strengths.length > 0 ? strengths.join(", ") : "Performing at expected level across assessed areas",
    areasForGrowth: growth.length > 0 ? growth.join(", ") : "No significant concerns — continue current trajectory",
  };
}
