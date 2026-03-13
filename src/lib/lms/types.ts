/**
 * Generic LMS Provider interface.
 * Each LMS (ManageBac, Toddle, Canvas, Schoology, etc.) implements this interface.
 * API routes use the factory to get the right provider — no LMS-specific code in routes.
 */

export interface LMSClass {
  /** LMS-specific class ID (stored as external_class_id) */
  id: string;
  /** Human-readable class name */
  name: string;
}

export interface LMSStudent {
  /** LMS-specific student ID (stored as external_id) */
  id: string;
  /** Student's full display name */
  name: string;
  /** Student's email (if available — used for username generation) */
  email?: string;
}

export interface LMSProvider {
  /** Fetch all classes accessible by the teacher */
  getClasses(): Promise<LMSClass[]>;
  /** Fetch all students in a specific class */
  getClassStudents(classId: string): Promise<LMSStudent[]>;
}

/** Configuration passed to the provider factory */
export interface ProviderConfig {
  subdomain?: string;
  apiToken?: string;
}
