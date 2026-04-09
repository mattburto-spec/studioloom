# Project Tracking System Sync Report
**Generated:** April 7, 2026
**Audit Scope:** ALL-PROJECTS.md ↔ dashboard.html ↔ system-architecture-map.html ↔ WIRING.yaml

---

## SUMMARY

The project tracking system is **PARTIALLY OUT OF SYNC**. While the system architecture registry is fully synchronized, the project dashboard has a significant mismatch with the master project index.

| Component | Status | Details |
|-----------|--------|---------|
| **Project Names Sync** | ⚠️ MISMATCHED | 66 projects in dashboard.html missing from ALL-PROJECTS.md; 4 projects in ALL-PROJECTS.md missing from dashboard.html |
| **Project Status Sync** | ⚠️ MISMATCHED | 1 status mismatch found (3D Elements / Designville) |
| **System Architecture Sync** | ✅ PERFECT | All 92 systems match between WIRING.yaml and system-architecture-map.html |

---

## 1. PROJECT NAME DISCREPANCIES

### A. In dashboard.html but NOT in ALL-PROJECTS.md (66 projects)

These are the COMPLETED and SUPERSEDED projects that should have been removed from dashboard.html or added to ALL-PROJECTS.md as reference entries.

**Complete/Superseded Features (45 projects):**
- Academic Integrity Monitoring
- Admin AI Controls Redesign
- Class Gallery & Peer Review
- Comic Strip Discovery
- Competitive Analysis
- Cross-Container DnD
- Design Thinking Toolkit (Public)
- Dimensions2
- Dimensions3 Spec Finalization
- Discovery Engine (8 Stations)
- Grading System
- Kahoot-Style Quizzes
- Landing Page
- Lesson Editor AI Assist
- Lesson Pulse Phase 1
- Lesson Timing Engine
- Makloom (Consumer Version)
- NM / Melbourne Metrics Phase 1
- Old Own Time system
- Open Studio v1
- Parent Weekly Updates
- Performance Optimizations
- Phase 0.5 Lesson Editor
- Project Dimensions v2
- QA Testing Dashboard
- Report Writer (Free Tool)
- Safety Badges
- School Calendar / Terms
- Smart Insights Panel
- Student Dashboard Redesign
- Student Learning Profile
- Student Onboarding / Studio Setup
- Student-Class Junction
- Teaching Mode (Live Cockpit)
- Timetable & Scheduling
- Toolkit (27 Interactive Tools)
- Unit Forking / Unit-as-Template
- Unit Generation Phases 0-3
- Unit Thumbnails
- Unit Type Framework Architecture

**Idea/Planned Items Missing from ALL-PROJECTS.md (21 projects):**
- AI Context Protocol
- AI-Generated Diagrams
- Bug Report Button
- Competitive Free Activities
- Core Cards Spanning Lessons
- Event Bus (In-Process)
- Feature Flag System
- Fun AI Thinking Messages
- Lesson Export (PPT/PDF/Worksheet)
- More Wizard Variation
- Multi-Language / i18n
- Peer Feedback Stations
- Processing Queue / Async Jobs
- Teacher Projector/Present Mode
- Teacher↔Student Messaging
- Textbook Source Flagging
- Unified Search
- VEX Robotics / Engineering Layer

### B. In ALL-PROJECTS.md but NOT in dashboard.html (4 projects)

These are ACTIVE/PLANNED projects that are in the authoritative source but missing from the dashboard with exact name match:

1. **Designer Mentor System — Personalised AI Mentoring via Real Designers** (ACTIVE, P1)
   - Listed as ACTIVE in ALL-PROJECTS.md lines 59–61
   - Present in dashboard.html but with different name: "Designer Mentor System" (missing full subtitle)

2. **Intelligence Profiles (Teacher & Student)** (PLANNED, P1)
   - Listed in ALL-PROJECTS.md lines 107–109
   - Present in dashboard.html but with truncated name: "Intelligence Profiles" (missing "Teacher & Student")

3. **Open Studio v2 — Mentor-Guided Project Planning** (PLANNED, P1)
   - Listed in ALL-PROJECTS.md lines 91–93
   - Present in dashboard.html as "Open Studio v2 — Mentor-Guided Planning" (subtitle differs: "Planning" vs "Project Planning")

4. **Work Capture Pipeline — AI Mentor Feedback on Student Work** (ACTIVE, P1)
   - Listed in ALL-PROJECTS.md lines 55–57
   - Present in dashboard.html as "Work Capture Pipeline — AI Mentor Feedback" (missing "on Student Work" suffix)

**Root cause:** The dashboard.html has slightly different display names (shortened or variant titles) for these 4 projects. Functionally they are the same projects, just with different name formatting.

---

## 2. PROJECT STATUS MISMATCHES

### ONE STATUS MISMATCH FOUND

| Project | ALL-PROJECTS.md | dashboard.html | Issue |
|---------|-----------------|----------------|-------|
| **3D Elements / Designville** | 🔴 ACTIVE (P2 research) | 🔬 RESEARCH | Inconsistency in status classification |

