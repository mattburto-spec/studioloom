"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAutoSave } from "./useAutoSave";
import { UndoManager } from "./UndoManager";
import type { UnitContentData, PageContent } from "@/types";

interface UseLessonEditorProps {
  unitId: string;
  classId: string;
}

interface UseLessonEditorReturn {
  // Content
  content: UnitContentData | null;
  loading: boolean;
  error: string | null;

  // Selection & UI state
  selectedPageIndex: number | null;
  setSelectedPageIndex: (index: number) => void;

  // Content mutations
  updatePage: (pageIndex: number, partial: Partial<PageContent>) => void;
  addPage: (defaultTitle?: string) => void;
  removePage: (pageIndex: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  // Fork state
  isFork: boolean;

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
 * - Auto-save changes via useAutoSave
 * - Track fork status
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
        const loadedContent = data.content as UnitContentData;

        setContent(loadedContent);
        setIsFork(data.isForked || false);

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

  // Update a single page
  const updatePage = useCallback(
    (pageIndex: number, partial: Partial<PageContent>) => {
      setContent((prev) => {
        if (!prev || !prev.pages || pageIndex < 0 || pageIndex >= prev.pages.length) {
          return prev;
        }

        const newContent = structuredClone(prev);
        newContent.pages[pageIndex].content = {
          ...newContent.pages[pageIndex].content,
          ...partial,
        };

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

      newContent.pages.push({
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
      setSelectedPageIndex(newContent.pages.length - 1);

      return newContent;
    });
  }, []);

  // Remove a page
  const removePage = useCallback((pageIndex: number) => {
    setContent((prev) => {
      if (!prev || !prev.pages || pageIndex < 0 || pageIndex >= prev.pages.length) {
        return prev;
      }

      const newContent = structuredClone(prev);
      newContent.pages.splice(pageIndex, 1);

      undoManagerRef.current.push(newContent);

      // Adjust selection if needed
      setSelectedPageIndex((prevIndex) => {
        if (prevIndex === null) return null;
        if (prevIndex >= newContent.pages.length) {
          return Math.max(0, newContent.pages.length - 1);
        }
        return prevIndex;
      });

      return newContent;
    });
  }, []);

  // Reorder pages
  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setContent((prev) => {
      if (!prev || !prev.pages) return prev;

      const newContent = structuredClone(prev);
      const [moved] = newContent.pages.splice(fromIndex, 1);
      newContent.pages.splice(toIndex, 0, moved);

      undoManagerRef.current.push(newContent);

      // Update selection if it was the moved page
      setSelectedPageIndex((prevIndex) => {
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

  // Auto-save hook
  const saveStatus = useAutoSave({
    unitId,
    classId,
    content: content || { version: 2, pages: [] },
  });

  return {
    content,
    loading,
    error,
    selectedPageIndex,
    setSelectedPageIndex,
    updatePage,
    addPage,
    removePage,
    reorderPages,
    isFork,
    undo,
    redo,
    canUndo: undoManagerRef.current.canUndo,
    canRedo: undoManagerRef.current.canRedo,
    saveStatus,
  };
}
