"use client";

import { Button, buttonVariants } from "@/components/ui/button";
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
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  LayoutGrid,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
import {
  WORKSPACE_ROLE_DESC_NB,
  WORKSPACE_ROLE_LABEL_NB,
} from "@/lib/role-labels-nb";
import { WorkspaceCandidateRow } from "./workspace-candidate-row";

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

  useEffect(() => {
    if (workspace && workspace !== null) {
      setWsName(workspace.name);
      setWsNotes(workspace.notes ?? "");
      setWsOrgNr(workspace.organizationNumber ?? "");
      setWsHer(workspace.institutionIdentifier ?? "");
    }
  }, [workspace]);

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
  const candidates = useQuery(api.candidates.listByWorkspace, { workspaceId });
  const orgUnits = useQuery(api.orgUnits.listByWorkspace, { workspaceId });
  const createCandidate = useMutation(api.candidates.create);
  const updateCandidate = useMutation(api.candidates.update);
  const removeCandidate = useMutation(api.candidates.remove);

  const [cName, setCName] = useState("");
  const [cCode, setCCode] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cOwner, setCOwner] = useState("");
  const [cSystems, setCSystems] = useState("");
  const [cCompliance, setCCompliance] = useState("");

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
    orgUnits === undefined
  ) {
    return <p className="text-muted-foreground text-sm">Laster …</p>;
  }

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
      await createCandidate({
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke legge til prosess.");
    }
  }

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
      <CardContent className="space-y-5 pt-6">
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
          <ul className="space-y-3">
            {candidates.map((c) => (
              <WorkspaceCandidateRow
                key={`${c._id}-${c.updatedAt}`}
                candidate={c}
                orgUnits={orgUnits}
                isAdmin={isAdmin}
                canEdit={canEditCandidates}
                onUpdate={updateCandidate}
                onRemove={removeCandidate}
              />
            ))}
          </ul>
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
