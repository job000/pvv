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
import { NativeSelectField } from "@/components/ui/native-select-field";
import { SearchInput } from "@/components/ui/search-input";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Label } from "@/components/ui/label";
import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/app-toast";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ListViewMode } from "@/lib/list-view-mode";
import { isEmptyRichText } from "@/lib/rich-text";
import { useStickyState } from "@/lib/use-sticky-state";

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
  effectiveAssessmentPriority,
  formatRelativeUpdatedAt,
  priorityFillClass,
} from "@/lib/assessment-ui-helpers";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Tag,
  Ticket,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { parseSuggestedCodeAndNameFromGithubTitle } from "@/lib/github-process-title";
import {
  orgSubtreeIds,
  orgUnitSearchLabel,
} from "@/lib/org-unit-filter";
import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import { WORKSPACE_ROLE_LABEL_NB } from "@/lib/role-labels-nb";
import { GithubIssueStartCard } from "@/components/github/github-issue-start-card";
import { WorkspaceCandidateRow } from "./workspace-candidate-row";
import { WorkspaceGithubIntegrationCard } from "./workspace-github-integration-card";
import { ProcessCoverageOverview } from "./process-coverage-overview";
import { ProsessregisterHubLead } from "./prosessregister-hub-lead";

/** Rad fra `listGithubProjectItemsInStatusColumn` — brukt i prosessregister-UI. */
type GithubColumnItemRow = {
  projectItemId: string;
  contentKind: "draft_issue" | "issue" | "pull_request" | "unknown";
  title: string;
  issueUrl?: string;
  issueNumber?: number;
  repoFullName?: string;
  issueNodeId?: string;
  /** GraphQL node-id for DraftIssue — brukes til forhåndsvisning */
  draftIssueId?: string;
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

function filterGithubColumnItems(
  items: GithubColumnItemRow[],
  query: string,
): GithubColumnItemRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((row) => {
    const hay = [
      row.title,
      row.repoFullName ?? "",
      row.issueNumber != null ? String(row.issueNumber) : "",
      row.issueNumber != null ? `#${row.issueNumber}` : "",
      githubColumnContentKindLabel(row.contentKind),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

const GITHUB_COLUMN_IMPORT_CACHE_VERSION = 1 as const;

type GithubColumnImportCacheV1 = {
  v: typeof GITHUB_COLUMN_IMPORT_CACHE_VERSION;
  projectNodeId: string;
  statusOptionId: string;
  fieldName: string;
  optionName: string;
  items: GithubColumnItemRow[];
  fetchedAt: number;
};

function githubColumnImportStorageKey(workspaceId: string) {
  return `pvv:githubColumnImport:v1:${workspaceId}`;
}

function isGithubColumnItemRow(x: unknown): x is GithubColumnItemRow {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const kind = o.contentKind;
  return (
    typeof o.projectItemId === "string" &&
    typeof kind === "string" &&
    (kind === "draft_issue" ||
      kind === "issue" ||
      kind === "pull_request" ||
      kind === "unknown") &&
    typeof o.title === "string"
  );
}

function readGithubColumnImportCache(
  workspaceId: string,
): GithubColumnImportCacheV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      githubColumnImportStorageKey(workspaceId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== GITHUB_COLUMN_IMPORT_CACHE_VERSION) return null;
    if (typeof o.projectNodeId !== "string" || !o.projectNodeId.trim()) {
      return null;
    }
    if (typeof o.statusOptionId !== "string" || !o.statusOptionId.trim()) {
      return null;
    }
    if (typeof o.fieldName !== "string" || typeof o.optionName !== "string") {
      return null;
    }
    if (typeof o.fetchedAt !== "number" || !Number.isFinite(o.fetchedAt)) {
      return null;
    }
    if (!Array.isArray(o.items) || !o.items.every(isGithubColumnItemRow)) {
      return null;
    }
    return {
      v: GITHUB_COLUMN_IMPORT_CACHE_VERSION,
      projectNodeId: o.projectNodeId.trim(),
      statusOptionId: o.statusOptionId.trim(),
      fieldName: o.fieldName,
      optionName: o.optionName,
      items: o.items as GithubColumnItemRow[],
      fetchedAt: o.fetchedAt,
    };
  } catch {
    return null;
  }
}

function writeGithubColumnImportCache(
  workspaceId: string,
  data: GithubColumnImportCacheV1,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      githubColumnImportStorageKey(workspaceId),
      JSON.stringify(data),
    );
  } catch {
    // lagringskvote / privat modus
  }
}

