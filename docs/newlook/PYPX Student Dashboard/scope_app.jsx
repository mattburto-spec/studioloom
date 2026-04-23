// StudioLoom Scope Chip mock — matches real app chrome from screenshot.

const PROGRAMS = [
  { id: "all",     name: "All programs",       color: "#1A1A2E", icon: "🏠", framework: null,       count: { classes: 6, units: 4, students: 8 } },
  { id: "pypx",    name: "PYPX",               color: "#9333EA", icon: "🌱", framework: "PYP",     count: { classes: 1, units: 1, students: 18 } },
  { id: "design",  name: "MYP Design",         color: "#E86F2C", icon: "🛠️", framework: "MYP",     count: { classes: 2, units: 2, students: 32 } },
  { id: "service", name: "Service as Action",  color: "#10B981", icon: "🤝", framework: "MYP",     count: { classes: 1, units: 1, students: 32 } },
  { id: "pp",      name: "Personal Project",   color: "#3B82F6", icon: "🧭", framework: "MYP",     count: { classes: 1, units: 0, students: 4 }  },
];

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "classes",   label: "Classes",   icon: "users" },
  { id: "units",     label: "Units",     icon: "grid2" },
  { id: "toolkit",   label: "Toolkit",   icon: "tool" },
  { id: "badges",    label: "Badges",    icon: "shield" },
  { id: "alerts",    label: "Alerts",    icon: "alert" },
  { id: "students",  label: "Students",  icon: "people" },
  { id: "library",   label: "Library",   icon: "book" },
];

