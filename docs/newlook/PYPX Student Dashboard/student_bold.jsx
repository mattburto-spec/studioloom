// Student dashboard in the same "bold product-page" aesthetic.
// Manrope display + DM Sans body. Rounded, photographic, saturated per-unit color.

const STUDENT = { name: "Sam", first: "Sam", initials: "SM", avatarGrad: "from-[#E86F2C] to-[#EC4899]" };

const NAV_S = ["My work", "Units", "Badges", "Journal", "Resources"];

// Currently active — what Sam was doing last
const CURRENT = {
  unitTitle: "Biomimicry",
  unitSub: "Plastic pouch inspired by nature",
  class: "7 Design",
  color: "#0EA5A4", colorDark: "#0F766E", colorTint: "#CCFBF1",
  phase: "Developing ideas",
  phasePct: 34,
  currentTask: "Sketch 3 structural ideas",
  taskProgress: 1, taskTotal: 3,
  dueIn: "in 2 days",
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1000&h=1200&fit=crop",
  teacherNote: { from: "Mr. Griffiths", msg: "Your leaf sketch from Monday is a great start — try one with a radial vein pattern next?", when: "yesterday" },
};

// Up next / overdue — the real priority queue
const QUEUE = [
  { kind: "overdue", title: "Electronics & Soldering Safety", sub: "Complete required safety test", dueText: "Overdue · 10 days", due: "10/04/2026", color: "#DC2626", icon: "alert" },
  { kind: "today",   title: "Sketch 3 structural ideas",     sub: "Biomimicry · 7 Design",           dueText: "Today · by end of P1",  due: "20/04/2026", color: "#0EA5A4", icon: "clock" },
  { kind: "soon",    title: "PPE Fundamentals",              sub: "Complete required safety test",   dueText: "Due in 3 days",          due: "23/04/2026", color: "#D97706", icon: "shield" },
  { kind: "soon",    title: "3D Printer Safety",             sub: "Complete required safety test",   dueText: "Due in 3 days",          due: "23/04/2026", color: "#D97706", icon: "shield" },
  { kind: "soon",    title: "New Metrics checkpoint",         sub: "Complete your self-assessment",   dueText: "Due in 5 days",          due: "25/04/2026", color: "#EC4899", icon: "star" },
  { kind: "soon",    title: "Sketchbook review",             sub: "Upload this week's pages",         dueText: "Due in 5 days",          due: "25/04/2026", color: "#0EA5A4", icon: "book" },
];

