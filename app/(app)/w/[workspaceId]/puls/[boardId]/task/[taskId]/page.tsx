"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Gammel URL — omdirigerer til /tavler/[boardId]/task/[taskId] */
export default function WorkspacePulsTaskRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const boardId = params.boardId as string;
  const taskId = params.taskId as string;

  useEffect(() => {
    router.replace(
      `/w/${workspaceId}/tavler/${boardId}/task/${encodeURIComponent(taskId)}`,
    );
  }, [boardId, router, taskId, workspaceId]);

  return (
    <p className="text-muted-foreground text-sm">Flytter til Tavler …</p>
  );
}
