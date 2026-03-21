export { extractLessonStructure } from "./extract-lesson-structure";
export type {
  LessonStructureExtraction,
  ExtractedLesson,
  ExtractedActivity,
  ExtractedResource,
  ExtractedRubric,
  DocumentLayout,
} from "./extract-lesson-structure";
export { buildSkeletonFromExtraction } from "./build-skeleton";
export { detectFramework, buildFrameworkContextForExtraction } from "./detect-framework";
export type { FrameworkDetection } from "./detect-framework";
export { extractImagesFromDocx, isDocx } from "./extract-images";
export type { ExtractedImage } from "./extract-images";
