import type { NextConfig } from "next";
import path from "node:path";

const rootSrc = path.join(__dirname, "../../src");

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
    resolveAlias: {
      "@/server": path.join(rootSrc, "server"),
      "@/generated": path.join(rootSrc, "generated"),
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    Object.assign(config.resolve.alias, {
      "@/server": path.join(rootSrc, "server"),
      "@/generated": path.join(rootSrc, "generated"),
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
