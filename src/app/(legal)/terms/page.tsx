import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — StudioLoom",
  description: "The terms governing your use of StudioLoom.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-gray-500">Last updated: 1 May 2026</p>

      <p>
        These terms govern your use of StudioLoom. By creating an account or using the
        service, you agree to them. If you don&rsquo;t, please don&rsquo;t use the service.
      </p>

      <h2>1. Who can use StudioLoom</h2>
      <ul>
        <li><strong>Schools</strong> sign up the institution and authorise teachers to use the platform.</li>
        <li><strong>Teachers</strong> must be authorised by their school and be at least 18 years old.</li>
        <li><strong>Students</strong> access the platform through their school&rsquo;s class. Students do not contract with us directly; their school does so on their behalf.</li>
      </ul>

      <h2>2. Your account</h2>
      <p>
        Keep your account credentials secure. You&rsquo;re responsible for activity on your
        account. Tell us if you suspect unauthorised access:{" "}
        <a href="mailto:hello@loominary.org">hello@loominary.org</a>.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload unlawful, harmful, or infringing content.</li>
        <li>Share content that violates other people&rsquo;s privacy or intellectual property.</li>
        <li>Attempt to disable, overload, or reverse-engineer the platform.</li>
        <li>Use automated tools to scrape or harvest data.</li>
        <li>Submit prompts intended to extract personal data, generate harmful content, or bypass safety measures.</li>
      </ul>
      <p>We may suspend accounts that breach these rules.</p>

      <h2>4. Your content</h2>
      <p>
        You own the content you create on StudioLoom — your units, lessons, student work,
        and uploaded files. You grant us a limited licence to host, display, and process your
        content as needed to operate the service (e.g. saving it to our database, showing it
        to your class, sending it to AI providers under our data-processing agreements). This
        licence ends when you delete the content or close your account.
      </p>

      <h2>5. AI-generated content</h2>
      <p>
        StudioLoom uses AI models to generate lesson scaffolding, give student feedback, and
        suggest activities. AI output can be wrong, biased, or outdated. Teachers should
        review AI suggestions before using them with students. Students should not rely on
        AI feedback as authoritative — your teacher is.
      </p>
      <p>
        You are responsible for content you author with AI assistance. Don&rsquo;t use AI features
        to generate content you wouldn&rsquo;t take responsibility for.
      </p>

      <h2>6. Privacy</h2>
      <p>
        Our handling of personal data is described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>7. Service availability</h2>
      <p>
        We try to keep StudioLoom available 24/7, but we don&rsquo;t guarantee uninterrupted
        service. We may need to take the platform offline for maintenance, and we&rsquo;ll give
        notice for planned downtime where reasonably possible.
      </p>

      <h2>8. Changes to the service</h2>
      <p>
        StudioLoom is actively developed. We may add, change, or retire features. Where a
        change materially reduces functionality you depend on, we&rsquo;ll give reasonable notice
        and try to provide an export option.
      </p>

      <h2>9. Termination</h2>
      <p>
        You can stop using StudioLoom at any time and request account deletion. We may
        suspend or terminate accounts that breach these terms or that have been inactive for
        an extended period (currently 18 months — see the Privacy Policy).
      </p>

      <h2>10. Disclaimer</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we
        disclaim all warranties — including merchantability, fitness for a particular
        purpose, and non-infringement.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability arising out of or
        related to these terms or the service is limited to the amount you paid us (if any)
        in the 12 months before the event giving rise to the claim. We are not liable for
        indirect, incidental, special, or consequential damages.
      </p>
      <p>
        Nothing in these terms limits liability that cannot be limited by law (e.g.
        non-excludable consumer guarantees under the Australian Consumer Law).
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You agree to indemnify us against claims arising from your content or your breach of
        these terms, except to the extent caused by our negligence or wilful misconduct.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These terms are governed by the laws of New South Wales, Australia. Disputes will be
        resolved in the courts of New South Wales, unless local law in your jurisdiction
        requires otherwise.
      </p>

      <h2>14. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be posted to this
        page and notified to schools by email. Continued use after the update means you
        accept the new terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:hello@loominary.org">hello@loominary.org</a>.
      </p>
    </>
  );
}
