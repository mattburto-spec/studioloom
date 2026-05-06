"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAutoSave } from "./useAutoSave";
import { UndoManager } from "./UndoManager";
import { normalizeToV2 } from "@/lib/unit-adapter";
import type { UnitContentData, UnitContentDataV2, PageContent } from "@/types";

type EditMode = "all" | "class";

interface VersionEntry {
  version: number;
  label: string;
  created_at: string;
  source_class_id: string | null;
  sourceClassName: string | null;
}

interface UseLessonEditorProps {
  unitId: string;
  classId: string;
}

interface UseLessonEditorReturn {
  // Content
  content: UnitContentData | null;
  loading: boolean;
  error: string | null;

  // Unit metadata
  unitTitle: string | null;
  thumbnailUrl: string | null;
  setThumbnailUrl: (url: string) => void;
  framework: string; // Framework for design phases and context

  // Selection & UI state
  selectedPageIndex: number | null;
  setSelectedPageIndex: (index: number) => void;

  // Content mutations
  updatePage: (pageIndex: number, partial: Partial<PageContent>) => void;
  addPage: (defaultTitle?: string) => void;
  removePage: (pageIndex: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  // Fork state & edit mode
  isFork: boolean;
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;

  // Version history
  versionHistory: VersionEntry[];
  loadingVersions: boolean;

  // Promote fork
  promoteFork: (saveVersionFirst: boolean) => Promise<boolean>;
  promoting: boolean;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Auto-save status
  saveStatus: "idle" | "saving" | "saved" | "error";
}

/**
 * useLessonEditor — Main state hook for the lesson editor
 *
 * Responsibilities:
 * - Load resolved content from GET /api/teacher/class-units/content
 * - Manage page selection and editing
 * - Maintain undo/redo stack
 * - Auto-save changes via useAutoSave (routes to master or fork based on editMode)
 * - Track fork status and version history
 * - Support "Apply to All Classes" (promote fork to master)
 */
export function useLessonEditor({
  unitId,
  classId,
}: UseLessonEditorProps): UseLessonEditorReturn {
  // Content state
  const [content, setContent] = useState<UnitContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFork, setIsFork] = useState(false);

  // Edit mode — defaults to "class" when entering from class context
  const [editMode, setEditMode] = useState<EditMode>("class");

  // Version history
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Promote fork state
  const [promoting, setPromoting] = useState(false);

  // Unit metadata
  const [unitTitle, setUnitTitle] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [framework, setFramework] = useState<string>("IB_MYP");

  // Selection state
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  // Undo/redo manager
  const undoManagerRef = useRef(new UndoManager<UnitContentData>());

  // Load content on mount
  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch(
          `/api/teacher/class-units/content?unitId=${unitId}&classId=${classId}`
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to load content");
          setLoading(false);
          return;
        }

        const data = await response.json();
        // Force-normalize all content versions (v1/v2/v3/v4) to v2 with guaranteed .pages array
        const loadedContent = normalizeToV2(data.content);

        setContent(loadedContent);
        setIsFork(data.isForked || false);
        setThumbnailUrl(data.thumbnailUrl || null);
        setUnitTitle(data.unitTitle || null);
        setFramework(data.framework || "IB_MYP");

        // Default edit mode based on fork status
        setEditMode("class");

        // Initialize undo stack with the loaded content
        undoManagerRef.current.push(loadedContent);

        // Auto-select first page
        if (loadedContent.pages && loadedContent.pages.length > 0) {
          setSelectedPageIndex(0);
        }

