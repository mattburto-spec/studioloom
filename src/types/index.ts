import type { EllLevel, PageId } from "@/lib/constants";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Student {
  id: string;
  username: string;
  display_name: string | null;
  class_id: string;
  ell_level: EllLevel;
  created_at: string;
}

export interface StudentSession {
  id: string;
  student_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Unit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content_data: UnitContentData;
  created_at: string;
}

export interface ClassUnit {
  class_id: string;
  unit_id: string;
  is_active: boolean;
  locked_pages: number[];
}

export type ProgressStatus = "not_started" | "in_progress" | "complete";

export interface StudentProgress {
  id: string;
  student_id: string;
  unit_id: string;
  page_number: number;
  status: ProgressStatus;
  responses: Record<string, unknown>;
  time_spent: number;
  updated_at: string;
}

export type PlanningTaskStatus = "todo" | "in_progress" | "done";

export interface PlanningTask {
  id: string;
  student_id: string;
  unit_id: string;
  title: string;
  status: PlanningTaskStatus;
  target_date: string | null;
  actual_date: string | null;
  time_logged: number;
  page_number: number | null;
  sort_order: number;
  created_at: string;
}

// --- Unit Content JSON Schema Types ---

export interface VocabTerm {
  term: string;
  definition: string;
  example?: string;
}

export interface VocabWarmup {
  terms: VocabTerm[];
  activity?: {
    type: "matching" | "fill-blank" | "drag-sort";
    items: Array<{ question: string; answer: string }>;
  };
}

export interface EllScaffolding {
  ell1?: { sentenceStarters?: string[]; hints?: string[] };
  ell2?: { sentenceStarters?: string[] };
  ell3?: { extensionPrompts?: string[] };
}

export type ResponseType = "text" | "upload" | "sketch" | "voice" | "multi";

export interface ActivitySection {
  prompt: string;
  scaffolding?: EllScaffolding;
  responseType: ResponseType;
  exampleResponse?: string;
}

export interface Reflection {
  type: "confidence-slider" | "checklist" | "short-response";
  items: string[];
}

export interface PageContent {
  title: string;
  learningGoal: string;
  vocabWarmup?: VocabWarmup;
  introduction?: {
    text: string;
    media?: { type: "image" | "video"; url: string };
  };
  sections: ActivitySection[];
  reflection?: Reflection;
}

export type UnitContentData = {
  pages?: Partial<Record<PageId, PageContent>>;
};

// --- Auth context types ---

export interface StudentAuthContext {
  student: Student;
  classInfo: Class;
}

export interface TeacherAuthContext {
  teacher: Teacher;
}
