"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Gammel URL — omdirigerer til /puls */
export default function WorkspacePortefoljeRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  useEffect(() => {
    router.replace(`/w/${workspaceId}/puls`);
  }, [router, workspaceId]);

  return (
    <p className="text-muted-foreground text-sm">Flytter til Puls …</p>
  );
}
