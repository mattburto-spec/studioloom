/**
 * Validates a JSON file uploaded to /teacher/library/import.
 *
 * Lets a teacher hand-author (or generate via Cowork) a complete unit and
 * import it without going through the AI classify → reconstruct pipeline.
 *
 * Envelope:
 *   {
 *     "format": "studioloom-unit-v1",
 *     "title": string,
 *     "description"?: string,
 *     "gradeLevel"?: string,
 *     "topic"?: string,
 *     "unitType"?: "design" | "service" | "personal_project" | "inquiry",
 *     "contentData": UnitContentDataV2 | UnitContentDataV3 | UnitContentDataV4
 *   }
 *
 * Returns either the post-ready payload for `POST /api/teacher/units`
 * (action: "create") or a list of human-readable validation errors keyed by
 * dotted field path so the importer UI can show exactly what's wrong.
 */

const FORMAT = "studioloom-unit-v1";
const VALID_UNIT_TYPES = ["design", "service", "personal_project", "inquiry"] as const;
const VALID_TIMELINE_ROLES = ["warmup", "intro", "core", "reflection", "content"] as const;
const VALID_TIME_WEIGHTS = ["quick", "moderate", "extended", "flexible"] as const;

export interface UnitJsonValidationError {
  path: string;
  message: string;
}

export interface ParsedUnitJson {
  title: string;
  contentData: Record<string, unknown>;
  description?: string;
  gradeLevel?: string;
  topic?: string;
  unitType?: string;
}

