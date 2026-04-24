// Main app shell — view router, tweaks, state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "pmStyle": "phases",
  "density": "cozy",
  "heroEmphasis": "huge",
  "accent": "purple",
  "showSkills": true,
  "showResources": true,
  "studentName": "Aarav Mehta"
}/*EDITMODE-END*/;

function useTweaks() {
  const [tweaks, setTweaks] = React.useState(() => {
    try {
      const s = localStorage.getItem("pypx-tweaks");
      return s ? { ...TWEAK_DEFAULTS, ...JSON.parse(s) } : TWEAK_DEFAULTS;
    } catch { return TWEAK_DEFAULTS; }
  });
  const update = (patch) => {
    setTweaks(t => {
      const n = { ...t, ...patch };
      try { localStorage.setItem("pypx-tweaks", JSON.stringify(n)); } catch {}
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
      return n;
    });
  };
  return [tweaks, update];
}

function TweaksPanel({ open, tweaks, set, onClose }) {
  if (!open) return null;
  const Row = ({ label, children }) => (
    <div className="mb-3">
      <div className="text-[10px] font-extrabold tracking-wider uppercase text-gray-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
  const Pills = ({ opts, value, onChange }) => (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition
            ${value === o.v ? "bg-[#1A1A2E] text-white border-[#1A1A2E]" : "bg-white text-gray-700 border-gray-200 hover:border-purple-300"}`}>{o.l}</button>
      ))}
    </div>
  );
  return (
    <div className="fixed bottom-5 right-5 z-40 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-1.5"><IconSettings size={14}/> Tweaks</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><IconX size={14}/></button>
      </div>
      <Row label="PM style">
        <Pills value={tweaks.pmStyle} onChange={v => set({ pmStyle: v })}
          opts={[{ v: "phases", l: "Phases" }, { v: "kanban", l: "Kanban" }, { v: "checklist", l: "Checklist" }]}/>
      </Row>
      <Row label="Density">
        <Pills value={tweaks.density} onChange={v => set({ density: v })}
          opts={[{ v: "cozy", l: "Cozy" }, { v: "compact", l: "Compact" }]}/>
      </Row>
      <Row label="Next-step emphasis">
        <Pills value={tweaks.heroEmphasis} onChange={v => set({ heroEmphasis: v })}
          opts={[{ v: "huge", l: "Huge" }, { v: "medium", l: "Medium" }]}/>
      </Row>
      <Row label="Show on dashboard">
        <div className="flex flex-col gap-1.5">
          {[{ k: "showSkills", l: "Skills library card" }, { k: "showResources", l: "Resources card" }].map(x => (
            <label key={x.k} className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!tweaks[x.k]} onChange={e => set({ [x.k]: e.target.checked })} className="accent-purple-600"/>{x.l}
            </label>
          ))}
        </div>
      </Row>
      <div className="text-[10px] text-gray-400 mt-2 pt-3 border-t border-gray-100">Changes preview live · saved in your browser.</div>
    </div>
  );
}

// ====== HOME VIEW ======
function HomeView({ tweaks, data, setCourses, onNav, onOpenJourney, setSignup }) {
  const [tasks, setTasks] = React.useState(data.tasks);
  const handleToggle = (id) => {
    setTasks(t => t.map(x => x.id === id ? { ...x, status: x.status === "done" ? "doing" : "done" } : x));
  };
  const signUp = (cid) => {
    setCourses(cs => cs.map(c => c.id === cid ? { ...c, enrolled: true, progress: 5 } : c));
    const c = data.skillsLibrary.find(c => c.id === cid);
    setSignup(c);
    setTimeout(() => setSignup(null), 4500);
  };

  return (
    <>
      <ProjectHeader project={data.project} phases={data.phases}/>
      <div className="h-6"/>
      <NextStepHero step={data.nextStep} emphasis={tweaks.heroEmphasis} onOpen={onNav} onDone={() => alert("Nice! Moving to next step.")}/>
      <div className="h-5"/>
      <MilestoneStrip milestones={data.milestones} project={data.project}/>

      <div className="h-7"/>
    </>
  );
}

function App() {
  const [tweaks, setTweaks] = useTweaks();
  const [view, setView] = React.useState(() => {
    try { return localStorage.getItem("pypx-view") || "home"; } catch { return "home"; }
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [journeyOpen, setJourneyOpen] = React.useState(false);
  const [signup, setSignup] = React.useState(null);
  const [courses, setCourses] = React.useState(PYPX_DATA.skillsLibrary);
  const [boardTasks, setBoardTasks] = React.useState(PYPX_DATA.tasks);

  // Edit-mode protocol
  React.useEffect(() => {
    const h = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", h);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", h);
  }, []);

  const nav = (v) => {
    setView(v);
    try { localStorage.setItem("pypx-view", v); } catch {}
    window.scrollTo({ top: 0 });
  };
  const data = { ...PYPX_DATA, skillsLibrary: courses, tasks: boardTasks, student: { ...PYPX_DATA.student, name: tweaks.studentName || PYPX_DATA.student.name } };
  const signUp = (cid) => {
    setCourses(cs => cs.map(c => c.id === cid ? { ...c, enrolled: true, progress: 5 } : c));
    const c = courses.find(c => c.id === cid);
    setSignup(c);
    setTimeout(() => setSignup(null), 4500);
  };
  const toggleTask = (id) => setBoardTasks(t => t.map(x => x.id === id ? { ...x, status: x.status === "done" ? "doing" : "done" } : x));

  return (
    <div data-screen-label="PYPX Dashboard" className="min-h-screen bg-[#F8F9FA]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <TopBar student={data.student} view={view} onNav={nav}/>
      <KitMentor tasks={boardTasks} phases={data.phases} studentName={data.student.name} onToggleTask={toggleTask}/>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view === "home" && (
          <>
            <div className="mb-5 flex items-end justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#1A1A2E] tracking-tight leading-[1.05]">Hi {data.student.firstName} <span className="inline-block animate-wave">👋</span></h1>
                <p className="text-sm text-gray-500 mt-1">Your exhibition is in <span className="font-bold text-rose-600">{data.project.daysLeft} days</span>. Here's today.</p>
              </div>
              <button onClick={() => setTweaksOpen(o => !o)} className="text-[11px] font-semibold text-gray-500 hover:text-[#1A1A2E] inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-purple-300">
                <IconSettings size={13}/> Tweaks
              </button>
            </div>
            <HomeView tweaks={tweaks} data={data} setCourses={setCourses} onNav={nav} onOpenJourney={() => setJourneyOpen(true)} setSignup={setSignup}/>
          </>
        )}

        {view === "board" && (
          <>
            <div className="mb-5">
              <button onClick={() => nav("home")} className="text-[12px] font-semibold text-gray-500 hover:text-[#1A1A2E] inline-flex items-center gap-1 mb-3"><IconChevronLeft size={14}/>Back to dashboard</button>
              <h1 className="text-[26px] font-extrabold text-[#1A1A2E] tracking-tight">Project board</h1>
            </div>
            <ProjectBoard
              tasks={boardTasks}
              phases={data.phases}
              pmStyle={tweaks.pmStyle}
              onToggle={toggleTask}
              onAdd={(task) => setBoardTasks(t => [...t, { id: "t-" + Date.now(), status: "todo", due: "Soon", ...task }])}
              onMove={(id, patch) => setBoardTasks(t => t.map(x => x.id === id ? { ...x, ...patch } : x))}
            />
          </>
        )}

        {view === "skills" && (
          <>
            <button onClick={() => nav("home")} className="text-[12px] font-semibold text-gray-500 hover:text-[#1A1A2E] inline-flex items-center gap-1 mb-4"><IconChevronLeft size={14}/>Back to dashboard</button>
            <SkillsLibrary courses={courses} onSignUp={signUp} onOpenLesson={(id) => alert("Opens lesson for " + id)}/>
          </>
        )}

        {view === "resources" && (
          <>
            <button onClick={() => nav("home")} className="text-[12px] font-semibold text-gray-500 hover:text-[#1A1A2E] inline-flex items-center gap-1 mb-4"><IconChevronLeft size={14}/>Back to dashboard</button>
            <ResourceLibrary resources={data.resources}/>
          </>
        )}

        <div className="h-16"/>
      </main>

      {/* Floating portfolio button */}
      <button onClick={() => alert("Opens your PYPX portfolio — photos, journals, artefacts from your project.")}
        className="fixed bottom-5 left-5 z-30 group flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg,#7B2FF2,#C026D3)" }}>
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white"><IconBookmark size={15}/></span>
        <span className="text-[13px] font-extrabold text-white tracking-tight">My portfolio</span>
      </button>

      <JourneyModal open={journeyOpen} onClose={() => setJourneyOpen(false)}/>
      <SignUpToast course={signup} onClose={() => setSignup(null)}/>
      <TweaksPanel open={tweaksOpen} tweaks={tweaks} set={setTweaks} onClose={() => setTweaksOpen(false)}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
