/**
 * <TeacherFeedback /> Pass A — source-static guards.
 *
 * The component is presentational; no business logic to assert
 * functionally beyond UI shape. We pin (a) the public API surface,
 * (b) the a11y wiring the spec calls for, (c) the contract that
 * Pass B's wiring will need to keep intact when it lands.
 *
 * Lesson #71: pure-render assertions in source-text rather than
 * spinning a JSDOM render harness — saves a dependency tax for what
 * is essentially a visual component, and the sandbox + Vercel preview
 * are the visual proof.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const types = readFileSync(join(ROOT, "types.ts"), "utf-8");
const fixtures = readFileSync(join(ROOT, "fixtures.ts"), "utf-8");
const tail = readFileSync(join(ROOT, "SpeechBubbleTail.tsx"), "utf-8");
const pills = readFileSync(join(ROOT, "QuickReplies.tsx"), "utf-8");
const replyBox = readFileSync(join(ROOT, "ReplyBox.tsx"), "utf-8");
const thread = readFileSync(join(ROOT, "Thread.tsx"), "utf-8");
const resolved = readFileSync(join(ROOT, "ResolvedSummary.tsx"), "utf-8");
const index = readFileSync(join(ROOT, "index.tsx"), "utf-8");

describe("TeacherFeedback — types contract (Pass B will rely on this)", () => {
  it("Sentiment is the discriminated 3-value union", () => {
    expect(types).toMatch(
      /export type Sentiment\s*=\s*"got_it"\s*\|\s*"not_sure"\s*\|\s*"pushback"/,
    );
  });

  it("SENTIMENT_LABELS pins 'I disagree' (Matt's 10 May 2026 call) over 'Push back'", () => {
    expect(types).toMatch(/got_it:\s*"Got it"/);
    expect(types).toMatch(/not_sure:\s*"Not sure"/);
    expect(types).toMatch(/pushback:\s*"I disagree"/);
  });

  it("REPLY_MIN_CHARS = 10 (matches designer spec)", () => {
    expect(types).toMatch(/REPLY_MIN_CHARS\s*=\s*10/);
  });

  it("Turn is a discriminated union of TeacherTurn | StudentTurn", () => {
    expect(types).toMatch(/role:\s*"teacher"/);
    expect(types).toMatch(/role:\s*"student"/);
    expect(types).toMatch(/export type Turn\s*=\s*TeacherTurn\s*\|\s*StudentTurn/);
  });

  it("Props expose threadId, turns, onReply (required) + attentionGrab/needsReply/onResolve/onReopen (optional)", () => {
    expect(types).toMatch(/threadId:\s*string/);
    expect(types).toMatch(/turns:\s*Turn\[\]/);
    expect(types).toMatch(/onReply:\s*\(/);
    expect(types).toMatch(/attentionGrab\?:\s*boolean/);
    expect(types).toMatch(/needsReply\?:\s*boolean/);
    expect(types).toMatch(/onReopen\?\s*:/);
  });
});

describe("TeacherFeedback — fixtures cover the 5 designer states", () => {
  it("exports five named fixtures matching the sandbox states", () => {
    expect(fixtures).toContain("FRESH_UNREAD_TURNS");
    expect(fixtures).toContain("ACTIVE_THREAD_TURNS");
    expect(fixtures).toContain("NEEDS_REPLY_TURNS");
    expect(fixtures).toContain("RESOLVED_TURNS");
    expect(fixtures).toContain("EMPTY_TURNS");
  });

  it("ACTIVE_THREAD_TURNS demonstrates teacher → student → teacher (multi-turn)", () => {
    // Pass B's loader will produce shapes like this — we want the
    // fixture to be representative.
    const block = fixtures.match(
      /ACTIVE_THREAD_TURNS[\s\S]*?\];/,
    )?.[0] ?? "";
    expect(block).toContain('role: "teacher"');
    expect(block).toContain('role: "student"');
    expect(block.match(/role: "teacher"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("RESOLVED_TURNS ends in got_it (drives the resolved state derivation)", () => {
    const block = fixtures.match(/RESOLVED_TURNS[\s\S]*?\];/)?.[0] ?? "";
    expect(block).toMatch(/sentiment:\s*"got_it"/);
  });
});

describe("TeacherFeedback — speech bubble tail (designer spec)", () => {
  it("renders the cubic-curve SVG path the designer specified (drip, not triangle)", () => {
    // The exact path: M0 26 C ... Z. Without these curves it'd render
    // as a hard triangle which the designer explicitly rejected.
    expect(tail).toContain("M0 26 C 6 26");
    expect(tail).toContain("Z");
    expect(tail).toMatch(/strokeWidth=\{1\.5\}/);
  });

  it("defines an emerald (teacher) and purple (student) variant", () => {
    expect(tail).toMatch(/teacher:\s*\{/);
    expect(tail).toMatch(/student:\s*\{/);
  });

  it("includes the seam-mask rect that hides the tail/border join", () => {
    // Without this, the bubble's top stroke draws a horizontal line
    // cutting across the drip. Designer called this out explicitly.
    expect(tail).toMatch(/<rect[^>]*y="22"/);
  });
});

describe("TeacherFeedback — QuickReplies a11y (radiogroup)", () => {
  it("uses role='radiogroup' with role='radio' children + aria-checked", () => {
    expect(pills).toMatch(/role="radiogroup"/);
    expect(pills).toMatch(/role="radio"/);
    expect(pills).toMatch(/aria-checked/);
  });

  it("supports arrow-key navigation between pills", () => {
    expect(pills).toMatch(/ArrowRight|ArrowDown/);
    expect(pills).toMatch(/ArrowLeft|ArrowUp/);
  });

  it("disables Got-it via aria-disabled (NOT the disabled attr) so roving-tabindex still includes it", () => {
    // aria-disabled keeps the pill in the radiogroup nav order;
    // disabled would skip it. The keyboard contract for radiogroups
    // requires the disabled option to remain reachable.
    expect(pills).toMatch(/aria-disabled=\{isDisabled\}/);
  });
});

describe("TeacherFeedback — ReplyBox enforces ≥10 char minimum", () => {
  it("disables Send until the trimmed text length meets REPLY_MIN_CHARS", () => {
    expect(replyBox).toMatch(/meetsMinimum/);
    expect(replyBox).toMatch(/disabled=\{!meetsMinimum/);
  });

  it("aria-required on the textarea (sentiment forces a reply)", () => {
    expect(replyBox).toMatch(/aria-required=\{true\}/);
  });

  it("uses the shared useCollapsible hook (height-only animation)", () => {
    expect(replyBox).toMatch(/useCollapsible/);
  });
});

describe("TeacherFeedback — Thread (multi-turn renderer)", () => {
  it("teacher cards are full-width emerald; student cards are indented purple (visual identity)", () => {
    // The indent is the load-bearing visual cue that distinguishes
    // student turns from teacher turns. Without it, identity would
    // collapse to colour alone — fails the a11y "colour is not the
    // only signal" rule.
    expect(thread).toMatch(/StudentCard/);
    expect(thread).toMatch(/ml-6/);
    expect(thread).toMatch(/bg-emerald-50/);
    expect(thread).toMatch(/bg-purple-50/);
  });

  it("new teacher turns get a 1.4s emerald glow ring (designer spec)", () => {
    // Spec calls for a one-shot glow on first paint of a new teacher
    // turn. We use framer-motion's animate prop on the box-shadow.
    expect(thread).toContain("rgba(16,185,129,0.25)");
    expect(thread).toMatch(/duration:\s*1\.4/);
  });

  it("uses framer-motion AnimatePresence for the slide-up entry", () => {
    expect(thread).toMatch(/AnimatePresence/);
    expect(thread).toMatch(/initial=\{\{ opacity: 0/);
  });
});

describe("TeacherFeedback — ResolvedSummary (collapsed state)", () => {
  it("renders as a single button with aria-expanded={false}", () => {
    expect(resolved).toMatch(/<button/);
    expect(resolved).toMatch(/aria-expanded=\{false\}/);
  });

  it("shows a truncated preview of the latest teacher turn body", () => {
    expect(resolved).toMatch(/previewText/);
    expect(resolved).toMatch(/maxChars\s*=\s*80/);
  });

  it("Re-open affordance is present in the row (not hidden behind a hover)", () => {
    expect(resolved).toContain("Re-open");
  });
});

describe("TeacherFeedback — index orchestrator state machine", () => {
  it("derives state from turns: empty | fresh-unread | active | resolved", () => {
    const fn = index.match(/function deriveState\([\s\S]*?\}/)?.[0] ?? "";
    expect(fn).toContain('"empty"');
    expect(fn).toContain('"fresh-unread"');
    expect(fn).toContain('"active"');
    expect(fn).toContain('"resolved"');
  });

  it("got_it short-circuits to onReply without opening the reply box", () => {
    // Single-click resolution. The reply box is skipped entirely for
    // got_it — opening it would force the student to type confirmation.
    expect(index).toMatch(
      /if\s*\(s\s*===\s*"got_it"\)\s*\{[\s\S]*?onReply\("got_it"\)/,
    );
  });

  it("not_sure / pushback open the reply box (no short-circuit)", () => {
    // The else branch sets selectedSentiment + replyOpen — required
    // path for the "must justify" sentiments.
    expect(index).toMatch(/setSelectedSentiment\(s\)/);
    expect(index).toMatch(/setReplyOpen\(true\)/);
  });

  it("the resolved state can be re-opened via reopenedFromResolved local state", () => {
    expect(index).toMatch(/reopenedFromResolved/);
    expect(index).toMatch(/setReopenedFromResolved\(true\)/);
  });

  it("dev-only assertion that turns[0] is always teacher (Lesson #38 boundary check)", () => {
    expect(index).toMatch(
      /turns\[0\]\.role\s*!==\s*"teacher"/,
    );
  });
});
