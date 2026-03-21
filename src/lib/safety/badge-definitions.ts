/**
 * Safety Badge Definitions for Free Tool
 *
 * 7 comprehensive safety badges with full question pools, learn content, and structured learning.
 * Tier 1 (Fundamentals): General Workshop Safety, Hand Tool Safety
 * Tier 2 (Specialty): Wood Workshop, Metal Workshop, Plastics & Composites, Electronics & Soldering, Digital Fabrication
 */

import type { BadgeDefinition, BadgeQuestion, LearnCard } from "./types";

// ============================================================================
// BADGE 1: GENERAL WORKSHOP SAFETY (TIER 1)
// ============================================================================

const generalWorkshopSafetyLearn: LearnCard[] = [
  {
    title: 'Safety Sign System',
    content: 'Red signs = STOP / PROHIBITION (no entry, no smoking). Blue signs = MANDATORY action required (wear PPE, read instructions). Yellow signs = WARNING of hazard ahead (hot surface, sharp objects). Green signs = INFORMATION (fire exits, first aid kit locations). Always pay attention to signs—they are your first line of defence.',
    icon: '🚫',
  },
  {
    title: 'Personal Protective Equipment (PPE)',
    content: 'PPE includes safety glasses, hearing protection, dust masks, gloves, aprons, closed-toe shoes, and hair ties. Different activities need different PPE. Always wear what is required for the task. Damaged PPE (cracked goggles, torn gloves) must be replaced immediately. Never bypass PPE requirements.',
    icon: '🥽',
  },
  {
    title: 'Injury Reporting & First Aid',
    content: 'Report ALL injuries, no matter how small, to your teacher or supervisor immediately. Even minor cuts can become infected. Know where the first aid kit is located. For serious injuries (bleeding that won\'t stop, chemical exposure, burns), call for help and alert an adult. Do not assume you can handle it yourself.',
    icon: '🩹',
  },
  {
    title: 'Housekeeping & Floor Safety',
    content: 'Keep your workspace clean and organized. Sweep up wood shavings, metal shavings, and dust regularly. Wipe up spills immediately—wet floors are slip hazards. Store tools properly so they don\'t clutter walkways. Keep emergency exits and pathways clear at all times. A tidy workshop is a safe workshop.',
    icon: '🧹',
  },
  {
    title: 'Emergency Procedures',
    content: 'Know the location of emergency exits, fire extinguishers, emergency eyewash/shower stations, and first aid kits. In case of fire, evacuate calmly and meet at the designated assembly point. For chemical splashes, use the eyewash station and notify an adult. For electrical emergencies, switch off the main power if safe to do so.',
    icon: '🚨',
  },
  {
    title: 'Shared Responsibility & Common Sense',
    content: 'Everyone in the workshop is responsible for safety—not just yourself, but your classmates too. If you see someone breaking a safety rule, speak up. Don\'t horse around or distract others. If you\'re tired, stressed, or not paying attention, don\'t use equipment. Take breaks when needed. Safety is non-negotiable.',
    icon: '🤝',
  },
];

const generalWorkshopSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'gws-q01',
    type: 'multiple_choice',
    topic: 'safety-signs',
    prompt: 'What does a blue safety sign indicate?',
    options: ['A hazard warning', 'Mandatory action required', 'Prohibition', 'Information'],
    correct_answer: 'Mandatory action required',
    explanation: 'Blue signs always indicate an action that MUST be taken (e.g., "Wear Safety Glasses"). Red signs prohibit, yellow warns, and green provides information.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q02',
    type: 'true_false',
    topic: 'ppe',
    prompt: 'You can continue using safety glasses with a small crack in them as long as you can still see through them.',
    correct_answer: 'false',
    explanation: 'Damaged PPE must be replaced immediately. A cracked lens can fail under impact and offers no protection. Always use intact, properly fitted PPE.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q03',
    type: 'scenario',
    topic: 'injury-reporting',
    prompt: 'You get a small splinter while handling wood. It\'s not bleeding. What should you do?',
    options: [
      'Leave it—it\'s too small to worry about',
      'Pull it out yourself later if it bothers you',
      'Report it to your teacher and have it removed properly',
      'Ignore it and finish the project first',
    ],
    correct_answer: 'Report it to your teacher and have it removed properly',
    explanation: 'All injuries, no matter how small, must be reported immediately. Splinters can cause infection. Your teacher has the right tools and training to remove it safely and treat the wound if needed.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q04',
    type: 'true_false',
    topic: 'eye-protection',
    prompt: 'Safety glasses are only necessary when using power tools.',
    correct_answer: 'false',
    explanation: 'Eye protection is needed for many activities: sawing, sanding, grinding, hammering, using chisels, and working with small pieces that could fly up. Always check what PPE is required for your task.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q05',
    type: 'multiple_choice',
    topic: 'housekeeping',
    prompt: 'What is the main reason for keeping your workshop clean and organized?',
    options: [
      'It looks nice for visitors',
      'It reduces trip hazards, prevents fire spread, and makes tools easy to find',
      'It keeps you from getting bored',
      'It is not actually important',
    ],
    correct_answer: 'It reduces trip hazards, prevents fire spread, and makes tools easy to find',
    explanation: 'A clean workshop directly impacts safety. Clutter causes trips, dust accumulation is a fire risk, and lost tools can lead to people grabbing the wrong equipment.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q06',
    type: 'scenario',
    topic: 'floor-safety',
    prompt: 'You spill some machine oil on the workshop floor. What is the correct action?',
    options: [
      'Leave it—oil eventually dries',
      'Wipe it up immediately with sawdust or cloth, then wash the area with soap and water',
      'Walk around it carefully',
      'Tell someone else to clean it',
    ],
    correct_answer: 'Wipe it up immediately with sawdust or cloth, then wash the area with soap and water',
    explanation: 'Oil is a severe slip hazard and a fire risk. Clean it up right away to prevent accidents. Sawdust or cloth absorbs it, then wash with soap and water for final removal.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q07',
    type: 'true_false',
    topic: 'ear-protection',
    prompt: 'You only need hearing protection if you think the noise is too loud.',
    correct_answer: 'false',
    explanation: 'Hearing damage is cumulative and often painless at first. If your teacher says hearing protection is required, wear it—even if the noise doesn\'t seem that loud to you. Long-term exposure without protection causes permanent damage.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q08',
    type: 'sequence',
    topic: 'emergency',
    prompt: 'Put these emergency steps in the correct order: (1) Alert an adult, (2) Leave the area, (3) Call for help, (4) Assess safety',
    correct_answer: [3, 2, 0, 1],
    explanation: 'Correct order: (4) Assess safety - make sure it\'s safe to act. (3) Call for help - get an adult. (1) Alert an adult - communicate the problem. (2) Leave the area - evacuate if needed. Your safety comes first.',
    difficulty: 'hard',
  },
  {
    id: 'gws-q09',
    type: 'multiple_choice',
    topic: 'responsibility',
    prompt: 'If you notice a classmate not wearing required safety glasses, what should you do?',
    options: [
      'Mind your own business',
      'Politely remind them and alert your teacher',
      'Let your teacher find out on their own',
      'Only tell them if they ask',
    ],
    correct_answer: 'Politely remind them and alert your teacher',
    explanation: 'Everyone is responsible for workshop safety. Speaking up when someone is at risk shows you care about their wellbeing. This is part of creating a safe culture for everyone.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q10',
    type: 'true_false',
    topic: 'dust-fumes',
    prompt: 'Dust from sanding is just annoying—it doesn\'t pose a serious health risk.',
    correct_answer: 'false',
    explanation: 'Dust inhalation can cause respiratory damage, allergies, and long-term lung disease. Always wear a dust mask when sanding and ensure dust extraction is running. Protect your lungs now to breathe well in the future.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q11',
    type: 'scenario',
    topic: 'safety-signs',
    prompt: 'You see a yellow and black sign with an exclamation mark near the laser cutter. What does this mean?',
    options: [
      'The laser cutter is broken',
      'There is a potential hazard in that area',
      'You are not allowed to use the laser cutter',
      'The area is closed for maintenance',
    ],
    correct_answer: 'There is a potential hazard in that area',
    explanation: 'Yellow and black signs warn of hazards (electrical, hot surfaces, laser light, etc.). The exclamation mark emphasizes caution. Read warning signs carefully and follow their instructions.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q12',
    type: 'multiple_choice',
    topic: 'ppe',
    prompt: 'Which of these is NOT typically considered PPE in a workshop?',
    options: ['Safety glasses', 'Hair tie', 'Work apron', 'Mobile phone'],
    correct_answer: 'Mobile phone',
    explanation: 'PPE includes protective items like goggles, gloves, masks, aprons, and hair ties. Mobile phones are not protective equipment (and should not be used while working near machinery anyway).',
    difficulty: 'easy',
  },
  {
    id: 'gws-q13',
    type: 'true_false',
    topic: 'eye-protection',
    prompt: 'If you wear glasses for vision, you do not need safety glasses on top of them.',
    correct_answer: 'false',
    explanation: 'Regular glasses do not provide impact protection. You need to wear safety glasses designed for the task, either over your regular glasses or as prescription safety lenses. Always check with your teacher.',
    difficulty: 'hard',
  },
  {
    id: 'gws-q14',
    type: 'scenario',
    topic: 'injury-reporting',
    prompt: 'A classmate has a chemical splash in their eye from a finishing product. What do you do?',
    options: [
      'Tell them to blink a few times and they\'ll be fine',
      'Alert an adult immediately and help them to the eyewash station',
      'Have them wash it out themselves with soap and water',
      'Wait to see if it improves before telling a teacher',
    ],
    correct_answer: 'Alert an adult immediately and help them to the eyewash station',
    explanation: 'Chemical eye injuries are serious and require immediate professional attention. Alert an adult right away and use the emergency eyewash station. Do not delay—every second counts.',
    difficulty: 'hard',
  },
  {
    id: 'gws-q15',
    type: 'multiple_choice',
    topic: 'housekeeping',
    prompt: 'Why should you store sharp tools (chisels, knives) in a safe location?',
    options: [
      'So they don\'t get lost',
      'To prevent accidental cuts when reaching or walking past',
      'To keep them from getting dull',
      'It\'s just a preference',
    ],
    correct_answer: 'To prevent accidental cuts when reaching or walking past',
    explanation: 'Sharp tools left lying around are hazards. Someone could accidentally cut themselves when reaching for something or walking by. Proper storage protects everyone.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q16',
    type: 'true_false',
    topic: 'emergency',
    prompt: 'In an emergency evacuation, you should grab your backpack and belongings before leaving.',
    correct_answer: 'false',
    explanation: 'In an emergency, personal safety comes first. Do not stop to collect items. Evacuate immediately and calmly using the designated exit. Your belongings can be retrieved later; your safety cannot wait.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q17',
    type: 'scenario',
    topic: 'floor-safety',
    prompt: 'You notice water pooling on the floor near the sink. What is the correct response?',
    options: [
      'Walk carefully around it and mention it later',
      'Clean it up immediately to prevent slip hazards',
      'Ask someone else to deal with it',
      'Leave it—it will dry on its own',
    ],
    correct_answer: 'Clean it up immediately to prevent slip hazards',
    explanation: 'Wet floors are immediate slip hazards that can cause serious injuries. Clean them up right away. If you cannot safely clean it, alert an adult immediately and mark the area as a hazard.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q18',
    type: 'multiple_choice',
    topic: 'ppe',
    prompt: 'Long hair in a workshop should be:',
    options: [
      'Tied back securely to prevent it from getting caught in machinery',
      'Worn down for comfort',
      'Covered with a hat only when using power tools',
      'Left alone—hair won\'t get caught',
    ],
    correct_answer: 'Tied back securely to prevent it from getting caught in machinery',
    explanation: 'Long hair can easily get caught in rotating machinery, causing serious scalp injuries. Always tie hair back securely with a hair tie. This simple action prevents devastating accidents.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q19',
    type: 'true_false',
    topic: 'responsibility',
    prompt: 'If you see someone else breaking a safety rule, it\'s not your responsibility to say anything.',
    correct_answer: 'false',
    explanation: 'Everyone shares responsibility for workshop safety. Speaking up when someone is at risk protects them and models a safety-conscious culture. A polite reminder can prevent serious injury.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q20',
    type: 'scenario',
    topic: 'safety-signs',
    prompt: 'You see a red sign with a white circle and line on the workshop door. What does it mean?',
    options: [
      'The room is cold',
      'Prohibition—you are not permitted to enter',
      'The room is occupied',
      'The workshop is being cleaned',
    ],
    correct_answer: 'Prohibition—you are not permitted to enter',
    explanation: 'Red signs with a circle and line indicate prohibition. Do not enter. This might mean equipment is being serviced, the area is unsafe, or you lack authorization. Respect prohibition signs.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q21',
    type: 'multiple_choice',
    topic: 'dust-fumes',
    prompt: 'When should you use a dust extraction system?',
    options: [
      'Only when the dust is very visible',
      'Always when sanding, cutting, or grinding as instructed by your teacher',
      'Only if you feel uncomfortable',
      'Dust extraction is optional',
    ],
    correct_answer: 'Always when sanding, cutting, or grinding as instructed by your teacher',
    explanation: 'Dust extraction should run before you start the task and continue throughout. Some dust is not visible but still harmful. Always follow your teacher\'s instructions on when extraction is required.',
    difficulty: 'medium',
  },
  {
    id: 'gws-q22',
    type: 'true_false',
    topic: 'ear-protection',
    prompt: 'Music from earbuds protects your hearing as well as proper ear protection does.',
    correct_answer: 'false',
    explanation: 'Earbuds do not protect against workshop noise. In fact, wearing earbuds in a workshop is dangerous because you cannot hear warnings or approach hazards. Always use proper hearing protection (earplugs or earmuffs) when required.',
    difficulty: 'hard',
  },
  {
    id: 'gws-q23',
    type: 'scenario',
    topic: 'injury-reporting',
    prompt: 'You cut your hand slightly while using a hand tool. It\'s bleeding a bit. What do you do?',
    options: [
      'Rinse it under water and continue working',
      'Bandage it yourself if you have a bandage',
      'Tell your teacher immediately so they can assess the injury and apply first aid',
      'Ignore it—small cuts heal on their own',
    ],
    correct_answer: 'Tell your teacher immediately so they can assess the injury and apply first aid',
    explanation: 'Report all bleeding injuries immediately. Your teacher can assess whether stitches or professional treatment is needed. Even small cuts can become infected. It\'s always better to get help early.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q24',
    type: 'match',
    topic: 'safety-signs',
    prompt: 'Match each safety sign color to its meaning:',
    match_pairs: [
      { left: 'Red sign', right: 'Prohibition or stop' },
      { left: 'Blue sign', right: 'Mandatory action' },
      { left: 'Yellow sign', right: 'Warning of hazard' },
      { left: 'Green sign', right: 'Information or safe condition' },
    ],
    correct_answer: ['Prohibition or stop', 'Mandatory action', 'Warning of hazard', 'Information or safe condition'],
    explanation: 'Colors are standardized globally to help everyone understand safety requirements instantly. Learning them protects you in any workshop, anywhere in the world.',
    difficulty: 'easy',
  },
  {
    id: 'gws-q25',
    type: 'scenario',
    topic: 'emergency',
    prompt: 'A small fire starts near a piece of wood on the bench. You are closest. What do you do?',
    options: [
      'Try to put it out with your hands',
      'Immediately alert an adult and use the nearest fire extinguisher if you know how to use it safely',
      'Throw water on it',
      'Leave it and hope someone notices',
    ],
    correct_answer: 'Immediately alert an adult and use the nearest fire extinguisher if you know how to use it safely',
    explanation: 'Never try to handle a fire alone. Alert an adult immediately. If trained and safe, use a fire extinguisher (PASS: Pull, Aim, Squeeze, Sweep). If the fire spreads or you\'re unsure, evacuate and call for help.',
    difficulty: 'hard',
  },
];

