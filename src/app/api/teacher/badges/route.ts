import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import type { BadgeDefinition } from "@/lib/safety/types";
import type { Badge, QuestionPoolItem, LearningCard } from "@/types";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

/**
 * GET /api/teacher/badges
 *
 * List all badges (built-in + teacher's own).
 * Optional query params:
 *   - ?category=safety|skill|software
 *
 * Returns badges sorted by tier (ascending) then name.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params
    const url = new URL(request.url);
    const category = url.searchParams.get("category");

    // Use admin client for read access
    const admin = createAdminClient();

    // Build query
    let query = admin.from("badges").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query.order("tier", { ascending: true }).order("name", { ascending: true });

    if (error) {
      console.error("[badges/GET] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
    }

    return NextResponse.json({ badges: data || [] });
  } catch (error) {
    console.error("[badges/GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/teacher/badges
 *
 * Create a new teacher-owned badge.
 *
 * Body: {
 *   name: string,
 *   slug: string,
 *   description: string,
 *   category: 'safety'|'skill'|'software',
 *   tier: 1-4,
 *   icon_name: string,
 *   color: string,
 *   pass_threshold: number (0-100),
 *   expiry_months: number,
 *   retake_cooldown_minutes: number,
 *   topics: string[],
 *   learn_content: LearnCard[],
 *   question_pool: BadgeQuestion[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      name,
      slug,
      description,
      category,
      tier,
      icon_name,
      color,
      pass_threshold,
      expiry_months,
      retake_cooldown_minutes,
      topics,
      learn_content,
      question_pool,
    } = body;

    // Validate required fields
    if (
      !name ||
      !slug ||
      !description ||
      !category ||
      tier === undefined ||
      !icon_name ||
      !color ||
      pass_threshold === undefined ||
      expiry_months === undefined ||
      retake_cooldown_minutes === undefined ||
      !Array.isArray(topics) ||
      !Array.isArray(learn_content) ||
      !Array.isArray(question_pool)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // Use admin client for write access
    const admin = createAdminClient();

    const badgeId = nanoid(12);
    const question_count = question_pool.length;

    const { data, error } = await admin
      .from("badges")
      .insert([
        {
          id: badgeId,
          name,
          slug,
          description,
          category,
          tier,
          icon_name,
          color,
          is_built_in: false,
          created_by_teacher_id: user.id,
          pass_threshold,
          expiry_months,
          retake_cooldown_minutes,
          question_count,
          topics,
          learn_content,
          question_pool,
        },
      ])
      .select();

    if (error) {
      console.error("[badges/POST] Insert error:", error);
      return NextResponse.json({ error: "Failed to create badge" }, { status: 500 });
    }

    return NextResponse.json({ badge: data[0] }, { status: 201 });
  } catch (error) {
    console.error("[badges/POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/teacher/badges/seed
 *
 * Seeds the database with built-in safety badges (only if none exist).
 * This is called via a button on the teacher safety badges listing page.
 *
 * Body: { action: "seed" }
 * Response: { created: number, message: string } or existing badges warning
 */
const BUILT_IN_BADGES: Array<
  Omit<Badge, "created_at" | "updated_at"> & { id?: string }
