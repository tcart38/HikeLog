import type { NextConfig } from "next"

// Extra hostnames (comma separated) for the dev server, e.g. when testing via
// hike.example.com or a tunnel. Production needs no host config at all.
const devOrigins = (process.env.ALLOWED_DEV_ORIGINS || process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/^https?:\/\//, "").replace(/[:/].*$/, ""))
  .filter(Boolean)

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.local", "*.lan", ...devOrigins],
  // Seed lists are read from disk at runtime; ship them with the server bundle.
  outputFileTracingIncludes: { "/**": ["./data/lists/**/*", "./data/networks/**/*"] },
  poweredByHeader: false,
  async headers() {
    return [
      // The service worker must always be revalidated so updates roll out; scope stays "/".
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ]
  },
}

export default nextConfig
