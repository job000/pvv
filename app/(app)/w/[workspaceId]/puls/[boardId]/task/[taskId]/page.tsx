"use client";

import {
  ProductLoadingBlock,
  ProductStack,
} from "@/components/product";
import { IssuesProjectBoard } from "@/components/workspace/issues-project-board";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

export default function PulsTaskPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const boardId = params.boardId as Id<"pulsBoards">;
  const taskId = params.taskId as Id<"assessmentTasks">;
  const workspace = useQuery(api.workspaces.get, { workspaceId });

  if (workspace === undefined) {
    return (
      <ProductLoadingBlock label="Laster …" className="min-h-[30vh]" />
    );
  }

  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  return (
    <ProductStack className="max-w-none space-y-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-0">
      <IssuesProjectBoard
        workspaceId={workspaceId}
        boardId={boardId}
        focusTaskId={taskId}
        detailPresentation="page"
      />
    </ProductStack>
  );
}
