/**
 * Structure-aware chunking pipeline for educational content.
 * Splits documents into semantically meaningful chunks with metadata,
 * respecting section boundaries and adding contextual enrichment.
 *
 * Two chunking strategies:
 * 1. Heuristic (default) — splits on section headings + paragraph boundaries
 * 2. Analysis-informed — uses LessonProfile's lesson_flow to align chunks
 *    to pedagogical phases, producing richer metadata per chunk
 */

import type { ExtractedDoc, ExtractedSection } from "./extract";
import type { LessonProfile, LessonFlowPhase } from "@/types/lesson-intelligence";

export interface ChunkMetadata {
  source_type: "uploaded_plan" | "created_unit" | "activity_template" | "knowledge_item";
  source_id?: string;
  source_filename?: string;
  teacher_id?: string;
  grade_level?: string;
  subject_area?: string;
  topic?: string;
  global_context?: string;
  key_concept?: string;
  is_public?: boolean;
  /** Upload category: lesson_plan, textbook, resource. Used for future copyright-safe chunking. */
  source_category?: string;
  /** Bloom's taxonomy level of the primary cognitive demand (from Dimensions v2) */
  bloom_level?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  /** Student grouping strategy (from Dimensions v2) */
  grouping?: "individual" | "pair" | "small_group" | "whole_class" | "flexible";
  /** UDL checkpoint IDs this chunk addresses (from Dimensions v2, e.g. "1.1", "5.2") */
  udl_checkpoints?: string[];
}

export interface Chunk {
  content: string;
  context_preamble?: string;
  criterion?: string;
  page_id?: string;
  content_type?: string;
  metadata: ChunkMetadata;
  item_id?: string; // links chunk back to knowledge_items
}

// Target: 200-400 tokens ≈ 800-1600 characters
const TARGET_CHUNK_SIZE = 1200; // characters (middle ground)
const MAX_CHUNK_SIZE = 2000;
const MIN_CHUNK_SIZE = 200;
const OVERLAP_SIZE = 150; // characters

/**
 * Chunk an extracted document into pieces suitable for embedding.
 */
export function chunkDocument(
  doc: ExtractedDoc,
  metadata: ChunkMetadata
): Chunk[] {
  const chunks: Chunk[] = [];

  // 1. Create an overview chunk (unit/document summary)
  const overviewText = buildOverview(doc);
  if (overviewText.length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: overviewText,
      content_type: "overview",
      metadata,
    });
  }

  // 2. Chunk each section
  for (const section of doc.sections) {
    const sectionChunks = chunkSection(section, metadata);
    chunks.push(...sectionChunks);
  }

  return chunks;
}

/**
 * Chunk a single unit page (for auto-ingesting created units).
 */
export function chunkUnitPage(
  pageId: string,
  pageContent: {
    title: string;
    learningGoal: string;
    sections: Array<{ prompt: string; exampleResponse?: string }>;
    vocabWarmup?: { terms: Array<{ term: string; definition: string }> };
    reflection?: { items: string[] };
  },
  metadata: ChunkMetadata
): Chunk {
  const parts: string[] = [];

  parts.push(`Page ${pageId}: ${pageContent.title}`);
  parts.push(`Learning Goal: ${pageContent.learningGoal}`);

  if (pageContent.vocabWarmup?.terms.length) {
    const vocab = pageContent.vocabWarmup.terms
      .map((t) => `${t.term}: ${t.definition}`)
      .join("; ");
    parts.push(`Vocabulary: ${vocab}`);
  }

  for (const section of pageContent.sections) {
    parts.push(`Activity: ${section.prompt}`);
    if (section.exampleResponse) {
      parts.push(`Example: ${section.exampleResponse}`);
    }
  }

  if (pageContent.reflection?.items.length) {
    parts.push(`Reflection: ${pageContent.reflection.items.join("; ")}`);
  }

  const criterion = pageId.charAt(0);

  return {
    content: parts.join("\n"),
    page_id: pageId,
    criterion: ["A", "B", "C", "D"].includes(criterion)
      ? criterion
      : undefined,
    content_type: "activity",
    metadata,
  };
}

/**
 * Chunk a section, splitting on paragraph boundaries if too long.
 */
