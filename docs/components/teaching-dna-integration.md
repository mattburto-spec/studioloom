# TeachingDNA Integration Guide

**Quick reference for adding TeachingDNA to teacher-facing pages.**

## 1. Minimal Integration (Dashboard Widget)

```tsx
// app/teacher/dashboard/page.tsx
'use client';

import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { useSession } from '@/hooks/useSession';
import { loadStyleProfile } from '@/lib/teacher-style/profile-service';
import { useEffect, useState } from 'react';
import { type TeacherStyleProfile } from '@/types/teacher-style';

export default function TeacherDashboard() {
  const session = useSession();
  const [profile, setProfile] = useState<TeacherStyleProfile | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadStyleProfile(session.user.id).then(setProfile);
  }, [session?.user?.id]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Your Classroom</h1>

      {profile && (
        <TeachingDNA profile={profile} className="max-w-2xl" />
      )}

      {/* Rest of dashboard... */}
    </div>
  );
}
```

## 2. Teacher Profile Settings Page

```tsx
// app/teacher/settings/profile/page.tsx
'use client';

import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { useTeacher } from '@/hooks/useTeacher';
import { loadStyleProfile } from '@/lib/teacher-style/profile-service';
import { useEffect, useState } from 'react';
import { type TeacherStyleProfile } from '@/types/teacher-style';

export default function TeacherProfileSettings() {
  const teacher = useTeacher();
  const [profile, setProfile] = useState<TeacherStyleProfile | null>(null);

  useEffect(() => {
    if (!teacher?.id) return;
    loadStyleProfile(teacher.id).then(setProfile);
  }, [teacher?.id]);

  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      {/* Left: DNA visualization */}
      <div>
        <h2 className="text-lg font-bold mb-4">Your Teaching DNA</h2>
        {profile && <TeachingDNA profile={profile} />}
      </div>

      {/* Right: Settings form */}
      <div className="col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-4">Visibility & Privacy</h2>
          {/* Privacy settings, sharing options, etc. */}
        </div>
      </div>
    </div>
  );
}
```

## 3. Teacher Onboarding Flow

```tsx
// app/onboarding/teaching-style/page.tsx
'use client';

import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import {
  mockEstablishedMaker,
  mockEstablishedStudioDirector,
  mockEstablishedDigitalPioneer,
} from '@/components/teacher/TeachingDNA.stories';

export default function TeachingStyleOnboarding() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          What's Your Teaching Style?
        </h1>
        <p className="text-gray-600">
          Here are different teaching profiles. Which resonates most with you?
          Don't worry — your actual style will emerge as you use Questerra.
        </p>
      </div>

      <div className="space-y-4">
        {[mockEstablishedMaker, mockEstablishedStudioDirector, mockEstablishedDigitalPioneer].map(
          (profile) => (
            <div
              key={profile.teacherId}
              className={`cursor-pointer rounded-lg border-2 p-4 transition ${
                selected === profile.teacherId
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200'
              }`}
              onClick={() => setSelected(profile.teacherId)}
            >
              <TeachingDNA profile={profile} />
            </div>
          )
        )}
      </div>

      <button
        onClick={() => {
          // Save preference and continue
        }}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white font-semibold"
      >
        Continue
      </button>
    </div>
  );
}
```

## Environment & Type Imports

All files need the correct imports:

```tsx
// Always needed
import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { type TeacherStyleProfile } from '@/types/teacher-style';
import { loadStyleProfile } from '@/lib/teacher-style/profile-service';

// Optional (for stories/examples)
import {
  mockEstablishedMaker,
  mockEstablishedStudioDirector,
  // ... etc
} from '@/components/teacher/TeachingDNA.stories';
```

## Common Patterns

### Wrapping in a Card Container

```tsx
<div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
  <h2 className="text-lg font-bold mb-4">Teaching Profile</h2>
  <TeachingDNA profile={profile} />
</div>
```

### Responsive Layout (Desktop/Mobile)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>
    <h3 className="text-lg font-bold mb-4">Your DNA</h3>
    <TeachingDNA profile={profile} />
  </div>
  <div>
    {/* Other content */}
  </div>
</div>
```

### With Loading State

```tsx
const [profile, setProfile] = useState<TeacherStyleProfile | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadStyleProfile(teacherId)
    .then(setProfile)
    .finally(() => setLoading(false));
}, [teacherId]);

return (
  <>
    {loading ? (
      <div className="animate-pulse h-96 bg-gray-200 rounded-lg" />
    ) : profile ? (
      <TeachingDNA profile={profile} className="max-w-2xl" />
    ) : (
      <div>Unable to load profile</div>
    )}
  </>
);
```

## Testing

Use the stories file to test different states:

```tsx
// In a test file
import { render } from '@testing-library/react';
import { TeachingDNA } from '@/components/teacher/TeachingDNA';
import { mockEstablishedMaker } from '@/components/teacher/TeachingDNA.stories';

describe('TeachingDNA', () => {
  it('renders established profile', () => {
    const { getByText } = render(<TeachingDNA profile={mockEstablishedMaker} />);
    expect(getByText('Workshop Mentor')).toBeInTheDocument();
  });
});
```

## Notes

- Always load the profile asynchronously (`await loadStyleProfile(teacherId)`)
- Profiles update automatically as teachers interact with the system
- The component is read-only (no editing needed)
- Cold-start profiles render a placeholder, so check for data before use
- Use `className` prop for responsive sizing (e.g., `max-w-2xl` on desktop)
- All styling is Tailwind + inline SVG (no external CSS needed)
