/**
 * Extract lesson structure from a document using AI analysis.
 *
 * Takes raw extracted document text and uses Claude Sonnet to identify
 * individual lessons, activities, timing, materials, and learning objectives.
 * This is the key "intelligence" step between raw extraction and skeleton building.
 */

export interface ExtractedActivity {
  description: string;
  type: "discussion" | "research" | "practical" | "presentation" | "assessment" | "reflection" | "other";
  estimatedMinutes: number;
  materials?: string[];
}

export interface ExtractedLesson {
  title: string;
  lessonNumber: number;
  estimatedMinutes: number;
  learningObjective: string;
  activities: ExtractedActivity[];
  criterionTags: string[];
  materials: string[];
  differentiation?: string;
  assessmentNotes?: string;
}

export interface LessonStructureExtraction {
  unitTopic: string;
  gradeLevel: string;
  subjectArea: string;
  totalLessons: number;
  lessons: ExtractedLesson[];
  overallObjective?: string;
  assessmentMethods?: string[];
}

const EXTRACTION_SYSTEM_PROMPT = `You are analysing a teacher's existing lesson plan document to extract its structure.

Your job is to identify the individual lessons, activities, timing, and learning objectives — preserving the teacher's language and intent.

Rules:
- Do NOT invent activities that aren't in the document
- If timing isn't specified, estimate based on activity descriptions and typical lesson pacing
- Preserve the teacher's exact activity descriptions where possible
- If the document contains a single lesson, return an array with one lesson
- If the document is a unit plan with multiple lessons, identify each lesson boundary
- Map activities to the closest type: discussion, research, practical, presentation, assessment, reflection, or other
- For criterion tags, infer from learning objectives: investigation/research → A, development/planning → B, creating/making → C, evaluation/reflection → D
- If grade level isn't stated, estimate from content complexity and vocabulary

Return ONLY valid JSON matching the specified structure. No markdown, no explanation.`;

function buildExtractionPrompt(rawText: string, filename: string): string {
  // Truncate to ~8000 chars to stay within context budget while preserving most content
  const text = rawText.length > 8000
    ? rawText.slice(0, 8000) + "\n\n[... document truncated ...]"
    : rawText;

  return `Analyse this teacher's lesson plan document and extract the structure.

FILENAME: ${filename}

DOCUMENT TEXT:
---
${text}
---

Return a JSON object with this exact structure:
{
  "unitTopic": "string — overall topic/theme",
  "gradeLevel": "string — e.g. 'Year 9', 'Grade 7', 'MYP 4'",
  "subjectArea": "string — e.g. 'Design', 'Technology', 'D&T'",
  "totalLessons": number,
  "overallObjective": "string — unit-level learning objective if stated",
  "assessmentMethods": ["string array — any assessment methods mentioned"],
  "lessons": [
    {
      "title": "string — lesson title from the document",
      "lessonNumber": number,
      "estimatedMinutes": number,
      "learningObjective": "string — what students will learn/do",
      "activities": [
        {
          "description": "string — the teacher's activity description",
          "type": "discussion|research|practical|presentation|assessment|reflection|other",
          "estimatedMinutes": number,
          "materials": ["optional string array"]
        }
      ],
      "criterionTags": ["A", "B", "C", "D" — inferred from objectives/activities],
      "materials": ["string array — materials needed for this lesson"],
      "differentiation": "string or null — any differentiation/scaffolding mentioned",
      "assessmentNotes": "string or null — any assessment notes for this lesson"
    }
  ]
}`;
}

/**
 * Use AI to extract lesson structure from document text.
 * Uses Sonnet for accuracy — this is a one-time import operation.
 */
export async function extractLessonStructure(
  rawText: string,
  filename: string
): Promise<LessonStructureExtraction> {
  const prompt = buildExtractionPrompt(rawText, filename);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lesson structure extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    console.error("[extractLessonStructure] No JSON in response:", text.slice(0, 500));
    throw new Error("AI did not return valid JSON for lesson structure extraction");
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as LessonStructureExtraction;

    // Validate minimum structure
    if (!parsed.lessons || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
      throw new Error("Extraction returned no lessons");
    }

    // Ensure lesson numbers are sequential
    parsed.lessons.forEach((lesson, i) => {
      lesson.lessonNumber = i + 1;
    });

    parsed.totalLessons = parsed.lessons.length;

    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("[extractLessonStructure] JSON parse error:", jsonMatch[1].slice(0, 500));
      throw new Error("AI returned malformed JSON for lesson structure");
    }
    throw err;
  }
}
