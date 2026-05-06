/**
 * AG.2.4 — source-static guards for journal "Next" → Kanban auto-create wiring.
 *
 * The flow:
 *   1. ActivityBlock with responseType='structured-prompts' has
 *      autoCreateKanbanCardOnSave=true on its config
 *   2. ResponseInput dispatches that flag through to StructuredPromptsResponse
 *   3. StructuredPromptsResponse, after a successful portfolio save, calls
 *      appendBacklogCard(unitId, { title: nextMove, lessonLink }) when
 *      autoCreateKanbanCardOnSave + nextMove are both truthy
 *   4. appendBacklogCard reads current state, dispatches createCard with
 *      source='journal_next', persists via saveKanbanState
 *   5. Failures are silent (don't undo journal save; logged for teacher)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RESPONSE_INPUT_SRC = readFileSync(
  join(process.cwd(), "src/components/student/ResponseInput.tsx"),
  "utf-8"
);
const STRUCTURED_PROMPTS_SRC = readFileSync(
  join(process.cwd(), "src/components/student/StructuredPromptsResponse.tsx"),
  "utf-8"
);
const CLIENT_SRC = readFileSync(
  join(process.cwd(), "src/lib/unit-tools/kanban/client.ts"),
  "utf-8"
);
const BOARD_PAGE_SRC = readFileSync(
  join(process.cwd(), "src/app/(student)/unit/[unitId]/board/page.tsx"),
  "utf-8"
);
const SIDEBAR_SRC = readFileSync(
  join(process.cwd(), "src/components/student/LessonSidebar.tsx"),
  "utf-8"
);

describe("appendBacklogCard helper (kanban/client.ts)", () => {
  it("is exported", () => {
    expect(CLIENT_SRC).toContain("export async function appendBacklogCard");
  });

  it("takes unitId + { title, lessonLink? }", () => {
    // TS interface fields use `;` separator. Match either separator + flexible whitespace.
    expect(CLIENT_SRC).toMatch(
      /appendBacklogCard\(\s*unitId:\s*string,\s*args:\s*\{\s*title:\s*string[;,]?\s*lessonLink\?:/
    );
  });

  it("reads current state via loadKanbanState before mutating", () => {
    expect(CLIENT_SRC).toContain("await loadKanbanState(unitId)");
  });

  it("creates the new card via the canonical reducer (not a parallel impl)", () => {
    expect(CLIENT_SRC).toContain("kanbanReducer");
    expect(CLIENT_SRC).toMatch(
      /type:\s*"createCard",[\s\S]*?source:\s*"journal_next"/
    );
  });

  it("places card in 'backlog' (not this_class — students choose what to commit)", () => {
    const fnIdx = CLIENT_SRC.indexOf("appendBacklogCard");
    const fnBody = CLIENT_SRC.slice(fnIdx);
    expect(fnBody).toMatch(/status:\s*"backlog"/);
  });

  it("returns the post-save result via saveKanbanState", () => {
    const fnIdx = CLIENT_SRC.indexOf("appendBacklogCard");
    const fnBody = CLIENT_SRC.slice(fnIdx);
    expect(fnBody).toMatch(/return saveKanbanState\(unitId,\s*next\)/);
  });
});

describe("StructuredPromptsResponse — kanban auto-create wiring", () => {
  it("accepts autoCreateKanbanCardOnSave prop (default false)", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain("autoCreateKanbanCardOnSave");
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /autoCreateKanbanCardOnSave\s*=\s*false/
    );
  });

  it("only fires the Kanban call when both flag AND nextMove are truthy", () => {
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /if\s*\(autoCreateKanbanCardOnSave\s*&&\s*nextMove\)/
    );
  });

  it("uses lazy import to keep Kanban out of module graph when flag is off", () => {
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /import\(["']@\/lib\/unit-tools\/kanban\/client["']\)/
    );
  });

  it("calls appendBacklogCard with nextMove + lessonLink (unit_id, page_id, section_index)", () => {
    expect(STRUCTURED_PROMPTS_SRC).toContain("appendBacklogCard");
    expect(STRUCTURED_PROMPTS_SRC).toMatch(
      /title:\s*nextMove,[\s\S]*?lessonLink:\s*\{\s*unit_id:\s*unitId,\s*page_id:\s*pageId,\s*section_index:\s*sectionIndex/
    );
  });

  it("kanban failure does NOT block the journal save (silent fire-and-forget)", () => {
    // The .catch on the lazy-import-promise must console.warn and NOT throw
    expect(STRUCTURED_PROMPTS_SRC).toMatch(/\.catch\(\([^)]*\)\s*=>\s*\{[\s\S]*?console\.warn/);
    // No setErrorMsg INSIDE the kanban-auto-create if-block specifically.
    // Slice just the if-block body (between the `if (...)` and the matching `}`).
    const ifIdx = STRUCTURED_PROMPTS_SRC.indexOf(
      "if (autoCreateKanbanCardOnSave && nextMove)"
    );
    expect(ifIdx).toBeGreaterThan(0);
    // Find the closing brace of this if-block by tracking depth
    const ifStart = STRUCTURED_PROMPTS_SRC.indexOf("{", ifIdx);
    let depth = 1;
    let i = ifStart + 1;
    while (i < STRUCTURED_PROMPTS_SRC.length && depth > 0) {
      if (STRUCTURED_PROMPTS_SRC[i] === "{") depth++;
      else if (STRUCTURED_PROMPTS_SRC[i] === "}") depth--;
      i++;
    }
    const ifBlock = STRUCTURED_PROMPTS_SRC.slice(ifStart, i);
    expect(ifBlock).not.toContain("setErrorMsg");
  });

  it("kanban call is AFTER the portfolio save, before onSaved callback", () => {
    // The journal save (POST /api/student/portfolio) must succeed first.
    // Auto-create happens after that, before notifying parent via onSaved.
    const portfolioIdx = STRUCTURED_PROMPTS_SRC.indexOf('"/api/student/portfolio"');
    const kanbanCallIdx = STRUCTURED_PROMPTS_SRC.indexOf("appendBacklogCard");
    const onSavedIdx = STRUCTURED_PROMPTS_SRC.indexOf("onSaved?.({");
    expect(portfolioIdx).toBeGreaterThan(0);
    expect(kanbanCallIdx).toBeGreaterThan(portfolioIdx);
    expect(onSavedIdx).toBeGreaterThan(kanbanCallIdx);
  });
});

describe("ResponseInput — propagates autoCreateKanbanCardOnSave", () => {
  it("destructures autoCreateKanbanCardOnSave prop", () => {
    expect(RESPONSE_INPUT_SRC).toContain("autoCreateKanbanCardOnSave");
  });

  it("passes flag through to StructuredPromptsResponse", () => {
    const idx = RESPONSE_INPUT_SRC.indexOf("<StructuredPromptsResponse");
    const slice = RESPONSE_INPUT_SRC.slice(idx, idx + 800);
    expect(slice).toContain("autoCreateKanbanCardOnSave={autoCreateKanbanCardOnSave}");
  });
});

describe("Student board page (/unit/[unitId]/board)", () => {
  it("auth-guards via getStudentSession + redirect on missing", () => {
    expect(BOARD_PAGE_SRC).toContain("getStudentSession()");
    expect(BOARD_PAGE_SRC).toMatch(/if\s*\(!session\)\s*redirect\(["']\/["']\)/);
  });

  it("verifies unit exists before rendering board", () => {
    expect(BOARD_PAGE_SRC).toMatch(
      /\.from\("units"\)[\s\S]*?\.eq\("id",\s*unitId\)/
    );
    expect(BOARD_PAGE_SRC).toMatch(/if\s*\(!unit\)/);
  });

  it("renders <KanbanBoard unitId={unitId} />", () => {
    expect(BOARD_PAGE_SRC).toContain("<KanbanBoard unitId={unitId}");
  });

  it("provides nav links to Narrative + Dashboard", () => {
    expect(BOARD_PAGE_SRC).toMatch(/href=\{`\/unit\/\$\{unitId\}\/narrative`\}/);
    expect(BOARD_PAGE_SRC).toMatch(/href=["']\/dashboard["']/);
  });

  it("uses async params (Next.js 15+ pattern)", () => {
    expect(BOARD_PAGE_SRC).toContain("params: Promise<{ unitId: string }>");
    expect(BOARD_PAGE_SRC).toContain("await params");
  });
});

describe("LessonSidebar — Project board nav link", () => {
  it("includes a Project board button that routes to /unit/{unitId}/board", () => {
    expect(SIDEBAR_SRC).toContain('data-testid="lesson-sidebar-project-board"');
    expect(SIDEBAR_SRC).toMatch(
      /router\.push\(`\/unit\/\$\{unitId\}\/board`\)/
    );
  });
});
