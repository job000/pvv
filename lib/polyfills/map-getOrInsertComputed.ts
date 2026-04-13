/**
 * pdfjs-dist 5.6+ kaller `Map.prototype.getOrInsertComputed` (TC39, ikke i alle nettlesere ennå).
 * Uten dette: «this[#fr].getOrInsertComputed is not a function» i Safari / eldre WebKit.
 * Må kjøre før `react-pdf` / `pdfjs-dist` evalueres på hovedtråden.
 */
function patchMap(): void {
  const proto = Map.prototype as Map<unknown, unknown> & {
    getOrInsertComputed?: (
      key: unknown,
      cb: (key: unknown, m: Map<unknown, unknown>) => unknown,
    ) => unknown;
  };
  if (typeof proto.getOrInsertComputed === "function") return;
  const impl = function getOrInsertComputed(
    this: Map<unknown, unknown>,
    key: unknown,
    callbackfn: (key: unknown, map: Map<unknown, unknown>) => unknown,
  ): unknown {
    if (typeof callbackfn !== "function") {
      throw new TypeError("callback is not a function");
    }
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key, this);
    this.set(key, value);
    return value;
  };
  try {
    Object.defineProperty(proto, "getOrInsertComputed", {
      value: impl,
      configurable: true,
      writable: true,
    });
  } catch {
    proto.getOrInsertComputed = impl;
  }
}

function patchWeakMap(): void {
  const proto = WeakMap.prototype as WeakMap<object, unknown> & {
    getOrInsertComputed?: (
      key: object,
      cb: (key: object, m: WeakMap<object, unknown>) => unknown,
    ) => unknown;
  };
  if (typeof proto.getOrInsertComputed === "function") return;
  const impl = function getOrInsertComputed(
    this: WeakMap<object, unknown>,
    key: object,
    callbackfn: (key: object, map: WeakMap<object, unknown>) => unknown,
  ): unknown {
    if (typeof callbackfn !== "function") {
      throw new TypeError("callback is not a function");
    }
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key, this);
    this.set(key, value);
    return value;
  };
  try {
    Object.defineProperty(proto, "getOrInsertComputed", {
      value: impl,
      configurable: true,
      writable: true,
    });
  } catch {
    proto.getOrInsertComputed = impl;
  }
}

export function ensureMapGetOrInsertComputedPolyfill(): void {
  if (typeof Map === "undefined" || typeof WeakMap === "undefined") return;
  patchMap();
  patchWeakMap();
}

ensureMapGetOrInsertComputedPolyfill();
