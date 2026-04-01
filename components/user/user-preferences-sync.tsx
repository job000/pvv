"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Synkroniserer lagret tema/tetthet fra Convex til DOM og next-themes etter innlogging.
 */
export function UserPreferencesSync() {
  const profile = useQuery(api.users.getMyProfile);
  const { setTheme } = useTheme();

  useEffect(() => {
    const t = profile?.settings?.themePreference;
    if (t === undefined || t === null) return;
    setTheme(t);
  }, [profile?.settings?.themePreference, setTheme]);

  useEffect(() => {
    const d = profile?.settings?.uiDensity ?? "comfortable";
    document.documentElement.setAttribute("data-ui-density", d);
  }, [profile?.settings?.uiDensity]);

  return null;
}
