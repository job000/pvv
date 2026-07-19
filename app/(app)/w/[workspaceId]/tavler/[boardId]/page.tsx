"use client";

import {
  ProductLoadingBlock,
  ProductStack,
} from "@/components/product";
import { PulsBoardPage } from "@/components/workspace/puls-board-page";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

export default function WorkspacePulsBoardPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
  const boardId = params.boardId as Id<"pulsBoards">;
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
      <PulsBoardPage workspaceId={workspaceId} boardId={boardId} />
    </ProductStack>
  );
}