> = [
  {
    id: "workshop-safety-101",
    slug: "workshop-safety-101",
    name: "Workshop Safety Fundamentals",
    description: "Master the basics of woodwork and metalwork safety protocols",
    category: "safety",
    tier: 1,
    icon_name: "🛡️",
    color: "#10b981",
    is_built_in: true,
    created_by_teacher_id: null,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 10,
    question_count: 10,
    question_pool: [
      {
        id: "q1",
        text: "When must you wear safety goggles in the workshop?",
        type: "multiple_choice",
        options: [
          "Only when cutting",
          "Only when using power tools",
          "At all times in the workshop",
          "Only if you're injured",
        ],
        correct_answer: 2,
      },
      {
        id: "q2",
        text: "What should you do if you see a spill on the workshop floor?",
        type: "multiple_choice",
        options: [
          "Step over it",
          "Report it but don't clean it",
          "Clean it up immediately",
          "Ignore it",
        ],
        correct_answer: 2,
      },
      {
        id: "q3",
        text: "Before using a power tool, what is the first step?",
        type: "multiple_choice",
        options: [
          "Read the manual",
          "Ask a friend",
          "Just start using it",
          "Watch a video",
        ],
        correct_answer: 0,
      },
      {
        id: "q4",
        text: "Long hair should be tied back in the workshop",
        type: "true_false",
        options: ["True", "False"],
        correct_answer: 0,
      },
      {
        id: "q5",
        text: "What is the correct way to lift a heavy object?",
        type: "multiple_choice",
        options: [
          "Bend at the waist",
          "Bend at the knees and keep your back straight",
          "Use your arms only",
          "Get someone else to do it",
        ],
        correct_answer: 1,
      },
      {
        id: "q6",
        text: "When should emergency contact information be posted?",
        type: "multiple_choice",
        options: [
          "Only on the door",
          "In clearly visible locations",
          "In the first aid kit only",
          "It doesn't need to be posted",
        ],
        correct_answer: 1,
      },
      {
        id: "q7",
        text: "What do you do if you feel faint or dizzy in the workshop?",
        type: "multiple_choice",
        options: [
          "Keep working",
          "Go outside for fresh air",
          "Tell an adult immediately",
          "Sit down and rest",
        ],
        correct_answer: 2,
      },
      {
        id: "q8",
        text: "Loose clothing can get caught in machinery",
        type: "true_false",
        options: ["True", "False"],
        correct_answer: 0,
      },
      {
        id: "q9",
        text: "What is the first thing to do after an accident?",
        type: "multiple_choice",
        options: [
          "Continue working",
          "Tell the teacher/supervisor",
          "Clean up the mess",
          "Go home",
        ],
        correct_answer: 1,
      },
      {
        id: "q10",
        text: "How should you dispose of hazardous materials?",
        type: "multiple_choice",
        options: [
          "In the regular trash",
          "Down the drain",
          "In the designated container",
          "Leave it on the bench",
        ],
        correct_answer: 2,
      },
    ] as QuestionPoolItem[],
    learn_content: [
      {
        id: "card1",
        title: "Personal Protective Equipment (PPE)",
        description:
          "Learn about the essential safety gear required in any workshop",
        icon: "🥽",
        tips: [
          "Always wear goggles when instructed",
          "Check equipment before each use",
          "Replace damaged PPE immediately",
        ],
        examples: [
          "Safety goggles protect eyes from flying debris",
          "Work gloves prevent splinters and cuts",
          "Steel-toed boots protect feet from heavy objects",
        ],
      },
      {
        id: "card2",
        title: "Tool Safety",
        description: "Understanding how to use tools safely and responsibly",
        icon: "🔨",
        tips: [
          "Read all instruction manuals first",
          "Inspect tools before use",
          "Store tools properly after use",
        ],
        examples: [
          "Keep hands away from rotating parts",
          "Never leave running machinery unattended",
          "Tie back long hair when using power tools",
        ],
      },
      {
        id: "card3",
        title: "Emergency Procedures",
        description: "Know what to do in case of an accident or emergency",
        icon: "🚑",
        tips: [
          "Know the location of first aid kits",
          "Know the emergency evacuation route",
          "Report accidents immediately",
        ],
        examples: [
          "Call for help if someone is injured",
          "Use the emergency stop button if needed",
          "Know how to turn off the power in emergencies",
        ],
      },
    ] as LearningCard[],
    topics: ["workshop", "safety", "fundamentals"],
  },
  {
    id: "laser-cutter-safety",
    slug: "laser-cutter-safety",
    name: "Laser Cutter Safety",
    description:
      "Specialized training for safe operation of laser cutting equipment",
    category: "safety",
    tier: 2,
    icon_name: "⚡",
    color: "#f59e0b",
    is_built_in: true,
    created_by_teacher_id: null,
    pass_threshold: 85,
    expiry_months: 6,
    retake_cooldown_minutes: 15,
    question_count: 8,
    question_pool: [
      {
        id: "q1",
        text: "What should you check before using the laser cutter?",
        type: "multiple_choice",
        options: [
          "Air filter status and alignment",
          "The color of the lens",
          "How long it was last used",
          "The temperature of the room",
        ],
        correct_answer: 0,
      },
      {
        id: "q2",
        text: "Never leave a laser cutter running unattended",
        type: "true_false",
        options: ["True", "False"],
        correct_answer: 0,
      },
      {
        id: "q3",
        text: "What happens if you look directly into the laser beam?",
        type: "multiple_choice",
        options: [
          "Nothing, it's safe",
          "It can cause permanent eye damage",
          "It only hurts if you're directly in front",
          "It just feels warm",
        ],
        correct_answer: 1,
      },
      {
        id: "q4",
        text: "Materials that are safe to laser cut include:",
        type: "multiple_choice",
        options: [
          "Vinyl and PVC",
          "Wood and acrylic",
          "Fiberglass and polyester",
          "Carbon fiber",
        ],
        correct_answer: 1,
      },
      {
        id: "q5",
        text: "What is the proper ventilation requirement for laser cutters?",
        type: "multiple_choice",
        options: [
          "No ventilation needed",
          "Open a window",
          "Use proper extraction and filtration",
          "Just use a fan",
        ],
        correct_answer: 2,
      },
      {
        id: "q6",
        text: "If a fire starts inside the laser cutter, what should you do?",
        type: "multiple_choice",
        options: [
          "Use the emergency stop and water",
          "Keep the lid closed and turn it off",
          "Close the lid and let it cool",
          "Call a specialist",
        ],
        correct_answer: 1,
      },
      {
        id: "q7",
        text: "How often should laser cutter lenses be cleaned?",
        type: "multiple_choice",
        options: [
          "Monthly",
          "Only when dirty",
          "Weekly",
          "Never, maintenance staff handle it",
        ],
        correct_answer: 1,
      },
      {
        id: "q8",
        text: "What should you wear when operating a laser cutter?",
        type: "multiple_choice",
        options: [
          "Just regular clothes",
          "Closed-toe shoes and no loose fabrics",
          "A full hazmat suit",
          "Jewelry is optional",
        ],
        correct_answer: 1,
      },
    ] as QuestionPoolItem[],
    learn_content: [
      {
        id: "card1",
        title: "Laser Technology Basics",
        description: "Understanding how laser cutters work and their hazards",
        icon: "🔦",
        tips: [
          "Know the power output of your machine",
          "Understand beam path and safety zones",
          "Always wear appropriate PPE",
        ],
        examples: [
          "CO2 lasers are commonly used for wood and acrylic",
          "The beam cannot be seen but can cause instant burns",
        ],
      },
      {
        id: "card2",
        title: "Material Safety",
        description: "Which materials are safe and unsafe to cut",
        icon: "📋",
        tips: [
          "Check material compatibility before cutting",
          "Avoid PVC and vinyl which release toxic gases",
          "Test materials on scrap first if unsure",
        ],
        examples: [
          "Wood and acrylic cut cleanly",
          "Some plastics release dioxins when laser cut",
        ],
      },
    ] as LearningCard[],
    topics: ["laser", "equipment", "safety"],
  },
  {
    id: "3d-printer-basics",
    slug: "3d-printer-basics",
    name: "3D Printer Fundamentals",
    description: "Learn safe operation of FDM and resin 3D printers",
    category: "skill",
    tier: 1,
    icon_name: "🖨️",
    color: "#8b5cf6",
    is_built_in: true,
    created_by_teacher_id: null,
    pass_threshold: 75,
    expiry_months: null,
    retake_cooldown_minutes: 10,
    question_count: 8,
    question_pool: [
      {
        id: "q1",
        text: "What does FDM stand for in 3D printing?",
        type: "multiple_choice",
        options: [
          "Fused Deposition Modeling",
          "Fast Digital Manufacturing",
          "Flexible Design Method",
          "Film Density Measurement",
        ],
        correct_answer: 0,
      },
      {
        id: "q2",
        text: "Common materials for FDM printing include:",
        type: "multiple_choice",
        options: [
          "PLA and ABS",
          "Steel and aluminum",
          "Wood and paper",
          "Glass and ceramic",
        ],
        correct_answer: 0,
      },
      {
        id: "q3",
        text: "What should you do if the print fails mid-way?",
        type: "multiple_choice",
        options: [
          "Restart immediately",
          "Let it finish",
          "Stop the printer and remove the model",
          "Add more material",
        ],
        correct_answer: 2,
      },
      {
        id: "q4",
        text: "How should you remove a print from the print bed?",
        type: "multiple_choice",
        options: [
          "Pull it off quickly",
          "Let it cool first, then gently remove it",
          "Use a hammer",
          "Peel it while hot",
        ],
        correct_answer: 1,
      },
      {
        id: "q5",
        text: "Print bed temperature affects print quality",
        type: "true_false",
        options: ["True", "False"],
        correct_answer: 0,
      },
      {
        id: "q6",
        text: "What is the purpose of a support structure in 3D printing?",
        type: "multiple_choice",
        options: [
          "Make the print stronger",
          "Hold overhanging parts in place",
          "Reduce printing time",
          "Change the color",
        ],
        correct_answer: 1,
      },
      {
        id: "q7",
        text: "How long should you wait before handling a freshly printed part?",
        type: "multiple_choice",
        options: [
          "Immediately",
          "1 minute",
          "Several minutes to cool down",
          "24 hours",
        ],
        correct_answer: 2,
      },
      {
        id: "q8",
        text: "What does slicing mean in 3D printing context?",
        type: "multiple_choice",
        options: [
          "Cutting the model with a knife",
          "Converting a 3D model into printer instructions",
          "Dividing the model into pieces",
          "Removing support material",
        ],
        correct_answer: 1,
      },
    ] as QuestionPoolItem[],
    learn_content: [
      {
        id: "card1",
        title: "FDM Printing Process",
        description: "How Fused Deposition Modeling works step by step",
        icon: "🌡️",
        tips: [
          "Maintain consistent bed temperature",
          "Use proper nozzle temperature for material",
          "Ensure good bed adhesion",
        ],
        examples: [
          "PLA typically prints at 200-220°C",
          "ABS requires 220-250°C for best results",
        ],
      },
      {
        id: "card2",
        title: "Design for 3D Printing",
        description: "Creating models that print successfully",
        icon: "📐",
        tips: [
          "Avoid thin walls",
          "Use supports for overhangs",
          "Check wall thickness before printing",
        ],
        examples: [
          "Minimum wall thickness is usually 0.8mm",
          "Overhangs at steep angles need support",
        ],
      },
    ] as LearningCard[],
    topics: ["3d-printing", "prototyping", "manufacturing"],
  },
];

export async function POST_SEED(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);

    // Verify teacher is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if any built-in badges already exist
    const { count, error: countError } = await admin
      .from("badges")
      .select("id", { count: "exact" })
      .eq("is_built_in", true);

    if (countError) {
      console.error("[badges/seed] Count error:", countError);
      return NextResponse.json({ error: "Failed to check existing badges" }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json(
        { message: "Built-in badges already exist", created: 0 },
        { status: 200 }
      );
    }

    // Insert built-in badges
    const badgesToInsert = BUILT_IN_BADGES.map((badge) => ({
      ...badge,
      id: badge.id || nanoid(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await admin.from("badges").insert(badgesToInsert);

    if (insertError) {
      console.error("[badges/seed] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to seed badges" }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Built-in badges seeded successfully", created: badgesToInsert.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("[badges/seed] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
