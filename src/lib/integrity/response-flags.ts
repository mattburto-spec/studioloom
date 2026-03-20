/**
 * Response Flagging Heuristic
 *
 * Flags student responses that are suspiciously long, vocabulary-advanced,
 * or structurally unusual for their grade level. Runs instantly (no AI calls).
 *
 * Designed for MYP students ages 11-18.
 *
 * @module integrity/response-flags
 */

/**
 * A single flag raised by the response analysis
 */
export interface ResponseFlag {
  /** Type of anomaly detected */
  type:
    | 'length_anomaly'
    | 'vocabulary_anomaly'
    | 'structure_anomaly'
    | 'copy_paste_pattern';
  /** Severity level */
  severity: 'info' | 'warning' | 'concern';
  /** Human-readable detail message */
  detail: string;
}

/**
 * Complete flagging analysis result
 */
export interface ResponseFlagResult {
  /** Whether any flags were raised */
  flagged: boolean;
  /** Array of individual flags */
  flags: ResponseFlag[];
  /** Computed metrics for the response */
  metrics: {
    /** Total word count */
    wordCount: number;
    /** Average word length in characters */
    avgWordLength: number;
    /** Number of sentences */
    sentenceCount: number;
    /** Average sentence length in words */
    avgSentenceLength: number;
    /** Ratio of unique words to total words */
    uniqueWordRatio: number;
    /** Count of academic words (≥8 chars, not in exemption list) */
    academicWordCount: number;
    /** Ratio of academic words to total words */
    academicWordRatio: number;
    /** Length of longest sentence */
    longestSentence: number;
  };
}

/**
 * Grade level context for calibrating thresholds.
 * MYP Year 1 = ~age 11, Year 5 = ~age 16
 */
interface GradeContext {
  /** MYP year level (1-5) */
  mypYear: number;
  /** Expected word count range for a typical response at this level */
  expectedWordRange: [number, number];
  /** Max typical average word length */
  maxTypicalAvgWordLength: number;
  /** Max typical average sentence length (words) */
  maxTypicalSentenceLength: number;
}

/**
 * Common academic words that should NOT be flagged as suspiciously advanced.
 * These are words ≥8 characters that are appropriate for school writing.
 */
const ACADEMIC_WORD_EXEMPTIONS = new Set([
  // Discourse markers
  'because',
  'however',
  'therefore',
  'important',
  'different',
  'example',
  'learning',
  'thinking',
  'understand',
  'knowledge',
  'question',
  'describe',
  'according',
  'although',
  'sometimes',
  'anything',
  'something',
  'everything',
  'experience',
  'evidence',
  'argument',
  'probably',
  'therefore',
  'actually',
  'interest',
  'increase',
  'research',
  'continue',
  'possible',
  'together',
  'remember',
  'previous',
  'specific',
  'consider',
  'response',
  'solution',
  'language',
  'analysis',
  'approach',
  'required',
  'decision',
  'original',
  'positive',
  'negative',
  'material',
  'planning',
  'building',
  'creation',
  'evaluate',
  'identify',
  'function',
  'process',
  'working',
  'development',
  'challenge',
  'improve',
]);

/**
 * Calibrates analysis thresholds based on MYP year level.
 * Interpolates between known grade levels.
 *
 * @param mypYear MYP year (1-5)
 * @returns Calibrated thresholds for the grade level
 */
export function getGradeContext(mypYear: number): GradeContext {
  // Clamp to valid range
  const year = Math.max(1, Math.min(5, mypYear));

  // Known grade contexts (empirically calibrated for MYP)
  const gradeContexts: Record<number, GradeContext> = {
    1: {
      mypYear: 1,
      expectedWordRange: [30, 200],
      maxTypicalAvgWordLength: 5.5,
      maxTypicalSentenceLength: 18,
    },
    2: {
      mypYear: 2,
      expectedWordRange: [40, 275],
      maxTypicalAvgWordLength: 5.75,
      maxTypicalSentenceLength: 20,
    },
    3: {
      mypYear: 3,
      expectedWordRange: [50, 350],
      maxTypicalAvgWordLength: 6.0,
      maxTypicalSentenceLength: 22,
    },
    4: {
      mypYear: 4,
      expectedWordRange: [65, 425],
      maxTypicalAvgWordLength: 6.25,
      maxTypicalSentenceLength: 24,
    },
    5: {
      mypYear: 5,
      expectedWordRange: [80, 500],
      maxTypicalAvgWordLength: 6.5,
      maxTypicalSentenceLength: 25,
    },
  };

  return gradeContexts[year];
}

/**
 * Tokenizes text into words for analysis.
 *
 * @param text Input text
 * @returns Array of lowercase words (alphanumeric only)
 */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/.test(word))
    .map((word) => word.replace(/[^a-z0-9]/g, ''));
}

/**
 * Splits text into sentences.
 *
 * @param text Input text
 * @returns Array of sentences
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Calculates basic textual metrics.
 *
 * @param text Input text
 * @returns Metrics object
 */
