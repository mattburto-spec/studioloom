# Lesson Pulse Test Run — TeachEngineering MIS-2926

**Source:** [Under Pressure: Using Young's Modulus to Explore Material Properties](https://www.teachengineering.org/activities/view/mis-2926-under-pressure-arduino-sensor-force-activity)

**PDF source:** Full 11-page lesson plan (TeachEngineering format)

**Format:** 3 sessions × 50 minutes. Grade 9-10 (HS). Groups of 3-4. NGSS HS-PS2-6.

---

## Activity Structure (from full PDF)

The PDF reveals a 3-part activity with 8 identifiable sections — richer than the web summary suggested:

| # | Activity | Bloom Level | Agency | Grouping | Collaboration | Thinking Routine | Scaffolding |
|---|----------|------------|--------|----------|--------------|-----------------|-------------|
| A1 | **Part 1 Opening — Brainstorm + Quick Poll** — Brainstorm uses for flexibility vs stiffness in products. Quick poll on which material is stiffest. Teacher introduces Young's Modulus concept. | `understand` | `none` | `whole_class` | `parallel` | none | Quick poll as formative check |
| A2 | **Part 1 — Research + Worksheet** — Students research Young's Modulus values for 6 materials (paper, rubber eraser, silicon, aluminum foil, sheet plastic, cardboard). Fill in data table. Make predictions about which will be stiffest/most flexible. | `remember` | `choice_of_resource` | `individual` | `parallel` | none | Worksheet with table structure |
| A3 | **Part 2 — Arduino Setup** — Groups of 3-4. Read FAQ sheet, set up Arduino Uno + FSR (force-sensitive resistor), test serial plotter output. | `apply` | `none` | `small_group` | `cooperative` | none | FAQ sheet + teacher demo |
| A4 | **Part 2 — Material Testing + Data Collection** — Apply constant pressure on probe, vary angle for 15 seconds per material. Record serial plotter readings. Calculate average rate of change. Worksheet Part 2. Repeat for all 6 materials. | `apply` | `none` | `small_group` | `cooperative` | none | Worksheet Part 2 + serial plotter visual |
| A5 | **Part 2/3 — Engineering Design Challenge** — Apply engineering design process (Ask → Research → Imagine → Plan → Create → Improve → Reflect) to design a device ensuring consistent pressure + angle during testing. Students bring household materials. | `create` | `choice_of_approach` + `choice_of_materials` | `small_group` | `collaborative` | none | Engineering Design Process graphic |
| A6 | **Part 3 — Prototype Build + Test** — Build prototype device using household + classroom materials. Test with Arduino. Record results. | `create` | `choice_of_approach` | `small_group` | `collaborative` | none | none |
| A7 | **Part 3 — Improve + Reflect** — Compare results with vs without device. Identify improvements. Iterate on design. Connect findings back to desk redesign scenario. | `evaluate` | `choice_of_approach` | `small_group` | `collaborative` | none | Comparison framework (with/without) |
| A8 | **Part 3 — Share Designs** — Regroup as whole class. Groups share designs, results, and learnings. Summative reflection questions. | `analyze` | `none` | `whole_class` | `parallel` | none | Guided reflection questions |

**Differentiation noted:** Lower grades → fewer materials + simpler Arduino setup. Upper grades → more complex materials + advanced data analysis. (Present but minimal — 2 tiers, no ELL scaffolding.)

**Assessment (richer than initially scored):**
- Pre-activity: brainstorm + quick poll (diagnostic)
- Part 1: worksheet formative (teacher-checked)
- Part 2: data collection formative (teacher-checked)
- Part 3: summative reflection connecting to desk redesign scenario
- No structured peer or self-assessment, but sharing debrief has informal peer element

**UDL checkpoints:** Representation (worksheets, FAQ sheet, serial plotter visual), Action & Expression (Arduino hands-on, prototype building, multiple materials), Engagement (design freedom in Parts 2-3, household material selection). Partial coverage of all 3 principles — stronger than initial assessment.

**Engineering Design Process:** Explicitly taught — Ask → Research → Imagine → Plan → Create → Improve → Reflect. 7-step cycle graphic provided.

---

## Pulse Scoring (Revised — Full PDF)

### Dimension 1: Cognitive Rigour

**Bloom distribution:**
- A1: understand (2), A2: remember (1), A3: apply (4), A4: apply (4), A5: create (10), A6: create (10), A7: evaluate (8), A8: analyze (6)
- **bloomAvg** = (2 + 1 + 4 + 4 + 10 + 10 + 8 + 6) / 8 = **5.63**

**Thinking routines:**
- None explicitly named → defaults to **5.0** (neutral)
- Note: the brainstorm-predict-test-reflect arc is *implicitly* a thinking routine (predict → test → compare → reflect), but it's not named as one (e.g., See-Think-Wonder, Claim-Support-Question). Conservative scoring.

**Inquiry arc:**
- Phases present: brainstorm/predict (A1-A2), apply/test (A3-A4), design (A5), build (A6), evaluate/improve (A7), reflect/share (A8)
- 6 distinct inquiry phases → `inquiryArc = min(10, (6/3) × 10)` = **10.0** (capped)

**Assessment:**
- Diagnostic (brainstorm/poll) + 2 embedded formative (worksheets) + summative reflection = mixed portfolio
- `assessmentScore` = **9** (multiple types, diagnostic + formative + summative)

**Weighted calculation:**
```
CR = 5.63 × 0.40 + 5.0 × 0.25 + 10.0 × 0.20 + 9 × 0.15
   = 2.25 + 1.25 + 2.00 + 1.35
   = 6.85
```

**Cognitive Rigour = 6.9 / 10** *(was 6.3)*

*Insight: The full PDF reveals two Create-level activities (design + build) plus an Evaluate step (improve/compare), lifting the Bloom average significantly. The inquiry arc is actually a full engineering cycle with 6 phases. Assessment is richer than web search suggested — diagnostic brainstorm + 2 formatives + summative reflection. Still no explicit named thinking routine, which caps the thinking sub-score at neutral.*

---

### Dimension 2: Student Agency

**Agency types:**
- A1: none (0), A2: choice_of_resource (3), A3: none (0), A4: none (0), A5: choice_of_approach + choice_of_materials (6), A6: choice_of_approach (5), A7: choice_of_approach (5), A8: none (0)
- **agencyAvg** = (0 + 3 + 0 + 0 + 6 + 5 + 5 + 0) / 8 = **2.38**

**Collaboration depth:**
- A1: parallel (2), A2: parallel (2), A3: cooperative (5), A4: cooperative (5), A5: collaborative (8), A6: collaborative (8), A7: collaborative (8), A8: parallel (2)
- **collabAvg** = (2 + 2 + 5 + 5 + 8 + 8 + 8 + 2) / 8 = **5.0**

**Peer/self assessment:**
- No structured peer or self-assessment protocol
- Sharing debrief (A8) is informal peer exposure, not peer feedback
- `peerScore` = **3** (no structured mechanism)

**Weighted calculation:**
```
SA = 2.38 × 0.50 + 5.0 × 0.30 + 3 × 0.20
   = 1.19 + 1.50 + 0.60
   = 3.29
```

**Student Agency = 3.3 / 10** *(was 2.3)*

*Insight: Better than initially scored — the PDF reveals genuine design freedom (students bring household materials, choose their own approach to the pressure device, iterate on their design). Collaboration lifts to 5.0 because 4 of 8 activities are in sustained small groups doing genuine collaborative work. But agency is still dragged down by the first half (A1-A4) being entirely teacher-directed procedure. The sharing debrief is exposure, not structured peer feedback — students present but don't evaluate each other's work with criteria. This is the classic engineering lesson pattern: follow the recipe first, then get creative at the end.*

---

### Dimension 3: Teacher Craft

**Grouping variety:**
- Types: whole_class (A1, A8), individual (A2), small_group (A3-A7) → 3 types
- Note: the initial web search suggested pairs for Arduino work, but the PDF specifies groups of 3-4
- **groupingVariety** = min(10, (3/3) × 10) = **10.0**

**UDL coverage:**
- Representation: worksheets, FAQ sheet, serial plotter visual display, Engineering Design Process graphic (Principle 1) ✓
- Action & Expression: Arduino hands-on, prototype building, multiple material types (Principle 2) ✓
- Engagement: design freedom + household material choice in Parts 2-3, but no explicit choice in how to demonstrate learning (Principle 3) — partial
- **udlPrinciples** = 2.5 (generous), **udlCoverage** = min(10, (2.5/3) × 10) = **8.33**

**Scaffolding completeness:**
- A1: quick poll (emerging check), A2: worksheet with table structure (emerging), A3: FAQ sheet (emerging), A4: worksheet Part 2 (emerging), A5: Engineering Design Process graphic (emerging), A6-A7: none explicit, A8: guided reflection questions (emerging)
- Activities with all 3 ELL tiers (emerging + developing + proficient): **0 of 8**
- Scaffolding exists but is single-tier only (worksheets without language support, no sentence starters, no vocabulary pre-teaching beyond 3 terms)
- **scaffoldingScore** = min(10, (0/8) × 10) = **0**
- Note: being generous, the FAQ sheet + worksheets + EDP graphic provide some structural scaffold → bump to **1**

**Differentiation:**
- Present (2 tiers: lower/upper grades) + open-ended design challenge naturally differentiates
- **diffScore** = **8** (has differentiation = true)

**AI rules configured:**
- N/A for external lesson → all neutral
- **aiScore** = min(10, (0/8) × 10) = **0**

**Weighted calculation:**
```
TC = 10.0 × 0.20 + 8.33 × 0.25 + 1 × 0.20 + 8 × 0.20 + 0 × 0.15
   = 2.00 + 2.08 + 0.20 + 1.60 + 0
   = 5.88
```

**Teacher Craft = 5.9 / 10** *(was 5.3)*

*Insight: UDL coverage is stronger than initially assessed — the serial plotter provides real-time visual representation of abstract force data, and the Engineering Design Process graphic scaffolds the design challenge. Grouping variety is good (3 types). The persistent gap is scaffolding: zero ELL support, no sentence starters for reflection, only 3 vocabulary terms pre-taught despite the lesson being heavily technical (Arduino, serial plotter, FSR, Young's Modulus, stress, strain, average rate of change — students actually need 7-8 terms). The differentiation note is still generic.*

---

## Overall Score (Bloomberg-style)

```
rawAvg = (6.9 + 3.3 + 5.9) / 3 = 5.37

stdDev = sqrt(((6.9 - 5.37)² + (3.3 - 5.37)² + (5.9 - 5.37)²) / 3)
       = sqrt((2.34 + 4.28 + 0.28) / 3)
       = sqrt(2.30)
       = 1.52

unevennessPenalty = min(1.5, 1.52 × 0.5) = 0.76

overall = 5.37 - 0.76 = 4.61
```

**Overall Lesson Pulse = 4.6 / 10** *(was 3.8)*

---

## Score Summary

| Dimension | Initial (web) | Revised (PDF) | Rating |
|-----------|:---:|:---:|--------|
| Cognitive Rigour | 6.3 | **6.9** | 🟡 Amber — strong inquiry arc + engineering cycle lifts it |
| Student Agency | 2.3 | **3.3** | 🔴 Red — better than recipe lab but still front-loaded with directed procedure |
| Teacher Craft | 5.3 | **5.9** | 🟡 Amber — good UDL, zero ELL scaffolding |
| **Overall** | 3.8 | **4.6** | 🟡 Amber (borderline) — penalty still bites because Agency lags |

**Key changes from initial scoring:**
1. **+0.6 CR** — PDF reveals two Create-level activities (design + build), Evaluate step, and richer assessment (diagnostic + formative + summative). Bloom average jumps 4.5 → 5.63.
2. **+1.0 SA** — Genuine design freedom in Part 3 (bring materials, choose approach, iterate). Collaboration jumps because 4/8 activities are in sustained collaborative groups. Still weak because first half is all directed procedure.
3. **+0.6 TC** — UDL coverage better (serial plotter as visual representation, EDP graphic). Scaffolding still zero (no ELL support). Missing pairs grouping (was assumed from web, PDF says groups of 3-4).
4. **+0.8 Overall** — Improvements across all 3 dimensions + slightly lower penalty (scores more balanced).

---

## What Surgical Repair Would Do

Overall (4.6) < 5.0 AND Student Agency (3.3) < 4.0, so the repair system would trigger targeting Student Agency:

**Repair prompt target:** Part 1 activities (A1, A2) and assessment design (A8)
**Repair instruction:** "The first half is entirely teacher-directed. Add one genuine choice point before the Arduino work. Add structured peer feedback during the sharing debrief."

**Concrete repair suggestions:**
1. **A2 (Research):** Let students choose 3 of the 6 materials to research in depth instead of all 6. Add prediction: "Rank these 6 materials from stiffest to most flexible. Justify your top and bottom choice." → bumps from `remember` to `apply` AND adds `choice_of_resource` agency.
2. **A4 (Data Collection):** After collecting data on one material as a group, let each group member take ownership of 2 materials (choose which ones). Add checkpoint: "Compare your first two measurements — what pattern do you see? What's your hypothesis about the next material?" → adds `strategy_reflection` agency.
3. **A8 (Share):** Replace informal sharing with structured peer feedback: groups rotate to view another group's device, give one "This design feature was clever because..." and one "Have you considered..." using sentence starters. → adds `peer_feedback` assessment + bumps to `collaborative`.

**Estimated post-repair scores:**
- Student Agency: 3.3 → ~5.0 (choice moments in first half + structured peer feedback)
- Cognitive Rigour: 6.9 → ~7.2 (prediction + hypothesis push two activities up a Bloom level)
- Teacher Craft: 5.9 → ~6.2 (sentence starters for feedback = scaffolding improvement)
- Overall: ~5.8 (above threshold, penalty shrinks because all dimensions >5.0)

---

## Verdict

The full PDF paints a richer picture than the web summary. This is a well-structured 3-session engineering activity with a genuine design cycle — not just a one-day lab. Students do get real creative freedom in Part 3 (bring your own materials, design your own device, iterate based on data). The engineering design process is explicitly taught and applied.

But the Pulse algorithm still correctly identifies the structural weakness: **the first 100 minutes (Parts 1-2) are entirely teacher-directed**, and student agency only kicks in during Part 3. A teacher reading this would recognise the pattern — "we need to get through the setup and data collection before we can let them loose." Pulse says: find a way to give them ownership earlier, even within the directed sections.

The unevenness penalty is doing its job: CR (6.9) and TC (5.9) are decent, but SA (3.3) drags the overall down and the spread creates a 0.76 penalty. A more balanced 5.5/5.5/5.5 lesson would score 5.5 overall — higher than this 6.9/3.3/5.9 lesson at 4.6. **Balance matters as much as peaks.**

For StudioLoom's generation pipeline, this revised test run confirms:
1. The algorithm differentiates genuinely — full PDF data moves scores but doesn't flip the diagnosis.
2. Student Agency remains the correct repair target (a teacher would agree).
3. The repair suggestions target the RIGHT activities (front half, not the already-strong design challenge).
4. Web search data was ~80% accurate for scoring — full content adds nuance but doesn't change the story. This matters for the AI pipeline: even imperfect activity extraction produces useful Pulse scores.
5. The 3-session format reveals a pattern the algorithm should track: **agency distribution over time**. Frontloading direction and backloading agency is common in engineering/science — Pulse could flag "agency doesn't appear until session 2/3" as a specific insight.