// Units — student view
const S_UNITS = [
  { id: "biom",    title: "Biomimicry",           kicker: "Plastic pouch inspired by nature",      classTag: "7 Design",  color: "#0EA5A4", tint: "#CCFBF1", img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",    progress: 34, state: "in-progress", task: "Sketch 3 ideas", due: "Sketchbook · Apr 25" },
  { id: "arcade",  title: "Arcade Machine",       kicker: "Build a working coin-op arcade",        classTag: "Service",   color: "#EC4899", tint: "#FCE7F3", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900&h=600&fit=crop",    progress: 62, state: "in-progress", task: "Discovery journey", due: "First playtest · May 2" },
  { id: "coffee",  title: "Coffee Table",         kicker: "Designing and building a coffee table", classTag: "10 Design", color: "#9333EA", tint: "#E9D5FF", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",    progress: 12, state: "open-studio", task: "Open Studio available", due: "Prototype · May 3" },
  { id: "pinball", title: "Engineering a Pinball Machine", kicker: "Workshop unit · mechanical systems", classTag: "Workshop", color: "#F59E0B", tint: "#FEF3C7", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop", progress: 0, state: "not-started", task: "Start this unit", due: "Starts Apr 22" },
  { id: "recycle", title: "Recycling Awareness", kicker: "Correct bins across campus",            classTag: "Service",   color: "#10B981", tint: "#D1FAE5", img: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=900&h=600&fit=crop",    progress: 0, state: "not-started", task: "Start this unit", due: "Starts Apr 24" },
  { id: "co2",     title: "CO2 Racer",            kicker: "Speed Through Science & Design",        classTag: "10 Design", color: "#E86F2C", tint: "#FFEDD5", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",    progress: 0, state: "not-started", task: "Start this unit", due: "Starts Apr 28" },
];

// Badges
const BADGES = {
  earned: [
    { name: "General Workshop Safety", icon: "shield", color: "#10B981", when: "Earned 2 weeks ago" },
    { name: "Hand Tool Safety",        icon: "wrench", color: "#0EA5A4", when: "Earned 2 weeks ago" },
  ],
  next: [
    { name: "Electronics & Soldering", icon: "bolt",   color: "#D97706", progress: 0,  unlock: "Pass safety test" },
    { name: "3D Printer Safety",       icon: "print",  color: "#9333EA", progress: 40, unlock: "2 of 5 checks done" },
    { name: "Design Journal Streak",   icon: "flame",  color: "#EC4899", progress: 70, unlock: "7-day streak · 5/7" },
  ],
};

// Recent feedback — from teachers
const FEEDBACK = [
  { from: "Mr. Griffiths",  initials: "MG", grad: "from-[#9333EA] to-[#E86F2C]", unit: "Biomimicry", msg: "Your leaf sketch from Monday is a great start — try one with a radial vein pattern next?", when: "1d" },
  { from: "Ms. Tanaka",     initials: "KT", grad: "from-[#0EA5A4] to-[#3B82F6]", unit: "Arcade Machine", msg: "Excellent discovery journey entries this week. Love your research on marquee art history!", when: "3d" },
];

// ================= ICONS =================
const I = ({ name, size = 16, s = 2 }) => {
  const p = { strokeWidth: s, stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size, viewBox: "0 0 24 24" };
  const shapes = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    play:  <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>,
    check: <path d="M20 6L9 17l-5-5"/>,
    chev:  <path d="M6 9l6 6 6-6"/>,
    chevR: <path d="M9 6l6 6-6 6"/>,
    plus:  <path d="M12 5v14M5 12h14"/>,
    more:  <><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></>,
    bell:  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>,
    search:<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></>,
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    star:  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
    book:  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15"/>,
    wrench:<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>,
    bolt:  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>,
    print: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
    trophy:<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M12 15v6M8 21h8M6 4v5a6 6 0 0 0 12 0V4z"/>,
    msg:   <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z"/>,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
  };
  return <svg {...p}>{shapes[name]}</svg>;
};

// ================= TOP NAV =================
function TopNav() {
  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-lg border-b border-[var(--hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">#</div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </div>
        <div className="w-px h-6 bg-[var(--hair)] mx-1"/>
        <nav className="flex items-center gap-0.5">
          {NAV_S.map((n, i) => (
            <button key={n} className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition
              ${i===0 ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-white"}`}>
              {n}
            </button>
          ))}
        </nav>
        <div className="flex-1"/>
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)]"><I name="search" size={16}/></button>
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative">
          <I name="bell" size={16}/>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626] border-2 border-[var(--bg)]"/>
        </button>
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right">
            <div className="text-[12px] font-bold leading-none">{STUDENT.name}</div>
            <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5 leading-none">Year 7 · Design</div>
          </div>
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${STUDENT.avatarGrad} text-white flex items-center justify-center font-bold text-[11px]`}>{STUDENT.initials}</div>
        </div>
      </div>
    </header>
  );
}

// ================= HERO — Pick up where you left off =================
function RingProgress({ pct, size = 96, stroke = 8, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} className="ring-track"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (pct/100)*c}/>
    </svg>
  );
}

function ResumeHero() {
  const n = CURRENT;
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <div className="cap text-[var(--ink-3)]">Good morning, {n.class.split(" ")[0] === "7" ? STUDENT.first : STUDENT.first}</div>
          <h1 className="display-lg text-[44px] leading-[0.95] mt-1">Let's pick up where you left off.</h1>
        </div>
        <div className="text-[12px] text-[var(--ink-3)] font-semibold hidden md:block">Mon 20 Apr · 9:00 AM · <span className="text-[var(--ink)] font-extrabold">Period 1 starting soon</span></div>
      </div>

      <div className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner" style={{ background: n.color }}>
        <div className="grid grid-cols-12 gap-0 items-stretch">
          {/* Left — content */}
          <div className="col-span-7 p-9 text-white relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
              <span className="pulse" style={{ color: "#FFF" }}/>
              Currently working on · {n.class}
            </div>
            <h2 className="display-lg text-[88px] leading-[0.88] mt-5 text-white">{n.unitTitle}.</h2>
            <p className="text-[20px] leading-snug mt-2 text-white/85 max-w-md font-medium">{n.unitSub}</p>

            {/* Current task callout */}
            <div className="mt-7 bg-white rounded-2xl p-4 flex items-center gap-4 max-w-lg text-[var(--ink)]">
              <div className="relative flex-shrink-0">
                <RingProgress pct={(n.taskProgress / n.taskTotal) * 100} size={64} stroke={6} color={n.color}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="display text-[14px] tnum" style={{ color: n.colorDark }}>{n.taskProgress}<span className="text-[9px] text-[var(--ink-3)]">/{n.taskTotal}</span></div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="cap text-[var(--ink-3)]">Your current task</div>
                <div className="display text-[18px] leading-tight mt-0.5">{n.currentTask}</div>
                <div className="text-[11.5px] text-[var(--ink-3)] mt-1 font-semibold">Phase: <span className="text-[var(--ink)] font-bold">{n.phase}</span> · Due {n.dueIn}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                <I name="play" size={11} s={0}/> Continue
              </button>
              <button className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]">Open journal</button>
            </div>
          </div>

          {/* Right — image + teacher note */}
          <div className="col-span-5 relative">
            <div className="absolute inset-0">
              <img src={n.img} alt="" className="w-full h-full object-cover"/>
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${n.color} 0%, transparent 35%)` }}/>
            </div>
            {/* Teacher note floating */}
            <div className="absolute bottom-6 right-6 left-6 bg-white/95 backdrop-blur rounded-2xl p-4 card-shadow">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-extrabold text-[10px]">MG</div>
                <div>
                  <div className="text-[11.5px] font-extrabold">Mr. Griffiths <span className="font-semibold text-[var(--ink-3)]">· {n.teacherNote.when}</span></div>
                </div>
              </div>
              <p className="text-[12.5px] mt-2 leading-relaxed text-[var(--ink-2)]">"{n.teacherNote.msg}"</p>
              <button className="text-[11px] font-extrabold mt-2 hover:underline" style={{ color: n.colorDark }}>Reply in journal →</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= PRIORITY QUEUE =================
function Priority() {
  const overdue = QUEUE.filter(q => q.kind === "overdue");
  const today = QUEUE.filter(q => q.kind === "today");
  const soon = QUEUE.filter(q => q.kind === "soon");

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="grid grid-cols-12 gap-5">
        {/* Overdue — red loud */}
        <div className="col-span-4">
          <div className="cap text-[#DC2626] mb-3">Overdue · {overdue.length}</div>
          {overdue.map((q, i) => (
            <article key={i} className="relative rounded-3xl p-6 card-shadow-lg glow-inner overflow-hidden text-white" style={{ background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)" }}>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[10.5px] font-extrabold">
                <I name="alert" size={11} s={3}/> Overdue · 10 days
              </div>
              <h3 className="display text-[26px] leading-tight mt-4">{q.title}</h3>
              <p className="text-[13px] text-white/85 mt-1">{q.sub}</p>
              <div className="flex items-center gap-2 mt-5">
                <button className="bg-white text-[#991B1B] rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5 hover:shadow-lg">
                  Complete now <I name="arrow" size={11} s={2.5}/>
                </button>
                <button className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-2 font-bold text-[12px]">Snooze</button>
              </div>
            </article>
          ))}
        </div>

        {/* Today */}
        <div className="col-span-4">
          <div className="cap text-[var(--ink-2)] mb-3">Due today · {today.length}</div>
          {today.map((q, i) => (
            <article key={i} className="relative bg-white rounded-3xl p-6 card-shadow overflow-hidden" style={{ borderLeft: `6px solid ${q.color}` }}>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-extrabold" style={{ background: `${q.color}1a`, color: q.color }}>
                <I name="clock" size={11} s={3}/> {q.dueText}
              </div>
              <h3 className="display text-[22px] leading-tight mt-4">{q.title}</h3>
              <p className="text-[12.5px] text-[var(--ink-3)] mt-1">{q.sub}</p>
              <div className="flex items-center gap-2 mt-5">
                <button className="btn-primary rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5">
                  Open task <I name="arrow" size={11} s={2.5}/>
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Coming up list */}
        <div className="col-span-4">
          <div className="cap text-[var(--ink-2)] mb-3">Coming up · {soon.length}</div>
          <div className="bg-white rounded-3xl p-2 card-shadow">
            {soon.map((q, i) => (
              <button key={i} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--bg)] transition text-left">
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: `${q.color}1a`, color: q.color }}>
                  <I name={q.icon} size={14} s={2.2}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-extrabold leading-tight truncate">{q.title}</div>
                  <div className="text-[11px] text-[var(--ink-3)] truncate mt-0.5">{q.sub}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10.5px] font-extrabold" style={{ color: q.color }}>{q.dueText.replace("Due ", "")}</div>
                  <div className="text-[10px] text-[var(--ink-3)] tnum">{q.due}</div>
                </div>
              </button>
            ))}
            <button className="w-full text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] py-2">See all upcoming →</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= UNITS GRID =================
function UnitCard({ u }) {
  const isNotStarted = u.state === "not-started";
  const cta = isNotStarted ? "Start unit" : u.state === "open-studio" ? "Open Studio" : "Continue";
  return (
    <article className="group bg-white rounded-3xl overflow-hidden card-shadow hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="aspect-[16/9] relative overflow-hidden" style={{ background: u.color }}>
        <img src={u.img} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"/>
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${u.color}cc 0%, transparent 45%)` }}/>
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: u.color }}>
          <span className="w-5 h-5 rounded-full" style={{ background: u.color }}/>
          {u.classTag}
        </div>
        {/* Ring progress overlay */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-full p-1 flex items-center gap-1.5 pr-2.5">
          <div className="relative w-7 h-7 flex-shrink-0">
            <RingProgress pct={Math.max(u.progress, 0.5)} size={28} stroke={3} color={u.color}/>
          </div>
          <div className="text-[10.5px] font-extrabold tnum" style={{ color: u.color }}>{u.progress}%</div>
        </div>
      </div>
      <div className="p-5">
        <h3 className="display text-[22px] leading-none">{u.title}</h3>
        <p className="text-[12.5px] text-[var(--ink-3)] mt-1.5 leading-snug">{u.kicker}</p>

        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-[var(--hair)]">
          <div>
            <div className="text-[10.5px] text-[var(--ink-3)] font-semibold">{isNotStarted ? "Starts" : "Current task"}</div>
            <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: u.color }}>{u.task}</div>
          </div>
          <button className="text-white rounded-full px-4 py-2 font-extrabold text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap hover:brightness-110 transition" style={{ background: u.color }}>
            {cta} <I name="arrow" size={10} s={2.5}/>
          </button>
        </div>
        <div className="text-[10.5px] text-[var(--ink-3)] mt-2 font-semibold">{u.due}</div>
      </div>
    </article>
  );
}

function UnitsGrid() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Your units · 6</div>
          <h2 className="display text-[32px] leading-none mt-1">Everything you're working on.</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">In progress</button>
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm text-[var(--ink-3)]">All</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {S_UNITS.map(u => <UnitCard key={u.id} u={u}/>)}
      </div>
    </section>
  );
}

// ================= BADGES =================
function BadgeCircle({ b, size = 88 }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${b.color}35 0%, ${b.color}08 60%, transparent 85%)` }}/>
        <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${b.color} 0%, ${b.color}cc 100%)`, boxShadow: `0 8px 24px -8px ${b.color}80` }}>
          <div className="text-white"><I name={b.icon} size={size * 0.38} s={2}/></div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-extrabold leading-tight">{b.name}</div>
        {b.when && <div className="text-[10px] text-[var(--ink-3)] mt-0.5">{b.when}</div>}
      </div>
    </div>
  );
}

function BadgeProgress({ b }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[var(--hair)] flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
        <RingProgress pct={b.progress} size={52} stroke={4} color={b.color}/>
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: b.color }}>
          <I name={b.icon} size={20} s={2}/>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-extrabold leading-tight">{b.name}</div>
        <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5">{b.unlock}</div>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: `${b.color}1a` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(b.progress, 4)}%`, background: b.color }}/>
        </div>
      </div>
      <div className="text-[11px] font-extrabold tnum" style={{ color: b.color }}>{b.progress}%</div>
    </div>
  );
}

