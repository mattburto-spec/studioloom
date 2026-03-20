"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { KNOWLEDGE_ITEM_TYPES, type KnowledgeItemTypeKey } from "@/lib/constants";
import type { KnowledgeItem, KnowledgeItemType } from "@/types/knowledge-library";
import type { LessonProfile } from "@/types/lesson-intelligence";
import KnowledgeItemCard from "@/components/teacher/knowledge/KnowledgeItemCard";
import KnowledgeItemForm from "@/components/teacher/knowledge/KnowledgeItemForm";
import LessonProfileReview from "@/components/teacher/knowledge/LessonProfileReview";
import TeacherFeedbackForm from "@/components/teacher/knowledge/TeacherFeedbackForm";
import { generatePDFThumbnail, extractPDFPageImages } from "@/lib/pdf-thumbnail";
import { UPLOAD_STAGE_CONFIG, type UploadSSEEvent, type UploadStage } from "@/types/upload-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Upload {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: "processing" | "extracted" | "analysing" | "analysed" | "complete" | "failed";
  analysis_stage: string | null;
  lesson_profile_id: string | null;
  error_message: string | null;
  source_category: string;
  created_at: string;
}

/** Cached profile data for inline review */
interface CachedProfile {
  profileId: string;
  profile: LessonProfile;
}

/** Per-file upload state for the batch queue */
interface FileUploadState {
  file: File;
  id: string; // client-side UUID for tracking
  uploadId?: string; // server-side ID once created
  status: "queued" | "uploading" | "complete" | "failed";
  error?: string;
  chunkCount?: number;
  imageCount?: number; // visual elements described by Vision AI
  profileId?: string;
  profile?: LessonProfile;
  thumbnailBlob?: Blob | null; // client-generated PDF thumbnail
  pageImages?: Blob[]; // all page images for storage
  // Progress tracking (SSE streaming)
  progressStage?: UploadStage;
  progressPercent?: number;
  progressMessage?: string;
}

type SourceCategory = "lesson_plan" | "textbook" | "resource" | "student_exemplar" | "assessment_rubric" | "safety_document" | "reference_image" | "scheme_of_work";

const SOURCE_CATEGORIES: { key: SourceCategory; label: string; description: string; icon: string }[] = [
  { key: "lesson_plan", label: "Lesson Plans", description: "Unit plans, overviews, worksheets", icon: "📋" },
  { key: "textbook", label: "Textbooks", description: "Patterns extracted, not copied", icon: "📚" },
  { key: "scheme_of_work", label: "Schemes of Work", description: "Multi-unit planning docs, yearly plans", icon: "🗓️" },
  { key: "assessment_rubric", label: "Rubrics", description: "Criterion descriptors, marking guides", icon: "📝" },
  { key: "student_exemplar", label: "Student Exemplars", description: "Examples at different achievement levels", icon: "⭐" },
  { key: "safety_document", label: "Safety Docs", description: "Machine safety, risk assessments", icon: "🦺" },
  { key: "reference_image", label: "Reference Images", description: "Inspiration, design examples", icon: "🖼️" },
  { key: "resource", label: "Other Resources", description: "Handouts, guides, templates", icon: "📎" },
];

