# Student Dashboard Redesign — "My Design Journey"

*Priority spec. The student dashboard is the single most-visited page in the app. It should tell a story of growth, not list assignments.*

---

## The Problem

The current dashboard is an assignment tracker. It shows units with progress bars and a "Recent Portfolio Activity" section that's collapsed by default. Students see: "You're 67% done with Unit 3." That's not motivating, it's not reflective, and it wastes the mountain of data we already collect.

**Data we have but don't show:**
- Design conversation history with Bloom's level progression
- Tool session iterations (v1 → v2 → v3 showing growth)
- Time spent per page/criterion
- Open Studio session logs with productivity scores
- NM/Melbourne Metrics competency self-assessments + teacher observations
- Planning tasks with completion status
- Due dates (unit-level + per-page)
- Effort scores from every toolkit interaction
- Student discovery profile (archetype, strengths, interests, needs)

The dashboard should surface this data as a **journey**, not a spreadsheet.

---

## Design Principles

1. **Journey, not checklist.** The hero element is a visual path showing where the student IS in their design thinking journey — not a list of what's left to do.
2. **Every action has a visible consequence.** Submit a tool → badge progress moves. Write a deep reflection → effort streak extends. Complete a safety cert → it appears on the wall.
3. **Teacher sees the same thing.** The teacher's per-student view is identical to what the student sees, plus teacher-only overlays (integrity flags, observation notes). One truth, two audiences.
4. **Celebrate depth over speed.** Don't reward rushing through pages. Reward effort quality, tool iteration, Bloom's level growth, design cycle coverage.
5. **MYP-native language.** Use design cycle phases (Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating), not generic "progress" language.

---

## Architecture: Three Layers

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│   Layer 1: JOURNEY MAP (hero)                             │
│   Visual path through design cycle                        │
│                                                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│   Layer 2: BADGE WALL + STATS                             │
│   Earned badges, safety certs, streaks, tool mastery      │
│                                                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│   Layer 3: ACTIVE WORK                                    │
│   Continue card, upcoming due dates, recent activity      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Layer 1: Journey Map (The Hero)

### Concept

A horizontal visual path rendered as an SVG showing the MYP Design Cycle as 4 connected zones. The student's avatar sits on the path at their current position. Completed zones are filled/coloured; upcoming zones are ghosted. Each zone shows the criterion letter (A/B/C/D) and the student's achievement level.

This is NOT a progress bar. It's a map with terrain, landmarks, and a sense of "where I've been and where I'm going."

### Visual Design

```
  ┌─── Inquiring ───┐  ┌── Developing ──┐  ┌── Creating ───┐  ┌── Evaluating ──┐
  │  & Analysing     │  │   Ideas        │  │  the Solution │  │                │
  │                  │  │                │  │               │  │                │
  │  🔍 Criterion A  │──│  💡 Criterion B │──│  🔨 Criterion C│──│  📊 Criterion D │
  │                  │  │                │  │               │  │                │
  │  ████░░ 4/6     │  │  ██░░░░ 2/6   │  │  ░░░░░░ 0/6  │  │  ░░░░░░ 0/6   │
  │                  │  │                │  │               │  │                │
  └──────────────────┘  └────────────────┘  └───────────────┘  └────────────────┘
                              🧑 ← student avatar is here
```

**Per-zone details (shown on hover/tap):**
- Criterion letter + name
- Pages completed / total pages in this phase
- Achievement level indicator (0-8 MYP scale, if graded)
- Time spent in this zone
- Tools used (toolkit badges earned in this phase)

**Multi-unit support:** Each assigned unit is a separate journey row. The "Continue Where You Left Off" card sits at the start and links to the unit with the most recent activity.

**Terrain metaphor options (pick one):**

| Metaphor | Zone A | Zone B | Zone C | Zone D |
|----------|--------|--------|--------|--------|
| **Landscape** | Mountains (research/exploration) | Workshop (building/sketching) | Factory (making/prototyping) | Observatory (testing/reflecting) |
| **Ocean voyage** | Harbour (departure) | Open sea (navigation) | Island (arrival/building) | Lighthouse (reflection) |
| **Space mission** | Launch pad | Orbit | Moon landing | Earth return |

