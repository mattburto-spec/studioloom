// Teacher dashboard redesign — cockpit-style.
// Reuses NavIcon & chrome pattern from scope_app but with richer dashboard body.

const T_PROGRAMS = [
  { id: "all",     name: "All programs",       color: "#1A1A2E", icon: "🏠", count: { classes: 6, units: 4, students: 42 } },
  { id: "design",  name: "MYP Design",         color: "#E86F2C", icon: "🛠️", framework: "MYP", count: { classes: 4, units: 4, students: 34 } },
  { id: "pypx",    name: "PYPX",               color: "#9333EA", icon: "🌱", framework: "PYP", count: { classes: 1, units: 0, students: 18 } },
  { id: "service", name: "Service as Action",  color: "#10B981", icon: "🤝", framework: "MYP", count: { classes: 1, units: 0, students: 12 } },
];

const T_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "classes",   label: "Classes",   icon: "users" },
  { id: "units",     label: "Units",     icon: "grid2" },
  { id: "toolkit",   label: "Toolkit",   icon: "tool" },
  { id: "badges",    label: "Badges",    icon: "shield" },
  { id: "alerts",    label: "Alerts",    icon: "alert" },
  { id: "students",  label: "Students",  icon: "people" },
  { id: "library",   label: "Library",   icon: "book" },
];

