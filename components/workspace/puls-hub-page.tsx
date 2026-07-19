"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListViewModeToggle } from "@/components/ui/list-view-mode-toggle";
import { SearchInput } from "@/components/ui/search-input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/lib/app-toast";
import { isListViewMode, type ListViewMode } from "@/lib/list-view-mode";
import { pulsBoardCopy, pulsBoardPath } from "@/lib/puls-board-copy";
import { useStickyState } from "@/lib/use-sticky-state";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Activity,
  ArrowRight,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function roleLabel(role: "owner" | "editor" | "viewer") {
  if (role === "owner") return "Eier";
  if (role === "editor") return "Skriver";
  return "Leser";
}

type ColumnSource = "template" | "github";

type GithubColumnPreview = { id: string; name: string; isDone: boolean };

export function PulsHubPage({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [viewMode, setViewMode] = useStickyState<ListViewMode>(
    `ws:${workspaceId}:puls-hub:viewMode`,
    "cards",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createTemplate, setCreateTemplate] = useState<
    "empty" | "priority" | "phases"
  >("priority");
  const [columnSource, setColumnSource] = useState<ColumnSource>("template");
  const [githubProjects, setGithubProjects] = useState<
    { id: string; title: string }[]
  >([]);
  const [githubProjectId, setGithubProjectId] = useState("");
  const [githubColumns, setGithubColumns] = useState<GithubColumnPreview[]>(
    [],
  );
  const [githubFieldId, setGithubFieldId] = useState("");
  const [githubFieldName, setGithubFieldName] = useState("");
  const [importTasks, setImportTasks] = useState(false);
  const [assessmentChoice, setAssessmentChoice] = useState<"new" | "existing">(
    "new",
  );
  const [existingAssessmentId, setExistingAssessmentId] = useState<
    Id<"assessments"> | ""
  >("");
  const [githubBusy, setGithubBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const ensureDefaults = useMutation(api.pulsBoards.ensureDefaults);
  const createBoard = useMutation(api.pulsBoards.create);
  const createAssessment = useMutation(api.assessments.create);
  const acceptInvite = useMutation(api.pulsBoards.acceptInvite);
  const listGithubProjects = useAction(
    api.githubTasks.listGithubProjectsForPulsImport,
  );
  const previewGithubColumns = useAction(
    api.githubCandidateProject.previewGithubProjectColumnsForPuls,
  );
  const importGithubTasks = useAction(
    api.pulsGithubImport.importGithubProjectItemsToBoard,
  );

  const data = useQuery(api.pulsBoards.listMineInWorkspace, { workspaceId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const assessments = useQuery(api.assessments.listByWorkspace, {
    workspaceId,
  });
  const createTemplates = useQuery(api.pulsBoardColumns.listTemplates, {
    includeEmpty: true,
  });

  const workspaceGithubProjectId =
    workspace?.githubProjectNodeId?.trim() ?? "";

  useEffect(() => {
    void ensureDefaults({ workspaceId }).catch(() => {
      /* viewer uten rettigheter — ignore */
    });
  }, [ensureDefaults, workspaceId]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setCreateTemplate("priority");
    setColumnSource("template");
    setGithubProjects([]);
    setGithubProjectId("");
    setGithubColumns([]);
    setGithubFieldId("");
    setGithubFieldName("");
    setImportTasks(false);
    setAssessmentChoice("new");
    setExistingAssessmentId("");
  };

  const loadGithubProjects = async () => {
    setGithubBusy(true);
    try {
      const list = await listGithubProjects({ workspaceId });
      setGithubProjects(list);
      const preferred =
        list.find(
          (p: { id: string; title: string }) =>
            p.id === workspaceGithubProjectId,
        )?.id ??
        list[0]?.id ??
        "";
      setGithubProjectId(preferred);
      if (preferred) {
        await loadGithubColumns(preferred);
      } else if (workspaceGithubProjectId) {
        setGithubProjectId(workspaceGithubProjectId);
        await loadGithubColumns(workspaceGithubProjectId);
      } else {
        setGithubColumns([]);
        setGithubFieldId("");
        setGithubFieldName("");
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke hente GitHub-prosjekter",
      );
    } finally {
      setGithubBusy(false);
    }
  };

  const loadGithubColumns = async (projectNodeId: string) => {
    const id = projectNodeId.trim();
    if (!id) return;
    setGithubBusy(true);
    try {
      const preview = await previewGithubColumns({
        workspaceId,
        projectNodeId: id,
      });
      setGithubColumns(preview.columns);
      setGithubFieldId(preview.fieldId);
      setGithubFieldName(preview.fieldName);
      setGithubProjectId(preview.projectNodeId);
    } catch (err) {
      setGithubColumns([]);
      setGithubFieldId("");
      setGithubFieldName("");
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke hente kolonner fra prosjektet",
      );
    } finally {
      setGithubBusy(false);
    }
  };

  const boards = data?.boards ?? [];
  const pending = data?.pendingInvites ?? [];

  const filteredBoards = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => {
      const hay = [
        b.name,
        b.description ?? "",
        b.ownerName ?? "",
        roleLabel(b.myRole),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [boards, boardSearch]);

  const resolvedViewMode: ListViewMode = isListViewMode(viewMode)
    ? viewMode
    : "cards";

  const submitCreate = async () => {
    const n = name.trim();
    if (!n) {
      toast.error("Gi tavlen et navn");
      return;
    }
    if (columnSource === "github" && githubColumns.length === 0) {
      toast.error("Hent kolonner fra et GitHub-prosjekt først");
      return;
    }
    const shouldImportTasks =
      columnSource === "github" && importTasks && githubFieldId.trim() !== "";
    if (shouldImportTasks) {
      if (assessmentChoice === "existing" && !existingAssessmentId) {
        toast.error("Velg en vurdering for oppgavene");
        return;
      }
    }
    setBusy(true);
    try {
      const boardId = await createBoard({
        workspaceId,
        name: n,
        description: description.trim() || undefined,
        columnTemplate:
          columnSource === "template" ? createTemplate : undefined,
        columnNames:
          columnSource === "github"
            ? githubColumns.map((c) => c.name)
            : undefined,
      });

      if (shouldImportTasks) {
        let assessmentId: Id<"assessments">;
        if (assessmentChoice === "existing" && existingAssessmentId) {
          assessmentId = existingAssessmentId;
        } else {
          assessmentId = await createAssessment({
            workspaceId,
            title: n,
            shareWithWorkspace: true,
          });
        }
        const result = await importGithubTasks({
          workspaceId,
          boardId,
          assessmentId,
          projectNodeId: githubProjectId,
          fieldId: githubFieldId,
          columnMap: githubColumns.map((c) => ({
            githubOptionId: c.id,
            columnName: c.name,
          })),
        });
        const parts = [
          `${result.imported} oppgaver`,
          result.subIssues > 0 ? `${result.subIssues} under-saker` : null,
          result.comments > 0 ? `${result.comments} kommentarer` : null,
        ].filter(Boolean);
        const capNote = result.capped
          ? " (maks antall hentet — resten ble hoppet over)"
          : "";
        toast.success(`Tavle opprettet · ${parts.join(" · ")}${capNote}`);
      } else {
        toast.success(
          columnSource === "github"
            ? "Tavle opprettet med kolonner fra GitHub"
            : "Tavle opprettet",
        );
      }
      setCreateOpen(false);
      resetCreateForm();
      router.push(pulsBoardPath(workspaceId, boardId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-sky-500/[0.07] via-background to-violet-500/[0.06] px-4 py-5 sm:px-6">
        <div
          className="pointer-events-none absolute -top-16 right-0 size-48 rounded-full bg-sky-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="bg-sky-500/15 text-sky-900 dark:text-sky-100 inline-flex size-8 items-center justify-center rounded-xl">
                <Activity className="size-4" aria-hidden />
              </span>
              <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                Arbeidsrytme
              </p>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {pulsBoardCopy.pageTitle}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              {pulsBoardCopy.pageSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-10 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Ny tavle
            </Button>
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Invitasjoner til deg</h2>
          <ul className="space-y-2">
            {pending.map((inv) => (
              <li
                key={inv.inviteId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{inv.boardName}</p>
                  <p className="text-muted-foreground text-xs">
                    Rolle: {roleLabel(inv.role)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-9"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void acceptInvite({ inviteId: inv.inviteId })
                      .then((r) => {
                        toast.success("Invitasjon godtatt");
                        router.push(
                          pulsBoardPath(r.workspaceId, r.boardId),
                        );
                      })
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Kunne ikke godta",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Godta
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Dine tavler</h2>
          <p className="text-muted-foreground text-xs tabular-nums">
            {data === undefined
              ? "…"
              : boardSearch.trim()
                ? `${filteredBoards.length} av ${boards.length}`
                : `${boards.length} tavler`}
          </p>
        </div>

        {boards.length > 0 ? (
          <FilterToolbar className="w-full">
            <SearchInput
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              placeholder="Søk tavler…"
              aria-label="Søk i Puls-tavler"
              className="h-11 w-full min-w-0 rounded-full border-border/50 sm:max-w-sm"
            />
            <ListViewModeToggle
              value={resolvedViewMode}
              onChange={setViewMode}
            />
          </FilterToolbar>
        ) : null}

        {data === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/40 h-36 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center">
            <p className="text-sm font-medium">Ingen tavler ennå</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Opprett en tavle for å starte, eller be om en invitasjon.
            </p>
            <Button
              type="button"
              className="mt-4 min-h-10 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Ny tavle
            </Button>
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
            <p className="text-sm font-medium">Ingen treff</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Prøv et annet søkeord.
            </p>
          </div>
        ) : resolvedViewMode === "list" ? (
          <ul className="divide-border/50 divide-y rounded-2xl border border-border/50 bg-card">
            {filteredBoards.map((board) => (
              <li key={board._id}>
                <Link
                  href={pulsBoardPath(workspaceId, board._id)}
                  className="hover:bg-muted/30 flex min-h-14 items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {board.name}
                    </p>
                    {board.description ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {board.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {roleLabel(board.myRole)}
                  </span>
                  <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:inline">
                    {board.openCardCount} åpne
                  </span>
                  <ArrowRight
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : resolvedViewMode === "table" ? (
          <div className="overflow-x-auto rounded-2xl border border-border/50">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tavle</th>
                  <th className="px-3 py-2.5 font-medium">Rolle</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">
                    Eier
                  </th>
                  <th className="px-3 py-2.5 font-medium tabular-nums">Åpne</th>
                </tr>
              </thead>
              <tbody className="divide-border/40 divide-y">
                {filteredBoards.map((board) => (
                  <tr key={board._id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link
                        href={pulsBoardPath(workspaceId, board._id)}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {board.name}
                      </Link>
                      {board.description ? (
                        <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                          {board.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-3 py-3 text-xs">
                      {roleLabel(board.myRole)}
                    </td>
                    <td className="text-muted-foreground hidden px-3 py-3 text-xs sm:table-cell">
                      {board.ownerName ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      {board.openCardCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBoards.map((board) => (
              <li key={board._id}>
                <Link
                  href={pulsBoardPath(workspaceId, board._id)}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_0_rgba(27,31,36,0.04)] transition-colors",
                    "hover:border-sky-500/40 hover:bg-sky-500/[0.03] dark:shadow-none",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-base font-semibold leading-snug">
                      {board.name}
                    </p>
                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                      {roleLabel(board.myRole)}
                    </span>
                  </div>
                  {board.description ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                      {board.description}
                    </p>
                  ) : null}
                  <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-4 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" aria-hidden />
                      {board.ownerName ?? "—"}
                    </span>
                    <span className="tabular-nums">
                      {board.openCardCount} åpne
                    </span>
                  </div>
                  <span className="text-sky-800 dark:text-sky-200 mt-2 inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                    Åpne
                    <ArrowRight className="size-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent size="lg" titleId="create-puls-board-title">
          <DialogHeader>
            <h2
              id="create-puls-board-title"
              className="font-heading text-lg font-semibold"
            >
              Ny Puls-tavle
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Velg kolonnestruktur — mal eller importer fra GitHub Project. Du
              blir eier og kan invitere andre etterpå.
            </p>
          </DialogHeader>
          <DialogBody className="min-w-0 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="puls-board-name">Navn</Label>
              <Input
                id="puls-board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Q3 leveranse"
                className="min-h-11 sm:min-h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="puls-board-desc">Beskrivelse (valgfritt)</Label>
              <Textarea
                id="puls-board-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Kolonnekilde</Label>
              <div className="bg-muted/30 inline-flex rounded-xl border border-border/50 p-1">
                <button
                  type="button"
                  onClick={() => setColumnSource("template")}
                  className={cn(
                    "min-h-9 rounded-lg px-3 text-xs font-medium",
                    columnSource === "template"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Mal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setColumnSource("github");
                    if (githubColumns.length === 0 && !githubBusy) {
                      void loadGithubProjects();
                    }
                  }}
                  className={cn(
                    "min-h-9 rounded-lg px-3 text-xs font-medium",
                    columnSource === "github"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  GitHub Project
                </button>
              </div>
            </div>

            {columnSource === "template" ? (
              <div className="space-y-2">
                <Label>Kolonnestruktur</Label>
                <div className="grid min-w-0 gap-2">
                  {(createTemplates ?? []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setCreateTemplate(
                          t.id as "empty" | "priority" | "phases",
                        )
                      }
                      className={cn(
                        "min-w-0 rounded-xl border p-3 text-left transition-colors",
                        createTemplate === t.id
                          ? "border-sky-500/40 bg-sky-500/5 ring-1 ring-sky-500/20"
                          : "border-border/50 hover:bg-muted/40",
                      )}
                    >
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {t.description}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-[11px]">
                        {t.columnNames.join(" → ")}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Importer kolonner fra GitHub
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      Statusvalg fra Projects v2 blir Puls-kolonner. Krever
                      GitHub-token på arbeidsområdet.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9 gap-1.5"
                    disabled={githubBusy}
                    onClick={() => void loadGithubProjects()}
                  >
                    {githubBusy ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Hent prosjekter
                  </Button>
                </div>

                {githubProjects.length > 0 ? (
                  <div className="space-y-1">
                    <Label htmlFor="puls-gh-project">GitHub-prosjekt</Label>
                    <select
                      id="puls-gh-project"
                      className="border-input bg-background flex h-10 w-full min-w-0 rounded-lg border px-2 text-sm"
                      value={githubProjectId}
                      disabled={githubBusy}
                      onChange={(e) => {
                        const id = e.target.value;
                        setGithubProjectId(id);
                        void loadGithubColumns(id);
                      }}
                    >
                      {githubProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : workspaceGithubProjectId ? (
                  <p className="text-muted-foreground text-xs">
                    Bruker arbeidsområdets koblede prosjekt. Trykk «Hent
                    prosjekter» for å velge et annet.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Ingen prosjekter lastet ennå. Trykk «Hent prosjekter», eller
                    koble prosjekt under arbeidsområdets GitHub-innstillinger.
                  </p>
                )}

                {githubColumns.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">
                      Kolonner
                      {githubFieldName ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · felt «{githubFieldName}»
                        </span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {githubColumns.map((c) => c.name).join(" → ")}
                    </p>
                    <ul className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                      {githubColumns.map((c) => (
                        <li
                          key={c.id || c.name}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            c.isDone
                              ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {c.name}
                          {c.isDone ? " · ferdig" : ""}
                        </li>
                      ))}
                    </ul>

                    <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                      <Checkbox
                        checked={importTasks}
                        onCheckedChange={(checked) =>
                          setImportTasks(checked === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          Hent oppgaver også
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                          Kun lesing fra GitHub — ingen endringer der. Henter
                          tittel, beskrivelse, tildelte, start-/sluttdato,
                          labels, under-saker og kommentarer. Pull requests
                          hoppes over.
                        </span>
                      </span>
                    </label>

                    {importTasks ? (
                      <div className="space-y-2 rounded-lg border border-border/40 p-3">
                        <p className="text-xs font-medium">
                          Vurdering for oppgavene
                        </p>
                        <div className="bg-muted/30 inline-flex rounded-lg border border-border/50 p-0.5">
                          <button
                            type="button"
                            onClick={() => setAssessmentChoice("new")}
                            className={cn(
                              "min-h-8 rounded-md px-2.5 text-xs font-medium",
                              assessmentChoice === "new"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Ny vurdering
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssessmentChoice("existing")}
                            className={cn(
                              "min-h-8 rounded-md px-2.5 text-xs font-medium",
                              assessmentChoice === "existing"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Eksisterende
                          </button>
                        </div>
                        {assessmentChoice === "new" ? (
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Oppretter en vurdering med samme navn som tavlen.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <Label htmlFor="puls-gh-assessment">Vurdering</Label>
                            <select
                              id="puls-gh-assessment"
                              className="border-input bg-background flex h-10 w-full min-w-0 rounded-lg border px-2 text-sm"
                              value={existingAssessmentId}
                              onChange={(e) =>
                                setExistingAssessmentId(
                                  e.target.value as Id<"assessments"> | "",
                                )
                              }
                            >
                              <option value="">Velg vurdering…</option>
                              {(assessments ?? []).map((a) => (
                                <option key={a._id} value={a._id}>
                                  {a.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !name.trim() ||
                (columnSource === "github" && githubColumns.length === 0) ||
                (columnSource === "github" &&
                  importTasks &&
                  assessmentChoice === "existing" &&
                  !existingAssessmentId)
              }
              onClick={() => void submitCreate()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
              ) : null}
              {importTasks && columnSource === "github"
                ? "Opprett og hent oppgaver"
                : "Opprett tavle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
