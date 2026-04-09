import { useState, useEffect, useRef, useCallback } from "react";

// ── TILE WORLD ───────────────────────────────────────────────
const T = 36;
const COLS = 20;
const ROWS = 16;

// 0=grass 1=path 2=water 3=wall 4=tree 5=flowers 6=bridge 7=sand 9=door
const MAP = [
  [4,4,4,4,4,2,2,2,2,2,2,2,2,2,2,4,4,4,4,4],
  [4,0,0,5,0,7,7,2,2,2,2,2,2,7,7,0,5,0,0,4],
  [4,0,0,0,0,0,7,7,2,2,2,7,7,0,0,0,0,0,0,4],
  [4,5,0,0,1,1,1,7,6,6,6,7,1,1,1,0,0,0,5,4],
  [4,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,4],
  [4,0,3,3,3,3,0,0,0,1,0,0,0,3,3,3,3,0,0,4],
  [4,0,3,9,3,3,0,0,0,1,0,0,0,3,3,9,3,0,0,4],
  [4,0,3,3,3,3,0,0,1,1,1,0,0,3,3,3,3,0,0,4],
  [4,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,4],
  [4,0,0,0,3,3,3,1,0,0,0,1,3,3,3,0,0,0,0,4],
  [4,5,0,0,3,9,3,1,0,5,0,1,3,9,3,0,0,5,0,4],
  [4,0,0,0,3,3,3,1,0,0,0,1,3,3,3,0,0,0,0,4],
  [4,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,4],
  [4,0,5,0,0,0,0,0,1,1,1,0,0,0,0,0,5,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
];

const SOLID = new Set([2, 3, 4]);
const TILE_DRAW = {
  0: (ctx, x, y) => {
    ctx.fillStyle = "#4a7c3f"; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#437536";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + (i * 13 + 5) % 28 + 4, y + (i * 11 + 7) % 28 + 4, 2, 2);
  },
  1: (ctx, x, y) => { ctx.fillStyle = "#c4a96a"; ctx.fillRect(x, y, T, T); ctx.fillStyle = "#b89b5e"; ctx.fillRect(x + 2, y + 2, T - 4, T - 4); },
  2: (ctx, x, y, t) => {
    ctx.fillStyle = "#3a6ea5"; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = `rgba(100,180,255,${0.06 + Math.sin(t * 2 + x * 0.01) * 0.04})`; ctx.fillRect(x, y, T, T);
  },
  3: (ctx, x, y) => { ctx.fillStyle = "#5a5a6e"; ctx.fillRect(x, y, T, T); ctx.fillStyle = "#4a4a5e"; ctx.fillRect(x + 3, y + 3, T - 6, T - 6); },
  4: (ctx, x, y) => {
    ctx.fillStyle = "#2d5a27"; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#1a4a14"; ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2 - 3, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#226b1a"; ctx.beginPath(); ctx.arc(x + T / 2 - 2, y + T / 2 - 6, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5a3a1a"; ctx.fillRect(x + T / 2 - 2, y + T / 2 + 6, 4, 8);
  },
  5: (ctx, x, y) => {
    TILE_DRAW[0](ctx, x, y);
    ["#e8647c", "#f0c27a", "#b07cc6"].forEach((c, i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 8 + i * 10, y + 10 + (i * 7) % 16, 3, 0, Math.PI * 2); ctx.fill();
    });
  },
  6: (ctx, x, y) => {
    ctx.fillStyle = "#3a6ea5"; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#6b5030"; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2, y + i * 9 + 1, T - 4, 7);
    ctx.fillStyle = "#8b7050"; ctx.fillRect(x, y, 3, T); ctx.fillRect(x + T - 3, y, 3, T);
  },
  7: (ctx, x, y) => { ctx.fillStyle = "#d4c49a"; ctx.fillRect(x, y, T, T); },
  9: (ctx, x, y) => {
    ctx.fillStyle = "#5a5a6e"; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#8b5e3c"; ctx.fillRect(x + 6, y + 2, T - 12, T - 4);
    ctx.fillStyle = "#a0714a"; ctx.fillRect(x + 8, y + 4, T - 16, T - 8);
    ctx.fillStyle = "#d4a843"; ctx.beginPath(); ctx.arc(x + T - 12, y + T / 2, 2, 0, Math.PI * 2); ctx.fill();
  },
};

// ── QUEST NARRATIVE ──────────────────────────────────────────
const PHASE_COLORS = { Inquire: "#6c8ebf", Develop: "#d4a843", Create: "#82b366", Evaluate: "#b85450" };
const PHASE_ICONS = { Inquire: "🔍", Develop: "✏️", Create: "🔨", Evaluate: "📊" };

