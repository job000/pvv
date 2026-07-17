"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/**
 * Synkroniserer lagret tema/tetthet fra Convex til DOM og next-themes etter innlogging.
 * Skriver kun når lagret preferanse faktisk endres — overskriver ikke lokale
 * valg på innloggingssiden mens profilen fortsatt er «system».
 */
export function UserPreferencesSync() {
  const profile = useQuery(api.users.getMyProfile);
  const { setTheme } = useTheme();
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    // Utlogget / ikke lastet: ikke rør tema (la next-themes / lokal meny styre).
    if (profile === undefined || profile === null) {
      lastApplied.current = null;
      return;
    }
    const t = profile.settings?.themePreference;
    if (t === undefined || t === null) return;
    if (lastApplied.current === t) return;
    lastApplied.current = t;
    setTheme(t);
  }, [profile, setTheme]);

  useEffect(() => {
    if (profile === undefined || profile === null) {
      document.documentElement.removeAttribute("data-ui-density");
      return;
    }
    const d = profile.settings?.uiDensity ?? "comfortable";
    document.documentElement.setAttribute("data-ui-density", d);
  }, [profile]);

  return null;
}
