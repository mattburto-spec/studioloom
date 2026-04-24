"use client";

/**
 * /teacher/skills/[id] — read-only preview for built-in cards (and, later,
 * other teachers' cards). The edit page redirects here when the card isn't
 * editable. S2B adds the "Fork a copy" action from this view.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BlockRenderer } from "@/components/skills/BlockRenderer";
import { DemoAckPanel } from "@/components/skills/DemoAckPanel";
import { useTeacher } from "@/app/teacher/teacher-context";
import "@/components/skills/skills.css";
import { SKILL_TIER_LABELS, type SkillCardHydrated, type SkillTier } from "@/types/skills";

const TIER_COLORS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

export default function ViewSkillCardPage() {
  const params = useParams();
  const id = params.id as string;
  const { teacher } = useTeacher();
  const [card, setCard] = useState<SkillCardHydrated | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    async function load() {
      const res = await fetch(`/api/teacher/skills/cards/${id}`, {
        credentials: "include",
      });
      if (abort) return;
      if (!res.ok) {
        setLoadError("Card not found.");
        return;
      }
      const json = await res.json();
      setCard(json.card);
    }
    load();
    return () => {
      abort = true;
    };
  }, [id]);

  if (loadError) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700">
          {loadError}
        </div>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="sl-skill-scope max-w-6xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link
          href="/teacher/skills"
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Skills Library
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs mb-2">
        {card.is_built_in && (
          <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Built-in
          </span>
        )}
        {card.card_type === "routine" && (
          <span className="font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            Thinking Routine
          </span>
        )}
        {card.tier && (
          <span
            className={`px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[card.tier]}`}
          >
            {SKILL_TIER_LABELS[card.tier]}
          </span>
        )}
        {card.domain_id && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium capitalize">
            {card.domain_id.replace(/-/g, " ")}
          </span>
        )}
        {card.category_id && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
            {card.category_id}
          </span>
        )}
        {card.age_min && card.age_max && (
          <span className="text-gray-500">
            ages {card.age_min}–{card.age_max}
          </span>
        )}
        {card.estimated_min && (
          <span className="text-gray-500">~{card.estimated_min} min</span>
        )}
      </div>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
        {card.title}
      </h1>
      {card.summary && (
        <p className="text-gray-600 text-lg mb-4">{card.summary}</p>
      )}
      {card.author_name && (
        <p className="text-sm text-gray-400 italic mb-6">
          Authored by {card.author_name}
        </p>
      )}

      {/* The pedagogical contract — shown BEFORE content per Digital Promise. */}
      {(card.demo_of_competency ||
        card.learning_outcomes.length > 0 ||
        card.framework_anchors.length > 0) && (
        <section className="mb-8 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
          {card.demo_of_competency && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                What &ldquo;earned&rdquo; means
              </div>
              <p className="text-indigo-900 font-medium">
                {card.demo_of_competency}
              </p>
            </div>
          )}
          {card.learning_outcomes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                Learning outcomes
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-sm text-indigo-900">
                {card.learning_outcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {card.framework_anchors.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                Framework anchors
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {card.framework_anchors.map((a, i) => (
                  <li
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700"
                  >
                    {a.framework} · {a.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <article>
        <BlockRenderer blocks={card.body} />
      </article>

      {card.prerequisites.length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Prerequisites
          </h2>
          <ul className="flex flex-wrap gap-2">
            {card.prerequisites.map((p) => (
              <li
                key={p.id}
                className="px-3 py-1.5 bg-gray-100 rounded-full text-sm"
              >
                {p.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.applied_in.length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Applied in
          </h2>
          <ul className="flex flex-wrap gap-2">
            {card.applied_in.map((ctx, i) => (
              <li
                key={i}
                className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
              >
                {ctx}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.external_links.length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            External resources
          </h2>
          <ul className="space-y-1.5">
            {card.external_links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-700 break-words"
                >
                  {l.title ?? l.url}
                </a>
                {l.kind && (
                  <span className="ml-2 text-xs text-gray-500 uppercase">
                    {l.kind}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Teacher-ack demo panel. Only rendered for published / built-in cards —
          unpublished drafts aren't demonstrable yet. */}
      {(card.is_published || card.is_built_in) && (
        <section className="mt-8">
          <DemoAckPanel cardId={card.id} teacherId={teacher?.id} />
        </section>
      )}
    </main>
  );
}
