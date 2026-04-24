// StudioLoom landing page — "bold, confident, product-page" aesthetic
// Same Manrope display, warm off-white, saturated per-section color, photographic mockups
// Signature accent: orange #E86F2C (pulled from earlier units in the app)

// ================= ICONS =================
const I = ({ name, size = 16, s = 2 }) => {
  const p = { strokeWidth: s, stroke: "currentColor", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", width: size, height: size, viewBox: "0 0 24 24" };
  const shapes = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    arrowUp: <path d="M7 17L17 7M7 7h10v10"/>,
    play:  <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>,
    check: <path d="M20 6L9 17l-5-5"/>,
    chev:  <path d="M6 9l6 6 6-6"/>,
    chevR: <path d="M9 6l6 6-6 6"/>,
    plus:  <path d="M12 5v14M5 12h14"/>,
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>,
    star:  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
    book:  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15"/>,
    grid:  <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    eye:   <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    trend: <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"/>,
    bolt:  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    flag:  <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/></>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    paint: <><path d="M19 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-6v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6h5"/><path d="M14 3H6a2 2 0 0 0-2 2v6"/></>,
    pen:   <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>,
    target:<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>,
    dot:   <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>,
    msg:   <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z"/>,
    mic:   <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></>,
    cam:   <><path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/></>,
    type:  <><path d="M4 7V4h16v3M9 20h6M12 4v16"/></>,
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>,
    layers:<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>,
    wand:  <path d="M15 4V2M15 10V8M18 7h2M10 7h2M17.5 4.5l-1 1M13.5 5.5l-1 1M4 20l10-10M14 6l4 4"/>,
  };
  return <svg {...p}>{shapes[name]}</svg>;
};

// ================= NAV =================
function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-[var(--bg)]/85 backdrop-blur-lg border-b border-[var(--hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">#</div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </div>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {["Platform", "Frameworks", "Toolkit", "Schools", "Pricing"].map(n => (
            <button key={n} className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-white">{n}</button>
          ))}
        </nav>
        <div className="flex-1"/>
        <button className="hidden md:block text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)]">Student login</button>
        <button className="btn-secondary rounded-full px-4 py-2 text-[12.5px]">Teacher portal</button>
        <button className="btn-primary rounded-full px-4 py-2 text-[12.5px] inline-flex items-center gap-1.5">
          Get started <I name="arrow" size={11} s={2.5}/>
        </button>
      </div>
    </header>
  );
}

// ================= HERO =================
function Hero() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10 pb-6 relative">
      {/* Announcement chip */}
      <div className="flex justify-center mb-6">
        <a className="inline-flex items-center gap-2 bg-white rounded-full pl-1 pr-4 py-1 text-[11.5px] font-bold card-shadow hover:-translate-y-0.5 transition">
          <span className="bg-[var(--accent)] text-white rounded-full px-2.5 py-1 text-[10px]">NEW</span>
          42-tool Thinking Toolkit now free, no login
          <I name="arrow" size={11} s={2.5}/>
        </a>
      </div>

      <h1 className="display-xl text-center text-[104px] leading-[0.9] max-w-[1100px] mx-auto">
        The platform for classrooms<br/>
        that <span className="serif-em">make</span>,
        <span className="serif-em" style={{ color: 'var(--accent)' }}> solve</span>,
        & <span className="serif-em">create</span>.
      </h1>
      <p className="text-center text-[19px] leading-relaxed text-[var(--ink-2)] max-w-[680px] mx-auto mt-6 font-medium">
        Unit planning. Lesson delivery. Live monitoring. Mentoring. Thinking tools. Grading. Portfolio.
        One platform — for Design, Service, Capstone, Exhibition, and inquiry classrooms.
      </p>

      <div className="flex items-center justify-center gap-3 mt-8">
        <button className="btn-primary rounded-full px-6 py-3.5 text-[14px] inline-flex items-center gap-2">
          Start teaching free <I name="arrow" size={12} s={2.5}/>
        </button>
        <button className="btn-secondary rounded-full px-6 py-3.5 text-[14px]">Browse the free toolkit</button>
      </div>

      <div className="flex items-center justify-center gap-8 mt-6 text-[11.5px] font-semibold text-[var(--ink-3)]">
        <span className="inline-flex items-center gap-1.5"><I name="check" size={12} s={3}/> No credit card</span>
        <span className="inline-flex items-center gap-1.5"><I name="check" size={12} s={3}/> Free for solo teachers</span>
        <span className="inline-flex items-center gap-1.5"><I name="check" size={12} s={3}/> Works with your framework</span>
      </div>
    </section>
  );
}