function chunkSection(
  section: ExtractedSection,
  metadata: ChunkMetadata
): Chunk[] {
  const fullText = `${section.heading}\n\n${section.content}`;

  // If section fits in one chunk, return as-is
  if (fullText.length <= MAX_CHUNK_SIZE) {
    if (fullText.length < MIN_CHUNK_SIZE) return [];
    return [
      {
        content: fullText,
        content_type: detectContentType(fullText),
        criterion: detectCriterion(fullText),
        metadata,
      },
    ];
  }

  // Split on paragraph boundaries
  const paragraphs = section.content.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let currentChunk = section.heading + "\n\n";

  for (const para of paragraphs) {
    if (
      currentChunk.length + para.length > TARGET_CHUNK_SIZE &&
      currentChunk.length > MIN_CHUNK_SIZE
    ) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        content_type: detectContentType(currentChunk),
        criterion: detectCriterion(currentChunk),
        metadata,
      });

      // Start new chunk with overlap
      const overlap = getOverlap(currentChunk);
      currentChunk = overlap + para + "\n\n";
    } else {
      currentChunk += para + "\n\n";
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      content: currentChunk.trim(),
      content_type: detectContentType(currentChunk),
      criterion: detectCriterion(currentChunk),
      metadata,
    });
  }

  return chunks;
}

/** Build overview text from document */
function buildOverview(doc: ExtractedDoc): string {
  const headings = doc.sections.map((s) => s.heading).join(", ");
  return `Document: ${doc.title}\nSections: ${headings}`;
}

/** Get overlap text from the end of a chunk */
function getOverlap(text: string): string {
  if (text.length <= OVERLAP_SIZE) return text;
  // Find a sentence boundary near the overlap point
  const tail = text.slice(-OVERLAP_SIZE);
  const sentenceStart = tail.indexOf(". ");
  if (sentenceStart >= 0) {
    return tail.slice(sentenceStart + 2);
  }
  return tail;
}

/** Detect MYP criterion from content text */
function detectCriterion(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/criterion\s*a|inquir|analys|research\s*plan|design\s*brief/i.test(lower))
    return "A";
  if (/criterion\s*b|develop.*ideas?|sketch|brainstorm|ideation/i.test(lower))
    return "B";
  if (/criterion\s*c|creat.*solution|prototype|build|construct/i.test(lower))
    return "C";
  if (/criterion\s*d|evaluat|reflect|test.*result|improve/i.test(lower))
    return "D";
  return undefined;
}

/** Detect content type from text */
function detectContentType(
  text: string
): "activity" | "instruction" | "assessment" | "vocabulary" | "reflection" {
  const lower = text.toLowerCase();
  if (/rubric|assess|grade|mark|score|criteria.*descriptor/i.test(lower))
    return "assessment";
  if (/vocab|glossary|key\s*terms?|definition/i.test(lower))
    return "vocabulary";
  if (/reflect|what.*learn|self-assess|confidence/i.test(lower))
    return "reflection";
  if (/activity|task|exercise|students?\s*will|try\s*this/i.test(lower))
    return "activity";
  return "instruction";
}

/* ================================================================
   ANALYSIS-INFORMED CHUNKING
   Uses LessonProfile to align chunk boundaries to lesson phases,
   producing richer, pedagogically-meaningful chunks.
   ================================================================ */

/**
 * Chunk a document using AI analysis (LessonProfile) to align boundaries
 * to lesson phases. Falls back to heuristic chunking if alignment fails.
 *
 * Each lesson phase becomes one chunk (or gets split if too long),
 * enriched with phase metadata: pedagogical purpose, teacher role,
 * cognitive level, criteria alignment, etc.
 */
export function chunkDocumentWithProfile(
  doc: ExtractedDoc,
  metadata: ChunkMetadata,
  profile: LessonProfile
): Chunk[] {
  const chunks: Chunk[] = [];
  const fullText = doc.sections.map((s) => `${s.heading}\n\n${s.content}`).join("\n\n");

  // 1. Create a rich overview chunk from the profile
  const overviewParts: string[] = [
    `Lesson: ${profile.title}`,
    `Subject: ${profile.subject_area}, Grade: ${profile.grade_level}`,
    `Type: ${profile.lesson_type}, Duration: ${profile.estimated_duration_minutes}min`,
  ];
  if (profile.pedagogical_approach) {
    overviewParts.push(`Approach: ${profile.pedagogical_approach}`);
  }
  if (profile.scaffolding_strategy) {
    overviewParts.push(`Scaffolding: ${profile.scaffolding_strategy}`);
  }
  if (profile.strengths?.length) {
    overviewParts.push(`Strengths: ${profile.strengths.join("; ")}`);
  }
  if (profile.gaps?.length) {
    overviewParts.push(`Gaps: ${profile.gaps.join("; ")}`);
  }
  if (profile.criteria_analysis?.length) {
    const criteria = profile.criteria_analysis
      .map((c) => `${c.criterion}(${c.emphasis})`)
      .join(", ");
    overviewParts.push(`Criteria: ${criteria}`);
  }

  // Collect all UDL checkpoints from profile-level analysis for overview chunk
  const allUdlCheckpoints = collectAllUdlCheckpoints(profile);

  chunks.push({
    content: overviewParts.join("\n"),
    content_type: "overview",
    context_preamble: `Analysed lesson plan: "${profile.title}" — ${profile.subject_area}, ${profile.grade_level}`,
    metadata: {
      ...metadata,
      grade_level: metadata.grade_level || profile.grade_level,
      subject_area: metadata.subject_area || profile.subject_area,
      ...(allUdlCheckpoints.length ? { udl_checkpoints: allUdlCheckpoints } : {}),
    },
  });

  // 2. Create a chunk per lesson flow phase
  if (profile.lesson_flow?.length) {
    for (const phase of profile.lesson_flow) {
      const phaseChunks = chunkLessonPhase(phase, fullText, metadata, profile);
      chunks.push(...phaseChunks);
    }
  }

  // 3. If no lesson flow or very few chunks, fall back to heuristic
  if (chunks.length <= 1) {
    return chunkDocument(doc, metadata);
  }

  return chunks;
}

