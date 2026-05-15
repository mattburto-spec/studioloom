/**
 * Source-static tests for the AI brief-assist modal + its trigger in
 * the UnitBriefEditor.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const modalSrc = readFileSync(
  join(__dirname, "..", "AIBriefAssistModal.tsx"),
  "utf-8",
);
const editorSrc = readFileSync(
  join(__dirname, "..", "UnitBriefEditor.tsx"),
  "utf-8",
);

describe("AIBriefAssistModal — structure", () => {
  it("portal-mounts at document.body (Lesson #89)", () => {
    expect(modalSrc).toContain('import { createPortal } from "react-dom"');
    expect(modalSrc).toContain("createPortal(");
    expect(modalSrc).toContain("document.body");
  });

  it("SSR-safe mount gate", () => {
    expect(modalSrc).toMatch(/const \[mounted, setMounted\] = useState\(false\)/);
    expect(modalSrc).toContain("if (!open || !mounted) return null;");
  });

  it("resets state on each open (no leak between sessions)", () => {
    expect(modalSrc).toMatch(/setPrompt\(""\)/);
    expect(modalSrc).toMatch(/setSuggestion\(null\)/);
    expect(modalSrc).toMatch(/setSelected\(new Set\(\)\)/);
  });

  it("POSTs to /api/teacher/unit-brief/generate with unitId + prompt", () => {
    expect(modalSrc).toContain('fetch("/api/teacher/unit-brief/generate"');
    expect(modalSrc).toMatch(/JSON\.stringify\(\{ unitId, prompt: trimmed \}\)/);
  });

  it("after generation, defaults each non-empty field to selected", () => {
    expect(modalSrc).toContain("const next = new Set<SelectableField>()");
    expect(modalSrc).toContain('next.add("brief_text")');
    expect(modalSrc).toContain('next.add("dimensions")');
    expect(modalSrc).toContain('next.add("materials_whitelist")');
  });

  it("Apply selected builds a partial patch from chosen fields only", () => {
    // copyIfSelected helper walks each constraint field; only selected
    // fields get added to the patch.
    expect(modalSrc).toContain("const copyIfSelected");
    expect(modalSrc).toMatch(/copyIfSelected\("dimensions", "dimensions"\)/);
    expect(modalSrc).toMatch(/copyIfSelected\("budget", "budget"\)/);
  });

  it("Regenerate + Apply selected buttons with stable testids", () => {
    expect(modalSrc).toMatch(/data-testid="ai-brief-assist-generate"/);
    expect(modalSrc).toMatch(/data-testid="ai-brief-assist-regenerate"/);
    expect(modalSrc).toMatch(/data-testid="ai-brief-assist-apply"/);
  });

  it("ESC / backdrop / close button all dismiss", () => {
    expect(modalSrc).toMatch(/if \(e\.key === "Escape"\) onClose\(\)/);
    expect(modalSrc).toMatch(/data-testid="ai-brief-assist-backdrop"/);
    expect(modalSrc).toMatch(/data-testid="ai-brief-assist-close"/);
  });

  it("rejects empty prompts with inline error (not a server round-trip)", () => {
    expect(modalSrc).toContain("Tell the AI what you want help with");
  });

  it("rejects empty selection on Apply", () => {
    expect(modalSrc).toContain("Select at least one field to apply");
  });
});

describe("UnitBriefEditor — AI assist wiring", () => {
  it("imports AIBriefAssistModal", () => {
    expect(editorSrc).toMatch(
      /import \{ AIBriefAssistModal \} from "\.\/AIBriefAssistModal"/,
    );
  });

  it("renders an '✨ AI assist' trigger button with stable testid", () => {
    expect(editorSrc).toMatch(/data-testid="ai-brief-assist-open"/);
    expect(editorSrc).toContain("AI assist");
  });

  it("trigger disabled during saves (no overlapping writes)", () => {
    expect(editorSrc).toMatch(/disabled=\{saving\}[\s\S]*?ai-brief-assist-open/);
  });

  it("handleAIApply updates local state optimistically + calls savePatch", () => {
    expect(editorSrc).toContain("const handleAIApply");
    expect(editorSrc).toMatch(/setBriefText\(patch\.brief_text\)/);
    expect(editorSrc).toMatch(/setConstraints\(patch\.constraints\)/);
    expect(editorSrc).toMatch(/await savePatch\(patch\)/);
  });

  it("mounts the modal at the editor's root (open state local)", () => {
    expect(editorSrc).toMatch(/const \[aiOpen, setAiOpen\] = useState\(false\)/);
    expect(editorSrc).toMatch(/<AIBriefAssistModal[\s\S]*?open=\{aiOpen\}/);
  });
});
