# Student Learning Intelligence Architecture
**Date:** 18 March 2026 | **Status:** Architecture document
**Purpose:** Defines how StudioLoom builds a learning profile for each student over time, and how the AI uses it.

---

## The Core Insight

StudioLoom already captures 80% of the data needed for AI-powered student learning profiles. The bottleneck isn't data collection — it's **synthesis and retrieval**.

Currently captured but never connected:
- Conversation transcripts (Bloom's level, effort scores, question types)
- Assessment grades (criterion scores, tags, comments)
- Tool work snapshots (ideas, reasoning, quality signals)
- Portfolio entries (reflections, photos, iterations)
- Time spent per page
- AI usage frequency

**What's missing is a single "student view" that connects these four data streams into a learning profile the AI can read.**

---

## What Exists Today

| Data Source | Table | Captured | Analysed? |
|-------------|-------|----------|-----------|
| Page completion + responses | `student_progress` | Status, time_spent, responses (JSONB) | Status only — responses never analysed |
| Design Assistant conversations | `design_conversations` + turns | Full transcript, Bloom's level, effort score, question types | Stored but never aggregated across conversations |
| Portfolio entries | `portfolio_entries` | Text, photos, links, tool summaries, "mistake" entries | Visible to student — never quality-assessed |
| Toolkit tool sessions | `student_tool_sessions` | Full tool state (JSONB), versions, AI summaries | Versions tracked — no quality delta computed |
| Teacher assessments | `assessment_records` | Criterion scores (1-8), tags, comments, targets | Per-unit only — no cross-unit trends |
| AI usage | `ai_usage_log` | Tokens, endpoint, model, cost | For billing — never correlated with outcomes |

### Type Exists But Not Wired

`StudentLearningProfile` is defined in `src/types/assessment.ts` (lines 224-267) but has zero database implementation, zero UI, zero data collection. It includes SEN provisions, tool certifications, software proficiency, criterion history, cognitive profile, learning preferences, accessibility needs, engagement patterns, interests, and pastoral notes.

---

## The Student Learning Profile (What to Build)

### Phase A: Foundation (Wire existing type to database)

Create `student_learning_profiles` table with JSONB `profile_data`. Auto-populate from existing data.

```typescript
interface StudentLearningProfile {
  studentId: string;

  // === TEACHER-ENTERED (from existing type) ===
  senProvisions?: { type: string; strategies: string[] }[];
  toolCertifications?: { tool: string; level: string; expires?: string }[];
  softwareProficiency?: Record<string, "novice" | "competent" | "proficient" | "expert">;
  interests?: string[];
  accessibilityNeeds?: string[];
  pastoralNotes?: string;

  // === AUTO-COMPUTED (from existing data) ===
  criterionHistory: Array<{
    criterion: string;
    scores: Array<{ unitId: string; level: number; date: string }>;
    trend: "improving" | "stable" | "declining";
    averageLevel: number;
  }>;

  engagementProfile: {
    conversationsPerUnit: number;
    portfolioEntriesPerUnit: number;
    toolsAttempted: string[];
    averageTimePerPage: number;
    aiDependency: "low" | "moderate" | "high";  // conversations per page
  };

  cognitiveProfile: {
    typicalBloomLevel: number;  // average from conversations
    scaffoldingNeed: "heavy" | "moderate" | "light" | "minimal";
    effortConsistency: "consistent" | "variable" | "declining";
  };

  // === META ===
  confidenceLevel: "cold_start" | "learning" | "established";
  lastUpdated: string;
}
```

### Phase B: Passive Signal Collection (auto-enrich from existing data)

No new data collection needed — just computation from existing tables:

1. **Criterion Trends:** Query `assessment_records` across units → compute per-criterion trend
2. **Engagement Heuristics:** Count conversations, portfolio entries, tool sessions per unit
3. **Cognitive Profile:** Average Bloom's level from `design_conversation_turns`
4. **Effort Consistency:** Track effort_score trajectory across conversations
5. **AI Dependency:** High conversation count per page = possible dependency (or thoroughness — needs teacher interpretation)

### Phase C: Exemplar-Aware Assessment

1. Teacher uploads student work → tags with achievement level (1-8) and criterion
2. During grading, system shows "exemplars at this level" for calibration
3. Track which exemplars teachers reference → learn what "level 6" looks like for this school

### Phase D: AI Grading Loop

1. AI reads student responses + tool work + portfolio → suggests criterion scores
2. Teacher reviews, accepts/modifies
3. Delta between AI suggestion and teacher decision = learning signal
4. System improves suggestions over time

---

## How the AI Uses Student Profiles

### In Student Design Assistant

When a student asks for help, the AI gets:
```
<student_context>
Criterion A trend: improving (3 → 5 → 6 over last 3 units)
Criterion B trend: stable (4, 4, 5)
Engagement: high (7 conversations per unit, 12 portfolio entries)
Cognitive level: typically Apply/Analyse (Bloom 3-4)
Scaffolding need: moderate
This student is strong at research but struggles with ideation.
Recent target from teacher: "Push for more creative, unconventional ideas in Criterion B"
</student_context>
```

The AI adapts:
- Pushes harder on Criterion B (the declining area)
- Celebrates Criterion A progress
- Uses questions at Bloom 4-5 (their proven capability + stretch)
- When they're stuck on ideation, suggests tools (SCAMPER, Reverse Brainstorm)

### In Unit Generation (Teacher Side)

When a teacher generates a unit for a class, the AI gets:
```
<class_context>
24 students. Average Criterion A: 4.8, B: 4.2, C: 5.1, D: 3.9
3 students flagged as declining on Criterion D (evaluation)
5 students have SEN provisions (2 ADHD, 1 dyslexia, 2 EAL)
Class strength: making/prototyping. Class gap: evaluation/reflection.
</class_context>
```

The AI generates a unit that:
- Includes more evaluation scaffolding (extra reflection prompts, peer critique protocols)
- Provides multiple scaffolding tiers (for SEN students)
- Builds on the class strength in making
- Includes adapted tools for EAL students (visual supports, simplified instructions)

### In Grading (Teacher Side)

When the teacher grades a student, the AI shows:
- "This student scored 5 on Criterion A last unit. Their work this unit shows [specific evidence]."
- "Exemplars at level 6 for Criterion A typically include [comparison]."
- "Suggested level: 6 (based on response quality, tool work depth, and class comparison)."

---

## Data Signals That Drive Profile Updates

| Signal | Source | Updates | Frequency |
|--------|--------|---------|-----------|
| Teacher enters assessment | `assessment_records` INSERT | criterionHistory, trend | Per unit (4-6 per year) |
| Student completes page | `student_progress` UPDATE | engagementProfile.averageTimePerPage | Real-time |
| Student uses Design Assistant | `design_conversations` INSERT | cognitiveProfile, engagementProfile | Real-time |
| Student saves tool session | `student_tool_sessions` INSERT | engagementProfile.toolsAttempted | Real-time |
| Student adds portfolio entry | `portfolio_entries` INSERT | engagementProfile.portfolioEntriesPerUnit | Real-time |
| Teacher edits SEN/certs | Direct profile update | senProvisions, toolCertifications | Manual |

---

## Build Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Create `student_learning_profiles` table + CRUD API | 1 day | Foundation for everything |
| 2 | Auto-compute criterion trends from assessment_records | 1 day | Instant value for teachers |
| 3 | Teacher UI for SEN/certifications/interests | 1 day | Enables accessibility support |
| 4 | Passive signal collection (Phase B aggregation) | 2 days | Profile auto-enriches |
| 5 | Inject student context into Design Assistant | 1 day | Personalized mentoring |
| 6 | Inject class context into unit generation | 1 day | Adaptive unit design |
| 7 | Exemplar tagging + retrieval (Phase C) | 2 days | Calibrated grading |
| 8 | AI grading suggestions (Phase D) | 3 days | Transforms assessment |

---

## Sources

- Hattie, J. (2009). Visible Learning. Routledge. (Effect sizes for feedback, formative assessment)
- Black, P. & Wiliam, D. (1998). Inside the Black Box. King's College London. (Formative assessment)
- IB MYP Design Guide (2021). Assessment criteria descriptors.
- StudioLoom codebase analysis (18 March 2026). Existing data structures and gaps.
