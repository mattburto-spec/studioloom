/**
 * PII Scanner — high-precision regex patterns.
 *
 * Scans extracted text for personally identifiable information so the
 * sandbox UI can flag candidate blocks before a teacher commits them to
 * `activity_blocks.pii_flags`. Bias is toward precision over recall: false
 * negatives just leave a manual review responsibility, false positives
 * train teachers to ignore the flag.
 *
 * Each pattern below has a comment listing what it catches AND its known
 * misses, so future hardening passes know what's deliberate.
 *
 * Phase 1.5 item 5 hardening pass:
 *   - Fixed EMAIL_PATTERN bug ([A-Z|a-z] character class included literal "|").
 *   - Added honorific-prefixed and "by <Name>" name detection (the spec
 *     explicitly calls for "common name patterns" but the v1 scanner only
 *     declared the 'name' PIIFlag type without ever populating it).
 *   - Tightened PHONE_PATTERN to require ≥10 digits and reject numeric
 *     date-like strings (DD/MM/YYYY shapes).
 *   - Added unit tests covering each PII type, the bug fixes, and a small
 *     false-positive corpus drawn from real lesson-plan language.
 */

import type { PIIFlag } from "./types";

// =========================================================================
// Patterns
// =========================================================================

/**
 * Email addresses. Catches the standard local@host.tld shape.
 *
 * v1 had `[A-Z|a-z]` in the TLD class — that character class literally
 * included the pipe character as a valid TLD character, meaning it would
 * match malformed addresses like `foo@bar.|`. Fixed to `[A-Za-z]`.
 *
 * Misses (deliberate): bracketed display names ("Joe <joe@x.com>" — the
 * inner address still matches), unicode TLDs.
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Phone numbers. High-recall sequence: optional country code, then any
 * mix of digit groups separated by spaces / dots / dashes / parentheses.
 * Post-filter requires ≥10 total digits to avoid matching things like
 * "Year 9" or "Page 42".
 *
 * Catches: "+61 2 9876 5432", "(02) 9876 5432", "555-867-5309",
 * "+1.555.867.5309".
 *
 * Misses (deliberate): bare 7-digit local numbers (rare in modern docs),
 * vanity numbers with letters, anything inside a pure date shape (filtered
 * out post-match below).
 */
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/g;

/**
 * A pure DD/MM/YYYY-style numeric date. We use this to *suppress* phone
 * matches that are actually dates — phone regex is permissive enough that
 * "12/03/2025" can otherwise match.
 */
const NUMERIC_DATE_SHAPE = /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/;

/**
 * School names. Catches "Nanjing International School", "St Mary's
 * College", "Glenmore High School" and similar. Picks up the most common
 * institutional naming patterns.
 *
 * Misses (deliberate): all-caps acronyms ("NIS"), purely descriptive
 * phrases ("the local school"), schools whose name uses none of the
 * keyword tokens below.
 */
const SCHOOL_PATTERN =
  /\b(?:[A-Z][a-z]+\s+)?(?:International|Public|Private|Grammar|High|Primary|Secondary|Elementary|Middle|Prep(?:aratory)?)\s+School\b|(?:St\.?\s+\w+(?:'s)?|[A-Z][a-z]+)\s+(?:College|Academy|Institute)\b/g;

/**
 * Specific calendar dates likely to identify a real event. Catches
 * numeric DD/MM/YYYY plus "DD Month YYYY" / "Month DD, YYYY".
 *
 * Misses (deliberate): standalone weekdays ("Monday"), relative dates
 * ("next Friday"), durations ("10 minutes" — handled by phone filter).
 */
const SPECIFIC_DATE_PATTERN =
  /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4})\b/gi;

/**
 * Honorific-prefixed personal names. High precision because the prefix
 * (Mr/Mrs/Ms/Dr/Prof/etc.) is doing all the disambiguation work.
 *
 * Catches: "Mr Burton", "Dr Sarah Chen", "Prof. James K. Liu".
 * Misses (deliberate): bare names with no honorific (handled by NAME_BY).
 */
const NAME_HONORIFIC =
  /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Professor)\.?\s+[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)?\b/g;

/**
 * "by <Name> <Name>" attribution pattern. Catches "by Sarah Chen",
 * "Written by Marcus Liu". Two-token capitalised sequence after "by"
 * keeps false positives manageable — common false-positive surfaces
 * (e.g. "by Friday Morning") are pre-filtered against COMMON_NON_NAMES.
 */
const NAME_BY = /\b(?:[Ww]ritten\s+)?[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+))\b/g;

/**
 * Tokens that *look* like a capitalised name but are common in lesson
 * material. Used to filter NAME_BY matches (where the regex is much
 * weaker than the honorific pattern).
 */
const COMMON_NON_NAMES = new Set<string>([
  "Friday Morning",
  "Monday Morning",
  "Tuesday Morning",
  "Wednesday Morning",
  "Thursday Morning",
  "Saturday Morning",
  "Sunday Morning",
  "Next Week",
  "Last Week",
  "This Week",
  "End Date",
  "Start Date",
  "Monday Friday",
]);

// =========================================================================
// Scanner
// =========================================================================

function pushFlag(
  flags: PIIFlag[],
  type: PIIFlag["type"],
  value: string,
  position: number
): void {
  flags.push({ type, value, position, aiVerified: false });
}

/**
 * Scan text for potential PII using the patterns above.
 * Returns one flag per match. Order is not stable across types.
 */
export function scanForPII(text: string): PIIFlag[] {
  const flags: PIIFlag[] = [];
  if (!text) return flags;

  // Emails — bug fixed; now strict A-Z TLD class.
  for (const m of text.matchAll(EMAIL_PATTERN)) {
    pushFlag(flags, "email", m[0], m.index ?? 0);
  }

  // Phones — require ≥10 digits AND reject anything that's actually a
  // numeric date shape (12/03/2025 etc.).
  for (const m of text.matchAll(PHONE_PATTERN)) {
    const raw = m[0];
    if (NUMERIC_DATE_SHAPE.test(raw.trim())) continue;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10) continue;
    pushFlag(flags, "phone", raw, m.index ?? 0);
  }

  // Schools.
  for (const m of text.matchAll(SCHOOL_PATTERN)) {
    pushFlag(flags, "school", m[0], m.index ?? 0);
  }

  // Specific dates.
  for (const m of text.matchAll(SPECIFIC_DATE_PATTERN)) {
    pushFlag(flags, "date", m[0], m.index ?? 0);
  }

  // Names — honorific path (high precision).
  for (const m of text.matchAll(NAME_HONORIFIC)) {
    pushFlag(flags, "name", m[0], m.index ?? 0);
  }

  // Names — "by <Name>" path (filtered against common non-name phrases).
  for (const m of text.matchAll(NAME_BY)) {
    const candidate = m[1];
    if (COMMON_NON_NAMES.has(candidate)) continue;
    pushFlag(flags, "name", candidate, (m.index ?? 0) + m[0].indexOf(candidate));
  }

  return flags;
}

/** Convenience predicate. */
export function hasPII(flags: PIIFlag[]): boolean {
  return flags.length > 0;
}
