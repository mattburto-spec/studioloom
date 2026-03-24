/**
 * Fire Safety & Emergency Response Learning Module
 *
 * Covers fire prevention, fire triangle principles, extinguisher types & PASS technique,
 * evacuation procedures, burns treatment, and emergency response protocols.
 *
 * Learning flow:
 * 1. Engage: Interactive scenario on fire response decisions
 * 2. Inform: Fire triangle, extinguisher types, PASS technique, evacuation
 * 3. Apply: Real incident stories, before/after emergency scenarios
 * 4. Verify: Comprehension checks, final emergency response drill
 *
 * Total estimated time: 13 minutes
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

export const FIRE_SAFETY_MODULE: LearningModule = {
  badge_id: "fire-safety-emergency",
  learning_objectives: [
    "Explain the fire triangle and how to break it",
    "Identify the 4 types of fire extinguishers and their uses",
    "Demonstrate the PASS technique (Pull, Aim, Squeeze, Sweep)",
    "Execute evacuation procedures and identify assembly points",
    "Treat burns properly (cool water, no oil, no popping blisters)",
    "Recognize when to evacuate vs when to fight a small fire",
    "Follow emergency reporting procedures",
  ],
  estimated_minutes: 13,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Fire Risk in Workshops
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-intro-01",
      title: "Fire in the Workshop: Prevention & Response",
      icon: "🔥",
      content:
        "Workshops have multiple fire sources: heat guns, soldering irons, grinding wheels, kilns, and chemical reactions. But fires are preventable—and if one starts, you need to know whether to extinguish or evacuate.\n\n" +
        "This module takes about **13 minutes** and covers:\n" +
        "- How fires start (the fire triangle)\n" +
        "- Types of extinguishers and when to use each\n" +
        "- The PASS technique for using an extinguisher\n" +
        "- When to evacuate immediately (don't try to fight)\n" +
        "- How to treat burns if someone gets hurt\n" +
        "- Evacuation procedures and assembly points\n\n" +
        "**Why this matters:** A small fire can grow to an uncontrollable blaze in seconds. But a small fire caught early, with the right extinguisher and technique, can be stopped. Knowing the difference saves lives.",
      tips: [
        "Pay close attention to when to evacuate vs when to fight a fire",
        "If you've ever seen a fire, think about how these rules would have applied",
        "Fire prevention is shared responsibility—everyone watches for hazards",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Scenario - Fire Discovery Decision
    // ========================================================================
    {
      type: "scenario",
      id: "fse-scenario-fire-01",
      title: "You Smell Smoke and See a Small Flame",
      setup:
        "You're working at a bench near the woodworking area. You smell smoke and look over to see a small flame (about the size of your hand) coming from a pile of sawdust near a soldering station. The fire is contained to the sawdust pile and hasn't reached any other materials yet. Your teacher is 15 metres away helping another student. What do you do?",
      branches: [
        {
          id: "fse-sc-01-a",
          choice_text: "Try to put it out with water from a spray bottle",
          is_correct: false,
          feedback:
            "WRONG. Water on a sawdust fire can spread burning particles. This is also wasting time. Your first action must be to alert an adult—immediately.",
          consequence:
            "You've wasted seconds, the fire has grown, and now your teacher is just finding out. That's too late.",
        },
        {
          id: "fse-sc-01-b",
          choice_text: "Immediately alert your teacher (shout or run to get them)",
          is_correct: true,
          feedback:
            "✓ CORRECT. Alert an adult first. The teacher assesses the fire size and decides: Can we extinguish it safely? Or do we evacuate immediately? Never make that decision alone.",
          consequence:
            "The teacher arrives in seconds, evaluates, and makes the right call (grab the extinguisher or activate the alarm to evacuate).",
        },
        {
          id: "fse-sc-01-c",
          choice_text: "Grab the fire extinguisher and aim at the flames",
          is_correct: false,
          feedback:
            "DON'T. You haven't been trained on the specific extinguisher type. The wrong extinguisher on the wrong fire can make it worse. Alert an adult first. They're trained and have the authority to make the call.",
          consequence:
            "You've wasted precious seconds, and now your teacher has to manage both the fire AND your action.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 3: The Fire Triangle
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-triangle-01",
      title: "The Fire Triangle: What Fire Needs to Burn",
      icon: "△",
      content:
        "Fire requires three things. Remove any one, and the fire dies.\n\n" +
        "**HEAT** (ignition source)\n" +
        "Soldering irons, heat guns, grinding wheels, open flames, hot work, friction, electrical shorts. Temperature must be high enough to ignite the fuel (the ignition point varies by material).\n\n" +
        "**FUEL** (combustible material)\n" +
        "Wood, sawdust, paper, plastic, cloth, adhesives, solvents, oils, foam. Anything that burns.\n\n" +
        "**OXYGEN** (air)\n" +
        "The air around us is 21% oxygen. That's enough to fuel most fires. You can't remove oxygen, so you focus on removing heat or fuel.\n\n" +
        "**Break the Triangle, Stop the Fire:**\n" +
        "- **Remove HEAT:** Water cools the fuel below ignition point (extinguisher on wood fires)\n" +
        "- **Remove FUEL:** Sweep away sawdust, clean up spills, store flammables in metal cabinets (prevents fuel source)\n" +
        "- **Remove OXYGEN:** Smother with blanket or extinguishing powder (covers and displaces air around fire)\n\n" +
        "**In workshop fires:**\n" +
        "You can't remove oxygen (it's in the air we breathe). You focus on removing heat (extinguisher) or fuel (prevention). This is why housekeeping and extinguishers are the two pillars of fire safety.",
      tips: [
        "Learn the triangle: Heat, Fuel, Oxygen. Remove one = fire dies.",
        "Most workshop fires are small—if you catch them fast and have the right extinguisher, you can stop them",
        "If a fire is large or growing fast, don't try to extinguish it—evacuate",
      ],
      warning:
        "Never assume a small fire will stay small. A pile of burning sawdust can ignite nearby materials. If unsure, evacuate immediately.",
      image: "/images/safety/fire-triangle.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Types of Fire Extinguishers
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-extinguishers-01",
      title: "Fire Extinguisher Types: Use the Right One",
      icon: "🧯",
      content:
        "Different fires need different extinguishers. Using the wrong type can make the fire worse.\n\n" +
        "**TYPE A (Blue label) — ORDINARY COMBUSTIBLES**\n" +
        "Materials: Wood, paper, cloth, sawdust, plastic\n" +
        "How it works: Water-based. Cools the fuel below ignition point.\n" +
        "When to use: Class A fires (wood, cardboard, natural materials)\n" +
        "When NOT to use: Never on electrical fires or metal fires (dangerous)\n" +
        "Workshop use: Most common extinguisher in woodworking areas\n\n" +
        "**TYPE B (Red label) — FLAMMABLE LIQUIDS**\n" +
        "Materials: Gasoline, oil, adhesives, solvents, paints\n" +
        "How it works: Foam or powder. Smothers the surface, preventing vapor ignition.\n" +
        "When to use: Class B fires (chemical spills, oil fires)\n" +
        "When NOT to use: Never on wood fires (foam dissolves quickly)\n" +
        "Workshop use: Required near solvent storage, spray adhesive areas\n\n" +
        "**TYPE C (Yellow label) — ELECTRICAL EQUIPMENT**\n" +
        "Materials: Electrical fires (live wiring, electronics, power tools)\n" +
        "How it works: Non-conductive powder. Extinguishes without conducting electricity.\n" +
        "When to use: Live electrical fires ONLY\n" +
        "When NOT to use: Once power is OFF, use Type A if wood is burning\n" +
        "Workshop use: Near high-power tools, electrical cabinets, kiln control boxes\n\n" +
        "**TYPE D (White label) — METALLIC FIRES**\n" +
        "Materials: Combustible metals (magnesium, titanium, sodium)\n" +
        "How it works: Special powder that cools and displaces oxygen\n" +
        "When to use: Metal fires ONLY\n" +
        "When NOT to use: Most workshops won't have these (unless doing metal casting)\n" +
        "Workshop use: Rare in design shops, but required in metalwork studios\n\n" +
        "**Quick Reference:**\n" +
        "- Blue = Wood, paper, cloth → Use water\n" +
        "- Red = Oils, solvents → Use foam/powder\n" +
        "- Yellow = Electrical → Use non-conductive powder\n" +
        "- White = Metals → Use special powder\n\n" +
        "**IMPORTANT:** If you're not 100% sure which type, DON'T use an extinguisher. Evacuate and let trained firefighters handle it.",
      tips: [
        "Know where each extinguisher type is mounted in your workshop",
        "Read the label BEFORE an emergency—don't guess in a fire",
        "A fire extinguisher has an inspection tag showing when it was last serviced",
      ],
      warning:
        "Using the wrong extinguisher on a fire can spread it or create hazardous fumes. If in doubt, evacuate.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: The PASS Technique
    // ========================================================================
    {
      type: "step_by_step",
      id: "fse-pass-steps-01",
      title: "Using a Fire Extinguisher: The PASS Technique",
      steps: [
        {
          number: 1,
          instruction:
            "**PULL** the safety pin. Twist it and pull it straight out. This breaks the seal and arms the extinguisher. You'll hear a small sound as the pressure is released.",
          checkpoint:
            "Safety pin is out. Extinguisher is now armed and ready to use.",
        },
        {
          number: 2,
          instruction:
            "**AIM** the nozzle at the base of the fire (the seat of the fire), NOT at the flames. The base is where the heat and fuel are burning. Aiming at the flames is wasting extinguisher powder into thin air.",
          checkpoint:
            "Nozzle pointed at the fire's base, safe distance (1-3 metres from the flames).",
        },
        {
          number: 3,
          instruction:
            "**SQUEEZE** the trigger/handle. Steady, firm pressure—not sudden. The extinguisher will release a stream of water, foam, or powder depending on the type.",
          image: "/images/safety/fire-extinguisher-pass.png",
        },
        {
          number: 4,
          instruction:
            "**SWEEP** the nozzle side to side, covering the entire base of the fire. Imagine you're painting the fire's base with the extinguisher stream. Keep sweeping until the flames are out and no smoke is visible.",
          checkpoint:
            "Fire is extinguished. Smoke has stopped. Base of fire is covered.",
        },
        {
          number: 5,
          instruction:
            "**WATCH THE FIRE.** Even after it seems out, watch for reignition. Sometimes embers reignite if the extinguisher stream stops. If it reignites, STOP immediately, back away, and evacuate. The fire is too hot to handle.",
          warning:
            "If the fire reignites, it's beyond your capability. Evacuate and call firefighters.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 6: Check PASS Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "fse-pass-check-01",
      question: "When using a fire extinguisher, where should you aim the nozzle?",
      options: [
        "At the top of the flames",
        "At the side of the fire",
        "At the base of the fire (where the heat and fuel are)",
        "Doesn't matter—just spray it",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! Aim at the base where the burning material is, not the flames. Aiming at flames wastes the extinguisher. The seat of the fire is the target.",
      feedback_wrong:
        "Not quite. Aiming at the flames is ineffective—the nozzle should be directed at the base of the fire where the fuel is burning. That's where the extinguisher does its job.",
      hint: "Where is the heat and fuel actually burning—at the top or the base?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 7: When to Evacuate (Don't Fight)
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-evacuation-01",
      title: "When to Evacuate (DON'T Try to Fight the Fire)",
      icon: "🚪",
      content:
        "Not every fire is small enough to fight. Knowing when to give up and evacuate saves lives.\n\n" +
        "**EVACUATE IMMEDIATELY if:**\n" +
        "- The fire is larger than a shoebox (you can't contain it with one extinguisher)\n" +
        "- The fire is spreading to nearby materials\n" +
        "- Thick smoke is filling the room (you can't see or breathe)\n" +
        "- You don't know what's burning (unknown fuel = unknown extinguisher type)\n" +
        "- The fire is in a confined space (closet, cabinet, corner) where flames could travel behind things\n" +
        "- You're uncomfortable or unsure for any reason\n" +
        "- The extinguisher runs out and the fire isn't out\n\n" +
        "**Evacuation Procedure:**\n" +
        "1. Activate the fire alarm (pull the lever on the red box)\n" +
        "2. Alert nearby people: 'FIRE! Everyone out!'\n" +
        "3. Leave immediately via the nearest exit\n" +
        "4. Close doors behind you (slows smoke spread, doesn't trap people—modern doors have fire protection)\n" +
        "5. Move to the assembly point (usually the oval, car park, or designated outdoor area)\n" +
        "6. Stay with your group and wait for the teacher to account for everyone\n" +
        "7. Do NOT go back inside for ANY reason (not even your phone, shoes, or project)\n\n" +
        "**Remember:**\n" +
        "Evacuation is not failure—it's the safe option. Firefighters are trained and equipped to fight fires. You are not. If it's big enough to worry about, it's big enough to evacuate.",
      tips: [
        "Know where your assembly point is RIGHT NOW (don't wait for a fire to find out)",
        "If you can evacuate quickly, do it. Don't try to be a hero.",
        "In a real fire, follow the teacher's directions. They have the authority and training.",
      ],
      warning:
        "Attempting to fight a fire that's beyond your skill level puts yourself and others at risk. Evacuation is always the right call if you're unsure.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 8: Burns Treatment
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-burns-01",
      title: "Treating Burns: Cool Water is Your First Tool",
      icon: "💧",
      content:
        "Burn injuries are common in workshops (heat guns, soldering irons, kiln doors, hot glue). The first 10 minutes of treatment determine how severe the injury becomes.\n\n" +
        "**IMMEDIATE TREATMENT (First 10 Minutes):**\n\n" +
        "**Cool running water**\n" +
        "Run the burned area under cool (not cold) running water for **at least 10 minutes**. This does three things: (1) stops the burning process (heat damage continues for minutes after exposure), (2) reduces pain, (3) reduces swelling and scarring.\n\n" +
        "How to tell if it's working: The burn area stops hurting as much = the water is working.\n\n" +
        "**What NOT to do:**\n" +
        "- ❌ Don't apply ice directly (ice can cause frostbite on damaged skin)\n" +
        "- ❌ Don't apply oils, butter, or lotions (traps heat, worsens the burn)\n" +
        "- ❌ Don't pop blisters (blisters protect the wound underneath; popping causes infection)\n" +
        "- ❌ Don't use ice water (too cold causes additional shock to the skin)\n\n" +
        "**After cooling (10+ minutes):**\n" +
        "- Dry the area gently with a clean cloth\n" +
        "- Apply a burn gel or antibiotic ointment (if available)\n" +
        "- Wrap loosely with clean gauze (not tight—circulation matters)\n" +
        "- Alert your teacher—even small burns should be documented\n\n" +
        "**Burn Severity:**\n" +
        "- **1st degree:** Red, no blisters (like sunburn). Usually heals in 1-2 weeks.\n" +
        "- **2nd degree:** Red, blistered, swollen. Heals in 2-3 weeks with proper care.\n" +
        "- **3rd degree:** White, charred, or extremely painful. Requires hospital. Call 000 immediately.\n\n" +
        "**Any burn larger than your hand OR any burn that blisters = needs professional assessment.** Your teacher will decide if hospital care is needed.",
      tips: [
        "Cool water is your first response—it's more important than anything else",
        "Keep cooling for the full 10 minutes, even if it feels better",
        "Blisters are protective—don't pop them",
        "Alert your teacher immediately—burns can get worse over hours",
      ],
      warning:
        "Never assume a burn is 'too small' to treat. Immediate cooling prevents serious scarring and infection.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 9: Real Incident - Soldering Iron Fire
    // ========================================================================
    {
      type: "micro_story",
      id: "fse-story-soldering-01",
      title: "The Soldering Iron in the Fabric Box",
      narrative:
        "A textile student was heat-setting an embellishment using a soldering iron. She finished, unplugged the iron, and placed it on the bench to cool. But she forgot—the bench had a fabric scrap box nearby.\n\n" +
        "The soldering iron was 400°C and cooling slowly. As students worked nearby, someone bumped the iron. It fell directly into the fabric box, landing on a pile of cotton and silk scraps.\n\n" +
        "The cotton ignited instantly. Within seconds, the scraps were fully ablaze. The student nearest to the box saw the flames and did the right thing: activated the fire alarm immediately and called out 'FIRE! Everyone out!' The entire workshop evacuated in under 2 minutes.\n\n" +
        "The fire department arrived, extinguished the fire, and prevented spread to other areas. Damage: the fabric box was destroyed, the bench was charred, but nobody was injured. The workshop was closed for one day for inspection and cleanup.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause?",
          reveal_answer:
            "Poor placement and housekeeping. The soldering iron was placed where it could fall into a flammable material box. Scrap fabrics should not be stored near hot tools.",
        },
        {
          question: "What did the student do right?",
          reveal_answer:
            "Immediately activated the fire alarm and called out the evacuation. They didn't try to grab the fire extinguisher or move the fabric box. Evacuation was the right call.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "Multiple ways: (1) Store hot tools on a dedicated heat-resistant surface away from flammable materials, (2) Don't place soldering irons where they can be bumped, (3) Use a metal stand designed for soldering irons, (4) Keep scrap fabric boxes away from heat sources.",
        },
      ],
      key_lesson:
        "A small mistake (forgetting about a cooling iron) + a workspace hazard (fabric box too close) = emergency. Hot tools are hot for a long time—treat them with constant respect.",
      related_rule: "Hot tool safety rule: Place on dedicated stands, away from flammables, until completely cool",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 10: Prevention - Keeping Heat Sources Safe
    // ========================================================================
    {
      type: "before_after",
      id: "fse-heat-ba-01",
      title: "Heat Source Safety: Wrong vs Right Setup",
      before: {
        caption: "NOT SAFE: Soldering iron near fabric and materials",
        hazards: [
          "Hot soldering iron on wooden bench (touches flammable surface)",
          "Fabric scraps within 30cm of the iron",
          "No clear workspace around the iron",
          "Iron left plugged in to cool passively",
          "Accumulation of sawdust and lint near heat source",
        ],
        image: "/images/safety/heat-source-unsafe.png",
      },
      after: {
        caption: "SAFE: Heat source isolated and protected",
        principles: [
          "Iron on dedicated ceramic/metal stand (non-flammable)",
          "Clear 1-metre radius around the stand (no materials, fabric, or paper)",
          "Workshop clean and swept (no sawdust or lint accumulation)",
          "Explicit 'Hot Tool' sign visible",
          "Iron unplugged after use, placed on stand to cool",
        ],
        image: "/images/safety/heat-source-safe.png",
      },
      key_difference:
        "Heat sources must be isolated and treated as active hazards until completely cool. A hot iron can still ignite materials 10 minutes after being unplugged.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 11: Check Heat Safety Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "fse-heat-check-01",
      question: "You finish using a heat gun. The nozzle is very hot. What should you do?",
      options: [
        "Unplug it and set it on your bench to cool",
        "Place it on a dedicated heat-resistant stand away from flammable materials and let it cool unplugged",
        "Blow on it to cool it faster",
        "Spray it with water to cool it quickly",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Unplug, place on a dedicated stand, away from materials. Never place hot tools on wood or near flammables. Water on a hot tool creates steam and damages it.",
      feedback_wrong:
        "Not quite. A heat gun nozzle stays 400°C for 10+ minutes after unplugging. It must be on a ceramic/metal stand, not on wood, and away from all materials. Never use water—it damages the tool and creates steam.",
      hint: "A heat gun is still dangerous for how long after being unplugged?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Hot Work Permits & Prevention
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-hotwork-01",
      title: "Hot Work Safety: Planning Before You Use Heat",
      icon: "⚠️",
      content:
        "Whenever you use a heat source (soldering iron, heat gun, kiln, torch, grinding wheel), you're responsible for preventing fire.\n\n" +
        "**Before using any heat source:**\n" +
        "1. **Clear the workspace** — Remove all flammable materials within 1 metre (paper, fabric, cardboard, solvents)\n" +
        "2. **Use a dedicated stand** — Never place hot tools on wood benches or tabletops. Use ceramic, metal, or fire-resistant stands\n" +
        "3. **Notify your teacher** — They should know hot work is happening and check the setup\n" +
        "4. **Keep water nearby** — Have water or a fire extinguisher within arm's reach as a backup\n" +
        "5. **No multitasking** — Don't use a heat gun while holding other materials. Full attention on the hot tool\n" +
        "6. **Cool-down time** — Plan for 10-15 minutes cool-down AFTER unplugging before you leave\n\n" +
        "**During hot work:**\n" +
        "- Watch the area around the heat source\n" +
        "- Don't leave a heat source unattended (even for 30 seconds)\n" +
        "- If you need to step away, unplug it first\n" +
        "- Alert others in the workshop: 'Hot work in progress'\n\n" +
        "**After hot work:**\n" +
        "- Unplug the tool\n" +
        "- Place it on a stand to cool\n" +
        "- Stay in the area during cool-down\n" +
        "- Don't leave until it's completely cool to touch\n\n" +
        "**Common Hot Work Hazards:**\n" +
        "- Soldering irons: 400°C nozzle, ignites cardboard instantly\n" +
        "- Heat guns: 600°C airflow, can ignite materials 1 metre away\n" +
        "- Kilns: can ignite nearby materials if insulation is damaged\n" +
        "- Grinding wheels: create sparks that travel 2+ metres\n" +
        "- Torches: open flame, highest ignition risk",
      tips: [
        "Hot work is a planned activity—don't improvise",
        "Your teacher should approve your hot work setup before you start",
        "If someone else is doing hot work nearby, stay clear of the area",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 13: Evacuation Drill & Assembly Point
    // ========================================================================
    {
      type: "step_by_step",
      id: "fse-evacuation-steps-01",
      title: "Evacuation Procedure: Know Your Way Out",
      steps: [
        {
          number: 1,
          instruction:
            "**ACTIVATE THE ALARM** (if you discovered the fire). Pull down the fire alarm lever firmly. It will set off the school-wide alarm and alert the fire service. Don't worry about 'false alarms'—that's what the system is designed for.",
          checkpoint:
            "Alarm is sounding. Everyone in the school is now aware of the emergency.",
        },
        {
          number: 2,
          instruction:
            "**ALERT OTHERS** (if you haven't activated the alarm yet). Shout clearly: 'FIRE! Everyone evacuate!' Point toward the nearest exit. Don't assume people heard the alarm—use your voice.",
          checkpoint:
            "Nearby people are aware and beginning to move toward exits.",
        },
        {
          number: 3,
          instruction:
            "**EXIT IMMEDIATELY** via the nearest safe exit. Do NOT use an elevator. Do NOT go back for belongings (phone, shoes, project, bag). Leave everything. Speed is critical.",
          warning:
            "Do not block doorways or exits for others. Efficient evacuation saves lives.",
        },
        {
          number: 4,
          instruction:
            "**CLOSE DOORS BEHIND YOU** (without slamming). Modern fire doors close slowly and are designed to slow smoke and flame spread. You're not trapping anyone—you're protecting the hallway.",
          checkpoint:
            "You're out of the building and moving to the assembly point.",
        },
        {
          number: 5,
          instruction:
            "**MOVE TO THE ASSEMBLY POINT** (oval, car park, or designated area). Move at a fast walk—don't run (running causes people to panic). Stay with your group and your teacher.",
          image: "/images/safety/evacuation-assembly-point.png",
        },
        {
          number: 6,
          instruction:
            "**STAY AT THE ASSEMBLY POINT** until the teacher has accounted for everyone and given the all-clear. Do NOT leave the group. Do NOT go back inside. Wait for the teacher to say it's safe.",
          checkpoint:
            "You're at a safe distance. Everyone is accounted for. Firefighters are handling the emergency.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 14: Know Your Assembly Point
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-assembly-01",
      title: "Know Your Assembly Point RIGHT NOW",
      icon: "📍",
      content:
        "In a real emergency, there's no time to figure out where to go. You need to know your assembly point before a fire ever happens.\n\n" +
        "**Question: Where is your workshop's assembly point?**\n" +
        "Typical locations: \n" +
        "- Oval/playing field\n" +
        "- Car park\n" +
        "- Tennis courts\n" +
        "- Designated outdoor zone\n\n" +
        "The assembly point is always:\n" +
        "- Outdoors (away from building in case of structural collapse)\n" +
        "- At least 100 metres from the building\n" +
        "- In an open area with good visibility\n" +
        "- A place where the teacher can account for all students\n\n" +
        "**Your responsibility:**\n" +
        "- Know the location by name\n" +
        "- Know the route from your workshop\n" +
        "- Know how long it takes to walk there (usually 3-5 minutes)\n" +
        "- In an emergency, get there FAST\n\n" +
        "**THIS IS NOT A JOKE.**\n" +
        "Every year, students die in fires because they didn't know where the assembly point was, got confused, or went back inside to find friends. Don't let that be you. ASK YOUR TEACHER TODAY: 'Where is our assembly point?'",
      tips: [
        "Ask your teacher RIGHT NOW—don't wait for the next fire drill",
        "Walk the evacuation route once (from workshop to assembly point)",
        "Remember the location and the route—they won't change",
      ],
      warning:
        "If you don't know where to go in an emergency, you might panic or go the wrong direction. Ask today.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 15: Final Scenario - Putting It All Together
    // ========================================================================
    {
      type: "scenario",
      id: "fse-scenario-final-01",
      title: "Complete Emergency Response",
      setup:
        "You're working in the workshop. A student using a soldering iron accidentally knocks over the iron into a cardboard scrap box. The box catches fire. The flames are growing fast and starting to spread to nearby paper materials. Your teacher is across the room. What sequence of actions do you take?",
      branches: [
        {
          id: "fse-final-a",
          choice_text: "Grab the fire extinguisher and try to put it out immediately",
          is_correct: false,
          feedback:
            "NO—wrong first step. You should alert your teacher FIRST. The fire is spreading rapidly. Your teacher makes the decision: extinguish or evacuate. You don't decide alone.",
          consequence:
            "By the time your teacher notices, the fire is bigger, and you've wasted time not getting an adult.",
        },
        {
          id: "fse-final-b",
          choice_text: "Alert your teacher immediately, then follow their instructions (extinguish or evacuate)",
          is_correct: true,
          feedback:
            "✓ CORRECT. Alert an adult first. Teacher assesses and decides: 'Grab the extinguisher' or 'Everyone out, activate the alarm.' You follow the teacher's call.",
          consequence:
            "The teacher makes the decision with full information, and the emergency is handled correctly.",
        },
        {
          id: "fse-final-c",
          choice_text: "Activate the fire alarm immediately and evacuate everyone",
          is_correct: false,
          feedback:
            "Partly right on the action, but slightly wrong on the trigger. A small, growing fire isn't an automatic 'evacuate.' The teacher needs to assess first. If it's contained, extracting might be overkill. If it's not, yes, activate the alarm.",
          consequence:
            "You might evacuate the entire building for a fire that could have been contained. Better safe than sorry, though.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 16: Summary & Ready for Quiz
    // ========================================================================
    {
      type: "key_concept",
      id: "fse-summary-01",
      title: "You're Ready: Fire Safety Quiz Ahead",
      icon: "✅",
      content:
        "You've learned the critical fire safety practices:\n\n" +
        "✓ **Fire Triangle** — Heat + Fuel + Oxygen = Fire. Remove one = fire dies.\n" +
        "✓ **Extinguisher Types** — Blue (wood), Red (oil), Yellow (electrical), White (metal)\n" +
        "✓ **PASS Technique** — Pull, Aim (at base), Squeeze, Sweep\n" +
        "✓ **Know When to Evacuate** — If larger than a shoebox or spreading = get out\n" +
        "✓ **Burns Treatment** — Cool water for 10+ minutes, don't pop blisters\n" +
        "✓ **Prevention** — Clear workspace, use dedicated heat stands, alert teacher before hot work\n" +
        "✓ **Evacuation** — Know assembly point, exit immediately, stay with group\n" +
        "✓ **Hot Work** — Plan, clear area, don't multitask, cool-down time\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need **10 out of 12 questions correct** to earn your Fire Safety & Emergency badge.\n\n" +
        "**Remember:** Fire moves fast. These rules exist because people learned them the hard way. Your knowledge could save a life—maybe your own.",
      tips: [
        "If you're unsure, think: 'What's the safest option?' That's usually right.",
        "Fire safety is serious—answer honestly",
        "Earning this badge means you're prepared for an emergency",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type FireSafetyEmergencyModuleType = typeof FIRE_SAFETY_MODULE;
