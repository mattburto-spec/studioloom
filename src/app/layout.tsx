import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import AuthHashForwarder from "@/components/auth/AuthHashForwarder";

export const metadata: Metadata = {
  title: "StudioLoom — Design Process Platform",
  description: "A guided design process platform for design students and teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Catches Supabase auth hash fragments that land on any page and
            forwards them to /auth/callback for completion. */}
        <AuthHashForwarder />
        {children}
        {/* Vercel Web Analytics (page views, visitors, top routes) +
            Speed Insights (Core Web Vitals per route). Privacy-first,
            no cookies, included on Pro. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
