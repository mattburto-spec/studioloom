/* Artboard 1 — Unified surface
 * One create/edit screen, type-aware. Shown in two states side-by-side.
 */

function UnifiedSurface({ mode = "summative" }) {
  // mode: "formative" | "summative"
  const isF = mode === "formative";

  return (
    <div style={{ width: 880, fontFamily: "var(--sans)" }}>
      {/* breadcrumb */}
      <div className="row gap-2" style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 14 }}>
        <span>Year 9 Design / Sustainable Packaging</span>
        <span>/</span>
        <span style={{ color: "var(--ink)" }}>Tasks</span>
        <span>/</span>
        <span className="serif-it" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          {isF ? "Quiz 1 — Newton's 2nd Law" : "Roller Coaster Design Brief"}
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* TOP — task type + title + status */}
        <div style={{ padding: "20px 24px 18px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <Label hint="determines what's required below">Task type</Label>
              <div className="seg" style={{ marginTop: 8, marginBottom: 18 }}>
                <button className="seg-btn" aria-selected={isF}>
                  <Dot color="var(--cat-assessment)" /> Formative check
                </button>
                <button className="seg-btn" aria-selected={!isF}>
                  <Dot color="var(--cat-assessment)" size={10} /> Summative project
                </button>
                <button className="seg-btn" aria-selected={false} style={{ color: "var(--ink-4)" }}>
                  Peer review
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>SOON</span>
                </button>
                <button className="seg-btn" aria-selected={false} style={{ color: "var(--ink-4)" }}>
                  Self
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>SOON</span>
                </button>
              </div>

              <div className="row gap-3" style={{ alignItems: "baseline", marginBottom: 4 }}>
                <span className="eyebrow eyebrow-strong">{isF ? "FORMATIVE · QUICK CHECK" : "SUMMATIVE · PROJECT"}</span>
                {isF ? (
                  <span className="serif-it" style={{ fontSize: 14, color: "var(--ink-3)" }}>
                    low stakes, fast feedback
                  </span>
                ) : (
                  <span className="serif-it" style={{ fontSize: 14, color: "var(--ink-3)" }}>
                    backward design — students see this on lesson 1
                  </span>
                )}
              </div>

              <input
                className="input input-lg input-bare"
                style={{ borderBottomStyle: "solid", borderBottomColor: "var(--ink)" }}
                defaultValue={isF ? "Quiz 1 — Newton's 2nd Law" : "Roller Coaster Design Brief"}
              />
            </div>

            <div className="col gap-2" style={{ alignItems: "flex-end" }}>
              <StatusPill kind={isF ? "draft" : "draft"} />
              <div className="meta-row mono" style={{ fontSize: 10.5 }}>
                {isF ? "id · t_quiz_n2l_24" : "id · t_rc_brief_24"}
              </div>
            </div>
          </div>
        </div>

        <hr className="hr-paper" />

        {/* MIDDLE — universal block */}
        <div style={{ padding: "18px 24px", background: "var(--paper-card)" }}>
          <div className="row" style={{ alignItems: "flex-start", gap: 28 }}>
            <div style={{ flex: 1 }}>
              <Label>Criteria assessed</Label>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                {isF
                  ? [["A", true], ["B", false], ["C", false], ["D", false]].map(([k, on]) => (
                      on ? <CritPill key={k} k={k} /> : <CritGhost key={k} k={k} />
                    ))
                  : ["A", "B", "C", "D"].map((k) => <CritPill key={k} k={k} />)}
              </div>
              <div className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 6 }}>
                {isF ? "1 of 4 — typical for a quick check" : "all 4 — full design cycle"}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <Label>Linked lessons</Label>
              <div className="col gap-1" style={{ marginTop: 8 }}>
                {(isF
                  ? [{ n: 3, t: "Force diagrams", cat: "content" }]
                  : [
                      { n: 1, t: "The brief",          cat: "content" },
                      { n: 4, t: "Concept sketches",   cat: "response" },
                      { n: 6, t: "Build a prototype",  cat: "toolkit" },
                      { n: 8, t: "Reflect",            cat: "assessment" },
                    ]
                ).map((l) => (
                  <div key={l.n} className="row gap-2" style={{ fontSize: 12.5 }}>
                    <Dot color={CAT[l.cat]} />
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      L{String(l.n).padStart(2, "0")}
                    </span>
                    <span style={{ color: "var(--ink-2)" }}>{l.t}</span>
                  </div>
                ))}
                <button className="btn btn-quiet" style={{ height: 22, padding: 0, fontSize: 11.5, marginTop: 4, alignSelf: "flex-start" }}>
                  <Plus size={11} /> Link lesson
                </button>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <Label>Due</Label>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <Calendar size={14} />
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {isF ? "Mon 18 May" : "Fri 23 May"}
                </span>
                {!isF && (
                  <span className="serif-it" style={{ fontSize: 12, color: "var(--ink-4)" }}>
                    · 6-week project
                  </span>
                )}
              </div>
              <Label style={{ marginTop: 16 }}>Submission</Label>
              <div className="row gap-2" style={{ marginTop: 8 }}>
                <span className="chip"><Doc size={11} />{isF ? "5 questions" : "Multi · text + upload"}</span>
              </div>
            </div>
          </div>
        </div>

        <hr className="hr-paper" />

        {/* TYPE-AWARE BLOCKS — collapse for formative, full for summative */}
        {isF ? <FormativeBlocks /> : <SummativeBlocks />}

        <hr className="hr-paper" />

        {/* footer */}
        <div className="row" style={{ padding: "14px 24px", justifyContent: "space-between", background: "var(--paper-edge)" }}>
          <div className="serif-it" style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {isF
              ? "auto-saved · 14 fields total, 5 in use"
              : "auto-saved · 14 fields total, 14 in use"}
          </div>
          <div className="row gap-2">
            <button className="btn btn-ghost">Preview as student</button>
            <button className="btn btn-primary">
              Publish to {isF ? "Y9 Design A" : "all classes"} <ArrowR size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* annotation under the card */}
      <div className="row gap-3" style={{ marginTop: 14, alignItems: "flex-start" }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", padding: "2px 6px", border: "1px solid var(--paper-deep)", borderRadius: 4 }}>
          {isF ? "STATE A" : "STATE B"}
        </span>
        <div className="serif-it" style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.45, maxWidth: 720 }}>
          {isF
            ? "Same surface. The teacher fills 5 fields, ignores the rest. Type-aware blocks below stay collapsed — visible as one summary line so they're discoverable, not demanding."
            : "Same surface. Type-aware blocks below expand: GRASPS, full rubric editor with self-assessment scaffold, AI policy, late + resubmission. The shape of the form follows the shape of the task."}
        </div>
      </div>
    </div>
  );
}

