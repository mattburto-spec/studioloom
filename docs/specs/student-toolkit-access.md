# Student Toolkit Access — Feature Spec
**Author:** Matt Burton + Claude | **Date:** 19 March 2026 | **Status:** Draft

---

## Problem Statement

StudioLoom has 12 interactive AI-powered toolkit tools (SCAMPER, Six Hats, PMI, Decision Matrix, etc.) but students can only access them via the public `/toolkit` route — which has no auth, no data persistence, and no connection to their unit work. Meanwhile, the existing response types (`text`, `upload`, `voice`, `decision-matrix`, `pmi`, `pairwise`, `trade-off-sliders`) save to Supabase and flow into portfolios, but the interactive toolkit tools don't.

This means: (a) teachers can't embed toolkit tools in unit pages as structured activities, (b) students lose their toolkit work when they close the browser, (c) the AI design assistant can't suggest tools contextually, and (d) the portfolio is missing the richest thinking artifacts students produce.

## Goals

1. **Teachers can embed any toolkit tool as a response type on a unit page** — students complete it inline, work saves automatically, flows into portfolio
2. **Students can self-serve tools** from a floating launcher + nav link, with work saved to their profile and attachable to unit pages later
3. **The AI design assistant can suggest relevant tools** based on what the student is working on, opening them in context
4. **All tool work is persisted, retrievable, and exportable** — students can revisit, edit, and include in portfolio narratives
5. **Tool components are reusable** — same React component works in both embedded (unit page) and standalone (student-initiated) modes

## Non-Goals

- **Building new toolkit tools** — this spec covers the access/persistence layer, not new tool development
- **Teacher-customisable tool parameters** — teachers can't yet modify SCAMPER prompts or add custom steps (future)
- **Real-time collaboration** — no shared/multiplayer tool sessions (future, would need WebSocket)
- **Offline support** — no local persistence or service worker caching (future)
- **Grading tool responses** — teachers can view but not score individual tool sessions (grading comes in the exemplar-aware grading phase)

---

## Architecture Overview

### Two Modes, One Component

```
┌─────────────────────────────────────────────────────┐
│  ToolkitTool (shared component)                     │
│                                                     │
│  Props:                                             │
│  - toolId: string (e.g., "scamper", "swot")         │
│  - mode: "embedded" | "standalone"                  │
│  - challenge?: string (pre-filled by teacher)       │
│  - sessionId?: string (for resuming)                │
│  - onComplete?: (data: ToolResponse) => void        │
│                                                     │
│  Renders the tool's 3-screen flow (intro→work→done) │
│  Saves to Supabase via API on every interaction     │
└─────────────────────────────────────────────────────┘
         │                              │
    ┌────┴────┐                   ┌─────┴─────┐
    │EMBEDDED │                   │STANDALONE  │
    │ mode    │                   │ mode       │
    │         │                   │            │
    │ Rendered│                   │ Opened via │
    │ inside  │                   │ floating   │
    │ unit    │                   │ launcher   │
    │ page as │                   │ or nav     │
    │ response│                   │ link       │
    │ type    │                   │            │
    │         │                   │ Saves to   │
    │ Saves   │                   │ student_   │
    │ as page │                   │ tool_      │
    │ response│                   │ sessions   │
    └─────────┘                   └────────────┘
```

### Data Model

#### New table: `student_tool_sessions`

```sql
CREATE TABLE student_tool_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  tool_id TEXT NOT NULL,           -- e.g., "scamper", "decision-matrix"
  challenge TEXT NOT NULL,          -- the problem/topic the student entered
  mode TEXT NOT NULL DEFAULT 'standalone', -- "embedded" | "standalone"

  -- For embedded mode: links to the unit page
  unit_id UUID REFERENCES units(id),
  page_id TEXT,                     -- the page within the unit
  section_index INT,                -- which activity section on the page

  -- Tool state (the actual work)
  state JSONB NOT NULL DEFAULT '{}', -- full tool state: steps, ideas, scores, etc.
  summary JSONB,                     -- AI-generated summary from the tool's summary screen

  -- Versioning (multiple attempts per tool per page)
  version INT NOT NULL DEFAULT 1,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'in_progress', -- "in_progress" | "completed"
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Portfolio integration
  portfolio_entry_id UUID REFERENCES portfolio_entries(id)
);

CREATE INDEX idx_tool_sessions_student ON student_tool_sessions(student_id);
CREATE INDEX idx_tool_sessions_unit ON student_tool_sessions(unit_id, page_id);
CREATE INDEX idx_tool_sessions_tool ON student_tool_sessions(tool_id);
```

