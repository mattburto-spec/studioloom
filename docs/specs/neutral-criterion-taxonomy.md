# Neutral Criterion Taxonomy

**Status:** Spec — pre-Dimensions3 dependency
**Created:** 7 April 2026
**Depends on:** `src/lib/ai/framework-vocabulary.ts`, `src/lib/frameworks/index.ts`, `src/types/curriculum.ts`
**Consumed by:** Dimensions3 Stage 4 (Connective Tissue), FrameworkAdapter, FormatProfile.criterionMapping, activity_blocks.criterion_tags

---

## 1. Purpose

StudioLoom supports 8+ assessment frameworks (IB MYP, GCSE, A-Level, IGCSE, ACARA, PLTW, NESA, Victorian Curriculum) and 4 unit types (Design, Service, Personal Project, Inquiry). Each has its own criterion vocabulary — MYP says "Criterion A", GCSE says "AO1", ACARA says "KU strand".

The **neutral criterion taxonomy** is the canonical set of 8 framework-agnostic assessment categories that all framework-specific criteria map to. Content is stored and generated using neutral keys; framework-specific labels are applied at render time by the `FrameworkAdapter`.

This spec defines:
1. The 8 neutral categories with precise definitions
2. Bidirectional mapping tables for every supported framework
3. Mapping tables for non-design unit types (Service IPARD, Personal Project, Inquiry)
4. Rules for ambiguous/overlapping mappings
5. The FrameworkAdapter API contract

---

## 2. The 8 Neutral Categories

| Key | Label | Definition | Bloom Range |
|-----|-------|-----------|-------------|
| `researching` | Researching | Gathering information: interviews, surveys, source analysis, existing product analysis, literature review, field observation | Remember–Understand |
| `analysing` | Analysing | Making sense of gathered information: identifying patterns, comparing/contrasting, drawing conclusions from data, needs assessment, root cause analysis | Understand–Analyse |
| `designing` | Designing | Generating and developing solutions: ideation, specification writing, concept development, prototyping plans, selecting and justifying approaches | Apply–Create |
| `creating` | Creating | Making/building/producing: physical prototyping, digital production, implementing plans, fabrication, coding, hands-on construction | Apply–Create |
| `evaluating` | Evaluating | Testing and judging quality: testing against criteria, peer review, self-assessment, fitness-for-purpose analysis, impact measurement | Evaluate |
| `reflecting` | Reflecting | Metacognitive review: process reflection, learning transfer, growth identification, what-went-well/even-better-if, personal development | Evaluate–Create |
| `communicating` | Communicating | Presenting and sharing: oral presentation, written reports, visual documentation, portfolio assembly, audience-appropriate communication, demonstration | Apply–Evaluate |
| `planning` | Planning | Organising and managing: timeline creation, resource identification, task sequencing, goal setting, risk assessment, project management | Apply–Analyse |

### 2.1 Why 8 Categories

8 is the minimum that covers all frameworks without lossy mapping:

- `researching` and `analysing` must be separate because some frameworks combine them (MYP Criterion A = research + analysis) while others split them (GCSE AO1 = investigate only, AO3 = analyse + evaluate). Merging them would lose information when mapping to frameworks that separate them.
- `reflecting` must be separate from `evaluating` because Service Learning and Personal Project treat continuous reflection as a distinct assessed skill, not just a subset of product evaluation.
- `planning` must be separate because Personal Project assesses planning explicitly (PP Criterion A includes planning), and Service Learning's "Prepare" phase is primarily planning.
- `communicating` must be separate because PLTW's "Present & Defend" and PP's "Report" phase are pure communication skills assessed independently.

---

## 3. Design Framework Mappings

### 3.1 IB MYP Design (4 criteria → 8 neutral)

| MYP Criterion | Neutral Keys | Mapping Notes |
|--------------|-------------|--------------|
| **A — Inquiring & Analysing** | `researching` + `analysing` | Strands i–ii = researching (explain need, identify/prioritise research), strands iii–iv = analysing (analyse existing products, develop brief) |
| **B — Developing Ideas** | `designing` + `planning` | Strands i–ii = designing (develop specifications, generate ideas), strands iii–iv = designing + planning (present chosen design, justify) |
| **C — Creating the Solution** | `creating` + `planning` | Strands i–ii = planning (develop plan, demonstrate technical skills), strands iii–iv = creating (follow plan, explain changes, present solution) |
| **D — Evaluating** | `evaluating` + `reflecting` | Strands i–ii = evaluating (test against specifications), strands iii–iv = reflecting (explain impact, reflect on own development) |