// ============================================================================
// BADGE 2: HAND TOOL SAFETY (TIER 1)
// ============================================================================

const handToolSafetyLearn: LearnCard[] = [
  {
    title: 'Choose the Right Tool for the Job',
    content: 'Using the wrong tool is dangerous and damages the tool and your work. A hammer is for nails, not screws. A screwdriver is for screws, not prying. A chisel is for chiseling, not hammering. Always select the correct tool and check that it fits your hand size and the task. When in doubt, ask your teacher.',
    icon: '🔨',
  },
  {
    title: 'Secure Your Work with Clamps',
    content: 'Never hold your work in one hand while cutting, drilling, or chiseling with the other. Always use a clamp or vise to hold the material. This keeps both hands safe and gives you better control. A workbench vice is your friend—use it every time. Unsecured work leads to serious cuts and crushed fingers.',
    icon: '🪛',
  },
  {
    title: 'Always Cut Away from Your Body',
    content: 'When using knives, saws, or chisels, direct the blade or tool away from yourself, your other hand, and anyone nearby. Never cut toward your body or hand. If the tool slips, it should move away from you, not into you. This simple rule prevents most hand injuries. Make it a habit.',
    icon: '🔪',
  },
  {
    title: 'Sharp Tools Are Safer Than Dull Ones',
    content: 'Sharp tools require less force, are easier to control, and are less likely to slip. A dull tool forces you to apply extra pressure, which causes it to suddenly slip and can lead to serious cuts. Keep tools sharp and well-maintained. Report dull or damaged tools to your teacher immediately.',
    icon: '✨',
  },
  {
    title: 'Carry & Pass Tools Safely',
    content: 'When carrying sharp tools, hold them with the point or blade facing downward and away from your body. Never carry sharp objects in your pocket. When passing a tool to someone, hand them the handle first, never the sharp end. Say "handle" when passing to warn them. Keep your fingers clear.',
    icon: '🤐',
  },
  {
    title: 'Store Tools Properly',
    content: 'Store sharp tools in designated locations: sheaths for knives, tool racks for chisels, and handles down in drawers. Never leave sharp tools loose on benches or in toolboxes where someone might accidentally cut themselves. A organized toolbox is a safe toolbox. Check the storage location before reaching in.',
    icon: '📦',
  },
];

const handToolSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'hts-q01',
    type: 'multiple_choice',
    topic: 'tool-selection',
    prompt: 'You need to remove a screw from a piece of wood. Which tool is correct?',
    options: ['Hammer', 'Flathead screwdriver', 'Saw', 'Chisel'],
    correct_answer: 'Flathead screwdriver',
    explanation: 'Use the correct tool for the task. A screwdriver is designed for screws. Using a hammer or other tool damages the screw and is dangerous.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q02',
    type: 'true_false',
    topic: 'clamping',
    prompt: 'It is safe to hold your workpiece in one hand while sawing with the other if you are careful.',
    correct_answer: 'false',
    explanation: 'Holding work with one hand while cutting with the other is extremely dangerous. Always use a clamp or vise. If the saw slips, your hand could be seriously cut. There is no safe way to do it without a clamp.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q03',
    type: 'scenario',
    topic: 'sharpness',
    prompt: 'A chisel in the tool rack feels dull. What should you do?',
    options: [
      'Use it anyway—dull tools are safer',
      'Try to sharpen it yourself',
      'Report it to your teacher and use a sharp chisel instead',
      'File it down a bit on the bench grinder',
    ],
    correct_answer: 'Report it to your teacher and use a sharp chisel instead',
    explanation: 'Dull tools are MORE dangerous because they require excessive force and are more likely to slip. Report dull tools to your teacher. Never attempt to sharpen tools yourself unless trained.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q04',
    type: 'multiple_choice',
    topic: 'carrying',
    prompt: 'When carrying a chisel across the workshop, how should you hold it?',
    options: [
      'Blade pointing forward, like a sword',
      'Blade pointing up, for visibility',
      'Blade pointing downward and away from your body',
      'In a toolbelt with the blade out',
    ],
    correct_answer: 'Blade pointing downward and away from your body',
    explanation: 'Point sharp tools downward and away from yourself and others. If you trip, the tool should fall away, not into you. This protects you and bystanders.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q05',
    type: 'true_false',
    topic: 'passing-tools',
    prompt: 'It is okay to toss a sharp tool like a knife to a classmate if they ask for it.',
    correct_answer: 'false',
    explanation: 'Never toss sharp tools. Always hand them handle-first, making sure the other person has a firm grip before you let go. This prevents drops and injuries.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q06',
    type: 'scenario',
    topic: 'cut-direction',
    prompt: 'You are using a utility knife to cut a piece of leather. Which direction should the blade move?',
    options: [
      'Toward your body for better control',
      'Toward your other hand holding the leather',
      'Away from your body and your other hand',
      'It doesn\'t matter as long as you are focused',
    ],
    correct_answer: 'Away from your body and your other hand',
    explanation: 'Always cut away from yourself and your supporting hand. If the blade slips, it should move away from you. This rule prevents almost all hand-tool cutting injuries.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q07',
    type: 'multiple_choice',
    topic: 'storage',
    prompt: 'Where should you store a sharp hand saw?',
    options: [
      'Loose in a drawer with other tools',
      'In a protective sheath or teeth-cover on a wall rack',
      'Underneath your workbench',
      'In your locker without a cover',
    ],
    correct_answer: 'In a protective sheath or teeth-cover on a wall rack',
    explanation: 'Sharp tools need dedicated, protected storage. A sheath or cover prevents accidental contact with the blade. A wall rack keeps it accessible and organized.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q08',
    type: 'true_false',
    topic: 'tool-selection',
    prompt: 'You can use a wrench to hammer a nail if you don\'t have a hammer nearby.',
    correct_answer: 'false',
    explanation: 'Never use the wrong tool. A wrench is not designed for hammering and will damage both the tool and your work. Always use the correct tool or ask to borrow one.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q09',
    type: 'scenario',
    topic: 'clamping',
    prompt: 'You need to chisel a small notch in a board. You have a clamp and a free hand. What is the safest approach?',
    options: [
      'Hold the board in your free hand and chisel with the other',
      'Clamp the board securely and use both hands to control the chisel',
      'Lean the board against a bench and chisel quickly',
      'Hold the board between your legs and chisel with both hands',
    ],
    correct_answer: 'Clamp the board securely and use both hands to control the chisel',
    explanation: 'Secure the work with a clamp so both your hands are free to control the tool. This gives you maximum control and safety. Never use your hands to hold the workpiece.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q10',
    type: 'multiple_choice',
    topic: 'ppe',
    prompt: 'When using hand tools, which PPE is most important?',
    options: [
      'Safety glasses to protect from flying splinters',
      'Gloves to protect from sharp edges',
      'Both safety glasses and gloves',
      'Hearing protection due to noise',
    ],
    correct_answer: 'Safety glasses to protect from flying splinters',
    explanation: 'Safety glasses protect your eyes from splinters and fragments. While gloves can provide some protection, they can also get caught. Your teacher will specify which PPE to use for each task.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q11',
    type: 'true_false',
    topic: 'sharpness',
    prompt: 'A sharp saw requires more effort to push through wood than a dull saw.',
    correct_answer: 'false',
    explanation: 'A sharp saw cuts cleanly with less force. A dull saw requires you to push harder, is less likely to cut straight, and is more prone to slipping. Sharp = safer and more effective.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q12',
    type: 'scenario',
    topic: 'passing-tools',
    prompt: 'Your classmate asks you to pass them a utility knife. What do you do?',
    options: [
      'Slide it across the table blade first',
      'Toss it handle first to them',
      'Hand them the handle first, making sure they have a firm grip before releasing',
      'Ask them to come get it themselves',
    ],
    correct_answer: 'Hand them the handle first, making sure they have a firm grip before releasing',
    explanation: 'Always hand tools handle-first. Ensure the other person has a secure grip before you let go. Never toss or slide sharp tools—they can slip and cause serious injuries.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q13',
    type: 'multiple_choice',
    topic: 'cut-direction',
    prompt: 'You are chiseling a notch. Your support hand should be:',
    options: [
      'In front of the chisel blade',
      'Behind or to the side of the chisel, away from its path',
      'Holding the tool steady',
      'Braced against the workbench',
    ],
    correct_answer: 'Behind or to the side of the chisel, away from its path',
    explanation: 'Your support hand should never be in the path of the tool. If the chisel slips, your hand should be safe. Position it behind the work or to the side.',
    difficulty: 'hard',
  },
  {
    id: 'hts-q14',
    type: 'true_false',
    topic: 'storage',
    prompt: 'It is okay to leave a hand saw on your workbench during a break as long as it\'s visible.',
    correct_answer: 'false',
    explanation: 'Leaving sharp tools on benches is a hazard. Someone could accidentally brush against it or reach for something and cut themselves. Store tools immediately after use.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q15',
    type: 'scenario',
    topic: 'tool-selection',
    prompt: 'You need to pry open a lid on a tin of finish. What should you use?',
    options: [
      'A flathead screwdriver designed for the task',
      'A chisel (it\'s strong)',
      'A hammer handle',
      'Any metal object you find',
    ],
    correct_answer: 'A flathead screwdriver designed for the task',
    explanation: 'Use the correct tool. A pry-bar or flathead screwdriver designed for this purpose will not slip or damage the lid. Using chisels or other improper tools damages them and is dangerous.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q16',
    type: 'multiple_choice',
    topic: 'carrying',
    prompt: 'When carrying multiple hand tools across the workshop, the safest method is:',
    options: [
      'Carry them all at once for efficiency',
      'Carry them one at a time in a designated carrier or toolbox with the blades protected',
      'Tuck them in your pockets and hands',
      'Ask someone else to carry them',
    ],
    correct_answer: 'Carry them one at a time in a designated carrier or toolbox with the blades protected',
    explanation: 'Carrying multiple tools increases the risk of dropping them or getting cut. Use a toolbox with proper slots and sheaths. Blades should always be covered when transported.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q17',
    type: 'true_false',
    topic: 'clamping',
    prompt: 'A vise is only necessary for heavy pieces of wood.',
    correct_answer: 'false',
    explanation: 'A vise is essential for ANY hand tool work, regardless of size. Even a small piece can slip and cause serious cuts. Always clamp your work.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q18',
    type: 'scenario',
    topic: 'sharpness',
    prompt: 'You pick up a hand saw and notice the teeth feel dull. What is the correct action?',
    options: [
      'Use it anyway and apply more pressure',
      'Report it to your teacher and select a sharp saw instead',
      'Try to sharpen it with a file',
      'Use it only for soft materials',
    ],
    correct_answer: 'Report it to your teacher and select a sharp saw instead',
    explanation: 'Dull saws are more dangerous because they require excessive force. Report the tool and use a sharp one. Tool maintenance is the teacher\'s responsibility.',
    difficulty: 'easy',
  },
  {
    id: 'hts-q19',
    type: 'multiple_choice',
    topic: 'maintenance',
    prompt: 'A wrench has rust spots on it. Should you use it?',
    options: [
      'Yes, rust doesn\'t affect function',
      'Yes, just use it and it will wear off',
      'No, report it to your teacher—rust weakens tools and they should be cleaned and treated',
      'Only if you apply WD-40 first',
    ],
    correct_answer: 'No, report it to your teacher—rust weakens tools and they should be cleaned and treated',
    explanation: 'Rust weakens tools and can cause them to break during use. Report damaged tools. Proper tool maintenance ensures they work safely and last longer.',
    difficulty: 'medium',
  },
  {
    id: 'hts-q20',
    type: 'true_false',
    topic: 'cut-direction',
    prompt: 'When using a handsaw, the cutting motion should always move away from your body.',
    correct_answer: 'true',
    explanation: 'Direct cuts away from yourself. If the saw slips, you want it moving away from you, not toward you. This is a fundamental safety principle for all cutting tools.',
    difficulty: 'easy',
  },
];

