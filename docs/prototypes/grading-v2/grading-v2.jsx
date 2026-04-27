// StudioLoom Grading v2 — Horizontal-first calibrate, vertical synthesis
// Three artboards: A · Calibrate (per-question across class), B · Synthesize (per-student rubric+comment), C · Studio Floor (clustered)
// All transitions Framer Motion. Framework-agnostic React + CDN.

const { motion, AnimatePresence, LayoutGroup } = window.Motion || window;

// ================= ICONS =================
const I = ({ name, size = 16, s = 2 }) => {
  const p = { strokeWidth: s, stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size, viewBox: "0 0 24 24" };
  const shapes = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    chevR: <path d="M9 6l6 6-6 6"/>,
    chevL: <path d="M15 18l-6-6 6-6"/>,
    chevD: <path d="M6 9l6 6 6-6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="M20 6L9 17l-5-5"/>,
    x: <path d="M18 6L6 18M6 6l12 12"/>,
    sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5L19 14z"/></>,
    mic: <><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    text: <path d="M4 7V4h16v3M9 20h6M12 4v16"/>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    annotate: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    quote: <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    layers: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>,
    keyboard: <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M10 14h4"/></>,
    zoom: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/></>,
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>,
  };
  return <svg {...p}>{shapes[name]}</svg>;
};

// ================= CONTEXT =================
const UNIT = "Coffee Table — Year 10 Design & Tech";
const LESSON = "L4 · Sketch & Iterate";
const CLASS = "10D · 24 students";

const CRITERIA = [
  { id: "inq", label: "Inquiring",   max: 8, color: "#7C3AED" },
  { id: "des", label: "Designing",   max: 8, color: "#E86F2C" },
  { id: "eva", label: "Evaluating",  max: 8, color: "#14B8A6" },
  { id: "ref", label: "Reflecting",  max: 8, color: "#F59E0B" },
];

// 8 tiles in this lesson, with mixed types
const TILES = [
  { id: "t1", n: 1, type: "text",     icon: "text",     title: "What surprised you about the brief?",       criterion: "inq", time: "4 min" },
  { id: "t2", n: 2, type: "toolkit",  icon: "grid",     title: "Empathy map: who is this coffee table for?", criterion: "inq", time: "8 min" },
  { id: "t3", n: 3, type: "monitored",icon: "shield",   title: "Design brief — your version (300+ words)",   criterion: "des", time: "15 min" },
  { id: "t4", n: 4, type: "upload",   icon: "image",    title: "Three joinery sketches",                     criterion: "des", time: "12 min" },
  { id: "t5", n: 5, type: "toolkit",  icon: "grid",     title: "SCAMPER grid on chosen solution",            criterion: "des", time: "10 min" },
  { id: "t6", n: 6, type: "annotate", icon: "annotate", title: "Annotate the joinery comparison image",      criterion: "eva", time: "6 min" },
  { id: "t7", n: 7, type: "text",     icon: "text",     title: "PMI — your top two solutions",               criterion: "eva", time: "8 min" },
  { id: "t8", n: 8, type: "text",     icon: "text",     title: "Reflection: what would you do differently?", criterion: "ref", time: "5 min" },
];

// 24 students — full class
const NAMES = [
  ["Maya","Robinson","#E86F2C"],   ["Liam","Kovač","#7C3AED"],     ["Sofia","Patel","#14B8A6"],
  ["Noah","Bergmann","#F59E0B"],   ["Iris","Lindqvist","#EC4899"], ["Theo","Dubois","#10B981"],
  ["Ava","Mendoza","#06B6D4"],     ["Oliver","Zhang","#8B5CF6"],   ["Zara","Okonkwo","#EF4444"],
  ["Finn","Walsh","#3B82F6"],      ["Mira","Saito","#A855F7"],     ["Eli","Kowalski","#F97316"],
  ["Nova","Fischer","#EAB308"],    ["Jude","Rahman","#22C55E"],    ["Lila","Costa","#0EA5E9"],
  ["Kai","Nguyen","#D946EF"],      ["Ines","Moreau","#F43F5E"],    ["Reza","Hosseini","#84CC16"],
  ["Yuki","Tanaka","#14B8A6"],     ["Cleo","Brennan","#7C3AED"],   ["Arlo","Lindgren","#E86F2C"],
  ["Saoirse","Doyle","#10B981"],   ["Mateo","Silva","#06B6D4"],    ["Hazel","Park","#EC4899"],
];

// Generate per-student per-tile data deterministically
function genData() {
  const data = {};
  NAMES.forEach(([first, last], si) => {
    const id = `s${si}`;
    data[id] = { first, last, color: NAMES[si][2], initials: first[0]+last[0], submitted: si % 11 !== 5, late: si % 9 === 4, tiles: {} };
    TILES.forEach((tile, ti) => {
      // AI quality 0..3 (Em/Dev/Ach/Mast), seeded by si+ti
      const q = ((si * 7 + ti * 13 + 3) % 11) % 4;
      // Score 1..8 mapped from quality, with some noise
      const score = Math.max(1, Math.min(8, q * 2 + 1 + ((si + ti) % 3)));
      const integrity = tile.type === "monitored" ? Math.max(40, 100 - ((si * 11 + ti * 7) % 60)) : null;
      data[id].tiles[tile.id] = {
        submitted: data[id].submitted && (si + ti) % 13 !== 7,
        aiScore: score,
        aiQuality: q,
        aiQuote: AI_QUOTES[tile.type][si % AI_QUOTES[tile.type].length],
        confidence: ["high","high","high","med","med","low"][(si + ti) % 6],
        integrity,
        teacherScore: null, // null = not yet confirmed
      };
    });
  });
  return data;
}

