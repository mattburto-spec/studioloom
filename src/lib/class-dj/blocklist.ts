/**
 * Class DJ — hand-curated artist + genre blocklist (Phase 5).
 *
 * Belt-and-suspenders safety net beyond Spotify's `explicit` flag. The
 * blocklist catches artists who don't show `explicit: true` on their top
 * track but whose body of work is dominated by themes inappropriate for
 * an under-18 classroom (drug glorification, graphic violence, sexual
 * content, etc.).
 *
 * Matched candidates are eliminated from the Stage 3 candidate pool
 * BEFORE Stage 4 selection. Matching is case-insensitive + word-boundary
 * (the algorithm's veto matcher's primitive — same `\b<phrase>\b` rule
 * to avoid spurious matches).
 *
 * Hand-curated by Matt for v1. Teacher-editable UI deferred to
 * FU-DJ-BLOCKLIST. Add to either array → rebuild + redeploy.
 *
 * Brief: docs/projects/class-dj-block-brief.md §6 (post-AI safety check
 * step 2) + §3.5 Stage 3 enrichment.
 */

/** Artist names — exact word-boundary match on the candidate's `name` field. */
export const BLOCKED_ARTISTS: string[] = [
  // Examples of the family we'd block — many shown by the brief as the
  // "horror screamo" / explicit attack-vector class. These are
  // intentionally conservative for v1; the Spotify `explicit` flag plus
  // the Stage 3 system prompt rules catch most cases.
  "anal cunt",
  "cannibal corpse",
  "lil pump",
  "6ix9ine",
  "tay-k",
  "playboi carti",       // explicit-leaning catalogue
  "ski mask the slump god",
  "lil peep",            // drug-themed
  "xxxtentacion",
  "chief keef",
  "trippie redd",
  "city morgue",
  "death grips",
  "ghostemane",
  // Note: $uicideboy$ stylisation can't be matched via \b regex (leading
  // $ isn't a word-boundary character). 'suicideboys' covers the same
  // artist; Spotify search will canonicalise either spelling.
  "suicideboys",
  "lil tracy",
  "young thug",          // explicit-dominant
  "kodak black",
  "shoreline mafia",
];

/** Genre / content-tag keywords — word-boundary match on contentTags + name. */
export const BLOCKED_GENRES: string[] = [
  "death metal",
  "grindcore",
  "black metal",
  "drill",                // largely explicit catalogue
  "trap-drill",
  "horrorcore",
];

/**
 * Returns true if the candidate matches any blocklist entry via
 * word-boundary regex. Same primitive as algorithm.candidateMatchesVeto.
 */
export function isBlocked(name: string, contentTags: readonly string[]): boolean {
  const haystack = [name.toLowerCase().trim(), ...contentTags.map((t) => t.toLowerCase().trim())].join(" | ");
  for (const entry of [...BLOCKED_ARTISTS, ...BLOCKED_GENRES]) {
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(haystack)) return true;
  }
  return false;
}

export const BLOCKLIST_VERSION = "v1-2026-05-13";
