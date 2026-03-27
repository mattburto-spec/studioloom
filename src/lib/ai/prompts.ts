import type { UnitWizardInput, LessonJourneyInput, JourneyOutlineOption, TimelineOutlineOption, TimelinePhase, TimelineLessonSkeleton, TimelineSkeleton, DesignLessonType } from "@/types";
import { CRITERIA, type CriterionKey, MYP_GLOBAL_CONTEXTS, MYP_KEY_CONCEPTS, MYP_RELATED_CONCEPTS_DESIGN, EMPHASIS_PAGE_COUNT, buildPageDefinitions, getCriterion } from "@/lib/constants";
import { getActivityLibrarySummary } from "@/lib/activity-library";
import { getActivityCardSummaryEnriched } from "@/lib/activity-cards";
import {
  retrieveContext,
  formatRetrievedContext,
  recordRetrieval,
} from "@/lib/knowledge/retrieve";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import { retrieveAggregatedFeedback } from "@/lib/knowledge/feedback";
import { buildTeachingContextBlock } from "@/lib/knowledge/analysis-prompts";
import { buildFrameworkPromptBlock } from "@/lib/ai/framework-vocabulary";
import type { PartialTeachingContext } from "@/types/lesson-intelligence";
import { getFrameworkFromContext } from "@/lib/ai/teacher-context";
import type { TeacherStyleProfile } from "@/types/teacher-style";
import { buildTeacherStyleBlock } from "@/lib/teacher-style/profile-service";

// =========================================================================
// Grade-Aware Timing Profiles
// =========================================================================

export interface GradeTimingProfile {
  mypYear: number;
  /** Average student age for this year group (used in 1+age instruction cap rule) */
  avgStudentAge: number;
  warmupMinutes: number;
  introMinutes: number;
  reflectionMinutes: number;
  /** Max minutes for HIGH cognitive demand activities (reading, writing, analysis, documentation) */
  maxHighCognitiveMinutes: number;
  /** Max minutes for ACTIVE/HANDS-ON activities (making, experimenting, building, testing) */
  maxHandsOnMinutes: number;
  /** Max minutes for COLLABORATIVE activities (discussion, peer review, group work) */
  maxCollaborativeMinutes: number;
  /** Max minutes for DIGITAL/RESEARCH activities (online research, digital tools, CAD) */
  maxDigitalMinutes: number;
  /** General pacing and scaffolding guidance for the AI */
  pacingNote: string;
}

/**
 * The "1 + age" rule: maximum direct instruction = 1 + student's average age.
 * Backed by research from PBLWorks, Cult of Pedagogy, and cognitive science.
 */
export function maxInstructionMinutes(profile: GradeTimingProfile): number {
  return 1 + profile.avgStudentAge;
}

/**
 * Minimum work time as a percentage of usable time.
 * Research consensus: at least 45%, ideally 60%+.
 */
export const MIN_WORK_TIME_PERCENT = 0.45;
export const IDEAL_WORK_TIME_PERCENT = 0.60;

/**
 * Context-aware timing model — replaces hard limits with school/lesson-aware calculations.
 * See docs/timing-reference.md for the full data.
 */
export interface TimingContext {
  /** Raw period length in minutes (before any deductions) */
  periodMinutes: number;
  /** Is this a workshop/practical lesson? Affects setup/cleanup deductions */
  isWorkshop: boolean;
  /** Transition overhead: settling, attendance, device login */
  transitionMinutes: number;
  /** Workshop setup time (material distribution, safety brief). 0 for theory. */
  setupMinutes: number;
  /** Workshop cleanup time (tools away, benches, safety check). 0 for theory. */
  cleanupMinutes: number;
  /** The grade timing profile for cognitive load limits */
  gradeProfile: GradeTimingProfile;
}

/**
 * Calculate usable time from a TimingContext.
 */
export function calculateUsableTime(ctx: TimingContext): number {
  return Math.max(0,
    ctx.periodMinutes - ctx.transitionMinutes - ctx.setupMinutes - ctx.cleanupMinutes
  );
}

/**
 * Build default TimingContext from a grade profile and lesson metadata.
 * Uses sensible defaults for overhead; teachers can override via settings.
 */
export function buildTimingContext(
  gradeProfile: GradeTimingProfile,
  periodMinutes: number,
  isWorkshop: boolean,
  overrides?: {
    transitionMinutes?: number;
    setupMinutes?: number;
    cleanupMinutes?: number;
  }
): TimingContext {
  return {
    periodMinutes,
    isWorkshop,
    transitionMinutes: overrides?.transitionMinutes ?? 3,
    setupMinutes: isWorkshop ? (overrides?.setupMinutes ?? 8) : 0,
    cleanupMinutes: isWorkshop ? (overrides?.cleanupMinutes ?? 8) : 0,
    gradeProfile,
  };
}

const TIMING_PROFILES: Record<number, GradeTimingProfile> = {
  1: {
    mypYear: 1, avgStudentAge: 11, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 12, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 15,
    pacingNote: "MYP Year 1 (age 11): Students sustain cognitive focus for ~10-12 minutes but can engage in hands-on making for much longer. Reading, writing, and analysis tasks must be SHORT (≤12 min) and heavily scaffolded with checklists, sentence starters, and worked examples. Hands-on/making activities can run 20-40 min as long as they have clear checkpoints. Break reading-heavy tasks into small chunks with partner discussion between them.",
  },
  2: {
    mypYear: 2, avgStudentAge: 12, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 13, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 20,
    pacingNote: "MYP Year 2 (age 12): Cognitive focus extends to ~12-13 minutes (1+age rule). Still scaffold reading/analysis tasks with sentence starters and templates, but allow some choice in how students respond. Hands-on making activities can run 20-40 min. Mix active and passive tasks — avoid back-to-back reading/writing activities.",
  },
  3: {
    mypYear: 3, avgStudentAge: 13, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 14, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 20, maxDigitalMinutes: 25,
    pacingNote: "MYP Year 3 (age 13): Cognitive focus ~14 minutes (1+age rule). Balance structured guidance with growing autonomy. Provide reference materials and exemplars but reduce step-by-step scaffolding. Students can handle longer research tasks and sustained making sessions.",
  },
  4: {
    mypYear: 4, avgStudentAge: 15, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 16, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 30,
    pacingNote: "MYP Year 4 (age 15): Cognitive focus ~16 minutes (1+age rule). Support extended independent work with clear success criteria. Scaffold through exemplars and peer critique rather than templates. Students can manage longer analysis and documentation tasks.",
  },
  5: {
    mypYear: 5, avgStudentAge: 16, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 17, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "MYP Year 5 (age 16): Cognitive focus ~17 minutes (1+age rule). Minimise unnecessary transitions to allow flow state during deep work. Scaffold through prompts and peer critique. Students can sustain extended analysis, documentation, and independent making sessions.",
  },
};

/**
 * Parse the MYP year from a gradeLevel string like "Year 3 (Grade 8)".
 * Returns the timing profile for that year, defaulting to Year 3 if parsing fails.
 */
export function getGradeTimingProfile(gradeLevel: string, configProfiles?: Record<number, GradeTimingProfile>): GradeTimingProfile {
  const match = gradeLevel?.match(/Year\s*(\d+)/i);
  const year = match ? parseInt(match[1], 10) : 3;
  const profiles = configProfiles || TIMING_PROFILES;
  return profiles[year] || profiles[3] || TIMING_PROFILES[3];
}

/**
 * Build a timing constraints block for injection into generation prompts.
 * ALWAYS calculates usable time — never generates for raw period length.
 * If no TimingContext is provided, constructs a default (theory lesson, 3-min transition).
 */
