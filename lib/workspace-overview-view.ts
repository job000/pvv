import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  ClipboardList,
  FileText,
  Settings2,
  Share2,
  Shield,
  Users,
} from "lucide-react";

/** Stabile ID-er for snarveier — lagres per bruker per arbeidsområde. */
export const WORKSPACE_OVERVIEW_SHORTCUT_IDS = [
  "vurderinger",
  "prosessregister",
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
      id: "vurderinger",
      href: `/w/${w}/vurderinger`,
      title: "Vurderinger",
      desc: "Start, fortsett og følg opp vurderinger",
      icon: ClipboardList,
    },
    {
      id: "prosessregister",
      href: `/w/${w}/vurderinger?fane=prosesser`,
      title: "Prosesser",
      desc: "Se prosesser og opprett ny sak fra riktig grunnlag",
      icon: Users,
    },
    {
      id: "skjemaer",
      href: `/w/${w}/skjemaer`,
      title: "Skjemaer",
      desc: "Bygg enkle intake-skjema og godkjenn innsendte forslag",
      icon: FileText,
    },
    {
      id: "ros",
      href: `/w/${w}/ros`,
      title: "Risikoanalyse",
      desc: "Opprett ROS og koble analyser til vurderinger",
      icon: Shield,
    },
    {
      id: "organisasjon",
      href: `/w/${w}/organisasjon`,
      title: "Organisasjon",
      desc: "Oppdater enheter, roller og kontaktpunkter",
      icon: Building2,
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