const TIcon = ({ kind, size = 15, stroke = 1.75 }) => {
  const p = { strokeWidth: stroke, stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size, viewBox: "0 0 24 24" };
  const d = {
    grid:   <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    users:  <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>,
    grid2:  <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>,
    tool:   <svg {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    shield: <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    alert:  <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>,
    people: <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>,
    book:   <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15"/></svg>,
    chev:   <svg {...p}><path d="M6 9l6 6 6-6"/></svg>,
    chevR:  <svg {...p}><path d="M9 18l6-6-6-6"/></svg>,
    gear:   <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
    arrow:  <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
    check:  <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>,
    cal:    <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    flag:   <svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15"/></svg>,
    play:   <svg {...p} fill="currentColor" stroke="none"><path d="M6 4l14 8-14 8V4z"/></svg>,
    more:   <svg {...p}><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>,
    clock:  <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
    bolt:   <svg {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
    sparkle:<svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
    msg:    <svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z"/></svg>,
    pencil: <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    file:   <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
    target: <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>,
  };
  return d[kind] || null;
};

// ============ CHROME ============
function TScopeChip({ scope, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const cur = T_PROGRAMS.find(p => p.id === scope);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg pl-1.5 pr-2 py-1 h-9">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[13px]" style={{ background: `${cur.color}1a` }}>{cur.icon}</div>
        <div className="text-[12.5px] font-extrabold text-[#1A1A2E] whitespace-nowrap">{cur.name}</div>
        <div className="text-gray-400"><TIcon kind="chev" size={12}/></div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute top-full mt-1.5 left-0 bg-white border border-gray-200 rounded-xl shadow-xl w-72 py-2 z-40">
            {T_PROGRAMS.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left ${scope===p.id?"bg-gray-50":""}`}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[14px]" style={{ background: `${p.color}1a` }}>{p.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-extrabold text-[#1A1A2E]">{p.name}</div>
                  <div className="text-[10px] text-gray-500">{p.framework ? `${p.framework} · ` : ""}{p.count.students} students · {p.count.classes} classes</div>
                </div>
                {scope === p.id && <div className="text-[#9333EA]"><TIcon kind="check" size={14}/></div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TChrome({ scope, onScope }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-5 h-14 flex items-center gap-3">
        <div className="flex items-center gap-2 pr-1">
          <div className="w-7 h-7 rounded-md bg-[#9333EA] flex items-center justify-center text-white font-extrabold text-[13px]">#</div>
          <div className="text-[14px] font-extrabold tracking-tight text-[#1A1A2E]">StudioLoom</div>
        </div>
        <div className="h-5 w-px bg-gray-200"/>
        <TScopeChip scope={scope} onSelect={onScope}/>
        <div className="h-5 w-px bg-gray-200"/>
        <nav className="flex items-center gap-0.5 flex-1">
          {T_NAV.map(n => (
            <button key={n.id}
              className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap transition
                ${n.id==="dashboard" ? "bg-[#F3EEFE] text-[#9333EA]" : "text-gray-700 hover:bg-gray-50"}`}>
              <TIcon kind={n.icon} size={14}/> {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-gray-500">
          <button className="w-8 h-8 rounded-lg hover:bg-gray-50 flex items-center justify-center"><TIcon kind="gear" size={15}/></button>
          <div className="text-[12.5px] font-bold text-[#1A1A2E]">Matt</div>
          <button className="text-[12px] font-bold text-gray-500 hover:text-[#1A1A2E] px-2">Log out</button>
        </div>
      </div>
    </header>
  );
}

// ============ DATA ============
const TODAY = {
  now: { period: 1, label: "Period 1", startsIn: 23, room: "Room D12" },
  schedule: [
    { period: "P1", time: "9:00",  class: "7 Design",        color: "#0EA5A4", unit: "Biomimicry: Nature-inspired packaging", phase: "Developing ideas", students: 18, ready: 14, ungraded: 3, state: "upcoming" },
    { period: "P2", time: "10:15", class: "9 Design Science",color: "#10B981", unit: "CO2 Racer: Speed through Science",       phase: "Testing",           students: 16, ready: 12, ungraded: 0, state: "upcoming" },
    { period: "P3", time: "11:30", class: "10 Design",       color: "#E86F2C", unit: "Interactive Pinball Machines",           phase: "Creating",          students: 14, ready: 14, ungraded: 7, state: "upcoming" },
    { period: "P5", time: "2:00",  class: "7 Design",        color: "#0EA5A4", unit: "Biomimicry: Nature-inspired packaging", phase: "Developing ideas", students: 18, ready: 14, ungraded: 3, state: "upcoming", note: "Lab booking needed" },
  ],
};

const UNITS = [
  {
    id: "co2", title: "CO2 Racer: Speed Through Science and Design",
    classTag: "10 Design", classColor: "#E86F2C", subject: "DESIGN", students: 3,
    phasePct: 2, img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=300&fit=crop",
    badges: [{ kind: "pink", label: "RE" }, { kind: "yellow" }],
  },
  {
    id: "biom", title: "Biomimicry; plastic pouch inspired by nature",
    classTag: "7 Design", classColor: "#0EA5A4", subject: "DESIGN", students: 1,
    phasePct: 0, img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=300&fit=crop",
    badges: [{ kind: "yellow" }],
  },
  {
    id: "coffee", title: "Designing and Building a Coffee Table",
    classTag: "10 Design", classColor: "#EC4899", subject: "DESIGN", students: 3,
    phasePct: 0, img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop",
    badges: [{ kind: "pink", label: "RE" }, { kind: "gray" }],
  },
  {
    id: "pinball", title: "Designing Interactive Pinball Machines with Electronics",
    classTag: "10 Design", classColor: "#E86F2C", subject: "DESIGN", students: 3,
    phasePct: 2, img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
    badges: [],
  },
];

const UNASSIGNED_CLASSES = [
  { name: "Service LEEDers", students: 2, color: "#3B82F6" },
  { name: "8 Design",        students: 0, color: "#9333EA" },
  { name: "Grade 8 Design",  students: 1, color: "#06B6D4" },
];

// ============ NOW BAR — hero ============
function NowBar() {
  const n = TODAY.now;
  const nextPeriod = TODAY.schedule[0];
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: `linear-gradient(100deg, ${nextPeriod.color} 0%, #1A1A2E 100%)` }}>
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}/>
      <div className="relative flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex flex-col items-center flex-shrink-0">
            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-white/70">Starts in</div>
            <div className="text-[28px] font-extrabold leading-none mt-0.5">{n.startsIn}<span className="text-[14px]">m</span></div>
            <div className="text-[10px] text-white/70 mt-1">{nextPeriod.time}</div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"/> {n.label} · {nextPeriod.class} · {n.room}
            </div>
            <div className="text-[22px] font-extrabold tracking-tight leading-tight mt-1">{nextPeriod.unit}</div>
            <div className="text-white/80 text-[12px] mt-1 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1"><TIcon kind="target" size={11}/> {nextPeriod.phase}</span>
              <span className="inline-flex items-center gap-1"><TIcon kind="people" size={11}/> {nextPeriod.ready}/{nextPeriod.students} ready</span>
              {nextPeriod.ungraded > 0 && <span className="inline-flex items-center gap-1 text-[#FBBF24] font-bold"><TIcon kind="pencil" size={11}/> {nextPeriod.ungraded} to grade</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="bg-[#FBBF24] text-[#1A1A2E] font-extrabold text-[13px] px-4 py-2.5 rounded-lg hover:brightness-105 inline-flex items-center gap-1.5">
            <TIcon kind="play" size={13}/> Start teaching
          </button>
          <button className="bg-white/10 hover:bg-white/20 text-white font-bold text-[12.5px] px-3 py-2.5 rounded-lg">Lesson plan</button>
        </div>
      </div>
    </div>
  );
}

