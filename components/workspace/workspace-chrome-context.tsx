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
  /** Dashboard / innstillinger / superadmin — menyknapp i toppbar */
  hasDashboardNav: boolean;
  dashboardTitle: string;
  toggleMenu: () => void;
  setMobileOpen: (open: boolean) => void;
  syncWorkspace: (name: string, active: boolean) => void;
  syncDashboardNav: (active: boolean, title?: string) => void;
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
  const [hasDashboardNav, setHasDashboardNav] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState("Oversikt");

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

  const syncDashboardNav = useCallback((active: boolean, title?: string) => {
    setHasDashboardNav(active);
    if (title) setDashboardTitle(title);
    if (!active) {
      setMobileOpen(false);
      setSidebarCollapsed(false);
      setDashboardTitle("Oversikt");
    }
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      mobileOpen,
      workspaceName,
      hasWorkspace,
      hasDashboardNav,
      dashboardTitle,
      toggleMenu,
      setMobileOpen,
      syncWorkspace,
      syncDashboardNav,
    }),
    [
      sidebarCollapsed,
      mobileOpen,
      workspaceName,
      hasWorkspace,
      hasDashboardNav,
      dashboardTitle,
      toggleMenu,
      syncWorkspace,
      syncDashboardNav,
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
    throw new Error(
      "useWorkspaceChrome must be used within WorkspaceChromeProvider",
    );
  }
  return ctx;
}

export function useWorkspaceChromeOptional(): WorkspaceChromeValue | null {
  return useContext(WorkspaceChromeContext);
}
