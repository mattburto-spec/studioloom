# Student Choice Units

**Status:** Idea / Future Phase
**Priority:** Low (depends on content library being populated first)
**Estimated effort:** ~3-5 days (Phase 1)
**Created:** 2 April 2026

---

## Concept

Once the platform has a library of units (teacher-created + uploaded + converted from lesson plans), students could be given a **Choice Unit** — a self-directed project where they pick their own unit from a teacher-curated list.

This combines:
- **Open Studio** (self-directed working mode) with
- **Discovery Engine** (project-finding exploration) and
- **Unit-as-Template Architecture** (units as reusable content)

The teacher curates a shortlist of available units. The student browses, selects, and works through their chosen unit at their own pace. Different students in the same class could be working on different units simultaneously.

---

## Why This Matters

- **Student agency** — the strongest lever for engagement (Hattie d=0.61 for student choice)
- **Differentiation** — students pick units matching their interests and skill level
- **Real MYP practice** — Personal Project and Community Project already require student-chosen topics
- **Portfolio diversity** — class gallery becomes richer when students work on different things
- **Teacher workload** — once units exist in the library, the teacher's role shifts from content creator to curator and mentor

---

## How It Could Work

### Teacher Setup
1. Teacher creates a **Choice Round** on a class (similar to Gallery Round creation)
2. Selects units from their library (own units, shared units, converted uploads)
3. Sets constraints: min/max duration, required design phases, criteria focus
4. Optionally tags units with difficulty level or recommended-for profiles
5. Sets a deadline or term window

### Student Experience
1. Student sees "Choose Your Project" card on dashboard (similar to Discovery Journey entry point)
2. Browse available units — card view with thumbnails, descriptions, difficulty badges, estimated duration
3. Optional: AI recommendation based on Discovery Profile + Learning Profile ("Based on your interests, you might like...")
4. Student selects → unit assigned to them via `class_units` junction
5. Works through the unit like any other, but with Open Studio-level autonomy
6. Teacher monitors via Teaching Mode / Progress grid (different students on different units)

### Data Model
- New `choice_rounds` table (class_id, available_unit_ids[], constraints JSONB, deadline)
- New `student_choices` table (student_id, choice_round_id, unit_id, chosen_at, status)
- Or simpler: just use `class_units` + `class_students` with a `choice_round_id` tag

---

## Dependencies

- **Content library must exist** — this only works when there are enough units to choose from
- **Unit-as-Template architecture** — already built (migration 040)
- **Open Studio mode** — already built (students working independently)
- **Discovery Engine profiles** — already built (for AI recommendations)
- **Unified Upload Architecture** — the "Convert to Unit" flow feeds the library

---

## Phases

### Phase 1: Basic Choice (~3 days)
- Choice Round creation UI on Class Hub
- Student browse + select flow
- Progress tracking across mixed units in one class
- Teaching Mode showing which unit each student is on

### Phase 2: Smart Recommendations (~2 days)
- AI suggests units based on Discovery Profile archetype
- Difficulty matching based on Learning Profile confidence level
- "Students like you also chose..." collaborative filtering

### Phase 3: Peer Grouping (~2 days)
- Students on the same unit can see each other
- Mini gallery within a choice round
- Peer review across different units (cross-pollination)

---

## Architectural Notes

- This is essentially a **many-to-many assignment** — one class, many units, each student picks one
- The existing `class_units` junction already supports multiple units per class
- The key new thing is the **student selection step** — currently teachers assign units to classes, not students to units
- Teaching Mode needs a "group by unit" view alongside "group by student"
- Progress grid needs to handle students on different page sets

---

## Connections to Existing Features

| Feature | Connection |
|---------|-----------|
| Unit-as-Template | Units are already reusable templates — perfect for a choice library |
| Discovery Engine | Archetype data feeds smart recommendations |
| Open Studio | Choice units naturally use Open Studio autonomy level |
| Class Gallery | Cross-unit gallery rounds for peer review diversity |
| Lesson Pulse | Can score available units to show quality indicators |
| Teaching Moves | Phase-matched moves still work per-unit |
| Safety Badges | Can be prerequisites for specific choice units |

---

## Open Questions

- Should students be able to propose their own unit (not from the list)? → Probably Phase 3+
- How does grading work when students are on different units with different criteria? → Same as PP/CP — individual assessment
- Can a student switch units mid-way? → Probably yes with teacher approval, but progress resets
- Does this replace Discovery for Mode 2 units, or complement it? → Complement — Discovery finds the *type* of project, Choice selects the *specific* unit
