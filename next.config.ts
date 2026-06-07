import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Production performance optimizations
  compress: true,
  poweredByHeader: false,

  // Image optimization — ensure WebP/AVIF support
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Cache-Control for static assets (1 year)
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);