function Badges() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="grid grid-cols-12 gap-5">
        {/* Earned — celebratory */}
        <div className="col-span-5 relative rounded-3xl overflow-hidden card-shadow-lg glow-inner p-8 text-white"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)" }}>
          <div className="relative">
            <div className="cap text-white/60 inline-flex items-center gap-2"><I name="trophy" size={12} s={2.5}/> You've earned</div>
            <h2 className="display text-[56px] leading-none mt-1">2 badges<span className="text-[#FBBF24]">.</span></h2>
            <div className="text-[13px] text-white/70 mt-2">Nice work — both earned through your workshop safety tests.</div>
            <div className="mt-8 flex items-center gap-6">
              {BADGES.earned.map((b, i) => (
                <BadgeCircle key={i} b={{...b, when: null}} size={76}/>
              ))}
            </div>
          </div>
          {/* sparkle decoration */}
          <div className="absolute top-6 right-6 text-[#FBBF24] opacity-70"><I name="sparkle" size={48} s={1.5}/></div>
          <div className="absolute bottom-6 right-20 text-[#FBBF24] opacity-40"><I name="sparkle" size={24} s={1.5}/></div>
        </div>

        {/* Next up — progress */}
        <div className="col-span-7">
          <div className="cap text-[var(--ink-3)] mb-3">Next to unlock · 3</div>
          <div className="flex flex-col gap-2.5">
            {BADGES.next.map((b, i) => <BadgeProgress key={i} b={b}/>)}
          </div>
          <button className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] mt-3 inline-flex items-center gap-1">All badges <I name="chevR" size={11} s={2.5}/></button>
        </div>
      </div>
    </section>
  );
}

