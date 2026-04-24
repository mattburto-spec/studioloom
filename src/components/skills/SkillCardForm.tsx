"use client";

/**
 * SkillCardForm — shared authoring form for /teacher/skills/new and /edit.
 *
 * Catalogue-v1 schema (migration 110): each card has tier, domain, age band,
 * framework anchors, demo of competency, learning outcomes, applied_in, and
 * card_type on top of the earlier title/category/body/tags/prereqs/links.
 *
 * Section order is deliberate — starts with the "identity" fields (what is
 * this card?), then the pedagogical contract (what does earned mean?), then
 * the body, then the extras (tags / links / prereqs). This mirrors how a
 * Scouts-style pamphlet is structured.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BlockEditor } from "./BlockEditor";
import { BlockRenderer } from "./BlockRenderer";
import "./skills.css";
import { nanoid } from "nanoid";
import {
  CONTROLLED_VERBS,
  SKILL_TIER_LABELS,
  SKILL_TIERS,
  type Block,
  type CardType,
  type CreateSkillCardPayload,
  type FrameworkAnchor,
  type QuizQuestion,
  type QuizQuestionType,
  type SkillCardHydrated,
  type SkillTier,
} from "@/types/skills";

interface Category {
  id: string;
  label: string;
  description: string;
}

interface Domain {
  id: string;
  short_code: string;
  label: string;
  description: string;
}

interface PrereqOption {
  id: string;
  slug: string;
  title: string;
  tier: string | null;
}

interface Props {
  mode: "create" | "edit";
  initial?: SkillCardHydrated;
  categories: Category[];
  domains: Domain[];
  onSubmit: (
    payload: CreateSkillCardPayload,
    opts: { publishImmediately: boolean }
  ) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
  statusSlot?: React.ReactNode;
  extraActions?: React.ReactNode;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const FRAMEWORK_CHOICES: ReadonlyArray<{
  value: FrameworkAnchor["framework"];
  label: string;
  suggestions: string[];
}> = [
  {
    value: "ATL",
    label: "IB MYP ATL",
    suggestions: [
      "Thinking",
      "Research",
      "Social",
      "Communication",
      "Self-Management",
    ],
  },
  {
    value: "CASEL",
    label: "CASEL 5",
    suggestions: [
      "Self-Awareness",
      "Self-Management",
      "Social Awareness",
      "Relationship Skills",
      "Responsible Decision-Making",
    ],
  },
  {
    value: "WEF",
    label: "WEF Future of Jobs 2025",
    suggestions: [
      "Analytical Thinking",
      "Creative Thinking",
      "Resilience",
      "Leadership and Social Influence",
      "Motivation and Self-Awareness",
      "Curiosity",
      "Technological Literacy",
      "Empathy",
      "Talent Management",
      "Service Orientation",
    ],
  },
  {
    value: "StudioHabits",
    label: "Studio Habits of Mind",
    suggestions: [
      "Develop Craft",
      "Engage & Persist",
      "Envision",
      "Express",
      "Observe",
      "Reflect",
      "Stretch & Explore",
      "Understand Art Worlds",
    ],
  },
];

export function SkillCardForm({
  mode,
  initial,
  categories,
  domains,
  onSubmit,
  submitting,
  submitError,
  statusSlot,
  extraActions,
}: Props) {
  // Which button was clicked? Set by each button's onClick just before
  // the native submit fires, read inside handleSubmit.
  const publishIntentRef = useRef<boolean>(false);

  // ---------- Identity ----------
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [authorName, setAuthorName] = useState(initial?.author_name ?? "");

  // ---------- Taxonomy ----------
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [domainId, setDomainId] = useState(initial?.domain_id ?? "");
  const [tier, setTier] = useState<SkillTier | "">(initial?.tier ?? "");
  const [cardType, setCardType] = useState<CardType>(
    initial?.card_type ?? "lesson"
  );

  // ---------- Sizing ----------
  const [estimatedMin, setEstimatedMin] = useState<string>(
    initial?.estimated_min?.toString() ?? ""
  );
  const [ageMin, setAgeMin] = useState<string>(
    initial?.age_min?.toString() ?? ""
  );
  const [ageMax, setAgeMax] = useState<string>(
    initial?.age_max?.toString() ?? ""
  );

  // ---------- Pedagogical contract ----------
  const [demoOfCompetency, setDemoOfCompetency] = useState(
    initial?.demo_of_competency ?? ""
  );
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(
    initial?.learning_outcomes?.length ? initial.learning_outcomes : [""]
  );
  const [frameworkAnchors, setFrameworkAnchors] = useState<FrameworkAnchor[]>(
    initial?.framework_anchors ?? []
  );
  const [appliedIn, setAppliedIn] = useState<string[]>(
    initial?.applied_in?.length ? initial.applied_in : [""]
  );

  // ---------- Body ----------
  const [body, setBody] = useState<Block[]>(initial?.body ?? []);
  const [showPreview, setShowPreview] = useState(false);

  // ---------- Quiz (Phase A, migration 112) ----------
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(
    initial?.quiz_questions ?? []
  );
  const [passThreshold, setPassThreshold] = useState<string>(
    (initial?.pass_threshold ?? 80).toString()
  );
  const [retakeCooldown, setRetakeCooldown] = useState<string>(
    (initial?.retake_cooldown_minutes ?? 0).toString()
  );
  const [questionCount, setQuestionCount] = useState<string>(
    initial?.question_count != null ? String(initial.question_count) : ""
  );

  // ---------- Extras ----------
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<
    Array<{ url: string; title: string; kind: string }>
  >(
    (initial?.external_links ?? []).map((l) => ({
      url: l.url,
      title: l.title ?? "",
      kind: l.kind ?? "",
    }))
  );
  const [prereqIds, setPrereqIds] = useState<string[]>(
    (initial?.prerequisites ?? []).map((p) => p.id)
  );
  const [prereqSearch, setPrereqSearch] = useState("");
  const [prereqOptions, setPrereqOptions] = useState<PrereqOption[]>([]);

  // Auto-slug from title until the user edits slug manually.
  useEffect(() => {
    if (!slugTouched && mode === "create") {
      setSlug(slugify(title));
    }
  }, [title, slugTouched, mode]);

  // Fuzzy prereq search — debounced.
  useEffect(() => {
    const q = prereqSearch.trim();
    if (q.length < 2) {
      setPrereqOptions([]);
      return;
    }
    const id = window.setTimeout(async () => {
      const res = await fetch(`/api/teacher/skills/cards?ownership=all`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json();
      const matches = (json.cards ?? [])
        .filter(
          (c: PrereqOption & {
            is_published?: boolean;
            is_built_in?: boolean;
          }) =>
            (c.is_published || c.is_built_in) &&
            c.id !== initial?.id &&
            !prereqIds.includes(c.id) &&
            c.title.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 8);
      setPrereqOptions(matches);
    }, 200);
    return () => window.clearTimeout(id);
  }, [prereqSearch, initial?.id, prereqIds]);

  const prereqById = useMemo(() => {
    const map = new Map<string, PrereqOption>();
    (initial?.prerequisites ?? []).forEach((p) =>
      map.set(p.id, { ...p, tier: p.tier ?? null })
    );
    prereqOptions.forEach((o) => map.set(o.id, o));
    return map;
  }, [initial?.prerequisites, prereqOptions]);

  // Does the current demo line start with a controlled verb? Soft hint.
  const demoStartsWithControlledVerb = useMemo(() => {
    const first = demoOfCompetency.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    return (CONTROLLED_VERBS as readonly string[]).includes(first);
  }, [demoOfCompetency]);

  // ---------- Dynamic list helpers ----------
  function updateListAt<T>(
    arr: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    idx: number,
    value: T
  ) {
    const next = arr.slice();
    next[idx] = value;
    setter(next);
  }
  function removeListAt<T>(
    arr: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    idx: number,
    empty: T
  ) {
    const next = arr.slice();
    next.splice(idx, 1);
    setter(next.length ? next : [empty]);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || t.length > 40) return;
    setTags([...tags, t]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function addLink() {
    setLinks([...links, { url: "", title: "", kind: "" }]);
  }
  function updateLink(i: number, patch: Partial<(typeof links)[0]>) {
    const next = links.slice();
    next[i] = { ...next[i], ...patch };
    setLinks(next);
  }
  function removeLink(i: number) {
    const next = links.slice();
    next.splice(i, 1);
    setLinks(next);
  }

  function addPrereq(id: string) {
    if (!prereqIds.includes(id)) setPrereqIds([...prereqIds, id]);
    setPrereqSearch("");
    setPrereqOptions([]);
  }
  function removePrereq(id: string) {
    setPrereqIds(prereqIds.filter((x) => x !== id));
  }

  function addAnchor() {
    setFrameworkAnchors([...frameworkAnchors, { framework: "ATL", label: "" }]);
  }
  function updateAnchor(i: number, patch: Partial<FrameworkAnchor>) {
    const next = frameworkAnchors.slice();
    next[i] = { ...next[i], ...patch };
    setFrameworkAnchors(next);
  }
  function removeAnchor(i: number) {
    const next = frameworkAnchors.slice();
    next.splice(i, 1);
    setFrameworkAnchors(next);
  }

  // ---------- Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !slug || !categoryId || !domainId || !tier) return;

    const publishImmediately = publishIntentRef.current;
    publishIntentRef.current = false;

    const cleanedOutcomes = learningOutcomes.map((s) => s.trim()).filter(Boolean);
    const cleanedApplied = appliedIn.map((s) => s.trim()).filter(Boolean);
    const cleanedAnchors = frameworkAnchors.filter(
      (a) => a.framework && a.label.trim()
    );

    await onSubmit(
      {
        slug,
        title: title.trim(),
        summary: summary.trim() || undefined,
        category_id: categoryId,
        domain_id: domainId,
        tier,
        body,
        estimated_min: estimatedMin ? parseInt(estimatedMin, 10) : null,
        age_min: ageMin ? parseInt(ageMin, 10) : null,
        age_max: ageMax ? parseInt(ageMax, 10) : null,
        framework_anchors: cleanedAnchors,
        demo_of_competency: demoOfCompetency.trim() || null,
        learning_outcomes: cleanedOutcomes,
        applied_in: cleanedApplied,
        card_type: cardType,
        author_name: authorName.trim() || null,
        tags,
        external_links: links
          .filter((l) => l.url.trim())
          .map((l) => ({
            url: l.url.trim(),
            title: l.title.trim() || undefined,
            kind:
              (l.kind as "video" | "pdf" | "doc" | "website" | "other") ||
              undefined,
          })),
        prerequisite_ids: prereqIds,
        // Quiz (Phase A) — only send if the teacher has configured at least
        // one question. Empty array is valid server-side (signals "no quiz").
        quiz_questions: quizQuestions,
        pass_threshold: passThreshold
          ? Math.min(100, Math.max(0, parseInt(passThreshold, 10) || 80))
          : 80,
        retake_cooldown_minutes: retakeCooldown
          ? Math.max(0, parseInt(retakeCooldown, 10) || 0)
          : 0,
        question_count: questionCount
          ? Math.max(1, parseInt(questionCount, 10)) || null
          : null,
      },
      { publishImmediately }
    );
  }

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <form onSubmit={handleSubmit} className="sl-skill-scope space-y-6">
      {/* =============== 1 · Identity =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            1 · Identity
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Name the card, give it a slug, and stand behind it with your byline.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Title *</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. Hand Sketching for Ideation"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Slug *</span>
            <input
              type="text"
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 font-mono"
              placeholder="hand-sketching-for-ideation"
              disabled={mode === "edit"}
            />
            {mode === "edit" && (
              <span className="text-xs text-gray-400">
                Slugs are permanent once created.
              </span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700 font-medium">Summary</span>
          <input
            type="text"
            maxLength={280}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="One sentence — what this card is about. Shown on list views."
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700 font-medium">
            Author byline
          </span>
          <input
            type="text"
            maxLength={120}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="e.g. Matt Burton — the human responsible for this content"
          />
          <span className="text-xs text-gray-400">
            Scouts pamphlet model — every card has a named author standing
            behind it. Defaults to your name; override for co-authored work.
          </span>
        </label>
      </section>

      {/* =============== 2 · Taxonomy & Tier =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            2 · Taxonomy &amp; Tier
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Where does this card live (domain + category) and how advanced is
            it (tier)?
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">
              Domain (subject area) *
            </span>
            <select
              required
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Choose…</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_code} · {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">
              Category (cognitive action) *
            </span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Tier *</span>
            <select
              required
              value={tier}
              onChange={(e) => setTier(e.target.value as SkillTier | "")}
              className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Choose…</option>
              {SKILL_TIERS.map((t) => (
                <option key={t} value={t}>
                  {SKILL_TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-gray-700 font-medium">Card type</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCardType("lesson")}
              className={`px-4 py-2 rounded-lg border text-sm ${
                cardType === "lesson"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Lesson
            </button>
            <button
              type="button"
              onClick={() => setCardType("routine")}
              className={`px-4 py-2 rounded-lg border text-sm ${
                cardType === "routine"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Thinking Routine
            </button>
          </div>
          <span className="text-xs text-gray-400">
            Lesson = standard content + optional quiz. Thinking routine =
            Project Zero-style 3–6 step prompt the student runs on their own
            work, repeatable per artefact.
          </span>
        </div>
      </section>

      {/* =============== 3 · Pedagogical contract =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            3 · Pedagogical contract
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            What does <em>earned</em> mean? These fields are the rubric —
            shown to the student <strong>before</strong> they start (Digital
            Promise: the evidence criterion is the skill definition).
          </p>
        </header>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700 font-medium">
            Demo of competency *
          </span>
          <textarea
            rows={2}
            value={demoOfCompetency}
            onChange={(e) => setDemoOfCompetency(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="One sentence. Start with a controlled verb (show / demonstrate / produce / explain / argue / identify / compare / sketch / make / plan / deliver)."
          />
          {demoOfCompetency.trim().length > 0 &&
            !demoStartsWithControlledVerb && (
              <span className="text-xs text-amber-600">
                ⚠ Start with a controlled verb —{" "}
                <code>{CONTROLLED_VERBS.join(" / ")}</code>. Banned:
                understand, know about, appreciate (unverifiable).
              </span>
            )}
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 font-medium text-sm">
              Learning outcomes (&ldquo;Student can&hellip;&rdquo;)
            </span>
            <button
              type="button"
              onClick={() => setLearningOutcomes([...learningOutcomes, ""])}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              + Add outcome
            </button>
          </div>
          <ul className="space-y-2">
            {learningOutcomes.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 text-sm pt-2">•</span>
                <input
                  type="text"
                  value={o}
                  onChange={(e) =>
                    updateListAt(
                      learningOutcomes,
                      setLearningOutcomes,
                      i,
                      e.target.value
                    )
                  }
                  placeholder="Student can identify … / produce … / argue …"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    removeListAt(learningOutcomes, setLearningOutcomes, i, "")
                  }
                  disabled={learningOutcomes.length === 1}
                  className="text-rose-600 hover:text-rose-700 text-sm px-2 disabled:opacity-30"
                  aria-label={`Remove outcome ${i + 1}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 font-medium text-sm">
              Framework anchors
            </span>
            <button
              type="button"
              onClick={addAnchor}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              + Add anchor
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Map this card to ATL / CASEL / WEF / Studio Habits categories.
            Defensibility for parents and admin.
          </p>
          {frameworkAnchors.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              No anchors yet. Recommended: 1–3 per card.
            </p>
          ) : (
            <ul className="space-y-2">
              {frameworkAnchors.map((a, i) => {
                const choice = FRAMEWORK_CHOICES.find(
                  (c) => c.value === a.framework
                );
                return (
                  <li
                    key={i}
                    className="grid grid-cols-1 md:grid-cols-[10rem_1fr_auto] gap-2 items-center"
                  >
                    <select
                      value={a.framework}
                      onChange={(e) =>
                        updateAnchor(i, {
                          framework: e.target
                            .value as FrameworkAnchor["framework"],
                        })
                      }
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {FRAMEWORK_CHOICES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      list={`fa-suggestions-${i}`}
                      value={a.label}
                      onChange={(e) =>
                        updateAnchor(i, { label: e.target.value })
                      }
                      placeholder={`e.g. ${choice?.suggestions[0] ?? "Analytical Thinking"}`}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    {choice && (
                      <datalist id={`fa-suggestions-${i}`}>
                        {choice.suggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAnchor(i)}
                      className="text-rose-600 hover:text-rose-700 text-sm px-2"
                      aria-label="Remove anchor"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 font-medium text-sm">
              Applied in
            </span>
            <button
              type="button"
              onClick={() => setAppliedIn([...appliedIn, ""])}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              + Add context
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Where does this card get pulled into student work? (activity block
            prereqs, fabrication pipeline, Open Studio capability-gap, class
            gallery, safety badges, etc.)
          </p>
          <ul className="space-y-2">
            {appliedIn.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 text-sm pt-2">•</span>
                <input
                  type="text"
                  value={a}
                  onChange={(e) =>
                    updateListAt(appliedIn, setAppliedIn, i, e.target.value)
                  }
                  placeholder="e.g. Activity block prereq — prototyping phase · Fabrication Pipeline preflight"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeListAt(appliedIn, setAppliedIn, i, "")}
                  disabled={appliedIn.length === 1}
                  className="text-rose-600 hover:text-rose-700 text-sm px-2 disabled:opacity-30"
                  aria-label={`Remove context ${i + 1}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* =============== 4 · Sizing =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">4 · Sizing</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Age band and time estimate. Soft hints — UI will not block
            off-band students.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">
              Estimated time (min)
            </span>
            <input
              type="number"
              min={1}
              max={240}
              value={estimatedMin}
              onChange={(e) => setEstimatedMin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. 60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Age — min</span>
            <input
              type="number"
              min={5}
              max={25}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. 11"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Age — max</span>
            <input
              type="number"
              min={5}
              max={25}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. 13"
            />
          </label>
        </div>
      </section>

      {/* =============== 5 · Body =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">5 · Body</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              The actual lesson content. Pick blocks from the menu; reorder
              with the arrows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
        {showPreview ? (
          <div className="prose prose-sm max-w-none">
            <BlockRenderer blocks={body} />
          </div>
        ) : (
          <BlockEditor blocks={body} onChange={setBody} />
        )}
      </section>

      {/* =============== 6 · Tags =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">6 · Tags</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Short lowercase labels for filtering. Use existing tags if they
            fit.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove tag ${t}`}
                className="hover:text-indigo-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* =============== 7 · External links =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              7 · External links
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Supplementary videos, PDFs, reference pages. Link-checked
              periodically.
            </p>
          </div>
          <button
            type="button"
            onClick={addLink}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            + Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No links attached.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link, i) => (
              <li
                key={i}
                className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto_auto] gap-2 items-center"
              >
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={link.title}
                  onChange={(e) => updateLink(i, { title: e.target.value })}
                  placeholder="Title (optional)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={link.kind}
                  onChange={(e) => updateLink(i, { kind: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Kind…</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">Doc</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="text-rose-600 hover:text-rose-700 text-sm px-2"
                  aria-label="Remove link"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =============== 8 · Prerequisites =============== */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            8 · Prerequisites
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cards students should master before attempting this one. Soft
            prompts — not hard locks.
          </p>
        </header>

        {prereqIds.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {prereqIds.map((id) => {
              const p = prereqById.get(id);
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                >
                  <span>{p?.title ?? id}</span>
                  <button
                    type="button"
                    onClick={() => removePrereq(id)}
                    aria-label="Remove prerequisite"
                    className="hover:text-rose-600"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="relative">
          <input
            type="text"
            value={prereqSearch}
            onChange={(e) => setPrereqSearch(e.target.value)}
            placeholder="Search for a card to add as prerequisite…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {prereqOptions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {prereqOptions.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => addPrereq(o.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium">{o.title}</span>
                    {o.tier && (
                      <span className="ml-2 text-xs text-gray-500 capitalize">
                        {o.tier}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* =============== 9 · Quiz (optional) =============== */}
      <QuizSection
        questions={quizQuestions}
        setQuestions={setQuizQuestions}
        passThreshold={passThreshold}
        setPassThreshold={setPassThreshold}
        retakeCooldown={retakeCooldown}
        setRetakeCooldown={setRetakeCooldown}
        questionCount={questionCount}
        setQuestionCount={setQuestionCount}
      />

      {/* =============== Submit =============== */}
      {submitError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3 sticky bottom-0 bg-white border-t border-gray-100 -mx-6 px-6 py-3">
        <div className="flex-1 text-sm text-gray-500 min-w-0 truncate">
          {statusSlot}
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          {mode === "create" && (
            <button
              type="submit"
              onClick={() => {
                publishIntentRef.current = true;
              }}
              disabled={
                submitting ||
                !title.trim() ||
                !categoryId ||
                !domainId ||
                !tier ||
                body.length === 0
              }
              title={
                body.length === 0
                  ? "Add at least one content block before publishing"
                  : "Create and publish this card"
              }
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Create & publish"}
            </button>
          )}
          <button
            type="submit"
            onClick={() => {
              publishIntentRef.current = false;
            }}
            disabled={
              submitting || !title.trim() || !categoryId || !domainId || !tier
            }
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Create draft"
                : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ============================================================================
// QuizSection — renders the "9 · Quiz" authoring UI.
// ============================================================================
// Split out of the main form body because it has its own helpers for
// managing questions array mutations (add/remove/update + set correct).

const QUIZ_QUESTION_TYPES: Array<{ value: QuizQuestionType; label: string }> = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "scenario", label: "Scenario (MC)" },
];

function QuizSection({
  questions,
  setQuestions,
  passThreshold,
  setPassThreshold,
  retakeCooldown,
  setRetakeCooldown,
  questionCount,
  setQuestionCount,
}: {
  questions: QuizQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<QuizQuestion[]>>;
  passThreshold: string;
  setPassThreshold: React.Dispatch<React.SetStateAction<string>>;
  retakeCooldown: string;
  setRetakeCooldown: React.Dispatch<React.SetStateAction<string>>;
  questionCount: string;
  setQuestionCount: React.Dispatch<React.SetStateAction<string>>;
}) {
  function addQuestion() {
    const q: QuizQuestion = {
      id: nanoid(8),
      type: "multiple_choice",
      prompt: "",
      options: ["", ""],
      correct_answer: "0",
      explanation: "",
    };
    setQuestions((prev) => [...prev, q]);
  }
  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateQuestion(idx: number, patch: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }
  function setOption(idx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const options = [...(q.options ?? [])];
        options[optIdx] = value;
        return { ...q, options };
      })
    );
  }
  function addOption(idx: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === idx
          ? { ...q, options: [...(q.options ?? []), ""] }
          : q
      )
    );
  }
  function removeOption(idx: number, optIdx: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const options = (q.options ?? []).filter((_, j) => j !== optIdx);
        // If the removed option was the correct one, reset to index 0.
        let correct_answer = q.correct_answer;
        if (typeof correct_answer === "string") {
          const correctIdx = parseInt(correct_answer, 10);
          if (correctIdx === optIdx) correct_answer = "0";
          else if (correctIdx > optIdx) correct_answer = String(correctIdx - 1);
        }
        return { ...q, options, correct_answer };
      })
    );
  }
  function setCorrectOption(idx: number, optIdx: number) {
    updateQuestion(idx, { correct_answer: String(optIdx) });
  }
  function changeType(idx: number, type: QuizQuestionType) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        if (type === "true_false") {
          return {
            ...q,
            type,
            options: ["True", "False"],
            correct_answer: "0",
          };
        }
        // mc / scenario — preserve existing options if any; ensure at least 2
        const options = q.options && q.options.length >= 2 ? q.options : ["", ""];
        return { ...q, type, options };
      })
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">9 · Quiz</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Optional. When a card has one or more questions here, students see
          a &ldquo;Take the quiz&rdquo; section at the bottom of the card.
          Passing writes <code>skill.quiz_passed</code> and advances the
          student&apos;s skill state.
        </p>
      </header>

      {/* Quiz-level settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          Pass threshold (%)
          <input
            type="number"
            min={0}
            max={100}
            value={passThreshold}
            onChange={(e) => setPassThreshold(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
          />
        </label>
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          Retake cooldown (minutes)
          <input
            type="number"
            min={0}
            value={retakeCooldown}
            onChange={(e) => setRetakeCooldown(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
          />
          <span className="text-xs text-gray-400">
            0 = no cooldown. Only applies after a failed attempt.
          </span>
        </label>
        <label className="text-sm text-gray-700 flex flex-col gap-1">
          Questions per attempt
          <input
            type="number"
            min={1}
            max={questions.length || undefined}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            placeholder={`All ${questions.length}`}
            className="border border-gray-200 rounded-lg px-3 py-2"
          />
          <span className="text-xs text-gray-400">
            Blank = use all. If set, a random subset is drawn per attempt.
          </span>
        </label>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {questions.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            No quiz questions yet. Add one to enable the quiz on this card.
          </p>
        )}
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Question {idx + 1}
                </span>
                <select
                  value={q.type}
                  onChange={(e) =>
                    changeType(idx, e.target.value as QuizQuestionType)
                  }
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white"
                >
                  {QUIZ_QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(idx)}
                className="text-xs text-rose-600 hover:text-rose-700"
              >
                Remove
              </button>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700 font-medium">Prompt</span>
              <textarea
                rows={2}
                value={q.prompt}
                onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2"
                placeholder="e.g. Which PPE is required when soldering?"
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Options (select the correct one)
                </span>
                {q.type !== "true_false" && (
                  <button
                    type="button"
                    onClick={() => addOption(idx)}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    + Option
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {(q.options ?? []).map((opt, optIdx) => (
                  <li key={optIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={
                        typeof q.correct_answer === "string" &&
                        parseInt(q.correct_answer, 10) === optIdx
                      }
                      onChange={() => setCorrectOption(idx, optIdx)}
                      className="flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => setOption(idx, optIdx, e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                      placeholder={
                        q.type === "true_false"
                          ? optIdx === 0
                            ? "True"
                            : "False"
                          : `Option ${String.fromCharCode(65 + optIdx)}`
                      }
                      disabled={q.type === "true_false"}
                    />
                    {q.type !== "true_false" && (q.options ?? []).length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx, optIdx)}
                        className="text-gray-400 hover:text-rose-600 text-sm"
                        aria-label="Remove option"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700 font-medium">
                Explanation (shown after answering)
              </span>
              <textarea
                rows={2}
                value={q.explanation}
                onChange={(e) =>
                  updateQuestion(idx, { explanation: e.target.value })
                }
                className="border border-gray-200 rounded-lg px-3 py-2"
                placeholder="Why this is right — or why the other options aren't."
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
      >
        + Add question
      </button>
    </section>
  );
}
