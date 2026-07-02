import type { NextConfig } from "next";

// Static export is opt in via STATIC_EXPORT=1 so it only kicks in for the GitHub Pages build.
// Local `next dev` and a normal `next build` are unaffected.
const staticExport = process.env.STATIC_EXPORT === "1";
// GitHub project pages serve under /<repo>, so the Pages build sets PAGES_BASE_PATH=/arclight.
// Left empty locally so dev keeps serving from the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  // Serve the static marketing landing page (public/home.html) at the root. The demo dashboard
  // lives at /demo. Rewrites aren't supported by `output: "export"`, so only wire this up for the
  // normal (Vercel) build; the GitHub Pages static export doesn't need it.
  ...(staticExport
    ? {}
    : {
        async rewrites() {
          return [{ source: "/", destination: "/home.html" }];
        },
      }),
};

export default nextConfig;