/* ───────── formative-only collapsed sections ───────── */
function FormativeBlocks() {
  return (
    <div style={{ padding: "14px 24px" }}>
      <div className="col gap-2">
        <CollapsedRow
          icon={<Target size={13} />}
          title="GRASPS scaffold"
          right="not used for formative"
          dim
        />
        <CollapsedRow
          icon={<Layers size={13} />}
          title="Rubric"
          right="not used for formative"
          dim
        />
        <CollapsedRow
          icon={<Mirror size={13} />}
          title="Self-assessment scaffold"
          right="not used for formative"
          dim
        />
        <hr className="hr-dashed" style={{ margin: "6px 0" }} />
        <CollapsedRow
          icon={<Bolt size={13} />}
          title="AI use"
          right={<span className="serif-it" style={{ fontSize: 13 }}>allowed — calculators ok, no chatbots</span>}
        />
        <CollapsedRow
          icon={<Clock size={13} />}
          title="Late policy"
          right={<span className="serif-it" style={{ fontSize: 13 }}>no penalty — formative</span>}
        />
      </div>
    </div>
  );
}

function CollapsedRow({ icon, title, right, dim }) {
  return (
    <div
      className="row gap-3"
      style={{
        padding: "10px 12px",
        border: dim ? "1.5px dashed var(--paper-deep)" : "1px solid var(--paper-deep)",
        borderRadius: 8,
        background: dim ? "transparent" : "var(--paper-card)",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <span style={{ color: "var(--ink-3)" }}>{icon}</span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: dim ? "var(--ink-4)" : "var(--ink)" }}>{title}</span>
      <span style={{ flex: 1 }} />
      {typeof right === "string" ? (
        <span className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{right}</span>
      ) : (
        right
      )}
      {!dim && <Caret size={12} />}
    </div>
  );
}