function clearGithubColumnImportCache(workspaceId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(githubColumnImportStorageKey(workspaceId));
  } catch {
    /* ignore */
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
      <div className="rounded-2xl border border-border/50 bg-card px-4 py-5 sm:px-5">
        <p className="text-sm text-muted-foreground">
          Kun administratorer kan endre navn og notater for arbeidsområdet.
        </p>
      </div>
    );
  }

  return (
    <>
    <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Arbeidsområde
        </h2>
        <p className="text-sm text-muted-foreground">
          Synlig for alle med tilgang.
        </p>
      </div>
      <div className="space-y-4">
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
        <Button
          type="button"
          className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          onClick={() => void saveWorkspaceSettings()}
        >
          Lagre
        </Button>
      </div>
    </section>

    <WorkspaceGithubIntegrationCard workspaceId={workspaceId} workspace={workspace} />

    {isOwner && workspace ? (
      <section className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Slett arbeidsområde
          </h2>
          <p className="text-sm text-muted-foreground">
            Alt innhold slettes permanent. Kan ikke angres.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 rounded-full border-destructive/40 px-5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setShowDeleteWorkspace(true)}
        >
          Slett …
        </Button>
      </section>
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
        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">
            Inviter bruker
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mottakeren godtar invitasjonen på sin oversikt.
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
              className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
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
              Ingen bruker med denne e-posten i Zorlin ennå. Etter innlogging kan vedkommende godta eller
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

        {(pendingUserInvites !== undefined && pendingUserInvites.length > 0) ||
        (pendingInvites !== undefined && pendingInvites.length > 0) ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Venter på svar
            </h3>
            <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
              {(pendingUserInvites ?? []).map((row) => (
                <li
                  key={row._id}
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-foreground">
                    {(row.name ?? row.email ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.name ?? row.email ?? row.userId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {WORKSPACE_ROLE_LABEL_NB[row.role] ?? row.role} · Sendt til bruker
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      void cancelWorkspaceUserInvite({ inviteId: row._id })
                    }
                  >
                    Trekk tilbake
                  </Button>
                </li>
              ))}
              {(pendingInvites ?? []).map((inv) => (
                <li
                  key={inv._id}
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-foreground">
                    {inv.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {WORKSPACE_ROLE_LABEL_NB[inv.role] ?? inv.role} · Venter på innlogging
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      void cancelWorkspaceInvite({ inviteId: inv._id })
                    }
                  >
                    Trekk tilbake
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Medlemmer ({members.length})
          </h3>
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
            {members.map((m) => (
              <li
                key={m._id}
                className="group/member flex items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-foreground">
                  {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name ?? m.email ?? m.userId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
                    {m.email ? ` · ${m.email}` : null}
                  </p>
                </div>
                {m.role !== "owner" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="border-input h-8 rounded-xl border bg-background px-2 text-xs"
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
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs text-muted-foreground hover:text-destructive"
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
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Medlemmer ({members.length})
      </h3>
      <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
        {members.map((m) => (
          <li key={m._id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-foreground">
              {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name ?? m.email ?? m.userId}
              </p>
              <p className="text-xs text-muted-foreground">
                {WORKSPACE_ROLE_LABEL_NB[m.role] ?? m.role}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Kontakt en administrator for å endre roller.
      </p>
    </section>
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
  initialOrgUnit,
  initialEditCandidateId = null,
  initialEditFullscreen = false,
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
  /** Valgfritt deep-link: filtrer prosesser til valgt enhet (inkludert underenheter). */
  initialOrgUnit?: Id<"orgUnits"> | null;
  /** Deep-link: åpne redigeringsdialog for prosess (`?rediger=`). */
  initialEditCandidateId?: Id<"candidates"> | null;
  /** Deep-link: start redigering i fullskjerm (`&fullskjerm=1`). */
  initialEditFullscreen?: boolean;
}) {
  const router = useRouter();
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, { workspaceId });
  /** Eksisterende query (alltid deployet) — ROS-kandidat-sett utledes i useMemo under. */
  const rosAnalysesForWorkspace = useQuery(api.ros.listAnalyses, {
    workspaceId,
  });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  /** Dekning PVV/ROS/PDD — brukes til status i hubMode (SMB: skjul, enterprise: vis). */
  const processCoverage = useQuery(
    api.candidates.listProcessCoverage,
    hubMode ? { workspaceId } : "skip",
  );
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
  const [processRegisterSearch, setProcessRegisterSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useStickyState<
    "all" | "missing_ros" | "missing_pvv" | "complete"
  >(`ws:${workspaceId}:processes:coverageFilter`, "all");
  const [orgUnitFilter, setOrgUnitFilter] = useStickyState<
    "" | Id<"orgUnits">
  >(`ws:${workspaceId}:processes:orgFilter`, initialOrgUnit ?? "");
  const [viewMode, setViewMode] = useStickyState<ListViewMode>(
    `ws:${workspaceId}:processes:view`,
    "cards",
  );
  const appliedOrgUnitRef = useRef(false);

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
    /** Kan mangle i eldre Convex-svar — bruk `?? []` i UI */
    comments?: {
      id: number;
      body: string;
      author: { login: string; avatarUrl: string } | null;
      createdAt: string;
      updatedAt: string;
    }[];
  };
  type DraftGithubPreviewData = {
    title: string;
    body: string | null;
    createdAt: string;
    updatedAt: string;
    creator: { login: string; avatarUrl: string } | null;
    draftIssueNodeId: string;
  };
  const [ghPreview, setGhPreview] = useState<GithubPreviewData | null>(null);
  const [draftGhPreview, setDraftGhPreview] =
    useState<DraftGithubPreviewData | null>(null);
  const [ghPreviewOpen, setGhPreviewOpen] = useState(false);
  const [ghPreviewLoading, setGhPreviewLoading] = useState(false);
  const previewGithubIssueAction = useAction(
    api.githubIssueImport.previewGithubIssue,
  );
  const previewGithubIssueByUrlAction = useAction(
    api.githubIssueImport.previewGithubIssueByUrl,
  );
  const previewGithubDraftIssueAction = useAction(
    api.githubProjectColumnItems.previewGithubDraftIssue,
  );

  const openGhPreview = useCallback(
    async (repoFullName: string, issueNumber: number) => {
      setDraftGhPreview(null);
      setGhPreviewLoading(true);
      setGhPreviewOpen(true);
      setGhPreview(null);
      try {
        const data = await previewGithubIssueAction({
          workspaceId,
          repoFullName,
          issueNumber,
        });
        setGhPreview({
          ...data,
          comments: Array.isArray(data.comments) ? data.comments : [],
        });
      } catch (err) {
        toast.error(
          formatUserFacingError(err, "Kunne ikke hente forhåndsvisning"),
        );
        setGhPreviewOpen(false);
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubIssueAction, workspaceId],
  );

  const openDraftGhPreview = useCallback(
    async (draftIssueNodeId: string) => {
      setGhPreview(null);
      setDraftGhPreview(null);
      setGhPreviewLoading(true);
      setGhPreviewOpen(true);
      try {
        const data = await previewGithubDraftIssueAction({
          workspaceId,
          draftIssueNodeId,
        });
        setDraftGhPreview(data);
      } catch (err) {
        toast.error(
          formatUserFacingError(err, "Kunne ikke hente utkast fra GitHub."),
        );
        setGhPreviewOpen(false);
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubDraftIssueAction, workspaceId],
  );

  const refreshDraftGhPreview = useCallback(
    async (draftIssueNodeId: string) => {
      setGhPreviewLoading(true);
      try {
        const data = await previewGithubDraftIssueAction({
          workspaceId,
          draftIssueNodeId,
        });
        setDraftGhPreview(data);
      } catch (err) {
        toast.error(
          formatUserFacingError(err, "Kunne ikke oppdatere utkast fra GitHub."),
        );
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubDraftIssueAction, workspaceId],
  );

  /** Hent siste issue/PR-data fra GitHub uten å lukke dialog (etter endringer på GitHub). */
  const refreshGhPreview = useCallback(
    async (repoFullName: string, issueNumber: number) => {
      setGhPreviewLoading(true);
      try {
        const data = await previewGithubIssueAction({
          workspaceId,
          repoFullName,
          issueNumber,
        });
        setGhPreview({
          ...data,
          comments: Array.isArray(data.comments) ? data.comments : [],
        });
      } catch (err) {
        toast.error(
          formatUserFacingError(err, "Kunne ikke oppdatere fra GitHub."),
        );
      } finally {
        setGhPreviewLoading(false);
      }
    },
    [previewGithubIssueAction, workspaceId],
  );

  const [editCandidateId, setEditCandidateId] =
    useState<Id<"candidates"> | null>(initialEditCandidateId);
  const [editProcessFullscreen, setEditProcessFullscreen] = useState(
    initialEditFullscreen,
  );
  const editDeepLinkAppliedRef = useRef(false);

  const [columnPickId, setColumnPickId] = useState("");
  const [columnItemsResult, setColumnItemsResult] = useState<{
    fieldName: string;
    optionName: string;
    items: GithubColumnItemRow[];
  } | null>(null);
  const [columnItemsError, setColumnItemsError] = useState<string | null>(null);
  const [columnItemsLoading, setColumnItemsLoading] = useState(false);
  /** Filtrer hentede kolonnekort lokalt (etter «Hent»). */
  const [columnItemsSearch, setColumnItemsSearch] = useState("");
  const deferredColumnItemsSearch = useDeferredValue(columnItemsSearch);
  /** Tidspunkt for siste vellykkede henting av kolonnekort (kun klient) */
  const [columnItemsFetchedAt, setColumnItemsFetchedAt] = useState<number | null>(
    null,
  );
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

  const [createTab, setCreateTab] = useState<"github" | "manual">("manual");

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

  const filteredColumnItems = useMemo(() => {
    if (!columnItemsResult) return [];
    return filterGithubColumnItems(
      columnItemsResult.items,
      deferredColumnItemsSearch,
    );
  }, [columnItemsResult, deferredColumnItemsSearch]);

  const columnItemsSearchActive = columnItemsSearch.trim().length > 0;

  useEffect(() => {
    if (
      editCandidateId &&
      candidates &&
      !candidates.some((c) => c._id === editCandidateId)
    ) {
      setEditCandidateId(null);
      setEditProcessFullscreen(false);
    }
  }, [editCandidateId, candidates]);

  useEffect(() => {
    if (editDeepLinkAppliedRef.current) return;
    if (!initialEditCandidateId) return;
    editDeepLinkAppliedRef.current = true;
    setEditCandidateId(initialEditCandidateId);
    setEditProcessFullscreen(initialEditFullscreen);
  }, [initialEditCandidateId, initialEditFullscreen]);

  const clearEditProcessUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("rediger") && !url.searchParams.has("fullskjerm")) {
      return;
    }
    url.searchParams.delete("rediger");
    url.searchParams.delete("fullskjerm");
    const qs = url.searchParams.toString();
    router.replace(
      `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
      { scroll: false },
    );
  }, [router]);

  const closeEditProcess = useCallback(() => {
    setEditCandidateId(null);
    setEditProcessFullscreen(false);
    clearEditProcessUrl();
  }, [clearEditProcessUrl]);

  const openEditProcessInNewTab = useCallback(
    (candidateId: Id<"candidates">) => {
      const url = `/w/${workspaceId}/vurderinger?fane=prosesser&rediger=${candidateId}&fullskjerm=1`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [workspaceId],
  );

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
            error: formatUserFacingError(
              e,
              "Kunne ikke laste statusliste fra GitHub.",
            ),
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
            error: formatUserFacingError(
              e,
              "Kunne ikke laste statusliste fra GitHub.",
            ),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspace?.githubProjectNodeId]);

  /** Gjenopprett sist hentede kolonnekort fra nettleser (samme arbeidsområde / prosjekt). */
  useEffect(() => {
    if (workspace === undefined || workspace === null) {
      return;
    }
    if (columnItemsResult !== null) {
      return;
    }
    const projectId = workspace.githubProjectNodeId?.trim();
    if (!projectId || githubProjectStatus.loading) {
      return;
    }
    const opts = githubProjectStatus.options;
    if (!opts?.length) {
      return;
    }
    const cached = readGithubColumnImportCache(workspaceId);
    if (!cached || cached.projectNodeId !== projectId) {
      return;
    }
    if (!opts.some((o) => o.id === cached.statusOptionId)) {
      return;
    }
    setColumnPickId((prev) => (prev.trim() ? prev : cached.statusOptionId));
    setColumnItemsResult({
      fieldName: cached.fieldName,
      optionName: cached.optionName,
      items: cached.items,
    });
    setColumnItemsFetchedAt(cached.fetchedAt);
    setCreateTab("github");
    setGithubImportTab("column");
  }, [
    workspace,
    workspaceId,
    columnItemsResult,
    githubProjectStatus.loading,
    githubProjectStatus.options,
  ]);

  /** Lagre kolonnekort lokalt slik at visningen overlever navigasjon og sidelast. */
  useEffect(() => {
    if (workspace === undefined || workspace === null) {
      return;
    }
    const projectId = workspace.githubProjectNodeId?.trim();
    if (!projectId || !columnItemsResult || columnItemsFetchedAt == null) {
      return;
    }
    const statusOptionId = columnPickId.trim();
    if (!statusOptionId) {
      return;
    }
    writeGithubColumnImportCache(workspaceId, {
      v: GITHUB_COLUMN_IMPORT_CACHE_VERSION,
      projectNodeId: projectId,
      statusOptionId,
      fieldName: columnItemsResult.fieldName,
      optionName: columnItemsResult.optionName,
      items: columnItemsResult.items,
      fetchedAt: columnItemsFetchedAt,
    });
  }, [
    workspace,
    workspaceId,
    columnPickId,
    columnItemsResult,
    columnItemsFetchedAt,
  ]);

  useEffect(() => {
    if (workspace === undefined || workspace === null) {
      return;
    }
    setAutoRegGithub(workspace.githubAutoRegisterProcessOnCreate ?? false);
    setAutoRegStatusId(
      workspace.githubAutoRegisterProcessStatusOptionId ?? "",
    );
  }, [workspace]);

  useEffect(() => {
    if (initialOrgUnit && !appliedOrgUnitRef.current) {
      appliedOrgUnitRef.current = true;
      setOrgUnitFilter(initialOrgUnit);
    }
  }, [initialOrgUnit, setOrgUnitFilter]);

  const candidatesSorted = useMemo(() => {
    if (!candidates) {
      return [];
    }
    return [...candidates].sort((a, b) =>
      a.code.localeCompare(b.code, "nb", { sensitivity: "base" }),
    );
  }, [candidates]);

  const processRegisterSearchQuery = processRegisterSearch.trim().toLowerCase();

  const approvedIntakeFiltered = useMemo(() => {
    let rows = approvedIntakeForProcessregister ?? [];
    const units = orgUnits ?? [];
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, units);
      const assessmentOrgById = new Map(
        (assessments ?? []).map((a) => [a._id, a.orgUnitId] as const),
      );
      rows = rows.filter((r) => {
        const ou = assessmentOrgById.get(r.approvedAssessmentId);
        return ou ? subtree.has(ou) : false;
      });
    }
    if (!processRegisterSearchQuery) {
      return rows;
    }
    return rows.filter((r) =>
      r.title.toLowerCase().includes(processRegisterSearchQuery),
    );
  }, [
    approvedIntakeForProcessregister,
    processRegisterSearchQuery,
    orgUnits,
    orgUnitFilter,
    assessments,
  ]);

  const coverageByCandidateId = useMemo(() => {
    const m = new Map<
      string,
      { rosCount: number; pvvCount: number; pddCount: number }
    >();
    for (const row of processCoverage ?? []) {
      m.set(String(row.candidateId), {
        rosCount: row.ros.count,
        pvvCount: row.pvv.count,
        pddCount: row.pdd.count,
      });
    }
    return m;
  }, [processCoverage]);

  const coverageTotals = useMemo(() => {
    let withoutRos = 0;
    let withoutPvv = 0;
    for (const c of candidatesSorted) {
      const cov = coverageByCandidateId.get(String(c._id));
      if (!cov || cov.rosCount === 0) withoutRos += 1;
      if (!cov || cov.pvvCount === 0) withoutPvv += 1;
    }
    return { withoutRos, withoutPvv };
  }, [candidatesSorted, coverageByCandidateId]);

  const candidatesFiltered = useMemo(() => {
    const units = orgUnits ?? [];
    let rows = candidatesSorted;
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, units);
      rows = rows.filter((c) => (c.orgUnitId ? subtree.has(c.orgUnitId) : false));
    }
    if (coverageFilter !== "all") {
      rows = rows.filter((c) => {
        const cov = coverageByCandidateId.get(String(c._id));
        const ros = cov?.rosCount ?? 0;
        const pvv = cov?.pvvCount ?? 0;
        if (coverageFilter === "missing_ros") return ros === 0;
        if (coverageFilter === "missing_pvv") return pvv === 0;
        return ros > 0 && pvv > 0;
      });
    }
    if (!processRegisterSearchQuery) {
      return rows;
    }
    return rows.filter((c) => {
      const org = candidateOrgUnitLabel(c, units);
      return (
        c.name.toLowerCase().includes(processRegisterSearchQuery) ||
        c.code.toLowerCase().includes(processRegisterSearchQuery) ||
        org.toLowerCase().includes(processRegisterSearchQuery)
      );
    });
  }, [
    candidatesSorted,
    processRegisterSearchQuery,
    orgUnits,
    orgUnitFilter,
    coverageFilter,
    coverageByCandidateId,
  ]);

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
    assessments === undefined ||
    membership === undefined ||
    orgUnits === undefined ||
    workspace === undefined ||
    approvedIntakeForProcessregister === undefined
  ) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="bg-muted/50 h-9 max-w-md animate-pulse rounded-xl" />
        <div className="bg-muted/40 h-36 animate-pulse rounded-2xl" />
        <div className="bg-muted/30 h-48 animate-pulse rounded-2xl" />
      </div>
    );
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
        notes: isEmptyRichText(cNotes) ? undefined : cNotes.trim(),
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
        closeEditProcess();
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
    setColumnItemsSearch("");
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
      setColumnItemsFetchedAt(Date.now());
    } catch (e) {
      setColumnItemsResult(null);
      setColumnItemsFetchedAt(null);
      setColumnItemsSearch("");
      clearGithubColumnImportCache(workspaceId);
      setColumnItemsError(
        formatUserFacingError(e, "Kunne ikke hente kort fra GitHub."),
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

  const statusLine =
    !canEditCandidates
      ? "Kun lesing"
      : candidates.length > 0 && approvedIntakeForProcessregister.length > 0
        ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""} · ${approvedIntakeForProcessregister.length} fra skjema`
        : candidates.length > 0
          ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""}`
          : approvedIntakeForProcessregister.length > 0
            ? `${approvedIntakeForProcessregister.length} fra skjema (ingen P-ID ennå)`
            : "Ingen registrerte rader ennå";

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl bg-transparent shadow-none",
        hubMode
          ? "gap-0 rounded-none border-0 bg-transparent py-0 shadow-none ring-0"
          : "border-0 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
      )}
    >
      {hubMode ? (
        <div
          data-tutorial-anchor="prosess-oversikt-header"
          className="pointer-events-none h-0 w-full"
          aria-hidden
        />
      ) : (
        <CardHeader className="px-6 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 flex size-10 items-center justify-center rounded-xl">
                <Users className="text-emerald-600 dark:text-emerald-400 size-5" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Prosessregister
                </CardTitle>
                <p className="text-muted-foreground mt-0.5 text-xs">{statusLine}</p>
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
      )}
      <CardContent
        className={cn(
          "space-y-6 px-5 pb-6 pt-5 sm:px-6",
          hubMode && "space-y-10 px-0 py-0 pb-0 sm:px-0",
        )}
      >
        {hubMode ? (
          <ProsessregisterHubLead
            canEdit={Boolean(canEditCandidates)}
            onRegisterClick={() => setNewProcessOpen(true)}
            candidatesCount={candidates.length}
            intakeCount={approvedIntakeForProcessregister.length}
            withoutRosCount={coverageTotals.withoutRos}
            withoutPvvCount={coverageTotals.withoutPvv}
          />
        ) : null}
        {hubMode ? (
          <div
            data-tutorial-anchor="github-tur"
            className="pointer-events-none h-px w-full shrink-0 bg-transparent"
            aria-hidden
          />
        ) : null}

        {/* ── Prosessliste ── */}
        {approvedIntakeForProcessregister.length > 0 || candidates.length > 0 ? (
          <section
            className={cn("space-y-4", hubMode && "space-y-6")}
            aria-labelledby={
              hubMode ? "prosessregister-oversikt-heading" : "process-overview-heading"
            }
            data-tutorial-anchor="prosess-oversikt-liste"
          >
            {hubMode ? (
              <>
                <h2 id="prosessregister-oversikt-heading" className="sr-only">
                  Prosesser
                </h2>
                <div className="flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-3.5 sm:flex-row sm:items-center">
                    {candidates.length +
                      approvedIntakeForProcessregister.length >=
                    4 ? (
                      <SearchInput
                        value={processRegisterSearch}
                        onChange={(e) => setProcessRegisterSearch(e.target.value)}
                        placeholder="Søk navn eller ID"
                        className="w-full min-w-0 sm:max-w-sm"
                        inputClassName="h-12 min-h-12 rounded-2xl border-border/60 px-5 md:h-12 md:min-h-12 md:rounded-2xl md:px-5"
                        aria-label="Søk i prosesser"
                      />
                    ) : null}
                    {orgUnits.length > 0 && candidates.length >= 2 ? (
                      <select
                        className="border-input h-12 w-full appearance-none rounded-2xl border border-border/60 bg-background bg-[length:1rem] bg-[right_1.1rem_center] bg-no-repeat px-5 pr-12 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-[15rem] dark:bg-input/30"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                        }}
                        value={orgUnitFilter}
                        onChange={(e) =>
                          setOrgUnitFilter(
                            e.target.value === ""
                              ? ""
                              : (e.target.value as Id<"orgUnits">),
                          )
                        }
                        aria-label="Enhet"
                      >
                        <option value="">Alle enheter</option>
                        {orgUnits.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {candidates.length >= 5 ? (
                      <select
                        className="border-input h-12 w-full appearance-none rounded-2xl border border-border/60 bg-background bg-[length:1rem] bg-[right_1.1rem_center] bg-no-repeat px-5 pr-12 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-[13rem] dark:bg-input/30"
                        style={{
                          backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                        }}
                        value={coverageFilter}
                        onChange={(e) =>
                          setCoverageFilter(
                            e.target.value as
                              | "all"
                              | "missing_ros"
                              | "missing_pvv"
                              | "complete",
                          )
                        }
                        aria-label="Dekning"
                      >
                        <option value="all">Alle</option>
                        <option value="missing_ros">Uten ROS</option>
                        <option value="missing_pvv">Uten PVV</option>
                        <option value="complete">Komplett</option>
                      </select>
                    ) : null}
                  </div>
                  <ListViewModeToggle value={viewMode} onChange={setViewMode} />
                </div>
              </>
            ) : (
              <h2
                id="process-overview-heading"
                className="text-base font-semibold text-foreground"
              >
                {candidates.length > 0 && approvedIntakeForProcessregister.length > 0
                  ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""} · ${approvedIntakeForProcessregister.length} fra skjema`
                  : candidates.length > 0
                    ? `${candidates.length} prosess${candidates.length !== 1 ? "er" : ""}`
                    : `${approvedIntakeForProcessregister.length} fra skjema`}
              </h2>
            )}

            {(processRegisterSearchQuery || coverageFilter !== "all") &&
            approvedIntakeFiltered.length === 0 &&
            candidatesFiltered.length === 0 &&
            (approvedIntakeForProcessregister.length > 0 ||
              candidates.length > 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground" role="status">
                Ingen treff.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setProcessRegisterSearch("");
                    setCoverageFilter("all");
                  }}
                >
                  Nullstill
                </button>
              </p>
            ) : null}

            {hubMode &&
            (approvedIntakeFiltered.length > 0 ||
              candidatesFiltered.length > 0) &&
            viewMode === "table" ? (
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <thead className="border-b border-border/50 bg-muted/25 text-xs font-medium text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Navn</th>
                        <th className="px-4 py-2.5 font-medium">ID</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Åpne
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedIntakeFiltered.map((row) => (
                        <tr
                          key={row.submissionId}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/25"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/w/${workspaceId}/a/${row.approvedAssessmentId}`}
                              className="font-medium hover:underline"
                            >
                              {row.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            Skjema
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            Fra skjema
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/w/${workspaceId}/a/${row.approvedAssessmentId}`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Åpne ${row.title}`}
                            >
                              <ChevronRight className="size-4" aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {candidatesFiltered.map((c) => {
                        const orgLabel = candidateOrgUnitLabel(c, orgUnits);
                        const cov = coverageByCandidateId.get(String(c._id));
                        const bits = [
                          orgLabel !== "—" ? orgLabel : null,
                          (cov?.pvvCount ?? 0) > 0 ? "PVV" : null,
                          (cov?.rosCount ?? 0) > 0 ? "ROS" : null,
                        ].filter(Boolean);
                        return (
                          <tr
                            key={c._id}
                            className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/25"
                            onClick={() => setEditCandidateId(c._id)}
                          >
                            <td className="px-4 py-3 font-medium">{c.name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {c.code}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {bits.join(" · ") || "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <ChevronRight
                                className="ml-auto size-4 text-muted-foreground/50"
                                aria-hidden
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {hubMode &&
            (approvedIntakeFiltered.length > 0 ||
              candidatesFiltered.length > 0) &&
            viewMode !== "table" ? (
              <ul
                className={cn(
                  viewMode === "cards"
                    ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    : "divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card",
                )}
              >
                {approvedIntakeFiltered.map((row) => (
                  <li key={row.submissionId}>
                    <Link
                      href={`/w/${workspaceId}/a/${row.approvedAssessmentId}`}
                      className={cn(
                        "group flex min-w-0 items-center transition-colors",
                        viewMode === "cards"
                          ? "h-full gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:bg-muted/30 sm:gap-5 sm:p-5"
                          : "gap-3 px-4 py-3.5 hover:bg-muted/25 sm:gap-4 sm:px-5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex shrink-0 items-center justify-center bg-muted text-sm font-semibold text-foreground",
                          viewMode === "cards"
                            ? "size-12 rounded-2xl"
                            : "size-9 rounded-lg",
                        )}
                        aria-hidden
                      >
                        S
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          className={cn(
                            "truncate font-medium tracking-tight text-foreground",
                            viewMode === "cards" ? "text-base" : "text-sm",
                          )}
                        >
                          {row.title}
                        </p>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          Fra skjema
                          {row.githubRepoFullName?.trim() &&
                          row.githubIssueNumber != null
                            ? " · GitHub"
                            : null}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:size-5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
                {candidatesFiltered.map((c) => {
                  const hasGithub = Boolean(c.githubProjectItemNodeId);
                  const canPreviewGh =
                    c.githubRepoFullName &&
                    c.githubIssueNumber != null &&
                    c.githubIssueNumber > 0;
                  const orgLabel = candidateOrgUnitLabel(c, orgUnits);
                  const cov = coverageByCandidateId.get(String(c._id));
                  const hasRos = (cov?.rosCount ?? 0) > 0;
                  const hasPvv = (cov?.pvvCount ?? 0) > 0;
                  const initial =
                    c.name.trim().charAt(0).toUpperCase() || "P";
                  const statusBits: string[] = [];
                  if (orgLabel !== "—") statusBits.push(orgLabel);
                  if (hasPvv) statusBits.push("PVV");
                  else if (candidates.length >= 2) statusBits.push("Mangler PVV");
                  if (hasRos) statusBits.push("ROS");
                  else if (candidates.length >= 2) statusBits.push("Mangler ROS");
                  if (hasGithub) statusBits.push("GitHub");

                  return (
                    <li key={c._id}>
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "group flex min-w-0 cursor-pointer items-center transition-colors",
                          viewMode === "cards"
                            ? "h-full gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:bg-muted/30 sm:gap-5 sm:p-5"
                            : "gap-3 px-4 py-3.5 hover:bg-muted/25 sm:gap-4 sm:px-5",
                        )}
                        onClick={() => setEditCandidateId(c._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditCandidateId(c._id);
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "flex shrink-0 items-center justify-center text-sm font-semibold",
                            viewMode === "cards"
                              ? "size-12 rounded-2xl"
                              : "size-9 rounded-lg",
                            hasRos && hasPvv
                              ? "bg-foreground text-background"
                              : "bg-muted text-foreground",
                          )}
                          aria-hidden
                        >
                          {initial}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p
                              className={cn(
                                "truncate font-medium tracking-tight text-foreground",
                                viewMode === "cards" ? "text-base" : "text-sm",
                              )}
                            >
                              {c.name}
                            </p>
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">
                              {c.code}
                            </span>
                          </div>
                          {statusBits.length > 0 ? (
                            <p className="truncate text-xs text-muted-foreground sm:text-sm">
                              {statusBits.join(" · ")}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 pl-1 sm:gap-2">
                          {canPreviewGh ? (
                            <button
                              type="button"
                              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-11 sm:rounded-2xl"
                              aria-label="Åpne GitHub"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openGhPreview(
                                  c.githubRepoFullName!,
                                  c.githubIssueNumber!,
                                );
                              }}
                            >
                              <ExternalLink className="size-4" aria-hidden />
                            </button>
                          ) : null}
                          {!hasGithub &&
                          canEditCandidates &&
                          canQuickAddGithubCard ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 rounded-xl text-muted-foreground hover:text-foreground sm:size-11 sm:rounded-2xl"
                              disabled={rowGithubBusyId === c._id}
                              title="Legg til i GitHub"
                              onClick={(e) => {
                                e.stopPropagation();
                                void registerOneFromOverviewTable(c._id);
                              }}
                            >
                              {rowGithubBusyId === c._id ? (
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <GitBranch className="size-4" aria-hidden />
                              )}
                            </Button>
                          ) : null}
                          {canEditCandidates ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-11 sm:rounded-2xl"
                              disabled={overviewDeleteBusyId === c._id}
                              aria-label={`Slett ${c.code}`}
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
                          ) : null}
                          <ChevronRight
                            className="ml-1 size-4 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:size-5"
                            aria-hidden
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {!hubMode && approvedIntakeFiltered.length > 0 ? (
              <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
                {approvedIntakeFiltered.map((row) => (
                  <li key={row.submissionId}>
                    <Link
                      href={`/w/${workspaceId}/a/${row.approvedAssessmentId}`}
                      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/25 sm:px-5"
                    >
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {row.title}
                      </p>
                      <ChevronRight className="size-4 text-muted-foreground/35" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {!hubMode && candidatesFiltered.length > 0 ? (
              <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
                {candidatesFiltered.map((c) => (
                  <li
                    key={c._id}
                    className="cursor-pointer px-4 py-3.5 hover:bg-muted/25 sm:px-5"
                    onClick={() => setEditCandidateId(c._id)}
                  >
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {c.code}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {hubMode &&
        approvedIntakeForProcessregister.length === 0 &&
        candidates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 px-8 py-20 text-center">
            <p className="text-base font-medium tracking-tight text-foreground">
              Ingen prosesser ennå
            </p>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Opprett den første for å koble vurdering, ROS og prosessdesign.
            </p>
            {canEditCandidates ? (
              <Button
                type="button"
                className="mt-8 h-12 gap-2 rounded-2xl bg-foreground px-6 text-sm font-semibold text-background"
                onClick={() => setNewProcessOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Ny prosess
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* ── Create / Import ──
            I hubMode er «Ny prosess» allerede tilgjengelig fra topp­knappen, og GitHub‑import
            er en sjelden flyt. Vi gjemmer derfor hele import-panelet bak en `<details>`
            for å rydde i visningen. */}
        {canEditCandidates && !hubMode ? (
          <div
            data-tutorial-anchor="github-prosess"
            className="rounded-3xl border border-border/40 bg-card/70 p-4 shadow-sm sm:p-5"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Opprett prosess
                </h2>
                <p className="text-sm text-muted-foreground">
                  Start manuelt. Bruk GitHub bare når prosessen allerede kommer derfra.
                </p>
              </div>
              <Button
                type="button"
                className="h-11 rounded-2xl px-4 text-sm font-semibold shadow-sm sm:w-auto"
                onClick={() => setNewProcessOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Ny prosess
              </Button>
            </div>
            <div
              className="mb-4 flex gap-1 rounded-2xl border border-border/35 bg-muted/25 p-1"
              role="tablist"
              aria-label="Opprett prosess"
            >
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "github"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:py-2",
                  createTab === "github"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/40"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCreateTab("github")}
              >
                <GitBranch className="size-4 shrink-0 opacity-80" aria-hidden />
                Fra GitHub
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "manual"}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:py-2",
                  createTab === "manual"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/40"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCreateTab("manual")}
              >
                <Plus className="size-4 shrink-0 opacity-80" aria-hidden />
                Opprett selv
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
              <div className="space-y-2">
                <p className="text-destructive text-sm" role="alert">
                  {githubProjectStatus.error}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => reloadGithubProjectStatus(true)}
                >
                  Prøv igjen
                </Button>
              </div>
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
                    onChange={(e) => {
                      setColumnPickId(e.target.value);
                      setColumnItemsSearch("");
                    }}
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
            {columnItemsResult ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium">
                      {columnItemsResult.optionName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                      {`Kolonne i GitHub-prosjekt: felt «${columnItemsResult.fieldName}», verdi «${columnItemsResult.optionName}».`}
                      {columnItemsFetchedAt != null ? (
                        <>
                          {" "}
                          Sist hentet{" "}
                          {new Date(columnItemsFetchedAt).toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          . Vises igjen uten ny henting (Oppdater synkroniserer mot GitHub).
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums">
                      {columnItemsSearchActive
                        ? `${filteredColumnItems.length} av ${columnItemsResult.items.length}`
                        : `${columnItemsResult.items.length} kort`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg"
                      disabled={columnItemsLoading || !columnPickId.trim()}
                      title="Synkroniser med GitHub — nye titler, kommentarer synlige i forhåndsvisning, kort som har flyttet kolonne"
                      onClick={() => void fetchGithubColumnItems()}
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5 shrink-0",
                          columnItemsLoading && "animate-spin",
                        )}
                        aria-hidden
                      />
                      Oppdater
                    </Button>
                  </div>
                </div>
                {columnItemsResult.items.length > 0 ? (
                <>
                <SearchInput
                  value={columnItemsSearch}
                  onChange={(e) => setColumnItemsSearch(e.target.value)}
                  placeholder={`Søk blant ${columnItemsResult.items.length} kort…`}
                  aria-label="Søk i hentede GitHub-kort"
                  className="w-full"
                  inputClassName="h-10 min-h-10 rounded-xl border-border/60 md:h-10 md:min-h-10"
                />
                {columnItemsSearchActive && filteredColumnItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Ingen treff for «{columnItemsSearch.trim()}».
                  </p>
                ) : null}
                <div className="max-h-[min(32rem,60vh)] overflow-y-auto pr-0.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                  {filteredColumnItems.map((row) => {
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
                    const canPreviewIssue =
                      Boolean(row.repoFullName?.trim()) &&
                      row.issueNumber != null &&
                      row.issueNumber > 0;
                    const canPreviewDraft =
                      row.contentKind === "draft_issue" &&
                      Boolean(row.draftIssueId?.trim());
                    const canOpenGithubPreview =
                      canPreviewIssue || canPreviewDraft;

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
                        role={canOpenGithubPreview ? "button" : undefined}
                        tabIndex={canOpenGithubPreview ? 0 : undefined}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl p-3 transition-all duration-150",
                          canOpenGithubPreview && "cursor-pointer",
                          linked
                            ? "bg-muted/25"
                            : "bg-card shadow-sm ring-1 ring-black/[0.05] hover:shadow-md hover:ring-black/[0.1] dark:ring-white/[0.06] dark:hover:ring-white/[0.12]",
                        )}
                        onClick={
                          canPreviewIssue
                            ? () =>
                                void openGhPreview(
                                  row.repoFullName!,
                                  row.issueNumber!,
                                )
                            : canPreviewDraft
                              ? () =>
                                  void openDraftGhPreview(row.draftIssueId!)
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
                </>
                ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted/50">
                  <Search className="text-muted-foreground size-4" aria-hidden />
                </div>
                <p className="text-muted-foreground text-sm">
                  Ingen kort i denne kolonnen
                </p>
                <p className="text-muted-foreground max-w-xs text-xs">
                  Har det kommet nye kort på GitHub? Trykk «Oppdater» over — listen
                  hentes på nytt fra prosjektet.
                </p>
              </div>
                )}
              </div>
            ) : null}
              </section>
            ) : null}
              </div>
            ) : null}

            {/* Manual creation panel */}
            {createTab === "manual" ? (
              <div className="rounded-2xl border border-dashed border-border/50 bg-muted/15 px-4 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Opprett manuelt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Legg inn navn, prosess-ID og organisasjon først. Flere detaljer kan fylles ut senere.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-11 rounded-2xl px-4 text-sm font-semibold shadow-sm"
                    onClick={() => setNewProcessOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden />
                    Ny prosess
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* hubMode: vis kun en kompakt «Importer fra GitHub»-disclosure når det er
            aktuelt, slik at hovedflaten holdes ren. Manuell opprettelse skjer fra
            «Ny prosess»-knappen øverst. */}
        {hubMode && canEditCandidates && w.githubProjectNodeId?.trim() ? (
          <details
            data-tutorial-anchor="github-prosess"
            className="group pt-2 text-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <GitBranch className="size-4" aria-hidden />
              GitHub-import
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <div className="mt-4 space-y-4 rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
              <div
                className="flex gap-1 rounded-2xl bg-muted/40 p-1"
                role="tablist"
                aria-label="Importkilde"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={githubImportTab === "issue"}
                  className={cn(
                    "flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-all duration-150",
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
                    "flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-all duration-150",
                    githubImportTab === "column"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setGithubImportTab("column")}
                >
                  Prosjektkolonne
                </button>
              </div>

              {githubImportTab === "issue" ? (
                <section aria-label="Importer fra GitHub-issue">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="gh-issue-url-hub"
                      type="url"
                      value={issueGithubUrlInput}
                      onChange={(e) => setIssueGithubUrlInput(e.target.value)}
                      placeholder="github.com/org/repo/issues/42"
                      className="h-12 min-h-12 min-w-0 flex-1 rounded-2xl bg-background px-4 font-mono text-sm shadow-sm md:h-12 md:min-h-12 md:rounded-2xl md:px-4"
                      autoComplete="off"
                      aria-label="Issue-URL"
                    />
                    <Button
                      type="button"
                      className="h-12 shrink-0 gap-2 rounded-2xl px-5 shadow-sm"
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
              ) : (
                <section className="space-y-3" aria-label="Hent kort fra prosjektkolonne">
                  {githubProjectStatus.loading ? (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Laster kolonner fra GitHub …
                    </p>
                  ) : githubProjectStatus.error ? (
                    <div className="space-y-2">
                      <p className="text-destructive text-sm" role="alert">
                        {githubProjectStatus.error}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => reloadGithubProjectStatus(true)}
                      >
                        Prøv igjen
                      </Button>
                    </div>
                  ) : (githubProjectStatus.options?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Ingen kolonner funnet — sjekk prosjekt under Innstillinger.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor="gh-column-pick-hub" className="sr-only">
                          Statuskolonne i GitHub-prosjekt
                        </Label>
                        <select
                          id="gh-column-pick-hub"
                          className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={columnPickId}
                          onChange={(e) => {
                            setColumnPickId(e.target.value);
                            setColumnItemsSearch("");
                          }}
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
                        disabled={columnItemsLoading || !columnPickId.trim()}
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
                  {columnItemsResult ? (
                    <div className="space-y-2.5">
                      <p className="text-muted-foreground text-[11px]">
                        {columnItemsResult.optionName} ·{" "}
                        {columnItemsSearchActive
                          ? `${filteredColumnItems.length} av ${columnItemsResult.items.length} kort`
                          : `${columnItemsResult.items.length} kort`}
                      </p>
                      {columnItemsResult.items.length > 0 ? (
                        <>
                          <SearchInput
                            value={columnItemsSearch}
                            onChange={(e) => setColumnItemsSearch(e.target.value)}
                            placeholder={`Søk blant ${columnItemsResult.items.length} kort…`}
                            aria-label="Søk i hentede GitHub-kort"
                            className="w-full"
                            inputClassName="h-10 min-h-10 rounded-xl border-border/60 md:h-10 md:min-h-10"
                          />
                          {columnItemsSearchActive &&
                          filteredColumnItems.length === 0 ? (
                            <p className="text-muted-foreground text-xs">
                              Ingen treff for «{columnItemsSearch.trim()}».
                            </p>
                          ) : (
                            <div className="max-h-[20rem] space-y-2 overflow-y-auto pr-1">
                              {filteredColumnItems.map((row) => {
                                const linked = projectItemIdsLinkedInPvv.has(
                                  row.projectItemId,
                                );
                                return (
                                  <div
                                    key={row.projectItemId}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm",
                                      linked ? "bg-muted/30" : "bg-card",
                                    )}
                                  >
                                    <p className="min-w-0 flex-1 truncate text-foreground">
                                      {row.title}
                                    </p>
                                    {linked ? (
                                      <Badge
                                        variant="secondary"
                                        className="h-[18px] border-0 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200"
                                      >
                                        I PVV
                                      </Badge>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 gap-1 rounded-lg px-2.5 text-[11px]"
                                        disabled={
                                          row.contentKind === "unknown" ||
                                          ((row.contentKind === "issue" ||
                                            row.contentKind ===
                                              "pull_request") &&
                                            (!row.repoFullName?.trim() ||
                                              row.issueNumber == null))
                                        }
                                        onClick={() =>
                                          openImportFromGithubColumn(row)
                                        }
                                      >
                                        <Plus className="size-3" aria-hidden />
                                        Opprett
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Ingen kort i denne kolonnen.
                        </p>
                      )}
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          </details>
        ) : null}

        {!hubMode ? <ProcessCoverageOverview workspaceId={workspaceId} /> : null}

        {!hubMode &&
        isAdmin &&
        w.githubProjectNodeId?.trim() &&
        githubProjectStatus.options &&
        githubProjectStatus.options.length > 0 ? (
          <section
            className="rounded-2xl border border-border/40 bg-muted/[0.06] p-4 sm:p-5"
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
            if (!open) {
              setGhPreview(null);
              setDraftGhPreview(null);
            }
          }}
        >
          <DialogContent
            size="xl"
            className="max-h-[85vh] max-w-2xl"
            titleId="gh-preview-title"
            descriptionId="gh-preview-desc"
          >
            {ghPreviewLoading && !ghPreview && !draftGhPreview ? (
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
                  {ghPreviewLoading && ghPreview ? (
                    <div className="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                      Henter siste versjon fra GitHub …
                    </div>
                  ) : null}
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
                          Opprettet{" "}
                          {new Date(ghPreview.createdAt).toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ) : null}
                    {ghPreview.updatedAt &&
                    ghPreview.updatedAt !== ghPreview.createdAt ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          Oppdatert{" "}
                          {new Date(ghPreview.updatedAt).toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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

                  {(ghPreview.assignees ?? []).length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs">Tildelt:</span>
                      {(ghPreview.assignees ?? []).map((a) => (
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

                  {(ghPreview.labels ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(ghPreview.labels ?? []).map((l) => (
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

                  {(ghPreview.comments ?? []).length > 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
                        Kommentarer
                      </h3>
                      <ul className="max-h-[min(40vh,24rem)] space-y-3 overflow-y-auto pr-1">
                        {(ghPreview.comments ?? []).map((c) => (
                          <li
                            key={c.id}
                            className="border-border/40 rounded-lg border bg-background/40 p-3 text-sm"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {c.author?.avatarUrl ? (
                                <img
                                  src={c.author.avatarUrl}
                                  alt=""
                                  className="size-5 rounded-full"
                                />
                              ) : null}
                              <span className="text-foreground font-medium">
                                {c.author?.login ?? "Ukjent"}
                              </span>
                              {c.createdAt ? (
                                <span className="text-muted-foreground tabular-nums">
                                  {new Date(c.createdAt).toLocaleString("nb-NO", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : null}
                            </div>
                            <pre className="text-foreground whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
                              {c.body || "(Tom kommentar)"}
                            </pre>
                          </li>
                        ))}
                      </ul>
                      {ghPreview.commentsCount >
                      (ghPreview.comments ?? []).length ? (
                        <p className="text-muted-foreground mt-2 text-[11px]">
                          GitHub har flere enn {(ghPreview.comments ?? []).length}{" "}
                          kommentarer. Åpne saken på GitHub for full historikk.
                        </p>
                      ) : null}
                    </div>
                  ) : ghPreview.commentsCount > 0 ? (
                    <p className="text-muted-foreground text-xs italic">
                      Kommentarer kunne ikke lastes. Åpne saken på GitHub for å
                      lese dem.
                    </p>
                  ) : null}

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
                <DialogFooter className="flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={ghPreviewLoading}
                    title="Hent på nytt beskrivelse, kommentarer og metadata fra GitHub"
                    onClick={() =>
                      void refreshGhPreview(
                        ghPreview.repoFullName,
                        ghPreview.number,
                      )
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5 shrink-0",
                        ghPreviewLoading && "animate-spin",
                      )}
                      aria-hidden
                    />
                    Oppdater fra GitHub
                  </Button>
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
            ) : draftGhPreview ? (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <div className="bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileText
                        className="text-muted-foreground size-4"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="gh-preview-title"
                        className="text-foreground text-base font-semibold leading-snug"
                      >
                        {draftGhPreview.title}
                      </h2>
                      <p
                        id="gh-preview-desc"
                        className="text-muted-foreground mt-0.5 text-xs"
                      >
                        Prosjektutkast på GitHub (ikke et repo-issue ennå)
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="border-muted-foreground/25 bg-muted/50 shrink-0 text-xs"
                    >
                      Utkast
                    </Badge>
                  </div>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  {ghPreviewLoading && draftGhPreview ? (
                    <div className="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Loader2
                        className="size-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                      Henter siste versjon fra GitHub …
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    {draftGhPreview.creator ? (
                      <div className="flex items-center gap-1.5">
                        <User className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">Opprettet av</span>
                        <span className="text-foreground font-medium">
                          {draftGhPreview.creator.login}
                        </span>
                      </div>
                    ) : null}
                    {draftGhPreview.createdAt ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          Opprettet{" "}
                          {new Date(draftGhPreview.createdAt).toLocaleString(
                            "nb-NO",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    ) : null}
                    {draftGhPreview.updatedAt &&
                    draftGhPreview.updatedAt !== draftGhPreview.createdAt ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="text-muted-foreground size-3" aria-hidden />
                        <span className="text-muted-foreground">
                          Oppdatert{" "}
                          {new Date(draftGhPreview.updatedAt).toLocaleString(
                            "nb-NO",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Utkast ligger bare i GitHub-prosjektet. Når du konverterer til
                    vanlig issue der, får det nummer og samme detaljvisning som andre
                    issues.
                  </p>
                  {draftGhPreview.body ? (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                        Beskrivelse
                      </h3>
                      <div className="prose prose-sm dark:prose-invert max-h-[40vh] overflow-y-auto text-sm leading-relaxed">
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {draftGhPreview.body}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      Ingen beskrivelse.
                    </p>
                  )}
                </DialogBody>
                <DialogFooter className="flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={ghPreviewLoading}
                    title="Hent på nytt tittel og beskrivelse fra GitHub"
                    onClick={() =>
                      void refreshDraftGhPreview(draftGhPreview.draftIssueNodeId)
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5 shrink-0",
                        ghPreviewLoading && "animate-spin",
                      )}
                      aria-hidden
                    />
                    Oppdater fra GitHub
                  </Button>
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

        {!hubMode ? <Separator /> : null}

        <Dialog open={newProcessOpen} onOpenChange={setNewProcessOpen}>
          <DialogContent
            size="lg"
            className="max-h-[92vh] max-w-lg"
            titleId="new-process-title"
            descriptionId="new-process-desc"
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-10 items-center justify-center rounded-2xl">
                  <Plus className="text-primary size-5" aria-hidden />
                </div>
                <div className="space-y-1">
                  <h2
                    id="new-process-title"
                    className="text-foreground text-lg font-semibold tracking-tight"
                  >
                    Ny prosess
                  </h2>
                  <p
                    id="new-process-desc"
                    className="text-muted-foreground text-sm"
                  >
                    Fyll inn navn. Resten er valgfritt.
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-cand-name" className="text-sm font-medium">
                    Prosessnavn
                  </Label>
                  <Input
                    id="new-cand-name"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="F.eks. Fakturamottak"
                    required
                    autoComplete="off"
                    className="h-12 min-h-12 rounded-2xl px-4 md:h-12 md:min-h-12 md:rounded-2xl md:px-4"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="new-cand-code" className="text-sm font-medium">
                      Prosess-ID
                    </Label>
                    <span className="text-muted-foreground text-xs">
                      valgfritt
                    </span>
                  </div>
                  <Input
                    id="new-cand-code"
                    value={cCode}
                    onChange={(e) => setCCode(e.target.value)}
                    placeholder="F.eks. INN-EL-01"
                    autoComplete="off"
                    className="h-12 min-h-12 rounded-2xl px-4 font-mono md:h-12 md:min-h-12 md:rounded-2xl md:px-4"
                  />
                  <p className="text-muted-foreground text-xs">
                    Tomt = auto-ID
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notat</Label>
                <RichTextEditor
                  aria-label="Notat"
                  value={cNotes}
                  onChange={setCNotes}
                  rows={4}
                  placeholder="Systemer, kontaktperson, notater …"
                />
              </div>

              <details className="group rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors">
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
                  Forhåndsutfyll vurderingsfelt
                </summary>
                <div className="mt-4 grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-cand-owner" className="text-sm">
                      Ansvarlig / eier
                    </Label>
                    <Input
                      id="new-cand-owner"
                      value={cOwner}
                      onChange={(e) => setCOwner(e.target.value)}
                      placeholder="Avdelingsleder, kontaktperson"
                      className="h-11 min-h-11 rounded-xl px-3.5 md:h-11 md:min-h-11 md:rounded-xl md:px-3.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-cand-systems" className="text-sm">
                      Systemer og data
                    </Label>
                    <Input
                      id="new-cand-systems"
                      value={cSystems}
                      onChange={(e) => setCSystems(e.target.value)}
                      placeholder="EPJ, faktura, integrasjoner"
                      className="h-11 min-h-11 rounded-xl px-3.5 md:h-11 md:min-h-11 md:rounded-xl md:px-3.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-cand-comp" className="text-sm">
                      Sikkerhet og personvern
                    </Label>
                    <Textarea
                      id="new-cand-comp"
                      value={cCompliance}
                      onChange={(e) => setCCompliance(e.target.value)}
                      rows={2}
                      placeholder="Sensitivitet, tilgang, dokumentasjon …"
                      className="resize-y rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
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
                className="h-11 rounded-xl px-4"
                onClick={() => setNewProcessOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl px-5"
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
              closeEditProcess();
            }
          }}
        >
          <DialogContent
            size="5xl"
            fillViewport={editProcessFullscreen}
            className={
              editProcessFullscreen
                ? undefined
                : "max-h-[min(96vh,56rem)] max-w-5xl"
            }
            titleId="edit-process-title"
            descriptionId="edit-process-desc"
          >
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    id="edit-process-title"
                    className="text-foreground text-lg font-semibold tracking-tight"
                  >
                    {canEditCandidates ? "Rediger prosess" : "Vis prosess"}
                  </h2>
                  <p
                    id="edit-process-desc"
                    className="text-muted-foreground mt-0.5 truncate text-sm"
                  >
                    {editingCandidate
                      ? `${editingCandidate.code} · ${editingCandidate.name}`
                      : "…"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {editCandidateId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full"
                      onClick={() => openEditProcessInNewTab(editCandidateId)}
                      aria-label="Åpne i egen fane"
                      title="Åpne i egen fane"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    onClick={() =>
                      setEditProcessFullscreen((prev) => !prev)
                    }
                    aria-label={
                      editProcessFullscreen
                        ? "Avslutt fullskjerm"
                        : "Fullskjerm"
                    }
                    title={
                      editProcessFullscreen
                        ? "Avslutt fullskjerm"
                        : "Fullskjerm"
                    }
                  >
                    {editProcessFullscreen ? (
                      <Minimize2 className="size-4" aria-hidden />
                    ) : (
                      <Maximize2 className="size-4" aria-hidden />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    onClick={closeEditProcess}
                    aria-label="Lukk rediger prosess"
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <DialogBody>
              {editingCandidate ? (
                <WorkspaceCandidateRow
                  key={`${editingCandidate._id}-${editingCandidate.updatedAt}`}
                  as="div"
                  embedded
                  notesRows={editProcessFullscreen ? 12 : 6}
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
            className="flex flex-col items-center rounded-2xl border border-dashed border-border/50 bg-muted/[0.04] px-6 py-12 text-center sm:py-14"
          >
            <div className="bg-muted/50 mb-4 flex size-12 items-center justify-center rounded-2xl">
              <Users className="text-muted-foreground size-5" aria-hidden />
            </div>
            <p className="text-foreground text-base font-semibold tracking-tight">
              Ingen rader ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              Opprett en prosess med ID, importer fra GitHub nedenfor, eller bruk skjemaer — godkjente
              forslag dukker opp her som vurderinger.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {canEditCandidates ? (
                <Button
                  type="button"
                  className="h-10 gap-2 rounded-xl px-5 shadow-none"
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
                    "h-10 rounded-xl border-border/50 px-5 shadow-none",
                  )}
                >
                  Til vurderinger
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
  initialOrgUnit,
}: {
  workspaceId: Id<"workspaces">;
  hubMode?: boolean;
  /** Samme data som Prosessregister — for «Skjema»-merke på vurderingskort. */
  approvedIntakeForProcessregister?:
    | undefined
    | ApprovedIntakeProcessregisterRow[];
  /** Pre-select org unit filter from URL deep-link. */
  initialOrgUnit?: Id<"orgUnits"> | null;
}) {
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const membership = useQuery(api.workspaces.getMyMembership, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
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
  const [orgUnitFilter, setOrgUnitFilter] = useStickyState<"" | Id<"orgUnits">>(`ws:${workspaceId}:assessments:orgFilter`, initialOrgUnit ?? "");
  const [statusFilter, setStatusFilter] = useStickyState<PipelineStatus | "all">(`ws:${workspaceId}:assessments:statusFilter`, "all");
  const [sortBy, setSortBy] = useStickyState<
    "priority" | "updated" | "ap" | "criticality" | "ease"
  >(`ws:${workspaceId}:assessments:sortBy`, "priority");
  const [viewMode, setViewMode] = useStickyState<ListViewMode>(
    `ws:${workspaceId}:assessments:view`,
    "list",
  );

  const appliedOrgUnitRef = useRef(false);
  useEffect(() => {
    if (initialOrgUnit && !appliedOrgUnitRef.current) {
      appliedOrgUnitRef.current = true;
      setOrgUnitFilter(initialOrgUnit);
    }
  }, [initialOrgUnit, setOrgUnitFilter]);

  const filteredAssessments = useMemo(() => {
    let rows = assessments ?? [];
    const units = orgUnits ?? [];
    if (orgUnitFilter) {
      const subtree = orgSubtreeIds(orgUnitFilter, units);
      rows = rows.filter((a) =>
        a.orgUnitId ? subtree.has(a.orgUnitId) : false,
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((a) => {
        const orgBlob = orgUnitSearchLabel(a.orgUnitId ?? undefined, units).toLowerCase();
        return (
          a.title.toLowerCase().includes(q) || orgBlob.includes(q)
        );
      });
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
  }, [assessments, search, statusFilter, sortBy, orgUnitFilter, orgUnits]);

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

  const pipelineStats = useMemo(() => {
    const rows = assessments ?? [];
    let notAssessed = 0;
    let inProgress = 0;
    let done = 0;
    let highPriority = 0;
    for (const row of rows) {
      const s = normalizePipelineStatus(row.pipelineStatus);
      if (s === "not_assessed") notAssessed += 1;
      else if (s === "done") done += 1;
      else inProgress += 1;
      if (effectiveAssessmentPriority(row) >= 70) highPriority += 1;
    }
    return { total: rows.length, notAssessed, inProgress, done, highPriority };
  }, [assessments]);

  if (workspace === undefined || assessments === undefined || orgUnits === undefined) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="bg-muted/50 h-24 animate-pulse rounded-2xl" />
        <div className="bg-muted/40 h-10 max-w-md animate-pulse rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-muted/35 h-40 animate-pulse rounded-2xl" />
          <div className="bg-muted/35 h-40 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }
  if (workspace === null) {
    return (
      <p className="text-destructive text-sm">Fant ikke arbeidsområdet.</p>
    );
  }

  const hasActiveFilter =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    orgUnitFilter !== "";

  return (
    <div className="space-y-6">
      {hubMode && assessments.length > 0 ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border/50 py-3.5 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">Totalt</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {pipelineStats.total}
            </dd>
          </div>
          {pipelineStats.inProgress > 0 ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">I arbeid</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {pipelineStats.inProgress}
              </dd>
            </div>
          ) : null}
          {pipelineStats.done > 0 ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Ferdig</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {pipelineStats.done}
              </dd>
            </div>
          ) : null}
          {pipelineStats.highPriority > 0 ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Høy prioritet</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {pipelineStats.highPriority}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {assessments.length > 0 ? (
        <details className="group overflow-hidden rounded-2xl border border-border/50 bg-card open:bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="inline-flex items-center gap-2">
              <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="font-semibold text-foreground">Ny vurdering</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-border/40 px-2 pb-3 pt-1 sm:px-3">
            <GithubIssueStartCard workspaceId={workspaceId} variant="assessment" />
          </div>
        </details>
      ) : (
        <GithubIssueStartCard workspaceId={workspaceId} variant="assessment" />
      )}

      <section
        className="space-y-4"
        role="region"
        aria-labelledby="vurderinger-liste-heading"
      >
        {hubMode ? (
          <h2 id="vurderinger-liste-heading" className="sr-only">
            Alle vurderinger
          </h2>
        ) : (
          <h2
            id="vurderinger-liste-heading"
            className="flex items-baseline gap-2 text-base font-semibold tracking-tight text-foreground"
          >
            Alle vurderinger
            {assessments.length > 0 ? (
              <span className="text-xs font-normal tabular-nums text-muted-foreground">
                · {assessments.length}
              </span>
            ) : null}
          </h2>
        )}

        {assessments.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              {assessments.length >= 5 ? (
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søk tittel eller enhet"
                  aria-label="Søk i vurderinger"
                  className="h-11 w-full min-w-0 rounded-full border-border/50 sm:max-w-sm"
                />
              ) : null}
              {assessments.length >= 8 ? (
                <>
                  {orgUnits.length > 0 ? (
                    <select
                      className="border-input h-11 w-full rounded-full border border-border/50 bg-background px-4 text-sm sm:w-[12rem]"
                      value={orgUnitFilter}
                      onChange={(e) =>
                        setOrgUnitFilter(
                          e.target.value === ""
                            ? ""
                            : (e.target.value as Id<"orgUnits">),
                        )
                      }
                      aria-label="Filtrer etter organisasjonsenhet"
                    >
                      <option value="">Alle enheter</option>
                      {orgUnits.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <select
                    className="border-input h-11 w-full rounded-full border border-border/50 bg-background px-4 text-sm sm:w-[12rem]"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as PipelineStatus | "all")
                    }
                    aria-label="Filtrer etter status"
                  >
                    <option value="all">Alle statuser</option>
                    {PIPELINE_KANBAN_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {PIPELINE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="border-input h-11 w-full rounded-full border border-border/50 bg-background px-4 text-sm sm:w-[11rem]"
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
                    aria-label="Sorter vurderinger"
                  >
                    <option value="priority">Prioritet</option>
                    <option value="ap">Gevinst</option>
                    <option value="criticality">Viktighet</option>
                    <option value="ease">Implementering</option>
                    <option value="updated">Sist endret</option>
                  </select>
                </>
              ) : null}
            </div>
            <ListViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        ) : null}

        {assessments.length > 0 &&
        filteredAssessments.length > 0 &&
        hasActiveFilter ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            {filteredAssessments.length} treff
            <span className="text-border mx-1.5">·</span>
            Høy {priorityDistribution.high} · Middels {priorityDistribution.mid} · Lav{" "}
            {priorityDistribution.low}
          </p>
        ) : null}

        {assessments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
            <p className="text-base font-medium tracking-tight text-foreground">
              Ingen vurderinger ennå
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Start fra en prosess, en GitHub-issue eller helt blankt.
            </p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground" role="status">
            Ingen treff.{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setOrgUnitFilter("");
              }}
            >
              Nullstill
            </button>
          </p>
        ) : viewMode === "cards" ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = effectiveAssessmentPriority(a);
              const orgLine = orgUnitSearchLabel(
                a.orgUnitId ?? undefined,
                orgUnits,
              );
              const fromIntake = intakeAssessmentIdSet.has(a._id);
              return (
                <li key={a._id} className="min-w-0">
                  <div className="group relative flex h-full flex-col rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border hover:bg-muted/20">
                    <Link
                      href={`/w/${workspaceId}/a/${a._id}`}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`Åpne vurdering: ${a.title}`}
                    />
                    <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums",
                          prio >= 70
                            ? "bg-foreground text-background"
                            : "bg-muted text-foreground",
                        )}
                        aria-hidden
                      >
                        {prio.toFixed(0)}
                      </span>
                      <ChevronRight
                        className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
                    </div>
                    <h3 className="pointer-events-none relative z-10 mt-3 line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
                      {a.title}
                    </h3>
                    <p className="pointer-events-none relative z-10 mt-1.5 text-xs text-muted-foreground">
                      {[
                        orgLine || null,
                        fromIntake ? "Fra skjema" : null,
                        formatRelativeUpdatedAt(a.updatedAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="pointer-events-auto relative z-10 mt-auto flex items-center justify-between gap-2 pt-4">
                      {canEditPipeline ? (
                        <PipelineStatusSelect
                          assessmentId={a._id}
                          value={pipeline}
                          compact
                        />
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] font-medium"
                        >
                          {PIPELINE_STATUS_LABELS[pipeline]}
                        </Badge>
                      )}
                      <button
                        type="button"
                        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Slett vurdering"
                        aria-label={`Slett vurdering ${a.title}`}
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
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : viewMode === "table" ? (
          <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-border/50 bg-muted/25 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Pri</th>
                    <th className="px-4 py-2.5 font-medium">Tittel</th>
                    <th className="px-4 py-2.5 font-medium">Enhet</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Oppdatert</th>
                    <th className="px-4 py-2.5 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.map((a) => {
                    const pipeline = normalizePipelineStatus(a.pipelineStatus);
                    const prio = effectiveAssessmentPriority(a);
                    const orgLine = orgUnitSearchLabel(
                      a.orgUnitId ?? undefined,
                      orgUnits,
                    );
                    return (
                      <tr
                        key={a._id}
                        className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/25"
                      >
                        <td className="px-4 py-3 tabular-nums font-medium">
                          {prio.toFixed(0)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/w/${workspaceId}/a/${a._id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {a.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {orgLine || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {canEditPipeline ? (
                            <PipelineStatusSelect
                              assessmentId={a._id}
                              value={pipeline}
                              compact
                            />
                          ) : (
                            <span className="text-muted-foreground">
                              {PIPELINE_STATUS_LABELS[pipeline]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Slett ${a.title}`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Slette «${a.title}»?\n\nAlle data fjernes permanent.`,
                                )
                              ) {
                                return;
                              }
                              void (async () => {
                                try {
                                  await deleteAssessment({
                                    assessmentId: a._id,
                                  });
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
                            <Trash2 className="size-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card">
            {filteredAssessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = effectiveAssessmentPriority(a);
              const orgLine = orgUnitSearchLabel(a.orgUnitId ?? undefined, orgUnits);
              const fromIntake = intakeAssessmentIdSet.has(a._id);
              const secondaryBits: string[] = [];
              if (orgLine) secondaryBits.push(orgLine);
              if (fromIntake) secondaryBits.push("Fra skjema");
              secondaryBits.push(formatRelativeUpdatedAt(a.updatedAt));
              return (
                <li key={a._id} className="group/card relative">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-muted/25 sm:flex-nowrap sm:px-5">
                    <Link
                      href={`/w/${workspaceId}/a/${a._id}`}
                      className="absolute inset-0 z-0"
                      aria-label={`Åpne vurdering: ${a.title}`}
                    />
                    <span
                      className={cn(
                        "pointer-events-none relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums",
                        prio >= 70
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground",
                      )}
                      title={`Prioritet ${prio.toFixed(0)} av 100`}
                      aria-hidden
                    >
                      {prio.toFixed(0)}
                    </span>
                    <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium tracking-tight text-foreground">
                        {a.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {secondaryBits.join(" · ")}
                      </p>
                    </div>
                    <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1.5">
                      {canEditPipeline ? (
                        <PipelineStatusSelect
                          assessmentId={a._id}
                          value={pipeline}
                          compact
                        />
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] font-medium"
                        >
                          {PIPELINE_STATUS_LABELS[pipeline]}
                        </Badge>
                      )}
                      <button
                        type="button"
                        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Slett vurdering"
                        aria-label={`Slett vurdering ${a.title}`}
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
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                      <ChevronRight
                        className="pointer-events-none size-4 text-muted-foreground/30 transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-foreground"
                        aria-hidden
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
