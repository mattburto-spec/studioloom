import { getGradeTimingProfile } from "@/lib/ai/prompts";

/**
 * Post-Generation Quality Evaluator (Layer 4)
 *
 * Scores generated activities against 10 design pedagogy principles.
 * Uses a fast, cheap Haiku call (~2s) to validate quality before
 * the teacher sees the output.
 *
 * Principles from design-pedagogy.md:
 * 1. Iteration — students must revise/improve, not just produce once
 * 2. Productive failure — safe spaces to fail + reflect on failure
 * 3. Diverge before converge — brainstorm before narrowing
 * 4. Scaffolding fade — support decreases as unit progresses
 * 5. Process assessment — assess the journey, not just the product
 * 6. Critique culture — peer/self feedback embedded
 * 7. Digital + physical balance — mix of CAD/digital and hands-on
 * 8. Differentiation — ELL scaffolding, extension, multiple entry points
 * 9. Metacognitive framing — reflection on thinking and learning process
 * 10. Safety culture — safety awareness woven in, not bolted on
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TimelineActivity } from "@/types";
import type { QualityReport, PrincipleScore, PedagogyPrinciple } from "@/types/lesson-intelligence";

const QUALITY_EVALUATION_PROMPT = `You are a design education quality evaluator. Score these generated activities against 10 pedagogy principles.

## The 10 Principles
1. **iteration** — Do students get to revise/improve their work based on feedback or testing? (Not just "do it once")
2. **productive_failure** — Are there moments where students can safely fail, experiment, or make mistakes? Is failure framed positively?
3. **diverge_converge** — Do students brainstorm/explore BEFORE narrowing down? (Divergent thinking before convergent)
4. **scaffolding_fade** — Does support decrease as the unit progresses? Early activities should scaffold more than later ones.
5. **process_assessment** — Is the design process assessed, not just the final product? Portfolio captures, reflections, documentation?
6. **critique_culture** — Is peer feedback, self-assessment, or structured critique embedded?
7. **digital_physical_balance** — Is there a mix of digital tools and physical/hands-on making?
8. **differentiation** — Are ELL scaffolds present? Extension activities? Multiple ways to engage?
9. **metacognitive_framing** — Do students reflect on HOW they're thinking and learning, not just WHAT?
10. **safety_culture** — Are safety considerations woven in naturally (not just a single safety slide)?

## Scoring
For each principle, output:
- score: 0-10 (0 = completely absent, 5 = present but weak, 10 = excellently embedded)
- present: true/false (is it addressed at all?)
- issue: what's wrong (only if score < 7)
- suggestion: concrete fix (only if score < 7)

Also output:
- warnings: things the teacher should review (yellow flags)
- criticalIssues: things that should not ship as-is (red flags, e.g., no iteration at all, no safety mentions for a workshop unit)

## Output Format
Return ONLY valid JSON:
{
  "principleScores": [
    { "principle": "iteration", "score": 8, "present": true },
    { "principle": "productive_failure", "score": 3, "present": true, "issue": "Failure is not framed positively", "suggestion": "Add a reflection after the testing phase that asks students what they learned from what didn't work" }
  ],
  "warnings": ["No video media included — consider adding a demo video for the making phase"],
  "criticalIssues": []
}`;

interface UnitContext {
  topic?: string;
  gradeLevel?: string;
  endGoal?: string;
  lessonLengthMinutes?: number;
  totalLessons?: number;
  /** How many lessons' worth of activities are being evaluated (defaults to totalLessons) */
  lessonsInBatch?: number;
}

/**
 * Evaluate generated timeline activities against 10 pedagogy principles.
 * Uses Claude Haiku for fast, cheap evaluation (~2s, ~$0.001).
 *
 * Returns a QualityReport. Fails gracefully — returns a default report
 * if the API call fails (quality evaluation should never block generation).
 */