/* ───────── summative blocks ───────── */
function SummativeBlocks() {
  return (
    <div style={{ padding: "18px 24px" }}>
      {/* GRASPS */}
      <div style={{ marginBottom: 22 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <Label hint="Wiggins/McTighe — frame an authentic task">GRASPS scaffold</Label>
          <button className="btn btn-quiet" style={{ height: 22, padding: 0, fontSize: 11.5 }}>
            <Wand size={11} /> Draft from unit brief
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            ["Goal", "Design a roller coaster that stays under 4g while reaching ≥18 m/s at first peak."],
            ["Role", "Junior engineer at a theme-park design studio."],
            ["Audience", "Park operations + a 12-year-old test-rider."],
            ["Situation", "A new pavilion opens June. The brief is real."],
            ["Performance", "A scaled track + a written brief justifying the physics."],
            ["Standards", "MYP Design A·B·C·D · 4 levels per criterion."],
          ].map(([h, t]) => (
            <div key={h} className="card-flat" style={{ padding: 10 }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-4)" }}>
                {h.toUpperCase()}
              </div>
              <div className="serif-it" style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.35 }}>
                {t}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RUBRIC */}
      <div style={{ marginBottom: 22 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <Label hint="4 achievement levels per criterion · MYP 1–8 bands">Rubric</Label>
          <div className="row gap-2">
            <span className="chip chip-solid mono" style={{ fontSize: 10.5 }}>3 of 4 criteria written</span>
            <button className="btn btn-quiet" style={{ height: 22, padding: 0, fontSize: 11.5 }}>
              <Wand size={11} /> Suggest descriptors
            </button>
          </div>
        </div>

        <div className="rubric" style={{ gridTemplateColumns: "140px 1fr 1fr 1fr 1fr" }}>
          <div className="rubric-h">CRITERION</div>
          <div className="rubric-h">1–2 Limited</div>
          <div className="rubric-h">3–4 Adequate</div>
          <div className="rubric-h">5–6 Substantial</div>
          <div className="rubric-h">7–8 Excellent</div>

          {[
            ["A", "Investigating", [
              "Identifies a problem with prompting.",
              "States the problem and one user need.",
              "Analyses the problem with research from 2+ sources.",
              "Justifies the problem with primary research and constraints.",
            ]],
            ["B", "Developing Ideas", [
              "Lists one idea.",
              "Generates 2–3 ideas with sketches.",
              "Generates a divergent set, narrows with stated criteria.",
              "Generates a divergent set, evaluates against GRASPS, justifies a chosen direction.",
            ]],
            ["C", "Creating", null], // empty -> placeholder
            ["D", "Evaluating", [
              "Describes what they made.",
              "Tests with one user, notes one change.",
              "Tests with multiple users, links findings to criteria.",
              "Tests rigorously, traces each change to evidence, proposes next iteration.",
            ]],
          ].map(([k, name, levels]) => (
            <React.Fragment key={k}>
              <div className="rubric-row-label">
                <CritPill k={k} />
                <span>{name}</span>
              </div>
              {levels
                ? levels.map((t, i) => <div key={i} className="rubric-cell">{t}</div>)
                : [0, 1, 2, 3].map((i) => (
                    <div key={i} className="rubric-cell rubric-cell-empty">
                      {i === 0 ? "click to write descriptor…" : "—"}
                    </div>
                  ))}
            </React.Fragment>
          ))}
        </div>

        {/* self-assessment scaffold — surfaced as part of the rubric, not buried */}
        <div
          style={{
            marginTop: 12,
            padding: 14,
            border: "1.5px solid var(--ink)",
            borderRadius: 10,
            background: "var(--paper-edge)",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 34, height: 34,
              borderRadius: 8,
              background: "var(--ink)",
              color: "var(--paper-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flex: "none",
            }}
          >
            <Mirror size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <span className="eyebrow eyebrow-strong">SELF-ASSESSMENT BEFORE SUBMIT</span>
              <span className="chip mono" style={{ fontSize: 10, background: "var(--paper-card)", borderColor: "var(--ink-4)" }}>
                Hattie d=1.33
              </span>
              <span style={{ flex: 1 }} />
              <span className="serif-it" style={{ fontSize: 13, color: "var(--ink-2)" }}>required for summative</span>
              <span className="check on"><I d="M5 13l4 4L19 7" size={9} stroke={3} /></span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.45 }}>
              Students rate themselves against each criterion's descriptor before the submit button enables.
              Their self-rating sits next to the teacher's grade in the marking view.
            </div>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <span className="chip"><Dot color="var(--cat-collaboration)" />Show rubric in lesson 1</span>
              <span className="chip"><Dot color="var(--cat-content)" />Require sticky-note reflection</span>
              <span className="chip chip-dashed">+ Optional confidence slider</span>
            </div>
          </div>
        </div>
      </div>

      {/* POLICY ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <PolicyCard
          icon={<Bolt size={13} />}
          label="AI USE"
          value="Allowed with citation"
          detail="Students declare which prompts they used and where in the brief. Auto-stamped on submission."
        />
        <PolicyCard
          icon={<Clock size={13} />}
          label="LATE POLICY"
          value="−10% per day"
          detail="Capped at 50% off. Blocked after 7 days unless extension granted."
        />
        <PolicyCard
          icon={<Layers size={13} />}
          label="RESUBMIT"
          value="2 attempts · until 30 May"
          detail="Best score counts. Self-assessment required again on resubmit."
        />
      </div>
    </div>
  );
}

function PolicyCard({ icon, label, value, detail }) {
  return (
    <div className="card-flat" style={{ padding: 12 }}>
      <div className="row gap-2" style={{ color: "var(--ink-3)" }}>
        {icon}
        <span className="label">{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: "var(--ink)" }}>{value}</div>
      <div className="serif-it" style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>
        {detail}
      </div>
    </div>
  );
}

Object.assign(window, { UnifiedSurface });