// ============================================================================
// BADGE 4: WOOD WORKSHOP SAFETY (TIER 2)
// ============================================================================

const woodWorkshopSafetyLearn: LearnCard[] = [
  {
    title: 'Dust Hazards & Extraction',
    content: 'Wood dust is a serious respiratory hazard, especially from hardwoods and exotic woods. Fine dust particles lodge in your lungs and cause long-term damage. Always work with dust extraction running—keep hoses clear and check the system is functioning. When hand-sanding, use a dust mask rated N95 or higher. Wear a proper respirator for heavy sanding or enclosed spaces.',
    icon: '💨',
  },
  {
    title: 'Wood-Specific PPE & Protection',
    content: 'Wear safety glasses (splinters fly) and a dust mask for all sanding and sawing. For routing or aggressive machining, add hearing protection (earplugs or earmuffs). Long hair must be tied back. Loose sleeves or jewelry can catch—wear fitted clothing. Closed-toe shoes protect from dropped tools and spilled finishing materials.',
    icon: '🥽',
  },
  {
    title: 'Timber Types & Hazards',
    content: 'Kiln-dried timber is safer than green (wet) timber because it\'s more stable and predictable. Green timber can twist or bind suddenly during cutting, causing kickback. Hardwoods produce more dust than softwoods. Exotic woods (teak, rosewood) contain toxic compounds—improve ventilation when working with them. Always check if a wood is an allergen before use.',
    icon: '🌳',
  },
  {
    title: 'Cleanup & Material Storage',
    content: 'Dust settles on every surface and is an inhalation risk even after you stop working. Sweep and vacuum regularly using a dust-extraction system, not compressed air (which spreads dust around). Store timber in a dry area off the floor to prevent warping. Stack lumber with spacers to allow air circulation. Store sawdust in sealed containers if you plan to reuse it.',
    icon: '🧹',
  },
  {
    title: 'Finishing Materials Safety',
    content: 'Wood stains, lacquers, oils, and varnishes release volatile organic compounds (VOCs). Always apply finishes in a well-ventilated area or outdoors. Wear gloves to prevent skin absorption—some finish chemicals are toxic through skin contact. Wear a respirator rated for organic fumes if indoors. Never apply water-based finishes near ignition sources as they can still be flammable when wet.',
    icon: '🎨',
  },
];

const woodWorkshopSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'wws-q01',
    type: 'multiple_choice',
    topic: 'dust-hazards',
    prompt: 'Why is wood dust from hardwoods considered a serious hazard?',
    options: [
      'It makes your hands dirty',
      'Fine particles lodge in lungs and cause long-term respiratory damage',
      'It is heavier than softwood dust',
      'It causes allergies immediately',
    ],
    correct_answer: 'Fine particles lodge in lungs and cause long-term respiratory damage',
    explanation: 'Hardwood dust contains particles fine enough to bypass upper airway defenses. Cumulative exposure causes silicosis and other lung diseases. Always use dust extraction and a proper mask.',
    difficulty: 'easy',
  },
  {
    id: 'wws-q02',
    type: 'true_false',
    topic: 'dust-extraction',
    prompt: 'It is acceptable to use a dust mask instead of a full dust extraction system if you only sand for a short time.',
    correct_answer: 'false',
    explanation: 'Both are needed. A mask protects your lungs while dust extraction prevents the dust from floating around the workshop where it affects everyone. Short exposure to high dust loads is still harmful.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q03',
    type: 'scenario',
    topic: 'timber-types',
    prompt: 'You are about to cut green (wet) timber for the first time. What is the main safety concern?',
    options: [
      'Green timber is too soft and will break',
      'It releases more dust than kiln-dried timber',
      'It is unstable and can twist or bind suddenly during cutting, causing severe kickback',
      'It cannot be finished safely',
    ],
    correct_answer: 'It is unstable and can twist or bind suddenly during cutting, causing severe kickback',
    explanation: 'Green timber has internal stresses from moisture. As the blade cuts, these stresses can shift the wood violently, causing dangerous kickback. Always use a fence and never remove it with green timber.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q04',
    type: 'true_false',
    topic: 'ppe',
    prompt: 'Long hair does not need to be tied back when hand-sanding wood.',
    correct_answer: 'false',
    explanation: 'Long hair can catch on moving parts of power tools or even on sand itself during hand-sanding. Always tie hair back or wear a head covering.',
    difficulty: 'easy',
  },
  {
    id: 'wws-q05',
    type: 'multiple_choice',
    topic: 'exotic-woods',
    prompt: 'What is a specific hazard when working with exotic woods like teak or rosewood?',
    options: [
      'They are more expensive',
      'They are harder to cut',
      'They contain toxic compounds in their dust and require better ventilation',
      'They are more likely to splinter',
    ],
    correct_answer: 'They contain toxic compounds in their dust and require better ventilation',
    explanation: 'Exotic woods contain natural oils and compounds that are toxic when inhaled. Always research the wood species and improve ventilation accordingly. Some woods are allergenic.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q06',
    type: 'scenario',
    topic: 'cleanup',
    prompt: 'You have finished sanding a piece of oak. The dust has settled on your bench, the floor, and nearby equipment. What is the safest cleanup method?',
    options: [
      'Use compressed air to blow the dust away quickly',
      'Sweep with a regular broom',
      'Vacuum using a dust-extraction-equipped shop vacuum',
      'Leave it until later—it will settle',
    ],
    correct_answer: 'Vacuum using a dust-extraction-equipped shop vacuum',
    explanation: 'Compressed air spreads dust into the air where you inhale it. A regular broom does the same. A dust-extraction vacuum collects it safely without releasing it.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q07',
    type: 'true_false',
    topic: 'dust-mask',
    prompt: 'A basic paper dust mask (like an N95) is sufficient protection for all woodworking dust.',
    correct_answer: 'false',
    explanation: 'An N95 is good for light sanding or general use. But for heavy sanding, routing, or exotic woods, you need a proper respirator with organic vapor cartridges for finishes.',
    difficulty: 'hard',
  },
  {
    id: 'wws-q08',
    type: 'multiple_choice',
    topic: 'timber-storage',
    prompt: 'How should timber be stored to prevent warping?',
    options: [
      'Stacked flat in a damp basement',
      'In a dry area with spacers between boards for air circulation',
      'Standing upright against a wall',
      'Wrapped in plastic to seal out moisture',
    ],
    correct_answer: 'In a dry area with spacers between boards for air circulation',
    explanation: 'Proper air circulation prevents moisture buildup and warping. Spacers allow air to flow on all surfaces. Damp environments and plastic wrapping trap moisture and cause cupping and twisting.',
    difficulty: 'easy',
  },
  {
    id: 'wws-q09',
    type: 'scenario',
    topic: 'finishing-safety',
    prompt: 'You are applying a water-based polyurethane finish indoors in your workshop. What must you do?',
    options: [
      'Nothing special—it is water-based so it is safe',
      'Open all windows for ventilation and wear a respirator rated for organic fumes',
      'Apply it quickly to minimize exposure',
      'Only apply it in sunlight',
    ],
    correct_answer: 'Open all windows for ventilation and wear a respirator rated for organic fumes',
    explanation: 'Even water-based finishes release VOCs. Proper ventilation is essential. A respirator protects you from organic vapor exposure. Never ignore ventilation for water-based products.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q10',
    type: 'true_false',
    topic: 'kiln-dried',
    prompt: 'Kiln-dried timber is safer to use than green timber because it is more stable and less prone to binding or twisting during cutting.',
    correct_answer: 'true',
    explanation: 'Kiln drying removes internal moisture stresses. Kiln-dried timber is dimensionally stable and predictable, making it safer for machining. Green timber has uneven stresses that can cause dangerous kickback.',
    difficulty: 'easy',
  },
  {
    id: 'wws-q11',
    type: 'multiple_choice',
    topic: 'dust-extraction',
    prompt: 'Before starting work, you should check that the dust extraction system is:',
    options: [
      'Making a loud noise',
      'Connected but you do not need to verify it is running',
      'Running and all hoses are clear and connected securely',
      'Plugged in—you can turn it on later if needed',
    ],
    correct_answer: 'Running and all hoses are clear and connected securely',
    explanation: 'The system must be running BEFORE you start work. Blocked hoses reduce effectiveness. Loose connections waste suction. Always verify the system is operating properly before you begin.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q12',
    type: 'scenario',
    topic: 'exotic-woods-allergy',
    prompt: 'You start working with a new exotic wood and develop a skin rash and itchy eyes within an hour. What should you do?',
    options: [
      'Keep working—you will build tolerance',
      'Switch to a dust mask and continue',
      'Stop work, leave the area, wash your skin, and inform your teacher that you may have an allergy to this wood',
      'Take an antihistamine and continue',
    ],
    correct_answer: 'Stop work, leave the area, wash your skin, and inform your teacher that you may have an allergy to this wood',
    explanation: 'Allergic reactions can escalate. Once you develop a reaction, continued exposure worsens it. Always report allergic reactions and switch to a different wood species.',
    difficulty: 'hard',
  },
  {
    id: 'wws-q13',
    type: 'true_false',
    topic: 'grain-direction',
    prompt: 'When sawing, cutting against the grain is safer than with the grain because it produces less dust.',
    correct_answer: 'false',
    explanation: 'Grain direction affects how the wood cuts and can influence binding, but it does not reduce dust production. Both directions produce dust; extraction is equally important for both.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q14',
    type: 'multiple_choice',
    topic: 'finish-application',
    prompt: 'When applying a lacquer finish, what is the greatest respiratory hazard?',
    options: [
      'The water content',
      'The dust particles in the spray',
      'Volatile organic compounds (VOCs) that off-gas from the finish',
      'The color pigments',
    ],
    correct_answer: 'Volatile organic compounds (VOCs) that off-gas from the finish',
    explanation: 'Lacquers are high in VOCs. These compounds evaporate and are inhaled, causing respiratory irritation and systemic effects. A respirator with organic vapor cartridges is essential.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q15',
    type: 'scenario',
    topic: 'sawdust-storage',
    prompt: 'You have collected a large pile of fresh sawdust and want to store it for later use as animal bedding. How should you store it?',
    options: [
      'In an open pile in the corner of the workshop',
      'In a sealed container in a dry area, well away from ignition sources',
      'Under a tarp to keep it clean',
      'In cardboard boxes stacked as high as possible',
    ],
    correct_answer: 'In a sealed container in a dry area, well away from ignition sources',
    explanation: 'Sawdust is a dust explosion hazard. Fine dust suspended in air ignites easily near heat or spark. Sealed containers prevent dust from dispersing. Keep it away from heaters, grinders, and electrical equipment.',
    difficulty: 'hard',
  },
  {
    id: 'wws-q16',
    type: 'true_false',
    topic: 'respirator-use',
    prompt: 'A respirator with an organic vapor cartridge will protect you from wood dust.',
    correct_answer: 'false',
    explanation: 'Organic vapor cartridges protect from chemical fumes, not dust. You need a PARTICULATE filter (P100) for dust, or a combination filter for both dust and fumes.',
    difficulty: 'hard',
  },
  {
    id: 'wws-q17',
    type: 'multiple_choice',
    topic: 'timber-hazards',
    prompt: 'What is the main reason to never apply water-based finishes near ignition sources even though they are water-based?',
    options: [
      'Water conducts electricity',
      'They still release flammable VOCs while wet, and some components are flammable',
      'Water expands and damages the finish',
      'They are not actually water-based',
    ],
    correct_answer: 'They still release flammable VOCs while wet, and some components are flammable',
    explanation: 'Water-based finishes contain flammable solvents beyond just water. While curing (which takes hours), they release VOCs and are flammable. Never cure near heaters or open flames.',
    difficulty: 'hard',
  },
  {
    id: 'wws-q18',
    type: 'scenario',
    topic: 'dust-control',
    prompt: 'You are hand-sanding a rough piece of softwood. The dust extraction hose is at your workbench. What should you do for safety?',
    options: [
      'Sand without the hose—hand sanding produces minimal dust',
      'Sand quickly to reduce total dust exposure time',
      'Position the extraction hose near the sanding area and wear an N95 mask',
      'Open a window and sand without a mask',
    ],
    correct_answer: 'Position the extraction hose near the sanding area and wear an N95 mask',
    explanation: 'Even hand-sanding produces significant dust. Position the extraction hose as close as possible to where dust is created. The mask provides a backup layer of protection.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q19',
    type: 'true_false',
    topic: 'timber-types',
    prompt: 'Hardwoods are called "hard" because they are harder to cut, but they do not produce more dust than softwoods.',
    correct_answer: 'false',
    explanation: 'Hardwoods are harder to machine AND they produce more and finer dust particles. Fine dust is more harmful because it penetrates deeper into lungs.',
    difficulty: 'medium',
  },
  {
    id: 'wws-q20',
    type: 'multiple_choice',
    topic: 'wood-safety-overview',
    prompt: 'Which of the following is NOT a typical wood workshop hazard?',
    options: [
      'Dust inhalation from sanding and sawing',
      'Splinters from handling untreated wood',
      'Electrical shock from wood dust',
      'Toxic fume exposure from finishes',
    ],
    correct_answer: 'Electrical shock from wood dust',
    explanation: 'While dust is conductive and can cause equipment problems, immediate electrical shock is not a typical wood workshop hazard. The main hazards are dust, splinters, finishes, and physical injuries.',
    difficulty: 'easy',
  },
];

