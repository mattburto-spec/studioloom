#!/usr/bin/env -S npx tsx
/**
 * Class DJ — Algorithm simulator (Phase 1 dev tool)
 *
 * Runs the deterministic pipeline (Stages 0, 1, 2, 4) against synthetic
 * vote distributions + a hardcoded candidate pool standing in for the
 * Stage 3 LLM output.
 *
 * Usage:
 *   npx tsx scripts/class-dj-simulator.ts                # list scenarios
 *   npx tsx scripts/class-dj-simulator.ts scenario:1     # run one scenario
 *   npx tsx scripts/class-dj-simulator.ts all            # run all 6
 *   npx tsx scripts/class-dj-simulator.ts scenario:1 --json  # json dump
 *
 * Output: human-readable summary + (optional) JSON for snapshot capture.
 *
 * NOT a test runner; the captured-truth tests live in
 * src/lib/class-dj/__tests__/algorithm.test.ts.
 */

import {
  runPipeline,
  type PipelineInput,
  type PipelineOutput,
} from "../src/lib/class-dj/algorithm";
import type { Candidate, FairnessLedgerEntry, Mood, RawVoteInput, Vote } from "../src/lib/class-dj/types";
import { sanitiseInput } from "../src/lib/class-dj/algorithm";

// ---------------------------------------------------------------------------
// Hardcoded candidate pool (17 candidates spanning mood × energy space)
//
// Stand-in for Stage 3 LLM output. Each candidate has:
//   - moodTags: subset of [focus, build, vibe, crit, fun]
//   - energyEstimate: 1..5
//   - contentTags: genre / style markers used for veto-matching
// ---------------------------------------------------------------------------

const POOL: Candidate[] = [
  { name: "Phoebe Bridgers", kind: "artist", moodTags: ["vibe", "crit"], energyEstimate: 2, contentTags: ["indie folk", "singer-songwriter", "melancholy"] },
  { name: "Bon Iver", kind: "band", moodTags: ["vibe", "crit", "focus"], energyEstimate: 2, contentTags: ["indie folk", "atmospheric"] },
  { name: "Lo-Fi Beats", kind: "playlist-concept", moodTags: ["focus"], energyEstimate: 3, contentTags: ["lo-fi", "instrumental", "study"] },
  { name: "Frank Ocean", kind: "artist", moodTags: ["vibe", "crit"], energyEstimate: 3, contentTags: ["r&b", "alternative", "soulful"] },
  { name: "Tame Impala", kind: "band", moodTags: ["vibe", "build"], energyEstimate: 3, contentTags: ["psychedelic", "indie", "dreamy"] },
  { name: "The Beatles", kind: "band", moodTags: ["fun", "vibe", "build"], energyEstimate: 3, contentTags: ["classic rock", "pop", "mainstream"] },
  { name: "Daft Punk", kind: "band", moodTags: ["build", "fun"], energyEstimate: 4, contentTags: ["electronic", "dance", "french house"] },
  { name: "Vampire Weekend", kind: "band", moodTags: ["build", "fun", "vibe"], energyEstimate: 4, contentTags: ["indie rock", "upbeat", "eclectic"] },
  { name: "Studio Ghibli soundtracks", kind: "playlist-concept", moodTags: ["focus", "vibe"], energyEstimate: 2, contentTags: ["orchestral", "cinematic", "instrumental"] },
  { name: "Charli XCX", kind: "artist", moodTags: ["fun"], energyEstimate: 5, contentTags: ["pop", "hyperpop", "dance"] },
  { name: "Beach House", kind: "band", moodTags: ["vibe", "crit"], energyEstimate: 2, contentTags: ["dream pop", "atmospheric"] },
  { name: "Khruangbin", kind: "band", moodTags: ["vibe", "build", "focus"], energyEstimate: 3, contentTags: ["psychedelic", "instrumental", "world"] },
  { name: "Disclosure", kind: "band", moodTags: ["build", "fun"], energyEstimate: 4, contentTags: ["house", "electronic", "dance"] },
  { name: "Sufjan Stevens", kind: "artist", moodTags: ["vibe", "crit"], energyEstimate: 2, contentTags: ["indie folk", "orchestral"] },
  { name: "The Police", kind: "band", moodTags: ["build", "fun"], energyEstimate: 4, contentTags: ["rock", "new wave"] },
  { name: "Kacey Musgraves", kind: "artist", moodTags: ["vibe", "fun"], energyEstimate: 3, contentTags: ["country", "folk", "pop"] },
  { name: "Johnny Cash", kind: "artist", moodTags: ["crit", "vibe"], energyEstimate: 3, contentTags: ["country", "classic"] },
];

