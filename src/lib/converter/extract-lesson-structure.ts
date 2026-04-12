/**
 * Extract lesson structure from a document using AI analysis.
 *
 * v2.0 — Enhanced with:
 * - Framework-aware extraction (VCAA, MYP, GCSE, ACARA, etc.)
 * - Table structure detection (Stage A) before content extraction
 * - Duration extraction from document headers
 * - Resource URL preservation per lesson
 * - Rubric/assessment extraction
 * - Differentiation column detection
 * - Handles merged weeks, double periods, non-standard layouts
 *
 * Two-stage AI pipeline:
 *   Stage A (Haiku, cheap): Detect document layout — table structure, columns, merged rows
 *   Stage B (Sonnet, accurate): Extract full lesson content with layout context
 */

import { detectFramework, buildFrameworkContextForExtraction, type FrameworkDetection } from "./detect-framework";
import { MODELS } from "@/lib/ai/models";

/* ─── Types ─── */

export interface ExtractedActivity {
  description: string;
  type: "discussion" | "research" | "practical" | "presentation" | "assessment" | "reflection" | "other";
  estimatedMinutes: number;
  materials?: string[];
}

export interface ExtractedResource {
  url: string;
  /** Title or description of the resource (from link text or inferred) */
  title: string;
  /** Which lesson number this appeared in (0 = unit-level) */
  lessonNumber: number;
  /** Type hint: video, worksheet, website, image, reference */
  type: "video" | "worksheet" | "website" | "image" | "reference" | "other";
}

export interface ExtractedRubric {
  /** Name of the rubric criterion (e.g., "Design Folio Ideas", "Practical Project") */
  criterionName: string;
  /** Achievement levels from lowest to highest */
  levels: Array<{
    label: string;
    description: string;
  }>;
}

export interface ExtractedLesson {
  title: string;
  lessonNumber: number;
  estimatedMinutes: number;
  learningObjective: string;
  activities: ExtractedActivity[];
  /** Framework-appropriate tags — MYP: ["A","B"], VCAA: ["KU","P&P"], GCSE: ["AO1","AO2"] */
  criterionTags: string[];
  materials: string[];
  differentiation?: string;
  assessmentNotes?: string;
  /** URLs found in this lesson's content */
  resources: ExtractedResource[];
  /** Week number(s) this lesson belongs to */
  weekNumbers: number[];
  /** Whether this is a double period */
  isDoublePeriod: boolean;
}

export interface DocumentLayout {
  /** Type of layout detected */
  type: "week-lesson-grid" | "sequential-lessons" | "single-lesson" | "narrative" | "unknown";
  /** Column headers if table detected */
  columns: string[];
  /** What each column represents */
  columnMeaning: Record<string, string>;
  /** Number of weeks in the plan */
  weekCount: number;
  /** Typical lessons per week */
  lessonsPerWeek: number;
  /** Merged/combined weeks (e.g., ["3&4"]) */
  mergedWeeks: string[];
  /** Total lessons detected */
  totalLessons: number;
  /** Per-lesson duration if stated in header */
  lessonDurationMinutes: number | null;
  /** Whether there's a differentiation column */
  hasDifferentiationColumn: boolean;
  /** Raw header metadata text (first ~500 chars before the lesson table) */
  headerMetadata: string;
}

export interface LessonStructureExtraction {
  unitTopic: string;
  gradeLevel: string;
  subjectArea: string;
  totalLessons: number;
  lessons: ExtractedLesson[];
  overallObjective?: string;
  assessmentMethods?: string[];
  /** Detected framework */
  framework: FrameworkDetection;
  /** Detected document layout */
  layout: DocumentLayout;
  /** All resources found across the document */
  resources: ExtractedResource[];
  /** Rubric tables found */
  rubrics: ExtractedRubric[];
  /** Per-lesson duration from header (e.g., 72 minutes) */
  lessonDurationMinutes: number | null;
  /** Total duration (e.g., "4 weeks") */
  totalDuration?: string;
}

/* ─── Pre-extraction: extract metadata from document header ─── */

