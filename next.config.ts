import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const testControlEnabled = process.env.ENABLE_TEST_CONTROL === "true";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    // Keep test-control / simulator UI out of production traffic even if routes exist.
    if (isProd && !testControlEnabled) {
      return [
        {
          source: "/api/test-control/:path*",
          destination: "/api/health/live",
          permanent: false,
        },
        {
          source: "/simulator",
          destination: "/dashboard",
          permanent: false,
        },
        {
          source: "/api/simulator/:path*",
          destination: "/api/health/live",
          permanent: false,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
