import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for Docker and other Node hosts.
  // Vercel uses its own Next.js runtime and does not need this output.
  output: "standalone",
};

export default nextConfig;