#### ToolResponse shape (JSONB in `state` column)

```typescript
interface ToolResponse {
  toolId: string;
  challenge: string;
  steps: ToolStep[];
  metadata: {
    totalIdeas: number;
    averageEffort: 'low' | 'medium' | 'high';
    timeSpentMs: number;
    promptsDealt: number;
    nudgesReceived: number;
  };
}

interface ToolStep {
  stepId: string;
  stepLabel: string;
  ideas: ToolIdea[];
  promptsUsed: string[];
}

interface ToolIdea {
  text: string;
  effort: 'low' | 'medium' | 'high';
  depth: 1 | 2 | 3;
  timestamp: string;
}
```

---

## User Stories

### Teacher (Embedded Mode)

**T1.** As a teacher building a unit, I want to add a "Toolkit Tool" activity to a page, so that students complete a structured thinking exercise as part of the lesson.

**T2.** As a teacher, I want to choose which tool (SCAMPER, SWOT, PMI, etc.) and optionally pre-fill the challenge/topic, so that the tool is contextualised to the unit's design brief.

**T3.** As a teacher viewing student progress, I want to see which students have completed the embedded tool and view their responses, so that I can assess their thinking quality.

**T4.** As a teacher, I want embedded tool responses to appear in the student's portfolio alongside other responses, so that the portfolio captures the full design process.

### Student (Embedded Mode)

**S1.** As a student on a unit page, I want to complete an embedded toolkit tool inline (without leaving the page), so that my work is part of the lesson flow.

**S2.** As a student, I want my tool work to save automatically as I go, so that I don't lose progress if I close the browser.

**S3.** As a student returning to a unit page, I want to see my previous tool work and be able to continue or review it, so that I can pick up where I left off.

### Student (Standalone Mode)

**S4.** As a student, I want a floating toolkit button on my dashboard so I can quickly open any thinking tool when I need it, without waiting for the teacher to assign one.

**S5.** As a student, I want a "Tools" link in my navigation that shows a simplified tool browser (not the full teacher toolkit), so I can browse and choose the right tool for my situation.

**S6.** As a student, I want my standalone tool sessions saved to my profile, so I can revisit them later and attach them to unit pages if relevant.

### AI Design Assistant Integration

**A1.** As a student chatting with the design assistant, I want it to suggest relevant tools when I'm stuck (e.g., "Try using a PMI Chart to evaluate your options"), so that I get actionable guidance.

**A2.** As a student, I want to open a suggested tool in a modal overlay without losing my place in the unit, so that the tool is a side activity, not a navigation away.

---

## Requirements

### Must-Have (P0)

#### P0-1: New ResponseType — `toolkit-tool`
Add `"toolkit-tool"` to the `ResponseType` union in `src/types/index.ts`. The `ActivitySection` gains an optional `toolId` field specifying which tool to render.

**Acceptance criteria:**
- [ ] `ResponseType` includes `"toolkit-tool"`
- [ ] `ActivitySection` has optional `toolId: string` and optional `toolChallenge: string`
- [ ] `ResponseInput` renders the appropriate tool component when `responseType === "toolkit-tool"`
- [ ] Tool renders inline on the page (not a separate route)

#### P0-2: ToolSession API endpoints
Create CRUD endpoints for tool sessions.

**Acceptance criteria:**
- [ ] `POST /api/student/tool-sessions` — create a new session (returns sessionId)
- [ ] `PATCH /api/student/tool-sessions/[id]` — update state (auto-save)
- [ ] `GET /api/student/tool-sessions/[id]` — retrieve a session (for resuming)
- [ ] `GET /api/student/tool-sessions?unitId=X&pageId=Y` — get session for an embedded tool
- [ ] `GET /api/student/tool-sessions?studentId=X` — list all sessions for a student
- [ ] Auth middleware validates student owns the session
- [ ] Rate limiting on write endpoints

#### P0-3: Auto-save on every interaction
Tool state saves to Supabase after every idea submission, step change, and completion.

**Acceptance criteria:**
- [ ] Debounced auto-save (500ms after last change)
- [ ] Optimistic UI — student sees their work immediately, save happens in background
- [ ] Save failure shows subtle amber indicator (not blocking)
- [ ] On page load, check for existing session and resume if found

