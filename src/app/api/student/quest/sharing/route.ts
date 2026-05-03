import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { moderateAndLog } from '@/lib/content-safety/moderate-and-log';

/**
 * POST — Submit final reflection as evidence
 *
 * Body: { journeyId: string, reflection: Record<string, unknown> }
 * Stores reflection as evidence (type: 'reflection'), links to reflection milestone
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const rl = rateLimit(`quest-sharing:${studentId}`, [
      { windowMs: 60_000, maxRequests: 10 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { journeyId, reflection } = body as {
      journeyId: string;
      reflection: Record<string, unknown>;
    };

    if (!journeyId || !reflection) {
      return NextResponse.json(
        { error: 'journeyId and reflection required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify student owns journey and it's in sharing phase
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('id, phase, mentor_id')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    if (journey.phase !== 'sharing') {
      return NextResponse.json(
        { error: `Cannot submit reflection in ${journey.phase} phase` },
        { status: 400 }
      );
    }

    // Phase 5F: Synchronous moderation gate — peer-visible reflection
    const textToModerate = typeof reflection === 'string'
      ? reflection
      : JSON.stringify(reflection);
    if (textToModerate.length > 2) {
      try {
        const { allow } = await moderateAndLog(textToModerate, {
          classId: '',
          studentId,
          source: 'quest_sharing' as const,
        }, { gate: true });
        if (!allow) {
          return NextResponse.json(
            { error: "This reflection can't be shared right now. Please revise and try again." },
            { status: 403 }
          );
        }
      } catch (modErr) {
        console.error('[quest/sharing] moderation failed, allowing through:', modErr);
      }
    }

    // Store reflection as evidence
    const { data: evidence, error: evidenceError } = await supabase
      .from('quest_evidence')
      .insert({
        journey_id: journeyId,
        type: 'reflection',
        content: JSON.stringify(reflection),
        phase: 'sharing',
        approved_by_teacher: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (evidenceError) {
      console.error('[quest/sharing/POST] Evidence insert error:', evidenceError);
      return NextResponse.json({ error: 'Failed to store reflection' }, { status: 500 });
    }

    // Link to "Final reflection written" milestone if it exists
    const { data: milestones } = await supabase
      .from('quest_milestones')
      .select('id, title, status')
      .eq('journey_id', journeyId)
      .eq('phase', 'sharing')
      .ilike('title', '%reflection%')
      .limit(1);

    if (milestones && milestones.length > 0) {
      const milestone = milestones[0];
      // Update evidence to link to this milestone
      await supabase
        .from('quest_evidence')
        .update({ milestone_id: milestone.id })
        .eq('id', evidence.id);

      // Mark milestone as completed if not already
      if (milestone.status !== 'completed') {
        await supabase
          .from('quest_milestones')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completion_note: 'Final reflection submitted',
          })
          .eq('id', milestone.id);
      }
    }

    return NextResponse.json({ evidence, journey });
  } catch (err) {
    console.error('[quest/sharing/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH — Complete journey (transition sharing → completed)
 *
 * Body: { journeyId: string }
 * Validates: all sharing milestones done, evidence count > 0
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const rl = rateLimit(`quest-sharing-complete:${studentId}`, [
      { windowMs: 60_000, maxRequests: 5 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { journeyId } = body as { journeyId: string };

    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify student owns journey
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('id, phase')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    if (journey.phase !== 'sharing') {
      return NextResponse.json(
        { error: `Cannot complete journey in ${journey.phase} phase` },
        { status: 400 }
      );
    }

    // Check all sharing milestones are completed or skipped
    const { data: sharingMilestones } = await supabase
      .from('quest_milestones')
      .select('id, status')
      .eq('journey_id', journeyId)
      .eq('phase', 'sharing');

    const incomplete = (sharingMilestones || []).filter(
      m => m.status !== 'completed' && m.status !== 'skipped'
    );

    if (incomplete.length > 0) {
      return NextResponse.json(
        { error: `${incomplete.length} sharing milestone(s) not yet completed` },
        { status: 400 }
      );
    }

    // Check sharing evidence count > 0
    const { count: sharingEvidenceCount } = await supabase
      .from('quest_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('journey_id', journeyId)
      .eq('phase', 'sharing');

    if (!sharingEvidenceCount || sharingEvidenceCount === 0) {
      return NextResponse.json(
        { error: 'At least one piece of sharing evidence required' },
        { status: 400 }
      );
    }

    // Transition to completed
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('quest_journeys')
      .update({
        phase: 'completed',
        completed_at: now,
        phase_entered_at: now,
      })
      .eq('id', journeyId)
      .select()
      .single();

    if (error) {
      console.error('[quest/sharing/PATCH] Update error:', error);
      return NextResponse.json({ error: 'Failed to complete journey' }, { status: 500 });
    }

    return NextResponse.json({ journey: updated });
  } catch (err) {
    console.error('[quest/sharing/PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