const QUEST_PHASES = [
  {
    phase: "Inquire",
    title: "Understanding the Burn",
    tasks: [
      "Interview 5 of Rosa's customers about their experience",
      "Research existing cup sleeve designs and materials",
      "Investigate eco-friendly insulation materials",
      "Write a design brief with specifications",
    ],
    rosaDialogue: {
      start: [
        { speaker: "Rosa", text: "You're starting! Come, talk to my morning regulars — they'll tell you all about the cup problem.", mood: "excited" },
        { speaker: "Rosa", text: "Old Mr. Tanaka burns his fingers every single day. He's too proud to complain but I see him wince.", mood: "concerned" },
        { speaker: "Rosa", text: "And the school teachers who rush in before class — they need to carry cups across the road. It's a disaster waiting to happen.", mood: "worried" },
      ],
      mid: [
        { speaker: "Rosa", text: "How's the research going? Have you found anything interesting about materials?", mood: "curious" },
        { speaker: "You", text: "[Tell her about your findings so far]", mood: "player" },
        { speaker: "Rosa", text: "Fascinating! I never thought about cork as an option. Keep digging — I trust your instincts.", mood: "impressed" },
      ],
      complete: [
        { speaker: "Rosa", text: "You've finished your research? Let me see your design brief!", mood: "eager" },
        { speaker: "You", text: "[Present your design brief and specifications]", mood: "player" },
        { speaker: "Rosa", text: "This is thorough! You really listened to my customers. I especially love that you considered the teachers' one-hand carry problem.", mood: "delighted" },
        { speaker: "Rosa", text: "I can see you understand the problem deeply now. Time to start designing solutions!", mood: "encouraging" },
      ],
    },
    worldChanges: "Rosa puts a 'Designer at Work' sign in her window",
  },
  {
    phase: "Develop",
    title: "Sketching Solutions",
    tasks: [
      "Sketch at least 3 different sleeve concepts",
      "Create a decision matrix comparing your designs",
      "Get feedback from Rosa on your top 2 concepts",
      "Select and justify your final concept",
    ],
    rosaDialogue: {
      start: [
        { speaker: "Rosa", text: "Now comes the creative part! I cleared the back table for you — spread out your sketches here anytime.", mood: "supportive" },
        { speaker: "Rosa", text: "One thing — whatever you design, it has to be something I can actually afford. I'm a small bakery, not a big corporation.", mood: "practical" },
        { speaker: "Rosa", text: "But don't let cost kill creativity! Sometimes the best ideas seem expensive until you find the right approach.", mood: "wise" },
      ],
      mid: [
        { speaker: "Rosa", text: "Oh! Can I peek at your sketches? I promise I won't judge too harshly.", mood: "playful" },
        { speaker: "You", text: "[Show Rosa your concept sketches]", mood: "player" },
        { speaker: "Rosa", text: "Hmm... I love this folding one — customers could flatten it when they're done. But this textured grip one is so clever too!", mood: "thinking" },
        { speaker: "Rosa", text: "You know who would have strong opinions? Tomás — he comes in every day after school for hot chocolate. Ask him!", mood: "helpful" },
      ],
      complete: [
        { speaker: "Rosa", text: "You've chosen your design? Tell me everything — why this one?", mood: "eager" },
        { speaker: "You", text: "[Explain your chosen concept and the reasoning behind it]", mood: "player" },
        { speaker: "Rosa", text: "A corrugated recycled cardboard sleeve with an origami fold... I love it. Simple. Affordable. And the fold means it packs flat for storage!", mood: "excited" },
        { speaker: "Rosa", text: "I believe in this design. Let's see it come to life!", mood: "confident" },
      ],
    },
    worldChanges: "Sketches appear pinned to the bakery wall",
  },
  {
    phase: "Create",
    title: "Building the Sleeve",
    tasks: [
      "Build a working prototype from your chosen materials",
      "Test insulation — hold hot water for 3 minutes comfortably",
      "Get Rosa's feedback on fit, feel, and usability",
      "Iterate: make at least one improvement based on feedback",
    ],
    rosaDialogue: {
      start: [
        { speaker: "Rosa", text: "Prototype time! I saved some cups for you to test with. The morning rush starts at 7am if you want real conditions.", mood: "helpful" },
        { speaker: "Rosa", text: "Remember — it doesn't have to be perfect. It just has to teach you something.", mood: "wise" },
      ],
      mid: [
        { speaker: "Rosa", text: "How's the prototype? Can I try it?", mood: "eager" },
        { speaker: "You", text: "[Hand Rosa the prototype with a hot cup]", mood: "player" },
        { speaker: "Rosa", text: "*holds cup* ...Oh! I can actually hold this comfortably! The corrugation really works.", mood: "surprised" },
        { speaker: "Rosa", text: "But — and don't take this the wrong way — it slips a little when my hands are floury. Could you add some texture?", mood: "thoughtful" },
        { speaker: "You", text: "[Note the feedback for iteration]", mood: "player" },
        { speaker: "Rosa", text: "This is why testing matters! Things you'd never think of at a desk.", mood: "encouraging" },
      ],
      complete: [
        { speaker: "Rosa", text: "Let me see the updated version! You added the grip texture?", mood: "eager" },
        { speaker: "You", text: "[Present the iterated prototype]", mood: "player" },
        { speaker: "Rosa", text: "*tests it thoroughly* This. This is it. No slipping. Comfortable. And it looks good too!", mood: "overjoyed" },
        { speaker: "Rosa", text: "Mr. Tanaka is going to be so happy. But let's not tell him yet — I want to see his face when he tries it for real.", mood: "mischievous" },
      ],
    },
    worldChanges: "Prototype materials appear on Rosa's counter",
  },
  {
    phase: "Evaluate",
    title: "The Real Test",
    tasks: [
      "Test with 5 real customers during morning rush",
      "Measure: can they hold the cup comfortably for 3+ minutes?",
      "Collect feedback and compare to the original cups",
      "Present your findings and recommendations to Rosa",
    ],
    rosaDialogue: {
      start: [
        { speaker: "Rosa", text: "Tomorrow morning, 7am. We'll give sleeves to the first five customers and watch what happens. Nervous?", mood: "excited" },
        { speaker: "You", text: "[Admit you're a little nervous]", mood: "player" },
        { speaker: "Rosa", text: "Good! That means you care about getting it right. That's what real designers do.", mood: "warm" },
      ],
      mid: [
        { speaker: "Rosa", text: "Did you see Mr. Tanaka's face?! He actually smiled! He never smiles before his second coffee!", mood: "joyful" },
        { speaker: "You", text: "[Share the testing observations]", mood: "player" },
        { speaker: "Rosa", text: "Four out of five loved it immediately. And the one who didn't — she had great suggestions. Write those down!", mood: "practical" },
      ],
      complete: [
        { speaker: "Rosa", text: "So... the final verdict?", mood: "anticipating" },
        { speaker: "You", text: "[Present your evaluation report and recommendations]", mood: "player" },
        { speaker: "Rosa", text: "You've done something remarkable. Not just the sleeve — the way you approached this. You listened. You tested. You improved.", mood: "emotional" },
        { speaker: "Rosa", text: "I'm ordering 500 of these. And I'm putting a little card inside each one: 'Designed by a student at Designville Academy.'", mood: "proud" },
        { speaker: "Rosa", text: "Thank you. Really. You solved a problem I'd been living with for years.", mood: "grateful" },
        { speaker: "Rosa", text: "Oh — and one more thing. Mayor Lin mentioned the playground equipment is getting old and unsafe. Interested?", mood: "conspiratorial" },
      ],
    },
    worldChanges: "Rosa's bakery has a new sign: 'Now with designer cup sleeves!'",
  },
];

