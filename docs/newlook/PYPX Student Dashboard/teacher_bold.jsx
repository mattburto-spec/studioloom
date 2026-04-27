// Bold / premium product-page teacher dashboard.
// Bricolage Grotesque display + DM Sans body. Rounded, colorful, photographic.

const PROGRAMS = [
  { id: "all",     name: "All programs",       color: "#0A0A0A", icon: "🏠" },
  { id: "design",  name: "MYP Design",         color: "#E86F2C", icon: "🛠" },
  { id: "pypx",    name: "PYPX",               color: "#9333EA", icon: "🌱" },
  { id: "service", name: "Service as Action",  color: "#10B981", icon: "🤝" },
];

const NAV = ["Dashboard", "Classes", "Units", "Toolkit", "Badges", "Alerts", "Students", "Library"];

const NEXT = {
  period: "Period 1", startsIn: 23, time: "9:00 AM",
  room: "D12", class: "7 Design", color: "#0EA5A4",
  colorDark: "#0F766E", colorTint: "#CCFBF1",
  title: "Biomimicry",
  sub: "Plastic pouch inspired by nature",
  phase: "Developing ideas", phasePct: 34,
  students: 18, ready: 14, ungraded: 3,
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=1100&fit=crop",
};

const SCHEDULE = [
  { num: "01", time: "9:00",  class: "7 Design",         color: "#0EA5A4", tint: "#CCFBF1", unit: "Biomimicry",                   sub: "Developing ideas · 18 students", state: "next",     progress: 34, ungraded: 3 },
  { num: "02", time: "10:15", class: "9 Design Science", color: "#10B981", tint: "#D1FAE5", unit: "CO2 Racer",                    sub: "Testing · 16 students",           state: "upcoming", progress: 62, ungraded: 0 },
  { num: "03", time: "11:30", class: "10 Design",        color: "#E86F2C", tint: "#FED7AA", unit: "Interactive Pinball",          sub: "Investigating · 14 students",     state: "upcoming", progress: 8,  ungraded: 7 },
  { num: "05", time: "14:00", class: "7 Design",         color: "#0EA5A4", tint: "#CCFBF1", unit: "Biomimicry",                   sub: "Developing ideas · 18 students",  state: "upcoming", progress: 34, ungraded: 3, note: "Lab booking" },
];

const INSIGHTS = [
  {
    bg: "#FEE2E2", accent: "#DC2626", text: "#7F1D1D",
    tag: "Act now",
    big: "5",
    unit: "students stuck",
    body: "Marcus, Theo, Zara, Ava & Elena — no meaningful activity in 10+ days. Spread across Biomimicry and Coffee Table.",
    who: ["MJ","TD","ZA","AS","EM"],
    cta: "Review & message",
  },
  {
    bg: "#FEF3C7", accent: "#D97706", text: "#78350F",
    tag: "To grade",
    big: "15",
    unit: "pieces waiting",
    body: "Oldest is 10 days old. Most are in CO2 Racer (5) and Pinball (7). A focused session clears it in ~45 min.",
    count: true,
    cta: "Open queue",
  },
  {
    bg: "#DBEAFE", accent: "#2563EB", text: "#1E3A8A",
    tag: "Watch",
    big: "↓62%",
    unit: "keystroke drop",
    body: "4 students logged under 20 keystrokes this week in Design Journal. Typical baseline is 200+.",
    who: ["AS","ZA","RK","NO"],
    cta: "See students",
  },
  {
    bg: "#D1FAE5", accent: "#059669", text: "#064E3B",
    tag: "Celebrate",
    big: "↑38%",
    unit: "Pinball surge",
    body: "7 students submitted research ahead of schedule — the highest voluntary output of any unit this term.",
    who: ["RK","JC","AS","MC"],
    cta: "Send shout-out",
  },
];

const UNITS = [
  {
    id: "co2", title: "CO2 Racer",
    kicker: "Speed Through Science & Design",
    classTag: "10 Design", color: "#E86F2C", tint: "#FFEDD5", students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",
    due: "Race day · Apr 28",
    badges: ["pink-re", "amber"],
  },
  {
    id: "biom", title: "Biomimicry",
    kicker: "Plastic pouch inspired by nature",
    classTag: "7 Design", color: "#0EA5A4", tint: "#CCFBF1", students: 1, progress: 0,
    img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",
    due: "Sketchbook · Apr 25",
    badges: ["amber"],
  },
  {
    id: "coffee", title: "Coffee Table",
    kicker: "Designing and building a coffee table",
    classTag: "10 Design", color: "#EC4899", tint: "#FCE7F3", students: 3, progress: 0,
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",
    due: "First prototype · May 3",
    badges: ["pink-re", "gray"],
  },
  {
    id: "pinball", title: "Pinball Machines",
    kicker: "Interactive design with electronics",
    classTag: "10 Design", color: "#9333EA", tint: "#E9D5FF", students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",
    due: "Research · Apr 30",
    badges: [],
  },
];

