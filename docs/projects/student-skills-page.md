# Student Skills Page — Phase 17

**Status:** ⚠️ SUPERSEDED (23 Apr 2026) — Skills Library ([`skills-library.md`](skills-library.md)) covers this
territory with a much richer model (skill cards, completion states, freshness,
radar chart). A **thin placeholder** `/skills` page shipped 23 Apr to make the
nav pill work; the full Skills page is a deliverable of the Skills Library
workshop. Keep this doc for reference only — implementation specs are in
`docs/specs/skills-library-spec.md` and the completion-addendum.

**Placeholder shipped:** `src/app/(student)/skills/page.tsx` — shows earned +
pending safety badges, links to each safety test. Thin view that becomes the
mount point for the real Skills page once the library lands.

**Context:** Matt's product question on 23 Apr 2026: how to organise student-facing non-lesson content. The current Badges nav pill is broken (scrolls to an anchor that no longer exists post-MiddleRow refactor). Renaming to "Skills" and pointing at a dedicated route is the path forward.

**Paired spec:** `docs/projects/student-resources-page.md` (to be written for Phase 18 — Resources library). Skills and Resources are sibling pages with intentional overlap via the rule: *resources can be preparation for a skill; the skill assessment always lives under Skills.*

---

## Goal

A `/skills` route that is the student's single view of "what can I do / what have I learned?". Replaces the disabled Badges pill with an active Skills pill.

