"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Gammel URL — omdirigerer til /tavler/[boardId] */
export default function WorkspacePulsBoardRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const boardId = params.boardId as string;

  useEffect(() => {
    const qs = searchParams.toString();
    const suffix = qs ? `?${qs}` : "";
    router.replace(`/w/${workspaceId}/tavler/${boardId}${suffix}`);
  }, [boardId, router, searchParams, workspaceId]);

  return (
    <p className="text-muted-foreground text-sm">Flytter til Tavler …</p>
  );
}