interface HeaderMetadata {
  lessonDurationMinutes: number | null;
  totalLessons: number | null;
  totalDuration: string | null;
  gradeLevel: string | null;
  subject: string | null;
  topic: string | null;
}

function extractHeaderMetadata(text: string): HeaderMetadata {
  // Look in first 1500 chars for header information
  const header = text.slice(0, 1500);

  const result: HeaderMetadata = {
    lessonDurationMinutes: null,
    totalLessons: null,
    totalDuration: null,
    gradeLevel: null,
    subject: null,
    topic: null,
  };

  // Duration patterns: "12 x 72 minute lessons", "10 × 50 min periods", "8 lessons (60 min each)"
  const durationPatterns = [
    /(\d+)\s*[x×]\s*(\d+)\s*(?:minute|min)\s*(?:lesson|period|session)/i,
    /(\d+)\s*(?:lesson|period|session)s?\s*[x×]\s*(\d+)\s*(?:minute|min)/i,
    /(\d+)\s*(?:lesson|period|session)s?\s*\((\d+)\s*(?:minute|min)s?\s*(?:each)?\)/i,
    /Duration:\s*(\d+)\s*(?:week|wk)s?\s*\((\d+)\s*[x×]\s*(\d+)\s*(?:minute|min)/i,
  ];

  for (const pattern of durationPatterns) {
    const match = header.match(pattern);
    if (match) {
      if (match[3]) {
        // Duration: X weeks (Y x Z min)
        result.totalLessons = parseInt(match[2]);
        result.lessonDurationMinutes = parseInt(match[3]);
        result.totalDuration = `${match[1]} weeks`;
      } else {
        result.totalLessons = parseInt(match[1]);
        result.lessonDurationMinutes = parseInt(match[2]);
      }
      break;
    }
  }

  // Fallback: standalone "72 minute" or "50-min" near "lesson" or "period"
  if (!result.lessonDurationMinutes) {
    const fallback = header.match(/(\d{2,3})\s*[-–]?\s*(?:minute|min)\s*(?:lesson|period|session)/i);
    if (fallback) {
      result.lessonDurationMinutes = parseInt(fallback[1]);
    }
  }

  // Weeks: "4 weeks", "Duration: 6 weeks"
  if (!result.totalDuration) {
    const weeksMatch = header.match(/(\d+)\s*weeks?\b/i);
    if (weeksMatch) {
      result.totalDuration = `${weeksMatch[1]} weeks`;
    }
  }

  // Grade level: "Year 10", "Grade 7", "MYP 4", "Year 9-10"
  const gradeMatch = header.match(/(?:Year|Grade|MYP)\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if (gradeMatch) {
    result.gradeLevel = gradeMatch[0];
  }

  // Subject: "Product Design", "Design & Technology", "Food Technology"
  const subjectMatch = header.match(/(?:Technology\s+Context|Subject|Course|Program):\s*(.+?)(?:\||$)/im);
  if (subjectMatch) {
    result.subject = subjectMatch[1].trim();
  }

  // Topic: "Unit Title: Biomimicry", "Topic: Sustainable Design"
  const topicMatch = header.match(/(?:Unit\s+Title|Topic|Theme|Focus):\s*(.+?)(?:\||$)/im);
  if (topicMatch) {
    result.topic = topicMatch[1].trim();
  }

  return result;
}

/* ─── Pre-extraction: extract all URLs from document ─── */

function extractAllUrls(text: string): Array<{ url: string; context: string }> {
  const urlPattern = /https?:\/\/[^\s\]|)>"',]+/g;
  const urls: Array<{ url: string; context: string }> = [];
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?)]+$/, ""); // Strip trailing punctuation
    // Get surrounding context (30 chars before)
    const start = Math.max(0, match.index - 60);
    const context = text.slice(start, match.index).trim();
    urls.push({ url, context });
  }

  return urls;
}

