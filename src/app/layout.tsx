import type { Metadata } from "next";
import "./globals.css";

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
      <head>
        {/* Plausible Analytics — privacy-friendly, no cookies, COPPA/GDPR safe */}
        <script defer src="https://plausible.io/js/pa-zQXWAmLhvFxtvFofMXkEb.js" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
