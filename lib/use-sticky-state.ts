import { useCallback, useState } from "react";

const store = new Map<string, unknown>();

/**
 * Like useState but the value survives component unmount/remount within the
 * same browser session (stored in a module-level Map, not persisted to disk).
 */
export function useStickyState<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(
    () => (store.get(key) as T | undefined) ?? defaultValue,
  );
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueRaw((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        store.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, setValue];
}
