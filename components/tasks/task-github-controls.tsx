"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatUserFacingError } from "@/lib/user-facing-error";
import { useAction, useMutation } from "convex/react";
import { ExternalLink, GitBranch } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  taskId: Id<"assessmentTasks">;
  canEdit: boolean;
  githubIssueUrl: string | null;
  /** Standard-repo(er) fra arbeidsområde — hint for «Opprett issue på GitHub» */
  workspaceDefaultRepos?: string[];
  /** Kompakt variant (f.eks. liste på vurdering) */
  compact?: boolean;
};

export function TaskGithubControls({
  taskId,
  canEdit,
  githubIssueUrl,
  workspaceDefaultRepos = [],
  compact,
}: Props) {
  const [issueUrl, setIssueUrl] = useState("");
  const [createRepoChoice, setCreateRepoChoice] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const linkGithub = useMutation(api.githubTasks.linkGithubIssue);
  const unlinkGithub = useMutation(api.githubTasks.unlinkGithubIssue);
  const createGithub = useAction(api.githubTasks.createGithubIssue);
  const syncFromGithub = useAction(api.githubTasks.syncFromGithub);
  const pushToGithub = useAction(api.githubTasks.pushToGithub);

  const linked = githubIssueUrl !== null;

  useEffect(() => {
    if (workspaceDefaultRepos.length === 0) {
      setCreateRepoChoice("");
      return;
    }
    setCreateRepoChoice((prev) =>
      prev && workspaceDefaultRepos.includes(prev)
        ? prev
        : workspaceDefaultRepos[0],
    );
  }, [workspaceDefaultRepos]);

  async function run(
    label: string,
    fn: () => Promise<unknown>,
  ) {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
      setMessage("OK.");
      setIssueUrl("");
    } catch (e) {
      setMessage(formatUserFacingError(e));
    } finally {
      setBusy(null);
    }
  }

  const gap = compact ? "gap-1.5" : "gap-2";
  const pad = compact ? "p-2.5" : "p-3";

  return (
    <div
      className={`bg-muted/20 rounded-lg border ${pad} space-y-2`}
      data-compact={compact ? "true" : undefined}
    >
      <div className={`flex flex-wrap items-center ${gap}`}>
        <GitBranch className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium text-xs">GitHub</span>
        {workspaceDefaultRepos.length > 0 ? (
          <span className="text-muted-foreground max-w-full text-[0.65rem] break-words">
            standard
            {workspaceDefaultRepos.length > 1 ? "repoer" : "repo"}:{" "}
            {workspaceDefaultRepos.join(", ")}
            {workspaceDefaultRepos.length > 1
              ? " · første brukes ved nytt issue"
              : ""}
          </span>
        ) : null}
      </div>

      {linked ? (
        <div className={`flex flex-col ${gap}`}>
          <Link
            href={githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            {githubIssueUrl.replace("https://", "")}
            <ExternalLink className="size-3" aria-hidden />
          </Link>
          <div className={`flex flex-wrap ${gap}`}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={!canEdit || busy !== null}
              onClick={() =>
                void run("sync", () =>
                  syncFromGithub({ taskId }),
                )
              }
            >
              {busy === "sync" ? "…" : "Hent fra GitHub"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={!canEdit || busy !== null}
              onClick={() =>
                void run("push", () => pushToGithub({ taskId }))
              }
            >
              {busy === "push" ? "…" : "Push til GitHub"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!canEdit || busy !== null}
              onClick={() =>
                void run("unlink", () => unlinkGithub({ taskId }))
              }
            >
              {busy === "unlink" ? "…" : "Fjern kobling"}
            </Button>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col ${gap}`}>
          <div className="space-y-1">
            <Label htmlFor={`gh-url-${taskId}`} className="text-xs">
              Koble til eksisterende issue
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`gh-url-${taskId}`}
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                placeholder="https://github.com/org/repo/issues/42"
                disabled={!canEdit || busy !== null}
                className="h-8 min-w-[200px] flex-1 text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={!canEdit || busy !== null || !issueUrl.trim()}
                onClick={() =>
                  void run("link", () =>
                    linkGithub({ taskId, issueUrl: issueUrl.trim() }),
                  )
                }
              >
                {busy === "link" ? "…" : "Koble"}
              </Button>
            </div>
          </div>
          {workspaceDefaultRepos.length > 1 ? (
            <div className="space-y-1">
              <Label htmlFor={`gh-create-repo-${taskId}`} className="text-xs">
                Opprett issue i repo
              </Label>
              <select
                id={`gh-create-repo-${taskId}`}
                className="border-input bg-background h-8 w-full max-w-xs rounded-lg border px-2 text-xs"
                value={createRepoChoice}
                onChange={(e) => setCreateRepoChoice(e.target.value)}
                disabled={!canEdit || busy !== null}
              >
                {workspaceDefaultRepos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 w-fit text-xs"
            disabled={
              !canEdit ||
              busy !== null ||
              (workspaceDefaultRepos.length > 0 && !createRepoChoice)
            }
            onClick={() =>
              void run("create", () =>
                createGithub({
                  taskId,
                  repoFullName:
                    workspaceDefaultRepos.length > 1
                      ? createRepoChoice
                      : undefined,
                }),
              )
            }
          >
            {busy === "create" ? "…" : "Opprett issue på GitHub"}
          </Button>
        </div>
      )}

      {message ? (
        <p
          className={`text-xs ${message === "OK." ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
