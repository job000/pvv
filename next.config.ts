import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolutt prosjektrot — unngår at Turbopack velger feil rot når det finnes lockfile høyere i mappestrukturen (f.eks. hjemmemappe). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
