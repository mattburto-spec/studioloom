// Editorial / warm-paper teacher dashboard.
// Instrument Serif display + Work Sans body + Caveat for handwritten accents.
// Chromatic full-bleed schedule, magazine-style unit rows.

const E_PROGRAMS = [
  { id: "all",     name: "All programs",       color: "#1A1A2E", dot: "●" },
  { id: "design",  name: "MYP Design",         color: "#E86F2C", dot: "●", framework: "MYP" },
  { id: "pypx",    name: "PYPX",               color: "#9333EA", dot: "●", framework: "PYP" },
  { id: "service", name: "Service as Action",  color: "#10B981", dot: "●", framework: "MYP" },
];

const E_NAV = ["Dashboard", "Classes", "Units", "Toolkit", "Badges", "Alerts", "Students", "Library"];

const E_NEXT = {
  period: "Period 1", periodNum: "01", startsIn: 23, time: "9:00 AM",
  room: "Room D12", class: "7 Design", color: "#0EA5A4",
  unitTitle: "Biomimicry",
  unitSub: "plastic pouch inspired by nature",
  phase: "Developing ideas", phasePct: 34,
  students: 18, ready: 14, ungraded: 3,
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=1000&fit=crop",
};

const E_SCHEDULE = [
  { num: "01", time: "9:00",  class: "7 Design",         color: "#0EA5A4", unit: "Biomimicry",                         width: 26, state: "next" },
  { num: "02", time: "10:15", class: "9 Design Science", color: "#10B981", unit: "CO2 Racer",                          width: 24, state: "upcoming" },
  { num: "03", time: "11:30", class: "10 Design",        color: "#E86F2C", unit: "Interactive Pinball Machines",       width: 24, state: "upcoming" },
  { num: "05", time: "14:00", class: "7 Design",         color: "#0EA5A4", unit: "Biomimicry",                         width: 26, state: "upcoming", note: "lab booking" },
];

const E_INSIGHTS = [
  {
    eyebrow: "ACT NOW · 5 STUDENTS", accent: "#D9480F",
    headline: "Stuck",
    dek: "Marcus, Theo, Zara, Ava and Elena — no meaningful activity in ten days or more. Most in Biomimicry and Coffee Table.",
    who: ["MJ","TD","ZA","AS","EM"],
    handwritten: "nudge after P1",
    cta: "Review & message",
  },
  {
    eyebrow: "TO GRADE · 15 PIECES", accent: "#B45309",
    headline: "Your backlog",
    dek: "Oldest is ten days. Concentrated in CO2 Racer and Pinball. A focused session should clear it in about forty-five minutes.",
    count: 15, countLabel: "items",
    handwritten: "block out 3pm?",
    cta: "Open queue",
  },
  {
    eyebrow: "WATCH · 4 STUDENTS", accent: "#1E3A8A",
    headline: "Quiet week",
    dek: "Keystroke activity has dropped sixty-two percent for these four versus last week — typical baseline is two hundred plus.",
    who: ["AS","ZA","RK","NO"],
    handwritten: null,
    cta: "See students",
  },
  {
    eyebrow: "CELEBRATE · 7 STUDENTS", accent: "#047857",
    headline: "Pinball surge",
    dek: "Seven students submitted research ahead of schedule — the highest voluntary output of any unit this term. Worth naming aloud.",
    who: ["RK","JC","AS","MC"],
    handwritten: "shout-out in P3!",
    cta: "Send shout-out",
  },
];

const E_UNITS = [
  {
    id: "co2", title: "CO2 Racer",
    kicker: "Speed Through Science & Design",
    classTag: "10 Design", color: "#E86F2C", students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",
    state: "testing", pull: "Race day · Apr 28",
  },
  {
    id: "biom", title: "Biomimicry",
    kicker: "Plastic pouch inspired by nature",
    classTag: "7 Design", color: "#0EA5A4", students: 1, progress: 0,
    img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",
    state: "developing", pull: "Sketchbook · Apr 25",
  },
  {
    id: "coffee", title: "Coffee Table",
    kicker: "Designing and building a coffee table",
    classTag: "10 Design", color: "#EC4899", students: 3, progress: 0,
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",
    state: "creating", pull: "First prototype · May 3",
  },
  {
    id: "pinball", title: "Pinball Machines",
    kicker: "Interactive design with electronics",
    classTag: "10 Design", color: "#9333EA", students: 3, progress: 2,
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",
    state: "investigating", pull: "Research · Apr 30",
  },
];