export function buildTimingBlock(
  profile: GradeTimingProfile,
  lessonLengthMinutes: number,
  timingCtx?: TimingContext
): string {
  // Always use usable time — construct default TimingContext if none provided
  const ctx: TimingContext = timingCtx || buildTimingContext(profile, lessonLengthMinutes, false);
  const usable = calculateUsableTime(ctx);
  const lessonType = ctx.isWorkshop ? "WORKSHOP" : "THEORY";
  const instructionCap = maxInstructionMinutes(profile);
  const minWorkTime = Math.round(usable * MIN_WORK_TIME_PERCENT);
  const idealWorkTime = Math.round(usable * IDEAL_WORK_TIME_PERCENT);

  return `## Timing Context
Schedule: ${ctx.periodMinutes}-minute period | Lesson type: ${lessonType} | MYP Year ${profile.mypYear} (avg age ${profile.avgStudentAge})
Usable time: **${usable} minutes** (after ${ctx.transitionMinutes} min transition${ctx.isWorkshop ? `, ${ctx.setupMinutes} min setup, ${ctx.cleanupMinutes} min cleanup` : ""})

CRITICAL: Generate activities that sum to ${usable} minutes. Do NOT generate ${ctx.periodMinutes} minutes of content.
${ctx.isWorkshop ? `Include setup (${ctx.setupMinutes} min) and cleanup (${ctx.cleanupMinutes} min) as explicit lesson phases.` : ""}

## LESSON STRUCTURE — MANDATORY WORKSHOP MODEL
Every lesson MUST follow the 4-Phase Workshop Model. This is non-negotiable.

### Phase 1: OPENING (5-10 min)
Hook, context, connect to prior learning. Set expectations for the session.
Activate curiosity — a compelling question, image, or problem.

### Phase 2: MINI-LESSON (max ${instructionCap} min — the "1 + age" rule)
Teach ONE skill or concept. Demonstrate a technique. Short and focused.
Maximum ${instructionCap} minutes of direct instruction (1 + avg student age of ${profile.avgStudentAge}).
After ${instructionCap} minutes, student attention drops sharply. Stop teaching and start working.

### Phase 3: WORK TIME (minimum ${minWorkTime} min, ideally ${idealWorkTime}+ min — at least 45% of usable time)
THE MAIN EVENT. Students create, research, prototype, test, build.
This is ONE sustained block — do NOT fragment it into multiple small activities.
Teacher circulates: 1-on-1 conferences, formative assessment, just-in-time teaching.
${usable >= 80 ? `For this long period, include a check-in at ~${Math.round(idealWorkTime * 0.5)} min ("Where are you up to? What's your next step?").` : ""}
${usable >= 80 ? `Consider a 5-min refocus break at the midpoint.` : ""}

### Phase 4: DEBRIEF (5-10 min — NON-NEGOTIABLE, never skip)
Structured reflection using a protocol. Options:
- **5-min Quick Debrief:** 2-3 students share (1 min each), teacher synthesises ("I noticed..."), bridge to next lesson
- **10-min Pair Feedback:** I Like / I Wish / I Wonder protocol — presenters frame their work, partners give structured feedback
- **Exit Ticket:** Students write 1 thing they learned + 1 question they still have

## Age-Appropriate Pacing
${profile.pacingNote}

Activity duration limits for MYP Year ${profile.mypYear}:
- Direct instruction / demonstration: max ${instructionCap} min (1+age rule, then switch to student work)
- Independent making / prototyping: max ${profile.maxHandsOnMinutes} min (with checkpoints every ${Math.min(15, instructionCap)} min)
- Digital work / CAD / research: max ${profile.maxDigitalMinutes} min
- Critique / gallery walk / peer review: max ${profile.maxCollaborativeMinutes} min
- Debrief / reflection: 5-10 min (non-negotiable, always at end)
- Opening / hook: 5-10 min (always at start)

Usable time budget: Opening (5-10) + Mini-Lesson (max ${instructionCap}) + Work Time (${minWorkTime}-${idealWorkTime}+) + Debrief (5-10) = ${usable} min

Energy sequencing rules:
- Never place two high-cognitive activities back-to-back
- Workshop making can follow theory (welcome shift)
- Theory should NOT follow long workshop (students are physically tired)
- Critique/gallery walk works best mid-lesson after students have work to show
- Always end with debrief — it's the last thing students do before leaving

## EXTENSIONS (REQUIRED)
For EVERY lesson, generate 2-3 extension activities for students who finish early.
Extensions must match the current design phase:
- Investigation phase: deepen research (more interviews, competitor analysis, accessibility audit)
- Ideation phase: push creativity (SCAMPER on top concept, constraint variation, rapid prototype 3 versions)
- Prototyping phase: explore alternatives (different materials, scale variation, user testing with different demographic)
- Evaluation phase: increase rigor (edge-case testing, cross-cohort comparison, sustainability analysis)
Extensions are NOT extra work. They are productive deepening of the same design challenge.
Format: Include an "extensions" array on each lesson with 2-3 items: { "title": "...", "description": "...", "durationMinutes": N }`;
}

// =========================================================================
// DESIGN TEACHING CORPUS + TEACHER STYLE — injected into generation prompts
// See docs/design-teaching-corpus.md for the full reference.
// See docs/ai-intelligence-architecture.md §4 for teacher style profiles.
// =========================================================================

/**
 * Build a concise design teaching context block for injection into generation prompts.
 * Includes the Design Teaching Corpus (Layer 1) principles, the Workshop Model requirement,
 * and the teacher's learned style profile (Layer 4) if available.
 */
export function buildDesignTeachingContext(teacherProfile?: TeacherStyleProfile | null): string {
  const styleBlock = teacherProfile ? buildTeacherStyleBlock(teacherProfile) : "";
  return `## Design Teaching Principles
You are generating content for design & technology education. Follow these principles:

1. WORKSHOP MODEL (HIGHEST PRIORITY): Every lesson follows 4 phases — Opening (5-10 min) → Mini-Lesson (max 1+age minutes) → Work Time (at least 45% of period, ideally 60%+) → Debrief (5-10 min). Work Time is THE MAIN EVENT. Everything else exists to support it. Never fragment Work Time into small activities — it is one sustained block where students create, research, build, and test. The debrief is non-negotiable and uses a structured protocol (I Like/I Wish/I Wonder, Two Stars & a Wish, exit ticket).

2. NON-LINEAR DESIGN CYCLE: The design cycle is NOT a linear sequence. Students jump between phases (research → ideate → test → back to research). Plan for iteration and decision points, not rigid step-by-step sequences.

3. GRADUAL RELEASE: Use "I do → We do → You do" scaffolding. Teacher demonstrates → students practice with guidance → students work independently. Progressively remove scaffolding (checklists, templates, sentence starters) as students gain confidence.

4. WHOLE GAME: Every activity should connect to the broader design challenge. Students should always know WHY they're doing something. Avoid isolated skill drills disconnected from the project.

5. CRITIQUE PROTOCOLS: Include structured critique activities (Warm/Cool feedback, I Like/I Wish/What If, TAG, silent gallery walk). Feedback must be Kind, Specific, and Helpful. "I like it" is not feedback. "I like how the handle curves to fit the palm" is feedback.

6. WORKSHOP AWARENESS: Design lessons have physical realities — setup time, cleanup time, material distribution, safety briefs, noise curves. Account for these. Don't pretend a workshop lesson is the same as a theory lesson.

7. STUDIO CULTURE: Work is always visible, critique is normal, iteration is expected, the teacher is a design mentor (not a lecturer), students make real decisions about materials/methods/aesthetics.

8. PROCESS OVER PRODUCT: A portfolio showing iterative improvement is more valuable than a perfect final product. Document the journey — wrong turns and pivots demonstrate learning.

9. ENERGY SEQUENCING: Don't put two high-cognitive activities back-to-back. Making can follow theory. Theory should NOT follow long workshop sessions. Always end with debrief.

10. DIFFERENTIATION & EXTENSIONS: Design naturally differentiates (different paces, multiple valid solutions). Plan scaffolding for ELL students, extension activities for fast finishers (indexed to the current design phase — not busywork), and adapted tools for students with physical needs.

11. 66% ACTIVE LEARNING RULE (RESEARCH-BACKED): At least 66% of all lesson activities must be ACTIVE — students creating, designing, building, discussing, analyzing, evaluating, presenting, collaborating, or using design tools. Achievement gaps across cultural, linguistic, and socioeconomic backgrounds ONLY close when active learning exceeds 66% of class time (effect size d=0.52). Passive content (reading, watching demos, teacher lectures) must stay below 34%. This rule is validated post-generation — the system will flag units that fall below the threshold.

12. INCLUSIVE ASSESSMENT LANGUAGE: Frame all assessment activities as learning opportunities, never ability tests. Use "This helps us see what you're learning" NOT "This assesses your design ability." Stereotype threat (effect size d=-0.33) is triggered by ability-framing, especially for underrepresented groups. Always use growth framing in rubric descriptions, task instructions, and reflection prompts.${styleBlock}`;
}

// =========================================================================

/**
 * System prompt that teaches the AI about MYP Design, the page structure,
 * and the exact JSON schema to output.
 */
export const UNIT_SYSTEM_PROMPT = `You are an expert MYP (Middle Years Programme) Design teacher and curriculum designer. You create engaging, differentiated unit content for the IB MYP Design cycle.

## MYP Design Cycle Structure
Units have a variable number of pages organized by MYP criteria (A, B, C, D).
The number of pages per criterion depends on the emphasis level:
- Light: 2 pages (concise coverage)
- Standard: 3 pages (balanced depth)
- Emphasis: 4 pages (thorough deep-dive)

Not every unit includes all 4 criteria — generate ONLY the pages specified in the user prompt.

## Your Task
Generate content for the requested criterion pages. Output ONLY valid JSON matching the exact schema below.

## JSON Schema (for each page)
{
  "pages": {
    "[PageId]": {
      "title": "Short descriptive page title",
      "learningGoal": "Clear learning objective for this page",
      "vocabWarmup": {
        "terms": [
          { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
        ],
        "activity": {
          "type": "matching",
          "items": [
            { "question": "Match prompt", "answer": "Correct answer" }
          ]
        }
      },
      "introduction": {
        "text": "Introduction paragraph explaining the task and connecting to prior learning"
      },
      "sections": [
        {
          "prompt": "Clear, engaging question or task for the student",
          "scaffolding": {
            "ell1": {
              "sentenceStarters": ["Begin with...", "This means..."],
              "hints": ["Think about...", "Consider..."]
            },
            "ell2": {
              "sentenceStarters": ["I think...", "One example is..."]
            },
            "ell3": {
              "extensionPrompts": ["How might you extend this?", "What connections can you make?"]
            }
          },
          "responseType": "text",
          "exampleResponse": "A model response showing quality expectations"
        }
      ],
      "reflection": {
        "type": "confidence-slider",
        "items": ["I understand the task", "I can explain my reasoning"]
      }
    }
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. Include 3-5 vocab terms per page, relevant to the topic
3. Include 2-4 activity sections per page
4. Vary responseType across sections: use "text", "upload", "link", "multi", and for decision-making tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
5. Make prompts age-appropriate for the specified grade level
6. Connect content to the specified global context and key concept
7. Include practical, hands-on activities where relevant
8. For "emphasis" criteria, include more detailed sections with deeper inquiry
9. For "light" criteria, keep sections focused and concise
10. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
11. Reflection type can be: "confidence-slider", "checklist", or "short-response"
12. Output ONLY the JSON object — no markdown, no explanations
13. When appropriate, incorporate established design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) into section prompts — adapt them to the specific topic rather than using generic templates
14. For B2-B3 pages (choosing between designs), prefer "decision-matrix" or "pairwise" responseType. For C1-C2 pages (planning creation), consider "trade-off-sliders". For evaluation pages, consider "pmi"
15. Set "portfolioCapture": true on 1-2 sections per page that represent substantive design work — research findings, design sketches/uploads, design justifications, creation evidence, evaluations. Omit or set false for vocab warm-ups, scaffolding prompts, and low-value practice questions`;

