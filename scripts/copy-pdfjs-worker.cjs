#!/usr/bin/env node
/** Kopierer PDF.js worker til public/ etter npm install (matcher pdfjs-dist-versjonen i node_modules). */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.join(root, "public/pdfjs");
const dest = path.join(destDir, "pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("[copy-pdfjs-worker] Fant ikke pdfjs-dist (hoppes over før install).");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
