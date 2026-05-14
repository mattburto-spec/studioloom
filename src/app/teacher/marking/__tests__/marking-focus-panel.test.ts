/**
 * TFL.3 C.6.2 — MarkingFocusPanel source-static guards.
 *
 * Matt smoke 13 May 2026 after C.6.1 (row-level blind-send): "i dont
 * want to hit send if i cant see the comment or what the student
 * wrote". Replaces the blind-send chip with a top-of-page
 * master-detail panel: response left, AI draft right, tweak buttons +
 * Send & Next + Skip. Prev/next navigates the cohort one student at
 * a time without expanding rows.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/marking C.6.2 — focus panel render", () => {
  it("renders MarkingFocusPanel above the cohort rows when activeTile + students present", () => {
    expect(src).toMatch(
      /\{activeTile\s*&&\s*activePageId\s*&&\s*students\.length\s*>\s*0\s*&&\s*\(\s*<MarkingFocusPanel/,
    );
  });

  it("panel carries data-testid + data-student-id for e2e", () => {
    expect(src).toContain('data-testid="marking-focus-panel"');
    expect(src).toContain("data-student-id={student.id}");
  });

  it("renders an empty state when no submissions exist on this tile", () => {
    expect(src).toContain('data-testid="marking-focus-panel-empty"');
    expect(src).toMatch(/No submissions on this tile yet/);
  });

  it("two-column body: student response left, AI draft right", () => {
    expect(src).toContain('data-testid="focus-student-response"');
    expect(src).toContain('data-testid="focus-draft-textarea"');
    expect(src).toMatch(/grid-cols-1 md:grid-cols-2/);
  });

  it("auto-picks the first eligible student when focusStudentId is unset", () => {
    expect(src).toMatch(
      /if\s*\(focusStudentId\)\s*return;[\s\S]*?if\s*\(eligible\.length\s*===\s*0\)\s*return;[\s\S]*?setFocusStudentId\(eligible\[0\]\.student\.id\)/,
    );
  });
});

describe("/teacher/marking C.6.2 — prev / next navigation", () => {
  it("renders prev + next buttons with data-testids", () => {
    expect(src).toContain('data-testid="focus-prev"');
    expect(src).toContain('data-testid="focus-next"');
  });

  it("prev disables at index 0; next disables at the last eligible index", () => {
    expect(src).toMatch(/data-testid="focus-prev"[\s\S]*?disabled=\{currentIdx === 0\}/);
    expect(src).toMatch(
      /data-testid="focus-next"[\s\S]*?disabled=\{currentIdx === eligible\.length - 1\}/,
    );
  });

  it("advance(offset) sets focusStudentId to eligible[currentIdx + offset]", () => {
    expect(src).toMatch(
      /const advance\s*=\s*\(offset:\s*number\)\s*=>\s*\{[\s\S]*?eligible\[currentIdx\s*\+\s*offset\][\s\S]*?setFocusStudentId\(next\.student\.id\)/,
    );
  });

  it("advanceToNext skips already-done students to find next pending", () => {
    // Send & Next should land on the next student who hasn't been sent
    // yet, not the literal next row. This keeps the teacher moving
    // through unfinished work.
    expect(src).toMatch(
      /for\s*\(let i\s*=\s*currentIdx\s*\+\s*1;\s*i\s*<\s*eligible\.length;\s*i\+\+\)\s*\{[\s\S]*?eligible\[i\]\.bucket\s*!==\s*"done"/,
    );
  });
});

describe("/teacher/marking C.6.2 — send flow", () => {
  it("Send button wired to handleSend → saveTile → advanceToNext", () => {
    expect(src).toContain('data-testid="focus-send-button"');
    expect(src).toMatch(
      /const handleSend\s*=\s*async[\s\S]*?await saveTile\(student\.id,\s*sendScore,\s*true,\s*\{\s*student_facing_comment:\s*draftValue/,
    );
    expect(src).toMatch(/handleSend[\s\S]*?advanceToNext\(\);/);
  });

  it("disables Send when draft is empty / saving / mid-tweak / already done", () => {
    expect(src).toMatch(
      /isSaving\s*\|\|\s*tweaking\s*!==\s*null\s*\|\|\s*!draftValue\.trim\(\)\s*\|\|\s*isDone/,
    );
  });

  it("sendScore falls back current grade.score → ai_pre_score → null", () => {
    expect(src).toMatch(
      /const sendScore\s*=\s*\n?\s*typeof grade\?\.score === "number"\s*\n?\s*\?\s*grade\.score\s*\n?\s*:\s*typeof grade\?\.ai_pre_score === "number"\s*\n?\s*\?\s*grade\.ai_pre_score\s*\n?\s*:\s*null/,
    );
  });
});

describe("/teacher/marking C.6.2 — tweak buttons (Shorter / Warmer / Sharper / + Ask)", () => {
  it("renders 4 tweak buttons with data-testids", () => {
    expect(src).toContain('data-testid={`focus-tweak-${d}`}');
    expect(src).toContain('data-testid="focus-tweak-ask"');
    expect(src).toMatch(/\["shorter",\s*"warmer",\s*"sharper"\]\s+as\s+const/);
  });

  it("POSTs to /api/teacher/grading/regenerate-draft with grade_id + draft + directive", () => {
    expect(src).toContain('"/api/teacher/grading/regenerate-draft"');
    expect(src).toMatch(
      /grade_id:\s*grade\.id[\s\S]*?current_draft:\s*draftValue[\s\S]*?directive/,
    );
  });

  it("on success, regenerated body replaces studentCommentDraft[key]", () => {
    expect(src).toMatch(
      /setStudentCommentDraft\(\(prev\)\s*=>\s*\(\{[\s\S]*?\[key\]:\s*json\.draftBody/,
    );
  });

  it("ask panel: Enter key in input fires handleTweak('ask', askText)", () => {
    expect(src).toContain('data-testid="focus-tweak-ask-panel"');
    expect(src).toContain('data-testid="focus-tweak-ask-input"');
    expect(src).toMatch(
      /e\.key\s*===\s*"Enter"\s*&&\s*askText\.trim\(\)\s*&&\s*!tweaking[\s\S]*?handleTweak\("ask",\s*askText\)/,
    );
  });

  it("textarea disables while a tweak is in flight (avoid races)", () => {
    expect(src).toMatch(
      /data-testid="focus-draft-textarea"[\s\S]*?disabled=\{tweaking\s*!==\s*null\s*\|\|\s*isSaving\}/,
    );
  });
});

describe("/teacher/marking C.6.2 — eligibility + ordering", () => {
  it("filters to students with a non-empty submission on the active tile", () => {
    expect(src).toMatch(/\.filter\(\(x\)\s*=>\s*x\.studentResponse\.trim\(\)\.length\s*>\s*0\)/);
  });

  it("orders ai_draft + unsent FIRST, then no_draft, then done (sent/edited)", () => {
    expect(src).toMatch(
      /rank:\s*Record<Bucket,\s*number>\s*=\s*\{\s*draft_unsent:\s*0[\s\S]*?no_draft:\s*1[\s\S]*?done:\s*2/,
    );
  });
});

describe("/teacher/marking C.6.2 — chip click loads into focus (not blind-send)", () => {
  it("row chip click sets focusStudentId AND toggles expand (no row-level Send)", () => {
    expect(src).toMatch(
      /setFocusStudentId\(s\.id\);\s*\n?\s*setExpandedStudentId\(isExpanded\s*\?\s*null\s*:\s*s\.id\)/,
    );
  });

  it("no longer renders a row-level 'Send' button (reverted from C.6.1)", () => {
    // C.6.1 added data-testid="row-send-ai-draft". C.6.2 reverted it
    // in favour of the focus panel above. Pin the absence so the
    // blind-send regression can't sneak back in.
    expect(src).not.toContain('data-testid="row-send-ai-draft"');
  });
});
