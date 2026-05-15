/**
 * Class DJ — artist art enrichment (provider-agnostic; current impl: Deezer).
 *
 * Replaces the original Spotify-based enrichment after Spotify (May 2026)
 * started gating /v1/search behind Premium subscription. Deezer's public
 * search API is free, no auth required, returns artist images directly,
 * has generous rate limits, and is fast.
 *
 * For each Stage 3 LLM candidate, this module:
 *   1. Looks the artist up on Deezer
 *   2. If found: attaches imageUrl (artist photo) and an external play URL
 *   3. If not found AND probe says provider is alive: drops as no_match
 *      (LLM hallucination)
 *   4. Always applies the local blocklist BEFORE any network call
 *
 * Graceful degradation: if the probe (which tests Deezer with a known-good
 * artist name) fails, all non-blocklisted candidates pass through without
 * enrichment. UI renders 🎵 placeholder. Class DJ stays functional even
 * when Deezer is down.
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.5 Stage 3 enrichment,
 * §6 post-AI safety check.
 */

import type { Candidate } from "./types";
import { isBlocked } from "./blocklist";

const SEARCH_URL = "https://api.deezer.com/search/artist";

interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
}

interface DeezerSearchResponse {
  data?: DeezerArtist[];
  total?: number;
  error?: { type: string; message: string; code: number };
}

/**
 * Search for one artist by name. Returns the top hit's display name +
 * cover image URL + external link, OR null if no match / network error.
 *
 * Test seam: callers can inject `fetchImpl` to mock HTTP.
 */
