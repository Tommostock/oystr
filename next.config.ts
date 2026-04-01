/**
 * next.config.ts — Next.js configuration
 *
 * Includes security headers to protect the app from common
 * web vulnerabilities like clickjacking, MIME sniffing, and XSS.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /* Apply security headers to all routes */
        source: "/(.*)",
        headers: [
          {
            /* Prevent the app from being embedded in iframes on other sites */
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            /* Stop browsers from guessing file types — use the declared type */
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            /* Only send the origin (not the full URL) when navigating away */
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            /* Disable browser features the app doesn't need */
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
