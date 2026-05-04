/**
 * /school/me/settings — Phase 4.4 hotfix C3 nav helper.
 *
 * Server-side redirect to the current teacher's school settings page.
 * Lets us link to a stable URL ("/school/me/settings") from the
 * teacher's avatar dropdown without needing to load + thread the
 * teacher's school_id into the client nav component.
 *
 * Resolution:
 *   - Authenticated teacher with school_id set → 307 redirect to
 *     /school/<school_id>/settings
 *   - Unauthenticated → /teacher/login
 *   - Authenticated but no school_id (shouldn't happen post-§4.3.y
 *     auto-personal-school trigger, but defence-in-depth) →
 *     /teacher/welcome to attach a school first
 *
 * Static-segment route ("/school/me/...") takes precedence over the
 * dynamic [id] route in Next.js routing.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SchoolMeSettingsRedirect() {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          cookieHeader
            .split("; ")
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=");
              return {
                name: c.slice(0, eq),
                value: decodeURIComponent(c.slice(eq + 1)),
              };
            }),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/teacher/login");
  }

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!teacher?.school_id) {
    redirect("/teacher/welcome");
  }

  redirect(`/school/${teacher.school_id}/settings`);
}