Recommend **Landscape** — most natural for design students. Each zone gets a simple SVG silhouette (mountain range, workshop roof, factory chimney, observatory dome) with the zone colour as the fill. ~40 lines of SVG per zone.

### Implementation

**Component:** `JourneyMap.tsx` (~200 lines)

**Data needed (all already available):**
```typescript
interface JourneyMapProps {
  units: Array<{
    unitId: string;
    title: string;
    pages: Array<{
      pageId: string;
      criterion: 'A' | 'B' | 'C' | 'D';
      status: 'not_started' | 'in_progress' | 'complete';
      timeSpent: number;
    }>;
    toolsCompleted: string[];  // from StudentToolSession
    currentPageId: string | null;
  }>;
  studentName: string;
  avatarUrl?: string;
}
```

**How it maps pages to zones:**
- Each page in the unit has a `criterion` field (A/B/C/D mapped from the unit schema)
- Zone A = all pages tagged criterion A (Inquiring & Analysing)
- Zone B = criterion B (Developing Ideas)
- Zone C = criterion C (Creating the Solution)
- Zone D = criterion D (Evaluating)
- Student position = the zone containing their most recently active page

**Responsive:** Horizontal scroll on mobile with snap points per zone. Desktop: full width, all 4 zones visible.

---

## Layer 2: Badge Wall + Stats

### Badge Categories

Badges are the heart of the motivation system. They stack — small achievements combine into bigger credentials. All badge data is computable from existing DB records (no new tables needed).

#### 2a. Design Cycle Mastery Badges

Earned by completing criterion-specific work across units.

| Badge | Criteria | Tier | Evidence |
|-------|----------|------|----------|
| **Inquirer** | Complete 3+ Criterion A pages with avg effort ≥ medium | Bronze/Silver/Gold | StudentProgress where criterion=A, status=complete |
| **Idea Generator** | Complete 3+ Criterion B pages | Bronze/Silver/Gold | StudentProgress where criterion=B |
| **Maker** | Complete 3+ Criterion C pages | Bronze/Silver/Gold | StudentProgress where criterion=C |
| **Evaluator** | Complete 3+ Criterion D pages | Bronze/Silver/Gold | StudentProgress where criterion=D |
| **Design Thinker** | Earn all 4 above at Silver+ | Meta badge | Computed from sub-badges |

**Tier thresholds:**
- Bronze: 3 pages complete
- Silver: 5 pages complete + avg time > 10 min per page (not rushing)
- Gold: 8 pages complete + high effort responses (from integrity/effort data)

#### 2b. Safety Certifications

Teacher-granted certifications for workshop tool competency.

| Badge | How earned | Display |
|-------|-----------|---------|
| **General Workshop Safety** | Teacher marks as passed | Green shield |
| **Laser Cutter Certified** | Teacher marks as passed | Orange shield |
| **Soldering Certified** | Teacher marks as passed | Yellow shield |
| **3D Printer Certified** | Teacher marks as passed | Blue shield |
| **Hand Tools Certified** | Teacher marks as passed | Red shield |
| **Power Tools Certified** | Teacher marks as passed | Purple shield |

**Implementation:** New `safety_certifications` table (student_id, cert_type, granted_by, granted_at, notes). Teacher grants from student detail page or Teaching Mode. Simple CRUD — ~1 hour to build.

**Visual:** Shield icons with tool silhouette. Earned = full colour. Not yet = greyed outline. Students see exactly what they need to earn to use that machine.

#### 2c. Toolkit Mastery Badges

Auto-earned from `student_tool_sessions` data.

| Badge | Criteria | Evidence |
|-------|----------|---------|
| **SCAMPER Explorer** | Complete 1 SCAMPER session | tool_id='scamper', status='completed' |
| **SCAMPER Master** | Complete 3+ sessions OR version ≥ 3 | Iteration shows growth |
| **Six Hats Thinker** | Complete 1 Six Hats session | tool_id='six-thinking-hats' |
| **Root Cause Analyst** | Complete 1 Five Whys session | tool_id='five-whys' |
| **Empathy Expert** | Complete 1 Empathy Map session | tool_id='empathy-map' |
| **Decision Maker** | Complete 1 Decision Matrix session | tool_id='decision-matrix' |
| **Toolkit Journeyman** | Complete 5 different tools | Distinct tool_ids |
| **Toolkit Master** | Complete 10 different tools | Distinct tool_ids |

