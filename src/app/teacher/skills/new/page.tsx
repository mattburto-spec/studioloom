"use client";

/**
 * /teacher/skills/new — create a new draft skill card.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SkillCardForm } from "@/components/skills/SkillCardForm";
import type { CreateSkillCardPayload } from "@/types/skills";

interface Category {
  id: string;
  label: string;
  description: string;
}

export default function NewSkillCardPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/skills/categories", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((j) => setCategories(j.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  async function handleSubmit(
    payload: CreateSkillCardPayload,
    opts: { publishImmediately: boolean }
  ) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Create as draft (the endpoint always starts is_published=false).
      const res = await fetch("/api/teacher/skills/cards", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Failed to create card.");
        setSubmitting(false);
        return;
      }

      // 2. If the teacher asked for immediate publish, chain the publish
      //    call. If publish fails (e.g. validation regression), land them
      //    on the edit page with the error surfaced there — the draft has
      //    been created either way.
      if (opts.publishImmediately) {
        const pubRes = await fetch(
          `/api/teacher/skills/cards/${json.card.id}/publish`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "publish" }),
          }
        );
        if (!pubRes.ok) {
          const pubJson = await pubRes.json().catch(() => ({}));
          // Redirect to edit so the teacher can fix and retry; surface
          // the message as a query string the edit page can show.
          const msg = encodeURIComponent(
            pubJson.error ?? "Publish failed — card saved as draft."
          );
          router.push(
            `/teacher/skills/${json.card.id}/edit?publishError=${msg}`
          );
          return;
        }
      }

      router.push(`/teacher/skills/${json.card.id}/edit`);
    } catch (err) {
      console.error(err);
      setSubmitError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/teacher/skills"
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Skills Library
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 mt-2">
          New skill card
        </h1>
        <p className="text-gray-500 mt-1">
          Draft a card, then publish it when you&apos;re ready for students.
        </p>
      </div>

      <SkillCardForm
        mode="create"
        categories={categories}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
      />
    </main>
  );
}
