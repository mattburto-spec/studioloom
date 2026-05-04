import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — StudioLoom",
  description: "How StudioLoom collects, uses, and protects information.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Last updated: 1 May 2026</p>

      <p>
        StudioLoom is a learning platform for design and project-based classrooms. This
        policy explains what we collect, why, who we share it with, and the rights you
        have over your information. We try to keep it short and plain.
      </p>

      <h2>1. Who we are</h2>
      <p>
        StudioLoom (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by the StudioLoom team. You can reach us at{" "}
        <a href="mailto:hello@loominary.org">hello@loominary.org</a>.
      </p>

      <h2>2. Who uses StudioLoom</h2>
      <ul>
        <li><strong>Teachers</strong> create classes, design units, and review student work.</li>
        <li><strong>Students</strong> access StudioLoom through their school&rsquo;s class — they do not sign up directly.</li>
        <li>
          Some students are under 13. Their access is controlled by the school. We rely on the
          school to obtain any consent required under local law (e.g. COPPA in the U.S., GDPR in
          the EU/UK, the Privacy Act in Australia, PIPL in China).
        </li>
      </ul>

      <h2>3. What we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Name, email, and (for students) class code.</li>
        <li>If you sign in with Google or Microsoft, the OAuth provider tells us your name and email — nothing else.</li>
        <li>Role (teacher / student / lab tech / admin) and school affiliation.</li>
      </ul>
      <h3>Content you create</h3>
      <ul>
        <li>Units, lessons, classes, and uploaded files (e.g. STL or SVG fabrication files).</li>
        <li>Student work: text, drawings, files, peer reviews, reflections.</li>
        <li>Conversations with our AI mentor and any feedback signals (e.g. pace ratings).</li>
      </ul>
      <h3>Usage data</h3>
      <ul>
        <li>Pages visited, actions taken, time on task. Used to improve teaching analytics.</li>
        <li>Browser type and approximate location (from IP) — not stored long-term.</li>
        <li>We use <a href="https://plausible.io/data-policy" target="_blank" rel="noreferrer">Plausible Analytics</a>, which does not use cookies or collect personal data.</li>
      </ul>

      <h2>4. Why we collect it</h2>
      <ul>
        <li>To provide the platform — hosting your classes, units, and student work.</li>
        <li>To power the AI mentor with the context it needs to give relevant feedback.</li>
        <li>To give teachers visibility into student progress and wellbeing signals.</li>
        <li>To keep the platform safe (content moderation, abuse prevention).</li>
        <li>To improve the product. We do not sell data and do not use it for advertising.</li>
      </ul>

      <h2>5. AI features</h2>
      <p>
        StudioLoom uses large language models from Anthropic (Claude) and supplementary
        providers to generate lesson scaffolding and provide student mentoring. When you use
        an AI feature, the relevant context (your prompt and surrounding lesson content) is
        sent to the model provider. We have data-processing agreements with these providers
        that prohibit them from training their models on your content.
      </p>

      <h2>6. Sub-processors</h2>
      <p>We rely on the following services to operate StudioLoom:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, file storage. Hosted in Singapore.</li>
        <li><strong>Vercel</strong> — application hosting and edge delivery.</li>
        <li><strong>Anthropic</strong> — AI mentoring and lesson generation (Claude models).</li>
        <li><strong>Voyage AI</strong> — text embeddings for knowledge base search.</li>
        <li><strong>Resend</strong> — transactional email (account invites, status updates).</li>
        <li><strong>Plausible</strong> — privacy-friendly, cookie-free analytics.</li>
        <li><strong>Fly.io</strong> — fabrication file scanner workers (Preflight feature only).</li>
      </ul>
      <p>
        A current sub-processor list with data-processing details is available on request.
      </p>

      <h2>7. Where data is stored</h2>
      <p>
        Primary data is stored in Supabase&rsquo;s Singapore region. Some sub-processors (e.g.
        Anthropic, Vercel) operate from the U.S. and other regions. By using StudioLoom you
        understand that data may be transferred to and processed in countries other than
        your own. We use standard contractual clauses where required.
      </p>

      <h2>8. Your rights</h2>
      <ul>
        <li><strong>Access:</strong> request a copy of your data.</li>
        <li><strong>Correction:</strong> ask us to fix inaccurate data.</li>
        <li><strong>Deletion:</strong> ask us to delete your data. For students, the school administers this on your behalf.</li>
        <li><strong>Portability:</strong> export your content in a machine-readable format.</li>
        <li><strong>Objection / withdrawal of consent:</strong> stop a specific use of your data.</li>
      </ul>
      <p>
        Email <a href="mailto:hello@loominary.org">hello@loominary.org</a> with the subject line &ldquo;Privacy request&rdquo;.
        We respond within 30 days.
      </p>

      <h2>9. Retention</h2>
      <ul>
        <li>Active account content: kept for as long as the school maintains the account.</li>
        <li>Inactive accounts (no sign-in for 18 months): pruned after notice to the school.</li>
        <li>Audit logs (security): kept for 12 months.</li>
        <li>AI conversation logs: kept for 12 months for safety and quality review.</li>
      </ul>

      <h2>10. Children&rsquo;s data</h2>
      <p>
        StudioLoom is designed for school use. We do not knowingly collect data from children
        outside of an authorised school relationship. Schools determine which students access
        the platform and obtain any parental consent required by local law.
      </p>

      <h2>11. Security</h2>
      <p>
        Data is encrypted in transit (TLS) and at rest. Access to production systems is
        restricted, audited, and protected by multi-factor authentication. We notify affected
        schools without undue delay if we become aware of a breach affecting their data.
      </p>

      <h2>12. Cookies</h2>
      <p>
        We use only essential cookies needed to keep you signed in. We do not use advertising
        or tracking cookies. Plausible Analytics is cookie-free.
      </p>

      <h2>13. Changes</h2>
      <p>
        We will post material changes to this page and update the &ldquo;last updated&rdquo; date. For
        significant changes affecting student data, we will also notify schools by email.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions or requests: <a href="mailto:hello@loominary.org">hello@loominary.org</a>.
      </p>
    </>
  );
}