/**
 * Build the user prompt for generating a specific criterion's pages.
 *
 * @param activitySummary  Pre-fetched activity card summary from DB.
 *                         If omitted, falls back to the hardcoded library.
 */
export function buildCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  activitySummary?: string
): string {
  const unitType = input.unitType || "design";
  const criterionInfo = getCriterion(criterion, unitType) || { name: criterion, key: criterion };
  const focusLevel = input.criteriaFocus[criterion] || "standard";
  const pageCount = EMPHASIS_PAGE_COUNT[focusLevel];
  const pageDefs = buildPageDefinitions([criterion], { [criterion]: focusLevel }, unitType);

  const pageDescriptions = pageDefs
    .map((p) => `  - ${p.id}: ${p.title}`)
    .join("\n");

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const curriculumSection = input.curriculumContext
    ? `\n- Curriculum Context: ${input.curriculumContext}`
    : "";

  // Use DB-backed summary if available, fall back to hardcoded library
  const activitySuggestions = activitySummary || getActivityLibrarySummary(criterion);

  return `Generate ${pageCount} pages for Criterion ${criterion}: ${criterionInfo.name}

## Suggested Activity Cards for Criterion ${criterion}
Consider incorporating these activity cards where appropriate. Each card has a specific use case and optional modifiers. Pick the most relevant card for each page and weave it naturally into the section prompts:
${activitySuggestions}

## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}${curriculumSection}

## Pages to Generate
${pageDescriptions}

## Focus Level: ${focusLevel}
${focusLevel === "emphasis" ? "This is an EMPHASIS criterion — include more detailed sections (3-4 per page), deeper inquiry questions, and richer scaffolding." : focusLevel === "light" ? "This is a LIGHT criterion — keep sections concise (2 per page), focused, and efficient." : "This is STANDARD — include 2-3 sections per page with balanced depth."}

Generate the JSON for exactly these ${pageCount} pages (${pageDefs.map(p => p.id).join(", ")}). Remember to include ELL scaffolding (ell1, ell2, ell3) for every section.`;
}

/**
 * Build a RAG-enriched criterion prompt that includes retrieved examples
 * from the teacher's knowledge base and community content.
 *
 * Also fetches activity card summaries from the DB (with hardcoded fallback)
 * so the generation AI has full awareness of available activity cards.
 */
export async function buildRAGCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  teacherId?: string,
  selectedOutline?: { approach: string; pages: Record<string, { title: string; summary: string }> } | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (includes modifier info)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched(criterion);
  } catch {
    // DB unavailable — buildCriterionPrompt will fall back to hardcoded
  }

  const basePrompt = buildCriterionPrompt(criterion, input, activitySummary);

  // Retrieve relevant context from knowledge base
  const criterionDef = getCriterion(criterion, input.unitType || "design");
  const query = `${input.topic} ${input.title} Criterion ${criterion} ${criterionDef?.name || criterion} ${input.gradeLevel} ${input.globalContext}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      criterion,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);

      // Record retrieval for quality tracking (fire-and-forget)
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement — continue without it
  }

  // Retrieve lesson profiles — structured pedagogical intelligence
  try {
    const profiles = await retrieveLessonProfiles({
      query: `${input.topic} ${input.title} ${criterionDef?.name || criterion} ${input.gradeLevel}`,
      gradeLevel: input.gradeLevel,
      criteria: [criterion],
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);

      // Record retrieval for quality tracking (fire-and-forget)
      incrementProfileReferences(profileIds).catch(() => {});
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build outline instruction if teacher selected an approach
  let outlineSection = "";
  if (selectedOutline) {
    const criterionPages = Object.entries(selectedOutline.pages)
      .filter(([pageId]) => pageId.startsWith(criterion))
      .sort(([a], [b]) => a.localeCompare(b));

    if (criterionPages.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${selectedOutline.approach}"
Follow this outline closely for each page:
${criterionPages.map(([pageId, p]) => `  - ${pageId}: "${p.title}" — ${p.summary}`).join("\n")}
`;
    }
  }

  if (!ragContext && !lessonContext && !outlineSection) {
    return { prompt: basePrompt, chunkIds: [] };
  }

  // Inject lesson profiles, RAG context, and outline before the base prompt
  // Order: Teaching Patterns (high-level) → Reference Examples (specific) → Outline → Base Prompt
  const enrichedPrompt = `${lessonContext ? lessonContext + "\n\n---\n\n" : ""}${ragContext ? ragContext + "\n\n---\n\n" : ""}${outlineSection ? outlineSection + "\n---\n\n" : ""}${basePrompt}`;

  return { prompt: enrichedPrompt, chunkIds };
}

/**
 * System prompt for generating unit outline options (not full pages).
 * Used in the multi-option generation step.
 */
export const OUTLINE_SYSTEM_PROMPT = `You are an expert MYP Design curriculum designer. Generate unit outline options — NOT full page content, just titles and brief descriptions for each page.

Units may not include all 4 criteria (A, B, C, D) and the number of pages per criterion varies by emphasis level. Generate outlines covering ONLY the specified criteria and page counts.

Each option should represent a genuinely different pedagogical approach to the same topic. Vary the activities, the entry point, the emphasis, and the assessment strategy.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name for this approach (e.g., 'Community-Driven Design')",
      "description": "2-3 sentence description of what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "pages": {
        "A1": { "title": "Page title", "summary": "One-sentence description of what students do" },
        "A2": { ... },
        ...for all specified page IDs
      }
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST cover ALL the page IDs specified in the user prompt — no more, no fewer
3. Options must be genuinely different — vary the design thinking frameworks, assessment types, entry activities, and real-world connections
4. Keep page summaries to one sentence each
5. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for multi-option outline generation.
 */
export function buildOutlinePrompt(
  input: UnitWizardInput,
  ragContext?: string
): string {
  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration for creating diverse, high-quality approaches.\n`
    : "";

  // Build page specification from selected criteria and emphasis
  const pageDefs = buildPageDefinitions(input.selectedCriteria, input.criteriaFocus, input.unitType || "design");
  const totalPages = pageDefs.length;
  const pageSpec = (input.selectedCriteria || []).map(c => {
    const emphasis = (input.criteriaFocus || {})[c] || "standard";
    const count = EMPHASIS_PAGE_COUNT[emphasis];
    const pageIds = Array.from({ length: count }, (_, i) => `${c}${i + 1}`);
    const cDef = getCriterion(c, input.unitType || "design");
    return `- Criterion ${c} (${cDef?.name || c}): ${count} pages (${pageIds.join(", ")})`;
  }).join("\n");

  const criteriaFocusStr = (input.selectedCriteria || [])
    .map(c => `${c}=${(input.criteriaFocus || {})[c] || "standard"}`)
    .join(", ");

  const unitTypeLabel = input.unitType && input.unitType !== "design"
    ? { service: "Service Learning", personal_project: "Personal Project", inquiry: "Inquiry" }[input.unitType] || "Design"
    : "MYP Design";
  return `Generate 3 distinct unit outline options for the following ${unitTypeLabel} unit:
${ragSection}
## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Criteria Focus: ${criteriaFocusStr}

## Page Structure (${totalPages} pages total)
${pageSpec}

Generate 3 genuinely different approaches. Each MUST cover exactly these ${totalPages} pages with the page IDs specified above.`;
}

/**
 * System prompt for the wizard suggestion endpoint.
 * Embeds valid MYP option lists so AI can only suggest valid values.
 */
export const SUGGEST_SYSTEM_PROMPT = `You are an MYP Design curriculum advisor. Given a topic and partial unit context, suggest the most relevant MYP framework elements AND practical teaching ideas.

VALID GLOBAL CONTEXTS (use exact labels):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (use exact values):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

Rules:
1. For globalContext and keyConcept, ONLY use the exact values listed above
2. For activities, tools, groupwork, and resources — suggest real, specific, practical ideas relevant to the topic (not from a fixed list)
3. Activities should be specific teaching activities (e.g., "SCAMPER brainstorm", "Gallery walk critique", "See-Think-Wonder analysis")
4. Tools should be specific software, platforms, or equipment students would use (e.g., "TinkerCAD", "Canva", "laser cutter", "Arduino")
5. Groupwork should describe specific collaborative structures (e.g., "Pair sketching", "Expert jigsaw", "Design critique circles")
6. Resources should be types of external content to include (e.g., "YouTube tutorial", "Industry case study", "Interactive demo")
7. Rank by relevance to the topic and grade level
8. For Statement of Inquiry, follow the IB formula: Key Concept + Related Concept(s) + Global Context woven into a single exploratory sentence
9. Keep JSON output minimal — no explanations outside JSON
10. Output ONLY valid JSON matching the requested schema`;

