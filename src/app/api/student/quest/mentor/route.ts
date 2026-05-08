// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { getMentor } from '@/lib/quest/mentors';
import { buildQuestPrompt } from '@/lib/quest/build-quest-prompt';
import type { MentorId, QuestInteractionType } from '@/lib/quest/types';
import { MODELS } from '@/lib/ai/models';
import { callAnthropicMessages } from '@/lib/ai/call';

/**
 * PATCH — Select a mentor for the quest journey
 *
 * Body:
 *   - journeyId: string (required)
 *   - mentorId: MentorId (required) — 'kit' | 'sage' | 'river' | 'spark' | 'haven'
 *
 * Returns: { journey } on success
 * Returns: 409 if mentor already selected
 * Returns: 404 if journey not found
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    const body = await request.json();
    const { journeyId, mentorId } = body as {
      journeyId: string;
      mentorId: MentorId;
    };

    if (!journeyId || !mentorId) {
      return NextResponse.json(
        { error: 'journeyId and mentorId required' },
        { status: 400 }
      );
    }

    // Validate mentor exists
    const mentor = getMentor(mentorId);
    if (!mentor) {
      return NextResponse.json({ error: 'Invalid mentor ID' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify ownership and check if mentor already selected
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('id, mentor_id')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    if (journey.mentor_id) {
      return NextResponse.json(
        { error: 'Mentor already selected' },
        { status: 409 }
      );
    }

    // Update mentor
    const { data: updated, error } = await supabase
      .from('quest_journeys')
      .update({ mentor_id: mentorId })
      .eq('id', journeyId)
      .select()
      .single();

    if (error) {
      console.error('[quest/mentor/PATCH] Error selecting mentor:', error);
      return NextResponse.json({ error: 'Failed to select mentor' }, { status: 500 });
    }

    return NextResponse.json({ journey: updated });
  } catch (err) {
    console.error('[quest/mentor/PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST — Send message to mentor (AI interaction)
 *
 * Calls Claude Haiku with context from journey, milestones, and recent evidence.
 * Uses buildQuestPrompt to construct the system prompt with phase-specific rules.
 *
 * Body:
 *   - journeyId: string (required)
 *   - message?: string (optional, empty if just triggering an interaction type)
 *   - interactionType: QuestInteractionType (required)
 *
 * Returns: { response: string, interaction: QuestMentorInteraction }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireStudentSession(request);
    if (session instanceof NextResponse) return session;
    const studentId = session.studentId;

    // Rate limit: 15 per minute, 100 per hour
    const rl = rateLimit(`quest-mentor:${studentId}`, [
      { windowMs: 60_000, maxRequests: 15 },
      { windowMs: 3_600_000, maxRequests: 100 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { journeyId, message, interactionType } = body as {
      journeyId: string;
      message?: string;
      interactionType: QuestInteractionType;
    };

    if (!journeyId || !interactionType) {
      return NextResponse.json(
        { error: 'journeyId and interactionType required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch journey + milestones + recent evidence
    const { data: journey } = await supabase
      .from('quest_journeys')
      .select('*')
      .eq('id', journeyId)
      .eq('student_id', studentId)
      .single();

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const { data: milestones } = await supabase
      .from('quest_milestones')
      .select('*')
      .eq('journey_id', journeyId)
      .order('sort_order');

    const { data: recentEvidence } = await supabase
      .from('quest_evidence')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build prompt with phase-specific context
    const systemPrompt = buildQuestPrompt({
      journey: journey as any,
      milestones: (milestones || []) as any,
      recentEvidence: (recentEvidence || []) as any,
      interactionType,
      studentMessage: message,
    });

    // Call AI — Haiku for student-facing interactions (fast + cheap).
    // Helper handles withAIBudget cap enforcement + Lesson #39 truncation guard
    // when studentId is provided.
    const callResult = await callAnthropicMessages({
      supabase,
      studentId,
      endpoint: 'student/quest/mentor',
      model: MODELS.HAIKU,
      maxTokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message || `[${interactionType} triggered]`,
        },
      ],
      metadata: { interactionType, journeyId, mentorId: journey.mentor_id || 'guided' },
    });

    if (!callResult.ok) {
      if (callResult.reason === 'over_cap') {
        return NextResponse.json(
          {
            error: 'budget_exceeded',
            cap: callResult.cap,
            used: callResult.used,
            reset_at: callResult.resetAt,
          },
          { status: 429 }
        );
      }
      if (callResult.reason === 'truncated') {
        // Lesson #39 — don't bill on truncation.
        return NextResponse.json(
          { error: 'model_truncated', message: 'AI response truncated; try a shorter message.' },
          { status: 502 }
        );
      }
      if (callResult.reason === 'api_error') throw callResult.error;
      return NextResponse.json({ error: `AI call failed: ${callResult.reason}` }, { status: 502 });
    }

    const aiResponse = callResult.response;
    const mentorResponse = aiResponse.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    // Log interaction
    const { data: interaction, error: logError } = await supabase
      .from('quest_mentor_interactions')
      .insert({
        journey_id: journeyId,
        interaction_type: interactionType,
        phase: journey.phase,
        mentor_id: journey.mentor_id || 'guided',
        student_message: message || null,
        mentor_response: mentorResponse,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('[quest/mentor/POST] Error logging interaction:', logError);
    }

    return NextResponse.json({
      response: mentorResponse,
      interaction: interaction || { id: 'temp', journey_id: journeyId },
    });
  } catch (err) {
    console.error('[quest/mentor/POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
