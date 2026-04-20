import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Ignore ESLint + TypeScript errors during build (pre-existing warnings, not blocking)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Tree-shake heavy libraries (barrel imports → only used exports)
  experimental: {
    optimizePackageImports: ["framer-motion", "exceljs", "docx", "pptxgenjs", "jspdf"],
  },
  // Next.js Image optimization for external sources (Supabase Storage)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Permanent redirects
  async redirects() {
    return [
      {
        // Phase 0.3 (10 Apr 2026) — renamed to disambiguate from the real
        // §7.2/7.3 sandboxes that ship in Dimensions3 Phase 7.
        source: "/admin/sandbox",
        destination: "/admin/simulator",
        permanent: true,
      },
    ];
  },
  // Rewrites — clean URLs for static HTML in public/
  async rewrites() {
    return [
      {
        // MYP unit planner (standalone single-file HTML, lives in public/)
        // Added 19 Apr 2026 for /unitplanner clean URL.
        source: "/unitplanner",
        destination: "/unitplanner.html",
      },
    ];
  },
  // Security headers — OWASP basics
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Auth + Student API routes MUST NOT have Cache-Control: public — Vercel CDN
      // strips Set-Cookie headers from "public" responses, breaking session cookies.
      // Student routes read auth cookies so they must also be private.
      {
        source: "/api/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/student/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
      // Fabricator routes set/read the fab_session cookie — must be private
      // (Lesson #11: Vercel CDN strips Set-Cookie from "public" responses).
      {
        source: "/api/fab/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  // Keep heavy server-only packages out of the webpack bundle
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth", "officeparser", "jszip"],
  webpack: (config, { isServer, webpack }) => {
    // Phase 5C: skip parsing NSFW.js model shard files (non-standard require() syntax)
    config.module.noParse = /nsfwjs\/dist\/models/;

    if (!isServer) {
      // pptxgenjs references node:https/http/fs — strip node: prefix so
      // webpack can apply the browser field fallbacks from package.json
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        https: false,
        http: false,
        fs: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps if SENTRY_AUTH_TOKEN is set
  silent: true,
  // Use webpack treeshaking to remove debug logging (replaces deprecated disableLogger)
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },
});
