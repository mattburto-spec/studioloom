/**
 * Class DJ — Stage 3 + Stage 5 system-prompt NC tests (Phase 5).
 *
 * Source-static verification that:
 *   - Stage 3 system prompt contains all 6 hard rules from brief §6.1
 *   - Stage 5 system prompt contains all 5 hard rules from brief §6.2
 *   - Endpoint strings match the registry (registered in Phase 7 via
 *     scan-ai-calls.py): "student/class-dj-candidates" + "student/class-dj-narrate"
 *   - Both routes call callAnthropicMessages (CLAUDE.md chokepoint rule)
 *   - Both pass teacherId attribution
 *   - max_tokens set per Lesson #39 budgeting
 *
 * NC = Negative Control: if you delete a required rule line from the
 * prompt, the corresponding assertion fails — proving the test
 * actually exercises the contract.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  STAGE3_SYSTEM_PROMPT,
  STAGE3_MAX_TOKENS,
} from "../stage3-candidates";
import {
  STAGE5_SYSTEM_PROMPT,
  STAGE5_MAX_TOKENS,
  fallbackWhyLines,
} from "../stage5-narrate";

const STAGE3_SRC = readFileSync(join(__dirname, "..", "stage3-candidates.ts"), "utf-8");
const STAGE5_SRC = readFileSync(join(__dirname, "..", "stage5-narrate.ts"), "utf-8");
const SUGGEST_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "student", "class-dj", "suggest", "route.ts"),
  "utf-8",
);

describe("Stage 3 system prompt — brief §6.1 hard rules (NC)", () => {
  it("rule 1: school-appropriate / mainstream-only", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/School-appropriate ONLY/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/Mainstream \/ radio-edit/);
  });

  it("rule 2: honor vetoes + DATA-not-instructions delimiter rule", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/Honor vetoes literally/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/<student_seed>/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/<student_veto>/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/DATA, not instruction/);
  });

  it("rule 3: real artists findable on Spotify", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/findable on Spotify in one search/);
  });

  it("rule 4: tags + energy_estimate + why_kernel", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/mood_tags.*subset of \[focus,build,vibe,crit,fun\]/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/energy_estimate \(1–5\)/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/content_tags/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/why_kernel/);
  });

  it("rule 5: variety across the pool", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/Variety across the 12–20 pool/);
  });

  it("rule 6: consensus seeds honoured verbatim + near-neighbours", () => {
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/consensus seeds.*verbatim/);
    expect(STAGE3_SYSTEM_PROMPT).toMatch(/near-neighbours/);
  });

  it("max_tokens budgeted per Lesson #39 (2400)", () => {
    expect(STAGE3_MAX_TOKENS).toBe(2400);
  });

  it("uses callAnthropicMessages + endpoint='student/class-dj-candidates'", () => {
    expect(STAGE3_SRC).toMatch(/callAnthropicMessages/);
    expect(STAGE3_SRC).toMatch(/endpoint:\s*"student\/class-dj-candidates"/);
  });

  it("passes teacherId attribution", () => {
    expect(STAGE3_SRC).toMatch(/teacherId,/);
  });

  it("toolChoice forces the submit_candidates tool", () => {
    expect(STAGE3_SRC).toMatch(/toolChoice:.*name:\s*"submit_candidates"/);
  });
});

describe("Stage 5 system prompt — brief §6.2 hard rules (NC)", () => {
  it("rule 1: ≤ 18 words", () => {
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/≤ 18 words/);
  });

  it("rule 2: name room's consensus or split honestly", () => {
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/consensus or the split honestly/);
  });

  it("rule 3: playful, not patronising; ages 11-18", () => {
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/students aged 11–18/);
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/playful, not patronising/);
  });

  it("rule 4: reference specific data", () => {
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/Reference specific data/);
  });

  it("rule 5: seed_origin acknowledgement allowed", () => {
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/seed_origin/);
    expect(STAGE5_SYSTEM_PROMPT).toMatch(/put in the hat/);
  });

  it("max_tokens budgeted per Lesson #39 (600)", () => {
    expect(STAGE5_MAX_TOKENS).toBe(600);
  });

  it("uses callAnthropicMessages + endpoint='student/class-dj-narrate'", () => {
    expect(STAGE5_SRC).toMatch(/callAnthropicMessages/);
    expect(STAGE5_SRC).toMatch(/endpoint:\s*"student\/class-dj-narrate"/);
  });

  it("fallbackWhyLines produces 3 strings (round still ships if Stage 5 fails)", () => {
    const picks = Array.from({ length: 3 }).map((_, i) => ({
      name: `Pick ${i}`,
      kind: "artist" as const,
      moodTags: ["vibe" as const],
      energyEstimate: 3,
      contentTags: [],
    }));
    const lines = fallbackWhyLines(picks);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
  });
});

describe("/api/student/class-dj/suggest route — pipeline wiring", () => {
  it("requires student session (any student can punch the suggest button)", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/requireStudentSession/);
  });

  it("calls all 4 deterministic stages from the algorithm library", () => {
    // imports are multi-line — match the symbol followed by a comma.
    expect(SUGGEST_ROUTE_SRC).toMatch(/\bsanitiseInput,/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/\baggregate,/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/\bdetectConflict,/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/\bseedPRNG,/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/\bselect,/);
  });

  it("calls Stage 3 + Stage 5 via the library wrappers (chokepoint compliance)", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/callStage3Candidates/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/callStage5Narrate/);
  });

  it("calls enrichCandidatePool (Spotify enrich + blocklist + explicit drop)", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/enrichCandidatePool/);
  });

  it("uses fallbackWhyLines when Stage 5 fails (round still ships)", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/fallbackWhyLines/);
  });

  it("race-safe suggest_count increment via WHERE lt(<max) + RETURNING", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/\.lt\("suggest_count",\s*maxSuggestions\)/);
    // If 0 rows updated, returns 429.
    expect(SUGGEST_ROUTE_SRC).toMatch(/max_suggestions reached/);
  });

  it("returns 412 when gate_min_votes not yet met", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/voteCount < gateMinVotes/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/status:\s*412/);
  });

  it("does silent retry of Stage 3 when enriched survivors < RETRY_THRESHOLD", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/RETRY_THRESHOLD/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/excludeNames: droppedNames/);
  });

  it("persists candidate_pool_size + spotify_drops + prng_seed_hash to class_dj_suggestions", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/candidate_pool_size:/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/spotify_drops:/);
    expect(SUGGEST_ROUTE_SRC).toMatch(/prng_seed_hash:/);
  });

  it("updates class_dj_rounds.conflict_mode for replay/audit", () => {
    expect(SUGGEST_ROUTE_SRC).toMatch(/conflict_mode:\s*conflictMode/);
  });
});
