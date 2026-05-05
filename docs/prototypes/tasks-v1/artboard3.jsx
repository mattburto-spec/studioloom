/* Artboard 3 — The decision panel
 * Picks SPLIT. Argues from specific teacher-friction moments.
 */

function DecisionPanel() {
  return (
    <div style={{ width: 1080, fontFamily: "var(--sans)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 0,
          background: "var(--paper-card)",
          border: "1px solid var(--paper-deep)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 12px 24px -18px rgba(31,27,22,0.18)",
        }}
      >
        {/* LEFT — the verdict */}
        <div style={{ padding: 32, borderRight: "1px solid var(--paper-deep)" }}>
          <div className="row gap-2" style={{ alignItems: "baseline", marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--paper-card)", background: "var(--ink)", padding: "3px 7px", borderRadius: 4, letterSpacing: "0.08em" }}>
              VERDICT
            </span>
            <span className="serif-it" style={{ fontSize: 16, color: "var(--ink-3)" }}>
              the artboards argued for themselves
            </span>
          </div>

          <div className="display" style={{ fontSize: 52, lineHeight: 1.0, marginBottom: 14 }}>
            Ship <span className="serif-it" style={{ fontSize: 56, fontWeight: 400 }}>split</span> surfaces.
          </div>

          <div style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 560 }}>
            <p style={{ margin: "0 0 12px" }}>
              The data model staying unified is fine — it's an implementation detail. But the
              teacher's <em>create</em> surface should follow the shape of the work, not the shape
              of the table. A formative check and a summative project are different jobs done by the
              same person at different cognitive budgets, and the UI should respect that asymmetry.
            </p>

            <p style={{ margin: "0 0 12px" }}>
              Artboard&nbsp;1 reveals the unification problem: when the surface tries to serve both,
              the formative path becomes a tour of dimmed sections the teacher must mentally veto
              ("not for me, not for me, not for me"). Five minutes between periods is not enough
              cognitive runway for that. The teacher will hesitate at the type toggle, scroll past
              GRASPS to confirm it's actually optional, and quietly resent the UI by the third
              exit-ticket of the week.
            </p>

            <p style={{ margin: "0 0 12px" }}>
              Artboard&nbsp;2 reveals the inverse: when summative gets its own multi-step home, the
              tab strip <em>becomes</em> the backward-design checklist. Rubric is tab&nbsp;3 of 5,
              which is exactly when teachers should be writing it — after GRASPS, before timeline.
              Self-assessment lives next to the rubric, locked on, impossible to miss. The
              quick-check stays an inline row in the tasks table — four fields, ↵ to save, no modal.
            </p>

            <p style={{ margin: 0 }}>
              Underneath, both still write to <span className="mono" style={{ fontSize: 13, background: "var(--paper-edge)", padding: "1px 5px", borderRadius: 3 }}>assessment_tasks</span>.
              The discriminator earns its keep at query time, not at create time.
            </p>
          </div>
        </div>

        {/* RIGHT — what the loser breaks, specifically */}
        <div style={{ padding: 28, background: "var(--paper-edge)" }}>
          <div className="label" style={{ marginBottom: 14 }}>WHERE THE UNIFIED SURFACE BREAKS</div>

          <FrictionMoment
            n="01"
            when="Tuesday, 11:42am"
            who="Ms. Okafor, between Y9 periods 3 and 4"
            what="Wants to add an exit ticket on Newton's 2nd Law before Period 4 walks in."
            breaks="Opens the unified surface, sees the type toggle pre-set to summative because that was her last task. Switches it. Watches GRASPS, Rubric, Self-assessment collapse into 'not used for formative' rows. Wonders if she's missing something. Scrolls. Loses 90 seconds of a 5-minute window deciding whether to trust the collapsed state."
          />

          <FrictionMoment
            n="02"
            when="Sunday, 8:15pm"
            who="Mr. Patel, planning a 6-week unit"
            what="Designing the roller-coaster brief that anchors the whole unit."
            breaks="Backward design wants him to define summative first and design lessons backwards. The unified surface starts at title and lets him save with the rubric blank — because formative tasks save with it blank. He drafts the unit, returns Wednesday, finds three lessons already written and a rubric still empty. The shape of the form didn't push him."
          />

          <FrictionMoment
            n="03"
            when="Wednesday, 9:03am"
            who="A first-year MYP teacher"
            what="Knows GRASPS exists in theory, has never written one."
            breaks="On the unified surface, GRASPS is one accordion among many, framed as 'type-specific, optional below.' She skips it. On the split surface, GRASPS is tab 1 of 5 — the first thing the project flow asks her to do. The UI taught her the practice."
          />

          <hr className="hr-dashed" style={{ margin: "20px 0 16px" }} />

          <div className="label" style={{ marginBottom: 10 }}>WHAT WE GIVE UP</div>
          <div className="serif-it" style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 10px" }}>
              Two surfaces means two empty states, two help docs, two places to add a future field.
              Real cost. Mitigated by the fact that 80% of fields live on the project surface; the
              quick-check is a row, and rows don't need help docs.
            </p>
            <p style={{ margin: 0 }}>
              And we lose the elegant story of "one task, one form." Engineering will mourn it.
              Teachers won't notice. Teachers don't read the schema.
            </p>
          </div>
        </div>
      </div>

      {/* signature strip */}
      <div className="row" style={{ marginTop: 14, justifyContent: "space-between", color: "var(--ink-3)", fontSize: 12 }}>
        <div className="row gap-3">
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>STUDIOLOOM · TASKS · ARCHITECTURE PROBE v0.1</span>
        </div>
        <div className="serif-it" style={{ fontSize: 13 }}>
          recommend locking on split surfaces · unified <span className="mono" style={{ fontSize: 11 }}>assessment_tasks</span> table stays
        </div>
      </div>
    </div>
  );
}

function FrictionMoment({ n, when, who, what, breaks }) {
  return (
    <div style={{ marginBottom: 18, paddingLeft: 14, position: "relative" }}>
      <span
        style={{
          position: "absolute", left: 0, top: 4, bottom: 4,
          width: 2, background: "var(--ink)",
        }}
      />
      <div className="row gap-2" style={{ alignItems: "baseline", marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>{n}</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink), padding: 0", color: "var(--ink-2)" }}>{when}</span>
        <span style={{ color: "var(--ink-4)", fontSize: 11 }}>·</span>
        <span className="serif-it" style={{ fontSize: 13, color: "var(--ink-3)" }}>{who}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{what}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{breaks}</div>
    </div>
  );
}

Object.assign(window, { DecisionPanel });
