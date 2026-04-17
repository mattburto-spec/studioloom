import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { isAdminUser } from "@/lib/auth/require-admin";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/teacher/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/tools/") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/toolkit") ||
    pathname.startsWith("/safety/projector") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Admin routes — require Supabase Auth AND teachers.is_admin=true
  // (with ADMIN_EMAILS env-var fallback so we can't lock ourselves out).
  // Non-admins are sent to /admin/login, not /teacher/login, to keep the
  // admin auth surface visually separate from the teacher area.
  //
  // Wrapped in try/catch so any transient error (stale cookies, DB blip,
  // edge-runtime quirk) fails CLOSED to /admin/login rather than surfacing
  // Sentry's "Something went wrong" page to the user.
  if (pathname.startsWith("/admin")) {
    // Disable HTTP + bfcache for /admin so browsers can't flash stale HTML
    // (e.g. the admin dashboard snapshot captured while you were logged in).
    // Applied to BOTH redirect and allow-through responses.
    const NO_STORE = "no-store, private, max-age=0, must-revalidate";

    const loginRedirect = (extra?: Record<string, string>) => {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      if (extra) for (const [k, v] of Object.entries(extra)) loginUrl.searchParams.set(k, v);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set("Cache-Control", NO_STORE);
      return redirect;
    };

    try {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", NO_STORE);

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return loginRedirect();
      }

      const isAdmin = await isAdminUser(user.id, user.email);
      if (!isAdmin) {
        return loginRedirect({ error: "not_authorised" });
      }

      return response;
    } catch (err) {
      console.error("[middleware /admin] auth check failed:", err);
      return loginRedirect();
    }
  }

  // Teacher routes — require Supabase Auth
  if (pathname.startsWith("/teacher")) {
    const response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/teacher/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Student routes — require student session cookie
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/unit") || pathname.startsWith("/open-studio") || pathname.startsWith("/discovery") || pathname.startsWith("/gallery") || pathname.startsWith("/safety") || pathname.startsWith("/my-tools")) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Token existence check — full validation happens in the page/API
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
