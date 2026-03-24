# Badge Path Visualization Component

**File:** `src/components/safety/BadgePathVisualization.tsx`

## Overview

BadgePathVisualization is an interactive skill tree component that displays workshop safety badges organized in 4 tiers, with prerequisite dependencies and visual status indicators. Teachers and students can see the complete progression path and which badges are locked, available, or earned.

## Features

### Visual Design
- **4-Tier Hierarchical Structure**
  - Tier 1 (Foundation): General Workshop Safety, Fire Safety & Emergency, PPE Fundamentals, Hand Tool Safety
  - Tier 2 (Workshop Areas): 6 specialty areas (Wood, Metal, Plastics, Electronics, Digital Fabrication, Textiles)
  - Tier 3 (Machine Specific): 8 machines (Band Saw, Scroll Saw, Pedestal Drill, Disc Sander, Wood Lathe, Laser Cutter, 3D Printer, Sewing Machine)
  - Tier 4 (Master Craftsperson): 3 advanced processes (Resin Casting, Vacuum Forming, Screen Printing)

- **Total: 23 badges** with clear progression paths

### Badge States
1. **Earned** (Green)
   - Green border and background glow
   - Checkmark circle in top-right corner
   - "✓ Earned" label
   - Fully opaque icon

2. **Available** (Blue - Pulsing)
   - Blue border with color-coded accent
   - Soft blue background glow
   - "● Ready" label
   - Subtle pulse animation (2-second cycle)
   - Clickable if `onBadgeClick` provided

3. **Locked** (Gray)
   - Gray border and faded background
   - "🔒 Locked" label
   - Dimmed icon (40% opacity)
   - Not clickable
   - Prerequisite requirement shown in tier subtitle

### Prerequisites
- **Tier 2 (Specialties):** All require "General Workshop Safety" (Tier 1)
- **Tier 3 (Machines):** Each requires its parent Tier 2 specialty badge
  - Band Saw, Scroll Saw, Disc Sander, Wood Lathe → require Wood Workshop
  - Pedestal Drill → requires Metal Workshop
  - Laser Cutter, 3D Printer → require Digital Fabrication
  - Sewing Machine → requires Textiles
- **Tier 4 (Advanced):** Each requires its parent Tier 2 specialty badge
  - Resin Casting, Vacuum Forming → require Plastics & Composites
  - Screen Printing → requires Textiles

### UI Elements
- **Progress Bar**: Shows completion percentage (earned / total badges)
- **Progress Counter**: "X of 23 badges earned"
- **Tier Headers**: Color-coded by tier with emojis and tier name
- **Prerequisite Notes**: Subtle italic text under each tier showing requirements
- **Legend**: Visual key explaining earned/available/locked states

### Responsive Design
- **Desktop**: Multi-column grid (auto-fit with minmax 140px columns)
- **Mobile**: Stacks vertically, single or double-column depending on screen width
- Consistent spacing and padding across screen sizes

### Animations
- **Available Badges**: Gentle pulse effect (0.5 opacity at 50% cycle)
- **Status Transitions**: 0.3s ease transitions for smooth state changes
- **Earned Checkmark**: Positioned absolutely with green glow shadow

