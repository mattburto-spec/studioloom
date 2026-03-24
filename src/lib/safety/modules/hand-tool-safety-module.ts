/**
 * Hand Tool Safety Learning Module
 *
 * Covers safe use of hand tools in design workshops: selection, carrying, clamping,
 * cutting direction, maintenance, and storage.
 *
 * Learning flow:
 * 1. Engage: Introduction + scenario-based decision making
 * 2. Inform: Key concepts on tool selection, carrying, clamping, cutting
 * 3. Apply: Before/after comparisons and realistic failure scenarios
 * 4. Verify: Comprehension checks throughout, final summary
 *
 * Total estimated time: 12 minutes
 */

import type {
  LearningModule,
  KeyConceptBlock,
  ScenarioBlock,
  ComprehensionCheckBlock,
  BeforeAfterBlock,
  MicroStoryBlock,
  StepByStepBlock,
} from "../content-blocks";

export const HAND_TOOL_MODULE: LearningModule = {
  badge_id: "hand-tool-safety",
  learning_objectives: [
    "Select the correct tool for the job",
    "Carry hand tools safely (points down, close to body)",
    "Clamp work securely before cutting or shaping",
    "Cut away from your body and fingers",
    "Maintain sharp edges and identify dull tools",
    "Store tools safely and keep workspace organized",
    "Recognize and prevent hand tool injuries",
  ],
  estimated_minutes: 12,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Engagement
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-intro-01",
      title: "Hand Tools: Precision Requires Care",
      icon: "🔨",
      content:
        "Hand tools are the foundation of workshop work. A chisel, saw, knife, file, or hammer can create incredible designs—or cause serious injuries if used incorrectly.\n\n" +
        "This module takes about **12 minutes** and covers:\n" +
        "- How to choose the right tool\n" +
        "- How to carry tools safely\n" +
        "- Why clamping is non-negotiable\n" +
        "- The golden rule: cut away from yourself\n" +
        "- Why sharp tools are safer than dull ones\n" +
        "- How to store tools so they don't cause accidents\n\n" +
        "**Why this matters:** Hand tool injuries are common—cuts, punctures, smashed fingers, eye injuries from flying splinters. But they're 100% preventable if you follow basic rules.",
      tips: [
        "Pay attention to the scenarios—they're based on real workshop situations",
        "If you've had a hand tool injury before, think about how following these rules would have prevented it",
        "Hand tools are partners in your design work—treat them with respect",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Scenario - Choosing the Right Tool
    // ========================================================================
    {
      type: "scenario",
      id: "hts-scenario-tool-choice-01",
      title: "You Need to Cut a Curve in Plywood",
      setup:
        "You're cutting a curved shape for a project. The curve has tight radius turns. You look at the tool rack and see: a handsaw (straight cuts only), a coping saw (curves and holes), and a circular saw (power tool). Your teacher is helping someone else. What do you use?",
      branches: [
        {
          id: "hts-sc-01-a",
          choice_text: "Use the handsaw—I've used it before",
          is_correct: false,
          feedback:
            "Handsaw won't work—it's designed for straight cuts only. Trying to force curves with a handsaw will break the blade and create ragged edges.",
          consequence:
            "You waste time, produce poor-quality work, and risk damage to the tool.",
        },
        {
          id: "hts-sc-01-b",
          choice_text: "Use the coping saw—it's designed for curves",
          is_correct: true,
          feedback:
            "✓ Correct! The coping saw (thin blade in a C-shaped frame) is designed specifically for curves and tight turns. This is the right tool. Using the right tool = better cuts, safer work, less effort.",
          consequence:
            "Your curve is smooth, the tool handles the work perfectly, and you finish faster.",
        },
        {
          id: "hts-sc-01-c",
          choice_text: "Use the circular saw since it's faster",
          is_correct: false,
          feedback:
            "Circular saws are for straight cuts. Using one for curves is dangerous—the blade can bind and kick back. Always match the tool to the job, not the speed.",
          consequence:
            "Risk of kickback, poor cut quality, and potential injury.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 3: Tool Selection Concept
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-selection-01",
      title: "Choosing the Right Tool for the Job",
      icon: "🎯",
      content:
        "Using the wrong tool wastes time, damages materials, breaks tools, and creates safety hazards. The right tool does the job efficiently and safely.\n\n" +
        "**Key Tool Selection Rules:**\n\n" +
        "**Saws** — Match the blade to the cut type\n" +
        "- Handsaw: straight cuts in solid wood\n" +
        "- Coping saw: curves, tight radius turns, interior holes\n" +
        "- Hacksaw: metal, plastic tubing (fine teeth, slow)\n" +
        "- Jewelers saw: thin materials, delicate work\n\n" +
        "**Cutting Tools** — Match the sharpness and angle to material\n" +
        "- Sharp utility knife: thin materials (paper, card, thin plastic)\n" +
        "- Chisel: wood carving, mortises (never on metal—dulls instantly)\n" +
        "- File: smoothing edges, shaping metal (pressure on the stroke, not the return)\n\n" +
        "**Striking Tools** — Match weight to the material and task\n" +
        "- Hammer (500g): general carpentry, fastening\n" +
        "- Mallet (wood or rubber): soft strike without denting (chisels, joints)\n" +
        "- Mallet (metal): metalwork, avoiding tool damage\n\n" +
        "**Never improvise.** Don't use a hammer as a chisel, a screwdriver as a pry bar, or a wrench as a hammer. Improvisation breaks tools and creates safety hazards.",
      tips: [
        "Before you start, ask: 'What tool is designed for this job?'",
        "If you don't recognize a tool, ask your teacher",
        "The right tool always feels right in your hand—weight, balance, control are obvious",
      ],
      warning:
        "Using a tool for a job it's not designed for will either break the tool, damage your work, or cause injury. There's always a better tool—find it.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Carrying Tools Safely
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-carrying-01",
      title: "Carrying Hand Tools Safely",
      icon: "🚶",
      content:
        "How you carry tools matters as much as how you use them. A dropped tool can injure your foot or someone else's. A tool carried carelessly can slash a classmate.\n\n" +
        "**The Golden Rules for Carrying:**\n\n" +
        "**Points & Edges DOWN, AWAY from your body**\n" +
        "Never carry a saw, chisel, knife, or file blade pointing up at your chest or toward your face. If you trip, the blade goes down (into the ground), not into you.\n\n" +
        "**Close to your body**\n" +
        "Don't swing tools around as you walk. Keep them tight to your side. This gives you control and prevents accidentally hitting someone.\n\n" +
        "**One at a time**\n" +
        "Carry one tool per hand. Never clench multiple tools in one hand—you lose control and can't grab something to catch yourself if you trip.\n\n" +
        "**Two hands if heavy**\n" +
        "Heavy hammers, mallets, or manual clamps should be carried with both hands. One hand is for the tool, the other is free for balance.\n\n" +
        "**Lower than waist level**\n" +
        "If you carry a tool at chest/face height, any trip becomes a facial injury. Carry tools below waist height so a fall drops them away from your face.\n\n" +
        "**Sheathed or covered**\n" +
        "If moving sharp tools across the workshop, use tool sheaths or scrap wood to cover blades.",
      tips: [
        "Practice carrying tools before you need to use them",
        "If you feel awkward, you're probably doing it right (hyper-aware of safety)",
        "Never carry tools and chat—give full attention to the tool",
      ],
      warning:
        "A dropped tool can cause foot injuries or crush toes. A tool carried high can injure your face or a classmate's. Always carry with intention.",
      image: "/images/safety/hand-tools-carrying.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Clamping Work
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-clamping-01",
      title: "Clamping: Never Hold Work in Your Hands",
      icon: "🔗",
      content:
        "The #1 cause of hand tool injuries: holding work in your hand while cutting. The moment a tool slips, your hand gets cut or crushed.\n\n" +
        "**Why clamping is non-negotiable:**\n" +
        "- Your hand is NOT a clamp. Hands slip, muscles get tired, reflexes don't work fast enough.\n" +
        "- A chisel can split wood suddenly, throwing your hands around.\n" +
        "- A saw blade can bind, jerking your hand toward it.\n" +
        "- If you're injured, you can't release—your hand is trapped.\n\n" +
        "**What clamping looks like:**\n" +
        "- **Bench vise:** Heavy work (filing metal, chiseling). The vise holds rock-solid.\n" +
        "- **C-clamps:** Temporary hold (clamping to a bench). One screw applies heavy pressure.\n" +
        "- **Bar clamps:** Long material (wood strips, pipes). Position clamp and tighten completely before cutting.\n" +
        "- **Hand screw (wooden clamp):** Delicate materials like veneers (won't marr). Two screws for parallel pressure.\n\n" +
        "**Clamping technique:**\n" +
        "1. Clamp to a bench or solid surface, NOT to yourself\n" +
        "2. Tighten enough so work doesn't move—firm, not crushing\n" +
        "3. Check clamp position: cutting tool should NOT hit the clamp\n" +
        "4. Use two clamps if the work is long (prevents rotation)\n" +
        "5. Never adjust clamp while cutting—always STOP first, then adjust",
      tips: [
        "If you're tempted to hold work in your hand, that's the signal to find a clamp",
        "Ask your teacher to show you the right clamp for your material",
        "Secure clamps firmly—loose work is the #2 cause of injuries",
      ],
      warning:
        "One second of not paying attention while your hand is the clamp = stitches. Clamps take 10 seconds to set up. Always clamp.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Cutting Direction & Body Position
    // ========================================================================
    {
      type: "step_by_step",
      id: "hts-cutting-steps-01",
      title: "The Safe Cutting Position",
      steps: [
        {
          number: 1,
          instruction:
            "**Clamp the work** to a bench or vise. Never hold it in your hands. Check that the clamp is tight and work can't slip.",
          checkpoint:
            "Work is locked in place and can't move unexpectedly.",
        },
        {
          number: 2,
          instruction:
            "**Position your body to the side** of the cutting line. Never position yourself in line with the tool—if the tool slips, it should miss you.",
          checkpoint:
            "If a saw binds or a chisel slips, it travels away from your body.",
        },
        {
          number: 3,
          instruction:
            "**Position the tool so the cutting direction is AWAY from your body.** For example: saw cuts away and down, chisel chops away from your hand, utility knife blade pulls AWAY from your fingertips.",
          checkpoint:
            "If the tool releases unexpectedly, it travels away, not toward you.",
        },
        {
          number: 4,
          instruction:
            "**Keep fingers & thumbs AWAY from the blade path.** A classic mistake: pressing down on work with one hand while cutting with the other. Your fingers are in line with the blade.",
          warning:
            "Guide hands stay above the blade, out of the cut line. Never wrap fingers around work where a blade could meet them.",
        },
        {
          number: 5,
          instruction:
            "**Use steady, controlled strokes.** Fast, jerky movements cause slips. Saws should have a rhythm. Chisels should be tapped gently with a mallet, not whacked.",
          image: "/images/safety/hand-tools-cutting-position.png",
        },
        {
          number: 6,
          instruction:
            "**If the tool binds or gets stuck, STOP immediately.** Release pressure, pull the tool free, and assess what happened. Don't force it.",
          checkpoint:
            "A bound saw or chisel is a safety emergency. Stop, assess, continue carefully.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 7: Check Cutting Position Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "hts-cutting-check-01",
      question: "While cutting a curve with a coping saw, your friend holds the wood in one hand while sawing with the other. What's the problem?",
      options: [
        "It's fine as long as they're careful",
        "The saw blade could slip and cut their hand",
        "It's not a problem—that's normal",
        "They're just wasting time with a clamp",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! No matter how careful someone is, a saw blade can slip. If their hand is the clamp, their hand is the injury target. Always use an actual clamp.",
      feedback_wrong:
        "Not quite. Hand tool injuries happen in seconds. The moment a blade slips or binds, an unclammed hand is at risk. A clamp takes 10 seconds to set up.",
      hint: "What happens if the saw blade suddenly binds?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 8: Sharp vs Dull Tools
    // ========================================================================
    {
      type: "before_after",
      id: "hts-sharp-ba-01",
      title: "Sharp Tools vs Dull Tools: Which is Safer?",
      before: {
        caption: "DANGEROUS: Dull saw blade requires excessive pressure",
        hazards: [
          "Dull blade requires heavy force to cut",
          "Pressure causes tool to slip or jump",
          "Student overexerts, loses control",
          "Blade binds and jerks unexpectedly",
          "Excessive force = increased injury risk",
        ],
        image: "/images/safety/hand-tools-dull.png",
      },
      after: {
        caption: "SAFE: Sharp blade cuts easily with light pressure",
        principles: [
          "Sharp blade glides through material smoothly",
          "Light, steady pressure—no forcing",
          "Tool stays in control at all times",
          "Minimal slipping or binding",
          "Smooth cuts, safer work",
        ],
        image: "/images/safety/hand-tools-sharp.png",
      },
      key_difference:
        "Dull tools are MORE dangerous, not safer. They require force, slip, and bind. Sharp tools are precise and predictable. Always use sharp tools—ask your teacher to sharpen or replace a dull one immediately.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 9: Maintenance & Sharpness Check
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-maintenance-01",
      title: "Tool Maintenance: Keep Edges Sharp & Clean",
      icon: "✨",
      content:
        "Maintaining tools keeps them safe and effective.\n\n" +
        "**How to check if a blade is sharp:**\n" +
        "- **Paper test:** A sharp blade cuts clean paper with minimal pressure. A dull blade tears or crushes the paper.\n" +
        "- **Wood test:** A sharp chisel cuts and curls wood shavings. A dull chisel crushes and splinters.\n" +
        "- **Visual:** Look at the edge in light. A sharp edge has no light reflection. A dull edge reflects light (you see a bright line).\n\n" +
        "**How to keep tools sharp:**\n" +
        "- **Don't cut metal with a wood chisel.** Metal is 10× harder than wood. One cut on a metal object dulls a wood chisel permanently.\n" +
        "- **Don't cut on bench tops.** If you rest your work on a bench and cut through it, your blade hits the steel bench. Instant dulling.\n" +
        "- **Always use a cutting mat or wood block under your work.**\n" +
        "- **Wipe blades after use.** Sawdust, adhesive, and rust dull edges. A clean blade stays sharp longer.\n" +
        "- **Store blades protected.** A blade banging against other tools dulls instantly. Use sheaths or scrap wood covers.\n\n" +
        "**When a tool is dull:**\n" +
        "- Don't try to sharpen it yourself (unless trained)—improper sharpening creates safety hazards\n" +
        "- Report it to your teacher: 'This saw is dull'\n" +
        "- Use a sharp replacement while the dull tool is being sharpened",
      tips: [
        "Do the paper test on any tool you're unsure about—takes 3 seconds",
        "Your teacher would rather sharpen 10 dull chisels than deal with a cut finger",
        "Sharp tools feel good in your hand—you'll notice the difference immediately",
      ],
      warning:
        "A dull tool is MORE dangerous than a sharp one. Never use a dull blade because you want to finish 'just one more cut.' Stop, swap the tool, and move on.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 10: Storage & Workshop Organization
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-storage-01",
      title: "Storing Hand Tools Safely",
      icon: "📦",
      content:
        "How you store tools affects everyone's safety. A tool left on a bench or the floor is a trip hazard and a cut hazard.\n\n" +
        "**Storage rules:**\n\n" +
        "**Tool racks & wall mounts**\n" +
        "Tools hang in designated spots. Everyone knows where to find them and where to put them back. This is the ideal system.\n\n" +
        "**Tool boxes**\n" +
        "Tools in a box with a lid. Chisels & knives go blade-down in foam or with blade guards. Saws hang from handles. Everything visible at a glance.\n\n" +
        "**Bench storage (during active work)**\n" +
        "If you're actively using tools, keep them in a small cluster on your bench. When you finish a task, put them away immediately. Don't leave tools scattered.\n\n" +
        "**NEVER store:**\n" +
        "- On the floor (trip hazard, step on them)\n" +
        "- Under benches (hidden, hard to retrieve, fall on them)\n" +
        "- In walkways (trip hazard for everyone)\n" +
        "- Loose in a bag or locker (blades tangle and dull each other)\n\n" +
        "**Blade protection:**\n" +
        "- Chisels: blade-down in foam, or cover with scrap wood\n" +
        "- Knives: blade-down in magnetic strip or sheath\n" +
        "- Saws: hang from handle, or cover blade with folded newspaper\n" +
        "- Files: blades up (they dry out if stored face-down)\n\n" +
        "**End-of-lesson checklist:**\n" +
        "Before you leave the workshop:\n" +
        "✓ All tools in their storage locations\n" +
        "✓ No tools on benches or floors\n" +
        "✓ Blades covered or protected\n" +
        "✓ Bench cleared of your materials",
      tips: [
        "If a tool isn't in its designated spot, it's probably in someone's way",
        "The 30 seconds to put a tool away prevents a 30-minute injury response",
        "Help classmates put tools away—it's shared responsibility",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 11: Real Incident Story
    // ========================================================================
    {
      type: "micro_story",
      id: "hts-story-cut-01",
      title: "The Utility Knife Slip",
      narrative:
        "Alex was cutting a thin plastic sheet using a utility knife. They had clamped the plastic to the bench—good start. But instead of clamping their other hand away, they were holding a wooden guide block with their left hand to keep the cut line straight.\n\n" +
        "The knife blade was dull (they didn't notice). Pushing harder to cut through, the knife slipped on the plastic surface. Instead of stopping at the edge, it kept going and cut directly through the guide block they were holding—and kept going into their left palm.\n\n" +
        "Five stitches in their hand. They couldn't use a pencil for a week. They missed three days of project work and had to remake all their cuts later.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the first mistake?",
          reveal_answer:
            "Using a dull knife. A sharp blade would have cut cleanly. The dull blade required pressure, which caused the slip.",
        },
        {
          question: "What was the second mistake?",
          reveal_answer:
            "Holding a guide block in the cutting path. Their hand was in line with the potential knife path. Even with a sharp knife, hands slip.",
        },
        {
          question: "How would you do this task safely?",
          reveal_answer:
            "Clamp both the plastic AND a guide block to the bench, so both hands are clear of the cutting path. Use a sharp blade. Make light, controlled cuts. Let the blade do the work.",
        },
      ],
      key_lesson:
        "Small mistakes + dull tools + hands in the path = injury. Any one of these alone is manageable. All three together is a guarantee.",
      related_rule: "Three rules broken: dull tool + hand in path + improper grip",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 12: Check Maintenance Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "hts-maintenance-check-01",
      question: "You're using a handsaw and notice it's cutting slowly and tearing the wood. What should you do?",
      options: [
        "Push harder to speed up the cutting",
        "Switch to a power saw if available",
        "Report it to your teacher—the blade is probably dull",
        "Keep using it—it's fine",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! Slow cutting and torn edges = dull blade. A dull tool is unsafe. Report it and use a sharp replacement.",
      feedback_wrong:
        "Not quite. A dull saw is a dangerous saw. Pushing harder causes the blade to slip and bind. Report it to your teacher for sharpening.",
      hint: "What happens when a tool gets harder to use?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 13: Scenario - Emergency Response
    // ========================================================================
    {
      type: "scenario",
      id: "hts-scenario-emergency-01",
      title: "A Classmate's Hand Tool Slips and Cuts Their Hand",
      setup:
        "Your classmate is using a chisel and their hand slips. The chisel cuts their palm. There's bleeding, and they're upset. You can see it's a moderate cut—not gushing, but definitely needs attention. What do you do first?",
      branches: [
        {
          id: "hts-em-01-a",
          choice_text: "Tell them to go see the school nurse",
          is_correct: false,
          feedback:
            "Wrong first step. You should alert an adult (teacher) FIRST. The teacher determines the severity and gets professional help if needed. Sending a student off alone when injured isn't safe.",
          consequence:
            "The student might faint, the bleeding might worsen, and the teacher won't know there's been an injury.",
        },
        {
          id: "hts-em-01-b",
          choice_text: "Alert your teacher immediately",
          is_correct: true,
          feedback:
            "✓ Correct! Alert an adult first. The teacher assesses the injury, applies first aid, and decides next steps (nurse, hospital, incident report). Your job is to get help, not diagnose.",
          consequence:
            "The teacher responds immediately, the injury gets proper care, and the incident is documented.",
        },
        {
          id: "hts-em-01-c",
          choice_text: "Keep them calm and apply pressure with a cloth",
          is_correct: false,
          feedback:
            "Applying pressure is good, BUT you should alert your teacher FIRST. You can't be their only responder. A trained adult needs to be involved.",
          consequence:
            "You're managing the wound, but the teacher doesn't know what happened.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 14: Final Summary
    // ========================================================================
    {
      type: "key_concept",
      id: "hts-summary-01",
      title: "You're Ready: Safety Quiz Ahead",
      icon: "✅",
      content:
        "You've learned the core hand tool safety practices:\n\n" +
        "✓ **Tool Selection** — Choose the right tool for the job\n" +
        "✓ **Carrying** — Points down, close to body, one at a time\n" +
        "✓ **Clamping** — Work locked in place, never hand-held\n" +
        "✓ **Cutting Position** — Body to the side, blade away from you, fingers out of path\n" +
        "✓ **Sharpness** — Dull tools are MORE dangerous, report them immediately\n" +
        "✓ **Maintenance** — Don't cut metal with wood tools, store blades protected\n" +
        "✓ **Storage** — Tools in designated spots, nothing on floors or in walkways\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need **10 out of 12 questions correct** to earn your Hand Tool Safety badge.\n\n" +
        "**Remember:** Hand tool injuries feel small until they happen to you. These rules protect your hands, your eyes, and your ability to make things. Answer honestly based on what you'd actually do.",
      tips: [
        "If you're unsure about a question, think: 'What would my teacher want me to do?'",
        "There are no tricks—these are real safety principles",
        "Earning this badge means you take hand tool safety seriously",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type HandToolSafetyModuleType = typeof HAND_TOOL_MODULE;
