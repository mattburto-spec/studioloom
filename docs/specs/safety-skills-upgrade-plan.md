# Safety & Skills System — World-Class Upgrade Plan
*24 March 2026*

## Current State (Honest Assessment)

### What's Working
- **Spot-the-Hazard SVG scenes** — genuinely great interactive content. Woodwork (10 hazards) and Metalwork (9 hazards) are detailed, engaging, and screenshot-worthy. This is the viral hook.
- **Question quality** — 25 questions for General Workshop, 16+ for Hand Tools. Mix of scenario, true/false, multiple choice, sequence, matching. Explanations are pedagogically sound.
- **Architecture** — database schema is solid (badges, student_badges, unit_badge_requirements, safety_sessions, safety_results). RLS policies, expiry, cooldown, retake logic all built.
- **Free tool dark theme** — looks professional, consistent with toolkit.

### What's Missing (Gap Analysis)

#### GAP 1: Only 2 of ~20 needed badges exist
Teachers need machine-specific and workshop-specific badges to cover their actual equipment. Currently:
- ✅ General Workshop Safety (Tier 1) — 25 questions, 6 learn cards
- ✅ Hand Tool Safety (Tier 1) — 16 questions, 6 learn cards
- ❌ Everything else

**Badges teachers actually need (priority order):**

**Tier 1 — Foundation (every student, every year):**
1. ✅ General Workshop Safety
2. ✅ Hand Tool Safety
3. ❌ **Fire Safety & Emergency Procedures** — fire types (A/B/C/E), extinguisher selection, evacuation, burns, chemical spills
4. ❌ **PPE Fundamentals** — fitting safety glasses, when to use dust masks vs respirators, hearing protection ratings, glove types

**Tier 2 — Workshop Area (students entering that space):**
5. ❌ **Wood Workshop** — dust hazards, extraction systems, machine zones, material storage, finishing chemicals
6. ❌ **Metal Workshop** — hot work, swarf, coolants, grinding sparks, lathe entanglement
7. ❌ **Plastics & Composites** — fumes, hot surfaces, vacuum forming, resin safety, ventilation
8. ❌ **Electronics & Soldering** — solder fumes, lead-free vs leaded, ESD, capacitor discharge, mains voltage
9. ❌ **Digital Fabrication** — laser cutter (fire/fumes/focus), 3D printer (hot end/fumes/bed adhesion), CNC (clamping/dust/tool breakage)
10. ❌ **Textiles Workshop** — sewing machine safety, iron/heat press, fabric cutting, pin management, dye chemicals

**Tier 3 — Machine Specific (before using that machine):**
11. ❌ **Band Saw** — blade tension, throat plate, push sticks, curve cutting, blade breakage
12. ❌ **Scroll Saw** — blade threading, hold-down, internal cuts, thin material
13. ❌ **Pedestal Drill** — clamping, speed selection, swarf clearing, long hair/sleeves
14. ❌ **Disc/Belt Sander** — dust extraction, direction of rotation, finger proximity, material limits
15. ❌ **Wood Lathe** — faceplate mounting, tool rest, spindle speed, long hair, loose clothing
16. ❌ **Thicknesser/Planer** — minimum length, grain direction, snipe, kickback
17. ❌ **Bench Grinder** — tool rest gap (max 3mm), eye shield, dressing, spark direction
18. ❌ **Laser Cutter** — material compatibility (never PVC!), ventilation, fire watch, focus, power settings
19. ❌ **3D Printer** — hot end temperature, bed leveling, fume extraction (ABS vs PLA), removal tools
20. ❌ **Sewing Machine** — needle guard, foot pedal control, bobbin threading, finger placement

**Tier 4 — Materials & Processes (as needed):**
21. ❌ **Working with Resins & Epoxy** — mixing ratios, exothermic reaction, ventilation, skin contact, curing
22. ❌ **Spray Painting & Finishes** — ventilation, fire risk, skin/eye protection, drying, disposal
23. ❌ **Food-Safe Materials** — which plastics are food-safe, finishing for food contact, contamination

Each badge needs: 6-8 learn cards with images, 15-25 questions (mixed types), 1+ Spot-the-Hazard scene where applicable.

---

#### GAP 2: Learning experience is flat — text cards aren't training
Current learn cards are plain text paragraphs. No images, no demonstrations, no interaction. For safety training to actually work, students need to SEE correct and incorrect practices.