**Details:**
- ALL-PROJECTS.md line 68: Listed under "## 🔴 Active Projects" but labeled "(research)" in the status line
- dashboard.html line 263: Listed with status `"research"`
- **Interpretation:** ALL-PROJECTS.md treats it as conceptually "active" (currently being researched) but dashboard treats it as "research" status (distinct category)
- **Fix required:** Clarify intent — either move to "## 🔬 RESEARCH" section in ALL-PROJECTS.md OR update dashboard status to "active" if it's actively being researched in this sprint

---

## 3. SYSTEM ARCHITECTURE SYNC

### PERFECT ALIGNMENT ✅

**WIRING.yaml:** 92 systems
**system-architecture-map.html:** 92 systems
**Mismatch:** NONE

All system IDs match perfectly between the two files. The wiring diagram and visual architecture map are synchronized.

Sample verified systems:
- lesson-view, student-dashboard, student-onboarding, discovery-engine
- activity-blocks, journey-engine, generation-pipeline, ai-mentor
- integrity-monitor-student, intelligence-profiles, student-work-pipeline
- All 92 systems confirmed in both sources

---

## 4. ROOT CAUSES & RECOMMENDATIONS

### Issue A: Dashboard.html has stale completed/superseded projects

**Why it happened:**
- Dashboard.html contains entries for projects that shipped in earlier phases
- ALL-PROJECTS.md is the designated "single source of truth" per CLAUDE.md instructions
- Dashboard.html needs periodic cleanup to remove completed items or move them to archive

**Fix:**
1. Remove all 45 completed/superseded projects from dashboard.html PROJECTS array
2. Keep only ACTIVE, RESEARCH, READY, PLANNED, and IDEA status projects
3. Create a separate "COMPLETE_ARCHIVE" array if historical tracking is needed
4. Re-sync before next sprint planning

### Issue B: Truncated/variant project names

**Why it happened:**
- Some projects have been shortened in dashboard display (for visual space)
- Names diverged during iteration without formal reconciliation
- This causes confusion when cross-referencing: "Designer Mentor System" vs "Designer Mentor System — Personalised AI Mentoring via Real Designers"

**Fix:**
- Standardize names across both files
- Use ALL-PROJECTS.md as the authoritative name source
- Update dashboard.html to match exactly
- Consider using a "displayName" property in dashboard data if abbreviation is needed for space

### Issue C: 3D Elements status ambiguity

**Why it happened:**
- Project is marked as "(research)" phase within "ACTIVE" section
- Dashboard interprets this as "research" status (distinct from "active")
- Unclear intent: is it actively being researched this sprint or parked for future research?

**Fix:**
- Clarify in next sprint planning meeting:
  - If actively being researched now → keep as "active" in dashboard
  - If parked pending Dimensions3 completion → move to "## 🔬 RESEARCH" section in ALL-PROJECTS.md and update dashboard
- Update CLAUDE.md line 68 to remove ambiguity

---

## 5. VERIFICATION CHECKLIST

Run the following to verify future syncs:

```bash
# Extract and compare project names
grep '{ name: "' dashboard.html | sed 's/.*{ name: "//' | sed 's/", status.*//' | sort > /tmp/dash-names.txt
grep '^### ' ALL-PROJECTS.md | grep -v '##' | sed 's/^### //' | sort > /tmp/allproj-names.txt
comm -23 /tmp/dash-names.txt /tmp/allproj-names.txt  # Projects in dashboard but not in ALL-PROJECTS

# Verify system counts
grep "^  - id: " WIRING.yaml | wc -l  # Should be 92
grep "id: \"" system-architecture-map.html | grep -v "meta" | wc -l  # Should be 92

# Check status consistency
# (See detailed audit methodology in section 1-2 above)
```

---

## 6. NEXT ACTIONS (Priority Order)

1. **IMMEDIATE:** Fix the 4 name discrepancies (Designer Mentor, Intelligence Profiles, Open Studio v2, Work Capture)
   - Estimated effort: 5 minutes
   - Impact: Clarity in cross-file references

2. **IMMEDIATE:** Clarify 3D Elements status classification
   - Estimated effort: 2 minutes (decision) + 1 minute (edit)
   - Impact: Removes ambiguity

3. **THIS WEEK:** Remove or archive 45 completed projects from dashboard.html
   - Estimated effort: 10 minutes (script-assisted cleanup)
   - Impact: Dashboard reflects only current work

4. **ONGOING:** Add pre-commit hook to validate project name consistency
   - Estimated effort: 30 minutes
   - Impact: Prevents future drift

---

## FILES AUDITED

- `/sessions/gifted-affectionate-volta/mnt/questerra/docs/projects/ALL-PROJECTS.md` (286 lines, last updated 7 Apr 2026)
- `/sessions/gifted-affectionate-volta/mnt/questerra/docs/projects/dashboard.html` (480 lines, 86 projects)
- `/sessions/gifted-affectionate-volta/mnt/questerra/docs/projects/system-architecture-map.html` (23,942 lines, 92 systems)
- `/sessions/gifted-affectionate-volta/mnt/questerra/docs/projects/WIRING.yaml` (24,212 lines, 92 systems)