**Visual:** Circular badge with tool icon. Colour = tool's theme colour from `tools-data.ts`. Auto-computed on dashboard load from tool session records.

#### 2d. Effort & Growth Badges

Earned from effort-gating data, conversation history, and NM assessments.

| Badge | Criteria | Evidence |
|-------|----------|---------|
| **Deep Thinker** | 10+ high-effort responses across all tools | ideaEfforts data |
| **Consistent Worker** | Active on 5+ consecutive school days | time_spent > 0 on 5 consecutive weekdays |
| **Bloom's Climber** | Design Assistant conversations show Bloom's level increase (1→3+) | conversation bloom_level progression |
| **Self-Aware Learner** | Complete 3+ NM self-assessments | competency_assessments where source='student_self' |
| **Reflective Practitioner** | Write 5+ reflections with 20+ meaningful words | Reflection word count from responses |
| **Iterative Designer** | Create v2+ of any toolkit tool | tool_sessions where version ≥ 2 |

#### 2e. Open Studio Badges

Earned from Open Studio session data.

| Badge | Criteria | Evidence |
|-------|----------|---------|
| **Studio Access** | Earn Open Studio unlock for any unit | open_studio_status where status='unlocked' |
| **Focused Worker** | Complete 3+ Open Studio sessions with productivity_score='high' | session records |
| **Self-Directed** | Complete 5+ sessions without any drift flags | drift_flags empty |
| **Project Owner** | Complete the Discovery phase (project statement written) | open_studio_profiles with completed_at |

### Badge Wall Visual

```
┌─────────────────────────────────────────────────────────────┐
│  MY BADGES                                          12 / 28 │
│                                                              │
│  Design Cycle          Safety              Toolkit           │
│  🟡🟡⬜⬜ ⬜          🟢🟢🟡⬜⬜⬜       🟣🟣🟣🟣⬜     │
│                                                              │
│  Growth                Studio                                │
│  🔵🔵⬜⬜⬜⬜        🟢⬜⬜⬜                              │
│                                                              │
│  ────────────────────────────────────────────               │
│  Next badge: "Maker" — complete 1 more Criterion C page     │
└─────────────────────────────────────────────────────────────┘
```

**Key UX decisions:**
- Earned badges: full colour + subtle glow
- Unearned badges: grey outline only (no lock icon — locks feel punitive)
- "Next badge" line: shows the *closest* unearned badge with exactly what's needed. This is the Duolingo trick — always show the next achievable goal.
- Badge tap/click: opens detail card with name, description, date earned, and evidence link (which page/tool/conversation earned it)

### Stats Strip

Below the badge wall, a compact stats strip:

```
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│  12    │  │  4.2hr │  │  7     │  │  3     │  │  🔥 5  │
│ ideas  │  │ total  │  │ tools  │  │ units  │  │ day    │
│ created│  │ time   │  │ used   │  │ active │  │ streak │
└────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

All computable from existing data:
- Ideas created: sum of ideas across all tool sessions
- Total time: sum of `time_spent` across all progress records
- Tools used: distinct `tool_id` from tool sessions
- Units active: count of units with any progress
- Day streak: consecutive school days with any activity (computed from `updated_at` timestamps)

---

## Layer 3: Active Work

The bottom section is the "what do I do RIGHT NOW" zone.

### 3a. Continue Where You Left Off

Already exists — keep it. But enhance:
- Show the specific PAGE title, not just the unit
- Show time since last activity ("Last worked on 2 days ago")
- Show the design cycle zone (Criterion A/B/C/D) so the student knows what kind of thinking they're returning to

### 3b. Due This Week

```
┌──────────────────────────────────────────────────────────┐
│  DUE THIS WEEK                                            │
│                                                            │
│  Today        Unit 3: Sustainable Design — Page 5          │
│               Criterion C: First Prototype Submission      │
│                                                            │
│  Wed 26 Mar   Unit 2: Packaging — Final Evaluation        │
│               Criterion D: Written Evaluation              │
│                                                            │
│  No more this week ✓                                      │
└──────────────────────────────────────────────────────────┘
```

**Data source:** `pageDueDates` from the unit config (already exists in the API response, just not displayed). Falls back to `finalDueDate` if no per-page dates set.

### 3c. Recent Activity Feed

Replace the current collapsed "Recent Portfolio Activity" with a unified activity feed mixing:
- Portfolio entries (photo, note, link, auto-captured work)
- Tool session completions
- Badge earned events
- Reflection submissions
- Open Studio session starts/ends

Each entry: icon + action text + timestamp + link to the work.

```
  🟣 Completed SCAMPER — "Redesign school cafeteria"      2 hours ago
  📸 Added photo to portfolio — Unit 3                     Yesterday
  🏅 Earned "Empathy Expert" badge                         Yesterday
  💬 Design Assistant conversation — Bloom's level 3       2 days ago
  📝 Submitted reflection — "I noticed that my prototype   3 days ago
      didn't account for left-handed users..."
