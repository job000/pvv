import { useCallback, useState } from "react";

const memoryStore = new Map<string, unknown>();
const LS_PREFIX = "pvv-sticky:";

function readStored<T>(key: string, defaultValue: T): T {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      if (raw != null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      /* ignore corrupt storage */
    }
  }
  if (memoryStore.has(key)) {
    return memoryStore.get(key) as T;
  }
  return defaultValue;
}

function writeStored<T>(key: string, value: T) {
  memoryStore.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Like useState, but remembers the value across remounts and page reloads
 * (module Map + localStorage).
 */
export function useStickyState<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() =>
    readStored(key, defaultValue),
  );
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStored(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, setValue];
}
