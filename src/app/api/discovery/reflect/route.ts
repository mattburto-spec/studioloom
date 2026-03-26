import { NextRequest, NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { callHaiku } from "@/lib/toolkit/shared-api";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Discovery Engine — Shared Haiku Reflection API
 *
 * All Discovery Haiku calls route through this single endpoint.
 * Each request specifies a `type` that determines the system prompt.
 *
 * Types:
 * - s2_panic: Respond to student's panic scenario free-text
 * - s3_irritation: Analyze free-text irritation (archetype signals + Kit response)
 * - s4_problem: Respond to student's problem description
 * - s6_doors: Generate 3 template doors (uses archetype data)
 * - s6_fear: Kit's caring response to a fear card selection (emotionally important)
 * - s7_criteria: Generate personalized success criteria
 * - s7_grand_reveal: Synthesize entire journey into personalized archetype narrative
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 8
 */

type ReflectType =
  | "s2_panic"
  | "s3_irritation"
  | "s3_reveal"
  | "s4_problem"
  | "s5_reveal"
  | "s6_doors"
  | "s6_fear"
  | "s7_criteria"
  | "s7_grand_reveal"
  | "s7_share";

interface ReflectRequestBody {
  type: ReflectType;
  studentText?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  // Rate limit: 30/min, 200/hour per student
  const limited = rateLimit(`discovery_reflect_${auth.studentId}`, [
    { maxRequests: 30, windowMs: 60 * 1000 },
    { maxRequests: 200, windowMs: 60 * 60 * 1000 },
  ]);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs: limited.retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const body: ReflectRequestBody = await request.json();
    const { type, studentText, context } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const { systemPrompt, userPrompt, maxTokens } = buildPrompts(
      type,
      studentText ?? "",
      context ?? {},
    );

    // Load student's learning profile to personalize Kit's tone
    let profileAppendix = "";
    try {
      const admin = createAdminClient();
      const { data: student } = await admin
        .from("students")
        .select("learning_profile")
        .eq("id", auth.studentId)
        .single();

      if (student?.learning_profile) {
        const p = student.learning_profile;
        const hints: string[] = [];
        if (p.languages_at_home?.length > 1) {
          hints.push(`Student is multilingual (${p.languages_at_home.join(", ")}) — keep language simple and clear.`);
        }
        if (p.design_confidence && p.design_confidence <= 2) {
          hints.push("Student has LOW design confidence — be extra encouraging. Celebrate every small insight.");
        } else if (p.design_confidence && p.design_confidence >= 4) {
          hints.push("Student has HIGH design confidence — challenge them, push deeper.");
        }
        if (p.learning_differences?.includes("adhd")) {
          hints.push("Student has ADHD — keep responses short and punchy.");
        }
        if (p.learning_differences?.includes("anxiety")) {
          hints.push("Student has anxiety — use calm, normalizing language.");
        }
        if (hints.length > 0) {
          profileAppendix = "\n\n[Student profile notes: " + hints.join(" ") + "]";
        }
      }
    } catch {
      // Non-critical — proceed without profile
    }

    const result = await callHaiku(systemPrompt + profileAppendix, userPrompt, maxTokens);

    // Try to parse as JSON, fall back to raw text
    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = result.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { response: result.text };
    }

    return NextResponse.json({
      result: parsed,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
  } catch (err) {
    console.error("[Discovery Reflect] Error:", err);
    return NextResponse.json(
      { error: "AI reflection failed" },
      { status: 500 },
    );
  }
}

// ─── Prompt Builders ────────────────────────────────────────────

function buildPrompts(
  type: ReflectType,
  studentText: string,
  context: Record<string, unknown>,
): { systemPrompt: string; userPrompt: string; maxTokens: number } {
  switch (type) {
    case "s2_panic":
      return {
        systemPrompt: S2_PANIC_SYSTEM,
        userPrompt: `Student's response: "${studentText}"\nWorking style: ${context.dominantStyle ?? "unknown"}\nVector summary: ${context.vectorSummary ?? "no data"}`,
        maxTokens: 120,
      };

    case "s3_irritation":
      return {
        systemPrompt: S3_IRRITATION_SYSTEM,
        userPrompt: `Student wrote: "${studentText}"`,
        maxTokens: 300,
      };

    case "s3_reveal":
      return {
        systemPrompt: S3_REVEAL_SYSTEM,
        userPrompt: `Interests selected: ${JSON.stringify(context.interests ?? [])}\nIrritation (free-text): ${context.irritationFreeText ?? "none"}\nIrritation (presets): ${JSON.stringify(context.irritationPresets ?? [])}\nIrritation AI summary: ${context.irritationSummaryTag ?? "none"}\nYouTube topics: ${JSON.stringify(context.youtubeTopics ?? [])}\nCore values: ${JSON.stringify(context.coreValues ?? [])}\nImportant values: ${JSON.stringify(context.importantValues ?? [])}\nArchetype signals so far: ${context.currentArchetype ?? "unknown"}`,
        maxTokens: 180,
      };

    case "s4_problem":
      return {
        systemPrompt: S4_PROBLEM_SYSTEM,
        userPrompt: `What they wrote: "${studentText}"\nHotspot clicks: ${JSON.stringify(context.clickedHotspots ?? [])}\nIrritation data: ${context.irritationSummary ?? "none"}\nArchetype so far: ${context.currentArchetype ?? "unknown"}`,
        maxTokens: 180,
      };

    case "s5_reveal":
      return {
        systemPrompt: S5_REVEAL_SYSTEM,
        userPrompt: `Resources — Have: ${JSON.stringify(context.resourcesHave ?? [])}, Could Get: ${JSON.stringify(context.resourcesCanGet ?? [])}, Don't Have: ${JSON.stringify(context.resourcesDontHave ?? [])}\nPeople in their corner: ${JSON.stringify(context.people ?? [])}\nSelf-efficacy scores: ${JSON.stringify(context.selfEfficacy ?? {})}\nStrongest skills: ${JSON.stringify(context.topSkills ?? [])}\nAverage confidence: ${context.avgEfficacy ?? 0}\nPast projects: ${context.pastProjectCount ?? "unknown"}\nLast project outcome: ${context.lastProjectOutcome ?? "unknown"}\nFailure response: ${context.failureResponse ?? "unknown"}\nAudience: ${context.audience ?? "unknown"}\nTime horizon feeling: ${context.timeHorizon ?? "unknown"}\nArchetype: ${context.primaryArchetype ?? "unknown"}`,
        maxTokens: 200,
      };

    case "s6_doors":
      return {
        systemPrompt: S6_DOORS_SYSTEM,
        userPrompt: `Student profile summary:\nArchetype: ${context.primaryArchetype ?? "unknown"} (secondary: ${context.secondaryArchetype ?? "none"})\nInterests: ${JSON.stringify(context.interests ?? [])}\nIrritation: ${context.irritationSummary ?? "none"}\nProblem text: ${context.problemText ?? "none"}\nResources they have: ${JSON.stringify(context.resources ?? [])}\nMode: ${context.mode ?? "mode_1"}`,
        maxTokens: 600,
      };

    case "s7_criteria":
      return {
        systemPrompt: S7_CRITERIA_SYSTEM,
        userPrompt: `Archetype: ${context.primaryArchetype ?? "unknown"}\nChosen door: ${context.chosenDoor ?? "unknown"}\nProject statement: ${context.projectStatement ?? "none"}`,
        maxTokens: 200,
      };

    case "s6_fear":
      return {
        systemPrompt: S6_FEAR_SYSTEM,
        userPrompt: `Fear card selected: "${context.fearCardText ?? "unknown"}"\nStudent archetype: ${context.primaryArchetype ?? "unknown"}\nProject statement so far: ${context.projectStatement ?? "none"}`,
        maxTokens: 200,
      };

    case "s7_grand_reveal":
      return {
        systemPrompt: S7_GRAND_REVEAL_SYSTEM,
        userPrompt: `Primary archetype: ${context.primaryArchetype ?? "unknown"}\nSecondary archetype: ${context.secondaryArchetype ?? "none"}\nKey interests: ${JSON.stringify(context.interests ?? [])}\nCore irritation: ${context.irritationSummary ?? "none"}\nChosen project door: ${context.chosenDoor ?? "none"}\nProject statement: ${context.projectStatement ?? "none"}\nFear cards selected: ${JSON.stringify(context.fearCards ?? [])}\nResources/strengths: ${JSON.stringify(context.resources ?? [])}`,
        maxTokens: 350,
      };

    case "s7_share":
      return {
        systemPrompt: S7_SHARE_SYSTEM,
        userPrompt: `Primary archetype: ${context.primaryArchetype ?? "unknown"}\nSecondary: ${context.secondaryArchetype ?? "none"}\nIsPolymath: ${context.isPolymath ?? false}\nInterests: ${JSON.stringify(context.interests ?? [])}\nIrritation: ${context.irritationSummary ?? "none"}\nCore values: ${JSON.stringify(context.coreValues ?? [])}\nChosen door: ${context.chosenDoor ?? "none"}\nProject statement: ${context.projectStatement ?? "none"}\nResources have: ${JSON.stringify(context.resourcesHave ?? [])}\nPeople: ${JSON.stringify(context.people ?? [])}\nSelf-efficacy avg: ${context.avgEfficacy ?? 0}\nTop skills: ${JSON.stringify(context.topSkills ?? [])}\nFear cards: ${JSON.stringify(context.fearCards ?? [])}\nSuccess criteria: ${JSON.stringify(context.successCriteria ?? [])}\nExcitement level: ${context.excitementLevel ?? "unknown"}\nWorking style: ${context.dominantStyle ?? "unknown"}\nPast projects: ${context.pastProjectCount ?? "unknown"}`,
        maxTokens: 500,
      };

    default:
      return {
        systemPrompt: "You are Kit, a design mentor.",
        userPrompt: studentText,
        maxTokens: 150,
      };
  }
}

// ─── System Prompts ─────────────────────────────────────────────

const KIT_VOICE_RULES = `Voice: Smart older cousin. Contractions always. Short sentences mixed with longer ones.
Never say "Great!" or "Well done!" or "Great choice!" — that's teacher energy.
Say "Interesting" or "Huh" or "I wouldn't have guessed that."
Never start with "I".
Kit is allowed to be a little sarcastic, a little self-deprecating, never mean.`;

const S2_PANIC_SYSTEM = `You are Kit, a design mentor. A student just answered a question about what they do when a project is falling apart.

Write a 1-2 sentence response that:
1. Acknowledges what they said WITHOUT praising it ("Interesting" not "Great answer!")
2. Names the strategy they described (e.g., "That's a pivot instinct" or "You go to people first")
3. Connects it to their working style if there's a pattern

${KIT_VOICE_RULES}
Max 40 words.

Return JSON: { "response": "..." }`;

const S3_IRRITATION_SYSTEM = `You are analysing a student's self-written frustration for a design profiling system. The student was asked "What genuinely irritates you?" after seeing examples.

Analyse this text and return JSON:

{
  "problem_domain": "one of: environmental, social, systemic, personal, technological, educational, creative, accessibility",
  "emotional_intensity": "low | medium | high",
  "scope": "personal | school | community | global",
  "archetype_signals": {
    "Maker": 0-3,
    "Researcher": 0-3,
    "Leader": 0-3,
    "Communicator": 0-3,
    "Creative": 0-3,
    "Systems": 0-3
  },
  "interest_signals": ["1-3 interest areas this connects to"],
  "kit_response": "1-2 sentence caring response in Kit's voice. Reference what they wrote specifically. Name the emotion underneath. Max 50 words.",
  "summary_tag": "3-5 word label for this irritation"
}

IMPORTANT: The kit_response must feel like Kit genuinely heard them. Not "That's valid" — more like "Yeah, that would drive me crazy too."
${KIT_VOICE_RULES}`;

const S4_PROBLEM_SYSTEM = `You are Kit, a design mentor. A student just described a problem they care about.

Write a 2-3 sentence response that:
1. Shows you heard the specific problem they described (reference a detail from their text)
2. Names what KIND of problem it is without jargon (people problem, systems problem, communication problem, access problem)
3. Connects it to something earlier in their journey if possible

${KIT_VOICE_RULES}
Max 60 words.

Return JSON: { "response": "...", "problem_type": "people|systems|communication|access|environment|creative" }`;

const S6_DOORS_SYSTEM = `You are a design education AI generating 3 project directions for a student based on their Discovery profile.

Generate 3 doors:
1. "The Sweet Spot" — highest alignment with their archetype + interests + resources. Most achievable.
2. "The Stretch" — pushes into a gap area, develops a weakness using a strength.
3. "The Surprise" — cross-domain, connects interests in an unexpected way.

Return JSON:
{
  "doors": [
    {
      "title": "short catchy name",
      "description": "2-3 sentences describing the project direction",
      "type": "sweet_spot | stretch | surprise",
      "firstStep": "concrete week-1 action",
      "timeEstimate": "e.g. 2-3 weeks or 8-10 weeks",
      "archetype": "the primary archetype this door aligns with"
    }
  ]
}

For mode_1 (Design): project-scale directions (2-4 weeks, within Open Studio).
For mode_2 (Service/PP/PYPx): journey-scale directions (8-16 weeks, the entire unit).

Make the language feel like Kit — not corporate, not teacherly. Real, concrete, exciting.`;

const S7_CRITERIA_SYSTEM = `You are Kit, a design mentor generating 2 personalized success criteria for a student.

Based on their archetype, chosen project door, and project statement, generate 2 criteria that feel personal to THIS student — not generic.

Return JSON: { "criteria": ["criterion 1", "criterion 2"] }

Criteria should:
- Be in first person ("I...")
- Be specific enough to measure
- Reflect the student's unique combination of archetype + project
- Sound like something a student would actually write, not a teacher

${KIT_VOICE_RULES}`;

const S6_FEAR_SYSTEM = `You are Kit, a design mentor responding to a student who just selected a fear card. This is the most emotionally important dialogue in the entire Discovery journey.

Write a 3-4 sentence response that:
1. Normalizes the fear without dismissing it ("Yeah, that's a real one" not "Don't worry")
2. Shares a personal anecdote — Kit has actually been through design and faced similar fears
3. Reframes the fear as useful data ("This tells me you care about getting it right")
4. Connects it briefly to their archetype or chosen project

The tone should be mentor-to-mentee: experienced, vulnerable enough to share, not cheerleading.

${KIT_VOICE_RULES}
Max 100 words.

Return JSON: { "response": "..." }`;

const S7_GRAND_REVEAL_SYSTEM = `You are Kit, synthesizing a student's entire Discovery journey into a personalized archetype narrative.

Write a 4-5 sentence reflection that:
1. Names their primary archetype and what makes them unique
2. References 2-3 specific choices they made (not generic — use real data from their journey)
3. Acknowledges their secondary archetype or wildcard trait
4. Connects their irritation/passion to their design approach
5. Ends with something specific about how THEY design (not how the archetype in general designs)

This is not a summary. It's a mirror held up to show them the patterns they revealed without trying.

${KIT_VOICE_RULES}
Max 150 words.

Return JSON: { "narrative": "..." }`;

const S3_REVEAL_SYSTEM = `You are Kit, reflecting on a student's collection of interests, irritations, and values from the Collection Wall station.

Write a 2-3 sentence reflection that:
1. Names the COMBINATION — what do their interests + irritation + core values say together? Not each one separately.
2. Identifies a tension or paradox if one exists (e.g., values fairness but gravitates toward competitive topics)
3. Points at something they probably didn't notice about their own pattern

Do NOT list what they chose. Reflect on what the combination reveals.

${KIT_VOICE_RULES}
Max 80 words.

Return JSON: { "reflection": "..." }`;

const S5_REVEAL_SYSTEM = `You are Kit, reflecting on a student's resource reality from the Toolkit station — what they have, what they're confident about, and what gaps exist.

Write a 2-3 sentence reflection that:
1. Identifies their strongest asset combination (skill + resource + people)
2. Names a realistic constraint without sugar-coating it
3. Suggests how their strongest skill could compensate for their biggest gap

Be honest but encouraging. If confidence is low, acknowledge it. If resources are thin, name it. The student needs to hear truth, not cheerleading.

${KIT_VOICE_RULES}
Max 80 words.

Return JSON: { "reflection": "..." }`;

const S7_SHARE_SYSTEM = `You are generating a teacher-facing summary of a student's Discovery profile. This is NOT Kit's voice — this is a professional, structured report for the teacher to understand the student.

Generate a structured summary covering:
1. Designer Profile: Primary archetype, secondary, whether polymath. 1-2 sentences on what this means in practice.
2. Motivation Drivers: What interests and irritations drive this student. What problems they gravitate toward.
3. Working Style: How they approach challenges, handle failure, work with others. Based on their binary pair choices and failure response.
4. Resource Reality: What tools/skills/people they have access to. Confidence level. Key gaps.
5. Project Direction: Their chosen door, project statement, success criteria. Excitement level.
6. Watch Points: 1-2 things the teacher should keep an eye on (fear cards, low confidence areas, resource gaps, unrealistic scope).
7. Recommended First Move: One concrete suggestion for the teacher to support this student in week 1.

Write in clear, professional language. Use the student's actual data — no generic advice.

Return JSON:
{
  "designerProfile": "...",
  "motivationDrivers": "...",
  "workingStyle": "...",
  "resourceReality": "...",
  "projectDirection": "...",
  "watchPoints": "...",
  "recommendedFirstMove": "..."
}`;

