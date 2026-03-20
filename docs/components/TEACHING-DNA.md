# TeachingDNA Component

**Location:** `src/components/teacher/TeachingDNA.tsx`

**Status:** Production-ready (534 lines, fully typed)

A beautiful "Spotify Wrapped for teaching style" visualization component that displays a teacher's accumulated teaching style profile as a single card. The component is self-contained and can be imported anywhere in the Questerra platform.

## Overview

The TeachingDNA component visualizes teacher style data collected passively from:
- **Lesson uploads** — phase sequences, timing patterns, activity types
- **Content edits** — what teachers delete (scaffolding) vs. add (extensions)
- **Unit creation** — frequency of unit building
- **Grading patterns** — strictness, feedback length, criterion emphasis

The visualization includes:
1. **Hexagonal radar chart** (6 dimensions) — pure SVG, no external charting library
2. **Teaching archetype** — named profile (Workshop Mentor, Studio Director, etc.)
3. **Key statistics** — lessons uploaded, units created, theory:practical ratio
4. **Teaching patterns** — most common activities, timing adjustments, edits
5. **Confidence meter** — how much data the system has (Cold Start → Learning → Established)

## API

```typescript
interface TeachingDNAProps {
  profile: TeacherStyleProfile;
  className?: string;
}
```

### Props

**`profile`** (required)
- Type: `TeacherStyleProfile` (from `@/types/teacher-style`)
- The teacher's accumulated style data
- If all counts are zero, renders cold-start placeholder

**`className`** (optional)
- Type: `string`
- Additional Tailwind classes to apply to the card root
- Default: empty string
- Example: `className="max-w-2xl"` for responsive sizing

## Usage

```tsx
import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { loadStyleProfile } from '@/lib/teacher-style/profile-service';

export async function TeacherProfilePage({ teacherId }: { teacherId: string }) {
  const profile = await loadStyleProfile(teacherId);

  return (
    <div className="p-6">
      <TeachingDNA profile={profile} className="max-w-2xl" />
    </div>
  );
}
```

## Radar Dimensions

The hexagonal radar chart measures 6 dimensions:

1. **Practical** (bottom-right)
   - Inverted theory:practical ratio
   - High = hands-on lessons (70%+ practical work)
   - Computed from `lessonPatterns.averageTheoryPracticalRatio`

2. **Scaffolding** (top-right)
   - How much structured support teacher provides
   - High = lots of sentence starters, step-by-step guides
   - Inferred from deleted scaffolding sections
   - If teacher deletes many "scaffold" or "starter" sections, scaffolding score drops

3. **Critique** (top)
   - Frequency of critique, peer review, gallery walks
   - High = critique-heavy teaching culture
   - Computed from activity type frequencies

4. **Autonomy** (top-left)
   - Student independence and agency
   - High = teacher removes guidance, lets students figure it out
   - Inferred from deleted scaffolding + editing patterns
   - Inverse of scaffolding (roughly)

5. **Digital** (bottom-left)
   - CAD, research, digital tools, technology
   - High = relies on digital tools and documentation
   - Computed from activity type frequencies ("CAD", "digital", "research")

6. **Making** (bottom)
   - Hands-on construction, prototyping, hands-on workshops
   - High = making culture, long workshop sessions
   - Computed from activity type frequencies ("making", "workshop", "prototype")

Each axis is 0-100 scale. The radar shape reveals the teacher's profile:
- **Circle** = balanced across all dimensions
- **Spike on Making** = workshop mentor
- **Spike on Critique + Autonomy** = studio director
- **Spike on Digital** = digital pioneer
- **Spike on Scaffolding** = structured guide

## Teaching Archetypes

The component automatically assigns one of 6 archetypes based on radar dimensions:

### 🔨 Workshop Mentor
- **When:** Making > 70 AND Practical > 60
- **Description:** "You lead with making. Short demos, long workshops, heavy critique culture."
- **Typical behavior:** Minimal theory, most time spent in hands-on workshops, strong gallery walk/critique culture

### 🎨 Studio Director
- **When:** Critique > 70 AND Autonomy > 60
- **Description:** "You run a critique-heavy studio. Students drive their own learning with constant feedback."
- **Typical behavior:** Student-led projects, frequent critique sessions, minimal scaffolding, high peer feedback

