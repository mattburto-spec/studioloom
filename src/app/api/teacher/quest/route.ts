import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherAuth } from '@/lib/auth/verify-teacher-unit';
import { createAdminClient } from '@/lib/supabase/admin';

// GET — list quest journeys for a unit (optionally filtered by class)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTeacherAuth(req);
    if (auth.error) return auth.error;

    const unitId = req.nextUrl.searchParams.get('unitId');
    const classId = req.nextUrl.searchParams.get('classId');

    if (!unitId) {
      return NextResponse.json({ error: 'unitId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify teacher owns this unit
    const { data: unit } = await supabase
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('author_teacher_id', auth.teacherId)
      .maybeSingle();

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Fetch journeys with student names
    let query = supabase
      .from('quest_journeys')
      .select(
        `
        *,
        students!inner(id, display_name)
      `
      )
      .eq('unit_id', unitId);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data: journeys, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('[teacher/quest/GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch journeys' }, { status: 500 });
    }

    // Fetch milestone counts per journey
    const journeyIds = (journeys || []).map(j => j.id);
    let milestoneCounts: Record<string, { total: number; completed: number }> = {};

    if (journeyIds.length > 0) {
      const { data: milestones } = await supabase
        .from('quest_milestones')
        .select('journey_id, status')
        .in('journey_id', journeyIds);

      if (milestones) {
        for (const m of milestones) {
          if (!milestoneCounts[m.journey_id]) {
            milestoneCounts[m.journey_id] = { total: 0, completed: 0 };
          }
          milestoneCounts[m.journey_id].total++;
          if (m.status === 'completed') {
            milestoneCounts[m.journey_id].completed++;
          }
        }
      }
    }

    // Fetch pending evidence counts (not yet approved)
    let pendingEvidenceCounts: Record<string, number> = {};
    if (journeyIds.length > 0) {
      const { data: pendingEvidence } = await supabase
        .from('quest_evidence')
        .select('journey_id')
        .in('journey_id', journeyIds)
        .eq('approved_by_teacher', false);

      if (pendingEvidence) {
        for (const e of pendingEvidence) {
          pendingEvidenceCounts[e.journey_id] = (pendingEvidenceCounts[e.journey_id] || 0) + 1;
        }
      }
    }

    return NextResponse.json({
      journeys: (journeys || []).map(j => ({
        ...j,
        milestone_progress: milestoneCounts[j.id] || { total: 0, completed: 0 },
        pending_evidence_count: pendingEvidenceCounts[j.id] || 0,
      })),
    });
  } catch (err) {
    console.error('[teacher/quest/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH — teacher actions (update help intensity, approve evidence, add notes)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireTeacherAuth(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { action } = body;

    const supabase = createAdminClient();

    switch (action) {
      case 'update_help_intensity': {
        const { journeyId, helpIntensity } = body;
        const validLevels = ['explorer', 'guided', 'supported', 'auto'];
        if (!validLevels.includes(helpIntensity)) {
          return NextResponse.json({ error: 'Invalid help intensity' }, { status: 400 });
        }

        const { error } = await supabase
          .from('quest_journeys')
          .update({ help_intensity: helpIntensity })
          .eq('id', journeyId);

        if (error) {
          return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'approve_evidence': {
        const { evidenceId, feedback } = body;

        const { error } = await supabase
          .from('quest_evidence')
          .update({
            approved_by_teacher: true,
            approved_at: new Date().toISOString(),
            teacher_feedback: feedback || null,
          })
          .eq('id', evidenceId);

        if (error) {
          return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'add_milestone_note': {
        const { milestoneId, note } = body;

        const { error } = await supabase
          .from('quest_milestones')
          .update({ teacher_note: note })
          .eq('id', milestoneId);

        if (error) {
          return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'adjust_milestone_date': {
        const { milestoneId, newDate } = body;

        const { error } = await supabase
          .from('quest_milestones')
          .update({ teacher_adjusted_date: newDate })
          .eq('id', milestoneId);

        if (error) {
          return NextResponse.json({ error: 'Failed to adjust date' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[teacher/quest/PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