// ============ SCHEDULE STRIP ============
function ScheduleStrip() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-500">Today's teaching</div>
          <div className="text-[14px] font-extrabold text-[#1A1A2E]">Monday · 20 April · 4 periods</div>
        </div>
        <button className="text-[11.5px] font-bold text-[#9333EA]">Full week →</button>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {TODAY.schedule.map((s, i) => (
          <div key={i} className="relative bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm cursor-pointer transition">
            <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ background: s.color }}/>
            <div className="pl-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-extrabold text-[#1A1A2E]">{s.period} · {s.time}</div>
                {s.note && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>}
              </div>
              <div className="text-[10.5px] font-bold mt-0.5" style={{ color: s.color }}>{s.class}</div>
              <div className="text-[11.5px] font-semibold text-[#1A1A2E] mt-1.5 line-clamp-2 leading-snug">{s.unit}</div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                <span>{s.students} st</span>
                {s.ungraded > 0 && <span className="text-amber-600 font-bold">{s.ungraded} grade</span>}
                {s.note && <span className="text-amber-600 font-bold">{s.note}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ INSIGHTS ROW — cross-cutting patterns ============
const INSIGHTS = [
  {
    severity: "high", color: "#F43F5E", tint: "#FEE2E2",
    headline: "5 students stuck across 3 units",
    detail: "Marcus (Biomimicry), Theo & Zara (Coffee Table), Ava & Elena (CO2 Racer) — no meaningful activity in 10+ days.",
    trend: "+2 this week",
    who: ["MJ","TD","ZA","AS","EM"],
    cta: "Review & nudge",
  },
  {
    severity: "med", color: "#F59E0B", tint: "#FEF3C7",
    headline: "15 pieces of unmarked work",
    detail: "Oldest is 10 days. Concentrated in CO2 Racer (5) and Pinball (7). Grading session ~45 min.",
    trend: "Oldest: 10d",
    who: null, count: 15,
    cta: "Open queue",
  },
  {
    severity: "med", color: "#3B82F6", tint: "#DBEAFE",
    headline: "Keystroke activity dropping",
    detail: "4 students have logged <20 keystrokes this week across Design Journal tasks — typical baseline is 200+.",
    trend: "↓ 62% vs last wk",
    who: ["AS","ZA","RK","NO"],
    cta: "See students",
  },
  {
    severity: "good", color: "#10B981", tint: "#D1FAE5",
    headline: "Pinball engagement surging",
    detail: "7 students submitted research early — highest voluntary output of any unit this term. Worth celebrating.",
    trend: "↑ 38% vs avg",
    who: ["RK","JC","AS","MC"],
    cta: "Send shout-out",
  },
];

function InsightCard({ i }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3.5 hover:shadow-md hover:border-gray-300 transition cursor-pointer flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: i.tint, color: i.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.color }}/>
          {i.severity === "high" ? "Act now" : i.severity === "med" ? "Watch" : "Good news"}
        </div>
        <div className="text-[10px] font-bold text-gray-500">{i.trend}</div>
      </div>
      <div className="text-[13.5px] font-extrabold text-[#1A1A2E] leading-snug">{i.headline}</div>
      <div className="text-[11px] text-gray-600 leading-relaxed mt-1 flex-1">{i.detail}</div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-gray-100">
        {i.who ? (
          <div className="flex items-center">
            {i.who.slice(0, 4).map((a, idx) => (
              <div key={idx} className="w-5 h-5 rounded-full text-white flex items-center justify-center font-extrabold text-[8px] border-2 border-white -ml-1 first:ml-0"
                style={{ background: `hsl(${(idx*73 + i.headline.length) % 360} 55% 50%)` }}>{a}</div>
            ))}
            {i.who.length > 4 && <div className="text-[10px] text-gray-500 font-bold ml-1">+{i.who.length - 4}</div>}
          </div>
        ) : (
          <div className="text-[11px] font-extrabold text-[#1A1A2E]">{i.count} items</div>
        )}
        <button className="text-[11px] font-extrabold hover:underline inline-flex items-center gap-1" style={{ color: i.color }}>
          {i.cta} <TIcon kind="arrow" size={10}/>
        </button>
      </div>
    </div>
  );
}

