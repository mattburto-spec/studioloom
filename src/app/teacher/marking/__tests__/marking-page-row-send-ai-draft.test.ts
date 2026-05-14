/**
 * TFL.3 C.6 — row-level one-click "Send AI draft" button.
 *
 * Matt smoke 13 May 2026 (after Pass C inbox shipped): "i need to
 * expand on each student to see the ai feedback and then click send.
 * there needs to be an easier way". This change shaves the common-case
 * approve flow from 3 clicks (expand → textarea → send) to 1.
 *
 * Behaviour:
 *   - When state === "ai_draft" the row chip splits into a green
 *     "✓ Send" button + a chevron expand button (instead of the
 *     single expand-only chip).
 *   - "Send" calls saveTile with student_facing_comment =
 *     grade.ai_comment_draft + confirmed=true + score (current OR
 *     ai_pre_score fallback).
 *   - Chevron still expands the row for review/edit.
 *   - Other chip states (sent / edited / empty) keep the previous
 *     single-button expand-only behaviour.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/marking — row send-AI-draft (C.6)", () => {
  it("renders a dedicated send button when state === 'ai_draft'", () => {
    expect(src).toContain('data-testid="row-send-ai-draft"');
    expect(src).toMatch(/if\s*\(state\s*===\s*"ai_draft"\)\s*\{/);
  });

  it("send button is emerald (matches Approve & send convention in inbox)", () => {
    expect(src).toMatch(
      /row-send-ai-draft[\s\S]*?bg-emerald-600\s+hover:bg-emerald-700/,
    );
  });

  it("clicking send fires saveTile with the AI draft + confirmed=true", () => {
    expect(src).toMatch(
      /row-send-ai-draft[\s\S]*?saveTile\(s\.id,\s*sendScore,\s*true,\s*\{\s*student_facing_comment:\s*grade\.ai_comment_draft/,
    );
  });

  it("falls back to ai_pre_score when no current score is set", () => {
    expect(src).toMatch(
      /sendScore\s*=\s*\n?\s*typeof score === "number"[\s\S]*?:\s*typeof grade\?\.ai_pre_score === "number"[\s\S]*?:\s*null/,
    );
  });

  it("disables send when saving OR ai_comment_draft is missing (defensive)", () => {
    expect(src).toMatch(/canSend\s*=\s*!isSaving\s*&&\s*grade\?\.ai_comment_draft/);
  });

  it("keeps a chevron button next to send for review/edit", () => {
    expect(src).toContain('data-testid="row-expand-ai-draft"');
    expect(src).toMatch(
      /row-expand-ai-draft[\s\S]*?setExpandedStudentId\(isExpanded\s*\?\s*null\s*:\s*s\.id\)/,
    );
  });

  it("non-ai_draft states keep the original single-button expand-only behaviour", () => {
    // The fall-through `return (<button ...)` after the ai_draft branch
    // handles "sent" / "edited" / "empty" — single button, click =
    // expand.
    expect(src).toMatch(
      /\}\s*\n\s*return\s*\(\s*<button[\s\S]*?onClick=\{\(\)\s*=>\s*setExpandedStudentId/,
    );
  });
});
