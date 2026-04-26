/**
 * Fabricator download filename builder.
 *
 * Phase 6-6k introduced the helper. Phase 8.1d-19 (Matt's S3 smoke
 * feedback 26 Apr) added two new discriminators because the v1
 * format collided when the same student in the same class submitted
 * different files for the same unit — they all came out as
 * `matt-burton-10-design-cardboard-furniture.svg`, overwriting each
 * other in the lab tech's downloads folder.
 *
 * Produces the display filename the fabricator sees when they
 * download an approved STL / SVG. Teachers and students often upload
 * files with unhelpful names (untitled.svg, final-final-v3.stl,
 * chair.stl × 25 students in the same lab). The fabricator queue
 * needs the filename to be self-describing AND collision-free so
 * prints don't get mixed up on the physical machine.
 *
 * Convention: `{student}-{grade}-{unit}-{originalBase}-{date}-{time}.{ext}`
 * kebab-cased, ASCII-safe, lowercase. Missing fields are skipped
 * rather than left as empty segments. Date is `YYYY-MM-DD`, time is
 * `HHMM` 24-hour, both UTC for stability across teacher/fab time
 * zones. Original extension is preserved (lowercased).
 *
 * Examples:
 *   { studentName: "Matt Burton", gradeLevel: "10 Design",
 *     unitTitle: "Cardboard Furniture",
 *     originalFilename: "chair-v3.svg",
 *     submittedAt: "2026-04-26T14:30:12Z" }
 *   → "matt-burton-10-design-cardboard-furniture-chair-v3-2026-04-26-1430.svg"
 *
 *   { studentName: "Kai", gradeLevel: null, unitTitle: null,
 *     originalFilename: "coaster.svg",
 *     submittedAt: "2026-04-26T09:05:00Z" }
 *   → "kai-coaster-2026-04-26-0905.svg"
 *
 *   { studentName: "", gradeLevel: null, unitTitle: null,
 *     originalFilename: "model.stl", submittedAt: null }
 *   → "model.stl"   (fall back to originalFilename when no context)
 *
 * Why two discriminators (originalBase AND date+time):
 *   - originalBase: catches "chair vs table" intent in a single class
 *     period — students often name files meaningfully even when the
 *     teacher doesn't see the name in the queue.
 *   - date+time: catches re-submissions across days/sessions, and
 *     belt-and-braces against same-named files in the same unit.
 * Together they make collisions practically impossible without
 * losing the structured "who-grade-unit" prefix that lab techs
 * sort by.
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
  /** Phase 8.1d-19: when provided, appends YYYY-MM-DD-HHMM segments
   *  for collision-free filenames across re-submissions. Caller
   *  typically passes the job's `created_at` (or the revision's
   *  `uploaded_at` for finer per-revision granularity). UTC parsing —
   *  the lab tech's timezone doesn't change the filename, which keeps
   *  filesystem sort order consistent across multiple machines. */
  submittedAt?: string | null;
}

/** Phase 8.1d-19: format an ISO timestamp into `YYYY-MM-DD-HHMM`
 *  segments for filename inclusion. Returns empty string for null /
 *  unparseable input — caller skips the segment in that case. UTC
 *  to keep the output stable across regions. */
function formatTimestampSegment(iso: string | null | undefined): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}${min}`;
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
  const { base: originalBase, ext } = splitExtension(originalFilename);
  const safeExt = ext.toLowerCase();

  // Phase 8.1d-19: assemble all 5 segments in canonical order:
  //   student → grade → unit → originalBase → date+time
  // Each segment slugifies independently and contributes only if
  // non-empty after slug. The originalBase + date segments are the
  // collision-resistance layer — without them, two files from the
  // same student/class/unit had the same filename.
  const dateSegment = formatTimestampSegment(input.submittedAt);
  const slugStudent = slugifyForFilename(input.studentName);
  const slugGrade = slugifyForFilename(input.gradeLevel);
  const slugUnit = slugifyForFilename(input.unitTitle);
  const slugOriginalBase = slugifyForFilename(originalBase);

  const contextParts = [slugStudent, slugGrade, slugUnit].filter(
    (p) => p.length > 0
  );

  // No usable student/grade/unit context. Fall back to the slugified
  // original — same v1 behaviour, just with the date segment added if
  // available so even pure-fallback names don't collide across days.
  if (contextParts.length === 0) {
    if (!slugOriginalBase) {
      // Original was all garbage too — last-ditch fallback (with date
      // if we have one).
      const dated = dateSegment
        ? `fabrication-${dateSegment}`
        : "fabrication";
      return safeExt ? `${dated}.${safeExt}` : dated;
    }
    const dated = dateSegment
      ? `${slugOriginalBase}-${dateSegment}`
      : slugOriginalBase;
    return safeExt ? `${dated}.${safeExt}` : dated;
  }

  // Full path: student-grade-unit-originalBase-date.ext.
  // originalBase is included even when context is present — that's
  // the new collision discriminator from 8.1d-19.
  const allParts = [...contextParts];
  if (slugOriginalBase) allParts.push(slugOriginalBase);
  if (dateSegment) allParts.push(dateSegment);

  const base = allParts.join("-");
  return safeExt ? `${base}.${safeExt}` : base;
}
