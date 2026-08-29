import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.ENABLE_VENUE_PREVIEW === "true"
      ? ".next-venue-preview"
      : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@elder-tree/contracts"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