const NavIcon = ({ kind, size = 15 }) => {
  const p = { strokeWidth: 1.75, stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size, viewBox: "0 0 24 24" };
  const icons = {
    grid:   <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    users:  <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>,
    grid2:  <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>,
    tool:   <svg {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    shield: <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    alert:  <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>,
    people: <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>,
    book:   <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15"/></svg>,
    chev:   <svg {...p}><path d="M6 9l6 6 6-6"/></svg>,
    gear:   <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
    arrow:  <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
    check:  <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>,
    cal:    <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    flag:   <svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15"/></svg>,
  };
  return icons[kind] || null;
};

function ScopeChip({ scope, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const current = PROGRAMS.find(p => p.id === scope);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg pl-1.5 pr-2 py-1 transition h-9">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[13px]" style={{ background: `${current.color}1a` }}>
          {current.icon}
        </div>
        <div className="text-[12.5px] font-extrabold text-[#1A1A2E] whitespace-nowrap">{current.name}</div>
        <div className="text-gray-400"><NavIcon kind="chev" size={12}/></div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute top-full mt-1.5 left-0 bg-white border border-gray-200 rounded-xl shadow-xl w-72 py-2 z-40">
            <div className="px-3 pb-1 text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">Scope</div>
            {PROGRAMS.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left ${scope===p.id?"bg-gray-50":""}`}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[14px]" style={{ background: `${p.color}1a` }}>{p.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-extrabold text-[#1A1A2E]">{p.name}</div>
                  <div className="text-[10px] text-gray-500">
                    {p.framework ? `${p.framework} · ` : ""}{p.count.students} students · {p.count.classes} {p.count.classes===1?"class":"classes"}
                  </div>
                </div>
                {scope === p.id && <div className="text-[#9333EA]"><NavIcon kind="check" size={14}/></div>}
              </button>
            ))}
            <div className="h-px bg-gray-100 my-1.5"/>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-[11.5px] font-bold text-gray-600">
              <span className="text-[14px]">+</span> Add a program…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AppChrome({ scope, onScope, active }) {
  const current = PROGRAMS.find(p => p.id === scope);
  const scoped = scope !== "all";
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-5 h-14 flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-1">
          <div className="w-7 h-7 rounded-md bg-[#9333EA] flex items-center justify-center text-white font-extrabold text-[13px]">#</div>
          <div className="text-[14px] font-extrabold tracking-tight text-[#1A1A2E]">StudioLoom</div>
        </div>

        {/* Scope chip */}
        <div className="h-5 w-px bg-gray-200"/>
        <ScopeChip scope={scope} onSelect={onScope}/>
        <div className="h-5 w-px bg-gray-200"/>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 flex-1">
          {NAV.map(n => {
            const isActive = n.id === active;
            return (
              <button key={n.id}
                className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[12.5px] font-bold whitespace-nowrap transition
                  ${isActive ? "bg-[#F3EEFE] text-[#9333EA]" : "text-gray-700 hover:bg-gray-50"}`}>
                <NavIcon kind={n.icon} size={14}/>
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 text-gray-500">
          <button className="w-8 h-8 rounded-lg hover:bg-gray-50 flex items-center justify-center"><NavIcon kind="gear" size={15}/></button>
          <div className="text-[12.5px] font-bold text-[#1A1A2E]">Matt</div>
          <button className="text-[12px] font-bold text-gray-500 hover:text-[#1A1A2E] px-2">Log out</button>
        </div>
      </div>

      {/* Scope indicator strip — only visible when scoped */}
      {false && scoped && (
        <div className="border-t border-gray-100" style={{ background: `${current.color}08` }}>
          <div className="max-w-[1400px] mx-auto px-5 h-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: current.color }}/>
              <span className="font-bold" style={{ color: current.color }}>Viewing {current.name} only</span>
              <span className="text-gray-500">· Classes, Units, Students, Library & Alerts are filtered</span>
            </div>
            <button onClick={() => onScope("all")} className="text-[11px] font-bold text-gray-500 hover:text-[#1A1A2E]">Clear scope ×</button>
          </div>
        </div>
      )}
    </header>
  );
}

// ============ DASHBOARD CONTENT (reshapes by scope) ============

const ALL_UNITS = [
  { id: "co2",   title: "CO2 Racer: Speed Through Science and Design", programId: "design",  students: 3, cohort: "10 Design",  color: "#E86F2C", tint: "#FFEDD5", tag: "10 Design" },
  { id: "waste", title: "Where does our school waste go?",             programId: "pypx",    students: 18, cohort: "5 Blue · PYPX", color: "#9333EA", tint: "#EDE9FE", tag: "5 PYPX" },
  { id: "sa",    title: "Community Garden Build-out",                  programId: "service", students: 4, cohort: "8 Service",  color: "#10B981", tint: "#D1FAE5", tag: "8 Service" },
  { id: "pp",    title: "Personal Project supervision",                programId: "pp",      students: 4, cohort: "10 PP",      color: "#3B82F6", tint: "#DBEAFE", tag: "10 PP" },
];

function WelcomeBanner({ scope }) {
  const p = PROGRAMS.find(x => x.id === scope);
  const bg = scope === "all"
    ? "linear-gradient(100deg, #7C3AED 0%, #4F46E5 60%, #3B82F6 100%)"
    : `linear-gradient(100deg, ${p.color} 0%, #1A1A2E 100%)`;
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: bg }}>
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}/>
      <div className="relative flex items-center justify-between gap-x-6 gap-y-3 flex-wrap">
        <div className="flex flex-col min-w-0">
          <div className="text-[22px] font-extrabold tracking-tight leading-tight">Welcome back, Matt</div>
          <div className="text-white/70 text-[12px] mt-1">
            {scope === "all" ? "Updated just now · across all programs" : `Scoped to ${p.name} · ${p.framework}`}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div><div className="text-[22px] font-extrabold leading-none">{p.count.classes}</div><div className="text-[10.5px] text-white/70 mt-1">Classes</div></div>
          <div><div className="text-[22px] font-extrabold leading-none">{p.count.units}</div><div className="text-[10.5px] text-white/70 mt-1">Units</div></div>
          <div><div className="text-[22px] font-extrabold leading-none">{p.count.students}</div><div className="text-[10.5px] text-white/70 mt-1">Students</div></div>
        </div>
      </div>
    </div>
  );
}

function TodayCol() {
  return (
    <aside className="bg-white border border-gray-200 rounded-2xl p-4 w-full">
      <div className="flex items-center gap-2 text-[#9333EA]">
        <NavIcon kind="cal" size={14}/>
        <div className="text-[13px] font-extrabold text-[#1A1A2E]">Today</div>
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">Monday 20 Apr</div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Up next</div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
            <NavIcon kind="flag" size={10}/> 2 stuck
          </div>
          <div className="text-[12px] font-bold text-[#1A1A2E] mt-1 leading-snug">Jaylen &amp; Marcus · PYPX</div>
          <div className="text-[11px] text-gray-600 mt-0.5">Haven't checked in · 3+ days</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Meeting</div>
          <div className="text-[12px] font-bold text-[#1A1A2E] mt-1">Noah — PP supervisor check</div>
          <div className="text-[11px] text-gray-600 mt-0.5">3:30pm · 20 min</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Review</div>
          <div className="text-[12px] font-bold text-[#1A1A2E] mt-1">3 hour-log approvals · Service</div>
          <div className="text-[11px] text-gray-600 mt-0.5">Yusuf, Elena, Rani</div>
        </div>
      </div>
    </aside>
  );
}