/**
 * Create chunk(s) for a single lesson flow phase.
 * Tries to find the matching text in the source document by title matching.
 * Falls back to using the phase description if source text not found.
 */
function chunkLessonPhase(
  phase: LessonFlowPhase,
  fullText: string,
  metadata: ChunkMetadata,
  profile: LessonProfile
): Chunk[] {
  // Try to find the matching text section in the source document
  const phaseText = findPhaseText(phase.title, fullText);

  // Build rich preamble from analysis intelligence
  const preambleParts: string[] = [
    `Phase: ${phase.phase} — "${phase.title}"`,
    `Duration: ${phase.estimated_minutes}min`,
  ];
  if (phase.pedagogical_purpose) {
    preambleParts.push(`Purpose: ${phase.pedagogical_purpose}`);
  }
  if (phase.teacher_role) {
    preambleParts.push(`Teacher role: ${phase.teacher_role}`);
  }
  if (phase.student_cognitive_level) {
    preambleParts.push(`Cognitive level: ${phase.student_cognitive_level}`);
  }
  if (phase.energy_state) {
    preambleParts.push(`Energy: ${phase.energy_state}`);
  }

  const preamble = preambleParts.join(" | ");

  // Extract Dimensions metadata from phase analysis
  const bloomLevel = mapCognitiveLevelToBloom(phase.student_cognitive_level);
  // Derive per-phase grouping from phase type heuristic + profile-level grouping analysis
  const grouping = derivePhaseGrouping(phase, profile);
  // Derive UDL checkpoints: overview chunk gets all; phase chunks get phase-relevant subset
  const udlCheckpoints = derivePhaseUdlCheckpoints(phase, profile);

  // Build content: source text or description
  const contentParts: string[] = [`${phase.title}\n`];

  if (phaseText) {
    contentParts.push(phaseText);
  } else {
    // Use description from analysis when source text not found
    contentParts.push(phase.description || "");
  }

  // Add scaffolding info if present
  if (phase.scaffolding_present?.length) {
    contentParts.push(`\nScaffolding: ${phase.scaffolding_present.join(", ")}`);
  }
  if (phase.materials_needed?.length) {
    contentParts.push(`Materials: ${phase.materials_needed.join(", ")}`);
  }
  if (phase.tools_required?.length) {
    contentParts.push(`Tools: ${phase.tools_required.join(", ")}`);
  }
  if (phase.safety_considerations?.length) {
    contentParts.push(`Safety: ${phase.safety_considerations.join(", ")}`);
  }

  const fullContent = contentParts.join("\n").trim();

  // Determine criterion from phase type
  const criterion = phase.phase
    ? mapPhaseToCriterion(phase.phase)
    : detectCriterion(fullContent);

  // Map phase type to content type
  const contentType = mapPhaseToContentType(phase.phase, phase.activity_type);

  // If content is too long, split it
  if (fullContent.length > MAX_CHUNK_SIZE) {
    const paragraphs = fullContent.split(/\n\n+/);
    const splitChunks: Chunk[] = [];
    let current = "";

    for (const para of paragraphs) {
      if (current.length + para.length > TARGET_CHUNK_SIZE && current.length > MIN_CHUNK_SIZE) {
        splitChunks.push({
          content: current.trim(),
          context_preamble: preamble,
          criterion,
          content_type: contentType,
          metadata: {
            ...metadata,
            grade_level: metadata.grade_level || profile.grade_level,
            subject_area: metadata.subject_area || profile.subject_area,
            ...(bloomLevel ? { bloom_level: bloomLevel } : {}),
            ...(grouping ? { grouping } : {}),
            ...(udlCheckpoints?.length ? { udl_checkpoints: udlCheckpoints } : {}),
          },
        });
        current = getOverlap(current) + para + "\n\n";
      } else {
        current += para + "\n\n";
      }
    }
    if (current.trim().length >= MIN_CHUNK_SIZE) {
      splitChunks.push({
        content: current.trim(),
        context_preamble: preamble,
        criterion,
        content_type: contentType,
        metadata: {
          ...metadata,
          grade_level: metadata.grade_level || profile.grade_level,
          subject_area: metadata.subject_area || profile.subject_area,
          ...(bloomLevel ? { bloom_level: bloomLevel } : {}),
          ...(grouping ? { grouping } : {}),
        },
      });
    }
    return splitChunks;
  }

  if (fullContent.length < MIN_CHUNK_SIZE) return [];

  return [
    {
      content: fullContent,
      context_preamble: preamble,
      criterion,
      content_type: contentType,
      metadata: {
        ...metadata,
        grade_level: metadata.grade_level || profile.grade_level,
        subject_area: metadata.subject_area || profile.subject_area,
        ...(bloomLevel ? { bloom_level: bloomLevel } : {}),
        ...(grouping ? { grouping } : {}),
      },
    },
  ];
}

