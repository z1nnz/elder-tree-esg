import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
