/**
 * Open Studio Discovery Conversation API
 *
 * Guides students through a 5-step AI-mentored journey to discover their self-directed project:
 * 1. Strengths — "What are you naturally good at?"
 * 2. Interests — "What topics fascinate you?"
 * 3. Needs — "Who around you needs help? What's broken?"
 * 4. Narrowing — Examine top 3 ideas with feasibility check
 * 5. Commitment — Write a project statement + select archetype
 *
 * GET /api/student/open-studio/discovery?unitId={id}
 *   Returns: { profile: {...}, step: string, conversation: [...], isComplete: boolean }
 *
 * POST /api/student/open-studio/discovery
 *   Body: { unitId: string, message: string }
 *   Returns: { response: string, step: string, profile: {...}, isStepComplete: boolean, isDiscoveryComplete: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { logUsage } from "@/lib/usage-tracking";
import { rateLimit } from "@/lib/rate-limit";

// Rate limit: 10/min per student (generous for conversation)
const DISCOVERY_LIMITS = [
  { maxRequests: 10, windowMs: 60_000 },      // 10/min
  { maxRequests: 60, windowMs: 3_600_000 },    // 60/hour
];

type DiscoveryStep = "strengths" | "interests" | "needs" | "narrowing" | "commitment" | "complete";

interface DiscoveryProfile {
  id: string;
  student_id: string;
  unit_id: string;
  strengths: Array<{ area: string; description: string }>;
  interests: Array<{ topic: string; category: string }>;
  needs_identified: Array<{ need: string; context: string }>;
  project_statement: string | null;
  archetype: string | null;
  discovery_conversation: Array<{ role: string; content: string; step: string; timestamp: string }>;
  discovery_step: DiscoveryStep;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────
// System prompt builders
// ─────────────────────────────────────────────────

function buildDiscoverySystemPrompt(
  step: DiscoveryStep,
  profile: DiscoveryProfile,
  unitTopic?: string
): string {
  const basePrompt = `You are an Open Studio discovery mentor helping a student discover their self-directed project.

Your role is to help them explore WHO THEY ARE (strengths, interests, what they care about) before committing to a specific project.

RULES:
- Ask ONE question at a time
- Keep questions answerable in 2-3 sentences
- Be warm, curious, and encouraging — this is discovery, not interrogation
- NEVER suggest specific project ideas. Help the student discover their own.
- Reference what they've already shared to build continuity
- After 2-3 exchanges in a step, summarize what you've learned and suggest moving forward

${unitTopic ? `\nThis is within the context of: "${unitTopic}"` : ""}
`;

  switch (step) {
    case "strengths":
      return (
        basePrompt +
        `
## Current Step: Strengths
Help them identify natural talents and capabilities across multiple domains.

DOMAINS TO EXPLORE:
- Making/Building: "Are you good at building, designing, fixing things? Do you like working with your hands?"
- Organizing/Leading: "Do people look to you to organize things or make decisions?"
- Researching/Understanding: "Do you love digging into how things work or learning deeply?"
- Creating/Designing: "Do you enjoy creating art, music, writing, or designing things?"
- Connecting/Helping: "Are you good at listening, helping others solve problems, bringing people together?"

QUESTION APPROACH:
- Start with concrete, observable strengths ("What do friends ask you for help with?")
- Don't ask about grades or formal achievement — ask about natural ability
- Look for patterns ("You're good at X, you're also good at Y — is there a connection?")

If they've shared strengths already, reference them: "You mentioned you're good at [X]. Are there other areas where you're naturally strong?"
`
      );

    case "interests":
      return (
        basePrompt +
        `
## Current Step: Interests
Help them map what genuinely fascinates them.

INTEREST CATEGORIES:
- Technology/Digital: apps, coding, AI, robotics, digital design
- Sustainability/Environment: climate, renewable energy, conservation, ethical consumption
- Social Justice/Community: equity, human rights, local issues, helping vulnerable groups
- Arts/Culture: visual art, music, theatre, literature, cultural heritage
- Health/Sport: fitness, nutrition, mental health, disability access, sports
- Entrepreneurship/Business: starting ventures, creating value, solving problems at scale
- Other domains: what does their design challenge unit cover?

QUESTION APPROACH:
- "What topics do you find yourself reading about or watching videos on without being asked?"
- "If you could spend a day learning about anything, what would it be?"
- Cross-reference with their strengths: "You're good at [strength], and you're interested in [topic] — that's interesting. What's the connection?"
- Avoid judgment — all interests are valid

If they've shared interests already, help deepen: "You mentioned [interest]. What specifically about it draws you in?"
`
      );

    case "needs":
      return (
        basePrompt +
        `
## Current Step: Needs
Help them look outward — who around them needs help? What's broken or unfair?

This shifts from "me" to "others" and from "what I like" to "what matters."

SCOPES TO EXPLORE:
- Personal/Family: "Is there something in your home or family that frustrates you or feels unfair?"
- School/Classroom: "What problem do you see at school? What would make it better?"
- Community/Local: "What issue in your neighborhood or town bothers you?"
- Broader/Global: "Is there a bigger problem you care about?"
- Peer/Friends: "Do your friends face any challenges you could help solve?"

QUESTION APPROACH:
- Start with observation: "What's something you notice that doesn't work well?"
- Listen for passion: "You sound frustrated by [X] — tell me more about why that matters to you"
- Connect to strengths: "Given that you're good at [strength], could you help address this need using that ability?"

Avoid: "What do you think is wrong with the world?" — too broad. Go specific.
`
      );

    case "narrowing":
      return (
        basePrompt +
        `
## Current Step: Narrowing
Help them explore 3 potential project directions and test feasibility.

They've identified strengths, interests, and needs. Now examine TOP 3 IDEAS.

FEASIBILITY CHECK:
- TIME: "How long do you think this could realistically take?"
- RESOURCES: "What tools, materials, or help would you need?"
- ACCESS: "Do you have access to what you'd need? Or can you get it?"
- EXCITEMENT: "On a scale of 1-10, how excited are you about this?"

QUESTION APPROACH:
- For each idea: "Let's think through [IDEA] — what would you actually need to make this happen?"
- Probe constraints: "If you had only 2 weeks instead of 4, what would be the minimum version?"
- Look for the best fit: "Of your three ideas, which one could you start THIS WEEK?"

If ideas are vague, help sharpen: "You said [vague idea]. What would that actually LOOK like if you started on it?"
`
      );

    case "commitment":
      return (
        basePrompt +
        `
## Current Step: Commitment
Help them write a project statement and identify their project archetype.

They've narrowed to a top idea. Now commit.

PROJECT STATEMENT FORMAT:
"I want to [action] so that [impact/for whom]"
OR: "I want to create/design/build [what] to help [who] with [need]"

Examples:
- "I want to design a mobile app to help elderly people navigate public transport"
- "I want to research sustainable fashion brands and share findings with my school community"
- "I want to build a community garden to provide fresh food for neighbors and teach kids about growing"

ARCHETYPES (one primary):
- MAKE: Building/prototyping physical or digital things
- RESEARCH: Understanding a problem deeply through investigation
- LEAD: Organizing people, creating change, facilitating
- SERVE: Directly helping people, community-focused
- CREATE: Artistic or creative expression
- SOLVE: Problem-solving, innovation, systems thinking
- ENTREPRENEURSHIP: Creating sustainable value, business model

QUESTION APPROACH:
- Help them write: "So your project is about [topic]. In one sentence, what do you want to achieve?"
- Refine: "Who specifically are you trying to help or what are you trying to understand?"
- Identify archetype: "Of these 7 archetypes, which one feels closest to what you want to do?"
- Lock it in: "You've chosen [archetype] — does that fit what you described?"
`
      );

    default:
      return basePrompt;
  }
}

// ─────────────────────────────────────────────────
// Conversation flow logic
// ─────────────────────────────────────────────────

/**
 * Determine if a step is complete based on extracted data + AI judgment
 */
