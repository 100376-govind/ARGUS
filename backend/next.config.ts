import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker: produces a self-contained build in .next/standalone
  output: "standalone",

  // This is an API-only backend; no pages are rendered.
  // Disable image optimization (API-only, no frontend images).
  images: {
    unoptimized: true,
  },

  // Expose headers for CORS preflight and API versioning.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.FRONTEND_URL || "http://localhost:3000" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Changed-By, X-Request-ID" },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  // Rewrite health endpoint for Kubernetes / load balancer probes
  async rewrites() {
    return [
      {
        source: "/healthz",
        destination: "/api/health",
      },
      {
        source: "/readyz",
        destination: "/api/health",
      },
    ];
  },

  // Strict mode
  reactStrictMode: true,

  // Server-side only packages (not bundled for client)
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "@prisma/client",
    "firebase-admin",
    "ioredis",
    "socket.io",
  ],
};

export default nextConfig;
