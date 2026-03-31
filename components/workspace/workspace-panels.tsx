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
  ArrowUpRight,
  LayoutGrid,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

import { prosessRegisterCopy } from "@/lib/prosess-register-copy";
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
  const inviteMember = useMutation(api.workspaces.inviteMember);
  const removeMember = useMutation(api.workspaces.removeMember);
  const updateMemberRole = useMutation(api.workspaces.updateMemberRole);

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
      <Card>
        <CardHeader>
          <CardTitle>Team og tilgang</CardTitle>
          <CardDescription>
            Inviter via e-post. Eksisterende brukere legges inn med en gang.
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
            <div className="w-full space-y-2 sm:w-40">
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
                <option value="admin">Admin</option>
                <option value="member">Medlem</option>
                <option value="viewer">Visning</option>
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
                    {m.email ?? "—"} · {m.role}
                  </p>
                </div>
                {m.role !== "owner" ? (
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="border-input h-8 rounded-md border bg-background px-2 text-xs"
                      value={m.role}
                      onChange={(e) => {
                        const v = e.target.value as
                          | "admin"
                          | "member"
                          | "viewer";
                        void updateMemberRole({
                          workspaceId,
                          targetUserId: m.userId,
                          role: v,
                        });
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Medlem</option>
                      <option value="viewer">Visning</option>
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
                      Fjern
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">Eier</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          Medlemmer med tilgang til dette arbeidsområdet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m._id} className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">
                {m.name ?? m.email ?? m.userId}
              </span>{" "}
              · {m.role}
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
          <CardTitle>Kandidater</CardTitle>
          <CardDescription>
            Du har ikke tilgang til å administrere kandidater i dette området.
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
      });
      setCName("");
      setCCode("");
      setCNotes("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke opprette kandidat.");
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
            <CardTitle className="text-xl">
              {hubMode ? "Prosesser" : "Kandidater"}
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed">
              {hubMode ? (
                <>
                  Her registrerer dere <strong>forretningsprosesser</strong> som
                  skal vurderes — typisk på tvers av HF, avdeling og seksjon. Hver
                  prosess får et <strong>lesbart navn</strong> og en{" "}
                  <strong>prosess-ID</strong> (kort kode) som er den faste
                  tekniske nøkkelen i PVV og ROS. Organisasjonsfeltet er valgfritt
                  og sier hvor dere svarer først — ikke hvor prosessen stopper.
                </>
              ) : (
                <>
                  Registrer prosesser med navn og prosess-ID. Du kan knytte til
                  organisasjonskart (HF/avdeling/seksjon). Sletting krever admin.
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
        <Button
          type="button"
          size="lg"
          className="h-11"
          disabled={!cName.trim() || !cCode.trim()}
          onClick={() => void addCandidate()}
        >
          {hubMode ? "Legg til prosess" : "Legg til kandidat"}
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
              Når du legger til én, kan du velge samme kode i{" "}
              <strong className="text-foreground">PVV-vurdering</strong> under
              fanen «PVV-vurderinger».
            </p>
            {hubMode ? (
              <Link
                href={`/w/${workspaceId}/vurderinger`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-5 inline-flex",
                )}
              >
                Gå til PVV-vurderinger
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
    <div className="space-y-10">
      {hubMode ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="text-foreground font-medium">
              Mangler du en prosess å koble til?
            </span>{" "}
            Registrer den under fanen{" "}
            <Link
              href={`/w/${workspaceId}/vurderinger?fane=prosesser`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Prosesser
            </Link>{" "}
            først — deretter velger du koden i veiviseren.
          </p>
        </div>
      ) : null}
      <Card className="relative overflow-hidden border-border/60 shadow-md">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_-20%,hsl(var(--primary)/0.12),transparent_55%),radial-gradient(700px_circle_at_100%_0%,hsl(var(--primary)/0.06),transparent_50%)]"
          aria-hidden
        />
        <CardHeader className="relative pb-2">
          <div className="flex flex-wrap items-start gap-3">
            <div className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-2xl">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-xl tracking-tight">
                Ny RPA-vurdering
              </CardTitle>
              <CardDescription className="max-w-xl text-base leading-relaxed">
                Gi saken et navn og gå rett inn i veiviseren. Alt lagres underveis
                — du trenger ikke fullføre alt på én gang.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="relative flex flex-col gap-4 pt-0 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label
              className="text-muted-foreground text-sm font-medium"
              htmlFor="new-assessment-title"
            >
              Navn på prosess eller sak
            </Label>
            <Input
              id="new-assessment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Fakturamottak fra leverandører"
              className="h-11 bg-background/80"
            />
          </div>
          <Button
            size="lg"
            className="h-11 shrink-0 gap-2 px-6"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            {busy ? "Oppretter …" : "Start vurdering"}
            <ArrowUpRight className="size-4 opacity-80" aria-hidden />
          </Button>
        </CardFooter>
      </Card>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Alle vurderinger i området
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              {assessments.length === 0
                ? "Når du oppretter vurderinger, vises de her med status, modellerte tall og siste endring."
                : `${assessments.length} vurdering${assessments.length === 1 ? "" : "er"} · søk og filtrer for å finne riktig sak raskt.`}
            </p>
          </div>
          <Link
            href={`/w/${workspaceId}/leveranse`}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-2 text-sm font-medium transition-colors"
          >
            <LayoutGrid className="size-4" aria-hidden />
            Leveranse-tavle
          </Link>
        </div>

        {assessments.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[min(100%,20rem)] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk i tittel …"
                className="h-10 bg-background/80 pl-9"
                aria-label="Søk i vurderinger"
              />
            </div>
            <div className="flex min-w-[12rem] items-center gap-2">
              <Label htmlFor="assessment-status-filter" className="sr-only">
                Filtrer på status
              </Label>
              <select
                id="assessment-status-filter"
                className="border-input bg-background h-10 w-full min-w-[12rem] rounded-lg border px-3 text-sm shadow-xs sm:w-auto"
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
          <div className="rounded-2xl border border-dashed bg-muted/15 px-6 py-14 text-center">
            <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
              Ingen vurderinger ennå. Opprett én over — du kommer rett inn i
              veiviseren med lagring underveis.
            </p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
            Ingen treff. Prøv et annet søkeord eller fjern filter.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {filteredAssessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = effectiveAssessmentPriority(a);
              const ap = a.cachedAp;
              const crit = a.cachedCriticality;
              return (
                <li key={a._id}>
                  <Link
                    href={`/w/${workspaceId}/a/${a._id}`}
                    className={cn(
                      "group bg-card hover:border-primary/30 block overflow-hidden rounded-2xl border border-l-4 bg-gradient-to-br from-card to-muted/15 p-4 shadow-sm transition-all hover:shadow-lg",
                      priorityBorderAccentClass(prio),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-heading group-hover:text-primary line-clamp-2 text-base font-semibold leading-snug transition-colors">
                        {a.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[11px] font-medium"
                      >
                        {PIPELINE_STATUS_LABELS[pipeline]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-snug">
                      {compliancePlainLine(a)}
                    </p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-3">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                          Porteføljeprioritet
                        </p>
                        <p className="font-heading text-2xl font-bold tabular-nums tracking-tight">
                          {prio.toFixed(1)}
                          <span className="text-muted-foreground ml-1 text-sm font-normal">
                            / 100
                          </span>
                        </p>
                        {ap !== undefined &&
                        ap !== null &&
                        crit !== undefined &&
                        crit !== null ? (
                          <p className="text-muted-foreground text-xs tabular-nums">
                            AP {ap.toFixed(0)} % · Viktighet {crit.toFixed(0)} %
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            Åpne for å oppdatere modellerte tall
                          </p>
                        )}
                      </div>
                      <div className="text-muted-foreground text-right text-xs leading-snug">
                        <span
                          className="block"
                          title={new Date(a.updatedAt).toLocaleString("nb-NO")}
                        >
                          {formatRelativeUpdatedAt(a.updatedAt)}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-0.5 font-medium text-foreground/80 group-hover:text-primary">
                          Åpne
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
