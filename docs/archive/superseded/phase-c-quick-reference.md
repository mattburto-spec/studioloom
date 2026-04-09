# Phase C Quick Reference — Student Toolkit Access

## For Students: How to Use the Tools

### 1. Opening Tools via the Floating FAB

**Where:** Bottom-right corner of any student page (dashboard, units, etc.)
**What it looks like:** Purple circle with ★ icon
**Has a badge?** If the number shows (e.g., "3"), you have 3 tools in progress

**How to use:**
1. Click the purple FAB
2. Compact menu opens showing available tools
3. Click a tool name → opens it in full-screen modal
4. Complete the tool or press Escape to close

---

### 2. Browsing All Tools

**URL:** `/tools` (in your student dashboard)
**What you'll see:** Dark theme page with all design thinking tools

**How to search:**
- Type in the search box (searches tool names, descriptions, synonyms)
- Click phase filter pills to narrow down: Discover, Define, Ideate, Prototype, Test
- "All phases" button clears the filter

**How to open a tool:**
- Click any tool card
- Tool opens in full-screen modal
- Interact with it as normal

---

### 3. Viewing Your Recent Tools

**Where:** Dashboard home page in "My Tools" section
**Shows:** Your 5 most recent tool sessions

**What each card shows:**
- Tool name (e.g., "scamper v1")
- Challenge/topic you were working on
- Status badge: green "In progress" or gray "Completed"
- How long ago you started it

**How to resume:**
- Click any session card
- If in-progress: opens tool at the working screen (your ideas are still there!)
- If completed: opens the summary view (read-only, can't edit)

**See all your tools?**
- Click "View all →" to go to the `/tools` browser

---

## For Developers: How the System Works

### Component Hierarchy

```
StudentLayout
├── QuickToolFAB
│   ├── ToolModal (dynamic import)
│   │   └── [Tool Component: ScamperTool, SixHatsTool, etc.]
│   └── [Popover menu]
└── [Page content: dashboard, units, etc.]
    ├── ToolModal (separate instance for dashboard "My Tools")
    │   └── [Tool Component]
    └── [Other content]

StudentToolBrowser (/tools)
├── [Search + Phase filter controls]
├── [Tool grid]
└── ToolModal (for opening selected tool)
```

### Data Flow

**Session Creation:**
1. User opens tool (from FAB, `/tools`, or dashboard)
2. API: `POST /api/student/tool-sessions` → creates session record
3. `useToolSession` hook: auto-saves state every 500ms
4. Tool state persisted to `student_tool_sessions.state` (JSONB)

**Session Completion:**
1. User reaches summary screen
2. Tool calls `onComplete` callback
3. API: `PATCH /api/student/tool-sessions/[id]` → mark as completed
4. API: `POST /api/student/portfolio` → create portfolio entry
5. ToolModal auto-closes (1 second delay)

**Session Resumption:**
1. User clicks tool in "My Tools" or FAB
2. API: `POST /api/student/tool-sessions` with `sessionId` param
3. API detects existing session, returns it
4. `useToolSession` loads and resumes

---

### Key Files

| File | Purpose |
|------|---------|
| `src/components/toolkit/QuickToolFAB.tsx` | Floating FAB + overlay menu |
| `src/components/toolkit/ToolModal.tsx` | Full-screen modal wrapper |
| `src/app/(student)/tools/page.tsx` | Tool discovery/browser |
| `src/app/(student)/dashboard/page.tsx` | Dashboard with "My Tools" section |
| `src/app/(student)/layout.tsx` | Renders FAB on all pages |
| `src/app/api/student/tool-sessions/route.ts` | CRUD API for sessions |
| `src/hooks/useToolSession.ts` | Session persistence logic |

---

### API Endpoints Used

#### GET /api/student/tool-sessions
Lists sessions for current student.

**Query params:**
- `limit=5` — return only 5 sessions (used by dashboard)
- `status=in_progress` — only incomplete sessions
- `status=completed` — only finished sessions

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "tool_id": "scamper",
      "challenge": "Design a water bottle",
      "status": "in_progress",
      "started_at": "2026-03-19T10:00:00Z",
      "version": 1
    }
  ]
}
```

#### POST /api/student/tool-sessions
Create or resume a session.

**Body:**
```json
{
  "toolId": "scamper",
  "challenge": "Design a water bottle",
  "mode": "standalone",
  "sessionId": "existing-uuid" // optional, to resume
}
```

#### PATCH /api/student/tool-sessions/[id]
Update session state or mark complete.

**Body (for state save):**
```json
{
  "state": { "stage": "working", "ideas": [...] }
}
```

**Body (for completion):**
```json
{
  "status": "completed",
  "summary": { "totalIdeas": 42, "timeSpentMs": 3600000 },
  "completedAt": "2026-03-19T10:30:00Z"
}
```

---

### Configuration

**Brand Colors:**
- FAB: `#7B2FF2` (brand-purple)
- In-progress badge: `#10B981` (green)
- Completed badge: `#6B7280` (gray)
- Phase colors (StudentToolBrowser):
  - discover: `#2E86AB`
  - define: `#A23B72`
  - ideate: `#F18F01`
  - prototype: `#C73E1D`
  - test: `#6A994E`

