// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface DiscoveryProfile {
  strengths: string[];
  interests: string[];
  needs: string[];
  archetype?: string | null;
  project_idea?: string | null;
  narrowing_notes?: string;
}

interface UpdateRequest {
  journeyId: string;
  profile: DiscoveryProfile;
}

export async function PATCH(request: NextRequest) {
  try {
    // Auth check
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const { studentId } = session;

    // Rate limit
    const rl = rateLimit(`quest-discovery:${studentId}`, [
      { windowMs: 60000, maxRequests: 20 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request
    const body: UpdateRequest = await request.json();
    const { journeyId, profile } = body;

    // Validate inputs
    if (!journeyId || typeof journeyId !== 'string') {
      return NextResponse.json(
        { error: 'journeyId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!profile || typeof profile !== 'object') {
      return NextResponse.json(
        { error: 'profile is required and must be an object' },
        { status: 400 }
      );
    }

    // Validate profile fields
    const requiredFields = ['strengths', 'interests', 'needs'];
    for (const field of requiredFields) {
      if (!Array.isArray(profile[field as keyof DiscoveryProfile])) {
        return NextResponse.json(
          {
            error: `profile.${field} must be an array`,
          },
          { status: 400 }
        );
      }
    }

    // Get admin client
    const supabase = createAdminClient();

    // Verify student owns this journey
    const { data: journey, error: journeyError } = await supabase
      .from('quest_journeys')
      .select('id, phase')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: 'Journey not found or access denied' },
        { status: 404 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      discovery_profile: profile,
    };

    // If profile has project_idea (non-null, non-empty), mark discovery complete
    if (
      profile.project_idea &&
      typeof profile.project_idea === 'string' &&
      profile.project_idea.trim().length > 0
    ) {
      updatePayload.phase = 'planning';
      updatePayload.phase_entered_at = new Date().toISOString();
    }

    // Update journey
    const { data: updatedJourney, error: updateError } = await supabase
      .from('quest_journeys')
      .update(updatePayload)
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .select()
      .single();

    if (updateError) {
      console.error('[quest-discovery] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update discovery profile' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedJourney, { status: 200 });
  } catch (error) {
    console.error('[quest-discovery] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