const AI_QUOTES = {
  text: [
    "I didn't know coffee tables had so many constraints — height matters more than I thought.",
    "Surprised that the proportions are way more standardized than I expected.",
    "I assumed it'd be simple, but the joinery part is genuinely hard.",
    "The user research bit threw me — most people don't even notice their coffee table.",
    "I expected aesthetics to drive it but actually function comes first.",
    "Honestly nothing surprised me, this seemed pretty straightforward.",
  ],
  toolkit: [
    "User: shared apartment, 24-30y. Wants: durable, looks decent, can move. Pain: cheap tables wobble.",
    "Empathy mapped a young couple — focus on multi-use surface for laptop + drinks.",
    "Persona: family of 4. Sees, hears: kids running. Pain: scratches.",
    "User notes are thin — three bullet points, no quotes from real interviews.",
    "Detailed grid covering see/hear/say/think for 'small apartment dweller'.",
    "Empty cells in two quadrants.",
  ],
  monitored: [
    "Brief opens with 'a coffee table is a horizontal surface...' — clear voice, builds detail across 340 words.",
    "Strong rationale linking user to material choice; specific dimensions throughout.",
    "Brief is 280 words but feels padded — long sentences, low information density.",
    "Three large pastes detected mid-draft. Style shift halfway through.",
    "Reads as their own writing — typos, self-corrections, idle time matches think-pause pattern.",
    "Under 200 words; brief is bullet points, not prose.",
  ],
  upload: [
    "3 distinct joinery solutions: half-lap, mortise-and-tenon, biscuit. Strengths/tradeoffs noted on 2 of 3.",
    "Exceptional — 3 sketches, exploded views, comparison matrix.",
    "Only 2 sketches submitted, prompt asked for 3.",
    "3 ideas but very similar (all variants of dowel joinery). Tradeoffs surface-level.",
    "1 detailed sketch, no variety — doesn't meet brief.",
    "3 solutions, written reflection adds depth.",
  ],
  annotate: [
    "12 annotations placed; covers strength, cost, time per joint type.",
    "Only 3 annotations — surface comments ('looks strong').",
    "Detailed annotations linking to course materials.",
    "Annotations on the wrong joint — possible misconception about mortise vs biscuit.",
    "Empty submission — image opened but no annotations placed.",
    "8 annotations, balanced, references the reading.",
  ],
};

const DATA = genData();

// History notes per student (for the unconventional "you said this 3 weeks ago" feature)
const PAST_FEEDBACK = {
  s0: { date: "3 weeks ago", quote: "Your sketches are strong but lack annotation — try labeling material, dimensions, and reasoning." },
  s1: { date: "2 weeks ago", quote: "Push your trade-off analysis further. You always identify strengths but rarely the weaknesses." },
  s2: { date: "3 weeks ago", quote: "Your communication is the strongest in the class — keep using exploded views." },
  s3: { date: "2 weeks ago", quote: "Variety in ideas is what we're looking for. You tend to iterate on one idea instead of branching." },
  s7: { date: "4 weeks ago", quote: "Detail is great but the brief asks for variety — work on quantity-over-perfection in idea phase." },
};

// ================= TILE PREVIEWS (mini-renders per tile type) =================
function MiniText({ studentId, seed }) {
  const sigs = AI_QUOTES.text;
  const text = sigs[(seed) % sigs.length];
  return (
    <div className="text-[12px] leading-snug text-[var(--ink-2)] italic font-medium pl-2 border-l-2 border-[var(--hair-2)]">"{text}"</div>
  );
}

function MiniToolkit({ studentId, seed }) {
  const c = NAMES[seed][2];
  return (
    <div className="grid grid-cols-2 gap-0.5 w-[120px] h-[60px]">
      {[0,1,2,3].map(i => {
        const filled = (seed + i) % 4 !== 1;
        return (
          <div key={i} className="rounded-sm flex items-center justify-center" style={{ background: filled ? c+"22" : "rgba(0,0,0,0.04)", border: `1px solid ${filled ? c+"55" : "var(--hair)"}`}}>
            {filled && <div className="w-1 h-1 rounded-full" style={{background: c}}/>}
          </div>
        );
      })}
    </div>
  );
}