**Reverse mapping (neutral → MYP):**

| Neutral Key | Primary MYP Criterion | Secondary |
|------------|----------------------|-----------|
| `researching` | A | — |
| `analysing` | A | — |
| `designing` | B | — |
| `creating` | C | — |
| `evaluating` | D | — |
| `reflecting` | D | — |
| `communicating` | — (implicit across all) | A, D |
| `planning` | C | B |

### 3.2 GCSE Design & Technology (4 AOs → 8 neutral)

| GCSE AO | Neutral Keys | Mapping Notes |
|---------|-------------|--------------|
| **AO1 — Identify, investigate, outline** (10%, NEA) | `researching` | Pure investigation and identification of design possibilities |
| **AO2 — Design and make prototypes** (30%, NEA) | `designing` + `creating` | Design development AND physical making in one AO |
| **AO3 — Analyse and evaluate** (20%, split) | `analysing` + `evaluating` | Analysis of decisions AND evaluation of outcomes |
| **AO4 — Technical principles** (40%, exam) | `analysing` | Theoretical knowledge of materials, systems, processes — tested in exam, not coursework |

**Note:** GCSE AO4 (exam-only) maps to `analysing` but is never used in generation — it tests recall/understanding of technical content via written exam, not through lesson activities. The generation pipeline should tag AO4-aligned activities as `analysing` but label them distinctly in the FrameworkAdapter as "(exam prep)" context.

### 3.3 A-Level Design & Technology (3 components → 8 neutral)

| A-Level Component | Neutral Keys | Mapping Notes |
|------------------|-------------|--------------|
| **C1 — Technical Principles** (exam) | `analysing` | Theoretical understanding — exam only |
| **C2 — Designing & Making Principles** (exam) | `analysing` + `designing` | Applied knowledge — exam only |
| **C3 — Design and Make Task** (NEA) | `researching` + `designing` + `creating` + `evaluating` | Full design cycle in coursework |

**Note:** A-Level C3 maps to 4 neutral keys because the NEA is a complete project. For generation purposes, the activity's phase within the unit determines which neutral key is primary. C1 and C2 are exam-only and rarely appear in lesson generation.

### 3.4 Cambridge IGCSE Design & Technology (3 AOs → 8 neutral)

| IGCSE AO | Neutral Keys | Mapping Notes |
|----------|-------------|--------------|
| **AO1 — Recall and understanding** | `analysing` | Knowledge-focused, similar to GCSE AO4 |
| **AO2 — Handling info & problem solving** | `researching` + `analysing` + `designing` | Broad problem-solving skills |
| **AO3 — Design and making skills** | `designing` + `creating` + `evaluating` | Full practical cycle |

### 3.5 ACARA Design & Technologies (2 strands → 8 neutral)

| ACARA Strand | Neutral Keys | Mapping Notes |
|-------------|-------------|--------------|
| **KU — Knowledge & Understanding** | `analysing` + `researching` | Technologies and society + materials + systems understanding |
| **PPS — Processes & Production Skills** | `researching` + `designing` + `creating` + `evaluating` | Full design cycle: investigating, generating, producing, evaluating |

**Note:** ACARA's broad 2-strand structure means both strands map to multiple neutral keys. Activity-level tagging is more granular than the strand structure — a single lesson typically addresses both strands.

### 3.6 PLTW (4 rubric dimensions → 8 neutral)

| PLTW Dimension | Neutral Keys | Mapping Notes |
|---------------|-------------|--------------|
| **Design** | `researching` + `analysing` + `designing` | Defining problems, generating concepts, developing solutions |
| **Build** | `creating` + `planning` | Constructing, fabricating, iterating physical solutions |
| **Test** | `evaluating` + `analysing` | Testing against requirements, analysing results |
| **Present** | `communicating` + `reflecting` | Engineering notebook, oral defence, documentation |

### 3.7 NESA NSW Design & Technology (3 outcomes → 8 neutral)

| NESA Outcome | Neutral Keys | Mapping Notes |
|-------------|-------------|--------------|
| **DP — Design Process** | `researching` + `designing` + `communicating` | Investigating, generating, communicating design ideas |
| **Pr — Producing** | `creating` + `planning` | Selecting tools/materials, managing production |
| **Ev — Evaluating** | `evaluating` + `reflecting` | Testing, analysing, reflecting on design solutions |

