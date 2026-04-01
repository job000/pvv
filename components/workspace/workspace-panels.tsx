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
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

function AssessmentListMetricBar({
  label,
  value,
  icon: Icon,
  barClass,
}: {
  label: string;
  value: number | null | undefined;
  icon: LucideIcon;
  barClass: string;
}) {
  const pct =
    value == null || !Number.isFinite(value)
      ? null
      : Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-medium">
          <Icon
            className="text-muted-foreground/85 size-3.5 shrink-0"
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </span>
        {pct != null ? (
          <span className="text-foreground shrink-0 tabular-nums font-semibold">
            {pct.toFixed(0)}%
          </span>
        ) : (
          <span className="text-muted-foreground shrink-0">—</span>
        )}
      </div>
      <div
        className="bg-muted/70 h-1.5 overflow-hidden rounded-full ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        aria-hidden
      >
        {pct != null ? (
          <div
            className={cn("h-full rounded-full transition-[width]", barClass)}
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
    </div>
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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";

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
        r.kind === "linked"
          ? "Bruker lagt til."
          : "Invitasjon registrert (aktiveres når brukeren logger inn med e-posten).",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invitasjon feilet.");
    }
  }

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Team og tilgang</CardTitle>
            <CardDescription>
              Inviter via e-post — brukere som allerede finnes i systemet legges
              inn med en gang. Ventende invitasjoner kan trekkes tilbake når som
              helst.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="invite-email">E-post</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="kollega@firma.no"
                />
              </div>
              <div className="w-full space-y-2 sm:w-44">
                <Label htmlFor="invite-role">Rolle</Label>
                <select
                  id="invite-role"
                  className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value as "admin" | "member" | "viewer",
                    )
                  }
                >
                  <option value="admin">Administrator</option>
                  <option value="member">Medlem</option>
                  <option value="viewer">Kun visning</option>
                </select>
              </div>
              <Button type="button" onClick={() => void sendInvite()}>
                Inviter
              </Button>
            </div>
            <Separator />
            <div>
              <p className="text-foreground mb-2 text-sm font-medium">
                Ventende invitasjoner
              </p>
              {pendingInvites === undefined ? (
                <p className="text-muted-foreground text-sm">Laster …</p>
              ) : pendingInvites.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Ingen ventende invitasjoner.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <li
                      key={inv._id}
                      className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-muted-foreground text-xs">
                          {WORKSPACE_ROLE_LABEL_NB[inv.role] ?? inv.role} ·{" "}
                          {new Date(inv.createdAt).toLocaleString("nb-NO", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void cancelWorkspaceInvite({ inviteId: inv._id })
                        }
                      >
                        Trekk invitasjon
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-foreground mb-2 text-sm font-medium">
                Medlemmer
              </p>
              <ul className="space-y-3">
                {members.map((m) => (
                  <li
                    key={m._id}
                    className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {m.name ?? m.email ?? m.userId}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {m.email ?? "—"} ·{" "}
                        <span className="text-foreground/90">
                          {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-1 max-w-prose text-[11px] leading-snug">
                        {WORKSPACE_ROLE_DESC_NB[m.role] ?? ""}
                      </p>
                    </div>
                    {m.role !== "owner" ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="border-input h-8 rounded-md border bg-background px-2 text-xs"
                          value={m.role}
                          onChange={(e) => {
                            const next = e.target.value as
                              | "admin"
                              | "member"
                              | "viewer";
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
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void removeMember({
                              workspaceId,
                              targetUserId: m.userId,
                            })
                          }
                        >
                          Fjern fra område
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {WORKSPACE_ROLE_DESC_NB.owner}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-muted/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Roller i arbeidsområdet</CardTitle>
            <CardDescription>
              Kort forklaring — samme roller brukes i hele arbeidsområdet.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            {(Object.keys(WORKSPACE_ROLE_DESC_NB) as Array<keyof typeof WORKSPACE_ROLE_DESC_NB>)
              .filter((k) => k !== "owner")
              .map((k) => (
                <p key={k}>
                  <strong className="text-foreground">
                    {WORKSPACE_ROLE_LABEL_NB[k]}:
                  </strong>{" "}
                  {WORKSPACE_ROLE_DESC_NB[k]}
                </p>
              ))}
            <p>
              <strong className="text-foreground">Eier:</strong>{" "}
              {WORKSPACE_ROLE_DESC_NB.owner}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

    return (
    <Card>
      <CardHeader>
        <CardTitle>Team og tilgang</CardTitle>
        <CardDescription>
          Hvem som er med i arbeidsområdet. Ta kontakt med en administrator hvis
          du trenger annen rolle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m._id} className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">
                {m.name ?? m.email ?? m.userId}
              </span>{" "}
              · {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function WorkspaceCandidatesPanel({
  workspaceId,
  hubMode = false,
}: {
  workspaceId: Id<"workspaces">;
  /** Når true: vist under PVV-hub med tydeligere forklaring og layout */
  hubMode?: boolean;
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
    workspace === undefined
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
      className={
        hubMode
          ? "overflow-hidden border-emerald-500/25 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
          : undefined
      }
    >
      <CardHeader
        data-tutorial-anchor={
          hubMode ? "prosess-oversikt-header" : undefined
        }
        className={hubMode ? "border-b border-border/50 pb-4" : "pb-4"}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/10 flex size-9 items-center justify-center rounded-xl">
              <Users className="text-emerald-600 dark:text-emerald-400 size-4.5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg">Prosessregister</CardTitle>
              {!canEditCandidates ? (
                <p className="text-muted-foreground text-xs">Lesertilgang</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hubMode ? (
              <span className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                {candidates.length}{" "}
                {candidates.length === 1 ? "prosess" : "prosesser"}
              </span>
            ) : null}
            {!hubMode ? (
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
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={hubMode ? "space-y-5 pt-4" : "space-y-5 pt-4"}>
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
        {!w.githubProjectNodeId?.trim() ? (
          <div
            data-tutorial-anchor="github-varsling"
            className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2"
            role="status"
          >
            <AlertTriangle className="text-amber-500 size-4 shrink-0" aria-hidden />
            <p className="text-foreground min-w-0 flex-1 text-xs">
              GitHub-prosjekt ikke koblet.{" "}
              {isAdmin ? (
                <Link
                  href={`/w/${workspaceId}/innstillinger#github-arbeidsomrade`}
                  className="text-primary font-medium underline-offset-2 hover:underline"
                >
                  Konfigurer
                </Link>
              ) : (
                <span className="text-muted-foreground">
                  Be administrator koble prosjekt.
                </span>
              )}
            </p>
          </div>
        ) : null}
        {canEditCandidates ? (
          <div
            data-tutorial-anchor="github-prosess"
            className="rounded-lg border border-border/50 bg-muted/5 p-3"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <GitBranch className="text-muted-foreground size-3.5" aria-hidden />
              <h2 className="text-foreground text-sm font-semibold">
                Importer fra GitHub
              </h2>
            </div>

            {w.githubProjectNodeId?.trim() ? (
              <div
                className="mb-2.5 flex gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5"
                role="tablist"
                aria-label="Importkilde"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={githubImportTab === "issue"}
                  className={cn(
                    "flex-1 rounded px-2.5 py-1.5 text-center text-xs font-medium transition-colors",
                    githubImportTab === "issue"
                      ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
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
                    "flex-1 rounded px-2.5 py-1.5 text-center text-xs font-medium transition-colors",
                    githubImportTab === "column"
                      ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setGithubImportTab("column")}
                >
                  Prosjektkolonne
                </button>
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
                    className="h-9 min-w-0 flex-1 font-mono text-xs"
                    autoComplete="off"
                    aria-label="Issue-URL"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    disabled={issueUrlFetchBusy || !issueGithubUrlInput.trim()}
                    onClick={() => void fetchGithubIssueForImport()}
                  >
                    {issueUrlFetchBusy ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <ExternalLink className="size-3.5" aria-hidden />
                    )}
                    Hent
                  </Button>
                </div>
                {issueUrlFetchError ? (
                  <p className="text-destructive mt-1.5 text-xs" role="alert">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[12rem] flex-1">
                  <Label htmlFor="gh-column-pick" className="sr-only">
                    Statuskolonne i GitHub-prosjekt
                  </Label>
                  <select
                    id="gh-column-pick"
                    className="border-input bg-background h-10 w-full max-w-md rounded-lg border border-border/80 px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={columnPickId}
                    onChange={(e) => setColumnPickId(e.target.value)}
                  >
                    <option value="">— Velg kolonne —</option>
                    {githubProjectStatus.options?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 gap-2"
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
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  <strong className="text-foreground">{columnItemsResult.optionName}</strong>{" "}
                  · {columnItemsResult.items.length} kort
                </p>
                <div className="max-h-[min(32rem,60vh)] space-y-1.5 overflow-y-auto">
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

                    return (
                      <div
                        key={row.projectItemId}
                        role={canPreview ? "button" : undefined}
                        tabIndex={canPreview ? 0 : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                          canPreview && "cursor-pointer",
                          linked
                            ? "border-border/30 bg-muted/20"
                            : "border-border/50 bg-card hover:border-border",
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
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground text-sm font-medium leading-snug">
                            {row.title}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[10px] font-medium uppercase tracking-wide",
                                row.contentKind === "issue"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : row.contentKind === "pull_request"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-muted-foreground",
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
                                className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-900 dark:text-emerald-100"
                              >
                                I PVV
                              </Badge>
                            ) : null}
                            {hasRos ? (
                              <Badge
                                variant="secondary"
                                className="h-4 border-sky-500/30 bg-sky-500/10 px-1.5 text-[10px] text-sky-950 dark:text-sky-100"
                              >
                                ROS
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        {!linked ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-xs opacity-80 group-hover:opacity-100"
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
            ) : columnItemsResult && columnItemsResult.items.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Ingen kort i denne kolonnen.
              </p>
            ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
        {candidates.length > 0 ? (
          <section
            data-tutorial-anchor="prosess-oversikt-liste"
            className="space-y-3"
            aria-labelledby="process-overview-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="process-overview-heading"
                className="text-foreground font-heading text-base font-semibold tracking-tight"
              >
                {candidates.length} prosess{candidates.length !== 1 ? "er" : ""}
              </h2>
              {canEditCandidates ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 shadow-sm"
                  onClick={() => setNewProcessOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  Ny prosess
                </Button>
              ) : null}
            </div>
            <div className="border-border/80 overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 border-border/60 border-b text-xs uppercase tracking-wide">
                    <th className="text-foreground px-3 py-2.5 font-semibold">
                      Prosess-ID
                    </th>
                    <th className="text-foreground px-3 py-2.5 font-semibold">
                      Navn
                    </th>
                    <th className="text-foreground hidden px-3 py-2.5 font-semibold sm:table-cell">
                      Organisasjon
                    </th>
                    <th className="text-foreground px-3 py-2.5 font-semibold">
                      GitHub
                    </th>
                    {canEditCandidates ? (
                      <th className="text-foreground w-14 px-2 py-2.5 text-right font-semibold">
                        <span className="sr-only">Slett</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {candidatesSorted.map((c) => (
                    <tr
                      key={c._id}
                      className="border-border/40 hover:bg-muted/40 cursor-pointer border-b transition-colors"
                      onClick={() => setEditCandidateId(c._id)}
                    >
                      <td className="text-foreground px-3 py-2.5 font-mono text-xs font-semibold">
                        {c.code}
                      </td>
                      <td className="text-foreground max-w-[14rem] truncate px-3 py-2.5">
                        {c.name}
                      </td>
                      <td className="text-muted-foreground hidden max-w-[12rem] truncate px-3 py-2.5 text-xs sm:table-cell">
                        {candidateOrgUnitLabel(c, orgUnits)}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.githubProjectItemNodeId ? (
                          c.githubRepoFullName &&
                          c.githubIssueNumber != null &&
                          c.githubIssueNumber > 0 ? (
                            <Badge
                              variant="secondary"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 cursor-pointer hover:bg-emerald-500/20 dark:text-emerald-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openGhPreview(
                                  c.githubRepoFullName!,
                                  c.githubIssueNumber!,
                                );
                              }}
                            >
                              I prosjekt
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                            >
                              I prosjekt
                            </Badge>
                          )
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Ikke i prosjekt
                            </Badge>
                            {canEditCandidates && canQuickAddGithubCard ? (
                              <div
                                className="flex max-w-[min(100%,15rem)] flex-col gap-1.5 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 gap-1.5 px-2.5 text-xs"
                                  disabled={rowGithubBusyId === c._id}
                                  aria-label={`Legg til ${c.code} som utkast i GitHub-tavle`}
                                  title="Prosjektkort (utkast) i GitHub Projects"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void registerOneFromOverviewTable(c._id);
                                  }}
                                >
                                  {rowGithubBusyId === c._id ? (
                                    <Loader2
                                      className="size-3.5 shrink-0 animate-spin"
                                      aria-hidden
                                    />
                                  ) : (
                                    <GitBranch className="size-3.5" aria-hidden />
                                  )}
                                  Utkast i tavle
                                </Button>
                                {canCreateGithubRepoIssue ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 px-2.5 text-xs"
                                    disabled={rowGithubBusyId === c._id}
                                    aria-label={`Opprett GitHub-issue for ${c.code}`}
                                    title="Ekte issue i standard-repo, lagt i tavle og synket fra PVV"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void registerRepoIssueFromOverviewTable(
                                        c._id,
                                      );
                                    }}
                                  >
                                    {rowGithubBusyId === c._id ? (
                                      <Loader2
                                        className="size-3.5 shrink-0 animate-spin"
                                        aria-hidden
                                      />
                                    ) : (
                                      <Ticket className="size-3.5" aria-hidden />
                                    )}
                                    Issue i repo
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      {canEditCandidates ? (
                        <td className="px-2 py-2 text-right align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-9 shrink-0"
                            disabled={overviewDeleteBusyId === c._id}
                            aria-label={`Slett prosess ${c.code}`}
                            title="Slett prosess"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteCandidateFromOverview(c._id, c);
                            }}
                          >
                            {overviewDeleteBusyId === c._id ? (
                              <Loader2
                                className="size-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Trash2 className="size-4" aria-hidden />
                            )}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <ProcessCoverageOverview workspaceId={workspaceId} />

        {isAdmin &&
        w.githubProjectNodeId?.trim() &&
        githubProjectStatus.options &&
        githubProjectStatus.options.length > 0 ? (
          <section
            className="rounded-xl border border-border/50 bg-muted/10 p-4"
            aria-labelledby="auto-github-heading"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="text-muted-foreground size-4" aria-hidden />
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
                title="Nye prosesser registreres automatisk som utkast i GitHub-prosjekt. Velg standardstatus og lagre."
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

        {candidates.length === 0 ? (
          <div
            data-tutorial-anchor="prosess-oversikt-liste"
            className="rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-500/[0.03] px-6 py-12 text-center"
          >
            <div className="bg-muted/80 mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
              <Users className="text-muted-foreground size-6" aria-hidden />
            </div>
            <p className="text-foreground text-sm font-medium">
              Ingen prosesser ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              Trykk «Ny prosess» for å åpne skjemaet, eller gå til vurderinger og
              start en sak — der velger du prosess-ID i veiviseren.
            </p>
            <div className="mt-6 flex flex-col-reverse flex-wrap items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              {hubMode ? (
                <Link
                  href={`/w/${workspaceId}/vurderinger`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "inline-flex h-11 min-h-[44px] w-full justify-center px-4 text-[13px] font-medium sm:h-10 sm:min-h-0 sm:w-auto",
                  )}
                >
                  Gå til vurderinger
                </Link>
              ) : null}
              {canEditCandidates ? (
                <Button
                  type="button"
                  className="h-11 min-h-[44px] w-full gap-2 px-4 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:w-auto"
                  onClick={() => setNewProcessOpen(true)}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  Ny prosess
                </Button>
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
}: {
  workspaceId: Id<"workspaces">;
  hubMode?: boolean;
}) {
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const createAssessment = useMutation(api.assessments.create);
  const deleteAssessment = useMutation(api.assessments.deleteAssessment);

  const canEditPipeline =
    membership !== undefined &&
    membership !== null &&
    membership.role !== "viewer";

  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function handleCreate() {
    setBusy(true);
    try {
      const aid = await createAssessment({
        workspaceId,
        title: title.trim() || "Ny vurdering",
        shareWithWorkspace: true,
      });
      window.location.href = `/w/${workspaceId}/a/${aid}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {hubMode ? (
        <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3.5 text-[14px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:px-5">
          <p className="text-muted-foreground">
            <span className="text-foreground font-semibold">
              Ny prosess i registeret?
            </span>{" "}
            Legg den inn under{" "}
            <Link
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Prosessregister
            </Link>
            , så kan du velge prosess-ID i steg 1 i veiviseren.
          </p>
        </div>
      ) : null}
      <GithubIssueStartCard workspaceId={workspaceId} variant="assessment" />
      <Card className="overflow-hidden border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <CardHeader className="border-b border-border/40 bg-gradient-to-b from-muted/35 to-transparent pb-4 pt-5 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-primary/15">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                Ny sak
              </p>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Ny vurdering
              </CardTitle>
              <CardDescription className="text-[13px] leading-relaxed sm:text-sm">
                Gi saken et navn og gå rett til veiviseren. Utkast lagres
                fortløpende.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 border-t border-border/45 bg-muted/10 pt-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label
              className="text-muted-foreground text-xs font-medium"
              htmlFor="new-assessment-title"
            >
              Tittel på vurderingen
            </Label>
            <Input
              id="new-assessment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Fakturamottak fra leverandører"
              className="h-11 min-h-[44px] bg-background text-[16px] sm:h-10 sm:min-h-0 sm:text-sm"
              autoComplete="off"
            />
          </div>
          <Button
            className="h-11 min-h-[44px] w-full shrink-0 gap-2 px-5 text-[13px] font-semibold shadow-sm sm:h-10 sm:min-h-0 sm:w-auto"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            {busy ? "Oppretter …" : "Start vurdering"}
            <ChevronRight className="size-4 opacity-90" aria-hidden />
          </Button>
        </CardFooter>
      </Card>

      <section
        className="space-y-5"
        role="region"
        aria-labelledby="vurderinger-liste-heading"
      >
        <div className="space-y-4">
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
              Register
            </p>
            <h2
              id="vurderinger-liste-heading"
              className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              Alle vurderinger
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-[13px] leading-relaxed sm:text-sm">
              {assessments.length === 0
                ? "Ingen saker i listen — opprett med kortet over."
                : `${assessments.length} ${assessments.length === 1 ? "vurdering" : "vurderinger"} på tvers av arbeidsområdet. Hver sak viser én samlet prioritering (0–100) og tre tydelige målinger som forklarer den.`}
            </p>
          </div>

          {assessments.length > 0 ? (
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/35 via-muted/15 to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-black/[0.03] dark:from-muted/25 dark:via-muted/10 dark:ring-white/[0.05] sm:p-5">
              <p className="text-foreground text-[13px] font-semibold leading-snug">
                Slik leser du listen
              </p>
              <ul className="text-muted-foreground mt-3 grid gap-3 text-[12px] leading-relaxed sm:grid-cols-3">
                <li className="flex gap-2.5">
                  <span className="bg-sky-500/18 text-sky-800 dark:text-sky-100 flex size-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-sky-500/25">
                    AP
                  </span>
                  <span>
                    <strong className="text-foreground">Gevinst</strong> — hvor
                    stort automatiseringspotensialet er.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="bg-rose-500/18 text-rose-900 dark:text-rose-100 flex size-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-rose-500/25">
                    VK
                  </span>
                  <span>
                    <strong className="text-foreground">Alvor</strong> — hvor
                    viktig saken er for personvern og konsekvenser.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="bg-violet-500/18 text-violet-900 dark:text-violet-100 flex size-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-violet-500/25">
                    IM
                  </span>
                  <span>
                    <strong className="text-foreground">Gjennomføring</strong>{" "}
                    — hvor enkelt tiltaket er å få på plass.
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
        </div>

        {assessments.length > 0 ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="relative min-w-0 flex-1 lg:min-w-[min(100%,18rem)]">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk i tittel …"
                className="border-border/60 bg-background h-11 min-h-[44px] rounded-2xl pl-9 text-[16px] shadow-sm sm:h-10 sm:min-h-0 sm:text-sm"
                aria-label="Søk i vurderinger"
              />
            </div>
            <div className="grid w-full min-w-0 items-center gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:max-w-none lg:grid-cols-none">
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="assessment-sort"
                  className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
                >
                  Sorter
                </Label>
                <select
                  id="assessment-sort"
                  className="border-border/60 bg-background h-11 min-h-[44px] w-full rounded-2xl border px-3 text-[13px] shadow-sm sm:h-10 sm:min-h-0 sm:text-sm"
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
                  <option value="priority">
                    Prioritet (portefølje, høy → lav)
                  </option>
                  <option value="ap">
                    Automatiseringspotensial (AP, høy → lav)
                  </option>
                  <option value="criticality">
                    Viktighet / konsekvens (høy → lav)
                  </option>
                  <option value="ease">
                    Implementering (enklest først)
                  </option>
                  <option value="updated">Sist oppdatert</option>
                </select>
              </div>
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="assessment-status-filter"
                  className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
                >
                  Status
                </Label>
                <select
                  id="assessment-status-filter"
                  className="border-border/60 bg-background h-11 min-h-[44px] w-full rounded-2xl border px-3 text-[13px] shadow-sm sm:h-10 sm:min-h-0 sm:text-sm"
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
          </div>
        ) : null}

        {assessments.length > 0 && filteredAssessments.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/45 bg-card/40 px-3 py-2.5 text-[12px] ring-1 ring-black/[0.03] dark:bg-card/25 dark:ring-white/[0.05]">
            <span className="text-muted-foreground font-medium">Treff</span>
            <span className="text-foreground font-bold tabular-nums">
              {filteredAssessments.length}
            </span>
            <span
              className="bg-border hidden h-4 w-px sm:inline-block"
              aria-hidden
            />
            <span className="text-muted-foreground font-medium">
              Fordeling på prioritet
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-0.5 font-semibold text-emerald-950 dark:text-emerald-100">
              Høy {priorityDistribution.high}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2.5 py-0.5 font-semibold text-amber-950 dark:text-amber-100">
              Middels {priorityDistribution.mid}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/10 px-2.5 py-0.5 font-semibold text-slate-800 dark:text-slate-200">
              Lavere {priorityDistribution.low}
            </span>
          </div>
        ) : null}

        {assessments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-500/20 bg-gradient-to-b from-primary/[0.03] to-transparent px-4 py-10 text-center ring-1 ring-primary/10 sm:px-6">
            <p className="text-foreground mx-auto max-w-md text-sm font-semibold">
              Ingen vurderinger ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-[13px] leading-relaxed sm:text-sm">
              <strong className="text-foreground font-medium">Vurdering</strong> er én sak om
              automatisering: skjema, pipeline-status og prioritering.{" "}
              <strong className="text-foreground font-medium">Prosessregisteret</strong> er den
              felles listen over prosesser med ID — valgfritt før du oppretter
              saken, men nyttig når flere saker skal bruke samme prosesskode.
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[13px] leading-relaxed sm:text-sm">
              <span className="text-foreground font-semibold">Neste steg:</span> fyll
              inn tittel i kortet over og velg{" "}
              <span className="text-foreground font-semibold">Start vurdering</span>.
            </p>
            <Link
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "mt-6 inline-flex h-11 min-h-[44px] w-full max-w-sm justify-center px-4 text-[13px] font-medium sm:h-10 sm:min-h-0 sm:w-auto",
              )}
            >
              Legg inn prosesser først (prosessregister)
            </Link>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            Ingen treff — prøv annet søk eller fjern filter.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
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
                      "bg-card hover:border-primary/40 relative overflow-hidden rounded-2xl border border-l-[4px] bg-gradient-to-br from-card via-card to-muted/15 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)] sm:p-4",
                      priorityBorderAccentClass(prio),
                    )}
                  >
                    {/*
                      Bakgrunnslenke: klikk går til vurdering. Innholdet har pointer-events-none
                      slik at select/badge ikke konkurrerer med lenken; interaktive elementer får pointer-events-auto.
                    */}
                    <Link
                      href={`/w/${workspaceId}/a/${a._id}`}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Åpne vurdering: ${a.title}`}
                    />
                    <div className="relative z-10 flex flex-col gap-3 pr-9 pointer-events-none sm:pr-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                        <span className="font-heading group-hover/card:text-primary line-clamp-2 min-w-0 text-base font-semibold leading-snug transition-colors sm:text-[0.9375rem]">
                          {a.title}
                        </span>
                        <div className="pointer-events-auto w-full shrink-0 sm:w-auto">
                          {canEditPipeline ? (
                            <PipelineStatusSelect
                              assessmentId={a._id}
                              value={pipeline}
                              compact
                            />
                          ) : (
                            <Badge
                              variant="secondary"
                              className="inline-flex max-w-full truncate text-xs font-medium sm:max-w-[9rem] sm:text-[10px]"
                            >
                              {PIPELINE_STATUS_LABELS[pipeline]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground flex items-start gap-2 text-xs leading-snug">
                        <Shield
                          className="mt-0.5 size-3.5 shrink-0 opacity-80"
                          aria-hidden
                        />
                        <span className="line-clamp-2">{compliancePlainLine(a)}</span>
                      </div>

                      <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/30 to-muted/10 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:from-muted/25 dark:to-muted/5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                              Porteføljeprioritet
                            </p>
                            <p className="text-foreground font-heading text-3xl font-bold tabular-nums leading-none tracking-tight">
                              {prio.toFixed(1)}
                              <span className="text-muted-foreground ml-1.5 text-sm font-normal">
                                / 100
                              </span>
                            </p>
                            <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                              {band.label}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 border font-semibold",
                              priorityBandBadgeClass(prio),
                            )}
                          >
                            {band.short}
                          </Badge>
                        </div>
                        <div
                          className="bg-muted/80 mt-3 h-2.5 overflow-hidden rounded-full shadow-inner"
                          role="presentation"
                          aria-label={`${prio.toFixed(0)} av 100 poeng`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                              priorityFillClass(prio),
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, prio))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {hasModelScores ? (
                        <div className="space-y-2.5">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                            Underliggende målinger
                          </p>
                          <AssessmentListMetricBar
                            label="Automatiseringspotensial (AP)"
                            value={ap}
                            icon={Zap}
                            barClass="bg-sky-500"
                          />
                          <AssessmentListMetricBar
                            label="Viktighet og konsekvens"
                            value={crit}
                            icon={AlertTriangle}
                            barClass="bg-rose-500"
                          />
                          {a.cachedEase != null &&
                          Number.isFinite(a.cachedEase) ? (
                            <AssessmentListMetricBar
                              label={
                                a.cachedEaseLabel != null
                                  ? `Implementering (${a.cachedEaseLabel})`
                                  : "Implementering"
                              }
                              value={a.cachedEase}
                              icon={Wrench}
                              barClass="bg-violet-500"
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/15 px-3 py-2.5 text-[12px] leading-relaxed">
                          <p className="text-foreground font-medium">
                            Mangler PVV-data
                          </p>
                          <p className="mt-1">
                            Fullfør skjemaet i veiviseren for å beregne poeng,
                            søyler og prioritering.
                          </p>
                        </div>
                      )}

                      <div className="text-muted-foreground flex min-w-0 items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-[11px] leading-snug">
                        <span
                          title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                        >
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground group-hover/card:text-primary">
                          Åpne
                          <ChevronRight
                            className="size-3.5 opacity-80"
                            aria-hidden
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto absolute right-1.5 top-1.5 z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground/70 opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:right-2 sm:top-2 sm:size-8 sm:min-h-0 sm:min-w-0 sm:opacity-0 sm:group-hover/card:opacity-100"
                    title="Slett vurdering"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !window.confirm(
                          `Slette «${a.title}»?\n\nAlle utkast, versjoner, oppgaver, kommentarer og koblinger fjernes permanent.`,
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
                    <Trash2 className="size-4 sm:size-3.5" />
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
