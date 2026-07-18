"use client";

import { TaskGithubControls } from "@/components/tasks/task-github-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardDescriptionEditor } from "@/components/ui/card-description-editor";
import { htmlToPlainText, isEmptyRichText } from "@/lib/rich-text";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { effectiveGithubDefaultRepos } from "@/lib/github-workspace-helpers";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Link2,
  ListTree,
  Send,
  Unlink,
} from "lucide-react";
import { useMemo, useState } from "react";

type EnrichedTask = {
  _id: Id<"assessmentTasks">;
  title: string;
  description?: string;
  status: "open" | "done";
  parentTaskId?: Id<"assessmentTasks">;
  parentTitle: string | null;
  subIssueCount: number;
  subIssueDoneCount: number;
  assignees: { userId: Id<"users">; name: string }[];
  assigneeName: string | null;
  githubIssueUrl?: string | null;
};

/**
 * Puls-kort for en vurdering: flate kort med valgfri delkort-kobling.
 */
export function AssessmentTaskIssueTree({
  assessmentId,
  workspaceId,
  canEdit = true,
  showGithub = false,
}: {
  assessmentId: Id<"assessments">;
  workspaceId: Id<"workspaces">;
  canEdit?: boolean;
  showGithub?: boolean;
}) {
  const tasks = useQuery(api.assessmentTasks.listByAssessment, {
    assessmentId,
  });
  const members = useQuery(api.workspaces.listMembers, { workspaceId });
  const workspace = useQuery(
    api.workspaces.get,
    showGithub ? { workspaceId } : "skip",
  );
  const createTask = useMutation(api.assessmentTasks.create);
  const setParent = useMutation(api.assessmentTasks.setParent);
  const setStatus = useMutation(api.assessmentTasks.setStatus);
  const githubDefaultRepos = useMemo(
    () => effectiveGithubDefaultRepos(workspace ?? null),
    [workspace],
  );

  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  /** Når satt: opprett neste sak allerede koblet som under-sak */
  const [createLinkedTo, setCreateLinkedTo] = useState<
    Id<"assessmentTasks"> | ""
  >("");
  /** Kort som venter på at bruker velger hvilket issue det skal kobles under */
  const [linkingCardId, setLinkingCardId] = useState<Id<"assessmentTasks"> | null>(
    null,
  );
  const [linkParentId, setLinkParentId] = useState<Id<"assessmentTasks"> | "">(
    "",
  );

  const memberOptions = useMemo(() => {
    return (members ?? [])
      .map((m) => ({
        userId: m.userId as Id<"users">,
        label: m.name?.trim() || m.email || "Medlem",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  }, [members]);

  const enriched = (tasks ?? []) as EnrichedTask[];

  /** Alle kort flat — som GitHub issue-liste / projects-board */
  const cards = useMemo(() => {
    return [...enriched].sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return a.title.localeCompare(b.title, "nb");
    });
  }, [enriched]);

  const depthById = useMemo(() => {
    const parentMap = new Map(
      enriched.map((t) => [t._id, t.parentTaskId] as const),
    );
    const depths = new Map<Id<"assessmentTasks">, number>();
    for (const t of enriched) {
      let depth = 0;
      let cur = t.parentTaskId;
      const seen = new Set<Id<"assessmentTasks">>();
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        depth += 1;
        cur = parentMap.get(cur);
      }
      depths.set(t._id, depth);
    }
    return depths;
  }, [enriched]);

  const descendantIdsOf = (rootId: Id<"assessmentTasks">) => {
    const childrenByParent = new Map<
      Id<"assessmentTasks">,
      Id<"assessmentTasks">[]
    >();
    for (const t of enriched) {
      if (!t.parentTaskId) continue;
      const list = childrenByParent.get(t.parentTaskId) ?? [];
      list.push(t._id);
      childrenByParent.set(t.parentTaskId, list);
    }
    const out = new Set<Id<"assessmentTasks">>();
    const stack = [...(childrenByParent.get(rootId) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const kid of childrenByParent.get(id) ?? []) stack.push(kid);
    }
    return out;
  };

  /** Alle saker kan være forelder (flernivå), unntatt selv og egne etterkommere */
  const parentCandidates = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const da = depthById.get(a._id) ?? 0;
      const db = depthById.get(b._id) ?? 0;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title, "nb");
    });
  }, [enriched, depthById]);

  const parentOptionLabel = (t: EnrichedTask) => {
    const depth = depthById.get(t._id) ?? 0;
    const prefix = depth > 0 ? `${"↳ ".repeat(Math.min(depth, 5))}` : "";
    return `${prefix}${t.title}`;
  };

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const submitCreate = async () => {
    const t = title.trim();
    if (!t) {
      toast.error("Tittel mangler");
      return;
    }
    setBusy(true);
    try {
      await createTask({
        assessmentId,
        title: t,
        description: isEmptyRichText(description)
          ? undefined
          : description,
        assigneeUserIds:
          selectedUserIds.length > 0 ? selectedUserIds : undefined,
        parentTaskId: createLinkedTo || undefined,
      });
      setTitle("");
      setDescription("");
      setSelectedUserIds([]);
      setCreateLinkedTo("");
      toast.success(
        createLinkedTo
          ? "Nytt delkort opprettet"
          : "Nytt kort opprettet",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke opprette");
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!linkingCardId || !linkParentId) {
      toast.error("Velg hvilket issue kortet skal kobles til");
      return;
    }
    setBusy(true);
    try {
      await setParent({ taskId: linkingCardId, parentTaskId: linkParentId });
      setLinkingCardId(null);
      setLinkParentId("");
      toast.success("Kortet er koblet som delkort");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke koble");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (taskId: Id<"assessmentTasks">) => {
    setBusy(true);
    try {
      await setParent({ taskId, parentTaskId: null });
      toast.success("Kobling fjernet — kortet er på toppnivå");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke fjerne kobling");
    } finally {
      setBusy(false);
    }
  };

  if (tasks === undefined) {
    return <p className="text-muted-foreground text-sm">Laster saker …</p>;
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ListTree className="size-4 shrink-0" aria-hidden />
            Nytt kort
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tittel"
            className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
          />
          <CardDescriptionEditor
            value={description}
            onChange={setDescription}
            rows={4}
            aria-label="Beskrivelse"
            startInEditMode
          />
          <div className="space-y-1.5">
            <Label className="text-sm">Kobling (valgfritt)</Label>
            <select
              className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
              value={createLinkedTo}
              onChange={(e) =>
                setCreateLinkedTo(
                  e.target.value as Id<"assessmentTasks"> | "",
                )
              }
            >
              <option value="">Ingen — toppnivå</option>
              {parentCandidates.map((p) => (
                <option key={p._id} value={p._id}>
                  Under: {parentOptionLabel(p)}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-[11px]">
              Du kan legge delkort under andre delkort — flere nivåer.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Tildel (valgfritt)</Label>
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-xl border border-border/50 p-1.5">
              {memberOptions.map((m) => {
                const selected = selectedUserIds.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleUser(m.userId)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                      selected ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border",
                      )}
                    >
                      {selected ? <CheckCircle2 className="size-3" /> : null}
                    </span>
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={busy || !title.trim()}
              onClick={() => void submitCreate()}
            >
              <Send className="size-3.5" />
              Opprett kort
            </Button>
          </div>
        </div>
      ) : null}

      {linkingCardId && canEdit ? (
        <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="text-sm font-medium">
            Koble som delkort — velg forelder
          </p>
          <select
            className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
            value={linkParentId}
            onChange={(e) =>
              setLinkParentId(e.target.value as Id<"assessmentTasks"> | "")
            }
          >
            <option value="">Velg sak …</option>
            {parentCandidates
              .filter((p) => {
                if (p._id === linkingCardId) return false;
                return !descendantIdsOf(linkingCardId).has(p._id);
              })
              .map((p) => (
                <option key={p._id} value={p._id}>
                  {parentOptionLabel(p)}
                </option>
              ))}
          </select>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setLinkingCardId(null);
                setLinkParentId("");
              }}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={busy || !linkParentId}
              onClick={() => void confirmLink()}
            >
              <Link2 className="size-3.5" />
              Koble
            </Button>
          </div>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ingen kort ennå. Opprett et kort — deretter kan du koble andre som
          delkort.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-1">
          {cards.map((card) => {
            const isSub = Boolean(card.parentTaskId);
            const depth = depthById.get(card._id) ?? 0;
            const canLinkUnderOther = parentCandidates.some(
              (p) =>
                p._id !== card._id && !descendantIdsOf(card._id).has(p._id),
            );

            return (
              <li
                key={card._id}
                className={cn(
                  "rounded-xl border bg-card px-3 py-3 shadow-xs",
                  card.status === "done" && "opacity-75",
                  isSub
                    ? "border-l-[3px] border-l-sky-500/70 border-border/50"
                    : "border-border/50",
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      {isSub ? (
                        <p className="text-sky-800 dark:text-sky-200 inline-flex items-center gap-1 text-[11px] font-medium">
                          <Link2 className="size-3 shrink-0" aria-hidden />
                          Under: {card.parentTitle ?? "…"}
                          {depth > 1 ? (
                            <span className="text-muted-foreground font-normal">
                              · nivå {depth}
                            </span>
                          ) : null}
                        </p>
                      ) : card.subIssueCount > 0 ? (
                        <p className="text-muted-foreground text-[11px] font-medium">
                          Kort · {card.subIssueDoneCount}/{card.subIssueCount}{" "}
                          delkort ferdig
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-[11px] font-medium">
                          Kort
                        </p>
                      )}
                      <p
                        className={cn(
                          "text-sm font-semibold leading-snug",
                          card.status === "done" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {card.title}
                      </p>
                      {card.description &&
                      !isEmptyRichText(card.description) ? (
                        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                          {htmlToPlainText(card.description)}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        {card.assigneeName
                          ? card.assigneeName
                          : "Ikke tildelt"}
                        {card.status === "done" ? " · Ferdig" : " · Åpen"}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={busy}
                          onClick={() =>
                            void setStatus({
                              taskId: card._id,
                              status:
                                card.status === "open" ? "done" : "open",
                            })
                          }
                        >
                          {card.status === "open" ? "Fullfør" : "Gjenåpne"}
                        </Button>
                        {isSub ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            disabled={busy}
                            title="Fjern kobling til forelder"
                            onClick={() => void unlink(card._id)}
                          >
                            <Unlink className="size-3.5" />
                            Fjern kobling
                          </Button>
                        ) : null}
                        {canLinkUnderOther ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            disabled={busy}
                            title="Koble dette kortet som delkort under et annet"
                            onClick={() => {
                              setLinkingCardId(card._id);
                              setLinkParentId("");
                            }}
                          >
                            <Link2 className="size-3.5" />
                            Koble til kort
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={busy}
                          title="Opprett nytt delkort under dette"
                          onClick={() => setCreateLinkedTo(card._id)}
                        >
                          + Delkort
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {card.subIssueCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-foreground/70 h-full rounded-full"
                          style={{
                            width: `${Math.round(
                              (card.subIssueDoneCount / card.subIssueCount) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {card.subIssueDoneCount}/{card.subIssueCount}
                      </span>
                    </div>
                  ) : null}

                  {showGithub ? (
                    <TaskGithubControls
                      taskId={card._id}
                      canEdit={canEdit}
                      githubIssueUrl={card.githubIssueUrl ?? null}
                      workspaceDefaultRepos={githubDefaultRepos}
                      compact
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
