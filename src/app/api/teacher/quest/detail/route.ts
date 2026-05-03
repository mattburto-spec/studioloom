// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherAuth } from '@/lib/auth/verify-teacher-unit';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/teacher/quest/detail
 *
 * Fetch full details for a single student's quest journey:
 * - Journey metadata
 * - All milestones (ordered by sort_order)
 * - All evidence (ordered by created_at descending)
 * - Recent mentor interactions (last 20, ordered by created_at descending)
 *
 * Query params:
 * - journeyId (required): UUID of the quest journey
 *
 * Returns: { journey, milestones, evidence, interactions }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTeacherAuth(req);
    if (auth.error) return auth.error;

    const journeyId = req.nextUrl.searchParams.get('journeyId');

    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch the journey with student info
    const { data: journey, error: journeyError } = await supabase
      .from('quest_journeys')
      .select(
        `
        *,
        units!inner(id, author_teacher_id),
        students(id, display_name)
      `
      )
      .eq('id', journeyId)
      .maybeSingle();

    if (journeyError) {
      console.error('[teacher/quest/detail/GET] Journey fetch error:', journeyError);
      return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 500 });
    }

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    // Verify teacher owns the unit associated with this journey
    const unitAuthorId = (journey.units as any)?.author_teacher_id;
    if (unitAuthorId !== auth.teacherId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch all milestones for this journey, ordered by sort_order
    const { data: milestones, error: milestonesError } = await supabase
      .from('quest_milestones')
      .select('*')
      .eq('journey_id', journeyId)
      .order('sort_order', { ascending: true });

    if (milestonesError) {
      console.error('[teacher/quest/detail/GET] Milestones fetch error:', milestonesError);
      return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
    }

    // Fetch all evidence for this journey, ordered by created_at descending
    const { data: evidence, error: evidenceError } = await supabase
      .from('quest_evidence')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: false });

    if (evidenceError) {
      console.error('[teacher/quest/detail/GET] Evidence fetch error:', evidenceError);
      return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
    }

    // Fetch recent mentor interactions (last 20)
    const { data: interactions, error: interactionsError } = await supabase
      .from('quest_mentor_interactions')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (interactionsError) {
      console.error('[teacher/quest/detail/GET] Interactions fetch error:', interactionsError);
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
    }

    return NextResponse.json({
      journey,
      milestones: milestones || [],
      evidence: evidence || [],
      interactions: interactions || [],
    });
  } catch (err) {
    console.error('[teacher/quest/detail/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/teacher/quest/detail
 *
 * Teacher actions on a specific quest:
 * - reject_evidence: Reject evidence submission with feedback
 *
 * Body: { action: string, evidenceId?: string, feedback?: string }
 *
 * Returns: { success: true } or error response
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireTeacherAuth(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { action } = body;

    const supabase = createAdminClient();

    switch (action) {
      case 'reject_evidence': {
        const { evidenceId, feedback } = body;

        if (!evidenceId) {
          return NextResponse.json({ error: 'evidenceId required' }, { status: 400 });
        }

        // Verify the evidence belongs to a journey whose unit belongs to this teacher
        const { data: evidence, error: evidenceCheckError } = await supabase
          .from('quest_evidence')
          .select(
            `
            id,
            journey_id,
            quest_journeys!inner(id, unit_id, units!inner(id, author_teacher_id))
          `
          )
          .eq('id', evidenceId)
          .maybeSingle();

        if (evidenceCheckError) {
          console.error('[teacher/quest/detail/PATCH] Evidence check error:', evidenceCheckError);
          return NextResponse.json({ error: 'Failed to verify evidence' }, { status: 500 });
        }

        if (!evidence) {
          return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
        }

        const unitAuthorId = (evidence.quest_journeys as any)?.units?.author_teacher_id;
        if (unitAuthorId !== auth.teacherId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Update evidence: set approved_by_teacher = false and add feedback
        const { error: updateError } = await supabase
          .from('quest_evidence')
          .update({
            approved_by_teacher: false,
            teacher_feedback: feedback || null,
          })
          .eq('id', evidenceId);

        if (updateError) {
          console.error('[teacher/quest/detail/PATCH] Update error:', updateError);
          return NextResponse.json({ error: 'Failed to reject evidence' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[teacher/quest/detail/PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
