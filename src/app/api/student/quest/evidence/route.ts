// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import type { EvidenceType } from '@/lib/quest/types';
import { moderateAndLog } from '@/lib/content-safety/moderate-and-log';

/**
 * GET — List evidence for a quest journey
 *
 * Query params:
 *   - journeyId: string (required) — journey to fetch evidence for
 *   - milestoneId?: string (optional) — filter by specific milestone
 *
 * Returns: { evidence: QuestEvidence[] }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const journeyId = request.nextUrl.searchParams.get('journeyId');
    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify ownership
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('id')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    // Build query
    const milestoneId = request.nextUrl.searchParams.get('milestoneId');
    let query = supabase
      .from('quest_evidence')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: false });

    if (milestoneId) {
      query = query.eq('milestone_id', milestoneId);
    }

    const { data: evidence, error } = await query;

    if (error) {
      console.error('[quest/evidence/GET] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch evidence' },
        { status: 500 }
      );
    }

    return NextResponse.json({ evidence: evidence || [] });
  } catch (err) {
    console.error('[quest/evidence/GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST — Submit new evidence for a journey
 *
 * Evidence can be:
 *   - photo: file_url + file_type (image/jpeg, etc.)
 *   - voice: file_url + file_type (audio/webm, etc.)
 *   - text: content + type
 *   - file: file_url + file_type (any file)
 *   - link: content (URL string)
 *   - reflection: content (written reflection)
 *   - tool_session: file_url (tool session JSON export)
 *   - ai_conversation: file_url (conversation transcript)
 *
 * All submissions default to approved_by_teacher = false
 * (teacher must explicitly approve before portfolio inclusion)
 *
 * Body:
 *   - journeyId: string (required)
 *   - milestoneId?: string (optional)
 *   - type: EvidenceType (required)
 *   - content?: string (for text, reflection, link types)
 *   - fileUrl?: string (for file, photo, voice, tool_session, ai_conversation)
 *   - fileType?: string (for file types, e.g. 'image/jpeg')
 *
 * Returns: { evidence: QuestEvidence } on success
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    // Rate limit: 20 evidence submissions per minute
    const rl = rateLimit(`quest-evidence:${studentId}`, [
      { windowMs: 60_000, maxRequests: 20 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { journeyId, milestoneId, type, content, fileUrl, fileType } = body as {
      journeyId: string;
      milestoneId?: string;
      type: EvidenceType;
      content?: string;
      fileUrl?: string;
      fileType?: string;
    };

    if (!journeyId || !type) {
      return NextResponse.json(
        { error: 'journeyId and type required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify ownership and get current phase
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('id, phase, framework_id')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    // Create evidence
    // All submissions start with approved_by_teacher = false
    // Teacher explicitly approves for portfolio inclusion
    const { data: evidence, error } = await supabase
      .from('quest_evidence')
      .insert({
        journey_id: journeyId,
        milestone_id: milestoneId || null,
        type,
        content: content || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        thumbnail_url: null,
        ai_analysis: null,
        approved_by_teacher: false,
        approved_at: null,
        teacher_feedback: null,
        phase: journey.phase,
        framework_phase_id: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[quest/evidence/POST] Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit evidence' },
        { status: 500 }
      );
    }

    // Phase 5F: Fire-and-forget moderation — private quest evidence
    if (content && typeof content === 'string' && content.length > 0) {
      moderateAndLog(content, {
        classId: '',
        studentId,
        source: 'quest_evidence' as const,
      }).catch((err: unknown) => console.error('[quest/evidence] moderation error:', err));
    }

    // Increment evidence count on journey
    const journeyData = journey as any;
    const currentCount = journeyData.total_evidence_count || 0;
    await supabase
      .from('quest_journeys')
      .update({ total_evidence_count: currentCount + 1 })
      .eq('id', journeyId);

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (err) {
    console.error('[quest/evidence/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
