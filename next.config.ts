import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Keep heavy server-only packages out of the webpack bundle
  serverExternalPackages: ["pdf-parse", "mammoth", "officeparser", "jszip"],
  webpack: (config, { isServer, webpack }) => {
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