const NPCS = [
  { id: "rosa", name: "Rosa", emoji: "👩‍🍳", x: 3, y: 6, color: "#e8a87c" },
  { id: "tomas", name: "Tomás", emoji: "🧒", x: 9, y: 8, color: "#f0c27a" },
  { id: "tanaka", name: "Mr. Tanaka", emoji: "👴", x: 15, y: 6, color: "#c4b5e0" },
  { id: "mayor", name: "Mayor Lin", emoji: "🧑‍💼", x: 9, y: 13, color: "#b0c4de" },
  { id: "teacher", name: "Ms. Abara", emoji: "👩‍🏫", x: 5, y: 11, color: "#7eb8da" },
  { id: "gardener", name: "Auntie Mei", emoji: "👩‍🌾", x: 15, y: 11, color: "#a8d5a2" },
];

// NPC dialogue changes based on quest phase
function getNPCDialogue(npcId, questPhase, subPhase) {
  const dialogues = {
    tomas: {
      "-1": [{ speaker: "Tomás", text: "Hey! Rosa's coffee burns my tongue AND my fingers. Someone should fix that!", mood: "playful" }],
      "0": [{ speaker: "Tomás", text: "You're helping Rosa? Cool! Her hot chocolate burns my hands every time.", mood: "excited" },
            { speaker: "Tomás", text: "I usually wrap my scarf around the cup. Works okay but then my neck gets cold!", mood: "laughing" }],
      "1": [{ speaker: "Tomás", text: "Can I see your sketches? Ooh — what if it had dinosaurs on it? Just saying.", mood: "excited" },
            { speaker: "Tomás", text: "Actually that folding one is cool. I'd keep it in my pocket for next time.", mood: "thinking" }],
      "2": [{ speaker: "Tomás", text: "*tries the prototype* Whoa! It doesn't burn! And it's squishy!", mood: "amazed" },
            { speaker: "Tomás", text: "Can you make mine with a dinosaur print? Please? I'll be your best customer.", mood: "begging" }],
      "3": [{ speaker: "Tomás", text: "Everyone's talking about the new sleeves! You're basically famous now.", mood: "starstruck" }],
    },
    tanaka: {
      "-1": [{ speaker: "Mr. Tanaka", text: "...*quietly sips coffee, winces slightly*", mood: "stoic" }],
      "0": [{ speaker: "Mr. Tanaka", text: "You want to know about the cups? *sighs* I've been coming here fifteen years. The coffee is perfect. The cups... are not.", mood: "measured" },
            { speaker: "Mr. Tanaka", text: "I wear thick gloves in winter but in summer? I just... endure. Rosa shouldn't have to worry about this.", mood: "resigned" }],
      "1": [{ speaker: "Mr. Tanaka", text: "Rosa told me someone is designing a better cup sleeve. I'll believe it when I feel it.", mood: "skeptical" }],
      "2": [{ speaker: "Mr. Tanaka", text: "*tries prototype* ...This is acceptable. *almost smiles* Yes. This is... good.", mood: "pleasantly surprised" }],
      "3": [{ speaker: "Mr. Tanaka", text: "I don't say this often. But you did well. My mornings are better because of you.", mood: "warm" },
            { speaker: "Mr. Tanaka", text: "*the closest thing to a smile you've ever seen from him*", mood: "rare-smile" }],
    },
    mayor: {
      "-1": [{ speaker: "Mayor Lin", text: "Welcome to Designville! Talk to the villagers — they need creative problem-solvers like you.", mood: "welcoming" }],
      "0": [{ speaker: "Mayor Lin", text: "I heard you're helping Rosa! Excellent. This village thrives when people listen to each other's problems.", mood: "approving" }],
      "1": [{ speaker: "Mayor Lin", text: "Design is about choices. Every sketch is a fork in the road. Choose wisely!", mood: "philosophical" }],
      "2": [{ speaker: "Mayor Lin", text: "A prototype! Now you're speaking my language. There's nothing like holding your idea in your hands.", mood: "enthusiastic" }],
      "3": [{ speaker: "Mayor Lin", text: "You've changed this village for the better. Rosa is happier, Mr. Tanaka is smiling... and I have another challenge for you when you're ready.", mood: "proud" }],
    },
    teacher: {
      "-1": [{ speaker: "Ms. Abara", text: "I rush in every morning for a latte. Carrying it across the road to school is an adventure — I've burned myself twice this month!", mood: "exasperated" }],
      "0": [{ speaker: "Ms. Abara", text: "Oh, you're researching the cup problem? One-handed carry is my biggest issue. I'm always holding papers in the other hand.", mood: "helpful" }],
      "1": [{ speaker: "Ms. Abara", text: "Make sure the sleeve doesn't make the cup too thick to fit in my car's cup holder! That's a constraint people forget.", mood: "practical" }],
      "2": [{ speaker: "Ms. Abara", text: "Can I test it on my walk to school tomorrow? Real conditions: rain, papers, laptop bag, coffee. The full chaos.", mood: "volunteering" }],
      "3": [{ speaker: "Ms. Abara", text: "I used your sleeve this morning — walked to school, no burns, one hand free. You've made my mornings 10% less stressful. That's huge.", mood: "grateful" }],
    },
    gardener: {
      "-1": [{ speaker: "Auntie Mei", text: "Hello dear! I'm tending my little garden here. These old knees aren't what they used to be...", mood: "gentle" }],
      "0": [{ speaker: "Auntie Mei", text: "I heard you're helping Rosa! That's wonderful. Maybe when you're done... I have a problem too.", mood: "hopeful" }],
      "1": [{ speaker: "Auntie Mei", text: "Your sketches for Rosa look lovely! I wish someone would sketch solutions for my garden too someday.", mood: "wistful" }],
      "2": [{ speaker: "Auntie Mei", text: "You're building a prototype? How exciting! I love watching young people make things with their hands.", mood: "encouraging" }],
      "3": [{ speaker: "Auntie Mei", text: "You solved Rosa's problem beautifully. Do you think... you might have time for mine next? My knees aren't getting any younger.", mood: "hopeful" },
            { speaker: "Auntie Mei", text: "I need a garden I can tend without bending down. But that's a story for another quest.", mood: "gentle" }],
    },
  };
  const key = questPhase.toString();
  return dialogues[npcId]?.[key] || dialogues[npcId]?.["-1"] || [{ speaker: "???", text: "...", mood: "silent" }];
}

