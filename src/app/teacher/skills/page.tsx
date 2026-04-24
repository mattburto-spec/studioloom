"use client";

/**
 * /teacher/skills — skill card library list.
 *
 * Shows built-in cards + the teacher's own cards (drafts + published).
 * Filters by domain, tier, category, card type, ownership.
 * Primary CTA: "+ New card".
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SKILL_TIER_LABELS, type SkillTier, type CardType } from "@/types/skills";

interface CardListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_id: string | null;
  domain_id: string | null;
  tier: SkillTier | null;
  age_min: number | null;
  age_max: number | null;
  card_type: CardType;
  estimated_min: number | null;
  framework_anchors: unknown;
  is_built_in: boolean;
  is_published: boolean;
  created_by_teacher_id: string | null;
  forked_from: string | null;
  author_name: string | null;
  updated_at: string;
  created_at: string;
}

interface CategoryRow {
  id: string;
  label: string;
  display_order: number;
}
interface DomainRow {
  id: string;
  short_code: string;
  label: string;
  display_order: number;
}

const TIER_COLORS: Record<SkillTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

/**
 * Classify a card by its age band for display. A card is "Primary" if its
 * upper bound is ≤ 11, "Senior" if its lower bound is ≥ 14, otherwise
 * "Middle". Cards without an age band return null (no badge shown).
 */
function ageBandLabel(
  ageMin: number | null,
  ageMax: number | null
): { label: "Primary" | "Middle" | "Senior"; cls: string } | null {
  if (ageMin == null && ageMax == null) return null;
  if (ageMax != null && ageMax <= 11) {
    return { label: "Primary", cls: "bg-sky-100 text-sky-700" };
  }
  if (ageMin != null && ageMin >= 14) {
    return { label: "Senior", cls: "bg-purple-100 text-purple-700" };
  }
  return { label: "Middle", cls: "bg-teal-100 text-teal-700" };
}

export default function TeacherSkillsListPage() {
  const [cards, setCards] = useState<CardListItem[] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [cardTypeFilter, setCardTypeFilter] = useState<string>("");
  const [ageBandFilter, setAgeBandFilter] = useState<string>("");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    const fetchCards = async () => {
      const params = new URLSearchParams();
      if (domainFilter) params.set("domain", domainFilter);
      if (tierFilter) params.set("tier", tierFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (cardTypeFilter) params.set("card_type", cardTypeFilter);
      if (ageBandFilter) params.set("age_band", ageBandFilter);
      if (ownershipFilter !== "all") params.set("ownership", ownershipFilter);

      const res = await fetch(
        `/api/teacher/skills/cards${params.toString() ? `?${params}` : ""}`,
        { credentials: "include" }
      );
      if (abort) return;
      if (!res.ok) {
        setError("Failed to load cards.");
        setCards([]);
        return;
      }
      const json = await res.json();
      setCards(json.cards ?? []);
    };
    fetchCards();
    return () => {
      abort = true;
    };
  }, [domainFilter, tierFilter, categoryFilter, cardTypeFilter, ageBandFilter, ownershipFilter]);

  useEffect(() => {
    fetch("/api/teacher/skills/categories", { credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : { categories: [] }))
      .then((json) =>
        setCategories(
          (json.categories ?? []).sort(
            (a: CategoryRow, b: CategoryRow) => a.display_order - b.display_order
          )
        )
      )
      .catch(() => setCategories([]));
    fetch("/api/teacher/skills/domains", { credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : { domains: [] }))
      .then((json) =>
        setDomains(
          (json.domains ?? []).sort(
            (a: DomainRow, b: DomainRow) => a.display_order - b.display_order
          )
        )
      )
      .catch(() => setDomains([]));
  }, []);

  const counts = useMemo(() => {
    if (!cards) return { total: 0, mine: 0, builtIn: 0, drafts: 0 };
    return {
      total: cards.length,
      mine: cards.filter((c) => !c.is_built_in).length,
      builtIn: cards.filter((c) => c.is_built_in).length,
      drafts: cards.filter((c) => !c.is_built_in && !c.is_published).length,
    };
  }, [cards]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Skills Library</h1>
          <p className="text-gray-500 mt-1">
            Teach-once, reuse-everywhere skill cards. 10 domains × 3 tiers
            (Bronze / Silver / Gold). Students earn progression through
            demonstration and quiz.
          </p>
        </div>
        <Link
          href="/teacher/skills/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
        >
          + New card
        </Link>
      </div>

      {/* --- Filters --- */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.short_code} · {d.label}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All tiers</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={cardTypeFilter}
          onChange={(e) => setCardTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All card types</option>
          <option value="lesson">Lessons</option>
          <option value="routine">Thinking routines</option>
        </select>
        <select
          value={ageBandFilter}
          onChange={(e) => setAgeBandFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          title="Filter by schooling stage"
        >
          <option value="">All age bands</option>
          <option value="primary">Primary (8–11)</option>
          <option value="middle">Middle (11–14)</option>
          <option value="senior">Senior (14–18)</option>
        </select>
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
          {(["all", "mine", "built_in"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOwnershipFilter(k)}
              className={`px-3 py-1.5 text-sm ${
                ownershipFilter === k
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {k === "all" ? "All" : k === "mine" ? "Mine" : "Built-in"}
            </button>
          ))}
        </div>
        {cards && (
          <span className="text-sm text-gray-500 ml-auto">
            {counts.total} {counts.total === 1 ? "card" : "cards"}
            {counts.drafts > 0 && (
              <span className="ml-2 text-amber-600">
                · {counts.drafts} draft{counts.drafts === 1 ? "" : "s"}
              </span>
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* --- List --- */}
      {cards === null ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No cards match these filters.</p>
          <Link
            href="/teacher/skills/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            + Create your first card
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((c) => {
            const domainShortCode =
              domains.find((d) => d.id === c.domain_id)?.short_code ?? null;
            const band = ageBandLabel(c.age_min, c.age_max);
            return (
              <li key={c.id}>
                <Link
                  href={
                    c.is_built_in
                      ? `/teacher/skills/${c.id}`
                      : `/teacher/skills/${c.id}/edit`
                  }
                  className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-sm transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h2 className="text-lg font-bold text-gray-900">
                      {c.title}
                    </h2>
                    <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                      {band && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${band.cls}`}
                          title={`Age ${c.age_min ?? "?"}–${c.age_max ?? "?"}`}
                        >
                          {band.label}
                        </span>
                      )}
                      {c.is_built_in && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Built-in
                        </span>
                      )}
                      {!c.is_built_in && !c.is_published && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Draft
                        </span>
                      )}
                      {!c.is_built_in && c.is_published && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Published
                        </span>
                      )}
                      {c.forked_from && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                          Forked
                        </span>
                      )}
                      {c.card_type === "routine" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          Routine
                        </span>
                      )}
                    </div>
                  </div>
                  {c.summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {c.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    {domainShortCode && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                        {domainShortCode}
                      </span>
                    )}
                    {c.tier && (
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[c.tier]}`}
                      >
                        {SKILL_TIER_LABELS[c.tier]}
                      </span>
                    )}
                    {c.category_id && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                        {c.category_id}
                      </span>
                    )}
                    {c.age_min && c.age_max && (
                      <span className="text-gray-500">
                        ages {c.age_min}–{c.age_max}
                      </span>
                    )}
                    {c.estimated_min && (
                      <span className="text-gray-500">
                        ~{c.estimated_min} min
                      </span>
                    )}
                    {c.author_name && (
                      <span className="text-gray-400 ml-auto italic">
                        by {c.author_name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