### 📋 Structured Guide
- **When:** Scaffolding > 70 AND Practical < 40
- **Description:** "You build careful scaffolding. Step-by-step instruction with rich support."
- **Typical behavior:** Lots of sentence starters, guided worksheets, step-by-step lessons, theory-heavy

### 💻 Digital Pioneer
- **When:** Digital > 70
- **Description:** "You favour digital tools and CAD. Research and documentation feature heavily."
- **Typical behavior:** CAD in most lessons, digital prototyping, extensive research work, spreadsheet analysis

### 🔍 Discovery Facilitator
- **When:** Autonomy > 70 AND Scaffolding < 30
- **Description:** "You step back and let students figure it out. Minimal scaffolding, maximum agency."
- **Typical behavior:** Open-ended challenges, no worksheets, students design their own process, high autonomy

### ⚖️ Balanced Designer
- **When:** None of the above (default)
- **Description:** "You blend theory and hands-on work with a balanced, flexible teaching approach."
- **Typical behavior:** Mix of all approaches, adaptable to different student needs

## Confidence Levels

The component tracks how much data the system has collected:

### 🌱 Cold Start
- **Data points:** < 5
- **Rendered:** Placeholder screen ("Keep teaching — your DNA will emerge")
- **When:** `uploadCount + editCount + totalUnitsCreated + gradingSessionCount < 5`
- **Message:** Encourages teachers to upload more lessons

### 🟡 Learning
- **Data points:** 5–19
- **Confidence bar:** 20–60% (amber)
- **Milestone:** "Upload 7 more lessons to reach Established"
- **When:** 5 ≤ total ≤ 19

### 🟢 Established
- **Data points:** 20+
- **Confidence bar:** 100% (green)
- **Milestone:** "Your teaching DNA is fully formed. Keep going!"
- **When:** total ≥ 20

## Visual Design

### Card Layout
```
┌─ Header ─────────────────────┐
│ Your Teaching DNA    🟡 Learning
├─ Content ────────────────────┤
│ [Radar] [Archetype description] │
│ ─────────────────────────── │
│ Stats (4 cells)          │
│ ─────────────────────────── │
│ Patterns (activities, timing) │
│ ─────────────────────────── │
│ Confidence Meter            │
└───────────────────────────────┘
```

### Color Scheme
- **Brand purple:** `#7B2FF2` — radar fill, accents, confidence (established)
- **Amber:** `#FBBF24` — confidence bar (learning)
- **Green:** `#22C55E` — confidence bar (established)
- **Red:** `#EF4444` — confidence bar (cold start)
- **White:** Card background, clean minimalist design
- **Light gray:** `#D1D5DB` grid lines, secondary text
- **Dark gray:** `#374151` — primary text

### Responsive
- **Width:** ~600px (max-w-2xl)
- **Mobile:** Radar and archetype stack vertically on small screens (grid-cols-1)
- **Desktop:** Radar left, archetype right (grid-cols-2)
- **Always:** Single-column stats grid, full-width patterns, full-width confidence meter

## Internal Functions

### `computeRadarDimensions(profile): RadarDimensions`
Extracts 6 numeric dimensions (0-100 scale) from the profile data.

**Implementation logic:**
- **Practical:** `(1 - averageTheoryPracticalRatio) * 100`
- **Scaffolding:** `100 - (deletedScaffolding.length * 15)` (clamped 0-100)
- **Critique:** Frequency of critique/gallery walk/peer review activities
- **Autonomy:** `deletedScaffolding.length * 20 + (length > 0 ? 20 : 0)`
- **Digital:** Frequency of CAD/research/digital/technology activities
- **Making:** Frequency of making/workshop/hands-on activities

### `getArchetype(dimensions): Archetype`
Maps radar dimensions to one of 6 named archetypes with emoji and description.

**Decision tree:**
1. If Making > 70 && Practical > 60 → Workshop Mentor
2. Else if Critique > 70 && Autonomy > 60 → Studio Director
3. Else if Scaffolding > 70 && Practical < 40 → Structured Guide
4. Else if Digital > 70 → Digital Pioneer
5. Else if Autonomy > 70 && Scaffolding < 30 → Discovery Facilitator
6. Else → Balanced Designer (default)

### `getConfidenceMetrics(profile): ConfidenceMetrics`
Computes the confidence percentage (0-100) and next milestone message.

**Data points counted:**
- `lessonPatterns.uploadCount`
- `editPatterns.editCount`
- `totalUnitsCreated`
- `gradingStyle.gradingSessionCount`