**What each badge's learning section needs:**

| Content Type | Description | Where It Helps | Production Method |
|---|---|---|---|
| **Machine anatomy diagram** | Labeled parts diagram — "this is the blade guard, this is the fence, this is the throat plate" | Every machine badge | AI-generated illustration + labeled in code (SVG overlay) |
| **Correct vs Incorrect comparison** | Side-by-side: wrong way (red X) vs right way (green ✓) | Hand techniques, PPE fitting, workholding | AI-generated paired illustrations |
| **Step-by-step procedure** | Numbered visual steps: "1. Check blade tension → 2. Adjust guide → 3. Set fence → 4. Turn on extraction → 5. Power on" | Machine startup/shutdown | AI-generated sequence illustrations |
| **Animated explainer video** (30-60 sec) | Shows a concept in motion — blade rotation direction, kickback physics, dust particle inhalation, fire triangle | Concepts that need motion to understand | AI-generated frames + ElevenLabs voiceover + motion composite |
| **"What Went Wrong?" micro-story** | Real incident narrative (anonymised): "A Year 9 student was using the band saw when..." + analysis of what rules were broken | Every badge — makes it real, not abstract | Illustrated scene + narrated voiceover |
| **Interactive knowledge check** | Inline quiz between learn sections (not the final test — formative, low-stakes) | Breaks up passive reading, checks understanding | Code component (already spec'd as ComprehensionCheckBlock) |

**Video breakdown by badge type:**

**Animated explainer videos (ElevenLabs + AI frames):**
- "How Kickback Happens" (band saw, thicknesser) — 45 sec
- "The Fire Triangle in Workshops" — 30 sec
- "Why Dust is Dangerous" (particle sizes, lung damage) — 45 sec
- "Entanglement: How Fast Things Go Wrong" (lathe, drill press) — 30 sec
- "Chemical Safety: Read the Label" (MSDS/SDS basics) — 45 sec
- "The 3mm Rule" (bench grinder tool rest gap) — 20 sec
- "Why PVC + Laser = Poison" — 30 sec
- "Solder Fumes: What You Can't See" — 30 sec

**Screen recording + voiceover:**
- "How to Fit Safety Glasses Properly" — 60 sec
- "Setting Up Dust Extraction" — 45 sec
- "Reading a Safety Sign" — 30 sec (could be illustrated instead)

**Illustrated incident analysis ("What Went Wrong?"):**
- "The Loose Sleeve" (lathe entanglement) — 60 sec
- "The Blocked Exit" (fire evacuation) — 45 sec
- "The Wrong Material" (laser cutter fire) — 45 sec
- "The Unsecured Workpiece" (drill press grab) — 45 sec

**Total: ~16-20 short videos.** Each is 20-60 seconds. None longer than 90 seconds — attention span of 11-16 year olds.

---

#### GAP 3: No printable/downloadable resources
D&T teachers print things constantly. They need physical materials for their workshop walls, student folders, and compliance files.

**Resources to add per badge:**

| Resource | Format | Why Teachers Want It |
|---|---|---|
| **Safety poster** (A3) | PDF | Goes on the wall next to the machine. Visual rules + icons. |
| **Quick reference card** (A5) | PDF | Students keep in their folder. Startup/shutdown checklist. |
| **Risk assessment template** | PDF (fillable) | Legal requirement in many schools. Pre-filled for the machine/activity. |
| **PPE requirement chart** | PDF | "For this activity you need: ✅ Safety glasses ✅ Dust mask ❌ Gloves" |
| **Student safety contract** | PDF | "I have completed training and agree to follow these rules." Signature line. |
| **Incident report form** | PDF (fillable) | Standard form for when things go wrong. Many schools don't have one. |
| **Safety audit checklist** | PDF | Teacher uses before term starts. "Is the guard in place? Is extraction working?" |
| **Parent information letter** | DOCX template | "Your child will be using [machine]. Here's what safety training they've completed." |

**Shared resources (not per-badge):**
- Workshop safety induction presentation (PPTX) — ready to project on day 1
- Safety sign identification poster — all 4 colors with examples
- Emergency procedure flowchart — A3 poster
- First aid quick reference — wall-mountable
- Chemical safety (MSDS/SDS) reading guide
- Workshop rules poster (customisable — teacher adds their specific rules)

---

#### GAP 4: Free tool UX is functional but not engaging
Current flow: Landing → Learn (text cards) → Quiz → Results. No gamification, no progress tracking, no reason to come back.

**UX improvements needed:**

1. **Progress dashboard** — show which badges earned, which available, suggested next badge based on what they've done. Visual badge wall (think Scout merit badges or Xbox achievements).

2. **Badge path visualization** — show the prerequisite chain: "Complete General Workshop Safety → unlocks Wood Workshop → unlocks Band Saw, Scroll Saw, Lathe, Sander." Visual skill tree (think RPG talent tree).

3. **Learning mode overhaul** — replace text-only cards with rich multimedia modules:
   - Image cards (AI-generated illustrations)
   - Video cards (embedded players with timestamps)
   - Interactive cards (Spot-the-Hazard inline, drag-label diagrams, before/after sliders)
   - Knowledge check cards (low-stakes inline quiz between sections)
   - "What Went Wrong?" story cards with illustration + analysis

4. **Quiz UX improvements:**
   - Progress bar showing questions completed
   - Streak counter ("3 correct in a row! 🔥")
   - Immediate per-question feedback (not just at the end) — show explanation after each answer
   - Difficulty indicator per question (easy/medium/hard stars)
   - "Review mistakes" mode after failing — highlights which topics to study
   - Timer option (optional, teacher-configurable) for exam-like conditions

5. **Results & certification:**
   - Shareable badge image (student can screenshot/download)
   - Certificate PDF (student name, badge name, date, score, school logo placeholder)
   - QR code on certificate linking to verification
   - Badge expiry countdown ("Renew in 45 days")
   - Leaderboard per class (opt-in, shows completion %, not individual scores)

6. **Teacher class management (free tool):**
   - Teacher creates a class code (6-char)
   - Assigns required badges for that class
   - Dashboard shows per-student completion (names, badges, pass/fail, dates)
   - Export results as CSV/PDF
   - Email summary to teacher after all students complete

7. **Onboarding flow:**
   - "I'm a teacher" → class setup flow
   - "I'm a student" → enter class code → see assigned badges
   - "I'm just exploring" → browse all badges freely

---

#### GAP 5: Skills beyond safety aren't covered
"Safety and Skills" implies more than just hazard awareness. D&T students need certifiable skills in:

**Workshop Skills (practical competencies):**
- Measuring & marking out (ruler, square, marking gauge, calipers)
- Sawing techniques (crosscut, rip, curve)
- Drilling (pilot holes, depth stops, speed selection)
- Sanding & finishing (grit progression, grain direction)
- Joining techniques (butt, lap, mortise & tenon, dowel)
- Gluing & clamping (PVA, epoxy, contact adhesive, clamping pressure)
- Filing & rasping (cross-filing, draw-filing, cleaning)
- Soldering (tinning, heat control, joint types)
- 3D printing workflow (slicing, supports, infill, bed adhesion)
- Laser cutting workflow (file prep, material settings, test cuts)

**Design Skills (cognitive competencies):**
- Sketching (isometric, perspective, exploded view)
- Dimensioning & annotation
- Material identification (wood types, metal types, plastic types)
- Reading technical drawings
- Understanding tolerances
- Design for manufacturing
- Sustainability in design

**Digital Skills:**
- CAD basics (Fusion 360, TinkerCAD, Onshape)
- Vector drawing for laser (Illustrator, Inkscape)
- 3D modeling for printing
- Electronics schematic reading

Each skill badge follows the same learn → practice → test pattern but the "practice" element might be different — photo/video upload of their work for teacher verification rather than a quiz.

---

## Recommended Build Order

### Phase 1: Content Richness (makes existing badges world-class)
**~5-7 days. Biggest impact on perceived quality.**

1. **Upgrade learn card renderer** to support rich content blocks (images, video embeds, before/after, step-by-step, knowledge checks). Build `ModuleRenderer.tsx` with cases for all block types.
2. **Add illustrations to existing 2 badges** — machine diagrams, correct/incorrect comparisons, step-by-step procedures. You generate images in another AI, we code the display.
3. **Script and produce 4-6 animated explainer videos** for General Workshop + Hand Tools. You: generate frames + ElevenLabs voiceover. We: build video embed component + timestamp markers.
4. **Write 2-3 "What Went Wrong?" micro-stories** with incident analysis. Illustrated scenes.
5. **Add inline knowledge checks** between learn sections (ComprehensionCheckBlock).

### Phase 2: Badge Library Expansion (makes it comprehensive)
**~8-12 days. This is where teachers go "holy shit, this covers everything."**

1. **Write Tier 1 remaining badges** — Fire Safety & Emergency, PPE Fundamentals (2 badges, ~25 questions + 6 learn cards each)
2. **Write Tier 2 workshop badges** — Wood, Metal, Plastics, Electronics, Digital Fab, Textiles (6 badges)
3. **Write Tier 3 machine badges (high priority)** — Band Saw, Pedestal Drill, Disc Sander, Laser Cutter, 3D Printer (5 badges — the machines almost every school has)
4. **Create Spot-the-Hazard scenes** for: Electronics bench, 3D printing area, textiles room (3 new SVG scenes)
5. **Generate illustrations** for all new badges (you do this in another AI)
6. **Add skill badges** — start with 3-5: Measuring & Marking, Sawing Techniques, Sanding & Finishing, Soldering, 3D Printing Workflow

### Phase 3: UX & Engagement (makes it sticky)
**~5-7 days. Turns one-time use into ongoing resource.**

1. **Badge path visualization** — skill tree showing prerequisites and progression
2. **Progress dashboard** — badge wall, completion tracking, suggested next
3. **Quiz UX overhaul** — progress bar, streaks, per-question feedback, review mistakes mode
4. **Certificate generation** — PDF with student name, badge, date, score, school logo placeholder
5. **Shareable badge images** — download/screenshot optimized
6. **Teacher class dashboard** (free tool) — class codes, assign badges, track completion, export CSV

### Phase 4: Printable Resources (makes it indispensable)
**~4-5 days. This is what teachers can't get anywhere else for free.**

1. **Safety posters** (A3 PDF) — one per machine badge. Visual rules + icons. Print-ready.
2. **Quick reference cards** (A5 PDF) — startup/shutdown checklists per machine
3. **Risk assessment templates** — pre-filled per activity, fillable PDF
4. **PPE requirement charts** — per-activity matrix
5. **Safety induction presentation** (PPTX) — ready to project, covers General + Hand Tools + workshop rules
6. **Student safety contracts** — template with signature line
7. **Workshop audit checklist** — teacher pre-term safety check

### Phase 5: Video Library (makes it premium-feeling)
**~3-5 days for scripting + production coordination. You handle generation/voiceover.**

1. Script all 16-20 videos (we write scripts, you produce)
2. Build video player component with chapter markers + transcript
3. Embed videos into relevant learn card positions in badge modules
4. Create standalone video library page (browsable, searchable)

---

## What Makes This Invaluable (The "Why Would Teachers Come Back?" Test)

1. **It replaces the filing cabinet.** Most D&T teachers have a messy folder of photocopied safety sheets from 2008. This replaces ALL of it with something that actually works and is always current.

2. **It satisfies compliance.** Schools need evidence of safety training. This generates it: certificates, completion records, exportable data. When an inspector asks "how do you ensure students are trained before using the band saw?" — this is the answer.

3. **It saves the first 2 weeks of the year.** Every D&T teacher spends the first 2 weeks doing safety inductions. This automates it. Students do it at their own pace, teacher monitors the dashboard, class can start making things sooner.

4. **The printables are actually good.** Most free safety posters look like they were made in Word 97. These would be designed, modern, and professional. Teachers will print them and put them on their walls. Every poster has your URL on it.

5. **Machine-specific training doesn't exist online.** You can find generic "workshop safety" content, but try finding a good interactive "band saw safety" course for 13-year-olds with scenario questions and a Spot-the-Hazard scene. It doesn't exist. This fills a real void.

6. **The skill badges are unique.** No other platform certifies "can this student measure and mark out accurately?" as a trackable, verifiable skill. Schools talk about competency-based assessment but have no tools for it in D&T.

---

## Competitive Landscape

| Competitor | What They Offer | Why This Is Better |
|---|---|---|
| **D&T Association (UK)** | Static PDFs, paywalled. £100+/year. Old content. | Interactive, free, modern, covers more machines. |
| **iRubric / Rubistar** | Rubric templates only. No training content. | Full training + assessment + certification. |
| **SafeStart / DuPont** | Industrial safety training. Not designed for schools. | Age-appropriate (11-18), curriculum-aligned, free. |
| **YouTube "shop safety"** | Random videos, inconsistent quality, no assessment. | Curated, structured, progressive, with testing. |
| **School-made worksheets** | Every teacher reinvents the wheel. Photocopied, dated. | Professional, consistent, always up to date. |

**The gap in the market is clear:** Nobody has built a comprehensive, interactive, free safety + skills training platform specifically for secondary school D&T workshops. The closest thing is whatever each individual teacher has cobbled together over the years.

---

## Image & Video Production Guide

### Images You'll Generate (in another AI)

**Per machine badge (AI image generation):**
1. Machine anatomy diagram — clean, labeled, isometric or 3/4 view
2. 2-3 correct vs incorrect comparison pairs (e.g., "hair tied back ✓ vs loose hair ✗")
3. Step-by-step startup sequence (4-6 frames)
4. 1 "What Went Wrong?" scene illustration
5. Safety poster hero image

**Style guide for AI image generation:**
- Clean, modern illustration style (not photorealistic — avoid uncanny valley)
- Consistent character design (diverse students, school uniform suggestions)
- Workshop setting that looks like a real school (not industrial)
- Color-coded: green = correct, red = incorrect, amber = caution
- Age-appropriate characters (look 12-16, not adult)
- Include PPE in correct images (safety glasses, apron, tied hair)
- White or light background for learn cards, dark background for poster heroes

**Estimated image count:**
- Tier 1 (4 badges): ~20 images
- Tier 2 (6 badges): ~36 images
- Tier 3 (5 priority machines): ~30 images
- Shared resources: ~15 images
- **Total: ~100 images** (batch-generate in sets of 5-10 per session)

### Videos You'll Produce

**Per video:**
1. Claude writes the script (30-90 seconds, ~75-200 words)
2. You generate 8-15 key frames in another AI (illustration style, consistent with images)
3. You record voiceover in ElevenLabs (professional, clear, slightly warm — think BBC nature documentary narrator, not corporate training)
4. We composite: frames + voiceover + text overlays + transitions in code (or you use a video tool like Canva/CapCut)

**Video embed approach:**
- Host on YouTube (unlisted or channel) or self-host MP4 on Vercel (small files, 720p)
- Embed in learn cards with poster frame + play button
- Auto-generate transcript (ElevenLabs provides timestamps)
- Chapters/timestamps for longer videos

---

## Architecture Notes

### Rich Content Block Types (already spec'd, needs rendering)

```
ModuleRenderer receives a block[] array per badge learn section.
Each block has a `type` field:

- key_concept     → Text card with icon + title + content (current LearnCard, upgraded)
- image           → Full-width or side-by-side image with caption
- video           → Embedded video player with poster frame
- spot_hazard     → Interactive SVG scene (existing SpotTheHazard component)
- before_after    → Side-by-side comparison with red/green labels
- step_sequence   → Numbered steps with images
- micro_story     → Incident narrative with illustration + analysis callout
- check           → Inline knowledge check (1-2 questions, not graded, immediate feedback)
- diagram         → Labeled machine diagram (SVG with hover/click labels)
- poster_preview  → Preview of the downloadable poster with "Download PDF" button
```

### File Structure for New Content

```
src/lib/safety/
  badge-definitions.ts          ← expand with all badges
  scenes.ts                     ← add new SVG scenes
  types.ts                      ← already good
  content/
    general-workshop/
      learn-blocks.ts           ← rich content blocks (images, videos, checks)
      poster.ts                 ← poster data (generates PDF)
      reference-card.ts         ← quick reference card data
    hand-tools/
      learn-blocks.ts
      poster.ts
      reference-card.ts
    band-saw/
      learn-blocks.ts
      ...
    [per badge]

src/components/safety/
  blocks/
    ModuleRenderer.tsx          ← dispatches to correct block component
    SpotTheHazard.tsx           ← exists
    KeyConcept.tsx              ← upgrade from plain card
    ImageBlock.tsx              ← new
    VideoBlock.tsx              ← new
    BeforeAfter.tsx             ← new
    StepSequence.tsx            ← new
    MicroStory.tsx              ← new
    InlineCheck.tsx             ← new
    MachineDiagram.tsx          ← new
    PosterPreview.tsx           ← new
  BadgePath.tsx                 ← skill tree visualization
  BadgeWallPublic.tsx           ← progress dashboard for free tool
  CertificateGenerator.tsx      ← PDF certificate
  ClassDashboard.tsx            ← teacher free-tool dashboard
```
