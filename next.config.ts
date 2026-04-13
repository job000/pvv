import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolutt prosjektrot — unngår at bundler velger feil rot (f.eks. foreldermappe PVV). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.join(projectRoot, "node_modules");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@tldraw/tldraw",
    "tldraw",
    "@tldraw/editor",
    "@tldraw/store",
    "react-pdf",
  ],
  /** Reduser XSS-/clickjacking-risiko på offentlige skjemasider (/f/…). */
  async headers() {
    return [
      {
        source: "/f/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: projectRoot,
    /** Lås CSS/PostCSS-moduler til denne appens node_modules (ingen symlink i foreldermappe). */
    resolveAlias: {
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "tw-animate-css": path.join(nodeModules, "tw-animate-css"),
      shadcn: path.join(nodeModules, "shadcn"),
    },
  },
  /**
   * Kun `resolve.alias` — ikke overstyr `resolve.modules`. Å sette `modules` først til
   * prosjektets `node_modules` kan bryte Next.js sin webpack-kjede for CSS
   * (mini-css-extract-plugin: «You forgot to add MiniCssExtractPlugin»).
   */
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      /** Én `convex`-instans — hindrer duplikat React-kontekst og «Could not find Convex client». */
      convex: path.join(nodeModules, "convex"),
      /**
       * `pdf.mjs` er allerede en Webpack-bundle fra Mozilla — å parse den på nytt i Next
       * gir «Object.defineProperty called on non-object». `pdf.min.mjs` er én flat ESM-fil.
       */
      "pdfjs-dist": path.join(nodeModules, "pdfjs-dist/build/pdf.min.mjs"),
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "tw-animate-css": path.join(nodeModules, "tw-animate-css"),
      shadcn: path.join(nodeModules, "shadcn"),
    };

    return config;
  },
};

export default nextConfig;