function InsightsRow() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <TIcon kind="sparkle" size={11}/> Insights · this week
          </div>
          <div className="text-[14px] font-extrabold text-[#1A1A2E]">Patterns across your classes</div>
        </div>
        <button className="text-[11.5px] font-bold text-[#9333EA]">All insights →</button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {INSIGHTS.map((i, idx) => <InsightCard key={idx} i={i}/>)}
      </div>
    </div>
  );
}

// ============ INBOX STRIP ============
function InboxStrip() {
  const items = [
    { kind: "msg",    text: "Noah replied on Coffee Table critique",     when: "1 h",    color: "#3B82F6" },
    { kind: "alert",  text: "Period 5 lab needs booking confirmation",   when: "2 h",    color: "#F43F5E" },
    { kind: "msg",    text: "Priya shared sketchbook · Biomimicry",      when: "3 h",    color: "#3B82F6" },
    { kind: "flag",   text: "2 classes still without units assigned",    when: "3 d",    color: "#9CA3AF" },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-4 overflow-x-auto">
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        <TIcon kind="bolt" size={13}/>
        <div className="text-[11px] font-extrabold text-[#1A1A2E]">Inbox</div>
        <span className="text-[10px] font-bold text-gray-400">· 4</span>
      </div>
      <div className="h-5 w-px bg-gray-200 flex-shrink-0"/>
      <div className="flex items-center gap-3 overflow-x-auto">
        {items.map((it, i) => (
          <button key={i} className="flex items-center gap-2 text-[11.5px] whitespace-nowrap hover:bg-gray-50 rounded-lg px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: it.color }}/>
            <span className="font-semibold text-[#1A1A2E]">{it.text}</span>
            <span className="text-gray-400">· {it.when}</span>
          </button>
        ))}
      </div>
      <button className="ml-auto text-[11px] font-bold text-gray-500 hover:text-[#1A1A2E] flex-shrink-0">Clear all</button>
    </div>
  );
}

// ============ UNIT CARD — clean, matches reference ============
function StatusBadge({ b }) {
  if (b.kind === "pink") {
    return <div className="w-6 h-6 rounded bg-pink-500 text-white text-[9px] font-extrabold flex items-center justify-center">{b.label}</div>;
  }
  if (b.kind === "yellow") {
    return <div className="w-6 h-6 rounded bg-amber-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white"/></div>;
  }
  if (b.kind === "gray") {
    return <div className="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-gray-300"/></div>;
  }
  return null;
}