function classifyUrl(url: string): ExtractedResource["type"] {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("clickview") || lower.includes("vimeo")) return "video";
  if (lower.includes("pinterest") || lower.includes("unsplash") || lower.includes("flickr")) return "image";
  if (lower.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/)) return "worksheet";
  if (lower.includes("wordpress") || lower.includes(".pdf")) return "worksheet";
  return "website";
}

/* ─── Stage A: Document layout detection (cheap Haiku call) ─── */

const LAYOUT_DETECTION_PROMPT = `You are analysing the STRUCTURE (not content) of a teacher's lesson plan document.

Look at the text and determine:
1. Is the main lesson content in a TABLE or written as sequential paragraphs?
2. If a table: what are the column headers? What does each column represent?
3. Are any weeks merged/combined in a single row?
4. Is there a differentiation column?
5. How many total lessons are described?

Return ONLY valid JSON:
{
  "type": "week-lesson-grid" | "sequential-lessons" | "single-lesson" | "narrative",
  "columns": ["string array of column headers"],
  "columnMeaning": {"column name": "what it represents"},
  "weekCount": number,
  "lessonsPerWeek": number,
  "mergedWeeks": ["3&4", ...],
  "totalLessons": number,
  "hasDifferentiationColumn": boolean
}`;

async function detectDocumentLayout(text: string): Promise<DocumentLayout> {
  // First try to detect tables via pipe characters (pandoc table format)
  const hasTables = text.includes("+--") || text.includes("|") && text.split("|").length > 20;

  if (!hasTables) {
    // No tables — likely sequential lesson descriptions
    return {
      type: "sequential-lessons",
      columns: [],
      columnMeaning: {},
      weekCount: 0,
      lessonsPerWeek: 0,
      mergedWeeks: [],
      totalLessons: 0,
      lessonDurationMinutes: null,
      hasDifferentiationColumn: false,
      headerMetadata: text.slice(0, 500),
    };
  }

  // Use Haiku to interpret the table structure (cheaper than Sonnet)
  const tablePreview = text.slice(0, 3000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        max_tokens: 1024,
        system: LAYOUT_DETECTION_PROMPT,
        messages: [{
          role: "user",
          content: `Analyse this document structure:\n\n${tablePreview}`,
        }],
      }),
    });

    if (!response.ok) {
      console.warn("[detectDocumentLayout] Haiku call failed, using fallback");
      return buildFallbackLayout(text);
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.type === "text" ? data.content[0].text : "";

    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      responseText.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
      return buildFallbackLayout(text);
    }

    const parsed = JSON.parse(jsonMatch[1]);

    return {
      type: parsed.type || "unknown",
      columns: parsed.columns || [],
      columnMeaning: parsed.columnMeaning || {},
      weekCount: parsed.weekCount || 0,
      lessonsPerWeek: parsed.lessonsPerWeek || 0,
      mergedWeeks: parsed.mergedWeeks || [],
      totalLessons: parsed.totalLessons || 0,
      lessonDurationMinutes: null,
      hasDifferentiationColumn: parsed.hasDifferentiationColumn || false,
      headerMetadata: text.slice(0, 500),
    };
  } catch (err) {
    console.warn("[detectDocumentLayout] Error:", err);
    return buildFallbackLayout(text);
  }
}

function buildFallbackLayout(text: string): DocumentLayout {
  // Simple heuristic: count "Lesson" or "Week" occurrences
  const weekMatches = text.match(/\bWeek\s+\d/gi) || [];
  const lessonMatches = text.match(/\bLesson\s+\d/gi) || [];

  return {
    type: weekMatches.length > 0 ? "week-lesson-grid" : "sequential-lessons",
    columns: [],
    columnMeaning: {},
    weekCount: weekMatches.length,
    lessonsPerWeek: lessonMatches.length > 0 && weekMatches.length > 0
      ? Math.ceil(lessonMatches.length / weekMatches.length)
      : 0,
    mergedWeeks: [],
    totalLessons: lessonMatches.length || 0,
    lessonDurationMinutes: null,
    hasDifferentiationColumn: /differentiat/i.test(text.slice(0, 3000)),
    headerMetadata: text.slice(0, 500),
  };
}

