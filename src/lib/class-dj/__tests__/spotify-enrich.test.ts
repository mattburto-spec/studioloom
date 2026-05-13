/**
 * Class DJ — Spotify enrichment drop logic tests (Phase 5).
 *
 * Tests the enrichCandidatePool() drop predicates without hitting the
 * Spotify API. Uses the searchImpl test seam to mock outcomes.
 *
 * Drop rules (brief §3.5 Stage 3 enrichment):
 *   1. No Spotify match → drop with reason "no_spotify_match"
 *   2. Spotify returns explicit: true → drop with reason "explicit"
 *   3. Blocklist hit (pre-checked BEFORE Spotify call) → drop with reason "blocklist"
 *   4. Survivors get image_url / spotify_url / explicit:false attached
 */
import { describe, it, expect } from "vitest";
import { enrichCandidatePool, spotifySearchArtist } from "../spotify-enrich";
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

type SearchHit = Awaited<ReturnType<typeof spotifySearchArtist>>;

function mockSearch(map: Record<string, SearchHit>): typeof spotifySearchArtist {
  return async (name: string) => map[name] ?? null;
}

describe("enrichCandidatePool — drop predicates", () => {
  it("drops candidates with no Spotify match", async () => {
    const pool = [makeCandidate({ name: "Fake Hallucinated Artist" })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({}),
    });
    expect(enriched).toHaveLength(0);
    expect(drops).toEqual([{ name: "Fake Hallucinated Artist", reason: "no_spotify_match" }]);
  });

  it("drops candidates with explicit: true on Spotify", async () => {
    const pool = [makeCandidate({ name: "Edgy Artist" })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "Edgy Artist": {
          spotify_id: "edgy-id",
          artist_name: "Edgy Artist",
          image_url: "https://i.scdn.co/edgy.jpg",
          spotify_url: "https://open.spotify.com/artist/edgy-id",
          popularity: 70,
          explicit: true,
        },
      }),
    });
    expect(enriched).toHaveLength(0);
    expect(drops).toEqual([{ name: "Edgy Artist", reason: "explicit" }]);
  });

  it("drops blocklist hits BEFORE making a Spotify call", async () => {
    // XXXTentacion is on BLOCKED_ARTISTS — the search should never be called.
    let searchCalled = 0;
    const pool = [makeCandidate({ name: "XXXTentacion" })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: async () => {
        searchCalled++;
        return null;
      },
    });
    expect(searchCalled).toBe(0); // pre-check skipped the network call
    expect(enriched).toHaveLength(0);
    expect(drops).toEqual([{ name: "XXXTentacion", reason: "blocklist" }]);
  });

  it("survivors get image_url + spotify_url + explicit:false attached", async () => {
    const pool = [makeCandidate({ name: "phoebe bridgers", moodTags: ["vibe"], energyEstimate: 2 })];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "phoebe bridgers": {
          spotify_id: "pb-id",
          artist_name: "Phoebe Bridgers", // canonical capitalisation
          image_url: "https://i.scdn.co/pb.jpg",
          spotify_url: "https://open.spotify.com/artist/pb-id",
          popularity: 80,
          explicit: false,
        },
      }),
    });
    expect(enriched).toHaveLength(1);
    expect(drops).toHaveLength(0);
    expect(enriched[0].name).toBe("Phoebe Bridgers"); // Spotify canonical name wins
    expect(enriched[0].imageUrl).toBe("https://i.scdn.co/pb.jpg");
    expect(enriched[0].spotifyUrl).toBe("https://open.spotify.com/artist/pb-id");
    expect(enriched[0].explicit).toBe(false);
    // Preserved fields:
    expect(enriched[0].moodTags).toEqual(["vibe"]);
    expect(enriched[0].energyEstimate).toBe(2);
  });

  it("handles a mixed pool (survivor + 3 different drop reasons)", async () => {
    const pool = [
      makeCandidate({ name: "Phoebe Bridgers", moodTags: ["vibe"] }),
      makeCandidate({ name: "Lil Pump" }),              // blocklist
      makeCandidate({ name: "Made Up Band X" }),         // no match
      makeCandidate({ name: "Mature Artist Y" }),        // explicit
    ];
    const { enriched, drops } = await enrichCandidatePool(pool, {
      searchImpl: mockSearch({
        "Phoebe Bridgers": {
          spotify_id: "pb",
          artist_name: "Phoebe Bridgers",
          explicit: false,
        },
        "Mature Artist Y": {
          spotify_id: "y",
          artist_name: "Mature Artist Y",
          explicit: true,
        },
      }),
    });
    expect(enriched.map((c) => c.name)).toEqual(["Phoebe Bridgers"]);
    expect(drops).toHaveLength(3);
    expect(drops.map((d) => d.reason).sort()).toEqual(["blocklist", "explicit", "no_spotify_match"]);
  });
});
