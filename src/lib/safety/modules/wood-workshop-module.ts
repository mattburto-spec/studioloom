/**
 * Wood Workshop Safety Learning Module
 *
 * Covers wood-specific hazards and safety practices:
 * - Dust hazards (fine dust causes lung disease)
 * - Dust extraction systems and proper use
 * - Safe use of bench vises (clamping, work positioning)
 * - Sanding safety (dust, fragmentation, proper technique)
 * - Finishing chemicals (ventilation, no eating/drinking)
 * - Wood splinter and sharp edge handling
 * - Clean workspace importance (fire hazard, trip hazard)
 *
 * Learning flow:
 * 1. Engage: Introduction + woodworking-specific scenarios
 * 2. Inform: Dust hazards, extraction, clamping, sanding concepts
 * 3. Apply: Before/after comparisons and realistic failure scenarios
 * 4. Verify: Comprehension checks and final summary
 *
 * Total estimated time: 15 minutes
 */

import type {
  LearningModule,
  KeyConceptBlock,
  ComprehensionCheckBlock,
  BeforeAfterBlock,
  MicroStoryBlock,
  StepByStepBlock,
} from "../content-blocks";

export const WOOD_WORKSHOP_MODULE: LearningModule = {
  badge_id: "wood-workshop-safety",
  learning_objectives: [
    "Explain why wood dust is hazardous to lungs",
    "Operate dust extraction systems correctly",
    "Clamp work securely in bench vises",
    "Sand safely with proper dust protection",
    "Handle finishing chemicals with proper ventilation",
    "Remove splinters and manage sharp edges",
    "Maintain a clean workspace to prevent fires and trips",
    "Recognize the difference between safe and unsafe dust control",
  ],
  estimated_minutes: 15,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Engagement
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-intro-01",
      title: "Wood Workshop: The Hidden Hazards",
      icon: "🪵",
      content:
        "Woodworking looks straightforward—you cut, sand, and finish. But wood dust is a silent killer that damages your lungs in ways you won't notice until years later. Other hazards are more immediate: splinters, sharp edges, chemical fumes, vise accidents, and fires from accumulated sawdust.\n\n" +
        "This module takes about **15 minutes** and covers:\n" +
        "- Why wood dust is hazardous to your lungs\n" +
        "- How dust extraction systems work and why they're essential\n" +
        "- Safe clamping and vise techniques\n" +
        "- Sanding safely (dust, fragmentation, proper protection)\n" +
        "- Working with finishing chemicals (stains, varnishes, adhesives)\n" +
        "- Splinter and sharp edge management\n" +
        "- Why a clean workshop prevents fires and accidents\n\n" +
        "**Why this matters:** Woodworkers develop lung disease from accumulated dust exposure. This is occupational, meaning it happens to people who use workshops regularly. You're building habits NOW that either protect or damage your lungs over time.",
      tips: [
        "Pay special attention to the dust hazard section—this is the biggest long-term risk in woodworking",
        "Dust extraction isn't optional—it's as essential as safety glasses",
        "Think about what you want your lungs to be like in 20 years",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Wood Dust Hazards
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-dust-01",
      title: "Wood Dust: The Occupational Hazard You Can't See",
      icon: "💨",
      content:
        "Wood dust particles are so fine that they float in the air for hours after work stops. When you breathe them in, they travel deep into your lungs, where your body's natural cleaning system can't remove them. Over months and years, they accumulate and cause permanent damage.\n\n" +
        "**Why Wood Dust Is Hazardous:**\n\n" +
        "Fine wood particles (< 5 microns) bypass your throat and settle in the deepest part of your lungs (alveoli). Your body's immune system tries to clean them but gets overwhelmed. The dust triggers inflammation and scarring (fibrosis), which reduces lung capacity permanently.\n\n" +
        "**Health Conditions Caused by Wood Dust:**\n\n" +
        "**Wood Dust Allergic Alveolitis**\n" +
        "Inflammation of the lungs triggered by wood dust exposure. Symptoms: shortness of breath, persistent cough, fatigue. Can develop after months of exposure. Sometimes reversible if you stop the exposure; sometimes permanent.\n\n" +
        "**Occupational Asthma**\n" +
        "Exposure to wood dust causes your airways to become hypersensitive. Your lungs react with inflammation and constriction. Triggers: exercise, cold air, allergens. Once developed, it's lifelong.\n\n" +
        "**Chronic Obstructive Pulmonary Disease (COPD)**\n" +
        "Years of dust exposure cause permanent airway damage. Symptoms: chronic cough, shortness of breath on exertion, wheezing. NOT reversible. Requires medications and inhalers for life.\n\n" +
        "**Cancers Associated with Wood Dust**\n" +
        "Adenocarcinoma of the sinuses (very rare, high mortality) is associated with heavy hardwood dust exposure over years. Softwoods are lower risk; hardwoods (oak, ash, etc.) are higher risk.\n\n" +
        "**The Key Insight:**\n" +
        "You feel FINE while the damage is happening. The dust accumulates silently. By the time you notice symptoms (shortness of breath, persistent cough), significant lung damage has already occurred. Prevention is the only option.",
      tips: [
        "Dust particles are so fine you can't see most of them—you must assume they're present and protect accordingly",
        "Dust lingers in the air for hours after work stops—even if you don't see particles, they're still floating",
        "Different wood species have different hazard levels. Hardwoods are riskier than softwoods",
        "Once lung damage occurs, you can't undo it. Prevention is the only strategy",
      ],
      warning:
        "Wood dust damage is permanent and cumulative. You won't feel it happening. By the time you notice shortness of breath or cough, significant lung damage has already occurred. Dust extraction isn't optional—it's the boundary between a healthy future and chronic disease.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Check Dust Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "wws-dust-check-01",
      question:
        "You finish sanding for 30 minutes. The air looks clear—you don't see visible dust. Can you safely remove your dust mask?",
      options: [
        "Yes—if you don't see dust, it's gone",
        "No—fine particles are invisible and still in the air",
        "Yes, but only after you leave the workshop",
        "Maybe, if dust extraction was running",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Fine wood dust is invisible to the naked eye. It floats in the air for hours after sanding stops. Even if the air looks clear, particles are still suspended and will enter your lungs if you breathe them. Keep your mask on and wait for extraction to clear the air.",
      feedback_wrong:
        "Not quite. This is the hidden hazard of wood dust—it's invisible. Fine particles (< 5 microns) float in the air long after sanding stops. Just because you don't see dust doesn't mean it's gone. This is why dust extraction is essential.",
      hint: "Think about particle size. Can you see particles that are smaller than a grain of sand?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 4: Dust Extraction Systems
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-extraction-01",
      title: "Dust Extraction: How It Works & Why It's Essential",
      icon: "⚙️",
      content:
        "Dust extraction systems are the PRIMARY control for dust hazards in woodshops. They remove dust at the source (at the tool) rather than relying on you to inhale it and hoping your mask catches it.\n\n" +
        "**How Dust Extraction Works:**\n\n" +
        "**Source Capture** — A hose or hood positioned at the tool (like a sander or saw) captures dust immediately after it's created. Captured dust is drawn through a hose into a collection system.\n\n" +
        "**HEPA Filter** — Most workshop extractors use HEPA (High-Efficiency Particulate Air) filters that trap 99.97% of particles > 0.3 microns. This means even fine dust gets trapped.\n\n" +
        "**Air Flow** — The extractor creates suction strong enough to pull dust from the source before it disperses into the workshop air. Typical extraction rate: 100-200 cubic feet per minute (CFM) for stationary tools.\n\n" +
        "**Collection Bin** — Captured dust falls into a bin or bag. This bin must be emptied regularly—a clogged filter stops extraction.\n\n\n" +
        "**Types of Extraction Systems:**\n\n" +
        "**Portable Shop Vac**\n" +
        "For sanders, band saws, small tools. Connects with a hose. Effective if the hose is positioned correctly at the dust source.\n\n" +
        "**Fixed Dust Collector**\n" +
        "Mounted on a wall or ceiling with ducts running to each tool. Provides consistent, powerful extraction for all tools simultaneously.\n\n" +
        "**Cartridge Extractors**\n" +
        "Modern HEPA-filtered units that capture dust in a cartridge. When cartridge fills, you replace it or shake it to dislodge dust.\n\n\n" +
        "**How to Use Dust Extraction Correctly:**\n\n" +
        "1. **Position the hose** — Place the nozzle within 10-15cm of where dust is created. Farther than that, extraction is ineffective.\n\n" +
        "2. **Turn on extraction BEFORE starting the tool** — Extraction must be running before dust is created, not after.\n\n" +
        "3. **Keep the nozzle clear** — If the hose clogs, extraction stops. Check for clogs regularly.\n\n" +
        "4. **Empty the bin** — When the collection bin is more than half full, suction drops dramatically. Empty it regularly (your teacher can tell you when).\n\n" +
        "5. **Replace filters on schedule** — HEPA filters have a lifespan (typically 50-100 hours). When filters clog, they stop working. Use the replacement schedule provided by your school.\n\n" +
        "6. **Work WITH extraction, not against it** — Don't blow dust back toward the nozzle. Work at an angle that lets extraction pull dust into the hose.\n\n\n" +
        "**Dust Mask + Extraction = Complete Protection:**\n" +
        "Extraction controls 95% of dust at the source. Your dust mask catches the remaining 5% that escapes. Together, they're comprehensive. Neither alone is sufficient.",
      tips: [
        "If the extraction nozzle doesn't reach the dust source, move your work closer to it",
        "Listen to the extraction system—if the pitch changes (gets quieter), the filter may be clogged",
        "A clear bin means you can see when it's getting full—fill it to half and empty it",
        "Good dust extraction feels invisible—you don't think about it because it's working so well",
      ],
      warning:
        "Extraction systems are only effective if used correctly. A hose positioned away from the dust source looks like it's working but isn't. Poor extraction is worse than no extraction because it gives false confidence while dust still enters your lungs.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Check Extraction Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "wws-extraction-check-01",
      question:
        "You're about to sand. The dust extraction system is nearby but the hose nozzle is about 30cm away from your sanding area. What should you do?",
      options: [
        "Start sanding—the system will catch dust anyway",
        "Move the nozzle closer to within 10-15cm of the sanding area before starting",
        "Turn up the extraction speed to compensate for distance",
        "Skip extraction and just wear a dust mask",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Extraction effectiveness drops dramatically with distance. The nozzle must be within 10-15cm of the dust source. Taking 30 seconds to reposition the hose prevents months of cumulative dust entering your lungs.",
      feedback_wrong:
        "Not quite. Dust extraction depends on positioning. A hose 30cm away might move some air, but most dust escapes. Extraction is only effective at short range (10-15cm from source). Reposition the nozzle before starting.",
      hint: "How close does the extraction nozzle need to be to work effectively?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 6: Bench Vises and Clamping
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-vise-01",
      title: "Bench Vises: Secure Clamping Prevents Accidents",
      icon: "🔨",
      content:
        "A bench vise is one of the most important workshop tools. When used correctly, it holds your work so you can cut, shape, and file safely. When used incorrectly, it causes your work to slip, kick back, or catch tools.\n\n" +
        "**Why Clamping Matters:**\n\n" +
        "If your work isn't clamped, it can:\n" +
        "- Spin unexpectedly and catch your hand\n" +
        "- Shift during cutting or shaping\n" +
        "- Fly out of your grip and hit someone\n" +
        "- Cause your tool to slip and cut your hand\n\n" +
        "A proper clamp prevents all of these.\n\n" +
        "**How to Use a Bench Vise Safely:**\n\n" +
        "**1. Position Work in the Center**\n" +
        "Place your work directly in the center of the vise jaws, not at the edge. Work at the edge is harder to clamp securely and can bind at an angle.\n\n" +
        "**2. Protect Finished Surfaces**\n" +
        "If your project has a finished surface (paint, stain, careful hand-planing), place a wood block between the vise jaw and the surface. The jaw marks will damage the finish; the scrap block takes the marks instead.\n\n" +
        "**3. Clamp Firmly**\n" +
        "Tighten the vise using both hands on the handle (never one-handed). Tighten until your work doesn't move—it should require effort to shift it even with hand force. Over-tightening can split wood or bend metal, but under-tightening causes slipping.\n\n" +
        "**4. Leave Adequate Access**\n" +
        "Position your work so you have clear access to the area you're working on. Your hands, tools, and the vise shouldn't be fighting for space. If they are, reposition the work.\n\n" +
        "**5. Never Clamp Long Pieces Horizontally**\n" +
        "If your work is longer than the vise opening, the unsupported end will sag and bind. Use a support block under the overhang (or vertical clamping if the vise allows).\n\n" +
        "**6. Release Clamp Pressure When Done**\n" +
        "Always open the vise when you're finished—leaving it clamped stresses the tool and can damage your work over time. It also signals to others that the vise is available.\n\n\n" +
        "**Quick Vise Safety Checklist:**\n" +
        "✓ Work centered, not at the edge\n" +
        "✓ Finished surfaces protected with a scrap block\n" +
        "✓ Clamped firmly (both hands on handle)\n" +
        "✓ Adequate access to the working area\n" +
        "✓ Long pieces supported\n" +
        "✓ Released when finished",
      tips: [
        "If the vise handle is tight, don't force it—you might be over-clamping. Back off slightly",
        "A scrap block between the vise jaw and finished wood is always worth the time",
        "If your work shifts during cutting, stop immediately and re-clamp tighter",
        "Practice clamping with scrap wood first so you develop good habits",
      ],
      warning:
        "Loose clamping causes your work to shift or slip, which makes your tool slip and cut your hand. A vise that seems 'tight enough' usually isn't—tighten more. Proper clamping feels secure; you can't shift the work by hand.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: Sanding Safety
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-sanding-01",
      title: "Sanding: Dust Control & Fragmentation",
      icon: "✨",
      content:
        "Sanding is one of the dustiest workshop activities. Fine sanding dust is the primary cause of wood dust lung disease. Additionally, sanding papers fragment and can cause abrasions.\n\n" +
        "**Dust Control While Sanding:**\n\n" +
        "**Use Dust Extraction**\n" +
        "Position the extraction nozzle within 10-15cm of the sanding area. For stationary sanders (belt, disc, orbital), extraction should be built-in. For hand sanding, position a portable extractor nearby.\n\n" +
        "**Wear a Dust Mask or Respirator**\n" +
        "Dust masks (passive) for light hand sanding. Respirators (powered or cartridge-based) for heavy machine sanding or when dust extraction is absent. Never sand without respiratory protection.\n\n" +
        "**Wet Sanding Reduces Dust**\n" +
        "For fine finishing work, wet the sandpaper slightly to reduce airborne dust. This works well for final smoothing but not for heavy stock removal.\n\n" +
        "**Work With Ventilation**\n" +
        "Keep workshop windows and doors open. Fans positioned to direct dust toward windows help clear the air. However, air movement alone isn't sufficient—you still need extraction and a mask.\n\n\n" +
        "**Sanding Paper Fragmentation:**\n\n" +
        "**Worn Paper Creates Debris**\n" +
        "As sanding paper wears, grit particles dull, and the paper breaks apart. Fragments can flake off and create sharp splinters. Replace sanding paper when:\n" +
        "- The surface feels slick instead of grabby\n" +
        "- Dust production drops (the paper isn't cutting anymore)\n" +
        "- You see tears or missing sections\n\n" +
        "**Sanding on Metal vs Wood**\n" +
        "Metal is harder than wood and dulls sanding paper faster. Sand metal more gently and replace paper more frequently. Metal particles are sharp and can cause painful splinters—wear gloves when handling metal work pieces.\n\n\n" +
        "**Safe Sanding Technique:**\n" +
        "- Start with coarse grit (80-120) for heavy removal; progress to fine grit (220+) for finishing\n" +
        "- Sand WITH the wood grain (for hand sanding), not against it—you'll get a smoother finish\n" +
        "- Apply even pressure—don't press hard, just let the paper do the work\n" +
        "- For machine sanders (orbital, belt), keep moving—staying in one spot gouges the wood\n" +
        "- Never exceed recommended RPM for a tool—high speed creates excessive heat and dust",
      tips: [
        "Dust masks feel weird at first, but your future lungs are worth 30 seconds of adjustment",
        "Sanding paper is cheap—replace it frequently rather than pushing dull paper",
        "Hand sanding with the grain gives you the silkiest finish—you'll feel the difference",
        "If sanding seems to be producing more dust than usual, the paper might be dull—replace it",
      ],
      warning:
        "Fine sanding dust is the primary cause of wood dust occupational disease. Dust extraction + dust mask is the minimum standard. Sanding without protection means accepting cumulative lung damage.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 8: Finishing Chemicals Safety
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-finishing-01",
      title: "Finishing Chemicals: Ventilation, Skin, Ingestion",
      icon: "🧪",
      content:
        "Wood stains, varnishes, adhesives, and paint finishes contain solvents (like turpentine) and volatile organic compounds (VOCs). These are hazardous if inhaled, absorbed through skin, or ingested.\n\n" +
        "**Ventilation is Non-Negotiable:**\n\n" +
        "**Good Ventilation Means:**\n" +
        "- Workshop windows and doors open\n" +
        "- Fans positioned to extract fumes outside\n" +
        "- Work in a well-lit, airy space (never in enclosed closets or small rooms)\n" +
        "- Fume odour is minimal—if you're smelling strong fumes, ventilation is inadequate\n\n" +
        "**Respiratory Protection:**\n" +
        "- Dust masks do NOT protect against solvent vapours (the molecules are too small)\n" +
        "- For chemical work, you need a cartridge respirator with organic vapor cartridges (activated charcoal)\n" +
        "- Ask your teacher before using any solvent-based finish\n\n" +
        "**Skin Contact Hazards:**\n\n" +
        "**Solvents Absorb Through Skin**\n" +
        "Some solvents (like turpentine) penetrate skin easily and enter your bloodstream. Once absorbed, they can cause organ damage (liver, kidneys, nervous system).\n\n" +
        "**Skin Sensitivity**\n" +
        "Some finishes cause contact dermatitis (itching, rash, blistering). If your skin reacts:\n" +
        "- Stop contact immediately\n" +
        "- Wash thoroughly with soap and water\n" +
        "- Apply antihistamine cream if itching develops\n" +
        "- Tell your teacher—you may need to avoid that product\n\n" +
        "**Glove Selection:**\n" +
        "NOT latex (solvents dissolve latex). Use nitrile or neoprene gloves rated for the specific solvent you're using. Ask your teacher which gloves are appropriate for each chemical.\n\n\n" +
        "**Ingestion Hazard (Don't Be Silly, But Still...):**\n\n" +
        "**NO eating, drinking, or smoking in the workshop where finishes are used.**\n\n" +
        "If you're eating a snack and solvent residue is on your hands, you ingest the solvent. If you're drinking from a cup on the bench, spill can contaminate your drink. These scenarios seem unlikely, but accidents happen.\n\n" +
        "**Rule: Finish work in one area, snacks in another area (separate room). Never mix.**\n\n\n" +
        "**Safe Finishing Workflow:**\n\n" +
        "1. Ensure ventilation is running (windows open, fan on)\n" +
        "2. Put on appropriate gloves (nitrile for solvents, NOT latex)\n" +
        "3. Wear a respirator if required (ask your teacher)\n" +
        "4. Apply finish with brush or spray, following product instructions\n" +
        "5. Let curing happen in a well-ventilated area\n" +
        "6. Clean tools immediately in appropriate solvent (turpentine for oil-based finishes)\n" +
        "7. Dispose of rags properly (solvent-soaked rags can self-ignite—place in metal waste can with water or ask teacher)",
      tips: [
        "Ask your teacher about every chemical finish before you use it—hazard varies widely",
        "If a finish smells strong, ventilation is inadequate—stop and improve ventilation first",
        "Glove selection matters—wrong gloves = no protection",
        "Oil-soaked rags can catch fire spontaneously if bunched up—lay them flat to dry or soak in water",
      ],
      warning:
        "Solvent vapours and skin absorption cause organ damage that you might not notice until weeks later (liver damage, neurological symptoms). Some people develop chemical sensitivities that last years. Always: ventilate well, use correct gloves, never eat/drink in chemical areas.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 9: Splinters & Sharp Edges
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-splinters-01",
      title: "Splinters & Sharp Edges: Prevention & Removal",
      icon: "🪚",
      content:
        "Wood splinters hurt, can cause infections if not removed, and are often preventable.\n\n" +
        "**Prevention (Best Strategy):**\n\n" +
        "**Sand the Edges**\n" +
        "After cutting, always sand edges smooth using fine grit (150+). This removes the sharp fibres that cause splinters. Takes 2 minutes, prevents many splinters.\n\n" +
        "**Wear Gloves When Handling Rough Stock**\n" +
        "Leather work gloves protect your hands from splinters. Wear them when handling freshly cut wood or rough materials.\n\n" +
        "**Identify Vulnerable Areas**\n" +
        "End grain (the cut edge across the wood grain) is splinter-prone. Around saw kerfs and drill holes are also vulnerable.\n\n" +
        "**Use Hand-Planing on End Grain**\n" +
        "For a professional finish on end grain, a sharp hand plane produces glass-smooth surfaces with no splinters. Power sanders can also work, but careful hand work is superior.\n\n\n" +
        "**Splinter Removal:**\n\n" +
        "**Small Splinters (<5mm)**\n" +
        "1. Clean the area with soap and water\n" +
        "2. Use a sterile needle to gently lift the splinter edge\n" +
        "3. Grasp with fine tweezers and pull out at the same angle it entered\n" +
        "4. Clean with antiseptic\n" +
        "5. If it's small and doesn't hurt, you can leave it (your body will eventually push it out)\n\n" +
        "**Larger Splinters**\n" +
        "1. Soak the area in warm water for 10 minutes to soften the skin and make removal easier\n" +
        "2. Disinfect a needle with alcohol\n" +
        "3. Carefully probe and lift the splinter\n" +
        "4. Pull out with tweezers\n" +
        "5. Disinfect and apply bandage if bleeding\n\n" +
        "**Deep or Painful Splinters**\n" +
        "If a splinter is very deep, painful, or showing signs of infection (swelling, redness, warmth), see a school nurse or doctor. Some splinters need professional removal.\n\n\n" +
        "**Infection Prevention:**\n\n" +
        "Wood splinters can cause infections because:\n" +
        "- Wood carries bacteria\n" +
        "- The splinter creates a path for bacteria into deeper skin layers\n" +
        "- Moisture (from unwashed hands or sweat) promotes infection\n\n" +
        "**Signs of infection:**\n" +
        "- Increased pain over 24 hours\n" +
        "- Redness or swelling extending beyond the splinter\n" +
        "- Warmth around the area\n" +
        "- Pus or discharge\n\n" +
        "Report infected splinters to your teacher immediately.",
      tips: [
        "Sanding edges smooth is 100x easier than removing splinters—always do it",
        "A sharp needle and fine tweezers make splinter removal much easier than trying to pick it out with fingernails",
        "Soaking the area before removal reduces pain and makes the splinter easier to pull out",
        "If you can't remove a splinter easily, ask your teacher or a school nurse—don't force it",
      ],
      warning:
        "Deep splinters can cause infections that spread and require antibiotics. Always remove splinters promptly and disinfect. If you see signs of infection (redness, warmth, swelling), report it immediately.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 10: Clean Workspace = Safe Workspace
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-housekeeping-01",
      title: "Workshop Housekeeping: Fire & Trip Hazards",
      icon: "🧹",
      content:
        "A clean workshop is a safe workshop. Sawdust and wood shavings on the floor create two critical hazards: fire and slips.\n\n" +
        "**Fire Hazards from Sawdust:**\n\n" +
        "**Sawdust + Heat = Fire**\n" +
        "Sawdust has enormous surface area (fine particles) relative to its volume. This makes it EXTREMELY flammable. A spark from a grinder or friction from a power tool can ignite accumulated sawdust in seconds.\n\n" +
        "**Real Example:** Sawdust near a heat gun outlet, soldering iron, or angle grinder can spontaneously catch fire. The fire spreads along sawdust trails on the floor, filling the workshop with smoke in seconds.\n\n" +
        "**Sawdust Near Heat Sources:**\n" +
        "- Ban accumulation within 1 metre of heat guns, soldering irons, grinding wheels\n" +
        "- Sweep constantly in high-heat areas\n" +
        "- Keep fire extinguisher within reach of heat sources\n\n" +
        "**Sawdust in Hidden Spaces:**\n" +
        "- Under benches, in tool racks, in extraction filters\n" +
        "- These accumulate silently and become fire fuel\n" +
        "- Regular cleaning prevents hidden fire hazards\n\n\n" +
        "**Trip Hazards:**\n\n" +
        "**Sawdust on the Floor**\n" +
        "Accumulated sawdust is a severe slip hazard. Someone walking while carrying a sharp tool or heavy object can slip, fall, and cause injury.\n\n" +
        "**Cable & Tool Hazards**\n" +
        "Extension cords, tool cords, and workshop tools scattered on the floor cause trips. A tripping student carrying a chisel or saw creates serious injury risk.\n\n" +
        "**Exit Routes**\n" +
        "Emergency exits must be clear. Accumulation near doors slows evacuation in emergencies.\n\n\n" +
        "**Housekeeping Best Practice:**\n\n" +
        "**Clean As You Go (Not Just at the End)**\n" +
        "- Sweep around your station every 10-15 minutes\n" +
        "- Put tools back in their racks after use (no scattered tools)\n" +
        "- Wipe spills immediately (oil is especially slippery)\n\n" +
        "**End-of-Session Cleanup**\n" +
        "- Sweep entire workshop floor\n" +
        "- Clear benches and return tools to storage\n" +
        "- Empty dust collection bins (if they're more than half full)\n" +
        "- Check exit routes are clear\n\n" +
        "**Special Areas**\n" +
        "- Around heat sources: no sawdust within 1 metre\n" +
        "- Under benches: check weekly for accumulation\n" +
        "- Extraction system: clean intake nozzle if clogged",
      tips: [
        "Sweep as you work—it's easier than cleaning sawdust at the end of a session",
        "A clean workshop feels better to work in (you can see and move freely)",
        "If someone else's mess is on the workshop floor, tell your teacher—housekeeping is everyone's responsibility",
        "Sawdust on the floor looks harmless; think 'fire fuel' instead",
      ],
      warning:
        "Accumulated sawdust near heat sources is a fire waiting to happen. A spark from a grinder ignites sawdust in milliseconds. The fire spreads along the dust trail and fills the workshop with smoke. Clean constantly, especially near heat sources.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 11: Before/After - Wrong vs Right Wood Workshop
    // ========================================================================
    {
      type: "before_after",
      id: "wws-wrong-right-01",
      title: "Wood Workshop Setup: Unsafe vs Safe",
      before: {
        caption: "NOT SAFE: Multiple wood workshop hazards",
        hazards: [
          "Dust extraction hose positioned 30cm away from sanding—ineffective extraction",
          "No dust mask being worn—fine particles enter lungs unfiltered",
          "Sawdust accumulated on floor—fire hazard and trip risk",
          "Vise holding work at the edge—work could slip or twist",
          "Finishing chemicals without adequate ventilation—fumes accumulating",
          "Gloved hands near power equipment—glove catch hazard",
          "Sharp sanding paper fragments visible—splinter risk",
          "Work not clamped securely—work could shift during cutting",
        ],
        image: "/images/safety/wood-workshop-wrong.png",
      },
      after: {
        caption: "SAFE: Correct wood workshop setup",
        principles: [
          "Dust extraction hose positioned 10-15cm from sanding area—effective capture",
          "Dust mask on—respiratory protection from fine particles",
          "Floor swept clean—no fire hazard, no trip hazard",
          "Work centered and clamped firmly in vise—won't shift",
          "Windows open, fan running—good ventilation for fumes",
          "Gloves removed before power work—no catch hazard",
          "Fresh sanding paper—smooth surfaces, minimal particles",
          "Work protected with scrap block—finished surface won't be marked",
        ],
        image: "/images/safety/wood-workshop-right.png",
      },
      key_difference:
        "Safe woodworking takes 2 minutes of setup (extraction positioning, dust mask, vise clamping, ventilation check) and 1 minute per 15 minutes of work (sweeping). This small investment prevents burns, cuts, infections, and long-term lung damage.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 12: Vise Failure Story
    // ========================================================================
    {
      type: "micro_story",
      id: "wws-story-vise-01",
      title: "The Vise That Wasn't Tight Enough",
      narrative:
        "Sofia was chiseling a decorative edge on a wooden box. She had clamped the box in the bench vise, but she'd been rushing and didn't clamp it as firmly as she should have.\n\n" +
        "As she struck the chisel, the box shifted slightly in the vise. The chisel glanced off the edge and plunged toward Sofia's hand. She jerked her hand away, but the chisel edge caught the fleshy part of her palm, creating a 5cm cut that required 12 stitches.\n\n" +
        "Impact: Emergency room visit, stitches, pain medication, restricted use of her hand for 2 weeks, and permanent scar.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of this injury?",
          reveal_answer:
            "Inadequate clamping. The vise wasn't tight enough to hold the work securely. When the chisel struck, the box shifted, causing the chisel to deflect into Sofia's hand.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "Tighter clamping. When you clamp work in a vise, tighten until your work doesn't move even with deliberate hand force. It takes 10 extra seconds but prevents injuries.",
        },
        {
          question:
            "Was Sofia at fault, or was this just an unavoidable accident?",
          reveal_answer:
            "Sofia made the decision to rush and not clamp firmly. This was preventable. Vise injuries are almost 100% preventable by using proper clamping technique.",
        },
      ],
      key_lesson:
        "Vise clamping takes 30 seconds. The tension of a tight clamp might feel excessive, but it's the difference between a secure hold and a slipping work piece. Clamp firmly—tighter than feels necessary.",
      related_rule:
        "Vise Rule: Clamp firmly with both hands until work won't shift even with deliberate effort",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 13: Dust Hazard Story
    // ========================================================================
    {
      type: "micro_story",
      id: "wws-story-dust-01",
      title: "The Woodworker Who Noticed Shortness of Breath",
      narrative:
        "Marcus had been woodworking for 8 years—sanding, sawing, finishing. He was careful about most safety, but dust extraction felt optional to him. He wore a dust mask occasionally, but not always.\n\n" +
        "One day at age 28, climbing the stairs at work left him short of breath. At first, he thought it was just being out of shape. But the shortness of breath got worse. Eventually, he saw a doctor.\n\n" +
        "Diagnosis: Early-stage occupational asthma from cumulative wood dust exposure. His lungs had become sensitized to wood dust. Now, any exposure to sawdust triggered wheezing and inflammation.\n\n" +
        "Impact: He had to stop woodworking. Any high-dust environment (even lumberyards) triggered symptoms. He now uses an inhaler every day. The damage is permanent.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "When did the damage to Marcus's lungs occur?",
          reveal_answer:
            "Over years of exposure, bit by bit. He felt fine the whole time—no cough, no symptoms. The damage was silent and cumulative. By the time he noticed symptoms (age 28), significant permanent damage had already occurred.",
        },
        {
          question: "Could Marcus recover if he stopped woodworking now?",
          reveal_answer:
            "Partially. His lungs might improve slightly if he stops exposure, but the sensitization and inflammation are permanent. He'll likely need an inhaler for life and will have reduced lung capacity.",
        },
        {
          question: "How could Marcus have prevented this?",
          reveal_answer:
            "Consistent dust extraction + dust mask every single time. Even occasional exposure accumulates. The cost of prevention (a dust mask and positioning an extraction hose) is minimal compared to occupational disease.",
        },
      ],
      key_lesson:
        "Wood dust damage is silent and cumulative. You won't feel it happening. By the time you notice symptoms, permanent damage has occurred. The only strategy is prevention: extraction + respiratory protection every single time you sand.",
      related_rule:
        "Dust Rule: Extraction + mask every time. No exceptions, no 'just this once'",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 14: Final Check
    // ========================================================================
    {
      type: "comprehension_check",
      id: "wws-final-check-01",
      question:
        "You're about to sand a wooden piece for 15 minutes. What combination of controls is necessary for safe sanding?",
      options: [
        "Just dust extraction—that's the primary control",
        "Just a dust mask—that's enough respiratory protection",
        "Dust extraction positioned 10-15cm from work + dust mask",
        "None—as long as you're not sanding for hours, it's fine",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ CORRECT! Extraction controls 95% of dust at the source. Your mask catches the remaining 5% that escapes. Together, they provide complete protection. Neither alone is sufficient.",
      feedback_wrong:
        "Not quite. Extraction and masks work together. Extraction is your primary control; the mask is your backup. Using both ensures wood dust never reaches your lungs.",
      hint: "Think about which control prevents dust creation vs catches dust you're about to breathe.",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 15: Summary & Readiness
    // ========================================================================
    {
      type: "key_concept",
      id: "wws-summary-01",
      title: "Wood Workshop Mastery: You're Ready",
      icon: "✅",
      content:
        "You've learned the core safety practices that protect your lungs, hands, and body in woodworking:\n\n" +
        "✓ **Dust Hazards** — Fine particles cause permanent lung damage; prevention is the only option\n" +
        "✓ **Dust Extraction** — Position hose 10-15cm from source, turn on before starting, maintain filters\n" +
        "✓ **Respiratory Protection** — Dust mask + extraction for hand sanding, respirator for heavy machine sanding\n" +
        "✓ **Vise Clamping** — Secure firmly with both hands; protect finished surfaces with scrap blocks\n" +
        "✓ **Sanding Safety** — Replace dull paper frequently, control dust, wear respiratory protection\n" +
        "✓ **Finishing Chemicals** — Ensure ventilation, wear appropriate gloves, never eat/drink in chemical areas\n" +
        "✓ **Splinters** — Sand edges smooth to prevent; remove promptly to prevent infection\n" +
        "✓ **Housekeeping** — Sweep constantly, keep exits clear, prevent fire hazards from sawdust\n\n" +
        "**The Golden Rules:**\n" +
        "1. Extraction + mask = dust protection\n" +
        "2. Clamp firmly—30 seconds prevents injuries\n" +
        "3. Sweep as you go—constant, not just at the end\n" +
        "4. Ventilation matters for chemical work\n" +
        "5. Sawdust near heat = fire hazard\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Wood Workshop Safety badge.\n\n" +
        "Remember: Wood dust damage is silent. By the time you notice symptoms, significant damage has occurred. The habits you build NOW determine whether your lungs are healthy at age 40.",
      tips: [
        "Take your time answering—think about what your body will thank you for",
        "If you're unsure about dust, think: 'Prevention is the only option'",
        "Earning this badge means you understand the real hazards of woodworking",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type WoodWorkshopModuleType = typeof WOOD_WORKSHOP_MODULE;