export interface SuggestContext {
  topic: string;
  title?: string;
  gradeLevel?: string;
  globalContext?: string;
  keyConcept?: string;
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  /** Keywords already placed into buckets — AI should suggest complementary ones */
  placedKeywords?: string[];
}

export function buildSuggestPrompt(tier: 1 | 2 | 3, context: SuggestContext): string {
  const exclude: string[] = [];
  if (context.globalContext) exclude.push(`Already chosen globalContext: "${context.globalContext}"`);
  if (context.keyConcept) exclude.push(`Already chosen keyConcept: "${context.keyConcept}"`);
  if (context.relatedConcepts?.length)
    exclude.push(`Already chosen relatedConcepts: ${context.relatedConcepts.map((r) => `"${r}"`).join(", ")}`);

  if (context.placedKeywords?.length) {
    exclude.push(`Already placed keywords: ${context.placedKeywords.map((k) => `"${k}"`).join(", ")}`);
  }

  const excludeSection = exclude.length > 0 ? `\nDo NOT repeat these (already selected):\n${exclude.join("\n")}` : "";
  const complementSection = context.placedKeywords?.length
    ? `\nThe teacher has already chosen: ${context.placedKeywords.join(", ")}. Suggest COMPLEMENTARY items that pair well with these choices — different activities, tools, or resources that fill gaps.`
    : "";

  let schema = "";
  if (tier === 1) {
    schema = `{
  "globalContext": ["top pick", "2nd pick"],
  "keyConcept": ["top pick", "2nd pick"],
  "activities": ["specific activity 1", "specific activity 2", "specific activity 3"],
  "tools": ["specific tool or platform 1", "specific tool 2"],
  "groupwork": ["collaborative structure 1", "collaborative structure 2"],
  "resources": ["resource type 1", "resource type 2"]
}`;
  } else if (tier === 2) {
    schema = context.keyConcept
      ? `{ "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`
      : `{ "keyConcept": ["top pick", "2nd pick"], "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`;
  } else {
    schema = `{ "statementOfInquiry": "One exploratory sentence connecting key concept, related concepts, and global context", "criteriaEmphasis": [{ "criterion": "A"|"B"|"C"|"D", "direction": "emphasis"|"light", "reason": "short reason" }] }`;
  }

  return `Topic: "${context.topic}"
Title: "${context.title || ""}"
Grade: ${context.gradeLevel || "Year 3 (Grade 8)"}
${excludeSection}${complementSection}

Return JSON matching this schema:
${schema}`;
}

// --- Auto-config prompt (Build for Me mode) ---

import { DESIGN_SKILLS, MYP_ATL_SKILL_CATEGORIES } from "@/lib/constants";

export const AUTOCONFIG_SYSTEM_PROMPT = `You are an expert MYP Design curriculum advisor. Given a teacher's end-goal description and optional keyword tags, determine ALL the MYP framework elements needed to build a unit.

VALID GLOBAL CONTEXTS (pick exactly 1, use exact label):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (pick exactly 1, use exact value):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (pick 2-3, use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

VALID DESIGN SKILLS (pick 1-3 that match the project):
${(DESIGN_SKILLS as readonly string[]).map((s) => `- "${s}"`).join("\n")}

VALID ATL SKILL CATEGORIES:
${MYP_ATL_SKILL_CATEGORIES.map((cat) => `- ${cat.category}: ${cat.skills.join(", ")}`).join("\n")}

Rules:
1. ONLY use exact values from the lists above
2. Generate a concise unit title (5-8 words)
3. The topic should expand on the teacher's goal text into a clear description
4. Statement of Inquiry must follow IB formula: weave Key Concept + Related Concepts + Global Context into one exploratory sentence
5. criteriaFocus: consider the project type. Heavy research → emphasize A. Heavy making → emphasize C. Heavy evaluation → emphasize D. Default to "standard" for balanced projects.
6. selectedCriteria: include all 4 by default ["A","B","C","D"]. For short units (4 weeks or less), consider dropping a criterion. For focused projects, consider using only 2-3 criteria.
7. Output ONLY valid JSON — no markdown, no explanations`;

export function buildAutoConfigPrompt(
  goalText: string,
  gradeLevel: string,
  durationWeeks: number,
  keywords: string[]
): string {
  const keywordsSection = keywords.length > 0
    ? `\nTeacher-pinned keywords: ${keywords.join(", ")}`
    : "";

  return `Teacher's goal: "${goalText}"
Grade: ${gradeLevel}
Duration: ${durationWeeks} weeks${keywordsSection}

Return JSON matching this exact schema:
{
  "title": "Short unit title",
  "topic": "Expanded topic description",
  "globalContext": "One of the valid global contexts",
  "keyConcept": "One of the valid key concepts",
  "relatedConcepts": ["concept1", "concept2"],
  "statementOfInquiry": "One exploratory sentence",
  "selectedCriteria": ["A", "B", "C", "D"],
  "criteriaFocus": { "A": "standard|emphasis|light", "B": "...", "C": "...", "D": "..." },
  "atlSkills": ["skill1", "skill2"],
  "specificSkills": ["design skill 1"]
}`;
}

// =========================================================================
// JOURNEY MODE — Continuous Learning Journey Generation
// =========================================================================

/**
 * System prompt for journey-mode generation.
 * Frames the unit as one continuous learning journey working backwards
 * from the end goal, broken into lesson-length blocks.
 */
export const JOURNEY_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content structured as a continuous learning journey.

## Core Principle: Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Your job is to work BACKWARDS from that goal to design a coherent sequence of lessons that gets students there. Every lesson exists because it contributes to reaching the end goal.

## Unit Structure
The unit is a sequence of LESSON BLOCKS. Each lesson is a fixed length (specified in the prompt). Lessons flow continuously — there are no structural breaks between "criteria" or "phases". Instead, each lesson naturally builds on the previous one.

## Assessment Criteria as Tags
The prompt specifies which assessment criteria exist (e.g. A, B, C, D for MYP Design). You MUST tag every activity section with the criteria it addresses using "criterionTags": ["A"] or ["B", "C"]. Criteria are metadata — they tell the teacher which assessment strand an activity contributes to. They do NOT control lesson structure.

A single lesson might touch multiple criteria. For example:
- Researching materials (A) → sketching initial ideas (B) in one lesson
- Building a prototype (C) → testing it (D) in another
- Evaluating results (D) while planning iterations (B) in another

## Lesson Flow Grammar
Follow these principles for sequencing across the unit:

### Bloom's Progression
Early lessons start at Remember/Understand (research, vocabulary, analysis of existing products).
Middle lessons progress to Apply/Analyse (ideation, planning, skill-building).
Later lessons reach Evaluate/Create (making, testing, evaluating, iterating).

### Scaffolding Fade
Lesson 1-2: Heavy scaffolding (sentence starters, worked examples, structured templates).
Middle lessons: Moderate scaffolding (some sentence starters, reference to earlier work).
Final lessons: Minimal scaffolding (extension prompts only, students work independently).

### Energy & Pacing
Each lesson has an energy arc: calm focus (warm-up) → active engagement (core tasks) → reflection.
Across the unit: build from curious exploration → creative energy → productive struggle → celebratory completion.

### Continuity
Each lesson's introduction should reference what was achieved in the previous lesson.
Each lesson should end by previewing what comes next.
The final lesson should circle back to the original goal.

## Timing — Workshop Model (MANDATORY)
Each lesson follows the 4-Phase Workshop Model. The prompt below provides usable time and age-appropriate constraints — follow them precisely.

IMPORTANT: Include "durationMinutes" on EVERY section AND on each workshop phase. All section durations within a lesson should sum to the USABLE time (not the raw period length).

The lesson structure MUST be: Opening → Mini-Lesson → Work Time → Debrief.
Work Time is ONE sustained block (minimum 45% of usable time). Do NOT split it into small activities.

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
        "designPhase": "investigation|ideation|prototyping|evaluation"
      }
    ]
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. ALWAYS include criterionTags on EVERY section — at least one criterion per section
3. ALWAYS include durationMinutes on EVERY section — realistic time estimate in minutes
4. ALWAYS include workshopPhases with realistic durations that match the timing constraints
5. ALWAYS include 2-3 extensions per lesson matching the current design phase
6. Include 3-5 vocab terms per lesson, relevant to the lesson's focus
7. Include 1-3 activity sections per lesson that fit within the Work Time phase (do not fragment into many small tasks)
8. Vary responseType across sections: "text", "upload", "link", "multi", and for decision tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
9. Make content age-appropriate for the specified grade level
10. Connect content to the specified global context and key concept
11. Include practical, hands-on activities where relevant
12. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
13. Reflection type can be: "confidence-slider", "checklist", or "short-response". Reflection items MUST include at least one emotion-aware prompt (e.g., "How did this activity make you feel?" or "What was frustrating or exciting about this?"). Research shows emotion regulation (d=0.53) is a stronger predictor of learning than cognitive ability alone. Naming feelings normalises struggle and builds metacognitive awareness. NEVER use ability-framing in reflections ("How well did you do?") — use growth-framing ("What did you learn about yourself as a designer?")
14. When appropriate, incorporate design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) — adapt them to the specific topic
15. Set "portfolioCapture": true on 1-2 sections per lesson that represent substantive design work (analysis, sketches, justifications, creation evidence, evaluations)
16. Each lesson should be SELF-CONTAINED enough to work as a single class period, but CONNECTED enough that the unit tells a coherent story
17. The first lesson should hook students with the end goal and build excitement
18. The final lesson should include completion, presentation, or celebration of the end product
19. Workshop model: section durations should fit WITHIN the Work Time phase. Opening/vocabWarmup/introduction = Opening + Mini-Lesson phases. Sections = Work Time phase. Reflection = Debrief phase.

