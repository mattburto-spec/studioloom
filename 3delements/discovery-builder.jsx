import { useState, useRef } from "react";

// ── PRESETS ──────────────────────────────────────────────────

const SETTINGS = [
  { id: "bakery", name: "Bakery", icon: "🧁", color: "#e8a87c", desc: "Warm village bakery with counter, ovens, and morning rush customers", bg: "linear-gradient(135deg, #2a1a0a, #3a2515)" },
  { id: "school", name: "School", icon: "📚", color: "#7eb8da", desc: "Classroom, library, or playground — familiar student territory", bg: "linear-gradient(135deg, #0a1a2a, #152535)" },
  { id: "workshop", name: "Workshop", icon: "🔨", color: "#d4a843", desc: "Maker space with tools, workbenches, and raw materials", bg: "linear-gradient(135deg, #1a1508, #2a2010)" },
  { id: "garden", name: "Garden", icon: "🌱", color: "#7ecf8a", desc: "Community garden, greenhouse, or outdoor growing space", bg: "linear-gradient(135deg, #0a1a0a, #152a15)" },
  { id: "clinic", name: "Health Center", icon: "🏥", color: "#e06070", desc: "Local clinic or wellness center with patients and staff", bg: "linear-gradient(135deg, #1a0a0a, #2a1515)" },
  { id: "market", name: "Market", icon: "🏪", color: "#f0c27a", desc: "Bustling marketplace, food stall, or small business", bg: "linear-gradient(135deg, #1a1508, #2a2510)" },
  { id: "studio", name: "Art Studio", icon: "🎨", color: "#b07cc6", desc: "Creative space with canvases, supplies, and works in progress", bg: "linear-gradient(135deg, #1a0a1a, #251525)" },
  { id: "home", name: "Home", icon: "🏠", color: "#a0b0c0", desc: "Living room, kitchen, or backyard — domestic design challenges", bg: "linear-gradient(135deg, #10141a, #1a2030)" },
];

const CHARACTER_PRESETS = [
  { id: "baker", name: "Baker", emoji: "👩‍🍳", traits: ["Warm", "Practical", "Proud of craft"] },
  { id: "teacher", name: "Teacher", emoji: "👨‍🏫", traits: ["Patient", "Frustrated", "Cares about students"] },
  { id: "elder", name: "Elder", emoji: "👵", traits: ["Wise", "Gentle", "Independent"] },
  { id: "kid", name: "Child", emoji: "🧒", traits: ["Curious", "Honest", "Energetic"] },
  { id: "shopkeeper", name: "Shopkeeper", emoji: "🧑‍💼", traits: ["Busy", "Resourceful", "Community-minded"] },
  { id: "artist", name: "Artist", emoji: "👩‍🎨", traits: ["Creative", "Passionate", "Struggling"] },
  { id: "nurse", name: "Nurse", emoji: "👩‍⚕️", traits: ["Caring", "Overworked", "Observant"] },
  { id: "farmer", name: "Farmer", emoji: "👩‍🌾", traits: ["Hardworking", "Connected to land", "Practical"] },
  { id: "custom", name: "Custom", emoji: "✨", traits: [] },
];

const MOODS = ["warm", "worried", "hopeful", "determined", "sad", "excited", "frustrated", "thoughtful", "proud", "surprised", "playful", "serious"];

const PHASE_META = {
  Inquire: { icon: "🔍", color: "#6c8ebf", hint: "Research, interviews, observations, analysis of existing solutions" },
  Develop: { icon: "✏️", color: "#d4a843", hint: "Sketching, brainstorming, decision matrices, concept selection" },
  Create: { icon: "🔨", color: "#82b366", hint: "Prototyping, building, testing, iterating based on feedback" },
  Evaluate: { icon: "📊", color: "#b85450", hint: "User testing, measurements, comparison, final presentation" },
};