type TabKey = "all" | KnowledgeItemType | "uploads";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tutorial", label: "Tutorials" },
  { key: "choice-board", label: "Choice Boards" },
  { key: "reference", label: "References" },
  { key: "skill-guide", label: "Skill Guides" },
  { key: "textbook-section", label: "Textbooks" },
  { key: "lesson-resource", label: "Resources" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "uploads", label: "Uploads" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function KnowledgeLibraryPage() {
  // Library state
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Upload state
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<FileUploadState[]>([]);
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>("lesson_plan");
  const [collection, setCollection] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false); // prevents concurrent queue processing

  // Lesson profile review state
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, CachedProfile>>({});

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load items
  const loadItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeTab !== "all" && activeTab !== "uploads") params.set("type", activeTab);

      const res = await fetch(`/api/teacher/knowledge/items?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeTab]);

  useEffect(() => {
    if (activeTab !== "uploads") {
      setLoading(true);
      loadItems();
    }
  }, [loadItems, activeTab]);

  // Load uploads
  const loadUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/knowledge/upload");
      if (res.ok) {
        const data = await res.json();
        setUploads(data.uploads || []);
        setTotalChunks(data.totalChunks || 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  // --- Batch upload queue helpers ---

  function updateQueueEntry(id: string, updates: Partial<FileUploadState>) {
    setUploadQueue((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }

  function removeFromQueue(id: string) {
    setUploadQueue((prev) => prev.filter((e) => e.id !== id));
  }

  /** Process the queue sequentially */
  async function processQueue(entries: FileUploadState[], category: SourceCategory, col?: string) {
    if (processingRef.current) return;
    processingRef.current = true;

    for (const entry of entries) {
      // Check if entry was removed from queue while waiting
      const stillQueued = await new Promise<boolean>((resolve) => {
        setUploadQueue((prev) => {
          const found = prev.find((e) => e.id === entry.id && e.status === "queued");
          resolve(!!found);
          return prev;
        });
      });
      if (!stillQueued) continue;

      updateQueueEntry(entry.id, { status: "uploading" });

      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append("source_category", category);
      if (col) formData.append("collection", col);
      if (entry.thumbnailBlob) {
        formData.append("thumbnail", entry.thumbnailBlob, "thumbnail.jpg");
      }
      // Append page images for persistent storage
      if (entry.pageImages) {
        for (let i = 0; i < entry.pageImages.length; i++) {
          formData.append("page_images", entry.pageImages[i], `page_${i + 1}.jpg`);
        }
      }

      try {
        const res = await fetch("/api/teacher/knowledge/upload", {
          method: "POST",
          body: formData,
        });

        // Non-streaming error (validation failures still return JSON)
        if (!res.ok) {
          let errorMsg = "Upload failed";
          try {
            const err = await res.json() as { error?: string };
            errorMsg = err.error || errorMsg;
          } catch { /* ignore parse error */ }
          updateQueueEntry(entry.id, { status: "failed", error: errorMsg });
          continue;
        }

        // Stream SSE progress events
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as UploadSSEEvent;

              if (event.type === "progress") {
                updateQueueEntry(entry.id, {
                  progressStage: event.stage,
                  progressPercent: event.percent,
                  progressMessage: event.message,
                });
              } else if (event.type === "complete") {
                updateQueueEntry(entry.id, {
                  status: "complete",
                  uploadId: event.uploadId,
                  chunkCount: event.chunkCount,
                  imageCount: event.imageCount,
                  profileId: event.profileId,
                  profile: event.profile,
                  progressPercent: 100,
                  progressMessage: "Analysis complete",
                  progressStage: "complete",
                });
                // Cache profile for immediate review
                if (event.analysed && event.profile && event.profileId && event.uploadId) {
                  setProfileCache((prev) => ({
                    ...prev,
                    [event.uploadId]: { profileId: event.profileId!, profile: event.profile! },
                  }));
                }
              } else if (event.type === "error") {
                updateQueueEntry(entry.id, { status: "failed", error: event.error });
              }
            } catch { /* ignore malformed SSE */ }
          }
        }
      } catch {
        updateQueueEntry(entry.id, { status: "failed", error: "Network error" });
      }
    }

    processingRef.current = false;
    await loadUploads();
  }

  /** Add files to queue and start processing */
  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const newEntries: FileUploadState[] = fileArray.map((file) => ({
      file,
      id: crypto.randomUUID(),
      status: "queued" as const,
    }));

    setUploadQueue((prev) => [...prev, ...newEntries]);
    setActiveTab("uploads");

    // Generate PDF thumbnails + page images before uploading
    await Promise.all(
      newEntries.map(async (entry) => {
        if (entry.file.name.toLowerCase().endsWith(".pdf")) {
          // Thumbnail (fast, page 1 only)
          const thumb = await generatePDFThumbnail(entry.file);
          if (thumb) {
            entry.thumbnailBlob = thumb;
            updateQueueEntry(entry.id, { thumbnailBlob: thumb });
          }
          // All page images for storage
          const pages = await extractPDFPageImages(entry.file);
          if (pages.length > 0) {
            entry.pageImages = pages.map((p) => p.blob);
          }
        }
      })
    );

    // Capture current settings for this batch
    const category = sourceCategory;
    const col = collection || undefined;
    // Start processing (non-blocking)
    processQueue(newEntries, category, col);
  }

  /** Retry a failed upload */
  async function retryUpload(entryId: string) {
    const entry = uploadQueue.find((e) => e.id === entryId);
    if (!entry) return;

    updateQueueEntry(entryId, { status: "queued", error: undefined });
    processQueue([entry], sourceCategory, collection || undefined);
  }

  async function handleViewAnalysis(uploadId: string, profileId: string) {
    if (expandedUploadId === uploadId) {
      setExpandedUploadId(null);
      return;
    }
    // If not cached, fetch it
    if (!profileCache[uploadId]) {
      try {
        const res = await fetch(`/api/teacher/knowledge/lesson-profiles/${profileId}`);
        if (res.ok) {
          const data = await res.json();
          setProfileCache((prev) => ({
            ...prev,
            [uploadId]: { profileId: data.profileId, profile: data.profile },
          }));
        }
      } catch {
        // ignore
      }
    }
    setExpandedUploadId(uploadId);
  }

  async function handleDeleteUpload(uploadId: string) {
    if (!confirm("Remove this file and all its indexed content?")) return;
    await fetch(`/api/teacher/knowledge/upload?id=${uploadId}`, { method: "DELETE" });
    loadUploads();
  }

  async function handleReanalyse(uploadId: string, profileId: string) {
    if (!confirm("Re-analyse this document with the latest AI prompts? This may take a minute.")) return;

    // Clear cached profile so UI shows loading state
    setProfileCache((prev) => {
      const next = { ...prev };
      delete next[uploadId];
      return next;
    });

    try {
      const res = await fetch(`/api/teacher/knowledge/lesson-profiles/${profileId}/reanalyse`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProfileCache((prev) => ({
          ...prev,
          [uploadId]: { profileId: data.profileId, profile: data.profile },
        }));
      } else {
        const err = await res.json();
        alert(`Re-analysis failed: ${err.error || "Unknown error"}`);
      }
    } catch {
      alert("Re-analysis failed. Please try again.");
    }
    loadUploads();
  }

  async function handleBatchReanalyse() {
    try {
      const res = await fetch("/api/teacher/knowledge/lesson-profiles/batch/reanalyse?all=true", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.outdatedProfiles === 0) {
          alert(`All ${data.totalProfiles} profiles are already on the latest version (v${data.currentVersion}).`);
        } else {
          if (confirm(`${data.outdatedProfiles} of ${data.totalProfiles} profiles need re-analysis. Start re-analysing them one by one?`)) {
            // Re-analyse each outdated profile sequentially
            for (const id of data.outdatedIds) {
              try {
                await fetch(`/api/teacher/knowledge/lesson-profiles/${id}/reanalyse`, { method: "POST" });
              } catch {
                // Continue with next profile
              }
            }
            alert("Batch re-analysis complete!");
            loadUploads();
          }
        }
      }
    } catch {
      alert("Failed to check for outdated profiles.");
    }
  }

  const [quickModifyOpen, setQuickModifyOpen] = useState(false);
  const [quickModifyContext, setQuickModifyContext] = useState<{
    profileId: string;
    profile: LessonProfile;
  } | null>(null);
  const [quickModifyPrompt, setQuickModifyPrompt] = useState("");
  const [quickModifyResult, setQuickModifyResult] = useState<Record<string, unknown> | null>(null);
  const [quickModifyLoading, setQuickModifyLoading] = useState(false);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackContext, setFeedbackContext] = useState<{
    lessonProfileId: string;
    lessonTitle: string;
    phases?: Array<{ title: string; duration_minutes: number }>;
  } | null>(null);

  function handleFeedbackOpen(uploadId: string) {
    const cached = profileCache[uploadId];
    if (!cached) return;
    const phases = cached.profile.lesson_flow?.map((p) => ({
      title: p.title,
      duration_minutes: p.estimated_minutes,
    }));
    setFeedbackContext({
      lessonProfileId: cached.profileId,
      lessonTitle: cached.profile.title || "Untitled lesson",
      phases,
    });
    setFeedbackOpen(true);
  }

  function handleQuickModifyOpen(uploadId: string) {
    const cached = profileCache[uploadId];
    if (!cached) return;
    setQuickModifyContext({ profileId: cached.profileId, profile: cached.profile });
    setQuickModifyResult(null);
    setQuickModifyPrompt("");
    setQuickModifyOpen(true);
  }

  async function handleQuickModifySubmit() {
    if (!quickModifyPrompt.trim() || !quickModifyContext) return;
    setQuickModifyLoading(true);
    setQuickModifyResult(null);
    try {
      const res = await fetch("/api/teacher/knowledge/quick-modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: quickModifyPrompt,
          unit_title: quickModifyContext.profile.title,
          unit_subject: quickModifyContext.profile.subject_area,
          unit_grade: quickModifyContext.profile.grade_level,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuickModifyResult(data.result);
      } else {
        const err = await res.json();
        alert(`Quick modify failed: ${err.error}`);
      }
    } catch {
      alert("Quick modify failed. Please try again.");
    } finally {
      setQuickModifyLoading(false);
    }
  }

  // Item actions
  function handleEdit(item: KnowledgeItem) {
    setEditingItem(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArchive(item: KnowledgeItem) {
    const action = item.is_archived ? "unarchive" : "archive";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${item.title}"?`)) return;

    await fetch(`/api/teacher/knowledge/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: !item.is_archived }),
    });
    loadItems();
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingItem(null);
    loadItems();
  }

  // Derived state
  const isProcessing = uploadQueue.some(
    (e) => e.status === "queued" || e.status === "uploading"
  );
  const queueCompleted = uploadQueue.filter((e) => e.status === "complete").length;
  const queueFailed = uploadQueue.filter((e) => e.status === "failed").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/teacher/dashboard"
              className="text-text-secondary hover:text-text-primary transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">
              Knowledge Library
            </h1>
          </div>
          <p className="text-text-secondary text-sm ml-8">
            Browse, create, and manage your teaching resources. Items feed both human browsing and AI generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => headerFileInputRef.current?.click()}
            className="px-4 py-2.5 border border-brand-purple text-brand-purple rounded-full text-sm font-medium hover:bg-brand-purple/5 transition flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
          <input
            ref={headerFileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="px-4 py-2.5 gradient-cta text-white rounded-full text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border p-4">
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-brand-purple">{items.length}</div>
          )}
          <div className="text-xs text-text-secondary mt-1">Library items</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-accent-blue">{totalChunks}</div>
          )}
          <div className="text-xs text-text-secondary mt-1">Knowledge chunks</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-accent-green">
              {uploads.filter((u) => u.status === "complete").length}
            </div>
          )}
          <div className="text-xs text-text-secondary mt-1">Documents uploaded</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeTab === tab.key
                ? "bg-brand-purple text-white"
                : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (for non-upload tabs) */}
      {activeTab !== "uploads" && (
        <div className="mb-6">
          <div className="relative">
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by title, description, or tags..."
              className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/40 hover:text-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <KnowledgeItemForm
          item={editingItem}
          onSave={handleFormSave}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Content area */}
      {activeTab === "uploads" ? (
        <UploadsSection
          uploads={uploads}
          uploadQueue={uploadQueue}
          isProcessing={isProcessing}
          queueCompleted={queueCompleted}
          queueFailed={queueFailed}
          sourceCategory={sourceCategory}
          setSourceCategory={setSourceCategory}
          collection={collection}
          setCollection={setCollection}
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleFiles={handleFiles}
          handleDelete={handleDeleteUpload}
          handleViewAnalysis={handleViewAnalysis}
          handleReanalyse={handleReanalyse}
          handleBatchReanalyse={handleBatchReanalyse}
          handleQuickModifyOpen={handleQuickModifyOpen}
          handleFeedbackOpen={handleFeedbackOpen}
          retryUpload={retryUpload}
          removeFromQueue={removeFromQueue}
          clearQueue={() => setUploadQueue([])}
          expandedUploadId={expandedUploadId}
          profileCache={profileCache}
          onCloseReview={() => setExpandedUploadId(null)}
          fileInputRef={fileInputRef}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border animate-pulse h-56" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>
          <p className="text-text-secondary mb-4">
            {debouncedSearch
              ? `No items matching "${debouncedSearch}"`
              : "No knowledge items yet. Create your first resource or upload files to get started."}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => {
                setEditingItem(null);
                setShowForm(true);
              }}
              className="px-4 py-2 gradient-cta text-white rounded-lg text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition"
            >
              Create First Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <KnowledgeItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
      {/* Quick Modify Modal */}
      {quickModifyOpen && quickModifyContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    Quick Modify
                  </h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Adapt &ldquo;{quickModifyContext.profile.title}&rdquo; on the fly
                  </p>
                </div>
                <button
                  onClick={() => setQuickModifyOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-text-secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Describe the situation
              </label>
              <textarea
                value={quickModifyPrompt}
                onChange={(e) => setQuickModifyPrompt(e.target.value)}
                placeholder='e.g., "Friday afternoon, students are tired, need quiet work for last 30 minutes" or "Half the class finished early, need an extension activity"'
                rows={3}
                className="w-full rounded-lg border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
              />
              <button
                onClick={handleQuickModifySubmit}
                disabled={quickModifyLoading || !quickModifyPrompt.trim()}
                className="mt-3 px-5 py-2.5 gradient-cta text-white rounded-full text-sm font-medium shadow-md hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {quickModifyLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Adapted Activity"
                )}
              </button>

              {/* Result */}
              {quickModifyResult && (
                <div className="mt-6 space-y-4">
                  <div className="bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 rounded-xl border border-brand-purple/15 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold text-text-primary">
                        {(quickModifyResult as Record<string, string>).title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-medium">
                        {(quickModifyResult as Record<string, string>).type} · {(quickModifyResult as Record<string, number>).estimated_minutes}m
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mb-4">{(quickModifyResult as Record<string, string>).description}</p>

                    {/* Flow phases */}
                    {Array.isArray((quickModifyResult as Record<string, unknown>).flow) && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Activity Flow</h4>
                        {((quickModifyResult as Record<string, unknown>).flow as Array<Record<string, unknown>>).map((step, i) => (
                          <div key={i} className="bg-white rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-text-primary">{step.title as string}</span>
                              <span className="text-[10px] text-text-secondary">{step.minutes as number}m</span>
                            </div>
                            <p className="text-xs text-text-secondary mb-2">
                              <span className="font-medium text-text-primary">Say to students:</span> {step.instructions as string}
                            </p>
                            <p className="text-xs text-text-secondary">
                              <span className="font-medium text-brand-purple">Teacher notes:</span> {step.teacher_notes as string}
                            </p>
                            {Array.isArray(step.materials_needed) && (
                              <p className="text-xs text-text-secondary mt-1">
                                <span className="font-medium">Materials:</span> {(step.materials_needed as string[]).join(", ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reasoning */}
                    <div className="mt-4 space-y-2 text-xs text-text-secondary">
                      <p><span className="font-medium text-text-primary">Why this works:</span> {(quickModifyResult as Record<string, string>).why_this_works}</p>
                      <p><span className="font-medium text-text-primary">How it connects:</span> {(quickModifyResult as Record<string, string>).how_this_connects}</p>
                      {(quickModifyResult as Record<string, string>).alternative_if_not_working && (
                        <p><span className="font-medium text-orange-600">Quick pivot:</span> {(quickModifyResult as Record<string, string>).alternative_if_not_working}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Feedback Modal */}
      {feedbackOpen && feedbackContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <TeacherFeedbackForm
              lessonProfileId={feedbackContext.lessonProfileId}
              lessonTitle={feedbackContext.lessonTitle}
              phases={feedbackContext.phases}
              onSubmit={() => {
                // Keep open to show success state, teacher closes manually
              }}
              onClose={() => {
                setFeedbackOpen(false);
                setFeedbackContext(null);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers (shared between sections)
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  const icons: Record<string, { bg: string; stroke: string }> = {
    pdf: { bg: "bg-red-50", stroke: "#EF4444" },
    docx: { bg: "bg-blue-50", stroke: "#3B82F6" },
  };
  const ext = fileType.split("/").pop() || fileType;
  const { bg, stroke } = icons[ext] || icons[fileType] || { bg: "bg-orange-50", stroke: "#F97316" };

  return (
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

function getFileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

// ---------------------------------------------------------------------------
// Upload stage message — rotates through educational messages for long stages
// ---------------------------------------------------------------------------

function UploadStageMessage({ stage, message }: { stage?: UploadStage; message?: string }) {
  const [displayMessage, setDisplayMessage] = useState(message || "Starting upload...");

  useEffect(() => {
    if (!stage || stage === "complete") {
      setDisplayMessage(message || "Analysis complete");
      return;
    }

    const config = UPLOAD_STAGE_CONFIG[stage];
    if (!config || config.messages.length <= 1) {
      setDisplayMessage(message || config?.messages[0] || "Processing...");
      return;
    }

    // Rotate through messages every 4 seconds for long-running stages
    let idx = 0;
    setDisplayMessage(config.messages[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % config.messages.length;
      setDisplayMessage(config.messages[idx]);
    }, 4000);

    return () => clearInterval(interval);
  }, [stage, message]);

  return (
    <p className="text-xs text-[#7C3AED] animate-pulse truncate">
      {displayMessage}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Upload Queue component — shown during active batch uploads
// ---------------------------------------------------------------------------

function UploadQueuePanel({
  queue,
  queueCompleted,
  queueFailed,
  retryUpload,
  removeFromQueue,
  clearQueue,
}: {
  queue: FileUploadState[];
  queueCompleted: number;
  queueFailed: number;
  retryUpload: (id: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}) {
  const total = queue.length;
  const isAllDone = queue.every((e) => e.status === "complete" || e.status === "failed");

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden mb-6">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isAllDone && (
            <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {isAllDone
              ? `Upload complete — ${queueCompleted} of ${total} succeeded${queueFailed > 0 ? `, ${queueFailed} failed` : ""}`
              : `Processing ${total} file${total !== 1 ? "s" : ""} (${queueCompleted} of ${total} done)`
            }
          </span>
        </div>
        {isAllDone && (
          <button
            onClick={clearQueue}
            className="text-xs text-text-secondary hover:text-text-primary transition"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        {(() => {
          const currentUploading = queue.find((e) => e.status === "uploading");
          const basePercent = total > 0 ? ((queueCompleted + queueFailed) / total) * 100 : 0;
          const subPercent = currentUploading?.progressPercent
            ? (currentUploading.progressPercent / 100 / total) * 100
            : 0;
          return (
            <div
              className={`h-full transition-all duration-700 ease-out ${
                queueFailed > 0
                  ? "bg-amber-400"
                  : "bg-gradient-to-r from-[#7C3AED] to-[#EC4899]"
              }`}
              style={{ width: `${Math.min(basePercent + subPercent, 100)}%` }}
            />
          );
        })()}
      </div>

      {/* File list */}
      <div className="divide-y divide-border/50">
        {queue.map((entry) => (
          <div
            key={entry.id}
            className={`px-4 py-3 ${
              entry.status === "uploading" ? "bg-gradient-to-r from-purple-50/40 to-transparent" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                {entry.status === "queued" && (
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                )}
                {entry.status === "uploading" && (
                  <div className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                )}
                {entry.status === "complete" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {entry.status === "failed" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>

              {/* File info */}
              {getFileIcon(getFileExt(entry.file.name))}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {entry.file.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatFileSize(entry.file.size)}
                  {entry.status === "complete" && entry.chunkCount !== undefined && (
                    <span className="ml-2 text-accent-green">
                      {entry.chunkCount} chunks
                      {entry.imageCount ? ` + ${entry.imageCount} image${entry.imageCount !== 1 ? "s" : ""} analysed` : " indexed"}
                    </span>
                  )}
                  {entry.status === "failed" && entry.error && (
                    <span className="ml-2 text-red-500">{entry.error}</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              {entry.status === "queued" && (
                <button
                  onClick={() => removeFromQueue(entry.id)}
                  className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-text-secondary/40 hover:text-text-secondary transition"
                  title="Remove from queue"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              {entry.status === "failed" && (
                <button
                  onClick={() => retryUpload(entry.id)}
                  className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Progress indicator for uploading files */}
            {entry.status === "uploading" && (
              <div className="mt-2 ml-9 mr-4">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${entry.progressPercent || 2}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <UploadStageMessage
                    stage={entry.progressStage}
                    message={entry.progressMessage}
                  />
                  <span className="text-[10px] text-text-secondary/60 tabular-nums">
                    {entry.progressPercent || 0}%
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Uploads section (with batch upload support)
// ---------------------------------------------------------------------------

function UploadsSection({
  uploads,
  uploadQueue,
  isProcessing,
  queueCompleted,
  queueFailed,
  sourceCategory,
  setSourceCategory,
  collection,
  setCollection,
  dragOver,
  setDragOver,
  handleFiles,
  handleDelete,
  handleViewAnalysis,
  handleReanalyse,
  handleBatchReanalyse,
  handleQuickModifyOpen,
  handleFeedbackOpen,
  retryUpload,
  removeFromQueue,
  clearQueue,
  expandedUploadId,
  profileCache,
  onCloseReview,
  fileInputRef,
}: {
  uploads: Upload[];
  uploadQueue: FileUploadState[];
  isProcessing: boolean;
  queueCompleted: number;
  queueFailed: number;
  sourceCategory: SourceCategory;
  setSourceCategory: (v: SourceCategory) => void;
  collection: string;
  setCollection: (v: string) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleFiles: (files: FileList | File[]) => void;
  handleDelete: (id: string) => void;
  handleViewAnalysis: (uploadId: string, profileId: string) => void;
  handleReanalyse: (uploadId: string, profileId: string) => void;
  handleBatchReanalyse: () => void;
  handleQuickModifyOpen: (uploadId: string) => void;
  handleFeedbackOpen: (uploadId: string) => void;
  retryUpload: (id: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  expandedUploadId: string | null;
  profileCache: Record<string, CachedProfile>;
  onCloseReview: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      {/* Upload queue (shown when batch uploading) */}
      {uploadQueue.length > 0 && (
        <UploadQueuePanel
          queue={uploadQueue}
          queueCompleted={queueCompleted}
          queueFailed={queueFailed}
          retryUpload={retryUpload}
          removeFromQueue={removeFromQueue}
          clearQueue={clearQueue}
        />
      )}

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all mb-6 ${
          dragOver
            ? "border-brand-purple bg-brand-purple/5"
            : "border-border bg-white hover:border-brand-purple/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-text-primary font-semibold mb-1">
          {isProcessing ? "Drop more files to add to queue" : "Drop files here"}
        </p>
        <p className="text-text-secondary text-sm mb-4">
          PDF, DOCX, or PPTX files up to 20MB — content is indexed for AI generation
        </p>

        {/* Source category selector */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <label className="text-xs text-text-secondary font-medium">Type:</label>
          <select
            value={sourceCategory}
            onChange={(e) => setSourceCategory(e.target.value as SourceCategory)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
          >
            {SOURCE_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-secondary/60">
            {SOURCE_CATEGORIES.find((c) => c.key === sourceCategory)?.description}
          </span>
        </div>

        {/* Collection input */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <label className="text-xs text-text-secondary font-medium">Collection:</label>
          <input
            type="text"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="e.g. Nelson Textbook Ch1-5, Year 10 Textiles"
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary bg-white placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 w-72"
          />
        </div>

        {/* Textbook copyright note */}
        {sourceCategory === "textbook" && (
          <p className="text-xs text-text-secondary mb-4 max-w-md mx-auto">
            Content is analysed for teaching patterns and strategies. Original text is stored privately and not reproduced in generated units.
          </p>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2.5 gradient-cta text-white rounded-full text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition"
        >
          Choose Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Info callout */}
      <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-xl p-4 mb-8">
        <div className="flex gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">How uploads work</p>
            <p>Each file goes through visual analysis (diagrams, charts, images) and AI analysis (structure, pedagogy, workshop readiness), then is broken into searchable chunks. Upload multiple files at once — they process sequentially with individual progress tracking.</p>
          </div>
        </div>
      </div>

      {/* Upload list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Uploaded Files</h2>
        {uploads.length > 0 && (
          <button
            onClick={handleBatchReanalyse}
            className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
            title="Re-analyse all files with latest AI prompts"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
            Re-analyse All
          </button>
        )}
      </div>
      {uploads.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-text-secondary">
            No files uploaded yet. Upload existing lesson plans, unit overviews, or handouts to feed the AI.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map((upload) => {
            const hasProfile = !!upload.lesson_profile_id;
            const isExpanded = expandedUploadId === upload.id;
            const cached = profileCache[upload.id];
            const isAnalysing = upload.analysis_stage && !["complete", "analysed", null].includes(upload.analysis_stage) && upload.status !== "failed";

            return (
              <div key={upload.id}>
                <div
                  className={`bg-white rounded-xl border p-4 flex items-center gap-4 group transition ${
                    isExpanded ? "border-brand-purple/30 rounded-b-none" : "border-border"
                  }`}
                >
                  {getFileIcon(upload.file_type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {upload.filename}
                      </p>
                      {upload.status === "processing" && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-medium">
                          {isAnalysing ? `Analysing (${upload.analysis_stage})` : "Processing"}
                        </span>
                      )}
                      {upload.status === "failed" && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium">
                          Failed
                        </span>
                      )}
                      {upload.status === "complete" && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                          {upload.chunk_count} chunks
                        </span>
                      )}
                      {hasProfile && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-medium">
                          Analysed
                        </span>
                      )}
                      {upload.source_category && upload.source_category !== "lesson_plan" && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-medium">
                          {SOURCE_CATEGORIES.find((c) => c.key === upload.source_category)?.label || upload.source_category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {formatFileSize(upload.file_size)} &middot;{" "}
                      {new Date(upload.created_at).toLocaleDateString()}
                      {upload.error_message && (
                        <span className="text-red-500 ml-2">{upload.error_message}</span>
                      )}
                    </p>
                  </div>

                  {/* View Analysis button */}
                  {hasProfile && (
                    <button
                      onClick={() => handleViewAnalysis(upload.id, upload.lesson_profile_id!)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isExpanded
                          ? "bg-brand-purple text-white"
                          : "bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20"
                      }`}
                    >
                      {isExpanded ? "Hide" : "View Analysis"}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(upload.id)}
                    className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-text-secondary/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                    title="Remove"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </div>

                {/* Inline lesson profile review */}
                {isExpanded && cached && (
                  <div className="border border-t-0 border-brand-purple/30 rounded-b-xl overflow-hidden">
                    <LessonProfileReview
                      profile={cached.profile}
                      profileId={cached.profileId}
                      onClose={onCloseReview}
                      onReanalyse={() => handleReanalyse(upload.id, upload.lesson_profile_id!)}
                      onQuickModify={() => handleQuickModifyOpen(upload.id)}
                      onFeedback={() => handleFeedbackOpen(upload.id)}
                    />
                  </div>
                )}
                {isExpanded && !cached && (
                  <div className="border border-t-0 border-brand-purple/30 rounded-b-xl p-8 text-center bg-white">
                    <p className="text-sm text-text-secondary">Loading analysis...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
