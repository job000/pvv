import { AppShell } from "@/components/app-shell";
import { WorkspaceChromeProvider } from "@/components/workspace/workspace-chrome-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceChromeProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceChromeProvider>
  );
}
