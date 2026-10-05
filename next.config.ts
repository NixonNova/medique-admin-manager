import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for Docker and other Node hosts.
  // Vercel uses its own Next.js runtime and does not need this output.
  output: "standalone",
  serverExternalPackages: ["better-auth"],
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
