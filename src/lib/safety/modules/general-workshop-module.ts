/**
 * General Workshop Safety Learning Module
 *
 * FLAGSHIP content demonstrating the full capability of the interactive learning system.
 * Replaces flat LearnCards with rich, pedagogically-sequenced content blocks.
 *
 * Learning flow:
 * 1. Engage: Intro + Spot the Hazard interactive challenge (hooks students immediately)
 * 2. Inform: Key concepts woven with comprehension checks (check understanding in real time)
 * 3. Apply: Realistic scenarios and before/after comparisons (see concepts in action)
 * 4. Verify: Final checks and shared responsibility messaging (reinforce culture)
 *
 * Total estimated time: 12 minutes
 */

import type {
  LearningModule,
  KeyConceptBlock,
  SpotTheHazardBlock,
  ComprehensionCheckBlock,
  BeforeAfterBlock,
  MicroStoryBlock,
  StepByStepBlock,
} from "../content-blocks";
import { GENERAL_SCENE } from "../scenes";

export const GENERAL_WORKSHOP_MODULE: LearningModule = {
  badge_id: "general-workshop-safety",
  learning_objectives: [
    "Identify the 4 types of safety signs and their meanings",
    "Select correct PPE for common workshop activities",
    "Demonstrate proper injury reporting procedure",
    "Explain why housekeeping prevents accidents",
    "Follow correct emergency procedures",
    "Take shared responsibility for workshop safety",
  ],
  estimated_minutes: 12,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Engagement
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-intro-01",
      title: "Welcome to Workshop Safety Training",
      icon: "🏭",
      content:
        "This training takes about **12 minutes** and covers the most important safety rules every design student needs to know.\n\n" +
        "You'll learn:\n" +
        "- How to recognize safety signs\n" +
        "- What PPE to wear and when\n" +
        "- How to respond if someone is injured\n" +
        "- Why housekeeping matters\n" +
        "- What to do in an emergency\n\n" +
        "**Why this matters:** Workshop accidents are 100% preventable. The rules exist because people got hurt before—we learn from their experiences so you don't have to.",
      tips: [
        "Pay close attention to the interactive challenges",
        "Take your time—there's no rush",
        "If anything is unclear, ask your teacher before continuing",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Interactive Challenge
    // ========================================================================
    {
      type: "spot_the_hazard",
      id: "gws-sth-01",
      title: "Can You Spot the Hazards?",
      scene_id: GENERAL_SCENE.scene_id,
      scene_type: GENERAL_SCENE.scene_type,
      hazards: GENERAL_SCENE.hazards,
      total_hazards: GENERAL_SCENE.total_hazards,
      time_limit_seconds: 120,
      pass_threshold: 6,
    } as SpotTheHazardBlock,

    // ========================================================================
    // BLOCK 3: Safety Signs Concept
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-signs-01",
      title: "Safety Signs: The 4 Colours",
      icon: "🚫",
      content:
        "Every safety sign uses a colour code so you can instantly understand what it means—even without reading the words.\n\n" +
        "**🔵 BLUE = MANDATORY (You MUST do this)**\n" +
        "Always positive action: 'Wear Safety Glasses', 'Use Dust Extraction', 'Read Instructions Before Use'. If you see a blue sign, the rule is non-negotiable.\n\n" +
        "**🔴 RED = PROHIBITION (Do NOT do this)**\n" +
        "Stop and don't proceed: 'No Entry', 'Do Not Operate', 'No Unauthorised Access'. Red means STOP.\n\n" +
        "**🟡 YELLOW = WARNING (Be careful!)**\n" +
        "Potential hazard ahead: 'Hot Surface', 'Sharp Objects', 'Rotating Machinery', 'Heavy Load'. Yellow alerts you to danger so you can take precautions.\n\n" +
        "**🟢 GREEN = INFORMATION (Helpful directions)**\n" +
        "Positive information: 'First Aid Kit Here', 'Emergency Exit', 'Fire Extinguisher', 'Assembly Point'. Green tells you where safety equipment is located.",
      tips: [
        "Learn the colours, not just the words—you'll spot them instantly",
        "If you're unsure what a sign means, ask your teacher before proceeding",
        "Report damaged or missing signs to your teacher immediately",
      ],
      warning:
        "A sign that's hidden (covered by a jacket, equipment) is as dangerous as a missing sign. Always keep safety signs visible.",
      image: "/images/safety/signs-overview.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Check Signs Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "gws-signs-check-01",
      question: "What does a blue safety sign indicate?",
      options: [
        "A hazard warning",
        "Mandatory action required",
        "Prohibition (do not enter)",
        "Location of safety equipment",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Blue signs always indicate an action you MUST take. Examples: 'Wear Safety Glasses', 'Use Extraction System', 'Read Instructions'.",
      feedback_wrong:
        "Not quite. Blue signs indicate mandatory actions (things you MUST do). Red signs mean prohibition, yellow signs warn of hazards, and green signs provide information about equipment locations.",
      hint: "Think: BLUE = action required. What word means you must do something?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 5: Personal Protective Equipment (PPE)
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-ppe-01",
      title: "Personal Protective Equipment (PPE)",
      icon: "🥽",
      content:
        "PPE is your personal barrier between you and workshop hazards. Different activities need different protection.\n\n" +
        "**Safety Glasses**\n" +
        "Required whenever: sawing, drilling, grinding, sanding, hammering, or working with materials that could fly or shatter. Glasses protect your eyes from wood chips, metal shavings, dust, and chemical splashes.\n\n" +
        "**Dust Masks**\n" +
        "Required when: sanding, cutting MDF, using spray adhesive, or operating machinery with dust extraction. Masks prevent you from breathing in fine particles that can damage your lungs permanently.\n\n" +
        "**Work Apron**\n" +
        "Protects your clothes and skin from hot materials, chemicals, sharp chips, and stains. An apron that covers from chest to knees is ideal.\n\n" +
        "**Hair Tie (if you have long hair)**\n" +
        "Long loose hair can get caught in rotating machinery (drills, lathes, sanders). Hair tie it back BEFORE using any power tool. No exceptions.\n\n" +
        "**Closed-Toe Shoes**\n" +
        "Required in workshops. Protect your feet from dropped tools, hot materials, and sharp chips. Sandals and flip-flops offer zero protection.\n\n" +
        "**Gloves (situation-dependent)**\n" +
        "Good for: handling rough materials, applying chemicals, working with hot items. BAD for: operating lathes or drill presses (gloves can catch and pull your hand in). Always check with your teacher.",
      tips: [
        "Check what PPE is required BEFORE you start—don't guess",
        "Damaged PPE (cracked goggles, torn gloves) must be replaced immediately",
        "If something doesn't fit right, adjust it or ask for a different size",
        "Some PPE like glasses might feel uncomfortable at first—give yourself a minute to adjust",
      ],
      warning:
        "Damaged PPE offers NO protection. A small crack in safety glasses can fail under impact. Always use intact, properly fitted equipment.",
      image: "/images/safety/ppe-overview.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: PPE in Action (Before/After)
    // ========================================================================
    {
      type: "before_after",
      id: "gws-ppe-ba-01",
      title: "PPE: Wrong vs Right",
      before: {
        caption: "NOT SAFE: Student wearing no safety equipment",
        hazards: [
          "No safety glasses—eyes unprotected from flying chips",
          "Hair loose—could get caught in bandsaw blade",
          "Open-toed sandals—feet unprotected from dropped tools",
          "No apron—clothes will absorb chemicals and stains",
          "Hoodie strings dangling—could get caught in machinery",
        ],
        image: "/images/safety/ppe-wrong.png",
      },
      after: {
        caption: "SAFE: Student properly equipped for workshop",
        principles: [
          "Safety glasses on—eyes fully protected",
          "Hair tied back—no entanglement risk",
          "Work apron on—body protected from chemicals and hot materials",
          "Closed-toe shoes—feet protected",
          "Fitted clothing, no loose strings or jewellery",
        ],
        image: "/images/safety/ppe-right.png",
      },
      key_difference:
        "Proper PPE takes 30 seconds to put on and prevents injuries that could affect you for life. Always suit up before using equipment.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 7: Check PPE Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "gws-ppe-check-01",
      question: "When do you need to wear safety glasses in a workshop?",
      options: [
        "Only when using power tools",
        "Only when cutting or grinding",
        "Whenever any activity could produce flying material",
        "Only if your teacher tells you to",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! Hazards are unpredictable. You need safety glasses whenever: sawing, drilling, grinding, sanding, hammering, using hand tools on brittle materials, or working with chisels. Wear them proactively.",
      feedback_wrong:
        "Not quite. Safety glasses protect you during many activities, not just power tools. Hammering, chiseling, sanding, and even handling brittle materials can produce flying fragments. When in doubt, wear them.",
      hint: "Think about all the ways something could fly toward your eyes—not just power tools.",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 8: Housekeeping & Why It Matters
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-housekeeping-01",
      title: "Housekeeping: A Clean Workshop is a Safe Workshop",
      icon: "🧹",
      content:
        "Housekeeping (keeping the workshop clean and organized) is not annoying tidying—it's a critical safety system that prevents accidents before they happen.\n\n" +
        "**Dust and Shavings**\n" +
        "Sawdust and metal shavings accumulate fast. When they build up: (1) they become a FIRE HAZARD near heat sources, (2) they're a SLIP HAZARD on floors, (3) they clog dust extraction systems. Sweep as you go, not just at the end.\n\n" +
        "**Spills (Oil, Adhesive, Chemicals)**\n" +
        "Any liquid on the floor is a severe slip hazard. Oil also fuels fires. Wipe up spills immediately with absorbent pads, then wash with soap and water. Report large spills to your teacher.\n\n" +
        "**Walkways and Exits**\n" +
        "Emergency exits must be clear at all times—in a real emergency, seconds count. Keep bags, materials, and tools out of walkways. If you can't see the exit clearly, something is blocking it.\n\n" +
        "**Tool Storage**\n" +
        "Tools scattered on benches are easy to grab by accident and create trip hazards. Store tools in their designated racks or boxes. Sharp tools (chisels, knives) should be placed flat with blades facing away.\n\n" +
        "**Cable Management**\n" +
        "Extension cords across walkways cause trips. Route cables along walls or under cable protectors when they must cross pathways.",
      tips: [
        "Clean as you go—don't wait until the end of the lesson",
        "If you spill something, clean it up immediately (or tell your teacher if it's something you can't handle)",
        "Keep your personal workspace organized so you know where everything is",
      ],
      warning:
        "Sawdust near a heat source (soldering iron, heat gun, grinding wheel) can ignite suddenly. A fire starting in sawdust spreads fast. Clean constantly.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 9: Housekeeping Failure Story
    // ========================================================================
    {
      type: "micro_story",
      id: "gws-story-sawdust-01",
      title: "The Sawdust Fire",
      narrative:
        "Jamie had been sanding a wooden box for 20 minutes. Sawdust had accumulated on the bench around the sanding area, and a small pile had drifted onto the floor. Jamie wasn't worried—just dust, right?\n\n" +
        "A few metres away, another student was using a heat gun to shape some plastic. The heat gun nozzle gets to 500°C. A gust of air knocked some of the accumulated sawdust pile around the corner, where it landed near the heat gun outlet.\n\n" +
        "Within seconds, the sawdust caught fire. The flames spread along the trail of dust on the floor toward the sanding station. The workshop filled with smoke. Everyone had to evacuate. The fire department was called.\n\n" +
        "Damage: $5,000 in equipment damage, one student got minor burns on their hand, the workshop was closed for 2 days for inspection and repairs.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of this fire?",
          reveal_answer:
            "Accumulated sawdust near a heat source. Sawdust is extremely flammable—it has a high surface area which makes it burn rapidly. The root cause was NOT cleaning as work progressed.",
        },
        {
          question: "What safety rule was broken?",
          reveal_answer:
            "'Clean as you go.' If sawdust had been swept up regularly, there would have been no fuel for the fire to spread. Even though the original fire source was unrelated to sanding, the lack of housekeeping turned a small incident into a workshop evacuation.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "Multiple ways: (1) Sweep sawdust every 5 minutes during sanding, (2) Use dust extraction on the sanding machine, (3) Keep heat sources away from high-dust areas, (4) Have a fire extinguisher within 2 metres of all heat-generating tools. The key is: assume sawdust is present and treat it like a fire hazard.",
        },
      ],
      key_lesson:
        "One person's mess becomes everyone's emergency. Housekeeping is shared responsibility, and it directly prevents fires, injuries, and workshop closures.",
      related_rule: "Housekeeping Rule #1: Clean as you go",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 10: Injury Response Procedure
    // ========================================================================
    {
      type: "step_by_step",
      id: "gws-injury-steps-01",
      title: "What to Do When Someone is Injured",
      steps: [
        {
          number: 1,
          instruction:
            "**ASSESS SAFETY:** Check if the injured person and you are in immediate danger. If they're near operating machinery, first make sure the machine is off or they're away from it.",
          checkpoint:
            "Ask yourself: 'Is it safe for me to help right now?' If not, move to step 2 first.",
        },
        {
          number: 2,
          instruction:
            "**CALL FOR HELP:** Immediately alert your teacher or another adult. Use the workshop alarm or PA system if available. Do not assume a bystander will get help—speak directly to an adult.",
          checkpoint:
            "An adult must know about the injury within the first 30 seconds.",
        },
        {
          number: 3,
          instruction:
            "**ASSESS THE INJURY:** Check: Is the person conscious and breathing? Is there severe bleeding? Are they in pain? Can they move? Report these details to the adult who arrives.",
          warning:
            "Do not move someone with a suspected head, neck, or spine injury unless they're in immediate danger.",
        },
        {
          number: 4,
          instruction:
            "**PROVIDE FIRST AID IF TRAINED:** If you've learned first aid, help. If not, follow the teacher's instructions. For cuts: apply pressure with a clean cloth. For burns: run cool water over the area for 10 minutes. For chemical splashes: rinse with water at the eyewash station.",
          image: "/images/safety/first-aid-steps.png",
        },
        {
          number: 5,
          instruction:
            "**STAY CALM AND REASSURE:** Talk to the injured person. Tell them: 'Help is here.' Stay with them so they're not alone. Your calm voice reduces their panic.",
          checkpoint:
            "Your job is to be the calm, supportive presence while the adult takes action.",
        },
        {
          number: 6,
          instruction:
            "**FILL OUT INCIDENT REPORT:** After the teacher has treated the injury, complete the workshop incident report. Write down: what happened, who was involved, when, where, what injuries were sustained, what treatment was given. This creates a safety record.",
          warning:
            "Never assume an injury is 'too small' to report. Infections from small cuts can become serious. Report everything.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 11: Check Injury Response
    // ========================================================================
    {
      type: "comprehension_check",
      id: "gws-injury-check-01",
      question:
        "Your friend gets a small splinter while handling wood. It's not bleeding. What should you do?",
      options: [
        "Leave it—it's too small to worry about",
        "Pull it out yourself",
        "Report it to your teacher and let them handle it",
        "Ignore it and finish the project first",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! All injuries, no matter how small, must be reported immediately. Splinters can cause infections. Your teacher has the proper tools and training to remove it safely and treat the wound.",
      feedback_wrong:
        "Not quite. Every injury must be reported—splinters can lead to infection, and your teacher has the proper tools to remove it safely. Small injuries still need documentation for the safety record.",
      hint: "What could happen if a splinter gets infected?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Emergency Procedures
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-emergency-01",
      title: "Emergency Procedures",
      icon: "🚨",
      content:
        "In an emergency, you have seconds to react. Knowing the procedures in advance means you act instinctively, not with panic.\n\n" +
        "**FIRE**\n" +
        "If you see flames or heavy smoke: (1) Activate the alarm immediately (pull the lever), (2) Alert the nearest adult, (3) Evacuate calmly to the assembly point. Do NOT try to extinguish a large fire yourself. Fire extinguishers are only for small fires (smaller than a shoebox) that are contained.\n\n" +
        "**CHEMICAL SPLASH IN THE EYE**\n" +
        "Immediately go to the eyewash station and flush your eye for 15+ minutes. Tell an adult as soon as you look away. The longer you rinse, the better.\n\n" +
        "**ELECTRICAL EMERGENCY**\n" +
        "If someone is in contact with live electricity: Do NOT touch them. Turn off the main power switch if you can reach it safely. Call for help immediately. If you can't reach the power, use a non-conducting item (wooden stick, rubber) to separate them from the electrical source.\n\n" +
        "**EVACUATION**\n" +
        "Know your assembly point (usually the oval or car park). Exit calmly, close doors behind you, and stay in group. Do NOT collect belongings. The teacher will account for everyone.",
      tips: [
        "Know where the fire alarm pull lever is RIGHT NOW (don't wait for an emergency)",
        "Know where the eyewash station is (it's often mounted on a wall near the sink)",
        "Know your assembly point",
        "Do not hesitate to ask questions about emergency procedures before an emergency happens",
      ],
      warning:
        "Never try to be a hero in an emergency. Call for help first. Your job is to alert an adult and then follow instructions.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 13: Blocked Exit Story (Before/After)
    // ========================================================================
    {
      type: "before_after",
      id: "gws-exit-ba-01",
      title: "Workshop Setup: Emergency Exit Access",
      before: {
        caption: "NOT SAFE: Fire exit blocked by materials",
        hazards: [
          "Wooden materials stacked in front of exit door",
          "Exit sign obscured by equipment",
          "Clear path to exit is blocked",
          "Would cause critical delay in evacuation",
        ],
        image: "/images/safety/exit-blocked.png",
      },
      after: {
        caption: "SAFE: Exit is clear and immediately accessible",
        principles: [
          "1.2 metres clearance from exit door (no materials, equipment, or furniture)",
          "Exit sign is visible and lit",
          "Clear path to assembly point is marked",
          "Everyone can exit in seconds",
        ],
        image: "/images/safety/exit-clear.png",
      },
      key_difference:
        "In a fire, every second counts. A blocked exit can trap people. This is a fire safety violation and must be reported immediately if found.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 14: Shared Responsibility
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-responsibility-01",
      title: "Shared Responsibility: Safety is Everyone's Job",
      icon: "🤝",
      content:
        "Safety is not just your teacher's job. In a workshop, **everyone is responsible for everyone's safety.** This is called a safety culture.\n\n" +
        "**What shared responsibility means:**\n" +
        "- If you see someone breaking a rule, speak up politely\n" +
        "- If you see a hazard, alert an adult immediately\n" +
        "- If you're tired, stressed, or distracted, don't use equipment\n" +
        "- If someone asks for help, help (unless it means breaking a rule)\n" +
        "- Report injuries and near-misses so others can learn\n\n" +
        "**How to speak up politely:**\n" +
        "❌ Wrong: 'You're breaking the rules, you'll get in trouble!'\n" +
        "✓ Right: 'Hey, your hair isn't tied back—your teacher said to tie it before the drill press. Want me to wait for you?'\n\n" +
        "❌ Wrong: 'That's stupid.'\n" +
        "✓ Right: 'I think that equipment is blocking the exit. Should we move it?'\n\n" +
        "**The culture you create:**\n" +
        "When everyone watches out for everyone else, the workshop feels safer and accidents drop. When people ignore hazards, accidents increase. You choose which culture you build with your actions.",
      tips: [
        "Speak up in a friendly, non-accusatory way—you're helping, not judging",
        "If someone gets defensive, don't argue—just tell your teacher",
        "Model the safety behaviour you want to see",
        "Thank people when they point out your safety lapses (they're helping you)",
      ],
      warning:
        "Silence when you see unsafe behaviour makes you complicit. Speak up.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 15: Final Check - Shared Responsibility
    // ========================================================================
    {
      type: "comprehension_check",
      id: "gws-final-check-01",
      question:
        "If you notice a classmate not wearing safety glasses during a sanding task, what should you do?",
      options: [
        "Mind your own business—they'll learn the hard way",
        "Politely remind them and alert your teacher",
        "Let your teacher find out on their own",
        "Only tell them if they ask for help",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Everyone is responsible for workshop safety. Speaking up when someone is at risk shows you care about their wellbeing. This builds a strong safety culture where everyone looks out for everyone else.",
      feedback_wrong:
        "Not quite. Safety is shared responsibility. Speaking up politely when someone is at risk is how you help build a safe workshop culture. Silence puts them at risk of a preventable injury.",
      hint: "What responsibility do you have to your classmates?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 16: Summary & Next Steps
    // ========================================================================
    {
      type: "key_concept",
      id: "gws-summary-01",
      title: "You're Ready: Now Take the Safety Quiz",
      icon: "✅",
      content:
        "You've learned the core safety practices that protect you and your classmates:\n\n" +
        "✓ **Safety Signs** — Blue (mandatory), Red (prohibition), Yellow (warning), Green (information)\n" +
        "✓ **PPE** — Glasses, masks, aprons, hair ties, shoes, gloves (when appropriate)\n" +
        "✓ **Injury Response** — Alert an adult, apply first aid if trained, fill out incident report\n" +
        "✓ **Housekeeping** — Clean as you go, keep exits clear, store tools safely\n" +
        "✓ **Emergencies** — Know evacuation routes, alarm locations, assembly points\n" +
        "✓ **Shared Responsibility** — Watch out for classmates, speak up politely, report hazards\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your General Workshop Safety badge.\n\n" +
        "**Remember:** These aren't tricks—they're rules that protect your hands, eyes, lungs, and life. Answer honestly based on what you'd actually do in the workshop.",
      tips: [
        "Take your time—you can't fail, you just learn and try again",
        "If you're unsure about a question, think about 'What would my teacher want me to do?'",
        "Earning this badge means you take safety seriously—wear that with pride",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 * Used when creating/updating the badge in the database
 */
export type GeneralWorkshopModuleType = typeof GENERAL_WORKSHOP_MODULE;