**Sizing:**
- FAB: 40px circle, 24px from bottom-right
- Overlay menu: 264px wide
- Tool grid: responsive (1-3 columns)

**Limits:**
- FAB menu: 8 tools max (can be increased)
- Dashboard "My Tools": 5 sessions (configurable via `?limit=5`)

---

### Styling Notes

**Light theme (Dashboard & units):**
- White backgrounds (`bg-white`)
- Gray borders (`border-border`)
- Dark text (`text-text-primary`)

**Dark theme (StudentToolBrowser `/tools`):**
- Navy background (`#0f0f1a`)
- White text with transparency gradients
- Phase-specific badge colors

**Animations:**
- FAB badge: orange with box-shadow
- Modal: scale + opacity transitions (300ms)
- Tool cards: hover tilt + glow effect
- Modal close: smooth fade (300ms)

---

## Troubleshooting

### FAB not appearing
- Check: Student is authenticated (logged in)
- Check: Browser not at `/login` or public routes
- Check: Not hidden via `hidden={true}` prop

### Tool won't open
- Check: Tool component exported correctly (`export function ToolName`)
- Check: Tool slug matches `toolId` in `tools-data.ts`
- Check: Browser console for errors

### Session not saving
- Check: API `PATCH /api/student/tool-sessions/[id]` returns 200
- Check: Database migrations applied (`student_tool_sessions` table exists)
- Check: Rate limit not exceeded (see `src/lib/rate-limit.ts`)

### Dashboard "My Tools" empty
- Check: Student has started at least 1 tool session
- Check: API endpoint `GET /api/student/tool-sessions?limit=5` returns data

### Phase filter not working
- Check: Tool has correct `phases` array in `tools-data.ts`
- Check: Filter state updating (React DevTools)

---

## Integration with Other Systems

### Portfolio Auto-Capture
When a tool session completes:
1. ✅ Portfolio entry auto-created (type: "toolkit")
2. ✅ Links to tool name, challenge, summary
3. ✅ Appears in portfolio timeline
4. ✅ Included in portfolio export

### Design Assistant (Phase D)
- Will suggest tools based on student's current work
- Suggestion text → clickable link → opens ToolModal
- Pre-fills challenge from conversation context

### Grading (Future)
- Teachers can view tool responses
- Will add scoring rubrics for tool work
- Scores map to MYP criteria

---

## Future Enhancements

### Planned (Phase A)
- Teacher can assign tools to unit pages
- Tools render inline on pages (not modal)
- Student sees tool as activity section
- Responses tied to specific page/lesson

### Planned (Phase D)
- Design assistant detects when tool is helpful
- Suggests tool with conversation context
- Opens pre-filled with student's challenge

### Possible Future
- Cross-tool synthesis ("Your SCAMPER had X ideas, PMI analysis...")
- Version comparison UI (see growth from v1 to v2)
- Collaborative tool sessions (multiple students)
- Custom tool parameters (teachers can modify prompts)
- Offline support (service worker caching)

---

## Performance Tips

**For Students:**
- Tools save automatically (no need to click Save)
- Close modal anytime with Escape key
- Recent tools show on dashboard for quick access

**For Developers:**
- Tool components lazy-load via `dynamic()`
- Session state uses optimistic updates
- API rate limiting prevents abuse
- Debounced auto-save (500ms) reduces API calls

---

## Support

**For Students:**
- Can't find a tool? Use search on `/tools` page
- Want to resume? Check "My Tools" on dashboard
- Tool not responding? Refresh page or try again later

**For Teachers:**
- Phase A (embedded) coming soon
- Until then, direct students to `/tools` or FAB
- Tools auto-save, so students won't lose progress

**For Developers:**
- TypeScript types: See `Tool` interface in `src/app/toolkit/tools-data.ts`
- Error handling: Sentry integrated, check dashboard for errors
- Tests: See `docs/toolkit-phase-c-testing.md` for test cases
