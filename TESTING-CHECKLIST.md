# Toolkit Tools Extraction — Testing Checklist
**Completed:** 19 March 2026
**Scope:** Verify 6 extracted toolkit tools work correctly in public and embedded modes

---

## Pre-Test Setup
- [ ] `npm install` — install dependencies
- [ ] `npm run dev` — start dev server on http://localhost:3000
- [ ] Have browser DevTools open (Console tab)
- [ ] Have 2 browser windows ready (one for teacher, one for student)

---

## Test 1: Public Mode Navigation

### SCAMPER
- [ ] Navigate to http://localhost:3000/toolkit/scamper
- [ ] Page loads without errors (console clean)
- [ ] Dark theme applies (aurora gradient background)
- [ ] Intro screen shows "SCAMPER" title, challenge input field, "Start" button
- [ ] Focus input field (should auto-focus)
- [ ] Type a challenge (e.g., "How might we reduce plastic waste?")
- [ ] Click "Start"
- [ ] Working screen shows Step 1: Substitute
- [ ] Input field shows placeholder "Enter your idea..."
- [ ] Type idea (e.g., "Replace plastic with biodegradable alternatives")
- [ ] Press Enter or click Submit
- [ ] Toast appears (purple/blue/amber glow)
- [ ] Toast message is effort-based (e.g., "Great thinking!" for high effort)
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Idea appears in ideas list below
- [ ] AI nudge appears below input (next step guidance)
- [ ] Add 2-3 more ideas for step 1
- [ ] "Next Step" button becomes active
- [ ] Click "Next Step" to move to step 2: Combine
- [ ] Repeat for all 7 steps
- [ ] After step 7, "Finish & Summarize" button appears
- [ ] Click "Finish & Summarize"
- [ ] Summary screen shows all 7 SCAMPER steps with ideas grouped by step
- [ ] "AI Synthesis" section shows cross-step insights
- [ ] "Copy All" button copies all ideas to clipboard
- [ ] Close button returns to intro screen

### Six Thinking Hats
- [ ] Navigate to http://localhost:3000/toolkit/six-thinking-hats
- [ ] Page loads without errors
- [ ] Intro screen shows title, challenge input, "Start" button
- [ ] Type challenge (e.g., "Should we launch a new product?")
- [ ] Click "Start"
- [ ] Working screen shows 6 hat buttons in rail (White, Red, Black, Yellow, Green, Blue)
- [ ] Click "White Hat" (facts)
- [ ] Input field shows placeholder, hat-specific prompt
- [ ] Type fact (e.g., "Our target market has 5M potential users")
- [ ] Submit idea
- [ ] Toast appears with effort assessment
- [ ] AI nudge is factual, not emotional
- [ ] Click "Red Hat" (emotions)
- [ ] AI nudge tone changes to emotional perspective
- [ ] Click "Black Hat" (critical)
- [ ] AI nudge tone changes to critical, identifies risks
- [ ] Verify each hat has distinct tone/color
- [ ] Complete all 6 hats with ideas
- [ ] Click "Finish & Summarize"
- [ ] Summary shows 2×3 grid of hats with ideas grouped by hat
- [ ] "Cross-Hat Insights" section identifies patterns/conflicts
- [ ] Completion dots on rail show progress

### PMI Chart
- [ ] Navigate to http://localhost:3000/toolkit/pmi-chart
- [ ] Intro screen loads
- [ ] Type challenge (e.g., "Should we implement AI-powered grading?")
- [ ] Click "Start"
- [ ] Working screen shows 3 columns: Plus (green), Minus (red), Interesting (purple)
- [ ] Click "Plus" column
- [ ] Type benefit (e.g., "Saves teachers 5 hours/week")
- [ ] Submit
- [ ] Toast appears
- [ ] AI nudge is positive (celebrates benefit)
- [ ] Click "Minus" column
- [ ] Type risk (e.g., "May reduce teacher-student trust")
- [ ] AI nudge is critical (explores impact)
- [ ] Click "Interesting" column
- [ ] Type observation (e.g., "Teachers might use AI insights to personalize feedback")
- [ ] AI nudge pushes for nuance (neither good nor bad)
- [ ] Add 3-4 ideas per column
- [ ] Click "Finish & Summarize"
- [ ] Summary shows 3-column layout with color-coded backgrounds
- [ ] "Copy Plus", "Copy Minus", "Copy Interesting" buttons work
- [ ] "Copy All" copies all columns

### Five Whys
- [ ] Navigate to http://localhost:3000/toolkit/five-whys
- [ ] Intro screen loads
- [ ] Type challenge (e.g., "Why do students struggle with design thinking?")
- [ ] Click "Start"
- [ ] Working screen shows "Why 1" with gradient purple background
- [ ] Type answer (e.g., "Because they haven't learned the process")
- [ ] Submit
- [ ] Toast appears
- [ ] Summary shows first answer with chain indicator (→)
- [ ] "Why 2" field appears with prompt "Why is that? Because..."
- [ ] Type next why (e.g., "Because most schools teach traditional problem-solving")
- [ ] Verify each why level has deeper purple gradient
- [ ] Continue through all 5 whys
- [ ] On Why 5, AI nudge confirms root cause found
- [ ] Click "Finish & Summarize"
- [ ] Summary shows full causal chain with arrows connecting each level
- [ ] "Root Cause Analysis" section identifies primary cause

