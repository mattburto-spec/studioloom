/**
 * PII Scanner — regex patterns first, Haiku verification if flagged.
 *
 * Scans text for personally identifiable information before blocks
 * can be marked `is_public`. Teachers review all flags.
 */

import type { PIIFlag } from "./types";

// =========================================================================
// Regex patterns
// =========================================================================

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const PHONE_PATTERN = /\b(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;

// Patterns for school-like names (e.g., "Nanjing International School", "St Mary's College")
const SCHOOL_PATTERN =
  /\b(?:[A-Z][a-z]+\s+)?(?:International|Public|Private|Grammar|High|Primary|Secondary|Elementary|Middle|Prep(?:aratory)?)\s+School\b|(?:St\.?\s+\w+(?:'s)?|[A-Z][a-z]+)\s+(?:College|Academy|Institute)\b/g;

// Date patterns that might indicate specific events (more specific than just "10 min")
const SPECIFIC_DATE_PATTERN =
  /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4})\b/gi;

// =========================================================================
// Scanner
// =========================================================================

/**
 * Scan text for potential PII using regex patterns.
 * Returns an array of PII flags — each with type, value, and position.
 */
export function scanForPII(text: string): PIIFlag[] {
  const flags: PIIFlag[] = [];

  // Email addresses
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    flags.push({
      type: "email",
      value: match[0],
      position: match.index ?? 0,
      aiVerified: false,
    });
  }

  // Phone numbers — filter out short numbers that are likely durations/counts
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const val = match[0].replace(/\D/g, "");
    if (val.length >= 7) {
      // Likely a real phone number, not "10 min" or "page 42"
      flags.push({
        type: "phone",
        value: match[0],
        position: match.index ?? 0,
        aiVerified: false,
      });
    }
  }

  // School names
  for (const match of text.matchAll(SCHOOL_PATTERN)) {
    flags.push({
      type: "school",
      value: match[0],
      position: match.index ?? 0,
      aiVerified: false,
    });
  }

  // Specific dates
  for (const match of text.matchAll(SPECIFIC_DATE_PATTERN)) {
    flags.push({
      type: "date",
      value: match[0],
      position: match.index ?? 0,
      aiVerified: false,
    });
  }

  return flags;
}

/**
 * Check if any PII was detected in the scan results.
 */
export function hasPII(flags: PIIFlag[]): boolean {
  return flags.length > 0;
}