## Evidence-Based Teaching Strategies (MUST follow)
Based on Hattie's Visible Learning research and Victorian HITS:

### Productive Failure (d=0.82 scaffolding)
- Include at least one activity where students can safely fail and learn from it
- Follow failure with structured reflection: "What went wrong? What did you learn? What will you change?"
- Frame failure positively: "Testing reveals opportunities, not mistakes"

### Critique Culture (d=0.73 feedback)
- Embed at least one peer feedback or self-assessment section per 3 lessons
- Use structured protocols: Two Stars & a Wish, Gallery Walk, TAG feedback
- Provide sentence starters for constructive critique in scaffolding

### Digital + Physical Balance (d=0.57 worked examples)
- Mix screen-based and hands-on activities across the unit
- Don't front-load ALL research/digital then ALL making — interleave where possible
- For making lessons: include a digital planning step before physical construction

### Safety Culture
- For ANY lesson involving tools, materials, or equipment: include safety in the introduction or as a content section
- Safety should be woven naturally into the activity, not as a separate slide
- For skills-demo lessons: safety briefing is part of the modelling phase

### Spaced Retrieval (d=0.71)
- Vocab warm-ups should spiral back to terms and skills from EARLIER lessons (not just the previous one)
- Include retrieval starters: quick-sketch, term matching, "recall 3 things from Lesson 2"
- Prioritise OLDER items for maximum spacing effect

### Self-Assessment Prediction (d=1.44)
- At criterion phase boundaries (last lesson before moving to next criterion focus), include a self-prediction reflection
- "Look at the Criterion [X] rubric. What level do you think you've achieved? Circle and explain why."
- The final lesson should include comprehensive self-assessment across all criteria

### Compare/Contrast Frameworks (d=1.61)
- For research/investigation sections, use structured comparison templates
- Side-by-side analysis with guided questions: features, user needs, strengths, limitations
- Use responseType "decision-matrix" or "pmi" for comparison activities`;

/**
 * Build the user prompt for journey-mode lesson generation.
 *
 * @param lessonIds   Which lessons to generate (e.g. ["L01","L02","L03","L04","L05","L06"])
 * @param input       Journey input with end goal, weeks, lesson config
 * @param options     Optional context: outline, activity cards, RAG
 */
export function buildJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: JourneyOutlineOption | null;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    batchIndex?: number;
    previousLessonSummary?: string;
    teachingContextBlock?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Build outline context for this batch
  let outlineSection = "";
  if (options?.selectedOutline) {
    const relevantLessons = options.selectedOutline.lessonPlan
      .filter((l) => lessonIds.includes(l.lessonId));
    if (relevantLessons.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Follow this outline closely for each lesson:
${relevantLessons.map((l) => `  - ${l.lessonId}: "${l.title}" — ${l.summary} [${l.criterionTags.join(", ")}]`).join("\n")}
`;
    }
  }

  // Context from previous batch
  const continuitySection = options?.previousLessonSummary
    ? `\n## Previously Generated Lessons
${options.previousLessonSummary}
Continue the learning journey from where the previous lessons left off.
`
    : "";

  // RAG context sections
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";

  return `${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${outlineSection}
## Available Activity Cards
Consider incorporating these activity cards where appropriate. Pick the most relevant for each lesson and weave them naturally into section prompts:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons total)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each section with the relevant criteria)${input.curriculumContext ? `\n- Curriculum Context: ${input.curriculumContext}` : ""}

${buildDesignTeachingContext(options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Lessons to Generate
Generate these ${lessonIds.length} lessons (of ${totalLessons} total):
${lessonIds.map((id) => {
  const lessonNum = parseInt(id.replace("L", ""), 10);
  return `  - ${id}: Lesson ${lessonNum} of ${totalLessons}`;
}).join("\n")}

${lessonIds[0] === "L01" ? "This is the FIRST batch — Lesson 1 should hook students with the end goal and build excitement about the project." : ""}
${lessonIds.includes(`L${String(totalLessons).padStart(2, "0")}`) ? "This batch includes the FINAL lesson — it should include completion, presentation, or celebration of the end product." : ""}

Remember:
- Each lesson is exactly ${input.lessonLengthMinutes} minutes
- Tag EVERY section with criterionTags (${(input.assessmentCriteria || []).join(", ")})
- Include ELL scaffolding (ell1, ell2, ell3) for every section
- Build on what came before, preview what comes next`;
}

/**
 * Build a RAG-enriched journey prompt.
 * Retrieves lesson profiles and knowledge chunks WITHOUT criterion filtering.
 */
export async function buildRAGJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: JourneyOutlineOption | null,
  previousLessonSummary?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (all categories, no criterion filter)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // DB unavailable — will fall back to hardcoded
  }

  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  // Retrieve relevant context from knowledge base (no criterion filter)
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query: `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  // Load teacher style profile for personalized generation
  let teacherStyle: TeacherStyleProfile | null = null;
  if (teacherId) {
    try {
      const { loadStyleProfile } = await import("@/lib/teacher-style/profile-service");
      teacherStyle = await loadStyleProfile(teacherId);
    } catch { /* non-fatal */ }
  }

  const prompt = buildJourneyPrompt(lessonIds, input, {
    selectedOutline,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousLessonSummary,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
    teacherStyleProfile: teacherStyle || undefined,
  });

  return { prompt, chunkIds };
}

/**
 * System prompt for journey-mode outline generation.
 */
export const JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design 3 genuinely different lesson sequences that work backwards from that goal.

Each outline is a sequence of lessons (not grouped by criteria). Each lesson has a primary focus and the assessment criteria it will address.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name (e.g., 'Rapid Prototype First')",
      "description": "2-3 sentences on what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "lessonPlan": [
        {
          "lessonId": "L01",
          "title": "Lesson title",
          "summary": "One-sentence description of what students do",
          "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
          "criterionTags": ["A"]
        }
      ]
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST have exactly the number of lessons specified
3. Options must be genuinely different — vary entry points, sequencing, project approaches
4. A lesson can address multiple criteria (criterionTags: ["B", "C"])
5. Ensure ALL specified criteria appear across the unit (every criterion must be tagged at least once)
6. The first lesson should hook students; the last should celebrate the outcome
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for journey-mode outline generation.
 */
export function buildJourneyOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct lesson journey outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate outlines for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

Generate 3 genuinely different approaches. Each MUST include exactly ${totalLessons} lessons.`;
}

// =========================================================================
// Journey Mode — Single outline generation (for "suggest another" feature)
// =========================================================================

export const SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design a single lesson sequence that works backwards from that goal.

Output valid JSON matching this schema:
{
  "approach": "Short name (e.g., 'Rapid Prototype First')",
  "description": "2-3 sentences on what makes this approach distinctive",
  "strengths": ["Strength 1", "Strength 2"],
  "lessonPlan": [
    {
      "lessonId": "L01",
      "title": "Lesson title",
      "summary": "One-sentence description of what students do",
      "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
      "criterionTags": ["A"]
    }
  ]
}

Rules:
1. Generate exactly 1 option (NOT wrapped in an "options" array)
2. The option MUST have exactly the number of lessons specified
3. A lesson can address multiple criteria (criterionTags: ["B", "C"])
4. Ensure ALL specified criteria appear across the unit
5. The first lesson should hook students; the last should celebrate the outcome
6. Output ONLY valid JSON — no markdown, no explanations`;

export function buildSingleJourneyOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 lesson journey outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate an outline for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

## Requirements
- ${angleHint}
- Be genuinely creative and distinctive${avoidSection}`;
}

// =========================================================================
// Timeline Mode — Flat activity sequence
// =========================================================================

/**
 * System prompt for timeline-mode generation.
 * Activities are a flat sequence; lesson boundaries are computed from duration.
 */
export const TIMELINE_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content as a continuous timeline of activities.

## Core Principle: Continuous Timeline
Instead of creating fixed lessons, you generate a FLAT SEQUENCE of activities for the entire unit. Lesson boundaries are computed automatically from activity durations and the school's lesson length. An activity that doesn't fit in the remaining time slides whole to the next lesson.

## Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Work BACKWARDS from that goal to design a coherent activity sequence.

## Activity Roles
Every activity has a "role":
- **warmup**: Vocabulary warm-up (include vocabTerms). Place one roughly every [lessonLength] minutes.
- **intro**: Introduction connecting to prior learning. Place one after each warmup.
- **core**: Main student tasks — the heart of the unit. Most activities are core.
- **content**: Pure information — no student response required. Omit responseType. Use contentStyle to visually categorise the block:
  - "info" (blue) — key concepts, facts, definitions
  - "warning" (amber) — safety warnings, cautions, things to watch out for
  - "tip" (green) — pro tips, teacher advice, best practices
  - "context" (gray) — background context, transitions between activities
  - "activity" (purple) — group/classroom activities (think-pair-share, gallery walk, peer review)
  - "speaking" (indigo) — discussion prompts, presentations, verbal sharing
  - "practical" (orange) — hands-on making, building, prototyping, physical tasks
  Choose the most specific style. Use "activity"/"speaking"/"practical" when the block describes what students DO physically — these help students quickly see the type of work at a glance. Include media (image/video URLs) or links (external tool URLs with labels) where visual reference or tool access helps.
