import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PVV — Prosess og personvern",
    short_name: "PVV",
    description:
      "PVV-vurderinger, prosessregister, ROS og leveranse — samarbeid i arbeidsområder.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "any",
    background_color: "#fafafa",
    theme_color: "#171717",
    categories: ["productivity", "business"],
    lang: "nb",
    dir: "ltr",
    icons: [
      {
        src: "/icons/pvv.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/pvv.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
