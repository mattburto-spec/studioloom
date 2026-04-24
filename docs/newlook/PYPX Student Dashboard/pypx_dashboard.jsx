// PYPX Dashboard — the hero view. Focused on "what do I do next?"

function TopBar({ student, view, onNav, notifCount = 2 }) {
  const items = [
    { id: "home", label: "Home", icon: <IconHome size={15}/> },
    { id: "board", label: "Project Board", icon: <IconGrid size={15}/> },
    { id: "skills", label: "Skills Library", icon: <IconSparkles size={15}/> },
    { id: "resources", label: "Resources", icon: <IconBookmark size={15}/> },
  ];
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size={26}/>
          <nav className="hidden md:flex items-center gap-1">
            {items.map(it => (
              <button key={it.id} onClick={() => onNav(it.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition
                  ${view === it.id ? "bg-purple-100 text-purple-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
                {it.icon}{it.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100">
            <IconBell size={16}/>
            {notifCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"/>}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-[11px] font-extrabold ring-2 ring-white shadow-sm">{student.initials}</div>
            <div className="hidden sm:block leading-tight">
              <div className="text-[13px] font-semibold text-gray-900 whitespace-nowrap">{student.name}</div>
              <div className="text-[10px] text-gray-500">{student.grade} · PYPX</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============ HERO: "Your next step" =============
function NextStepHero({ step, emphasis, onOpen, onDone }) {
  const big = emphasis === "huge";
  return (
    <div className="relative overflow-hidden rounded-3xl text-white shadow-lg"
         style={{ background: "linear-gradient(135deg, #7B2FF2 0%, #9333EA 45%, #C026D3 100%)" }}>
      {/* decorative dots */}
      <svg className="absolute top-0 right-0 opacity-20" width="280" height="180" viewBox="0 0 280 180">
        <circle cx="230" cy="40" r="60" fill="#fff"/>
        <circle cx="260" cy="140" r="30" fill="#fff"/>
        <circle cx="160" cy="20" r="14" fill="#fff"/>
      </svg>
      <div className={`relative ${big ? "p-7 sm:p-9" : "p-6"}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-[0.08em] bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1">
            <IconTarget size={12}/> YOUR NEXT STEP
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-white/80">FIND OUT · PHASE 2 of 5</span>
        </div>
        <h2 className={`font-extrabold tracking-tight leading-[1.1] ${big ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{step.title}</h2>
        <p className="text-sm text-white/85 mt-2 max-w-xl leading-relaxed">{step.why}</p>

        {/* mini substeps */}
        <div className="mt-5 grid gap-1.5">
          {step.steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition
              ${s.done ? "bg-white/10 text-white/70 line-through" :
                s.current ? "bg-white text-[#1A1A2E] font-semibold shadow-md" :
                "bg-white/5 text-white/75"}`}>
              {s.done
                ? <span className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center"><IconCheck size={10}/></span>
                : s.current
                  ? <span className="w-4 h-4 rounded-full border-2 border-purple-600 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-purple-600"/></span>
                  : <span className="w-4 h-4 rounded-full border-2 border-white/40"/>}
              <span className="flex-1">{s.t}</span>
              {s.current && <Badge variant="primary" size="sm">Do this</Badge>}
            </div>
          ))}
        </div>

        {/* footer bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/90">
            <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1"><IconClock size={11}/> ~{step.estMinutes} min</span>
            <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1"><IconCalendar size={11}/> Due {step.due} · {step.dueIn}</span>
            <button onClick={() => onOpen("skills", step.skill)} className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition"><IconSparkles size={11}/> Mini-course: {step.skill}</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDone} className="text-[12px] font-semibold text-white/90 hover:text-white px-3 py-2">I did this ✓</button>
            <Button variant="pypx" size="lg" iconRight={<IconArrowRight size={14}/>} onClick={() => onOpen("board")}>Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PHASE STRIP (PM: phases metaphor) ============
function PhaseStrip({ phases, currentId, density, inline = false }) {
  const current = phases.findIndex(p => p.id === currentId);
  const cozy = density !== "compact" && !inline;
  const circleSz = inline ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-sm";
  const lineTop = inline ? "top-[14px]" : "top-[18px]";
  const inner = (
    <>
      {!inline && (
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-bold text-[#1A1A2E]">Your inquiry journey</h3>
          <span className="text-[11px] text-gray-500">Phase {current + 1} of {phases.length}</span>
        </div>
      )}
      <div className="relative">
        <div className={`absolute left-0 right-0 ${lineTop} h-1 bg-gray-100 rounded-full`}/>
        <div className={`absolute left-0 ${lineTop} h-1 rounded-full transition-all`} style={{
          width: `${(current / (phases.length - 1)) * 100}%`,
          background: "linear-gradient(90deg, #FBBF24, #9333EA)"
        }}/>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${phases.length}, 1fr)` }}>
          {phases.map((p, i) => {
            const isDone = i < current;
            const isCur = i === current;
            return (
              <div key={p.id} className="flex flex-col items-center text-center">
                <div className={`${circleSz} rounded-full flex items-center justify-center font-bold ring-4 transition
                  ${isDone ? "bg-emerald-500 text-white ring-emerald-100"
                    : isCur ? "text-white ring-purple-100 shadow-lg"
                    : "bg-white border-2 border-gray-200 text-gray-400 ring-transparent"}`}
                  style={isCur ? { background: p.color } : {}}>
                  {isDone ? <IconCheck size={inline ? 11 : 14}/> : i + 1}
                </div>
                <div className={`mt-1.5 ${inline ? "text-[10px]" : "text-[12px]"} font-bold ${isCur ? "text-[#1A1A2E]" : "text-gray-600"}`}>{p.label}</div>
                {cozy && <div className="text-[10px] text-gray-500 mt-0.5 max-w-[110px] leading-tight">{p.sub}</div>}
                {cozy && <div className="text-[10px] font-semibold mt-1" style={{ color: isCur ? p.color : "#9CA3AF" }}>{p.pct}%</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
  if (inline) return inner;
  return <Card className="p-5">{inner}</Card>;
}

// ============ MILESTONE TIMELINE ============
function MilestoneStrip({ milestones, project }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-bold text-[#1A1A2E]">Next 30 days</h3>
        <span className="text-[11px] font-semibold text-rose-600">Exhibition in {project.daysLeft} days 🎉</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-4">Meetings, tasks, and the big day.</p>
      <div className="relative overflow-x-auto -mx-2 px-2 pb-1">
        <div className="flex items-start gap-2 min-w-max">
          {milestones.map((m, i) => {
            const isBig = m.type === "big";
            return (
              <React.Fragment key={i}>
                <div className={`flex flex-col items-center w-[82px] ${m.today ? "" : ""}`}>
                  <div className={`relative w-full rounded-lg px-2 py-2 text-center border transition
                    ${m.today ? "bg-[#1A1A2E] text-white border-[#1A1A2E]"
                      : isBig ? "text-white border-transparent shadow-md"
                      : "bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm"}`}
                    style={isBig ? { background: "linear-gradient(135deg,#FF3366,#FF6B6B)" } : {}}>
                    <div className={`text-[9px] font-extrabold tracking-wider uppercase ${m.today ? "text-white/70" : isBig ? "text-white/80" : "text-gray-400"}`}>{m.day}</div>
                    <div className={`text-[13px] font-extrabold ${m.today ? "text-white" : isBig ? "text-white" : "text-[#1A1A2E]"}`}>{m.date.split(" ")[1]}</div>
                    <div className={`text-[8px] font-extrabold tracking-wider uppercase ${m.today ? "text-white/60" : isBig ? "text-white/70" : "text-gray-400"}`}>{m.date.split(" ")[0]}</div>
                  </div>
                  <div className="mt-2 text-center w-full min-h-[36px]">
                    {m.pip && !m.today && <div className="w-1.5 h-1.5 rounded-full mx-auto mb-1" style={{ background: m.pip }}/>}
                    <div className={`text-[10px] leading-tight font-semibold ${isBig ? "text-rose-700" : m.today ? "text-gray-900" : "text-gray-600"}`}>{m.label}</div>
                  </div>
                </div>
                {i < milestones.length - 1 && <div className="w-4 h-px bg-gray-200 mt-4 flex-shrink-0"/>}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ============ KIT MENTOR CARD ============
function KitCard({ nudge, onOpenJourney }) {
  const [msgIdx, setMsgIdx] = React.useState(0);
  return (
    <Card className="p-4 bg-gradient-to-br from-purple-50 via-white to-rose-50 border-purple-200">
      <div className="flex items-start gap-3">
        <img src={`assets/kit/${nudge.variant}.png`} className="w-14 h-14 flex-shrink-0 drop-shadow-sm" alt="Kit"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-extrabold text-purple-700">Kit</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold uppercase tracking-wider">{nudge.variant}</span>
          </div>
          <div className="text-[13px] text-[#1A1A2E] leading-relaxed">{nudge.msg}</div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {nudge.chips.map(c => (
              <button key={c} className="text-[11px] text-purple-700 bg-white border border-purple-200 rounded-full px-2.5 py-1 hover:bg-purple-100 transition font-medium">{c}</button>
            ))}
          </div>
        </div>
      </div>
      <button onClick={onOpenJourney} className="w-full mt-3 flex items-center justify-between rounded-lg border border-dashed border-purple-300 bg-white/60 px-3 py-2 hover:bg-white transition">
        <span className="flex items-center gap-2 text-[12px] font-semibold text-purple-800"><IconCompass size={13}/> Redo your journey with Kit</span>
        <span className="text-[10px] text-purple-600">refine your question →</span>
      </button>
    </Card>
  );
}

// ============ KIT MENTOR (floating circle + quick check-in) ============
function KitMentor({ tasks, phases, studentName, onToggleTask }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState("intro"); // intro | mood | tasks | blocker | sent
  const [mood, setMood] = React.useState(null);
  const [finished, setFinished] = React.useState(new Set());
  const [blocker, setBlocker] = React.useState(null);
  const [hasNew, setHasNew] = React.useState(true);

  // Tasks worth checking in on (in-progress or up-next)
  const checkable = tasks.filter(t => t.status === "doing" || t.next).slice(0, 4);

  const reset = () => { setStep("intro"); setMood(null); setFinished(new Set()); setBlocker(null); };
  const close = () => { setOpen(false); setTimeout(reset, 300); };

  const moods = [
    { id: "great",  emoji: "💪", label: "Made progress", variant: "excited" },
    { id: "ok",     emoji: "🙂", label: "Okay day",       variant: "gentle" },
    { id: "stuck",  emoji: "🤔", label: "Got stuck",     variant: "thinking" },
    { id: "none",   emoji: "😴", label: "Didn't get to it", variant: "gentle" },
  ];
  const blockers = ["Question was too big", "Couldn't find what I needed", "Ran out of time", "Didn't understand"];
  const kitVariant = mood ? (moods.find(m => m.id === mood)?.variant || "encouraging") : "encouraging";

  return (
    <>
      {/* Floating avatar */}
      <div className="fixed top-[72px] right-4 sm:right-6 z-40">
        <button
          onClick={() => { setOpen(o => !o); setHasNew(false); }}
          className="relative group"
          aria-label="Check in with Kit"
        >
          <span className={`absolute inset-0 rounded-full ${hasNew ? "animate-ping bg-purple-300 opacity-40" : ""}`}/>
          <span className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border-2 border-white"
            style={{ background: "linear-gradient(135deg,#FBBF24 0%,#FF6B6B 50%,#9333EA 100%)" }}>
            <img src={`assets/kit/${kitVariant}.png`} className="w-10 h-10 drop-shadow-sm" alt="Kit"/>
          </span>
          {hasNew && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center border border-white">1</span>
          )}
          <span className="absolute top-full mt-1.5 right-0 text-[10px] font-bold text-gray-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition">Check in with Kit</span>
        </button>
      </div>

      {/* Popover */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none" style={{ paddingTop: "80px", paddingRight: "24px" }} onClick={close}>
          <div
            onClick={e => e.stopPropagation()}
            className="pointer-events-auto w-[340px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-[slide-up_.18s_ease]"
          >
            {/* Header */}
            <div className="relative p-4 text-white" style={{ background: "linear-gradient(135deg,#FBBF24 0%,#FF6B6B 55%,#9333EA 100%)" }}>
              <button onClick={close} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center"><IconX size={11}/></button>
              <div className="flex items-center gap-3">
                <img src={`assets/kit/${kitVariant}.png`} className="w-12 h-12 drop-shadow" alt="Kit"/>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">Kit · Your mentor</div>
                  <div className="text-[14px] font-extrabold leading-tight mt-0.5">
                    {step === "sent"
                      ? "Thanks for checking in!"
                      : `End-of-session check-in`}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            {step !== "sent" && (
              <div className="flex items-center justify-center gap-1.5 py-2 border-b border-gray-100">
                {["intro","mood","tasks","blocker"].map((s, i) => (
                  <span key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${
                    step === s ? "w-4 bg-purple-600" :
                    ["intro","mood","tasks","blocker"].indexOf(step) > i ? "bg-purple-400" : "bg-gray-200"
                  }`}/>
                ))}
              </div>
            )}

            <div className="p-4">
              {step === "intro" && (
                <>
                  <div className="text-[13px] text-[#1A1A2E] leading-relaxed">
                    Hi {studentName?.split(" ")[0] || "there"} 👋 — quick check-in before you finish. Takes 30 seconds.
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1.5">Ms. Okafor will see your update on Friday.</div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => setStep("mood")} className="flex-1">Let's go →</Button>
                    <Button variant="ghost" size="sm" onClick={close}>Later</Button>
                  </div>
                </>
              )}

              {step === "mood" && (
                <>
                  <div className="text-[13px] font-bold text-[#1A1A2E] mb-2.5">How did this session feel?</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {moods.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMood(m.id); setStep(checkable.length ? "tasks" : (m.id === "stuck" ? "blocker" : "sent")); }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition
                          ${mood === m.id ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/50"}`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-[11px] font-bold text-[#1A1A2E] text-center leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setStep("intro")} className="text-[11px] text-gray-400 hover:text-gray-700 mt-3">← Back</button>
                </>
              )}

              {step === "tasks" && (
                <>
                  <div className="text-[13px] font-bold text-[#1A1A2E] mb-1">What did you finish?</div>
                  <div className="text-[11px] text-gray-500 mb-2.5">Tap all that apply</div>
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {checkable.map(t => {
                      const phase = phases.find(p => p.id === t.phase);
                      const on = finished.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => setFinished(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition
                            ${on ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-purple-300"}`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2
                            ${on ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                            {on && <IconCheck size={11}/>}
                          </div>
                          <span className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: phase?.color }}/>
                          <span className="text-[12px] font-semibold text-[#1A1A2E] flex-1">{t.title}</span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setFinished(s => s.has("__none__") ? new Set([...s].filter(x => x !== "__none__")) : new Set([...s, "__none__"]))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition
                        ${finished.has("__none__") ? "border-gray-400 bg-gray-50" : "border-gray-200 border-dashed hover:border-gray-400"}`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2
                        ${finished.has("__none__") ? "bg-gray-500 border-gray-500" : "border-gray-300"}`}>
                        {finished.has("__none__") && <IconCheck size={11}/>}
                      </div>
                      <span className="text-[12px] font-semibold text-gray-600">None yet — tomorrow</span>
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setStep("mood")} className="text-[11px] text-gray-400 hover:text-gray-700">← Back</button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        // Toggle tasks marked finished
                        [...finished].filter(id => id !== "__none__").forEach(id => {
                          const t = tasks.find(x => x.id === id);
                          if (t && t.status !== "done") onToggleTask(id);
                        });
                        setStep(mood === "stuck" ? "blocker" : "sent");
                      }}
                    >{mood === "stuck" ? "Next →" : "Send to Ms. Okafor →"}</Button>
                  </div>
                </>
              )}

              {step === "blocker" && (
                <>
                  <div className="text-[13px] font-bold text-[#1A1A2E] mb-1">What got in the way?</div>
                  <div className="text-[11px] text-gray-500 mb-2.5">Kit will flag this to your mentor</div>
                  <div className="flex flex-col gap-1.5">
                    {blockers.map(b => (
                      <button
                        key={b}
                        onClick={() => setBlocker(b)}
                        className={`p-2.5 rounded-xl border-2 text-[12px] font-semibold text-left transition
                          ${blocker === b ? "border-rose-400 bg-rose-50 text-rose-800" : "border-gray-200 hover:border-rose-300 text-[#1A1A2E]"}`}
                      >{b}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setStep(checkable.length ? "tasks" : "mood")} className="text-[11px] text-gray-400 hover:text-gray-700">← Back</button>
                    <Button variant="primary" size="sm" className="flex-1" onClick={() => setStep("sent")}>Send →</Button>
                  </div>
                </>
              )}

              {step === "sent" && (
                <>
                  <div className="flex flex-col items-center text-center py-1">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                      <IconCheck size={22}/>
                    </div>
                    <div className="text-[14px] font-extrabold text-[#1A1A2E]">Check-in sent 🎉</div>
                    <div className="text-[12px] text-gray-600 mt-1 leading-snug">
                      {mood === "stuck"
                        ? "Ms. Okafor will message you before your Friday check-in."
                        : mood === "great"
                        ? "Nice work. See you next session!"
                        : "Thanks for the update. Rest up."}
                    </div>
                    <div className="w-full flex gap-2 mt-4">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={close}>Done</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============ SKILLS LIBRARY CARD (on dashboard) ============
function SkillsLibraryPreview({ courses, onOpen, onSignUp }) {
  const recommended = courses.filter(c => c.recommended).slice(0, 3);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-1.5"><IconSparkles size={14}/> Mini-skills for you</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Picked based on what you're doing next.</p>
        </div>
        <button onClick={() => onOpen("skills")} className="text-[11px] font-semibold text-purple-700 hover:text-purple-900">All {courses.length} →</button>
      </div>
      <div className="flex flex-col gap-2">
        {recommended.map(c => (
          <div key={c.id} className="group flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${c.color}18` }}>
              <img src={`assets/tools/${c.icon}.png`} className="w-7 h-7 object-contain"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#1A1A2E] leading-tight truncate">{c.title}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{c.lessons} lessons · {c.min} min</div>
            </div>
            {c.enrolled ? (
              <div className="flex flex-col items-end gap-0.5">
                <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Enrolled</div>
                <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${c.progress}%` }}/>
                </div>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onSignUp(c.id); }} className="text-[11px] font-bold text-purple-700 hover:text-white hover:bg-purple-700 border border-purple-300 rounded-full px-2.5 py-1 transition">Sign up</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============ RESOURCES PREVIEW ============
function ResourcesPreview({ resources, onOpen }) {
  const top = [
    ...resources.people.filter(p => p.relevant).slice(0, 2).map(r => ({ type: "People", icon: <IconUsers size={13}/>, title: r.name, meta: r.role, pip: "#9333EA" })),
    ...resources.readings.filter(r => r.relevant).slice(0, 1).map(r => ({ type: "Read", icon: <IconBook size={13}/>, title: r.title, meta: `${r.src} · ${r.mins} min`, pip: "#3B82F6" })),
    ...resources.templates.filter(r => r.relevant).slice(0, 1).map(r => ({ type: "Template", icon: <IconFile size={13}/>, title: r.title, meta: r.type, pip: "#F59E0B" })),
  ];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-1.5"><IconBookmark size={14}/> Resources for this step</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">People & things curated by your teachers.</p>
        </div>
        <button onClick={() => onOpen("resources")} className="text-[11px] font-semibold text-purple-700 hover:text-purple-900">Browse all →</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {top.map((t, i) => (
          <a key={i} href="#" className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${t.pip}15`, color: t.pip }}>{t.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[#1A1A2E] truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500 truncate">{t.meta}</div>
            </div>
            <Badge variant="outline" size="sm">{t.type}</Badge>
          </a>
        ))}
      </div>
    </Card>
  );
}

// ============ PROJECT AT-A-GLANCE ============
function ProjectHeader({ project, phases }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <div className="h-2" style={{ background: "linear-gradient(90deg,#FBBF24,#FF3366,#9333EA)"}}/>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="pypx" size="lg">PYPX · Grade 5</Badge>
              <Badge variant="outline" size="md">Sharing the Planet</Badge>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#1A1A2E] tracking-tight leading-[1.1]">{project.title}</h1>
            <p className="text-[13px] text-gray-600 mt-2 max-w-2xl">
              <span className="font-semibold">Central idea:</span> {project.centralIdea}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">Overall</div>
              <div className="text-2xl font-extrabold text-[#1A1A2E]">{project.overallPct}%</div>
            </div>
            <ProgressCircle pct={project.overallPct} size={56} color="#9333EA" track="#F3F4F6" showLabel={false}/>
          </div>
        </div>
        {phases && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <PhaseStrip phases={phases} currentId={project.currentPhase} inline={true}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ QUICK ACTIONS ROW ============
function QuickActions({ onNav }) {
  const acts = [
    { id: "capture", label: "Capture a photo", icon: "camera", color: "#9333EA" },
    { id: "journal", label: "Write a journal", icon: "pencil", color: "#3B82F6" },
    { id: "help", label: "Ask Kit", icon: "lightning", color: "#FBBF24" },
    { id: "mentor", label: "Message mentor", icon: "microphone", color: "#FF3366" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {acts.map(a => (
        <button key={a.id} className="flex items-center gap-2.5 p-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition text-left">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18` }}>
            <img src={`assets/tools/${a.icon}.png`} className="w-6 h-6 object-contain"/>
          </div>
          <div className="text-[12px] font-bold text-[#1A1A2E]">{a.label}</div>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, {
  TopBar, NextStepHero, PhaseStrip, MilestoneStrip, KitCard, KitMentor,
  SkillsLibraryPreview, ResourcesPreview, ProjectHeader, QuickActions,
});
