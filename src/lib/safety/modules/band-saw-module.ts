/**
 * Band Saw Safety Learning Module
 *
 * Covers blade hazards, blade guard setup, push stick usage, feed direction,
 * curved vs straight cuts, blade breakage response, and pre-use machine checks.
 *
 * Learning flow:
 * 1. Engage: Real incident story (blade breakage and finger laceration)
 * 2. Inform: Blade hazards, guard setup, push stick technique, feed direction
 * 3. Apply: Before/after setups, scenario decision-making
 * 4. Verify: Step-by-step procedures and comprehension checks
 *
 * Total estimated time: 11 minutes
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

export const BAND_SAW_MODULE: LearningModule = {
  badge_id: "band-saw-safety",
  learning_objectives: [
    "Describe proper blade guard positioning (1/4 inch above material)",
    "Explain the correct feed direction and why it matters",
    "Demonstrate safe use of a push stick for narrow material",
    "Apply proper hand positioning to avoid contact with moving blade",
    "Identify the difference between safe and unsafe blade tension",
    "Respond correctly to a blade breakage emergency",
    "Perform pre-use machine checks before operating a band saw",
    "Explain when curved cuts vs straight cuts are safe",
  ],
  estimated_minutes: 11,
  blocks: [
    // ========================================================================
    // BLOCK 1: Engage with Blade Breakage Incident
    // ========================================================================
    {
      type: "micro_story",
      id: "band-saw-story-01",
      title: "The Blade Breakage Incident",
      narrative:
        "A student was using the band saw to cut curves in wood. The blade guard was positioned too low (nearly touching the material), and the student had their right hand on the feed side and left hand on the support side, both close to the blade.\n\n" +
        "The blade had developed a stress crack (from hitting a knot in the wood earlier—the student didn't notice and continued cutting). As the blade continued to cycle, the crack propagated.\n\n" +
        "Suddenly, the blade snapped. When a band saw blade breaks under tension, it releases like a spring—the two broken ends snap away from each other at high speed. One end snapped toward the student's left hand.\n\n" +
        "The broken blade segment struck the student's left hand, leaving a deep laceration (cut) across the back of the hand. Tendons in the hand were partially severed. Blood was everywhere.\n\n" +
        "The student panicked, pulled their hand away, and stumbled backward. The teacher rushed over, applied pressure with a towel, and called an ambulance.\n\n" +
        "Result: 47 stitches, surgical repair of tendons (3-hour operation), 6 weeks of recovery, permanent loss of some grip strength in the left hand. Surgery cost $15,000 (covered by school insurance, but the student's family had to deal with the aftermath).",
      is_real_incident: true,
      analysis_prompts: [
        {
          question: "What was the root cause of the laceration?",
          reveal_answer:
            "Blade breakage combined with hands too close to the blade. The break itself was caused by a pre-existing stress crack that the student didn't notice. Had the student seen the crack, they would have stopped and informed the teacher.",
        },
        {
          question: "What multiple safety violations happened?",
          reveal_answer:
            "(1) Blade guard positioned too low, reducing the protective zone. (2) Both hands in the danger zone (near the blade). (3) No push stick used for narrow material (unclear if the material was truly narrow, but hand proximity was excessive). (4) Student didn't notice the blade crack indicating potential failure.",
        },
        {
          question: "How could this have been prevented?",
          reveal_answer:
            "(1) Proper blade guard setup (1/4 inch above material). (2) Hands positioned correctly (right hand feeding, left hand supporting from the side, not directly in line with the blade). (3) Regular blade inspection before use (catch cracks early). (4) Push stick for narrow material. (5) Immediate stop if anything unusual happens (strange sounds, resistance changes).",
        },
      ],
      key_lesson:
        "A band saw blade moves with tremendous force. When it breaks, that force is released suddenly. Proper guard positioning and hand placement are your only defenses. Blade inspection catches problems before catastrophic failure.",
      related_rule: "Rule #1: Blade guard is always 1/4 inch above the material. Hands are never in the blade's direct path.",
    } as MicroStoryBlock,

    // ========================================================================
    // BLOCK 2: Blade Hazards & Guard Setup
    // ========================================================================
    {
      type: "key_concept",
      id: "band-saw-hazards-01",
      title: "Band Saw Hazards: Blade & Guard Setup",
      icon: "⚠️",
      content:
        "A band saw has a continuously moving blade that travels at 50-100 mph depending on the wheel size. Contact with this blade causes severe lacerations in milliseconds.\n\n" +
        "**THE BLADE**\n" +
        "- **Speed:** A 12-inch band saw typically moves the blade at 50-80 mph. A 14-inch saw reaches 100+ mph.\n" +
        "- **Contact duration:** If your hand contacts the blade, the duration is measured in milliseconds. The blade doesn't \"pause\" or slow down—it cuts continuously.\n" +
        "- **Wound type:** A band saw creates a laceration (clean cut) rather than a crushing wound. This sounds less bad, but lacerations can sever tendons and nerves, affecting long-term hand function.\n" +
        "- **Blade thickness:** Thin blades (1/8 inch) for curves cause narrow lacerations. Wide blades (1 inch) for straight cuts cause wider lacerations. Both are serious.\n\n" +
        "**BLADE GUARD POSITIONING**\n" +
        "The guard is a metal or plastic shield that prevents your hands from contacting the blade.\n\n" +
        "- **Standard rule:** Guard positioned **1/4 inch above the top surface of the material**\n" +
        "- **Why 1/4 inch?** This is the thinnest clearance that allows the material to feed smoothly while preventing accidental contact. Too high (2+ inches) = easy for hands to reach the blade. Too low = material catches and jams.\n" +
        "- **Guard adjustment:** Before every job, measure and adjust the guard. It's a 10-second task that prevents injuries.\n" +
        "- **Support side vs feed side:** The guard covers the top. Your left hand (non-dominant, supporting the material) should stay away from the blade on the support side. Your right hand (dominant, feeding the material) should keep the material moving straight.\n\n" +
        "**BLADE TENSION & CONDITION**\n" +
        "- **Proper tension:** The blade should be tight enough that it doesn't deflect sideways when you push against it. Too loose = the blade wanders and produces wavy cuts. Too tight = the blade stretches and fails prematurely.\n" +
        "- **Visual inspection:** Check the blade for:\n" +
        "  - **Cracks:** Any visible cracks mean the blade is on the verge of breaking. Replace immediately. Do not continue cutting.\n" +
        "  - **Kinks:** Bent sections in the blade indicate previous jam or stress. These are stress concentrations—the blade will fail at the kink. Replace.\n" +
        "  - **Rust:** Rust weakens the blade. Rusty blades fail unpredictably. Replace.\n" +
        "  - **Dull edge:** A dull blade requires more force to cut, increasing jam risk. Dull blades also heat up and can warp. Replace or sharpen.\n" +
        "- **Test:** Gently push against the blade with your finger (while the saw is OFF). You should feel resistance but the blade should not be rock-hard.\n\n" +
        "**MACHINE CHECKS BEFORE OPERATION**\n" +
        "Before you start using the band saw:\n" +
        "1. **Check blade for cracks, kinks, or rust** — if found, report to your teacher (do not use)\n" +
        "2. **Adjust guard to 1/4 inch above material** — measure with your fingers if a ruler isn't handy\n" +
        "3. **Check blade alignment** — the blade should track straight on both wheels. Misaligned blades wander.\n" +
        "4. **Check tension** — gentle push against the blade should meet firm resistance\n" +
        "5. **Verify power switch is OFF** — no exceptions\n" +
        "6. **Clear the area around the saw** — no clutter, no loose materials\n" +
        "7. **Have a push stick ready** — within arm's reach before you start",
      tips: [
        "The 1/4 inch guard rule is not a suggestion—it's a tested safety standard",
        "Blade cracks are invisible at normal viewing distance. Inspect the blade up close, running your hand along it slowly (while OFF).",
        "If your guard keeps slipping out of adjustment, report it—the mechanism might be damaged",
        "New blades feel different (sharper, faster cutting)—adjust your feed speed slightly when you change blades",
      ],
      warning:
        "A band saw blade laceration severs tendons and nerves. Recovery requires surgery, weeks of rehabilitation, and permanent loss of some hand function is possible. Proper guard setup and hand positioning are non-negotiable.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 3: Feed Direction & Hand Positioning
    // ========================================================================
    {
      type: "key_concept",
      id: "band-saw-feed-01",
      title: "Feed Direction: Straight Cuts vs Curved Cuts",
      icon: "↗️",
      content:
        "How you feed material into the blade determines whether the cut is clean, wavy, or dangerous.\n\n" +
        "**FEED DIRECTION (STRAIGHT CUTS)**\n" +
        "For straight cuts across wood or up the length:\n" +
        "- **Direction:** Push the material toward the blade in a straight line\n" +
        "- **Hand position:** Right hand feeds (pushes), left hand supports from the side (not directly behind the material)\n" +
        "- **Speed:** Steady, even pressure. Don't force the material into the blade—let the blade do the work.\n" +
        "- **No twisting:** Keep the material oriented the same way the whole cut. Twisting causes the blade to bind and can cause the material to kick back.\n\n" +
        "**CURVED CUTS**\n" +
        "For curved cuts, you rotate the material as you feed it:\n" +
        "- **Both hands guide the curve:** Right hand feeds, left hand rotates the material smoothly into the curve\n" +
        "- **Hand safety:** On tight curves, hands get very close to the blade. This is where many curved-cut injuries happen.\n" +
        "- **Finger safety:** Keep your fingers on the outside of the curve, away from the blade path. Never put fingers on the inside of the curve—the blade is there.\n" +
        "- **Blade size matters:** Tight radius curves need thin blades (1/8 inch). Wider blades can't turn sharp corners—trying to force a tight curve with a wide blade causes the blade to jam.\n\n" +
        "**WHAT NOT TO DO**\n" +
        "- **Never reach over the blade:** If you need to adjust something on the far side, first stop the saw and wait for the blade to stop.\n" +
        "- **Never feed from the wrong end:** Always feed so the material is pushed toward the blade, not away. Feeding the wrong direction can cause kickback.\n" +
        "- **Never make sharp turns with a straight blade:** Wide blades can't turn sharply. Either use a narrower blade or make wider curves.\n" +
        "- **Never push so hard the material binds:** If you feel resistance, STOP. The blade is binding and may break. Back off and re-feed more gently.\n\n" +
        "**HAND SAFETY DURING CURVES**\n" +
        "Curved cuts are where the blade is closest to your hands. Rules:\n" +
        "- Keep thumbs away from the guide—they don't need to be there and can get pinched\n" +
        "- Use fingertips to guide the material, not your palm\n" +
        "- Never reach across the blade to adjust the material on the far side\n" +
        "- If your fingers get within 2 inches of the blade, you're too close—adjust your technique",
      tips: [
        "Practice on scrap material first to get a feel for the feed speed and hand positioning",
        "Straight cuts are safer than curves because hands can stay farther from the blade—do these first if learning",
        "Tight curves require thin blades and extra caution—ask your teacher if you're unsure whether your blade can handle the radius",
        "If the material binds, STOP the saw immediately—don't try to push through",
      ],
      warning:
        "Curved cuts bring hands dangerously close to the blade. Even a slight slip can cause a laceration. Extra vigilance is required.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 4: Push Stick Usage
    // ========================================================================
    {
      type: "key_concept",
      id: "band-saw-push-stick-01",
      title: "Push Stick: When & How to Use It",
      icon: "🌳",
      content:
        "A push stick keeps your hands away from the blade when feeding narrow material. It's a simple tool with enormous impact on safety.\n\n" +
        "**WHAT IS A PUSH STICK?**\n" +
        "A flat piece of wood or plastic (usually pine or hardboard), roughly 12 inches long and 2 inches wide, with a handle at one end and a notch at the working end.\n\n" +
        "**WHEN TO USE**\n" +
        "- **Narrow material:** Anything narrower than 2 inches (your hand width)\n" +
        "- **Long, thin pieces:** Even if wider than 2 inches, long thin pieces can tip—a push stick helps control them\n" +
        "- **Curves on small pieces:** When guiding a small curved cut, a push stick keeps your hands clear\n" +
        "- **Ripping (lengthwise cutting) on narrow stock:** Standard for woodworking safety\n\n" +
        "**HOW TO USE**\n" +
        "1. **Hold the push stick in your non-dominant hand** (right hand for left-handed people, left hand for right-handed)\n" +
        "2. **Feed the material with your dominant hand** until it's about 4-6 inches from the blade\n" +
        "3. **Transfer control to the push stick:** Place the notch on the back of the material and push gently\n" +
        "4. **Maintain even pressure:** The push stick does the feeding; your hands are free to guide\n" +
        "5. **As the material exits the blade, use the push stick to guide it** — never grab the material directly as it exits\n" +
        "6. **Let the material clear the blade completely** before releasing pressure\n\n" +
        "**PUSH STICK SAFETY RULES**\n" +
        "- Never grab the material directly if you can use the push stick instead\n" +
        "- If the push stick touches the blade, that's OK—the stick is replaceable, your hand is not\n" +
        "- Replace the push stick if it gets chipped or damaged—a damaged stick can slip\n" +
        "- Use a push stick even if you feel experienced—professional woodworkers use them every time\n\n" +
        "**NARROW MATERIAL EXCEPTIONS**\n" +
        "Some very narrow pieces are safer to cut with a push stick but can be tricky to feed. If the material is:\n" +
        "- **Less than 1 inch wide:** Always use a push stick\n" +
        "- **Between 1-2 inches:** Use a push stick unless you're very confident (ask your teacher)\n" +
        "- **More than 2 inches:** You can typically feed with your hand, but a push stick never hurts",
      tips: [
        "Make sure your push stick is at arm's reach before you start—you shouldn't have to search for it mid-cut",
        "A push stick with a notch is more effective than a flat stick—the notch prevents the material from sliding sideways",
        "If your push stick is worn or damaged, ask your teacher to replace it or show you how to make a new one",
        "Using a push stick every time is a professional habit—don't skip it even for 'quick' cuts",
      ],
      warning:
        "The fingers on the hand that would naturally reach the blade are the ones at risk in a band saw. A push stick keeps them safe. No exceptions for narrow material.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 5: Blade Breakage Response
    // ========================================================================
    {
      type: "step_by_step",
      id: "band-saw-breakage-01",
      title: "Responding to Blade Breakage",
      steps: [
        {
          number: 1,
          instruction:
            "**IMMEDIATE REACTION:** The moment you hear a snap or feel the blade stop pulling, release the material immediately and step back from the saw. Do not pull your hands toward your body—step back.",
          checkpoint:
            "You've stepped away from the machine. Your hands are clear of the blade area.",
        },
        {
          number: 2,
          instruction:
            "**ASSESS YOUR CONDITION:** Check your hands and arms for any cuts, bleeding, or injuries. Even a small cut from a blade is serious and needs attention.",
          warning:
            "A broken blade can cause lacerations that feel small initially but bleed heavily. Check immediately.",
        },
        {
          number: 3,
          instruction:
            "**TURN OFF THE SAW:** Press the power button to stop the machine. The blade will continue coasting for a few seconds—wait for it to stop completely.",
          checkpoint: "Saw is powered down. Blade is no longer moving.",
        },
        {
          number: 4,
          instruction:
            "**ALERT YOUR TEACHER:** Tell your teacher immediately: 'The blade broke on the band saw.' Point to your machine so they know which saw needs inspection.",
          image: "/images/safety/band-saw-alert.png",
        },
        {
          number: 5,
          instruction:
            "**DO NOT ATTEMPT TO REPLACE THE BLADE YOURSELF:** Blade replacement requires knowledge of proper tension and alignment. Your teacher will replace it or wait for maintenance personnel.",
          warning:
            "A blade that breaks once might have been under excessive tension or improperly installed. The teacher needs to check the setup.",
        },
        {
          number: 6,
          instruction:
            "**IF YOU'RE INJURED:** Apply pressure to any cut with a clean cloth. Alert your teacher immediately. For significant bleeding, use the first aid kit and wash the wound thoroughly.",
          checkpoint:
            "Injury is contained. Teacher is informed. You're waiting for first aid or medical attention if needed.",
        },
      ],
    } as StepByStepBlock,

    // ========================================================================
    // BLOCK 6: Before/After - Guard Position
    // ========================================================================
    {
      type: "before_after",
      id: "band-saw-guard-ba-01",
      title: "Blade Guard: Wrong vs Right Position",
      before: {
        caption: "NOT SAFE: Guard positioned incorrectly (too high)",
        hazards: [
          "Guard is 2+ inches above material",
          "Hands can easily reach the blade beneath the guard",
          "Operator hand is positioned directly behind the blade path",
          "No push stick visible or in use",
          "Guard is loose and could shift during cutting",
        ],
        image: "/images/safety/band-saw-guard-wrong.png",
      },
      after: {
        caption: "SAFE: Guard positioned correctly (1/4 inch above material)",
        principles: [
          "Guard is exactly 1/4 inch above the material surface",
          "Hands are positioned correctly (right feeding, left supporting from side)",
          "Push stick is ready for use if material becomes narrow",
          "Guard is tight and won't shift during cutting",
          "Operator is at the side of the machine, not directly behind the blade path",
        ],
        image: "/images/safety/band-saw-guard-right.png",
      },
      key_difference:
        "Proper guard positioning takes 10 seconds to adjust and prevents 95% of band saw hand injuries. This is non-negotiable setup for every job.",
    } as BeforeAfterBlock,

    // ========================================================================
    // BLOCK 7: Scenario - Resistance & Binding
    // ========================================================================
    {
      type: "scenario",
      id: "band-saw-scenario-01",
      title: "Material Binding in the Blade",
      setup:
        "You're making a straight cut through hardwood. Halfway through, you suddenly feel resistance—the material is much harder to push, and the blade is making a grinding sound. The cut feels like it's jamming. What do you do?",
      branches: [
        {
          id: "bind-scenario-wrong-1",
          choice_text: "Push harder to get the material through the binding",
          is_correct: false,
          feedback:
            "❌ Pushing harder increases the stress on the blade. The blade is more likely to break or twist. More force = more risk.",
          consequence: "Blade breaks or twists, potentially causing injury.",
        },
        {
          id: "bind-scenario-correct",
          choice_text: "Stop pushing, turn off the saw, and wait for the blade to stop before backing out the material",
          is_correct: true,
          feedback:
            "✓ Correct! When the blade binds, you must STOP immediately. Backing out gently once the blade is stationary prevents blade breakage and injury.",
          consequence:
            "Blade is preserved. Material is safely removed. You can investigate why binding occurred.",
        },
        {
          id: "bind-scenario-wrong-2",
          choice_text: "Pull the material backward at an angle while the blade is still running",
          is_correct: false,
          feedback:
            "❌ Pulling backward while the blade is running is dangerous. The blade is designed to cut in one direction. Reversing causes binding to worsen and can throw the material.",
          consequence:
            "Material could be kicked back toward you. Blade damage. Risk of injury.",
        },
        {
          id: "bind-scenario-wrong-3",
          choice_text: "Keep applying pressure and hope the blade cuts through whatever is jamming",
          is_correct: false,
          feedback:
            "❌ Hoping doesn't work. The blade is stressed. Continued pressure will cause it to break or twist, which is dangerous.",
          consequence: "Blade failure, potential injury, damage to the saw.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 8: Scenario - Tight Curves
    // ========================================================================
    {
      type: "scenario",
      id: "band-saw-scenario-02",
      title: "Navigating a Tight Curve Safely",
      setup:
        "You're cutting a tight spiral curve on a small piece of wood. As you guide the curve, your fingers get very close to the blade—within about 1 inch. You're concentrating on following the line. What do you do?",
      branches: [
        {
          id: "curve-scenario-wrong-1",
          choice_text: "Keep going—you're almost done with the curve, just a few more centimeters",
          is_correct: false,
          feedback:
            "❌ When your fingers are within 1 inch of the blade, you're in the danger zone. One slip = a serious laceration. Tight curves require you to stay farther away or use a different approach.",
          consequence: "One slip results in a finger laceration.",
        },
        {
          id: "curve-scenario-correct",
          choice_text: "Stop, turn off the saw, and reposition or use a push stick to guide the tight part of the curve",
          is_correct: true,
          feedback:
            "✓ Correct! When hands get dangerously close to the blade, you stop and reposition. Using a push stick for tight curves keeps hands safe.",
          consequence:
            "Tight curve is cut safely. Hands are protected. Work quality remains good.",
        },
        {
          id: "curve-scenario-wrong-2",
          choice_text: "Speed up the feed to finish the curve faster before your hands slip",
          is_correct: false,
          feedback:
            "❌ Speeding up actually increases risk. Faster feeding = less control = higher chance of slipping.",
          consequence: "Higher risk of hand-blade contact due to poor control.",
        },
        {
          id: "curve-scenario-wrong-3",
          choice_text: "Use your thumb to guide the material on the inside of the curve",
          is_correct: false,
          feedback:
            "❌ The inside of the curve is where the blade is. Your thumb would be directly in the path of the blade. This is the most dangerous positioning possible.",
          consequence: "Thumb laceration, likely with tendon/nerve damage.",
        },
      ],
    } as ScenarioBlock,

    // ========================================================================
    // BLOCK 9: Check Understanding - Guard Position
    // ========================================================================
    {
      type: "comprehension_check",
      id: "band-saw-check-01",
      question: "What's the correct blade guard position for most band saw cuts?",
      options: [
        "Touching the material so it has maximum protection",
        "1/4 inch above the material surface",
        "2-3 inches above the material so it's easy to see",
        "Directly above the blade axis for best support",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! The 1/4 inch rule is the safety standard. This gives enough clearance for smooth feeding while keeping hands away from the blade.",
      feedback_wrong:
        "Not quite. The blade guard should be positioned exactly 1/4 inch above the material. This is the tested safety standard that balances protection with material feeding.",
      hint: "The guard needs to be close enough for safety, but not so close it interferes with cutting. What's the standard distance?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 10: Check Understanding - Push Stick
    // ========================================================================
    {
      type: "comprehension_check",
      id: "band-saw-check-02",
      question: "When should you use a push stick on a band saw?",
      options: [
        "Only if your teacher tells you to",
        "For any material narrower than about 2 inches",
        "Only for straight cuts, not for curves",
        "Only if the material is hardwood (softwood is safe)",
      ],
      correct_index: 1,
      feedback_correct:
        "✓ Correct! Narrow material (less than 2 inches wide) is a standard rule for push stick use. Professional woodworkers follow this rule every time.",
      feedback_wrong:
        "Not quite. Push sticks are used for narrow material (less than about 2 inches wide). This is a standard safety practice in woodworking. The wood type doesn't matter—the width does.",
      hint: "What property of the material determines if you need a push stick?",
    } as ComprehensionCheckBlock,

    // ========================================================================
    // BLOCK 11: Pre-Use Machine Checks
    // ========================================================================
    {
      type: "key_concept",
      id: "band-saw-checks-01",
      title: "Pre-Use Machine Checks: Never Skip These",
      icon: "✓",
      content:
        "Before you turn on a band saw, do a 2-minute inspection. This catches problems that could cause injuries or damage.\n\n" +
        "**VISUAL INSPECTION (1 minute)**\n\n" +
        "1. **Check the blade for cracks**\n" +
        "   - Close your eyes and slowly run your finger along the blade (while OFF)\n" +
        "   - You'll feel any cracks or rough spots immediately\n" +
        "   - Cracks = replace blade, do not use\n\n" +
        "2. **Check for kinks or bends**\n" +
        "   - Look at the blade from both sides\n" +
        "   - A kinked blade indicates previous stress—replace it\n" +
        "   - Kinks = stress concentrations that will fail\n\n" +
        "3. **Check for rust or discoloration**\n" +
        "   - Rust weakens the blade structurally\n" +
        "   - Dark discoloration (blue/black) often indicates over-heating\n" +
        "   - Rust or discoloration = replace blade\n\n" +
        "4. **Check blade teeth**\n" +
        "   - Are they sharp? Run your finger along them (gently)\n" +
        "   - Dull teeth = harder cutting, more jamming risk\n" +
        "   - Dull blade = sharpen or replace\n\n" +
        "5. **Check tension**\n" +
        "   - Push the blade sideways with your hand (gently)\n" +
        "   - It should have firm resistance but not be rock-hard\n" +
        "   - Too loose = wavy cuts, too tight = premature failure\n\n" +
        "**OPERATIONAL CHECKS (1 minute)**\n\n" +
        "6. **Check blade tracking (alignment)**\n" +
        "   - Turn the upper wheel by hand (power OFF)\n" +
        "   - The blade should stay centered on both wheels\n" +
        "   - Wandering blade = needs re-tracking (ask your teacher)\n\n" +
        "7. **Check guard adjustment**\n" +
        "   - Set the guard to 1/4 inch above your material\n" +
        "   - Verify the guard is tight and won't slip\n\n" +
        "8. **Check workspace**\n" +
        "   - No loose materials on the table\n" +
        "   - No clutter around the machine\n" +
        "   - Good lighting (you should see the blade clearly)\n\n" +
        "9. **Verify power switch is OFF**\n" +
        "   - One last check: power is OFF before you touch anything\n\n" +
        "10. **Have push stick ready**\n" +
        "   - Push stick is within arm's reach\n" +
        "   - You won't have to search for it mid-cut\n\n" +
        "**IF YOU FIND A PROBLEM**\n" +
        "- **Crack in blade:** Report to your teacher. The blade is unsafe.\n" +
        "- **Loose tension:** Ask your teacher to adjust. Don't attempt this yourself.\n" +
        "- **Misaligned blade:** Report to your teacher. Re-tracking requires expertise.\n" +
        "- **Dull blade:** Ask your teacher. They may sharpen or replace it.\n" +
        "- **Any other issue:** If something doesn't look right, ask. No questions are dumb when it comes to safety.",
      tips: [
        "The 2-minute pre-use check becomes a habit—do it for every cutting session",
        "If you skip the check and something breaks or you get injured, the responsibility is partly yours",
        "Professional workshops use checklists—adopt this habit early",
        "Never assume another user checked the machine—you check it yourself every time",
      ],
      warning:
        "Most band saw injuries happen on machines that were not properly inspected. A 2-minute check prevents the vast majority of problems.",
    } as KeyConceptBlock,

    // ========================================================================
    // BLOCK 12: Summary & Quiz Ready
    // ========================================================================
    {
      type: "key_concept",
      id: "band-saw-summary-01",
      title: "Ready for the Band Saw Safety Quiz",
      icon: "✅",
      content:
        "You've learned how to work safely with band saws:\n\n" +
        "✓ **Blade Hazards** — 50-100 mph blade causes severe lacerations; respect the speed\n" +
        "✓ **Guard Setup** — Always 1/4 inch above material, adjust before every job\n" +
        "✓ **Feed Direction** — Straight cuts push material straight; curves guide with both hands\n" +
        "✓ **Hand Positioning** — Right hand feeds, left hand supports from side, never behind blade\n" +
        "✓ **Push Stick Usage** — Always use for material narrower than 2 inches\n" +
        "✓ **Binding Response** — STOP immediately, turn off saw, gently back out material\n" +
        "✓ **Blade Inspection** — Check for cracks, kinks, rust, dullness before every use\n" +
        "✓ **Blade Breakage** — Step back, assess injury, turn off saw, alert teacher\n\n" +
        "**What's next:**\n" +
        "Take the quiz on the next screen. You need to answer **10 out of 12 questions correctly** to earn your Band Saw Safety badge.\n\n" +
        "**Remember:** A band saw blade moves at 50-100 mph. Your hands move at ~2 mph. There's no contest if they meet. Guard setup, hand positioning, and pre-use checks are your defenses. Use them every single time.",
      tips: [
        "The 2-minute pre-use check is mandatory, not optional. Make it a habit.",
        "Guard position matters more than any other single safety feature—get it right every time.",
        "If anything feels unusual (binding, strange sounds, resistance changes), stop immediately.",
        "Curved cuts bring hands close to the blade—extra caution required.",
        "Earning this badge means you're trusted with a fast, powerful tool. Respect that trust.",
      ],
    } as KeyConceptBlock,
  ],
};

/**
 * Export type for badge definition
 */
export type BandSawModuleType = typeof BAND_SAW_MODULE;
