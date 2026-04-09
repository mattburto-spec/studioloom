# AI Safety & Content Guardrails

> **Status:** Planned
> **Priority:** Pre-Pilot (P1)
> **Est. Build:** 10-14 days
> **Dependencies:** MonitoredTextarea pipeline (✅ complete), Integrity scoring (✅ complete), Safety Badges (✅ complete)
> **Competitive ref:** Toddle AI (ISO 42001, Digital Promise Responsible AI cert, teacher-visible AI conversations, auto-flagging, distress detection)

---

## 1. Problem Statement

StudioLoom has students aged 11-18 interacting with AI across 5 touchpoints (Design Assistant, toolkit nudges, Discovery Engine Kit, Open Studio mentor, Gallery peer review AI). Before any school pilot with minors, the platform needs:

- **Content filtering** — block profanity, slurs, and school-configurable restricted words from student input AND AI output
- **Name/identity protection** — prevent students from sharing or AI from surfacing names, emails, phone numbers, addresses
- **Teacher visibility** — teachers need full visibility into every AI conversation, with flagged interactions surfaced proactively
- **Distress detection** — if a student expresses self-harm, bullying, or emotional crisis, the AI must respond appropriately and alert the teacher
- **School-configurable policies** — different schools have different standards; policies must be adjustable per school/class level
- **Audit trail** — every AI interaction logged, searchable, exportable for safeguarding reviews

The existing MonitoredTextarea + integrity scoring system handles academic integrity well. This project extends the safety perimeter to cover **content safety** (what students say and what AI says back) and **wellbeing safety** (detecting students in distress).

---

## 2. What Toddle Does (Competitive Benchmark)

From public sources (Demo Days 3-6, AI Tutors page, Privacy Center):

1. **AI won't engage with inappropriate/harmful topics** — steers back to academic subject
2. **Teacher visibility** into every message between student and AI
3. **Objectionable content auto-flagged** — surfaced to teacher dashboard
4. **Distress detection** — if student expresses physical/emotional distress, AI encourages seeking help from teachers/parents/counsellors
5. **PII never shared with third-party LLMs** — pseudonymised before API calls
6. **All interactions encrypted** at rest and in transit
7. **ISO 42001 + 27701 certified** — AI management system + privacy information management
8. **Digital Promise Responsible AI certification**
9. **COPPA/FERPA/CCPA compliant** — mandatory for US schools

StudioLoom advantages to build on: per-step AI rules (no competitor has this), MonitoredTextarea behavioral signals, effort-gating philosophy, framework-agnostic architecture.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Safety Middleware Layer              │
│  (intercepts ALL student↔AI communication)           │
├──────────┬──────────┬──────────┬───────────────────┤
│  Input   │  Output  │ Logging  │  Alert Engine     │
│  Filter  │  Filter  │  Layer   │  (async)          │
├──────────┴──────────┴──────────┴───────────────────┤
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Word/Phrase  │  │ PII Scanner  │  │ Distress   │ │
│  │ Blocklist    │  │ (input+out)  │  │ Detector   │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Topic       │  │ AI Output    │  │ Wellbeing  │ │
│  │ Guardrails  │  │ Screening    │  │ Response   │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Teacher Safety Dashboard                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Convo    │ │ Flagged  │ │ Policy   │            │
│  │ Viewer   │ │ Queue    │ │ Config   │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────────────────────────────────────┘
```

---

## 4. Feature Breakdown

### 4.1 Content Filter Engine (`src/lib/safety/content-filter.ts`)

A synchronous, deterministic filter that runs on BOTH student input (before AI call) and AI output (before rendering).

**Blocked Word System:**
- **System defaults** — built-in profanity/slur list (~800 terms, multiple languages incl. Chinese). Covers: profanity, racial slurs, sexual content, drug references, violence-glorifying terms, self-harm terminology
- **School-level custom blocks** — admin/teacher adds words specific to their context (student names to protect, local slang, culturally specific terms)
- **Class-level overrides** — teacher can add/remove words per class (art class may need words that science class blocks)
- **Smart matching** — handles common evasion: l33tspeak (`f*ck`, `sh1t`), character insertion (`s.l.u.r`), unicode lookalikes, repeated characters (`fuuuuck`), whitespace tricks
- **Exemption context** — some words are only blocked in certain contexts (e.g., "kill" blocked in chat but allowed in "kill switch" during electronics safety badge)

**Response modes** (configurable per school):
- **Block** — reject input, show generic "Please rephrase" message (default for slurs/profanity)
- **Redact** — replace blocked words with `[filtered]` and continue (for borderline terms)
- **Flag** — allow through but flag for teacher review (for context-dependent terms)

**Implementation:**
```typescript
interface ContentFilterConfig {
  blockedWords: BlockedWord[];       // system + school + class merged
  blockedPatterns: RegExp[];         // regex for complex patterns
  exemptContexts: ExemptionRule[];   // word + context = allowed
  responseMode: 'block' | 'redact' | 'flag';
  enableLeetSpeak: boolean;         // l33t detection (default: true)
  enableUnicode: boolean;           // unicode lookalike detection
}