- **Earned badges** at the top (celebratory, same treatment as dashboard's earned card)
- Categorised sections: **Safety**, **Technical skills**, **Discovery**
- Clear call-to-action for "next up" items (retake, take-for-first-time, expired)

---

## What exists already (schema audit — `supabase/migrations/035_safety_badges.sql`)

No schema changes needed for v1. The `badges` table is already general:

```sql
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('safety', 'skill', 'software')),
  tier INTEGER CHECK (tier >= 1 AND tier <= 4),
  icon_name TEXT,
  color TEXT,
  is_built_in BOOLEAN,
  created_by_teacher_id UUID,
  pass_threshold INTEGER,
  expiry_months INTEGER,
  ...
);
```

The category + ownership (`is_built_in` / `created_by_teacher_id`) cover Matt's "hybrid" model (platform baseline + teacher extensions) out of the box. `student_badges` records earned/expired/revoked state per student.

**What's missing for v1 ship:** nothing. Safety-category badges flow through as-is. Technical/software categories already exist in the schema enum — just need rows seeded.

**What to defer:** badge authoring UI for teachers. Platform-seeded rows get us to a usable Skills page; teacher-created skill badges can come later.

---

## Page layout (v1)

```
[BoldTopNav] — unchanged; "Skills" pill is active

┌──────────────────────────────────────────────────────┐
│  GOOD MORNING, SAM                                   │
│                                                      │
│  Your skills.                                        │  ← display-lg
│                                                      │
└──────────────────────────────────────────────────────┘

┌─── Earned ──────────────────────────────────────────┐
│  🏆 You've earned                                    │
│  3 skills.                                           │
│                                                      │
│  [Badge][Badge][Badge]  + "See history →"           │
│  (big radial badge circles — matches dashboard)      │
└──────────────────────────────────────────────────────┘

┌─── Safety ──────────────────────────────────────────┐
│  Safety · 2 of 5 earned                              │
│                                                      │
│  [✓ General Workshop]  [✓ Hand Tool]                 │
│  [⏳ Electronics & Soldering — not started]          │
│  [⏳ 3D Printer Safety — not started]                │
│  [🕒 PPE Fundamentals — in cooldown]                 │
└──────────────────────────────────────────────────────┘

┌─── Technical skills ────────────────────────────────┐
│  Technical skills · 1 of 8 earned                    │
│                                                      │
│  [✓ Soldering technique]                             │
│  [⏳ CAD basics — not started]                       │
│  ... etc                                             │
└──────────────────────────────────────────────────────┘

┌─── Discovery ───────────────────────────────────────┐
│  Discovery · 0 of 3 earned                           │
│  Not required — earn these for curiosity or extension│
│                                                      │
│  [⏳ Sketchbook streak — 3 of 7 days]                │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

---

## Scope (in for v1)

1. **New route**: `src/app/(student)/skills/page.tsx`
   - Client component (needs student context for earned state)
   - Consumes the layout's BoldTopNav + SidebarSlotContext-free (no drawer)
2. **API**:
   - Reuse `/api/student/safety/pending` (already returns earned + pending)
   - Extend to return **all badges** the student is eligible for, grouped by category — current endpoint filters to safety-required for assigned units. **May need a new endpoint** `/api/student/skills` that returns every badge categorised. Small server-side change.
3. **Nav pill rename**: `Badges` → `Skills`, `anchor: null` → `route: "/skills"` in `NAV_S`. Update render to handle route vs anchor.
4. **Dashboard linkage**: MiddleRow's Earned card gains a `Link → /skills` affordance at the bottom ("See all skills →"). Replaces the broken scroll.
5. **Earned badge detail**: clicking an earned badge opens a card/modal showing date earned, score, which unit/class it was for. Reuses existing `student_badges` row data.
6. **Pending badge action**: clicking a pending badge → deep link to the safety test flow (existing routes).

---

## Scope (out — deferred)

- Teacher badge authoring UI
- Student-authored skill claims (needs moderation)
- Skill sequences / prerequisites beyond the `tier` column already in schema
- Certificate / print view
- Resource linking (deferred to Phase 18 Resources spec)
- Analytics dashboard for teachers ("which students passed which skills")

---

## Open questions

1. **Empty Technical / Discovery categories.** If nothing is seeded, sections render as pure empty states. Show them empty with CTA to request, or hide them entirely for v1? **Proposal:** hide if zero badges in the category; show once at least one exists.

2. **Skills as unit-scoped vs class-scoped vs student-scoped.** Current safety badges are class-scoped (required for units assigned to student's class). Technical skill badges might be:
   - **Platform baseline** (every student sees them) — e.g. "Soldering technique"
   - **Teacher additions** (scoped to their classes)
   **Proposal:** platform-seeded = visible to all students; teacher-created = visible only if student is in that teacher's class. `is_built_in` + class enrollment join handles this.

3. **"Discovery" category naming.** The schema only has `safety | skill | software`. "Discovery" is UX framing, not a DB category. Options:
   - Map `software` → "Digital tools" and keep 3 sections
   - Reuse `tier` (1 = required, 4 = optional) to split "required skills" vs "discovery"
   - Add a fourth category via migration
   **Proposal:** for v1, use category + `is_required` (new column, defaults based on category: safety=true, skill=true, software=false). Migration 104 if we go this route.

4. **Nav pill label: "Skills" vs "Badges" vs "Skills & Badges".** Matt leaned toward "Skills". **Proposal:** ship as "Skills". Badge imagery is the visual metaphor, skill is the noun.

5. **Where does the pill route on non-dashboard pages?** Already solved by Phase 10's pattern: pills with `route` navigate via `<Link>`. Straightforward extension to the NAV_S shape.

---

## Nav pill shape change (small refactor)

Current:
```ts
const NAV_S: { label: string; anchor: string | null }[] = [
  { label: "Skills", anchor: "dashboard-badges" }, // broken anchor
];
```

New:
```ts
type NavItem =
  | { label: string; anchor: string; route?: undefined }  // dashboard section
  | { label: string; route: string; anchor?: undefined }; // dedicated route

const NAV_S: NavItem[] = [
  { label: "My work",   anchor: "dashboard-hero" },
  { label: "Units",     anchor: "dashboard-units" },
  { label: "Skills",    route:  "/skills" },
  { label: "Journal",   anchor: null },     // disabled — Phase 14
  { label: "Resources", route:  "/resources" }, // Phase 18
];
```

Rendering in BoldTopNav:
- `route` defined → `<Link>` with route and `route === pathname` highlight
- `anchor` defined → smooth-scroll on dashboard, full-page nav elsewhere (existing behaviour)
- `anchor === null` → disabled + "Coming soon"

---

## Build plan

**17.1 Pill nav refactor** (~30 min)
- Update NAV_S shape to discriminated union
- Update render loop to handle `route` vs `anchor`
- Handle active highlighting based on `pathname`

**17.2 /skills route + page** (~2-3 h)
- New `(student)/skills/page.tsx` client component
- Fetch earned + pending via existing safety API for now
- Group by category in component
- Reuse `BadgeCircle` and badge card components from dashboard

**17.3 New endpoint `/api/student/skills`** (~1 h)
- Returns ALL badges student is eligible for (by class enrollment)
- Grouped or flat; client can group. Shape:
  `{ earned: [], available: [{ category, tier, ...}], expired: [] }`

**17.4 Empty states + per-category copy** (~30 min)
- Category empty states
- Discovery category framing
- Count display ("2 of 5 earned")

**17.5 Dashboard linkage** (~15 min)
- "See all skills →" link from earned card → /skills
- Remove broken "Badges" scroll target

**17.6 Style polish + responsive** (~30 min)
- Match dashboard palette
- Mobile stack breakpoints

**17.7 Fix the broken Badges pill scroll NOW** (~5 min, interim)
- Add `id="dashboard-badges"` anchor on the earned-badges card inside MiddleRow so the pill works in the meantime. Remove when 17.1 ships.

**Total estimate: ~5 hours for v1 Skills page + nav refactor.**

---

## Dependencies on other phases

- **Phase 14 Notes** is independent — can ship in either order
- **Phase 18 Resources** depends on this pill nav refactor (17.1) — easier to do after Skills
- **Phase 16 A11y** will need a pass over /skills when it ships

---

## Decisions Matt needs to make before 17.1 starts

1. **Open question 1** (hide vs show empty categories) — my call: hide
2. **Open question 2** (skill scoping — platform vs teacher) — my call: hybrid, platform + class-scoped
3. **Open question 3** (Discovery category mapping) — my call: use `is_required` boolean, migration 104
4. **Open question 4** (pill label) — my call: "Skills"
5. **"See history →" on earned card** — full chronological earned list worth building in v1, or defer?
6. **Teacher badge authoring** — defer to Phase 17.5 or later?

---

## Files to touch

- `src/app/(student)/skills/page.tsx` — NEW
- `src/app/api/student/skills/route.ts` — NEW
- `src/components/student/BoldTopNav.tsx` — NAV_S refactor
- `src/app/(student)/dashboard/DashboardClient.tsx` — add "See all skills" link, update NAV_S if pill defs moved here (they're in BoldTopNav)
- `supabase/migrations/104_skills_is_required.sql` — NEW (if we go with open-q-3's proposal)
- `docs/projects/student-dashboard-v2.md` — tracker update (Phase 17 added)
