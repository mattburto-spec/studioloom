/**
 * <TeacherFeedback /> Pass A — source-static guards.
 *
 * Updated 10 May 2026 (post-smoke): the original SpeechBubbleTail.tsx
 * separate-SVG implementation was replaced with BubbleFrame.tsx, a
 * single-SVG outline that integrates the tail into the bubble's top
 * edge as one continuous stroke. Matt's smoke caught the seam between
 * the old tail SVG and the bubble's CSS top border — see
 * BubbleFrame.tsx header for the diagnosis. Tests now assert the
 * BubbleFrame architecture.
 *
 * Lesson #71: pure-render assertions in source-text rather than
 * spinning a JSDOM render harness — the sandbox + Vercel preview are
 * the visual proof, source-static tests pin the contracts that
 * downstream code (Pass B wiring, future visual edits) needs to keep
 * intact.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const types = readFileSync(join(ROOT, "types.ts"), "utf-8");
const fixtures = readFileSync(join(ROOT, "fixtures.ts"), "utf-8");
const bubbleFrame = readFileSync(join(ROOT, "BubbleFrame.tsx"), "utf-8");
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
    const block = fixtures.match(/ACTIVE_THREAD_TURNS[\s\S]*?\];/)?.[0] ?? "";
    expect(block).toContain('role: "teacher"');
    expect(block).toContain('role: "student"');
    expect(block.match(/role: "teacher"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("RESOLVED_TURNS ends in got_it (drives the resolved state derivation)", () => {
    const block = fixtures.match(/RESOLVED_TURNS[\s\S]*?\];/)?.[0] ?? "";
    expect(block).toMatch(/sentiment:\s*"got_it"/);
  });
});

describe("TeacherFeedback — BubbleFrame (single-SVG outline + integrated tail)", () => {
  it("draws the entire bubble + tail as one continuous SVG path", () => {
    // The post-smoke fix: no separate SpeechBubbleTail. The bubble's
    // outline (rounded rect + tail dip) is one path. The path
    // generator emits a single `M ... Z` block — only one Z (close)
    // means single closed sub-path.
    expect(bubbleFrame).toMatch(/function buildBubblePath/);
    expect(bubbleFrame).toMatch(/segs\.push\("Z"\)/);
    // Only ONE Z in the entire path output — single continuous outline.
    const generator =
      bubbleFrame.match(/function buildBubblePath[\s\S]*?return segs\.join/)?.[0] ?? "";
    expect((generator.match(/"Z"/g) ?? []).length).toBe(1);
  });

  it("uses ResizeObserver to size the path to the content (no preserveAspectRatio distortion)", () => {
    // The path is recomputed from real measured dimensions, not
    // stretched via preserveAspectRatio="none" which would distort
    // the rounded corners + tail proportions. Strip block + line
    // comments before the negative assertion so the comment block
    // explaining the rule doesn't trip the check.
    expect(bubbleFrame).toContain("ResizeObserver");
    const codeOnly = bubbleFrame
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toContain('preserveAspectRatio="none"');
  });

  it("path includes the rounded corners (4 arcs) AND the tail M-curves (4 cubic curves)", () => {
    const generator =
      bubbleFrame.match(/function buildBubblePath[\s\S]*?return segs\.join/)?.[0] ?? "";
    // 4 corner arcs (top-left, top-right, bottom-right, bottom-left).
    // Each arc command starts with backtick-A-space.
    expect((generator.match(/`A /g) ?? []).length).toBe(4);
    // 4 cubic curves total (rising left, tip-left, tip-right,
    // descending right) for the tail M-shape. The body uses only
    // arcs + lines, so any cubic in the generator is from the tail.
    expect((generator.match(/`C /g) ?? []).length).toBe(4);
  });

  it("defines emerald (teacher) and purple (student) variants", () => {
    expect(bubbleFrame).toMatch(/teacher:\s*\{/);
    expect(bubbleFrame).toMatch(/student:\s*\{/);
    expect(bubbleFrame).toMatch(/16 185 129/); // emerald-500 stroke
    expect(bubbleFrame).toMatch(/168 85 247/); // purple-500 stroke
  });

  it("integer-rounds measured dimensions to avoid sub-pixel stroke blur", () => {
    expect(bubbleFrame).toMatch(/Math\.round\(/);
  });

  it("SVG is positioned absolutely with pointer-events: none so clicks pass through", () => {
    expect(bubbleFrame).toMatch(/pointerEvents:\s*"none"/);
    expect(bubbleFrame).toMatch(/position:\s*"absolute"/);
  });

  it("clamps tailX to a minimum so the tail base never overlaps the rounded corner (Matt 10 May 2026 smoke regression guard)", () => {
    // Pre-fix: with tailX=36 and TAIL_HALF_WIDTH=24, the tail's left
    // base sat at x=12 — INSIDE the corner zone (corner ends at x=24).
    // The path drew a backward L-segment from (24, top) to (12, top)
    // BEFORE the tail rose, producing a phantom "second peak" reading
    // as an M-shape in the rendered outline.
    //
    // Fix: TAIL_X_MIN = RADIUS + TAIL_HALF_WIDTH + safety_margin.
    // Math.max(tailX, TAIL_X_MIN) clamps any caller's smaller value
    // to the legal floor.
    expect(bubbleFrame).toMatch(/const TAIL_X_MIN\s*=/);
    expect(bubbleFrame).toMatch(/RADIUS\s*\+\s*TAIL_HALF_WIDTH/);
    expect(bubbleFrame).toMatch(
      /const clampedTailX\s*=\s*Math\.max\(tailX,\s*TAIL_X_MIN\)/,
    );
    // The path generator must receive the CLAMPED value, not the raw
    // tailX prop — otherwise the clamp does nothing for the path.
    expect(bubbleFrame).toMatch(
      /buildBubblePath\([^)]*clampedTailX/,
    );
  });

  it("default tailX is large enough that no caller gets a backward L-segment", () => {
    // Pin the default >= TAIL_X_MIN. If a future edit drops the
    // default below the minimum, the clamp will catch it at runtime,
    // but the static check makes the intent explicit.
    expect(bubbleFrame).toMatch(/const TAIL_X_DEFAULT\s*=\s*(\d+)/);
    const defaultMatch = bubbleFrame.match(/const TAIL_X_DEFAULT\s*=\s*(\d+)/);
    const defaultVal = defaultMatch ? parseInt(defaultMatch[1], 10) : 0;
    // RADIUS=24, TAIL_HALF_WIDTH=24, margin=4 → minimum 52.
    expect(defaultVal).toBeGreaterThanOrEqual(52);
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

describe("TeacherFeedback — Thread (multi-turn renderer) wraps in BubbleFrame", () => {
  it("renders inside BubbleFrame instead of its own bordered div (post-smoke fix)", () => {
    expect(thread).toMatch(/import.*BubbleFrame.*from.*BubbleFrame/);
    expect(thread).toMatch(/<BubbleFrame[\s\S]*?variant="teacher"/);
    // Regression guard: the old standalone `rounded-3xl border-2
    // border-emerald-500` outer container is gone. Thread no longer
    // draws its own border.
    expect(thread).not.toMatch(
      /<div\s+[^>]*className="rounded-3xl border-2 border-emerald-500/,
    );
  });

  it("teacher cards are full-width emerald; student cards are indented purple (visual identity)", () => {
    expect(thread).toMatch(/StudentCard/);
    expect(thread).toMatch(/ml-6/);
    expect(thread).toMatch(/bg-emerald-50/);
    expect(thread).toMatch(/bg-purple-50/);
  });

  it("new teacher turns get a 1.4s emerald glow ring (designer spec)", () => {
    expect(thread).toContain("rgba(16,185,129,0.25)");
    expect(thread).toMatch(/duration:\s*1\.4/);
  });

  it("uses framer-motion AnimatePresence for the slide-up entry", () => {
    expect(thread).toMatch(/AnimatePresence/);
    expect(thread).toMatch(/initial=\{\{ opacity: 0/);
  });
});

describe("TeacherFeedback — ResolvedSummary uses BubbleFrame too", () => {
  it("wraps the row content in BubbleFrame so the tail integrates cleanly", () => {
    expect(resolved).toMatch(/import.*BubbleFrame.*from.*BubbleFrame/);
    expect(resolved).toMatch(/<BubbleFrame[\s\S]*?variant="teacher"/);
  });

  it("button has bg-transparent border-0 (BubbleFrame supplies the visual)", () => {
    expect(resolved).toMatch(/bg-transparent/);
    expect(resolved).toMatch(/border-0/);
  });

  it("renders as a single button with aria-expanded={false}", () => {
    expect(resolved).toMatch(/<button/);
    expect(resolved).toMatch(/aria-expanded=\{false\}/);
  });

  it("shows a truncated preview of the latest teacher turn body", () => {
    expect(resolved).toMatch(/previewText/);
    expect(resolved).toMatch(/maxChars\s*=\s*80/);
  });

  it("Re-open affordance is present in the row", () => {
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

  it("Fresh state uses BubbleFrame (no separate SpeechBubbleTail)", () => {
    expect(index).toMatch(/import.*BubbleFrame.*from.*BubbleFrame/);
    expect(index).toMatch(/<BubbleFrame[\s\S]*?contentClassName="px-5 py-4"/);
    // Regression guard: the old SpeechBubbleTail import + usage must
    // not come back. The post-smoke architecture is one SVG outline
    // per bubble, drawn by BubbleFrame.
    expect(index).not.toContain("SpeechBubbleTail");
  });

  it("got_it short-circuits to onReply without opening the reply box", () => {
    expect(index).toMatch(
      /if\s*\(s\s*===\s*"got_it"\)\s*\{[\s\S]*?onReply\("got_it"\)/,
    );
  });

  it("not_sure / pushback open the reply box (no short-circuit)", () => {
    expect(index).toMatch(/setSelectedSentiment\(s\)/);
    expect(index).toMatch(/setReplyOpen\(true\)/);
  });

  it("the resolved state can be re-opened via reopenedFromResolved local state", () => {
    expect(index).toMatch(/reopenedFromResolved/);
    expect(index).toMatch(/setReopenedFromResolved\(true\)/);
  });

  it("dev-only assertion that turns[0] is always teacher (Lesson #38 boundary check)", () => {
    expect(index).toMatch(/turns\[0\]\.role\s*!==\s*"teacher"/);
  });
});
