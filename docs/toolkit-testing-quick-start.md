# Toolkit Tools Testing — Quick Start Guide

**Last updated:** 19 March 2026

---

## What Changed?

6 interactive toolkit tools have been extracted from page routes into shared React components:

- `SixHatsTool.tsx` — 6 thinking perspectives
- `PmiChartTool.tsx` — Plus/Minus/Interesting evaluation
- `FiveWhysTool.tsx` — 5-level root cause analysis
- `EmpathyMapTool.tsx` — 4-quadrant persona research
- `DecisionMatrixTool.tsx` — Comparison engine (wrapper)
- `HowMightWeTool.tsx` — Problem reframing (wrapper)

These components now work in **three modes:**
1. **Public:** Free `/toolkit` routes (no auth required)
2. **Embedded:** Student response types within units (persistent, authenticated)
3. **Standalone:** (Coming in Phase A) Student launches from toolbar independently

---

## How to Test

### 1. Test Public Mode (Free Toolkit)

```bash
npm run dev
# Open browser to http://localhost:3000
```

Then navigate to:
- http://localhost:3000/toolkit/scamper
- http://localhost:3000/toolkit/six-thinking-hats
- http://localhost:3000/toolkit/pmi-chart
- http://localhost:3000/toolkit/five-whys
- http://localhost:3000/toolkit/empathy-map
- http://localhost:3000/toolkit/decision-matrix
- http://localhost:3000/toolkit/how-might-we

**What to verify:**
- ✓ Page loads without errors (console clean)
- ✓ Dark theme applies (aurora gradient, glassmorphism)
- ✓ Intro screen shows correctly
- ✓ First idea input focuses automatically
- ✓ Effort assessment triggers on submission (toast appears)
- ✓ Micro-feedback appears & auto-dismisses after 3 seconds
- ✓ Working screen shows step navigation
- ✓ Summary screen displays all ideas + AI synthesis
- ✓ Copy button works (text copied to clipboard)

---

### 2. Test Embedded Mode (Student Response)

#### Setup: Create a unit with toolkit tool response
1. Log in as teacher
2. Create a new unit
3. Add a page with a response type "toolkit-tool"
   - Set tool ID to one of: `scamper`, `six-thinking-hats`, `pmi-chart`, `five-whys`, `empathy-map`, `decision-matrix`, `how-might-we`
   - Set challenge/prompt text
4. Save unit

#### Test as student:
1. Log out (or open private browser window)
2. Open student URL for the unit
3. Complete pages up to the toolkit tool response
4. In the toolkit tool response:
   - ✓ Tool renders in compact "embedded" mode
   - ✓ Input field auto-focuses
   - ✓ Submit first idea
   - ✓ Toast appears with effort assessment ("Great thinking..." or "Add more detail...")
   - ✓ Toast auto-dismisses after 3 seconds
   - ✓ AI nudge appears below input (contextual feedback)
   - ✓ Add more ideas (test rapid submissions)
   - ✓ Click "Finish & Summarize"
   - ✓ Summary screen shows all your ideas
   - ✓ AI synthesis appears (insights from all ideas combined)
   - ✓ Click "Copy all" — all text copies to clipboard
5. Mark response as complete
6. Log back in as teacher
7. View student's response:
   - ✓ Response data saved as JSON
   - ✓ All ideas visible in summary
   - ✓ Effort levels per idea recorded
   - ✓ Can see depth indicators (quality assessment)

---

### 3. API Testing (Advanced)

Test the AI nudging endpoints directly:

```bash
curl -X POST http://localhost:3000/api/tools/six-hats \
  -H "Content-Type: application/json" \
  -d '{
    "hat": "yellow",
    "response": "This could work because we have existing customer relationships",
    "previousResponses": [],
    "step": 1
  }'
```

**Expected response:**
```json
{
  "acknowledgment": "You've identified a real strength.",
  "nudge": "What other assets or opportunities could we leverage?",
  "effortLevel": "high",
  "hatTone": "optimistic"
}
```

