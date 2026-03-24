/**
 * PPE (Personal Protective Equipment) Fundamentals Learning Module
 *
 * Covers selection, proper use, inspection, and care of all PPE categories:
 * - Safety eyewear types and when to wear
 * - Hearing protection (when >85dB)
 * - Gloves (when to wear AND when NOT to — rotating machinery!)
 * - Dust masks vs respirators
 * - Aprons and closed-toe shoes
 * - Inspecting PPE before use
 *
 * Learning flow:
 * 1. Engage: Introduction + spot-the-hazard interactive challenge
 * 2. Inform: PPE categories with key concepts and comprehension checks
 * 3. Apply: Before/after comparisons and realistic failure scenarios
 * 4. Verify: Final checks and summary
 *
 * Total estimated time: 14 minutes
 */

import type {
  LearningModule,
  KeyConceptBlock,
  ComprehensionCheckBlock,
  BeforeAfterBlock,
  MicroStoryBlock,
  StepByStepBlock,
} from "../content-blocks";

export const PPE_MODULE: LearningModule = {
  badge_id: "ppe-fundamentals",
  learning_objectives: [
    "Identify PPE types and their specific purposes",
    "Select correct PPE based on workshop activity",
    "Explain why gloves are NOT safe with rotating machinery",
    "Inspect PPE for damage before use",
    "Understand hearing protection requirements (>85dB)",
    "Apply proper PPE fitting and adjustment",
    "Recognize signs of inadequate or damaged PPE",
  ],
  estimated_minutes: 14,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Engagement
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-intro-01",
      title: "PPE: Your Personal Safety Barrier",
      icon: "🥽",
      content:
        "Personal Protective Equipment (PPE) is your last line of defence when hazards are present. Different activities require different protection—and using the WRONG PPE is almost as dangerous as using NONE.\n\n" +
        "This module takes about **14 minutes** and covers:\n" +
        "- Types of safety eyewear and when to wear them\n" +
        "- Hearing protection (when it's required)\n" +
        "- Gloves (including when NOT to use them—rotating machinery!)\n" +
        "- Dust masks vs respirators (what's the difference?)\n" +
        "- Work aprons, closed-toe shoes, hair management\n" +
        "- Inspecting PPE for damage\n" +
        "- Proper fitting and adjustment\n\n" +
        "**Why this matters:** PPE injuries happen because people wear the WRONG type of PPE, or wear it incorrectly, or use damaged equipment. A cracked safety lens can fail under impact. Gloves that catch rotating machinery can break fingers instantly.",
      tips: [
        "Pay special attention to the 'NOT for this activity' sections—those are the surprise mistakes",
        "Remember: damaged PPE offers zero protection",
        "Your teacher will tell you what PPE is required—ask if you're unsure",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Safety Eyewear Types
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-eyes-01",
      title: "Safety Eyewear: Protection Types & Coverage",
      icon: "👀",
      content:
        "Your eyes are irreplaceable. One flying chip can cause permanent blindness. Safety eyewear types are designed for different hazards.\n\n" +
        "**SAFETY GLASSES (Most Common)**\n" +
        "Impact-resistant plastic lenses, often with side protection. Required when: sawing, drilling, hammering, grinding, sanding, any activity producing flying materials or dust.\n" +
        "NOT sufficient for: chemical splashes, grinding (need full face shield), welding (wrong type of lens).\n\n" +
        "**FACE SHIELD**\n" +
        "Clear plastic curved shield protecting entire front face and sides. Used with or instead of glasses. Required when: grinding (protects full face from wheel fragmentation), working with hazardous chemicals, using hammer and chisel on hard materials.\n" +
        "NOT sufficient alone for: fine dust (particles can get under the shield)—pair with a dust mask.\n\n" +
        "**CHEMICAL SPLASH GOGGLES**\n" +
        "Sealed around the eyes to prevent liquid from reaching skin. Required when: applying adhesives, stains, finishes, or working with solvents.\n" +
        "NOT designed for: impact protection (soft lens)—use with solvent-safe gloves.\n\n" +
        "**LASER SAFETY GLASSES** (if applicable)\n" +
        "Wavelength-specific lenses (laser cutters, etc.). Only use glasses rated for the specific laser wavelength in your workshop.\n\n" +
        "**KEY RULE: Inspect before use.** Cracked, scratched, or cloudy lenses must be replaced immediately.",
      tips: [
        "If glasses feel uncomfortable, adjust them—improper fit means they slide down during work",
        "Anti-fog coatings help—ask your teacher if available",
        "Glasses are a sign you take your eyes seriously—wear them with pride",
        "Some people feel self-conscious wearing safety gear. Remember: every professional workshop worker wears it",
      ],
      warning:
        "A small crack in safety glasses can fail catastrophically under impact. One flying particle through damaged eyewear causes injury. Replace damaged eyewear immediately—never use it.",
      image: "/images/safety/eyewear-types.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Check Eyewear Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "ppe-eyes-check-01",
      question:
        "You're using a bench grinder to sharpen a chisel. What eye protection do you need?",
      options: [
        "Regular safety glasses—standard protection",
        "Safety glasses PLUS a face shield (full coverage)",
        "Just a face shield",
        "Chemical splash goggles",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Grinding creates high-velocity fragments and dust. Safety glasses alone don't cover enough area. A face shield provides full face protection, and paired with glasses, you're protected from impact and fine dust.",
      feedback_wrong:
        "Not quite. Grinding is one of the highest-hazard activities. You need BOTH impact protection (glasses) and full face coverage (shield). Grinding fragments travel fast and can hit anywhere on your face.",
      hint: "Grinding is one of the most hazardous activities. What's the highest level of eye protection?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 4: Hearing Protection
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-hearing-01",
      title: "Hearing Protection: When Loud Becomes Dangerous",
      icon: "🔊",
      content:
        "Loud noise doesn't just hurt in the moment—it causes permanent hearing loss. The damage is cumulative and irreversible. Once your hearing is gone, it's gone.\n\n" +
        "**The 85dB Rule:**\n" +
        "Any noise at 85 decibels or louder for more than 8 hours requires hearing protection. At 100dB, safe exposure is only 15 minutes. At 110dB, only 1 minute.\n\n" +
        "**Common Workshop Noise Levels:**\n" +
        "- Circular saw: 95dB (requires protection, 15 min max)\n" +
        "- Bench grinder: 95dB (requires protection, 15 min max)\n" +
        "- Angle grinder: 100dB (requires protection, 15 min max)\n" +
        "- Impact driver: 110dB (requires protection, 1 min max)\n" +
        "- Bandsaw: 85dB (borderline—protection recommended)\n" +
        "- Hand tools (sanding, chiseling): <85dB (no protection needed)\n\n" +
        "**Types of Hearing Protection:**\n\n" +
        "**Foam Earplugs**\n" +
        "Cheap, effective, disposable. Roll between fingers, insert deep into ear canal (don't just stick them in the opening). Properly inserted foam plugs reduce noise by 20-30dB. Most common choice for workshops.\n\n" +
        "**Earmuffs**\n" +
        "Reusable, adjustable, less likely to be lost. Can be uncomfortable if worn for long periods. Some have passive noise reduction; others have active noise cancellation (more expensive).\n\n" +
        "**Custom Molded Plugs**\n" +
        "Made from a mold of your ear. Expensive but very effective and comfortable. If your school has them, use them.",
      tips: [
        "Insert foam earplugs correctly: roll them, insert deep, and hold for 10-15 seconds so they expand",
        "If protection feels uncomfortable, adjust it—discomfort means it's not seated properly",
        "Hearing loss is invisible until it's severe. Wear protection before you need it",
        "Muffled sound is the normal feeling of protection—you're still hearing conversations",
      ],
      warning:
        "Hearing damage is PERMANENT. You cannot restore hearing once it's lost. Hearing aids do not restore natural hearing—they amplify existing sound. Wear protection whenever noise is at or above 85dB.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Check Hearing Protection
    // ========================================================================
    {
      type: "comprehension_check",
      id: "ppe-hearing-check-01",
      question:
        "A power tool in your workshop produces 95dB of noise. How long can you safely use it without hearing protection?",
      options: [
        "As long as you want—95dB isn't that loud",
        "About 15 minutes",
        "About 1 hour",
        "Only during short bursts (under 1 minute)",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! At 95dB, safe exposure is about 15 minutes. After that, noise-induced hearing loss begins. This is why impact drivers (110dB) can only be used safely for about 1 minute without protection.",
      feedback_wrong:
        "Not quite. At 95dB (like a circular saw or bench grinder), damage to hearing starts after about 15 minutes without protection. This is why these tools require hearing protection for any use longer than that.",
      hint: "Remember the 85dB rule: at 95dB, you have much less safe time.",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 6: Gloves - The Critical Safety Mistake
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-gloves-01",
      title: "Gloves: When YES, When NO (This Is Critical!)",
      icon: "🧤",
      content:
        "Gloves protect against some hazards but create SEVERE hazards with rotating machinery. This is the #1 mistake students make with PPE.\n\n" +
        "**WEAR GLOVES (Correct Usage):**\n\n" +
        "**Working with Hot Materials**\n" +
        "Leather or heat-resistant gloves when handling hot objects from kilns, soldering, or heat guns (leather is best; avoid synthetic).\n\n" +
        "**Handling Rough Materials**\n" +
        "Leather work gloves when carrying rough wood, handling concrete, or working with sharp sheet metal edges. Protects against splinters and cuts.\n\n" +
        "**Applying Chemicals**\n" +
        "Solvent-resistant gloves (nitrile or neoprene, NOT latex) when applying stains, varnishes, or solvents. Never use latex—most solvents dissolve latex instantly.\n\n" +
        "**Chemical Cleanup**\n" +
        "Any gloves when wiping spills of unknown chemicals.\n\n" +
        "**DO NOT WEAR GLOVES (Dangerous):**\n\n" +
        "**🔴 ROTATING MACHINERY — ABSOLUTE PROHIBITION 🔴**\n" +
        "❌ Never wear ANY gloves near drill presses, bench drills, lathes, belt sanders, or any spinning tool.\n\n" +
        "**Why:** If a glove touches a rotating drill bit or lathe spindle, the glove catches and WRAPS the spindle, pulling your hand and arm in. In milliseconds, you have a broken wrist, crushed hand, or arm fractures. This happens at 800+ RPM (and most power tools run at 1000-3000 RPM).\n\n" +
        "**The sequence:** Glove touches spinning bit → friction grabs the glove → glove wraps spindle → your hand follows → bones break in seconds.\n\n" +
        "**Metal Cutting & Filing**\n" +
        "❌ Do NOT wear gloves when using metal files, hacksaw, or working with deburring tools. If you slip, gloves increase the risk of hand lacerations (the glove pushes your hand into the sharp edge rather than sliding off).\n\n" +
        "**Hand Tools on Brittle Materials**\n" +
        "❌ Avoid gloves when using chisels or knives on hard materials—reduced feedback means higher risk of slipping and cutting your hand.",
      tips: [
        "Before you put on gloves, ask: 'Am I about to use ANY rotating machinery?' If yes, REMOVE the gloves first",
        "Leather is the safest glove material for workshops (it resists heat and solvents)",
        "Nitrile gloves are good for chemicals but poor for other uses—find the right glove for each task",
        "A glove that's too big is more likely to catch machinery—get the right size",
      ],
      warning:
        "Rotating machinery + gloves = severe injury (broken bones, hand crushing, arm entanglement). This is non-negotiable. The moment you approach a drill press, lathe, or spinning tool, gloves must be removed.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: Glove Safety Check
    // ========================================================================
    {
      type: "comprehension_check",
      id: "ppe-gloves-check-01",
      question: "You're about to use a lathe to turn a piece of wood. What do you do?",
      options: [
        "Keep your work gloves on—they protect your hands",
        "Wear leather gloves for better grip",
        "Remove ALL gloves before starting the lathe",
        "Wear nitrile gloves—they're thin so they won't catch",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ CORRECT! Remove ALL gloves before using ANY rotating machinery (lathes, drill presses, belt sanders, etc.). Gloves catch and wrap, pulling your hand and arm into the spindle. It happens instantly at 1000+ RPM.",
      feedback_wrong:
        "Not quite. NO gloves near rotating machinery—not leather, not thin gloves, not 'safe' ones. The glove fabric catches the spinning surface and wraps the spindle, pulling your hand in. This causes broken bones in milliseconds.",
      hint: "Think about what happens if a glove touches a spinning lathe spindle.",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 8: Dust Masks vs Respirators
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-respiratory-01",
      title: "Dust Protection: Masks vs Respirators",
      icon: "😷",
      content:
        "Breathing in fine particles—sawdust, MDF dust, sanding dust, metal fines—damages your lungs permanently. Some dusts cause lung disease that appears years later.\n\n" +
        "**DUST MASKS (Passive Protection)**\n" +
        "Simple paper or cloth masks that filter particles from the air you breathe. Effective for medium-sized particles.\n\n" +
        "**When to wear:** Sanding wood, cutting MDF, working with fiberglass, general dusty work where dust extraction isn't available.\n\n" +
        "**Proper fit:** Place the elastic over your head (not neck), and press the metal nose clip to fit your nose. If you can feel unfiltered air leaking around the sides, it's not fitted correctly.\n\n" +
        "**Limitation:** Masks filter particles down to about 5 microns. Smaller particles (like fine silica dust from stone or concrete) pass through.\n\n\n" +
        "**RESPIRATORS (Active/Forced Protection)**\n" +
        "Powered or cartridge-based systems that create a seal around your face and filter air more completely. Required for high-hazard dusts.\n\n" +
        "**When to wear:**\n" +
        "- Sanding or cutting MDF (formaldehyde-based dust causes lung disease)\n" +
        "- Stone or concrete work (silica dust causes silicosis)\n" +
        "- Metal grinding (metal fines can cause siderosis)\n" +
        "- Spray finishing (solvent vapors + particles)\n" +
        "- Any work producing fine dust where masks are insufficient\n\n" +
        "**Fit testing:** Schools should conduct fit testing so you know if a respirator seals on YOUR face (different faces require different sizes/styles).\n\n" +
        "**Cartridge replacement:** Respirator cartridges have expiration dates and useful life. If you've used it for many hours, the filter may be exhausted. Ask your teacher.\n\n" +
        "**Key difference:** Masks filter passively (you breathe dust that's hopefully trapped). Respirators force clean air in or seal tightly so less unfiltered air leaks.",
      tips: [
        "Dust masks feel weird at first—give yourself 1-2 minutes to adjust",
        "Never re-wear a disposable dust mask (the filter gets clogged and your protection drops)",
        "Hair, stubble, or dry skin around the seal breaks the seal—respirators require a clean face",
        "If you have facial hair and need to wear a respirator, you may need to shave for it to seal properly",
      ],
      warning:
        "Lung damage from dust is cumulative and irreversible. You won't feel it happening. Particles smaller than 5 microns (dust from stone, concrete, hardwoods) can reach your lungs and cause permanent scarring. Wear appropriate protection.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 9: Check Respiratory Protection
    // ========================================================================
    {
      type: "comprehension_check",
      id: "ppe-respiratory-check-01",
      question:
        "You're sanding MDF for a project. MDF dust causes lung disease. You have a dust mask available. What should you do?",
      options: [
        "Wear the dust mask—it's sufficient protection",
        "Skip protection (you'll only sand for 10 minutes)",
        "Ask your teacher if a powered respirator is available",
        "Open the windows for ventilation and skip the mask",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! MDF dust (formaldehyde-based) requires higher protection. A dust mask filters larger particles but may not catch all MDF dust. Ask your teacher about powered respirators or ensure dust extraction is running. This dust causes long-term lung damage.",
      feedback_wrong:
        "Not quite. MDF dust is a high-hazard respiratory hazard. A simple mask may not be sufficient—powered respirators or strong dust extraction is safer. Window ventilation helps but doesn't protect your lungs from the dust you're breathing near the source.",
      hint: "Think about the severity of MDF dust. Is basic passive filtration enough?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 10: Body Protection & Footwear
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-body-01",
      title: "Body Protection: Aprons, Shoes & Clothing",
      icon: "👕",
      content:
        "Your body needs protection from heat, chemicals, sharp materials, and dropped tools.\n\n" +
        "**WORK APRONS**\n" +
        "Canvas or leather apron covering from chest to knees. Protects your clothes and skin from:\n" +
        "- Hot materials (solder splatter, kiln contact, heat gun spray)\n" +
        "- Chemical stains (dyes, stains, finishes, adhesives)\n" +
        "- Sharp chips (metal shavings, wood splinters)\n" +
        "- Oil and grease\n\n" +
        "**Best practice:** Wear an apron every time you're in the workshop, regardless of the activity. You never know when you'll need it.\n\n\n" +
        "**CLOSED-TOE SHOES (Mandatory)**\n" +
        "❌ No sandals, flip-flops, crocs with holes, or open-back shoes.\n" +
        "✓ Closed-toe shoes (sneakers, work boots, canvas shoes) that cover your entire foot.\n\n" +
        "**Why:** Dropped tools cause foot injuries. A 2kg hammer falling from 1 meter hits your foot with 20kg of force—enough to break bones. Concrete floors don't help. Closed-toe shoes are your foot's armour.\n\n" +
        "**Shoe features:** Look for shoes with oil-resistant soles (especially around machinery) and non-slip soles (workshop floors can be slippery with sawdust and oil).\n\n\n" +
        "**LONG HAIR MANAGEMENT**\n" +
        "❌ Never work with long loose hair near power tools.\n" +
        "✓ Tie it back BEFORE using any power tool.\n\n" +
        "**Why:** Long hair can get caught in rotating machinery and be pulled in before you can stop it. Scalp lacerations and hair loss result. This is especially dangerous with lathes, belt sanders, and drill presses.\n\n\n" +
        "**LOOSE CLOTHING HAZARDS**\n" +
        "❌ Avoid oversized clothes, dangling sleeves, or loose scarves—they can catch machinery.\n" +
        "❌ Remove jewellery that could snag (watch, dangling earrings, chains).\n" +
        "❌ Don't wear hoodie strings that dangle—they can get caught.\n" +
        "✓ Fitted clothing that moves with you, not against you.",
      tips: [
        "Wear an apron every workshop session—makes clean-up easier too",
        "Check your shoes before entering the workshop—covered toes are non-negotiable",
        "If you have long hair, tie it back as part of your 'getting ready to work' routine",
        "Avoid oversized hand-me-down clothes that get in the way",
      ],
      warning:
        "Machinery catches loose hair, clothing, and jewellery in milliseconds. Once caught, the material wraps the spindle, pulling your body part in. Fitted clothes, tied-back hair, and no jewellery are your protective boundaries.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 11: Before/After - Wrong vs Right PPE
    // ========================================================================
    {
      type: "before_after",
      id: "ppe-wrong-right-01",
      title: "PPE: What NOT To Do vs Correct Setup",
      before: {
        caption: "NOT SAFE: Multiple PPE mistakes",
        hazards: [
          "No safety glasses—eyes unprotected from flying chips",
          "Open-toed sandals—feet unprotected from dropped tools",
          "Long loose hair—entanglement risk with machinery",
          "Gloves on while approaching drill press—will catch rotating bit",
          "No hearing protection—loud noise will damage hearing permanently",
          "Dangling hoodie strings—will catch in spinning equipment",
          "No apron—clothes will absorb chemicals and stains",
        ],
        image: "/images/safety/ppe-wrong.png",
      },
      after: {
        caption: "SAFE: Complete and correct PPE setup",
        principles: [
          "Safety glasses on—eyes fully protected from impact and particles",
          "Hearing protection in—earplugs inserted correctly for machine work",
          "Hair tied back—no entanglement risk",
          "Closed-toe shoes—feet protected from dropped tools",
          "Work apron on—body protected from chemicals and hot materials",
          "Fitted clothing—no loose sleeves or strings to catch",
          "Gloves REMOVED before using rotating machinery",
          "No jewellery—nothing to snag or catch",
        ],
        image: "/images/safety/ppe-right.png",
      },
      key_difference:
        "The difference between a safe work session and a preventable injury is 2 minutes of getting dressed properly. PPE isn't optional—it's the contract between you and the workshop.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 12: Inspecting PPE
    // ========================================================================
    {
      type: "step_by_step",
      id: "ppe-inspection-steps-01",
      title: "Inspecting PPE Before Each Use",
      steps: [
        {
          number: 1,
          instruction:
            "**SAFETY GLASSES:** Check the lenses for cracks, scratches, or cloudiness. Look at the temples (arms) for cracks. If either is damaged, put the glasses in the 'replace' bin—do NOT use them.",
          warning:
            "A small crack will fail under impact. Your eyes are worth replacing damaged glasses.",
        },
        {
          number: 2,
          instruction:
            "**DUST MASK or RESPIRATOR:** Check for tears in the material. Check that the straps are not worn or broken. If you find any damage, discard it (masks are disposable). For respirators, check the cartridges are not expired.",
          checkpoint:
            "A damaged mask or expired cartridge provides zero protection. Replace it.",
        },
        {
          number: 3,
          instruction:
            "**HEARING PROTECTION:** For foam earplugs, ensure they're not flattened or compressed (they won't expand properly if already flattened). For earmuffs, check that the padding is intact and the headband isn't cracked.",
        },
        {
          number: 4,
          instruction:
            "**WORK GLOVES:** Check for holes, rips, or separation of the lining. For leather gloves, check that the leather hasn't cracked. Wet gloves should be dried before storage (mold damages them).",
          warning:
            "Damaged gloves offer no protection and can make hand injuries worse. Replace them.",
        },
        {
          number: 5,
          instruction:
            "**FACE SHIELD:** Check the clear shield for cracks or significant scratches that reduce visibility. Check that the headband or mounting is secure and not cracked.",
        },
        {
          number: 6,
          instruction:
            "**APRON:** Look for tears, large stains, or separation of seams. If the apron is severely damaged, replace it. Minor stains are OK—that's the apron's job.",
          checkpoint:
            "An apron with a tear no longer protects you. Get a new one.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 13: PPE Failure Story
    // ========================================================================
    {
      type: "micro_story",
      id: "ppe-story-glove-01",
      title: "The Glove That Caught the Drill",
      narrative:
        "Marcus was working on a metal project and decided to drill a hole in a piece of stainless steel. His teacher had just finished demonstrating the drill press. Marcus was wearing leather work gloves to handle the rough metal material.\n\n" +
        "He positioned the work in the clamp and stepped toward the drill press. His glove brushed the rotating drill bit for just a fraction of a second.\n\n" +
        "The leather caught instantly. Before Marcus could react (in about 0.5 seconds), the glove wrapped around the spinning bit, his hand was pulled in, and his wrist twisted severely. The drill stalled from the force of his arm, but the damage was done: a broken wrist, two fractured metacarpals, and deep lacerations from the drill bit.\n\n" +
        "Impact: Emergency room visit, surgery to repair the fractures, 8 weeks of physical therapy, and permanent reduced grip strength in that hand.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the critical safety mistake?",
          reveal_answer:
            "Wearing gloves while approaching rotating machinery. Even though Marcus wasn't using the gloves for drilling, he was wearing them as he walked to the machine. The moment you're near a drill press or any rotating equipment, gloves must be removed.",
        },
        {
          question: "Why did the glove catch so easily?",
          reveal_answer:
            "Leather is a flexible material that catches on rotating surfaces. Once the leading edge of the glove touched the spinning bit, friction pulled the rest of the glove into the rotation, which pulled Marcus's hand and arm in. This happens in milliseconds—you can't react in time.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "Remove all gloves BEFORE walking up to any rotating machinery. The workflow should be: (1) wear gloves while handling material, (2) step away from the machine, (3) remove gloves, (4) set up the work, (5) operate the machine. Never approach a running machine wearing gloves.",
        },
      ],
      key_lesson:
        "Gloves are an excellent protection tool, but they must be removed before ANY interaction with rotating machinery. This isn't a casual guideline—it's a hard rule that prevents broken bones and hand injuries.",
      related_rule: "PPE Rule: No gloves near rotating machinery—ever",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 14: Final Check - PPE Comprehensive
    // ========================================================================
    {
      type: "comprehension_check",
      id: "ppe-final-check-01",
      question:
        "You've just finished sanding a project and you're about to use the drill press. Your work gloves are still on. What do you do?",
      options: [
        "Keep the gloves on—they protect your hands",
        "Remove the gloves before touching the drill press—they'll catch the bit",
        "Use just one glove on your non-dominant hand",
        "Keep gloves on but hold your hands away from the spindle",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ CORRECT! Remove ALL gloves before ANY interaction with the drill press. Even if you're just setting up the work, gloves can catch the rotating bit. This is an absolute rule with zero exceptions.",
      feedback_wrong:
        "Not quite. Gloves and rotating machinery don't mix. Leather catches the spinning bit in milliseconds, pulls your hand in, and causes broken bones. The moment you step toward a drill press or lathe, gloves must be removed—no exceptions, no shortcuts.",
      hint: "What's the rule about gloves and rotating machinery?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 15: Summary & Readiness
    // ========================================================================
    {
      type: "key_concept",
      id: "ppe-summary-01",
      title: "PPE Mastery: You're Ready",
      icon: "✅",
      content:
        "You've learned how to select, use, inspect, and maintain personal protective equipment that keeps you safe in the workshop:\n\n" +
        "✓ **Safety Eyewear** — Choose the right type (glasses, shield, goggles) for the activity\n" +
        "✓ **Hearing Protection** — Wear earplugs when noise is 85dB or louder\n" +
        "✓ **Gloves** — Wear when handling rough/hot/chemical materials; REMOVE before rotating machinery\n" +
        "✓ **Respiratory Protection** — Dust masks for general dust, respirators for hazardous dusts\n" +
        "✓ **Body Protection** — Apron, closed-toe shoes, tied-back hair, no loose clothing\n" +
        "✓ **Inspection** — Check every piece of PPE before use—damaged equipment offers zero protection\n\n" +
        "**The Golden Rules:**\n" +
        "1. Always wear appropriate PPE for the activity\n" +
        "2. Inspect before use—replace damaged equipment immediately\n" +
        "3. No gloves near rotating machinery (absolute rule)\n" +
        "4. Damaged PPE is not 'good enough'—it's useless\n" +
        "5. Proper fit is essential—take 30 seconds to adjust\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your PPE Fundamentals badge.\n\n" +
        "Remember: Your teacher will remind you about PPE every time you enter the workshop. They're not being annoying—they're protecting your body from permanent injury.",
      tips: [
        "Take your time answering the quiz—think about what your teacher would want you to do",
        "If a question seems unclear, re-read it carefully—test designers are specific for a reason",
        "Earning this badge means you understand PPE at an expert level—that's something to be proud of",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type PPEModuleType = typeof PPE_MODULE;
