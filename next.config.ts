import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Keep Express endpoints behind a dedicated prefix. A generic /api/* rewrite
    // would intercept dynamic Next.js routes for stories and breakout rooms.
    return [{
      source: "/api/backend/:path*",
      destination: `${process.env.STORY_API_URL || "http://127.0.0.1:4000"}/:path*`,
    }];
  },
};
export default nextConfig;
