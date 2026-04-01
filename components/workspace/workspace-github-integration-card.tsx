"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getConvexGithubWebhookUrl } from "@/lib/convex-github-webhook-url";
import {
  effectiveGithubDefaultRepos,
  normalizeGithubRepoInput,
} from "@/lib/github-workspace-helpers";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Check,
  ClipboardCopy,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  workspaceId: Id<"workspaces">;
  workspace: Doc<"workspaces">;
};

export function WorkspaceGithubIntegrationCard({ workspaceId, workspace }: Props) {
  const githubTokenStatus = useQuery(
    api.githubTasks.getWorkspaceGithubTokenStatus,
    { workspaceId },
  );
  const setGithubToken = useAction(api.githubTasks.setWorkspaceGithubToken);
  const clearGithubToken = useMutation(api.githubTasks.clearWorkspaceGithubToken);
  const listProjects = useAction(api.githubTasks.listGithubProjectsForWorkspace);
  const fetchProjectNodeByOwner = useAction(
    api.githubTasks.fetchGithubProjectNodeByOwner,
  );
  const testGithubConnection = useAction(
    api.githubTasks.testGithubWorkspaceConnection,
  );
  const testGithubProjectAccess = useAction(api.githubTasks.testGithubProjectAccess);
  const listGithubProjectSingleSelectFields = useAction(
    api.githubCandidateProject.listGithubProjectSingleSelectFields,
  );
  const updateWorkspace = useMutation(api.workspaces.update);

  const [tokenInput, setTokenInput] = useState("");
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [connectionTestLoading, setConnectionTestLoading] = useState(false);
  const [connectionTestMessage, setConnectionTestMessage] = useState<
    string | null
  >(null);
  const [repoDraft, setRepoDraft] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [projectNodeId, setProjectNodeId] = useState("");
  const [projectOptions, setProjectOptions] = useState<
    { id: string; title: string }[]
  >([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectOwnerKind, setProjectOwnerKind] = useState<
    "user" | "organization"
  >("user");
  const [projectOwnerLogin, setProjectOwnerLogin] = useState("");
  const [projectNumberInput, setProjectNumberInput] = useState("");
  const [projectResolveLoading, setProjectResolveLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [githubSaveMessage, setGithubSaveMessage] = useState<string | null>(
    null,
  );
  const [repoHint, setRepoHint] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState<string | null>(null);
  const [projectAccessTestLoading, setProjectAccessTestLoading] =
    useState(false);
  const [projectAccessTestMessage, setProjectAccessTestMessage] = useState<
    string | null
  >(null);
  const [singleSelectFieldId, setSingleSelectFieldId] = useState("");
  const [singleSelectFields, setSingleSelectFields] = useState<
    { id: string; name: string; optionCount: number }[]
  >([]);
  const [singleSelectFieldsLoading, setSingleSelectFieldsLoading] =
    useState(false);
  const [singleSelectFieldsError, setSingleSelectFieldsError] = useState<
    string | null
  >(null);

  const webhookUrl = useMemo(() => getConvexGithubWebhookUrl(), []);

  useEffect(() => {
    setRepos(effectiveGithubDefaultRepos(workspace));
    setProjectNodeId(workspace.githubProjectNodeId ?? "");
    setSelectedProjectId("");
    setSingleSelectFieldId(workspace.githubProjectSingleSelectFieldId ?? "");
  }, [workspace]);

  useEffect(() => {
    if (!projectNodeId || projectOptions.length === 0) return;
    const match = projectOptions.find((p) => p.id === projectNodeId);
    if (match) setSelectedProjectId(match.id);
  }, [projectNodeId, projectOptions]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(label);
      setTimeout(() => setCopyDone(null), 2000);
    } catch {
      setCopyDone(null);
    }
  }

  async function resolveProjectNodeFromUrl() {
    setProjectsError(null);
    setProjectResolveLoading(true);
    try {
      const num = parseInt(projectNumberInput.trim(), 10);
      if (Number.isNaN(num) || num < 1) {
        throw new Error(
          "Oppgi prosjektnummer fra URL (f.eks. …/projects/6 → 6).",
        );
      }
      const login = projectOwnerLogin.trim();
      if (!login) {
        throw new Error("Oppgi brukernavn eller organisasjonsnavn.");
      }
      const result = await fetchProjectNodeByOwner({
        workspaceId,
        ownerLogin: login,
        projectNumber: num,
        ownerKind: projectOwnerKind,
      });
      setProjectNodeId(result.id);
      setSelectedProjectId("");
      setGithubSaveMessage(
        `Node-ID hentet for «${result.title}». Trykk «Lagre repo og prosjekt» nedenfor.`,
      );
    } catch (e) {
      setProjectsError(
        e instanceof Error ? e.message : "Kunne ikke hente prosjekt-ID.",
      );
    } finally {
      setProjectResolveLoading(false);
    }
  }

  async function fetchProjects() {
    setProjectsError(null);
    setProjectsLoading(true);
    try {
      const rows = await listProjects({ workspaceId });
      setProjectOptions(rows);
      if (projectNodeId && rows.some((r) => r.id === projectNodeId)) {
        setSelectedProjectId(projectNodeId);
      }
    } catch (e) {
      setProjectsError(
        e instanceof Error ? e.message : "Kunne ikke hente prosjekter.",
      );
      setProjectOptions([]);
    } finally {
      setProjectsLoading(false);
    }
  }

  function addRepo() {
    setRepoHint(null);
    try {
      const n = normalizeGithubRepoInput(repoDraft);
      setRepos((prev) => {
        if (prev.includes(n)) return prev;
        return [...prev, n];
      });
      setRepoDraft("");
    } catch (e) {
      setRepoHint(e instanceof Error ? e.message : "Ugyldig repo.");
    }
  }

  function removeRepo(r: string) {
    setRepos((prev) => prev.filter((x) => x !== r));
  }

  async function loadSingleSelectFields() {
    setSingleSelectFieldsError(null);
    setSingleSelectFieldsLoading(true);
    try {
      const r = await listGithubProjectSingleSelectFields({ workspaceId });
      setSingleSelectFields(r.fields);
    } catch (e) {
      setSingleSelectFields([]);
      setSingleSelectFieldsError(
        e instanceof Error ? e.message : "Kunne ikke hente kolonner.",
      );
    } finally {
      setSingleSelectFieldsLoading(false);
    }
  }

  async function saveGithubReposAndProject() {
    setGithubSaveMessage(null);
    try {
      await updateWorkspace({
        workspaceId,
        githubDefaultRepoFullNames: repos.length > 0 ? repos : null,
        githubProjectNodeId:
          projectNodeId.trim() === "" ? null : projectNodeId.trim(),
        githubProjectSingleSelectFieldId:
          singleSelectFieldId.trim() === "" ? null : singleSelectFieldId.trim(),
      });
      setGithubSaveMessage("GitHub-innstillinger er lagret.");
    } catch (e) {
      setGithubSaveMessage(
        e instanceof Error ? e.message : "Kunne ikke lagre.",
      );
    }
  }

  const tokenOk = githubTokenStatus?.hasWorkspaceToken ?? false;

  return (
    <Card
      id="github-arbeidsomrade"
      className="border-border/60 from-muted/30 scroll-mt-24 overflow-hidden bg-gradient-to-br to-transparent shadow-sm"
    >
      <CardHeader className="border-border/50 border-b bg-card/80 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
              <GitBranch className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="font-heading text-lg tracking-tight">
                GitHub
              </CardTitle>
              <CardDescription className="mt-1 max-w-xl text-pretty leading-relaxed">
                Koble arbeidsområdet til én eller flere repoer og valgfritt
                prosjekt. Vi lagrer ikke hemmeligheter i nettleseren — token
                ligger kryptert i backend.
              </CardDescription>
            </div>
          </div>
          {tokenOk ? (
            <Badge
              variant="secondary"
              className="h-7 shrink-0 gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            >
              <Check className="size-3.5" aria-hidden />
              Tilkoblet
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground h-7">
              Ikke konfigurert
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8 pt-6">
        {/* Token */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="text-muted-foreground size-4" aria-hidden />
            Tilgangstoken
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Fine-grained eller klassisk{" "}
            <abbr title="Personal Access Token" className="cursor-help">
              PAT
            </abbr>
            . For flere repoer: velg alle relevante repoer i token-innstillingene
            på GitHub, eller bruk organisasjons-token med riktig omfang.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={
                tokenOk
                  ? "Lim inn nytt token for å bytte …"
                  : "github_pat_… eller ghp_…"
              }
              className="h-11 min-w-0 flex-1 font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="h-11 shrink-0"
                disabled={!tokenInput.trim() || githubTokenStatus === undefined}
                onClick={() => {
                  setTokenMessage(null);
                  void (async () => {
                    try {
                      await setGithubToken({
                        workspaceId,
                        token: tokenInput.trim(),
                      });
                      setTokenInput("");
                      setTokenMessage("Token er lagret og verifisert.");
                    } catch (e) {
                      setTokenMessage(
                        e instanceof Error ? e.message : "Kunne ikke lagre.",
                      );
                    }
                  })();
                }}
              >
                Lagre token
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={!tokenOk}
                onClick={() => {
                  setTokenMessage(null);
                  void (async () => {
                    try {
                      await clearGithubToken({ workspaceId });
                      setTokenMessage("Token fjernet.");
                    } catch (e) {
                      setTokenMessage(
                        e instanceof Error ? e.message : "Kunne ikke fjerne.",
                      );
                    }
                  })();
                }}
              >
                Fjern
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 shrink-0 gap-2"
                disabled={
                  githubTokenStatus === undefined || connectionTestLoading
                }
                onClick={() => {
                  setConnectionTestMessage(null);
                  setTokenMessage(null);
                  void (async () => {
                    setConnectionTestLoading(true);
                    try {
                      const r = await testGithubConnection({ workspaceId });
                      if (r.ok) {
                        const src =
                          r.tokenSource === "workspace"
                            ? "arbeidsområdets token"
                            : "GITHUB_TOKEN i Convex";
                        const rest =
                          typeof r.projectsV2RestCount === "number"
                            ? ` Via REST (GitHub API) ble ${r.projectsV2RestCount} prosjekt(er) (Projects v2) funnet — du kan hente listen under.`
                            : "";
                        setConnectionTestMessage(
                          `Kobling OK: innlogget som ${r.login}${r.name ? ` (${r.name})` : ""}. Bruker ${src}.${rest}`,
                        );
                      } else {
                        setConnectionTestMessage(r.message);
                      }
                    } catch (e) {
                      setConnectionTestMessage(
                        e instanceof Error
                          ? e.message
                          : "Kunne ikke teste koblingen.",
                      );
                    } finally {
                      setConnectionTestLoading(false);
                    }
                  })();
                }}
              >
                {connectionTestLoading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : null}
                Test kobling
              </Button>
            </div>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a
              href="https://github.com/settings/tokens?type=beta"
              className="text-primary font-medium underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fine-grained token
            </a>
            <a
              href="https://github.com/settings/tokens"
              className="text-primary font-medium underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Klassisk token
            </a>
            <span>
              Valgfri felles fallback i Convex:{" "}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.7rem]">
                GITHUB_TOKEN
              </code>
            </span>
          </div>
          {githubTokenStatus?.updatedAt ? (
            <p className="text-muted-foreground text-xs" role="status">
              Sist oppdatert{" "}
              {new Date(githubTokenStatus.updatedAt).toLocaleString("nb-NO")}
            </p>
          ) : null}
          {tokenMessage ? (
            <p
              className={cn(
                "text-sm",
                tokenMessage.includes("verifisert") ||
                  tokenMessage.includes("fjernet")
                  ? "text-muted-foreground"
                  : "text-destructive",
              )}
              role="status"
            >
              {tokenMessage}
            </p>
          ) : null}
          {connectionTestMessage ? (
            <p
              className={cn(
                "text-sm",
                connectionTestMessage.startsWith("Kobling OK:")
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-destructive",
              )}
              role="status"
            >
              {connectionTestMessage}
            </p>
          ) : null}
        </section>

        <Separator />

        {/* Repos */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="text-muted-foreground size-4" aria-hidden />
            Standard-repoer
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Én eller mange — f.eks. når et prosjekt spenner flere kodebaser.
            Ved <strong className="text-foreground font-medium">Opprett issue</strong>{" "}
            brukes <strong className="text-foreground font-medium">første</strong>{" "}
            repo i listen som standard; du kan fortsatt koble til issues i andre
            repoer manuelt.
          </p>
          {repos.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {repos.map((r) => (
                <li key={r}>
                  <Badge
                    variant="secondary"
                    className="hover:bg-secondary/80 gap-1.5 py-1.5 pr-1 pl-2 font-mono text-xs"
                  >
                    {r}
                    <button
                      type="button"
                      className="hover:bg-foreground/10 rounded-md p-0.5"
                      aria-label={`Fjern ${r}`}
                      onClick={() => removeRepo(r)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground border-border/60 bg-muted/20 rounded-lg border border-dashed px-3 py-6 text-center text-sm">
              Ingen repo lagt inn ennå.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={repoDraft}
              onChange={(e) => setRepoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRepo();
                }
              }}
              placeholder="eier/repo"
              className="h-11 font-mono text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-11 shrink-0 gap-1.5"
              onClick={() => addRepo()}
            >
              <Plus className="size-4" aria-hidden />
              Legg til
            </Button>
          </div>
          {repoHint ? (
            <p className="text-destructive text-sm" role="alert">
              {repoHint}
            </p>
          ) : null}
        </section>

        <Separator />

        {/* Project */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="text-muted-foreground size-4" aria-hidden />
            GitHub-prosjekt (valgfritt)
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Nye issues fra PVV kan legges inn i en prosjekt-tavle. Hent listen
            under (krever lagret token med{" "}
            <strong className="text-foreground font-medium">
              tilgang til Projects
            </strong>{" "}
            på PAT), eller lim inn node-ID manuelt — da trengs ikke listen.
          </p>
          <p className="text-muted-foreground rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed">
            <strong className="text-foreground">Fine-grained token:</strong> åpne
            tokenet på GitHub og velg fanen{" "}
            <strong className="text-foreground">Account</strong> (ved siden av
            «Repositories»). Der må <strong className="text-foreground">Projects</strong>{" "}
            være aktivert — hvis Account viser{" "}
            <span className="font-mono">0</span> tillatelser, er det årsaken til
            «liste prosjekter»-feil. Repo-tillatelser (Issues, Actions) erstatter
            ikke Projects på konto-nivå.
          </p>

          <div className="bg-muted/25 space-y-3 rounded-xl border border-dashed p-4">
            <p className="text-foreground text-sm font-medium">
              Hent node-ID fra prosjekt-URL
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Eksempel:{" "}
              <code className="font-mono text-[0.7rem]">
                …/users/job000/projects/6
              </code>{" "}
              (bruker) eller{" "}
              <code className="font-mono text-[0.7rem]">
                …/orgs/min-org/projects/3
              </code>{" "}
              (org). Fyll inn navn og nummer fra URL-en, deretter «Hent».
            </p>
            {projectOwnerKind === "organization" ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                For org-prosjekt med fine-grained token: legg til organisasjonen
                under token-innstillinger og gi Projects-tilgang for den orgen.
                Klassisk PAT med{" "}
                <code className="font-mono text-[0.7rem]">read:project</code>{" "}
                fungerer ofte enklere.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gh-project-owner-kind">Type</Label>
                <select
                  id="gh-project-owner-kind"
                  className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm"
                  value={projectOwnerKind}
                  onChange={(e) =>
                    setProjectOwnerKind(
                      e.target.value === "organization"
                        ? "organization"
                        : "user",
                    )
                  }
                  disabled={!tokenOk}
                >
                  <option value="user">Bruker (/users/…/projects/N)</option>
                  <option value="organization">
                    Organisasjon (/orgs/…/projects/N)
                  </option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gh-project-owner-login">Navn</Label>
                <Input
                  id="gh-project-owner-login"
                  value={projectOwnerLogin}
                  onChange={(e) => setProjectOwnerLogin(e.target.value)}
                  placeholder="job000"
                  className="h-11 font-mono text-sm"
                  disabled={!tokenOk}
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="gh-project-num">Nr</Label>
                <Input
                  id="gh-project-num"
                  inputMode="numeric"
                  value={projectNumberInput}
                  onChange={(e) => setProjectNumberInput(e.target.value)}
                  placeholder="6"
                  className="h-11 font-mono text-sm"
                  disabled={!tokenOk}
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full gap-2"
                  disabled={projectResolveLoading || !tokenOk}
                  onClick={() => void resolveProjectNodeFromUrl()}
                >
                  {projectResolveLoading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : null}
                  Hent
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 sm:w-auto"
              disabled={projectsLoading || !tokenOk}
              onClick={() => void fetchProjects()}
            >
              {projectsLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Hent mine prosjekter
            </Button>
            {projectOptions.length > 0 ? (
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="gh-project-select" className="sr-only">
                  Velg prosjekt
                </Label>
                <select
                  id="gh-project-select"
                  className="border-input bg-background h-11 w-full rounded-lg border px-3 text-sm"
                  value={selectedProjectId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedProjectId(v);
                    setProjectNodeId(v);
                  }}
                >
                  <option value="">— Velg prosjekt —</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {projectsError ? (
            <p className="text-destructive text-sm" role="alert">
              {projectsError}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="gh-project-node" className="text-xs">
              Node-ID (avansert / manuelt)
            </Label>
            <Input
              id="gh-project-node"
              value={projectNodeId}
              onChange={(e) => {
                setProjectNodeId(e.target.value);
                setSelectedProjectId("");
              }}
              placeholder="PVT_kwDO…"
              className="font-mono text-sm"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-fit gap-2"
                disabled={
                  projectAccessTestLoading || githubTokenStatus === undefined
                }
                onClick={() => {
                  setProjectAccessTestMessage(null);
                  void (async () => {
                    setProjectAccessTestLoading(true);
                    try {
                      const r = await testGithubProjectAccess({ workspaceId });
                      if (r.ok) {
                        setProjectAccessTestMessage(
                          `Prosjekt OK: «${r.projectTitle}». Opprett et issue fra en oppgave for å se at kortet havner i prosjekt-tavlen.`,
                        );
                      } else {
                        setProjectAccessTestMessage(r.message);
                      }
                    } catch (e) {
                      setProjectAccessTestMessage(
                        e instanceof Error
                          ? e.message
                          : "Kunne ikke teste prosjekt.",
                      );
                    } finally {
                      setProjectAccessTestLoading(false);
                    }
                  })();
                }}
              >
                {projectAccessTestLoading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : null}
                Test lagret prosjekt
              </Button>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Leser node-ID fra databasen (lagre under etter endring). Full
                endrings-test: <strong className="text-foreground font-medium">Opprett issue</strong>{" "}
                på en oppgave og sjekk prosjektet på GitHub.
              </p>
            </div>
            {projectAccessTestMessage ? (
              <p
                className={cn(
                  "text-sm",
                  projectAccessTestMessage.startsWith("Prosjekt OK:")
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-destructive",
                )}
                role="status"
              >
                {projectAccessTestMessage}
              </p>
            ) : null}
          </div>

          {tokenOk && projectNodeId.trim().length > 0 ? (
            <div className="bg-muted/20 space-y-3 rounded-xl border border-border/50 p-4">
              <div className="space-y-1">
                <Label className="text-foreground text-sm font-medium">
                  Prosjektkolonne for PVV (enkeltvalg)
                </Label>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  PVV leser og oppdaterer <strong className="text-foreground">én</strong>{" "}
                  kolonne (single select) i prosjektet — samme som tavlekolonner på GitHub.
                  Velg f.eks. <strong className="text-foreground">Status</strong> eller et
                  eget felt for «skal vurderes». Kort som legges inn manuelt i GitHub ligger
                  i samme felt; da styrer du kolonnen her, ikke bare standardfeltet «Status».
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2"
                  disabled={singleSelectFieldsLoading}
                  onClick={() => void loadSingleSelectFields()}
                >
                  {singleSelectFieldsLoading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  Hent kolonner fra prosjekt
                </Button>
              </div>
              {singleSelectFieldsError ? (
                <p className="text-destructive text-xs" role="alert">
                  {singleSelectFieldsError}
                </p>
              ) : null}
              {singleSelectFields.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="gh-project-single-select" className="text-xs">
                    Kolonne brukt av PVV
                  </Label>
                  <select
                    id="gh-project-single-select"
                    className="border-input bg-background h-10 w-full max-w-lg rounded-lg border px-3 text-sm"
                    value={singleSelectFieldId}
                    onChange={(e) => setSingleSelectFieldId(e.target.value)}
                  >
                    <option value="">
                      Automatisk — felt «Status», ellers første enkeltvalg-kolonne
                    </option>
                    {singleSelectFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.optionCount} valg)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Trykk «Hent kolonner» for å liste felt fra prosjektet (krever lagret
                  node-ID over).
                </p>
              )}
            </div>
          ) : null}
        </section>

        <Accordion
          multiple
          defaultValue={["dataflyt"]}
          className="border-border/60 rounded-xl border"
        >
          <AccordionItem value="dataflyt" className="border-border/60 not-last:border-b px-4">
            <AccordionTrigger className="text-sm hover:no-underline">
              Slik flyter data mellom PVV og GitHub
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4 pb-4 text-sm leading-relaxed">
              <div className="space-y-2">
                <p className="text-foreground font-medium">
                  Fra PVV → GitHub (API med lagret token)
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    <strong className="text-foreground">Opprett issue</strong>{" "}
                    sender tittel og beskrivelse til første standard-repo (eller
                    valgt repo hvis dere utvider flyten).
                  </li>
                  <li>
                    <strong className="text-foreground">Push til GitHub</strong>{" "}
                    oppdaterer issue-tekst og åpen/lukket-status fra oppgaven.
                  </li>
                  <li>
                    Valgfritt <strong className="text-foreground">prosjekt</strong>{" "}
                    — nye issues kan legges inn i valgt GitHub-prosjekt.
                    Bruk «Test lagret prosjekt» for API-tilgang, og opprett et issue
                    for å bekrefte at kortet vises i prosjekt-tavlen.
                  </li>
                </ol>
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-medium">
                  Fra GitHub → PVV
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    <strong className="text-foreground">Webhook</strong> (én gang
                    per repo/org): når et koblet issue{" "}
                    <strong className="text-foreground">lukkes eller gjenåpnes</strong>
                    , oppdateres oppgavestatus i PVV automatisk. Krever{" "}
                    <code className="bg-muted rounded px-1 font-mono text-xs">
                      GITHUB_WEBHOOK_SECRET
                    </code>{" "}
                    i Convex og samme hemmelighet i GitHub.
                  </li>
                  <li>
                    <strong className="text-foreground">Hent fra GitHub</strong>{" "}
                    — manuell synk av tittel, tekst og status fra issue til
                    oppgaven (nyttig etter redigering på GitHub).
                  </li>
                </ol>
              </div>
              <p className="border-border/60 text-xs italic">
                Full automatisk synk av all tekst begge veier krever enten webhook
                utvidet med flere hendelser eller hyppig «Hent» / «Push». I dag
                er webhook begrenset til{" "}
                <strong className="text-foreground not-italic">status</strong>{" "}
                (åpen/lukket).
              </p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="webhook" className="border-none px-4">
            <AccordionTrigger className="text-sm hover:no-underline">
              Sett opp webhook (URL og hemmelighet)
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-3 pb-4 text-sm leading-relaxed">
              <p>
                Uten dette får ikke PVV beskjed når noen lukker eller gjenåpner
                et issue på GitHub. Legg inn webhook i repo eller organisasjon:
              </p>
              {webhookUrl ? (
                <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center">
                  <code className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
                    {webhookUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 gap-1.5"
                    onClick={() => void copyText("webhook", webhookUrl)}
                  >
                    <ClipboardCopy className="size-3.5" />
                    {copyDone === "webhook" ? "Kopiert" : "Kopier"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs">
                  Sett{" "}
                  <code className="font-mono">NEXT_PUBLIC_GITHUB_WEBHOOK_URL</code>{" "}
                  (full URL) eller{" "}
                  <code className="font-mono">NEXT_PUBLIC_CONVEX_URL</code> for
                  å vise URL her.
                </p>
              )}
              <p className="text-xs">
                Hendelser: <strong className="text-foreground">Issues</strong>.
                Hemmelighet i GitHub må matche{" "}
                <code className="bg-muted rounded px-1 font-mono">
                  GITHUB_WEBHOOK_SECRET
                </code>{" "}
                i Convex.
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-0 text-xs"
                onClick={() =>
                  void copyText(
                    "secret",
                    "GITHUB_WEBHOOK_SECRET (samme verdi i GitHub og Convex)",
                  )
                }
              >
                <ClipboardCopy className="size-3" />
                {copyDone === "secret" ? "Hint kopiert" : "Kopier hjelpetekst"}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>

      <CardFooter className="bg-muted/15 border-border/50 flex flex-col gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          Repo og prosjekt lagres med knappen under (token lagres for seg).
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {githubSaveMessage ? (
            <span className="text-muted-foreground text-sm" role="status">
              {githubSaveMessage}
            </span>
          ) : null}
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => void saveGithubReposAndProject()}
          >
            Lagre repo og prosjekt
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