### Empathy Map
- [ ] Navigate to http://localhost:3000/toolkit/empathy-map
- [ ] Intro screen loads with persona name field
- [ ] Type persona (e.g., "Ms. Johnson, Maths Teacher")
- [ ] Type challenge (e.g., "What does Ms. Johnson think about AI tutors?")
- [ ] Click "Start"
- [ ] Working screen shows 4 quadrants: Says, Thinks, Does, Feels
- [ ] Click "Says" (speech bubble icon)
- [ ] Type quote (e.g., "I like using tools that save me time")
- [ ] Submit
- [ ] AI nudge checks if it's a direct quote (verifies authenticity)
- [ ] Click "Thinks" (thought bubble)
- [ ] Type private thought (e.g., "I wonder if AI might replace me")
- [ ] AI nudge explores gap between public/private
- [ ] Click "Does" (action icon)
- [ ] Type observable action (e.g., "Spends 30 min/day grading essays")
- [ ] AI nudge confirms observability
- [ ] Click "Feels" (heart icon)
- [ ] Type emotion (e.g., "Anxious AND hopeful")
- [ ] AI nudge validates contradictory emotions
- [ ] Complete all quadrants
- [ ] Click "Finish & Summarize"
- [ ] Summary shows 2×2 grid with quadrants color-coded
- [ ] "Persona Profile" section synthesizes insights

### Decision Matrix
- [ ] Navigate to http://localhost:3000/toolkit/decision-matrix
- [ ] Page loads (may show wrapper message or load existing implementation)
- [ ] Verify no console errors

### How Might We
- [ ] Navigate to http://localhost:3000/toolkit/how-might-we
- [ ] Page loads (may show wrapper message or load existing implementation)
- [ ] Verify no console errors

---

## Test 2: Embedded Mode Integration

### Setup Unit with Toolkit Tool Response
1. Log in as teacher
2. Create new unit (or edit existing)
3. Add new page
4. On that page, add a new section with response type "toolkit-tool"
5. Select tool ID: "six-thinking-hats"
6. Set challenge: "Should we redesign our website?"
7. Save unit

### Test Embedded Rendering
- [ ] Log out (or use private window)
- [ ] Open student URL for unit
- [ ] Complete pages up to toolkit tool response
- [ ] Toolkit tool renders in embedded mode (compact, no full layout)
- [ ] Intro screen shows with challenge text pre-filled
- [ ] Click "Start"
- [ ] Working screen shows smaller than public mode
- [ ] Input field shows placeholder
- [ ] Type response (e.g., "The white hat fact is that our bounce rate is 45%")
- [ ] Submit
- [ ] Toast appears with effort-based message
- [ ] Micro-feedback auto-dismisses
- [ ] Add 2-3 more ideas
- [ ] Verify onSave callback fires (check parent state)
- [ ] Click "Finish & Summarize"
- [ ] Summary shows all ideas
- [ ] Click "Mark as Complete" (or equivalent button)
- [ ] Verify onComplete callback fires
- [ ] Response saved to database as JSON

### Verify Data Persistence
1. Log back in as teacher
2. View student's response
   - [ ] All ideas visible in summary view
   - [ ] Effort levels recorded for each idea
   - [ ] Depth indicators show quality assessment
   - [ ] Raw JSON data shows complete tool state

---

## Test 3: API Endpoints

### Test SCAMPER Endpoint
```bash
curl -X POST http://localhost:3000/api/tools/scamper \
  -H "Content-Type: application/json" \
  -d '{
    "step": 1,
    "response": "Replace plastic with paper",
    "previousResponses": [],
    "effortLevel": "high"
  }'
```
- [ ] Returns 200 status
- [ ] Response includes `{ acknowledgment, nudge, effortLevel, stepTone }`
- [ ] AI message is step-appropriate (Substitute suggestions)
- [ ] Effort tone matches input (high effort = celebratory)

### Test Six Hats Endpoint
```bash
curl -X POST http://localhost:3000/api/tools/six-hats \
  -H "Content-Type: application/json" \
  -d '{
    "hat": "black",
    "response": "The system might fail if servers go down",
    "previousResponses": [],
    "stepNumber": 1
  }'
```
- [ ] Returns 200 status
- [ ] Response tone is critical/analytical (Black Hat)
- [ ] Acknowledges the risk perspective
- [ ] Suggests deeper critical analysis

### Test PMI Endpoint
```bash
curl -X POST http://localhost:3000/api/tools/pmi \
  -H "Content-Type: application/json" \
  -d '{
    "column": "interesting",
    "response": "Teachers might resent being replaced",
    "previousResponses": []
  }'
```
- [ ] Returns 200 status
- [ ] Response recognizes nuance (not purely good/bad)
- [ ] Pushes for deeper analysis