// ============================================================================
// BADGE 5: METAL WORKSHOP SAFETY (TIER 2)
// ============================================================================

const metalWorkshopSafetyLearn: LearnCard[] = [
  {
    title: 'Hot Metal Hazards & Burns',
    content: 'Metal retains heat for a long time after cutting or forging. You cannot tell by looking if metal is hot enough to cause severe burns. Always treat freshly machined metal as hot. Use tongs, heat-proof gloves, or a heat gun to test temperature. Allow metal to cool in a designated area away from the work surface. Never touch heated metal or let it contact other materials.',
    icon: '🔥',
  },
  {
    title: 'Swarf & Sharp Edges Hazards',
    content: 'Swarf (metal chips) are extremely sharp and can cause deep lacerations. Never touch swarf with bare hands—use a brush or magnet to collect it. Wear cut-resistant gloves when handling. Deburred edges are essential before handling finished parts. Always check for burrs by running your finger carefully along the edge with the back of a gloved hand.',
    icon: '⚡',
  },
  {
    title: 'Cutting Fluid & Chemical Safety',
    content: 'Cutting fluids cool the tool and workpiece while preventing rust. They can cause skin irritation or sensitization with repeated contact. Wear gloves when handling. Some fluids are flammable near heat sources. Read the safety data sheet (SDS) for each fluid. Dispose of used fluids properly—never pour down the drain. Wash hands thoroughly after contact.',
    icon: '🧪',
  },
  {
    title: 'Grinding & Spark Safety',
    content: 'Angle grinders produce sparks at high velocity that can cause burns and ignite flammable materials. Always wear a face shield (not just glasses) and heat-resistant gloves. Keep hair tied back and wear long sleeves of fire-resistant material. Never grind near flammable materials or solvents. Check the wheel for damage before starting—a broken wheel can explode.',
    icon: '✨',
  },
  {
    title: 'Welding Flash & Safety Protocols',
    content: 'Welding produces intense UV radiation (welding flash) that can burn eyes even through eyelids, causing painful arc eye. Always wear a properly shaded welding helmet with a #10-12 lens. Bystanders must wear approved eye protection too. Welding smoke contains hazardous fumes—work in a ventilated area or use a welding hood with fume extraction. Wear fire-resistant clothing (leather apron, closed-toe shoes, no synthetics).',
    icon: '👁️',
  },
];

const metalWorkshopSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'mws-q01',
    type: 'multiple_choice',
    topic: 'hot-metal',
    prompt: 'After machining a piece of steel, how do you safely determine if it is cool enough to touch?',
    options: [
      'Look at it—if it looks cool, it is cool',
      'Wait a specific time based on thickness',
      'Use a heat gun or thermal camera to check temperature, or use tongs to handle it',
      'Touch it briefly with one finger',
    ],
    correct_answer: 'Use a heat gun or thermal camera to check temperature, or use tongs to handle it',
    explanation: 'Metal can remain hot long after machining. You cannot determine temperature by looking. A heat gun or thermal camera gives accurate readings. Tongs keep you safe while handling.',
    difficulty: 'easy',
  },
  {
    id: 'mws-q02',
    type: 'true_false',
    topic: 'swarf-hazards',
    prompt: 'Metal swarf (chips) can be handled safely with bare hands as long as you are careful.',
    correct_answer: 'false',
    explanation: 'Swarf is extremely sharp and can cause deep cuts and infections. Always wear cut-resistant gloves or use a brush/magnet to collect chips. Never touch swarf with bare hands.',
    difficulty: 'easy',
  },
  {
    id: 'mws-q03',
    type: 'scenario',
    topic: 'swarf-collection',
    prompt: 'You have just finished turning a piece of aluminum on a lathe. There is a pile of shiny aluminum swarf around the workpiece. What is the safest way to clean it up?',
    options: [
      'Brush it with your hand to move it off the machine',
      'Use a brush or plastic scraper while wearing cut-resistant gloves',
      'Blow it away with compressed air to see if it scatters easily',
      'Pick up individual pieces by hand carefully',
    ],
    correct_answer: 'Use a brush or plastic scraper while wearing cut-resistant gloves',
    explanation: 'A brush or scraper allows you to move swarf safely without direct contact. Cut-resistant gloves protect if you do accidentally touch it. Never use compressed air as that spreads fine particles.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q04',
    type: 'true_false',
    topic: 'cutting-fluid',
    prompt: 'Cutting fluid is only a cooling agent and has no health hazards.',
    correct_answer: 'false',
    explanation: 'Cutting fluids can cause skin irritation, sensitization, and allergic reactions. Some are flammable. Always read the SDS, wear gloves, and wash hands after handling.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q05',
    type: 'multiple_choice',
    topic: 'deburring',
    prompt: 'Before handing a finished metal part to a classmate, what must you do?',
    options: [
      'Nothing—it is ready as-is',
      'Sand it smooth',
      'Inspect it for burrs and deburr all sharp edges before handling or passing it to others',
      'Paint it to cover sharp edges',
    ],
    correct_answer: 'Inspect it for burrs and deburr all sharp edges before handling or passing it to others',
    explanation: 'Burrs are razor-sharp and can cause deep cuts. Deburring (using a file, sandpaper, or specialized tool) is essential before anyone handles the part safely.',
    difficulty: 'easy',
  },
  {
    id: 'mws-q06',
    type: 'scenario',
    topic: 'grinding-safety',
    prompt: 'You are about to use an angle grinder to cut a piece of steel. You put on safety glasses and start. What is wrong with this setup?',
    options: [
      'Nothing—safety glasses are sufficient',
      'You should wear a face shield instead of just glasses, and check the grinder wheel for damage',
      'You should wear earplugs',
      'You should wet the steel first',
    ],
    correct_answer: 'You should wear a face shield instead of just glasses, and check the grinder wheel for damage',
    explanation: 'Angle grinders produce sparks at high velocity. A face shield (not just glasses) protects larger areas. Always inspect the wheel for cracks—a broken wheel can explode. Hearing protection is also wise.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q07',
    type: 'true_false',
    topic: 'welding-flash',
    prompt: 'Welding flash (arc eye) can burn your eyes even if you close your eyelids.',
    correct_answer: 'true',
    explanation: 'Welding produces intense UV radiation that penetrates eyelids. Only a proper welding helmet with the correct shade (typically #10-12) blocks this radiation adequately.',
    difficulty: 'easy',
  },
  {
    id: 'mws-q08',
    type: 'multiple_choice',
    topic: 'wheel-inspection',
    prompt: 'Before using a bench grinder, you notice a small crack in the wheel. What should you do?',
    options: [
      'Use it anyway—small cracks are normal',
      'Sand down the crack to smooth it',
      'Report it to your teacher immediately and do not use the grinder until the wheel is replaced',
      'Use it for one final project',
    ],
    correct_answer: 'Report it to your teacher immediately and do not use the grinder until the wheel is replaced',
    explanation: 'A cracked wheel can disintegrate at high speed, sending fragments at lethal velocity. Never use damaged wheels. They must be replaced by authorized personnel.',
    difficulty: 'hard',
  },
  {
    id: 'mws-q09',
    type: 'scenario',
    topic: 'heat-resistant-gear',
    prompt: 'You are about to use an arc welder. Which clothing is most appropriate?',
    options: [
      'A cotton t-shirt and jeans',
      'A leather apron, long-sleeved fire-resistant shirt, closed-toe shoes, and leather gloves',
      'A synthetic fleece jacket for warmth',
      'Shorts and sandals for comfort',
    ],
    correct_answer: 'A leather apron, long-sleeved fire-resistant shirt, closed-toe shoes, and leather gloves',
    explanation: 'Synthetic fabrics melt in heat and spark exposure. Leather and fire-resistant materials protect from burns and sparks. An apron adds extra protection to the torso.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q10',
    type: 'true_false',
    topic: 'spark-hazards',
    prompt: 'When grinding metal, sparks can ignite materials across the room from where you are working.',
    correct_answer: 'true',
    explanation: 'Sparks can travel several meters at high velocity and retain heat. Always clear the area around your grinding station of flammable materials (paper, cloth, solvents).',
    difficulty: 'medium',
  },
  {
    id: 'mws-q11',
    type: 'multiple_choice',
    topic: 'metal-dust',
    prompt: 'Metal dust from grinding and machining is hazardous because:',
    options: [
      'It is heavy and settles quickly',
      'It makes hands dirty',
      'It can cause respiratory irritation and some metals (beryllium, cobalt) are toxic; extraction is necessary',
      'It smells bad',
    ],
    correct_answer: 'It can cause respiratory irritation and some metals (beryllium, cobalt) are toxic; extraction is necessary',
    explanation: 'Metal dust is a respiratory hazard. Some metals are highly toxic. Always use dust extraction when grinding or machining. Wear a dust mask if extraction is not available.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q12',
    type: 'scenario',
    topic: 'quenching-safety',
    prompt: 'You have just heat-treated a piece of steel and need to quench it in oil. What precaution must you take?',
    options: [
      'Work quickly to minimize exposure',
      'Use only deionized water for quenching',
      'Ensure the oil is not near a heat source or flames, and wear gloves and face protection to protect from violent steam/oil reactions',
      'Quench it in ice water instead',
    ],
    correct_answer: 'Ensure the oil is not near a heat source or flames, and wear gloves and face protection to protect from violent steam/oil reactions',
    explanation: 'Quenching hot metal in oil can cause violent reactions and splashing. Oil near heat is a fire hazard. Always keep the quench area clear of ignition sources and wear protection.',
    difficulty: 'hard',
  },
  {
    id: 'mws-q13',
    type: 'true_false',
    topic: 'cutting-fluid-disposal',
    prompt: 'Used cutting fluid can be poured down the drain because it is a liquid.',
    correct_answer: 'false',
    explanation: 'Used cutting fluids contain metal particles and contaminants. Pouring them down the drain pollutes water systems. They must be disposed of in designated waste containers or recycled properly.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q14',
    type: 'multiple_choice',
    topic: 'welding-fumes',
    prompt: 'Why is ventilation or a welding fume extraction hood essential when welding?',
    options: [
      'To keep the area cool',
      'To remove smoke so you can see the weld',
      'To extract hazardous fumes (manganese, fluorine compounds, ozone) that damage the respiratory system',
      'To meet safety regulations only',
    ],
    correct_answer: 'To extract hazardous fumes (manganese, fluorine compounds, ozone) that damage the respiratory system',
    explanation: 'Welding smoke contains toxic metals and fluorine compounds. Chronic exposure causes manganism (similar to Parkinson\'s) and lung disease. Extraction is non-negotiable.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q15',
    type: 'scenario',
    topic: 'cool-metal-handling',
    prompt: 'You just finished forging a piece and it looks cool. Your classmate reaches out to touch it. What should you do?',
    options: [
      'Let them—if it looks cool, it is cool',
      'Warn them immediately that it retains heat and hand them tongs or heat-proof gloves to handle it safely',
      'Tell them to wait until it cools naturally without touching it',
      'Touch it yourself first to test',
    ],
    correct_answer: 'Warn them immediately that it retains heat and hand them tongs or heat-proof gloves to handle it safely',
    explanation: 'Forged metal stays hot for a long time. A third-degree burn can happen in seconds. Always warn others and provide safe handling tools.',
    difficulty: 'easy',
  },
  {
    id: 'mws-q16',
    type: 'true_false',
    topic: 'grinding-attire',
    prompt: 'Loose clothing and jewelry are acceptable when grinding because they do not come into contact with the wheel.',
    correct_answer: 'false',
    explanation: 'Loose clothing and jewelry can catch on the wheel. Always wear fitted clothing and remove jewelry. Tie back long hair. Grinders are powerful machines that catch and entangle quickly.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q17',
    type: 'multiple_choice',
    topic: 'beryllium-safety',
    prompt: 'If you are working with beryllium-copper alloys, what extra precaution is necessary?',
    options: [
      'No extra precautions—it is just another metal',
      'Wear a P100 dust mask and use local exhaust ventilation because beryllium dust is extremely toxic and causes chronic beryllium disease',
      'Avoid touching it with bare hands',
      'Work in a well-lit area',
    ],
    correct_answer: 'Wear a P100 dust mask and use local exhaust ventilation because beryllium dust is extremely toxic and causes chronic beryllium disease',
    explanation: 'Beryllium is one of the most toxic metals. Inhalation of dust causes chronic beryllium disease, a serious lung condition. Always follow strict ventilation protocols.',
    difficulty: 'hard',
  },
  {
    id: 'mws-q18',
    type: 'scenario',
    topic: 'spark-control',
    prompt: 'You are about to grind a large piece of steel at your workbench. You notice cans of paint thinner on the shelf nearby. What should you do?',
    options: [
      'Move the thinner to the other side of the room so you can see it',
      'Put the thinner in a cabinet or move it outside the workshop before grinding',
      'Use the grinder carefully and avoid making sparks',
      'Only grind for a short time to limit spark production',
    ],
    correct_answer: 'Put the thinner in a cabinet or move it outside the workshop before grinding',
    explanation: 'Paint thinner is highly flammable. A single spark can ignite it. Always remove flammable materials before grinding. This is non-negotiable.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q19',
    type: 'true_false',
    topic: 'sds-importance',
    prompt: 'You do not need to read the Safety Data Sheet (SDS) for a cutting fluid if you have used it before.',
    correct_answer: 'false',
    explanation: 'Even if you have used a product before, the SDS is essential. Formulations change, and the SDS provides disposal, hazard, and emergency information you need for safety.',
    difficulty: 'medium',
  },
  {
    id: 'mws-q20',
    type: 'multiple_choice',
    topic: 'metal-workshop-overview',
    prompt: 'Which of the following is the PRIMARY cause of severe burns in metal workshops?',
    options: [
      'Sparks from grinding',
      'Contact with hot metal that retains heat for long periods',
      'Cutting fluid splashing',
      'Welding fumes',
    ],
    correct_answer: 'Contact with hot metal that retains heat for long periods',
    explanation: 'Metal retains heat well and can cause severe third-degree burns long after machining or forging. Always treat freshly machined metal as hot.',
    difficulty: 'easy',
  },
];

// ============================================================================
// BADGE 6: PLASTICS & COMPOSITES SAFETY (TIER 2)
// ============================================================================

const plasticsCompositesSafetyLearn: LearnCard[] = [
  {
    title: 'Fume Extraction & Ventilation',
    content: 'Working with plastics and composites releases volatile organic compounds (VOCs) and toxic fumes. Thermoplastics release styrene (irritant), and epoxy resins release formaldehyde. Always work with active fume extraction running directly over the work area. Open windows and maintain cross-ventilation. Wear a respirator rated for organic vapors if working in a small space.',
    icon: '💨',
  },
  {
    title: 'Chemical Hazards: Resins, Solvents & Hardeners',
    content: 'Epoxy resins, polyester resins, and hardeners are hazardous. Hardeners are particularly caustic and can cause chemical burns. Always wear nitrile gloves (latex does not protect). Never mix resin and hardener until immediately before use. Some hardeners generate heat—never seal the container while reactions are occurring. Read the SDS for each chemical. Acetone and other solvents are flammable and toxic—use in ventilated areas only.',
    icon: '🧪',
  },
  {
    title: 'Heat Hazards & Heat Guns',
    content: 'Heat guns for softening plastics reach 500°C+ and cause severe burns instantly. Never point a heat gun at skin or leave it unattended. Place it on a non-flammable surface to cool. Keep flammable materials (paper, cloth, solvents) away from the heating area. Thermoplastics produce toxic fumes when overheated—use the lowest effective temperature and never heat above material specifications.',
    icon: '🔥',
  },
  {
    title: 'Dust & Particulates from Machining',
    content: 'Sanding, cutting, and machining plastics and composites produces fine dust and particles. Fiberglass dust is extremely irritating to skin and lungs. Wear gloves, a long-sleeved shirt, and a dust mask when sanding or machining. Use dust extraction on sanders and saws. After finishing, shower or wash thoroughly to remove all fiberglass particles—leaving them on skin causes irritation for hours.',
    icon: '✨',
  },
  {
    title: 'Safe Material Handling & Storage',
    content: 'Store resins and hardeners in airtight containers in a cool area away from heat and light. Expired resin becomes more hazardous—check expiry dates. Never store near incompatible chemicals (for example, epoxy away from amines). Keep materials away from children and pets. Label all containers clearly. Some plastics degrade in sunlight, so store in opaque containers.',
    icon: '📦',
  },
];

const plasticsCompositesSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'pcs-q01',
    type: 'multiple_choice',
    topic: 'fumes-ventilation',
    prompt: 'Why is fume extraction essential when laying up fiberglass or epoxy composite parts?',
    options: [
      'To keep the area smelling fresh',
      'To remove styrene, formaldehyde, and other VOCs that are respiratory irritants and toxic',
      'To cool the materials',
      'To prevent the resin from drying too quickly',
    ],
    correct_answer: 'To remove styrene, formaldehyde, and other VOCs that are respiratory irritants and toxic',
    explanation: 'Epoxy and polyester resins release hazardous VOCs during curing. Chronic exposure causes respiratory disease. Fume extraction or respiratory protection is non-negotiable.',
    difficulty: 'easy',
  },
  {
    id: 'pcs-q02',
    type: 'true_false',
    topic: 'resin-chemicals',
    prompt: 'You can mix epoxy resin and hardener and store the mixture for later use.',
    correct_answer: 'false',
    explanation: 'The exothermic reaction begins immediately upon mixing. The mixture heats up, accelerating the cure, and can boil or generate dangerous vapors. Mix only what you need immediately before application.',
    difficulty: 'easy',
  },
  {
    id: 'pcs-q03',
    type: 'scenario',
    topic: 'heat-gun-safety',
    prompt: 'You are using a heat gun to soften acrylic for bending. You finish the work and set the heat gun on your bench. What is wrong with this?',
    options: [
      'Nothing—heat guns cool down quickly',
      'The gun is still dangerously hot and can ignite nearby materials or burn someone who accidentally touches it',
      'You should leave it running to keep it warm',
      'Nothing if you turn off the power',
    ],
    correct_answer: 'The gun is still dangerously hot and can ignite nearby materials or burn someone who accidentally touches it',
    explanation: 'Heat guns remain hot (500°C+ at the nozzle) for several minutes after turning off. Always place them on a heat-resistant surface away from flammable materials and people.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q04',
    type: 'true_false',
    topic: 'glove-selection',
    prompt: 'Latex gloves provide adequate protection against epoxy resins and hardeners.',
    correct_answer: 'false',
    explanation: 'Latex does not resist epoxy or hardeners. You need nitrile (and sometimes double-gloving) for adequate protection. Always check the SDS for glove recommendations.',
    difficulty: 'easy',
  },
  {
    id: 'pcs-q05',
    type: 'multiple_choice',
    topic: 'fiberglass-dust',
    prompt: 'After sanding fiberglass composite, why is it important to shower or wash thoroughly?',
    options: [
      'To remove the smell',
      'To prevent rust on tools',
      'Fiberglass dust particles cause intense itching and skin irritation if left on skin',
      'To clean the workspace',
    ],
    correct_answer: 'Fiberglass dust particles cause intense itching and skin irritation if left on skin',
    explanation: 'Fiberglass fibers embed in skin and cause microscopic cuts and extreme itching. Thorough washing with soap and water (not just brushing) removes all particles.',
    difficulty: 'easy',
  },
  {
    id: 'pcs-q06',
    type: 'scenario',
    topic: 'resin-storage',
    prompt: 'You have opened a can of epoxy hardener but only used a small amount. How should you store the remainder?',
    options: [
      'In the original open container on your shelf',
      'Sealed tightly in the original container in a cool, dark place away from heat and incompatible materials',
      'Transfer it to a plastic bag and refrigerate it',
      'Mix it with resin to prevent it from going bad',
    ],
    correct_answer: 'Sealed tightly in the original container in a cool, dark place away from heat and incompatible materials',
    explanation: 'Hardeners are moisture-sensitive and volatile. Tight sealing prevents moisture absorption and off-gassing. Cool temperatures slow degradation.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q07',
    type: 'true_false',
    topic: 'thermoplastic-overheating',
    prompt: 'Thermoplastics can be heated to any temperature as long as they do not catch fire.',
    correct_answer: 'false',
    explanation: 'Overheating thermoplastics causes them to release toxic gases (styrene, formaldehyde) and degrade. Always use the lowest effective temperature and follow material specifications.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q08',
    type: 'multiple_choice',
    topic: 'solvent-safety',
    prompt: 'What is the primary hazard when using acetone or other strong solvents to clean composite parts?',
    options: [
      'They make your hands smell bad',
      'They remove paint from walls',
      'They are highly flammable and their vapors are explosive—always use in a ventilated area away from ignition sources',
      'They dissolve plastic permanently',
    ],
    correct_answer: 'They are highly flammable and their vapors are explosive—always use in a ventilated area away from ignition sources',
    explanation: 'Acetone and other solvents have very low flashpoints. A spark or open flame ignites their vapors explosively. Always work outdoors or in a fume hood. Never use near heat sources.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q09',
    type: 'scenario',
    topic: 'chemical-burns',
    prompt: 'You accidentally splash epoxy hardener on your arm. What is the first aid response?',
    options: [
      'Wipe it off with a cloth and apply antibiotic cream',
      'Immediately flush with copious amounts of water for at least 15 minutes and then seek medical attention',
      'Apply ice to the area',
      'Leave it alone—epoxy is not hazardous',
    ],
    correct_answer: 'Immediately flush with copious amounts of water for at least 15 minutes and then seek medical attention',
    explanation: 'Hardeners are caustic and cause chemical burns. Immediate water flushing dilutes and removes the chemical. Medical attention is necessary to prevent permanent scarring.',
    difficulty: 'hard',
  },
  {
    id: 'pcs-q10',
    type: 'true_false',
    topic: 'fume-hood-optional',
    prompt: 'Fume extraction is optional if you work quickly when applying epoxy resin.',
    correct_answer: 'false',
    explanation: 'Exposure time and concentration both matter. Even brief exposure to high concentrations is hazardous. Fume extraction or respirator protection is always required.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q11',
    type: 'multiple_choice',
    topic: 'resin-expiry',
    prompt: 'You find a can of epoxy resin that expired 6 months ago. Should you use it?',
    options: [
      'Yes, expiry dates are just guidelines',
      'No—expired resin becomes unstable and more hazardous. It should be disposed of according to regulations',
      'Yes, if it still smells like epoxy',
      'Only for non-critical applications',
    ],
    correct_answer: 'No—expired resin becomes unstable and more hazardous. It should be disposed of according to regulations',
    explanation: 'Expired resins may have separated, crystallized, or chemically degraded. Using them produces unpredictable curing and increased off-gassing. Always dispose of expired materials properly.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q12',
    type: 'scenario',
    topic: 'heat-gun-flammables',
    prompt: 'You are about to use a heat gun near a shelf containing paper scraps and cloth rags. What precaution is necessary?',
    options: [
      'Just move the heat gun away from the shelf when you are not using it',
      'Remove all flammable materials from the area before using the heat gun',
      'Keep a fire extinguisher nearby',
      'Use a lower heat setting to reduce risk',
    ],
    correct_answer: 'Remove all flammable materials from the area before using the heat gun',
    explanation: 'Heat guns reach extreme temperatures. Paper and cloth ignite easily. Always clear the area of flammables before starting.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q13',
    type: 'true_false',
    topic: 'skin-contact-safe',
    prompt: 'Brief skin contact with epoxy resin is safe because it does not dissolve skin immediately.',
    correct_answer: 'false',
    explanation: 'Even brief contact can cause sensitization (allergic reaction that worsens with each exposure) and dermatitis. Always wear gloves and wash immediately if contact occurs.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q14',
    type: 'multiple_choice',
    topic: 'respirator-type',
    prompt: 'If working with epoxy fumes in a small enclosed space without mechanical ventilation, what type of respirator is appropriate?',
    options: [
      'A paper dust mask (N95)',
      'A respirator with organic vapor cartridges rated for the specific chemicals',
      'No protection is needed for epoxy',
      'A surgical mask',
    ],
    correct_answer: 'A respirator with organic vapor cartridges rated for the specific chemicals',
    explanation: 'Epoxy fumes are organic compounds. A respirator must have organic vapor cartridges, not just dust filters. Always match the respirator to the hazard.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q15',
    type: 'scenario',
    topic: 'resin-mixing-reaction',
    prompt: 'You mix epoxy resin and hardener and notice the container becoming very hot. What should you do?',
    options: [
      'Seal the container tightly to keep the heat in',
      'Pour it out immediately into a wide, shallow container in a ventilated area—do not seal it',
      'Add cold water to cool it down',
      'Refrigerate the sealed container',
    ],
    correct_answer: 'Pour it out immediately into a wide, shallow container in a ventilated area—do not seal it',
    explanation: 'The exothermic reaction generates heat. Sealing it traps gases and increases pressure—risk of explosion. Spreading the mixture dissipates heat and allows gases to escape.',
    difficulty: 'hard',
  },
  {
    id: 'pcs-q16',
    type: 'true_false',
    topic: 'dust-protection',
    prompt: 'When sanding fiberglass, a dust mask is the only protection you need.',
    correct_answer: 'false',
    explanation: 'A mask protects lungs, but fiberglass dust also irritates skin. Wear long sleeves, gloves, and a dust mask. Shower immediately after to remove all particles.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q17',
    type: 'multiple_choice',
    topic: 'plastic-temperature-limits',
    prompt: 'Why should you never exceed the specified temperature when heating thermoplastics?',
    options: [
      'It is wasteful of energy',
      'It might melt the plastic completely',
      'Overheating causes degradation and release of toxic gases; it reduces material strength',
      'It takes longer to cool down',
    ],
    correct_answer: 'Overheating causes degradation and release of toxic gases; it reduces material strength',
    explanation: 'Each plastic has a safe working temperature range. Exceeding it causes off-gassing and material degradation. Follow the manufacturer\'s specifications.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q18',
    type: 'scenario',
    topic: 'composite-working-area',
    prompt: 'You are laying up a large fiberglass composite part indoors. You have fume extraction running, but windows are closed and other students are in the room. What should you do?',
    options: [
      'Continue—the fume extraction is enough',
      'Open windows to provide cross-ventilation and ask other students to work in a different area',
      'Wear a respirator instead of opening windows',
      'Work faster to finish before vapors build up',
    ],
    correct_answer: 'Open windows to provide cross-ventilation and ask other students to work in a different area',
    explanation: 'Ventilation and displacement of hazardous air are essential. Opening windows creates cross-ventilation. Others should not be exposed to the vapors.',
    difficulty: 'medium',
  },
  {
    id: 'pcs-q19',
    type: 'true_false',
    topic: 'incompatible-storage',
    prompt: 'You can store epoxy hardener next to amines and other nitrogen-based chemicals without concern.',
    correct_answer: 'false',
    explanation: 'Some hardeners ARE amines (reactive nitrogen compounds). Mixing incompatible chemicals can cause exothermic reactions. Always read the SDS and store separately.',
    difficulty: 'hard',
  },
  {
    id: 'pcs-q20',
    type: 'multiple_choice',
    topic: 'composite-overview',
    prompt: 'Which of the following is NOT a typical hazard in plastics and composites work?',
    options: [
      'Fume exposure from resins',
      'Chemical burns from hardeners',
      'Heat exposure from machinery',
      'Dust inhalation from cutting and sanding',
    ],
    correct_answer: 'Heat exposure from machinery',
    explanation: 'The typical hazards are fumes, chemicals, fiberglass dust, and heat from tools (heat guns, not machinery). Cold machinery is not inherently a hazard in composites work.',
    difficulty: 'easy',
  },
];

// ============================================================================
// BADGE 7: ELECTRONICS & SOLDERING SAFETY (TIER 2)
// ============================================================================

const electronicsSolderingSafetyLearn: LearnCard[] = [
  {
    title: 'Electrical Safety Basics',
    content: 'Never work on circuits while they are powered. Even 12V DC can be dangerous near eyes or wet skin. Always disconnect power before troubleshooting or modifying circuits. High-voltage supplies (above 50V) can cause serious shock or electrocution. Treat all circuits as live until you have verified with a multimeter that power is off.',
    icon: '⚡',
  },
  {
    title: 'Soldering Iron Burn Prevention',
    content: 'Soldering irons reach 300-400°C and cause instant third-degree burns. Always rest the iron on a stand, never on your lap or near edges where it can fall. When not actively soldering, place the iron on its stand—never put it down on the bench. Keep your hands steady and never reach across the iron\'s path. Use a wet sponge or brass wool to clean the tip safely.',
    icon: '🔥',
  },
  {
    title: 'Flux Fumes & Respiratory Protection',
    content: 'Soldering flux produces irritating fumes (aldehydes and other organic compounds). Always use fume extraction directly above or beside the soldering area. In confined spaces, wear a respirator rated for organic fumes. Some lead-free solders require even better extraction because they off-gas differently. Never inhale flux fumes deliberately—they cause respiratory irritation and asthma-like symptoms.',
    icon: '💨',
  },
  {
    title: 'Battery & Component Hazards',
    content: 'Lithium batteries can explode or catch fire if short-circuited or overcharged. Capacitors retain charge even after power is off—discharge them safely before handling. Component leads are sharp and can cause cuts. Trim leads carefully and dispose of safely. Never reverse the polarity of power to circuits—it damages components and can cause overheating or fire.',
    icon: '🔋',
  },
  {
    title: 'Wire Stripping & Lead Handling',
    content: 'Wire strippers can cause cuts if you slip. Always strip away from your body and hands. Component leads (especially from integrated circuits) are razor-sharp. Handle carefully and wear gloves if you are working with many components. When trimming leads, eye protection prevents flying bits from hitting your eyes. Never test sharp edges by touching them—use a file or sandpaper.',
    icon: '✂️',
  },
];

