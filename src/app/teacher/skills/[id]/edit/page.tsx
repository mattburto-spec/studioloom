"use client";

/**
 * /teacher/skills/[id]/edit — edit an existing draft or published card.
 *
 * Publish / Unpublish button + Delete (with inline confirm) live in the
 * page header. If the card is built-in, we redirect to the read-only
 * viewer — built-ins can't be edited directly (fork-to-edit lands in S2B).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SkillCardForm } from "@/components/skills/SkillCardForm";
import { DemoAckPanel } from "@/components/skills/DemoAckPanel";
import { useTeacher } from "@/app/teacher/teacher-context";
import type { CreateSkillCardPayload, SkillCardHydrated } from "@/types/skills";

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

export default function EditSkillCardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { teacher } = useTeacher();
  const id = params.id as string;

  const [card, setCard] = useState<SkillCardHydrated | null>(null);
  const [editable, setEditable] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  // Save feedback: lastSavedAt tracks the most recent successful PATCH so
  // the sticky bottom bar can say "Saved at 3:45 PM". saveToast is a
  // transient 3-second flash ("Changes saved") after each save.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // If the teacher used "Create & publish" on /new and the publish step
  // failed, /new routes here with ?publishError=<msg>. Surface it once.
  useEffect(() => {
    const err = searchParams.get("publishError");
    if (err) {
      setSubmitError(decodeURIComponent(err));
      // Strip the query param so a reload doesn't resurface the error.
      router.replace(`/teacher/skills/${id}/edit`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/teacher/skills/categories", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((j) => setCategories(j.categories ?? []))
      .catch(() => setCategories([]));
    fetch("/api/teacher/skills/domains", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { domains: [] }))
      .then((j) => setDomains(j.domains ?? []))
      .catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    let abort = false;
    async function load() {
      const res = await fetch(`/api/teacher/skills/cards/${id}`, {
        credentials: "include",
      });
      if (abort) return;
      if (!res.ok) {
        setLoadError("Card not found or no longer accessible.");
        return;
      }
      const json = await res.json();
      if (!json.editable) {
        // Built-in / someone else's — bounce to read-only.
        router.replace(`/teacher/skills/${id}`);
        return;
      }
      setCard(json.card);
      setEditable(true);
    }
    load();
    return () => {
      abort = true;
    };
  }, [id, router]);

  async function handleSubmit(payload: CreateSkillCardPayload) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/teacher/skills/cards/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Failed to save changes.");
        setSubmitting(false);
        return;
      }
      setCard(json.card);
      setLastSavedAt(new Date());
      setSaveToast("Changes saved");
      setSubmitting(false);
    } catch (err) {
      console.error(err);
      setSubmitError("Network error.");
      setSubmitting(false);
    }
  }

  // Auto-hide the save toast after 3 seconds.
  useEffect(() => {
    if (!saveToast) return;
    const t = window.setTimeout(() => setSaveToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [saveToast]);

  async function togglePublish() {
    if (!card) return;
    setPublishBusy(true);
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${card.id}/publish`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: card.is_published ? "unpublish" : "publish",
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Failed to update publish state.");
        return;
      }
      setCard({ ...card, is_published: json.is_published });
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleDelete() {
    if (!card) return;
    const res = await fetch(`/api/teacher/skills/cards/${card.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Failed to delete card.");
      return;
    }
    router.push("/teacher/skills");
  }

  if (loadError) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700">
          {loadError}
        </div>
        <Link
          href="/teacher/skills"
          className="text-sm text-indigo-600 hover:text-indigo-700 mt-4 inline-block"
        >
          ← Back to Skills Library
        </Link>
      </main>
    );
  }

  if (!card || !editable) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </main>
    );
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
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold text-gray-900">
                {card.title || "Untitled card"}
              </h1>
              {card.is_published ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Published
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Draft
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-mono">{card.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePublish}
              disabled={publishBusy}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                card.is_published
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              } disabled:opacity-50`}
            >
              {publishBusy
                ? "…"
                : card.is_published
                  ? "Unpublish"
                  : "Publish"}
            </button>
            {!deleteArmed ? (
              <button
                type="button"
                onClick={() => setDeleteArmed(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-gray-600">Delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteArmed(false)}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                >
                  No
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <SkillCardForm
        mode="edit"
        initial={card}
        categories={categories}
        domains={domains}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        statusSlot={
          saveToast ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {saveToast}
            </span>
          ) : lastSavedAt ? (
            <span>
              Last saved at{" "}
              {lastSavedAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null
        }
        extraActions={
          <button
            type="button"
            onClick={togglePublish}
            disabled={publishBusy}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              card.is_published
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            } disabled:opacity-50`}
          >
            {publishBusy
              ? "…"
              : card.is_published
                ? "Unpublish"
                : "Publish"}
          </button>
        }
      />

      {/* Teacher-ack demo panel. Only meaningful once published — a draft
          card can't be demonstrated until students can see it. */}
      {card.is_published && (
        <section className="mt-8">
          <DemoAckPanel cardId={card.id} teacherId={teacher?.id} />
        </section>
      )}
    </main>
  );
}
