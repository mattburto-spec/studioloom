/* Artboard 2 — Split surfaces
 * Two separate create flows:
 *   - "Quick check" inline row
 *   - "Project task" full multi-step config
 * Plus the entry chooser.
 */

function SplitSurfaces() {
  return (
    <div style={{ width: 1080, fontFamily: "var(--sans)" }}>
      {/* ─── Entry point: chooser ─── */}
      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div className="row gap-3" style={{ alignItems: "baseline", marginBottom: 14 }}>
          <span className="eyebrow eyebrow-strong">NEW TASK</span>
          <span className="serif-it" style={{ fontSize: 16, color: "var(--ink-3)" }}>
            pick a starting point
          </span>
          <span style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.04em" }}>
            UNIT · SUSTAINABLE PACKAGING
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ChooserCard
            kind="formative"
            title="Quick check"
            sub="exit ticket, comprehension probe, draft milestone"
            time="≈ 30 seconds"
            fields="4 fields, inline"
            cta="Add a quick check"
            example={
              <div className="col gap-1" style={{ fontSize: 11.5 }}>
                {["Quiz 1 — Newton's 2nd Law", "Vocab probe — entropy", "Sketch milestone (draft)"].map((e) => (
                  <div key={e} className="row gap-2" style={{ color: "var(--ink-3)" }}>
                    <Dot color="var(--cat-assessment)" size={6} />
                    <span className="serif-it" style={{ fontSize: 12.5 }}>{e}</span>
                  </div>
                ))}
              </div>
            }
          />
          <ChooserCard
            kind="summative"
            title="Project task"
            sub="GRASPS-framed, rubric, self-assessment, AI policy"
            time="≈ 8–15 minutes"
            fields="multi-step · 5 tabs"
            cta="Configure a project"
            recommended
            example={
              <div className="col gap-1" style={{ fontSize: 11.5 }}>
                {[["Roller Coaster Design Brief", "ABCD"], ["Compostable wrap prototype", "ABCD"], ["Service learning final", "ACD"]].map(([e, c]) => (
                  <div key={e} className="row gap-2" style={{ color: "var(--ink-3)" }}>
                    <Dot color="var(--cat-assessment)" size={6} />
                    <span className="serif-it" style={{ fontSize: 12.5, flex: 1 }}>{e}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>{c}</span>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </div>

      {/* ─── Two examples, side by side ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20 }}>
        <QuickCheckRow />
        <ProjectTaskFull />
      </div>

      <div className="row gap-3" style={{ marginTop: 14, alignItems: "flex-start" }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", padding: "2px 6px", border: "1px solid var(--paper-deep)", borderRadius: 4 }}>
          STATE A + B
        </span>
        <div className="serif-it" style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.45, maxWidth: 900 }}>
          Two surfaces, two budgets. The quick-check is an add-a-row in the tasks table — title, criterion,
          due, lessons, save. The project task is a 5-tab configuration that rewards careful design.
          The chooser frames the decision before any typing.
        </div>
      </div>
    </div>
  );
}

function ChooserCard({ kind, title, sub, time, fields, cta, example, recommended }) {
  const isP = kind === "summative";
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border: isP ? "1.5px solid var(--ink)" : "1.5px dashed var(--ink-4)",
        background: isP ? "var(--paper-edge)" : "transparent",
        position: "relative",
      }}
    >
      {recommended && (
        <span
          className="mono"
          style={{
            position: "absolute", top: -10, right: 14,
            background: "var(--ink)", color: "var(--paper-card)",
            fontSize: 9.5, padding: "3px 8px", borderRadius: 4,
            letterSpacing: "0.08em",
          }}
        >
          BACKWARD-DESIGN FIRST
        </span>
      )}
      <div className="row gap-2" style={{ alignItems: "baseline" }}>
        <Dot color="var(--cat-assessment)" />
        <span className="eyebrow eyebrow-strong">{kind.toUpperCase()}</span>
      </div>
      <div className="display" style={{ fontSize: 28, marginTop: 6 }}>
        {title}
      </div>
      <div className="serif-it" style={{ fontSize: 15, color: "var(--ink-3)", marginTop: 2 }}>
        {sub}
      </div>

      <div className="row gap-3" style={{ marginTop: 14 }}>
        <span className="chip"><Clock size={11} /> {time}</span>
        <span className="chip"><Doc size={11} /> {fields}</span>
      </div>

      <hr className="hr-dashed" style={{ margin: "14px 0" }} />

      <div className="label" style={{ marginBottom: 8 }}>RECENT IN THIS UNIT</div>
      {example}

      <button
        className={`btn ${isP ? "btn-primary" : "btn-ghost"}`}
        style={{ marginTop: 16, height: 36, padding: "0 16px", fontSize: 13 }}
      >
        {cta} <ArrowR size={12} />
      </button>
    </div>
  );
}

/* ─────────────────────────── Quick check inline row ─────────────────────────── */
function QuickCheckRow() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", alignSelf: "flex-start" }}>
      <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid var(--paper-deep)" }}>
        <div className="row gap-2" style={{ alignItems: "baseline" }}>
          <Dot color="var(--cat-assessment)" />
          <span className="eyebrow eyebrow-strong">QUICK CHECK · INLINE</span>
        </div>
        <div className="display" style={{ fontSize: 22, marginTop: 4 }}>
          Add to tasks table
        </div>
        <div className="serif-it" style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
          5 minutes between periods. Type, tab, save.
        </div>
      </div>

      {/* table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 60px 90px 70px 50px",
          gap: 10,
          padding: "8px 16px",
          background: "var(--paper-edge)",
          borderBottom: "1px solid var(--paper-deep)",
        }}
      >
        {["Title", "Crit", "Due", "Lessons", ""].map((h) => (
          <div key={h} className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-4)", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      {/* existing rows */}
      {[
        { t: "Vocab probe — entropy", c: "A", d: "Mon 12 May", l: "L02", s: "published" },
        { t: "Marble run sketch (draft)", c: "B", d: "Wed 14 May", l: "L04", s: "published" },
      ].map((r) => (
        <div
          key={r.t}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 60px 90px 70px 50px",
            gap: 10,
            padding: "10px 16px",
            alignItems: "center",
            borderBottom: "1px solid var(--paper-deep)",
            fontSize: 12.5,
          }}
        >
          <div className="row gap-2">
            <Dot color="var(--cat-assessment)" size={6} />
            <span style={{ color: "var(--ink-2)" }}>{r.t}</span>
          </div>
          <CritPill k={r.c} />
          <span className="mono" style={{ fontSize: 11 }}>{r.d}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.l}</span>
          <span className="dot" style={{ background: "var(--ok)", width: 7, height: 7 }} />
        </div>
      ))}

      {/* the new row — being typed, dashed border on inputs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 60px 90px 70px 50px",
          gap: 10,
          padding: "12px 16px",
          alignItems: "center",
          background: "var(--paper-card)",
          borderBottom: "1px solid var(--paper-deep)",
          position: "relative",
        }}
      >
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--ink)" }} />
        <div className="row gap-2">
          <Dot color="var(--cat-assessment)" size={6} />
          <input
            className="input input-bare"
            style={{ fontSize: 13, fontWeight: 600, padding: "2px 0", borderBottomStyle: "solid", borderBottomColor: "var(--ink)" }}
            defaultValue="Quiz 1 — Newton's 2nd Law"
          />
        </div>
        <div className="seg" style={{ padding: 1, borderStyle: "dashed" }}>
          {["A", "B", "C", "D"].map((k) => (
            <button
              key={k}
              className="seg-btn"
              aria-selected={k === "A"}
              style={{ height: 18, padding: "0 5px", fontSize: 10 }}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="row gap-1" style={{ fontSize: 11, color: "var(--ink-2)" }}>
          <Calendar size={11} />
          <span className="mono">Mon 18 May</span>
        </div>
        <div className="row gap-1" style={{ fontSize: 11 }}>
          <span className="chip" style={{ height: 18, padding: "0 6px", fontSize: 10 }}>L03</span>
        </div>
        <div className="row gap-1" style={{ justifyContent: "flex-end" }}>
          <span
            className="mono"
            style={{
              fontSize: 9, color: "var(--paper-card)", background: "var(--ink)",
              padding: "2px 5px", borderRadius: 3, letterSpacing: "0.06em",
            }}
          >
            ↵
          </span>
        </div>
      </div>

      <div className="row" style={{ padding: "10px 16px", justifyContent: "space-between", background: "var(--paper-edge)" }}>
        <span className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
          press ↵ to save · esc to cancel
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>4 FIELDS · NO MODAL</span>
      </div>

      <div style={{ padding: "12px 16px", background: "var(--paper-card)", borderTop: "1px solid var(--paper-deep)" }}>
        <div className="serif-it" style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45 }}>
          No GRASPS. No rubric. No late policy. The data row gets default values
          (no penalty, AI allowed, formative) the teacher never sees unless they ask.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Project task — full config ─────────────────────────── */
function ProjectTaskFull() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* header */}
      <div style={{ padding: "16px 20px 12px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row gap-2" style={{ alignItems: "baseline", marginBottom: 4 }}>
              <Dot color="var(--cat-assessment)" />
              <span className="eyebrow eyebrow-strong">SUMMATIVE PROJECT</span>
              <span className="serif-it" style={{ fontSize: 14, color: "var(--ink-3)" }}>
                — backward design from here
              </span>
            </div>
            <input
              className="input input-lg input-bare"
              style={{ borderBottomStyle: "solid", borderBottomColor: "var(--ink)", maxWidth: 480 }}
              defaultValue="Roller Coaster Design Brief"
            />
          </div>
          <div className="col gap-2" style={{ alignItems: "flex-end" }}>
            <StatusPill kind="draft" />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>step 3 of 5</span>
          </div>
        </div>

        {/* tabs */}
        <div className="tabs" style={{ marginTop: 18 }}>
          {[
            ["1", "GRASPS", true,  "var(--ink)"],
            ["2", "Submission", true, "var(--ink)"],
            ["3", "Rubric", true, "var(--ink)"],
            ["4", "Timeline", false, "var(--ink-4)"],
            ["5", "Policy", false, "var(--ink-4)"],
          ].map(([n, name, done, _]) => (
            <button
              key={n}
              className="tab"
              aria-selected={n === "3"}
            >
              <span className="tab-num">{n}</span>
              <span>{name}</span>
              {done && (
                <span
                  className="check on"
                  style={{ width: 12, height: 12, marginLeft: 2 }}
                >
                  <I d="M5 13l4 4L19 7" size={7} stroke={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* tab body — Rubric */}
      <div style={{ padding: "16px 20px 18px", background: "var(--paper-card)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <Label hint="4 levels per criterion · MYP 1–8">Rubric — write descriptors</Label>
          </div>
          <div className="row gap-2">
            <button className="btn btn-quiet" style={{ height: 24, padding: 0, fontSize: 11.5 }}>
              <Wand size={11} /> Suggest from GRASPS
            </button>
            <button className="btn btn-quiet" style={{ height: 24, padding: 0, fontSize: 11.5 }}>
              <Doc size={11} /> Import from previous unit
            </button>
          </div>
        </div>

        <div className="rubric" style={{ gridTemplateColumns: "120px 1fr 1fr 1fr 1fr" }}>
          <div className="rubric-h">CRIT</div>
          <div className="rubric-h">1–2</div>
          <div className="rubric-h">3–4</div>
          <div className="rubric-h">5–6</div>
          <div className="rubric-h">7–8</div>

          {[
            ["A", "Investigating", ["Identifies a problem with prompting.", "States the problem and one user need.", "Analyses with research from 2+ sources.", "Justifies with primary research and constraints."]],
            ["B", "Developing", ["Lists one idea.", "Generates 2–3 ideas with sketches.", "Divergent set, narrows with criteria.", "Divergent set, evaluates against GRASPS."]],
            ["C", "Creating", null],
            ["D", "Evaluating", null],
          ].map(([k, n, levels]) => (
            <React.Fragment key={k}>
              <div className="rubric-row-label">
                <CritPill k={k} />
                <span style={{ fontSize: 11 }}>{n}</span>
              </div>
              {levels
                ? levels.map((t, i) => <div key={i} className="rubric-cell" style={{ fontSize: 11 }}>{t}</div>)
                : [0, 1, 2, 3].map((i) => (
                    <div key={i} className="rubric-cell rubric-cell-empty" style={{ fontSize: 12 }}>
                      {i === 0 ? "click to write…" : "—"}
                    </div>
                  ))}
            </React.Fragment>
          ))}
        </div>

        {/* self-assessment scaffold — required toggle */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1.5px solid var(--ink)",
            borderRadius: 8,
            background: "var(--paper-edge)",
            display: "flex", gap: 12, alignItems: "center",
          }}
        >
          <span
            style={{
              width: 28, height: 28, borderRadius: 6, background: "var(--ink)",
              color: "var(--paper-card)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}
          >
            <Mirror size={14} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Require self-assessment before submit</span>
              <span className="chip mono" style={{ fontSize: 9.5, height: 18, padding: "0 6px" }}>Hattie d=1.33</span>
            </div>
            <div className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
              Locked on for summative — students see this rubric on lesson 1 and rate themselves before submit.
            </div>
          </div>
          <span className="check on" style={{ width: 18, height: 18 }}>
            <I d="M5 13l4 4L19 7" size={11} stroke={3} />
          </span>
        </div>
      </div>

      {/* footer */}
      <div className="row" style={{ padding: "12px 20px", justifyContent: "space-between", background: "var(--paper-edge)", borderTop: "1px solid var(--paper-deep)" }}>
        <button className="btn btn-quiet"><Chevron size={11} style={{ transform: "rotate(180deg)" }} /> Back · Submission</button>
        <span className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>2 of 4 criteria written · 14 min spent</span>
        <button className="btn btn-primary">Continue · Timeline <ArrowR size={12} /></button>
      </div>
    </div>
  );
}

Object.assign(window, { SplitSurfaces });