/* ─── Stage B: Full extraction with layout + framework context ─── */

function buildExtractionSystemPrompt(
  framework: FrameworkDetection,
  layout: DocumentLayout,
  headerMeta: HeaderMetadata,
): string {
  const frameworkContext = buildFrameworkContextForExtraction(framework);

  const layoutContext = layout.type === "week-lesson-grid"
    ? `DOCUMENT LAYOUT: This is a TABLE-BASED lesson plan with weeks as rows and lessons as columns.
Table columns: ${layout.columns.join(" | ")}
Column meanings: ${JSON.stringify(layout.columnMeaning)}
${layout.mergedWeeks.length > 0 ? `MERGED WEEKS: ${layout.mergedWeeks.join(", ")} — these rows contain lessons for multiple weeks. For each merged row, determine how many actual lessons are described (look at the lesson columns). If weeks 3&4 are merged and only 2 lesson columns have content, there are likely 2 lessons per week = 4 total lessons in that row, OR the teacher combined them into fewer longer sessions.` : ""}
${layout.hasDifferentiationColumn ? "DIFFERENTIATION: The last column contains differentiation strategies, NOT a lesson. Do not extract it as a lesson." : ""}
IMPORTANT: Each CELL in the lesson columns represents ONE lesson. A week row with 3 lesson columns = 3 separate lessons for that week.`
    : layout.type === "sequential-lessons"
    ? "DOCUMENT LAYOUT: Lessons are described sequentially (one after another), not in a table grid."
    : "DOCUMENT LAYOUT: Structure unclear — extract lessons as best you can.";

  const durationContext = headerMeta.lessonDurationMinutes
    ? `LESSON DURATION: Each lesson is ${headerMeta.lessonDurationMinutes} minutes (from document header). Use this for ALL lessons unless a specific lesson states otherwise.`
    : "LESSON DURATION: Not stated in header. Estimate based on activity count and type (default 50 minutes).";

  return `You are analysing a teacher's existing lesson plan document to extract its structure.

${frameworkContext}

${layoutContext}

${durationContext}

RULES:
- Do NOT invent activities that aren't in the document
- Preserve the teacher's exact activity descriptions where possible
- Each bullet point within a lesson cell typically represents a separate activity
- URLs in activity descriptions are RESOURCES — include them in the resources array
- If the document contains rubric/assessment tables, extract them separately
- If timing isn't specified per lesson, use ${headerMeta.lessonDurationMinutes || 50} minutes for each
- For criterion tags, use the FRAMEWORK-APPROPRIATE labels (not always A/B/C/D)
- Differentiation text goes in the differentiation field, NOT as a separate lesson
- For merged week rows: carefully count how many actual lessons are in the row by looking at how many lesson columns have content

Return ONLY valid JSON matching the specified structure. No markdown, no explanation.`;
}