        setLoading(false);
      } catch (err) {
        console.error("[useLessonEditor] load error:", err);
        setError("Failed to load editor");
        setLoading(false);
      }
    }

    loadContent();
  }, [unitId, classId]);

  // Load version history
  useEffect(() => {
    async function loadVersions() {
      setLoadingVersions(true);
      try {
        const response = await fetch(`/api/teacher/units/versions?unitId=${unitId}`);
        if (response.ok) {
          const data = await response.json();
          setVersionHistory(data.versions || []);
        }
      } catch (err) {
        console.error("[useLessonEditor] version history load error:", err);
      }
      setLoadingVersions(false);
    }

    loadVersions();
  }, [unitId]);

  // Handle edit mode change
  // When switching modes, the content in the editor stays the same.
  // The auto-save hook routes saves to the correct endpoint based on editMode:
  //   - "all" → PATCH /api/teacher/units/[unitId]/content (master)
  //   - "class" → PATCH /api/teacher/class-units/content (fork-on-write)
  const handleSetEditMode = useCallback(
    (mode: EditMode) => {
      if (mode === editMode) return;
      setEditMode(mode);
    },
    [editMode]
  );

  // Promote fork to master
  const promoteFork = useCallback(
    async (saveVersionFirst: boolean): Promise<boolean> => {
      setPromoting(true);
      try {
        const response = await fetch(`/api/teacher/units/${unitId}/promote-fork`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, saveVersionFirst }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.error("[promoteFork] failed:", data.error);
          setPromoting(false);
          return false;
        }

        // After promotion, the fork is cleared — reload content
        setIsFork(false);
        setEditMode("class"); // Back to class mode (now inherits master)

        // Refresh version history
        const versionsResp = await fetch(`/api/teacher/units/versions?unitId=${unitId}`);
        if (versionsResp.ok) {
          const versionsData = await versionsResp.json();
          setVersionHistory(versionsData.versions || []);
        }

        setPromoting(false);
        return true;
      } catch (err) {
        console.error("[promoteFork] error:", err);
        setPromoting(false);
        return false;
      }
    },
    [unitId, classId]
  );

  // Update a single page
  const updatePage = useCallback(
    (pageIndex: number, partial: Partial<PageContent>) => {
      setContent((prev) => {
        if (!prev || !(prev as any).pages || pageIndex < 0 || pageIndex >= (prev as any).pages.length) {
          return prev;
        }

        const newContent = structuredClone(prev);
        const pages = (newContent as any).pages;
        const merged = {
          ...pages[pageIndex],
          content: {
            ...pages[pageIndex].content,
            ...partial,
          },
        };
        // Round 13 (6 May 2026) — keep page.title (top-level) in sync
        // with content.title. The student-facing sidebar + the teacher
        // progress grid both read page.title, while the editor's title
        // input writes to content.title via onUpdate. Without this
        // mirror, renaming a lesson from the editor leaves the student
        // sidebar showing "New Lesson" and the progress grid showing
        // the raw page-id slug.
        if (typeof partial.title === "string") {
          merged.title = partial.title;
        }
        pages[pageIndex] = merged;

        // Push to undo stack
        undoManagerRef.current.push(newContent);

        return newContent;
      });
    },
    []
  );

  // Add a new page
  const addPage = useCallback((defaultTitle = "New Lesson") => {
    setContent((prev) => {
      if (!prev) return prev;

      const newContent = structuredClone(prev);
      const newPageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const pages = (newContent as any).pages;

      pages.push({
        id: newPageId,
        type: "lesson",
        title: defaultTitle,
        content: {
          title: defaultTitle,
          learningGoal: "",
          sections: [],
          workshopPhases: {
            opening: { durationMinutes: 5 },
            miniLesson: { durationMinutes: 10 },
            workTime: { durationMinutes: 25 },
            debrief: { durationMinutes: 5 },
          },
          extensions: [],
        },
      });

      undoManagerRef.current.push(newContent);

      // Auto-select the new page
      setSelectedPageIndex(pages.length - 1);

      return newContent;
    });
  }, []);

  // Remove a page
  const removePage = useCallback((pageIndex: number) => {
    setContent((prev) => {
      if (!prev || !(prev as any).pages || pageIndex < 0 || pageIndex >= (prev as any).pages.length) {
        return prev;
      }

      const newContent = structuredClone(prev);
      const pages = (newContent as any).pages;
      pages.splice(pageIndex, 1);

      undoManagerRef.current.push(newContent);

      // Adjust selection if needed
      setSelectedPageIndex((prevIndex) => {
        if (prevIndex === null) return null;
        if (prevIndex >= pages.length) {
          return Math.max(0, pages.length - 1);
        }
        return prevIndex;
      });

      return newContent;
    });
  }, []);

  // Reorder pages
  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setContent((prev) => {
      if (!prev || !(prev as any).pages) return prev;

      const newContent = structuredClone(prev);
      const pages = (newContent as any).pages;
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);

      undoManagerRef.current.push(newContent);

      // Update selection if it was the moved page
      setSelectedPageIndex((prevIndex) => {
        if (prevIndex === null) return null;
        if (prevIndex === fromIndex) return toIndex;
        if (fromIndex < prevIndex && toIndex >= prevIndex) return prevIndex - 1;
        if (fromIndex > prevIndex && toIndex <= prevIndex) return prevIndex + 1;
        return prevIndex;
      });

      return newContent;
    });
  }, []);

  // Undo
  const undo = useCallback(() => {
    const previous = undoManagerRef.current.undo();
    if (previous) {
      setContent(previous);
    }
  }, []);

  // Redo
  const redo = useCallback(() => {
    const next = undoManagerRef.current.redo();
    if (next) {
      setContent(next);
    }
  }, []);

  // Auto-save hook — routes to master or fork based on editMode
  // Only enabled after initial content load succeeds (prevents empty saves on 404 or loading state)
  const saveStatus = useAutoSave({
    unitId,
    classId,
    content: content || { version: 2, pages: [] },
    editMode,
    enabled: !loading && !error && content !== null,
  });

  return {
    content,
    loading,
    error,
    unitTitle,
    thumbnailUrl,
    setThumbnailUrl,
    framework,
    selectedPageIndex,
    setSelectedPageIndex,
    updatePage,
    addPage,
    removePage,
    reorderPages,
    isFork,
    editMode,
    setEditMode: handleSetEditMode,
    versionHistory,
    loadingVersions,
    promoteFork,
    promoting,
    undo,
    redo,
    canUndo: undoManagerRef.current.canUndo,
    canRedo: undoManagerRef.current.canRedo,
    saveStatus,
  };
}
