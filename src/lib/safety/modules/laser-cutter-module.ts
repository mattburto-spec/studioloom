/**
 * Laser Cutter Safety Learning Module
 *
 * Covers laser beam hazards, fire prevention, material restrictions (especially PVC),
 * extraction/ventilation, never unattended operation, and safe file preparation.
 *
 * Learning flow:
 * 1. Engage: Real incident story (PVC cutting releases chlorine gas)
 * 2. Inform: Beam hazards, fire risk, material restrictions, extraction requirements
 * 3. Apply: Before/after comparisons, scenario decision-making
 * 4. Verify: Step-by-step procedure and comprehension checks
 *
 * Total estimated time: 14 minutes (longest module due to laser severity)
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

export const LASER_CUTTER_MODULE: LearningModule = {
  badge_id: "laser-cutter-safety",
  learning_objectives: [
    "Identify the 3 types of laser cutter hazards (beam, fire, fume)",
    "Explain why PVC and vinyl are absolutely prohibited in laser cutters",
    "Demonstrate understanding of extraction/ventilation requirements",
    "Apply the never-leave-unattended rule with zero exceptions",
    "Prepare a file correctly for laser cutting (no grouped objects, proper colors/speeds)",
    "Describe proper startup and shutdown procedures",
    "Respond correctly to a fire emergency with a laser cutter",
    "Explain why focus/speed settings matter for safety and quality",
  ],
  estimated_minutes: 14,
  blocks: [
    // ========================================================================
    // BLOCK 1: Engage with Real PVC Incident
    // ========================================================================
    {
      type: "micro_story",
      id: "laser-story-01",
      title: "The PVC Cutting Incident",
      narrative:
        "A design student was laser cutting a frame from PVC (polyvinyl chloride) plastic sheeting. They had submitted the file and started the cut—a simple rectangle, maybe 30 seconds of cutting.\n\n" +
        "The student didn't know that PVC is one of the most dangerous materials in a laser cutter. When PVC is heated (not even burned, just heated significantly), it releases hydrogen chloride gas (HCl), which is extremely corrosive to lungs and eyes.\n\n" +
        "As the laser cut through the PVC, it released a plume of hydrogen chloride gas directly into the cutter exhaust system. The extraction system was working properly, so most of the gas went out through the building's ductwork.\n\n" +
        "But some gas accumulated in the cutter chamber. The student was standing close to the cutter watching the cut progress (they had left the lid up slightly to see). As the cut finished, they inhaled the gas.\n\n" +
        "Within seconds, the student experienced:\n" +
        "- Sharp burning sensation in their throat and airways\n" +
        "- Difficulty breathing\n" +
        "- Eye irritation and watering\n" +
        "- Panic (difficulty breathing triggers fear)\n\n" +
        "The student stumbled away from the machine, coughing and gasping. They alerted their teacher. The building evacuated. An ambulance was called.\n\n" +
        "The student spent 6 hours in the hospital getting oxygen treatment and IV fluids. They recovered without permanent damage, but it was a trauma. The building had to be aired out for hours before anyone could re-enter the workshop.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "Why was PVC the worst choice for laser cutting?",
          reveal_answer:
            "PVC contains chlorine. When heated, PVC breaks down and releases hydrogen chloride (HCl) gas, which is corrosive to respiratory tissue. This is not a burn risk—it's a chemical poisoning risk.",
        },
        {
          question: "What warning signs did the student miss?",
          reveal_answer:
            "The student was watching the cut from close range. They should have noticed the yellow/brown smoke coming from the cut—that's hydrochloric gas. The smell of PVC degradation is acrid and distinctive. The student should have left the area immediately.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "(1) Know the material restrictions: PVC, vinyl, faux leather, and some other plastics are prohibited. (2) Check material before cutting. (3) If unsure, ask the teacher. (4) Never watch a cut from close range—mechanical failures and unexpected chemistry can happen. (5) Trust the extraction system—if you smell something, something is wrong.",
        },
      ],
      key_lesson:
        "Some materials (especially anything containing chlorine) CANNOT be laser cut safely. The danger is not always obvious until the gas is being released. Material knowledge is not optional.",
      related_rule: "Rule #1: PVC and vinyl are absolutely prohibited. No exceptions.",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 2: Laser Cutter Hazard Types
    // ========================================================================
    {
      type: "key_concept",
      id: "laser-hazards-01",
      title: "The 3 Types of Laser Cutter Hazards",
      icon: "⚠️",
      content:
        "Laser cutters combine three different hazard types. Understanding each one is critical for safety.\n\n" +
        "**HAZARD #1: LASER BEAM**\n" +
        "The laser beam is a concentrated column of infrared light (invisible to the naked eye in most cutters). The energy density is extreme.\n\n" +
        "- **Direct eye exposure:** Can cause permanent blindness in milliseconds. The retina doesn't have pain receptors—you feel no pain while it's happening. Damage is irreversible.\n" +
        "- **Skin exposure:** Can cause deep tissue burns (3rd degree) in fractions of a second.\n" +
        "- **Reflection hazard:** The beam reflects off shiny surfaces (mirror, polished metal). The reflection is just as dangerous as direct exposure.\n" +
        "- **Why the lid exists:** The lid stops accidental exposure. Never operate a laser cutter with the lid open while the beam is active.\n\n" +
        "**HAZARD #2: FIRE**\n" +
        "The laser is cutting by burning through material. Heat and sparks are produced. In an enclosed space, this is a fire hazard.\n\n" +
        "- **Material ignition:** Some materials (paper, wood, fabric) can catch fire if cut too slowly (high intensity, long exposure per area). The laser focus point reaches 1000°C+.\n" +
        "- **Accumulated smoke/dust:** Laser cutting produces smoke, small particles, and dust. In an enclosed space, this can ignite if it accumulates and gets hot enough.\n" +
        "- **Oxygen concentration:** Inside the cutter, oxygen is present. If enough flammable dust accumulates and gets hot enough, it can ignite suddenly.\n" +
        "- **Why extraction matters:** Extraction pulls fumes and particles out before they can accumulate and ignite. Blocked extraction = fire hazard.\n" +
        "- **Why you never leave unattended:** If a fire starts, you need to be there to (a) notice it immediately, (b) press the emergency stop, and (c) use the fire extinguisher if needed. A laser cutter fire can grow fast in a closed space.\n\n" +
        "**HAZARD #3: FUMES & GASES**\n" +
        "Different materials release different fumes when laser cut. Some are benign (wood smoke), some are toxic (PVC releases HCl, vinyl releases HCl and phosgene).\n\n" +
        "- **Acute inhalation:** Sharp chemical smell, throat irritation, difficulty breathing, eye watering. Requires immediate fresh air and possibly medical care.\n" +
        "- **Chronic exposure:** Repeated exposure to fumes (in a workshop where extraction is inadequate) can cause lung irritation and asthma-like symptoms.\n" +
        "- **Material-specific hazards:**\n" +
        "  - **PVC, vinyl, faux leather:** Hydrogen chloride (HCl) + phosgene (COCl2, extremely toxic). Prohibited.\n" +
        "  - **Polycarbonate:** Produces irritating vapors. Generally prohibited or restricted.\n" +
        "  - **Wood:** Smoke (benign, but extraction keeps it out of your lungs).\n" +
        "  - **Acrylic:** Mostly safe, some odor, extraction recommended.\n" +
        "  - **Leather/suede:** Generally safe, some odor.\n" +
        "  - **Fabric/canvas:** Safe, some smoke.\n\n" +
        "**RISK MITIGATION**\n" +
        "All three hazards are controlled by: (1) material selection, (2) extraction/ventilation, (3) never leaving unattended, (4) proper training, and (5) proper machine maintenance.",
      tips: [
        "If you smell anything unusual (chemical, acrid, burning), something is wrong—STOP immediately",
        "Never assume extraction is working—you may need to test it (feel airflow, watch for smoke dispersal)",
        "Material restrictions are not suggestions—they exist because of chemistry, not politics",
        "When in doubt about a material, ask your teacher before submitting the job",
      ],
      warning:
        "Laser beam exposure causes permanent blindness in milliseconds. PVC cutting releases lung-destroying gas. Unattended laser fires can destroy equipment and the building. Zero compromise on laser safety.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Material Restrictions
    // ========================================================================
    {
      type: "key_concept",
      id: "laser-materials-01",
      title: "Material Restrictions: The DO NOT CUT List",
      icon: "🚫",
      content:
        "Some materials are simply too dangerous to laser cut, period. This is not a flexible guideline—it's a safety boundary.\n\n" +
        "**ABSOLUTELY PROHIBITED (NO EXCEPTIONS)**\n\n" +
        "**PVC (Polyvinyl Chloride)**\n" +
        "- Releases hydrogen chloride (HCl) and phosgene (COCl2) when laser cut\n" +
        "- Phosgene is a lung poison (used as a chemical weapon in WWI)\n" +
        "- Result: Respiratory emergency, hospitalization likely\n" +
        "- Common sources: Vinyl sheets, flexible plastic sheeting, some plastic piping\n\n" +
        "**Vinyl (Any type)**\n" +
        "- Same chemistry as PVC—releases HCl and phosgene\n" +
        "- Vinyl decals, vinyl signs, vinyl film, vinyl adhesive: all prohibited\n" +
        "- Zero exceptions. If someone says 'vinyl is OK for laser cutting,' they are wrong.\n\n" +
        "**Faux Leather**\n" +
        "- Often made with PVC or vinyl backing\n" +
        "- Releases the same toxic gases\n" +
        "- Prohibited.\n\n" +
        "**Fiberglass or Carbon Fiber Composite**\n" +
        "- Laser burning releases fine fibers and potentially toxic resins\n" +
        "- Also conductive—can cause electrical hazards with some laser tube setups\n" +
        "- Prohibited.\n\n" +
        "**GENERALLY SAFE (with extraction)**\n\n" +
        "- **Acrylic (PMMA):** Clear or colored. Safe to cut. Some odor, extraction recommended.\n" +
        "- **Wood:** Any non-treated wood. Plywood is OK if the glue is not phenol-based (ask your teacher). Produces smoke, extraction required.\n" +
        "- **Leather (natural):** Tanned leather is safe. Produces smell, extraction recommended.\n" +
        "- **Paper/cardboard:** Safe. No extraction needed but smoke is produced.\n" +
        "- **Cotton/natural fabrics:** Safe. Light smoke.\n" +
        "- **Rubber (natural):** Safe, some odor.\n\n" +
        "**RESTRICTED (Ask your teacher first)**\n\n" +
        "- **Polycarbonate:** Can be cut but hazard is significant. Teacher's decision case-by-case.\n" +
        "- **ABS plastic:** Produces irritating fumes. Restricted or prohibited depending on extraction.\n" +
        "- **Treated wood:** If stained, painted, or sealed, the finish may release toxic fumes. Safer to avoid.\n" +
        "- **Any material you're unsure about:** Do not guess. Ask first.\n\n" +
        "**HOW TO IDENTIFY MATERIAL**\n" +
        "- Check the supplier label\n" +
        "- Ask where the material came from (home improvement store = likely has coatings; supply company = more transparent about composition)\n" +
        "- If unmarked or unknown: Do not cut. Find a different material or ask your teacher to identify it.",
      tips: [
        "If you see vinyl or PVC in the workshop, it's safe to handle—it's only dangerous when laser cut",
        "The restriction is specific to laser cutting—these materials are fine for other design work",
        "When selecting materials for your design, pick from the safe list first",
        "Some students think 'just a little bit' of PVC is OK—it's not. Absolutely zero PVC.",
      ],
      warning:
        "PVC and vinyl in a laser cutter is a chemical weapon scenario. The toxicity is not exaggerated. If someone tries to cut these materials, you have the right and responsibility to stop them and alert your teacher.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Check Material Knowledge
    // ========================================================================
    {
      type: "comprehension_check",
      id: "laser-materials-check-01",
      question: "Your friend wants to laser cut a decorative plastic sheet they found in the storage closet. They don't know what it is. What do you do?",
      options: [
        "Encourage them to go ahead—unknown materials are probably fine",
        "Tell them to ask the teacher to identify the material before cutting",
        "Suggest they laser cut a small test piece first to see if it's safe",
        "Help them cut it since you'll be there to watch",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Unknown materials are an unknown hazard. PVC and vinyl can kill via gas inhalation. The teacher can identify the material safely. Zero guessing on laser cutters.",
      feedback_wrong:
        "Not quite. Unknown materials are a serious hazard—they could be PVC or vinyl, which release toxic gas when cut. Never guess. The teacher has the knowledge and tools to identify it safely.",
      hint: "What could be the worst-case scenario with an unknown material?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 5: Never Leave Unattended
    // ========================================================================
    {
      type: "key_concept",
      id: "laser-unattended-01",
      title: "NEVER Leave a Laser Cutter Unattended During Operation",
      icon: "⛔",
      content:
        "This is the most important rule. If the laser is operating, you must be present and watching, 100% of the time. No exceptions.\n\n" +
        "**WHY THIS IS ABSOLUTE**\n" +
        "- **Fire risk:** A material can catch fire during cutting. If you're not there, the fire grows unchecked. In a closed space, fire can spread rapidly.\n" +
        "- **Mechanical failures:** The laser head can jam, the material can shift, or unexpected chemistry can happen. You need to react in seconds.\n" +
        "- **Extraction failure:** If extraction stops working mid-cut, fumes accumulate. You need to notice and stop the machine.\n" +
        "- **Emergency response:** If something goes wrong, you're the first responder. Distance delays response by seconds, which can be critical.\n\n" +
        "**WHAT 'UNATTENDED' MEANS**\n" +
        "- Stepping out of the room while the machine is running: Unattended.\n" +
        "- Looking at your phone while the laser operates: Not fully attending, but technically present. Better than leaving, but still risky.\n" +
        "- Starting a job and letting it run while you clean up nearby: This is a grey area. If you can reach the emergency stop in <1 second and have clear line of sight to the cutter, it's acceptable. If not, stay directly in front of the machine.\n" +
        "- Long jobs (>5 minutes): Stay the full duration. Watching a 30-minute cut is boring, but it's your job as the machine operator.\n\n" +
        "**EMERGENCY STOP LOCATION**\n" +
        "Know where it is before you press start. It should be a large red button or lever that you can hit with your fist without looking (muscle memory). In an emergency, you should be able to stop the machine in <1 second.\n\n" +
        "**IF SOMETHING GOES WRONG**\n" +
        "1. **Press emergency stop immediately**\n" +
        "2. **If there's a fire:** Use the fire extinguisher (usually CO2 or dry powder, available near the machine). Aim at the base of the flame, sweep side to side.\n" +
        "3. **If there's heavy smoke:** Turn on extraction at full power, open doors/windows for fresh air. If you feel lightheaded, leave the area.\n" +
        "4. **Alert your teacher** immediately if anything unusual happens.\n" +
        "5. **Do not restart the machine** until the teacher has cleared you to do so.",
      tips: [
        "Tell your friends/classmates to NOT distract you during a laser cut job. Staying focused is part of the responsibility.",
        "If a job is long and boring, bring something to do nearby that doesn't distract (book, notes, sit-ups) but keeps you alert.",
        "Group your cuts together to minimize the time you spend waiting—plan better to reduce boredom.",
        "If a machine starts making unusual sounds or smells, that's your cue to hit emergency stop.",
      ],
      warning:
        "A laser cutter fire or fume release is an emergency that requires immediate human response. Leaving it unattended violates the trust placed in you to use professional equipment. One incident could close the workshop for weeks.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Extraction & Ventilation
    // ========================================================================
    {
      type: "key_concept",
      id: "laser-extraction-01",
      title: "Extraction & Ventilation: You Must Verify It's Working",
      icon: "💨",
      content:
        "Extraction (fume removal) is the primary defense against laser cutting hazards. You cannot assume it's working—you must verify.\n\n" +
        "**EXTRACTION SYSTEM TYPES**\n" +
        "- **Ducted to outside:** Air is pulled out of the cutter and exhausted outside the building. Most effective.\n" +
        "- **Ducted to filter unit:** Air is pulled through a filter and recirculated into the room. Less effective but acceptable.\n" +
        "- **None:** If there's no extraction, you cannot safely laser cut in an enclosed space.\n\n" +
        "**PRE-JOB EXTRACTION CHECK**\n" +
        "Before submitting your file to cut:\n" +
        "1. **Turn on the extraction system** (usually a switch near the machine)\n" +
        "2. **Wait 5-10 seconds** for airflow to establish\n" +
        "3. **Test airflow** by holding a piece of tissue near the extraction inlet—it should be pulled toward the inlet\n" +
        "4. **Listen:** You should hear the extraction fan running (a low hum/whoosh sound)\n" +
        "5. **Watch the cutter:** When you start a test cut, smoke should be pulled out, not accumulating in the chamber\n\n" +
        "**EXTRACTION FAILURE SIGNS**\n" +
        "- No airflow from inlet (tissue doesn't get pulled)\n" +
        "- Smoke accumulating in the cutter chamber\n" +
        "- Strong smell of burning material (beyond normal cut smell)\n" +
        "- Filter light (if present) showing clogging\n" +
        "- Extraction fan not running despite being switched on\n\n" +
        "**IF EXTRACTION FAILS**\n" +
        "- **Stop the machine immediately** (hit emergency stop or power button)\n" +
        "- **Open windows/doors** to ventilate the room\n" +
        "- **Do not attempt to restart** without teacher approval\n" +
        "- **Alert your teacher** — extraction failure is a maintenance issue\n" +
        "- **Wait for repair/replacement** before cutting again\n\n" +
        "**FILTER MAINTENANCE**\n" +
        "If the machine has a filter (not external ducting):\n" +
        "- **Check filter regularly** (your teacher will tell you when/how)\n" +
        "- **Clogged filters reduce extraction effectiveness** dramatically\n" +
        "- **Filter replacement is a teacher task** — do not attempt to replace yourself\n" +
        "- **Schedule cuts around filter changes** if possible\n\n" +
        "**LONG-TERM WORKSHOP SAFETY**\n" +
        "If extraction consistently fails in your workshop:\n" +
        "- Speak up. Tell your teacher.\n" +
        "- Inadequate extraction means the workshop is not safe for laser cutting.\n" +
        "- Your safety is not negotiable. If extraction is broken, laser cutting stops until it's fixed.",
      tips: [
        "The tissue test for airflow is fast and reliable—do it every time",
        "Extraction isn't optional—it's as critical as not leaving the machine unattended",
        "If you suspect extraction isn't working, trust your gut and ask your teacher",
        "A small maintenance issue today prevents a big health incident later",
      ],
      warning:
        "Inadequate extraction turns laser cutting into a health hazard. Chronic exposure to laser fumes (even 'safe' materials) can cause respiratory problems. Speak up if extraction seems inadequate.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: File Preparation & Machine Settings
    // ========================================================================
    {
      type: "step_by_step",
      id: "laser-file-prep-01",
      title: "Preparing a File for Laser Cutting",
      steps: [
        {
          number: 1,
          instruction:
            "**USE THE CORRECT FORMAT:** Most laser cutters accept PDF or DXF. Check with your teacher which format to use. Avoid formats like JPEG or PNG (raster images)—they don't translate well to laser commands.",
          checkpoint:
            "File is saved in the correct format (PDF or DXF), not a raster format.",
        },
        {
          number: 2,
          instruction:
            "**DO NOT GROUP OBJECTS:** Some laser software doesn't handle grouped objects well. If your design is grouped, ungroup everything before exporting. All objects should be separate, ungrouped elements.",
          warning:
            "Grouped objects can cause the software to misinterpret the design, leading to incorrect cuts or crashes.",
        },
        {
          number: 3,
          instruction:
            "**USE CORRECT LINE COLORS:** Your laser software likely uses line colors to differentiate between cut and engrave:\n- **Red = cut** (laser cuts all the way through)\n- **Blue/black = engrave** (laser marks the surface without cutting)\n- Check your school's standard before submitting. Ask if unsure.",
          checkpoint: "All lines are the correct color for your intended action (cut vs engrave).",
        },
        {
          number: 4,
          instruction:
            "**SET SPEED AND POWER PARAMETERS:** Your design file should include speed (how fast the laser head moves) and power (laser intensity) settings. Your teacher will provide these for your material:\n- Acrylic cutting: Speed 70%, Power 100%\n- Wood cutting: Speed 50%, Power 100%\n- Engraving: Speed 100%, Power 30% (example—varies by material)\n\nWrong settings = poor cut quality or fire hazard.",
          image: "/images/safety/laser-settings.png",
        },
        {
          number: 5,
          instruction:
            "**OFFSET FOR LASER KERF:** The laser beam has width (~0.1mm). This 'kerf' removes material. If you need precision, offset your design inward by the kerf amount. Your teacher will explain this if it matters for your design.",
          checkpoint:
            "Design is offset if precision requires it, or teacher confirmed offset isn't needed.",
        },
        {
          number: 6,
          instruction:
            "**VERIFY MATERIAL & QUANTITY:** Before submitting:\n- Confirm the material is on the 'safe to cut' list\n- Confirm you have enough material for the design\n- Confirm the material fits in the machine bed (ask your teacher the max size)\n- Check for coatings/finishes that might produce toxic fumes",
          checkpoint:
            "Material is confirmed safe, quantity is adequate, material fits in the machine.",
        },
        {
          number: 7,
          instruction:
            "**SUBMIT TO YOUR TEACHER:** Do not just start the job yourself. Your teacher will:\n- Verify the file and settings\n- Confirm the material is correct\n- Place the material in the machine\n- Run the job and supervise\n\nThis is a safety gate. Respect it.",
          checkpoint:
            "Teacher has reviewed the file and material. You are cleared to proceed.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 8: Before/After - Unattended vs Attended
    // ========================================================================
    {
      type: "before_after",
      id: "laser-attended-ba-01",
      title: "Laser Cutter Operation: Unattended (NOT SAFE) vs Attended (SAFE)",
      before: {
        caption: "NOT SAFE: Unattended laser cutter operation",
        hazards: [
          "Student has left the room—no one watching the machine",
          "No one can see emergency stop button",
          "If fire starts, no one notices until it's too late",
          "If extraction fails, smoke accumulates with no one to respond",
          "Material jam or mechanical issue goes undetected",
          "Job could be running for 30+ minutes unobserved",
        ],
        image: "/images/safety/laser-unattended.png",
      },
      after: {
        caption: "SAFE: Student attends to the laser cutter for the entire job",
        principles: [
          "Student is in the room, watching the machine the entire time",
          "Student can see the cutting progress through the window",
          "Student can reach emergency stop in <1 second",
          "Student monitors extraction (checks for smoke accumulation)",
          "Any unusual behavior is caught immediately",
          "Fire, fume release, or mechanical jam is detected in first seconds",
        ],
        image: "/images/safety/laser-attended.png",
      },
      key_difference:
        "Attending to the machine for a boring 30-minute job is the price of using professional equipment. This is non-negotiable.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 9: Scenario - Material Question
    // ========================================================================
    {
      type: "scenario",
      id: "laser-scenario-01",
      title: "Unknown Material Identification",
      setup:
        "You're preparing a design for laser cutting. You found a plastic sheet in the storage closet that would be perfect for your project. It's unmarked, but it looks like a clear plastic. You want to laser cut it. Your teacher isn't immediately available. What do you do?",
      branches: [
        {
          id: "material-scenario-wrong-1",
          choice_text: "Go ahead and cut it—it's probably acrylic since it looks clear",
          is_correct: false,
          feedback:
            "❌ Clear PVC is visually identical to acrylic. You can't identify it by appearance. This assumption could result in HCl gas release.",
          consequence:
            "If it's PVC, you release lung poison. Health emergency and workshop evacuation.",
        },
        {
          id: "material-scenario-wrong-2",
          choice_text: "Cut a test piece first to see if it produces fumes",
          is_correct: false,
          feedback:
            "❌ Test cutting an unknown material is exactly how incidents happen. If it's PVC, you've just released toxic gas and confirmed it the hard way. Never test unknown materials.",
          consequence:
            "If it's PVC, you get exposed to HCl gas during the 'test.' Risk of acute respiratory distress.",
        },
        {
          id: "material-scenario-correct",
          choice_text: "Wait for your teacher to identify the material, or find a different material you know is safe",
          is_correct: true,
          feedback:
            "✓ Correct! Unknown materials are an unknown hazard. Your teacher can identify it using chemical tests or by checking the source. If it takes too long, use a material from the 'known safe' bin.",
          consequence:
            "Material is confirmed safe before cutting. Zero risk of toxic gas exposure.",
        },
        {
          id: "material-scenario-wrong-3",
          choice_text: "Check the storage closet shelf—if it's there, it must be safe for laser cutting",
          is_correct: false,
          feedback:
            "❌ Storage closet organization is not a safety system. The sheet could have been donated, salvaged, or misplaced. Location ≠ verification.",
          consequence:
            "False confidence leads to cutting a potentially dangerous material.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 10: Scenario - Smoke During Cutting
    // ========================================================================
    {
      type: "scenario",
      id: "laser-scenario-02",
      title: "Detecting Problems During Laser Cutting",
      setup:
        "You've started a 15-minute laser cut on acrylic. About 1 minute in, you notice something is wrong. Smoke is accumulating in the cutter chamber instead of being pulled out by extraction. You can see the smoke level rising. What's your first action?",
      branches: [
        {
          id: "smoke-scenario-wrong-1",
          choice_text: "Let the cut finish—it's only 14 minutes left, and smoke isn't a fire hazard with acrylic",
          is_correct: false,
          feedback:
            "❌ Accumulating smoke means extraction has failed. Continued cutting produces more smoke. Even acrylic smoke is an inhalation hazard if it accumulates. Stop immediately.",
          consequence:
            "You inhale high levels of acrylic smoke, causing throat irritation and coughing. Extraction failure is confirmed too late to prevent exposure.",
        },
        {
          id: "smoke-scenario-correct",
          choice_text: "Press emergency stop immediately, check extraction, and alert your teacher before restarting",
          is_correct: true,
          feedback:
            "✓ Correct! Accumulating smoke = extraction failure. Stop the machine immediately. Check if the extraction switch is on, if the filter is clogged, or if there's a blockage. Alert your teacher to diagnose the issue.",
          consequence:
            "Machine stops before more smoke builds up. Issue is identified. You're protected. The teacher can fix the problem.",
        },
        {
          id: "smoke-scenario-wrong-2",
          choice_text: "Open the cutter lid to release the smoke",
          is_correct: false,
          feedback:
            "❌ Opening the lid while the laser is operating exposes the laser beam (eye hazard). Also, manual smoke release doesn't fix the underlying extraction problem. Never open the lid during operation.",
          consequence:
            "Risk of laser beam exposure. Smoke problem persists. Two hazards instead of one.",
        },
        {
          id: "smoke-scenario-wrong-3",
          choice_text: "Turn extraction on (if it's off) and continue the cut",
          is_correct: false,
          feedback:
            "❌ If extraction is off, turning it on might help. But if it's already on and smoke is accumulating, turning it higher won't fix it—the system is failing. Stop the machine and investigate.",
          consequence:
            "If extraction is blocked, turning it higher won't help. Continued cutting produces more smoke and worsens the problem.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 11: Check Understanding - Never Leave Unattended
    // ========================================================================
    {
      type: "comprehension_check",
      id: "laser-check-01",
      question:
        "A 20-minute laser cutting job is running. You're bored watching it. Your friend wants to get lunch together. What do you do?",
      options: [
        "Start the job and then go get lunch with your friend—extraction will handle fumes",
        "Tell your friend to grab you something while you stay and watch the machine",
        "Ask your teacher if it's OK to leave—maybe just 5 minutes is fine",
        "Start a different project nearby so you're not 'directly' at the machine but still in the room",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! You stay with the machine the entire job. Yes, it's boring. That's the price of using professional equipment. Your friend can wait or grab you food.",
      feedback_wrong:
        "Not quite. The rule is absolute: never leave a laser cutter unattended while it's operating. No exceptions, no 'just a few minutes,' no 'extraction will handle it.' You stay the entire job.",
      hint: "What could go wrong in a 20-minute job that requires immediate human response?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Check Understanding - Material Safety
    // ========================================================================
    {
      type: "comprehension_check",
      id: "laser-check-02",
      question: "Why is PVC absolutely prohibited in laser cutters?",
      options: [
        "It melts and damages the laser lens",
        "It's too expensive to waste on testing",
        "It releases hydrogen chloride and phosgene gases that are toxic to lungs",
        "It's flammable and will cause a fire",
      ],
      correct_index: 2,
      feedback_correct:
        "✓ Correct! PVC releases hydrogen chloride (HCl) and phosgene when heated—both are respiratory poisons. This is a chemistry fact, not a guideline.",
      feedback_wrong:
        "Not quite. PVC releases toxic gases (hydrogen chloride and phosgene) that cause respiratory poisoning. This is not an equipment issue or cost issue—it's a health hazard issue.",
      hint: "What chemical reaction happens when PVC is heated?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 13: Summary & Quiz Ready
    // ========================================================================
    {
      type: "key_concept",
      id: "laser-summary-01",
      title: "Ready for the Laser Cutter Safety Quiz",
      icon: "✅",
      content:
        "You've learned the critical safety practices for laser cutting:\n\n" +
        "✓ **3 Hazard Types** — Laser beam (eye/skin), fire (enclosed space), fumes (material-specific)\n" +
        "✓ **Material Restrictions** — PVC/vinyl absolutely prohibited, know safe vs restricted materials\n" +
        "✓ **Never Unattended** — You watch the entire job, you know emergency stop location, you can respond in seconds\n" +
        "✓ **Extraction Verification** — Test airflow before every job, stop immediately if extraction fails\n" +
        "✓ **File Preparation** — Correct format, correct line colors, correct speed/power settings, material verification\n" +
        "✓ **Emergency Response** — Emergency stop first, fire extinguisher second, teacher alert third\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Laser Cutter Safety badge.\n\n" +
        "**Remember:** Laser cutters are professional tools that demand professional discipline. Material knowledge, extraction vigilance, and never-unattended operation are non-negotiable. One incident can close a workshop for weeks.",
      tips: [
        "When in doubt about a material, ask your teacher—there's no penalty for caution",
        "Watching a long cut is boring, but staying engaged is the job—bring a book, sketch nearby, stay alert",
        "If something feels wrong (smell, smoke, sound), trust your instinct and stop the machine",
        "Earning this badge means you're trusted with a powerful professional tool—wear that responsibility with pride",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type LaserCutterModuleType = typeof LASER_CUTTER_MODULE;
