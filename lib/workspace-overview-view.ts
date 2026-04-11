import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  ScrollText,
  Settings2,
  Share2,
  Shield,
  Users,
} from "lucide-react";

/** Stabile ID-er for snarveier — lagres per bruker per arbeidsområde. */
export const WORKSPACE_OVERVIEW_SHORTCUT_IDS = [
  "oversikt",
  "vurderinger",
  "prosessregister",
  "prosessdesign",
  "skjemaer",
  "ros",
  "organisasjon",
  "delinger",
  "varslinger",
  "innstillinger",
] as const;

export type WorkspaceOverviewShortcutId =
  (typeof WORKSPACE_OVERVIEW_SHORTCUT_IDS)[number];

export type WorkspaceOverviewShortcut = {
  id: WorkspaceOverviewShortcutId;
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

export function buildWorkspaceOverviewShortcuts(
  workspaceIdStr: string,
): WorkspaceOverviewShortcut[] {
  const w = workspaceIdStr;
  return [
    {
      id: "oversikt",
      href: `/w/${w}`,
      title: "Oversikt",
      desc: "Neste steg og arbeidskø",
      icon: FolderKanban,
    },
    {
      id: "vurderinger",
      href: `/w/${w}/vurderinger`,
      title: "Vurderinger",
      desc: "Start og følg opp",
      icon: ClipboardList,
    },
    {
      id: "prosessregister",
      href: `/w/${w}/vurderinger?fane=prosesser`,
      title: "Prosesser",
      desc: "Prosesser og dokumentasjon",
      icon: Users,
    },
    {
      id: "prosessdesign",
      href: `/w/${w}/prosessdesign`,
      title: "Prosessdesign",
      desc: "Dokumentasjon for robotløp",
      icon: ScrollText,
    },
    {
      id: "ros",
      href: `/w/${w}/ros`,
      title: "Risiko",
      desc: "ROS og koblinger",
      icon: Shield,
    },
    {
      id: "organisasjon",
      href: `/w/${w}/organisasjon`,
      title: "Organisasjon",
      desc: "Enheter og ansvar",
      icon: Building2,
    },
    {
      id: "skjemaer",
      href: `/w/${w}/skjemaer`,
      title: "Skjemaer",
      desc: "Forslag og godkjenning",
      icon: FileText,
    },
    {
      id: "delinger",
      href: `/w/${w}/delinger`,
      title: "Teammedlemmer",
      desc: "Inviter medlemmer og juster tilgang",
      icon: Share2,
    },
    {
      id: "varslinger",
      href: `/w/${w}/varslinger`,
      title: "Varslinger",
      desc: "Se varsler og finjuster påminnelser",
      icon: Bell,
    },
    {
      id: "innstillinger",
      href: `/w/${w}/innstillinger`,
      title: "Innstillinger",
      desc: "Oppdater navn, notater og oppsett",
      icon: Settings2,
    },
  ];
}

export function isValidShortcutId(id: string): id is WorkspaceOverviewShortcutId {
  return (WORKSPACE_OVERVIEW_SHORTCUT_IDS as readonly string[]).includes(id);
}
