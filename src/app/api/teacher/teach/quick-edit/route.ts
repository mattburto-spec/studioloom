// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

/**
 * PATCH /api/teacher/teach/quick-edit
 *
 * Allows teachers to make quick inline edits to lesson content during live teaching.
 * Updates the unit's JSONB content for the specified page.
 *
 * Body: { unitId, pageId, content: { learningGoal?, hook?, focus?, debriefPrompt? }, timing?: { opening?, miniLesson?, workTime?, debrief? }, notes?: string }
 */
export const PATCH = withErrorHandler("teacher/teach/quick-edit:PATCH", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body = await request.json();
  const { unitId, pageId, content, timing, notes } = body;

  if (!unitId || !pageId) {
    return NextResponse.json({ error: "unitId and pageId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify teacher owns this unit
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, author_teacher_id, skeleton")
    .eq("id", unitId)
    .single();

  if (unitError || !unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  if (unit.author_teacher_id !== teacherId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Find the page in the skeleton and update its content
  const skeleton = unit.skeleton as any;
  if (!skeleton?.pages) {
    return NextResponse.json({ error: "Unit has no pages" }, { status: 400 });
  }

  const pageIndex = skeleton.pages.findIndex((p: any) => p.id === pageId);
  if (pageIndex === -1) {
    return NextResponse.json({ error: "Page not found in unit" }, { status: 404 });
  }

  const page = skeleton.pages[pageIndex];
  const pageContent = page.content || {};

  // Apply content edits
  if (content) {
    if (content.learningGoal !== undefined) pageContent.learningGoal = content.learningGoal;
    if (content.hook !== undefined) pageContent.hook = content.hook;
    if (content.focus !== undefined) pageContent.focus = content.focus;
    if (content.debriefPrompt !== undefined) pageContent.debriefPrompt = content.debriefPrompt;
  }

  // Apply timing edits (update workshopPhases durations)
  if (timing && pageContent.workshopPhases) {
    const wp = pageContent.workshopPhases;
    if (timing.opening !== undefined) wp.opening = { ...wp.opening, duration: timing.opening };
    if (timing.miniLesson !== undefined) wp.miniLesson = { ...wp.miniLesson, duration: timing.miniLesson };
    if (timing.workTime !== undefined) wp.workTime = { ...wp.workTime, duration: timing.workTime };
    if (timing.debrief !== undefined) wp.debrief = { ...wp.debrief, duration: timing.debrief };
  }

  // Apply notes
  if (notes !== undefined) {
    pageContent.teacherNotes = notes;
  }

  // Write back
  skeleton.pages[pageIndex].content = pageContent;

  const { error: updateError } = await supabase
    .from("units")
    .update({ skeleton, updated_at: new Date().toISOString() })
    .eq("id", unitId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save edits" }, { status: 500 });
  }

  return NextResponse.json({ success: true, pageId, updatedFields: {
    ...(content ? { content: Object.keys(content) } : {}),
    ...(timing ? { timing: Object.keys(timing) } : {}),
    ...(notes !== undefined ? { notes: true } : {}),
  }});
});