// ================= FEEDBACK =================
function Feedback() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-20">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Recent feedback · from teachers</div>
          <h2 className="display text-[32px] leading-none mt-1">What your teachers said.</h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">All messages <I name="chevR" size={12} s={2.5}/></button>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {FEEDBACK.map((f, i) => (
          <article key={i} className="bg-white rounded-3xl p-6 card-shadow flex gap-4 items-start">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${f.grad} text-white flex items-center justify-center font-extrabold text-[13px] flex-shrink-0`}>{f.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-extrabold">{f.from}</div>
                  <div className="text-[11px] text-[var(--ink-3)]">On {f.unit} · {f.when} ago</div>
                </div>
                <button className="text-[11px] font-extrabold hover:underline">Reply →</button>
              </div>
              <p className="text-[13.5px] mt-2 leading-relaxed text-[var(--ink-2)]">"{f.msg}"</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ================= APP =================
const S_TWEAKS = /*EDITMODE-BEGIN*/{
  "displayFont": "Manrope"
}/*EDITMODE-END*/;

const FONT_OPTIONS = [
  { name: "Manrope",            tracking: "-0.035em", note: "Clean, premium, rounded" },
  { name: "Bricolage Grotesque",tracking: "-0.04em",  note: "Playful, varied" },
  { name: "Space Grotesk",      tracking: "-0.025em", note: "Techy, confident" },
  { name: "Syne",               tracking: "-0.03em",  note: "Expressive" },
  { name: "Archivo",            tracking: "-0.035em", note: "Wide, bold, poster" },
  { name: "Unbounded",          tracking: "-0.04em",  note: "Condensed, display-y" },
];

function App() {
  const [displayFont, setDisplayFont] = React.useState(S_TWEAKS.displayFont || "Manrope");
  const [tweaksOn, setTweaksOn] = React.useState(false);

  React.useEffect(() => {
    const opt = FONT_OPTIONS.find(f => f.name === displayFont) || FONT_OPTIONS[0];
    document.documentElement.style.setProperty("--display-font", `"${opt.name}"`);
    document.documentElement.style.setProperty("--display-tracking", opt.tracking);
  }, [displayFont]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true);
      else if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", h);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", h);
  }, []);

  const setFontP = (v) => {
    setDisplayFont(v);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { displayFont: v } }, "*");
  };

  return (
    <div className="min-h-screen">
      <TopNav/>
      <ResumeHero/>
      <Priority/>
      <UnitsGrid/>
      <Badges/>
      <Feedback/>

      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl card-shadow-lg w-80 overflow-hidden border border-[var(--hair)] max-h-[80vh] flex flex-col">
          <div className="bg-[var(--ink)] text-white px-5 py-3 text-[12px] font-extrabold flex-shrink-0">Tweaks</div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <div>
              <div className="cap text-[var(--ink-3)] mb-2">Display font</div>
              <div className="flex flex-col gap-1.5">
                {FONT_OPTIONS.map(f => (
                  <button key={f.name} onClick={() => setFontP(f.name)}
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-left transition
                      ${displayFont===f.name?"bg-[var(--bg)] border-[var(--ink)]":"bg-white border-[var(--hair)] hover:border-[var(--ink)]"}`}>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: `"${f.name}"`, fontWeight: 700, letterSpacing: f.tracking, fontSize: 22, lineHeight: 1, color: "var(--ink)" }}>
                        Biomimicry.
                      </div>
                      <div className="text-[10.5px] text-[var(--ink-3)] mt-1 font-semibold">{f.name} — {f.note}</div>
                    </div>
                    {displayFont === f.name && <I name="check" size={14} s={3}/>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