function calculateMetrics(
  text: string
): Omit<ResponseFlagResult['metrics'], 'academicWordCount' | 'academicWordRatio'> {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);

  const wordCount = words.length;
  const sentenceCount = sentences.length;

  const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
  const avgWordLength =
    wordCount > 0 ? totalWordLength / wordCount : 0;

  const totalSentenceLength = sentences.reduce(
    (sum, sent) => sum + tokenizeWords(sent).length,
    0
  );
  const avgSentenceLength =
    sentenceCount > 0 ? totalSentenceLength / sentenceCount : 0;

  const longestSentence =
    sentenceCount > 0
      ? Math.max(...sentences.map((s) => tokenizeWords(s).length))
      : 0;

  const uniqueWords = new Set(words);
  const uniqueWordRatio =
    wordCount > 0 ? uniqueWords.size / wordCount : 0;

  return {
    wordCount,
    avgWordLength,
    sentenceCount,
    avgSentenceLength,
    uniqueWordRatio,
    longestSentence,
  };
}

/**
 * Counts academic words (≥8 letters, not in exemption list).
 *
 * @param words Tokenized words
 * @returns Count of academic words
 */
function countAcademicWords(words: string[]): number {
  return words.filter(
    (word) =>
      word.length >= 8 && !ACADEMIC_WORD_EXEMPTIONS.has(word)
  ).length;
}

/**
 * Detects copy-paste patterns (markdown, consistent formatting, etc).
 *
 * @param text Input text
 * @returns True if copy-paste pattern is likely
 */
