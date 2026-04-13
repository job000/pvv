/**
 * pdfjs-dist 5.6+ bruker Map/WeakMap.getOrInsertComputed (mangler i Safari/WebKit før støtte).
 * Lastes via next/script strategy=beforeInteractive i rot-layout — før webpack-chunks.
 * Samme innhold injiseres i pdf.worker.min.mjs av scripts/copy-pdfjs-worker.cjs.
 */
(function () {
  function patch(Ctor) {
    if (typeof Ctor === "undefined" || !Ctor.prototype) return;
    var proto = Ctor.prototype;
    if (typeof proto.getOrInsertComputed === "function") return;
    function impl(key, cb) {
      if (typeof cb !== "function") {
        throw new TypeError("callback is not a function");
      }
      if (this.has(key)) return this.get(key);
      var v = cb(key, this);
      this.set(key, v);
      return v;
    }
    try {
      Object.defineProperty(proto, "getOrInsertComputed", {
        value: impl,
        configurable: true,
        writable: true,
      });
    } catch (e) {
      proto.getOrInsertComputed = impl;
    }
  }
  patch(typeof Map !== "undefined" ? Map : undefined);
  patch(typeof WeakMap !== "undefined" ? WeakMap : undefined);
})();
