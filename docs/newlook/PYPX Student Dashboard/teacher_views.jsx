// Teacher dashboard — students grid, check-in feed, resource requests.

const moodEmoji = { great: "💪", ok: "🙂", stuck: "🤔", none: "😴" };
const moodColor = { great: "#10B981", ok: "#F59E0B", stuck: "#FF3366", none: "#9CA3AF" };
const phaseIdx = (id, phases) => Math.max(0, phases.findIndex(p => p.id === id));

// ============ TOP BAR ============
function TeacherTopBar({ teacher, tab, onTab, onSwitchView }) {
  const items = [
    { id: "students",  label: "Students",        icon: <IconUsers size={15}/> },
    { id: "checkins",  label: "Check-ins",       icon: <IconMessage size={15}/>, badge: 4 },
    { id: "requests",  label: "Resource requests", icon: <IconBookmark size={15}/>, badge: 4 },
  ];
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size={26}/>
          <nav className="hidden md:flex items-center gap-1">
            {items.map(it => (
              <button key={it.id} onClick={() => onTab(it.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition relative
                  ${tab === it.id ? "bg-purple-100 text-purple-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
                {it.icon}{it.label}
                {it.badge > 0 && (
                  <span className={`text-[10px] font-extrabold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center
                    ${tab === it.id ? "bg-purple-600 text-white" : "bg-rose-500 text-white"}`}>{it.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onSwitchView} className="text-[11px] font-semibold text-gray-500 hover:text-[#1A1A2E] inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-purple-300">
            Student view →
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-extrabold text-[12px]">{teacher.initials}</div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-bold text-[#1A1A2E] leading-tight">{teacher.name}</div>
            <div className="text-[10px] text-gray-500">{teacher.cohort}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============ COHORT HERO (exhibition countdown + snapshot) ============
function CohortHero({ data }) {
  const { students, phases, teacher } = data;
  const byPhase = phases.map(p => ({ ...p, count: students.filter(s => s.phase === p.id).length }));
  const avgPct = Math.round(students.reduce((a, s) => a + s.pct, 0) / students.length);
  const behind = students.filter(s => s.flag === "behind" || s.flag === "stuck").length;
  const ahead  = students.filter(s => s.flag === "ahead").length;

  return (
    <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white shadow-md"
      style={{ background: "linear-gradient(135deg,#1A1A2E 0%,#4B1D8C 45%,#9333EA 100%)" }}>
      <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full opacity-25" style={{ background: "radial-gradient(circle, #FBBF24, transparent 70%)" }}/>
      <div className="absolute -right-10 bottom-[-60px] w-56 h-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #FF3366, transparent 70%)" }}/>

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="dark" size="md" className="!bg-white/20 !text-white">{teacher.cohort}</Badge>
          <h1 className="text-[28px] sm:text-[34px] font-extrabold mt-3 tracking-tight leading-[1.05] max-w-xl">
            Exhibition in <span className="text-[#FBBF24]">{teacher.daysToExhibition} days</span>
          </h1>
          <p className="text-white/80 text-sm mt-1">{teacher.exhibitionDate} · {students.length} students across {phases.length} phases</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Cohort avg</div>
            <div className="text-3xl font-extrabold mt-0.5">{avgPct}%</div>
          </div>
          <div className="h-10 w-px bg-white/20"/>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Need attention</div>
            <div className="text-3xl font-extrabold mt-0.5 text-[#FF6B95]">{behind}</div>
          </div>
          <div className="h-10 w-px bg-white/20"/>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Ahead</div>
            <div className="text-3xl font-extrabold mt-0.5 text-emerald-300">{ahead}</div>
          </div>
        </div>
      </div>

      {/* Cohort distribution bar */}
      <div className="relative mt-5">
        <div className="flex items-center gap-1 h-7 rounded-full overflow-hidden bg-white/10">
          {byPhase.map(p => (
            <div key={p.id} className="h-full flex items-center justify-center text-[10px] font-extrabold text-white/95 border-r border-black/10 last:border-0"
              style={{ width: `${(p.count / students.length) * 100}%`, background: p.color, minWidth: p.count ? "28px" : 0 }}
              title={`${p.label}: ${p.count}`}>
              {p.count > 0 && p.count}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          {byPhase.map(p => (
            <div key={p.id} className="flex-1 text-[9px] font-bold uppercase tracking-wider text-white/70 text-center">{p.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ STUDENT FILTERS ============
function StudentFilters({ phases, filter, setFilter, layout, setLayout, total }) {
  const chips = [
    { id: "all",   label: `All ${total}` },
    { id: "stuck", label: "Needs attention" },
    { id: "ahead", label: "Ahead" },
    ...phases.map(p => ({ id: `phase:${p.id}`, label: p.label, color: p.color })),
  ];
  const layouts = [
    { id: "grid",  label: "Cards", icon: <IconGrid size={12}/> },
    { id: "table", label: "Table", icon: <IconBook size={12}/> },
    { id: "kanban",label: "By phase", icon: <IconFlag size={12}/> },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        {chips.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition border
              ${filter === c.id ? "bg-[#1A1A2E] text-white border-[#1A1A2E]" : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"}`}>
            {c.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }}/>}
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {layouts.map(l => (
          <button key={l.id} onClick={() => setLayout(l.id)}
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-md transition
              ${layout === l.id ? "bg-white text-[#1A1A2E] shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
            {l.icon}{l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ STUDENT CARD ============
function StudentCard({ s, phases, onOpen, onSuggest }) {
  const phase = phases.find(p => p.id === s.phase);
  const flagStyle = s.flag === "stuck" ? "border-rose-300 ring-2 ring-rose-100" :
                    s.flag === "behind" ? "border-amber-300 ring-2 ring-amber-100" :
                    s.flag === "ahead" ? "border-emerald-300 ring-2 ring-emerald-100" :
                    "border-gray-200";
  return (
    <div className={`group bg-white border-2 ${flagStyle} rounded-2xl p-4 hover:shadow-md transition cursor-pointer`} onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-extrabold text-[12px] flex-shrink-0"
            style={{ background: `hsl(${(s.id * 47) % 360} 60% 52%)` }}>
            {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-extrabold text-[#1A1A2E] leading-tight truncate">{s.name}</div>
            <div className="text-[10.5px] text-gray-500 leading-tight truncate">{s.topic}</div>
          </div>
        </div>
        <div className="text-[18px] leading-none flex-shrink-0" title={`Mood: ${s.mood}`}>{moodEmoji[s.mood]}</div>
      </div>

      {/* Phase pill + progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: phase?.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: phase?.color }}/>
            {phase?.label} · Phase {phaseIdx(s.phase, phases) + 1}/5
          </div>
          <span className="text-[11px] font-extrabold text-[#1A1A2E]">{s.pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, ${phase?.color}aa, ${phase?.color})` }}/>
        </div>
      </div>

      {/* Mentor */}
      <div className="mt-3 flex items-center gap-1.5 text-[10.5px]">
        <span className="text-gray-400 font-semibold">Mentor:</span>
        {s.humanMentor ? (
          <span className="inline-flex items-center gap-1 font-bold text-[#1A1A2E]">
            <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 text-[8px] font-extrabold flex items-center justify-center">
              {s.humanMentor.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </span>
            {s.humanMentor}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-bold text-rose-600">
            <span className="w-4 h-4 rounded-full border border-dashed border-rose-400 text-rose-500 text-[9px] font-extrabold flex items-center justify-center">?</span>
            Unassigned
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between text-[10.5px]">
        <div className="text-gray-500">
          {s.tasksDone}/{s.tasksTotal} tasks · {s.lastCheckin}
        </div>
        {s.flag === "stuck" && <Badge variant="danger" size="sm">🚩 {s.blocker}</Badge>}
        {s.flag === "behind" && <Badge variant="warning" size="sm">Behind pace</Badge>}
        {s.flag === "ahead" && <Badge variant="success" size="sm">Ahead ⚡</Badge>}
        {!s.flag && <span className="text-gray-400">On track</span>}
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          onClick={e => { e.stopPropagation(); onSuggest(s); }}
          className="flex-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg py-1.5 inline-flex items-center justify-center gap-1"
        >
          <IconSparkles size={11}/> Suggest resource
        </button>
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          className="text-[11px] font-bold text-gray-500 hover:text-[#1A1A2E] bg-gray-50 hover:bg-gray-100 rounded-lg py-1.5 px-2.5"
        >View</button>
      </div>
    </div>
  );
}

// ============ STUDENT TABLE ROW ============
function StudentTable({ students, phases, onOpen, onSuggest }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 text-left">
            <th className="px-4 py-2.5">Student</th>
            <th className="px-3 py-2.5">Project</th>
            <th className="px-3 py-2.5">Phase</th>
            <th className="px-3 py-2.5">Progress</th>
            <th className="px-3 py-2.5">Mood</th>
            <th className="px-3 py-2.5">Last check-in</th>
            <th className="px-3 py-2.5">Flag</th>
            <th className="px-3 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const phase = phases.find(p => p.id === s.phase);
            return (
              <tr key={s.id} onClick={() => onOpen(s)}
                className={`text-[12.5px] border-b border-gray-100 last:border-0 cursor-pointer hover:bg-purple-50/50 transition
                  ${s.flag === "stuck" ? "bg-rose-50/40" : s.flag === "ahead" ? "bg-emerald-50/30" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full text-white flex items-center justify-center font-extrabold text-[10px]"
                      style={{ background: `hsl(${(s.id * 47) % 360} 60% 52%)` }}>
                      {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <span className="font-bold text-[#1A1A2E]">{s.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-600 max-w-[240px] truncate">{s.topic}</td>
                <td className="px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5 font-semibold" style={{ color: phase?.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: phase?.color }}/>{phase?.label}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: phase?.color }}/>
                    </div>
                    <span className="font-bold text-[11px] text-[#1A1A2E] w-8">{s.pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[16px]">{moodEmoji[s.mood]}</td>
                <td className="px-3 py-2.5 text-gray-500 text-[11.5px]">{s.lastCheckin}</td>
                <td className="px-3 py-2.5">
                  {s.flag === "stuck" && <Badge variant="danger" size="sm">🚩 Stuck</Badge>}
                  {s.flag === "behind" && <Badge variant="warning" size="sm">Behind</Badge>}
                  {s.flag === "ahead" && <Badge variant="success" size="sm">Ahead ⚡</Badge>}
                  {!s.flag && <span className="text-gray-400 text-[11px]">On track</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={e => { e.stopPropagation(); onSuggest(s); }}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1">
                    <IconSparkles size={11}/> Suggest
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ============ KANBAN BY PHASE ============
function StudentKanban({ students, phases, onOpen, onSuggest }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {phases.map(p => {
        const items = students.filter(s => s.phase === p.id);
        return (
          <div key={p.id} className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E]">{p.label}</span>
              <span className="text-[10px] text-gray-400">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 min-h-[200px]">
              {items.map(s => (
                <div key={s.id} onClick={() => onOpen(s)}
                  className={`bg-white border rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition
                    ${s.flag === "stuck" ? "border-rose-300" : s.flag === "ahead" ? "border-emerald-300" : "border-gray-200"}`}>
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full text-white flex items-center justify-center font-extrabold text-[10px] flex-shrink-0"
                      style={{ background: `hsl(${(s.id * 47) % 360} 60% 52%)` }}>
                      {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-extrabold text-[#1A1A2E] leading-tight truncate">{s.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight line-clamp-2">{s.topic}</div>
                    </div>
                    <div className="text-[13px] leading-none">{moodEmoji[s.mood]}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: p.color }}/>
                    </div>
                    <span className="text-[10px] font-bold text-[#1A1A2E]">{s.pct}%</span>
                  </div>
                  {s.flag === "stuck" && <div className="text-[10px] font-bold text-rose-600 mt-1.5">🚩 {s.blocker}</div>}
                </div>
              ))}
              {items.length === 0 && <div className="text-[10px] text-gray-400 text-center py-6">None yet</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ STUDENTS VIEW (composer) ============
function StudentsView({ data, layout, setLayout, onOpen, onSuggest }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = data.students.filter(s => {
    if (filter === "all") return true;
    if (filter === "stuck") return s.flag === "stuck" || s.flag === "behind";
    if (filter === "ahead") return s.flag === "ahead";
    if (filter.startsWith("phase:")) return s.phase === filter.slice(6);
    return true;
  });

  return (
    <>
      <StudentFilters phases={data.phases} filter={filter} setFilter={setFilter} layout={layout} setLayout={setLayout} total={data.students.length}/>
      {filtered.length === 0 && (
        <Card className="p-10 text-center text-sm text-gray-500">No students match this filter.</Card>
      )}
      {layout === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => <StudentCard key={s.id} s={s} phases={data.phases} onOpen={() => onOpen(s)} onSuggest={onSuggest}/>)}
        </div>
      )}
      {layout === "table" && <StudentTable students={filtered} phases={data.phases} onOpen={onOpen} onSuggest={onSuggest}/>}
      {layout === "kanban" && <StudentKanban students={filtered} phases={data.phases} onOpen={onOpen} onSuggest={onSuggest}/>}
    </>
  );
}

// ============ CHECK-IN FEED ============
function CheckinsView({ data, onOpen }) {
  const [tab, setTab] = React.useState("needs"); // needs | positive | all
  const all = [...data.checkins].sort((a, b) => (a.when.includes("h ago") ? -1 : 1));
  const needs = all.filter(c => c.mood === "stuck");
  const positive = all.filter(c => c.mood === "great");
  const shown = tab === "needs" ? needs : tab === "positive" ? positive : all;
  const tabs = [
    { id: "needs", label: "Needs response", count: needs.length },
    { id: "positive", label: "Wins", count: positive.length },
    { id: "all", label: "All", count: all.length },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">End-of-session check-ins</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Summaries pulled from Kit. The raw messages stay with the student.</p>
        </div>
        <span className="text-[10px] text-gray-400 font-semibold">Synced just now</span>
      </div>
      <div className="flex items-center gap-1 border-b border-gray-200 mb-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold border-b-2 transition
              ${tab === t.id ? "border-purple-600 text-[#1A1A2E]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}<span className="text-[10px] text-gray-400">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {shown.map(c => {
          const student = data.students.find(s => s.id === c.studentId);
          const phase = data.phases.find(p => p.id === student?.phase);
          const isStuck = c.mood === "stuck";
          return (
            <Card key={c.id} className={`p-4 hover:shadow-sm transition cursor-pointer ${isStuck ? "!border-rose-200" : ""}`} onClick={() => onOpen(student)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-extrabold text-[12px] flex-shrink-0"
                  style={{ background: `hsl(${(c.studentId * 47) % 360} 60% 52%)` }}>
                  {c.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[13px] font-extrabold text-[#1A1A2E]">{c.name}</div>
                    <span className="text-[10px] text-gray-400">·</span>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: phase?.color }}>{phase?.label}</div>
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[10px] text-gray-500">{c.when}</span>
                    <div className="text-[14px] ml-1">{moodEmoji[c.mood]}</div>
                  </div>
                  <p className="text-[12.5px] text-gray-700 mt-1 leading-relaxed">{c.summary}</p>
                  {c.blocker && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-0.5">
                      🚩 Blocker: {c.blocker}
                    </div>
                  )}
                  {c.finished.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.finished.map(f => (
                        <span key={f} className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isStuck && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button size="sm" variant="primary">Reply</Button>
                    <Button size="sm" variant="ghost">Book 1:1</Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============ RESOURCE REQUESTS ============
function RequestsView({ data, onOpen }) {
  const [state, setState] = React.useState({});
  const pending = data.resourceRequests.filter(r => r.status === "pending" && !state[r.id]);
  const handled = [...data.resourceRequests.filter(r => r.status !== "pending"), ...data.resourceRequests.filter(r => state[r.id])];
  const act = (id, action) => setState(s => ({ ...s, [id]: action }));

  const typeColor = {
    Expert: "#9333EA", Mentoring: "#FF3366", Reading: "#3B82F6",
    Logistics: "#F59E0B", Video: "#10B981",
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">Resource requests</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Approve, suggest something from the library, or connect a person.</p>
        </div>
      </div>
      <div className="mb-6">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 mb-2">Pending · {pending.length}</div>
        <div className="flex flex-col gap-2">
          {pending.map(r => {
            const student = data.students.find(s => s.id === r.studentId);
            return (
              <Card key={r.id} className="p-4 hover:shadow-sm transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-extrabold text-[12px] flex-shrink-0"
                    style={{ background: `hsl(${(r.studentId * 47) % 360} 60% 52%)` }}>
                    {r.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => onOpen(student)} className="text-[13px] font-extrabold text-[#1A1A2E] hover:text-purple-700">{r.name}</button>
                      <Badge size="sm" style={{ background: `${typeColor[r.type]}1a`, color: typeColor[r.type] }} className="!font-bold">{r.type}</Badge>
                      <span className="text-[10px] text-gray-400">· {r.when}</span>
                    </div>
                    <div className="text-[13px] text-[#1A1A2E] mt-1 font-medium">"{r.ask}"</div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button size="sm" variant="primary" onClick={() => act(r.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => act(r.id, "suggested")}>Suggest alt</Button>
                    <button onClick={() => act(r.id, "declined")} className="text-[11px] text-gray-500 hover:text-gray-800">Decline</button>
                  </div>
                </div>
              </Card>
            );
          })}
          {pending.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-[13px] font-bold text-[#1A1A2E]">Inbox zero. Nicely done.</div>
            </Card>
          )}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-2">Handled · {handled.length}</div>
        <div className="flex flex-col gap-1.5">
          {handled.map(r => {
            const action = state[r.id] || r.status;
            const pill = action === "approved" ? { label: "Approved", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" } :
                         action === "suggested" ? { label: "Suggested alternative", bg: "bg-blue-50 text-blue-700 border-blue-200" } :
                         action === "declined" ? { label: "Declined", bg: "bg-gray-100 text-gray-600 border-gray-200" } :
                         { label: r.status, bg: "bg-gray-100 text-gray-600 border-gray-200" };
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-extrabold text-[10px] flex-shrink-0"
                  style={{ background: `hsl(${(r.studentId * 47) % 360} 60% 52%)` }}>
                  {r.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-[#1A1A2E]">{r.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">"{r.ask}"</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pill.bg}`}>{pill.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ SUGGEST RESOURCE MODAL ============
function SuggestModal({ student, onClose }) {
  if (!student) return null;
  const suggestions = [
    { icon: "microscope", title: "Where did I get that fact?", tag: "Skill", why: "Builds the research habit they need next." },
    { icon: "microphone", title: "How to interview an expert", tag: "Skill", why: "Great for their phase (Find out)." },
    { icon: "users",      title: "Connect with Dr. Lin",        tag: "Person", why: "Ornithologist — perfect subject-matter help." },
    { icon: "file",       title: "Survey template (Y3-friendly)", tag: "Template", why: "Saves them a day of setup." },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-gray-100">
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"><IconX size={14}/></button>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Suggest resource</div>
          <h3 className="text-xl font-extrabold tracking-tight mt-1 text-[#1A1A2E]">For {student.name}</h3>
          <div className="text-[12px] text-gray-500 mt-0.5">"{student.topic}"</div>
        </div>
        <div className="p-5">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Curated for their next step</div>
          <div className="flex flex-col gap-2">
            {suggestions.map(s => (
              <button key={s.title} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 text-left transition">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0"><IconSparkles size={16}/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[13px] font-bold text-[#1A1A2E]">{s.title}</div>
                    <Badge size="sm">{s.tag}</Badge>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.why}</div>
                </div>
                <span className="text-[11px] font-bold text-purple-700 flex-shrink-0">Send →</span>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-500">
            Or type a custom note for the student.
          </div>
          <textarea placeholder="Quick note (optional)…" className="mt-2 w-full text-[13px] border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 min-h-[60px]"/>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" iconRight={<IconArrowRight size={14}/>}>Send suggestion</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ STUDENT DRAWER ============
function StudentDrawer({ student, data, onClose, onSuggest }) {
  if (!student) return null;
  const phase = data.phases.find(p => p.id === student.phase);
  const recentCheckins = data.checkins.filter(c => c.studentId === student.id).slice(0, 3);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30"/>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-md bg-white h-full overflow-y-auto animate-[slide-up_.2s_ease]">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-extrabold text-[13px]"
              style={{ background: `hsl(${(student.id * 47) % 360} 60% 52%)` }}>
              {student.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-[14px] font-extrabold text-[#1A1A2E] leading-tight">{student.name}</div>
              <div className="text-[10px] text-gray-500">Grade 5 · PYPX</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><IconX size={14}/></button>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">Big question</div>
            <h3 className="text-[17px] font-extrabold text-[#1A1A2E] leading-tight">"{student.topic}"</h3>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: phase?.color }}>
                {phase?.label} · Phase {phaseIdx(student.phase, data.phases) + 1} of 5
              </div>
              <span className="text-[12px] font-extrabold text-[#1A1A2E]">{student.pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${student.pct}%`, background: phase?.color }}/>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{student.tasksDone} of {student.tasksTotal} tasks complete</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Human mentor</div>
              <div className="text-[12.5px] font-bold text-[#1A1A2E] mt-1">{student.humanMentor || "— Not assigned —"}</div>
              {!student.humanMentor && <button className="text-[10px] font-bold text-purple-700 mt-0.5">Assign →</button>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">AI mentor</div>
              <div className="text-[12.5px] font-bold text-[#1A1A2E] mt-1">{student.aiMentor}</div>
            </div>
          </div>

          {recentCheckins.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-2">Recent check-ins (summary)</div>
              <div className="flex flex-col gap-1.5">
                {recentCheckins.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px]">{moodEmoji[c.mood]}</span>
                      <span className="text-[10px] font-bold text-gray-500">{c.when}</span>
                    </div>
                    <div className="text-[11.5px] text-gray-700 mt-1">{c.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
            <Button variant="primary" icon={<IconSparkles size={14}/>} onClick={() => onSuggest(student)}>Suggest resource</Button>
            <Button variant="secondary" icon={<IconMessage size={14}/>}>Send message</Button>
            <Button variant="ghost" icon={<IconCalendar size={14}/>}>Book 1:1</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  TeacherTopBar, CohortHero, StudentsView, CheckinsView, RequestsView,
  SuggestModal, StudentDrawer,
});