function detectCopyPastePattern(text: string): boolean {
  // Markdown headers (##, ###)
  if (/^#{2,}\s/m.test(text)) return true;

  // Markdown bold (**text**)
  if (/\*\*.+?\*\*/m.test(text)) return true;

  // Markdown code blocks (```)
  if (/```[\s\S]*?```/.test(text)) return true;

  // Numbered lists with consistent formatting (1. 2. 3. etc)
  const numberedListPattern = /^\d+\.\s+.+/m;
  const numberedMatches = (text.match(numberedListPattern) || []).length;
  if (numberedMatches >= 3) return true;

  // Bullet points (- or * at start of line)
  const bulletPattern = /^[\-\*]\s+.+/m;
  const bulletMatches = (text.match(bulletPattern) || []).length;
  if (bulletMatches >= 4) return true;

  // Multiple paragraphs with very similar structure (all start with same word)
  const lines = text
    .split('\n')
    .filter((line) => line.trim().length > 20);
  if (lines.length >= 3) {
    const firstWords = lines.map((line) =>
      line.trim().split(/\s+/)[0].toLowerCase()
    );
    const uniqueFirstWords = new Set(firstWords);
    // If most paragraphs start with the same word, likely AI-generated
    if (
      uniqueFirstWords.size === 1 &&
      lines.length >= 3
    ) {
      return true;
    }
  }

  // Very repetitive sentence starters (same word in >50% of sentences)
  const sentences = splitSentences(text);
  if (sentences.length >= 3) {
    const starters = sentences.map((s) =>
      s.trim().split(/\s+/)[0].toLowerCase()
    );
    const starterCounts: Record<string, number> = {};
    starters.forEach((starter) => {
      starterCounts[starter] = (starterCounts[starter] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(starterCounts));
    if (maxCount / sentences.length > 0.5) {
      return true;
    }
  }

  return false;
}

/**
 * Checks for uniform sentence lengths (low std dev suggests AI generation).
 *
 * @param text Input text
 * @returns True if sentence length variance is suspiciously low
 */
function hasUniformSentenceLength(text: string): boolean {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return false;

  const sentenceLengths = sentences.map((s) =>
    tokenizeWords(s).length
  );

  const mean =
    sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance =
    sentenceLengths.reduce(
      (sum, len) => sum + Math.pow(len - mean, 2),
      0
    ) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);

  // If std dev < 3, sentences are suspiciously uniform
  return stdDev < 3;
}

/**
 * Main response flagging function.
 *
 * Analyzes a student response for anomalies (length, vocabulary, structure, copy-paste).
 * No AI calls — runs instantly using heuristics.
 *
 * @param text Student response text
 * @param mypYear Optional MYP year (1-5) for grade-level calibration. Defaults to Year 3.
 * @returns Comprehensive flagging result with metrics and flags
 */
export function flagResponse(
  text: string,
  mypYear: number = 3
): ResponseFlagResult {
  const flags: ResponseFlag[] = [];

  // Handle empty or very short responses (< 20 words)
  const words = tokenizeWords(text);
  if (words.length < 20) {
    return {
      flagged: false,
      flags: [],
      metrics: {
        wordCount: words.length,
        avgWordLength: 0,
        sentenceCount: 0,
        avgSentenceLength: 0,
        uniqueWordRatio: 0,
        academicWordCount: 0,
        academicWordRatio: 0,
        longestSentence: 0,
      },
    };
  }

  const context = getGradeContext(mypYear);
  const baseMetrics = calculateMetrics(text);
  const academicWordCount = countAcademicWords(words);
  const academicWordRatio =
    baseMetrics.wordCount > 0
      ? academicWordCount / baseMetrics.wordCount
      : 0;

  const metrics: ResponseFlagResult['metrics'] = {
    ...baseMetrics,
    academicWordCount,
    academicWordRatio,
  };

  // === CHECK 1: Length Anomaly ===
  const [minExpected, maxExpected] = context.expectedWordRange;
  const wordCount = metrics.wordCount;

  if (wordCount > maxExpected * 2) {
    flags.push({
      type: 'length_anomaly',
      severity: 'concern',
      detail: `Response is ${Math.round((wordCount / maxExpected) * 10) / 10}x expected length for Year ${mypYear} (${wordCount} vs. typical max ${maxExpected})`,
    });
  } else if (wordCount > maxExpected * 1.5) {
    flags.push({
      type: 'length_anomaly',
      severity: 'warning',
      detail: `Response is notably long for Year ${mypYear} (${wordCount} words vs. typical max ${maxExpected})`,
    });
  }

  // === CHECK 2: Vocabulary Anomaly ===
  const academicThresholds: Record<number, number> = {
    1: 0.15,
    2: 0.16,
    3: 0.2,
    4: 0.23,
    5: 0.25,
  };
  const threshold = academicThresholds[mypYear] || 0.2;

  if (metrics.academicWordRatio > threshold) {
    flags.push({
      type: 'vocabulary_anomaly',
      severity: 'warning',
      detail: `Vocabulary unusually advanced for Year ${mypYear}: ${Math.round(metrics.academicWordRatio * 100)}% academic words (typical max ${Math.round(threshold * 100)}%)`,
    });
  }

  // === CHECK 3: Structure Anomaly ===
  if (
    metrics.sentenceCount > 0 &&
    metrics.avgSentenceLength >
      context.maxTypicalSentenceLength * 1.5
  ) {
    flags.push({
      type: 'structure_anomaly',
      severity: 'warning',
      detail: `Sentences unusually long for Year ${mypYear}: avg ${Math.round(metrics.avgSentenceLength)} words (typical max ${context.maxTypicalSentenceLength})`,
    });
  }

  if (hasUniformSentenceLength(text)) {
    flags.push({
      type: 'structure_anomaly',
      severity: 'info',
      detail: 'Sentence lengths are unusually uniform (may indicate AI generation)',
    });
  }

  // === CHECK 4: Copy-Paste Pattern ===
  if (detectCopyPastePattern(text)) {
    flags.push({
      type: 'copy_paste_pattern',
      severity: 'warning',
      detail: 'Response contains formatting patterns typical of copied content (markdown, numbered lists, or repetitive structure)',
    });
  }

  // === CHECK 5: Very Low Unique Word Ratio (for short texts) ===
  if (
    metrics.wordCount < 300 &&
    metrics.uniqueWordRatio < 0.3
  ) {
    flags.push({
      type: 'copy_paste_pattern',
      severity: 'info',
      detail: 'Unusually repetitive word choice (may indicate AI generation)',
    });
  }

  return {
    flagged: flags.length > 0,
    flags,
    metrics,
  };
}

/**
 * Formats a flagging result into a one-line summary for teacher dashboards.
 *
 * @param result Flagging result from flagResponse()
 * @returns Human-readable single-line summary
 */
export function formatFlagSummary(result: ResponseFlagResult): string {
  if (!result.flagged) {
    return 'No flags';
  }

  const flagsByType = result.flags.reduce(
    (acc, flag) => {
      if (!acc[flag.type]) acc[flag.type] = [];
      acc[flag.type].push(flag);
      return acc;
    },
    {} as Record<string, ResponseFlag[]>
  );

  const summaryParts: string[] = [];

  if (flagsByType.length_anomaly) {
    const flag = flagsByType.length_anomaly[0];
    summaryParts.push(`${flag.severity === 'concern' ? 'CONCERN' : 'Length'}: ${result.metrics.wordCount} words`);
  }

  if (flagsByType.vocabulary_anomaly) {
    const pct = Math.round(
      result.metrics.academicWordRatio * 100
    );
    summaryParts.push(`Vocabulary: ${pct}% academic words`);
  }

  if (flagsByType.structure_anomaly) {
    summaryParts.push(
      `Structure: avg sentence ${Math.round(result.metrics.avgSentenceLength)} words`
    );
  }

  if (flagsByType.copy_paste_pattern) {
    summaryParts.push('Possible copy-paste or AI-generated content');
  }

  const concerns = result.flags.filter(
    (f) => f.severity === 'concern'
  ).length;
  if (concerns > 0) {
    return `⚠️ ${concerns} concern${concerns !== 1 ? 's' : ''}: ${summaryParts.join(', ')}`;
  }

  return `${result.flags.length} flag${result.flags.length !== 1 ? 's' : ''}: ${summaryParts.join(', ')}`;
}
