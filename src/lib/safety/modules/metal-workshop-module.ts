/**
 * Metal Workshop Safety Learning Module
 *
 * Covers metal-specific hazards and safety practices:
 * - Hot metal hazards (looks cool but burns—severe tissue damage)
 * - Filing and deburring sharp edges safely
 * - Drilling metal safely (clamp work, NO gloves near rotating bits)
 * - Brazing/soldering fumes (zinc, flux, solder vapours)
 * - Metal swarf cleanup (never blow away—use brush, sweeping)
 * - Grinding hazards (eye protection, tool rest gap, fragments)
 * - Preventing burns, cuts, and eye injuries
 *
 * Learning flow:
 * 1. Engage: Introduction + metal-specific hazard scenarios
 * 2. Inform: Hot metal, sharp edges, drilling, brazing concepts
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

export const METAL_WORKSHOP_MODULE: LearningModule = {
  badge_id: "metal-workshop-safety",
  learning_objectives: [
    "Explain why hot metal causes severe burns (deeper than flame burns)",
    "Handle hot work safely with appropriate tools and cooling methods",
    "File and deburr sharp edges without cutting yourself",
    "Drill metal safely (secure clamping, no gloves near rotating bits)",
    "Work with brazing/soldering safely (fume hazards, flare, spatter)",
    "Clean up metal swarf safely (never blow, always sweep/brush)",
    "Grind safely (eye protection, proper tool setup, coolant safety)",
    "Prevent the most common metal workshop injuries (burns and cuts)",
  ],
  estimated_minutes: 15,
  blocks: [
    // ========================================================================
    // BLOCK 1: Welcome & Engagement
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-intro-01",
      title: "Metal Workshop: Where Precision Meets Heat",
      icon: "⚙️",
      content:
        "Metal work requires precision, strength, and respect for heat. One moment of carelessness—grabbing hot metal, not securing your work, breathing brazing fumes—causes permanent injury.\n\n" +
        "This module takes about **15 minutes** and covers:\n" +
        "- Hot metal hazards (why they're more dangerous than flame burns)\n" +
        "- Handling hot work safely\n" +
        "- Filing and deburring without cutting yourself\n" +
        "- Drilling metal safely (including why gloves are dangerous)\n" +
        "- Brazing and soldering fumes\n" +
        "- Cleaning up metal swarf (never blow it away!)\n" +
        "- Grinding safely (fragments, tool setup, eye protection)\n\n" +
        "**Why this matters:** Metal work produces unique hazards—extreme heat, sharp fragments, high-speed rotating tools. A moment's inattention causes burns that scar, cuts that require stitches, or eye injuries from flying fragments.",
      tips: [
        "Pay special attention to the hot metal section—burns from molten or heated metal are worse than flame burns",
        "The drilling section has a critical safety rule: no gloves near rotating bits (same as with wood, but it bears repeating)",
        "Brazing/soldering fumes are invisible but hazardous—ventilation matters",
      ],
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 2: Hot Metal Hazards
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-hot-metal-01",
      title: "Hot Metal: Why It Burns Worse Than Fire",
      icon: "🔥",
      content:
        "Hot metal looks cool—literally. Unlike a bright flame, heated metal can appear dark red or even black while remaining extremely hot (300°C+). Students mistake it for cool and grab it.\n\n" +
        "**Why Hot Metal Burns Are Worse Than Flame Burns:**\n\n" +
        "**Flame is air** — it heats the surface of your skin.\n\n" +
        "**Hot metal is mass** — it's in direct contact with your skin and transfers heat deeply into the tissue. A piece of hot metal (even small) has enormous thermal energy and stays hot for a long time.\n\n" +
        "**Comparison:**\n" +
        "- Touching a 300°C metal surface for 1 second = 3rd degree burn (full thickness tissue damage)\n" +
        "- Holding your hand in a 300°C flame for 1 second = 2nd degree burn (painful, blisters, heals)\n\n" +
        "**The Scar Risk:**\n" +
        "Hot metal burns often cause deep scarring because the heat penetrates tissue layers. Burns on the hand (the most common site) cause permanent disfigurement and loss of hand function.\n\n\n" +
        "**Temperature Hazard Zones:**\n\n" +
        "**Above 55°C** — Painless touch (your pain receptors are overwhelmed). You might not feel how hot something is.\n\n" +
        "**Above 70°C** — Instant pain\n\n" +
        "**Above 150°C** — Immediate burns (blistering skin)\n\n" +
        "**Above 300°C** — Instant deep burns (tissue charring)\n\n" +
        "**The danger zone:** Work that looks cool (dark red or black) can be 200-400°C. Your eyes can't tell the difference between 300°C and room temperature.\n\n\n" +
        "**Safe Handling of Hot Work:**\n\n" +
        "**1. Use Tools, Never Your Hands**\n" +
        "- Tongs (preferably long-handled, 30cm+) to hold or move hot work\n" +
        "- Oven mitts or welding gloves when the work is too large for tongs\n" +
        "- Never reach for hot work with bare hands\n\n" +
        "**2. Communicate Heat Status**\n" +
        "- Mark hot work with a 'HOT' sign or verbal warning\n" +
        "- Never leave hot work unattended on a bench where someone might touch it\n" +
        "- If another student is nearby, tell them: 'I have hot metal here'\n\n" +
        "**3. Allow Cool-Down Time**\n" +
        "- Small metal pieces can take 5-10 minutes to cool enough to touch safely\n" +
        "- If you need to quench hot work (cool it in water), use bucket tongs, never grab it\n" +
        "- Quenching produces steam—stand back to avoid steam burns\n\n" +
        "**4. Place Hot Work on a Heat-Proof Surface**\n" +
        "- Metal heat-proof mat (ceramic or steel plate)\n" +
        "- Never place hot work on wooden benches, paper, or flammable materials\n" +
        "- Hot work can ignite materials\n\n" +
        "**5. Know the Temperature by the Colour**\n" +
        "- Black or dark red = still dangerously hot (150-300°C)\n" +
        "- Bright red = very hot (700°C+)\n" +
        "- No visible glow = possibly cool, but still warm—check before touching\n" +
        "- When in doubt, touch the bench next to the work (not the work itself) to see if it's radiating heat",
      tips: [
        "Hot metal doesn't feel hot through your eyes—it only feels hot when you touch it",
        "Use tongs for everything. It's a 2-second difference but prevents a lifetime scar",
        "Oven mitts protect your hand but make your grip clumsy—use tongs when possible",
        "If you're not 100% sure if something is cool, treat it as hot and use tongs",
      ],
      warning:
        "Hot metal burns cause permanent scars and tissue damage. A moment of grabbing hot work with bare hands causes burns that affect your hand function for life. Use tools (tongs, gloves) for all hot work—always.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Check Hot Metal Understanding
    // ========================================================================
    {
      type: "comprehension_check",
      id: "mws-hot-metal-check-01",
      question:
        "You've just finished soldering a metal joint. The metal looks dark (no red glow). Is it safe to grab with your bare hand?",
      options: [
        "Yes—no red glow means it's cool",
        "No—dark metal can still be 200-300°C and cause instant burns",
        "Only if it doesn't hurt to touch briefly",
        "Yes, but wear gloves just to be safe",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ CORRECT! Dark, non-glowing metal is often 200-300°C—still hot enough to cause deep burns instantly. Use tongs, not your hands. The temperature can't be judged by colour alone.",
      feedback_wrong:
        "Not quite. This is the dangerous mistake—assuming dark metal is cool. Dark red or black metal is often 150-400°C. This is why burns from 'cooled' metal happen so often. Always use tongs.",
      hint: "What temperature is dark metal? Is 200°C cool enough to touch?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 4: Filing & Deburring Safely
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-filing-01",
      title: "Filing & Deburring: Handling Sharp Edges",
      icon: "🪚",
      content:
        "Filing and deburring remove sharp edges and burrs left from drilling, cutting, or grinding. These are essential finishing steps, but the tools themselves have sharp edges and can cause hand lacerations.\n\n" +
        "**Why Filing Is Dangerous:**\n\n" +
        "- Files have very sharp, fine teeth\n" +
        "- If your hand slips, the file edge can cut deep into palm or fingers\n" +
        "- Hand positions vary, and it's easy to file INTO your hand rather than away from it\n\n" +
        "**Safe Filing Technique:**\n\n" +
        "**1. Secure Your Work**\n" +
        "- Clamp the work in a bench vise so both your hands are free for tool control\n" +
        "- Never hold work in your hand while filing (your hand becomes the pinch point)\n\n" +
        "**2. Two-Handed Grip**\n" +
        "- One hand on the file handle (dominant hand)\n" +
        "- One hand on the file tip (non-dominant hand, lighter pressure)\n" +
        "- Both hands stay on the FILE, never on the work\n\n" +
        "**3. Pressure on Forward Stroke Only**\n" +
        "- File cuts on the forward stroke (toward the tip)\n" +
        "- Lift the file slightly on the return stroke (reduces wear and improves control)\n" +
        "- Never press on the return stroke\n\n" +
        "**4. File Direction**\n" +
        "- Keep the file angled AWAY from your body\n" +
        "- If the file slips, it moves away from you, not toward you\n" +
        "- File edges (not against them) for maximum control\n\n" +
        "**5. Check Your Posture**\n" +
        "- Stand slightly to the side of the work (not directly in line with the file stroke)\n" +
        "- If the file breaks or slips, it travels in the direction of the stroke\n" +
        "- Sideways positioning means the file misses you\n\n" +
        "**6. Wear Gloves (Carefully)**\n" +
        "- Leather gloves can help, but make sure they don't snag the file teeth\n" +
        "- Some people prefer no gloves for better feedback\n" +
        "- If you wear gloves, ensure they're fitted and won't slip off\n\n\n" +
        "**Deburring Small Holes:**\n\n" +
        "**Deburring Tool**\n" +
        "Small conical tool that removes burrs from the inside edge of drilled holes. Hold the work in a vise, push the deburring tool into the hole, and twist. The sharp edge removes burrs without cutting your hand.\n\n" +
        "**File vs Deburr**\n" +
        "- Files are for large edges (saw cuts, sheared metal)\n" +
        "- Deburring tools are for small holes and tight edges\n" +
        "- Each is designed for its purpose—use the right tool\n\n\n" +
        "**Common Filing Injuries:**\n\n" +
        "**Slipping Grip** — File suddenly slides off the work and cuts your hand. Prevented by secure clamping and firm grip.\n\n" +
        "**Catch Points** — File suddenly catches a burr on the work and twists, twisting your wrist or hand. Prevented by smooth, consistent pressure.\n\n" +
        "**File Teeth Catching Clothing** — File catches your sleeve or pants. Prevented by fitted clothing and no loose sleeves.",
      tips: [
        "Clamp your work—if your work moves, your hands are at risk",
        "Let the file do the work—you don't need to press hard",
        "If the file catches or sticks, stop and check what's wrong—don't force it",
        "Deburring tool is easier and safer than filing small holes—use it when you can",
      ],
      warning:
        "A slipping file can cut deep into your palm (tendon damage, permanent loss of hand function) in one stroke. Secure clamping and careful hand position are your protection. Treat files with respect—they're sharp tools.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Drilling Metal Safely
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-drilling-01",
      title: "Drilling Metal: Clamping & Preventing Spin Injuries",
      icon: "🪛",
      content:
        "Metal is harder than wood, which makes drilling metal harder to control. The drill bit can catch and spin the work violently, or cause your hand to get caught in rotating machinery.\n\n" +
        "**Drill Press Hazards:**\n\n" +
        "**Uncontrolled Work Spin**\n" +
        "If the drill bit catches a burr or the work is off-center, the work suddenly spins with the bit. This happens in milliseconds. An unsecured work piece can spin hard enough to break fingers or dislocate shoulders.\n\n" +
        "**Hand Caught in Rotating Bit or Work**\n" +
        "If your hand is near the rotating bit and the work spins unexpectedly, your hand is pulled into the rotation. This causes lacerations, fractures, or hand crushing.\n\n\n" +
        "**Safe Metal Drilling:**\n\n" +
        "**1. Secure Work With a Clamp (Non-Negotiable)**\n" +
        "- Use a C-clamp or parallel clamp to secure work to the drill press table\n" +
        "- Clamp tightly—the work must not shift or spin\n" +
        "- Position the clamp away from the drill area (so the work can spin into the clamp without hitting your hand)\n\n" +
        "**2. NO GLOVES Near the Drill Bit**\n" +
        "- Remove all gloves before approaching the drill press\n" +
        "- Gloves catch the rotating bit and pull your hand in\n" +
        "- Bare hands have some grip feedback; gloved hands don't\n\n" +
        "**3. Position Your Hands Correctly**\n" +
        "- Keep hands away from the drill bit area\n" +
        "- Don't hold work near the cutting area—clamp does that\n" +
        "- If the work spins, it spins into the clamp, not into your hands\n\n" +
        "**4. Use Reduced Drill Speed for Metal**\n" +
        "- Soft metals (aluminum, copper): 300-500 RPM for large holes\n" +
        "- Hard metals (steel): 200-400 RPM\n" +
        "- Small holes can run faster; large holes need slower speed\n" +
        "- Slower speed gives better control and prevents bit breakage\n\n" +
        "**5. Use Center Punch**\n" +
        "- Before drilling, make a small indent with a center punch where you want the hole\n" +
        "- This prevents the drill bit from wandering and catching\n" +
        "- Prevents the work from spinning due to bit catch\n\n" +
        "**6. Monitor Pressure**\n" +
        "- Press down gently and let the bit do the work\n" +
        "- If you feel pressure building up, slow the press or reduce speed\n" +
        "- Excessive pressure breaks bits and causes hand injuries\n\n" +
        "**7. Break Through Carefully**\n" +
        "- As the drill bit breaks through the bottom surface, the work wants to rotate suddenly\n" +
        "- Reduce downward pressure at breakthrough\n" +
        "- The clamp should prevent spin, but less pressure reduces the chance of breakage\n\n\n" +
        "**Hand Drill (Eggbeater Drill) Hazards:**\n\n" +
        "For small holes in thin metal, hand drills are sometimes used. The same rules apply:\n" +
        "- Secure work in a vise\n" +
        "- No gloves near the rotating bit\n" +
        "- Keep hands clear of the rotating handle (if the work catches, the handle spins)",
      tips: [
        "Clamping feels like overkill for a small hole—do it anyway",
        "Center punch makes drilling easier and safer—always use it",
        "If the drill catches and the work jerks, it's because clamping wasn't tight enough",
        "Slower speed is safer and produces better holes in metal",
      ],
      warning:
        "A work piece that spins unexpectedly causes hand crushing, fractures, or lacerations. Secure clamping is non-negotiable. If your work jerks during drilling, stop and re-clamp tighter.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Brazing & Soldering Fumes
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-brazing-01",
      title: "Brazing & Soldering: Fume Hazards & Heat Protection",
      icon: "💨",
      content:
        "Brazing and soldering join metals using a melted filler metal. The process creates fumes from flux (a chemical that helps the solder flow) and vaporized solder. These fumes are hazardous.\n\n" +
        "**Solder Fume Hazards:**\n\n" +
        "**Lead-Based Solder (Older Workshops)**\n" +
        "If your workshop uses lead-based solder (less common now), lead vapours enter your lungs and cause neurological damage. Lead accumulates in bones and affects your nervous system, even at low exposure.\n\n" +
        "Modern workshops use lead-free solder, but ask your teacher to confirm.\n\n" +
        "**Flux Fumes**\n" +
        "Flux (typically rosin-based) vaporizes during heating. The fumes irritate airways and cause respiratory sensitivity (asthma-like symptoms). Symptoms can be immediate (cough, wheeze) or develop over time.\n\n" +
        "**Zinc Fumes (From Galvanized Metal)**\n" +
        "If you're soldering galvanized (zinc-coated) metal, heating releases zinc oxide vapours. This causes 'metal fume fever': flu-like symptoms (fever, chills, nausea) 4-8 hours after exposure. Unpleasant but usually reversible.\n\n\n" +
        "**Ventilation for Brazing/Soldering:**\n\n" +
        "**Extract Fumes at the Source**\n" +
        "- Use a fume extraction arm positioned within 10-15cm of the brazing work\n" +
        "- The arm should pull fumes away from your face and out of the workshop\n" +
        "- If extraction isn't available, open windows and work outside if possible\n\n" +
        "**Never Breathe Fumes Directly**\n" +
        "- Position your head to the side of the work, not directly above (so you breathe extracted fumes, not fresh fumes)\n" +
        "- Some people wear a respiratory mask (cartridge respirator with organic vapour cartridge)\n" +
        "- Dust masks don't work for vapours—you need an activated charcoal cartridge\n\n" +
        "**Work Area Ventilation**\n" +
        "- Keep windows open\n" +
        "- Fans help extract fumes from the workshop\n" +
        "- Don't work in enclosed spaces (small rooms, closets)\n\n\n" +
        "**Heat Hazards During Brazing/Soldering:**\n\n" +
        "**Hot Work Piece**\n" +
        "- Brazing produces work temperatures above 500°C\n" +
        "- The work glows and looks obviously hot\n" +
        "- Use tongs or long-handled pliers—never touch with bare hands\n\n" +
        "**Spatter (Hot Solder Droplets)**\n" +
        "- Molten solder can spatter when you apply heat or flux\n" +
        "- Wear a welding apron and eye protection\n" +
        "- Don't lean in close (stay back at a safe distance)\n\n" +
        "**Flux Burn**\n" +
        "- Hot flux (liquid state) can splash\n" +
        "- Wear an apron that covers your chest and arms\n" +
        "- If flux splashes on your skin, cool it immediately with water\n\n" +
        "**Flare (Brief Flame From Flux)**\n" +
        "- When flux ignites, a brief flame appears\n" +
        "- This is normal and not dangerous if you're expecting it\n" +
        "- Wear eye protection so the flare doesn't surprise you\n\n\n" +
        "**Safe Brazing Workflow:**\n\n" +
        "1. Ensure ventilation is running (fume arm, windows open)\n" +
        "2. Secure work in a heat-proof clamp (vise with ceramic jaws or ceramic board)\n" +
        "3. Put on welding gloves, apron, eye protection\n" +
        "4. Light the torch and warm the work gradually\n" +
        "5. Apply flux when the work is warm enough\n" +
        "6. Continue heating until the solder melts and flows\n" +
        "7. Remove heat and allow the work to cool\n" +
        "8. If quenching (cooling in water), do so with tongs, not hands, and stand back from steam",
      tips: [
        "Ask your teacher to confirm your workshop uses lead-free solder",
        "Fume extraction arm is your primary protection—position it correctly",
        "Respiratory masks help but aren't a substitute for ventilation",
        "If you cough or wheeze during soldering, ventilation is inadequate—open more windows or stop",
      ],
      warning:
        "Brazing fumes are invisible but cause long-term respiratory damage. Poor ventilation means you're inhaling zinc oxide, lead (if lead solder), and flux fumes. Fume extraction at the source is non-negotiable.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: Metal Swarf Cleanup
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-swarf-01",
      title: "Metal Swarf: Why You Never Blow It Away",
      icon: "💨",
      content:
        "Swarf is the curled metal shavings produced during drilling, milling, and grinding. These are razor-sharp and can embed in skin or eyes.\n\n" +
        "**Why Swarf Is Hazardous:**\n\n" +
        "- Pieces are 1-5cm long and curled\n" +
        "- Edges are razor-sharp (sharper than a knife)\n" +
        "- Small pieces can penetrate skin and become embedded\n" +
        "- Swarf in the eye causes lacerations and vision loss\n\n" +
        "**The Critical Mistake: NEVER Blow Swarf Away**\n\n" +
        "When you blow on swarf (to clear it from your work area), you:\n" +
        "1. Send razor-sharp particles into the air\n" +
        "2. They travel toward your face and eyes (the source of the air)\n" +
        "3. Embedded in your eye or face = emergency room visit\n\n" +
        "This happens so often that eye injuries from swarf are a major workshop hazard.\n\n\n" +
        "**Safe Swarf Cleanup:**\n\n" +
        "**1. Never Blow (This Is Non-Negotiable)**\n" +
        "- No blowing swarf away\n" +
        "- No using compressed air to clear swarf\n" +
        "- Both send particles flying into your face\n\n" +
        "**2. Use a Brush**\n" +
        "- Soft brush to gently move swarf onto a piece of paper or into a bin\n" +
        "- The brush directs particles downward, away from your face\n" +
        "- Slow and controlled—no particles fly\n\n" +
        "**3. Use a Magnet (For Ferrous Metals)**\n" +
        "- Strong magnet to pick up steel or iron swarf\n" +
        "- Wave the magnet over the swarf—it clings to the magnet\n" +
        "- Move slowly so pieces don't drop and scatter\n\n" +
        "**4. Scoop Into a Bin**\n" +
        "- Use a small scoop or dustpan to collect swarf into a dedicated metal waste bin\n" +
        "- Don't mix swarf with other waste—it's sharp and dangerous to handle\n" +
        "- Metal bins designated for swarf should be labeled\n\n" +
        "**5. Wear Eye Protection**\n" +
        "- Even when brushing carefully, small pieces can fly\n" +
        "- Safety glasses protect your eyes\n" +
        "- Always wear glasses during machining and cleanup\n\n\n" +
        "**Swarf Embedded in Skin:**\n\n" +
        "If a piece of swarf penetrates your skin:\n\n" +
        "1. Don't panic—most swarf is shallow\n" +
        "2. Clean the area\n" +
        "3. Try to remove with tweezers if it's visible\n" +
        "4. If it won't come out easily, see a school nurse or doctor\n" +
        "5. Deep swarf can cause infection—watch for redness, warmth, or swelling\n\n" +
        "**Swarf in the Eye:**\n\n" +
        "This is an emergency:\n\n" +
        "1. Don't rub—rubbing drives the sharp piece deeper\n" +
        "2. Go to the eyewash station immediately\n" +
        "3. Flush for 15+ minutes\n" +
        "4. Alert your teacher\n" +
        "5. Seek medical attention (an eye doctor needs to verify nothing is embedded)",
      tips: [
        "Brush, don't blow—this is the core rule for swarf cleanup",
        "Metal magnets are your friend for ferrous metals—use them",
        "Wear safety glasses during all machining and cleanup",
        "If swarf gets in your eye, flush immediately at the eyewash station",
      ],
      warning:
        "Swarf in the eye causes lacerations and potential vision loss. Blowing swarf is the #1 cause of these injuries. Use a brush or magnet—always. Never blow, never use compressed air.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 8: Grinding Safely
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-grinding-01",
      title: "Grinding: Tool Setup, Fragments & Eye Protection",
      icon: "✨",
      content:
        "Bench grinders are powerful tools that remove material quickly. They also produce high-velocity fragments and sparks.\n\n" +
        "**Grinding Hazards:**\n\n" +
        "**Flying Fragments**\n" +
        "A rotating grinding wheel removes material by impact. Fragments fly off at high speed. Without protection, fragments hit your eyes, face, and hands.\n\n" +
        "**Wheel Breakage**\n" +
        "Grinding wheels are abrasive and can shatter if overstressed. A broken wheel explodes into fragments. A blast shield is your protection.\n\n" +
        "**Work Entanglement**\n" +
        "If your hand gets caught between the work and the grinding wheel, the wheel pulls your hand in. This causes hand crushing or lacerations.\n\n" +
        "**Spark Injuries**\n" +
        "Grinding produces sparks (hot metal particles). They can burn exposed skin or ignite flammable materials.\n\n\n" +
        "**Safe Grinding Setup:**\n\n" +
        "**1. Eye Protection (Non-Negotiable)**\n" +
        "- Safety glasses or face shield (full face coverage is better)\n" +
        "- A rotating grinding wheel can throw fragments in any direction\n" +
        "- Face shields provide full coverage; glasses protect the eyes but not the cheeks\n" +
        "- Wear BOTH if you can\n\n" +
        "**2. Blast Shield**\n" +
        "- Polycarbonate or mesh shield mounted on the grinder\n" +
        "- Protects you from wheel breakage fragments\n" +
        "- Should be adjusted so you see the grinding area, but fragments are blocked\n\n" +
        "**3. Tool Rest Position**\n" +
        "- The tool rest (metal support where you position your work) should be 3-5mm from the wheel\n" +
        "- If the gap is larger, your work can bind and kick back violently\n" +
        "- Check the gap every time you use the grinder—it can shift\n\n" +
        "**4. Work Clamp or Hand Position**\n" +
        "- For small pieces, use a clamp or vice to hold work—don't hold it in your hand\n" +
        "- If holding by hand, grip firmly and position your hand above the wheel (so if it kicks back, it doesn't hit your hand)\n" +
        "- Never let your hand or work rest on the rotating wheel\n\n" +
        "**5. No Loose Clothing**\n" +
        "- Loose sleeves, ties, or scarves can catch the rotating wheel\n" +
        "- Fitted clothing only\n" +
        "- Tie back long hair\n\n" +
        "**6. No Gloves** (Except for Grinding Wheels With Spindle)**\n" +
        "- Most bench grinders have open wheels—no gloves (they catch and wrap)\n" +
        "- If using a surface grinder (flat wheel mounted vertically), gloves might be OK\n" +
        "- Ask your teacher before wearing gloves on any grinder\n\n" +
        "**7. Speed Check**\n" +
        "- Bench grinders typically run at 3000 RPM\n" +
        "- Check the label on the wheel—don't exceed the rated speed\n" +
        "- High speeds increase fragment velocity\n\n" +
        "**8. Coolant (When Available)**\n" +
        "- Some metal grinds need coolant to prevent overheating and wheel clogging\n" +
        "- Use coolant if available—it reduces fragment production and heat\n" +
        "- Never use water in place of coolant (water can cause wheel fracture)\n\n\n" +
        "**Grind Direction Matters:**\n\n" +
        "**Grind into the wheel** (wheel rotating toward you):\n" +
        "- Work stays on the tool rest\n" +
        "- Fragments are thrown downward and away\n" +
        "- Safe, controlled grinding\n\n" +
        "**Don't grind with the wheel** (wheel rotating away):\n" +
        "- Work can bind and kick back\n" +
        "- Fragments are thrown toward you\n" +
        "- This is the dangerous direction\n\n" +
        "**Top vs bottom:** Always use the top portion of the wheel (above the center line). Never grind on the lower half—if work binds, it kicks toward you.",
      tips: [
        "Check the tool rest gap before every grinding session—it should be 3-5mm",
        "Grind into the wheel (top portion), never with the bottom rotation",
        "Eye protection is non-negotiable—both glasses AND a shield if possible",
        "If the work vibrates or chatter, it's binding—back off immediately",
      ],
      warning:
        "Grinding wheel fragments travel at high speed. A piece hitting your unprotected eye causes vision loss. A wheel breaking sends fragments everywhere. Blast shield + face shield + glasses are your protection—use all of them.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 9: Before/After - Unsafe vs Safe Metal Work
    // ========================================================================
    {
      type: "before_after",
      id: "mws-wrong-right-01",
      title: "Metal Workshop Setup: Unsafe vs Safe",
      before: {
        caption: "NOT SAFE: Multiple metal workshop hazards",
        hazards: [
          "Gloved hands holding work near rotating drill bit—glove will catch",
          "No clamp on work—work could spin unexpectedly",
          "No eye protection while grinding—fragments into eyes",
          "Loose sleeves near rotating grinder wheel—sleeve will catch",
          "Breathing brazing fumes—no ventilation or fume extraction",
          "Blowing swarf away—particles flying into face and eyes",
          "Hot metal being grabbed with bare hands—instant burns",
          "No blast shield on grinding wheel—wheel breakage unprotected",
        ],
        image: "/images/safety/metal-workshop-wrong.png",
      },
      after: {
        caption: "SAFE: Correct metal workshop setup",
        principles: [
          "Work clamped securely—won't spin if bit catches",
          "Gloves REMOVED before using drill press",
          "Eye protection on—safety glasses + face shield for grinding",
          "Fitted clothing—no loose sleeves or ties",
          "Fume extraction arm running—positioned 10-15cm from brazing work",
          "Brush and scoop for swarf cleanup—no blowing",
          "Hot metal handled with tongs—no bare-hand grabbing",
          "Blast shield properly positioned—fragments blocked from face",
          "Tool rest 3-5mm from grinding wheel—proper gap",
          "Apron on—protects from sparks and spatter",
        ],
        image: "/images/safety/metal-workshop-right.png",
      },
      key_difference:
        "Safe metal work requires 3 minutes of setup per session (securing work, checking tool rest, starting ventilation, putting on PPE). These 3 minutes prevent injuries that scar and disable.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 10: Hot Metal Burn Story
    // ========================================================================
    {
      type: "micro_story",
      id: "mws-story-burn-01",
      title: "The Brazing Project That Changed a Student's Hand",
      narrative:
        "Yuki had finished brazing a brass joint. The work was dark red (he couldn't see a glow). He assumed it was cool and reached for it with his bare hand to move it to the cooling station.\n\n" +
        "The metal was 350°C. His palm made contact and stayed in contact for 2 seconds before he jerked his hand away.\n\n" +
        "The result: a severe 3rd degree burn covering most of his palm. The burn was deep enough to require skin grafting. Even after healing, significant scarring reduced the flexibility of his hand.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "How could Yuki have prevented this burn?",
          reveal_answer:
            "Use tongs to move hot work. A 2-second reach with tongs instead of bare hands would have prevented the burn entirely. Tongs add 5 seconds to the work, but prevent permanent scarring.",
        },
        {
          question: "Was the metal obviously hot?",
          reveal_answer:
            "No—dark metal looks cool. This is the danger. Temperature can't be judged by colour. Metal that looks dark can be 200-400°C. Always assume metal is hot and use tongs.",
        },
        {
          question: "Will Yuki's hand function return to normal?",
          reveal_answer:
            "Partially. 3rd degree burns destroy nerve endings and permanently reduce sensitivity. Scarring limits motion. Full hand function is unlikely. This burn changed the rest of his life.",
        },
      ],
      key_lesson:
        "Hot metal doesn't look hot. A moment of assumption (grabbing with bare hands) causes permanent scarring. Tongs are the boundary between a safe hand and a scarred hand.",
      related_rule: "Hot Metal Rule: Always use tongs—never grab with bare hands",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 11: Swarf Injury Story
    // ========================================================================
    {
      type: "micro_story",
      id: "mws-story-swarf-01",
      title: "The Eye Injury From Blown Swarf",
      narrative:
        "Marcus had just finished drilling a series of holes in steel. Swarf was scattered across his work area. He quickly blew on the swarf to clear it away so he could see his work better.\n\n" +
        "A piece of curled steel swarf (razor-sharp) flew directly into his right eye. The sharp edge lacerated his cornea and conjunctiva (the clear membranes covering the eye).\n\n" +
        "He rushed to the emergency room where an ophthalmologist had to remove the swarf and treat the lacerations. The eye healed, but he has permanent scarring on his cornea that causes slight vision reduction in that eye.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of this eye injury?",
          reveal_answer:
            "Blowing swarf away. When you blow, you send razor-sharp particles into the air toward your face. The particles travel to the source of the air (your face) and embed in your eye.",
        },
        {
          question: "How could Marcus have prevented this?",
          reveal_answer:
            "Use a brush to gently move swarf into a bin. Brush, don't blow. Brushing directs particles downward, away from your face. Takes 30 extra seconds but prevents eye injuries.",
        },
        {
          question:
            "Will Marcus's vision return to normal in the injured eye?",
          reveal_answer:
            "No. Corneal scarring is permanent. Even after healing, the scar reduces vision clarity slightly. This is a permanent vision reduction for a momentary convenience (blowing instead of brushing).",
        },
      ],
      key_lesson:
        "Never blow swarf. Use a brush or magnet. Swarf injuries happen in seconds and cause permanent damage. The prevention is simple—just don't blow.",
      related_rule: "Swarf Rule: Brush or magnet. Never blow. Ever.",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 12: Final Check
    // ========================================================================
    {
      type: "comprehension_check",
      id: "mws-final-check-01",
      question:
        "You're about to drill a hole in steel using a drill press. Your work is loose on the table (not clamped). What should you do before drilling?",
      options: [
        "Start drilling—the work won't move much",
        "Clamp the work securely to the table using a C-clamp",
        "Hold the work firmly in your hands",
        "Drill slowly so the work doesn't spin",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ CORRECT! Secure clamping is non-negotiable. If the drill bit catches, an unclamped work piece spins violently, causing hand injuries. Clamping prevents this entirely.",
      feedback_wrong:
        "Not quite. Unclamped work is dangerous—if the bit catches (which happens randomly with metal), the work spins with force enough to break fingers. Clamp it securely before drilling.",
      hint: "What happens if the drill bit catches on an unsecured work piece?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 13: Summary & Readiness
    // ========================================================================
    {
      type: "key_concept",
      id: "mws-summary-01",
      title: "Metal Workshop Mastery: You're Ready",
      icon: "✅",
      content:
        "You've learned the core safety practices that protect you from burns, cuts, eye injuries, and hand injuries in metal work:\n\n" +
        "✓ **Hot Metal** — Use tongs always; hot metal doesn't look hot; assume it's hot\n" +
        "✓ **Filing & Deburring** — Clamp work; two-handed grip; file away from body\n" +
        "✓ **Drilling Metal** — Secure clamp (non-negotiable); no gloves near bit; center punch first\n" +
        "✓ **Brazing/Soldering** — Ventilation/fume extraction required; tongs for hot work; apron and eye protection\n" +
        "✓ **Metal Swarf** — Brush or magnet; never blow; eye protection always\n" +
        "✓ **Grinding** — Eye protection + blast shield; tool rest 3-5mm; grind into wheel (top half); no loose clothing\n\n" +
        "**The Golden Rules:**\n" +
        "1. Hot metal: use tongs (always)\n" +
        "2. Drilling: secure clamp + no gloves\n" +
        "3. Swarf: brush/magnet, never blow\n" +
        "4. Grinding: eye protection + blast shield + tool rest gap\n" +
        "5. Brazing: ventilation + fume extraction + tongs\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Metal Workshop Safety badge.\n\n" +
        "Remember: Metal work produces extreme hazards (burns, sharp fragments, rotating machinery). Every safety practice you've learned prevents permanent disfigurement. Your hands and eyes are worth the extra 2 minutes of setup per session.",
      tips: [
        "Take your time answering—think about what keeps your hands and eyes safe",
        "If you're unsure about hot metal temperature, assume it's hot",
        "Swarf and eye injuries happen in seconds—brush, don't blow",
        "Earning this badge means you can work metal safely—that's a real skill",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type MetalWorkshopModuleType = typeof METAL_WORKSHOP_MODULE;
