"use client";

import { Button } from "@/components/ui/button";
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
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  PIPELINE_STATUS_LABELS,
  normalizePipelineStatus,
} from "@/lib/assessment-pipeline";
import {
  compliancePlainLine,
  formatRelativeUpdatedAt,
} from "@/lib/assessment-ui-helpers";
import { LayoutGrid } from "lucide-react";

import { WorkspaceDeleteDialog } from "@/components/workspace/workspace-delete-dialog";
import { useRouter } from "next/navigation";

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
}: {
  workspaceId: Id<"workspaces">;
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
    try {
      await createCandidate({
        workspaceId,
        name: cName,
        code: cCode,
        notes: cNotes.trim() === "" ? undefined : cNotes,
      });
      setCName("");
      setCCode("");
      setCNotes("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke opprette kandidat.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kandidater</CardTitle>
        <CardDescription>
          Registrer prosesser med kort kode (referanse i vurderinger). Du kan
          knytte kandidaten til avdeling/seksjon i organisasjonskartet. Sletting
          krever admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Navn</Label>
            <Input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="F.eks. Fakturaprosess"
            />
          </div>
          <div className="space-y-2">
            <Label>Kode</Label>
            <Input
              value={cCode}
              onChange={(e) => setCCode(e.target.value)}
              placeholder="F.eks. FAKT-01"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notater (valgfritt)</Label>
          <Textarea
            value={cNotes}
            onChange={(e) => setCNotes(e.target.value)}
            rows={2}
          />
        </div>
        <Button type="button" onClick={() => void addCandidate()}>
          Legg til kandidat
        </Button>
        <Separator />
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen kandidater ennå.</p>
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
}: {
  workspaceId: Id<"workspaces">;
}) {
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const createAssessment = useMutation(api.assessments.create);

  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="space-y-8">
      <Card className="overflow-hidden border-muted/80 shadow-sm">
        <CardHeader className="bg-muted/20 pb-4">
          <CardTitle className="text-lg">Start en ny vurdering</CardTitle>
          <CardDescription className="max-w-xl leading-relaxed">
            Gi prosessen et navn. Du fyller ut steg for steg — ingen krav om å
            bli ferdig med én gang.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-muted-foreground text-sm" htmlFor="new-assessment-title">
              Navn på prosess eller sak
            </label>
            <Input
              id="new-assessment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Fakturamottak fra leverandører"
            />
          </div>
          <Button onClick={() => void handleCreate()} disabled={busy}>
            {busy ? "Oppretter …" : "Opprett og fortsett"}
          </Button>
        </CardFooter>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Dine vurderinger
            </h2>
            <p className="text-muted-foreground text-sm">
              Status i leveranse, foreslått prioritet og risiko/personvern på ett
              blikk.
            </p>
          </div>
          <Link
            href={`/w/${workspaceId}/leveranse`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <LayoutGrid className="size-4" aria-hidden />
            Åpne leveranse-tavle
          </Link>
        </div>
        {assessments.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed py-10 text-center text-sm">
            Ingen vurderinger her ennå. Bruk skjemaet over for å komme i gang.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {assessments.map((a) => {
              const pipeline = normalizePipelineStatus(a.pipelineStatus);
              const prio = a.cachedPriorityScore ?? 0;
              return (
                <li key={a._id}>
                  <Link
                    href={`/w/${workspaceId}/a/${a._id}`}
                    className="hover:border-primary/25 block rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-heading leading-snug font-semibold">
                        {a.title}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                        {PIPELINE_STATUS_LABELS[pipeline]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm leading-snug">
                      {compliancePlainLine(a)}
                    </p>
                    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span title={new Date(a.updatedAt).toLocaleString("nb-NO")}>
                        Oppdatert {formatRelativeUpdatedAt(a.updatedAt)}
                      </span>
                      <span aria-hidden>·</span>
                      <span title="Beregnet prioritet fra skjema (0–100-skala)">
                        Prioritet {prio.toFixed(1)}
                      </span>
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