const electronicsSolderingSafetyQuestions: BadgeQuestion[] = [
  {
    id: 'ess-q01',
    type: 'true_false',
    topic: 'electrical-safety',
    prompt: 'It is safe to work on a 12V DC circuit without disconnecting power because the voltage is low.',
    correct_answer: 'false',
    explanation: 'Even 12V DC can cause harm, especially near eyes, wet skin, or if you have a heart condition. Always disconnect power before modifying circuits. Treat all circuits as live until verified with a multimeter.',
    difficulty: 'easy',
  },
  {
    id: 'ess-q02',
    type: 'multiple_choice',
    topic: 'soldering-iron-safety',
    prompt: 'Where is the safest place to rest a soldering iron when you are not actively using it?',
    options: [
      'On your workbench near the solder',
      'On a dedicated soldering iron stand with a heat-resistant base',
      'In your hand while you fetch materials',
      'On a damp sponge to cool it',
    ],
    correct_answer: 'On a dedicated soldering iron stand with a heat-resistant base',
    explanation: 'A stand prevents the hot iron from falling or touching flammable materials. Leaving it on the bench or in your hand risks burns and fires.',
    difficulty: 'easy',
  },
  {
    id: 'ess-q03',
    type: 'scenario',
    topic: 'soldering-burn-risk',
    prompt: 'You are soldering a joint and your hand slips toward the iron. What should you do?',
    options: [
      'Stop and pull your hand away immediately, even if it interrupts the solder joint',
      'Try to finish the joint quickly and move your hand afterward',
      'Use your other hand to steady the iron',
      'Continue and be more careful next time',
    ],
    correct_answer: 'Stop and pull your hand away immediately, even if it interrupts the solder joint',
    explanation: 'A severe burn is worse than a failed solder joint. Always prioritize safety. If your hand is in danger, stop and move it to safety, even if it means redoing the joint.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q04',
    type: 'true_false',
    topic: 'flux-fumes',
    prompt: 'Flux fumes from soldering are harmless and do not require ventilation.',
    correct_answer: 'false',
    explanation: 'Flux releases organic compounds that irritate the respiratory system. Chronic exposure causes asthma-like symptoms. Always use fume extraction or work in a well-ventilated area.',
    difficulty: 'easy',
  },
  {
    id: 'ess-q05',
    type: 'multiple_choice',
    topic: 'capacitor-safety',
    prompt: 'What is the primary hazard when handling capacitors removed from a powered circuit?',
    options: [
      'They are fragile and break easily',
      'They retain an electrical charge even after power is turned off and can deliver a painful shock',
      'They are too small to handle safely',
      'They cause chemical burns',
    ],
    correct_answer: 'They retain an electrical charge even after power is turned off and can deliver a painful shock',
    explanation: 'Large capacitors can store dangerous amounts of charge. Always discharge them safely (short the leads together with an insulated tool) before handling or measuring.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q06',
    type: 'scenario',
    topic: 'battery-hazard',
    prompt: 'You are testing a lithium battery circuit and accidentally reverse the polarity. What happens?',
    options: [
      'Nothing—reversing polarity is harmless',
      'The circuit simply does not work',
      'The battery can overheat, explode, or catch fire; stop immediately and check for damage',
      'Only the battery drains faster',
    ],
    correct_answer: 'The battery can overheat, explode, or catch fire; stop immediately and check for damage',
    explanation: 'Reverse polarity to lithium batteries causes internal short circuits and rapid heating. Always verify polarity before connecting power. Uncontrolled thermal runaway can cause fires.',
    difficulty: 'hard',
  },
  {
    id: 'ess-q07',
    type: 'true_false',
    topic: 'high-voltage',
    prompt: 'A power supply rated at 50V is safe to touch with wet hands.',
    correct_answer: 'false',
    explanation: 'At 50V with wet skin, current can flow through your heart and cause fibrillation (cardiac arrest). Always dry hands, and for supplies above 50V, exercise extreme caution and never touch terminals while powered.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q08',
    type: 'multiple_choice',
    topic: 'soldering-fume-extraction',
    prompt: 'If you are soldering in a small enclosed space without mechanical extraction, what is the safest approach?',
    options: [
      'Solder quickly to minimize exposure time',
      'Open a window to provide ventilation',
      'Wear a respirator rated for organic fumes and ensure windows are open',
      'Only solder outdoors',
    ],
    correct_answer: 'Wear a respirator rated for organic fumes and ensure windows are open',
    explanation: 'Both ventilation and respiratory protection are necessary in confined spaces. A respirator alone without ventilation is not sufficient because fumes accumulate.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q09',
    type: 'scenario',
    topic: 'component-lead-hazard',
    prompt: 'You have just trimmed component leads from a circuit board. Where should you dispose of the sharp clippings?',
    options: [
      'In the regular trash bin',
      'On the workbench where you trimmed them',
      'In a designated sharp/metal waste container where they cannot be accidentally touched',
      'In a sealed bag in the regular trash',
    ],
    correct_answer: 'In a designated sharp/metal waste container where they cannot be accidentally touched',
    explanation: 'Sharp clippings cause lacerations and puncture wounds. A designated container prevents accidental contact and aids proper recycling of scrap metal.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q10',
    type: 'true_false',
    topic: 'multimeter-verification',
    prompt: 'Before starting troubleshooting, you should verify that power is off using a multimeter across the main power rails.',
    correct_answer: 'true',
    explanation: 'A multimeter confirms voltage is zero. Never assume a circuit is off—always verify before touching internal components. This is a fundamental safety practice.',
    difficulty: 'easy',
  },
  {
    id: 'ess-q11',
    type: 'multiple_choice',
    topic: 'lead-free-solder',
    prompt: 'Lead-free solders are safer than lead-based solders because:',
    options: [
      'They never cause fume hazards',
      'They do not require flux',
      'They have higher melting points and may off-gas differently, requiring good ventilation',
      'They are non-toxic if ingested',
    ],
    correct_answer: 'They have higher melting points and may off-gas differently, requiring good ventilation',
    explanation: 'Lead-free solders melt at higher temperatures and some formulations release different fumes. Always verify ventilation requirements for the specific solder you are using.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q12',
    type: 'scenario',
    topic: 'wire-stripper-injury',
    prompt: 'You are stripping multiple wires and accidentally cut your finger with the stripper. What is the correct response?',
    options: [
      'Finish stripping all wires and bandage it later',
      'Immediately stop, apply pressure to the cut, and seek first aid or medical attention if needed',
      'Rinse with water and continue working',
      'Apply solder to seal the wound',
    ],
    correct_answer: 'Immediately stop, apply pressure to the cut, and seek first aid or medical attention if needed',
    explanation: 'Deep cuts from wire strippers require immediate attention. Pressure stops bleeding. If the cut is deep, stitches may be needed. Never ignore injuries.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q13',
    type: 'true_false',
    topic: 'soldering-speed',
    prompt: 'Soldering faster reduces fume exposure because you spend less time near the flux.',
    correct_answer: 'false',
    explanation: 'Soldering faster can increase temperature and fume production. Proper technique (correct iron temp, quality solder) and fume extraction are more important than speed.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q14',
    type: 'multiple_choice',
    topic: 'component-orientation',
    prompt: 'Which of the following is a consequence of installing a diode or LED with reversed polarity?',
    options: [
      'The circuit simply will not work',
      'The component becomes very hot, can damage nearby components, or catch fire',
      'The circuit is slightly less efficient',
      'Only the battery drains',
    ],
    correct_answer: 'The component becomes very hot, can damage nearby components, or catch fire',
    explanation: 'Reverse-biased diodes and LEDs conduct in the wrong direction, causing excessive current and heat. Always verify polarity before assembly.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q15',
    type: 'scenario',
    topic: 'iron-cleaning',
    prompt: 'You need to clean the soldering iron tip. The safest method is:',
    options: [
      'Wipe it on your sleeve or cloth',
      'Touch it to a wet cloth or brass wool briefly while the iron is on its stand',
      'Dip it in water',
      'Let it cool and scrape off buildup',
    ],
    correct_answer: 'Touch it to a wet cloth or brass wool briefly while the iron is on its stand',
    explanation: 'A wet sponge or brass wool removes oxidation safely. The iron must be on its stand to prevent burns or dropping. Dipping in water causes steam burns.',
    difficulty: 'easy',
  },
  {
    id: 'ess-q16',
    type: 'true_false',
    topic: 'bare-wire-handling',
    prompt: 'You can hold a bare wire and a power supply terminal simultaneously if you are not touching the other terminal.',
    correct_answer: 'false',
    explanation: 'You only need to complete a circuit to get shocked—you do not need to touch both terminals. Current flows through you if you bridge any two different potentials.',
    difficulty: 'hard',
  },
  {
    id: 'ess-q17',
    type: 'multiple_choice',
    topic: 'soldering-temperature',
    prompt: 'What is a consequence of using a soldering iron that is too cold (not hot enough)?',
    options: [
      'It is safer and produces less fumes',
      'It produces slow, weak solder joints (cold solder) that fail; this may lead to frustration and more exposure time',
      'It produces perfect joints because heat is reduced',
      'It prevents burning of the PCB board',
    ],
    correct_answer: 'It produces slow, weak solder joints (cold solder) that fail; this may lead to frustration and more exposure time',
    explanation: 'A cold iron takes longer to melt solder, increasing exposure time to flux fumes. It also produces weak joints that fail in use. The iron should be hot enough to melt solder in 2-3 seconds.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q18',
    type: 'scenario',
    topic: 'lithium-safety',
    prompt: 'You are charging a lithium-ion battery using a custom charger. The battery becomes very warm to the touch. What should you do?',
    options: [
      'Continue charging—warmth is normal',
      'Stop charging immediately, disconnect the battery, and let it cool in a safe place away from flammables',
      'Increase the charging current to finish faster',
      'Place the battery in water to cool it',
    ],
    correct_answer: 'Stop charging immediately, disconnect the battery, and let it cool in a safe place away from flammables',
    explanation: 'Excessive heat during charging indicates a malfunction (overcharge, short circuit, or defect). Continuing can cause thermal runaway and fire. Always stop and investigate.',
    difficulty: 'hard',
  },
  {
    id: 'ess-q19',
    type: 'true_false',
    topic: 'eye-protection-soldering',
    prompt: 'Eye protection is not necessary when soldering because the iron is not moving at high speed.',
    correct_answer: 'false',
    explanation: 'When clipping component leads or flux splattering, fragments can hit eyes. Safety glasses or a face shield protect against these hazards.',
    difficulty: 'medium',
  },
  {
    id: 'ess-q20',
    type: 'multiple_choice',
    topic: 'electronics-overview',
    prompt: 'Which of the following is the PRIMARY cause of electrocution hazards in electronics work?',
    options: [
      'Soldering irons',
      'Flux fumes',
      'Powered circuits (high-voltage supplies, charged capacitors, batteries)',
      'Sharp component leads',
    ],
    correct_answer: 'Powered circuits (high-voltage supplies, charged capacitors, batteries)',
    explanation: 'Electrical hazards come from live circuits and stored charge. Always verify power is off and capacitors are discharged before handling.',
    difficulty: 'easy',
  },
];

