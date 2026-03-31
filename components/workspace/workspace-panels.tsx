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
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
  priorityBorderAccentClass,
} from "@/lib/assessment-ui-helpers";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  GitBranch,
  LayoutGrid,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

import { ORG_UNIT_KIND_LABELS } from "@/lib/helsesector-labels";
import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import {
  WORKSPACE_ROLE_DESC_NB,
  WORKSPACE_ROLE_LABEL_NB,
} from "@/lib/role-labels-nb";
import { WorkspaceCandidateRow } from "./workspace-candidate-row";
import { WorkspaceGithubIntegrationCard } from "./workspace-github-integration-card";

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
  const [settingsSaved, setSettingsSaved] = useState<string | null>(null);

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
    setSettingsSaved(null);
    try {
      await updateWorkspace({
        workspaceId,
        name: wsName,
        notes: wsNotes.trim() === "" ? null : wsNotes,
        organizationNumber: wsOrgNr.trim() === "" ? null : wsOrgNr,
        institutionIdentifier: wsHer.trim() === "" ? null : wsHer,
      });
      setSettingsSaved("Lagret.");
    } catch (e) {
      setSettingsSaved(
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
        {settingsSaved ? (
          <p className="text-muted-foreground text-sm" role="status">
            {settingsSaved}
          </p>
        ) : null}
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
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const isAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  if (members === undefined || membership === undefined) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

  async function sendInvite() {
    setInviteMsg(null);
    try {
      const r = await inviteMember({
        workspaceId,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteMsg(
        r.kind === "linked"
          ? "Bruker lagt til."
          : "Invitasjon registrert (aktiveres når brukeren logger inn med e-posten).",
      );
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : "Invitasjon feilet.");
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
            {inviteMsg ? (
              <p className="text-muted-foreground text-sm">{inviteMsg}</p>
            ) : null}
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
  const [autoGithubSaveMsg, setAutoGithubSaveMsg] = useState<string | null>(
    null,
  );
  const [autoRegGithub, setAutoRegGithub] = useState(false);
  const [autoRegStatusId, setAutoRegStatusId] = useState("");

  const reloadGithubProjectStatus = useCallback(() => {
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
    void listGithubProjectStatusOptions({ workspaceId })
      .then((r) =>
        setGithubProjectStatus({
          loading: false,
          options: r.options,
          fieldName: r.fieldName,
          error: null,
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
  }, [
    workspace?.githubProjectNodeId,
    workspaceId,
    listGithubProjectStatusOptions,
  ]);

  useEffect(() => {
    const t = setTimeout(() => reloadGithubProjectStatus(), 0);
    return () => clearTimeout(t);
  }, [reloadGithubProjectStatus]);

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

  if (!canEditCandidates) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prosessregister</CardTitle>
          <CardDescription>
            Du har ikke tilgang til å redigere prosessregisteret i dette
            arbeidsområdet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function addCandidate() {
    const name = cName.trim();
    const code = cCode.trim();
    if (!name || !code) {
      window.alert("Fyll inn både navn og kode (kode kan ikke bare være mellomrom).");
      return;
    }
    try {
      const newId = await createCandidate({
        workspaceId,
        name,
        code,
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
      if (shouldAutoRegisterInGithub) {
        try {
          await registerCandidateToGithubProject({
            candidateId: newId,
            statusOptionId: statusForGithub,
          });
        } catch (e) {
          window.alert(
            `Prosessen ble lagret. Automatisk registrering i GitHub-tavle feilet: ${
              e instanceof Error ? e.message : "ukjent feil"
            }`,
          );
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke legge til prosess.");
    }
  }

  async function saveAutoGithubSettings() {
    setAutoGithubSaveMsg(null);
    try {
      await updateWorkspace({
        workspaceId,
        githubAutoRegisterProcessOnCreate: autoRegGithub,
        githubAutoRegisterProcessStatusOptionId:
          autoRegStatusId.trim() === "" ? null : autoRegStatusId.trim(),
      });
      setAutoGithubSaveMsg("Lagret.");
    } catch (e) {
      setAutoGithubSaveMsg(
        e instanceof Error ? e.message : "Kunne ikke lagre innstillinger.",
      );
    }
  }

  async function bulkRegisterMissingInGithub() {
    const missing = candidates!.filter((c) => !c.githubProjectItemNodeId);
    if (missing.length === 0) {
      window.alert("Alle prosesser har allerede et kort i GitHub-prosjektet.");
      return;
    }
    const opt =
      autoRegStatusId.trim() ||
      w.githubAutoRegisterProcessStatusOptionId?.trim() ||
      githubProjectStatus.options?.[0]?.id;
    if (!opt) {
      window.alert(
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
    } catch (e) {
      window.alert(
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
      window.alert(
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
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Kunne ikke legge til i GitHub-tavle.",
      );
    } finally {
      setRowGithubBusyId(null);
    }
  }

  const canQuickAddGithubCard =
    Boolean(w.githubProjectNodeId?.trim()) &&
    (githubProjectStatus.options?.length ?? 0) > 0 &&
    !githubProjectStatus.loading &&
    !githubProjectStatus.error;

  return (
    <Card
      className={
        hubMode
          ? "overflow-hidden border-emerald-500/20 shadow-md"
          : undefined
      }
    >
      <CardHeader
        className={
          hubMode
            ? "border-b border-border/50 bg-gradient-to-br from-emerald-500/[0.05] via-card to-card pb-6"
            : undefined
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Prosessregister</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed">
              {hubMode ? (
                <>
                  Her registrerer dere <strong>forretningsprosesser</strong> med
                  unik <strong>prosess-ID</strong>. ID-en brukes i vurderingen og
                  når ROS kobles til. Én prosess kan ha flere vurderinger; én
                  vurdering peker på én prosess-ID i skjemaet. ROS-analyser kan
                  knyttes til både prosesser og vurderinger. Valgfrie felt under
                  fylles inn i vurderingen første gang noen velger prosessen.
                </>
              ) : (
                <>
                  Registrer prosesser med navn og prosess-ID. Du kan knytte til
                  organisasjonskart (HF/avdeling/seksjon). Sletting krever
                  administrator. Samme prosess kan brukes i flere vurderinger; ROS
                  kan kobles til flere vurderinger og prosesser.
                </>
              )}
            </CardDescription>
          </div>
          {hubMode ? (
            <span className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums">
              <Users className="size-3.5" aria-hidden />
              {candidates.length}{" "}
              {candidates.length === 1 ? "prosess" : "prosesser"}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        {!w.githubProjectNodeId?.trim() ? (
          <div
            className="rounded-xl border border-amber-500/40 bg-amber-500/[0.09] px-4 py-3"
            role="status"
          >
            <p className="text-foreground text-sm font-medium">
              GitHub-tavle er ikke koblet til dette arbeidsområdet
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Knappen «Legg til i tavle» kommer først etter at{" "}
              <strong className="text-foreground font-medium">
                prosjekt (node-ID)
              </strong>{" "}
              er lagret sammen med token under Innstillinger. Uten det vises bare
              teksten under hver prosess.
            </p>
            {isAdmin ? (
              <Link
                href={`/w/${workspaceId}/innstillinger#github-arbeidsomrade`}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "mt-3 inline-flex gap-2",
                )}
              >
                Åpne Innstillinger → GitHub
              </Link>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">
                Be en administrator om å sette opp GitHub under Innstillinger.
              </p>
            )}
          </div>
        ) : null}
        {candidates.length > 0 ? (
          <section
            className="space-y-3"
            aria-labelledby="process-overview-heading"
          >
            <div>
              <h2
                id="process-overview-heading"
                className="text-foreground font-heading text-lg font-semibold tracking-tight"
              >
                Prosessoversikt
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Alle registrerte prosesser — klikk en rad for å hoppe ned til
                redigering og GitHub.
              </p>
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
                  </tr>
                </thead>
                <tbody>
                  {candidatesSorted.map((c) => (
                    <tr
                      key={c._id}
                      className="border-border/40 hover:bg-muted/40 cursor-pointer border-b transition-colors"
                      onClick={() =>
                        document
                          .getElementById(`cand-detail-${c._id}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
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
                          <Badge
                            variant="secondary"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                          >
                            I prosjekt
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Ikke i prosjekt
                            </Badge>
                            {canEditCandidates && canQuickAddGithubCard ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 gap-1.5 px-2 text-xs"
                                disabled={rowGithubBusyId === c._id}
                                aria-label={`Legg til ${c.code} i GitHub-tavle`}
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
                                Legg til i tavle
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {isAdmin &&
        w.githubProjectNodeId?.trim() &&
        githubProjectStatus.options &&
        githubProjectStatus.options.length > 0 ? (
          <section
            className="border-border/60 space-y-4 rounded-xl border bg-muted/20 p-4"
            aria-labelledby="auto-github-heading"
          >
            <div className="flex flex-wrap items-start gap-2">
              <GitBranch className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <h2
                  id="auto-github-heading"
                  className="text-foreground text-base font-semibold"
                >
                  Automatisk GitHub-prosjekt
                </h2>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Nye prosesser kan legges inn som utkast i GitHub-tavlen med én
                  gang. Avkrysning og standardstatus under gjelder allerede når du
                  trykker «Legg til prosess» (du trenger ikke «Lagre innstilling»
                  først). Krever lagret prosjekt-node-ID og token under
                  innstillinger.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="border-input size-4 rounded"
                  checked={autoRegGithub}
                  onChange={(e) => setAutoRegGithub(e.target.checked)}
                />
                Registrer automatisk ved ny prosess
              </label>
              <div className="flex min-w-[12rem] flex-col gap-1 sm:max-w-xs">
                <Label htmlFor="auto-gh-status" className="text-xs">
                  Standardstatus i prosjekt
                </Label>
                <select
                  id="auto-gh-status"
                  className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
                  value={autoRegStatusId}
                  onChange={(e) => setAutoRegStatusId(e.target.value)}
                >
                  <option value="">— Velg —</option>
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
                className="h-10"
                onClick={() => void saveAutoGithubSettings()}
              >
                Lagre innstilling
              </Button>
            </div>
            {autoGithubSaveMsg ? (
              <p className="text-muted-foreground text-sm" role="status">
                {autoGithubSaveMsg}
              </p>
            ) : null}
            {candidates.some((c) => !c.githubProjectItemNodeId) ? (
              <div className="border-border/50 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-xs">
                  {
                    candidates.filter((c) => !c.githubProjectItemNodeId).length
                  }{" "}
                  prosess(er) mangler kort i prosjektet.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2"
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
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <GitBranch className="size-4" aria-hidden />
                  )}
                  Registrer alle manglende
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        <Separator />

        <section className="space-y-5" aria-labelledby="new-process-heading">
          <h2
            id="new-process-heading"
            className="text-foreground font-heading text-lg font-semibold tracking-tight"
          >
            Registrer ny prosess
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cand-name">{prosessRegisterCopy.displayName.label}</Label>
              <Input
                id="cand-name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="F.eks. Fakturamottak"
                required
                autoComplete="off"
                className="h-11"
              />
              <p className="text-muted-foreground text-[11px] leading-snug">
                {prosessRegisterCopy.displayName.hint}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cand-code" className="flex flex-wrap items-center gap-1">
                {prosessRegisterCopy.referenceCode.label}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cand-code"
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
                placeholder={prosessRegisterCopy.referenceCode.placeholder}
                required
                autoComplete="off"
                className="h-11 font-mono"
              />
              <p className="text-muted-foreground text-[11px] leading-snug">
                {prosessRegisterCopy.referenceCode.hint}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cand-notes">{prosessRegisterCopy.notes.label}</Label>
            <Textarea
              id="cand-notes"
              value={cNotes}
              onChange={(e) => setCNotes(e.target.value)}
              rows={2}
              placeholder="Valgfritt — f.eks. systemnavn, kontaktperson …"
              className="resize-y"
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              {prosessRegisterCopy.notes.hint}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-foreground mb-3 text-sm font-medium">
              Brukes i vurderingen når prosessen velges
            </p>
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
              Tomme felt hoppes over. Ved første valg av prosessen i veiviseren
              fylles tilsvarende felt i vurderingen hvis de er tomme (roller,
              systemer, sikkerhet og personvern).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cand-owner" className="text-xs">
                  Ansvarlig / eier (til «Roller og ansvar» i skjemaet)
                </Label>
                <Input
                  id="cand-owner"
                  value={cOwner}
                  onChange={(e) => setCOwner(e.target.value)}
                  placeholder="F.eks. avdelingsleder, kontaktperson"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cand-systems" className="text-xs">
                  Systemer og data (til «Systemer og data»)
                </Label>
                <Input
                  id="cand-systems"
                  value={cSystems}
                  onChange={(e) => setCSystems(e.target.value)}
                  placeholder="F.eks. EPJ, faktura, integrasjoner"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cand-comp" className="text-xs">
                  Sikkerhet og personvern (til «Sikkerhet og informasjon»)
                </Label>
                <Textarea
                  id="cand-comp"
                  value={cCompliance}
                  onChange={(e) => setCCompliance(e.target.value)}
                  rows={2}
                  placeholder="Kort om sensitivitet, tilgang, dokumentasjon …"
                  className="resize-y"
                />
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11"
            disabled={!cName.trim() || !cCode.trim()}
            onClick={() => void addCandidate()}
          >
            Legg til prosess
          </Button>
        </section>

        <Separator />

        {candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-500/[0.03] px-6 py-12 text-center">
            <div className="bg-muted/80 mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
              <Users className="text-muted-foreground size-6" aria-hidden />
            </div>
            <p className="text-foreground text-sm font-medium">
              Ingen prosesser ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              Opprett en prosess over, eller gå til vurderinger og start en sak —
              der velger du prosess-ID i veiviseren.
            </p>
            {hubMode ? (
              <Link
                href={`/w/${workspaceId}/vurderinger`}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "mt-5 inline-flex",
                )}
              >
                Gå til vurderinger
              </Link>
            ) : null}
          </div>
        ) : (
          <section className="space-y-3" aria-labelledby="all-processes-heading">
            <h2
              id="all-processes-heading"
              className="text-foreground font-heading text-lg font-semibold tracking-tight"
            >
              Alle prosesser — detaljer og GitHub
            </h2>
            <p className="text-muted-foreground text-sm">
              Utvid hver rad for full redigering og kobling til GitHub-prosjekt.
            </p>
            <ul className="space-y-3">
              {candidates.map((c) => (
                <WorkspaceCandidateRow
                  key={`${c._id}-${c.updatedAt}`}
                  workspaceId={workspaceId}
                  candidate={c}
                  orgUnits={orgUnits}
                  isAdmin={isAdmin}
                  canEdit={canEditCandidates}
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
                    onReload: reloadGithubProjectStatus,
                    register: (candidateId, statusOptionId) =>
                      registerCandidateToGithubProject({
                        candidateId,
                        statusOptionId,
                      }),
                    updateStatus: (candidateId, statusOptionId) =>
                      updateCandidateGithubProjectStatus({
                        candidateId,
                        statusOptionId,
                      }),
                    remove: (candidateId) =>
                      removeCandidateFromGithubProject({ candidateId }),
                  }}
                />
              ))}
            </ul>
          </section>
        )}
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
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const createAssessment = useMutation(api.assessments.create);
  const deleteAssessment = useMutation(api.assessments.deleteAssessment);

  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | "all">(
    "all",
  );

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
    return rows;
  }, [assessments, search, statusFilter]);

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
    <div className="space-y-4">
      {hubMode ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground text-sm leading-snug">
            <span className="text-foreground font-medium">
              Ny prosess i registeret?
            </span>{" "}
            Legg den inn under{" "}
            <Link
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Prosessregister
            </Link>
            , så kan du velge prosess-ID i steg 1 i veiviseren.
          </p>
        </div>
      ) : null}
      <Card className="border-border/60 overflow-hidden shadow-sm">
        <CardHeader className="pb-3 pt-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="size-[1.15rem]" aria-hidden />
            </div>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-lg tracking-tight">
                Ny vurdering
              </CardTitle>
              <CardDescription className="text-sm leading-snug">
                Gi saken et navn og gå rett til veiviseren. Utkast lagres
                fortløpende.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 border-t border-border/50 bg-muted/20 pt-4 sm:flex-row sm:items-center">
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
              className="h-10 bg-background"
              autoComplete="off"
            />
          </div>
          <Button
            size="default"
            className="h-10 w-full shrink-0 gap-1.5 px-5 sm:w-auto"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            {busy ? "Oppretter …" : "Start vurdering"}
            <ChevronRight className="size-4 opacity-90" aria-hidden />
          </Button>
        </CardFooter>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Alle vurderinger
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
              {assessments.length === 0
                ? "Ingen saker i listen — opprett med kortet over."
                : `${assessments.length} ${assessments.length === 1 ? "vurdering" : "vurderinger"} · søk eller filtrer på status.`}
            </p>
          </div>
          <Link
            href={`/w/${workspaceId}/leveranse`}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <LayoutGrid className="size-4" aria-hidden />
            Leveranse
          </Link>
        </div>

        {assessments.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[min(100%,18rem)]">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk i tittel …"
                className="h-9 bg-background pl-9"
                aria-label="Søk i vurderinger"
              />
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:min-w-[11rem]">
              <Label htmlFor="assessment-status-filter" className="sr-only">
                Filtrer på status
              </Label>
              <select
                id="assessment-status-filter"
                className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm shadow-xs"
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

        {assessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center">
            <p className="text-foreground mx-auto max-w-md text-sm font-semibold">
              Ingen vurderinger ennå
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-sm leading-relaxed">
              <strong className="text-foreground">Vurdering</strong> er én sak om
              automatisering: skjema, status i leveranse og prioritering.{" "}
              <strong className="text-foreground">Prosessregisteret</strong> er den
              felles listen over prosesser med ID — valgfritt før du oppretter
              saken, men nyttig når flere saker skal bruke samme prosesskode.
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">
              <span className="text-foreground font-medium">Neste steg:</span> fyll
              inn tittel i kortet over og velg{" "}
              <span className="text-foreground font-medium">Start vurdering</span>.
            </p>
            <Link
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-5 inline-flex",
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
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredAssessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = effectiveAssessmentPriority(a);
              const ap = a.cachedAp;
              const crit = a.cachedCriticality;
              return (
                <li key={a._id} className="group/card relative">
                  <Link
                    href={`/w/${workspaceId}/a/${a._id}`}
                    className={cn(
                      "bg-card hover:border-primary/35 block overflow-hidden rounded-xl border border-l-[3px] bg-gradient-to-br from-card to-muted/10 p-3.5 shadow-sm transition-all hover:shadow-md",
                      priorityBorderAccentClass(prio),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-heading group-hover/card:text-primary line-clamp-2 min-w-0 text-[0.9375rem] font-semibold leading-snug transition-colors">
                        {a.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 max-w-[9rem] truncate text-[10px] font-medium"
                      >
                        {PIPELINE_STATUS_LABELS[pipeline]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-snug">
                      {compliancePlainLine(a)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-border/40 pt-2.5">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                          Prioritet
                        </p>
                        <p className="font-heading text-xl font-bold tabular-nums tracking-tight">
                          {prio.toFixed(1)}
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            / 100
                          </span>
                        </p>
                        {ap !== undefined &&
                        ap !== null &&
                        crit !== undefined &&
                        crit !== null ? (
                          <p className="text-muted-foreground text-[11px] tabular-nums">
                            AP {ap.toFixed(0)} % · Vikt. {crit.toFixed(0)} %
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-[11px]">
                            Fullfør skjema for poeng
                          </p>
                        )}
                      </div>
                      <div className="text-muted-foreground shrink-0 text-right text-[11px] leading-snug">
                        <span
                          className="block"
                          title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                        >
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-0.5 font-medium text-foreground group-hover/card:text-primary">
                          Åpne
                          <ChevronRight className="size-3.5 opacity-80" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
                    title="Slett vurdering"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Slette «${a.title}»?\n\nAlle utkast, versjoner, oppgaver, kommentarer og koblinger fjernes permanent.`,
                        )
                      ) {
                        void deleteAssessment({ assessmentId: a._id });
                      }
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
