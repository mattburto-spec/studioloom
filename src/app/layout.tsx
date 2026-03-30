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
        <script async src="https://plausible.io/js/pa-zQXWAmLhvFxtvFofMXkEb.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