### 3.8 Victorian Curriculum D&T (3 strands → 8 neutral)

| VIC Strand | Neutral Keys | Mapping Notes |
|-----------|-------------|--------------|
| **TS — Technologies & Society** | `analysing` + `researching` | How people use technologies, impacts, ethics |
| **TC — Technological Contexts** | `analysing` | Properties of technologies, materials, systems |
| **CDS — Creating Design Solutions** | `researching` + `designing` + `creating` + `evaluating` | Full design cycle |

---

## 4. Non-Design Unit Type Mappings

These mappings define how the 8 neutral keys apply to unit types that don't follow a traditional design cycle.

### 4.1 Service Learning (IPARD Cycle)

| IPARD Phase | Primary Neutral Keys | Secondary | Notes |
|------------|---------------------|-----------|-------|
| **Investigate** | `researching` + `analysing` | — | Community needs assessment, stakeholder analysis, root cause identification |
| **Prepare** | `planning` + `designing` | `communicating` | Goal setting, action planning, resource identification, partnership development |
| **Act** | `creating` + `communicating` | `planning` | Implementing the service action, adapting plans, community collaboration |
| **Reflect** | `reflecting` + `evaluating` | — | Continuous reflection on learning, impact, personal growth |
| **Demonstrate** | `communicating` + `evaluating` | `reflecting` | Presenting impact, sharing evidence, planning sustainability |

**Key difference from design:** `reflecting` appears in every phase (continuous reflection), not just at the end. `creating` in Service context means implementing action, not physical fabrication.

**Criterion groupings for Service assessment:**

| Service Assessment Group | Neutral Keys |
|-------------------------|-------------|
| Investigation & Analysis | `researching` + `analysing` |
| Planning & Action | `planning` + `creating` |
| Reflection & Growth | `reflecting` + `evaluating` |
| Communication & Impact | `communicating` |

### 4.2 Personal Project (PP Process)

| PP Phase | Primary Neutral Keys | Secondary | Notes |
|---------|---------------------|-----------|-------|
| **Defining** | `researching` + `planning` | `analysing` | Choose topic, set goal, establish success criteria, identify prior knowledge |
| **Planning** | `planning` + `designing` | — | Detailed plan with timeline, resources, process journal structure |
| **Applying Skills** | `creating` + `researching` | `communicating` | ATL skill application, product development, process documentation |
| **Reflecting** | `reflecting` + `evaluating` | — | Evaluate product/outcome, reflect on ATL development, assess success criteria |
| **Reporting** | `communicating` + `reflecting` | — | Write report, present project, document evidence |

**Key difference from design:** `planning` is heavily weighted (PP Criterion A explicitly assesses planning). `reflecting` appears in every phase (milestone-based reflection). The "product" can be non-physical (a film, an event, a website, a piece of writing).

**PP assessment maps to 3 MYP criteria (A, B, C):**

| PP Criterion | Neutral Keys |
|-------------|-------------|
| **A — Planning** | `researching` + `planning` + `designing` |
| **B — Applying Skills** | `creating` + `communicating` + `analysing` |
| **C — Reflecting** | `reflecting` + `evaluating` + `communicating` |

### 4.3 Inquiry Unit (Wonder–Explore–Create–Share)

| Inquiry Phase | Primary Neutral Keys | Secondary | Notes |
|-------------|---------------------|-----------|-------|
| **Wondering** | `researching` | `analysing` | Question generation, prior knowledge activation, curiosity building |
| **Exploring** | `researching` + `analysing` | — | Investigation, evidence gathering, experiments, multiple perspectives |
| **Creating** | `creating` + `designing` | `communicating` | Synthesise findings, create to show understanding |
| **Sharing** | `communicating` + `evaluating` | `reflecting` | Present learning, give/receive feedback, reflect on growth |

**Key difference from design:** `researching` is the dominant key (appears in 3 of 4 phases). `creating` in Inquiry context means creating to demonstrate understanding, not physical product creation. Inquiry doesn't formally assess the product — it assesses the thinking.

---

## 5. Ambiguity Rules

When a single activity could map to multiple neutral keys, use these precedence rules:

1. **Phase context wins over content.** An activity in the "Investigate" phase that involves writing maps to `researching` + `communicating`, not just `communicating`.

2. **Primary key is the one being assessed.** If a student writes a research report, the primary key is `researching` (that's what's assessed), with `communicating` as secondary.

