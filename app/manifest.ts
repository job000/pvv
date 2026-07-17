import { PRODUCT_NAME, PRODUCT_TITLE } from "@/lib/brand";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PRODUCT_TITLE,
    short_name: PRODUCT_NAME,
    description:
      "Prioriter oppgaver, prosessvurderinger og ROS — samarbeid i arbeidsområder.",
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
        src: "/icons/zorlin-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/zorlin-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/zorlin-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