/**
 * Find text in the source document that corresponds to a phase title.
 * Uses fuzzy heading matching — looks for the title as a heading or
 * section start within the full document text.
 */
function findPhaseText(phaseTitle: string, fullText: string): string | null {
  if (!phaseTitle || !fullText) return null;

  // Normalise for matching
  const normTitle = phaseTitle.toLowerCase().trim();

  // Try to find the section by heading (case-insensitive)
  const lines = fullText.split("\n");
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const normLine = lines[i].toLowerCase().trim();
    if (startIdx === -1) {
      // Check if this line contains the phase title
      if (normLine.includes(normTitle) || similarity(normLine, normTitle) > 0.6) {
        startIdx = i;
      }
    } else {
      // Look for the next heading (to mark end of this section)
      // Heuristic: a short line (< 80 chars) that's followed by longer content
      if (
        normLine.length > 0 &&
        normLine.length < 80 &&
        i + 1 < lines.length &&
        lines[i + 1].trim().length > normLine.length
      ) {
        // Could be next heading — check if it's different enough
        if (similarity(normLine, normTitle) < 0.3) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (startIdx === -1) return null;

  // Extract the text for this section (skip the heading itself)
  const sectionText = lines
    .slice(startIdx + 1, endIdx)
    .join("\n")
    .trim();

  return sectionText.length >= MIN_CHUNK_SIZE ? sectionText : null;
}

/** Simple string similarity (Jaccard on words) */
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  return intersection / (wordsA.size + wordsB.size - intersection);
}

/** Map lesson phase type to MYP criterion */
function mapPhaseToCriterion(
  phase: string
): string | undefined {
  const p = phase.toLowerCase();
  if (p.includes("inquiry") || p.includes("research") || p.includes("analyse")) return "A";
  if (p.includes("develop") || p.includes("ideation") || p.includes("brainstorm")) return "B";
  if (p.includes("creat") || p.includes("mak") || p.includes("build") || p.includes("construct")) return "C";
  if (p.includes("evaluat") || p.includes("reflect") || p.includes("test")) return "D";
  return undefined;
}

/** Map phase/activity type to content type */
function mapPhaseToContentType(
  phase?: string,
  activityType?: string
): string {
  const combined = `${phase || ""} ${activityType || ""}`.toLowerCase();
  if (combined.includes("assess") || combined.includes("rubric")) return "assessment";
  if (combined.includes("vocab") || combined.includes("glossary")) return "vocabulary";
  if (combined.includes("reflect") || combined.includes("review")) return "reflection";
  if (combined.includes("activity") || combined.includes("practice") || combined.includes("hands")) return "activity";
  return "instruction";
}

/** Map Pass 2 student_cognitive_level strings to Bloom's taxonomy enum values */
function mapCognitiveLevelToBloom(
  level?: string
): ChunkMetadata["bloom_level"] | undefined {
  if (!level) return undefined;
  const l = level.toLowerCase().trim();
  if (l === "remember" || l === "recall") return "remember";
  if (l === "understand" || l === "comprehend") return "understand";
  if (l === "apply" || l === "application") return "apply";
  if (l.startsWith("analy") || l === "analyse") return "analyze";
  if (l.startsWith("evaluat")) return "evaluate";
  if (l === "create" || l === "synthesis" || l === "synthesize") return "create";
  return undefined;
}

/** Map grouping labels from analysis to standard Dimensions grouping values */
function mapGroupingLabel(
  label?: string
): ChunkMetadata["grouping"] | undefined {
  if (!label) return undefined;
  const l = label.toLowerCase().trim();
  if (l.includes("individual") || l.includes("solo")) return "individual";
  if (l.includes("pair")) return "pair";
  if (l.includes("small") || l.includes("group") && !l.includes("whole")) return "small_group";
  if (l.includes("whole") || l.includes("class")) return "whole_class";
  if (l.includes("flex") || l.includes("mixed")) return "flexible";
  return undefined;
}

/**
 * Derive per-phase grouping from the phase type + profile-level grouping analysis.
 * Uses phase type heuristics as primary signal, with profile.grouping_analysis as fallback.
 */
function derivePhaseGrouping(
  phase: LessonFlowPhase,
  profile: LessonProfile
): ChunkMetadata["grouping"] | undefined {
  // Phase type → likely grouping heuristic
  const phaseGroupingMap: Record<string, ChunkMetadata["grouping"]> = {
    warm_up: "whole_class",
    vocabulary: "whole_class",
    introduction: "whole_class",
    demonstration: "whole_class",
    guided_practice: "pair",
    independent_work: "individual",
    making: "individual",
    collaboration: "small_group",
    critique: "small_group",
    gallery_walk: "whole_class",
    presentation: "whole_class",
    testing: "individual",
    iteration: "individual",
    reflection: "individual",
    assessment: "individual",
    station_rotation: "small_group",
  };

  const fromPhaseType = phaseGroupingMap[phase.phase];
  if (fromPhaseType) return fromPhaseType;

  // Fallback: try to extract from profile.grouping_analysis.progression string
  if (profile.grouping_analysis?.progression) {
    // The progression string might mention the phase name with a grouping
    // e.g. "whole-class (intro) → pairs (ideation) → individual (making)"
    const prog = profile.grouping_analysis.progression.toLowerCase();
    const phaseTitle = phase.title.toLowerCase();
    // Simple: check if the progression mentions this phase's title near a grouping keyword
    const segments = prog.split("→").map((s) => s.trim());
    for (const seg of segments) {
      if (seg.includes(phaseTitle) || seg.includes(phase.phase.replace(/_/g, " "))) {
        return mapGroupingLabel(seg);
      }
    }
  }

  return undefined;
}

/**
 * Derive UDL checkpoint IDs relevant to a specific phase.
 * Phase-to-UDL mapping: engagement checkpoints go to warm_up/introduction phases,
 * representation to instruction phases, action_expression to work/making phases.
 */
function derivePhaseUdlCheckpoints(
  phase: LessonFlowPhase,
  profile: LessonProfile
): string[] | undefined {
  if (!profile.udl_coverage) return undefined;

  const { engagement, representation, action_expression } = profile.udl_coverage;
  const checkpoints: string[] = [];

  // Map phase types to relevant UDL principles
  const engagementPhases = new Set([
    "warm_up", "introduction", "vocabulary", "reflection", "collaboration",
  ]);
  const representationPhases = new Set([
    "demonstration", "introduction", "guided_practice", "vocabulary",
  ]);
  const actionExpressionPhases = new Set([
    "independent_work", "making", "testing", "iteration", "presentation",
    "critique", "gallery_walk", "assessment", "station_rotation",
  ]);

  if (engagementPhases.has(phase.phase) && engagement?.length) {
    checkpoints.push(...engagement);
  }
  if (representationPhases.has(phase.phase) && representation?.length) {
    checkpoints.push(...representation);
  }
  if (actionExpressionPhases.has(phase.phase) && action_expression?.length) {
    checkpoints.push(...action_expression);
  }

  return checkpoints.length > 0 ? [...new Set(checkpoints)] : undefined;
}

/**
 * Collect all UDL checkpoint IDs from the profile-level analysis.
 * Used for the overview chunk which should have full UDL coverage.
 */
function collectAllUdlCheckpoints(profile: LessonProfile): string[] {
  if (!profile.udl_coverage) return [];
  const { engagement, representation, action_expression } = profile.udl_coverage;
  const all: string[] = [
    ...(engagement || []),
    ...(representation || []),
    ...(action_expression || []),
  ];
  // Deduplicate and extract just the checkpoint ID portion (e.g. "1.1" from "1.1 recruiting interest")
  const ids = all.map((s) => {
    const match = s.match(/^(\d+\.\d+)/);
    return match ? match[1] : s;
  });
  return [...new Set(ids)];
}