// ---------------------------------------------------------------------------
// Vote helpers
// ---------------------------------------------------------------------------

function makeVote(opts: { studentId: string; mood: Mood; energy: number; veto?: string; seed?: string }): Vote {
  return sanitiseInput({
    studentId: opts.studentId,
    mood: opts.mood,
    energy: opts.energy,
    veto: opts.veto ?? null,
    seed: opts.seed ?? null,
  } satisfies RawVoteInput);
}

function uniformVotes(n: number, mood: Mood, energy: number, opts?: { veto?: string; seedFor?: string[]; seedName?: string }): Vote[] {
  return Array.from({ length: n }, (_, i) => {
    const sid = `s${i + 1}`;
    return makeVote({
      studentId: sid,
      mood,
      energy,
      veto: opts?.veto,
      seed: opts?.seedFor?.includes(sid) ? opts.seedName : undefined,
    });
  });
}

// ---------------------------------------------------------------------------
// 6 canonical scenarios
// ---------------------------------------------------------------------------

type ScenarioFn = () => PipelineInput;

const SCENARIOS: Record<string, { description: string; build: ScenarioFn }> = {
  "1": {
    description: "Pure consensus — n=10, all mood=focus energy=3, no vetoes, no seeds",
    build: () => ({
      votes: uniformVotes(10, "focus", 3),
      candidates: POOL,
      classId: "class-fixture-1",
      classRoundIndex: 1,
      suggestCount: 0,
    }),
  },
  "2": {
    description: "Bimodal split — n=10, 5× focus/e2 vs 5× fun/e5",
    build: () => {
      const focus = Array.from({ length: 5 }, (_, i) =>
        makeVote({ studentId: `s${i + 1}`, mood: "focus", energy: 2 })
      );
      const fun = Array.from({ length: 5 }, (_, i) =>
        makeVote({ studentId: `s${i + 6}`, mood: "fun", energy: 5 })
      );
      return {
        votes: [...focus, ...fun],
        candidates: POOL,
        classId: "class-fixture-2",
        classRoundIndex: 1,
        suggestCount: 0,
      };
    },
  },
  "3": {
    description: "Small group n=3 — 1× focus/e2 + 1× build/e3 + 1× vibe/e3 (1 vetoes 'indie folk')",
    build: () => ({
      votes: [
        makeVote({ studentId: "s1", mood: "focus", energy: 2, veto: "indie folk" }),
        makeVote({ studentId: "s2", mood: "build", energy: 3 }),
        makeVote({ studentId: "s3", mood: "vibe", energy: 3 }),
      ],
      candidates: POOL,
      classId: "class-fixture-3",
      classRoundIndex: 1,
      suggestCount: 0,
    }),
  },
  "4": {
    description: "Consensus + veto — n=10, 8× focus/e3 no veto + 2× focus/e3 vetoing 'country'",
    build: () => {
      const clean = Array.from({ length: 8 }, (_, i) =>
        makeVote({ studentId: `s${i + 1}`, mood: "focus", energy: 3 })
      );
      const vetoers = [
        makeVote({ studentId: "s9", mood: "focus", energy: 3, veto: "country" }),
        makeVote({ studentId: "s10", mood: "focus", energy: 3, veto: "country" }),
      ];
      return {
        votes: [...clean, ...vetoers],
        candidates: POOL,
        classId: "class-fixture-4",
        classRoundIndex: 1,
        suggestCount: 0,
      };
    },
  },
  "5": {
    description: "Consensus seed — n=10, all vote vibe/e2 uniformly; 6 of them seed 'Phoebe Bridgers'",
    build: () => {
      // Uniform votes (vibe/e2) avoid k-means outlier-driven split mode and
      // give us a clean consensus to test the seed-detection + fairness-credit
      // pathway against. 6 seeders > threshold=max(3, ceil(10/4))=3 → consensus.
      const seedingStudents = new Set(["s1", "s2", "s3", "s4", "s5", "s6"]);
      const votes = Array.from({ length: 10 }, (_, i) => {
        const sid = `s${i + 1}`;
        return makeVote({
          studentId: sid,
          mood: "vibe",
          energy: 2,
          seed: seedingStudents.has(sid) ? "Phoebe Bridgers" : undefined,
        });
      });
      // Annotate the Phoebe Bridgers candidate with seedOrigin (one of the seeders).
      // In Phase 5 the Stage 3 LLM would do this. In Phase 1 we do it here.
      const candidates = POOL.map((c) =>
        c.name === "Phoebe Bridgers" ? { ...c, seedOrigin: "s1" } : c
      );
      return {
        votes,
        candidates,
        classId: "class-fixture-5",
        classRoundIndex: 1,
        suggestCount: 0,
      };
    },
  },
  "6": {
    description: "Recency penalty — same shape as scenario 1, but recent_suggestions = [Lo-Fi Beats]",
    build: () => ({
      votes: uniformVotes(10, "focus", 3),
      candidates: POOL,
      recentSuggestions: [POOL.find((c) => c.name === "Lo-Fi Beats")!],
      classId: "class-fixture-6",
      classRoundIndex: 2, // second round — recency makes sense
      suggestCount: 0,
    }),
  },
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function summarise(name: string, description: string, input: PipelineInput, out: PipelineOutput): string {
  const lines: string[] = [];
  lines.push(`\n=== SCENARIO ${name} — ${description} ===`);
  lines.push(`n_voted=${input.votes.length}   conflict_mode=${out.conflict.mode}` + (out.conflict.silhouette !== undefined ? `   silhouette=${out.conflict.silhouette.toFixed(4)}` : ""));
  if (out.conflict.clusters) {
    lines.push(`clusters: A=${out.conflict.clusters[0].length} students, B=${out.conflict.clusters[1].length} students`);
  }
  if (out.consensusSeed.hasConsensus) {
    lines.push(`consensus_seed: "${out.consensusSeed.consensusName}" (${out.consensusSeed.echoCount} echoes, threshold=${out.consensusSeed.threshold})`);
  }
  lines.push(`veto_soft_penalty_active=${out.aggregate.vetoSoftPenaltyActive}`);
  lines.push(`prng_seed (first 12)=${out.prngSeed.slice(0, 12)}…`);

  lines.push("\nTop-3 picks (post-shuffle display order):");
  out.selection.picks.forEach((p, i) => {
    const bridge = out.selection.bridgeIndex === i ? "  [bridge]" : "";
    lines.push(
      `  ${i + 1}. ${p.candidate.name}` +
        `  mood_score=${p.moodScore.toFixed(3)} energy_fit=${p.energyFit.toFixed(3)} score²=${p.score2.toFixed(4)}` +
        bridge
    );
  });

  // Show top-5 by raw score² for diagnostic
  const top5 = out.aggregate.scored.slice().sort((a, b) => b.score2 - a.score2).slice(0, 5);
  lines.push("\nTop-5 by raw score² (pre-selection):");
  top5.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.candidate.name}  score²=${s.score2.toFixed(4)}  (mood=${s.moodScore.toFixed(2)} energy=${s.energyFit.toFixed(2)} cleared=${s.vetoCleared})`);
  });

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const jsonMode = argv.includes("--json");
const filteredArgs = argv.filter((a) => a !== "--json");
const target = filteredArgs[0] ?? "list";

function listScenarios(): void {
  console.log("Class DJ Algorithm Simulator");
  console.log("Usage: npx tsx scripts/class-dj-simulator.ts <scenario|all> [--json]");
  console.log("");
  console.log("Scenarios:");
  for (const [k, v] of Object.entries(SCENARIOS)) {
    console.log(`  scenario:${k}   ${v.description}`);
  }
  console.log("  all            run all 6");
}

function runOne(name: string): { input: PipelineInput; output: PipelineOutput } {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${name}. Use 'list' or 'all'.`);
  }
  const input = scenario.build();
  const output = runPipeline(input);
  return { input, output };
}

function main(): void {
  if (target === "list" || target === "--help" || target === "-h") {
    listScenarios();
    return;
  }
  if (target === "all") {
    const allResults: Record<string, { description: string; input: PipelineInput; output: PipelineOutput }> = {};
    for (const [k, scenario] of Object.entries(SCENARIOS)) {
      const { input, output } = runOne(k);
      allResults[k] = { description: scenario.description, input, output };
      if (!jsonMode) {
        console.log(summarise(k, scenario.description, input, output));
      }
    }
    if (jsonMode) {
      console.log(JSON.stringify(allResults, null, 2));
    }
    return;
  }
  const match = target.match(/^scenario:(\d+)$/);
  if (!match) {
    console.error(`Bad argument: ${target}`);
    listScenarios();
    process.exit(2);
  }
  const k = match[1];
  const scenario = SCENARIOS[k];
  const { input, output } = runOne(k);
  if (jsonMode) {
    console.log(JSON.stringify({ description: scenario.description, input, output }, null, 2));
  } else {
    console.log(summarise(k, scenario.description, input, output));
  }
}

main();