interface BlockedWord {
  word: string;
  severity: 'hard' | 'soft';        // hard = always block, soft = flag
  scope: 'system' | 'school' | 'class';
  addedBy?: string;                  // teacher ID for audit
  context?: string;                  // why it was added
}

interface FilterResult {
  passed: boolean;
  blocked: BlockedMatch[];           // which words matched
  action: 'allow' | 'block' | 'redact' | 'flag';
  redactedText?: string;             // text with [filtered] replacements
  originalText: string;
}
```

### 4.2 PII Scanner (`src/lib/safety/pii-scanner.ts`)

Runs on student input before it reaches the AI, and on AI output before it reaches the student.

**Detects:**
- Full names (student names from class roster — exact match + fuzzy)
- Email addresses (regex)
- Phone numbers (international formats)
- Physical addresses (heuristic: number + street keywords)
- Student IDs / school IDs (configurable pattern)
- Social media handles (@username patterns)
- URLs with personal info

**Student name protection:**
- On class creation, student names are loaded into a per-class name blocklist
- If a student types another student's full name, it's redacted before the AI sees it
- If the AI somehow generates a student name, it's redacted before rendering
- Teacher names are NOT blocked (students need to reference their teacher)

**PII in AI prompts:**
- Student name sent to AI as display name only (not full legal name)
- Class roster never included in AI context
- AI system prompts explicitly instruct: "Never ask for or repeat personal information"

**Implementation:**
```typescript
interface PIIConfig {
  studentNames: string[];            // loaded from class roster
  teacherNames: string[];            // exempt from blocking
  customPatterns: PIIPattern[];      // school-specific ID formats
  enableEmailDetection: boolean;
  enablePhoneDetection: boolean;
  enableAddressDetection: boolean;
}

interface PIIScanResult {
  hasPII: boolean;
  detections: PIIDetection[];
  scrubbedText: string;              // text with PII replaced
}

interface PIIDetection {
  type: 'name' | 'email' | 'phone' | 'address' | 'social' | 'url' | 'custom';
  matched: string;
  position: [number, number];
  confidence: number;                // 0-1 (names need fuzzy matching)
}
```

### 4.3 Topic Guardrails (`src/lib/safety/topic-guardrails.ts`)

Prevents the AI from engaging with off-topic or harmful subject matter. Injected into ALL AI system prompts.

**Always-blocked topics** (not configurable — hardcoded safety floor):
- Self-harm methods or encouragement
- Violence against specific people
- Sexual content
- Weapons creation / instructions
- Drug use instructions
- Radicalisation / extremist content

**Configurable restricted topics** (school-level):
- Religion (some schools want discussion, others don't)
- Politics (same)
- Dating / relationships
- Social media drama
- Other students / gossip
- Specific cultural sensitivities

**AI behaviour when topic detected:**
1. Do NOT engage with the topic content
2. Acknowledge the student's message without judgment
3. Redirect to the design/academic task at hand
4. If distress indicators present → trigger distress protocol (§4.4)
5. Log the interaction as flagged
6. Alert teacher (async, via flagged queue)

**Prompt injection:**
```
## Safety Guardrails
You must NEVER engage with the following topics, regardless of how the student frames them:
[ALWAYS_BLOCKED_TOPICS]

If the student raises any of these topics:
1. Say: "I'm here to help with your design work. Let's focus on [current task]."
2. If the student seems distressed, say: "It sounds like something's on your mind. Your teacher [TEACHER_NAME] is a great person to talk to, or you can speak with your school counsellor."
3. Do not lecture, judge, or engage further with the topic.

