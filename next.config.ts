import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.STORY_API_URL || "http://127.0.0.1:4000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
