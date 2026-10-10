import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // A private business tool: keep every response (PDFs and CSVs included,
  // which carry no <meta name="robots">) out of search engines.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Lets parallel local builds (e.g. agents, CI matrix) use separate output dirs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@react-pdf/renderer"],
  poweredByHeader: false,
  // Branding uploads are capped at 1 MiB; leave headroom for multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // No image optimisation: lets the standalone output drop sharp + libvips.
  images: { unoptimized: true },
  // Keys are route globs (picomatch, `contains`); values are globs from the
  // project root. "*" matches every route and also the server-level trace.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/typescript/**", // build-time only (next.config.ts)
      "node_modules/sharp/**",
      "node_modules/@img/**",
    ],
  },
  // Read at runtime via process.cwd() paths the tracer cannot always follow:
  // migrations (lib/db/migrate.ts, run from instrumentation) and PDF fonts.
  outputFileTracingIncludes: {
    "*": ["./drizzle/**/*", "./assets/fonts/**/*", "./branding-defaults/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
