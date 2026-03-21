# Safety Badge System — Implementation Checklist

**Project:** StudioLoom / Questerra
**Phase:** API Routes (Complete ✅)
**Date Created:** 21 March 2026

## Phase 1: API Routes (✅ COMPLETE)

All 6 API routes implemented and documented.

### Routes Status
- [x] `GET /api/tools/safety/badges` — List all badges
- [x] `GET /api/tools/safety/badges/:slug` — Get single badge
- [x] `POST /api/tools/safety/session` — Create teacher session
- [x] `GET /api/tools/safety/session` — Retrieve teacher session
- [x] `POST /api/tools/safety/start-test` — Initialize test
- [x] `POST /api/tools/safety/submit-test` — Grade test
- [x] `GET /api/tools/safety/results` — Teacher analytics

### Support Files Status
- [x] `src/lib/safety/badge-definitions.ts` — 2 built-in badges + helpers
- [x] `src/lib/safety/types.ts` — TypeScript interfaces (existing)
- [x] `src/app/api/tools/safety/README.md` — Full API documentation
- [x] `SAFETY_API_IMPLEMENTATION.md` — Implementation summary

### Code Quality
- [x] TypeScript strict mode
- [x] Error handling via `withErrorHandler()`
- [x] Rate limiting implemented
- [x] Proper HTTP status codes
- [x] Comprehensive JSDoc comments
- [x] No hardcoded secrets
- [x] Follows Next.js App Router patterns

---

## Phase 2: Database Setup (⏳ PENDING)

Required before routes are functional.

### Migrations to Create

**File:** `supabase/migrations/XXX_safety_badges.sql`

```sql
-- Safety Sessions (teacher classroom sessions)
CREATE TABLE IF NOT EXISTS safety_sessions (
  id TEXT PRIMARY KEY,
  class_code TEXT UNIQUE NOT NULL,
  teacher_email TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  badge_slugs TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_safety_sessions_class_code ON safety_sessions(class_code);
CREATE INDEX idx_safety_sessions_teacher_email ON safety_sessions(teacher_email);

-- Safety Tests (test metadata for grading reference)
CREATE TABLE IF NOT EXISTS safety_tests (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES safety_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  question_ids TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_safety_tests_session_id ON safety_tests(session_id);
CREATE INDEX idx_safety_tests_student_badge ON safety_tests(session_id, student_name, badge_slug);

-- Safety Results (test scores and feedback)
CREATE TABLE IF NOT EXISTS safety_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL,
  session_id TEXT REFERENCES safety_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  badge_slug TEXT NOT NULL,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL,
  time_taken_seconds INT NOT NULL,
  answers JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_safety_results_session_id ON safety_results(session_id);
CREATE INDEX idx_safety_results_student_badge ON safety_results(session_id, student_name, badge_slug);
CREATE INDEX idx_safety_results_created_at ON safety_results(created_at DESC);
```

### Checklist
- [ ] Migration file created
- [ ] `supabase db push` executed
- [ ] Tables verified in Supabase dashboard
- [ ] Indexes created
- [ ] Test data inserted (optional)

---

## Phase 3: Frontend Implementation (⏳ PENDING)

React components to consume the API.

### Components Needed

**Student-Facing:**
- [ ] `SafetyBadgeBrowser` — Browse available badges
- [ ] `JoinSessionForm` — Enter class code to join
- [ ] `TestScreen` — Display questions + answer interface
- [ ] `ResultsScreen` — Show score, feedback, badge status
- [ ] `SafetyToolEntry` — Landing page for free tool

**Teacher-Facing:**
- [ ] `CreateSessionForm` — New session creation
- [ ] `SessionDashboard` — View students + progress
- [ ] `ResultsAnalytics` — Charts + summary stats
- [ ] `ResultsTable` — Sortable/filterable results view
- [ ] `SafetyToolTeacher` — Teacher dashboard page

### Integration Points
- [ ] Landing page: "Free Safety Tool" button → `/tools/safety`
- [ ] Landing page: "For Teachers" section with session creation CTA
- [ ] Student dashboard: "Safety Badges" section (if authenticated)
- [ ] Teacher dashboard: "Class Safety Certifications" section (if teacher)

---

## Phase 4: Testing (⏳ PENDING)

Comprehensive testing before release.

### API Testing

**Manual (cURL):**
- [ ] `GET /api/tools/safety/badges` returns 2 badges
- [ ] `GET /api/tools/safety/badges/general-workshop-safety` returns learn content
- [ ] `POST /api/tools/safety/session` creates with unique code
- [ ] `GET /api/tools/safety/session?code=ABC123` retrieves session
- [ ] `POST /api/tools/safety/start-test` returns 15 shuffled questions
- [ ] Questions DO NOT contain `correct_answer` or `explanation`
- [ ] `POST /api/tools/safety/submit-test` grades correctly
- [ ] Score = 87% when 13/15 correct
- [ ] Badge marked as passed when score ≥ threshold
- [ ] Rate limit: 6th session creation returns 429
- [ ] Retake cooldown: 2nd test within 60min returns 429
- [ ] `GET /api/tools/safety/results` returns aggregated stats