function buildExtractionUserPrompt(
  rawText: string,
  filename: string,
  headerMeta: HeaderMetadata,
  layout: DocumentLayout,
): string {
  // Use more text for table-based layouts (they're dense)
  // A 12-lesson table plan with columns can easily be 20K+ chars in pandoc output
  const maxChars = layout.type === "week-lesson-grid" ? 24000 : 12000;
  const truncated = rawText.length > maxChars;
  const text = truncated
    ? rawText.slice(0, maxChars) + "\n\n[... document truncated ...]"
    : rawText;

  if (truncated) {
    console.warn(`[extractLessonStructure] Text truncated from ${rawText.length} to ${maxChars} chars (layout: ${layout.type})`);
  }

  // Build expected lesson count hint — combine header metadata + layout detection
  const expectedLessons = headerMeta.totalLessons || layout.totalLessons || 0;
  const lessonCountHint = expectedLessons > 0
    ? `\n\nCRITICAL: The document header indicates ${expectedLessons} lessons. You MUST extract ALL ${expectedLessons} lessons. If you can only see part of the document, extract every lesson visible in the text — do not stop at the first few. Each table cell in a lesson column = one lesson.`
    : "";

  return `Analyse this teacher's lesson plan document and extract the structure.

FILENAME: ${filename}
${headerMeta.gradeLevel ? `GRADE: ${headerMeta.gradeLevel}` : ""}
${headerMeta.subject ? `SUBJECT: ${headerMeta.subject}` : ""}
${headerMeta.topic ? `TOPIC: ${headerMeta.topic}` : ""}
${headerMeta.totalLessons ? `TOTAL LESSONS: ${headerMeta.totalLessons} (extract ALL of them)` : ""}
${headerMeta.lessonDurationMinutes ? `LESSON DURATION: ${headerMeta.lessonDurationMinutes} minutes each` : ""}${lessonCountHint}

DOCUMENT TEXT:
---
${text}
---

Return a JSON object with this exact structure:
{
  "unitTopic": "string — overall topic/theme",
  "gradeLevel": "string — e.g. 'Year 10', 'Grade 7', 'MYP 4'",
  "subjectArea": "string — e.g. 'Product Design', 'Design & Technology'",
  "totalLessons": number,
  "overallObjective": "string — unit-level learning objective if stated",
  "assessmentMethods": ["string array — any assessment methods mentioned"],
  "lessons": [
    {
      "title": "string — descriptive title for this lesson",
      "lessonNumber": number,
      "weekNumbers": [number — which week(s) this lesson falls in],
      "isDoublePeriod": boolean,
      "estimatedMinutes": number,
      "learningObjective": "string — what students will learn/do",
      "activities": [
        {
          "description": "string — the teacher's activity description",
          "type": "discussion|research|practical|presentation|assessment|reflection|other",
          "estimatedMinutes": number
        }
      ],
      "criterionTags": ["string array — framework-appropriate labels"],
      "materials": ["string array — physical materials needed"],
      "resources": [
        {
          "url": "string — full URL",
          "title": "string — what the resource is",
          "type": "video|worksheet|website|image|reference|other"
        }
      ],
      "differentiation": "string or null",
      "assessmentNotes": "string or null"
    }
  ],
  "rubrics": [
    {
      "criterionName": "string — name of rubric area",
      "levels": [
        { "label": "string — level name", "description": "string — descriptor" }
      ]
    }
  ]
}`;
}

/* ─── Main extraction function ─── */

/**
 * Use AI to extract lesson structure from document text.
 *
 * Two-stage pipeline:
 * 1. Header metadata extraction (regex, instant)
 * 2. Framework detection (regex, instant)
 * 3. Layout detection (Haiku, fast + cheap)
 * 4. Full lesson extraction (Sonnet, accurate)
 * 5. URL extraction + classification (regex, instant)
 */
