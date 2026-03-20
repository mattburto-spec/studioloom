# Phase C: Standalone Toolkit Access — Testing Guide

## Components Built

### 1. QuickToolFAB (`src/components/toolkit/QuickToolFAB.tsx`)
- **Location:** Bottom-right FAB on all student pages (dashboard, units, etc.)
- **Appearance:** 40px purple circle (#7B2FF2) with star icon ★
- **Badge:** Shows count of in-progress tool sessions (orange badge, top-right)
- **Interaction:**
  - Click FAB → opens compact overlay showing 6-8 most relevant interactive tools
  - Each tool card shows: color dot, name, time estimate, phase badge
  - Click a tool → opens ToolModal with that tool
  - Positioned 24px from bottom-right edge
  - Stacks above QuickCaptureFAB if both present (56px gap)

### 2. ToolModal (`src/components/toolkit/ToolModal.tsx`)
- **Location:** Full-screen modal overlay (z-index 100)
- **Features:**
  - Dark overlay (bg-black/50) with white tool container
  - Close button (X) in top-right corner
  - Escape key closes modal
  - Tool renders in `mode="standalone"`
  - Auto-closes after tool completion (1 second delay for animation)
  - Suspense boundary with loading fallback

### 3. StudentToolBrowser (`src/app/(student)/tools/page.tsx`)
- **URL:** `/tools` (student-facing route, requires auth)
- **Appearance:** Dark theme (#0f0f1a background, white text, aurora gradient hero)
- **Features:**
  - Search bar (searches tool name, description, synonyms)
  - Phase filter pills: All phases + Discover, Define, Ideate, Prototype, Test
  - Tool grid: 1-3 columns responsive, 3-column on desktop
  - Each card shows: name, description, difficulty badge, time estimate, phases
  - Color-coded by phase (discover=#2E86AB, define=#A23B72, ideate=#F18F01, prototype=#C73E1D, test=#6A994E)
  - Click card → opens ToolModal with selected tool
  - Shows result count

### 4. Dashboard Integration
- **New Section:** "My Tools" showing 5 most recent tool sessions
- **Session cards show:**
  - Tool icon (purple diamond with clock)
  - Tool name + version (v1, v2, etc.)
  - Challenge/topic (truncated)
  - Status badge (green=in-progress, gray=completed)
  - Time ago (e.g., "2 hours ago")
  - Click → opens ToolModal to resume/review
- **"View all" link** → navigates to `/tools` browser
- **Only shows if** student has at least 1 tool session

### 5. Layout Updates (`src/app/(student)/layout.tsx`)
- Added QuickToolFAB import
- Renders QuickToolFAB on all student pages
- FAB hidden while loading

### 6. API Endpoint Update (`src/app/api/student/tool-sessions/route.ts`)
- Added `limit` query parameter support to GET endpoint
- Default limit: 100, can be overridden (e.g., `?limit=5`)
- Used by dashboard to fetch recent 5 sessions

---

## Test Cases

### Test 1: QuickToolFAB Rendering
**Steps:**
1. Log in as student
2. Navigate to `/dashboard`
3. Scroll to bottom-right of page

**Expected:**
- Purple circle FAB visible in bottom-right (40px, 24px from edges)
- FAB shows star icon ★
- If student has in-progress tools, orange badge shows count

**Variations:**
- FAB should also appear on unit pages (`/unit/[unitId]/[pageId]`)
- FAB should stack above QuickCaptureFAB (if both visible)

### Test 2: QuickToolFAB Interaction
**Steps:**
1. Click the FAB

**Expected:**
- Compact overlay popover opens (264px wide, max-height 80vh)
- Shows header "Design Tools" with close X button
- Lists 6-8 interactive tools (scamper, six-hats, pmi, five-whys, empathy-map, decision-matrix, how-might-we)
- Each tool shows: color dot, name, time estimate, phase badge
- "View all tools" link at bottom
- Click outside overlay → closes
- Escape key → closes

**Variations:**
- Select a tool from overlay → closes overlay, opens ToolModal

### Test 3: ToolModal Opening
**Steps:**
1. From QuickToolFAB overlay, click "SCAMPER"

**Expected:**
- Full-screen modal appears (z-index 100)
- Dark overlay (bg-black/50) with white container
- Close button (X) visible in top-right
- ScamperTool component renders inside (dark toolkit theme)
- Can interact with tool (add challenge, enter ideas, etc.)

### Test 4: ToolModal Closing
**Steps:**
1. Tool open in modal
2. Click X button

**Expected:**
- Modal animates close (scale-95, opacity-0 over 300ms)
- Body scroll re-enabled
- Focus returned to previous page

**Variations:**
- Press Escape key → closes modal
- Complete tool (reach summary screen) → auto-closes after 1 second

### Test 5: StudentToolBrowser
**Steps:**
1. Navigate to `/tools` directly or click "View all tools" from anywhere

**Expected:**
- Dark theme page loads (#0f0f1a background)
- Hero section with title "Design Thinking Tools"
- Search bar (with search icon)
- Phase filter pills: "All phases" + 5 phase buttons
- Tool grid showing all interactive tools (7-8 tools)
- Each tool card has:
  - Name, description
  - Difficulty badge (color-coded)
  - Time estimate
  - Phase tags
  - "Open tool" link with arrow

**Interactions:**
- Search for "scamper" → filters to SCAMPER tool only
- Click phase pill (e.g., "ideate") → filters to only ideation tools
- Click "All phases" → clears filter
- Results count updates: "Showing 7 of 7 tools"
- Click tool card → opens ToolModal

### Test 6: Dashboard "My Tools" Section
**Steps:**
1. Student completes or starts a tool (from unit page or `/tools`)
2. Return to `/dashboard`

**Expected:**
- "My Tools" section appears (only if student has ≥1 session)
- Shows "View all →" link (goes to `/tools`)
- Lists up to 5 most recent sessions
- Each session shows:
  - Purple diamond icon
  - Tool name + version (e.g., "scamper v1")
  - Challenge text (truncated, 1 line)
  - Green "In progress" or gray "Completed" badge
  - Time ago (e.g., "5 minutes ago")
- Click session → opens ToolModal to resume/review
- Session in-progress → opens working screen
- Session completed → opens summary screen (read-only)

### Test 7: Tool Session Persistence
**Steps:**
1. Student opens tool from `/tools` via QuickToolFAB or `/tools` page
2. Enters challenge
3. Adds ideas (goes through working screen)
4. Closes modal (X button, not completing)
5. Open FAB again, select same tool

**Expected:**
- Modal opens with same tool
- Session is resumed (not a new session)
- Challenge pre-filled
- Ideas still present (from before)
- Can continue where left off

### Test 8: Tool Completion
**Steps:**
1. Student completes a tool (reaches summary screen)
2. Tool auto-closes after 1 second
3. Check `/dashboard` "My Tools" section

**Expected:**
- Dashboard reloaded or manually refreshed shows new completed session
- Session has gray "Completed" badge
- Entry has timestamp of completion
- Can click to review summary (read-only)

### Test 9: In-Progress Badge
**Steps:**
1. Student starts 2 tools but doesn't complete them
2. Navigate to `/dashboard` and look at FAB

**Expected:**
- FAB shows orange badge with "2" in top-right corner
- Badge updates as new tools are started
- Badge clears if all tools are completed

---

## API Endpoints Used

### GET /api/student/tool-sessions
**Query Parameters:**
- `limit` (optional, default 100): max number of sessions to return
- `status` (optional): filter by "in_progress" or "completed"
- `unitId` (optional): filter by unit
- `toolId` (optional): filter by tool

**Example:**
```
GET /api/student/tool-sessions?limit=5
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "...",
      "student_id": "...",
      "tool_id": "scamper",
      "challenge": "Design a better water bottle",
      "mode": "standalone",
      "version": 1,
      "status": "in_progress",
      "started_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T10:35:00Z",
      "state": { ... },
      "summary": null,
      "completed_at": null
    }
  ]
}
```

---

## Styling Notes

- **Brand color:** #7B2FF2 (brand-purple) for FAB and purple elements
- **Accent colors:** #10B981 (green) for "in progress", #6B7280 (gray) for "completed"
- **Dark theme:** #0f0f1a background on `/tools` page, white text
- **Light theme:** white background on dashboard, light text colors

---

## Known Limitations / Future Work

1. **No teacher assignment of tools** — Phase C is student-initiated only. Phase A handles embedded/teacher-assigned mode.
2. **No contextual suggestions** — Phase D adds AI design assistant tool suggestions.
3. **No analytics** — Session completion rates, time spent per tool not yet tracked in dashboards.
4. **Max 8 tools in FAB** — hardcoded `.slice(0, 8)` in QuickToolFAB. Could be dynamic based on relevance.
5. **No versioning UI in `/tools`** — browser doesn't show version numbers, only dashboard does.
6. **Public `/toolkit` vs student `/tools`** — student `/tools` is simpler (phase filter only). Public `/toolkit` is more powerful (multi-factor filtering, deploy modes, etc.).

---

## Files Changed

- ✅ `src/components/toolkit/QuickToolFAB.tsx` (new)
- ✅ `src/components/toolkit/ToolModal.tsx` (new)
- ✅ `src/app/(student)/tools/page.tsx` (new)
- ✅ `src/app/(student)/dashboard/page.tsx` (updated: added "My Tools" section, ToolModal, loadToolSessions hook)
- ✅ `src/app/(student)/layout.tsx` (updated: imported and rendered QuickToolFAB)
- ✅ `src/app/api/student/tool-sessions/route.ts` (updated: added limit query parameter support)
