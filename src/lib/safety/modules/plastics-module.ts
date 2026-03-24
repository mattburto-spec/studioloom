/**
 * Plastics & Composites Safety Learning Module
 *
 * Covers safe handling of thermoplastics, thermosets, acrylics, resins, and fibreglass.
 * Focus on fume hazards, heat-related burns, chemical sensitivity, and dust/irritation risks.
 *
 * Learning flow:
 * 1. Engage: Real incident story (thermal expansion + lack of ventilation)
 * 2. Inform: Material identification, heating safety, resin/fibreglass hazards
 * 3. Apply: Scenario-based decisions (when to heat, proper ventilation setup)
 * 4. Verify: Before/after comparisons and comprehension checks
 *
 * Total estimated time: 13 minutes
 */

import type {
  LearningModule,
  KeyConceptBlock,
  ComprehensionCheckBlock,
  BeforeAfterBlock,
  MicroStoryBlock,
  StepByStepBlock,
  ScenarioBlock,
} from "../content-blocks";

export const PLASTICS_MODULE: LearningModule = {
  badge_id: "plastics-composites-safety",
  learning_objectives: [
    "Identify thermoplastics, thermosets, acrylics, resins, and fibreglass by sight",
    "Explain why different plastics produce different fumes when heated",
    "Select appropriate PPE for resin and fibreglass handling",
    "Demonstrate proper ventilation setup before heating plastics",
    "Describe the signs of thermal degradation (color, smell, smoke)",
    "Apply safe procedures for vacuum forming, cutting, and heat shaping",
    "Explain why resin is a skin sensitizer and how to avoid contact",
    "Respond correctly when plastic fumes are detected in the workshop",
  ],
  estimated_minutes: 13,
  blocks: [
    // ========================================================================
    // BLOCK 1: Engage with Real Incident
    // ========================================================================
    {
      type: "micro_story",
      id: "plastics-story-01",
      title: "The Acrylic Explosion",
      narrative:
        "Sofia was heat-shaping a clear acrylic sheet for her design project. She had placed the acrylic in a small domestic oven (not a design oven) without checking the temperature dial. The oven was set to 200°C—higher than needed for acrylic.\n\n" +
        "Acrylic begins to soften at 70°C and starts to degrade (brown and release fumes) above 150°C. At 200°C, the sheet wasn't just softening—it was decomposing. Sofia didn't notice the yellow-brown discolouration because she was focused on the shape she wanted to achieve.\n\n" +
        "After 5 minutes, white smoke started coming from the oven. Sofia smelled something sharp and chemical—acrylic fumes are irritating to lungs and eyes. She pulled the sheet out and the oven suddenly filled with smoke.\n\n" +
        "Because there was no fume extraction running and the workshop windows were closed, the smoke spread throughout the space. Several other students coughed and had to leave. The workshop was evacuated and ventilated for 30 minutes before resuming work.\n\n" +
        "The acrylic sheet was ruined (brown and brittle), Sofia got a warning for improper equipment use, and everyone else lost 30 minutes of project time because of inadequate planning.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of the incident?",
          reveal_answer:
            "Sofia didn't know: (1) the melting temperature of acrylic, (2) the proper oven to use, and (3) that thermal degradation releases toxic fumes. She skipped the planning step entirely.",
        },
        {
          question: "What signs did Sofia miss that told her something was wrong?",
          reveal_answer:
            "Yellow-brown discolouration of the acrylic (indicates degradation, not just softening), sharp chemical smell (acrylic fumes are distinct and irritating), white smoke. These are emergency signals.",
        },
        {
          question: "What could have prevented this?",
          reveal_answer:
            "(1) Check material specs before heating. (2) Use a heat gun or design oven with temperature control, not a domestic oven. (3) Run extraction or work outdoors. (4) Recognize the smell—if acrylic smells sharp or chemical, STOP immediately.",
        },
      ],
      key_lesson:
        "Different plastics have different safe heating temperatures. Thermal degradation releases hazardous fumes that affect everyone in the workshop. Check the specs first.",
      related_rule: "Rule #1: Know your material's melting/degradation temperature before heating",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 2: Material Identification & Hazards
    // ========================================================================
    {
      type: "key_concept",
      id: "plastics-id-01",
      title: "Plastics, Resins & Composites: Know What You're Working With",
      icon: "🧪",
      content:
        "Different materials have different hazards. Identifying what you're working with is the first safety step.\n\n" +
        "**THERMOPLASTICS** (soften when heated, can be reshaped)\n" +
        "- **Acrylic (PMMA):** Clear or colored. Safe up to ~80°C for shaping. Above 150°C → brown discoloration + sharp chemical fumes. Hazard: burns from hot sheets, fume inhalation.\n" +
        "- **Polystyrene (PS):** Lightweight, white or colored. Melts at 240°C but degrades releasing benzene + styrene fumes (neurotoxic). Never heat polystyrene indoors without extraction. Hazard: fume inhalation, risk to nervous system.\n" +
        "- **PVC (Polyvinyl Chloride):** Often flexible. DANGER: When heated, releases hydrogen chloride gas (HCl), which is corrosive to lungs and eyes. **NEVER heat or cut PVC without professional extraction.**\n\n" +
        "**THERMOSETS** (set permanently when heated, cannot be reshaped)\n" +
        "- **Epoxy Resin:** Liquid pre-cure, hardens when heated or mixed with hardener. Safe once cured. Hazard (wet): skin sensitizer, causes contact dermatitis. Always wear gloves. Wear eye protection—splashes can cause temporary blindness.\n" +
        "- **Polyester Resin:** Similar to epoxy but with stronger odor. Hazard: vapors irritate lungs; skin contact causes irritation and sensitization over time.\n\n" +
        "**COMPOSITES & REINFORCED MATERIALS**\n" +
        "- **Fibreglass (glass fiber + resin matrix):** Strong but itchy. Hazard: loose fibers irritate skin and lungs. Wear gloves, long sleeves, and dust mask when cutting or sanding. Never handle without protection.\n" +
        "- **Carbon Fiber Reinforced Plastic (CFRP):** Conductive—avoid near electrical equipment. Cutting releases fine carbon fibers (inhalable). Hazard: lung irritation, fire risk in dust form.\n\n" +
        "**HOW TO IDENTIFY:**\n" +
        "- Check the supplier label or material tag\n" +
        "- If unknown, ask your teacher—never assume\n" +
        "- Never heat an unmarked plastic",
      tips: [
        "Always ask 'What am I working with?' before heating, cutting, or handling",
        "Epoxy and polyester resins smell strong—if the smell is overwhelming, extraction isn't working properly",
        "Thermal degradation smells sharp and chemical, not like cooking plastic",
        "If you don't know the material, treat it as unknown hazard and get teacher approval first",
      ],
      warning:
        "PVC heated indoors without professional extraction has caused respiratory emergencies. When in doubt about what to heat, ask your teacher first. Unmarked plastic is a safety violation.",
      image: "/images/safety/plastic-types.png",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Check Material Knowledge
    // ========================================================================
    {
      type: "comprehension_check",
      id: "plastics-id-check-01",
      question: "You find an unmarked plastic sheet. What do you do?",
      options: [
        "Heat it carefully on low temperature to see what happens",
        "Ask your teacher to identify it before using it",
        "Assume it's acrylic and proceed with your plan",
        "Cut it first to see if it's thermoset or thermoplastic",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Unknown materials are an unknown hazard. Your teacher has the knowledge and tools to identify it safely. Heating an unknown plastic could release toxic fumes.",
      feedback_wrong:
        "Not quite. Never heat or heavily process an unknown material—you don't know what fumes it will release. Ask your teacher first. This is a non-negotiable safety rule.",
      hint: "What's the safest action when you don't have all the information?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 4: Heating Plastics Safely
    // ========================================================================
    {
      type: "key_concept",
      id: "plastics-heating-01",
      title: "Heating Plastics: Ventilation is Non-Negotiable",
      icon: "💨",
      content:
        "When plastics heat up, they release fumes. Even 'safe' plastics in their normal temperature range produce vapors. Above their degradation temperature, they produce toxic fumes. Ventilation is your primary defense.\n\n" +
        "**FUME EXTRACTION SETUP (Required for ANY indoor plastic heating)**\n" +
        "1. **Turn on extraction 2-3 minutes before you start** — the system needs to establish airflow\n" +
        "2. **Position the heat source as close to the extraction inlet as possible** — ideally 15-30cm away\n" +
        "3. **Keep the inlet clear** — don't block it with your hands or materials\n" +
        "4. **Check the extraction is running** — you should feel air being pulled toward the inlet\n" +
        "5. **Keep extraction running for 2 minutes after you finish** — fumes linger\n\n" +
        "**HEAT GUN SAFETY**\n" +
        "- Keep the nozzle 10-15cm from the plastic surface\n" +
        "- Move the nozzle constantly—never let it focus on one spot for more than a few seconds\n" +
        "- Watch for color change (yellowing = approaching degradation)\n" +
        "- If the plastic starts to brown or smell sharp, STOP immediately\n" +
        "- Wear heat-resistant gloves—the plastic gets hot enough to burn skin\n\n" +
        "**VACUUM FORMING**\n" +
        "- Use a design-spec vacuum former with proper ventilation, never a domestic oven\n" +
        "- Extraction must run continuously during forming\n" +
        "- The heating element (usually a mesh) glows red—never touch it\n" +
        "- Wear gloves—the formed sheet is hot for several minutes after forming\n\n" +
        "**SIGNS IT'S GOING WRONG**\n" +
        "- Sharp, chemical smell (not plastic smell)\n" +
        "- Visible smoke or heavy vapor\n" +
        "- Discoloration of the plastic (yellow, brown, black)\n" +
        "- Feeling dizzy, headache, or burning eyes\n\n" +
        "If ANY of these occur: Stop heating immediately, turn off the heat source, run extraction at full power for 5 minutes, move to fresh air, alert your teacher.",
      tips: [
        "Start extraction before heating—don't wait for fumes to appear",
        "Watch the plastic, not the heat source—color change is your warning",
        "If in doubt about temperature, test on scrap first",
        "Heating plastics indoors without extraction is a safety violation",
      ],
      warning:
        "Acrylic fumes cause temporary eye and lung irritation. PVC fumes are corrosive to lungs and can cause respiratory distress. No exceptions—extraction running or no heating.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Resin Safety
    // ========================================================================
    {
      type: "key_concept",
      id: "plastics-resin-01",
      title: "Resin Handling: Skin Sensitizer & Fume Control",
      icon: "⚠️",
      content:
        "Epoxy and polyester resins are not plastics—they're liquid chemicals that harden. Skin contact is the main hazard for wet resin; fumes are secondary but significant.\n\n" +
        "**WHY RESIN IS HAZARDOUS**\n" +
        "- **Skin sensitizer:** Even a small splash or touch can cause contact dermatitis (rash, itching, swelling). The reaction can develop within hours or days.\n" +
        "- **Once sensitized, you're sensitized for life.** Future exposures trigger worse reactions. This is why gloves are mandatory—prevent sensitization now.\n" +
        "- **Fumes:** Volatile compounds irritate lungs and eyes. Headaches and dizziness are signs of fume exposure.\n\n" +
        "**MANDATORY PPE FOR RESIN WORK**\n" +
        "- **Nitrile gloves (minimum—latex is not good enough for resin):** Double gloves if doing heavy work. Change if torn.\n" +
        "- **Safety glasses:** Resin splashes into eyes cause temporary blindness and chemical burns.\n" +
        "- **Dust mask (P2/N95):** For sanding cured resin (which creates fine dust).\n" +
        "- **Long sleeves and apron:** Resin can splash. If it splashes, rinse immediately with water.\n\n" +
        "**SAFE RESIN PROCEDURE**\n" +
        "1. **Lay out spill containment** (absorbent pads, plastic sheet under your work area)\n" +
        "2. **Put on gloves BEFORE opening the resin container**\n" +
        "3. **Pour carefully into a disposable mixing cup** — resin splashes\n" +
        "4. **Mix in a well-ventilated area** (near extraction, near open window, or use a fume hood)\n" +
        "5. **Work quickly** — resin starts curing and becomes harder to work with\n" +
        "6. **If resin contacts skin:** Rinse immediately with water for 2-3 minutes, then wash with soap. Don't use solvents—they dissolve skin barriers and make sensitization worse.\n" +
        "7. **Dispose of resin-soaked items in a sealed, labeled waste container** (not regular trash)\n" +
        "8. **Clean tools immediately** — cured resin is almost impossible to remove\n\n" +
        "**CURED RESIN SAFETY**\n" +
        "Once resin is fully cured, it's much safer (not a skin sensitizer anymore). But sanding cured resin produces fine resin dust—wear a mask. Never inhale resin dust.",
      tips: [
        "Nitrile gloves are standard—latex is not adequate for resin",
        "If resin gets on skin, rinse with water immediately, don't use acetone or solvents",
        "Skin sensitization develops over time—you might not feel anything on first contact, then suddenly react after several exposures",
        "Once you're sensitized to resin, you may have to stop working with it—prevention is critical",
      ],
      warning:
        "Epoxy/polyester resin in the eyes causes chemical burns and temporary or permanent vision loss. Always wear safety glasses. One splash of unseen resin on skin during work can cause contact dermatitis days later.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Fibreglass & Carbon Fiber Hazards
    // ========================================================================
    {
      type: "key_concept",
      id: "plastics-fiber-01",
      title: "Fibreglass & Carbon Fiber: Irritation & Inhalation Hazards",
      icon: "🪡",
      content:
        "Fibreglass and carbon fiber are strong materials, but they're made of tiny fibers that irritate skin and lungs when released into the air.\n\n" +
        "**FIBREGLASS HAZARDS**\n" +
        "- **Loose fibers:** Break free when you cut, sand, or drill. These fibers are 1-10 micrometers in diameter—small enough to lodge in lungs.\n" +
        "- **Skin irritation:** Direct contact causes itching and rashes. Once loose fibers get into clothes, they're difficult to remove and continue irritating skin.\n" +
        "- **Respiratory irritation:** Inhaled fibers irritate lungs and cause coughing. Chronic exposure can cause scarring (fibrosis).\n\n" +
        "**CARBON FIBER HAZARDS**\n" +
        "- **Conductive:** Carbon fiber conducts electricity. Never work with carbon fiber near electrical equipment or where it could touch power lines.\n" +
        "- **Dust hazard:** Cutting and sanding release conductive carbon particles (fine black dust). Inhalation is a lung hazard; the dust is also flammable in high concentrations.\n" +
        "- **Sharper than fibreglass:** Carbon fibers have sharp edges that penetrate skin more easily.\n\n" +
        "**MANDATORY PPE FOR FIBER WORK**\n" +
        "- **Nitrile gloves (required)** — latex is not good enough. Fibers can penetrate latex.\n" +
        "- **P2/N95 mask (required)** — P2 is the Australian standard for fibrous dust. N95 is equivalent.\n" +
        "- **Long sleeves and pants** — cover all exposed skin\n" +
        "- **Safety glasses** — flying fibers can hit eyes\n" +
        "- **Hairnet or hat** — loose hair traps fibers\n\n" +
        "**SAFE FIBER WORK PROCEDURE**\n" +
        "1. **Wet the material before cutting** — water keeps fibers from becoming airborne\n" +
        "2. **Cut or drill slowly** — high-speed cutting releases more fibers\n" +
        "3. **Use extraction** — extraction pulls fibers away from your breathing zone\n" +
        "4. **Sand if needed, but minimally** — sanding is the worst for fiber release. Use a sander with dust extraction (HEPA filter).\n" +
        "5. **Dispose of fiber scraps in a sealed container** — they're hazardous waste\n" +
        "6. **Don't leave fiber waste on the floor** — it becomes a breathing hazard for everyone\n" +
        "7. **Wash hands and change clothes after** — fibers in clothes will continue irritating\n\n" +
        "**IF YOU GET FIBER IRRITATION**\n" +
        "- **Skin itch:** Wash immediately with cool water and soap. Avoid hot water (opens pores).\n" +
        "- **Eye irritation:** Rinse at the eyewash station for 10+ minutes.\n" +
        "- **Respiratory irritation:** Stop work immediately, move to fresh air, alert your teacher.",
      tips: [
        "Wet cutting prevents fiber release—always ask 'can I wet this?'",
        "P2 masks are essential for fiber work—don't work without one",
        "Carbon fiber work requires extra caution if electrical equipment is nearby",
        "Fiber irritation is cumulative—even if you don't feel bad now, repeated exposure makes it worse",
      ],
      warning:
        "Chronic inhalation of fibreglass fibers can cause pulmonary fibrosis (scarring of lungs). A small scratch from a carbon fiber edge can become infected. Always use full PPE for fiber work.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: Acrylic Cutting & Shaping
    // ========================================================================
    {
      type: "step_by_step",
      id: "plastics-acrylic-01",
      title: "Safe Acrylic Cutting & Shaping Procedure",
      steps: [
        {
          number: 1,
          instruction:
            "**MARK YOUR LINE CLEARLY:** Use a permanent marker or tape to mark the cut line. Acrylic cracks easily if you start off-line. Mark on the back side if visibility is better there.",
          checkpoint: "Line is visible and straight. You know exactly where the cut goes.",
        },
        {
          number: 2,
          instruction:
            "**FOR STRAIGHT CUTS:** Use a bandsaw or table saw with a fine-tooth blade (80+ teeth). Set the fence so your hands stay 10cm away from the blade. Push the acrylic straight through without forcing it—let the blade do the work.",
          warning:
            "Acrylic can melt if cut too fast. If you smell hot plastic or see smoke, slow down. Never force acrylic into the blade.",
        },
        {
          number: 3,
          instruction:
            "**FOR CURVED CUTS:** Use a jigsaw with a fine-tooth blade designed for plastics. Mark your curve clearly, then cut slowly. Support the acrylic so it doesn't vibrate—vibration causes cracks.",
          checkpoint:
            "Curve is cut cleanly with minimal chipping. Take your time—rushed curved cuts crack.",
        },
        {
          number: 4,
          instruction:
            "**FINISH THE EDGES:** Acrylic edges are sharp and frosted after cutting. Sand them smooth with 120-grit sandpaper, then 240-grit for a clearer edge. Wear a dust mask—acrylic dust is fine and irritating.",
          image: "/images/safety/acrylic-finishing.png",
        },
        {
          number: 5,
          instruction:
            "**FOR HEAT SHAPING:** Use a heat gun or design oven (NOT a domestic oven). Position the heat gun 10-15cm from the acrylic, moving constantly. Watch for the material to become soft and pliable (no color change). The moment it starts to yellow, stop—you're approaching the degradation temperature.",
          warning:
            "Acrylic becomes 100°C+ and can cause severe burns. Use heat-resistant gloves and never touch the material until it cools (2-3 minutes).",
        },
        {
          number: 6,
          instruction:
            "**ALLOW TO COOL FULLY:** Once shaped, let the acrylic cool completely before handling. Trying to move or handle warm acrylic can cause burns and ruin your shape.",
          checkpoint: "Material is cool to touch and shape is set. No color change or smell detected.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 8: Before/After - Heating Setup
    // ========================================================================
    {
      type: "before_after",
      id: "plastics-heating-ba-01",
      title: "Plastic Heating: Wrong vs Right",
      before: {
        caption: "NOT SAFE: Heating acrylic without extraction or temperature control",
        hazards: [
          "No extraction system running—fumes stay in workshop",
          "Heat gun nozzle too close to material (3cm away)",
          "No thermometer or temperature feedback",
          "Plastic already browning (approaching degradation)",
          "No gloves worn—heat burn risk",
          "Work area crowded—other students exposed to fumes",
        ],
        image: "/images/safety/plastic-heating-wrong.png",
      },
      after: {
        caption: "SAFE: Acrylic heating with extraction, temperature control, and PPE",
        principles: [
          "Extraction running 2-3 minutes before heating starts",
          "Heat gun nozzle 10-15cm from material surface",
          "Constant motion—never holding heat on one spot",
          "Acrylic still clear (no browning) = safe temperature range",
          "Heat-resistant gloves worn",
          "Adequate workspace—no bystanders in fume path",
        ],
        image: "/images/safety/plastic-heating-right.png",
      },
      key_difference:
        "Proper setup takes 5 extra minutes but prevents toxic fumes, burn injuries, and ruined materials. This is non-negotiable for ANY plastic heating.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 9: Scenario - Resin Splash Decision
    // ========================================================================
    {
      type: "scenario",
      id: "plastics-scenario-01",
      title: "Resin Splash: What Do You Do?",
      setup:
        "You're mixing epoxy resin in a cup. As you stir, a drop splashes out and lands on your bare forearm. It doesn't hurt right away, but you feel the wet resin on your skin. What's your next action?",
      branches: [
        {
          id: "resin-scenario-wrong-1",
          choice_text: "Wipe it off immediately with a cloth and keep working",
          is_correct: false,
          feedback:
            "❌ Wiping spreads the resin over a larger skin area, increasing sensitization risk. Resin needs water to remove it—cloth just moves it around.",
          consequence: "Higher chance of developing contact dermatitis in the next 24-48 hours.",
        },
        {
          id: "resin-scenario-wrong-2",
          choice_text: "Use acetone or solvent to wash it off quickly",
          is_correct: false,
          feedback:
            "❌ Solvents dissolve the protective barriers in your skin, making sensitization WORSE. Never use solvents on resin skin contact. Water only.",
          consequence: "Significantly increased risk of severe contact dermatitis.",
        },
        {
          id: "resin-scenario-correct",
          choice_text: "Immediately rinse with cool running water for 2-3 minutes, then wash with soap",
          is_correct: true,
          feedback:
            "✓ Correct! Water rinses the resin away without damaging your skin. Cool water (not hot) prevents opening skin pores. Then soap helps remove any remaining resin.",
          consequence: "Resin removed safely. Risk of sensitization significantly reduced.",
        },
        {
          id: "resin-scenario-wrong-3",
          choice_text: "Wait to see if you have a reaction before doing anything",
          is_correct: false,
          feedback:
            "❌ By the time you feel a reaction (itching, redness), the resin has already begun to sensitize your skin. You've lost the critical window to rinse it away.",
          consequence: "Higher chance of developing contact dermatitis.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 10: Scenario - Fume Detection
    // ========================================================================
    {
      type: "scenario",
      id: "plastics-scenario-02",
      title: "Detecting Thermal Degradation: What's That Smell?",
      setup:
        "You're heat-shaping an acrylic sheet with a heat gun. You notice a sharp, chemical smell coming from the acrylic—different from normal plastic smell. The acrylic isn't visibly discolored yet. What do you do?",
      branches: [
        {
          id: "fume-scenario-wrong-1",
          choice_text: "Keep heating—the smell will go away once the plastic fully softens",
          is_correct: false,
          feedback:
            "❌ That sharp smell IS the warning signal. It means thermal degradation has started. More heat will make it worse, releasing more toxic fumes.",
          consequence: "Fumes spread through the workshop, affecting other students. Material gets ruined. Possible health effects.",
        },
        {
          id: "fume-scenario-correct",
          choice_text: "STOP heating immediately, turn off the heat gun, run extraction at full power, and alert your teacher",
          is_correct: true,
          feedback:
            "✓ Correct! You recognized the warning sign—sharp chemical smell means thermal degradation. Stopping immediately limits fume release. Extraction clears the air. Your teacher can identify what went wrong.",
          consequence: "Incident controlled. Fumes limited. Material salvageable (maybe). Classmates safe.",
        },
        {
          id: "fume-scenario-wrong-2",
          choice_text: "Close the extraction and continue heating—it's probably just normal plastic smell",
          is_correct: false,
          feedback:
            "❌ Closing extraction traps the fumes. That sharp smell is 100% a warning sign, not normal. Ignoring it puts everyone at risk.",
          consequence: "Workshop fills with toxic fumes. Possible evacuation. Health effects for multiple students.",
        },
        {
          id: "fume-scenario-wrong-3",
          choice_text: "Open a window and keep heating—fresh air will carry fumes away",
          is_correct: false,
          feedback:
            "❌ Open windows help but don't stop the source. You need to STOP the heating immediately. Opening a window is not enough if the material is actively degrading.",
          consequence: "Fumes continue to be released. Incomplete mitigation. Risk to health.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 11: Check Understanding - Fume Response
    // ========================================================================
    {
      type: "comprehension_check",
      id: "plastics-check-02",
      question:
        "You notice white smoke coming from acrylic you're heating. What should you do FIRST?",
      options: [
        "Add more heat to complete the shaping quickly",
        "Stop heating immediately and turn off the heat source",
        "Close the workshop door to keep fumes contained",
        "Call your teacher after you finish the shape",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Smoke is a sign of degradation. You must stop the heat source immediately to stop fume release. Everything else (extraction, teacher alert) happens after you've stopped the source.",
      feedback_wrong:
        "Not quite. Smoke from acrylic means it's degrading and releasing toxic fumes. Your first action must be to stop the heat source immediately. Containment and alerts come next.",
      hint: "What's the first thing you do to stop a problem at the source?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Check Understanding - Resin Safety
    // ========================================================================
    {
      type: "comprehension_check",
      id: "plastics-check-03",
      question: "Why is resin considered a skin hazard even before it's cured?",
      options: [
        "It's hot and causes burns",
        "It's a skin sensitizer that can cause contact dermatitis with repeated exposure",
        "It's slippery and causes falls",
        "It hardens too quickly to remove safely",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Even small amounts of liquid resin can trigger contact dermatitis, which gets worse with repeated exposures. That's why gloves are mandatory—prevention stops sensitization from starting.",
      feedback_wrong:
        "Not quite. Resin's main hazard is that it's a skin sensitizer. Repeated skin contact can cause contact dermatitis that persists for life. Gloves prevent this sensitization from developing.",
      hint: "Think about what happens to your skin if it touches resin multiple times.",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 13: Summary & Quiz Ready
    // ========================================================================
    {
      type: "key_concept",
      id: "plastics-summary-01",
      title: "Ready for the Plastics & Composites Safety Quiz",
      icon: "✅",
      content:
        "You've learned how to work safely with plastics, resins, and fiber composites:\n\n" +
        "✓ **Material Identification** — Know what you're working with (acrylic, PVC, epoxy, fibreglass) before you start\n" +
        "✓ **Heating Safety** — Extraction always running, watch for color/smell change, know degradation temperatures\n" +
        "✓ **Resin Handling** — Nitrile gloves mandatory, immediate water rinse if contact, dispose of waste properly\n" +
        "✓ **Fiber Safety** — P2 mask, gloves, wet cutting when possible, no chronic dust inhalation\n" +
        "✓ **Fume Response** — Sharp chemical smell = STOP immediately, run extraction, alert teacher\n" +
        "✓ **Heat Shaping** — Slow, constant motion, watch for browning, cool before handling\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Plastics & Composites Safety badge.\n\n" +
        "**Remember:** These rules exist because students have been burned, sensitized, or exposed to toxic fumes. You're learning from their experiences—don't repeat them.",
      tips: [
        "If you see anything unusual (smell, smoke, color change) while working with plastics, STOP and alert your teacher",
        "Gloves and masks are not optional—they're personal protection that only work if you wear them",
        "You can ask your teacher any question before the quiz—safety questions are always welcome",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type PlasticsModuleType = typeof PLASTICS_MODULE;
