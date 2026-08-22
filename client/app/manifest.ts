import type { MetadataRoute } from "next";

// Dev and production must resolve as distinct installable apps — different
// `id`/name/icons — so installing one never overwrites or gets confused
// with the other on a device that has both (e.g. testing dev over a LAN IP
// alongside the already-installed production app on the same phone).
const isDev = process.env.NODE_ENV !== "production";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: isDev ? "/?pwa=dev" : "/?pwa=prod",
    name: isDev ? "Life Plan (Dev)" : "Life Plan",
    short_name: isDev ? "Life Plan Dev" : "Life Plan",
    description: "Life Plan Application",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#2563eb",
    icons: isDev
      ? [
          { src: "/icon-192-dev.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512-dev.png", sizes: "512x512", type: "image/png" },
        ]
      : [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
  };
}