function MiniMonitored({ integrity }) {
  const color = integrity > 75 ? "var(--green)" : integrity > 55 ? "var(--amber)" : "var(--rose)";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9">
        <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="3"/>
          <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${integrity * 0.88} 100`} strokeLinecap="round"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold mono" style={{color}}>{integrity}</div>
      </div>
      <div className="text-[11px] text-[var(--ink-3)] font-bold leading-tight">
        <div>Integrity</div>
        <div className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{color}}>{integrity > 75 ? "Clean" : integrity > 55 ? "Watch" : "Flag"}</div>
      </div>
    </div>
  );
}

function MiniSketch({ seed }) {
  const c = NAMES[seed % NAMES.length][2];
  return (
    <svg viewBox="0 0 120 70" className="w-[120px] h-[70px] block">
      <rect width="120" height="70" fill="white" stroke="var(--hair)"/>
      {[0,1,2].map(i => (
        <g key={i} transform={`translate(${5 + i*38}, 8)`}>
          <rect width="34" height="48" fill="none" stroke={c} strokeWidth="0.7" strokeDasharray="1.5 1.5"/>
          <path d={i===0 ? "M 6 12 L 17 4 L 28 12 L 28 36 L 17 44 L 6 36 Z" : i===1 ? "M 8 12 L 26 12 L 26 36 L 8 36 Z M 14 8 L 20 8 L 20 40 L 14 40 Z" : "M 4 22 L 30 22 L 30 28 L 4 28 Z"} fill="none" stroke={c} strokeWidth="1.2"/>
        </g>
      ))}
    </svg>
  );
}

function MiniAnnotate({ seed }) {
  const c = NAMES[seed % NAMES.length][2];
  const n = (seed % 4) + 2;
  return (
    <svg viewBox="0 0 120 70" className="w-[120px] h-[70px]">
      <rect width="120" height="70" fill="#F5F1EA"/>
      <rect x="10" y="10" width="100" height="50" fill="white" stroke="var(--hair)"/>
      <path d="M 30 30 L 60 25 L 90 35" stroke="rgba(0,0,0,0.4)" strokeWidth="1" fill="none"/>
      {Array.from({length: n}).map((_, i) => (
        <circle key={i} cx={20 + i*15} cy={20 + (i%3)*10} r="3" fill={c} fillOpacity="0.6" stroke="white" strokeWidth="1"/>
      ))}
    </svg>
  );
}

// Pick mini renderer by tile type
function TilePreview({ tile, studentId, studentIdx }) {
  const cell = DATA[studentId].tiles[tile.id];
  if (!cell.submitted) {
    return <div className="text-[11px] text-[var(--rose)] font-extrabold uppercase tracking-wider">No submission</div>;
  }
  if (tile.type === "text")     return <MiniText studentId={studentId} seed={studentIdx}/>;
  if (tile.type === "toolkit")  return <MiniToolkit studentId={studentId} seed={studentIdx}/>;
  if (tile.type === "monitored")return <MiniMonitored integrity={cell.integrity}/>;
  if (tile.type === "upload")   return <MiniSketch seed={studentIdx}/>;
  if (tile.type === "annotate") return <MiniAnnotate seed={studentIdx}/>;
  return null;
}

// ================= LEVEL CHIP =================
const QUALITY_LABELS = ["Emerging", "Developing", "Achieving", "Mastering"];
const QUALITY_COLORS = ["#EF4444", "#F59E0B", "#14B8A6", "#7C3AED"];

function ScorePill({ score, max = 8, suggested, confidence, confirmed, onClick }) {
  const pct = score / max;
  const color = pct < 0.4 ? "#EF4444" : pct < 0.6 ? "#F59E0B" : pct < 0.8 ? "#14B8A6" : "#7C3AED";
  const conf = { high: 1, med: 0.65, low: 0.4 }[confidence] ?? 1;
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      className={`relative inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-[11.5px] font-extrabold border transition ${confirmed ? "" : "border-dashed"}`}
      style={{
        background: confirmed ? color : `${color}18`,
        color: confirmed ? "white" : color,
        borderColor: confirmed ? color : `${color}55`,
        opacity: suggested ? 1 : 0.5,
      }}
    >
      {suggested && !confirmed && <I name="sparkles" size={9} s={3}/>}
      <span className="mono">{score}</span>
      {confirmed && <I name="check" size={10} s={3}/>}
      {!confirmed && confidence === "low" && <span className="text-[8.5px] font-extrabold uppercase tracking-wider">?</span>}
    </motion.button>
  );
}

// =====================================================================
// ARTBOARD A — CALIBRATE (horizontal-first per question)
// =====================================================================
function CalibrateView() {
  const [activeTileIdx, setActiveTileIdx] = React.useState(3); // start on Joinery sketches
  const [scores, setScores] = React.useState({}); // {studentId: {tileId: {score, confirmed}}}
  const [expandedStudent, setExpandedStudent] = React.useState("s0");

  const tile = TILES[activeTileIdx];
  const criterion = CRITERIA.find(c => c.id === tile.criterion);

  const studentList = NAMES.map((_, si) => `s${si}`);
  const submitted = studentList.filter(id => DATA[id].tiles[tile.id].submitted);
  const confirmedCount = studentList.filter(id => scores[id]?.[tile.id]?.confirmed).length;

  const setScore = (sid, val, confirmed = true) => {
    setScores(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [tile.id]: { score: val, confirmed } } }));
  };

  const acceptAI = (sid) => {
    const ai = DATA[sid].tiles[tile.id].aiScore;
    setScore(sid, ai, true);
  };

  const acceptAllHigh = () => {
    studentList.forEach(sid => {
      const cell = DATA[sid].tiles[tile.id];
      if (cell.submitted && cell.confidence === "high" && !scores[sid]?.[tile.id]?.confirmed) {
        setScore(sid, cell.aiScore, true);
      }
    });
  };

  return (
    <div className="bg-[var(--bg)] flex flex-col" style={{ width: 1440, height: 920 }}>
      {/* Top bar */}
      <header className="border-b border-[var(--hair)] bg-[var(--paper)] px-5 h-14 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--ink)] flex items-center justify-center text-[var(--paper)] display text-[14px]">#</div>
          <div className="display text-[15px] leading-none">StudioLoom</div>
          <div className="text-[11.5px] text-[var(--ink-3)] font-bold">/ Marking</div>
        </div>
        <div className="text-[11.5px] text-[var(--ink-3)] font-bold inline-flex items-center gap-2">
          <span>{UNIT}</span>
          <I name="chevR" size={10} s={2.5}/>
          <span>{LESSON}</span>
          <I name="chevR" size={10} s={2.5}/>
          <span className="text-[var(--ink)] font-extrabold">{CLASS}</span>
        </div>
        <div className="flex-1"/>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/60 border border-[var(--hair)]">
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[var(--ink)] text-[var(--paper)]">Calibrate</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Synthesize</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Studio Floor</button>
        </div>
        <button className="btn-secondary rounded-full px-3 py-1.5 text-[11.5px]">Export grades</button>
      </header>

      {/* Tile strip — the horizontal axis */}
      <div className="bg-[var(--paper)] border-b border-[var(--hair)] px-5 py-3 flex items-center gap-2">
        <div className="cap text-[var(--ink-3)] mr-1">Question</div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {TILES.map((t, i) => {
            const isActive = i === activeTileIdx;
            const tileConfirmed = studentList.filter(id => scores[id]?.[t.id]?.confirmed).length;
            const c = CRITERIA.find(c => c.id === t.criterion);
            return (
              <motion.button
                key={t.id}
                onClick={() => setActiveTileIdx(i)}
                layout
                className={`relative flex-shrink-0 rounded-xl px-3 py-2 text-left transition border ${isActive ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "bg-white/60 border-[var(--hair)] hover:border-[var(--hair-2)]"}`}
                whileTap={{ scale: 0.97 }}
                style={{ minWidth: 180 }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="cap" style={{ color: isActive ? c.color : c.color, opacity: isActive ? 1 : 0.9 }}>Q{t.n} · {c.label}</span>
                  <I name={t.icon} size={10} s={2.5}/>
                </div>
                <div className={`text-[11.5px] font-extrabold leading-tight line-clamp-1 ${isActive ? "" : "text-[var(--ink)]"}`}>{t.title}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className={`flex-1 h-1 rounded-full overflow-hidden ${isActive ? "bg-white/20" : "bg-[var(--hair)]"}`}>
                    <div className="h-full rounded-full" style={{ width: `${(tileConfirmed/24)*100}%`, background: isActive ? "white" : c.color }}/>
                  </div>
                  <div className={`mono text-[10px] font-extrabold ${isActive ? "text-white/80" : "text-[var(--ink-3)]"}`}>{tileConfirmed}/24</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Calibration banner */}
      <div className="px-5 py-2.5 bg-[var(--paper)] border-b border-[var(--hair)] flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--purple)" }}>
          <I name="sparkles" size={11} s={3}/> AI pre-scored {submitted.length} responses
        </div>
        <div className="text-[11.5px] text-[var(--ink-2)] font-bold">
          {studentList.filter(id => DATA[id].tiles[tile.id].confidence === "high").length} high confidence ·
          {" "}{studentList.filter(id => DATA[id].tiles[tile.id].confidence === "med").length} medium ·
          {" "}<span style={{color: "var(--rose)"}}>{studentList.filter(id => DATA[id].tiles[tile.id].confidence === "low").length} low — review these first</span>
        </div>
        <div className="flex-1"/>
        <button onClick={acceptAllHigh} className="text-[11.5px] font-extrabold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.12)", color: "var(--purple)" }}>
          <I name="check" size={11} s={3}/> Accept all high-confidence
        </button>
        <div className="text-[11.5px] font-extrabold mono">
          <span className="text-[var(--ink)]">{confirmedCount}</span><span className="text-[var(--ink-3)]">/24 confirmed</span>
        </div>
      </div>

      {/* Body — rows */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {/* Question header — re-shown so teacher always sees prompt + criterion */}
        <div className="mb-4 flex items-baseline gap-3">
          <div className="cap" style={{ color: criterion.color }}>Q{tile.n} · {criterion.label}</div>
          <div className="serif-em text-[22px] leading-tight text-[var(--ink)]">"{tile.title}"</div>
        </div>

        <LayoutGroup>
        <div className="space-y-1.5">
          {studentList.map((sid, si) => {
            const stud = DATA[sid];
            const cell = stud.tiles[tile.id];
            const userScore = scores[sid]?.[tile.id];
            const confirmed = userScore?.confirmed;
            const isExpanded = expandedStudent === sid;
            const conf = cell.confidence;

            return (
              <motion.div
                key={sid}
                layout
                className={`rounded-xl border transition relative ${confirmed ? "bg-[var(--paper)] border-[var(--hair)]" : "bg-white/60 border-[var(--hair)]"}`}
              >
                <div className="grid grid-cols-[200px_140px_1fr_auto_auto] gap-3 items-center px-3 py-2.5">
                  {/* Student */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0" style={{ background: stud.color }}>
                      {stud.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-extrabold truncate">{stud.first} {stud.last}</div>
                      <div className="text-[10px] text-[var(--ink-3)] font-bold inline-flex items-center gap-1">
                        {stud.late && <span className="text-[var(--rose)] font-extrabold">Late</span>}
                        {!cell.submitted && <span className="text-[var(--rose)] font-extrabold">No submission</span>}
                        {cell.submitted && !stud.late && <span>Submitted</span>}
                      </div>
                    </div>
                  </div>

                  {/* Mini preview */}
                  <div className="flex items-center justify-center">
                    <TilePreview tile={tile} studentId={sid} studentIdx={si}/>
                  </div>

                  {/* AI evidence quote — the crucial column */}
                  <div className="min-w-0">
                    {cell.submitted ? (
                      <div className="flex items-start gap-1.5">
                        <div className="flex-shrink-0 mt-0.5" style={{ color: "var(--purple)" }}><I name="sparkles" size={10} s={3}/></div>
                        <div className="text-[12px] text-[var(--ink-2)] leading-snug italic line-clamp-2">"{cell.aiQuote}"</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--ink-3)] italic">—</div>
                    )}
                  </div>

                  {/* AI score / confidence */}
                  {cell.submitted && (
                    <div className="flex items-center gap-1.5">
                      <div className="text-right">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">AI suggests</div>
                        <div className="flex items-center gap-1 justify-end">
                          <ScorePill score={confirmed ? userScore.score : cell.aiScore} suggested={true} confirmed={confirmed} confidence={conf}/>
                          {!confirmed && <span className={`text-[9px] font-extrabold uppercase tracking-wider ${conf === "low" ? "text-[var(--rose)]" : conf === "med" ? "text-[var(--amber)]" : "text-[var(--green)]"}`}>{conf}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  <div className="flex items-center gap-1">
                    {!confirmed && cell.submitted && (
                      <>
                        <motion.button onClick={() => acceptAI(sid)} whileTap={{scale:0.92}} className="rounded-full px-2.5 py-1.5 text-[11px] font-extrabold inline-flex items-center gap-1 bg-[var(--ink)] text-[var(--paper)]">
                          <I name="check" size={11} s={3}/> Confirm
                        </motion.button>
                        <button onClick={() => setExpandedStudent(isExpanded ? null : sid)} className="rounded-full px-2 py-1.5 text-[11px] font-extrabold text-[var(--ink-2)] hover:bg-white/60 inline-flex items-center gap-0.5">
                          Override <I name={isExpanded ? "chevD" : "chevR"} size={10} s={3}/>
                        </button>
                      </>
                    )}
                    {confirmed && (
                      <button onClick={() => setScores(prev => { const n = {...prev}; if (n[sid]) delete n[sid][tile.id]; return n; })} className="text-[10.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] inline-flex items-center gap-1">
                        <I name="check" size={10} s={3}/> Confirmed · Undo
                      </button>
                    )}
                    {!cell.submitted && (
                      <button className="text-[10.5px] font-bold text-[var(--rose)] inline-flex items-center gap-1">
                        <I name="flag" size={10} s={3}/> Mark missing
                      </button>
                    )}
                  </div>
                </div>

                {/* Expand: full work + override controls */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-[var(--hair)]"
                    >
                      <div className="px-3 py-3 grid grid-cols-[1fr_280px] gap-4">
                        <div>
                          <div className="cap text-[var(--ink-3)] mb-2">Full submission</div>
                          <div className="card-soft p-3 text-[12.5px] text-[var(--ink-2)] leading-relaxed">
                            {tile.type === "text" && <p>"{cell.aiQuote}" Beyond that, {stud.first} writes about how the brief shifted their thinking on materials — they note that the wood-to-metal ratio is something they hadn't considered as a design lever, and propose three sketches investigating different ratios. The reflection is honest without being self-flagellating.</p>}
                            {tile.type === "upload" && <div className="aspect-[5/3] bg-white rounded-lg border border-[var(--hair)] flex items-center justify-center text-[var(--ink-3)] text-[11px]"><I name="image" size={20}/> · Full sketch view</div>}
                            {tile.type === "toolkit" && <div className="aspect-[2/1] bg-white rounded-lg border border-[var(--hair)] flex items-center justify-center text-[var(--ink-3)] text-[11px]"><I name="grid" size={20}/> · Empathy map full view</div>}
                            {tile.type === "monitored" && <p>"{cell.aiQuote}" Pace data: 18 minutes total, no idle gaps over 90 seconds, two pastes (both small — quotation from the brief). Cadence matches typical writing pattern for this student.</p>}
                            {tile.type === "annotate" && <div className="aspect-[2/1] bg-white rounded-lg border border-[var(--hair)] flex items-center justify-center text-[var(--ink-3)] text-[11px]"><I name="annotate" size={20}/> · Annotated reference image</div>}
                          </div>
                        </div>
                        <div>
                          <div className="cap text-[var(--ink-3)] mb-2">Override score</div>
                          <div className="card-soft p-3">
                            <div className="grid grid-cols-8 gap-1 mb-2">
                              {Array.from({length: 8}).map((_, i) => {
                                const v = i + 1;
                                const isAi = v === cell.aiScore;
                                const isPicked = userScore?.score === v;
                                return (
                                  <button key={v} onClick={() => setScore(sid, v, true)} className={`relative aspect-square rounded-md border text-[11px] font-extrabold mono transition ${isPicked ? "bg-[var(--ink)] text-white border-[var(--ink)]" : "bg-white/60 border-[var(--hair)] text-[var(--ink-2)] hover:border-[var(--hair-2)]"}`}>
                                    {v}
                                    {isAi && !isPicked && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{background: "var(--purple)"}}><I name="sparkles" size={6} s={3}/></span>}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="text-[10.5px] text-[var(--ink-3)] font-bold flex items-center gap-1"><I name="sparkles" size={9} s={3}/> AI: {cell.aiScore}/8 · Tap to override</div>
                            <textarea rows={2} placeholder="Optional override note (private)..." className="w-full mt-2 text-[11.5px] bg-white/50 border border-[var(--hair)] rounded-md p-2 focus:outline-none focus:border-[var(--hair-2)] resize-none"/>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        </LayoutGroup>
      </div>

      {/* Footer keyboard hints */}
      <div className="border-t border-[var(--hair)] bg-[var(--paper)] px-5 py-2.5 flex items-center gap-4 text-[10.5px] text-[var(--ink-3)] font-bold">
        <span><kbd>J</kbd>/<kbd>K</kbd> next/prev student</span>
        <span><kbd>↵</kbd> confirm AI</span>
        <span><kbd>1</kbd>–<kbd>8</kbd> override score</span>
        <span><kbd>O</kbd> open work</span>
        <span><kbd>⌘</kbd>+<kbd>→</kbd> next question</span>
        <div className="flex-1"/>
        <span className="text-[var(--ink-2)] font-extrabold">Calibrating Q{tile.n} of {TILES.length}</span>
        <button className="rounded-full px-3 py-1 text-[11px] font-extrabold bg-[var(--ink)] text-[var(--paper)] inline-flex items-center gap-1">
          Next question <I name="arrow" size={10} s={3}/>
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// ARTBOARD B — SYNTHESIZE (per-student, after calibration)
// =====================================================================
function SynthesizeView() {
  const [activeId, setActiveId] = React.useState("s0");
  const [draftMode, setDraftMode] = React.useState({});
  const [comments, setComments] = React.useState({});

  const stud = DATA[activeId];
  const studentList = NAMES.map((_, si) => `s${si}`);
  const idx = studentList.indexOf(activeId);
  const past = PAST_FEEDBACK[activeId];

  // Compute per-criterion average from tile scores (using AI scores as stand-in for "all confirmed")
  const criterionScore = (cid) => {
    const tilesForCrit = TILES.filter(t => t.criterion === cid);
    const scores = tilesForCrit.map(t => stud.tiles[t.id].aiScore).filter(Boolean);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
  };

  return (
    <div className="bg-[var(--bg)] flex flex-col" style={{ width: 1440, height: 920 }}>
      <header className="border-b border-[var(--hair)] bg-[var(--paper)] px-5 h-14 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--ink)] flex items-center justify-center text-[var(--paper)] display text-[14px]">#</div>
          <div className="display text-[15px] leading-none">StudioLoom</div>
          <div className="text-[11.5px] text-[var(--ink-3)] font-bold">/ Marking · Synthesize</div>
        </div>
        <div className="text-[11.5px] text-[var(--ink-3)] font-bold inline-flex items-center gap-2">
          <span>{LESSON}</span>
          <I name="chevR" size={10} s={2.5}/>
          <span className="text-[var(--ink)] font-extrabold">{CLASS}</span>
        </div>
        <div className="flex-1"/>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/60 border border-[var(--hair)]">
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Calibrate</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[var(--ink)] text-[var(--paper)]">Synthesize</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Studio Floor</button>
        </div>
        <div className="text-[11px] font-bold text-[var(--ink-3)] mono"><span className="text-[var(--ink)] font-extrabold">{idx + 1}</span> / {studentList.length}</div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Student rail */}
        <div className="w-[220px] flex-shrink-0 border-r border-[var(--hair)] bg-[var(--bg)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--hair)]">
            <div className="cap text-[var(--ink-3)] mb-1">Synthesis</div>
            <div className="display text-[15px]">23 ready · 1 to write</div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {studentList.map((sid, si) => {
              const s = DATA[sid];
              const isActive = sid === activeId;
              const allScored = TILES.every(t => s.tiles[t.id].submitted);
              return (
                <button key={sid} onClick={() => setActiveId(sid)} className={`w-full text-left rounded-lg px-2 py-2 flex items-center gap-2 transition ${isActive ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-white/60"}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0" style={{background: s.color}}>{s.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11.5px] font-extrabold truncate ${isActive ? "" : ""}`}>{s.first} {s.last}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {CRITERIA.map(c => (
                        <div key={c.id} className="w-3 h-1 rounded-full" style={{background: c.color, opacity: 0.6}}/>
                      ))}
                      {!allScored && <span className={`text-[9px] font-extrabold ${isActive ? "text-[var(--paper)]/70" : "text-[var(--rose)]"}`}>incomplete</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center — student work compiled */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="px-7 py-5"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white display text-[16px] flex-shrink-0" style={{background: stud.color}}>{stud.initials}</div>
                <div className="flex-1">
                  <div className="display text-[26px] leading-tight">{stud.first} {stud.last}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)] font-bold">{LESSON} · 8 of 8 tiles · scores calibrated against full class</div>
                </div>
              </div>

              {/* Past feedback callout — the unconventional "memory" feature */}
              {past && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} key={`past-${activeId}`} className="mb-5 rounded-xl p-3.5 flex items-start gap-2.5" style={{background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)"}}>
                  <div className="flex-shrink-0 mt-0.5" style={{color: "var(--amber)"}}><I name="history" size={14} s={2.5}/></div>
                  <div className="flex-1">
                    <div className="cap mb-0.5" style={{color: "var(--amber)"}}>You said {past.date}</div>
                    <div className="serif-em text-[15px] leading-snug text-[var(--ink-2)]">"{past.quote}"</div>
                    <div className="text-[11px] text-[var(--ink-3)] font-bold mt-1.5">Reference this in your feedback?</div>
                  </div>
                  <button className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white/60 border border-[var(--hair)] hover:border-[var(--hair-2)] inline-flex items-center gap-1">
                    <I name="quote" size={10} s={2.5}/> Use
                  </button>
                </motion.div>
              )}

              {/* Tile grid — every tile in the lesson, mini-render */}
              <div className="cap text-[var(--ink-3)] mb-2">Their work · 8 tiles</div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {TILES.map((t, ti) => {
                  const cell = stud.tiles[t.id];
                  const c = CRITERIA.find(c => c.id === t.criterion);
                  return (
                    <button key={t.id} className="card-soft p-2.5 text-left hover:border-[var(--hair-2)] transition group">
                      <div className="flex items-center gap-1 mb-1.5">
                        <I name={t.icon} size={10} s={2.5}/>
                        <span className="cap text-[var(--ink-3)]">Q{t.n}</span>
                        <div className="flex-1"/>
                        <span className="text-[10px] font-extrabold mono" style={{color: c.color}}>{cell.aiScore}/8</span>
                      </div>
                      <div className="text-[10.5px] font-extrabold leading-tight line-clamp-2 mb-2 min-h-[26px]">{t.title}</div>
                      <div className="rounded bg-white/60 border border-[var(--hair)] p-1.5 flex items-center justify-center min-h-[60px]">
                        <TilePreview tile={t} studentId={activeId} studentIdx={idx}/>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — rubric scores + per-criterion comment */}
        <div className="w-[440px] flex-shrink-0 border-l border-[var(--hair)] bg-[var(--bg)] overflow-y-auto">
          <div className="p-5 space-y-3">
            <div>
              <div className="cap text-[var(--ink-3)] mb-2">Rubric · auto-assembled from calibration</div>
              <div className="space-y-2">
                {CRITERIA.map(c => {
                  const score = criterionScore(c.id);
                  const tiles = TILES.filter(t => t.criterion === c.id);
                  const open = draftMode[c.id];
                  return (
                    <div key={c.id} className="card-soft overflow-hidden">
                      <button onClick={() => setDraftMode(d => ({...d, [c.id]: !d[c.id]}))} className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-white/40">
                        <div className="w-1.5 h-9 rounded-full" style={{background: c.color}}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-extrabold">{c.label}</div>
                          <div className="text-[10.5px] text-[var(--ink-3)] font-bold">From {tiles.length} tile{tiles.length>1?"s":""} · {tiles.map(t => "Q"+t.n).join(", ")}</div>
                        </div>
                        <div className="display text-[20px] leading-none mono" style={{color: c.color}}>{score}<span className="text-[12px] text-[var(--ink-3)]">/8</span></div>
                        <I name={open ? "chevD" : "chevR"} size={12} s={2.5}/>
                      </button>
                      <AnimatePresence>
                        {open && (
                          <motion.div initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} className="overflow-hidden">
                            <div className="px-3 pb-3 pt-1 border-t border-[var(--hair)]">
                              <div className="cap text-[var(--ink-3)] mb-1.5 inline-flex items-center gap-1"><I name="sparkles" size={10} s={3}/> AI draft from evidence</div>
                              <div className="rounded-lg p-2.5 mb-2 text-[11.5px] leading-snug" style={{background: `${c.color}11`, border: `1px solid ${c.color}33`}}>
                                "{stud.first}'s {c.label.toLowerCase()} shows {QUALITY_LABELS[Math.min(3, Math.floor(score/2))]} understanding. Particularly strong on {tiles[0]?.title.toLowerCase()} — {DATA[activeId].tiles[tiles[0].id].aiQuote.slice(0, 60)}..."
                              </div>
                              <textarea rows={3} placeholder={`${c.label} comment...`} className="w-full text-[12px] bg-white/50 border border-[var(--hair)] rounded-md p-2 focus:outline-none focus:border-[var(--hair-2)] resize-none"/>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <button className="text-[10.5px] font-extrabold inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/60 border border-[var(--hair)]"><I name="sparkles" size={9} s={3}/> Use draft</button>
                                <button className="text-[10.5px] font-extrabold inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/60 border border-[var(--hair)]"><I name="quote" size={9} s={3}/> Quote evidence</button>
                                <button className="text-[10.5px] font-extrabold inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/60 border border-[var(--hair)]"><I name="mic" size={9} s={3}/> Voice</button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall comment */}
            <div className="card-soft p-3">
              <div className="cap text-[var(--ink-3)] mb-2">Overall feedback to {stud.first}</div>
              <div className="rounded-lg p-2.5 mb-2 text-[11.5px] leading-snug italic" style={{background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)"}}>
                "Strong showing across the lesson, {stud.first} — your sketches and trade-off thinking landed well. Building on what we discussed three weeks ago, your annotations have improved noticeably. Push next on..."
              </div>
              <textarea rows={3} placeholder="Final note to the student..." className="w-full text-[12px] bg-white/50 border border-[var(--hair)] rounded-md p-2 focus:outline-none focus:border-[var(--hair-2)] resize-none"/>
            </div>

            {/* Send */}
            <div className="flex items-center gap-2 pt-1">
              <button className="text-[11px] font-extrabold text-[var(--ink-2)] hover:text-[var(--ink)] px-3 py-2 rounded-full">Save & next</button>
              <div className="flex-1"/>
              <motion.button whileHover={{scale: 1.02}} whileTap={{scale: 0.97}} className="btn-primary rounded-full px-4 py-2.5 text-[12px] inline-flex items-center gap-1.5">
                <I name="send" size={11} s={2.5}/> Release to {stud.first}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ARTBOARD C — STUDIO FLOOR (clustered)
// =====================================================================
function StudioFloorView() {
  const [activeTileIdx, setActiveTileIdx] = React.useState(3);
  const [hoverCluster, setHoverCluster] = React.useState(null);
  const tile = TILES[activeTileIdx];
  const c = CRITERIA.find(c => c.id === tile.criterion);

  // Cluster students by AI quality (0..3) for this tile
  const clusters = [0,1,2,3].map(q => ({
    quality: q,
    students: NAMES.map((_, si) => `s${si}`).filter(sid => DATA[sid].tiles[tile.id].submitted && DATA[sid].tiles[tile.id].aiQuality === q),
  }));
  const noSub = NAMES.map((_, si) => `s${si}`).filter(sid => !DATA[sid].tiles[tile.id].submitted);

  return (
    <div className="bg-[var(--bg)] flex flex-col" style={{ width: 1440, height: 920 }}>
      <header className="border-b border-[var(--hair)] bg-[var(--paper)] px-5 h-14 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--ink)] flex items-center justify-center text-[var(--paper)] display text-[14px]">#</div>
          <div className="display text-[15px] leading-none">StudioLoom</div>
          <div className="text-[11.5px] text-[var(--ink-3)] font-bold">/ Marking · Studio Floor</div>
        </div>
        <div className="flex-1"/>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/60 border border-[var(--hair)]">
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Calibrate</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full text-[var(--ink-2)]">Synthesize</button>
          <button className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[var(--ink)] text-[var(--paper)]">Studio Floor</button>
        </div>
      </header>

      {/* Tile selector */}
      <div className="bg-[var(--paper)] border-b border-[var(--hair)] px-5 py-2.5 flex items-center gap-2 overflow-x-auto">
        {TILES.map((t, i) => (
          <button key={t.id} onClick={() => setActiveTileIdx(i)} className={`flex-shrink-0 text-[11px] font-extrabold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${i === activeTileIdx ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-white/60 border border-[var(--hair)] text-[var(--ink-2)]"}`}>
            <I name={t.icon} size={10} s={2.5}/> Q{t.n}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 px-7 py-5 overflow-auto">
          <div className="mb-4 flex items-baseline gap-3">
            <div className="cap" style={{color: c.color}}>Q{tile.n} · {c.label}</div>
            <div className="serif-em text-[22px] leading-tight">"{tile.title}"</div>
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)] font-bold mb-4">AI grouped responses by similarity. Hover a cluster to preview, click to bulk-score.</div>

          {/* Clusters laid out as cards */}
          <div className="grid grid-cols-2 gap-4">
            {clusters.map(cl => (
              <motion.div
                key={cl.quality}
                onMouseEnter={() => setHoverCluster(cl.quality)}
                onMouseLeave={() => setHoverCluster(null)}
                whileHover={{ y: -2 }}
                className="card-soft p-4 cursor-pointer"
                style={{ borderColor: hoverCluster === cl.quality ? QUALITY_COLORS[cl.quality] : undefined, borderWidth: hoverCluster === cl.quality ? 2 : 1 }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="display text-[18px] inline-flex items-center gap-2">
                    <span className="cap" style={{color: QUALITY_COLORS[cl.quality]}}>{QUALITY_LABELS[cl.quality]}</span>
                    <span className="mono text-[12px] text-[var(--ink-3)]">{cl.students.length}</span>
                  </div>
                  <button className="text-[10.5px] font-extrabold px-2 py-1 rounded-full" style={{background: `${QUALITY_COLORS[cl.quality]}18`, color: QUALITY_COLORS[cl.quality]}}>
                    Score all as {cl.quality * 2 + 1}–{cl.quality * 2 + 2}/8 →
                  </button>
                </div>

                {/* Avatar pile */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {cl.students.map(sid => {
                    const s = DATA[sid];
                    return <div key={sid} className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold" style={{background: s.color}} title={`${s.first} ${s.last}`}>{s.initials}</div>;
                  })}
                </div>

                {/* Common signal */}
                <div className="text-[11.5px] text-[var(--ink-2)] italic leading-snug pl-2 border-l-2" style={{borderColor: QUALITY_COLORS[cl.quality]}}>
                  "{AI_QUOTES[tile.type][cl.quality % AI_QUOTES[tile.type].length]}"
                </div>
              </motion.div>
            ))}
          </div>

          {noSub.length > 0 && (
            <div className="mt-4 card-soft p-3 flex items-center gap-3" style={{ borderColor: "var(--rose)", borderStyle: "dashed" }}>
              <div style={{color: "var(--rose)"}}><I name="flag" size={14} s={2.5}/></div>
              <div className="flex-1">
                <div className="text-[12px] font-extrabold">No submission · {noSub.length}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {noSub.map(sid => <div key={sid} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8.5px] font-extrabold" style={{background: DATA[sid].color}}>{DATA[sid].initials}</div>)}
                </div>
              </div>
              <button className="text-[10.5px] font-extrabold px-2.5 py-1.5 rounded-full bg-[var(--ink)] text-[var(--paper)]">Send reminder</button>
            </div>
          )}
        </div>

        {/* Side rail — outliers + override */}
        <div className="w-[320px] flex-shrink-0 border-l border-[var(--hair)] bg-[var(--bg)] overflow-y-auto">
          <div className="p-4">
            <div className="cap text-[var(--ink-3)] mb-2">Outliers · review individually</div>
            <div className="space-y-1.5">
              {clusters.flatMap(cl => cl.students).slice(0, 4).map(sid => {
                const s = DATA[sid];
                const cell = s.tiles[tile.id];
                if (cell.confidence !== "low") return null;
                return (
                  <button key={sid} className="w-full card-soft p-2.5 text-left hover:border-[var(--hair-2)]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold" style={{background: s.color}}>{s.initials}</div>
                      <div className="text-[12px] font-extrabold flex-1">{s.first} {s.last}</div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{color: "var(--rose)"}}>low conf</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-2)] italic line-clamp-2">"{cell.aiQuote}"</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
function App() {
  return (
    <DesignCanvas projectName="Grading v2">
      <DCSection id="thinking" title="Design rationale">
        <DCArtboard id="brief" label="The thinking" width={760} height={920}>
          <div className="bg-[var(--paper)] p-8 overflow-y-auto" style={{width: 760, height: 920}}>
            <div className="cap text-[var(--ink-3)] mb-2">Recommendation</div>
            <div className="display-lg text-[34px] leading-tight mb-4">Horizontal-first. <span className="text-[var(--ink-3)]">Then vertical synthesis.</span></div>
            <div className="serif-em text-[18px] leading-snug text-[var(--ink-2)] mb-6">"Calibration matters more than holism. The alternative is Sarah getting a 6 on day 1 and Liam getting a 4 on day 3 for identical work because the teacher's standard drifted."</div>

            <div className="space-y-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
              <div>
                <div className="cap text-[var(--ink-3)] mb-1.5" style={{color: "var(--accent)"}}>The mode</div>
                <p><b>Days 1–2 of marking is calibration.</b> AI pre-scores every tile. Teacher confirms-or-overrides per question across the whole class. 192 micro-judgements (24 students × 8 tiles) become 192 nods or 192 corrections — never blind reads.</p>
                <p className="mt-2"><b>Day 3 is synthesis.</b> Per-student vertical view, all rubric scores already in, evidence quotes pinned. Teacher writes one comment per criterion + overall. With AI drafts assembled from the very evidence used to score.</p>
              </div>

              <div>
                <div className="cap text-[var(--ink-3)] mb-1.5" style={{color: "var(--purple)"}}>The hardest UI problem</div>
                <p>Showing enough to trust the AI, not so much that horizontal becomes vertical.</p>
                <p className="mt-2 italic">The answer: <b>tight evidence quotes.</b> 8–15 words pulled directly from the student's response, the bit the AI used to justify its score. Transparent reasoning, not hidden authority.</p>
              </div>

              <div>
                <div className="cap text-[var(--ink-3)] mb-1.5" style={{color: "var(--amber)"}}>The unconventional move</div>
                <p>Show the teacher their own past feedback to that student in the synthesis view.</p>
                <p className="mt-2 italic">"You told Sarah three weeks ago her sketches lacked annotation. They're still light. Worth flagging again?"</p>
                <p className="mt-2">Most marking software treats every assessment as standalone. Real teachers carry context across weeks. The system should remember on their behalf.</p>
              </div>

              <div className="pt-3 border-t border-[var(--hair)]">
                <div className="cap text-[var(--ink-3)] mb-2">What's in the artboards →</div>
                <ul className="space-y-1.5 list-none">
                  <li><b>A · Calibrate</b> — horizontal, per-question. The default workspace.</li>
                  <li><b>B · Synthesize</b> — vertical per-student. Auto-assembled rubric. Past-feedback memory.</li>
                  <li><b>C · Studio Floor</b> — clustered. Power-user mode. Bulk-score by similarity.</li>
                </ul>
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="modes" title="The three modes">
        <DCArtboard id="calibrate" label="A · Calibrate (horizontal, default)" width={1440} height={920}>
          <CalibrateView/>
        </DCArtboard>
        <DCArtboard id="synthesize" label="B · Synthesize (vertical, per-student)" width={1440} height={920}>
          <SynthesizeView/>
        </DCArtboard>
        <DCArtboard id="studio-floor" label="C · Studio Floor (clustered)" width={1440} height={920}>
          <StudioFloorView/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