```

Max 10 entries, "View All" link to full portfolio/history page.

---

## Teacher View: Same Data, Class Lens

The teacher sees the student dashboard when viewing any individual student (from Teaching Mode student card click, or progress page). It's the SAME three layers with two additions:

### Teacher-Only Overlays

1. **Integrity indicators** — small icon on the Journey Map zones where integrity flags exist (from `analyzeIntegrity` data). Click to see IntegrityReport.
2. **Observation notes** — teacher can add a note to any badge or journey zone. Stored in a new `teacher_observations` JSONB column or simple notes table.
3. **NM assessment comparison** — where student self-assessed vs teacher observation, show both ratings side by side (pop art pills from existing NMResultsPanel).

### Class-Wide Badge Matrix

On the teacher's class view, a grid: students (rows) × badge categories (columns). Each cell is a coloured dot (earned) or grey (not yet). Teachers instantly see: "Most of my class has Inquirer but nobody has Evaluator — I need to push Criterion D work."

```
              Design Cycle    Safety          Toolkit        Growth
              A  B  C  D     WS LC SD 3D     SC SH FW EM    DT CW BC
  Student 1   🟡 🟡 ⬜ ⬜    🟢 🟢 ⬜ ⬜     🟣 🟣 ⬜ ⬜    🔵 ⬜ ⬜
  Student 2   🟡 ⬜ ⬜ ⬜    🟢 ⬜ ⬜ ⬜     🟣 ⬜ ⬜ ⬜    ⬜ ⬜ ⬜
  Student 3   🟡 🟡 🟡 🟡    🟢 🟢 🟢 🟢     🟣 🟣 🟣 🟣    🔵 🔵 🔵
  ...
```

This matrix is the teacher's killer feature — instant class diagnostic.

---

## Data Architecture

### Badge Computation

Badges are **computed, not stored**. On each dashboard load, a `computeBadges()` function runs against the student's existing data:

```typescript
// src/lib/badges/compute-badges.ts

interface Badge {
  id: string;               // "design-cycle-inquirer"
  category: 'design-cycle' | 'safety' | 'toolkit' | 'growth' | 'studio';
  name: string;             // "Inquirer"
  description: string;      // "Complete 3+ Criterion A pages"
  icon: string;             // emoji or SVG reference
  color: string;            // hex colour
  tier: 'bronze' | 'silver' | 'gold' | null;
  earned: boolean;
  earnedAt: string | null;  // ISO timestamp of when criteria was first met
  progress: number;         // 0-100 (how close to earning)
  nextStep: string | null;  // "Complete 1 more Criterion A page"
  evidence: string[];       // links/IDs to the work that earned it
}

