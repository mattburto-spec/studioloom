import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth } from '@/lib/auth/student';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { DEFAULT_HEALTH_SCORE } from '@/lib/quest/types';

/**
 * GET — Fetch student's quest journey for a unit
 *
 * Query params:
 *   - unitId: string (required) — unit to fetch journey for
 *
 * Returns: { journey, milestones, evidence }
 * or { journey: null, milestones: [], evidence: [] } if no journey exists yet
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;

    const unitId = request.nextUrl.searchParams.get('unitId');
    if (!unitId) {
      return NextResponse.json({ error: 'unitId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch journey with basic fields
    const { data: journey, error } = await supabase
      .from('quest_journeys')
      .select('*')
      .eq('student_id', studentId)
      .eq('unit_id', unitId)
      .maybeSingle();

    if (error) {
      console.error('[quest/GET] Error fetching journey:', error);
      return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 500 });
    }

    if (!journey) {
      return NextResponse.json({ journey: null, milestones: [], evidence: [] });
    }

    // Fetch milestones
    const { data: milestones } = await supabase
      .from('quest_milestones')
      .select('*')
      .eq('journey_id', journey.id)
      .order('sort_order', { ascending: true });

    // Fetch recent evidence (last 50, newest first)
    const { data: evidence } = await supabase
      .from('quest_evidence')
      .select('*')
      .eq('journey_id', journey.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      journey,
      milestones: milestones || [],
      evidence: evidence || [],
    });
  } catch (err) {
    console.error('[quest/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST — Create a new quest journey for a unit
 *
 * Body:
 *   - unitId: string (required)
 *   - classId?: string (optional, falls back to student's current class)
 *   - frameworkId: string (required) — IB MYP, GCSE DT, etc.
 *
 * Returns: { journey } on success
 * Returns: 409 if journey already exists for this unit
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;

    // Rate limit: 5 creates per minute, 50 per hour
    const rl = rateLimit(`quest-create:${studentId}`, [
      { windowMs: 60_000, maxRequests: 5 },
      { windowMs: 3_600_000, maxRequests: 50 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { unitId, classId, frameworkId } = body;

    if (!unitId || !frameworkId) {
      return NextResponse.json(
        { error: 'unitId and frameworkId required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check for existing journey
    const { data: existing } = await supabase
      .from('quest_journeys')
      .select('id')
      .eq('student_id', studentId)
      .eq('unit_id', unitId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Journey already exists for this unit' },
        { status: 409 }
      );
    }

    // Create journey
    const { data: journey, error } = await supabase
      .from('quest_journeys')
      .insert({
        student_id: studentId,
        unit_id: unitId,
        class_id: classId || null,
        framework_id: frameworkId,
        phase: 'not_started',
        phase_entered_at: new Date().toISOString(),
        help_intensity: 'guided',
        health_score: DEFAULT_HEALTH_SCORE,
        total_sessions: 0,
        total_evidence_count: 0,
        sessions_remaining: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      .select()
      .single();

    if (error) {
      console.error('[quest/POST] Error creating journey:', error);
      return NextResponse.json({ error: 'Failed to create journey' }, { status: 500 });
    }

    return NextResponse.json({ journey }, { status: 201 });
  } catch (err) {
    console.error('[quest/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
