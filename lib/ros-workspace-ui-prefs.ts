import { useCallback, useMemo, useSyncExternalStore } from "react";

export type RosWorkspaceUiPrefs = {
  /** «Hva betyr tallene …» — standard åpen første gang */
  scaleReferenceOpen: boolean;
  /** «Hjelp og metode» — standard lukket første gang */
  helpMethodologyOpen: boolean;
  /** Siste valgte akse i standardreferansen */
  scaleReferenceAxis: "probability" | "consequence";
};

const DEFAULT_PREFS: RosWorkspaceUiPrefs = {
  scaleReferenceOpen: true,
  helpMethodologyOpen: false,
  scaleReferenceAxis: "probability",
};

function storageKey(workspaceId: string) {
  return `pvv:ros:workspaceUi:v1:${workspaceId}`;
}

function parsePrefs(raw: string | null): RosWorkspaceUiPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const p = JSON.parse(raw) as Partial<RosWorkspaceUiPrefs>;
    return {
      scaleReferenceOpen:
        typeof p.scaleReferenceOpen === "boolean"
          ? p.scaleReferenceOpen
          : DEFAULT_PREFS.scaleReferenceOpen,
      helpMethodologyOpen:
        typeof p.helpMethodologyOpen === "boolean"
          ? p.helpMethodologyOpen
          : DEFAULT_PREFS.helpMethodologyOpen,
      scaleReferenceAxis:
        p.scaleReferenceAxis === "consequence"
          ? "consequence"
          : DEFAULT_PREFS.scaleReferenceAxis,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Unngå nye objektreferanser når localStorage-råstreng er uendret (useSyncExternalStore). */
const snapshotCache = new Map<
  string,
  { raw: string | null; snapshot: RosWorkspaceUiPrefs }
>();

const rosPrefsListeners = new Set<() => void>();

function subscribeRosPrefs(onStoreChange: () => void) {
  rosPrefsListeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("pvv:ros:workspaceUi:v1:")) {
      if (e.key) snapshotCache.delete(e.key);
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    rosPrefsListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emitRosPrefsListeners() {
  for (const l of rosPrefsListeners) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

function getSnapshotForKey(key: string): RosWorkspaceUiPrefs {
  const raw = window.localStorage.getItem(key);
  const hit = snapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.snapshot;
  const snapshot = parsePrefs(raw);
  snapshotCache.set(key, { raw, snapshot });
  return snapshot;
}

function getServerSnapshot(): RosWorkspaceUiPrefs {
  return { ...DEFAULT_PREFS };
}

/**
 * Lagrer ROS-forside-tilstand (sammenlegg kort, akse i referanse) per arbeidsområde i nettleseren.
 */
export function useRosWorkspaceUiPrefs(workspaceId: string) {
  const key = useMemo(() => storageKey(workspaceId), [workspaceId]);

  const prefs = useSyncExternalStore(
    subscribeRosPrefs,
    () => getSnapshotForKey(key),
    getServerSnapshot,
  );

  const updatePrefs = useCallback(
    (patch: Partial<RosWorkspaceUiPrefs>) => {
      const prev = getSnapshotForKey(key);
      const next = { ...prev, ...patch };
      try {
        const raw = JSON.stringify(next);
        window.localStorage.setItem(key, raw);
        snapshotCache.set(key, { raw, snapshot: next });
      } catch {
        // kvote eller privat modus
      }
      emitRosPrefsListeners();
    },
    [key],
  );

  return { prefs, updatePrefs };
}
