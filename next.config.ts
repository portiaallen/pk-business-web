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
  async headers() {
    const confidential = ["/api/:path*", "/portal/:path*", "/admin/:path*", "/b2b/:path*", "/forgot-password"];
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
      ] },
      ...confidential.map((source) => ({ source, headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ] })),
    ];
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
