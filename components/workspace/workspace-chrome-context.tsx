"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type WorkspaceChromeValue = {
  sidebarCollapsed: boolean;
  mobileOpen: boolean;
  workspaceName: string;
  hasWorkspace: boolean;
  toggleMenu: () => void;
  setMobileOpen: (open: boolean) => void;
  syncWorkspace: (name: string, active: boolean) => void;
};

const WorkspaceChromeContext = createContext<WorkspaceChromeValue | null>(
  null,
);

export function WorkspaceChromeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [hasWorkspace, setHasWorkspace] = useState(false);

  const toggleMenu = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      setSidebarCollapsed((c) => !c);
    } else {
      setMobileOpen((o) => !o);
    }
  }, []);

  const syncWorkspace = useCallback((name: string, active: boolean) => {
    setWorkspaceName(name);
    setHasWorkspace(active);
    if (!active) {
      setSidebarCollapsed(false);
      setMobileOpen(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      mobileOpen,
      workspaceName,
      hasWorkspace,
      toggleMenu,
      setMobileOpen,
      syncWorkspace,
    }),
    [
      sidebarCollapsed,
      mobileOpen,
      workspaceName,
      hasWorkspace,
      toggleMenu,
      syncWorkspace,
    ],
  );

  return (
    <WorkspaceChromeContext.Provider value={value}>
      {children}
    </WorkspaceChromeContext.Provider>
  );
}

export function useWorkspaceChrome(): WorkspaceChromeValue {
  const ctx = useContext(WorkspaceChromeContext);
  if (!ctx) {
    throw new Error("useWorkspaceChrome must be used within WorkspaceChromeProvider");
  }
  return ctx;
}

export function useWorkspaceChromeOptional(): WorkspaceChromeValue | null {
  return useContext(WorkspaceChromeContext);
}
