import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/readiness": ["./src/content/readiness.html"],
  },
  serverExternalPackages: ["@libsql/client"],
  turbopack: {
    rules: {
      "*.md": {
        type: "raw",
      },
    },
  },
  async headers() {
    const confidential = ["/api/:path*", "/portal/:path*", "/admin/:path*", "/b2b/:path*", "/forgot-password", "/security", "/vault"];
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
  async redirects() {
    return [
      {
        // Legacy public path for the assessment 301s to the approved
        // /assessment route. Exact match only: /readiness/start and the
        // /api/readiness endpoints are untouched.
        source: "/readiness",
        destination: "/assessment",
        permanent: true,
      },
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
        {
          // CEO-approved public route: /assessment serves the existing
          // /readiness landing page without restructuring the app or its
          // verified tests. The API and start flow stay on /api/readiness
          // and /readiness/start.
          source: "/assessment",
          destination: "/readiness",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