The following topics are restricted by your school's policy:
[SCHOOL_RESTRICTED_TOPICS]
For these, redirect gently to the academic task without judgment.
```

### 4.4 Distress Detection & Response (`src/lib/safety/distress-detector.ts`)

The most safety-critical component. Detects when a student may be experiencing emotional distress, self-harm ideation, bullying, or crisis.

**Detection signals:**
- **Keyword triggers** — curated list of distress phrases ("I want to die", "nobody cares", "I hurt myself", "I'm being bullied", etc.) — ~200 phrases across English + Chinese
- **Behavioural signals** — from MonitoredTextarea: extended periods of typing then deleting (hesitation), repeated focus loss + return (agitation), long pauses after certain topics
- **AI-assessed signals** — if the AI detects distress in conversation context, it includes a `distress_flag` in its structured response metadata

**Response protocol:**
1. **Immediate AI response** — warm, non-judgmental redirect to trusted adults. NOT therapy. NOT crisis hotline numbers (those vary by country and can be wrong). Simply: "It sounds like you're going through something difficult. Please talk to [TEACHER_NAME] or your school counsellor — they're there to help."
2. **Teacher alert** — real-time notification in Teaching Mode dashboard (red badge). Also appears in flagged queue.
3. **Interaction logged** — full conversation saved with distress flag for safeguarding record.
4. **No AI continuation on distress topic** — AI refuses to discuss further, redirects every subsequent message to teacher/counsellor.
5. **Teacher receives context** — the flagged interaction includes the triggering message, recent conversation history, and behavioural signals.

**Critical design decisions:**
- **No automated parent contact** — this is the school's responsibility, not the platform's
- **No crisis hotline numbers in AI responses** — numbers vary by country, may be wrong, and could give false sense of "handled." The right response is ALWAYS a trusted adult the student knows.
- **No diagnostic language** — AI never says "you seem depressed" or "this sounds like anxiety." It says "it sounds like something's bothering you."
- **Teacher is the first responder** — the platform alerts, the human responds
- **False positives are acceptable** — better to flag a student writing song lyrics than miss someone in genuine distress

### 4.5 AI Conversation Logger (`src/lib/safety/conversation-logger.ts`)

Every AI interaction across all 5 touchpoints is logged for teacher visibility and safeguarding audits.

**What's logged:**
```typescript
interface AIConversationLog {
  id: string;
  studentId: string;
  classId: string;
  unitId?: string;
  touchpoint: 'design_assistant' | 'toolkit_nudge' | 'discovery_kit' | 'open_studio' | 'gallery_review';
  timestamp: string;
  studentMessage: string;
  aiResponse: string;
  filterResult: FilterResult;        // was anything blocked/redacted?
  piiResult: PIIScanResult;          // was PII detected?
  distressFlag: boolean;
  topicFlag?: string;                // which restricted topic triggered
  integritySignals?: IntegrityMetadata; // from MonitoredTextarea
  metadata: {
    model: string;
    tokens: number;
    latencyMs: number;
    pageId?: string;
    toolId?: string;
  };
}
```

**Storage:** `ai_conversation_logs` table (new migration). Retention: configurable per school (default 12 months, minimum 6 months for safeguarding compliance).

**Access:** Teacher can view all conversations for their classes. Admin can view all. Students cannot view logs (they see the conversation in the normal UI).

### 4.6 Teacher Safety Dashboard

New tab in Class Hub: **Safety** (extends existing tab structure).

**Components:**

**4.6.1 Conversation Viewer**
- Chronological feed of all AI conversations for the class
- Filter by: student, touchpoint, date range, flagged-only
- Each entry shows: student name, timestamp, touchpoint badge, first line preview
- Expandable to see full conversation thread
- Flag indicators: red (distress), amber (content filter), blue (PII), purple (topic)

**4.6.2 Flagged Queue**
- Auto-populated from filter/distress/PII detections
- Sorted by severity (distress first, then content, then PII, then topic)
- Teacher actions: Acknowledge (marks reviewed), Escalate (adds note for admin/safeguarding lead), Dismiss (false positive, feeds back into filter tuning)
- Unacknowledged flags show count badge on Class Hub Safety tab

**4.6.3 Policy Configuration** (per-class)
- Toggle: AI enabled/disabled for this class (kill switch)
- Custom blocked words (add/remove, with reason field)
- Restricted topics (checkboxes for configurable topics)
- Content filter mode (block/redact/flag per severity)
- AI conversation visibility: "Students can see conversation history" toggle (default: yes)
- Daily AI interaction limit per student (default: 50, configurable)

### 4.7 AI Output Screening

The AI itself can generate problematic content. Output screening catches what prompt engineering misses.

**Checks on every AI response:**
1. Content filter (same engine as input — §4.1)
2. PII scanner (same engine — §4.2)
3. Hallucination guard — AI must not invent student work, fabricate grades, or claim to have seen something it hasn't
4. Over-helping guard — already partially implemented via effort-gating; this formalises it as a safety check (response length > threshold + direct answer patterns → flag)
5. Inappropriate tone — AI should never be sarcastic, dismissive, or condescending to minors

**If output fails screening:**
- Regenerate with safety reinforcement prompt (1 retry)
- If retry also fails → return safe fallback: "I'm having trouble with that question. Let's try a different approach — what are you working on right now?"
- Log the failed output for admin review

### 4.8 PII Pseudonymisation for AI Calls

Before any student data reaches the AI API:

- Student name → display name or anonymised identifier
- Class name → kept (not PII)
- Teacher name → kept (needed for "talk to your teacher" responses)
- Other student names in context → redacted
- School name → kept (useful for AI context)
- Any response text from other students (gallery, peer review) → anonymised ("A classmate wrote..." not "Sarah wrote...")

**Implementation:** Wrapper around all AI API calls (`safeAICall()`) that scrubs the prompt payload before sending and logs what was scrubbed.

---

## 5. Database Schema

### New migration: `xxx_ai_safety.sql`

```sql
-- AI conversation logs
CREATE TABLE ai_conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  unit_id UUID REFERENCES units(id),
  touchpoint TEXT NOT NULL, -- design_assistant, toolkit_nudge, discovery_kit, open_studio, gallery_review
  student_message TEXT,
  ai_response TEXT,
  filter_result JSONB,       -- FilterResult
  pii_result JSONB,          -- PIIScanResult
  distress_flag BOOLEAN DEFAULT false,
  topic_flag TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_convo_logs_class ON ai_conversation_logs(class_id, created_at DESC);