export async function evaluateTimelineQuality(
  activities: TimelineActivity[],
  context: UnitContext,
  apiKey?: string
): Promise<QualityReport> {
  // Pre-compute some stats we can check without AI
  const portfolioCaptureCount = activities.filter(
    (a) => a.portfolioCapture
  ).length;

  const totalMinutes = activities.reduce(
    (sum, a) => sum + (a.durationMinutes || 0),
    0
  );

  const expectedMinutes = (context.lessonLengthMinutes || 50) * (context.lessonsInBatch || context.totalLessons || 1);

  // Build a compact summary for the AI (keep token count low)
  const activitySummary = activities.map((a, i) => {
    const parts = [
      `${i + 1}. [${a.role}] "${a.title}" (${a.durationMinutes}m)`,
      a.responseType ? `response: ${a.responseType}` : "content-only",
      a.criterionTags?.length ? `criteria: ${a.criterionTags.join(",")}` : "",
      a.portfolioCapture ? "📸 portfolio" : "",
      a.media ? `media: ${a.media.type}` : "",
      a.contentStyle ? `style: ${a.contentStyle}` : "",
      a.scaffolding ? "has scaffolding" : "",
    ].filter(Boolean);
    return parts.join(" | ");
  }).join("\n");

  const timingProfile = getGradeTimingProfile(context.gradeLevel || "Year 3 (Grade 8)");

  const userPrompt = `## Unit Context
Topic: ${context.topic || "unknown"}
Grade: ${context.gradeLevel || "unknown"}
End Goal: ${context.endGoal || "unknown"}
Total Duration: ${totalMinutes}m across ${context.totalLessons || "?"} lessons
Age-Appropriate Timing: Reading/writing/analysis ≤${timingProfile.maxHighCognitiveMinutes}min, Hands-on/making ≤${timingProfile.maxHandsOnMinutes}min, Discussion/collaboration ≤${timingProfile.maxCollaborativeMinutes}min. ${timingProfile.pacingNote}

## Generated Activities (${activities.length} total)
${activitySummary}

Evaluate these activities against all 10 principles. Be honest but constructive.`;

  // If no API key, return a structural-only report
  if (!apiKey) {
    return buildStructuralReport(activities, portfolioCaptureCount, totalMinutes, expectedMinutes, context.gradeLevel);
  }

  try {
    const client = new Anthropic({ apiKey, maxRetries: 1 });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      system: QUALITY_EVALUATION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return buildStructuralReport(activities, portfolioCaptureCount, totalMinutes, expectedMinutes, context.gradeLevel);
    }

    // Parse JSON from response — extract JSON object even if AI adds trailing text
    let cleaned = textBlock.text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Find the outermost JSON object boundaries
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let lastBrace = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { lastBrace = i; break; }
        }
      }
      if (lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(cleaned) as {
      principleScores: PrincipleScore[];
      warnings: string[];
      criticalIssues: string[];
    };

    // Validate principle scores
    const validPrinciples: PedagogyPrinciple[] = [
      "iteration", "productive_failure", "diverge_converge", "scaffolding_fade",
      "process_assessment", "critique_culture", "digital_physical_balance",
      "differentiation", "metacognitive_framing", "safety_culture",
    ];

    const scores = (parsed.principleScores || []).filter(
      (s) => validPrinciples.includes(s.principle as PedagogyPrinciple)
    );

    // Compute overall score (average of all principle scores, scaled to 100)
    const overallScore = scores.length > 0
      ? Math.round((scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length) * 10)
      : 50;

    return {
      overallScore,
      principleScores: scores,
      warnings: parsed.warnings || [],
      criticalIssues: parsed.criticalIssues || [],
      timingAnalysis: {
        totalMinutes,
        expectedMinutes,
        variance: expectedMinutes > 0
          ? Math.round(((totalMinutes - expectedMinutes) / expectedMinutes) * 100)
          : 0,
      },
      portfolioCaptureCount,
      evaluatedAt: new Date().toISOString(),
      modelVersion: "claude-haiku-4-5",
    };
  } catch (err) {
    console.warn("[quality-evaluator] AI evaluation failed, returning structural report:", err);
    return buildStructuralReport(activities, portfolioCaptureCount, totalMinutes, expectedMinutes, context.gradeLevel);
  }
}

/**
 * Build a structural-only quality report without AI.
 * Used as fallback when API is unavailable or fails.
 */
