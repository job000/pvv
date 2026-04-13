#!/usr/bin/env node
/**
 * Kopierer PDF.js worker til public/ etter npm install (matcher pdfjs-dist-versjonen).
 * pdfjs 5.6+ bruker Map.prototype.getOrInsertComputed i worker-konteksten også — injiserer
 * polyfill rett etter lisenskommentar (før resten av bundelen), ellers feiler forhåndsvisning
 * mens «åpne i ny fane» (native PDF) fungerer.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.join(root, "public/pdfjs");
const dest = path.join(destDir, "pdf.worker.min.mjs");

/** Må matche starten av minifisert worker etter pdfjsBuild-kommentar (verifiser ved oppgradering). */
const WORKER_CODE_START = "*/const e=";

const WORKER_POLYFILL = `(function(){function p(C){if(typeof C==="undefined"||!C.prototype)return;var o=C.prototype;if(typeof o.getOrInsertComputed==="function")return;var f=function(k,cb){if(typeof cb!=="function")throw new TypeError("callback is not a function");if(this.has(k))return this.get(k);var v=cb(k,this);this.set(k,v);return v;};try{Object.defineProperty(o,"getOrInsertComputed",{value:f,configurable:!0,writable:!0});}catch(e){o.getOrInsertComputed=f;}}p(typeof Map!=="undefined"?Map:void 0);p(typeof WeakMap!=="undefined"?WeakMap:void 0);})();`;

if (!fs.existsSync(src)) {
  console.warn("[copy-pdfjs-worker] Fant ikke pdfjs-dist (hoppes over før install).");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
const raw = fs.readFileSync(src, "utf8");
const anchor = raw.indexOf(WORKER_CODE_START);
let out;
if (anchor === -1) {
  console.warn(
    "[copy-pdfjs-worker] Fant ikke forventet startmønster i pdf.worker.min.mjs — kopierer uten polyfill.",
  );
  out = raw;
} else {
  const insertAt = anchor + 2;
  out = raw.slice(0, insertAt) + WORKER_POLYFILL + raw.slice(insertAt);
}
fs.writeFileSync(dest, out, "utf8");
