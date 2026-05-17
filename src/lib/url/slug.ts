// ---------------------------------------------------------------------------
// URL slug helpers (DT canvas Package B, 17 May 2026)
// ---------------------------------------------------------------------------
// Class-canonical canvas URLs land at /teacher/c/<class-slug>-<6id> instead
// of the UUID-soup /teacher/units/<unit-uuid>/class/<class-uuid>. The
// rationale + collision math + scope decisions are in the Package B PR
// description; this module is the building block: name → kebab slug,
// (name, uuid) → `<slug>-<6id>`, and parsing back out.
//
// Why 6 hex chars of suffix: 16,777,216 namespace, vs ~4,096-item
// birthday paradox at 50% collision probability for prefix-alone. But
// collisions only bite when same prefix AND same slug both happen,
// which requires two items with the same name AND the same 6-char UUID
// prefix — vanishingly unlikely at pilot scale. The resolver returns
// null when a collision does happen (caller falls back to a 404 or
// suggests the full UUID URL); the suffix length can grow later
// without breaking already-shipped URLs because the resolver matches
// by prefix.
// ---------------------------------------------------------------------------

/** Length of the UUID prefix appended after the slug. 6 hex chars. */
export const SLUG_ID_PREFIX_LENGTH = 6;

/**
 * Convert a free-form name into a URL-safe kebab-case slug.
 *
 *   "9 Design Science S2"       → "9-design-science-s2"
 *   "CO2 Dragsters #2"          → "co2-dragsters-2"
 *   "Mr. O'Brien's Year 7"      → "mr-obriens-year-7"
 *   "  spaces   collapsed  "    → "spaces-collapsed"
 *   ""                          → "untitled"
 *   "////"                      → "untitled"
 *   "你好-world"                 → "world"  (non-ASCII stripped)
 *
 * Always returns a non-empty string ("untitled" as the fallback) so
 * callers can rely on the slug being a safe URL segment.
 */
export function slugify(name: string | null | undefined): string {
  if (!name) return "untitled";
  const cleaned = name
    .toLowerCase()
    // Strip apostrophes + quotes inside words (don't insert a dash for them)
    .replace(/['']/g, "")
    // Replace any non-alphanumeric run with a single dash
    .replace(/[^a-z0-9]+/g, "-")
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, "");
  return cleaned || "untitled";
}

/**
 * Build a slug-with-ID-prefix for a record:
 *
 *   buildSlugWithId("9 Design Science S2", "b97888a4-c22e-49fb-...")
 *     → "9-design-science-s2-b97888"
 *
 * Throws if the id is shorter than the prefix length (defensive — the
 * caller has a malformed UUID).
 */
export function buildSlugWithId(name: string | null | undefined, id: string): string {
  if (!id || id.length < SLUG_ID_PREFIX_LENGTH) {
    throw new Error(`buildSlugWithId: id is shorter than ${SLUG_ID_PREFIX_LENGTH} chars: ${id}`);
  }
  const idPrefix = id.slice(0, SLUG_ID_PREFIX_LENGTH);
  return `${slugify(name)}-${idPrefix}`;
}

/**
 * Parse a slug-with-id back into its parts:
 *
 *   parseSlugWithId("9-design-science-s2-b97888")
 *     → { slug: "9-design-science-s2", idPrefix: "b97888" }
 *
 *   parseSlugWithId("b97888a4-c22e-49fb-b174-bec306729c2e")  // legacy raw UUID
 *     → { slug: "", idPrefix: "b97888a4-c22e-49fb-b174-bec306729c2e", isRawUuid: true }
 *
 * If the segment doesn't end with a `-<6 hex>` suffix it's treated as a
 * legacy raw UUID and returned as-is in idPrefix with isRawUuid=true.
 * Callers can branch on that flag to keep backward compat for older
 * URLs that pre-date the slug rollout.
 */
export function parseSlugWithId(segment: string): {
  slug: string;
  idPrefix: string;
  isRawUuid: boolean;
} {
  // Legacy raw UUID detection: 36-char string with 4 dashes in the
  // canonical positions.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return { slug: "", idPrefix: segment, isRawUuid: true };
  }
  // New format: <slug>-<6-hex>. Match the suffix at the end.
  const suffixMatch = segment.match(new RegExp(`^(.+)-([0-9a-f]{${SLUG_ID_PREFIX_LENGTH}})$`, "i"));
  if (suffixMatch) {
    return { slug: suffixMatch[1], idPrefix: suffixMatch[2].toLowerCase(), isRawUuid: false };
  }
  // Fallback: treat the whole string as an id-prefix (covers things
  // like a malformed link where the trailing dash got lost). The
  // resolver will likely 404 in this case; this just avoids
  // throwing.
  return { slug: "", idPrefix: segment.toLowerCase(), isRawUuid: false };
}