- **reflection**: Self-assessment at natural breakpoints. Place one roughly every [lessonLength] minutes.

## Rich Content
- **media**: Include image or video URLs where visual reference helps. Use standard YouTube/Vimeo watch URLs (auto-converted to embeds). Set type to "image" or "video".
- **links**: Include external tool links with clear labels, e.g. { url: "https://tinkercad.com", label: "Open TinkerCAD" }. Displayed as action buttons.
- **markdown**: Prompts support basic markdown: **bold**, *italic*, [links](url). Use sparingly for emphasis.

## Phase Labels
Group activities into phases using "phaseLabel" (e.g., "Research", "Ideation", "Prototyping", "Evaluation"). Activities in the same phase share a phaseLabel. This helps teachers see the arc.

## Assessment Criteria as Tags
Tag every CORE activity with criterionTags (e.g. ["A"], ["B","C"]). Warmup/intro/reflection activities can omit tags.

## Timing — Workshop Model Awareness
- Total duration of ALL activities ≈ totalLessons × lessonLengthMinutes
- Each activity has a realistic durationMinutes
- The prompt below provides USABLE time (after transition/setup/cleanup overhead) — never generate for the raw period length
- The prompt below provides age-appropriate timing constraints based on the students' grade level — core activity durations MUST respect the maximum for the grade
- Place warmup+intro+reflection bookends at approximately every [lessonLength] minutes of cumulative core time
- Within each lesson-length chunk, follow the Workshop Model: opening (5-10 min) → instruction (max 1+age min) → sustained work (≥45% of usable time) → debrief (5-10 min)
- Work Time is ONE sustained block — do NOT fragment it into many small 5-10 minute activities. Group related tasks into one long work block
- ALWAYS include 2-3 extension activities per lesson-length chunk for early finishers, indexed to the current design phase

## Sequencing
### Bloom's Progression
Early: Remember/Understand (research, vocabulary, existing product analysis)
Middle: Apply/Analyse (ideation, planning, skill-building)
Later: Evaluate/Create (making, testing, evaluating, iterating)

### Scaffolding Fade
Early activities: Heavy scaffolding (sentence starters, worked examples, templates)
Middle: Moderate scaffolding
Late: Minimal scaffolding (extension prompts only)

### Energy & Pacing
Build from curious exploration → creative energy → productive struggle → celebratory completion

## Rules
1. Include ELL scaffolding (ell1, ell2, ell3) for EVERY core activity
2. Tag every core activity with criterionTags
3. Include durationMinutes on EVERY activity
4. Vary responseType across activities
5. Set portfolioCapture: true on 1-2 core activities per ~lesson-length of time
6. First activities should hook students with the end goal
7. Final activities should include completion/celebration of the end product
8. Give each activity a unique short ID (a1, a2, a3, ...)
9. Add teacherNotes to at least 2 core activities per lesson-length with: circulation questions at different cognitive levels, safety reminders for hands-on activities, differentiation tips

## Evidence-Based Teaching Strategies (MUST follow)
Based on Hattie's Visible Learning research and Victorian HITS:

### Productive Failure (d=0.82)
- Design at least one activity where students can safely fail and learn from it
- Follow failure with structured reflection: "What went wrong? What did you learn? What will you change?"
- Frame failure positively: "Testing reveals opportunities, not mistakes"

### Critique Culture (d=0.73)
- Embed at least one peer feedback or self-assessment activity per 3 lessons-worth of activities
- Use structured protocols: Two Stars & a Wish, Gallery Walk, TAG feedback
- Provide sentence starters for constructive critique

### Digital + Physical Balance
- Mix screen-based and hands-on activities within the unit
- Don't front-load ALL research/digital then ALL making — interleave where possible
- For making activities: include a digital planning step before physical construction

### Safety Culture
- For ANY activity involving tools, materials, or equipment: include safety in teacherNotes
- Safety should be woven naturally into the activity, not as a separate slide
- For skills demos: safety briefing is part of the content/intro activity

### Spaced Retrieval (d=0.71)
- Warmup activities should spiral back to vocabulary and skills from EARLIER lessons (not just the previous one)
- Include retrieval starters: quick-sketch, term matching, "recall 3 things from L02"
- Prioritise OLDER items for maximum spacing effect — retrieving L01 content in L05 is more powerful than retrieving L04 content

### Self-Assessment Prediction (d=1.44)
- At criterion phase boundaries (last lesson before moving to next criterion focus), include a self-prediction activity
- "Look at the Criterion [X] rubric. What level do you think you've achieved? Circle and explain why."
- The final lesson should include comprehensive self-assessment across all criteria

### Compare/Contrast Frameworks (d=1.61)
- For research/investigation activities, use structured comparison templates
- Side-by-side analysis with guided questions: features, user needs, strengths, limitations
- Use responseType "decision-matrix" or "pmi" for these activities`;

/**
 * Build the user prompt for timeline-mode activity generation.
 */
export function buildTimelinePrompt(
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: TimelineOutlineOption | null;
    phaseToGenerate?: TimelinePhase;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    previousActivitiesSummary?: string;
    activitiesGeneratedSoFar?: number;
    teachingContextBlock?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const totalMinutes = totalLessons * input.lessonLengthMinutes;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Phase-specific context
  let phaseSection = "";
  if (options?.phaseToGenerate) {
    const phase = options.phaseToGenerate;
    phaseSection = `
## Phase to Generate: "${phase.title}"
${phase.summary}
Primary Focus: ${phase.primaryFocus}
Criteria Emphasis: ${phase.criterionTags.join(", ")}
Estimated duration: ~${phase.estimatedLessons} lessons (${phase.estimatedLessons * input.lessonLengthMinutes} minutes of activities)

Generate activities for THIS PHASE ONLY. Include warmup/intro at the start and reflection at the end.`;
  } else if (options?.selectedOutline) {
    phaseSection = `
## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Phases:
${options.selectedOutline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [${p.criterionTags.join(", ")}]`).join("\n")}

Generate activities covering ALL phases.`;
  }

  // Context from previous generation
  const continuitySection = options?.previousActivitiesSummary
    ? `
## Previously Generated Activities
${options.previousActivitiesSummary}
Continue the activity sequence from where the previous batch left off.`
    : "";

  // RAG context + teaching context
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";

  return `${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${phaseSection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons, ${totalMinutes} total minutes)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each core activity)

${buildDesignTeachingContext(options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Generation Target
Generate a flat list of activities. Total duration should be approximately ${totalMinutes} minutes.
Place warmup + intro + reflection bookends roughly every ${input.lessonLengthMinutes} minutes of content.
${options?.activitiesGeneratedSoFar ? `Activities generated so far: ${options.activitiesGeneratedSoFar}` : ""}

Remember:
- Every activity needs: id, role, title, prompt, durationMinutes
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle (info/warning/tip/context/activity/speaking/practical), media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Use phaseLabel to group activities into coherent phases
- Include media (video/image URLs) and links (external tools) where they add value`;
}

/**
 * System prompt for timeline-mode outline generation.
 */
export const TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as phase-based timelines.

The teacher has an END GOAL. You design 3 genuinely different approaches, each described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 3 options
2. Each option has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Options must be genuinely different — vary entry points, sequencing, project approaches
5. Ensure ALL specified criteria appear across the phases
6. Include an estimatedActivityCount (typically 4-6 activities per lesson)
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for timeline-mode outline generation.
 */
export function buildTimelineOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct phase-based timeline outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Each approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})
- Generate 3 genuinely different approaches`;
}

/**
 * System prompt for generating a SINGLE timeline outline approach.
 */
export const SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a phase-based timeline.

The teacher has an END GOAL. You design a single approach described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 1 approach
2. The approach has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Ensure ALL specified criteria appear across the phases
5. Include an estimatedActivityCount (typically 4-6 activities per lesson)
6. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build a user prompt for generating a SINGLE timeline outline with a given angle.
 */
export function buildSingleTimelineOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 phase-based timeline outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- ${angleHint}
- The approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})${avoidSection}`;
}

/**
 * Build RAG-enhanced timeline prompt with knowledge base + lesson profiles.
 * Mirrors buildRAGJourneyPrompt but for timeline-mode generation.
 */
