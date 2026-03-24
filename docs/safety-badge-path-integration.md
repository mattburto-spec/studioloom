# Badge Path Visualization — Integration Guide

## Quick Start

### 1. Import the Component
```tsx
import { BadgePathVisualization } from '@/components/safety';
```

### 2. Get Student's Earned Badges
From your API or database:
```tsx
const { data: studentBadges } = await supabase
  .from('student_badges')
  .select('badge_id')
  .eq('student_id', studentId)
  .eq('status', 'active');

const earnedBadgeIds = studentBadges?.map(b => b.badge_id) || [];
```

### 3. Render the Component
```tsx
<BadgePathVisualization
  earnedBadgeIds={earnedBadgeIds}
  onBadgeClick={handleBadgeClick}
  theme="dark"
/>
```

---

## Integration Examples

### Example 1: Student Safety Dashboard
**File:** `src/app/(student)/safety/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgePathVisualization } from '@/components/safety';
import { createClient } from '@/lib/supabase/client';

export default function StudentSafetyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: studentBadges } = await supabase
          .from('student_badges')
          .select('badge_id')
          .eq('student_id', user.id)
          .eq('status', 'active');

        if (studentBadges) {
          setEarnedBadges(studentBadges.map(b => b.badge_id));
        }
      } finally {
        setLoading(false);
      }
    };

    loadBadges();
  }, [supabase]);

  const handleBadgeClick = (badgeId: string) => {
    // Navigate to badge detail page
    router.push(`/safety/badges/${badgeId}`);
  };

  if (loading) {
    return <div>Loading safety badges...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <h1>Workshop Safety Badges</h1>
      <p>
        Earn badges by completing safety certifications. Each tier builds on
        the previous one, unlocking access to more advanced workshop tools and
        techniques.
      </p>

      <BadgePathVisualization
        earnedBadgeIds={earnedBadges}
        onBadgeClick={handleBadgeClick}
        theme="dark"
      />

      <section style={{ marginTop: '40px' }}>
        <h2>How it works</h2>
        <ul>
          <li>
            <strong>Tier 1 (Foundation):</strong> Complete these first. They
            cover essential safety knowledge.
          </li>
          <li>
            <strong>Tier 2 (Specialties):</strong> Choose your workshop area.
            Each requires General Workshop Safety.
          </li>
          <li>
            <strong>Tier 3 (Machines):</strong> Get certified on specific
            machines. Requires the corresponding specialty badge.
          </li>
          <li>
            <strong>Tier 4 (Mastery):</strong> Advanced processes and
            techniques.
          </li>
        </ul>
      </section>
    </div>
  );
}
```

### Example 2: Teacher Badge Progress View
**File:** `src/app/teacher/safety/results/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { BadgePathVisualization } from '@/components/safety';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BadgeResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!studentId) return;

      const supabase = await createServerClient();

      // Get student info
      const { data: student } = await supabase
        .from('students')
        .select('name')
        .eq('id', studentId)
        .single();

      // Get earned badges
      const { data: badges } = await supabase
        .from('student_badges')
        .select('badge_id')
        .eq('student_id', studentId)
        .eq('status', 'active');

      if (student) setStudentName(student.name);
      if (badges) {
        setEarnedBadges(badges.map(b => b.badge_id));
      }
      setLoading(false);
    };

    loadData();
  }, [studentId]);

  const handleBadgeClick = (badgeId: string) => {
    // Navigate to badge detail to see test results
    router.push(`/teacher/badges/${badgeId}?studentId=${studentId}`);
  };

  if (loading) {
    return <div>Loading badge progress...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>{studentName}'s Badge Progress</h1>
        <p>
          {earnedBadges.length} of 23 badges earned • Click any badge to see
          test results
        </p>
      </div>

      <BadgePathVisualization
        earnedBadgeIds={earnedBadges}
        onBadgeClick={handleBadgeClick}
        theme="light"
      />
    </div>
  );
}
```

### Example 3: Unit Prerequisite Display
**File:** `src/app/(student)/unit/[unitId]/page.tsx`

