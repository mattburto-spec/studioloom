# Design Thinking Toolkit — Design Spec
*Goal: Make this the most beautiful and usable design tool browser in education. Period.*
*Created: 17 March 2026*

## The bar to clear

This isn't competing with worksheet generators (Canva, QuickWorksheets, Monsha). Those are utilitarian. This is competing with the feeling of browsing Mobbin, Dribbble, or Pinterest — that "I could scroll this for hours" dopamine. But for design teachers. Every card should make a teacher think "I want to use this tomorrow."

## Visual direction

### Steal from these (not education tools — they're all ugly)

**Mobbin** — The gold standard for browse-and-filter. Clean grid, strong filtering, real screenshots as thumbnails. Key lesson: the content IS the visual. Don't decorate around the tools — make the tools themselves look stunning in the cards.

**Pinterest** — Masonry grid, infinite scroll, visual-first. Saves/collections system. Key lesson: let the visuals do the talking. Minimal text on cards, maximum visual impact.

**Linear** — Dark mode done right. Subtle gradients, micro-interactions on hover, keyboard shortcuts for power users. Key lesson: speed matters. Filtering should feel instant. No loading spinners.

**Raycast** — Command palette UX. Type to search, results appear instantly. Key lesson: teachers are busy. Let them find what they need in 3 seconds or less.

**Apple App Store (Today tab)** — Editorial curation. Featured tools with rich story cards. "Tool of the week." Key lesson: don't just list tools — tell stories about how to use them.

### Visual system

**Colour:** Each MYP design cycle phase gets a colour family. Not random — meaningful.
- Inquiring → Deep blue/indigo (exploration, depth)
- Developing → Violet/purple (creativity, possibility)
- Creating → Amber/orange (energy, making)
- Evaluating → Emerald/teal (judgement, clarity)

**Cards:** Each tool gets a unique, beautiful SVG illustration — NOT a generic icon. The illustration should visually explain what the tool does. Think: a mini-infographic of the tool itself, rendered as art. Examples:
- Mind Map card shows a beautiful radial diagram with soft gradients
- Decision Matrix card shows a gorgeous weighted grid with colour-coded scores
- Empathy Map card shows the four-quadrant face diagram
- Fishbone card shows the elegant cause-effect spine

**Typography:** Inter or Satoshi for UI, with generous whitespace. Tool names are bold and large. Descriptions are short and scannable. No walls of text.

**Micro-interactions (2026 trends):**
- Cards lift with a soft shadow on hover (not just translateY — add perspective tilt)
- Glassmorphism on filter bar (frosted glass, stays readable)
- Aurora gradient background that shifts subtly (not distracting — atmospheric)
- Deploy buttons pulse gently when a tool matches the active filter
- Favouriting animates with a satisfying pop
- Phase filter switching causes cards to shuffle/re-sort with fluid animation (Framer Motion or CSS)
- Search results highlight matching text within card descriptions

## Layout & UX patterns

### Browse mode (default)
- Masonry or uniform grid (test both — masonry is more Pinterest, uniform is more Mobbin)
- Cards show: SVG illustration (60% of card), tool name, one-line description, phase tags, difficulty badge, time estimate
- NO deploy buttons visible by default — keeps it clean
- Hover reveals deploy options as an overlay (slide up from bottom of card)
- Infinite scroll or "load more" — not pagination

### Filter system
- Sticky filter bar at top (glassmorphism background)
- Phase filter: pill buttons with phase colours
- Type filter: pill buttons (Ideation, Analysis, Evaluation, Research, Planning, Communication, Reflection)
- Deploy mode filter: icon buttons (presentation, printable, group, individual)
- Active filters show as removable chips
- Results count updates in real-time ("Showing 12 of 36 tools")
- Keyboard shortcut: `/` to focus search (Raycast pattern)
- Clear all filters button

### Search
- Instant search (filter as you type, no submit button)
- Search across: tool name, description, synonyms, use cases
- "Fuzzy" matching — searching "brainstorm" should surface Mind Map, Crazy 8s, SCAMPER, Brainstorm Web
- Empty state: friendly illustration + "Try browsing by phase instead"

### Tool detail view
- Click card → expands into a detail panel (sidebar or modal)
- Shows: full description, when to use it, step-by-step facilitation guide, example in context, student work example (placeholder), related tools
- Deploy buttons are prominent here
- "Share with colleague" button (copies link)
- "Add to my toolkit" (saves to personal collection — requires free account)

### Deploy modes (the magic)
Each tool should work in multiple formats. One click, ready to go:

**📺 Presentation mode**
- Full-screen, projector-optimised view
- Large visuals, minimal text
- Step-by-step walkthrough with "Next" button
- Timer built in (for timed activities like Crazy 8s)
- Dark/light mode toggle
- Works offline once loaded

**🖨️ Printable mode**
- Clean A4/Letter PDF generation
- Student-facing layout (instructions, workspace, reflection prompt)
- Differentiated versions: standard, ELL-scaffolded, extension
- QR code linking back to the digital version
- School logo placeholder

**👥 Group activity mode**
- Digital collaborative board (real-time if premium, turn-based if free)
- Teacher controls: timer, reveal/hide sections, lock responses
- Roles assigned automatically (for tools like Six Thinking Hats)
- Gallery walk view at the end
- Export group work as PDF

