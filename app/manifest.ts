import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HikeLog",
    short_name: "HikeLog",
    description: "Log hikes once. Track every peak list, season and person.",
    // Relative URLs: the app works on whatever domain it is served from.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#15803d",
    categories: ["sports", "lifestyle", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [{ name: "Log a hike", short_name: "Log", url: "/hikes/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] }],
  }
}
