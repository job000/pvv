"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Gammel URL — omdirigerer til /puls */
export default function WorkspaceSakerRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  useEffect(() => {
    const task = searchParams.get("task");
    const qs = task ? `?task=${encodeURIComponent(task)}` : "";
    router.replace(`/w/${workspaceId}/puls${qs}`);
  }, [router, searchParams, workspaceId]);

  return (
    <p className="text-muted-foreground text-sm">Flytter til Puls …</p>
  );
}
