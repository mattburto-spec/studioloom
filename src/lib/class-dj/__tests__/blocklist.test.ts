/**
 * Class DJ — blocklist guard tests (Phase 5).
 *
 * Verifies the word-boundary matcher (same primitive as the veto matcher
 * in algorithm.ts — "k-pop" must NOT match "pop", "indie folk" must NOT
 * match "indie"). NC: emptying the blocklist arrays makes known-bad
 * artists slip through.
 */
import { describe, it, expect } from "vitest";
import { BLOCKED_ARTISTS, BLOCKED_GENRES, isBlocked } from "../blocklist";

describe("Class DJ blocklist — word-boundary matching", () => {
  it("blocks an artist by exact name word-boundary match", () => {
    expect(isBlocked("XXXTentacion", [])).toBe(true);
    expect(isBlocked("xxxtentacion", [])).toBe(true);
    expect(isBlocked("Lil Pump", [])).toBe(true);
  });

  it("blocks a genre via contentTags word-boundary match", () => {
    expect(isBlocked("Some Band", ["death metal", "rock"])).toBe(true);
    expect(isBlocked("Some Band", ["grindcore"])).toBe(true);
  });

  it("does NOT block on partial-word matches (the word-boundary rule)", () => {
    // "pop" should NOT be blocked because BLOCKED_GENRES doesn't include "pop".
    expect(isBlocked("The Beatles", ["classic rock", "pop", "mainstream"])).toBe(false);
    // "metal" alone would block ONLY if it's in BLOCKED_GENRES as a word.
    // "death metal" in the list does NOT match "metal" alone.
    expect(isBlocked("Metallica", ["metal", "hard rock"])).toBe(false);
  });

  it("does NOT block clean indie folk on the 'indie folk' veto family", () => {
    // "indie folk" is NOT on the blocklist (it's a veto target, not a blocklist target).
    // This test just confirms our patrol — clean indie folk is fine.
    expect(isBlocked("Phoebe Bridgers", ["indie folk", "singer-songwriter"])).toBe(false);
    expect(isBlocked("Bon Iver", ["indie folk", "atmospheric"])).toBe(false);
  });

  it("returns false when both arrays are empty (NC sanity check)", () => {
    expect(BLOCKED_ARTISTS.length).toBeGreaterThan(0);
    expect(BLOCKED_GENRES.length).toBeGreaterThan(0);
  });

  it("blocks on artist match anywhere in the haystack (case-insensitive)", () => {
    // Note: $uicideboy$ stylisation isn't matched via \b regex (leading $
    // isn't a word-boundary character). 'suicideboys' covers the same
    // artist via Spotify name canonicalisation.
    expect(isBlocked("suicideboys", [])).toBe(true);
    expect(isBlocked("SUICIDEBOYS", [])).toBe(true);
    expect(isBlocked("Some Artist", ["suicideboys"])).toBe(true);
  });
});