### Theme Support
- **Dark Theme** (default): Black background, light text, blue/green accents
- **Light Theme**: Light background, dark text, muted colors
- Inline styles for dark theme by default (doesn't leak into light-themed pages)

## Props

```typescript
interface BadgePathProps {
  earnedBadgeIds: string[];        // Array of badge IDs the user has earned
  onBadgeClick?: (badgeId: string) => void;  // Optional click handler
  theme?: 'dark' | 'light';        // Theme variant (default: 'dark')
}
```

### earnedBadgeIds
- Array of badge ID strings (e.g., `['general-workshop-safety', 'wood-workshop']`)
- Used to compute badge status (locked/available/earned)
- Dependencies are automatically resolved

### onBadgeClick
- Optional callback fired when user clicks a badge
- Receives the badge ID
- Can be used to navigate to badge detail page, open a modal, or toggle earned status (for testing)
- Only triggered if badge is available or earned (locked badges not clickable)

### theme
- `'dark'` (default): For use in `/tools/safety` dark-themed pages
- `'light'`: For light-themed student pages (if needed)

## Badge IDs

All 23 badges with their IDs:

**Tier 1:**
- `general-workshop-safety`
- `fire-safety-emergency`
- `ppe-fundamentals`
- `hand-tool-safety`

**Tier 2:**
- `wood-workshop`
- `metal-workshop`
- `plastics-composites`
- `electronics-soldering`
- `digital-fabrication`
- `textiles`

**Tier 3:**
- `band-saw`
- `scroll-saw`
- `pedestal-drill`
- `disc-sander`
- `wood-lathe`
- `laser-cutter`
- `3d-printer`
- `sewing-machine`

**Tier 4:**
- `resin-casting`
- `vacuum-forming`
- `screen-printing`

## Usage Examples

### Basic Usage (Dark Theme - Free Tool)
```tsx
import BadgePathVisualization from '@/components/safety/BadgePathVisualization';

export default function SafetyToolPage() {
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  return (
    <BadgePathVisualization
      earnedBadgeIds={earnedBadges}
      theme="dark"
    />
  );
}
```

### With Click Handler (Student Page)
```tsx
import BadgePathVisualization from '@/components/safety/BadgePathVisualization';
import { useRouter } from 'next/navigation';

export default function StudentBadgePage({ studentBadges }: Props) {
  const router = useRouter();

  const handleBadgeClick = (badgeId: string) => {
    router.push(`/safety/badges/${badgeId}`);
  };

  return (
    <BadgePathVisualization
      earnedBadgeIds={studentBadges.map(b => b.badge_id)}
      onBadgeClick={handleBadgeClick}
      theme="light"
    />
  );
}
```

### Teacher Dashboard (Showing Student Progress)
```tsx
<BadgePathVisualization
  earnedBadgeIds={student.badges.map(b => b.badge_id)}
  onBadgeClick={(badgeId) => {
    // Navigate to badge details for that student
    router.push(`/teacher/badges/${badgeId}/student/${student.id}`);
  }}
  theme="light"
/>
```

## Styling & Customization

### Color Palette
Each badge has a unique color used for borders and glows when available:
- **Red tones** (Tier 1): #FF6B6B, #FF8C00, #FFB74D, #FFC857
- **Green tones** (Tier 2 - Wood/Plastics): #A8E6CF, #FFD3B6, #F4A261
- **Blue tones** (Tier 2 - Metal/Electronics): #95B8D1, #E76F51
- **Purple tones** (Tier 2 - Textiles): #D62828
- **Cyan/Teal tones** (Tier 3): #06A77D, #119B9B, #3DADC6, #1D82B7, #0066CC, #8B39FF, #B53DA8
- **Warm tones** (Tier 4): #D4A574, #C9ADA7, #9A8C98

### Glow Effects
- **Earned**: Green glow (#4ade80) with inset shadow
- **Available**: Color-coded glow (40% opacity of badge color)
- **Locked**: No glow, minimal shadow

### Font & Typography
- **Title**: 28px, bold, gradient text (cyan → green)
- **Tier Headers**: 16px, bold, uppercase, color-coded by tier
- **Badge Name**: 13px, bold, 1.3 line height
- **Status Labels**: 11px, opacity 80%
- **Legend & Notes**: 12-13px, lighter opacity

## Performance Considerations

### Optimization Techniques
- **Memoized Badge Status**: `useMemo` computes locked/available/earned status once per render cycle
- **Memoized Tier Grouping**: Badges pre-grouped by tier on mount
- **Inline Styles**: No class generation overhead
- **No External Animations**: CSS keyframes defined inline

### Rendering
- All 23 badges render in a single pass
- Status transitions use CSS transitions (no React re-renders during animations)
- Pulse animation on available badges uses pure CSS

## Accessibility

### Semantic HTML
- Uses semantic `<div>` structure
- Proper heading hierarchy (h2 for title, h3 for tier headers)

### Keyboard Support
- Badges are keyboard-accessible if `onBadgeClick` is provided
- `cursor: pointer` on available/earned badges
- Visual focus states could be added via CSS (currently inline styles)

### Color Contrast
- Earned: Green (#4ade80) on dark background passes WCAG AA
- Available: Blue (#64b5f6) on dark background passes WCAG AA
- Locked: Gray (#555 or #bbb) meets minimum contrast

### Semantic Information
- Status is conveyed via:
  - Visual color (green/blue/gray)
  - Text label (✓ Earned / ● Ready / 🔒 Locked)
  - Icon styling (dimmed for locked)
  - Checkmark circle for earned

## Future Enhancements

### Possible Improvements
1. **Animated Prerequisite Lines**: SVG connectors between badges showing prerequisite chains
2. **Badge Details Modal**: Click to see full badge description, test requirements, learning objectives
3. **Progress Timeline**: Show earned date, expiry date (if applicable)
4. **Filtering**: Filter by tier, status, or category
5. **Batch Operations**: Allow teacher to grant multiple badges at once
6. **Custom Badge Trees**: Schools can define their own badge structures
7. **Export to PDF**: Print badge progress report
8. **Mobile Optimizations**: Touch-friendly click areas, larger badges on small screens

## Testing

### Test Cases
1. **Status Computation**
   - ✓ Locked badges when prerequisites not met
   - ✓ Available badges when prerequisites met
   - ✓ Earned badges when in earnedBadgeIds array
   - ✓ Mixed states (some earned, some available, some locked)

2. **Responsiveness**
   - ✓ Desktop (4-column grid)
   - ✓ Tablet (2-3 columns)
   - ✓ Mobile (1-2 columns)

3. **Interactivity**
   - ✓ Click handler fires with correct badgeId
   - ✓ Locked badges not clickable
   - ✓ Animations play smoothly

4. **Theme**
   - ✓ Dark theme (default)
   - ✓ Light theme
   - ✓ Colors appropriate for each theme

## Integration Points

### Teacher Dashboards
Mount on:
- `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` - Class-level badge progress
- `src/app/teacher/safety/[badgeId]/page.tsx` - Badge results & student progress
- `src/components/teacher/SafetyRequirements.tsx` - Unit prerequisites

### Student Pages
Mount on:
- `src/app/(student)/safety/page.tsx` - Main badge listing page
- `src/app/(student)/dashboard/page.tsx` - Badge progress widget
- `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` - Unit-specific requirements

### Free Tools
Mount on:
- `src/app/tools/safety/page.tsx` - Public safety reference tool

## Files

- **Component**: `src/components/safety/BadgePathVisualization.tsx` (~540 lines)
- **Export**: `src/components/safety/index.ts`
- **Demo**: `src/components/safety/BadgePathVisualization.demo.tsx` (interactive testing)
- **Spec**: `docs/safety-badge-path-spec.md` (this file)

## Related Components

- `BadgeGate.tsx` - Client-side unit access gating
- `SafetyRequirements.tsx` - Teacher badge requirement management
- `CompetencyPulse.tsx` - Student self-assessment (Melbourne Metrics)
- `NMConfigPanel.tsx` - Teacher NM/competency configuration
