/**
 * Electronics & Soldering Safety Learning Module
 *
 * Covers safe soldering practices, flux hazards, solder composition, battery safety,
 * capacitor discharge risks, ESD precautions, and wire/PCB handling.
 *
 * Learning flow:
 * 1. Engage: Real incident story (mishandled lithium battery swelling incident)
 * 2. Inform: Soldering iron hazards, flux/fume extraction, lead-free solder handling
 * 3. Apply: Before/after setups, scenario-based decision making
 * 4. Verify: Step-by-step procedures and comprehension checks
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

export const ELECTRONICS_MODULE: LearningModule = {
  badge_id: "electronics-soldering-safety",
  learning_objectives: [
    "Demonstrate safe soldering iron handling and storage",
    "Explain flux hazards and why fume extraction is required",
    "Identify the differences between lead and lead-free solder and their handling",
    "Describe battery safety, charging hazards, and swelling detection",
    "Explain capacitor discharge hazards and why discharge before handling is mandatory",
    "Understand ESD (electrostatic discharge) risks and grounding procedures",
    "Apply safe wire stripping and PCB handling techniques",
    "Respond correctly to electrical emergencies in the workshop",
  ],
  estimated_minutes: 12,
  blocks: [
    // ========================================================================
    // BLOCK 1: Engage with Battery Incident
    // ========================================================================
    {
      type: "micro_story",
      id: "electronics-story-01",
      title: "The Lithium Battery Incident",
      narrative:
        "Marcus was building a portable LED project using a lithium-ion battery salvaged from an old phone. He didn't check the battery condition before powering on—he just plugged it in to test his circuit.\n\n" +
        "The battery had a small internal defect (a manufacturing flaw). As current flowed, the defect created internal resistance, which generated heat. The battery began to swell.\n\n" +
        "Marcus didn't notice the swelling at first because he was focused on whether the LEDs would light. After 30 seconds, he smelled something hot and chemical. He looked down and saw the battery—it had swollen to twice its normal size.\n\n" +
        "Panicking, he yanked the battery out of the circuit. As he did, a small amount of liquid electrolyte leaked from the battery case—this chemical is corrosive and can cause burns.\n\n" +
        "The battery got too hot to touch. Had he not noticed, it could have vented gas or caught fire (lithium batteries are used in aerospace because they pack so much energy—and that energy can be released violently if the battery fails).\n\n" +
        "Damage: Corrosive liquid burned the skin on his palm (minor burn, but painful), the battery was destroyed, Marcus had to stop work and apply first aid.",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What warning signs did Marcus miss?",
          reveal_answer:
            "Swelling of the battery (visible), chemical smell (olfactory). These are the two primary warning signs that a lithium battery is in distress. He noticed the smell but it was already critical.",
        },
        {
          question: "Why was the salvaged battery risky?",
          reveal_answer:
            "Salvaged batteries can have internal defects from being dropped, aged, or previously short-circuited. Unknown battery history = unknown risk. A new battery from a reputable source with specs is much safer.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "(1) Test batteries in a safe location, away from the face and flammable materials. (2) Use a battery tester to check voltage/capacity first. (3) Don't salvage batteries with unknown history. (4) Use batteries with built-in protection circuits (most modern devices have these).",
        },
      ],
      key_lesson:
        "Lithium batteries store enormous energy in a tiny package. A failed battery is a heat/fire/chemical hazard. Always inspect before use, test in a safe location, and know the battery history.",
      related_rule: "Rule #1: Never use salvaged batteries with unknown history",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 2: Soldering Iron Safety Fundamentals
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-soldering-01",
      title: "Soldering Iron: Handling & Storage Safety",
      icon: "🔥",
      content:
        "A soldering iron tip reaches 300-400°C. That's hot enough to melt metal, and more than hot enough to cause severe burns. Respect the tool.\n\n" +
        "**THE SOLDERING IRON STAND IS ESSENTIAL**\n" +
        "- The iron ALWAYS goes in the stand between joints, never on the bench\n" +
        "- Even a 1-second touch to skin causes a blister. A 5-second touch causes 3rd-degree burns (tissue damage)\n" +
        "- The stand has a damp sponge or brass wool for cleaning the tip\n\n" +
        "**PRE-SOLDERING RITUAL**\n" +
        "Before soldering any joint:\n" +
        "1. **Tin the iron:** Touch solder to the clean tip until it flows (silvery coating). This dramatically improves heat transfer to the joint.\n" +
        "2. **Clean the tip:** Wipe on the damp sponge or brass wool (sponge is fine, brass wool is better). Clean tips transfer heat 2-3× better than dirty tips.\n" +
        "3. **Check the joint is accessible:** Before you bring the hot iron near, make sure you can reach the joint clearly. No awkward angles = less time with the iron near your hands.\n\n" +
        "**DURING SOLDERING**\n" +
        "- **Hold the iron like a pen, not a hammer.** Grip it gently near the top of the handle.\n" +
        "- **Touch the iron to BOTH the pad and the component lead** (not just one), for 2-3 seconds. You're heating the joint, not the iron.\n" +
        "- **Apply solder to the joint, not the iron tip.** The solder should flow onto the hot joint, not melt on the iron and drip off.\n" +
        "- **Remove the solder, then the iron.** Solder first, then iron. Reverse order and the solder remains cold (weak joint).\n" +
        "- **Keep the iron tip clean.** A dirty tip doesn't transfer heat—you'll hold the iron on the joint longer, risking burns.\n\n" +
        "**AVOIDING BURNS**\n" +
        "- Never touch the iron tip. Ever. Not to test it, not by accident.\n" +
        "- Never wave the iron around. Keep it pointed down toward your work.\n" +
        "- Never hold the iron in one hand while picking up components with the other—you're one accident away from burning yourself.\n" +
        "- Wear close-fitting clothing (not loose sleeves that can brush the tip).\n" +
        "- Long hair should be tied back.\n\n" +
        "**ELECTRICAL SAFETY**\n" +
        "- The soldering iron has an electrical cord. Treat it like any mains-powered tool: don't trip on it, don't run it under water, don't use it with wet hands.\n" +
        "- Turn off the iron when you're done. Don't leave it running between projects.",
      tips: [
        "Tinning the iron before each joint is the single best habit you can develop—it speeds up soldering and reduces burn risk",
        "A clean tip makes all the difference. Spend 5 seconds cleaning between joints.",
        "If you feel uncomfortable holding the iron near your hands, ask your teacher to demo the motion first",
        "Burns from soldering irons happen in seconds—never rush, never multitask while soldering",
      ],
      warning:
        "A soldering iron tip is hot enough to burn skin in under 1 second. There is zero margin for error. If you're not confident with the iron, ask your teacher to supervise.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Flux & Fume Extraction
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-flux-01",
      title: "Flux: What It Is & Why Extraction Matters",
      icon: "💨",
      content:
        "Solder doesn't stick to oxidized metal. Flux is a chemical that cleans the joint surface so solder can wet (flow smoothly onto the metal). It's essential for good soldering—but it creates hazards.\n\n" +
        "**WHAT FLUX DOES**\n" +
        "- Dissolves metal oxide on the joint surfaces\n" +
        "- Protects the hot joint from re-oxidizing while solder flows\n" +
        "- Burns off as you heat it, releasing volatile compounds (fumes)\n\n" +
        "**FLUX HAZARDS**\n" +
        "- **Thermal decomposition:** When flux heats, it breaks down and releases volatile organic compounds (VOCs). These irritate lungs and eyes.\n" +
        "- **Flux residue:** After soldering, residue remains on the board. While solid, it's less hazardous, but inhaling dust from old flux residue is still a risk.\n" +
        "- **Acidic fumes:** Some flux types (especially older lead-based solder fluxes) release acidic fumes that are corrosive to respiratory tissue.\n\n" +
        "**EXTRACTION REQUIREMENTS**\n" +
        "- **Fume extraction must run continuously during soldering** — not before, not after, but during (when flux is actively burning)\n" +
        "- **Position the extraction arm 15-30cm from the soldering joint** — this captures fumes before they disperse\n" +
        "- **Run extraction for 30 seconds after you finish soldering** — fumes linger\n" +
        "- **Check extraction is working** — you should feel a slight air pull toward the intake\n" +
        "- **If extraction fails or you smell heavy flux fumes:** STOP soldering immediately, turn on a fan, and alert your teacher\n\n" +
        "**FLUX RESIDUE CLEANUP**\n" +
        "- **No need to remove flux residue** — most modern flux (especially no-clean or rosin flux) is benign once cooled\n" +
        "- **If using water-soluble flux:** Rinse the board with distilled water to remove residue (use a soft brush, not pressure)\n" +
        "- **Don't blow compressed air on flux residue** — this aerosolizes it and turns it into an inhalation hazard\n\n" +
        "**THE SMELL TEST**\n" +
        "Normal soldering flux smell: Pleasant, slightly resinous, reminiscent of pine or burnt sugar.\n" +
        "Abnormal smell: Sharp, acidic, burning, chemical. If you smell this, something is wrong—extraction isn't working, or you're using the wrong flux.",
      tips: [
        "Always run extraction before bringing the iron to the joint",
        "Position the extraction arm to the side of your work, not directly in your breathing zone (that would blow fumes toward your face)",
        "If you don't smell any flux fumes at all, extraction is probably not working—test by waving your hand near the arm to feel airflow",
        "No-clean flux is safer than water-soluble for beginners (less residue cleanup)",
      ],
      warning:
        "Extended exposure to flux fumes (hours per day) can cause chronic respiratory irritation. Using extraction is not optional—it's the primary control for flux hazard.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Solder Types & Lead Safety
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-solder-01",
      title: "Lead & Lead-Free Solder: Know the Difference",
      icon: "⚠️",
      content:
        "Solder is an alloy that melts at lower temperatures than the metals being joined. Traditional solder contains lead; modern solder is often lead-free. They handle differently.\n\n" +
        "**LEAD-BASED SOLDER (Sn63/Pb37)**\n" +
        "- **Composition:** ~63% tin, ~37% lead\n" +
        "- **Melting point:** ~183°C (low)\n" +
        "- **Hazard:** Lead is toxic. Even small amounts can accumulate in the body over time.\n" +
        "- **Inhalation risk:** Solder fumes don't contain lead (lead doesn't vaporize at soldering temps). But lead dust or particles can be inhaled.\n" +
        "- **Ingestion risk:** The main risk is hand contamination → eating → ingestion. Wash hands after soldering.\n" +
        "- **Solder splatter:** Hot lead solder can splash and stick to skin, causing burns.\n" +
        "- **Status:** Being phased out (RoHS compliance). Many professional workspaces ban lead solder.\n\n" +
        "**LEAD-FREE SOLDER (Sn99+)**\n" +
        "- **Composition:** Tin + small amounts of silver and/or copper (no lead)\n" +
        "- **Melting point:** ~220°C (higher than lead-based)\n" +
        "- **Advantage:** No lead toxicity\n" +
        "- **Disadvantage:** Higher melting point = slightly harder to solder, higher iron temperature needed\n" +
        "- **Status:** Industry standard now. Schools typically use lead-free.\n\n" +
        "**SAFETY DIFFERENCES**\n" +
        "- **Temperature:** Lead-free requires a ~40°C hotter iron. Hotter iron = slightly more burn risk if you accidentally touch it.\n" +
        "- **Wetting:** Lead-free solder flows less smoothly (lower \"wettability\"). Requires better joint preparation (clean surfaces, good flux, proper technique).\n" +
        "- **Splatter:** Both types splatter. Lead-free can splatter more because it's stiffer (less flow).\n\n" +
        "**HANDLING EITHER TYPE**\n" +
        "- **Never handle solder excessively** — use it, don't play with it\n" +
        "- **Wash hands thoroughly after soldering** — this removes any solder dust or flux residue\n" +
        "- **Don't eat or drink while soldering** — solder dust on your hands can transfer to food\n" +
        "- **Don't mouth the solder spool** — ancient habit, completely unsafe\n" +
        "- **If using lead-based solder:** Extra caution on hand hygiene. Lead accumulation is insidious (you don't feel it happening).\n\n" +
        "**THE RULE**\n" +
        "Ask your teacher which solder type your school uses. Your school should provide it. Never bring your own solder without asking first.",
      tips: [
        "Assume any solder is lead-based unless your teacher tells you otherwise—wash hands either way",
        "Lead-free solder requires a cleaner joint and better flux. Don't force it—prep carefully",
        "If solder balls form (tiny solder spheres that don't flow), you're either using wrong iron temp or not applying flux correctly",
        "Solder splatter is normal—don't panic if a tiny bit sticks to your hand. Brush it off, don't leave it there",
      ],
      warning:
        "Lead exposure is cumulative and can cause neurological effects (especially in young people). Even lead-free solder requires hand washing after use. Never assume solder is lead-free unless labeled.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Battery Safety
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-battery-01",
      title: "Battery Safety: Inspection, Charging & Handling",
      icon: "🔋",
      content:
        "Batteries store chemical energy. When handled incorrectly, that energy is released as heat, gas, fire, or explosion. Battery safety is non-negotiable.\n\n" +
        "**BATTERY INSPECTION BEFORE USE**\n" +
        "Look for these warning signs:\n" +
        "- **Swelling:** Battery is puffed up, not flat. This means internal pressure is building—the battery is in early failure.\n" +
        "- **Leaking:** Liquid or discoloration around the battery case. Battery electrolyte is corrosive.\n" +
        "- **Damage to case:** Cracks, dents, crushed edges. Damage can expose internal components to short-circuit risk.\n" +
        "- **Unknown age:** A battery that's been sitting for years without use may have internal corrosion and unexpected behavior.\n\n" +
        "**If you see any warning signs: DO NOT USE.** Tell your teacher, and the battery goes into safe disposal.\n\n" +
        "**LITHIUM-ION BATTERIES (phone, tablet, laptop batteries)**\n" +
        "- **Most energetic** — they pack the most energy per gram, which is why they're in phones. That energy can be released catastrophically.\n" +
        "- **Short-circuit hazard:** If the positive and negative terminals touch directly (through metal), current surges, generating extreme heat.\n" +
        "- **Overcharging hazard:** Charging too long or too fast causes internal pressure to build. Some batteries have protection circuits; salvaged batteries may not.\n" +
        "- **Thermal runaway:** If the battery gets hot, it can trigger a chain reaction where the heat causes more chemical reactions, which generate more heat, which causes more reactions. This escalates until the battery vents hot gas or catches fire.\n" +
        "- **Safety procedure:** Use only chargers designed for the battery. Never jury-rig a charger. If charging, do it in a location away from flammable materials, and don't leave it unattended.\n\n" +
        "**ALKALINE BATTERIES (AA, AAA, 9V)**\n" +
        "- **Lower energy density** than lithium-ion, but still hazardous if mishandled\n" +
        "- **Leaking:** Alkaline batteries can leak alkaline electrolyte, which is caustic (burns skin and eyes)\n" +
        "- **Short-circuit:** Less energetic than lithium, but still dangerous. A 9V battery shorted across a metal wire will get hot.\n" +
        "- **Safety procedure:** Don't short batteries. Don't mix old and new batteries in the same device. Don't force a battery in (it may rupture).\n\n" +
        "**CHARGING SETUP**\n" +
        "- **Use the correct charger** — chargers are not interchangeable\n" +
        "- **Charge away from your work area** — batteries sometimes fail while charging\n" +
        "- **Check temperature while charging** — if the battery gets warm (not just slightly warm, but genuinely warm to the touch), STOP charging\n" +
        "- **Don't overcharge** — charge for the time recommended by the manufacturer, not longer\n" +
        "- **Charge in a location away from flammable materials** — in case of thermal runaway\n\n" +
        "**IF A BATTERY STARTS TO FAIL WHILE POWERED**\n" +
        "- **Stop using it immediately** — unplug or disconnect\n" +
        "- **Move it away from people and flammable materials** — place on a non-flammable surface\n" +
        "- **Do not touch it** — it may be hot\n" +
        "- **Alert your teacher** — they have procedures for failed batteries\n" +
        "- **Do not try to disassemble or salvage it** — leave it to the professionals",
      tips: [
        "Lithium-ion batteries are your highest priority for safety vigilance—know their condition before use",
        "If a battery is swollen, replace it. Don't risk it.",
        "Salvaged batteries (from old devices) are risky—use new batteries when possible, especially for final projects",
        "Temperature is a great indicator—a battery getting warm during charging is a warning sign",
      ],
      warning:
        "Thermal runaway in a lithium battery can result in fire or explosion. This is not exaggerated. One failed battery can destroy equipment and injure people nearby. Treat battery safety as seriously as electrical safety.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 6: Capacitors & Discharge
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-capacitor-01",
      title: "Capacitors: Why You Must Discharge Before Handling",
      icon: "⚡",
      content:
        "A capacitor stores electrical charge, even after the power is turned off. That stored charge can zap you, damage components, or trigger unexpected behavior. You must discharge capacitors before handling a powered-off circuit.\n\n" +
        "**WHAT A CAPACITOR IS**\n" +
        "Two metal plates separated by insulation. When powered, charge accumulates on the plates. When you disconnect power, that charge stays trapped.\n" +
        "A large capacitor (like those in power supplies) can store enough charge to cause a painful shock or even damage your heart rhythm if the shock goes across your chest (this is rare but possible).\n\n" +
        "**SAFE DISCHARGE PROCEDURE**\n" +
        "1. **Turn off the power and unplug the device** — this stops new charge from flowing\n" +
        "2. **Locate large capacitors** — they're usually cylindrical, with two leads (or rows of contacts)\n" +
        "3. **Use an insulated screwdriver or discharge tool** — touch both terminals simultaneously with the tool to create a path for discharge\n" +
        "4. **Hold for 2-3 seconds** — this ensures complete discharge\n" +
        "5. **Repeat 2-3 times** — some large capacitors need multiple discharges\n" +
        "6. **Never touch the terminals directly** — always use a tool (screwdriver, clip lead, etc.)\n\n" +
        "**WHY THIS MATTERS**\n" +
        "- **Accidental shorts:** If you're working on the circuit and accidentally bridge two terminals, a charged capacitor will short through your tool (or hand) with a spark\n" +
        "- **Component damage:** Some sensitive components can be destroyed by capacitor discharge. Discharging safely prevents this.\n" +
        "- **Personal safety:** A large capacitor discharge can be painful. Most discharges are minor (like a spark), but larger capacitors can cause a real shock.\n\n" +
        "**ESD (ELECTROSTATIC DISCHARGE) PRECAUTIONS**\n" +
        "Electrostatic discharge is different from capacitor discharge. Static electricity builds up on YOU (especially in dry weather), and when you touch an electronic component, that static discharges through the component, potentially damaging it.\n\n" +
        "- **Wrist strap:** A conductive strap that connects you to ground, draining static as it builds\n" +
        "- **Avoid synthetic clothing** in dry environments (builds more static)\n" +
        "- **Touch a grounded metal object before handling sensitive components** (like integrated circuits)\n" +
        "- **Work on a grounded surface** (some workbenches have conductive mats)\n\n" +
        "**SENSITIVE COMPONENTS**\n" +
        "- Integrated circuits (ICs)\n" +
        "- Microcontrollers\n" +
        "- High-frequency components\n" +
        "- MOSFET transistors\n\n" +
        "For robust components (resistors, basic diodes, larger transistors), ESD is less critical, but it's good practice anyway.",
      tips: [
        "If you see a cylindrical component with leads on a circuit, assume it's a capacitor and discharge it before touching",
        "Discharging is fast (5-10 seconds including all steps). It's worth the time to do it right.",
        "If you're unsure whether a capacitor has discharged fully, discharge it again—no harm",
        "A wrist strap is inexpensive and makes ESD handling foolproof—ask if your school has them",
      ],
      warning:
        "A large capacitor discharge can cause a painful shock or even cardiac rhythm disruption. Never skip capacitor discharge. If you feel a shock, alert your teacher immediately—some shocks can be dangerous.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 7: Wire Stripping & PCB Handling
    // ========================================================================
    {
      type: "step_by_step",
      id: "electronics-wiring-01",
      title: "Safe Wire Stripping & PCB Handling",
      steps: [
        {
          number: 1,
          instruction:
            "**CHOOSE THE RIGHT TOOL:** Use a wire stripper (not a knife). Wire strippers have two holes: one for the wire gauge you're stripping, one for a larger gauge. Start with the smaller hole.",
          checkpoint: "Wire stripper is in hand, wire is visible, you know the wire gauge.",
        },
        {
          number: 2,
          instruction:
            "**POSITION THE WIRE:** Insert the wire into the appropriate hole of the stripper, about 5-10mm of insulation inside. The stripper should grip the insulation, not the bare wire.",
          warning:
            "If the stripper grips bare wire, it will cut into the copper, weakening the wire or causing a short circuit later.",
        },
        {
          number: 3,
          instruction:
            "**STRIP IN ONE MOTION:** Squeeze the stripper handles firmly and pull in one smooth motion along the wire axis. This removes the insulation cleanly.",
          checkpoint:
            "Insulation comes off in one piece. Bare copper is visible and undamaged.",
        },
        {
          number: 4,
          instruction:
            "**CHECK THE RESULT:** Examine the stripped section. Copper should be shiny and intact. If the copper is nicked or the insulation is torn, re-strip from a different point on the wire.",
          image: "/images/safety/wire-stripping.png",
        },
        {
          number: 5,
          instruction:
            "**HANDLING PCB COMPONENTS:** When handling a printed circuit board (PCB), touch only the edges and large flat surfaces. Avoid touching component leads or solder joints.",
          warning:
            "Oils from your fingers can accumulate on components, affecting electrical properties. Solder joints are fragile—touching them can cause them to crack.",
        },
        {
          number: 6,
          instruction:
            "**STORAGE:** Store PCBs flat in an anti-static bag (if you have sensitive components). Never stack PCBs on top of each other without protection—components can break off.",
          checkpoint:
            "PCB is stored safely, flat, protected from dust and vibration.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 8: Before/After - Soldering Station
    // ========================================================================
    {
      type: "before_after",
      id: "electronics-station-ba-01",
      title: "Soldering Station: Wrong vs Right Setup",
      before: {
        caption: "NOT SAFE: Inadequate soldering station setup",
        hazards: [
          "No soldering iron stand—iron resting on bench (burns nearby materials)",
          "Flux extraction not running",
          "Solder spool within reach of iron (solder insulation melts)",
          "No wet sponge visible (dirty tips waste heat, increase burn time)",
          "Loose clothing, dangling sleeves near iron",
          "No clear workspace—clutter",
        ],
        image: "/images/safety/soldering-wrong.png",
      },
      after: {
        caption: "SAFE: Professional soldering station setup",
        principles: [
          "Soldering iron in stand with damp sponge attached",
          "Flux extraction arm positioned 15-30cm from work area",
          "Solder spool positioned safely away from iron heat",
          "Clean, organized workspace with only necessary components visible",
          "Fitted clothing, no loose sleeves or dangly items",
          "Iron tip is tinned and ready to use",
        ],
        image: "/images/safety/soldering-right.png",
      },
      key_difference:
        "A safe soldering station takes 1-2 minutes to set up and prevents burns, electrical hazards, and respiratory exposure. This is the baseline for any soldering work.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 9: Scenario - Capacitor Discharge
    // ========================================================================
    {
      type: "scenario",
      id: "electronics-scenario-01",
      title: "Troubleshooting a Powered Device: Capacitor Safety",
      setup:
        "You're helping troubleshoot a class project—a device that stopped working. Your teacher tells you to unplug it and check the circuit. You unplug the device, but the internal LED still lights up faintly (the capacitor is still charged). You're about to touch the circuit when your teacher stops you. What do they tell you to do?",
      branches: [
        {
          id: "cap-scenario-wrong-1",
          choice_text: "The LED will go away once the capacitor naturally discharges in a few seconds—just wait",
          is_correct: false,
          feedback:
            "❌ Capacitors discharge slowly naturally. The charge can remain for hours or days. You can't rely on natural discharge.",
          consequence:
            "If you touch the circuit during this time, you risk a shock or component damage.",
        },
        {
          id: "cap-scenario-correct",
          choice_text: "Locate the large capacitor, use an insulated screwdriver to discharge it by bridging the terminals, then proceed",
          is_correct: true,
          feedback:
            "✓ Correct! The LED indicates the capacitor still has charge. Actively discharging it with a tool is the safe procedure. Your teacher is protecting you.",
          consequence: "Capacitor is safely discharged. You can now touch the circuit without risk of shock.",
        },
        {
          id: "cap-scenario-wrong-2",
          choice_text: "Touch the two terminals with your bare fingers to discharge it",
          is_correct: false,
          feedback:
            "❌ A capacitor discharge through your body can be painful or dangerous. Always use an insulated tool (screwdriver, clip lead) to discharge, never your bare hands.",
          consequence:
            "Painful shock at best, potentially dangerous shock at worst. Never again.",
        },
        {
          id: "cap-scenario-wrong-3",
          choice_text: "Ignore the LED and touch the circuit—the charge won't hurt you",
          is_correct: false,
          feedback:
            "❌ The charge absolutely can hurt you. Large capacitors can deliver shocks that are painful or even dangerous. Never assume a capacitor is discharged.",
          consequence: "Unnecessary risk of shock and potential injury.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 10: Scenario - Solder Splatter
    // ========================================================================
    {
      type: "scenario",
      id: "electronics-scenario-02",
      title: "Solder Splatter During Joint: Staying Safe",
      setup:
        "You're soldering a joint on a prototype. As you apply solder, a tiny droplet splatters out and lands on your forearm. It's hot and sticks for a moment, then cools. You don't think it's a big deal. What should you do?",
      branches: [
        {
          id: "splatter-scenario-wrong-1",
          choice_text: "Immediately brush it off and keep soldering—it's just a tiny drop",
          is_correct: false,
          feedback:
            "❌ Solder droplets cool quickly (within seconds) but can cause a blister or minor burn. More importantly, you're continuing to solder, which means you're not checking for other damage or signs of problems.",
          consequence:
            "Minor burn that could have been prevented with awareness, plus you're distracted from soldering quality.",
        },
        {
          id: "splatter-scenario-correct",
          choice_text: "Stop soldering temporarily, brush off the solder droplet, rinse with cool water if needed, then continue",
          is_correct: true,
          feedback:
            "✓ Correct! A few seconds break is worth checking for injuries and giving your hands a moment of rest. This is mindful soldering—it's safe and actually improves quality.",
          consequence:
            "Minor burn is immediately cooled (reducing blister risk), you're alert and ready to solder better joints.",
        },
        {
          id: "splatter-scenario-wrong-2",
          choice_text: "Grab a cloth and wipe the spot immediately—don't let it cool on your skin",
          is_correct: false,
          feedback:
            "❌ Wiping immediately might rub the hot solder deeper into your skin or spread it. Let it cool, then gently brush it off. Cool water is safer than friction.",
          consequence: "Higher burn risk from the wiping action.",
        },
        {
          id: "splatter-scenario-wrong-3",
          choice_text: "Ignore it—solder splatter is just part of soldering",
          is_correct: false,
          feedback:
            "❌ While splatter is normal, ignoring minor injuries is how they escalate. A small blister today can become infected later. Awareness of your body is critical in safety culture.",
          consequence: "Minor injury that could have been prevented.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 11: Check Understanding - Flux Extraction
    // ========================================================================
    {
      type: "comprehension_check",
      id: "electronics-check-01",
      question: "When should the flux extraction system be running during soldering?",
      options: [
        "Only after soldering is complete, to clear fumes",
        "Continuously during soldering",
        "Only if you smell flux fumes",
        "Before and after, but it can be off during soldering",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Flux extraction must run continuously while you're soldering because flux releases fumes as it heats. Stopping extraction during soldering defeats the purpose.",
      feedback_wrong:
        "Not quite. Flux extraction must run continuously during soldering because flux releases fumes as it burns. You can't rely on smell—by the time you notice fumes, you've already inhaled them.",
      hint: "When does flux burn and release fumes?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 12: Summary & Quiz Ready
    // ========================================================================
    {
      type: "key_concept",
      id: "electronics-summary-01",
      title: "Ready for the Electronics & Soldering Safety Quiz",
      icon: "✅",
      content:
        "You've learned how to work safely with soldering equipment, batteries, capacitors, and electronics:\n\n" +
        "✓ **Soldering Iron Handling** — Stand always, proper grip, tinning, cleaning, never touch tip\n" +
        "✓ **Flux & Extraction** — Extraction running during soldering, proper arm positioning, recognizing working vs failed extraction\n" +
        "✓ **Solder Safety** — Know your solder type (lead vs lead-free), hand washing, never mouth it\n" +
        "✓ **Battery Safety** — Inspect before use, swelling = disposal, proper charging setup, thermal runaway recognition\n" +
        "✓ **Capacitor Discharge** — Always discharge before handling, use tools not hands, discharge thoroughly\n" +
        "✓ **Wire & PCB Handling** — Proper wire strippers, avoid damaging copper, touch only edges of PCBs\n" +
        "✓ **Electrical Hazards** — Respect the energy stored in batteries and capacitors, never take shortcuts\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Electronics & Soldering Safety badge.\n\n" +
        "**Remember:** Soldering is a precise, delicate skill. Safety and quality go hand-in-hand. Every rule you've learned exists because someone learned it the hard way.",
      tips: [
        "Soldering quality improves dramatically when you slow down and follow the steps—speed and safety move in the same direction",
        "If anything is unclear (iron temperature, solder type, extraction setup), ask before you start",
        "Earning this badge means you're trusted to work with soldering equipment independently",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type ElectronicsModuleType = typeof ELECTRONICS_MODULE;