const UNASSIGNED = [
  { name: "Service LEEDers", students: 2, color: "#3B82F6" },
  { name: "8 Design",        students: 0, color: "#9333EA" },
  { name: "Grade 8 Design",  students: 1, color: "#06B6D4" },
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
    gear:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  };
  return <svg {...p}>{shapes[name]}</svg>;
};

// ================= TOP NAV =================
function TopNav({ scope, onScope }) {
  const [open, setOpen] = React.useState(false);
  const cur = PROGRAMS.find(p => p.id === scope);
  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-lg border-b border-[var(--hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">#</div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </div>

        <div className="w-px h-6 bg-[var(--hair)] mx-1"/>

        {/* Scope chip */}
        <div className="relative">
          <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-2 bg-white border border-[var(--hair)] rounded-full pl-2 pr-3 py-1.5 hover:shadow-sm transition">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]" style={{ background: `${cur.color}1a` }}>{cur.icon}</span>
            <span className="text-[12.5px] font-bold">{cur.name}</span>
            <span className="text-[var(--ink-3)]"><I name="chev" size={12} s={2.5}/></span>
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl card-shadow-lg w-64 p-1.5">
                {PROGRAMS.map(p => (
                  <button key={p.id} onClick={() => { onScope(p.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition
                      ${scope===p.id ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"}`}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[13px]" style={{ background: `${p.color}1a` }}>{p.icon}</span>
                    <span className="flex-1 text-[12.5px] font-bold">{p.name}</span>
                    {scope === p.id && <I name="check" size={13} s={2.5}/>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 ml-2">
          {NAV.map((n, i) => (
            <button key={n} className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition
              ${i===0 ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-white"}`}>
              {n}
            </button>
          ))}
        </nav>

        <div className="flex-1"/>

        {/* Right */}
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)]"><I name="search" size={16}/></button>
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative">
          <I name="bell" size={16}/>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E86F2C] border-2 border-[var(--bg)]"/>
        </button>
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-bold text-[11px]">MG</div>
        </div>
      </div>
    </header>
  );
}

// ================= NOW HERO =================
function NowHero() {
  const n = NEXT;
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner" style={{ background: n.color }}>
        <div className="grid grid-cols-12 gap-0 items-stretch">
          {/* Left: content */}
          <div className="col-span-7 p-10 flex flex-col justify-between text-white relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
                <span className="pulse" style={{ color: "#FFF" }}/>
                Next up · {n.period} · starts in
                <span className="tnum font-extrabold ml-1">{n.startsIn} min</span>
              </div>
              <h1 className="display-lg text-[108px] leading-[0.88] mt-6 text-white">{n.title}.</h1>
              <p className="text-[22px] leading-snug mt-3 text-white/85 max-w-md font-medium">{n.sub}</p>
            </div>

            {/* Meta pills */}
            <div className="flex items-center gap-2 mt-8 flex-wrap">
              <span className="bg-white rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: n.color }}>
                <span className="w-5 h-5 rounded-full bg-current opacity-20"/>
                <span style={{ color: n.colorDark }}>{n.class}</span>
              </span>
              <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white">{n.phase}</span>
              <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white tnum">{n.ready} / {n.students} ready</span>
              <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-3 py-1 text-[12px] font-extrabold">{n.ungraded} to grade</span>
              <span className="text-white/70 text-[12px] font-semibold ml-1">Room {n.room} · {n.time}</span>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                <I name="play" size={12} s={0}/> Start teaching
              </button>
              <button className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]">Lesson plan</button>
              <button className="text-white/70 hover:text-white rounded-full px-3 py-3 font-semibold text-[13px]">Skip →</button>
            </div>
          </div>

          {/* Right: image */}
          <div className="col-span-5 relative">
            <div className="absolute inset-0">
              <img src={n.img} alt="" className="w-full h-full object-cover"/>
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${n.color} 0%, transparent 35%)` }}/>
            </div>
            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 card-shadow">
              <div className="cap text-[var(--ink-3)]">Phase progress</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="display text-[32px] leading-none tnum" style={{ color: n.colorDark }}>{n.phasePct}%</div>
                <div className="text-[11px] text-[var(--ink-3)]">of developing ideas</div>
              </div>
              <div className="mt-2 w-40 h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${n.phasePct}%`, background: n.color }}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= TODAY RAIL =================
function TodayRail() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Today · Mon 20 Apr</div>
          <h2 className="display text-[32px] leading-none mt-1">Your day, at a glance.</h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">See week <I name="chevR" size={12} s={2.5}/></button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {SCHEDULE.map((s, i) => (
          <div key={i} className={`relative rounded-2xl p-5 cursor-pointer transition hover:-translate-y-0.5 overflow-hidden
            ${s.state === "next" ? "ring-live" : ""}`}
            style={{ background: s.tint, border: `1px solid ${s.color}22` }}>
            <div className="flex items-start justify-between">
              <div className="display text-[44px] leading-none tnum" style={{ color: s.color }}>{s.num}</div>
              <div className="flex flex-col items-end gap-1">
                {s.state === "next" && (
                  <span className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ color: s.color }}>
                    <span className="pulse" style={{ color: s.color, width: 6, height: 6 }}/> NEXT
                  </span>
                )}
                <span className="text-[11px] font-bold tnum" style={{ color: s.color }}>{s.time}</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-extrabold" style={{ color: s.color }}>{s.class}</div>
              <div className="display text-[18px] leading-tight mt-0.5 text-[var(--ink)]">{s.unit}</div>
              <div className="text-[11px] text-[var(--ink-3)] mt-1 line-clamp-1">{s.sub}</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${s.color}33` }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(s.progress, 2)}%`, background: s.color }}/>
              </div>
              {s.ungraded > 0 && (
                <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold tnum">{s.ungraded}</span>
              )}
              {s.note && (
                <span className="bg-[#FEE2E2] text-[#B91C1C] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold">!</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ================= INSIGHTS =================
function Insights() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Insights · This week</div>
          <h2 className="display text-[32px] leading-none mt-1">What deserves your attention.</h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">All insights <I name="chevR" size={12} s={2.5}/></button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {INSIGHTS.map((it, i) => (
          <article key={i} className="relative rounded-3xl p-6 hover:-translate-y-0.5 transition cursor-pointer flex flex-col min-h-[280px]"
            style={{ background: it.bg, color: it.text }}>
            <div className="flex items-center justify-between">
              <span className="cap" style={{ color: it.accent }}>{it.tag}</span>
              <button className="w-7 h-7 rounded-full hover:bg-white/60 flex items-center justify-center" style={{ color: it.text }}><I name="more" size={14}/></button>
            </div>
            <div className="display-lg text-[72px] leading-[0.9] mt-4 tnum" style={{ color: it.accent }}>{it.big}</div>
            <div className="text-[13px] font-bold mt-1">{it.unit}</div>
            <p className="text-[12.5px] leading-relaxed mt-3 flex-1" style={{ color: it.text, opacity: 0.85 }}>{it.body}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: `${it.accent}33` }}>
              {it.who ? (
                <div className="flex items-center">
                  {it.who.slice(0, 4).map((a, idx) => (
                    <div key={idx} className="w-7 h-7 rounded-full text-white flex items-center justify-center font-extrabold text-[9.5px] border-2 -ml-1.5 first:ml-0"
                      style={{ background: it.accent, borderColor: it.bg }}>{a}</div>
                  ))}
                  {it.who.length > 4 && <div className="text-[11px] ml-1 font-bold" style={{ color: it.accent }}>+{it.who.length - 4}</div>}
                </div>
              ) : <div/>}
              <button className="inline-flex items-center gap-1 text-[11.5px] font-extrabold hover:gap-2 transition-all" style={{ color: it.accent }}>
                {it.cta} <I name="arrow" size={11} s={2.5}/>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ================= UNITS =================