**Automated:**
- [ ] Vitest unit tests for grading logic
- [ ] Integration tests for full test flow
- [ ] Rate limiting tests
- [ ] Error case handling tests

### Functional Testing

**Student Flow:**
- [ ] Student joins with class code
- [ ] Student selects badge
- [ ] Student completes test
- [ ] Student sees results + feedback
- [ ] Student can retake after cooldown

**Teacher Flow:**
- [ ] Teacher creates session
- [ ] Teacher shares code with students
- [ ] Teacher can retrieve session with code
- [ ] Teacher can view all results
- [ ] Teacher sees aggregated stats

### Edge Cases
- [ ] Expired sessions (create very old, try to use)
- [ ] Invalid badge slugs
- [ ] Missing answers (incomplete submission)
- [ ] Duplicate submissions
- [ ] Concurrent test submissions
- [ ] Mobile device compatibility

---

## Phase 5: Documentation & Launch (⏳ PENDING)

User-facing documentation and launch preparation.

### Documentation
- [ ] README.md for free tool landing page
- [ ] Help documentation for students ("How to join")
- [ ] Help documentation for teachers ("Create a session")
- [ ] API documentation endpoint (`/api/tools/safety`)
- [ ] Badge descriptions expanded with learning tips

### Marketing
- [ ] Free tool promoted on landing page
- [ ] Social media post (design teachers on Twitter/LinkedIn)
- [ ] Demo video (1-2 min showing student flow)
- [ ] Case study template (for first customers)

### Quality Assurance
- [ ] All endpoints respond within 200ms
- [ ] Error messages are user-friendly
- [ ] Mobile responsive design
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Security audit (no data leaks, auth working)

### Launch Checklist
- [ ] Database migrations applied to production
- [ ] All routes deployed to Vercel
- [ ] Environment variables set (`ANTHROPIC_API_KEY`, etc.)
- [ ] Monitoring enabled (Sentry, analytics)
- [ ] Load testing (expected traffic projection)
- [ ] Canary deployment (5% of traffic first)
- [ ] Full rollout (100% traffic)

---

## Phase 6: Future Enhancements (🔮 BACKLOG)

Planned improvements for future releases.

### Short-term (1-2 weeks)
- [ ] Teacher-created custom badges
- [ ] Import questions from CSV
- [ ] Bulk student upload (class roster)
- [ ] Email: Session created notification
- [ ] Email: Results summary to teacher

### Medium-term (1-2 months)
- [ ] Adaptive difficulty (questions adjust per student)
- [ ] Question bank expansion (50+ per badge)
- [ ] Hint system (AI-powered with Claude)
- [ ] Audio/video alternatives for accessibility
- [ ] Mobile app (React Native)

### Long-term (3-6 months)
- [ ] Integration with student portfolio
- [ ] Badge sharing on social media
- [ ] Progress tracking over time
- [ ] Comparative analytics (vs. other classes)
- [ ] Curriculum alignment (IB MYP, GCSE DT, etc.)
- [ ] Real-time leaderboards (class competition)

---

## Time Estimate

| Phase | Complexity | Estimated Time |
|-------|-----------|-----------------|
| Phase 1 (API Routes) | Low | **2-3 hours** ✅ DONE |
| Phase 2 (Database) | Very Low | **20-30 min** |
| Phase 3 (Frontend) | Medium | **8-10 hours** |
| Phase 4 (Testing) | Medium | **4-6 hours** |
| Phase 5 (Docs/Launch) | Low | **3-4 hours** |
| **Total** | **—** | **~18-24 hours** |

**Current Progress:** 2.5 hours (Phase 1 complete)
**Remaining:** ~15-21 hours (Phases 2-5)

---

## Success Criteria

✅ **Phase 1 Success:**
- All 6 routes implemented and error-handled
- 2 built-in badges with 15+ questions each
- Comprehensive documentation
- No external dependencies beyond existing codebase

✅ **Full Launch Success:**
- 100+ teachers have used the tool
- 1000+ students have completed at least one badge test
- Average session completes in < 2 minutes
- NPS > 7/10 for teacher satisfaction
- Zero security incidents or data leaks

---

## Notes

### Key Design Decisions
1. **Public endpoints** — no auth required (free lead-gen tool)
2. **6-char codes** — simple, shareable, human-readable
3. **Session-based** — scalable without user accounts
4. **Deterministic grading** — fast, predictable, no AI calls
5. **Question stripping** — prevents cheating via network inspection

### Trade-offs
- **No login required** → can't track individual student accounts across sessions (acceptable for free tool)
- **In-memory rate limits** → resets on Vercel redeploy (acceptable, can upgrade to DB-backed later)
- **2 built-in badges** → limited scope (customers want more, planned for Phase 6)

### Open Questions
- Should we collect email/names for marketing?
- Should badges be shareable on social media?
- Should teachers get notifications when students complete?
- Should there be a paid "premium" version with custom badges?

---

**Last Updated:** 21 March 2026
**Next Review:** After Phase 2 database setup
