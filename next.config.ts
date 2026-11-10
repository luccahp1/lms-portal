import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for running under systemd on the home server.
  output: "standalone",
  poweredByHeader: false,
  // The review frame (/site/<token>/...) mirrors a client's site, where /services/ and /services
  // are different addresses: relative links on the page depend on the slash. Leave it alone.
  skipTrailingSlashRedirect: true,
  experimental: {
    // File uploads go through server actions; keep in step with MAX_UPLOAD_BYTES (25 MB).
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
