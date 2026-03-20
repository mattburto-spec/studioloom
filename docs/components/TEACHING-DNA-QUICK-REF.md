# TeachingDNA — Quick Reference Card

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/teacher/TeachingDNA.tsx` | Main component | 534 |
| `src/components/teacher/TeachingDNA.stories.tsx` | Mock data + stories | 285 |
| `docs/components/TEACHING-DNA.md` | Full technical docs | 353 |
| `docs/components/teaching-dna-integration.md` | Integration examples | 233 |

## Import

```typescript
import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { loadStyleProfile } from '@/lib/teacher-style/profile-service';
```

## Basic Usage

```tsx
const profile = await loadStyleProfile(teacherId);
<TeachingDNA profile={profile} className="max-w-2xl" />
```

## Props

```typescript
interface TeachingDNAProps {
  profile: TeacherStyleProfile;  // Required
  className?: string;             // Optional (Tailwind classes)
}
```

## Radar Dimensions (6 axes)

| # | Dimension | High Score Means |
|---|-----------|-----------------|
| 1 | Practical | Hands-on lessons (high % practical time) |
| 2 | Scaffolding | Lots of step-by-step support & guidance |
| 3 | Critique | Frequent critique, peer review, gallery walks |
| 4 | Autonomy | Students figure things out independently |
| 5 | Digital | CAD, research tools, digital documentation |
| 6 | Making | Hands-on workshops, prototyping, construction |

## Archetypes (6 types)

| Emoji | Name | Trigger | Profile |
|-------|------|---------|---------|
| 🔨 | Workshop Mentor | Making > 70 AND Practical > 60 | Demo-light, workshop-heavy, critique culture |
| 🎨 | Studio Director | Critique > 70 AND Autonomy > 60 | Student-led, peer feedback, minimal scaffolding |
| 📋 | Structured Guide | Scaffolding > 70 AND Practical < 40 | Step-by-step, guided, theory-heavy |
| 💻 | Digital Pioneer | Digital > 70 | CAD/research focused, documentation-heavy |
| 🔍 | Discovery Facilitator | Autonomy > 70 AND Scaffolding < 30 | Open-ended, students design process |
| ⚖️ | Balanced Designer | (default) | Mix of all approaches, flexible |

## Confidence Levels

| Level | Data Points | Bar Color | Message |
|-------|-------------|-----------|---------|
| 🌱 Cold Start | < 5 | N/A | Placeholder screen |
| 🟡 Learning | 5–19 | Amber | "Add X more lessons..." |
| 🟢 Established | 20+ | Green | "Your DNA is fully formed" |

## Data Points Counted

- `lessonPatterns.uploadCount` (lesson plan uploads)
- `editPatterns.editCount` (content edits)
- `totalUnitsCreated` (unit building)
- `gradingStyle.gradingSessionCount` (grading activity)

## Test/Mock Data

```tsx
import {
  ColdStart,           // No data
  Learning,            // 7–12 data points
  EstablishedWorkshopMentor,
  EstablishedStudioDirector,
  EstablishedDigitalPioneer,
  AllProfiles
} from '@/components/teacher/TeachingDNA.stories';
```

## Color Palette

| Color | Hex | Use |
|-------|-----|-----|
| Purple | #7B2FF2 | Radar fill, accents, established bar |
| Amber | #FBBF24 | Learning confidence bar |
| Green | #22C55E | Established confidence bar |
| Light Gray | #D1D5DB | Grid lines, secondary text |
| Dark Gray | #374151 | Primary text |
| White | #FFFFFF | Card background |

## Size & Responsive

- **Default width:** ~600px (max-w-2xl)
- **Mobile (< 768px):** Radar and archetype stack vertically
- **Desktop (768px+):** Radar left, archetype right (grid-cols-2)

## Integration Examples

**Dashboard widget:**
```tsx
<TeachingDNA profile={profile} className="max-w-2xl" />
```

**Settings page (2-column):**
```tsx
<div className="grid grid-cols-3 gap-6">
  <div><TeachingDNA profile={profile} /></div>
  <div className="col-span-2">{/* settings form */}</div>
</div>
```

**Onboarding (selectable cards):**
```tsx
{profiles.map(p => (
  <div onClick={() => select(p.id)}>
    <TeachingDNA profile={p} />
  </div>
))}
```

## Styling

All styling uses:
- **Tailwind CSS** (no external CSS needed)
- **Inline SVG** (no image assets)
- **Inline styles** for dark theme isolation (radar)

## Performance

- ✓ Computed once per render (`useMemo`)
- ✓ No re-renders on prop change (cached computation)
- ✓ SVG rendered inline (no asset requests)
- ✓ ~534 lines (compact, optimized)

## Accessibility

- ✓ High contrast (purple on white)
- ✓ Semantic HTML (headings, structure)
- ✓ Text + icons (no color-only info)
- ✓ Mobile-responsive
- ✓ ARIA labels: can add as needed

## Exports

**Main component:**
```typescript
export function TeachingDNA({ profile, className }: TeachingDNAProps): JSX.Element
```

**Helper functions (internal):**
- `computeRadarDimensions(profile)` → `RadarDimensions`
- `getArchetype(dimensions)` → `Archetype`
- `getConfidenceMetrics(profile)` → `ConfidenceMetrics`

**Sub-components (internal):**
- `RadarChart({ dimensions })`
- `ConfidenceMeter({ confidence, level, nextMilestone })`

## Cold Start Placeholder

When `profile.lessonPatterns.uploadCount === 0`:
- Full-screen placeholder card
- Animated DNA helix icon
- Encouragement message
- No radar or stats shown

## API Behavior

| Input | Output |
|-------|--------|
| Cold start profile | Placeholder + "Keep teaching..." message |
| Learning profile (5–19 pts) | Radar + archetype + stats + learning badge |
| Established profile (20+ pts) | Radar + archetype + stats + established badge |

## Related Types

```typescript
// From @/types/teacher-style
interface TeacherStyleProfile {
  teacherId: string;
  lessonPatterns: { /* 5 fields */ };
  editPatterns: { /* 4 fields */ };
  resourcePreferences: { /* 2 fields */ };
  gradingStyle: { /* 4 fields */ };
  confidenceLevel: 'cold_start' | 'learning' | 'established';
  totalUnitsCreated: number;
  totalLessonsEdited: number;
  lastUpdated: string;
}
```

## Dependencies

**None!** Uses only:
- React 19 (`useMemo`)
- Tailwind CSS 4.1
- TypeScript 5.8
- SVG (inline)

## Docs Reference

| Document | Content |
|----------|---------|
| `TEACHING-DNA.md` | Full technical specs, function docs, design guidelines |
| `teaching-dna-integration.md` | Code examples, common patterns, testing |
| `TEACHING-DNA-QUICK-REF.md` | This file (quick lookup) |

## Quick Troubleshooting

**Profile not loading?**
- Check `await loadStyleProfile(teacherId)` is awaited
- Verify `TeacherStyleProfile` type matches interface

**Radar not showing?**
- Component renders fine; check `profile.lessonPatterns.uploadCount > 0`
- Cold start profiles show placeholder instead

**Wrong archetype?**
- Check radar dimensions in browser console
- Archetype logic uses exact dimension thresholds
- Can adjust thresholds in `getArchetype()` function

**Colors not matching?**
- Verify Tailwind CSS is loaded (4.1+)
- Check for CSS conflicts (inline SVG has inline styles)
- Purple hex #7B2FF2 is brand color across all projects

---

**Last updated:** 19 March 2026
**Status:** Production-ready
**Maintainer:** Matt Burton (Questerra)
