// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { canTransition } from '@/lib/quest/phase-machine';
import type { QuestPhase } from '@/lib/quest/types';

/**
 * POST — Advance quest journey to next phase
 *
 * Body:
 *   - journeyId: string (required)
 *   - targetPhase: QuestPhase (required) — 'discovery', 'planning', 'working', 'sharing', 'completed'
 *
 * Returns: { journey } on success
 * Returns: 400 if transition is invalid (e.g., discovery → working without planning)
 * Returns: 404 if journey not found
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    // Rate limit: 10 phase transitions per minute
    const rl = rateLimit(`quest-phase:${studentId}`, [
      { windowMs: 60_000, maxRequests: 10 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { journeyId, targetPhase } = body as {
      journeyId: string;
      targetPhase: QuestPhase;
    };

    if (!journeyId || !targetPhase) {
      return NextResponse.json(
        { error: 'journeyId and targetPhase required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch current journey
    const { data: journey, error: fetchError } = await supabase
      .from('quest_journeys')
      .select('*')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (fetchError || !journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    // Validate transition (e.g., can't skip phases)
    if (!canTransition(journey.phase as QuestPhase, targetPhase)) {
      return NextResponse.json(
        { error: `Cannot transition from ${journey.phase} to ${targetPhase}` },
        { status: 400 }
      );
    }

    // Update phase
    const updateData: Record<string, unknown> = {
      phase: targetPhase,
      phase_entered_at: new Date().toISOString(),
    };

    if (targetPhase === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from('quest_journeys')
      .update(updateData)
      .eq('id', journeyId)
      .select()
      .single();

    if (updateError) {
      console.error('[quest/phase/POST] Error updating phase:', updateError);
      return NextResponse.json({ error: 'Failed to update phase' }, { status: 500 });
    }

    return NextResponse.json({ journey: updated });
  } catch (err) {
    console.error('[quest/phase/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