export const BUILT_IN_BADGES: BadgeDefinition[] = [
  {
    id: 'general-workshop-safety',
    name: 'General Workshop Safety',
    slug: 'general-workshop-safety',
    description: 'Master the fundamentals of workshop safety: understanding safety signs, using PPE correctly, reporting injuries, keeping your workspace clean, and understanding emergency procedures.',
    category: 'safety',
    tier: 1,
    color: '#059669',
    icon_name: 'shield-check',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 10,
    question_count: 12,
    topics: ['safety-signs', 'ppe', 'injury-reporting', 'eye-protection', 'ear-protection', 'housekeeping', 'emergency', 'dust-fumes', 'responsibility', 'floor-safety'],
    learn_content: generalWorkshopSafetyLearn,
    question_pool: generalWorkshopSafetyQuestions,
  },
  {
    id: 'hand-tool-safety',
    name: 'Hand Tool Safety',
    slug: 'hand-tool-safety',
    description: 'Learn to select, carry, and use hand tools safely. Master clamping, cutting away from your body, maintaining sharp tools, and proper storage to prevent cuts and injuries.',
    category: 'safety',
    tier: 1,
    color: '#059669',
    icon_name: 'wrench',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 10,
    question_count: 10,
    topics: ['tool-selection', 'carrying', 'clamping', 'sharpness', 'ppe', 'passing-tools', 'storage', 'maintenance'],
    learn_content: handToolSafetyLearn,
    question_pool: handToolSafetyQuestions,
  },
  {
    id: 'laser-cutter-safety',
    name: 'Laser Cutter Safety',
    slug: 'laser-cutter-safety',
    description: 'Safe operation of laser cutting and engraving equipment.',
    category: 'safety',
    tier: 2,
    color: '#FF8C42',
    icon_name: 'Zap',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    question_count: 12,
    topics: [
      'Equipment Operation',
      'Electrical Safety',
      'Fire Prevention',
      'Fume Extraction',
    ],
    learn_content: [
      {
        title: 'Laser Safety Basics',
        content:
          'Laser cutters produce a high-powered beam that can cause eye damage and burns. Never look into the laser or operate without proper training. Always wear protective eyewear rated for the specific laser wavelength.',
        icon: '👁️',
      },
      {
        title: 'Fire Prevention',
        content:
          'Laser cutting generates heat and can ignite materials. Always ensure the air assist is working. Never leave a running laser cutter unattended. Keep flammable materials away from the work area.',
        icon: '🔥',
      },
      {
        title: 'Fume Extraction',
        content:
          'Burning and vaporizing materials releases harmful fumes. Always ensure the fume extraction system is running before starting a cut. Ensure air intakes are clear and the system is functioning properly.',
        icon: '💨',
      },
      {
        title: 'Equipment Maintenance',
        content:
          'Dirty optics reduce cutting quality and can cause overheating. Regularly clean lenses as instructed. Check coolant levels and hoses before operation. Report any damage immediately.',
        icon: '🔧',
      },
    ],
    question_pool: [
      {
        id: 'lq1',
        type: 'true_false',
        topic: 'Equipment Operation',
        prompt: 'You can briefly look into a laser cutter if the laser is off.',
        correct_answer: 'false',
        explanation:
          'Never look into a laser cutter, even if it appears to be off. Some lasers can be accidentally triggered, and even reflected beams can cause eye damage.',
        difficulty: 'easy',
      },
      {
        id: 'lq2',
        type: 'multiple_choice',
        topic: 'Fire Prevention',
        prompt: 'What is the primary purpose of air assist in a laser cutter?',
        options: [
          'To cool the laser tube',
          'To blow away smoke and help prevent fires',
          'To speed up the cutting process',
          'To align the laser beam',
        ],
        correct_answer: 'To blow away smoke and help prevent fires',
        explanation:
          'Air assist blows compressed air onto the cut area, preventing materials from igniting and helping clear smoke. It\'s critical for safety.',
        difficulty: 'medium',
      },
      {
        id: 'lq3',
        type: 'scenario',
        topic: 'Equipment Operation',
        prompt:
          'The laser is running and the cutting seems slower than usual. What should you do?',
        options: [
          'Increase the power setting to compensate',
          'Stop the job, allow the laser to cool, and check for issues like dirty optics',
          'Continue and monitor the progress',
          'Open the lid to check what\'s happening',
        ],
        correct_answer: 'Stop the job, allow the laser to cool, and check for issues like dirty optics',
        explanation:
          'Reduced cutting speed often indicates dirty optics or laser tube issues. Stopping prevents damage and safety hazards. Opening the lid while the laser is active is dangerous.',
        difficulty: 'medium',
      },
      {
        id: 'lq4',
        type: 'true_false',
        topic: 'Fume Extraction',
        prompt: 'It\'s okay to operate a laser cutter without the fume extraction system running.',
        correct_answer: 'false',
        explanation:
          'The fume extraction system must always be running. Operating without it exposes you to harmful fumes and violates safety protocols.',
        difficulty: 'easy',
      },
      {
        id: 'lq5',
        type: 'multiple_choice',
        topic: 'Fire Prevention',
        prompt: 'What should you do if a small fire starts inside the laser cutter during operation?',
        options: [
          'Open the lid and try to extinguish it quickly',
          'Stop the laser immediately, close the lid to smother the flame, and call for help if it doesn\'t go out',
          'Leave the area and let someone else handle it',
          'Continue the job and monitor it',
        ],
        correct_answer: 'Stop the laser immediately, close the lid to smother the flame, and call for help if it doesn\'t go out',
        explanation:
          'Closing the lid removes oxygen and may extinguish the flame. Stopping immediately prevents further ignition. Never open the lid during a fire as this adds oxygen.',
        difficulty: 'hard',
      },
      {
        id: 'lq6',
        type: 'true_false',
        topic: 'Equipment Operation',
        prompt:
          'You can leave a laser cutter running while you step away to get another material.',
        correct_answer: 'false',
        explanation:
          'Never leave a running laser cutter unattended. Fires can start, and you won\'t be there to respond immediately.',
        difficulty: 'easy',
      },
      {
        id: 'lq7',
        type: 'scenario',
        topic: 'Electrical Safety',
        prompt:
          'You notice the laser cutter is making an unusual noise and smells hot. What is the safest action?',
        options: [
          'Turn it off immediately and report it to the supervisor',
          'Try adjusting the settings to see if the noise stops',
          'Continue working but keep an eye on it',
          'Open the case to investigate',
        ],
        correct_answer: 'Turn it off immediately and report it to the supervisor',
        explanation:
          'Unusual noises and smells indicate potential problems. Stopping immediately prevents damage and safety hazards. Always report issues to qualified personnel.',
        difficulty: 'medium',
      },
      {
        id: 'lq8',
        type: 'multiple_choice',
        topic: 'Fume Extraction',
        prompt: 'How often should laser cutter optics be cleaned?',
        options: [
          'Once a year',
          'Never — they don\'t need cleaning',
          'According to the manufacturer\'s schedule, typically every 40-80 cutting hours',
          'Only when you notice they are visibly dirty',
        ],
        correct_answer: 'According to the manufacturer\'s schedule, typically every 40-80 cutting hours',
        explanation:
          'Regular cleaning prevents optics degradation and overheating. Follow the manufacturer\'s recommendations. Waiting until they look dirty means they\'ve already been neglected.',
        difficulty: 'medium',
      },
      {
        id: 'lq9',
        type: 'true_false',
        topic: 'Fire Prevention',
        prompt: 'Acrylic and wood are equally safe materials to laser cut.',
        correct_answer: 'false',
        explanation:
          'Different materials have different ignition risks. Wood and acrylic require different settings and precautions. Always understand the fire risks of your material.',
        difficulty: 'medium',
      },
      {
        id: 'lq10',
        type: 'scenario',
        topic: 'Equipment Operation',
        prompt:
          'A coworker is about to cut a material you\'re not familiar with. What should you do?',
        options: [
          'Let them proceed — they know what they\'re doing',
          'Ask about the material and confirm laser cutter parameters are appropriate',
          'Suggest they adjust the power higher to be safe',
          'Stop them and tell them they need supervisor permission',
        ],
        correct_answer: 'Ask about the material and confirm laser cutter parameters are appropriate',
        explanation:
          'Different materials require different settings. Understanding the material and settings helps prevent fires and damage.',
        difficulty: 'medium',
      },
      {
        id: 'lq11',
        type: 'true_false',
        topic: 'Equipment Operation',
        prompt: 'Laser protective eyewear from any manufacturer is acceptable for any laser cutter.',
        correct_answer: 'false',
        explanation:
          'Protective eyewear must be rated for the specific laser wavelength (e.g., CO₂ lasers require different protection than fiber lasers). Always use the correct eyewear.',
        difficulty: 'hard',
      },
      {
        id: 'lq12',
        type: 'multiple_choice',
        topic: 'Fire Prevention',
        prompt:
          'Before starting a laser cutting job, you should check that the fume extraction outlet is:',
        options: [
          'Blocked to concentrate the air',
          'Clear and venting properly outside or to a filter system',
          'Only partially open to save energy',
          'Directed toward you to cool you down',
        ],
        correct_answer: 'Clear and venting properly outside or to a filter system',
        explanation:
          'Fume extraction only works if air can exit properly. Check that the outlet is clear and the system is functioning before starting any job.',
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'wood-workshop-safety',
    name: 'Wood Workshop Safety',
    slug: 'wood-workshop-safety',
    description: 'Master wood workshop hazards: dust extraction, respiratory protection, timber types, finishing material safety, and cleanup procedures. Dust is the #1 hazard in woodworking.',
    category: 'safety',
    tier: 2,
    color: '#B45309',
    icon_name: 'tree-pine',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    question_count: 10,
    topics: ['dust-extraction', 'dust-hazards', 'ppe', 'timber-types', 'finish-application', 'cleanup', 'grain-direction', 'wood-safety-overview'],
    learn_content: woodWorkshopSafetyLearn,
    question_pool: woodWorkshopSafetyQuestions,
  },
  {
    id: 'metal-workshop-safety',
    name: 'Metal Workshop Safety',
    slug: 'metal-workshop-safety',
    description: 'Learn metal workshop hazards: hot metal burns, swarf and sharp edges, cutting fluid safety, grinding and spark prevention, welding flash, and proper PPE. Burns and cuts are the primary risks.',
    category: 'safety',
    tier: 2,
    color: '#6B7280',
    icon_name: 'flame',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    question_count: 10,
    topics: ['hot-metal', 'swarf-hazards', 'cutting-fluid', 'deburring', 'grinding-safety', 'welding-flash', 'metal-dust', 'wheel-inspection'],
    learn_content: metalWorkshopSafetyLearn,
    question_pool: metalWorkshopSafetyQuestions,
  },
  {
    id: 'plastics-composites-safety',
    name: 'Plastics & Composites Safety',
    slug: 'plastics-composites-safety',
    description: 'Safe working with plastics and composite materials: fume extraction, chemical hazards from resins and hardeners, heat gun safety, fiberglass dust, and material storage. Fumes and chemical exposure are primary hazards.',
    category: 'safety',
    tier: 2,
    color: '#7C3AED',
    icon_name: 'flask-conical',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    question_count: 8,
    topics: ['fumes-ventilation', 'resin-chemicals', 'heat-gun-safety', 'fiberglass-dust', 'solvent-safety', 'chemical-burns', 'thermoplastic-overheating'],
    learn_content: plasticsCompositesSafetyLearn,
    question_pool: plasticsCompositesSafetyQuestions,
  },
  {
    id: 'electronics-soldering-safety',
    name: 'Electronics & Soldering Safety',
    slug: 'electronics-soldering-safety',
    description: 'Safe electronics and soldering practices: electrical safety, soldering iron burn prevention, flux fume extraction, battery and capacitor hazards, and component lead handling. Electrical shock and thermal burns are critical hazards.',
    category: 'safety',
    tier: 2,
    color: '#0891B2',
    icon_name: 'cpu',
    is_built_in: true,
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    question_count: 8,
    topics: ['electrical-safety', 'soldering-iron-safety', 'flux-fumes', 'capacitor-safety', 'battery-hazard', 'component-lead-hazard', 'high-voltage'],
    learn_content: electronicsSolderingSafetyLearn,
    question_pool: electronicsSolderingSafetyQuestions,
  },
];

/**
 * Utility function to find a badge definition by slug.
 */
export function findBadgeBySlug(slug: string): BadgeDefinition | undefined {
  return BUILT_IN_BADGES.find((b) => b.slug === slug);
}

/**
 * Utility function to get all question IDs for a badge.
 */
export function getQuestionIds(badgeSlug: string): string[] {
  const badge = findBadgeBySlug(badgeSlug);
  if (!badge) return [];
  return badge.question_pool.map((q) => q.id);
}

/**
 * Draw random questions from a badge's question pool without replacement.
 */
export function drawQuestions(
  badgeSlug: string,
  count: number
): Array<{
  id: string;
  type: string;
  topic: string;
  prompt: string;
  image_description?: string;
  options?: string[];
  match_pairs?: Array<{ left: string; right: string }>;
  difficulty: string;
}> {
  const badge = findBadgeBySlug(badgeSlug);
  if (!badge) return [];

  // Shuffle and draw
  const shuffled = [...badge.question_pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, badge.question_pool.length));

  // Strip correct_answer and explanation
  return selected.map((q) => ({
    id: q.id,
    type: q.type,
    topic: q.topic,
    prompt: q.prompt,
    image_description: q.image_description,
    options: q.options,
    match_pairs: q.match_pairs,
    difficulty: q.difficulty,
  }));
}

/**
 * Grade a test by comparing answers to correct answers in the badge definition.
 * Returns score as a percentage.
 */
export function gradeTest(
  badgeSlug: string,
  answers: Array<{ questionId: string; selected: string | string[] | number[] }>
): {
  score: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    explanation: string;
  }>;
} {
  const badge = findBadgeBySlug(badgeSlug);
  if (!badge) return { score: 0, results: [] };

  const results: Array<{
    questionId: string;
    correct: boolean;
    explanation: string;
  }> = [];

  for (const answer of answers) {
    const question = badge.question_pool.find((q) => q.id === answer.questionId);
    if (!question) continue;

    let correct = false;
    if (typeof question.correct_answer === "string") {
      correct = answer.selected === question.correct_answer;
    } else if (Array.isArray(question.correct_answer)) {
      const selected = Array.isArray(answer.selected)
        ? answer.selected
        : [answer.selected];
      correct =
        JSON.stringify(selected.sort()) ===
        JSON.stringify([...question.correct_answer].sort());
    }

    results.push({
      questionId: answer.questionId,
      correct,
      explanation: question.explanation,
    });
  }

  const correctCount = results.filter((r) => r.correct).length;
  const score = Math.round((correctCount / results.length) * 100);

  return { score, results };
}