function UnitCard({ u }) {
  return (
    <div className="group bg-white border-t-[3px] rounded-xl overflow-hidden hover:shadow-md transition flex"
      style={{ borderTopColor: u.classColor, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      {/* Cover */}
      <div className="w-32 h-[88px] flex-shrink-0 relative overflow-hidden bg-gray-100">
        <img src={u.img} alt="" className="w-full h-full object-cover"/>
        <div className="absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white"
          style={{ background: u.classColor }}>
          {u.subject}
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 px-4 py-3 flex items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-extrabold" style={{ color: u.classColor }}>{u.classTag}</span>
            <span className="text-[10.5px] text-gray-400">{u.students} student{u.students===1?"":"s"}</span>
          </div>
          <div className="text-[15px] font-extrabold text-[#1A1A2E] mt-0.5 leading-snug truncate">{u.title}</div>
          {/* Progress */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[380px]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(u.phasePct, 1)}%`, background: u.classColor }}/>
            </div>
            <div className="text-[10.5px] text-gray-500 font-bold w-8">{u.phasePct}%</div>
          </div>
        </div>
        {/* Badges */}
        {u.badges.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {u.badges.map((b, i) => <StatusBadge key={i} b={b}/>)}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button className="text-white font-extrabold text-[12px] px-3.5 py-1.5 rounded-md inline-flex items-center gap-1 hover:brightness-110"
            style={{ background: u.classColor }}>
            <TIcon kind="play" size={11}/> Teach
          </button>
          <button className="text-[12px] font-bold text-gray-600 hover:text-[#1A1A2E]">Hub</button>
          <button className="text-[12px] font-bold text-gray-600 hover:text-[#1A1A2E]">Edit</button>
        </div>
      </div>
    </div>
  );
}

// ============ BODY ============
function Body({ scope }) {
  const units = UNITS;

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-5 flex flex-col gap-4">
      <NowBar/>
      <ScheduleStrip/>
      <InsightsRow/>

      <div>
        <div className="flex items-baseline justify-between mb-2 mt-1">
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-500">Active units · {units.length}</div>
            <div className="text-[14px] font-extrabold text-[#1A1A2E]">Units currently being taught</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-[11.5px] font-bold text-gray-500 hover:text-[#1A1A2E] px-2 py-1">Filter</button>
            <button className="text-[11.5px] font-bold text-gray-500 hover:text-[#1A1A2E] px-2 py-1">Sort</button>
            <button className="text-[11.5px] font-extrabold text-white bg-[#9333EA] px-2.5 py-1 rounded-md hover:bg-[#7E22CE]">+ New unit</button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {units.map(u => <UnitCard key={u.id} u={u}/>)}
        </div>
      </div>

      {/* Soft admin — folded away */}
      <details className="bg-gray-50/80 border border-gray-200 rounded-2xl group">
        <summary className="cursor-pointer list-none p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-600">Admin</span>
            <span className="text-[11.5px] text-gray-600">{UNASSIGNED_CLASSES.length} classes without units · 4 drafts</span>
          </div>
          <div className="text-[11px] font-bold text-gray-500 group-open:hidden">Open ▾</div>
          <div className="text-[11px] font-bold text-gray-500 hidden group-open:block">Close ▴</div>
        </summary>
        <div className="px-3.5 pb-3.5 pt-1 flex flex-wrap gap-2">
          {UNASSIGNED_CLASSES.map((c, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-[11.5px]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }}/>
              <span className="font-bold text-[#1A1A2E]">{c.name}</span>
              <span className="text-gray-500">· {c.students} st</span>
              <button className="ml-2 text-[#9333EA] font-bold hover:underline">Assign unit →</button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ============ APP ============
const T_TWEAKS = /*EDITMODE-BEGIN*/{
  "scope": "all",
  "density": "comfortable"
}/*EDITMODE-END*/;

function TeacherApp() {
  const [scope, setScope] = React.useState(T_TWEAKS.scope);
  const [tweaksOn, setTweaksOn] = React.useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <TChrome scope={scope} onScope={setScopeP}/>
      <Body scope={scope}/>
      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-72 overflow-hidden">
          <div className="bg-[#1A1A2E] text-white px-4 py-2.5 text-[12px] font-extrabold">Tweaks</div>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Scope</div>
              <div className="flex flex-col gap-1">
                {T_PROGRAMS.map(p => (
                  <button key={p.id} onClick={() => setScopeP(p.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11.5px] font-bold
                      ${scope===p.id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                    <span className="text-[14px]">{p.icon}</span> {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10.5px] text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              The "Now" bar, schedule, and inbox are cockpit tools. Units split into "Needs attention" vs "On track" — calm stuff doesn't compete for focus.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TeacherApp/>);