function UnitCard({ unit }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition cursor-pointer">
      <div className="flex items-stretch">
        <div className="w-28 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${unit.color}, ${unit.tint})` }}>
          <div className="h-full w-full flex items-center justify-center text-white text-3xl">
            {PROGRAMS.find(p => p.id === unit.programId).icon}
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold" style={{ color: unit.color }}>{unit.tag}</span>
                <span className="text-[11px] text-gray-500">{unit.students} students</span>
              </div>
              <div className="text-[14px] font-extrabold text-[#1A1A2E] mt-1 leading-snug">{unit.title}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-rose-400"/>
              <div className="w-6 h-6 rounded-full bg-amber-400 -ml-2"/>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="text-[#9333EA] font-bold inline-flex items-center gap-1">Open unit <NavIcon kind="arrow" size={11}/></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardBody({ scope }) {
  const units = scope === "all" ? ALL_UNITS : ALL_UNITS.filter(u => u.programId === scope);
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-5 flex flex-col gap-5">
      <WelcomeBanner scope={scope}/>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <TodayCol/>
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                {scope === "all" ? "Across your programs" : `${PROGRAMS.find(p=>p.id===scope).name} units`}
              </div>
              <div className="text-[18px] font-extrabold text-[#1A1A2E]">Active units ({units.length})</div>
            </div>
            <button className="text-[11.5px] font-bold text-[#9333EA]">View all →</button>
          </div>
          {units.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
              <div className="text-[13px] font-bold text-[#1A1A2E]">No units in this program yet.</div>
              <div className="text-[11.5px] text-gray-500 mt-1">Create a unit or clear the scope to see everything.</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {units.map(u => <UnitCard key={u.id} unit={u}/>)}
          </div>

          {/* Cross-program digest — only in All */}
          {scope === "all" && (
            <div className="mt-2 bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">Cross-program</div>
                  <div className="text-[14px] font-extrabold text-[#1A1A2E]">Needs your attention</div>
                </div>
                <div className="text-[11px] text-gray-500">12 items · filtered by you</div>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { who: "Jaylen Brooks",  init: "JB", prog: "pypx",    msg: "Stuck on data for waste destinations · 3 days", tag: "🚩 Stuck" },
                  { who: "Ava Singh",      init: "AS", prog: "design",  msg: "Prototype needs laser cutter time",              tag: "Blocker" },
                  { who: "Noah Clarke",    init: "NC", prog: "pp",      msg: "Requested research ethics review meeting",       tag: "Reply" },
                  { who: "Yusuf Osman",    init: "YO", prog: "service", msg: "Logged 8h mentoring — awaiting approval",        tag: "Approve" },
                ].map((a, i) => {
                  const p = PROGRAMS.find(x => x.id === a.prog);
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-extrabold text-[10.5px] flex-shrink-0"
                        style={{ background: `hsl(${(i*73)%360} 55% 50%)` }}>{a.init}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[12.5px] font-extrabold text-[#1A1A2E]">{a.who}</div>
                          <span className="w-1 h-1 rounded-full bg-gray-300"/>
                          <span className="text-[10.5px] font-bold" style={{ color: p.color }}>{p.name}</span>
                        </div>
                        <div className="text-[11px] text-gray-600 truncate">{a.msg}</div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-200 text-rose-600 bg-rose-50 whitespace-nowrap">{a.tag}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ APP ============
const TWEAKS = /*EDITMODE-BEGIN*/{
  "scope": "all"
}/*EDITMODE-END*/;

function ScopeApp() {
  const [scope, setScope] = React.useState(TWEAKS.scope);
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
      <AppChrome scope={scope} onScope={setScopeP} active="dashboard"/>
      <DashboardBody scope={scope}/>

      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-72 overflow-hidden">
          <div className="bg-[#1A1A2E] text-white px-4 py-2.5 text-[12px] font-extrabold">Tweaks</div>
          <div className="p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Quick scope</div>
            <div className="flex flex-col gap-1">
              {PROGRAMS.map(p => (
                <button key={p.id} onClick={() => setScopeP(p.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11.5px] font-bold
                    ${scope===p.id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                  <span className="text-[14px]">{p.icon}</span> {p.name}
                </button>
              ))}
            </div>
            <div className="text-[10.5px] text-gray-500 leading-relaxed mt-3 border-t border-gray-100 pt-3">
              The scope chip (top-left, next to the logo) filters Dashboard, Classes, Units, Students, Alerts, Library across the whole app.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ScopeApp/>);