export default function DesignQuestNarrative() {
  const canvasRef = useRef(null);
  const playerRef = useRef({ x: 9, y: 14, dir: 0 });
  const camRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef({});
  const moveTimer = useRef(0);
  const frameRef = useRef(null);
  const mobileDirRef = useRef(null);

  const [player, setPlayer] = useState({ x: 9, y: 14, dir: 0 });
  const [questPhase, setQuestPhase] = useState(-1); // -1=not started, 0-3=phases
  const [subPhase, setSubPhase] = useState("none"); // none, start, mid, complete, reported
  const [tasksDone, setTasksDone] = useState([false, false, false, false]);
  const [nearNPC, setNearNPC] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const [showJournal, setShowJournal] = useState(false);
  const [showPhaseComplete, setShowPhaseComplete] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDir, setMobileDir] = useState(null);
  const [introPlayed, setIntroPlayed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => { setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0); }, []);

  const showNotif = useCallback((text, icon = "📜") => {
    setNotification({ text, icon });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const allTasksDone = tasksDone.every(Boolean);

  // ── CANVAS DRAW ────────────────────────────────────────────
  const draw = useCallback((ctx, w, h, time) => {
    const p = playerRef.current;
    const cam = camRef.current;
    const tcx = p.x * T + T / 2 - w / 2;
    const tcy = p.y * T + T / 2 - h / 2;
    cam.x += (tcx - cam.x) * 0.08;
    cam.y += (tcy - cam.y) * 0.08;

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = MAP[r][c];
        const fn = TILE_DRAW[tile] || TILE_DRAW[0];
        fn(ctx, c * T, r * T, time);
      }
    }

    // Building labels
    const buildings = [
      { x: 3, y: 5, label: "Rosa's Bakery", icon: "🧁", color: "#e8a87c" },
      { x: 15, y: 5, label: "Town Hall", icon: "🏛️", color: "#b0c4de" },
      { x: 5, y: 10, label: "School", icon: "📚", color: "#7eb8da" },
      { x: 14, y: 10, label: "Garden", icon: "🌱", color: "#a8d5a2" },
    ];
    buildings.forEach(b => {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      const tw = ctx.measureText(b.label).width;
      ctx.fillRect(b.x * T + T / 2 - tw / 2 - 6, (b.y - 1) * T + T - 2, tw + 12, 14);
      ctx.fillStyle = b.color;
      ctx.fillText(b.label, b.x * T + T / 2, (b.y - 1) * T + T + 8);
    });

    // Quest-phase world changes
    if (questPhase >= 0) {
      ctx.fillStyle = "rgba(240,196,27,0.8)";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔨 Designer at Work", 3 * T + T / 2, 5 * T - 6);
    }
    if (questPhase >= 1) {
      // Sketches on bakery wall
      ctx.fillStyle = "#f0e6d3";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(2 * T + 6 + i * 12, 5 * T + 4, 8, 10);
        ctx.fillStyle = ["#e94560", "#6c8ebf", "#82b366"][i];
        ctx.fillRect(2 * T + 8 + i * 12, 5 * T + 6, 4, 6);
        ctx.fillStyle = "#f0e6d3";
      }
    }
    if (questPhase >= 2) {
      // Materials on counter
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(4 * T + 4, 6 * T + 4, 10, 8);
      ctx.fillStyle = "#c4a060";
      ctx.fillRect(4 * T + 16, 6 * T + 6, 8, 6);
    }
    if (questPhase >= 3 && subPhase === "reported") {
      ctx.fillStyle = "#7ecf8a";
      ctx.font = "bold 7px sans-serif";
      ctx.fillText("★ Designer Sleeves!", 3 * T + T / 2, 7 * T + T + 10);
    }

    // Draw NPCs
    NPCS.forEach(npc => {
      const nx = npc.x * T, ny = npc.y * T;
      const bob = Math.sin(time * 1.8 + npc.x * 2) * 1.5;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.ellipse(nx + T / 2, ny + T - 3, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = npc.color;
      ctx.beginPath(); ctx.arc(nx + T / 2, ny + T / 2 - 1 + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.font = "18px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(npc.emoji, nx + T / 2, ny + T / 2 + 5 + bob);

      // Quest marker for Rosa only
      if (npc.id === "rosa") {
        if (questPhase === -1) {
          const bounce = Math.sin(time * 4) * 3;
          ctx.fillStyle = "#f0c41b"; ctx.font = "bold 16px sans-serif";
          ctx.fillText("!", nx + T / 2, ny - 6 + bounce);
          ctx.beginPath(); ctx.arc(nx + T / 2, ny - 10 + bounce, 8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(240,196,27,0.15)"; ctx.fill();
        } else if (allTasksDone && subPhase !== "reported") {
          const bounce = Math.sin(time * 3) * 2;
          ctx.fillStyle = "#f0c41b"; ctx.font = "bold 14px sans-serif";
          ctx.fillText("?", nx + T / 2, ny - 6 + bounce);
        } else if (subPhase === "reported" && questPhase < 3) {
          const bounce = Math.sin(time * 4) * 3;
          ctx.fillStyle = "#82b366"; ctx.font = "bold 14px sans-serif";
          ctx.fillText("→", nx + T / 2, ny - 6 + bounce);
        } else {
          ctx.fillStyle = "#7ecf8a"; ctx.font = "bold 12px sans-serif";
          ctx.fillText("•", nx + T / 2, ny - 4);
        }
      }

      // NPC reaction indicators based on quest phase
      if (npc.id !== "rosa" && questPhase >= 0) {
        const moods = { tomas: "💭", tanaka: "☕", mayor: "📋", teacher: "📚", gardener: "🌱" };
        ctx.font = "10px sans-serif";
        ctx.fillText(moods[npc.id] || "", nx + T / 2, ny - 4);
      }

      // Name
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center";
      const nw = ctx.measureText(npc.name).width;
      ctx.fillRect(nx + T / 2 - nw / 2 - 3, ny - 18, nw + 6, 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(npc.name, nx + T / 2, ny - 9);
    });

    // Player
    const px = p.x * T, py = p.y * T;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(px + T / 2, py + T - 3, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e94560";
    ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2 - 1, 12, 0, Math.PI * 2); ctx.fill();
    const dirs = [[0, 5], [-5, 0], [5, 0], [0, -5]];
    const [dx, dy] = dirs[p.dir];
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(px + T / 2 + dx * 0.7, py + T / 2 - 1 + dy * 0.7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath(); ctx.arc(px + T / 2 + dx * 0.9, py + T / 2 - 1 + dy * 0.9, 1.5, 0, Math.PI * 2); ctx.fill();

    // Interaction prompt
    if (nearNPC && !dialogue) {
      const nn = NPCS.find(n => n.id === nearNPC);
      if (nn) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath(); ctx.roundRect(nn.x * T - 12, nn.y * T + T + 8, T + 24, 18, 5); ctx.fill();
        ctx.fillStyle = "#f0c41b"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(isMobile ? "TAP 💬" : "E — Talk", nn.x * T + T / 2, nn.y * T + T + 21);
      }
    }

    ctx.restore();
  }, [questPhase, subPhase, nearNPC, dialogue, allTasksDone, isMobile]);

  // ── GAME LOOP ──────────────────────────────────────────────
  useEffect(() => {
    if (showIntro) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let time = 0;

    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      time += 0.016;
      const w = canvas.width = canvas.parentElement.clientWidth;
      const h = canvas.height = canvas.parentElement.clientHeight;

      if (!dialogue && !showJournal && !showPhaseComplete) {
        moveTimer.current -= 1;
        if (moveTimer.current <= 0) {
          const k = keysRef.current;
          const md = mobileDirRef.current;
          let ddx = 0, ddy = 0, dir = playerRef.current.dir;
          if (k["w"] || k["arrowup"] || md === "up") { ddy = -1; dir = 3; }
          else if (k["s"] || k["arrowdown"] || md === "down") { ddy = 1; dir = 0; }
          else if (k["a"] || k["arrowleft"] || md === "left") { ddx = -1; dir = 1; }
          else if (k["d"] || k["arrowright"] || md === "right") { ddx = 1; dir = 2; }

          if (ddx || ddy) {
            const nx = playerRef.current.x + ddx;
            const ny = playerRef.current.y + ddy;
            const tile = MAP[ny]?.[nx];
            const npcBlock = NPCS.some(n => n.x === nx && n.y === ny);
            if (tile !== undefined && !SOLID.has(tile) && !npcBlock) {
              playerRef.current = { x: nx, y: ny, dir };
              setPlayer({ x: nx, y: ny, dir });
              moveTimer.current = 7;
            } else {
              playerRef.current = { ...playerRef.current, dir };
              moveTimer.current = 5;
            }
          }
        }
      }

      let closest = null;
      const p = playerRef.current;
      NPCS.forEach(n => { if (Math.abs(n.x - p.x) + Math.abs(n.y - p.y) <= 2) closest = n.id; });
      setNearNPC(closest);

      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, time);
    };
    loop();
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw, dialogue, showJournal, showPhaseComplete, showIntro]);

  // ── INPUT ──────────────────────────────────────────────────
  useEffect(() => {
    const onDown = e => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "e" || e.key === " ") handleInteract();
    };
    const onUp = e => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  });

  const handleInteract = useCallback(() => {
    if (showIntro || showPhaseComplete || showJournal) return;

    if (dialogue) {
      // Advance
      const nextIdx = dialogue.lineIndex + 1;
      if (nextIdx < dialogue.lines.length) {
        setDialogue({ ...dialogue, lineIndex: nextIdx });
      } else {
        // End of dialogue — check for quest events
        if (dialogue.npcId === "rosa" && questPhase === -1) {
          // Offer quest
          setDialogue({ ...dialogue, questOffer: true, lineIndex: -1 });
          return;
        }
        if (dialogue.npcId === "rosa" && dialogue.type === "complete") {
          // Phase complete!
          setDialogue(null);
          if (questPhase < 3) {
            setShowPhaseComplete(true);
          } else {
            setSubPhase("reported");
            showNotif("Quest Complete: The Hot Cup Problem!", "🎉");
          }
          return;
        }
        setDialogue(null);
      }
      return;
    }

    if (!nearNPC) return;

    if (nearNPC === "rosa") {
      if (questPhase === -1) {
        // First meeting
        setDialogue({
          npcId: "rosa",
          lineIndex: 0,
          type: "intro",
          lines: [
            { speaker: "Rosa", text: "Oh! A new face in Designville! Welcome, welcome. I'm Rosa — I run the bakery.", mood: "warm" },
            { speaker: "Rosa", text: "I hate to dump my problems on a stranger, but... I have a real one. My customers keep burning their hands on my takeaway cups.", mood: "concerned" },
            { speaker: "Rosa", text: "The paper is too thin, there's no insulation. Poor Mr. Tanaka winces every morning but he's too polite to say anything.", mood: "worried" },
            { speaker: "Rosa", text: "I need someone to design a better cup sleeve. Eco-friendly. Affordable. Actually works. Could that someone be you?", mood: "hopeful" },
          ],
        });
      } else if (allTasksDone && subPhase !== "reported") {
        // Report back
        const phase = QUEST_PHASES[questPhase];
        setDialogue({ npcId: "rosa", lineIndex: 0, type: "complete", lines: phase.rosaDialogue.complete });
      } else if (subPhase === "reported" && questPhase < 3) {
        // Start next phase
        const nextPhase = questPhase + 1;
        setQuestPhase(nextPhase);
        setSubPhase("start");
        setTasksDone([false, false, false, false]);
        const phase = QUEST_PHASES[nextPhase];
        setDialogue({ npcId: "rosa", lineIndex: 0, type: "start", lines: phase.rosaDialogue.start });
        showNotif(`Phase: ${phase.phase} — ${phase.title}`, PHASE_ICONS[phase.phase]);
      } else if (subPhase === "start" || subPhase === "none") {
        const phase = QUEST_PHASES[questPhase];
        setDialogue({ npcId: "rosa", lineIndex: 0, type: "mid", lines: phase.rosaDialogue.mid || phase.rosaDialogue.start });
        setSubPhase("mid");
      } else {
        const phase = QUEST_PHASES[questPhase];
        setDialogue({ npcId: "rosa", lineIndex: 0, type: "mid", lines: phase.rosaDialogue.mid || phase.rosaDialogue.start });
      }
    } else {
      // Other NPCs - phase-aware dialogue
      const lines = getNPCDialogue(nearNPC, questPhase, subPhase);
      setDialogue({ npcId: nearNPC, lineIndex: 0, type: "npc", lines });
    }
  }, [dialogue, nearNPC, questPhase, subPhase, allTasksDone, showIntro, showPhaseComplete, showJournal, showNotif]);

  const acceptQuest = () => {
    setQuestPhase(0);
    setSubPhase("start");
    setTasksDone([false, false, false, false]);
    setDialogue(null);
    showNotif("Quest Accepted: The Hot Cup Problem", "📜");
    setTimeout(() => {
      const phase = QUEST_PHASES[0];
      setDialogue({ npcId: "rosa", lineIndex: 0, type: "start", lines: phase.rosaDialogue.start });
    }, 500);
  };

  const toggleTask = (idx) => {
    setTasksDone(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const advancePhase = () => {
    setShowPhaseComplete(false);
    setSubPhase("reported");
    if (questPhase < 3) {
      showNotif("Report back to Rosa for the next phase!", "➡️");
    }
  };

  const currentPhase = questPhase >= 0 ? QUEST_PHASES[questPhase] : null;
  const currentLine = dialogue && dialogue.lineIndex >= 0 ? dialogue.lines[dialogue.lineIndex] : null;

  // ── INTRO SCREEN ───────────────────────────────────────────
  if (showIntro) {
    return (
      <div style={{ height: "100vh", background: "linear-gradient(180deg, #0a0a14 0%, #1a1a2e 50%, #2d1f0e 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#f0e6d3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, background: "radial-gradient(circle at 50% 30%, #e94560 0%, transparent 50%)" }} />
        <div style={{ position: "relative", maxWidth: 380 }}>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#e94560", textTransform: "uppercase", marginBottom: 8 }}>StudioLoom Presents</div>
          <h1 style={{ fontSize: 28, fontWeight: 200, margin: "0 0 4px", letterSpacing: 3 }}>Design Quest</h1>
          <p style={{ fontSize: 16, color: "#d4a843", margin: "0 0 20px", fontStyle: "italic" }}>The Hot Cup Problem</p>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, marginBottom: 24, border: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: "#bbb", margin: 0 }}>
              In the village of Designville, every problem is a quest. Rosa the baker needs your help — her customers keep burning their hands. Explore the village, talk to the locals, and design a solution through the four phases of the Design Cycle.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
            {["Inquire", "Develop", "Create", "Evaluate"].map(p => (
              <span key={p} style={{ fontSize: 9, padding: "4px 8px", borderRadius: 4, background: PHASE_COLORS[p] + "22", color: PHASE_COLORS[p], fontWeight: 700, letterSpacing: 1 }}>
                {PHASE_ICONS[p]} {p}
              </span>
            ))}
          </div>
          <button onClick={() => setShowIntro(false)} style={{ padding: "14px 48px", background: "linear-gradient(135deg, #e94560, #c73e54)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 20px rgba(233,69,96,0.3)" }}>
            Begin Quest →
          </button>
          <p style={{ fontSize: 11, color: "#555", marginTop: 16 }}>{isMobile ? "D-pad to move • 💬 button to talk" : "WASD to move • E to interact"}</p>
        </div>
      </div>
    );
  }

  // ── GAME ───────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", background: "#1a1a2e", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>

      {/* HUD */}
      <div style={{ position: "absolute", top: 6, left: 6, right: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 10 }}>
        <div style={{ background: "rgba(10,10,20,0.85)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "5px 10px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Designville</div>
          {currentPhase && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: 11 }}>{PHASE_ICONS[currentPhase.phase]}</span>
              <span style={{ fontSize: 10, color: PHASE_COLORS[currentPhase.phase], fontWeight: 600 }}>{currentPhase.phase}: {currentPhase.title}</span>
            </div>
          )}
        </div>
        {questPhase >= 0 && (
          <button onClick={() => setShowJournal(!showJournal)} style={{ pointerEvents: "auto", background: "rgba(10,10,20,0.85)", backdropFilter: "blur(6px)", border: allTasksDone ? "1px solid #f0c41b44" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "5px 10px", color: "#e8e0d4", fontSize: 10, cursor: "pointer" }}>
            📋 Journal {allTasksDone && <span style={{ color: "#f0c41b" }}>✦</span>}
          </button>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{ position: "absolute", top: 42, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.9)", borderRadius: 10, padding: "7px 16px", color: "#f0c41b", fontSize: 12, fontWeight: 600, border: "1px solid rgba(240,196,27,0.2)", zIndex: 20, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          {notification.icon} {notification.text}
        </div>
      )}

      {/* Dialogue */}
      {dialogue && !dialogue.questOffer && currentLine && (
        <div onClick={handleInteract} style={{ position: "absolute", bottom: isMobile ? 120 : 12, left: 10, right: 10, zIndex: 30, maxWidth: 420, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderRadius: 12, padding: 14, border: currentLine.mood === "player" ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {currentLine.mood === "player" ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e94560" }}>You</span>
              ) : (
                <>
                  <span style={{ fontSize: 20 }}>{NPCS.find(n => n.id === dialogue.npcId)?.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NPCS.find(n => n.id === dialogue.npcId)?.color }}>{currentLine.speaker}</span>
                </>
              )}
              {currentLine.mood && currentLine.mood !== "player" && (
                <span style={{ fontSize: 9, color: "#666", fontStyle: "italic" }}>({currentLine.mood})</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: currentLine.mood === "player" ? "#ccc" : "#e8e0d4", lineHeight: 1.7, margin: "0 0 6px", fontStyle: currentLine.mood === "player" ? "italic" : "normal" }}>
              {currentLine.text}
            </p>
            <div style={{ textAlign: "right", fontSize: 9, color: "#555" }}>
              {dialogue.lineIndex + 1}/{dialogue.lines.length} — {isMobile ? "tap" : "E"} ▶
            </div>
          </div>
        </div>
      )}

      {/* Quest Offer */}
      {dialogue?.questOffer && (
        <div style={{ position: "absolute", bottom: isMobile ? 120 : 12, left: 10, right: 10, zIndex: 30, maxWidth: 420, margin: "0 auto" }}>
          <div style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", borderRadius: 14, border: "1px solid rgba(240,196,27,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "rgba(240,196,27,0.06)", borderBottom: "1px solid rgba(240,196,27,0.1)" }}>
              <span style={{ fontSize: 9, letterSpacing: 2, color: "#f0c41b", fontWeight: 700, textTransform: "uppercase" }}>Quest Available</span>
              <h3 style={{ fontSize: 15, color: "#f0e6d3", margin: "4px 0 2px", fontWeight: 600 }}>The Hot Cup Problem</h3>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Design an eco-friendly insulating sleeve for Rosa's cups</p>
            </div>
            <div style={{ padding: "8px 14px 12px" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {["Inquire", "Develop", "Create", "Evaluate"].map(p => (
                  <span key={p} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: PHASE_COLORS[p] + "22", color: PHASE_COLORS[p], fontWeight: 700 }}>{PHASE_ICONS[p]} {p}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={acceptQuest} style={{ flex: 1, padding: "10px 0", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Accept Quest</button>
                <button onClick={() => setDialogue(null)} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", color: "#666", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>Not yet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Journal */}
      {showJournal && currentPhase && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowJournal(false); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div style={{ background: "#12122a", borderRadius: 14, maxWidth: 380, width: "100%", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f0e6d3" }}>📋 The Hot Cup Problem</h2>
                <p style={{ fontSize: 10, color: PHASE_COLORS[currentPhase.phase], margin: "2px 0 0", fontWeight: 600 }}>{PHASE_ICONS[currentPhase.phase]} {currentPhase.phase}: {currentPhase.title}</p>
              </div>
              <button onClick={() => setShowJournal(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            {/* Progress bar */}
            <div style={{ padding: "8px 16px 0" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < questPhase ? PHASE_COLORS[QUEST_PHASES[i].phase] : i === questPhase ? PHASE_COLORS[currentPhase.phase] + "66" : "rgba(255,255,255,0.06)" }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                {["I", "D", "C", "E"].map((l, i) => (
                  <span key={l} style={{ fontSize: 8, color: i <= questPhase ? PHASE_COLORS[QUEST_PHASES[i].phase] : "#444", fontWeight: 700 }}>{l}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 16px 14px" }}>
              {currentPhase.tasks.map((task, i) => (
                <div key={i} onClick={() => toggleTask(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none", cursor: "pointer" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: tasksDone[i] ? `2px solid ${PHASE_COLORS[currentPhase.phase]}` : "2px solid rgba(255,255,255,0.15)", background: tasksDone[i] ? PHASE_COLORS[currentPhase.phase] + "22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {tasksDone[i] && <span style={{ fontSize: 11, color: PHASE_COLORS[currentPhase.phase] }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, color: tasksDone[i] ? "#666" : "#ccc", lineHeight: 1.5, textDecoration: tasksDone[i] ? "line-through" : "none" }}>{task}</span>
                </div>
              ))}
              {allTasksDone && (
                <div style={{ marginTop: 10, padding: 10, background: "rgba(240,196,27,0.06)", borderRadius: 8, border: "1px solid rgba(240,196,27,0.15)", textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "#f0c41b", margin: 0, fontWeight: 600 }}>
                    All tasks complete! Report back to Rosa 🏃
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase Complete Celebration */}
      {showPhaseComplete && currentPhase && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#12122a", borderRadius: 16, maxWidth: 360, width: "100%", border: `1px solid ${PHASE_COLORS[currentPhase.phase]}33`, overflow: "hidden", textAlign: "center" }}>
            <div style={{ padding: "20px 20px 10px", background: `${PHASE_COLORS[currentPhase.phase]}08` }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>{PHASE_ICONS[currentPhase.phase]}</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: PHASE_COLORS[currentPhase.phase], margin: "0 0 2px" }}>{currentPhase.phase} Complete!</h2>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{currentPhase.title}</p>
            </div>
            <div style={{ padding: "12px 20px" }}>
              <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>{currentPhase.worldChanges}</p>
              {questPhase < 3 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                  <span style={{ fontSize: 10, color: "#888" }}>Next:</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: PHASE_COLORS[QUEST_PHASES[questPhase + 1].phase] }}>
                    {PHASE_ICONS[QUEST_PHASES[questPhase + 1].phase]} {QUEST_PHASES[questPhase + 1].phase} — {QUEST_PHASES[questPhase + 1].title}
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding: "0 20px 16px" }}>
              <button onClick={advancePhase} style={{ width: "100%", padding: "11px 0", background: PHASE_COLORS[currentPhase.phase], color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {questPhase < 3 ? "Continue →" : "Complete Quest! 🎉"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && !dialogue && !showJournal && !showPhaseComplete && (
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end", pointerEvents: "none", zIndex: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "auto" }}>
            <button onTouchStart={() => mobileDirRef.current = "up"} onTouchEnd={() => mobileDirRef.current = null}
              style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(10,10,20,0.75)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ display: "flex", gap: 2 }}>
              <button onTouchStart={() => mobileDirRef.current = "left"} onTouchEnd={() => mobileDirRef.current = null}
                style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(10,10,20,0.75)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <div style={{ width: 46, height: 46 }} />
              <button onTouchStart={() => mobileDirRef.current = "right"} onTouchEnd={() => mobileDirRef.current = null}
                style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(10,10,20,0.75)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
            <button onTouchStart={() => mobileDirRef.current = "down"} onTouchEnd={() => mobileDirRef.current = null}
              style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(10,10,20,0.75)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, pointerEvents: "auto" }}>
            {nearNPC && (
              <button onClick={handleInteract} style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(240,196,27,0.15)", border: "2px solid #f0c41b", color: "#f0c41b", fontSize: 20, cursor: "pointer" }}>💬</button>
            )}
          </div>
        </div>
      )}

      {!isMobile && !dialogue && !showJournal && !showPhaseComplete && (
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, zIndex: 10 }}>
          {[["WASD", "Move"], ["E", "Talk"]].map(([k, l]) => (
            <span key={k} style={{ fontSize: 9, color: "#555", background: "rgba(10,10,20,0.7)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
              <strong style={{ color: "#777" }}>{k}</strong> {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
