"use client";

import { InviteEmailSuggestInput } from "@/components/user/invite-email-suggest-input";
import { UserAvatar } from "@/components/user-avatar";
import { AssessmentVersionsBlock } from "@/components/assessment-wizard/assessment-versions-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentTaskIssueTree } from "@/components/workspace/assessment-task-issue-tree";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssessmentPayload } from "@/lib/assessment-types";
import {
  ASSESSMENT_PAYLOAD_FIELD_LABELS_NB,
  labelAssessmentPayloadField,
} from "@/lib/assessment-payload-field-labels";
import {
  ASSESSMENT_COLLAB_ROLE_DESC_NB,
  ASSESSMENT_COLLAB_ROLE_LABEL_NB,
} from "@/lib/role-labels-nb";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useMutation, useQuery } from "convex/react";
import {
  ListTree,
  MessageSquareText,
  Share2,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type Props = {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  canEdit: boolean;
  /** Fra metaraden: åpne forhåndsvisning av denne milepælen én gang. */
  versionPreviewRequest?: number | null;
  onVersionPreviewRequestConsumed?: () => void;
  /** Kalles etter gjenoppretting fra versjon slik at veiviseren ikke stoler på gammel server-subscription. */
  onDraftRestored?: (
    payload: AssessmentPayload,
    meta?: { revision: number },
  ) => void;
};

export function AssessmentCollaborationPanel({
  assessmentId,
  workspaceId,
  canEdit,
  versionPreviewRequest,
  onVersionPreviewRequestConsumed,
  onDraftRestored,
}: Props) {
  const access = useQuery(api.assessments.getMyAccess, { assessmentId });
  const versions = useQuery(api.assessments.listVersions, { assessmentId });
  const collaborators = useQuery(api.assessments.listCollaborators, {
    assessmentId,
  });
  const workspaceMembers = useQuery(api.workspaces.listMembers, {
    workspaceId,
  });
  const notes = useQuery(api.assessmentNotes.listByAssessment, {
    assessmentId,
  });

  const invite = useMutation(api.assessments.inviteCollaborator);
  const removeCollaborator = useMutation(api.assessments.removeCollaborator);
  const updateCollaboratorRole = useMutation(
    api.assessments.updateCollaboratorRole,
  );
  const cancelAssessmentInvite = useMutation(
    api.assessments.cancelAssessmentInvite,
  );
  const setShare = useMutation(api.assessments.setShareWithWorkspace);
  const addNote = useMutation(api.assessmentNotes.add);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "editor" | "reviewer" | "viewer"
  >("reviewer");
  const [noteBody, setNoteBody] = useState("");
  const [noteFieldKey, setNoteFieldKey] = useState<string>("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [collabInviteMsg, setCollabInviteMsg] = useState<string | null>(null);

  const pendingAssessmentInvites = useQuery(
    api.assessments.listAssessmentInvites,
    canEdit ? { assessmentId } : "skip",
  );

  const noteFieldOptions = useMemo(() => {
    const entries = Object.entries(ASSESSMENT_PAYLOAD_FIELD_LABELS_NB);
    return entries.sort((a, b) => a[1].localeCompare(b[1], "nb-NO"));
  }, []);

  const submitNote = useCallback(async () => {
    setNoteError(null);
    const body = noteBody.trim();
    if (!body) return;
    try {
      await addNote({
        assessmentId,
        body,
        fieldKey: noteFieldKey.trim() || undefined,
      });
      setNoteBody("");
      setNoteFieldKey("");
    } catch (e) {
      setNoteError(formatUserFacingError(e));
    }
  }, [addNote, assessmentId, noteBody, noteFieldKey]);

  return (
    <div className="space-y-6">
      {/* Team — tydelig hvem som er med */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-border/50 bg-muted/25 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 flex size-9 items-center justify-center rounded-xl">
                <Users className="text-primary size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Team på denne vurderingen</CardTitle>
                <CardDescription>
                  Alle som er invitert ser aktivitet, oppfølging og notater her.
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {(collaborators ?? []).length}{" "}
              {(collaborators ?? []).length === 1 ? "person" : "personer"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {(collaborators ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ingen er invitert ennå — bruk skjemaet under for å legge til.
            </p>
          ) : (
            <ul className="space-y-2">
              {(collaborators ?? []).map((c) => {
                const label =
                  ASSESSMENT_COLLAB_ROLE_LABEL_NB[c.role] ?? c.role;
                const display = c.name ?? c.email ?? String(c.userId);
                const isOwner = c.role === "owner";
                return (
                  <li
                    key={c._id}
                    className="bg-card flex flex-col gap-2 rounded-2xl border px-3 py-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <UserAvatar name={display} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {display}
                          {access?.userId === c.userId ? (
                            <span className="text-muted-foreground ml-1 font-normal">
                              (deg)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground text-xs">{label}</p>
                        <p className="text-muted-foreground mt-0.5 max-w-prose text-[11px] leading-snug">
                          {ASSESSMENT_COLLAB_ROLE_DESC_NB[c.role] ?? ""}
                        </p>
                      </div>
                    </div>
                    {canEdit && !isOwner ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                          value={c.role}
                          onChange={(e) => {
                            const v = e.target.value as
                              | "editor"
                              | "reviewer"
                              | "viewer";
                            void updateCollaboratorRole({
                              assessmentId,
                              targetUserId: c.userId,
                              role: v,
                            });
                          }}
                        >
                          <option value="editor">Redaktør</option>
                          <option value="reviewer">Gjennomganger</option>
                          <option value="viewer">Visning</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => {
                            if (
                              typeof window !== "undefined" &&
                              window.confirm(
                                `Fjerne ${display} fra denne vurderingen? Hen har ikke lenger tilgang til saken.`,
                              )
                            ) {
                              void removeCollaborator({
                                assessmentId,
                                targetUserId: c.userId,
                              });
                            }
                          }}
                        >
                          Fjern
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AssessmentVersionsBlock
        assessmentId={assessmentId}
        versions={versions}
        canEdit={canEdit}
        previewRequestVersion={versionPreviewRequest ?? null}
        onPreviewRequestConsumed={onVersionPreviewRequestConsumed}
        onDraftRestored={onDraftRestored}
      />

      {canEdit &&
      pendingAssessmentInvites !== undefined &&
      pendingAssessmentInvites.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventende invitasjoner</CardTitle>
            <CardDescription>
              Trekkes tilbake om du angrer — brukeren har ikke fått tilgang
              før de logger inn med e-postadressen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingAssessmentInvites.map((inv) => (
              <div
                key={inv._id}
                className="flex flex-col gap-2 rounded-xl border border-dashed bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {ASSESSMENT_COLLAB_ROLE_LABEL_NB[inv.role] ?? inv.role} ·{" "}
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
                    void cancelAssessmentInvite({ inviteId: inv._id })
                  }
                >
                  Trekk invitasjon
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Invitasjon + deling */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-xs">
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="text-muted-foreground size-4" />
          <p className="font-medium text-sm">Tilgang og deling</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <InviteEmailSuggestInput
            id="collab-email"
            label="E-post"
            value={inviteEmail}
            onChange={setInviteEmail}
            placeholder="kollega@firma.no"
            disabled={!canEdit}
            source={{ kind: "assessment", assessmentId }}
            className="space-y-2"
            inputClassName="rounded-lg"
          />
          <div className="space-y-2 sm:w-44">
            <Label htmlFor="collab-role">Rolle</Label>
            <select
              id="collab-role"
              className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(
                  e.target.value as "editor" | "reviewer" | "viewer",
                )
              }
              disabled={!canEdit}
            >
              <option value="editor">Redaktør</option>
              <option value="reviewer">Gjennomganger</option>
              <option value="viewer">Visning</option>
            </select>
          </div>
          <Button
            disabled={!canEdit || !inviteEmail.trim()}
            onClick={() => {
              setCollabInviteMsg(null);
              void invite({
                assessmentId,
                email: inviteEmail.trim(),
                role: inviteRole,
              })
                .then((r) => {
                  setInviteEmail("");
                  if (r.kind === "pending") {
                    setCollabInviteMsg(
                      "Invitasjon registrert — aktiveres når brukeren logger inn med e-posten.",
                    );
                  } else if (r.kind === "linked") {
                    setCollabInviteMsg("Brukeren er lagt til på teamet.");
                  } else if (r.kind === "updated") {
                    setCollabInviteMsg("Rollen er oppdatert.");
                  } else {
                    setCollabInviteMsg(
                      "Brukeren var allerede med samme rolle.",
                    );
                  }
                })
                .catch((e) =>
                  setCollabInviteMsg(formatUserFacingError(e)),
                );
            }}
          >
            Inviter
          </Button>
        </div>
        {collabInviteMsg ? (
          <p className="text-muted-foreground mt-2 text-sm">{collabInviteMsg}</p>
        ) : null}
        <div className="mt-4 flex items-start gap-3">
          <Checkbox
            id="share-ws"
            checked={access?.shareWithWorkspace ?? false}
            onCheckedChange={(c) =>
              canEdit &&
              void setShare({
                assessmentId,
                shareWithWorkspace: c === true,
              })
            }
            disabled={!canEdit}
          />
          <Label htmlFor="share-ws" className="cursor-pointer leading-snug">
            <strong className="text-foreground">Delt med arbeidsområdet:</strong>{" "}
            alle medlemmer med medlemsrolle eller høyere kan åpne og redigere
            denne vurderingen (som når en post er synlig for hele gruppen).
            Slå av for å begrense til de som er listet over og
            arbeidsområde-administratorer.
          </Label>
        </div>
      </div>

      <Card className="border-border/70 bg-muted/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Roller på vurderingen</CardTitle>
          <CardDescription>
            Uavhengig av arbeidsområde-rollen — her styrer du hvem som kan
            endre skjemaet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>
            <strong className="text-foreground">Redaktør:</strong>{" "}
            {ASSESSMENT_COLLAB_ROLE_DESC_NB.editor}
          </p>
          <p>
            <strong className="text-foreground">Gjennomganger:</strong>{" "}
            {ASSESSMENT_COLLAB_ROLE_DESC_NB.reviewer}
          </p>
          <p>
            <strong className="text-foreground">Visning:</strong>{" "}
            {ASSESSMENT_COLLAB_ROLE_DESC_NB.viewer}
          </p>
          <p>
            <strong className="text-foreground">Eier:</strong>{" "}
            {ASSESSMENT_COLLAB_ROLE_DESC_NB.owner}
          </p>
        </CardContent>
      </Card>

      {/* Puls-kort knyttet til denne vurderingen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ListTree className="text-primary size-5 shrink-0" aria-hidden />
          <div>
            <h3 className="font-heading text-base font-semibold leading-tight">
              Kort på Puls
            </h3>
            <p className="text-muted-foreground text-sm">
              Hvert kort står for seg selv. Delkort er bare en kobling — opprett,
              koble til, eller fjern.
            </p>
          </div>
        </div>
        <AssessmentTaskIssueTree
          assessmentId={assessmentId}
          workspaceId={workspaceId}
          canEdit={canEdit}
          showGithub
        />
      </div>

      <Separator />

      {/* Notater — kort feed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="text-primary size-5" />
          <div>
            <h3 className="font-heading text-base font-semibold">
              Notater og avklaringer
            </h3>
            <p className="text-muted-foreground text-sm">
              Korte meldinger til teamet (ikke versjonert utkast — bruk
              versjonspunkter for milepæler). Du kan knytte et notat til et
              bestemt felt i skjemaet.
            </p>
          </div>
        </div>

        {noteError ? (
          <Alert variant="destructive">
            <AlertTitle>Kunne ikke lagre</AlertTitle>
            <AlertDescription>{noteError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="note-field" className="text-xs">
                Gjelder (valgfritt)
              </Label>
              <select
                id="note-field"
                className="border-input bg-background flex h-9 w-full rounded-lg border px-2 text-sm"
                value={noteFieldKey}
                onChange={(e) => setNoteFieldKey(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Hele vurderingen / generelt</option>
                {noteFieldOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Label htmlFor="note-composer" className="sr-only">
            Nytt notat
          </Label>
          <Textarea
            id="note-composer"
            value={noteBody}
            onChange={(e) => {
              setNoteBody(e.target.value);
              setNoteError(null);
            }}
            placeholder="Skriv et notat til teamet …"
            disabled={!canEdit}
            className="min-h-[88px]"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!canEdit || !noteBody.trim()}
              onClick={() => void submitNote()}
            >
              Publiser notat
            </Button>
          </div>
        </div>

        <ul className="max-h-[min(420px,50vh)] space-y-3 overflow-y-auto pr-1">
          {(notes ?? []).length === 0 ? (
            <li className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
              Ingen notater ennå.
            </li>
          ) : (
            (notes ?? []).map((n) => (
              <li
                key={n._id}
                className="rounded-2xl border bg-card p-4 shadow-xs"
              >
                <div className="flex gap-3">
                  <UserAvatar name={n.authorName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{n.authorName}</span>
                      {n.fieldKey ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {labelAssessmentPayloadField(n.fieldKey)}
                        </Badge>
                      ) : null}
                      <time
                        className="text-muted-foreground text-xs"
                        dateTime={new Date(n.createdAt).toISOString()}
                      >
                        {new Date(n.createdAt).toLocaleString("nb-NO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
