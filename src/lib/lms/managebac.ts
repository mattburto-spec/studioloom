import type { LMSProvider, LMSClass, LMSStudent } from "./types";

interface ManageBacClassResponse {
  classes: Array<{
    id: number;
    name: string;
    grade?: string;
    program?: string;
  }>;
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

interface ManageBacStudentResponse {
  students: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    student_id?: string;
  }>;
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

/**
 * ManageBac implementation of the LMSProvider interface.
 * Uses the ManageBac REST API with `auth-token` header authentication.
 *
 * API Docs: https://managebac.com/api
 * Base URL: https://{subdomain}.managebac.com/api
 */
export class ManageBacProvider implements LMSProvider {
  private baseUrl: string;
  private apiToken: string;

  constructor(subdomain: string, apiToken: string) {
    // Support both "myschool" and "myschool.managebac.com" formats
    const cleanSubdomain = subdomain.replace(/\.managebac\.com.*$/, "").trim();
    this.baseUrl = `https://${cleanSubdomain}.managebac.com/api`;
    this.apiToken = apiToken;
  }

  private async fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        "auth-token": this.apiToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid ManageBac API token. Please check your credentials.");
      }
      if (response.status === 403) {
        throw new Error("Insufficient permissions. Your ManageBac API token may not have access to this resource.");
      }
      throw new Error(`ManageBac API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async getClasses(): Promise<LMSClass[]> {
    const allClasses: LMSClass[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const data = await this.fetchApi<ManageBacClassResponse>("/classes", {
        page: String(page),
        per_page: "100",
      });

      for (const cls of data.classes) {
        allClasses.push({
          id: String(cls.id),
          name: cls.name,
        });
      }

      totalPages = data.meta.total_pages;
      page++;
    } while (page <= totalPages);

    return allClasses;
  }

  async getClassStudents(classId: string): Promise<LMSStudent[]> {
    const allStudents: LMSStudent[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const data = await this.fetchApi<ManageBacStudentResponse>(
        `/classes/${classId}/students`,
        { page: String(page), per_page: "100" }
      );

      for (const student of data.students) {
        const fullName = `${student.first_name} ${student.last_name}`.trim();
        allStudents.push({
          id: String(student.id),
          name: fullName,
          email: student.email,
        });
      }

      totalPages = data.meta.total_pages;
      page++;
    } while (page <= totalPages);

    return allStudents;
  }
}