3. **Maximum 3 neutral keys per activity.** If you need more than 3, the activity is too broad and should be split.

4. **First key in the array is the primary.** `criterion_tags: ["researching", "communicating"]` means primarily researching, secondarily communicating. Grading weights the first key.

5. **Exam-only criteria are tagged but flagged.** GCSE AO4, A-Level C1/C2 activities should be tagged with the neutral key + a `context: "exam_prep"` qualifier so they render differently in the student view.

6. **Implicit communication is not tagged.** Every activity involves some communication. Only tag `communicating` when communication IS the assessed skill (presentations, reports, documentation tasks).

---

## 6. FrameworkAdapter API Contract

The FrameworkAdapter is a pure function library — no database, no side effects, no API calls. It maps neutral keys to framework-specific display text at render time.

```typescript
// Core interface
interface FrameworkAdapter {
  /** Map neutral key → framework display label */
  toLabel(neutralKey: string, frameworkId: string): string;
  // e.g., toLabel("researching", "IB_MYP") → "Criterion A"
  // e.g., toLabel("researching", "GCSE_DT") → "AO1"

  /** Map framework label → neutral key(s) */
  fromLabel(frameworkLabel: string, frameworkId: string): string[];
  // e.g., fromLabel("A", "IB_MYP") → ["researching", "analysing"]
  // e.g., fromLabel("AO2", "GCSE_DT") → ["designing", "creating"]

  /** Get all criterion labels for a framework */
  getCriterionLabels(frameworkId: string): { key: string; label: string; neutralKeys: string[] }[];

  /** Group neutral keys into framework assessment groups */
  getAssessmentGroups(frameworkId: string): Record<string, string[]>;
  // e.g., for MYP: { "A": ["researching","analysing"], "B": ["designing","planning"], ... }

  /** Get the display name for a neutral key (framework-independent) */
  getNeutralLabel(neutralKey: string): string;
  // e.g., "Researching", "Analysing", "Designing"
}
```

### 6.1 Render Rules

1. **Student lesson page:** Show framework-specific labels. "Criterion A: Inquiring & Analysing" for MYP students, "AO1" for GCSE students. Never show neutral keys to students.

2. **Teacher lesson editor:** Show both. "researching (→ Criterion A)" so teachers understand the mapping.

3. **Activity blocks in the library:** Show neutral keys only. Blocks are framework-agnostic — they work across any framework.

4. **Generation prompts:** Use neutral keys. The AI generates using neutral vocabulary; the FrameworkAdapter converts at render time.

5. **Grading pages:** Show framework-specific labels with neutral key tooltips.

---

## 7. Migration Path

### 7.1 Existing Content

Current `criterionTags` on activities use framework-specific keys: `["A", "B"]` for MYP, `["AO1"]` for GCSE. These need backfilling to neutral keys.

**Strategy:** Write a one-time migration script that:
1. Reads `content_data` JSONB from all units
2. Detects the framework from `classes.framework` (or falls back to MYP)
3. Maps existing `criterionTags` to neutral keys using the reverse mapping tables above
4. Writes neutral keys to a new `neutral_criterion_tags` field (additive — keep old tags for backward compatibility)
5. New generated content writes neutral keys from day one

### 7.2 Activity Blocks

The `activity_blocks.criterion_tags` column (TEXT[]) should store neutral keys only. Blocks extracted from existing units undergo the same framework-to-neutral conversion during extraction.

### 7.3 Grading Data

Existing grades use framework-specific criterion keys. The grading system needs a thin adapter layer that converts neutral keys to framework keys when reading/writing grade data. This is a display concern, not a data migration — grades continue to store framework keys because they're framework-specific assessments.

---

## 8. Open Questions

1. **Should `designing` split into `ideating` + `specifying`?** MYP Criterion B has both idea generation (divergent) and specification writing (convergent). Currently merged. Split only if a framework assesses them separately. No current framework does — defer.

2. **Custom framework criterion mapping:** When the Custom FormatProfile system (Dimensions3 §14.9.1) ships, custom formats will need to define their own criterion mapping via the Format Builder wizard (step 9). The 8 neutral keys are fixed — custom formats pick which keys they use and define groupings.

3. **Exam-prep activity handling:** GCSE AO4 and A-Level C1/C2 are exam-only. Should the generation pipeline even create activities for these? Current thinking: yes, but tagged with `context: "exam_prep"` and rendered with a distinct visual treatment. Teachers can toggle exam prep content on/off per unit.
