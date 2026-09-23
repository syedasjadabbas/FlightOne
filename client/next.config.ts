import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  // No API rewrite: the client calls Express by absolute URL via
  // NEXT_PUBLIC_API_URL (see lib/api/baseApi.ts), same as crm-client. The old
  // hardcoded localhost:8084 proxy resolved to the serverless function itself
  // on Vercel, so anything routed through it failed in production.
};

export default nextConfig;
