"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Når brukeren har valgt «standard arbeidsområde» som startsted og åpner /dashboard
 * uten ?oversikt=1, sendes de til /w/[id]. Lenker med ?oversikt=1 viser alltid oversikten.
 */
export function DashboardEntryRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useQuery(api.workspaces.getMySettings);
  const didRedirect = useRef(false);

  useEffect(() => {
    if (settings === undefined || settings === null || didRedirect.current)
      return;
    if (searchParams.get("oversikt") === "1") return;
    if (settings.appEntryPreference !== "workspace") return;
    const wid = settings.defaultWorkspaceId;
    if (!wid) return;
    didRedirect.current = true;
    router.replace(`/w/${wid}`);
  }, [settings, searchParams, router]);

  return null;
}
