import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages. The API lives in functions/ (Pages Functions).
  output: "export",
  images: { unoptimized: true },
  // In development, `npm run dev:api` serves the Pages Functions on 8788.
  ...(isDev && {
    async rewrites() {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:8788/api/:path*" }];
    },
  }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
