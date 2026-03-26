"use client";

import { useState } from "react";
// Inline SVG icons (no lucide-react dependency)
const XIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const AlertCircleIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
import type { ReviewFormat } from "@/types";

interface GalleryRoundCreatorProps {
  unitId: string;
  classId: string;
  pages: Array<{ id: string; title: string }>;
  onCreated: () => void;
  onClose: () => void;
}

const REVIEW_FORMATS: Array<{ value: ReviewFormat; label: string; description: string }> = [
  {
    value: "comment",
    label: "Quick Comment",
    description: "Free-text feedback with optional sentence starters",
  },
  {
    value: "pmi",
    label: "PMI Analysis",
    description: "Plus, Minus, Interesting structure",
  },
  {
    value: "two-stars-wish",
    label: "Two Stars & a Wish",
    description: "2 strengths + 1 suggestion",
  },
];

export function GalleryRoundCreator({
  unitId,
  classId,
  pages,
  onCreated,
  onClose,
}: GalleryRoundCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [reviewFormat, setReviewFormat] = useState<ReviewFormat>("comment");
  const [minReviews, setMinReviews] = useState(3);
  const [anonymous, setAnonymous] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePageToggle = (pageId: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      setError("Round title is required");
      return;
    }

    if (selectedPages.length === 0) {
      setError("Select at least one page");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          classId,
          title: title.trim(),
          description: description.trim(),
          pageIds: selectedPages,
          reviewFormat,
          minReviews,
          anonymous,
          deadline: deadline || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create gallery round");
      }

      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between border-b border-purple-500">
          <h2 className="text-lg font-bold text-white">Create Gallery Round</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-purple-100 hover:text-white transition-colors disabled:opacity-50"
          >
            <XIcon size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Success State */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-800 font-medium">Gallery round created! 🎉</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircleIcon size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Round Title
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Example: "Criterion B Pin-Up: Share your design ideas"
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving || success}
              placeholder="Enter a clear, inviting title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none disabled:bg-gray-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving || success}
              placeholder="Add context or guidance for students"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100"
            />
          </div>

          {/* Page Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Include Pages
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select which unit pages students should share work from
            </p>
            <div className="space-y-2 bg-gray-50 rounded-lg p-4">
              {pages.length === 0 ? (
                <p className="text-gray-500 text-sm">No pages available in this unit</p>
              ) : (
                pages.map((page) => (
                  <label
                    key={page.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPages.includes(page.id)}
                      onChange={() => handlePageToggle(page.id)}
                      disabled={saving || success}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900">{page.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Review Format */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Review Format
            </label>
            <div className="space-y-3">
              {REVIEW_FORMATS.map((format) => (
                <label
                  key={format.value}
                  className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="reviewFormat"
                    value={format.value}
                    checked={reviewFormat === format.value}
                    onChange={(e) => setReviewFormat(e.target.value as ReviewFormat)}
                    disabled={saving || success}
                    className="mt-1 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{format.label}</p>
                    <p className="text-xs text-gray-600">{format.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Min Reviews Slider */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Minimum Reviews Required: {minReviews}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={minReviews}
              onChange={(e) => setMinReviews(parseInt(e.target.value))}
              disabled={saving || success}
              className="w-full cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-2">
              Students must give at least {minReviews} peer reviews before seeing feedback on their own work
            </p>
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Anonymous Reviews</p>
              <p className="text-xs text-gray-600">
                Hide reviewer names from authors (you always see who wrote reviews)
              </p>
            </div>
            <button
              onClick={() => setAnonymous(!anonymous)}
              disabled={saving || success}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                anonymous ? "bg-purple-600" : "bg-gray-300"
              } disabled:opacity-50`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  anonymous ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              Deadline (optional)
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={saving || success}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none disabled:bg-gray-100"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={saving || success}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || success || !title.trim() || selectedPages.length === 0}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? "Creating..." : success ? "Created!" : "Create Gallery Round"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
