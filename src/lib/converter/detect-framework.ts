/**
 * Framework Detection for Lesson Plan Converter
 *
 * Scans document text for curriculum fingerprints to determine which
 * framework a lesson plan was written for. This is critical because
 * the extraction pipeline needs to know whether "A/B/C/D" means MYP
 * criteria, or whether "AO1/AO2" means GCSE objectives, etc.
 *
 * Runs BEFORE AI extraction so the AI prompt can be framework-aware.
 */

export interface FrameworkDetection {
  /** Detected framework key (matches FRAMEWORK_VOCABULARY keys) */
  framework: string;
  /** Human-readable name */
  frameworkName: string;
  /** Confidence: high (strong signals), medium (some signals), low (guess) */
  confidence: "high" | "medium" | "low";
  /** Which signals matched */
  signals: string[];
  /** Detected curriculum codes (e.g., VCDSTC059) */
  curriculumCodes: string[];
  /** Assessment model detected */
  assessmentModel?: string;
}

interface FrameworkFingerprint {
  key: string;
  name: string;
  /** Regex patterns that strongly indicate this framework */
  strongPatterns: RegExp[];
  /** Regex patterns that weakly suggest this framework */
  weakPatterns: RegExp[];
  /** Curriculum code patterns */
  codePatterns: RegExp[];
  /** Assessment scale keywords */
  assessmentKeywords: string[];
}

const FINGERPRINTS: FrameworkFingerprint[] = [
  {
    key: "IB_MYP",
    name: "IB MYP Design",
    strongPatterns: [
      /\bMYP\b/i,
      /\bIB\s+(?:Middle Years|MYP)/i,
      /\bCriterion\s+[A-D]\b/i,
      /\bStatement\s+of\s+Inquiry\b/i,
      /\bGlobal\s+Context/i,
      /\bATL\s+(?:Skills|Focus)/i,
      /\bKey\s+Concept/i,
      /\bRelated\s+Concept/i,
      /\bInquiring\s+and\s+Analys/i,
      /\bDeveloping\s+Ideas\b/i,
      /\bCreating\s+the\s+Solution\b/i,
    ],
    weakPatterns: [
      /\bcriterion\b/i,
      /\bstrand\s+[iv]+\b/i,
      /\bachievement\s+level\s+[1-8]/i,
      /\bunit\s+planner\b/i,
    ],
    codePatterns: [],
    assessmentKeywords: ["criterion", "achievement level", "strand", "1-8"],
  },
  {
    key: "VCAA_DT",
    name: "Victorian Curriculum (VCAA) Design & Technologies",
    strongPatterns: [
      /\bVCAA\b/i,
      /\bVictorian\s+Curriculum\b/i,
      /\bVCDST[A-Z]{1,3}\d{3}/i,
      /\bvictoriancurriculum\.vcaa/i,
      /\bfuse\.education\.vic\.gov/i,
    ],
    weakPatterns: [
      /\bVCE\b/,
      /\beducation\.vic\.gov/i,
      /\bDesign\s+and\s+Technologies\s+Glossary/i,
    ],
    codePatterns: [
      /VCDST[A-Z]{1,3}\d{3}/g,
      /VCDSCD\d{3}/g,
      /VCDSTS\d{3}/g,
      /VCDSTC\d{3}/g,
    ],
    assessmentKeywords: [
      "extending", "proficient", "consolidating", "developing",
      "beginning", "needs attention", "achievement standard",
    ],
  },
  {
    key: "ACARA_DT",
    name: "Australian Curriculum (ACARA) Design & Technologies",
    strongPatterns: [
      /\bACARA\b/i,
      /\bAustralian\s+Curriculum\b/i,
      /\bACTDE[KP]\d{3}/i,
      /\bACTDIP\d{3}/i,
      /\bscsa\.wa\.edu/i,
      /\bqcaa\.qld\.edu/i,
      /\bnesa\.nsw\.edu/i,
    ],
    weakPatterns: [
      /\bband\s+level/i,
      /\bcontent\s+description/i,
      /\belaboration/i,
    ],
    codePatterns: [
      /ACTDE[KP]\d{3}/g,
      /ACTDIP\d{3}/g,
    ],
    assessmentKeywords: ["A-E", "grade band", "satisfactory", "content description"],
  },
  {
    key: "GCSE_DT",
    name: "GCSE Design & Technology (UK)",
    strongPatterns: [
      /\bGCSE\b/i,
      /\bAQA\b/,
      /\bOCR\b/,
      /\bEdexcel\b/i,
      /\bPearson\b/i,
      /\bNEA\b/,
      /\bNon.Examined\s+Assessment/i,
    ],
    weakPatterns: [
      /\bAO[1-5]\b/,
      /\btechnical\s+principles/i,
      /\bcore\s+knowledge/i,
      /\bsection\s+[A-C]\b/i,
    ],
    codePatterns: [],
    assessmentKeywords: ["AO1", "AO2", "AO3", "NEA", "marks"],
  },
  {
    key: "A_LEVEL_DT",
    name: "A-Level Design & Technology (UK)",
    strongPatterns: [
      /\bA.Level\b/i,
      /\bAS.Level\b/i,
      /\bComponent\s+[1-3]\b/i,
      /\bdesign\s+and\s+make\s+task\b/i,
    ],
    weakPatterns: [
      /\bUMS\s+marks/i,
      /\bA\*?\s*to\s*E\b/i,
    ],
    codePatterns: [],
    assessmentKeywords: ["component", "UMS", "A*-E"],
  },
  {
    key: "IGCSE_DT",
    name: "Cambridge IGCSE Design & Technology",
    strongPatterns: [
      /\bIGCSE\b/i,
      /\bCambridge\b/i,
      /\bCIE\b/,
      /\b0445\b/, // IGCSE DT subject code
      /\b0979\b/, // IGCSE DT alternative code
    ],
    weakPatterns: [
      /\bcoursework\s+portfolio\b/i,
    ],
    codePatterns: [],
    assessmentKeywords: ["A*-G", "9-1", "coursework"],
  },
  {
    key: "PLTW",
    name: "Project Lead The Way (US)",
    strongPatterns: [
      /\bPLTW\b/,
      /\bProject\s+Lead\s+The\s+Way\b/i,
      /\bengineering\s+notebook\b/i,
      /\bAutodesk\s+Inventor\b/i,
    ],
    weakPatterns: [
      /\bSTEM\b/,
      /\bAPP\s+pedagogy/i,
      /\bNext\s+Generation\s+Science/i,
      /\bNGSS\b/,
    ],
    codePatterns: [],
    assessmentKeywords: ["proficiency", "below basic", "basic", "proficient", "advanced"],
  },
];