function StatusBadge({ kind }) {
  if (kind === "pink-re") return <div className="w-6 h-6 rounded-lg bg-[#EC4899] text-white text-[9px] font-extrabold flex items-center justify-center">RE</div>;
  if (kind === "amber")   return <div className="w-6 h-6 rounded-lg bg-[#FBBF24] flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white"/></div>;
  if (kind === "gray")    return <div className="w-6 h-6 rounded-lg border-2 border-[var(--hair)] flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-[var(--hair)]"/></div>;
  return null;
}

function UnitCard({ u }) {
  return (
    <article className="group bg-white rounded-3xl overflow-hidden card-shadow hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
      {/* Image */}
      <div className="aspect-[16/9] relative overflow-hidden" style={{ background: u.color }}>
        <img src={u.img} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"/>
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: u.color }}>
          <span className="w-5 h-5 rounded-full" style={{ background: u.color }}/>
          {u.classTag} · {u.students} student{u.students===1?"":"s"}
        </div>
        {u.badges.length > 0 && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {u.badges.map((b, i) => <StatusBadge key={i} kind={b}/>)}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="display text-[28px] leading-none">{u.title}</h3>
            <p className="text-[13.5px] text-[var(--ink-3)] mt-1.5 leading-snug">{u.kicker}</p>
          </div>
          <button className="btn-primary rounded-full px-5 py-2.5 text-[13px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <I name="play" size={10} s={0}/> Teach
          </button>
        </div>
        {/* Progress */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: u.tint }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(u.progress, 2)}%`, background: u.color }}/>
          </div>
          <div className="text-[11.5px] font-extrabold tnum" style={{ color: u.color }}>{u.progress}%</div>
        </div>
        {/* Footer */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-[var(--hair)]">
          <div className="text-[11.5px] font-bold" style={{ color: u.color }}>{u.due}</div>
          <div className="flex items-center gap-4 text-[11.5px] font-bold text-[var(--ink-3)]">
            <button className="hover:text-[var(--ink)]">Hub</button>
            <button className="hover:text-[var(--ink)]">Edit</button>
            <button className="hover:text-[var(--ink)]"><I name="more" size={14}/></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function UnitsGrid() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Active units · 4</div>
          <h2 className="display text-[32px] leading-none mt-1">Currently on the loom.</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">Filter</button>
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">Sort</button>
          <button className="btn-primary rounded-full px-4 py-2 text-[12.5px] inline-flex items-center gap-1.5"><I name="plus" size={12} s={3}/> New unit</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {UNITS.map(u => <UnitCard key={u.id} u={u}/>)}
      </div>
    </section>
  );
}

// ================= ADMIN =================
function Admin() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-20">
      <details className="group bg-white rounded-3xl border border-[var(--hair)] overflow-hidden">
        <summary className="cursor-pointer px-6 py-5 flex items-center justify-between hover:bg-[var(--bg)]/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg)] flex items-center justify-center text-[var(--ink-2)] font-extrabold text-[13px]">3</div>
            <div>
              <div className="display text-[18px] leading-none">Housekeeping</div>
              <div className="text-[12px] text-[var(--ink-3)] mt-0.5">3 classes without units · 4 drafts · last cleaned 6 days ago</div>
            </div>
          </div>
          <div className="text-[12px] font-bold text-[var(--ink-3)] group-open:hidden flex items-center gap-1">Open <I name="chev" size={12} s={2.5}/></div>
          <div className="text-[12px] font-bold text-[var(--ink-3)] hidden group-open:flex items-center gap-1">Close</div>
        </summary>
        <div className="px-6 pb-6 pt-2 flex flex-wrap gap-2">
          {UNASSIGNED.map((c, i) => (
            <div key={i} className="bg-[var(--bg)] rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px]">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }}/>
              <span className="font-extrabold">{c.name}</span>
              <span className="text-[var(--ink-3)]">{c.students} student{c.students===1?"":"s"}</span>
              <button className="ml-2 font-extrabold text-[var(--ink)] hover:underline">Assign unit →</button>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

// ================= APP =================
const B_TWEAKS = /*EDITMODE-BEGIN*/{
  "scope": "all",
  "displayFont": "Manrope"
}/*EDITMODE-END*/;

const FONT_OPTIONS = [
  { name: "Manrope",            tracking: "-0.035em", note: "Clean, premium, rounded (default)" },
  { name: "Bricolage Grotesque",tracking: "-0.04em",  note: "Playful, varied, original pick" },
  { name: "Space Grotesk",      tracking: "-0.025em", note: "Techy, Stripe-ish, confident" },
  { name: "Syne",               tracking: "-0.03em",  note: "Expressive, editorial-leaning" },
  { name: "Archivo",            tracking: "-0.035em", note: "Wide, bold, poster feel" },
  { name: "Unbounded",          tracking: "-0.04em",  note: "Condensed, display-y, distinctive" },
];

function App() {
  const [scope, setScope] = React.useState(B_TWEAKS.scope);
  const [displayFont, setDisplayFont] = React.useState(B_TWEAKS.displayFont || "Manrope");
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

  const setScopeP = (v) => {
    setScope(v);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { scope: v } }, "*");
  };
  const setFontP = (v) => {
    setDisplayFont(v);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { displayFont: v } }, "*");
  };

  return (
    <div className="min-h-screen">
      <TopNav scope={scope} onScope={setScopeP}/>
      <NowHero/>
      <TodayRail/>
      <Insights/>
      <UnitsGrid/>
      <Admin/>

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
            <div>
              <div className="cap text-[var(--ink-3)] mb-2">Scope</div>
              <div className="flex flex-col gap-1">
                {PROGRAMS.map(p => (
                  <button key={p.id} onClick={() => setScopeP(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-[11.5px] font-bold
                      ${scope===p.id?"bg-[var(--ink)] text-white border-[var(--ink)]":"bg-white text-[var(--ink)] border-[var(--hair)] hover:border-[var(--ink)]"}`}>
                    <span>{p.icon}</span> {p.name}
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
