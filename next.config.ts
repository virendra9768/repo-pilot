import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the bundled demo repos and the seeded AI cache are included in the
  // serverless function bundles (they're read at runtime via process.cwd()).
  outputFileTracingIncludes: {
    "/api/**": ["./demo-repos/**", "./cache-seed/**"],
    "/r/**": ["./demo-repos/**", "./cache-seed/**"],
  },
};

export default nextConfig;
