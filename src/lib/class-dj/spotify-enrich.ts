/**
 * Class DJ — Spotify enrichment (Phase 5).
 *
 * Looks up each Stage 3 LLM candidate against the Spotify Web API,
 * attaches album art + deep-link + explicit flag, and DROPS candidates
 * that:
 *   - Spotify returns no match for (LLM hallucination — the artist
 *     doesn't exist or is too obscure to find)
 *   - Have `explicit: true` on their top track
 *   - Match the hand-curated blocklist (src/lib/class-dj/blocklist.ts)
 *
 * Auth: Client Credentials flow (no per-user OAuth needed for search).
 * Token cached in-process for its lifetime (default ~1hr). On 401 we
 * refresh once and retry.
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.5 Stage 3 enrichment,
 * §6 post-AI safety check.
 */

import type { Candidate } from "./types";
import { isBlocked } from "./blocklist";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SEARCH_URL = "https://api.spotify.com/v1/search";

interface SpotifyToken {
  access_token: string;
  expires_at_ms: number; // unix ms
}

interface SpotifyArtist {
  id: string;
  name: string;
  external_urls?: { spotify?: string };
  images?: { url: string; width: number; height: number }[];
  popularity?: number;
}

interface SpotifyTopTrack {
  explicit: boolean;
}

interface SpotifySearchResponse {
  artists?: { items: SpotifyArtist[] };
}

let cachedToken: SpotifyToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at_ms > Date.now() + 30_000) {
    return cachedToken.access_token;
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("[spotify-enrich] SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET must be set");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`[spotify-enrich] token fetch failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: body.access_token,
    expires_at_ms: Date.now() + body.expires_in * 1000,
  };
  return cachedToken.access_token;
}

/**
 * Search for one artist by name. Returns the top hit + their top-track
 * explicit flag, OR null if no match / API error.
 *
 * Test seam: callers can inject `fetchImpl` to mock HTTP.
 */
export async function spotifySearchArtist(
  name: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{
  spotify_id: string;
  artist_name: string;
  image_url?: string;
  spotify_url?: string;
  popularity?: number;
  explicit: boolean;
} | null> {
  const fetchFn = opts.fetchImpl ?? fetch;
  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error("[spotify-enrich] token error", e);
    return null;
  }

  const qs = new URLSearchParams({ q: name, type: "artist", limit: "1" });
  const searchRes = await fetchFn(`${SEARCH_URL}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!searchRes.ok) {
    if (searchRes.status === 401) {
      // Token rejected — clear cache; caller can retry. For one-shot
      // simplicity here we just return null and let the caller drop.
      cachedToken = null;
    }
    return null;
  }
  const body = (await searchRes.json()) as SpotifySearchResponse;
  const top = body.artists?.items?.[0];
  if (!top) return null;

  // Fetch top tracks to read explicit flag on representative tracks.
  // We only need the first track; if it's explicit, treat as explicit.
  const topTracksRes = await fetchFn(
    `https://api.spotify.com/v1/artists/${top.id}/top-tracks?market=US`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  let explicit = false;
  if (topTracksRes.ok) {
    const tt = (await topTracksRes.json()) as { tracks?: SpotifyTopTrack[] };
    explicit = (tt.tracks ?? []).some((t) => t.explicit === true);
  }

  // Pick the medium-sized image if available, else the largest.
  const image = top.images?.find((i) => i.width <= 320) ?? top.images?.[0];

  return {
    spotify_id: top.id,
    artist_name: top.name,
    image_url: image?.url,
    spotify_url: top.external_urls?.spotify,
    popularity: top.popularity,
    explicit,
  };
}

export interface EnrichmentResult {
  /** Survivors — candidates that matched Spotify + cleared explicit + blocklist.
   *  When `spotifyDegraded` is true, this contains non-blocklisted candidates
   *  passed through WITHOUT imageUrl/spotifyUrl (graceful degradation). */
  enriched: Candidate[];
  /** Dropped names with reason (for logging + telemetry). */
  drops: { name: string; reason: "no_spotify_match" | "explicit" | "blocklist" }[];
  /** True when the Spotify API is unavailable (env vars missing, token fetch
   *  failed, etc.) and we passed candidates through without enrichment instead
   *  of dropping them. Lets the route distinguish "infrastructure problem" from
   *  "every candidate is genuinely explicit / blocklisted / hallucinated" — the
   *  former should NOT fail the round; the latter is a real content issue. */
  spotifyDegraded: boolean;
}

/**
 * Probe Spotify availability by attempting a token fetch. Returns true if
 * credentials are configured AND the token endpoint responds. Used by
 * enrichCandidatePool to decide between full enrichment vs graceful
 * degradation. Exposed for the test seam.
 */
export async function probeSpotifyAvailability(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    return Boolean(token);
  } catch (e) {
    console.warn(
      "[spotify-enrich] Spotify unavailable — falling back to no-enrichment passthrough.",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

/**
 * Run a candidate pool through Spotify enrichment. Drops explicit artists +
 * blocklist matches. Hallucination drops (no Spotify match) when Spotify IS
 * available; passthrough (no enrichment, kept in pool) when Spotify is NOT
 * available.
 *
 * Parallelised — each candidate is searched concurrently.
 *
 * Test seams:
 *   - `searchImpl` mocks the per-candidate search call
 *   - `tokenProbe` mocks the upfront availability check (default: real probe)
 */
export async function enrichCandidatePool(
  pool: readonly Candidate[],
  opts: {
    searchImpl?: typeof spotifySearchArtist;
    tokenProbe?: () => Promise<boolean>;
  } = {},
): Promise<EnrichmentResult> {
  const searchFn = opts.searchImpl ?? spotifySearchArtist;
  const probe = opts.tokenProbe ?? probeSpotifyAvailability;

  const spotifyAvailable = await probe();

  // DEGRADED MODE — Spotify is down or unconfigured. Skip network search
  // entirely. Still apply blocklist (local + free + safety-critical). Pass
  // non-blocklisted candidates through without image/spotify URLs. The
  // ClassDjSuggestionView renders 🎵 placeholder when image_url is null,
  // and the green Spotify button was already removed in PR #263 — so the
  // student experience degrades cleanly. Suggestion still appears; just
  // without album art.
  if (!spotifyAvailable) {
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

  // NORMAL MODE — Spotify is available; do the full enrichment.
  const results = await Promise.all(
    pool.map(async (c) => {
      // Pre-check: blocklist BEFORE Spotify hit (saves a network call).
      if (isBlocked(c.name, c.contentTags)) {
        return { c, hit: null, dropReason: "blocklist" as const };
      }
      try {
        const hit = await searchFn(c.name);
        return { c, hit, dropReason: null as null };
      } catch (e) {
        console.error("[spotify-enrich] search error for", c.name, e);
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
    if (r.hit.explicit) {
      drops.push({ name: r.c.name, reason: "explicit" });
      continue;
    }
    enriched.push({
      ...r.c,
      // Prefer Spotify's canonical artist name (handles e.g. "Phoebe
      // Bridgers" vs "phoebe bridgers" capitalisation).
      name: r.hit.artist_name,
      imageUrl: r.hit.image_url,
      spotifyUrl: r.hit.spotify_url,
      explicit: false,
    });
  }

  return { enriched, drops, spotifyDegraded: false };
}