CREATE INDEX idx_convo_logs_student ON ai_conversation_logs(student_id, created_at DESC);
CREATE INDEX idx_convo_logs_flagged ON ai_conversation_logs(class_id) WHERE distress_flag = true OR topic_flag IS NOT NULL;

-- Safety flags queue
CREATE TABLE safety_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id),
  student_id UUID NOT NULL REFERENCES students(id),
  conversation_log_id UUID REFERENCES ai_conversation_logs(id),
  flag_type TEXT NOT NULL,   -- distress, content, pii, topic, output
  severity TEXT NOT NULL,    -- critical, warning, info
  details JSONB,
  status TEXT DEFAULT 'new', -- new, acknowledged, escalated, dismissed
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_safety_flags_class ON safety_flags(class_id, status, created_at DESC);

-- School/class safety policies
CREATE TABLE safety_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,        -- 'school' or 'class'
  scope_id UUID NOT NULL,     -- teacher_id (school-level) or class_id
  blocked_words JSONB DEFAULT '[]',    -- BlockedWord[]
  restricted_topics JSONB DEFAULT '[]', -- string[]
  filter_mode TEXT DEFAULT 'block',     -- block, redact, flag
  ai_enabled BOOLEAN DEFAULT true,
  daily_ai_limit INTEGER DEFAULT 50,
  log_retention_months INTEGER DEFAULT 12,
  custom_config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX idx_safety_policies_scope ON safety_policies(scope, scope_id);

-- RLS policies (teacher sees own classes only)
ALTER TABLE ai_conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_policies ENABLE ROW LEVEL SECURITY;

-- Teacher can read conversation logs for their classes
CREATE POLICY "teacher_read_convo_logs" ON ai_conversation_logs
  FOR SELECT USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

-- Teacher can read/update safety flags for their classes
CREATE POLICY "teacher_read_flags" ON safety_flags
  FOR SELECT USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "teacher_update_flags" ON safety_flags
  FOR UPDATE USING (
    class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
  );