```tsx
import { BadgePathVisualization } from '@/components/safety';
import { getUnitBadgeRequirements } from '@/lib/safety';
import { getCurrentStudent } from '@/lib/auth';

export default async function UnitPage({ params }: Props) {
  const { unitId } = params;
  const student = await getCurrentStudent();

  // Get badges required for this unit
  const requiredBadges = await getUnitBadgeRequirements(unitId);
  const studentBadges = await getStudentEarnedBadges(student.id);

  const canAccessUnit = requiredBadges.every(
    badge => studentBadges.includes(badge.id)
  );

  return (
    <div>
      {!canAccessUnit && (
        <div className="mb-6">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-amber-900">
              Safety Certification Required
            </h3>
            <p className="text-sm text-amber-800 mt-2">
              Complete the badges below to access this unit.
            </p>
          </div>

          {/* Show only required badges */}
          <BadgePathVisualization
            earnedBadgeIds={studentBadges}
            theme="light"
          />
        </div>
      )}

      {/* Unit content */}
      <div className="mt-8">
        <h1>Unit: Advanced Wood Turning</h1>
        {/* ... rest of unit content ... */}
      </div>
    </div>
  );
}
```

### Example 4: Teacher Unit Settings
**File:** `src/app/teacher/units/[unitId]/page.tsx`

```tsx
import { BadgePathVisualization } from '@/components/safety';
import { getUnitBadgeRequirements } from '@/lib/safety';

export default async function UnitManagePage({ params }: Props) {
  const { unitId } = params;
  const requiredBadges = await getUnitBadgeRequirements(unitId);

  return (
    <div className="max-w-4xl mx-auto">
      <section className="mb-8">
        <h2>Safety Prerequisites</h2>
        <p>
          Students must earn these badges before accessing this unit:
        </p>

        {requiredBadges.length > 0 ? (
          <>
            <ul className="mt-4 mb-6">
              {requiredBadges.map(badge => (
                <li key={badge.id}>
                  {badge.icon} {badge.name}
                </li>
              ))}
            </ul>

            {/* Show the complete skill tree for reference */}
            <details>
              <summary>View complete badge skill tree</summary>
              <div className="mt-4">
                <BadgePathVisualization
                  earnedBadgeIds={requiredBadges.map(b => b.id)}
                  theme="light"
                />
              </div>
            </details>
          </>
        ) : (
          <p className="text-gray-500 mt-4">No badge requirements set.</p>
        )}
      </section>

      {/* Edit requirements section */}
      <section>
        <h2>Edit Prerequisites</h2>
        <BadgeRequirementForm unitId={unitId} />
      </section>
    </div>
  );
}
```

### Example 5: Free Public Safety Tool
**File:** `src/app/tools/safety/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { BadgePathVisualization } from '@/components/safety';

export default function SafetyToolPage() {
  // In the public tool, teachers see the badge tree but can't see actual
  // student data. It's for reference/learning about the safety structure.
  const [selectedBadges, setSelectedBadges] = useState<string[]>([
    'general-workshop-safety',
    'fire-safety-emergency',
  ]);

  const handleBadgeClick = (badgeId: string) => {
    // Toggle badges for demo purposes
    setSelectedBadges(prev =>
      prev.includes(badgeId)
        ? prev.filter(id => id !== badgeId)
        : [...prev, badgeId]
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1>Workshop Safety Badge System</h1>
        <p>
          A comprehensive, tiered approach to workshop safety certification.
          Students progress through foundational safety, then specialize in
          workshop areas and specific machines.
        </p>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2>Badge Progression Model</h2>
        <BadgePathVisualization
          earnedBadgeIds={selectedBadges}
          onBadgeClick={handleBadgeClick}
          theme="dark"
        />
      </section>

      <section>
        <h2>How to Implement</h2>
        <ol>
          <li>
            <strong>Create badges</strong> in your teacher dashboard
          </li>
          <li>
            <strong>Assign to units</strong> as prerequisites (students can't
            access until certified)
          </li>
          <li>
            <strong>Students take tests</strong> to earn badges
          </li>
          <li>
            <strong>Track progress</strong> on the class dashboard
          </li>
        </ol>
      </section>
    </div>
  );
}
```

---

## API Integration

### Fetching Student Badges
```tsx
async function getStudentEarnedBadges(studentId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('student_badges')
    .select('badge_id')
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (error) throw error;
  return data?.map(b => b.badge_id) || [];
}
```