function computeBadges(
  progress: StudentProgress[],
  toolSessions: StudentToolSession[],
  conversations: DesignConversation[],
  nmAssessments: CompetencyAssessment[],
  studioSessions: OpenStudioSession[],
  safetyCerts: SafetyCertification[],
): Badge[]
```

**Why computed not stored:**
- Badges are a VIEW over existing data, not new data
- No sync issues (badge always reflects current reality)
- Easy to add new badges (just add computation logic)
- No migration needed

**Performance:** All source data is already fetched for the dashboard. The computation is pure JS (~50ms for a full student). Cache in React state.

**Exception: Safety certifications** — these ARE stored because they're teacher-granted, not auto-computed. New table: `safety_certifications (id, student_id, class_id, cert_type, granted_by, granted_at, expires_at, notes)`. Simple migration.

### New API Endpoint

`GET /api/student/dashboard-v2`

Returns everything the dashboard needs in one call:

```typescript
{
  student: { name, avatarUrl, classId, className },
  units: Array<{
    unitId, title, description,
    pages: Array<{ pageId, title, criterion, status, timeSpent }>,
    toolsCompleted: string[],
    currentPageId: string | null,
    dueDate: string | null,
    pageDueDates: Record<string, string>,
    openStudioStatus: 'locked' | 'unlocked' | 'revoked',
  }>,
  toolSessions: Array<{ toolId, challenge, status, version, completedAt }>,
  safetyCerts: Array<{ certType, grantedAt }>,
  recentActivity: Array<{ type, content, timestamp, link }>,
  stats: {
    totalIdeas: number,
    totalTimeMs: number,
    toolsUsed: number,
    unitsActive: number,
    dayStreak: number,
  },
  conversationStats: {
    totalConversations: number,
    avgBloomLevel: number,
    highestBloomLevel: number,
  },
  nmAssessments: Array<{ competency, element, rating, source, pageId, createdAt }>,
}
```

Badges computed client-side from this data. One API call, everything needed.

---

## Safety Certifications — Detail

### Teacher Workflow

1. Teacher is in Teaching Mode or on student's progress page
2. Clicks "Safety Certs" button on student card
3. Modal shows all cert types with toggle switches
4. Teacher toggles on "Laser Cutter Certified"
5. Optional: add note ("Passed assessment 21 Mar, knows emergency stop location")
6. Save → cert appears on student dashboard immediately

### Student Workflow

1. Student sees greyed-out cert shields on badge wall
2. Knows exactly which certs they need to earn
3. Asks teacher for assessment when ready
4. Teacher grants → shield turns coloured with a celebration animation
5. Student can tap cert to see: what it covers, when earned, who granted, any notes

### Database

```sql
CREATE TABLE safety_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id),
  class_id TEXT NOT NULL,
  cert_type TEXT NOT NULL,  -- 'general_workshop', 'laser_cutter', 'soldering', '3d_printer', 'hand_tools', 'power_tools'
  granted_by UUID NOT NULL, -- teacher user ID
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,   -- optional expiry (e.g., annual renewal)
  notes TEXT,
  revoked_at TIMESTAMPTZ,   -- soft delete
  UNIQUE(student_id, cert_type)
);

