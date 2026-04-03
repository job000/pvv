"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/app-toast";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InviteEmailSuggestInput } from "@/components/user/invite-email-suggest-input";
import { PipelineStatusSelect } from "@/components/assessment/pipeline-status-select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  PIPELINE_KANBAN_ORDER,
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
  type PipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  compliancePlainLine,
  effectiveAssessmentPriority,
  formatRelativeUpdatedAt,
  priorityBandBadgeClass,
  priorityBandLabel,
  priorityBorderAccentClass,
  priorityFillClass,
} from "@/lib/assessment-ui-helpers";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  ExternalLink,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Tag,
  Ticket,
  Loader2,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { parseSuggestedCodeAndNameFromGithubTitle } from "@/lib/github-process-title";
import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import {
  WORKSPACE_ROLE_DESC_NB,
  WORKSPACE_ROLE_LABEL_NB,
} from "@/lib/role-labels-nb";
import { GithubIssueStartCard } from "@/components/github/github-issue-start-card";
import { WorkspaceCandidateRow } from "./workspace-candidate-row";
import { WorkspaceGithubIntegrationCard } from "./workspace-github-integration-card";
import { ProcessCoverageOverview } from "./process-coverage-overview";
import { ProsessregisterHubLead } from "./prosessregister-hub-lead";

/** Kompakt rad i listevisning — mindre visuell støy enn tre full bredde-grafer. */
function AssessmentListScoresCompact({
  ap,
  crit,
  ease,
  easeLabel,
}: {
  ap: number;
  crit: number;
  ease: number | null | undefined;
  easeLabel?: string | null;
}) {
  const e =
    ease != null && Number.isFinite(ease) ? Math.min(100, Math.max(0, ease)) : null;
  const implWord =
    easeLabel && easeLabel.length > 0
      ? easeLabel.length > 10
        ? `${easeLabel.slice(0, 9)}…`
        : easeLabel
      : "Impl.";
  return (
    <p className="text-muted-foreground text-[11px] tabular-nums leading-snug">
      <span className="text-sky-700 dark:text-sky-300">Gevinst {ap.toFixed(0)}%</span>
      <span className="mx-1.5 text-border">·</span>
      <span className="text-rose-700 dark:text-rose-300">Viktighet {crit.toFixed(0)}%</span>
      {e != null ? (
        <>
          <span className="mx-1.5 text-border">·</span>
          <span className="text-violet-700 dark:text-violet-300">
            {implWord} {e.toFixed(0)}%
          </span>
        </>
      ) : null}
    </p>
  );
}

/** Rad fra `listGithubProjectItemsInStatusColumn` — brukt i prosessregister-UI. */
type GithubColumnItemRow = {
  projectItemId: string;
  contentKind: "draft_issue" | "issue" | "pull_request" | "unknown";
  title: string;
  issueUrl?: string;
  issueNumber?: number;
  repoFullName?: string;
  issueNodeId?: string;
};

function githubColumnContentKindLabel(
  k: GithubColumnItemRow["contentKind"],
): string {
  switch (k) {
    case "draft_issue":
      return "Utkast";
    case "issue":
      return "Issue";
    case "pull_request":
      return "PR";
    default:
      return "Ukjent";
  }
}

function candidateOrgUnitLabel(
  c: Doc<"candidates">,
  orgUnits: Doc<"orgUnits">[],
): string {
  if (!c.orgUnitId) {
    return "—";
  }
  const u = orgUnits.find((o) => o._id === c.orgUnitId);
  return u ? `${ORG_UNIT_KIND_LABELS[u.kind]} · ${u.name}` : "—";
}

export function WorkspaceSettingsPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const router = useRouter();
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const updateWorkspace = useMutation(api.workspaces.update);

  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false);

  const [wsName, setWsName] = useState("");
  const [wsNotes, setWsNotes] = useState("");
  const [wsOrgNr, setWsOrgNr] = useState("");
  const [wsHer, setWsHer] = useState("");

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  const isOwner = membership?.role === "owner";

  /* Synkroniser serverdata inn i kontrollerte skjemafelt ved navigasjon/oppdatering. */
  /* eslint-disable react-hooks/set-state-in-effect -- bevisst reset av lokalt skjema når `workspace` endres */
  useEffect(() => {
    if (workspace && workspace !== null) {
      setWsName(workspace.name);
      setWsNotes(workspace.notes ?? "");
      setWsOrgNr(workspace.organizationNumber ?? "");
      setWsHer(workspace.institutionIdentifier ?? "");
    }
  }, [workspace]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (workspace === undefined || membership === undefined) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }
  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  async function saveWorkspaceSettings() {
    try {
      await updateWorkspace({
        workspaceId,
        name: wsName,
        notes: wsNotes.trim() === "" ? null : wsNotes,
        organizationNumber: wsOrgNr.trim() === "" ? null : wsOrgNr,
        institutionIdentifier: wsHer.trim() === "" ? null : wsHer,
      });
      toast.success("Innstillinger lagret.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre innstillinger.",
      );
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Innstillinger</CardTitle>
          <CardDescription>
            Kun administratorer kan endre navn og notater for arbeidsområdet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Arbeidsområde</CardTitle>
        <CardDescription>
          Navn, org.nr / HER-id og notater — synlig for alle med tilgang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ws-name">Navn</Label>
          <Input
            id="ws-name"
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ws-orgnr">Organisasjonsnummer</Label>
            <Input
              id="ws-orgnr"
              inputMode="numeric"
              value={wsOrgNr}
              onChange={(e) => setWsOrgNr(e.target.value)}
              placeholder="9 siffer (valgfritt)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-her">HER-id / institusjonsidentifikator</Label>
            <Input
              id="ws-her"
              value={wsHer}
              onChange={(e) => setWsHer(e.target.value)}
              placeholder="F.eks. HER-id i helsesektoren"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-notes">Notater</Label>
          <Textarea
            id="ws-notes"
            value={wsNotes}
            onChange={(e) => setWsNotes(e.target.value)}
            placeholder="Formål, retningslinjer, kontekst for teamet …"
            rows={4}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={() => void saveWorkspaceSettings()}>
          Lagre innstillinger
        </Button>
      </CardFooter>
    </Card>

    <WorkspaceGithubIntegrationCard workspaceId={workspaceId} workspace={workspace} />

    {isOwner && workspace ? (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Fare</CardTitle>
          <CardDescription>
            Slett hele arbeidsområdet og all tilhørende data. Kan ikke angres.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteWorkspace(true)}
          >
            Slett arbeidsområde …
          </Button>
        </CardFooter>
      </Card>
    ) : null}

    <WorkspaceDeleteDialog
      workspace={workspace ?? null}
      open={showDeleteWorkspace}
      onOpenChange={setShowDeleteWorkspace}
      onDeleted={() => router.push("/dashboard")}
    />
    </>
  );
}