const AI_SUGGESTIONS = {
  bakery: { problem: "Customers burn their hands on takeaway cups — no insulation sleeve", character: "Rosa the Baker" },
  school: { problem: "Students can't navigate the library — confusing labeling system", character: "Mr. Okafor" },
  workshop: { problem: "Shared tools go missing — no tracking or organization system", character: "Uncle Dev" },
  garden: { problem: "Elderly gardener can't bend down — needs accessible raised beds", character: "Auntie Mei" },
  clinic: { problem: "Patients forget medication schedules — no simple reminder system", character: "Nurse Amara" },
  market: { problem: "Food stall waste is unsustainable — needs better packaging", character: "Mr. Huang" },
  studio: { problem: "Art supplies are disorganized — students waste time searching", character: "Ms. Delacroix" },
  home: { problem: "Kitchen is inaccessible for wheelchair-bound family member", character: "The Reyes Family" },
};

// ── MAIN COMPONENT ───────────────────────────────────────────

export default function DiscoveryBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [setting, setSetting] = useState(null);
  const [character, setCharacter] = useState({ preset: null, name: "", emoji: "👤", color: "#e8a87c", traits: [] });
  const [dialogueLines, setDialogueLines] = useState([
    { speaker: "", text: "", mood: "warm" },
    { speaker: "", text: "", mood: "worried" },
    { speaker: "", text: "", mood: "hopeful" },
  ]);
  const [quest, setQuest] = useState({ title: "", brief: "", phases: { Inquire: ["", ""], Develop: ["", ""], Create: ["", ""], Evaluate: ["", ""] } });
  const [showPreview, setShowPreview] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const STEPS = ["Setting", "Character", "Narrative", "Quest", "Review"];

  const canAdvance = () => {
    switch (currentStep) {
      case 0: return setting !== null;
      case 1: return character.name.trim().length > 0;
      case 2: return dialogueLines.filter(l => l.text.trim()).length >= 2;
      case 3: return quest.title.trim() && quest.brief.trim();
      default: return true;
    }
  };

  const applyPreset = (preset) => {
    setCharacter(prev => ({
      ...prev,
      preset: preset.id,
      emoji: preset.emoji,
      name: preset.id === "custom" ? prev.name : "",
      traits: [...preset.traits],
    }));
  };

  const updateDialogue = (idx, field, value) => {
    setDialogueLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addDialogueLine = () => {
    setDialogueLines(prev => [...prev, { speaker: character.name, text: "", mood: "warm" }]);
  };

  const removeDialogueLine = (idx) => {
    if (dialogueLines.length <= 2) return;
    setDialogueLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTask = (phase, idx, value) => {
    setQuest(prev => ({
      ...prev,
      phases: { ...prev.phases, [phase]: prev.phases[phase].map((t, i) => i === idx ? value : t) },
    }));
  };

  const addTask = (phase) => {
    setQuest(prev => ({
      ...prev,
      phases: { ...prev.phases, [phase]: [...prev.phases[phase], ""] },
    }));
  };

  const removeTask = (phase, idx) => {
    if (quest.phases[phase].length <= 1) return;
    setQuest(prev => ({
      ...prev,
      phases: { ...prev.phases, [phase]: prev.phases[phase].filter((_, i) => i !== idx) },
    }));
  };

  const generateFromAI = () => {
    if (!setting) return;
    setGenerating(true);
    // Simulated AI generation — in production this calls Claude API
    setTimeout(() => {
      const suggestion = AI_SUGGESTIONS[setting.id] || AI_SUGGESTIONS.bakery;
      const charName = suggestion.character;

      setCharacter(prev => ({ ...prev, name: charName, emoji: CHARACTER_PRESETS.find(p => p.name.toLowerCase().includes(charName.split(" ")[0].toLowerCase()))?.emoji || "👤" }));

      setDialogueLines([
        { speaker: charName, text: `Welcome! I'm ${charName}. So glad someone stopped by.`, mood: "warm" },
        { speaker: charName, text: `I've been dealing with something for a while now. ${suggestion.problem}.`, mood: "worried" },
        { speaker: charName, text: "I've tried a few things but nothing's really worked. It affects people every single day.", mood: "frustrated" },
        { speaker: charName, text: "I need a real designer — someone who'll actually talk to the people involved and figure this out properly.", mood: "hopeful" },
        { speaker: charName, text: "Could that be you? I think it could be you.", mood: "hopeful" },
      ]);

      setQuest({
        title: suggestion.problem.split("—")[0].trim(),
        brief: suggestion.problem,
        phases: {
          Inquire: ["Interview 5 people affected by the problem", "Research 3 existing solutions", "Write a design specification"],
          Develop: ["Sketch at least 3 different concepts", "Create a decision matrix", "Select and justify your best concept"],
          Create: ["Build a working prototype", "Test with the client", "Iterate based on feedback"],
          Evaluate: ["Test with 5 real users", "Measure effectiveness vs. original problem", "Present findings and recommendations"],
        },
      });

      setGenerating(false);
    }, 1500);
  };

  // ── STYLES ─────────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: "#0c0c14", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8e0d4" },
    header: { padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" },
    body: { padding: "16px", maxWidth: 520, margin: "0 auto" },
    label: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#665544", marginBottom: 6, display: "block", fontWeight: 600 },
    input: { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#e8e0d4", fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#e8e0d4", fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit" },
    btn: { padding: "12px 24px", background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5 },
    btnGhost: { padding: "10px 16px", background: "transparent", color: "#887766", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 12, cursor: "pointer" },
    card: { background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", padding: 14, marginBottom: 10 },
  };

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#e94560", textTransform: "uppercase", fontWeight: 700 }}>Loominary</div>
          <div style={{ fontSize: 15, fontWeight: 300, letterSpacing: 1, marginTop: 2 }}>Discovery Builder</div>
        </div>
        <button onClick={generateFromAI} disabled={!setting || generating} style={{ ...S.btnGhost, borderColor: setting ? "rgba(233,69,96,0.2)" : "rgba(255,255,255,0.04)", color: setting ? "#e94560" : "#444", fontSize: 11 }}>
          {generating ? "⏳ Generating…" : "✨ AI Generate"}
        </button>
      </div>

      {/* Step Progress */}
      <div style={{ padding: "12px 16px 0", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {STEPS.map((s, i) => (
            <div key={s} onClick={() => { if (i <= currentStep || canAdvance()) setCurrentStep(i); }} style={{ flex: 1, cursor: "pointer" }}>
              <div style={{ height: 3, borderRadius: 2, background: i < currentStep ? "#e94560" : i === currentStep ? "#e9456066" : "rgba(255,255,255,0.06)", transition: "background 0.3s" }} />
              <div style={{ fontSize: 9, color: i <= currentStep ? "#e94560" : "#444", marginTop: 4, textAlign: "center", fontWeight: i === currentStep ? 700 : 400, letterSpacing: 1 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.body}>

        {/* ═══ STEP 0: SETTING ═══ */}
        {currentStep === 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Choose a Setting</h2>
            <p style={{ fontSize: 12, color: "#776655", margin: "0 0 16px" }}>Where does the student discover the design problem?</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SETTINGS.map(s => (
                <button key={s.id} onClick={() => setSetting(s)}
                  style={{ padding: 14, background: setting?.id === s.id ? s.bg : "rgba(255,255,255,0.02)", border: setting?.id === s.id ? `1px solid ${s.color}44` : "1px solid rgba(255,255,255,0.04)", borderRadius: 12, cursor: "pointer", textAlign: "left", color: "#e8e0d4", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: setting?.id === s.id ? s.color : "#ccc", marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "#776655", lineHeight: 1.4 }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 1: CHARACTER ═══ */}
        {currentStep === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Create the Character</h2>
            <p style={{ fontSize: 12, color: "#776655", margin: "0 0 16px" }}>Who has the problem? Students will meet this person in the world.</p>

            <label style={S.label}>Character Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {CHARACTER_PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  style={{ padding: "8px 12px", background: character.preset === p.id ? "rgba(233,69,96,0.1)" : "rgba(255,255,255,0.02)", border: character.preset === p.id ? "1px solid #e9456044" : "1px solid rgba(255,255,255,0.04)", borderRadius: 8, cursor: "pointer", color: character.preset === p.id ? "#e94560" : "#aaa", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{p.emoji}</span> {p.name}
                </button>
              ))}
            </div>

            <label style={S.label}>Character Name</label>
            <input value={character.name} onChange={e => setCharacter(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Rosa the Baker" style={{ ...S.input, marginBottom: 14 }} />

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Emoji</label>
                <input value={character.emoji} onChange={e => setCharacter(prev => ({ ...prev, emoji: e.target.value }))} style={{ ...S.input, fontSize: 24, textAlign: "center", padding: "6px" }} maxLength={2} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Color</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {["#e8a87c", "#7eb8da", "#a8d5a2", "#f0c27a", "#b07cc6", "#e06070", "#c4b5e0", "#d4a843"].map(c => (
                    <button key={c} onClick={() => setCharacter(prev => ({ ...prev, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: character.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </div>
            </div>

            <label style={S.label}>Personality Traits</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {character.traits.map((t, i) => (
                <span key={i} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(233,69,96,0.1)", color: "#e94560", display: "flex", alignItems: "center", gap: 4 }}>
                  {t}
                  <span onClick={() => setCharacter(prev => ({ ...prev, traits: prev.traits.filter((_, j) => j !== i) }))} style={{ cursor: "pointer", opacity: 0.5, fontSize: 13 }}>×</span>
                </span>
              ))}
              <input placeholder="+ Add trait" style={{ ...S.input, width: 100, fontSize: 11, padding: "4px 8px" }}
                onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { setCharacter(prev => ({ ...prev, traits: [...prev.traits, e.target.value.trim()] })); e.target.value = ""; } }} />
            </div>

            {/* Preview */}
            <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: character.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{character.emoji}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: character.color }}>{character.name || "Unnamed"}</div>
                <div style={{ fontSize: 10, color: "#776655" }}>{character.traits.join(" • ") || "No traits yet"}</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: NARRATIVE ═══ */}
        {currentStep === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Write the Narrative</h2>
            <p style={{ fontSize: 12, color: "#776655", margin: "0 0 6px" }}>The dialogue students experience when they meet {character.name || "the character"}. Build empathy for the problem.</p>
            <p style={{ fontSize: 10, color: "#554433", margin: "0 0 16px", fontStyle: "italic" }}>Tip: Start warm → introduce the problem → show who it affects → make the ask</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dialogueLines.map((line, i) => (
                <div key={i} style={{ ...S.card, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#554433", letterSpacing: 1 }}>LINE {i + 1}</span>
                      <select value={line.mood} onChange={e => updateDialogue(i, "mood", e.target.value)}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, color: "#aaa", fontSize: 10, padding: "2px 4px" }}>
                        {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    {dialogueLines.length > 2 && (
                      <button onClick={() => removeDialogueLine(i)} style={{ background: "none", border: "none", color: "#554433", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>×</button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <input value={line.speaker} onChange={e => updateDialogue(i, "speaker", e.target.value)} placeholder="Speaker" style={{ ...S.input, width: 100, fontSize: 11, padding: "6px 8px", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 10, color: "#443322", display: "flex", alignItems: "center" }}>({line.mood})</div>
                  </div>

                  <textarea value={line.text} onChange={e => updateDialogue(i, "text", e.target.value)} placeholder={
                    i === 0 ? "Welcome the student warmly…" :
                    i === 1 ? "Introduce the problem…" :
                    i === dialogueLines.length - 1 ? "Make the ask — will you help?" :
                    "Continue the story…"
                  } style={{ ...S.textarea, minHeight: 50 }} />

                  {/* Live preview */}
                  {line.text && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, borderLeft: `2px solid ${character.color}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: character.color, marginBottom: 2 }}>{line.speaker || character.name}</div>
                      <div style={{ fontSize: 12, color: "#ccc", fontStyle: "italic", lineHeight: 1.5 }}>"{line.text}"</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addDialogueLine} style={{ ...S.btnGhost, width: "100%", marginTop: 8, fontSize: 11 }}>+ Add Dialogue Line</button>
          </div>
        )}

        {/* ═══ STEP 3: QUEST ═══ */}
        {currentStep === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Define the Quest</h2>
            <p style={{ fontSize: 12, color: "#776655", margin: "0 0 16px" }}>The design challenge and tasks mapped to each Design Cycle phase.</p>

            <label style={S.label}>Quest Title</label>
            <input value={quest.title} onChange={e => setQuest(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. The Hot Cup Problem" style={{ ...S.input, marginBottom: 12 }} />

            <label style={S.label}>Design Brief</label>
            <textarea value={quest.brief} onChange={e => setQuest(prev => ({ ...prev, brief: e.target.value }))} placeholder="One or two sentences describing the core design challenge…" style={{ ...S.textarea, marginBottom: 16 }} />

            {/* Phases */}
            {Object.entries(PHASE_META).map(([phase, meta]) => (
              <div key={phase} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{phase}</span>
                  <div style={{ flex: 1, height: 1, background: meta.color + "22" }} />
                </div>
                <p style={{ fontSize: 10, color: "#554433", margin: "0 0 8px", fontStyle: "italic" }}>{meta.hint}</p>

                {quest.phases[phase].map((task, ti) => (
                  <div key={ti} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${meta.color}33`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 8, color: meta.color }}>{ti + 1}</span>
                    </div>
                    <input value={task} onChange={e => updateTask(phase, ti, e.target.value)} placeholder={`Task ${ti + 1}…`}
                      style={{ ...S.input, fontSize: 12, padding: "7px 10px", flex: 1 }} />
                    {quest.phases[phase].length > 1 && (
                      <button onClick={() => removeTask(phase, ti)} style={{ background: "none", border: "none", color: "#443322", fontSize: 14, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addTask(phase)} style={{ background: "none", border: "none", color: meta.color, fontSize: 10, cursor: "pointer", padding: "2px 0", opacity: 0.7 }}>+ Add task</button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ STEP 4: REVIEW ═══ */}
        {currentStep === 4 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 300, margin: "0 0 4px", letterSpacing: 1 }}>Review Your Discovery</h2>
            <p style={{ fontSize: 12, color: "#776655", margin: "0 0 16px" }}>Preview what students will experience when they enter the world.</p>

            {/* Summary Card */}
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
              {/* Setting banner */}
              <div style={{ padding: "14px 16px", background: setting?.bg || "#1a1a2e", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{setting?.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: setting?.color }}>{setting?.name}</div>
                  <div style={{ fontSize: 10, color: "#776655" }}>{setting?.desc}</div>
                </div>
              </div>

              {/* Character */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: character.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{character.emoji}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: character.color }}>{character.name}</div>
                  <div style={{ fontSize: 10, color: "#776655" }}>{character.traits.join(" • ")}</div>
                </div>
              </div>

              {/* Dialogue preview */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#554433", textTransform: "uppercase", marginBottom: 8 }}>Narrative — {dialogueLines.filter(l => l.text.trim()).length} lines</div>
                {dialogueLines.filter(l => l.text.trim()).map((line, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: i < dialogueLines.filter(l => l.text.trim()).length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: character.color }}>{line.speaker}</span>
                      <span style={{ fontSize: 9, color: "#554433", fontStyle: "italic" }}>({line.mood})</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#bbb", margin: 0, lineHeight: 1.5 }}>"{line.text}"</p>
                  </div>
                ))}
              </div>

              {/* Quest */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#f0c41b", textTransform: "uppercase", marginBottom: 4 }}>Quest</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f0e6d3", marginBottom: 3 }}>{quest.title || "Untitled"}</div>
                <p style={{ fontSize: 12, color: "#998877", margin: "0 0 12px", lineHeight: 1.5 }}>{quest.brief}</p>

                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(PHASE_META).map(([phase, meta]) => {
                    const taskCount = quest.phases[phase].filter(t => t.trim()).length;
                    return (
                      <span key={phase} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: meta.color + "18", color: meta.color, fontWeight: 700 }}>
                        {meta.icon} {phase} ({taskCount})
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cutscene Preview */}
            <div style={{ ...S.card, textAlign: "center", padding: 20, background: "rgba(233,69,96,0.04)", border: "1px solid rgba(233,69,96,0.1)" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🎬</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e94560", marginBottom: 4 }}>Cutscene Preview</div>
              <p style={{ fontSize: 11, color: "#776655", margin: "0 0 12px" }}>See what students will experience in the 3D world</p>
              <button onClick={() => setShowPreview(true)} style={S.btn}>▶ Preview Discovery</button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={{ ...S.btn, flex: 1, background: "linear-gradient(135deg, #e94560, #c73e54)" }}>
                Publish Discovery
              </button>
              <button style={{ ...S.btnGhost, whiteSpace: "nowrap" }}>Save Draft</button>
            </div>

            {/* Export data */}
            <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#443322", textTransform: "uppercase", marginBottom: 6 }}>Data Structure</div>
              <pre style={{ fontSize: 9, color: "#665544", margin: 0, overflowX: "auto", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
{JSON.stringify({
  setting: setting?.id,
  character: { name: character.name, emoji: character.emoji, color: character.color, traits: character.traits },
  dialogue: dialogueLines.filter(l => l.text.trim()),
  quest: { title: quest.title, brief: quest.brief, phases: Object.fromEntries(Object.entries(quest.phases).map(([k, v]) => [k, v.filter(t => t.trim())])) },
}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* ═══ CUTSCENE PREVIEW MODAL ═══ */}
        {showPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", flexDirection: "column" }}>
            {/* Cinematic bars */}
            <div style={{ height: 36, background: "#000", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              {/* Simulated scene */}
              <div style={{ width: "100%", height: "100%", background: setting?.bg || "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {/* Character */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 80, height: 80, borderRadius: "50%", background: character.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: `0 0 40px ${character.color}33` }}>{character.emoji}</div>
                  <div style={{ fontSize: 12, color: character.color, fontWeight: 600, marginTop: 8 }}>{character.name}</div>
                </div>

                {/* Setting label */}
                <div style={{ position: "absolute", top: 12, left: 12, fontSize: 10, color: "#554433" }}>
                  {setting?.icon} {setting?.name} — Preview Mode
                </div>

                {/* Dialogue simulation */}
                <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, maxWidth: 420, margin: "0 auto" }}>
                  <PreviewDialogue lines={dialogueLines.filter(l => l.text.trim())} character={character} onComplete={() => setShowPreview(false)} />
                </div>
              </div>
            </div>
            <div style={{ height: 36, background: "#000", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", color: "#554433", fontSize: 10, cursor: "pointer", letterSpacing: 1 }}>CLOSE PREVIEW</button>
            </div>
          </div>
        )}

        {/* ═══ NAVIGATION ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingBottom: 20 }}>
          {currentStep > 0 ? (
            <button onClick={() => setCurrentStep(prev => prev - 1)} style={S.btnGhost}>← Back</button>
          ) : <div />}
          {currentStep < STEPS.length - 1 && (
            <button onClick={() => { if (canAdvance()) setCurrentStep(prev => prev + 1); }} disabled={!canAdvance()}
              style={{ ...S.btn, opacity: canAdvance() ? 1 : 0.4, cursor: canAdvance() ? "pointer" : "not-allowed" }}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PREVIEW DIALOGUE COMPONENT ───────────────────────────────
function PreviewDialogue({ lines, character, onComplete }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const timerRef = useRef(null);

  const currentLine = lines[lineIdx];

  // Typewriter effect
  useEffect(() => {
    if (!currentLine) return;
    if (charIdx < currentLine.text.length) {
      timerRef.current = setTimeout(() => setCharIdx(prev => prev + 1), 28);
      return () => clearTimeout(timerRef.current);
    }
  }, [charIdx, currentLine]);

  const advance = () => {
    if (!currentLine) return;
    if (charIdx < currentLine.text.length) {
      clearTimeout(timerRef.current);
      setCharIdx(currentLine.text.length);
    } else if (lineIdx < lines.length - 1) {
      setLineIdx(prev => prev + 1);
      setCharIdx(0);
    } else {
      onComplete();
    }
  };

  if (!currentLine) return null;

  return (
    <div onClick={advance} style={{ background: "rgba(10,8,4,0.92)", backdropFilter: "blur(14px)", borderRadius: 14, padding: "14px 18px", border: `1px solid ${character.color}22`, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: character.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{character.emoji}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: character.color }}>{currentLine.speaker || character.name}</div>
          <div style={{ fontSize: 9, color: "#554433", fontStyle: "italic" }}>{currentLine.mood}</div>
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#f0e6d3", lineHeight: 1.8, margin: "0 0 6px", minHeight: 42, fontFamily: "'Georgia', serif" }}>
        "{currentLine.text.slice(0, charIdx)}{charIdx < currentLine.text.length ? "▋" : ""}"
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 3 }}>
          {lines.map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === lineIdx ? character.color : i < lineIdx ? character.color + "66" : "rgba(255,255,255,0.1)" }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: "#443322" }}>
          {charIdx < currentLine.text.length ? "tap to skip" : lineIdx < lines.length - 1 ? "tap to continue ▶" : "tap to finish"}
        </span>
      </div>
    </div>
  );
}
