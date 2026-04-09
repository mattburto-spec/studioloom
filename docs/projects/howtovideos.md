# Project: How-To Videos & Teaching Resources

**Status:** Planning
**Created:** 5 Apr 2026
**Owner:** Matt

## Problem

StudioLoom needs high-quality instructional videos and images for:
- Workshop safety and technique demonstrations (lathe, drill press, band saw, soldering, etc.)
- Design process how-to guides
- Student self-help area
- Step-by-step visual walkthroughs embedded in lessons

Filming professional videos from scratch is a massive time investment. YouTube has thousands of hours of excellent workshop footage, but embedding third-party videos breaks visual consistency and creates dependency on external links.

## Vision

A tiered content pipeline that produces visually consistent instructional media matching StudioLoom's aesthetic, with the mentor characters (Kit/Sage/Spark) as guides throughout.

## Three-Tier Approach

### Tier 1: R3F-Generated (Simple/Conceptual)

**Best for:** Design process steps, planning workflows, digital tool walkthroughs, abstract concepts, simple tool identification, workspace layout orientation.

- Uses the R3F scene renderer from the 3D Elements system
- Low-poly mentor character demonstrates the concept
- Full control over camera, lighting, pacing
- Zero copyright concerns
- Cheapest to produce at scale

**Examples:** "How the design cycle works", "Setting up your project plan", "Using the toolkit tools", "Workshop layout orientation"

### Tier 2: Film-Your-Own + AI Restyle (Physical Skills)

**Best for:** Hands-on workshop techniques where precision matters — lathe operation, band saw safety, soldering, hand tool use, material preparation.

**Pipeline:**
1. Matt films in the workshop during teaching (phone camera, just hands + machine + material, no face needed)
2. AI restyles the footage for visual consistency (environment/colour grading/aesthetic, NOT regenerating hand movements)
3. Mentor character appears as picture-in-picture narrator or intro/outro guide
4. Voiceover recorded or generated with mentor's voice

**Why this works:**
- Matt is already in the workshop all day teaching — filming is incremental effort
- Hands + machine footage is the hardest thing for AI to generate from scratch (fine motor precision)
- Restyling backgrounds/colour grading is technically feasible today (much simpler than full video-to-video generation)
- Your footage, your workshop = zero copyright concern
- Students see real technique, not AI approximation of technique

**Practical filming tips:**
- Mount phone on a simple clamp/tripod pointing at the work area
- Film during actual demonstrations to students (you're already doing it)
- 30-60 second clips per technique step (short is better)
- Good lighting matters more than camera quality
- Film from student's POV (looking at the machine the way they'd stand)
- Capture common mistakes too (what NOT to do is as valuable as what to do)

**AI restyle options to explore:**
- Runway Gen-3 / Act-One for style transfer
- Background replacement (keep hands/machine sharp, restyle surroundings)
- Colour grading to match StudioLoom palette
- Adding overlay graphics (safety zones highlighted, measurement callouts)

### Tier 3: Licensed + Restyled (Complex Demonstrations)

**Best for:** Techniques Matt can't easily film himself — industrial processes, specialist equipment, advanced techniques beyond school workshop scope.

**Pipeline:**
1. Identify excellent YouTube demonstrations as reference
2. Contact creator for explicit licensing permission (many educational creators are receptive)
3. With permission, restyle footage to match platform aesthetic
4. Replace voice with mentor narration
5. Credit original creator

**Important copyright notes:**
- Using YouTube footage as motion/choreography reference — even fully restyled — is legally grey without permission
- The safer path is always explicit licensing
- Many maker/workshop YouTubers would license a clip for reasonable fees, especially for educational use
- Some creators may prefer attribution over payment
- Creative Commons licensed content is another source (check license terms for derivative works)