Test all 7 endpoints:
- `/api/tools/scamper` — S, C, A, M, P, E, R step
- `/api/tools/six-hats` — white, red, black, yellow, green, blue hat
- `/api/tools/pmi` — plus, minus, interesting column
- `/api/tools/five-whys` — why level 1-5
- `/api/tools/empathy-map` — says, thinks, does, feels quadrant
- `/api/tools/decision-matrix` — criterion reasoning validation
- `/api/tools/how-might-we` — problem reframing steps

---

### 4. Performance Testing

After making changes, verify:

```bash
# Check bundle size
npm run build

# Monitor runtime performance (open DevTools → Performance tab)
# Drag through tool usage and check:
# - Frame rate (should stay >60fps)
# - No janky animations
# - No unnecessary re-renders
```

---

### 5. Edge Cases to Test

**Empty/short responses:**
- Submit blank idea → should error with helpful message
- Submit 1-word idea → should flag as low effort, ask for more detail

**Very long responses:**
- Paste 2000+ character response → should accept, process normally
- Check summary still renders correctly

**Rapid submissions:**
- Click submit button 5 times quickly → should respect rate limit
- After 30 submissions in one minute → should get 429 Too Many Requests

**Network issues:**
- Disable network in DevTools
- Submit idea
- Should show error message, offer fallback prompt
- Reconnect network
- Try again (should work)

**Mobile/responsive:**
- Open `/toolkit/six-thinking-hats` on phone
- Test portrait and landscape orientation
- Touch targets should be >= 44px (easy to tap)
- Layout should adapt (no horizontal scroll)

---

### 6. Debugging Tips

**Console errors?**
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Look for new tool components
grep -r "import.*Tool from" src/components/toolkit/
```

**Tool not showing in ResponseInput?**
```bash
# Verify dynamic import
grep -A 2 "const SixHatsTool = dynamic" src/components/student/ResponseInput.tsx

# Verify conditional render
grep -B 2 "toolId === \"six-thinking-hats\"" src/components/student/ResponseInput.tsx
```

**Effort assessment not triggering?**
```bash
# Check `assessEffort` function in tool component
grep -A 10 "function assessEffort" src/components/toolkit/SixHatsTool.tsx

# Verify toast message appears
# Open DevTools → search for "toast" in component render
```

**AI nudge not appearing?**
```bash
# Check API endpoint logs
curl -X POST http://localhost:3000/api/tools/six-hats \
  -H "Content-Type: application/json" \
  -d '{"hat":"white","response":"Test","previousResponses":[]}'

# Look for error messages in response
```

---

## Component Architecture (For Developers)

Each extracted tool follows this pattern:

```typescript
// 1. Export named component
export function SixHatsTool({ toolId, mode, challenge, onSave, onComplete }: ToolkitToolProps) {
  // 2. Local state for tool-specific data
  const [screen, setScreen] = useState<'intro' | 'working' | 'summary'>('intro');
  const [hatsState, setHatsState] = useState<Record<string, ToolIdea[]>>({});

  // 3. Auto-save on state change (embedded mode only)
  useEffect(() => {
    if (mode !== 'public' && onSave) {
      const timer = setTimeout(() => {
        onSave({ screen, hatsState });
      }, 1000); // debounce 1 second
      return () => clearTimeout(timer);
    }
  }, [screen, hatsState, mode, onSave]);

  // 4. Render 3-screen flow
  if (screen === 'intro') return <IntroScreen onStart={() => setScreen('working')} />;
  if (screen === 'working') return <WorkingScreen onFinish={() => setScreen('summary')} />;
  if (screen === 'summary') return <SummaryScreen onClose={onComplete} />;
}
```

---

## What's Next?

After testing confirms all tools work correctly:

1. **Deploy to Vercel** — `npm run deploy`
2. **Run full browser test suite** — verify on production domain
3. **Monitor AI usage** — check that API calls are logged to `ai_usage_log`
4. **Student Toolkit Access (Phase A)** — implement persistence + standalone mode
5. **Extract remaining tools (Phase B)** — 7 more interactive + 14 templates

---

## Questions?

See full documentation at `/docs/toolkit-extraction-completion.md` or read the AI patterns guide at `/docs/education-ai-patterns.md`.
