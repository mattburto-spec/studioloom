"use client";

/**
 * Student Tools Landing Page
 *
 * This is a placeholder/redirect page. Individual tool routes exist at:
 * - /toolkit/scamper
 * - /toolkit/six-thinking-hats
 * - /toolkit/pmi-chart
 * - /toolkit/five-whys
 * - /toolkit/empathy-map
 * etc.
 *
 * The public toolkit browser is at /toolkit
 * Student tool persistence is handled per-route.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudentToolsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the public toolkit browser
    router.push("/toolkit");
  }, [router]);

  return null;
}
