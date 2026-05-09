import StudentLoginForm from "../StudentLoginForm";
import { normalizeClassCodeFromUrl } from "../class-code-helpers";

// /login/[classcode] — pre-fills the class-code field on the existing
// student login page so a teacher can share one link in WeChat. Pre-fill
// only; the student still types their username and the form still submits
// to /api/auth/student-classcode-login. No session is created by visiting
// this page (the auth route is the only thing that mints sb-* cookies).
export default async function PrefilledStudentLoginPage({
  params,
}: {
  params: Promise<{ classcode: string }>;
}) {
  const { classcode } = await params;
  const initialClassCode = normalizeClassCodeFromUrl(classcode);
  return <StudentLoginForm initialClassCode={initialClassCode} />;
}