**Alternative for Tier 3:** Use YouTube videos purely as *reference* for what angles, sequences, and pacing work well, then film your own version following the same approach. This is completely clean legally (you can't copyright a camera angle or demonstration sequence in isolation).

## Mentor Integration Across All Tiers

Regardless of tier, the mentor character is always present:
- **Intro panel:** Kit/Sage/Spark introduces the skill and why it matters
- **Narration:** Mentor voice guides through the steps (can be AI-generated TTS matching mentor personality)
- **Safety callouts:** Mentor appears as overlay when critical safety points arise
- **Reflection prompt:** Mentor asks a question at the end ("Before you try this, what's the first thing you'll check?")

This keeps the learning experience consistent with the rest of StudioLoom — the mentor is the constant thread.

## Where These Live in the Platform

- **Safety Badge learning cards** — short technique clips as part of badge test prep
- **Lesson editor blocks** — teachers embed videos as activity content (new `video` response type or media block)
- **Student self-help area** — searchable library of how-to clips
- **Teaching Mode projector** — teacher plays video during mini-lesson phase
- **Toolkit tools** — contextual video hints ("here's how to use a band saw for this step")

## Content Categories (Initial Brainstorm)

### Workshop Safety (Priority — feeds Safety Badges)
- Machine-specific: lathe, band saw, drill press, scroll saw, laser cutter, 3D printer
- General: PPE, workshop rules, fire safety, dust extraction, material handling
- Tool-specific: hand saws, chisels, files, craft knives, soldering irons, hot glue guns

### Design Process Techniques
- Sketching and rendering techniques
- Model-making basics (card, foam, MDF)
- Prototyping methods
- Testing and evaluation approaches

### Digital Tools
- CAD software basics (Fusion 360, TinkerCAD, etc.)
- Graphic design for presentations
- Documentation and portfolio techniques

### Materials Knowledge
- Material properties and selection
- Finishing techniques (sanding, painting, varnishing)
- Joining methods (glue, screws, joints)

## Technical Requirements

- **Format:** MP4, 720p minimum (1080p preferred)
- **Duration:** 30-90 seconds per clip (micro-learning), 3-5 minutes for full technique guides
- **Aspect ratio:** 16:9 for desktop/projector, consider 9:16 crops for mobile
- **Captioning:** Auto-generated with review (accessibility requirement)
- **Storage:** Video hosting TBD — Vercel is not suitable for video. Options: Cloudflare Stream, Mux, Bunny.net, or S3+CloudFront
- **Delivery:** Adaptive bitrate streaming for school network bandwidth constraints

## Relationship to 3D Elements Project

The R3F system from `docs/projects/3delements.md` covers Tier 1. Specifically:
- Tutorial Engine (Layer 3) with Guided Skill mode handles step-by-step 3D demonstrations
- Safety Scene mode handles hazard identification in 3D environments
- Visual Step Diagram mode handles annotated process breakdowns

Tier 2 and 3 are complementary — real video for physical precision, R3F for conceptual/spatial understanding. A student learning lathe safety might see:
1. R3F scene showing the lathe parts and safety zones (Tier 1)
2. Real video of hands operating the lathe correctly (Tier 2)
3. R3F interactive hazard identification exercise (Tier 1)

## Open Questions

1. **Video hosting platform** — need something affordable that handles adaptive streaming and works well in school networks (many block YouTube/Vimeo)
2. **AI restyle quality** — need to test Tier 2 pipeline with a real clip to see if the output quality is acceptable. Suggest filming 2-3 test clips and running through available tools.
3. **Mentor voice** — ElevenLabs TTS for each mentor? Or Matt records voiceovers? TTS is scalable but may feel less authentic.
4. **Volume estimate** — how many videos total? Safety alone could be 30-50 clips. Full coverage across all categories might be 200+.
5. **Student-generated content** — could students contribute clips as part of their learning (film themselves demonstrating a technique they've mastered)? Feeds portfolio + helps build the library.
6. **Localisation** — if StudioLoom expands internationally, videos need to work across languages. Visual-heavy with overlay text is more translatable than narration-heavy.

## Next Steps

- [ ] Matt films 2-3 test clips in the workshop (different techniques, different lighting conditions)
- [ ] Test AI restyle pipeline on the clips (try Runway, background replacement, colour grading)
- [ ] Evaluate output quality — is it good enough for production use?
- [ ] Decide on video hosting platform
- [ ] Prioritise which Safety Badge videos to produce first
- [ ] Estimate total video count needed for launch
