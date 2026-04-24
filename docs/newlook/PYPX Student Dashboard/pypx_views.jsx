// PYPX sub-views: Project Board, Skills Library, Resource Library, Journey Engine modal.

const { motion, AnimatePresence, Reorder } = window.Motion || window.FramerMotion || {};

// ============ DRAGGABLE KANBAN ============
const KANBAN_COLS = [
  { id: "todo",  label: "To do",  color: "#9CA3AF", hint: "Not started" },
  { id: "doing", label: "Doing",  color: "#9333EA", hint: "In progress" },
  { id: "done",  label: "Done",   color: "#10B981", hint: "Complete" },
];

function KanbanBoard({ tasks, phases, onToggle, onAdd, onMove }) {
  const [dragId, setDragId] = React.useState(null);
  const [hoverCol, setHoverCol] = React.useState(null);
  const [adding, setAdding] = React.useState(null); // column id or null
  const colRefs = React.useRef({});

  // Determine which column a pointer (x,y) is over
  const colAtPoint = (x, y) => {
    for (const c of KANBAN_COLS) {
      const el = colRefs.current[c.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c.id;
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {KANBAN_COLS.map(col => {
        const items = tasks.filter(t => t.status === col.id);
        const isHover = hoverCol === col.id && dragId;
        return (
          <div key={col.id} className="flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }}/>
                <span className="text-[12px] font-extrabold tracking-wide text-[#1A1A2E] uppercase">{col.label}</span>
                <span className="text-[11px] text-gray-400">{items.length}</span>
              </div>
              <button
                onClick={() => setAdding(col.id)}
                className="w-6 h-6 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-[#1A1A2E] hover:border-purple-300 flex items-center justify-center"
                title={`Add to ${col.label}`}
              >
                <IconPlus size={12}/>
              </button>
            </div>
            <div
              ref={el => (colRefs.current[col.id] = el)}
              className={`flex flex-col gap-2 rounded-xl p-2 min-h-[340px] border-2 transition-colors
                ${isHover ? "bg-purple-50 border-purple-300 border-dashed" : "bg-gray-50 border-transparent"}`}
            >
              <AnimatePresence initial={false}>
                {items.map(t => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    phases={phases}
                    onClick={() => onToggle(t.id)}
                    onDragStart={() => setDragId(t.id)}
                    onDrag={(_, info) => {
                      const col = colAtPoint(info.point.x, info.point.y);
                      setHoverCol(col);
                    }}
                    onDragEnd={(_, info) => {
                      const col = colAtPoint(info.point.x, info.point.y);
                      if (col && col !== t.status) onMove(t.id, { status: col });
                      setDragId(null);
                      setHoverCol(null);
                    }}
                    onChangePhase={(pid) => onMove(t.id, { phase: pid })}
                    isDragging={dragId === t.id}
                  />
                ))}
              </AnimatePresence>

              {adding === col.id && (
                <AddTaskInline
                  phases={phases}
                  onCancel={() => setAdding(null)}
                  onSubmit={(task) => { onAdd({ ...task, status: col.id }); setAdding(null); }}
                />
              )}
              {adding !== col.id && (
                <button
                  onClick={() => setAdding(col.id)}
                  className="mt-1 text-[11px] font-semibold text-gray-400 hover:text-purple-700 flex items-center gap-1 px-1 py-1"
                >
                  <IconPlus size={11}/> Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ task, phases, onClick, onDragStart, onDrag, onDragEnd, onChangePhase, isDragging }) {
  const phase = phases.find(p => p.id === task.phase);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const moved = React.useRef(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      whileDrag={{ scale: 1.03, boxShadow: "0 12px 32px rgba(124,45,215,0.25)", zIndex: 50, cursor: "grabbing" }}
      onDragStart={(e, info) => { moved.current = true; onDragStart(e, info); }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onPointerDown={() => { moved.current = false; }}
      onClick={(e) => {
        if (moved.current) return;
        if (e.target.closest("[data-stop]")) return;
        onClick();
      }}
      className={`relative bg-white border rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none transition-shadow
        ${task.next ? "border-purple-400 ring-2 ring-purple-100" : "border-gray-200"}
        ${isDragging ? "shadow-xl" : "hover:shadow-sm"}`}
    >
      <div className="flex items-start gap-2">
        <button
          data-stop
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="flex items-center gap-1 flex-shrink-0 mt-0.5 rounded-md px-1 py-0.5 hover:bg-gray-100"
          title={`Phase: ${phase?.label || "Unassigned"}`}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: phase?.color || "#9CA3AF" }}/>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: phase?.color || "#9CA3AF" }}>
            {phase?.label?.slice(0, 6) || "None"}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-[12.5px] font-semibold leading-snug ${task.status === "done" ? "line-through text-gray-400" : "text-[#1A1A2E]"}`}>
            {task.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500 inline-flex items-center gap-1"><IconClock size={9}/>{task.due}</span>
            {task.next && <Badge variant="primary" size="sm">Next</Badge>}
            {task.milestone && <Badge variant="pink" size="sm">🎉</Badge>}
          </div>
        </div>
        <span data-stop className="text-gray-300 hover:text-gray-500 cursor-grab pt-0.5" title="Drag">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3"/><circle cx="8" cy="2" r="1.3"/><circle cx="2" cy="7" r="1.3"/><circle cx="8" cy="7" r="1.3"/><circle cx="2" cy="12" r="1.3"/><circle cx="8" cy="12" r="1.3"/></svg>
        </span>
      </div>
      {menuOpen && (
        <div data-stop onClick={e => e.stopPropagation()} className="absolute left-2 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1 w-44">
          <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Move to phase</div>
          {phases.map(p => (
            <button
              key={p.id}
              onClick={() => { onChangePhase(p.id); setMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left hover:bg-gray-50
                ${p.id === task.phase ? "bg-purple-50" : ""}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }}/>
              <span className="font-semibold text-[#1A1A2E]">{p.label}</span>
              {p.id === task.phase && <IconCheck size={10} className="ml-auto text-purple-600"/>}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function AddTaskInline({ phases, onSubmit, onCancel }) {
  const [title, setTitle] = React.useState("");
  const [phase, setPhase] = React.useState(phases[0]?.id);
  const [due, setDue] = React.useState("This week");
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), phase, due });
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-purple-300 rounded-lg p-2.5 shadow-sm"
    >
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        placeholder="What do you need to do?"
        className="w-full text-[12.5px] font-semibold text-[#1A1A2E] placeholder:text-gray-400 outline-none bg-transparent"
      />
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        <select
          value={phase}
          onChange={e => setPhase(e.target.value)}
          className="text-[10px] font-bold uppercase tracking-wider bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 outline-none focus:border-purple-300"
          style={{ color: phases.find(p => p.id === phase)?.color }}
        >
          {phases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input
          value={due}
          onChange={e => setDue(e.target.value)}
          placeholder="Due"
          className="text-[10px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5 outline-none focus:border-purple-300 w-20"
        />
        <div className="ml-auto flex gap-1">
          <button onClick={onCancel} className="text-[11px] font-semibold text-gray-500 hover:text-[#1A1A2E] px-2 py-1">Cancel</button>
          <button onClick={submit} disabled={!title.trim()} className="text-[11px] font-extrabold text-white bg-[#1A1A2E] disabled:bg-gray-300 rounded-md px-2.5 py-1">Add</button>
        </div>
      </div>
    </motion.div>
  );
}

// ============ PROJECT BOARD (with PM style tweaks) ============
function ProjectBoard({ tasks, phases, pmStyle, onToggle, onBack, onAdd, onMove }) {
  // Render based on pmStyle: "phases" (default) | "kanban" | "checklist"
  if (pmStyle === "kanban") {
    return <KanbanBoard tasks={tasks} phases={phases} onToggle={onToggle} onAdd={onAdd} onMove={onMove}/>;
  }
  if (pmStyle === "checklist") {
    return (
      <Card className="p-2">
        {tasks.map((t, i) => {
          const phase = phases.find(p => p.id === t.phase);
          return (
            <div key={t.id} onClick={() => onToggle(t.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                ${t.status === "done" ? "bg-emerald-500 border-emerald-500" : t.status === "doing" ? "border-purple-500 bg-purple-50" : "border-gray-300"}`}>
                {t.status === "done" && <IconCheck size={12}/>}
                {t.status === "doing" && <span className="w-1.5 h-1.5 rounded-full bg-purple-600"/>}
              </div>
              <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: phase?.color }}/>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-semibold ${t.status === "done" ? "line-through text-gray-400" : "text-[#1A1A2E]"}`}>{t.title}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">{phase?.label} · due {t.due}</div>
              </div>
              {t.next && <Badge variant="primary" size="md">Next ↓</Badge>}
              {t.milestone && <Badge variant="pink" size="md">Exhibition 🎉</Badge>}
            </div>
          );
        })}
      </Card>
    );
  }
  // DEFAULT: phases — grouped accordion-ish
  return (
    <div className="flex flex-col gap-4">
      {phases.map(phase => {
        const items = tasks.filter(t => t.phase === phase.id);
        if (!items.length) return null;
        const doneCt = items.filter(t => t.status === "done").length;
        return (
          <Card key={phase.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-extrabold text-sm" style={{ background: phase.color }}>
                  {doneCt === items.length ? <IconCheck size={14}/> : phase.label[0]}
                </div>
                <div>
                  <div className="text-[14px] font-extrabold text-[#1A1A2E]">{phase.label}</div>
                  <div className="text-[11px] text-gray-500">{phase.sub}</div>
                </div>
              </div>
              <div className="text-[11px] font-bold text-gray-500">{doneCt}/{items.length}</div>
            </div>
            <div className="flex flex-col gap-1.5 ml-10">
              {items.map(t => (
                <div key={t.id} onClick={() => onToggle(t.id)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                    ${t.status === "done" ? "bg-emerald-500 border-emerald-500" : t.status === "doing" ? "border-purple-500" : "border-gray-300"}`}>
                    {t.status === "done" && <IconCheck size={9}/>}
                    {t.status === "doing" && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>}
                  </div>
                  <div className={`flex-1 text-[13px] ${t.status === "done" ? "line-through text-gray-400" : "text-[#1A1A2E] font-medium"}`}>{t.title}</div>
                  <span className="text-[10px] text-gray-500">{t.due}</span>
                  {t.next && <Badge variant="primary" size="sm">Next</Badge>}
                  {t.milestone && <Badge variant="pink" size="sm">🎉</Badge>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============ SKILLS LIBRARY ============
function SkillsLibrary({ courses, onSignUp, onOpenLesson }) {
  const [filter, setFilter] = React.useState("All");
  const tags = ["All", ...Array.from(new Set(courses.map(c => c.tag)))];
  const filtered = filter === "All" ? courses : courses.filter(c => c.tag === filter);
  const enrolled = courses.filter(c => c.enrolled);

  return (
    <div className="flex flex-col gap-6">
      {/* header */}
      <div className="rounded-2xl p-5 sm:p-6 text-white shadow-md" style={{ background: "linear-gradient(135deg,#5C16C5,#7B2FF2 50%,#C026D3)" }}>
        <Badge variant="dark" size="md" className="!bg-white/20 !text-white">SKILLS LIBRARY</Badge>
        <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight leading-tight">Pick a mini-skill. Learn it in 15 minutes.</h2>
        <p className="text-white/85 text-sm mt-2 max-w-xl">Short, self-paced lessons. Sign up for one, and it becomes part of your project.</p>
      </div>

      {enrolled.length > 0 && (
        <div>
          <SectionHeader title="Signed up" subtitle="Keep going where you left off"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {enrolled.map(c => (
              <div key={c.id} onClick={() => onOpenLesson(c.id)} className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer">
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: c.color }}/>
                <div className="flex items-start gap-3 pl-2">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c.color}18` }}>
                    <img src={`assets/tools/${c.icon}.png`} className="w-9 h-9"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge size="sm" style={{ background: `${c.color}25`, color: c.color }} className="!font-bold">{c.tag}</Badge>
                      <span className="text-[10px] text-gray-400">{c.lessons} lessons · {c.min} min</span>
                    </div>
                    <h4 className="text-[15px] font-bold text-[#1A1A2E] mt-1.5 leading-tight">{c.title}</h4>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.progress}%`, background: c.color }}/>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: c.color }}>{c.progress}%</span>
                    </div>
                  </div>
                  <IconChevronRight size={16}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filters */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-bold text-[#1A1A2E]">Browse mini-courses</h3>
          <span className="text-[11px] text-gray-500">{filtered.length} of {courses.length}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition
                ${filter === t ? "bg-[#1A1A2E] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-purple-300"}`}>{t}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
              <div className="h-24 flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${c.color}22, ${c.color}05)` }}>
                <img src={`assets/tools/${c.icon}.png`} className="w-16 h-16 object-contain"/>
                {c.recommended && !c.enrolled && <span className="absolute top-2 right-2 text-[9px] font-extrabold tracking-wider bg-amber-400 text-[#1A1A2E] rounded-full px-2 py-0.5 uppercase">For you</span>}
              </div>
              <div className="p-3.5">
                <div className="flex items-center gap-1.5">
                  <Badge size="sm" style={{ background: `${c.color}20`, color: c.color }} className="!font-bold">{c.tag}</Badge>
                </div>
                <h4 className="text-[14px] font-bold text-[#1A1A2E] mt-1.5 leading-tight">{c.title}</h4>
                <div className="text-[10px] text-gray-500 mt-1">{c.lessons} lessons · {c.min} min total</div>
                <div className="mt-3">
                  {c.enrolled ? (
                    <Button size="sm" variant="secondary" onClick={() => onOpenLesson(c.id)} className="w-full">Continue ({c.progress}%) →</Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => onSignUp(c.id)} className="w-full">Sign up</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ RESOURCE LIBRARY ============
function ResourceLibrary({ resources }) {
  const [tab, setTab] = React.useState("people");
  const tabs = [
    { id: "people",    label: "People",     icon: <IconUsers size={14}/>, count: resources.people.length },
    { id: "readings",  label: "Readings",   icon: <IconBook size={14}/>,  count: resources.readings.length },
    { id: "videos",    label: "Videos",     icon: <IconVideo size={14}/>, count: resources.videos.length },
    { id: "templates", label: "Templates",  icon: <IconFile size={14}/>,  count: resources.templates.length },
  ];
  const [q, setQ] = React.useState("");

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-5 sm:p-6 border border-gray-200 bg-gradient-to-br from-amber-50 via-white to-rose-50">
        <Badge variant="pypx" size="md">RESOURCE LIBRARY</Badge>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A2E] mt-3 tracking-tight leading-tight">People who can help. Things you can use.</h2>
        <p className="text-sm text-gray-600 mt-2 max-w-2xl">A curated catalogue, hand-picked by your teachers. Filtered for your project first.</p>
        <div className="mt-4 relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IconSearch size={14}/></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people, readings, tools…" className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"/>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold border-b-2 transition whitespace-nowrap
              ${tab === t.id ? "border-purple-600 text-[#1A1A2E]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.icon}{t.label}<span className="text-[10px] text-gray-400">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "people" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {resources.people.map((p, i) => (
            <div key={i} className={`bg-white border rounded-2xl p-4 hover:shadow-md transition ${p.relevant ? "border-purple-300 ring-2 ring-purple-50" : "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0" style={{ background: `hsl(${(i * 47) % 360} 60% 55%)` }}>
                  {p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-[#1A1A2E] leading-tight">{p.name}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">{p.role}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" size="sm">{p.tag}</Badge>
                    {p.relevant && <Badge variant="primary" size="sm">For you</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-[10px] text-gray-500 flex items-center gap-1"><IconClock size={10}/>{p.avail}</div>
                <button className="text-[11px] font-bold text-purple-700 hover:text-purple-900">Request →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "readings" && (
        <div className="flex flex-col gap-2">
          {resources.readings.map((r, i) => (
            <div key={i} className={`bg-white border rounded-xl p-4 hover:shadow-sm transition flex items-center gap-4 ${r.relevant ? "border-purple-300" : "border-gray-200"}`}>
              <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0"><IconBook size={18}/></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold text-[#1A1A2E] truncate">{r.title}</div>
                  {r.relevant && <Badge variant="primary" size="sm">For you</Badge>}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{r.src} · {r.mins} min read</div>
              </div>
              <button className="text-[11px] font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1">Read <IconExternal size={11}/></button>
            </div>
          ))}
        </div>
      )}

      {tab === "videos" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {resources.videos.map((v, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition">
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-600 relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center ml-1 shadow"><IconPlay size={16}/></div>
                <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/70 rounded px-1.5 py-0.5">{v.dur}</span>
              </div>
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-bold text-[#1A1A2E] leading-tight">{v.title}</div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-[10px] text-gray-500">{v.src}</div>
                  {v.relevant && <Badge variant="primary" size="sm">For you</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resources.templates.map((r, i) => (
            <div key={i} className={`bg-white border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition ${r.relevant ? "border-purple-300" : "border-gray-200"}`}>
              <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0"><IconFile size={18}/></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-bold text-[#1A1A2E]">{r.title}</div>
                  {r.relevant && <Badge variant="primary" size="sm">For you</Badge>}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">{r.type}</div>
              </div>
              <Button size="sm" variant="secondary">Open</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ JOURNEY ENGINE modal (PYPX variant) ============
function JourneyModal({ open, onClose }) {
  if (!open) return null;
  const stations = [
    { n: 1, label: "Curiosities",  sub: "What do you wonder about?",     done: true },
    { n: 2, label: "Your world",   sub: "What's happening around you?",  done: true },
    { n: 3, label: "Questions",    sub: "Turn wonders into BIG questions", done: true },
    { n: 4, label: "Who cares?",   sub: "Who does this affect?",          done: true, current: false },
    { n: 5, label: "Take action",  sub: "What could you actually DO?",    done: false, current: true },
    { n: 6, label: "Your pitch",   sub: "Say your project in 1 sentence", done: false },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-40 relative flex items-end p-6" style={{ background: "linear-gradient(135deg,#FBBF24 0%,#FF6B6B 50%,#9333EA 100%)" }}>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-700"><IconX size={14}/></button>
          <div className="text-white">
            <Badge variant="dark" size="md" className="!bg-white/25 !text-white">🧭 PYPX JOURNEY</Badge>
            <h3 className="text-2xl font-extrabold tracking-tight mt-2">Find your action.</h3>
          </div>
          <img src="assets/kit/excited.png" className="absolute right-6 bottom-0 w-28 drop-shadow-lg" alt="Kit"/>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">The PYPX version has 6 stations. It helps you pick a question, find who cares, and choose an action you can actually do.</p>
          <div className="flex flex-col gap-1.5 mb-5">
            {stations.map(s => (
              <div key={s.n} className={`flex items-center gap-3 p-2.5 rounded-lg ${s.current ? "bg-purple-50 border border-purple-200" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold flex-shrink-0
                  ${s.done ? "bg-emerald-500 text-white" : s.current ? "bg-purple-600 text-white ring-4 ring-purple-100" : "bg-gray-100 text-gray-500"}`}>
                  {s.done ? <IconCheck size={12}/> : s.n}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-[#1A1A2E]">{s.label}</div>
                  <div className="text-[11px] text-gray-500">{s.sub}</div>
                </div>
                {s.current && <Badge variant="primary" size="sm">Continue →</Badge>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={onClose}>Later</Button>
            <Button variant="primary" iconRight={<IconArrowRight size={14}/>}>Go to station 5</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SIGN-UP confirmation toast / modal ============
function SignUpToast({ course, onClose }) {
  if (!course) return null;
  return (
    <div className="fixed bottom-6 right-6 z-40 bg-white border border-emerald-300 rounded-2xl shadow-xl p-4 w-80 animate-[slide-up_.25s_ease]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0"><IconCheck size={18}/></div>
        <div className="flex-1">
          <div className="text-[13px] font-extrabold text-[#1A1A2E]">Signed up! 🎉</div>
          <div className="text-[12px] text-gray-600 mt-0.5">"{course.title}" is now in your skills. We'll remind you before your next step.</div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="primary">Start now</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Later</Button>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><IconX size={14}/></button>
      </div>
    </div>
  );
}

Object.assign(window, { ProjectBoard, SkillsLibrary, ResourceLibrary, JourneyModal, SignUpToast });