-- Teachers can configure which certs are relevant for their class
-- (not every class uses a laser cutter)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  safety_cert_types TEXT[] DEFAULT '{"general_workshop"}';
```

### Cert Types Are Configurable

Teachers can add custom cert types from their class settings (e.g., "CNC Router", "Vinyl Cutter", "Sewing Machine"). Default set covers the most common DT workshop tools.

---

## Implementation Plan

### Phase 1: Journey Map + Stats Strip (~1 day)

| Task | Effort | Files |
|------|--------|-------|
| `JourneyMap.tsx` component with SVG zones | 3 hours | New component |
| SVG terrain silhouettes (4 zone illustrations) | 1 hour | Inline SVG in component |
| Stats strip (5 metrics) | 30 min | Part of dashboard page |
| Wire into dashboard page, replace current hero | 1 hour | Modify dashboard/page.tsx |
| Mobile responsive (horizontal scroll) | 30 min | CSS |

### Phase 2: Badge System (~1.5 days)

| Task | Effort | Files |
|------|--------|-------|
| `compute-badges.ts` — badge computation engine | 2 hours | New: `src/lib/badges/compute-badges.ts` |
| Badge definitions (all categories) | 1 hour | New: `src/lib/badges/badge-definitions.ts` |
| `BadgeWall.tsx` component | 2 hours | New component |
| `BadgeDetail.tsx` modal (tap to see evidence) | 1 hour | New component |
| Safety certifications migration + API (POST/GET) | 1.5 hours | Migration + 2 API routes |
| Teacher cert granting UI (modal in Teaching Mode) | 1 hour | New component |
| "Next badge" computation + display | 30 min | Part of BadgeWall |

### Phase 3: Active Work Layer (~0.5 day)

| Task | Effort | Files |
|------|--------|-------|
| Enhanced "Continue" card (page title, criterion, time since) | 30 min | Modify dashboard |
| "Due This Week" component | 1 hour | New component |
| Unified activity feed (replacing portfolio-only list) | 1.5 hours | New component |

### Phase 4: Teacher View (~1 day)

| Task | Effort | Files |
|------|--------|-------|
| Teacher per-student view (reuse student dashboard) | 1 hour | New page or modal |
| Class badge matrix component | 2 hours | New component |
| Teacher observation notes on badges | 1 hour | Small CRUD |
| Integrity overlay on Journey Map | 1 hour | Conditional render |
| Safety cert management in class settings | 1 hour | UI for configuring cert types |

### Phase 5: Polish (~0.5 day)

| Task | Effort | Files |
|------|--------|-------|
| Badge earn animation (Framer Motion) | 1 hour | BadgeWall enhancement |
| Journey Map zone hover details | 30 min | JourneyMap enhancement |
| Empty states for new students (no badges yet) | 30 min | All components |
| Print/export view (portfolio + badges for parent conferences) | 1 hour | Print stylesheet |

**Total: ~4.5 days**

---

## What This Does NOT Include

| Feature | Why excluded | When to add |
|---------|-------------|-------------|
| **Leaderboards** | Competitive ranking is wrong for MYP — assessment is criterion-referenced, not norm-referenced. Students shouldn't compare against each other. | Never (by design) |
| **XP points** | Arbitrary point systems feel fake. Badges are earned from real evidence. | Never (by design) |
| **Streaks with loss penalty** | Duolingo's streak-loss anxiety is well-documented as harmful. Our streak is positive-only (shows consistency, no punishment for missing days). | N/A |
| **Parent view** | Important but separate feature. Print/export covers parent conferences for now. | Phase 2 of a parent portal project |
| **Portfolio redesign** | The full Behance-style portfolio is a separate project. The activity feed here is a lightweight replacement for the current collapsed list. | After this ships |
| **Planning task integration** | The planning/Gantt view needs its own redesign (see `planning-tools-ux-spec.md`). Showing due dates covers the urgent need. | Separate spec |

---

## Success Criteria

1. **Student can articulate where they are in the design cycle** without opening any unit — the Journey Map makes it visual.
2. **Student knows their next achievable goal** — the "Next badge" line always shows something within reach.
3. **Teacher can assess a student's engagement in <10 seconds** — Journey Map + Badge Wall + Stats Strip give a complete picture at a glance.
4. **Teacher can see class-wide patterns** — the badge matrix shows which skills the whole class is developing vs missing.
5. **Safety certifications are visible and motivating** — students see what they need to earn to use workshop equipment, creating a natural goal structure.
6. **No new gamification anxiety** — no loss penalties, no competitive leaderboards, no arbitrary XP. Just visible evidence of real work.

---

## Key Design Decisions

- **Badges are computed, not stored** — they're a view over existing data. No sync issues, easy to add new badges, no migration for badge records.
- **Safety certs ARE stored** — because they're teacher-granted human judgments, not auto-computed.
- **No leaderboards, ever** — MYP is criterion-referenced. Students compare against the rubric, not each other.
- **Streak is positive-only** — shows consistency but never punishes missing days. No Duolingo anxiety.
- **Journey Map uses MYP design cycle, not generic progress** — Criterion A/B/C/D zones, not "25% done." This is the language students need to learn.
- **Teacher and student see the same dashboard** — one source of truth. Teacher gets overlays (integrity, observations, NM comparison) but the base view is identical.
- **One API call for everything** — `dashboard-v2` endpoint returns all data needed. Badge computation happens client-side for simplicity.
- **Cert types are teacher-configurable** — not every school has the same workshop equipment. Teachers add/remove cert types from class settings.