// ================= HERO VISUAL — Student Project HQ (agency) =================
function HeroVisual() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pb-16">
      <div className="flex items-center gap-3 mb-4">
        <div className="cap text-[var(--ink-3)]">What students actually use</div>
        <div className="h-px flex-1 bg-[var(--hair)]"/>
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 text-[10.5px] font-extrabold card-shadow">
          <I name="users" size={11} s={2.5}/> Sam · Year 7 · driving her own project
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* ===== LEFT: Project HQ — self-authored plan ===== */}
        <div className="col-span-8">
          <div className="bg-white rounded-[28px] overflow-hidden card-shadow-lg">
            {/* Unit header with phase tracker */}
            <div className="relative p-6 pb-7" style={{ background: "linear-gradient(135deg, #0EA5A4 0%, #0F766E 100%)" }}>
              <div className="flex items-start justify-between text-white">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[10.5px] font-extrabold">
                    <span className="pulse text-white"/> My project · 7 Design
                  </div>
                  <h3 className="display-lg text-[44px] leading-none mt-3">Plastic pouch<br/>inspired by nature.</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] font-bold opacity-75 uppercase tracking-wider">Day 8 of 14</div>
                  <div className="display text-[28px] leading-none mt-1 tnum">34%</div>
                </div>
              </div>
              <div className="mt-5 bg-white/10 backdrop-blur rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  {[
                    { n: "Discover", done: true },
                    { n: "Define", done: true },
                    { n: "Develop ideas", done: false, current: true },
                    { n: "Prototype", done: false },
                    { n: "Test", done: false },
                    { n: "Reflect", done: false },
                  ].map((p, i, a) => (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold ${p.done ? "bg-white text-[#0F766E]" : p.current ? "bg-[#FBBF24] text-[#78350F] ring-2 ring-white" : "bg-white/20 text-white/60"}`}>
                          {p.done ? <I name="check" size={10} s={3.5}/> : i+1}
                        </div>
                        <div className={`text-[10.5px] font-extrabold whitespace-nowrap ${p.current ? "text-white" : p.done ? "text-white/80" : "text-white/50"}`}>{p.n}</div>
                      </div>
                      {i < a.length - 1 && <div className={`h-px flex-1 ${p.done ? "bg-white/60" : "bg-white/15"}`}/>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-0 divide-x divide-[var(--hair)]">
              {/* My plan — student-authored */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="cap text-[var(--ink-3)] inline-flex items-center gap-1.5"><I name="flag" size={11} s={2.5}/> My plan · I wrote this</div>
                  <button className="text-[10.5px] font-extrabold text-[var(--ink-3)] hover:text-[var(--ink)]">Edit</button>
                </div>
                <div className="space-y-2">
                  {[
                    { t: "Research 5 natural structures I love", done: true, due: "Mon" },
                    { t: "Pick my 'hero' — leaf skeleton", done: true, due: "Tue" },
                    { t: "Sketch 3 pouch shapes from it", done: false, current: true, due: "today" },
                    { t: "Build paper prototype", done: false, due: "Thu" },
                    { t: "Test: does it hold 500g?", done: false, due: "Fri" },
                    { t: "Refine + final model", done: false, due: "next Mon" },
                  ].map((x, i) => (
                    <div key={i} className={`flex items-center gap-2.5 p-2 rounded-xl ${x.current ? "bg-[#CCFBF1] border border-[#5EEAD4]" : ""}`}>
                      <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center ${x.done ? "bg-[#0F766E] text-white" : x.current ? "bg-white border-2 border-[#0F766E]" : "bg-[var(--bg)] border border-[var(--hair)]"}`}>
                        {x.done && <I name="check" size={11} s={3.5}/>}
                        {x.current && <span className="w-2 h-2 rounded-sm bg-[#0F766E]"/>}
                      </div>
                      <div className={`flex-1 text-[12px] font-semibold ${x.done ? "line-through text-[var(--ink-3)]" : x.current ? "font-extrabold text-[#0F766E]" : ""}`}>{x.t}</div>
                      <div className={`text-[10px] font-extrabold tnum ${x.current ? "text-[#0F766E]" : "text-[var(--ink-3)]"}`}>{x.due}</div>
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full text-[11px] font-extrabold text-[var(--ink-3)] hover:text-[var(--ink)] border border-dashed border-[var(--hair)] hover:border-[var(--ink)] rounded-xl py-2 inline-flex items-center justify-center gap-1.5">
                  <I name="plus" size={11} s={2.5}/> Add a step
                </button>
              </div>

              {/* Today's focus + portfolio */}
              <div className="p-5 bg-[var(--bg)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="cap text-[var(--ink-3)] inline-flex items-center gap-1.5"><I name="target" size={11} s={2.5}/> My focus today</div>
                  <div className="text-[10.5px] font-extrabold text-[#0F766E] tnum">38 min on task</div>
                </div>
                <div className="bg-white rounded-2xl p-4 card-shadow">
                  <div className="text-[10.5px] font-extrabold text-[#0F766E] uppercase tracking-wider">Step 3 of 6</div>
                  <div className="display text-[18px] leading-tight mt-1">Sketch 3 pouch shapes from leaf skeleton</div>
                  <div className="mt-3 flex gap-1.5">
                    {[1,2,3].map(n => (
                      <div key={n} className={`flex-1 h-2 rounded-full ${n===1 ? "bg-[#0F766E]" : n===2 ? "bg-[#0F766E]/40" : "bg-[var(--hair)]"}`}/>
                    ))}
                  </div>
                  <div className="text-[10.5px] text-[var(--ink-3)] mt-1 font-semibold">1 of 3 sketches done</div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {[
                      { i: "paint", l: "Canvas", c: "#EC4899" },
                      { i: "cam", l: "Photo", c: "#9333EA" },
                      { i: "mic", l: "Voice", c: "#0EA5A4" },
                    ].map((o,i)=>(
                      <button key={i} className="rounded-lg border border-[var(--hair)] hover:border-[var(--ink)] p-2 transition text-left">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ background: o.c }}><I name={o.i} size={11} s={2.2}/></div>
                        <div className="text-[10px] font-extrabold mt-1">{o.l}</div>
                      </button>
                    ))}
                  </div>
                  <button className="mt-3 w-full bg-[#0F766E] hover:bg-[#0E5F5A] transition text-white rounded-xl py-2 text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5">
                    Start sketching <I name="arrow" size={11} s={2.5}/>
                  </button>
                </div>
                <div className="mt-3 bg-white rounded-2xl p-3 border border-[var(--hair)]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] text-[#92400E] flex items-center justify-center"><I name="book" size={13}/></div>
                    <div className="flex-1">
                      <div className="text-[11px] font-extrabold">Portfolio auto-updating</div>
                      <div className="text-[10px] text-[var(--ink-3)]">14 entries this unit · builds from your work</div>
                    </div>
                    <I name="check" size={14} s={3}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Single focal card — Open Studio earned ===== */}
        <div className="col-span-4 space-y-5">
          <div className="relative bg-white rounded-[28px] overflow-hidden card-shadow-lg">
            <div className="p-6 pb-7 relative" style={{ background: "linear-gradient(140deg, #9333EA 0%, #6366F1 60%, #0EA5A4 120%)" }}>
              <div className="flex items-center justify-between text-white">
                <div className="inline-flex items-center gap-2 bg-white/18 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-extrabold">
                  <I name="check" size={11} s={3}/> Earned · self-directed
                </div>
                <I name="spark" size={20} s={2.2}/>
              </div>
              <h3 className="display-lg text-[40px] leading-[0.95] mt-5 text-white">Open Studio<br/>unlocked.</h3>
              <p className="text-[13px] text-white/85 mt-3 leading-relaxed max-w-[95%]">
                Sam's shown she can drive. She works in her own direction now — check-ins only if she drifts.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-[#E86F2C] to-[#EC4899] text-white flex items-center justify-center font-extrabold text-[10px]">SM</div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#FBBF24] text-[#78350F] flex items-center justify-center font-extrabold text-[10px]">JL</div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#10B981] text-white flex items-center justify-center font-extrabold text-[10px]">AK</div>
                </div>
                <div className="text-[10.5px] text-white/80 font-semibold leading-tight">
                  3 of 24 students<br/>earned this term
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-[var(--hair)]">
              <div className="cap text-[var(--ink-3)] mb-2">What Sam gets</div>
              <div className="space-y-1.5">
                {[
                  "Choose her own project brief",
                  "Work across scheduled blocks",
                  "Skip pre-built scaffolds",
                ].map((t,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#D1FAE5] text-[#047857] flex items-center justify-center flex-shrink-0"><I name="check" size={9} s={4}/></div>
                    <div className="text-[12px] font-semibold">{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-1">
            <div className="text-[15px] leading-snug text-[var(--ink-2)] font-medium" style={{fontFamily: 'var(--serif)', fontStyle: 'italic'}}>
              "Students stop asking <span className="text-[var(--ink)] font-semibold">what do I do next?</span> — they <span className="text-[var(--ink)] font-semibold">already know</span>."
            </div>
            <div className="cap text-[var(--ink-3)] mt-2.5">Ms. Rivera · Year 7 Design · Lakeside School</div>
          </div>
        </div>
      </div>

      {/* Stats strip under hero */}
      <div className="grid grid-cols-4 gap-6 mt-12 pt-8 border-t border-[var(--hair)]">
        {[
          { n: "6", l: "Design frameworks", s: "IB MYP · GCSE · PLTW · ACARA · IDEO · Double Diamond" },
          { n: "42", l: "Thinking tools", s: "SCAMPER · Six Hats · PMI · Empathy Map · +38 more" },
          { n: "8", l: "Discovery stations", s: "Students find their own project direction" },
          { n: "1", l: "Platform", s: "Plan, deliver, monitor, grade, showcase" },
        ].map((s,i)=>(
          <div key={i}>
            <div className="display-lg text-[48px] leading-none">{s.n}</div>
            <div className="text-[13px] font-extrabold mt-2">{s.l}</div>
            <div className="text-[11.5px] text-[var(--ink-3)] mt-1 leading-relaxed">{s.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ================= SECTION 1 — PLAN =================
function Section1Plan() {
  const units = [
    { t: "Sustainable Packaging", k: "Design · 12 lessons", c: "#10B981", img: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=600&h=400&fit=crop" },
    { t: "Community Garden",      k: "Service · 8 lessons",  c: "#EC4899", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop" },
    { t: "Smart Home Prototype",  k: "Design · 15 lessons", c: "#0EA5A4", img: "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&h=400&fit=crop" },
    { t: "Fashion & Identity",    k: "Design · 10 lessons", c: "#9333EA", img: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&h=400&fit=crop" },
  ];
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-24">
      <div className="grid grid-cols-12 gap-12 items-start">
        <div className="col-span-5 sticky top-24">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 card-shadow">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white flex items-center justify-center text-[10px] font-extrabold">1</div>
            <span className="cap">Plan</span>
          </div>
          <h2 className="display-lg text-[56px] leading-[0.95] mt-5">Start from a library of classroom-tested units.</h2>
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)] mt-5 font-medium">
            Hundreds of ready-to-go units built by real teachers for Design, Service, Capstone, Exhibition, and inquiry. Use one as-is, remix it, or generate a new one with a unit builder that understands how to scaffold.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Browse by framework & grade", "Workshop Model phases, scaffolding, and differentiation built in"],
              ["Fork & customise per class", "Adjust timing, swap activities — your version, your students"],
              ["Or build from scratch", "Express · Guided · Architect modes"],
              ["Trained on PBL pedagogy", "Scaffolds when needed, gets out of the way when not"],
            ].map((f,i)=>(
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I name="check" size={11} s={3}/></div>
                <div>
                  <div className="text-[14px] font-extrabold">{f[0]}</div>
                  <div className="text-[13px] text-[var(--ink-3)] mt-0.5">{f[1]}</div>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn-primary rounded-full px-5 py-3 text-[13px] mt-8 inline-flex items-center gap-2">
            Browse the unit library <I name="arrow" size={11} s={2.5}/>
          </button>
        </div>

        {/* right: unit cards stack */}
        <div className="col-span-7">
          <div className="bg-white rounded-3xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {["All","Design","Service","Capstone","Exhibition"].map((t,i)=>(
                  <button key={i} className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${i===0?"bg-[var(--ink)] text-white":"bg-[var(--bg)] text-[var(--ink-2)]"}`}>{t}</button>
                ))}
              </div>
              <div className="text-[11px] text-[var(--ink-3)] font-bold">412 units</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {units.map((u,i)=>(
                <article key={i} className="bg-[var(--bg)] rounded-2xl overflow-hidden">
                  <div className="aspect-[16/9] relative" style={{ background: u.c }}>
                    <img src={u.img} className="w-full h-full object-cover opacity-90"/>
                    <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold" style={{color: u.c}}>{u.k.split(" · ")[0]}</div>
                  </div>
                  <div className="p-3">
                    <div className="display text-[15px] leading-tight">{u.t}</div>
                    <div className="text-[10.5px] text-[var(--ink-3)] mt-1 font-semibold">{u.k}</div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-warm)] border border-[var(--hair)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#C04A0F] text-white flex items-center justify-center"><I name="wand" size={18} s={2.2}/></div>
              <div className="flex-1">
                <div className="text-[12.5px] font-extrabold">Build a fresh unit with AI</div>
                <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Express · Guided · Architect — trained on PBL pedagogy</div>
              </div>
              <button className="btn-primary rounded-full px-3 py-1.5 text-[11px]">Try it</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= SECTION 2 — DELIVER =================
function Section2Deliver() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-28">
      <div className="grid grid-cols-12 gap-12 items-start">
        {/* left: lesson frame */}
        <div className="col-span-7">
          <div className="relative rounded-[32px] overflow-hidden card-shadow-lg" style={{ background: "#10B981" }}>
            <div className="p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="cap text-white/70">Lesson 4 of 12</div>
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[10.5px] font-extrabold"><I name="shield" size={11} s={2.5}/> Integrity monitored</div>
              </div>
              <h3 className="display-lg text-[40px] leading-none mt-3">Exploring sustainable materials.</h3>
              <p className="text-[14px] text-white/85 mt-2 max-w-lg">How sustainable packaging is made — 3 min video, auto-pauses for reflection.</p>
            </div>
            <div className="px-8 pb-8">
              <div className="bg-white rounded-2xl p-4">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-[#065F46] to-[#10B981] relative overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=900&h=500&fit=crop" className="w-full h-full object-cover opacity-80"/>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center text-[#10B981]"><I name="play" size={24} s={0}/></div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                    <div className="h-1 rounded-full bg-white/30 flex-1"><div className="h-full w-[40%] rounded-full bg-white"/></div>
                    <div className="text-[10px] text-white font-bold mono">1:12 / 3:00</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] font-extrabold text-[var(--ink-3)] uppercase tracking-wider">Submit your response</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { i: "type", l: "Written", s: "Compare two materials…" },
                    { i: "cam",  l: "Photo",   s: "of your prototype" },
                    { i: "mic",  l: "Voice",   s: "explain your choice" },
                  ].map((o,i)=>(
                    <div key={i} className="rounded-xl border border-[var(--hair)] p-2.5 hover:border-[var(--ink)] cursor-pointer">
                      <div className="w-7 h-7 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--ink-2)]"><I name={o.i} size={13}/></div>
                      <div className="text-[11px] font-extrabold mt-2">{o.l}</div>
                      <div className="text-[9.5px] text-[var(--ink-3)] mt-0.5 leading-tight">{o.s}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {["Extension ready","ELL scaffolding","3 UDL checkpoints"].map((t,i)=>(
                    <span key={i} className="text-[10px] font-extrabold bg-[var(--bg)] px-2 py-1 rounded-full inline-flex items-center gap-1"><I name="check" size={9} s={3}/> {t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 sticky top-24">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 card-shadow">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white flex items-center justify-center text-[10px] font-extrabold">2</div>
            <span className="cap">Deliver</span>
          </div>
          <h2 className="display-lg text-[56px] leading-[0.95] mt-5">Every unit comes with the materials students actually use.</h2>
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)] mt-5 font-medium">
            Lessons arrive ready to present — multimedia content, multiple submission types, extensions for early finishers, language scaffolding built in. The platform silently tracks integrity, time on task, and effort.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Multimedia lessons", "Video, images, interactive prompts — submit via text, photo, voice, canvas"],
              ["Automatic extensions", "For early finishers, matched to the current design phase"],
              ["3-tier ELL scaffolding", "Sentence starters, guided prompts, stretch challenges"],
              ["UDL baked in", "Inclusive practices inside activities, not bolted on"],
              ["Live writing integrity", "Paste detection & typing patterns — zero student-facing indicators"],
            ].map((f,i)=>(
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I name="check" size={11} s={3}/></div>
                <div>
                  <div className="text-[14px] font-extrabold">{f[0]}</div>
                  <div className="text-[13px] text-[var(--ink-3)] mt-0.5">{f[1]}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ================= SECTION 3 — STUDENTS WORK (Discovery + Kit) =================
function Section3Students() {
  const stations = [
    { n: "01", t: "Campfire", sub: "Story prompts to surface interests", img: "https://www.studioloom.org/discovery/backgrounds/s1-campfire.webp" },
    { n: "03", t: "Collection", sub: "Gather references that spark", img: "https://www.studioloom.org/discovery/backgrounds/s3-collection.webp" },
    { n: "06", t: "Crossroads", sub: "Converge on one direction", img: "https://www.studioloom.org/discovery/backgrounds/s6-crossroads.webp" },
    { n: "07", t: "Launchpad", sub: "Commit and start building", img: "https://www.studioloom.org/discovery/backgrounds/s7-launchpad.webp" },
  ];
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-28">
      <div className="grid grid-cols-12 gap-12 items-start">
        <div className="col-span-5 sticky top-24">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 card-shadow">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white flex items-center justify-center text-[10px] font-extrabold">3</div>
            <span className="cap">Students work</span>
          </div>
          <h2 className="display-lg text-[56px] leading-[0.95] mt-5">They own the process. You see it happen.</h2>
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)] mt-5 font-medium">
            Students work through real challenges at their own pace — sketching, prototyping, testing, reflecting. A mentor scaffolds without over-helping. They discover their own projects. They earn independence.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Effort-gated mentor", "Kit asks questions, never gives answers"],
              ["42 thinking tools inside lessons", "No context switching"],
              ["Discovery Engine", "8 stations to find their own direction"],
              ["Open Studio", "Self-directed mode with drift detection"],
              ["Portfolio builds automatically", "From daily work — not a separate assignment"],
            ].map((f,i)=>(
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#9333EA] text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I name="check" size={11} s={3}/></div>
                <div>
                  <div className="text-[14px] font-extrabold">{f[0]}</div>
                  <div className="text-[13px] text-[var(--ink-3)] mt-0.5">{f[1]}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-7">
          {/* Discovery stations as a film strip */}
          <div className="mb-4">
            <div className="cap text-[var(--ink-3)] mb-3 inline-flex items-center gap-2"><I name="layers" size={12} s={2.5}/> Discovery Engine · 8 stations</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stations.map((s,i)=>(
              <div key={i} className="relative rounded-2xl overflow-hidden aspect-[4/3] card-shadow">
                <img src={s.img} className="absolute inset-0 w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"/>
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full w-8 h-8 flex items-center justify-center mono text-[10px] font-bold">{s.n}</div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="display text-[18px] leading-tight">{s.t}</div>
                  <div className="text-[11px] opacity-85 mt-0.5">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Kit mentor chat */}
          <div className="mt-5 bg-white rounded-3xl p-5 card-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#6366F1] via-[#9333EA] to-[#EC4899] flex items-center justify-center text-white"><I name="spark" size={18} s={2.5}/></div>
              <div>
                <div className="display text-[16px] leading-none">Kit · AI design mentor</div>
                <div className="text-[11px] text-[var(--ink-3)] mt-1">Effort-gated · Socratic by design</div>
              </div>
              <div className="flex-1"/>
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-[#10B981] bg-[#D1FAE5] rounded-full px-2.5 py-1"><span className="pulse text-[#10B981]"/> Active</div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E86F2C] to-[#EC4899] text-white flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">SM</div>
                <div className="bg-[var(--bg)] rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-xs">
                  <div className="text-[12.5px]">I don't know what to sketch first.</div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-[var(--ink)] text-white rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-sm">
                  <div className="text-[12.5px]">What's one thing in nature you've looked at twice this week?</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366F1] to-[#9333EA] text-white flex items-center justify-center flex-shrink-0"><I name="spark" size={11} s={2.5}/></div>
              </div>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E86F2C] to-[#EC4899] text-white flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">SM</div>
                <div className="bg-[var(--bg)] rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-xs">
                  <div className="text-[12.5px]">A leaf skeleton on the path.</div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-[var(--ink)] text-white rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-sm">
                  <div className="text-[12.5px]">Good. What's strong about how it's made?</div>
                </div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366F1] to-[#9333EA] text-white flex items-center justify-center flex-shrink-0"><I name="spark" size={11} s={2.5}/></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= SECTION 4 — SEE EVERYTHING =================
function Section4See() {
  const students = [
    { n: "Maya T.",   i: "M", c: "#10B981", status: "on track", wi: 92, pct: [100,100,100,60,0,0,0,0] },
    { n: "Liam K.",   i: "L", c: "#0EA5A4", status: "ahead",    wi: 88, pct: [100,100,100,100,100,40,0,0] },
    { n: "Sophie R.", i: "S", c: "#DC2626", status: "flagged",  wi: 45, pct: [100,100,80,0,0,0,0,0] },
    { n: "Aiden W.",  i: "A", c: "#10B981", status: "on track", wi: 91, pct: [100,100,100,70,0,0,0,0] },
    { n: "Zara M.",   i: "Z", c: "#F59E0B", status: "stuck",    wi: 78, pct: [100,100,100,100,30,0,0,0] },
    { n: "Noah C.",   i: "N", c: "#0EA5A4", status: "ahead",    wi: 95, pct: [100,100,100,100,100,80,0,0] },
  ];
  const color = (pct) => pct === 100 ? "#10B981" : pct > 50 ? "#0EA5A4" : pct > 0 ? "#F59E0B" : "#E8E6DF";
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-28">
      <div className="grid grid-cols-12 gap-12 items-start">
        <div className="col-span-7">
          {/* progress grid mock */}
          <div className="bg-white rounded-3xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="display text-[18px]">Sustainable Packaging · 10B</div>
                <div className="text-[11px] text-[var(--ink-3)] font-semibold mt-0.5">18 of 24 on track</div>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#10B981]"><span className="pulse text-[#10B981]"/> Live</div>
            </div>
            <div className="text-[10.5px] font-extrabold text-[var(--ink-3)] uppercase tracking-wider grid gap-0.5" style={{ gridTemplateColumns: "130px repeat(8, minmax(0,1fr)) 60px 60px" }}>
              <div>Student</div>
              {[1,2,3,4,5,6,7,8].map(n => <div key={n} className="text-center">L{n}</div>)}
              <div className="text-center">Pace</div>
              <div className="text-center">WI</div>
            </div>
            <div className="mt-2 space-y-1.5">
              {students.map((s,i)=>(
                <div key={i} className="grid items-center gap-0.5 py-1" style={{ gridTemplateColumns: "130px repeat(8, minmax(0,1fr)) 60px 60px" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-extrabold text-[10px]" style={{background: s.c}}>{s.i}</div>
                    <div className="text-[12px] font-bold truncate">{s.n}</div>
                  </div>
                  {s.pct.map((p, j) => (
                    <div key={j} className="h-6 rounded mx-0.5" style={{ background: color(p), opacity: p===0?0.4:1 }}/>
                  ))}
                  <div className="text-[10.5px] font-extrabold text-center" style={{color: s.c}}>{s.status}</div>
                  <div className="text-[10.5px] font-extrabold text-center tnum" style={{color: s.wi>80?"#10B981": s.wi>60?"#F59E0B":"#DC2626"}}>{s.wi}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 text-[10px] font-bold text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#10B981]"/> Complete</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#0EA5A4]"/> In progress</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#F59E0B]"/> Started</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#E8E6DF]"/> Not started</span>
              <span className="ml-auto">WI = Writing Integrity</span>
            </div>
          </div>

          {/* Smart insights panel */}
          <div className="mt-5 bg-white rounded-3xl p-5 card-shadow">
            <div className="cap text-[var(--ink-3)] mb-3 inline-flex items-center gap-2"><I name="spark" size={12} s={2.5}/> Smart insights</div>
            <div className="space-y-2.5">
              {[
                { c: "#F59E0B", bg: "#FEF3C7", i:"clock", t:"Zara stuck on Lesson 5 for 48h", a:"Needs help" },
                { c: "#DC2626", bg: "#FEE2E2", i:"alert", t:"Sophie — integrity flag (high paste ratio)", a:"Review work" },
                { c: "#9333EA", bg: "#EDE9FE", i:"book",  t:"3 students have unmarked work (7+ days)", a:"Grade pending" },
              ].map((x,i)=>(
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: x.bg }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: x.c }}><I name={x.i} size={16} s={2.2}/></div>
                  <div className="flex-1 text-[12.5px] font-extrabold">{x.t}</div>
                  <button className="text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-white">{x.a} →</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-5 sticky top-24">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 card-shadow">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white flex items-center justify-center text-[10px] font-extrabold">4</div>
            <span className="cap">See everything</span>
          </div>
          <h2 className="display-lg text-[56px] leading-[0.95] mt-5">The data collects itself.</h2>
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)] mt-5 font-medium">
            No spreadsheets. No manual entry. Writing behaviour, time on task, attempts, pace feedback — captured silently while students work. Smart Insights surfaces what matters.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Writing integrity monitoring", "Paste detection, typing patterns, focus — invisible to students"],
              ["Activity tracking", "Time, attempts, effort signals per activity, per student"],
              ["Smart Insights feed", "Priority-sorted alerts, not raw data tables"],
              ["Emoji pace feedback", "One tap per lesson feeds the timing model for next time"],
            ].map((f,i)=>(
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#0EA5A4] text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I name="check" size={11} s={3}/></div>
                <div>
                  <div className="text-[14px] font-extrabold">{f[0]}</div>
                  <div className="text-[13px] text-[var(--ink-3)] mt-0.5">{f[1]}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ================= SECTION 5 — ASSESS & SHOWCASE =================
function Section5Assess() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-28">
      <div className="grid grid-cols-12 gap-12 items-start">
        <div className="col-span-5 sticky top-24">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 card-shadow">
            <div className="w-6 h-6 rounded-full bg-[var(--ink)] text-white flex items-center justify-center text-[10px] font-extrabold">5</div>
            <span className="cap">Assess & showcase</span>
          </div>
          <h2 className="display-lg text-[56px] leading-[0.95] mt-5">From grading to gallery — the evidence is already there.</h2>
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)] mt-5 font-medium">
            Grade with the evidence the platform already collected. Students showcase through structured peer review rounds, not just submission. The portfolio is already built.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Criterion-based grading", "MYP 1-8, GCSE %, PLTW 1-4 and more"],
              ["Evidence panel", "Student work, integrity report, activity data — together"],
              ["Gallery peer review", "Structured formats like PMI, Two Stars & a Wish"],
              ["Effort-gated feedback", "Students review first, then see peer feedback"],
            ].map((f,i)=>(
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EC4899] text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I name="check" size={11} s={3}/></div>
                <div>
                  <div className="text-[14px] font-extrabold">{f[0]}</div>
                  <div className="text-[13px] text-[var(--ink-3)] mt-0.5">{f[1]}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-7">
          {/* Grading card */}
          <div className="bg-white rounded-3xl overflow-hidden card-shadow">
            <div className="aspect-[16/7] relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1576595580361-90a855b84b20?w=1000&h=500&fit=crop" className="w-full h-full object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <div className="cap opacity-80">Maya T. · Sustainable Packaging</div>
                <div className="display text-[22px] leading-tight mt-1">Mushroom mycelium container prototype</div>
              </div>
              <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur rounded-full px-2.5 py-1 text-[11px] font-extrabold text-[#10B981]"><I name="check" size={11} s={3}/> Integrity clean</div>
            </div>
            <div className="p-5">
              <div className="cap text-[var(--ink-3)] mb-3">Criterion-based grading · MYP 1–8</div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: "Criterion A", s: "Inquiring & analysing", n: 6 },
                  { l: "Criterion B", s: "Developing ideas", n: 5 },
                  { l: "Criterion C", s: "Creating the solution", n: 7 },
                  { l: "Criterion D", s: "Evaluating", n: 4 },
                ].map((c,i)=>(
                  <div key={i} className="bg-[var(--bg)] rounded-2xl p-3">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">{c.l}</div>
                    <div className="display-lg text-[40px] leading-none mt-1 tnum">{c.n}<span className="text-[14px] text-[var(--ink-3)] font-bold">/8</span></div>
                    <div className="text-[10.5px] text-[var(--ink-3)] mt-1 font-semibold leading-tight">{c.s}</div>
                    <div className="mt-2 h-1 rounded-full bg-[var(--hair)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(c.n/8)*100}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--hair)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {["#EC4899","#0EA5A4","#F59E0B","#9333EA"].map((c,i)=>(
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white" style={{ background: c }}/>
                    ))}
                  </div>
                  <div className="text-[12px] font-extrabold">12 peer reviews completed this round</div>
                </div>
                <button className="btn-primary rounded-full px-4 py-2 text-[12px] inline-flex items-center gap-1.5">Open gallery <I name="arrow" size={10} s={2.5}/></button>
              </div>
            </div>
          </div>

          {/* Peer review preview */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { f: "PMI", t: "Plus · Minus · Interesting", c: "#0EA5A4" },
              { f: "Two Stars & a Wish", t: "Celebrate + one growth idea", c: "#EC4899" },
              { f: "I like / I wish", t: "Short format", c: "#F59E0B" },
            ].map((p,i)=>(
              <div key={i} className="bg-white rounded-2xl p-4 card-shadow">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-[10px]" style={{background: p.c}}>{p.f.slice(0,2).toUpperCase()}</div>
                <div className="display text-[14px] mt-2">{p.f}</div>
                <div className="text-[11px] text-[var(--ink-3)] mt-1">{p.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= TOOLKIT STRIP =================
function Toolkit() {
  const tools = [
    "SCAMPER", "Six Hats", "PMI", "Five Whys", "Empathy Map",
    "Decision Matrix", "SWOT", "Stakeholder Map", "Lotus Diagram", "Dot Voting",
    "KWL", "Impact/Effort", "MoSCoW", "Crazy 8s", "Role Storming",
    "Reverse Brainstorm", "How Might We", "Premortem", "Assumption Audit", "Storyboard",
    "Journey Map", "Mind Map", "Affinity", "Morphological",
  ];
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-32">
      <div className="relative rounded-[40px] overflow-hidden card-shadow-lg" style={{ background: "#111827" }}>
        <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(800px 400px at 20% 0%, #9333EA 0%, transparent 60%), radial-gradient(800px 400px at 80% 100%, #0EA5A4 0%, transparent 60%)" }}/>
        <div className="relative p-12 text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-extrabold"><I name="grid" size={12} s={2.5}/> Thinking Toolkit · free, no login</div>
          <div className="grid grid-cols-12 gap-8 mt-6 items-end">
            <div className="col-span-7">
              <h2 className="display-lg text-[72px] leading-[0.9]">
                42 tools your<br/>students will<br/>
                <span style={{ color: "#FBBF24" }}>actually use.</span>
              </h2>
              <p className="text-[16px] text-white/75 mt-5 max-w-lg">Browse, open, and drop into any lesson. Works for any framework — and works on its own without the platform.</p>
              <div className="flex items-center gap-3 mt-6">
                <button className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-extrabold text-[13.5px] inline-flex items-center gap-2">Open the toolkit <I name="arrow" size={12} s={2.5}/></button>
                <button className="bg-white/15 hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13px]">See all 42</button>
              </div>
            </div>
            <div className="col-span-5">
              <div className="flex flex-wrap gap-2">
                {tools.map((t, i) => (
                  <span key={i} className="bg-white/10 hover:bg-white/20 transition backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-extrabold">{t}</span>
                ))}
                <span className="bg-[#FBBF24] text-[var(--ink)] rounded-full px-3 py-1.5 text-[11.5px] font-extrabold">+18 more</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= FRAMEWORKS =================
function Frameworks() {
  const fws = ["IB MYP", "GCSE DT", "A-Level DT", "IGCSE DT", "ACARA", "PLTW", "Stanford d.school", "IDEO", "Double Diamond"];
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-20">
      <div className="text-center">
        <div className="cap text-[var(--ink-3)]">Works with your framework</div>
        <h2 className="display-lg text-[40px] leading-none mt-2">Whatever you're already teaching.</h2>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 marquee-mask">
        {fws.map((f,i)=>(
          <div key={i} className="bg-white rounded-full px-5 py-3 text-[13.5px] font-extrabold card-shadow">{f}</div>
        ))}
      </div>
    </section>
  );
}

// ================= FINAL CTA =================
function FinalCTA() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-28 pb-20">
      <div className="relative rounded-[40px] overflow-hidden card-shadow-lg glow-inner grain" style={{ background: "linear-gradient(135deg, #E86F2C 0%, #D85C1C 40%, #9333EA 100%)" }}>
        <div className="p-16 text-white relative">
          <div className="max-w-3xl">
            <h2 className="display-xl text-[80px] leading-[0.9]">
              Ready to teach with<br/>
              <span className="serif-em">everything</span> in one place?
            </h2>
            <p className="text-[17px] text-white/85 mt-6 max-w-xl font-medium">
              Start with the free toolkit — no login needed. Or set up your first class and see what it feels like when the platform actually works with you.
            </p>
            <div className="flex items-center gap-3 mt-8">
              <button className="bg-white text-[var(--ink)] rounded-full px-6 py-3.5 font-extrabold text-[14px] inline-flex items-center gap-2 hover:shadow-xl transition">
                Get started free <I name="arrow" size={12} s={2.5}/>
              </button>
              <button className="bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-full px-6 py-3.5 font-bold text-[14px]">Browse the toolkit</button>
            </div>
          </div>
          {/* Decorative tool chips bottom right */}
          <div className="absolute bottom-6 right-6 hidden lg:flex flex-col items-end gap-2">
            {["SCAMPER","Empathy Map","PMI"].map((t,i)=>(
              <div key={i} className="bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-extrabold" style={{ transform: `rotate(${(i-1)*3}deg)` }}>{t}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= FOOTER =================
function Footer() {
  return (
    <footer className="max-w-[1400px] mx-auto px-6 pb-12">
      <div className="border-t border-[var(--hair)] pt-10 grid grid-cols-12 gap-8">
        <div className="col-span-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">#</div>
            <div className="display text-[17px] leading-none">StudioLoom</div>
          </div>
          <p className="text-[13px] text-[var(--ink-3)] mt-3 max-w-sm leading-relaxed">
            The platform for project-based classrooms. Works with IB MYP, GCSE, ACARA, PLTW & more.
          </p>
        </div>
        {[
          ["Platform", ["Unit library","Lesson delivery","Live dashboard","Grading","Portfolio"]],
          ["Resources", ["Free toolkit","Frameworks","Pedagogy","Help & docs"]],
          ["Company",  ["About","Schools","Pricing","Contact"]],
        ].map((g,i)=>(
          <div key={i} className={i===0?"col-span-3":"col-span-2"}>
            <div className="cap text-[var(--ink-3)] mb-3">{g[0]}</div>
            <ul className="space-y-2">
              {g[1].map((l,j)=>(
                <li key={j}><a className="text-[13px] font-semibold hover:text-[var(--accent)]">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 pt-6 border-t border-[var(--hair)] flex items-center justify-between text-[11.5px] text-[var(--ink-3)] font-semibold">
        <div>© 2026 StudioLoom · Built by teachers, for teachers</div>
        <div className="flex gap-5">
          <a className="hover:text-[var(--ink)]">Privacy</a>
          <a className="hover:text-[var(--ink)]">Terms</a>
          <a className="hover:text-[var(--ink)]">Security</a>
        </div>
      </div>
    </footer>
  );
}

// ================= APP =================
const L_TWEAKS = /*EDITMODE-BEGIN*/{
  "displayFont": "Manrope",
  "accent": "#E86F2C"
}/*EDITMODE-END*/;

const FONT_OPTIONS = [
  { name: "Manrope",            tracking: "-0.04em"  },
  { name: "Bricolage Grotesque",tracking: "-0.045em" },
  { name: "Space Grotesk",      tracking: "-0.03em"  },
  { name: "Syne",               tracking: "-0.035em" },
  { name: "Archivo",            tracking: "-0.04em"  },
  { name: "Unbounded",          tracking: "-0.045em" },
];
const ACCENT_OPTIONS = [
  { name: "Ember",    hex: "#E86F2C", dark: "#C85618" },
  { name: "Teal",     hex: "#0EA5A4", dark: "#0F766E" },
  { name: "Electric", hex: "#6366F1", dark: "#4338CA" },
  { name: "Magenta",  hex: "#EC4899", dark: "#BE185D" },
  { name: "Lime",     hex: "#65A30D", dark: "#4D7C0F" },
];

function App() {
  const [displayFont, setFont] = React.useState(L_TWEAKS.displayFont);
  const [accent, setAccent] = React.useState(L_TWEAKS.accent);
  const [tweaksOn, setTweaksOn] = React.useState(false);

  React.useEffect(() => {
    const opt = FONT_OPTIONS.find(f => f.name === displayFont) || FONT_OPTIONS[0];
    document.documentElement.style.setProperty("--display-font", `"${opt.name}"`);
    document.documentElement.style.setProperty("--display-tracking", opt.tracking);
  }, [displayFont]);

  React.useEffect(() => {
    const a = ACCENT_OPTIONS.find(x => x.hex === accent) || ACCENT_OPTIONS[0];
    document.documentElement.style.setProperty("--accent", a.hex);
    document.documentElement.style.setProperty("--accent-dark", a.dark);
  }, [accent]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true);
      else if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", h);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", h);
  }, []);

  const setP = (k, v) => {
    (k === "displayFont" ? setFont : setAccent)(v);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
  };

  return (
    <div className="min-h-screen">
      <Nav/>
      <Hero/>
      <HeroVisual/>
      <Section1Plan/>
      <Section2Deliver/>
      <Section3Students/>
      <Section4See/>
      <Section5Assess/>
      <Toolkit/>
      <Frameworks/>
      <FinalCTA/>
      <Footer/>

      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl card-shadow-lg w-80 overflow-hidden border border-[var(--hair)]">
          <div className="bg-[var(--ink)] text-white px-5 py-3 text-[12px] font-extrabold">Tweaks</div>
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="cap text-[var(--ink-3)] mb-2">Display font</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_OPTIONS.map(f => (
                  <button key={f.name} onClick={() => setP("displayFont", f.name)}
                    className={`text-left px-3 py-2 rounded-xl border transition
                      ${displayFont===f.name?"bg-[var(--bg)] border-[var(--ink)]":"bg-white border-[var(--hair)] hover:border-[var(--ink)]"}`}>
                    <div style={{ fontFamily: `"${f.name}"`, fontWeight: 700, letterSpacing: f.tracking, fontSize: 15 }}>{f.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="cap text-[var(--ink-3)] mb-2">Accent color</div>
              <div className="flex items-center gap-2">
                {ACCENT_OPTIONS.map(a => (
                  <button key={a.name} onClick={() => setP("accent", a.hex)}
                    className={`w-10 h-10 rounded-xl border-2 transition ${accent===a.hex?"border-[var(--ink)] scale-110":"border-transparent"}`}
                    style={{ background: a.hex }} title={a.name}/>
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