### Test Five Whys Endpoint
```bash
curl -X POST http://localhost:3000/api/tools/five-whys \
  -H "Content-Type: application/json" \
  -d '{
    "level": 2,
    "response": "Because teachers lack training",
    "previousResponses": ["Because design thinking is hard"],
    "parentAnswer": "Because design thinking is hard"
  }'
```
- [ ] Returns 200 status
- [ ] Response detects if answer goes deeper or sideways
- [ ] Nudges toward root cause if going sideways

### Test Empathy Map Endpoint
```bash
curl -X POST http://localhost:3000/api/tools/empathy-map \
  -H "Content-Type: application/json" \
  -d '{
    "quadrant": "says",
    "response": "\"I want tools that actually help my students think\"",
    "previousResponses": []
  }'
```
- [ ] Returns 200 status
- [ ] Quotes detected for "Says" quadrant
- [ ] Response validates quote authenticity

---

## Test 4: Performance

### Bundle Size
- [ ] Run `npm run build`
- [ ] Check size of .next/static/chunks/* files
- [ ] Verify toolkit tool chunks are under 100KB each

### Runtime Performance
- [ ] Open DevTools → Performance tab
- [ ] Navigate to `/toolkit/scamper`
- [ ] Record 5-second interaction (input + submit)
- [ ] Check frame rate (should be >60fps)
- [ ] Check for long tasks (should be <50ms)
- [ ] Check memory usage (should not grow unbounded)

### Code-Splitting
- [ ] Open DevTools → Network tab
- [ ] Navigate to `/toolkit` (main toolkit page)
- [ ] Check that six-hats, pmi-chart, etc. chunks NOT loaded
- [ ] Navigate to `/toolkit/six-thinking-hats`
- [ ] Check that six-hats chunk is loaded on demand

---

## Test 5: Edge Cases

### Empty/Short Responses
- [ ] Submit blank response → error message appears
- [ ] Submit 1-word response → flags as low effort
- [ ] Message says "Add more detail" or "Explain your thinking"

### Very Long Responses
- [ ] Copy-paste 2000+ character text into idea field
- [ ] Submit → should process normally
- [ ] Toast appears, AI nudge returns
- [ ] Summary still renders correctly
- [ ] No performance degradation

### Rapid Submissions
- [ ] Click submit button 5 times quickly
- [ ] Should debounce/rate-limit (30 per minute)
- [ ] 31st request returns 429 Too Many Requests error

### Network Failure
- [ ] Open DevTools → Network tab
- [ ] Throttle to offline
- [ ] Try to submit idea
- [ ] Should show error message
- [ ] Fallback prompt shown (pre-written message)
- [ ] Re-enable network, try again
- [ ] Should work normally

### Component Unmounting
- [ ] In embedded mode, start tool
- [ ] Submit a few ideas
- [ ] Navigate away from page
- [ ] Return to page
- [ ] Tool state should be preserved (onSave had time to fire)
- [ ] No memory leaks (check DevTools Memory tab)

---

## Test 6: Accessibility

### Keyboard Navigation
- [ ] Open `/toolkit/six-thinking-hats`
- [ ] Press Tab through all interactive elements
- [ ] All buttons/inputs reachable with Tab key
- [ ] Enter key submits ideas
- [ ] Esc key dismisses modals (if any)

### Screen Reader
- [ ] Open with screen reader (e.g., NVDA, JAWS)
- [ ] Announce "SCAMPER tool, step 1 of 7"
- [ ] Input field labeled "Enter your idea"
- [ ] Submit button announced as "Submit idea"
- [ ] Toast message announced when appears
- [ ] Step navigation announced as "Tab 1 of 6: White Hat"

### Color Contrast
- [ ] DevTools → Accessibility panel
- [ ] No warnings on color contrast
- [ ] Text readable on all backgrounds (WCAG AA standard)

### Touch Targets
- [ ] Open on mobile device (or emulate in DevTools)
- [ ] All buttons >= 44px × 44px (iOS/Android standard)
- [ ] Input fields easily tappable
- [ ] No accidental double-taps needed

### Focus Indicators
- [ ] Navigate with Tab key
- [ ] Clear focus ring visible on all focused elements
- [ ] Focus ring is not too thin/faint

---

## Test 7: Cross-Browser Compatibility

- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**For each browser:**
- [ ] All 7 tools load
- [ ] No console errors
- [ ] Themes render correctly
- [ ] Animations are smooth
- [ ] No layout shifts

---

## Passing Criteria

✓ All 7 tools load without console errors
✓ Effort assessment triggers on every submission
✓ Micro-feedback appears and auto-dismisses
✓ AI nudges are phase-appropriate (ideation vs. evaluation)
✓ Embedded mode saves state via onSave callback
✓ API endpoints return well-formed JSON
✓ Rate limiting enforced (30 per minute)
✓ Performance acceptable (<100ms interaction latency)
✓ Accessibility standards met (WCAG AA)
✓ Cross-browser compatibility verified

---

## Sign-Off

- [ ] All tests passed
- [ ] No blocking issues found
- [ ] Code is production-ready
- [ ] Ready to deploy to Vercel

**Tester Name:** ___________________
**Date:** ___________________
**Time Spent:** ___________________