**Mapping:**
- 0-4 points: 0-60% (Cold Start)
- 5-19 points: 20-60% (Learning)
- 20+ points: 100% (Established)

### `RadarChart({ dimensions }): JSX`
Renders a hexagonal radar chart as pure SVG.

**Implementation:**
- Center: `(size/2, size/2)`
- Outer radius: `size/2 * 0.75` = 105px (on 280px SVG)
- 6 axes at 60° intervals
- Grid hexagons at 25%, 50%, 75% values
- Filled polygon connecting the 6 data points (purple with opacity)
- Dots at each axis intersection
- Radial lines from center to vertices (subtle)
- Axis labels positioned outside hexagon at label radius + 35px

**Conversion:** Polar → Cartesian using `r * cos(angle)` and `r * sin(angle)`

### `ConfidenceMeter({ confidence, level, nextMilestone }): JSX`
Horizontal progress bar with label and milestone message.

**Visual:**
- Bar color depends on level (red/amber/green)
- Background tinted matching bar color with reduced opacity
- Percentage displayed numerically
- Milestone message in small text below bar
- Smooth CSS transitions on bar width

## Examples

See `src/components/teacher/TeachingDNA.stories.tsx` for 5 complete mock profiles:

1. **Cold Start** — Empty profile, placeholder
2. **Learning** — 8 uploads, 7 edits, emerging patterns
3. **Workshop Mentor** — 23 uploads, making-focused, 75% practical
4. **Studio Director** — 21 uploads, critique-heavy, 55% theory
5. **Digital Pioneer** — 20 uploads, CAD-heavy, 50% theory

## Integration Points

### Teacher Dashboard
```tsx
import { TeachingDNA } from '@/components/teacher/TeachingDNA';

export function TeacherDashboard({ teacherId }: { teacherId: string }) {
  const profile = await loadStyleProfile(teacherId);
  return (
    <div className="space-y-6">
      <TeachingDNA profile={profile} className="max-w-2xl" />
      {/* Other dashboard sections... */}
    </div>
  );
}
```

### Teacher Profile Settings
```tsx
export function TeacherProfileSettings({ teacherId }: { teacherId: string }) {
  const profile = await loadStyleProfile(teacherId);
  return (
    <div className="grid grid-cols-2 gap-6">
      <TeachingDNA profile={profile} />
      <div>
        {/* Edit profile settings, upload settings, etc. */}
      </div>
    </div>
  );
}
```

### Teacher Onboarding
```tsx
export function TeacherOnboarding() {
  // Show multiple archetypes to help teachers understand the system
  return (
    <div className="space-y-4">
      <p>Here are different teaching styles. Which resonates with you?</p>
      <TeachingDNA profile={mockWorkshopMentor} />
      <TeachingDNA profile={mockStudioDirector} />
      <TeachingDNA profile={mockDigitalPioneer} />
    </div>
  );
}
```

## Accessibility

- ✓ High contrast purple (#7B2FF2) on white
- ✓ Semantic HTML (no div soup, proper headings)
- ✓ Descriptive text for all visualizations
- ✓ No color-only information (uses icons + text)
- ✓ SVG has inline titles (aria-labels could be added)
- ✓ Mobile-friendly responsive layout

**Future improvements:**
- Add `<title>` elements to SVG groups for screen readers
- Add ARIA labels to radar axes
- High contrast mode support for confidence meter

## Performance

- **Size:** ~534 lines (400-500 lines typical)
- **Dependencies:** None (uses only React + Tailwind)
- **Rendering:** All computed in `useMemo` hook (no re-computation on every render)
- **SVG:** Inline (no external assets)
- **Styling:** Tailwind only (no CSS-in-JS, no external stylesheets)

## Related Documentation

- `docs/ai-intelligence-architecture.md` — full profile architecture
- `types/teacher-style.ts` — `TeacherStyleProfile` interface
- `lib/teacher-style/profile-service.ts` — how profiles are built and updated
- `docs/design-guidelines.md` — design principles for teacher-facing UI

## Changelog

**18 March 2026 — Initial creation**
- 6-dimension radar chart with pure SVG
- 6 teaching archetypes with emoji
- Confidence meter (Cold Start → Learning → Established)
- Cold-start placeholder
- Stats display (uploads, units, timing, ratio)
- Teaching patterns extraction (activities, timing, edits)
- Fully typed with TeacherStyleProfile
- Production-ready component (~534 lines)
