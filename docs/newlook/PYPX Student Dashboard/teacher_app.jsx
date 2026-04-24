// Teacher dashboard composer — top-level state, tweaks, and routing.

const TEACHER_TWEAKS = /*EDITMODE-BEGIN*/{
  "defaultLayout": "grid",
  "defaultTab": "students",
  "showHero": true,
  "accent": "purple"
}/*EDITMODE-END*/;

function TeacherApp() {
  const data = window.TEACHER_DATA;
  const [tweaks, setTweaks] = React.useState(TEACHER_TWEAKS);
  const [editMode, setEditMode] = React.useState(false);

  const [tab, setTab] = React.useState(() => localStorage.getItem("pypx_teacher_tab") || tweaks.defaultTab);
  const [layout, setLayout] = React.useState(() => localStorage.getItem("pypx_teacher_layout") || tweaks.defaultLayout);
  const [openStudent, setOpenStudent] = React.useState(null);
  const [suggestFor, setSuggestFor] = React.useState(null);

  React.useEffect(() => { localStorage.setItem("pypx_teacher_tab", tab); }, [tab]);
  React.useEffect(() => { localStorage.setItem("pypx_teacher_layout", layout); }, [layout]);

  // Edit-mode protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setEditMode(true);
      if (e.data.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const patchTweaks = (patch) => {
    setTweaks(prev => ({ ...prev, ...patch }));
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  const onSwitchView = () => { window.location.href = "PYPX Dashboard.html"; };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <TeacherTopBar teacher={data.teacher} tab={tab} onTab={setTab} onSwitchView={onSwitchView}/>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "students" && (
          <>
            {tweaks.showHero && <div className="mb-6"><CohortHero data={data}/></div>}
            <StudentsView
              data={data}
              layout={layout}
              setLayout={setLayout}
              onOpen={setOpenStudent}
              onSuggest={setSuggestFor}
            />
          </>
        )}
        {tab === "checkins" && <CheckinsView data={data} onOpen={setOpenStudent}/>}
        {tab === "requests" && <RequestsView data={data} onOpen={setOpenStudent}/>}
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-10 pt-6 mt-6 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
          <div>PYPX teacher console · <a href="PYPX Dashboard.html" className="font-bold text-purple-700 hover:text-purple-900">Student view</a> · <a href="PYPX Mentor Matching.html" className="font-bold text-purple-700 hover:text-purple-900">Mentor matching</a></div>
          <div>Cohort data refreshes at 4:30pm daily</div>
        </div>
      </footer>

      {/* Modals / drawers */}
      <StudentDrawer student={openStudent} data={data} onClose={() => setOpenStudent(null)} onSuggest={setSuggestFor}/>
      <SuggestModal student={suggestFor} onClose={() => setSuggestFor(null)}/>

      {/* Tweaks panel */}
      {editMode && <TeacherTweaksPanel tweaks={tweaks} patch={patchTweaks} layout={layout} setLayout={setLayout} tab={tab} setTab={setTab}/>}
    </div>
  );
}

function TeacherTweaksPanel({ tweaks, patch, layout, setLayout, tab, setTab }) {
  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1A1A2E] text-white px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wider flex items-center gap-2">
        <IconSparkles size={13}/> Tweaks
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Active tab</div>
          <div className="grid grid-cols-3 gap-1">
            {[["students","Students"],["checkins","Check-ins"],["requests","Requests"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`text-[10.5px] font-bold py-1.5 rounded-md border ${tab===id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-600 border-gray-200 hover:border-purple-300"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Students layout</div>
          <div className="grid grid-cols-3 gap-1">
            {[["grid","Cards"],["table","Table"],["kanban","By phase"]].map(([id, label]) => (
              <button key={id} onClick={() => setLayout(id)}
                className={`text-[10.5px] font-bold py-1.5 rounded-md border ${layout===id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-600 border-gray-200 hover:border-purple-300"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Cohort hero</div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1A1A2E]">
            <input type="checkbox" checked={tweaks.showHero} onChange={e => patch({ showHero: e.target.checked })}/>
            Show exhibition countdown
          </label>
        </div>
        <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-400">
          Layout & tab persist in localStorage. Hero & defaults persist to file.
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<TeacherApp/>);