**⚡ Individual rapid mode**
- Stripped-down, focused interface
- Timed mode with visual countdown
- Auto-save progress
- Submit to teacher when done
- Portfolio-ready output

## What makes it "the best in the world"

### 1. The illustrations
Every other tool browser uses generic icons or stock photos. We use custom SVG illustrations that ARE the tool — miniature, beautiful versions of the actual thinking framework. This is the visual differentiation. A teacher sees a Lotus Diagram rendered as a gorgeous geometric pattern and wants it on their classroom wall, not just in their lesson plan.

### 2. The deploy-in-one-click promise
No other platform does this. Canva makes you build from a template. TPT gives you a static PDF. We give you a beautiful, interactive, ready-to-use tool in the format you need, instantly. Presentation mode with a timer for Crazy 8s? One click. Differentiated printable worksheets for Empathy Maps? One click.

### 3. MYP design cycle awareness
No generic "brainstorming tools" category. Every tool is mapped to the actual MYP design cycle phases that teachers use. A teacher who's planning an Inquiring lesson can filter to see only the tools that fit. This is something no horizontal tool (Canva, Miro, FigJam) will ever do.

### 4. The "I didn't know this existed" discovery
Most design teachers use the same 5-6 tools (Mind Map, PMI, SWOT, maybe a Decision Matrix). A beautiful browse experience exposes them to tools they didn't know about — Morphological Charts, Biomimicry Cards, Lotus Diagrams, Systems Maps. Each discovery makes them think "Where has this been all my career?" and that's when they share it.

### 5. Works in low-bandwidth schools
Many international schools have terrible internet. The tools should be lightweight, SVG-based, work offline, and load fast. No heavy JavaScript frameworks for the free version — vanilla JS or Preact, not a full React app.

## Shareability features (viral loop)

- "Share this tool" → generates a beautiful Open Graph card with the SVG illustration (looks amazing when shared on Facebook teacher groups, Twitter/X, LinkedIn)
- "Embed in Google Slides" → generates a one-click embed link
- "Print as poster" → generates a classroom-quality A3 poster of the tool framework (teachers LOVE printing posters)
- Tool collections → "My favourite 10 tools for MYP Year 3" → shareable link
- Each tool has a unique URL → SEO juice for every tool name ("empathy map template for students" etc.)
- Suggested share text → "I just found this amazing free toolkit with 36+ design thinking tools for teachers. Each one deploys as a presentation, printable, or group activity in one click. [link]"

## Technical notes

- **Free tier:** Browse all tools, deploy in presentation + printable mode, share links
- **Premium (StudioLoom account):** Group activity mode, individual mode with auto-save, differentiated printables (ELL/extension), personal collections, classroom integration, collaborative features, analytics (which tools do your students use most?)
- **SEO play:** Each tool gets its own page (/toolkit/empathy-map, /toolkit/decision-matrix). Rich snippets. Image alt text. This becomes the definitive resource for "design thinking tools for students"
- **Target: 50+ tools at launch.** Current POC has 36. Add: Design Sprint methods, Crazy Eights variants, Reverse Brainstorming, Round Robin, Gallery Walk, World Café, Dot Voting, How Might We, Point of View Statement, Journey Map, Service Blueprint, Wireframing templates, Material Exploration cards, Testing protocols
- **Framework:** Preact or Astro (lightweight, fast, SSR for SEO). Not full Next.js for this — it's a standalone site that links to StudioLoom

## Priority actions

1. ~~Build proof-of-concept~~ ✅ Done (design-toolkit-browser.html)
2. **Commission/generate the SVG illustrations** — This is the make-or-break visual element. Each tool needs a unique, beautiful, recognisable illustration. Consider: Midjourney/DALL-E for initial concepts → clean up in Figma → export as optimised SVG
3. **Build 3 fully-functional deploy modes** for 5 tools (presentation + printable + group) as the "this is real" demo
4. **Post to design teacher communities** — IB Design teachers Facebook group, MYP Design Google Group, Twitter/X #MYPDesign, Reddit r/teaching — and see what happens
5. **Track:** Which tools get the most clicks? Which deploy modes? This data informs what to build next in StudioLoom proper.

## Competitors (and why they're not this)

| Competitor | What they do | Why we're different |
|-----------|-------------|-------------------|
| **Canva Education** | Template-based design tool | Beautiful but generic. No pedagogy. No deploy modes. Teachers still have to build from scratch. |
| **Teachers Pay Teachers** | Marketplace of teacher-created PDFs | Ugly. Static. No interactivity. No filtering by design cycle. Pay per resource. |
| **Miro / FigJam** | Collaborative whiteboard | Powerful but complex. Not designed for classroom deployment. No printable mode. Enterprise UX. |
| **Storyboard That** | Infographic maker for classrooms | Too generic. Not design-thinking focused. Templates are dated. |
| **Google Jamboard** (sunset) | Simple collaborative board | Dead product. Teachers looking for replacement. Opportunity. |
| **Padlet** | Digital bulletin board | Good for collaboration but not structured thinking tools. No tool-specific frameworks. |

None of these are "the most beautiful collection of design thinking tools, deployable in one click." That's the whitespace.
