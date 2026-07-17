import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ts-morph ships its own copy of TypeScript (~14 MB). Leave it to Node's
  // require at runtime rather than having the bundler trace and inline it.
  serverExternalPackages: ["ts-morph"],
  // Ensure the bundled demo repos and the seeded AI cache are included in the
  // serverless function bundles (they're read at runtime via process.cwd()).
  outputFileTracingIncludes: {
    "/api/**": ["./demo-repos/**", "./cache-seed/**"],
    "/r/**": ["./demo-repos/**", "./cache-seed/**"],
  },
};

export default nextConfig;
