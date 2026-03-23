/**
 * Year Level Derivation Utilities
 *
 * graduation_year is the STABLE ANCHOR stored in the DB (never changes).
 * The displayed year level is DERIVED from it each academic year,
 * so students auto-advance without manual updates.
 *
 * Formula: graduation_year = academic_end_year + (13 - year_level)
 * Inverse: year_level = 13 - (graduation_year - academic_end_year)
 *
 * Example: Year 9 in 2026 academic year → graduation_year = 2026 + (13 - 9) = 2030
 * Next year: year_level = 13 - (2030 - 2027) = 10 → auto-advances to Year 10
 */

/**
 * Get the current academic end year.
 * In most school systems (IB, Australian, etc.), the academic year
 * that starts in Aug/Sep 2025 ends in Jun/Jul 2026 → academic_end_year = 2026.
 * If we're in the second half of the calendar year (Jul+), we're in the academic
 * year that ends next calendar year.
 */
export function getAcademicEndYear(now: Date = new Date()): number {
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // Aug-Dec → academic year ends next year
  // Jan-Jul → academic year ends this year
  return month >= 7 ? year + 1 : year;
}

/**
 * Calculate graduation_year from a year level.
 * This is called once when the teacher sets a student's year level.
 */
export function yearLevelToGraduationYear(yearLevel: number, academicEndYear?: number): number {
  const endYear = academicEndYear ?? getAcademicEndYear();
  return endYear + (13 - yearLevel);
}

/**
 * Derive the current year level from graduation_year.
 * Called on every render — students auto-advance each academic year.
 */
export function graduationYearToYearLevel(graduationYear: number, academicEndYear?: number): number {
  const endYear = academicEndYear ?? getAcademicEndYear();
  return 13 - (graduationYear - endYear);
}

/**
 * Get a display string for a year level (e.g. "Year 9", "Year 12").
 * Returns null if graduation_year is null or the derived level is out of range.
 */
export function getYearLevelDisplay(graduationYear: number | null | undefined): string | null {
  if (graduationYear == null) return null;
  const level = graduationYearToYearLevel(graduationYear);
  if (level < 1 || level > 13) return null; // Out of secondary school range
  return `Year ${level}`;
}

/**
 * Get year level as a number, or null if invalid.
 */
export function getYearLevelNumber(graduationYear: number | null | undefined): number | null {
  if (graduationYear == null) return null;
  const level = graduationYearToYearLevel(graduationYear);
  if (level < 1 || level > 13) return null;
  return level;
}

/**
 * Valid year levels for the dropdown (Year 7–13 covers MYP + DP).
 */
export const YEAR_LEVEL_OPTIONS = [7, 8, 9, 10, 11, 12, 13];
