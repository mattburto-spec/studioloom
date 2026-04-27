// StudioLoom Hub — multi-program shell with switchable chrome styles.

const prog = (id) => window.HUB_DATA.programs.find(p => p.id === id);

// ============ SHELL TOP BAR ============
function HubTopBar({ user, program, onSwitchPersona, switcherStyle }) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={26}/>
          <div className="h-5 w-px bg-gray-200"/>
          <div className="text-[11px] font-bold text-gray-500">Hub</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSwitchPersona}
            className="text-[11px] font-bold text-gray-600 hover:text-[#1A1A2E] inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-purple-300">
            <IconUsers size={11}/> {user.name}
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-extrabold text-[12px]">{user.initials}</div>
        </div>
      </div>
    </header>
  );
}

// ============ OPTION A: TABS (primary) ============
function ProgramTabs({ user, active, onSelect }) {
  const programs = user.programs;
  // Overflow: show up to 4 tabs, rest collapse into +N dropdown
  const visible = programs.slice(0, 4);
  const hidden = programs.slice(4);
  const [openMore, setOpenMore] = React.useState(false);

  const tabFor = (pm, isActive) => {
    const p = prog(pm.programId);
    return (
      <button key={pm.programId || pm.id} onClick={() => onSelect(pm.programId)}
        className={`group flex items-center gap-2 px-4 h-11 -mb-px border-b-2 text-[12.5px] font-bold whitespace-nowrap transition relative
          ${isActive ? "border-[#1A1A2E] text-[#1A1A2E]" : "border-transparent text-gray-500 hover:text-[#1A1A2E]"}`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }}/>
        <span>{p.name}</span>
        {pm.count != null && <span className="text-[10px] text-gray-400 font-semibold">· {pm.count}</span>}
        {pm.urgent > 0 && <span className="text-[10px] font-extrabold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{pm.urgent}</span>}
        {pm.isNew && <Badge size="sm" variant="info">New</Badge>}
      </button>
    );
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center overflow-x-auto">
        <button onClick={() => onSelect("__everything__")}
          className={`flex items-center gap-1.5 px-3 h-11 -mb-px border-b-2 text-[12.5px] font-extrabold whitespace-nowrap
            ${active === "__everything__" ? "border-[#1A1A2E] text-[#1A1A2E]" : "border-transparent text-gray-500 hover:text-[#1A1A2E]"}`}>
          <IconHome size={13}/> Everything
        </button>
        <div className="w-px h-5 bg-gray-200 mx-2"/>
        {visible.map(pm => tabFor(pm, active === pm.programId))}
        {hidden.length > 0 && (
          <div className="relative">
            <button onClick={() => setOpenMore(v => !v)}
              className="flex items-center gap-1 px-3 h-11 -mb-px border-b-2 border-transparent text-[12px] font-bold text-gray-500 hover:text-[#1A1A2E]">
              +{hidden.length} more <IconChevronRight size={12}/>
            </button>
            {openMore && (
              <div className="absolute top-11 right-0 bg-white border border-gray-200 rounded-xl shadow-lg w-56 py-1 z-40">
                {hidden.map(pm => {
                  const p = prog(pm.programId);
                  return (
                    <button key={pm.programId} onClick={() => { setOpenMore(false); onSelect(pm.programId); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold hover:bg-gray-50 text-left">
                      <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
                      {p.name}
                      {pm.urgent > 0 && <span className="ml-auto text-[10px] font-extrabold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{pm.urgent}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ OPTION B: TOP SWITCHER (dropdown) ============
function ProgramSwitcher({ user, active, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const current = active === "__everything__"
    ? { name: "Everything", color: "#1A1A2E", icon: "🏠" }
    : prog(active);
  const activeMembership = user.programs.find(pm => pm.programId === active);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="relative">
          <button onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl pl-2 pr-3 py-1.5 transition">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px]" style={{ background: `${current.color}1a` }}>
              {current.icon}
            </div>
            <div className="text-left">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Workspace</div>
              <div className="text-[13px] font-extrabold text-[#1A1A2E] leading-none mt-0.5">{current.name}</div>
            </div>
            {activeMembership && <span className="text-[10px] text-gray-500 ml-2">· {activeMembership.cohort}</span>}
            <IconChevronRight size={13}/>
          </button>
          {open && (
            <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-xl shadow-xl w-80 py-2 z-40">
              <button onClick={() => { setOpen(false); onSelect("__everything__"); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left ${active==="__everything__"?"bg-gray-50":""}`}>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[15px]">🏠</div>
                <div className="flex-1">
                  <div className="text-[13px] font-extrabold text-[#1A1A2E]">Everything</div>
                  <div className="text-[11px] text-gray-500">Cross-program hub</div>
                </div>
                {active === "__everything__" && <IconCheck size={14}/>}
              </button>
              <div className="h-px bg-gray-100 my-1.5"/>
              {user.programs.map(pm => {
                const p = prog(pm.programId);
                return (
                  <button key={pm.programId} onClick={() => { setOpen(false); onSelect(pm.programId); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left ${active===pm.programId?"bg-gray-50":""}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: `${p.color}1a` }}>{p.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-extrabold text-[#1A1A2E]">{p.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{pm.cohort} · {pm.role || pm.phase}</div>
                    </div>
                    {pm.urgent > 0 && <span className="text-[10px] font-extrabold text-white bg-rose-500 rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">{pm.urgent}</span>}
                    {active === pm.programId && <IconCheck size={14}/>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <IconUsers size={12}/> {user.programs.length} programs
        </div>
      </div>
    </div>
  );
}

// ============ EVERYTHING — TEACHER ============
function EverythingTeacher({ user }) {
  const allUrgent = user.programs.reduce((a, p) => a + (p.urgent || 0), 0);
  const totalStudents = user.programs.reduce((a, p) => a + (p.count || 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Monday morning</div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#1A1A2E] leading-tight mt-1">
            Hi {user.name.split(" ")[1] || user.name}. {allUrgent} students need you today.
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">Across {user.programs.length} programs · {totalStudents} students total</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {user.programs.map(pm => {
            const p = prog(pm.programId);
            return (
              <div key={pm.programId} className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
                <span className="text-[11px] font-bold text-[#1A1A2E]">{p.name}</span>
                <span className="text-[11px] text-gray-500">{pm.count}</span>
                {pm.urgent > 0 && <span className="text-[10px] font-extrabold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{pm.urgent}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Needs attention across programs */}
      <div>
        <h2 className="text-[14px] font-extrabold text-[#1A1A2E] mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500"/> Needs your attention
        </h2>
        <div className="flex flex-col gap-2">
          {SAMPLE_ATTENTION.slice(0, 5).map(item => {
            const p = prog(item.programId);
            return (
              <Card key={item.id} className="p-3.5 flex items-center gap-3 hover:shadow-sm cursor-pointer">
                <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-extrabold text-[11px] flex-shrink-0"
                  style={{ background: `hsl(${(item.id * 47) % 360} 60% 52%)` }}>{item.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="text-[13px] font-extrabold text-[#1A1A2E]">{item.name}</div>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }}/>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.name}</span>
                  </div>
                  <div className="text-[11.5px] text-gray-600 mt-0.5 truncate">{item.message}</div>
                </div>
                <Badge variant={item.kind==="stuck"?"danger":item.kind==="request"?"warning":"info"} size="sm">{item.tag}</Badge>
                <Button size="sm" variant="primary">Open</Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cohort snapshots */}
      <div>
        <h2 className="text-[14px] font-extrabold text-[#1A1A2E] mb-2">Cohort snapshots</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {user.programs.map(pm => {
            const p = prog(pm.programId);
            return (
              <Card key={pm.programId} className="p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => pm.href !== "#" && (window.location.href = pm.href)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px]" style={{ background: `${p.color}1a` }}>{p.icon}</div>
                    <div>
                      <div className="text-[13px] font-extrabold text-[#1A1A2E]">{p.name}</div>
                      <div className="text-[10px] text-gray-500">{pm.role} · {pm.cohort}</div>
                    </div>
                  </div>
                  {pm.urgent > 0 && <span className="text-[10px] font-extrabold text-white bg-rose-500 rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">{pm.urgent}</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Students</div>
                    <div className="text-xl font-extrabold text-[#1A1A2E]">{pm.count}</div>
                  </div>
                  <div className="h-8 w-px bg-gray-100"/>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Avg progress</div>
                    <div className="text-xl font-extrabold text-[#1A1A2E]">{pm.avg}%</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pm.avg}%`, background: p.color }}/>
                </div>
                <div className="mt-3 text-[11px] font-bold flex items-center gap-1" style={{ color: p.color }}>
                  Open dashboard <IconArrowRight size={11}/>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_ATTENTION = [
  { id: 3,  name: "Jaylen Brooks",   initials: "JB", programId: "pypx",    kind: "stuck",   tag: "🚩 Stuck",     message: "Can't find data on where school food waste actually goes." },
  { id: 11, name: "Marcus Johnson",  initials: "MJ", programId: "pypx",    kind: "stuck",   tag: "Overdue",      message: "Hasn't checked in for 5 days. Bee project stalled." },
  { id: 21, name: "Ava Singh",       initials: "AS", programId: "design",  kind: "stuck",   tag: "🚩 Blocker",   message: "Prototype needs laser cutter time — asked 3 days ago." },
  { id: 22, name: "Noah Clarke",     initials: "NC", programId: "pp",      kind: "request", tag: "Needs reply",  message: "Requested research ethics review meeting." },
  { id: 23, name: "Yusuf Osman",     initials: "YO", programId: "service", kind: "request", tag: "Hours approval", message: "Logged 8h for mentoring program — awaiting approval." },
  { id: 24, name: "Elena Moretti",   initials: "EM", programId: "design",  kind: "stuck",   tag: "Behind pace",  message: "Phase B criterion incomplete · 2 weeks behind cohort." },
];

// ============ EVERYTHING — STUDENT ============
function EverythingStudent({ user }) {
  const first = user.programs.find(p => p.urgency === "high") || user.programs[0];
  const firstProg = prog(first.programId);
  const today = user.programs.flatMap(p => p.nextDue === "Today" ? [p] : []);
  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Good morning</div>
        <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#1A1A2E] leading-tight mt-1">
          Hi {user.name.split(" ")[0]} 👋 You have {user.programs.length} projects going.
        </h1>
      </div>

      {/* Hero — next step across all programs */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${firstProg.color} 0%, #1A1A2E 100%)` }}>
        <div className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full opacity-20" style={{ background: `radial-gradient(circle, #FBBF24, transparent 70%)` }}/>
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"/> Your next step · {firstProg.name}
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-extrabold mt-2 leading-tight max-w-2xl">{first.nextStep}</h2>
          <p className="text-white/80 text-[12.5px] mt-1">Due {first.nextDue} · {first.phase}</p>
          <div className="mt-5 flex gap-2 flex-wrap">
            <button className="bg-[#FBBF24] text-[#1A1A2E] font-extrabold text-[13px] px-4 py-2 rounded-lg hover:brightness-105 inline-flex items-center gap-1.5">
              Start this <IconArrowRight size={13}/>
            </button>
            <button className="bg-white/10 text-white font-bold text-[13px] px-4 py-2 rounded-lg hover:bg-white/20">I did this →</button>
          </div>
        </div>
      </div>

      {/* All projects */}
      <div>
        <h2 className="text-[14px] font-extrabold text-[#1A1A2E] mb-2">Your projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {user.programs.map(pm => {
            const p = prog(pm.programId);
            return (
              <Card key={pm.programId} className={`p-4 hover:shadow-md transition cursor-pointer relative ${pm.isNew ? "!border-blue-300 ring-2 ring-blue-100" : ""}`}
                onClick={() => pm.href !== "#" && (window.location.href = pm.href)}>
                {pm.isNew && <Badge variant="info" className="absolute top-3 right-3">New</Badge>}
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[16px]" style={{ background: `${p.color}1a` }}>{p.icon}</div>
                  <div>
                    <div className="text-[13px] font-extrabold text-[#1A1A2E]">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{pm.cohort}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                    <span style={{ color: p.color }}>{pm.phase}</span>
                    <span className="text-[#1A1A2E]">{pm.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pm.progress}%`, background: p.color }}/>
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-gray-700 line-clamp-2 leading-snug">{pm.nextStep}</div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={`font-bold ${pm.nextDue === "Today" ? "text-rose-600" : pm.nextDue === "Tomorrow" ? "text-amber-600" : "text-gray-500"}`}>Due {pm.nextDue}</span>
                  <span className="text-[#1A1A2E] font-bold inline-flex items-center gap-1">Open <IconArrowRight size={11}/></span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ PROGRAM PREVIEW (stand-in for "click into a program") ============
function ProgramPreview({ program, membership, user, isTeacher }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${program.color} 0%, #1A1A2E 100%)` }}>
        <div className="absolute -right-16 -top-16 w-52 h-52 rounded-full opacity-20" style={{ background: `radial-gradient(circle, #fff, transparent 70%)` }}/>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-white"/> {program.framework}
            </div>
            <h1 className="text-[28px] font-extrabold tracking-tight leading-tight mt-1">{program.name}</h1>
            <p className="text-white/80 text-[13px] mt-1">{membership.cohort} · {membership.role || membership.phase}</p>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Students</div>
                <div className="text-3xl font-extrabold">{membership.count}</div>
              </div>
              <div className="h-10 w-px bg-white/20"/>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Avg</div>
                <div className="text-3xl font-extrabold">{membership.avg}%</div>
              </div>
              <div className="h-10 w-px bg-white/20"/>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Urgent</div>
                <div className="text-3xl font-extrabold text-[#FF6B95]">{membership.urgent}</div>
              </div>
            </div>
          )}
          {!isTeacher && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Progress</div>
              <div className="text-3xl font-extrabold">{membership.progress}%</div>
            </div>
          )}
        </div>
        {membership.href && membership.href !== "#" && (
          <a href={membership.href} className="relative inline-flex items-center gap-1.5 mt-5 bg-white text-[#1A1A2E] font-extrabold text-[12px] px-4 py-2 rounded-lg hover:brightness-105">
            Open full dashboard <IconArrowRight size={12}/>
          </a>
        )}
      </div>
      <Card className="p-6 text-center">
        <div className="text-4xl mb-2">{program.icon}</div>
        <div className="text-[14px] font-extrabold text-[#1A1A2E]">This program's dashboard lives here.</div>
        <div className="text-[12px] text-gray-500 mt-1 max-w-md mx-auto">
          Each program plugs into StudioLoom and brings its own dashboard shape.
          {membership.href && membership.href !== "#" && <> Try the <a href={membership.href} className="font-bold text-purple-700">{program.name} dashboard</a> (already built).</>}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { HubTopBar, ProgramTabs, ProgramSwitcher, EverythingTeacher, EverythingStudent, ProgramPreview, prog });
