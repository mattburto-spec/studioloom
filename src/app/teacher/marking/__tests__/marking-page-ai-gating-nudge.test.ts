/**
 * PR-B (10 May 2026) — source-static guards for AI gating + the
 * "Where's your submission?" nudge button on the marking page.
 *
 * Surfaced during TFL.1 Checkpoint 1.1 round 2 smoke: Matt asked for
 * (1) the AI auto-comment to skip students with empty submissions
 * (no point burning Haiku tokens on null inputs) and (2) a manual
 * one-click nudge for non-submitters.
 *
 * What this PR adds:
 *   - `submitterIdsForActiveTile` useMemo deriving the set of student
 *     IDs with a non-empty response on the active (page, tile) pair.
 *   - `runAiPrescoreBatch` filters the cohort by that set before
 *     calling the AI route.
 *   - "AI suggest (N)" button label → "AI suggest (N/M submitted)"
 *     with N = submitters, M = total cohort.
 *   - The per-row "no submission" empty state grows a primary CTA:
 *     "Send 'Where's your submission?' nudge". One click writes a
 *     canned student_facing_comment via the regular saveTile path
 *     (same column the read-receipt machinery watches), confirms the
 *     row, and surfaces "Nudge sent" once persisted.
 *
 * Lesson #71: pure-logic asserts against the source string. e2e
 * coverage lands when a runtime test harness exists.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("marking page — AI gating to submitters only (PR-B)", () => {
  it("derives submitterIdsForActiveTile via useMemo<Set<string>>", () => {
    expect(src).toMatch(
      /const submitterIdsForActiveTile\s*=\s*useMemo<Set<string>>\(/,
    );
    // Must read from responsesByPage and check non-empty trim().
    const block = src.match(
      /const submitterIdsForActiveTile[\s\S]*?return submitters/,
    );
    expect(block).not.toBeNull();
    const body = block?.[0] ?? "";
    expect(body).toContain("responsesByPage");
    expect(body).toMatch(/\.trim\(\)\.length\s*>\s*0/);
  });

  it("runAiPrescoreBatch filters student_ids to submitters only", () => {
    // Pin the gating: empty submissions don't reach Haiku at all,
    // server-side null-handling is just a safety net.
    expect(src).toMatch(
      /students[\s\S]*?\.filter\(\(id\)\s*=>\s*submitterIdsForActiveTile\.has\(id\)\)/,
    );
    expect(src).toMatch(/student_ids:\s*targetIds/);
    // Also: short-circuit when 0 submitters.
    expect(src).toMatch(/if\s*\(targetIds\.length\s*===\s*0\)\s*return/);
  });

  it("AI suggest button label shows submitters / cohort and disables on 0 submitters", () => {
    expect(src).toMatch(/AI suggest \(\$\{submitterIdsForActiveTile\.size\}\/\$\{students\.length\} submitted\)/);
    expect(src).toMatch(
      /disabled=\{aiBatchRunning\s*\|\|\s*submitterIdsForActiveTile\.size\s*===\s*0\}/,
    );
  });
});

describe("marking page — Where's your submission? nudge (PR-B)", () => {
  it("renders the nudge button data-testid for non-submitters", () => {
    // Every per-row empty-state branch carries marking-nudge-button-<id>
    // so a downstream e2e can target it.
    expect(src).toMatch(
      /data-testid=\{`marking-nudge-button-\$\{s\.id\}`\}/,
    );
    // And the wrapping container is also testid'd for empty-state
    // existence checks.
    expect(src).toMatch(
      /data-testid=\{`marking-no-submission-\$\{s\.id\}`\}/,
    );
  });

  it("sends the canned 'where's your submission?' comment via saveTile (regular comment column)", () => {
    // Persisting through saveTile + student_facing_comment means the
    // read-receipt machinery + chip dot pick it up the same as any
    // teacher-written comment. No special-case path for nudges.
    const onClickMatch = src.match(
      /onClick=\{\(\)\s*=>\s*\{[\s\S]*?cannedNudge[\s\S]*?saveTile\(s\.id[\s\S]*?student_facing_comment:\s*cannedNudge[\s\S]*?\}\)/,
    );
    expect(onClickMatch).not.toBeNull();
    // Confirm the canned text is the SAME shape as the AI route's
    // empty-submission fallback (consistent voice across paths).
    expect(src).toMatch(
      /I can't see a response to this tile yet — give it another go when you're ready/,
    );
  });

  it("nudge button confirms the tile (so the chip counter ticks up)", () => {
    // saveTile(studentId, score, confirmed, extras) — third arg `true`
    // means confirmed. Without confirm=true, NA-style "I sent a nudge,
    // we're done here for now" wouldn't tick the n/m counter.
    expect(src).toMatch(
      /saveTile\(s\.id,\s*score,\s*true,\s*\{[\s\S]*?student_facing_comment:\s*cannedNudge/,
    );
  });

  it("button shows 'Nudge sent' state when the saved comment matches the canned nudge", () => {
    // Idempotent UX — clicking after send is a no-op + visually
    // disambiguates "already nudged" from "needs nudging".
    expect(src).toMatch(
      /const hasSentNudge\s*=\s*\(grade\?\.student_facing_comment\s*\?\?\s*""\)\.trim\(\)\s*===\s*cannedNudge/,
    );
    expect(src).toContain("Nudge sent");
  });
});