/**
 * Detect which curriculum framework a lesson plan document uses.
 *
 * Scans for strong signals (curriculum codes, explicit framework names)
 * and weak signals (assessment terminology, pedagogical language).
 *
 * @param text - Raw extracted document text (first ~3000 chars is usually sufficient)
 * @param filename - Original filename (may contain hints like "MYP" or "GCSE")
 */
export function detectFramework(text: string, filename: string): FrameworkDetection {
  // Use first ~4000 chars for efficiency — framework signals are in headers/metadata
  const scanText = text.slice(0, 4000);
  const scanFilename = filename.toLowerCase();

  const results: Array<{
    key: string;
    name: string;
    score: number;
    signals: string[];
    codes: string[];
    assessmentSignals: string[];
  }> = [];

  for (const fp of FINGERPRINTS) {
    let score = 0;
    const signals: string[] = [];
    const codes: string[] = [];
    const assessmentSignals: string[] = [];

    // Check strong patterns (3 points each)
    for (const pattern of fp.strongPatterns) {
      if (pattern.test(scanText) || pattern.test(scanFilename)) {
        score += 3;
        signals.push(`Strong: ${pattern.source}`);
      }
    }

    // Check weak patterns (1 point each)
    for (const pattern of fp.weakPatterns) {
      if (pattern.test(scanText)) {
        score += 1;
        signals.push(`Weak: ${pattern.source}`);
      }
    }

    // Check curriculum codes (5 points each — very strong signal)
    for (const pattern of fp.codePatterns) {
      const matches = scanText.match(pattern);
      if (matches) {
        score += 5 * matches.length;
        codes.push(...matches);
        signals.push(`Codes: ${matches.join(", ")}`);
      }
    }

    // Check assessment keywords (1 point each)
    for (const keyword of fp.assessmentKeywords) {
      if (scanText.toLowerCase().includes(keyword.toLowerCase())) {
        score += 1;
        assessmentSignals.push(keyword);
      }
    }

    if (score > 0) {
      results.push({ key: fp.key, name: fp.name, score, signals, codes, assessmentSignals });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    return {
      framework: "GENERIC",
      frameworkName: "Generic / Unknown Curriculum",
      confidence: "low",
      signals: ["No curriculum fingerprints detected"],
      curriculumCodes: [],
    };
  }

  const best = results[0];
  const confidence: "high" | "medium" | "low" =
    best.score >= 10 ? "high" :
    best.score >= 4 ? "medium" :
    "low";

  // Map VCAA to ACARA for framework vocabulary (VCAA is the Victorian implementation of ACARA)
  const frameworkKey = best.key === "VCAA_DT" ? "ACARA_DT" : best.key;

  return {
    framework: frameworkKey,
    frameworkName: best.name,
    confidence,
    signals: best.signals,
    curriculumCodes: best.codes,
    assessmentModel: best.assessmentSignals.length > 0
      ? `Assessment terms: ${best.assessmentSignals.join(", ")}`
      : undefined,
  };
}

/**
 * Build a prompt block describing the detected framework for the AI extraction prompt.
 * This tells the AI what the criterion labels mean and how to interpret the document.
 */
export function buildFrameworkContextForExtraction(detection: FrameworkDetection): string {
  if (detection.framework === "GENERIC" || detection.confidence === "low") {
    return `CURRICULUM FRAMEWORK: Unknown or generic. Do NOT assume MYP criteria (A/B/C/D). Extract any assessment criteria or objectives exactly as they appear in the document. If the document uses its own rubric or achievement scale, preserve that verbatim.`;
  }

  const frameworkBlocks: Record<string, string> = {
    IB_MYP: `CURRICULUM FRAMEWORK: IB MYP Design
- Criteria: A (Inquiring & Analysing), B (Developing Ideas), C (Creating the Solution), D (Evaluating)
- Assessment: Achievement levels 1-8 per criterion
- Map activities to criteria A/B/C/D based on which phase of the design cycle they belong to`,

    ACARA_DT: `CURRICULUM FRAMEWORK: Australian Curriculum Design & Technologies (ACARA/VCAA)
- Outcomes: KU (Knowledge & Understanding), P&P (Processes & Production Skills)
- Assessment: A-E grade bands with achievement standards
- Victorian curriculum codes start with VCDST*
- Assessment scale may use: Extending, Proficient, Consolidating, Developing, Beginning, Needs Attention
- Do NOT map to MYP criteria A/B/C/D — use the document's own assessment labels
- criterionTags should use the document's own labels (e.g., "KU", "P&P") or generic phase labels`,

    GCSE_DT: `CURRICULUM FRAMEWORK: GCSE Design & Technology (UK)
- Assessment Objectives: AO1-AO5
- NEA (Non-Examined Assessment) = coursework
- Map activities to AO1-AO5 for criterionTags, NOT MYP A/B/C/D`,

    A_LEVEL_DT: `CURRICULUM FRAMEWORK: A-Level Design & Technology (UK)
- Components: C1 (Technical Principles), C2 (Designing & Making Principles), C3 (Design & Make Task)
- Use C1/C2/C3 for criterionTags, NOT MYP A/B/C/D`,

    IGCSE_DT: `CURRICULUM FRAMEWORK: Cambridge IGCSE Design & Technology
- Assessment Objectives: AO1 (Knowledge), AO2 (Problem Solving), AO3 (Design & Making)
- Use AO1/AO2/AO3 for criterionTags`,

    PLTW: `CURRICULUM FRAMEWORK: Project Lead The Way (US)
- Performance expectations across IED/POE/CEA/DE courses
- Rubric-based: Below Basic, Basic, Proficient, Advanced
- Use generic phase labels for criterionTags`,
  };

  let block = frameworkBlocks[detection.framework] || "";

  if (detection.curriculumCodes.length > 0) {
    block += `\n- Curriculum codes found: ${detection.curriculumCodes.join(", ")}`;
  }

  if (detection.assessmentModel) {
    block += `\n- ${detection.assessmentModel}`;
  }

  return block;
}
