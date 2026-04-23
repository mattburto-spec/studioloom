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
import "@/components/skills/skills.css";
import type { SkillCardHydrated } from "@/types/skills";

const DIFFICULTY_LABELS: Record<string, string> = {
  foundational: "Foundational",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function ViewSkillCardPage() {
  const params = useParams();
  const id = params.id as string;
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
        {card.category_id && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
            {card.category_id}
          </span>
        )}
        {card.difficulty && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
            {DIFFICULTY_LABELS[card.difficulty]}
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
        <p className="text-gray-600 text-lg mb-6">{card.summary}</p>
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
    </main>
  );
}
