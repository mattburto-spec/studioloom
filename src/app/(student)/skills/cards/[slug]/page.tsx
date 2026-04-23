"use client";

/**
 * /skills/cards/[slug] — student viewer for a single published skill card.
 *
 * The GET endpoint logs a `skill.viewed` event (deduped server-side), so
 * simply fetching is enough to register the view. State badge surfaces the
 * student's current ladder position (untouched / viewed / quiz_passed /
 * demonstrated / applied) and freshness (fresh / cooling / stale).
 *
 * Quiz + demonstration actions land in S3; this is the content surface.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BlockRenderer } from "@/components/skills/BlockRenderer";
import "@/components/skills/skills.css";
import { SKILL_TIER_LABELS, type SkillCardHydrated, type SkillTier } from "@/types/skills";

const TIER_COLORS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

const STATE_LABELS: Record<string, string> = {
  untouched: "New",
  viewed: "Started",
  quiz_passed: "Quiz passed",
  demonstrated: "Demonstrated",
  applied: "Applied",
};
const STATE_COLORS: Record<string, string> = {
  untouched: "bg-gray-100 text-gray-600",
  viewed: "bg-sky-100 text-sky-700",
  quiz_passed: "bg-indigo-100 text-indigo-700",
  demonstrated: "bg-violet-100 text-violet-700",
  applied: "bg-emerald-100 text-emerald-700",
};

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "Fresh",
  cooling: "Cooling off",
  stale: "Needs refresh",
};

interface State {
  state: keyof typeof STATE_LABELS;
  freshness: keyof typeof FRESHNESS_LABELS | null;
  last_passed_at: string | null;
}

export default function StudentSkillCardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [card, setCard] = useState<SkillCardHydrated | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    async function load() {
      const res = await fetch(`/api/student/skills/cards/${slug}`, {
        credentials: "include",
      });
      if (abort) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError("Failed to load this card.");
        return;
      }
      const json = await res.json();
      setCard(json.card);
      setState(json.state);
    }
    load();
    return () => {
      abort = true;
    };
  }, [slug]);

  if (notFound) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Card not found
        </h1>
        <p className="text-gray-600 mb-6">
          This skill card doesn&apos;t exist or isn&apos;t available yet.
        </p>
        <Link
          href="/skills"
          className="text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Skills
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700">
          {error}
        </div>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2" />
          <div className="h-10 bg-gray-200 rounded w-3/4" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="sl-skill-scope max-w-6xl mx-auto px-4 py-8">
      <div className="mb-5">
        <Link
          href="/skills"
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Skills
        </Link>
      </div>

      {/* --- Status strip --- */}
      <div className="flex flex-wrap gap-2 items-center mb-3 text-xs">
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
        {card.estimated_min && (
          <span className="text-gray-500">~{card.estimated_min} min</span>
        )}
        {state && (
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${STATE_COLORS[state.state]}`}
          >
            {STATE_LABELS[state.state]}
          </span>
        )}
        {state?.freshness && state.freshness !== "fresh" && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
            {FRESHNESS_LABELS[state.freshness]}
          </span>
        )}
      </div>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
        {card.title}
      </h1>
      {card.summary && (
        <p className="text-gray-600 text-lg mb-4">{card.summary}</p>
      )}

      {/* --- Pedagogical contract — Digital Promise "rubric before attempt" --- */}
      {(card.demo_of_competency ||
        card.learning_outcomes.length > 0) && (
        <section className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          {card.demo_of_competency && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                What you&apos;ll be able to do
              </div>
              <p className="text-sm text-indigo-900 font-medium">
                {card.demo_of_competency}
              </p>
            </div>
          )}
          {card.learning_outcomes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                You&apos;ll practise
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-sm text-indigo-900">
                {card.learning_outcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* --- Prereq hint --- */}
      {card.prerequisites.length > 0 && (
        <section className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
          <p className="text-sm font-semibold text-indigo-900 mb-2">
            Before you start
          </p>
          <p className="text-sm text-indigo-800 mb-2">
            These cards build into this one:
          </p>
          <ul className="flex flex-wrap gap-2">
            {card.prerequisites.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/skills/cards/${p.slug}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-indigo-200 rounded-full text-sm text-indigo-700 hover:bg-indigo-100"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <article>
        <BlockRenderer blocks={card.body} />
      </article>

      {card.external_links.length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            More resources
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

      {card.tags.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
          {card.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