function useDebouncedInviteEmail(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function WorkspaceTeamPanel({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const pendingInvites = useQuery(api.workspaces.listWorkspaceInvites, {
    workspaceId,
  });
  const inviteMember = useMutation(api.workspaces.inviteMember);
  const removeMember = useMutation(api.workspaces.removeMember);
  const updateMemberRole = useMutation(api.workspaces.updateMemberRole);
  const cancelWorkspaceInvite = useMutation(
    api.workspaces.cancelWorkspaceInvite,
  );
  const cancelWorkspaceUserInvite = useMutation(
    api.workspaces.cancelWorkspaceUserInvite,
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  const debouncedInviteEmail = useDebouncedInviteEmail(inviteEmail.trim(), 300);
  const invitePreview = useQuery(
    api.workspaces.previewWorkspaceInviteTarget,
    isAdmin && debouncedInviteEmail.includes("@")
      ? { workspaceId, email: debouncedInviteEmail }
      : "skip",
  );
  const pendingUserInvites = useQuery(
    api.workspaces.listWorkspaceUserInvitesForAdmin,
    isAdmin ? { workspaceId } : "skip",
  );

  if (members === undefined || membership === undefined) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  async function sendInvite() {
    try {
      const r = await inviteMember({
        workspaceId,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      toast.success(
        r.kind === "pending_acceptance"
          ? "Invitasjon sendt. Brukeren må godta i oversikten før vedkommende blir medlem."
          : "Invitasjon er registrert. Når personen logger inn med e-posten, kan vedkommende godta eller avslå under Oversikt.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke legge til eller invitere.");
    }
  }

  const trimmedInvite = inviteEmail.trim();
  const previewStale =
    trimmedInvite.includes("@") &&
    debouncedInviteEmail !== trimmedInvite;
  const inviteButtonDisabled =
    !trimmedInvite ||
    invitePreview?.kind === "already_member" ||
    invitePreview?.kind === "already_pending" ||
    (trimmedInvite.includes("@") && !previewStale && invitePreview === undefined);

  let inviteButtonLabel = "Legg til eller inviter";
  if (previewStale) {
    inviteButtonLabel = "Sjekker …";
  } else if (invitePreview?.kind === "invite_registered_user") {
    inviteButtonLabel = "Send invitasjon";
  } else if (invitePreview?.kind === "invite_email") {
    inviteButtonLabel = "Send invitasjon";
  } else if (invitePreview?.kind === "already_member") {
    inviteButtonLabel = "Allerede medlem";
  } else if (invitePreview?.kind === "already_pending") {
    inviteButtonLabel = "Venter allerede";
  }

  if (isAdmin) {
    return (
      <div className="space-y-5">
        {/* Invite form */}
        <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Legg til eller inviter bruker
          </p>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
            Mottaker får varsel og må godta under Oversikt før vedkommende blir medlem. Uregistrert
            e-post får invitasjon som dukker opp når personen logger inn med samme adresse.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <InviteEmailSuggestInput
              id="invite-email"
              label="E-post"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="kollega@firma.no"
              source={{ kind: "workspace", workspaceId }}
            />
            <div className="w-full space-y-1.5 sm:w-40">
              <Label htmlFor="invite-role" className="text-xs">Rolle</Label>
              <select
                id="invite-role"
                className="border-input bg-background h-9 w-full rounded-xl border px-3 text-sm shadow-xs outline-none"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "admin" | "member" | "viewer")
                }
              >
                <option value="admin">Administrator</option>
                <option value="member">Medlem</option>
                <option value="viewer">Kun visning</option>
              </select>
            </div>
            <Button
              type="button"
              className="rounded-xl"
              disabled={inviteButtonDisabled}
              onClick={() => void sendInvite()}
            >
              {inviteButtonLabel}
            </Button>
          </div>
          {invitePreview?.kind === "invite_registered_user" ? (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {invitePreview.displayName
                ? `«${invitePreview.displayName}» får varsel og kan godta eller avslå.`
                : "Registrert bruker — vedkommende må godta invitasjonen under Oversikt."}
            </p>
          ) : null}
          {invitePreview?.kind === "invite_email" ? (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Ingen bruker med denne e-posten i FRO ennå. Etter innlogging kan vedkommende godta eller
              avslå under Oversikt.
            </p>
          ) : null}
          {invitePreview?.kind === "already_member" ? (
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Denne brukeren er allerede medlem av arbeidsområdet.
            </p>
          ) : null}
          {invitePreview?.kind === "already_pending" ? (
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Det finnes allerede en ventende invitasjon til denne brukeren.
            </p>
          ) : null}
        </div>

        {/* Pending: registered users (awaiting accept) */}
        {pendingUserInvites !== undefined && pendingUserInvites.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Venter på svar (registrerte brukere)
            </p>
            {pendingUserInvites.map((row) => (
              <div
                key={row._id}
                className="group/pui flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                    {(row.name ?? row.email ?? "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.name ?? row.email ?? row.userId}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {WORKSPACE_ROLE_LABEL_NB[row.role] ?? row.role} · Venter på godkjenning ·{" "}
                    {new Date(row.createdAt).toLocaleDateString("nb-NO", { dateStyle: "medium" })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs opacity-0 transition-opacity group-hover/pui:opacity-100"
                  onClick={() => void cancelWorkspaceUserInvite({ inviteId: row._id })}
                >
                  Trekk tilbake
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Pending invitations */}
        {pendingInvites !== undefined && pendingInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ventende invitasjoner</p>
            {pendingInvites.map((inv) => (
              <div
                key={inv._id}
                className="group/inv flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {inv.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {WORKSPACE_ROLE_LABEL_NB[inv.role] ?? inv.role} · Invitert{" "}
                    {new Date(inv.createdAt).toLocaleDateString("nb-NO", { dateStyle: "medium" })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs opacity-0 transition-opacity group-hover/inv:opacity-100"
                  onClick={() => void cancelWorkspaceInvite({ inviteId: inv._id })}
                >
                  Trekk tilbake
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Members */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Medlemmer ({members.length})
          </p>
          {members.map((m) => (
            <div
              key={m._id}
              className="group/member flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:ring-white/[0.06]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary">
                  {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.name ?? m.email ?? m.userId}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    m.role === "owner" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : m.role === "admin" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
                  </span>
                  {m.email && (
                    <span className="text-muted-foreground text-[10px]">{m.email}</span>
                  )}
                </div>
              </div>
              {m.role !== "owner" && (
                <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover/member:opacity-100">
                  <select
                    className="border-input h-8 rounded-xl border bg-background px-2 text-xs"
                    value={m.role}
                    onChange={(e) => {
                      const next = e.target.value as "admin" | "member" | "viewer";
                      void updateMemberRole({
                        workspaceId,
                        targetUserId: m.userId,
                        role: next,
                      });
                    }}
                  >
                    <option value="admin">Administrator</option>
                    <option value="member">Medlem</option>
                    <option value="viewer">Kun visning</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      void removeMember({
                        workspaceId,
                        targetUserId: m.userId,
                      })
                    }
                  >
                    Fjern
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Medlemmer ({members.length})
      </p>
      {members.map((m) => (
        <div
          key={m._id}
          className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <span className="text-sm font-bold text-primary">
              {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{m.name ?? m.email ?? m.userId}</p>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              m.role === "owner" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : m.role === "admin" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
              : "bg-muted text-muted-foreground"
            }`}>
              {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
            </span>
          </div>
        </div>
      ))}
      <p className="text-muted-foreground pt-2 text-xs">
        Kontakt en administrator for å endre roller.
      </p>
    </div>
  );
}

export type ApprovedIntakeProcessregisterRow = {
  submissionId: Id<"intakeSubmissions">;
  title: string;
  reviewedAt: number;
  approvedAssessmentId: Id<"assessments">;
  githubRepoFullName?: string;
  githubIssueNumber?: number;
};

export function WorkspaceCandidatesPanel({
  workspaceId,
  hubMode = false,
  approvedIntakeForProcessregister,
}: {
  workspaceId: Id<"workspaces">;
  /** Når true: vist under PVV-hub med tydeligere forklaring og layout */
  hubMode?: boolean;
  /**
   * Fra `WorkspacePvvHub` (spørring heises dit) slik at listen er oppdatert før panelet
   * monteres når bruker bytter til Prosessregister-fanen.
   */
  approvedIntakeForProcessregister:
    | undefined
    | ApprovedIntakeProcessregisterRow[];
}) {
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });
  /** Eksisterende query (alltid deployet) — ROS-kandidat-sett utledes i useMemo under. */
  const rosAnalysesForWorkspace = useQuery(api.ros.listAnalyses, {
    workspaceId,
  });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const createCandidate = useMutation(api.candidates.create);
  const updateCandidate = useMutation(api.candidates.update);
  const removeCandidate = useMutation(api.candidates.remove);
  const updateWorkspace = useMutation(api.workspaces.update);
  const listGithubProjectStatusOptions = useAction(
    api.githubCandidateProject.listGithubProjectStatusOptions,
  );
  const registerCandidateToGithubProject = useAction(
    api.githubCandidateProject.registerCandidateToGithubProject,
  );
  const syncCandidateGithubDraft = useAction(
    api.githubCandidateProject.syncCandidateGithubDraft,
  );
  const describeGithubProjectItemForCandidate = useAction(
    api.githubCandidateProject.describeGithubProjectItemForCandidate,
  );
  const updateCandidateGithubProjectStatus = useAction(
    api.githubCandidateProject.updateCandidateGithubProjectStatus,
  );
  const removeCandidateFromGithubProject = useAction(
    api.githubCandidateProject.removeCandidateFromGithubProject,
  );
  const importPvvFieldsFromGithubProjectItem = useAction(
    api.githubCandidateProject.importPvvFieldsFromGithubProjectItem,
  );
  const listGithubProjectColumnItems = useAction(
    api.githubProjectColumnItems.listGithubProjectItemsInStatusColumn,
  );
  const createFromGithubProjectItem = useMutation(
    api.candidates.createFromGithubProjectItem,
  );
  const fetchGithubIssueForProcessImport = useAction(
    api.githubIssueImport.fetchGithubIssueForProcessImport,
  );
  const createCandidateFromGithubIssue = useMutation(
    api.candidates.createCandidateFromGithubIssue,
  );
  const createGithubRepoIssueForCandidate = useAction(
    api.githubCandidateProject.createGithubRepoIssueForCandidate,
  );

  /** Unngår at useEffect re-kjører ved hver render hvis useAction bytter referanse. */
  const listGithubStatusOptionsRef = useRef(listGithubProjectStatusOptions);
  listGithubStatusOptionsRef.current = listGithubProjectStatusOptions;

  const [cName, setCName] = useState("");
  const [cCode, setCCode] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cOwner, setCOwner] = useState("");
  const [cSystems, setCSystems] = useState("");
  const [cCompliance, setCCompliance] = useState("");

  const [githubProjectStatus, setGithubProjectStatus] = useState<{
    loading: boolean;
    options: { id: string; name: string }[] | null;
    fieldName: string | null;
    error: string | null;
  }>({
    loading: false,
    options: null,
    fieldName: null,
    error: null,
  });
  const [bulkGithubBusy, setBulkGithubBusy] = useState(false);
  const [rowGithubBusyId, setRowGithubBusyId] = useState<
    Id<"candidates"> | null
  >(null);
  const [overviewDeleteBusyId, setOverviewDeleteBusyId] = useState<
    Id<"candidates"> | null
  >(null);
  const [autoRegGithub, setAutoRegGithub] = useState(false);
  const [autoRegStatusId, setAutoRegStatusId] = useState("");
  const [newProcessOpen, setNewProcessOpen] = useState(false);
  const [autoGhHelpOpen, setAutoGhHelpOpen] = useState(false);
  const [processRegHelpOpen, setProcessRegHelpOpen] = useState(false);

  type GithubPreviewData = {
    title: string;
    body: string | null;
    state: string;
    stateReason: string | null;
    number: number;
    repoFullName: string;
    htmlUrl: string;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    author: { login: string; avatarUrl: string } | null;
    assignees: { login: string; avatarUrl: string }[];
    labels: { name: string; color: string }[];
    milestone: string | null;
    commentsCount: number;
  };
  const [ghPreview, setGhPreview] = useState<GithubPreviewData | null>(null);
  const [ghPreviewOpen, setGhPreviewOpen] = useState(false);
  const [ghPreviewLoading, setGhPreviewLoading] = useState(false);
  const previewGithubIssueAction = useAction(
    api.githubIssueImport.previewGithubIssue,
  );
  const previewGithubIssueByUrlAction = useAction(
    api.githubIssueImport.previewGithubIssueByUrl,
  );

  const openGhPreview = useCallback(
    async (repoFullName: string, issueNumber: number) => {
      setGhPreviewLoading(true);
      setGhPreviewOpen(true);
      setGhPreview(null);
      try {
        const data = await previewGithubIssueAction({
          workspaceId,
          repoFullName,
          issueNumber,
        });
        setGhPreview(data);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke hente forhåndsvisning",
        );
        setGhPreviewOpen(false);
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubIssueAction, workspaceId],
  );

  const openGhPreviewByUrl = useCallback(
    async (issueUrl: string) => {
      setGhPreviewLoading(true);
      setGhPreviewOpen(true);
      setGhPreview(null);
      try {
        const data = await previewGithubIssueByUrlAction({
          workspaceId,
          issueUrl,
        });
        setGhPreview(data);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Kunne ikke hente forhåndsvisning",
        );
        setGhPreviewOpen(false);
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubIssueByUrlAction, workspaceId],
  );
  const [editCandidateId, setEditCandidateId] =
    useState<Id<"candidates"> | null>(null);

  const [columnPickId, setColumnPickId] = useState("");
  const [columnItemsResult, setColumnItemsResult] = useState<{
    fieldName: string;
    optionName: string;
    items: GithubColumnItemRow[];
  } | null>(null);
  const [columnItemsError, setColumnItemsError] = useState<string | null>(null);
  const [columnItemsLoading, setColumnItemsLoading] = useState(false);
  const [importGithubOpen, setImportGithubOpen] = useState(false);
  const [importGithubRow, setImportGithubRow] =
    useState<GithubColumnItemRow | null>(null);
  const [importGithubName, setImportGithubName] = useState("");
  const [importGithubCode, setImportGithubCode] = useState("");
  const [importGithubBusy, setImportGithubBusy] = useState(false);

  const [issueGithubUrlInput, setIssueGithubUrlInput] = useState("");
  const [issueUrlFetchBusy, setIssueUrlFetchBusy] = useState(false);
  const [issueUrlFetchError, setIssueUrlFetchError] = useState<string | null>(
    null,
  );
  const [issueImportPreview, setIssueImportPreview] = useState<{
    title: string;
    repoFullName: string;
    issueNumber: number;
    issueNodeId?: string;
  } | null>(null);
  const [issueFromGithubDialogOpen, setIssueFromGithubDialogOpen] =
    useState(false);
  const [issueImportName, setIssueImportName] = useState("");
  const [issueImportCode, setIssueImportCode] = useState("");
  const [issueImportBusy, setIssueImportBusy] = useState(false);

  const [createTab, setCreateTab] = useState<"github" | "manual">("github");

  /** Én synlig importflyt om gangen: issue-URL eller prosjektkolonne */
  const [githubImportTab, setGithubImportTab] = useState<"issue" | "column">(
    "issue",
  );

  const editingCandidate = useMemo(() => {
    if (!editCandidateId || !candidates) {
      return undefined;
    }
    return candidates.find((c) => c._id === editCandidateId);
  }, [editCandidateId, candidates]);

  useEffect(() => {
    if (
      editCandidateId &&
      candidates &&
      !candidates.some((c) => c._id === editCandidateId)
    ) {
      setEditCandidateId(null);
    }
  }, [editCandidateId, candidates]);

  const reloadGithubProjectStatus = useCallback(
    (forceRefresh = false) => {
      if (!workspace?.githubProjectNodeId?.trim()) {
        setGithubProjectStatus({
          loading: false,
          options: null,
          fieldName: null,
          error: null,
        });
        return;
      }
      setGithubProjectStatus((s) => ({ ...s, loading: true, error: null }));
      void listGithubStatusOptionsRef.current({ workspaceId, forceRefresh })
        .then((r) =>
          setGithubProjectStatus({
            loading: false,
            options: r.options,
            fieldName: r.fieldName,
            error: r.githubRateLimited
              ? "GitHub rate limit: ingen lagret statusliste ennå. Vent noen minutter og bruk «Prøv på nytt»."
              : null,
          }),
        )
        .catch((e) =>
          setGithubProjectStatus({
            loading: false,
            options: null,
            fieldName: null,
            error:
              e instanceof Error
                ? e.message
                : "Kunne ikke laste statusliste fra GitHub.",
          }),
        );
    },
    [workspace?.githubProjectNodeId, workspaceId],
  );

  /** Kun når prosjekt-node-ID endres — ikke ved hver workspace-oppdatering (unngår GitHub rate limit). */
  useEffect(() => {
    if (workspace === undefined) {
      return;
    }
    if (workspace === null) {
      setGithubProjectStatus({
        loading: false,
        options: null,
        fieldName: null,
        error: null,
      });
      return;
    }
    if (!workspace.githubProjectNodeId?.trim()) {
      setGithubProjectStatus({
        loading: false,
        options: null,
        fieldName: null,
        error: null,
      });
      return;
    }
    let cancelled = false;
    setGithubProjectStatus((s) => ({ ...s, loading: true, error: null }));
    void listGithubStatusOptionsRef.current({ workspaceId })
      .then((r) => {
        if (!cancelled) {
          setGithubProjectStatus({
            loading: false,
            options: r.options,
            fieldName: r.fieldName,
            error: r.githubRateLimited
              ? "GitHub rate limit: ingen lagret statusliste ennå. Vent noen minutter og bruk «Prøv på nytt»."
              : null,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGithubProjectStatus({
            loading: false,
            options: null,
            fieldName: null,
            error:
              e instanceof Error
                ? e.message
                : "Kunne ikke laste statusliste fra GitHub.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspace?.githubProjectNodeId]);

  useEffect(() => {
    if (workspace === undefined || workspace === null) {
      return;
    }
    setAutoRegGithub(workspace.githubAutoRegisterProcessOnCreate ?? false);
    setAutoRegStatusId(
      workspace.githubAutoRegisterProcessStatusOptionId ?? "",
    );
  }, [workspace]);

  const candidatesSorted = useMemo(() => {
    if (!candidates) {
      return [];
    }
    return [...candidates].sort((a, b) =>
      a.code.localeCompare(b.code, "nb", { sensitivity: "base" }),
    );
  }, [candidates]);

  const projectItemIdsLinkedInPvv = useMemo(() => {
    const s = new Set<string>();
    if (!candidates) {
      return s;
    }
    for (const c of candidates) {
      const pid = c.githubProjectItemNodeId?.trim();
      if (pid) {
        s.add(pid);
      }
    }
    return s;
  }, [candidates]);

  const rosCandidateIdSet = useMemo(() => {
    const s = new Set<string>();
    if (!rosAnalysesForWorkspace) {
      return s;
    }
    for (const a of rosAnalysesForWorkspace) {
      if (a.candidateId) {
        s.add(a.candidateId);
      }
    }
    return s;
  }, [rosAnalysesForWorkspace]);

  const projectItemIdToCandidateId = useMemo(() => {
    const m = new Map<string, Id<"candidates">>();
    if (!candidates) {
      return m;
    }
    for (const c of candidates) {
      const pid = c.githubProjectItemNodeId?.trim();
      if (pid) {
        m.set(pid, c._id);
      }
    }
    return m;
  }, [candidates]);

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";
  const canEditCandidates =
    membership &&
    (membership.role === "owner" ||
      membership.role === "admin" ||
      membership.role === "member");

  if (
    candidates === undefined ||
    membership === undefined ||
    orgUnits === undefined ||
    workspace === undefined ||
    approvedIntakeForProcessregister === undefined
  ) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  if (workspace === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Fant ikke arbeidsområdet.
      </p>
    );
  }

  const w = workspace;

  async function addCandidate() {
    if (!canEditCandidates) {
      return;
    }
    const name = cName.trim();
    if (!name) {
      toast.error("Fyll inn prosessnavn.");
      return;
    }
    try {
      const { candidateId: newId, code: resolvedCode } = await createCandidate({
        workspaceId,
        name,
        code: cCode.trim() === "" ? undefined : cCode,
        notes: cNotes.trim() === "" ? undefined : cNotes.trim(),
        linkHintBusinessOwner:
          cOwner.trim() === "" ? undefined : cOwner.trim(),
        linkHintSystems:
          cSystems.trim() === "" ? undefined : cSystems.trim(),
        linkHintComplianceNotes:
          cCompliance.trim() === "" ? undefined : cCompliance.trim(),
      });
      setCName("");
      setCCode("");
      setCNotes("");
      setCOwner("");
      setCSystems("");
      setCCompliance("");
      const statusForGithub =
        autoRegStatusId.trim() ||
        w.githubAutoRegisterProcessStatusOptionId?.trim() ||
        "";
      const shouldAutoRegisterInGithub =
        Boolean(w.githubProjectNodeId?.trim()) &&
        statusForGithub.length > 0 &&
        (autoRegGithub || w.githubAutoRegisterProcessOnCreate);
      let githubAutoRegisterFailed = false;
      if (shouldAutoRegisterInGithub) {
        try {
          await registerCandidateToGithubProject({
            candidateId: newId,
            statusOptionId: statusForGithub,
          });
        } catch (e) {
          githubAutoRegisterFailed = true;
          toast.warning(
            `Prosessen ble lagret. Automatisk registrering i GitHub-tavle feilet: ${
              e instanceof Error ? e.message : "ukjent feil"
            }`,
          );
        }
      }
      setNewProcessOpen(false);
      if (!githubAutoRegisterFailed) {
        toast.success(
          cCode.trim() === ""
            ? `Prosess opprettet med ID ${resolvedCode}.`
            : "Prosess opprettet.",
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke legge til prosess.",
      );
    }
  }

  async function saveAutoGithubSettings() {
    try {
      await updateWorkspace({
        workspaceId,
        githubAutoRegisterProcessOnCreate: autoRegGithub,
        githubAutoRegisterProcessStatusOptionId:
          autoRegStatusId.trim() === "" ? null : autoRegStatusId.trim(),
      });
      toast.success("Innstilling lagret.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke lagre innstillinger.",
      );
    }
  }

  async function bulkRegisterMissingInGithub() {
    const missing = candidates!.filter((c) => !c.githubProjectItemNodeId);
    if (missing.length === 0) {
      toast.message("Alle prosesser har allerede et kort i GitHub-prosjektet.");
      return;
    }
    const opt =
      autoRegStatusId.trim() ||
      w.githubAutoRegisterProcessStatusOptionId?.trim() ||
      githubProjectStatus.options?.[0]?.id;
    if (!opt) {
      toast.error(
        "Velg en standardstatus (under «Automatisk GitHub-prosjekt») eller vent til statuslisten er lastet.",
      );
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Registrere ${missing.length} prosess(er) som utkast i GitHub-prosjektet med valgt status?`,
      )
    ) {
      return;
    }
    setBulkGithubBusy(true);
    try {
      for (const c of missing) {
        await registerCandidateToGithubProject({
          candidateId: c._id,
          statusOptionId: opt,
        });
      }
      toast.success(
        `${missing.length} prosess(er) registrert i GitHub-prosjektet.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Feil under masse-registrering.",
      );
    } finally {
      setBulkGithubBusy(false);
    }
  }

  async function registerOneFromOverviewTable(candidateId: Id<"candidates">) {
    const opt =
      autoRegStatusId.trim() ||
      w.githubAutoRegisterProcessStatusOptionId?.trim() ||
      githubProjectStatus.options?.[0]?.id;
    if (!opt) {
      toast.error(
        "Velg standardstatus under «Automatisk GitHub-prosjekt», eller vent til statuslisten er lastet. Du kan også utvide prosessen under og velge kolonne der.",
      );
      return;
    }
    setRowGithubBusyId(candidateId);
    try {
      await registerCandidateToGithubProject({
        candidateId,
        statusOptionId: opt,
      });
      toast.success("Prosess lagt til i GitHub-tavle.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke legge til i GitHub-tavle.",
      );
    } finally {
      setRowGithubBusyId(null);
    }
  }

  async function registerRepoIssueFromOverviewTable(
    candidateId: Id<"candidates">,
  ) {
    const opt =
      autoRegStatusId.trim() ||
      w.githubAutoRegisterProcessStatusOptionId?.trim() ||
      githubProjectStatus.options?.[0]?.id;
    if (!opt) {
      toast.error(
        "Velg standardstatus under «Automatisk GitHub-prosjekt», eller vent til statuslisten er lastet.",
      );
      return;
    }
    setRowGithubBusyId(candidateId);
    try {
      await createGithubRepoIssueForCandidate({
        candidateId,
        statusOptionId: opt,
      });
      toast.success(
        "GitHub-issue opprettet, lagt i tavle og synket fra PVV.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette issue i repo.",
      );
    } finally {
      setRowGithubBusyId(null);
    }
  }

  async function deleteCandidateFromOverview(
    candidateId: Id<"candidates">,
    c: Doc<"candidates">,
  ) {
    if (!canEditCandidates) {
      return;
    }
    const msg = c.githubProjectItemNodeId
      ? "Slette denne prosessen fra registeret? Fjern eventuelt kortet i GitHub-prosjekt manuelt. Eksisterende PVV-koblinger bør ryddes manuelt."
      : "Slette denne prosessen fra registeret? Eksisterende PVV-koblinger bør ryddes manuelt.";
    if (typeof window !== "undefined" && !window.confirm(msg)) {
      return;
    }
    setOverviewDeleteBusyId(candidateId);
    try {
      await removeCandidate({ candidateId });
      toast.success("Prosess slettet.");
      if (editCandidateId === candidateId) {
        setEditCandidateId(null);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke slette prosessen.",
      );
    } finally {
      setOverviewDeleteBusyId(null);
    }
  }

  async function fetchGithubColumnItems() {
    const opt = columnPickId.trim();
    if (!opt) {
      toast.error("Velg en kolonne (status) først.");
      return;
    }
    setColumnItemsError(null);
    setColumnItemsLoading(true);
    try {
      const r = await listGithubProjectColumnItems({
        workspaceId,
        statusOptionId: opt,
      });
      setColumnItemsResult({
        fieldName: r.fieldName,
        optionName: r.optionName,
        items: r.items,
      });
    } catch (e) {
      setColumnItemsResult(null);
      setColumnItemsError(
        e instanceof Error ? e.message : "Kunne ikke hente kort fra GitHub.",
      );
    } finally {
      setColumnItemsLoading(false);
    }
  }

  function openImportFromGithubColumn(row: GithubColumnItemRow) {
    if (row.contentKind === "unknown") {
      toast.error(
        "Dette kortet har ukjent innholdstype i GitHub. Kan ikke opprettes i PVV automatisk.",
      );
      return;
    }
    if (
      (row.contentKind === "issue" || row.contentKind === "pull_request") &&
      (!row.repoFullName?.trim() || row.issueNumber == null)
    ) {
      toast.error(
        "Mangler repo eller saksnummer for dette kortet. Sjekk kortet i GitHub og prøv igjen.",
      );
      return;
    }
    const sug = parseSuggestedCodeAndNameFromGithubTitle(row.title);
    setImportGithubName(sug.name);
    setImportGithubCode(sug.code);
    setImportGithubRow(row);
    setImportGithubOpen(true);
  }

  async function confirmImportFromGithubColumn() {
    if (!importGithubRow || !canEditCandidates) {
      return;
    }
    const statusOpt = columnPickId.trim();
    if (!statusOpt) {
      toast.error("Velg kolonnen du hentet fra (samme som over).");
      return;
    }
    const name = importGithubName.trim();
    const code = importGithubCode.trim();
    if (!name || !code) {
      toast.error("Fyll inn navn og prosess-ID.");
      return;
    }
    const row = importGithubRow;
    const removedId = row.projectItemId;
    setImportGithubBusy(true);
    try {
      await createFromGithubProjectItem({
        workspaceId,
        projectItemNodeId: row.projectItemId,
        name,
        code,
        statusOptionId: statusOpt,
        contentKind:
          row.contentKind === "issue"
            ? "issue"
            : row.contentKind === "pull_request"
              ? "pull_request"
              : "draft_issue",
        githubRepoFullName:
          row.contentKind === "issue" || row.contentKind === "pull_request"
            ? row.repoFullName
            : undefined,
        githubIssueNumber:
          row.contentKind === "issue" || row.contentKind === "pull_request"
            ? row.issueNumber
            : undefined,
        githubIssueNodeId:
          row.contentKind === "issue" || row.contentKind === "pull_request"
            ? row.issueNodeId
            : undefined,
      });
      setImportGithubOpen(false);
      setImportGithubRow(null);
      setColumnItemsResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((i) => i.projectItemId !== removedId),
            }
          : null,
      );
      toast.success("Prosess opprettet fra GitHub-kort.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette prosess fra kort.",
      );
    } finally {
      setImportGithubBusy(false);
    }
  }

  async function fetchGithubIssueForImport() {
    const url = issueGithubUrlInput.trim();
    if (!url) {
      toast.error("Lim inn en issue-URL fra GitHub.");
      return;
    }
    setIssueUrlFetchError(null);
    setIssueUrlFetchBusy(true);
    try {
      const r = await fetchGithubIssueForProcessImport({
        workspaceId,
        issueUrl: url,
      });
      setIssueImportPreview(r);
      const sug = parseSuggestedCodeAndNameFromGithubTitle(r.title);
      setIssueImportName(sug.name);
      setIssueImportCode(sug.code);
      setIssueFromGithubDialogOpen(true);
    } catch (e) {
      setIssueImportPreview(null);
      setIssueUrlFetchError(
        e instanceof Error ? e.message : "Kunne ikke hente issue fra GitHub.",
      );
    } finally {
      setIssueUrlFetchBusy(false);
    }
  }

  async function confirmCreateFromGithubIssue() {
    if (!issueImportPreview || !canEditCandidates) {
      return;
    }
    const name = issueImportName.trim();
    const code = issueImportCode.trim();
    if (!name || !code) {
      toast.error("Fyll inn navn og prosess-ID.");
      return;
    }
    setIssueImportBusy(true);
    try {
      await createCandidateFromGithubIssue({
        workspaceId,
        name,
        code,
        githubRepoFullName: issueImportPreview.repoFullName,
        githubIssueNumber: issueImportPreview.issueNumber,
        githubIssueNodeId: issueImportPreview.issueNodeId,
      });
      setIssueFromGithubDialogOpen(false);
      setIssueImportPreview(null);
      setIssueGithubUrlInput("");
      toast.success("Prosess opprettet fra GitHub-issue.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Kunne ikke opprette prosess fra issue.",
      );
    } finally {
      setIssueImportBusy(false);
    }
  }

  const canQuickAddGithubCard =
    Boolean(w.githubProjectNodeId?.trim()) &&
    (githubProjectStatus.options?.length ?? 0) > 0 &&
    !githubProjectStatus.loading &&
    !githubProjectStatus.error;

  const hasDefaultGithubRepo =
    Boolean(w.githubDefaultRepoFullNames?.some((s) => s?.trim())) ||
    Boolean(w.githubDefaultRepoFullName?.trim());

  const canCreateGithubRepoIssue =
    canQuickAddGithubCard && hasDefaultGithubRepo;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-0 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        hubMode && "ring-emerald-500/15",
      )}
    >
      <CardHeader
        data-tutorial-anchor={
          hubMode ? "prosess-oversikt-header" : undefined
        }
        className="pb-5 pt-6 px-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 flex size-10 items-center justify-center rounded-xl">
              <Users className="text-emerald-600 dark:text-emerald-400 size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Prosessregister
              </CardTitle>
              <p className="text-muted-foreground text-xs mt-0.5">
                {!canEditCandidates
                  ? "Lesertilgang"
                  : candidates.length > 0 &&
                      approvedIntakeForProcessregister.length > 0
                    ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""} registrert · ${approvedIntakeForProcessregister.length} godkjent fra skjema`
                    : candidates.length > 0
                      ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""} registrert`
                      : approvedIntakeForProcessregister.length > 0
                        ? `Ingen prosess-ID ennå — ${approvedIntakeForProcessregister.length} godkjent fra skjema`
                        : "Kom i gang ved å opprette eller importere en prosess"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              title="Hjelp"
              onClick={() => setProcessRegHelpOpen(true)}
            >
              <HelpCircle className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">
        {hubMode ? (
          <ProsessregisterHubLead
            canEdit={Boolean(canEditCandidates)}
            onRegisterClick={() => setNewProcessOpen(true)}
          />
        ) : null}
        {hubMode ? (
          <div
            data-tutorial-anchor="github-tur"
            className="pointer-events-none h-px w-full shrink-0 bg-transparent"
            aria-hidden
          />
        ) : null}

        {/* ── Oversikt: skjemavurderinger + P-ID (samme kortmønster som Vurderinger / ROS) ── */}
        {approvedIntakeForProcessregister.length > 0 || candidates.length > 0 ? (
          <section
            className="space-y-4"
            aria-labelledby={
              hubMode ? "prosessregister-oversikt-heading" : "process-overview-heading"
            }
            data-tutorial-anchor="prosess-oversikt-liste"
          >
            {hubMode ? (
              <div className="space-y-1">
                <h2
                  id="prosessregister-oversikt-heading"
                  className="text-foreground text-lg font-semibold tracking-tight"
                >
                  Oversikt
                </h2>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Godkjente skjemaforslag blir til vurderinger (uten egen P-ID). Registrerte prosesser
                  har kode i registeret — som på vurderings- og ROS-sidene.
                </p>
              </div>
            ) : (
              <h2
                id="process-overview-heading"
                className="text-foreground text-base font-semibold"
              >
                {candidates.length > 0 && approvedIntakeForProcessregister.length > 0
                  ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""} · ${approvedIntakeForProcessregister.length} fra skjema`
                  : candidates.length > 0
                    ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""}`
                    : `${approvedIntakeForProcessregister.length} fra skjema`}
              </h2>
            )}

            {approvedIntakeForProcessregister.length > 0 ? (
              <div className="space-y-2">
                {hubMode ? (
                  <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Fra skjema (godkjent) · {approvedIntakeForProcessregister.length}
                  </h3>
                ) : null}
                <div className="space-y-2">
                  {approvedIntakeForProcessregister.map((row) => (
                    <div
                      key={row.submissionId}
                      className="flex items-center gap-2 rounded-2xl bg-card p-3 pr-2 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08] sm:gap-3 sm:p-4 dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
                    >
                      <Link
                        href={`/w/${workspaceId}/a/${row.approvedAssessmentId}`}
                        className="group flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:size-10">
                          <ClipboardCheck className="text-primary size-4 sm:size-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-foreground truncate text-sm font-semibold">
                              {row.title}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-primary/25 bg-primary/5 text-[10px] font-medium text-primary"
                            >
                              Vurdering
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                            Godkjent{" "}
                            {new Date(row.reviewedAt).toLocaleString("nb-NO", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <ChevronRight
                          className="text-muted-foreground/30 size-4 shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                          aria-hidden
                        />
                      </Link>
                      {row.githubRepoFullName?.trim() && row.githubIssueNumber != null ? (
                        <a
                          href={`https://github.com/${row.githubRepoFullName}/issues/${row.githubIssueNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary inline-flex shrink-0 items-center rounded-lg p-2"
                          aria-label={`GitHub-issue ${row.githubIssueNumber}`}
                        >
                          <ExternalLink className="size-4" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {candidates.length > 0 ? (
              <div className="space-y-2">
                {hubMode ? (
                  <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Registrerte prosesser (P-ID) · {candidates.length}
                  </h3>
                ) : null}
                <div className="space-y-2">
                  {candidatesSorted.map((c) => {
                    const hasGithub = Boolean(c.githubProjectItemNodeId);
                    const canPreviewGh =
                      c.githubRepoFullName &&
                      c.githubIssueNumber != null &&
                      c.githubIssueNumber > 0;
                    return (
                      <div
                        key={c._id}
                        className="group flex cursor-pointer items-center gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08] active:scale-[0.995] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]"
                        onClick={() => setEditCandidateId(c._id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-foreground truncate text-sm font-semibold">
                              {c.name}
                            </p>
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {c.code}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {candidateOrgUnitLabel(c, orgUnits) !== "—" ? (
                              <span className="text-muted-foreground text-xs">
                                {candidateOrgUnitLabel(c, orgUnits)}
                              </span>
                            ) : null}
                            {hasGithub ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-900 dark:text-emerald-100",
                                  canPreviewGh && "cursor-pointer hover:bg-emerald-500/20",
                                )}
                                onClick={
                                  canPreviewGh
                                    ? (e) => {
                                        e.stopPropagation();
                                        void openGhPreview(
                                          c.githubRepoFullName!,
                                          c.githubIssueNumber!,
                                        );
                                      }
                                    : undefined
                                }
                              >
                                GitHub
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {!hasGithub && canEditCandidates && canQuickAddGithubCard ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs opacity-0 transition-all group-hover:opacity-100"
                              disabled={rowGithubBusyId === c._id}
                              title="Legg til i GitHub-prosjekt"
                              onClick={(e) => {
                                e.stopPropagation();
                                void registerOneFromOverviewTable(c._id);
                              }}
                            >
                              {rowGithubBusyId === c._id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <GitBranch className="size-3.5" aria-hidden />
                              )}
                            </Button>
                          ) : null}

                          {canEditCandidates ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-8 opacity-0 transition-all group-hover:opacity-100"
                              disabled={overviewDeleteBusyId === c._id}
                              aria-label={`Slett prosess ${c.code}`}
                              title="Slett prosess"
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteCandidateFromOverview(c._id, c);
                              }}
                            >
                              {overviewDeleteBusyId === c._id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="size-3.5" aria-hidden />
                              )}
                            </Button>
                          ) : null}

                          <ChevronRight
                            className="text-muted-foreground/30 size-4 transition-all duration-200 group-hover:text-foreground group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Create / Import ── */}
        {canEditCandidates ? (
          <div
            data-tutorial-anchor="github-prosess"
            className="rounded-2xl bg-muted/20 p-4"
          >
            {/* Top-level tabs: GitHub vs Manual */}
            <div
              className="mb-4 flex gap-0.5 rounded-xl bg-muted/50 p-1"
              role="tablist"
              aria-label="Opprett prosess"
            >
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "github"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  createTab === "github"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCreateTab("github")}
              >
                <GitBranch className="size-4" aria-hidden />
                Importer fra GitHub
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "manual"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  createTab === "manual"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCreateTab("manual")}
              >
                <Plus className="size-4" aria-hidden />
                Opprett manuelt
              </button>
            </div>

            {/* GitHub import panel */}
            {createTab === "github" ? (
              <div className="space-y-3">
                {w.githubProjectNodeId?.trim() ? (
                  <div
                    className="flex gap-0.5 rounded-lg bg-muted/40 p-0.5"
                    role="tablist"
                    aria-label="Importkilde"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={githubImportTab === "issue"}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium transition-all duration-150",
                        githubImportTab === "issue"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setGithubImportTab("issue")}
                    >
                      Issue-lenke
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={githubImportTab === "column"}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium transition-all duration-150",
                        githubImportTab === "column"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setGithubImportTab("column")}
                    >
                      Prosjektkolonne
                    </button>
                  </div>
                ) : !w.githubProjectNodeId?.trim() ? (
                  <div
                    data-tutorial-anchor="github-varsling"
                    className="flex items-center gap-2 rounded-lg bg-amber-500/[0.08] px-3 py-2"
                    role="status"
                  >
                    <AlertTriangle className="text-amber-500 size-3.5 shrink-0" aria-hidden />
                    <p className="text-foreground text-[11px]">
                      Prosjekt ikke koblet.{" "}
                      {isAdmin ? (
                        <Link
                          href={`/w/${workspaceId}/innstillinger#github-arbeidsomrade`}
                          className="text-primary font-medium hover:underline"
                        >
                          Konfigurer
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          Be admin koble prosjekt.
                        </span>
                      )}
                    </p>
                  </div>
                ) : null}

                {(!w.githubProjectNodeId?.trim() || githubImportTab === "issue") ? (
                  <section aria-label="Importer fra GitHub-issue">
                    <div className="flex gap-2">
                      <Input
                        id="gh-issue-url"
                        type="url"
                        value={issueGithubUrlInput}
                        onChange={(e) => setIssueGithubUrlInput(e.target.value)}
                        placeholder="github.com/org/repo/issues/42"
                        className="h-10 min-w-0 flex-1 rounded-xl bg-background font-mono text-xs shadow-sm"
                        autoComplete="off"
                        aria-label="Issue-URL"
                      />
                      <Button
                        type="button"
                        className="h-10 shrink-0 gap-1.5 rounded-xl shadow-sm"
                        disabled={issueUrlFetchBusy || !issueGithubUrlInput.trim()}
                        onClick={() => void fetchGithubIssueForImport()}
                      >
                        {issueUrlFetchBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <ExternalLink className="size-4" aria-hidden />
                        )}
                        Hent
                      </Button>
                    </div>
                    {issueUrlFetchError ? (
                      <p className="text-destructive mt-2 text-xs" role="alert">
                        {issueUrlFetchError}
                      </p>
                    ) : null}
                  </section>
                ) : null}

            {w.githubProjectNodeId?.trim() && githubImportTab === "column" ? (
              <section
                className="space-y-3"
                aria-label="Hent kort fra prosjektkolonne"
              >
            {githubProjectStatus.loading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Laster kolonner fra GitHub …
              </p>
            ) : githubProjectStatus.error ? (
              <p className="text-destructive text-sm">{githubProjectStatus.error}</p>
            ) : (githubProjectStatus.options?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">
                Ingen kolonner funnet — sjekk prosjekt under Innstillinger eller prøv igjen fra en
                prosessrad.
              </p>
            ) : (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="gh-column-pick" className="sr-only">
                    Statuskolonne i GitHub-prosjekt
                  </Label>
                  <select
                    id="gh-column-pick"
                    className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={columnPickId}
                    onChange={(e) => setColumnPickId(e.target.value)}
                  >
                    <option value="">Velg kolonne …</option>
                    {githubProjectStatus.options?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  className="h-10 shrink-0 gap-2 rounded-xl shadow-sm"
                  disabled={
                    columnItemsLoading || !columnPickId.trim()
                  }
                  onClick={() => void fetchGithubColumnItems()}
                >
                  {columnItemsLoading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Search className="size-4" aria-hidden />
                  )}
                  Hent
                </Button>
              </div>
            )}
            {columnItemsError ? (
              <p className="text-destructive text-sm" role="alert">
                {columnItemsError}
              </p>
            ) : null}
            {columnItemsResult && columnItemsResult.items.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-sm font-medium">
                    {columnItemsResult.optionName}
                  </p>
                  <span className="text-muted-foreground rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums">
                    {columnItemsResult.items.length} kort
                  </span>
                </div>
                <div className="max-h-[min(32rem,60vh)] overflow-y-auto pr-0.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                  {columnItemsResult.items.map((row) => {
                    const linked = projectItemIdsLinkedInPvv.has(
                      row.projectItemId,
                    );
                    const linkedCandidateId =
                      projectItemIdToCandidateId.get(row.projectItemId) ??
                      null;
                    const hasRos =
                      linkedCandidateId !== null &&
                      rosCandidateIdSet.has(linkedCandidateId);
                    const ghRef =
                      row.repoFullName?.trim() &&
                      row.issueNumber != null &&
                      row.issueNumber > 0
                        ? `#${row.issueNumber}`
                        : null;
                    const canPreview =
                      row.repoFullName?.trim() &&
                      row.issueNumber != null &&
                      row.issueNumber > 0;

                    const kindIcon =
                      row.contentKind === "issue" ? (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                          <Ticket className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        </div>
                      ) : row.contentKind === "pull_request" ? (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                          <GitBranch className="size-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
                        </div>
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                          <ExternalLink className="text-muted-foreground size-3.5" aria-hidden />
                        </div>
                      );

                    return (
                      <div
                        key={row.projectItemId}
                        role={canPreview ? "button" : undefined}
                        tabIndex={canPreview ? 0 : undefined}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl p-3 transition-all duration-150",
                          canPreview && "cursor-pointer",
                          linked
                            ? "bg-muted/25"
                            : "bg-card shadow-sm ring-1 ring-black/[0.05] hover:shadow-md hover:ring-black/[0.1] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]",
                        )}
                        onClick={
                          canPreview
                            ? () =>
                                void openGhPreview(
                                  row.repoFullName!,
                                  row.issueNumber!,
                                )
                            : undefined
                        }
                      >
                        {kindIcon}
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground text-[13px] font-medium leading-snug">
                            {row.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                                row.contentKind === "issue"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : row.contentKind === "pull_request"
                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                    : "bg-muted/60 text-muted-foreground",
                              )}
                            >
                              {githubColumnContentKindLabel(row.contentKind)}
                            </span>
                            {ghRef ? (
                              <span className="text-muted-foreground font-mono text-[10px]">
                                {ghRef}
                              </span>
                            ) : null}
                            {linked ? (
                              <Badge
                                variant="secondary"
                                className="h-[18px] border-0 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200"
                              >
                                I PVV
                              </Badge>
                            ) : null}
                            {hasRos ? (
                              <Badge
                                variant="secondary"
                                className="h-[18px] border-0 bg-sky-500/10 px-1.5 text-[10px] font-medium text-sky-800 dark:text-sky-200"
                              >
                                ROS
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        {!linked ? (
                          <Button
                            type="button"
                            size="sm"
                            className="absolute right-2 bottom-2 h-7 shrink-0 gap-1 rounded-lg px-2.5 text-[11px] opacity-0 shadow-sm transition-all group-hover:opacity-100"
                            disabled={
                              row.contentKind === "unknown" ||
                              ((row.contentKind === "issue" ||
                                row.contentKind === "pull_request") &&
                                (!row.repoFullName?.trim() ||
                                  row.issueNumber == null))
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              openImportFromGithubColumn(row);
                            }}
                          >
                            <Plus className="size-3" aria-hidden />
                            Opprett
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            ) : columnItemsResult && columnItemsResult.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted/50">
                  <Search className="text-muted-foreground size-4" aria-hidden />
                </div>
                <p className="text-muted-foreground text-sm">
                  Ingen kort i denne kolonnen
                </p>
              </div>
            ) : null}
              </section>
            ) : null}
              </div>
            ) : null}

            {/* Manual creation panel */}
            {createTab === "manual" ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-muted-foreground text-sm">
                  Opprett en ny prosess med egendefinert navn og detaljer.
                </p>
                <Button
                  type="button"
                  className="h-10 gap-2 rounded-xl px-6 shadow-sm"
                  onClick={() => setNewProcessOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  Ny prosess
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <ProcessCoverageOverview workspaceId={workspaceId} />

        {isAdmin &&
        w.githubProjectNodeId?.trim() &&
        githubProjectStatus.options &&
        githubProjectStatus.options.length > 0 ? (
          <section
            className="rounded-2xl bg-muted/15 p-5"
            aria-labelledby="auto-github-heading"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                  <Zap className="text-foreground size-3.5" aria-hidden />
                </div>
                <h2
                  id="auto-github-heading"
                  className="text-foreground text-sm font-semibold"
                >
                  Auto-registrering
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-7"
                title="Nye prosesser registreres automatisk som utkast i GitHub-prosjekt."
                onClick={() => setAutoGhHelpOpen(true)}
              >
                <HelpCircle className="size-3.5" aria-hidden />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label
                htmlFor="auto-reg-github"
                className="border-input bg-background flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <input
                  id="auto-reg-github"
                  type="checkbox"
                  className="border-input text-primary size-4 shrink-0 rounded border shadow-sm"
                  checked={autoRegGithub}
                  onChange={(e) => setAutoRegGithub(e.target.checked)}
                />
                <span className="text-foreground text-xs">Ved ny prosess</span>
              </label>
              <div className="min-w-[10rem] flex-1">
                <select
                  id="auto-gh-status"
                  className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={autoRegStatusId}
                  onChange={(e) => setAutoRegStatusId(e.target.value)}
                >
                  <option value="">Status …</option>
                  {githubProjectStatus.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={() => void saveAutoGithubSettings()}
              >
                Lagre
              </Button>
            </div>
            {candidates.some((c) => !c.githubProjectItemNodeId) ? (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                <p className="text-muted-foreground text-xs">
                  {candidates.filter((c) => !c.githubProjectItemNodeId).length} uten
                  kort i prosjektet
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={
                    bulkGithubBusy ||
                    githubProjectStatus.loading ||
                    (!autoRegStatusId.trim() &&
                      !w.githubAutoRegisterProcessStatusOptionId?.trim() &&
                      !githubProjectStatus.options?.[0]?.id)
                  }
                  onClick={() => void bulkRegisterMissingInGithub()}
                >
                  {bulkGithubBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <GitBranch className="size-3.5" aria-hidden />
                  )}
                  Registrer alle
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        <Dialog open={processRegHelpOpen} onOpenChange={setProcessRegHelpOpen}>
          <DialogContent
            size="sm"
            className="max-w-md"
            titleId="process-reg-help-title"
          >
            <DialogHeader>
              <h2
                id="process-reg-help-title"
                className="text-foreground text-base font-semibold"
              >
                Om prosessregisteret
              </h2>
            </DialogHeader>
            <DialogBody className="space-y-3 text-sm leading-relaxed">
              <p>
                Registrer prosesser med navn og en unik prosess-ID. Samme prosess
                kan brukes i flere vurderinger og ROS-analyser.
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground text-xs">
                <li>Knytt prosesser til organisasjonsenheter (HF/avdeling)</li>
                <li>Koble til GitHub-prosjekt for sporing</li>
                <li>Klikk en rad for å redigere prosessen</li>
                <li>Sletting krever administrator-rolle</li>
              </ul>
            </DialogBody>
          </DialogContent>
        </Dialog>

        <Dialog open={autoGhHelpOpen} onOpenChange={setAutoGhHelpOpen}>
          <DialogContent
            size="sm"
            className="max-w-md"
            titleId="auto-gh-help-title"
          >
            <DialogHeader>
              <h2
                id="auto-gh-help-title"
                className="text-foreground text-base font-semibold"
              >
                Auto-registrering
              </h2>
            </DialogHeader>
            <DialogBody className="space-y-3 text-sm leading-relaxed">
              <p>
                Nye prosesser kan registreres som utkast i GitHub-prosjektet
                automatisk når du oppretter dem i PVV.
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground text-xs">
                <li>Kryss av for auto-registrering ved ny prosess</li>
                <li>Velg standardstatus (kolonne) i prosjekttavlen</li>
                <li>Trykk «Lagre» for å aktivere</li>
                <li>Du kan også legge til manuelt fra prosesslisten</li>
              </ul>
            </DialogBody>
          </DialogContent>
        </Dialog>

        <Dialog
          open={ghPreviewOpen}
          onOpenChange={(open) => {
            setGhPreviewOpen(open);
            if (!open) setGhPreview(null);
          }}
        >
          <DialogContent
            size="xl"
            className="max-h-[85vh] max-w-2xl"
            titleId="gh-preview-title"
            descriptionId="gh-preview-desc"
          >
            {ghPreviewLoading && !ghPreview ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
                <p className="text-muted-foreground text-sm">
                  Henter fra GitHub …
                </p>
              </div>
            ) : ghPreview ? (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        ghPreview.state === "open"
                          ? "bg-emerald-500/10"
                          : "bg-violet-500/10",
                      )}
                    >
                      <GitBranch
                        className={cn(
                          "size-4",
                          ghPreview.state === "open"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-violet-600 dark:text-violet-400",
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="gh-preview-title"
                        className="text-foreground text-base font-semibold leading-snug"
                      >
                        {ghPreview.title}
                      </h2>
                      <p
                        id="gh-preview-desc"
                        className="text-muted-foreground mt-0.5 text-xs"
                      >
                        {ghPreview.repoFullName}#{ghPreview.number}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 text-xs",
                        ghPreview.state === "open"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                          : "border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100",
                      )}
                    >
                      {ghPreview.state === "open" ? "Åpen" : "Lukket"}
                    </Badge>
                  </div>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    {ghPreview.author ? (
                      <div className="flex items-center gap-1.5">
                        <User className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">Opprettet av</span>
                        <span className="text-foreground font-medium">
                          {ghPreview.author.login}
                        </span>
                      </div>
                    ) : null}
                    {ghPreview.createdAt ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          {new Date(ghPreview.createdAt).toLocaleDateString(
                            "nb-NO",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                    ) : null}
                    {ghPreview.commentsCount > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          {ghPreview.commentsCount} kommentar
                          {ghPreview.commentsCount !== 1 ? "er" : ""}
                        </span>
                      </div>
                    ) : null}
                    {ghPreview.milestone ? (
                      <div className="flex items-center gap-1.5">
                        <Tag className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          {ghPreview.milestone}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {ghPreview.assignees.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs">Tildelt:</span>
                      {ghPreview.assignees.map((a) => (
                        <span
                          key={a.login}
                          className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-xs"
                        >
                          {a.avatarUrl ? (
                            <img
                              src={a.avatarUrl}
                              alt=""
                              className="size-4 rounded-full"
                            />
                          ) : null}
                          <span className="text-foreground font-medium">
                            {a.login}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {ghPreview.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ghPreview.labels.map((l) => (
                        <span
                          key={l.name}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: `#${l.color}20`,
                            color: `#${l.color}`,
                            border: `1px solid #${l.color}40`,
                          }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {ghPreview.body ? (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                        Beskrivelse
                      </h3>
                      <div className="prose prose-sm dark:prose-invert max-h-[40vh] overflow-y-auto text-sm leading-relaxed">
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {ghPreview.body}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      Ingen beskrivelse.
                    </p>
                  )}

                  {ghPreview.closedAt ? (
                    <p className="text-muted-foreground text-xs">
                      Lukket{" "}
                      {new Date(ghPreview.closedAt).toLocaleDateString("nb-NO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {ghPreview.stateReason
                        ? ` (${ghPreview.stateReason})`
                        : ""}
                    </p>
                  ) : null}
                </DialogBody>
                <DialogFooter>
                  {ghPreview.htmlUrl ? (
                    <a
                      href={ghPreview.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "gap-1.5",
                      )}
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Åpne i GitHub
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGhPreviewOpen(false)}
                  >
                    Lukk
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Separator />

        <Dialog open={newProcessOpen} onOpenChange={setNewProcessOpen}>
          <DialogContent
            size="lg"
            className="max-h-[92vh] max-w-lg"
            titleId="new-process-title"
            descriptionId="new-process-desc"
          >
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <Plus className="text-primary size-4" aria-hidden />
                </div>
                <div>
                  <h2
                    id="new-process-title"
                    className="text-foreground text-base font-semibold"
                  >
                    Ny prosess
                  </h2>
                  <p
                    id="new-process-desc"
                    className="text-muted-foreground text-xs"
                  >
                    Fyll inn navn. Resten er valgfritt.
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-cand-name" className="text-xs font-medium">
                    Prosessnavn
                  </Label>
                  <Input
                    id="new-cand-name"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="F.eks. Fakturamottak"
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="new-cand-code" className="text-xs font-medium">
                      Prosess-ID
                    </Label>
                    <span className="text-muted-foreground text-[10px]">
                      valgfritt
                    </span>
                  </div>
                  <Input
                    id="new-cand-code"
                    value={cCode}
                    onChange={(e) => setCCode(e.target.value)}
                    placeholder="F.eks. INN-EL-01"
                    autoComplete="off"
                    className="font-mono"
                  />
                  <p className="text-muted-foreground text-[10px]">
                    Tomt = auto-ID
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-cand-notes" className="text-xs font-medium">
                  Notat
                </Label>
                <Textarea
                  id="new-cand-notes"
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  rows={2}
                  placeholder="Systemer, kontaktperson, notater …"
                  className="resize-y"
                />
              </div>

              <details className="group">
                <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-xs font-medium transition-colors">
                  <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
                  Forhåndsutfyll vurderingsfelt
                </summary>
                <div className="mt-3 grid gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="new-cand-owner" className="text-[11px]">
                      Ansvarlig / eier
                    </Label>
                    <Input
                      id="new-cand-owner"
                      value={cOwner}
                      onChange={(e) => setCOwner(e.target.value)}
                      placeholder="Avdelingsleder, kontaktperson"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-cand-systems" className="text-[11px]">
                      Systemer og data
                    </Label>
                    <Input
                      id="new-cand-systems"
                      value={cSystems}
                      onChange={(e) => setCSystems(e.target.value)}
                      placeholder="EPJ, faktura, integrasjoner"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-cand-comp" className="text-[11px]">
                      Sikkerhet og personvern
                    </Label>
                    <Textarea
                      id="new-cand-comp"
                      value={cCompliance}
                      onChange={(e) => setCCompliance(e.target.value)}
                      rows={2}
                      placeholder="Sensitivitet, tilgang, dokumentasjon …"
                      className="resize-y"
                    />
                  </div>
                  <p className="text-muted-foreground text-[10px] leading-relaxed">
                    Fylles automatisk inn i vurderingen første gang prosessen
                    velges. Tomme felt hoppes over.
                  </p>
                </div>
              </details>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNewProcessOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!cName.trim()}
                onClick={() => void addCandidate()}
              >
                Legg til
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={importGithubOpen}
          onOpenChange={(open) => {
            setImportGithubOpen(open);
            if (!open) {
              setImportGithubRow(null);
            }
          }}
        >
          <DialogContent
            size="lg"
            className="max-h-[92vh] max-w-lg"
            titleId="import-gh-col-title"
            descriptionId="import-gh-col-desc"
          >
            <DialogHeader>
              <h2
                id="import-gh-col-title"
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                Opprett prosess fra GitHub-kort
              </h2>
              <p
                id="import-gh-col-desc"
                className="text-muted-foreground line-clamp-3 text-sm"
              >
                {importGithubRow
                  ? importGithubRow.title.length > 180
                    ? `${importGithubRow.title.slice(0, 180)}…`
                    : importGithubRow.title
                  : "…"}
              </p>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="import-gh-name">
                    {prosessRegisterCopy.displayName.label}
                  </Label>
                  <Input
                    id="import-gh-name"
                    value={importGithubName}
                    onChange={(e) => setImportGithubName(e.target.value)}
                    className="h-11"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-gh-code">
                    {prosessRegisterCopy.referenceCode.label}
                  </Label>
                  <Input
                    id="import-gh-code"
                    value={importGithubCode}
                    onChange={(e) => setImportGithubCode(e.target.value)}
                    className="h-11 font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Titler som{" "}
                <code className="text-foreground bg-muted/60 rounded px-1 py-0.5 text-[11px]">
                  [P01] Prosessnavn
                </code>{" "}
                gir foreslått prosess-ID og navn. Juster før du lagrer — deretter kan du bruke
                prosessen i vurdering og ROS.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportGithubOpen(false);
                  setImportGithubRow(null);
                }}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={
                  importGithubBusy ||
                  !importGithubName.trim() ||
                  !importGithubCode.trim()
                }
                onClick={() => void confirmImportFromGithubColumn()}
              >
                {importGithubBusy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : null}
                Opprett prosess
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={issueFromGithubDialogOpen}
          onOpenChange={(open) => {
            setIssueFromGithubDialogOpen(open);
            if (!open) {
              setIssueImportPreview(null);
            }
          }}
        >
          <DialogContent
            size="lg"
            className="max-h-[92vh] max-w-lg"
            titleId="import-gh-issue-title"
            descriptionId="import-gh-issue-desc"
          >
            <DialogHeader>
              <h2
                id="import-gh-issue-title"
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                Opprett prosess fra GitHub-issue
              </h2>
              <p
                id="import-gh-issue-desc"
                className="text-muted-foreground text-sm"
              >
                {issueImportPreview ? (
                  <>
                    <span className="font-mono text-xs">
                      {issueImportPreview.repoFullName}#{issueImportPreview.issueNumber}
                    </span>
                    {" · "}
                    {issueImportPreview.title.length > 120
                      ? `${issueImportPreview.title.slice(0, 120)}…`
                      : issueImportPreview.title}
                  </>
                ) : (
                  "…"
                )}
              </p>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="import-gh-issue-name">
                    {prosessRegisterCopy.displayName.label}
                  </Label>
                  <Input
                    id="import-gh-issue-name"
                    value={issueImportName}
                    onChange={(e) => setIssueImportName(e.target.value)}
                    className="h-11"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-gh-issue-code">
                    {prosessRegisterCopy.referenceCode.label}
                  </Label>
                  <Input
                    id="import-gh-issue-code"
                    value={issueImportCode}
                    onChange={(e) => setIssueImportCode(e.target.value)}
                    className="h-11 font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
              {issueImportPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 self-start text-xs"
                  onClick={() =>
                    void openGhPreview(
                      issueImportPreview.repoFullName,
                      issueImportPreview.issueNumber,
                    )
                  }
                >
                  <Eye className="size-3.5" aria-hidden />
                  Vis detaljer fra GitHub
                </Button>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIssueFromGithubDialogOpen(false);
                  setIssueImportPreview(null);
                }}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={
                  issueImportBusy ||
                  !issueImportName.trim() ||
                  !issueImportCode.trim()
                }
                onClick={() => void confirmCreateFromGithubIssue()}
              >
                {issueImportBusy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : null}
                Opprett prosess
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editCandidateId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditCandidateId(null);
            }
          }}
        >
          <DialogContent
            size="2xl"
            className="max-h-[92vh] max-w-3xl"
            titleId="edit-process-title"
            descriptionId="edit-process-desc"
          >
            <DialogHeader>
              <h2
                id="edit-process-title"
                className="text-foreground text-lg font-semibold tracking-tight"
              >
                {canEditCandidates ? "Rediger prosess" : "Vis prosess"}
              </h2>
              <p id="edit-process-desc" className="text-muted-foreground text-sm">
                {editingCandidate
                  ? `${editingCandidate.code} · ${editingCandidate.name}`
                  : "…"}
              </p>
            </DialogHeader>
            <DialogBody>
              {editingCandidate ? (
                <WorkspaceCandidateRow
                  key={`${editingCandidate._id}-${editingCandidate.updatedAt}`}
                  as="div"
                  workspaceId={workspaceId}
                  candidate={editingCandidate}
                  orgUnits={orgUnits}
                  isAdmin={isAdmin}
                  canEdit={Boolean(canEditCandidates)}
                  onUpdate={updateCandidate}
                  onRemove={removeCandidate}
                  syncGithubDraft={(cid) =>
                    syncCandidateGithubDraft({ candidateId: cid })
                  }
                  describeGithubItem={(cid) =>
                    describeGithubProjectItemForCandidate({ candidateId: cid })
                  }
                  githubProject={{
                    enabled: Boolean(w.githubProjectNodeId?.trim()),
                    loading: githubProjectStatus.loading,
                    error: githubProjectStatus.error,
                    statusOptions: githubProjectStatus.options,
                    statusFieldName: githubProjectStatus.fieldName,
                    onReload: () => reloadGithubProjectStatus(true),
                    register: (candidateId, statusOptionId) =>
                      registerCandidateToGithubProject({
                        candidateId,
                        statusOptionId,
                      }),
                    createRepoIssue:
                      canCreateGithubRepoIssue
                        ? (candidateId, statusOptionId) =>
                            createGithubRepoIssueForCandidate({
                              candidateId,
                              statusOptionId,
                            })
                        : undefined,
                    updateStatus: (candidateId, statusOptionId) =>
                      updateCandidateGithubProjectStatus({
                        candidateId,
                        statusOptionId,
                      }),
                    remove: (candidateId) =>
                      removeCandidateFromGithubProject({ candidateId }),
                  }}
                  importFromGithub={(cid) =>
                    importPvvFieldsFromGithubProjectItem({ candidateId: cid })
                  }
                />
              ) : null}
            </DialogBody>
          </DialogContent>
        </Dialog>

        {candidates.length === 0 && approvedIntakeForProcessregister.length === 0 ? (
          <div
            data-tutorial-anchor="prosess-oversikt-liste"
            className="flex flex-col items-center rounded-2xl bg-muted/15 px-6 py-14 text-center"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <Users className="text-emerald-600 dark:text-emerald-400 size-6" aria-hidden />
            </div>
            <p className="text-foreground text-base font-semibold">
              Ingen prosesser eller skjemavurderinger ennå
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xs text-sm">
              Opprett prosess manuelt, importer fra GitHub, eller bruk skjemaer for å samle forslag
              som blir vurderinger.
            </p>
            <div className="mt-6 flex gap-3">
              {canEditCandidates ? (
                <Button
                  type="button"
                  className="h-10 gap-2 rounded-xl px-5 shadow-sm"
                  onClick={() => setNewProcessOpen(true)}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  Ny prosess
                </Button>
              ) : null}
              {hubMode ? (
                <Link
                  href={`/w/${workspaceId}/vurderinger`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-10 rounded-xl px-5",
                  )}
                >
                  Gå til vurderinger
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WorkspaceAssessmentsPanel({
  workspaceId,
  hubMode = false,
  approvedIntakeForProcessregister,
}: {
  workspaceId: Id<"workspaces">;
  hubMode?: boolean;
  /** Samme data som Prosessregister — for «Skjema»-merke på vurderingskort. */
  approvedIntakeForProcessregister?:
    | undefined
    | ApprovedIntakeProcessregisterRow[];
}) {
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const deleteAssessment = useMutation(api.assessments.deleteAssessment);

  const intakeAssessmentIdSet = useMemo(() => {
    const rows = approvedIntakeForProcessregister ?? [];
    return new Set(rows.map((r) => r.approvedAssessmentId));
  }, [approvedIntakeForProcessregister]);

  const canEditPipeline =
    membership !== undefined &&
    membership !== null &&
    membership.role !== "viewer";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | "all">(
    "all",
  );
  const [sortBy, setSortBy] = useState<
    "priority" | "updated" | "ap" | "criticality" | "ease"
  >("priority");

  const filteredAssessments = useMemo(() => {
    let rows = assessments ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      rows = rows.filter(
        (a) => normalizePipelineStatus(a.pipelineStatus) === statusFilter,
      );
    }
    const copy = [...rows];
    switch (sortBy) {
      case "priority":
        copy.sort((a, b) => {
          const d =
            effectiveAssessmentPriority(b) - effectiveAssessmentPriority(a);
          if (d !== 0) return d;
          return b.updatedAt - a.updatedAt;
        });
        break;
      case "updated":
        copy.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case "ap":
        copy.sort((a, b) => {
          const x = a.cachedAp ?? -1;
          const y = b.cachedAp ?? -1;
          return y - x;
        });
        break;
      case "criticality":
        copy.sort((a, b) => {
          const x = a.cachedCriticality ?? -1;
          const y = b.cachedCriticality ?? -1;
          return y - x;
        });
        break;
      case "ease":
        copy.sort((a, b) => {
          const x = a.cachedEase ?? -1;
          const y = b.cachedEase ?? -1;
          return y - x;
        });
        break;
      default:
        break;
    }
    return copy;
  }, [assessments, search, statusFilter, sortBy]);

  const priorityDistribution = useMemo(() => {
    let high = 0;
    let mid = 0;
    let low = 0;
    for (const row of filteredAssessments) {
      const p = effectiveAssessmentPriority(row);
      if (p >= 70) high += 1;
      else if (p >= 45) mid += 1;
      else low += 1;
    }
    return { high, mid, low };
  }, [filteredAssessments]);

  if (workspace === undefined || assessments === undefined) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }
  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const hasActiveFilter =
    search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="space-y-6">
      <GithubIssueStartCard workspaceId={workspaceId} variant="assessment" />

      <section
        className="space-y-3"
        role="region"
        aria-labelledby="vurderinger-liste-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="vurderinger-liste-heading"
            className="text-foreground text-lg font-semibold tracking-tight"
          >
            {assessments.length === 0 ? (
              "Dine vurderinger"
            ) : (
              <>
                Dine vurderinger
                <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
                  ({assessments.length})
                </span>
              </>
            )}
          </h2>
        </div>

        {assessments.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk …"
                className="bg-background h-10 rounded-xl pl-10 pr-3 text-sm shadow-sm md:pl-10 md:pr-3"
                aria-label="Søk i vurderinger"
              />
            </div>
            <div className="flex gap-2">
              <select
                id="assessment-sort"
                className="border-input bg-background h-10 min-w-0 flex-1 rounded-xl border px-3 text-xs shadow-sm sm:flex-none sm:text-sm"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "priority"
                      | "updated"
                      | "ap"
                      | "criticality"
                      | "ease",
                  )
                }
              >
                <option value="priority">Prioritet</option>
                <option value="ap">Gevinst (AP)</option>
                <option value="criticality">Viktighet</option>
                <option value="ease">Implementering</option>
                <option value="updated">Sist oppdatert</option>
              </select>
              <select
                id="assessment-status-filter"
                className="border-input bg-background h-10 min-w-0 flex-1 rounded-xl border px-3 text-xs shadow-sm sm:flex-none sm:text-sm"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as PipelineStatus | "all")
                }
              >
                <option value="all">Alle statuser</option>
                {PIPELINE_KANBAN_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {PIPELINE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {assessments.length > 0 &&
        filteredAssessments.length > 0 &&
        hasActiveFilter ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="tabular-nums">{filteredAssessments.length} treff</span>
            <span className="text-border">·</span>
            <span className="text-emerald-800 dark:text-emerald-200">
              Høy {priorityDistribution.high}
            </span>
            <span className="text-amber-800 dark:text-amber-200">
              Mid. {priorityDistribution.mid}
            </span>
            <span>Lav {priorityDistribution.low}</span>
          </div>
        ) : null}

        {assessments.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-muted/15 px-6 py-14 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="text-primary size-6" aria-hidden />
            </div>
            <p className="text-foreground text-base font-semibold">
              Ingen vurderinger ennå
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xs text-sm">
              Bruk «Ny vurdering» over.
            </p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-muted/10 px-6 py-10 text-center">
            <Search className="text-muted-foreground mb-2 size-5" aria-hidden />
            <p className="text-muted-foreground text-sm">
              Ingen treff — prøv et annet søk eller fjern filter.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredAssessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = effectiveAssessmentPriority(a);
              const ap = a.cachedAp;
              const crit = a.cachedCriticality;
              const band = priorityBandLabel(prio);
              const hasModelScores =
                ap !== undefined &&
                ap !== null &&
                crit !== undefined &&
                crit !== null &&
                Number.isFinite(ap) &&
                Number.isFinite(crit);
              return (
                <li key={a._id} className="group/card relative">
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08] active:scale-[0.995] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]",
                      "border-l-[3px]",
                      priorityBorderAccentClass(prio),
                    )}
                  >
                    <Link
                      href={`/w/${workspaceId}/a/${a._id}`}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Åpne vurdering: ${a.title}`}
                    />
                    <div className="pointer-events-none relative z-10 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="group-hover/card:text-primary min-w-0 text-sm font-semibold leading-snug transition-colors line-clamp-2">
                            {a.title}
                          </p>
                          {intakeAssessmentIdSet.has(a._id) ? (
                            <Badge
                              variant="outline"
                              className="pointer-events-none border-primary/25 bg-primary/5 text-[10px] font-medium text-primary"
                            >
                              Fra skjema
                            </Badge>
                          ) : null}
                        </div>
                        <div className="pointer-events-auto shrink-0">
                          {canEditPipeline ? (
                            <PipelineStatusSelect
                              assessmentId={a._id}
                              value={pipeline}
                              compact
                            />
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium"
                            >
                              {PIPELINE_STATUS_LABELS[pipeline]}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground text-xl font-bold tabular-nums leading-none">
                            {prio.toFixed(0)}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            / 100
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border font-medium text-[10px]",
                            priorityBandBadgeClass(prio),
                          )}
                        >
                          {band.short}
                        </Badge>
                        <div
                          className="bg-muted/70 h-1.5 flex-1 overflow-hidden rounded-full"
                          role="presentation"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              priorityFillClass(prio),
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, prio))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {hasModelScores ? (
                        <AssessmentListScoresCompact
                          ap={ap!}
                          crit={crit!}
                          ease={a.cachedEase}
                          easeLabel={a.cachedEaseLabel}
                        />
                      ) : (
                        <p className="text-muted-foreground bg-muted/20 rounded-md px-2 py-1.5 text-[11px] leading-snug">
                          Fullfør veiviseren for poeng.
                        </p>
                      )}

                      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                        <span
                          title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                        >
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </span>
                        <span className="group-hover/card:text-primary inline-flex items-center gap-0.5 font-medium transition-colors">
                          Åpne
                          <ChevronRight
                            className="size-3.5 transition-transform group-hover/card:translate-x-0.5"
                            aria-hidden
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
                    title="Slett vurdering"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !window.confirm(
                          `Slette «${a.title}»?\n\nAlle data fjernes permanent.`,
                        )
                      ) {
                        return;
                      }
                      void (async () => {
                        try {
                          await deleteAssessment({ assessmentId: a._id });
                          toast.success("Vurdering slettet.");
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Kunne ikke slette vurderingen.",
                          );
                        }
                      })();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