const E_UNASSIGNED = [
  { name: "Service LEEDers", students: 2 },
  { name: "8 Design",        students: 0 },
  { name: "Grade 8 Design",  students: 1 },
];

// ================= MASTHEAD =================
function Masthead({ scope, onScope }) {
  const [open, setOpen] = React.useState(false);
  const cur = E_PROGRAMS.find(p => p.id === scope);
  return (
    <header className="relative">
      {/* top meta strip */}
      <div className="border-b" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-[1280px] mx-auto px-8 py-2 flex items-center justify-between text-[10.5px]" style={{ color: "var(--ink-muted)" }}>
          <div className="small-caps">Vol. 04 · Issue 11 · Term 2, Week 11</div>
          <div className="flex items-center gap-4">
            <span className="small-caps">Mon 20 Apr 2026</span>
            <span className="small-caps">☀ 18°C · Light breeze</span>
            <button className="small-caps hover:text-[var(--ink)]">⚙ Settings</button>
            <button className="small-caps hover:text-[var(--ink)]">Log out</button>
          </div>
        </div>
      </div>

      {/* brand mark row */}
      <div className="max-w-[1280px] mx-auto px-8 pt-6 pb-3 flex items-end justify-between">
        <div>
          <div className="small-caps text-[11px]" style={{ color: "var(--ink-muted)" }}>A daily publication for</div>
          <div className="serif text-[22px] leading-none mt-0.5">Matthew Griffiths</div>
        </div>
        <div className="text-center">
          <div className="serif text-[52px] leading-none tracking-tight">StudioLoom</div>
          <div className="small-caps text-[9px] mt-1" style={{ color: "var(--ink-muted)" }}>The Teacher's Daily</div>
        </div>
        <div className="text-right">
          <div className="relative inline-block">
            <button onClick={() => setOpen(v => !v)} className="text-[11px] small-caps hover:underline flex items-center gap-1.5">
              <span style={{ color: cur.color }}>{cur.dot}</span> {cur.name} <span style={{ color: "var(--ink-muted)" }}>▾</span>
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
                <div className="absolute right-0 mt-2 z-40 bg-[var(--paper)] border border-[var(--ink)] shadow-xl w-64 py-1">
                  {E_PROGRAMS.map(p => (
                    <button key={p.id} onClick={() => { onScope(p.id); setOpen(false); }}
                      className="w-full px-4 py-2 text-left hover:bg-[var(--paper-dark)] flex items-center gap-2 text-[11.5px]">
                      <span style={{ color: p.color }}>●</span>
                      <span className="font-bold">{p.name}</span>
                      {p.framework && <span className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>{p.framework}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="small-caps text-[10px] mt-1" style={{ color: "var(--ink-muted)" }}>Filter</div>
        </div>
      </div>

      {/* thick rule */}
      <div className="max-w-[1280px] mx-auto px-8">
        <div style={{ borderTop: "3px solid var(--ink)" }}/>
        <div className="py-1.5 flex items-center justify-between">
          <nav className="flex items-center gap-6 text-[12px] small-caps">
            {E_NAV.map((n, i) => (
              <button key={n} className={`hover:text-[var(--ink)] ${i===0 ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
                style={i===0 ? { borderBottom: "2px solid var(--ink)", paddingBottom: 2 } : {}}>
                {n}
              </button>
            ))}
          </nav>
          <div className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span className="small-caps">6 classes</span> · <span className="small-caps">4 units</span> · <span className="small-caps">42 students</span>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--ink)" }}/>
      </div>
    </header>
  );
}

// ================= NOW FEATURE =================
function NowFeature() {
  const n = E_NEXT;
  return (
    <section className="max-w-[1280px] mx-auto px-8 pt-10 pb-8">
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: text */}
        <div className="col-span-7">
          <div className="flex items-center gap-3 mb-6">
            <span className="small-caps text-[10px] pulse-dot" style={{ color: n.color }}>●</span>
            <div className="small-caps text-[11px]" style={{ color: n.color }}>
              Now playing · {n.period} · starts in {n.startsIn} minutes
            </div>
          </div>
          <h1 className="serif text-[120px] leading-[0.88] tracking-tight">
            {n.unitTitle}<span style={{ color: n.color }}>.</span>
          </h1>
          <h2 className="serif-it text-[38px] leading-tight mt-2" style={{ color: "var(--ink-muted)" }}>
            {n.unitSub}
          </h2>

          <div className="rule mt-8 pt-4 flex items-start gap-8">
            <div>
              <div className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>Class</div>
              <div className="serif text-[22px] leading-tight mt-0.5" style={{ color: n.color }}>{n.class}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-muted)" }}>{n.room} · {n.time}</div>
            </div>
            <div>
              <div className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>Phase</div>
              <div className="serif text-[22px] leading-tight mt-0.5">{n.phase}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-[3px] w-24 bg-[var(--rule)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${n.phasePct}%`, background: n.color }}/>
                </div>
                <div className="text-[10.5px]" style={{ color: "var(--ink-muted)" }}>{n.phasePct}%</div>
              </div>
            </div>
            <div>
              <div className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>Students</div>
              <div className="serif text-[22px] leading-tight mt-0.5">{n.ready}<span style={{ color: "var(--ink-muted)" }}> / {n.students} ready</span></div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-muted)" }}>{n.ungraded} pieces to grade</div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button className="ink-btn px-6 py-3 text-[13px] small-caps rounded-none">Start teaching →</button>
            <button className="px-5 py-3 text-[13px] small-caps border border-[var(--ink)] hover:bg-[var(--paper-dark)]">Lesson plan</button>
            <div className="ml-3 hand text-[22px] flex items-center gap-2 scribble" style={{ transform: "rotate(-3deg)" }}>
              <span style={{ color: n.color }}>↖</span>
              <span>open with yesterday's sketch</span>
            </div>
          </div>
        </div>

        {/* Right: image with editorial caption */}
        <div className="col-span-5">
          <div className="relative">
            <div className="aspect-[4/5] w-full overflow-hidden" style={{ background: n.color }}>
              <img src={n.img} alt="" className="w-full h-full object-cover mix-blend-multiply opacity-95"/>
            </div>
            <div className="absolute -top-3 -right-3 px-3 py-1 small-caps text-[10px]" style={{ background: n.color, color: "white" }}>
              Today's focus
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="serif text-[14px]" style={{ color: "var(--ink-muted)" }}>Fig. 01</div>
              <div className="text-[11px] italic" style={{ color: "var(--ink-muted)" }}>
                Students explore how a leaf's vascular structure distributes force — today we sketch from life.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= THE DAY =================
function TheDay() {
  const total = E_SCHEDULE.reduce((a, s) => a + s.width, 0);
  return (
    <section className="max-w-[1280px] mx-auto px-8 pt-4 pb-12">
      <div className="flex items-baseline justify-between mb-4 rule pt-5">
        <div>
          <div className="small-caps text-[10px]" style={{ color: "var(--ink-muted)" }}>Section II · The Day</div>
          <h3 className="serif text-[48px] leading-none mt-1">A scroll of Monday.</h3>
        </div>
        <div className="text-[12px] italic" style={{ color: "var(--ink-muted)" }}>Four periods, thirty-eight minutes apart from the last.</div>
      </div>

      {/* Chromatic timeline */}
      <div className="flex w-full h-[220px] gap-1">
        {E_SCHEDULE.map((s, i) => (
          <div key={i} className="relative overflow-hidden cursor-pointer group" style={{ flex: `${s.width} 0 0`, background: s.color }}>
            {/* Period number huge */}
            <div className="absolute top-4 left-5 serif text-white text-[120px] leading-none opacity-90">{s.num}</div>
            <div className="absolute bottom-4 left-5 right-5">
              <div className="small-caps text-[10px] text-white/80">{s.time} · {s.class}</div>
              <div className="serif text-white text-[28px] leading-tight mt-0.5">{s.unit}</div>
              {s.note && <div className="hand text-[18px] text-white/90 mt-0.5">{s.note} →</div>}
            </div>
            {s.state === "next" && (
              <div className="absolute top-4 right-4 bg-white/90 px-2 py-0.5 small-caps text-[9px]" style={{ color: s.color }}>
                up next · 23 min
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10.5px]" style={{ color: "var(--ink-muted)" }}>
        <span className="small-caps">9 AM</span>
        <span className="small-caps">Noon</span>
        <span className="small-caps">3 PM</span>
      </div>
    </section>
  );
}

// ================= WHAT I'M NOTICING =================
function Noticing() {
  return (
    <section className="max-w-[1280px] mx-auto px-8 pt-4 pb-12">
      <div className="flex items-baseline justify-between mb-5 rule pt-5">
        <div>
          <div className="small-caps text-[10px]" style={{ color: "var(--ink-muted)" }}>Section III · Insights</div>
          <h3 className="serif text-[48px] leading-none mt-1">What I'm noticing.</h3>
        </div>
        <div className="text-[12px] italic" style={{ color: "var(--ink-muted)" }}>Patterns across all of your classes, this week.</div>
      </div>

      <div className="grid grid-cols-2 gap-x-10 gap-y-10">
        {E_INSIGHTS.map((it, i) => (
          <article key={i} className="border-l-2 pl-6 py-1" style={{ borderColor: it.accent }}>
            <div className="small-caps text-[10px] mb-3" style={{ color: it.accent }}>{it.eyebrow}</div>
            <h4 className="serif text-[72px] leading-[0.9] tracking-tight">{it.headline}<span style={{ color: it.accent }}>.</span></h4>
            <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "#3f3a2e" }}>{it.dek}</p>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {it.who ? (
                  <div className="flex items-center">
                    {it.who.slice(0, 4).map((a, idx) => (
                      <div key={idx} className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-[10px] border-2 -ml-1.5 first:ml-0"
                        style={{ background: `hsl(${(idx*73 + it.headline.length) % 360} 45% 45%)`, borderColor: "var(--paper)" }}>{a}</div>
                    ))}
                    {it.who.length > 4 && <div className="text-[12px] ml-2" style={{ color: "var(--ink-muted)" }}>+{it.who.length - 4}</div>}
                  </div>
                ) : (
                  <div className="serif text-[36px] leading-none">{it.count} <span className="text-[14px] italic" style={{ color: "var(--ink-muted)" }}>{it.countLabel}</span></div>
                )}
                {it.handwritten && (
                  <div className="hand text-[20px] scribble" style={{ color: it.accent, transform: "rotate(-2deg)" }}>
                    ↳ {it.handwritten}
                  </div>
                )}
              </div>
              <button className="small-caps text-[11px] hover:underline flex items-center gap-1" style={{ color: it.accent }}>
                {it.cta} →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ================= ON THE LOOM =================
function OnTheLoom() {
  return (
    <section className="max-w-[1280px] mx-auto px-8 pt-4 pb-12">
      <div className="flex items-baseline justify-between mb-5 rule pt-5">
        <div>
          <div className="small-caps text-[10px]" style={{ color: "var(--ink-muted)" }}>Section IV · Active Units</div>
          <h3 className="serif text-[48px] leading-none mt-1">On the loom.</h3>
        </div>
        <div className="flex items-center gap-4 text-[11px] small-caps">
          <button style={{ color: "var(--ink-muted)" }}>Filter</button>
          <button style={{ color: "var(--ink-muted)" }}>Sort by class</button>
          <button className="ink-btn px-3 py-1.5">+ New unit</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {E_UNITS.map((u, i) => (
          <article key={u.id} className="relative group">
            {/* Image */}
            <div className="aspect-[4/3] relative overflow-hidden" style={{ background: u.color }}>
              <img src={u.img} alt="" className="w-full h-full object-cover mix-blend-multiply opacity-90"/>
              <div className="absolute top-3 left-3 px-2 py-0.5 small-caps text-[10px] bg-white/95" style={{ color: u.color }}>
                {u.classTag} · {u.students} student{u.students===1?"":"s"}
              </div>
              <div className="absolute top-3 right-3 hand text-[18px] text-white/95 scribble">
                {u.state}
              </div>
            </div>
            {/* Meta */}
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="serif text-[38px] leading-[0.95] tracking-tight">{u.title}<span style={{ color: u.color }}>.</span></h4>
                <div className="serif-it text-[16px] mt-1" style={{ color: "var(--ink-muted)" }}>{u.kicker}</div>
              </div>
              <button className="small-caps text-[11px] px-3 py-2 border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] whitespace-nowrap">
                Teach →
              </button>
            </div>
            {/* Progress line */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-[2px] bg-[var(--rule)]">
                <div className="h-full" style={{ width: `${Math.max(u.progress, 1)}%`, background: u.color }}/>
              </div>
              <div className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>{u.progress}%</div>
              <div className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>|</div>
              <div className="small-caps text-[9px]" style={{ color: u.color }}>{u.pull}</div>
              <button className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>Hub</button>
              <button className="small-caps text-[9px]" style={{ color: "var(--ink-muted)" }}>Edit</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ================= COLOPHON / ADMIN FOOTER =================
function Colophon() {
  return (
    <footer className="max-w-[1280px] mx-auto px-8 pt-8 pb-16 mt-8" style={{ borderTop: "3px solid var(--ink)" }}>
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-4">
          <div className="small-caps text-[10px]" style={{ color: "var(--ink-muted)" }}>The Colophon</div>
          <div className="serif text-[22px] leading-tight mt-1">Housekeeping — three classes still without a unit assigned.</div>
        </div>
        <div className="col-span-5">
          <div className="flex flex-col gap-2">
            {E_UNASSIGNED.map((c, i) => (
              <div key={i} className="flex items-center justify-between rule pt-2">
                <div className="flex items-center gap-3">
                  <div className="serif text-[22px]" style={{ color: "var(--ink-muted)" }}>0{i+1}</div>
                  <div>
                    <div className="font-bold text-[13px]">{c.name}</div>
                    <div className="text-[10.5px]" style={{ color: "var(--ink-muted)" }}>{c.students} student{c.students===1?"":"s"} · awaiting assignment</div>
                  </div>
                </div>
                <button className="small-caps text-[10px] hover:underline">Assign →</button>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-3">
          <div className="small-caps text-[10px]" style={{ color: "var(--ink-muted)" }}>Tomorrow's preview</div>
          <div className="serif text-[16px] leading-snug mt-1" style={{ color: "var(--ink-muted)" }}>
            5 periods · CO2 Racer practice runs · Biomimicry sketchbook due · Pinball electronics workshop.
          </div>
        </div>
      </div>
      <div className="mt-10 flex items-center justify-between text-[10.5px]" style={{ color: "var(--ink-muted)" }}>
        <div className="small-caps">StudioLoom · The Teacher's Daily · Issue 11 of Term 2</div>
        <div className="serif-it text-[14px]">"A classroom, printed." </div>
        <div className="small-caps">End of issue</div>
      </div>
    </footer>
  );
}

// ================= TWEAKS =================
const E_TWEAKS = /*EDITMODE-BEGIN*/{
  "scope": "all"
}/*EDITMODE-END*/;

function App() {
  const [scope, setScope] = React.useState(E_TWEAKS.scope);
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
    <div className="min-h-screen relative">
      <Masthead scope={scope} onScope={setScopeP}/>
      <NowFeature/>
      <TheDay/>
      <Noticing/>
      <OnTheLoom/>
      <Colophon/>

      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--paper)] border-2 border-[var(--ink)] shadow-xl w-72">
          <div className="bg-[var(--ink)] text-[var(--paper)] px-4 py-2.5 text-[11px] small-caps">Tweaks</div>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <div className="small-caps text-[9px] mb-2" style={{ color: "var(--ink-muted)" }}>Scope</div>
              <div className="flex flex-col gap-1">
                {E_PROGRAMS.map(p => (
                  <button key={p.id} onClick={() => setScopeP(p.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 border text-left text-[11.5px] font-bold
                      ${scope===p.id?"bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]":"bg-[var(--paper)] border-[var(--rule)] hover:border-[var(--ink)]"}`}>
                    <span style={{ color: scope===p.id?p.color:p.color }}>●</span> {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10.5px] leading-relaxed border-t border-[var(--rule)] pt-3 italic" style={{ color: "var(--ink-muted)" }}>
              A daily publication about your classroom. Each section — the day, insights, active units — gets editorial dignity.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