-- Teacher can manage policies for their classes/school
CREATE POLICY "teacher_manage_policies" ON safety_policies
  FOR ALL USING (
    (scope = 'school' AND scope_id = auth.uid()) OR
    (scope = 'class' AND scope_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
  );
```

---

## 6. Integration Points

### 6.1 Design Assistant (`src/app/api/student/design-assistant/route.ts`)
- **Before AI call:** run content filter + PII scanner on student message
- **After AI call:** run content filter + PII scanner + output screening on response
- **Always:** log conversation to `ai_conversation_logs`
- **If flagged:** create `safety_flags` entry, include in response metadata for Teaching Mode alert

### 6.2 Toolkit Nudges (`src/app/api/student/tool-nudge/route.ts`)
- Same filter/scan/log pipeline
- Lighter logging (nudges are short, context is the tool + step)

### 6.3 Discovery Engine Kit Responses
- Filter student free-text inputs (irritation prompt, panic scenario, problem description)
- Kit's template responses are pre-screened (hardcoded content) — only AI-generated responses need runtime screening
- Log all interactions including non-AI ones (for complete Discovery audit trail)

### 6.4 Open Studio Mentor
- Full pipeline (content filter + PII + topic guardrails + distress detection + output screening)
- Open Studio has the highest risk surface (most free-form student-AI interaction)
- Drift detection (existing) feeds into safety logging (drift flags become safety signals)

### 6.5 Gallery Peer Review
- Content filter on student-written reviews (profanity, name-calling)
- PII scanner on reviews (don't let students share personal info in public reviews)
- AI-generated review summaries get output screening

### 6.6 Teaching Mode Real-Time Alerts
- Teaching Mode dashboard already has student cards with status indicators
- Add red safety badge on student card when unacknowledged flag exists
- Click → opens conversation viewer filtered to that student's flagged interaction
- Real-time via existing 8-second polling (add `safety_flag_count` to live-status response)

---

## 7. Build Phases

### Phase A: Core Filter Engine (3 days)
- `content-filter.ts` — blocked word matching with l33t/unicode/evasion handling
- `pii-scanner.ts` — name, email, phone, address detection
- System default blocked word list (~800 terms)
- Unit tests for all filter edge cases
- `safeAICall()` wrapper for all AI API calls

### Phase B: AI Integration + Logging (3 days)
- `conversation-logger.ts` + migration for `ai_conversation_logs` + `safety_flags`
- Wire content filter + PII scanner into Design Assistant route
- Wire into toolkit nudge route
- Wire into Open Studio route
- Wire into Discovery Engine AI endpoints
- Wire into Gallery review endpoints
- `topic-guardrails.ts` + prompt injection for all AI system prompts

### Phase C: Distress Detection (2 days)
- `distress-detector.ts` — keyword triggers + behavioural signal integration
- Distress response protocol in AI prompts
- Safety flag creation for distress events
- Teacher alert integration (Teaching Mode badge)

### Phase D: Teacher Dashboard (3 days)
- Conversation Viewer component (chronological feed, filters, expandable threads)
- Flagged Queue component (sorted by severity, acknowledge/escalate/dismiss actions)
- Policy Configuration panel (blocked words CRUD, topic toggles, filter mode, AI limits)
- Safety tab in Class Hub
- Flagged count badge on Class Hub navigation

### Phase E: Output Screening + Polish (2 days)
- AI output screening (content filter + PII + hallucination guard + tone check)
- Retry + fallback mechanism for failed outputs
- PII pseudonymisation wrapper for AI API calls
- End-to-end testing across all 5 touchpoints
- Admin view (aggregate safety metrics across all teachers)

---

## 8. Existing Infrastructure Leveraged

| Existing System | How It's Used |
|----------------|---------------|
| MonitoredTextarea | Behavioural signals feed distress detection (hesitation, agitation patterns) |
| Integrity scoring (`analyze-integrity.ts`) | Academic integrity + safety are complementary — integrity data appears alongside safety data in teacher dashboard |
| Response flags (`response-flags.ts`) | Grade-calibrated anomaly detection feeds over-helping guard in output screening |
| Safety Badge system | Gate access to AI features (student must complete Digital Safety badge before using Design Assistant freely?) — future consideration |
| Rate limiting (`rate-limit.ts`) | Per-student AI limits enforced by existing rate limiter, configurable via safety policy |
| Effort-gating (Design Assistant prompt) | Already prevents AI from over-helping; formalised as safety check in output screening |
| Teaching Mode polling | Existing 8-second poll extended with safety flag counts for real-time alerts |
| Class Hub tabs | Safety tab added to existing tab structure |

---

## 9. What This Does NOT Cover (Explicitly Out of Scope)

- **Parental controls / family accounts** — separate project, requires new auth model
- **Student-to-student messaging** — StudioLoom doesn't have direct messaging (Gallery reviews are the closest, and they're covered)
- **AI model safety training** — we use Anthropic's models which have their own safety training; this project adds application-level guardrails on top
- **COPPA/FERPA/CCPA certification** — this project builds the technical controls; legal certification is a business process
- **Automated reporting to authorities** — platform alerts teachers; mandatory reporting is a human responsibility
- **Content moderation of uploaded images/files** — separate scope (Student Work Pipeline covers this)
- **AI usage analytics for billing** — covered by existing `ai_usage_log`

---

## 10. Compliance Mapping

| Requirement | How StudioLoom Addresses It |
|-------------|---------------------------|
| COPPA (children under 13) | Student auth uses no real email; token-based sessions; PII never sent to AI; teacher/school consent model (not individual child consent) |
| FERPA (education records) | AI conversation logs are education records — accessible only to teacher of record; exportable for parent requests; retention policy configurable |
| GDPR/PIPL (data protection) | PII pseudonymisation before AI calls; student names redacted from AI context; no data used for model training (Anthropic API, not training pipeline); China hosting considerations per existing CLAUDE.md notes |
| Safeguarding (UK KCSIT / local equivalents) | Distress detection + teacher alerts; conversation audit trail; flag review workflow; no automated diagnosis or therapy |
| Digital Promise Responsible AI | Transparency (teachers see all AI interactions); human oversight (teacher controls, kill switch); bias mitigation (grade-calibrated response flags); safety (content filtering, distress detection) |

---

## 11. StudioLoom-Specific Advantages (Beyond Toddle Parity)

1. **Per-step AI rules** — safety context changes per design phase. Ideation phase allows wilder language; evaluation phase is stricter. No competitor has phase-aware safety.
2. **Effort-gated safety** — the AI doesn't just filter content; it won't engage deeply until the student demonstrates genuine effort. This prevents students from using the AI as a chatbot.
3. **Integrity + safety unified** — MonitoredTextarea captures BOTH academic integrity signals AND safety-relevant behavioural signals (hesitation, agitation) in one component.
4. **Framework-neutral safety** — safety policies work the same regardless of whether the class is MYP, GCSE, or ACARA. The `FrameworkAdapter` never touches safety.
5. **Discovery Engine safety** — Kit's interactions are the most personal (strengths, fears, irritations). Extra-sensitive PII handling and distress detection for these intimate conversations.
6. **Badge-gated AI access** — potential future feature: require a "Digital Safety" badge before students get unrestricted AI access. The badge system already exists.

---

## 12. Key Decisions

- **Deterministic filters over AI-based content moderation** — content filter uses word matching + regex, not an AI classifier. Deterministic = explainable, instant, no API cost, no false negatives from model confusion. Same philosophy as integrity scoring (Lesson Learned: deterministic = explainable to parents/admin).
- **Teacher is always the first responder for distress** — the platform detects and alerts; the human responds. No automated escalation to parents, counsellors, or authorities. That's the school's safeguarding protocol, not ours.
- **No crisis hotline numbers in AI responses** — numbers vary by country, may be outdated, and give a false sense of resolution. The response is always: talk to your teacher or school counsellor.
- **False positives are acceptable** — over-flagging is better than under-flagging when dealing with minors. Teachers can dismiss false positives; they can't undo a missed crisis.
- **School-configurable, not one-size-fits-all** — different schools have different cultural contexts, religious considerations, and community standards. The safety floor (profanity, self-harm, violence) is non-negotiable; everything above it is configurable.
- **Log everything, surface selectively** — all AI conversations are logged regardless of flags. Teachers see the flagged queue by default; full conversation viewer is available but not in-your-face. This balances safety with not overwhelming teachers.
- **Content filter runs on both input AND output** — students can type inappropriate things (input filter catches), AND AI models can occasionally generate inappropriate responses (output filter catches). Belt and suspenders.
- **Blocked word list is additive only** — school/class custom words ADD to the system defaults; they can never REMOVE system defaults. A school cannot unblock a slur.