#### P0-4: Portfolio auto-capture
When a tool session is completed, automatically create a portfolio entry.

**Acceptance criteria:**
- [ ] Completing a tool (reaching summary screen) creates a `PortfolioEntry`
- [ ] Entry includes: tool name, challenge, summary, number of ideas, time spent
- [ ] For embedded mode: entry links to the unit page and activity section
- [ ] Entry appears in the portfolio timeline with a toolkit icon

#### P0-5: Embedded mode in unit pages
Tool renders inline inside the existing page layout, matching the activity section pattern.

**Acceptance criteria:**
- [ ] Tool appears where other response types appear (after the prompt, before next section)
- [ ] Challenge can be pre-filled by the teacher or entered by the student
- [ ] If pre-filled, the intro screen is skipped (goes straight to working)
- [ ] Student can't change a teacher-assigned challenge
- [ ] Tool respects the page's existing styling (dark toolkit theme contained within the component)

### Nice-to-Have (P1)

#### P1-1: Floating toolkit launcher
Small purple circle button (matching StudioLoom logo) pinned bottom-right of student dashboard and unit pages.

**Acceptance criteria:**
- [ ] Button is always visible but unobtrusive (40px circle, subtle shadow)
- [ ] Click opens a compact overlay showing 6-8 most relevant tools
- [ ] Tools are sorted by relevance to current context (if on a "Developing Ideas" page, Ideation tools first)
- [ ] Selecting a tool opens it in a modal overlay (not full-page navigation)
- [ ] Modal has a close button that saves progress and returns to the previous page

#### P1-2: "Tools" nav link for students
A link in the student navigation that opens a simplified tool browser.

