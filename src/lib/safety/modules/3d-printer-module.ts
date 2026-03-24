/**
 * 3D Printer Safety Learning Module
 *
 * Covers thermal burn hazards (hot end 200°C+, heated bed), fume/VOC exposure,
 * filament handling and storage, mechanical entanglement, electrical safety,
 * thermal runaway prevention, and failed print management.
 *
 * Learning flow:
 * 1. Engage: Real incident story (thermal runaway fire)
 * 2. Inform: Temperature hazards, filament types, VOCs, mechanical risks
 * 3. Apply: Before/after setup, scenario decision-making
 * 4. Verify: Step-by-step procedure and comprehension checks
 *
 * Total estimated time: 12 minutes
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

export const THREE_D_PRINTER_MODULE: LearningModule = {
  badge_id: "3d-printer-safety",
  learning_objectives: [
    "Explain the temperature ranges of a 3D printer (hot end, heated bed) and burn risk",
    "Describe thermal runaway and why printer supervision is critical",
    "Identify filament types (PLA, ABS, PETG) and their hazards",
    "Apply safe filament handling and storage procedures",
    "Explain VOC (volatile organic compound) exposure and ventilation requirements",
    "Demonstrate proper shutdown and maintenance procedures",
    "Respond correctly to a failed print or thermal emergency",
    "Apply ESD (electrostatic discharge) precautions for electronic components",
  ],
  estimated_minutes: 12,
  blocks: [
    // ========================================================================
    // BLOCK 1: Engage with Thermal Runaway Incident
    // ========================================================================
    {
      type: "micro_story",
      id: "3d-printer-story-01",
      title: "The Thermal Runaway Fire",
      narrative:
        "A student was 3D printing an overnight project—a 6-hour print job. The printer was in the workshop, but the student didn't stay to monitor it (they figured once the print started, it would be fine).\n\n" +
        "About 3 hours into the print, the printer's temperature sensor malfunctioned. The sensor is supposed to tell the heater 'stop, we're at the right temperature.' When it failed, the heater kept heating, and heating, and heating.\n\n" +
        "The hot end (the nozzle that extrudes plastic) went from the normal 220°C to 300°C+. At this temperature, the plastic in the nozzle burns instead of melting. Burned plastic is brittle and expands. Pressure built up in the hot end.\n\n" +
        "The pressure pushed back on the heater block. The thermal compound that transfers heat from the cartridge heater to the block burned away. More heat went into the surrounding aluminum block—it got so hot it began to glow.\n\n" +
        "Heat radiated to nearby plastic parts of the printer frame. The plastic began to melt and warp. The print head support sagged. The nozzle touched the heated bed.\n\n" +
        "Sparks started. The plastic insulation on nearby wires began to burn. Smoke filled the workshop.\n\n" +
        "A passerby noticed the smoke and alerted the teacher. The printer was unplugged immediately. The workshop had to be evacuated and air-purged. The printer sustained $800 in damage (melted parts, burned electronics). One person got minor smoke inhalation and had to go home early.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of the thermal runaway?",
          reveal_answer:
            "Temperature sensor failure. The sensor malfunctioned, so the heater didn't know when to stop heating. Some printers have safety limits that cut off power if temperature gets too high—this one apparently didn't, or the limit was set too high.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "(1) Don't leave the printer unattended during printing. Monitor the first 10 minutes to ensure it's heating correctly. (2) Check the printer's maintenance schedule—sensors need cleaning and replacement periodically. (3) Know the thermal runaway warning signs: weird noises, unusual smells, discoloration of parts. (4) Have a fire extinguisher nearby. (5) Keep the area around the printer clear of flammable materials.",
        },
        {
          question: "What warning signs happened before the fire started?",
          reveal_answer:
            "The thermal compound burning would produce a distinct smell. The plastic parts warping would create sounds. The nozzle touching the bed would cause unusual mechanical noises. These are warning signs that someone present could have caught.",
        },
      ],
      key_lesson:
        "3D printers generate extreme heat (200-250°C) and can fail catastrophically if unsupervised. The first 10 minutes of a print are critical—you must be present to verify normal behavior.",
      related_rule: "Rule #1: Monitor the first 10 minutes of every print. Know the warning signs of thermal runaway.",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 2: Temperature Hazards & Burn Prevention
    // ========================================================================
    {
      type: "key_concept",
      id: "3d-printer-temp-01",
      title: "Temperature Hazards: Hot End & Heated Bed",
      icon: "🔥",
      content:
        "3D printers use extreme temperatures to melt and extrude plastic. These temperatures can cause severe burns in seconds. You must respect them.\n\n" +
        "**HOT END (The Nozzle & Heating Block)**\n" +
        "- **Temperature:** 200-250°C (depending on filament type)\n" +
        "- **For comparison:** Boiling water is 100°C. A 220°C hot end is 2.2× hotter than boiling water.\n" +
        "- **Burn depth:** Contact with a 220°C surface causes a 3rd-degree burn (full thickness skin damage) in <1 second\n" +
        "- **Appearance:** The hot end looks like a small metal nozzle. It doesn't glow visibly in normal light (unlike forge heat), so you can't judge its temperature by sight.\n" +
        "- **Safe distance:** Keep at least 5cm away from the hot end during printing\n" +
        "- **Cooling time:** After the printer is turned off, the hot end remains hot for 10-15 minutes. Never touch it immediately after shutdown.\n\n" +
        "**HEATED BED**\n" +
        "- **Temperature:** 60°C (for PLA) to 110°C (for ABS)\n" +
        "- **Appearance:** A flat metal plate that gets warm but not visibly hot\n" +
        "- **Burn risk:** 60°C causes burns in 3-5 seconds. 110°C causes burns in <1 second.\n" +
        "- **Safe distance:** Keep fingers away from the bed during printing\n" +
        "- **Cooling time:** The bed stays warm for 5-10 minutes after shutdown\n\n" +
        "**BURN PREVENTION RULES**\n" +
        "1. **Never touch the printer while it's operating.** Even if you think you're just going to make a small adjustment, the printer is moving and parts are hot.\n" +
        "2. **Never reach into the print chamber** while printing or immediately after shutdown.\n" +
        "3. **Wait 15 minutes after shutdown** before handling the hot end or bed.\n" +
        "4. **If you must check the print mid-job:** Use tweezers or forceps, not bare fingers. Keep hands back.\n" +
        "5. **Know the warning signs of thermal problems:**\n" +
        "   - Clicking/grinding noises (extrusion problem, often from overheating)\n" +
        "   - Burning plastic smell (overheated nozzle, thermal runaway starting)\n" +
        "   - Discoloration of the print head (overheating)\n" +
        "   - Print failing to stick to bed (bed temperature wrong, often too hot)\n\n" +
        "**IF YOU GET A BURN**\n" +
        "- **Cool immediately:** Run cool (not ice cold) water over the burn for 10-15 minutes\n" +
        "- **Alert your teacher:** Even minor burns should be reported and documented\n" +
        "- **Do not apply ice directly:** Ice can cause more tissue damage\n" +
        "- **Do not apply ointments:** Keep the burn clean and dry initially",
      tips: [
        "Set a phone timer for 15 minutes after shutdown before you touch the printer",
        "If a print fails mid-job, use forceps to remove the print—don't reach in with hands",
        "Learn to identify normal printer sounds vs problem sounds—ask your teacher to demonstrate",
        "If the printer smells like burning plastic, immediately turn it off and alert your teacher",
      ],
      warning:
        "A 220°C hot end will cause a severe burn in under 1 second. There's no recovery time or chance to pull away—it's instant. Respect the temperature.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Filament Types & VOC Hazards
    // ========================================================================
    {
      type: "key_concept",
      id: "3d-printer-filament-01",
      title: "Filament Types: Properties & Hazards",
      icon: "🧵",
      content:
        "Different 3D printing materials have different melting temperatures, chemical composition, and hazards. Knowing the type matters.\n\n" +
        "**PLA (Polylactic Acid)**\n" +
        "- **Source:** Plant-based (corn starch, sugarcane). Biodegradable.\n" +
        "- **Melting temp:** 200-210°C\n" +
        "- **Printing ease:** Easy (low warping, good adhesion)\n" +
        "- **VOC hazard:** Minimal. PLA produces small amounts of formaldehyde when heated, but well-ventilated spaces are safe.\n" +
        "- **Strength:** Lower strength than ABS, but good for prototyping\n" +
        "- **Storage:** Hygroscopic (absorbs moisture from air). Store in a dry container or with desiccant packs.\n\n" +
        "**ABS (Acrylonitrile Butadiene Styrene)**\n" +
        "- **Source:** Petroleum-based plastic\n" +
        "- **Melting temp:** 230-250°C (requires heated bed at 100°C+)\n" +
        "- **Printing ease:** Harder (more warping, needs heated bed and chamber)\n" +
        "- **VOC hazard:** HIGH. ABS releases acetone and styrene vapors when heated. Styrene is a respiratory irritant and neurotoxin (especially concerning for developing brains in young people). Acetone vapors can cause dizziness and headaches.\n" +
        "- **Strength:** High strength, good for functional parts\n" +
        "- **Safe printing:** Must use extraction/fume hood or print outdoors. Never print ABS in an unventilated workshop.\n" +
        "- **Storage:** Store in sealed container (ABS absorbs odors and degrades if exposed to moisture/UV)\n\n" +
        "**PETG (Polyethylene Terephthalate Glycol)**\n" +
        "- **Source:** Petroleum-based, same polymer as plastic beverage bottles\n" +
        "- **Melting temp:** 220-240°C (needs moderate heated bed at 80°C+)\n" +
        "- **Printing ease:** Moderate (better than ABS, easier than PLA)\n" +
        "- **VOC hazard:** Moderate. Produces some odor and VOCs, but less intense than ABS. Extraction recommended but not critical.\n" +
        "- **Strength:** Good balance of strength and ease\n" +
        "- **Storage:** Similar to ABS—sealed container, away from UV\n\n" +
        "**OTHER FILAMENTS**\n" +
        "- **TPU/TPA (Flexible):** Low VOC, but can be stringy and difficult to print\n" +
        "- **Nylon:** High strength, high temperature, but high VOC. Extraction required.\n\n" +
        "**VOC EXPOSURE PREVENTION**\n" +
        "- **For PLA:** Normal ventilation is sufficient (window open, door open, or standard room ventilation)\n" +
        "- **For ABS/Nylon:** Must have active extraction or fume hood. If none available, don't print these materials indoors.\n" +
        "- **For PETG:** Moderate ventilation (window open is probably sufficient, but extraction is better)\n" +
        "- **Signs of VOC exposure:** Headache, dizziness, burning eyes, throat irritation. If you feel these, immediately move to fresh air and alert your teacher.",
      tips: [
        "Default to PLA unless your teacher approves a different material—it's the safest option",
        "Never print ABS indoors without extraction—the fume exposure is real and harmful",
        "Check the filament label to know what you're printing—don't guess",
        "Store filament properly (sealed, dry, cool) to keep it printable and prevent degradation",
      ],
      warning:
        "ABS vapors are a respiratory hazard, especially for young people. The harm is not immediate (no burning sensation like with laser fumes), which makes it insidious—you feel OK but you're inhaling neurotoxins. Don't print ABS without extraction.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Check Filament Knowledge
    // ========================================================================
    {
      type: "comprehension_check",
      id: "3d-printer-filament-check-01",
      question: "Why is ABS filament riskier than PLA for 3D printing?",
      options: [
        "It's more expensive and wastes money if the print fails",
        "It requires higher temperatures that can overheat the printer",
        "It releases acetone and styrene vapors that are respiratory hazards",
        "It doesn't stick to the heated bed as well as PLA",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! ABS releases volatile organic compounds (VOCs)—acetone and styrene—which are respiratory irritants and neurotoxins. Styrene is especially concerning for developing brains. This is why ABS requires extraction or outdoor printing.",
      feedback_wrong:
        "Not quite. ABS's main hazard is that it releases acetone and styrene vapors (VOCs) when heated. These are respiratory irritants that can cause neurotoxic effects, especially in young people. This is why ABS requires extraction.",
      hint: "What chemical hazard is unique to ABS compared to PLA?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 5: Thermal Runaway & Printer Supervision
    // ========================================================================
    {
      type: "key_concept",
      id: "3d-printer-runaway-01",
      title: "Thermal Runaway: Why You Must Monitor the First 10 Minutes",
      icon: "⚠️",
      content:
        "Thermal runaway is a cascade failure where the printer's heating system overheats unchecked, potentially causing fire. It starts silently and escalates fast. Supervision prevents it.\n\n" +
        "**WHAT IS THERMAL RUNAWAY?**\n" +
        "The printer has a temperature sensor that tells the heater 'stop heating, we're at the right temperature.' If that sensor fails (or malfunctions), the heater keeps going. Temperature rises past the setpoint—the control system can't stop it because the sensor is giving wrong readings.\n\n" +
        "Once temperature gets high enough, the plastic in the nozzle starts to burn (not melt, but burn). Burned plastic expands and creates pressure. More heat is generated by the burning. Temperature rises faster. The heater tries to catch up with an even higher setpoint. Runaway.\n\n" +
        "**THE DANGEROUS PART**\n" +
        "- **It starts silently.** For the first 30-60 seconds, you won't notice anything unusual.\n" +
        "- **Visual cues don't help.** A 300°C hot end doesn't visually look much different from a 220°C hot end in normal light.\n" +
        "- **It escalates fast.** Once started, thermal runaway can go from problem to fire in 2-5 minutes.\n" +
        "- **Only human supervision catches it early.** Sensors are what caused it; you're the backup.\n\n" +
        "**WARNING SIGNS OF THERMAL RUNAWAY**\n" +
        "1. **Odd sounds:** The printer makes unusual clicking, grinding, or whining noises. These indicate the extruder is struggling (pressure building in the nozzle).\n" +
        "2. **Burning smell:** Sharp, acrid plastic smell. This is your earliest warning—burned plastic is distinct.\n" +
        "3. **Discoloration:** The metal heater block or surrounding area turns dark/brown/black. Heat is literally cooking the metal.\n" +
        "4. **Print quality fails suddenly:** The print stops sticking, oozes, or starts dripping. The nozzle is leaking because pressure is too high.\n" +
        "5. **Smoke or flames:** If you see any smoke or flames, this is the end-stage. Emergency shut down.\n\n" +
        "**FIRST 10 MINUTES ARE CRITICAL**\n" +
        "- **Always stay with the printer** for the first 10 minutes of a print\n" +
        "- **Watch for normal behavior:** Leveling procedure, nozzle temperature stabilizing, first few layers printing smoothly\n" +
        "- **If anything seems off,** immediately press the power button to stop the printer\n" +
        "- **After 10 minutes:** If the print is running smoothly with no unusual sounds/smells, you can step away (though monitoring longer is still better)\n\n" +
        "**PRINTER MAINTENANCE**\n" +
        "To prevent thermal runaway:\n" +
        "- **Clean the nozzle regularly** (every 20-30 hours of printing) — blockages cause pressure and heat buildup\n" +
        "- **Replace the thermistor (temperature sensor)** every 200-300 printing hours or if you suspect it's failing\n" +
        "- **Check firmware:** Some printers have software updates that improve thermal runaway detection. Ask your teacher if updates are available.\n" +
        "- **Know your printer's thermal runaway protection:** Some printers have cutoff switches (e.g., if temperature exceeds 250°C, power cuts). Know what your model has.",
      tips: [
        "Set a phone timer for the first 10 minutes—make it a habit to stay for this period",
        "If you smell burning plastic at any point, it's not a false alarm—immediately turn off the printer",
        "Long prints (6+ hours) should still have periodic check-ins (every 1-2 hours) to verify normal operation",
        "Learn the normal sounds your printer makes—this way, unusual sounds stand out",
      ],
      warning:
        "Thermal runaway can cause a fire. It starts silently and escalates in minutes. The first 10 minutes of every print are non-negotiable supervision time. Don't skip it.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Safe Filament Handling & Storage
    // ========================================================================
    {
      type: "step_by_step",
      id: "3d-printer-filament-01",
      title: "Safe Filament Handling & Storage Procedure",
      steps: [
        {
          number: 1,
          instruction:
            "**INSPECT FILAMENT BEFORE USE:** Look at the filament spool:\n- Is it bent, kinked, or deformed? Bent filament doesn't feed smoothly.\n- Is the surface rough or damaged? Damaged filament can jam the extruder.\n- Is there mold or discoloration? Filament stored improperly can degrade.\n\nIf the filament looks damaged, tell your teacher.",
          checkpoint: "Filament is straight, clean, and ready to use.",
        },
        {
          number: 2,
          instruction:
            "**MOUNT THE SPOOL CORRECTLY:** The filament spool mounts on the printer's filament holder.\n- Insert the spool axle through the center hole\n- Ensure the spool can rotate freely (spin it by hand to check)\n- Secure the spool so it doesn't fall off during printing\n- The filament path from spool to extruder should be straight and unobstructed",
          warning:
            "A loose spool can fall off mid-print, tangling filament and jamming the extruder.",
        },
        {
          number: 3,
          instruction:
            "**FEED FILAMENT INTO EXTRUDER:** Before starting a print:\n- Heat the nozzle to the appropriate temperature (your teacher will tell you: 210°C for PLA, 240°C for ABS, etc.)\n- Push filament into the extruder opening until you feel resistance\n- Use the printer's extrude button to manually feed filament until it comes out the nozzle\n- This primes the nozzle and ensures good adhesion for the first layer",
          checkpoint: "Filament is feeding smoothly, nozzle is primed, first extrusion is clear.",
        },
        {
          number: 4,
          instruction:
            "**LOADING INTO PRINTER (Bowden tube setup):** If your printer has a Bowden tube (tube that guides filament from spool to hot end):\n- Insert filament into the tube inlet until you feel it catch\n- The filament should feed smoothly through the tube\n- If resistance is high, the tube may be clogged—alert your teacher",
          image: "/images/safety/3d-printer-loading.png",
        },
        {
          number: 5,
          instruction:
            "**STORE FILAMENT PROPERLY:** After use or long-term storage:\n- **PLA:** Store in a sealed container with desiccant packs (silica gel). PLA absorbs moisture from air—wet PLA prints poorly and can damage the nozzle.\n- **ABS/PETG:** Store in a sealed container away from direct sunlight (UV degrades these materials). Include desiccant packs.\n- **Cool, dry location:** Room temperature (20-25°C), low humidity (<40%)\n- **Away from heat sources:** Don't store near heaters, sunlit windows, or heat-producing equipment",
          checkpoint: "Filament is stored sealed, dry, and away from heat and UV.",
        },
        {
          number: 6,
          instruction:
            "**HANDLE BROKEN FILAMENT:** If filament snaps during a print:\n- **Stop the printer immediately** (press power button)\n- **Remove the broken piece from the nozzle** using tweezers (wait 15 minutes if the nozzle is hot)\n- **Reload new filament** starting from step 3\n- **Resume the print** from the layer where it broke (if possible) or restart if the break happened early",
          checkpoint:
            "Broken filament is safely removed and replaced. Printer is ready to resume.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 7: Before/After - Printer Workspace
    // ========================================================================
    {
      type: "before_after",
      id: "3d-printer-workspace-ba-01",
      title: "3D Printer Workspace: Wrong vs Right Setup",
      before: {
        caption: "NOT SAFE: Unsafe printer workspace setup",
        hazards: [
          "Printer placed on an unstable table (could topple)",
          "Loose wires and cables creating trip hazards",
          "Flammable materials (paper, plastic bags) stored near printer",
          "No space to work—clutter around the printer",
          "No fire extinguisher visible nearby",
          "Printer venting hot air toward a student's hand",
        ],
        image: "/images/safety/3d-printer-workspace-wrong.png",
      },
      after: {
        caption: "SAFE: Professional 3D printer workspace",
        principles: [
          "Printer on a sturdy, level table or enclosure",
          "Clear cables routed safely (no trip hazards)",
          "Clear workspace around printer (no clutter)",
          "Flammable materials stored away from printer",
          "Fire extinguisher mounted within arm's reach",
          "Printer venting hot air upward or to a safe exhaust",
        ],
        image: "/images/safety/3d-printer-workspace-right.png",
      },
      key_difference:
        "A safe printer workspace takes 5 minutes to set up and prevents fires, trips, and accidental contact with hot parts. This is baseline safety.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 8: Scenario - Failed Print
    // ========================================================================
    {
      type: "scenario",
      id: "3d-printer-scenario-01",
      title: "Handling a Failed Print Mid-Job",
      setup:
        "You're 30 minutes into a 90-minute 3D print. Suddenly, the print starts to fail—filament isn't sticking to the bed, and the nozzle is dragging through air instead of printing. You need to stop the print and fix it. What do you do?",
      branches: [
        {
          id: "fail-scenario-wrong-1",
          choice_text: "Reach in while the printer is running and pull the failed print off the bed",
          is_correct: false,
          feedback:
            "❌ The nozzle is 220°C and moving fast. Reaching in risks a severe burn and interfering with the moving parts.",
          consequence: "Burn risk or injury from moving parts.",
        },
        {
          id: "fail-scenario-correct",
          choice_text: "Press the power button to stop the printer, wait 15 minutes for the hot end to cool, then remove the failed print",
          is_correct: true,
          feedback:
            "✓ Correct! Stopping the printer first prevents burns and damage. Waiting for cooldown is the safe approach. Use tweezers if you need to remove it sooner.",
          consequence:
            "Failed print is safely removed. Hot end is cooled. Printer is ready for the next attempt.",
        },
        {
          id: "fail-scenario-wrong-2",
          choice_text: "Use your fingers to scrape away the failed print while the nozzle is still hot",
          is_correct: false,
          feedback:
            "❌ The nozzle is 220°C. Even brief contact causes a severe burn. Always wait for cooldown or use tools if you must work sooner.",
          consequence: "Severe burn on fingers.",
        },
        {
          id: "fail-scenario-wrong-3",
          choice_text: "Let the printer continue running in hopes it recovers on its own",
          is_correct: false,
          feedback:
            "❌ A failed print that's not sticking will keep failing. The nozzle will drag through air, potentially get jammed, or cause other problems. Stop immediately.",
          consequence: "Failed print continues to fail, potentially damaging the printer.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 9: Scenario - Smell Detection
    // ========================================================================
    {
      type: "scenario",
      id: "3d-printer-scenario-02",
      title: "Detecting a Problem: Burning Smell",
      setup:
        "You're monitoring a 3D print that's running normally. After 8 minutes, you notice a sharp, acrid smell coming from the printer—not the normal plastic smell, but something stronger. The print looks fine visually. What do you do?",
      branches: [
        {
          id: "smell-scenario-wrong-1",
          choice_text: "Ignore it—3D printers always smell a bit weird",
          is_correct: false,
          feedback:
            "❌ A sharp, acrid smell is NOT normal. It's a warning sign that something is overheating. This could be the start of thermal runaway.",
          consequence:
            "Thermal runaway proceeds unchecked. By the time you notice it, it could be too late.",
        },
        {
          id: "smell-scenario-correct",
          choice_text: "Stop the printer immediately by pressing the power button and alert your teacher",
          is_correct: true,
          feedback:
            "✓ Correct! Burning smell is a critical warning sign. Stopping immediately prevents thermal runaway from escalating. Your teacher can diagnose the issue.",
          consequence:
            "Printer is stopped. Thermal runaway is prevented. Issue can be investigated and fixed.",
        },
        {
          id: "smell-scenario-wrong-2",
          choice_text: "Open the printer window to let the smell out, but keep the print running",
          is_correct: false,
          feedback:
            "❌ Ventilating helps with VOCs, but it doesn't fix the underlying problem. If something is overheating, ventilation won't stop the thermal runaway.",
          consequence: "Problem continues. Thermal runaway is not prevented.",
        },
        {
          id: "smell-scenario-wrong-3",
          choice_text: "Check the temperature settings on the printer screen to confirm they're correct",
          is_correct: false,
          feedback:
            "❌ By the time you check settings, thermal runaway could be escalating. Your first action is always to STOP the printer (power button), not to troubleshoot.",
          consequence: "Critical time is wasted. Thermal runaway continues.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 10: Electrical Safety & Enclosures
    // ========================================================================
    {
      type: "key_concept",
      id: "3d-printer-electrical-01",
      title: "Electrical Safety & Printer Enclosures",
      icon: "⚡",
      content:
        "3D printers use electricity to power the heater, motors, and control board. Some printers sit in enclosed cabinets for temperature control. Both create electrical hazards.\n\n" +
        "**ELECTRICAL SAFETY BASICS**\n" +
        "- **Power cord:** Check for damage (cuts, exposed wires) before each use. Damaged cords are fire hazards.\n" +
        "- **Wet hands:** Never plug/unplug the printer with wet hands. Electricity + water = electrocution risk.\n" +
        "- **Power surges:** Use a surge protector, not a basic power strip. A surge (from lightning or grid issues) can destroy the printer and potentially start a fire.\n" +
        "- **Overheating:** Never cover the printer's cooling vents. Overheated electronics can catch fire.\n\n" +
        "**ENCLOSED PRINTER CHAMBERS**\n" +
        "Some printers sit in wooden or plastic enclosures for temperature control. These chambers have safety requirements:\n\n" +
        "- **Ventilation holes:** The enclosure must have ventilation to prevent heat buildup inside. Check that holes are clear.\n" +
        "- **Fire risk:** If the printer overheats and catches fire, the enclosure traps the fire. Enclosures MUST have a door that can open quickly, and a fire extinguisher must be nearby.\n" +
        "- **No flammable materials inside:** Don't store paper, plastic, or other combustibles inside the enclosure.\n" +
        "- **Temperature monitoring:** Check that the enclosure has thermometers or temperature sensors. Some enclosures have fans that activate if temperature gets too high.\n\n" +
        "**NEVER ATTEMPT**\n" +
        "- Do not open the control board while the printer is plugged in (electrocution risk)\n" +
        "- Do not modify electrical connections (fire risk)\n" +
        "- Do not spray liquids near electrical components (short circuit risk)\n" +
        "- Do not disconnect power mid-print without pressing stop first (can damage the control board)",
      tips: [
        "Check the power cord every time before use—it's the first line of defense",
        "If an enclosure feels too hot, open it and let it cool down",
        "Know where your fire extinguisher is BEFORE you need it",
        "If you see sparks, burning smell from electronics, or smoke from the control board, unplug immediately and alert your teacher",
      ],
      warning:
        "Electrical fires in 3D printers are possible. They start in the control board or heater circuit. These fires spread quickly because the printer is plugged into mains power. Immediate disconnection is critical.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 11: Check Understanding - Thermal Runaway
    // ========================================================================
    {
      type: "comprehension_check",
      id: "3d-printer-check-01",
      question:
        "You're monitoring a 3D print. You notice the printer making unusual clicking sounds and smell burning plastic. What's the first thing you should do?",
      options: [
        "Check the temperature settings on the screen",
        "Press the power button immediately to stop the printer",
        "Open the printer lid to see what's happening",
        "Call your teacher over to diagnose the problem",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Unusual sounds and burning smell are warning signs of thermal runaway. Your first action is always to STOP the printer (power button). Diagnosis comes after it's stopped.",
      feedback_wrong:
        "Not quite. When you detect warning signs (strange sounds, burning smell), your first action must be to immediately stop the printer by pressing the power button. Thermal runaway escalates fast—stopping it is the priority.",
      hint: "What's your first emergency response?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Check Understanding - Filament Storage
    // ========================================================================
    {
      type: "comprehension_check",
      id: "3d-printer-check-02",
      question: "Why should PLA filament be stored with desiccant packs?",
      options: [
        "To prevent the plastic from becoming brittle over time",
        "Because PLA absorbs moisture from air and prints poorly when wet",
        "To keep the spool from unraveling",
        "To prevent the filament from getting tangled",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! PLA is hygroscopic, meaning it absorbs moisture from the air. Wet filament doesn't extrude smoothly and can damage the nozzle. Desiccant packs keep it dry.",
      feedback_wrong:
        "Not quite. PLA absorbs moisture from air—it's hygroscopic. When filament gets wet, it doesn't extrude smoothly and can clog the nozzle. Desiccant packs prevent this moisture absorption.",
      hint: "What happens to plastic when it absorbs moisture?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 13: Summary & Quiz Ready
    // ========================================================================
    {
      type: "key_concept",
      id: "3d-printer-summary-01",
      title: "Ready for the 3D Printer Safety Quiz",
      icon: "✅",
      content:
        "You've learned how to work safely with 3D printers:\n\n" +
        "✓ **Temperature Hazards** — 220°C hot end causes 3rd-degree burns in <1 second; wait 15 minutes before touching\n" +
        "✓ **Filament Types** — PLA (low VOC, needs dry storage), ABS (high VOC, needs extraction), PETG (moderate)\n" +
        "✓ **Thermal Runaway** — Monitor first 10 minutes for warning signs (strange sounds, burning smell, discoloration)\n" +
        "✓ **Safe Filament Handling** — Inspect before use, mount correctly, store sealed with desiccant\n" +
        "✓ **Failed Prints** — Stop immediately, wait for cool-down, use tools not hands\n" +
        "✓ **Electrical Safety** — Check power cord, use surge protection, never open electronics while powered\n" +
        "✓ **Workspace Safety** — Sturdy table, clear area, fire extinguisher nearby\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your 3D Printer Safety badge.\n\n" +
        "**Remember:** 3D printers generate extreme heat and can fail catastrophically if unsupervised. The first 10 minutes of every print are non-negotiable. Burning smell is NEVER normal—it's a warning sign.",
      tips: [
        "Set a phone timer for the first 10 minutes of every print—make it a habit",
        "If anything feels wrong (smell, sound, visual changes), your instinct is probably correct—stop and investigate",
        "Long-term printing is stressful on the machine—monitor health by keeping track of nozzle cleanings and sensor replacements",
        "Earning this badge means you're trusted to operate professional equipment safely—take that responsibility seriously",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type ThreeDPrinterModuleType = typeof THREE_D_PRINTER_MODULE;
