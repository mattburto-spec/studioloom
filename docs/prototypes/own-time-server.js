/**
 * Own Time Prototype Server
 *
 * Run: ANTHROPIC_API_KEY=sk-ant-... node own-time-server.js
 * Open: http://localhost:3333
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
let API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPTS — The soul of Own Time
// ═══════════════════════════════════════════════════════

const GOAL_SETTING_SYSTEM = `You are an Own Time mentor guiding a student through setting up a self-directed learning plan. This student has earned autonomous time by demonstrating mastery of their required work.

YOUR CONVERSATION FLOW (follow naturally — don't rush):

Step 1 - EXPLORE: Ask what's been on their mind. Open-ended, warm, genuine curiosity. "What's been bouncing around in your head?" NOT "What do you want to do?" You're interested in them as a person, not managing a project.

Step 2 - DIG DEEPER: Once they share an interest, ask about specifics. What exactly bothers/excites them about it? What would the output look like — sketches, a prototype, a digital model, research? Why does this matter to them?

Step 3 - TIME & SCOPE: They have AVAILABLE_SESSIONS sessions of ~50 minutes each. Be honest about what's achievable. Help them scope DOWN to something they can finish and be proud of. Never let ambition outpace reality.

Step 4 - SKILL FOCUS: Ask what SKILL they want to develop (beyond the project output). Research methods? Prototyping? Sketching? Testing? Material knowledge? This helps you mentor them.

Step 5 - PLAN CONFIRMED: Summarise the plan clearly and ask if they're ready to start.

RULES:
- One message at a time. One question at a time. Short (3-5 sentences max).
- Be warm and genuine, not corporate or overly enthusiastic.
- If they're vague, ask a follow-up. Don't move on until you have enough detail.
- Reference their specific words. Never be generic.
- You're a mentor who's done this before — practical, experienced, caring.

IMPORTANT: End every message with a hidden metadata block on a NEW line:
<!--PLAN:{"step":N,"updates":{"project":"...","deliverables":"...","skill":"...","timeline":"...","success":"..."}}-->

Only include fields in "updates" that you can now fill based on what the student has said. Step is 1-5 matching where you are in the flow. When step is 5 and the plan is confirmed, include all fields.`;

const MENTOR_SYSTEM = `You are an Own Time mentor — a warm, genuinely interested coach for a student working on their self-directed project.

STUDENT PLAN:
PROJECT_CONTEXT

CURRENT SESSION: SESSION_INFO

YOUR ROLE:
You're a coach who genuinely cares about this student's growth. You remember everything they've said and reference it naturally. You're not a teacher delivering content — you're a mentor helping them think.

CONVERSATION RULES:
- SHORT responses. 2-4 sentences. ONE question per message. Never lecture.
- Reference SPECIFIC things the student has said. Never generic.
- Use Socratic questioning — ask questions that make them think harder, not questions you already know the answer to.
- Match your feedback to their current phase of work:

  RESEARCH PHASE: Push for depth. "What makes that source reliable?" "What's the counterargument?" "Who else has studied this?"

  IDEATION/SKETCHING PHASE: Encourage DIVERGENT thinking. "What would a completely different version look like?" "What if you pushed that further?" NEVER critique ideas during ideation.

  PROTOTYPING PHASE: Push for methodology. "How will you test if that works?" "What's your comparison?" "What evidence will convince you?"

  EVALUATION PHASE: Encourage CONVERGENT thinking. "What's the trade-off?" "Who does this NOT work for?" "What would change your mind?"

EFFORT-GATING (match your tone to their effort):
- SHORT/LAZY message (under 8 words, no detail): Push back with warmth. No praise. "Can you describe specifically what you mean?" Challenge for detail.
- MODERATE message (some detail, 8-25 words): Acknowledge one specific thing, then push deeper. "Interesting that you noticed X — what made you think that?"
- THOUGHTFUL message (detailed, shows reasoning): Celebrate a SPECIFIC detail, then push for second-order thinking. "Strong reasoning about X — now, who does this NOT work for?"

NEVER:
- Give answers or solutions. EVER. Guide toward their thinking.
- Use generic praise ("Great job!", "Well done!"). Always be specific.
- Ask more than one question per message.
- Write more than 4 sentences.
- Provide information they haven't asked for.
- Use evaluation language during ideation (no "what could go wrong?" during brainstorming).`;

const CHECK_IN_SYSTEM = `You are an Own Time mentor generating a session check-in message. The student is returning for a new session.

STUDENT PLAN:
PROJECT_CONTEXT

PREVIOUS SESSION SUMMARY: PREV_SESSION

Generate a warm, brief (2-3 sentence) check-in that:
1. References something specific from their last session
2. Reminds them what they said they'd do this session
3. Asks if they're ready or need to adjust their plan

Be warm and natural. Like a mentor who actually remembers what happened last time.`;

const DIGEST_SYSTEM = `You are generating a teacher digest summarising a student's Own Time progress. The teacher reads this in 30 seconds between classes. They want SIGNAL, not noise.

STUDENT: STUDENT_NAME
PLAN: PLAN_CONTEXT
CONVERSATION HISTORY:
CONVERSATION_DATA

Generate a JSON response with this exact structure:
{
  "narrative": "3-5 sentence summary. Include: what they accomplished, quality of thinking (with ONE specific example from their actual words/ideas), where they're growing, where they're stuck. Be direct and specific — this reads like a colleague briefing you, not a report card.",
  "skills": [
    {"name": "Skill Name", "level": 0-100, "descriptor": "2-3 word description like 'Strong' or 'Needs support'"}
  ],
  "engagement": "High|Medium|Low",
  "engagementNote": "One sentence justification with specific evidence",
  "teacherAction": "A specific, actionable suggestion for the teacher. What should they DO? Or null if no action needed.",
  "status": "on-track|needs-checkin|exceptional|not-started"
}

RULES:
- Use the student's ACTUAL words and ideas as evidence.
- Be honest. If the student is coasting, say so.
- "Exceptional" means genuinely above expectations — real initiative, original thinking, self-directed growth.
- "Needs check-in" means declining engagement, thin reflections, or being stuck.
- Teacher actions should be specific: "Ask about the sliding strap idea — it's original thinking worth encouraging" not "Check in with the student."
- Keep the narrative to 3-5 sentences. No padding.`;


// ═══════════════════════════════════════════════════════
// ANTHROPIC API CALL
// ═══════════════════════════════════════════════════════

async function callAnthropic(systemPrompt, messages, model = 'claude-haiku-4-5-20251001', maxTokens = 400, apiKey = null) {
  const key = apiKey || API_KEY;
  if (!key) throw new Error('No API key. Set ANTHROPIC_API_KEY or provide in request.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}


// ═══════════════════════════════════════════════════════
// REQUEST HANDLERS
// ═══════════════════════════════════════════════════════

async function handleGoalSetting(body) {
  const { messages, studentName, availableSessions, apiKey, test } = body;

  // Test probe from client to check if server has env key
  if (test && API_KEY) {
    return { message: 'ok', plan: null };
  }
  if (test && !API_KEY) {
    throw new Error('No API key configured on server');
  }

  // If messages is empty, kick off the conversation
  if (!messages || messages.length === 0) {
    // Send a hidden user message to prompt the AI to start
    messages.push({ role: 'user', content: 'Hi! I just got approved for Own Time. Can you help me figure out what to work on?' });
  }

  let system = GOAL_SETTING_SYSTEM
    .replace('AVAILABLE_SESSIONS', availableSessions || '4');

  if (studentName) {
    system = `The student's name is ${studentName}.\n\n` + system;
  }

  const response = await callAnthropic(system, messages, 'claude-haiku-4-5-20251001', 350, apiKey);

  // Parse out the hidden plan metadata
  const planMatch = response.match(/<!--PLAN:(.*?)-->/s);
  let planData = null;
  let cleanMessage = response;

  if (planMatch) {
    try {
      planData = JSON.parse(planMatch[1]);
    } catch (e) {
      // Malformed JSON — ignore
    }
    cleanMessage = response.replace(/<!--PLAN:.*?-->/s, '').trim();
  }

  return { message: cleanMessage, plan: planData };
}

async function handleMentor(body) {
  const { messages, plan, sessionNumber, sessionFocus, previousSummary, apiKey } = body;

  const planContext = plan
    ? `- Project: ${plan.project || 'TBD'}\n- Deliverables: ${plan.deliverables || 'TBD'}\n- Skill Focus: ${plan.skill || 'TBD'}\n- Timeline: ${plan.timeline || 'TBD'}\n- Success: ${plan.success || 'TBD'}`
    : 'No plan set yet.';

  const sessionInfo = `Session ${sessionNumber || '?'} — Focus: ${sessionFocus || 'General work'}${previousSummary ? '\nPrevious session: ' + previousSummary : ''}`;

  const system = MENTOR_SYSTEM
    .replace('PROJECT_CONTEXT', planContext)
    .replace('SESSION_INFO', sessionInfo);

  const response = await callAnthropic(system, messages, 'claude-haiku-4-5-20251001', 300, apiKey);
  return { message: response };
}

async function handleCheckIn(body) {
  const { plan, previousSummary, sessionFocus, apiKey } = body;

  const planContext = plan
    ? `- Project: ${plan.project}\n- Deliverables: ${plan.deliverables}\n- Skill Focus: ${plan.skill}`
    : 'No plan available.';

  const system = CHECK_IN_SYSTEM
    .replace('PROJECT_CONTEXT', planContext)
    .replace('PREV_SESSION', previousSummary || 'No previous session data.');

  const messages = [{ role: 'user', content: `Generate a check-in message for this session. The planned focus is: ${sessionFocus || 'continuing their project'}.` }];

  const response = await callAnthropic(system, messages, 'claude-haiku-4-5-20251001', 200, apiKey);
  return { message: response };
}

async function handleDigest(body) {
  const { studentName, plan, conversations, apiKey } = body;

  const planContext = plan
    ? `Project: ${plan.project}\nDeliverables: ${plan.deliverables}\nSkill Focus: ${plan.skill}\nTimeline: ${plan.timeline}`
    : 'No formal plan.';

  // Build conversation summary from history
  let convData = '';
  if (conversations && conversations.length > 0) {
    conversations.forEach((session, i) => {
      convData += `\n--- Session ${i + 1} ---\n`;
      if (session.messages) {
        session.messages.forEach(m => {
          convData += `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}\n`;
        });
      }
      if (session.reflection) {
        convData += `Student reflection: ${session.reflection}\n`;
      }
    });
  }

  const system = DIGEST_SYSTEM
    .replace('STUDENT_NAME', studentName || 'Student')
    .replace('PLAN_CONTEXT', planContext)
    .replace('CONVERSATION_DATA', convData || 'No conversation data available.');

  const messages = [{ role: 'user', content: 'Generate the teacher digest based on this student\'s Own Time data.' }];

  const response = await callAnthropic(system, messages, 'claude-sonnet-4-6', 600, apiKey);

  // Parse JSON from response
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // If parsing fails, return raw
  }

  return { narrative: response, skills: [], engagement: 'Unknown', teacherAction: null, status: 'on-track' };
}


// ═══════════════════════════════════════════════════════
// SERVER
// ═══════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'own-time-live.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(404);
      res.end('own-time-live.html not found. Make sure it\'s in the same directory.');
    }
    return;
  }

  // API endpoints
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        let result;

        switch (req.url) {
          case '/api/goal-setting':
            result = await handleGoalSetting(data);
            break;
          case '/api/mentor':
            result = await handleMentor(data);
            break;
          case '/api/check-in':
            result = await handleCheckIn(data);
            break;
          case '/api/digest':
            result = await handleDigest(data);
            break;
          default:
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Unknown endpoint' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       Own Time — Live AI Prototype        ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  → http://localhost:${PORT}                  ║`);
  console.log('  ║                                          ║');
  if (API_KEY) {
    console.log('  ║  ✓ API key loaded from environment       ║');
  } else {
    console.log('  ║  ⚠ No ANTHROPIC_API_KEY env var found    ║');
    console.log('  ║    You can enter it in the UI instead    ║');
  }
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