function isStepComplete(
  step: DiscoveryStep,
  profile: DiscoveryProfile,
  stepExchangeCount: number
): boolean {
  // Rules for auto-advancing based on data collected
  switch (step) {
    case "strengths":
      // Need at least 2 strength areas identified
      return profile.strengths.length >= 2 && stepExchangeCount >= 2;
    case "interests":
      // Need at least 2 interests identified
      return profile.interests.length >= 2 && stepExchangeCount >= 2;
    case "needs":
      // Need at least 1 need identified
      return profile.needs_identified.length >= 1 && stepExchangeCount >= 2;
    case "narrowing":
      // This step extracts top idea feasibility check
      return stepExchangeCount >= 3;
    case "commitment":
      // Complete when project_statement exists
      return !!profile.project_statement && !!profile.archetype;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────
// AI response parsing
// ─────────────────────────────────────────────────

/**
 * Parse AI response to extract structured data based on step
 */
function extractStructuredData(
  aiResponse: string,
  step: DiscoveryStep,
  profile: DiscoveryProfile
): Partial<DiscoveryProfile> {
  const updates: Partial<DiscoveryProfile> = {};

  // Try to parse JSON (AI should return JSON for structured steps)
  let parsed: any = null;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If JSON parsing fails, fall back to heuristic extraction below
  }

  switch (step) {
    case "strengths":
      if (parsed?.extracted?.strengths) {
        // AI returned structured strengths — merge with existing
        updates.strengths = [
          ...(profile.strengths || []),
          ...parsed.extracted.strengths.filter(
            (s: any) => !profile.strengths.some((ps) => ps.area === s.area)
          ),
        ];
      }
      // If no structured data, leave strengths as-is for next turn
      break;

    case "interests":
      if (parsed?.extracted?.interests) {
        updates.interests = [
          ...(profile.interests || []),
          ...parsed.extracted.interests.filter(
            (i: any) => !profile.interests.some((pi) => pi.topic === i.topic)
          ),
        ];
      }
      break;

    case "needs":
      if (parsed?.extracted?.needs) {
        updates.needs_identified = [
          ...(profile.needs_identified || []),
          ...parsed.extracted.needs.filter(
            (n: any) => !profile.needs_identified.some((pn) => pn.need === n.need)
          ),
        ];
      }
      break;

    case "narrowing":
      if (parsed?.extracted?.topIdea) {
        // Store top idea for next step (commitment)
        // We'll tag it in conversation for reference
      }
      break;

    case "commitment":
      if (parsed?.extracted?.projectStatement) {
        updates.project_statement = parsed.extracted.projectStatement;
      }
      if (parsed?.extracted?.archetype) {
        updates.archetype = parsed.extracted.archetype;
      }
      break;
  }

  return updates;
}

// ─────────────────────────────────────────────────
// API Handlers
// ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId is required" }, { status: 400 });
  }

  // Load or create discovery profile
  let { data: profile, error: profileError } = await supabase
    .from("open_studio_profiles")
    .select("*")
    .eq("student_id", session.student_id)
    .eq("unit_id", unitId)
    .single();

  // Handle table not existing (migration 031 not applied)
  if (profileError && (profileError.code === "42P01" || profileError.message?.includes("does not exist"))) {
    console.warn("[discovery] open_studio_profiles table does not exist yet (migration 031 not applied)");
    // Return a fallback profile shape so the UI doesn't crash
    return NextResponse.json({
      profile: {
        strengths: [],
        interests: [],
        needs_identified: [],
        project_statement: null,
        archetype: null,
        discovery_step: "strengths",
        completed_at: null,
        discovery_conversation: [{
          role: "ai",
          content: "Welcome to Open Studio! 🚀 The discovery system is being set up — please ask your teacher to check the database migration status.",
          step: "strengths",
          timestamp: new Date().toISOString(),
        }],
      },
      step: "strengths",
      conversation: [{
        role: "ai",
        content: "Welcome to Open Studio! 🚀 The discovery system is being set up — please ask your teacher to check the database migration status.",
        step: "strengths",
        timestamp: new Date().toISOString(),
      }],
      isComplete: false,
    });
  }

  if (!profile) {
    // Create new profile with initial AI greeting
    const initialGreeting = {
      role: "ai",
      content: "Welcome to Open Studio! 🚀 This is YOUR space to pursue a self-directed project.\n\nBefore we dive in, I want to help you discover what you're naturally drawn to. We'll explore your strengths, interests, and the needs you see around you — then narrow it all down into a project that's uniquely yours.\n\nLet's start with your strengths. What are you naturally good at? Think about what friends ask you for help with, or what comes easily to you that others find hard.",
      step: "strengths",
      timestamp: new Date().toISOString(),
    };

    const { data: newProfile, error } = await supabase
      .from("open_studio_profiles")
      .insert({
        student_id: session.student_id,
        unit_id: unitId,
        discovery_step: "strengths",
        discovery_conversation: [initialGreeting],
      })
      .select()
      .single();

    if (error) {
      console.error("[discovery] Error creating profile:", error);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    profile = newProfile;
  }

  return NextResponse.json({
    profile,
    step: profile.discovery_step,
    conversation: profile.discovery_conversation || [],
    isComplete: profile.discovery_step === "complete",
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const studentId = session.student_id;

  // Rate limit
  const { allowed } = rateLimit(`discovery:${studentId}`, DISCOVERY_LIMITS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages. Take a moment to reflect." },
      { status: 429 }
    );
  }

  const body = (await request.json()) as { unitId: string; message: string };
  const { unitId, message } = body;

  if (!unitId || !message?.trim()) {
    return NextResponse.json(
      { error: "unitId and message are required" },
      { status: 400 }
    );
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI not configured" },
      { status: 503 }
    );
  }

  try {
    // Load profile
    let { data: profile } = await supabase
      .from("open_studio_profiles")
      .select("*")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .single();

    if (!profile) {
      // Create new profile
      const { data: newProfile } = await supabase
        .from("open_studio_profiles")
        .insert({
          student_id: studentId,
          unit_id: unitId,
          discovery_step: "strengths",
          discovery_conversation: [],
        })
        .select()
        .single();
      profile = newProfile;
    }

    const currentStep = profile.discovery_step as DiscoveryStep;

    // If already complete, don't accept more messages
    if (currentStep === "complete") {
      return NextResponse.json(
        { error: "Discovery is already complete" },
        { status: 400 }
      );
    }

    // Get unit context
    const { data: unit } = await supabase
      .from("units")
      .select("title, topic")
      .eq("id", unitId)
      .single();

    // Build system prompt
    const systemPrompt = buildDiscoverySystemPrompt(
      currentStep,
      profile as DiscoveryProfile,
      unit?.topic || unit?.title
    );

    // Build conversation history — include last N turns for context
    const conversationHistory = (profile.discovery_conversation || []) as Array<{
      role: string;
      content: string;
      step: string;
    }>;

    // Limit to last 6 messages to avoid token explosion
    const recentHistory = conversationHistory.slice(-6);

    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      recentHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Add new user message
    messages.push({ role: "user", content: message.trim() });

    // Call AI
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Extract response text
    let aiReply = "I'd like to hear more about that.";
    if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find(
        (block: { type: string; text?: string }) => block.type === "text"
      );
      aiReply = textBlock?.text || aiReply;
    }

    // Extract structured data from AI response
    const extractedUpdates = extractStructuredData(
      aiReply,
      currentStep,
      profile as DiscoveryProfile
    );

    // Count this step's exchanges
    const stepExchanges =
      conversationHistory.filter((msg) => msg.step === currentStep).length / 2 ||
      0;

    // Determine if step is complete
    const updatedProfile = {
      ...(profile as DiscoveryProfile),
      ...extractedUpdates,
    };
    const stepIsComplete = isStepComplete(currentStep, updatedProfile, stepExchanges + 1);

    // Build updated conversation
    const updatedConversation = [
      ...conversationHistory,
      {
        role: "user",
        content: message.trim(),
        step: currentStep,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: aiReply,
        step: currentStep,
        timestamp: new Date().toISOString(),
      },
    ];

    // Determine next step
    let nextStep = currentStep;
    let discoveryComplete = false;

    if (stepIsComplete) {
      const stepSequence: DiscoveryStep[] = [
        "strengths",
        "interests",
        "needs",
        "narrowing",
        "commitment",
        "complete",
      ];
      const currentIndex = stepSequence.indexOf(currentStep);
      nextStep = stepSequence[currentIndex + 1] || "complete";

      if (nextStep === "complete") {
        discoveryComplete = true;
        updatedProfile.completed_at = new Date().toISOString();
      }
    }

    // Persist updates
    const { error: updateError } = await supabase
      .from("open_studio_profiles")
      .update({
        ...extractedUpdates,
        discovery_conversation: updatedConversation,
        discovery_step: stepIsComplete ? nextStep : currentStep,
        completed_at: updatedProfile.completed_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId)
      .eq("unit_id", unitId);

    if (updateError) {
      console.error("[discovery] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save progress" },
        { status: 500 }
      );
    }

    // Log usage
    logUsage({
      endpoint: "open-studio-discovery",
      model: "claude-haiku-4-5-20251001",
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      metadata: { step: currentStep, stepComplete: stepIsComplete },
    });

    return NextResponse.json({
      response: aiReply,
      step: stepIsComplete ? nextStep : currentStep,
      profile: updatedProfile,
      isStepComplete: stepIsComplete,
      isDiscoveryComplete: discoveryComplete,
    });
  } catch (err) {
    console.error("[discovery] Error:", err);
    return NextResponse.json(
      { error: "Discovery conversation failed" },
      { status: 500 }
    );
  }
}