export async function buildRAGTimelinePrompt(
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: TimelineOutlineOption | null,
  phaseToGenerate?: TimelinePhase,
  previousActivitiesSummary?: string,
  activitiesGeneratedSoFar?: number,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // DB unavailable — will fall back to hardcoded
  }

  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  // Retrieve relevant context from knowledge base
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + their aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  // Load teacher style profile
  let teacherStyle: TeacherStyleProfile | null = null;
  if (teacherId) {
    try {
      const { loadStyleProfile } = await import("@/lib/teacher-style/profile-service");
      teacherStyle = await loadStyleProfile(teacherId);
    } catch { /* non-fatal */ }
  }

  const prompt = buildTimelinePrompt(input, {
    selectedOutline,
    phaseToGenerate,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousActivitiesSummary,
    activitiesGeneratedSoFar,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
    teacherStyleProfile: teacherStyle || undefined,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// SKELETON GENERATION (Stage 1 — fast lesson-level outline before full activities)
// =========================================================================

/**
 * System prompt for skeleton generation.
 * Produces lesson titles, key questions, and timing — NOT full activities.
 */
export const SKELETON_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. Generate a LESSON SKELETON — a lightweight outline of every lesson in the unit.

## What You're Generating
For each lesson: a title, key driving question, estimated duration, phase label, assessment criteria emphasis, and 3-4 brief activity hints (one line each, not full activity details).

## Backward Design
The teacher has an END GOAL. Work backwards: what must students have completed by the last lesson? The second-to-last? Build a coherent learning arc.

## Rules
1. Lesson count and timing must match the unit duration
2. Every assessment criterion must appear across the lessons
3. Activity hints are brief suggestions, not detailed prompts (e.g., "Warmup: key vocab matching", "Core: user survey design")
4. Include warmup + reflection hints in each lesson (bookending the core)
5. Include a narrative arc — a 2-3 sentence summary of how the unit flows emotionally and intellectually
6. Phase labels should match the selected approach's phases
7. Early lessons: research, exploration, understanding. Middle: ideation, skill-building. Late: making, testing, presenting.
8. Output ONLY valid JSON — no markdown, no explanations

## Lesson Types (REQUIRED)
Classify each lesson as ONE of these Design lesson types:
- "research" — gathering info, analysis, product comparison, user interviews
- "ideation" — brainstorming, divergent thinking, sketching, SCAMPER, mind mapping
- "skills-demo" — teaching a tool/technique with I Do → We Do → You Do sequence
- "making" — extended hands-on creation, prototyping, building
- "testing" — testing prototypes, gathering user feedback, measuring, recording data
- "critique" — peer review, self-assessment, gallery walk, structured feedback

Each type has a DIFFERENT lesson structure:
- Research: mini-lesson → guided inquiry → independent analysis → share findings
- Ideation: stimulus → divergent (individual) → convergent (group) → select
- Skills-demo: safety/demo (I Do) → guided practice (We Do) → independent (You Do)
- Making: brief safety check → extended making (teacher circulates) → clean-up → reflection
- Testing: predict → test → record → analyse → iterate plan
- Critique: criteria reminder → gallery walk/peer critique → self-assess → goal-set

## Learning Intentions & Success Criteria (CRITICAL)
For EVERY lesson, generate:
- learningIntention: ONE clear sentence starting with "Students will..." — focused on PROCESS not content recall
  Good: "Students will analyse two existing products to identify design features that meet user needs"
  Bad: "Students will learn about user needs" (too vague)
- successCriteria: 2-3 OBSERVABLE criteria that show the intention was met
  Good: ["Identifies at least 3 design features per product", "Explains how each feature meets a specific user need", "Compares products using a structured framework"]
  Bad: ["Understands products"] (not observable)

Learning intentions must BACKWARD MAP from the unit end goal — each lesson's LI builds toward the final product.

## Cumulative Vocabulary & Skills Tracking (for Spaced Retrieval)
For EVERY lesson, list:
- cumulativeVocab: 2-4 KEY vocabulary terms introduced IN THIS LESSON (technical terms students must learn)
  Example L01: ["user need", "design brief", "target audience"]
  Example L02: ["ergonomic", "anthropometric data"]
- cumulativeSkills: 1-3 KEY skills/techniques introduced IN THIS LESSON
  Example L01: ["conducting user interviews", "writing a design brief"]
  Example L03: ["sketching isometric views", "annotating designs"]

These lists power spaced retrieval warm-ups — later lessons will quiz students on terms/skills from earlier lessons. Be specific: "CAD" is too vague, "creating a 2D sketch in Fusion 360" is good.`;

/**
 * Build the user prompt for skeleton generation.
 */
export function buildSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  ragContext?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  return `Generate a lesson skeleton for the following unit:
${ragSection}
## Selected Approach: "${outline.approach}"
${outline.description}

Phases:
${outline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [Criteria: ${p.criterionTags.join(", ")}]`).join("\n")}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Generate exactly ${totalLessons} lesson skeletons
- Each lesson gets estimatedMinutes of ${input.lessonLengthMinutes}
- Each lesson has 3-4 brief activity hints (one line each)
- Phase labels must match the approach phases above
- Criteria must be distributed across all lessons
- Include a narrativeArc summary (2-3 sentences)
- Each lesson MUST include lessonType, learningIntention, and successCriteria
- Each lesson MUST include cumulativeVocab (2-4 new terms) and cumulativeSkills (1-3 new skills)
- Learning intentions must backward-map from the end goal: "${input.endGoal}"
- Lesson types should be distributed — not all making or all research`;
}

/**
 * Build RAG-enhanced skeleton prompt.
 */
export async function buildRAGSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    });
    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback for skeleton context
  let feedbackBlock = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });
    if (profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackBlock = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement
      }
    }
  } catch {
    // Enhancement
  }

  // Prepend teaching context + framework vocabulary + feedback
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkBlock + teachingContextBlock + (feedbackBlock ? "\n\n" + feedbackBlock : "")).trim();
  const ragWithContext = contextPrefix
    ? contextPrefix + "\n\n---\n\n" + (ragContext || "")
    : ragContext || undefined;

  const prompt = buildSkeletonPrompt(input, outline, ragWithContext);
  return { prompt, chunkIds };
}

// =========================================================================
// LESSON TYPE GUIDANCE (HITS-informed structure per Design lesson type)
// =========================================================================

function getLessonTypeGuidance(type: DesignLessonType): string {
  const guidance: Record<DesignLessonType, string> = {
    "research": `
Structure: Mini-lesson (5-10min) → Guided investigation → Independent analysis → Share findings
- Include a content activity to model the analysis technique before students try it
- Core activities should use compare/contrast or structured investigation frameworks
- teacherNotes questions: "What patterns do you notice?", "How does this relate to your user's needs?", "What evidence supports that conclusion?"`,
    "ideation": `
Structure: Stimulus/inspiration (5min) → Divergent thinking (individual, 15-20min) → Convergent (group, 10-15min) → Select/refine
- Start with visual stimulus or constraint introduction — NOT a lecture
- Core activities: sketching, SCAMPER, mind mapping, brainstorming — keep these as LONG activities, don't fragment
- teacherNotes questions: "What if you combined these two ideas?", "What constraint haven't you considered?", "Which idea best meets the user's needs?"`,
    "skills-demo": `
Structure: Safety briefing + Demo — I Do (10-15min) → Guided practice — We Do (10min) → Independent practice — You Do (15-25min)
- The demo/I Do phase is a CONTENT activity (no student response) with safety warnings
- We Do should be scaffolded with checkpoints
- You Do should have clear success criteria and teacher circulation
- teacherNotes questions: "Show me your technique before continuing", "What should you check before the next step?", "What safety precaution applies here?"`,
    "making": `
Structure: Brief safety check (2-3min) → Extended making with teacher circulation (25-40min) → Clean-up (5min) → Quick reflection (5min)
- Making time should be ONE long core activity — do NOT fragment into multiple short activities
- Teacher circulates and gives verbal feedback (include teacherNotes for what to look for)
- Safety considerations are NON-NEGOTIABLE for this lesson type
- teacherNotes questions: "Talk me through your process", "What's your next step and why?", "How does this compare to your plan?"`,
    "testing": `
Structure: Review hypothesis/design intent (5min) → Test/gather data (15-25min) → Record results → Analyse → Plan iteration
- Frame as predict → test → reflect cycle (productive failure built in)
- Include a structured recording template (table, checklist, or rubric)
- teacherNotes questions: "What did you expect to happen?", "What does this result tell you about your design?", "What would you change for the next iteration?"`,
    "critique": `
Structure: Criteria reminder (5min) → Gallery walk OR peer critique protocol (15-20min) → Self-assessment (10min) → Goal-setting (5min)
- Use a structured critique protocol (Two Stars & a Wish, TAG feedback, etc.)
- Include self-assessment against rubric criteria
- teacherNotes questions: "What specific evidence supports that feedback?", "How will you use this feedback in your next iteration?", "What's the strongest aspect of this design?"`,
  };
  return guidance[type] || "";
}

// =========================================================================
// PER-LESSON GENERATION (Stage 2 — uses skeleton context, runs in parallel)
// =========================================================================

/**
 * Build a prompt for generating activities for a SINGLE LESSON,
 * using the full skeleton as context instead of previousActivitiesSummary.
 */
export function buildPerLessonTimelinePrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  options?: {
    ragContext?: string;
    lessonContext?: string;
    activitySummary?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
  }
): string {
  const totalLessons = skeleton.lessons.length;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  // Build a compact skeleton context (~50 tokens per lesson)
  const skeletonContext = skeleton.lessons.map((l) =>
    `  L${String(l.lessonNumber).padStart(2, "0")}: "${l.title}" — ${l.keyQuestion} (${l.estimatedMinutes}m, ${l.phaseLabel}) [${l.criterionTags.join(",")}]`
  ).join("\n");

  // Identify neighboring lessons for continuity
  const prevLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber - 1);
  const nextLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber + 1);

  let continuitySection = "";
  if (prevLesson) {
    continuitySection += `\nPrevious lesson: "${prevLesson.title}" — ${prevLesson.keyQuestion}`;
  }
  if (nextLesson) {
    continuitySection += `\nNext lesson: "${nextLesson.title}" — ${nextLesson.keyQuestion}`;
  }

  // --- HITS Phase 2: Spaced Retrieval Context ---
  // Collect vocab/skills from ALL previous lessons for retrieval warm-ups
  let spacedRetrievalSection = "";
  if (lesson.lessonNumber > 1) {
    const priorLessons = skeleton.lessons.filter((l) => l.lessonNumber < lesson.lessonNumber);
    const allPriorVocab = priorLessons.flatMap((l) => (l.cumulativeVocab || []).map((v) => `${v} (L${String(l.lessonNumber).padStart(2, "0")})`));
    const allPriorSkills = priorLessons.flatMap((l) => (l.cumulativeSkills || []).map((s) => `${s} (L${String(l.lessonNumber).padStart(2, "0")})`));
    if (allPriorVocab.length > 0 || allPriorSkills.length > 0) {
      spacedRetrievalSection = `\n## Spaced Retrieval (d=0.71 — use in warm-up)
The warmup activity MUST include a 3-5 minute retrieval starter that spirals back earlier content.
Pick 2-3 items from previous lessons (prioritise older items for spacing effect):
${allPriorVocab.length > 0 ? `Prior Vocabulary: ${allPriorVocab.join(", ")}` : ""}
${allPriorSkills.length > 0 ? `Prior Skills: ${allPriorSkills.join(", ")}` : ""}
Examples: "Recall the 3 properties of [material] from L02", "Quick-sketch the [technique] you learned last lesson", "Match these terms to their definitions"
Include vocabTerms for NEW vocabulary in this lesson PLUS 2-3 retrieval terms from earlier.`;
    }
  }

  // --- HITS Phase 2: Self-Assessment Prediction ---
  // Detect criterion phase boundaries (last lesson emphasising a criterion before next phase)
  let selfAssessmentSection = "";
  const currentCriteria = lesson.criterionTags || [];
  if (nextLesson) {
    const nextCriteria = nextLesson.criterionTags || [];
    // If this lesson has criteria that the next lesson does NOT — it's a phase boundary
    const exitingCriteria = currentCriteria.filter((c) => !nextCriteria.includes(c));
    if (exitingCriteria.length > 0) {
      selfAssessmentSection = `\n## Self-Assessment Prediction (d=1.44 — highest effect size in Hattie's research)
This is the LAST lesson emphasising Criterion ${exitingCriteria.join(", ")} before the unit moves on.
Include a self-prediction activity (5 min) in the reflection:
- "Look at the Criterion ${exitingCriteria.join("/")} rubric. What level do you think you've achieved? Circle it and write 1 sentence explaining why."
- Use reflectionType "short-response" with reflectionItems that include the prediction prompt
- This is about metacognition — students who predict their own performance learn significantly more`;
    }
  }
  // Also trigger for the FINAL lesson (always a good place for self-assessment)
  if (lesson.lessonNumber === skeleton.lessons.length) {
    selfAssessmentSection = `\n## Self-Assessment Prediction (d=1.44 — highest effect size in Hattie's research)
This is the FINAL lesson. Include a comprehensive self-assessment reflection:
- "For each criterion (${(input.assessmentCriteria || []).join(", ")}), predict your achievement level and explain your evidence."
- Use reflectionType "checklist" or "short-response" with items for each criterion
- Students should compare their predictions to earlier self-assessments (if any)`;
  }

  // --- HITS Phase 2: Compare/Contrast Templates ---
  let compareContrastSection = "";
  if (lesson.lessonType === "research") {
    compareContrastSection = `\n## Compare/Contrast Framework (d=1.61 — Marzano's #1 strategy)
This is a RESEARCH lesson — include a structured comparison activity:
- Use responseType "decision-matrix" or "pmi" for product/solution analysis
- Frame as: "Compare [Product A] and [Product B] across these criteria: [list 3-5 criteria from the design brief]"
- Include a scaffolded comparison template with guided questions:
  * "What design features does each product have?"
  * "How does each feature meet the user's needs?"
  * "What are the strengths and limitations of each approach?"
- This maps directly to Criterion A (Inquiring & Analysing)`;
  }

  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";

  return `${lessonProfileSection}${ragSection}## Unit Skeleton (all ${totalLessons} lessons)
${skeleton.narrativeArc}

${skeletonContext}

## Generate Activities for Lesson ${lesson.lessonNumber}: "${lesson.title}"
Phase: ${lesson.phaseLabel}
Key Question: ${lesson.keyQuestion}
Target Duration: ${lesson.estimatedMinutes} minutes
Criteria: ${lesson.criterionTags.join(", ")}
Activity Hints: ${lesson.activityHints.join("; ")}${lesson.lessonType ? `\nLesson Type: ${lesson.lessonType}${getLessonTypeGuidance(lesson.lessonType)}` : ""}${lesson.learningIntention ? `\nLearning Intention: ${lesson.learningIntention}\nSuccess Criteria: ${(lesson.successCriteria || []).map((sc, i) => `${i + 1}. ${sc}`).join("; ")}` : ""}
${continuitySection}${spacedRetrievalSection}${selfAssessmentSection}${compareContrastSection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Lesson Length: ${input.lessonLengthMinutes} minutes
- Key Concept: ${input.keyConcept}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

${buildDesignTeachingContext(options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes)}

## Generation Target
Generate 3-6 activities totalling approximately ${lesson.estimatedMinutes} minutes.
Include a warmup at the start and a reflection at the end.
Activity IDs should be: L${String(lesson.lessonNumber).padStart(2, "0")}-a1, L${String(lesson.lessonNumber).padStart(2, "0")}-a2, etc.
All activities in this lesson should have phaseLabel: "${lesson.phaseLabel}"

Remember:
- Every activity needs: id, role, title, prompt, durationMinutes
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle (info/warning/tip/context/activity/speaking/practical), media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Set portfolioCapture: true on 1-2 core activities
- Add teacherNotes to at least 2 core activities with: 2-3 circulation questions at different cognitive levels (recall → analysis → evaluation), safety reminders for making/testing lessons, differentiation tips where relevant`;
}

/**
 * Build RAG-enhanced per-lesson prompt.
 */
export async function buildRAGPerLessonPrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null,
  teacherStyleProfile?: TeacherStyleProfile | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // Fall back to hardcoded
  }

  const query = `${input.topic} ${lesson.title} ${lesson.keyQuestion} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    });
    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement
  }

  // Retrieve lesson profiles + aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 2,
    });
    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Enhancement
  }

  // Build teaching context + framework vocabulary
  const teachingContextStr = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkStr = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkStr + teachingContextStr).trim();

  // Prepend context to lesson profiles section, include feedback
  const lessonWithFeedback = lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "");
  const enrichedLessonContext = contextPrefix
    ? contextPrefix + (lessonWithFeedback ? "\n\n---\n\n" + lessonWithFeedback : "")
    : lessonWithFeedback || undefined;

  const prompt = buildPerLessonTimelinePrompt(input, lesson, skeleton, {
    ragContext: ragContext || undefined,
    lessonContext: enrichedLessonContext,
    activitySummary,
    teacherStyleProfile,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// FEEDBACK CONTEXT FORMATTING (Layer 2 — inject teaching experience into prompts)
// =========================================================================

import type { AggregatedLessonFeedback } from "@/types/lesson-intelligence";

/**
 * Format aggregated feedback into a prompt block that teaches the AI
 * about real teaching experience with similar content.
 *
 * This is what makes the AI "get smarter over time" — real classroom
 * data feeds back into generation prompts.
 */
export function formatFeedbackContext(
  feedback: AggregatedLessonFeedback[]
): string {
  if (!feedback || feedback.length === 0) return "";

  const entries = feedback.map((f) => {
    const lines: string[] = [];

    lines.push(`### Teaching Experience (taught ${f.times_taught} time${f.times_taught === 1 ? "" : "s"})`);

    if (f.avg_teacher_rating) {
      lines.push(`- Teacher satisfaction: ${f.avg_teacher_rating.toFixed(1)}/5`);
    }

    if (f.avg_actual_duration_minutes) {
      lines.push(`- Actual duration: ~${Math.round(f.avg_actual_duration_minutes)} minutes`);
    }

    if (f.common_went_well?.length > 0) {
      lines.push(`- What worked well: ${f.common_went_well.slice(0, 3).join("; ")}`);
    }

    if (f.common_to_change?.length > 0) {
      lines.push(`- Suggested improvements: ${f.common_to_change.slice(0, 3).join("; ")}`);
    }

    if (f.common_struggles?.length > 0) {
      lines.push(`- Student struggles: ${f.common_struggles.slice(0, 3).join("; ")}`);
    }

    if (f.timing_reality?.length > 0) {
      const timingIssues = f.timing_reality.filter(
        (t) => Math.abs(t.avg_actual_minutes - t.planned_minutes) > 5
      );
      if (timingIssues.length > 0) {
        const timingNotes = timingIssues.map(
          (t) => `"${t.phase_title}": planned ${t.planned_minutes}m, actual ~${Math.round(t.avg_actual_minutes)}m`
        );
        lines.push(`- Timing reality: ${timingNotes.join("; ")}`);
      }
    }

    if (f.best_conditions?.energy_recommendation) {
      lines.push(`- Energy tip: ${f.best_conditions.energy_recommendation}`);
    }

    if (f.pace_distribution) {
      const total = Object.values(f.pace_distribution).reduce((a, b) => a + b, 0);
      if (total > 0) {
        const justRight = f.pace_distribution["just_right"] || 0;
        const pct = Math.round((justRight / total) * 100);
        if (pct < 60) {
          lines.push(`- Pacing concern: only ${pct}% of students felt pace was "just right"`);
        }
      }
    }

    return lines.join("\n");
  });

  return `## Real Teaching Experience
Teachers who taught similar lessons reported the following insights.
Use this to calibrate timing, difficulty, and activity design.

${entries.join("\n\n")}`;
}