### Checking Unit Requirements
```tsx
async function canAccessUnit(
  studentId: string,
  unitId: string
): Promise<boolean> {
  const supabase = await createServerClient();

  // Get required badges
  const { data: requirements } = await supabase
    .from('unit_badge_requirements')
    .select('badge_id')
    .eq('unit_id', unitId);

  if (!requirements || requirements.length === 0) {
    return true; // No requirements
  }

  // Check if student has all required badges
  const { data: studentBadges } = await supabase
    .from('student_badges')
    .select('badge_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .in(
      'badge_id',
      requirements.map(r => r.badge_id)
    );

  const requiredCount = requirements.length;
  const earnedCount = studentBadges?.length || 0;

  return earnedCount === requiredCount;
}
```

### Getting Badge Details for a Student
```tsx
async function getStudentBadgeDetails(studentId: string, badgeId: string) {
  const supabase = await createServerClient();

  const { data: badge, error } = await supabase
    .from('student_badges')
    .select(`
      *,
      badge:badges(*)
    `)
    .eq('student_id', studentId)
    .eq('badge_id', badgeId)
    .single();

  if (error) throw error;
  return badge;
}
```

---

## Styling in Different Contexts

### Dark Theme (Free Tool - Default)
```tsx
<BadgePathVisualization
  earnedBadgeIds={earnedBadges}
  theme="dark"
/>
```
- Black background (#0a0a0f)
- Light text (#e0e0e0)
- Bright accent colors
- Works great for projector view or full-screen pages

### Light Theme (Student/Teacher Dashboards)
```tsx
<BadgePathVisualization
  earnedBadgeIds={earnedBadges}
  theme="light"
/>
```
- Light gray background (#fafafa)
- Dark text (#333)
- Muted accent colors
- Blends into app UI

---

## Customization Ideas

### Show Only Relevant Badges
If you want to show only badges relevant to a unit:
```tsx
const relevantBadgeIds = getRelevantBadges(unit);
const earnedRelevant = earnedBadges.filter(b =>
  relevantBadgeIds.includes(b)
);

<BadgePathVisualization
  earnedBadgeIds={earnedRelevant}
/>
```

### Disable Interactivity
If the component is read-only:
```tsx
<BadgePathVisualization
  earnedBadgeIds={earnedBadges}
  onBadgeClick={undefined}  // No handler = not clickable
/>
```

### Show Earned Badges Only
For a compact view:
```tsx
// Filter the component to show only earned badges
// (Would require extending the component)
```

---

## Testing Integration

### Unit Test Example
```tsx
import { render, screen } from '@testing-library/react';
import BadgePathVisualization from '@/components/safety/BadgePathVisualization';

describe('BadgePathVisualization', () => {
  it('shows earned badges with checkmarks', () => {
    render(
      <BadgePathVisualization
        earnedBadgeIds={['general-workshop-safety']}
      />
    );

    expect(screen.getByText('✓ Earned')).toBeInTheDocument();
  });

  it('shows available badges when prerequisites are met', () => {
    render(
      <BadgePathVisualization
        earnedBadgeIds={['general-workshop-safety']}
      />
    );

    expect(screen.getByText('Wood Workshop')).toBeInTheDocument();
    // Should show as "Ready" not "Locked"
  });

  it('locks badges when prerequisites not met', () => {
    render(
      <BadgePathVisualization earnedBadgeIds={[]} />
    );

    expect(screen.getByText('🔒 Locked')).toBeInTheDocument();
  });
});
```

---

## Performance Tips

1. **Memoize earnedBadgeIds array** to prevent unnecessary re-renders:
   ```tsx
   const earnedBadges = useMemo(() => studentBadges.map(b => b.id), [studentBadges]);
   ```

2. **Fetch badges once** on page load, then cache:
   ```tsx
   const { data: badges } = useQuery(['student-badges', studentId], () =>
     getStudentEarnedBadges(studentId)
   );
   ```

3. **Lazy load badge details** if clicking navigates away

4. **Use server-side rendering** for initial badge data (static on mount)

---

## Troubleshooting

### Badges showing as locked when they should be available
- Check that prerequisite badge IDs match exactly (case-sensitive)
- Verify earnedBadgeIds array contains the correct prerequisite ID

### Component not rendering
- Ensure theme prop is set ('dark' or 'light')
- Check that earnedBadgeIds is an array (even if empty)
- Verify onBadgeClick is optional and not causing errors

### Colors look wrong
- Check theme prop matches your page theme
- For dark pages, use `theme="dark"` (default)
- For light pages, use `theme="light"`

### Animations not smooth
- Check browser supports CSS transitions (IE11 may have issues)
- Verify no CSS conflicts with global styles