function buildStructuralReport(
  activities: TimelineActivity[],
  portfolioCaptureCount: number,
  totalMinutes: number,
  expectedMinutes: number,
  gradeLevel?: string
): QualityReport {
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Check for reflection activities
  const hasReflection = activities.some((a) => a.role === "reflection");
  if (!hasReflection) {
    warnings.push("No reflection activities found — students should reflect on their learning");
  }

  // Check for warmup
  const hasWarmup = activities.some((a) => a.role === "warmup");
  if (!hasWarmup) {
    warnings.push("No warmup activities — lessons should start with vocab or engagement hooks");
  }

  // Check portfolio captures
  if (portfolioCaptureCount === 0) {
    warnings.push("No portfolio capture points — students need evidence of their process");
  }

  // Check timing variance
  const variance = expectedMinutes > 0
    ? Math.round(((totalMinutes - expectedMinutes) / expectedMinutes) * 100)
    : 0;
  if (Math.abs(variance) > 20) {
    warnings.push(
      `Timing mismatch: activities total ${totalMinutes}m but expected ~${expectedMinutes}m (${variance > 0 ? "+" : ""}${variance}%)`
    );
  }

  // Check age-appropriate activity durations by cognitive demand
  const timingProfile = getGradeTimingProfile(gradeLevel || "Year 3 (Grade 8)");
  const coreActivities = activities.filter((a) => a.role === "core");

  // Classify activities by cognitive demand using responseType as proxy
  const highCognitiveTypes = new Set(["text", "decision-matrix", "pmi", "pairwise", "trade-off-sliders"]);
  const handsOnTypes = new Set(["upload", "voice"]);

  const overLongActivities: string[] = [];
  for (const a of coreActivities) {
    const dur = a.durationMinutes || 0;
    let maxForType: number;
    if (a.responseType && handsOnTypes.has(a.responseType)) {
      maxForType = timingProfile.maxHandsOnMinutes;
    } else if (a.responseType && highCognitiveTypes.has(a.responseType)) {
      maxForType = timingProfile.maxHighCognitiveMinutes;
    } else {
      // Default: use collaborative limit as middle ground
      maxForType = timingProfile.maxCollaborativeMinutes;
    }
    if (dur > maxForType) {
      overLongActivities.push(`"${a.title}" (${dur}m, max ${maxForType}m for this activity type)`);
    }
  }
  if (overLongActivities.length > 0) {
    warnings.push(
      `${overLongActivities.length} activit${overLongActivities.length === 1 ? "y exceeds" : "ies exceed"} age-appropriate duration for MYP Year ${timingProfile.mypYear}: ${overLongActivities.join("; ")}`
    );
  }

  // Check ELL scaffolding
  const scaffoldedCount = coreActivities.filter((a) => a.scaffolding?.ell1 || a.scaffolding?.ell2).length;
  if (coreActivities.length > 0 && scaffoldedCount < coreActivities.length * 0.5) {
    warnings.push("Less than half of core activities have ELL scaffolding");
  }

  // Check: teacher notes / questioning prompts present
  const teacherNotesCount = activities.filter((a) => a.teacherNotes).length;
  if (teacherNotesCount === 0) {
    warnings.push("No teacher notes or questioning prompts found — add circulation questions for at least 2 core activities");
  }

  // Check: safety mentions for making/testing activities
  const hasMakingActivities = activities.some((a) =>
    a.role === "core" && (
      a.responseType === "upload" ||
      a.prompt?.toLowerCase().includes("make") ||
      a.prompt?.toLowerCase().includes("build") ||
      a.prompt?.toLowerCase().includes("prototype") ||
      a.prompt?.toLowerCase().includes("test")
    )
  );
  const hasSafetyMention = activities.some((a) =>
    a.teacherNotes?.toLowerCase().includes("safety") ||
    a.contentStyle === "warning" ||
    a.prompt?.toLowerCase().includes("safety")
  );
  if (hasMakingActivities && !hasSafetyMention) {
    warnings.push("Making/testing activities detected but no safety mentions — add safety reminders in teacher notes");
  }

  return {
    overallScore: 50, // Unknown — can't evaluate without AI
    principleScores: [],
    warnings,
    criticalIssues,
    timingAnalysis: {
      totalMinutes,
      expectedMinutes,
      variance,
    },
    portfolioCaptureCount,
    evaluatedAt: new Date().toISOString(),
    modelVersion: "structural-only",
  };
}
