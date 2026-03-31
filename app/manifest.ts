import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FRO — prioriter og utfør",
    short_name: "FRO",
    description:
      "Prioriter oppgaver, prosessvurderinger, ROS og leveranse — samarbeid i arbeidsområder.",
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
        src: "/icons/fro-mark.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/fro-mark.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
