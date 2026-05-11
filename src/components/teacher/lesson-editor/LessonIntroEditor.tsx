"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PageContent, ActivityMedia } from "@/types";
import { looksLikeVideoUrl } from "@/lib/video-embed";
import { ImageUploadButton } from "./ImageUploadButton";

interface LessonIntroEditorProps {
  pageContent: PageContent;
  onUpdate: (partial: Partial<PageContent>) => void;
  /** Required by ImageUploadButton — scopes the storage path under unit-images/{unitId}/blocks/. */
  unitId: string;
}

/**
 * LessonIntroEditor — exposes the lesson-level fields the student page
 * renders above activities (success_criteria, introduction.text, hero
 * video/image URL). These are NOT activity prompts — they're the
 * "Why this matters" + "Watch" + "I can..." surface above the activity
 * list on the student lesson view.
 *
 * Collapsible to stay out of the way once filled in.
 */
export default function LessonIntroEditor({
  pageContent,
  onUpdate,
  unitId,
}: LessonIntroEditorProps) {
  const hasContent =
    !!pageContent.introduction?.text ||
    !!pageContent.introduction?.media?.url ||
    (pageContent.success_criteria?.length || 0) > 0;
  const [open, setOpen] = useState(hasContent);

  const successCriteriaText = (pageContent.success_criteria || []).join("\n");
  const introText = pageContent.introduction?.text || "";
  const mediaUrl = pageContent.introduction?.media?.url || "";
  const mediaType: ActivityMedia["type"] =
    pageContent.introduction?.media?.type ||
    (looksLikeVideoUrl(mediaUrl) ? "video" : "image");

  const updateIntroText = (text: string) => {
    const current = pageContent.introduction;
    const next = { text, media: current?.media, links: current?.links };
    if (!next.text && !next.media?.url && !next.links?.length) {
      onUpdate({ introduction: undefined });
    } else {
      onUpdate({ introduction: next });
    }
  };

  const updateMediaUrl = (url: string) => {
    const trimmed = url.trim();
    const current = pageContent.introduction;
    const text = current?.text || "";
    const links = current?.links;
    const media = trimmed
      ? { type: looksLikeVideoUrl(trimmed) ? ("video" as const) : ("image" as const), url: trimmed }
      : undefined;
    if (!text && !media?.url && !links?.length) {
      onUpdate({ introduction: undefined });
    } else {
      onUpdate({ introduction: { text, media, links } });
    }
  };

  const updateSuccessCriteria = (text: string) => {
    const lines = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate({ success_criteria: lines.length > 0 ? lines : undefined });
  };

  const fieldsFilled =
    [
      pageContent.success_criteria?.length ? 1 : 0,
      pageContent.introduction?.text ? 1 : 0,
      pageContent.introduction?.media?.url ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

  return (
    <div className="mt-4 le-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-[var(--le-hair-2)] transition-colors text-left"
      >
        <span className="w-5 h-5 rounded-md border border-[var(--le-hair)] text-[10px] font-extrabold flex items-center justify-center bg-[var(--le-paper)] text-[var(--le-ink-2)]">
          {open ? "−" : "+"}
        </span>
        <span className="text-[14px]">📖</span>
        <div className="text-[13px] font-extrabold text-[var(--le-ink)]">Lesson Intro</div>
        <div className="text-[11px] text-[var(--le-ink-3)]">· what students see above the activities</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10.5px] font-extrabold tracking-wider uppercase px-2 py-[3px] border rounded-full bg-[var(--le-paper)] text-[var(--le-ink-2)] border-[var(--le-hair)]">
            {fieldsFilled}/3 filled
          </span>
        </div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="overflow-hidden"
      >
        <div className="px-3.5 pb-3.5 pt-1 space-y-4">
          {/* Why this matters / introduction.text */}
          <div>
            <label className="text-[10px] le-cap text-[var(--le-ink-3)] block mb-1">
              Why this matters
              <span className="ml-1 font-normal text-[var(--le-ink-3)] tracking-normal normal-case">
                — short paragraph (1–3 sentences) that frames the day
              </span>
            </label>
            <textarea
              value={introText}
              onChange={(e) => updateIntroText(e.target.value)}
              placeholder="Today we close the loop — wheels and weight distribution are the final pieces of the puzzle…"
              rows={3}
              className="w-full px-3 py-2 text-[12.5px] leading-relaxed bg-[var(--le-bg)] border border-[var(--le-hair)] rounded-md text-[var(--le-ink-2)] focus:outline-none focus:border-[var(--le-ink-2)]"
            />
          </div>

          {/* Hero video/image */}
          <div>
            <label className="text-[10px] le-cap text-[var(--le-ink-3)] block mb-1">
              Hero video or image
              <span className="ml-1 font-normal text-[var(--le-ink-3)] tracking-normal normal-case">
                — paste a YouTube / Vimeo URL, image URL, or upload from device
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => updateMediaUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="flex-1 px-3 py-2 text-[12.5px] bg-[var(--le-bg)] border border-[var(--le-hair)] rounded-md text-[var(--le-ink-2)] focus:outline-none focus:border-[var(--le-ink-2)]"
              />
              <ImageUploadButton
                unitId={unitId}
                onUploaded={(url) => updateMediaUrl(url)}
              />
            </div>
            {mediaUrl && (
              <div className="mt-1 text-[10px] text-[var(--le-ink-3)]">
                Detected as {mediaType}. Students see this as a “Watch” block at the top of the lesson.
              </div>
            )}
          </div>

          {/* Success criteria */}
          <div>
            <label className="text-[10px] le-cap text-[var(--le-ink-3)] block mb-1">
              Success criteria
              <span className="ml-1 font-normal text-[var(--le-ink-3)] tracking-normal normal-case">
                — one per line, ideally student-voice (“I can…”), 2–5 items
              </span>
            </label>
            <textarea
              value={successCriteriaText}
              onChange={(e) => updateSuccessCriteria(e.target.value)}
              placeholder={"I can explain how centre of mass affects stability\nI can explain how wheel mass affects performance\nMy design brief references at least three research findings"}
              rows={4}
              className="w-full px-3 py-2 text-[12.5px] leading-relaxed bg-[var(--le-bg)] border border-[var(--le-hair)] rounded-md text-[var(--le-ink-2)] focus:outline-none focus:border-[var(--le-ink-2)]"
            />
          </div>

          <div className="text-[10px] text-[var(--le-ink-3)] italic pt-1 border-t border-dashed border-[var(--le-hair)]">
            Tip: hit “View as student” in the header to see exactly how this renders.
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// looksLikeVideoUrl moved to @/lib/video-embed — shared with ActivityBlock.
