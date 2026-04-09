# Questerra / StudioLoom — Documentation Index

## Directory Structure

```
docs/
  loominary-os/         Loominary OS platform layer (25 services, interfaces, mapping)
  brain/                AI intelligence system docs (corpus, patterns, architecture)
  projects/             Active project plans and tracking docs
  specs/                Feature specifications and PRDs
  research/             Research papers, influence factors, data tables
  testing/              Test checklists, dashboards, QA tracking
  prototypes/           HTML prototypes for UI iteration
  ideas/                Feature brainstorms and concept docs
  open studio/          Open Studio feature docs
  safety/               Safety badge system docs
  Newmetrics/           Melbourne Metrics materials
  design/               Visual design references
  components/           Component-level documentation
  lesson plans/         Example lesson plans for validation
  marketing/            Marketing materials
  showcase/             Showcase/demo materials
  archive/
    session-reports/    Build completion reports (historical)
    superseded/         Replaced/outdated docs
  products/
    studioloom/         (future) StudioLoom-specific strategy docs
    makloom/            (future) Makloom product docs
  adr/                  (future) Architecture Decision Records
```

## Key Files (docs root)

| File | Purpose |
|------|---------|
| `roadmap.md` | **THE canonical roadmap** — all phases, priorities, current sprint |
| `quarantine.md` | Active pipeline quarantine register (42 sealed entry points) |
| `design-guidelines.md` | 42 design principles, feeds dashboard Guidelines tab |
| `education-ai-patterns.md` | 5 core AI patterns for student-facing tools |
| `design-teaching-corpus.md` | Layer 1: what great design teaching looks like |
| `timing-reference.md` | Learning-based timing model, cognitive load curves |
| `lesson-timing-research-report.md` | Workshop Model research (25+ sources) |
| `optimization-plan.md` | Performance optimization tracking |
| `architecture.md` | High-level system architecture |

## Loominary OS (`loominary-os/`)

The OS-level architecture powering the Loominary product family. See [`loominary-os/README.md`](loominary-os/README.md).

## AI Brain (`brain/`)

The intelligence system that makes StudioLoom more than a template generator. These docs define how the AI thinks about design teaching.

| File | Read before... |
|------|---------------|
| `ai-intelligence-architecture.md` | ANY AI system changes |
| `design-teaching-corpus.md` | Changing AI prompts or educational content |
| `education-ai-patterns.md` | Building interactive toolkit tools or student AI |
| `lesson-timing-research-report.md` | Touching timing logic or generation prompts |
| `student-learning-intelligence.md` | Building student profiling or adaptive AI |
| `timing-reference.md` | Touching timing logic or generation prompts |
| `design-guidelines.md` | Establishing new UI patterns or design decisions |
| `ai-systems-audit-2026-03.md` | File-by-file AI system findings |
| `ai-touchpoints-summary.md` | Understanding where AI touches the platform |

## Active Projects (`projects/`)

Each project gets its own tracking doc. See `projects/README.md` for the full list.

Key active projects:
- `dimensions3.md` — Generation Pipeline Rebuild (THE NEXT BUILD)
- `3delements.md` — 3D Visual & Gamification Layer (vision doc)
- `lesson-pulse.md` — Lesson quality scoring algorithm

## Testing (`testing/`)

| File | Covers |
|------|--------|
| `testing-dashboard.html` | Self-contained QA tracker (65 test cases, P0-P2) |
| `nm-test-checklist.md` | Melbourne Metrics testing |
| `open-studio-test-checklist.md` | Open Studio feature testing |
| `timing-engine-test-checklist.md` | Lesson timing validation |
| `toolkit-testing-quick-start.md` | Interactive toolkit tool testing |

## Archive

- `archive/session-reports/` — Build completion summaries from past sessions
- `archive/superseded/` — Docs replaced by newer versions (Open Studio concept, engine overhaul plan, etc.)
