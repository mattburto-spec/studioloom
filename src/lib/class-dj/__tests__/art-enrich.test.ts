/**
 * Class DJ — art-enrichment drop logic tests.
 *
 * Tests enrichCandidatePool() drop predicates without hitting the
 * Deezer API. Uses the searchImpl test seam to mock outcomes.
 *
 * Drop rules:
 *   1. No provider match → drop with reason "no_spotify_match" (legacy
 *      string name preserved for diagnostic-response stability)
 *   2. Blocklist hit (pre-checked BEFORE network call) → drop with
 *      reason "blocklist"
 *   3. Survivors get imageUrl attached from the provider hit
 *   4. When provider is unavailable (probe returns false), candidates
 *      pass through without enrichment instead of being dropped
 *
 * History: original file was spotify-enrich.test.ts. Renamed 15 May 2026
 * when Spotify started gating /v1/search behind Premium and we swapped
 * to Deezer's free public API.
 */
import { describe, it, expect } from "vitest";
import { enrichCandidatePool, searchArtistArt } from "../art-enrich";
import type { Candidate } from "../types";

function makeCandidate(over: Partial<Candidate> & { name: string }): Candidate {
  return {
    name: over.name,
    kind: over.kind ?? "artist",
    moodTags: over.moodTags ?? ["vibe"],
    energyEstimate: over.energyEstimate ?? 3,
    contentTags: over.contentTags ?? [],
    whyKernel: over.whyKernel,
    seedOrigin: over.seedOrigin ?? null,
  };
}

type SearchHit = Awaited<ReturnType<typeof searchArtistArt>>;

function mockSearch(map: Record<string, SearchHit>): typeof searchArtistArt {
  return async (name: string) => map[name] ?? null;
}

const TOKEN_PROBE_AVAILABLE = () => Promise.resolve(true);

describe("enrichCandidatePool — drop predicates (provider available)", () => {
  it("drops candidates with no provider match", async () => {
    const pool = [makeCandidate({ name: "Fake Hallucinated Artist" })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({}),
      tokenProbe: TOKEN_PROBE_AVAILABLE,
    });
    expect(enriched).toHaveLength(0);
    expect(drops).toEqual([
      { name: "Fake Hallucinated Artist", reason: "no_spotify_match" },
    ]);
  });

  it("drops blocklist hits BEFORE making a provider call", async () => {
    // XXXTentacion is on BLOCKED_ARTISTS — the search should never be called.
    let searchCalled = 0;
    const pool = [makeCandidate({ name: "XXXTentacion" })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: async () => {
        searchCalled++;
        return null;
      },
      tokenProbe: TOKEN_PROBE_AVAILABLE,
    });
    expect(searchCalled).toBe(0); // pre-check skipped the network call
    expect(enriched).toHaveLength(0);
    expect(drops).toEqual([{ name: "XXXTentacion", reason: "blocklist" }]);
  });

  it("survivors get imageUrl attached + canonical name from provider", async () => {
    const pool = [
      makeCandidate({ name: "phoebe bridgers", moodTags: ["vibe"], energyEstimate: 2 }),
    ];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "phoebe bridgers": {
          provider_id: "pb-id",
          artist_name: "Phoebe Bridgers", // canonical capitalisation
          image_url: "https://e-cdns-images.dzcdn.net/.../pb.jpg",
          external_url: "https://www.deezer.com/artist/pb-id",
        },
      }),
      tokenProbe: TOKEN_PROBE_AVAILABLE,
    });
    expect(enriched).toHaveLength(1);
    expect(drops).toHaveLength(0);
    expect(enriched[0].name).toBe("Phoebe Bridgers"); // canonical name wins
    expect(enriched[0].imageUrl).toBe("https://e-cdns-images.dzcdn.net/.../pb.jpg");
    expect(enriched[0].explicit).toBe(false);
    // Preserved fields:
    expect(enriched[0].moodTags).toEqual(["vibe"]);
    expect(enriched[0].energyEstimate).toBe(2);
  });

  it("handles a mixed pool (survivors + drop reasons)", async () => {
    const pool = [
      makeCandidate({ name: "Phoebe Bridgers", moodTags: ["vibe"] }),
      makeCandidate({ name: "Lil Pump" }),              // blocklist
      makeCandidate({ name: "Made Up Band X" }),         // no match
    ];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "Phoebe Bridgers": {
          provider_id: "pb",
          artist_name: "Phoebe Bridgers",
        },
      }),
      tokenProbe: TOKEN_PROBE_AVAILABLE,
    });
    expect(enriched.map((c) => c.name)).toEqual(["Phoebe Bridgers"]);
    expect(drops).toHaveLength(2);
    expect(drops.map((d) => d.reason).sort()).toEqual(["blocklist", "no_spotify_match"]);
  });
});

describe("enrichCandidatePool — graceful degradation when provider is unavailable", () => {
  const TOKEN_PROBE_UNAVAILABLE = () => Promise.resolve(false);

  it("passes non-blocklisted candidates through with no imageUrl", async () => {
    let searchCalled = 0;
    const pool = [makeCandidate({ name: "Phoebe Bridgers" })];
    const { enriched, drops, spotifyDegraded } = await enrichCandidatePool(pool, {
      searchImpl: async () => {
        searchCalled++;
        return null;
      },
      tokenProbe: TOKEN_PROBE_UNAVAILABLE,
    });
    expect(spotifyDegraded).toBe(true);
    expect(searchCalled).toBe(0); // never hit provider
    expect(enriched).toHaveLength(1);
    expect(enriched[0].name).toBe("Phoebe Bridgers");
    expect(enriched[0].imageUrl).toBeUndefined();
    expect(drops).toHaveLength(0);
  });

  it("still applies blocklist when provider is unavailable", async () => {
    const pool = [
      makeCandidate({ name: "Phoebe Bridgers" }),
      makeCandidate({ name: "XXXTentacion" }), // BLOCKED_ARTISTS hit
    ];
    const { enriched, drops, spotifyDegraded } = await enrichCandidatePool(pool, {
      tokenProbe: TOKEN_PROBE_UNAVAILABLE,
    });
    expect(spotifyDegraded).toBe(true);
    expect(enriched.map((c) => c.name)).toEqual(["Phoebe Bridgers"]);
    expect(drops).toEqual([{ name: "XXXTentacion", reason: "blocklist" }]);
  });

  it("normal mode returns spotifyDegraded:false", async () => {
    const pool = [makeCandidate({ name: "Phoebe Bridgers" })];
    const { spotifyDegraded } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "Phoebe Bridgers": {
          provider_id: "pb",
          artist_name: "Phoebe Bridgers",
        },
      }),
      tokenProbe: TOKEN_PROBE_AVAILABLE,
    });
    expect(spotifyDegraded).toBe(false);
  });
});
