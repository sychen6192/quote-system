import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Lets parallel local builds (e.g. agents, CI matrix) use separate output dirs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default withNextIntl(nextConfig);
