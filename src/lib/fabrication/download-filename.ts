/**
 * Fabricator download filename builder (Phase 6-6k).
 *
 * Produces the display filename the fabricator sees when they
 * download an approved STL / SVG. Teachers and students often upload
 * files with unhelpful names (untitled.svg, final-final-v3.stl,
 * chair.stl × 25 students in the same lab). The fabricator queue
 * needs the filename to be self-describing so prints don't get mixed
 * up on the physical machine.
 *
 * Convention: `{student-name}-{grade}-{unit}.{ext}`, kebab-cased,
 * ASCII-safe, lowercase. Missing fields are skipped rather than
 * left as empty segments. Original extension is preserved.
 *
 * Examples:
 *   { studentName: "Matt Burton", gradeLevel: "10 Design",
 *     unitTitle: "Cardboard Furniture",
 *     originalFilename: "chair-v3.svg" }
 *   → "matt-burton-10-design-cardboard-furniture.svg"
 *
 *   { studentName: "Kai", gradeLevel: null, unitTitle: null,
 *     originalFilename: "coaster.svg" }
 *   → "kai-coaster.svg"
 *
 *   { studentName: "", gradeLevel: null, unitTitle: null,
 *     originalFilename: "model.stl" }
 *   → "model.stl"   (fall back to originalFilename when no context)
 *
 * Will be wired into the fabricator download endpoint when Phase 7
 * ships — currently exists as a ready-to-use helper + locks the
 * naming convention in tests so teachers can assume it.
 */

/** Characters allowed in the final slug — everything else gets
 *  replaced with '-'. Lowercased ASCII letters, digits, hyphen. */
const ALLOWED = /[a-z0-9-]/;

/**
 * Slugify a human string to ASCII-lowercase-kebab. Handles accented
 * characters by stripping diacritics first (NFD normalize + strip
 * combining marks), then replaces anything non-allowed with '-',
 * collapses runs of '-', and trims leading/trailing hyphens.
 *
 * Returns empty string for null / undefined / all-whitespace input.
 */
export function slugifyForFilename(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip diacritics (é → e, ñ → n, etc.). Non-Latin scripts mostly
  // fall through as-is and will be stripped by the allowed-char
  // filter below — acceptable v1 behaviour. PH6-FU-FILENAME-CJK can
  // revisit when a non-Latin class surfaces the issue.
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const out: string[] = [];
  for (const ch of normalized) {
    if (ALLOWED.test(ch)) {
      out.push(ch);
    } else {
      out.push("-");
    }
  }
  // Collapse runs of '-' and strip leading/trailing.
  return out.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Split an "original" filename into (base, ext). Tolerates dotless
 *  names (returns empty ext). Only splits on the LAST dot. */
function splitExtension(filename: string): { base: string; ext: string } {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0) return { base: filename, ext: "" };
  return { base: filename.slice(0, idx), ext: filename.slice(idx + 1) };
}

export interface BuildFilenameInput {
  studentName: string | null | undefined;
  gradeLevel: string | null | undefined;
  unitTitle: string | null | undefined;
  originalFilename: string;
}

/**
 * Build the fabricator-facing download filename.
 *
 * When studentName / gradeLevel / unitTitle are all empty (after
 * slugification), falls back to the originalFilename unchanged —
 * better than producing something like `.svg` with no prefix.
 *
 * Always preserves the original extension (lowercased). An unknown
 * extension (not stl/svg) is still allowed through — validation of
 * allowed filetypes happens at upload time, not here.
 */
export function buildFabricationDownloadFilename(
  input: BuildFilenameInput
): string {
  const { originalFilename } = input;
  const { ext } = splitExtension(originalFilename);

  const parts = [
    slugifyForFilename(input.studentName),
    slugifyForFilename(input.gradeLevel),
    slugifyForFilename(input.unitTitle),
  ].filter((p) => p.length > 0);

  if (parts.length === 0) {
    // No usable context — hand back the original, slugified so we at
    // least don't leak problematic chars into Content-Disposition.
    const { base } = splitExtension(originalFilename);
    const slugBase = slugifyForFilename(base);
    const safeExt = ext.toLowerCase();
    if (!slugBase) {
      // Original was all garbage — last-ditch fallback.
      return safeExt ? `fabrication.${safeExt}` : "fabrication";
    }
    return safeExt ? `${slugBase}.${safeExt}` : slugBase;
  }

  const base = parts.join("-");
  return ext ? `${base}.${ext.toLowerCase()}` : base;
}
