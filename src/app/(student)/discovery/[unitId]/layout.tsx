/**
 * Discovery Engine — Immersive Layout
 *
 * No standard nav header. Full-screen experience.
 * Only shows a minimal exit button and progress indicator.
 * The student layout wraps this, but we override its header visibility
 * via the DiscoveryShell component.
 */
export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
