"use client";

import {
  ProductLoadingBlock,
  ProductPageHeader,
  ProductStack,
} from "@/components/product";
import { WorkspaceTasksPanel } from "@/components/workspace/workspace-tasks-panel";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

export default function WorkspaceTasksPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;
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
    <ProductStack className="pb-12">
      <ProductPageHeader
        title="Oppgaver"
        description="Åpne en oppgave for forhåndsvisning, fullfør i dialogen, eller gå direkte til ROS/vurdering. Se også hva du har tildelt andre."
      />
      <WorkspaceTasksPanel workspaceId={workspaceId} />
    </ProductStack>
  );
}