export async function searchArtistArt(
  name: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{
  provider_id: string;
  artist_name: string;
  image_url?: string;
  external_url?: string;
} | null> {
  const fetchFn = opts.fetchImpl ?? fetch;

  try {
    const qs = new URLSearchParams({ q: name, limit: "1" });
    const res = await fetchFn(`${SEARCH_URL}?${qs}`);
    if (!res.ok) {
      console.error("[art-enrich] search failed", {
        name,
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }
    const body = (await res.json()) as DeezerSearchResponse;
    if (body.error) {
      console.error("[art-enrich] Deezer returned error", body.error);
      return null;
    }
    const top = body.data?.[0];
    if (!top) return null;
    return {
      provider_id: String(top.id),
      artist_name: top.name,
      // Prefer 500x500 (picture_big) — crisp on the 40x40 thumbnail and
      // doesn't get pixelated if we ever expand to a larger card view.
      image_url: top.picture_big ?? top.picture_medium,
      external_url: top.link,
    };
  } catch (e) {
    console.error("[art-enrich] search error for", name, e);
    return null;
  }
}

/**
 * Probe art-provider availability by searching for a known-good artist
 * (Mozart). Returns true only if Deezer responds with a real hit. Lets
 * enrichCandidatePool detect "provider blocked/down" and trigger
 * graceful degradation upfront instead of dropping every candidate.
 */
export async function probeArtAvailability(): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ q: "Mozart", limit: "1" });
    const res = await fetch(`${SEARCH_URL}?${qs}`);
    if (!res.ok) {
      console.warn(
        `[art-enrich] probe failed (HTTP ${res.status}) — falling back to no-enrichment passthrough.`,
      );
      return false;
    }
    const body = (await res.json()) as DeezerSearchResponse;
    if (body.error) {
      console.warn("[art-enrich] probe rejected", body.error);
      return false;
    }
    return Boolean(body.data && body.data.length > 0);
  } catch (e) {
    console.warn(
      "[art-enrich] probe error — falling back to no-enrichment passthrough.",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

export interface EnrichmentResult {
  /** Survivors — candidates that matched the art provider + cleared blocklist.
   *  When `providerDegraded` is true, this contains non-blocklisted candidates
   *  passed through WITHOUT imageUrl (graceful degradation). */
  enriched: Candidate[];
  /** Dropped names with reason (for logging + telemetry). */
  drops: { name: string; reason: "no_spotify_match" | "explicit" | "blocklist" }[];
  /** True when the art provider is unavailable (network down, blocked, etc.)
   *  and we passed candidates through without enrichment instead of dropping
   *  them. Lets the route distinguish "infrastructure problem" from
   *  "every candidate is genuinely blocklisted" — the former should NOT fail
   *  the round; the latter is a real content issue.
   *
   *  Field name kept as `spotifyDegraded` for backward compat with route /
   *  diagnostic-response shape. Semantics now generalised: "art provider
   *  degraded" regardless of which provider. */
  spotifyDegraded: boolean;
}

/**
 * Run a candidate pool through art-provider enrichment. Drops blocklist
 * matches always. Hallucination drops (no match) when provider IS
 * available; passthrough (no enrichment, kept in pool) when provider is
 * NOT available.
 *
 * Drop reason values kept as the original Spotify-era strings
 * ("no_spotify_match" instead of "no_match") so the diagnostic-response
 * shape on /api/student/class-dj/suggest stays stable across the
 * provider swap. Internal label only — the actual matcher is Deezer.
 *
 * Parallelised — each candidate is searched concurrently.
 *
 * Test seams:
 *   - `searchImpl` mocks the per-candidate search call
 *   - `tokenProbe` (legacy name — actually probes art-provider availability)
 *     defaults to real probe
 */
export async function enrichCandidatePool(
  pool: readonly Candidate[],
  opts: {
    searchImpl?: typeof searchArtistArt;
    tokenProbe?: () => Promise<boolean>;
  } = {},
): Promise<EnrichmentResult> {
  const searchFn = opts.searchImpl ?? searchArtistArt;
  const probe = opts.tokenProbe ?? probeArtAvailability;

  const providerAvailable = await probe();

  // DEGRADED MODE — provider is down or blocked. Skip network search
  // entirely. Still apply blocklist (local + free + safety-critical).
  // Pass non-blocklisted candidates through without image URLs. The
  // ClassDjSuggestionView renders 🎵 placeholder when image_url is null,
  // and the green Spotify button was removed in PR #263. Suggestion
  // still appears; just without art.
  if (!providerAvailable) {
    const enriched: Candidate[] = [];
    const drops: EnrichmentResult["drops"] = [];
    for (const c of pool) {
      if (isBlocked(c.name, c.contentTags)) {
        drops.push({ name: c.name, reason: "blocklist" });
        continue;
      }
      enriched.push({
        ...c,
        imageUrl: undefined,
        spotifyUrl: undefined,
        explicit: false,
      });
    }
    return { enriched, drops, spotifyDegraded: true };
  }

  // NORMAL MODE — provider is available; do per-candidate lookups.
  const results = await Promise.all(
    pool.map(async (c) => {
      // Pre-check: blocklist BEFORE network hit (saves a request).
      if (isBlocked(c.name, c.contentTags)) {
        return { c, hit: null, dropReason: "blocklist" as const };
      }
      try {
        const hit = await searchFn(c.name);
        return { c, hit, dropReason: null as null };
      } catch (e) {
        console.error("[art-enrich] search error for", c.name, e);
        return { c, hit: null, dropReason: "no_spotify_match" as const };
      }
    }),
  );

  const enriched: Candidate[] = [];
  const drops: EnrichmentResult["drops"] = [];

  for (const r of results) {
    if (r.dropReason === "blocklist") {
      drops.push({ name: r.c.name, reason: "blocklist" });
      continue;
    }
    if (!r.hit) {
      drops.push({ name: r.c.name, reason: "no_spotify_match" });
      continue;
    }
    enriched.push({
      ...r.c,
      // Prefer the provider's canonical artist name (handles e.g.
      // "phoebe bridgers" → "Phoebe Bridgers" capitalisation).
      name: r.hit.artist_name,
      imageUrl: r.hit.image_url,
      // External link goes into spotifyUrl field for backward compat
      // with the SuggestionItem schema. The Now-Playing banner falls
      // back to a Spotify search URL when this is empty, so we keep
      // it empty here (Deezer link would push students to a platform
      // they likely don't use). Spotify-search is the universal
      // listener entry point.
      spotifyUrl: undefined,
      explicit: false,
    });
  }

  return { enriched, drops, spotifyDegraded: false };
}