export async function extractLessonStructure(
  rawText: string,
  filename: string
): Promise<LessonStructureExtraction> {
  // Stage 0: Extract header metadata (regex — instant)
  const headerMeta = extractHeaderMetadata(rawText);
  console.log(`[extractLessonStructure] Header: duration=${headerMeta.lessonDurationMinutes}min, lessons=${headerMeta.totalLessons}, grade=${headerMeta.gradeLevel}`);

  // Stage 1: Detect framework (regex — instant)
  const framework = detectFramework(rawText, filename);
  console.log(`[extractLessonStructure] Framework: ${framework.frameworkName} (${framework.confidence}), codes=${framework.curriculumCodes.join(",")}`);

  // Stage 2: Detect document layout (Haiku — fast)
  const layout = await detectDocumentLayout(rawText);
  layout.lessonDurationMinutes = headerMeta.lessonDurationMinutes;
  console.log(`[extractLessonStructure] Layout: ${layout.type}, weeks=${layout.weekCount}, lessons/week=${layout.lessonsPerWeek}, merged=${layout.mergedWeeks.join(",")}, diffCol=${layout.hasDifferentiationColumn}`);

  // Stage 3: Extract all URLs (regex — instant)
  const allUrls = extractAllUrls(rawText);
  console.log(`[extractLessonStructure] Found ${allUrls.length} URLs in document`);

  // Stage 4: Full extraction (Sonnet — accurate)
  const systemPrompt = buildExtractionSystemPrompt(framework, layout, headerMeta);
  const userPrompt = buildExtractionUserPrompt(rawText, filename, headerMeta, layout);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELS.SONNET,
      max_tokens: 12288,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lesson structure extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    console.error("[extractLessonStructure] No JSON in response:", text.slice(0, 500));
    throw new Error("AI did not return valid JSON for lesson structure extraction");
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);

    // Validate minimum structure
    if (!parsed.lessons || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
      throw new Error("Extraction returned no lessons");
    }

    // Ensure lesson numbers are sequential and duration is set
    const defaultDuration = headerMeta.lessonDurationMinutes || 50;
    parsed.lessons.forEach((lesson: ExtractedLesson, i: number) => {
      lesson.lessonNumber = i + 1;
      if (!lesson.estimatedMinutes || lesson.estimatedMinutes <= 0) {
        lesson.estimatedMinutes = defaultDuration;
      }
      if (!lesson.resources) lesson.resources = [];
      if (!lesson.weekNumbers) lesson.weekNumbers = [];
      if (!lesson.criterionTags) lesson.criterionTags = [];
      lesson.isDoublePeriod = lesson.isDoublePeriod || false;
    });

    parsed.totalLessons = parsed.lessons.length;

    // Warn if lesson count doesn't match expected
    const expectedCount = headerMeta.totalLessons || layout.totalLessons || 0;
    if (expectedCount > 0 && parsed.lessons.length < expectedCount) {
      console.warn(`[extractLessonStructure] ⚠️ LESSON COUNT MISMATCH: expected ${expectedCount}, got ${parsed.lessons.length}. Document may have been truncated or AI missed lessons. Raw text length: ${rawText.length}, max_chars used: ${layout.type === "week-lesson-grid" ? 24000 : 12000}`);
    }

    // Build resources array from both AI extraction and regex URL scan
    const aiResources: ExtractedResource[] = [];
    for (const lesson of parsed.lessons) {
      if (lesson.resources && Array.isArray(lesson.resources)) {
        for (const r of lesson.resources) {
          aiResources.push({
            url: r.url,
            title: r.title || r.url,
            lessonNumber: lesson.lessonNumber,
            type: r.type || classifyUrl(r.url),
          });
        }
      }
    }

    // Add any URLs the AI missed (from regex scan)
    const aiUrls = new Set(aiResources.map((r: ExtractedResource) => r.url));
    const extraResources: ExtractedResource[] = allUrls
      .filter(u => !aiUrls.has(u.url))
      .map(u => ({
        url: u.url,
        title: u.context || u.url,
        lessonNumber: 0, // Unit-level (couldn't map to specific lesson)
        type: classifyUrl(u.url),
      }));

    // Extract rubrics
    const rubrics: ExtractedRubric[] = parsed.rubrics || [];

    const result: LessonStructureExtraction = {
      unitTopic: parsed.unitTopic || headerMeta.topic || "Untitled Unit",
      gradeLevel: parsed.gradeLevel || headerMeta.gradeLevel || "Unknown",
      subjectArea: parsed.subjectArea || headerMeta.subject || "Design & Technology",
      totalLessons: parsed.totalLessons,
      lessons: parsed.lessons,
      overallObjective: parsed.overallObjective,
      assessmentMethods: parsed.assessmentMethods,
      framework,
      layout,
      resources: [...aiResources, ...extraResources],
      rubrics,
      lessonDurationMinutes: headerMeta.lessonDurationMinutes,
      totalDuration: headerMeta.totalDuration || undefined,
    };

    console.log(`[extractLessonStructure] SUCCESS: ${result.totalLessons} lessons, ${result.resources.length} resources, ${result.rubrics.length} rubrics, framework=${framework.frameworkName}`);

    return result;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("[extractLessonStructure] JSON parse error:", jsonMatch[1].slice(0, 500));
      throw new Error("AI returned malformed JSON for lesson structure");
    }
    throw err;
  }
}
