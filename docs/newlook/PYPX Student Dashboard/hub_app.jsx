// StudioLoom Hub — main app

const TWEAKS = /*EDITMODE-BEGIN*/{
  "switcherStyle": "tabs",
  "persona": "harper"
}/*EDITMODE-END*/;

function HubApp() {
  const [switcherStyle, setSwitcherStyle] = React.useState(TWEAKS.switcherStyle);
  const [persona, setPersona] = React.useState(TWEAKS.persona);
  const [active, setActive] = React.useState("__everything__");
  const [tweaksOn, setTweaksOn] = React.useState(false);

  React.useEffect(() => {
    const handler = (e) => {
      const data = e.data || {};
      if (data.type === "__activate_edit_mode") setTweaksOn(true);
      else if (data.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const persist = (key, val) => {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*");
  };

  const isTeacher = ["amara","harper","riel"].includes(persona);
  const user = isTeacher ? window.HUB_DATA.teachers[persona] : window.HUB_DATA.students[persona];

  const switchPersona = () => {
    const order = ["harper","riel","amara","theo","maya","aarav"];
    const idx = order.indexOf(persona);
    const next = order[(idx + 1) % order.length];
    setPersona(next); persist("persona", next);
    setActive("__everything__");
  };

  const Switcher = switcherStyle === "tabs" ? ProgramTabs : ProgramSwitcher;

  const activeProgram = active !== "__everything__" ? prog(active) : null;
  const activeMembership = active !== "__everything__" ? user.programs.find(pm => pm.programId === active) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <HubTopBar user={user} onSwitchPersona={switchPersona} switcherStyle={switcherStyle}/>
      <Switcher user={user} active={active} onSelect={setActive}/>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {active === "__everything__" ? (
          isTeacher ? <EverythingTeacher user={user}/> : <EverythingStudent user={user}/>
        ) : (
          <ProgramPreview program={activeProgram} membership={activeMembership} user={user} isTeacher={isTeacher}/>
        )}
      </main>

      {tweaksOn && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-80 overflow-hidden">
          <div className="bg-[#1A1A2E] text-white px-4 py-2.5 flex items-center justify-between">
            <div className="text-[12px] font-extrabold">Tweaks</div>
            <div className="text-[10px] text-white/50">Hub</div>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Program switcher</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[{v:"tabs",l:"Tabs (A)"},{v:"dropdown",l:"Dropdown (B)"}].map(o => (
                  <button key={o.v} onClick={() => { setSwitcherStyle(o.v); persist("switcherStyle", o.v); }}
                    className={`text-[11.5px] font-bold px-2.5 py-2 rounded-lg border transition
                      ${switcherStyle===o.v?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">Persona</div>
              <div className="flex flex-col gap-1">
                <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400">Teachers</div>
                {Object.values(window.HUB_DATA.teachers).map(t => (
                  <button key={t.id} onClick={() => { setPersona(t.id); persist("persona", t.id); setActive("__everything__"); }}
                    className={`text-left text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center justify-between
                      ${persona===t.id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                    <span>{t.name}</span>
                    <span className={`text-[10px] ${persona===t.id?"text-white/60":"text-gray-400"}`}>{t.programs.length} prog</span>
                  </button>
                ))}
                <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-gray-400 mt-1.5">Students</div>
                {Object.values(window.HUB_DATA.students).map(s => (
                  <button key={s.id} onClick={() => { setPersona(s.id); persist("persona", s.id); setActive("__everything__"); }}
                    className={`text-left text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center justify-between
                      ${persona===s.id?"bg-[#1A1A2E] text-white border-[#1A1A2E]":"bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                    <span>{s.name}</span>
                    <span className={`text-[10px] ${persona===s.id?"text-white/60":"text-gray-400"}`}>{s.programs.length} prog</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10.5px] text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              Try Ms. Riel (4 programs) to see tab overflow. Try Theo (G8, new Personal Project) for the student view.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<HubApp/>);
