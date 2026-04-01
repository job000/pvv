import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolutt prosjektrot — unngår at bundler velger feil rot (f.eks. foreldermappe PVV). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.join(projectRoot, "node_modules");

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    /** Lås CSS/PostCSS-moduler til denne appens node_modules (ingen symlink i foreldermappe). */
    resolveAlias: {
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "tw-animate-css": path.join(nodeModules, "tw-animate-css"),
      shadcn: path.join(nodeModules, "shadcn"),
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [nodeModules, ...(config.resolve.modules ?? ["node_modules"])];
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "tw-animate-css": path.join(nodeModules, "tw-animate-css"),
      shadcn: path.join(nodeModules, "shadcn"),
    };
    return config;
  },
};

export default nextConfig;
