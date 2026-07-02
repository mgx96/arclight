import type { NextConfig } from "next";

// Static export is opt in via STATIC_EXPORT=1 so it only kicks in for the GitHub Pages build.
// Local `next dev` and a normal `next build` are unaffected.
const staticExport = process.env.STATIC_EXPORT === "1";
// GitHub project pages serve under /<repo>, so the Pages build sets PAGES_BASE_PATH=/arclight.
// Left empty locally so dev keeps serving from the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";
// Origin of the deployed backend (attestor + Gateway agent). The frontend never calls this cross
// origin from the browser — it calls the same-origin path /api/backend/* and this rewrite proxies
// it server side. Going same-origin sidesteps browser ad/privacy blockers (which block third-party
// requests to hosts like *.onrender.com with ERR_BLOCKED_BY_CLIENT) and removes the need for CORS.
// Override via BACKEND_ORIGIN at build time if the backend URL changes.
const backendOrigin = process.env.BACKEND_ORIGIN ?? "https://arclight-backend.onrender.com";
// Same rationale for the Arc JSON-RPC endpoint: the UI reads the on-chain attestor directly, and a
// cross-origin call to rpc.testnet.arc.network can be blocked by the same extensions. Proxy it too.
const rpcOrigin = process.env.RPC_ORIGIN ?? "https://rpc.testnet.arc.network";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // trailingSlash is only needed for the GitHub Pages static export (so /demo/ resolves as a
  // directory with its own index.html). On the normal Vercel build it must stay off, otherwise the
  // automatic /path -> /path/ redirect fires before rewrites and breaks the same-origin API proxies
  // below (especially POST to /api/rpc and /api/backend/*).
  ...(staticExport ? { trailingSlash: true } : {}),
  images: { unoptimized: true },
  // Serve the static marketing landing page (public/home.html) at the root. The demo dashboard
  // lives at /demo. Rewrites aren't supported by `output: "export"`, so only wire this up for the
  // normal (Vercel) build; the GitHub Pages static export doesn't need it.
  ...(staticExport
    ? {}
    : {
        async rewrites() {
          return [
            { source: "/", destination: "/home.html" },
            // Same-origin proxy to the backend so browser ad/privacy blockers can't block the calls.
            { source: "/api/backend/:path*", destination: `${backendOrigin}/:path*` },
            // Same-origin proxy to the Arc JSON-RPC endpoint (used for the on-chain attestor read).
            // Uses :path* so it still matches after trailingSlash rewrites /api/rpc -> /api/rpc/.
            { source: "/api/rpc/:path*", destination: `${rpcOrigin}/:path*` },
          ];
        },
      }),
};

export default nextConfig;