**Acceptance criteria:**
- [ ] Shows only interactive tools (not template-only catalog tools)
- [ ] Simplified filtering: by design phase only (not the full teacher toolkit's multi-factor filtering)
- [ ] Each tool card shows: name, phase, time estimate, brief description
- [ ] Click opens the tool in standalone mode

#### P1-3: Tool session history
Students can view and revisit all their past tool sessions.

**Acceptance criteria:**
- [ ] "My Tools" section on student dashboard showing recent sessions
- [ ] Each session shows: tool name, challenge, date, status (in-progress / completed)
- [ ] Click resumes in-progress or reviews completed sessions
- [ ] Completed sessions show the summary view (read-only)

### Future Considerations (P2)

#### P2-1: AI assistant tool suggestions
The design assistant detects when a student would benefit from a specific tool and suggests it inline.

**Details:** The assistant's system prompt gains awareness of available tools and their best-use phases. When the student describes a problem that maps to a tool's purpose (e.g., "I can't decide between these options" → Decision Matrix), the assistant suggests it with a clickable link that opens the tool pre-filled with context from the conversation.

#### P2-2: Teacher-customisable tool parameters
Teachers can modify tool settings per unit page: custom SCAMPER prompts, pre-defined SWOT categories, specific stakeholders for Stakeholder Map, etc.

#### P2-3: Tool response grading
Teachers can score tool responses on quality criteria (depth of thinking, number of perspectives, specificity). Scores map to MYP criteria.

#### P2-4: Cross-tool synthesis
AI analyses multiple tool sessions from the same unit and generates a synthesis: "Your SCAMPER generated 3 ideas, your PMI analysis highlighted trade-offs, and your Decision Matrix identified Option B as the strongest. Here's how they connect..."

---

## Success Metrics

### Leading (first 2 weeks)
- **Tool embed adoption:** >30% of new unit pages include at least one toolkit-tool activity
- **Standalone tool usage:** >20% of active students use the floating launcher or nav link at least once
- **Session completion rate:** >60% of started tool sessions reach the summary screen
- **Auto-save reliability:** <0.1% failed saves

### Lagging (first 2 months)
- **Portfolio richness:** Average portfolio entries per student increases by 40%+ (tool sessions add new entry types)
- **Time in toolkit tools:** >15 min/week average per active student
- **Teacher satisfaction:** Teachers report that embedded tools improve lesson quality (qualitative feedback)

---

## Implementation Phases

### Phase A: Data layer + embedded mode (3-4 days)
1. Create `student_tool_sessions` table + migration
2. Build API endpoints (CRUD + auto-save)
3. Add `toolkit-tool` response type
4. Refactor one tool (SCAMPER) into a reusable component that accepts `mode` prop
5. Wire auto-save + session resumption
6. Portfolio auto-capture on completion
7. Test embedded SCAMPER in a unit page

### Phase B: Extract all tools to shared components (2-3 days)
8. Extract remaining 11 tools from `/toolkit/[slug]/page.tsx` into shared components
9. Each component accepts: `toolId`, `mode`, `challenge`, `sessionId`, `onComplete`, `onSave`
10. The `/toolkit/[slug]` routes become thin wrappers around the shared components (public/unauthenticated mode)
11. The embedded response type renders the same components (authenticated/persistent mode)

### Phase C: Standalone access (2 days)
12. Build floating launcher (QuickToolFAB)
13. Build student tool browser (simplified `/toolkit` for students)
14. Build "My Tools" section on student dashboard
15. Modal overlay for standalone tool usage

### Phase D: AI integration (1-2 days)
16. Add tool awareness to design assistant system prompt
17. Render tool suggestion links in assistant responses
18. Open suggested tools in modal with conversation context pre-filled

---

## Decisions Made (19 March 2026)

| # | Question | Decision |
|---|----------|----------|
| 1 | Floating launcher on all pages or only during units? | **All pages.** Students sometimes want a tool quickly for something outside the current unit. |
| 2 | Link standalone sessions to later-assigned embedded tools? | **Yes.** System detects if a student already has a standalone session with the same tool and offers to link it. |
| 3 | Should completed tool sessions be editable? | **Yes, editable.** Summary screen shows a "Edit" button to reopen and add more ideas, plus a "New Version" button to start fresh. Multiple versions per tool per page are supported. |
| 4 | Teacher changes assigned tool after students completed it? | **Keep old data.** Show graceful message: "This activity was updated. Your previous [SCAMPER] work is saved in your portfolio. Complete the new [PMI] activity below." |
| 5 | Public `/toolkit` vs student auth? | **Both.** Public routes stay unauthenticated (free lead gen). Student routes require auth and persist data. Same components, two modes. |

## Versioning: Multiple Tool Sessions Per Page

When a student clicks "New Version" on a completed tool, a new session is created linked to the same unit page. The UI needs to handle multiple versions gracefully:

**Default view:** Show the most recent version's summary (read-only). If in-progress, show the working screen.

**Version switcher:** Small pills below the tool header: `v1 (completed) · v2 (completed) · v3 (in progress)`. Click to switch between versions. Active version is highlighted.

**Data model change:** The `student_tool_sessions` table already supports multiple rows per `(student_id, unit_id, page_id, tool_id)` — they're distinguished by `started_at` and `id`. Add a `version` INT column (auto-incremented per student+page+tool combination).

**Portfolio impact:** Each completed version creates its own portfolio entry. The portfolio timeline shows them as "SCAMPER v1", "SCAMPER v2", etc. This is actually good — it shows iteration and growth, which is exactly what MYP design portfolios are supposed to capture.

**Teacher view:** Teacher sees all versions for each student. Can compare v1 → v2 to assess growth. This feeds directly into the exemplar-aware grading system later.

## Open Questions (Remaining)

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Max versions per tool per page? (Suggest: unlimited, but UI only shows last 5 with "show all" link) | Matt | No |
| 2 | When a student links a standalone session to an embedded tool, does it become v1 of that page's tool, or does it stay standalone with a cross-reference? | Engineering | No — design during Phase A |

---

## Technical Notes

### Existing patterns to reuse
- `ResponseInput` component already switches on `responseType` — add a new case for `toolkit-tool`
- `usePageResponses` hook handles saving responses to Supabase — extend for tool sessions
- `QuickCaptureFAB` component is the existing floating button pattern — model `QuickToolFAB` on this
- `PortfolioPanel` already renders different entry types — add a toolkit entry renderer
- `DesignAssistantWidget` already renders inline suggestions — add tool suggestion rendering

### Key files to modify
- `src/types/index.ts` — add ResponseType, ActivitySection fields
- `src/components/student/ResponseInput.tsx` — add toolkit-tool case
- `src/hooks/usePageResponses.ts` — extend for tool session persistence
- `src/components/portfolio/PortfolioPanel.tsx` — add tool entry type
- `src/app/api/student/tool-sessions/` — new API routes
- `src/components/toolkit/` — new directory for shared tool components

### Database migration number
This will be migration 026 (`026_student_tool_sessions.sql`).