export type UnitJsonValidationResult =
  | { ok: true; payload: ParsedUnitJson; warnings: string[] }
  | { ok: false; errors: UnitJsonValidationError[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function pushErr(errs: UnitJsonValidationError[], path: string, message: string) {
  errs.push({ path, message });
}

/**
 * Parses raw text and validates the studioloom-unit-v1 envelope + contentData.
 * Accepts the file *content* (string), not the File object — caller is
 * responsible for reading the file.
 */
export function validateUnitJson(rawText: string): UnitJsonValidationResult {
  const errors: UnitJsonValidationError[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return {
      ok: false,
      errors: [
        {
          path: "(root)",
          message: `Invalid JSON: ${e instanceof Error ? e.message : "parse failed"}`,
        },
      ],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      errors: [{ path: "(root)", message: "Top-level value must be a JSON object." }],
    };
  }

  // ── Envelope ───────────────────────────────────────────────
  if (parsed.format !== undefined && parsed.format !== FORMAT) {
    pushErr(
      errors,
      "format",
      `Expected "${FORMAT}", got ${JSON.stringify(parsed.format)}.`
    );
  } else if (parsed.format === undefined) {
    warnings.push(`Missing "format" field — assuming "${FORMAT}".`);
  }

  if (!nonEmptyString(parsed.title)) {
    pushErr(errors, "title", "Required, non-empty string.");
  }

  for (const key of ["description", "gradeLevel", "topic"] as const) {
    if (parsed[key] !== undefined && typeof parsed[key] !== "string") {
      pushErr(errors, key, "Must be a string if provided.");
    }
  }

  if (parsed.unitType !== undefined) {
    if (
      typeof parsed.unitType !== "string" ||
      !VALID_UNIT_TYPES.includes(parsed.unitType as (typeof VALID_UNIT_TYPES)[number])
    ) {
      pushErr(
        errors,
        "unitType",
        `Must be one of: ${VALID_UNIT_TYPES.join(", ")}.`
      );
    }
  }

  // ── contentData ────────────────────────────────────────────
  if (!isPlainObject(parsed.contentData)) {
    pushErr(errors, "contentData", "Required object.");
    return errors.length ? { ok: false, errors } : { ok: false, errors };
  }

  const cd = parsed.contentData;
  validateContentData(cd, errors, warnings);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    warnings,
    payload: {
      title: (parsed.title as string).trim(),
      contentData: cd,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      gradeLevel: typeof parsed.gradeLevel === "string" ? parsed.gradeLevel : undefined,
      topic: typeof parsed.topic === "string" ? parsed.topic : undefined,
      unitType: typeof parsed.unitType === "string" ? parsed.unitType : undefined,
    },
  };
}

function validateContentData(
  cd: Record<string, unknown>,
  errors: UnitJsonValidationError[],
  warnings: string[]
): void {
  const version = cd.version;
  if (version !== 2 && version !== 3 && version !== 4) {
    pushErr(
      errors,
      "contentData.version",
      "Must be 2 (pages), 3 (journey), or 4 (timeline). Recommended: 4."
    );
    return;
  }

  if (version === 4) {
    validateV4(cd, errors, warnings);
  } else {
    // v2/v3 share the .pages[] shape
    validatePagesShape(cd, errors, version);
  }
}

function validateV4(
  cd: Record<string, unknown>,
  errors: UnitJsonValidationError[],
  warnings: string[]
): void {
  if (cd.generationModel !== "timeline") {
    pushErr(
      errors,
      "contentData.generationModel",
      'For v4, must equal "timeline".'
    );
  }

  if (typeof cd.lessonLengthMinutes !== "number" || cd.lessonLengthMinutes <= 0) {
    pushErr(
      errors,
      "contentData.lessonLengthMinutes",
      "Required positive number (e.g. 60)."
    );
  }

  if (!Array.isArray(cd.timeline)) {
    pushErr(errors, "contentData.timeline", "Required array of activities.");
    return;
  }

  if (cd.timeline.length === 0) {
    warnings.push("contentData.timeline is empty — unit will have no activities.");
    return;
  }

  const seenIds = new Set<string>();
  cd.timeline.forEach((activity, i) => {
    const path = `contentData.timeline[${i}]`;
    if (!isPlainObject(activity)) {
      pushErr(errors, path, "Must be an object.");
      return;
    }

    if (!nonEmptyString(activity.id)) {
      pushErr(errors, `${path}.id`, "Required non-empty string (use nanoid-style 8 chars).");
    } else if (seenIds.has(activity.id)) {
      pushErr(errors, `${path}.id`, `Duplicate id "${activity.id}" — must be unique.`);
    } else {
      seenIds.add(activity.id);
    }

    if (
      typeof activity.role !== "string" ||
      !VALID_TIMELINE_ROLES.includes(activity.role as (typeof VALID_TIMELINE_ROLES)[number])
    ) {
      pushErr(
        errors,
        `${path}.role`,
        `Must be one of: ${VALID_TIMELINE_ROLES.join(", ")}.`
      );
    }

    if (!nonEmptyString(activity.title)) {
      pushErr(errors, `${path}.title`, "Required non-empty string.");
    }

    if (!nonEmptyString(activity.prompt)) {
      pushErr(errors, `${path}.prompt`, "Required non-empty string.");
    }

    if (typeof activity.durationMinutes !== "number" || activity.durationMinutes <= 0) {
      pushErr(
        errors,
        `${path}.durationMinutes`,
        "Required positive number."
      );
    }

    if (
      activity.timeWeight !== undefined &&
      (typeof activity.timeWeight !== "string" ||
        !VALID_TIME_WEIGHTS.includes(activity.timeWeight as (typeof VALID_TIME_WEIGHTS)[number]))
    ) {
      pushErr(
        errors,
        `${path}.timeWeight`,
        `If provided, must be one of: ${VALID_TIME_WEIGHTS.join(", ")}.`
      );
    }

    if (activity.criterionTags !== undefined) {
      if (
        !Array.isArray(activity.criterionTags) ||
        !activity.criterionTags.every((t) => typeof t === "string")
      ) {
        pushErr(
          errors,
          `${path}.criterionTags`,
          "If provided, must be an array of strings."
        );
      }
    }

    for (const optStr of ["phaseLabel", "teacherNotes", "exampleResponse"] as const) {
      if (activity[optStr] !== undefined && typeof activity[optStr] !== "string") {
        pushErr(errors, `${path}.${optStr}`, "Must be a string if provided.");
      }
    }
  });
}

function validatePagesShape(
  cd: Record<string, unknown>,
  errors: UnitJsonValidationError[],
  version: 2 | 3
): void {
  if (!Array.isArray(cd.pages)) {
    pushErr(errors, "contentData.pages", "Required array of pages.");
    return;
  }

  if (version === 3 && cd.generationModel !== "journey") {
    pushErr(
      errors,
      "contentData.generationModel",
      'For v3, must equal "journey".'
    );
  }

  cd.pages.forEach((page, i) => {
    const path = `contentData.pages[${i}]`;
    if (!isPlainObject(page)) {
      pushErr(errors, path, "Must be an object.");
      return;
    }
    if (!nonEmptyString(page.id)) pushErr(errors, `${path}.id`, "Required string.");
    if (!nonEmptyString(page.title)) pushErr(errors, `${path}.title`, "Required string.");
    if (!nonEmptyString(page.type)) pushErr(errors, `${path}.type`, "Required string.");
    if (!isPlainObject(page.content))
      pushErr(errors, `${path}.content`, "Required object.");
  });
}

/**
 * Treat a File as a JSON unit if its name ends `.json` OR its MIME type
 * is application/json. Belt-and-braces because some browsers don't set
 * MIME on drag-drop.
 */
export function isJsonUnitFile(file: File): boolean {
  return (
    file.type === "application/json" ||
    file.name.toLowerCase().endsWith(".json")
  );
}
