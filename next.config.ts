import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  turbopack: {
    rules: {
      "*.md": {
        type: "raw",
      },
    },
  },
  async rewrites() {
    return {
      // /b2b/* maps onto the existing /portal/* routes so the client
      // workspace is reachable at pkservices.business/b2b without
      // restructuring the app. The proxy (src/proxy.ts) still protects
      // the underlying /portal paths.
      beforeFiles: [],
      afterFiles: [
        {
          source: "/b2b",
          destination: "/portal/dashboard",
        },
        {
          source: "/b2b/:path*",
          destination: "/portal/:path*",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
