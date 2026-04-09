# Matt's Spec Review Questions — Dimensions3
**Date: 3 April 2026**
**Context: Read the printed Dimensions3-Spec-Printable.docx**

---

1. Discovery engine is an 8 room journey in its current form but the engine we built there is the basis for many journeys that are tailored for different purposes. Will eventually need a journey creator that teachers could use too but that's way down the track. But my question for now is how are journeys stored. I think they should also be activity blocks that are a category called journeys that can be dragged into a lesson. One idea related to this is a 'real' client journey that helps with empathy etc and the student needs to meet with them a few times while they are working through their unit. This would be a really cool application and you should create a new project called 'realclient' to deal with this later.

2. How is inappropriate content from student text/sound responses, uploads (including pics, vids, etc), AI chat, gallery posts etc being monitored and reported? Safety is going to be a critical area.

3. How do teachers setup assessments? Are they blocks or can blocks be turned into assessments?

4. One kind of block are AI critics who can respond to student work. They may be famous people etc that a student picks to give feedback.

5. Do we need to plan for same-school architecture now or is that a different project? I'm referring to students at same school but in different teacher's classes and implications there.

6. Ingestion question especially when in student lesson view — can AI assess student drawings, sketches, plans, photos, videos, etc against a rubric and provide feedback? This would be good for instant feedback, for the 'real client' to comment, and for the system to learn.

7. On p7 in Stage 0 just want to confirm that the framework string and the curriculumContext string are different. This raises a question of where is the system learning about the curriculum. Those need to be chunked so that whole curriculum docs aren't being read by AI. This needs more attention and thought as some teachers need to meet curriculum requirements for content and time so it needs to be done well. I'm not sure if a teacher needs to be able to pick specific outcomes at Stage 0 or they are OK by creating a unit and in the last stage the outcomes are matched to each lesson/activity with best-fit matching.

8. On this same area, is 'periodMinutes: number' the way the system knows how many lessons there are in the unit to help plan out the length?

9. On page 17 there is a unit import section and I'm wondering how is this system going to get smarter over time because every teacher has a different format etc.

10. Top of page 20 it says a single activity lasting 5-35 mins. Actually it could be longer e.g. my wife taught at a school with 80 min periods.

11. Page 23 can the block interaction model be tested in sandbox? If not then we need to have a way to do that but in a way that separates it from the other variables i.e. once the unit gets to that part of the pipeline it can be exported to another testing sandbox (another tab) to focus just on the block interaction.

12. Page 31 there is some security but is this industry best? Do we need more because it's for schools?

13. Page 41. It looks at a staged removal of old code but it can be removed now. No teachers using the site right now.

14. Page 47 about the framework adaptor interface: is this testable? Need to be able to see output.

15. Open Studio hasn't been designed yet but it's essentially going to be journey + goal setting + report back to teacher with student doing their thing. I do wonder if more scaffolding is needed. Perhaps to begin with that's the teacher dragging appropriate blocks in e.g. time management mini unit. But perhaps some activity blocks or journey blocks could be a way to help student find out what they need and as a result a few suggested mini units or blocks are suggested for them to build into their Open Studio. Can you create an Open Studio project and drop this idea in there too and then think if we need to do anything about this now.

16. Any other platform safety considerations.

17. Monetisation — need a project called monetisation as eventually need to manage this in the admin dashboard so need a page there, need to be able to add Stripe, and what else? But for now do we need to do anything with the architecture to set limits to how much each tier can access e.g. free only has 30 students and 1 class and 30 units, $10 gets 5x that and $50 gets unlimited.

18. Do the blocks allow for dynamic content and how is it stored e.g. SCAMPER is a tool we developed which is going to become an activity block. How is it categorised and how are the AI features and interactive aspects and content stored? Eventually there may be more demand for interactive rich activity blocks so I want to understand the limits right now in case we want to expand on them.
