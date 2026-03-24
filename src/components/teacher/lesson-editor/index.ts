// Barrel export for lesson editor components

export { default as LessonEditor } from "./LessonEditor";
export { default as InlineEdit } from "./InlineEdit";
export { default as LessonHeader } from "./LessonHeader";
export { default as PhaseSection } from "./PhaseSection";
export { default as ActivityBlock } from "./ActivityBlock";
export { default as ExtensionBlock } from "./ExtensionBlock";
export { default as BlockPalette } from "./BlockPalette";
export { default as GhostBlock } from "./GhostBlock";
export { default as DropZone } from "./DropZone";
export { default as AITextField } from "./AITextField";
export { DndProvider, useDndContext } from "./DndContext";
export { LessonSidebar } from "./LessonSidebar";
export { ActivityBlockAdd } from "./ActivityBlockAdd";

export { useLessonEditor } from "./useLessonEditor";
export { useAutoSave } from "./useAutoSave";
export { useAISuggestions } from "./useAISuggestions";
export { UndoManager } from "./UndoManager";

// Types
export type { BlockDefinition, BlockCategory } from "./BlockPalette";
export type { AISuggestion, SuggestionContext } from "./useAISuggestions";
