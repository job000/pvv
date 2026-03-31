import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { Id } from "@/convex/_generated/dataModel";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <WorkspaceShell workspaceId={workspaceId as Id<"workspaces">}>
      {children}
    </WorkspaceShell>
  );
}
